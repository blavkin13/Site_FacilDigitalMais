import type {
  NextRequest,
} from "next/server";

import {
  getAppBaseUrl,
  PaymentConfigurationError,
} from "./payment-config";


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


export function getAllowedRequestOrigins(
  request:
    NextRequest
) {
  const allowed =
    new Set<string>();


  const isProduction =
    process.env
      .NODE_ENV
      ?.trim()
      .toLowerCase() ===
    "production";


  /**
   * Produção possui uma única autoridade pública:
   * APP_BASE_URL.
   *
   * A validação é exatamente a mesma utilizada pelo
   * checkout:
   *
   * - variável obrigatória;
   * - HTTPS obrigatório;
   * - host público;
   * - sem credenciais;
   * - sem path;
   * - sem query;
   * - sem fragmento.
   *
   * Uma configuração inválida não cria nenhuma
   * origem confiável.
   */
  if (
    isProduction
  ) {
    try {
      allowed.add(
        getAppBaseUrl(
          process.env
        )
      );
    } catch (error) {
      if (
        error instanceof
        PaymentConfigurationError
      ) {
        return allowed;
      }


      throw error;
    }


    return allowed;
  }


  /**
   * Fora de produção APP_BASE_URL continua podendo
   * representar explicitamente o ambiente local.
   *
   * NEXT_PUBLIC_BASE_URL permanece deliberadamente
   * fora da política de segurança.
   */
  addConfiguredOrigin(
    allowed,
    process.env
      .APP_BASE_URL
  );


  /**
   * Em desenvolvimento/testes mantemos suporte
   * para acesso direto e ambientes intermediados
   * como GitHub Codespaces.
   */
  allowed.add(
    request.nextUrl.origin
  );


  /**
   * Origem pública preservada por proxy de
   * desenvolvimento.
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
   * Compatibilidade local quando não existe
   * X-Forwarded-Host.
   *
   * Host e headers de proxy nunca criam autoridade
   * em produção.
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


  const isProduction =
    process.env
      .NODE_ENV
      ?.trim()
      .toLowerCase() ===
    "production";


  /**
   * Em produção, uma API mutável não pode operar
   * sem uma autoridade canônica válida.
   *
   * Isso também protege requisições que não trazem
   * Origin, pois anteriormente getAllowedRequestOrigins
   * só era consultado dentro dessa ramificação.
   */
  const allowedOrigins =
    getAllowedRequestOrigins(
      request
    );


  if (
    isProduction &&
    allowedOrigins.size ===
      0
  ) {
    return {
      allowed:
        false,

      reason:
        "origin_mismatch",
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