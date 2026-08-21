#!/usr/bin/env bash

# ==========================================
# DEPLOY - FACIL DIGITAL+
# HOSTINGER VPS / NODE.JS / NEXT.JS / SQLITE
# ==========================================

set -euo pipefail

APP_NAME="facil-digital-plus"
DEPLOY_DIR="/var/www/$APP_NAME"

echo "🚀 Iniciando preparação de deploy..."
echo ""

# ==========================================
# VALIDAR BRANCH
# ==========================================

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Branch atual: $CURRENT_BRANCH"
    echo "⚠️  Deploy de produção é recomendado apenas pela branch main."
    echo ""

    read -r -p "Deseja continuar mesmo assim? (y/n): " REPLY

    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
        echo "❌ Deploy cancelado."
        exit 1
    fi
fi

# ==========================================
# INSTALAR DEPENDÊNCIAS
# ==========================================

echo "📦 Instalando dependências..."
npm ci

echo ""

# ==========================================
# BUILD
# ==========================================

echo "🔨 Gerando build de produção..."
npm run build

echo ""

# ==========================================
# BANCO DE DADOS
# ==========================================

echo "🗄️  Aplicando migrations do banco..."
npm run db:migrate

echo ""

# IMPORTANTE:
# Seeds NÃO são executados automaticamente em produção.
#
# db:seed
# db:seed-orders
# db:seed-simulations
#
# são comandos administrativos/de desenvolvimento e devem
# ser executados somente de forma explícita quando necessário.

# ==========================================
# FINALIZAÇÃO
# ==========================================

echo "✅ Build e migrations concluídos."
echo ""
echo "📋 Ambiente esperado na Hostinger:"
echo "   Aplicação: $DEPLOY_DIR"
echo "   Runtime: Node.js"
echo "   Framework: Next.js"
echo "   Banco: SQLite"
echo "   Processo: PM2"
echo "   Proxy reverso: Nginx"
echo ""
echo "⚠️  Nenhum seed de teste foi executado."
echo ""
echo "🎉 Preparação de deploy concluída!"