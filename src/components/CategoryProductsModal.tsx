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

interface Product {
  id: number;
  name: number | string;
  price: number;
  pix_price: number | null;
  image_url: string;
  category: string | null;
  sub_category: string | null;
  stock_quantity: number;
}

interface CategoryProductsModalProps {
  categoryName: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const CategoryProductsModal = ({ categoryName, isOpen, onOpenChange }: CategoryProductsModalProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!categoryName || !isOpen) {
      setProducts([]);
      return;
    };
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

      // Fetch products WITHOUT joining categories (the relation doesn't exist)
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, sub_category, stock_quantity')
        .eq('category', categoryName)
        .eq('is_visible', true);

      if (error) {
        console.error("Error fetching products for category:", error);
        setProducts([]);
      } else if (data) {
        // Attach showAgeBadge flag to each product via category map
        const processed = (data as Product[]).map(p => ({
          ...p,
          // if category undefined, default to true (show badge)
          show_age_restriction: undefined, // keep shape minimal; ProductCard reads category map separately
          _showAgeBadge: p.category ? (categoryMap[normalizeCategory(p.category)] ?? true) : true
        })) as any[];
        setProducts(processed);
      }
    } catch (err) {
      console.error("Error fetching products for category:", err);
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
              {products.map((product: any, idx: number) => (
                <ProductCard key={`${product.id}-${idx}`} product={{
                  id: product.id,
                  name: product.name as unknown as string,
                  price: product.price,
                  pixPrice: product.pix_price,
                  imageUrl: product.image_url,
                  stockQuantity: product.stock_quantity,
                  // compute showAgeBadge from temporary _showAgeBadge property
                  showAgeBadge: product._showAgeBadge !== false
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