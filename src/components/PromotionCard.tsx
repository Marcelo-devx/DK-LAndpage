import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { addToCart } from "@/utils/cart";
import { ShoppingCart } from "lucide-react";

interface PromotionCardProps {
  promotion: {
    id: number;
    name: string;
    price: string;
    imageUrl: string;
    url: string;
  };
}

const PromotionCard = ({ promotion }: PromotionCardProps) => {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(promotion.id, 1, 'promotion');
  };

  return (
    <Link to={promotion.url} className="group block h-full">
      <Card className="w-full h-full mx-auto border border-stone-200 hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden bg-white flex flex-col">
        <div className="overflow-hidden aspect-square">
          <img 
            src={promotion.imageUrl} 
            alt={promotion.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
          />
        </div>
        <CardContent className="p-4 text-center flex-grow flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-lg text-charcoal-gray h-14 flex items-center justify-center">{promotion.name}</h3>
            <p className="text-xl text-tobacco-brown font-semibold my-2">{promotion.price}</p>
          </div>
          <Button 
            className="w-full bg-gold-accent hover:bg-gold-accent/90 text-charcoal-gray font-bold mt-2"
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

export default PromotionCard;