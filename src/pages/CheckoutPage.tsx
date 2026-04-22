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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { showError, showLoading, dismissToast, showSuccess } from '@/utils/toast';
import { Loader2, Search, CreditCard, MessageSquare, MapPin, Gift, X, AlertTriangle, CheckCircle2, Sparkles, ChevronRight, ChevronLeft, Lock, Truck, Star, Package, Headphones, Calendar, Repeat2, ShoppingBag, Zap, Crown, type LucideIcon } from 'lucide-react';
import { getLocalCart, ItemType, clearLocalCart } from '@/utils/localCart';
import { maskCep, maskPhone, maskCpfCnpj } from '@/utils/masks';
import CouponsModal from '@/components/CouponsModal';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { differenceInDays, endOfWeek, isSameWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductImage from '@/components/ProductImage';
import MercadoPagoCardForm from '@/components/MercadoPagoCardForm';
import { useIsMobile } from '@/hooks/use-mobile';
import FreeShippingBanner from '@/components/FreeShippingBanner';
import { DeliveryAddressModal, type DeliveryAddress } from '@/components/DeliveryAddressModal';

// ─── Contato de suporte (mesmo do botão flutuante do WhatsApp) ───────────────
const SUPPORT_WHATSAPP_NUMBER = '595985981046';
const SUPPORT_UPDATE_MESSAGE = 'Olá! Gostaria de atualizar meus dados cadastrais (nome, e-mail, telefone ou CPF/CNPJ). 📋';
const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_UPDATE_MESSAGE)}`;

interface DisplayItem {
  id: number;
  itemId: number;
  itemType: ItemType;
  quantity: number;
  name: string;
  price: number;
  pixPrice: number | null;
  image_url: string;
  variant_label?: string;
}

interface Coupon {
  user_coupon_id: number;
  name: string;
  discount_value: number;
  minimum_order_value: number;
  expires_at: string;
}

const checkoutSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail para continuarmos.").email("Digite um e-mail válido para receber seu pedido."),
  first_name: z.string().trim().min(1, "Informe seu nome.").min(2, "Digite seu nome completo."),
  last_name: z.string().trim().min(1, "Informe seu sobrenome.").min(2, "Digite seu nome completo."),
  phone: z.string().min(14, "Informe um telefone válido.").max(15, "Informe um telefone válido."),
  cpf_cnpj: z.string().min(14, "Informe seu CPF ou CNPJ.").max(18, "Informe seu CPF ou CNPJ."),
  cep: z.string().min(9, "Informe seu CEP."),
  street: z.string().trim().min(1, "Informe a rua do endereço."),
  number: z.string().trim().min(1, "Informe o número do endereço."),
  complement: z.string().optional(),
  neighborhood: z.string().trim().min(1, "Informe o bairro."),
  city: z.string().trim().min(1, "Informe a cidade."),
  state: z.string().trim().min(2, "Informe a sigla do estado.").max(2, "Use a sigla do estado (ex: SC)"),
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

const getBenefitIcon = (benefit: string): LucideIcon => {
  const b = benefit.toLowerCase();
  if (b.includes('frete')) return Truck;
  if (b.includes('ponto')) return Star;
  if (b.includes('brinde')) return Package;
  if (b.includes('atendimento') || b.includes('suporte')) return Headphones;
  if (b.includes('aniversário') || b.includes('aniversario')) return Calendar;
  if (b.includes('recorrente') || b.includes('fidelidade')) return Repeat2;
  if (b.includes('pré-venda') || b.includes('pre-venda') || b.includes('acesso')) return Zap;
  if (b.includes('exclusiv') || b.includes('vip')) return Crown;
  if (b.includes('produto') || b.includes('desconto')) return ShoppingBag;
  return Gift;
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
  const [isShippingAvailable, setIsShippingAvailable] = useState(true);
  const [shippingErrorMessage, setShippingErrorMessage] = useState('');
  const [isCheckingShipping, setIsCheckingShipping] = useState(false);
  const [donationAmount, setDonationAmount] = useState<number>(0);
  const [tierName, setTierName] = useState<string>('');
  const [isAddressComplete, setIsAddressComplete] = useState<boolean>(false);
  const [tierBenefits, setTierBenefits] = useState<string[]>([]);

  // ── Endereço de entrega selecionado no modal (vem do sessionStorage) ──────
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  type RecentOrder = { created_at: string; benefits_used?: string | null };
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);

  const [showMpForm, setShowMpForm] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [cardFormAmount, setCardFormAmount] = useState<number>(0);
  const [showCouponReminderModal, setShowCouponReminderModal] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [shippingTrigger, setShippingTrigger] = useState(0);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  const isMountedRef = useRef(true);
  const showMpFormRef = useRef(false);
  const pendingOrderIdRef = useRef<number | null>(null);
  const couponSectionRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, setValue, getValues, watch, trigger, formState: { errors } } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  const paymentMethod = watch('payment_method');
  const watchedNeighborhood = watch('neighborhood');
  const watchedCity = watch('city');
  const watchedCep = watch('cep');
  const watchedAddressFields = watch(['email', 'first_name', 'last_name', 'phone', 'cpf_cnpj', 'cep', 'street', 'number', 'neighborhood', 'city', 'state', 'complement']);

  useEffect(() => {
    isMountedRef.current = true;
    window.scrollTo({ top: 0, behavior: 'instant' });
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
        ? supabase.from('product_variants').select('id, price, pix_price, flavor_id, color, size, ohms').in('id', variantIds)
        : Promise.resolve({ data: [] }),
    ]);

    const products = (productsRes as any).data;
    const promotions = (promotionsRes as any).data;
    const variants = (variantsRes as any).data;

    // Buscar nomes dos sabores
    const flavorIds = (variants || []).filter((v: any) => v.flavor_id).map((v: any) => v.flavor_id);
    const { data: flavorsData } = flavorIds.length > 0
      ? await supabase.from('flavors').select('id, name').in('id', flavorIds)
      : { data: [] };

    const finalItems = localCart.map((cartItem): DisplayItem | null => {
      if (cartItem.itemType === 'product') {
        const product = (productsRes as any).data?.find((p: any) => p.id === cartItem.itemId);
        if (!product) return null;

        let price = product.price ?? 0;
        let label = '';

        if (cartItem.variantId) {
          const variant = (variantsRes as any).data?.find((v: any) => v.id === cartItem.variantId);
          if (variant) {
            price = variant.price ?? 0;

            const fName = variant.flavor_id ? flavorsData?.find(f => f.id === variant.flavor_id)?.name : '';
            const parts: string[] = [];
            if (fName) parts.push(fName);
            if (variant.color) parts.push(variant.color);
            if (variant.size) parts.push(variant.size);
            if (variant.ohms) parts.push(variant.ohms);

            const built = parts.join(' · ').trim();
            if (built) {
              label = built;
            } else {
              label = 'Variação selecionada';
            }
          }
        }

        return {
          id: cartItem.itemId,
          itemId: cartItem.itemId,
          itemType: cartItem.itemType,
          quantity: cartItem.quantity,
          name: product.name,
          price: price,
          pixPrice: product.pix_price ?? null,
          image_url: product.image_url || '',
          variant_label: label || undefined,
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
          price: promo.price ?? 0,
          pixPrice: promo.pix_price ?? null,
          image_url: promo.image_url || '',
        };
      }
    }).filter((i): i is DisplayItem => i !== null);

    if (isMountedRef.current) setItems(finalItems);
  }, [safeNavigate]);

  // ── Helper: aplica endereço de entrega selecionado nos campos do form ──────
  const applyDeliveryAddress = useCallback((addr: DeliveryAddress) => {
    const opts = { shouldValidate: true, shouldDirty: true, shouldTouch: true } as const;
    setValue('cep', addr.cep ? maskCep(addr.cep) : '', opts);
    setValue('street', addr.street, opts);
    setValue('number', addr.number, opts);
    setValue('complement', addr.complement || '', opts);
    setValue('neighborhood', addr.neighborhood, opts);
    setValue('city', addr.city, opts);
    setValue('state', addr.state.toUpperCase(), opts);
  }, [setValue]);

  // ── Calcula frete diretamente a partir de um endereço (sem depender do watch) ──
  const calculateShippingFromAddress = useCallback(async (neighborhood: string, city: string, cep: string) => {
    if (!isMountedRef.current) return;

    const hasFreeShippingBenefit = selectedBenefits.some(b => b.toLowerCase().includes('frete grátis'));
    const hasFreeShippingCoupon = selectedCoupon?.name?.toLowerCase().includes('frete');

    if (hasFreeShippingBenefit || hasFreeShippingCoupon) {
      setShippingCost(0);
      setIsFreeShippingApplied(true);
      setIsShippingAvailable(true);
      setShippingErrorMessage('');
      return;
    }

    const rawCep = cep.replace(/\D/g, '');
    const hasValidCep = rawCep.length === 8;

    if (!city.trim() && !hasValidCep) return;

    setIsCheckingShipping(true);
    setShippingErrorMessage('');

    try {
      const { data, error } = await supabase.rpc('get_shipping_rate', {
        p_neighborhood: neighborhood.trim(),
        p_city: city.trim(),
        p_cep: hasValidCep ? rawCep : null,
      });
      if (!isMountedRef.current) return;

      if (!error && data !== null && data !== undefined && Number(data) > 0) {
        const base = Number(data);
        baseShippingCostRef.current = base;
        setIsShippingAvailable(true);
        setShippingErrorMessage('');

        // Aplica frete grátis por valor imediatamente
        const { data: rules } = await supabase
          .from('free_shipping_rules')
          .select('shipping_price, min_order_value')
          .eq('is_active', true);

        if (!isMountedRef.current) return;

        const rule = rules?.find((r: any) => Math.abs(r.shipping_price - base) < 0.01);
        // subtotal ainda pode ser 0 aqui (items ainda carregando), então usamos base diretamente
        // O efeito separado de frete grátis por valor vai corrigir depois se necessário
        setShippingCost(base);
        setIsFreeShippingApplied(false);
      } else {
        baseShippingCostRef.current = 0;
        setShippingCost(0);
        setIsShippingAvailable(false);
        setShippingErrorMessage(
          'Ainda não temos uma taxa de frete cadastrada para este endereço. Fale com a gente pelo WhatsApp para confirmar o valor antes de finalizar a compra.'
        );
      }
    } catch {
      if (isMountedRef.current) {
        baseShippingCostRef.current = 0;
        setShippingCost(0);
        setIsShippingAvailable(false);
        setShippingErrorMessage(
          'Não foi possível calcular o frete automaticamente. Recarregue a página ou fale com a gente pelo WhatsApp.'
        );
      }
    } finally {
      if (isMountedRef.current) setIsCheckingShipping(false);
    }
  }, [selectedBenefits, selectedCoupon]);

  const fetchUserData = useCallback(async (currentUser: any) => {
    const [profileRes, userCouponsRes, ordersRes] = await Promise.all([
      supabase.from('profiles').select('*, loyalty_tiers ( name, benefits )').eq('id', currentUser.id).single(),
      supabase.from('user_coupons').select('id, expires_at, coupon_id').eq('user_id', currentUser.id).eq('is_used', false).gt('expires_at', new Date().toISOString()),
      supabase.from('orders').select('created_at, benefits_used').eq('user_id', currentUser.id).neq('status', 'Cancelado').order('created_at', { ascending: false }).limit(10),
    ]);

    const profile = profileRes.data;
    if (profile && isMountedRef.current) {
      setIsCreditCardEnabled(profile.is_credit_card_enabled);
      if (profile.loyalty_tiers) { setTierName(profile.loyalty_tiers.name); setTierBenefits(profile.loyalty_tiers.benefits || []); }
      setValue('payment_method', profile.is_credit_card_enabled ? 'mercadopago' : 'pix');
      const fields: (keyof CheckoutFormData)[] = ['email', 'first_name', 'last_name', 'phone', 'cep', 'street', 'number', 'neighborhood', 'city', 'state', 'complement', 'cpf_cnpj'];
      const svOpts = { shouldValidate: true, shouldDirty: true, shouldTouch: true } as const;
      fields.forEach(f => {
        let val = profile[f] || '';
        if (f === 'email') val = currentUser.email || '';
        if (f === 'phone') val = val ? maskPhone(val) : '';
        if (f === 'cep') val = val ? maskCep(val) : '';
        if (f === 'cpf_cnpj') val = val ? maskCpfCnpj(val) : '';
        // @ts-ignore
        setValue(f, val, svOpts);
      });
      setUserPoints(profile.points);
    }

    // ── Verificar se há endereço selecionado no sessionStorage ────────────────
    // Sobrescreve os campos de endereço do perfil com o endereço escolhido no modal
    // e dispara o cálculo de frete IMEDIATAMENTE com os dados do endereço selecionado
    const savedAddressRaw = sessionStorage.getItem('selected_delivery_address');
    if (savedAddressRaw) {
      try {
        const savedAddress: DeliveryAddress = JSON.parse(savedAddressRaw);
        if (isMountedRef.current) {
          setSelectedDeliveryAddress(savedAddress);
          applyDeliveryAddress(savedAddress);
          // Calcula frete direto com os dados do endereço — sem esperar o watch reagir
          calculateShippingFromAddress(
            savedAddress.neighborhood,
            savedAddress.city,
            savedAddress.cep || ''
          );
        }
      } catch {
        sessionStorage.removeItem('selected_delivery_address');
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Busca os dados dos cupons separadamente para não depender da RLS da tabela coupons
    const rawUserCoupons = userCouponsRes.data || [];
    if (rawUserCoupons.length > 0 && isMountedRef.current) {
      const couponIds = rawUserCoupons.map((uc: any) => uc.coupon_id);
      const { data: couponsData } = await supabase
        .from('coupons')
        .select('id, name, discount_value, minimum_order_value')
        .in('id', couponIds);

      const mergedCoupons = rawUserCoupons
        .map((uc: any) => {
          const coupon = (couponsData || []).find((c: any) => c.id === uc.coupon_id);
          if (!coupon) return null;
          return {
            user_coupon_id: uc.id,
            name: coupon.name,
            discount_value: coupon.discount_value,
            minimum_order_value: coupon.minimum_order_value,
            expires_at: uc.expires_at,
          };
        })
        .filter(Boolean) as Coupon[];

      setCoupons(mergedCoupons);
    }

    if (ordersRes.data && isMountedRef.current) setRecentOrders(ordersRes.data);

    if (isMountedRef.current) setTimeout(() => {
      if (isMountedRef.current) {
        setProfileChecked(true);
        // Só dispara o shippingTrigger se NÃO há endereço do sessionStorage
        // (caso contrário o frete já foi calculado diretamente acima)
        if (!sessionStorage.getItem('selected_delivery_address')) {
          setTimeout(() => {
            if (isMountedRef.current) setShippingTrigger(t => t + 1);
          }, 200);
        }
      }
    }, 100);
  }, [setValue, applyDeliveryAddress, calculateShippingFromAddress]);

  // ── Handler: quando o usuário confirma um novo endereço no modal ──────────
  const handleAddressModalConfirm = useCallback((address: DeliveryAddress) => {
    sessionStorage.setItem('selected_delivery_address', JSON.stringify(address));
    setSelectedDeliveryAddress(address);
    applyDeliveryAddress(address);
    setIsAddressModalOpen(false);
    // Calcula frete imediatamente com os dados do novo endereço
    calculateShippingFromAddress(address.neighborhood, address.city, address.cep || '');
  }, [applyDeliveryAddress, calculateShippingFromAddress]);

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

        if (!u) {
          if (isMountedRef.current) safeNavigate('/login', { replace: true });
          clearTimeout(timeoutId);
          return;
        }

        if (isMountedRef.current) setUser(u);
        await fetchUserData(u);
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

  const baseShippingCostRef = useRef<number>(0);

  const calculateShipping = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (deliveryType === 'correios') {
      baseShippingCostRef.current = 0;
      setShippingCost(0);
      setIsFreeShippingApplied(false);
      setIsShippingAvailable(true);
      setShippingErrorMessage('');
      return;
    }

    const hasFreeShippingBenefit = selectedBenefits.some(b => b.toLowerCase().includes('frete grátis'));
    const hasFreeShippingCoupon = selectedCoupon?.name?.toLowerCase().includes('frete');

    if (hasFreeShippingBenefit || hasFreeShippingCoupon) {
      setShippingCost(0);
      setIsFreeShippingApplied(true);
      setIsShippingAvailable(true);
      setShippingErrorMessage('');
      return;
    }

    const formValues = getValues();
    const rawCep = (formValues.cep || '').replace(/\D/g, '');
    const hasValidCep = rawCep.length === 8;
    const city = formValues.city?.trim() || '';
    const neighborhood = formValues.neighborhood?.trim() || '';

    if (!city && !hasValidCep) {
      baseShippingCostRef.current = 0;
      setShippingCost(0);
      setIsFreeShippingApplied(false);
      setIsShippingAvailable(true);
      setShippingErrorMessage('');
      return;
    }

    setIsCheckingShipping(true);
    setShippingErrorMessage('');

    try {
      const { data, error } = await supabase.rpc('get_shipping_rate', {
        p_neighborhood: neighborhood,
        p_city: city,
        p_cep: hasValidCep ? rawCep : null,
      });
      if (!isMountedRef.current) return;

      if (!error && data !== null && data !== undefined && Number(data) > 0) {
        baseShippingCostRef.current = Number(data);
        setIsShippingAvailable(true);
        setShippingErrorMessage('');
      } else {
        baseShippingCostRef.current = 0;
        setShippingCost(0);
        setIsShippingAvailable(false);
        setShippingErrorMessage(
          'Ainda não temos uma taxa de frete cadastrada para este endereço. Fale com a gente pelo WhatsApp para confirmar o valor antes de finalizar a compra.'
        );
      }
    } catch {
      if (isMountedRef.current) {
        baseShippingCostRef.current = 0;
        setShippingCost(0);
        setIsShippingAvailable(false);
        setShippingErrorMessage(
          'Não foi possível calcular o frete automaticamente. Recarregue a página ou fale com a gente pelo WhatsApp.'
        );
      }
    } finally {
      if (isMountedRef.current) setIsCheckingShipping(false);
    }
  }, [deliveryType, selectedBenefits, selectedCoupon, getValues]);

  useEffect(() => {
    const timeoutId = setTimeout(calculateShipping, 500);
    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedNeighborhood, watchedCity, watchedCep, selectedBenefits, deliveryType, shippingTrigger]);

  useEffect(() => {
    const base = baseShippingCostRef.current;
    if (base <= 0) return;

    const hasFreeShippingBenefit = selectedBenefits.some(b => b.toLowerCase().includes('frete grátis'));
    const hasFreeShippingCoupon = selectedCoupon?.name?.toLowerCase().includes('frete');
    if (hasFreeShippingBenefit || hasFreeShippingCoupon) return;

    const applyFreeShippingByValue = async () => {
      const { data } = await supabase
        .from('free_shipping_rules')
        .select('shipping_price, min_order_value')
        .eq('is_active', true);

      if (!isMountedRef.current || !data) return;

      const rule = data.find((r: any) => Math.abs(r.shipping_price - base) < 0.01);
      const effectiveSubtotal = Math.max(0, subtotal - discount);
      if (rule && effectiveSubtotal >= rule.min_order_value) {
        setShippingCost(0);
        setIsFreeShippingApplied(true);
      } else {
        setShippingCost(base);
        setIsFreeShippingApplied(false);
      }
    };

    applyFreeShippingByValue();
  }, [subtotal, selectedBenefits, selectedCoupon]);

  const handleMobileNextStep = async () => {
    const valid = await trigger([
      'email', 'first_name', 'last_name', 'phone', 'cpf_cnpj',
      'cep', 'street', 'number', 'neighborhood', 'city', 'state',
    ]);
    if (!valid) {
      showError("Confira os dados obrigatórios da entrega antes de continuar. Preencha os campos marcados com *.");
      return;
    }
    setMobileStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const syncAddressToProfile = async (data: CheckoutFormData) => {
    if (!user) return;
    try {
      await supabase.from('profiles').update({
        cep: data.cep.replace(/\D/g, ''),
        street: data.street.trim(),
        number: data.number.trim(),
        complement: data.complement?.trim() || null,
        neighborhood: data.neighborhood.trim(),
        city: data.city.trim(),
        state: data.state.trim().toUpperCase(),
        phone: data.phone.replace(/\D/g, ''),
        cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ''),
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
      }).eq('id', user.id);
    } catch (e) {
      logger.warn('[CheckoutPage] syncAddressToProfile silently failed:', e);
    }
  };

  const handlePixPayment = async (data: CheckoutFormData) => {
    const toastId = showLoading("Criando seu pedido PIX...");
    try {
      const cartItems = getLocalCart();
      if (cartItems.length === 0) {
        throw new Error('Seu carrinho está vazio. Adicione produtos antes de finalizar o pedido.');
      }

      if (!isShippingAvailable && !isFreeShippingApplied) {
        throw new Error(shippingErrorMessage || 'Não conseguimos calcular o frete para esse endereço. Confira o bairro e a cidade ou fale com a gente para ajudar você.');
      }
      const formValid = await trigger(['email', 'first_name', 'last_name', 'phone', 'cpf_cnpj', 'cep', 'street', 'number', 'neighborhood', 'city', 'state']);
      if (!formValid) {
        throw new Error('Confira os campos obrigatórios marcados com * antes de finalizar o pedido.');
      }

      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

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
      const createdOrderId: number = typeof raw === 'string' ? Number(raw) : raw;

      syncAddressToProfile(data);

      if (!isMountedRef.current) return;
      dismissToast(toastId);
      clearLocalCart();
      sessionStorage.removeItem('mp_pending_order_id');
      sessionStorage.removeItem('selected_delivery_address');

      safeNavigate(`/confirmacao-pedido/${createdOrderId}`);
    } catch (e: any) {
      if (isMountedRef.current) {
        dismissToast(toastId);
        showError(e.message || "Erro ao criar pedido PIX.");
      }
    }
  };

  const handlePrepareCardPayment = async (data: CheckoutFormData) => {
    const cartItems = getLocalCart();
    if (cartItems.length === 0) {
      showError('Seu carrinho está vazio. Adicione produtos antes de finalizar o pedido.');
      return;
    }

    if (!isAddressComplete) { showError("Preencha todos os dados de entrega."); return; }
    if (!isShippingAvailable && !isFreeShippingApplied) {
      showError(shippingErrorMessage || 'Não conseguimos calcular o frete para esse endereço. Confira o bairro e a cidade ou fale com a gente para ajudar você.');
      return;
    }
    const formValid = await trigger(['email', 'first_name', 'last_name', 'phone', 'cpf_cnpj', 'cep', 'street', 'number', 'neighborhood', 'city', 'state']);
    if (!formValid) {
      showError('Confira os campos obrigatórios marcados com * antes de finalizar o pedido.');
      return;
    }
    if (!user) { showError('Sessão expirada. Faça login novamente.'); return; }

    const toastId = showLoading("Preparando pagamento...");

    try {
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
      const orderId: number = typeof raw === 'string' ? Number(raw) : raw;

      if (!orderId || !Number.isFinite(Number(orderId))) throw new Error('Não foi possível criar o pedido.');

      syncAddressToProfile(data);

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
      sessionStorage.setItem('mp_pending_order_id', String(orderId));

    } catch (e: any) {
      dismissToast(toastId);
      showError(e?.message || "Erro ao preparar pagamento.");
    }
  };

  const handleMpCardSubmit = useCallback(async (cardBrickResult: any) => {
    if (!pendingOrderIdRef.current) { showError("Pedido não encontrado. Tente novamente."); return; }

    const currentOrderId = pendingOrderIdRef.current;

    try {
      const { data: orderCheck, error: orderCheckError } = await supabase
        .from('orders')
        .select('status, total_price')
        .eq('id', currentOrderId)
        .single();

      if (orderCheckError || !orderCheck) {
        throw new Error('Pedido não encontrado.');
      }

      if (orderCheck.status === 'Em Preparação' || orderCheck.status === 'Finalizada' || orderCheck.status === 'Entregue') {
        clearLocalCart();
        sessionStorage.removeItem('mp_pending_order_id');
        sessionStorage.removeItem('selected_delivery_address');
        showSuccess('Pagamento já processado! 🎉');
        safeNavigate(`/confirmacao-pedido/${currentOrderId}`);
        return;
      }

      if (orderCheck.status === 'Cancelado') {
        throw new Error('Este pedido foi cancelado. Crie um novo pedido.');
      }

      const finalTotal = Number(orderCheck.total_price || 0);
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
      sessionStorage.removeItem('selected_delivery_address');
      showSuccess('Pagamento aprovado! 🎉');

      safeNavigate(`/confirmacao-pedido/${currentOrderId}`);
    } catch (e: any) {
      showError(e?.message || "Pagamento recusado. Verifique os dados do cartão e tente novamente.");
      throw e;
    }
  }, [getValues, safeNavigate]);

  const onSubmit = async (data: CheckoutFormData) => {
    if (!isMountedRef.current) return;
    if (!isShippingAvailable && !isFreeShippingApplied) {
      showError(shippingErrorMessage || 'Não conseguimos calcular o frete para esse endereço. Confira o bairro e a cidade ou fale com a gente para ajudar você.');
      return;
    }
    const formValid = await trigger(['email', 'first_name', 'last_name', 'phone', 'cpf_cnpj', 'cep', 'street', 'number', 'neighborhood', 'city', 'state']);
    if (!formValid) {
      showError('Confira os campos obrigatórios marcados com * antes de finalizar o pedido.');
      return;
    }
    if (data.payment_method === 'pix') {
      setIsSubmitting(true);
      await handlePixPayment(data);
      if (isMountedRef.current) setIsSubmitting(false);
    } else {
      setIsSubmitting(true);
      await handlePrepareCardPayment(data);
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const handleCardButtonClick = () => {
    if (selectedCoupon !== null || coupons.length === 0 || !tierName) {
      handleSubmit(onSubmit)();
      return;
    }
    setShowCouponReminderModal(true);
  };

  const handleApplyCouponFromModal = () => {
    setShowCouponReminderModal(false);
    setTimeout(() => {
      couponSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (couponSectionRef.current) {
        couponSectionRef.current.classList.add('ring-2', 'ring-sky-400', 'ring-offset-2', 'rounded-2xl');
        setTimeout(() => {
          couponSectionRef.current?.classList.remove('ring-2', 'ring-sky-400', 'ring-offset-2', 'rounded-2xl');
        }, 2500);
      }
    }, 150);
  };

  const handleContinueWithoutCoupon = () => {
    setShowCouponReminderModal(false);
    handleSubmit(onSubmit)();
  };

  // Bloco: doação solidária (card-botão que abre o modal)
  const DonationBlock = () => (
    <button
      type="button"
      onClick={() => setIsDonationModalOpen(true)}
      className="w-full text-left rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors p-4 flex items-center gap-4 group"
    >
      <div className="p-2.5 bg-rose-100 group-hover:bg-rose-200 rounded-xl shrink-0 transition-colors">
        <Gift className="h-5 w-5 text-rose-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-0.5">Doação Solidária</p>
        {donationAmount > 0 ? (
          <p className="text-sm font-black text-rose-700">
            R$ {donationAmount.toFixed(2).replace('.', ',')} selecionado ✓
          </p>
        ) : (
          <p className="text-xs text-rose-500 font-medium">Contribua com R$ 2, R$ 5 ou R$ 10</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-rose-400 group-hover:text-rose-600 shrink-0 transition-colors" />
    </button>
  );

  // Bloco: formulário de endereço
  const AddressFormBlock = () => {
    // ── Quando há endereço selecionado no modal: mostra só o card compacto ──
    if (selectedDeliveryAddress) {
      return (
        <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-stone-50 border-b border-stone-100 p-6 md:p-8">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-sky-100 rounded-2xl"><MapPin className="h-6 w-6 text-sky-600" /></div>
              <CardTitle className="font-black text-xl md:text-2xl uppercase tracking-tighter italic">Dados de Entrega.</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 md:p-8 space-y-4">
            <div className="rounded-2xl border-2 border-sky-400 bg-sky-50 p-5 flex items-start gap-4">
              <div className="p-2.5 bg-sky-100 rounded-xl shrink-0">
                <MapPin className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-1.5">
                  📍 Entregando em
                  {selectedDeliveryAddress.label && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-sky-200 text-sky-800 text-[9px]">
                      {selectedDeliveryAddress.label}
                    </span>
                  )}
                </p>
                <p className="text-sm font-black text-slate-800 leading-snug">
                  {selectedDeliveryAddress.street}, {selectedDeliveryAddress.number}
                  {selectedDeliveryAddress.complement ? `, ${selectedDeliveryAddress.complement}` : ''}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {selectedDeliveryAddress.neighborhood} — {selectedDeliveryAddress.city}, {selectedDeliveryAddress.state}
                  {selectedDeliveryAddress.cep ? ` · CEP ${maskCep(selectedDeliveryAddress.cep)}` : ''}
                </p>
                {/* Frete */}
                <div className="mt-3 pt-3 border-t border-sky-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Frete</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">
                    {isFreeShippingApplied
                      ? <span className="text-emerald-600">Frete grátis ✓</span>
                      : isCheckingShipping
                        ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando...</span>
                        : shippingCost > 0
                          ? `R$ ${shippingCost.toFixed(2).replace('.', ',')}`
                          : shippingErrorMessage
                            ? <span className="text-amber-600 text-xs">{shippingErrorMessage}</span>
                            : 'Calculando...'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="text-[10px] font-black uppercase tracking-widest text-sky-500 hover:text-sky-700 shrink-0 transition-colors border border-sky-300 rounded-lg px-2.5 py-1.5 hover:bg-sky-100"
              >
                Alterar
              </button>
            </div>

            {/* Banner frete grátis dentro do card de entrega */}
            <FreeShippingBanner
              subtotal={subtotal}
              discount={discount}
              baseShippingCost={baseShippingCostRef.current}
              isFreeShippingByBenefitOrCoupon={
                selectedBenefits.some(b => b.toLowerCase().includes('frete grátis')) ||
                (selectedCoupon?.name?.toLowerCase().includes('frete') ?? false)
              }
            />
          </CardContent>
        </Card>
      );
    }

    // ── Sem endereço do modal: mostra o formulário completo ──────────────────
    return (
    <Card className="bg-white border-stone-200 shadow-xl rounded-[2rem] overflow-hidden">
      <CardHeader className="bg-stone-50 border-b border-stone-100 p-6 md:p-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-sky-100 rounded-2xl"><MapPin className="h-6 w-6 text-sky-600" /></div>
          <CardTitle className="font-black text-xl md:text-2xl uppercase tracking-tighter italic">Dados de Entrega.</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-8 space-y-4 md:space-y-6">
        {/* Aviso: dados pessoais bloqueados */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 mb-1">
              Dados cadastrais bloqueados
            </p>
            <p className="text-[11px] text-amber-800 font-medium leading-snug mb-3">
              Por segurança, seus dados pessoais e endereço não podem ser alterados aqui. Se precisar atualizar, fale com nosso suporte.
            </p>
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-[10px] font-black uppercase tracking-widest transition-colors active:scale-95"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Falar com o suporte
            </a>
          </div>
        </div>

        <div>
          <Label className="text-[10px] uppercase text-slate-500">E-mail <span className="text-red-500">*</span></Label>
          <Input
            {...register('email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            readOnly
            tabIndex={-1}
            className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {errors.email && <p className="text-xs text-red-500 font-bold">{errors.email.message}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Nome <span className="text-red-500">*</span></Label>
            <Input
              {...register('first_name')}
              autoComplete="given-name"
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {errors.first_name && <p className="text-xs text-red-500 font-bold">{errors.first_name.message}</p>}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Sobrenome <span className="text-red-500">*</span></Label>
            <Input
              {...register('last_name')}
              autoComplete="family-name"
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {errors.last_name && <p className="text-xs text-red-500 font-bold">{errors.last_name.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Telefone <span className="text-red-500">*</span></Label>
            <Input
              {...register('phone')}
              inputMode="tel"
              autoComplete="tel"
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {errors.phone && <p className="text-xs text-red-500 font-bold">{errors.phone.message}</p>}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-slate-500">CPF/CNPJ <span className="text-red-500">*</span></Label>
            <Input
              {...register('cpf_cnpj')}
              inputMode="numeric"
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {errors.cpf_cnpj && <p className="text-xs text-red-500 font-bold">{errors.cpf_cnpj.message}</p>}
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-slate-400">CEP <span className="text-red-500">*</span></Label>
          <div className="flex gap-2">
            <Input
              {...register('cep')}
              inputMode="numeric"
              autoComplete="postal-code"
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              type="button"
              size="icon"
              disabled
              tabIndex={-1}
              className="bg-stone-200 text-slate-400 hover:bg-stone-200 h-10 w-12 shrink-0 cursor-not-allowed"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {errors.cep && <p className="text-xs text-red-500 font-bold">{errors.cep.message}</p>}
        </div>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <div className="col-span-2">
            <Label className="text-[10px] uppercase text-slate-500">Rua <span className="text-red-500">*</span></Label>
            <Input
              {...register('street')}
              autoComplete="street-address"
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {errors.street && <p className="text-xs text-red-500 font-bold">{errors.street.message}</p>}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Número <span className="text-red-500">*</span></Label>
            <Input
              {...register('number')}
              inputMode="numeric"
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {errors.number && <p className="text-xs text-red-500 font-bold">{errors.number.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Bairro <span className="text-red-500">*</span></Label>
            <Input
              {...register('neighborhood')}
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {errors.neighborhood && <p className="text-xs text-red-500 font-bold">{errors.neighborhood.message}</p>}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-slate-500">Cidade <span className="text-red-500">*</span></Label>
            <Input
              {...register('city')}
              autoComplete="address-level2"
              readOnly
              tabIndex={-1}
              className="text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {errors.city && <p className="text-xs text-red-500 font-bold">{errors.city.message}</p>}
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-slate-500">Estado (sigla) <span className="text-red-500">*</span></Label>
          <Input
            {...register('state')}
            placeholder="Ex: SC"
            maxLength={2}
            readOnly
            tabIndex={-1}
            autoComplete="address-level1"
            className="uppercase text-base md:text-sm bg-stone-100 text-slate-500 cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {errors.state && <p className="text-xs text-red-500 font-bold">{errors.state.message}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Frete</p>
              <p className="text-sm font-medium text-slate-600">
                {isFreeShippingApplied
                  ? 'Frete grátis aplicado'
                  : isCheckingShipping
                    ? 'Calculando frete...'
                    : shippingCost > 0
                      ? `R$ ${shippingCost.toFixed(2).replace('.', ',')}`
                      : shippingErrorMessage
                        ? 'Indisponível para este endereço'
                        : 'Aguardando validação do endereço'}
              </p>
            </div>
            {isFreeShippingApplied && <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Grátis</span>}
          </div>
          {shippingErrorMessage && !isFreeShippingApplied && !isCheckingShipping && (
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm font-black uppercase text-amber-800">Frete não disponível</AlertTitle>
              <AlertDescription className="text-sm text-amber-700">
                {shippingErrorMessage}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Banner frete grátis dentro do card de entrega */}
        <FreeShippingBanner
          subtotal={subtotal}
          discount={discount}
          baseShippingCost={baseShippingCostRef.current}
          isFreeShippingByBenefitOrCoupon={
            selectedBenefits.some(b => b.toLowerCase().includes('frete grátis')) ||
            (selectedCoupon?.name?.toLowerCase().includes('frete') ?? false)
          }
        />
      </CardContent>
    </Card>
    );
  };

  // Bloco: benefícios do clube
  const BenefitsBlock = () => (
    <>
      {tierBenefits.length > 0 && (
        <div className="bg-slate-950 border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Crown className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span className="font-black text-xs uppercase tracking-widest text-white">Privilégios {tierName}</span>
            </div>
            <span className="text-[8px] font-black text-sky-500/70 uppercase tracking-widest">Clube DK</span>
          </div>

          <div className="p-3 grid grid-cols-1 gap-1.5">
            {tierBenefits.map(benefit => {
              const selectable = isSelectableBenefit(benefit);
              const info = getBenefitInfo(benefit);
              const isUsed = info.status === 'used';
              const isSelected = selectedBenefits.includes(benefit);
              const Icon = getBenefitIcon(benefit);

              if (selectable) {
                return (
                  <label
                    key={benefit}
                    htmlFor={benefit}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200",
                      isUsed
                        ? "opacity-35 border-white/5 bg-white/[0.02] cursor-not-allowed"
                        : isSelected
                          ? "border-sky-500/40 bg-sky-500/10 cursor-pointer"
                          : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-sky-500/20 cursor-pointer"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      isUsed ? "bg-white/5" : isSelected ? "bg-sky-500/20" : "bg-white/5"
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", isUsed ? "text-slate-600" : isSelected ? "text-sky-400" : "text-slate-400")} />
                    </div>

                    <span className={cn(
                      "text-[11px] font-black uppercase tracking-tight flex-1 leading-none",
                      isUsed ? "text-slate-600" : isSelected ? "text-sky-300" : "text-slate-300"
                    )}>
                      {benefit}
                    </span>

                    <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0", info.color)}>
                      {info.label}
                    </span>

                    <Checkbox
                      id={benefit}
                      checked={isSelected}
                      disabled={isUsed}
                      onCheckedChange={(checked) => {
                        setSelectedBenefits(prev => checked ? [...prev, benefit] : prev.filter(b => b !== benefit));
                      }}
                      className="h-4 w-4 shrink-0 border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                    />
                  </label>
                );
              }

              return (
                <div key={benefit} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tight leading-none flex-1">{benefit}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/60 shrink-0" />
                </div>
              );
            })}
          </div>

          <p className="text-[8px] text-slate-700 font-medium uppercase tracking-widest text-center pb-2.5">
            Benefícios do seu nível de fidelidade
          </p>
        </div>
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
                  {i.variant_label && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[9px] font-black uppercase tracking-wide">
                      🏷 {i.variant_label}
                    </span>
                  )}
                  <p className="text-[9px] text-slate-400 font-bold mt-1">QTD: {i.quantity}</p>
                </div>
              </div>
              <p className="font-black text-sky-600 text-sm">R$ {(getItemPrice(i) * i.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div ref={couponSectionRef} className="space-y-2 transition-all duration-300">
          <Label className="text-[10px] uppercase text-slate-400">Cupom</Label>
          <Select onValueChange={handleCouponChange} value={selectedCoupon?.user_coupon_id.toString() || 'none'}>
            <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Aplicar cupom" /></SelectTrigger>
            <SelectContent>
              {coupons.map(c => {
                const daysLeft = differenceInDays(new Date(c.expires_at), new Date());
                const validityLabel = `Válido até ${new Date(c.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                const daysText = daysLeft <= 0 ? 'Expirado' : `expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`;
                return (
                  <SelectItem key={c.user_coupon_id} value={c.user_coupon_id.toString()}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-[10px] text-slate-500">{validityLabel} ({daysText})</span>
                    </div>
                  </SelectItem>
                );
              })}
              <SelectItem value="none">Nenhum</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-2">
            <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
            <p className="text-[11px] text-amber-700 font-medium leading-snug">
              O valor mínimo de compra é calculado sobre os <span className="font-black">produtos</span>, não incluindo o valor do frete.
            </p>
          </div>
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

        {/* Botões de submit — visíveis apenas no desktop */}
        <div className="hidden md:block space-y-3">
          {paymentMethod === 'pix' && (
            <Button type="submit" disabled={isSubmitting || isCheckingShipping || !isAddressComplete || (!isShippingAvailable && !isFreeShippingApplied)} className="w-full h-16 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95">
              {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : isCheckingShipping ? <><Loader2 className="animate-spin h-5 w-5 mr-2" />Calculando frete...</> : "Finalizar com PIX"}
            </Button>
          )}
          {paymentMethod === 'mercadopago' && (
            <Button type="button" onClick={handleCardButtonClick} disabled={isSubmitting || isCheckingShipping || !isCreditCardEnabled || !isAddressComplete || (!isShippingAvailable && !isFreeShippingApplied)} className="w-full h-16 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95">
              {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : isCheckingShipping ? <><Loader2 className="animate-spin h-5 w-5 mr-2" />Calculando frete...</> : "Inserir Dados do Cartão →"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // ── Modal de endereço (reutilizado no checkout para "Alterar") ────────────
  const AddressModalForCheckout = () => (
    <DeliveryAddressModal
      isOpen={isAddressModalOpen}
      onOpenChange={setIsAddressModalOpen}
      onConfirm={handleAddressModalConfirm}
    />
  );

  // ── Modal de Doação Solidária ─────────────────────────────────────────────
  const DonationModal = () => (
    <Dialog open={isDonationModalOpen} onOpenChange={setIsDonationModalOpen}>
      <DialogContent className="sm:max-w-sm bg-white rounded-[2rem] shadow-2xl border-stone-200">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
            <Gift className="h-7 w-7 text-rose-500" />
          </div>
          <DialogTitle className="font-black text-2xl uppercase tracking-tighter italic text-charcoal-gray">
            Doação Solidária 💝
          </DialogTitle>
          <DialogDescription className="text-slate-600 font-medium mt-1 text-sm">
            Contribua com um valor simbólico e ajude quem mais precisa. 100% do valor vai direto para a causa.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-3 gap-3">
          {[2, 5, 10].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => setDonationAmount(prev => prev === val ? 0 : val)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 h-20 rounded-2xl border-2 font-black transition-all active:scale-95",
                donationAmount === val
                  ? "border-rose-400 bg-rose-500 text-white shadow-lg"
                  : "border-stone-200 bg-stone-50 text-slate-700 hover:border-rose-300 hover:bg-rose-50"
              )}
            >
              <span className="text-lg">R$</span>
              <span className="text-2xl leading-none">{val}</span>
            </button>
          ))}
        </div>

        {donationAmount > 0 && (
          <p className="text-center text-xs text-rose-600 font-black uppercase tracking-widest mt-1">
            ✓ R$ {donationAmount.toFixed(2).replace('.', ',')} selecionado
          </p>
        )}

        <DialogFooter className="flex flex-col gap-2 mt-2 sm:flex-col">
          <Button
            type="button"
            onClick={() => setIsDonationModalOpen(false)}
            className="w-full h-12 bg-rose-500 hover:bg-rose-400 text-white font-black uppercase tracking-widest rounded-xl shadow-md"
          >
            {donationAmount > 0 ? 'Confirmar Doação ✓' : 'Fechar'}
          </Button>
          {donationAmount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setDonationAmount(0); setIsDonationModalOpen(false); }}
              className="w-full h-10 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest"
            >
              Remover doação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
              <DonationBlock />
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
              <Button
                type="button"
                onClick={handleMobileNextStep}
                className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-base rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Continuar <ChevronRight className="h-5 w-5" />
              </Button>
            ) : (
              <div className="space-y-2">
                {paymentMethod === 'pix' && (
                  <Button
                    type="submit"
                    disabled={isSubmitting || isCheckingShipping || !isAddressComplete || (!isShippingAvailable && !isFreeShippingApplied)}
                    className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-base rounded-2xl shadow-lg transition-all active:scale-95"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : isCheckingShipping ? <><Loader2 className="animate-spin h-5 w-5 mr-2" />Calculando frete...</> : "Finalizar com PIX"}
                  </Button>
                )}
                {paymentMethod === 'mercadopago' && (
                  <Button
                    type="button"
                    onClick={handleCardButtonClick}
                    disabled={isSubmitting || isCheckingShipping || !isCreditCardEnabled || !isAddressComplete || (!isShippingAvailable && !isFreeShippingApplied)}
                    className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest text-base rounded-2xl shadow-lg transition-all active:scale-95"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : isCheckingShipping ? <><Loader2 className="animate-spin h-5 w-5 mr-2" />Calculando frete...</> : "Inserir Dados do Cartão →"}
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

        {/* Modal de lembrete de cupom */}
        <Dialog open={showCouponReminderModal} onOpenChange={setShowCouponReminderModal}>
          <DialogContent className="sm:max-w-md bg-white rounded-[2rem] shadow-2xl border-stone-200">
            <DialogHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 border border-sky-100">
                <Gift className="h-7 w-7 text-sky-500" />
              </div>
              <DialogTitle className="font-black text-2xl uppercase tracking-tighter italic text-charcoal-gray">
                Você tem cupons! 🎟️
              </DialogTitle>
              <DialogDescription className="text-slate-600 font-medium mt-1">
                Você tem <span className="font-black text-sky-600">{coupons.length} cupom{coupons.length > 1 ? 'ns' : ''}</span> do clube disponível{coupons.length > 1 ? 'is' : ''}. Deseja aplicar um desconto antes de pagar?
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {coupons.map(c => (
                <div key={c.user_coupon_id} className="flex items-center justify-between bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                  <span className="text-xs font-black uppercase tracking-tight text-slate-700">{c.name}</span>
                  <span className="text-sm font-black text-sky-600">-R$ {c.discount_value.toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>

            <DialogFooter className="flex flex-col gap-2 mt-4 sm:flex-col">
              <Button
                onClick={handleApplyCouponFromModal}
                className="w-full h-12 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest rounded-xl shadow-md"
              >
                Aplicar Cupom
              </Button>
              <Button
                variant="outline"
                onClick={handleContinueWithoutCoupon}
                className="w-full h-12 font-bold text-slate-500 rounded-xl border-stone-200"
              >
                Continuar sem desconto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AddressModalForCheckout />
        <DonationModal />
        <CouponsModal isOpen={isCouponsModalOpen} onOpenChange={setIsCouponsModalOpen} userPoints={userPoints} onRedemption={handleRedemption} />
      </div>
    );
  }

  // ============================================================
  // LAYOUT DESKTOP — 2 colunas
  // ============================================================
  return (
    <div className="container mx-auto px-4 md:px-6 py-4 md:py-10 text-charcoal-gray">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-4 md:space-y-12">
          <AddressFormBlock />
          <DonationBlock />
          <BenefitsBlock />
        </div>

        <div className="space-y-6 md:space-y-8 mt-6 lg:mt-0">
          <SummaryAndPaymentBlock />
        </div>
      </form>

      {/* Modal de lembrete de cupom */}
      <Dialog open={showCouponReminderModal} onOpenChange={setShowCouponReminderModal}>
        <DialogContent className="sm:max-w-md bg-white rounded-[2rem] shadow-2xl border-stone-200">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 border border-sky-100">
              <Gift className="h-7 w-7 text-sky-500" />
            </div>
            <DialogTitle className="font-black text-2xl uppercase tracking-tighter italic text-charcoal-gray">
              Você tem cupons! 🎟️
            </DialogTitle>
            <DialogDescription className="text-slate-600 font-medium mt-1">
              Você tem <span className="font-black text-sky-600">{coupons.length} cupom{coupons.length > 1 ? 'ns' : ''}</span> do clube disponível{coupons.length > 1 ? 'is' : ''}. Deseja aplicar um desconto antes de pagar?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
            {coupons.map(c => (
              <div key={c.user_coupon_id} className="flex items-center justify-between bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                <span className="text-xs font-black uppercase tracking-tight text-slate-700">{c.name}</span>
                <span className="text-sm font-black text-sky-600">-R$ {c.discount_value.toFixed(2).replace('.', ',')}</span>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col gap-2 mt-4 sm:flex-col">
            <Button
              onClick={handleApplyCouponFromModal}
              className="w-full h-12 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest rounded-xl shadow-md"
            >
              Aplicar Cupom
            </Button>
            <Button
              variant="outline"
              onClick={handleContinueWithoutCoupon}
              className="w-full h-12 font-bold text-slate-500 rounded-xl border-stone-200"
            >
              Continuar sem desconto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddressModalForCheckout />
      <DonationModal />
      <CouponsModal isOpen={isCouponsModalOpen} onOpenChange={setIsCouponsModalOpen} userPoints={userPoints} onRedemption={handleRedemption} />
    </div>
  );
};

export default CheckoutPage;