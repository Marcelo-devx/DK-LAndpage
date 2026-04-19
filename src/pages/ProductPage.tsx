import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Minus, ChevronLeft, Loader2, FileText, ShoppingCart, Zap, Palette, Droplets, ArrowLeft, ShoppingBag } from "lucide-react";
import { useAddToCart } from '@/hooks/useAddToCart';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';
import { Card, CardContent } from "@/components/ui/card";
import ProductImage from '@/components/ProductImage';
import DOMPurify from 'dompurify';
import ProductCard from '@/components/ProductCard';
import { useSEO } from '@/hooks/useSEO';

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

interface DisplayProduct {
  id: number;
  name: string;
  price: number;
  pixPrice: number | null;
  imageUrl: string;
  stockQuantity: number;
  variantId?: string;
  hasMultipleVariants?: boolean;
  showAgeBadge?: boolean;
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
  const [quantity, setQuantity] = useState(1);
  const [recommendedProducts, setRecommendedProducts] = useState<DisplayProduct[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(true);

  const { handleAddToCart, isAdding } = useAddToCart();

  // SEO — computed at top level (no hook inside useEffect)
  const seoTitle = product ? `${product.name} | DKCWB` : 'DKCWB';
  const seoDescription = product
    ? (product.description
        ? product.description.replace(/<[^>]*>/g, '').substring(0, 160)
        : `Confira ${product.name} na DKCWB. Curadoria exclusiva dos melhores produtos.`)
    : 'DKCWB — Curadoria exclusiva dos melhores produtos.';
  const seoImage = product?.image_url ?? null;
  const seoUrl = id ? `https://dkcwb.com/produto/${id}` : 'https://dkcwb.com';

  const seoJsonLd = useMemo(() => {
    if (!product) return undefined;
    const currentPrice = selectedVariant?.price ?? product.price;
    const availability = (selectedVariant?.stock_quantity ?? product.stock_quantity) > 0 ? 'InStock' : 'OutOfStock';
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: seoDescription,
      image: product.image_url || 'https://dkcwb.com/og-image.jpg',
      category: product.category || 'Produtos',
      offers: {
        '@type': 'Offer',
        price: currentPrice,
        priceCurrency: 'BRL',
        availability: `https://schema.org/${availability}`,
        seller: { '@type': 'Organization', name: 'DKCWB', url: 'https://dkcwb.com' }
      }
    };
  }, [product, selectedVariant, seoDescription]);

  useSEO({ title: seoTitle, description: seoDescription, image: seoImage, url: seoUrl, type: 'product', jsonLd: seoJsonLd });

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

