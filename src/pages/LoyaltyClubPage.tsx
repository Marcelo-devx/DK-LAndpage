import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Gem, Lock, Unlock, Trophy, History, Gift, TrendingUp, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { differenceInDays, addMonths, endOfWeek, isSameWeek, startOfWeek, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Tier {
  id: number;
  name: string;
  min_spend: number;
  max_spend: number | null;
  points_multiplier: number;
  benefits: string[];
}

interface LoyaltyProfile {
  points: number;
  spend_last_6_months: number;
  tier_id: number;
  current_tier_name: string;
  last_tier_update: string;
}

interface HistoryItem {
  id: number;
  points: number;
  description: string;
  created_at: string;
  operation_type: string;
}

const TierColors: Record<string, string> = {
  'Bronze': 'from-orange-700 to-orange-500',
  'Prata': 'from-slate-400 to-slate-200',
  'Ouro': 'from-yellow-500 to-yellow-300',
  'Diamante': 'from-cyan-500 to-blue-500',
  'Black': 'from-slate-900 to-black',
};

const LoyaltyClubPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }

      const [tiersRes, profileRes, historyRes, couponsRes, ordersRes] = await Promise.all([
        supabase.from('loyalty_tiers').select('*').order('min_spend', { ascending: true }),
        supabase.from('profiles').select('points, spend_last_6_months, tier_id, current_tier_name, last_tier_update').eq('id', session.user.id).single(),
        supabase.from('loyalty_history').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('coupons').select('*').eq('is_active', true).gt('stock_quantity', 0).order('points_cost'),
        supabase.from('orders').select('created_at, benefits_used').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10)
      ]);

      if (tiersRes.data) setTiers(tiersRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      if (historyRes.data) setHistory(historyRes.data);
      if (couponsRes.data) setCoupons(couponsRes.data);
      if (ordersRes.data) setRecentOrders(ordersRes.data);
      
      setLoading(false);
    };
    fetchData();
  }, [navigate]);

  const onRedeemCoupon = async (coupon: any) => {
    if (!profile || profile.points < coupon.points_cost) {
        showError("Saldo insuficiente.");
        return;
    }
    setRedeemingId(coupon.id);
    const toastId = showLoading("Gerando seu cupom...");
    
    try {
        const { error } = await supabase.rpc('redeem_coupon', { coupon_id_to_redeem: coupon.id });
        dismissToast(toastId);
        if (error) throw error;
        
        showSuccess("Cupom resgatado com sucesso!");
        const { data } = await supabase.from('profiles').select('points').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
        if (data) setProfile(prev => prev ? { ...prev, points: data.points } : null);
        
        // Atualiza a lista de histórico localmente para feedback instantâneo
        setHistory(prev => [{
            id: Date.now(),
            points: -coupon.points_cost,
            description: `Resgate: ${coupon.name}`,
            created_at: new Date().toISOString(),
            operation_type: 'redeem'
        }, ...prev]);

    } catch (e: any) {
        dismissToast(toastId);
        showError(e.message || "Erro ao resgatar.");
    } finally {
        setRedeemingId(null);
    }
  };

  const getBenefitStatus = (benefit: string) => {
    const lowerBenefit = benefit.toLowerCase();
    const now = new Date();

    if (lowerBenefit.includes('semana')) {
        const usedThisWeek = recentOrders.some(o => 
            o.benefits_used && 
            o.benefits_used.includes(benefit) && 
            isSameWeek(new Date(o.created_at), now, { locale: ptBR })
        );

        if (usedThisWeek) {
            const endOfCurrentWeek = endOfWeek(now, { locale: ptBR });
            const daysToRenew = differenceInDays(endOfCurrentWeek, now) + 1;

            return {
                status: 'used',
                label: `Usado. Renova em ${daysToRenew} dias`,
                color: 'text-stone-500 bg-stone-100 border-stone-200'
            };
        } else {
            const endOfCurrentWeek = endOfWeek(now, { locale: ptBR });
            const daysLeft = differenceInDays(endOfCurrentWeek, now);
            return {
                status: 'available',
                label: daysLeft === 0 ? 'Expira HOJE!' : `Expira em ${daysLeft} dias`,
                color: 'text-green-600 bg-green-100 border-green-200 animate-pulse'
            };
        }
    }

    return {
        status: 'passive',
        label: 'Ativo',
        color: 'text-sky-600 bg-sky-100 border-sky-200'
    };
  };

  if (loading || !profile) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  const currentTierIndex = tiers.findIndex(t => t.id === profile.tier_id);
  const currentTier = tiers[currentTierIndex] || tiers[0];
  const nextTier = tiers[currentTierIndex + 1];
  
  let progress = 100;
  let remaining = 0;
  
  if (nextTier) {
    const range = nextTier.min_spend - currentTier.min_spend;
    const currentInLevel = profile.spend_last_6_months - currentTier.min_spend;
    progress = Math.min(100, Math.max(0, (currentInLevel / range) * 100));
    remaining = nextTier.min_spend - profile.spend_last_6_months;
  }

  const expirationDate = addMonths(new Date(profile.last_tier_update), 6);
  const daysLeft = differenceInDays(expirationDate, new Date());
  const isExpiringSoon = daysLeft <= 30;

  return (
    <div className="bg-off-white min-h-screen pb-20 text-charcoal-gray">
      {/* Header com Gradiente Temático */}
      <div className={cn("relative overflow-hidden py-12 px-6 text-center text-white", `bg-gradient-to-b ${TierColors[currentTier.name] || 'from-slate-800 to-slate-900'}`)}>
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-4 border border-white/20 backdrop-blur-md">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase mb-2">DK Clube.</h1>
          <p className="text-white/90 font-medium text-lg uppercase tracking-widest">{currentTier.name}</p>
          
          <div className="mt-8 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 max-w-lg mx-auto shadow-2xl">
            <div className="flex justify-between items-end mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-white/70">Gasto em 6 meses</span>
                <span className="text-2xl font-black">{profile.spend_last_6_months.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            
            {nextTier ? (
                <>
                    <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden mb-4 border border-white/5">
                        <div className="h-full bg-sky-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-sm font-medium text-white/90">
                        Faltam <span className="text-white font-black">{remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> para o nível <span className="font-black uppercase text-sky-400">{nextTier.name}</span>
                    </p>
                </>
            ) : (
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-black text-center py-2 rounded-lg uppercase tracking-widest text-xs">
                    Nível Máximo Alcançado!
                </div>
            )}

            <div className={cn("mt-6 pt-4 border-t border-white/10 flex items-center justify-between", isExpiringSoon ? "text-orange-300" : "text-white/80")}>
                <div className="flex items-center gap-2">
                    {isExpiringSoon ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    <span className="text-xs font-bold uppercase tracking-widest">Status válido por</span>
                </div>
                <span className="font-mono font-black text-sm">{daysLeft} dias</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border-stone-200 text-charcoal-gray shadow-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Seu Saldo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <Gem className="h-8 w-8 text-sky-500" />
                        <span className="text-4xl font-black tracking-tighter">{profile.points}</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-2 font-medium">Cada compra te leva mais longe.</p>
                </CardContent>
            </Card>

            <Card className="bg-white border-stone-200 text-charcoal-gray shadow-xl md:col-span-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Seus Benefícios Atuais</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-3">
                        {currentTier.benefits.map((benefit, idx) => {
                            const benefitStatus = getBenefitStatus(benefit);
                            return (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-xl border border-stone-100">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-lg shrink-0", benefitStatus.status === 'used' ? "bg-stone-200" : "bg-green-100")}>
                                            {benefitStatus.status === 'used' ? <XCircle className="h-5 w-5 text-stone-400" /> : <TrendingUp className="h-5 w-5 text-green-600" />}
                                        </div>
                                        <span className={cn("text-sm font-bold", benefitStatus.status === 'used' ? "text-stone-400 line-through" : "text-charcoal-gray")}>
                                            {benefit}
                                        </span>
                                    </div>
                                    <div className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border text-center sm:text-right w-full sm:w-auto", benefitStatus.color)}>
                                        {benefitStatus.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="redeem" className="mt-12">
            <TabsList className="bg-stone-100 border border-stone-200 p-1 rounded-xl h-14 w-full justify-start overflow-x-auto">
                <TabsTrigger value="redeem" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-500 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest transition-all">Resgatar Prêmios</TabsTrigger>
                <TabsTrigger value="tiers" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-500 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest transition-all">Níveis</TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-500 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest transition-all">Extrato</TabsTrigger>
            </TabsList>

            <TabsContent value="redeem" className="mt-8 space-y-6">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-charcoal-gray">Troque seus pontos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {coupons.map((coupon) => {
                        const canAfford = profile.points >= coupon.points_cost;
                        return (
                            <div key={coupon.id} className={cn("group relative bg-white border border-stone-200 p-6 rounded-2xl transition-all overflow-hidden shadow-sm hover:shadow-md", canAfford ? "hover:border-sky-500/50" : "opacity-60 grayscale bg-stone-50")}>
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Gift className="h-24 w-24 text-charcoal-gray" />
                                </div>
                                
                                <div className="relative z-10">
                                    <p className="text-sky-600 font-black text-xs uppercase tracking-widest mb-2">{coupon.points_cost} PONTOS</p>
                                    <h4 className="text-2xl font-black text-charcoal-gray mb-1">R$ {coupon.discount_value} OFF</h4>
                                    <p className="text-stone-500 text-xs mb-6">Mínimo: R$ {coupon.minimum_order_value}</p>
                                    
                                    <Button 
                                        onClick={() => onRedeemCoupon(coupon)}
                                        disabled={!canAfford || redeemingId === coupon.id}
                                        className={cn("w-full font-black uppercase tracking-widest h-12 rounded-xl", canAfford ? "bg-sky-500 hover:bg-sky-400 text-white" : "bg-stone-200 text-stone-400 cursor-not-allowed")}
                                    >
                                        {redeemingId === coupon.id ? <Loader2 className="animate-spin h-4 w-4" /> : (canAfford ? 'Resgatar' : 'Faltam Pontos')}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </TabsContent>

            <TabsContent value="tiers" className="mt-8">
                <div className="space-y-4">
                    {tiers.map((tier) => {
                        const isCurrent = tier.id === profile.tier_id;
                        return (
                            <div key={tier.id} className={cn("flex flex-col md:flex-row items-start md:items-center gap-6 p-6 rounded-2xl border transition-all", isCurrent ? "bg-sky-50 border-sky-200 ring-1 ring-sky-100" : "bg-white border-stone-200 opacity-80 hover:opacity-100")}>
                                <div className={cn("w-16 h-16 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br shadow-lg", TierColors[tier.name])}>
                                    {isCurrent ? <Gem className="h-8 w-8 text-white" /> : (profile.spend_last_6_months > tier.min_spend ? <Unlock className="h-6 w-6 text-white/80" /> : <Lock className="h-6 w-6 text-white/80" />)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="text-xl font-black text-charcoal-gray uppercase tracking-tight">{tier.name}</h4>
                                        {isCurrent && <span className="bg-sky-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Atual</span>}
                                    </div>
                                    <p className="text-sm text-stone-500 font-medium mb-3">
                                        Gasto semestral: <span className="text-charcoal-gray font-bold">R$ {tier.min_spend}</span> {tier.max_spend ? `a R$ ${tier.max_spend}` : '+'}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {tier.benefits.map((b, i) => (
                                            <span key={i} className="text-[10px] bg-stone-100 text-stone-600 px-2 py-1 rounded border border-stone-200 uppercase font-bold tracking-wider">{b}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest mb-1">Multiplicador</p>
                                    <p className="text-2xl font-black text-charcoal-gray">{tier.points_multiplier}x</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </TabsContent>

            <TabsContent value="history" className="mt-8">
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                    {history.length > 0 ? (
                        <div className="divide-y divide-stone-100">
                            {history.map((item) => (
                                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-2 rounded-lg", item.points > 0 ? "bg-green-100" : "bg-red-100")}>
                                            {item.points > 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <History className="h-5 w-5 text-red-600" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-charcoal-gray">{item.description}</p>
                                            <p className="text-xs text-stone-500">{new Date(item.created_at).toLocaleDateString('pt-BR')} às {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                    <span className={cn("font-black text-sm", item.points > 0 ? "text-green-600" : "text-red-600")}>
                                        {item.points > 0 ? '+' : ''}{item.points} PTS
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-stone-400">
                            <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="font-medium">Nenhum histórico disponível ainda.</p>
                        </div>
                    )}
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LoyaltyClubPage;