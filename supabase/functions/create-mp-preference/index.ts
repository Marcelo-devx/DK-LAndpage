import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// redeploy: v2
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { order_id, back_url } = await req.json();

    console.log("[create-mp-preference] Iniciando para order_id:", order_id);

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("[create-mp-preference] MERCADOPAGO_ACCESS_TOKEN não configurado");
      return new Response(JSON.stringify({ error: "Configuração de pagamento ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar dados do pedido via service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total_price, shipping_address")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("[create-mp-preference] Pedido não encontrado:", orderError);
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("name_at_purchase, quantity, price_at_purchase")
      .eq("order_id", order_id);

    if (itemsError) {
      console.error("[create-mp-preference] Erro ao buscar itens:", itemsError);
    }

    const addr = order.shipping_address || {};
    const totalPrice = Number(order.total_price) || 0;

    // Montar itens da preference — se não tiver itens, usa o total como item único
    const preferenceItems = (items && items.length > 0)
      ? items.map((item: any) => ({
          title: item.name_at_purchase || "Produto",
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.price_at_purchase) || 0,
          currency_id: "BRL",
        }))
      : [
          {
            title: `Pedido #${order_id}`,
            quantity: 1,
            unit_price: totalPrice,
            currency_id: "BRL",
          },
        ];

    // URL de retorno após pagamento
    const baseUrl = back_url || "https://jrlozhhvwqfmjtkmvukf.supabase.co";
    const successUrl = `${back_url}/confirmacao-pedido/${order_id}?status=approved&collection_status=approved`;
    const failureUrl = `${back_url}/confirmacao-pedido/${order_id}?status=failure`;
    const pendingUrl = `${back_url}/confirmacao-pedido/${order_id}?status=pending`;

    const preference: any = {
      items: preferenceItems,
      external_reference: String(order_id),
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: "approved",
      statement_descriptor: "DK STORE",
    };

    // Adicionar dados do pagador se disponíveis
    if (addr.email || addr.first_name) {
      preference.payer = {
        name: addr.first_name || "",
        surname: addr.last_name || "",
        email: addr.email || "",
        phone: addr.phone ? { area_code: "55", number: addr.phone.replace(/\D/g, "") } : undefined,
        identification: addr.cpf_cnpj
          ? {
              type: addr.cpf_cnpj.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF",
              number: addr.cpf_cnpj.replace(/\D/g, ""),
            }
          : undefined,
        address: {
          street_name: addr.street || "",
          street_number: addr.number || "",
          zip_code: (addr.cep || "").replace(/\D/g, ""),
        },
      };
    }

    console.log("[create-mp-preference] Criando preference no MP para order:", order_id, "total:", totalPrice);

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("[create-mp-preference] Erro da API do MP:", mpData);
      return new Response(
        JSON.stringify({ error: mpData?.message || "Erro ao criar preferência de pagamento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-mp-preference] Preference criada com sucesso:", mpData.id);

    return new Response(
      JSON.stringify({
        success: true,
        preference_id: mpData.id,
        init_point: mpData.init_point,       // URL de produção
        sandbox_init_point: mpData.sandbox_init_point, // URL de sandbox
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-mp-preference] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
