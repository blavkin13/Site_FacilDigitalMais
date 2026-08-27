
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

### Autoridade sobre estados financeiros dos pedidos

Os estados financeiros de `orders.status` são controlados pelo fluxo
confirmado do provedor de pagamento.

O painel administrativo pode consultar e filtrar pedidos por `pending`,
`approved`, `rejected`, `refunded` e `charged_back`, mas não pode alterar
manualmente esses estados.

Em especial:

- `approved` somente pode liberar entitlement após confirmação financeira;
- `refunded` somente representa reembolso confirmado pelo fluxo financeiro;
- `charged_back` somente representa contestação confirmada pelo provedor.

Uma futura suspensão ou liberação administrativa de acesso deverá utilizar
um mecanismo próprio e não reutilizar estados financeiros do Mercado Pago.

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

A topologia de producao e:

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

### Configuracao protegida de producao

Segredos e configuracoes operacionais de producao nao devem ficar dentro
do repositorio.

O arquivo oficial de ambiente da VPS e:

    /etc/facil-digital-plus/production.env

O arquivo deve pertencer ao usuario utilizado para executar a aplicacao
e nao pode conceder leitura para grupo ou outros.

Configuracao recomendada:

    sudo mkdir -p /etc/facil-digital-plus
    sudo chmod 750 /etc/facil-digital-plus
    sudo touch /etc/facil-digital-plus/production.env
    sudo chmod 600 /etc/facil-digital-plus/production.env

O arquivo nao deve ser enviado para o GitHub.

Antes da ativacao financeira, ele pode conter somente as configuracoes
nao secretas e os caminhos persistentes necessarios ao site, por exemplo:

    NODE_ENV=production
    APP_BASE_URL=https://facildigitalmais.com
    NEXT_PUBLIC_BASE_URL=https://facildigitalmais.com
    DATABASE_PATH=/var/lib/facil-digital-plus/database/prod.db
    DATABASE_BACKUP_DIR=/var/backups/facil-digital-plus/sqlite
    DATABASE_BACKUP_RETENTION=14
    UPLOAD_ROOT_DIR=/var/lib/facil-digital-plus/uploads
    PROTECTED_PDF_DIR=/var/lib/facil-digital-plus/protected

As variaveis:

    MERCADO_PAGO_ACCESS_TOKEN
    MERCADO_PAGO_WEBHOOK_SECRET

somente devem ser acrescentadas no servidor protegido quando a integracao
real com o Mercado Pago for ativada.

Nunca registre os valores dessas variaveis em terminal compartilhado,
README, GitHub, issue, commit ou mensagem de suporte.

O PM2 recebe apenas:

    --env-file=/etc/facil-digital-plus/production.env

e o proprio Node.js carrega os valores protegidos durante a inicializacao.

### Ordem segura do deploy

O script:

    scripts/deploy-hostinger.sh

aceita deploy de producao somente a partir de `main` e exige worktree limpa.

A ordem operacional e:

    validar configuracao
      ->
    npm ci
      ->
    build
      ->
    backup PRE-MIGRATION
      ->
    migrations
      ->
    restart/start PM2
      ->
    pm2 save
      ->
    smoke test

O backup e obrigatoriamente criado antes de qualquer nova migration.

A rotina de backup nao executa `initDatabase()` nem migrations. Ela utiliza
a Online Backup API do SQLite e somente considera o backup valido depois de
`PRAGMA integrity_check`.

O deploy nao executa seeds automaticamente.

A origem pública canônica é:

    https://facildigitalmais.com

O Nginx deve convergir todos os acessos para essa origem:

- HTTP em `facildigitalmais.com` redireciona para HTTPS canônico;
- HTTP em `www.facildigitalmais.com` redireciona para HTTPS canônico;
- HTTPS em `www.facildigitalmais.com` redireciona para `https://facildigitalmais.com`;
- somente `https://facildigitalmais.com` é encaminhado para a aplicação Next.js.

O certificado TLS utilizado pelo servidor de redirecionamento HTTPS deve
cobrir também `www.facildigitalmais.com`.

