import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Tag, Zap } from 'lucide-react';

const MarketingCTA = () => {
  return (
    <section className="container mx-auto px-4 md:px-6 xl:px-8 py-3 md:py-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl">
        {/* Decorative blobs */}
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 px-5 py-6 md:px-10 md:py-8">
          {/* Left: text */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] md:text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
              <Sparkles className="w-3 h-3" />
              Novidades toda semana
            </div>

            <h2 className="text-2xl md:text-4xl xl:text-5xl font-black tracking-tighter italic uppercase leading-tight mb-3">
              Explore nossa{' '}
              <span className="text-sky-400">coleção completa</span>
            </h2>

            <p className="text-slate-300 text-sm md:text-base max-w-md mx-auto md:mx-0 leading-relaxed">
              Descubra produtos exclusivos com os melhores preços. Novos drops chegando toda semana — não perca nenhuma novidade!
            </p>

            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-5">
              <span className="flex items-center gap-1.5 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                <Tag className="w-3.5 h-3.5 text-sky-400" />
                Melhores preços
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                Entrega rápida
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Produtos exclusivos
              </span>
            </div>
          </div>

          {/* Right: CTA buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link
              to="/produtos"
              className="inline-flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 active:scale-95 text-white font-bold text-sm uppercase tracking-wider px-7 py-3.5 rounded-2xl transition-all duration-200 shadow-lg shadow-sky-500/30 group"
            >
              Ver todos os produtos
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/produtos"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-sm uppercase tracking-wider px-7 py-3.5 rounded-2xl border border-white/20 transition-all duration-200"
            >
              Ver promoções
              <Tag className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketingCTA;
