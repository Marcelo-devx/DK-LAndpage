export interface Category {
  id: number;
  name: string;
}

export interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}

export interface Brand {
  id: number;
  name: string;
}

export interface Flavor {
  id: number;
  name: string;
}
</dyad-edit>

⏳ Waiting for turbo edits...

<dyad-write path="src/components/ProductFilters.tsx" description="Fix TypeScript errors and layout issues in ProductFilters component">
import { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox as RadixCheckbox } from '@radix-ui/react-checkbox';
import { cn } from "@/lib/utils";
// Import shared types
import { Category, SubCategory, Brand, Flavor, SelectedFilter } from '@/types/product';

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
  onSearchChange: (value: string) => void;
  onCategoryChange: (values: string[]) => void;
  onSubCategoryChange: (values: string[]) => void;
  onBrandChange: (values: string[]) => void;
  onFlavorChange: (values: string[]) => void;
  onSortChange: (value: string) => void;
  onClearFilters: () => void;
}

const ProductFilters = memo(({ 
  categories, 
  subCategories, 
  brands, 
  flavors, 
  selectedCategories, 
  selectedSubCategories, 
  selectedBrands, 
  selectedFlavors,
  initialSearch, 
  initialSort,
  onSearchChange,
  onCategoryChange,
  onSubCategoryChange,
  onBrandChange,
  onFlavorChange,
  onSortChange,
  onClearFilters 
}: ProductFiltersProps) => {
  const [searchValue, setSearchValue] = useState<string>(initialSearch || '');
  const [sortBy, setSortBy] = useState<string>(initialSort || 'created_at-desc');
  const [isMobile, setIsMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    subCategories: true,
    brands: true,
    flavors: true,
  });

  const toggleSection = (section: 'categories' | 'brands' | 'flavors' | 'subCategories' | 'subCategories') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleToggle = (
    value: string,
    selected: string[],
    onChange: (values: string[]) => void
  ) => {
    const newSelected = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
    onChange(newSelected);
  };

  const handleClearFilters = useCallback(() => {
    setSearchValue(initialSearch || '');
    setSortBy(initialSort || 'created_at-desc');
    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSelectedBrands([]);
    setSelectedFlavors([]);
    setIsMobileOpen(false);
  }, [searchValue, sortBy, selectedCategories, selectedSubCategories, selectedBrands, selectedFlavors, isMobile]);

  const FiltersContent = () => (
    <div className="flex flex-col h-full bg-stone-50 w-full">
      <div className="px-4 py-4 flex flex justify-between items-center border-b border-stone-200">
        <h2 className="font-bold text-stone-900 uppercase tracking-tight text-sm">Filtros</h2>
        
        <Button
          onClick={() => {
            handleClearFilters();
            setIsMobileOpen(false);
          }}
          variant="ghost"
          className="text-xs font-black uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors"
        >
          Limpar
        </Button>

        {isMobile ? (
          <Button variant="ghost" onClick={() => setIsMobileOpen(false)}>
            Fechar
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setIsMobileOpen(false)}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400 font-medium">Fechar</span>
            </Button>
        )}
      </div>

      {/* Search */}
      <div className="space-y-4 px-4">
        <div>
          <div className="relative">
            <Input 
              type="text" 
              placeholder="Buscar produtos..." 
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full h-11 pl-4 pr-10 rounded-full border-stone-200 text-stone-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
            />
            <Button size="icon" className="absolute right-0 top-1 text-slate-400">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sort */}
        <div>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value)}>
            <SelectTrigger className="w-full h-11 pl-4 pr-10 rounded-full border-stone-200 text-stone-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['created_at-desc', 'created_at-asc', 'price-asc', 'price-desc', 'name-asc', 'name-desc', 'name-desc'].map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          {/* Categories */}
          <FilterSection
            title="Categorias"
            items={categories}
            selected={selectedCategories}
            onToggle={() => handleToggle('categories', selectedCategories, onCategoryChange)}
            isExpanded={expandedSections.categories}
            onToggleExpand={() => toggleSection('categories')}
            maxVisible={8}
            isMobile={isMobile}
          >
            {selectedCategories.length > 0 ? (
              <div className="text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Categorias selecionadas</div>
            )}
          </FilterSection>

          {/* Sub-Categories */}
          <FilterSection
            title="Sub-Categorias"
            items={subCategories}
            selected={selectedSubCategories}
            onToggle={(value, selected, onChange) => handleToggle('subCategories', selectedSubCategories, onSubCategoryChange)}
            isExpanded={expandedSections.subCategories}
            onToggleExpand={() => toggleSection('subCategories')}
            maxVisible={10}
            isMobile={isMobile}
          >
            {selectedSubCategories.length > 0 ? (
              <div className="text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Sub-categorias selecionadas</div>
            )}
          </FilterSection>

          {/* Brands */}
          <FilterSection
            title="Marcas"
            items={brands}
            selected={selectedBrands}
            onToggle={(value, selected, onChange) => handleToggle('brands', selectedBrands, onBrandChange)}
            isExpanded={expandedSections.brands}
            onToggleExpand={() => toggleSection('brands')}
            maxVisible={8}
            isMobile={isMobile}
          >
            {selectedBrands.length > 0 ? (
              <div className="text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Marcas selecionadas</div>
            )}
          </FilterSection>

          {/* Flavors */}
          <FilterSection
            title="Sabores"
            items={flavors}
            selected={selectedFlavors}
            onToggle={(value, selected, onChange) => handleToggle('flavors', selectedFlavors, onFlavorChange)}
            isExpanded={expandedSections.flavors}
            onToggleExpand={() => toggleSection('flavors')}
            maxVisible={6}
            isMobile={isMobile}
          >
            {selectedFlavors.length > 0 ? (
              <div className="text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Sabores selecionados</div>
            )}
          </FilterSection>
        </div>

        {isMobile && (
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetContent className="w-[95vw] h-full px-6">
              <SheetHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xl font-black uppercase tracking-tighter italic text-stone-900">Filtros</div>
                  <SheetTitle>
                    Filtros
                  </SheetTitle>
                  <Button onClick={() => setIsMobileOpen(false)}>
                    <X className="h-6 w-6 text-stone-400" />
                  </Button>
                </div>
              </SheetHeader>
              
              <div className="overflow-y-auto pb-20 custom-scrollbar">
                <FiltersContent />
              </div>
            </SheetContent>
          </Sheet>
        )}
    </div>
  );
});

ProductFilters.displayName = 'ProductFilters';

export default ProductFilters;