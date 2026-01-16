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
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, sub_category')
        .eq('brand', brandName)
        .eq('is_visible', true)
        .gt('stock_quantity', 0);

      if (error) {
        console.error("Error fetching products for brand:", error);
        setProducts([]);
      } else if (data) {
        setProducts(data as Product[]);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [brandName, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-[60vw] bg-off-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl text-charcoal-gray">{brandName}</DialogTitle>
          <DialogDescription>
            Confira nossa seleção de produtos desta marca.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[70vh] overflow-y-auto">
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
              {products.map((product) => (
                <ProductCard key={product.id} product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  pixPrice: product.pix_price,
                  imageUrl: product.image_url
                }} />
              ))}
            </div>
          ) : (
            <p className="text-center text-stone-600 py-8">Nenhum produto encontrado para esta marca.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrandProductsModal;