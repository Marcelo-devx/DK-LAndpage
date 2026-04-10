import { Outlet, useOutletContext } from "react-router-dom";
import Header from "./Header";
import { useState, memo, useCallback, lazy, Suspense } from "react";
import CategoryProductsModal from "./CategoryProductsModal";
import BrandProductsModal from "./BrandProductsModal";
import { CartSheet } from "./CartSheet";
import Footer from "./Footer";
import DeliveryTimerBar from "./DeliveryTimerBar";

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

  const handleCategoryClick = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
    setIsCategoryModalOpen(true);
  }, []);

  const handleBrandClick = useCallback((brandName: string) => {
    setSelectedBrand(brandName);
    setIsBrandModalOpen(true);
  }, []);

  const handleCartClick = useCallback(() => setIsCartOpen(true), []);

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
    </div>
  );
};

export default memo(MainLayout);
