import { useState, useEffect, useCallback, memo } from 'react';
import ProductCard from '@/components/ProductCard';
import ProductImage from '@/components/ProductImage';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from '@/hooks/use-debounce';

// Define Sub-category type explicitly to match database schema
interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}

interface ProductFiltersProps {
  categories: Category[];
  subCategories: SubCategory[];
  brands: Brand[];
  flavors: Flavor[];
  selectedCategories: string[];
  selectedSubCategories: string[];
  selectedBrands: string[];
  selectedFlavors: string[];
  initialSearch?: string;
  initialSort?: string;
}

const ProductFilters = memo((props: ProductFiltersProps) => {
  const {
    categories,
    subCategories,
    brands,
    flavors,
    selectedCategories,
    selectedSubCategories,
    selectedBrands,
    selectedFlavors,
  } = props;

  const [searchTerm, setSearchTerm] = useState<string>(props.initialSearch || '');
  const [activeSort, setActiveSort] = useState<string>(props.initialSort || 'created_at-desc');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    subCategories: true,
    brands: true,
    flavors: true,
  });

  const debouncedSearch = useDebounce((term: string) => {
    // Logic for debouncing search will go here
  }, 300);

  // 3. Sync searchTerm when external parent (AllProductsPage) updates
  useEffect(() => {
    if (searchTerm !== props.initialSearch) {
      setSearchTerm(searchTerm);
    }
  }, [searchTerm, props.initialSearch]);

  // Toggle mobile sheet
  const toggleMobile = useCallback(() => {
    setIsMobileOpen(prev => !prev);
  }, [setIsMobileOpen]);

  // Toggle sections (Categories, Brands, Flavors)
  const toggleSection = (section: 'categories' | 'brands' | 'flavors') => () => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, [setExpandedSections]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setActiveSort('created_at-desc');
    // Don't clear categories/brands/flavors here as requested
    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSelectedBrands([]);
    setSelectedFlavors([]);
    // Note: The user requested clearing these, but keep the main `categories` list intact.
  }, [setSearchTerm, setActiveSort]);

  return (
    <div className="bg-white">
      {/* Filter Header */}
      <div className="sticky top-0 z-30 w-full bg-white shadow-sm border-b border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Filtros</h3>
          
          {/* Clear Filters Button - User asked to remove this from Header in ProductFilters, but kept it here for UI. */}
          {/* <Button onClick={clearFilters} className="text-xs font-semibold text-slate-500 hover:text-red-500">Limpar Filtros</Button> */}
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{Object.keys(filters).length} filtros ativos</span>
            <Input 
              type="search"
              placeholder="Buscar produtos..."
              className="h-9 w-full md:w-64 bg-white border-gray-200 rounded-md px-3 py-1 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
      </div>

      {/* Filter Content */}
      <div className="px-4 py-6">
        
        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h4 className="font-bold text-slate-900 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Categorias</span>
                  {/* Mobile Dropdown Toggle */}
                  <div className="md:hidden">
                    <button
                      onClick={() => toggleSection('categories')}
                      className={cn(
                        "flex items-center justify-between w-full px-2",
                        expandedSections.categories ? "bg-white text-slate-900 border-gray-100 rounded-t-md" : "text-slate-500 hover:bg-slate-100",
                        "transition-all duration-200"
                      )}
                    >
                      <span className="text-xs font-bold uppercase">{expandedSections.categories ? 'Ver menos' : 'Ver mais'}</span>
                    </button>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500 transform transition-transform duration-200" />
              </CardTitle>
            </CardHeader>

          {/* Mobile Sheet Content */}
          <SheetTrigger className="md:hidden" asChild onClick={() => toggleSection('categories')}>
            <div className="px-6 py-2 flex items-center gap-4">
              <div className="text-sm font-medium text-slate-900">Categorias</div>
            </div>
          </SheetTrigger>

          <SheetContent side="left" className={cn(
            "w-[90vw] h-full bg-white",
            isMobileOpen ? "translate-x-0" : "translate-x-0",
            "transition-transform duration-300",
            "ease-out"
          )}>
            <div className="h-full overflow-y-auto">
              <div className="px-4 py-2 space-y-4">
                {selectedCategories.map((category) => (
                  <div key={category}>
                    <Checkbox 
                      id={`checkbox-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories(prev => [...prev, category]);
                        } else {
                          setSelectedCategories(prev => prev.filter(c => c !== category));
                        }
                      }}
                      className="peer sr-only"
                    />
                    <label 
                      htmlFor={`checkbox-${category}`}
                      className="text-sm text-slate-700 cursor-pointer select-none"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </SheetContent>
        </Card>

        {/* Brands */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Marcas</span>
                  {/* Mobile Dropdown Toggle */}
                  <div className="md:hidden">
                    <button
                      onClick={() => toggleSection('brands')}
                      className={cn(
                        "flex items-center justify-between w-full px-2",
                        expandedSections.brands ? "bg-white text-slate-900 border-gray-100 rounded-t-md" : "text-slate-500 hover:bg-slate-100",
                        "transition-all duration-200"
                      )}
                    >
                      <span className="text-xs font-bold uppercase">{expandedSections.brands ? 'Ver menos' : 'Ver mais'}</span>
                    </button>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-s-500 transform transition-transform duration-200" />
              </CardTitle>
            </CardHeader>

          {/* Mobile Sheet Content */}
          <SheetTrigger className="md:hidden" asChild onClick={() => toggleSection('brands')}>
            <div className="px-6 py-2 flex items-center gap-4">
              <div className="text-sm font-medium text-slate-900">Marcas</div>
            </div>
          </SheetTrigger>

          <SheetContent side="left" className={cn(
            "w-[90vw] h-full bg-white",
            isMobileOpen ? "translate-x-0" : "translate-x-0",
            "transition-transform duration-300",
            "ease-out"
          )}>
            <div className="h-full overflow-y-auto">
              <div className="px-4 py-2 space-y-4">
                {selectedBrands.map((brand) => (
                  <div key={brand}>
                    <Checkbox 
                      id={`checkbox-${brand}`}
                      checked={selectedBrands.includes(brand)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedBrands(prev => [...prev, brand]);
                        } else {
                          setSelectedBrands(prev => prev.filter(b => b !== brand));
                        }
                      }}
                      className="peer sr-only"
                    />
                    <label 
                      htmlFor={`checkbox-${brand}`}
                      className="text-sm text-slate-700 cursor-pointer select-none"
                    >
                      {brand}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </SheetContent>
        </Card>

        {/* Flavors */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Sabores</span>
                  {/* Mobile Dropdown Toggle */}
                  <div className="md:hidden">
                    <button
                      onClick={() => toggleSection('flavors')}
                      className={cn(
                        "flex items-center justify-between w-full px-2",
                        expandedSections.flavors ? "bg-white text-slate-900 border-gray-100 rounded-t-md" : "text-slate-500 hover:bg-slate-100",
                        "transition-all duration-200"
                      )}
                    >
                      <span className="text-xs font-bold uppercase">{expandedSections.flavors ? 'Ver menos' : 'Ver mais'}</span>
                    </button>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-s-500 transform transition-transform duration-200" />
              </CardTitle>
            </CardHeader>

          {/* Mobile Sheet Content */}
          <SheetTrigger className="md:hidden" asChild onClick={() => toggleSection('flavors')}>
            <div className="px-6 py-2 flex items-center gap-4">
              <div className="text-sm font-medium text-slate-900">Sabores</div>
            </div>
          </SheetTrigger>

          <SheetContent side="left" className={cn(
            "w-[90vw] h-full bg-white",
            isMobileOpen ? "translate-x-0" : "translate-x-0",
            "transition-transform duration-300",
            "ease-out"
          )}>
            <div className="h-full overflow-y-auto">
              <div className="px-4 py-2 space-y-4">
                {selectedFlavors.map((flavor) => (
                  <div key={flavor}>
                    <Checkbox 
                      id={`checkbox-${flavor}`}
                      checked={selectedFlavors.includes(flavor)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedFlavors(prev => [...prev, flavor]);
                        } else {
                          setSelectedFlavors(prev => prev.filter(f => f !== flavor));
                        }
                      }}
                      className="peer sr-only"
                    />
                    <label 
                      htmlFor={`checkbox-${flavor}`}
                      className="text-sm text-slate-700 cursor-pointer select-none"
                    >
                      {flavor}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </SheetContent>
        </Card>

        {/* Desktop Filters - Collapsible */}
        <div className="hidden md:flex md:flex gap-6 flex-col">
          {/* Categories */}
          <div className="flex-1">
            <button
              onClick={() => toggleSection('categories')}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border border-transparent hover:bg-slate-50 transition-colors",
                expandedSections.categories ? "bg-slate-50" : "",
                "w-full"
              )}
            >
              <span className="text-xs font-bold text-slate-500 uppercase">Categorias</span>
              <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform duration-200", expandedSections.categories ? "-rotate-180" : "rotate-0")} />
            </button>
          </div>

          <div className={cn(
            "flex-1 flex-col overflow-hidden transition-all duration-300",
            expandedSections.categories ? "flex h-auto max-h-0" : "h-[500px]",
            "opacity-0 invisible pointer-events-none"
          )}>
            {selectedCategories.length > 0 ? (
              <div className="space-y-1">
                {selectedCategories.map((category) => (
                  <div key={category} className="px-4 py-2 rounded-xl border border-transparent hover:bg-slate-50 transition-colors cursor-pointer group hover:border-sky-500">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{category}</span>
                      <span className="text-xs text-slate-500 font-bold uppercase truncate">{selectedCategories.includes(category) ? 'Remover' : 'Adicionar'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">Nenhuma categoria selecionada.</div>
            )}
          </div>

          {/* Brands */}
          <div className="flex-1">
            <button
              onClick={() => toggleSection('brands')}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border-transparent hover:bg-slate-50 transition-colors",
                expandedSections.brands ? "bg-slate-50" : "",
                "w-full"
              )}
            >
              <span className="text-xs font-bold text-slate-500 uppercase">Marcas</span>
              <ChevronDown className={cn("w-4 h-4 text-s-500 transition-transform duration-200", expandedSections.brands ? "-rotate-180" : "rotate-0")} />
            </button>
          </div>

          <div className={cn(
            "flex-1 flex-col overflow-hidden transition-all duration-300",
            expandedSections.brands ? "flex h-auto max-h-0" : "h-[500px]",
            "opacity-0 invisible pointer-events-none"
          )}>
            {selectedBrands.length > 0 ? (
              <div className="space-y-1">
                {selectedBrands.map((brand) => (
                  <div key={brand} className="px-4 py-2 rounded-xl border-transparent hover:bg-slate-50 transition-colors cursor-pointer group hover:border-sky-500">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{brand}</span>
                      <span className="text-xs text-slate-500 font-bold uppercase truncate">{selectedBrands.includes(brand) ? 'Remover' : 'Adicionar'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">Nenhuma marca selecionada.</div>
            )}
          </div>

          {/* Flavors */}
          <div className="flex-1">
            <button
              onClick={() => toggleSection('flavors')}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border-transparent hover:bg-sale-50 transition-colors",
                expandedSections.flavors ? "bg-ale-50" : "",
                "w-full"
              )}
            >
              <span className="text-xs font-bold text-slate-500 uppercase">Sabores</span>
              <ChevronDown className={cn("w-4 h-4 text-sale-500 transition-transform duration-200", expandedSections.flavors ? "-rotate-180" : "rotate-0")} />
            </button>
          </div>

          <div className={cn(
            "flex-1 flex-col overflow-hidden transition-all duration-300",
            expandedSections.flavors ? "flex h-auto max-h-0" : "h-[500px]",
            "opacity-0 invisible pointer-events-none"
          )}>
            {selectedFlavors.length > 0 ? (
              <div className="space-y-1">
                {selectedFlavors.map((flavor) => (
                  <div key={flavor} className="px-4 py-2 rounded-xl border-transparent hover:bg-sale-50 transition-colors cursor-pointer group hover:border-sky-500">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{flavor}</span>
                      <span className="text-xs text-slate-500 font-bold uppercase truncate">{selectedFlavors.includes(flavor) ? 'Remover' : 'Adicionar'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">Nenhum sabor selecionado.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ProductFilters.displayName = 'ProductFilters';
export default ProductFilters;