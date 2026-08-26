export interface PaymentEnvironment {
  NODE_ENV?: string;
  APP_BASE_URL?: string;
  MERCADO_PAGO_ACCESS_TOKEN?: string;
  MERCADO_PAGO_WEBHOOK_SECRET?: string;
}


export class PaymentConfigurationError
  extends Error {
  readonly code =
    "PAYMENT_CONFIGURATION_ERROR";

  constructor(
    message: string
  ) {
    super(
      message
    );

    this.name =
      "PaymentConfigurationError";
  }
}


const blockedTokenValues =
  new Set(
    [
      "TEST-ACCESS-TOKEN-FAKE",
      "CHANGE_ME",
      "CHANGEME",
      "YOUR_ACCESS_TOKEN",
      "YOUR_MERCADO_PAGO_ACCESS_TOKEN",
      "MERCADO_PAGO_ACCESS_TOKEN",
      "SEU_ACCESS_TOKEN",
      "SEU_TOKEN",
      "TOKEN_AQUI",
      "YOUR_WEBHOOK_SECRET",
      "SEU_WEBHOOK_SECRET",
      "MERCADO_PAGO_WEBHOOK_SECRET",
    ]
  );


function looksLikePlaceholder(
  value: string
): boolean {
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    blockedTokenValues.has(
      normalized
    )
  ) {
    return true;
  }


  if (
    /^<[^>]+>$/.test(
      normalized
    )
  ) {
    return true;
  }


  if (
    /^(YOUR|SEU|SUA|INSIRA|COLOQUE)[-_ ]/.test(
      normalized
    )
  ) {
    return true;
  }


  return false;
}


function isLocalHostname(
  hostname: string
): boolean {
  const normalized =
    hostname
      .trim()
      .toLowerCase();


  return (
    normalized ===
      "localhost" ||
    normalized ===
      "127.0.0.1" ||
    normalized ===
      "::1"
  );
}


export function getMercadoPagoAccessToken(
  environment:
    PaymentEnvironment =
      process.env
): string {
  const token =
    environment
      .MERCADO_PAGO_ACCESS_TOKEN
      ?.trim();


  if (!token) {
    throw new PaymentConfigurationError(
      "Mercado Pago não está configurado."
    );
  }


  if (
    looksLikePlaceholder(
      token
    )
  ) {
    throw new PaymentConfigurationError(
      "Credencial do Mercado Pago é inválida."
    );
  }


  return token;
}


export function getMercadoPagoWebhookSecret(
  environment:
    PaymentEnvironment =
      process.env
): string {
  const secret =
    environment
      .MERCADO_PAGO_WEBHOOK_SECRET
      ?.trim();


  if (!secret) {
    throw new PaymentConfigurationError(
      "Webhook do Mercado Pago não está configurado."
    );
  }


  if (
    looksLikePlaceholder(
      secret
    )
  ) {
    throw new PaymentConfigurationError(
      "Segredo do webhook Mercado Pago é inválido."
    );
  }


  return secret;
}


export function getAppBaseUrl(
  environment:
    PaymentEnvironment =
      process.env
): string {
  const rawBaseUrl =
    environment
      .APP_BASE_URL
      ?.trim();


  if (!rawBaseUrl) {
    throw new PaymentConfigurationError(
      "APP_BASE_URL não está configurada."
    );
  }


  let url:
    URL;


  try {
    url =
      new URL(
        rawBaseUrl
      );
  } catch {
    throw new PaymentConfigurationError(
      "APP_BASE_URL é inválida."
    );
  }


  if (
    url.protocol !==
      "http:" &&
    url.protocol !==
      "https:"
  ) {
    throw new PaymentConfigurationError(
      "APP_BASE_URL deve utilizar HTTP ou HTTPS."
    );
  }


  if (
    url.username ||
    url.password
  ) {
    throw new PaymentConfigurationError(
      "APP_BASE_URL não pode conter credenciais."
    );
  }


  if (
    url.search ||
    url.hash
  ) {
    throw new PaymentConfigurationError(
      "APP_BASE_URL não pode conter query ou fragmento."
    );
  }


  if (
    url.pathname !==
      "/" &&
    url.pathname !==
      ""
  ) {
    throw new PaymentConfigurationError(
      "APP_BASE_URL deve apontar para a origem da aplicação."
    );
  }


  const nodeEnvironment =
    environment
      .NODE_ENV
      ?.trim()
      .toLowerCase();


  const isProduction =
    nodeEnvironment ===
      "production";


  const isLocal =
    isLocalHostname(
      url.hostname
    );


  if (isProduction) {
    if (
      url.protocol !==
      "https:"
    ) {
      throw new PaymentConfigurationError(
        "APP_BASE_URL deve utilizar HTTPS em produção."
      );
    }


    if (isLocal) {
      throw new PaymentConfigurationError(
        "APP_BASE_URL de produção não pode apontar para localhost."
      );
    }
  } else if (
    url.protocol ===
      "http:" &&
    !isLocal
  ) {
    throw new PaymentConfigurationError(
      "HTTP sem TLS só é permitido em desenvolvimento local."
    );
  }


  return url.origin;
}