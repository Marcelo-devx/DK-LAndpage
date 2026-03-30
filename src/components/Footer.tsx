import { Link, useNavigate } from 'react-router-dom';
import { Instagram, LogOut } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Footer = () => {
  const { settings } = useTheme();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => {
      mounted = false;
      try { authListener.subscription.unsubscribe(); } catch (e) { /* ignore */ }
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // after sign out, navigate to home so UI updates
    navigate('/');
    // force reload to ensure any cached UI state clears
    window.location.reload();
  };

  return (
    <footer className="bg-white text-slate-500 border-t border-slate-200">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
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
                <p>{settings.contactHours}</p>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">E-mail</span>
                <p>{settings.contactEmail}</p>
              </li>
              <li className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Telefone</span>
                <p>{settings.contactPhone}</p>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-xs tracking-[0.2em] mb-6">Siga-nos</h4>
            <div className="flex items-center justify-between">
              <div className="flex space-x-6">
                {settings.socialInstagram && (
                  <a href={settings.socialInstagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500 transition-all hover:scale-110"><Instagram size={22} /></a>
                )}
              </div>

              {session ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-bold text-slate-700">{session.user?.email}</span>
                  <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-600">
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
            &copy; {new Date().getFullYear()} DKCWB. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;