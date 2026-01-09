import { Outlet, useOutletContext } from "react-router-dom";
import Header from "./Header";
import { useState } from "react";
import CategoryProductsModal from "./CategoryProductsModal";
import BrandProductsModal from "./BrandProductsModal";
import { CartSheet } from "./CartSheet";
import Footer from "./Footer";
import SocialProofPopup from "./SocialProofPopup";
import AgeVerificationPopup from "./AgeVerificationPopup";

export interface OutletContextType {
  handleCategoryClick: (categoryName: string) => void;
  handleBrandClick: (brandName: string) => void;
}

export const useAppOutletContext = () => useOutletContext<OutletContextType>();

const MainLayout = () => {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setIsCategoryModalOpen(true);
  };

  const handleBrandClick = (brandName: string) => {
    setSelectedBrand(brandName);
    setIsBrandModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-off-white">
      <AgeVerificationPopup />
      <Header onCartClick={() => setIsCartOpen(true)} />
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
      <SocialProofPopup />
    </div>
  );
};

export default MainLayout;