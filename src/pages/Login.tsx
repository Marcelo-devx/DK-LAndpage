import { Auth } from '@supabase/auth-ui-react';
import type { Theme, ViewType } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const customTheme: Theme = {
  default: {
    colors: {
      brand: '#0ea5e9', // sky-400
      brandAccent: '#38bdf8',
      brandButtonText: '#ffffff',
      defaultButtonBackground: 'rgba(255, 255, 255, 0.05)',
      defaultButtonBackgroundHover: 'rgba(255, 255, 255, 0.1)',
      defaultButtonBorder: 'rgba(255, 255, 255, 0.1)',
      defaultButtonText: '#f8fafc',
      dividerBackground: 'rgba(255, 255, 255, 0.1)',
      inputBackground: 'rgba(255, 255, 255, 0.05)',
      inputBorder: 'rgba(255, 255, 255, 0.1)',
      inputBorderHover: 'rgba(14, 165, 233, 0.5)',
      inputBorderFocus: '#0ea5e9',
      inputText: '#ffffff',
      inputLabelText: '#94a3b8', // slate-400
      inputPlaceholder: '#475569', // slate-600
      messageText: '#f8fafc',
      messageTextDanger: '#ef4444',
      anchorTextColor: '#0ea5e9',
      anchorTextHoverColor: '#38bdf8',
    },
    fonts: {
      bodyFontFamily: 'inherit',
      buttonFontFamily: 'inherit',
      inputFontFamily: 'inherit',
      labelFontFamily: 'inherit',
    },
    radii: {
      borderRadiusButton: '1rem',
      buttonBorderRadius: '1rem',
      inputBorderRadius: '0.75rem',
    },
  },
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const params = new URLSearchParams(location.search);
  const initialView = (params.get('view') || 'sign_in') as ViewType;

  useEffect(() => {
    const refCode = params.get('ref');
    if (refCode) {
      sessionStorage.setItem('referral_code', refCode);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const storedRefCode = sessionStorage.getItem('referral_code');
        if (storedRefCode) {
          await supabase.rpc('link_referral', { referral_code_input: storedRefCode });
          sessionStorage.removeItem('referral_code');
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const isProfileComplete = profile && profile.first_name && profile.last_name && profile.cep;

        if (!isProfileComplete) {
          navigate('/complete-profile', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, from, location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden p-6">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
           <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">
            DKCWB<span className="text-sky-400">.</span>
           </h1>
           <p className="text-slate-400 text-sm font-medium mt-3 tracking-wide uppercase">
            Acesso Exclusivo
           </p>
        </div>

        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[2rem] overflow-hidden">
          <CardContent className="p-8 md:p-10">
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: customTheme }}
              providers={[]}
              theme="dark"
              view={initialView}
              localization={{
                variables: {
                  sign_in: {
                    email_label: 'E-mail',
                    password_label: 'Senha',
                    email_input_placeholder: 'ex: seu@email.com',
                    password_input_placeholder: 'Sua senha segura',
                    button_label: 'Acessar Conta',
                    link_text: 'Ainda não é membro? Cadastre-se',
                  },
                  sign_up: {
                    email_label: 'E-mail',
                    password_label: 'Senha',
                    email_input_placeholder: 'ex: seu@email.com',
                    password_input_placeholder: 'Mínimo 6 caracteres',
                    button_label: 'Criar Minha Conta',
                    link_text: 'Já possui uma conta? Entre aqui',
                  },
                  forgotten_password: {
                    email_label: 'E-mail',
                    email_input_placeholder: 'seu@email.com',
                    button_label: 'Recuperar Acesso',
                    link_text: 'Esqueceu sua senha?',
                  },
                },
              }}
            />
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button asChild variant="ghost" className="text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
            <Link to="/" className="flex items-center text-xs font-bold uppercase tracking-widest">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para a loja
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;