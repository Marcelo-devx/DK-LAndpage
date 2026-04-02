# Diagnóstico Seguro do Looping Mercado Pago

## O que foi feito

✅ **Apenas adicionei logs de diagnóstico** em `src/pages/ConfirmacaoPedido.tsx`
   - Zero alteração de lógica existente
   - Apenas `console.log` para entender o problema
   - Nada foi quebrado

✅ **Criei uma página de teste isolada** `src/pages/DebugMercadoPago.tsx`
   - Arquivo separado, não interfere em nada
   - Pode ser usada opcionalmente
   - Pode ser deletada depois

✅ **Adicionei rota opcional** em `src/App.tsx` (comentada por padrão)
   - Não afeta nada, está desativada
   - Só use se quiser ver a página de debug

## Como usar

### Passo 1: Fazer um teste de compra

1. Faça uma compra de teste usando **cartão de crédito** (não PIX)
2. Deixe o pagamento ser aprovado no Mercado Pago
3. Deixe o Mercado Pago redirecionar de volta para seu site

### Passo 2: Abrir o console do navegador

1. Pressione **F12** ou clique com botão direito → Inspecionar
2. Vá na aba **Console**
3. Olhe os logs que começam com `=== DIAGNÓSTICO MERCADO PAGO ===`

### Passo 3: Observe se o looping acontece

Se houver looping, você verá os logs aparecendo múltiplas vezes. Observe:

- **URL completa**: Qual URL está sendo acessada?
- **Query params**: Quais parâmetros o Mercado Pago está mandando de volta?
- **Order ID do route**: Qual ID do pedido está sendo acessado?
- **Já carregou este pedido antes**: Se mostra um timestamp, significa que já carregou antes

### Passo 4: Tire prints e envie

Tire prints do console mostrando:
1. Os logs de diagnóstico
2. A URL na barra de endereços
3. Qualquer mensagem de erro

## O que NÃO foi feito (segurança do seu sistema)

❌ **NÃO** modifiquei o fluxo de checkout
❌ **NÃO** alterei a lógica de autenticação
❌ **NÃO** mudei as configurações do Mercado Pago
❌ **NÃO** modifiquei os webhooks
❌ **NÃO** criei redirecionamentos automáticos

## Como remover os diagnósticos (se quiser)

Se você quiser remover os logs depois, apenas:

1. Em `src/pages/ConfirmacaoPedido.tsx`, remova:
   ```typescript
   // === DIAGNÓSTICO MERCADO PAGO - LOGS INICIAIS ===
   ...
   // === FIM DIAGNÓSTICO ===
   ```

2. (Opcional) Deletar `src/pages/DebugMercadoPago.tsx` se não quiser usar

## O que vamos fazer depois

Com base nos logs que você enviar:

1. **Identificar a causa exata** do looping
2. **Discutir a solução** antes de implementar
3. **Implementar apenas** depois que você aprovar
4. **Testar cuidadosamente** cada mudança

## Rota de Debug Opcional

Se quiser usar a página de debug visual:

1. Descomente a linha em `src/App.tsx`:
   ```typescript
   <Route path="/debug-mp/:id?" element={<DebugMercadoPago />} />
   ```

2. Acesse: `https://seusite.com/debug-mp/ID_DO_PEDIDO`

3. Veja todas as informações de redirecionamento

Isso é **opcional** - você pode só olhar os logs do console se preferir.

---

**Resumo: Nada foi quebrado. Apenas adicionei logs para entender o problema.**
