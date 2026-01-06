import { showSuccess } from './toast';
import { addToLocalCart, ItemType } from './localCart';

/**
 * Adiciona um item (produto ou promoção) ao carrinho local.
 * @param itemId - O ID do produto ou promoção.
 * @param quantity - A quantidade a ser adicionada.
 * @param itemType - O tipo de item ('product' ou 'promotion').
 * @param variantId - (Opcional) O ID da variação selecionada.
 */
export function addToCart(itemId: number, quantity: number = 1, itemType: ItemType = 'product', variantId?: string) {
  addToLocalCart(itemId, quantity, itemType, variantId);
  showSuccess('Item adicionado ao carrinho!');
  window.dispatchEvent(new CustomEvent('cartUpdated'));
}