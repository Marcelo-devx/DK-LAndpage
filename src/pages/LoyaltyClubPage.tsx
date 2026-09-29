import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Gem, Lock, Trophy, History, Gift, TrendingUp, Clock, ShoppingBag, User, ArrowRight, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { useSEO } from '@/hooks/useSEO';
import LoyaltyEarningGuide from '@/components/LoyaltyEarningGuide';

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

const LoyaltyClubPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [sessionUser, setSessionUser] = useState<any | null>(null);
  const [totalPointsEarned, setTotalPointsEarned] = useState<number>(0);
  const [totalPointsLast180Days, setTotalPointsLast180Days] = useState<number>(0);

  // SEO - Loyalty Club Page
  useSEO({
    title: 'Clube DK | Programa de Fidelidade | DKCWB',
    description: 'Faça parte do Clube DK da DKCWB. Acumule pontos com suas compras, suba de nível e aproveite benefícios exclusivos como descontos, brindes e experiências.',
    url: 'https://dkcwb.com/clube-dk'
  });

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

      const [tiersRes, profileRes, historyRes, couponsRes, totalPointsData, last180Data] = await Promise.all([
        supabase.from('loyalty_tiers').select('*').order('min_spend', { ascending: true }),
        supabase.from('profiles').select('points, spend_last_6_months, tier_id, current_tier_name, last_tier_update').eq('id', session.user.id).single(),
        supabase.from('loyalty_history').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('coupons').select('*').eq('is_active', true).or('stock_quantity.gt.0,stock_quantity.lt.0').order('points_cost'),
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
    logger.log('[LoyaltyClubPage] ===========================================');
    logger.log('[LoyaltyClubPage] Iniciando resgate do cupom:', {
      id: coupon.id,
      name: coupon.name,
      cost: coupon.points_cost
    });

    // Verificar autenticação
    if (!sessionUser) {
      logger.error('[LoyaltyClubPage] ❌ Usuário não autenticado');
      showError('Faça login para resgatar cupons.');
      return;
    }

    logger.log('[LoyaltyClubPage] ✅ Usuário autenticado:', sessionUser.id);

    // Verificar se profile está carregado
    if (!profile) {
      logger.error('[LoyaltyClubPage] ❌ Profile não está carregado');
      logger.log('[LoyaltyClubPage] Buscando profile novamente...');

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('points, spend_last_6_months, tier_id, current_tier_name, last_tier_update')
          .eq('id', sessionUser.id)
          .single();

        if (profileData) {
          logger.log('[LoyaltyClubPage] Profile carregado:', profileData);
          setProfile(profileData);
        } else {
          logger.error('[LoyaltyClubPage] ❌ Profile não encontrado');
          showError('Erro ao carregar seus dados. Tente novamente.');
          return;
        }
      } catch (error) {
        logger.error('[LoyaltyClubPage] ❌ Erro ao buscar profile:', error);
        showError('Erro ao carregar seus dados. Tente novamente.');
        return;
      }
    }

    // Verificar pontos suficientes (usando profile atualizado)
    const currentPoints = profile?.points || 0;
    logger.log('[LoyaltyClubPage] Pontos atuais:', currentPoints);
    logger.log('[LoyaltyClubPage] Custo do cupom:', coupon.points_cost);

    if (currentPoints < coupon.points_cost) {
      logger.error('[LoyaltyClubPage] ❌ Saldo insuficiente:', currentPoints, '<', coupon.points_cost);
      showError(`Saldo insuficiente. Você tem ${currentPoints} pontos e precisa de ${coupon.points_cost}.`);
      return;
    }

    logger.log('[LoyaltyClubPage] ✅ Pontos suficientes, iniciando resgate...');

    setRedeemingId(coupon.id);
    const toastId = showLoading("Gerando seu cupom...");

    try {
      logger.log('[LoyaltyClubPage] Chamando RPC redeem_coupon...');
      const { data, error } = await supabase.rpc('redeem_coupon', {
        coupon_id_to_redeem: coupon.id
      });

      logger.log('[LoyaltyClubPage] Resposta da RPC:', { data, error });

      dismissToast(toastId);

      if (error) {
        logger.error('[LoyaltyClubPage] ❌ Erro na RPC:', error);
        logger.error('[LoyaltyClubPage] Erro details:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        });
        throw error;
      }

      logger.log('[LoyaltyClubPage] ✅ RPC executada com sucesso:', data);
      showSuccess(`🎉 Cupom resgatado com sucesso! R$ ${coupon.discount_value} OFF adicionado aos seus cupons.`);

      // Buscar pontos atualizados
      logger.log('[LoyaltyClubPage] Buscando pontos atualizados...');
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', userData.user.id)
          .single();

        if (profileError) {
          logger.error('[LoyaltyClubPage] ❌ Erro ao buscar profile atualizado:', profileError);
        } else {
          logger.log('[LoyaltyClubPage] ✅ Pontos atualizados:', profileData);
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

      logger.log('[LoyaltyClubPage] ✅ Resgate completado com sucesso!');

    } catch (e: any) {
      logger.error('[LoyaltyClubPage] ❌ Erro ao resgatar cupom:', e);
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
      logger.log('[LoyaltyClubPage] ===========================================');
    }
  };


  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  // Use an effective profile for calculations so page shows public info when not logged in
  const effectiveProfile: LoyaltyProfile = profile || {
    points: 0,
    spend_last_6_months: 0,
    tier_id: tiers[0]?.id ?? 0,
    current_tier_name: tiers[0]?.name ?? 'Clube DK',
    last_tier_update: new Date().toISOString(),
  };

  const currentTierIndex = tiers.findIndex(t => t.id === effectiveProfile.tier_id);
  const currentTier = tiers[currentTierIndex] || tiers[0] || { id: 0, name: 'Clube', min_spend: 0, max_spend: null, points_multiplier: 1, benefits: [] };

  return (
    <div className="bg-off-white pb-16 text-charcoal-gray">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[1fr_440px] lg:gap-12 lg:py-8">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sky-300">
              <Trophy className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Seu clube de vantagens</span>
            </div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter sm:text-5xl">DK Clube<span className="text-sky-400">.</span></h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
              Suas compras, indicações e avaliações viram pontos para economizar na próxima compra.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200">
              <Gem className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
              {sessionUser ? `Seu nível: ${currentTier.name}` : 'Entre e comece a acumular'}
            </div>
          </div>
          <Card className="min-w-0 rounded-2xl border-0 bg-white text-slate-900 shadow-lg">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-500">Saldo disponível para resgatar</h2>
                  <p className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span className="break-all text-4xl font-black tracking-tight">{effectiveProfile.points.toLocaleString('pt-BR')}</span>
                    <span className="text-sm font-bold text-stone-500">pontos</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-xl bg-sky-50 p-2.5"><Gem className="h-6 w-6 text-sky-600" aria-hidden="true" /></span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-stone-100 pt-3">
                <div>
                  <p className="text-xs text-stone-500">Total já acumulado</p>
                  <p className="mt-1 text-lg font-black text-slate-800">{(sessionUser ? totalPointsEarned : 0).toLocaleString('pt-BR')} <span className="text-[10px] font-bold text-stone-500">pts</span></p>
                </div>
                <div className="border-l border-stone-100 pl-4">
                  <p className="text-xs text-stone-500">Ganhos em 180 dias</p>
                  <p className="mt-1 text-lg font-black text-slate-800">{(sessionUser ? totalPointsLast180Days : 0).toLocaleString('pt-BR')} <span className="text-[10px] font-bold text-stone-500">pts</span></p>
                </div>
              </div>
              {!sessionUser && (
                <Button asChild className="mt-4 h-10 w-full rounded-xl bg-sky-600 text-xs font-bold text-white hover:bg-sky-700">
                  <Link to="/login">Entrar para ver meu saldo<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6">
        <LoyaltyEarningGuide signedIn={!!sessionUser} pointsMultiplier={currentTier.points_multiplier} />

        <section aria-labelledby="redeem-help-heading" className="flex flex-col gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-5 sm:flex-row sm:items-center">
          <span className="hidden shrink-0 rounded-xl bg-white p-3 sm:block"><Ticket className="h-6 w-6 text-sky-600" aria-hidden="true" /></span>
          <div className="flex-1">
            <h2 id="redeem-help-heading" className="text-base font-black text-slate-900">Transforme seus pontos em desconto</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">Escolha um cupom abaixo, resgate com seu saldo e selecione-o no checkout. Confira o pedido mínimo e a validade antes de usar.</p>
          </div>
          <Button asChild variant="outline" className="h-10 shrink-0 rounded-xl border-sky-200 bg-white text-xs font-bold text-sky-700 hover:bg-sky-100">
            <Link to={sessionUser ? '/meus-cupons' : '/login'}>Meus cupons<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
          </Button>
        </section>

        <Tabs defaultValue="redeem">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl border border-stone-200 bg-stone-100 p-1 sm:max-w-sm">
                <TabsTrigger value="redeem" className="h-10 gap-2 rounded-lg text-xs font-bold text-stone-600 data-[state=active]:bg-sky-600 data-[state=active]:text-white"><Gift className="h-4 w-4" aria-hidden="true" />Resgatar cupons</TabsTrigger>
                <TabsTrigger value="history" className="h-10 gap-2 rounded-lg text-xs font-bold text-stone-600 data-[state=active]:bg-sky-600 data-[state=active]:text-white"><History className="h-4 w-4" aria-hidden="true" />Extrato de pontos</TabsTrigger>
            </TabsList>

            <TabsContent value="redeem" className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-black italic uppercase tracking-tight text-slate-900">Escolha sua recompensa</h2>
                  <span className="text-xs font-medium text-stone-500">{coupons.length} {coupons.length === 1 ? 'cupom disponível' : 'cupons disponíveis'}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {coupons.map((coupon) => {
                        const canAfford = effectiveProfile.points >= coupon.points_cost && !!sessionUser;
                        return (
                            <Card key={coupon.id} className={cn(
                                'flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md',
                                canAfford ? 'border-sky-200' : 'border-stone-200'
                            )}>
                              <CardContent className="flex flex-1 flex-col p-5">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                  <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-black', canAfford ? 'bg-sky-100 text-sky-700' : 'bg-stone-100 text-stone-600')}>
                                    <Gem className="h-3.5 w-3.5" aria-hidden="true" />
                                    {Number(coupon.points_cost).toLocaleString('pt-BR')} pontos
                                  </span>
                                  {canAfford && <span className="text-[10px] font-bold text-emerald-700">Você já pode resgatar</span>}
                                </div>
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <p className="text-3xl font-black tracking-tight text-slate-900">{Number(coupon.discount_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                  <span className="text-sm font-black text-sky-700">OFF</span>
                                </div>
                                <h3 className="mt-1 break-words text-sm font-bold text-stone-600">{coupon.name}</h3>
                                <div className="my-4 space-y-2 border-t border-dashed border-stone-200 pt-4 text-xs text-stone-600">
                                  <p className="flex items-center gap-2"><ShoppingBag className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />Pedido mínimo: {Number(coupon.minimum_order_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                  <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />Válido por 180 dias após o resgate</p>
                                </div>
                                <div className="mt-auto">
                                  {!canAfford && sessionUser && (
                                    <p className="mb-3 text-xs font-bold text-amber-700">Faltam {(coupon.points_cost - effectiveProfile.points).toLocaleString('pt-BR')} pontos para este cupom.</p>
                                  )}
                                  <Button
                                    onClick={() => sessionUser ? onRedeemCoupon(coupon) : navigate('/login')}
                                    disabled={(!!sessionUser && !canAfford) || redeemingId === coupon.id}
                                    className="h-11 w-full gap-2 rounded-xl bg-sky-600 text-xs font-bold text-white hover:bg-sky-700 disabled:bg-stone-100 disabled:text-stone-500 disabled:opacity-100"
                                  >
                                    {redeemingId === coupon.id ? (
                                      <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Gerando cupom...</>
                                    ) : canAfford ? (
                                      <><Gift className="h-4 w-4" aria-hidden="true" />Resgatar cupom</>
                                    ) : sessionUser ? (
                                      <><Lock className="h-4 w-4" aria-hidden="true" />Saldo insuficiente</>
                                    ) : (
                                      <><User className="h-4 w-4" aria-hidden="true" />Entrar para resgatar</>
                                    )}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                        );
                    })}
                </div>
                {coupons.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
                    <Gift className="mx-auto mb-3 h-8 w-8 text-sky-600" aria-hidden="true" />
                    <p className="font-bold text-slate-900">Nenhum cupom disponível no momento</p>
                    <p className="mt-1 text-sm text-stone-600">Continue acumulando pontos e confira as próximas recompensas por aqui.</p>
                  </div>
                )}
            </TabsContent>

            <TabsContent value="history" className="mt-5">
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