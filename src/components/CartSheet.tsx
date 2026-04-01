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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      // Se não estiver logado, mostra aviso e redireciona para login
      showError("Você precisa estar logado para finalizar a compra.");
      onOpenChange(false);
      
      // Redireciona para login após um pequeno delay para o usuário ver o aviso
      setTimeout(() => {
        navigate('/login', { 
          state: { from: '/checkout' } 
        });
      }, 1500);
      return;
    }

    navigate('/checkout');
    onOpenChange(false);
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
                <div key={key} className="flex items-center justify-between gap-4 p-4 bg-white rounded-xl border border-stone-100 shadow-sm">
                  {/* Left: Image */}
                  <div className="flex-shrink-0">
                    <ProductImage 
                      src={item.image_url} 
                      alt={item.name} 
                      className="h-18 w-18 md:h-20 md:w-20 object-cover rounded-lg border border-stone-200" 
                    />
                  </div>

                  {/* Middle: Name, variant, price */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-charcoal-gray text-sm truncate">{item.name}</p>
                    {item.variant_label && (
                      <p className="text-[11px] text-sky-600 uppercase font-bold mt-1 truncate">{item.variant_label}</p>
                    )}
                    <p className="text-stone-600 font-extrabold text-sm mt-2">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                  </div>

                  {/* Right: quantity controls and remove */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 bg-stone-50 p-1 rounded-lg border border-stone-100">
                      <Button 
                        variant="ghost" 
                        onClick={() => updateQuantity(item, item.quantity - 1)}
                        className="h-9 w-9 flex items-center justify-center p-0 hover:bg-stone-200"
                        disabled={updatingId === key}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="w-8 text-center font-bold text-sm">
                        {updatingId === key ? <Loader2 className="h-4 w-4 animate-spin" /> : item.quantity}
                      </div>
                      <Button 
                        variant="ghost" 
                        onClick={() => updateQuantity(item, item.quantity + 1)}
                        className="h-9 w-9 flex items-center justify-center p-0 hover:bg-stone-200"
                        disabled={updatingId === key}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost" 
                      onClick={() => removeItem(item)}
                      className="h-8 w-8 text-red-500 p-1 rounded-md hover:bg-red-50"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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