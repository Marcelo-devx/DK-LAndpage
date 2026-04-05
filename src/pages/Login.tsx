import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LogIn, UserPlus, RefreshCw, Mail, CheckCircle2, KeyRound, Gift, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { showSuccess } from '@/utils/toast';
import OtpInput from '@/components/OtpInput';
import { cn } from '@/lib/utils';

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

type CustomView = 'sign_in' | 'sign_up' | 'forgot_password';

// Traduz erros do Supabase para mensagens amigáveis em português
const translateAuthError = (error: string): { message: string; hint?: string } => {
  const e = error.toLowerCase();

  if (e.includes('invalid login credentials') || e.includes('invalid credentials')) {
    return {
      message: 'E-mail ou senha incorretos.',
      hint: 'Verifique se digitou corretamente. Se esqueceu a senha, clique em "Esqueci minha senha".',
    };
  }
  if (e.includes('email not confirmed')) {
    return {
      message: 'E-mail ainda não confirmado.',
      hint: 'Verifique sua caixa de entrada e clique no link de confirmação que enviamos.',
    };
  }
  if (e.includes('user not found') || e.includes('no user found')) {
    return {
      message: 'Nenhuma conta encontrada com este e-mail.',
      hint: 'Verifique o e-mail digitado ou crie uma conta nova na aba "Criar Conta".',
    };
  }
  if (e.includes('email already registered') || e.includes('user already registered') || e.includes('already been registered')) {
    return {
      message: 'Este e-mail já possui uma conta cadastrada.',
      hint: 'Vá para a aba "Entrar" e faça login normalmente.',
    };
  }
  if (e.includes('password') && (e.includes('short') || e.includes('weak') || e.includes('characters'))) {
    return {
      message: 'Senha muito fraca ou curta.',
      hint: 'Use pelo menos 6 caracteres.',
    };
  }
  if (e.includes('rate limit') || e.includes('too many requests') || e.includes('over_email_send_rate_limit')) {
    return {
      message: 'Muitas tentativas em pouco tempo.',
      hint: 'Aguarde alguns minutos antes de tentar novamente.',
    };
  }
  if (e.includes('network') || e.includes('fetch') || e.includes('connection')) {
    return {
      message: 'Erro de conexão.',
      hint: 'Verifique sua internet e tente novamente.',
    };
  }
  if (e.includes('timeout') || e.includes('esgotado')) {
    return {
      message: 'A requisição demorou demais.',
      hint: 'Verifique sua conexão e tente novamente.',
    };
  }
  if (e.includes('invalid email') || e.includes('email inválido')) {
    return {
      message: 'E-mail inválido.',
      hint: 'Digite um endereço de e-mail válido (ex: nome@email.com).',
    };
  }

  // Fallback genérico
  return {
    message: 'Ocorreu um erro inesperado.',
    hint: 'Tente novamente. Se o problema persistir, entre em contato com o suporte.',
  };
};

// Componente de alerta de erro inline
const ErrorAlert = ({ message, hint }: { message: string; hint?: string }) => (
  <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-1 duration-200">
    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-red-700">{message}</p>
      {hint && <p className="text-xs text-red-500 mt-1 leading-relaxed">{hint}</p>}
    </div>
  </div>
);

// Componente de alerta de sucesso inline
const SuccessAlert = ({ message }: { message: string }) => (
  <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-1 duration-200">
    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
    <p className="text-sm font-bold text-emerald-700">{message}</p>
  </div>
);

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

  useEffect(() => {
    const refCode = params.get('ref');
    if (refCode) {
      sessionStorage.setItem('referral_code', refCode);
      setReferralCode(refCode);
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

  // ── SIGN IN state ──
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<{ message: string; hint?: string } | null>(null);

  // ── SIGN UP state ──
  const [emailForSignup, setEmailForSignup] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [signUpError, setSignUpError] = useState<{ message: string; hint?: string } | null>(null);

  // ── FORGOT PASSWORD state ──
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    // Guarda se já processamos um evento para não reagir duas vezes
    let handled = false;

    const redirectAfterLogin = async (session: any) => {
      if (handled) return;
      handled = true;

      console.log('[Login] redirectAfterLogin iniciado para user:', session.user.id);

      const storedRefCode = sessionStorage.getItem('referral_code');
      if (storedRefCode) {
        try {
          await supabase.rpc('link_referral', { referral_code_input: storedRefCode });
          sessionStorage.removeItem('referral_code');
        } catch (error) {}
      }

      try {
        console.log('[Login] buscando perfil...');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, cpf_cnpj, gender, date_of_birth, cep, street, number, neighborhood, city, state, must_change_password')
          .eq('id', session.user.id)
          .single();

        console.log('[Login] perfil recebido:', { profile, profileError });

        // Prioridade 1: Usuário precisa trocar a senha temporária
        if (profile?.must_change_password) {
          console.log('[Login] must_change_password=true → /update-password');
          navigate('/update-password', { replace: true, state: { mandatory: true } });
          return;
        }

        const isProfileComplete = profile &&
          profile.first_name && profile.last_name && profile.phone &&
          profile.cpf_cnpj && profile.gender && profile.date_of_birth &&
          profile.cep && profile.street && profile.number &&
          profile.neighborhood && profile.city && profile.state;

        console.log('[Login] isProfileComplete:', isProfileComplete, '→ redirecionando para:', !isProfileComplete ? '/complete-profile' : from);

        if (!isProfileComplete) {
          navigate('/complete-profile', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      } catch (err) {
        console.error('[Login] erro ao buscar perfil:', err);
        navigate(from, { replace: true });
      }
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Login] onAuthStateChange:', event, 'handled:', handled);
      // Só age em SIGNED_IN — ignora INITIAL_SESSION para não redirecionar usuários
      // que já estavam logados e voltaram para a página de login
      if (event === 'SIGNED_IN' && session) {
        redirectAfterLogin(session);
      }
    });

    return () => {
      try { data.subscription.unsubscribe(); } catch (e) {}
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

  // ── SIGN IN handler ──
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);

    const email = signInEmail.trim().toLowerCase();
    const password = signInPassword;

    if (!email) {
      setSignInError({ message: 'Informe seu e-mail.', hint: 'O campo de e-mail não pode estar vazio.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSignInError({ message: 'E-mail inválido.', hint: 'Digite um endereço de e-mail válido (ex: nome@email.com).' });
      return;
    }
    if (!password) {
      setSignInError({ message: 'Informe sua senha.', hint: 'O campo de senha não pode estar vazio.' });
      return;
    }

    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setSignInError(translateAuthError(error.message));
      }
    } catch (err: any) {
      setSignInError(translateAuthError(err?.message || 'Erro desconhecido'));
    } finally {
      setIsSigningIn(false);
    }
  };

  // ── SIGN UP: enviar código ──
  const fetchWithTimeout = (url: string, options: RequestInit, ms = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
  };

  const sendCode = async () => {
    setSignUpError(null);
    const email = emailForSignup.trim().toLowerCase();

    if (!email) {
      setSignUpError({ message: 'Informe seu e-mail.', hint: 'O campo de e-mail não pode estar vazio.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSignUpError({ message: 'E-mail inválido.', hint: 'Digite um endereço de e-mail válido (ex: nome@email.com).' });
      return;
    }

    setIsSendingCode(true);
    try {
      const genPromise = supabase.functions.invoke('generate-token', {
        body: { email, type: 'signup_otp', expires_in_seconds: 60 * 10 },
      });
      const gen = await Promise.race([
        genPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]) as any;

      if (gen.error || !gen.data?.code) {
        setSignUpError(translateAuthError(gen.error?.message || 'Erro ao gerar código'));
        return;
      }

      const code = gen.data.code;

      const emailRes = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/send-email-via-resend`, {
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
        setSignUpError(translateAuthError(emailData?.error || `Erro ao enviar e-mail (${emailRes.status})`));
        return;
      }

      setCodeSent(true);
      setResendCooldown(60);
      showSuccess(`Código enviado para ${email}!`);

    } catch (err: any) {
      setSignUpError(translateAuthError(err?.message || 'Erro inesperado'));
    } finally {
      setIsSendingCode(false);
    }
  };

  // ── SIGN UP: verificar código ──
  const verifyCode = async () => {
    setSignUpError(null);
    const cleanOtp = otp.replace(/\s/g, '');
    if (cleanOtp.length < 6) {
      setSignUpError({ message: 'Código incompleto.', hint: 'Insira todos os 6 dígitos do código enviado por e-mail.' });
      return;
    }
    setIsVerifying(true);
    try {
      const email = emailForSignup.trim().toLowerCase();

      const val = await Promise.race([
        supabase.functions.invoke('validate-token', { body: { email, code: cleanOtp } }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]) as any;

      if (val.error || !val.data?.success) {
        const msg = val.data?.error || 'invalid';
        if (msg.toLowerCase().includes('expir') || msg.toLowerCase().includes('expired')) {
          setSignUpError({
            message: 'Código expirado.',
            hint: 'O código tem validade de 10 minutos. Clique em "Reenviar" para receber um novo.',
          });
        } else {
          setSignUpError({
            message: 'Código incorreto.',
            hint: 'Verifique os 6 dígitos digitados. Se necessário, clique em "Reenviar" para um novo código.',
          });
        }
        return;
      }

      let createRes: any;
      try {
        createRes = await Promise.race([
          supabase.functions.invoke('create-user', { body: { email } }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
        ]);
      } catch (timeoutErr: any) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          showSuccess('Cadastro realizado! Redirecionando...');
          return;
        }
        throw timeoutErr;
      }

      if (createRes.error || !createRes.data?.success) {
        const errMsg = createRes.data?.error || createRes.error?.message || '';
        if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('registered')) {
          setSignUpError({
            message: 'Este e-mail já possui uma conta.',
            hint: 'Vá para a aba "Entrar" e faça login. Se esqueceu a senha, use "Esqueci minha senha".',
          });
        } else {
          setSignUpError(translateAuthError(errMsg || 'Erro ao criar conta'));
        }
        return;
      }

      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        showSuccess('Cadastro realizado! Redirecionando...');
        return;
      }

      const DEFAULT_PASSWORD = '123456';
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: DEFAULT_PASSWORD });

      if (signInError) {
        setSignUpError({
          message: 'Este e-mail já possui cadastro com senha personalizada.',
          hint: 'Vá para a aba "Entrar" e faça login com sua senha.',
        });
        setView('sign_in');
        return;
      }

      showSuccess('Código verificado! Redirecionando...');

    } catch (err: any) {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (session) {
        showSuccess('Cadastro realizado! Redirecionando...');
        return;
      }
      setSignUpError(translateAuthError(err?.message || 'Erro ao verificar código'));
    } finally {
      setIsVerifying(false);
    }
  };

  // ── FORGOT PASSWORD handler ──
  const handleForgotPassword = async () => {
    setForgotError(null);
    const email = forgotEmail.trim().toLowerCase();

    if (!email) {
      setForgotError({ message: 'Informe seu e-mail.', hint: 'O campo de e-mail não pode estar vazio.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setForgotError({ message: 'E-mail inválido.', hint: 'Digite um endereço de e-mail válido (ex: nome@email.com).' });
      return;
    }

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
        const errMsg = data?.error || '';
        if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('no user')) {
          setForgotError({
            message: 'Nenhuma conta encontrada com este e-mail.',
            hint: 'Verifique o e-mail digitado ou crie uma conta nova na aba "Criar Conta".',
          });
        } else {
          setForgotError(translateAuthError(errMsg || `Erro ${res.status}`));
        }
        return;
      }

      setForgotSent(true);
      showSuccess('Nova senha enviada para seu e-mail!');

    } catch (err: any) {
      setForgotError(translateAuthError(err?.message || 'Erro inesperado'));
    } finally {
      setIsSendingForgot(false);
    }
  };

  const tabView = view === 'forgot_password' ? 'sign_in' : view;

  const switchView = (v: string) => {
    setView(v as CustomView);
    setSignInError(null);
    setSignUpError(null);
    setForgotError(null);
    setCodeSent(false);
    setOtp('');
    setEmailForSignup('');
    setForgotSent(false);
    setForgotEmail('');
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
            <Tabs value={tabView} onValueChange={switchView} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-50 rounded-none h-14 p-1 border-b border-stone-100">
                <TabsTrigger value="sign_in" className="data-[state=active]:bg-white data-[state=active]:text-sky-600 font-black uppercase text-[10px] tracking-widest gap-2">
                  <LogIn className="h-3.5 w-3.5" /> Entrar
                </TabsTrigger>
                <TabsTrigger value="sign_up" className="data-[state=active]:bg-white data-[state=active]:text-sky-600 font-black uppercase text-[10px] tracking-widest gap-2">
                  <UserPlus className="h-3.5 w-3.5" /> Criar Conta
                </TabsTrigger>
              </TabsList>

              <div className="p-6 md:p-8">

                {/* ══════════════════════════════════════
                    CRIAR CONTA
                ══════════════════════════════════════ */}
                {view === 'sign_up' ? (
                  <div className="flex flex-col gap-4">
                    {/* Banner de indicação */}
                    {referralCode && (
                      <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl p-4 text-white flex items-start gap-3">
                        <div className="bg-white/20 rounded-xl p-2 shrink-0">
                          <Gift className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-sky-100 mb-0.5">Convite especial</p>
                          <p className="text-sm font-bold leading-snug">
                            {referrerName
                              ? <><span className="text-white">{referrerName}</span> te convidou para o CLUB DK!</> 
                              : 'Você foi convidado para o CLUB DK!'}
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
                          <p className="text-sm text-slate-500">
                            Digite seu e-mail e enviaremos um{' '}
                            <span className="font-bold text-charcoal-gray">código de 6 dígitos</span>{' '}
                            para validar seu acesso.
                          </p>
                        </div>

                        {signUpError && <ErrorAlert message={signUpError.message} hint={signUpError.hint} />}

                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-black">E-mail</Label>
                          <input
                            type="email"
                            placeholder="seu@email.com"
                            value={emailForSignup}
                            onChange={(e) => { setEmailForSignup(e.target.value); setSignUpError(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                            className={cn(
                              "w-full h-12 px-4 rounded-xl border bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all",
                              signUpError ? "border-red-300 focus:ring-red-200" : "border-stone-200 focus:ring-sky-200 focus:border-sky-400"
                            )}
                          />
                        </div>

                        <Button
                          onClick={sendCode}
                          className="h-12 uppercase font-black tracking-widest w-full"
                          disabled={isSendingCode}
                        >
                          {isSendingCode ? (
                            <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Enviando...</>
                          ) : (
                            'Enviar Código por E-mail'
                          )}
                        </Button>

                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => switchView('sign_in')}
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
                          <p className="text-sm text-slate-500">
                            Insira o código de 6 dígitos enviado para{' '}
                            <span className="font-bold text-sky-600">{emailForSignup}</span>
                          </p>
                        </div>

                        {signUpError && <ErrorAlert message={signUpError.message} hint={signUpError.hint} />}

                        <OtpInput value={otp} onChange={(v) => { setOtp(v); setSignUpError(null); }} />

                        <Button
                          onClick={verifyCode}
                          className="h-12 uppercase font-black tracking-widest w-full"
                          disabled={isVerifying || otp.replace(/\s/g, '').length < 6}
                        >
                          {isVerifying ? (
                            <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Verificando...</>
                          ) : (
                            'Verificar Código'
                          )}
                        </Button>

                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => { setCodeSent(false); setOtp(''); setEmailForSignup(''); setSignUpError(null); }}
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

                        <p className="text-xs text-slate-400 text-center">
                          Não recebeu? Verifique a caixa de spam.
                        </p>
                      </>
                    )}
                  </div>

                /* ══════════════════════════════════════
                    ESQUECI MINHA SENHA
                ══════════════════════════════════════ */
                ) : view === 'forgot_password' ? (
                  <div className="flex flex-col gap-4">
                    {!forgotSent ? (
                      <>
                        <div className="text-center space-y-1">
                          <div className="mx-auto w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
                            <KeyRound className="h-6 w-6 text-amber-500" />
                          </div>
                          <p className="text-sm font-bold text-charcoal-gray">Esqueceu sua senha?</p>
                          <p className="text-sm text-slate-500">
                            Informe seu e-mail cadastrado e enviaremos uma{' '}
                            <span className="font-bold text-charcoal-gray">nova senha</span> para você.
                          </p>
                        </div>

                        {forgotError && <ErrorAlert message={forgotError.message} hint={forgotError.hint} />}

                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-black">E-mail cadastrado</Label>
                          <input
                            type="email"
                            placeholder="seu@email.com"
                            value={forgotEmail}
                            onChange={(e) => { setForgotEmail(e.target.value); setForgotError(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                            className={cn(
                              "w-full h-12 px-4 rounded-xl border bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all",
                              forgotError ? "border-red-300 focus:ring-red-200" : "border-stone-200 focus:ring-sky-200 focus:border-sky-400"
                            )}
                          />
                        </div>

                        <Button
                          onClick={handleForgotPassword}
                          disabled={isSendingForgot}
                          className="h-12 uppercase font-black tracking-widest gap-2 w-full"
                        >
                          {isSendingForgot ? (
                            <><Loader2 className="animate-spin h-4 w-4" /> Enviando...</>
                          ) : (
                            <><Mail className="h-4 w-4" /> Enviar Nova Senha</>
                          )}
                        </Button>

                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => switchView('sign_in')}
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
                            Verifique sua caixa de entrada. A nova senha foi enviada para{' '}
                            <span className="font-bold text-sky-600">{forgotEmail}</span>.
                          </p>
                        </div>
                        <p className="text-xs text-slate-400">Não recebeu? Verifique a caixa de spam.</p>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            onClick={() => { setForgotSent(false); setForgotEmail(''); setForgotError(null); }}
                            className="uppercase font-bold tracking-widest text-xs"
                          >
                            Tentar outro e-mail
                          </Button>
                          <button
                            type="button"
                            onClick={() => switchView('sign_in')}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                          >
                            ← Voltar para o Login
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                /* ══════════════════════════════════════
                    ENTRAR (formulário próprio)
                ══════════════════════════════════════ */
                ) : (
                  <form onSubmit={handleSignIn} className="flex flex-col gap-4" noValidate>
                    {signInError && <ErrorAlert message={signInError.message} hint={signInError.hint} />}

                    <div className="space-y-1.5">
                      <Label htmlFor="signin-email" className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                        E-mail
                      </Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={signInEmail}
                        onChange={(e) => { setSignInEmail(e.target.value); setSignInError(null); }}
                        className={cn(
                          "h-12 rounded-xl transition-all",
                          signInError ? "border-red-300 focus-visible:ring-red-200" : ""
                        )}
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password" className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                          Senha
                        </Label>
                        <button
                          type="button"
                          onClick={() => { setView('forgot_password'); setSignInError(null); }}
                          className="text-[10px] font-bold uppercase tracking-widest text-sky-500 hover:text-sky-600 transition-colors"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={signInPassword}
                          onChange={(e) => { setSignInPassword(e.target.value); setSignInError(null); }}
                          className={cn(
                            "h-12 rounded-xl pr-12 transition-all",
                            signInError ? "border-red-300 focus-visible:ring-red-200" : ""
                          )}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-12 uppercase font-black tracking-widest w-full mt-1"
                      disabled={isSigningIn}
                    >
                      {isSigningIn ? (
                        <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Entrando...</>
                      ) : (
                        'Acessar Conta'
                      )}
                    </Button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => switchView('sign_up')}
                        className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                      >
                        Não tenho conta — Criar agora
                      </button>
                    </div>
                  </form>
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
