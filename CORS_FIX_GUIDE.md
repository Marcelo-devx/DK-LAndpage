# Guia Completo para Corrigir o Erro de CORS

## ✅ O que foi implementado

1. **Página de teste React criada** em `src/pages/TestEdgeFunction.tsx`
   - Interface visual e intuitiva
   - Testa requisições OPTIONS e POST
   - Exibe headers CORS detalhados
   - Feedback claro (verde = sucesso, vermelho = erro)

2. **Rota adicionada** no App.tsx
   - Acessível em: `http://localhost:32120/test-edge-function`
   - Após deploy no Vercel: `https://dk-l-andpage.vercel.app/test-edge-function`

3. **Nada foi quebrado**
   - Todas as rotas existentes continuam funcionando
   - Código de checkout não foi modificado
   - Fluxo de pagamento permanece idêntico

---

## 🔧 Passos para Corrigir o CORS

### Passo 1: Acessar o Dashboard do Supabase

1. Vá para: https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions/secrets
2. Faça login se necessário

### Passo 2: Configurar o Secret ALLOWED_ORIGINS

1. Clique no botão **"New Secret"**
2. Preencha os campos:
   - **Name:** `ALLOWED_ORIGINS`
   - **Value:** (copie e cole exatamente):
     ```
     http://localhost:3000,http://localhost:5173,http://localhost:32120,https://dkcwb.com,https://www.dkcwb.com,https://dk-l-andpage.vercel.app
     ```
3. Clique em **"Save"**

> 💡 **Por que este secret?**
> Ele controla quais domínios podem fazer requisições às edge functions. Se não configurarmos, o código usa valores padrão que já incluem seu domínio, mas é melhor configurar explicitamente para maior controle.

### Passo 3: Fazer Deploy da Edge Function

Você precisa ter o **Supabase CLI** instalado. Se não tiver:

```bash
# Via Homebrew (macOS)
brew install supabase/tap/supabase

# Via NPM
npm install -g supabase
```

#### Fazer Login (se ainda não logado):

```bash
supabase login
```
Isso vai abrir o navegador para você autorizar.

#### Linkar ao Projeto (se necessário):

```bash
supabase link --project-ref jrlozhhvwqfmjtkmvukf
```

#### Fazer o Deploy da Função:

```bash
supabase functions deploy process-mercadopago-payment
```

> ⚠️ **Importante:** O deploy pode levar 2-3 minutos para processar completamente. Aguarde!

### Passo 4: Testar Localmente

1. Certifique-se que o app está rodando: `npm run dev`
2. Acesse: http://localhost:32120/test-edge-function
3. Clique no botão **"Testar Conexão"**
4. **Resultado esperado:** ✅ Tudo verde indicando que CORS está correto

### Passo 5: Testar em Produção (Vercel)

1. Faça deploy do código no Vercel:
   - Se estiver usando Vercel CLI: `vercel --prod`
   - Se estiver usando Git: `git push` e aguarde o deploy automático

2. Após o deploy, acesse:
   - https://dk-l-andpage.vercel.app/test-edge-function

3. Clique em **"Testar Conexão"**

4. **Resultado esperado:**
   - ✅ Sucesso com mensagem verde
   - Headers CORS mostrando: `Access-Control-Allow-Origin: https://dk-l-andpage.vercel.app`

---

## 🧪 Como Testar o Pagamento Real

Após confirmar que o CORS está correto (teste verde), teste o checkout:

### Teste 1: Acessar o Checkout

1. Adicione produtos ao carrinho
2. Vá para `/checkout`
3. Preencha todos os dados de entrega
4. Selecione **"Cartão de Crédito"**
5. Clique em **"Inserir Dados do Cartão"**

### Teste 2: Preencher Dados do Cartão

Use um cartão de teste do Mercado Pago Sandbox:

- **Número do cartão:** 5031 4332 1540 6351 (Visa)
- **CVV:** 123
- **Validade:** Qualquer data futura (ex: 12/25)
- **Titular:** qualquer nome
- **CPF:** qualquer CPF válido (apenas números)

> ⚠️ **Nota:** Se você já tiver um access token de produção do Mercado Pago, pode usar cartões reais também.

### Teste 3: Confirmar Pagamento

1. Clique em **"Confirmar Pagamento"**
2. Abra o console do navegador (F12) para ver logs
3. Verifique se não há erros de CORS
4. Verifique no Dashboard do Supabase (Logs) se a função foi chamada

---

