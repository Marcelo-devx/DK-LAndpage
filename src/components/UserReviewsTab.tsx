import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from './ui/skeleton';
import ReviewModal from './ReviewModal';
import StarRating from './StarRating';
import { PenSquare, MessageSquareQuote, ShoppingBag, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import ProductImage from '@/components/ProductImage';

interface ProductToReview {
  product_id: number;
  order_id: number;
  name: string;
  image_url: string | null;
}

interface SubmittedReview {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  is_approved: boolean;
  products: {
    id: number;
    name: string;
    image_url: string | null;
  } | null;
}

const UserReviewsTab = () => {
  const [productsToReview, setProductsToReview] = useState<ProductToReview[]>([]);
  const [submittedReviews, setSubmittedReviews] = useState<SubmittedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingItem, setReviewingItem] = useState<{ productId: number; orderId: number; productName: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: ordersData } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'Finalizada');

    if (!ordersData || ordersData.length === 0) { setLoading(false); return; }
    const orderIds = ordersData.map(o => o.id);

    const [itemsResult, reviewsResult] = await Promise.all([
      supabase
        .from('order_items')
        .select('item_id, order_id, name_at_purchase, image_url_at_purchase')
        .in('order_id', orderIds)
        .eq('item_type', 'product'),
      supabase
        .from('reviews')
        .select('id, rating, comment, created_at, product_id, order_id, is_approved, products(id, name, image_url)')
        .in('order_id', orderIds)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    ]);

    const { data: orderItemsData } = itemsResult;
    const { data: reviewsData } = reviewsResult;

    setSubmittedReviews((reviewsData as any[]) || []);

    const reviewedSet = new Set((reviewsData || []).map(r => `${r.order_id}-${r.product_id}`));
    const unreviewedProducts = (orderItemsData || [])
      .filter(item => !reviewedSet.has(`${item.order_id}-${item.item_id}`))
      .map(item => ({
        product_id: item.item_id,
        order_id: item.order_id,
        name: item.name_at_purchase,
        image_url: item.image_url_at_purchase,
      }));

    setProductsToReview(unreviewedProducts);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReviewSubmitted = () => { setReviewingItem(null); fetchData(); };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );

  return (
    <>
      <div className="space-y-10">

        {/* Aguardando avaliação */}
        {productsToReview.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-stone-400 mb-5 flex items-center gap-2">
              <PenSquare className="h-3.5 w-3.5 text-sky-500" />
              Aguardando seu veredito
            </h3>
            <div className="space-y-3">
              {productsToReview.map((product) => (
                <div
                  key={`${product.order_id}-${product.product_id}`}
                  className="flex items-center gap-4 p-4 bg-sky-50 border border-sky-100 rounded-2xl hover:border-sky-300 transition-all"
                >
                  <Link to={`/produto/${product.product_id}`} className="shrink-0">
                    <ProductImage
                      src={product.image_url || 'https://picsum.photos/200'}
                      alt={product.name}
                      className="h-16 w-16 object-cover rounded-xl border border-sky-100"
                    />
                  </Link>
                  <div className="flex-grow min-w-0">
                    <Link to={`/produto/${product.product_id}`} className="hover:text-sky-500 transition-colors">
                      <h4 className="font-black text-charcoal-gray uppercase tracking-tight text-sm truncate">{product.name}</h4>
                    </Link>
                    <div className="flex items-center text-[10px] text-stone-400 font-bold mt-1 uppercase tracking-widest">
                      <ShoppingBag className="h-3 w-3 mr-1 text-sky-400" /> Pedido #{product.order_id}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 border-sky-400 text-sky-500 hover:bg-sky-500 hover:text-white font-black uppercase text-[10px] tracking-widest h-10 px-5 rounded-xl transition-all"
                    onClick={() => setReviewingItem({ productId: product.product_id, orderId: product.order_id, productName: product.name })}
                  >
                    Avaliar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de avaliações */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-stone-400 mb-5 flex items-center gap-2">
            <MessageSquareQuote className="h-3.5 w-3.5 text-sky-500" />
            Histórico de Críticas
          </h3>

          {submittedReviews.length > 0 ? (
            <div className="space-y-4">
              {submittedReviews.map((review) => (
                <div key={review.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-5 p-5">

                    {/* Imagem do produto */}
                    {review.products && (
                      <div className="shrink-0">
                        <ProductImage
                          src={review.products.image_url || 'https://picsum.photos/200'}
                          alt={review.products.name}
                          className="h-20 w-20 object-cover rounded-xl border border-stone-100"
                        />
                      </div>
                    )}

                    {/* Conteúdo */}
                    <div className="flex-grow min-w-0 space-y-3">

                      {/* Nome + badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-black text-charcoal-gray uppercase tracking-tight text-sm leading-tight truncate">
                            {review.products?.name}
                          </h4>
                          <div className="mt-1.5">
                            <StarRating rating={review.rating} readOnly size={16} />
                          </div>
                        </div>
                        <Badge className={cn(
                          "shrink-0 px-3 py-1 text-[10px] font-black border uppercase tracking-widest flex items-center gap-1",
                          review.is_approved
                            ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                            : 'text-amber-600 bg-amber-50 border-amber-200'
                        )}>
                          {review.is_approved
                            ? <><CheckCircle2 className="h-3 w-3" /> Publicada</>
                            : <><Clock className="h-3 w-3" /> Em Análise</>
                          }
                        </Badge>
                      </div>

                      {/* Comentário */}
                      {review.comment ? (
                        <div className="bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 relative">
                          <MessageSquareQuote className="absolute top-3 right-3 h-4 w-4 text-stone-200" />
                          <p className="text-sm text-stone-500 italic leading-relaxed pr-6">
                            "{review.comment}"
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 italic">Nenhum comentário adicionado.</p>
                      )}

                      {/* Data */}
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em] text-right">
                        Avaliado em {new Date(review.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-stone-200 rounded-3xl">
              <MessageSquareQuote className="mx-auto h-10 w-10 text-stone-200 mb-3" />
              <p className="text-stone-400 font-medium italic text-sm">Você ainda não fez nenhuma avaliação.</p>
            </div>
          )}
        </div>

      </div>

      {reviewingItem && (
        <ReviewModal
          isOpen={!!reviewingItem}
          onOpenChange={() => setReviewingItem(null)}
          productId={reviewingItem.productId}
          orderId={reviewingItem.orderId}
          productName={reviewingItem.productName}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </>
  );
};

export default UserReviewsTab;
