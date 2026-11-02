import type { AssistantProduct } from '@/hooks/use-assistant-products';

export function parsePurchaseBudget(text: string) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const amount = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:[.,]\\d{1,2})?';
  const pattern = new RegExp(`(?:\\b(?:tenho|ate|orcamento(?: de)?|no maximo|posso gastar|gastar)\\s+(?:r\\$\\s*)?(${amount})(?:\\s*reais)?\\b|r\\$\\s*(${amount})\\b|\\b(${amount})\\s*reais\\b)`, 'g');
  let maxPrice: number | null = null;
  const query = normalized.replace(pattern, (_match, first: string, second: string, third: string) => {
    const raw = first || second || third;
    const value = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw);
    if (Number.isFinite(value) && value >= 0) maxPrice = maxPrice === null ? value : Math.min(maxPrice, value);
    return ' ';
  });
  const cleaned = maxPrice === null ? query : query.replace(/\b(?:orcamento|gastar|ate|reais|preco|valor|no maximo|posso|consigo|meu|so|apenas)\b/g, '');
  return { maxPrice, query: cleaned.replace(/\s+/g, ' ').trim() };
}

export const withinBudget = (price: number | null, maxPrice: number) => price !== null && Number.isFinite(price) && price >= 0 && Math.round(price * 100) <= Math.round(maxPrice * 100);
export const formatAssistantPrice = (price: number) => price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const assistantProductPrice = (product: AssistantProduct): number | null => {
  const prices = product.variants.length ? product.variants.map(variant => variant.price).filter((price): price is number => price !== null && Number.isFinite(price)) : [];
  return product.variants.length ? prices.length ? Math.min(...prices) : null : product.price;
};
