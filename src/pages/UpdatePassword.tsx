import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Lock, ShieldCheck, Check, X, AlertTriangle } from 'lucide-react';
import { logger } from '@/lib/logger';

// const SUPABASE_URL moved to env; we now use supabase.functions.invoke where possible

const translateError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes('pwned') || m.includes('vazamento') || m.includes('comprometida'))
    return 'Esta senha foi encontrada em vazamentos de dados. Escolha uma senha diferente e mais segura.';
  if (m.includes('weak') || m.includes('easy to guess') || m.includes('comum'))
    return 'Essa senha é muito comum. Por favor, escolha uma senha mais forte e única.';
  if (m.includes('same as') || m.includes('igual'))
    return 'A nova senha não pode ser igual à senha temporária. Crie uma senha própria.';
  if (m.includes('at least') || m.includes('caracteres'))
    return 'A senha deve ter pelo menos 8 caracteres.';
  if (m.includes('session') || m.includes('sessão') || m.includes('token'))
    return 'Sessão expirada. Por favor, faça login novamente.';
  return msg;
};

const UpdatePassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMandatory = location.state?.mandatory === true;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login', { replace: true });
      }
      setCheckingSession(false);
    });
  }, [navigate]);

  const checks = useMemo(() => ({
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    match: password.length > 0 && password === confirmPassword,
  }), [password, confirmPassword]);

  const allValid = checks.length && checks.upper && checks.number && checks.special && checks.match;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checks.length) { showError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (!checks.upper) { showError('A senha deve conter pelo menos 1 letra maiúscula.'); return; }
    if (!checks.number) { showError('A senha deve conter pelo menos 1 número.'); return; }
    if (!checks.special) { showError('A senha deve conter pelo menos 1 caractere especial (!@#$%...).'); return; }
    if (!checks.match) { showError('As senhas não coincidem.'); return; }

    setLoading(true);
    const toastId = showLoading('Criando sua senha...');

    // Watchdog: garante que o loading nunca trava para sempre
    const watchdog = setTimeout(() => {
      dismissToast(toastId);
      setLoading(false);
      showError('A operação demorou demais. Tente novamente.');
      console.error('[UpdatePassword] watchdog disparado — updateUser travou');
    }, 20000);

    try {
      logger.log('[UpdatePassword] Buscando sessão...');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        clearTimeout(watchdog);
        dismissToast(toastId);
        setLoading(false);
        showError('Sessão expirada. Por favor, faça login novamente.');
        navigate('/login', { replace: true });
        return;
      }

      const accessToken = session.access_token;
      const userId = session.user.id;
      const userEmail = session.user.email || '';

      logger.log('[UpdatePassword] Chamando update-password-admin via edge function...');

      // Usar a edge function com service role — bypassa HaveIBeenPwned e evita travamento
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 18000);

      let updRes: Response;
      let updData: any = {};
      try {
        const invokeRes = await supabase.functions.invoke('update-password-admin', { body: { newPassword: password } });
                // Normalize response shape
                updRes = { ok: !invokeRes.error, status: invokeRes.error ? 500 : 200 } as any;
                updData = invokeRes.data || {};
      } catch (fetchErr: any) {
        clearTimeout(fetchTimeout);
        clearTimeout(watchdog);
        dismissToast(toastId);
        setLoading(false);
        if (fetchErr?.name === 'AbortError') {
          showError('A operação demorou demais. Tente novamente.');
        } else {
          showError('Erro de conexão. Verifique sua internet e tente novamente.');
        }
        console.error('[UpdatePassword] fetch error:', fetchErr);
        return;
      } finally {
        clearTimeout(fetchTimeout);
      }

      logger.log('[UpdatePassword] Resultado update-password-admin:', { status: updRes.status, data: updData });

      if (!updRes.ok) {
        clearTimeout(watchdog);
        dismissToast(toastId);
        setLoading(false);
        showError(translateError(updData?.error || `Erro ao atualizar senha (${updRes.status})`));
        return;
      }

      // must_change_password é limpo pela edge function update-password-admin via service role
      clearTimeout(watchdog);
      dismissToast(toastId);
      setLoading(false);
      showSuccess('Senha criada com sucesso! Faça login com sua nova senha.');

      // Fazer signOut para limpar tokens antigos antes de redirecionar
      await supabase.auth.signOut();
      setTimeout(() => {
        navigate('/login', { replace: true, state: { passwordChanged: true } });
      }, 1500);

    } catch (err: any) {
      clearTimeout(watchdog);
      dismissToast(toastId);
      setLoading(false);

      if (err?.name === 'AbortError') {
        showError('A operação demorou demais. Tente novamente.');
        console.error('[UpdatePassword] fetch abortado por timeout');
      } else {
        showError(translateError(err?.message || 'Erro inesperado. Tente novamente.'));
        console.error('[UpdatePassword] erro inesperado:', err);
      }
    }
  };

  const Requirement = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${met ? 'text-emerald-400' : 'text-slate-500'}`}>
      {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </div>
  );

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[2rem]">
        <CardHeader className="text-center p-8 pb-4">
          <div className="mx-auto bg-sky-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-sky-500/20">
            <ShieldCheck className="h-8 w-8 text-sky-400" />
          </div>
          <CardTitle className="text-2xl font-black italic uppercase text-white tracking-tighter">
            {isMandatory ? 'Crie sua Senha' : 'Nova Senha'}
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium mt-1">
            {isMandatory
              ? 'Você entrou com uma senha temporária. Crie agora uma senha própria e segura para sua conta.'
              : 'Digite sua nova senha para recuperar o acesso à sua conta.'}
          </CardDescription>
        </CardHeader>

        {isMandatory && (
          <div className="mx-8 mb-2 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300 leading-relaxed">
              <span className="font-bold">Ação obrigatória:</span> Por segurança, você precisa criar uma senha pessoal antes de continuar.
            </p>
          </div>
        )}

        <CardContent className="p-8 pt-4 space-y-6">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                {isMandatory ? 'Sua Nova Senha' : 'Nova Senha'}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12 bg-slate-950 border-white/10 text-white rounded-xl focus:border-sky-500 transition-colors"
                  placeholder="••••••••"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {password.length > 0 && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/50 rounded-xl border border-white/5">
                <Requirement met={checks.length} label="8+ caracteres" />
                <Requirement met={checks.upper} label="Letra maiúscula" />
                <Requirement met={checks.number} label="Número" />
                <Requirement met={checks.special} label="Caractere especial" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-12 bg-slate-950 border-white/10 text-white rounded-xl focus:border-sky-500 transition-colors"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
              {confirmPassword.length > 0 && !checks.match && (
                <p className="text-xs text-red-400 font-medium flex items-center gap-1.5 mt-1">
                  <X className="h-3.5 w-3.5" /> As senhas não coincidem
                </p>
              )}
              {checks.match && (
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                  <Check className="h-3.5 w-3.5" /> Senhas coincidem
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 mt-4 disabled:opacity-50"
              disabled={loading || !allValid}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isMandatory ? 'Criar Minha Senha' : 'Redefinir Senha')}
            </Button>

            {!isMandatory && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium"
                  disabled={loading}
                >
                  Cancelar e voltar para a loja
                </button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePassword;
