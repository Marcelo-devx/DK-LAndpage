import { useEffect, useState, useCallback } from 'react';
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
  size: string | null;
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

  const fetchProductData = useCallback(async (background = false) => {
      if (!id) return;
      if (!background) setLoading(true);

      // Safety timeout so loading never remains true indefinitely
      const safetyTimer = !background ? setTimeout(() => {
        try { setLoading(false); } catch { /* noop */ }
      }, 10000) : null;

      const { data: productData, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('is_visible', true)
        .single();

      if (error) { if (!background) setLoading(false); if (safetyTimer) clearTimeout(safetyTimer); return; }
      setProduct(productData);

      const { data: variantsData } = await supabase
        .from('product_variants')
        .select(`id, flavor_id, volume_ml, price, pix_price, stock_quantity, ohms, color, size`)
        .eq('product_id', id)
        .eq('is_active', true);

      if (variantsData && variantsData.length > 0) {
        const flavorIds = variantsData.filter((v: any) => v.flavor_id).map((v: any) => v.flavor_id);
        let flavorsData: any[] = [];
        if (flavorIds.length > 0) {
          const res = await supabase.from('flavors').select('id, name').in('id', flavorIds);
          flavorsData = res.data || [];
        }

        const mappedVariants = variantsData.map((v: any) => ({ 
            ...v,
            ohms: v.ohms || null,
            color: v.color || null,
            size: v.size || null,
            flavor_name: flavorsData.find(f => f.id === v.flavor_id)?.name
        }));

        mappedVariants.sort((a: any, b: any) => {
            if (a.stock_quantity > 0 && b.stock_quantity <= 0) return -1;
            if (a.stock_quantity <= 0 && b.stock_quantity > 0) return 1;
            return a.price - b.price;
        });

        setVariants(mappedVariants as any);
      }

      if (!background) setLoading(false);
      if (safetyTimer) clearTimeout(safetyTimer);
  }, [id]);

  useEffect(() => {
    fetchProductData();
    window.scrollTo(0, 0);
  }, [fetchProductData]);

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
    if (v.color) return v.color;
    if (v.size) return v.size;
    if (v.ohms) {
      const cleanOhm = v.ohms.replace(/[^\d.,]/g, '');
      return `${cleanOhm}Ω`;
    }
    if (v.volume_ml) return `${v.volume_ml}ml`;
    return 'Padrão';
  };

  const getVariantTypeInfo = (v: Variant) => {
    if (v.flavor_name) return { icon: Droplets, label: 'Sabor' };
    if (v.color) return { icon: Palette, label: 'Cor' };
    if (v.size) return { icon: FileText, label: 'Tamanho' };
    if (v.ohms) return { icon: Zap, label: 'Resistência' };
    if (v.volume_ml) return { icon: FileText, label: 'Volume' };
    return null;
  };

  const getVariantSubLabel = (v: Variant) => {
    const parts = [];
    if (v.volume_ml && v.flavor_name) parts.push(`${v.volume_ml}ml`);
    if (v.flavor_name && (v.ohms || v.color)) parts.push(v.ohms || v.color);
    return parts.join(' - ');
  };

  if (loading) return <div className="container mx-auto px-4 md:px-6 xl:px-8 py-4 md:py-10"><Skeleton className="w-full h-[500px] rounded-3xl bg-gray-200" /></div>;
  if (!product) return null;

  const currentFullPrice = (selectedVariant ? selectedVariant.price : product.price) ?? 0;
  const currentPixPrice = ((selectedVariant ? selectedVariant.pix_price : product.pix_price) || currentFullPrice) ?? 0;
  const installmentValue = (currentFullPrice / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  const currentStock = selectedVariant ? selectedVariant.stock_quantity : product.stock_quantity;
  const isOutOfStock = currentStock <= 0;

  return (
    <div className="bg-off-white min-h-screen text-charcoal-gray pb-28 md:pb-20">
      <div className="container mx-auto px-4 md:px-6 xl:px-8 2xl:px-12 py-4 md:py-10 xl:py-12">
        {/* Botão Voltar — desktop */}
        <div className="hidden md:block mb-4 xl:mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-stone-500 hover:text-charcoal-gray transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        {/* Botão Voltar — mobile (compacto) */}
        <div className="md:hidden mb-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-widest">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 xl:gap-20 items-start mb-10 xl:mb-16">
          {/* Imagem */}
          <div className="relative group lg:sticky lg:top-32">
            <div className="absolute -inset-4 bg-sky-500/5 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <ProductImage
              src={product.image_url || ''}
              alt={product.name}
              className={cn(
                "w-full object-contain md:object-cover rounded-[2rem] md:rounded-[2.5rem] xl:rounded-[3rem] border border-stone-100 shadow-xl md:shadow-2xl relative bg-white transition-all md:max-h-[500px] xl:max-h-[600px]",
                isOutOfStock && "grayscale opacity-80"
              )}
            />
            {isOutOfStock && (
                <div className="absolute top-4 left-4 md:top-6 md:left-6 bg-slate-900 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs font-black uppercase tracking-widest z-10 shadow-lg">
                    Esgotado
                </div>
            )}
          </div>

          {/* Informações do produto */}
          <div className="space-y-5 md:space-y-8 xl:space-y-10">
            {/* Categoria + Nome */}
            <div>
              <p className="text-sky-500 text-xs xl:text-sm font-black uppercase tracking-[0.4em] mb-2">{product.category}</p>
              <h1 className="text-2xl md:text-4xl xl:text-5xl font-black tracking-tighter leading-[0.95] mb-4 md:mb-6 xl:mb-8 text-charcoal-gray" translate="no">
                {product.name} 
                {selectedVariant && (
                    <span className="block text-xl md:text-3xl xl:text-4xl text-slate-400 mt-1 italic">
                        {getVariantLabel(selectedVariant)} {selectedVariant.volume_ml && selectedVariant.flavor_name ? `${selectedVariant.volume_ml}ml` : ''}
                    </span>
                )}
              </h1>
              
              {/* Preço */}
              <div className="bg-white/70 backdrop-blur-sm p-4 md:p-6 xl:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <p className="text-lg md:text-2xl xl:text-3xl font-black text-slate-900">
                      {currentFullPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <p className="text-xs xl:text-sm text-slate-500 font-medium mt-0.5">
                      ou até <span className="font-bold text-slate-700">3x</span> de <span className="font-bold text-slate-700">{installmentValue}</span> <span className="text-[10px] uppercase tracking-widest opacity-70">no cartão</span>
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center p-1.5 bg-sky-50 text-sky-600 rounded-lg border border-sky-100">
                        <PixIcon className="h-4 w-4" />
                        <span className="text-[10px] font-black ml-1 uppercase tracking-widest">pix</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">à vista</span>
                    </div>
                    <span className="text-2xl md:text-3xl xl:text-4xl font-black text-emerald-600 tracking-tighter">
                      {currentPixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Variantes */}
            {variants.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] xl:text-xs font-black uppercase tracking-[0.3em] text-slate-400">Escolha sua Opção</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-2 md:gap-3 xl:gap-4">
                  {variants.map((v) => {
                    const typeInfo = getVariantTypeInfo(v);
                    const TypeIcon = typeInfo?.icon || FileText;
                    
                    return (
                      <button
                        key={v.id}
                        onClick={() => handleVariantSelect(v)}
                        className={cn(
                          "p-3 md:p-4 xl:p-5 border-2 rounded-[1.2rem] md:rounded-[1.5rem] transition-all text-left relative overflow-hidden flex flex-col justify-center min-h-[70px] md:min-h-[90px] xl:min-h-[100px] group",
                          selectedVariant?.id === v.id 
                            ? "border-sky-500 bg-sky-50/50 shadow-lg ring-4 ring-sky-500/10" 
                            : "border-stone-100 bg-white hover:border-sky-200 hover:shadow-md",
                          v.stock_quantity <= 0 && "opacity-60 grayscale bg-stone-50 hover:border-stone-200 hover:shadow-none"
                        )}
                      >
                        {typeInfo && (
                          <div className="flex items-center gap-1 mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
                            <TypeIcon className="h-3 w-3" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">{typeInfo.label}</span>
                          </div>
                        )}

                        <p className="font-black text-xs xl:text-sm text-charcoal-gray uppercase tracking-tight leading-tight" translate="no">
                          {getVariantLabel(v)}
                        </p>
                        
                        {getVariantSubLabel(v) && (
                          <p className="text-[9px] xl:text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest">
                              {getVariantSubLabel(v)}
                          </p>
                        )}
                        
                        {v.stock_quantity <= 0 && (
                          <span className="absolute bottom-1.5 right-2 text-[8px] font-black text-red-500 uppercase tracking-wider">
                            Esgotado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantidade + Botão — apenas DESKTOP */}
            <div className="hidden md:block bg-slate-950 p-6 md:p-8 xl:p-10 rounded-[2rem] space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 blur-[40px] rounded-full" />

              <div className="relative z-10 space-y-4">
                <div className="bg-white p-5 xl:p-6 rounded-2xl border border-stone-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs xl:text-sm font-black uppercase tracking-[0.2em] text-slate-500">Quantidade</p>
                    <div className="flex items-center bg-stone-100 rounded-2xl p-1">
                      <Button
                        variant="outline"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="bg-stone-100 hover:bg-stone-200 text-black h-10 w-10 xl:h-12 xl:w-12 rounded-xl border border-stone-200 transition-all active:scale-95 shadow-sm"
                        disabled={isOutOfStock}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="w-14 xl:w-16 text-center font-black text-xl xl:text-2xl mx-2 select-none">
                        {quantity}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setQuantity(q => q + 1)}
                        className="bg-stone-100 hover:bg-stone-200 text-black h-10 w-10 xl:h-12 xl:w-12 rounded-xl border border-stone-200 transition-all active:scale-95 shadow-sm"
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
                    "w-full font-black uppercase tracking-[0.2em] h-14 xl:h-16 text-lg xl:text-xl rounded-[1.5rem] shadow-xl transition-all active:scale-95",
                    !isOutOfStock && "bg-sky-500 hover:bg-sky-400 text-white",
                    isOutOfStock && "bg-stone-800 text-stone-500 opacity-70"
                  )}
                  disabled={isAdding || isOutOfStock}
                >
                  {isAdding ? <Loader2 className="animate-spin h-6 w-6" /> : (
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-6 w-6" />
                      <span className={cn(
                        isOutOfStock ? 'text-stone-500' : 'text-white',
                        "text-xs xl:text-sm font-black uppercase tracking-widest"
                      )}>
                        {isOutOfStock ? 'ESGOTADO' : 'ADICIONAR AO CARRINHO'}
                      </span>
                    </span>
                  )}
                </Button>
              </div>

              <div className="space-y-3">
                <p className="text-lg md:text-xl xl:text-2xl font-black tracking-tighter leading-tight text-white">
                  {product.name}
                </p>
                {selectedVariant && (
                  <span className="block text-2xl md:text-3xl xl:text-4xl text-white text-opacity-90 mt-2 italic">
                    {getVariantLabel(selectedVariant)} {selectedVariant.volume_ml && selectedVariant.flavor_name ? `${selectedVariant.volume_ml}ml` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Descrição */}
        <div className="w-full">
          <Card className="bg-white border-none shadow-[0_30px_60px_-20px_rgba(0,0,0,0.05)] rounded-[2rem] md:rounded-[3rem] overflow-hidden">
            <CardContent className="p-6 md:p-12 xl:p-16">
              <div className="flex items-center space-x-4 mb-8 md:mb-10 xl:mb-12 border-b border-stone-50 pb-6 md:pb-8">
                <div className="p-3 md:p-4 bg-sky-50 rounded-xl md:rounded-2xl text-sky-600">
                  <FileText className="h-6 w-6 md:h-8 md:w-8" />
                </div>
                <h2 className="font-black text-2xl md:text-3xl xl:text-4xl tracking-tighter italic uppercase text-charcoal-gray">
                  Detalhes do Produto.
                </h2>
              </div>
              
              <div className="prose prose-stone prose-base md:prose-lg xl:prose-xl max-w-none text-slate-600 leading-relaxed font-medium">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || 'Sem descrição disponível.') }} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== STICKY BOTTOM BAR — apenas MOBILE ===== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-3">
          {/* Preço PIX */}
          <div className="flex flex-col leading-none shrink-0">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
              <PixIcon className="h-2.5 w-2.5" /> PIX
            </span>
            <span className="text-lg font-black text-emerald-600 tracking-tighter">
              {currentPixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>

          {/* Separador */}
          <div className="w-px h-10 bg-stone-200 shrink-0" />

          {/* Controle de quantidade */}
          <div className="flex items-center bg-stone-100 rounded-xl p-0.5 shrink-0">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={isOutOfStock}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-slate-700 active:scale-95 transition-all disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-9 text-center font-black text-base select-none">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              disabled={isOutOfStock}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-slate-700 active:scale-95 transition-all disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Botão Adicionar */}
          <button
            onClick={handleAddToCart}
            disabled={isAdding || isOutOfStock}
            className={cn(
              "flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
              isOutOfStock
                ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                : "bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/30"
            )}
          >
            {isAdding ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 shrink-0" />
                <span>{isOutOfStock ? 'Esgotado' : 'Adicionar'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;