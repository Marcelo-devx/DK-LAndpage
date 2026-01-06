import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import CategoryGridCard from './CategoryGridCard';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface Category {
  name: string;
  image_url: string | null;
}

interface CategorySectionProps {
  onCategoryClick: (categoryName: string) => void;
}

const CategorySection = ({ onCategoryClick }: CategorySectionProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('name, image_url')
        .order('name');

      if (error) {
        console.error("Error fetching categories:", error);
      } else if (data) {
        setCategories(data);
      }
      setLoading(false);
    };

    fetchCategories();
  }, []);

  return (
    <section className="container mx-auto px-6">
      <div className="flex items-end justify-between mb-16">
        <div>
          <h2 className="text-xs font-black tracking-[0.5em] text-sky-500 uppercase mb-4">Navegação</h2>
          <h3 className="text-4xl md:text-6xl font-black tracking-tighter italic">CATEGORIAS.</h3>
        </div>
      </div>

      <Carousel 
        opts={{ align: "start", loop: true }}
        className="w-full"
      >
        <CarouselContent className="-ml-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <CarouselItem key={index} className="pl-6 basis-full sm:basis-1/2 md:basis-1/3">
                <Skeleton className="aspect-[4/3] w-full rounded-3xl bg-white/5" />
              </CarouselItem>
            ))
          ) : (
            categories.map((category) => (
              <CarouselItem key={category.name} className="pl-6 basis-full sm:basis-1/2 md:basis-1/3">
                <div className="aspect-[4/3]">
                  <CategoryGridCard 
                    category={category} 
                    onClick={() => onCategoryClick(category.name)} 
                    className="h-full"
                  />
                </div>
              </CarouselItem>
            ))
          )}
        </CarouselContent>
        <div className="hidden md:block">
          <CarouselPrevious className="bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
          <CarouselNext className="bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
        </div>
      </Carousel>
    </section>
  );
};

export default CategorySection;