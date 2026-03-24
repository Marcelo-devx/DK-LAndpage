import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Search, CreditCard, MessageSquare, MapPin, Gift, X, AlertTriangle, CheckCircle2, Clock, Info, Sparkles } from 'lucide-react';
import { getLocalCart, ItemType, clearLocalCart } from '@/utils/localCart';
import { maskCep, maskPhone, maskCpfCnpj } from '@/utils/masks';
import CouponsModal from '@/components/CouponsModal';
import { cn } from '@/lib/utils';
import { differenceInDays, endOfWeek, isSameWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductImage from '@/components/ProductImage';

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
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  first_name: z.string().min(1, "Nome é obrigatório"),
  last_name: z.string().min(1, "Sobrenome é obrigatório"),
  phone: z.string().min(14, "Telefone inválido").max(15, "Telefone inválido"),
  cpf_cnpj: z.string().min(14, "CPF inválido").max(18, "CNPJ inválido"),
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
  return b.includes('ponto') || b.includes('pré-venda') || b.includes('aniversário') || b.includes('acesso') || b.includes('atendimento') || b.includes('recorrente');
};

const isSelectableBenefit = (benefit: string) => {
  const b = benefit.toLowerCase();
  return b.includes('frete');
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [isAddressComplete, setIsAddressComplete] = useState(false);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const isMountedRef = useRef(true);

  const { register, handleSubmit, setValue, getValues, watch, formState: { errors }, trigger } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  const paymentMethod = watch('payment_method');
  const watchedNeighborhood = watch('neighborhood');
  const watchedCity = watch('city');
  const watchedAddressFields = watch(['email', 'first_name', 'last_name', 'phone', 'cpf_cnpj', 'cep', 'street', 'number', 'neighborhood', 'city', 'state', 'complement']);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const data = getValues();
    const isComplete =
      !!data.email?.trim() &&
      !!data.first_name?.trim() &&
      !!data.last_name?.trim() &&
      (data.phone?.length ?? 0) >= 14 &&
      (data.cpf_cnpj?.length ?? 0) >= 14 &&
      (data.cep?.length ?? 0) >= 9 &&
      !!data.street?.trim() &&
      !!data.number?.trim() &&
      !!data.neighborhood?.trim() &&
      !!data.city?.trim() &&
      !!data.state?.trim();
    setIsAddressComplete(isComplete);
  }, [watchedAddressFields, getValues]);

  const getItemPrice = useCallback((item: DisplayItem) => {
    if (paymentMethod === 'pix' && item.pixPrice && item.pixPrice > 0) return item.pixPrice;
    return item.price;
  }, [paymentMethod]);

  const subtotal = items.reduce((acc, item) => acc + getItemPrice(item) * item.quantity, 0);
  const discount = selectedCoupon?.discount_value ?? 0;
  const total = Math.max(0, subtotal - discount + shippingCost) + donationAmount;

  const fetchCartItems = useCallback(async () => {
    const localCart = getLocalCart();
    if (localCart.length === 0) { if (isMountedRef.current) navigate('/', { replace: true }); return; }
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
    if (isMountedRef.current) setItems(finalItems);
  }, [navigate]);

  const fetchUserData = useCallback(async (currentUser: any) => {
    const [profileRes, couponsRes, ordersRes] = await Promise.all([
        supabase.from('profiles').select('*, loyalty_tiers ( name, benefits )').eq('id', currentUser.id).single(),
        supabase.from('user_coupons').select('id, expires_at, coupons ( name, discount_value, minimum_order_value )').eq('user_id', currentUser.id).eq('is_used', false).gt('expires_at', new Date().toISOString()),
        supabase.from('orders').select('created_at, benefits_used').eq('user_id', currentUser.id).neq('status', 'Cancelado').order('created_at', { ascending: false }).limit(10)
    ]);

    const profile = profileRes.data;
    if (profile && isMountedRef.current) {
      setIsCreditCardEnabled(profile.is_credit_card_enabled);
      if (profile.loyalty_tiers) { setTierName(profile.loyalty_tiers.name); setTierBenefits(profile.loyalty_tiers.benefits || []); }
      setValue('payment_method', profile.is_credit_card_enabled ? 'mercadopago' : 'pix');
      const fields: (keyof CheckoutFormData)[] = ['email', 'first_name', 'last_name', 'phone', 'cep', 'street', 'number', 'neighborhood', 'city', 'state', 'complement', 'cpf_cnpj'];
      fields.forEach(f => {
          let val = profile[f] || '';
          if (f === 'email') val = currentUser.email || '';
          if (f === 'phone') val = val ? maskPhone(val) : '';
          if (f === 'cep') val = val ? maskCep(val) : '';
          if (f === 'cpf_cnpj') val = val ? maskCpfCnpj(val) : '';
          // @ts-ignore
          setValue(f, val);
      });
      setUserPoints(profile.points);
    }

    if (couponsRes.data && isMountedRef.current) setCoupons(couponsRes.data.map((x: any) => ({ user_coupon_id: x.id, name: x.coupons.name, discount_value: x.coupons.discount_value, minimum_order_value: x.coupons.minimum_order_value, expires_at: x.expires_at })));
    if (ordersRes.data && isMountedRef.current) setRecentOrders(ordersRes.data);
  }, [setValue]);

  const getBenefitInfo = (benefit: string) => {
    const lowerBenefit = benefit.toLowerCase();
    const now = new Date();

    if (lowerBenefit.includes('semana')) {
        const usedThisWeek = recentOrders.some(o => 
            o.benefits_used && 
            o.benefits_used.includes(benefit) && 
            isSameWeek(new Date(o.created_at), now, { locale: ptBR })
        );

        if (usedThisWeek) {
            const endOfCurrentWeek = endOfWeek(now, { locale: ptBR });
            const daysToRenew = differenceInDays(endOfCurrentWeek, now) + 1;
            return {
                status: 'used',
                label: `Renova em ${daysToRenew} dias`,
                color: 'text-stone-400 bg-stone-100 border-stone-200'
            };
        } else {
            const endOfCurrentWeek = endOfWeek(now, { locale: ptBR });
            const daysLeft = differenceInDays(endOfCurrentWeek, now);
            return {
                status: 'available',
                label: daysLeft === 0 ? 'Expira HOJE!' : `Expira em ${daysLeft} dias`,
                color: 'text-sky-600 bg-sky-50 border-sky-200'
            };
        }
    }

    return { status: 'active', label: 'Ativo', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  const handleRedemption = useCallback(() => { if (user) { fetchUserData(user); } }, [user, fetchUserData]);

  useEffect(() => {
    // Carregar carrinho e verificar sessão (mas não redirecionar para login)
    const loadCheckout = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user;
      if (isMountedRef.current) setUser(u);
      
      if (u) {
        await fetchUserData(u);
      }
      
      await fetchCartItems();
      if (isMountedRef.current) setLoading(false);
    };
    
    loadCheckout();
  }, [fetchUserData, fetchCartItems]);

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
    } catch (e) { showError("Erro ao buscar CEP."); } finally { if (isMountedRef.current) setIsFetchingCep(false); }
  };

  useEffect(() => {
    const calculateShipping = async () => {
      if (deliveryType === 'correios') { if (isMountedRef.current) { setShippingCost(0); setIsFreeShippingApplied(false); } return; }
      const hasFreeShippingBenefit = selectedBenefits.some(b => b.toLowerCase().includes('frete grátis'));
      if (hasFreeShippingBenefit) { if (isMountedRef.current) { setShippingCost(0); setIsFreeShippingApplied(true); } return; }
      if (watchedNeighborhood && watchedCity) {
        const { data, error } = await supabase.rpc('get_shipping_rate', { p_neighborhood: watchedNeighborhood, p_city: watchedCity });
        if (isMountedRef.current) {
          if (!error && data !== null) setShippingCost(Number(data));
          else setShippingCost(0);
        }
      }
    };
    const timeoutId = setTimeout(calculateShipping, 500);
    return () => clearTimeout(timeoutId);
  }, [watchedNeighborhood, watchedCity, selectedBenefits, deliveryType]);

  const handlePixPayment = async (data: CheckoutFormData) => {
    const toastId = showLoading("Criando seu pedido PIX...");
    try {
      if (user) {
        // Usuário logado - usa a função original
        const bStrings = [...tierBenefits.filter(isPassiveBenefit), ...selectedBenefits];
        const { data: o, error: err } = await supabase.rpc('create_pending_order_from_local_cart', {
          shipping_cost_input: shippingCost,
          shipping_address_input: data, 
          cart_items_input: getLocalCart(),
          user_coupon_id_input: selectedCoupon?.user_coupon_id, 
          benefits_input: bStrings.length ? `Nível ${tierName}: ${bStrings.join(', ')}` : null,
          payment_method_input: 'pix', 
          donation_amount_input: donationAmount
        });
        if (err) throw err;

        const rawOrderId: any = (o as any)?.new_order_id ?? (o as any)?.order_id ?? (o as any)?.id ?? o;
        const createdOrderId = typeof rawOrderId === 'string' ? Number(rawOrderId) : rawOrderId;

        if (!isMountedRef.current) return; // component unmounted - abort follow-ups

        dismissToast(toastId);
        clearLocalCart();

        // REMOVIDO: Não chamar trigger-integration manualmente para PIX
        // O trigger 'trigger_order_status_change_webhook' no banco vai disparar automaticamente
        // quando o pagamento for confirmado (via finalize_order_payment)
        
        if (isMountedRef.current) navigate(`/confirmacao-pedido/${createdOrderId}`);
      } else {
        // Convidado - usa a nova função
        const { data: o, error: err } = await supabase.rpc('create_guest_order', {
          p_email: data.email,
          p_first_name: data.first_name,
          p_last_name: data.last_name,
          p_phone: data.phone.replace(/\D/g, ''),
          p_cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ''),
          p_shipping_cost: shippingCost,
          p_shipping_address: data,
          p_cart_items: getLocalCart(),
          p_payment_method: 'pix',
          p_donation_amount: donationAmount
        });
        if (err) throw err;

        const rawOrderId: any = (o as any)?.new_order_id ?? (o as any)?.order_id ?? (o as any)?.id ?? o;
        const createdOrderId = typeof rawOrderId === 'string' ? Number(rawOrderId) : rawOrderId;

        if (!isMountedRef.current) return;

        dismissToast(toastId);
        clearLocalCart();

        // REMOVIDO: Não chamar trigger-integration manualmente para PIX
        // O trigger 'trigger_order_status_change_webhook' no banco vai disparar automaticamente
        // quando o pagamento for confirmado (via finalize_order_payment)
        
        if (isMountedRef.current) navigate(`/confirmacao-pedido/${createdOrderId}`);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        dismissToast(toastId);
        showError(e.message || "Erro ao criar pedido PIX.");
      }
    }
  };

  const handleMercadoPagoRedirect = async () => {
    const isValid = await trigger();
    if (!isValid) { showError("Preencha todos os dados de entrega primeiro."); return; }
    const toastId = showLoading("Redirecionando para o pagamento...");
    if (isMountedRef.current) setIsSubmitting(true);
    try {
      const data = getValues();
      console.log('[CheckoutPage] DEBUG - Valores passados para create_pending_order_from_local_cart (MP):', {
        shipping_cost_input: shippingCost,
        donation_amount_input: donationAmount,
        total_items_price: subtotal
      });
      
      let orderId: number;
      let finalTotal: number;
      let shippingAddress: any;

      if (user) {
        // Usuário logado - usa a função original
        const bStrings = [...tierBenefits.filter(isPassiveBenefit), ...selectedBenefits];
        const { data: orderData, error: orderError } = await supabase.rpc('create_pending_order_from_local_cart', {
          shipping_cost_input: shippingCost,
          shipping_address_input: data,
          cart_items_input: getLocalCart(),
          user_coupon_id_input: selectedCoupon?.user_coupon_id,
          benefits_input: bStrings.length ? `Nível ${tierName}: ${bStrings.join(', ')}` : null,
          payment_method_input: 'Cartão de Crédito',
          donation_amount_input: donationAmount,
        });
        if (orderError) throw new Error(orderError.message || "Erro ao criar pedido.");
        const rawOrderId: any = (orderData as any)?.new_order_id ?? (orderData as any)?.order_id ?? (orderData as any)?.id ?? orderData;
        orderId = typeof rawOrderId === 'string' ? Number(rawOrderId) : rawOrderId;
        if (!orderId || !Number.isFinite(Number(orderId))) throw new Error('Não foi possível criar o pedido (ID ausente).');
        const { data: orderRow, error: orderRowError } = await supabase.from('orders').select('total_price, shipping_cost, donation_amount, shipping_address').eq('id', orderId).single();
        if (orderRowError || !orderRow) throw new Error('Pedido não encontrado após criação.');
        finalTotal = Number(Number(orderRow.total_price || 0) + Number(orderRow.shipping_cost || 0) + Number(orderRow.donation_amount || 0));
        shippingAddress = orderRow.shipping_address || data;
      } else {
        // Convidado - usa a nova função
        const { data: orderData, error: orderError } = await supabase.rpc('create_guest_order', {
          p_email: data.email,
          p_first_name: data.first_name,
          p_last_name: data.last_name,
          p_phone: data.phone.replace(/\D/g, ''),
          p_cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ''),
          p_shipping_cost: shippingCost,
          p_shipping_address: data,
          p_cart_items: getLocalCart(),
          p_payment_method: 'Cartão de Crédito',
          p_donation_amount: donationAmount
        });
        if (orderError) throw new Error(orderError.message || "Erro ao criar pedido.");
        const rawOrderId: any = (orderData as any)?.new_order_id ?? (orderData as any)?.order_id ?? (orderData as any)?.id ?? orderData;
        orderId = typeof rawOrderId === 'string' ? Number(rawOrderId) : rawOrderId;
        if (!orderId || !Number.isFinite(Number(orderId))) throw new Error('Não foi possível criar o pedido (ID ausente).');
        finalTotal = Number((orderData as any)?.final_price || 0);
        shippingAddress = data;
      }

      if (!isMountedRef.current) return; // abort if user navigated away during order creation

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const invokeOptions: any = { 
        body: { 
          shipping_address: shippingAddress, 
          order_id: orderId, 
          total_price: finalTotal, 
          origin: window.location.origin,
          // Always include guest fields so Edge Function has an email/phone even if auth header is missing
          guest_email: data.email,
          guest_phone: data.phone.replace(/\D/g, ''),
          guest_cpf_cnpj: data.cpf_cnpj.replace(/\D/g, '')
        } 
      };
      if (authToken) invokeOptions.headers = { Authorization: `Bearer ${authToken}` };
      const { data: pref, error: prefError } = await supabase.functions.invoke('create-mercadopago-preference', invokeOptions);
      if (prefError) throw new Error(prefError.message || 'Erro ao criar preferência de pagamento.');

      if (!isMountedRef.current) return; // user left while calling Edge Function

      if (pref && (pref as any).mp_error) {
        console.error('create-mercadopago-preference returned mp_error:', pref);
        const mpErr = (pref as any).mp_error;
        const userMsg = (pref as any).error || (mpErr && (mpErr.message || JSON.stringify(mpErr))) || 'Erro no Mercado Pago.';
        throw new Error(`Mercado Pago: ${userMsg}`);
      }

      if (!pref || ((!pref as any).init_point && !(pref as any).sandbox_init_point)) {
        console.error('create-mercadopago-preference unexpected response:', pref);
        throw new Error('Não foi possível obter a URL de pagamento do Mercado Pago. Verifique logs da Edge Function.');
      }

      if (isMountedRef.current) {
        dismissToast(toastId);
        clearLocalCart();
      }

      // Redirect to Mercado Pago. This will navigate away from the app. If the user
      // has already navigated back/unmounted, avoid forcing a redirect.
      if (isMountedRef.current) {
        const target = (pref as any).init_point || (pref as any).sandbox_init_point;
        window.location.href = target;
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        dismissToast(toastId);
        showError(e?.message || "Não foi possível iniciar o pagamento. Tente novamente.");
        setIsSubmitting(false);
      } else {
        // If component unmounted, log silently
        console.warn('[CheckoutPage] Aborted payment flow due to unmount:', e);
      }
    }
  };

  const onSubmit = async (data: CheckoutFormData) => {
    if (!isMountedRef.current) return;
    setIsSubmitting(true);
    if (data.payment_method === 'pix') await handlePixPayment(data);
    else await handleMercadoPagoRedirect();
    if (isMountedRef.current) setIsSubmitting(false);
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  return (
    <div className="container mx-auto px-4 py-8 md:py-16 text-charcoal-gray">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-8">
          <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-stone-50 border-b border-stone-100 p-8"><div className="flex items-center space-x-4"><div className="p-3 bg-sky-100 rounded-2xl"><MapPin className="h-6 w-6 text-sky-600" /></div><CardTitle className="font-black text-2xl uppercase tracking-tighter italic">Dados de Entrega.</CardTitle></div></CardHeader>
            <CardContent className="p-8 space-y-6">
              <div><Label className="text-[10px] uppercase text-slate-500">E-mail</Label><Input {...register('email')} type="email" placeholder="seu@email.com" />{errors.email && <p className="text-xs text-red-500 font-bold">{errors.email.message}</p>}</div>
              <div className="grid grid-cols-2 gap-4"><div><Label className="text-[10px] uppercase text-slate-500">Nome</Label><Input {...register('first_name')} /></div><div><Label className="text-[10px] uppercase text-slate-500">Sobrenome</Label><Input {...register('last_name')} /></div></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-[10px] uppercase text-slate-500">Telefone</Label><Input {...register('phone')} onChange={e => e.target.value = maskPhone(e.target.value)} />{errors.phone && <p className="text-xs text-red-500 font-bold">{errors.phone.message}</p>}</div>
                <div><Label className="text-[10px] uppercase text-slate-500">CPF/CNPJ</Label><Input {...register('cpf_cnpj')} onChange={e => e.target.value = maskCpfCnpj(e.target.value)} />{errors.cpf_cnpj && <p className="text-xs text-red-500 font-bold">{errors.cpf_cnpj.message}</p>}</div>
              </div>
              <div><Label className="text-[10px] uppercase text-slate-400">CEP</Label><div className="flex gap-2"><Input {...register('cep')} onChange={e => e.target.value = maskCep(e.target.value)} /><Button type="button" size="icon" onClick={handleCepLookup} className="bg-sky-500 h-10 w-12 shrink-0">{isFetchingCep ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}</Button></div></div>
              <div className="grid grid-cols-3 gap-4"><div className="col-span-2"><Label className="text-[10px] uppercase text-slate-500">Rua</Label><Input {...register('street')} /></div><div><Label className="text-[10px] uppercase text-slate-500">Número</Label><Input {...register('number')} /></div></div>
              <div className="grid grid-cols-2 gap-4"><div><Label className="text-[10px] uppercase text-slate-500">Bairro</Label><Input {...register('neighborhood')} /></div><div><Label className="text-[10px] uppercase text-slate-500">Cidade</Label><Input {...register('city')} /></div></div>
            </CardContent>
          </Card>

          {tierBenefits.length > 0 && (
            <Card className="bg-slate-950 border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-white/5 border-b border-white/5 p-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-sky-500/20 rounded-2xl border border-sky-500/30">
                            <Gift className="h-6 w-6 text-sky-400" />
                        </div>
                        <div>
                            <CardTitle className="font-black text-2xl uppercase tracking-tighter italic text-white">
                                Privilégios {tierName}.
                            </CardTitle>
                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mt-1">Clube DK Exclusive</p>
                        </div>
                    </div>
                    <Sparkles className="h-6 w-6 text-sky-500/40" />
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid gap-4">
                    {tierBenefits.map(benefit => {
                        const selectable = isSelectableBenefit(benefit);
                        const info = getBenefitInfo(benefit);
                        const isUsed = info.status === 'used';
                        
                        if (selectable) {
                            return (
                                <div key={benefit} className={cn(
                                    "group relative flex items-start space-x-5 p-5 rounded-2xl border transition-all duration-300",
                                    isUsed 
                                        ? "bg-white/5 border-white/5 opacity-40" 
                                        : "bg-white/5 border-white/10 hover:border-sky-500/50 hover:bg-white/[0.08] cursor-pointer"
                                )}>
                                    <div className="pt-1">
                                        <Checkbox
                                            id={benefit}
                                            checked={selectedBenefits.includes(benefit)}
                                            disabled={isUsed}
                                            onCheckedChange={(checked) => {
                                                setSelectedBenefits(prev =>
                                                    checked ? [...prev, benefit] : prev.filter(b => b !== benefit)
                                                );
                                            }}
                                            className="h-5 w-5 border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <Label htmlFor={benefit} className={cn(
                                            "text-sm font-black uppercase tracking-tight cursor-pointer block mb-1.5 transition-colors",
                                            isUsed ? "text-slate-500" : "text-white group-hover:text-sky-400"
                                        )}>
                                            {benefit}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <div className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", info.color)}>
                                                {info.label}
                                            </div>
                                        </div>
                                    </div>
                                    {!isUsed && <div className="absolute top-4 right-4 w-2 h-2 bg-sky-500 rounded-full animate-pulse" />}
                                </div>
                            );
                        }

                        return (
                            <div key={benefit} className="flex items-center space-x-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                                <div className="p-2 bg-emerald-500/10 rounded-lg">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                </div>
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                                    {benefit}
                                </span>
                            </div>
                        );
                    })}
                </div>
                
                <div className="pt-4">
                    <p className="text-[9px] text-slate-500 font-medium uppercase tracking-widest text-center">
                        Benefícios aplicados automaticamente com base no seu nível de fidelidade.
                    </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-8">
          <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-stone-50 p-8"><CardTitle className="font-black text-2xl uppercase tracking-tighter italic">Resumo do Pedido.</CardTitle></CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">{items.map(i => (<div key={i.id} className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-100"><div className="flex items-center gap-3"><ProductImage src={i.image_url} alt={i.name} className="h-12 w-12 object-cover rounded-lg" /><div><p className="font-black text-[10px] uppercase">{i.name}</p><p className="text-[9px] text-slate-400 font-bold">QTD: {i.quantity}</p></div></div><p className="font-black text-sky-600 text-sm">R$ {(getItemPrice(i) * i.quantity).toFixed(2)}</p></div>))}</div>
              <div className="space-y-2"><Label className="text-[10px] uppercase text-slate-400">Cupom</Label><Select onValueChange={handleCouponChange} value={selectedCoupon?.user_coupon_id.toString() || 'none'}><SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Aplicar cupom" /></SelectTrigger><SelectContent>{coupons.map(c => <SelectItem key={c.user_coupon_id} value={c.user_coupon_id.toString()}>{c.name}</SelectItem>)}<SelectItem value="none">Nenhum</SelectItem></SelectContent></Select></div>
              <div className="space-y-3 bg-stone-50 p-6 rounded-2xl border border-stone-100"><div className="flex justify-between text-[10px] font-bold uppercase text-slate-500"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>{selectedCoupon && <div className="flex justify-between text-[10px] font-bold uppercase text-green-600"><span>Desconto</span><span>- R$ {discount.toFixed(2)}</span></div>}<div className="flex justify-between text-[10px] font-bold uppercase text-slate-500"><span>Frete</span><span className={isFreeShippingApplied ? "text-green-600" : ""}>{isFreeShippingApplied ? "GRÁTIS" : `R$ ${shippingCost.toFixed(2)}`}</span></div>{donationAmount > 0 && <div className="flex justify-between text-[10px] font-bold uppercase text-rose-600"><span>Doação</span><span>+ R$ {donationAmount.toFixed(2)}</span></div>}<Separator /><div className="flex justify-between font-black text-3xl italic uppercase tracking-tighter"><span>Total</span><span className="text-sky-600">R$ {total.toFixed(2).replace('.', ',')}</span></div></div>
              <div className="space-y-3"><Label className="text-[10px] uppercase text-slate-400">Doação Solidária</Label><div className="flex flex-wrap items-center gap-2">{[2, 5, 10].map(val => (<Button key={val} type="button" variant={donationAmount === val ? 'default' : 'outline'} onClick={() => setDonationAmount(prev => (prev === val ? 0 : val))} className={cn("rounded-lg h-10 text-xs font-bold", donationAmount === val && "bg-rose-500 hover:bg-rose-600")}>R$ {val.toFixed(2)}</Button>))}{donationAmount > 0 && (<Button type="button" variant="ghost" size="icon" onClick={() => setDonationAmount(0)} className="text-rose-500 hover:text-rose-700"><X className="h-4 w-4" /></Button>)}</div></div>
              <div className="space-y-3"><Label className="text-[10px] uppercase text-slate-400">Método de Pagamento</Label>{!isAddressComplete && (<Alert variant="destructive" className="bg-red-50 border-red-100 text-red-700"><AlertTriangle className="h-4 w-4" /><AlertTitle className="font-bold">Endereço Incompleto</AlertTitle><AlertDescription className="text-xs">Preencha todos os seus dados de entrega para liberar as opções de pagamento.</AlertDescription></Alert>)}<div className="grid grid-cols-2 gap-3"><Button type="button" onClick={() => setValue('payment_method', 'mercadopago')} disabled={!isCreditCardEnabled || !isAddressComplete} className={cn("h-16 flex-col gap-1 rounded-xl border", paymentMethod === 'mercadopago' ? "bg-sky-500 text-white border-sky-400" : "bg-stone-50 text-slate-500")}><CreditCard className="h-4 w-4" /><span className="text-[9px] uppercase font-black">Cartão</span></Button><Button type="button" onClick={() => setValue('payment_method', 'pix')} disabled={!isAddressComplete} className={cn("h-16 flex-col gap-1 rounded-xl border", paymentMethod === 'pix' ? "bg-sky-500 text-white border-sky-400" : "bg-stone-50 text-slate-500")}><MessageSquare className="h-4 w-4" /><span className="text-[9px] uppercase font-black">PIX WhatsApp</span></Button></div>{paymentMethod === 'mercadopago' && (<Alert className="mt-4 bg-amber-50 border-amber-100"><AlertTitle className="text-sm">Atenção</AlertTitle><AlertDescription className="text-sm text-stone-600">O cartão de crédito deve estar no mesmo nome e CPF/CNPJ cadastrados no site para evitar recusas no pagamento.</AlertDescription></Alert>)}</div>
              {paymentMethod === 'pix' && (<Button type="submit" disabled={isSubmitting || !isAddressComplete} className="w-full h-16 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95">{isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Finalizar com PIX"}</Button>)}
              {paymentMethod === 'mercadopago' && (<Button type="submit" disabled={isSubmitting || !isCreditCardEnabled || !isAddressComplete} className="w-full h-16 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95">{isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Pagar com Mercado Pago"}</Button>)}
            </CardContent>
          </Card>
        </div>
      </form>
      <CouponsModal isOpen={isCouponsModalOpen} onOpenChange={setIsCouponsModalOpen} userPoints={userPoints} onRedemption={handleRedemption} />
    </div>
  );
};

export default CheckoutPage;