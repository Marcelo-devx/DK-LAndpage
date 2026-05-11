import { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import StarRating from '@/components/StarRating';
import { MessageSquareQuote, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface ProductReviewsProps {
  reviews: Review[];
}

const ProductReviews = ({ reviews }: ProductReviewsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  if (reviews.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.firstElementChild?.clientWidth ?? 300;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -cardWidth - 12 : cardWidth + 12, behavior: 'smooth' });
  };

  const avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

  return (
    <Card className="bg-white border-none shadow-[0_30px_60px_-20px_rgba(0,0,0,0.05)] rounded-[2rem] md:rounded-[3rem] overflow-hidden">
      <CardContent className="p-6 md:p-12 xl:p-16">
        {/* Header — clicável para expandir/recolher */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 md:p-4 bg-yellow-50 rounded-xl md:rounded-2xl text-yellow-500">
              <MessageSquareQuote className="h-6 w-6 md:h-8 md:w-8" />
            </div>
            <div className="text-left">
              <h2 className="font-black text-2xl md:text-3xl xl:text-4xl tracking-tighter italic uppercase text-charcoal-gray">
                Avaliações.
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <StarRating rating={Math.round(avgRating)} readOnly size={14} />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {avgRating.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Botões de navegação — só no desktop e só se aberto e mais de 1 */}
            {open && reviews.length > 1 && (
              <div className="hidden md:flex items-center gap-2">
                <span
                  onClick={e => { e.stopPropagation(); scroll('left'); }}
                  className="h-10 w-10 flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-slate-500 hover:text-charcoal-gray transition-all active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </span>
                <span
                  onClick={e => { e.stopPropagation(); scroll('right'); }}
                  className="h-10 w-10 flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-slate-500 hover:text-charcoal-gray transition-all active:scale-95 cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </span>
              </div>
            )}

            {/* Ícone de toggle */}
            <div className="h-10 w-10 flex items-center justify-center rounded-xl border border-stone-200 bg-stone-50 group-hover:bg-stone-100 text-slate-500 transition-all">
              {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </div>
        </button>

        {/* Carrossel — só visível quando aberto */}
        {open && (
          <div
            ref={scrollRef}
            className="flex gap-3 md:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-6 px-6 md:-mx-12 md:px-12 xl:-mx-16 xl:px-16 mt-8 md:mt-10"
          >
            {reviews.map((review) => (
              <div
                key={review.id}
                className="snap-start shrink-0 w-[80vw] sm:w-[340px] md:w-[360px] xl:w-[400px] bg-stone-50 border border-stone-100 rounded-2xl p-5 md:p-6 flex flex-col gap-3"
              >
                {/* Estrelas */}
                <StarRating rating={review.rating} readOnly size={16} />

                {/* Comentário */}
                {review.comment && (
                  <div className="relative">
                    <MessageSquareQuote className="absolute top-0 right-0 h-4 w-4 text-stone-200" />
                    <p className="text-sm text-slate-600 italic leading-relaxed pr-6">
                      "{review.comment}"
                    </p>
                  </div>
                )}

                {/* Rodapé */}
                <div className="mt-auto pt-2 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest truncate">
                    Cliente verificado
                  </span>
                  <span className="text-[10px] text-stone-400 font-bold shrink-0 ml-2">
                    {new Date(review.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductReviews;
