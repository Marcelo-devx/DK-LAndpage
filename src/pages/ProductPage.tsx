import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Minus, ChevronLeft, Loader2, FileText, ShoppingCart } from "lucide-react";
import { addToCart } from '@/utils/cart';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';
import { Card, CardContent } from "@/components/ui/card";

interface Product {
  id: number;
  category: string | null;
  name: string;
  price: number;
  pix_price: number | null;
  description: string | null;
  image_url: string | null;
  stock_quantity: number;
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

const PixIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M371.304 186.064L250 307.368L128.696 186.064L41.3043 273.456L250 482.152L458.696 273.456L371.304 186.064Z" fill="currentColor"/>
      <path d="M128.696 313.936L250 192.632L371.304 313.936L458.696 226.544L250 17.848L41.3043 226.544L128.696 313.936Z" fill="currentColor"/>
    </svg>
);

const ProductPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preSelectedVariantId = searchParams.get('variant');
  
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
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
        const mappedVariants = variantsData.map(v => ({ ...v, flavor_name: flavorsData?.find(f => f.id === v.flavor_id)?.name }));
        setVariants(mappedVariants as any);
        
        // Lógica de Seleção Automática
        if (preSelectedVariantId) {
            const found = mappedVariants.find(v => v.id === preSelectedVariantId);
            if (found) { // Removida restrição de estoque > 0 para permitir visualização
                setSelectedVariant(found as any);
            } else {
                const firstAvailable = mappedVariants.find(v => v.stock_quantity > 0);
                if (firstAvailable) setSelectedVariant(firstAvailable as any);
            }
        } else {
            const firstAvailable = mappedVariants.find(v => v.stock_quantity > 0);
            if (firstAvailable) setSelectedVariant(firstAvailable as any);
        }
      }

      setLoading(false);
    };

    fetchProductData();
    window.scrollTo(0, 0);
  }, [id, preSelectedVariantId]);

  const handleAddToCart = async () => {
    // Validação de Variação
    if (product && variants.length > 0 && !selectedVariant) {
      showError("Selecione uma opção (sabor/volume)");
      return;
    }
    
    // Validação de Estoque
    const currentStock = selectedVariant ? selectedVariant.stock_quantity : (product?.stock_quantity || 0);
    if (currentStock <= 0) {
        showError("Produto esgotado.");
        return;
    }

    if (!product) return;
    
    setIsAdding(true);
    await addToCart(product.id, quantity, 'product', selectedVariant?.id);
    setIsAdding(false);
  };

  if (loading) return <div className="container mx-auto px-6 py-10"><Skeleton className="w-full h-[500px] rounded-3xl bg-gray-200" /></div>;
  if (!product) return null;

  const currentFullPrice = selectedVariant ? selectedVariant.price : product.price;
  const currentPixPrice = (selectedVariant ? selectedVariant.pix_price : product.pix_price) || currentFullPrice;
  const installmentValue = (currentFullPrice / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  const currentStock = selectedVariant ? selectedVariant.stock_quantity : product.stock_quantity;
  const isOutOfStock = currentStock <= 0;

  return (
    <div className="bg-off-white min-h-screen text-charcoal-gray pb-20">
      <div className="container mx-auto px-6 py-6 md:py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 text-stone-500 hover:text-charcoal-gray group">
          <ChevronLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Voltar
        </Button>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start mb-16">
          <div className="relative group lg:sticky lg:top-32">
            <div className="absolute -inset-4 bg-sky-500/5 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <img 
              src={product.image_url || ''} 
              alt={product.name} 
              className={cn(
                "w-full h-auto object-cover rounded-[2.5rem] border border-stone-100 shadow-2xl relative bg-white transition-all",
                isOutOfStock && "grayscale opacity-80"
              )}
            />
            {isOutOfStock && (
                <div className="absolute top-6 left-6 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest z-10 shadow-lg">
                    Esgotado
                </div>
            )}
          </div>

          <div className="space-y-8 md:space-y-12">
            <div>
              <p className="text-sky-500 text-xs font-black uppercase tracking-[0.4em] mb-3">{product.category}</p>
              <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-[0.9] mb-8 text-charcoal-gray" translate="no">
                {product.name} 
                {selectedVariant?.flavor_name && <span className="block text-2xl md:text-4xl text-slate-400 mt-2 italic">{selectedVariant.flavor_name}</span>}
              </h1>
              
              <div className="space-y-6 bg-white/50 backdrop-blur-sm p-8 rounded-[2rem] border border-white">
                <div className="space-y-1 border-b border-slate-100 pb-6">
                    <p className="text-xl md:text-2xl font-black text-slate-900">
                        {currentFullPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <p className="text-sm md:text-base text-slate-500 font-medium">
                        ou até <span className="font-bold text-slate-700">3x</span> de <span className="font-bold text-slate-700">{installmentValue}</span> <span className="text-xs uppercase tracking-widest opacity-70">no cartão</span>
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
                          <PixIcon className="h-5 w-5" />
                          <span className="text-xs font-black ml-1.5 uppercase tracking-widest">pix</span>
                        </div>
                        <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">Pagamento à vista</span>
                    </div>
                    
                    <div className="flex flex-wrap items-baseline">
                        <span className="text-5xl md:text-7xl font-black text-emerald-600 tracking-tighter">
                            {currentPixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                </div>
              </div>
            </div>

            {variants.length > 0 && (
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Escolha sua Opção</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={cn(
                        "p-5 border-2 rounded-[1.5rem] transition-all text-left relative overflow-hidden",
                        selectedVariant?.id === v.id 
                          ? "border-sky-500 bg-sky-50/50 shadow-lg ring-4 ring-sky-500/10" 
                          : "border-stone-100 bg-white hover:border-sky-200",
                        v.stock_quantity <= 0 && "opacity-60 grayscale bg-stone-50"
                      )}
                    >
                      <p className="font-black text-sm text-charcoal-gray uppercase tracking-tight" translate="no">{v.flavor_name || 'Original'}</p>
                      {v.volume_ml && <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">{v.volume_ml}ml</p>}
                      {v.stock_quantity <= 0 && <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-950 p-8 md:p-10 rounded-[2.5rem] space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[60px] rounded-full" />
              
              <div className="flex items-center justify-between relative z-10">
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Quantidade</p>
                <div className="flex items-center bg-white/5 rounded-2xl p-1.5 border border-white/10">
                  <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-12 w-12 text-white hover:bg-white/10 rounded-xl" disabled={isOutOfStock}><Minus className="h-5 w-5" /></Button>
                  <span className="w-14 text-center font-black text-2xl text-white tracking-tighter">{quantity}</span>
                  <Button variant="ghost" size="icon" onClick={() => setQuantity(q => q + 1)} className="h-12 w-12 text-white hover:bg-white/10 rounded-xl" disabled={isOutOfStock}><Plus className="h-5 w-5" /></Button>
                </div>
              </div>

              <Button 
                size="lg" 
                className={cn(
                    "w-full font-black uppercase tracking-[0.2em] h-18 text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95 py-8",
                    isOutOfStock ? "bg-stone-800 text-stone-500 cursor-not-allowed" : "bg-sky-500 hover:bg-sky-400 text-white shadow-[0_20px_40px_-10px_rgba(14,165,233,0.5)]"
                )}
                onClick={handleAddToCart}
                disabled={isAdding || isOutOfStock}
              >
                {isAdding ? <Loader2 className="animate-spin h-6 w-6" /> : (
                    <span className="flex items-center gap-3">
                        <ShoppingCart className="h-6 w-6" />
                        {isOutOfStock ? 'ESGOTADO' : 'ADICIONAR AO CARRINHO'}
                    </span>
                )}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="w-full">
          <Card className="bg-white border-none shadow-[0_30px_60px_-20px_rgba(0,0,0,0.05)] rounded-[3rem] overflow-hidden">
            <CardContent className="p-10 md:p-16">
              <div className="flex items-center space-x-4 mb-12 border-b border-stone-50 pb-8">
                <div className="p-4 bg-sky-50 rounded-2xl text-sky-600">
                  <FileText className="h-8 w-8" />
                </div>
                <h2 className="font-black text-3xl md:text-4xl tracking-tighter italic uppercase text-charcoal-gray">
                  Detalhes do Produto.
                </h2>
              </div>
              
              {/* CORREÇÃO AQUI: Usando dangerouslySetInnerHTML para renderizar o HTML importado */}
              <div className="prose prose-stone prose-lg max-w-none text-slate-600 leading-relaxed font-medium">
                <div dangerouslySetInnerHTML={{ __html: product.description || 'Sem descrição disponível.' }} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;