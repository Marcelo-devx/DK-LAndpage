import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, Package, RefreshCw } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface OrderRoute {
  id: number;
  scheduled_delivery_date: string;
  status: string;
  shipping_address: any;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

const AdminLogistics = () => {
  const [orders, setOrders] = useState<OrderRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRoutes = async () => {
    setLoading(true);
    // Verificar permissão de admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/login'); return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'adm') { 
      navigate('/'); 
      return; 
    }

    // Buscar pedidos que não estão cancelados nem entregues
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        scheduled_delivery_date,
        status,
        shipping_address,
        profiles (first_name, last_name)
      `)
      .neq('status', 'Cancelado')
      .neq('delivery_status', 'Entregue')
      .order('scheduled_delivery_date', { ascending: true });

    if (error) console.error(error);
    else setOrders(data as any[] || []);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Agrupar pedidos por data
  const groupedOrders = orders.reduce((acc, order) => {
    const date = order.scheduled_delivery_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(order);
    return acc;
  }, {} as Record<string, OrderRoute[]>);

  const getStatusColor = (status: string) => {
    if (status.includes('Finalizada') || status.includes('Preparação')) return 'bg-green-500/20 text-green-400 border-green-500/50';
    if (status.includes('Aguardando')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    return 'bg-white/10 text-white';
  };

  const formatDateTitle = (dateStr: string) => {
    if (!dateStr) return 'Data não definida';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    if (isToday(date)) return 'Rota de HOJE';
    if (isTomorrow(date)) return 'Rota de AMANHÃ';
    return `Rota de ${format(date, 'EEEE, dd/MM', { locale: ptBR })}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-sky-500">Painel de Logística</h1>
            <p className="text-slate-400 font-medium">Gerenciamento de rotas e entregas</p>
          </div>
          <Button onClick={fetchRoutes} variant="outline" className="border-white/10 hover:bg-white/10 text-white">
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {Object.keys(groupedOrders).sort().map((date) => (
            <Card key={date} className="bg-white/5 border-white/10 overflow-hidden">
              <CardHeader className="bg-white/5 border-b border-white/5 py-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/20 rounded-lg">
                    <Truck className="h-6 w-6 text-sky-400" />
                  </div>
                  <CardTitle className="text-xl font-bold uppercase tracking-wide text-white">
                    {formatDateTitle(date)}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="bg-white/10 text-white font-bold">
                  {groupedOrders[date].length} Entregas
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {groupedOrders[date].map((order) => (
                    <div key={order.id} className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sky-400 font-bold">#{order.id}</span>
                          <span className="font-bold text-white uppercase text-sm">
                            {order.profiles?.first_name} {order.profiles?.last_name}
                          </span>
                          <Badge className={`text-[10px] font-bold border ${getStatusColor(order.status)}`}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-slate-400">
                          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                          <p>
                            {order.shipping_address?.street}, {order.shipping_address?.number}
                            {order.shipping_address?.complement && ` - ${order.shipping_address?.complement}`}
                            <br />
                            {order.shipping_address?.neighborhood} - {order.shipping_address?.city}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 md:justify-end">
                        <Button size="sm" variant="outline" className="border-white/10 text-slate-300 hover:text-white text-xs uppercase font-bold" onClick={() => window.open(`https://wa.me/55${order.shipping_address?.phone?.replace(/\D/g,'')}`, '_blank')}>
                          WhatsApp
                        </Button>
                        <Button size="sm" className="bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs uppercase">
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {Object.keys(groupedOrders).length === 0 && (
            <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
              <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-400">Nenhuma entrega pendente</h3>
              <p className="text-slate-500">Todos os pedidos foram entregues ou cancelados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogistics;