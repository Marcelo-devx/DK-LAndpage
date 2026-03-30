import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Check, X } from 'lucide-react';

const translateSupabaseError = (msg: string): string => {
  if (msg.includes('weak') || msg.includes('easy to guess'))
    return 'Essa senha é muito comum e fácil de adivinhar. Por favor, escolha uma senha mais forte e única.';
  if (msg.includes('same as'))
    return 'A nova senha não pode ser igual à senha atual.';
  if (msg.includes('at least'))
    return 'A senha deve ter pelo menos 8 caracteres.';
  return msg;
};

const DashboardSecurity = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const checks = useMemo(() => ({
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    match: password.length > 0 && password === confirm,
  }), [password, confirm]);

  const allValid = checks.length && checks.upper && checks.number && checks.special && checks.match;

  const handleChangePassword = async () => {
    if (!checks.length) { showError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (!checks.upper) { showError('A senha deve conter pelo menos 1 letra maiúscula.'); return; }
    if (!checks.number) { showError('A senha deve conter pelo menos 1 número.'); return; }
    if (!checks.special) { showError('A senha deve conter pelo menos 1 caractere especial (!@#$%...).'); return; }
    if (!checks.match) { showError('As senhas não coincidem.'); return; }

    setLoading(true);
    const toastId = showLoading('Atualizando senha...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        dismissToast(toastId);
        showError('Sessão expirada. Por favor, faça login novamente.');
        navigate('/login');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      dismissToast(toastId);

      if (error) {
        showError(translateSupabaseError(error.message));
        return;
      }

      showSuccess('Senha atualizada com sucesso!');
      setPassword('');
      setConfirm('');
    } catch (err: any) {
      dismissToast(toastId);
      showError(translateSupabaseError(err.message || 'Erro ao atualizar a senha.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const Requirement = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${met ? 'text-emerald-600' : 'text-stone-400'}`}>
      {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Segurança da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nova Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {password.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-stone-50 rounded-xl border border-stone-100">
              <Requirement met={checks.length} label="8+ caracteres" />
              <Requirement met={checks.upper} label="Letra maiúscula" />
              <Requirement met={checks.number} label="Número" />
              <Requirement met={checks.special} label="Caractere especial" />
            </div>
          )}

          <div>
            <Label>Confirmar Nova Senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {confirm.length > 0 && !checks.match && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 mt-1.5">
                <X className="h-3.5 w-3.5" /> As senhas não coincidem
              </p>
            )}
            {checks.match && (
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 mt-1.5">
                <Check className="h-3.5 w-3.5" /> Senhas coincidem
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={loading || !allValid}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar Senha'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSecurity;
