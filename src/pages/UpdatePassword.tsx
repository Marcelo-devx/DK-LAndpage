import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Lock, ShieldCheck, Check, X } from 'lucide-react';

const translateSupabaseError = (msg: string): string => {
  if (msg.includes('weak') || msg.includes('easy to guess'))
    return 'Essa senha é muito comum e fácil de adivinhar. Por favor, escolha uma senha mais forte e única.';
  if (msg.includes('same as'))
    return 'A nova senha não pode ser igual à senha atual.';
  if (msg.includes('at least'))
    return 'A senha deve ter pelo menos 6 caracteres.';
  return msg;
};

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    const toastId = showLoading('Atualizando sua senha...');

    const { error } = await supabase.auth.updateUser({ password });

    dismissToast(toastId);
    setLoading(false);

    if (error) {
      showError(translateSupabaseError(error.message));
    } else {
      showSuccess('Senha atualizada com sucesso!');
      navigate('/');
    }
  };

  const Requirement = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${met ? 'text-emerald-400' : 'text-slate-500'}`}>
      {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </div>
  );

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
            Nova Senha
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium">
            Digite sua nova senha para recuperar o acesso à sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-6">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
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
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
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
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Redefinir Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePassword;
