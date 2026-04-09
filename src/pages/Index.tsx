import { useEffect, useState, useCallback, useRef } from 'react';
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
import { useInfoPopup } from '@/hooks/useInfoPopup';
import { timer } from '@/lib/logger';

const Index = () => {
  const { settings } = useTheme();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [heroSlides, setHeroSlides] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);

  const { handleBrandClick } = useOutletContext<OutletContextType>();
  const { infoPopup, isOpen: isInfoPopupOpen, onClose: handleInfoPopupClose } = useInfoPopup();

  // Scroll to top is handled globally by ScrollToTop in App.tsx

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const timed = async (label: string, promise: Promise<any>) => {
    const t = timer();
    try {
      const res = await promise;
      t.end(label);
      return res;
    } catch (e) {
      t.end(label);
      throw e;
    }
  };

  const fetchData = useCallback(async (background = false) => {
    try {
      if (!background && isMountedRef.current) setLoadingProducts(true);

      const normalizeCategory = (s?: string) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

      // PHASE 1: Fetch hero slides and first carousel data immediately (critical for above-the-fold)
      const [heroRes, featuredRes] = await Promise.all([
        timed('fetch_hero', Promise.resolve(supabase.from('hero_slides').select('*').eq('is_active', true).order('sort_order'))),
        timed('fetch_featured', Promise.resolve(supabase.from('products').select('*').eq('is_featured', true).eq('is_visible', true).limit(8))),
      ]);

      if (isMountedRef.current) {
        setHeroSlides(heroRes.data || []);
        const categoryMap = new Map(
          (heroRes.data || []).map((c: any) => [normalizeCategory(c.name), c.show_age_restriction !== false])
        );
        
        // Need variants for featured products
        const featuredIds = (featuredRes.data || []).map((p: any) => p.id);
        let variantsForFeatured: any[] = [];
        
        if (featuredIds.length > 0) {
          const { data: featuredVariants } = await supabase
            .from('product_variants')
            .select('id, product_id, price, pix_price, stock_quantity')
            .in('product_id', featuredIds)
            .eq('is_active', true);
          variantsForFeatured = featuredVariants || [];
        }
        
        const buildProductList = (products: any[], variants: any[]) => {
          return products.reduce((acc: any[], prod: any) => {
            const prodVariants = variants.filter((v: any) => v.product_id === prod.id);
            if (prodVariants.length > 0) {
              const totalStock = prodVariants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
              if (totalStock > 0) {
                acc.push({
                  id: prod.id,
                  name: prod.name,
                  price: Math.min(...prodVariants.map((v: any) => v.price ?? 0)),
                  pixPrice: Math.min(...prodVariants.map((v: any) => v.pix_price ?? v.price ?? 0)),
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
                price: prod.price ?? 0,
                pixPrice: prod.pix_price ?? null,
                imageUrl: prod.image_url || '',
                stockQuantity: prod.stock_quantity,
                hasMultipleVariants: false,
                showAgeBadge: prod.category ? (categoryMap.get(normalizeCategory(prod.category)) ?? true) : true,
              });
            }
            return acc;
          }, []);
        };
        
        setFeaturedProducts(buildProductList(featuredRes.data || [], variantsForFeatured));
      }

      // PHASE 2: Fetch remaining data after a small delay (non-critical for initial render)
      setTimeout(async () => {
        if (!isMountedRef.current) return;
        
        const [productsRes, variantsRes, promosRes, brandsRes, categoriesRes] = await Promise.all([
          timed('fetch_products', Promise.resolve(supabase.from('products').select('*').eq('is_visible', true).order('created_at', { ascending: false }).limit(12))),
          timed('fetch_variants', Promise.resolve(supabase.from('product_variants').select('id, product_id, price, pix_price, stock_quantity').eq('is_active', true))),
          timed('fetch_promos', Promise.resolve(supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false }))),
          timed('fetch_brands', Promise.resolve(supabase.from('brands').select('*').eq('is_visible', true).order('name'))),
          timed('fetch_categories', Promise.resolve(supabase.from('categories').select('name, show_age_restriction').eq('is_visible', true).order('name'))),
        ]);

        const categoryMap = new Map(
          (categoriesRes.data || []).map((c: any) => [normalizeCategory(c.name), c.show_age_restriction !== false])
        );

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
                  price: Math.min(...prodVariants.map((v: any) => v.price ?? 0)),
                  pixPrice: Math.min(...prodVariants.map((v: any) => v.pix_price ?? v.price ?? 0)),
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
                price: prod.price ?? 0,
                pixPrice: prod.pix_price ?? null,
                imageUrl: prod.image_url || '',
                stockQuantity: prod.stock_quantity,
                hasMultipleVariants: false,
                showAgeBadge: prod.category ? (categoryMap.get(normalizeCategory(prod.category)) ?? true) : true,
              });
            }
            return acc;
          }, []);
        };

        if (isMountedRef.current) {
          setDisplayedProducts(buildProductList(productsRes.data || []));
          setPromotions(promosRes.data || []);
          setBrands(brandsRes.data || []);
          setCategories(categoriesRes.data || []);
        }
      }, 200); // 200ms delay for non-critical data

    } catch (error) {
      console.error("Erro ao carregar dados da Home:", error);
    } finally {
      if (!background && isMountedRef.current) setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    // Não re-executar se já tiver dados carregados
    if (displayedProducts.length > 0) return;
    fetchData();
  }, [fetchData]);

  return (
    <div className="bg-off-white overflow-x-hidden text-charcoal-gray w-full transition-colors duration-500">
      <AgeVerificationPopup />
      {infoPopup && (
        <InformationalPopup
          isOpen={isInfoPopupOpen}
          onClose={handleInfoPopupClose}
          title={infoPopup.title}
          content={infoPopup.content}
        />
      )}

      {settings.showHero && heroSlides.length > 0 && (
        // Hero banner com altura reduzida
        <section className="relative w-full overflow-hidden h-[180px] md:h-[260px] lg:h-[420px] xl:h-[500px] 2xl:h-[600px]">
          <Carousel plugins={[Autoplay({ delay: 5000 })]} className="w-full h-full">
            <CarouselContent>
              {heroSlides.map((slide, index) => (
                <CarouselItem key={index}>
                  <Link
                    to={slide.button_url || '#' }
                    className="block relative w-full h-full"
                  >
                    {/* Use cover so the image fills the hero area and doesn't leave letterbox gaps */}
                    <ProductImage
                      src={slide.image_url}
                      alt={slide.title || "Banner Principal"}
                      className="w-full h-full block rounded-none"
                      priority={true}
                      fit="cover"
                      quality={100}
                      maxWidth={1920}
                      skipOptimization={true}
                    />
                    {/* reduced gradient to avoid visible off-white band under the hero */}
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-transparent" />
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </section>
      )}

      {/* Compact spacing under hero */}
      <div className="-mt-6 md:mt-0 lg:mt-0 xl:mt-0">
        
        {settings.showInfo && (
          <InfoSection compactTop />
        )}

        {settings.showBrands && brands.length > 0 && (
          <ScrollAnimationWrapper>
            <BrandSection brands={brands} loading={false} onBrandClick={handleBrandClick} />
          </ScrollAnimationWrapper>
        )}

        {settings.showPromotions && promotions.length > 0 && (
          <ScrollAnimationWrapper>
            <section className="container mx-auto px-4 md:px-6 xl:px-8">
              <h2 className="text-[10px] md:text-xs xl:text-sm font-black tracking-[0.3em] md:tracking-[0.5em] text-sky-500 uppercase mb-3 md:mb-4 xl:mb-6 text-center">Ofertas Exclusivas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-1 md:gap-2">
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
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-2 md:mb-3 xl:mb-4 gap-2">
                <div>
                    <h3 className="text-xl md:text-3xl xl:text-4xl font-black tracking-tighter italic uppercase text-charcoal-gray" translate="no">NEW DROPS</h3>
                </div>
                <Link to="/produtos" className="text-[10px] xl:text-xs font-bold uppercase tracking-widest hover:text-sky-500 transition-colors text-slate-600">Ver todos →</Link>
            </div>
            
            <Carousel opts={{ align: "start", loop: displayedProducts.length > 4 }} className="w-full">
              <CarouselContent className="-ml-1 md:-ml-2">
                {loadingProducts ? Array.from({ length: 4 }).map((_, i) => (
                  <CarouselItem key={i} className="pl-1 md:pl-2 basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                    <Skeleton className="aspect-square bg-slate-200 rounded-2xl md:rounded-3xl" />
                  </CarouselItem>
                )) : displayedProducts.length > 0 ? 
                  displayedProducts.map((p, idx) => (
                    <CarouselItem key={`${p.id}-${idx}`} className="pl-1 md:pl-2 basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                      <ProductCard product={{ id: p.id, name: p.name, price: p.price, pixPrice: p.pixPrice, imageUrl: p.imageUrl, stockQuantity: p.stockQuantity, variantId: p.variantId, hasMultipleVariants: p.hasMultipleVariants, showAgeBadge: p.showAgeBadge }} />
                    </CarouselItem>
                  )) : (
                    <div className="px-4 py-8 text-center w-full text-stone-400 italic">Nenhum produto em destaque no momento.</div>
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
            <section className="bg-white py-4 md:py-8 xl:py-10 rounded-[3rem] mx-4 md:mx-6 xl:mx-8 shadow-sm border border-stone-100">
              <div className="container mx-auto px-4 md:px-6 xl:px-8">
                <h2 className="text-[10px] md:text-xs xl:text-sm font-black tracking-[0.3em] md:tracking-[0.5em] text-sky-500 uppercase mb-3 md:mb-4 xl:mb-6 text-center">Seleção Premium</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-1 md:gap-2">
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