// redeploy: 2026-04-27T03:00:00Z — force redeploy was 404
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Email e código são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    console.log("[validate-token] validating code for email:", cleanEmail);

    // Busca o token mais recente para este email (independente de estar usado ou não)
    const { data: allTokens, error: fetchError } = await supabase
      .from("email_links")
      .select("*")
      .eq("email", cleanEmail)
      .eq("type", "signup_otp")
      .order("created_at", { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error("[validate-token] error fetching tokens:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar código" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!allTokens || allTokens.length === 0) {
      console.log("[validate-token] no tokens found for email:", cleanEmail);
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum código encontrado para este e-mail. Solicite um novo código." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifica se o código digitado existe entre os tokens
    const matchingToken = allTokens.find((t) => t.token === cleanCode);

    if (!matchingToken) {
      console.log("[validate-token] code not found:", cleanCode, "for email:", cleanEmail);
      return new Response(
        JSON.stringify({ success: false, error: "Código incorreto. Verifique os 6 dígitos digitados." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifica se o token já foi usado
    if (matchingToken.used) {
      // Verifica se há um token mais recente válido
      const newerValidToken = allTokens.find(
        (t) => !t.used && new Date(t.expires_at) > new Date() && t.id !== matchingToken.id
      );

      if (newerValidToken) {
        console.log("[validate-token] code already used, newer valid token exists");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Este código já foi utilizado. Um código mais recente foi enviado para seu e-mail — use o último código recebido.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[validate-token] code already used, no newer valid token");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Este código já foi utilizado. Clique em \"Reenviar\" para receber um novo código.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifica se o token expirou
    if (new Date(matchingToken.expires_at) < new Date()) {
      console.log("[validate-token] code expired for email:", cleanEmail);
      return new Response(
        JSON.stringify({
          success: false,
          error: "expired",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Token válido! Marca como usado
    const { error: updateError } = await supabase
      .from("email_links")
      .update({ used: true })
      .eq("id", matchingToken.id);

    if (updateError) {
      console.error("[validate-token] error marking token as used:", updateError);
      // Não falha aqui — o token é válido, apenas não conseguimos marcar como usado
    }

    console.log("[validate-token] code validated successfully for email:", cleanEmail);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[validate-token] unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno ao validar código" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
