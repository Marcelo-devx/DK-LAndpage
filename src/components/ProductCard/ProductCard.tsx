import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { addToCart } from "@/utils/cart";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useState } from "react";
import { ProductCardProps } from "./ProductCard.types";

const ProductCard = ({ product }: ProductCardProps) => {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    await addToCart(product.id, 1, 'product');
    setIsAdding(false);
  };

  const mainPrice = product.pixPrice || product.price;
  
  return (
    <Link to={`/produto/${product.id}`} className="group block h-full">
      <Card className="h-full bg-white border border-stone-200 hover:border-sky-500/50 transition-all duration-500 rounded-xl overflow-hidden flex flex-col group-hover:shadow-xl">
        <div className="overflow-hidden aspect-[4/5] relative bg-white shrink-0">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
          />
        </div>
        <CardContent className="p-4 flex-grow flex flex-col">
          <h3 className="text-slate-900 text-sm font-bold tracking-tight line-clamp-2 h-10 mb-2">{product.name}</h3>
          <div className="mt-auto">
            <p className="text-xl font-black text-slate-950 tracking-tighter">
              {mainPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <Button 
              className="w-full bg-slate-950 hover:bg-sky-600 text-white font-black uppercase text-[10px] tracking-widest mt-4 h-10"
              onClick={handleAddToCart}
              disabled={isAdding}
            >
              {isAdding ? <Loader2 className="animate-spin h-4 w-4" /> : "Adicionar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ProductCard;