  const fetchRecommendedProducts = useCallback(async () => {
    if (!id || !product) return;

    setLoadingRecommended(true);

    try {
      // Buscar todos os produtos disponíveis (exceto o atual)
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, stock_quantity, brand, is_featured, created_at')
        .eq('is_visible', true)
        .neq('id', Number(id))
        .order('stock_quantity', { ascending: false }); // Prioriza produtos com estoque

      const allProducts = productsData || [];

      // Helper to fetch variants and map to DisplayProduct
      const mapWithVariants = async (candidates: any[]) => {
        if (candidates.length === 0) return [] as DisplayProduct[];
        const productIds = candidates.map(p => p.id);
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, product_id, price, pix_price, stock_quantity')
          .in('product_id', productIds)
          .eq('is_active', true);

        const finalProducts: DisplayProduct[] = candidates.map(prod => {
          const prodVariants = variants?.filter((v: any) => v.product_id === prod.id) || [];

          if (prodVariants.length > 0) {
            const minPrice = Math.min(...prodVariants.map((v: any) => v.price ?? 0));
            const minPixPrice = Math.min(...prodVariants.map((v: any) => v.pix_price ?? v.price ?? 0));
            // Stock comes ONLY from variants — never from base product
            const variantStock = prodVariants.reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0);

            return {
              id: prod.id,
              name: prod.name,
              price: minPrice,
              pixPrice: minPixPrice,
              imageUrl: prod.image_url || '',
              stockQuantity: variantStock,
              hasMultipleVariants: true,
              showAgeBadge: true,
            } as DisplayProduct;
          }

          return {
            id: prod.id,
            name: prod.name,
            price: prod.price ?? 0,
            pixPrice: prod.pix_price ?? null,
            imageUrl: prod.image_url || '',
            stockQuantity: prod.stock_quantity || 0,
            hasMultipleVariants: false,
            showAgeBadge: true,
          } as DisplayProduct;
        });

        return finalProducts;
      };

      // Map all fetched products
      let finalCandidates = await mapWithVariants(allProducts);

      // Prefer in-stock products
      let available = finalCandidates.filter(p => (p.stockQuantity || 0) > 0);

      // If not enough available, try fetching featured in-stock products to fill
      if (available.length < 3) {
        const { data: featured } = await supabase
          .from('products')
          .select('id, name, price, pix_price, image_url, category, stock_quantity, brand, is_featured, created_at')
          .eq('is_visible', true)
          .eq('is_featured', true)
          .neq('id', Number(id))
          .order('stock_quantity', { ascending: false })
          .limit(6);

        const featuredMapped = await mapWithVariants(featured || []);
        const featuredAvailable = featuredMapped.filter(p => (p.stockQuantity || 0) > 0);

        // Merge featured in-stock without duplicates
        const byId = new Map<number, DisplayProduct>();
        available.forEach(p => byId.set(p.id, p));
        for (const p of featuredAvailable) {
          if (!byId.has(p.id)) byId.set(p.id, p);
        }
        available = Array.from(byId.values());
      }

      // Final selection: up to 3 random available products
      let selected: DisplayProduct[] = [];
      if (available.length >= 3) {
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        selected = shuffled.slice(0, 3);
      } else if (available.length > 0) {
        selected = available; // less than 3 but at least one in stock
      }

      setRecommendedProducts(selected);
    } catch (err) {
      console.error('Error fetching recommended products:', err);
      // On error, fallback to empty list (do not show out-of-stock)
      setRecommendedProducts([]);
    } finally {
      setLoadingRecommended(false);
    }
  }, [id, product]);

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

  useEffect(() => {
    if (product) {
      fetchRecommendedProducts();
    }
  }, [product, fetchRecommendedProducts]);

  const handleVariantSelect = (variant: Variant) => {
    setSelectedVariant(variant);
    setSearchParams({ variant: variant.id }, { replace: true });
  };

  const handleAddToCartClick = async () => {
    // Products with variants MUST have a variant selected — base product has no real stock
    if (variants.length > 0 && !selectedVariant) {
      showError("Selecione uma opção (sabor/cor/tamanho)");
      return;
    }
    
    const currentStock = selectedVariant ? selectedVariant.stock_quantity : (product?.stock_quantity || 0);
    if (currentStock <= 0) {
        showError("Produto esgotado.");
        return;
    }

    if (!product) return;
    
    await handleAddToCart(product.id, quantity, 'product', selectedVariant?.id);
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
  if (!product) return (
    <div className="min-h-screen bg-off-white flex flex-col items-center justify-center px-4 text-center">
      <div className="bg-stone-100 rounded-full p-6 mb-6">
        <ShoppingBag className="h-12 w-12 text-stone-400" />
      </div>
      <h2 className="font-black text-2xl uppercase tracking-tighter italic text-charcoal-gray mb-2">
        Produto não encontrado
      </h2>
      <p className="text-slate-500 text-sm font-medium max-w-xs mb-6">
        Este produto não está mais disponível ou o link está incorreto.
      </p>
      <button
        onClick={() => navigate('/produtos')}
        className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95"
      >
        Ver todos os produtos
      </button>
    </div>
  );

  const currentFullPrice = (selectedVariant ? selectedVariant.price : product.price) ?? 0;
  const currentPixPrice = ((selectedVariant ? selectedVariant.pix_price : product.pix_price) || currentFullPrice) ?? 0;
  const installmentValue = (currentFullPrice / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  // When product has variants, stock is determined by selected variant only
  // If no variant selected yet, show 0 to avoid misleading "in stock" state
  const currentStock = variants.length > 0
    ? (selectedVariant ? selectedVariant.stock_quantity : 0)
    : product.stock_quantity;
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
              fit="contain"
              className={cn(
                "w-full rounded-[2rem] md:rounded-[2.5rem] xl:rounded-[3rem] border border-stone-100 shadow-xl md:shadow-2xl relative bg-white transition-all max-h-[800px]",
                isOutOfStock && "grayscale opacity-80"
              )}
              priority={true}
              quality={55}
              maxWidth={900}
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
                  onClick={handleAddToCartClick}
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
        
        {/* Produtos Recomendados - SEMPRE MOSTRAR (compact) */}
        <div className="w-full mt-6 md:mt-8 xl:mt-10">
          <Card className="bg-white border-none shadow-[0_10px_30px_-18px_rgba(0,0,0,0.06)] rounded-[1.25rem] overflow-hidden">
            <CardContent className="p-4 md:p-6 xl:p-8">
              <div className="flex items-center space-x-3 mb-4 md:mb-6 border-b border-stone-50 pb-4">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <h3 className="font-black text-lg md:text-xl tracking-tighter italic uppercase text-charcoal-gray">
                  Quem comprou este produto também comprou
                </h3>
              </div>

              {loadingRecommended ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex flex-col space-y-2">
                      <Skeleton className="w-full rounded-2xl aspect-[4/5] bg-stone-200" />
                      <Skeleton className="h-3 w-3/4 rounded-lg bg-stone-200" />
                      <Skeleton className="h-3 w-1/2 rounded-lg bg-stone-200" />
                    </div>
                  ))}
                </div>
              ) : recommendedProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {recommendedProducts.map((p) => (
                    <div key={p.id} className="transform-gpu scale-95 origin-top">
                      <ProductCard
                        product={{
                          id: p.id,
                          name: p.name,
                          price: p.price,
                          pixPrice: p.pixPrice,
                          imageUrl: p.imageUrl,
                          stockQuantity: p.stockQuantity,
                          hasMultipleVariants: p.hasMultipleVariants,
                          showAgeBadge: p.showAgeBadge,
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm font-medium">
                    No momento não há recomendações disponíveis.
                  </p>
                </div>
              )}
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
            onClick={handleAddToCartClick}
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