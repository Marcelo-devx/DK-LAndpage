import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addToCart } from '@/utils/cart';
import { ItemType } from '@/utils/localCart';

const TIMEOUT_MS = 10000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);

export const useAddToCart = () => {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async (
    itemId: number,
    quantity: number = 1,
    itemType: ItemType = 'product',
    variantId?: string
  ) => {
    setIsAdding(true);

    try {
      // 1. Verifica sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await addToCart(itemId, quantity, itemType, variantId);
        return;
      }

      // 2. Busca o bairro do perfil (com timeout de segurança)
      const profileRes = await withTimeout(
        supabase.from('profiles').select('neighborhood').eq('id', session.user.id).single() as unknown as Promise<{ data: { neighborhood: string | null } | null }>,
        TIMEOUT_MS
      );
      const neighborhood = profileRes.data?.neighborhood?.trim();

      // 3. Se não tem bairro cadastrado, deixa passar
      if (!neighborhood) {
        await addToCart(itemId, quantity, itemType, variantId);
        return;
      }

      // 4. Verifica se o bairro está na tabela de frete (com timeout de segurança)
      const shippingRes = await withTimeout(
        supabase.from('shipping_rates').select('id').ilike('neighborhood', neighborhood).eq('is_active', true).maybeSingle() as unknown as Promise<{ data: { id: number } | null }>,
        TIMEOUT_MS
      );

      // 5. Bairro NÃO encontrado → abre modal de aviso
      if (!shippingRes.data) {
        window.dispatchEvent(
          new CustomEvent('neighborhoodBlocked', { detail: { neighborhood } })
        );
        return;
      }

      // 6. Bairro OK → adiciona normalmente
      await addToCart(itemId, quantity, itemType, variantId);

    } catch (err: any) {
      // Em caso de timeout ou erro de rede, deixa adicionar normalmente
      // para não bloquear a experiência do usuário
      await addToCart(itemId, quantity, itemType, variantId);
    } finally {
      setIsAdding(false);
    }
  };

  return {
    handleAddToCart,
    isAdding,
  };
};