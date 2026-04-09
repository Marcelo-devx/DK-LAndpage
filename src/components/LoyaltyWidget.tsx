import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingBag, Cake, User, Gem, Lock, Loader2, ChevronRight, Star, CheckCircle, Clock, Gift, Ticket, ShoppingBag as ShoppingBagIcon } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface LoyaltyWidgetProps {
  onClose?: () => void;
}

const LoyaltyWidget = ({ onClose }: LoyaltyWidgetProps) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [birthDate, setBirthDate] = useState('');
  const [isEditingBirth, setIsEditingBirth] = useState(false);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      // Timeout de segurança para evitar loading infinito ao voltar de outra aba
      const timeoutId = setTimeout(() => {
        if (mounted) setLoading(false);
      }, 4000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        setSession(session);

        if (session) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('points, date_of_birth')
            .eq('id', session.user.id)
            .single();
          
          if (mounted && profileData) {
            setProfile(profileData);
          }
        }

        const { data: couponsData } = await supabase
          .from('coupons')
          .select('*')
          .eq('is_active', true)
          .or('stock_quantity.gt.0,stock_quantity.lt.0')
          .order('points_cost', { ascending: true });
        
        if (mounted) {
          setCoupons(couponsData || []);
        }
      } catch (error) {
        console.error("Error fetching loyalty data:", error);
      } finally {
        clearTimeout(timeoutId);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdateBirthDate = useCallback(async () => {
    if (!birthDate) return;
    const toastId = showLoading("Salvando...");
    try {
      const { error } = await supabase.rpc('update_birth_date', { p_date: birthDate });
      dismissToast(toastId);
      if (error) throw error;
      showSuccess("Data salva!");
      setIsEditingBirth(false);
      if (profile) setProfile({ ...profile, date_of_birth: birthDate });
    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message || "Erro ao salvar.");
    }
  }, [birthDate, profile]);

  const handleRedeem = useCallback(async (coupon: any) => {
    console.log('[LoyaltyWidget] ===========================================');
    console.log('[LoyaltyWidget] Iniciando resgate:', { id: coupon.id, name: coupon.name, cost: coupon.points_cost });
    
    if (!profile) {
      console.error('[LoyaltyWidget] ❌ Profile não está carregado');
      showError('Carregando seus dados...');
      return;
    }
    
    console.log('[LoyaltyWidget] Pontos atuais:', profile.points);
    console.log('[LoyaltyWidget] Custo do cupom:', coupon.points_cost);
    
    if (profile.points < coupon.points_cost) {
      console.error('[LoyaltyWidget] ❌ Saldo insuficiente');
      showError(`Você precisa de ${coupon.points_cost} pontos. Tem ${profile.points}.`);
      return;
    }
    
    console.log('[LoyaltyWidget] ✅ Iniciando resgate...');
    setRedeemingId(coupon.id);
    const toastId = showLoading("Resgatando...");
    
    try {
      const { data, error } = await supabase.rpc('redeem_coupon', { coupon_id_to_redeem: coupon.id });
      
      console.log('[LoyaltyWidget] Resposta da RPC:', { data, error });
      
      dismissToast(toastId);
      
      if (error) {
        console.error('[LoyaltyWidget] ❌ Erro na RPC:', error);
        throw error;
      }
      
      console.log('[LoyaltyWidget] ✅ Resgate bem-sucedido!');
      showSuccess(`🎉 Cupom resgatado! R$ ${coupon.discount_value} OFF adicionado.`);
      
      // Atualizar pontos localmente
      const newPoints = profile.points - coupon.points_cost;
      console.log('[LoyaltyWidget] Novos pontos:', newPoints);
      setProfile((prev: any) => ({ ...prev, points: newPoints }));
      
    } catch (e: any) {
      console.error('[LoyaltyWidget] ❌ Erro ao resgatar:', e);
      dismissToast(toastId);
      
      let errorMessage = 'Erro ao resgatar.';
      if (e.message) {
        if (e.message.includes('esgotado')) {
          errorMessage = 'Cupom esgotado.';
        } else if (e.message.includes('pontos para')) {
          errorMessage = e.message;
        } else {
          errorMessage = e.message;
        }
      }
      showError(errorMessage);
    } finally {
      setRedeemingId(null);
      console.log('[LoyaltyWidget] ===========================================');
    }
  }, [profile]);

  if (loading) return <div className="p-12 flex flex-col items-center justify-center h-full bg-white"><Loader2 className="animate-spin text-sky-500 h-8 w-8" /><p className="text-[10px] font-black uppercase tracking-widest mt-4 text-slate-400">Carregando Clube...</p></div>;

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
      {/* Header Premium */}
      <div className="bg-slate-950 text-white p-4 flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-2.5">
            <div className="bg-sky-500/20 p-1.5 rounded-lg border border-sky-500/30">
                <Gem className="h-4 w-4 text-sky-400" />
            </div>
            <span className="font-black text-xs uppercase tracking-tighter italic">DK Clube Points.</span>
        </div>
        {onClose && <button onClick={onClose} className="text-slate-700 hover:text-slate-900 transition-colors">×</button>}
      </div>

      {!session ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
            <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Membro Exclusivo.</h3>
            <p className="text-[11px] text-slate-700 mt-2 leading-relaxed">Acesse sua conta para visualizar seus pontos e resgatar benefícios exclusivos.</p>
          </div>
          <Button onClick={() => navigate('/login')} className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-12 rounded-xl shadow-lg transition-all active:scale-95">
            Entrar no Clube
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Saldo de Destaque */}
            <div className="bg-slate-50/50 border-b border-slate-100 p-4 flex justify-between items-center shrink-0">
                <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Acumulado</span>
                    <p className="text-[10px] text-slate-700 font-bold">Resgate seus privilégios</p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-black text-sky-600 tracking-tighter tabular-nums">{profile?.points || 0}</span>
                    <span className="text-[10px] font-black text-sky-600 ml-1 italic">PTS</span>
                </div>
            </div>

            <Tabs defaultValue="redeem" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2 bg-white border-b border-slate-100 rounded-none h-12 p-1 shrink-0">
                    <TabsTrigger value="redeem" className="rounded-lg data-[state=active]:bg-sky-500 data-[state=active]:text-white text-slate-400 font-black uppercase text-[9px] tracking-widest h-full transition-all">Resgatar Cupons</TabsTrigger>
                    <TabsTrigger value="earn" className="rounded-lg data-[state=active]:bg-sky-500 data-[state=active]:text-white text-slate-400 font-black uppercase text-[9px] tracking-widest h-full transition-all">Ganhar Pontos</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
                    <TabsContent value="earn" className="m-0 space-y-3">
                        {/* Como Ganhar */}
                        <div className="grid gap-3">
                            <Card className="p-4 border-none shadow-sm bg-white rounded-2xl group hover:shadow-md transition-all">
                                <div className="flex gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                                        <ShoppingBag className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-tight italic">Compras na Loja</h4>
                                        <p className="text-[10px] text-slate-500 mt-1 font-medium leading-snug">Cada <span className="text-sky-600 font-bold">R$ 1,00</span> gasto equivale a <span className="text-sky-600 font-bold">1 ponto</span>.</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-4 border-none shadow-sm bg-white rounded-2xl group hover:shadow-md transition-all">
                                <div className="flex gap-3 items-start">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                        <Cake className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-tight italic">Aniversário</h4>
                                        <p className="text-[10px] text-slate-500 mt-1 font-medium leading-snug">Receba <span className="text-indigo-600 font-bold">100 pontos</span> extras no seu dia.</p>
                                        
                                        {!profile?.date_of_birth ? (
                                            <div className="mt-3">
                                                {isEditingBirth ? (
                                                    <div className="flex gap-2">
                                                        <Input 
                                                            type="date" 
                                                            className="h-8 text-[10px] rounded-lg border-slate-200" 
                                                            value={birthDate} 
                                                            onChange={(e) => setBirthDate(e.target.value)} 
                                                        />
                                                        <Button size="sm" onClick={handleUpdateBirthDate} className="h-8 px-3 bg-slate-900 text-white rounded-lg font-bold text-[9px] uppercase">Salvar</Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="outline" size="sm" onClick={() => setIsEditingBirth(true)} className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-300 text-slate-700 hover:bg-slate-50 w-full rounded-lg">
                                                        Definir Data
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-2 flex items-center text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit border border-emerald-100">
                                                <CheckCircle className="mr-1 h-2.5 w-2.5" /> Registrada
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-4 border-none shadow-sm bg-white rounded-2xl">
                                <div className="flex gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                        <Star className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-tight italic">Boas-vindas</h4>
                                        <p className="text-[10px] text-slate-500 mt-1 font-medium">Bônus de cadastro creditado.</p>
                                        <div className="mt-2 flex items-center text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit border border-emerald-100">
                                            <CheckCircle className="mr-1 h-2.5 w-2.5" /> Concluído
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="redeem" className="m-0 space-y-3">
                        {coupons.length > 0 ? coupons.map((coupon) => {
                            const canAfford = (profile?.points || 0) >= coupon.points_cost;
                            return (
                                <Card key={coupon.id} className={cn(
                                    "p-4 border-none transition-all rounded-2xl relative overflow-hidden group",
                                    canAfford 
                                        ? "bg-gradient-to-br from-sky-50 to-white shadow-sm hover:shadow-lg hover:scale-[1.02] hover:border-sky-300 border border-sky-100" 
                                        : "bg-white/70 opacity-60 grayscale-[0.5]"
                                )}>
                                    {/* Ícone de fundo para cupons resgatáveis */}
                                    {canAfford && (
                                        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Gift className="h-20 w-20 text-sky-500" />
                                        </div>
                                    )}
                                    
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className={cn(
                                                "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1",
                                                canAfford ? "bg-sky-500 text-white" : "bg-slate-300 text-slate-600"
                                            )}>
                                                {canAfford ? <Gift className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                                                {coupon.points_cost} PTS
                                            </div>
                                            {!canAfford && (
                                                <div className="text-[8px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                                    Faltam {coupon.points_cost - (profile?.points || 0)} pts
                                                </div>
                                            )}
                                        </div>
                                        
                                        <h4 className="font-black text-slate-900 text-sm tracking-tighter uppercase italic leading-tight line-clamp-2 mb-2">
                                            {coupon.name}
                                        </h4>
                                        
                                        <div className="flex items-baseline gap-1 mb-3">
                                            <span className="text-2xl font-black text-sky-600 tracking-tighter">
                                                R$ {coupon.discount_value}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500">OFF</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 mb-4">
                                            <ShoppingBagIcon className="h-2.5 w-2.5 text-slate-400" />
                                            <p className="text-[8px] text-slate-500 font-bold uppercase">Mínimo: R$ {coupon.minimum_order_value}</p>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 mb-4">
                                            <Clock className="h-2.5 w-2.5 text-slate-400" />
                                            <p className="text-[8px] text-slate-500 font-medium">Válido por 90 dias após resgate</p>
                                        </div>
                                        
                                        <Button 
                                            className={cn(
                                                "w-full h-10 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-md",
                                                canAfford 
                                                    ? "bg-sky-500 hover:bg-sky-400 text-white hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer" 
                                                    : "bg-slate-300 text-slate-600 cursor-not-allowed"
                                            )}
                                            disabled={!canAfford || redeemingId === coupon.id}
                                            onClick={() => handleRedeem(coupon)}
                                        >
                                            {redeemingId === coupon.id ? (
                                                <>
                                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                                    Resgatando...
                                                </>
                                            ) : canAfford ? (
                                                <>
                                                    <Gift className="mr-1.5 h-3 w-3" />
                                                    Resgatar Agora
                                                </>
                                            ) : (
                                                <>
                                                    <Lock className="mr-1.5 h-3 w-3" />
                                                    Precisa de Pontos
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </Card>
                            )
                        }) : (
                            <div className="py-10 text-center">
                                <Ticket className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase italic">Nenhum cupom disponível.</p>
                            </div>
                        )}
                        
                        <div className="pt-2 pb-2">
                            <Link to="/clube-dk" className="group flex items-center justify-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-sky-500 transition-colors">
                                Ver todos os cupons <ChevronRight className="h-2.5 w-2.5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
      )}
    </div>
  );
};

export default LoyaltyWidget;