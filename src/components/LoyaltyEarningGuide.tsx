import { Link } from 'react-router-dom';
import { ArrowUpRight, Info, ShoppingBag, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LoyaltyEarningGuideProps {
  signedIn: boolean;
  pointsMultiplier: number;
}

const LoyaltyEarningGuide = ({ signedIn, pointsMultiplier }: LoyaltyEarningGuideProps) => {
  const waysToEarn = [
    {
      title: 'Indique um amigo',
      reward: '+200',
      unit: 'pontos na primeira compra do amigo',
      icon: Users,
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
      action: signedIn ? 'Indicar e ganhar pontos' : 'Entrar para indicar',
      href: signedIn ? '/indicacoes' : '/login',
    },
    {
      title: 'Avalie seus produtos',
      reward: '+10',
      unit: 'pontos por avaliação aprovada',
      icon: Star,
      color: 'text-amber-700',
      iconColor: 'bg-amber-100 text-amber-700',
      headerColor: 'from-amber-50 to-white',
      buttonColor: 'bg-amber-700 hover:bg-amber-800',
      steps: [
        'Abra “Minhas avaliações” e escolha um produto de um pedido finalizado.',
        'Dê sua nota de 1 a 5 estrelas e conte sua experiência.',
        'Após a aprovação da avaliação, 10 pontos entram no seu saldo.',
      ],
      note: 'Enviar não credita pontos na hora. Cada avaliação recebe o bônus uma única vez, após aprovação.',
      action: signedIn ? 'Avaliar meus produtos' : 'Entrar para avaliar',
      href: signedIn ? '/perfil?tab=reviews' : '/login',
    },
    {
      title: 'Compre e acumule',
      reward: '1 ponto',
      unit: 'por R$ 1 · pontuação base',
      icon: ShoppingBag,
      color: 'text-sky-700',
      iconColor: 'bg-sky-100 text-sky-700',
      headerColor: 'from-sky-50 to-white',
      buttonColor: 'bg-sky-600 hover:bg-sky-700',
      steps: [
        'Faça suas compras conectado à sua conta DK.',
        'Nas compras elegíveis, os pontos são creditados quando o pedido é marcado como entregue.',
        'Acumule seu saldo e troque por cupons aqui no clube.',
      ],
      note: signedIn
        ? `Seu nível aplica um multiplicador de ${pointsMultiplier.toLocaleString('pt-BR')}× aos pontos de compra. Os bônus de indicação e avaliação são separados.`
        : 'Os pontos de compra seguem o multiplicador do seu nível no clube.',
      action: 'Explorar produtos',
      href: '/produtos',
    },
  ];

  return (
    <section aria-labelledby="earn-points-heading" className="space-y-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Como ganhar pontos</p>
        <h2 id="earn-points-heading" className="mt-1 text-2xl font-black italic uppercase tracking-tight text-slate-900 sm:text-3xl">
          Mais formas de ganhar. Mais vantagens.
        </h2>
        <p className="mt-2 text-sm text-stone-600">Compre, indique e compartilhe sua experiência. Veja como cada recompensa funciona.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {waysToEarn.map((way) => (
          <Card key={way.title} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-sm">
            <CardHeader className={cn('gap-3 bg-gradient-to-br p-5 pb-4', way.headerColor)}>
              <div className="flex items-center gap-3">
                <span className={cn('rounded-xl p-2.5', way.iconColor)}><way.icon className="h-5 w-5" aria-hidden="true" /></span>
                <CardTitle className="text-base font-black text-slate-900">{way.title}</CardTitle>
              </div>
              <div className={way.color}>
                <p className="text-4xl font-black tracking-tight sm:text-5xl">{way.reward}</p>
                <p className="mt-1 text-xs font-bold">{way.unit}</p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-3">
              <ol className="space-y-3">
                {way.steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-2.5 text-sm leading-relaxed text-stone-600">
                    <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black', way.iconColor)} aria-hidden="true">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />
                <p>{way.note}</p>
              </div>
              <Button asChild className={cn('h-11 w-full gap-2 rounded-xl text-xs font-bold text-white', way.buttonColor)}>
                <Link to={way.href}>{way.action}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default LoyaltyEarningGuide;
