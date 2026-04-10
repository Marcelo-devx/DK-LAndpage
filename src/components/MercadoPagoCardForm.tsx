import { memo, useEffect, useRef, useState } from 'react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { Loader2 } from 'lucide-react';

interface MercadoPagoCardFormProps {
  amount: number;
  onSubmit: (formData: any) => Promise<void>;
}

// React.memo evita re-renders desnecessários que desmontariam o iframe do Brick
const MercadoPagoCardForm = memo(({ amount, onSubmit }: MercadoPagoCardFormProps) => {
  const [mpReady, setMpReady] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mpInitialized, setMpInitialized] = useState(false);

  // Manter referência estável do onSubmit para não recriar o Brick quando o callback muda
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

  // Wrapper estável que delega para a ref — o Brick nunca vê a função mudar
  const stableOnSubmit = useRef(async (formData: any) => {
    return onSubmitRef.current(formData);
  }).current;

  useEffect(() => {
    const loadPublicKey = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'mercadopago_public_key')
          .maybeSingle();

        if (data?.value) {
          setMpPublicKey(data.value);
        } else {
          // Fallback: tentar usar variável de ambiente se não estiver no banco
          const envPublicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
          if (envPublicKey) {
            console.warn('[MercadoPagoCardForm] Usando VITE_MP_PUBLIC_KEY como fallback');
            setMpPublicKey(envPublicKey);
          } else {
            setLoadError('Public Key do Mercado Pago não configurada. Acesse o painel admin e configure a chave.');
          }
        }
      } catch (error) {
        console.error('[MercadoPagoCardForm] Erro ao carregar public key:', error);
        // Fallback: tentar usar variável de ambiente em caso de erro
        const envPublicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
        if (envPublicKey) {
          console.warn('[MercadoPagoCardForm] Usando VITE_MP_PUBLIC_KEY como fallback após erro');
          setMpPublicKey(envPublicKey);
        } else {
          setLoadError('Erro ao carregar configurações de pagamento.');
        }
      }
    };

    loadPublicKey();
  }, []);

  useEffect(() => {
    if (!mpPublicKey) return;

    if (!mpInitialized) {
      try {
        initMercadoPago(mpPublicKey, { locale: 'pt-BR' });
        setMpInitialized(true);
        console.log('[MercadoPagoCardForm] SDK inicializado com sucesso');
      } catch (error) {
        console.error('[MercadoPagoCardForm] Erro ao inicializar SDK:', error);
        setLoadError('Erro ao inicializar o formulário de pagamento. Tente recarregar a página.');
        return;
      }
    }

    const timer = setTimeout(() => setMpReady(true), 300);
    return () => clearTimeout(timer);
  }, [mpPublicKey, mpInitialized]);

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-red-600 text-sm font-bold">{loadError}</p>
        <p className="text-red-500 text-xs mt-2">Configure a chave em: Admin → Configurações → Mercado Pago Public Key</p>
      </div>
    );
  }

  if (!mpReady) {
    return (
      <div className="flex items-center justify-center py-12 bg-stone-50 rounded-2xl border border-stone-100">
        <Loader2 className="h-6 w-6 animate-spin text-sky-500 mr-3" />
        <span className="text-sm text-slate-700 font-medium">Carregando formulário seguro...</span>
      </div>
    );
  }

  return (
    <div className="mp-card-form-wrapper">
      <CardPayment
        initialization={{ amount }}
        customization={{
          paymentMethods: {
            minInstallments: 1,
            maxInstallments: 12,
          },
          visual: {
            style: {
              theme: 'flat',
              customVariables: {
                formBackgroundColor: '#ffffff',
                baseColor: '#0ea5e9',
                baseColorFirstVariant: '#0284c7',
                baseColorSecondVariant: '#0369a1',
                errorColor: '#ef4444',
                textPrimaryColor: '#0f172a',
                textSecondaryColor: '#64748b',
                inputBackgroundColor: '#f8fafc',
                borderRadiusSmall: '8px',
                borderRadiusMedium: '12px',
                borderRadiusLarge: '16px',
                fontSizeExtraSmall: '11px',
                fontSizeSmall: '13px',
                fontSizeMedium: '14px',
                fontSizeLarge: '16px',
              },
            },
          },
        }}
        onSubmit={stableOnSubmit}
        onError={(error) => {
          console.error('[MercadoPagoCardForm] Brick error:', error);
        }}
      />
    </div>
  );
});

MercadoPagoCardForm.displayName = 'MercadoPagoCardForm';

export default MercadoPagoCardForm;