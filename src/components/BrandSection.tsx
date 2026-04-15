import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface Brand {
  name: string;
  image_url: string | null;
}

interface BrandSectionProps {
  brands: Brand[];
  loading: boolean;
  onBrandClick: (brandName: string) => void;
}

const BrandSection = ({ brands, loading, onBrandClick }: BrandSectionProps) => {
  // Filtrar marcas com nomes inválidos ou nulos
  const validBrands = brands.filter(b => b.name && b.name.toLowerCase() !== 'null');

  return (
    <section className="container mx-auto px-4 md:px-6 xl:px-8 py-2 md:py-3 hidden md:block">
      {loading ? (
        <div className="flex justify-center items-center gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-32 rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <Carousel
          plugins={[Autoplay({ delay: 3000, stopOnInteraction: true })]}
          opts={{ align: "start", loop: validBrands.length > 6 }}
          className="w-full"
        >
          <CarouselContent className="-ml-2">
            {validBrands.map((brand, index) => (
              <CarouselItem key={`${brand.name}-${index}`} className="pl-2 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/6 xl:basis-1/6 2xl:basis-[12.5%]">
                <div 
                  onClick={() => onBrandClick(brand.name)}
                  className="group relative flex items-center justify-center h-14 xl:h-16 bg-gradient-to-b from-white to-slate-200 border border-white/20 rounded-2xl cursor-pointer transition-all duration-400 hover:border-sky-500/50 hover:shadow-[0_8px_30px_-10px_rgba(14,165,233,0.25)] overflow-hidden shadow-inner"
                >
                  {/* Subtle light reflection on the top */}
                  <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
                  
                  {/* Hover overlay that matches the site's accent */}
                  <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
                  
                  {brand.image_url ? (
                    <img
                      src={brand.image_url}
                      alt={brand.name}
                      loading="lazy"
                      decoding="async"
                      className="max-h-[60%] w-[80%] object-contain transition-all duration-500 group-hover:scale-105 drop-shadow-sm"
                    />
                  ) : (
                    <span className="text-sm font-black tracking-widest text-slate-800 group-hover:text-sky-600 transition-colors px-4 text-center leading-tight">
                      {brand.name}
                    </span>
                  )}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="hidden md:block">
            <CarouselPrevious className="bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
            <CarouselNext className="bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
          </div>
        </Carousel>
      )}
    </section>
  );
};

export default BrandSection;