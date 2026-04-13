import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Página utilitária para admin disparar reset de senha de um usuário.
 * Acesse: /admin/reset-senha?email=EMAIL_DO_CLIENTE
 */
const AdminResetUserPassword = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!email) {
      setStatus('error');
      setMessage('Nenhum e-mail informado na URL. Use ?email=EMAIL_DO_CLIENTE');
      return;
    }

    const doReset = async () => {
      try {
        const res = await supabase.functions.invoke('forgot-password', {
          body: { email: email.trim().toLowerCase() },
        });

        if (res.error) {
          setStatus('error');
          setMessage(res.error.message || 'Erro ao enviar nova senha.');
          return;
        }

        setStatus('success');
        setMessage(`Nova senha temporária enviada com sucesso para ${email}! O cliente receberá o e-mail em instantes e poderá fazer login e criar sua senha pessoal.`);
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'Erro inesperado ao processar o reset.');
      }
    };

    doReset();
  }, [email]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/50 border border-white/10 rounded-2xl p-8 text-center space-y-5">

        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-sky-400 mx-auto" />
            <div>
              <p className="text-white font-bold text-lg">Processando...</p>
              <p className="text-slate-400 text-sm mt-1">Gerando nova senha temporária para <span className="text-sky-400 font-medium">{email}</span></p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <div>
              <p className="text-white font-bold text-lg">Senha enviada!</p>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">{message}</p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-400 mx-auto" />
            <div>
              <p className="text-white font-bold text-lg">Erro</p>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">{message}</p>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button asChild variant="outline" className="border-white/10 text-slate-300 hover:text-white rounded-xl">
            <Link to="/admin/usuarios">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Ir para Gerenciar Usuários
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminResetUserPassword;
