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
}

interface ProductWithCategory {
  id: number;
  name: string;
  price: number;
  pix_price: number | null;
  image_url: string | null;
  stock_quantity: number;
  category?: string | null;
}

const CategoryProductCarousel = ({ categoryName }: CategoryProductCarouselProps) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Normalize category keys centrally so all lookups use the same logic
  const normalizeCategory = (s?: string) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);

      try {
        // Load category flags first
        const { data: categoriesData } = await supabase
          .from('categories')
          .select('name, show_age_restriction')
          .eq('is_visible', true);

        const categoryMap: Record<string, boolean> = {};
        if (categoriesData) {
          categoriesData.forEach((c: any) => {
            if (c.name) categoryMap[normalizeCategory(c.name)] = c.show_age_restriction !== false;
          });
        }
        // DEBUG: inspect category map
        // eslint-disable-next-line no-console
        console.debug("[CategoryProductCarousel] categoryMap:", categoryMap);

        // Fetch parent products without joining categories
        const { data: parentProducts, error } = await supabase
          .from('products')
          .select('id, name, price, pix_price, image_url, stock_quantity, category')
          .eq('category', categoryName)
          .eq('is_visible', true)
          .limit(10);

        if (error || !parentProducts) {
          console.error(error);
          setProducts([]);
          setLoading(false);
          return;
        }

        const productIds = parentProducts.map((p: any) => p.id);
        if (productIds.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, product_id, price, pix_price, stock_quantity')
          .in('product_id', productIds)
          .eq('is_active', true);

        let finalDisplayList: any[] = [];
        parentProducts.forEach((prod: ProductWithCategory) => {
          const prodVariants = variants?.filter(v => v.product_id === prod.id) || [];
          if (prodVariants.length > 0) {
            const minPrice = Math.min(...prodVariants.map(v => v.price));
            const minPixPrice = Math.min(...prodVariants.map(v => v.pix_price || v.price));
            const totalStock = prodVariants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
            
            // Only add if product has stock
            if (totalStock > 0) {
              finalDisplayList.push({
                id: prod.id,
                name: prod.name,
                price: minPrice,
                pixPrice: minPixPrice,
                imageUrl: prod.image_url || '',
                stockQuantity: totalStock,
                hasMultipleVariants: true,
                showAgeBadge: prod.category ? (categoryMap[normalizeCategory(prod.category)] ?? true) : true,
              });
            }
          } else {
            // Only add if product has stock
            if (prod.stock_quantity > 0) {
              finalDisplayList.push({
                id: prod.id,
                name: prod.name,
                price: prod.price,
                pixPrice: prod.pix_price,
                imageUrl: prod.image_url || '',
                stockQuantity: prod.stock_quantity,
                hasMultipleVariants: false,
                showAgeBadge: prod.category ? (categoryMap[normalizeCategory(prod.category)] ?? true) : true,
              });
            }
          }
          // DEBUG: highlight ginger product if present
          try {
            if (prod.name && String(prod.name).toLowerCase().includes('ginger')) {
              // eslint-disable-next-line no-console
              console.debug("[CategoryProductCarousel] suspected product:", { id: prod.id, name: prod.name, category: prod.category, showAgeBadge: (prod.category ? (categoryMap[normalizeCategory(prod.category)] ?? true) : true) });
            }
          } catch (e) { /* ignore */ }
        });

        setProducts(finalDisplayList);
      } catch (err) {
        console.error(err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryName]);

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
                <CarouselItem key={`${p.id}-${p.variantId || 'main'}-${idx}`} className="pl-3 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
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