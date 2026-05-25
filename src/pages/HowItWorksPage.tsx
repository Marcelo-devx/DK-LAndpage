import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Gem, Gift, Users, Cake, TrendingUp, RefreshCw, Clock, ShoppingBag } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useSEO } from '@/hooks/useSEO';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';

const coupons = [
  { points: 60,   discount: 5,   minOrder: 60 },
  { points: 100,  discount: 10,  minOrder: 100 },
  { points: 250,  discount: 25,  minOrder: 250 },
  { points: 500,  discount: 50,  minOrder: 350 },
  { points: 750,  discount: 75,  minOrder: 500 },
  { points: 1000, discount: 100, minOrder: 675 },
];

const bonuses = [
  {
    icon: Cake,
    title: 'Bônus de Aniversário',
    description: 'No mês do seu aniversário, você ganha pontos extras automaticamente.',
  },
  {
    icon: Users,
    title: 'Bônus de Indicação',
    description: 'Indique um amigo e ganhe pontos quando ele realizar a primeira compra.',
  },
  {
    icon: TrendingUp,
    title: 'Bônus Ticket Alto',
    description: 'Compras acima de determinado valor geram pontos extras automaticamente.',
  },
  {
    icon: RefreshCw,
    title: 'Bônus Recorrência',
    description: 'Clientes que compram todo mês recebem pontos bônus pela fidelidade.',
  },
];

