import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, CreditCard, MessageSquare, AlertTriangle, Smartphone, Heart } from 'lucide-react';
import OrderTimer from '@/components/OrderTimer';
import { cn } from '@/lib/utils';
import ProductImage from '@/components/ProductImage';

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  shipping_cost: number;
  donation_amount: number;
  status: string;
  payment_method: string | null;
  shipping_address?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
    complement?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    cpf_cnpj?: string;
    email?: string;
  } | null;
}

interface OrderItem {
  name_at_purchase?: string;
  quantity?: number;
  price_at_purchase?: number;
  image_url_at_purchase?: string;
}

const ConfirmacaoPedido = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const hasInitializedRef = useRef(false);

  const safeOrder = (o: any): Order => {
    return {
      id: Number(o?.id || 0),
      created_at: o?.created_at || new Date().toISOString(),
      total_price: Number(o?.total_price ?? 0),
      shipping_cost: Number(o?.shipping_cost ?? 0),
      donation_amount: Number(o?.donation_amount ?? 0),
      status: o?.status || 'Pendente',
      payment_method: o?.payment_method || (o?.shipping_address?.payment_method ?? 'Pix'),
      shipping_address: o?.shipping_address || {},
    };
  };

  const safeItems = (it: any[]): OrderItem[] => {
    if (!Array.isArray(it)) return [];
    return it.map(i => ({
      name_at_purchase: i?.name_at_purchase || i?.name || '',
      quantity: Number(i?.quantity ?? 1),
      price_at_purchase: Number(i?.price_at_purchase ?? i?.price ?? 0),
      image_url_at_purchase: i?.image_url_at_purchase || i?.image_url || ''
    }));
  };

  const fetchOrderDetails = async (isBackground = false) => {
    if (!id) return;
    if (!isBackground) {
      setLoading(true);
      setErrorMessage(null);
    }

    const cleanId = id.replace(/\D/g, '');
    if (!cleanId) {
      if (!isBackground) {
        setErrorMessage('ID do pedido inválido.');
        setLoading(false);
      }
      return;
    }

    // Timeout de 3s para evitar loading infinito ao voltar de outra aba
    const timeoutId = setTimeout(() => {
      if (!isBackground) {
        setLoading(false);
        setErrorMessage('Tempo limite excedido. Tente novamente.');
      }
    }, 3000);

    try {
      // Strategy 1: Try edge function first (uses service role, bypasses RLS)
      try {
        const invokeResult: any = await supabase.functions.invoke('get-order-public', {
          body: { order_id: Number(cleanId) }
        });
        const payload = invokeResult?.data;
        if (payload?.success && payload?.order) {
          setOrder(safeOrder(payload.order));
          setItems(safeItems(payload.items || []));
          clearTimeout(timeoutId);
          if (!isBackground) setLoading(false);
          return;
        }
      } catch (fnErr) {
        console.warn('[ConfirmacaoPedido] get-order-public failed, trying direct query:', fnErr);
      }

      // Strategy 2: Direct query (works if user is logged in and owns the order)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', cleanId)
        .single();

      if (!orderError && orderData) {
        setOrder(safeOrder(orderData));

        const { data: itemsData } = await supabase
          .from('order_items')
          .select('name_at_purchase, quantity, price_at_purchase, image_url_at_purchase')
          .eq('order_id', cleanId);

        setItems(safeItems(itemsData || []));
        clearTimeout(timeoutId);
        if (!isBackground) setLoading(false);
        return;
      }

      // Both strategies failed
      clearTimeout(timeoutId);
      if (!isBackground) {
        setErrorMessage('Pedido não encontrado. Verifique o número do pedido.');
        setLoading(false);
      }

    } catch (e: any) {
      console.error('Unexpected error fetching order details:', e);
      clearTimeout(timeoutId);
      if (!isBackground) {
        setErrorMessage('Ocorreu um erro ao carregar o pedido.');
        setOrder(null);
        setItems([]);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Prevent double-run on StrictMode or re-renders with same id
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const mpApproved =
          params.get('collection_status') === 'approved' ||
          params.get('status') === 'approved' ||
          params.get('payment_status') === 'approved' ||
          params.get('collection_status') === 'paid';

        if (mpApproved && id) {
          const cleanId = String(id).replace(/\D/g, '');
          const orderId = Number(cleanId);

          if (orderId && Number.isFinite(orderId)) {
            // 1. Limpar os query params do MP da URL IMEDIATAMENTE (antes de qualquer await)
            //    Isso evita que qualquer re-mount futuro detecte mpApproved=true novamente
            try {
              window.history.replaceState({}, '', `/confirmacao-pedido/${cleanId}`);
            } catch (e) { /* ignore */ }

            // 2. Mostrar loading enquanto finaliza
            setLoading(true);

            // 3. Verificar sessionStorage para evitar duplo processamento
            const sessionKey = `mp_processed_${cleanId}`;
            const alreadyProcessed = sessionStorage.getItem(sessionKey);

            if (!alreadyProcessed) {
              sessionStorage.setItem(sessionKey, '1');
              try {
                const { error: finalizeError } = await supabase.rpc('finalize_order_payment', { p_order_id: orderId });
                if (finalizeError) {
                  console.warn('[ConfirmacaoPedido] finalize_order_payment error:', finalizeError);
                } else {
                  console.info('[ConfirmacaoPedido] finalize_order_payment OK for order', orderId);
                }
              } catch (e) {
                console.error('[ConfirmacaoPedido] finalize_order_payment exception:', e);
              }
            } else {
              console.info('[ConfirmacaoPedido] already processed order', orderId, '— skipping finalize');
            }

            // 4. Buscar detalhes atualizados (sempre)
            await fetchOrderDetails();
            return;
          }
        }
      } catch (e) {
        console.error('[ConfirmacaoPedido] init error:', e);
      }

      // Sem params do MP: busca normal
      await fetchOrderDetails();
    };

    init();

    // Background refresh quando o usuário volta para a aba
    let hiddenAt = 0;
    const THRESHOLD_MS = 30_000;
    const isFetchingRefLocal = { current: false };

    const handleVisibility = () => {
      try {
        if (document.hidden) {
          hiddenAt = Date.now();
        } else {
          if (!hiddenAt) return;
          const elapsed = Date.now() - hiddenAt;
          hiddenAt = 0;
          if (elapsed > THRESHOLD_MS && !isFetchingRefLocal.current) {
            setTimeout(async () => {
              if (document.visibilityState === 'visible' && !isFetchingRefLocal.current) {
                isFetchingRefLocal.current = true;
                try { await fetchOrderDetails(true); } finally { isFetchingRefLocal.current = false; }
              }
            }, 300);
          }
        }
      } catch (e) {}
    };

    const handleFocus = () => {
      try {
        if (hiddenAt && (Date.now() - hiddenAt) > THRESHOLD_MS && !isFetchingRefLocal.current) {
          setTimeout(async () => {
            if (document.visibilityState === 'visible' && !isFetchingRefLocal.current) {
              isFetchingRefLocal.current = true;
              try { await fetchOrderDetails(true); } finally { isFetchingRefLocal.current = false; }
            }
          }, 300);
          hiddenAt = 0;
        }
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [id]);

  // Ensure header/cart badge reflects the current (cleared) local cart
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('cartUpdated')); } catch (e) { /* noop */ }
  }, []);

  const handleForceCheckPayment = async () => {
    if (!id) return;
    setIsCheckingPayment(true);
    setErrorMessage(null);
    try {
      const { error: rpcError } = await supabase.rpc('finalize_order_payment', { p_order_id: Number(id) });
      if (rpcError) {
        console.warn('RPC finalize_order_payment returned error:', rpcError);
        setErrorMessage('Não foi possível forçar a verificação automática do pagamento. Tente novamente em alguns instantes.');
      } else {
        await fetchOrderDetails();
      }
    } catch (e: any) {
      console.error('Error forcing payment check:', e);
      setErrorMessage('Erro ao verificar pagamento.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  if (loading) {
    return <div className="flex flex-col justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /><p className="text-sm text-stone-500 mt-4">Carregando detalhes do pedido...</p></div>;
  }

  if (errorMessage) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-10 text-center">
        <h1 className="font-serif text-2xl text-charcoal-gray mb-4">Não foi possível carregar o pedido</h1>
        <p className="text-sm text-stone-500 mb-6">{errorMessage}</p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => fetchOrderDetails()} className="bg-sky-500 hover:bg-sky-400 text-white">Tentar novamente</Button>
          <Button onClick={handleForceCheckPayment} variant="outline" disabled={isCheckingPayment}>{isCheckingPayment ? 'Verificando...' : 'Verificar pagamento agora'}</Button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-10 text-center">
        <h1 className="font-serif text-4xl text-charcoal-gray mb-4">Pedido não encontrado</h1>
        <Button asChild><Link to="/compras">Ver meus pedidos</Link></Button>
      </div>
    );
  }

  const isPending = order.status === 'Aguardando Pagamento' || order.status === 'Em Preparação';
  const isCancelled = order.status === 'Cancelado';
  const isPix = (order.payment_method || '').toString().toLowerCase().includes('pix');
  const addr = order.shipping_address || {};

  // CALCULAR SUBTOTAL DOS PRODUTOS A PARTIR DOS ITEMS (EVITA DUPLICAR FRETE/DOAÇÃO)
  const productsTotal = items.reduce((acc, i) => acc + (Number(i.price_at_purchase || 0) * Number(i.quantity || 1)), 0);
  const finalTotal = Number(order.total_price) || 0; // total final já gravado no pedido

  return (
    <div className="bg-off-white min-h-screen py-4 md:py-10 text-charcoal-gray">
      <div className="container mx-auto px-4 md:px-6">
        <Card className="max-w-3xl mx-auto bg-white border border-stone-200 shadow-2xl rounded-[2.5rem] overflow-hidden">
          <CardHeader className={cn(
            "text-center p-8 border-b border-stone-100",
            isCancelled ? "bg-red-50" : isPending ? "bg-stone-50" : "bg-sky-50"
          )}>
            {isCancelled ? (
              <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />
            ) : (
              <CheckCircle className="mx-auto h-16 w-16 text-sky-500" />
            )}
            <CardTitle className="font-black text-3xl tracking-tighter italic uppercase mt-4 text-charcoal-gray">
              {isCancelled ? "Pedido Expirado." : "Pedido Recebido."}
            </CardTitle>
            <CardDescription className="text-stone-500 mt-2 font-medium">
              Pedido #{order.id} • {new Date(order.created_at).toLocaleDateString('pt-BR')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 md:p-12 space-y-10">
            {isPending && isPix && (
              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[1.5rem] flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                 <div className="p-4 bg-emerald-100 rounded-full mb-1">
                   <Smartphone className="h-8 w-8 text-emerald-600 animate-pulse" />
                 </div>
                 <div>
                   <h3 className="text-emerald-800 font-black uppercase tracking-wide text-lg mb-2">Aguarde nosso contato</h3>
                   <p className="text-emerald-700 font-medium text-sm max-w-md mx-auto leading-relaxed">
                     Não é necessário fazer mais nada! Nosso <strong>assistente virtual</strong> enviará uma mensagem para o seu WhatsApp <strong>({addr?.phone || '—'})</strong> em instantes com a chave PIX para pagamento.
                   </p>
                 </div>
              </div>
            )}

            {isPending && !isPix && (
              <OrderTimer 
                createdAt={order.created_at} 
                onExpire={() => fetchOrderDetails()} 
              />
            )}

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Forma de Pagamento</p>
                <div className="flex items-center space-x-3 text-charcoal-gray">
                  {isPix ? (
                    <MessageSquare className="h-5 w-5 text-sky-600" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-sky-600" />
                  )}
                  <p className="text-lg font-black tracking-tight uppercase italic">{order.payment_method || 'Pix'}</p>
                </div>
                <div className="mt-4">
                   <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Status Financeiro</p>
                   <p className="text-sm font-bold text-charcoal-gray mt-1">{order.status}</p>
                </div>
              </div>

              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Local de Entrega</p>
                <div className="text-sm text-stone-600 space-y-1 font-medium">
                  <p className="text-charcoal-gray font-bold">{addr?.street || ''}{addr?.number ? `, ${addr.number}` : ''}</p>
                  {addr?.complement && <p>{addr.complement}</p>}
                  <p>{addr?.neighborhood || ''}</p>
                  <p>{addr?.city || ''} - {addr?.state || ''}</p>
                  <p className="text-[10px] font-black tracking-widest text-sky-600 mt-2">{addr?.cep || ''}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.3em] mb-6">Itens do Pedido</h3>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-white p-4 rounded-xl border border-stone-100">
                    <div className="flex items-center space-x-4">
                      <ProductImage src={item.image_url_at_purchase} alt={item.name_at_purchase} className="h-14 w-14 object-cover rounded-lg shadow-sm" />
                      <div>
                        <p className="font-black text-charcoal-gray tracking-tight text-sm">{item.name_at_purchase}</p>
                        <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Qtd: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="text-sky-600 font-black tracking-tighter">R$ {((item.price_at_purchase || 0) * (item.quantity || 1)).toFixed(2).replace('.', ',')}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <Separator className="bg-stone-200" />

            <div className="space-y-3 bg-stone-50 p-6 rounded-2xl border border-stone-100">
              <div className="flex justify-between text-stone-500 text-sm font-medium">
                <p>Subtotal</p>
                <p>R$ {productsTotal.toFixed(2).replace('.', ',')}</p>
              </div>
              <div className="flex justify-between text-stone-500 text-sm font-medium">
                <p>Frete Especial</p>
                <p className="text-green-600 font-black uppercase text-[10px] tracking-widest">{Number(order.shipping_cost) > 0 ? `R$ ${Number(order.shipping_cost).toFixed(2).replace('.', ',')}` : 'Grátis'}</p>
              </div>
              {Number(order.donation_amount) > 0 && (
                <div className="flex justify-between text-rose-500 text-sm font-medium">
                  <div className="flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 fill-current" />
                    <span>Doação Solidária</span>
                  </div>
                  <p>+ R$ {(Number(order.donation_amount) || 0).toFixed(2).replace('.', ',')}</p>
                </div>
              )}
              <div className="flex justify-between font-black text-3xl pt-4 border-t border-stone-200 mt-2 text-charcoal-gray tracking-tighter italic uppercase">
                <p>Total</p>
                <p className="text-sky-600">R$ {(finalTotal || 0).toFixed(2).replace('.', ',')}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <Button asChild className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest px-10 h-16 text-lg rounded-2xl shadow-xl transition-all active:scale-95">
                    <Link to="/dashboard">Continuar Comprando</Link>
                </Button>
                <Button asChild variant="outline" className="px-10 h-16 text-lg border-stone-200 text-stone-600 hover:bg-stone-50 rounded-2xl font-black uppercase tracking-widest">
                    <Link to="/compras">Meus Pedidos</Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfirmacaoPedido;