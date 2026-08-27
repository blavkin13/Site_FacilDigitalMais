#!/usr/bin/env bash

# ==========================================
# DEPLOY - FACIL DIGITAL+
# HOSTINGER VPS / NODE.JS / NEXT.JS / SQLITE
# ==========================================

set -euo pipefail


APP_NAME="facil-digital-plus"
PM2_APP_NAME="facil-digital-mais"

DEPLOY_DIR="/var/www/$APP_NAME"

ENV_FILE="/etc/facil-digital-plus/production.env"


fail() {
    echo "❌ $1" >&2
    exit 1
}


echo "🚀 Iniciando deploy seguro da Fácil Digital+..."
echo ""


# ==========================================
# VALIDAR DIRETÓRIO
# ==========================================

if [ ! -d "$DEPLOY_DIR/.git" ]; then
    fail "Repositório de produção não encontrado em $DEPLOY_DIR."
fi


cd "$DEPLOY_DIR"


# ==========================================
# VALIDAR FERRAMENTAS
# ==========================================

for REQUIRED_COMMAND in \
    node \
    npm \
    pm2 \
    stat \
    git
do
    if ! command -v "$REQUIRED_COMMAND" >/dev/null 2>&1; then
        fail "Comando obrigatório não encontrado: $REQUIRED_COMMAND"
    fi
done


# ==========================================
# VALIDAR NODE
# ==========================================

node - <<'NODE'
const [
  major,
  minor,
] =
  process.versions.node
    .split(".")
    .map(Number);


if (
  major !== 24 ||
  minor < 19
) {
  console.error(
    `❌ Node.js incompatível: ${process.version}. Esperado >=24.19.0 e <25.`
  );

  process.exit(1);
}


console.log(
  `✅ Node.js compatível: ${process.version}`
);
NODE


echo ""


# ==========================================
# VALIDAR BRANCH
# ==========================================

CURRENT_BRANCH="$(
    git branch --show-current
)"


if [ "$CURRENT_BRANCH" != "main" ]; then
    fail "Deploy de produção permitido somente pela branch main. Branch atual: $CURRENT_BRANCH"
fi


echo "✅ Branch de produção: main"


# ==========================================
# VALIDAR WORKTREE
# ==========================================

if [ -n "$(git status --porcelain)" ]; then
    echo "❌ A worktree de produção possui alterações não commitadas:" >&2
    git status --short >&2
    exit 1
fi


echo "✅ Worktree limpa"


DEPLOY_COMMIT="$(
    git rev-parse HEAD
)"


echo "✅ Commit candidato: $DEPLOY_COMMIT"
echo ""


# ==========================================
# VALIDAR ARQUIVO DE AMBIENTE
# ==========================================

if [ ! -f "$ENV_FILE" ]; then
    fail "Arquivo de configuração de produção não encontrado: $ENV_FILE"
fi


if [ ! -r "$ENV_FILE" ]; then
    fail "Arquivo de configuração de produção não pode ser lido pelo usuário atual."
fi


ENV_PERMISSIONS="$(
    stat -c "%a" "$ENV_FILE"
)"


ENV_PERMISSIONS_DECIMAL=$(
    (
      8#$ENV_PERMISSIONS
    )
)


if (
    (
      ENV_PERMISSIONS_DECIMAL &
      077
    ) != 0
); then
    fail "$ENV_FILE não pode possuir permissões para grupo ou outros. Use chmod 600."
fi


echo "✅ Arquivo de ambiente protegido"
echo ""


# ==========================================
# VALIDAR CONFIGURAÇÃO SEM EXIBIR VALORES
# ==========================================

node \
  --env-file="$ENV_FILE" \
  - <<'NODE'
const {
  isAbsolute,
} =
  require(
    "node:path"
  );


function fail(
  message
) {
  console.error(
    `❌ ${message}`
  );

  process.exit(
    1
  );
}


const requiredVariables = [
  "NODE_ENV",
  "APP_BASE_URL",
  "NEXT_PUBLIC_BASE_URL",
  "DATABASE_PATH",
  "DATABASE_BACKUP_DIR",
  "UPLOAD_ROOT_DIR",
  "PROTECTED_PDF_DIR",
];


const missing =
  requiredVariables.filter(
    (
      name
    ) =>
      !process.env[
        name
      ]?.trim()
  );


if (
  missing.length >
    0
) {
  fail(
    `Variáveis obrigatórias ausentes: ${missing.join(", ")}`
  );
}


if (
  process.env.NODE_ENV !==
    "production"
) {
  fail(
    "NODE_ENV deve ser production."
  );
}


