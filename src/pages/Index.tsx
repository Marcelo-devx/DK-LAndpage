import { useEffect, useState } from 'react';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import ProductCard from "@/components/ProductCard";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import CategoryCarouselCard from '@/components/CategoryCarouselCard';
import { OutletContextType } from '@/components/MainLayout';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import FooterBanner from '@/components/FooterBanner';
import InfoSection from '@/components/InfoSection';
import CategoryProductCarousel from '@/components/CategoryProductCarousel';
import BrandSection from '@/components/BrandSection';
import InformationalPopup from '@/components/InformationalPopup';
import { useTheme } from '@/context/ThemeContext';
import ProductImage from '@/components/ProductImage';
import AgeVerificationPopup from '@/components/AgeVerificationPopup';

const Index = () => {
  const { settings } = useTheme();
  const navigate = useNavigate();
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [heroSlides, setHeroSlides] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  
  const [infoPopup, setInfoPopup] = useState<{ title: string; content: string } | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);

  const { handleBrandClick } = useOutletContext<OutletContextType>();

  // Verificar se a idade já foi confirmada antes de mostrar popup informativo
  useEffect(() => {
    try {
      const verified = localStorage.getItem('ageVerified') === 'true';
      setAgeVerified(verified);
    } catch (e) {
      setAgeVerified(false);
    }
  }, []);

  // Ouvir evento de verificação de idade
  useEffect(() => {
    const handleAgeVerified = () => {
      setAgeVerified(true);
    };

    window.addEventListener('ageVerified', handleAgeVerified);
    return () => window.removeEventListener('ageVerified', handleAgeVerified);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingProducts(true);

        // REMOVIDO: A verificação de MP params agora é feita no App.tsx
        // O componente Index sempre buscará os dados normalmente

        const normalizeCategory = (s?: string) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

        // Busca tudo em paralelo — UMA única vez
        const [
          productsRes,
          variantsRes,
          heroRes,
          promosRes,
          brandsRes,
          categoriesRes,
          featuredRes,
          popupRes,
        ] = await Promise.all([
          supabase.from('products').select('*').eq('is_visible', true).order('created_at', { ascending: false }).limit(12),
          supabase.from('product_variants').select('id, product_id, price, pix_price, stock_quantity').eq('is_active', true),
          supabase.from('hero_slides').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false }),
          supabase.from('brands').select('*').eq('is_visible', true).order('name'),
          supabase.from('categories').select('name, show_age_restriction').eq('is_visible', true).order('name'),
          supabase.from('products').select('*').eq('is_featured', true).eq('is_visible', true).limit(8),
          supabase.from('informational_popups').select('title, content').eq('is_active', true).limit(1).maybeSingle(),
        ]);

        // Monta o mapa de categorias
        const categoryMap = new Map(
          (categoriesRes.data || []).map((c: any) => [normalizeCategory(c.name), c.show_age_restriction !== false])
        );

        // Helper para montar lista de produtos com variantes (usa dados já buscados)
        const buildProductList = (products: any[]) => {
          const allVariants = variantsRes.data || [];
          return products.reduce((acc: any[], prod: any) => {
            const prodVariants = allVariants.filter((v: any) => v.product_id === prod.id);
            if (prodVariants.length > 0) {
              const totalStock = prodVariants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
              if (totalStock > 0) {
                acc.push({
                  id: prod.id,
                  name: prod.name,
                  price: Math.min(...prodVariants.map((v: any) => v.price)),
                  pixPrice: Math.min(...prodVariants.map((v: any) => v.pix_price || v.price)),
                  imageUrl: prod.image_url || '',
                  stockQuantity: totalStock,
                  hasMultipleVariants: true,
                  showAgeBadge: prod.category ? (categoryMap.get(normalizeCategory(prod.category)) ?? true) : true,
                });
              }
            } else if (prod.stock_quantity > 0) {
              acc.push({
                id: prod.id,
                name: prod.name,
                price: prod.price,
                pixPrice: prod.pix_price,
                imageUrl: prod.image_url || '',
                stockQuantity: prod.stock_quantity,
                hasMultipleVariants: false,
                showAgeBadge: prod.category ? (categoryMap.get(normalizeCategory(prod.category)) ?? true) : true,
              });
            }
            return acc;
          }, []);
        };

        setDisplayedProducts(buildProductList(productsRes.data || []));
        setFeaturedProducts(buildProductList(featuredRes.data || []));
        setHeroSlides(heroRes.data || []);
        setPromotions(promosRes.data || []);
        setBrands(brandsRes.data || []);
        setCategories(categoriesRes.data || []);

        const triggerInfoPopup = () => {
          // Mount the informational popup when there's active data, but keep it closed
          // until the user confirms age. Also respect if the popup was already seen.
          if (popupRes.data && !sessionStorage.getItem('info_popup_seen')) {
            setInfoPopup(popupRes.data);
            setIsPopupOpen(false); // keep closed until age is confirmed
          }
        };

        // Mount the informational popup (hidden) if available
        triggerInfoPopup();

        // Determine if age already verified (localStorage or sessionStorage)
        const isAgeVerifiedNow = (localStorage.getItem('ageVerified') === 'true') || (sessionStorage.getItem('age-verified-v2') === 'true');

        if (isAgeVerifiedNow) {
          setAgeVerified(true);
          // If age already verified, open the informational popup if present
          if (popupRes.data && !sessionStorage.getItem('info_popup_seen')) {
            setIsPopupOpen(true);
          }
        } else {
          // Wait for age verification event, then open the informational popup
          const handleVerification = () => {
            setAgeVerified(true);
            if (popupRes.data && !sessionStorage.getItem('info_popup_seen')) {
              setIsPopupOpen(true);
            }
            window.removeEventListener('ageVerified', handleVerification);
          };
          window.addEventListener('ageVerified', handleVerification);
        }
      } catch (error) {
        console.error("Erro ao carregar dados da Home:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchData();
  }, []);

  const handleClosePopup = () => {
    setIsPopupOpen(false);
    sessionStorage.setItem('info_popup_seen', 'true');
  };

  return (
    <div className="bg-off-white overflow-x-hidden text-charcoal-gray w-full transition-colors duration-500">
      <AgeVerificationPopup />
      {infoPopup && isPopupOpen && (
        <InformationalPopup
          isOpen={isPopupOpen}
          onClose={handleClosePopup}
          title={infoPopup.title}
          content={infoPopup.content}
        />
      )}

      {settings.showHero && heroSlides.length > 0 && (
        <section className="relative w-full overflow-hidden min-h-[140px] md:min-h-[240px] lg:min-h-[300px] xl:min-h-[360px]">
          <Carousel plugins={[Autoplay({ delay: 5000 })]} className="w-full h-full">
            <CarouselContent>
              {heroSlides.map((slide, index) => (
                <CarouselItem key={index}>
                  <Link 
                    to={slide.button_url || '#'} 
                    className="block relative w-full h-full"
                  >
                    <ProductImage 
                      src={slide.image_url} 
                      alt={slide.title || "Banner Principal"} 
                      className="w-full h-full object-cover block" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-off-white/80 via-transparent to-transparent" />
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </section>
      )}

      <div className="space-y-6 md:space-y-8 xl:space-y-10 py-4 md:py-6 xl:py-8">
        
        {settings.showInfo && (
          <ScrollAnimationWrapper>
            <InfoSection />
          </ScrollAnimationWrapper>
        )}

        {settings.showBrands && brands.length > 0 && (
          <ScrollAnimationWrapper>
            <BrandSection brands={brands} loading={false} onBrandClick={handleBrandClick} />
          </ScrollAnimationWrapper>
        )}

        {settings.showPromotions && promotions.length > 0 && (
          <ScrollAnimationWrapper>
            <section className="container mx-auto px-4 md:px-6 xl:px-8">
              <h2 className="text-[10px] md:text-xs xl:text-sm font-black tracking-[0.3em] md:tracking-[0.5em] text-sky-500 uppercase mb-4 md:mb-8 xl:mb-10 text-center">Ofertas Exclusivas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6 xl:gap-8">
                {promotions.slice(0, 3).map((promo) => (
                  <CategoryCarouselCard 
                    key={promo.id}
                    category={{ name: promo.name, imageUrl: promo.image_url }}
                    onClick={() => navigate(`/promocao/${promo.id}`)}
                  />
                ))}
              </div>
            </section>
          </ScrollAnimationWrapper>
        )}

        <ScrollAnimationWrapper>
          <section className="container mx-auto px-4 md:px-6 xl:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-4 md:mb-8 xl:mb-10 gap-2">
                <div>
                    <h3 className="text-xl md:text-3xl xl:text-4xl font-black tracking-tighter italic uppercase text-charcoal-gray" translate="no">NEW DROPS</h3>
                </div>
                <Link to="/produtos" className="text-[10px] xl:text-xs font-bold uppercase tracking-widest hover:text-sky-500 transition-colors text-slate-600">Ver todos →</Link>
            </div>
            
            <Carousel opts={{ align: "start", loop: displayedProducts.length > 4 }} className="w-full">
              <CarouselContent className="-ml-3 md:-ml-4">
                {loadingProducts ? Array.from({ length: 4 }).map((_, i) => (
                  <CarouselItem key={i} className="pl-3 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                    <Skeleton className="aspect-square bg-slate-200 rounded-2xl md:rounded-3xl" />
                  </CarouselItem>
                )) : displayedProducts.length > 0 ?
                  displayedProducts.map((p, idx) => (
                    <CarouselItem key={`${p.id}-${idx}`} className="pl-3 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                      <ProductCard product={{ id: p.id, name: p.name, price: p.price, pixPrice: p.pixPrice, imageUrl: p.imageUrl, stockQuantity: p.stockQuantity, variantId: p.variantId, hasMultipleVariants: p.hasMultipleVariants, showAgeBadge: p.showAgeBadge }} />
                    </CarouselItem>
                  )) : (
                    <div className="px-4 py-10 text-center w-full text-stone-400 italic">Nenhum produto em destaque no momento.</div>
                  )
                }
              </CarouselContent>
            </Carousel>
          </section>
        </ScrollAnimationWrapper>

        {categories.map((cat) => (
          <ScrollAnimationWrapper key={cat.name}>
            <CategoryProductCarousel
              categoryName={cat.name}
              showAgeBadge={cat.show_age_restriction !== false}
            />
          </ScrollAnimationWrapper>
        ))}

        {featuredProducts.length > 0 && (
          <ScrollAnimationWrapper>
            <section className="bg-white py-8 md:py-16 xl:py-20 rounded-[3rem] mx-4 md:mx-6 xl:mx-8 shadow-sm border border-stone-100">
              <div className="container mx-auto px-4 md:px-6 xl:px-8">
                <h2 className="text-[10px] md:text-xs xl:text-sm font-black tracking-[0.3em] md:tracking-[0.5em] text-sky-500 uppercase mb-4 md:mb-8 xl:mb-10 text-center">Seleção Premium</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-6 xl:gap-8">
                  {featuredProducts.map((p, idx) => (
                    <ProductCard key={`${p.id}-${idx}`} product={{ id: p.id, name: p.name, price: p.price, pixPrice: p.pixPrice, imageUrl: p.imageUrl, stockQuantity: p.stockQuantity, variantId: p.variantId, hasMultipleVariants: p.hasMultipleVariants, showAgeBadge: p.showAgeBadge }} />
                  ))}
                </div>
              </div>
            </section>
          </ScrollAnimationWrapper>
        )}
      </div>

      <FooterBanner />
    </div>
  );
};

export default Index;