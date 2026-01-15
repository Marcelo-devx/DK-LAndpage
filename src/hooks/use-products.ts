import { useState, useEffect } from 'react';
import { Product } from '@/types/product';
import { apiClient } from '@/services/api-client';

export function useProducts(filters: any = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await apiClient.products.list(filters);
      setProducts(data);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [JSON.stringify(filters)]);

  return { products, loading, error, refresh: fetchProducts };
}