import React, { useState } from 'react';
import { Button } from './ui/button';
import { showError, showSuccess } from '@/utils/toast';
import { invokePublic } from '@/lib/invokePublic';

export default function ResendTestButton() {
  const [loading, setLoading] = useState(false);

  const sendTest = async () => {
    setLoading(true);
    try {
      const gen = await invokePublic('generate-token', {
        body: { email: 'rc497064@gmail.com', type: 'complete_profile', expires_in_seconds: 60 * 60 },
      });

      if (gen.error) {
        console.error('[ResendTestButton] generate-token error', gen.error);
        showError('Erro ao gerar token: ' + (gen.error.message || JSON.stringify(gen.error)));
        setLoading(false);
        return;
      }

      const token = (gen.data as any)?.token;
      if (!token) {
        console.error('[ResendTestButton] generate-token missing token', gen);
        showError('Erro ao gerar token (token ausente).');
        setLoading(false);
        return;
      }

      const payload = {
        to: 'rc497064@gmail.com',
        subject: 'Teste Resend - Complete Profile',
        type: 'complete_profile',
        completeLink: `${window.location.origin}/complete-profile?token=${encodeURIComponent(token)}`,
      };

      const res = await invokePublic('send-email-via-resend', { body: payload });

      if (res.error) {
        console.error('[ResendTestButton] send-email-via-resend error', res.error);
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