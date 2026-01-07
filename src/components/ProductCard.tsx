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
  <svg width="12" height="12" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mr-1">
    <path d="M371.304 186.064L250 307.368L128.696 186.064L41.3043 273.456L250 482.152L458.696 273.456L371.304 186.064Z" fill="#32BCAD"/>
    <path d="M128.696 313.936L250 192.632L371.304 313.936L458.696 226.544L250 17.848L41.3043 226.544L128.696 313.936Z" fill="#32BCAD"/>
  </svg>
);

const ProductCard = ({ product }: ProductCardProps) => {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product.id, 1, 'product');
  };

  // Se o pixPrice não existir, usamos o preço cheio
  const mainPrice = product.pixPrice && product.pixPrice > 0 ? product.pixPrice : product.price;
  const fullPrice = product.price;
  
  const formattedPixPrice = mainPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedFullPrice = fullPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const installmentPrice = (fullPrice / 3).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Link to={product.url} className="group block h-full">
      <Card className="h-full bg-white border border-stone-200 hover:border-sky-500/50 transition-all duration-500 rounded-2xl overflow-hidden flex flex-col group-hover:shadow-xl">
        <div className="overflow-hidden aspect-square relative bg-white flex items-center justify-center">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out" 
          />
          <div className="absolute inset-x-0 bottom-0 bg-black/80 py-1.5 px-2 text-[9px] font-black text-white uppercase text-center tracking-tighter z-10">
            PRODUTOS APENAS PARA MAIORES DE 18+
          </div>
        </div>
        <CardContent className="p-5 md:p-6 flex-grow flex flex-col">
          <div className="flex-grow">
            <h3 className="text-slate-900 text-base font-bold tracking-tight line-clamp-2 h-12 mb-4 group-hover:text-sky-600 transition-colors leading-tight">
              {product.name}
            </h3>
            
            <div className="space-y-1.5">
                {product.pixPrice && product.pixPrice > 0 && (
                  <p className="text-[11px] font-medium text-stone-400 line-through">De {formattedFullPrice}</p>
                )}
                
                <div className="flex items-center gap-1.5">
                    <p className="text-2xl font-black text-slate-950 tracking-tighter">
                        {formattedPixPrice}
                    </p>
                    <div className="flex items-center bg-sky-50 px-2 py-1 rounded">
                      <PixIcon />
                      <span className="text-[10px] font-black uppercase text-sky-600 tracking-wider">no pix</span>
                    </div>
                </div>
                
                <p className="text-xs text-stone-500 font-medium">
                    ou 3x de <span className="text-slate-900 font-bold">{installmentPrice}</span>
                </p>
            </div>
          </div>
          
          <Button 
            className="w-full bg-slate-950 hover:bg-sky-600 text-white font-black uppercase text-xs tracking-[0.2em] mt-6 h-12 rounded-xl transition-all shadow-sm"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProductCard;