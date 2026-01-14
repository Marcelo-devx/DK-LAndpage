const LOCAL_CART_KEY = 'tabacaria.cart';
const CART_TIME_KEY = 'tabacaria.cart_time';

export type ItemType = 'product' | 'promotion';

export interface LocalCartItem {
  itemId: number;
  itemType: ItemType;
  quantity: number;
  variantId?: string;
}

export const getLocalCart = (): LocalCartItem[] => {
  try {
    const cartJson = localStorage.getItem(LOCAL_CART_KEY);
    // Verifica se é "undefined" string ou null ou vazio
    if (!cartJson || cartJson === "undefined") return [];
    
    const parsed = JSON.parse(cartJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler carrinho local, resetando dados corrompidos:", error);
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
  } catch (error) {
    console.error("Erro ao salvar carrinho:", error);
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
};