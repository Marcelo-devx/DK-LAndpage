import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export async function fetchAssistantRanking(): Promise<Map<number, number>> {
  const { data, error } = await supabase.rpc('assistant_dk_product_ranking');
  if (error) throw error;
  if (!Array.isArray(data) || data.some(row => !Number.isFinite(Number(row.product_id)) || !Number.isFinite(Number(row.sales_rank)))) {
    throw new Error('Resposta de ranking inválida');
  }
  return new Map(data.map(row => [Number(row.product_id), Number(row.sales_rank)]));
}

export interface AssistantVariant {
  id: string;
  flavor_name: string | null;
  stock_quantity: number;
  volume_ml: number | null;
  color: string | null;
  size: string | null;
  ohms: string | null;
}

export interface AssistantProduct {
  id: number;
  name: string;
  category: string | null;
  sub_category: string | null;
  brand: string | null;
  description: string | null;
  image_url: string | null;
  stock_quantity: number;
  variants: AssistantVariant[];
  sub_categories: string[];
}

type RawAssistantProduct = Omit<AssistantProduct, 'variants' | 'sub_categories'> & {
  variants: Array<Omit<AssistantVariant, 'flavor_name'> & { is_active: boolean; flavor: { name: string } | null }>;
  sub_categories: Array<{ sub_category: { name: string; is_visible: boolean } | null }>;
};

export function useAssistantProducts() {
  return useQuery({
    queryKey: ['assistant-dk-products-with-variants-and-categories'],
    staleTime: 30_000,
    queryFn: async (): Promise<AssistantProduct[]> => {
      const products: AssistantProduct[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, category, sub_category, brand, description, image_url, stock_quantity, variants:product_variants(id, is_active, stock_quantity, volume_ml, color, size, ohms, flavor:flavors(name)), sub_categories:product_sub_categories(sub_category:sub_categories(name, is_visible))')
          .eq('is_visible', true)
          .order('id')
          .range(offset, offset + 499)
          .returns<RawAssistantProduct[]>();
        if (error) throw error;
        for (const product of data ?? []) {
          const variants = (product.variants ?? []).filter(variant => variant.is_active).map(variant => ({
            id: variant.id,
            stock_quantity: variant.stock_quantity,
            volume_ml: variant.volume_ml,
            color: variant.color,
            size: variant.size,
            ohms: variant.ohms,
            flavor_name: variant.flavor?.name ?? null,
          }));
          const sub_categories = (product.sub_categories ?? []).flatMap(row => row.sub_category?.is_visible ? [row.sub_category.name] : []);
          products.push({ ...product, variants, sub_categories });
        }
        if (!data || data.length < 500) break;
      }
      return products.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}
