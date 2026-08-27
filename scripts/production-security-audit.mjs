import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";

import {
  execFileSync,
} from "node:child_process";

import {
  extname,
  join,
  relative,
} from "node:path";


const ROOT =
  process.cwd();


const argumentsList =
  process.argv.slice(
    2
  );


const jsonMode =
  argumentsList.includes(
    "--json"
  );


const unknownArguments =
  argumentsList.filter(
    (
      argument
    ) =>
      argument !==
      "--json"
  );


if (
  unknownArguments.length >
  0
) {
  console.error(
    `Argumento não reconhecido: ${unknownArguments[0]}`
  );

  process.exit(
    2
  );
}


const checks =
  [];


function absolutePath(
  relativePath
) {
  return join(
    ROOT,
    relativePath
  );
}


function assertCondition(
  condition,
  message
) {
  if (
    !condition
  ) {
    throw new Error(
      message
    );
  }
}


function read(
  relativePath
) {
  const path =
    absolutePath(
      relativePath
    );


  assertCondition(
    existsSync(
      path
    ),
    `Arquivo obrigatório ausente: ${relativePath}`
  );


  return readFileSync(
    path,
    "utf8"
  );
}


/**
 * Remove somente comentários JS/TS.
 *
 * Comentários podem mencionar padrões proibidos
 * justamente para documentar que eles são
 * proibidos. A auditoria de código executável não
 * deve gerar falso positivo por isso.
 */
function stripJavaScriptComments(
  source
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    )
    .replace(
      /^\s*\/\/.*$/gm,
      ""
    );
}


function runCheck(
  name,
  callback
) {
  try {
    callback();


    checks.push({
      name,
      ok:
        true,
    });
  } catch (
    error
  ) {
    checks.push({
      name,
      ok:
        false,

      error:
        error instanceof Error
          ? error.message
          : "Falha desconhecida.",
    });
  }
}


function countMatches(
  source,
  pattern
) {
  return (
    source.match(
      pattern
    ) ??
    []
  ).length;
}


function getTrackedFiles() {
  try {
    return execFileSync(
      "git",
      [
        "ls-files",
      ],
      {
        cwd:
          ROOT,

        encoding:
          "utf8",

        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      }
    )
      .split(
        /\r?\n/
      )
      .map(
        (
          value
        ) =>
          value.trim()
      )
      .filter(
        Boolean
      );
  } catch {
    throw new Error(
      "Não foi possível consultar os arquivos versionados pelo Git."
    );
  }
}


function getActiveEnvironmentValue(
  source,
  variableName
) {
  for (
    const line
    of source.split(
      /\r?\n/
    )
  ) {
    const trimmed =
      line.trim();


    if (
      !trimmed ||
      trimmed.startsWith(
        "#"
      )
    ) {
      continue;
    }


    const match =
      trimmed.match(
        /^([A-Z][A-Z0-9_]*)\s*=(.*)$/
      );


    if (
      !match ||
      match[1] !==
        variableName
    ) {
      continue;
    }


    return (
      match[2] ??
      ""
    ).trim();
  }


  return undefined;
}


function collectRuntimeFiles() {
  const roots = [
    "app",
    "lib",
  ];


  const extensions =
    new Set([
      ".ts",
      ".tsx",
      ".js",
      ".mjs",
      ".cjs",
    ]);


  const result =
    [];


  function walk(
    directory
  ) {
    for (
      const entry
      of readdirSync(
        absolutePath(
          directory
        ),
        {
          withFileTypes:
            true,
        }
      )
    ) {
      const child =
        join(
          directory,
          entry.name
        );


      if (
        entry.isDirectory()
      ) {
        if (
          [
            "node_modules",
            ".next",
            ".git",
            "data",
          ].includes(
            entry.name
          )
        ) {
          continue;
        }


        walk(
          child
        );

        continue;
      }


      if (
        extensions.has(
          extname(
            entry.name
          )
        )
      ) {
        result.push(
          child
        );
      }
    }
  }


  for (
    const root
    of roots
  ) {
    if (
      existsSync(
        absolutePath(
          root
        )
      )
    ) {
      walk(
        root
      );
    }
  }


  return result;
}


