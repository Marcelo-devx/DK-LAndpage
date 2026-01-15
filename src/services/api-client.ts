import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/product";

/**
 * API Gateway Client
 * Abstrai o acesso ao banco de dados e regras de negócio.
 */
export const apiClient = {
  products: {
    list: async (filters: any): Promise<Product[]> => {
      // Nota de CTO: Em produção, isto chamaria uma Edge Function em vez de .from()
      // para garantir que a regra de negócio/filtragem aconteça no server-side.
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_visible', true)
        .gt('stock_quantity', 0);

      if (filters.category) query = query.in('category', filters.categories);
      if (filters.search) query = query.ilike('name', `%${filters.search}%`);

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw new Error(error.message);
      
      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        pixPrice: p.pix_price,
        imageUrl: p.image_url || '',
        category: p.category,
        subCategory: p.sub_category,
        brand: p.brand,
        description: p.description,
        stockQuantity: p.stock_quantity
      }));
    },
    
    getById: async (id: string): Promise<Product | null> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return null;
      return {
        id: data.id,
        name: data.name,
        price: data.price,
        pixPrice: data.pix_price,
        imageUrl: data.image_url || '',
        category: data.category,
        subCategory: data.sub_category,
        brand: data.brand,
        description: data.description,
        stockQuantity: data.stock_quantity
      };
    }
  }
};