import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { addToCart } from "@/utils/cart";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useState } from "react";

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    price: number;
    pixPrice?: number | null;
    imageUrl: string;
    url: string;
  };
}

const PixIcon = () => (
  <svg width="10" height="10" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mr-1">
    <path d="M371.304 186.064L250 307.368L128.696 186.064L41.3043 273.456L250 482.152L458.696 273.456L371.304 186.064Z" fill="#32BCAD"/>
    <path d="M128.696 313.936L250 192.632L371.304 313.936L458.696 226.544L250 17.848L41.3043 226.544L128.696 313.936Z" fill="#32BCAD"/>
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

  const mainPrice = product.pixPrice && product.pixPrice > 0 ? product.pixPrice : product.price;
  const fullPrice = product.price;
  
  const formattedPixPrice = mainPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedFullPrice = fullPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const installmentPrice = (fullPrice / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Link to={product.url} className="group block h-full">
      <Card className="h-full bg-white border border-stone-200 hover:border-sky-500/50 transition-all duration-500 rounded-xl md:rounded-2xl overflow-hidden flex flex-col group-hover:shadow-xl">
        <div className="overflow-hidden aspect-[4/5] relative bg-white shrink-0">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
          />
          <div className="absolute inset-x-0 bottom-0 bg-black/80 py-1 px-2 text-[7px] md:text-[9px] font-black text-white uppercase text-center tracking-tighter z-10">
            18+ APENAS
          </div>
        </div>
        <CardContent className="p-3 md:p-6 flex-grow flex flex-col">
          <div className="flex-grow">
            <h3 className="text-slate-900 text-xs md:text-lg font-bold tracking-tight line-clamp-2 h-8 md:h-14 mb-2 md:mb-4 group-hover:text-sky-600 transition-colors leading-tight">
              {product.name}
            </h3>
            
            <div className="space-y-1">
                {product.pixPrice && product.pixPrice > 0 && (
                  <p className="text-[9px] md:text-[11px] font-medium text-stone-400 line-through">De {formattedFullPrice}</p>
                )}
                
                <div className="flex flex-wrap items-center gap-1">
                    <p className="text-sm md:text-2xl font-black text-slate-950 tracking-tighter">
                        {formattedPixPrice}
                    </p>
                    <div className="flex items-center bg-sky-50 px-1.5 py-0.5 rounded">
                      <PixIcon />
                      <span className="text-[8px] md:text-[10px] font-black uppercase text-sky-600 tracking-wider">pix</span>
                    </div>
                </div>
                
                <p className="text-[10px] md:text-sm text-stone-500 font-medium">
                    ou 3x <span className="text-slate-900 font-bold">{installmentPrice}</span>
                </p>
            </div>
          </div>
          
          <Button 
            className="w-full bg-slate-950 hover:bg-sky-600 text-white font-black uppercase text-[9px] md:text-xs tracking-widest mt-4 h-9 md:h-12 rounded-lg md:rounded-xl transition-all shadow-sm"
            onClick={handleAddToCart}
            disabled={isAdding}
          >
            {isAdding ? <Loader2 className="animate-spin h-4 w-4" /> : (
              <>
                <ShoppingCart className="mr-1.5 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
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