import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Gem, Lock, Unlock, Trophy, History, Gift, TrendingUp, Clock, AlertTriangle, CheckCircle, XCircle, ShoppingBag, User } from 'lucide-react';
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
  const [sessionUser, setSessionUser] = useState<any | null>(null);
  const [totalPointsEarned, setTotalPointsEarned] = useState<number>(0);
  const [totalPointsLast180Days, setTotalPointsLast180Days] = useState<number>(0);

  const fetchData = useCallback(async (isBackground = false) => {
    // Timeout de 3s para evitar loading infinito ao voltar de outra aba
    const timeoutId = setTimeout(() => {
      if (!isBackground) setLoading(false);
    }, 3000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionUser(session?.user ?? null);

      if (!session) {
        // Public view: fetch tiers and coupons but don't require auth
        const [tiersRes, couponsRes] = await Promise.all([
          supabase.from('loyalty_tiers').select('*').order('min_spend', { ascending: true }),
          supabase.from('coupons').select('*').eq('is_active', true).or('stock_quantity.gt.0,stock_quantity.lt.0').order('points_cost')
        ]);

        if (tiersRes.data) setTiers(tiersRes.data);
        if (couponsRes.data) {
          const excludeNames = ['PRIMEIRACOMPRA', 'FRETEGRATIS'];
          const filtered = couponsRes.data.filter((c: any) => !excludeNames.includes(String(c.name).toUpperCase()));
          setCoupons(filtered);
        }
        clearTimeout(timeoutId);
        if (!isBackground) setLoading(false);
        return;
      }

      // Authenticated: fetch full data
      // calcular data de corte para 180 dias
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 180);
      const cutoffISO = cutoffDate.toISOString();

      const [tiersRes, profileRes, historyRes, couponsRes, ordersRes, totalPointsData, last180Data] = await Promise.all([
        supabase.from('loyalty_tiers').select('*').order('min_spend', { ascending: true }),
        supabase.from('profiles').select('points, spend_last_6_months, tier_id, current_tier_name, last_tier_update').eq('id', session.user.id).single(),
        supabase.from('loyalty_history').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('coupons').select('*').eq('is_active', true).or('stock_quantity.gt.0,stock_quantity.lt.0').order('points_cost'),
        supabase.from('orders').select('created_at, benefits_used').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('loyalty_history').select('points').eq('user_id', session.user.id).gt('points', 0),
        // pontos positivos nos últimos 180 dias
        supabase.from('loyalty_history').select('points').eq('user_id', session.user.id).gt('points', 0).gte('created_at', cutoffISO)
      ]);

      if (tiersRes.data) setTiers(tiersRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      if (historyRes.data) setHistory(historyRes.data);
      if (couponsRes.data) {
        const excludeNames = ['PRIMEIRACOMPRA', 'FRETEGRATIS'];
        const filtered = couponsRes.data.filter((c: any) => !excludeNames.includes(String(c.name).toUpperCase()));
        setCoupons(filtered);
      }
      if (ordersRes.data) setRecentOrders(ordersRes.data);
      
      // Calcular total de pontos ganhos (apenas pontos positivos)
      const totalEarned = totalPointsData?.data?.reduce((sum: number, item: any) => sum + (item.points || 0), 0) || 0;
      setTotalPointsEarned(totalEarned);

      // Calcular total de pontos ganhos nos últimos 180 dias
      const total180 = last180Data?.data?.reduce((sum: number, item: any) => sum + (item.points || 0), 0) || 0;
      setTotalPointsLast180Days(total180);
    } catch (e: any) {
      console.error('[LoyaltyClubPage] fetchData error:', e);
    } finally {
      clearTimeout(timeoutId);
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRedeemCoupon = async (coupon: any) => {
    console.log('[LoyaltyClubPage] ===========================================');
    console.log('[LoyaltyClubPage] Iniciando resgate do cupom:', { 
      id: coupon.id, 
      name: coupon.name, 
      cost: coupon.points_cost 
    });
    
    // Verificar autenticação
    if (!sessionUser) { 
      console.error('[LoyaltyClubPage] ❌ Usuário não autenticado');
      showError('Faça login para resgatar cupons.'); 
      return; 
    }
    
    console.log('[LoyaltyClubPage] ✅ Usuário autenticado:', sessionUser.id);
    
    // Verificar se profile está carregado
    if (!profile) {
      console.error('[LoyaltyClubPage] ❌ Profile não está carregado');
      console.log('[LoyaltyClubPage] Buscando profile novamente...');
      
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('points, spend_last_6_months, tier_id, current_tier_name, last_tier_update')
          .eq('id', sessionUser.id)
          .single();
        
        if (profileData) {
          console.log('[LoyaltyClubPage] Profile carregado:', profileData);
          setProfile(profileData);
        } else {
          console.error('[LoyaltyClubPage] ❌ Profile não encontrado');
          showError('Erro ao carregar seus dados. Tente novamente.');
          return;
        }
      } catch (error) {
        console.error('[LoyaltyClubPage] ❌ Erro ao buscar profile:', error);
        showError('Erro ao carregar seus dados. Tente novamente.');
        return;
      }
    }
    
    // Verificar pontos suficientes (usando profile atualizado)
    const currentPoints = profile?.points || 0;
    console.log('[LoyaltyClubPage] Pontos atuais:', currentPoints);
    console.log('[LoyaltyClubPage] Custo do cupom:', coupon.points_cost);
    
    if (currentPoints < coupon.points_cost) {
      console.error('[LoyaltyClubPage] ❌ Saldo insuficiente:', currentPoints, '<', coupon.points_cost);
      showError(`Saldo insuficiente. Você tem ${currentPoints} pontos e precisa de ${coupon.points_cost}.`);
      return;
    }
    
    console.log('[LoyaltyClubPage] ✅ Pontos suficientes, iniciando resgate...');
    
    setRedeemingId(coupon.id);
    const toastId = showLoading("Gerando seu cupom...");
    
    try {
      console.log('[LoyaltyClubPage] Chamando RPC redeem_coupon...');
      const { data, error } = await supabase.rpc('redeem_coupon', { 
        coupon_id_to_redeem: coupon.id 
      });
      
      console.log('[LoyaltyClubPage] Resposta da RPC:', { data, error });
      
      dismissToast(toastId);
      
      if (error) {
        console.error('[LoyaltyClubPage] ❌ Erro na RPC:', error);
        console.error('[LoyaltyClubPage] Erro details:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        });
        throw error;
      }
      
      console.log('[LoyaltyClubPage] ✅ RPC executada com sucesso:', data);
      showSuccess(`🎉 Cupom resgatado com sucesso! R$ ${coupon.discount_value} OFF adicionado aos seus cupons.`);
      
      // Buscar pontos atualizados
      console.log('[LoyaltyClubPage] Buscando pontos atualizados...');
      const { data: userData } = await supabase.auth.getUser();
      
      if (userData.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', userData.user.id)
          .single();
        
        if (profileError) {
          console.error('[LoyaltyClubPage] ❌ Erro ao buscar profile atualizado:', profileError);
        } else {
          console.log('[LoyaltyClubPage] ✅ Pontos atualizados:', profileData);
          if (profileData) {
            setProfile(prev => prev ? { ...prev, points: profileData.points } : null);
          }
        }
      }
      
      // Atualiza a lista de histórico localmente
      setHistory(prev => [{
        id: Date.now(),
        points: -coupon.points_cost,
        description: `Resgate Clube DK: ${coupon.name}`,
        created_at: new Date().toISOString(),
        operation_type: 'redeem'
      }, ...prev]);
      
      console.log('[LoyaltyClubPage] ✅ Resgate completado com sucesso!');

    } catch (e: any) {
      console.error('[LoyaltyClubPage] ❌ Erro ao resgatar cupom:', e);
      dismissToast(toastId);
      
      // Mensagem de erro mais amigável
      let errorMessage = 'Erro ao resgatar cupom. Tente novamente.';
      if (e.message) {
        if (e.message.includes('esgotado')) {
          errorMessage = 'Este cupom está esgotado no momento.';
        } else if (e.message.includes('não encontrado')) {
          errorMessage = 'Cupom não encontrado.';
        } else if (e.message.includes('autenticado')) {
          errorMessage = 'Você precisa estar logado para resgatar cupons.';
        } else if (e.message.includes('pontos para')) {
          errorMessage = e.message;
        } else {
          errorMessage = e.message;
        }
      }
      
      showError(errorMessage);
    } finally {
      setRedeemingId(null);
      console.log('[LoyaltyClubPage] ===========================================');
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

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  // Use an effective profile for calculations so the page shows public info when not logged in
  const effectiveProfile: LoyaltyProfile = profile || {
    points: 0,
    spend_last_6_months: 0,
    tier_id: tiers[0]?.id ?? 0,
    current_tier_name: tiers[0]?.name ?? 'Clube DK',
    last_tier_update: new Date().toISOString(),
  };

  const currentTierIndex = tiers.findIndex(t => t.id === effectiveProfile.tier_id);
  const currentTier = tiers[currentTierIndex] || tiers[0] || { id: 0, name: 'Clube', min_spend: 0, max_spend: null, points_multiplier: 1, benefits: [] };
  const nextTier = tiers[currentTierIndex + 1];
  
  let progress = 100;
  let remaining = 0;
  
  if (nextTier) {
    const range = nextTier.min_spend - currentTier.min_spend || 1;
    const currentInLevel = effectiveProfile.spend_last_6_months - currentTier.min_spend;
    progress = Math.min(100, Math.max(0, (currentInLevel / range) * 100));
    remaining = Math.max(0, nextTier.min_spend - effectiveProfile.spend_last_6_months);
  }

  const expirationDate = addMonths(new Date(effectiveProfile.last_tier_update), 6);
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
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase mb-2">DK Clube.</h1>
          <p className="text-white/90 font-medium text-lg uppercase tracking-widest">{currentTier.name}</p>
          
          <div className="mt-8 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 max-w-lg mx-auto shadow-2xl">
            <div className="flex justify-between items-end mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-white/70">Gasto em 6 meses</span>
                <span className="text-2xl font-black">{effectiveProfile.spend_last_6_months.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            
            {nextTier ? (
                <>
                    <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden mb-4 border border-white/5">
                        <div className="h-full bg-sky-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-sm font-medium text-white/90">
                        {sessionUser ? (
                          <>Faltam <span className="text-white font-black">{remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> para o nível <span className="font-black uppercase text-sky-400">{nextTier.name}</span></>
                        ) : (
                          <>Entre ou crie uma conta para acompanhar seu progresso e subir de nível.</>
                        )}
                    </p>
                </>
            ) : (
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-black text-center py-2 rounded-lg uppercase tracking-widest text-xs">
                    Nível Máximo Alcançado!
                </div>
            )}

            {/* Total acumulado de pontos (destaque) - mostrar Lifetime e últimos 180 dias */}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-6 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-black text-lg shadow-2xl border border-white/10">
                <Gem className="h-8 w-8 text-white" />
                <div className="text-left">
                  <div className="text-xs uppercase tracking-widest opacity-90">Total (lifetime)</div>
                  <div className="text-2xl md:text-3xl font-black">{sessionUser ? totalPointsEarned : 0} PTS</div>
                </div>

                <div className="h-10 w-px bg-white/20 mx-2" />

                <div className="text-left">
                  <div className="text-xs uppercase tracking-widest opacity-80">Últimos 180 dias</div>
                  <div className="text-xl md:text-2xl font-black">{sessionUser ? totalPointsLast180Days : 0} PTS</div>
                </div>
              </div>
            </div>

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
                        <span className="text-4xl font-black tracking-tighter">{effectiveProfile.points}</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-2 font-medium">Cada compra te leva mais longe.</p>
                    
                    {/* Total de pontos acumulados (mostrando lifetime e últimos 180 dias) */}
                    <div className="mt-4 pt-4 border-t border-stone-100">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Total acumulado</span>
                            <div className="flex items-center gap-2">
                                <Gem className="h-5 w-5 text-emerald-500" />
                                <span className="text-2xl font-black text-emerald-600">{sessionUser ? totalPointsEarned : 0}</span>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs text-stone-400">Últimos 180 dias</span>
                            <div className="flex items-center gap-2">
                                <Gem className="h-4 w-4 text-emerald-400" />
                                <span className="text-lg font-black text-emerald-500">{sessionUser ? totalPointsLast180Days : 0}</span>
                            </div>
                        </div>

                        <p className="text-xs text-stone-400 mt-2">Todos os pontos que você já ganhou</p>
                    </div>
                    
                    {!sessionUser && (
                      <div className="mt-4">
                        <Button onClick={() => navigate('/login')} className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-10 rounded-xl">Entrar para ver seu saldo</Button>
                      </div>
                    )}
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
                <TabsTrigger value="redeem" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-500 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest transition-all">Resgatar Cupons</TabsTrigger>
                <TabsTrigger value="tiers" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-500 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest transition-all">Níveis</TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white text-stone-500 rounded-lg px-6 h-10 uppercase text-xs font-black tracking-widest transition-all">Extrato</TabsTrigger>
            </TabsList>

            <TabsContent value="redeem" className="mt-8 space-y-6">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-charcoal-gray">Troque seus pontos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    {coupons.map((coupon) => {
                        const canAfford = effectiveProfile.points >= coupon.points_cost && !!sessionUser;
                        return (
                            <div key={coupon.id} className={cn(
                                "group relative bg-white border-2 p-8 rounded-3xl transition-all overflow-hidden shadow-lg",
                                canAfford 
                                    ? "border-sky-200 hover:border-sky-400 hover:shadow-2xl hover:scale-[1.02] bg-gradient-to-br from-sky-50 to-white" 
                                    : "border-stone-200 opacity-70 grayscale bg-stone-50 cursor-not-allowed"
                            )}>
                                {/* Ícone de fundo para cupons resgatáveis */}
                                {canAfford && (
                                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Gift className="h-40 w-40 text-sky-500" />
                                    </div>
                                )}
                                
                                {/* Badge de pontos */}
                                <div className="relative z-10 flex justify-between items-start mb-6">
                                    <div className={cn(
                                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-md flex items-center gap-2",
                                        canAfford ? "bg-gradient-to-r from-sky-500 to-sky-600 text-white" : "bg-slate-300 text-slate-600"
                                    )}>
                                        {canAfford ? <Gem className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                        {coupon.points_cost} PONTOS
                                    </div>
                                    {!canAfford && sessionUser && (
                                        <div className="text-xs font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                                            Faltam {coupon.points_cost - effectiveProfile.points} pontos
                                        </div>
                                    )}
                                </div>
                                
                                {/* Valor do desconto */}
                                <div className="relative z-10 mb-6">
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className={cn(
                                            "text-5xl font-black tracking-tighter",
                                            canAfford ? "text-sky-600" : "text-slate-500"
                                        )}>
                                            R$ {coupon.discount_value}
                                        </span>
                                        <span className={cn(
                                            "text-lg font-black uppercase",
                                            canAfford ? "text-sky-600" : "text-slate-500"
                                        )}>
                                            OFF
                                        </span>
                                    </div>
                                    {coupon.name && (
                                        <p className={cn(
                                            "text-sm font-bold mb-2",
                                            canAfford ? "text-slate-900" : "text-slate-500"
                                        )}>
                                            {coupon.name}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Informações do cupom */}
                                <div className="relative z-10 space-y-3 mb-6">
                                    <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                                        <ShoppingBag className="h-4 w-4 text-slate-400" />
                                        Pedido mínimo: R$ {coupon.minimum_order_value}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                                        <Clock className="h-4 w-4 text-slate-400" />
                                        Válido por 90 dias após resgate
                                    </div>
                                </div>
                                
                                {/* Botão de resgate */}
                                <Button 
                                    onClick={() => onRedeemCoupon(coupon)}
                                    disabled={!canAfford || redeemingId === coupon.id}
                                    className={cn(
                                        "w-full font-black uppercase tracking-widest h-14 rounded-2xl transition-all shadow-lg relative overflow-hidden",
                                        canAfford 
                                            ? "bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white hover:shadow-2xl hover:scale-[1.02] active:scale-95 cursor-pointer" 
                                            : "bg-slate-300 text-slate-600 cursor-not-allowed"
                                    )}
                                >
                                    {redeemingId === coupon.id ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="animate-spin h-5 w-5" />
                                            Gerando cupom...
                                        </span>
                                    ) : canAfford ? (
                                        <span className="flex items-center gap-2">
                                            <Gift className="h-5 w-5" />
                                            Resgatar Agora
                                        </span>
                                    ) : sessionUser ? (
                                        <span className="flex items-center gap-2">
                                            <Lock className="h-5 w-5" />
                                            Faltam Pontos
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <User className="h-5 w-5" />
                                            Entre para resgatar
                                        </span>
                                    )}
                                </Button>
                            </div>
                        )
                    })}
                </div>
            </TabsContent>

            <TabsContent value="tiers" className="mt-8">
                <div className="space-y-4">
                    {tiers.map((tier) => {
                        const isCurrent = tier.id === effectiveProfile.tier_id;
                        return (
                            <div key={tier.id} className={cn("flex flex-col md:flex-row items-start md:items-center gap-6 p-6 rounded-2xl border transition-all", isCurrent ? "bg-sky-50 border-sky-200 ring-1 ring-sky-100" : "bg-white border-stone-200 opacity-80 hover:opacity-100")}>
                                <div className={cn("w-16 h-16 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br shadow-lg", TierColors[tier.name])}>
                                    {isCurrent ? <Gem className="h-8 w-8 text-white" /> : (effectiveProfile.spend_last_6_months > tier.min_spend ? <Unlock className="h-6 w-6 text-white/80" /> : <Lock className="h-6 w-6 text-white/80" />)}
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
                    {sessionUser ? (
                      history.length > 0 ? (
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
                      )
                    ) : (
                      <div className="p-12 text-center text-stone-500">
                        <p className="font-bold mb-4">Entre para ver seu extrato de pontos</p>
                        <Button onClick={() => navigate('/login')} className="bg-sky-500 text-white font-black uppercase rounded-xl px-6 py-3">Entrar</Button>
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