import { useState, useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import type { Theme, ViewType } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LogIn, UserPlus, RefreshCw } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { showError, showSuccess } from '@/utils/toast';
import { InputOTP } from '@/components/ui/input-otp';

const customTheme: Theme = {
  default: {
    colors: {
      brand: '#0ea5e9',
      brandAccent: '#0284c7',
      brandButtonText: 'white',
      defaultButtonBackground: 'transparent',
      defaultButtonBackgroundHover: '#f1f5f9',
      defaultButtonBorder: '#e2e8f0',
      defaultButtonText: '#0f172a',
      dividerBackground: '#e2e8f0',
      inputBackground: '#ffffff',
      inputBorder: '#e2e8f0',
      inputBorderHover: '#0ea5e9',
      inputBorderFocus: '#0ea5e9',
      inputText: '#0f172a',
      inputLabelText: '#64748b',
      inputPlaceholder: '#94a3b8',
      messageText: '#0f172a',
      messageTextDanger: '#ef4444',
      anchorTextColor: '#0ea5e9',
      anchorTextHoverColor: '#0284c7',
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
  const [view, setView] = useState<ViewType>((params.get('view') as ViewType) || 'sign_in');

  const [emailForSignup, setEmailForSignup] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const refCode = params.get('ref');
    if (refCode) {
      sessionStorage.setItem('referral_code', refCode);
    }
  }, [location.search]);

  useEffect(() => {
    // Handle SIGNED_IN events for the Auth component (keeps current behavior)
    const listener = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Login] Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session) {
        // Handle referral code first
        const storedRefCode = sessionStorage.getItem('referral_code');
        if (storedRefCode) {
          try {
            await supabase.rpc('link_referral', { referral_code_input: storedRefCode });
            sessionStorage.removeItem('referral_code');
          } catch (error) {
            console.error('[Login] Error linking referral:', error);
          }
        }

        // Check if profile is complete
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone, cpf_cnpj, gender, date_of_birth, cep, street, number, neighborhood, city, state')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error('[Login] Error fetching profile:', error);
            // Still redirect, even on error
            navigate(from, { replace: true });
            return;
          }

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

          // Prevent redirect to complete-profile if already there
          if (!isProfileComplete && window.location.pathname !== '/complete-profile') {
            navigate('/complete-profile', { replace: true });
          } else {
            navigate(from, { replace: true });
          }
        } catch (err) {
          console.error('[Login] Unexpected error:', err);
          navigate(from, { replace: true });
        }
      }
    });

    // Normalize different SDK shapes for cleanup
    const subscription = (listener as any)?.data?.subscription ?? (listener as any)?.subscription ?? null;
    return () => {
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
        else if (listener && typeof (listener as any).unsubscribe === 'function') (listener as any).unsubscribe();
      } catch (e) {
        console.warn('[Login] failed to unsubscribe auth listener', e);
      }
    };
  }, [navigate, from]);

  // cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const sendOtpToEmail = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const email = emailForSignup.trim().toLowerCase();
    if (!email) {
      showError('Informe um e-mail válido');
      return;
    }

    setIsSendingCode(true);
    try {
      // signInWithOtp will send an email with a token/otp depending on Supabase configuration.
      // Pass redirect options nested to match supabase-js v2 API signature.
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` }
      } as any);

      if (error) {
        console.error('[Login] signInWithOtp error:', error);
        // Prefer the server-provided message when available
        const msg = (error as any)?.message || 'Não foi possível enviar o código. Tente novamente.';
        showError(msg);
      } else {
        // Keep the trimmed email value in state so the OTP verify can use it
        setEmailForSignup(email);
        setCodeSent(true);
        setResendCooldown(60); // 60s cooldown
        // Some Supabase setups return a message we can surface
        if ((data as any)?.message) showSuccess((data as any).message);
        else showSuccess('Enviamos um código de 6 dígitos para seu e-mail. Verifique e insira abaixo.');
      }
    } catch (err: any) {
      console.error('[Login] Unexpected error sending OTP:', err);
      showError(err?.message || 'Erro inesperado. Tente novamente mais tarde.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyOtpCode = async () => {
    if (otp.trim().length < 6) {
      showError('Insira o código de 6 dígitos recebido por e-mail.');
      return;
    }
    setIsVerifying(true);
    try {
      // verifyOtp is the Supabase client method to verify an email token/otp.
      const { data, error } = await (supabase.auth as any).verifyOtp({
        email: emailForSignup.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email'
      });

      if (error) {
        console.error('[Login] verifyOtp error:', error);
        showError((error as any)?.message || 'Código inválido ou expirado. Tente reenviar.');
        return;
      }

      // If verification succeeded, a session should now exist in the client.
      showSuccess('Código verificado! Entrando...');

      // Handle referral linking (if present) similar to SIGNED_IN flow
      try {
        const storedRefCode = sessionStorage.getItem('referral_code');
        if (storedRefCode) {
          await supabase.rpc('link_referral', { referral_code_input: storedRefCode });
          sessionStorage.removeItem('referral_code');
        }
      } catch (err) {
        console.error('[Login] Error linking referral after OTP verify:', err);
      }

      // Fetch session and profile, then redirect accordingly
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (session) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone, cpf_cnpj, gender, date_of_birth, cep, street, number, neighborhood, city, state')
            .eq('id', session.user.id)
            .single();

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

          if (!isProfileComplete && window.location.pathname !== '/complete-profile') {
            navigate('/complete-profile', { replace: true });
          } else {
            navigate(from, { replace: true });
          }
          return;
        } catch (err) {
          console.error('[Login] Error checking profile after OTP verify:', err);
          navigate(from, { replace: true });
          return;
        }
      }

      // fallback
      navigate(from, { replace: true });
    } catch (err) {
      console.error('[Login] Unexpected error verifying OTP:', err);
      showError('Erro ao verificar o código. Tente novamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsSendingCode(true);
    try {
      const email = emailForSignup.trim().toLowerCase();
      if (!email) {
        showError('Informe um e-mail válido');
        return;
      }
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` }
      } as any);
      if (error) {
        console.error('[Login] resend signInWithOtp error:', error);
        showError((error as any)?.message || 'Não foi possível reenviar o código. Tente novamente.');
      } else {
        setResendCooldown(60);
        if ((data as any)?.message) showSuccess((data as any).message);
        else showSuccess('Código reenviado para seu e-mail.');
      }
    } catch (err: any) {
      console.error('[Login] Unexpected error resending OTP:', err);
      showError(err?.message || 'Erro inesperado. Tente novamente mais tarde.');
    } finally {
      setIsSendingCode(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-off-white relative overflow-hidden p-4">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 flex flex-col gap-6">
        <div className="text-center space-y-2">
           <h1 className="text-4xl font-black italic tracking-tighter text-charcoal-gray uppercase">
            {settings.loginTitle}<span className="text-sky-500">.</span>
           </h1>
           <p className="text-slate-500 text-[10px] font-black tracking-[0.3em] uppercase">
            {settings.loginSubtitle}
           </p>
        </div>

        <Card className="bg-white border border-stone-200 shadow-2xl rounded-[2rem] overflow-hidden">
          <CardContent className="p-0">
            <Tabs value={view} onValueChange={(v) => {
              // reset OTP UI when switching tabs
              setView(v as ViewType);
              setCodeSent(false);
              setOtp('');
              setEmailForSignup('');
            }} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-50 rounded-none h-14 p-1 border-b border-stone-100">
                <TabsTrigger value="sign_in" className="data-[state=active]:bg-white data-[state=active]:text-sky-600 font-black uppercase text-[10px] tracking-widest gap-2">
                  <LogIn className="h-3.5 w-3.5" /> Entrar
                </TabsTrigger>
                <TabsTrigger value="sign_up" className="data-[state=active]:bg-white data-[state=active]:text-sky-600 font-black uppercase text-[10px] tracking-widest gap-2">
                  <UserPlus className="h-3.5 w-3.5" /> Criar Conta
                </TabsTrigger>
              </TabsList>
              
              <div className="p-8">
                {view === 'sign_up' ? (
                  // OTP signup flow
                  <div className="flex flex-col gap-4">
                    {!codeSent ? (
                      <>
                        <div className="text-center">
                          <p className="text-sm text-slate-500">Digite seu e-mail e enviaremos um código de 6 dígitos para validar seu acesso.</p>
                        </div>
                        <input
                          type="email"
                          placeholder="seu@email.com"
                          value={emailForSignup}
                          onChange={(e) => setEmailForSignup(e.target.value)}
                          className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                        />
                        <Button onClick={sendOtpToEmail} className="h-12 uppercase font-black tracking-widest" disabled={isSendingCode}>
                          {isSendingCode ? 'Enviando...' : 'Enviar Código por E-mail'}
                        </Button>
                        <div className="text-center">
                          <button 
                            type="button"
                            onClick={() => setView('sign_in')}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                          >
                            Voltar para Entrar
                          </button>
                        </div>
                      </>
                    ) : (
                      // OTP entry UI
                      <>
                        <div className="text-center">
                          <p className="text-sm text-slate-500">Insira o código de 6 dígitos enviado para <span className="font-bold text-sky-600">{emailForSignup}</span></p>
                        </div>

                        <div className="flex items-center justify-center">
                          <InputOTP length={6} value={otp} onChange={(val: string) => setOtp(val)} className="gap-2" />
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Button onClick={verifyOtpCode} className="flex-1 h-12 uppercase font-black tracking-widest" disabled={isVerifying}>
                            {isVerifying ? 'Verificando...' : 'Verificar Código'}
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={resendOtp}
                            className="h-12 px-3"
                            disabled={isSendingCode || resendCooldown > 0}
                          >
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-4 w-4" />
                              {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : 'Reenviar'}
                            </div>
                          </Button>
                        </div>

                        <div className="text-center mt-2">
                          <button 
                            type="button"
                            onClick={() => { setCodeSent(false); setOtp(''); }}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                          >
                            Use outro e-mail
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <Auth
                      supabaseClient={supabase}
                      view={view}
                      appearance={{ 
                        theme: customTheme,
                        style: {
                          button: { textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', fontSize: '11px', height: '48px' },
                          label: { textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', fontSize: '10px', color: '#94a3b8' },
                          input: { borderRadius: '0.75rem', height: '48px' }
                        }
                      }}
                      providers={[]} 
                      redirectTo={`${window.location.origin}/auth/confirm`}
                      theme="default"
                      showLinks={false} 
                      localization={{
                        variables: {
                          sign_in: {
                            email_label: 'E-mail',
                            password_label: 'Senha',
                            email_input_placeholder: 'seu@email.com',
                            password_input_placeholder: '••••••••',
                            button_label: 'Acessar Conta',
                            social_provider_text: 'Entrar com {{provider}}',
                          },
                          sign_up: {
                            email_label: 'E-mail',
                            password_label: 'Senha',
                            email_input_placeholder: 'seu@email.com',
                            password_input_placeholder: 'Crie uma senha segura',
                            button_label: 'Finalizar Cadastro',
                            social_provider_text: 'Cadastrar com {{provider}}',
                          },
                          forgotten_password: {
                            email_label: 'E-mail',
                            email_input_placeholder: 'seu@email.com',
                            button_label: 'Recuperar Senha',
                            link_text: 'Esqueci minha senha',
                          },
                        },
                      }}
                    />

                    {view === 'sign_in' && (
                      <div className="mt-4 text-center">
                        <button 
                          onClick={() => setView('forgotten_password')}
                          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                    )}
  
                    {view === 'forgotten_password' && (
                      <div className="mt-4 text-center">
                        <button 
                          onClick={() => setView('sign_in')}
                          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                        >
                          Voltar para o Login
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild variant="link" className="text-slate-400 hover:text-charcoal-gray transition-colors">
            <Link to="/" className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] gap-2">
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