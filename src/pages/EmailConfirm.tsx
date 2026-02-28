import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const EmailConfirm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"idle" | "redirecting" | "error">("idle");
  const { settings } = useTheme();

  useEffect(() => {
    const raw = searchParams.get("confirmation_url");
    if (raw) {
      setStatus("redirecting");
      const original = decodeURIComponent(raw);

      // Se a URL já está completa, sobrescrevemos o redirect_to para garantir retorno ao app atual
      const shouldProceed = /^https?:\/\//i.test(original);
      if (!shouldProceed) {
        setStatus("error");
        return;
      }

      const desiredRedirect = `${window.location.origin}/login`;
      const supabaseUrl = new URL(original);
      supabaseUrl.searchParams.set("redirect_to", desiredRedirect);

      setTimeout(() => {
        window.location.href = supabaseUrl.toString();
      }, 500);
    } else {
      setStatus("error");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white p-4 relative">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-4xl font-black italic tracking-tighter text-charcoal-gray uppercase">
            {settings.loginTitle}<span className="text-sky-500">.</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase">
            {settings.loginSubtitle}
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-xl border border-stone-200 shadow-2xl rounded-[1.5rem] overflow-hidden">
          <CardContent className="p-6 md:p-8">
            {status === "redirecting" && (
              <div className="flex flex-col items-center text-center space-y-3">
                <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
                <h2 className="text-lg font-bold text-charcoal-gray">Confirmando seu acesso...</h2>
                <p className="text-slate-600 text-sm">
                  Estamos validando seu e-mail. Você será redirecionado automaticamente em instantes.
                </p>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center text-center space-y-3">
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <h2 className="text-lg font-bold text-charcoal-gray">Link inválido ou ausente</h2>
                <p className="text-slate-600 text-sm">
                  Abra este link a partir do botão do e-mail de confirmação.{" "}
                  Se precisar, volte à página de login e solicite um novo e-mail.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button asChild variant="secondary" className="uppercase tracking-widest font-bold text-xs">
                    <Link to="/login">Ir para o Login</Link>
                  </Button>
                  <Button asChild variant="link" className="uppercase tracking-widest font-bold text-xs text-slate-600">
                    <Link to="/">Voltar à loja</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <div className="text-slate-500 text-xs">
            Bem-vindo(a) à DKCWB — experiência com curadoria exclusiva.
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirm;