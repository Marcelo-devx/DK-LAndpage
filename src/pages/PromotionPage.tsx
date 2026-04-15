import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Plus, Minus, ArrowLeft, ShoppingCart, Loader2, Tag, Droplets, Palette, Zap, FileText, Package, CheckCircle2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { addToCart } from '@/utils/cart';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import PromotionCard from '@/components/PromotionCard';
import ProductImage from '@/components/ProductImage';
import { useSEO } from '@/hooks/useSEO';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import DOMPurify from 'dompurify';

const PixIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M371.304 186.064L250 307.368L128.696 186.064L41.3043 273.456L250 482.152L458.696 273.456L371.304 186.064Z" fill="currentColor"/>
    <path d="M128.696 313.936L250 192.632L371.304 313.936L458.696 226.544L250 17.848L41.3043 226.544L128.696 313.936Z" fill="currentColor"/>
  </svg>
);

interface Promotion {
  id: number;
  name: string;
  price: number;
  pix_price: number | null;
  discount_percent: number | null;
  description: string | null;
  image_url: string | null;
  stock_quantity?: number | null;
}

interface PromotionItem {
  id: number;
  product_id: number | null;
  variant_id: string | null;
  quantity: number;
  product_name: string;
  product_image: string | null;
  variant_flavor: string | null;
  variant_color: string | null;
  variant_size: string | null;
  variant_ohms: string | null;
  variant_volume_ml: number | null;
  variant_price: number | null;
  variant_pix_price: number | null;
  variant_stock: number | null;
}

interface RelatedPromotion {
  id: number;
  name: string;
  price: number;
  pix_price: number | null;
  discount_percent: number | null;
  image_url: string | null;
  stock_quantity?: number | null;
}

const getVariantLabel = (item: PromotionItem): string | null => {
  if (item.variant_flavor) return item.variant_flavor;
  if (item.variant_color) return item.variant_color;
  if (item.variant_size) return item.variant_size;
  if (item.variant_ohms) return `${item.variant_ohms.replace(/[^\d.,]/g, '')}Ω`;
  if (item.variant_volume_ml) return `${item.variant_volume_ml}ml`;
  return null;
};

const getVariantIcon = (item: PromotionItem) => {
  if (item.variant_flavor) return Droplets;
  if (item.variant_color) return Palette;
  if (item.variant_ohms) return Zap;
  return FileText;
};

const PromotionPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [relatedPromotions, setRelatedPromotions] = useState<RelatedPromotion[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);

  const seoTitle = promotion ? `${promotion.name} | Promoção | DKCWB` : 'Promoção | DKCWB';
  const seoDescription = promotion
    ? (promotion.description
        ? promotion.description.replace(/<[^>]*>/g, '').substring(0, 160)
        : `Confira a promoção ${promotion.name} na DKCWB. Ofertas exclusivas por tempo limitado.`)
    : 'Ofertas exclusivas por tempo limitado na DKCWB.';

  useSEO({
    title: seoTitle,
    description: seoDescription,
    image: promotion?.image_url ?? null,
    url: id ? `https://dkcwb.com/promocao/${id}` : 'https://dkcwb.com',
    type: 'article',
  });

  const fetchPromotionData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setPromotion(null);
    setPromotionItems([]);
    setRelatedPromotions([]);

    // Buscar promoção
    const { data, error } = await supabase
      .from('promotions')
      .select('id, name, description, price, pix_price, discount_percent, image_url, stock_quantity')
      .eq('id', id)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }
    setPromotion(data);

    // Buscar itens da promoção
    const { data: itemsData } = await supabase
      .from('promotion_items')
      .select('id, product_id, variant_id, quantity')
      .eq('promotion_id', id);

    if (itemsData && itemsData.length > 0) {
      // Buscar produtos
      const productIds = [...new Set(itemsData.map((i: any) => i.product_id).filter(Boolean))];
      const variantIds = [...new Set(itemsData.map((i: any) => i.variant_id).filter(Boolean))];

      const [productsRes, variantsRes] = await Promise.all([
        productIds.length > 0
          ? supabase.from('products').select('id, name, image_url').in('id', productIds)
          : Promise.resolve({ data: [] }),
        variantIds.length > 0
          ? supabase.from('product_variants').select('id, flavor_id, color, size, ohms, volume_ml, price, pix_price, stock_quantity').in('id', variantIds)
          : Promise.resolve({ data: [] }),
      ]);

      const products = productsRes.data || [];
      const variants = variantsRes.data || [];

      // Buscar sabores
      const flavorIds = [...new Set(variants.map((v: any) => v.flavor_id).filter(Boolean))];
      let flavors: any[] = [];
      if (flavorIds.length > 0) {
        const { data: flavorsData } = await supabase.from('flavors').select('id, name').in('id', flavorIds);
        flavors = flavorsData || [];
      }

      const mapped: PromotionItem[] = itemsData.map((item: any) => {
        const product = products.find((p: any) => p.id === item.product_id);
        const variant = variants.find((v: any) => v.id === item.variant_id);
        const flavor = variant ? flavors.find((f: any) => f.id === variant.flavor_id) : null;

        return {
          id: item.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity ?? 1,
          product_name: product?.name ?? 'Produto',
          product_image: product?.image_url ?? null,
          variant_flavor: flavor?.name ?? null,
          variant_color: variant?.color ?? null,
          variant_size: variant?.size ?? null,
          variant_ohms: variant?.ohms ?? null,
          variant_volume_ml: variant?.volume_ml ?? null,
          variant_price: variant?.price ?? null,
          variant_pix_price: variant?.pix_price ?? null,
          variant_stock: variant?.stock_quantity ?? null,
        };
      });

      setPromotionItems(mapped);
    }

    // Buscar promoções relacionadas
    const { data: relatedData } = await supabase
      .from('promotions')
      .select('id, name, price, pix_price, discount_percent, image_url, stock_quantity')
      .eq('is_active', true)
      .neq('id', id)
      .limit(4);

    setRelatedPromotions(relatedData || []);
    setLoadingRelated(false);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchPromotionData();
    window.scrollTo(0, 0);
  }, [fetchPromotionData]);

  const handleAddToCart = async () => {
    if (!promotion) return;
    const isOutOfStock = typeof promotion.stock_quantity === 'number' && promotion.stock_quantity <= 0;
    if (isOutOfStock) return;
    setIsAdding(true);
    await addToCart(promotion.id, quantity, 'promotion');
    setIsAdding(false);
  };

  if (loading) {
    return (
      <div className="bg-off-white min-h-screen">
        <div className="container mx-auto px-4 md:px-6 xl:px-8 py-4 md:py-10">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-start">
            <Skeleton className="w-full aspect-square rounded-[2rem] bg-stone-200" />
            <div className="flex flex-col space-y-6">
              <Skeleton className="h-4 w-1/4 bg-stone-200" />
              <Skeleton className="h-12 w-3/4 bg-stone-200" />
              <Skeleton className="h-10 w-1/3 bg-stone-200" />
              <Skeleton className="h-24 w-full bg-stone-200" />
              <Skeleton className="h-14 w-full bg-stone-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!promotion) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-10 text-center">
        <h1 className="font-serif text-4xl text-charcoal-gray mb-4">Promoção não encontrada</h1>
        <p className="text-stone-600 mb-8">A promoção que você está procurando não existe ou foi removida.</p>
        <Button asChild>
          <Link to="/">Voltar para a Página Inicial</Link>
        </Button>
      </div>
    );
  }

  const isOutOfStock = typeof promotion.stock_quantity === 'number' && promotion.stock_quantity <= 0;
  const fullPrice = promotion.price ?? 0;
  const pixPrice = promotion.pix_price || fullPrice;
  const installmentValue = (fullPrice / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

        {/* Botão Voltar — mobile */}
        <div className="md:hidden mb-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-widest">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 xl:gap-20 items-start mb-10 xl:mb-16">

          {/* Imagem */}
          <div className="relative group lg:sticky lg:top-32">
            <div className="absolute -inset-4 bg-amber-500/5 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <ProductImage
              src={promotion.image_url || ''}
              alt={promotion.name}
              fit="contain"
              className={cn(
                "w-full rounded-[2rem] md:rounded-[2.5rem] xl:rounded-[3rem] border border-stone-100 shadow-xl md:shadow-2xl relative bg-white transition-all max-h-[800px]",
                isOutOfStock && "grayscale opacity-80"
              )}
              priority={true}
              quality={70}
              maxWidth={1200}
            />
            {/* Badge de desconto */}
            {promotion.discount_percent && promotion.discount_percent > 0 && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1.5 rounded-xl text-sm font-black uppercase tracking-widest shadow-lg z-10">
                -{promotion.discount_percent}% OFF
              </div>
            )}
            {/* Badge oferta */}
            {!isOutOfStock && (
              <div className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg z-10 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Oferta Exclusiva
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute top-4 left-4 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest z-10 shadow-lg">
                Esgotado
              </div>
            )}
          </div>

          {/* Informações */}
          <div className="space-y-5 md:space-y-8 xl:space-y-10">
            <div>
              <p className="text-amber-500 text-xs xl:text-sm font-black uppercase tracking-[0.4em] mb-2">Promoção Exclusiva</p>
              <h1 className="text-2xl md:text-4xl xl:text-5xl font-black tracking-tighter leading-[0.95] mb-4 md:mb-6 xl:mb-8 text-charcoal-gray">
                {promotion.name}
              </h1>

              {/* Preços */}
              <div className="bg-white/70 backdrop-blur-sm p-4 md:p-6 xl:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <p className="text-lg md:text-2xl xl:text-3xl font-black text-slate-900">
                      {fullPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                      {pixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>

                {/* Estoque */}
                {typeof promotion.stock_quantity === 'number' && promotion.stock_quantity > 0 && promotion.stock_quantity <= 10 && (
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest">
                    ⚡ Apenas {promotion.stock_quantity} unidades restantes!
                  </p>
                )}
              </div>
            </div>

            {/* Itens da promoção */}
            {promotionItems.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] xl:text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                  O que está incluído
                </p>
                <div className="space-y-2">
                  {promotionItems.map((item) => {
                    const variantLabel = getVariantLabel(item);
                    const VariantIcon = getVariantIcon(item);
                    const itemOutOfStock = typeof item.variant_stock === 'number' && item.variant_stock <= 0;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-3 md:p-4 rounded-[1.2rem] border-2 bg-white transition-all",
                          itemOutOfStock
                            ? "border-red-100 opacity-60"
                            : "border-stone-100 hover:border-sky-200"
                        )}
                      >
                        {/* Imagem do produto */}
                        {item.product_image && (
                          <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden border border-stone-100 bg-stone-50">
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* Informações */}
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-xs md:text-sm text-charcoal-gray leading-tight truncate" translate="no">
                            {item.product_name}
                          </p>

                          {variantLabel && (
                            <div className="flex items-center gap-1 mt-1">
                              <VariantIcon className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {variantLabel}
                              </span>
                              {item.variant_volume_ml && item.variant_flavor && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  · {item.variant_volume_ml}ml
                                </span>
                              )}
                            </div>
                          )}

                          {/* Preço individual da variante */}
                          {item.variant_price && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 font-medium line-through">
                                {item.variant_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              {item.variant_pix_price && item.variant_pix_price < item.variant_price && (
                                <span className="text-[10px] text-emerald-600 font-black flex items-center gap-0.5">
                                  <PixIcon className="h-2.5 w-2.5" />
                                  {item.variant_pix_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quantidade + status */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {item.quantity > 1 && (
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              x{item.quantity}
                            </span>
                          )}
                          {itemOutOfStock ? (
                            <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">Esgotado</span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botão — apenas DESKTOP */}
            <div className="hidden md:block bg-slate-950 p-6 md:p-8 xl:p-10 rounded-[2rem] space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-[40px] rounded-full" />

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
                  onClick={handleAddToCart}
                  className={cn(
                    "w-full font-black uppercase tracking-[0.2em] h-14 xl:h-16 text-lg xl:text-xl rounded-[1.5rem] shadow-xl transition-all active:scale-95",
                    !isOutOfStock && "bg-amber-500 hover:bg-amber-400 text-white",
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

              <div className="space-y-1">
                <p className="text-lg md:text-xl xl:text-2xl font-black tracking-tighter leading-tight text-white">
                  {promotion.name}
                </p>
                <p className="text-amber-400 text-sm font-bold">
                  {pixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no PIX
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Descrição */}
        {promotion.description && (
          <div className="w-full mb-6 md:mb-8">
            <Card className="bg-white border-none shadow-[0_30px_60px_-20px_rgba(0,0,0,0.05)] rounded-[2rem] md:rounded-[3rem] overflow-hidden">
              <CardContent className="p-6 md:p-12 xl:p-16">
                <div className="flex items-center space-x-4 mb-8 md:mb-10 border-b border-stone-50 pb-6 md:pb-8">
                  <div className="p-3 md:p-4 bg-amber-50 rounded-xl md:rounded-2xl text-amber-600">
                    <Package className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                  <h2 className="font-black text-2xl md:text-3xl xl:text-4xl tracking-tighter italic uppercase text-charcoal-gray">
                    Detalhes da Promoção.
                  </h2>
                </div>
                <div className="prose prose-stone prose-base md:prose-lg xl:prose-xl max-w-none text-slate-600 leading-relaxed font-medium">
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(promotion.description) }} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Outras promoções */}
      {relatedPromotions.length > 0 && (
        <ScrollAnimationWrapper>
          <section className="bg-stone-100 py-8 md:py-16">
            <div className="container mx-auto px-4">
              <h2 className="font-black text-2xl md:text-3xl xl:text-4xl tracking-tighter italic uppercase text-center text-charcoal-gray mb-8 md:mb-12">
                Outras Promoções
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                {loadingRelated ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex flex-col space-y-3">
                      <Skeleton className="w-full rounded-2xl aspect-square bg-stone-200" />
                      <Skeleton className="h-4 w-3/4 bg-stone-200" />
                      <Skeleton className="h-4 w-1/2 bg-stone-200" />
                    </div>
                  ))
                ) : (
                  relatedPromotions.map((promo) => (
                    <PromotionCard key={promo.id} promotion={{
                      id: promo.id,
                      name: promo.name,
                      price: `R$ ${(promo.price ?? 0).toFixed(2).replace('.', ',')}`,
                      pixPrice: promo.pix_price ? `R$ ${(promo.pix_price).toFixed(2).replace('.', ',')}` : null,
                      imageUrl: promo.image_url || '',
                      url: `/promocao/${promo.id}`,
                      stockQuantity: promo.stock_quantity ?? null,
                      discountPercent: promo.discount_percent ?? null,
                    }} />
                  ))
                )}
              </div>
            </div>
          </section>
        </ScrollAnimationWrapper>
      )}

      {/* ===== STICKY BOTTOM BAR — apenas MOBILE ===== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-3">
          {/* Preço PIX */}
          <div className="flex flex-col leading-none shrink-0">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
              <PixIcon className="h-2.5 w-2.5" /> PIX
            </span>
            <span className="text-lg font-black text-emerald-600 tracking-tighter">
              {pixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                : "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/30"
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

export default PromotionPage;
