import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { getSessionWithRetry } from '@/lib/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Search, Truck, CheckCircle } from 'lucide-react';
import { maskCep, maskPhone, maskCpfCnpj } from '@/utils/masks';
import { DatePicker } from '@/components/ui/DatePicker';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from '@/components/ui/checkbox';
import { logger } from '@/lib/logger';
import InformationalPopup from '@/components/InformationalPopup';

const profileSchema = z.object({
  first_name: z.string().min(1, "Nome é obrigatório"),
  last_name: z.string().min(1, "Sobrenome é obrigatório"),
  date_of_birth: z.date({ required_error: "Data de nascimento é obrigatória." }),
  phone: z.string().min(14, "Telefone inválido").max(15, "Telefone inválido"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ inválido").max(18, "CPF/CNPJ inválido"),
  gender: z.string({ required_error: "Gênero é obrigatório" }).min(1, "Selecione um gênero"),
  cep: z.string().min(9, "CEP inválido"),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().min(1, "Complemento é obrigatório"),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado inválido").max(2, "Use a sigla do estado (ex: SC)"),
  accepted_terms: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const TERMS_VERSION = "1.0"; // Version identifier for current terms
const termsContent = `Prezado Cliente, leia com atenção os Termos de Uso e a Política de Privacidade. Ao aceitar, você concorda com o uso e tratamento dos seus dados conforme descrito.`;

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [cepSearched, setCepSearched] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'local' | 'correios' | null>(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [cpfValidated, setCpfValidated] = useState(false);

  const { register, handleSubmit, control, setValue, getValues, watch, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  // If token present in URL, validate via validate-token function and pre-fill email
  useEffect(() => {
    const initFromToken = async () => {
      const token = searchParams.get('token');
      if (!token) return;

      try {
        const resp = await fetch(`${window.location.origin}/api/validate-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          showError(json?.error || 'Token inválido ou expirado.');
          navigate('/login');
          return;
        }

        const { email, user_id, type } = json;
        if (type !== 'complete_profile') {
          showError('Token inválido para essa ação.');
          navigate('/login');
          return;
        }

        // Pre-fill email into form (non-editable)
        setValue('phone', '');
        setValue('cpf_cnpj', '');
        setUser({ email, id: user_id });
        setLoading(false);
      } catch (err) {
        console.error('[CompleteProfilePage] token init error', err);
        showError('Erro ao validar token.');
        navigate('/login');
      }
    };

    initFromToken();
  }, [searchParams, navigate, setValue]);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const session = await getSessionWithRetry();

        if (cancelled) return;

        if (!session) {
          const hasToken = searchParams.get('token');
          if (!hasToken) setLoading(false);
          return;
        }

        setUser(session.user);

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (cancelled) return;

        const isProfileComplete = profile &&
          profile.first_name &&
          profile.last_name &&
          profile.date_of_birth &&
          profile.phone &&
          profile.cpf_cnpj &&
          profile.gender &&
          profile.cep &&
          profile.street &&
          profile.number &&
          profile.neighborhood &&
          profile.city &&
          profile.state;

        if (isProfileComplete) {
          navigate('/', { replace: true });
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error('[CompleteProfilePage] checkSession error:', err);
        if (!cancelled) setLoading(false);
      }
    };

    checkSession();

    return () => { cancelled = true; };
  }, [navigate, searchParams]);

  // watch required fields to determine whether to enable submit and to show '*' markers
  const watched = watch();

  const checkCpfDuplicate = async () => {
    const raw = getValues('cpf_cnpj') || '';
    const clean = raw.replace(/\D/g, '');
    if (clean.length < 11) return;

    if (isCheckingCpf) return;

    setIsCheckingCpf(true);
    setCpfError(null);
    setCpfValidated(false);

    const watchdog = setTimeout(() => {
      logger.warn('[CompleteProfilePage] checkCpfDuplicate watchdog cleared');
      setIsCheckingCpf(false);
      setCpfValidated(true); // don't block user on timeout
    }, 20000);

    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('cpf_cnpj', clean)
        .neq('id', user?.id || '')
        .maybeSingle();
      if (existing) {
        setCpfError('Este CPF/CNPJ já está cadastrado em outra conta.');
        setCpfValidated(false);
      } else {
        setCpfValidated(true);
      }
    } catch (e) {
      console.error('[CompleteProfilePage] checkCpfDuplicate error', e);
      // Don't block user on network error — allow submit without duplicate check
      setCpfValidated(true);
    } finally {
      clearTimeout(watchdog);
      setIsCheckingCpf(false);
    }
  };

  const requiredFieldsFilled = useMemo(() => {
    const f = watched.first_name && watched.last_name;
    const dob = watched.date_of_birth;
    const phone = (watched.phone || '').replace(/\D/g, '');
    const cpf = (watched.cpf_cnpj || '').replace(/\D/g, '');
    const gender = watched.gender;
    const cep = watched.cep;
    const street = watched.street;
    const number = watched.number;
    const complement = watched.complement;
    const neighborhood = watched.neighborhood;
    const city = watched.city;
    const state = watched.state;

    return Boolean(f && dob && phone && phone.length >= 10 && cpf && cpf.length >= 11 && gender && cep && street && number && complement && complement.trim() && neighborhood && city && state);
  }, [watched]);

  const accepted = Boolean(watched.accepted_terms);

  const isReadyToSubmit = requiredFieldsFilled && accepted && !cpfError && !isCheckingCpf;

  const LOCAL_DELIVERY_CITIES = [
    'curitiba', 'pinhais', 'são josé dos pinhais', 'colombo',
    'piraquara', 'araucária', 'almirante tamandaré', 'campo largo', 'fazenda rio grande',
  ];

  const fillAddressFromData = (data: any) => {
    setValue('street', data.logradouro || '');
    setValue('neighborhood', data.bairro || '');
    setValue('city', data.localidade || '');
    setValue('state', data.uf || '');
    setCepSearched(true);

    const city = (data.localidade || '').trim().toLowerCase();
    const deliveryT = data.deliveryType || (LOCAL_DELIVERY_CITIES.includes(city) ? 'local' : 'correios');
    setDeliveryType(deliveryT);
    if (deliveryT === 'correios') {
      showSuccess("Endereço localizado (Entrega via Correios)");
    } else {
      showSuccess("Endereço localizado!");
    }
  };

  const handleCepLookup = async () => {
    const cep = (getValues('cep') || '').toString();
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
      showError("Por favor, insira um CEP válido com 8 dígitos.");
      return;
    }

    if (isFetchingCep) return;

    setIsFetchingCep(true);
    setDeliveryType(null);
    setCepSearched(false);

    setValue('street', '');
    setValue('neighborhood', '');
    setValue('city', '');
    setValue('state', '');

    const watchdog = setTimeout(() => {
      logger.warn('[CompleteProfilePage] handleCepLookup watchdog cleared');
      setIsFetchingCep(false);
    }, 20000);

    try {
      // Tentativa 1: Edge function (com regra de negócio de estado)
      let edgeFailed = false;
      try {
        const invokePromise = supabase.functions.invoke('validate-cep', {
          body: { cep: cleanedCep },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        );
        const result: any = await Promise.race([invokePromise, timeoutPromise]);
        const { data, error } = result || {};

        if (error) {
          // Tentar extrair mensagem de erro de regra de negócio
          let status = error?.context?.status || error?.status;
          let msg = '';
          try {
            if (error?.context?.responseText) {
              const parsed = JSON.parse(error.context.responseText);
              msg = parsed.error || '';
              if (!status) status = error?.context?.status;
            }
          } catch (_) {}

          // Erros 400 (regra de negócio: CEP fora do PR ou inválido) e 404 (não encontrado)
          // devem ser exibidos ao usuário sem tentar o fallback
          if (status === 400 || status === 404) {
            showError(msg || 'CEP não encontrado ou fora da área de entrega.');
            return;
          }

          // Erro técnico (500, timeout, network) → tentar fallback
          logger.warn('[CompleteProfilePage] edge function falhou, tentando fallback ViaCEP:', error);
          edgeFailed = true;
        } else if (data) {
          fillAddressFromData(data);
          return;
        } else {
          edgeFailed = true;
        }
      } catch (edgeErr: any) {
        logger.warn('[CompleteProfilePage] edge function exception, tentando fallback ViaCEP:', edgeErr);
        edgeFailed = true;
      }

      // Tentativa 2: Fallback direto para ViaCEP
      if (edgeFailed) {
        const resp = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        if (!resp.ok) {
          showError('Serviço de CEP indisponível. Tente novamente.');
          return;
        }
        const data = await resp.json();
        if (data.erro) {
          showError('CEP não encontrado. Verifique e tente novamente.');
          return;
        }
        // Aplicar regra de negócio no frontend
        if (data.uf !== 'PR') {
          showError(`No momento, realizamos entregas apenas no Paraná. O CEP informado pertence a ${data.localidade} / ${data.uf}.`);
          return;
        }
        fillAddressFromData(data);
      }

    } catch (e: any) {
      if (String(e?.message || '').toLowerCase().includes('timeout')) {
        showError('A busca pelo CEP está demorando. Tente novamente mais tarde.');
      } else {
        showError("Ocorreu um erro inesperado ao buscar o CEP.");
        console.error('[CompleteProfilePage] handleCepLookup error:', e);
      }
    } finally {
      clearTimeout(watchdog);
      setIsFetchingCep(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    const toastId = showLoading("Salvando informações...");

    try {
      let emailToSet = user?.email || null;
      if (!emailToSet) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) emailToSet = session.user.email as string;
      }

      const cleanCpf = data.cpf_cnpj.replace(/\D/g, '');

      // Remove accepted_terms from payload — it's not a DB column
      const { accepted_terms, ...rest } = data;

      const profilePayload: any = {
        ...rest,
        email: emailToSet,
        phone: data.phone.replace(/\D/g, ''),
        cpf_cnpj: cleanCpf,
        date_of_birth: format(data.date_of_birth, 'yyyy-MM-dd'),
        accepted_terms_version: TERMS_VERSION,
        accepted_terms_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert({
        id: user?.id || undefined,
        ...profilePayload,
      }, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      dismissToast(toastId);
      showSuccess("Cadastro completo!");
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      navigate('/');
    } catch (err: any) {
      dismissToast(toastId);
      showError(err.message || "Erro ao salvar. Tente novamente.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenTerms = () => setIsTermsOpen(true);
  const handleCloseTerms = () => setIsTermsOpen(false);
  const handleAcceptTerms = () => {
    setValue('accepted_terms', true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;
  }

  const requiredStar = (fieldName: keyof ProfileFormData) => {
    const val = (watched as any)[fieldName];
    const missing = !val || (typeof val === 'string' && val.trim() === '');
    if (fieldName === 'phone' && val) {
      const digits = String(val).replace(/\D/g, '');
      return digits.length < 10;
    }
    if (fieldName === 'cpf_cnpj' && val) {
      const digits = String(val).replace(/\D/g, '');
      return digits.length < 11;
    }
    if (fieldName === 'state' && val) {
      return String(val).trim().length < 2;
    }
    return missing;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-2xl my-8 bg-white border border-stone-200 shadow-2xl rounded-[2rem] z-10">
        <CardHeader className="text-center pb-2 pt-10">
          <div className="mx-auto bg-sky-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-sky-600" />
          </div>
          <CardTitle className="font-black text-3xl md:text-4xl text-charcoal-gray italic uppercase tracking-tighter">Complete seu Cadastro.</CardTitle>
          <CardDescription className="text-stone-500 font-medium text-lg mt-2">
            Finalize suas informações para acessar a loja.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 md:p-12">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

            {/* If token flow provided email, show it */}
            {user?.email && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user.email} readOnly className="bg-stone-50 border-stone-200 h-12 rounded-xl" />
              </div>
            )}

            {/* Dados Pessoais */}
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Dados Pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-charcoal-gray">Nome {requiredStar('first_name') && <span className="text-red-500">*</span>}</Label>
                  <Input id="first_name" {...register('first_name')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.first_name && <p className="text-xs text-red-500 font-bold">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-charcoal-gray">Sobrenome {requiredStar('last_name') && <span className="text-red-500">*</span>}</Label>
                  <Input id="last_name" {...register('last_name')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.last_name && <p className="text-xs text-red-500 font-bold">{errors.last_name.message}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="cpf_cnpj" className="text-charcoal-gray">CPF / CNPJ {requiredStar('cpf_cnpj') && <span className="text-red-500">*</span>}</Label>
                    <div className="relative">
                      <Controller
                        name="cpf_cnpj"
                        control={control}
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            id="cpf_cnpj"
                            value={field.value}
                            onChange={(e) => {
                              const masked = maskCpfCnpj(e.target.value);
                              field.onChange(masked);
                              setCpfError(null);
                              setCpfValidated(false);
                            }}
                            onBlur={() => {
                              // trigger validation and duplicate check
                              field.onBlur();
                              checkCpfDuplicate();
                            }}
                            placeholder="000.000.000-00"
                            className={`bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors pr-10 ${cpfError ? 'border-red-400 focus:ring-red-300' : cpfValidated ? 'border-emerald-400' : ''}`}
                          />
                        )}
                      />
                      {isCheckingCpf && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        </div>
                      )}
                    </div>
                    {cpfError && (
                      <p className="text-xs text-red-500 font-bold flex items-center gap-1">
                        ⚠️ {cpfError}
                      </p>
                    )}
                    {cpfValidated && !cpfError && (
                      <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        ✅ CPF/CNPJ validado com sucesso!
                      </p>
                    )}
                    {!cpfError && !cpfValidated && errors.cpf_cnpj && <p className="text-xs text-red-500 font-bold">{errors.cpf_cnpj.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-charcoal-gray">Gênero {requiredStar('gender') && <span className="text-red-500">*</span>}</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors text-charcoal-gray">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-stone-200 text-charcoal-gray">
                            <SelectItem value="male">Masculino</SelectItem>
                            <SelectItem value="female">Feminino</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.gender && <p className="text-xs text-red-500 font-bold">{errors.gender.message}</p>}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth" className="text-charcoal-gray">Data de Nascimento {requiredStar('date_of_birth') && <span className="text-red-500">*</span>}</Label>
                    <div>
                                            <Controller
                                                name="date_of_birth"
                                                control={control}
                                                render={({ field }) => (
                                                  <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                                                )}
                                            />
                                        </div>
                    {errors.date_of_birth && <p className="text-xs text-red-500 font-bold">{errors.date_of_birth.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-charcoal-gray">Telefone {requiredStar('phone') && <span className="text-red-500">*</span>}</Label>
                    <Input id="phone" {...register('phone')} onChange={(e) => { const masked = maskPhone(e.target.value); e.target.value = masked; setValue('phone', masked, { shouldValidate: false }); }} placeholder="(48) 99999-9999" className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                    {errors.phone && <p className="text-xs text-red-500 font-bold">{errors.phone.message}</p>}
                  </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-6 pt-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Endereço de Entrega</h3>
                
                {deliveryType === 'correios' && (
                  <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800 rounded-xl">
                    <Truck className="h-4 w-4" />
                    <AlertTitle className="font-bold uppercase text-xs tracking-wider">Entrega via Correios</AlertTitle>
                    <AlertDescription className="text-xs">
                      Para sua região, os pedidos são enviados via Correios. O prazo de entrega pode variar.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cep" className="text-charcoal-gray">CEP {requiredStar('cep') && <span className="text-red-500">*</span>}</Label>
                  <div className="flex items-center space-x-3">
                    <Controller
                      name="cep"
                      control={control}
                      defaultValue=""
                      render={({ field }) => (
                        <Input
                          id="cep"
                          value={field.value}
                          onChange={(e) => {
                            const masked = maskCep(e.target.value);
                            field.onChange(masked);
                            // Reset address fields when CEP changes
                            if (cepSearched) {
                              setCepSearched(false);
                              setValue('street', '');
                              setValue('neighborhood', '');
                              setValue('city', '');
                              setValue('state', '');
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCepLookup();
                            }
                          }}
                          placeholder="00000-000"
                          className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors"
                        />
                      )}
                    />
                    <Button type="button" size="icon" onClick={handleCepLookup} disabled={isFetchingCep} className="bg-sky-500 hover:bg-sky-400 text-white h-12 w-14 rounded-xl shrink-0 shadow-md">
                      {isFetchingCep ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    </Button>
                  </div>
                  {errors.cep && <p className="text-xs text-red-500 font-bold">{errors.cep.message}</p>}
                  {!cepSearched && (
                    <p className="text-xs text-stone-400 font-medium">Digite o CEP e clique na lupa 🔍 para preencher o endereço automaticamente.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street" className="text-charcoal-gray">Rua {requiredStar('street') && <span className="text-red-500">*</span>}</Label>
                  <Input
                    id="street"
                    {...register('street')}
                    readOnly={cepSearched && !!watched.street}
                    tabIndex={cepSearched && !!watched.street ? -1 : undefined}
                    placeholder={cepSearched && !watched.street ? "Digite sua rua" : "Preenchido automaticamente pelo CEP"}
                    className={cepSearched && !!watched.street
                      ? "bg-stone-100 border-stone-200 h-12 rounded-xl text-stone-600 cursor-not-allowed select-none"
                      : "bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors"}
                  />
                  {errors.street && <p className="text-xs text-red-500 font-bold">{errors.street.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="number" className="text-charcoal-gray">Número {requiredStar('number') && <span className="text-red-500">*</span>}</Label>
                      <Input id="number" {...register('number')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                      {errors.number && <p className="text-xs text-red-500 font-bold">{errors.number.message}</p>}
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="complement" className="text-charcoal-gray">Complemento <span className="text-red-500">*</span></Label>
                      <Input id="complement" {...register('complement')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                      {errors.complement && <p className="text-xs text-red-500 font-bold">{errors.complement.message}</p>}
                    </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood" className="text-charcoal-gray">Bairro {requiredStar('neighborhood') && <span className="text-red-500">*</span>}</Label>
                  <Input
                    id="neighborhood"
                    {...register('neighborhood')}
                    readOnly={cepSearched && !!watched.neighborhood}
                    tabIndex={cepSearched && !!watched.neighborhood ? -1 : undefined}
                    placeholder={cepSearched && !watched.neighborhood ? "Digite seu bairro" : "Preenchido automaticamente pelo CEP"}
                    className={cepSearched && !!watched.neighborhood
                      ? "bg-stone-100 border-stone-200 h-12 rounded-xl text-stone-600 cursor-not-allowed select-none"
                      : "bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors"}
                  />
                  {errors.neighborhood && <p className="text-xs text-red-500 font-bold">{errors.neighborhood.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="city" className="text-charcoal-gray">Cidade {requiredStar('city') && <span className="text-red-500">*</span>}</Label>
                      <Input
                        id="city"
                        {...register('city')}
                        readOnly={cepSearched && !!watched.city}
                        tabIndex={cepSearched && !!watched.city ? -1 : undefined}
                        placeholder={cepSearched && !watched.city ? "Digite sua cidade" : "Preenchido automaticamente pelo CEP"}
                        className={cepSearched && !!watched.city
                          ? "bg-stone-100 border-stone-200 h-12 rounded-xl text-stone-600 cursor-not-allowed select-none"
                          : "bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors"}
                      />
                      {errors.city && <p className="text-xs text-red-500 font-bold">{errors.city.message}</p>}
                    </div>
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="state" className="text-charcoal-gray">Estado {requiredStar('state') && <span className="text-red-500">*</span>}</Label>
                      <Input
                        id="state"
                        {...register('state')}
                        readOnly={cepSearched && !!watched.state}
                        tabIndex={cepSearched && !!watched.state ? -1 : undefined}
                        placeholder={cepSearched && !watched.state ? "UF" : "UF"}
                        className={cepSearched && !!watched.state
                          ? "bg-stone-100 border-stone-200 h-12 rounded-xl text-stone-600 cursor-not-allowed select-none"
                          : "bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors"}
                      />
                      {errors.state && <p className="text-xs text-red-500 font-bold">{errors.state.message}</p>}
                    </div>
                </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <Controller
                name="accepted_terms"
                control={control}
                defaultValue={false}
                render={({ field }) => (
                  <Checkbox id="accepted_terms" checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                )}
              />
              <div className="text-sm text-slate-600">
                <label htmlFor="accepted_terms" className="cursor-pointer">Li e aceito os <button type="button" onClick={handleOpenTerms} className="text-sky-500 underline">Termos de Uso e Política de Privacidade</button>.</label>
                {errors.accepted_terms && <p className="text-xs text-red-500 font-bold">{(errors.accepted_terms as any)?.message}</p>}
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 rounded-xl shadow-lg transition-all active:scale-95 text-sm" disabled={!isReadyToSubmit || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Finalizar Cadastro'}
            </Button>
            {!isReadyToSubmit && (
              <p className="text-xs text-rose-600 mt-2">Preencha todos os campos obrigatórios e aceite os termos para habilitar o botão.</p>
            )}
          </form>
        </CardContent>
      </Card>

      <InformationalPopup isOpen={isTermsOpen} onClose={handleCloseTerms} title="Termo de Uso e Responsabilidade" content={termsContent} onAccept={() => { handleAcceptTerms(); handleCloseTerms(); }} />
    </div>
  );
};

export default CompleteProfilePage;