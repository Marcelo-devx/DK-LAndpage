import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AssistantProduct } from '@/hooks/use-assistant-products';
import { productAvailable } from '@/lib/product-assistant';
import { assistantProductPrice, formatAssistantPrice } from '@/lib/assistant-budget';
import { assistantOutline } from './AssistantProductOptions';

export default function AssistantProductResults({ products, busy, onChoose, showPrices = false }: {
  products: AssistantProduct[];
  busy: boolean;
  onChoose: (product: AssistantProduct) => void;
  showPrices?: boolean;
}) {
  const [page, setPage] = useState(0);
  const start = page * 3;
  return (
    <div className="mt-2">
      {products.slice(start, start + 3).map(product => (
        <Button key={product.id} disabled={busy} variant="outline" className={`mt-2 h-auto w-full justify-start whitespace-normal text-left ${assistantOutline}`} onClick={() => onChoose(product)}>
          <span>{product.name}{!productAvailable(product) ? ' · Esgotado' : ''}{showPrices && assistantProductPrice(product) !== null && <span className="mt-1 block text-xs text-slate-600">Preço do catálogo: {formatAssistantPrice(assistantProductPrice(product)!)}</span>}</span>
        </Button>
      ))}
      {products.length > 3 && <div className="mt-3 space-y-2">
        <p className="text-xs text-slate-500">{start + 1}–{Math.min(start + 3, products.length)} de {products.length} produtos</p>
        <div className="flex gap-2">
          {page > 0 && <Button size="sm" variant="outline" className={assistantOutline} disabled={busy} onClick={() => setPage(page - 1)}>Anteriores</Button>}
          {start + 3 < products.length && <Button size="sm" variant="outline" className={assistantOutline} disabled={busy} onClick={() => setPage(page + 1)}>Ver mais opções</Button>}
        </div>
      </div>}
    </div>
  );
}
