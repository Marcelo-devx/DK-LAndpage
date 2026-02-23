import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Search, AlertTriangle, CreditCard, MessageSquare, MapPin, ShoppingBag, Truck, Gift, CheckCircle2, Heart } from 'lucide-react';
import { getLocalCart, ItemType, clearLocalCart } from '@/utils/localCart';
import { maskCep, maskPhone } from '@/utils/masks';
import CouponsModal from '@/components/CouponsModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface DisplayItem {
  id: number;
  itemId: number;
  itemType: ItemType;
  quantity: number;
  name: string;
  price: number;
  pixPrice: number | null;
  image_url: string;
}

interface Coupon {
  user_coupon_id: number;
  name: string;
  discount_value: number;
  minimum_order_value: number;
  expires_at: string;
}

const checkoutSchema = z.object({
  first_name: z.string().min(1, "Nome é obrigatório"),
  last_name: z.string().min(1, "Sobrenome é obrigatório"),
  phone: z.string().min(14, "Telefone inválido").max(15, "Telefone inválido"),
  cep: z.string().min(9, "CEP inválido"),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado inválido").max(2, "Use a sigla do estado (ex: SC)"),
  payment_method: z.enum(['mercadopago', 'pix'], { required_error: "Selecione um método de pagamento." }),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

const isPassiveBenefit = (benefit: string) => {
  const b = benefit.toLowerCase();
  return b.includes('pontos') || b.includes('pré-venda') || b.includes('aniversário') || b.includes('acesso') || b.includes('atendimento') || b.includes('recorrente');
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [isCouponsModalOpen, setIsCouponsModalOpen] = useState(false);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isCreditCardEnabled, setIsCreditCardEnabled] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'local' | 'correios' | null>(null);
  
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [isFreeShippingApplied, setIsFreeShippingApplied] = useState(false);
  const [donationAmount, setDonationAmount] = useState<number>(0);
  
  const [tierName, setTierName] = useState<string>('');
  const [tierBenefits, setTierBenefits] = useState<string[]>([]);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);

  const { register, handleSubmit, setValue, getValues, watch, formState: { errors } } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  const paymentMethod = watch('payment_method');
  const watchedNeighborhood = watch('neighborhood');
  const watchedCity = watch('city');

  const getItemPrice = useCallback((item: DisplayItem) => {
    if (paymentMethod === 'pix' && item.pixPrice && item.pixPrice > 0) return item.pixPrice;
    return item.price;
  }, [paymentMethod]);

  const subtotal = items.reduce((acc, item) => acc + getItemPrice(item) * item.quantity, 0);
  const discount = selectedCoupon?.discount_value ?? 0;
  const total = Math.max(0, subtotal - discount + shippingCost) + donationAmount;

  const fetchCartItems = useCallback(async () => {
    const localCart = getLocalCart();
    if (localCart.length === 0) { navigate('/', { replace: true }); return; }
    const productIds = localCart.filter(i => i.itemType === 'product').map(i => i.itemId);
    const promotionIds = localCart.filter(i => i.itemType === 'promotion').map(i => i.itemId);
    const { data: products } = await supabase.from('products').select('id, name, price, pix_price, image_url').in('id', productIds);
    const { data: promotions } = await supabase.from('promotions').select('id, name, price, pix_price, image_url').in('id', promotionIds);
    const variantIds = localCart.filter(i => i.variantId).map(i => i.variantId!);
    const { data: variants } = await supabase.from('product_variants').select('id, price, pix_price').in('id', variantIds);
    const finalItems = localCart.map(cartItem => {
      let details: any = null;
      let price = 0; let pixPrice: number | null = null;
      if (cartItem.itemType === 'product') {
        details = products?.find(p => p.id === cartItem.itemId);
        if (details) {
          price = details.price; pixPrice = details.pix_price;
          if (cartItem.variantId && variants) {
            const v = variants.find(v => v.id === cartItem.variantId);
            if (v) { price = v.price; pixPrice = v.pix_price; }
          }
        }
      } else {
        details = promotions?.find(p => p.id === cartItem.itemId);
        if (details) { price = details.price; pixPrice = details.pix_price; }
      }
      return details ? { id: cartItem.itemId, itemId: cartItem.itemId, itemType: cartItem.itemType, quantity: cartItem.quantity, name: details.name, price: price, pixPrice: pixPrice, image_url: details.image_url || '' } : null;
    }).filter((i): i is DisplayItem => i !== null);
    setItems(finalItems);
  }, [navigate]);

  const fetchUserData = useCallback(async (currentUser: any) => {
    const { data: profile } = await supabase.from('profiles').select('*, loyalty_tiers ( name, benefits )').eq('id', currentUser.id).single();
    if (profile) {
      setIsCreditCardEnabled(profile.is_credit_card_enabled);
      if (profile.loyalty_tiers) { setTierName(profile.loyalty_tiers.name); setTierBenefits(profile.loyalty_tiers.benefits || []); }
      setValue('payment_method', profile.is_credit_card_enabled ? 'mercadopago' : 'pix');
      const fields: (keyof CheckoutFormData)[] = ['first_name', 'last_name', 'phone', 'cep', 'street', 'number', 'neighborhood', 'city', 'state', 'complement'];
      fields.forEach(f => {
          let val = profile[f] || '';
          if (f === 'phone') val = val ? maskPhone(val) : '';
          if (f === 'cep') val = val ? maskCep(val) : '';
          // @ts-ignore
          setValue(f, val);
      });
      setUserPoints(profile.points);
    }
    const { data: c } = await supabase.from('user_coupons').select('id, expires_at, coupons ( name, discount_value, minimum_order_value )').eq('user_id', currentUser.id).eq('is_used', false).gt('expires_at', new Date().toISOString());
    if (c) setCoupons(c.map((x: any) => ({ user_coupon_id: x.id, name: x.coupons.name, discount_value: x.coupons.discount_value, minimum_order_value: x.coupons.minimum_order_value, expires_at: x.expires_at })));
  }, [setValue]);

  const handleRedemption = useCallback(() => {
    if (user) {
      fetchUserData(user);
    }
  }, [user, fetchUserData]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user; setUser(u); setIsLoggedIn(!!u);
      if (u) { fetchUserData(u); fetchCartItems(); setLoading(false); }
      else setLoading(false);
    });
  }, [fetchUserData, fetchCartItems]);

  const handleCouponChange = (val: string) => {
    if (val === 'none') { setSelectedCoupon(null); return; }
    const coupon = coupons.find(c => c.user_coupon_id.toString() === val);
    if (coupon) {
      if (subtotal < coupon.minimum_order_value) {
        showError(`O valor mínimo para este cupom é de R$ ${coupon.minimum_order_value.toFixed(2).replace('.', ',')}`);
        setSelectedCoupon(null);
      } else {
        setSelectedCoupon(coupon);
      }
    }
  };

  const handleCepLookup = async () => {
    const cep = getValues('cep');
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) { showError("CEP inválido."); return; }
    setIsFetchingCep(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-cep', { body: { cep: cleanedCep } });
      if (error) { showError("Endereço não encontrado."); return; }
      setValue('street', data.logradouro); setValue('neighborhood', data.bairro); setValue('city', data.localidade); setValue('state', data.uf);
      setDeliveryType(data.deliveryType === 'correios' ? 'correios' : 'local');
    } catch (e) { showError("Erro ao buscar CEP."); } finally { setIsFetchingCep(false); }
  };

  useEffect(() => {
    const calculateShipping = async () => {
      if (deliveryType === 'correios') { setShippingCost(0); setIsFreeShippingApplied(false); return; }
      const hasFreeShippingBenefit = selectedBenefits.some(b => b.toLowerCase().includes('frete grátis'));
      if (hasFreeShippingBenefit) { setShippingCost(0); setIsFreeShippingApplied(true); return; }
      setIsFreeShippingApplied(false);
      if (watchedNeighborhood && watchedCity) {
        const { data, error } = await supabase.rpc('get_shipping_rate', { p_neighborhood: watchedNeighborhood, p_city: watchedCity });
        if (!error && data !== null) setShippingCost(Number(data));
        else setShippingCost(0);
      }
    };
    const timeoutId = setTimeout(calculateShipping, 500);
    return () => clearTimeout(timeoutId);
  }, [watchedNeighborhood, watchedCity, selectedBenefits, deliveryType]);

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    const toastId = showLoading("Processando...");
    try {
      const addr = { ...data, phone: data.phone.replace(/\D/g, ''), cep: data.cep.replace(/\D/g, '') };
      await supabase.from('profiles').update(addr).eq('id', user.id);
      const bStrings = [...tierBenefits.filter(isPassiveBenefit), ...selectedBenefits];
      const { data: o, error: err } = await supabase.rpc('create_pending_order_from_local_cart', {
        shipping_cost_input: shippingCost, shipping_address_input: addr, cart_items_input: getLocalCart(),
        user_coupon_id_input: selectedCoupon?.user_coupon_id, benefits_input: bStrings.length ? `Nível ${tierName}: ${bStrings.join(', ')}` : null,
        payment_method_input: data.payment_method, donation_amount_input: donationAmount
      });
      if (err) throw err;
      await supabase.from('orders').update({ payment_method: data.payment_method === 'pix' ? 'PIX via WhatsApp' : 'Cartão de Crédito', status: data.payment_method === 'pix' ? 'Em Preparação' : 'Aguardando Pagamento' }).eq('id', o.new_order_id);
      dismissToast(toastId);
      if (data.payment_method === 'pix') { clearLocalCart(); navigate(`/confirmacao-pedido/${o.new_order_id}`); }
      else {
        const { data: mp } = await supabase.functions.invoke('create-mercadopago-preference', { body: { shipping_address: addr, order_id: o.new_order_id, total_price: o.final_price } });
        clearLocalCart(); window.location.href = mp.init_point;
      }
    } catch (e: any) { dismissToast(toastId); showError(e.message || "Erro no checkout."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  return (
    <div className="container mx-auto px-4 py-8 md:py-16 text-charcoal-gray">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-8">
          <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-stone-50 border-b border-stone-100 p-8"><div className="flex items-center space-x-4"><div className="p-3 bg-sky-100 rounded-2xl"><MapPin className="h-6 w-6 text-sky-600" /></div><CardTitle className="font-black text-2xl uppercase tracking-tighter italic">Dados de Entrega.</CardTitle></div></CardHeader>
            <CardContent className="p-8 space-y-6">
              {deliveryType === 'correios' && <Alert className="bg-yellow-50"><Truck className="h-4 w-4" /><AlertTitle className="font-bold text-xs uppercase">Entrega via Correios</AlertTitle></Alert>}
              <div className="grid grid-cols-2 gap-4"><div><Label className="text-[10px] uppercase text-slate-500">Nome</Label><Input {...register('first_name')} /></div><div><Label className="text-[10px] uppercase text-slate-500">Sobrenome</Label><Input {...register('last_name')} /></div></div>
              <div><Label className="text-[10px] uppercase text-slate-500">CEP</Label><div className="flex gap-2"><Input {...register('cep')} onChange={e => e.target.value = maskCep(e.target.value)} /><Button type="button" size="icon" onClick={handleCepLookup} className="bg-sky-500 h-10 w-12 shrink-0">{isFetchingCep ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}</Button></div></div>
              <div className="grid grid-cols-3 gap-4"><div className="col-span-2"><Label className="text-[10px] uppercase text-slate-500">Rua</Label><Input {...register('street')} /></div><div><Label className="text-[10px] uppercase text-slate-500">Número</Label><Input {...register('number')} /></div></div>
              <div className="grid grid-cols-2 gap-4"><div><Label className="text-[10px] uppercase text-slate-500">Bairro</Label><Input {...register('neighborhood')} /></div><div><Label className="text-[10px] uppercase text-slate-500">Cidade</Label><Input {...register('city')} /></div></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase text-slate-500">Telefone</Label><Input {...register('phone')} onChange={e => e.target.value = maskPhone(e.target.value)} /></div>
            </CardContent>
          </Card>
          
          {tierBenefits.length > 0 && (
            <Card className="bg-white border-sky-500/20 shadow-xl rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-sky-50 p-8"><CardTitle className="font-black text-2xl uppercase tracking-tighter italic">Clube <span className="text-sky-500">{tierName}</span></CardTitle></CardHeader>
                <CardContent className="p-8 space-y-3">
                    {tierBenefits.map((b, i) => (
                        <div key={i} className={cn("flex items-center gap-3 p-3 rounded-xl border", isPassiveBenefit(b) ? "bg-sky-50 border-sky-100" : "bg-stone-50 border-stone-100")}>
                            {!isPassiveBenefit(b) ? <Checkbox checked={selectedBenefits.includes(b)} onCheckedChange={() => setSelectedBenefits(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b])} /> : <CheckCircle2 className="h-5 w-5 text-sky-500" />}
                            <span className="text-sm font-bold">{b}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-8">
          <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-stone-50 p-8"><CardTitle className="font-black text-2xl uppercase tracking-tighter italic">Resumo do Pedido.</CardTitle></CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {items.map(i => (
                  <div key={i.id} className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <div className="flex items-center gap-3"><img src={i.image_url} className="h-12 w-12 object-cover rounded-lg" /><div><p className="font-black text-[10px] uppercase">{i.name}</p><p className="text-[9px] text-slate-400 font-bold">QTD: {i.quantity}</p></div></div>
                    <p className="font-black text-sky-600 text-sm">R$ {(getItemPrice(i) * i.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase text-slate-400">Cupom</Label>
                <Select onValueChange={handleCouponChange} value={selectedCoupon?.user_coupon_id.toString() || 'none'}>
                    <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Aplicar cupom" /></SelectTrigger>
                    <SelectContent>{coupons.map(c => <SelectItem key={c.user_coupon_id} value={c.user_coupon_id.toString()}>{c.name}</SelectItem>)}<SelectItem value="none">Nenhum</SelectItem></SelectContent>
                </Select>
              </div>

              <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-rose-500 fill-current" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-rose-600">Doação Solidária (ONG)</span>
                </div>
                <div className="flex gap-2">
                    {[2, 5, 10].map(v => (
                        <Button key={v} type="button" variant="outline" className={cn("flex-1 h-11 text-xs font-black rounded-xl transition-all", donationAmount === v ? "bg-rose-500 text-white border-rose-500 shadow-md" : "bg-white border-rose-200 text-rose-500 hover:bg-rose-100")} onClick={() => setDonationAmount(donationAmount === v ? 0 : v)}>R$ {v}</Button>
                    ))}
                    <div className="relative w-1/4">
                        <Input type="number" placeholder="Outro" className="h-11 text-xs font-bold pl-2 border-rose-200 rounded-xl" onChange={e => setDonationAmount(Number(e.target.value))} />
                    </div>
                </div>
              </div>

              <div className="space-y-3 bg-stone-50 p-6 rounded-2xl border border-stone-100">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {selectedCoupon && <div className="flex justify-between text-[10px] font-bold uppercase text-green-600"><span>Desconto</span><span>- R$ {discount.toFixed(2)}</span></div>}
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500"><span>Frete</span><span className={isFreeShippingApplied ? "text-green-600" : ""}>{isFreeShippingApplied ? "GRÁTIS" : `R$ ${shippingCost.toFixed(2)}`}</span></div>
                {donationAmount > 0 && <div className="flex justify-between text-[10px] font-bold uppercase text-rose-600"><span>Doação</span><span>+ R$ {donationAmount.toFixed(2)}</span></div>}
                <Separator />
                <div className="flex justify-between font-black text-3xl italic uppercase tracking-tighter"><span>Total</span><span className="text-sky-600">R$ {total.toFixed(2).replace('.', ',')}</span></div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] uppercase text-slate-400">Método de Pagamento</Label>
                <div className="grid grid-cols-2 gap-3">
                    <Button type="button" onClick={() => setValue('payment_method', 'mercadopago')} disabled={!isCreditCardEnabled} className={cn("h-16 flex-col gap-1 rounded-xl border", paymentMethod === 'mercadopago' ? "bg-sky-500 text-white border-sky-400" : "bg-stone-50 text-slate-500")}><CreditCard className="h-4 w-4" /><span className="text-[9px] uppercase font-black">Cartão</span></Button>
                    <Button type="button" onClick={() => setValue('payment_method', 'pix')} className={cn("h-16 flex-col gap-1 rounded-xl border", paymentMethod === 'pix' ? "bg-sky-500 text-white border-sky-400" : "bg-stone-50 text-slate-500")}><MessageSquare className="h-4 w-4" /><span className="text-[9px] uppercase font-black">PIX WhatsApp</span></Button>
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95">{isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Finalizar Pedido"}</Button>
            </CardContent>
          </Card>
        </div>
      </form>
      <CouponsModal isOpen={isCouponsModalOpen} onOpenChange={setIsCouponsModalOpen} userPoints={userPoints} onRedemption={handleRedemption} />
    </div>
  );
};

export default CheckoutPage;