runCheck(
  "arquivos críticos de produção existem",
  () => {
    for (
      const file
      of [
        ".env.example",
        ".gitignore",
        "ecosystem.config.cjs",
        "scripts/deploy-hostinger.sh",
        "scripts/nginx-config.conf",
        "lib/payment-config.ts",
        "lib/request-security.ts",
        "lib/mercadopago.ts",
        "lib/mercadopago-webhook.ts",
        "lib/mercadopago-webhook-handler.ts",
        "lib/payment-order-state.ts",
        "app/api/admin/orders/route.ts",
        "app/api/checkout/status/route.ts",
        "components/checkout-success.tsx",
      ]
    ) {
      assertCondition(
        existsSync(
          absolutePath(
            file
          )
        ),
        `Arquivo obrigatório ausente: ${file}`
      );
    }
  }
);


runCheck(
  "somente .env.example pode estar versionado",
  () => {
    const tracked =
      getTrackedFiles();


    const trackedEnvironmentFiles =
      tracked.filter(
        (
          file
        ) => {
          const basename =
            file
              .split(
                "/"
              )
              .at(
                -1
              );


          return (
            basename ===
              ".env" ||
            basename?.startsWith(
              ".env."
            ) ||
            basename ===
              "production.env"
          );
        }
      );


    assertCondition(
      trackedEnvironmentFiles.every(
        (
          file
        ) =>
          file ===
          ".env.example"
      ),
      `Arquivo de ambiente indevidamente versionado: ${trackedEnvironmentFiles.join(
        ", "
      )}`
    );
  }
);


runCheck(
  ".gitignore protege ambiente e dados persistentes",
  () => {
    const source =
      read(
        ".gitignore"
      );


    for (
      const required
      of [
        ".env*",
        "!.env.example",
        "data/*.db",
        "data/*.db-wal",
        "data/*.db-shm",
        "data/protected/",
        "data/uploads/",
      ]
    ) {
      assertCondition(
        source.includes(
          required
        ),
        `.gitignore não contém: ${required}`
      );
    }
  }
);


runCheck(
  ".env.example não contém credenciais reais Mercado Pago",
  () => {
    const source =
      read(
        ".env.example"
      );


    for (
      const variableName
      of [
        "MERCADO_PAGO_ACCESS_TOKEN",
        "MERCADO_PAGO_WEBHOOK_SECRET",
      ]
    ) {
      const value =
        getActiveEnvironmentValue(
          source,
          variableName
        );


      assertCondition(
        value !==
        undefined,
        `${variableName} não está documentada em .env.example`
      );


      const safePlaceholder =
        value ===
          "" ||
        /^(?:<.*>|YOUR_|SEU_|CHANGE_ME|PLACEHOLDER)/i.test(
          value
        );


      assertCondition(
        safePlaceholder,
        `${variableName} possui valor não seguro em .env.example`
      );
    }
  }
);


runCheck(
  "nenhum token Mercado Pago real está embutido no runtime",
  () => {
    const suspiciousPatterns = [
      /APP_USR-[A-Za-z0-9_-]{20,}/,
      /MERCADO_PAGO_ACCESS_TOKEN\s*=\s*["'][^"']{12,}["']/,
      /MERCADO_PAGO_WEBHOOK_SECRET\s*=\s*["'][^"']{12,}["']/,
    ];


    for (
      const file
      of collectRuntimeFiles()
    ) {
      const executable =
        stripJavaScriptComments(
          read(
            file
          )
        );


      for (
        const pattern
        of suspiciousPatterns
      ) {
        assertCondition(
          !pattern.test(
            executable
          ),
          `Possível segredo embutido em ${file}`
        );
      }
    }
  }
);


