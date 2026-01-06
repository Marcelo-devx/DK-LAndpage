const LOCAL_CART_KEY = 'tabacaria.cart';

export type ItemType = 'product' | 'promotion';

export interface LocalCartItem {
  itemId: number;
  itemType: ItemType;
  quantity: number;
  variantId?: string; // ID da variação selecionada
}

export const getLocalCart = (): LocalCartItem[] => {
  const cartJson = localStorage.getItem(LOCAL_CART_KEY);
  return cartJson ? JSON.parse(cartJson) : [];
};

export const getCartTotalItems = (): number => {
  const cart = getLocalCart();
  return cart.reduce((acc, item) => acc + item.quantity, 0);
};

const saveLocalCart = (cart: LocalCartItem[]) => {
  localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(cart));
};

export const addToLocalCart = (itemId: number, quantity: number = 1, itemType: ItemType = 'product', variantId?: string) => {
  const cart = getLocalCart();
  // Busca por item com o mesmo ID, Tipo e Variação
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
};