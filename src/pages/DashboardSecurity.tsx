import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Mail, ShieldCheck, KeyRound } from 'lucide-react';

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// Gera senha aleatória com letras, números e símbolo
const generatePassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%';
  const all = upper + lower + numbers + symbols;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 4; i < 10; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  // Embaralhar
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
};

const DashboardSecurity = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSendNewPassword = async () => {
    setLoading(true);
    const toastId = showLoading('Gerando nova senha...');
    try {
      // 1) Pegar sessão e email do usuário
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        dismissToast(toastId);
        showError('Sessão expirada. Por favor, faça login novamente.');
        navigate('/login');
        return;
      }

      const email = session.user.email;

      // 2) Gerar nova senha aleatória
      const newPassword = generatePassword();

      // 3) Atualizar senha no Supabase
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        dismissToast(toastId);
        showError('Erro ao atualizar senha. Tente novamente.');
        console.error('[DashboardSecurity] updateUser error', updateError);
        return;
      }

      // 4) Enviar email com a nova senha via Resend
      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email-via-resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          to: email,
          subject: 'Sua nova senha - DKCWB',
          type: 'new_password',
          newPassword,
        }),
      });

      const emailData = await emailRes.json().catch(() => ({}));
      dismissToast(toastId);

      if (!emailRes.ok) {
        const errMsg = emailData?.error || 'Senha atualizada mas erro ao enviar email.';
        console.error('[DashboardSecurity] email error', emailRes.status, emailData);
        showError(errMsg);
        return;
      }

      setSent(true);
      showSuccess('Nova senha enviada para seu e-mail!');

    } catch (err: any) {
      dismissToast(toastId);
      showError(err.message || 'Erro inesperado. Tente novamente.');
      console.error('[DashboardSecurity] unexpected', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card className="border border-stone-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="h-7 w-7 text-rose-500" />
          </div>
          <CardTitle className="text-xl font-black uppercase tracking-tight text-charcoal-gray">
            Segurança da Conta
          </CardTitle>
          <CardDescription className="text-stone-500 mt-1">
            Solicite uma nova senha aleatória enviada diretamente para o seu e-mail.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 space-y-6">
          {!sent ? (
            <>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex gap-3 items-start">
                <KeyRound className="h-5 w-5 text-sky-500 mt-0.5 shrink-0" />
                <p className="text-sm text-sky-800">
                  Ao clicar no botão abaixo, geraremos uma <strong>nova senha aleatória</strong> e enviaremos para o seu e-mail cadastrado. Use essa senha para acessar o site.
                </p>
              </div>

              <Button
                onClick={handleSendNewPassword}
                disabled={loading}
                className="w-full h-12 uppercase font-black tracking-widest gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Mail className="h-4 w-4" /> Enviar Nova Senha por E-mail</>
                )}
              </Button>
            </>
          ) : (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <Mail className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-charcoal-gray text-lg">E-mail enviado!</p>
                <p className="text-sm text-stone-500 mt-1">
                  Verifique sua caixa de entrada. A nova senha foi enviada para o seu e-mail cadastrado.
                </p>
              </div>
              <p className="text-xs text-stone-400">Não recebeu? Verifique a caixa de spam.</p>
              <Button
                variant="outline"
                onClick={() => setSent(false)}
                className="uppercase font-bold tracking-widest text-xs"
              >
                Solicitar novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSecurity;
