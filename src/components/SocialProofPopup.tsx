import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ShoppingBag } from 'lucide-react';

interface SalesPopupItem {
  id: number;
  customer_name: string;
  product_name: string;
  product_image_url: string | null;
  time_ago: string;
}

const SocialProofPopup = () => {
  const [items, setItems] = useState<SalesPopupItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  
  // Estados para os tempos vindo do banco (em milissegundos)
  const [displayDuration, setDisplayDuration] = useState(6000); // Tempo visível
  const [displayInterval, setDisplayInterval] = useState(10000); // Tempo entre popups

  useEffect(() => {
    const fetchData = async () => {
      // 1. Busca as configurações de tempo
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .or('key.eq.sales_popup_duration,key.eq.sales_popup_interval');

      if (settings) {
        const duration = settings.find(s => s.key === 'sales_popup_duration');
        const interval = settings.find(s => s.key === 'sales_popup_interval');
        
        if (duration?.value) setDisplayDuration(parseInt(duration.value) * 1000);
        if (interval?.value) setDisplayInterval(parseInt(interval.value) * 1000);
      }

      // 2. Busca as vendas recentes
      const { data, error } = await supabase
        .from('sales_popups')
        .select('id, customer_name, product_name, product_image_url, time_ago')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching sales popups:", error);
        return;
      }

      if (data && data.length > 0) {
        setItems(data);
        // Inicia a exibição após um breve delay inicial fixo
        setTimeout(() => setIsVisible(true), 3000);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (items.length === 0 || !isVisible) return;

    // O popup fica visível pelo tempo definido no banco
    const hideTimeout = setTimeout(() => {
      setIsVisible(false);
    }, displayDuration);

    return () => clearTimeout(hideTimeout);
  }, [isVisible, items.length, displayDuration]);

  useEffect(() => {
    if (items.length === 0) return;

    if (!isVisible) {
      // Espera o intervalo definido no banco antes de mostrar o próximo
      const nextPopupTimeout = setTimeout(() => {
        setCurrentItemIndex((prevIndex) => (prevIndex + 1) % items.length);
        setIsVisible(true);
      }, displayInterval);

      return () => clearTimeout(nextPopupTimeout);
    }
  }, [isVisible, items.length, displayInterval]);

  if (items.length === 0) return null;

  const currentItem = items[currentItemIndex];

  return (
    <AnimatePresence>
      {isVisible && currentItem && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: -20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className="fixed bottom-6 left-6 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 w-[320px] z-[45] flex items-center space-x-4 border border-white/10"
        >
          <div className="shrink-0 w-16 h-16 bg-white/5 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center">
            {currentItem.product_image_url ? (
              <img
                src={currentItem.product_image_url}
                alt={currentItem.product_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=DKCWB';
                }}
              />
            ) : (
              <ShoppingBag className="h-6 w-6 text-sky-400" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-sky-400 font-black uppercase tracking-widest mb-1">
              Nova Venda!
            </p>
            <p className="text-sm font-black text-white truncate">
              {currentItem.customer_name}
            </p>
            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-tight">
              {currentItem.product_name}
            </p>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
              há {currentItem.time_ago}
            </p>
          </div>

          <button 
            onClick={() => setIsVisible(false)} 
            className="text-slate-500 hover:text-white absolute top-2 right-2 p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SocialProofPopup;