@echo off
chcp 65001 >nul
echo.
echo ════════════════════════════════════════════════════════════
echo   🚀 Deploy Automático das Edge Functions - CLUB DK
echo ════════════════════════════════════════════════════════════
echo.

echo [1/5] Verificando se Supabase CLI está instalado...
supabase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Supabase CLI não encontrado. Instalando...
    call npm install -g supabase
    echo ✅ Supabase CLI instalado!
) else (
    echo ✅ Supabase CLI já instalado
)

echo.
echo [2/5] Verificando login no Supabase...
supabase status >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Você precisa fazer login primeiro.
    echo    O navegador vai abrir para autorizar...
    echo.
    call supabase login
    echo.
    echo ✅ Login realizado!
) else (
    echo ✅ Já logado no Supabase
)

echo.
echo [3/5] Conectando ao projeto...
supabase status >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo 🔗 Linkando ao projeto...
    call supabase link --project-ref jrlozhhvwqfmjtkmvukf
    echo.
    echo ✅ Projeto linkado!
) else (
    echo ✅ Já conectado ao projeto
)

echo.
echo [4/5] Fazendo deploy de TODAS as Edge Functions...
echo    Isso pode levar 2-3 minutos...
echo    Por favor, aguarde...
echo.
call supabase functions deploy

if %errorlevel% neq 0 (
    echo.
    echo ❌ ERRO no deploy!
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ✅ Deploy concluído com sucesso!
)

echo.
echo [5/5] Verificando funções...
supabase functions list >nul 2>&1

echo.
echo ════════════════════════════════════════════════════════════
echo   ✅ TUDO PRONTO!
echo ════════════════════════════════════════════════════════════
echo.
echo   🎉 Todas as edge functions foram deployadas com sucesso!
echo.
echo   📝 PRÓXIMO PASSO:
echo   Acesse o Dashboard para verificar:
echo   https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions
echo.
echo   Procure por estas funções:
echo   ✓ generate-token
echo   ✓ validate-token
echo   ✓ create-user
echo   ✓ send-email-via-resend
echo.
echo ════════════════════════════════════════════════════════════
echo.

timeout /t 10 >nul
