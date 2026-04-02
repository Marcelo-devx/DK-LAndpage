import { useState, useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import type { Theme, ViewType } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LogIn, UserPlus, RefreshCw, Mail, CheckCircle2, KeyRound, Gift } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { showError, showSuccess } from '@/utils/toast';
import OtpInput from '@/components/OtpInput';

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

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
      spaceSmall: '4px', spaceMedium: '8px', spaceLarge: '16px',
      labelBottomMargin: '6px', anchorBottomMargin: '4px',
      emailInputSpacing: '4px', socialAuthSpacing: '4px',
      buttonPadding: '12px 16px', inputPadding: '12px 16px',
    },
    fontSizes: {
      baseBodySize: '14px', baseInputSize: '15px',
      baseLabelSize: '13px', baseButtonSize: '15px',
    },
    fonts: {
      bodyFontFamily: 'inherit', buttonFontFamily: 'inherit',
      inputFontFamily: 'inherit', labelFontFamily: 'inherit',
    },
    radii: {
      borderRadiusButton: '0.75rem', buttonBorderRadius: '0.75rem', inputBorderRadius: '0.75rem',
    },
  },
};

type CustomView = 'sign_in' | 'sign_up' | 'forgot_password';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useTheme();
  const from = location.state?.from?.pathname || '/';

  const params = new URLSearchParams(location.search);
  const initialView = params.get('view') === 'sign_up' ? 'sign_up' : 'sign_in';
  const [view, setView] = useState<CustomView>(initialView as CustomView);

  // Referral info
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Salva o código de referral imediatamente ao montar o componente
  useEffect(() => {
    const refCode = params.get('ref');
    if (refCode) {
      sessionStorage.setItem('referral_code', refCode);
      setReferralCode(refCode);
      console.log('[Login] Referral code saved:', refCode);

      // Busca o nome de quem indicou
      supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('referral_code', refCode)
        .single()
        .then(({ data }) => {
          if (data?.first_name) {
            setReferrerName(`${data.first_name}${data.last_name ? ' ' + data.last_name : ''}`);
          }
        });
    }
  }, [location.search]);

  const [emailForSignup, setEmailForSignup] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    const listener = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Login] Auth state changed:', event, session?.user?.id);
      if (event === 'SIGNED_IN' && session) {
        // Vincula o referral assim que o usuário faz login/cadastro
        const storedRefCode = sessionStorage.getItem('referral_code');
        if (storedRefCode) {
          try {
            console.log('[Login] Linking referral code:', storedRefCode);
            await supabase.rpc('link_referral', { referral_code_input: storedRefCode });
            sessionStorage.removeItem('referral_code');
            console.log('[Login] Referral linked successfully');
          } catch (error) {
            console.error('[Login] Error linking referral:', error);
          }
        }
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone, cpf_cnpj, gender, date_of_birth, cep, street, number, neighborhood, city, state')
            .eq('id', session.user.id)
            .single();

          const isProfileComplete = profile &&
            profile.first_name && profile.last_name && profile.phone &&
            profile.cpf_cnpj && profile.gender && profile.date_of_birth &&
            profile.cep && profile.street && profile.number &&
            profile.neighborhood && profile.city && profile.state;

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

    const subscription = (listener as any)?.data?.subscription ?? (listener as any)?.subscription ?? null;
    return () => {
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
      } catch (e) {}
    };
  }, [navigate, from]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const sendCode = async () => {
    const email = emailForSignup.trim().toLowerCase();
    if (!email) { showError('Informe um e-mail válido'); return; }

    setIsSendingCode(true);
    try {
      const gen = await supabase.functions.invoke('generate-token', {
        body: { email, type: 'signup_otp', expires_in_seconds: 60 * 10 },
      });

      if (gen.error || !gen.data?.code) {
        console.error('[Login] generate-token error', gen.error, gen.data);
        showError('Não foi possível gerar o código. Tente novamente.');
        return;
      }

      const code = gen.data.code;

      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email-via-resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          to: email,
          subject: 'Seu código de verificação - DKCWB',
          type: 'otp',
          code,
        }),
      });

      const emailData = await emailRes.json().catch(() => ({}));

      if (!emailRes.ok) {
        const errMsg = emailData?.error || `Erro ao enviar email (${emailRes.status}).`;
        console.error('[Login] send-email error:', emailRes.status, emailData);
        showError(errMsg);
        return;
      }

      setCodeSent(true);
      setResendCooldown(60);
      showSuccess(`Código enviado para ${email}. Verifique sua caixa de entrada.`);

    } catch (err: any) {
      console.error('[Login] Unexpected error sending code:', err);
      showError(err?.message || 'Erro inesperado. Tente novamente.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyCode = async () => {
    const cleanOtp = otp.replace(/\s/g, '');
    if (cleanOtp.length < 6) {
      showError('Insira o código de 6 dígitos recebido por e-mail.');
      return;
    }
    setIsVerifying(true);
    try {
      const email = emailForSignup.trim().toLowerCase();

      const val = await supabase.functions.invoke('validate-token', {
        body: { email, code: cleanOtp },
      });

      if (val.error || !val.data?.success) {
        const msg = val.data?.error || 'Código inválido ou expirado. Tente reenviar.';
        console.error('[Login] validate-token error', val.error, val.data);
        showError(msg);
        return;
      }

      const createRes = await supabase.functions.invoke('create-user', {
        body: { email },
      });

      if (createRes.error || !createRes.data?.success) {
        const msg = createRes.data?.error || 'Erro ao criar conta. Tente novamente.';
        console.error('[Login] create-user error', createRes.error, createRes.data);
        showError(msg);
        return;
      }

      const DEFAULT_PASSWORD = '123456';
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: DEFAULT_PASSWORD,
      });

      if (signInError) {
        console.error('[Login] signIn error', signInError);
        showError('Este e-mail já possui cadastro com senha personalizada. Use a aba "Entrar".');
        setView('sign_in');
        return;
      }

      showSuccess('Código verificado! Redirecionando...');

    } catch (err: any) {
      console.error('[Login] Unexpected error verifying code:', err);
      showError('Erro ao verificar o código. Tente novamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = forgotEmail.trim().toLowerCase();
    if (!email) { showError('Informe seu e-mail cadastrado.'); return; }

    setIsSendingForgot(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = data?.error || 'Erro ao enviar nova senha. Tente novamente.';
        console.error('[Login] forgot-password error', res.status, data);
        showError(errMsg);
        return;
      }

      setForgotSent(true);
      showSuccess('Nova senha enviada para seu e-mail!');

    } catch (err: any) {
      console.error('[Login] forgot-password unexpected error', err);
      showError(err?.message || 'Erro inesperado. Tente novamente.');
    } finally {
      setIsSendingForgot(false);
    }
  };

  const tabView = view === 'forgot_password' ? 'sign_in' : view;

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
            <Tabs value={tabView} onValueChange={(v) => {
              setView(v as CustomView);
              setCodeSent(false);
              setOtp('');
              setEmailForSignup('');
              setForgotSent(false);
              setForgotEmail('');
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
                {/* ── CRIAR CONTA ── */}
                {view === 'sign_up' ? (
                  <div className="flex flex-col gap-5">
                    {/* Banner de indicação */}
                    {referralCode && (
                      <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl p-4 text-white flex items-start gap-3">
                        <div className="bg-white/20 rounded-xl p-2 shrink-0">
                          <Gift className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-sky-100 mb-0.5">
                            Convite especial
                          </p>
                          <p className="text-sm font-bold leading-snug">
                            {referrerName
                              ? <><span className="text-white">{referrerName}</span> te convidou para o CLUB DK!</>
                              : 'Você foi convidado para o CLUB DK!'
                            }
                          </p>
                          <p className="text-xs text-sky-200 mt-1">
                            Código: <span className="font-black tracking-widest">{referralCode.toUpperCase()}</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {!codeSent ? (
                      <>
                        <div className="text-center space-y-1">
                          <div className="mx-auto w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center mb-3">
                            <Mail className="h-6 w-6 text-sky-500" />
                          </div>
                          <p className="text-sm text-slate-500">Digite seu e-mail e enviaremos um <span className="font-bold text-charcoal-gray">código de 6 dígitos</span> para validar seu acesso.</p>
                        </div>
                        <input
                          type="email"
                          placeholder="seu@email.com"
                          value={emailForSignup}
                          onChange={(e) => setEmailForSignup(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                          className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                        />
                        <Button onClick={sendCode} className="h-12 uppercase font-black tracking-widest" disabled={isSendingCode}>
                          {isSendingCode ? 'Enviando...' : 'Enviar Código por E-mail'}
                        </Button>
                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => setView('sign_in')}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                          >
                            Já tenho conta — Entrar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-center space-y-1">
                          <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                          </div>
                          <p className="text-sm font-bold text-charcoal-gray">Código enviado!</p>
                          <p className="text-sm text-slate-500">Insira o código de 6 dígitos enviado para <span className="font-bold text-sky-600">{emailForSignup}</span></p>
                        </div>

                        <OtpInput value={otp} onChange={setOtp} />

                        <Button
                          onClick={verifyCode}
                          className="h-12 uppercase font-black tracking-widest"
                          disabled={isVerifying || otp.replace(/\s/g, '').length < 6}
                        >
                          {isVerifying ? 'Verificando...' : 'Verificar Código'}
                        </Button>

                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => { setCodeSent(false); setOtp(''); setEmailForSignup(''); }}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                          >
                            Usar outro e-mail
                          </button>
                          <button
                            type="button"
                            onClick={sendCode}
                            disabled={isSendingCode || resendCooldown > 0}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors disabled:opacity-40 flex items-center gap-1"
                          >
                            <RefreshCw className="h-3 w-3" />
                            {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : 'Reenviar'}
                          </button>
                        </div>

                        <p className="text-xs text-slate-400 text-center">Não recebeu? Verifique a caixa de spam.</p>
                      </>
                    )}
                  </div>

                /* ── ESQUECI MINHA SENHA ── */
                ) : view === 'forgot_password' ? (
                  <div className="flex flex-col gap-5">
                    {!forgotSent ? (
                      <>
                        <div className="text-center space-y-1">
                          <div className="mx-auto w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
                            <KeyRound className="h-6 w-6 text-amber-500" />
                          </div>
                          <p className="text-sm font-bold text-charcoal-gray">Esqueceu sua senha?</p>
                          <p className="text-sm text-slate-500">
                            Informe seu e-mail cadastrado e enviaremos uma <span className="font-bold text-charcoal-gray">nova senha</span> para você acessar o site.
                          </p>
                        </div>

                        <input
                          type="email"
                          placeholder="seu@email.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                          className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                        />

                        <Button
                          onClick={handleForgotPassword}
                          disabled={isSendingForgot}
                          className="h-12 uppercase font-black tracking-widest gap-2"
                        >
                          {isSendingForgot ? (
                            'Enviando...'
                          ) : (
                            <><Mail className="h-4 w-4" /> Enviar Nova Senha</>
                          )}
                        </Button>

                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => setView('sign_in')}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                          >
                            ← Voltar para o Login
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-4 py-2">
                        <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-bold text-charcoal-gray text-lg">E-mail enviado!</p>
                          <p className="text-sm text-slate-500 mt-1">
                            Verifique sua caixa de entrada. A nova senha foi enviada para <span className="font-bold text-sky-600">{forgotEmail}</span>.
                          </p>
                        </div>
                        <p className="text-xs text-slate-400">Não recebeu? Verifique a caixa de spam.</p>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            onClick={() => { setForgotSent(false); setForgotEmail(''); }}
                            className="uppercase font-bold tracking-widest text-xs"
                          >
                            Tentar outro e-mail
                          </Button>
                          <button
                            type="button"
                            onClick={() => { setView('sign_in'); setForgotSent(false); setForgotEmail(''); }}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                          >
                            ← Voltar para o Login
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                /* ── ENTRAR ── */
                ) : (
                  <>
                    <Auth
                      supabaseClient={supabase}
                      view="sign_in"
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
                        },
                      }}
                    />

                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={() => { setView('forgot_password'); setForgotSent(false); setForgotEmail(''); }}
                        className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
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