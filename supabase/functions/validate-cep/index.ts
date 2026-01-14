// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { cep } = await req.json()
    const cleanedCep = cep.replace(/\D/g, '')

    if (cleanedCep.length !== 8) {
      return new Response(JSON.stringify({ error: 'CEP inválido.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Fetch details from ViaCEP first
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
    if (!viaCepResponse.ok) {
      throw new Error('Falha ao buscar dados do CEP no serviço externo.');
    }
    const addressData = await viaCepResponse.json();

    // Check errors
    if (addressData.erro) {
      return new Response(JSON.stringify({ error: 'CEP não encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Regra de Negócio: Apenas Paraná
    if (addressData.uf !== 'PR') {
      return new Response(JSON.stringify({ error: 'No momento, realizamos entregas apenas no estado do Paraná.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Identificar tipo de entrega sugerido
    const city = addressData.localidade?.trim().toLowerCase();
    
    // Lista básica de cidades da Região Metropolitana que poderiam ter entrega local (Motoboy)
    // Você pode ajustar essa lista conforme sua logística real
    const localDeliveryCities = [
        'curitiba',
        'pinhais',
        'são josé dos pinhais',
        'colombo',
        'piraquara',
        'araucária',
        'almirante tamandaré',
        'campo largo',
        'fazenda rio grande'
    ];

    const isLocal = localDeliveryCities.includes(city);
    
    // Retorna os dados com uma flag extra para o frontend saber o tipo de entrega
    return new Response(JSON.stringify({ 
        ...addressData, 
        deliveryType: isLocal ? 'local' : 'correios' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})