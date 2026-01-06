import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { User, ShoppingCart, Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import type { Session } from '@supabase/supabase-js';
import { getCartTotalItems } from '@/utils/localCart';

interface HeaderProps {
  onCartClick: () => void;
}

const Header = ({ onCartClick }: HeaderProps) => {
  const isMobile = useIsMobile();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const checkProfileStatus = async (user: any) => {
    if (!user) {
      setIsProfileIncomplete(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, cep, street, number, city, state')
      .eq('id', user.id)
      .single();

    const isIncomplete = !data?.first_name || !data?.last_name || !data?.cep;
    setIsProfileIncomplete(isIncomplete);
  };

  const updateCartCount = () => {
    setCartCount(getCartTotalItems());
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingLogo(true);
      const { data: logoData } = await supabase.from('app_settings').select('value').eq('key', 'logo_url').single();
      if (logoData) setLogoUrl(logoData.value);
      setLoadingLogo(false);

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        await checkProfileStatus(session.user);
      }
      updateCartCount();
    };

    fetchInitialData();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await checkProfileStatus(session.user);
      }
    });

    window.addEventListener('cartUpdated', updateCartCount);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, []);

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => {
    const linkClass = `font-sans font-bold transition-all ${mobile ? 'text-2xl text-white' : 'text-xs text-slate-300 hover:text-sky-400 uppercase tracking-[0.2em]'}`;
    const activeLinkClass = 'text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.5)]';

    return (
      <ul className={`flex ${mobile ? 'flex-col space-y-6 items-start' : 'items-center space-x-8'}`}>
        <li>
          <NavLink to="/produtos" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
            Coleção
          </NavLink>
        </li>
      </ul>
    );
  };

  return (
    <header className="bg-slate-950/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-white/10">
                  <Menu className="h-6 w-6 text-white" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-slate-950 border-white/10 text-white p-8">
                <Link to="/" className="mb-12 inline-block">
                   <h1 className="text-2xl font-black italic tracking-tighter text-sky-400 uppercase">DKCWB.</h1>
                </Link>
                <nav><NavLinks mobile /></nav>
              </SheetContent>
            </Sheet>
          )}
          <Link to="/" className="flex items-center group">
            {loadingLogo ? (
              <Skeleton className="h-8 w-40 bg-white/10" />
            ) : logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="h-9 w-auto brightness-125 transition-all duration-300 group-hover:scale-110 group-hover:brightness-100" 
              />
            ) : (
              <h1 className="text-3xl font-black italic tracking-tighter text-sky-400 group-hover:scale-105 transition-transform uppercase">DKCWB.</h1>
            )}
          </Link>
        </div>

        <div className="flex items-center space-x-8">
          {!isMobile && <nav><NavLinks /></nav>}
          <div className="flex items-center space-x-3">
            <Button asChild variant="ghost" size="icon" className="hover:bg-sky-400/10 hover:text-sky-400 text-slate-300">
              <Link to="/produtos"><Search className="h-5 w-5" /></Link>
            </Button>
            
            <Button asChild variant="ghost" size="icon" className="relative hover:bg-sky-400/10 hover:text-sky-400 text-slate-300">
              <Link to={session ? "/dashboard" : "/login"}>
                <User className="h-5 w-5" />
                {isProfileIncomplete && session && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                )}
              </Link>
            </Button>

            <Button variant="ghost" size="icon" onClick={onCartClick} className="relative hover:bg-sky-400/10 hover:text-sky-400 text-slate-300">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[10px] font-black h-4 w-4 flex items-center justify-center rounded-full shadow-[0_0_10px_rgba(14,165,233,0.6)]">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;