function validatePublicHttpsUrl(
  name
) {
  const value =
    process.env[
      name
    ];


  let parsed;


  try {
    parsed =
      new URL(
        value
      );
  } catch {
    fail(
      `${name} deve ser uma URL válida.`
    );
  }


  if (
    parsed.protocol !==
      "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !==
      "/"
  ) {
    fail(
      `${name} deve utilizar HTTPS público e não pode conter credenciais, caminho, query ou fragmento.`
    );
  }


  const hostname =
    parsed.hostname
      .toLowerCase();


  if (
    hostname ===
      "localhost" ||
    hostname ===
      "127.0.0.1" ||
    hostname ===
      "::1"
  ) {
    fail(
      `${name} não pode apontar para localhost em produção.`
    );
  }
}


validatePublicHttpsUrl(
  "APP_BASE_URL"
);


validatePublicHttpsUrl(
  "NEXT_PUBLIC_BASE_URL"
);


for (
  const name
  of [
    "DATABASE_PATH",
    "DATABASE_BACKUP_DIR",
    "UPLOAD_ROOT_DIR",
    "PROTECTED_PDF_DIR",
  ]
) {
  if (
    !isAbsolute(
      process.env[
        name
      ]
    )
  ) {
    fail(
      `${name} deve utilizar caminho absoluto em produção.`
    );
  }
}


const retention =
  process.env
    .DATABASE_BACKUP_RETENTION;


if (
  retention
) {
  const parsed =
    Number(
      retention
    );


  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <
      1 ||
    parsed >
      365
  ) {
    fail(
      "DATABASE_BACKUP_RETENTION deve ser inteiro entre 1 e 365."
    );
  }
}


/**
 * As credenciais do Mercado Pago não são
 * obrigatórias para o primeiro provisionamento
 * da aplicação.
 *
 * Porém, se uma delas existir, as duas precisam
 * estar configuradas. Isso impede ambiente
 * financeiro parcialmente provisionado.
 */
const paymentVariables = [
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
];


const configuredPaymentVariables =
  paymentVariables.filter(
    (
      name
    ) =>
      Boolean(
        process.env[
          name
        ]?.trim()
      )
  );


if (
  configuredPaymentVariables.length !==
    0 &&
  configuredPaymentVariables.length !==
    paymentVariables.length
) {
  fail(
    "As credenciais do Mercado Pago devem ser configuradas em conjunto."
  );
}


console.log(
  "✅ Configuração de produção validada sem exibir valores."
);
NODE


echo ""


# ==========================================
# DEPENDÊNCIAS
# ==========================================

echo "📦 Instalando dependências..."
npm ci


echo ""


# ==========================================
# BUILD
# ==========================================

echo "🔨 Gerando build de produção..."


node \
  --env-file="$ENV_FILE" \
  ./node_modules/next/dist/bin/next \
  build


echo ""
echo "✅ Build concluído."
echo ""


# ==========================================
# BACKUP PRÉ-MIGRATION
# ==========================================

echo "💾 Criando backup PRÉ-MIGRATION do SQLite..."


node \
  --env-file="$ENV_FILE" \
  --import tsx \
  scripts/backup-database.ts


echo ""
echo "✅ Backup pré-migration concluído."
echo ""


# ==========================================
# MIGRATIONS
# ==========================================

echo "🗄️  Aplicando migrations do banco..."


node \
  --env-file="$ENV_FILE" \
  --import tsx \
  db/init.ts


echo ""
echo "✅ Migrations concluídas."
echo ""


# ==========================================
# PM2
# ==========================================

echo "♻️  Atualizando processo PM2..."


if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 restart \
        ecosystem.config.cjs \
        --only "$PM2_APP_NAME"
else
    pm2 start \
        ecosystem.config.cjs \
        --only "$PM2_APP_NAME"
fi


echo ""
echo "💾 Persistindo configuração PM2..."


pm2 save


echo ""
echo "✅ PM2 atualizado."
echo ""


# ==========================================
# STATUS DO PROCESSO
# ==========================================

if ! pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    fail "Processo PM2 não encontrado após o deploy."
fi


pm2 describe "$PM2_APP_NAME"


# ==========================================
# FINALIZAÇÃO
# ==========================================

echo ""
echo "✅ Deploy técnico concluído."
echo ""
echo "📋 Ambiente:"
echo "   Aplicação: $DEPLOY_DIR"
echo "   Configuração: $ENV_FILE"
echo "   Commit: $DEPLOY_COMMIT"
echo "   Runtime: Node.js"
echo "   Framework: Next.js"
echo "   Processo: PM2"
echo "   Proxy reverso: Nginx"
echo ""
echo "⚠️  Nenhum seed foi executado."
echo "⚠️  O smoke HTTP/financeiro ainda deve ser executado."
echo "⚠️  Pagamentos reais só devem ser liberados após credenciais e webhook serem configurados."
echo ""
echo "🎉 Deploy finalizado sem expor secrets."