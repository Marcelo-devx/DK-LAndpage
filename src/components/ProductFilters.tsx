import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Filter, Search, X, ChevronDown, ChevronUp, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionItem {
  name: string;
  count: number;
}

interface ProductFiltersProps {
  categories: OptionItem[];
  subCategories: OptionItem[];
  brands: OptionItem[];
  flavors: OptionItem[];
  selectedCategories: string[];
  selectedSubCategories: string[];
  selectedBrands: string[];
  selectedFlavors: string[];
  onSearchChange: (term: string) => void;
  onCategoryChange: (categories: string[]) => void;
  onSubCategoryChange: (subCategories: string[]) => void;
  onBrandChange: (brands: string[]) => void;
  onFlavorChange: (flavors: string[]) => void;
  onSortChange: (sort: string) => void;
  onClearFilters: () => void;
}

const SORT_OPTIONS = [
  { value: 'created_at-desc', label: 'Mais Recentes' },
  { value: 'price-asc', label: 'Menor Preço' },
  { value: 'price-desc', label: 'Maior Preço' },
];

const FilterSection = ({
  title,
  items,
  selected,
  onToggle,
  maxVisible = 6,
}: {
  title: string;
  items: OptionItem[];
  selected: string[];
  onToggle: (item: string) => void;
  maxVisible?: number;
}) => {
  const [expanded, setExpanded] = useState(false);

  // Only consider items that have count > 0
  const availableItems = items.filter(i => i.count > 0);

  const visible = expanded ? availableItems : availableItems.slice(0, maxVisible);
  const hasMore = availableItems.length > maxVisible;

  if (availableItems.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 flex items-center gap-1.5">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((item) => {
          const active = selected.includes(item.name);
          return (
            <button
              key={item.name}
              onClick={() => onToggle(item.name)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all duration-200 border",
                active
                  ? "bg-sky-500 text-white border-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.4)]"
                  : "bg-white text-stone-600 border-stone-200 hover:border-sky-300 hover:text-sky-600"
              )}
            >
              <span className="mr-2">{item.name}</span>
              <span className="text-[10px] font-black text-slate-600">({item.count})</span>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-sky-500 hover:text-sky-400 transition-colors mt-1"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Ver menos</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> +{availableItems.length - maxVisible} mais</>
          )}
        </button>
      )}
    </div>
  );
};

const ProductFilters = (props: ProductFiltersProps) => {
  const {
    categories, subCategories, brands, flavors,
    selectedCategories, selectedSubCategories, selectedBrands, selectedFlavors,
    onSearchChange, onCategoryChange, onSubCategoryChange, onBrandChange, onFlavorChange,
    onSortChange, onClearFilters,
  } = props;

  const isMobile = useIsMobile();
  const [activeSort, setActiveSort] = useState('created_at-desc');
  const [searchValue, setSearchValue] = useState('');

  const totalActive =
    selectedCategories.length + selectedSubCategories.length +
    selectedBrands.length + selectedFlavors.length;

  const handleSortChange = (val: string) => {
    setActiveSort(val);
    onSortChange(val);
  };

  const handleSearchChange = (val: string) => {
    setSearchValue(val);
    onSearchChange(val);
  };

  const handleClearAll = () => {
    setSearchValue('');
    setActiveSort('created_at-desc');
    onClearFilters();
  };

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="Buscar produto..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 h-11 rounded-xl border-stone-200 bg-white text-sm font-medium focus:border-sky-400 focus:ring-sky-400/20"
        />
        {searchValue && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 flex items-center gap-1.5">
          <ArrowUpDown className="h-3 w-3" /> Ordenar
        </p>
        <div className="flex flex-col gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 border",
                activeSort === opt.value
                  ? "bg-slate-950 text-white border-slate-800"
                  : "bg-white text-stone-600 border-stone-200 hover:border-slate-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-stone-100" />

      {/* Filter sections */}
      <FilterSection
        title="Categorias"
        items={categories}
        selected={selectedCategories}
        onToggle={(item) => {
          const next = selectedCategories.includes(item)
            ? selectedCategories.filter(c => c !== item)
            : [...selectedCategories, item];
          onCategoryChange(next);
        }}
      />

      <FilterSection
        title="Sub-Categorias"
        items={subCategories}
        selected={selectedSubCategories}
        onToggle={(item) => {
          const next = selectedSubCategories.includes(item)
            ? selectedSubCategories.filter(c => c !== item)
            : [...selectedSubCategories, item];
          onSubCategoryChange(next);
        }}
      />

      <FilterSection
        title="Marcas"
        items={brands}
        selected={selectedBrands}
        onToggle={(item) => {
          const next = selectedBrands.includes(item)
            ? selectedBrands.filter(b => b !== item)
            : [...selectedBrands, item];
          onBrandChange(next);
        }}
      />

      <FilterSection
        title="Sabores"
        items={flavors}
        selected={selectedFlavors}
        onToggle={(item) => {
          const next = selectedFlavors.includes(item)
            ? selectedFlavors.filter(f => f !== item)
            : [...selectedFlavors, item];
          onFlavorChange(next);
        }}
        maxVisible={8}
      />

      {/* Clear */}
      {totalActive > 0 && (
        <button
          onClick={handleClearAll}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Limpar {totalActive} filtro{totalActive > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl border-stone-200 font-black uppercase tracking-widest text-xs gap-2 relative"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros e Ordenação
            {totalActive > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-sky-500 text-white text-[9px] font-black rounded-full h-5 w-5 flex items-center justify-center">
                {totalActive}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-stone-50 w-[320px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-black text-xl uppercase tracking-tighter italic text-charcoal-gray">
              Filtros
            </SheetTitle>
          </SheetHeader>
          <FiltersContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="sticky top-24 h-fit bg-stone-50 rounded-3xl p-6 border border-stone-100" style={{ maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-black text-lg uppercase tracking-tighter italic text-charcoal-gray flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-sky-500" />
          Filtros
        </h2>
        {totalActive > 0 && (
          <Badge className="bg-sky-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
            {totalActive}
          </Badge>
        )}
      </div>
      <FiltersContent />
    </aside>
  );
};

export default ProductFilters;