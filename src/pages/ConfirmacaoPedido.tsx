import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, CreditCard, MessageSquare, AlertTriangle } from 'lucide-react';
import OrderTimer from '@/components/OrderTimer';
import { cn } from '@/lib/utils';

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  shipping_cost: number;
  status: string;
  payment_method: string | null;
  shipping_address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    complement?: string;
  };
}

interface OrderItem {
  name_at_purchase: string;
  quantity: number;
  price_at_purchase: number;
  image_url_at_purchase: string;
}

const ConfirmacaoPedido = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrderDetails = async () => {
    if (!id) return;
    setLoading(true);

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderError || !orderData) {
      console.error("Error fetching order:", orderError);
      setLoading(false);
      return;
    }
    setOrder(orderData as Order);

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('name_at_purchase, quantity, price_at_purchase, image_url_at_purchase')
      .eq('order_id', id);
    
    if (itemsError) {
      console.error("Error fetching order items:", itemsError);
    } else {
      setItems(itemsData as OrderItem[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-4xl text-white mb-4">Pedido não encontrado</h1>
        <Button asChild><Link to="/compras">Ver meus pedidos</Link></Button>
      </div>
    );
  }

  const isPending = order.status === 'Aguardando Pagamento';
  const isCancelled = order.status === 'Cancelado';
  const { shipping_address: addr } = order;

  return (
    <div className="bg-slate-950 min-h-screen py-12 md:py-20 text-white">
      <div className="container mx-auto px-4">
        <Card className="max-w-3xl mx-auto bg-white/5 border border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
          <CardHeader className={cn(
            "text-center p-8 border-b border-white/5",
            isCancelled ? "bg-red-500/10" : isPending ? "bg-white/[0.02]" : "bg-sky-500/10"
          )}>
            {isCancelled ? (
              <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />
            ) : (
              <CheckCircle className="mx-auto h-16 w-16 text-sky-400" />
            )}
            <CardTitle className="font-black text-3xl tracking-tighter italic uppercase mt-4">
              {isCancelled ? "Pedido Expirado." : "Pedido Recebido."}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2 font-medium">
              Pedido #{order.id} • {new Date(order.created_at).toLocaleDateString('pt-BR')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 md:p-12 space-y-10">
            {/* Seção de Alerta de Reserva */}
            {isPending && (
              <OrderTimer 
                createdAt={order.created_at} 
                onExpire={() => fetchOrderDetails()} 
              />
            )}

            {isCancelled && (
              <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center">
                <p className="text-red-400 font-bold">Infelizmente o tempo de pagamento expirou e os itens voltaram para o estoque. Por favor, realize um novo pedido.</p>
                <Button asChild variant="outline" className="mt-4 border-red-500/50 text-red-400 hover:bg-red-500/10">
                  <Link to="/produtos">Voltar à Loja</Link>
                </Button>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Forma de Pagamento</p>
                <div className="flex items-center space-x-3 text-white">
                  {order.payment_method?.toLowerCase().includes('pix') ? (
                    <MessageSquare className="h-5 w-5 text-sky-400" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-sky-400" />
                  )}
                  <p className="text-lg font-black tracking-tight uppercase italic">{order.payment_method || 'Pix'}</p>
                </div>
                <div className="mt-4">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status Financeiro</p>
                   <p className="text-sm font-bold text-white mt-1">{order.status}</p>
                </div>
              </div>

              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Local de Entrega</p>
                <div className="text-sm text-slate-300 space-y-1 font-medium">
                  <p className="text-white font-bold">{addr.street}, {addr.number}</p>
                  {addr.complement && <p>{addr.complement}</p>}
                  <p>{addr.neighborhood}</p>
                  <p>{addr.city} - {addr.state}</p>
                  <p className="text-[10px] font-black tracking-widest text-sky-400 mt-2">{addr.cep}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Itens do Pedido</h3>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-white/[0.02] p-4 rounded-xl border border-white/5">
                    <div className="flex items-center space-x-4">
                      <img src={item.image_url_at_purchase} alt={item.name_at_purchase} className="h-14 w-14 object-cover rounded-lg shadow-sm" />
                      <div>
                        <p className="font-black text-white uppercase tracking-tight text-sm">{item.name_at_purchase}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Qtd: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="text-sky-400 font-black tracking-tighter">R$ {(item.price_at_purchase * item.quantity).toFixed(2).replace('.', ',')}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <Separator className="bg-white/5" />

            <div className="space-y-3 bg-white/5 p-6 rounded-2xl border border-white/5">
              <div className="flex justify-between text-slate-400 text-sm font-medium">
                <p>Subtotal</p>
                <p>R$ {order.total_price.toFixed(2).replace('.', ',')}</p>
              </div>
              <div className="flex justify-between text-slate-400 text-sm font-medium">
                <p>Frete Especial</p>
                <p className="text-green-400 font-black uppercase text-[10px] tracking-widest">Grátis</p>
              </div>
              <div className="flex justify-between font-black text-3xl pt-4 border-t border-white/5 text-white tracking-tighter italic uppercase">
                <p>Total</p>
                <p className="text-sky-400">R$ {(order.total_price + order.shipping_cost).toFixed(2).replace('.', ',')}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <Button asChild className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest px-10 h-16 text-lg rounded-2xl shadow-xl transition-all active:scale-95">
                    <Link to="/">Continuar Comprando</Link>
                </Button>
                <Button asChild variant="outline" className="px-10 h-16 text-lg border-white/10 hover:bg-white/5 rounded-2xl font-black uppercase tracking-widest">
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