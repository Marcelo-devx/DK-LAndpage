import { useEffect, useState, memo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, ShoppingCart, Menu, Search, Package, ChevronDown, ArrowRight, X, Trophy } from 'lucide-react';
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
  const [availableSubCategoryNames, setAvailableSubCategoryNames] = useState<Set<string>>(new Set());
  const [categoryBrandsMap, setCategoryBrandsMap] = useState<Record<number, string[]>>({});
  const [categoryFlavorsMap, setCategoryFlavorsMap] = useState<Record<number, string[]>>({});

  const fetchNavData = async () => {
    const [{ data: cats }, { data: subs }, { data: productRows }] = await Promise.all([
      supabase.from('categories').select('id, name').eq('is_visible', true).order('name'),
      supabase.from('sub_categories').select('id, name, category_id').eq('is_visible', true).order('name'),
      // fetch products minimal fields
      supabase.from('products').select('id, category, brand').neq('category', null).neq('category', '').eq('is_visible', true),
    ]);

    if (cats) setCategories(cats);
    if (subs) setSubCategories(subs);

    // Build a set of available subcategory names from products
    const names = new Set<string>();
    (productRows || []).forEach((p: any) => {
      if (p.sub_category) names.add(String(p.sub_category));
    });
    setAvailableSubCategoryNames(names);

    // Build category -> brands and category -> productIds maps
    const catNameToId = new Map<string, number>();
    (cats || []).forEach((c: any) => { if (c.name) catNameToId.set(String(c.name), c.id); });

    const catBrands: Record<number, Set<string>> = {};
    const catProductIds: Record<number, number[]> = {};

    (productRows || []).forEach((p: any) => {
      const catId = catNameToId.get(String(p.category));
      if (!catId) return;
      if (!catBrands[catId]) catBrands[catId] = new Set();
      if (p.brand) catBrands[catId].add(String(p.brand));
      if (!catProductIds[catId]) catProductIds[catId] = [];
      catProductIds[catId].push(p.id);
    });

    // For flavors, fetch variant/product_flavors for all product ids grouped by category
    const categoryFlavorsResult: Record<number, Set<string>> = {};
    const allProductIds = Object.values(catProductIds).flat();
    if (allProductIds.length > 0) {
      const [variantRes, prodFlavorRes] = await Promise.all([
        supabase.from('product_variants').select('flavor_id, product_id').in('product_id', allProductIds).eq('is_active', true),
        supabase.from('product_flavors').select('flavor_id, product_id').in('product_id', allProductIds),
      ]);

      const flavorIdToProductIdsMap: Record<number, Set<number>> = {};
      (variantRes.data || []).forEach((v: any) => {
        if (!v.flavor_id) return;
        if (!flavorIdToProductIdsMap[v.flavor_id]) flavorIdToProductIdsMap[v.flavor_id] = new Set();
        flavorIdToProductIdsMap[v.flavor_id].add(v.product_id);
      });
      (prodFlavorRes.data || []).forEach((pf: any) => {
        if (!pf.flavor_id) return;
        if (!flavorIdToProductIdsMap[pf.flavor_id]) flavorIdToProductIdsMap[pf.flavor_id] = new Set();
        flavorIdToProductIdsMap[pf.flavor_id].add(pf.product_id);
      });

      const flavorIds = Object.keys(flavorIdToProductIdsMap).map(k => Number(k));
      const { data: flavorNames } = flavorIds.length > 0 ? await supabase.from('flavors').select('id, name').in('id', flavorIds).eq('is_visible', true) : { data: [] };
      const idToName = new Map<number, string>();
      (flavorNames || []).forEach((f: any) => idToName.set(f.id, f.name));

      // assign flavor names to categories based on product membership
      for (const [flIdStr, prodSet] of Object.entries(flavorIdToProductIdsMap)) {
        const flId = Number(flIdStr);
        const fname = idToName.get(flId);
        if (!fname) continue;
        // find categories that own these products
        for (const [catIdStr, prodIds] of Object.entries(catProductIds)) {
          const catId = Number(catIdStr);
          const prodSetArr = prodIds;
          const intersects = [...prodSet].some(pid => prodSetArr.includes(pid));
          if (intersects) {
            if (!categoryFlavorsResult[catId]) categoryFlavorsResult[catId] = new Set();
            categoryFlavorsResult[catId].add(fname);
          }
        }
      }
    }

    // convert sets to arrays
    const catBrandsObj: Record<number, string[]> = {};
    Object.entries(catBrands).forEach(([k, v]) => { catBrandsObj[Number(k)] = Array.from(v).sort(); });
    setCategoryBrandsMap(catBrandsObj);

    const catFlavorsObj: Record<number, string[]> = {};
    Object.entries(categoryFlavorsResult).forEach(([k, v]) => { catFlavorsObj[Number(k)] = Array.from(v).sort(); });
    setCategoryFlavorsMap(catFlavorsObj);
  };

  const updateCartCount = useCallback(() => {
    setCartCount(getCartTotalItems());
  }, []);

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

  const DesktopNav = () => (
    <NavigationMenu className="max-w-full justify-center w-full">
      <NavigationMenuList className="flex flex-wrap justify-center gap-y-0 gap-x-1">
        {categories.map((category) => {
          // only show subcategories that both belong to this category and are present in availableSubCategoryNames
          const categorySubs = subCategories
            .filter(s => s.category_id === category.id && availableSubCategoryNames.has(String(s.name)));

          // if no subcategories available, fall back to show brands/flavors for this category
          const fallbackBrands = categoryBrandsMap[category.id] || [];
          const fallbackFlavors = categoryFlavorsMap[category.id] || [];
          
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
                    {categorySubs.length > 0 ? (
                      categorySubs.map((sub) => (
                        <NavigationMenuLink key={sub.id} asChild>
                          <Link
                            to={`/produtos?category=${encodeURIComponent(category.name)}&sub_category=${encodeURIComponent(sub.name)}`}
                            className="block p-3 rounded-xl hover:bg-white/5 transition-all"
                          >
                            <span className="text-[12px] font-bold text-slate-300 hover:text-white uppercase tracking-wider" translate="no">{sub.name}</span>
                          </Link>
                        </NavigationMenuLink>
                      ))
                    ) : (
                      // Fallback: show brands and flavors available for this category so user can filter
                      <div className="space-y-4">
                        {fallbackBrands.length > 0 && (
                          <div>
                            <h5 className="text-xs font-black uppercase text-stone-400 mb-2">Marcas</h5>
                            <div className="flex flex-wrap gap-2">
                              {fallbackBrands.map((b) => (
                                <Link key={b} to={`/produtos?category=${encodeURIComponent(category.name)}&brand=${encodeURIComponent(b)}`} className="px-3 py-1.5 rounded-xl bg-white text-stone-700 hover:bg-white/90 transition-all text-xs font-bold uppercase">{b}</Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {fallbackFlavors.length > 0 && (
                          <div>
                            <h5 className="text-xs font-black uppercase text-stone-400 mb-2">Sabores</h5>
                            <div className="flex flex-wrap gap-2">
                              {fallbackFlavors.map((f) => (
                                <Link key={f} to={`/produtos?category=${encodeURIComponent(category.name)}&search=${encodeURIComponent(f)}`} className="px-3 py-1.5 rounded-xl bg-white text-stone-700 hover:bg-white/90 transition-all text-xs font-bold uppercase">{f}</Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {fallbackBrands.length === 0 && fallbackFlavors.length === 0 && (
                          <div className="text-[11px] text-slate-500 italic font-medium p-3">Nenhuma sub-categoria encontrada.</div>
                        )}
                      </div>
                    )}
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
      {/* Mobile Header with Back Button */}
      <div className="md:hidden flex items-center justify-between gap-4 px-4 py-3">
        {/* Logo and Back Button */}
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
                    <Link to="/como-funciona" className="block text-lg font-black uppercase tracking-widest hover:text-sky-400">Clube DK</Link>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Categorias</h3>
                    <Accordion type="single" collapsible className="w-full">
                        {categories.map((cat) => (
                            <AccordionItem key={cat.id} value={`cat-${cat.id}`} className="border-white/5">
                                <AccordionTrigger className="text-sm font-black uppercase tracking-widest hover:no-underline py-4" translate="no">
                                    {cat.name}
                                </AccordionTrigger>
                                <AccordionContent className="pl-4 pb-4 space-y-3">
                                    <Link to={`/produtos?category=${cat.name}`} className="block text-xs font-bold text-sky-500 uppercase tracking-widest border-b border-white/5 pb-2">Explorar Tudo</Link>
                                    {subCategories.filter(s => s.category_id === cat.id && availableSubCategoryNames.has(String(s.name))).map(sub => (
                                        <Link key={sub.id} to={`/produtos?category=${cat.name}&sub_category=${sub.name}`} className="block text-xs font-medium text-slate-400 uppercase tracking-widest hover:text-white" translate="no">{sub.name}</Link>
                                    ))}
                                    {/* If none, show brands/flavors */}
                                    {subCategories.filter(s => s.category_id === cat.id && availableSubCategoryNames.has(String(s.name))).length === 0 && (
                                      <div className="space-y-3">
                                        {(categoryBrandsMap[cat.id] || []).length > 0 && (
                                          <div>
                                            <h5 className="text-xs font-black uppercase text-stone-400 mb-2">Marcas</h5>
                                            <div className="flex flex-wrap gap-2">
                                              {(categoryBrandsMap[cat.id] || []).map(b => (
                                                <Link key={b} to={`/produtos?category=${cat.name}&brand=${b}`} className="px-3 py-1.5 rounded-xl bg-white text-stone-700 hover:bg-white/90 transition-all text-xs font-bold uppercase">{b}</Link>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {(categoryFlavorsMap[cat.id] || []).length > 0 && (
                                          <div>
                                            <h5 className="text-xs font-black uppercase text-stone-400 mb-2">Sabores</h5>
                                            <div className="flex flex-wrap gap-2">
                                              {(categoryFlavorsMap[cat.id] || []).map(f => (
                                                <Link key={f} to={`/produtos?category=${cat.name}&search=${f}`} className="px-3 py-1.5 rounded-xl bg-white text-stone-700 hover:bg-white/90 transition-all text-xs font-bold uppercase">{f}</Link>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
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
          
          <Link to="/" className="flex items-center group ml-1 md:ml-0">
            {loadingLogo ? (
              <Skeleton className="h-10 w-24 bg-white/10" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-10 md:h-16 w-auto transition-all duration-300 group-hover:scale-110" />
            ) : (
              <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter text-sky-500 group-hover:scale-105 transition-transform uppercase" translate="no">DKCWB.</h1>
            )}
          </Link>
        </div>

        {/* Search Bar (Mobile) */}
        <div className="flex-1 max-w-xl mx-8">
          <form onSubmit={handleSearch} className="w-full relative">
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

        {/* Icons Area (Right) */}
        <div className="flex items-center space-x-3 md:space-x-6 shrink-0">
          
          <Link to="/como-funciona" className="hidden sm:flex items-center gap-2 group">
            <Trophy className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
            <div className="hidden lg:flex flex-col leading-none">
                <span className="text-[9px] text-slate-400 font-black uppercase">Clube</span>
                <span className="text-[11px] text-white font-black uppercase tracking-tighter">Vantagens</span>
            </div>
          </Link>

          <Link to="/compras" className="hidden sm:flex items-center gap-2 group">
            <Package className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
            <div className="hidden lg:flex flex-col leading-none">
                <span className="text-[9px] text-slate-400 font-black uppercase">Meus</span>
                <span className="text-[11px] text-white font-black uppercase tracking-tighter">Pedidos</span>
            </div>
          </Link>

          <Link to={session ? "/dashboard" : "/login"} className="flex items-center gap-2 group relative">
            <User className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
            <div className="hidden lg:flex flex-col leading-none">
                <span className="text-[9px] text-slate-400 font-black uppercase">
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
                <span className="text-[9px] text-slate-400 font-black uppercase">Meu</span>
                <span className="text-[11px] text-white font-black uppercase tracking-tighter">Carrinho</span>
            </div>
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center gap-4 relative px-6">
        {/* Logo Area & Mobile Menu */}
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
                    <Link to="/como-funciona" className="block text-lg font-black uppercase tracking-widest hover:text-sky-400">Clube DK</Link>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Categorias</h3>
                    <Accordion type="single" collapsible className="w-full">
                        {categories.map((cat) => (
                            <AccordionItem key={cat.id} value={`cat-${cat.id}`} className="border-white/5">
                                <AccordionTrigger className="text-sm font-black uppercase tracking-widest hover:no-underline py-4" translate="no">
                                    {cat.name}
                                </AccordionTrigger>
                                <AccordionContent className="pl-4 pb-4 space-y-3">
                                    <Link to={`/produtos?category=${cat.name}`} className="block text-xs font-bold text-sky-500 uppercase tracking-widest border-b border-white/5 pb-2">Explorar Tudo</Link>
                                    {subCategories.filter(s => s.category_id === cat.id && availableSubCategoryNames.has(String(s.name))).map(sub => (
                                        <Link key={sub.id} to={`/produtos?category=${cat.name}&sub_category=${sub.name}`} className="block text-xs font-medium text-slate-400 uppercase tracking-widest hover:text-white" translate="no">{sub.name}</Link>
                                    ))}
                                    {/* If none, show brands/flavors */}
                                    {subCategories.filter(s => s.category_id === cat.id && availableSubCategoryNames.has(String(s.name))).length === 0 && (
                                      <div className="space-y-3">
                                        {(categoryBrandsMap[cat.id] || []).length > 0 && (
                                          <div>
                                            <h5 className="text-xs font-black uppercase text-stone-400 mb-2">Marcas</h5>
                                            <div className="flex flex-wrap gap-2">
                                              {(categoryBrandsMap[cat.id] || []).map(b => (
                                                <Link key={b} to={`/produtos?category=${cat.name}&brand=${b}`} className="px-3 py-1.5 rounded-xl bg-white text-stone-700 hover:bg-white/90 transition-all text-xs font-bold uppercase">{b}</Link>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {(categoryFlavorsMap[cat.id] || []).length > 0 && (
                                          <div>
                                            <h5 className="text-xs font-black uppercase text-stone-400 mb-2">Sabores</h5>
                                            <div className="flex flex-wrap gap-2">
                                              {(categoryFlavorsMap[cat.id] || []).map(f => (
                                                <Link key={f} to={`/produtos?category=${cat.name}&search=${f}`} className="px-3 py-1.5 rounded-xl bg-white text-stone-700 hover:bg-white/90 transition-all text-xs font-bold uppercase">{f}</Link>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
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
          
          <Link to="/" className="flex items-center group ml-1 md:ml-0">
            {loadingLogo ? (
              <Skeleton className="h-10 w-24 bg-white/10" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-10 md:h-16 w-auto transition-all duration-300 group-hover:scale-110" />
            ) : (
              <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter text-sky-500 group-hover:scale-105 transition-transform uppercase" translate="no">DKCWB.</h1>
            )}
          </Link>
        </div>

        {/* Search Bar (Centered on Desktop) */}
        <div className="hidden lg:flex absolute left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-8">
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

        {/* Icons Area (Right) */}
        <div className="flex items-center space-x-3 md:space-x-6 shrink-0 ml-auto">
           
           <Link to="/como-funciona" className="hidden sm:flex items-center gap-2 group">
             <Trophy className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
             <div className="hidden lg:flex flex-col leading-none">
                 <span className="text-[9px] text-slate-400 font-black uppercase">Clube</span>
                 <span className="text-[11px] text-white font-black uppercase tracking-tighter">Vantagens</span>
             </div>
           </Link>

           <Link to="/compras" className="hidden sm:flex items-center gap-2 group">
             <Package className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
             <div className="hidden lg:flex flex-col leading-none">
                 <span className="text-[9px] text-slate-400 font-black uppercase">Meus</span>
                 <span className="text-[11px] text-white font-black uppercase tracking-tighter">Pedidos</span>
             </div>
           </Link>

           <Link to={session ? "/dashboard" : "/login"} className="flex items-center gap-2 group relative">
             <User className="h-6 w-6 text-white group-hover:text-sky-500 transition-colors" />
             <div className="hidden lg:flex flex-col leading-none">
                 <span className="text-[9px] text-slate-400 font-black uppercase">
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
                 <span className="text-[9px] text-slate-400 font-black uppercase">Meu</span>
                 <span className="text-[11px] text-white font-black uppercase tracking-tighter">Carrinho</span>
             </div>
           </button>
         </div>
       </div>

      {/* CATEGORY BAR (DESKTOP) - Permitindo quebra de linha */}
      <div className="hidden md:block border-t border-white/10 bg-black">
        <div className="container mx-auto px-6 py-2">
          <DesktopNav />
        </div>
      </div>
      
      {/* Mobile Search Bar & Quick Categories */}
      <div className="md:hidden px-4 pb-4 space-y-3">
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