// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// redeploy: v3 — fallback de bairro por faixa de CEP (Centro de Curitiba e afins)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Quando o ViaCEP devolve `bairro` vazio (acontece em muitos CEPs genéricos
 * do Centro de Curitiba, tipo 80010-000, 80020-000, 80060-000...), inferimos
 * o bairro pela faixa do CEP com base na divisão oficial dos Correios.
 *
 * Faixa do Centro de Curitiba: 80010-000 a 80060-999
 * Centro Cívico: 80030-000 a 80035-999 (fica dentro da faixa acima, mas tem
 * CEPs específicos — como o ViaCEP já identifica esses, só caímos aqui no
 * fallback quando realmente não veio bairro).
 */
function inferNeighborhoodFromCep(cleanedCep: string, city: string, uf: string): string {
  if (uf !== 'PR') return ''
  const normalizedCity = (city || '').trim().toLowerCase()
  if (normalizedCity !== 'curitiba') return ''

  const cepNum = parseInt(cleanedCep, 10)
  if (!Number.isFinite(cepNum)) return ''

  // Centro Cívico: 80030-000 a 80035-999
  if (cepNum >= 80030000 && cepNum <= 80035999) return 'Centro Cívico'

  // Centro (faixa geral): 80010-000 a 80060-999
  if (cepNum >= 80010000 && cepNum <= 80060999) return 'Centro'

  return ''
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

    // Fetch from ViaCEP
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`)
    if (!viaCepResponse.ok) {
      console.error('[validate-cep] ViaCEP retornou status:', viaCepResponse.status)
      return new Response(JSON.stringify({ error: 'Serviço de CEP indisponível. Tente novamente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      })
    }

    const addressData = await viaCepResponse.json()

    if (addressData.erro) {
      console.log('[validate-cep] CEP não encontrado:', cleanedCep)
      return new Response(JSON.stringify({ error: 'CEP não encontrado. Verifique e tente novamente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    console.log('[validate-cep] endereço encontrado:', addressData.localidade, '/', addressData.uf, '| bairro:', addressData.bairro || '(vazio)')

    // Regra de Negócio: Apenas Paraná
    if (addressData.uf !== 'PR') {
      console.log('[validate-cep] CEP fora do PR:', addressData.uf)
      return new Response(JSON.stringify({ error: `No momento, realizamos entregas apenas no estado do Paraná. O CEP informado pertence a ${addressData.localidade} / ${addressData.uf}.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // ─────────────────────────────────────────────────────────────────
    // Fallback do bairro: o ViaCEP frequentemente devolve "bairro" vazio
    // para CEPs genéricos do Centro de Curitiba. Sem bairro, o checkout
    // não consegue casar com a tabela shipping_rates e o frete não é
    // calculado, mesmo com o cliente estando em um bairro atendido.
    // ─────────────────────────────────────────────────────────────────
    if (!addressData.bairro || String(addressData.bairro).trim() === '') {
      const inferred = inferNeighborhoodFromCep(cleanedCep, addressData.localidade, addressData.uf)
      if (inferred) {
        console.log('[validate-cep] bairro vazio no ViaCEP -> inferido pela faixa de CEP:', inferred)
        addressData.bairro = inferred
      }
    }

    // Identificar tipo de entrega sugerido
    const city = addressData.localidade?.trim().toLowerCase()

    const localDeliveryCities = [
      'curitiba',
      'pinhais',
      'são josé dos pinhais',
      'colombo',
      'piraquara',
      'araucária',
      'almirante tamandaré',
      'campo largo',
      'fazenda rio grande',
    ]

    const isLocal = localDeliveryCities.includes(city)

    return new Response(JSON.stringify({
      ...addressData,
      deliveryType: isLocal ? 'local' : 'correios',
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
