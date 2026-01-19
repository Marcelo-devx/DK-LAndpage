import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, ShoppingCart, Menu, Search, Package, ChevronDown, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import type { Session } from '@supabase/supabase-js';
import { getCartTotalItems } from '@/utils/localCart';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from "@/components/ui/navigation-menu";
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
    <NavigationMenu className="max-w-full justify-center">
      <NavigationMenuList className="flex flex-nowrap overflow-x-auto no-scrollbar gap-0">
        {categories.map((category) => {
          const categorySubs = subCategories.filter(s => s.category_id === category.id);
          
          return (
            <NavigationMenuItem key={category.id} className="shrink-0">
              <NavigationMenuTrigger 
                className="bg-transparent text-white hover:text-sky-400 data-[state=open]:bg-white/10 data-[state=open]:text-sky-400 font-black uppercase text-[11px] tracking-[0.15em] h-14 px-6 transition-all whitespace-nowrap" 
                translate="no"
              >
                {category.name}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="w-[600px] p-8 bg-black border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,1)] rounded-2xl grid grid-cols-[1fr_240px] gap-10">
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-sky-500 uppercase tracking-[0.3em] border-b border-white/10 pb-3">Sub-Categorias</h4>
                    <ul className="grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {categorySubs.length > 0 ? (
                        categorySubs.map((sub) => (
                          <li key={sub.id}>
                            <NavigationMenuLink asChild>
                              <Link
                                to={`/produtos?category=${category.name}&sub_category=${sub.name}`}
                                className="flex items-center justify-between group p-3 rounded-xl hover:bg-white/5 transition-all"
                              >
                                <span className="text-[12px] font-bold text-slate-300 group-hover:text-white uppercase tracking-wider" translate="no">{sub.name}</span>
                                <ArrowRight className="h-4 w-4 text-sky-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        ))
                      ) : (
                        <li className="text-[11px] text-slate-500 italic font-medium p-3">Nenhuma sub-categoria encontrada.</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-white/[0.03] rounded-2xl p-7 flex flex-col justify-between border border-white/5 relative overflow-hidden group/box">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 blur-[40px] rounded-full" />
                    <div className="relative z-10">
                        <h5 className="text-white font-black text-lg uppercase tracking-tighter italic mb-4 leading-tight border-l-4 border-sky-500 pl-3">
                            {category.name}.
                        </h5>
                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                            Acesse agora nossa curadoria premium completa e exclusiva desenvolvida para a linha {category.name}.
                        </p>
                    </div>
                    <Button asChild size="lg" className="mt-8 bg-white text-black hover:bg-sky-500 hover:text-white font-black uppercase text-[10px] tracking-[0.2em] h-12 rounded-xl transition-all shadow-xl relative z-10">
                        <Link to={`/produtos?category=${category.name}`}>Explorar Tudo</Link>
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
        <div className="flex items-center space-x-2 shrink-0">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white md:hidden">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-black border-white/10 text-white p-0 w-[300px]">
              <div className="p-6 border-b border-white/5">
                <h1 className="text-2xl font-black italic tracking-tighter text-sky-500 uppercase">MENU DKCWB.</h1>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(100vh-100px)] custom-scrollbar">
                <nav className="flex flex-col gap-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Navegação Principal</h3>
                    <Link to="/produtos" className="block text-lg font-black uppercase tracking-widest hover:text-sky-400">Todos Produtos</Link>
                    <Link to="/compras" className="block text-lg font-black uppercase tracking-widest hover:text-sky-400">Meus Pedidos</Link>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Categorias</h3>
                    <Accordion type="single" collapsible className="w-full">
                        {categories.map((cat) => (
                            <AccordionItem key={cat.id} value={`cat-${cat.id}`} className="border-white/5">
                                <AccordionTrigger className="text-sm font-black uppercase tracking-widest hover:no-underline py-4">
                                    {cat.name}
                                </AccordionTrigger>
                                <AccordionContent className="pl-4 pb-4 space-y-3">
                                    <Link to={`/produtos?category=${cat.name}`} className="block text-xs font-bold text-sky-500 uppercase tracking-widest border-b border-white/5 pb-2">Explorar Tudo</Link>
                                    {subCategories.filter(s => s.category_id === cat.id).map(sub => (
                                        <Link key={sub.id} to={`/produtos?category=${cat.name}&sub_category=${sub.name}`} className="block text-xs font-medium text-slate-400 uppercase tracking-widest hover:text-white">{sub.name}</Link>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          
          <Link to="/" className="flex items-center group ml-1 md:ml-0">
            {loadingLogo ? (
              <Skeleton className="h-10 w-24 bg-white/10" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-10 md:h-16 w-auto transition-all duration-300 group-hover:scale-110" />
            ) : (
              <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter text-sky-500 group-hover:scale-105 transition-transform uppercase">DKCWB.</h1>
            )}
          </Link>
        </div>

        {/* SEARCH BAR (CENTER) */}
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
        <div className="flex items-center space-x-3 md:space-x-6 shrink-0">
          <Link to="/compras" className="hidden sm:flex items-center gap-2 group">
            <Package className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
            <div className="hidden lg:flex flex-col leading-none">
                <span className="text-[9px] text-slate-500 font-black uppercase">Meus</span>
                <span className="text-[11px] text-white font-black uppercase tracking-tighter">Pedidos</span>
            </div>
          </Link>

          <Link to={session ? "/dashboard" : "/login"} className="flex items-center gap-2 group relative">
            <User className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
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

      {/* CATEGORY BAR (DESKTOP) - Com rolagem horizontal */}
      <div className="hidden md:block border-t border-white/10 bg-black">
        <div className="container mx-auto px-6 overflow-x-auto no-scrollbar">
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