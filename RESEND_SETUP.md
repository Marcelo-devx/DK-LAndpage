# Configuração do Resend para Envio de Emails

Este guia explica como configurar o serviço Resend para enviar emails de autenticação (OTP e recuperação de senha) usando seu próprio domínio.

## Índice

1. [Visão Geral](#visão-geral)
2. [Criar Conta no Resend](#criar-conta-no-resend)
3. [Obter API Key](#obter-api-key)
4. [Configurar Domínio](#configurar-domínio)
5. [Configurar Variáveis de Ambiente](#configurar-variáveis-de-ambiente)
6. [Verificar DNS](#verificar-dns)
7. [Testar o Envio](#testar-o-envio)
8. [Checklist para Produção](#checklist-para-produção)
9. [Solução de Problemas](#solução-de-problemas)

## Visão Geral

O Resend é um serviço de envio de emails transacionais que permite:
- Enviar emails usando seu próprio domínio
- Melhor entregabilidade e reputação
- Templates customizados e profissionais
- Funcionamento em localhost e produção

## Criar Conta no Resend

1. Acesse https://resend.com/
2. Clique em "Sign Up" ou "Get Started"
3. Faça cadastro com seu email ou Google/GitHub
4. Verifique seu email de confirmação
5. Faça login no dashboard do Resend

## Obter API Key

1. No dashboard do Resend, clique em **API Keys** no menu lateral
2. Clique em **+ Create API Key**
3. Dê um nome para a chave (ex: "Production" ou "Development")
4. Selecione as permissões (geralmente "Full Access")
5. Copie a API Key gerada (começa com `re_`)

**Importante**: Guarde esta chave em um local seguro. Ela só será mostrada uma vez!

## Configurar Domínio

### Para Localhost (Desenvolvimento)

Você pode usar qualquer domínio para testes em localhost, mas o ideal é já preparar o domínio de produção.

1. No dashboard do Resend, clique em **Domains** no menu lateral
2. Clique em **+ Add Domain**
3. Digite seu domínio (ex: `clubdk.com.br` ou `noreply.clubdk.com.br`)
4. Clique em **Add Domain**

### Para Produção

1. Adicione seu domínio real no Resend
2. O Resend vai fornecer registros DNS que você precisa configurar

## Configurar Variáveis de Ambiente

### No Supabase Dashboard (Produção)

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **Edge Functions**
4. Adicione as seguintes variáveis de ambiente:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@seudominio.com
```

### No .env.local (Desenvolvimento)

Crie ou edite o arquivo `.env.local` na raiz do projeto:

```bash
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@clubdk.com.br
```

## Verificar DNS

Após adicionar o domínio no Resend, você precisa configurar os registros DNS no seu provedor de domínio (ex: GoDaddy, Namecheap, Registro.br, Cloudflare).

### Registros Necessários

O Resend vai fornecer 3 tipos de registros:

1. **SPF (Sender Policy Framework)**: Protege contra spoofing
2. **DKIM (DomainKeys Identified Mail)**: Assina digitalmente seus emails
3. **DMARC**: Política de autenticação de email

### Como Configurar

1. No painel do Resend, em **Domains**, clique no domínio configurado
2. Copie os registros DNS fornecidos
3. Vá ao painel do seu provedor de domínio
4. Adicione os registros conforme as instruções
5. Aguarde a propagação DNS (pode levar de minutos a 48 horas)

### Verificar Status

No painel do Resend, o status do domínio mudará para:
- 🟢 **Verified**: Tudo está configurado corretamente
- 🟡 **Pending**: Aguardando propagação DNS
- 🔴 **Invalid**: Registros DNS incorretos

## Testar o Envio

### Teste Via Supabase SQL Editor

No Supabase Dashboard, abra o SQL Editor e execute:

```sql
-- Teste de envio de OTP
SELECT send_otp_email('seu-email@teste.com', '123456');
```

### Teste Via Edge Function Direta

Você pode testar a edge function diretamente:

```bash
curl -X POST https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/send-email-via-resend \
  -H "Authorization: Bearer SUA_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "seu-email@teste.com",
    "subject": "Teste de Email",
    "type": "otp",
    "code": "123456"
  }'
```

### Teste na Aplicação

1. Acesse a página de login/cadastro
2. Tente criar uma nova conta
3. Verifique se o email de OTP chega na caixa de entrada
4. Teste também a recuperação de senha

## Checklist para Produção

Antes de colocar em produção, verifique:

### Configuração Resend
- [ ] Domínio configurado no Resend
- [ ] API Key criada e salva
- [ ] Registros DNS (SPF, DKIM) configurados no provedor de domínio
- [ ] Status do domínio está "Verified" no Resend

### Configuração Supabase
- [ ] Variáveis de ambiente configuradas no Supabase Dashboard
- [ ] Edge Function `send-email-via-resend` implantada
- [ ] Migration SQL aplicada
- [ ] pg_net extension instalada (para chamadas SQL)

### Testes
- [ ] Teste de OTP em desenvolvimento funcionou
- [ ] Teste de recuperação de senha funcionou
- [ ] Emails chegam na caixa de entrada (não vão para spam)
- [ ] Templates visualmente corretos em diferentes clientes (Gmail, Outlook)

### Performance e Monitoramento
- [ ] Configurar alertas no Resend Dashboard para falhas no envio
- [ ] Monitorar logs da Edge Function
- [ ] Configurar webhook de notificação para erros de envio

## Solução de Problemas

### Email não chega

**Possíveis causas:**
- API Key incorreta ou expirada
- Domínio não verificado no Resend
- Registros DNS não configurados
- Firewall bloqueando requisições

**Soluções:**
1. Verifique os logs da Edge Function no Supabase Dashboard
2. Confirme que a API Key está correta
3. Verifique o status do domínio no Resend
4. Teste com diferentes provedores de email

### Email vai para spam

**Possíveis causas:**
- Domínio novo sem reputação
- Configuração DKIM/DMARC incorreta
- Conteúdo do email marcado como spam

**Soluções:**
1. Verifique registros SPF, DKIM e DMARC
2. Use ferramentas como https://mail-tester.com/ para avaliar pontuação
3. Ajuste o conteúdo do email para evitar palavras de spam
4. Peça para os usuários marcarem como "Não é spam"

### Erro na Edge Function

**Possíveis causas:**
- Variáveis de ambiente não configuradas
- API inválida na requisição
- Timeout da requisição

**Soluções:**
1. Verifique os logs no Supabase Dashboard → Edge Functions
2. Confirme que as variáveis de ambiente estão configuradas
3. Verifique o formato do JSON enviado
4. Aumente timeout se necessário

### pg_net não funciona

**Problema:**
A função SQL retorna erro sobre pg_net extension.

**Solução:**
```sql
-- Instalar extensão pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Custos e Limites

### Plano Gratuito do Resend
- **3,000 emails/mês**
- 1 domínio
- API completa
- Logs por 30 dias

### Plano Pago
- Começa em $20/mês
- 50,000 emails/mês
- Domínios ilimitados
- Suporte prioritário

## Recursos Adicionais

- [Documentação Oficial do Resend](https://resend.com/docs)
- [API Reference do Resend](https://resend.com/docs/api-reference/introduction)
- [Best Practices para Email Deliverability](https://resend.com/docs/guides/email-deliverability)
- [Edge Functions do Supabase](https://supabase.com/docs/guides/functions)

## Suporte

Se encontrar problemas:
1. Verifique os logs da Edge Function no Supabase
2. Consulte o dashboard do Resend para status dos emails
3. Abra uma issue no repositório do projeto

---

**Nota**: Esta integração usa Edge Functions do Supabase, que são automaticamente implantadas quando o código é atualizado. Não é necessário fazer deploy manual.
