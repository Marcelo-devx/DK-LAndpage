import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import {
  Search, RefreshCw, Mail, User, Phone, ShieldAlert,
  CheckCircle2, XCircle, Loader2, AlertTriangle, KeyRound
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  must_change_password: boolean;
  is_blocked: boolean;
  role: string;
  created_at: string;
  last_sign_in_at?: string;
}

const AdminUsers = () => {
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [userFound, setUserFound] = useState<UserProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const handleSearch = async () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email) {
      showError('Informe um e-mail para buscar.');
      return;
    }

    setSearching(true);
    setUserFound(null);
    setNotFound(false);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, phone, must_change_password, is_blocked, role, created_at')
        .eq('email', email)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setUserFound(data as UserProfile);
      }
    } catch (err) {
      showError('Erro ao buscar usuário.');
    } finally {
      setSearching(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userFound) return;

    setSendingReset(true);
    const toastId = showLoading('Enviando nova senha temporária...');

    try {
      const res = await supabase.functions.invoke('forgot-password', {
        body: { email: userFound.email },
      });

      dismissToast(toastId);

      if (res.error) {
        showError(res.error.message || 'Erro ao enviar nova senha.');
        return;
      }

      showSuccess(`Nova senha temporária enviada para ${userFound.email}!`);

      // Atualiza o estado local para refletir que must_change_password foi setado
      setUserFound(prev => prev ? { ...prev, must_change_password: true } : prev);

    } catch (err: any) {
      dismissToast(toastId);
      showError(err?.message || 'Erro inesperado.');
    } finally {
      setSendingReset(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black italic uppercase text-white tracking-tighter">
            Gerenciar Usuários<span className="text-sky-500">.</span>
          </h1>
          <p className="text-slate-400 text-sm">Busque um cliente pelo e-mail para visualizar e gerenciar sua conta.</p>
        </div>

        {/* Search */}
        <Card className="bg-slate-900/50 border border-white/10 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="email@cliente.com"
                value={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.value);
                  setNotFound(false);
                  setUserFound(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-11 bg-slate-950 border-white/10 text-white rounded-xl focus:border-sky-500"
              />
              <Button
                onClick={handleSearch}
                disabled={searching}
                className="h-11 px-5 bg-sky-500 hover:bg-sky-400 font-bold uppercase tracking-widest text-xs rounded-xl shrink-0"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Not found */}
        {notFound && (
          <Card className="bg-red-950/30 border border-red-500/30 rounded-2xl">
            <CardContent className="p-5 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm font-medium">Nenhum usuário encontrado com este e-mail.</p>
            </CardContent>
          </Card>
        )}

        {/* User found */}
        {userFound && (
          <Card className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-white/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-sky-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base font-bold">
                      {userFound.first_name} {userFound.last_name}
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs mt-0.5">
                      {userFound.email}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {userFound.role === 'adm' && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] font-bold uppercase">Admin</Badge>
                  )}
                  {userFound.is_blocked && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px] font-bold uppercase">Bloqueado</Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Telefone</p>
                  <p className="text-white text-sm font-medium flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {userFound.phone || '—'}
                  </p>
                </div>
                <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Cadastro</p>
                  <p className="text-white text-sm font-medium">{formatDate(userFound.created_at)}</p>
                </div>
              </div>

              {/* must_change_password status */}
              <div className={`rounded-xl p-4 border flex items-start gap-3 ${
                userFound.must_change_password
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}>
                {userFound.must_change_password ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-300 font-bold text-sm">Troca de senha pendente</p>
                      <p className="text-amber-400/70 text-xs mt-0.5">
                        O cliente precisa trocar a senha mas ainda não recebeu ou não conseguiu usar o e-mail com a senha temporária.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-emerald-300 font-bold text-sm">Senha OK</p>
                      <p className="text-emerald-400/70 text-xs mt-0.5">O cliente possui senha própria configurada.</p>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Ações</p>

                <Button
                  onClick={handleResetPassword}
                  disabled={sendingReset}
                  className="w-full h-11 bg-sky-500 hover:bg-sky-400 font-bold uppercase tracking-widest text-xs rounded-xl gap-2"
                >
                  {sendingReset ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Mail className="h-4 w-4" /> Enviar Nova Senha Temporária por E-mail</>
                  )}
                </Button>

                <p className="text-xs text-slate-500 text-center">
                  Isso vai gerar uma nova senha temporária e enviar para o e-mail do cliente. Ele precisará trocá-la no primeiro acesso.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
