import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert } from 'lucide-react';

const AgeVerificationPopup = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Alterei a chave para 'v2' para garantir que apareça novamente para você testar
    const isVerified = sessionStorage.getItem('age-verified-v2');
    if (!isVerified) {
      setIsOpen(true);
    }
  }, []);

  const handleConfirm = () => {
    sessionStorage.setItem('age-verified-v2', 'true');
    setIsOpen(false);
  };

  const handleExit = () => {
    window.location.href = 'https://www.google.com';
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[95vw] sm:max-w-md bg-slate-950 border-white/10 p-0 overflow-hidden rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,1)] outline-none [&>button]:hidden z-[150]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="h-2 bg-gradient-to-r from-red-600 via-sky-500 to-red-600 w-full shrink-0 animate-pulse" />
        
        <div className="p-8 md:p-10 text-center space-y-8">
          <div className="flex justify-center">
            <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
              <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tighter italic uppercase text-white">
              VERIFICAÇÃO DE <span className="text-sky-500">IDADE.</span>
            </h2>
            <div className="space-y-2">
                <p className="text-slate-400 font-medium text-sm leading-relaxed">
                Este site contém produtos destinados apenas a maiores de <strong className="text-white">18 anos</strong>. 
                </p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    A venda e o consumo de tabaco são restritos por lei.
                </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Button 
              onClick={handleConfirm}
              className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95"
            >
              SIM, TENHO +18 ANOS
            </Button>
            <Button 
              variant="outline"
              onClick={handleExit}
              className="border-white/10 hover:bg-red-500/10 hover:text-red-500 text-slate-400 font-black uppercase tracking-widest h-14 rounded-xl transition-all"
            >
              NÃO, QUERO SAIR
            </Button>
          </div>

          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
            DKCWB © {new Date().getFullYear()} - ACESSO RESTRITO
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgeVerificationPopup;