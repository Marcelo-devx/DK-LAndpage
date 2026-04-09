import { Outlet, useOutletContext } from "react-router-dom";
import Header from "./Header";
import { useState, memo, useCallback } from "react";
import CategoryProductsModal from "./CategoryProductsModal";
import BrandProductsModal from "./BrandProductsModal";
import { CartSheet } from "./CartSheet";
import Footer from "./Footer";
import SocialProofPopup from "./SocialProofPopup";
import DeliveryTimerBar from "./DeliveryTimerBar";

export interface OutletContextType {
  handleCategoryClick: (categoryName: string) => void;
  handleBrandClick: (brandName: string) => void;
}

export const useAppOutletContext = () => useOutletContext<OutletContextType>();

// Memoizar componentes fixos para evitar re-renderizações desnecessárias
const MemoizedDeliveryTimerBar = memo(DeliveryTimerBar);
const MemoizedSocialProofPopup = memo(SocialProofPopup);

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
      <MemoizedSocialProofPopup />
    </div>
  );
};

export default memo(MainLayout);