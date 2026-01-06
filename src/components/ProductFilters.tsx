import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Filter, Search, X } from "lucide-react";

interface ProductFiltersProps {
  categories: string[];
  subCategories: string[];
  brands: string[];
  flavors: string[];
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

const ProductFilters = (props: ProductFiltersProps) => {
  const {
    categories,
    subCategories,
    brands,
    flavors,
    selectedCategories,
    selectedSubCategories,
    selectedBrands,
    selectedFlavors,
    onSearchChange,
    onCategoryChange,
    onSubCategoryChange,
    onBrandChange,
    onFlavorChange,
    onSortChange,
    onClearFilters,
  } = props;
  const isMobile = useIsMobile();
  const [showAllFlavors, setShowAllFlavors] = useState(false);

  const handleCategoryToggle = (category: string) => {
    const newSelection = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];
    onCategoryChange(newSelection);
  };

  const handleSubCategoryToggle = (subCategory: string) => {
    const newSelection = selectedSubCategories.includes(subCategory)
      ? selectedSubCategories.filter((sc) => sc !== subCategory)
      : [...selectedSubCategories, subCategory];
    onSubCategoryChange(newSelection);
  };

  const handleBrandToggle = (brand: string) => {
    const newSelection = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];
    onBrandChange(newSelection);
  };

  const handleFlavorToggle = (flavor: string) => {
    const newSelection = selectedFlavors.includes(flavor)
      ? selectedFlavors.filter((f) => f !== flavor)
      : [...selectedFlavors, flavor];
    onFlavorChange(newSelection);
  };

  const hasActiveFilters = selectedCategories.length > 0 || selectedSubCategories.length > 0 || selectedBrands.length > 0 || selectedFlavors.length > 0;
  const displayedFlavors = showAllFlavors ? flavors : flavors.slice(0, 5);

  const FiltersContent = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="search">Buscar Produto</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Nome do produto..."
            className="pl-10"
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ordenar por</Label>
        <Select onValueChange={onSortChange} defaultValue="created_at-desc">
          <SelectTrigger>
            <SelectValue placeholder="Selecione a ordem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at-desc">Mais Recentes</SelectItem>
            <SelectItem value="price-asc">Preço: Menor para Maior</SelectItem>
            <SelectItem value="price-desc">Preço: Maior para Menor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Accordion type="multiple" defaultValue={["categories", "sub-categories", "brands", "flavors"]} className="w-full">
        <AccordionItem value="categories">
          <AccordionTrigger className="font-serif text-lg">Categorias</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {categories.map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={`cat-${category}`}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() => handleCategoryToggle(category)}
                />
                <Label htmlFor={`cat-${category}`} className="font-normal cursor-pointer">{category}</Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="sub-categories">
          <AccordionTrigger className="font-serif text-lg">Sub-Categorias</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {subCategories.map((subCategory) => (
              <div key={subCategory} className="flex items-center space-x-2">
                <Checkbox
                  id={`subcat-${subCategory}`}
                  checked={selectedSubCategories.includes(subCategory)}
                  onCheckedChange={() => handleSubCategoryToggle(subCategory)}
                />
                <Label htmlFor={`subcat-${subCategory}`} className="font-normal cursor-pointer">{subCategory}</Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="brands">
          <AccordionTrigger className="font-serif text-lg">Marcas</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {brands.map((brand) => (
              <div key={brand} className="flex items-center space-x-2">
                <Checkbox
                  id={`brand-${brand}`}
                  checked={selectedBrands.includes(brand)}
                  onCheckedChange={() => handleBrandToggle(brand)}
                />
                <Label htmlFor={`brand-${brand}`} className="font-normal cursor-pointer">{brand}</Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="flavors">
          <AccordionTrigger className="font-serif text-lg">Sabores</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {displayedFlavors.map((flavor) => (
              <div key={flavor} className="flex items-center space-x-2">
                <Checkbox
                  id={`flavor-${flavor}`}
                  checked={selectedFlavors.includes(flavor)}
                  onCheckedChange={() => handleFlavorToggle(flavor)}
                />
                <Label htmlFor={`flavor-${flavor}`} className="font-normal cursor-pointer">{flavor}</Label>
              </div>
            ))}
            {flavors.length > 5 && (
              <Button
                variant="link"
                className="p-0 h-auto text-gold-accent"
                onClick={() => setShowAllFlavors(!showAllFlavors)}
              >
                {showAllFlavors ? 'Ver menos' : `Ver mais ${flavors.length - 5}`}
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {hasActiveFilters && (
        <Button variant="ghost" onClick={onClearFilters} className="w-full text-destructive hover:text-destructive">
          <X className="mr-2 h-4 w-4" />
          Limpar Filtros
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full">
            <Filter className="mr-2 h-4 w-4" />
            Filtros e Ordenação
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-off-white">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl text-charcoal-gray">Filtros</SheetTitle>
          </SheetHeader>
          <div className="py-6">
            <FiltersContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="sticky top-24 h-fit">
      <h2 className="font-serif text-2xl text-charcoal-gray mb-4">Filtros</h2>
      <FiltersContent />
    </aside>
  );
};

export default ProductFilters;