# Guia de Deploy e Configuração das Edge Functions

Este guia explica como fazer o deploy das Edge Functions do Supabase e configurar as variáveis de ambiente necessárias para que o pagamento com cartão de crédito funcione corretamente.

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Instalar o Supabase CLI](#instalar-o-supabase-cli)
3. [Fazer Login no Supabase](#fazer-login-no-supabase)
4. [Deploy das Edge Functions](#deploy-das-edge-functions)
5. [Configurar Variáveis de Ambiente](#configurar-variáveis-de-ambiente)
6. [Verificar o Deploy](#verificar-o-deploy)
7. [Troubleshooting](#troubleshooting)
8. [Testar Localmente](#testar-localmente)

---

## Pré-requisitos

Antes de começar, certifique-se de ter:

- ✅ Acesso ao [Supabase Dashboard](https://supabase.com/dashboard)
- ✅ Permissões de admin no projeto Supabase
- ✅ Node.js instalado (opcional, apenas para desenvolvimento)
- ✅ Chaves de API do Mercado Pago e N8N em mãos
- ✅ Git configurado para clonar o repositório (se necessário)

---

## Instalar o Supabase CLI

### Via Homebrew (macOS)

```bash
brew install supabase/tap/supabase
```

### Via NPM

```bash
npm install -g supabase
```

### Via Scoop (Windows)

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Verificar instalação

```bash
supabase --version
```

Deve retornar algo como: `supabase 1.x.x`

---

## Fazer Login no Supabase

### Opção 1: Login Interativo

```bash
supabase login
```

Este comando abrirá o navegador para você fazer login na sua conta do Supabase.

### Opção 2: Com Access Token

Se você preferir não usar o login interativo:

1. Acesse [https://supabase.com/account/tokens](https://supabase.com/account/tokens)
2. Crie um novo token ou use um existente
3. Use o comando:

```bash
supabase login --token SEU_ACCESS_TOKEN
```

### Verificar Projeto Conectado

```bash
supabase status
```

Se você já estiver conectado a um projeto, verá informações sobre o projeto. Se não, precisa fazer o link.

### Linkar ao Projeto (se necessário)

```bash
supabase link --project-ref jrlozhhvwqfmjtkmvukf
```

O `--project-ref` é o ID do seu projeto (encontrado no Dashboard do Supabase em Settings → API).

---

## Deploy das Edge Functions

### Deploy de Todas as Funções

Para fazer o deploy de **todas** as Edge Functions de uma vez:

```bash
supabase functions deploy
```

Isso fará o upload de todas as funções na pasta `supabase/functions/`.

### Deploy de Funções Específicas

Para fazer o deploy apenas das funções relacionadas ao pagamento:

```bash
# Função de processamento de pagamento Mercado Pago
supabase functions deploy process-mercadopago-payment

# Função de trigger de integração (webhooks n8n)
supabase functions deploy trigger-integration
```

### Deploy com Flags Úteis

```bash
# Ver logs de deploy em tempo real
supabase functions deploy process-mercadopago-payment --debug

# Deploy sem confirmação (útil em CI/CD)
supabase functions deploy --no-verify-jwt
```

### O que Esperar

Durante o deploy, você verá algo assim:

```
Deploying functions...
Started deploying function: process-mercadopago-payment
Function uploaded successfully: process-mercadopago-payment (12.3 KB)
Deploying function: trigger-integration
Function uploaded successfully: trigger-integration (15.7 KB)
Done.
```

---

## Configurar Variáveis de Ambiente

As Edge Functions precisam de algumas variáveis de ambiente (secrets) para funcionar corretamente. Vamos configurá-las no Supabase Dashboard.

### Acessar o Dashboard de Secrets

1. Acesse [https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions/secrets](https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions/secrets)
   - Substitua `jrlozhhvwqfmjtkmvukf` pelo ID do seu projeto

### Variáveis Obrigatórias

#### 1. `SUPABASE_URL` (já existe por padrão)

- Valor: `https://jrlozhhvwqfmjtkmvukf.supabase.co`
- **Não alterar** - é gerada automaticamente pelo Supabase

#### 2. `SUPABASE_SERVICE_ROLE_KEY` (já existe por padrão)

- Valor: Chave de serviço do seu projeto
- **Não alterar** - é gerada automaticamente pelo Supabase

#### 3. `MERCADOPAGO_ACCESS_TOKEN` (Configurar)

**Como obter:**

1. Acesse [https://www.mercadopago.com.br/developers/panel](https://www.mercadopago.com.br/developers/panel)
2. Clique em "Suas integrações" → "Credenciais"
3. Copie o **Access Token de Produção**

**Configurar:**

No Dashboard do Supabase, clique em "New Secret":
- Name: `MERCADOPAGO_ACCESS_TOKEN`
- Value: `seu_access_token_aqui`

#### 4. `ALLOWED_ORIGINS` (Configurar - Opcional)

Controla quais domínios podem fazer requisições às Edge Functions. Se não configurado, usa os defaults (localhost + domínios de produção configurados no código).

**Valor sugerido:**

```
http://localhost:3000,http://localhost:5173,http://localhost:32120,https://dkcwb.com,https://www.dkcwb.com
```

**Configurar:**

No Dashboard do Supabase, clique em "New Secret":
- Name: `ALLOWED_ORIGINS`
- Value: (lista de domínios separados por vírgula, como acima)

#### 5. `RESEND_API_KEY` (Configurar - Se usar envio de emails)

**Como obter:**

1. Acesse [https://resend.com/api-keys](https://resend.com/api-keys)
2. Crie uma nova API Key
3. Copie a chave

**Configurar:**

No Dashboard do Supabase, clique em "New Secret":
- Name: `RESEND_API_KEY`
- Value: `re_XXXXXXXXXX`

#### 6. `RESEND_FROM_EMAIL` (Configurar - Se usar envio de emails)

**Valor sugerido:**

```
noreply@dkcwb.com
```

Ou qualquer outro email verificado no Resend.

---

## Verificar o Deploy

### Verificar Funções Ativas

Acesse [https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions](https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions)

Você deve ver as seguintes funções listadas:

- ✅ `process-mercadopago-payment`
- ✅ `trigger-integration`
- ✅ `validate-cep`
- ✅ `chat-proxy`
- ✅ `send-email-via-resend`
- ✅ Etc.

### Testar Função via Dashboard

1. Clique em uma função (ex: `process-mercadopago-payment`)
2. Vá para a aba "Logs"
3. Clique em "Invoke Function" para testar manualmente
4. Insira um JSON de teste e clique em "Send"

**Exemplo de teste para `process-mercadopago-payment`:**

```json
{
  "simulate": true
}
```

Deve retornar:
```json
{
  "success": true,
  "simulated": true
}
```

### Verificar Logs

Na aba "Logs" da função, você pode ver:

- Requisições recentes
- Erros e warnings
- Console.log das funções
- Status codes

---

## Troubleshooting

### Erro 1: "Failed to send a request to the Edge Function"

**Causas comuns:**

- Edge Function não está deployada
- CORS bloqueando a requisição
- Variáveis de ambiente não configuradas

**Solução:**

1. Verifique se a função está deployada no Dashboard
2. Verifique os logs da função no Dashboard
3. Confirme que `ALLOWED_ORIGINS` inclui o domínio da sua aplicação

### Erro 2: "CORS policy: Response to preflight request doesn't pass access control check"

**Causa:** Headers CORS incorretos ou ausentes

**Solução:**

As funções atualizadas já usam `getCorsHeaders()` corretamente. Se ainda tiver problemas:

1. Re-deploy a função:
   ```bash
   supabase functions deploy process-mercadopago-payment
   ```
2. Verifique se `ALLOWED_ORIGINS` inclui seu domínio
3. Limpe o cache do navegador
4. Use incognito mode para testar

### Erro 3: "MERCADOPAGO_ACCESS_TOKEN not configured"

**Causa:** Variável de ambiente não configurada

**Solução:**

1. Acesse [https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions/secrets](https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions/secrets)
2. Adicione o secret `MERCADOPAGO_ACCESS_TOKEN` com o valor correto
3. Re-deploy a função (não é necessário, mas recomendado)

### Erro 4: Pagamento é recusado com status "rejected"

**Causa:** Problema com o cartão ou conta Mercado Pago

**Solução:**

1. Verifique se o Access Token está correto e é de **PRODUÇÃO** (não sandbox)
2. Teste com diferentes cartões
3. Verifique os logs da função `process-mercadopago-payment` para ver detalhes do erro
4. Acesse o painel do Mercado Pago para ver transações

### Erro 5: Função retorna timeout

**Causa:** Função está demorando muito para responder

**Solução:**

1. Verifique se o webhook n8n está respondendo rápido
2. Reduza o timeout no código (atualmente 15s)
3. Otimize a lógica da função
4. Use assíncrono para operações demoradas (não bloquear a resposta principal)

---

## Testar Localmente

### Testar via cURL

```bash
# Testar preflight (OPTIONS)
curl -X OPTIONS \
  -H "Origin: http://localhost:32120" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/process-mercadopago-payment

# Testar POST
curl -X POST \
  -H "Origin: http://localhost:32120" \
  -H "Content-Type: application/json" \
  -d '{"simulate": true}' \
  https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/process-mercadopago-payment
```

### Testar via Browser Console

Abra o console do navegador e execute:

```javascript
// Teste básico
fetch('https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/process-mercadopago-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ simulate: true })
})
  .then(r => r.json())
  .then(data => console.log('✅ Sucesso:', data))
  .catch(err => console.error('❌ Erro:', err))
```

### Teste Completo do Checkout

1. Abra a aplicação em `http://localhost:32120`
2. Adicione produtos ao carrinho
3. Vá para o checkout
4. Preencha todos os dados de entrega
5. Selecione "Cartão de Crédito"
6. Clique em "Inserir Dados do Cartão"
7. Insira dados de cartão de teste (pode usar o sandbox do Mercado Pago)
8. Observe o console do navegador e o Dashboard do Supabase (logs)

---

## Checklist Antes de Go-Live

- [ ] Supabase CLI instalado e conectado ao projeto
- [ ] Todas as Edge Functions foram deployadas
- [ ] `MERCADOPAGO_ACCESS_TOKEN` configurado (produção)
- [ ] `ALLOWED_ORIGINS` configurado com domínios de produção
- [ ] `RESEND_API_KEY` configurado (se usar emails)
- [ ] Webhook n8n está ativo e respondendo
- [ ] Checkout com PIX foi testado e funciona
- [ ] Checkout com Cartão foi testado e funciona
- [ ] Logs das Edge Functions não mostram erros
- [ ] Pedidos criados aparecem no banco com status correto
- [ ] Webhooks n8n recebem notificações de pedidos
- [ ] Emails são enviados corretamente (se configurado)

---

## Comandos Rápidos

```bash
# Login
supabase login

# Linkar projeto
supabase link --project-ref jrlozhhvwqfmjtkmvukf

# Deploy todas as funções
supabase functions deploy

# Deploy função específica
supabase functions deploy process-mercadopago-payment

# Ver logs de todas as funções
supabase functions logs

# Ver logs de uma função específica
supabase functions logs process-mercadopago-payment --tail

# Deletar uma função (cuidado!)
supabase functions delete nome-da-funcao

# Listar funções deployadas
supabase functions list
```

---

## Links Úteis

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Mercado Pago API Docs](https://www.mercadopago.com.br/developers)
- [Mercado Pago SDK React](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/integration-configurations)

---

## Suporte

Se você encontrar problemas não listados aqui:

1. Verifique os logs no Dashboard do Supabase
2. Verifique os logs no console do navegador
3. Consulte a documentação oficial do Supabase
4. Use o Supabase Discord para perguntas da comunidade

---

**Última atualização:** 2025-01-07
**Versão do Supabase CLI recomendada:** 1.x.x ou superior
