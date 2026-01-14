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
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Search, Truck, AlertCircle } from 'lucide-react';
import { maskCep, maskPhone } from '@/utils/masks';
import { DatePicker } from '@/components/ui/DatePicker';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const profileSchema = z.object({
  first_name: z.string().min(1, "Nome é obrigatório"),
  last_name: z.string().min(1, "Sobrenome é obrigatório"),
  date_of_birth: z.date({ required_error: "Data de nascimento é obrigatória." }),
  phone: z.string().min(14, "Telefone inválido").max(15, "Telefone inválido"),
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
          .select('first_name, last_name, date_of_birth, phone, cep, street, number, neighborhood, city, state')
          .eq('id', session.user.id)
          .single();
        
        const isProfileComplete = profile && profile.first_name && profile.last_name && profile.date_of_birth && profile.phone && profile.cep && profile.street && profile.number && profile.neighborhood && profile.city && profile.state;

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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-2xl my-8 bg-white/5 border-white/10 text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="font-serif text-3xl text-white italic">Complete seu Cadastro.</CardTitle>
          <CardDescription className="text-slate-300 font-medium">Precisamos de mais algumas informações para finalizar seu cadastro.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nome</Label>
                <Input id="first_name" {...register('first_name')} className="bg-slate-900 border-white/10 text-white" />
                {errors.first_name && <p className="text-sm text-red-400 font-bold">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Sobrenome</Label>
                <Input id="last_name" {...register('last_name')} className="bg-slate-900 border-white/10 text-white" />
                {errors.last_name && <p className="text-sm text-red-400 font-bold">{errors.last_name.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Data de Nascimento</Label>
                  <Controller 
                    name="date_of_birth" 
                    control={control} 
                    render={({ field }) => (
                      <DatePicker value={field.value} onChange={field.onChange} />
                    )} 
                  />
                  {errors.date_of_birth && <p className="text-sm text-red-400 font-bold">{errors.date_of_birth.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" {...register('phone')} onChange={(e) => e.target.value = maskPhone(e.target.value)} placeholder="(48) 99999-9999" className="bg-slate-900 border-white/10 text-white" />
                  {errors.phone && <p className="text-sm text-red-400 font-bold">{errors.phone.message}</p>}
                </div>
            </div>
            <div className="border-t border-white/10 pt-6 space-y-4">
                <h3 className="text-xl font-bold text-sky-400 italic">Endereço de Entrega.</h3>
                
                {deliveryType === 'correios' && (
                  <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-200">
                    <Truck className="h-4 w-4" />
                    <AlertTitle className="font-bold uppercase text-xs tracking-wider">Entrega via Correios</AlertTitle>
                    <AlertDescription className="text-xs">
                      Para sua região, os pedidos são enviados via Correios. O prazo de entrega pode variar.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <div className="flex items-center space-x-2">
                    <Input id="cep" {...register('cep')} onChange={(e) => e.target.value = maskCep(e.target.value)} className="bg-slate-900 border-white/10 text-white" />
                    <Button type="button" size="icon" onClick={handleCepLookup} disabled={isFetchingCep} className="bg-sky-500 hover:bg-sky-400 text-white shrink-0">
                      {isFetchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.cep && <p className="text-sm text-red-400 font-bold">{errors.cep.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street">Rua</Label>
                  <Input id="street" {...register('street')} className="bg-slate-900 border-white/10 text-white" />
                  {errors.street && <p className="text-sm text-red-400 font-bold">{errors.street.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="number">Número</Label>
                      <Input id="number" {...register('number')} className="bg-slate-900 border-white/10 text-white" />
                      {errors.number && <p className="text-sm text-red-400 font-bold">{errors.number.message}</p>}
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="complement">Complemento (opcional)</Label>
                      <Input id="complement" {...register('complement')} className="bg-slate-900 border-white/10 text-white" />
                    </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input id="neighborhood" {...register('neighborhood')} className="bg-slate-900 border-white/10 text-white" />
                  {errors.neighborhood && <p className="text-sm text-red-400 font-bold">{errors.neighborhood.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input id="city" {...register('city')} className="bg-slate-900 border-white/10 text-white" />
                      {errors.city && <p className="text-sm text-red-400 font-bold">{errors.city.message}</p>}
                    </div>
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input id="state" {...register('state')} className="bg-slate-900 border-white/10 text-white" />
                      {errors.state && <p className="text-sm text-red-400 font-bold">{errors.state.message}</p>}
                    </div>
                </div>
            </div>
            <Button type="submit" size="lg" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 rounded-xl shadow-lg" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Finalizar Cadastro'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfilePage;