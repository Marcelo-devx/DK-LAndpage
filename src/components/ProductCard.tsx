import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { addToCart } from "@/utils/cart";
import { ShoppingCart } from "lucide-react";

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
  <svg width="12" height="12" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mr-1 md:mr-1.5">
    <path d="M371.304 186.064L250 307.368L128.696 186.064L41.3043 273.456L250 482.152L458.696 273.456L371.304 186.064Z" fill="#32BCAD"/>
    <path d="M128.696 313.936L250 192.632L371.304 313.936L458.696 226.544L250 17.848L41.3043 226.544L128.696 313.936Z" fill="#32BCAD"/>
  </svg>
);

const ProductCard = ({ product }: ProductCardProps) => {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product.id, 1, 'product');
  };

  const formattedPrice = product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const installmentPrice = (product.price / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pixPrice = product.pixPrice ? product.pixPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;

  return (
    <Link to={product.url} className="group block h-full">
      <Card className="h-full bg-white border border-stone-200 hover:border-sky-500/50 transition-all duration-500 rounded-xl md:rounded-2xl overflow-hidden flex flex-col group-hover:shadow-xl">
        <div className="overflow-hidden aspect-square relative bg-stone-100">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
          />
          <div className="absolute inset-x-0 bottom-0 bg-black/80 py-1 md:py-1.5 px-2 text-[6px] md:text-[9px] font-black text-white uppercase text-center tracking-tight md:tracking-tighter">
            PRODUTOS APENAS PARA MAIORES DE 18+
          </div>
        </div>
        <CardContent className="p-3 md:p-5 flex-grow flex flex-col">
          <div className="flex-grow">
            <h3 className="text-slate-900 text-[11px] md:text-sm font-bold tracking-tight line-clamp-2 h-7 md:h-10 mb-2 md:mb-4 group-hover:text-sky-600 transition-colors leading-tight">
              {product.name}
            </h3>
            
            <div className="space-y-0.5">
                <p className="text-[9px] md:text-[11px] font-medium text-stone-400 line-through">De {formattedPrice}</p>
                <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
                    <p className="text-sm md:text-xl font-black text-slate-950 tracking-tighter">
                        {pixPrice || formattedPrice}
                    </p>
                    <div className="flex items-center bg-sky-50 px-1 py-0.5 rounded shrink-0">
                      <PixIcon />
                      <span className="text-[7px] md:text-[9px] font-black uppercase text-sky-600 tracking-wider">no pix</span>
                    </div>
                </div>
                <p className="text-[9px] md:text-[11px] text-stone-500 font-medium">
                    ou 3x de <span className="text-slate-900 font-bold">{installmentPrice}</span>
                </p>
            </div>
          </div>
          
          <Button 
            className="w-full bg-slate-950 hover:bg-sky-600 text-white font-black uppercase text-[8px] md:text-[10px] tracking-wider md:tracking-[0.2em] mt-3 md:mt-5 h-9 md:h-11 rounded-lg md:rounded-xl transition-all shadow-sm"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="mr-1.5 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            Adicionar
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProductCard;