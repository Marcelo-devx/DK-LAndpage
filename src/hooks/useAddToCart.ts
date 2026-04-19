import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addToCart } from '@/utils/cart';
import { ItemType } from '@/utils/localCart';

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
        // addToCart já trata esse caso (dispara authRequired)
        await addToCart(itemId, quantity, itemType, variantId);
        return;
      }

      // 2. Busca o bairro do perfil do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('neighborhood')
        .eq('id', session.user.id)
        .single();

      const neighborhood = profile?.neighborhood?.trim();

      // 3. Se não tem bairro cadastrado, deixa passar (não bloqueia)
      if (!neighborhood) {
        await addToCart(itemId, quantity, itemType, variantId);
        return;
      }

      // 4. Verifica se o bairro está na tabela de frete (case-insensitive)
      const { data: shippingRate } = await supabase
        .from('shipping_rates')
        .select('id')
        .ilike('neighborhood', neighborhood)
        .eq('is_active', true)
        .maybeSingle();

      // 5. Bairro NÃO encontrado → dispara evento global para abrir o modal
      if (!shippingRate) {
        window.dispatchEvent(
          new CustomEvent('neighborhoodBlocked', { detail: { neighborhood } })
        );
        return;
      }

      // 6. Bairro OK → adiciona normalmente
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
