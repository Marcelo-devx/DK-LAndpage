import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from './ui/skeleton';
import ReviewModal from './ReviewModal';
import StarRating from './StarRating';
import { PenSquare, MessageSquareQuote, ShoppingBag } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

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
      
    const uniqueProductsToReview = Array.from(new Map(unreviewedProducts.map(item => [item.product_id, item])).values());
    setProductsToReview(uniqueProductsToReview);

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReviewSubmitted = () => { setReviewingItem(null); fetchData(); };

  if (loading) return <div className="space-y-6"><Skeleton className="h-24 w-full bg-white/5 rounded-2xl" /><Skeleton className="h-24 w-full bg-white/5 rounded-2xl" /></div>;

  return (
    <>
      <div className="space-y-12">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Aguardando seu veredito</h3>
          {productsToReview.length > 0 ? (
            <div className="space-y-4">
              {productsToReview.map((product) => (
                <div key={`${product.order_id}-${product.product_id}`} className="flex items-center space-x-5 p-5 bg-white/5 border border-white/5 rounded-2xl hover:border-sky-500/30 transition-all">
                  <Link to={`/produto/${product.product_id}`} className="shrink-0">
                    <img src={product.image_url || 'https://picsum.photos/200'} alt={product.name} className="h-20 w-20 object-cover rounded-xl border border-white/5" />
                  </Link>
                  <div className="flex-grow">
                    <Link to={`/produto/${product.product_id}`} className="hover:text-sky-400 transition-colors">
                      <h4 className="font-black text-white uppercase tracking-tight text-sm">{product.name}</h4>
                    </Link>
                    <div className="flex items-center text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">
                        <ShoppingBag className="h-3 w-3 mr-1 text-sky-400" /> Pedido #{product.order_id}
                    </div>
                  </div>
                  <Button variant="outline" className="border-sky-500/50 text-sky-400 hover:bg-sky-500 hover:text-white font-black uppercase text-[10px] tracking-widest h-10 px-6 rounded-xl" onClick={() => setReviewingItem({ productId: product.product_id, orderId: product.order_id, productName: product.name })}>
                    Avaliar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl">
              <p className="text-slate-500 font-medium italic">Você não tem produtos pendentes de avaliação.</p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Histórico de Críticas</h3>
          {submittedReviews.length > 0 ? (
            <div className="space-y-4">
              {submittedReviews.map((review) => (
                <div key={review.id} className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    {review.products && (
                        <img src={review.products.image_url || 'https://picsum.photos/200'} alt={review.products.name} className="h-20 w-20 object-cover rounded-xl border border-white/5 shrink-0" />
                    )}
                    <div className="flex-grow w-full">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                            <div>
                                <h4 className="font-black text-white uppercase tracking-tight text-base">{review.products?.name}</h4>
                                <StarRating rating={review.rating} readOnly size={18} className="mt-2" />
                            </div>
                            <Badge className={cn(
                                "px-3 py-1 text-[10px] font-black border uppercase tracking-widest",
                                review.is_approved ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-orange-400 bg-orange-400/10 border-orange-400/20'
                            )}>
                                {review.is_approved ? 'Publicada' : 'Em Análise'}
                            </Badge>
                        </div>
                        <div className="bg-slate-950/50 p-5 rounded-xl border border-white/5 relative">
                            <MessageSquareQuote className="absolute top-4 right-4 h-5 w-5 text-white/5" />
                            <p className={cn("text-sm leading-relaxed", review.comment ? "text-slate-300 italic" : "text-slate-600 italic font-medium")}>
                                {review.comment ? `"${review.comment}"` : "Nenhum comentário adicionado."}
                            </p>
                        </div>
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] mt-4 text-right">
                          Avaliado em {new Date(review.created_at).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquareQuote className="mx-auto h-12 w-12 text-white/5 mb-4" />
              <p className="text-slate-500 font-medium italic">Você ainda não fez nenhuma avaliação.</p>
            </div>
          )}
        </div>
      </div>

      {reviewingItem && <ReviewModal isOpen={!!reviewingItem} onOpenChange={() => setReviewingItem(null)} productId={reviewingItem.productId} orderId={reviewingItem.orderId} productName={reviewingItem.productName} onReviewSubmitted={handleReviewSubmitted} />}
    </>
  );
};

export default UserReviewsTab;