import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Minus } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { addToCart } from '@/utils/cart';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import PromotionCard from '@/components/PromotionCard';

interface Promotion {
  id: number;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
}

interface RelatedPromotion {
    id: number;
    name: string;
    price: number;
    image_url: string | null;
}

const PromotionPage = () => {
  const { id } = useParams<{ id: string }>();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [relatedPromotions, setRelatedPromotions] = useState<RelatedPromotion[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);

  useEffect(() => {
    const fetchPromotionData = async () => {
      if (!id) return;
      
      setLoading(true);
      setLoadingRelated(true);
      setPromotion(null);
      setRelatedPromotions([]);

      const { data, error } = await supabase
        .from('promotions')
        .select('id, name, description, price, image_url')
        .eq('id', id)
        .single();

      if (error) {
        console.error("Error fetching promotion:", error);
        setPromotion(null);
        setLoading(false);
        setLoadingRelated(false);
        return;
      }
      
      setPromotion(data);
      setLoading(false);

      const { data: relatedData, error: relatedError } = await supabase
        .from('promotions')
        .select('id, name, price, image_url')
        .eq('is_active', true)
        .neq('id', id)
        .limit(3);

      if (relatedError) {
        console.error("Error fetching related promotions:", relatedError);
      } else if (relatedData) {
        setRelatedPromotions(relatedData);
      }
      setLoadingRelated(false);
    };

    fetchPromotionData();
    window.scrollTo(0, 0);
  }, [id]);

  const handleIncrease = () => setQuantity(prev => prev + 1);
  const handleDecrease = () => setQuantity(prev => Math.max(1, prev - 1));

  const handleAddToCart = () => {
    if (promotion) {
      addToCart(promotion.id, quantity, 'promotion');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-start">
          <Skeleton className="w-full h-[500px] rounded-lg" />
          <div className="flex flex-col space-y-6">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-10 w-1/3" />
            <Separator />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!promotion) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-4xl text-charcoal-gray mb-4">Promoção não encontrada</h1>
        <p className="text-stone-600 mb-8">A promoção que você está procurando não existe ou foi removida.</p>
        <Button asChild>
          <Link to="/">Voltar para a Página Inicial</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-start">
          
          <div className="w-full">
            <img 
              src={promotion.image_url || 'https://picsum.photos/600/800'} 
              alt={promotion.name} 
              className="w-full h-auto object-cover rounded-lg shadow-lg"
            />
          </div>

          <div className="flex flex-col space-y-6">
            <div>
              <p className="text-sm uppercase tracking-widest text-stone-500">Promoção</p>
              <h1 className="font-serif text-4xl md:text-5xl font-medium text-charcoal-gray mt-2">{promotion.name}</h1>
              <p className="text-3xl text-tobacco-brown font-semibold mt-4">R$ {promotion.price.toFixed(2).replace('.', ',')}</p>
            </div>

            <Separator />

            <p className="text-stone-700 leading-relaxed">{promotion.description || 'Sem descrição disponível.'}</p>

            <div className="flex items-center space-x-4">
              <p className="font-medium text-charcoal-gray">Quantidade:</p>
              <div className="flex items-center border border-gray-300 rounded-md">
                <Button variant="ghost" size="icon" onClick={handleDecrease} className="rounded-r-none">
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="px-4 font-semibold text-charcoal-gray">{quantity}</span>
                <Button variant="ghost" size="icon" onClick={handleIncrease} className="rounded-l-none">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button size="lg" className="w-full bg-gold-accent hover:bg-gold-accent/90 text-charcoal-gray font-bold text-lg py-6" onClick={handleAddToCart}>
              Adicionar ao Carrinho
            </Button>

            <Separator />

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="font-serif text-lg text-charcoal-gray">Detalhes da Promoção</AccordionTrigger>
                <AccordionContent className="text-stone-700">
                  {promotion.description || 'Sem detalhes disponíveis.'}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      {relatedPromotions.length > 0 && (
        <ScrollAnimationWrapper>
          <section className="bg-stone-100 py-16">
            <div className="container mx-auto px-4">
              <h2 className="font-serif text-3xl md:text-4xl text-center text-charcoal-gray mb-12">
                Outras Promoções
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {loadingRelated ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex flex-col space-y-3">
                      <Skeleton className="w-full rounded-lg aspect-[4/5]" />
                      <div className="space-y-2 bg-charcoal-gray p-4 rounded-b-lg">
                        <Skeleton className="h-6 w-3/4 mx-auto" />
                        <Skeleton className="h-6 w-1/2 mx-auto" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                  ))
                ) : (
                  relatedPromotions.map((promo) => (
                    <PromotionCard key={promo.id} promotion={{
                      id: promo.id,
                      name: promo.name,
                      price: `R$ ${promo.price.toFixed(2).replace('.', ',')}`,
                      imageUrl: promo.image_url || 'https://picsum.photos/600/800',
                      url: `/promocao/${promo.id}`,
                    }} />
                  ))
                )}
              </div>
            </div>
          </section>
        </ScrollAnimationWrapper>
      )}
    </>
  );
};

export default PromotionPage;