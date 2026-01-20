import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingBag, Cake, User, Gem, Lock, Loader2, ChevronRight, Star, CheckCircle } from 'lucide-react';
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
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('points, date_of_birth')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);
      }

      const { data: couponsData } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .order('points_cost', { ascending: true });
      
      setCoupons(couponsData || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleUpdateBirthDate = async () => {
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
  };

  const handleRedeem = async (coupon: any) => {
    if (!profile || profile.points < coupon.points_cost) return;
    setRedeemingId(coupon.id);
    const toastId = showLoading("Resgatando...");
    try {
        const { error } = await supabase.rpc('redeem_coupon', { coupon_id_to_redeem: coupon.id });
        dismissToast(toastId);
        if (error) throw error;
        showSuccess("Cupom resgatado!");
        setProfile((prev: any) => ({ ...prev, points: prev.points - coupon.points_cost }));
    } catch (e: any) {
        dismissToast(toastId);
        showError(e.message);
    } finally {
        setRedeemingId(null);
    }
  };

  if (loading) return <div className="p-12 flex flex-col items-center justify-center h-full bg-white"><Loader2 className="animate-spin text-sky-500 h-8 w-8" /><p className="text-[10px] font-black uppercase tracking-widest mt-4 text-slate-400">Carregando Clube...</p></div>;

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
      {/* Header Premium */}
      <div className="bg-slate-950 text-white p-5 flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-2.5">
            <div className="bg-sky-500/20 p-1.5 rounded-lg border border-sky-500/30">
                <Gem className="h-5 w-5 text-sky-400" />
            </div>
            <span className="font-black text-sm uppercase tracking-tighter italic">DK Clube Points.</span>
        </div>
        {onClose && <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">×</button>}
      </div>

      {!session ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
          <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
            <User className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Membro Exclusivo.</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Acesse sua conta para visualizar seus pontos e resgatar benefícios exclusivos da curadoria.</p>
          </div>
          <Button onClick={() => navigate('/login')} className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 rounded-xl shadow-lg transition-all active:scale-95">
            Entrar no Clube
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Saldo de Destaque */}
            <div className="bg-slate-50/50 border-b border-slate-100 p-6 flex justify-between items-center shrink-0">
                <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Acumulado</span>
                    <p className="text-xs text-slate-500 font-bold">Resgate seus privilégios</p>
                </div>
                <div className="text-right">
                    <span className="text-3xl font-black text-sky-600 tracking-tighter tabular-nums">{profile?.points || 0}</span>
                    <span className="text-xs font-black text-sky-600 ml-1 italic">PTS</span>
                </div>
            </div>

            <Tabs defaultValue="redeem" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2 bg-white border-b border-slate-100 rounded-none h-14 p-1 shrink-0">
                    <TabsTrigger value="redeem" className="rounded-xl data-[state=active]:bg-sky-500 data-[state=active]:text-white text-slate-400 font-black uppercase text-[10px] tracking-widest h-full transition-all">Recompensas</TabsTrigger>
                    <TabsTrigger value="earn" className="rounded-xl data-[state=active]:bg-sky-500 data-[state=active]:text-white text-slate-400 font-black uppercase text-[10px] tracking-widest h-full transition-all">Ganhar Pontos</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/30">
                    <TabsContent value="earn" className="m-0 space-y-4">
                        {/* Como Ganhar */}
                        <div className="grid gap-3">
                            <Card className="p-5 border-none shadow-sm bg-white rounded-2xl group hover:shadow-md transition-all">
                                <div className="flex gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-sky-50 flex items-center justify-center shrink-0 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                                        <ShoppingBag className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-black text-slate-900 text-xs uppercase tracking-tight italic">Compras na Loja</h4>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-snug">Cada <span className="text-sky-600 font-bold">R$ 1,00</span> gasto equivale a <span className="text-sky-600 font-bold">1 ponto</span> no seu saldo.</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-5 border-none shadow-sm bg-white rounded-2xl group hover:shadow-md transition-all">
                                <div className="flex gap-4 items-start">
                                    <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                        <Cake className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-slate-900 text-xs uppercase tracking-tight italic">Presente de Aniversário</h4>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-snug">Receba <span className="text-indigo-600 font-bold">100 pontos</span> extras no dia do seu aniversário.</p>
                                        
                                        {!profile?.date_of_birth ? (
                                            <div className="mt-4">
                                                {isEditingBirth ? (
                                                    <div className="flex gap-2">
                                                        <Input 
                                                            type="date" 
                                                            className="h-9 text-xs rounded-lg border-slate-200" 
                                                            value={birthDate} 
                                                            onChange={(e) => setBirthDate(e.target.value)} 
                                                        />
                                                        <Button size="sm" onClick={handleUpdateBirthDate} className="h-9 px-4 bg-slate-900 text-white rounded-lg font-bold text-[10px] uppercase">Salvar</Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="outline" size="sm" onClick={() => setIsEditingBirth(true)} className="h-9 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50 w-full rounded-lg">
                                                        Definir Data
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-3 flex items-center text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg w-fit border border-emerald-100">
                                                <CheckCircle className="mr-1.5 h-3 w-3" /> Data Registrada
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-5 border-none shadow-sm bg-white rounded-2xl">
                                <div className="flex gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                        <Star className="h-6 w-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 text-xs uppercase tracking-tight italic">Primeiro Cadastro</h4>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Bônus de boas-vindas já creditado.</p>
                                        <div className="mt-3 flex items-center text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg w-fit border border-emerald-100">
                                            <CheckCircle className="mr-1.5 h-3 w-3" /> Concluído
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="redeem" className="m-0 space-y-4">
                        {coupons.length > 0 ? coupons.map((coupon) => {
                            const canAfford = (profile?.points || 0) >= coupon.points_cost;
                            return (
                                <Card key={coupon.id} className={cn(
                                    "p-5 border-none transition-all rounded-2xl relative overflow-hidden",
                                    canAfford ? "bg-white shadow-sm hover:shadow-md hover:translate-y-[-2px]" : "bg-white/50 opacity-60 grayscale-[0.5]"
                                )}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-sky-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                                            {coupon.points_cost} PTS
                                        </div>
                                        {!canAfford && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                                    </div>
                                    
                                    <h4 className="font-black text-slate-900 text-lg tracking-tighter uppercase italic leading-none">{coupon.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">Gasto mínimo: R$ {coupon.minimum_order_value}</p>
                                    
                                    <Button 
                                        className={cn(
                                            "w-full h-11 text-[11px] font-black uppercase tracking-[0.2em] mt-5 rounded-xl transition-all shadow-md",
                                            canAfford 
                                                ? "bg-sky-500 hover:bg-sky-400 text-white active:scale-95" 
                                                : "bg-slate-200 text-slate-500 cursor-not-allowed"
                                        )}
                                        disabled={!canAfford || redeemingId === coupon.id}
                                        onClick={() => handleRedeem(coupon)}
                                    >
                                        {redeemingId === coupon.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resgatar Agora'}
                                    </Button>
                                </Card>
                            )
                        }) : (
                            <div className="py-12 text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase italic">Nenhum cupom disponível.</p>
                            </div>
                        )}
                        
                        <div className="pt-4 pb-2">
                            <Link to="/clube-dk" className="group flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-sky-500 transition-colors">
                                Explorar Clube Completo <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
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