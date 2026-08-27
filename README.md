# Facil Digital+ - Plataforma de Apostilas para Concursos

> Status atual: hardening pre-producao em andamento.
>
> Pagamentos reais nao devem ser habilitados antes da conclusao e validacao integral da fase de hardening financeiro P0.

## Sobre o projeto

A Facil Digital+ e uma plataforma de venda e entrega de apostilas digitais para concursos publicos.

A aplicacao inclui:

- catalogo publico de apostilas;
- paginas por concurso;
- carrinho e checkout;
- autenticacao de usuarios;
- area do aluno;
- biblioteca de compras;
- downloads protegidos de PDFs;
- painel administrativo;
- banco de questoes;
- simulados cronometrados;
- resultados persistentes;
- ranking anonimizado;
- integracao com Mercado Pago;
- backup e rotinas de manutencao do SQLite.

## Arquitetura atual

A arquitetura oficial do projeto e:

    Internet
       |
       v
    Nginx
       |
       v
    Next.js / Node.js
    127.0.0.1:3000
       |
       v
    SQLite + Drizzle

Em producao, a aplicacao deve executar em uma unica instancia do Node.js enquanto utilizar SQLite como banco principal.

Nao fazem parte da arquitetura atual:

- Vite;
- Vinext;
- Cloudflare Workers;
- Cloudflare D1.

## Stack tecnica

- Node.js: >=24.19.0 e <25
- Next.js: 16.2.6
- React: 19.2.6
- TypeScript: 5.9.3
- SQLite: better-sqlite3
- ORM: Drizzle ORM
- Pagamentos: Mercado Pago
- PDFs: pdf-lib
- Graficos: Recharts
- Testes: Node.js Test Runner + tsx
- Processo de producao: PM2
- Reverse proxy: Nginx

## Estrutura principal

    app/
      api/
      admin/
      apostilas/
      checkout/
      concurso/
      minha-conta/
      simulados/

    components/
    db/
    lib/
    scripts/
    tests/
    data/

### Responsabilidades

`app/`
Rotas, paginas e APIs do Next.js.

`components/`
Componentes React da loja, area do aluno, admin e simulados.

`db/`
Schema Drizzle, inicializacao, migrations e seeds.

`lib/`
Autenticacao, seguranca HTTP, Mercado Pago, PDFs, simulados, backup e regras de dominio.

`scripts/`
Rotinas operacionais, manutencao e validacao.

`tests/`
Suites automatizadas e gates de regressao.

`data/`
Dados locais de desenvolvimento. Testes automatizados nao devem modificar o conteudo persistente desse diretorio.

## Instalacao para desenvolvimento

### Requisitos

- Node.js compativel com o campo `engines` do `package.json`;
- npm;
- Git.

Confirme a versao:

    node --version
    npm --version

Instale as dependencias:

    npm ci

Crie a configuracao local a partir de `.env.example`.

Nunca versione `.env`, `.env.local`, tokens, senhas ou secrets.

Aplique as migrations:

    npm run db:migrate

Inicie o ambiente de desenvolvimento:

    npm run dev

O servidor de desenvolvimento utiliza a porta 5173.

## Banco de dados

O projeto utiliza SQLite com better-sqlite3 e Drizzle ORM.

As migrations sao forward-only.

Migrations que ja tenham sido aplicadas nao devem ser editadas. Novas alteracoes de schema devem ser implementadas por uma nova migration.

Comandos principais:

    npm run db:migrate
    npm run db:backup
    npm run maintenance:runtime
    npm run maintenance:runtime:apply
    npm run storage:check
    npm run storage:cleanup

Seeds sao comandos administrativos ou de desenvolvimento e nao devem ser executados automaticamente durante deploy de producao.

## Autenticacao e sessoes

Novas senhas utilizam scrypt versionado.

Hashes legados podem ser reconhecidos somente para compatibilidade e migrados durante autenticacao valida.

As sessoes utilizam cookie `fd-session`.

O bearer de novas sessoes nao e armazenado diretamente no SQLite. O banco persiste um fingerprint SHA-256 do token.

Rotas administrativas devem validar autorizacao no servidor independentemente da interface.

O acesso administrativo deve funcionar em modo fail-closed.

## Seguranca HTTP

O projeto utiliza:

- validacao de origem para mutations;
- protecao CSRF;
- headers de seguranca;
- cookies HttpOnly;
- cookie Secure em producao;
- SameSite;
- CSP;
- HSTS em producao;
- protecao independente das APIs administrativas.

O webhook do Mercado Pago e isento da barreira CSRF generica porque possui mecanismo proprio de autenticacao.

A autenticacao do webhook deve seguir o protocolo oficial vigente do Mercado Pago.

## Simulados

O acesso a simulados depende de entitlement real.

A cadeia de autorizacao e:

    usuario autenticado
        ->
    pedido aprovado
        ->
    item comprado
        ->
    produto relacionado
        ->
    simulado

Administradores nao recebem entitlement automatico apenas por possuirem role administrativa.

Tentativas de simulados sao controladas no servidor.

O cliente nao e autoridade sobre:

- gabarito;
- score;
- tempo final;
- status da tentativa.

Resultados concluidos sao persistidos.

O ranking publico deve permanecer anonimizado.

## PDFs e armazenamento

PDFs originais nao devem ser expostos diretamente por uma URL publica.

Em producao, banco, uploads e PDFs protegidos devem ficar em diretorios persistentes fora da arvore descartavel do release.

