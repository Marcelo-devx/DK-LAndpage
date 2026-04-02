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
      // 1) Generate token via edge function
      const gen = await supabase.functions.invoke('generate-token', {
        body: { email, type: 'complete_profile', expires_in_seconds: 60 * 60 * 24 },
      });

      if (gen.error) {
        console.error('[Login] generate-token error', gen.error);
        showError('Não foi possível gerar link de confirmação. Verifique os logs da Edge Function.');
        setIsSendingCode(false);
        return;
      }

      const token = gen.data?.token;
      if (!token) {
        console.error('[Login] generate-token missing token', gen);
        showError('Não foi possível gerar link de confirmação (token ausente).');
        setIsSendingCode(false);
        return;
      }

      const completeLink = `${window.location.origin}/complete-profile?token=${encodeURIComponent(token)}`;

      // 2) Send email via Resend — use fetch directly so we can read the error body
      const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email-via-resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          to: email,
          subject: 'Complete seu cadastro - DKCWB',
          type: 'complete_profile',
          completeLink,
        }),
      });

      const emailData = await emailRes.json().catch(() => ({}));

      if (!emailRes.ok) {
        const errMsg = emailData?.error || `Erro ${emailRes.status} ao enviar email.`;
        console.error('[Login] send-email-via-resend failed:', emailRes.status, emailData);
        showError(errMsg);
        return;
      }

      console.log('[Login] email sent successfully', emailData);
      setEmailForSignup(email);
      setCodeSent(true);
      showSuccess('Enviamos um e-mail com o link para completar o cadastro. Verifique sua caixa de entrada.');

    } catch (err: any) {
      console.error('[Login] Unexpected error sending complete profile link:', err);
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
        const status = (error as any)?.status;
        if (status) showError(((error as any)?.message || 'Não foi possível reenviar o código.') + ` (status ${status}). Verifique configuração de e-mail no Supabase.`);
        else showError((error as any)?.message || 'Não foi possível reenviar o código. Tente novamente.');
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
                  // COMPLETE-PROFILE signup flow (send link instead of OTP)
                  <div className="flex flex-col gap-4">
                    {!codeSent ? (
                      <>
                        <div className="text-center">
                          <p className="text-sm text-slate-500">Digite seu e-mail e enviaremos um link para completar seu cadastro.</p>
                        </div>
                        <input
                          type="email"
                          placeholder="seu@email.com"
                          value={emailForSignup}
                          onChange={(e) => setEmailForSignup(e.target.value)}
                          className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                        />
                        <Button onClick={sendOtpToEmail} className="h-12 uppercase font-black tracking-widest" disabled={isSendingCode}>
                          {isSendingCode ? 'Enviando...' : 'Enviar Link por E-mail'}
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
                      // After sending link: show confirmation and allow resend
                      <>
                        <div className="text-center">
                          <h3 className="text-sm font-bold text-charcoal-gray">Link enviado!</h3>
                          <p className="text-sm text-slate-500">Enviamos um link para completar seu cadastro em <span className="font-bold text-sky-600">{emailForSignup}</span>. Abra o e-mail e clique no link para continuar.</p>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Button onClick={sendOtpToEmail} className="flex-1 h-12 uppercase font-black tracking-widest" disabled={isSendingCode}>
                            {isSendingCode ? 'Enviando...' : 'Reenviar Link'}
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={() => { setCodeSent(false); setEmailForSignup(''); }}
                            className="h-12 px-3"
                          >
                            Usar outro e-mail
                          </Button>
                        </div>

                        <div className="text-center mt-2">
                          <p className="text-xs text-slate-400">Se não receber o e-mail, verifique a caixa de spam ou tente reenviar.</p>
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