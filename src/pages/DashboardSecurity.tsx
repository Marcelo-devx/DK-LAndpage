import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Mail, ShieldCheck, KeyRound } from 'lucide-react';

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

const DashboardSecurity = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSendNewPassword = async () => {
    setLoading(true);
    const toastId = showLoading('Gerando nova senha...');
    try {
      // 1) Pegar email do usuário logado
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        dismissToast(toastId);
        showError('Sessão expirada. Por favor, faça login novamente.');
        navigate('/login');
        return;
      }

      const email = session.user.email;

      // 2) Delegar para a edge function forgot-password (usa service role, sem conflito de sessão)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      dismissToast(toastId);

      if (!res.ok) {
        showError(data?.error || 'Erro ao gerar nova senha. Tente novamente.');
        console.error('[DashboardSecurity] forgot-password error', res.status, data);
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
    <div className="container mx-auto px-4 md:px-6 py-4 md:py-10 max-w-lg">
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
