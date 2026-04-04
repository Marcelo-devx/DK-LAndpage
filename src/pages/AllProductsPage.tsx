import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ProductCard from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import ProductFilters from '@/components/ProductFilters';
import { useDebounce } from '@/hooks/use-debounce';
import { useSearchParams } from 'react-router-dom';
import { PackageSearch, X } from 'lucide-react';

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
  createdAt?: string | null;
}

interface Category {
  id: number;
  name: string;
}

interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}

const AllProductsPage = () => {
  const [searchParams] = useSearchParams();

  const [displayProducts, setDisplayProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // now options with counts
  const [categoryOptions, setCategoryOptions] = useState<{name:string,count:number}[]>([]);
  const [subCategoryOptions, setSubCategoryOptions] = useState<{name:string,count:number}[]>([]);
  const [brandOptions, setBrandOptions] = useState<{name:string,count:number}[]>([]);
  const [flavorOptions, setFlavorOptions] = useState<{name:string,count:number}[]>([]);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);

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

  // Função para normalizar strings (trim e lowercase)
  const normalizeString = useCallback((s?: string) => {
    if (!s) return '';
    return s.trim().toLowerCase();
  }, []);

  // Filtra subcategorias com base nas categorias selecionadas
  const availableSubCategories = useCallback(() => {
    if (selectedCategories.length === 0) {
      // Se nenhuma categoria selecionada, mostra todas as subcategorias
      return allSubCategories;
    }
    
    // Se há categorias selecionadas, filtra pelas subcategorias daquelas categorias
    const selectedCategoryIds = allCategories
      .filter(c => selectedCategories.some(sc => normalizeString(sc) === normalizeString(c.name)))
      .map(c => c.id);
    
    return allSubCategories.filter(sc => selectedCategoryIds.includes(sc.category_id));
  }, [selectedCategories, allCategories, allSubCategories, normalizeString]);

  // Sync filters when URL params change
  useEffect(() => {
    setSearchTerm(searchParams.get('search') ?? '');
    const categoryParam = searchParams.get('category');
    const subCategoryParam = searchParams.get('sub_category');
    const brandParam = searchParams.get('brand');
    
    setSelectedCategories(categoryParam ? [categoryParam] : []);
    setSelectedSubCategories(subCategoryParam ? [subCategoryParam] : []);
    setSelectedBrands(brandParam ? [brandParam] : []);
    
    // Debug: log dos filtros sincronizados
    console.log('[AllProductsPage] Filtros da URL:', { categoryParam, subCategoryParam, brandParam });
  }, [searchParams]);

  // Limpa subcategorias selecionadas quando a categoria muda
  useEffect(() => {
    const available = availableSubCategories();
    const validSelected = selectedSubCategories.filter(sc => 
      available.some(a => normalizeString(a.name) === normalizeString(sc))
    );
    
    // Se alguma subcategoria selecionada não está mais disponível, remove
    if (validSelected.length !== selectedSubCategories.length) {
      setSelectedSubCategories(validSelected);
    }
  }, [selectedCategories, allSubCategories, availableSubCategories, normalizeString]);

  const fetchFilterOptions = useCallback(async () => {
    // keep legacy master lists for ids
    const [catRes, subCatRes] = await Promise.all([
      supabase.from('categories').select('id, name').eq('is_visible', true).order('name'),
      supabase.from('sub_categories').select('id, name, category_id').eq('is_visible', true).order('name'),
    ]);

    setAllCategories(catRes.data || []);
    setAllSubCategories(subCatRes.data || []);
  }, []);

  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);

  const fetchProducts = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const normalizeCategory = (s?: string) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

      const { data: categoriesData } = await supabase.from('categories').select('name, show_age_restriction');
      const categoriesMap: Record<string, boolean> = {};
      if (categoriesData) {
        categoriesData.forEach((c: any) => {
          if (c.name) categoriesMap[normalizeCategory(c.name)] = c.show_age_restriction !== false;
        });
      }

      // If the search term matches a flavor name, collect product IDs linked to that flavor
      let flavorMatchProductIds: number[] = [];
      if (debouncedSearchTerm) {
        const { data: matchedFlavors } = await supabase.from('flavors').select('id').ilike('name', `%${debouncedSearchTerm}%`).eq('is_visible', true);
        const flavorIds = (matchedFlavors || []).map((f: any) => f.id).filter(Boolean);
        if (flavorIds.length > 0) {
          const [{ data: variantMatches }, { data: pfMatches }] = await Promise.all([
            supabase.from('product_variants').select('product_id').in('flavor_id', flavorIds).eq('is_active', true),
            supabase.from('product_flavors').select('product_id').in('flavor_id', flavorIds),
          ]);
          const ids = new Set<number>();
          (variantMatches || []).forEach((v: any) => ids.add(v.product_id));
          (pfMatches || []).forEach((pf: any) => ids.add(pf.product_id));
          flavorMatchProductIds = Array.from(ids);
        }
      }

      // Build the base query for text/category/brand/subcategory matches
      let query = supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, sub_category, brand, stock_quantity, created_at')
        .eq('is_visible', true);

      if (debouncedSearchTerm) {
        const term = `%${debouncedSearchTerm}%`;
        query = query.or(`name.ilike.${term},category.ilike.${term},sub_category.ilike.${term},brand.ilike.${term}`);
      }

      if (selectedCategories.length > 0) query = query.in('category', selectedCategories);
      if (selectedSubCategories.length > 0) query = query.in('sub_category', selectedSubCategories);
      if (selectedBrands.length > 0) query = query.in('brand', selectedBrands);

      const [qSortField, qSortOrder] = sortBy.split('-');
      query = query.order(qSortField, { ascending: qSortOrder === 'asc' });

      const { data: parentProducts, error } = await query;

      // If we found product IDs by flavor, fetch those products and merge with parentProducts
      let mergedProducts = parentProducts || [];
      if (flavorMatchProductIds.length > 0) {
        const { data: flavorProducts } = await supabase.from('products').select('id, name, price, pix_price, image_url, category, sub_category, brand, stock_quantity, created_at').in('id', flavorMatchProductIds).eq('is_visible', true);
        const map = new Map<number, any>();
        (mergedProducts || []).forEach((p: any) => map.set(p.id, p));
        (flavorProducts || []).forEach((p: any) => map.set(p.id, p));
        mergedProducts = Array.from(map.values());
      }

      const products = mergedProducts || [];

      if (error) {
        console.error('[AllProductsPage] Error fetching products:', error);
        if (!background) {
          setDisplayProducts([]);
          setCategoryOptions([]);
          setSubCategoryOptions([]);
          setBrandOptions([]);
          setFlavorOptions([]);
        }
        return;
      }

      // Fast path for background updates: avoid fetching variants/flavors/counts to keep it snappy
      if (background) {
        const quickList: DisplayProduct[] = products.map((prod: any) => ({
          id: prod.id,
          name: prod.name,
          price: prod.price,
          pixPrice: prod.pix_price,
          imageUrl: prod.image_url || '',
          stockQuantity: prod.stock_quantity ?? 0,
          hasMultipleVariants: false,
          showAgeBadge: prod.category ? (categoriesMap[normalizeCategory(prod.category)] ?? true) : true,
          createdAt: prod.created_at || null,
        }));

        // Keep ordering behavior consistent: prioritize available products
        quickList.sort((a, b) => {
          const aAvailable = (a.stockQuantity || 0) > 0;
          const bAvailable = (b.stockQuantity || 0) > 0;
          if (aAvailable && !bAvailable) return -1;
          if (!aAvailable && bAvailable) return 1;

          if (qSortField === 'price') {
            const aPrice = a.price || 0;
            const bPrice = b.price || 0;
            return qSortOrder === 'asc' ? aPrice - bPrice : bPrice - aPrice;
          }

          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return qSortOrder === 'asc' ? aTime - bTime : bTime - aTime;
        });

        setDisplayProducts(quickList);
        return;
      }

      // Full path (initial load or foreground): fetch variants, flavors and compute counts
      const productIds = products.map((p: any) => p.id);

      const { data: variants } = productIds.length > 0
        ? await supabase.from('product_variants').select('id, product_id, price, pix_price, stock_quantity, flavor_id').in('product_id', productIds).eq('is_active', true)
        : { data: [] };

      const finalDisplayList: DisplayProduct[] = [];
      products.forEach(prod => {
        const prodVariants = variants?.filter((v: any) => v.product_id === prod.id) || [];
        const showAge = prod.category ? (categoriesMap[normalizeCategory(prod.category)] ?? true) : true;

        if (prodVariants.length > 0) {
          const minPrice = Math.min(...prodVariants.map((v: any) => v.price));
          const minPixPrice = Math.min(...prodVariants.map((v: any) => v.pix_price || v.price));
          const totalStock = prodVariants.reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0);
          finalDisplayList.push({
            id: prod.id,
            name: prod.name,
            price: minPrice,
            pixPrice: minPixPrice,
            imageUrl: prod.image_url || '',
            stockQuantity: totalStock,
            hasMultipleVariants: true,
            showAgeBadge: showAge,
            createdAt: prod.created_at || null,
          });
        } else {
          finalDisplayList.push({
            id: prod.id,
            name: prod.name,
            price: prod.price,
            pixPrice: prod.pix_price,
            imageUrl: prod.image_url || '',
            stockQuantity: prod.stock_quantity,
            hasMultipleVariants: false,
            showAgeBadge: showAge,
            createdAt: prod.created_at || null,
          });
        }
      });

      // Compute counts for filters (categories, subcategories, brands, flavors)
      const catCountMap = new Map<string, number>();
      const subCatCountMap = new Map<string, number>();
      const brandCountMap = new Map<string, number>();

      products.forEach((p: any) => {
        if (p.category) catCountMap.set(p.category, (catCountMap.get(p.category) || 0) + 1);
        if (p.sub_category) subCatCountMap.set(p.sub_category, (subCatCountMap.get(p.sub_category) || 0) + 1);
        if (p.brand) brandCountMap.set(p.brand, (brandCountMap.get(p.brand) || 0) + 1);
      });

      // Flavor counts (may be expensive) - keep as before
      let flavorCountMap = new Map<string, number>();
      if (productIds.length > 0) {
        const [variantFlavors, productFlavorRelations] = await Promise.all([
          // include flavor_id and stock to determine availability on variants
          supabase.from('product_variants').select('flavor_id, product_id, stock_quantity').in('product_id', productIds).eq('is_active', true),
          supabase.from('product_flavors').select('flavor_id, product_id').in('product_id', productIds),
        ]);

        // Determine availability per product: product.stock_quantity OR sum of variant stock > 0
        const variantSumByProduct: Record<number, number> = {};
        (variantFlavors.data || []).forEach((v: any) => {
          if (typeof v.product_id !== 'number') return;
          variantSumByProduct[v.product_id] = (variantSumByProduct[v.product_id] || 0) + (v.stock_quantity || 0);
        });

        const productAvailable = new Set<number>();
        (products || []).forEach((p: any) => {
          const pid = p.id;
          const prodStock = p.stock_quantity || 0;
          const varStock = variantSumByProduct[pid] || 0;
          if (prodStock > 0 || varStock > 0) productAvailable.add(pid);
        });

        // Build mapping flavorId -> set of productIds (prefer variant flavor_id, fallback to product_flavors)
        const flavorIdToProductIds = new Map<number, Set<number>>();
        (variantFlavors.data || []).forEach((v: any) => {
          if (!v.flavor_id) return;
          if (!flavorIdToProductIds.has(v.flavor_id)) flavorIdToProductIds.set(v.flavor_id, new Set());
          flavorIdToProductIds.get(v.flavor_id)!.add(v.product_id);
        });
        (productFlavorRelations.data || []).forEach((pf: any) => {
          if (!pf.flavor_id) return;
          if (!flavorIdToProductIds.has(pf.flavor_id)) flavorIdToProductIds.set(pf.flavor_id, new Set());
          flavorIdToProductIds.get(pf.flavor_id)!.add(pf.product_id);
        });

        // Count only available products per flavor
        for (const [flId, prodSet] of flavorIdToProductIds.entries()) {
          let count = 0;
          for (const pid of Array.from(prodSet)) {
            if (productAvailable.has(pid)) count++;
          }
          if (count > 0) flavorCountMap.set(String(flId), count);
        }

        const flavorIds = Array.from(flavorCountMap.keys()).map(k => Number(k));
        if (flavorIds.length > 0) {
          const { data: flavorNames } = await supabase.from('flavors').select('id, name').in('id', flavorIds).eq('is_visible', true);
          const idToName = new Map<number, string>();
          (flavorNames || []).forEach((f: any) => idToName.set(f.id, f.name));

          const flavorsArr: { name: string; count: number }[] = [];
          for (const [id, count] of flavorCountMap.entries()) {
            const name = idToName.get(Number(id)) || '';
            if (name) flavorsArr.push({ name, count });
          }
          flavorsArr.sort((a, b) => a.name.localeCompare(b.name));
          setFlavorOptions(flavorsArr);
        } else {
          setFlavorOptions([]);
        }
      } else {
        setFlavorOptions([]);
      }

      const categoriesArr = Array.from(catCountMap.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name));
      const subCategoriesArr = Array.from(subCatCountMap.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name));
      const brandsArr = Array.from(brandCountMap.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name));

      setCategoryOptions(categoriesArr);
      setSubCategoryOptions(subCategoriesArr);
      setBrandOptions(brandsArr);

      // Prioritize available products before applying sort
      const [sField, sOrder] = sortBy.split('-');
      finalDisplayList.sort((a, b) => {
        const aAvailable = (a.stockQuantity || 0) > 0;
        const bAvailable = (b.stockQuantity || 0) > 0;
        if (aAvailable && !bAvailable) return -1;
        if (!aAvailable && bAvailable) return 1;

        if (sField === 'price') {
          const aPrice = a.price || 0;
          const bPrice = b.price || 0;
          return sOrder === 'asc' ? aPrice - bPrice : bPrice - aPrice;
        }

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sOrder === 'asc' ? aTime - bTime : bTime - aTime;
      });

      setDisplayProducts(finalDisplayList);

      // Cleanup selected filters if they no longer exist
      const validCats = categoriesArr.map(c => c.name);
      const validSubCats = subCategoriesArr.map(s => s.name);
      const validBrands = brandsArr.map(b => b.name);
      const validFlavors = (flavorOptions || []).map(f => f.name);

      const nextSelectedCategories = selectedCategories.filter(s => validCats.includes(s));
      const nextSelectedSubCategories = selectedSubCategories.filter(s => validSubCats.includes(s));
      const nextSelectedBrands = selectedBrands.filter(s => validBrands.includes(s));
      const nextSelectedFlavors = selectedFlavors.filter(s => validFlavors.includes(s));

      if (nextSelectedCategories.length !== selectedCategories.length) setSelectedCategories(nextSelectedCategories);
      if (nextSelectedSubCategories.length !== selectedSubCategories.length) setSelectedSubCategories(nextSelectedSubCategories);
      if (nextSelectedBrands.length !== selectedBrands.length) setSelectedBrands(nextSelectedBrands);
      if (nextSelectedFlavors.length !== selectedFlavors.length) setSelectedFlavors(nextSelectedFlavors);

    } finally {
      if (!background) setLoading(false);
    }
  }, [debouncedSearchTerm, selectedCategories, selectedSubCategories, selectedBrands, selectedFlavors, sortBy]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    // Avoid refetching immediately on every small tab/app switch.
    // Record when the document becomes hidden and only refetch if the user was away
    // longer than THRESHOLD_MS. Also respond to window focus for desktop app switches.
    let hiddenAt = 0;
    const THRESHOLD_MS = 10 * 1000; // 10 seconds

    const handleVisibility = () => {
      try {
        if (document.hidden) {
          hiddenAt = Date.now();
        } else {
          // Came back to the page
          if (!hiddenAt) return; // wasn't previously hidden in this session
          const elapsed = Date.now() - hiddenAt;
          hiddenAt = 0;
          if (elapsed > THRESHOLD_MS) {
            // schedule a background fetch during idle time to avoid blocking UI
            const schedule = (cb: () => void) => {
              if ((window as any).requestIdleCallback) {
                (window as any).requestIdleCallback(cb, { timeout: 2000 });
              } else {
                setTimeout(cb, 500);
              }
            };
            schedule(() => {
              if (document.visibilityState === 'visible') fetchProducts(true);
            });
          }
        }
      } catch (e) {
        // noop
      }
    };

    const handleWindowFocus = () => {
      try {
        // If we have a recorded hiddenAt and enough time passed, trigger fetch
        if (hiddenAt && (Date.now() - hiddenAt) > THRESHOLD_MS) {
          const schedule = (cb: () => void) => {
            if ((window as any).requestIdleCallback) {
              (window as any).requestIdleCallback(cb, { timeout: 2000 });
            } else {
              setTimeout(cb, 500);
            }
          };
          schedule(() => { if (document.visibilityState === 'visible') fetchProducts(true); });
          hiddenAt = 0;
        }
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleWindowFocus);
    };
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

      <div className="container mx-auto px-4 md:px-6 xl:px-8 2xl:px-12 py-4 md:py-10 xl:py-12">
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

        <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 lg:gap-8 xl:gap-10">
          {/* Sidebar */}
          <div className="lg:col-span-1 mb-6 lg:mb-0">
            <ProductFilters
              categories={categoryOptions}
              subCategories={subCategoryOptions}
              brands={brandOptions}
              flavors={flavorOptions}
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
          <main className="lg:col-span-3 xl:col-span-4">
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
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-5 xl:gap-6">
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
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-5 xl:gap-6">
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