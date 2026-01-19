import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
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
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado inválido").max(2, "Use a sigla do estado (ex: SC)"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'local' | 'correios' | null>(null);

  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const handleCepLookup = async () => {
    const cep = getValues('cep');
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
      showError("Por favor, insira um CEP válido com 8 dígitos.");
      return;
    }
    setIsFetchingCep(true);
    setDeliveryType(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-cep', {
        body: { cep: cleanedCep },
      });

      if (error) {
        const errorBody = JSON.parse(error.context.responseText);
        showError(errorBody.error || "Não foi possível buscar o endereço.");
        setValue('street', '');
        setValue('neighborhood', '');
        setValue('city', '');
        setValue('state', '');
        return;
      }

      setValue('street', data.logradouro);
      setValue('neighborhood', data.bairro);
      setValue('city', data.localidade);
      setValue('state', data.uf);
      
      if (data.deliveryType === 'correios') {
        setDeliveryType('correios');
        showSuccess("Endereço localizado (Entrega via Correios)");
      } else {
        setDeliveryType('local');
      }

    } catch (e) {
      showError("Ocorreu um erro inesperado ao buscar o CEP.");
    } finally {
      setIsFetchingCep(false);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
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
          navigate('/');
        }
      }
      setLoading(false);
    };
    checkSession();
  }, [navigate]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    const toastId = showLoading("Salvando informações...");

    const { error } = await supabase
      .from('profiles')
      .update({
        ...data,
        phone: data.phone.replace(/\D/g, ''),
        cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ''),
        date_of_birth: format(data.date_of_birth, 'yyyy-MM-dd'),
      })
      .eq('id', user.id);

    dismissToast(toastId);
    if (error) {
      showError("Erro ao salvar. Tente novamente.");
      console.error(error);
    } else {
      showSuccess("Cadastro completo!");
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      navigate('/');
    }
    setIsSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;
  }

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
            
            {/* Dados Pessoais */}
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Dados Pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-charcoal-gray">Nome</Label>
                  <Input id="first_name" {...register('first_name')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.first_name && <p className="text-xs text-red-500 font-bold">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-charcoal-gray">Sobrenome</Label>
                  <Input id="last_name" {...register('last_name')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.last_name && <p className="text-xs text-red-500 font-bold">{errors.last_name.message}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="cpf_cnpj" className="text-charcoal-gray">CPF / CNPJ</Label>
                    <Input 
                      id="cpf_cnpj" 
                      {...register('cpf_cnpj')} 
                      onChange={(e) => e.target.value = maskCpfCnpj(e.target.value)} 
                      placeholder="000.000.000-00" 
                      className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" 
                    />
                    {errors.cpf_cnpj && <p className="text-xs text-red-500 font-bold">{errors.cpf_cnpj.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-charcoal-gray">Gênero</Label>
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
                    <Label htmlFor="date_of_birth" className="text-charcoal-gray">Data de Nascimento</Label>
                    <div className="[&>button]:w-full [&>button]:h-12 [&>button]:bg-stone-50 [&>button]:border-stone-200 [&>button]:rounded-xl [&>button]:text-charcoal-gray">
                        <Controller 
                            name="date_of_birth" 
                            control={control} 
                            render={({ field }) => (
                            <DatePicker value={field.value} onChange={field.onChange} />
                            )} 
                        />
                    </div>
                    {errors.date_of_birth && <p className="text-xs text-red-500 font-bold">{errors.date_of_birth.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-charcoal-gray">Telefone</Label>
                    <Input id="phone" {...register('phone')} onChange={(e) => e.target.value = maskPhone(e.target.value)} placeholder="(48) 99999-9999" className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
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
                  <Label htmlFor="cep" className="text-charcoal-gray">CEP</Label>
                  <div className="flex items-center space-x-3">
                    <Input id="cep" {...register('cep')} onChange={(e) => e.target.value = maskCep(e.target.value)} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                    <Button type="button" size="icon" onClick={handleCepLookup} disabled={isFetchingCep} className="bg-sky-500 hover:bg-sky-400 text-white h-12 w-14 rounded-xl shrink-0 shadow-md">
                      {isFetchingCep ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    </Button>
                  </div>
                  {errors.cep && <p className="text-xs text-red-500 font-bold">{errors.cep.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street" className="text-charcoal-gray">Rua</Label>
                  <Input id="street" {...register('street')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.street && <p className="text-xs text-red-500 font-bold">{errors.street.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="number" className="text-charcoal-gray">Número</Label>
                      <Input id="number" {...register('number')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                      {errors.number && <p className="text-xs text-red-500 font-bold">{errors.number.message}</p>}
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="complement" className="text-charcoal-gray">Complemento (opcional)</Label>
                      <Input id="complement" {...register('complement')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                    </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood" className="text-charcoal-gray">Bairro</Label>
                  <Input id="neighborhood" {...register('neighborhood')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                  {errors.neighborhood && <p className="text-xs text-red-500 font-bold">{errors.neighborhood.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="city" className="text-charcoal-gray">Cidade</Label>
                      <Input id="city" {...register('city')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                      {errors.city && <p className="text-xs text-red-500 font-bold">{errors.city.message}</p>}
                    </div>
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="state" className="text-charcoal-gray">Estado</Label>
                      <Input id="state" {...register('state')} className="bg-stone-50 border-stone-200 h-12 rounded-xl focus:bg-white transition-colors" />
                      {errors.state && <p className="text-xs text-red-500 font-bold">{errors.state.message}</p>}
                    </div>
                </div>
            </div>
            <Button type="submit" size="lg" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 rounded-xl shadow-lg transition-all active:scale-95 text-sm" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Finalizar Cadastro'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfilePage;