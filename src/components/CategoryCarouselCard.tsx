import { Card } from "@/components/ui/card";
import ProductImage from '@/components/ProductImage';

interface CategoryCarouselCardProps {
  category: {
    name:string;
    imageUrl: string;
  };
  onClick: () => void;
}

const CategoryCarouselCard = ({ category, onClick }: CategoryCarouselCardProps) => {
  return (
    <Card 
      onClick={onClick} 
      className="relative aspect-square rounded-lg overflow-hidden shadow-lg group cursor-pointer border-none"
    >
      <ProductImage
        src={category.imageUrl}
        alt={category.name}
        className="w-full h-full object-cover"
        quality={40}
        maxWidth={720}
      />
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center p-2">
        <h3 className="font-serif text-xl text-white font-medium text-center" translate="no">{category.name}</h3>
      </div>
    </Card>
  );
};

export default CategoryCarouselCard;