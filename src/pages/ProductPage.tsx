import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Minus, ChevronLeft } from "lucide-react";
import { addToCart } from '@/utils/cart';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';

interface Product {
  id: number;
  category: string | null;
  name: string;
  price: number;
  pix_price: number | null;
  description: string | null;
  image_url: string | null;
}

interface Variant {
  id: string;
  flavor_id: number | null;
  volume_ml: number | null;
  price: number;
  pix_price: number | null;
  stock_quantity: number;
  flavor_name?: string;
}

const ProductPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProductData = async () => {
      if (!id) return;
      setLoading(true);

      const { data: productData, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('is_visible', true)
        .single();

      if (error) { setLoading(false); return; }
      setProduct(productData);

      const { data: variantsData } = await supabase
        .from('product_variants')
        .select(`id, flavor_id, volume_ml, price, pix_price, stock_quantity`)
        .eq('product_id', id)
        .eq('is_active', true);

      if (variantsData && variantsData.length > 0) {
        const flavorIds = variantsData.filter(v => v.flavor_id).map(v => v.flavor_id);
        const { data: flavorsData } = await supabase.from('flavors').select('id, name').in('id', flavorIds);
        setVariants(variantsData.map(v => ({ ...v, flavor_name: flavorsData?.find(f => f.id === v.flavor_id)?.name })));
        
        // Seleciona a primeira variante disponível por padrão
        const firstAvailable = variantsData.find(v => v.stock_quantity > 0);
        if (firstAvailable) setSelectedVariant(firstAvailable as any);
      }

      setLoading(false);
    };

    fetchProductData();
    window.scrollTo(0, 0);
  }, [id]);

  const handleAddToCart = () => {
    if (variants.length > 0 && !selectedVariant) {
      showError("Selecione uma opção (sabor/volume)");
      return;
    }
    addToCart(product!.id, quantity, 'product', selectedVariant?.id);
  };

  if (loading) return <div className="container mx-auto px-6 py-20"><Skeleton className="w-full h-[600px] rounded-3xl bg-white/5" /></div>;
  if (!product) return null;

  const currentFullPrice = selectedVariant ? selectedVariant.price : product.price;
  const currentPixPrice = (selectedVariant ? selectedVariant.pix_price : product.pix_price) || currentFullPrice;

  return (
    <div className="bg-slate-950 min-h-screen text-white pb-20">
      <div className="container mx-auto px-6 py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8 text-slate-400 hover:text-white group">
          <ChevronLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Voltar
        </Button>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="relative group">
            <div className="absolute -inset-4 bg-sky-500/10 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <img 
              src={product.image_url || ''} 
              alt={product.name} 
              className="w-full h-auto object-cover rounded-3xl border border-white/5 shadow-2xl relative"
            />
          </div>

          <div className="space-y-10">
            <div>
              <p className="text-sky-400 text-xs font-black uppercase tracking-[0.3em] mb-4">{product.category}</p>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-6">{product.name}</h1>
              
              <div className="flex flex-col space-y-4">
                <div className="flex items-baseline space-x-3">
                    <span className="text-5xl font-black tracking-tighter text-white">
                        {currentPixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <span className="text-sm font-black text-sky-400 uppercase tracking-widest">no pix</span>
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  Ou {currentFullPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em até 3x sem juros
                </p>
              </div>
            </div>

            {variants.length > 0 && (
              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Opções Disponíveis</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      disabled={v.stock_quantity <= 0}
                      className={cn(
                        "p-4 border rounded-2xl transition-all text-left relative overflow-hidden",
                        selectedVariant?.id === v.id 
                          ? "border-sky-500 bg-sky-500/10 shadow-[0_0_20px_rgba(14,165,233,0.2)]" 
                          : "border-white/5 bg-white/5 hover:border-white/20",
                        v.stock_quantity <= 0 && "opacity-30 grayscale cursor-not-allowed"
                      )}
                    >
                      <p className="font-bold text-xs">{v.flavor_name || 'Original'}</p>
                      {v.volume_ml && <p className="text-[10px] text-slate-400 mt-1">{v.volume_ml}ml</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white/5 p-8 rounded-3xl border border-white/5 space-y-8">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quantidade</p>
                <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-white/5">
                  <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-10 w-10 text-white"><Minus className="h-4 w-4" /></Button>
                  <span className="w-12 text-center font-black text-lg">{quantity}</span>
                  <Button variant="ghost" size="icon" onClick={() => setQuantity(q => q + 1)} className="h-10 w-10 text-white"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-[0.2em] h-16 rounded-2xl shadow-[0_15px_30px_-10px_rgba(14,165,233,0.5)] transition-all active:scale-95" 
                onClick={handleAddToCart}
              >
                Adicionar ao Carrinho
              </Button>
            </div>

            <div className="prose prose-invert max-w-none">
              <p className="text-slate-400 leading-relaxed text-lg">{product.description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;