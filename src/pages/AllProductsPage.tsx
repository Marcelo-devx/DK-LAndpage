import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ProductCard from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import ProductFilters from '@/components/ProductFilters';
import { useDebounce } from '@/hooks/use-debounce';

interface Product {
  id: number;
  name: string;
  price: number;
  pix_price: number | null;
  image_url: string;
  category: string | null;
  sub_category: string | null;
}

const AllProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allFlavors, setAllFlavors] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('created_at-desc');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchFilterOptions = useCallback(async () => {
    const { data: catData, error: catError } = await supabase.from('categories').select('name');
    if (catError) console.error(catError);
    else setAllCategories(catData.map(c => c.name));

    const { data: subCatData, error: subCatError } = await supabase.from('sub_categories').select('name');
    if (subCatError) console.error(subCatError);
    else setAllSubCategories(subCatData.map(sc => sc.name));

    const { data: brandData, error: brandError } = await supabase.from('brands').select('name');
    if (brandError) console.error(brandError);
    else setAllBrands(brandData.map(b => b.name));

    const { data: flavorData, error: flavorError } = await supabase.from('flavors').select('name').eq('is_visible', true);
    if (flavorError) console.error(flavorError);
    else setAllFlavors(flavorData.map(f => f.name));
  }, []);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      
      let productIdsFromFlavors: number[] | null = null;

      if (selectedFlavors.length > 0) {
        const { data: flavorIdsData } = await supabase
          .from('flavors')
          .select('id')
          .in('name', selectedFlavors);

        if (flavorIdsData && flavorIdsData.length > 0) {
          const flavorIds = flavorIdsData.map(f => f.id);
          const { data: productFlavorData } = await supabase
            .from('product_flavors')
            .select('product_id')
            .in('flavor_id', flavorIds);
          
          if (productFlavorData) {
            productIdsFromFlavors = [...new Set(productFlavorData.map(pf => pf.product_id))];
            if (productIdsFromFlavors.length === 0) {
              productIdsFromFlavors = [-1]; // Use an impossible ID to return no results
            }
          }
        } else {
          productIdsFromFlavors = [-1];
        }
      }

      let query = supabase
        .from('products')
        .select('id, name, price, pix_price, image_url, category, sub_category')
        .eq('is_visible', true);

      if (debouncedSearchTerm) {
        query = query.ilike('name', `%${debouncedSearchTerm}%`);
      }
      if (selectedCategories.length > 0) {
        query = query.in('category', selectedCategories);
      }
      if (selectedSubCategories.length > 0) {
        query = query.in('sub_category', selectedSubCategories);
      }
      if (selectedBrands.length > 0) {
        query = query.in('brand', selectedBrands);
      }
      if (productIdsFromFlavors) {
        query = query.in('id', productIdsFromFlavors);
      }

      const [sortField, sortOrder] = sortBy.split('-');
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } else {
        setProducts(data as Product[]);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [debouncedSearchTerm, selectedCategories, selectedSubCategories, selectedBrands, selectedFlavors, sortBy]);

  const handleClearFilters = () => {
    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSelectedBrands([]);
    setSelectedFlavors([]);
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <header className="mb-8 text-center">
        <h1 className="font-serif text-4xl md:text-5xl text-charcoal-gray">Nossos Produtos</h1>
        <p className="mt-2 text-lg text-stone-600">Explore nossa linha completa de produtos.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-4 lg:gap-8">
        <div className="lg:col-span-1 mb-8 lg:mb-0">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
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
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {products.map((product) => (
                <ProductCard key={product.id} product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  pixPrice: product.pix_price,
                  imageUrl: product.image_url,
                  url: `/produto/${product.id}`
                }} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <h3 className="font-serif text-2xl text-charcoal-gray">Nenhum produto encontrado</h3>
              <p className="text-stone-600 mt-2">Tente ajustar seus filtros ou limpar a busca.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AllProductsPage;