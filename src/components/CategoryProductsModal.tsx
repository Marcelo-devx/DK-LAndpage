import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import ProductCard from './ProductCard';
import { Skeleton } from './ui/skeleton';

interface CategoryProductsModalProps {
  categoryName: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

interface DisplayProduct {
  id: number;
  name: string;
  price: number;
  pixPrice: number | null;
  imageUrl: string;
  stockQuantity: number;
  hasMultipleVariants: boolean;
  showAgeBadge: boolean;
}

const CategoryProductsModal = ({ categoryName, isOpen, onOpenChange }: CategoryProductsModalProps) => {
  const [products, setProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!categoryName || !isOpen) {
      setProducts([]);
      return;
    }
    setLoading(true);

    try {
      // Fetch category map to determine show_age_restriction
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('name, show_age_restriction')
        .eq('is_visible', true);

      const normalizeCategory = (s?: string) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
      const categoryMap: Record<string, boolean> = {};
      if (categoriesData) {
        categoriesData.forEach((c: any) => {
          if (c.name) categoryMap[normalizeCategory(c.name)] = c.show_age_restriction !== false;
        });
      }

      // Fetch products
      const { data: rawProducts, error } = await supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, stock_quantity')
        .eq('category', categoryName)
        .eq('is_visible', true);

      if (error) {
        console.error('[CategoryProductsModal] Error fetching products:', error);
        setProducts([]);
        return;
      }

      const productIds = (rawProducts || []).map((p: any) => p.id);

      // Fetch variants to get correct prices and stock
      const { data: variants } = productIds.length > 0
        ? await supabase
            .from('product_variants')
            .select('id, product_id, price, pix_price, stock_quantity')
            .in('product_id', productIds)
            .eq('is_active', true)
        : { data: [] };

      const displayList: DisplayProduct[] = (rawProducts || []).map((prod: any) => {
        const prodVariants = (variants || []).filter((v: any) => v.product_id === prod.id);
        const showAgeBadge = prod.category
          ? (categoryMap[normalizeCategory(prod.category)] ?? true)
          : true;

        if (prodVariants.length > 0) {
          const totalStock = prodVariants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
          const minPrice = Math.min(...prodVariants.map((v: any) => v.price ?? 0));
          const minPixPrice = Math.min(...prodVariants.map((v: any) => v.pix_price ?? v.price ?? 0));
          return {
            id: prod.id,
            name: prod.name,
            price: minPrice,
            pixPrice: minPixPrice,
            imageUrl: prod.image_url || '',
            stockQuantity: totalStock,
            hasMultipleVariants: true,
            showAgeBadge,
          };
        }

        return {
          id: prod.id,
          name: prod.name,
          price: prod.price ?? 0,
          pixPrice: prod.pix_price ?? null,
          imageUrl: prod.image_url || '',
          stockQuantity: prod.stock_quantity ?? 0,
          hasMultipleVariants: false,
          showAgeBadge,
        };
      });

      // Sort: in-stock first
      displayList.sort((a, b) => {
        const aIn = a.stockQuantity > 0;
        const bIn = b.stockQuantity > 0;
        if (aIn && !bIn) return -1;
        if (!aIn && bIn) return 1;
        return 0;
      });

      setProducts(displayList);
    } catch (err) {
      console.error('[CategoryProductsModal] Unexpected error:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryName, isOpen]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-[60vw] bg-off-white max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl text-charcoal-gray">{categoryName}</DialogTitle>
          <DialogDescription>
            Confira nossa seleção de produtos para esta categoria.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 overflow-y-auto flex-1 custom-scrollbar px-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex flex-col space-y-3">
                  <Skeleton className="w-full rounded-lg aspect-[4/5]" />
                  <div className="space-y-2 bg-charcoal-gray p-4 rounded-b-lg">
                    <Skeleton className="h-6 w-3/4 mx-auto" />
                    <Skeleton className="h-6 w-1/2 mx-auto" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product, idx) => (
                <ProductCard key={`${product.id}-${idx}`} product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  pixPrice: product.pixPrice,
                  imageUrl: product.imageUrl,
                  stockQuantity: product.stockQuantity,
                  hasMultipleVariants: product.hasMultipleVariants,
                  showAgeBadge: product.showAgeBadge,
                }} />
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-700 py-8">Nenhum produto disponível nesta categoria.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryProductsModal;
