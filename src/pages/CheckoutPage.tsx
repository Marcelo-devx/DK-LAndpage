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
import { showError, showLoading, dismissToast, showSuccess } from '@/utils/toast';
import { Loader2, Search, CreditCard, MessageSquare, MapPin, Gift, X, AlertTriangle, CheckCircle2, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { getLocalCart, ItemType, clearLocalCart } from '@/utils/localCart';
import { maskCep, maskPhone, maskCpfCnpj } from '@/utils/masks';
import CouponsModal from '@/components/CouponsModal';
import { cn } from '@/lib/utils';
import { differenceInDays, endOfWeek, isSameWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductImage from '@/components/ProductImage';
import MercadoPagoCardForm from '@/components/MercadoPagoCardForm';
import { useIsMobile } from '@/hooks/use-mobile';

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

// ─── Barra de progresso mobile ───────────────────────────────────────────────
const MobileStepBar = ({ step }: { step: 1 | 2 }) => (
  <div className="flex items-center justify-center gap-0 mb-6 lg:hidden">
    {/* Etapa 1 */}
    <div className="flex flex-col items-center">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors",
        step >= 1 ? "bg-sky-500 text-white" : "bg-stone-200 text-stone-400"
      )}>1</div>
      <span className={cn("text-[9px] font-black uppercase tracking-widest mt-1", step >= 1 ? "text-sky-600" : "text-stone-400")}>Entrega</span>
    </div>

    {/* Linha */}
    <div className={cn("h-0.5 w-12 mb-4 transition-colors", step >= 2 ? "bg-sky-500" : "bg-stone-200")} />

    {/* Etapa 2 */}
    <div className="flex flex-col items-center">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors",
        step >= 2 ? "bg-sky-500 text-white" : "bg-stone-200 text-stone-400"
      )}>2</div>
      <span className={cn("text-[9px] font-black uppercase tracking-widest mt-1", step >= 2 ? "text-sky-600" : "text-stone-400")}>Pagamento</span>
    </div>
  </div>
);

const CheckoutPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Controla a etapa atual APENAS no mobile (1 = entrega, 2 = resumo+pagamento)
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);

  const safeNavigate = useCallback((url: string, options?: { replace?: boolean }) => {
    navigate(url, { replace: !!options?.replace });
  }, [navigate]);

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
  const [isAddressComplete, setIsAddressComplete] = useState<boolean>(false);
  const [tierBenefits, setTierBenefits] = useState<string[]>([]);

  type RecentOrder = { created_at: string; benefits_used?: string | null };
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);

  const [showMpForm, setShowMpForm] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [cardFormAmount, setCardFormAmount] = useState<number>(0);

  const isMountedRef = useRef(true);
  const showMpFormRef = useRef(false);
  const pendingOrderIdRef = useRef<number | null>(null);

  const { register, handleSubmit, setValue, getValues, watch, trigger, formState: { errors } } = useForm<CheckoutFormData>({
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

  // Manter refs sincronizados com os states para uso em closures de event listeners
  useEffect(() => { showMpFormRef.current = showMpForm; }, [showMpForm]);
  useEffect(() => { pendingOrderIdRef.current = pendingOrderId; }, [pendingOrderId]);

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
    if (localCart.length === 0) {
      // Não redirecionar se já existe um pedido em andamento (pagamento com cartão)
      if (pendingOrderIdRef.current) return;
      if (isMountedRef.current) safeNavigate('/', { replace: true });
      return;
    }
    const productIds = localCart.filter(i => i.itemType === 'product').map(i => i.itemId);
    const promotionIds = localCart.filter(i => i.itemType === 'promotion').map(i => i.itemId);
    const variantIds = localCart.filter(i => i.variantId).map(i => i.variantId!);

    const [productsRes, promotionsRes, variantsRes] = await Promise.all([
      productIds.length > 0
        ? supabase.from('products').select('id, name, price, pix_price, image_url').in('id', productIds)
        : Promise.resolve({ data: [] }),
      promotionIds.length > 0
        ? supabase.from('promotions').select('id, name, price, pix_price, image_url').in('id', promotionIds)
        : Promise.resolve({ data: [] }),
      variantIds.length > 0
        ? supabase.from('product_variants').select('id, price, pix_price').in('id', variantIds)
        : Promise.resolve({ data: [] }),
    ]);

    const products = (productsRes as any).data;
    const promotions = (promotionsRes as any).data;
    const variants = (variantsRes as any).data;

    const finalItems = localCart.map(cartItem => {
      let details: any = null;
      let price = 0;
      let pixPrice: number | null = null;
      if (cartItem.itemType === 'product') {
        details = products?.find((p: any) => p.id === cartItem.itemId);
        if (details) {
          price = details.price; pixPrice = details.pix_price;
          if (cartItem.variantId && variants) {
            const v = variants.find((v: any) => v.id === cartItem.variantId);
            if (v) { price = v.price; pixPrice = v.pix_price; }
          }
        }
      } else {
        details = promotions?.find((p: any) => p.id === cartItem.itemId);
        if (details) { price = details.price; pixPrice = details.pix_price; }
      }
      return details
        ? { id: cartItem.itemId, itemId: cartItem.itemId, itemType: cartItem.itemType, quantity: cartItem.quantity, name: details.name, price, pixPrice, image_url: details.image_url || '' }
        : null;
    }).filter((i): i is DisplayItem => i !== null);

    if (isMountedRef.current) setItems(finalItems);
  }, [safeNavigate]);

  const fetchUserData = useCallback(async (currentUser: any) => {
    const [profileRes, couponsRes, ordersRes] = await Promise.all([
      supabase.from('profiles').select('*, loyalty_tiers ( name, benefits )').eq('id', currentUser.id).single(),
      supabase.from('user_coupons').select('id, expires_at, coupons ( name, discount_value, minimum_order_value )').eq('user_id', currentUser.id).eq('is_used', false).gt('expires_at', new Date().toISOString()),
      supabase.from('orders').select('created_at, benefits_used').eq('user_id', currentUser.id).neq('status', 'Cancelado').order('created_at', { ascending: false }).limit(10),
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
        return { status: 'used', label: `Renova em ${daysToRenew} dias`, color: 'text-stone-400 bg-stone-100 border-stone-200' };
      } else {
        const endOfCurrentWeek = endOfWeek(now, { locale: ptBR });
        const daysLeft = differenceInDays(endOfCurrentWeek, now);
        return { status: 'available', label: daysLeft === 0 ? 'Expira HOJE!' : `Expira em ${daysLeft} dias`, color: 'text-sky-600 bg-sky-50 border-sky-200' };
      }
    }

    return { status: 'active', label: 'Ativo', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  const handleRedemption = useCallback(() => { if (user) { fetchUserData(user); } }, [user, fetchUserData]);

  useEffect(() => {
    const loadCheckout = async () => {
      // Timeout de 8s para evitar loading infinito ao voltar de outra aba
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) setLoading(false);
      }, 8000);

      try {
        // ── Restaurar estado do formulário MP após recarregamento ──────────────
        const savedOrderId = sessionStorage.getItem('mp_pending_order_id');
        if (savedOrderId) {
          const restoredId = Number(savedOrderId);
          if (restoredId && Number.isFinite(restoredId)) {
            setPendingOrderId(restoredId);
            pendingOrderIdRef.current = restoredId;
            setShowMpForm(true);
            showMpFormRef.current = true;
            // Buscar o total do pedido para exibir corretamente
            try {
              const { data: orderRow } = await supabase
                .from('orders')
                .select('total_price')
                .eq('id', restoredId)
                .single();
              if (orderRow?.total_price) {
                setCardFormAmount(Number(orderRow.total_price));
              }
            } catch { /* ignore */ }
            clearTimeout(timeoutId);
            if (isMountedRef.current) setLoading(false);
            return;
          }
        }
        // ──────────────────────────────────────────────────────────────────────

        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user;
        if (isMountedRef.current) setUser(u);
        if (u) await fetchUserData(u);
        await fetchCartItems();
      } catch (e) {
        console.error('[CheckoutPage] loadCheckout error:', e);
      } finally {
        clearTimeout(timeoutId);
        if (isMountedRef.current) setLoading(false);
      }
    };

    loadCheckout();

    let hiddenAt = 0;
    const THRESHOLD_MS = 30_000;
    const isFetchingRefLocal = { current: false };

    const schedule = (cb: () => void) => {
      if ((window as any).requestIdleCallback) {
        (window as any).requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 500);
      }
    };

    const refetch = async () => {
      // Não refazer fetch se o formulário de cartão do MP estiver aberto
      if (showMpFormRef.current) return;
      if (isFetchingRefLocal.current) return;
      isFetchingRefLocal.current = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await fetchUserData(session.user);
        await fetchCartItems();
      } catch { /* ignore */ } finally {
        isFetchingRefLocal.current = false;
      }
    };

    const handleVisibility = () => {
      try {
        if (document.hidden) {
          hiddenAt = Date.now();
        } else {
          if (!hiddenAt) return;
          const elapsed = Date.now() - hiddenAt;
          hiddenAt = 0;
          if (elapsed > THRESHOLD_MS && !isFetchingRefLocal.current) schedule(refetch);
        }
      } catch { /* ignore */ }
    };

    const handleFocus = () => {
      try {
        if (hiddenAt && (Date.now() - hiddenAt) > THRESHOLD_MS && !isFetchingRefLocal.current) {
          hiddenAt = 0;
          schedule(refetch);
        }
      } catch { /* ignore */ }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
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
      setValue('street', data.logradouro);
      setValue('neighborhood', data.bairro);
      setValue('city', data.localidade);
      setValue('state', data.uf);
      setDeliveryType(data.deliveryType === 'correios' ? 'correios' : 'local');
    } catch { showError("Erro ao buscar CEP."); } finally { if (isMountedRef.current) setIsFetchingCep(false); }
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

  // ============================================================
  // MOBILE: avançar da etapa 1 para a etapa 2
  // ============================================================
  const handleMobileNextStep = async () => {
    // Valida apenas os campos da etapa 1 antes de avançar
    const valid = await trigger([
      'email', 'first_name', 'last_name', 'phone', 'cpf_cnpj',
      'cep', 'street', 'number', 'neighborhood', 'city', 'state',
    ]);
    if (!valid) {
      showError("Preencha todos os dados de entrega antes de continuar.");
      return;
    }
    setMobileStep(2);
    // Scroll suave para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================================
  // PIX WHATSAPP
  // ============================================================
  const handlePixPayment = async (data: CheckoutFormData) => {
    const toastId = showLoading("Criando seu pedido PIX...");
    try {
      let createdOrderId: number;

      if (user) {
        const bStrings = [...tierBenefits.filter(isPassiveBenefit), ...selectedBenefits];
        const { data: o, error: err } = await supabase.rpc('create_pending_order_from_local_cart', {
          shipping_cost_input: shippingCost,
          shipping_address_input: data,
          cart_items_input: getLocalCart(),
          user_coupon_id_input: selectedCoupon?.user_coupon_id,
          benefits_input: bStrings.length ? `Nível ${tierName}: ${bStrings.join(', ')}` : null,
          payment_method_input: 'pix',
          donation_amount_input: donationAmount,
        });
        if (err) throw err;
        const raw: any = (o as any)?.new_order_id ?? (o as any)?.order_id ?? (o as any)?.id ?? o;
        createdOrderId = typeof raw === 'string' ? Number(raw) : raw;
      } else {
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
          p_donation_amount: donationAmount,
        });
        if (err) throw err;
        const raw: any = (o as any)?.new_order_id ?? (o as any)?.order_id ?? (o as any)?.id ?? o;
        createdOrderId = typeof raw === 'string' ? Number(raw) : raw;
      }

      if (!isMountedRef.current) return;
      dismissToast(toastId);
      clearLocalCart();
      sessionStorage.removeItem('mp_pending_order_id');

      // Fire-and-forget webhook
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token;
          const invokeOpts: any = { body: { order_id: createdOrderId, event_type: 'order_created', guest_email: data.email } };
          if (authToken) invokeOpts.headers = { Authorization: `Bearer ${authToken}` };
          const { error: invokeErr } = await supabase.functions.invoke('trigger-integration', invokeOpts);
          const status = invokeErr ? 'failed' : 'sent';
          const details = invokeErr ? String(invokeErr) : 'Dispatched via trigger-integration';
          await supabase.functions.invoke('log-integration', { body: { event_type: 'order_created', status, details, payload: { order_id: createdOrderId } } });
        } catch (ex) {
          try { await supabase.functions.invoke('log-integration', { body: { event_type: 'order_created', status: 'failed', details: String(ex), payload: { order_id: createdOrderId } } }); } catch { /* ignore */ }
        }
      })();

      safeNavigate(`/confirmacao-pedido/${createdOrderId}`);
    } catch (e: any) {
      if (isMountedRef.current) {
        dismissToast(toastId);
        showError(e.message || "Erro ao criar pedido PIX.");
      }
    }
  };

  // ============================================================
  // CARTÃO DESKTOP — Passo 1: criar pedido e mostrar form do MP
  // ============================================================
  const handlePrepareCardPayment = async (data: CheckoutFormData) => {
    if (!isAddressComplete) { showError("Preencha todos os dados de entrega."); return; }
    setIsSubmitting(true);
    const toastId = showLoading("Preparando pagamento...");

    try {
      let orderId: number;

      if (user) {
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
        const raw: any = (orderData as any)?.new_order_id ?? (orderData as any)?.order_id ?? (orderData as any)?.id ?? orderData;
        orderId = typeof raw === 'string' ? Number(raw) : raw;
      } else {
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
          p_donation_amount: donationAmount,
        });
        if (orderError) throw new Error(orderError.message || "Erro ao criar pedido.");
        const raw: any = (orderData as any)?.new_order_id ?? (orderData as any)?.order_id ?? (orderData as any)?.id ?? orderData;
        orderId = typeof raw === 'string' ? Number(raw) : raw;
      }

      if (!orderId || !Number.isFinite(Number(orderId))) throw new Error('Não foi possível criar o pedido.');

      // Buscar o total_price real do banco como fonte da verdade para o Brick
      const { data: orderRow } = await supabase
        .from('orders')
        .select('total_price')
        .eq('id', orderId)
        .single();
      const realAmount = orderRow?.total_price ? Number(orderRow.total_price) : total;

      dismissToast(toastId);
      setCardFormAmount(realAmount);
      setPendingOrderId(orderId);
      setShowMpForm(true);
      // Persistir para sobreviver a recarregamentos / redirect do MP
      sessionStorage.setItem('mp_pending_order_id', String(orderId));

      // Fire-and-forget webhook
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token;
          const invokeOpts: any = { body: { order_id: orderId, event_type: 'order_created', guest_email: getValues('email') } };
          if (authToken) invokeOpts.headers = { Authorization: `Bearer ${authToken}` };
          await supabase.functions.invoke('trigger-integration', invokeOpts);
        } catch (e) { console.warn('[CheckoutPage] trigger-integration warning (card):', e); }
      })();

    } catch (e: any) {
      dismissToast(toastId);
      showError(e?.message || "Erro ao preparar pagamento.");
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  // ============================================================
  // CARTÃO — Passo 2: processar pagamento com token do Brick
  // ============================================================
  const handleMpCardSubmit = useCallback(async (cardBrickResult: any) => {
    if (!pendingOrderIdRef.current) { showError("Pedido não encontrado. Tente novamente."); return; }

    const currentOrderId = pendingOrderIdRef.current;

    try {
      const { data: orderRow, error: orderRowError } = await supabase
        .from('orders')
        .select('total_price, shipping_address')
        .eq('id', currentOrderId)
        .single();

      if (orderRowError || !orderRow) throw new Error('Pedido não encontrado.');

      const finalTotal = Number(orderRow.total_price || 0);
      if (!finalTotal || finalTotal <= 0) throw new Error('Total do pedido inválido.');

      const formData = getValues();
      const cleanCpf = formData.cpf_cnpj.replace(/\D/g, '');

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const invokeOptions: any = {
        body: {
          ...cardBrickResult,
          external_reference: String(currentOrderId),
          transaction_amount: finalTotal,
          payer: {
            email: formData.email,
            identification: {
              type: cleanCpf.length > 11 ? 'CNPJ' : 'CPF',
              number: cleanCpf,
            },
            first_name: formData.first_name,
            last_name: formData.last_name,
          },
        },
      };
      if (authToken) invokeOptions.headers = { Authorization: `Bearer ${authToken}` };

      const { data: result, error: payError } = await supabase.functions.invoke('process-mercadopago-payment', invokeOptions);

      if (payError) throw new Error(payError.message || 'Erro ao processar pagamento.');
      if (!result?.success) throw new Error(result?.error || 'Pagamento não aprovado.');

      clearLocalCart();
      sessionStorage.removeItem('mp_pending_order_id');
      showSuccess('Pagamento aprovado! 🎉');

      safeNavigate(`/confirmacao-pedido/${currentOrderId}`);
    } catch (e: any) {
      showError(e?.message || "Pagamento recusado. Verifique os dados do cartão e tente novamente.");
      // Re-throw para que o Brick saiba que houve erro e saia do estado de loading
      throw e;
    }
  }, [getValues, safeNavigate]);

  const onSubmit = async (data: CheckoutFormData) => {
    if (!isMountedRef.current) return;
    if (data.payment_method === 'pix') {
      setIsSubmitting(true);
      await handlePixPayment(data);
      if (isMountedRef.current) setIsSubmitting(false);
    } else {
      // Both mobile and desktop use the transparent Brick checkout
      await handlePrepareCardPayment(data);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;

  // ============================================================
  // TELA DO FORMULÁRIO DE CARTÃO (após criar o pedido)
  // ============================================================
  if (showMpForm && pendingOrderId) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-10 text-charcoal-gray max-w-2xl">
        <div className="mb-8">
          <button
            onClick={() => { sessionStorage.removeItem('mp_pending_order_id'); setShowMpForm(false); setPendingOrderId(null); }}
            className="text-xs text-slate-500 hover:text-slate-700 font-bold uppercase tracking-widest flex items-center gap-2 mb-6 transition-colors"
          >
            ← Voltar ao checkout
          </button>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-charcoal-gray">Pagamento com Cartão.</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">Pedido <span className="font-black text-sky-600">#{pendingOrderId}</span> — Total: <span className="font-black text-sky-600">R$ {(cardFormAmount || total).toFixed(2).replace('.', ',')}</span></p>
        </div>

        <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem]">
          <CardHeader className="bg-stone-50 border-b border-stone-100 p-8 rounded-t-[2rem]">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-sky-100 rounded-2xl">
                <CreditCard className="h-6 w-6 text-sky-600" />
              </div>
              <div>
                <CardTitle className="font-black text-2xl uppercase tracking-tighter italic">Dados do Cartão.</CardTitle>
                <p className="text-xs text-slate-500 mt-1 font-medium">Ambiente seguro — seus dados são criptografados pelo Mercado Pago</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-8">
            <MercadoPagoCardForm
              amount={cardFormAmount || total}
              onSubmit={handleMpCardSubmit}
            />
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-slate-400 font-medium">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
          Pagamento 100% seguro via Mercado Pago
        </div>
      </div>
    );
  }

  // ============================================================
  // BLOCOS REUTILIZÁVEIS (usados tanto no mobile quanto no desktop)
  // ============================================================

  // Bloco: formulário de endereço
  const AddressFormBlock = () => (
    <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem] overflow-hidden">
      <CardHeader className="bg-stone-50 border-b border-stone-100 p-6 md:p-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-sky-100 rounded-2xl"><MapPin className="h-6 w-6 text-sky-600" /></div>
          <CardTitle className="font-black text-xl md:text-2xl uppercase tracking-tighter italic">Dados de Entrega.</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-8 space-y-4 md:space-y-6">
        <div>
          <Label className="text-[10px] uppercase text-slate-500">E-mail</Label>
          <Input {...register('email')} type="email" inputMode="email" autoComplete="email" placeholder="seu@email.com" className="text-base md:text-sm" />
          {errors.email && <p className="text-xs text-red-500 font-bold">{errors.email.message}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Nome</Label>
            <Input {...register('first_name')} autoComplete="given-name" className="text-base md:text-sm" />
            {errors.first_name && <p className="text-xs text-red-500 font-bold">{errors.first_name.message}</p>}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Sobrenome</Label>
            <Input {...register('last_name')} autoComplete="family-name" className="text-base md:text-sm" />
            {errors.last_name && <p className="text-xs text-red-500 font-bold">{errors.last_name.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Telefone</Label>
            <Input
              {...register('phone')}
              inputMode="tel"
              autoComplete="tel"
              className="text-base md:text-sm"
              onChange={e => e.target.value = maskPhone(e.target.value)}
            />
            {errors.phone && <p className="text-xs text-red-500 font-bold">{errors.phone.message}</p>}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-slate-500">CPF/CNPJ</Label>
            <Input
              {...register('cpf_cnpj')}
              inputMode="numeric"
              className="text-base md:text-sm"
              onChange={e => e.target.value = maskCpfCnpj(e.target.value)}
            />
            {errors.cpf_cnpj && <p className="text-xs text-red-500 font-bold">{errors.cpf_cnpj.message}</p>}
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-slate-400">CEP</Label>
          <div className="flex gap-2">
            <Input
              {...register('cep')}
              inputMode="numeric"
              autoComplete="postal-code"
              className="text-base md:text-sm"
              onChange={e => {
                const masked = maskCep(e.target.value);
                e.target.value = masked;
                if (masked.replace(/\D/g, '').length === 8) {
                  setTimeout(() => handleCepLookup(), 100);
                }
              }}
            />
            <Button type="button" size="icon" onClick={handleCepLookup} className="bg-sky-500 h-10 w-12 shrink-0">
              {isFetchingCep ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {errors.cep && <p className="text-xs text-red-500 font-bold">{errors.cep.message}</p>}
        </div>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <div className="col-span-2">
            <Label className="text-[10px] uppercase text-slate-500">Rua</Label>
            <Input {...register('street')} autoComplete="street-address" className="text-base md:text-sm" />
            {errors.street && <p className="text-xs text-red-500 font-bold">{errors.street.message}</p>}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Número</Label>
            <Input {...register('number')} inputMode="numeric" className="text-base md:text-sm" />
            {errors.number && <p className="text-xs text-red-500 font-bold">{errors.number.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Bairro</Label>
            <Input {...register('neighborhood')} className="text-base md:text-sm" />
            {errors.neighborhood && <p className="text-xs text-red-500 font-bold">{errors.neighborhood.message}</p>}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Cidade</Label>
            <Input {...register('city')} autoComplete="address-level2" className="text-base md:text-sm" />
            {errors.city && <p className="text-xs text-red-500 font-bold">{errors.city.message}</p>}
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-slate-500">Estado (sigla)</Label>
          <Input {...register('state')} placeholder="Ex: SC" maxLength={2} className="uppercase text-base md:text-sm" autoComplete="address-level1" />
          {errors.state && <p className="text-xs text-red-500 font-bold">{errors.state.message}</p>}
        </div>
      </CardContent>
    </Card>
  );

  // Bloco: benefícios do clube
  const BenefitsBlock = () => (
    <>
      {tierBenefits.length > 0 && (
        <Card className="bg-slate-950 border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-white/5 border-b border-white/5 p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-sky-500/20 rounded-2xl border border-sky-500/30">
                  <Gift className="h-6 w-6 text-sky-400" />
                </div>
                <div>
                  <CardTitle className="font-black text-xl md:text-2xl uppercase tracking-tighter italic text-white">Privilégios {tierName}.</CardTitle>
                  <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mt-1">Clube DK Exclusive</p>
                </div>
              </div>
              <Sparkles className="h-6 w-6 text-sky-500/40" />
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="grid gap-4">
              {tierBenefits.map(benefit => {
                const selectable = isSelectableBenefit(benefit);
                const info = getBenefitInfo(benefit);
                const isUsed = info.status === 'used';

                if (selectable) {
                  return (
                    <div key={benefit} className={cn(
                      "group relative flex items-start space-x-5 p-5 rounded-2xl border transition-all duration-300",
                      isUsed ? "bg-white/5 border-white/5 opacity-40" : "bg-white/5 border-white/10 hover:border-sky-500/50 hover:bg-white/[0.08] cursor-pointer"
                    )}>
                      <div className="pt-1">
                        <Checkbox
                          id={benefit}
                          checked={selectedBenefits.includes(benefit)}
                          disabled={isUsed}
                          onCheckedChange={(checked) => {
                            setSelectedBenefits(prev => checked ? [...prev, benefit] : prev.filter(b => b !== benefit));
                          }}
                          className="h-5 w-5 border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={benefit} className={cn("text-sm font-black uppercase tracking-tight cursor-pointer block mb-1.5 transition-colors", isUsed ? "text-slate-500" : "text-white group-hover:text-sky-400")}>
                          {benefit}
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", info.color)}>{info.label}</div>
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
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">{benefit}</span>
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
    </>
  );

  // Bloco: resumo + pagamento
  const SummaryAndPaymentBlock = () => (
    <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem] overflow-hidden">
      <CardHeader className="bg-stone-50 p-6 md:p-8">
        <CardTitle className="font-black text-xl md:text-2xl uppercase tracking-tighter italic">Resumo do Pedido.</CardTitle>
      </CardHeader>
      <CardContent className="p-5 md:p-8 space-y-6">
        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
          {items.map(i => (
            <div key={i.id} className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-100">
              <div className="flex items-center gap-3">
                <ProductImage src={i.image_url} alt={i.name} className="h-12 w-12 object-cover rounded-lg" />
                <div>
                  <p className="font-black text-[10px] uppercase">{i.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold">QTD: {i.quantity}</p>
                </div>
              </div>
              <p className="font-black text-sky-600 text-sm">R$ {(getItemPrice(i) * i.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase text-slate-400">Cupom</Label>
          <Select onValueChange={handleCouponChange} value={selectedCoupon?.user_coupon_id.toString() || 'none'}>
            <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Aplicar cupom" /></SelectTrigger>
            <SelectContent>
              {coupons.map(c => <SelectItem key={c.user_coupon_id} value={c.user_coupon_id.toString()}>{c.name}</SelectItem>)}
              <SelectItem value="none">Nenhum</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 bg-stone-50 p-5 md:p-6 rounded-2xl border border-stone-100">
          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
          {selectedCoupon && <div className="flex justify-between text-[10px] font-bold uppercase text-green-600"><span>Desconto</span><span>- R$ {discount.toFixed(2)}</span></div>}
          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500"><span>Frete</span><span className={isFreeShippingApplied ? "text-green-600" : ""}>{isFreeShippingApplied ? "GRÁTIS" : `R$ ${shippingCost.toFixed(2)}`}</span></div>
          {donationAmount > 0 && <div className="flex justify-between text-[10px] font-bold uppercase text-rose-600"><span>Doação</span><span>+ R$ {donationAmount.toFixed(2)}</span></div>}
          <Separator />
          <div className="flex justify-between font-black text-2xl md:text-3xl italic uppercase tracking-tighter"><span>Total</span><span className="text-sky-600">R$ {total.toFixed(2).replace('.', ',')}</span></div>
        </div>

        <div className="space-y-3">
          <Label className="text-[10px] uppercase text-slate-400">Doação Solidária</Label>
          <div className="flex flex-wrap items-center gap-2">
            {[2, 5, 10].map(val => (
              <Button key={val} type="button" variant={donationAmount === val ? 'default' : 'outline'} onClick={() => setDonationAmount(prev => (prev === val ? 0 : val))} className={cn("rounded-lg h-10 text-xs font-bold", donationAmount === val && "bg-rose-500 hover:bg-rose-600")}>R$ {val.toFixed(2)}</Button>
            ))}
            {donationAmount > 0 && (<Button type="button" variant="ghost" size="icon" onClick={() => setDonationAmount(0)} className="text-rose-500 hover:text-rose-700"><X className="h-4 w-4" /></Button>)}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[10px] uppercase text-slate-400">Método de Pagamento</Label>
          {!isAddressComplete && (
            <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-bold">Endereço Incompleto</AlertTitle>
              <AlertDescription className="text-xs">Preencha todos os seus dados de entrega para liberar as opções de pagamento.</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={() => setValue('payment_method', 'mercadopago')}
              disabled={!isCreditCardEnabled || !isAddressComplete}
              className={cn("h-16 flex-col gap-1 rounded-xl border", paymentMethod === 'mercadopago' ? "bg-sky-500 text-white border-sky-400" : "bg-stone-50 text-slate-500")}
            >
              <CreditCard className="h-4 w-4" />
              <span className="text-[9px] uppercase font-black">Cartão</span>
            </Button>
            <Button
              type="button"
              onClick={() => setValue('payment_method', 'pix')}
              disabled={!isAddressComplete}
              className={cn("h-16 flex-col gap-1 rounded-xl border", paymentMethod === 'pix' ? "bg-sky-500 text-white border-sky-400" : "bg-stone-50 text-slate-500")}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-[9px] uppercase font-black">PIX WhatsApp</span>
            </Button>
          </div>

          {paymentMethod === 'mercadopago' && (
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex items-start gap-3">
              <CreditCard className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
              <p className="text-xs text-sky-700 font-medium">
                Você será direcionado para um formulário seguro do Mercado Pago para inserir os dados do cartão. Parcelamento em até 12x disponível.
              </p>
            </div>
          )}
        </div>

        {/* Botões de submit — visíveis apenas no desktop (no mobile ficam no sticky footer) */}
        <div className="hidden md:block space-y-3">
          {paymentMethod === 'pix' && (
            <Button type="submit" disabled={isSubmitting || !isAddressComplete} className="w-full h-16 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95">
              {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Finalizar com PIX"}
            </Button>
          )}
          {paymentMethod === 'mercadopago' && (
            <Button type="submit" disabled={isSubmitting || !isCreditCardEnabled || !isAddressComplete} className="w-full h-16 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95">
              {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Inserir Dados do Cartão →"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // ============================================================
  // LAYOUT MOBILE — Stepper em 2 etapas
  // ============================================================
  if (isMobile) {
    return (
      <div className="text-charcoal-gray pb-32">
        {/* Barra de progresso */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-stone-100 px-4 py-3">
          <MobileStepBar step={mobileStep} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-4 pt-4 space-y-4">
          {/* ── ETAPA 1: Dados de Entrega ── */}
          {mobileStep === 1 && (
            <>
              <AddressFormBlock />
              <BenefitsBlock />
            </>
          )}

          {/* ── ETAPA 2: Resumo + Pagamento ── */}
          {mobileStep === 2 && (
            <>
              {/* Mini-resumo do endereço (readonly) */}
              {isAddressComplete && (
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase text-sky-600 tracking-widest mb-1">Entregando em</p>
                    <p className="text-xs font-bold text-slate-700 truncate">
                      {getValues('street')}, {getValues('number')} — {getValues('neighborhood')}, {getValues('city')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMobileStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="text-[9px] font-black uppercase text-sky-500 hover:text-sky-700 shrink-0"
                  >
                    Editar
                  </button>
                </div>
              )}

              <SummaryAndPaymentBlock />
            </>
          )}

          {/* ── STICKY FOOTER MOBILE ── */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 px-4 py-3 shadow-2xl">
            {mobileStep === 1 ? (
              /* Etapa 1 → botão "Continuar" */
              <Button
                type="button"
                onClick={handleMobileNextStep}
                className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-base rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Continuar <ChevronRight className="h-5 w-5" />
              </Button>
            ) : (
              /* Etapa 2 → botão de pagamento + voltar */
              <div className="space-y-2">
                {paymentMethod === 'pix' && (
                  <Button
                    type="submit"
                    disabled={isSubmitting || !isAddressComplete}
                    className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-base rounded-2xl shadow-lg transition-all active:scale-95"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Finalizar com PIX"}
                  </Button>
                )}
                {paymentMethod === 'mercadopago' && (
                  <Button
                    type="submit"
                    disabled={isSubmitting || !isCreditCardEnabled || !isAddressComplete}
                    className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-base rounded-2xl shadow-lg transition-all active:scale-95"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Inserir Dados do Cartão →"}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => { setMobileStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="w-full flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 py-1 transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" /> Voltar para entrega
                </button>
              </div>
            )}
          </div>
        </form>

        <CouponsModal isOpen={isCouponsModalOpen} onOpenChange={setIsCouponsModalOpen} userPoints={userPoints} onRedemption={handleRedemption} />
      </div>
    );
  }

  // ============================================================
  // LAYOUT DESKTOP — 2 colunas (sem nenhuma alteração)
  // ============================================================
  return (
    <div className="container mx-auto px-4 md:px-6 py-4 md:py-10 text-charcoal-gray">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-4 md:space-y-12">
          <AddressFormBlock />
          <BenefitsBlock />
        </div>

        <div className="space-y-6 md:space-y-8 mt-6 lg:mt-0">
          <SummaryAndPaymentBlock />
        </div>
      </form>
      <CouponsModal isOpen={isCouponsModalOpen} onOpenChange={setIsCouponsModalOpen} userPoints={userPoints} onRedemption={handleRedemption} />
    </div>
  );
};

export default CheckoutPage;