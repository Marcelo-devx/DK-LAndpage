import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { addToCart } from "@/utils/cart";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useState } from "react";
import { ProductCardProps } from "./ProductCard.types";

const PixIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M371.304 186.064L250 307.368L128.696 186.064L41.3043 273.456L250 482.152L458.696 273.456L371.304 186.064Z" fill="currentColor"/>
    <path d="M128.696 313.936L250 192.632L371.304 313.936L458.696 226.544L250 17.848L41.3043 226.544L128.696 313.936Z" fill="currentColor"/>
  </svg>
);

const ProductCard = ({ product }: ProductCardProps) => {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    await addToCart(product.id, 1, 'product');
    setIsAdding(false);
  };

  const hasPixDiscount = product.pixPrice && product.pixPrice > 0 && product.pixPrice < product.price;
  const pixPrice = hasPixDiscount ? product.pixPrice! : product.price;
  const fullPrice = product.price;
  
  const formattedFullPrice = fullPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const installmentValue = (fullPrice / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedPixPrice = pixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Link to={`/produto/${product.id}`} className="group block h-full">
      <Card className="h-full bg-white border border-stone-100 hover:border-sky-500/30 transition-all duration-500 rounded-2xl overflow-hidden flex flex-col group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]">
        <div className="overflow-hidden aspect-[4/5] relative bg-white shrink-0">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" 
          />
          <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm py-1.5 px-2 text-[8px] font-black text-white uppercase text-center tracking-[0.2em] z-10">
            Apenas Maiores de 18 Anos
          </div>
        </div>
        
        <CardContent className="p-4 md:p-6 flex-grow flex flex-col">
          <div className="flex-grow space-y-4">
            <h3 className="text-slate-900 text-sm md:text-base font-bold tracking-tight line-clamp-2 h-10 md:h-12 group-hover:text-sky-600 transition-colors leading-tight" translate="no">
              {product.name}
            </h3>
            
            <div className="space-y-1.5 pt-1">
                {/* Preço cheio maior */}
                <p className="text-[17px] md:text-[19px] font-black text-slate-400 leading-none">
                    {formattedFullPrice}
                </p>
                
                {/* Parcelamento maior e mais legível */}
                <p className="text-[12px] md:text-[13px] text-slate-500 font-bold tracking-tight">
                    até <span className="text-slate-800">3X</span> de <span className="text-slate-800">{installmentValue}</span> <span className="text-sky-600 uppercase">NO CARTÃO</span>
                </p>
                
                {/* Destaque PIX Gigante */}
                <div className="flex flex-col gap-2 pt-4">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                          <PixIcon className="h-4 w-4" />
                          <span className="text-[10px] font-black ml-1 uppercase tracking-wider">pix</span>
                        </div>
                        <span className="text-xs font-black text-emerald-600/70 uppercase">à vista</span>
                    </div>
                    
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl md:text-5xl font-black text-emerald-600 tracking-tighter leading-none">
                            {formattedPixPrice}
                        </span>
                    </div>
                </div>
            </div>
          </div>
          
          <Button 
            className="w-full bg-slate-950 hover:bg-sky-500 text-white font-black uppercase text-xs tracking-[0.2em] mt-8 h-12 rounded-xl transition-all duration-300 shadow-md group-hover:translate-y-[-2px]"
            onClick={handleAddToCart}
            disabled={isAdding}
          >
            {isAdding ? <Loader2 className="animate-spin h-4 w-4" /> : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Adicionar
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProductCard;