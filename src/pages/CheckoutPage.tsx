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
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Search, AlertTriangle, CreditCard, MessageSquare, MapPin, ShoppingBag, Truck } from 'lucide-react';
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
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [isCreditCardEnabled, setIsCreditCardEnabled] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'local' | 'correios' | null>(null);

  const { register, handleSubmit, setValue, getValues, watch, formState: { errors } } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  const paymentMethod = watch('payment_method');

  const handleCepLookup = async () => {
    const cep = getValues('cep');
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
      showError("Por favor, insira um CEP válido com 8 dígitos.");
      return;
    }
    setIsFetchingCep(true);
    setDeliveryType(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-cep', { body: { cep: cleanedCep } });
      if (error) {
        const errorBody = JSON.parse(error.context.responseText);
        showError(errorBody.error || "Não foi possível buscar o endereço.");
        setValue('street', ''); setValue('neighborhood', ''); setValue('city', ''); setValue('state', '');
        return;
      }
      setValue('street', data.logradouro); setValue('neighborhood', data.bairro); setValue('city', data.localidade); setValue('state', data.uf);
      
      if (data.deliveryType === 'correios') {
        setDeliveryType('correios');
      } else {
        setDeliveryType('local');
      }
    } catch (e) {
      showError("Ocorreu um erro inesperado ao buscar o CEP.");
    } finally {
      setIsFetchingCep(false);
    }
  };

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const fetchCartItems = useCallback(async () => {
    const localCart = getLocalCart();
    if (localCart.length === 0) { navigate('/', { replace: true }); return; }
    
    const productIds = localCart.filter(i => i.itemType === 'product').map(i => i.itemId);
    const promotionIds = localCart.filter(i => i.itemType === 'promotion').map(i => i.itemId);
    
    const { data: products } = await supabase.from('products').select('id, name, price, image_url').in('id', productIds);
    const { data: promotions } = await supabase.from('promotions').select('id, name, price, image_url').in('id', promotionIds);
    
    const finalItems = localCart.map(cartItem => {
      const details = cartItem.itemType === 'product' 
        ? products?.find(p => p.id === cartItem.itemId) 
        : promotions?.find(p => p.id === cartItem.itemId);
        
      return details ? { 
        id: cartItem.itemId, 
        itemId: cartItem.itemId, 
        itemType: cartItem.itemType, 
        quantity: cartItem.quantity, 
        name: details.name, 
        price: details.price, 
        image_url: details.image_url || '' 
      } : null;
    }).filter((i): i is DisplayItem => i !== null);
    
    setItems(finalItems);
  }, [navigate]);

  const fetchUserData = useCallback(async (currentUser: any) => {
    if (!currentUser) return;

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profileData) {
      setIsCreditCardEnabled(profileData.is_credit_card_enabled);
      
      if (!profileData.is_credit_card_enabled) {
        setValue('payment_method', 'pix');
      } else {
        setValue('payment_method', 'mercadopago');
      }

      const initialData = {
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        phone: profileData.phone ? maskPhone(profileData.phone) : '',
        cep: profileData.cep ? maskCep(profileData.cep) : '',
        street: profileData.street || '',
        number: profileData.number || '',
        neighborhood: profileData.neighborhood || '',
        city: profileData.city || '',
        state: profileData.state || '',
        complement: profileData.complement || '',
      };
      
      Object.keys(initialData).forEach((key) => {
        if (key in checkoutSchema.shape) {
          setValue(key as keyof CheckoutFormData, initialData[key as keyof typeof initialData]);
        }
      });
      setUserPoints(profileData.points);
    }

    const { data: couponData } = await supabase.from('user_coupons').select(`id, expires_at, coupons ( name, discount_value, minimum_order_value )`).eq('user_id', currentUser.id).eq('is_used', false).gt('expires_at', new Date().toISOString());
    if (couponData) {
      const formattedCoupons = couponData.map((c: any) => ({ user_coupon_id: c.id, name: c.coupons.name, discount_value: c.coupons.discount_value, minimum_order_value: c.coupons.minimum_order_value, expires_at: c.expires_at }));
      setCoupons(formattedCoupons);
    }
  }, [setValue]);

  const handleRedemption = useCallback(() => { if (user) { fetchUserData(user); } }, [user, fetchUserData]);

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user;
      setUser(currentUser);
      setIsLoggedIn(!!currentUser);
      if (!currentUser) { setLoading(false); } 
      else { await fetchUserData(currentUser); await fetchCartItems(); setLoading(false); }
    });
    
    supabase.from('app_settings').select('value').eq('key', 'whatsapp_contact_number').single().then(({ data }) => {
      if (data) setWhatsappNumber(data.value);
    });
  }, [fetchUserData, fetchCartItems]);

  useEffect(() => { if (!loading && !isLoggedIn) { navigate('/login', { state: { from: location }, replace: true }); } }, [loading, isLoggedIn, navigate, location]);

  const discount = selectedCoupon?.discount_value ?? 0;
  const total = Math.max(0, subtotal - discount);

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    const toastId = showLoading("Finalizando seu pedido...");
    const cleanedPhone = data.phone.replace(/\D/g, '');
    const cleanedCep = data.cep.replace(/\D/g, '');

    const shippingAddress = { 
      first_name: data.first_name, 
      last_name: data.last_name, 
      phone: cleanedPhone, 
      cep: cleanedCep, 
      street: data.street, 
      number: data.number, 
      complement: data.complement, 
      neighborhood: data.neighborhood, 
      city: data.city, 
      state: data.state 
    };

    try {
      await supabase.from('profiles').update(shippingAddress).eq('id', user.id);

      const { data: orderData, error: orderError } = await supabase.rpc('create_pending_order_from_local_cart', {
        shipping_cost_input: 0,
        shipping_address_input: shippingAddress,
        cart_items_input: getLocalCart(),
        user_coupon_id_input: selectedCoupon?.user_coupon_id,
      });

      if (orderError) throw new Error(orderError.message);
      const { new_order_id, final_price } = orderData;

      const statusUpdate = data.payment_method === 'pix' ? 'Em Preparação' : 'Aguardando Pagamento';
      await supabase.from('orders').update({ 
        payment_method: data.payment_method === 'pix' ? 'PIX via WhatsApp' : 'Cartão de Crédito',
        status: statusUpdate,
        // Se for Correios, podemos marcar delivery_status como 'Pendente Envio Correios'
        delivery_status: deliveryType === 'correios' ? 'Aguardando Envio Correios' : 'Pendente'
      }).eq('id', new_order_id);

      if (final_price <= 0) {
        await supabase.rpc('finalize_order_payment', { p_order_id: new_order_id });
        dismissToast(toastId);
        showSuccess("Pedido realizado com sucesso!");
        clearLocalCart();
        window.dispatchEvent(new CustomEvent('cartUpdated'));
        navigate(`/confirmacao-pedido/${new_order_id}`);
        return;
      }

      if (data.payment_method === 'pix') {
        const itemsSummary = items.map(item => `- ${item.name} (Qtd: ${item.quantity})`).join('\n');
        
        let whatsappMessage = `Olá! Gostaria de finalizar o pagamento do meu pedido (#${new_order_id}) via PIX.\n\nTotal: R$ ${final_price.toFixed(2).replace('.', ',')}\n\nItens:\n${itemsSummary}`;
        
        if (deliveryType === 'correios') {
            whatsappMessage += `\n\n*Atenção:* Entrega via Correios para ${shippingAddress.city}/${shippingAddress.state}.`;
        }

        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
        
        dismissToast(toastId);
        showSuccess("Pedido realizado! Redirecionando para o WhatsApp...");
        
        setTimeout(() => {
          clearLocalCart();
          window.dispatchEvent(new CustomEvent('cartUpdated'));
          window.location.href = whatsappUrl;
        }, 1500);
      } else {
        const { data: preferenceData, error: preferenceError } = await supabase.functions.invoke('create-mercadopago-preference', {
          body: { shipping_address: shippingAddress, order_id: new_order_id, total_price: final_price },
        });

        if (preferenceError) throw new Error("Erro ao iniciar o checkout com Mercado Pago.");

        dismissToast(toastId);
        showSuccess("Pedido realizado! Redirecionando para o pagamento...");
        
        setTimeout(() => {
          clearLocalCart();
          window.dispatchEvent(new CustomEvent('cartUpdated'));
          window.location.href = preferenceData.init_point;
        }, 1500);
      }
    } catch (error: any) {
      dismissToast(toastId);
      showError(error.message || "Ocorreu um erro ao processar seu pedido.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCouponChange = (val: string) => {
    if (val === 'none') { setSelectedCoupon(null); return; }
    const coupon = coupons.find(c => c.user_coupon_id.toString() === val);
    if (coupon) {
      if (subtotal < coupon.minimum_order_value) {
        showError(`O valor mínimo para este cupom é de R$ ${coupon.minimum_order_value.toFixed(2).replace('.', ',')}`);
        setSelectedCoupon(null);
      } else { setSelectedCoupon(coupon); }
    }
  };

  if (loading || !isLoggedIn) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-16 text-white">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-8">
          <Card className="bg-white/5 border-white/10 shadow-2xl rounded-[2rem] overflow-hidden backdrop-blur-sm">
            <CardHeader className="bg-white/[0.02] border-b border-white/5 p-8">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-sky-500/20 rounded-2xl">
                  <MapPin className="h-6 w-6 text-sky-400" />
                </div>
                <CardTitle className="font-black text-2xl tracking-tighter italic uppercase">Dados de Entrega.</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              
              {deliveryType === 'correios' && (
                <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-200">
                  <Truck className="h-4 w-4" />
                  <AlertTitle className="font-bold uppercase text-xs tracking-wider">Entrega via Correios</AlertTitle>
                  <AlertDescription className="text-xs">
                    Para a região selecionada, os pedidos são enviados via Correios.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Nome</Label><Input {...register('first_name')} />{errors.first_name && <p className="text-xs font-bold text-red-400">{errors.first_name.message}</p>}</div>
                <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Sobrenome</Label><Input {...register('last_name')} />{errors.last_name && <p className="text-xs font-bold text-red-400">{errors.last_name.message}</p>}</div>
              </div>
              <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Telefone</Label><Input {...register('phone')} onChange={e => e.target.value = maskPhone(e.target.value)} placeholder="(48) 99999-9999" />{errors.phone && <p className="text-xs font-bold text-red-400">{errors.phone.message}</p>}</div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">CEP</Label>
                <div className="flex space-x-2">
                  <Input {...register('cep')} onChange={e => e.target.value = maskCep(e.target.value)} />
                  <Button type="button" size="icon" onClick={handleCepLookup} disabled={isFetchingCep} className="bg-sky-500 hover:bg-sky-400 text-white h-12 w-12 rounded-xl shrink-0">
                    {isFetchingCep ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  </Button>
                </div>
                {errors.cep && <p className="text-xs font-bold text-red-400">{errors.cep.message}</p>}
              </div>
              <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Rua</Label><Input {...register('street')} />{errors.street && <p className="text-xs font-bold text-red-400">{errors.street.message}</p>}</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Número</Label><Input {...register('number')} />{errors.number && <p className="text-xs font-bold text-red-400">{errors.number.message}</p>}</div>
                <div className="col-span-2 space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Complemento</Label><Input {...register('complement')} /></div>
              </div>
              <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Bairro</Label><Input {...register('neighborhood')} />{errors.neighborhood && <p className="text-xs font-bold text-red-400">{errors.neighborhood.message}</p>}</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Cidade</Label><Input {...register('city')} />{errors.city && <p className="text-xs font-bold text-red-400">{errors.city.message}</p>}</div>
                <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Estado</Label><Input {...register('state')} maxLength={2} />{errors.state && <p className="text-xs font-bold text-red-400">{errors.state.message}</p>}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8 mt-8 lg:mt-0">
          <Card className="bg-white/5 border-white/10 shadow-2xl rounded-[2rem] overflow-hidden backdrop-blur-sm">
            <CardHeader className="bg-white/[0.02] border-b border-white/5 p-8">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-sky-500/20 rounded-2xl">
                  <CreditCard className="h-6 w-6 text-sky-400" />
                </div>
                <CardTitle className="font-black text-2xl tracking-tighter italic uppercase">Pagamento.</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button type="button" onClick={() => setValue('payment_method', 'mercadopago')} disabled={!isCreditCardEnabled} className={cn("h-24 flex flex-col items-center justify-center space-y-2 transition-all rounded-2xl", paymentMethod === 'mercadopago' ? "bg-sky-500 text-white border-2 border-sky-400 ring-4 ring-sky-500/20" : "bg-white/5 text-slate-400 border border-white/10")}>
                  <CreditCard className="h-6 w-6" /><span className="font-black uppercase text-[10px] tracking-widest">Cartão de Crédito</span>
                </Button>
                <Button type="button" onClick={() => setValue('payment_method', 'pix')} className={cn("h-24 flex flex-col items-center justify-center space-y-2 transition-all rounded-2xl", paymentMethod === 'pix' ? "bg-sky-500 text-white border-2 border-sky-400 ring-4 ring-sky-500/20" : "bg-white/5 text-slate-400 border border-white/10")}>
                  <MessageSquare className="h-6 w-6" /><span className="font-black uppercase text-[10px] tracking-widest">PIX via WhatsApp</span>
                </Button>
              </div>
              {!isCreditCardEnabled && (
                <Alert className="bg-red-500/10 text-red-400 border-red-500/20 rounded-xl">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-[10px] font-bold uppercase tracking-wider">Cartão liberado apenas após a primeira compra ou liberação manual.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 shadow-2xl rounded-[2rem] overflow-hidden backdrop-blur-sm">
            <CardHeader className="bg-white/[0.02] border-b border-white/5 p-8">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-sky-500/20 rounded-2xl">
                  <ShoppingBag className="h-6 w-6 text-sky-400" />
                </div>
                <CardTitle className="font-black text-2xl tracking-tighter italic uppercase">Resumo.</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {items.map(item => (
                  <div key={`${item.itemType}-${item.itemId}`} className="flex items-center space-x-4 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    <img src={item.image_url} alt={item.name} className="h-14 w-14 object-cover rounded-lg" />
                    <div className="flex-grow">
                      <p className="font-black text-white uppercase text-xs tracking-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Qtd: {item.quantity}</p>
                    </div>
                    <p className="font-black text-sky-400 tracking-tighter">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                  </div>
                ))}
              </div>
              
              <Separator className="bg-white/5" />
              
              <div className="space-y-3">
                <div className="flex justify-between items-center"><Label className="text-xs font-black uppercase tracking-widest text-slate-500">Cupom de Desconto</Label><Button type="button" variant="link" size="sm" className="text-sky-400 font-black uppercase text-[10px] p-0 h-auto" onClick={() => setIsCouponsModalOpen(true)}>Resgatar pontos</Button></div>
                {coupons.length > 0 ? (
                  <Select onValueChange={handleCouponChange} value={selectedCoupon?.user_coupon_id.toString() || 'none'}>
                    <SelectTrigger className="bg-slate-900 border-white/10 rounded-xl h-12 text-white">
                      <SelectValue placeholder="Selecione um cupom" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="none">Nenhum cupom</SelectItem>
                      {coupons.map(coupon => (
                        <SelectItem key={coupon.user_coupon_id} value={coupon.user_coupon_id.toString()} disabled={subtotal < coupon.minimum_order_value}>
                          {coupon.name} (R$ {coupon.discount_value.toFixed(2).replace('.', ',')} off)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[10px] text-slate-600 font-bold uppercase italic">Nenhum cupom disponível.</p>
                )}
              </div>

              <div className="space-y-3 bg-white/[0.03] p-6 rounded-2xl border border-white/5">
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-widest"><span>Subtotal</span><span>R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
                {selectedCoupon && <div className="flex justify-between text-xs text-green-400 font-bold uppercase tracking-widest"><span>Desconto</span><span>- R$ {discount.toFixed(2).replace('.', ',')}</span></div>}
                
                {/* Exibição condicional do Frete */}
                <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-widest">
                    <span>Frete</span>
                    {deliveryType === 'correios' ? (
                        <span className="text-yellow-400">A Combinar (Correios)</span>
                    ) : (
                        <span className="text-green-400">Grátis</span>
                    )}
                </div>

                <Separator className="my-2 bg-white/10" />
                <div className="flex justify-between font-black text-3xl text-white tracking-tighter italic uppercase"><span>Total</span><span className="text-sky-400">R$ {total.toFixed(2).replace('.', ',')}</span></div>
              </div>

              <Button type="submit" size="lg" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-[0.2em] h-16 rounded-2xl shadow-xl transition-all active:scale-95" disabled={isSubmitting || items.length === 0}>
                {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : "Finalizar Pedido"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
      <CouponsModal isOpen={isCouponsModalOpen} onOpenChange={setIsCouponsModalOpen} userPoints={userPoints} onRedemption={handleRedemption} />
    </div>
  );
};

export default CheckoutPage;