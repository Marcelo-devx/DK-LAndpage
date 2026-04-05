import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from 'lucide-react';

const AgeVerificationPopup = () => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

    const checkVerification = () => {
      try {
        // Verifica localStorage (persistente) ou sessão
        if (localStorage.getItem('ageVerified') === 'true' || sessionStorage.getItem('age-verified-v2') === 'true') {
          setShouldShow(false);
          return;
        }

        // If the user returned recently from leaving the tab/app, treat as verified for session
        const leftAt = sessionStorage.getItem('left_at');
        if (leftAt) {
          const leftTs = Number(leftAt);
          if (!Number.isNaN(leftTs) && Date.now() - leftTs < THRESHOLD_MS) {
            try { sessionStorage.setItem('age-verified-v2', 'true'); } catch (e) { /* noop */ }
            try { window.dispatchEvent(new Event('ageVerified')); } catch (e) { /* noop */ }
            setShouldShow(false);
            sessionStorage.removeItem('left_at');
            return;
          }
        }

        // Verifica se vem de redirect externo (bypass automático)
        const path = window.location.pathname;
        if (
          path.startsWith('/auth/') ||
          path.startsWith('/login') ||
          path.startsWith('/update-password') ||
          path.startsWith('/complete-profile') ||
          path.startsWith('/confirmacao-pedido') ||
          path.startsWith('/compras')
        ) {
          // marcar como verificado (persistente e por sessão) e disparar evento
          try { localStorage.setItem('ageVerified', 'true'); } catch (e) { /* noop */ }
          try { sessionStorage.setItem('age-verified-v2', 'true'); } catch (e) { /* noop */ }
          try { window.dispatchEvent(new Event('ageVerified')); } catch (e) { /* noop */ }
          setShouldShow(false);
          return;
        }

        // Mostrar popup - primeira visita
        setShouldShow(true);
      } catch (error) {
        // Em caso de erro (ex: localStorage desabilitado), mostra o popup
        setShouldShow(true);
      }
    };

    checkVerification();

    const onVisibilityChange = () => {
      try {
        if (document.visibilityState === 'hidden') {
          // mark when user left the tab/app
          sessionStorage.setItem('left_at', String(Date.now()));
        } else if (document.visibilityState === 'visible') {
          // when coming back, re-run verification logic - but don't immediately re-show popup if recently left
          checkVerification();
        }
      } catch (e) {
        // noop
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleConfirm = () => {
    try { localStorage.setItem('ageVerified', 'true'); } catch (e) { /* noop */ }
    try { sessionStorage.setItem('age-verified-v2', 'true'); } catch (e) { /* noop */ }
    try { window.dispatchEvent(new Event('ageVerified')); } catch (e) { /* noop */ }
    setShouldShow(false);
  };

  const handleExit = () => {
    // Redireciona para fora do site
    window.location.href = 'https://www.google.com';
  };

  if (!shouldShow) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="w-[95vw] sm:max-w-md bg-slate-950 border-white/10 p-0 overflow-hidden rounded-[1.5rem] md:rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,1)] outline-none [&>button]:hidden z-[10001] max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby="age-verification-desc"
      >
        {/* Título e Descrição obrigatórios para acessibilidade, ocultos visualmente */}
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