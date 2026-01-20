import { Link } from 'react-router-dom';
import { Gem } from 'lucide-react';
import { cn } from '@/lib/utils';

const LoyaltyButton = () => {
  return (
    <Link
      to="/dashboard"
      className={cn(
        "fixed bottom-6 left-6 z-[100]", // Canto Inferior Esquerdo
        "bg-slate-900 hover:bg-slate-800 text-sky-400", // Estilo Dark Premium
        "p-4 rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)]", // Sombra forte
        "transition-all duration-300 hover:scale-110 active:scale-95 group",
        "flex items-center justify-center animate-in fade-in zoom-in duration-500 delay-100", // Animação de entrada
        "cursor-pointer border-2 border-sky-500/20" // Borda sutil
      )}
      aria-label="Acessar DK Clube"
    >
      <Gem className="h-7 w-7" />
      
      {/* Tooltip flutuante à direita */}
      <span className="absolute left-full ml-4 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-stone-100">
        DK Clube
      </span>
      
      {/* Efeito de Ping para chamar atenção (opcional, removível se achar muito invasivo) */}
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
      </span>
    </Link>
  );
};

export default LoyaltyButton;