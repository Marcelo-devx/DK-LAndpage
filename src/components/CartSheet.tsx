import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from './ui/skeleton';
import { Plus, Minus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';
import { getLocalCart, updateLocalCartItemQuantity, removeFromLocalCart, ItemType, getCartCreatedAt } from '@/utils/localCart';
import OrderTimer from './OrderTimer';
import ProductImage from '@/components/ProductImage';

interface DisplayItem {
  id: number;
  itemId: number;
  itemType: ItemType;
  quantity: number;
  variantId?: string;
  name: string;
  price: number;
  image_url: string;
  variant_label?: string;
  stock?: number;
}

interface CartSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CartSheet = ({ isOpen, onOpenChange }: CartSheetProps) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [cartStartTime, setCartStartTime] = useState<string | null>(null);

  const fetchCartItems = useCallback(async () => {
    setLoading(true);
    const localCart = getLocalCart();
    setCartStartTime(getCartCreatedAt());
    
    let finalItems: DisplayItem[] = [];

    if (localCart.length > 0) {
      const productIds = localCart.filter(i => i.itemType === 'product').map(i => i.itemId);
      const promotionIds = localCart.filter(i => i.itemType === 'promotion').map(i => i.itemId);
      const variantIds = localCart.filter(i => i.variantId).map(i => i.variantId!);
      
      const [productsRes, promotionsRes, variantsRes] = await Promise.all([
        supabase.from('products').select('id, name, price, image_url, stock_quantity').in('id', productIds),
        supabase.from('promotions').select('id, name, price, image_url, stock_quantity').in('id', promotionIds),
        variantIds.length > 0 ? supabase.from('product_variants').select('id, flavor_id, volume_ml, price, stock_quantity, color, ohms, size, sku').in('id', variantIds) : Promise.resolve({ data: [] })
      ]);

      const flavorsIds = (variantsRes as any).data?.filter((v: any) => v.flavor_id).map((v: any) => v.flavor_id!) || [];
      const { data: flavorsData } = flavorsIds.length > 0 
        ? await supabase.from('flavors').select('id, name').in('id', flavorsIds) 
        : { data: [] };

      finalItems = localCart.map((cartItem): DisplayItem | null => {
        if (cartItem.itemType === 'product') {
          const product = (productsRes as any).data?.find((p: any) => p.id === cartItem.itemId);
          if (!product) return null;

          let price = product.price;
          let label = '';
          let stock = product.stock_quantity;

          if (cartItem.variantId) {
            const variant = (variantsRes as any).data?.find((v: any) => v.id === cartItem.variantId);
            if (variant) {
              price = variant.price;
              stock = variant.stock_quantity;

              // Try to find flavor name if available
              const fName = variant.flavor_id ? flavorsData?.find(f => f.id === variant.flavor_id)?.name : '';

              // Build parts for a robust label: prefer explicit flavor/name + volume, otherwise try other attributes
              const parts: string[] = [];
              if (fName) parts.push(fName);
              if (variant.color) parts.push(variant.color);
              if (variant.ohms) parts.push(variant.ohms);

              // Join parts with separator; fallback to a generic but explicit label if nothing meaningful found
              const built = parts.join(' - ').trim();
              if (built) {
                label = `Opção: ${built}`;
              } else {
                label = 'Opção selecionada';
              }
            }
          }

          return {
            id: cartItem.itemId,
            itemId: cartItem.itemId,
            itemType: cartItem.itemType,
            quantity: cartItem.quantity,
            variantId: cartItem.variantId,
            name: product.name,
            price: price,
            image_url: product.image_url || '',
            variant_label: label,
            stock: stock
          };
        } else {
          const promo = (promotionsRes as any).data?.find((p: any) => p.id === cartItem.itemId);
          if (!promo) return null;
          return {
            id: cartItem.itemId,
            itemId: cartItem.itemId,
            itemType: cartItem.itemType,
            quantity: cartItem.quantity,
            name: promo.name,
            price: promo.price,
            image_url: promo.image_url || '',
            stock: promo.stock_quantity
          };
        }
      }).filter((i): i is DisplayItem => i !== null);
    }
    
    setItems(finalItems);
    setLoading(false);
  }, []);

  useEffect(() => { if (isOpen) { fetchCartItems(); } }, [isOpen, fetchCartItems]);

  useEffect(() => {
    const handleUpdate = () => fetchCartItems();
    window.addEventListener('cartUpdated', handleUpdate);
    return () => { window.removeEventListener('cartUpdated', handleUpdate); };
  }, [fetchCartItems]);

  useEffect(() => { setTotal(items.reduce((acc, item) => acc + item.price * item.quantity, 0)); }, [items]);

  const updateQuantity = async (item: DisplayItem, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(item);
      return;
    }

    const key = `${item.itemType}-${item.itemId}-${item.variantId || 'no-var'}`;
    setUpdatingId(key);

    // Verifica estoque antes de aumentar
    if (newQuantity > item.quantity) {
        if (item.stock !== undefined && newQuantity > item.stock) {
            showError(`Estoque insuficiente. Temos apenas ${item.stock} unidades.`);
            setUpdatingId(null);
            return;
        }
    }

    updateLocalCartItemQuantity(item.itemId, item.itemType, newQuantity, item.variantId);
    await fetchCartItems();
    setUpdatingId(null);
  };

  const removeItem = (item: DisplayItem) => {
    removeFromLocalCart(item.itemId, item.itemType, item.variantId);
    fetchCartItems();
  };

  const handleCheckout = async () => {
    if (items.length === 0) { 
      showError("Seu carrinho está vazio."); 
      return; 
    }

    // Verifica se o usuário está logado
    try {
      // get session and user in a robust way
      const sessionRes = await supabase.auth.getSession();
      const userRes = await supabase.auth.getUser();
      const session = sessionRes?.data?.session;
      const authUser = session?.user || userRes?.data?.user || null;

      console.debug('[CartSheet] handleCheckout session:', session);
      console.debug('[CartSheet] handleCheckout authUser:', authUser);

      if (!authUser) {
        showError('Você precisa estar logado para finalizar a compra. Redirecionando para login...');
        window.dispatchEvent(new CustomEvent('authRequired', { detail: { from: window.location.pathname } }));
        setTimeout(() => navigate('/login', { state: { from: '/checkout' } }), 600);
        return;
      }

      // Optionally ensure profile is complete before checkout
      try {
        const { data: profile } = await supabase.from('profiles').select('id, first_name, last_name, date_of_birth, phone, cpf_cnpj, gender, cep, street, number, neighborhood, city, state').eq('id', authUser.id).single();
        const isComplete = profile && profile.first_name && profile.last_name && profile.date_of_birth && profile.phone && profile.cpf_cnpj && profile.gender && profile.cep && profile.street && profile.number && profile.neighborhood && profile.city && profile.state;
        if (!isComplete) {
                  // Redirect to complete profile with return to checkout
                  navigate('/complete-profile', { state: { from: '/checkout' } });
                  onOpenChange(false);
                  return;
                }
      } catch (profileErr) {
        console.warn('[CartSheet] profile check failed:', profileErr);
        // If profile query fails, allow checkout to proceed to show auth errors later
      }

      navigate('/checkout');
      onOpenChange(false);
    } catch (e) {
      console.error('[CartSheet] Error during handleCheckout:', e);
      showError('Erro ao verificar sessão. Tente entrar novamente.');
      window.dispatchEvent(new CustomEvent('authRequired', { detail: { from: window.location.pathname } }));
      setTimeout(() => navigate('/login', { state: { from: '/checkout' } }), 600);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col bg-white border-l border-stone-200 text-charcoal-gray sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-black text-2xl tracking-tighter italic uppercase text-charcoal-gray">Seu Carrinho.</SheetTitle>
          <SheetDescription className="sr-only">
            Visualize e gerencie os itens adicionados ao seu carrinho de compras.
          </SheetDescription>
        </SheetHeader>
        <Separator className="my-4 bg-stone-200" />
        
        {items.length > 0 && cartStartTime && (
          <div className="mb-6">
            <OrderTimer 
              createdAt={cartStartTime} 
              className="bg-sky-50 border-sky-100"
            />
            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-2 px-2">
              Complete seu pedido para garantir esses itens no estoque.
            </p>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="space-y-4 flex-grow"><Skeleton className="h-20 w-full bg-stone-100" /><Skeleton className="h-20 w-full bg-stone-100" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ShoppingCart className="h-16 w-16 text-stone-300 mb-4" />
            <p className="text-xl font-bold text-stone-400 uppercase italic">Carrinho Vazio</p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-4 custom-scrollbar bg-slate-50/30">
            {items.map(item => {
              const key = `${item.itemType}-${item.itemId}-${item.variantId || 'no-var'}`;
              return (
                <div key={key} className="flex items-start space-x-4 bg-stone-50 p-5 rounded-2xl border border-stone-100">
                  <div className="flex-grow min-w-0">
                    <ProductImage src={item.image_url} alt={item.name} className="h-20 w-20 object-cover rounded-xl border border-stone-200" />
                    <div className="flex-grow min-w-0">
                      <p className="font-bold text-charcoal-gray text-sm tracking-tight leading-tight">{item.name}</p>
                      {item.variant_label && (
                        <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mt-1">{item.variant_label}</p>
                      )}
                      <p className="text-stone-600 font-bold text-sm">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="bg-white p-3 rounded-2xl border border-stone-200">
                        <Button 
                          variant="outline" 
                          onClick={() => updateQuantity(item, item.quantity - 1)}
                          className="h-14 w-10 text-stone-700 hover:bg-stone-300 hover:text-stone-900 text-stone-700 rounded-lg transition-all active:mobile:active:scale-98"
                          disabled={updatingId === key}
                        >
                          <Minus className="h-4 w-4 touch-manipulation-none" />
                        </Button>
                        <div className="w-8 text-center text-stone-900 font-bold">
                          {updatingId === key ? <Loader2 className="h-3 w-3 animate-spin" /> : item.quantity}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button 
                        variant="ghost" 
                        onClick={() => removeItem(item)}
                        className="h-10 w-10 text-red-500 p-2 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="mt-auto pt-6 border-t border-stone-200 flex flex-col">
            <div className="w-full space-y-4">
              <div className="flex justify-between font-black text-xl italic uppercase">
                <span className="text-stone-500">Total</span>
                <span className="text-sky-600">R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>
              <Button className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-[0.2em] h-14 rounded-xl shadow-lg transition-all active:scale-95" onClick={handleCheckout}>
                Finalizar Compra
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};