const HowItWorksPage = () => {
  const parallaxRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-15%', '15%']);

  useSEO({
    title: 'Como Funciona | Clube DK | DKCWB',
    description: 'Entenda como funciona o Clube DK da DKCWB. Acumule 1 ponto por R$1 gasto, ganhe bônus e troque por cupons de desconto.',
    url: 'https://dkcwb.com/como-funciona',
  });

  return (
    <div className="bg-white min-h-screen text-charcoal-gray pb-0 font-sans">

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0a0f18] text-white pt-24 pb-32 px-6 flex flex-col justify-center items-center">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534839874837-7729227546c2?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05080f] via-transparent to-[#0a0f18]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/20 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-center max-w-5xl mx-auto space-y-8 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-sky-500/30 bg-sky-900/30 backdrop-blur-md mb-4 shadow-[0_0_20px_rgba(14,165,233,0.3)]">
            <Gem className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">Programa de Pontos</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase leading-none">
              Clube <span className="text-sky-500">DK</span>.
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed pt-4">
              Simples assim: compre, acumule pontos e troque por desconto.
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
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-24 bg-[#05080f]">
        <div className="container mx-auto px-4 md:px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-widest text-white mb-4">
                Como <span className="text-sky-400">Funciona</span>
              </h2>
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-sky-500 to-transparent mx-auto" />
            </div>
          </ScrollAnimationWrapper>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <ScrollAnimationWrapper>
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-sky-400" />
                </div>
                <div className="text-5xl font-black text-sky-400">1</div>
                <h3 className="text-white font-black uppercase tracking-widest text-sm">Compre</h3>
                <p className="text-slate-400 text-sm leading-relaxed">A cada R$ 1,00 gasto nas suas compras, você ganha <span className="text-white font-bold">1 ponto</span> automaticamente.</p>
              </div>
            </ScrollAnimationWrapper>

            <ScrollAnimationWrapper>
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Gem className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="text-5xl font-black text-emerald-400">2</div>
                <h3 className="text-white font-black uppercase tracking-widest text-sm">Acumule</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Seus pontos ficam disponíveis por <span className="text-white font-bold">180 dias</span>. Quanto mais você compra, mais acumula.</p>
              </div>
            </ScrollAnimationWrapper>

            <ScrollAnimationWrapper>
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Gift className="h-8 w-8 text-amber-400" />
                </div>
                <div className="text-5xl font-black text-amber-400">3</div>
                <h3 className="text-white font-black uppercase tracking-widest text-sm">Resgate</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Troque seus pontos por <span className="text-white font-bold">cupons de desconto</span> direto no seu painel.</p>
              </div>
            </ScrollAnimationWrapper>
          </div>

          {/* Aviso de expiração */}
          <ScrollAnimationWrapper>
            <div className="mt-10 max-w-4xl mx-auto flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-6 py-4">
              <Clock className="h-5 w-5 text-amber-400 shrink-0" />
              <p className="text-amber-300 text-sm font-medium">
                <span className="font-black">Atenção:</span> os pontos expiram em 180 dias após serem gerados. Fique de olho no seu saldo.
              </p>
            </div>
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* BÔNUS */}
      <section className="py-24 bg-[#0a0f18]">
        <div className="container mx-auto px-4 md:px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-widest text-white mb-4">
                Ganhe <span className="text-sky-400">Bônus</span>
              </h2>
              <p className="text-slate-400 text-sm uppercase tracking-widest font-medium">Além das compras, você pode acumular pontos extras</p>
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-sky-500 to-transparent mx-auto mt-4" />
            </div>
          </ScrollAnimationWrapper>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {bonuses.map((bonus, i) => (
              <ScrollAnimationWrapper key={i}>
                <div className="bg-white/5 border border-white/10 hover:border-sky-500/30 rounded-3xl p-7 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                    <bonus.icon className="h-6 w-6 text-sky-400" />
                  </div>
                  <h3 className="text-white font-black uppercase tracking-widest text-xs">{bonus.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{bonus.description}</p>
                </div>
              </ScrollAnimationWrapper>
            ))}
          </div>
        </div>
      </section>

      {/* TABELA DE CUPONS */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900 mb-4">
                Troque por <span className="text-sky-500">Desconto</span>
              </h2>
              <p className="text-slate-500 text-sm font-medium max-w-xl mx-auto">Acumulou pontos? Resgate cupons de desconto diretamente no seu painel do clube.</p>
            </div>
          </ScrollAnimationWrapper>

          <div className="max-w-2xl mx-auto">
            <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl">
              <div className="grid grid-cols-3 bg-slate-900 text-white">
                <div className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pontos</div>
                <div className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Desconto</div>
                <div className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Pedido mín.</div>
              </div>
              {coupons.map((c, i) => (
                <ScrollAnimationWrapper key={i}>
                  <div className={`grid grid-cols-3 items-center border-t border-slate-100 transition-colors hover:bg-sky-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <div className="px-6 py-5 flex items-center gap-2">
                      <Gem className="h-4 w-4 text-sky-500 shrink-0" />
                      <span className="font-black text-slate-900">{c.points}</span>
                    </div>
                    <div className="px-6 py-5 text-center">
                      <span className="inline-block bg-sky-500 text-white font-black text-sm px-3 py-1 rounded-lg">
                        R$ {c.discount},00 OFF
                      </span>
                    </div>
                    <div className="px-6 py-5 text-right text-sm font-bold text-slate-500">
                      R$ {c.minOrder},00
                    </div>
                  </div>
                </ScrollAnimationWrapper>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400 mt-4 font-medium">Cupons válidos por 90 dias após o resgate.</p>
          </div>

          <ScrollAnimationWrapper>
            <div className="text-center mt-12">
              <Button asChild size="lg" className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 px-10 rounded-2xl shadow-lg transition-all hover:scale-105 text-sm">
                <Link to="/clube-dk">Ver meu saldo de pontos</Link>
              </Button>
            </div>
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* BANNER FINAL COM PARALLAX */}
      <section
        ref={parallaxRef}
        className="relative w-full h-[400px] md:h-[650px] overflow-hidden bg-black flex items-center justify-center border-t border-white/5"
      >
        <motion.div
          style={{ y }}
          className="absolute inset-0 w-full h-[140%] -top-[20%]"
        >
          <img
            src="https://jrlozhhvwqfmjtkmvukf.supabase.co/storage/v1/object/public/site_assets/clube_dk_cta_banner.jpg"
            alt="Clube DK Banner"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-center grayscale-[0.2] contrast-[1.1]"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 opacity-60" />
        <div className="absolute inset-0 bg-sky-500/5 mix-blend-overlay pointer-events-none" />
      </section>

    </div>
  );
};

export default HowItWorksPage;
