import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, CreditCard, MessageSquare } from 'lucide-react';

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

  useEffect(() => {
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

    fetchOrderDetails();
  }, [id]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-gold-accent" /></div>;
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-4xl text-charcoal-gray mb-4">Pedido não encontrado</h1>
        <Button asChild><Link to="/compras">Ver meus pedidos</Link></Button>
      </div>
    );
  }

  const { shipping_address: addr } = order;

  return (
    <div className="bg-stone-100 min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4">
        <Card className="max-w-3xl mx-auto bg-white shadow-lg overflow-hidden border-none">
          <CardHeader className="text-center bg-green-50 p-8 border-b border-green-100">
            <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
            <CardTitle className="font-serif text-3xl text-green-800 mt-4">Obrigado pelo seu pedido!</CardTitle>
            <CardDescription className="text-green-700 mt-2">
              Seu pedido #{order.id} foi recebido e está sendo processado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            <div className="space-y-8">
              {/* Seção de Pagamento */}
              <div className="bg-stone-50 p-6 rounded-lg border border-stone-200">
                <div className="flex items-center space-x-3 mb-2">
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Forma de Pagamento</p>
                </div>
                <div className="flex items-center space-x-3 text-charcoal-gray">
                  {order.payment_method?.toLowerCase().includes('pix') ? (
                    <MessageSquare className="h-5 w-5 text-gold-accent" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-gold-accent" />
                  )}
                  <p className="text-lg font-medium">{order.payment_method || 'Pix'}</p>
                </div>
                <p className="text-sm text-stone-500 mt-2">Status: <span className="font-semibold text-charcoal-gray">{order.status}</span></p>
              </div>

              <div>
                <h3 className="font-serif text-xl text-charcoal-gray mb-4">Resumo dos Itens</h3>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img src={item.image_url_at_purchase} alt={item.name_at_purchase} className="h-16 w-16 object-cover rounded-md shadow-sm" />
                        <div>
                          <p className="font-semibold text-charcoal-gray">{item.name_at_purchase}</p>
                          <p className="text-sm text-stone-600">Qtd: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="text-charcoal-gray font-medium">R$ {(item.price_at_purchase * item.quantity).toFixed(2).replace('.', ',')}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />

              <div>
                <h3 className="font-serif text-xl text-charcoal-gray mb-4">Detalhes da Entrega</h3>
                <div className="text-stone-700 bg-stone-50 p-4 rounded-md border border-stone-100">
                  <p className="font-medium">{addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ''}</p>
                  <p>{addr.neighborhood}</p>
                  <p>{addr.city}, {addr.state} - {addr.cep}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between text-stone-600">
                  <p>Subtotal</p>
                  <p>R$ {order.total_price.toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="flex justify-between text-stone-600">
                  <p>Frete</p>
                  <p className="text-green-600 font-medium">Grátis</p>
                </div>
                <div className="flex justify-between font-bold text-2xl pt-2 border-t text-charcoal-gray">
                  <p>Total</p>
                  <p className="text-tobacco-brown">R$ {(order.total_price + order.shipping_cost).toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild className="bg-gold-accent hover:bg-gold-accent/90 text-charcoal-gray font-bold px-8 py-6 text-lg shadow-lg">
                    <Link to="/">Continuar Comprando</Link>
                </Button>
                <Button asChild variant="outline" className="px-8 py-6 text-lg border-stone-300">
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