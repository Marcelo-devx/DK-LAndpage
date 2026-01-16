import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const WhatsAppButton = () => {
  // Inicializa com um valor padrão para garantir que renderize imediatamente (fallback visual)
  // O useEffect irá substituir isso pelo valor real do banco de dados em instantes
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>('5541999999999');

  useEffect(() => {
    const fetchWhatsApp = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'whatsapp_contact_number')
        .single();
      
      if (data?.value) {
        setWhatsappNumber(data.value);
      } else {
        console.log("WhatsApp number not set in DB, using default.");
      }
    };

    fetchWhatsApp();
  }, []);

  if (!whatsappNumber) return null;

  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}`;

  return (
    <a
      href={whatsappUrl}
      // Removido target="_blank" para forçar o redirecionamento na mesma página
      // Isso evita popups em branco em webviews ou navegadores restritos
      className={cn(
        "fixed bottom-6 right-6 z-[100]", // Z-Index alto para ficar acima de tudo
        "bg-[#25D366] hover:bg-[#128C7E] text-white",
        "p-4 rounded-full shadow-[0_10px_25px_-5px_rgba(37,211,102,0.4)]",
        "transition-all duration-300 hover:scale-110 active:scale-95 group",
        "flex items-center justify-center animate-in fade-in zoom-in duration-500", // Animação de entrada
        "cursor-pointer"
      )}
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="h-7 w-7 fill-current" />
      
      {/* Tooltip flutuante à esquerda */}
      <span className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
        Suporte Online
      </span>
    </a>
  );
};

export default WhatsAppButton;