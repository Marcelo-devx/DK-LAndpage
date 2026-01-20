import { Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LoyaltyWidget from './LoyaltyWidget';

const LoyaltyButton = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "fixed bottom-28 right-6 z-[100]", // Posicionado acima do WhatsApp
            "bg-black hover:bg-slate-900 text-white", 
            "p-4 rounded-full shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)]",
            "transition-all duration-300 hover:scale-110 active:scale-95 group",
            "flex items-center justify-center animate-in fade-in zoom-in duration-500 delay-100",
            "cursor-pointer border-2 border-white/10 ring-2 ring-black/5"
          )}
          aria-label="Acessar DK Clube Points"
        >
          <Gem className="h-6 w-6 text-sky-400" />
          
          {/* Tooltip flutuante à esquerda */}
          <span className="absolute right-full mr-4 bg-white text-charcoal-gray text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-stone-100">
            Meus Pontos
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[350px] p-0 mr-4 rounded-2xl overflow-hidden border-none shadow-2xl h-[550px] animate-in slide-in-from-right-5 duration-300" 
        side="left" 
        align="end"
        sideOffset={5}
      >
        <LoyaltyWidget />
      </PopoverContent>
    </Popover>
  );
};

export default LoyaltyButton;