runCheck(
  "APP_BASE_URL é a autoridade de origem em produção",
  () => {
    const source =
      stripJavaScriptComments(
        read(
          "lib/request-security.ts"
        )
      );


    assertCondition(
      source.includes(
        "getAppBaseUrl"
      ),
      "request-security não usa getAppBaseUrl"
    );


    assertCondition(
      source.includes(
        "PaymentConfigurationError"
      ),
      "request-security não trata falha de configuração"
    );


    assertCondition(
      /NODE_ENV[\s\S]{0,120}production/.test(
        source
      ),
      "request-security não possui política explícita de produção"
    );


    assertCondition(
      !source.includes(
        "NEXT_PUBLIC_BASE_URL"
      ),
      "NEXT_PUBLIC_BASE_URL participa da autoridade de segurança"
    );
  }
);


runCheck(
  "payment-config exige origem HTTPS pública em produção",
  () => {
    const source =
      stripJavaScriptComments(
        read(
          "lib/payment-config.ts"
        )
      );


    assertCondition(
      source.includes(
        "getAppBaseUrl"
      ),
      "getAppBaseUrl ausente"
    );


    assertCondition(
      source.includes(
        "APP_BASE_URL"
      ),
      "APP_BASE_URL ausente"
    );


    assertCondition(
      /production/.test(
        source
      ),
      "validação de produção ausente"
    );


    assertCondition(
      /https/i.test(
        source
      ),
      "validação HTTPS ausente"
    );


    assertCondition(
      /localhost/i.test(
        source
      ),
      "bloqueio de localhost em produção ausente"
    );
  }
);


runCheck(
  "webhook autentica antes de banco e provedor",
  () => {
    const source =
      stripJavaScriptComments(
        read(
          "lib/mercadopago-webhook-handler.ts"
        )
      );


    const handlerStart =
      source.indexOf(
        "return async function mercadoPagoWebhookPost"
      );


    assertCondition(
      handlerStart >=
        0,
      "Handler Mercado Pago não localizado"
    );


    const handler =
      source.slice(
        handlerStart
      );


    const signatureIndex =
      handler.indexOf(
        ".validateSignature("
      );


    const parseIndex =
      handler.indexOf(
        ".parseNotification("
      );


    const databaseIndex =
      handler.indexOf(
        ".initializeDatabase("
      );


    const providerIndex =
      handler.indexOf(
        ".getPayment("
      );


    assertCondition(
      signatureIndex >=
        0,
      "Validação de assinatura ausente"
    );


    assertCondition(
      parseIndex >
        signatureIndex,
      "Payload é processado antes da assinatura"
    );


    assertCondition(
      databaseIndex >
        signatureIndex,
      "Banco é acessado antes da assinatura"
    );


    assertCondition(
      providerIndex >
        signatureIndex,
      "Provedor é acessado antes da assinatura"
    );
  }
);


runCheck(
  "webhook suporta payment e chargeback canônicos",
  () => {
    const source =
      read(
        "lib/mercadopago-webhook-handler.ts"
      );


    assertCondition(
      source.includes(
        "topic_chargebacks_wh"
      ),
      "Webhook oficial de chargeback não está suportado"
    );


    assertCondition(
      source.includes(
        "getMercadoPagoChargebackPaymentId"
      ),
      "Chargeback não resolve payment_id pelo recurso canônico"
    );


    assertCondition(
      source.includes(
        "getPaymentStatus"
      ),
      "Payment não é consultado no provedor"
    );


    assertCondition(
      !/modo demo|simula aprova|DEMO-/i.test(
        source
      ),
      "Webhook contém fallback/demo financeiro"
    );
  }
);


