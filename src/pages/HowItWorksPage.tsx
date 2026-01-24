import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Gem, 
  Gift, 
  UserPlus, 
  Truck, 
  Star, 
  Headset, 
  Plus, 
  TrendingUp,
  Check
} from 'lucide-react';
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

// Cores baseadas nas imagens de referência (Bordas superiores dos cards)
const TierColors: Record<string, string> = {
  'Bronze': 'bg-[#CD7F32]',   // Bronze
  'Prata': 'bg-[#C0C0C0]',    // Prata
  'Ouro': 'bg-[#FFD700]',     // Ouro
  'Diamante': 'bg-[#00BFFF]', // Cyan/Azul Claro
  'Black': 'bg-[#111111]',    // Preto
};

const TierTextColors: Record<string, string> = {
  'Bronze': 'text-[#CD7F32]',
  'Prata': 'text-[#A0A0A0]',
  'Ouro': 'text-[#D4AF37]',
  'Diamante': 'text-[#00BFFF]',
  'Black': 'text-[#111111]',
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

  const benefitsList = [
    {
      icon: Plus,
      title: "Pontos por Indicação",
      description: "Ganhe pontos extras trazendo amigos"
    },
    {
      icon: Gift,
      title: "Brindes",
      description: "Presentes exclusivos em pedidos"
    },
    {
      icon: Star,
      title: "Experiências",
      description: "Acesso a eventos e promoções"
    },
    {
      icon: TrendingUp,
      title: "+ Pontos",
      description: "Multiplicadores de acúmulo"
    },
    {
      icon: Truck,
      title: "Frete Grátis",
      description: "Entrega gratuita selecionada"
    },
    {
      icon: Headset,
      title: "Pré Venda Privada",
      description: "Acesso antecipado a lançamentos"
    }
  ];

  return (
    <div className="bg-white min-h-screen text-charcoal-gray pb-0 font-sans">
      
      {/* HERO SECTION - Estilo "Club Don DK" Dark */}
      <section className="relative overflow-hidden bg-[#0a0f18] text-white py-24 px-6 min-h-[80vh] flex flex-col justify-center items-center">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534839874837-7729227546c2?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05080f] via-transparent to-[#0a0f18]" />
        
        {/* Blue Triangle Glow Effect (Simulando o triângulo neon da imagem) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/20 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-center max-w-5xl mx-auto space-y-8">
          
          {/* Badge Superior */}
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-sky-500/30 bg-sky-900/30 backdrop-blur-md mb-4 shadow-[0_0_20px_rgba(14,165,233,0.3)]">
            <Gem className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">Programa de Fidelidade</span>
          </div>

          {/* Título Principal */}
          <div className="space-y-2">
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
              Clube <span className="text-sky-500">DK</span>.
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed pt-4">
              Mais do que compras, uma experiência. <br/>
              <span className="text-sky-400 font-bold">Você não ganha desconto. Você sobe de nível.</span>
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
            <Button asChild size="lg" className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-16 px-10 rounded-2xl shadow-[0_0_30px_rgba(14,165,233,0.4)] transition-all hover:scale-105 text-sm">
              <Link to="/login?view=sign_up">Quero Participar</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-[#f4eee3] hover:bg-white text-slate-900 border-none font-black uppercase tracking-widest h-16 px-10 rounded-2xl shadow-lg transition-all hover:scale-105 text-sm">
              <Link to="/login">Já sou membro</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS SECTION - Estilo Diamante com Borda Vermelha */}
      <section className="py-24 bg-[#05080f] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/20 via-[#05080f] to-[#05080f]" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-widest text-white mb-4">
              Benefícios <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Exclusivos</span>
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-red-500 to-transparent mx-auto" />
          </div>

          <ScrollAnimationWrapper>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 md:gap-4 justify-items-center">
              {benefitsList.map((item, index) => (
                <div key={index} className="flex flex-col items-center text-center group">
                  {/* Container do Diamante */}
                  <div className="relative w-24 h-24 mb-6 transition-transform duration-500 group-hover:scale-110">
                    <div className="absolute inset-0 bg-[#0f1522] border-2 border-red-600 rotate-45 shadow-[0_0_15px_rgba(220,38,38,0.4)] group-hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] transition-all" />
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      <item.icon className="h-10 w-10 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                    </div>
                  </div>
                  
                  <h3 className="text-white font-black uppercase text-[10px] md:text-xs tracking-widest max-w-[120px]">
                    {item.title}
                  </h3>
                </div>
              ))}
            </div>
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* NÍVEIS SECTION - Cards Verticais com Topo Colorido */}
      <section className="py-24 bg-white relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900">
              Níveis de Exclusividade
            </h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto text-sm md:text-base">
              Seu status é atualizado automaticamente com base no seu volume de compras dos últimos 6 meses.
            </p>
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
                    {/* Borda Superior Colorida */}
                    <div className={cn("h-3 w-full", TierColors[tier.name] || 'bg-slate-900')} />
                    
                    <div className="p-8 flex flex-col h-full items-center text-center">
                      {/* Nome do Nível */}
                      <h3 className="text-2xl font-black uppercase tracking-widest text-slate-900 mb-4">
                        {tier.name}
                      </h3>

                      {/* Badge de Multiplicador */}
                      <div className="mb-8">
                        <span className="inline-block px-4 py-1.5 rounded-full border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest">
                          {tier.points_multiplier}x Pontos
                        </span>
                      </div>

                      {/* Divisor "Requisitos" */}
                      <div className="w-full border-t border-slate-100 pt-6 mb-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                          Gasto Semestral
                        </p>
                        <p className={cn("text-lg font-black", TierTextColors[tier.name] || 'text-slate-900')}>
                          {tier.min_spend === 0 ? 'Qualquer valor' : `R$ ${tier.min_spend.toLocaleString('pt-BR')}`}
                          {tier.max_spend ? ` - R$ ${tier.max_spend.toLocaleString('pt-BR')}` : '+'}
                        </p>
                      </div>

                      {/* Lista de Benefícios */}
                      <div className="w-full border-t border-slate-100 pt-6 flex-1 text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 text-center">
                          Benefícios
                        </p>
                        <ul className="space-y-3">
                          {/* Benefício Base de Pontos */}
                          <li className="flex items-start gap-2 text-xs font-bold text-slate-600">
                            <div className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", TierColors[tier.name] || 'bg-slate-900')} />
                            {tier.points_multiplier} {tier.points_multiplier === 1 ? 'ponto' : 'pontos'} por R$1 gasto
                          </li>
                          
                          {/* Outros Benefícios */}
                          {tier.benefits.map((benefit, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-500">
                              <div className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", TierColors[tier.name] || 'bg-slate-900')} />
                              {benefit}
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

      {/* FOOTER CALL TO ACTION - Texto Manuscrito / Script */}
      <section className="bg-[#05080f] py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1533227297464-675ad4a4dd5d?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        <div className="relative z-10 container mx-auto px-6">
          <p className="font-serif italic text-3xl md:text-5xl text-white font-medium leading-relaxed tracking-wide drop-shadow-lg">
            "Cada compra te leva <br className="md:hidden" />
            para um <span className="text-sky-400">nível mais alto</span>."
          </p>
          <div className="h-1 w-32 bg-sky-500 mx-auto mt-8 rounded-full" />
        </div>
      </section>

    </div>
  );
};

export default HowItWorksPage;