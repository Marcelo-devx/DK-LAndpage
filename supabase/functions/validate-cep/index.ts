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

    // Check if the CEP is invalid or outside of Curitiba (case-insensitive)
    if (addressData.erro || addressData.localidade?.trim().toLowerCase() !== 'curitiba') {
      return new Response(JSON.stringify({ error: 'CEP fora da área de entrega. Atendemos apenas em Curitiba.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // If the CEP is from Curitiba, return the address data
    return new Response(JSON.stringify(addressData), {
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