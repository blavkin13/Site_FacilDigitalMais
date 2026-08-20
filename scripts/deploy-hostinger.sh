#!/bin/bash

# ==========================================
# SCRIPT DE DEPLOY - HOSTINGER VPS
# ==========================================

set -e

echo "🚀 Iniciando deploy na Hostinger..."

# Configurações
APP_NAME="facil-digital-plus"
DEPLOY_DIR="/var/www/$APP_NAME"
NODE_ENV="production"

# Verificar se estamos na branch main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Você está na branch $CURRENT_BRANCH. Deploy recomendado apenas na main."
    read -p "Deseja continuar? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Instalando dependências..."
npm ci

echo "🔨 Fazendo build..."
npm run build

echo "🗄️  Executando migrações do banco..."
npm run db:init
npm run db:seed 2>/dev/null || true  # Não falhar se já existir
npm run db:seed-orders 2>/dev/null || true
npm run db:seed-simulations 2>/dev/null || true

echo "📁 Preparando arquivos para produção..."
# Remover arquivos de desenvolvimento
rm -rf tests/*.ts
rm -rf tests/_tmp_*.ts

echo "✅ Build concluído!"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Faça upload dos arquivos para $DEPLOY_DIR na Hostinger"
echo "2. Configure o arquivo .env com suas credenciais"
echo "3. Inicie o servidor com: npm run start"
echo "4. Configure o Nginx como reverse proxy"
echo ""
echo "🎉 Deploy preparado com sucesso!"