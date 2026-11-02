import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AssistantProduct, AssistantVariant } from '@/hooks/use-assistant-products';
import { safeText, variantLabel } from '@/lib/product-assistant';
import AssistantProductOptions, { assistantOutline } from './AssistantProductOptions';

export interface AssistantFlavorOption {
  product: AssistantProduct;
  variant: AssistantVariant;
}

export const flavorBrand = (product: AssistantProduct) => product.brand && safeText(product.brand) ? product.brand : 'Marca não informada';

interface Props {
  options: AssistantFlavorOption[];
  busy: boolean;
  onDetails: (product: AssistantProduct, variant?: AssistantVariant) => void;
  onVisit: () => void;
}

export default function AssistantFlavorResults({ options, busy, onDetails, onVisit }: Props) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const groups = new Map<string, AssistantFlavorOption[]>();
  for (const option of options) {
    const brand = flavorBrand(option.product);
    groups.set(brand, [...(groups.get(brand) || []), option]);
  }

  return (
    <div className="mt-4 space-y-4">
      {[...groups].map(([brand, items]) => {
        const ordered = [...items].sort((a, b) => Number(b.variant.stock_quantity > 0) - Number(a.variant.stock_quantity > 0) || a.product.name.localeCompare(b.product.name) || variantLabel(a.variant).localeCompare(variantLabel(b.variant)));
        const shown = expanded.includes(brand) ? ordered : ordered.slice(0, 3);
        return <section key={brand} aria-label={`Opções de ${brand}`}>
          <h3 className="mb-2 text-sm font-semibold text-sky-900">{brand} <span className="font-normal text-slate-500">· {items.length} {items.length === 1 ? 'opção' : 'opções'}</span></h3>
          <div className="space-y-2">
            {shown.map(({ product, variant }) => <div key={variant.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">{product.name}</p>
              <p className="mt-1 text-sm text-slate-700"><strong>Sabor:</strong> {variantLabel(variant)}</p>
              <p className={`mt-1 text-xs font-medium ${variant.stock_quantity > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{variant.stock_quantity > 0 ? 'Disponível em estoque' : 'Esgotado · Você pode pedir um aviso'}</p>
              <AssistantProductOptions compact product={product} initialVariantId={variant.id} busy={busy} onDetails={onDetails} onVisit={onVisit} />
            </div>)}
          </div>
          {shown.length < items.length && <Button disabled={busy} size="sm" variant="outline" className={`mt-2 h-auto whitespace-normal ${assistantOutline}`} onClick={() => setExpanded(previous => [...previous, brand])}>Ver mais {items.length - shown.length} opções de {brand}</Button>}
        </section>;
      })}
    </div>
  );
}
