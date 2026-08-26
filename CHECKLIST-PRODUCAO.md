# CHECKLIST DE PRODUCAO - FACIL DIGITAL+

> Este checklist nao substitui os testes automatizados.
>
> O deploy comercial somente pode ser considerado aprovado depois da conclusao do hardening P0, do `npm run test:all`, do build de producao e do smoke final no VPS.
>
> Enquanto os itens financeiros criticos permanecerem pendentes, pagamentos reais devem continuar desabilitados.

---

## 1. Gate de codigo antes do deploy

- [ ] Branch de producao revisada e sem alteracoes locais inesperadas.
- [ ] `git diff --check` sem erros.
- [ ] `npm run validate` aprovado.
- [ ] `npm run test:all` aprovado.
- [ ] `npm run build` aprovado.
- [ ] Diretorio `data/` permaneceu inalterado pelos testes.
- [ ] Nenhum `.env`, token, senha ou secret foi commitado.
- [ ] Nenhuma migration historica foi editada.
- [ ] Migration nova, quando existente, foi testada em banco vazio e em upgrade.
- [ ] README e documentacao refletem a arquitetura atual.

---

## 2. Configuracao de producao

- [ ] `NODE_ENV=production`.
- [ ] Node.js compativel com o intervalo definido no `package.json`.
- [ ] `APP_BASE_URL` aponta para o dominio HTTPS canonico.
- [ ] `NEXT_PUBLIC_BASE_URL` usa a origem publica correta.
- [ ] `DATABASE_PATH` utiliza path absoluto persistente.
- [ ] `DATABASE_PATH` nao aponta para `data/dev.db`.
- [ ] `DATABASE_BACKUP_DIR` utiliza path absoluto fora da arvore de release.
- [ ] `UPLOAD_ROOT_DIR` utiliza path absoluto persistente.
- [ ] `PROTECTED_PDF_DIR` utiliza path absoluto persistente.
- [ ] Arquivo de ambiente possui owner correto e permissao restrita.
- [ ] Nenhum secret esta presente no `ecosystem.config.cjs`.
- [ ] Aplicacao falha de forma segura se configuracao obrigatoria estiver ausente.

---

## 3. Administracao e autenticacao

- [ ] Admin de producao possui senha forte e exclusiva.
- [ ] Credencial de desenvolvimento nao foi reutilizada.
- [ ] Login administrativo funciona.
- [ ] Logout revoga a sessao.
- [ ] Rotacao de senha revoga sessoes anteriores.
- [ ] Usuario comum nao consegue acessar `/admin`.
- [ ] APIs administrativas rejeitam usuarios sem role `admin`.
- [ ] Falhas de autorizacao permanecem fail-closed.
- [ ] Cookie `fd-session` possui `HttpOnly`.
- [ ] Cookie utiliza `Secure` em producao.
- [ ] Nenhum bearer de nova sessao e armazenado em texto claro no banco.

---

## 4. Mercado Pago - bloqueadores obrigatorios

Nenhuma venda real deve ser liberada enquanto algum item desta secao estiver pendente.

- [ ] `MERCADO_PAGO_ACCESS_TOKEN` real configurado.
- [ ] `MERCADO_PAGO_WEBHOOK_SECRET` real configurado.
- [ ] Ausencia de credenciais em producao causa falha controlada.
- [ ] Nao existe fallback para access token fake em producao.
- [ ] Falha na API Mercado Pago nao gera checkout demo.
- [ ] Falha na API Mercado Pago nunca aprova pedido automaticamente.
- [ ] Cada novo pedido possui `external_reference` persistida e unica.
- [ ] `external_reference` e criada antes da chamada ao Mercado Pago.
- [ ] `preference_id`, se utilizado pelo schema final, e persistido.
- [ ] Webhook utiliza assinatura conforme protocolo oficial vigente do Mercado Pago.
- [ ] Assinatura invalida nao altera nenhum pedido.
- [ ] Webhook consulta o pagamento real quando necessario.
- [ ] Pedido e localizado exclusivamente pela correlacao exata esperada.
- [ ] Nenhum codigo seleciona "ultimo pedido pending".
- [ ] Pagamento de um pedido nunca aprova outro pedido.
- [ ] `payment_id` repetido e tratado de forma idempotente.
- [ ] Evento repetido nao duplica efeitos.
- [ ] Falha temporaria de processamento nao e descartada com falso sucesso HTTP.
- [ ] Valor recebido e comparado com o valor esperado antes de liberar entitlement.
- [ ] Divergencia financeira nao libera automaticamente a compra.
- [ ] Status desconhecido nao e convertido em `approved`.
- [ ] `authorized` nao libera entitlement automaticamente.
- [ ] Eventos fora de ordem nao provocam regressao perigosa de status.
- [ ] Refund bloqueia novas tentativas de simulados relacionadas.
- [ ] Chargeback bloqueia novas tentativas de simulados relacionadas.
- [ ] Resultados historicos ja concluidos permanecem preservados apos refund/chargeback.
- [ ] Back URLs utilizam HTTPS e dominio canonico.
- [ ] Nenhuma back URL usa localhost ou `127.0.0.1` em producao.
- [ ] Politica de preco Pix foi validada contra o metodo efetivamente permitido no checkout.

---

## 5. Testes financeiros obrigatorios

- [ ] Migration de pagamentos testada em banco isolado.
- [ ] Upgrade do schema anterior para o schema novo testado.
- [ ] Unicidade de `external_reference` testada.
- [ ] Pedido A e Pedido B `pending`: webhook de A altera somente A.
- [ ] `external_reference` inexistente nao aprova nenhum pedido.
- [ ] Webhook com assinatura valida e aceito.
- [ ] Webhook com assinatura invalida e rejeitado.
- [ ] Webhook repetido e idempotente.
- [ ] Payment inexistente nao libera entitlement.
- [ ] Falha de consulta ao Mercado Pago nao aprova pedido.
- [ ] Valor divergente nao aprova pedido.
- [ ] Refund testado.
- [ ] Chargeback testado.
- [ ] Evento antigo apos refund nao reaprova indevidamente o pedido.
- [ ] Configuracao de producao sem secrets obrigatorios falha de forma segura.
- [ ] Fluxo Pix/preco promocional nao permite pagamento por metodo incompatível com o preco aplicado.

---

## 6. Banco de dados

- [ ] Backup valido criado antes de migration em banco existente.
- [ ] `DATABASE_PATH` confirmado antes de qualquer operacao administrativa.
- [ ] `npm run db:migrate` executado no banco correto.
- [ ] Todas as migrations esperadas foram aplicadas.
- [ ] Banco permanece em path persistente fora da arvore de release.
- [ ] Diretorio do SQLite possui permissao de escrita adequada.
- [ ] WAL funciona corretamente.
- [ ] `PRAGMA integrity_check` retorna `ok` no backup.
- [ ] Nenhum seed de desenvolvimento ou teste e executado automaticamente no deploy.
- [ ] Fixtures usadas em desenvolvimento nao foram copiadas para producao.

---

## 7. Backup e recuperacao

- [ ] `npm run db:backup` produz backup valido.
- [ ] Backup utiliza a Online Backup API do SQLite.
- [ ] Backup nao depende de copia bruta de `prod.db` durante trafego.
- [ ] Retencao local configurada.
- [ ] Backup diario agendado.
- [ ] Backup antes de migrations/deploys definido no procedimento operacional.
- [ ] Backup offsite configurado.
- [ ] Credenciais do backup offsite protegidas.
- [ ] Jobs nao se sobrepoem de forma perigosa.
- [ ] Restore drill executado pelo menos uma vez antes de considerar recuperacao validada.
- [ ] RPO/RTO observados foram documentados.

---

## 8. PDFs e armazenamento

- [ ] PDFs originais ficam fora de URLs publicas diretas.
- [ ] Uploads persistem apos restart da aplicacao.
- [ ] Uploads persistem apos novo deploy.
- [ ] Downloads protegidos exigem token valido.
- [ ] Tokens de download expiram conforme a regra atual.
- [ ] Rotina de limpeza de arquivos temporarios funciona.
- [ ] Geracao/protecao de PDF funciona em producao.
- [ ] Diretorios de upload e protected possuem owner/permissoes corretos.

---

## 9. Simulados e entitlement

- [ ] Usuario sem compra aprovada nao inicia nova tentativa protegida.
- [ ] Pedido `pending` nao libera simulado.
- [ ] Pedido `rejected` nao libera simulado.
- [ ] Pedido `refunded` nao libera novas tentativas.
- [ ] Pedido aprovado libera somente os simulados relacionados aos produtos adquiridos.
- [ ] Admin nao recebe bypass automatico de entitlement.
- [ ] Gabarito nao e exposto antes do submit.
- [ ] Score enviado pelo cliente nao e autoridade.
- [ ] Tempo enviado pelo cliente nao e autoridade.
- [ ] Refresh retoma corretamente tentativa em andamento.
- [ ] Submit persiste resultado.
- [ ] Historico do usuario funciona.
- [ ] Ranking permanece anonimizado para terceiros.

---

## 10. PM2

