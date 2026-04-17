import { useEffect, useState, useRef } from 'react';
import { WifiOff, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Testa se consegue alcançar o Supabase fazendo uma query leve
async function testSupabaseConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    const { error } = await supabase
      .from('app_settings')
      .select('key')
      .limit(1)
      .abortSignal(controller.signal);
    clearTimeout(timeout);
    // Se não houve erro de rede (erro de permissão é ok — significa que chegou no servidor)
    if (!error || error.code !== 'PGRST') return true;
    return !error || error.message?.toLowerCase().includes('permission') || (error.code?.startsWith('PGRST') ?? false);
  } catch {
    return false;
  }
}

const NetworkErrorBanner = () => {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    // Primeiro checa o navigator.onLine (rápido, síncrono)
    if (!navigator.onLine) {
      setShow(true);
      checkingRef.current = false;
      return;
    }

    // Depois testa conexão real com o Supabase
    const ok = await testSupabaseConnection();
    if (!ok) {
      setShow(true);
    } else {
      setShow(false);
      setDismissed(false);
    }
    checkingRef.current = false;
  };

  useEffect(() => {
    // Aguarda 3s após montar para não atrapalhar o carregamento inicial
    const initialDelay = setTimeout(() => {
      check();
      // Verifica a cada 30s
      intervalRef.current = setInterval(check, 30000);
    }, 3000);

    const handleOffline = () => setShow(true);
    const handleOnline = () => check(); // quando volta online, testa de verdade

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(initialDelay);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[95vw] max-w-lg animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-4 text-white">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-500/20 rounded-lg shrink-0">
              <WifiOff className="h-4 w-4 text-red-400" />
            </div>
            <p className="text-sm font-black uppercase tracking-wide text-red-400">
              Problema de Conexão
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mensagem */}
        <p className="text-sm text-slate-300 leading-relaxed mb-3">
          Seu <span className="text-white font-bold">WiFi está bloqueando</span> o acesso à loja.
          Isso é comum em algumas redes domésticas.
        </p>

        {/* Soluções */}
        <div className="space-y-2 mb-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">O que fazer:</p>

          <div className="flex items-start gap-2">
            <span className="text-sky-400 font-black text-xs shrink-0 mt-0.5">1.</span>
            <p className="text-xs text-slate-300">
              <span className="text-white font-bold">Desative o WiFi</span> e use os dados móveis (4G/5G) para acessar normalmente.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-sky-400 font-black text-xs shrink-0 mt-0.5">2.</span>
            <p className="text-xs text-slate-300">
              <span className="text-white font-bold">Reinicie o roteador</span> e tente novamente.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-sky-400 font-black text-xs shrink-0 mt-0.5">3.</span>
            <p className="text-xs text-slate-300">
              No celular: <span className="text-white font-bold">Configurações → WiFi → DNS Privado</span> → digite <span className="font-mono text-sky-400 font-bold">dns.google</span> e salve.
            </p>
          </div>
        </div>

        {/* Botão retry */}
        <button
          onClick={() => { setDismissed(false); check(); }}
          className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase text-[11px] tracking-widest h-10 rounded-xl transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Testar Conexão Novamente
        </button>
      </div>
    </div>
  );
};

export default NetworkErrorBanner;
