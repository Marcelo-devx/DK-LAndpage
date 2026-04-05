import { useEffect, useState, memo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, ShoppingCart, Menu, Search, Package, Trophy } from 'lucide-react';
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

// helper normalize
const normalizeKey = (s?: string) => {
  if (!s) return '';
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
};

// DesktopNav — movido para fora do Header para evitar re-criação a cada render
interface DesktopNavProps {
  categories: Category[];
  categoryProductSubsMap: Record<number, string[]>;
}

const DesktopNav = memo(({ categories, categoryProductSubsMap }: DesktopNavProps) => (
  <NavigationMenu className="max-w-full justify-center w-full">
    <NavigationMenuList className="flex flex-wrap justify-center gap-y-0 gap-x-1">
      {categories.map((category) => {
        // product-derived subcategories for this category (exact strings)
        const productSubs = categoryProductSubsMap[category.id] || [];
        
        return (
          <NavigationMenuItem key={category.id} className="shrink-0">
            <NavigationMenuTrigger 
              className="bg-transparent text-white hover:text-sky-400 data-[state=open]:bg-white/10 data-[state=open]:text-sky-400 font-black uppercase text-[11px] tracking-[0.15em] h-14 px-4 transition-all" 
              translate="no"
            >
              <Link
                to={`/produtos?category=${encodeURIComponent(category.name)}`}
                onClick={(e) => { e.stopPropagation(); }}
                className="w-full block"
              >
                {category.name}
              </Link>
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="w-[680px] max-w-[90vw] p-6 md:p-8 bg-black border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,1)] rounded-2xl">
                <h4 className="text-[11px] font-black text-sky-500 uppercase tracking-[0.3em] border-b border-white/10 pb-3">Sub-Categorias</h4>
                <div className="mt-4 grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-3 custom-scrollbar">
                  {productSubs.length > 0 ? (
                    productSubs.map((sub) => (
                      <NavigationMenuLink key={sub} asChild>
                        <Link
                          to={`/produtos?category=${encodeURIComponent(category.name)}&sub_category=${encodeURIComponent(sub)}`}
                          className="block p-3 rounded-xl hover:bg-white/5 transition-all"
                        >
                          <span className="text-[12px] font-bold text-slate-300 hover:text-white uppercase tracking-wider" translate="no">{sub}</span>
                        </Link>
                      </NavigationMenuLink>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-700 italic">Nenhuma sub-categoria encontrada.</div>
                  )}
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        );
      })}
    </NavigationMenuList>
  </NavigationMenu>
));

DesktopNav.displayName = 'DesktopNav';

const Header = memo(({ onCartClick }: HeaderProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [categoryProductSubsMap, setCategoryProductSubsMap] = useState<Record<number, string[]>>({});
  const [categoryBrandsMap, setCategoryBrandsMap] = useState<Record<number, string[]>>({});
  const [categoryFlavorsMap, setCategoryFlavorsMap] = useState<Record<number, string[]>>({});

  const fetchNavData = async () => {
    try {
      const [cats, subs, productRows] = await Promise.all([
        supabase.from('categories').select('id, name').eq('is_visible', true).order('name'),
        supabase.from('sub_categories').select('id, name, category_id').eq('is_visible', true).order('name'),
        supabase.from('products').select('id, category, sub_category, brand, stock_quantity').neq('category', null).neq('category', '').eq('is_visible', true),
      ]);

      if (cats) setCategories(cats);
      if (subs) setSubCategories(subs);

      const catNameToId = new Map<string, number>();
      (cats || []).forEach((c: any) => { if (c.name) catNameToId.set(normalizeKey(String(c.name)), c.id); });

      const catProductIds: Record<number, number[]> = {};
      const productInfo: Record<number, { id: number; category: string; brand?: string | null; sub_category?: string | null; stock_quantity?: number | null }> = {};

      (productRows || []).forEach((p: any) => {
        if (!p.category) return;
        const catId = catNameToId.get(normalizeKey(String(p.category)));
        if (!catId) return;
        if (!catProductIds[catId]) catProductIds[catId] = [];
        catProductIds[catId].push(p.id);
        productInfo[p.id] = { id: p.id, category: String(p.category), brand: p.brand, sub_category: p.sub_category, stock_quantity: p.stock_quantity ?? 0 };
      });

      const allProductIds = Object.values(catProductIds).flat();
      const productAvailable: Record<number, boolean> = {};

      if (allProductIds.length > 0) {
        // Fetch variant stocks AND product_sub_categories in parallel
        const [variantStockRes, productSubCatsRes] = await Promise.all([
          supabase.from('product_variants').select('product_id, stock_quantity').in('product_id', allProductIds).eq('is_active', true),
          supabase.from('product_sub_categories').select('product_id, sub_category_id').in('product_id', allProductIds),
        ]);

        // Sum variant stock per product
        const variantSumByProduct: Record<number, number> = {};
        (variantStockRes.data || []).forEach((v: any) => {
          if (typeof v.product_id !== 'number') return;
          variantSumByProduct[v.product_id] = (variantSumByProduct[v.product_id] || 0) + (v.stock_quantity || 0);
        });

        // Determine availability
        allProductIds.forEach(pid => {
          const prodStock = productInfo[pid]?.stock_quantity || 0;
          const varStock = variantSumByProduct[pid] || 0;
          productAvailable[pid] = (prodStock > 0) || (varStock > 0);
        });

        // Build sub_category_id -> sub_category name map from already-fetched subs
        const subIdToName = new Map<number, string>();
        const subIdToCatId = new Map<number, number>();
        (subs || []).forEach((s: any) => {
          subIdToName.set(s.id, s.name);
          subIdToCatId.set(s.id, s.category_id);
        });

        // Build categoryId -> set of sub-category names (only from available products)
        const catSubsMap: Record<number, Set<string>> = {};
        (productSubCatsRes.data || []).forEach((psc: any) => {
          const pid = psc.product_id;
          const subId = psc.sub_category_id;
          if (!productAvailable[pid]) return;
          const subName = subIdToName.get(subId);
          const catId = subIdToCatId.get(subId);
          if (!subName || !catId) return;
          if (!catSubsMap[catId]) catSubsMap[catId] = new Set();
          catSubsMap[catId].add(subName);
        });

        const catSubsFilteredObj: Record<number, string[]> = {};
        Object.entries(catSubsMap).forEach(([catIdStr, subsSet]) => {
          catSubsFilteredObj[Number(catIdStr)] = Array.from(subsSet).sort();
        });
        setCategoryProductSubsMap(catSubsFilteredObj);
      }

      // Clear brands/flavors maps — no longer used in nav
      setCategoryBrandsMap({});
      setCategoryFlavorsMap({});
    } catch (error) {
      console.error('[Header] Error fetching nav data:', error);
      // Não quebra a app se falhar o fetch de navegação
    }
  };

  const updateCartCount = useCallback(() => {
    setCartCount(getCartTotalItems());
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchInitialData = async () => {
      if (!isMounted) return;
      
      setLoadingLogo(true);
      try {
        const { data: logoData } = await supabase.from('app_settings').select('value').eq('key', 'logo_url').single();
        if (logoData && isMounted) setLogoUrl(logoData.value);
      } catch (error) {
        console.error('[Header] Error fetching logo:', error);
      } finally {
        if (isMounted) setLoadingLogo(false);
      }

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (isMounted) setSession(currentSession);
        updateCartCount();
        fetchNavData();
      } catch (error) {
        console.error('[Header] Error fetching session:', error);
      }
    };

    fetchInitialData();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      // TOKEN_REFRESHED happens every time the user returns from another app on mobile.
      // Updating session state on that event causes a Header re-render that breaks the page.
      // Only update session on meaningful auth events.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        if (isMounted) setSession(currentSession);
      }
    });

    window.addEventListener('cartUpdated', updateCartCount);
    return () => {
      isMounted = false;
      try { authListener?.subscription?.unsubscribe(); } catch (e) { /* ignore */ }
      window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/produtos?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <header className="bg-black border-b border-white/10 w-full">
      {/* Mobile Header with Back Button */}
      <div className="md:hidden flex items-center justify-between gap-3 px-4 py-3">
        {/* Logo and Menu Button */}
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
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">Navegação Principal</h3>
                    <Link to="/produtos" className="block text-lg font-black uppercase tracking-widest hover:text-sky-400">Todos Produtos</Link>
                    <Link to="/compras" className="block text-lg font-black uppercase tracking-widest hover:text-sky-400">Meus Pedidos</Link>
                    <Link to="/como-funciona" className="block text-lg font-black uppercase tracking-widest hover:text-sky-400">Clube DK</Link>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">Categorias</h3>
                    <Accordion type="single" collapsible className="w-full">
                        {categories.map((cat) => (
                            <AccordionItem key={cat.id} value={`cat-${cat.id}`} className="border-white/5">
                                <AccordionTrigger className="text-sm font-black uppercase tracking-widest hover:no-underline py-4" translate="no">
                                    {cat.name}
                                </AccordionTrigger>
                                <AccordionContent className="pl-4 pb-4 space-y-3">
                                    <Link to={`/produtos?category=${cat.name}`} className="block text-xs font-bold text-sky-500 uppercase tracking-widest border-b border-white/5 pb-2">Explorar Tudo</Link>
                                    { (categoryProductSubsMap[cat.id] || []).length > 0 ? (
                                      (categoryProductSubsMap[cat.id] || []).map(sub => (
                                        <Link key={sub} to={`/produtos?category=${cat.name}&sub_category=${encodeURIComponent(sub)}`} className="block text-xs font-medium text-slate-400 uppercase tracking-widest hover:text-white" translate="no">{sub}</Link>
                                      ))
                                    ) : (
                                      <div className="text-[11px] text-slate-700 italic">Nenhuma sub-categoria encontrada.</div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          
          <Link to="/" className="flex items-center group ml-1 md:ml-0" onClick={(e) => { e.preventDefault(); navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            {loadingLogo ? (
              <Skeleton className="h-10 w-24 bg-white/10" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-10 md:h-16 w-auto transition-all duration-300 group-hover:scale-110" />
            ) : (
              <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter text-sky-500 group-hover:scale-105 transition-transform uppercase" translate="no">DKCWB.</h1>
            )}
          </Link>
        </div>

        {/* Icons Area (Right) — no search bar here */}
        <div className="flex items-center space-x-4 shrink-0 ml-auto">
          <Link to={session ? "/dashboard" : "/login"} className="flex items-center group relative">
            <User className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
          </Link>

          <button onClick={onCartClick} className="flex items-center group relative">
            <div className="relative">
                <ShoppingCart className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
                {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-sky-500 text-white text-[9px] font-black h-4.5 w-4.5 min-w-[18px] flex items-center justify-center rounded-full shadow-lg ring-2 ring-black">
                    {cartCount}
                    </span>
                )}
            </div>
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center gap-3 lg:gap-5 xl:gap-6 px-4 lg:px-8 xl:px-12 py-0">
        {/* Logo Area */}
        <div className="flex items-center shrink-0">
          <Link to="/" className="flex items-center group" onClick={(e) => { e.preventDefault(); navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            {loadingLogo ? (
              <Skeleton className="h-12 lg:h-14 xl:h-16 w-28 bg-white/10" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 lg:h-14 xl:h-16 w-auto transition-all duration-300 group-hover:scale-110" />
            ) : (
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black italic tracking-tighter text-sky-500 group-hover:scale-105 transition-transform uppercase" translate="no">DKCWB.</h1>
            )}
          </Link>
        </div>

        {/* Search Bar — flex-1 centered */}
        <div className="flex-1 max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto">
          <form onSubmit={handleSearch} className="w-full relative">
            <Input 
              type="text" 
              placeholder="Pesquisar na DKCWB..." 
              className="w-full h-11 lg:h-12 pl-5 pr-12 rounded-xl border-transparent bg-white/5 text-white placeholder:text-slate-600 focus:bg-white/10 transition-all border-white/5 focus:border-sky-500 shadow-inner text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button type="submit" size="icon" className="absolute right-1 top-1 h-9 lg:h-10 w-9 lg:w-10 bg-transparent hover:bg-white/5 text-slate-600 hover:text-sky-500 rounded-lg">
              <Search className="h-4 w-4 lg:h-5 lg:w-5" />
            </Button>
          </form>
        </div>

        {/* Icons Area (Right) */}
        <div className="flex items-center space-x-2 lg:space-x-4 xl:space-x-6 shrink-0">
           
           <Link to="/como-funciona" className="flex items-center gap-1.5 lg:gap-2 group">
             <Trophy className="h-5 w-5 lg:h-6 lg:w-6 text-white group-hover:text-sky-500 transition-colors" />
             <div className="hidden xl:flex flex-col leading-none">
                 <span className="text-[9px] text-slate-400 font-black uppercase">Clube</span>
                 <span className="text-[11px] text-white font-black uppercase tracking-tighter">Vantagens</span>
             </div>
           </Link>

           <Link to="/compras" className="flex items-center gap-1.5 lg:gap-2 group">
             <Package className="h-5 w-5 lg:h-6 lg:w-6 text-white group-hover:text-sky-500 transition-colors" />
             <div className="hidden xl:flex flex-col leading-none">
                 <span className="text-[9px] text-slate-400 font-black uppercase">Meus</span>
                 <span className="text-[11px] text-white font-black uppercase tracking-tighter">Pedidos</span>
             </div>
           </Link>

           <Link to={session ? "/dashboard" : "/login"} className="flex items-center gap-1.5 lg:gap-2 group relative">
             <User className="h-5 w-5 lg:h-6 lg:w-6 text-white group-hover:text-sky-500 transition-colors" />
             <div className="hidden xl:flex flex-col leading-none">
                 <span className="text-[9px] text-slate-400 font-black uppercase">
                     {session ? 'Olá, Membro' : 'Acesse'}
                 </span>
                 <span className="text-[11px] text-white font-black uppercase tracking-tighter">
                     {session ? 'Sua Conta' : 'Sua Conta'}
                 </span>
             </div>
           </Link>

           <button onClick={onCartClick} className="flex items-center gap-1.5 lg:gap-2 group relative">
             <div className="relative">
                 <ShoppingCart className="h-5 w-5 lg:h-6 lg:w-6 text-white group-hover:text-sky-500 transition-colors" />
                 {cartCount > 0 && (
                     <span className="absolute -top-2 -right-2 bg-sky-500 text-white text-[9px] font-black h-4.5 w-4.5 min-w-[18px] flex items-center justify-center rounded-full shadow-lg ring-2 ring-black">
                     {cartCount}
                     </span>
                 )}
             </div>
             <div className="hidden xl:flex flex-col leading-none">
                 <span className="text-[9px] text-slate-400 font-black uppercase">Meu</span>
                 <span className="text-[11px] text-white font-black uppercase tracking-tighter">Carrinho</span>
             </div>
           </button>
         </div>
       </div>

      {/* CATEGORY BAR (DESKTOP) */}
      <div className="hidden md:block border-t border-white/10 bg-black">
        <div className="container mx-auto px-4 lg:px-8 xl:px-12 py-1 xl:py-2">
          <DesktopNav categories={categories} categoryProductSubsMap={categoryProductSubsMap} />
        </div>
      </div>
      
      {/* Mobile Search Bar & Quick Categories */}
      <div className="md:hidden px-4 pb-4 space-y-3">
         <form onSubmit={handleSearch} className="relative">
            <Input 
              type="text" 
              placeholder="Pesquisar..." 
              className="w-full h-10 pl-4 pr-10 rounded-lg border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button type="submit" size="icon" className="absolute right-0 top-0 h-10 w-10 bg-transparent text-slate-600 hover:text-sky-500">
              <Search className="h-4 w-4" />
            </Button>
         </form>

         {/* Navegação Rápida Horizontal (Mobile) */}
         <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map((cat) => (
               <Link 
                 key={cat.id} 
                 to={`/produtos?category=${cat.name}`}
                 className="whitespace-nowrap px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:bg-sky-500 hover:text-white transition-colors"
                 translate="no"
               >
                 {cat.name}
               </Link>
            ))}
         </div>
      </div>
    </header>
  );
});

export default Header;