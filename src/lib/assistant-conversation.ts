import type { AssistantProduct } from '@/hooks/use-assistant-products';
import type { AssistantPreference } from '@/components/AssistantPreferencePrompt';
import type { AssistantFlavorOption } from '@/components/AssistantFlavorResults';
import { flavorBrand } from '@/components/AssistantFlavorResults';
import { flavorType, requestedFlavorType } from './assistant-preferences';
import { normalize, parseProductQuestion, safeText } from './product-assistant';

export interface AssistantLink {
  label: string;
  href: string;
}

export const referencesPrevious = (text: string) => /\b(esse\w*|essa\w*|desse\w*|dessa\w*|deste\w*|desta\w*|dele\w*|dela\w*|este\w*|esta\w*|mesmo\w*)\b/.test(normalize(text));

export function navigationRequest(text: string, products: AssistantProduct[], previous: AssistantProduct[]) {
  const normalized = normalize(text);
  const category = /\b((?:sub)?categorias?)\b/.test(normalized);
  const navigation = /\b(link\w*|pagina\w*|site|visitar|abrir|abra)\b/.test(normalized);
  if (!navigation && !category) return null;
  const global = parseProductQuestion(text, products);
  const contextual = parseProductQuestion(text, previous);
  const scope = (referencesPrevious(text) || !global.hasTerms) && contextual.matches.length ? contextual.matches : global.hasTerms ? global.matches : [];
  return { category, scope };
}

export function categoryLinks(products: AssistantProduct[]): AssistantLink[] {
  const links = new Map<string, AssistantLink>();
  for (const product of products) {
    const category = product.category && safeText(product.category) ? product.category : null;
    const subcategories = [...new Set([product.sub_category, ...product.sub_categories].filter((name): name is string => !!name && safeText(name)))];
    for (const subcategory of subcategories.length ? subcategories : [null]) {
      if (!category && !subcategory) continue;
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (subcategory) params.set('sub_category', subcategory);
      const href = `/produtos?${params.toString()}`;
      links.set(href, { label: `Ver ${subcategory || category}`, href });
    }
  }
  return [...links.values()];
}

export function isPreferenceReply(text: string, stage: AssistantPreference['stage'], options: AssistantFlavorOption[]): boolean {
  const normalized = normalize(text).trim().replace(/[!.?]+$/, '').trim();
  if (/^(sem preferencia|tanto faz|qualquer(?: volume| marca| um| uma)?|nao tenho preferencia)$/.test(normalized)) return true;
  const short = normalized.replace(/^(?:(?:quero|prefiro|pode ser)(?: a| o| um| uma)?(?: marca| volume)?\s+)/, '').trim();
  if (stage === 'volume') return /^\d+(?:[.,]\d+)?\s*(?:ml)?$/.test(short);
  if (stage === 'type') {
    const type = requestedFlavorType(short);
    return options.some(option => normalize(flavorType(option)) === short)
      || (!!type && /^(juice\w*|liquido\w*|(?:pod\w*\s+)?descartave\w*|disposable\w*|freebase|nicsalt)$/.test(short));
  }
  return short.length > 1 && options.some(option => normalize(flavorBrand(option.product)).includes(short));
}

export function isNewProductRequest(text: string, products: AssistantProduct[]): boolean {
  const parsed = parseProductQuestion(text, products);
  return parsed.hasTerms && (parsed.matches.length > 0 || /\b(quero|procuro|busco|buscar|mostre|mostrar|trocar|troque|agora|sabor)\b/.test(normalize(text)));
}
