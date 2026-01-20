import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingBag, Cake, User, Gem, Lock, Loader2, ChevronRight } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { format } from 'date-fns';
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
    const toastId = showLoading("Salvando data...");
    
    try {
      // Formata para YYYY-MM-DD
      const dateObj = new Date(birthDate); // O input date retorna YYYY-MM-DD direto, mas garantindo
      const formatted = birthDate; // Input type='date' já é ISO

      // A função update_birth_date no banco deve lidar com a lógica de bônus e travamento
      const { error } = await supabase.rpc('update_birth_date', { p_date: formatted });

      dismissToast(toastId);
      if (error) throw error;

      showSuccess("Data salva! Se for seu aniversário, você ganhou pontos.");
      setIsEditingBirth(false);
      
      // Atualiza perfil localmente
      if (profile) setProfile({ ...profile, date_of_birth: formatted });

    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message || "Erro ao salvar data.");
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
        // Atualiza pontos
        setProfile((prev: any) => ({ ...prev, points: prev.points - coupon.points_cost }));
    } catch (e: any) {
        dismissToast(toastId);
        showError(e.message);
    } finally {
        setRedeemingId(null);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-sky-500" /></div>;

  return (
    <div className="w-full h-full flex flex-col bg-stone-50">
      {/* Header Estilo App */}
      <div className="bg-black text-white p-4 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2">
            <Gem className="h-5 w-5 text-sky-500" />
            <span className="font-bold text-sm uppercase tracking-wider">DK Clube Points</span>
        </div>
      </div>

      {!session ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div>
            <h3 className="text-lg font-black text-charcoal-gray uppercase tracking-tight">Acessar Programa</h3>
            <p className="text-xs text-stone-500 mt-1">Faça login para ganhar pontos e resgatar prêmios exclusivos.</p>
          </div>
          <Button onClick={() => navigate('/login')} className="bg-black text-white font-black uppercase tracking-widest px-8 rounded-lg">
            Login
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Saldo Rápido */}
            <div className="bg-white border-b border-stone-200 p-4 flex justify-between items-center shrink-0">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Seu Saldo</span>
                <span className="text-xl font-black text-sky-600 tracking-tighter">{profile?.points || 0} PTS</span>
            </div>

            <Tabs defaultValue="earn" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2 bg-white border-b border-stone-200 rounded-none h-12 p-0 shrink-0">
                    <TabsTrigger value="redeem" className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:text-black text-stone-400 font-bold uppercase text-[10px] tracking-widest h-full transition-all">Recompensas</TabsTrigger>
                    <TabsTrigger value="earn" className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:text-black text-stone-400 font-bold uppercase text-[10px] tracking-widest h-full transition-all">Ganhe Pontos</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    <TabsContent value="earn" className="m-0 space-y-3">
                        {/* Card: Compras */}
                        <Card className="p-4 border border-stone-200 shadow-sm bg-white">
                            <div className="flex gap-4">
                                <div className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                                    <ShoppingBag className="h-5 w-5 text-charcoal-gray" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-charcoal-gray text-sm leading-tight">Ganhe 1 ponto por cada R$ 1,00 gasto.</h4>
                                    <p className="text-[10px] text-stone-500 mt-1">Valor mínimo de compra de R$ 1,00</p>
                                </div>
                            </div>
                        </Card>

                        {/* Card: Aniversário */}
                        <Card className="p-4 border border-stone-200 shadow-sm bg-white">
                            <div className="flex gap-4 items-start">
                                <div className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                                    <Cake className="h-5 w-5 text-charcoal-gray" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-charcoal-gray text-sm leading-tight">Ganhe 100 pontos no seu aniversário</h4>
                                    <p className="text-[10px] text-stone-500 mt-1 leading-snug">A recompensa será liberada no dia do seu aniversário.</p>
                                    
                                    {!profile?.date_of_birth ? (
                                        <div className="mt-3">
                                            {isEditingBirth ? (
                                                <div className="flex gap-2">
                                                    <Input 
                                                        type="date" 
                                                        className="h-8 text-xs" 
                                                        value={birthDate} 
                                                        onChange={(e) => setBirthDate(e.target.value)} 
                                                    />
                                                    <Button size="sm" onClick={handleUpdateBirthDate} className="h-8 text-xs bg-black text-white">Salvar</Button>
                                                </div>
                                            ) : (
                                                <Button variant="outline" size="sm" onClick={() => setIsEditingBirth(true)} className="h-8 text-[10px] font-bold uppercase tracking-widest border-stone-300 text-stone-600 hover:bg-stone-100 w-full">
                                                    Preencher Data
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-2 flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded w-fit">
                                            <span className="mr-1">✓</span> Data salva
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Card: Cadastro */}
                        <Card className="p-4 border border-stone-200 shadow-sm bg-white">
                            <div className="flex gap-4">
                                <div className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                                    <User className="h-5 w-5 text-charcoal-gray" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-charcoal-gray text-sm leading-tight">Ganhe 50 pontos ao fazer seu cadastro</h4>
                                    <div className="mt-2 flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded w-fit">
                                        <span className="mr-1">✓</span> Completo
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="redeem" className="m-0 space-y-3">
                        {coupons.map((coupon) => {
                            const canAfford = profile.points >= coupon.points_cost;
                            return (
                                <Card key={coupon.id} className={cn("p-4 border transition-all", canAfford ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-70")}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="bg-sky-50 text-sky-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                                            {coupon.points_cost} PTS
                                        </div>
                                        {!canAfford && <Lock className="h-3 w-3 text-stone-400" />}
                                    </div>
                                    <h4 className="font-black text-charcoal-gray text-lg">{coupon.name}</h4>
                                    <p className="text-[10px] text-stone-500 font-medium mb-3">Mínimo: R$ {coupon.minimum_order_value}</p>
                                    
                                    <Button 
                                        className={cn("w-full h-8 text-[10px] font-black uppercase tracking-widest", canAfford ? "bg-sky-500 hover:bg-sky-400 text-white" : "bg-stone-200 text-stone-400 cursor-not-allowed")}
                                        disabled={!canAfford || redeemingId === coupon.id}
                                        onClick={() => handleRedeem(coupon)}
                                    >
                                        {redeemingId === coupon.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Resgatar'}
                                    </Button>
                                </Card>
                            )
                        })}
                        
                        <div className="text-center pt-4">
                            <Link to="/clube-dk" className="text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-sky-500 flex items-center justify-center gap-1">
                                Ver Clube Completo <ChevronRight className="h-3 w-3" />
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