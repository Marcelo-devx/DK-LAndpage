import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { User, ShoppingCart, Menu, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/produtos?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => {
    const linkClass = `font-sans font-bold transition-all ${mobile ? 'text-2xl text-slate-800' : 'text-xs text-slate-300 hover:text-white uppercase tracking-[0.2em]'}`;
    const activeLinkClass = 'text-sky-500 font-black';

    return (
      <ul className={`flex ${mobile ? 'flex-col space-y-6 items-start' : 'items-center space-x-8'}`}>
        <li>
          <NavLink to="/produtos" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
            Produtos
          </NavLink>
        </li>
      </ul>
    );
  };

  return (
    <header className="bg-black border-b border-white/10">
      <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
        
        {/* LOGO AREA */}
        <div className="flex items-center space-x-4 shrink-0">
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-off-white border-slate-200 text-slate-900 p-8">
                <Link to="/" className="mb-12 inline-block">
                   <h1 className="text-2xl font-black italic tracking-tighter text-sky-500 uppercase">DKCWB.</h1>
                </Link>
                <nav><NavLinks mobile /></nav>
              </SheetContent>
            </Sheet>
          )}
          <Link to="/" className="flex items-center group">
            {loadingLogo ? (
              <Skeleton className="h-12 w-32 bg-white/10" />
            ) : logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="h-12 md:h-16 w-auto transition-all duration-300 group-hover:scale-110" 
              />
            ) : (
              <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-sky-500 group-hover:scale-105 transition-transform uppercase">DKCWB.</h1>
            )}
          </Link>
        </div>

        {/* Navigation Links (Desktop) - RESTAURADO */}
        <div className="hidden md:block ml-6">
          <NavLinks />
        </div>

        {/* SEARCH BAR (CENTER) - Visible on Desktop */}
        <div className="hidden md:flex flex-1 max-w-2xl mx-8">
          <form onSubmit={handleSearch} className="w-full relative">
            <Input 
              type="text" 
              placeholder="Digite o que você procura..." 
              className="w-full h-12 pl-5 pr-12 rounded-xl border-transparent bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-sky-500/20 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1 top-1 h-10 w-10 bg-transparent hover:bg-slate-100 text-slate-500 hover:text-sky-500 rounded-lg transition-colors"
            >
              <Search className="h-5 w-5" />
            </Button>
          </form>
        </div>

        {/* ICONS AREA (RIGHT) */}
        <div className="flex items-center space-x-2 md:space-x-6 shrink-0">
          
          {/* Mobile Search Trigger */}
          <div className="md:hidden">
             <Button variant="ghost" size="icon" onClick={() => navigate('/produtos')} className="text-white hover:bg-white/10">
                <Search className="h-6 w-6" />
             </Button>
          </div>

          {/* Meus Pedidos (Desktop) */}
          <Link to="/compras" className="hidden lg:flex items-center gap-2 group">
            <Package className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
            <div className="flex flex-col leading-none">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Meus</span>
                <span className="text-xs text-white font-black uppercase">Pedidos</span>
            </div>
          </Link>

          {/* Login/User (Desktop & Mobile) */}
          <Link to={session ? "/dashboard" : "/login"} className="flex items-center gap-2 group relative">
            <div className="relative">
                <User className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
                {isProfileIncomplete && session && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-black"></span>
                )}
            </div>
            <div className="hidden lg:flex flex-col leading-none">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                    {session ? `Olá, ${session.user.email?.split('@')[0].substring(0, 8)}...` : 'Entre ou'}
                </span>
                <span className="text-xs text-white font-black uppercase">
                    {session ? 'Minha Conta' : 'Cadastre-se'}
                </span>
            </div>
          </Link>

          {/* Carrinho (Desktop & Mobile) */}
          <button onClick={onCartClick} className="flex items-center gap-2 group relative">
            <div className="relative">
                <ShoppingCart className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
                {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-sky-500 text-white text-[9px] font-black h-4 w-4 flex items-center justify-center rounded-full shadow-sm ring-2 ring-black">
                    {cartCount}
                    </span>
                )}
            </div>
            <div className="hidden lg:flex flex-col leading-none text-left">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Meu</span>
                <span className="text-xs text-white font-black uppercase">Carrinho</span>
            </div>
          </button>
        </div>
      </div>
      
      {/* Mobile Search Bar (Only visible on small screens below navigation) */}
      <div className="md:hidden px-4 pb-4">
         <form onSubmit={handleSearch} className="relative">
            <Input 
              type="text" 
              placeholder="O que você procura?" 
              className="w-full h-10 pl-4 pr-10 rounded-lg border-transparent bg-white text-sm text-slate-900 placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-0 top-0 h-10 w-10 bg-transparent text-slate-400 hover:text-sky-500"
            >
              <Search className="h-4 w-4" />
            </Button>
         </form>
      </div>
    </header>
  );
};

export default Header;