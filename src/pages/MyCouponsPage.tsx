import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Ticket, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShoppingBag, 
  ArrowLeft,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';
import { useSEO } from '@/hooks/useSEO';

interface UserCoupon {
  id: number;
  user_id: string;
  coupon_id: number;
  expires_at: string;
  is_used: boolean;
  order_id: number | null;
  created_at: string;
  coupons: {
    name: string;
    discount_value: number;
    minimum_order_value: number;
    points_cost: number;
  };
  order_date?: string;
}

interface CouponStatus {
  status: 'available' | 'expiring' | 'expired' | 'used';
  label: string;
  color: string;
  borderColor: string;
}

const MyCouponsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [orderDates, setOrderDates] = useState<Record<number, string>>({});

  // SEO - My Coupons Page
  useSEO({
    title: 'Meus Cupons | DKCWB',
    description: 'Gerencie seus cupons de desconto do Clube DK. Acompanhe cupons disponíveis, utilizados e expirados na DKCWB.',
    url: 'https://dkcwb.com.br/meus-cupons'
  });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        showError('Faça login para ver seus cupons');
        navigate('/login');
        return;
      }

      const { data: userCoupons, error: couponsError } = await supabase
        .from('user_coupons')
        .select(`
          id,
          user_id,
          coupon_id,
          expires_at,
          is_used,
          order_id,
          created_at,
          coupons (
            name,
            discount_value,
            minimum_order_value,
            points_cost
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (couponsError) {
        showError('Erro ao buscar cupons');
        return;
      }

      const formattedCoupons: UserCoupon[] = (userCoupons || []).map((uc: any) => ({
        id: uc.id,
        user_id: uc.user_id,
        coupon_id: uc.coupon_id,
        expires_at: uc.expires_at,
        is_used: uc.is_used,
        order_id: uc.order_id,
        created_at: uc.created_at,
        coupons: uc.coupons,
      }));

      // Buscar datas dos pedidos para cupons usados
      const usedCouponsWithOrders = formattedCoupons.filter(uc => uc.is_used && uc.order_id);
      const orderIds = usedCouponsWithOrders.map(uc => uc.order_id).filter((id): id is number => id !== null);
      
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, created_at')
          .in('id', orderIds);
        
        const orderDateMap: Record<number, string> = {};
        orders?.forEach((order: any) => {
          orderDateMap[order.id] = order.created_at;
        });
        setOrderDates(orderDateMap);
      }

      setCoupons(formattedCoupons);
    } catch (error) {
      console.error('[MyCouponsPage] Error:', error);
      showError('Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const getCouponStatus = (coupon: UserCoupon): CouponStatus => {
    if (coupon.is_used) {
      return {
        status: 'used',
        label: 'Usado',
        color: 'bg-slate-100 text-slate-600',
        borderColor: 'border-slate-300'
      };
    }

    const expirationDate = new Date(coupon.expires_at);
    const now = new Date();

    if (expirationDate < now) {
      const daysExpired = differenceInDays(now, expirationDate);
      return {
        status: 'expired',
        label: `Expirou há ${daysExpired} ${daysExpired === 1 ? 'dia' : 'dias'}`,
        color: 'bg-red-50 text-red-600',
        borderColor: 'border-red-300'
      };
    }

    const daysLeft = differenceInDays(expirationDate, now);
    if (daysLeft <= 3) {
      return {
        status: 'expiring',
        label: `Expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`,
        color: 'bg-orange-100 text-orange-600',
        borderColor: 'border-orange-400'
      };
    }

    return {
      status: 'available',
      label: 'Disponível',
      color: 'bg-green-100 text-green-600',
      borderColor: 'border-green-400'
    };
  };

  const availableCoupons = coupons.filter(c => !c.is_used && new Date(c.expires_at) > new Date());
  const usedCoupons = coupons.filter(c => c.is_used);
  const expiredCoupons = coupons.filter(c => !c.is_used && new Date(c.expires_at) < new Date());

  const renderCouponCard = (coupon: UserCoupon) => {
    const status = getCouponStatus(coupon);
    const orderDate = coupon.order_id ? orderDates[coupon.order_id] : null;

    return (
      <Card 
        key={coupon.id} 
        className={cn(
          "overflow-hidden transition-all duration-300",
          status.status === 'available' && "hover:border-sky-400 hover:shadow-md",
          status.status === 'used' && "opacity-80 grayscale hover:grayscale-0",
          status.status === 'expired' && "opacity-70",
          "rounded-2xl shadow-sm"
        )}
      >
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left side - Main info */}
            <div className="flex-1 space-y-3">
              {/* Status badge */}
              <div className="flex items-center gap-2">
                <Badge className={cn("font-black uppercase text-[10px] tracking-widest px-3 py-1", status.color)}>
                  {status.label}
                </Badge>
              </div>

              {/* Coupon name */}
              <div className="space-y-1">
                <h3 
                  className={cn(
                    "font-black text-lg uppercase tracking-tight",
                    status.status === 'used' && "line-through text-slate-600"
                  )}
                  translate="no"
                >
                  {coupon.coupons.name}
                </h3>
                {status.status === 'used' && (
                  <p className="text-xs text-slate-500">Cupom utilizado</p>
                )}
              </div>

              {/* Discount value */}
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-3xl font-black tracking-tighter",
                  status.status === 'used' ? "text-slate-600 line-through" : "text-sky-600"
                )}>
                  R$ {coupon.coupons.discount_value.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-sm font-bold text-slate-500">OFF</span>
              </div>

              {/* Metadata */}
              <div className="space-y-2">
                {/* Created at */}
                <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  <Calendar className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Resgatado em {format(new Date(coupon.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>

                {/* Expiration date */}
                {!coupon.is_used && (
                  <div className="flex items-center text-[10px] font-bold uppercase tracking-widest">
                    <Clock className={cn("mr-1.5 h-3.5 w-3.5", 
                      status.status === 'expired' ? "text-red-500" : "text-sky-500"
                    )} />
                    <span className={cn(
                      status.status === 'expired' ? "text-red-600" : "text-slate-500"
                    )}>
                      {status.status === 'expired' 
                        ? `Expirou em ${format(new Date(coupon.expires_at), "dd 'de' MMMM", { locale: ptBR })}`
                        : `Válido até ${format(new Date(coupon.expires_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                      }
                    </span>
                  </div>
                )}

                {/* Used info */}
                {coupon.is_used && (
                  <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                    Usado em {orderDate 
                      ? format(new Date(orderDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Data não disponível'
                    }
                    {coupon.order_id && (
                      <span className="ml-2">
                        · Pedido #{coupon.order_id}
                      </span>
                    )}
                  </div>
                )}

                {/* Minimum order value */}
                {coupon.coupons.minimum_order_value > 0 && !coupon.is_used && status.status !== 'expired' && (
                  <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <ShoppingBag className="mr-1.5 h-3.5 w-3.5 text-sky-500" />
                    Pedido mínimo: R$ {coupon.coupons.minimum_order_value.toFixed(2).replace('.', ',')}
                  </div>
                )}

                {/* Points cost */}
                <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  <Ticket className="mr-1.5 h-3.5 w-3.5 text-sky-500" />
                  Custo: {coupon.coupons.points_cost} pontos
                </div>
              </div>
            </div>

            {/* Right side - Visual indicator */}
            <div className={cn(
              "flex items-center justify-center w-20 h-20 rounded-2xl shrink-0",
              status.status === 'available' && "bg-sky-50 border-2 border-sky-200",
              status.status === 'expiring' && "bg-orange-50 border-2 border-orange-200",
              status.status === 'used' && "bg-slate-100 border-2 border-slate-200",
              status.status === 'expired' && "bg-red-50 border-2 border-red-200"
            )}>
              {status.status === 'available' && <Ticket className="h-10 w-10 text-sky-500" />}
              {status.status === 'expiring' && <AlertTriangle className="h-10 w-10 text-orange-500" />}
              {status.status === 'used' && <CheckCircle2 className="h-10 w-10 text-slate-500" />}
              {status.status === 'expired' && <XCircle className="h-10 w-10 text-red-500" />}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')}
          className="mb-6 text-slate-600 hover:text-sky-500"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>
        <div className="space-y-4">
          <Skeleton className="h-12 w-48 bg-slate-200 rounded-xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-off-white min-h-screen text-charcoal-gray">
      <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-slate-600 hover:text-sky-500 font-bold text-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase mb-2">
                Meus Cupons
              </h1>
              <p className="text-slate-600 font-medium">
                Gerencie todos os seus cupons e acompanhe seu histórico de uso
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div className="bg-white border border-green-200 rounded-xl px-4 py-3 shadow-sm">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Disponíveis</p>
                <p className="text-2xl font-black text-green-600">{availableCoupons.length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Usados</p>
                <p className="text-2xl font-black text-slate-600">{usedCoupons.length}</p>
              </div>
              <div className="bg-white border border-red-200 rounded-xl px-4 py-3 shadow-sm">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Expirados</p>
                <p className="text-2xl font-black text-red-600">{expiredCoupons.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="bg-white border border-slate-200 p-1 rounded-xl h-14 w-full sm:w-auto inline-flex mb-8">
            <TabsTrigger value="available" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-slate-600 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all px-6">
              Disponíveis ({availableCoupons.length})
            </TabsTrigger>
            <TabsTrigger value="used" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-slate-600 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all px-6">
              Usados ({usedCoupons.length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-slate-600 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all px-6">
              Expirados ({expiredCoupons.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-slate-600 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all px-6">
              Todos ({coupons.length})
            </TabsTrigger>
          </TabsList>

          {/* Available Coupons */}
          <TabsContent value="available" className="space-y-4">
            {availableCoupons.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {availableCoupons.map(renderCouponCard)}
              </div>
            ) : (
              <Card className="p-12 text-center border-dashed border-2 border-slate-300">
                <Ticket className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                <h3 className="font-black text-xl text-slate-600 mb-2">Nenhum cupom disponível</h3>
                <p className="text-slate-500 mb-4">Resgate seus pontos no Clube DK para ganhar descontos!</p>
                <Button 
                  onClick={() => navigate('/clube-dk')}
                  className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest"
                >
                  Ir para o Clube DK
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Used Coupons */}
          <TabsContent value="used" className="space-y-4">
            {usedCoupons.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {usedCoupons.map(renderCouponCard)}
              </div>
            ) : (
              <Card className="p-12 text-center border-dashed border-2 border-slate-300">
                <CheckCircle2 className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                <h3 className="font-black text-xl text-slate-600 mb-2">Nenhum cupom usado</h3>
                <p className="text-slate-500">Os cupons utilizados aparecerão aqui.</p>
              </Card>
            )}
          </TabsContent>

          {/* Expired Coupons */}
          <TabsContent value="expired" className="space-y-4">
            {expiredCoupons.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {expiredCoupons.map(renderCouponCard)}
              </div>
            ) : (
              <Card className="p-12 text-center border-dashed border-2 border-slate-300">
                <XCircle className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                <h3 className="font-black text-xl text-slate-600 mb-2">Nenhum cupom expirado</h3>
                <p className="text-slate-500">Os cupons expirados aparecerão aqui.</p>
              </Card>
            )}
          </TabsContent>

          {/* All Coupons */}
          <TabsContent value="all" className="space-y-4">
            {coupons.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {coupons.map(renderCouponCard)}
              </div>
            ) : (
              <Card className="p-12 text-center border-dashed border-2 border-slate-300">
                <Loader2 className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                <h3 className="font-black text-xl text-slate-600 mb-2">Nenhum cupom ainda</h3>
                <p className="text-slate-500 mb-4">Comece a fazer compras e acumular pontos para ganhar cupons!</p>
                <Button 
                  onClick={() => navigate('/produtos')}
                  className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest"
                >
                  Ver Produtos
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyCouponsPage;