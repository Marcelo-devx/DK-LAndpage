import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gem, Trophy, Gift, UserPlus, ShoppingBag, ArrowRight, Star, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import { cn } from '@/lib/utils';

interface Tier {
  id: number;
  name: string;
  min_spend: number;
  max_spend: number | null;
  points_multiplier: number;
  benefits: string[];
}

const TierColors: Record<string, string> = {
  'Bronze': 'bg-orange-700',
  'Prata': 'bg-slate-400',
  'Ouro': 'bg-yellow-500',
  'Diamante': 'bg-cyan-500',
  'Black': 'bg-slate-900',
};

const HowItWorksPage = () => {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTiers = async () => {
      const { data } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .order('min_spend', { ascending: true });
      
      if (data) setTiers(data);
      setLoading(false);
    };
    fetchTiers();
  }, []);

  const steps = [
    {
      icon: ShoppingBag,
      title: "1. Compre e Ganhe",
      description: "A cada R$ 1,00 em compras, você ganha 1 ponto base. Quanto mais você compra, mais pontos acumula."
    },
    {
      icon: Trophy,
      title: "2. Suba de Nível",
      description: "Seu gasto semestral define seu Nível VIP. Níveis superiores multiplicam seus pontos automaticamente."
    },
    {
      icon: Gift,
      title: "3. Resgate Prêmios",
      description: "Troque seus pontos por cupons de desconto, frete grátis e acesso a produtos exclusivos."
    }
  ];

  const waysToEarn = [
    {
      icon: UserPlus,
      title: "Indique Amigos",
      desc: "Ganhe 200 pontos para cada amigo que fizer a primeira compra através do seu link.",
      color: "text-purple-500 bg-purple-100"
    },
    {
      icon: Star,
      title: "Avalie Produtos",
      desc: "Sua opinião vale ouro. Ganhe pontos ao avaliar os produtos que você comprou.",
      color: "text-yellow-500 bg-yellow-100"
    },
    {
      icon: TrendingUp,
      title: "Bônus de Nível",
      desc: "Clientes VIP ganham multiplicadores de até 2.0x em todas as compras.",
      color: "text-sky-500 bg-sky-100"
    }
  ];

  return (
    <div className="bg-off-white min-h-screen text-charcoal-gray pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 text-white py-20 px-6">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
        
        <div className="container mx-auto relative z-10 text-center max-w-4xl">
          <div className="inline-flex items-center justify-center p-3 bg-sky-500/20 border border-sky-500/30 rounded-full mb-6 backdrop-blur-md">
            <Gem className="h-6 w-6 text-sky-400 mr-2" />
            <span className="text-sky-400 font-black uppercase tracking-widest text-xs">Programa de Fidelidade</span>
          </div>
          <h1 className="text-4xl md:text-7xl font-black italic tracking-tighter uppercase mb-6 leading-none">
            Clube <span className="text-sky-500" translate="no">DK</span>.
          </h1>
          <p className="text-lg md:text-xl text-slate-300 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
            Mais do que compras, uma experiência. Acumule pontos, desbloqueie níveis exclusivos e aproveite benefícios que só a DKCWB oferece.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 px-8 rounded-xl shadow-lg transition-transform hover:scale-105">
              <Link to="/login?view=sign_up">Quero Participar</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 font-black uppercase tracking-widest h-14 px-8 rounded-xl">
              <Link to="/login">Já sou membro</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Como Funciona - Steps */}
      <section className="container mx-auto px-6 py-20">
        <ScrollAnimationWrapper>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-charcoal-gray mb-4">Simples e Recompensador</h2>
            <p className="text-stone-500 font-medium">Veja como é fácil começar a ganhar.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <Card key={index} className="bg-white border border-stone-200 shadow-xl rounded-[2rem] hover:border-sky-500/30 transition-all duration-300 group">
                <CardContent className="p-8 text-center">
                  <div className="w-20 h-20 mx-auto bg-stone-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-sky-50 transition-colors">
                    <step.icon className="h-10 w-10 text-stone-400 group-hover:text-sky-500 transition-colors" />
                  </div>
                  <h3 className="text-xl font-black text-charcoal-gray uppercase tracking-tight mb-3">{step.title}</h3>
                  <p className="text-stone-500 leading-relaxed font-medium text-sm">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollAnimationWrapper>
      </section>

      {/* Tiers Section */}
      <section className="bg-white py-20 border-y border-stone-200">
        <div className="container mx-auto px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-charcoal-gray mb-4">Níveis de Exclusividade</h2>
              <p className="text-stone-500 font-medium max-w-2xl mx-auto">
                Seu status é atualizado automaticamente com base no seu volume de compras dos últimos 6 meses.
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-96 w-full rounded-[2rem]" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {tiers.map((tier) => (
                  <div key={tier.id} className="relative flex flex-col group">
                    <div className={cn("h-2 w-full rounded-t-2xl", TierColors[tier.name] || 'bg-slate-200')} />
                    <Card className="flex-1 bg-stone-50 border border-stone-200 shadow-sm hover:shadow-xl transition-all duration-300 rounded-b-2xl rounded-t-none overflow-hidden hover:-translate-y-2">
                      <CardContent className="p-6 flex flex-col h-full">
                        <div className="mb-6 text-center">
                          <h3 className="text-2xl font-black uppercase tracking-tighter text-charcoal-gray mb-1" translate="no">{tier.name}</h3>
                          <div className="inline-block px-3 py-1 bg-white rounded-lg border border-stone-200 shadow-sm">
                            <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                              {tier.points_multiplier}x Pontos
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4 mb-8 flex-1">
                          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest text-center mb-4">Requisitos</p>
                          <div className="text-center">
                            <p className="text-sm font-medium text-stone-600">Gasto Semestral</p>
                            <p className="text-lg font-black text-charcoal-gray">
                              {tier.min_spend === 0 ? 'Qualquer valor' : `R$ ${tier.min_spend.toLocaleString('pt-BR')}`}
                              {tier.max_spend ? ` - R$ ${tier.max_spend.toLocaleString('pt-BR')}` : '+'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 pt-6 border-t border-stone-200">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2">Benefícios</p>
                          {tier.benefits.map((benefit, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-stone-600 font-medium">
                              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                              <span className="leading-tight">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* Ways to Earn */}
      <section className="container mx-auto px-6 py-20">
        <ScrollAnimationWrapper>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-charcoal-gray mb-6">
                Acelere seus Ganhos
              </h2>
              <p className="text-lg text-stone-600 font-medium mb-8 leading-relaxed">
                Além das suas compras, existem várias outras formas de acumular pontos e subir de nível mais rápido no Clube DK.
              </p>
              
              <div className="space-y-6">
                {waysToEarn.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className={cn("p-3 rounded-xl shrink-0", item.color)}>
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-charcoal-gray uppercase tracking-tight text-lg mb-1">{item.title}</h4>
                      <p className="text-stone-500 text-sm font-medium leading-snug">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/20 to-purple-500/20 rounded-[3rem] blur-3xl" />
              <Card className="relative bg-slate-900 border-white/10 text-white shadow-2xl rounded-[3rem] overflow-hidden">
                <CardContent className="p-10 md:p-14 text-center">
                  <Trophy className="h-20 w-20 text-yellow-400 mx-auto mb-6" />
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-4">Comece agora</h3>
                  <p className="text-slate-300 font-medium mb-8">
                    Crie sua conta hoje e já comece acumulando pontos na sua primeira compra.
                  </p>
                  <Button asChild size="lg" className="w-full bg-white text-slate-900 hover:bg-stone-200 font-black uppercase tracking-widest h-14 rounded-xl">
                    <Link to="/login?view=sign_up">Criar Conta Grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <p className="text-xs text-slate-500 mt-6 font-medium">
                    Já tem conta? <Link to="/login" className="text-sky-400 hover:underline">Faça login</Link> para ver seu saldo.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollAnimationWrapper>
      </section>
    </div>
  );
};

export default HowItWorksPage;