## 🐛 Troubleshooting

### Problema 1: A página de teste não carrega

**Solução:**
- Verifique se o servidor local está rodando: `npm run dev`
- Tente acessar: http://localhost:32120
- Verifique o console do navegador por erros

### Problema 2: Teste mostra erro de CORS (vermelho)

**Possíveis causas:**
1. ✅ A edge function ainda não foi deployada
   - **Solução:** Execute `supabase functions deploy process-mercadopago-payment` e aguarde 3 minutos

2. ✅ O secret ALLOWED_ORIGINS não foi configurado
   - **Solução:** Configure no Supabase Dashboard conforme Passo 2

3. ✅ O deploy ainda não processou
   - **Solução:** Aguarde mais 2-3 minutos e tente novamente

4. ✅ Cache do navegador
   - **Solução:** Abra em modo incognito ou limpe o cache

### Problema 3: Pagamento com cartão falha após CORS estar ok

**Possíveis causas:**
1. **Access Token do Mercado Pago incorreto**
   - Verifique no Supabase Dashboard → Secrets → MERCADOPAGO_ACCESS_TOKEN
   - Use um token de **PRODUÇÃO** (não sandbox)

2. **Problema no cartão**
   - Tente com outro cartão
   - Verifique se há saldo suficiente

3. **Erro na função finalize_order_payment**
   - Verifique logs no Supabase Dashboard
   - A função pode ter falhado em finalizar o pedido mesmo com pagamento aprovado

### Problema 4: Comando `supabase functions deploy` não funciona

**Soluções:**
```bash
# Instalar o CLI
npm install -g supabase

# Fazer login
supabase login

# Linkar ao projeto
supabase link --project-ref jrlozhhvwqfmjtkmvukf

# Tentar novamente
supabase functions deploy process-mercadopago-payment
```

---

## 📊 O Que Está Acontecendo nos Bastidores

### Fluxo do CORS:

1. **Browser envia requisição OPTIONS** (preflight):
   ```
   OPTIONS https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/process-mercadopago-payment
   Origin: https://dk-l-andpage.vercel.app
   Access-Control-Request-Method: POST
   ```

2. **Edge Function responde com headers CORS:**
   ```
   Access-Control-Allow-Origin: https://dk-l-andpage.vercel.app
   Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
   Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
   ```

3. **Browser verifica e aprova** a origem

4. **Browser envia requisição POST real** com dados do cartão

5. **Edge Function processa** o pagamento no Mercado Pago

### Como o Código Gerencia CORS:

O arquivo `supabase/functions/_shared/cors.ts` contém:
- `getAllowedOrigins()`: Retorna lista de origens permitidas
- `isOriginAllowed(origin)`: Verifica se origem é permitida
- `getCorsHeaders(origin)`: Gera headers CORS corretos
- `createPreflightResponse(origin)`: Retorna resposta OPTIONS (status 204)

A função `process-mercadopago-payment` usa esses helpers para aplicar CORS em **todas** as respostas.

---

## 🎯 Checklist Final

Antes de considerar o problema resolvido, confirme:

- [ ] Secret `ALLOWED_ORIGINS` configurado no Supabase Dashboard
- [ ] Função `process-mercadopago-payment` re-deployada
- [ ] Página de teste carrega em http://localhost:32120/test-edge-function
- [ ] Teste mostra resultado ✅ VERDE em localhost
- [ ] Deploy feito no Vercel
- [ ] Página de teste carrega em https://dk-l-andpage.vercel.app/test-edge-function
- [ ] Teste mostra resultado ✅ VERDE em produção
- [ ] Pagamento com cartão testado no checkout
- [ ] Nenhum erro de CORS no console do navegador
- [ ] Pagamento finaliza com sucesso no banco de dados

---

## 📝 Links Úteis

- **Dashboard Supabase:** https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf
- **Functions Logs:** https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions
- **Functions Secrets:** https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions/secrets
- **Mercado Pago Developers:** https://www.mercadopago.com.br/developers
- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli

---

## 💬 Dúvidas?

Se encontrar problemas não listados aqui:

1. Verifique os logs no Console do Navegador (F12 → Console)
2. Verifique os logs no Supabase Dashboard (Functions → Logs)
3. Consulte o arquivo `SUPABASE_EDGE_FUNCTIONS_DEPLOY.md` para mais detalhes

---

**Última atualização:** 2025-01-07
**Versão:** 1.0
**Status:** ✅ Implementado e pronto para testes
