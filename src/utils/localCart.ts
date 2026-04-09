import { logger } from '@/lib/logger';

const LOCAL_CART_KEY = 'dkcwb.cart';
const CART_TIME_KEY = 'dkcwb.cart_time';
const LEGACY_CART_KEY = 'tabacaria.cart'; // Chave antiga para migração suave
const LEGACY_CART_TIME_KEY = 'tabacaria.cart_time';

export type ItemType = 'product' | 'promotion';

export interface LocalCartItem {
  itemId: number;
  itemType: ItemType;
  quantity: number;
  variantId?: string;
}

/**
 * Tenta migrar dados da chave antiga para a nova (one-time migration)
 */
const migrateLegacyCart = (): LocalCartItem[] => {
  try {
    const legacyCartJson = localStorage.getItem(LEGACY_CART_KEY);
    if (!legacyCartJson || legacyCartJson === "undefined") return [];

    const parsed = JSON.parse(legacyCartJson);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // Migrar para a nova chave
    localStorage.setItem(LOCAL_CART_KEY, legacyCartJson);

    // Migrar o timestamp se existir
    const legacyTime = localStorage.getItem(LEGACY_CART_TIME_KEY);
    if (legacyTime) {
      localStorage.setItem(CART_TIME_KEY, legacyTime);
      localStorage.removeItem(LEGACY_CART_TIME_KEY);
    }

    // Remover a chave antiga
    localStorage.removeItem(LEGACY_CART_KEY);

    return parsed;
  } catch (error) {
    // Em caso de erro, remover a chave antiga corrompida e retornar vazio
    localStorage.removeItem(LEGACY_CART_KEY);
    return [];
  }
};

export const getLocalCart = (): LocalCartItem[] => {
  try {
    // Tenta ler da nova chave
    let cartJson = localStorage.getItem(LOCAL_CART_KEY);

    // Se não existir na nova chave, tenta migrar da antiga
    if (!cartJson || cartJson === "undefined") {
      const migrated = migrateLegacyCart();
      if (migrated.length > 0) return migrated;
      return [];
    }

    const parsed = JSON.parse(cartJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error("Erro ao ler carrinho local, resetando dados corrompidos:", error);
    localStorage.removeItem(LOCAL_CART_KEY);
    return [];
  }
};

export const getCartCreatedAt = (): string | null => {
  return localStorage.getItem(CART_TIME_KEY);
};

export const getCartTotalItems = (): number => {
  const cart = getLocalCart();
  return cart.reduce((acc, item) => acc + item.quantity, 0);
};

const saveLocalCart = (cart: LocalCartItem[]) => {
  try {
    localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(cart));
    
    // Se o carrinho foi zerado, removemos o tempo
    if (cart.length === 0) {
      localStorage.removeItem(CART_TIME_KEY);
    } else if (!localStorage.getItem(CART_TIME_KEY)) {
      // Se é o primeiro item, marcamos o início
      localStorage.setItem(CART_TIME_KEY, new Date().toISOString());
    }

    // Notify other parts of the app that the cart changed
    try { window.dispatchEvent(new CustomEvent('cartUpdated')); } catch (e) { /* noop */ }
  } catch (error) {
    logger.error("Erro ao salvar carrinho:", error);
  }
};

export const addToLocalCart = (itemId: number, quantity: number = 1, itemType: ItemType = 'product', variantId?: string) => {
  const cart = getLocalCart();
  const existingItemIndex = cart.findIndex(item => 
    item.itemId === itemId && 
    item.itemType === itemType && 
    item.variantId === variantId
  );

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += quantity;
  } else {
    cart.push({ itemId, quantity, itemType, variantId });
  }
  saveLocalCart(cart);
};

export const updateLocalCartItemQuantity = (itemId: number, itemType: ItemType, newQuantity: number, variantId?: string) => {
  let cart = getLocalCart();
  const existingItemIndex = cart.findIndex(item => 
    item.itemId === itemId && 
    item.itemType === itemType && 
    item.variantId === variantId
  );

  if (existingItemIndex > -1) {
    if (newQuantity > 0) {
      cart[existingItemIndex].quantity = newQuantity;
    } else {
      cart = cart.filter(item => !(item.itemId === itemId && item.itemType === itemType && item.variantId === variantId));
    }
    saveLocalCart(cart);
  }
};

export const removeFromLocalCart = (itemId: number, itemType: ItemType, variantId?: string) => {
  const cart = getLocalCart().filter(item => 
    !(item.itemId === itemId && item.itemType === itemType && item.variantId === variantId)
  );
  saveLocalCart(cart);
};

export const clearLocalCart = () => {
  localStorage.removeItem(LOCAL_CART_KEY);
  localStorage.removeItem(CART_TIME_KEY);
  try { window.dispatchEvent(new CustomEvent('cartUpdated')); } catch (e) { /* noop */ }
};