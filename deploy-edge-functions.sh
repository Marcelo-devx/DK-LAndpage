#!/bin/bash

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  🚀 Deploy Automático das Edge Functions - CLUB DK"
echo "════════════════════════════════════════════════════════════"
echo ""

echo "[1/5] Verificando se Supabase CLI está instalado..."
if ! command -v supabase &> /dev/null; then
    echo ""
    echo "❌ Supabase CLI não encontrado. Instalando..."
    npm install -g supabase
    echo "✅ Supabase CLI instalado!"
else
    echo "✅ Supabase CLI já instalado"
fi

echo ""
echo "[2/5] Verificando login no Supabase..."
if ! supabase status &> /dev/null; then
    echo ""
    echo "⚠️  Você precisa fazer login primeiro."
    echo "   O navegador vai abrir para autorizar..."
    echo ""
    supabase login
    echo ""
    echo "✅ Login realizado!"
else
    echo "✅ Já logado no Supabase"
fi

echo ""
echo "[3/5] Conectando ao projeto..."
if ! supabase status &> /dev/null; then
    echo ""
    echo "🔗 Linkando ao projeto..."
    supabase link --project-ref jrlozhhvwqfmjtkmvukf
    echo ""
    echo "✅ Projeto linkado!"
else
    echo "✅ Já conectado ao projeto"
fi

echo ""
echo "[4/5] Fazendo deploy de TODAS as Edge Functions..."
echo "   Isso pode levar 2-3 minutos..."
echo "   Por favor, aguarde..."
echo ""
supabase functions deploy

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ ERRO no deploy!"
    echo ""
    exit 1
else
    echo ""
    echo "✅ Deploy concluído com sucesso!"
fi

echo ""
echo "[5/5] Verificando funções..."
supabase functions list

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ TUDO PRONTO!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  🎉 Todas as edge functions foram deployadas com sucesso!"
echo ""
echo "  📝 PRÓXIMO PASSO:"
echo "  Acesse o Dashboard para verificar:"
echo "  https://supabase.com/dashboard/project/jrlozhhvwqfmjtkmvukf/functions"
echo ""
echo "  Procure por estas funções:"
echo "  ✓ generate-token"
echo "  ✓ validate-token"
echo "  ✓ create-user"
echo "  ✓ send-email-via-resend"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

sleep 10