runCheck(
  "webhook não expõe external_reference em console",
  () => {
    const source =
      stripJavaScriptComments(
        read(
          "lib/mercadopago-webhook-handler.ts"
        )
      );


    assertCondition(
      !/console\.(?:log|warn|error)\s*\([\s\S]{0,260}?external_reference\s*=\s*\$\{/i.test(
        source
      ),
      "external_reference ainda é emitida em console financeiro"
    );


    assertCondition(
      !/console\.(?:log|warn|error)\s*\([\s\S]{0,180}?xSignature/i.test(
        source
      ),
      "x-signature não pode ser registrada"
    );


    assertCondition(
      !/console\.(?:log|warn|error)\s*\([\s\S]{0,180}?rawBody/i.test(
        source
      ),
      "payload bruto não pode ser registrado"
    );
  }
);


runCheck(
  "SDK Mercado Pago não despeja erro bruto nos logs conhecidos",
  () => {
    const source =
      stripJavaScriptComments(
        read(
          "lib/mercadopago.ts"
        )
      );


    assertCondition(
      !/Erro ao criar preferência Mercado Pago:\s*["'`]?\s*,?\s*error/i.test(
        source
      ),
      "Criação da preferência ainda pode logar objeto bruto"
    );


    assertCondition(
      !/console\.error\s*\(\s*["']Erro ao consultar pagamento:["']\s*,\s*error\s*\)/m.test(
        source
      ),
      "Consulta do pagamento ainda loga objeto bruto"
    );
  }
);


runCheck(
  "checkout não envia preço do browser como autoridade",
  () => {
    const source =
      stripJavaScriptComments(
        read(
          "components/checkout-real.tsx"
        )
      );


    const bodyIndex =
      source.indexOf(
        "body: JSON.stringify"
      );


    assertCondition(
      bodyIndex >=
        0,
      "Payload do checkout não localizado"
    );


    const bodyRegion =
      source.slice(
        bodyIndex,
        bodyIndex +
          900
      );


    assertCondition(
      !/\bprice\s*:/.test(
        bodyRegion
      ),
      "Preço está sendo enviado pelo browser como parte do pedido"
    );


    assertCondition(
      /slug/.test(
        bodyRegion
      ),
      "Checkout deve enviar identidade do produto"
    );
  }
);


runCheck(
  "retorno do checkout é autenticado e read-only",
  () => {
    const route =
      stripJavaScriptComments(
        read(
          "app/api/checkout/status/route.ts"
        )
      );


    assertCondition(
      route.includes(
        "validateSession"
      ),
      "Status do checkout não valida sessão"
    );


    assertCondition(
      route.includes(
        "external_reference"
      ),
      "Status do checkout não correlaciona referência"
    );


    for (
      const writePattern
      of [
        /\.update\s*\(/,
        /\.insert\s*\(/,
        /\.delete\s*\(/,
      ]
    ) {
      assertCondition(
        !writePattern.test(
          route
        ),
        "Endpoint de status do checkout contém escrita"
      );
    }
  }
);


runCheck(
  "success não usa query financeira como confirmação",
  () => {
    const source =
      stripJavaScriptComments(
        read(
          "components/checkout-success.tsx"
        )
      );


    for (
      const forbiddenQuery
      of [
        "status",
        "collection_status",
        "payment_id",
        "collection_id",
        "demo",
      ]
    ) {
      const pattern =
        new RegExp(
          `searchParams\\.get\\(\\s*["']${forbiddenQuery}["']\\s*\\)`
        );


      assertCondition(
        !pattern.test(
          source
        ),
        `Checkout success confia em ${forbiddenQuery} da URL`
      );
    }


    assertCondition(
      /searchParams\.get\(\s*["']external_reference["']\s*\)/.test(
        source
      ),
      "external_reference não é usada como localizador"
    );


    assertCondition(
      source.includes(
        "/api/checkout/status"
      ),
      "UI não consulta estado persistido no backend"
    );


    assertCondition(
      /status\s*===\s*["']approved["']/.test(
        source
      ),
      "UI não exige approved persistido"
    );


    assertCondition(
      /entitlementActive\s*!==\s*true/.test(
        source
      ),
      "UI não exige entitlementActive explícito"
    );
  }
);


runCheck(
  "admin de pedidos é estritamente read-only",
  () => {
    const source =
      stripJavaScriptComments(
        read(
          "app/api/admin/orders/route.ts"
        )
      );


    assertCondition(
      /export\s+async\s+function\s+GET\s*\(/.test(
        source
      ),
      "GET administrativo de pedidos ausente"
    );


    for (
      const method
      of [
        "POST",
        "PATCH",
        "PUT",
        "DELETE",
      ]
    ) {
      const pattern =
        new RegExp(
          `export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`
        );


      assertCondition(
        !pattern.test(
          source
        ),
        `Admin orders exporta ${method}`
      );
    }


    assertCondition(
      !/\.update\s*\(\s*orders\s*\)/.test(
        source
      ),
      "Admin orders altera orders"
    );
  }
);


runCheck(
  "writers de orders estão restritos aos módulos financeiros autorizados",
  () => {
    const allowed =
      new Set([
        "lib/checkout-order.ts",
        "lib/payment-order-state.ts",
      ]);


    const writers =
      [];


    for (
      const file
      of collectRuntimeFiles()
    ) {
      const source =
        stripJavaScriptComments(
          read(
            file
          )
        );


      if (
        /\.update\s*\(\s*orders\s*\)/m.test(
          source
        )
      ) {
        writers.push(
          file
        );
      }
    }


    for (
      const writer
      of writers
    ) {
      assertCondition(
        allowed.has(
          writer
        ),
        `Writer de orders não autorizado: ${writer}`
      );
    }


    assertCondition(
      writers.includes(
        "lib/checkout-order.ts"
      ),
      "Writer legítimo de preference_id não localizado"
    );


    assertCondition(
      writers.includes(
        "lib/payment-order-state.ts"
      ),
      "State machine financeira não localizada"
    );
  }
);


runCheck(
  "paths persistentes de produção ficam fora do release",
  () => {
    const source =
      read(
        ".env.example"
      );


    for (
      const requiredPath
      of [
        "/var/lib/facil-digital-plus/database/prod.db",
        "/var/lib/facil-digital-plus/uploads",
        "/var/lib/facil-digital-plus/protected",
        "/var/backups/facil-digital-plus/sqlite",
      ]
    ) {
      assertCondition(
        source.includes(
          requiredPath
        ),
        `Path de produção não documentado: ${requiredPath}`
      );
    }
  }
);


runCheck(
  "PM2 carrega ambiente externo protegido",
  () => {
    const source =
      read(
        "ecosystem.config.cjs"
      );


    assertCondition(
      source.includes(
        "--env-file=/etc/facil-digital-plus/production.env"
      ),
      "PM2 não usa production.env protegido"
    );


    assertCondition(
      !source.includes(
        "MERCADO_PAGO_ACCESS_TOKEN"
      ),
      "Access Token não pode estar no ecosystem"
    );


    assertCondition(
      !source.includes(
        "MERCADO_PAGO_WEBHOOK_SECRET"
      ),
      "Webhook Secret não pode estar no ecosystem"
    );


    assertCondition(
      /instances\s*:\s*1/.test(
        source
      ),
      "PM2 deve usar uma instância com SQLite"
    );


    assertCondition(
      /exec_mode\s*:\s*["']fork["']/.test(
        source
      ),
      "PM2 deve usar fork"
    );


    assertCondition(
      /127\.0\.0\.1/.test(
        source
      ),
      "Next deve escutar somente no bind interno"
    );
  }
);


runCheck(
  "deploy é determinístico e fail-closed",
  () => {
    const source =
      read(
        "scripts/deploy-hostinger.sh"
      );


    assertCondition(
      source.includes(
        "/etc/facil-digital-plus/production.env"
      ),
      "Deploy não usa arquivo de ambiente protegido"
    );


    assertCondition(
      /CURRENT_BRANCH[\s\S]{0,160}main/.test(
        source
      ),
      "Deploy não valida branch main"
    );


    assertCondition(
      /git\s+status\s+--porcelain/.test(
        source
      ),
      "Deploy não valida worktree limpa"
    );


    assertCondition(
      source.includes(
        "--env-file="
      ),
      "Deploy não carrega ambiente via Node --env-file"
    );


    const executableShell =
      source.replace(
        /^\s*#.*$/gm,
        ""
      );


    assertCondition(
      !/(?:^|\n)\s*(?:source|\.)\s+(?:"?\$ENV_FILE"?|\/etc\/facil-digital-plus\/production\.env)/m.test(
        executableShell
      ),
      "Deploy faz source do arquivo de secrets"
    );


    const backupIndex =
      source.indexOf(
        "scripts/backup-database.ts"
      );


    const migrationIndex =
      source.indexOf(
        "db/init.ts"
      );


    assertCondition(
      backupIndex >=
        0 &&
      migrationIndex >
        backupIndex,
      "Backup não ocorre antes da migration"
    );


    assertCondition(
      /pm2\s+save/.test(
        source
      ),
      "Deploy não persiste configuração PM2"
    );


    assertCondition(
      !/\bdb:seed\b|seed-orders|seed-simulations|db\/seed\.ts/.test(
        executableShell
      ),
      "Deploy executa seed automaticamente"
    );
  }
);


runCheck(
  "Nginx canonicaliza hosts e encaminha somente pelo bind interno",
  () => {
    const source =
      read(
        "scripts/nginx-config.conf"
      );


    assertCondition(
      source.includes(
        "facildigitalmais.com"
      ),
      "Domínio de produção não configurado"
    );


    /**
     * www nunca pode alcançar diretamente a
     * aplicação.
     *
     * APP_BASE_URL utiliza a origem apex como
     * autoridade de segurança em produção.
     */
    const httpsWwwRedirect =
      /server\s*\{[\s\S]*?listen\s+443\s+ssl\s+http2;[\s\S]*?server_name\s+www\.facildigitalmais\.com\s*;[\s\S]*?return\s+301\s+https:\/\/facildigitalmais\.com\$request_uri\s*;[\s\S]*?\}/;


    assertCondition(
      httpsWwwRedirect.test(
        source
      ),
      "HTTPS www deve redirecionar para a origem canônica"
    );


    const canonicalHttpsApplication =
      /server\s*\{[\s\S]*?listen\s+443\s+ssl\s+http2;[\s\S]*?server_name\s+facildigitalmais\.com\s*;/;


    assertCondition(
      canonicalHttpsApplication.test(
        source
      ),
      "Aplicação HTTPS deve possuir servidor canônico exclusivo"
    );


    /**
     * Um location regex como:
     *
     * location ~* \.(js|css|...)
     *
     * sem proxy_pass interceptaria /_next/static
     * antes do Next.js.
     */
    assertCondition(
      !/location\s+~\*[^\n]*(?:css|js|woff|png|jpg)/i.test(
        source
      ),
      "Nginx não pode interceptar assets do Next.js por extensão"
    );


    assertCondition(
      countMatches(
        source,
        /proxy_pass\s+http:\/\/127\.0\.0\.1:3000;/g
      ) >=
        2,
      "Proxy geral/webhook não usam 127.0.0.1:3000"
    );


    assertCondition(
      !/proxy_pass\s+http:\/\/localhost(?::3000)?/i.test(
        source
      ),
      "Nginx ainda utiliza localhost no proxy"
    );


    for (
      const header
      of [
        "Host",
        "X-Forwarded-Host",
        "X-Real-IP",
        "X-Forwarded-For",
        "X-Forwarded-Proto",
      ]
    ) {
      assertCondition(
        countMatches(
          source,
          new RegExp(
            `proxy_set_header\\s+${header.replace(
              /-/g,
              "\\-"
            )}\\b`,
            "g"
          )
        ) >=
          2,
        `Header ${header} não está preservado nos dois proxies`
      );
    }


    assertCondition(
      !/(?:root|alias)\s+\/(?:var\/lib\/facil-digital-plus|var\/backups\/facil-digital-plus)/.test(
        source
      ),
      "Nginx expõe diretório persistente"
    );
  }
);


runCheck(
  "suite final está integrada aos scripts oficiais",
  () => {
    const pkg =
      JSON.parse(
        read(
          "package.json"
        )
      );


    assertCondition(
      pkg.scripts[
        "security:audit"
      ] ===
        "node scripts/production-security-audit.mjs",
      "security:audit não está configurado"
    );


    assertCondition(
      pkg.scripts[
        "test:p0-production-security-audit"
      ] ===
        "NODE_NO_WARNINGS=1 tsx --test --test-isolation=none --no-warnings tests/p0-production-security-audit.test.mjs",
      "suite P0 de segurança não está configurada"
    );


    assertCondition(
      pkg.scripts[
        "test:all"
      ]?.includes(
        "test:p0-production-security-audit"
      ),
      "suite P0 de segurança não participa do test:all"
    );
  }
);


runCheck(
  "README possui runbook válido do security audit",
  () => {
    const source =
      read(
        "README.md"
      );


    assertCondition(
      source.includes(
        "npm run security:audit"
      ),
      "README não documenta security:audit"
    );


    assertCondition(
      source.includes(
        "/etc/facil-digital-plus/production.env"
      ),
      "README não documenta production.env protegido"
    );


    /**
     * O README é um documento Markdown real.
     *
     * Ele não pode ser acidentalmente envolvido em
     * uma cerca ```markdown ... ```, pois isso faria
     * o GitHub renderizar o documento inteiro como
     * um bloco de código.
     */
    const trimmed =
      source.trim();


    assertCondition(
      !trimmed.startsWith(
        "```markdown"
      ),
      "README está acidentalmente envolvido por uma cerca markdown"
    );


    assertCondition(
      !(
        trimmed.startsWith(
          "```"
        ) &&
        trimmed.endsWith(
          "```"
        )
      ),
      "README inteiro não pode estar dentro de um bloco de código"
    );


    assertCondition(
      trimmed.startsWith(
        "# Facil Digital+ - Plataforma de Apostilas para Concursos"
      ),
      "README deve iniciar pelo título principal do projeto"
    );
  }
);


const failures =
  checks.filter(
    (
      check
    ) =>
      !check.ok
  );


const report = {
  status:
    failures.length ===
    0
      ? "passed"
      : "failed",

  checks,

  totals: {
    checks:
      checks.length,

    passed:
      checks.length -
      failures.length,

    failed:
      failures.length,
  },
};


if (
  jsonMode
) {
  process.stdout.write(
    `${JSON.stringify(
      report,
      null,
      2
    )}\n`
  );
} else {
  console.log(
    "=== FACIL DIGITAL+ | AUDITORIA DE SEGURANCA PRE-PRODUCAO ==="
  );


  console.log();


  for (
    const check
    of checks
  ) {
    if (
      check.ok
    ) {
      console.log(
        `PASS  ${check.name}`
      );
    } else {
      console.log(
        `FAIL  ${check.name}`
      );

      console.log(
        `      ${check.error}`
      );
    }
  }


  console.log();


  console.log(
    `resultado: ${report.status}`
  );

  console.log(
    `checks: ${report.totals.checks}`
  );

  console.log(
    `passaram: ${report.totals.passed}`
  );

  console.log(
    `falharam: ${report.totals.failed}`
  );
}


if (
  failures.length >
  0
) {
  process.exitCode =
    1;
}