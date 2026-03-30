import { Wrench, LogIn, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';

const MaintenanceScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Animated Icon */}
        <div className="relative flex justify-center">
          <div className="absolute inset-0 bg-slate-900/5 rounded-full blur-3xl animate-pulse" />
          <div className="relative p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
            <Wrench className="h-20 w-20 text-slate-900 animate-[spin_8s_linear_infinite]" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tight">
            Site em Manutenção
          </h1>
          
          <div className="h-1 w-20 bg-slate-900 mx-auto rounded-full" />
          
          <p className="text-lg text-slate-600 font-medium leading-relaxed">
            Estamos trabalhando para melhorar sua experiência. Voltaremos em breve.
          </p>

          {/* Highlighted external shop link */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://dk-cwb.lojaintegrada.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-colors"
              aria-label="Ir para a loja correta (abre em nova aba)"
            >
              <ExternalLink className="h-4 w-4" />
              Acessar loja (dk-cwb.lojaintegrada.com.br)
            </a>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-black"
                >
                  <LogIn className="h-4 w-4" />
                  Entrar
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-lg font-black">Entrar</DialogTitle>
                </DialogHeader>

                <div className="mt-2">
                  <Auth
                    supabaseClient={supabase}
                    providers={[]}
                    appearance={{ theme: ThemeSupa }}
                    theme="light"
                  />
                </div>

                <div className="mt-4 text-right">
                  <Button variant="ghost" onClick={() => navigate('/')}>Fechar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Small help text with visible URL */}
          <p className="mt-3 text-sm text-slate-500">
            Caso precise comprar agora, use a loja oficial:
            <br />
            <a
              href="https://dk-cwb.lojaintegrada.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-amber-600 font-black"
            >
              dk-cwb.lojaintegrada.com.br
            </a>
          </p>

        </div>

        {/* Decorative Elements */}
        <div className="pt-8 border-t border-slate-200/50">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
            DKCWB &copy; 2025
          </p>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slate-900/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-900/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  );
};

export default MaintenanceScreen;