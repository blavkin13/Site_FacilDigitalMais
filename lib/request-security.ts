import type {
  NextRequest,
} from "next/server";


const SAFE_METHODS =
  new Set([
    "GET",
    "HEAD",
    "OPTIONS",
  ]);


/**
 * Endpoints legitimamente chamados por serviços
 * externos.
 *
 * Não adicione aqui endpoints utilizados pelo
 * browser apenas para contornar CSRF.
 */
const CSRF_EXEMPT_PATHS =
  new Set([
    "/api/webhooks/mercadopago",
  ]);


export type SameOriginDecision =
  | {
      allowed:
        true;
    }
  | {
      allowed:
        false;

      reason:
        "origin_mismatch" |
        "cross_site" |
        "invalid_origin";
    };


function normalizeOrigin(
  value:
    string | null |
    undefined
): string | null {
  if (
    !value ||
    value ===
      "null"
  ) {
    return null;
  }


  try {
    return new URL(
      value
    ).origin;
  } catch {
    return null;
  }
}


function firstForwardedValue(
  value:
    string | null
) {
  if (
    !value
  ) {
    return null;
  }


  const first =
    value
      .split(
        ","
      )[0]
      ?.trim();


  return first ||
    null;
}


function isValidHostHeader(
  value:
    string
) {
  /**
   * Hostname IPv4/IPv6/domínio + porta opcional.
   *
   * Principal objetivo aqui é impedir caracteres
   * que transformariam o header em uma URL
   * arbitrária.
   */
  return (
    value.length >
      0 &&
    value.length <=
      253 &&
    !/[\s/\\?#@]/.test(
      value
    )
  );
}


function addConfiguredOrigin(
  origins:
    Set<string>,
  value:
    string | undefined
) {
  if (
    !value
  ) {
    return;
  }


  const normalized =
    normalizeOrigin(
      value
    );


  if (
    normalized
  ) {
    origins.add(
      normalized
    );
  }
}


function addHeaderDerivedOrigin(
  origins:
    Set<string>,
  {
    host,
    protocol,
  }: {
    host:
      string | null;

    protocol:
      string | null;
  }
) {
  if (
    !host ||
    !isValidHostHeader(
      host
    )
  ) {
    return;
  }


  if (
    protocol !==
      "http" &&
    protocol !==
      "https"
  ) {
    return;
  }


  const normalized =
    normalizeOrigin(
      `${protocol}://${host}`
    );


  if (
    normalized
  ) {
    origins.add(
      normalized
    );
  }
}


/**
 * Calcula as origens pelas quais esta requisição
 * legitimamente pode ter chegado.
 *
 * Isso é necessário porque, atrás de:
 *
 * - GitHub Codespaces;
 * - Nginx;
 * - outro reverse proxy;
 *
 * request.nextUrl.origin pode representar a
 * comunicação interna, enquanto Origin representa
 * a URL pública utilizada pelo navegador.
 */
export function getAllowedRequestOrigins(
  request:
    NextRequest
) {
  const allowed =
    new Set<string>();


  /**
   * Origem que o próprio Next.js calculou.
   */
  allowed.add(
    request.nextUrl.origin
  );


  /**
   * Origem explicitamente configurada.
   */
  addConfiguredOrigin(
    allowed,
    process.env
      .APP_BASE_URL
  );


  addConfiguredOrigin(
    allowed,
    process.env
      .NEXT_PUBLIC_BASE_URL
  );


  /**
   * Origem pública preservada pelo reverse proxy.
   *
   * GitHub Codespaces e Nginx normalmente
   * encaminham esses valores.
   */
  const forwardedHost =
    firstForwardedValue(
      request.headers.get(
        "x-forwarded-host"
      )
    );


  const forwardedProtocol =
    firstForwardedValue(
      request.headers.get(
        "x-forwarded-proto"
      )
    )?.toLowerCase() ??
    null;


  addHeaderDerivedOrigin(
    allowed,
    {
      host:
        forwardedHost,

      protocol:
        forwardedProtocol,
    }
  );


  /**
   * Host é um header controlado pela camada HTTP
   * do navegador/proxy e é mais confiável para
   * este propósito do que tentar adivinhar a URL
   * pública a partir de localhost.
   *
   * Se X-Forwarded-Proto existir, preservamos o
   * protocolo externo. Caso contrário usamos o
   * protocolo percebido pelo Next.js.
   */
  const host =
    request.headers.get(
      "host"
    );


  const requestProtocol =
    request.nextUrl.protocol
      .replace(
        ":",
        ""
      )
      .toLowerCase();


  addHeaderDerivedOrigin(
    allowed,
    {
      host,

      protocol:
        forwardedProtocol ??
        requestProtocol,
    }
  );


  return allowed;
}


export function isCsrfExemptPath(
  pathname:
    string
) {
  return CSRF_EXEMPT_PATHS.has(
    pathname
  );
}


export function requiresCsrfCheck(
  request:
    NextRequest
) {
  if (
    SAFE_METHODS.has(
      request.method
        .toUpperCase()
    )
  ) {
    return false;
  }


  if (
    isCsrfExemptPath(
      request.nextUrl.pathname
    )
  ) {
    return false;
  }


  return request.nextUrl.pathname.startsWith(
    "/api/"
  );
}


/**
 * Defesa CSRF baseada em Origin e Fetch Metadata.
 *
 * Sessões usam SameSite=Lax, portanto esta é uma
 * segunda camada de proteção.
 */
export function validateSameOriginMutation(
  request:
    NextRequest
): SameOriginDecision {
  if (
    !requiresCsrfCheck(
      request
    )
  ) {
    return {
      allowed:
        true,
    };
  }


  const rawOrigin =
    request.headers.get(
      "origin"
    );


  if (
    rawOrigin !==
      null
  ) {
    const origin =
      normalizeOrigin(
        rawOrigin
      );


    if (
      !origin
    ) {
      return {
        allowed:
          false,

        reason:
          "invalid_origin",
      };
    }


    const allowedOrigins =
      getAllowedRequestOrigins(
        request
      );


    if (
      !allowedOrigins.has(
        origin
      )
    ) {
      return {
        allowed:
          false,

        reason:
          "origin_mismatch",
      };
    }


    return {
      allowed:
        true,
    };
  }


  const fetchSite =
    request.headers
      .get(
        "sec-fetch-site"
      )
      ?.toLowerCase();


  /**
   * same-site não significa same-origin.
   *
   * Outro subdomínio da mesma organização não
   * deve receber permissão implicitamente.
   */
  if (
    fetchSite ===
      "cross-site" ||
    fetchSite ===
      "same-site"
  ) {
    return {
      allowed:
        false,

      reason:
        "cross_site",
    };
  }


  if (
    fetchSite &&
    fetchSite !==
      "same-origin" &&
    fetchSite !==
      "none"
  ) {
    return {
      allowed:
        false,

      reason:
        "cross_site",
    };
  }


  /**
   * Clientes server-to-server legítimos podem
   * não enviar Origin nem Fetch Metadata.
   *
   * Navegadores modernos enviam esses sinais nas
   * requisições relevantes e o cookie ainda está
   * protegido por SameSite=Lax.
   */
  return {
    allowed:
      true,
  };
}