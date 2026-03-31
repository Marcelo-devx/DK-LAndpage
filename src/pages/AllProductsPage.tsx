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

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);
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
    const [catData, subCatData, brandData, flavorData] = await Promise.all([
      supabase.from('categories').select('id, name').eq('is_visible', true).order('name'),
      supabase.from('sub_categories').select('id, name, category_id').eq('is_visible', true).order('name'),
      supabase.from('brands').select('name').eq('is_visible', true).order('name'),
      supabase.from('flavors').select('name').eq('is_visible', true).order('name'),
    ]);
    
    if (catData.data) setAllCategories(catData.data);
    if (subCatData.data) setAllSubCategories(subCatData.data);
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

      // Busca IDs de sabores se filtro de sabor estiver ativo
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

      if (debouncedSearchTerm) {
        // Busca em múltiplos campos - nome, categoria, subcategoria, marca
        const term = `%${debouncedSearchTerm}%`;
        query = query.or(
          `name.ilike.${term},category.ilike.${term},sub_category.ilike.${term},brand.ilike.${term}`
        );
      }
      
      // Filtro de categoria
      if (selectedCategories.length > 0) {
        query = query.in('category', selectedCategories);
      }
      
      // Filtro de subcategoria - aplica apenas se houver subcategorias selecionadas
      if (selectedSubCategories.length > 0) {
        query = query.in('sub_category', selectedSubCategories);
        console.log('[AllProductsPage] Filtrando por subcategorias:', selectedSubCategories);
      }
      
      // Filtro de marca
      if (selectedBrands.length > 0) {
        query = query.in('brand', selectedBrands);
      }
      
      // Filtro de sabores
      if (productIdsFromFlavors) {
        query = query.in('id', productIdsFromFlavors);
      }

      const [sortField, sortOrder] = sortBy.split('-');
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      console.log('[AllProductsPage] Query params:', {
        selectedCategories,
        selectedSubCategories,
        selectedBrands,
        selectedFlavors,
        sortBy
      });

      const { data: parentProducts, error } = await query;
      
      if (error) { 
        console.error('[AllProductsPage] Error fetching products:', error); 
        setDisplayProducts([]); 
        return; 
      }

      console.log('[AllProductsPage] Produtos encontrados:', parentProducts?.length);

      const products = parentProducts || [];
      const productIds = products.map(p => p.id);

      // Busca variantes dos produtos encontrados
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
          finalDisplayList.push({ 
            id: prod.id, 
            name: prod.name, 
            price: minPrice, 
            pixPrice: minPixPrice, 
            imageUrl: prod.image_url || '', 
            stockQuantity: totalStock, 
            hasMultipleVariants: true, 
            showAgeBadge: showAge 
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
            showAgeBadge: showAge 
          });
        }
      });

      // Ordenação por preço após o processamento (para considerar o menor preço das variantes)
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
              categories={allCategories.map(c => c.name)}
              subCategories={availableSubCategories().map(sc => sc.name)}
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