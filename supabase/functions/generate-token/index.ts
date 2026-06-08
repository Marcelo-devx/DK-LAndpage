// redeploy: 2026-07-14T14:00:00Z — force redeploy v3 (fix 401 jwt gateway issue)
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Esta função é pública — verify_jwt=false configurado em config.toml
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[generate-token] missing env vars");
    return new Response(
      JSON.stringify({ success: false, error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { email, type = "signup_otp", expires_in_seconds = 600 } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const cleanEmail = email.trim().toLowerCase();

    console.log("[generate-token] request received for email:", cleanEmail, "type:", type);

    // Invalida tokens anteriores não usados para este email/tipo
    const { error: invalidateError } = await supabase
      .from("email_links")
      .update({ used: true })
      .eq("email", cleanEmail)
      .eq("type", type)
      .eq("used", false);

    if (invalidateError) {
      console.error("[generate-token] error invalidating old tokens:", invalidateError);
    }

    // Gera código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + expires_in_seconds * 1000).toISOString();

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
  } catch (err: any) {
    console.error("[generate-token] unexpected error:", err?.message || err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno ao gerar código" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
