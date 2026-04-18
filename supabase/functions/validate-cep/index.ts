// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// redeploy: v2

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('[validate-cep] endereço encontrado:', addressData.localidade, '/', addressData.uf)

    // Regra de Negócio: Apenas Paraná
    if (addressData.uf !== 'PR') {
      console.log('[validate-cep] CEP fora do PR:', addressData.uf)
      return new Response(JSON.stringify({ error: `No momento, realizamos entregas apenas no estado do Paraná. O CEP informado pertence a ${addressData.localidade} / ${addressData.uf}.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
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
