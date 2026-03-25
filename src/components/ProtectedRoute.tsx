import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const TERMS_VERSION = "1.0";

const ProtectedRoute = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [needsTerms, setNeedsTerms] = useState(false);

  useEffect(() => {
    const checkTerms = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Se não estiver logado (convidado), não precisa verificar termos
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Verificar se o usuário aceitou os termos
        const { data: profile } = await supabase
          .from('profiles')
          .select('accepted_terms_version, accepted_terms_at')
          .eq('id', user.id)
          .single();

        // Se não aceitou ou aceitou uma versão antiga, precisa aceitar novamente
        const needsAcceptance = profile && 
          (!profile.accepted_terms_version || 
           profile.accepted_terms_version !== TERMS_VERSION);

        if (needsAcceptance) {
          setNeedsTerms(true);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('[ProtectedRoute] Erro ao verificar termos:', error);
        setIsLoading(false);
      }
    };

    checkTerms();
  }, [navigate]);

  // Se está carregando, mostra loader
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-off-white">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          <p className="text-sm text-slate-500">Verificando termos de uso...</p>
        </div>
      </div>
    );
  }

  // Se precisa aceitar os termos, mostra modal de aceitação
  if (needsTerms) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
            <div className="text-center space-y-2">
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-charcoal-gray">
                Termos de Uso
              </h2>
              <p className="text-sm text-slate-500">
                É necessário aceitar os termos para continuar navegando
              </p>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="font-black text-amber-800 mb-2">⚠️ Aviso Importante</p>
                <p>
                  Ao continuar, você declara que é maior de 18 anos e está ciente de que nossos produtos 
                  podem conter nicotina, que é uma substância causadora de dependência. Os produtos são 
                  destinados exclusivamente para uso por adultos.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-black uppercase tracking-tight">Termos de Uso</h3>
                <p>
                  A Loja DK CWB se compromete com a segurança de seus dados. Mantemos suas informações 
                  no mais absoluto sigilo! Todos os dados cadastrados (nome, endereço, CPF) nunca serão 
                  comercializados ou trocados.
                </p>
                <p>
                  Utilizamos cookies e informações de sua navegação com o objetivo de traçar um perfil 
                  do público que visita o site, conforme regulamentado pela Lei Geral de Proteção de Dados (LGPD).
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-black uppercase tracking-tight">Política de Privacidade</h3>
                <p>
                  Seus dados pessoais são fundamentais para que seu pedido chegue em segurança. Alguns dados, 
                  necessários para que empresas de logística e meios de pagamento possam realizar a cobrança 
                  e envio de seu pedido, serão divulgados para terceiros, quando tais informações forem 
                  necessárias para o processo de entrega e cobrança.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-stone-200">
              <button
                onClick={async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      await supabase.from('profiles').update({
                        accepted_terms_version: TERMS_VERSION,
                        accepted_terms_at: new Date().toISOString()
                      }).eq('id', user.id);
                      setNeedsTerms(false);
                    }
                  } catch (error) {
                    console.error('[ProtectedRoute] Erro ao aceitar termos:', error);
                    alert('Erro ao aceitar termos. Tente novamente.');
                  }
                }}
                className="w-full h-14 bg-sky-500 hover:bg-sky-600 text-white font-black uppercase tracking-widest text-sm rounded-2xl transition-all shadow-lg active:scale-95"
              >
                Li e Aceito os Termos
              </button>
              
              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full h-12 bg-stone-100 hover:bg-stone-200 text-slate-600 font-bold uppercase text-xs tracking-widest rounded-2xl transition-all"
              >
                Sair da Conta
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
