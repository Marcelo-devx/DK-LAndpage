import { showSuccess, showError } from './toast';
import { addToLocalCart, ItemType, getLocalCart } from './localCart';
import { supabase } from '@/integrations/supabase/client';

/**
 * Adiciona um item ao carrinho após verificar o estoque no banco de dados.
 */
export async function addToCart(itemId: number, quantity: number = 1, itemType: ItemType = 'product', variantId?: string) {
  // 1. Check for user session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showError("Você precisa estar logado para adicionar itens ao carrinho.");
    // Dispatch an event to trigger navigation from a component
    window.dispatchEvent(new CustomEvent('authRequired', { detail: { from: window.location.pathname } }));
    return;
  }
  
  let stock = 0;
  
  // 2. Busca o estoque real no banco de dados
  if (itemType === 'product') {
    if (variantId) {
      const { data } = await supabase.from('product_variants').select('stock_quantity').eq('id', variantId).single();
      stock = data?.stock_quantity || 0;
    } else {
      const { data } = await supabase.from('products').select('stock_quantity').eq('id', itemId).single();
      stock = data?.stock_quantity || 0;
    }
  } else {
    const { data } = await supabase.from('promotions').select('stock_quantity').eq('id', itemId).single();
    stock = data?.stock_quantity || 0;
  }

  // 3. Verifica quanto o usuário já tem no carrinho local
  const localCart = getLocalCart();
  const existing = localCart.find(i => i.itemId === itemId && i.itemType === itemType && i.variantId === variantId);
  const totalWanted = (existing?.quantity || 0) + quantity;

  // 4. Valida se o total solicitado ultrapassa o estoque
  if (totalWanted > stock) {
    showError(`Estoque insuficiente. Temos apenas ${stock} unidades disponíveis.`);
    return;
  }

  // 5. Se estiver tudo OK, adiciona e avisa
  addToLocalCart(itemId, quantity, itemType, variantId);
  showSuccess('Item adicionado ao carrinho!');
  window.dispatchEvent(new CustomEvent('cartUpdated'));
}