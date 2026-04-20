import { useState } from 'react';
import { addToCart } from '@/utils/cart';
import { ItemType } from '@/utils/localCart';

// ⚠️ TRAVA DE BAIRRO REMOVIDA TEMPORARIAMENTE
// Antes, este hook consultava a tabela `shipping_rates` com `ilike` simples
// para bloquear clientes cujo bairro não estivesse cadastrado. Isso estava
// rejeitando indevidamente muitos clientes com cadastro correto (diferenças
// de acento, abreviação, etc.). A validação de frete já é feita no checkout
// com fuzzy match + fallback por CEP + aviso "frete a confirmar pelo atendimento".
// TODO: reimplementar com critérios mais robustos se necessário.

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
