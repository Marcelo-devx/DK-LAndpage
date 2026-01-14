import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from './ui/skeleton';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Gem, Ticket, Loader2, Calendar, ShoppingBag, History, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Coupon {
  id: number;
  name: string;
  description: string;
  discount_value: number;
  points_cost: number;
  minimum_order_value: number;
  stock_quantity: number;
}

interface UserCoupon {
  id: number;
  expires_at: string;
  is_used: boolean;
  order_id: number | null;
  created_at: string;
  coupons: {
    name: string;
    discount_value: number;
    minimum_order_value: number;
  };
}

interface CouponsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userPoints: number | null;
  onRedemption: () => void;
}

const CouponsModal = ({ isOpen, onOpenChange, userPoints, onRedemption }: CouponsModalProps) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [myCoupons, setMyCoupons] = useState<UserCoupon[]>([]);
  const [usedCoupons, setUsedCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    const couponsPromise = supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .gt('stock_quantity', 0)
      .order('points_cost', { ascending: true });

    const userCouponsPromise = session ? supabase
      .from('user_coupons')
      .select(`
        id,
        expires_at,
        is_used,
        order_id,
        created_at,
        coupons (
          name,
          discount_value,
          minimum_order_value
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null });

    const [couponsRes, userCouponsRes] = await Promise.all([couponsPromise, userCouponsPromise]);

    if (couponsRes.error) console.error("Error fetching coupons:", couponsRes.error);
    else setCoupons(couponsRes.data || []);

    const castedUserRes = userCouponsRes as any;
    if (castedUserRes.error) {
      console.error("Error fetching user coupons:", castedUserRes.error);
    } else {
      const allUserCoupons = castedUserRes.data || [];
      setMyCoupons(allUserCoupons.filter((c: UserCoupon) => !c.is_used && new Date(c.expires_at) > new Date()));
      setUsedCoupons(allUserCoupons.filter((c: UserCoupon) => c.is_used));
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleRedeem = async (coupon: Coupon) => {
    if (userPoints === null || userPoints < coupon.points_cost) {
      showError(`Você precisa de ${coupon.points_cost} pontos para este cupom.`);
      return;
    }
    
    setRedeemingId(coupon.id);
    const toastId = showLoading("Processando seu resgate...");

    try {
      const { error } = await supabase.rpc('redeem_coupon', {
        coupon_id_to_redeem: coupon.id
      });

      dismissToast(toastId);
      
      if (error) {
        showError(error.message || "Erro ao resgatar o cupom.");
      } else {
        showSuccess("Cupom resgatado! Ele já está disponível para uso.");
        onRedemption(); 
        await fetchData(); 
      }
    } catch (err) {
      dismissToast(toastId);
      showError("Ocorreu um erro inesperado.");
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white border-stone-200 text-charcoal-gray max-h-[90vh] overflow-hidden flex flex-col rounded-[2rem] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-black text-3xl tracking-tighter italic uppercase text-charcoal-gray">Central de Cupons.</DialogTitle>
          <DialogDescription className="text-stone-500 font-medium">
            Gerencie seus benefícios e acompanhe seu histórico de uso.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="redeem" className="w-full mt-6 flex-grow flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 bg-stone-100 border border-stone-200 h-12 rounded-xl p-1 shrink-0">
            <TabsTrigger value="redeem" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-600 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all">Resgatar</TabsTrigger>
            <TabsTrigger value="mine" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-600 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all">Disponíveis ({myCoupons.length})</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-600 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-all">Histórico</TabsTrigger>
          </TabsList>

          <div className="flex-grow overflow-y-auto mt-8 pr-2 -mr-2 space-y-4">
            <TabsContent value="redeem" className="m-0 space-y-4">
              <div className="flex items-center justify-between bg-stone-50 border border-stone-200 p-6 rounded-2xl mb-4 shadow-sm">
                <span className="text-xs font-black uppercase tracking-widest text-stone-400">Seu Saldo Atual</span>
                <div className="flex items-center text-charcoal-gray font-black text-2xl tracking-tighter">
                  <Gem className="mr-2 h-6 w-6 text-sky-500" />
                  {userPoints ?? 0} <span className="text-sm text-sky-500 ml-1 italic">PTS</span>
                </div>
              </div>

              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full bg-stone-100 rounded-2xl" />)
              ) : coupons.length > 0 ? (
                coupons.map(coupon => {
                  const canRedeem = userPoints !== null && userPoints >= coupon.points_cost;
                  return (
                    <Card key={coupon.id} className={cn(
                      "bg-white border-stone-200 transition-all duration-300 rounded-2xl overflow-hidden shadow-sm",
                      !canRedeem ? 'opacity-60 grayscale bg-stone-50' : 'hover:border-sky-500/50 hover:shadow-md'
                    )}>
                      <CardContent className="p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-5">
                          <div className="bg-sky-50 p-3 rounded-xl flex-shrink-0">
                            <Ticket className="h-7 w-7 text-sky-600" />
                          </div>
                          <div>
                            <h4 className="font-black text-charcoal-gray uppercase tracking-tight text-base">{coupon.name}</h4>
                            <p className="text-xs text-stone-500 font-medium line-clamp-1">{coupon.description}</p>
                            <div className="flex items-center text-[10px] text-sky-600 font-black uppercase tracking-widest mt-2">
                              <Gem className="mr-1.5 h-3 w-3" />
                              <span>{coupon.points_cost} pontos</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleRedeem(coupon)} 
                          disabled={!canRedeem || redeemingId !== null}
                          className={cn(
                            "font-black uppercase tracking-widest px-6 h-10 rounded-xl transition-all shadow-md",
                            canRedeem ? "bg-sky-500 hover:bg-sky-400 text-white" : "bg-stone-200 text-stone-400 border-stone-200"
                          )}
                        >
                          {redeemingId === coupon.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resgatar'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <Ticket className="mx-auto h-12 w-12 text-stone-300 mb-2" />
                  <p className="text-stone-500 font-medium italic">Nenhum cupom disponível no momento.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="mine" className="m-0 space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full bg-stone-100 rounded-2xl" />)
              ) : myCoupons.length > 0 ? (
                myCoupons.map(userCoupon => (
                  <Card key={userCoupon.id} className="bg-white border-l-4 border-l-sky-500 border-y-stone-200 border-r-stone-200 shadow-md rounded-r-2xl overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <h4 className="font-black text-charcoal-gray uppercase tracking-tight text-lg">{userCoupon.coupons.name}</h4>
                          <div className="flex items-center text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                            <Calendar className="mr-1.5 h-3.5 w-3.5 text-sky-500" />
                            Válido até: {format(new Date(userCoupon.expires_at), "dd 'de' MMMM", { locale: ptBR })}
                          </div>
                          <div className="flex items-center text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                            <ShoppingBag className="mr-1.5 h-3.5 w-3.5 text-sky-500" />
                            Mínimo: R$ {userCoupon.coupons.minimum_order_value.toFixed(2).replace('.', ',')}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-sky-600 tracking-tighter">
                            -R$ {userCoupon.coupons.discount_value.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-16">
                  <Ticket className="mx-auto h-16 w-16 text-stone-200 mb-4" />
                  <p className="text-charcoal-gray font-black italic text-xl tracking-tight uppercase">Sem cupons ativos.</p>
                  <p className="text-stone-500 text-sm font-medium mt-1">Resgate seus pontos para ganhar descontos.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="m-0 space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full bg-stone-100 rounded-2xl" />)
              ) : usedCoupons.length > 0 ? (
                usedCoupons.map(userCoupon => (
                  <Card key={userCoupon.id} className="bg-stone-50 border border-stone-200 opacity-80 rounded-2xl overflow-hidden grayscale hover:grayscale-0 transition-all">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <h4 className="font-black text-stone-400 uppercase tracking-tight text-base line-through">{userCoupon.coupons.name}</h4>
                          <div className="flex items-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                            Usado no Pedido #{userCoupon.order_id || 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-stone-400 tracking-tighter line-through">
                            -R$ {userCoupon.coupons.discount_value.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-16">
                  <History className="mx-auto h-16 w-16 text-stone-200 mb-4" />
                  <p className="text-stone-500 text-sm font-medium">Você ainda não utilizou nenhum cupom.</p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CouponsModal;