# Guia de Teste - Envio de Emails via Resend

Este guia explica como testar o sistema de envio de emails via Resend.

## Pré-requisitos

Antes de começar, certifique-se de:
- [ ] Ter uma conta no Resend
- [ ] Ter obtido uma API Key
- [ ] Ter configurado as variáveis de ambiente no Supabase Dashboard:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`

## Teste 1: Via Supabase SQL Editor

### Acessar SQL Editor

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Clique em **SQL Editor** no menu lateral
4. Crie uma nova query

### Teste de OTP

Execute o seguinte SQL:

```sql
-- Teste de envio de OTP
SELECT send_otp_email('seu-email-pessoal@gmail.com', '123456');
```

**Esperado:**
- Resultado: `{"success": true, "message": "Email enviado via pg_net (assíncrono)"}`
- Email deve chegar na caixa de entrada em alguns segundos

### Teste de Recuperação de Senha

```sql
-- Teste de recuperação de senha
SELECT send_password_reset_email(
  'seu-email-pessoal@gmail.com',
  'https://seudominio.com/reset-password?token=abc123'
);
```

**Esperado:**
- Resultado: `{"success": true, "message": "Email enviado via pg_net (assíncrono)"}`
- Email com link de reset deve chegar na caixa de entrada

## Teste 2: Via Edge Function Direta (curl)

### Obter Anon Key

No Supabase Dashboard:
1. Vá em **Settings** → **API**
2. Copie o `anon` public key

### Executar Teste

Substitua `SUA_ANON_KEY` e `seu-email@teste.com`:

```bash
curl -X POST https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/send-email-via-resend \
  -H "Authorization: Bearer SUA_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "seu-email-pessoal@gmail.com",
    "subject": "Teste de Email - CLUB DK",
    "type": "otp",
    "code": "654321"
  }'
```

**Esperado:**
- Resposta: `{"success": true, "messageId": "xxx-xxx-xxx"}`
- Email deve chegar na caixa de entrada

## Teste 3: Via Aplicação Front-end

### Teste de Cadastro com OTP

1. Acesse a aplicação em `http://localhost:5173`
2. Vá para a página de Login
3. Clique na aba "Criar Conta"
4. Digite seu email pessoal
5. Clique em "Enviar Código por E-mail"
6. Verifique se o email chega na caixa de entrada
7. Digite o código de 6 dígitos
8. Verifique se a conta é criada com sucesso

### Teste de Recuperação de Senha

1. Faça logout se estiver logado
2. Vá para a página de Login
3. Clique em "Esqueci minha senha"
4. Digite seu email
5. Clique em "Recuperar Senha"
6. Verifique se o email chega na caixa de entrada
7. Clique no link e verifique se você pode redefinir a senha

## Verificação de Logs

### Logs da Edge Function

1. Acesse o Supabase Dashboard
2. Vá em **Edge Functions**
3. Clique em `send-email-via-resend`
4. Clique em **Logs** para ver as requisições recentes

### O que verificar nos logs:

- `[send-email-via-resend] Received request`
- `[send-email-via-resend] Sending email { to, subject, type }`
- `[send-email-via-resend] Email sent successfully`

## Verificação no Resend Dashboard

1. Acesse https://resend.com/dashboard
2. Clique em **Emails** no menu lateral
3. Verifique se os emails aparecem na lista
4. Clique em um email para ver detalhes:
  - Status (delivered, bounced, etc.)
  - Timestamp
  - Destinatário
  - Preview do email

## Troubleshooting

### Email não chega

**Verificar:**
1. Logs da Edge Function no Supabase
2. Status no Resend Dashboard
3. Configuração das variáveis de ambiente
4. API Key está correta
5. Domínio está verificado no Resend

**Soluções:**
```sql
-- Verificar se as funções existem
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'send_%';

-- Verificar se pg_net está instalado
SELECT extname FROM pg_extension WHERE extname = 'pg_net';

-- Teste simples de pg_net
SELECT net.http_get('https://httpbin.org/get');
```

### Erro "Email service not configured"

**Causa:** Variáveis de ambiente não configuradas

**Solução:**
1. Vá em Supabase Dashboard → Settings → Edge Functions
2. Adicione `RESEND_API_KEY`
3. Adicione `RESEND_FROM_EMAIL`

### Erro "Failed to send email"

**Causa:** Erro na API do Resend

**Solução:**
1. Verifique os logs da Edge Function
2. Consulte o Resend Dashboard para ver detalhes do erro
3. Verifique se a API Key está correta
4. Verifique se o domínio está verificado

### pg_net não funciona

**Solução:**
```sql
-- Reinstalar pg_net
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net;
```

## Performance

O tempo médio de envio deve ser:
- **Edge Function direta**: 200-500ms
- **Via SQL (pg_net)**: Assíncrono (não afeta a aplicação)
- **Email recebido**: 1-5 segundos (dependendo do provedor)

## Checklist de Testes Completo

- [ ] Teste OTP via SQL Editor
- [ ] Teste recuperação de senha via SQL Editor
- [ ] Teste OTP via curl
- [ ] Teste cadastro com OTP na aplicação
- [ ] Teste recuperação de senha na aplicação
- [ ] Verificar logs da Edge Function
- [ ] Verificar emails no Resend Dashboard
- [ ] Testar em diferentes provedores (Gmail, Outlook, Yahoo)
- [ ] Verificar que emails não vão para spam
- [ ] Testar templates visuais em diferentes clientes

## Próximos Passos Após Testes

Se todos os testes passarem:
1. A aplicação está pronta para usar Resend em desenvolvimento
2. Para produção, configure seu domínio real no Resend
3. Atualize `RESEND_FROM_EMAIL` para o domínio de produção
4. Configure DNS (SPF, DKIM) no seu provedor de domínio
5. Faça novos testes em produção

---

**Dica:** Salve este guia para referência futura e para treinamento de novos desenvolvedores.
