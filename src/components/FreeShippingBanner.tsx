import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FreeShippingRule {
  id: number;
  shipping_price: number;
  min_order_value: number;
  is_active: boolean;
}

interface FreeShippingBannerProps {
  subtotal: number;
  baseShippingCost: number; // frete base calculado pelo banco (nunca zero por frete grátis)
  isFreeShippingByBenefitOrCoupon: boolean; // grátis por benefício/cupom → não exibe banner
}

let cachedRules: FreeShippingRule[] | null = null;

const FreeShippingBanner = ({ subtotal, baseShippingCost, isFreeShippingByBenefitOrCoupon }: FreeShippingBannerProps) => {
  const [rules, setRules] = useState<FreeShippingRule[]>(cachedRules ?? []);

  useEffect(() => {
    if (cachedRules) return;
    supabase
      .from('free_shipping_rules')
      .select('id, shipping_price, min_order_value, is_active')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) {
          cachedRules = data as FreeShippingRule[];
          setRules(cachedRules);
        }
      });
  }, []);

  // Não exibe se grátis por benefício/cupom (já tem outro aviso para isso)
  if (isFreeShippingByBenefitOrCoupon) return null;

  // Não exibe se o frete ainda não foi calculado
  if (baseShippingCost <= 0) return null;

  // Encontra a regra que corresponde ao frete base
  const rule = rules.find(r => Math.abs(r.shipping_price - baseShippingCost) < 0.01);
  if (!rule) return null;

  const remaining = rule.min_order_value - subtotal;
  const progress = Math.min(100, Math.round((subtotal / rule.min_order_value) * 100));
  const achieved = remaining <= 0;

  if (achieved) {
    return (
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">
            Frete grátis conquistado! 🎉
          </p>
          <p className="text-xs text-emerald-600 font-medium mt-0.5">
            Parabéns! Você atingiu o valor mínimo e ganhou frete grátis neste pedido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3.5 space-y-2.5">
      <div className="flex items-start gap-3">
        <Truck className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-sky-700">
            Frete grátis a partir de R$ {rule.min_order_value.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-sky-600 font-medium mt-0.5">
            Faltam{' '}
            <span className="font-black text-sky-800">
              R$ {remaining.toFixed(2).replace('.', ',')}
            </span>{' '}
            em produtos para você ganhar frete grátis!
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="w-full bg-sky-100 rounded-full h-2 overflow-hidden">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              progress >= 80 ? "bg-emerald-500" : "bg-sky-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-sky-400">
          <span>R$ 0</span>
          <span className={cn(progress >= 80 && "text-emerald-500")}>{progress}%</span>
          <span>R$ {rule.min_order_value.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
};

export default FreeShippingBanner;