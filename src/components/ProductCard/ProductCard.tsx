import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { addToCart } from "@/utils/cart";
import { ShoppingCart, Loader2, Eye } from "lucide-react";
import { useState, memo } from "react";
import { ProductCardProps } from "./ProductCard.types";
import { cn } from "@/lib/utils";
import ProductImage from "@/components/ProductImage";

const PixIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M371.304 186.064L250 307.368L128.696 186.064L41.3043 273.456L250 482.152L458.696 273.456L371.304 186.064Z" fill="currentColor"/>
    <path d="M128.696 313.936L250 192.632L371.304 313.936L458.696 226.544L250 17.848L41.3043 226.544L128.696 313.936Z" fill="currentColor"/>
  </svg>
);

const ProductCard = memo(({ product }: ProductCardProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    await addToCart(product.id, 1, 'product', product.variantId);
    setIsAdding(false);
  };

  const handleViewOptions = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/produto/${product.id}`);
  };

  const hasMultipleVariants = product.hasMultipleVariants;
  const fullPrice = product.price ?? 0;
  const hasPixDiscount = product.pixPrice && product.pixPrice > 0 && product.pixPrice < fullPrice;
  const pixPrice = hasPixDiscount ? product.pixPrice! : fullPrice;
  
  const pricePrefix = hasMultipleVariants ? "A partir de " : "";
  const formattedFullPrice = fullPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const installmentValue = (fullPrice / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedPixPrice = pixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const linkUrl = product.hasMultipleVariants
    ? `/produto/${product.id}`
    : product.variantId
        ? `/produto/${product.id}?variant=${product.variantId}`
        : `/produto/${product.id}`;
  
  // Consider a product out of stock whenever the known stock quantity is 0 or less,
  // independent of whether it has multiple variants. This ensures products with
  // total variant stock = 0 are shown as esgotado and do not get priority.
  const isOutOfStock = typeof product.stockQuantity === 'number' ? product.stockQuantity <= 0 : false;

  return (
    <Link to={linkUrl} className="group block h-full">
      <Card className={cn("h-full bg-white border border-stone-100 hover:border-sky-500/30 transition-all duration-500 rounded-2xl overflow-hidden flex flex-col group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]", isOutOfStock && "opacity-80")}>
        <div className="overflow-hidden aspect-square md:aspect-[4/5] relative bg-white shrink-0">
          <ProductImage 
            src={product.imageUrl} 
            alt={product.name} 
            className={cn("w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out", isOutOfStock && "grayscale")} 
          />
          {product.showAgeBadge !== false && !isOutOfStock && (
            <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm py-1 px-2 text-[7px] font-black text-white uppercase text-center tracking-[0.15em] z-10">
              Apenas Maiores de 18 Anos
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                <span className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg transform -rotate-12 border border-white/20">
                    Esgotado
                </span>
            </div>
          )}
        </div>
        
        <CardContent className="p-2 md:p-3 xl:p-4 flex-grow flex flex-col">
          <div className="flex-grow space-y-2">
            <h3 className="text-slate-900 text-[11px] md:text-sm xl:text-[15px] font-bold tracking-tight line-clamp-2 group-hover:text-sky-600 transition-colors leading-tight" translate="no">
              {product.name}
            </h3>
            
            <div className="space-y-0.5">
              {/* Preço cheio + parcelamento */}
              <p className="text-[11px] md:text-[13px] xl:text-sm font-black text-slate-900 leading-none">
                {pricePrefix}{formattedFullPrice}
              </p>
              <p className="text-[9px] md:text-[10px] xl:text-[11px] text-slate-700 font-medium">
                3x de <span className="font-black">{installmentValue}</span> <span className="text-sky-600 font-black uppercase">cartão</span>
              </p>
              
              {/* Bloco PIX */}
              <div className="pt-1.5">
                <div className="flex items-center gap-1 mb-0.5">
                  <div className="flex items-center justify-center px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">
                    <PixIcon className="h-2.5 w-2.5" />
                    <span className="text-[8px] font-black ml-0.5 uppercase">pix</span>
                  </div>
                  <span className="text-[8px] font-black text-emerald-600/60 uppercase">à vista</span>
                </div>
                <p className="text-lg md:text-xl xl:text-2xl font-black text-emerald-600 tracking-tighter leading-none">
                  {pricePrefix}{formattedPixPrice}
                </p>
              </div>
            </div>
          </div>

          {/* Botão de ação */}
          <div className="mt-3">
            {hasMultipleVariants ? (
              <Button 
                className="w-full font-black uppercase text-[9px] md:text-[10px] xl:text-[11px] tracking-widest h-9 md:h-10 xl:h-11 rounded-xl transition-all duration-300 bg-slate-950 hover:bg-sky-500 text-white whitespace-nowrap"
                onClick={handleViewOptions}
                aria-label="Escolher opções"
              >
                <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                Ver Opções
              </Button>
            ) : (
              <Button 
                className={cn(
                    "w-full font-black uppercase text-[9px] md:text-[10px] xl:text-[11px] tracking-widest h-9 md:h-10 xl:h-11 rounded-xl transition-all duration-300 whitespace-nowrap",
                    isOutOfStock ? "bg-stone-200 text-stone-500 cursor-not-allowed hover:bg-stone-200" : "bg-slate-950 hover:bg-sky-500 text-white"
                )}
                onClick={handleAddToCart}
                disabled={isAdding || isOutOfStock}
              >
                {isAdding ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : (
                  <>
                    <ShoppingCart className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    {isOutOfStock ? 'Esgotado' : 'Adicionar'}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});

export default ProductCard;