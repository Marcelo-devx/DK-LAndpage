import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ShoppingBag, ShoppingCart } from 'lucide-react';

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
  
  const [displayDuration, setDisplayDuration] = useState(6000);
  const [displayInterval, setDisplayInterval] = useState(10000);
  
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    const fetchData = async () => {
      try {
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

        const { data, error } = await supabase
          .from('sales_popups')
          .select('id, customer_name, product_name, product_image_url, time_ago')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) { console.error("Error fetching sales popups:", error); return; }
        if (data && data.length > 0) {
          setItems(data);
          setTimeout(() => setIsVisible(true), 3000);
        }
      } catch (error) {
        console.error("Error in SocialProofPopup:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (items.length === 0 || !isVisible) return;
    const t = setTimeout(() => setIsVisible(false), displayDuration);
    return () => clearTimeout(t);
  }, [isVisible, items.length, displayDuration]);

  useEffect(() => {
    if (items.length === 0 || isVisible) return;
    const t = setTimeout(() => {
      setCurrentItemIndex(i => (i + 1) % items.length);
      setIsVisible(true);
    }, displayInterval);
    return () => clearTimeout(t);
  }, [isVisible, items.length, displayInterval]);

  if (items.length === 0) return null;

  const currentItem = items[currentItemIndex];

  return (
    <AnimatePresence>
      {isVisible && currentItem && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-5 left-4 right-4 md:left-5 md:right-auto md:w-[300px] z-[45]"
        >
          {/* Card */}
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden flex items-stretch">

            {/* Barra lateral colorida */}
            <div className="w-1 shrink-0 bg-gradient-to-b from-sky-400 to-indigo-500 rounded-l-2xl" />

            {/* Imagem do produto */}
            <div className="shrink-0 w-[68px] h-[68px] m-3 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-100">
              {currentItem.product_image_url ? (
                <img
                  src={currentItem.product_image_url}
                  alt={currentItem.product_name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=DK';
                  }}
                />
              ) : (
                <ShoppingBag className="h-6 w-6 text-sky-400" />
              )}
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0 py-3 pr-8">
              {/* Badge */}
              <div className="flex items-center gap-1 mb-1">
                <ShoppingCart className="h-3 w-3 text-sky-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-sky-500">
                  Compra realizada
                </span>
              </div>
              <p className="text-sm font-black text-slate-800 truncate leading-tight">
                {currentItem.customer_name}
              </p>
              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                {currentItem.product_name}
              </p>
            </div>

            {/* Fechar */}
            <button
              onClick={() => setIsVisible(false)}
              className="absolute top-2 right-2 p-1 rounded-full text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SocialProofPopup;
