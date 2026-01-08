import { useEffect, useState } from 'react';
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
} from "@/components/ui/carousel";

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
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-white/5 rounded-2xl" />)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-6">
        {/* Info Bar Carousel */}
        <div className="mb-12 md:mb-20 bg-white/5 p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-sm relative">
          <Carousel opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-4">
              {infoBarItems.map((item, index) => {
                const Icon = icons[item.icon_name];
                return (
                  <CarouselItem key={index} className="pl-4 basis-full sm:basis-1/2 md:basis-1/4">
                    <div className="flex flex-col md:flex-row items-center text-center md:text-left md:space-x-5 group h-full px-8 md:px-0">
                      <div className="p-2.5 bg-sky-500/10 rounded-xl md:rounded-2xl group-hover:bg-sky-500/20 transition-colors shrink-0 mb-3 md:mb-0">
                        {Icon && <Icon className="h-6 w-6 md:h-7 md:w-7 text-sky-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs uppercase tracking-widest text-white leading-tight">{item.title}</p>
                        <p className="text-[11px] md:text-sm text-slate-400 font-medium mt-1 leading-tight">{item.subtitle}</p>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            
            {/* Setas de navegação nas laterais no mobile */}
            <div className="md:hidden">
               <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 bg-slate-900/50 border-white/10 text-white h-8 w-8 hover:bg-sky-500" />
               <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 bg-slate-900/50 border-white/10 text-white h-8 w-8 hover:bg-sky-500" />
            </div>
            
            {/* Setas de navegação no desktop */}
            <div className="hidden md:block">
              <CarouselPrevious className="-left-12 bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
              <CarouselNext className="-right-12 bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
            </div>
          </Carousel>
        </div>

        {/* Info Cards Carousel */}
        <div className="relative">
          <Carousel opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-6">
              {infoCards.map((card, index) => (
                <CarouselItem key={index} className="pl-6 basis-full sm:basis-1/2 md:basis-1/3">
                  <Link to={card.link_url || '#'} className="block group w-full relative">
                    <div className="absolute -inset-1 bg-sky-500/20 rounded-[1.5rem] md:rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Card className="overflow-hidden rounded-[1.5rem] md:rounded-[2rem] shadow-2xl h-[180px] md:h-[240px] border border-white/5 relative bg-white/5">
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
            
            {/* Setas para Mobile */}
            <div className="md:hidden">
              <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 bg-slate-900/80 border-white/10 text-white h-10 w-10 hover:bg-sky-500 z-10" />
              <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900/80 border-white/10 text-white h-10 w-10 hover:bg-sky-500 z-10" />
            </div>

            {/* Setas para Desktop */}
            <div className="hidden md:block">
              <CarouselPrevious className="-left-14 bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
              <CarouselNext className="-right-14 bg-slate-900 border-white/10 text-white hover:bg-sky-500" />
            </div>
          </Carousel>
        </div>
      </div>
    </section>
  );
};

export default InfoSection;