import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, ShoppingCart, Menu, Search, Package, ChevronDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import type { Session } from '@supabase/supabase-js';
import { getCartTotalItems } from '@/utils/localCart';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
}

interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}

interface HeaderProps {
  onCartClick: () => void;
}

const Header = ({ onCartClick }: HeaderProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  const fetchNavData = async () => {
    const { data: cats } = await supabase.from('categories').select('id, name').eq('is_visible', true).order('name');
    const { data: subs } = await supabase.from('sub_categories').select('id, name, category_id').eq('is_visible', true).order('name');
    if (cats) setCategories(cats);
    if (subs) setSubCategories(subs);
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

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      updateCartCount();
      fetchNavData();
    };

    fetchInitialData();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
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

  const DesktopNav = () => (
    <NavigationMenu className="max-w-full justify-start">
      <NavigationMenuList className="gap-1">
        {categories.map((category) => {
          const categorySubs = subCategories.filter(s => s.category_id === category.id);
          
          return (
            <NavigationMenuItem key={category.id}>
              <NavigationMenuTrigger 
                className="bg-transparent text-slate-300 hover:text-sky-400 data-[state=open]:text-sky-400 font-black uppercase text-[10px] tracking-widest h-12 px-4 transition-colors" 
                translate="no"
              >
                {category.name}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="w-[500px] p-6 bg-slate-950 border border-white/10 shadow-2xl rounded-2xl grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Sub-Categorias</h4>
                    <ul className="space-y-1">
                      {categorySubs.length > 0 ? (
                        categorySubs.map((sub) => (
                          <li key={sub.id}>
                            <NavigationMenuLink asChild>
                              <Link
                                to={`/produtos?category=${category.name}&sub_category=${sub.name}`}
                                className="flex items-center justify-between group p-2 rounded-lg hover:bg-white/5 transition-all"
                              >
                                <span className="text-xs font-bold text-slate-300 group-hover:text-white uppercase tracking-tight" translate="no">{sub.name}</span>
                                <ArrowRight className="h-3 w-3 text-sky-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        ))
                      ) : (
                        <li className="text-[10px] text-slate-500 italic font-medium p-2">Nenhuma sub-categoria encontrada.</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-white/5 rounded-xl p-5 flex flex-col justify-between border border-white/5">
                    <div>
                        <h5 className="text-white font-black text-sm uppercase tracking-tighter italic mb-1">{category.name}.</h5>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            Confira nossa seleção exclusiva e premium para esta categoria.
                        </p>
                    </div>
                    <Button asChild size="sm" className="mt-4 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase text-[9px] tracking-widest h-9 rounded-lg">
                        <Link to={`/produtos?category=${category.name}`}>Ver Tudo</Link>
                    </Button>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );

  return (
    <header className="bg-black border-b border-white/10 w-full">
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
              <SheetContent side="left" className="bg-slate-950 border-white/10 text-white p-8">
                <Link to="/" className="mb-12 inline-block">
                   <h1 className="text-2xl font-black italic tracking-tighter text-sky-500 uppercase">DKCWB.</h1>
                </Link>
                <nav className="flex flex-col gap-6">
                  <Link to="/produtos" className="text-lg font-black uppercase tracking-widest">Todos Produtos</Link>
                  {categories.map(cat => (
                    <div key={cat.id} className="space-y-4">
                      <Link to={`/produtos?category=${cat.name}`} className="text-lg font-black uppercase tracking-widest text-sky-500" translate="no">{cat.name}</Link>
                      <div className="pl-4 flex flex-col gap-3">
                        {subCategories.filter(s => s.category_id === cat.id).map(sub => (
                          <Link key={sub.id} to={`/produtos?category=${cat.name}&sub_category=${sub.name}`} className="text-sm font-bold text-slate-400 uppercase tracking-wider" translate="no">{sub.name}</Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          )}
          <Link to="/" className="flex items-center group">
            {loadingLogo ? (
              <Skeleton className="h-12 w-32 bg-white/10" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 md:h-16 w-auto transition-all duration-300 group-hover:scale-110" />
            ) : (
              <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-sky-500 group-hover:scale-105 transition-transform uppercase">DKCWB.</h1>
            )}
          </Link>
        </div>

        {/* SEARCH BAR (CENTER) - Visible on Desktop */}
        <div className="hidden lg:flex flex-1 max-w-xl mx-8">
          <form onSubmit={handleSearch} className="w-full relative">
            <Input 
              type="text" 
              placeholder="Pesquisar na DKCWB..." 
              className="w-full h-12 pl-5 pr-12 rounded-xl border-transparent bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 transition-all border-white/5 focus:border-sky-500 shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button type="submit" size="icon" className="absolute right-1 top-1 h-10 w-10 bg-transparent hover:bg-white/5 text-slate-400 hover:text-sky-500 rounded-lg">
              <Search className="h-5 w-5" />
            </Button>
          </form>
        </div>

        {/* ICONS AREA (RIGHT) */}
        <div className="flex items-center space-x-2 md:space-x-6 shrink-0">
          <Link to="/compras" className="hidden sm:flex items-center gap-2 group">
            <Package className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
            <div className="hidden lg:flex flex-col leading-none">
                <span className="text-[9px] text-slate-500 font-black uppercase">Meus</span>
                <span className="text-[11px] text-white font-black uppercase tracking-tighter">Pedidos</span>
            </div>
          </Link>

          <Link to={session ? "/dashboard" : "/login"} className="flex items-center gap-2 group relative">
            <div className="relative">
                <User className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
            </div>
            <div className="hidden lg:flex flex-col leading-none">
                <span className="text-[9px] text-slate-500 font-black uppercase">
                    {session ? 'Olá, Membro' : 'Acesse'}
                </span>
                <span className="text-[11px] text-white font-black uppercase tracking-tighter">
                    {session ? 'Sua Conta' : 'Sua Conta'}
                </span>
            </div>
          </Link>

          <button onClick={onCartClick} className="flex items-center gap-2 group relative">
            <div className="relative">
                <ShoppingCart className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
                {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-sky-500 text-white text-[9px] font-black h-4.5 w-4.5 min-w-[18px] flex items-center justify-center rounded-full shadow-lg ring-2 ring-black">
                    {cartCount}
                    </span>
                )}
            </div>
            <div className="hidden lg:flex flex-col leading-none">
                <span className="text-[9px] text-slate-500 font-black uppercase">Meu</span>
                <span className="text-[11px] text-white font-black uppercase tracking-tighter">Carrinho</span>
            </div>
          </button>
        </div>
      </div>

      {/* CATEGORY DROPDOWN BAR (DESKTOP) */}
      <div className="hidden md:block border-t border-white/5 bg-slate-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-0">
          <DesktopNav />
        </div>
      </div>
      
      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-4">
         <form onSubmit={handleSearch} className="relative">
            <Input 
              type="text" 
              placeholder="Pesquisar..." 
              className="w-full h-10 pl-4 pr-10 rounded-lg border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button type="submit" size="icon" className="absolute right-0 top-0 h-10 w-10 bg-transparent text-slate-500">
              <Search className="h-4 w-4" />
            </Button>
         </form>
      </div>
    </header>
  );
};

export default Header;