Assets do Next.js, inclusive `/_next/static`, permanecem sob responsabilidade
da aplicação. Não utilize `location` regex de extensão sem `proxy_pass` ou
`root` explícito, pois isso pode interceptar JavaScript/CSS antes do Next.js.

O Nginx deve preservar corretamente:

- Host;
- X-Forwarded-Host;
- X-Forwarded-Proto;
- X-Real-IP;
- X-Forwarded-For.

Durante a configuracao atual do projeto, scripts operacionais utilizam `tsx`.

Por isso, o VPS deve instalar as dependencias completas enquanto essa
dependencia operacional permanecer em `devDependencies`.

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
    deploy pela main
      ->
    build de producao
      ->
    backup PRE-MIGRATION
      ->
    migrations
      ->
    restart PM2
      ->
    smoke test

Nao utilizar force push para contornar conflitos.

Nao editar diretamente migrations historicas.

### Rollback de producao

O rollback nao deve ser executado automaticamente pelo script de deploy.

Se uma migration, inicializacao ou smoke de producao falhar:

    1. interromper o processo PM2;
    2. preservar logs e o banco que apresentou a falha;
    3. restaurar o codigo para o commit anteriormente implantado;
    4. executar npm ci e gerar novamente o build desse commit;
    5. restaurar o backup PRE-MIGRATION correspondente;
    6. remover arquivos WAL/SHM residuais somente com a aplicacao parada;
    7. iniciar novamente o processo PM2;
    8. executar integrity_check e smoke test.

Nunca restaure o arquivo SQLite principal enquanto o processo Next.js
estiver utilizando o banco.

Exemplo conceitual, com a aplicacao ja parada:

    pm2 stop facil-digital-mais

    DATABASE_PATH="$(
      node \
        --env-file=/etc/facil-digital-plus/production.env \
        -p 'process.env.DATABASE_PATH'
    )"

    mv "$DATABASE_PATH" "${DATABASE_PATH}.failed"

    rm -f \
      "${DATABASE_PATH}-wal" \
      "${DATABASE_PATH}-shm"

    install \
      -m 640 \
      /CAMINHO/DO/BACKUP-PRE-MIGRATION.db \
      "$DATABASE_PATH"

Depois, restaure o commit anterior, gere novamente o build e inicie:

    pm2 start ecosystem.config.cjs --only facil-digital-mais
    pm2 save

O caminho real do backup deve ser obtido da saida produzida por
`npm run db:backup` ou pelo deploy. Nao substitua `/CAMINHO/DO/BACKUP-PRE-MIGRATION.db`
sem antes identificar o backup correto.

## Diagnostico financeiro e observabilidade

O processamento financeiro possui um ledger duravel em:

    payment_webhook_events

O ledger e a fonte operacional para investigar entrega e processamento
de webhooks do Mercado Pago.

Ele nao substitui `orders` como autoridade de entitlement.

A regra comercial continua sendo:

    orders.status === approved

O projeto possui uma ferramenta oficial de diagnostico financeiro:

    npm run payment:diagnostics

A ferramenta e estritamente somente leitura.

Ela:

- nao executa migrations;
- nao altera pedidos;
- nao altera o ledger;
- nao consulta a API do Mercado Pago;
- nao exige Access Token;
- nao exige Webhook Secret;
- nao imprime CPF;
- nao imprime e-mail;
- nao imprime secrets;
- abre o SQLite em modo readonly;
- ativa `PRAGMA query_only = ON`.

Por padrao, pedidos `pending` com mais de 24 horas sao destacados:

    npm run payment:diagnostics

Para alterar a janela:

    npm run payment:diagnostics -- --pending-hours=48

Para limitar a quantidade de registros exibidos em cada secao:

    npm run payment:diagnostics -- --limit=50

Para saida JSON estruturada:

    npm run payment:diagnostics -- --json

As opcoes podem ser combinadas:

    npm run payment:diagnostics -- --pending-hours=48 --limit=50 --json

No servidor de producao, o diagnostico deve carregar o mesmo arquivo
protegido utilizado pelo PM2:

    node \
      --env-file=/etc/facil-digital-plus/production.env \
      --import tsx \
      scripts/payment-diagnostics.ts

