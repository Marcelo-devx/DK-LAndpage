import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ScrollAnimationWrapper from "./ScrollAnimationWrapper";
import { useTheme } from "@/context/ThemeContext";

const FooterBanner = () => {
  const { settings } = useTheme();

  return (
    <ScrollAnimationWrapper>
      <section className="bg-white py-32 relative overflow-hidden border-t border-stone-200">
        {/* Elementos de Brilho no Fundo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-charcoal-gray mb-8 leading-none" dangerouslySetInnerHTML={{ __html: settings.footerBannerTitle.replace(/\./g, '<span class="text-sky-500">.</span>') }} />
          
          <p className="mt-4 max-w-2xl mx-auto text-xl text-stone-600 font-medium">
            {settings.footerBannerSubtitle}
          </p>
          <div className="mt-12">
            <Button asChild size="lg" className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-[0.2em] h-16 px-12 rounded-2xl transition-all shadow-[0_20px_50px_-15px_rgba(14,165,233,0.3)] hover:scale-105 active:scale-95">
              <Link to="/produtos">{settings.footerBannerButtonText}</Link>
            </Button>
          </div>
        </div>
      </section>
    </ScrollAnimationWrapper>
  );
};

export default FooterBanner;