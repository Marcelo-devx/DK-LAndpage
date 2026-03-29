import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Minus, ChevronLeft, Loader2, FileText, ShoppingCart, Zap, Palette, Droplets, ArrowLeft } from "lucide-react";
import { addToCart } from '@/utils/cart';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';
import { Card, CardContent } from "@/components/ui/card";
import ProductImage from '@/components/ProductImage';
import DOMPurify from 'dompurify';

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
  ohms: string | null;
  color: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  
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
        .select(`id, flavor_id, volume_ml, price, pix_price, stock_quantity, ohms, color`)
        .eq('product_id', id)
        .eq('is_active', true);

      if (variantsData && variantsData.length > 0) {
        const flavorIds = variantsData.filter(v => v.flavor_id).map(v => v.flavor_id);
        const { data: flavorsData } = await supabase.from('flavors').select('id, name').in('id', flavorIds);
        
        const mappedVariants = variantsData.map(v => ({ 
            ...v, 
            flavor_name: flavorsData?.find(f => f.id === v.flavor_id)?.name 
        }));
        
        mappedVariants.sort((a, b) => {
            if (a.stock_quantity > 0 && b.stock_quantity <= 0) return -1;
            if (a.stock_quantity <= 0 && b.stock_quantity > 0) return 1;
            return a.price - b.price;
        });

        setVariants(mappedVariants as any);
      }

      setLoading(false);
    };

    fetchProductData();
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (variants.length > 0) {
      const preSelectedVariantId = searchParams.get('variant');
      const variantToSelect = variants.find(v => v.id === preSelectedVariantId) || variants.find(v => v.stock_quantity > 0) || variants[0];
      if (variantToSelect) {
        setSelectedVariant(variantToSelect);
      }
    }
  }, [variants, searchParams]);

  const handleVariantSelect = (variant: Variant) => {
    setSelectedVariant(variant);
    setSearchParams({ variant: variant.id }, { replace: true });
  };

  const handleAddToCart = async () => {
    if (product && variants.length > 0 && !selectedVariant) {
      showError("Selecione uma opção (sabor/volume)");
      return;
    }
    
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

  const getVariantLabel = (v: Variant) => {
    if (v.flavor_name) return v.flavor_name;
    if (v.ohms) {
      const cleanOhm = v.ohms.replace(/[^\d.,]/g, '');
      return `${cleanOhm}Ω (Ohm)`;
    }
    if (v.color) return v.color;
    if (v.volume_ml) return `${v.volume_ml}ml`;
    return 'Padrão';
  };

  const getVariantTypeInfo = (v: Variant) => {
    if (v.flavor_name) return { icon: Droplets, label: 'Sabor' };
    if (v.ohms) return { icon: Zap, label: 'Resistência' };
    if (v.color) return { icon: Palette, label: 'Cor' };
    if (v.volume_ml) return { icon: FileText, label: 'Volume' };
    return null;
  };

  const getVariantSubLabel = (v: Variant) => {
    const parts = [];
    if (v.volume_ml && v.flavor_name) parts.push(`${v.volume_ml}ml`);
    if (v.flavor_name && (v.ohms || v.color)) parts.push(v.ohms || v.color);
    return parts.join(' - ');
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
        <div className="md:hidden mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-stone-500 hover:text-charcoal-gray transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start mb-16">
          <div className="relative group lg:sticky lg:top-32">
            <div className="absolute -inset-4 bg-sky-500/5 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <ProductImage 
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
                {selectedVariant && (
                    <span className="block text-2xl md:text-4xl text-slate-400 mt-2 italic">
                        {getVariantLabel(selectedVariant)} {selectedVariant.volume_ml && selectedVariant.flavor_name ? `${selectedVariant.volume_ml}ml` : ''}
                    </span>
                )}
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
                  {variants.map((v) => {
                    const typeInfo = getVariantTypeInfo(v);
                    const TypeIcon = typeInfo?.icon || FileText;
                    
                    return (
                      <button
                        key={v.id}
                        onClick={() => handleVariantSelect(v)}
                        className={cn(
                          "p-4 border-2 rounded-[1.5rem] transition-all text-left relative overflow-hidden flex flex-col justify-center min-h-[90px] group",
                          selectedVariant?.id === v.id 
                            ? "border-sky-500 bg-sky-50/50 shadow-lg ring-4 ring-sky-500/10" 
                            : "border-stone-100 bg-white hover:border-sky-200 hover:shadow-md",
                          v.stock_quantity <= 0 && "opacity-60 grayscale bg-stone-50 hover:border-stone-200 hover:shadow-none"
                        )}
                      >
                        {typeInfo && (
                          <div className="flex items-center gap-1.5 mb-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                            <TypeIcon className="h-3 w-3" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">{typeInfo.label}</span>
                          </div>
                        )}

                        <p className="font-black text-sm text-charcoal-gray uppercase tracking-tight leading-tight" translate="no">
                          {getVariantLabel(v)}
                        </p>
                        
                        {getVariantSubLabel(v) && (
                          <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">
                              {getVariantSubLabel(v)}
                          </p>
                        )}
                        
                        {v.stock_quantity <= 0 && (
                          <span className="absolute bottom-2 right-3 text-[9px] font-black text-red-500 uppercase tracking-wider">
                            Esgotado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-slate-950 p-6 md:p-8 rounded-[2rem] space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 blur-[40px] rounded-full" />

              <div className="relative z-10 space-y-6">
                <div className="space-y-1">
                  <div className="bg-white p-6 rounded-2xl border border-stone-100 relative z-10">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Quantidade</p>
                      <div className="flex items-center bg-stone-100 rounded-2xl p-1">
                        <Button
                          variant="outline"
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          className="bg-stone-100 hover:bg-stone-200 text-black h-12 w-12 rounded-xl border border-stone-200 transition-all active:scale-95 shadow-sm"
                          disabled={isOutOfStock}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>

                        <div className="w-16 text-center font-black text-xl mx-3 select-none">
                          {quantity}
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => setQuantity(q => q + 1)}
                          className="bg-stone-100 hover:bg-stone-200 text-black h-12 w-12 rounded-xl border border-stone-200 transition-all active:scale-95 shadow-sm"
                          disabled={isOutOfStock}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    variant={isOutOfStock ? "secondary" : "default"}
                    onClick={handleAddToCart}
                    className={cn(
                      "w-full font-black uppercase tracking-[0.2em] h-16 md:h-14 text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95",
                      !isOutOfStock && "bg-sky-500 hover:bg-sky-400 text-white shadow-[0_20px_40px_-10px_rgba(14,165,233,0.0,0.05)]",
                      isOutOfStock && "bg-stone-800 text-stone-500 opacity-70"
                    )}
                    disabled={isAdding || isOutOfStock}
                  >
                    {isAdding ? <Loader2 className="animate-spin h-6 w-6" /> : (
                      <span className="flex items-center gap-2">
                        <ShoppingCart className="h-6 w-6" />
                        <span className={cn(
                          isOutOfStock ? 'text-stone-500' : 'text-white',
                          "text-xs font-black uppercase tracking-widest"
                        )}>
                          {isOutOfStock ? 'ESGOTADO' : 'ADICIONAR AO CARRINHO'}
                        </span>
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-lg md:text-2xl font-black tracking-tighter leading-tight">{product.name}</p>
                {selectedVariant && (
                  <span className="block text-2xl md:text-4xl text-slate-400 mt-2 italic">
                    {getVariantLabel(selectedVariant)} {selectedVariant.volume_ml && selectedVariant.flavor_name ? `${selectedVariant.volume_ml}ml` : ''}
                  </span>
                )}
              </div>
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
              
              <div className="prose prose-stone prose-lg max-w-none text-slate-600 leading-relaxed font-medium">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || 'Sem descrição disponível.') }} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;