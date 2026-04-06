import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const THRESHOLD_MS = 10 * 60 * 1000; // 10 minutos

const isAlreadyVerified = (): boolean => {
  try {
    return (
      localStorage.getItem('ageVerified') === 'true' ||
      sessionStorage.getItem('age-verified-v2') === 'true'
    );
  } catch {
    return false;
  }
};

const markVerified = () => {
  try { localStorage.setItem('ageVerified', 'true'); } catch { /* noop */ }
  try { sessionStorage.setItem('age-verified-v2', 'true'); } catch { /* noop */ }
};

const checkReturnedFromTab = (): boolean => {
  try {
    const leftAt = sessionStorage.getItem('left_at');
    if (!leftAt) return false;
    const leftTs = Number(leftAt);
    if (Number.isNaN(leftTs)) return false;
    if (Date.now() - leftTs < THRESHOLD_MS) {
      markVerified();
      try { sessionStorage.removeItem('left_at'); } catch { /* noop */ }
      return true;
    }
  } catch { /* noop */ }
  return false;
};

const isExemptRoute = (): boolean => {
  const path = window.location.pathname;
  return (
    path.startsWith('/auth/') ||
    path.startsWith('/login') ||
    path.startsWith('/update-password') ||
    path.startsWith('/complete-profile') ||
    path.startsWith('/confirmacao-pedido') ||
    path.startsWith('/compras')
  );
};

const AgeVerificationPopup = () => {
  const { loading: authLoading, user } = useAuth();
  // null = aguardando resolução do auth, false = não mostrar, true = mostrar
  const [showState, setShowState] = useState<null | boolean>(null);

  useEffect(() => {
    // ── Verificações síncronas rápidas ──────────────────────────────────────
    if (isAlreadyVerified()) { setShowState(false); return; }
    if (checkReturnedFromTab()) {
      try { window.dispatchEvent(new Event('ageVerified')); } catch { /* noop */ }
      setShowState(false);
      return;
    }
    if (isExemptRoute()) {
      markVerified();
      try { window.dispatchEvent(new Event('ageVerified')); } catch { /* noop */ }
      setShowState(false);
      return;
    }

    // ── Verificação via AuthContext (useAuth) ────────────────────────────────
    // O AuthContext gerencia o estado de autenticação de forma centralizada.
    // Usamos user e loading do useAuth() para evitar race conditions.
    
    // Fallback: se o auth demorar mais de 4s, mostra o popup para não travar a UI
    const fallbackTimer = setTimeout(() => {
      setShowState(true);
    }, 4000);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [user, authLoading]);

  // Atualiza showState quando a resolução do auth muda (sem depender de showState)
  useEffect(() => {
    if (authLoading) return; // ainda resolvendo

    if (user) {
      // Usuário logado — já confirmou +18 ao criar a conta
      markVerified();
      setShowState(false);
      // Dispara o evento somente após o modal ter fechado (pequeno delay)
      setTimeout(() => {
        try { window.dispatchEvent(new Event('ageVerified')); } catch { /* noop */ }
      }, 200);
    } else {
      // Visitante anônimo — mostrar popup
      setShowState(true);
    }
  }, [authLoading, user]);

  const handleConfirm = () => {
    // Fecha o modal imediatamente
    setShowState(false);

    // Marcar verificado e notificar após um pequeno delay para evitar sobreposição
    setTimeout(() => {
      markVerified();
      try { window.dispatchEvent(new Event('ageVerified')); } catch { /* noop */ }
    }, 200);
  };

  const handleExit = () => {
    window.location.href = 'https://www.google.com';
  };

  // null = aguardando auth (não renderiza nada, não bloqueia a UI)
  // false = verificado, não mostrar
  // true = mostrar popup
  if (showState !== true) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="w-[95vw] sm:max-w-md bg-slate-950 border-white/10 p-0 overflow-hidden rounded-[1.5rem] md:rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,1)] outline-none [&>button]:hidden z-[10001] max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby="age-verification-desc"
      >
        <DialogTitle className="sr-only">Verificação de Idade</DialogTitle>
        <DialogDescription className="sr-only">
          Confirme se você tem mais de 18 anos para acessar o site.
        </DialogDescription>

        <div className="h-1.5 bg-gradient-to-r from-red-600 via-sky-500 to-red-600 w-full shrink-0 animate-pulse" />

        <div className="p-4 md:p-10 text-center space-y-4 md:space-y-8">
          <div className="flex justify-center">
            <div className="p-2.5 md:p-4 bg-red-500/10 rounded-full border border-red-500/20">
              <ShieldAlert className="h-8 w-8 md:h-12 md:w-12 text-red-500 shrink-0" />
            </div>
          </div>

          <div className="space-y-2 md:space-y-4">
            <h2 className="text-xl md:text-3xl font-black tracking-tighter italic uppercase text-white leading-tight">
              VERIFICAÇÃO DE <span className="text-sky-500">IDADE.</span>
            </h2>
            <div className="space-y-1.5 md:space-y-2" id="age-verification-desc">
              <p className="text-slate-400 font-medium text-xs md:text-sm leading-relaxed px-2 md:px-0">
                Este site contém produtos destinados apenas a maiores de <strong className="text-white">18 anos</strong>.
              </p>
              <p className="text-[10px] md:text-xs text-slate-700 font-bold uppercase tracking-widest px-2 md:px-0">
                A venda e o consumo de tabaco são restritos por lei.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:gap-4">
            <Button
              onClick={handleConfirm}
              className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-12 md:h-14 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95 text-xs md:text-base px-4"
            >
              SIM, TENHO +18 ANOS
            </Button>
            <Button
              variant="outline"
              onClick={handleExit}
              className="border-white/10 hover:bg-red-500/10 hover:text-red-500 text-slate-400 font-black uppercase tracking-widest h-12 md:h-14 rounded-xl transition-all text-xs md:text-base px-4"
            >
              NÃO, QUERO SAIR
            </Button>
          </div>

          <p className="text-[9px] md:text-[10px] text-slate-600 font-bold uppercase tracking-[0.15em] md:tracking-[0.2em]">
            DKCWB © {new Date().getFullYear()} - ACESSO RESTRITO
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgeVerificationPopup;