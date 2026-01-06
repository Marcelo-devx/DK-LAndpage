import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from './ui/skeleton';
import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';
import { showError } from '@/utils/toast';
import { getLocalCart, updateLocalCartItemQuantity, removeFromLocalCart, ItemType } from '@/utils/localCart';

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
}

interface CartSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CartSheet = ({ isOpen, onOpenChange }: CartSheetProps) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchCartItems = useCallback(async () => {
    setLoading(true);
    const localCart = getLocalCart();
    let finalItems: DisplayItem[] = [];

    if (localCart.length > 0) {
      const productIds = localCart.filter(i => i.itemType === 'product').map(i => i.itemId);
      const promotionIds = localCart.filter(i => i.itemType === 'promotion').map(i => i.itemId);
      const variantIds = localCart.filter(i => i.variantId).map(i => i.variantId!);
      
      const [productsRes, promotionsRes, variantsRes] = await Promise.all([
        supabase.from('products').select('id, name, price, image_url').in('id', productIds),
        supabase.from('promotions').select('id, name, price, image_url').in('id', promotionIds),
        variantIds.length > 0 ? supabase.from('product_variants').select('id, flavor_id, volume_ml, price').in('id', variantIds) : Promise.resolve({ data: [] })
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

          if (cartItem.variantId) {
            const variant = (variantsRes as any).data?.find((v: any) => v.id === cartItem.variantId);
            if (variant) {
              price = variant.price;
              const fName = variant.flavor_id ? flavorsData?.find(f => f.id === variant.flavor_id)?.name : '';
              const vMl = variant.volume_ml ? `${variant.volume_ml}ml` : '';
              
              if (fName && vMl) label = `${fName} - ${vMl}`;
              else label = fName || vMl;
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
            variant_label: label
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

  const updateQuantity = (item: DisplayItem, newQuantity: number) => {
    updateLocalCartItemQuantity(item.itemId, item.itemType, newQuantity, item.variantId);
    fetchCartItems();
  };

  const removeItem = (item: DisplayItem) => {
    removeFromLocalCart(item.itemId, item.itemType, item.variantId);
    fetchCartItems();
  };

  const handleCheckout = () => {
    if (items.length === 0) { showError("Seu carrinho está vazio."); return; }
    navigate('/checkout');
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col bg-off-white sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl text-charcoal-gray">Seu Carrinho</SheetTitle>
        </SheetHeader>
        <Separator className="my-2" />
        {loading ? (
          <div className="space-y-4 flex-grow"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ShoppingCart className="h-16 w-16 text-stone-400 mb-4" />
            <p className="font-serif text-xl text-charcoal-gray">Seu carrinho está vazio</p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-4">
            {items.map(item => (
              <div key={`${item.itemType}-${item.itemId}-${item.variantId || 'no-var'}`} className="flex items-start space-x-4">
                <img src={item.image_url} alt={item.name} className="h-20 w-20 object-cover rounded-md" />
                <div className="flex-grow">
                  <p className="font-serif text-charcoal-gray text-sm leading-tight">{item.name}</p>
                  {item.variant_label && <p className="text-xs font-bold text-gold-accent uppercase">{item.variant_label}</p>}
                  <p className="text-tobacco-brown font-semibold text-sm">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="text-xs font-bold">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-stone-400 hover:text-destructive" onClick={() => removeItem(item)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <SheetFooter className="mt-auto pt-4 border-t flex flex-col">
            <div className="w-full space-y-4">
              <div className="flex justify-between font-bold text-lg">
                <span className="text-charcoal-gray">Total:</span>
                <span className="text-tobacco-brown">R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>
              <Button className="w-full bg-gold-accent hover:bg-gold-accent/90 text-charcoal-gray font-bold" onClick={handleCheckout}>
                Finalizar Compra
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};