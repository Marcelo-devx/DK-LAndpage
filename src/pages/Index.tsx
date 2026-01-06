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

const Index = () => {
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [heroSlides, setHeroSlides] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const { handleBrandClick } = useOutletContext<OutletContextType>();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const [products, hero, promos, brandsData, categoriesData, featured] = await Promise.all([
        supabase.from('products').select('*').eq('is_visible', true).order('created_at', { ascending: false }).limit(12),
        supabase.from('hero_slides').select('*').order('sort_order'),
        supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('brands').select('*').order('name'),
        supabase.from('categories').select('name').order('name'),
        supabase.from('products').select('*').eq('is_featured', true).eq('is_visible', true).limit(8)
      ]);

      setDisplayedProducts(products.data || []);
      setHeroSlides(hero.data || []);
      setPromotions(promos.data || []);
      setBrands(brandsData.data || []);
      setCategories(categoriesData.data || []);
      setFeaturedProducts(featured.data || []);
      setLoadingProducts(false);
    };
    fetchData();
  }, []);

  return (
    <div className="bg-slate-950 overflow-x-hidden text-white w-full">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden">
        <Carousel plugins={[Autoplay({ delay: 5000 })]} className="w-full">
          <CarouselContent>
            {heroSlides.map((slide, index) => (
              <CarouselItem key={index}>
                <Link to={slide.button_url || '#'} className="block relative aspect-[4/5] md:aspect-[25/9] w-full overflow-hidden">
                  <img 
                    src={slide.image_url} 
                    className="w-full h-full object-cover" 
                    alt={slide.title || "Banner Principal"} 
                  />
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </section>

      <div className="space-y-16 md:space-y-24 py-12 md:py-20">
        <ScrollAnimationWrapper>
          <InfoSection />
        </ScrollAnimationWrapper>

        <ScrollAnimationWrapper>
          <BrandSection brands={brands} loading={false} onBrandClick={handleBrandClick} />
        </ScrollAnimationWrapper>

        {promotions.length > 0 && (
          <ScrollAnimationWrapper>
            <section className="container mx-auto px-4 md:px-6">
              <h2 className="text-[10px] md:text-xs font-black tracking-[0.3em] md:tracking-[0.5em] text-sky-500 uppercase mb-8 md:mb-12 text-center">Ofertas Exclusivas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
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
          <section className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 md:mb-12 gap-4">
                <div>
                    <h2 className="text-[10px] md:text-xs font-black tracking-[0.3em] md:tracking-[0.5em] text-sky-500 uppercase mb-2 md:mb-4">Lançamentos</h2>
                    <h3 className="text-3xl md:text-6xl font-black tracking-tighter italic uppercase">NEW DROPS.</h3>
                </div>
                <Link to="/produtos" className="text-[10px] font-bold uppercase tracking-widest hover:text-sky-400 transition-colors">Ver todos →</Link>
            </div>
            
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
              <CarouselContent className="-ml-2 md:-ml-4">
                {loadingProducts ? Array.from({ length: 4 }).map((_, i) => (
                  <CarouselItem key={i} className="pl-2 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                    <Skeleton className="aspect-square bg-white/5 rounded-2xl md:rounded-3xl" />
                  </CarouselItem>
                )) :
                  displayedProducts.map((p) => (
                    <CarouselItem key={p.id} className="pl-2 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                      <ProductCard product={{ id: p.id, name: p.name, price: p.price, pixPrice: p.pix_price, imageUrl: p.image_url, url: `/produto/${p.id}` }} />
                    </CarouselItem>
                  ))
                }
              </CarouselContent>
            </Carousel>
          </section>
        </ScrollAnimationWrapper>

        {categories.map((cat) => (
          <ScrollAnimationWrapper key={cat.name}>
            <CategoryProductCarousel categoryName={cat.name} />
          </ScrollAnimationWrapper>
        ))}

        {featuredProducts.length > 0 && (
          <ScrollAnimationWrapper>
            <section className="bg-white/5 py-16 md:py-24">
              <div className="container mx-auto px-4 md:px-6">
                <h2 className="text-[10px] md:text-xs font-black tracking-[0.3em] md:tracking-[0.5em] text-sky-500 uppercase mb-8 md:mb-12 text-center">Seleção Premium</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                  {featuredProducts.map((p) => (
                    <ProductCard key={p.id} product={{ id: p.id, name: p.name, price: p.price, pixPrice: p.pix_price, imageUrl: p.image_url, url: `/produto/${p.id}` }} />
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