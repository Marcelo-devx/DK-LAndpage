import { Link } from 'react-router-dom';
import { Gem } from 'lucide-react';
import { cn } from '@/lib/utils';

const LoyaltyButton = () => {
  return (
    <Link
      to="/dashboard"
      className={cn(
        "fixed bottom-28 right-6 z-[100]", // Posicionado acima do WhatsApp (que fica no bottom-6)
        "bg-slate-900 hover:bg-slate-800 text-sky-400", // Estilo Dark Premium
        "p-4 rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)]", // Sombra forte
        "transition-all duration-300 hover:scale-110 active:scale-95 group",
        "flex items-center justify-center animate-in fade-in zoom-in duration-500 delay-100", // Animação de entrada
        "cursor-pointer border-2 border-sky-500/20" // Borda sutil
      )}
      aria-label="Acessar DK Clube"
    >
      <Gem className="h-6 w-6" /> {/* Ícone ligeiramente menor para hierarquia visual */}
      
      {/* Tooltip flutuante à esquerda (agora que o botão está na direita) */}
      <span className="absolute right-full mr-4 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-stone-100">
        DK Clube
      </span>
      
      {/* Efeito de Ping */}
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
      </span>
    </Link>
  );
};

export default LoyaltyButton;