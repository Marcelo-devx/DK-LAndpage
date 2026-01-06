import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CategoryGridCardProps {
  category: {
    name: string;
    image_url: string | null;
  };
  onClick: () => void;
  className?: string;
}

const CategoryGridCard = ({ category, onClick, className }: CategoryGridCardProps) => {
  return (
    <Card 
      onClick={onClick} 
      className={cn(
        "relative cursor-pointer group overflow-hidden rounded-3xl border border-white/5 shadow-2xl transition-all duration-500 hover:border-sky-500/50",
        className
      )}
    >
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
        style={{ backgroundImage: `url(${category.image_url || 'https://picsum.photos/800/600'})` }}
      />
      {/* Overlay Futurista */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
      <div className="absolute inset-0 bg-sky-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative h-full flex flex-col justify-end p-8">
        <p className="text-sky-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">Explorar</p>
        <h3 className="text-2xl md:text-3xl text-white font-black tracking-tighter italic uppercase">
          {category.name}.
        </h3>
      </div>
    </Card>
  );
};

export default CategoryGridCard;