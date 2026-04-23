// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// redeploy: v5 — valida CEP contra shipping_rates (bairro/cidade) e shipping_zones (faixa de CEP)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Busca dados do CEP no ViaCEP
 */
async function fetchViaCep(cleanedCep: string): Promise<any | null> {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return null
    const data = await response.json()
    if (data.erro) return null
    return data
  } catch {
    return null
  }
}

/**
 * Busca dados do CEP na BrasilAPI (fallback)
 */
async function fetchBrasilApi(cleanedCep: string): Promise<any | null> {
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanedCep}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!data || data.type === 'service_error') return null
    // Normalizar para o formato do ViaCEP
    return {
      cep: data.cep,
      logradouro: data.street || '',
      complemento: '',
      bairro: data.neighborhood || '',
      localidade: data.city || '',
      uf: data.state || '',
      ibge: data.ibge || '',
      gia: '',
      ddd: '',
      siafi: '',
    }
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const { cep } = await req.json()
    const cleanedCep = (cep || '').replace(/\D/g, '')

    if (cleanedCep.length !== 8) {
      return new Response(JSON.stringify({ error: 'CEP inválido. Informe 8 dígitos.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log('[validate-cep] buscando CEP:', cleanedCep)

    // ── 1. Buscar dados do endereço (ViaCEP → BrasilAPI) ──────────────────
    let addressData = await fetchViaCep(cleanedCep)

    if (!addressData) {
      console.log('[validate-cep] ViaCEP falhou, tentando BrasilAPI...')
      addressData = await fetchBrasilApi(cleanedCep)
    }

    if (!addressData) {
      console.log('[validate-cep] CEP não encontrado em nenhuma API:', cleanedCep)
      return new Response(JSON.stringify({ error: 'CEP não encontrado. Verifique e tente novamente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    console.log('[validate-cep] endereço encontrado:', addressData.localidade, '/', addressData.uf, '| bairro:', addressData.bairro || '(vazio)')

    // ── 2. Regra de Negócio: Apenas Paraná ───────────────────────────────
    if (addressData.uf !== 'PR') {
      console.log('[validate-cep] CEP fora do PR:', addressData.uf)
      return new Response(JSON.stringify({
        error: `No momento, realizamos entregas apenas no estado do Paraná. O CEP informado pertence a ${addressData.localidade} / ${addressData.uf}.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ── 3. Conectar ao Supabase para validar cobertura ────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const neighborhood = (addressData.bairro || '').trim()
    const city = (addressData.localidade || '').trim()

    // ── 4. Verificar na tabela shipping_rates (entrega local por bairro) ──
    let deliveryType: 'local' | 'correios' | null = null
    let shippingPrice: number | null = null

    if (neighborhood && city) {
      const { data: rateData } = await supabase
        .from('shipping_rates')
        .select('price')
        .filter('is_active', 'eq', true)
        .or(
          `and(neighborhood.ilike.${neighborhood},city.ilike.${city})`
        )
        .limit(1)
        .maybeSingle()

      // Fallback: usar a função get_shipping_rate que já tem lógica de unaccent + LIKE parcial
      if (!rateData) {
        const { data: rpcRate } = await supabase.rpc('get_shipping_rate', {
          p_neighborhood: neighborhood,
          p_city: city,
          p_cep: cleanedCep,
        })

        if (rpcRate !== null && rpcRate !== undefined && Number(rpcRate) > 0) {
          deliveryType = 'local'
          shippingPrice = Number(rpcRate)
          console.log('[validate-cep] cobertura local via get_shipping_rate:', shippingPrice)
        }
      } else {
        deliveryType = 'local'
        shippingPrice = Number(rateData.price)
        console.log('[validate-cep] cobertura local via shipping_rates:', shippingPrice)
      }
    }

    // ── 5. Se não achou na shipping_rates, verificar shipping_zones (transportadora) ──
    if (!deliveryType) {
      const { data: zones } = await supabase
        .from('shipping_zones')
        .select('price, transportadora, city')

      if (zones && zones.length > 0) {
        const cepNum = parseInt(cleanedCep, 10)
        const matchedZone = zones.find((zone: any) => {
          const start = parseInt((zone.cep_start || '').replace(/\D/g, ''), 10)
          const end = parseInt((zone.cep_end || '').replace(/\D/g, ''), 10)
          return cepNum >= start && cepNum <= end
        })

        if (matchedZone) {
          deliveryType = 'correios'
          shippingPrice = Number(matchedZone.price)
          console.log('[validate-cep] cobertura via transportadora:', matchedZone.transportadora, '| preço:', shippingPrice)
        }
      }
    }

    // ── 6. Se não tem cobertura em nenhuma tabela → retornar erro ─────────
    if (!deliveryType) {
      console.log('[validate-cep] sem cobertura para:', neighborhood, '/', city, '| CEP:', cleanedCep)
      return new Response(JSON.stringify({
        error: `Infelizmente ainda não realizamos entregas no bairro "${neighborhood || 'informado'}" em ${city}. Entre em contato pelo WhatsApp para verificar disponibilidade.`,
        neighborhood,
        city,
        uf: addressData.uf,
        noDelivery: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log('[validate-cep] sucesso:', city, '/', addressData.uf, '| bairro:', neighborhood, '| tipo:', deliveryType, '| frete:', shippingPrice)

    return new Response(JSON.stringify({
      ...addressData,
      deliveryType,
      shippingPrice,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[validate-cep] erro inesperado:', error)
    return new Response(JSON.stringify({ error: 'Erro inesperado ao buscar CEP.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
