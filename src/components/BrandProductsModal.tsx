import { useEffect, useState } from 'react';
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
  name: string;
  price: number;
  pix_price: number | null;
  image_url: string;
  category: string | null;
  sub_category: string | null;
  stock_quantity: number;
}

interface BrandProductsModalProps {
  brandName: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const BrandProductsModal = ({ brandName, isOpen, onOpenChange }: BrandProductsModalProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!brandName || !isOpen) {
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
        // DEBUG: inspect category map for brand modal
        // eslint-disable-next-line no-console
        console.debug("[BrandProductsModal] categoryMap:", categoryMap);

        // Fetch products WITHOUT joining categories
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, pix_price, image_url, category, sub_category, stock_quantity')
          .eq('brand', brandName)
          .eq('is_visible', true);

        if (error) {
          console.error("Error fetching products for brand:", error);
          setProducts([]);
        } else if (data) {
          const processed = (data as Product[]).map(p => {
            const _showAge = p.category ? (categoryMap[normalizeCategory(p.category)] ?? true) : true;
            try {
              if (p.name && String(p.name).toLowerCase().includes('ginger')) {
                // eslint-disable-next-line no-console
                console.debug("[BrandProductsModal] suspected product:", { id: p.id, name: p.name, category: p.category, resolvedShowAge: _showAge });
              }
            } catch (e) { /* ignore */ }
            return { ...p, _showAgeBadge: _showAge };
          }) as any[];
          setProducts(processed);
        }
      } catch (err) {
        console.error("Error fetching products for brand:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [brandName, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-[60vw] bg-off-white max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl text-charcoal-gray">{brandName}</DialogTitle>
          <DialogDescription>
            Confira nossa seleção de produtos desta marca.
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
              {products.map((product: any) => (
                <ProductCard key={product.id} product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  pixPrice: product.pix_price,
                  imageUrl: product.image_url,
                  stockQuantity: product.stock_quantity,
                  showAgeBadge: product._showAgeBadge !== false
                }} />
              ))}
            </div>
          ) : (
            <p className="text-center text-stone-600 py-8">Nenhum produto encontrado ou disponível para esta marca.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrandProductsModal;