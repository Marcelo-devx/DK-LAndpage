import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Settings, 
  Save, 
  Globe, 
  Home, 
  LogIn, 
  User, 
  LayoutTemplate
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from '@/context/ThemeContext';
import { showSuccess } from '@/utils/toast';

const AdminCustomizer = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const { settings, updateSetting } = useTheme();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (data?.role === 'adm') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };

    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          className="fixed bottom-6 left-6 z-[99999] rounded-full h-14 w-14 bg-slate-900 text-white shadow-2xl border-2 border-white/20 hover:scale-110 transition-transform flex items-center justify-center"
          size="icon"
          title="Personalizar Loja"
        >
          <Settings className="h-6 w-6 animate-spin-slow" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[400px] overflow-y-auto bg-white/95 backdrop-blur-md z-[99999]">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-sky-500" />
            Editor Visual
          </SheetTitle>
          <SheetDescription>
            Personalize cada área da sua loja.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="global" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 h-auto p-1 bg-slate-100 rounded-xl">
            <TabsTrigger value="global" className="flex flex-col py-2 gap-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <Globe className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase">Global</span>
            </TabsTrigger>
            <TabsTrigger value="home" className="flex flex-col py-2 gap-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <Home className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase">Home</span>
            </TabsTrigger>
            <TabsTrigger value="login" className="flex flex-col py-2 gap-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <LogIn className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase">Login</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex flex-col py-2 gap-1 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <User className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase">Painel</span>
            </TabsTrigger>
          </TabsList>

          {/* --- ABA GLOBAL --- */}
          <TabsContent value="global" className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Seção de Cores */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 border-b pb-2">Cores do Tema</h3>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Fundo do Site</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="color" value={settings.backgroundColor} onChange={(e) => updateSetting('site_background_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" />
                    <Input type="text" value={settings.backgroundColor} onChange={(e) => updateSetting('site_background_color', e.target.value)} className="flex-1 font-mono text-xs" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Cor Primária (Destaques)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="color" value={settings.primaryColor} onChange={(e) => updateSetting('site_primary_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" />
                    <Input type="text" value={settings.primaryColor} onChange={(e) => updateSetting('site_primary_color', e.target.value)} className="flex-1 font-mono text-xs" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Cor do Texto</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="color" value={settings.textColor} onChange={(e) => updateSetting('site_text_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" />
                    <Input type="text" value={settings.textColor} onChange={(e) => updateSetting('site_text_color', e.target.value)} className="flex-1 font-mono text-xs" />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção Geral */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 border-b pb-2">Geral</h3>
              
              <div className="space-y-2">
                <Label>Logo (URL)</Label>
                <Input value={settings.logoUrl || ''} onChange={(e) => updateSetting('logo_url', e.target.value)} placeholder="https://..." />
              </div>

              <div className="space-y-2">
                <Label>Barra de Anúncio (Topo)</Label>
                <Input value={settings.headerAnnouncement} onChange={(e) => updateSetting('header_announcement_text', e.target.value)} placeholder="Ex: Frete Grátis" />
              </div>
            </div>

            {/* Seção Rodapé */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 border-b pb-2">Rodapé & Contato</h3>
              
              <div className="grid grid-cols-1 gap-3">
                <div><Label className="text-xs">Email</Label><Input value={settings.contactEmail} onChange={(e) => updateSetting('contact_email', e.target.value)} /></div>
                <div><Label className="text-xs">Telefone</Label><Input value={settings.contactPhone} onChange={(e) => updateSetting('contact_phone', e.target.value)} /></div>
                <div><Label className="text-xs">Horário</Label><Input value={settings.contactHours} onChange={(e) => updateSetting('contact_hours', e.target.value)} /></div>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-xs">Links Sociais</Label>
                <Input placeholder="Facebook" value={settings.socialFacebook} onChange={(e) => updateSetting('social_facebook', e.target.value)} className="mb-2" />
                <Input placeholder="Instagram" value={settings.socialInstagram} onChange={(e) => updateSetting('social_instagram', e.target.value)} className="mb-2" />
                <Input placeholder="Twitter/X" value={settings.socialTwitter} onChange={(e) => updateSetting('social_twitter', e.target.value)} />
              </div>

              <div className="space-y-3 pt-2 bg-slate-50 p-3 rounded-lg border">
                <Label className="text-sky-600 font-bold">Banner Final (Chamada p/ Ação)</Label>
                <Input value={settings.footerBannerTitle} onChange={(e) => updateSetting('footer_banner_title', e.target.value)} placeholder="Título" />
                <Textarea value={settings.footerBannerSubtitle} onChange={(e) => updateSetting('footer_banner_subtitle', e.target.value)} placeholder="Subtítulo" rows={2} />
                <Input value={settings.footerBannerButtonText} onChange={(e) => updateSetting('footer_banner_button_text', e.target.value)} placeholder="Texto do Botão" />
              </div>
            </div>
          </TabsContent>

          {/* --- ABA HOME --- */}
          <TabsContent value="home" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 border-b pb-2">Visibilidade das Seções</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                <div className="space-y-0.5">
                  <Label htmlFor="hero-toggle" className="text-base font-bold cursor-pointer">Banner Principal</Label>
                  <p className="text-xs text-slate-500">O carrossel grande no topo.</p>
                </div>
                <Switch id="hero-toggle" checked={settings.showHero} onCheckedChange={(checked) => updateSetting('show_hero_banner', String(checked))} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                <div className="space-y-0.5">
                  <Label htmlFor="info-toggle" className="text-base font-bold cursor-pointer">Faixa Informativa</Label>
                  <p className="text-xs text-slate-500">Ícones de frete, pagamento, etc.</p>
                </div>
                <Switch id="info-toggle" checked={settings.showInfo} onCheckedChange={(checked) => updateSetting('show_info_section', String(checked))} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                <div className="space-y-0.5">
                  <Label htmlFor="brands-toggle" className="text-base font-bold cursor-pointer">Carrossel de Marcas</Label>
                  <p className="text-xs text-slate-500">Logotipos das marcas parceiras.</p>
                </div>
                <Switch id="brands-toggle" checked={settings.showBrands} onCheckedChange={(checked) => updateSetting('show_brands', String(checked))} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                <div className="space-y-0.5">
                  <Label htmlFor="promo-toggle" className="text-base font-bold cursor-pointer">Seção de Promoções</Label>
                  <p className="text-xs text-slate-500">Destaques de ofertas exclusivas.</p>
                </div>
                <Switch id="promo-toggle" checked={settings.showPromotions} onCheckedChange={(checked) => updateSetting('show_promotions', String(checked))} />
              </div>
            </div>
          </TabsContent>

          {/* --- ABA LOGIN --- */}
          <TabsContent value="login" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 border-b pb-2">Tela de Login</h3>
            
            <div className="space-y-4 p-4 border rounded-2xl bg-slate-50">
              <div className="space-y-2">
                <Label>Título Principal</Label>
                <Input value={settings.loginTitle} onChange={(e) => updateSetting('login_title', e.target.value)} placeholder="DKCWB" className="font-bold text-lg" />
                <p className="text-xs text-slate-500">Geralmente o nome da marca.</p>
              </div>
              <div className="space-y-2">
                <Label>Subtítulo</Label>
                <Input value={settings.loginSubtitle} onChange={(e) => updateSetting('login_subtitle', e.target.value)} placeholder="Acesso Exclusivo" />
                <p className="text-xs text-slate-500">Uma frase curta abaixo do título.</p>
              </div>
            </div>
          </TabsContent>

          {/* --- ABA PAINEL (DASHBOARD) --- */}
          <TabsContent value="dashboard" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 border-b pb-2">Minha Conta (Cliente)</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Saudação</Label>
                  <Input value={settings.dashboardGreeting} onChange={(e) => updateSetting('dashboard_greeting', e.target.value)} placeholder="Olá" />
                </div>
                <div className="space-y-2">
                  <Label>Rótulo dos Pontos</Label>
                  <Input value={settings.dashboardPointsLabel} onChange={(e) => updateSetting('dashboard_points_label', e.target.value)} placeholder="Saldo" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mensagem de Boas-vindas</Label>
                <Input value={settings.dashboardSubtitle} onChange={(e) => updateSetting('dashboard_subtitle', e.target.value)} placeholder="Bem-vindo..." />
              </div>

              <div className="space-y-2">
                <Label>Texto do Botão de Ação</Label>
                <Input value={settings.dashboardButtonText} onChange={(e) => updateSetting('dashboard_button_text', e.target.value)} placeholder="Resgatar Cupons" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 pt-6 border-t pb-8 sticky bottom-0 bg-white/95 backdrop-blur-sm p-4 -mx-6 px-6">
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 rounded-xl shadow-lg transition-all active:scale-95" onClick={() => showSuccess('Todas as alterações foram salvas!')}>
                <Save className="mr-2 h-5 w-5" /> Salvar Alterações
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminCustomizer;