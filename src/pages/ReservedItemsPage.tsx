import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bookmark, BookmarkX, Loader2, PackageSearch, ArrowLeft, PackageCheck, ShoppingCart } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Reservation {
  id: string;
  product_id: number;
  product_name: string;
  product_image: string | null;
  variant_id: string | null;
  variant_name: string | null;
  status: string;
  created_at: string;
  stock_returned_at: string | null;
  // verificado em tempo real
  currentStock?: number;
}

const ReservedItemsPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    if (user) fetchReservations();
  }, [user, authLoading]);

  const fetchReservations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_reservations')
        .select('id, product_id, product_name, product_image, variant_id, variant_name, status, created_at, stock_returned_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('stock_returned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reservationsData: Reservation[] = data || [];

      // Para cada reserva, verifica estoque real (produto/variante)
      const withStock = await Promise.all(
        reservationsData.map(async (r) => {
          let stock = 0;
          if (r.variant_id) {
            const { data: v } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', r.variant_id)
              .maybeSingle();
            stock = v?.stock_quantity ?? 0;
          } else {
            const { data: p } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', r.product_id)
              .maybeSingle();
            stock = p?.stock_quantity ?? 0;
          }
          return { ...r, currentStock: stock };
        })
      );

      // Ordena: voltaram ao estoque primeiro
      withStock.sort((a, b) => {
        const aBack = (a.stock_returned_at || a.currentStock! > 0) ? 1 : 0;
        const bBack = (b.stock_returned_at || b.currentStock! > 0) ? 1 : 0;
        return bBack - aBack;
      });

      setReservations(withStock);
    } catch (err) {
      showError('Erro ao carregar reservas.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (reservationId: string, productName: string) => {
    setCancellingId(reservationId);
    try {
      const { error } = await supabase
        .from('product_reservations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', reservationId)
        .eq('user_id', user!.id);

      if (error) throw error;

      setReservations(prev => prev.filter(r => r.id !== reservationId));
      showSuccess(`Reserva de "${productName}" cancelada.`);
    } catch {
      showError('Erro ao cancelar reserva. Tente novamente.');
    } finally {
      setCancellingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  const backInStockCount = reservations.filter(r => (r.currentStock ?? 0) > 0).length;

  return (
    <div className="container mx-auto px-4 md:px-6 py-4 md:py-10 max-w-4xl text-charcoal-gray">
      <div className="mb-6 md:mb-10">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-stone-500 hover:text-sky-500 transition-colors text-sm font-bold uppercase tracking-widest mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-2xl">
            <Bookmark className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="font-black text-3xl tracking-tighter italic uppercase text-charcoal-gray">
              Itens Reservados.
            </h1>
            <p className="text-stone-500 font-medium text-sm">
              Produtos esgotados que você reservou. Avisaremos quando voltarem ao estoque.
            </p>
          </div>
        </div>
      </div>

      {/* Banner: há itens que voltaram ao estoque */}
      {backInStockCount > 0 && (
        <div className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 shadow-lg shadow-emerald-500/20 animate-in fade-in duration-500">
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="flex items-center gap-3 relative">
            <div className="shrink-0 bg-white/20 rounded-xl p-2">
              <PackageCheck className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-black text-white text-sm uppercase tracking-wider">
                🎉 {backInStockCount === 1 ? '1 item voltou' : `${backInStockCount} itens voltaram`} ao estoque!
              </p>
              <p className="text-emerald-100 text-xs font-medium mt-0.5">
                Clique em "Ver" para garantir o seu antes que acabe.
              </p>
            </div>
          </div>
        </div>
      )}

      {reservations.length === 0 ? (
        <Card className="bg-white border border-stone-200 rounded-3xl shadow-lg">
          <CardContent className="p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-5 bg-stone-100 rounded-3xl">
              <PackageSearch className="h-10 w-10 text-stone-400" />
            </div>
            <div>
              <h3 className="font-black text-xl uppercase tracking-tight text-charcoal-gray mb-1">
                Nenhuma reserva ativa
              </h3>
              <p className="text-stone-500 text-sm">
                Quando um produto estiver esgotado, clique em "Reservar" para ser avisado.
              </p>
            </div>
            <Button
              asChild
              className="mt-2 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest rounded-xl"
            >
              <Link to="/produtos">Ver Produtos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">
            {reservations.length} {reservations.length === 1 ? 'item reservado' : 'itens reservados'}
          </p>

          {reservations.map((reservation) => {
            const isBackInStock = (reservation.currentStock ?? 0) > 0;
            const productUrl = reservation.variant_id
              ? `/produto/${reservation.product_id}?variant=${reservation.variant_id}`
              : `/produto/${reservation.product_id}`;

            return (
              <Card
                key={reservation.id}
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${
                  isBackInStock
                    ? 'border-emerald-300 shadow-md shadow-emerald-100 ring-1 ring-emerald-200'
                    : 'border-stone-200 hover:border-amber-300'
                }`}
              >
                {/* Faixa superior quando voltou ao estoque */}
                {isBackInStock && (
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1.5 flex items-center gap-2">
                    <PackageCheck className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">
                      Voltou ao estoque — garanta o seu!
                    </span>
                    <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  </div>
                )}

                <CardContent className="p-4 md:p-5 flex items-center gap-4">
                  {/* Imagem */}
                  <Link to={productUrl} className="shrink-0">
                    <div className={`h-16 w-16 md:h-20 md:w-20 rounded-xl overflow-hidden bg-stone-100 border ${isBackInStock ? 'border-emerald-200' : 'border-stone-100'}`}>
                      {reservation.product_image ? (
                        <img
                          src={reservation.product_image}
                          alt={reservation.product_name}
                          className={`w-full h-full object-cover transition-all ${isBackInStock ? '' : 'grayscale'}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PackageSearch className="h-6 w-6 text-stone-300" />
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link to={productUrl}>
                      <h3 className="font-bold text-sm md:text-base text-charcoal-gray hover:text-sky-600 transition-colors line-clamp-2 leading-snug" translate="no">
                        {reservation.product_name}
                      </h3>
                    </Link>

                    {reservation.variant_name && (
                      <p className="text-xs text-sky-600 font-bold uppercase tracking-wider mt-0.5" translate="no">
                        {reservation.variant_name}
                      </p>
                    )}

                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {isBackInStock ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                          <PackageCheck className="h-2.5 w-2.5" />
                          Disponível
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                          <Bookmark className="h-2.5 w-2.5" />
                          Aguardando
                        </span>
                      )}
                      <span className="text-[10px] text-stone-400 font-medium">
                        {format(new Date(reservation.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="shrink-0 flex flex-col gap-2">
                    <Button
                      asChild
                      size="sm"
                      className={`font-black uppercase text-[9px] tracking-widest rounded-lg h-8 ${
                        isBackInStock
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm shadow-emerald-300'
                          : 'bg-sky-500 hover:bg-sky-400 text-white'
                      }`}
                    >
                      <Link to={productUrl}>
                        {isBackInStock ? (
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" /> Comprar
                          </span>
                        ) : (
                          'Ver'
                        )}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 font-black uppercase text-[9px] tracking-widest rounded-lg h-8"
                      onClick={() => handleCancel(reservation.id, reservation.product_name)}
                      disabled={cancellingId === reservation.id}
                    >
                      {cancellingId === reservation.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <BookmarkX className="h-3.5 w-3.5 mr-1" />
                          Cancelar
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReservedItemsPage;
