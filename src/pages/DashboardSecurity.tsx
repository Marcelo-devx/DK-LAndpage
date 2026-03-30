import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

const DashboardSecurity = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    if (password.length < 8) { showError('A senha deve ter pelo menos 8 caracteres.'); return false; }
    if (!/[A-Z]/.test(password)) { showError('A senha deve conter pelo menos 1 letra maiúscula.'); return false; }
    if (!/\d/.test(password)) { showError('A senha deve conter pelo menos 1 número.'); return false; }
    if (!/[^A-Za-z0-9]/.test(password)) { showError('A senha deve conter pelo menos 1 caractere especial.'); return false; }
    if (password !== confirm) { showError('As senhas não coincidem.'); return false; }
    return true;
  };

  const handleChangePassword = async () => {
    if (!validate()) return;
    setLoading(true);
    const toastId = showLoading('Atualizando senha...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Sessão expirada. Por favor, faça login novamente.');
        navigate('/login');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      dismissToast(toastId);
      showSuccess('Senha atualizada com sucesso!');
      setPassword(''); setConfirm('');
    } catch (err: any) {
      dismissToast(toastId);
      showError(err.message || 'Erro ao atualizar a senha.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
          <div>
            <Label>Confirmar Nova Senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar Senha'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSecurity;