import { Outlet, useOutletContext } from "react-router-dom";
import Header from "./Header";
import { useState, memo, useCallback, lazy, Suspense, useEffect } from "react";
import CategoryProductsModal from "./CategoryProductsModal";
import BrandProductsModal from "./BrandProductsModal";
import { CartSheet } from "./CartSheet";
import Footer from "./Footer";
import DeliveryTimerBar from "./DeliveryTimerBar";
import NetworkErrorBanner from "./NetworkErrorBanner";
import WhatsAppButton from "./WhatsAppButton";
import NeighborhoodBlockedModal from "./NeighborhoodBlockedModal";

// Lazy load de componentes não-críticos — tira framer-motion do bundle inicial
const SocialProofPopup = lazy(() => import("./SocialProofPopup"));

export interface OutletContextType {
  handleCategoryClick: (categoryName: string) => void;
  handleBrandClick: (brandName: string) => void;
}

export const useAppOutletContext = () => useOutletContext<OutletContextType>();

const MemoizedDeliveryTimerBar = memo(DeliveryTimerBar);

const MainLayout = () => {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Modal de bairro não atendido
  const [isNeighborhoodModalOpen, setIsNeighborhoodModalOpen] = useState(false);
  const [blockedNeighborhood, setBlockedNeighborhood] = useState('');

  const handleCategoryClick = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
    setIsCategoryModalOpen(true);
  }, []);

  const handleBrandClick = useCallback((brandName: string) => {
    setSelectedBrand(brandName);
    setIsBrandModalOpen(true);
  }, []);

  const handleCartClick = useCallback(() => setIsCartOpen(true), []);

  // Escuta evento global disparado pelo hook useAddToCart
  useEffect(() => {
    const handleNeighborhoodBlocked = (e: Event) => {
      const detail = (e as CustomEvent<{ neighborhood: string }>).detail;
      setBlockedNeighborhood(detail?.neighborhood || '');
      setIsNeighborhoodModalOpen(true);
    };

    window.addEventListener('neighborhoodBlocked', handleNeighborhoodBlocked);
    return () => window.removeEventListener('neighborhoodBlocked', handleNeighborhoodBlocked);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-off-white text-charcoal-gray transition-colors duration-500">
      <div className="sticky top-0 z-40 w-full">
        <MemoizedDeliveryTimerBar />
        <Header onCartClick={handleCartClick} />
      </div>
      <main className="flex-grow">
        <Outlet context={{ handleCategoryClick, handleBrandClick }} />
      </main>
      <Footer />
      <CategoryProductsModal
        isOpen={isCategoryModalOpen}
        onOpenChange={setIsCategoryModalOpen}
        categoryName={selectedCategory}
      />
      <BrandProductsModal
        isOpen={isBrandModalOpen}
        onOpenChange={setIsBrandModalOpen}
        brandName={selectedBrand}
      />
      <CartSheet isOpen={isCartOpen} onOpenChange={setIsCartOpen} />
      {/* SocialProofPopup carregado de forma lazy — não bloqueia o bundle inicial */}
      <Suspense fallback={null}>
        <SocialProofPopup />
      </Suspense>
      {/* Banner de erro de conexão — aparece automaticamente se o WiFi bloquear o Supabase */}
      <NetworkErrorBanner />
      {/* Botão flutuante do WhatsApp */}
      <WhatsAppButton />
      {/* Modal global de bairro não atendido */}
      <NeighborhoodBlockedModal
        isOpen={isNeighborhoodModalOpen}
        onClose={() => setIsNeighborhoodModalOpen(false)}
        neighborhood={blockedNeighborhood}
      />
    </div>
  );
};

export default memo(MainLayout);