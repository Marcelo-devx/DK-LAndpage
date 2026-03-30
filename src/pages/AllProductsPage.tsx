import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ProductCard from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import ProductFilters from '@/components/ProductFilters';
import { useDebounce } from '@/hooks/use-debounce';
import { useSearchParams } from 'react-router-dom';

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
    const querySearch = searchParams.get('search');
    const queryCategory = searchParams.get('category');
    const querySubCategory = searchParams.get('sub_category');
    const queryBrand = searchParams.get('brand');

    setSearchTerm(querySearch ?? '');
    setSelectedCategories(queryCategory ? [queryCategory] : []);
    setSelectedSubCategories(querySubCategory ? [querySubCategory] : []);
    setSelectedBrands(queryBrand ? [queryBrand] : []);
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

      if (error) {
        console.error('Error fetching products:', error);
        setDisplayProducts([]);
        return;
      }

      const products = parentProducts || [];
      const productIds = products.map(p => p.id);

      const { data: variants } = productIds.length > 0
        ? await supabase
            .from('product_variants')
            .select('id, product_id, price, pix_price, stock_quantity')
            .in('product_id', productIds)
            .eq('is_active', true)
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
            id: prod.id, name: prod.name, price: minPrice, pixPrice: minPixPrice,
            imageUrl: prod.image_url || '', stockQuantity: totalStock,
            hasMultipleVariants: true, showAgeBadge: showAge,
          });
        } else {
          finalDisplayList.push({
            id: prod.id, name: prod.name, price: prod.price, pixPrice: prod.pix_price,
            imageUrl: prod.image_url || '', stockQuantity: prod.stock_quantity,
            hasMultipleVariants: false, showAgeBadge: showAge,
          });
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

  // Fetch on filter/sort change
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Re-fetch when user returns to this tab
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) fetchProducts();
    };
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

  return (
    <div className="container mx-auto px-4 py-4 md:py-8">
      <header className="mb-6 text-center">
        <h1 className="font-serif text-3xl md:text-5xl text-charcoal-gray">Nossos Produtos</h1>
        <p className="mt-1 text-base text-stone-600">Explore nossa linha completa.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-4 lg:gap-8">
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
        <main className="lg:col-span-3">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="flex flex-col space-y-3">
                  <Skeleton className="w-full rounded-lg aspect-[4/5]" />
                  <div className="space-y-2 bg-charcoal-gray p-4 rounded-b-lg">
                    <Skeleton className="h-6 w-3/4 mx-auto" />
                    <Skeleton className="h-6 w-1/2 mx-auto" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
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
            <div className="text-center py-12">
              <h3 className="font-serif text-2xl text-charcoal-gray">Nenhum produto encontrado</h3>
              <p className="text-stone-600 mt-1">Tente ajustar seus filtros ou limpar a busca.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AllProductsPage;
