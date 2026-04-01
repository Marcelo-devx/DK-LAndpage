import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { showError, showSuccess } from '@/utils/toast';

export default function ResendTestButton() {
  const [loading, setLoading] = useState(false);

  const sendTest = async () => {
    setLoading(true);
    try {
      const payload = {
        to: 'rc497064@gmail.com',
        subject: 'Teste Resend - OTP',
        type: 'otp',
        code: '123456',
      };

      const res = await supabase.functions.invoke('send-email-via-resend', { body: payload });

      if (res.error) {
        console.error('[ResendTestButton] error', res.error);
        showError('Erro ao enviar email: ' + (res.error.message || JSON.stringify(res.error)));
      } else {
        console.log('[ResendTestButton] response', res.data);
        showSuccess('E-mail enviado (verifique caixa de entrada).');
      }
    } catch (err: any) {
      console.error('[ResendTestButton] unexpected', err);
      showError('Erro inesperado ao enviar. Veja o console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center mb-4">
      <Button onClick={sendTest} className="uppercase" disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar teste Resend para rc497064@gmail.com'}
      </Button>
    </div>
  );
}
