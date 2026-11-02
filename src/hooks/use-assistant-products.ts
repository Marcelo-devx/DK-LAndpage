import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssistantProduct {
  id: number;
  name: string;
  category: string | null;
  sub_category: string | null;
  brand: string | null;
  description: string | null;
}

export function useAssistantProducts() {
  return useQuery({
    queryKey: ['assistant-dk-products'],
    queryFn: async (): Promise<AssistantProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, sub_category, brand, description')
        .eq('is_visible', true)
        .gt('stock_quantity', 0)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}
