import { useEffect, useState, memo } from 'react';
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
import { useProductRotation } from '@/hooks/useProductRotation';

interface CategoryProductCarouselProps {
  categoryName: string;
  showAgeBadge?: boolean;
}

const ROTATION_INTERVAL = 4000; // 4 segundos

const CategoryProductCarousel = memo(({ categoryName, showAgeBadge = true }: CategoryProductCarouselProps) => {
  const [pool, setPool] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { visible: products, fade } = useProductRotation(pool, 6, ROTATION_INTERVAL);

  useEffect(() => {
    let mounted = true;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const cat = (categoryName || '').trim();
        if (!cat) { setPool([]); return; }

        const [productsRes] = await Promise.all([
          supabase
            .from('products')
            .select('id, name, price, pix_price, image_url, stock_quantity, category')
            .eq('category', cat.trim())
            .eq('is_visible', true)
            .order('created_at', { ascending: false })
            .limit(30),
        ]);

        if (!mounted) return;

        const parentProducts = productsRes.data || [];
        if (productsRes.error || parentProducts.length === 0) {
          setPool([]);
          return;
        }

        const productIds = parentProducts.map((p: any) => p.id);
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, product_id, price, pix_price, stock_quantity')
          .in('product_id', productIds)
          .eq('is_active', true);

        if (!mounted) return;

        const finalList: any[] = [];
        parentProducts.forEach((prod: any) => {
          const prodVariants = (variants || []).filter((v: any) => v.product_id === prod.id);
          if (prodVariants.length > 0) {
            const totalStock = prodVariants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
            if (totalStock > 0) {
              finalList.push({
                id: prod.id, name: prod.name,
                price: Math.min(...prodVariants.map((v: any) => v.price ?? 0)),
                pixPrice: Math.min(...prodVariants.map((v: any) => v.pix_price ?? v.price ?? 0)),
                imageUrl: prod.image_url || '', stockQuantity: totalStock,
                hasMultipleVariants: true, showAgeBadge,
              });
            }
          } else if (prod.stock_quantity > 0) {
            finalList.push({
              id: prod.id, name: prod.name,
              price: prod.price ?? 0, pixPrice: prod.pix_price ?? null,
              imageUrl: prod.image_url || '', stockQuantity: prod.stock_quantity,
              hasMultipleVariants: false, showAgeBadge,
            });
          }
        });

        if (mounted) setPool(finalList);
      } catch (err) {
        console.error('[CategoryProductCarousel] error:', err);
        if (mounted) setPool([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProducts();
    return () => { mounted = false; };
  }, [categoryName, showAgeBadge]);

  if (!loading && pool.length === 0) return null;

  return (
    <section className="container mx-auto px-4 md:px-6 xl:px-8 py-3 md:py-5 xl:py-6">
      <div className="">
        <div>
          <h3 className="text-lg md:text-2xl xl:text-3xl font-black tracking-tighter italic" translate="no">
            {categoryName}
          </h3>
        </div>
        <Link
          to={`/produtos?category=${encodeURIComponent(categoryName)}`}
          className="text-[10px] xl:text-xs font-bold uppercase tracking-widest hover:text-sky-400 transition-colors"
        >
          Ver tudo →
        </Link>
      </div>

      <div className="min-h-[250px] md:min-h-[300px] xl:min-h-[340px]">
        {loading ? (
          <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent className="-ml-1 md:-ml-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <CarouselItem key={i} className="pl-1 md:pl-2 basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                  <Skeleton className="aspect-square bg-white/5 rounded-2xl md:rounded-3xl" />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : products.length > 0 ? (
          <div className="transition-opacity duration-300" style={{ opacity: fade ? 1 : 0 }}>
            <Carousel opts={{ align: "start", loop: products.length > 4 }} className="w-full">
              <CarouselContent className="-ml-1 md:-ml-2">
                {products.map((p, idx) => (
                  <CarouselItem key={`${p.id}-${idx}`} className="pl-1 md:pl-2 basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                    <ProductCard product={{
                      id: p.id, name: p.name, price: p.price, pixPrice: p.pixPrice,
                      imageUrl: p.imageUrl, stockQuantity: p.stockQuantity,
                      variantId: p.variantId, hasMultipleVariants: p.hasMultipleVariants,
                      showAgeBadge: p.showAgeBadge
                    }} imagePriority={idx < 2} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="hidden md:block">
                <CarouselPrevious className="bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
                <CarouselNext className="bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
              </div>
            </Carousel>
          </div>
        ) : (
          <div className="h-10 md:h-20" />
        )}
      </div>
    </section>
  );
});

export default CategoryProductCarousel;