O comando acima nao imprime o conteudo de `production.env`.

O diagnostico destaca:

    processed / ignored / quarantined
    reentregas com occurrence_count > 1
    ultimo webhook persistido
    pedidos approved sem mp_payment_id
    pedidos pending antigos
    pedidos refunded
    pedidos charged_back
    external_reference do ledger sem pedido correspondente
    divergencia entre payment_id do ledger e payment_id canonico do pedido

Um resultado:

    health: attention

nao deve ser corrigido editando `orders.status` manualmente.

A investigacao deve usar:

    request_id
    payment_id
    outcome
    error_code
    occurrence_count
    timestamps

e confrontar o incidente com os logs e, quando a integracao real estiver
ativa, com o recurso canonico correspondente no Mercado Pago.

### Logs estruturados de webhook

Depois que um evento financeiro e persistido com sucesso no ledger,
a aplicacao produz um registro JSON com o evento:

    mercadopago.webhook.ledger

Os campos permitidos sao:

    timestamp
    event
    topic
    level
    request_id
    payment_id
    outcome
    error_code
    duplicate
    occurrence_count
    http_status

O log estruturado nao inclui:

    MERCADO_PAGO_ACCESS_TOKEN
    MERCADO_PAGO_WEBHOOK_SECRET
    x-signature
    payload bruto
    external_reference
    valores financeiros
    CPF
    e-mail
    nome do comprador

Falha do mecanismo de logging nao interfere no processamento financeiro.

A persistencia do ledger, por outro lado, continua fail-closed:
se o ledger nao puder ser persistido, o webhook deve responder com erro
para permitir nova entrega pelo provedor.

## Auditoria final de seguranca pre-producao

Antes de considerar um release apto a ser implantado na VPS, execute:

    npm run security:audit

A auditoria e somente leitura.

Ela nao:

- altera arquivos;
- altera o SQLite;
- executa migrations;
- executa seeds;
- consulta o Mercado Pago;
- le o conteudo de `/etc/facil-digital-plus/production.env`;
- imprime credenciais.

Para obter o resultado em JSON:

    npm run security:audit -- --json

O gate verifica, entre outros contratos:

    somente .env.example pode estar versionado
    credenciais Mercado Pago devem permanecer ausentes do repositorio
    APP_BASE_URL e a autoridade de origem de producao
    NEXT_PUBLIC_BASE_URL nao participa da autoridade CSRF
    webhook autentica antes de banco/provedor
    payment e topic_chargebacks_wh permanecem suportados
    checkout nao aceita preco do browser como autoridade
    retorno do checkout e autenticado e read-only
    query string nao confirma pagamento
    admin nao altera estado financeiro de pedidos
    writers de orders permanecem restritos
    paths persistentes ficam fora do release
    PM2 usa production.env protegido
    backup ocorre antes das migrations
    deploy nao executa seeds
    Nginx encaminha somente para 127.0.0.1:3000
    dados persistentes nao sao publicados pelo Nginx

O resultado esperado para um release candidate e:

    resultado: passed
    falharam: 0

Qualquer falha neste gate bloqueia o deploy ate investigacao.

O arquivo real de producao permanece fora do repositorio:

    /etc/facil-digital-plus/production.env

Ele deve continuar protegido por permissoes restritivas e carregado
atraves de `node --env-file`, nunca por `source` em shell interativo.

As credenciais reais do Mercado Pago somente devem ser adicionadas ao
arquivo protegido da VPS quando a aplicacao ja estiver implantada na
Hostinger e a ativacao controlada dos pagamentos for iniciada.

A auditoria de seguranca nao substitui:

    npm run test:all
    npm run build
    npm run payment:diagnostics

Os quatro gates possuem objetivos diferentes:

    security:audit
        configuracao e invariantes de seguranca

    test:all
        regressao funcional e estrutural

    build
        compilacao de producao

    payment:diagnostics
        estado operacional do ledger e pedidos

Nenhum incidente financeiro deve ser corrigido alterando manualmente
`orders.status`, `mp_payment_id` ou `external_reference`.

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