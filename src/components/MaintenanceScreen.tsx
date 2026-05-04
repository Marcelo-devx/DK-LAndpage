import { Wrench, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';

const getSecondsUntil14 = () => {
  const now = new Date();
  const target = new Date();
  target.setHours(14, 0, 0, 0);
  if (now >= target) return 0;
  return Math.floor((target.getTime() - now.getTime()) / 1000);
};

const MaintenanceScreen = () => {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntil14);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(getSecondsUntil14());
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

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
            Nossas rotas lotaram! Voltaremos a operar normalmente a partir das <span className="font-black text-slate-900">14:00h</span>. Agradecemos a compreensão. 🙏
          </p>

          {/* Countdown Timer */}
          {secondsLeft > 0 ? (
            <div className="flex items-center justify-center gap-3 mt-2">
              {[{ label: 'Horas', value: hours }, { label: 'Min', value: minutes }, { label: 'Seg', value: seconds }].map(({ label, value }, i) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex flex-col items-center bg-white rounded-2xl shadow-md border border-slate-100 px-4 py-3 min-w-[64px]">
                    <span className="text-3xl font-black text-slate-900 tabular-nums">{pad(value)}</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">{label}</span>
                  </div>
                  {i < 2 && <span className="text-2xl font-black text-slate-400 -mt-4">:</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 px-4 py-3 bg-green-50 border border-green-200 rounded-2xl">
              <p className="text-green-700 font-bold text-sm">✅ Já são 14:00h! Estamos voltando...</p>
            </div>
          )}

          {/* Login button */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
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