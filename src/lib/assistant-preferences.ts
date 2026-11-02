import type { AssistantFlavorOption } from '@/components/AssistantFlavorResults';
import { normalize, safeText } from './product-assistant';

export const liquidType = 'Juices / Líquidos';
export const disposableType = 'Pods descartáveis';

export function flavorType({ product }: AssistantFlavorOption): string {
  const category = normalize(product.category || '').trim();
  if (category.startsWith('juice')) return liquidType;
  if (category.includes('descartave')) return disposableType;
  return product.category && safeText(product.category) ? product.category.trim() : 'Outros produtos';
}

export function requestedFlavorType(text: string): string | undefined {
  const normalized = normalize(text);
  const liquids = /\b(juice\w*|liquido\w*|freebase|nicsalt)\b/.test(normalized);
  const disposables = /\b(descartave\w*|disposable\w*)\b/.test(normalized);
  if (liquids === disposables) return undefined;
  return liquids ? liquidType : disposableType;
}
