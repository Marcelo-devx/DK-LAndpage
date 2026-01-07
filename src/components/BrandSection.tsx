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
    <section className="container mx-auto px-6 py-12">
      {loading ? (
        <div className="flex justify-center items-center gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-40 rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <Carousel
          plugins={[Autoplay({ delay: 3000, stopOnInteraction: true })]}
          opts={{ align: "start", loop: validBrands.length > 6 }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {validBrands.map((brand) => (
              <CarouselItem key={brand.name} className="pl-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/6">
                <div 
                  onClick={() => onBrandClick(brand.name)}
                  className="group relative flex items-center justify-center h-24 bg-white/[0.03] border border-white/10 rounded-2xl cursor-pointer transition-all duration-500 hover:bg-sky-500/10 hover:border-sky-500/50 hover:shadow-[0_0_30px_rgba(14,165,233,0.15)] overflow-hidden"
                >
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {brand.image_url ? (
                    <img 
                      src={brand.image_url} 
                      alt={brand.name} 
                      className="max-h-12 w-auto object-contain brightness-0 invert opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110"
                    />
                  ) : (
                    <span className="text-sm font-black uppercase tracking-widest text-slate-200 group-hover:text-sky-400 transition-colors px-4 text-center leading-tight">
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