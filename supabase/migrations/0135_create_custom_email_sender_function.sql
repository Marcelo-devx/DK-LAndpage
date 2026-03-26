-- Criar função RPC para enviar emails via Resend Edge Function
-- Esta função permite enviar emails de OTP e recuperação de senha

CREATE OR REPLACE FUNCTION public.send_email_via_resend(
  p_to TEXT,
  p_subject TEXT,
  p_type TEXT DEFAULT NULL,
  p_code TEXT DEFAULT NULL,
  p_reset_link TEXT DEFAULT NULL,
  p_html TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_edge_function_url TEXT;
  v_payload JSONB;
  v_response JSONB;
  v_http_response TEXT;
  v_http_status INT;
BEGIN
  -- Construir payload para a edge function
  v_payload := jsonb_build_object(
    'to', p_to,
    'subject', p_subject,
    'type', p_type,
    'code', p_code,
    'resetLink', p_reset_link,
    'html', p_html
  );

  -- Remover campos nulos do payload
  v_payload := v_payload - COALESCE(NULLIF(v_payload->>'type', ''), '');
  IF v_payload ? 'code' AND (v_payload->>'code') IS NULL THEN
    v_payload := v_payload - 'code';
  END IF;
  IF v_payload ? 'resetLink' AND (v_payload->>'resetLink') IS NULL THEN
    v_payload := v_payload - 'resetLink';
  END IF;
  IF v_payload ? 'html' AND (v_payload->>'html') IS NULL THEN
    v_payload := v_payload - 'html';
  END IF;

  -- URL da edge function (hardcoded conforme diretrizes)
  v_edge_function_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/send-email-via-resend';

  -- Fazer a requisição HTTP para a edge function
  -- Nota: Em produção, isso deve funcionar pois a edge function está no mesmo projeto
  -- Para testes locais, pode ser necessário configurar a extensão pg_net
  
  -- Tentar usar pg_net para fazer a requisição
  -- Se não estiver disponível, retornar instruções
  BEGIN
    -- Verificar se pg_net está instalado e ativo
    IF EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ) THEN
      -- Usar pg_net para enviar a requisição
      PERFORM net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
        ),
        body := v_payload
      );
      
      -- Retornar sucesso (pg_net é assíncrono, então não temos o resultado imediato)
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Email enviado via pg_net (assíncrono)'
      );
    ELSE
      -- pg_net não está disponível, retornar instruções
      RETURN jsonb_build_object(
        'success', false,
        'error', 'pg_net extension not available',
        'message', 'Para usar esta função, instale a extensão pg_net: CREATE EXTENSION pg_net;'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Se houver erro com pg_net, retornar o erro
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erro ao enviar email via pg_net'
    );
  END;
END;
$$;

-- Garantir que a função tem permissão de execução para authenticated e service_role
GRANT EXECUTE ON FUNCTION public.send_email_via_resend(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_email_via_resend(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Criar função auxiliar para enviar OTP
CREATE OR REPLACE FUNCTION public.send_otp_email(p_email TEXT, p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.send_email_via_resend(
    p_to => p_email,
    p_subject => 'Seu Código de Verificação - CLUB DK',
    p_type => 'otp',
    p_code => p_code
  );
END;
$$;

-- Garantir permissão para função auxiliar
GRANT EXECUTE ON FUNCTION public.send_otp_email(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_otp_email(TEXT, TEXT) TO service_role;

-- Criar função auxiliar para enviar email de recuperação de senha
CREATE OR REPLACE FUNCTION public.send_password_reset_email(p_email TEXT, p_reset_link TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.send_email_via_resend(
    p_to => p_email,
    p_subject => 'Redefinir sua Senha - CLUB DK',
    p_type => 'password_reset',
    p_reset_link => p_reset_link
  );
END;
$$;

-- Garantir permissão para função auxiliar
GRANT EXECUTE ON FUNCTION public.send_password_reset_email(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_password_reset_email(TEXT, TEXT) TO service_role;

-- Teste de instalação
DO $$
BEGIN
  RAISE NOTICE 'Funções de email criadas com sucesso:';
  RAISE NOTICE '  - send_email_via_resend: Função principal para envio de emails';
  RAISE NOTICE '  - send_otp_email: Função auxiliar para enviar códigos OTP';
  RAISE NOTICE '  - send_password_reset_email: Função auxiliar para recuperação de senha';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  1. Configure as variáveis de ambiente: RESEND_API_KEY e RESEND_FROM_EMAIL';
  RAISE NOTICE '  2. Certifique-se de que a extensão pg_net está instalada: CREATE EXTENSION pg_net;';
  RAISE NOTICE '  3. Teste o envio chamando: SELECT send_otp_email(''test@example.com'', ''123456'');';
END $$;
