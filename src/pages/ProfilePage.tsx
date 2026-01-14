import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Search, User, MapPin, Star, Truck } from 'lucide-react';
import { maskCep, maskPhone } from '@/utils/masks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserReviewsTab from '@/components/UserReviewsTab';
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
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado inválido").max(2, "Use a sigla do estado (ex: SC)"),
  complement: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const ProfilePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'local' | 'correios' | null>(null);

  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const handleCepLookup = async () => {
    const cup = getValues('cep');
    const cleanedCep = cup.replace(/\D/g, '');
    if (cleanedCep.length !== 8) {
      showError("Por favor, insira um CEP válido com 8 dígitos.");
      return;
    }
    setIsFetchingCep(true);
    setDeliveryType(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-cep', { body: { cep: cleanedCep } });
      if (error) {
        const errorBody = JSON.parse(error.context.responseText);
        showError(errorBody.error || "Não foi possível buscar o endereço.");
        setValue('street', ''); setValue('neighborhood', ''); setValue('city', ''); setValue('state', '');
        return;
      }
      setValue('street', data.logradouro); setValue('neighborhood', data.bairro); setValue('city', data.localidade); setValue('state', data.uf);
      
      if (data.deliveryType === 'correios') {
        setDeliveryType('correios');
      } else {
        setDeliveryType('local');
      }
    } catch (e) {
      showError("Ocorreu um erro inesperado ao buscar o CEP.");
    } finally {
      setIsFetchingCep(false);
    }
  };

  const searchParams = new URLSearchParams(location.search);
  const defaultTab = searchParams.get('tab') || 'profile';

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      setUser(session.user);

      const { data: profileData, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (error) {
        console.error("Erro ao buscar perfil:", error);
      } else if (profileData) {
        const initialFormValues = {
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          date_of_birth: profileData.date_of_birth ? new Date(`${profileData.date_of_birth}T00:00:00`) : new Date(),
          phone: profileData.phone ? maskPhone(profileData.phone) : '',
          cep: profileData.cep ? maskCep(profileData.cep) : '',
          street: profileData.street || '',
          number: profileData.number || '',
          neighborhood: profileData.neighborhood || '',
          city: profileData.city || '',
          state: profileData.state || '',
          complement: profileData.complement || '',
        };
        Object.keys(initialFormValues).forEach((key) => {
          setValue(key as keyof ProfileFormData, initialFormValues[key as keyof ProfileFormData]);
        });
        
        // Initial Check if city is already loaded but not marked
        if (profileData.city && profileData.city.toLowerCase() !== 'curitiba') {
             // We could run logic here, but let's leave it for user action or simpler assumption
        }
      }
      setLoading(false);
    };
    fetchUserAndProfile();
  }, [navigate, setValue]);

  const onAttemptSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    const toastId = showLoading("Salvando perfil...");

    const updatePayload: any = {
      ...data,
      phone: data.phone.replace(/\D/g, ''),
      date_of_birth: format(data.date_of_birth, 'yyyy-MM-dd'),
    };

    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);
    dismissToast(toastId);
    if (error) {
      showError("Erro ao salvar o perfil. Tente novamente.");
    } else {
      showSuccess("Perfil salvo com sucesso!");
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    }
    setIsSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 text-white">
      <Tabs defaultValue={defaultTab} className="max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 h-14 rounded-2xl p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white rounded-xl font-bold uppercase text-xs tracking-widest">Meus Dados</TabsTrigger>
          <TabsTrigger value="reviews" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white rounded-xl font-bold uppercase text-xs tracking-widest">Minhas Avaliações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="mt-8">
          <Card className="bg-white/5 border border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
            <CardHeader className="p-8 md:p-10 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center space-x-4 mb-2">
                <div className="p-3 bg-sky-500/20 rounded-2xl">
                  <User className="h-6 w-6 text-sky-400" />
                </div>
                <div>
                  <CardTitle className="font-black text-3xl tracking-tighter italic uppercase">Meu Perfil.</CardTitle>
                  <CardDescription className="text-slate-400 font-medium">Mantenha seus dados de entrega atualizados.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 md:p-10">
              <form onSubmit={handleSubmit(onAttemptSubmit)} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="first_name" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Nome</Label>
                    <Input id="first_name" {...register('first_name')} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                    {errors.first_name && <p className="text-xs font-bold text-red-400">{errors.first_name.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="last_name" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Sobrenome</Label>
                    <Input id="last_name" {...register('last_name')} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                    {errors.last_name && <p className="text-xs font-bold text-red-400">{errors.last_name.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="date_of_birth" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Data de Nascimento</Label>
                    <Controller name="date_of_birth" control={control} render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />} />
                    {errors.date_of_birth && <p className="text-xs font-bold text-red-400">{errors.date_of_birth.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="phone" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Telefone</Label>
                    <Input id="phone" placeholder="(48) 99999-9999" {...register('phone')} onChange={(e) => e.target.value = maskPhone(e.target.value)} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                    {errors.phone && <p className="text-xs font-bold text-red-400">{errors.phone.message}</p>}
                  </div>
                </div>

                <div className="pt-6">
                  <div className="flex items-center space-x-3 mb-8">
                    <div className="p-2 bg-sky-500/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-sky-400" />
                    </div>
                    <h3 className="font-black text-xl tracking-tighter italic uppercase">Endereço de Entrega.</h3>
                  </div>

                  {deliveryType === 'correios' && (
                    <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/20 text-yellow-200">
                      <Truck className="h-4 w-4" />
                      <AlertTitle className="font-bold uppercase text-xs tracking-wider">Entrega via Correios</AlertTitle>
                      <AlertDescription className="text-xs">
                        Para a região selecionada, os pedidos são enviados via Correios.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-8">
                    <div className="space-y-3">
                      <Label htmlFor="cep" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">CEP</Label>
                      <div className="flex items-center space-x-3">
                        <Input id="cep" {...register('cep')} onChange={(e) => e.target.value = maskCep(e.target.value)} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                        <Button type="button" size="icon" onClick={handleCepLookup} disabled={isFetchingCep} className="bg-sky-500 hover:bg-sky-400 text-white h-12 w-12 rounded-xl shrink-0">
                          {isFetchingCep ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                        </Button>
                      </div>
                      {errors.cep && <p className="text-xs font-bold text-red-400">{errors.cep.message}</p>}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="street" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Rua</Label>
                      <Input id="street" {...register('street')} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                      {errors.street && <p className="text-xs font-bold text-red-400">{errors.street.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-3">
                        <Label htmlFor="number" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Número</Label>
                        <Input id="number" {...register('number')} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                        {errors.number && <p className="text-xs font-bold text-red-400">{errors.number.message}</p>}
                      </div>
                      <div className="md:col-span-2 space-y-3">
                        <Label htmlFor="complement" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Complemento (opcional)</Label>
                        <Input id="complement" {...register('complement')} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="neighborhood" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Bairro</Label>
                      <Input id="neighborhood" {...register('neighborhood')} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                      {errors.neighborhood && <p className="text-xs font-bold text-red-400">{errors.neighborhood.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <Label htmlFor="city" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Cidade</Label>
                        <Input id="city" {...register('city')} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                        {errors.city && <p className="text-xs font-bold text-red-400">{errors.city.message}</p>}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="state" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Estado</Label>
                        <Input id="state" {...register('state')} className="bg-slate-950 border-white/10 h-12 rounded-xl focus:border-sky-500 transition-colors" />
                        {errors.state && <p className="text-xs font-bold text-red-400">{errors.state.message}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-[0.2em] h-16 rounded-2xl shadow-[0_15px_30px_-10px_rgba(14,165,233,0.5)] transition-all active:scale-95" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Salvar Alterações'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-8">
          <Card className="bg-white/5 border border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
            <CardHeader className="p-8 md:p-10 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-yellow-500/20 rounded-2xl">
                  <Star className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <CardTitle className="font-black text-3xl tracking-tighter italic uppercase">Minhas Avaliações.</CardTitle>
                  <CardDescription className="text-slate-400 font-medium">Histórico de produtos que você avaliou.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 md:p-10">
              <UserReviewsTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;