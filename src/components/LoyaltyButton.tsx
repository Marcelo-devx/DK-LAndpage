import { Link } from 'react-router-dom';
import { Gem } from 'lucide-react';
import { cn } from '@/lib/utils';

const LoyaltyButton = () => {
  return (
    <Link
      to="/dashboard"
      className={cn(
        "fixed bottom-28 right-6 z-[100]", // Posicionado acima do WhatsApp (que fica no bottom-6)
        "bg-sky-500 hover:bg-sky-400 text-white", // Azul Sky (Identidade do Clube conforme imagem)
        "p-4 rounded-full shadow-[0_10px_25px_-5px_rgba(14,165,233,0.5)]", // Sombra azulada (Glow)
        "transition-all duration-300 hover:scale-110 active:scale-95 group",
        "flex items-center justify-center animate-in fade-in zoom-in duration-500 delay-100", // Animação de entrada
        "cursor-pointer border-2 border-white/20" // Borda sutil para destaque
      )}
      aria-label="Acessar DK Clube"
    >
      <Gem className="h-6 w-6" />
      
      {/* Tooltip flutuante à esquerda */}
      <span className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-stone-100">
        DK Clube
      </span>
      
      {/* Efeito de Ping (Ponto de atenção) */}
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-50"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-200"></span>
      </span>
    </Link>
  );
};

export default LoyaltyButton;