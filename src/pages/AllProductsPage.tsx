import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ProductCard from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import ProductFilters from '@/components/ProductFilters';
import { useDebounce } from '@/hooks/use-debounce';
import { useSearchParams } from 'react-router-dom';
import { PackageSearch, Sparkles, X } from 'lucide-react';

interface DisplayProduct {
  id: number;
  name: string;
  price: number;
  pixPrice: number | null;
  imageUrl: string;
  stockQuantity: number;
  variantId?: string;
  hasMultipleVariants?: boolean;
  showAgeBadge?: boolean;
}

const AllProductsPage = () => {
  const [searchParams] = useSearchParams();

  const [displayProducts, setDisplayProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allFlavors, setAllFlavors] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('category') ? [searchParams.get('category')!] : []
  );
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>(
    searchParams.get('sub_category') ? [searchParams.get('sub_category')!] : []
  );
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    searchParams.get('brand') ? [searchParams.get('brand')!] : []
  );
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('created_at-desc');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Sync filters when URL params change
  useEffect(() => {
    setSearchTerm(searchParams.get('search') ?? '');
    setSelectedCategories(searchParams.get('category') ? [searchParams.get('category')!] : []);
    setSelectedSubCategories(searchParams.get('sub_category') ? [searchParams.get('sub_category')!] : []);
    setSelectedBrands(searchParams.get('brand') ? [searchParams.get('brand')!] : []);
  }, [searchParams]);

  const fetchFilterOptions = useCallback(async () => {
    const [catData, subCatData, brandData, flavorData] = await Promise.all([
      supabase.from('categories').select('name'),
      supabase.from('sub_categories').select('name'),
      supabase.from('brands').select('name'),
      supabase.from('flavors').select('name').eq('is_visible', true),
    ]);
    if (catData.data) setAllCategories(catData.data.map(c => c.name));
    if (subCatData.data) setAllSubCategories(subCatData.data.map(sc => sc.name));
    if (brandData.data) setAllBrands(brandData.data.map(b => b.name));
    if (flavorData.data) setAllFlavors(flavorData.data.map(f => f.name));
  }, []);

  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const normalizeCategory = (s?: string) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

      const { data: categoriesData } = await supabase.from('categories').select('name, show_age_restriction');
      const categoriesMap: Record<string, boolean> = {};
      if (categoriesData) {
        categoriesData.forEach((c: any) => {
          if (c.name) categoriesMap[normalizeCategory(c.name)] = c.show_age_restriction !== false;
        });
      }

      let productIdsFromFlavors: number[] | null = null;
      if (selectedFlavors.length > 0) {
        const { data: flavorIdsData } = await supabase.from('flavors').select('id').in('name', selectedFlavors);
        if (flavorIdsData && flavorIdsData.length > 0) {
          const flavorIds = flavorIdsData.map(f => f.id);
          const [variantData, prodFlavorData] = await Promise.all([
            supabase.from('product_variants').select('product_id').in('flavor_id', flavorIds),
            supabase.from('product_flavors').select('product_id').in('flavor_id', flavorIds),
          ]);
          const idsA = variantData.data?.map(v => v.product_id) || [];
          const idsB = prodFlavorData.data?.map(pf => pf.product_id) || [];
          productIdsFromFlavors = [...new Set([...idsA, ...idsB])];
          if (productIdsFromFlavors.length === 0) productIdsFromFlavors = [-1];
        } else {
          productIdsFromFlavors = [-1];
        }
      }

      let query = supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, sub_category, stock_quantity, created_at')
        .eq('is_visible', true);

      if (debouncedSearchTerm) query = query.ilike('name', `%${debouncedSearchTerm}%`);
      if (selectedCategories.length > 0) query = query.in('category', selectedCategories);
      if (selectedSubCategories.length > 0) query = query.in('sub_category', selectedSubCategories);
      if (selectedBrands.length > 0) query = query.in('brand', selectedBrands);
      if (productIdsFromFlavors) query = query.in('id', productIdsFromFlavors);

      const [sortField, sortOrder] = sortBy.split('-');
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      const { data: parentProducts, error } = await query;
      if (error) { console.error('Error fetching products:', error); setDisplayProducts([]); return; }

      const products = parentProducts || [];
      const productIds = products.map(p => p.id);

      const { data: variants } = productIds.length > 0
        ? await supabase.from('product_variants').select('id, product_id, price, pix_price, stock_quantity').in('product_id', productIds).eq('is_active', true)
        : { data: [] };

      const finalDisplayList: DisplayProduct[] = [];
      products.forEach(prod => {
        const prodVariants = variants?.filter(v => v.product_id === prod.id) || [];
        const showAge = prod.category ? (categoriesMap[normalizeCategory(prod.category)] ?? true) : true;
        if (prodVariants.length > 0) {
          const minPrice = Math.min(...prodVariants.map(v => v.price));
          const minPixPrice = Math.min(...prodVariants.map(v => v.pix_price || v.price));
          const totalStock = prodVariants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
          finalDisplayList.push({ id: prod.id, name: prod.name, price: minPrice, pixPrice: minPixPrice, imageUrl: prod.image_url || '', stockQuantity: totalStock, hasMultipleVariants: true, showAgeBadge: showAge });
        } else {
          finalDisplayList.push({ id: prod.id, name: prod.name, price: prod.price, pixPrice: prod.pix_price, imageUrl: prod.image_url || '', stockQuantity: prod.stock_quantity, hasMultipleVariants: false, showAgeBadge: showAge });
        }
      });

      if (sortField === 'price') {
        finalDisplayList.sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price);
      }

      setDisplayProducts(finalDisplayList);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, selectedCategories, selectedSubCategories, selectedBrands, selectedFlavors, sortBy]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) fetchProducts(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchProducts]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSelectedBrands([]);
    setSelectedFlavors([]);
    window.history.pushState({}, '', '/produtos');
  };

  const totalActiveFilters =
    selectedCategories.length + selectedSubCategories.length +
    selectedBrands.length + selectedFlavors.length;

  return (
    <div className="min-h-screen bg-off-white">
      {/* Hero Header */}
      <div className="bg-slate-950 text-white py-12 md:py-16 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-sky-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-sky-400">Catálogo Completo</span>
            <Sparkles className="h-4 w-4 text-sky-400" />
          </div>
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter italic uppercase text-white leading-none">
            Nossos<br />
            <span className="text-sky-400">Produtos.</span>
          </h1>
          <p className="mt-4 text-stone-400 font-medium text-sm md:text-base max-w-md mx-auto">
            Explore nossa linha completa com os melhores produtos do mercado.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-10">
        {/* Active filters bar */}
        {totalActiveFilters > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Filtros ativos:</span>
            {selectedCategories.map(c => (
              <span key={c} className="flex items-center gap-1 bg-sky-100 text-sky-700 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border border-sky-200">
                {c}
                <button onClick={() => setSelectedCategories(prev => prev.filter(x => x !== c))} className="hover:text-sky-900">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {selectedBrands.map(b => (
              <span key={b} className="flex items-center gap-1 bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border border-purple-200">
                {b}
                <button onClick={() => setSelectedBrands(prev => prev.filter(x => x !== b))} className="hover:text-purple-900">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {selectedSubCategories.map(s => (
              <span key={s} className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border border-emerald-200">
                {s}
                <button onClick={() => setSelectedSubCategories(prev => prev.filter(x => x !== s))} className="hover:text-emerald-900">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {selectedFlavors.map(f => (
              <span key={f} className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border border-amber-200">
                {f}
                <button onClick={() => setSelectedFlavors(prev => prev.filter(x => x !== f))} className="hover:text-amber-900">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <button
              onClick={handleClearFilters}
              className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors ml-1"
            >
              Limpar tudo
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 lg:gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 mb-6 lg:mb-0">
            <ProductFilters
              categories={allCategories}
              subCategories={allSubCategories}
              brands={allBrands}
              flavors={allFlavors}
              selectedCategories={selectedCategories}
              selectedSubCategories={selectedSubCategories}
              selectedBrands={selectedBrands}
              selectedFlavors={selectedFlavors}
              onSearchChange={setSearchTerm}
              onCategoryChange={setSelectedCategories}
              onSubCategoryChange={setSelectedSubCategories}
              onBrandChange={setSelectedBrands}
              onFlavorChange={setSelectedFlavors}
              onSortChange={setSortBy}
              onClearFilters={handleClearFilters}
            />
          </div>

          {/* Products grid */}
          <main className="lg:col-span-3">
            {/* Results count */}
            {!loading && (
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                  {displayProducts.length > 0
                    ? <><span className="text-charcoal-gray font-black text-sm">{displayProducts.length}</span> produto{displayProducts.length !== 1 ? 's' : ''} encontrado{displayProducts.length !== 1 ? 's' : ''}</>
                    : 'Nenhum resultado'
                  }
                </p>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="flex flex-col space-y-2">
                    <Skeleton className="w-full rounded-2xl aspect-[4/5] bg-stone-200" />
                    <Skeleton className="h-4 w-3/4 rounded-lg bg-stone-200" />
                    <Skeleton className="h-4 w-1/2 rounded-lg bg-stone-200" />
                    <Skeleton className="h-10 w-full rounded-xl bg-stone-200" />
                  </div>
                ))}
              </div>
            ) : displayProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
                {displayProducts.map((product, idx) => (
                  <ProductCard
                    key={`${product.id}-${idx}`}
                    product={{
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      pixPrice: product.pixPrice,
                      imageUrl: product.imageUrl,
                      stockQuantity: product.stockQuantity,
                      variantId: product.variantId,
                      hasMultipleVariants: product.hasMultipleVariants,
                      showAgeBadge: product.showAgeBadge,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="bg-stone-100 rounded-full p-6 mb-6">
                  <PackageSearch className="h-12 w-12 text-stone-400" />
                </div>
                <h3 className="font-black text-2xl uppercase tracking-tighter italic text-charcoal-gray mb-2">
                  Nenhum produto encontrado
                </h3>
                <p className="text-stone-500 text-sm font-medium max-w-xs">
                  Tente ajustar seus filtros ou limpar a busca para ver mais resultados.
                </p>
                {totalActiveFilters > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="mt-6 px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AllProductsPage;
