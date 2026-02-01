import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const WhatsAppButton = () => {
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchWhatsApp = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'whatsapp_contact_number')
        .single();
      
      if (data?.value) {
        setWhatsappNumber(data.value);
      }
    };

    fetchWhatsApp();
  }, []);

  const handleClick = async () => {
    if (!whatsappNumber) return;
    setLoading(true);

    try {
        // 1. Dispara o Webhook para o Robô (silenciosamente)
        await supabase.functions.invoke('trigger-integration', {
            body: { 
                event_type: 'support_contact_clicked',
                payload: { origin: 'floating_button' }
            }
        });
    } catch (error) {
        console.error("Erro ao disparar webhook:", error);
        // Não impede o usuário de abrir o whats se o webhook falhar
    }

    // 2. Redireciona para o WhatsApp com a mensagem padrão "Olá"
    const message = encodeURIComponent("Olá");
    const url = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${message}`;
    
    setLoading(false);
    window.open(url, '_blank');
  };

  if (!whatsappNumber) return null;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "fixed bottom-6 right-6 z-[100]", // Z-Index alto
        "bg-[#25D366] hover:bg-[#128C7E] text-white",
        "p-4 rounded-full shadow-[0_10px_25px_-5px_rgba(37,211,102,0.4)]",
        "transition-all duration-300 hover:scale-110 active:scale-95 group",
        "flex items-center justify-center animate-in fade-in zoom-in duration-500",
        "cursor-pointer border-none outline-none"
      )}
      aria-label="Falar no WhatsApp"
    >
      {loading ? (
        <Loader2 className="h-7 w-7 animate-spin" />
      ) : (
        <MessageCircle className="h-7 w-7 fill-current" />
      )}
      
      {/* Tooltip flutuante */}
      <span className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
        Suporte Online
      </span>
    </button>
  );
};

export default WhatsAppButton;