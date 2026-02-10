import { useEffect, useState, useCallback } from 'react';
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
  variantId?: string; // Novo: para linkar direto
}

const AllProductsPage = () => {
  const [searchParams] = useSearchParams();
  
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category');
  const initialSubCategory = searchParams.get('sub_category');
  const initialBrand = searchParams.get('brand');

  const [displayProducts, setDisplayProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allFlavors, setAllFlavors] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategory ? [initialCategory] : []);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>(initialSubCategory ? [initialSubCategory] : []);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(initialBrand ? [initialBrand] : []);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('created_at-desc');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    const querySearch = searchParams.get('search');
    const queryCategory = searchParams.get('category');
    const querySubCategory = searchParams.get('sub_category');
    const queryBrand = searchParams.get('brand');

    if (querySearch !== null) setSearchTerm(querySearch); else setSearchTerm('');
    if (queryCategory) setSelectedCategories([queryCategory]); else setSelectedCategories([]);
    if (querySubCategory) setSelectedSubCategories([querySubCategory]); else setSelectedSubCategories([]);
    if (queryBrand) setSelectedBrands([queryBrand]); else setSelectedBrands([]);
  }, [searchParams]);

  const fetchFilterOptions = useCallback(async () => {
    const { data: catData } = await supabase.from('categories').select('name');
    if (catData) setAllCategories(catData.map(c => c.name));

    const { data: subCatData } = await supabase.from('sub_categories').select('name');
    if (subCatData) setAllSubCategories(subCatData.map(sc => sc.name));

    const { data: brandData } = await supabase.from('brands').select('name');
    if (brandData) setAllBrands(brandData.map(b => b.name));

    const { data: flavorData } = await supabase.from('flavors').select('name').eq('is_visible', true);
    if (flavorData) setAllFlavors(flavorData.map(f => f.name));
  }, []);

  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      
      let productIdsFromFlavors: number[] | null = null;

      // 1. Filtragem por sabor (inverso)
      if (selectedFlavors.length > 0) {
        const { data: flavorIdsData } = await supabase.from('flavors').select('id').in('name', selectedFlavors);
        if (flavorIdsData && flavorIdsData.length > 0) {
          const flavorIds = flavorIdsData.map(f => f.id);
          // Busca em product_variants E product_flavors
          const { data: variantData } = await supabase.from('product_variants').select('product_id').in('flavor_id', flavorIds);
          const { data: prodFlavorData } = await supabase.from('product_flavors').select('product_id').in('flavor_id', flavorIds);
          
          const idsA = variantData?.map(v => v.product_id) || [];
          const idsB = prodFlavorData?.map(pf => pf.product_id) || [];
          productIdsFromFlavors = [...new Set([...idsA, ...idsB])];
          
          if (productIdsFromFlavors.length === 0) productIdsFromFlavors = [-1];
        } else {
          productIdsFromFlavors = [-1];
        }
      }

      // 2. Query Principal de Produtos PAI
      let query = supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, sub_category, stock_quantity, created_at')
        .eq('is_visible', true)
        .gt('stock_quantity', 0); // Considera estoque total (que é a soma das variantes)

      if (debouncedSearchTerm) query = query.ilike('name', `%${debouncedSearchTerm}%`);
      if (selectedCategories.length > 0) query = query.in('category', selectedCategories);
      if (selectedSubCategories.length > 0) query = query.in('sub_category', selectedSubCategories);
      if (selectedBrands.length > 0) query = query.in('brand', selectedBrands);
      if (productIdsFromFlavors) query = query.in('id', productIdsFromFlavors);

      const [sortField, sortOrder] = sortBy.split('-');
      // Ordenação primária na query (para os pais)
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      const { data: parentProducts, error } = await query;

      if (error) {
        console.error("Error fetching products:", error);
        setDisplayProducts([]);
        setLoading(false);
        return;
      }

      const products = parentProducts || [];
      const productIds = products.map(p => p.id);

      // 3. Buscar TODAS as variações desses produtos
      // Trazemos flavor_name via join
      const { data: variants } = await supabase
        .from('product_variants')
        .select(`
            id, product_id, price, pix_price, stock_quantity, created_at,
            flavors ( name )
        `)
        .in('product_id', productIds)
        .eq('is_active', true)
        .gt('stock_quantity', 0);

      // 4. Montar lista de exibição (Pai + Variações)
      let finalDisplayList: DisplayProduct[] = [];

      products.forEach(prod => {
        // A. Adiciona o Produto Pai (Genérico)
        finalDisplayList.push({
            id: prod.id,
            name: prod.name,
            price: prod.price,
            pixPrice: prod.pix_price,
            imageUrl: prod.image_url || '',
            stockQuantity: prod.stock_quantity
        });

        // B. Adiciona as Variações como produtos individuais
        const prodVariants = variants?.filter(v => v.product_id === prod.id) || [];

        prodVariants.forEach(v => {
            const flavorName = (v.flavors as any)?.name;
            const displayName = flavorName ? `${prod.name} - ${flavorName}` : prod.name;
            
            finalDisplayList.push({
                id: prod.id, // Mantém ID do pai para navegação
                variantId: v.id, // ID da variação para seleção
                name: displayName,
                price: v.price, // Preço da variação
                pixPrice: v.pix_price, // Pix da variação
                imageUrl: prod.image_url || '', // Imagem do pai (por enquanto)
                stockQuantity: v.stock_quantity
            });
        });
      });

      // 5. Reordenar a lista final explodida
      if (sortField === 'price') {
        finalDisplayList.sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price);
      } else if (sortField === 'created_at') {
        // Se a ordenação for por data (ID implícito ou created_at se tivéssemos na variante), mantemos a ordem do banco
        // Como o array foi construído sequencialmente (Pai, Filhos, Pai, Filhos), ele já respeita a ordem dos pais.
      }

      setDisplayProducts(finalDisplayList);
      setLoading(false);
    };

    fetchProducts();
  }, [debouncedSearchTerm, selectedCategories, selectedSubCategories, selectedBrands, selectedFlavors, sortBy]);

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
                    key={`${product.id}-${product.variantId || 'main'}-${idx}`} 
                    product={{
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        pixPrice: product.pixPrice,
                        imageUrl: product.imageUrl,
                        stockQuantity: product.stockQuantity,
                        // Passamos o variantId como prop extra
                        // @ts-ignore
                        variantId: product.variantId 
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