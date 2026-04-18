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
    const { email, type = "signup_otp", expires_in_seconds = 600 } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cleanEmail = email.trim().toLowerCase();

    console.log("[generate-token] request received for email:", cleanEmail, "type:", type);

    // Invalida todos os tokens anteriores não usados para este email/tipo
    const { error: invalidateError } = await supabase
      .from("email_links")
      .update({ used: true })
      .eq("email", cleanEmail)
      .eq("type", type)
      .eq("used", false);

    if (invalidateError) {
      console.error("[generate-token] error invalidating old tokens:", invalidateError);
      // Não falha — continua gerando o novo token
    }

    // Gera código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + expires_in_seconds * 1000).toISOString();

    // Insere o novo token
    const { error: insertError } = await supabase.from("email_links").insert({
      email: cleanEmail,
      token: code,
      type,
      used: false,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("[generate-token] error inserting token:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar código" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[generate-token] code generated successfully for", cleanEmail, type);

    return new Response(
      JSON.stringify({ success: true, code }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-token] unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno ao gerar código" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
