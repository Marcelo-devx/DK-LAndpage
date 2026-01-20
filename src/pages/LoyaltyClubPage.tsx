import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Gem, Lock, Unlock, Trophy, ArrowRight, History, Gift, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { differenceInDays, addMonths, format } from 'date-fns';
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

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }

      const [tiersRes, profileRes, historyRes, couponsRes] = await Promise.all([
        supabase.from('loyalty_tiers').select('*').order('min_spend', { ascending: true }),
        supabase.from('profiles').select('points, spend_last_6_months, tier_id, current_tier_name, last_tier_update').eq('id', session.user.id).single(),
        supabase.from('loyalty_history').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('coupons').select('*').eq('is_active', true).gt('stock_quantity', 0).order('points_cost')
      ]);

      if (tiersRes.data) setTiers(tiersRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      if (historyRes.data) setHistory(historyRes.data);
      if (couponsRes.data) setCoupons(couponsRes.data);
      
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
        // Refresh profile points
        const { data } = await supabase.from('profiles').select('points').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
        if (data) setProfile(prev => prev ? { ...prev, points: data.points } : null);
        
        // Add to history list locally
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

  if (loading || !profile) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  const currentTierIndex = tiers.findIndex(t => t.id === profile.tier_id);
  const currentTier = tiers[currentTierIndex] || tiers[0];
  const nextTier = tiers[currentTierIndex + 1];
  
  // Cálculo de Progresso
  let progress = 100;
  let remaining = 0;
  
  if (nextTier) {
    const range = nextTier.min_spend - currentTier.min_spend;
    const currentInLevel = profile.spend_last_6_months - currentTier.min_spend;
    progress = Math.min(100, Math.max(0, (currentInLevel / range) * 100));
    remaining = nextTier.min_spend - profile.spend_last_6_months;
  }

  // Cálculo de Expiração do Nível
  const expirationDate = addMonths(new Date(profile.last_tier_update), 6);
  const daysLeft = differenceInDays(expirationDate, new Date());
  const isExpiringSoon = daysLeft <= 30;

  return (
    <div className="bg-slate-950 min-h-screen pb-20 text-white">
      {/* Header com Gradiente Temático */}
      <div className={cn("relative overflow-hidden py-12 px-6 text-center", `bg-gradient-to-b ${TierColors[currentTier.name] || 'from-slate-800 to-slate-900'}`)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-4 border border-white/20 backdrop-blur-md">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase mb-2">DK Clube.</h1>
          <p className="text-white/80 font-medium text-lg uppercase tracking-widest">{currentTier.name}</p>
          
          <div className="mt-8 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 max-w-lg mx-auto shadow-2xl">
            <div className="flex justify-between items-end mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">Gasto em 6 meses</span>
                <span className="text-2xl font-black">{profile.spend_last_6_months.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            
            {nextTier ? (
                <>
                    <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden mb-4 border border-white/5">
                        <div className="h-full bg-sky-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-sm font-medium text-white/80">
                        Faltam <span className="text-white font-black">{remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> para o nível <span className="font-black uppercase text-sky-400">{nextTier.name}</span>
                    </p>
                </>
            ) : (
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-black text-center py-2 rounded-lg uppercase tracking-widest text-xs">
                    Nível Máximo Alcançado!
                </div>
            )}

            {/* Contador de Dias */}
            <div className={cn("mt-6 pt-4 border-t border-white/10 flex items-center justify-between", isExpiringSoon ? "text-orange-300" : "text-slate-300")}>
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
            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Seu Saldo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <Gem className="h-8 w-8 text-sky-500" />
                        <span className="text-4xl font-black tracking-tighter">{profile.points}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Cada compra te leva mais longe.</p>
                </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl md:col-span-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Seus Benefícios Atuais</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentTier.benefits.map((benefit, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                <div className="p-1.5 bg-green-500/20 rounded-lg shrink-0">
                                    <TrendingUp className="h-4 w-4 text-green-400" />
                                </div>
                                <span className="text-sm font-bold text-slate-200">{benefit}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="redeem" className="mt-12">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl h-14 w-full justify-start overflow-x-auto">
                <TabsTrigger value="redeem" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-slate-400 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest">Resgatar Prêmios</TabsTrigger>
                <TabsTrigger value="tiers" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-slate-400 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest">Níveis</TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-slate-400 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest">Extrato</TabsTrigger>
            </TabsList>

            <TabsContent value="redeem" className="mt-8 space-y-6">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Troque seus pontos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {coupons.map((coupon) => {
                        const canAfford = profile.points >= coupon.points_cost;
                        return (
                            <div key={coupon.id} className={cn("group relative bg-slate-900 border border-slate-800 p-6 rounded-2xl transition-all overflow-hidden", canAfford ? "hover:border-sky-500/50 hover:bg-slate-800" : "opacity-50 grayscale")}>
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Gift className="h-24 w-24 text-white" />
                                </div>
                                
                                <div className="relative z-10">
                                    <p className="text-sky-500 font-black text-xs uppercase tracking-widest mb-2">{coupon.points_cost} PONTOS</p>
                                    <h4 className="text-2xl font-black text-white mb-1">R$ {coupon.discount_value} OFF</h4>
                                    <p className="text-slate-400 text-xs mb-6">Mínimo: R$ {coupon.minimum_order_value}</p>
                                    
                                    <Button 
                                        onClick={() => onRedeemCoupon(coupon)}
                                        disabled={!canAfford || redeemingId === coupon.id}
                                        className={cn("w-full font-black uppercase tracking-widest h-12 rounded-xl", canAfford ? "bg-sky-600 hover:bg-sky-500 text-white" : "bg-slate-800 text-slate-500 cursor-not-allowed")}
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
                            <div key={tier.id} className={cn("flex flex-col md:flex-row items-start md:items-center gap-6 p-6 rounded-2xl border transition-all", isCurrent ? "bg-white/5 border-sky-500/50 ring-1 ring-sky-500/20" : "bg-slate-900 border-slate-800 opacity-80 hover:opacity-100")}>
                                <div className={cn("w-16 h-16 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br shadow-lg", TierColors[tier.name])}>
                                    {isCurrent ? <Gem className="h-8 w-8 text-white" /> : (profile.spend_last_6_months > tier.min_spend ? <Unlock className="h-6 w-6 text-white/80" /> : <Lock className="h-6 w-6 text-white/80" />)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="text-xl font-black text-white uppercase tracking-tight">{tier.name}</h4>
                                        {isCurrent && <span className="bg-sky-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Atual</span>}
                                    </div>
                                    <p className="text-sm text-slate-400 font-medium mb-3">
                                        Gasto semestral: <span className="text-white font-bold">R$ {tier.min_spend}</span> {tier.max_spend ? `a R$ ${tier.max_spend}` : '+'}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {tier.benefits.map((b, i) => (
                                            <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 uppercase font-bold tracking-wider">{b}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Multiplicador</p>
                                    <p className="text-2xl font-black text-white">{tier.points_multiplier}x</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </TabsContent>

            <TabsContent value="history" className="mt-8">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    {history.length > 0 ? (
                        <div className="divide-y divide-slate-800">
                            {history.map((item) => (
                                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-2 rounded-lg", item.points > 0 ? "bg-green-500/10" : "bg-red-500/10")}>
                                            {item.points > 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <History className="h-5 w-5 text-red-500" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{item.description}</p>
                                            <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString('pt-BR')} às {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                    <span className={cn("font-black text-sm", item.points > 0 ? "text-green-400" : "text-red-400")}>
                                        {item.points > 0 ? '+' : ''}{item.points} PTS
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-500">
                            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
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