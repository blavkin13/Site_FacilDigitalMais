# ✅ CHECKLIST DE PRÉ-PRODUÇÃO

## 🔐 Segurança
- [ ] Senhas do admin alteradas em produção
- [ ] `.env` criado com credenciais reais (não commitar!)
- [ ] HTTPS/SSL configurado
- [ ] Headers de segurança no Nginx
- [ ] Cookies HTTPOnly funcionando
- [ ] Webhooks do Mercado Pago com secret

## 💳 Pagamentos
- [ ] Access Token do Mercado Pago configurado
- [ ] Webhook URL configurada no painel MP
- [ ] Testes de compra realizados em produção
- [ ] Reembolsos testados
- [ ] URLs de redirect corretas (success/failure)

## 📄 PDFs
- [ ] PDFs originais uploadados no servidor
- [ ] Sistema de watermark testado
- [ ] Senha por CPF funcionando
- [ ] Downloads temporários com cleanup (12h)

## 🗄️ Banco de Dados
- [ ] Backup diário configurado
- [ ] Seeds executados (admin, produtos, simulados)
- [ ] Índices criados para queries frequentes

## 🌐 SEO
- [ ] Sitemap gerado e acessível
- [ ] Robots.txt configurado
- [ ] Meta tags Open Graph funcionando
- [ ] Google Analytics configurado (opcional)
- [ ] Google Search Console verificado

## 🚀 Performance
- [ ] Build otimizado (`npm run build`)
- [ ] Gzip ativado no Nginx
- [ ] Cache de assets configurado
- [ ] Imagens otimizadas

## 📧 Email (Futuro)
- [ ] SMTP configurado (para confirmações)
- [ ] Emails de boas-vindas
- [ ] Emails de confirmação de compra

## 🔄 Backup e Monitoramento
- [ ] Backup do banco agendado
- [ ] Logs configurados (PM2)
- [ ] Monitoramento de uptime (UptimeRobot)
- [ ] Alertas de erro configurados

## 📱 Compatibilidade
- [ ] Testado em desktop
- [ ] Testado em mobile
- [ ] Testado em tablet
- [ ] Cross-browser testado (Chrome, Firefox, Safari)

## 🎯 Funcionalidades Críticas
- [ ] Cadastro de usuário funciona
- [ ] Login funciona
- [ ] Carrinho funciona
- [ ] Checkout funciona
- [ ] Pagamento aprovado libera acesso
- [ ] Download de PDF funciona
- [ ] Simulado funciona
- [ ] Ranking funciona
- [ ] Admin acessa dashboard
- [ ] Admin gerencia pedidos
- [ ] Admin gerencia produtos

## 📞 Suporte
- [ ] Página de contato criada (opcional)
- [ ] Termos de uso publicados
- [ ] Política de privacidade publicada
- [ ] Política de reembolso publicada

---

**Data de verificação:** ___/___/______

**Responsável:** _______________________

**Status:** ☐ Pronto para produção ☐ Pendências