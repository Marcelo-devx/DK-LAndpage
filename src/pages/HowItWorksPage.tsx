import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Gem } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useSEO } from '@/hooks/useSEO';


const HowItWorksPage = () => {
  // Referência para o efeito Parallax
  const parallaxRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: parallaxRef,
    offset: ["start end", "end start"]
  });

  // Transformação do movimento Y (sobe 15% e desce 15% em relação ao scroll)
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);

  // SEO - How It Works Page
  useSEO({
    title: 'Como Funciona | Clube DK | DKCWB',
    description: 'Descubra como funciona o Clube DK da DKCWB. Acumule pontos, suba de nível e aproveite benefícios exclusivos com cada compra.',
    url: 'https://dkcwb.com/como-funciona'
  });


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
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase leading-none">
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
            loading="lazy"
            decoding="async"
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