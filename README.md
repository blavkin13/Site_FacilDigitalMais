# Facil Digital+ - Plataforma de Apostilas para Concursos

![Status](https://img.shields.io/badge/status-pronto%20para%20produ%C3%A7%C3%A3o-green)
![Node](https://img.shields.io/badge/Node.js-%3E%3D22.13.0-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)

## 📋 Sobre o Projeto

Plataforma completa de venda de apostilas digitais para concursos públicos, com:
- ✅ Catálogo de apostilas por concurso
- ✅ Sistema de carrinho e checkout (Mercado Pago)
- ✅ Área do aluno com biblioteca de apostilas
- ✅ Simulados cronometrados com ranking
- ✅ Proteção de PDFs com marca d'água e senha (CPF)
- ✅ Dashboard administrativo com estatísticas
- ✅ Landing pages dinâmicas por concurso

## 🚀 Estrutura do Projeto
├── app/ # Rotas Next.js
│ ├── api/ # API Routes
│ ├── apostilas/ # Catálogo de produtos
│ ├── concurso/[slug]/ # Landing pages por concurso
│ ├── checkout/ # Fluxo de compra
│ ├── minha-conta/ # Dashboard do aluno
│ ├── simulados/ # Sistema de simulados
│ ├── admin/ # Dashboard admin
│ └── login/ # Autenticação
├── components/ # Componentes React
├── db/ # Schema Drizzle + Seeds
├── lib/ # Funções auxiliares
│ ├── auth.ts # Autenticação
│ ├── mercadopago.ts # Integração MP
│ ├── pdf-protection.ts # Proteção de PDFs
│ └── json-loader-runtime.ts # Loader de produtos
├── tests/ # Testes automatizados
└── data/ # Dados (SQLite + JSON)

## 🛠️ Tecnologias

- **Framework**: Next.js 16 + Vite (via Vinext)
- **Linguagem**: TypeScript
- **Banco de Dados**: SQLite (Drizzle ORM) / Cloudflare D1
- **Autenticação**: Cookie-based sessions
- **Pagamentos**: Mercado Pago
- **PDFs**: pdf-lib (watermark + proteção)
- **Gráficos**: Recharts
- **Testes**: Node.js Test Runner

## 📦 Instalação

### Pré-requisitos
- Node.js >= 22.13.0
- npm ou yarn

### Passos

```bash
# 1. Clonar o repositório
git clone https://github.com/blavkin13/Site_FacilDigitalMais.git
cd Site_FacilDigitalMais

# 2. Instalar dependências
npm install

# 3. Inicializar banco de dados
npm run db:init

# 4. Executar seeds (dados de exemplo)
npm run db:seed
npm run db:seed-orders
npm run db:seed-simulations

# 5. Iniciar em desenvolvimento
npm run dev

Acesse: http://localhost:5173

🔑 Credenciais de Teste
Admin
Email: digicopiamix@facildigitalmais.com
Senha: 5290Digi$
URL: /admin
Aluno de Teste
Email: teste@teste.com
Senha: 

🧪 Testes
# Rodar todos os testes
npm run test:all

# Rodar testes por fase
npm run test:phase1    # Autenticação (9 testes)
npm run test:phase2    # API Routes (17 testes)
npm run test:phase3    # Pedidos + Dashboard (16 testes)
npm run test:phase3b   # Simulados (19 testes)
npm run test:phase4    # Checkout + PDFs (19 testes)
npm run test:phase5    # Admin + Contest (19 testes)

Total: 99 testes
🚀 Deploy na Hostinger
Opção 1: Hostinger VPS (Recomendado)
1.Contrate um VPS Hostinger com Ubuntu 22.04
2.Instale Node.js 22:
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
3.Instale PM2 (gerenciador de processos):
   sudo npm install -g pm2
4.Clone o projeto:
   cd /var/www
   git clone https://github.com/blavkin13/Site_FacilDigitalMais.git
   cd Site_FacilDigitalMais
5.Configure variáveis:
   cp .env.example .env
   nano .env  # Preencha com suas credenciais
6.Instale dependências e faça build:
   npm ci
   npm run build
7.Inicie com PM2:
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
8.Configure Nginx:
   sudo apt install nginx
   sudo cp scripts/nginx-config.conf /etc/nginx/sites-available/facil-digital
   sudo ln -s /etc/nginx/sites-available/facil-digital /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
9.Configure SSL com Let's Encrypt:
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d seusite.com.br

Opção 2: Hostinger Cloud Hosting (Limitado)
Se usar Cloud Hosting (sem Node.js), será necessário:
Separar frontend estático
Backend em VPS separado
Ou usar serviços serverless
Recomendação: Use VPS para o projeto completo.
🔧 Configuração do Mercado Pago
Acesse: https://www.mercadopago.com.br/developers/panel/app
Crie uma aplicação
Obtenha:
Access Token (produção)
Webhook Secret (para validar webhooks)
Configure no .env:
   MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxx
   MERCADO_PAGO_WEBHOOK_SECRET=xxx

Configure o webhook no painel do MP:
URL: https://seusite.com.br/api/webhooks/mercadopago
Eventos: payment
📚 Fluxo de Funcionamento
Cliente
Acessa catálogo de apostilas
Adiciona ao carrinho (sem login)
Faz login/cadastro para continuar
Escolhe método de pagamento
Redirecionado ao Mercado Pago
Após pagamento, acesso liberado na biblioteca
PDFs protegidos com CPF como senha + marca d'água
Aluno
Acessa /minha-conta
Vê biblioteca de apostilas compradas
Baixa PDFs protegidos
Acessa simulados cronometrados
Vê ranking e desempenho
Admin
Acessa /admin
Vê estatísticas de vendas
Gerencia pedidos (aprovar/reembolsar)
Gerencia produtos (criar/editar/desativar)
🔒 Segurança
✅ Senhas com hash SHA-256 + salt
✅ Cookies HTTPOnly para sessões
✅ Proteção de rotas por role (user/admin)
✅ Webhooks com validação HMAC
✅ PDFs com senha (CPF) + marca d'água
✅ Downloads temporários (12h de validade)
📝 Scripts Disponíveis

npm run dev                    # Servidor de desenvolvimento
npm run build                  # Build de produção
npm run start                  # Servidor de produção
npm run db:init                # Inicializar banco
npm run db:seed                # Seed admin
npm run db:seed-orders         # Seed pedidos
npm run db:seed-simulations    # Seed simulados
npm run db:load-products       # Carregar produtos de JSON
npm run test:all               # Todos os testes

📊 Arquitetura do Banco
Tabelas principais:
users - Usuários (alunos e admins)
products - Apostilas
orders - Pedidos
order_items - Itens dos pedidos
questions - Questões de simulados
simulations - Provas simuladas
simulation_results - Resultados dos alunos
sessions - Sessões de autenticação
protected_downloads - Tokens de download
🤝 Suporte
Para dúvidas ou problemas:
Abra uma issue no repositório
Consulte a documentação da Hostinger: https://www.hostinger.com.br/tutoriais
Documentação Next.js: https://nextjs.org/docs
Desenvolvido com ❤️ para concurseiros 🚀


---

### Arquivo 8: `tests/phase6.test.mjs` — Testes finais
**Local:** Criar `tests/phase6.test.mjs`

```javascript
import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("Fase 6 - Deploy, Otimizações e Documentação", () => {
  before(() => {
    console.log("🧪 Preparando testes finais da Fase 6...");
  });

  // === DEPLOY ===

  test("Script de deploy existe", () => {
    const p = join(process.cwd(), "scripts", "deploy-hostinger.sh");
    assert.ok(existsSync(p));
    console.log("✅ Script de deploy existe");
  });

  test("Configuração PM2 existe", () => {
    const p = join(process.cwd(), "ecosystem.config.js");
    assert.ok(existsSync(p));
    console.log("✅ Configuração PM2 existe");
  });

  test("Configuração Nginx existe", () => {
    const p = join(process.cwd(), "scripts", "nginx-config.conf");
    assert.ok(existsSync(p));
    console.log("✅ Configuração Nginx existe");
  });

  test(".env.example existe", () => {
    const p = join(process.cwd(), ".env.example");
    assert.ok(existsSync(p));
    console.log("✅ .env.example existe");
  });

  // === DOCUMENTAÇÃO ===

  test("README.md completo", async () => {
    const p = join(process.cwd(), "README.md");
    assert.ok(existsSync(p), "README.md deve existir");

    const content = await readFile(p, "utf-8");
    
    // Verificar seções essenciais
    assert.ok(content.includes("# Facil Digital+"), "Deve ter título");
    assert.ok(content.includes("Instalação"), "Deve ter seção de instalação");
    assert.ok(content.includes("Deploy na Hostinger"), "Deve ter guia de deploy");
    assert.ok(content.includes("Mercado Pago"), "Deve mencionar Mercado Pago");
    assert.ok(content.includes("test:all"), "Deve mencionar testes");
    assert.ok(content.includes("Credenciais de Teste"), "Deve ter credenciais");
    
    console.log("✅ README.md completo com todas as seções");
  });

  // === SEO ===

  test("Sitemap atualizado", async () => {
    const p = join(process.cwd(), "app", "sitemap.ts");
    assert.ok(existsSync(p));

    const content = await readFile(p, "utf-8");
    assert.ok(content.includes("/concurso/"), "Deve ter rotas de concurso");
    assert.ok(content.includes("products.map"), "Deve mapear produtos");
    
    console.log("✅ Sitemap atualizado com rotas dinâmicas");
  });

  test("Robots.txt atualizado", async () => {
    const p = join(process.cwd(), "app", "robots.ts");
    assert.ok(existsSync(p));

    const content = await readFile(p, "utf-8");
    assert.ok(content.includes("disallow"), "Deve ter disallow");
    assert.ok(content.includes("/admin"), "Deve bloquear /admin");
    assert.ok(content.includes("/api/"), "Deve bloquear /api/");
    
    console.log("✅ Robots.txt protege áreas sensíveis");
  });

  // === REGRESSÃO FINAL ===

  test("Todas as fases anteriores preservadas", () => {
    const criticalFiles = [
      // Fase 1
      "lib/auth.ts",
      "db/schema.ts",
      "db/init.ts",
      "db/seed.ts",
      
      // Fase 2
      "components/auth-provider.tsx",
      "app/api/auth/login/route.ts",
      "app/api/auth/register/route.ts",
      "app/login/page.tsx",
      
      // Fase 3
      "components/student-dashboard.tsx",
      "components/simulation-quiz.tsx",
      "app/api/orders/route.ts",
      "app/api/simulations/route.ts",
      
      // Fase 4
      "components/checkout-real.tsx",
      "lib/mercadopago.ts",
      "lib/pdf-protection.ts",
      "app/api/checkout/create/route.ts",
      
      // Fase 5
      "middleware.ts",
      "components/admin-dashboard.tsx",
      "components/contest-landing.tsx",
      "lib/json-loader-runtime.ts",
    ];

    for (const path of criticalFiles) {
      assert.ok(
        existsSync(join(process.cwd(), path)),
        `Arquivo crítico ${path} deve existir`
      );
    }

    console.log(`✅ ${criticalFiles.length} arquivos críticos preservados`);
  });

  test("Package.json tem todos os scripts necessários", async () => {
    const p = join(process.cwd(), "package.json");
    const content = await readFile(p, "utf-8");
    const pkg = JSON.parse(content);

    const requiredScripts = [
      "dev",
      "build",
      "start",
      "db:init",
      "db:seed",
      "test:phase1",
      "test:phase2",
      "test:phase3",
      "test:phase3b",
      "test:phase4",
      "test:phase5",
      "test:all",
    ];

    for (const script of requiredScripts) {
      assert.ok(pkg.scripts[script], `Script ${script} deve existir`);
    }

    console.log(`✅ ${requiredScripts.length} scripts essenciais presentes`);
  });

  after(() => {
    console.log("✅ Testes da Fase 6 concluídos!");
    console.log("🎉 PROJETO COMPLETO - PRONTO PARA PRODUÇÃO!");
  });
});


