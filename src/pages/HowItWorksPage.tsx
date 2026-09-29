import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gem, Users, Cake, TrendingUp, Clock, ShoppingBag, Star } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import { cn } from '@/lib/utils';

const coupons = [
  { points: 60,   discount: 5,   minOrder: 60 },
  { points: 100,  discount: 10,  minOrder: 100 },
  { points: 250,  discount: 25,  minOrder: 250 },
  { points: 500,  discount: 50,  minOrder: 350 },
  { points: 750,  discount: 75,  minOrder: 500 },
  { points: 1000, discount: 100, minOrder: 675 },
];

const waysToEarn = [
  {
    icon: ShoppingBag,
    title: 'Compre',
    reward: '1 ponto',
    unit: 'por R$ 1 gasto',
    color: 'text-sky-700',
    iconColor: 'bg-sky-100 text-sky-700',
    headerColor: 'from-sky-50 to-white',
    buttonColor: 'bg-sky-600 hover:bg-sky-700',
    steps: [
      'Faça suas compras conectado à sua conta DK.',
      'A cada R$ 1,00 gasto, 1 ponto é somado ao seu saldo.',
      'Os pontos são creditados quando o pedido é entregue.',
    ],
    note: 'Seu nível no clube pode multiplicar os pontos ganhos em cada compra.',
    action: 'Explorar produtos',
    href: '/produtos',
  },
  {
    icon: Users,
    title: 'Indique um amigo',
    reward: '+200',
    unit: 'pontos na primeira compra do amigo',
    color: 'text-emerald-700',
    iconColor: 'bg-emerald-100 text-emerald-700',
    headerColor: 'from-emerald-50 to-white',
    buttonColor: 'bg-emerald-700 hover:bg-emerald-800',
    steps: [
      'Compartilhe seu link de indicação com um amigo.',
      'Ele precisa se cadastrar usando esse link.',
      'Na primeira compra confirmada dele, você recebe 200 pontos.',
    ],
    note: 'Só o cadastro não gera pontos. O bônus é concedido uma vez por amigo indicado.',
    action: 'Entrar para indicar',
    href: '/login',
  },
  {
    icon: Star,
    title: 'Avalie seus produtos',
    reward: '+10',
    unit: 'pontos por avaliação aprovada',
    color: 'text-amber-700',
    iconColor: 'bg-amber-100 text-amber-700',
    headerColor: 'from-amber-50 to-white',
    buttonColor: 'bg-amber-700 hover:bg-amber-800',
    steps: [
      'Abra "Minhas avaliações" e escolha um produto de um pedido finalizado.',
      'Dê sua nota de 1 a 5 estrelas e conte sua experiência.',
      'Após a aprovação da avaliação, 10 pontos entram no seu saldo.',
    ],
    note: 'Enviar não credita pontos na hora. Cada avaliação recebe o bônus uma única vez, após aprovação.',
    action: 'Entrar para avaliar',
    href: '/login',
  },
];

const otherBonuses = [
  {
    icon: Cake,
    title: 'Bônus de Aniversário',
    description: 'No dia do seu aniversário, você ganha 100 pontos extras automaticamente.',
  },
  {
    icon: TrendingUp,
    title: 'Bônus Ticket Alto',
    description: 'Compras a partir de R$ 500 geram +10 pontos extras automaticamente.',
  },
];

const HowItWorksPage = () => {
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

      {/* COMO GANHAR PONTOS */}
      <section className="py-24 bg-stone-50">
        <div className="container mx-auto px-4 md:px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900 mb-4">
                Como <span className="text-sky-500">Ganhar Pontos</span>
              </h2>
              <p className="text-slate-500 text-sm font-medium max-w-xl mx-auto">Compre, indique amigos e avalie seus produtos. Veja como cada recompensa funciona.</p>
            </div>
          </ScrollAnimationWrapper>

          <div className="grid grid-cols-1 gap-6 max-w-6xl mx-auto lg:grid-cols-3">
            {waysToEarn.map((way) => (
              <ScrollAnimationWrapper key={way.title}>
                <Card className="flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border-stone-200 shadow-sm">
                  <CardHeader className={cn('gap-3 bg-gradient-to-br p-6 pb-5', way.headerColor)}>
                    <div className="flex items-center gap-3">
                      <span className={cn('rounded-xl p-2.5', way.iconColor)}><way.icon className="h-5 w-5" aria-hidden="true" /></span>
                      <CardTitle className="text-base font-black uppercase tracking-widest text-slate-900">{way.title}</CardTitle>
                    </div>
                    <div className={way.color}>
                      <p className="text-4xl font-black tracking-tight sm:text-5xl">{way.reward}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-widest">{way.unit}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4 p-6 pt-4">
                    <ol className="space-y-3">
                      {way.steps.map((step, index) => (
                        <li key={step} className="flex items-start gap-2.5 text-sm leading-relaxed text-stone-600">
                          <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black', way.iconColor)} aria-hidden="true">{index + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-auto rounded-xl bg-stone-100 p-3 text-xs leading-relaxed text-stone-600">{way.note}</p>
                    <Button asChild className={cn('h-11 w-full rounded-xl text-xs font-black uppercase tracking-widest text-white', way.buttonColor)}>
                      <Link to={way.href}>{way.action}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </ScrollAnimationWrapper>
            ))}
          </div>

          {/* Aviso de expiração */}
          <ScrollAnimationWrapper>
            <div className="mt-10 max-w-4xl mx-auto flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
              <Clock className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-amber-700 text-sm font-medium">
                <span className="font-black">Atenção:</span> os pontos expiram em 180 dias após serem gerados. Fique de olho no seu saldo.
              </p>
            </div>
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* BÔNUS EXTRAS */}
      <section className="py-24 bg-[#0a0f18]">
        <div className="container mx-auto px-4 md:px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-widest text-white mb-4">
                Bônus <span className="text-sky-400">Extras</span>
              </h2>
              <p className="text-slate-400 text-sm uppercase tracking-widest font-medium">Além de comprar, indicar e avaliar, você ainda pode ganhar mais</p>
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-sky-500 to-transparent mx-auto mt-4" />
            </div>
          </ScrollAnimationWrapper>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {otherBonuses.map((bonus, i) => (
              <ScrollAnimationWrapper key={i}>
                <div className="bg-white/5 border border-white/10 hover:border-sky-500/30 rounded-3xl p-7 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 h-full">
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

    </div>
  );
};

export default HowItWorksPage;
