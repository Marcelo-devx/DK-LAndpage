import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';

const WhatsAppButton = () => {
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWhatsAppButton, setShowWhatsAppButton] = useState<boolean>(true); // default: visible

  useEffect(() => {
    const fetchWhatsApp = async () => {
      const [{ data: numRow }, { data: settingRow }] = await Promise.all([
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'whatsapp_contact_number')
          .single(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'show_whatsapp_button')
          .single(),
      ]);

      if (numRow?.value) {
        setWhatsappNumber(numRow.value);
      }

      // If the setting exists and is explicitly 'false', hide the button
      if (settingRow && typeof settingRow.value === 'string') {
        const val = settingRow.value.trim().toLowerCase();
        setShowWhatsAppButton(val !== 'false' && val !== '0');
      }
    };

    fetchWhatsApp();
  }, []);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);

    try {
        // 1. Dispara o Webhook para o Robô
        const { error } = await supabase.functions.invoke('trigger-integration', {
            body: { 
                event_type: 'support_contact_clicked',
                payload: { origin: 'floating_button' }
            }
        });

        if (error) throw error;

        // 2. Feedback visual para o usuário (sem redirecionar)
        showSuccess("Solicitação enviada! Nosso assistente entrará em contato pelo WhatsApp em instantes.");

    } catch (error) {
        console.error("Erro ao disparar webhook:", error);
        showError("Não foi possível solicitar o suporte automático no momento.");
    } finally {
        setLoading(false);
    }
  };

  // If not configured or setting hides it, don't render the button
  if (!whatsappNumber || !showWhatsAppButton) return null;

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
      aria-label="Solicitar Suporte no WhatsApp"
    >
      {loading ? (
        <Loader2 className="h-7 w-7 animate-spin" />
      ) : (
        <MessageCircle className="h-7 w-7 fill-current" />
      )}
      
      {/* Tooltip flutuante */}
      <span className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
        {loading ? 'Chamando Assistente...' : 'Suporte Online'}
      </span>
    </button>
  );
};

export default WhatsAppButton;