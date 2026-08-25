import type {
  NextConfig,
} from "next";


const isProduction =
  process.env.NODE_ENV ===
  "production";


const contentSecurityPolicy =
  [
    "default-src 'self'",

    /**
     * Next.js ainda utiliza scripts inline para
     * bootstrap/hidratação.
     *
     * Remover unsafe-inline exigirá CSP com nonce,
     * que será uma evolução separada.
     *
     * unsafe-eval existe SOMENTE em development
     * por compatibilidade com o bundler.
     */
    `script-src 'self' 'unsafe-inline'${
      isProduction
        ? ""
        : " 'unsafe-eval'"
    }`,

    "style-src 'self' 'unsafe-inline'",

    /**
     * Capas podem futuramente utilizar storage/CDN
     * HTTPS. blob/data também cobrem previews.
     */
    "img-src 'self' data: blob: https:",

    "font-src 'self' data:",

    isProduction
      ? "connect-src 'self'"
      : "connect-src 'self' ws: wss:",

    /**
     * Mantemos Mercado Pago liberado para eventual
     * integração incorporada, embora o checkout
     * atual faça redirect top-level.
     */
    "frame-src 'self' https://mercadopago.com https://*.mercadopago.com",

    "object-src 'none'",

    "base-uri 'self'",

    "frame-ancestors 'none'",

    "form-action 'self' https://mercadopago.com https://*.mercadopago.com",
  ]
    .concat(
      isProduction
        ? [
            "upgrade-insecure-requests",
          ]
        : []
    )
    .join(
      "; "
    );


const securityHeaders = [
  {
    key:
      "Content-Security-Policy",

    value:
      contentSecurityPolicy,
  },

  {
    key:
      "X-Content-Type-Options",

    value:
      "nosniff",
  },

  {
    key:
      "Referrer-Policy",

    value:
      "strict-origin-when-cross-origin",
  },

  {
    key:
      "X-Frame-Options",

    value:
      "DENY",
  },

  {
    key:
      "Permissions-Policy",

    value:
      "camera=(), microphone=(), geolocation=()",
  },

  {
    key:
      "X-DNS-Prefetch-Control",

    value:
      "off",
  },

  ...(isProduction
    ? [
        {
          key:
            "Strict-Transport-Security",

          value:
            "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];


const privateApiHeaders = [
  {
    key:
      "Cache-Control",

    value:
      "private, no-store, max-age=0",
  },

  {
    key:
      "Pragma",

    value:
      "no-cache",
  },
];


const nextConfig:
  NextConfig =
  {
    async headers() {
      return [
        /**
         * Headers de navegador aplicados em todo
         * o site.
         */
        {
          source:
            "/:path*",

          headers:
            securityHeaders,
        },


        /**
         * APIs contendo dados de usuário, sessão
         * ou administração nunca devem ser
         * reutilizadas por cache intermediário.
         */
        {
          source:
            "/api/auth/:path*",

          headers:
            privateApiHeaders,
        },

        {
          source:
            "/api/admin/:path*",

          headers:
            privateApiHeaders,
        },

        {
          source:
            "/api/simulations/:path*",

          headers:
            privateApiHeaders,
        },

        {
          source:
            "/api/orders/:path*",

          headers:
            privateApiHeaders,
        },

        {
          source:
            "/api/download/:path*",

          headers:
            privateApiHeaders,
        },
      ];
    },
  };


export default nextConfig;