- [ ] Arquivo oficial utilizado: `ecosystem.config.cjs`.
- [ ] `ecosystem.config.js` legado nao existe.
- [ ] Aplicacao executa em apenas uma instancia.
- [ ] `exec_mode` e `fork`.
- [ ] Next.js faz bind em `127.0.0.1:3000`.
- [ ] Processo nao fica exposto diretamente na interface publica.
- [ ] `pm2 save` executado.
- [ ] Startup apos reboot configurado.
- [ ] Rotacao de logs configurada.
- [ ] Logs possuem limites razoaveis.

---

## 11. Nginx

- [ ] `proxy_pass` aponta para `http://127.0.0.1:3000`.
- [ ] `Host` preservado.
- [ ] `X-Forwarded-Host` preservado.
- [ ] `X-Forwarded-Proto` preservado.
- [ ] `X-Real-IP` configurado.
- [ ] `X-Forwarded-For` configurado.
- [ ] `client_max_body_size` suporta os uploads administrativos esperados.
- [ ] Timeouts de upload e PDF foram testados.
- [ ] Rotas de auth/admin/orders/simulations/downloads nao recebem cache indevido.
- [ ] Headers definidos no Nginx nao conflitam com os headers da aplicacao.

---

## 12. HTTPS e DNS

- [ ] DNS do dominio aponta para o VPS correto.
- [ ] HTTPS valido configurado.
- [ ] HTTP redireciona para HTTPS.
- [ ] Certificado possui renovacao automatica.
- [ ] Dominio canonico corresponde a `APP_BASE_URL`.
- [ ] URL definitiva do webhook foi registrada no Mercado Pago somente depois do HTTPS estar funcional.

---

## 13. Smoke de producao

### Publico

- [ ] Homepage abre em HTTPS.
- [ ] Catalogo funciona.
- [ ] Paginas de concurso funcionam.
- [ ] Sitemap responde.
- [ ] Robots responde.
- [ ] Canonical/meta tags basicas foram verificadas.

### Usuario

- [ ] Cadastro funciona.
- [ ] Login funciona.
- [ ] Logout funciona.
- [ ] Minha conta funciona.
- [ ] Carrinho funciona.

### Admin

- [ ] Admin autentica.
- [ ] Usuario comum e bloqueado no admin.
- [ ] CRUD de produtos funciona.
- [ ] Upload administrativo funciona.
- [ ] Gestao de simulados funciona.

### Compra controlada

- [ ] Usuario de teste de producao separado do admin foi criado.
- [ ] Compra controlada foi realizada.
- [ ] Pedido correto mudou de `pending` para `approved`.
- [ ] Outro pedido `pending` permaneceu inalterado.
- [ ] Biblioteca foi liberada somente depois da aprovacao.
- [ ] PDF protegido foi baixado.
- [ ] PDF original nao ficou publicamente acessivel.
- [ ] Simulado relacionado apareceu somente apos entitlement aprovado.
- [ ] Resultado do simulado persistiu.
- [ ] Ranking permaneceu anonimizado.

---

## 14. Reinicio e persistencia

- [ ] `pm2 restart` nao perde banco.
- [ ] `pm2 restart` nao perde uploads.
- [ ] Reboot do VPS nao perde banco.
- [ ] Reboot do VPS nao perde uploads.
- [ ] Reboot restabelece a aplicacao automaticamente.
- [ ] Configuracao de ambiente permanece disponivel e protegida.

---

## 15. Observabilidade

- [ ] Logs PM2 disponiveis.
- [ ] Rotacao de logs configurada.
- [ ] Logs nao contem senhas.
- [ ] Logs nao contem access token do Mercado Pago.
- [ ] Logs nao contem webhook secret.
- [ ] Logs nao contem bearer de sessao.
- [ ] Logs evitam CPF integral e dados financeiros desnecessarios.
- [ ] Monitoramento externo de uptime configurado.
- [ ] Falha de backup possui mecanismo de deteccao.
- [ ] Falhas recorrentes de webhook/pagamento podem ser identificadas operacionalmente.

---

## 16. Legal e suporte

- [ ] Termos de Uso publicados.
- [ ] Politica de Privacidade publicada.
- [ ] Politica de Reembolso publicada.
- [ ] Tratamento de dados pessoais revisado conforme necessidade operacional.
- [ ] Canal de suporte definido.
- [ ] Processo interno para disputa/reembolso definido.

---

## 17. Aprovacao final

Somente marcar "Pronto para producao" quando todos os bloqueadores obrigatorios estiverem concluídos.

**Data de verificacao:** ___/___/______

**Responsavel:** _______________________

**Commit/release:** ____________________

**Backup pre-deploy:** __________________

**Status:**

- [ ] PENDENCIAS - pagamentos reais bloqueados
- [ ] APROVADO PARA PRODUCAO