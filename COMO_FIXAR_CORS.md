# 🚀 Como Fixar o CORS - Guia Super Simples

## Opção 1: Usar Script Automatizado (Mais Fácil)

### Windows:
```cmd
cd pasta-do-seu-projeto
fix-cors.bat
```

### Mac/Linux:
```bash
cd pasta-do-seu-projeto
chmod +x fix-cors.sh
./fix-cors.sh
```

O script vai:
1. ✅ Instalar Supabase CLI se necessário
2. ✅ Fazer login automaticamente (abre o navegador)
3. ✅ Linkar ao projeto
4. ✅ Fazer deploy da função

---

## Opção 2: Manualmente (Passo a Passo)

### Passo 1: Abrir o terminal no seu projeto

Se estiver usando VS Code:
- Pressione `Ctrl + J` (Windows) ou `Cmd + J` (Mac)
- O terminal vai abrir na pasta do projeto

### Passo 2: Instalar Supabase CLI (se não tiver)

```bash
npm install -g supabase
```

### Passo 3: Fazer login

```bash
supabase login
```

O navegador vai abrir para você autorizar.

### Passo 4: Fazer deploy da função

```bash
supabase functions deploy process-mercadopago-payment
```

Aguarde 2-3 minutos...

---

## 🔑 Passo OBRIGATÓRIO: Configurar o Secret

Após o deploy, você PRECISA configurar o secret manualmente no Dashboard (isso eu não consigo automatizar):

1. **Clique aqui:** https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions/secrets

2. **Clique em "New Secret"**

3. **Preencha:**
   - **Name:** `ALLOWED_ORIGINS`
   - **Value:** (copie exatamente):
     ```
     http://localhost:3000,http://localhost:5173,http://localhost:32120,https://dkcwb.com,https://www.dkcwb.com,https://dk-l-andpage.vercel.app
     ```

4. **Clique em "Save"**

---

## ✅ Passo Final: Testar

1. **Aguarde 2-3 minutos** após o deploy

2. **Acesse:** https://dk-l-andpage.vercel.app/test-edge-function

3. **Clique em "Testar Conexão"**

4. **Deve aparecer ✅ VERDE** (sucesso!)

---

## 🎯 Por que preciso fazer isso manualmente?

O **supabase CLI** e o **Dashboard do Supabase** são ferramentas externas que não fazem parte do código. Eu consigo:
- ✅ Criar e modificar arquivos de código
- ✅ Criar scripts para automatizar comandos

Mas NÃO consigo:
- ❌ Executar comandos de CLI no seu computador
- ❌ Acessar o Dashboard do Supabase com seu login
- ❌ Configurar secrets automaticamente

Por isso preciso que você execute esses passos manualmente.

---

## 🆘 Problemas?

### Script não funciona?
- Execute manualmente os comandos (Opção 2 acima)

### `supabase: command not found`?
- Instale: `npm install -g supabase`

### Login falha?
- Verifique se o navegador abriu para autorizar
- Tente: `supabase login` novamente

### Deploy demora muito?
- É normal, pode levar 2-3 minutos
- Se travar por mais de 10 minutos, cancele e tente novamente

---

## 📞 Precisa de ajuda?

Me diga em qual passo você está e o erro que aparece, e eu te ajudo a resolver!
