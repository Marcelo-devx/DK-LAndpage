import { Outlet, useOutletContext, useNavigate, useLocation } from "react-router-dom";
import Header from "./Header";
import { useState, useEffect } from "react";
import CategoryProductsModal from "./CategoryProductsModal";
import BrandProductsModal from "./BrandProductsModal";
import { CartSheet } from "./CartSheet";
import Footer from "./Footer";
import SocialProofPopup from "./SocialProofPopup";
import AgeVerificationPopup from "./AgeVerificationPopup";
import DeliveryTimerBar from "./DeliveryTimerBar";
import WhatsAppButton from "./WhatsAppButton";
import LoyaltyButton from "./LoyaltyButton";
import { supabase } from "@/integrations/supabase/client";

export interface OutletContextType {
  handleCategoryClick: (categoryName: string) => void;
  handleBrandClick: (brandName: string) => void;
}

export const useAppOutletContext = () => useOutletContext<OutletContextType>();

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Verificação Global de Perfil Completo
  useEffect(() => {
    const checkProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const isProfileComplete = profile && 
          profile.first_name && 
          profile.last_name && 
          profile.phone &&
          profile.cpf_cnpj &&
          profile.gender &&
          profile.date_of_birth &&
          profile.cep &&
          profile.street &&
          profile.number &&
          profile.neighborhood &&
          profile.city &&
          profile.state;

        // Se estiver incompleto e não estiver na página de completar perfil, redireciona
        if (!isProfileComplete && location.pathname !== '/complete-profile') {
          navigate('/complete-profile', { replace: true });
        }
      }
    };

    checkProfile();
  }, [navigate, location.pathname]);

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setIsCategoryModalOpen(true);
  };

  const handleBrandClick = (brandName: string) => {
    setSelectedBrand(brandName);
    setIsBrandModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-off-white text-charcoal-gray transition-colors duration-500">
      <AgeVerificationPopup />
      
      <div className="sticky top-0 z-40 w-full">
        <DeliveryTimerBar />
        <Header onCartClick={() => setIsCartOpen(true)} />
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
      <SocialProofPopup />
      
      {/* Botões Flutuantes */}
      <LoyaltyButton />
      <WhatsAppButton />
    </div>
  );
};

export default MainLayout;