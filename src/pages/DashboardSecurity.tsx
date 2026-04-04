import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Mail, ShieldCheck, KeyRound, Lock, Check, X } from 'lucide-react';

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

const DashboardSecurity = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const navigate = useNavigate();

  // manual change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changing, setChanging] = useState(false);

  // helper: fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const checks = useMemo(() => ({
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    number: /\d/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmNewPassword,
    notSameAsCurrent: currentPassword.length > 0 ? newPassword !== currentPassword : true,
  }), [newPassword, confirmNewPassword, currentPassword]);

  const allValid = checks.length && checks.upper && checks.number && checks.special && checks.match && checks.notSameAsCurrent;

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
      const res = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email }),
      }, 20000);

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
      dismissToast(undefined as any);
      if (err.name === 'AbortError') {
        showError('Tempo excedido ao enviar pedido. Tente novamente.');
      } else {
        showError(err.message || 'Erro inesperado. Tente novamente.');
      }
      console.error('[DashboardSecurity] unexpected', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!allValid) {
      if (!checks.notSameAsCurrent) showError('A nova senha não pode ser igual à senha atual.');
      else showError('A nova senha não atende aos requisitos.');
      return;
    }

    setChanging(true);
    const toastId = showLoading('Atualizando senha...');

    // watchdog to avoid infinite loading
    let timedOut = false;
    const watchdog = setTimeout(() => {
      timedOut = true;
      try { dismissToast(toastId); } catch (e) {}
      setChanging(false);
      showError('Tempo excedido. Tente novamente mais tarde.');
    }, 20000);

    try {
      // get user email
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        dismissToast(toastId);
        showError('Sessão expirada. Por favor, faça login novamente.');
        navigate('/login');
        clearTimeout(watchdog);
        setChanging(false);
        return;
      }
      const email = session.user.email;

      // Re-authenticate using current password
      const signRes = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signRes.error) {
        dismissToast(toastId);
        showError('Senha atual incorreta.');
        setChanging(false);
        clearTimeout(watchdog);
        return;
      }

      // Now update password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      dismissToast(toastId);

      if (error) {
        showError(error.message || 'Erro ao atualizar senha.');
        console.error('[DashboardSecurity] updateUser error', error);
      } else {
        showSuccess('Senha atualizada com sucesso!');
        // clear fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setManualMode(false);

        // invoke edge function to notify user (non-blocking but with timeout)
        try {
          const notifyRes = await fetchWithTimeout('https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/notify-password-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: session.user.user_metadata?.full_name || session.user.email }),
          }, 7000);
          if (!notifyRes.ok) console.error('[DashboardSecurity] notify-password-change failed', notifyRes.status);
        } catch (e) {
          if ((e as any).name === 'AbortError') console.error('[DashboardSecurity] notify-password-change timeout');
          else console.error('[DashboardSecurity] notify-password-change error', e);
        }
      }
    } catch (err: any) {
      dismissToast(toastId);
      if (timedOut) return;
      showError(err.message || 'Erro inesperado.');
      console.error('[DashboardSecurity] manual change unexpected', err);
    } finally {
      clearTimeout(watchdog);
      setChanging(false);
    }
  };

  const Requirement = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${met ? 'text-emerald-400' : 'text-slate-500'}`}>
      {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </div>
  );

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

              <div className="text-center text-sm text-slate-500">ou</div>

              <div className="text-center">
                <Button variant="outline" onClick={() => setManualMode(!manualMode)} className="uppercase font-bold tracking-widest text-xs">
                  {manualMode ? 'Cancelar alteração manual' : 'Redefinir usando sua senha atual'}
                </Button>
              </div>

              {manualMode && (
                <form onSubmit={handleManualChange} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase">Senha Atual</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pl-10 h-11 w-full rounded-xl border border-white/5 px-3"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase">Nova Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 h-11 w-full rounded-xl border border-white/5 px-3"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  {newPassword.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-white/5">
                      <Requirement met={checks.length} label="8+ caracteres" />
                      <Requirement met={checks.upper} label="Letra maiúscula" />
                      <Requirement met={checks.number} label="Número" />
                      <Requirement met={checks.special} label="Caractere especial" />
                      <Requirement met={checks.notSameAsCurrent} label="Diferente da senha atual" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase">Confirmar Nova Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="pl-10 h-11 w-full rounded-xl border border-white/5 px-3"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={changing} className="flex-1 h-11 uppercase font-black">
                      {changing ? <><Loader2 className="h-4 w-4 animate-spin" /> Atualizando...</> : 'Atualizar senha agora'}
                    </Button>
                    <Button variant="outline" onClick={() => setManualMode(false)} className="h-11">Cancelar</Button>
                  </div>
                </form>
              )}
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