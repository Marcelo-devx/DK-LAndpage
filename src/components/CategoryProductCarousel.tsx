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

interface CategoryProductCarouselProps {
  categoryName: string;
  // Optional: pass the age restriction flag from parent to avoid extra DB query
  showAgeBadge?: boolean;
}

const CategoryProductCarousel = ({ categoryName, showAgeBadge = true }: CategoryProductCarouselProps) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Fetch products and their variants in parallel — no extra categories query
        const [productsRes, variantsRes] = await Promise.all([
          supabase
            .from('products')
            .select('id, name, price, pix_price, image_url, stock_quantity, category')
            .eq('category', categoryName)
            .eq('is_visible', true)
            .limit(10),
          // We'll filter variants client-side after getting product IDs
          Promise.resolve(null),
        ]);

        const parentProducts = productsRes.data || [];
        if (productsRes.error || parentProducts.length === 0) {
          setProducts([]);
          return;
        }

        const productIds = parentProducts.map((p: any) => p.id);

        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, product_id, price, pix_price, stock_quantity')
          .in('product_id', productIds)
          .eq('is_active', true);

        const finalList: any[] = [];
        parentProducts.forEach((prod: any) => {
          const prodVariants = (variants || []).filter((v: any) => v.product_id === prod.id);
          if (prodVariants.length > 0) {
            const totalStock = prodVariants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
            if (totalStock > 0) {
              finalList.push({
                id: prod.id,
                name: prod.name,
                price: Math.min(...prodVariants.map((v: any) => v.price)),
                pixPrice: Math.min(...prodVariants.map((v: any) => v.pix_price || v.price)),
                imageUrl: prod.image_url || '',
                stockQuantity: totalStock,
                hasMultipleVariants: true,
                showAgeBadge,
              });
            }
          } else if (prod.stock_quantity > 0) {
            finalList.push({
              id: prod.id,
              name: prod.name,
              price: prod.price,
              pixPrice: prod.pix_price,
              imageUrl: prod.image_url || '',
              stockQuantity: prod.stock_quantity,
              hasMultipleVariants: false,
              showAgeBadge,
            });
          }
        });

        setProducts(finalList);
      } catch (err) {
        console.error('[CategoryProductCarousel] error:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryName, showAgeBadge]);

  return (
    <section className="container mx-auto px-6 py-8 md:py-16">
      <div className="flex items-end justify-between mb-8 md:mb-12">
        <div>
          <h3 className="text-3xl md:text-5xl font-black tracking-tighter italic" translate="no">
            {categoryName}
          </h3>
        </div>
        {products.length > 0 && (
          <Link to={`/produtos?category=${categoryName}`} className="text-[10px] font-bold uppercase tracking-widest hover:text-sky-400 transition-colors hidden md:block">
            Ver tudo →
          </Link>
        )}
      </div>

      <div className="min-h-[250px] md:min-h-[300px]">
        {loading ? (
          <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent className="-ml-3 md:-ml-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CarouselItem key={i} className="pl-3 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                  <Skeleton className="aspect-square bg-white/5 rounded-2xl md:rounded-3xl" />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : products.length > 0 ? (
          <Carousel opts={{ align: "start", loop: products.length > 4 }} className="w-full">
            <CarouselContent className="-ml-3 md:-ml-4">
              {products.map((p, idx) => (
                <CarouselItem key={`${p.id}-${idx}`} className="pl-3 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                  <ProductCard product={{ 
                    id: p.id, 
                    name: p.name, 
                    price: p.price, 
                    pixPrice: p.pixPrice, 
                    imageUrl: p.imageUrl,
                    stockQuantity: p.stockQuantity,
                    variantId: p.variantId,
                    hasMultipleVariants: p.hasMultipleVariants,
                    showAgeBadge: p.showAgeBadge
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
          <div className="h-10 md:h-20" />
        )}
      </div>
    </section>
  );
};

export default CategoryProductCarousel;
