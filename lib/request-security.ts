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
 * Endpoints chamados legitimamente por serviços
 * externos e que possuem sua própria validação.
 *
 * Nunca adicione aqui uma API usada pelo browser
 * apenas para "resolver" um erro de CSRF.
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


function getAllowedOrigins(
  request:
    NextRequest
) {
  const allowed =
    new Set<string>();


  /**
   * Origem vista pelo próprio Next.js.
   *
   * Em produção o Nginx deverá preservar Host
   * e protocolo encaminhados corretamente.
   */
  allowed.add(
    request.nextUrl.origin
  );


  /**
   * Origem canônica opcional.
   *
   * Facilita deploy atrás de reverse proxy sem
   * enfraquecer a comparação para qualquer Host.
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
 * Defesa CSRF baseada em Origin + Fetch Metadata.
 *
 * A sessão já utiliza SameSite=Lax, portanto esta
 * verificação é uma camada adicional.
 *
 * Regras:
 *
 * 1. Se Origin existe, ele PRECISA ser exatamente
 *    uma origem permitida.
 *
 * 2. Se Origin não existe mas Sec-Fetch-Site diz
 *    cross-site/same-site, rejeitamos.
 *
 * 3. Clientes não-browser e testes que não enviam
 *    nenhum dos dois headers continuam possíveis.
 *
 * Um ataque originado em navegador moderno envia
 * Origin ou Fetch Metadata, portanto não ganha
 * acesso apenas omitindo Origin via JavaScript.
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
      getAllowedOrigins(
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
   * same-site NÃO significa same-origin.
   *
   * Um subdomínio comprometido não deve poder
   * executar mutações autenticadas.
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
   * Sem Origin e sem Fetch Metadata:
   *
   * preservamos clientes server-to-server,
   * scripts administrativos e testes.
   *
   * O browser normal continua coberto pelas
   * regras anteriores e pelo SameSite=Lax.
   */
  return {
    allowed:
      true,
  };
}