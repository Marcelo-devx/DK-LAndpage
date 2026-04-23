// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// redeploy: v4 — fallback para API alternativa + expansão de bairros inferidos

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Quando o ViaCEP devolve `bairro` vazio (acontece em muitos CEPs genéricos),
 * inferimos o bairro pela faixa do CEP com base na divisão oficial dos Correios.
 *
 * Faixas de CEP de Curitiba por bairro (fonte: Correios):
 * https://www.correios.com.br/enviar/precisa-de-ajuda/tabela-de-cep
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

  // Água Verde: 80240-000 a 80250-999
  if (cepNum >= 80240000 && cepNum <= 80250999) return 'Água Verde'

  // Batel: 80420-000 a 80440-999
  if (cepNum >= 80420000 && cepNum <= 80440999) return 'Batel'

  // Bigorrilho: 80710-000 a 80730-999
  if (cepNum >= 80710000 && cepNum <= 80730999) return 'Bigorrilho'

  // Portão: 81300-000 a 81380-999
  if (cepNum >= 81300000 && cepNum <= 81380999) return 'Portão'

  // Novo Mundo: 81050-000 a 81070-999
  if (cepNum >= 81050000 && cepNum <= 81070999) return 'Novo Mundo'

  // Capão Raso: 81130-000 a 81170-999
  if (cepNum >= 81130000 && cepNum <= 81170999) return 'Capão Raso'

  // Xaxim: 81710-000 a 81730-999
  if (cepNum >= 81710000 && cepNum <= 81730999) return 'Xaxim'

  // Pinheirinho: 81800-000 a 81850-999
  if (cepNum >= 81800000 && cepNum <= 81850999) return 'Pinheirinho'

  // Sítio Cercado: 81900-000 a 81980-999
  if (cepNum >= 81900000 && cepNum <= 81980999) return 'Sítio Cercado'

  // Boqueirão: 81650-000 a 81700-999
  if (cepNum >= 81650000 && cepNum <= 81700999) return 'Boqueirão'

  // Alto Boqueirão: 81750-000 a 81790-999
  if (cepNum >= 81750000 && cepNum <= 81790999) return 'Alto Boqueirão'

  // Uberaba: 81500-000 a 81600-999
  if (cepNum >= 81500000 && cepNum <= 81600999) return 'Uberaba'

  // Guabirotuba: 81430-000 a 81480-999
  if (cepNum >= 81430000 && cepNum <= 81480999) return 'Guabirotuba'

  // Cajuru: 82900-000 a 82980-999
  if (cepNum >= 82900000 && cepNum <= 82980999) return 'Cajuru'

  // Bacacheri: 82510-000 a 82560-999
  if (cepNum >= 82510000 && cepNum <= 82560999) return 'Bacacheri'

  // Boa Vista: 82560-000 a 82620-999
  if (cepNum >= 82560000 && cepNum <= 82620999) return 'Boa Vista'

  // Santa Cândida: 82640-000 a 82720-999
  if (cepNum >= 82640000 && cepNum <= 82720999) return 'Santa Cândida'

  // Pilarzinho: 82100-000 a 82200-999
  if (cepNum >= 82100000 && cepNum <= 82200999) return 'Pilarzinho'

  // São Braz: 82300-000 a 82380-999
  if (cepNum >= 82300000 && cepNum <= 82380999) return 'São Braz'

  // Santa Felicidade: 82400-000 a 82480-999
  if (cepNum >= 82400000 && cepNum <= 82480999) return 'Santa Felicidade'

  // Campo Comprido: 81200-000 a 81280-999
  if (cepNum >= 81200000 && cepNum <= 81280999) return 'Campo Comprido'

  // Cidade Industrial: 81460-000 a 81490-999
  if (cepNum >= 81460000 && cepNum <= 81490999) return 'Cidade Industrial'

  return ''
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
 * Busca dados do CEP na API alternativa brasilapi.com.br
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

    // Tentativa 1: ViaCEP
    let addressData = await fetchViaCep(cleanedCep)

    // Tentativa 2: BrasilAPI (fallback)
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
    // para CEPs genéricos. Sem bairro, o checkout não consegue casar com
    // a tabela shipping_rates e o frete não é calculado.
    // ─────────────────────────────────────────────────────────────────
    if (!addressData.bairro || String(addressData.bairro).trim() === '') {
      const inferred = inferNeighborhoodFromCep(cleanedCep, addressData.localidade, addressData.uf)
      if (inferred) {
        console.log('[validate-cep] bairro vazio -> inferido pela faixa de CEP:', inferred)
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

    console.log('[validate-cep] sucesso:', addressData.localidade, '/', addressData.uf, '| bairro final:', addressData.bairro, '| tipo:', isLocal ? 'local' : 'correios')

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
