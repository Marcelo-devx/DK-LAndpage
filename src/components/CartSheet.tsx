import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from './ui/skeleton';
import { Plus, Minus, Trash2, ShoppingCart, Clock } from 'lucide-react';
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
      <SheetContent className="flex flex-col bg-slate-950 border-white/10 text-white sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-black text-2xl tracking-tighter italic uppercase text-white">Seu Carrinho.</SheetTitle>
        </SheetHeader>
        <Separator className="my-4 bg-white/5" />
        
        {items.length > 0 && (
          <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl flex items-start space-x-3 mb-6">
            <Clock className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">Reserva de Estoque</p>
              <p className="text-xs text-slate-300 leading-relaxed">Seus itens serão reservados por <strong>15 minutos</strong> assim que você finalizar o pedido.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 flex-grow"><Skeleton className="h-20 w-full bg-white/5" /><Skeleton className="h-20 w-full bg-white/5" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ShoppingCart className="h-16 w-16 text-slate-800 mb-4" />
            <p className="text-xl font-bold text-slate-500 uppercase italic">Carrinho Vazio</p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-4 custom-scrollbar">
            {items.map(item => (
              <div key={`${item.itemType}-${item.itemId}-${item.variantId || 'no-var'}`} className="flex items-start space-x-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <img src={item.image_url} alt={item.name} className="h-20 w-20 object-cover rounded-xl border border-white/5" />
                <div className="flex-grow">
                  <p className="font-bold text-white text-sm uppercase tracking-tight leading-tight">{item.name}</p>
                  {item.variant_label && <p className="text-[10px] font-black text-sky-400 uppercase mt-1 tracking-widest">{item.variant_label}</p>}
                  <p className="text-slate-300 font-bold text-sm mt-1">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                  <div className="flex items-center space-x-3 mt-3">
                    <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 hover:bg-white/10" onClick={() => updateQuantity(item, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7 border-white/10 hover:bg-white/10" onClick={() => updateQuantity(item, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-600 hover:text-red-400" onClick={() => removeItem(item)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="mt-auto pt-6 border-t border-white/5 flex flex-col">
            <div className="w-full space-y-4">
              <div className="flex justify-between font-black text-xl italic uppercase">
                <span className="text-slate-500">Total</span>
                <span className="text-sky-400">R$ {total.toFixed(2).replace('.', ',')}</span>
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