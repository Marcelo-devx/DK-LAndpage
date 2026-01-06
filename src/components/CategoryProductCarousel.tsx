import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";
import ProductCard from './ProductCard';
import { Skeleton } from './ui/skeleton';

interface Product {
  id: number;
  name: string;
  price: number;
  pix_price: number | null;
  image_url: string;
}

interface CategoryProductCarouselProps {
  categoryName: string;
}

const CategoryProductCarousel = ({ categoryName }: CategoryProductCarouselProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, pix_price, image_url')
        .eq('category', categoryName)
        .eq('is_visible', true)
        .limit(10);

      if (!error && data) {
        setProducts(data as Product[]);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [categoryName]);

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="flex items-end justify-between mb-12">
        <div>
          <h2 className="text-xs font-black tracking-[0.5em] text-sky-500 uppercase mb-4">{categoryName}</h2>
          <h3 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase">{categoryName}.</h3>
        </div>
        {products.length > 0 && (
          <Link to={`/produtos?category=${categoryName}`} className="text-xs font-bold uppercase tracking-widest hover:text-sky-400 transition-colors hidden md:block">
            Ver tudo →
          </Link>
        )}
      </div>

      <div className="min-h-[300px]">
        {loading ? (
          <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent className="-ml-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CarouselItem key={i} className="pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                  <Skeleton className="aspect-square bg-white/5 rounded-3xl" />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : products.length > 0 ? (
          <Carousel opts={{ align: "start", loop: products.length > 4 }} className="w-full">
            <CarouselContent className="-ml-4">
              {products.map((p) => (
                <CarouselItem key={p.id} className="pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                  <ProductCard product={{ 
                    id: p.id, 
                    name: p.name, 
                    price: p.price, 
                    pixPrice: p.pix_price, 
                    imageUrl: p.image_url, 
                    url: `/produto/${p.id}` 
                  }} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden md:block">
              <CarouselPrevious className="bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
              <CarouselNext className="bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
            </div>
          </Carousel>
        ) : (
          <div className="h-20" /> /* Espaço vazio conforme solicitado */
        )}
      </div>
    </section>
  );
};

export default CategoryProductCarousel;