import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { addToCart } from "@/utils/cart";
import { ShoppingCart, Loader2, Tag } from "lucide-react";
import { useState, memo } from "react";
import { cn } from "@/lib/utils";
import ProductImage from '@/components/ProductImage';

const PixIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M371.304 186.064L250 307.368L128.696 186.064L41.3043 273.456L250 482.152L458.696 273.456L371.304 186.064Z" fill="currentColor"/>
    <path d="M128.696 313.936L250 192.632L371.304 313.936L458.696 226.544L250 17.848L41.3043 226.544L128.696 313.936Z" fill="currentColor"/>
  </svg>
);

interface PromotionCardProps {
  promotion: {
    id: number;
    name: string;
    price: string;
    pixPrice?: string | null;
    imageUrl: string;
    url: string;
    stockQuantity?: number | null;
    discountPercent?: number | null;
  };
}

const PromotionCard = memo(({ promotion }: PromotionCardProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();

  const isOutOfStock = typeof promotion.stockQuantity === 'number' && promotion.stockQuantity <= 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    setIsAdding(true);
    await addToCart(promotion.id, 1, 'promotion');
    setIsAdding(false);
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(promotion.url);
  };

  const hasPixPrice = promotion.pixPrice && promotion.pixPrice !== promotion.price;

  return (
    <Link to={promotion.url} className="group block h-full">
      <Card className={cn(
        "h-full bg-white border border-stone-100 hover:border-sky-500/30 transition-all duration-500 rounded-2xl overflow-hidden flex flex-col group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]",
        isOutOfStock && "opacity-80"
      )}>
        <div className="overflow-hidden aspect-square md:aspect-[4/5] relative bg-white shrink-0">
          <ProductImage
            src={promotion.imageUrl}
            alt={promotion.name}
            className={cn(
              "w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out",
              isOutOfStock && "grayscale"
            )}
            quality={15}
            maxWidth={360}
          />

          {/* Badge de desconto */}
          {promotion.discountPercent && promotion.discountPercent > 0 && !isOutOfStock && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg z-10">
              -{promotion.discountPercent}%
            </div>
          )}

          {/* Badge de promoção */}
          {!isOutOfStock && (
            <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg z-10 flex items-center gap-1">
              <Tag className="h-2.5 w-2.5" />
              Oferta
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
              {promotion.name}
            </h3>

            <div className="space-y-0.5">
              <p className="text-[11px] md:text-[13px] xl:text-sm font-black text-slate-900 leading-none">
                {promotion.price}
              </p>
              <p className="text-[9px] md:text-[10px] xl:text-[11px] text-slate-700 font-medium">
                3x de <span className="font-black">{promotion.price}</span> <span className="text-sky-600 font-black uppercase">cartão</span>
              </p>

              <div className="pt-1.5">
                <div className="flex items-center gap-1 mb-0.5">
                  <div className="flex items-center justify-center px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">
                    <PixIcon className="h-2.5 w-2.5" />
                    <span className="text-[8px] font-black ml-0.5 uppercase">pix</span>
                  </div>
                  <span className="text-[8px] font-black text-emerald-600/60 uppercase">à vista</span>
                </div>
                <p className="text-lg md:text-xl xl:text-2xl font-black text-emerald-600 tracking-tighter leading-none">
                  {hasPixPrice ? promotion.pixPrice : promotion.price}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <Button
              className={cn(
                "w-full font-black uppercase text-[9px] md:text-[10px] xl:text-[11px] tracking-widest h-9 md:h-10 xl:h-11 rounded-xl transition-all duration-300 whitespace-nowrap",
                isOutOfStock
                  ? "bg-stone-200 text-stone-500 cursor-not-allowed hover:bg-stone-200"
                  : "bg-slate-950 hover:bg-sky-500 text-white"
              )}
              onClick={isOutOfStock ? undefined : handleAddToCart}
              disabled={isAdding || isOutOfStock}
            >
              {isAdding ? (
                <Loader2 className="animate-spin h-3.5 w-3.5" />
              ) : (
                <>
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  {isOutOfStock ? 'Esgotado' : 'Adicionar'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});

export default PromotionCard;