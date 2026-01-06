import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Package, ChevronRight, CreditCard, MessageSquare, Clock, CheckCircle2, Truck, AlertCircle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ReviewModal from '@/components/ReviewModal';
import { showLoading, dismissToast, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface OrderItem {
  item_id: number;
  item_type: 'product' | 'promotion';
  name_at_purchase: string;
  quantity: number;
  price_at_purchase: number;
}

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  shipping_cost: number;
  status: string;
  delivery_status: string;
  payment_method: string | null;
  order_items: OrderItem[];
  reviewed_products: number[];
  shipping_address: any;
}

const getStatusBadge = (status: string) => {
  const s = status.toLowerCase();
  
  if (s.includes('preparação')) return { label: 'Em Preparação', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
  if (s.includes('finalizada') || s.includes('pago') || s.includes('aprovado')) return { label: 'Finalizada', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  if (s.includes('trânsito') || s.includes('enviado') || s.includes('despachado')) return { label: 'Em Trânsito', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' };
  if (s.includes('aguardando') || s.includes('pendente')) return { label: 'Aguardando Pagamento', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' };
  if (s.includes('cancelado')) return { label: 'Cancelado', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20' };
  
  return { label: status, color: 'text-slate-200 bg-white/5 border-white/10' };
};

const getDeliveryBadge = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('aguardando') || s.includes('pendente')) return { label: 'Aguardando', color: 'text-slate-400 bg-white/5 border-white/10' };
  if (s.includes('enviado') || s.includes('caminho') || s.includes('despachado')) return { label: 'Enviado', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' };
  if (s.includes('entregue')) return { label: 'Entregue', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  return { label: status, color: 'text-slate-400 bg-white/5 border-white/10' };
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingItem, setReviewingItem] = useState<{ productId: number; orderId: number; productName: string } | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/login'); setLoading(false); return; }

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, total_price, shipping_cost, status, delivery_status, payment_method, shipping_address')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (ordersError) { console.error(ordersError); setLoading(false); return; }
    if (!ordersData || ordersData.length === 0) { setOrders([]); setLoading(false); return; }

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase.from('order_items').select('order_id, item_id, item_type, name_at_purchase, quantity, price_at_purchase').in('order_id', orderIds);
    const { data: reviewsData } = await supabase.from('reviews').select('product_id, order_id').eq('user_id', session.user.id).in('order_id', orderIds);

    const reviewedItems = reviewsData ? reviewsData.map(r => `${r.order_id}-${r.product_id}`) : [];
    const ordersWithDetails = ordersData.map(order => ({
      ...order,
      order_items: (itemsData || []).filter(item => item.order_id === order.id),
      reviewed_products: reviewedItems.filter(r => r.startsWith(`${order.id}-`)).map(r => parseInt(r.split('-')[1])),
    }));

    setOrders(ordersWithDetails as Order[]);
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
    supabase.from('app_settings').select('value').eq('key', 'whatsapp_contact_number').single().then(({ data }) => {
      if (data) setWhatsappNumber(data.value);
    });
  }, [fetchOrders]);

  const handlePayWithMP = async (order: Order) => {
    const toastId = showLoading("Iniciando pagamento...");
    try {
      const { data, error } = await supabase.functions.invoke('create-mercadopago-preference', {
        body: { shipping_address: order.shipping_address, order_id: order.id, total_price: order.total_price },
      });
      if (error) throw error;
      window.location.href = data.init_point;
    } catch (e: any) {
      showError("Não foi possível iniciar o pagamento com cartão.");
    } finally { dismissToast(toastId); }
  };

  const handlePayWithPIX = async (order: Order) => {
    if (!whatsappNumber) { showError("WhatsApp não configurado."); return; }
    
    const toastId = showLoading("Atualizando status...");
    const { error } = await supabase
      .from('orders')
      .update({ status: 'Em Preparação' })
      .eq('id', order.id);

    if (error) {
      dismissToast(toastId);
      showError("Erro ao atualizar o pedido.");
      return;
    }

    const itemsSummary = order.order_items.map(item => `- ${item.name_at_purchase} (Qtd: ${item.quantity})`).join('\n');
    const msg = `Olá! Gostaria de finalizar o pagamento do meu pedido (#${order.id}) via PIX.\n\nTotal: R$ ${order.total_price.toFixed(2).replace('.', ',')}\n\nItens:\n${itemsSummary}`;
    
    dismissToast(toastId);
    window.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
    
    fetchOrders();
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 text-white">
      <header className="mb-12 max-w-5xl mx-auto">
        <h1 className="text-4xl font-extrabold tracking-tight uppercase">Minhas Compras.</h1>
        <p className="text-slate-300 font-semibold mt-2">Acompanhe seus pedidos e histórico de exclusividade.</p>
      </header>

      <div className="max-w-5xl mx-auto">
        {orders.length === 0 ? (
          <div className="text-center py-24 bg-white/5 rounded-[2.5rem] border border-white/5">
            <Package className="mx-auto h-20 w-20 text-white/10 mb-6" />
            <h3 className="text-2xl font-bold tracking-tight uppercase">Nenhum pedido encontrado.</h3>
            <p className="text-slate-400 mt-2 mb-10">Sua jornada premium começa aqui.</p>
            <Button asChild className="bg-sky-500 hover:bg-sky-400 text-white font-bold uppercase tracking-widest px-10 h-14 rounded-xl shadow-lg">
              <Link to="/produtos">Explorar Loja</Link>
            </Button>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-6">
            {orders.map((order) => {
              const financialStatus = getStatusBadge(order.status);
              const deliveryStatus = getDeliveryBadge(order.delivery_status || 'Aguardando');
              
              return (
                <AccordionItem value={`order-${order.id}`} key={order.id} className="bg-white/5 border border-white/10 rounded-[1.5rem] overflow-hidden transition-all duration-300 hover:border-sky-500/40 shadow-xl">
                  <AccordionTrigger className="p-6 hover:no-underline data-[state=open]:bg-white/[0.04]">
                    <div className="grid grid-cols-2 md:grid-cols-6 items-center w-full gap-6 text-left">
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">Pedido</p>
                        <p className="text-xl font-bold text-white tracking-tight">#{order.id}</p>
                        <div className="flex items-center text-[11px] text-slate-300 mt-1 font-semibold">
                          <Calendar className="h-3 w-3 mr-1 text-sky-400" />
                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">Total</p>
                        <p className="text-xl font-bold text-sky-400 tracking-tight">R$ {(order.total_price + order.shipping_cost).toFixed(2).replace('.', ',')}</p>
                      </div>

                      <div className="hidden md:block">
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">Método</p>
                        <p className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                          {order.payment_method === 'PIX via WhatsApp' ? 'Pix' : order.payment_method || 'Pix'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-2">Logística</p>
                        <Badge className={cn("px-3 py-1 text-[10px] font-bold border uppercase tracking-wider", deliveryStatus.color)}>
                          {deliveryStatus.label}
                        </Badge>
                      </div>

                      <div className="md:col-span-2">
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-2">Status Financeiro</p>
                        <Badge className={cn("px-4 py-1.5 text-xs font-bold border uppercase tracking-wider", financialStatus.color)}>
                          {financialStatus.label}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="p-8 border-t border-white/5 bg-slate-900/40">
                    <div className="grid md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Itens Selecionados</h4>
                        <div className="space-y-4">
                          {order.order_items.map(item => (
                            <div key={`${order.id}-${item.item_id}-${item.item_type}`} className="flex justify-between items-center bg-white/[0.03] p-4 rounded-2xl border border-white/5 transition-colors hover:bg-white/[0.06]">
                              <div>
                                <p className="text-slate-100 font-bold text-sm uppercase tracking-tight">{item.name_at_purchase}</p>
                                <p className="text-xs text-slate-300 mt-1 font-semibold">{item.quantity}x R$ {item.price_at_purchase.toFixed(2).replace('.', ',')}</p>
                              </div>
                              {order.status.toLowerCase().includes('finalizada') && item.item_type === 'product' && (
                                order.reviewed_products.includes(item.item_id) ? (
                                  <Badge variant="outline" className="text-slate-400 border-white/10 uppercase text-[10px] font-bold">Avaliado</Badge>
                                ) : (
                                  <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest border-sky-500/50 text-sky-400 hover:bg-sky-500 hover:text-white" onClick={() => setReviewingItem({ productId: item.item_id, orderId: order.id, productName: item.name_at_purchase })}>
                                    Avaliar
                                  </Button>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-8">
                        <div>
                          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Detalhamento</h4>
                          <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/5 space-y-3">
                            <div className="flex justify-between text-sm text-slate-300 font-medium"><span>Subtotal</span><span>R$ {order.total_price.toFixed(2).replace('.', ',')}</span></div>
                            <div className="flex justify-between text-sm text-slate-300 font-medium"><span>Frete Especial</span><span className="text-emerald-400">Grátis</span></div>
                            <div className="flex justify-between text-xl font-bold pt-4 border-t border-white/10 mt-2 text-white"><span>Total</span><span className="text-sky-400">R$ {(order.total_price + order.shipping_cost).toFixed(2).replace('.', ',')}</span></div>
                          </div>
                        </div>

                        {(order.status.toLowerCase().includes('aguardando') || order.status.toLowerCase().includes('pendente')) && (
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Ação Requerida</h4>
                            <div className="grid grid-cols-1 gap-3">
                              <Button onClick={() => handlePayWithMP(order)} className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold uppercase tracking-widest h-14 rounded-xl shadow-lg">
                                <CreditCard className="mr-2 h-5 w-5" /> Cartão de Crédito
                              </Button>
                              <Button onClick={() => handlePayWithPIX(order)} variant="outline" className="w-full border-white/20 hover:bg-white/5 text-slate-200 font-bold uppercase tracking-widest h-14 rounded-xl">
                                <MessageSquare className="mr-2 h-5 w-5" /> Pagar via WhatsApp
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="pt-4 text-right">
                          <Link to={`/confirmacao-pedido/${order.id}`} className="inline-flex items-center text-[10px] font-bold text-sky-400 hover:text-sky-300 uppercase tracking-widest group">
                            Ver detalhes do endereço <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
      {reviewingItem && <ReviewModal isOpen={!!reviewingItem} onOpenChange={() => setReviewingItem(null)} productId={reviewingItem.productId} orderId={reviewingItem.orderId} productName={reviewingItem.productName} onReviewSubmitted={() => { setReviewingItem(null); fetchOrders(); }} />}
    </div>
  );
};

export default OrdersPage;