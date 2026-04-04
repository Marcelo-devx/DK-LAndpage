import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Footer = () => {
  const { settings, updateSetting } = useTheme();
  const [session, setSession] = useState<any>(null);

  // Link EXATO fornecido - será salvo automaticamente no banco
  const CORRECT_INSTAGRAM_URL = 'https://www.instagram.com/dondk_cwb?igsh=MW9mOWZxdGdvaGJtZA%3D%3D';

  useEffect(() => {
    // Verifica se o link no banco está incorreto e corrige automaticamente
    const correctAndSaveInstagram = async () => {
      const currentUrl = settings.socialInstagram?.trim();

      // Se estiver vazio, for '#' ou não for o link correto, atualiza
      if (!currentUrl || currentUrl === '#' || currentUrl !== CORRECT_INSTAGRAM_URL) {
        console.log('[Footer] Corrigindo link do Instagram no banco...');
        try {
          await updateSetting('social_instagram', CORRECT_INSTAGRAM_URL);
          console.log('[Footer] Link do Instagram atualizado com sucesso!');
        } catch (error) {
          console.error('[Footer] Erro ao atualizar link do Instagram:', error);
        }
      }
    };

    correctAndSaveInstagram();
  }, [settings.socialInstagram, updateSetting]);

  useEffect(() => {
    let mounted = true;
    const getSession = async () => {
      try {
        const res = await supabase.auth.getSession();
        const s = res?.data?.session ?? null;
        if (!mounted) return;
        setSession(s);
      } catch (e) {
        console.error('[Footer] getSession error', e);
        if (mounted) setSession(null);
      }
    };

    getSession();

    const listener = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession ?? null);
    });

    return () => {
      mounted = false;
      try {
        if (listener && (listener as any).data && (listener as any).data.subscription) {
          (listener as any).data.subscription.unsubscribe();
        } else if (listener && (listener as any).unsubscribe) {
          (listener as any).unsubscribe();
        }
      } catch (e) {
        console.warn('[Footer] failed to unsubscribe auth listener', e);
      }
    };
  }, []);

  // Prefer settings values; fall back to the requested fallback email/phone
  const contactEmail = settings.contactEmail || 'dondkcwb@protonmail.com';
  const contactPhone = settings.contactPhone || '+595 985 981046';
  const contactHours = settings.contactHours || 'Segunda a Sexta: 10h às 18h / Sábado: 10h às 17h.';

  return (
    <footer className="bg-white text-slate-500 border-t border-slate-200">
      <div className="container mx-auto px-4 py-10 md:px-6 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          <div className="md:col-span-1">
            <h3 className="text-xl text-sky-500 mb-6 uppercase font-black italic tracking-tighter" translate="no">DKCWB.</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Curadoria exclusiva e inovação em cada detalhe. A sua fonte definitiva para a melhor experiência premium.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-xs tracking-[0.2em] mb-6">Navegação</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><Link to="/" className="hover:text-sky-500 transition-colors">Início</Link></li>
              <li><Link to="/produtos" className="hover:text-sky-500 transition-colors">Produtos</Link></li>
              <li><Link to="/como-funciona" className="hover:text-sky-500 transition-colors">Como Funciona o Clube</Link></li>
              <li>
                {session ? (
                  <Link to="/dashboard" className="hover:text-sky-500 transition-colors">Minha Conta</Link>
                ) : (
                  <Link to="/login" className="hover:text-sky-500 transition-colors">Entrar / Minha Conta</Link>
                )}
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-xs tracking-[0.2em] mb-6">Atendimento</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Horário</span>
                <p>{contactHours}</p>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">E-mail</span>
                <p>
                  <a href={`mailto:${contactEmail}`} className="hover:text-sky-500 transition-colors">{contactEmail}</a>
                </p>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Telefone</span>
                <p>
                  <a href={`tel:${contactPhone.replace(/\s+/g, '')}`} className="hover:text-sky-500 transition-colors">{contactPhone}</a>
                </p>
              </li>
            </ul>
          </div>
          <div className="flex flex-col">
            <h4 className="font-bold text-slate-900 uppercase text-xs tracking-[0.2em] mb-6">Siga-nos</h4>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center justify-center md:justify-start">
                <a href={CORRECT_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-600 transition-all hover:scale-110">
                  <Instagram size={22} />
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 md:mt-16 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
            &copy; {new Date().getFullYear()} DKCWB. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;