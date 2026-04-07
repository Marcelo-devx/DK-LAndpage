@echo off
echo 🔧 Script Automático para Corrigir CORS
echo ========================================
echo.

REM Verificar se Supabase CLI está instalado
where supabase >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI não encontrado.
    echo.
    echo Instalando Supabase CLI...
    call npm install -g supabase
    echo.
)

REM Verificar se está logado
echo 📋 Verificando login no Supabase...
supabase status >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ⚠️ Você precisa fazer login no Supabase primeiro.
    echo O navegador vai abrir para autorizar...
    echo.
    call supabase login
)

REM Linkar ao projeto se necessário
echo.
echo 📋 Verificando conexão com o projeto...
supabase status >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo 🔗 Linkando ao projeto...
    call supabase link --project-ref jrlozhhvwqfmjtkmvukf
)

echo.
echo ✅ Fazer deploy da função: process-mercadopago-payment
echo.
echo Isso pode levar 2-3 minutos...
echo.

REM Fazer deploy
call supabase functions deploy process-mercadopago-payment

echo.
echo ========================================
echo ✅ Deploy concluído!
echo.
echo 📝 PRÓXIMOS PASSOS MANUAIS:
echo ========================================
echo.
echo 1. Acesse o Dashboard do Supabase:
echo    https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions/secrets
echo.
echo 2. Clique em "New Secret"
echo.
echo 3. Preencha:
echo    Name: ALLOWED_ORIGINS
echo    Value: http://localhost:3000,http://localhost:5173,http://localhost:32120,https://dkcwb.com,https://www.dkcwb.com,https://dk-l-andpage.vercel.app
echo.
echo 4. Clique em "Save"
echo.
echo 5. Aguarde 2-3 minutos para o deploy processar
echo.
echo 6. Teste novamente em:
echo    https://dk-l-andpage.vercel.app/test-edge-function
echo.
echo ========================================
pause