Os caminhos sao configurados pelas variaveis:

    DATABASE_PATH
    DATABASE_BACKUP_DIR
    UPLOAD_ROOT_DIR
    PROTECTED_PDF_DIR

Backups do SQLite devem utilizar a Online Backup API.

Nao utilize copia bruta do arquivo principal do SQLite como estrategia de backup durante trafego com WAL ativo.

## Mercado Pago

A integracao com Mercado Pago deve operar em modo fail-closed em producao.

Antes de habilitar pagamentos reais, o fluxo precisa garantir:

- credenciais obrigatorias em producao;
- referencia externa unica por pedido;
- correlacao exata entre pagamento e pedido;
- validacao correta da assinatura do webhook;
- idempotencia;
- validacao de valor;
- tratamento seguro de eventos repetidos;
- tratamento seguro de refund e chargeback;
- ausencia de aprovacao automatica em falhas da API;
- ausencia de fallback de demonstracao em producao;
- URLs publicas canonicas para retorno do checkout.

Enquanto o hardening financeiro P0 nao estiver concluido e validado, pagamentos reais devem permanecer desabilitados.

Nenhuma credencial real do Mercado Pago deve ser registrada neste repositorio.

## Variaveis de ambiente

Use `.env.example` apenas como referencia.

Segredos reais devem existir somente no ambiente protegido de execucao.

Variaveis principais:

    NODE_ENV
    PORT
    APP_BASE_URL
    NEXT_PUBLIC_BASE_URL
    DATABASE_PATH
    DATABASE_BACKUP_DIR
    DATABASE_BACKUP_RETENTION
    UPLOAD_ROOT_DIR
    PROTECTED_PDF_DIR
    ADMIN_SEED_EMAIL
    ADMIN_SEED_NAME
    ADMIN_SEED_PASSWORD
    MERCADO_PAGO_ACCESS_TOKEN
    MERCADO_PAGO_WEBHOOK_SECRET

    MERCADO_PAGO_WEBHOOK_SECRET

`APP_BASE_URL` e a origem canonica da aplicacao e a unica origem
explicitamente configurada com autoridade para validacao same-origin/CSRF
em producao.

`NEXT_PUBLIC_BASE_URL` pode ser utilizada por recursos publicos de
apresentacao e SEO, como `robots.txt` e `sitemap.xml`, mas nao concede
autoridade de seguranca nem amplia origens permitidas para APIs autenticadas.

Nunca registre senhas administrativas no README.

Nunca versione access tokens ou webhook secrets.

## Testes

O gate completo do projeto e:

    npm run test:all

O projeto tambem possui:

    npm run validate
    npm run test:phase6
    npm run test:phase4n-production
    npm run build

O `test:all` deve permanecer verde antes de merge para a branch principal.

Os testes devem utilizar bancos isolados e preservar o diretorio `data/`.

Cada nova fase de implementacao deve adicionar ou atualizar cobertura automatizada correspondente.

## Deploy Hostinger VPS

A topologia prevista para producao e:

    HTTPS
      |
      v
    Nginx
      |
      v
    127.0.0.1:3000
      |
      v
    Next.js via PM2
      |
      v
    SQLite persistente

O arquivo PM2 oficial e:

    ecosystem.config.cjs

O processo deve utilizar:

- uma unica instancia;
- `fork` mode;
- bind interno em `127.0.0.1:3000`.

Nao utilize cluster PM2 com o SQLite atual.

O Nginx deve preservar corretamente:

- Host;
- X-Forwarded-Host;
- X-Forwarded-Proto;
- X-Real-IP;
- X-Forwarded-For.

Durante a configuracao atual do projeto, scripts operacionais utilizam `tsx`.

Por isso, o VPS deve instalar as dependencias completas enquanto essa dependencia operacional permanecer em `devDependencies`.

Nao utilizar `npm ci --omit=dev` sem antes refatorar o tooling operacional.

## Diretorios recomendados em producao

Aplicacao:

    /var/www/facil-digital-plus

Banco:

    /var/lib/facil-digital-plus/database/prod.db

Uploads:

    /var/lib/facil-digital-plus/uploads

PDFs protegidos:

    /var/lib/facil-digital-plus/protected

Backups:

    /var/backups/facil-digital-plus/sqlite

Os diretorios persistentes nao devem depender da pasta de um release descartavel.

## Fluxo de alteracoes

O fluxo recomendado e:

    branch
      ->
    implementacao incremental
      ->
    testes especificos
      ->
    npm run test:all
      ->
    build
      ->
    revisao
      ->
    merge na main
      ->
    backup
      ->
    deploy
      ->
    migrations
      ->
    restart
      ->
    smoke test

Nao utilizar force push para contornar conflitos.

Nao editar diretamente migrations historicas.

## Segredos e credenciais

Este repositorio nao deve conter:

- senhas administrativas;
- access tokens;
- webhook secrets;
- arquivos `.env` reais;
- credenciais de usuarios de teste reutilizaveis em producao.

Credenciais administrativas devem ser configuradas ou rotacionadas por mecanismo seguro no ambiente correspondente.

## Estado de producao

A base de autenticacao, sessoes, simulados, SQLite, backup e hardening HTTP ja possui cobertura automatizada.

A liberacao comercial com pagamentos reais depende da conclusao do hardening P0 do Mercado Pago e do gate completo de producao.

Somente depois desses gates o deploy definitivo deve ser considerado aprovado.