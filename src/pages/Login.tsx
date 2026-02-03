import { Auth } from '@supabase/auth-ui-react';
import type { Theme, ViewType } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const customTheme: Theme = {
  default: {
    colors: {
      brand: '#0ea5e9', // sky-500
      brandAccent: '#0284c7', // sky-600
      brandButtonText: 'white',
      defaultButtonBackground: 'transparent',
      defaultButtonBackgroundHover: '#f1f5f9', // slate-100
      defaultButtonBorder: '#e2e8f0', // slate-200
      defaultButtonText: '#0f172a', // slate-900
      dividerBackground: '#e2e8f0',
      inputBackground: '#ffffff', // white
      inputBorder: '#e2e8f0', // slate-200
      inputBorderHover: '#0ea5e9',
      inputBorderFocus: '#0ea5e9',
      inputText: '#0f172a', // slate-900
      inputLabelText: '#64748b', // slate-500
      inputPlaceholder: '#94a3b8', // slate-400
      messageText: '#0f172a',
      messageTextDanger: '#ef4444',
      anchorTextColor: '#0ea5e9', // sky-500
      anchorTextHoverColor: '#0284c7', // sky-600
    },
    space: {
      spaceSmall: '4px',
      spaceMedium: '8px',
      spaceLarge: '16px',
      labelBottomMargin: '6px',
      anchorBottomMargin: '4px',
      emailInputSpacing: '4px',
      socialAuthSpacing: '4px',
      buttonPadding: '12px 16px',
      inputPadding: '12px 16px',
    },
    fontSizes: {
      baseBodySize: '14px',
      baseInputSize: '15px',
      baseLabelSize: '13px',
      baseButtonSize: '15px',
    },
    fonts: {
      bodyFontFamily: 'inherit',
      buttonFontFamily: 'inherit',
      inputFontFamily: 'inherit',
      labelFontFamily: 'inherit',
    },
    radii: {
      borderRadiusButton: '0.75rem',
      buttonBorderRadius: '0.75rem',
      inputBorderRadius: '0.75rem',
    },
  },
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useTheme();
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

        // Verificação rigorosa de todos os campos
        const isProfileComplete = profile && 
          profile.first_name && 
          profile.last_name && 
          profile.phone &&
          profile.cpf_cnpj &&
          profile.gender &&
          profile.date_of_birth &&
          profile.cep &&
          profile.street &&
          profile.number &&
          profile.neighborhood &&
          profile.city &&
          profile.state;

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-off-white relative overflow-hidden p-4">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-[400px] relative z-10 flex flex-col gap-8">
        <div className="text-center space-y-2">
           <h1 className="text-4xl font-black italic tracking-tighter text-charcoal-gray uppercase">
            {settings.loginTitle}<span className="text-sky-500">.</span>
           </h1>
           <p className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase">
            {settings.loginSubtitle}
           </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-xl border border-stone-200 shadow-2xl rounded-[1.5rem] overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <Auth
              supabaseClient={supabase}
              appearance={{ 
                theme: customTheme,
                style: {
                  button: { textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', fontSize: '12px' },
                  label: { textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', fontSize: '11px' }
                }
              }}
              // ADICIONADO: Provedor Google
              providers={['google']} 
              redirectTo={window.location.origin} // Garante o redirecionamento correto após o OAuth
              theme="default"
              view={initialView}
              localization={{
                variables: {
                  sign_in: {
                    email_label: 'E-mail',
                    password_label: 'Senha',
                    email_input_placeholder: 'seu@email.com',
                    password_input_placeholder: '••••••••',
                    button_label: 'Entrar',
                    link_text: 'Não tem uma conta? Cadastre-se',
                    social_provider_text: 'Entrar com {{provider}}',
                  },
                  sign_up: {
                    email_label: 'E-mail',
                    password_label: 'Senha',
                    email_input_placeholder: 'seu@email.com',
                    password_input_placeholder: 'Crie uma senha segura',
                    button_label: 'Criar Conta',
                    link_text: 'Já tem conta? Entre',
                    social_provider_text: 'Cadastrar com {{provider}}',
                  },
                  forgotten_password: {
                    email_label: 'E-mail',
                    email_input_placeholder: 'seu@email.com',
                    button_label: 'Enviar link de recuperação',
                    link_text: 'Esqueci minha senha',
                  },
                },
              }}
            />
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild variant="link" className="text-slate-500 hover:text-charcoal-gray transition-colors">
            <Link to="/" className="flex items-center text-[10px] font-bold uppercase tracking-widest gap-2">
              <ArrowLeft className="h-3 w-3" />
              Voltar para a loja
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;