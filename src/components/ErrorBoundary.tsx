import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    // Limpa cookies básicos se houver
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
          <div className="bg-red-500/10 p-6 rounded-full mb-6 border border-red-500/20">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-4">
            Ops! Algo deu errado.
          </h1>
          <p className="text-slate-400 mb-8 max-w-md text-sm md:text-base leading-relaxed">
            Parece que há um conflito com dados antigos salvos no seu navegador.
            Isso é comum após atualizações do sistema.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
            <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 text-white hover:bg-white/5 w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
            </Button>
            <Button onClick={this.handleReset} className="h-12 bg-sky-500 hover:bg-sky-400 text-white font-bold uppercase tracking-widest w-full shadow-lg">
              <Trash2 className="mr-2 h-4 w-4" /> Limpar e Corrigir
            </Button>
          </div>
          <p className="mt-8 text-[10px] text-slate-600 font-mono uppercase">
            Erro: {this.state.error?.message || 'Desconhecido'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;