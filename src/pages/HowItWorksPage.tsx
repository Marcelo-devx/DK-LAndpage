import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Gem, 
  Gift, 
  Truck, 
  Star, 
  Headset, 
  Plus, 
  TrendingUp,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import { cn } from '@/lib/utils';
import { motion, useScroll, useTransform } from 'framer-motion';

interface Tier {
  id: number;
  name: string;
  min_spend: number;
  max_spend: number | null;
  points_multiplier: number;
  benefits: string[];
}

const TierVisuals: Record<string, { bg: string, border: string, text: string, shadow: string, iconColor: string }> = {
  'Bronze': { 
    bg: 'bg-gradient-to-br from-[#3d2516] to-[#1a0f0a]', 
    border: 'border-orange-900/50', 
    text: 'text-[#CD7F32]',
    shadow: 'shadow-orange-900/20',
    iconColor: 'text-orange-500'
  },
  'Prata': { 
    bg: 'bg-gradient-to-br from-[#2c2c2c] to-[#0a0a0a]', 
    border: 'border-slate-700/50', 
    text: 'text-[#C0C0C0]',
    shadow: 'shadow-slate-900/40',
    iconColor: 'text-slate-400'
  },
  'Ouro': { 
    bg: 'bg-gradient-to-br from-[#4a3b0a] to-[#1a1400]', 
    border: 'border-yellow-700/50', 
    text: 'text-[#FFD700]',
    shadow: 'shadow-yellow-900/30',
    iconColor: 'text-yellow-500'
  },
  'Diamante': { 
    bg: 'bg-gradient-to-br from-[#0a2a3d] to-[#050f1a]', 
    border: 'border-sky-700/50', 
    text: 'text-[#00BFFF]',
    shadow: 'shadow-sky-900/40',
    iconColor: 'text-sky-400'
  },
  'Black': { 
    bg: 'bg-gradient-to-br from-[#1a1a1a] to-[#000000]', 
    border: 'border-white/10', 
    text: 'text-white',
    shadow: 'shadow-black',
    iconColor: 'text-slate-200'
  },
};

