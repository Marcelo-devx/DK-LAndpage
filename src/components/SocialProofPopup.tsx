import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface FishingDisplayItem {
  id: number;
  customer_name: string;
  product_name: string;
  product_image_url: string | null;
  time_ago: string;
}

const SocialProofPopup = () => {
  const [items, setItems] = useState<FishingDisplayItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from('display_de_pesca')
        .select('id, customer_name, product_name, product_image_url, time_ago')
        .eq('is_active', true);

      if (error) {
        console.error("Error fetching social proof items:", error);
      } else if (data && data.length > 0) {
        setItems(data.sort(() => 0.5 - Math.random()));
        // Show the first popup shortly after the page loads
        setTimeout(() => setIsVisible(true), 3000);
      }
    };

    fetchItems();
  }, []);

  useEffect(() => {
    if (items.length === 0 || !isVisible) return;

    // Timer to hide the current popup
    const hideTimeout = setTimeout(() => {
      setIsVisible(false);
    }, 5000); // Visible for 5 seconds

    return () => clearTimeout(hideTimeout);
  }, [isVisible, items.length]);

  useEffect(() => {
    if (items.length === 0) return;

    // When not visible, wait to show the next one
    if (!isVisible) {
      const nextPopupTimeout = setTimeout(() => {
        setCurrentItemIndex((prevIndex) => (prevIndex + 1) % items.length);
        setIsVisible(true);
      }, 8000); // Wait 8 seconds before showing the next one

      return () => clearTimeout(nextPopupTimeout);
    }
  }, [isVisible, items.length]);

  if (items.length === 0) {
    return null;
  }

  const currentItem = items[currentItemIndex];

  return (
    <AnimatePresence>
      {isVisible && currentItem && (
        <motion.div
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed bottom-5 left-5 bg-slate-900/90 backdrop-blur-md rounded-xl shadow-2xl p-4 w-80 z-50 flex items-start space-x-4 border border-white/10"
        >
          {currentItem.product_image_url && (
            <img
              src={currentItem.product_image_url}
              alt={currentItem.product_name}
              className="w-16 h-16 object-cover rounded-md border border-white/5"
            />
          )}
          <div className="flex-1">
            <p className="text-xs text-slate-400">
              <span className="font-bold text-sky-400">{currentItem.customer_name}</span> {currentItem.time_ago}
            </p>
            <p className="font-bold text-slate-100 mt-1 text-sm leading-tight">{currentItem.product_name}</p>
          </div>
          <button onClick={() => setIsVisible(false)} className="text-slate-500 hover:text-white absolute top-2 right-2 transition-colors">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SocialProofPopup;