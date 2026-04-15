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

// Accept compactTop to remove large top padding when this section sits directly under the hero
const InfoSection = ({ compactTop = false }: { compactTop?: boolean }) => {
  const [infoBarItems, setInfoBarItems] = useState<InfoBarItem[]>([]);
  const [infoCards, setInfoCards] = useState<InfoCard[]>([]);
  const [loading, setLoading] = useState(true);
  
  // API para os pontinhos do carrossel de cards
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

  // Section class: keep mobile unchanged but reduce negative margins for md/lg/xl to avoid overlap on larger screens
  // mobile value preserved as requested
  const sectionClass = compactTop ? '-mt-8 md:-mt-2 lg:-mt-3 xl:-mt-4' : 'py-2 md:py-4 xl:py-6';

  if (loading) {
    return (
      <section className={sectionClass}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 md:mb-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-stone-200 rounded-2xl" />)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <div className="container mx-auto px-4 md:px-6 xl:px-8">
        {/* Info Bar Carousel (render only when we have items) */}
        {infoBarItems.length > 0 && (
          <div className="mb-3 md:mb-4 bg-white p-2 md:p-3 rounded-2xl md:rounded-3xl border border-stone-200 shadow-sm relative">
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
              <CarouselContent className="-ml-4">
                {infoBarItems.map((item, index) => {
                  const Icon = icons[item.icon_name];
                  return (
                    <CarouselItem key={index} className="pl-4 basis-full sm:basis-1/2 md:basis-1/4">
                      <div className="flex flex-col md:flex-row items-center text-center md:text-left md:space-x-3 group h-full px-4 md:px-0">
                        <div className="p-2 bg-sky-50 rounded-xl group-hover:bg-sky-100 transition-colors shrink-0 mb-2 md:mb-0">
                          {Icon && <Icon className="h-5 w-5 md:h-6 md:w-6 text-sky-600" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-xs uppercase tracking-widest text-charcoal-gray leading-tight">{item.title}</p>
                          <p className="text-[11px] md:text-xs text-slate-700 font-medium mt-0.5 leading-tight">{item.subtitle}</p>
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          </div>
        )}

        {/* Info Cards Carousel com Pontinhos */}
        <div className="relative">
          <Carousel setApi={setApi} opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-4">
              {infoCards.map((card, index) => (
                <CarouselItem key={index} className="pl-4 basis-full sm:basis-1/2 md:basis-1/3">
                  <Link to={card.link_url || '#'} className="block group w-full relative">
                    <div className="absolute -inset-1 bg-sky-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Card className="overflow-hidden rounded-2xl shadow-md border border-stone-100 relative bg-black flex items-center justify-center">
                      <img
                        src={card.image_url}
                        alt={`Info card ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto block object-contain"
                      />
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            
            <div className="hidden md:block">
              <CarouselPrevious className="-left-14 bg-white border-stone-200 text-charcoal-gray hover:bg-sky-500 hover:text-white shadow-md" />
              <CarouselNext className="-right-14 bg-white border-stone-200 text-charcoal-gray hover:bg-sky-500 hover:text-white shadow-md" />
            </div>
          </Carousel>

          <div className="flex md:hidden justify-center space-x-2 mt-3">
            {infoCards.map((_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  current === index 
                    ? "bg-sky-500 w-3 shadow-sm" 
                    : "bg-stone-300 hover:bg-stone-400"
                )}
                aria-label={`Ir para o slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default InfoSection;