const HowItWorksPage = () => {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Referência para o efeito Parallax
  const parallaxRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: parallaxRef,
    offset: ["start end", "end start"]
  });

  // Transformação do movimento Y (sobe 15% e desce 15% em relação ao scroll)
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);

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

  const benefitsList = [
    { icon: Plus, title: "Pontos por Indicação" },
    { icon: Gift, title: "Brindes" },
    { icon: Star, title: "Experiências" },
    { icon: TrendingUp, title: "+ Pontos" },
    { icon: Truck, title: "Frete Grátis" },
    { icon: Headset, title: "Pré Venda Privada" }
  ];

  return (
    <div className="bg-white min-h-screen text-charcoal-gray pb-0 font-sans">
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-[#0a0f18] text-white pt-24 pb-32 px-6 flex flex-col justify-center items-center">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534839874837-7729227546c2?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05080f] via-transparent to-[#0a0f18]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/20 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-center max-w-5xl mx-auto space-y-8 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-sky-500/30 bg-sky-900/30 backdrop-blur-md mb-4 shadow-[0_0_20px_rgba(14,165,233,0.3)]">
            <Gem className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">Programa de Fidelidade</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
              Clube <span className="text-sky-500">DK</span>.
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed pt-4">
              Mais do que compras, uma experiência. <br/>
              <span className="text-sky-400 font-bold">Você não ganha desconto. Você sobe de nível.</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
            <Button asChild size="lg" className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-16 px-10 rounded-2xl shadow-[0_0_30px_rgba(14,165,233,0.4)] transition-all hover:scale-105 text-sm">
              <Link to="/login?view=sign_up">Quero Participar</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-[#f4eee3] hover:bg-white text-slate-900 border-none font-black uppercase tracking-widest h-16 px-10 rounded-2xl shadow-lg transition-all hover:scale-105 text-sm">
              <Link to="/login">Já sou membro</Link>
            </Button>
          </div>

          {/* GALERIA DE IMAGENS */}
          <div className="mt-20 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-6xl">
            <ScrollAnimationWrapper className="w-full">
              <div className="relative group rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl aspect-[4/3] rotate-[-2deg] hover:rotate-0 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" alt="Clube DK Lifestyle" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000" />
                <div className="absolute bottom-0 left-0 p-8 z-20 text-left">
                  <div className="bg-sky-500/20 backdrop-blur-md border border-sky-500/30 p-3 rounded-xl inline-block mb-3"><Star className="h-6 w-6 text-sky-400" /></div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1">Exclusividade</h3>
                  <p className="text-sm text-slate-300 font-medium">Produtos que só membros têm acesso.</p>
                </div>
              </div>
            </ScrollAnimationWrapper>
            <ScrollAnimationWrapper className="w-full md:mt-24">
              <div className="relative group rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl aspect-[4/3] rotate-[2deg] hover:rotate-0 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                <img src="https://images.unsplash.com/photo-1520697517384-29928247471f?q=80&w=2670&auto=format&fit=crop" alt="Clube DK Produtos" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000" />
                <div className="absolute bottom-0 left-0 p-8 z-20 text-left">
                  <div className="bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 p-3 rounded-xl inline-block mb-3"><Gift className="h-6 w-6 text-indigo-400" /></div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1">Recompensas</h3>
                  <p className="text-sm text-slate-300 font-medium">Troque seus pontos por itens premium.</p>
                </div>
              </div>
            </ScrollAnimationWrapper>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS SECTION */}
      <section className="py-24 bg-[#05080f] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/20 via-[#05080f] to-[#05080f]" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-widest text-white mb-4">Benefícios <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Exclusivos</span></h2>
            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-red-500 to-transparent mx-auto" />
          </div>
          <ScrollAnimationWrapper>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 md:gap-4 justify-items-center">
              {benefitsList.map((item, index) => (
                <div key={index} className="flex flex-col items-center text-center group">
                  <div className="relative w-24 h-24 mb-6 transition-transform duration-500 group-hover:scale-110">
                    <div className="absolute inset-0 bg-[#0f1522] border-2 border-red-600 rotate-45 shadow-[0_0_15px_rgba(220,38,38,0.4)] group-hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] transition-all" />
                    <div className="absolute inset-0 flex items-center justify-center text-white"><item.icon className="h-10 w-10 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" /></div>
                  </div>
                  <h3 className="text-white font-black uppercase text-[10px] md:text-xs tracking-widest max-w-[120px]">{item.title}</h3>
                </div>
              ))}
            </div>
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* JORNADA DE EXCLUSIVIDADE */}
      <section className="py-24 bg-[#0a0f18] relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white">Jornada do <span className="text-sky-500">Membro.</span></h2>
            <p className="text-slate-400 mt-4 font-medium uppercase tracking-widest text-xs">Quanto mais você explora, mais portas se abrem.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-white/5 rounded-3xl" />) : 
              tiers.map((tier) => {
                const visual = TierVisuals[tier.name] || TierVisuals['Bronze'];
                return (
                  <ScrollAnimationWrapper key={tier.id}>
                    <div className={cn(
                      "group relative h-full flex flex-col md:flex-row overflow-hidden rounded-[2rem] border transition-all duration-500 hover:-translate-y-2",
                      visual.bg, visual.border, visual.shadow, "shadow-2xl"
                    )}>
                      <div className="md:w-20 bg-black/40 flex items-center justify-center py-6 md:py-0 border-b md:border-b-0 md:border-r border-white/5 shrink-0">
                        <h3 className={cn("text-2xl font-black uppercase tracking-[0.3em] md:-rotate-90 whitespace-nowrap", visual.text)}>
                          {tier.name}
                        </h3>
                      </div>

                      <div className="flex-1 p-8 md:p-10 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-6">
                            <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">Investimento Semestral</span>
                            <span className="text-2xl font-black text-white tracking-tighter">
                                R$ {tier.min_spend.toLocaleString('pt-BR')} 
                                {tier.max_spend ? ` a R$ ${tier.max_spend.toLocaleString('pt-BR')}` : '+'}
                            </span>
                          </div>

                          <ul className="space-y-4">
                            <li className="flex items-center gap-3">
                                <div className={cn("h-6 w-6 rounded-full bg-white/5 flex items-center justify-center shrink-0", visual.iconColor)}>
                                    <TrendingUp className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-sm font-bold text-white/90">
                                    {tier.points_multiplier} {tier.points_multiplier === 1 ? 'ponto' : 'pontos'} por R$ 1,00 gasto
                                </span>
                            </li>
                            {tier.benefits.map((benefit, bIdx) => (
                                <li key={bIdx} className="flex items-start gap-3">
                                    <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-white/40">
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-300 leading-tight">{benefit}</span>
                                </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="absolute top-1/2 -right-12 -translate-y-1/2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-700 pointer-events-none">
                         <ShieldCheck className="h-64 w-64 text-white" />
                      </div>
                    </div>
                  </ScrollAnimationWrapper>
                )
              })
            }
          </div>
        </div>
      </section>

      {/* NÍVEIS SECTION VERTICAL */}
      <section className="py-24 bg-white relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900">Níveis de Exclusividade</h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto text-sm md:text-base">Seu status é atualizado automaticamente com base no seu volume de compras dos últimos 6 meses.</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[500px] w-full rounded-none" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-stretch">
              {tiers.map((tier) => (
                <ScrollAnimationWrapper key={tier.id} className="h-full">
                  <div className="h-full flex flex-col bg-white shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-lg overflow-hidden border border-slate-100 group">
                    <div className={cn("h-3 w-full", 
                      tier.name === 'Bronze' ? 'bg-[#CD7F32]' : 
                      tier.name === 'Prata' ? 'bg-[#C0C0C0]' : 
                      tier.name === 'Ouro' ? 'bg-[#FFD700]' : 
                      tier.name === 'Diamante' ? 'bg-[#00BFFF]' : 'bg-[#111111]'
                    )} />
                    <div className="p-8 flex flex-col h-full items-center text-center">
                      <h3 className="text-2xl font-black uppercase tracking-widest text-slate-900 mb-4">{tier.name}</h3>
                      <div className="mb-8">
                        <span className="inline-block px-4 py-1.5 rounded-full border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest">{tier.points_multiplier}x Pontos</span>
                      </div>
                      <div className="w-full border-t border-slate-100 pt-6 mb-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Gasto Semestral</p>
                        <p className="text-lg font-black text-slate-900">{tier.min_spend === 0 ? 'Qualquer valor' : `R$ ${tier.min_spend.toLocaleString('pt-BR')}`}{tier.max_spend ? ` - R$ ${tier.max_spend.toLocaleString('pt-BR')}` : '+'}</p>
                      </div>
                      <div className="w-full border-t border-slate-100 pt-6 flex-1 text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 text-center">Benefícios</p>
                        <ul className="space-y-3">
                          <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
                            <div className="mt-1 h-1.5 w-1.5 rounded-full shrink-0 bg-sky-500" /> {tier.points_multiplier} pts por R$1 gasto
                          </li>
                          {tier.benefits.map((benefit, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-500">
                              <div className="mt-1 h-1.5 w-1.5 rounded-full shrink-0 bg-slate-300" /> {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </ScrollAnimationWrapper>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* BANNER FINAL COM EFEITO PARALLAX */}
      <section 
        ref={parallaxRef}
        className="relative w-full h-[400px] md:h-[650px] overflow-hidden bg-black flex items-center justify-center border-t border-white/5"
      >
        {/* Contêiner da Imagem com Movimento Parallax */}
        <motion.div 
            style={{ y }}
            className="absolute inset-0 w-full h-[140%] -top-[20%]" // A imagem é mais alta que o contêiner para permitir o movimento
        >
            <img 
            src="https://jrlozhhvwqfmjtkmvukf.supabase.co/storage/v1/object/public/site_assets/clube_dk_cta_banner.jpg" 
            alt="Clube DK Banner" 
            className="w-full h-full object-cover object-center grayscale-[0.2] contrast-[1.1]"
            />
        </motion.div>
        
        {/* Overlays para transição e foco */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 opacity-60" />
        <div className="absolute inset-0 bg-sky-500/5 mix-blend-overlay pointer-events-none" />
      </section>

    </div>
  );
};

export default HowItWorksPage;