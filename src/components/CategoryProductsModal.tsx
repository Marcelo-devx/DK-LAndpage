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

interface CategoryProductsModalProps {
  categoryName: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const CategoryProductsModal = ({ categoryName, isOpen, onOpenChange }: CategoryProductsModalProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!categoryName || !isOpen) {
        setProducts([]);
        return;
      };
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, sub_category, stock_quantity')
        .eq('category', categoryName)
        .eq('is_visible', true)
        .gt('stock_quantity', 0); // Filtro de estoque adicionado

      if (error) {
        console.error("Error fetching products for category:", error);
        setProducts([]);
      } else if (data) {
        setProducts(data as Product[]);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [categoryName, isOpen]);

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
              {products.map((product) => (
                <ProductCard key={product.id} product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  pixPrice: product.pix_price,
                  imageUrl: product.image_url,
                  stockQuantity: product.stock_quantity
                }} />
              ))}
            </div>
          ) : (
            <p className="text-center text-stone-600 py-8">Nenhum produto disponível nesta categoria.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryProductsModal;