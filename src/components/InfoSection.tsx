import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Truck, CreditCard, Percent, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Card } from './ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from '@/lib/utils';

interface InfoBarItem {
  icon_name: string;
  title: string;
  subtitle: string;
}

interface InfoCard {
  image_url: string;
  link_url: string | null;
}

const icons: { [key: string]: LucideIcon } = {
  Truck,
  CreditCard,
  Percent,
  ShieldCheck,
};

const InfoSection = () => {
  const [infoBarItems, setInfoBarItems] = useState<InfoBarItem[]>([]);
  const [infoCards, setInfoCards] = useState<InfoCard[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
  }, [api, onSelect]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: barItems, error: barError } = await supabase
        .from('info_bar_items')
        .select('icon_name, title, subtitle')
        .order('sort_order');

      const { data: cards, error: cardsError } = await supabase
        .from('info_cards')
        .select('image_url, link_url')
        .order('sort_order');

      if (barError) console.error('Error fetching info bar items:', barError);
      else setInfoBarItems(barItems || []);

      if (cardsError) console.error('Error fetching info cards:', cardsError);
      else setInfoCards(cards || []);

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <section className="py-4 md:py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-12">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-slate-100 rounded-2xl" />)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4 md:py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-8 md:mb-20 bg-white p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] border border-slate-100 shadow-sm relative">
          <Carousel opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-4">
              {infoBarItems.map((item, index) => {
                const Icon = icons[item.icon_name];
                return (
                  <CarouselItem key={index} className="pl-4 basis-full sm:basis-1/2 md:basis-1/4">
                    <div className="flex flex-col md:flex-row items-center text-center md:text-left md:space-x-5 group h-full px-8 md:px-0">
                      <div className="p-2.5 bg-sky-50 rounded-xl md:rounded-2xl group-hover:bg-sky-100 transition-colors shrink-0 mb-3 md:mb-0">
                        {Icon && <Icon className="h-6 w-6 md:h-7 md:w-7 text-sky-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs uppercase tracking-widest text-slate-900 leading-tight">{item.title}</p>
                        <p className="text-[11px] md:text-sm text-slate-500 font-medium mt-1 leading-tight">{item.subtitle}</p>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            
            <div className="md:hidden">
               <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 bg-white border-slate-200 text-slate-900 h-8 w-8 hover:bg-sky-500 hover:text-white" />
               <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border-slate-200 text-slate-900 h-8 w-8 hover:bg-sky-500 hover:text-white" />
            </div>
            
            <div className="hidden md:block">
              <CarouselPrevious className="-left-12 bg-white border-slate-200 text-slate-900 hover:bg-sky-500 hover:text-white shadow-sm" />
              <CarouselNext className="-right-12 bg-white border-slate-200 text-slate-900 hover:bg-sky-500 hover:text-white shadow-sm" />
            </div>
          </Carousel>
        </div>

        <div className="relative">
          <Carousel setApi={setApi} opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-6">
              {infoCards.map((card, index) => (
                <CarouselItem key={index} className="pl-6 basis-full sm:basis-1/2 md:basis-1/3">
                  <Link to={card.link_url || '#'} className="block group w-full relative">
                    <Card className="overflow-hidden rounded-[1.5rem] md:rounded-[2rem] shadow-lg h-[180px] md:h-[240px] border border-slate-100 relative bg-white">
                      <img 
                        src={card.image_url} 
                        alt={`Info card ${index + 1}`} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            
            <div className="hidden md:block">
              <CarouselPrevious className="-left-14 bg-white border-slate-200 text-slate-900 hover:bg-sky-500 hover:text-white shadow-md" />
              <CarouselNext className="-right-14 bg-white border-slate-200 text-slate-900 hover:bg-sky-500 hover:text-white shadow-md" />
            </div>
          </Carousel>

          <div className="flex md:hidden justify-center space-x-2 mt-6">
            {infoCards.map((_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-all duration-300",
                  current === index 
                    ? "bg-sky-600 w-4" 
                    : "bg-slate-200 hover:bg-slate-300"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default InfoSection;