import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Settings, 
  Save, 
  Globe, 
  Home, 
  LogIn, 
  User, 
  LayoutTemplate,
  Layers,
  Palette,
  Link as LinkIcon,
  Network,
  Webhook
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
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

const AdminCustomizer = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const { settings, updateSetting } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("global");

  // Estado para Webhooks
  const [webhooks, setWebhooks] = useState({
    order_created: '',
    order_updated: '',
    customer_created: ''
  });
  const webhookTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

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
        // Carregar Webhooks apenas se for admin
        fetchWebhooks();
      } else {
        setIsAdmin(false);
      }
    };

    const fetchWebhooks = async () => {
      const { data } = await supabase.from('webhook_configs').select('trigger_event, target_url');
      if (data) {
        const currentHooks = {
          order_created: '',
          order_updated: '',
          customer_created: ''
        };
        data.forEach(config => {
          if (config.trigger_event === 'order_created') currentHooks.order_created = config.target_url;
          if (config.trigger_event === 'order_updated') currentHooks.order_updated = config.target_url;
          if (config.trigger_event === 'customer_created') currentHooks.customer_created = config.target_url;
        });
        setWebhooks(currentHooks);
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

  const updateWebhook = (event: string, url: string) => {
    // Atualização Otimista
    setWebhooks(prev => ({ ...prev, [event]: url }));

    // Debounce para salvar no banco
    if (webhookTimeouts.current[event]) clearTimeout(webhookTimeouts.current[event]);
    
    webhookTimeouts.current[event] = setTimeout(async () => {
      // Se a URL estiver vazia, desativamos o webhook. Se tiver algo, ativamos.
      const isActive = url.trim().length > 0;
      
      // Primeiro tenta atualizar se já existir
      const { error, count } = await supabase
        .from('webhook_configs')
        .update({ target_url: url, is_active: isActive })
        .eq('trigger_event', event)
        .select(); // Select para ver se atualizou algo

      // Se não atualizou nada (não existia), insere
      if (!error && (count === null || count === 0)) {
         await supabase.from('webhook_configs').insert({
            trigger_event: event,
            target_url: url,
            is_active: isActive,
            description: `Webhook para ${event}`
         });
      }

      if (error) {
        console.error('Erro ao salvar webhook:', error);
        showError('Erro ao salvar configuração de integração.');
      }
    }, 1000); // 1 segundo de espera após parar de digitar
  };

  // Sincroniza a aba com a rota atual se o usuário navegar manualmente
  useEffect(() => {
    const path = location.pathname;
    if (path === '/') setActiveTab('home');
    else if (path === '/login') setActiveTab('login');
    else if (path === '/dashboard' || path === '/perfil') setActiveTab('dashboard');
  }, [location.pathname]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Navegação automática
    switch (value) {
      case 'home':
        if (location.pathname !== '/') navigate('/');
        break;
      case 'login':
        if (location.pathname !== '/login') navigate('/login');
        break;
      case 'dashboard':
        if (location.pathname !== '/dashboard') navigate('/dashboard');
        break;
    }
  };

  if (!isAdmin) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          className="fixed bottom-6 left-6 z-[99999] rounded-full h-14 w-14 bg-slate-900 text-white shadow-2xl border-2 border-white/20 hover:scale-110 transition-transform flex items-center justify-center group"
          size="icon"
          title="Personalizar Loja"
        >
          <Settings className="h-6 w-6 animate-spin-slow group-hover:text-sky-400 transition-colors" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[400px] p-0 gap-0 overflow-hidden bg-white/95 backdrop-blur-md z-[99999] flex flex-col">
        
        {/* Cabeçalho Fixo */}
        <div className="p-6 border-b border-slate-100 bg-white/50">
          <SheetHeader>
            <SheetTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2 text-slate-900">
              <div className="p-2 bg-slate-900 rounded-lg">
                <LayoutTemplate className="h-5 w-5 text-sky-400" />
              </div>
              Editor Visual
            </SheetTitle>
            <SheetDescription className="text-xs font-medium text-slate-500">
              Selecione uma camada para editar e visualizar em tempo real.
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col h-full">
            
            {/* Menu de Navegação Horizontal Estilo "Chips/Camadas" */}
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 overflow-x-auto no-scrollbar">
              <TabsList className="bg-transparent p-0 gap-2 h-auto flex w-max">
                <TabsTrigger 
                  value="global" 
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-slate-900 data-[state=active]:shadow-lg hover:bg-white hover:border-slate-300 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" /> Global
                </TabsTrigger>
                <TabsTrigger 
                  value="integrations" 
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-purple-600 data-[state=active]:shadow-lg hover:bg-white hover:border-purple-200 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"
                  )}
                >
                  <Network className="h-3.5 w-3.5" /> Integrações
                </TabsTrigger>
                <TabsTrigger 
                  value="home" 
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:border-sky-500 data-[state=active]:shadow-lg hover:bg-white hover:border-sky-200 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"
                  )}
                >
                  <Home className="h-3.5 w-3.5" /> Home
                </TabsTrigger>
                <TabsTrigger 
                  value="login" 
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:border-indigo-500 data-[state=active]:shadow-lg hover:bg-white hover:border-indigo-200 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"
                  )}
                >
                  <LogIn className="h-3.5 w-3.5" /> Login
                </TabsTrigger>
                <TabsTrigger 
                  value="dashboard" 
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:border-emerald-500 data-[state=active]:shadow-lg hover:bg-white hover:border-emerald-200 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"
                  )}
                >
                  <User className="h-3.5 w-3.5" /> Conta
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Conteúdo das Abas com Scroll */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
              
              {/* --- GLOBAL --- */}
              <TabsContent value="global" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Palette className="h-4 w-4" />
                    <h3 className="font-bold text-xs uppercase tracking-widest">Identidade Visual</h3>
                  </div>
                  
                  <div className="grid gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <Label className="text-xs text-slate-500 mb-1.5 block">Cor de Fundo</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={settings.backgroundColor} onChange={(e) => updateSetting('site_background_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" />
                        <Input type="text" value={settings.backgroundColor} onChange={(e) => updateSetting('site_background_color', e.target.value)} className="flex-1 font-mono text-xs bg-slate-50" />
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <Label className="text-xs text-slate-500 mb-1.5 block">Cor de Destaque</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={settings.primaryColor} onChange={(e) => updateSetting('site_primary_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" />
                        <Input type="text" value={settings.primaryColor} onChange={(e) => updateSetting('site_primary_color', e.target.value)} className="flex-1 font-mono text-xs bg-slate-50" />
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <Label className="text-xs text-slate-500 mb-1.5 block">Cor do Texto</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={settings.textColor} onChange={(e) => updateSetting('site_text_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" />
                        <Input type="text" value={settings.textColor} onChange={(e) => updateSetting('site_text_color', e.target.value)} className="flex-1 font-mono text-xs bg-slate-50" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Globe className="h-4 w-4" />
                    <h3 className="font-bold text-xs uppercase tracking-widest">Informações Gerais</h3>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">URL do Logo</Label>
                      <Input value={settings.logoUrl || ''} onChange={(e) => updateSetting('logo_url', e.target.value)} placeholder="https://..." className="bg-slate-50" />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Barra de Topo (Anúncio)</Label>
                      <Input value={settings.headerAnnouncement} onChange={(e) => updateSetting('header_announcement_text', e.target.value)} placeholder="Ex: Frete Grátis..." className="bg-slate-50" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <LinkIcon className="h-4 w-4" />
                    <h3 className="font-bold text-xs uppercase tracking-widest">Rodapé e Contato</h3>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-[10px] text-slate-400 uppercase">Email</Label><Input className="h-9 text-xs" value={settings.contactEmail} onChange={(e) => updateSetting('contact_email', e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[10px] text-slate-400 uppercase">WhatsApp</Label><Input className="h-9 text-xs" value={settings.contactPhone} onChange={(e) => updateSetting('contact_phone', e.target.value)} /></div>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px] text-slate-400 uppercase">Horário</Label><Input className="h-9 text-xs" value={settings.contactHours} onChange={(e) => updateSetting('contact_hours', e.target.value)} /></div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                    <Label className="text-xs font-bold">Banner Final (Call to Action)</Label>
                    <Input value={settings.footerBannerTitle} onChange={(e) => updateSetting('footer_banner_title', e.target.value)} placeholder="Título" className="font-bold" />
                    <Textarea value={settings.footerBannerSubtitle} onChange={(e) => updateSetting('footer_banner_subtitle', e.target.value)} placeholder="Subtítulo" rows={2} className="text-xs" />
                    <Input value={settings.footerBannerButtonText} onChange={(e) => updateSetting('footer_banner_button_text', e.target.value)} placeholder="Texto do Botão" />
                  </div>
                </div>
              </TabsContent>

              {/* --- INTEGRAÇÕES --- */}
              <TabsContent value="integrations" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-purple-500/10 p-2 rounded-lg">
                            <Webhook className="h-5 w-5 text-purple-600" />
                        </div>
                        <h3 className="font-bold text-purple-900 text-sm">Configuração N8N</h3>
                    </div>
                    <p className="text-xs text-purple-700 leading-relaxed">
                        Cole aqui os links dos seus Webhooks do N8N. O sistema enviará os dados automaticamente sempre que um evento ocorrer.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">Novo Pedido</Label>
                            <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded", webhooks.order_created ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400")}>
                                {webhooks.order_created ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                        <Input 
                            value={webhooks.order_created} 
                            onChange={(e) => updateWebhook('order_created', e.target.value)} 
                            placeholder="https://seu-n8n.com/webhook/..." 
                            className="bg-slate-50 font-mono text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Disparado assim que um novo pedido é criado no site.</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">Atualização de Pedido</Label>
                            <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded", webhooks.order_updated ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400")}>
                                {webhooks.order_updated ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                        <Input 
                            value={webhooks.order_updated} 
                            onChange={(e) => updateWebhook('order_updated', e.target.value)} 
                            placeholder="https://seu-n8n.com/webhook/..." 
                            className="bg-slate-50 font-mono text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Disparado quando o status muda (ex: de Pendente para Pago).</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">Novo Cliente</Label>
                            <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded", webhooks.customer_created ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400")}>
                                {webhooks.customer_created ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                        <Input 
                            value={webhooks.customer_created} 
                            onChange={(e) => updateWebhook('customer_created', e.target.value)} 
                            placeholder="https://seu-n8n.com/webhook/..." 
                            className="bg-slate-50 font-mono text-xs"
                        />
                        <p className="text-[10px] text-slate-400">Disparado quando um novo usuário completa o cadastro.</p>
                    </div>
                </div>
              </TabsContent>

              {/* --- HOME --- */}
              <TabsContent value="home" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Layers className="h-4 w-4" />
                  <h3 className="font-bold text-xs uppercase tracking-widest">Seções da Página</h3>
                </div>

                <div className="space-y-3">
                  {[
                    { id: 'hero', label: 'Banner Principal', sub: 'Carrossel grande no topo', key: 'show_hero_banner', checked: settings.showHero },
                    { id: 'info', label: 'Faixa Informativa', sub: 'Ícones de frete e pagamento', key: 'show_info_section', checked: settings.showInfo },
                    { id: 'brands', label: 'Carrossel de Marcas', sub: 'Logos dos parceiros', key: 'show_brands', checked: settings.showBrands },
                    { id: 'promo', label: 'Promoções', sub: 'Destaques de ofertas', key: 'show_promotions', checked: settings.showPromotions },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-white shadow-sm hover:border-sky-200 transition-colors">
                      <div className="space-y-0.5">
                        <Label htmlFor={`${item.id}-toggle`} className="text-sm font-bold cursor-pointer text-slate-800">{item.label}</Label>
                        <p className="text-[10px] text-slate-500 font-medium">{item.sub}</p>
                      </div>
                      <Switch 
                        id={`${item.id}-toggle`} 
                        checked={item.checked}
                        onCheckedChange={(checked) => updateSetting(item.key, String(checked))}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* --- LOGIN --- */}
              <TabsContent value="login" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Título Principal</Label>
                    <Input 
                      value={settings.loginTitle} 
                      onChange={(e) => updateSetting('login_title', e.target.value)}
                      placeholder="Nome da Marca" 
                      className="font-black text-lg h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subtítulo</Label>
                    <Input 
                      value={settings.loginSubtitle} 
                      onChange={(e) => updateSetting('login_subtitle', e.target.value)}
                      placeholder="Frase de efeito"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* --- DASHBOARD --- */}
              <TabsContent value="dashboard" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saudação</Label>
                      <Input value={settings.dashboardGreeting} onChange={(e) => updateSetting('dashboard_greeting', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rótulo Pontos</Label>
                      <Input value={settings.dashboardPointsLabel} onChange={(e) => updateSetting('dashboard_points_label', e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mensagem de Boas-vindas</Label>
                    <Input value={settings.dashboardSubtitle} onChange={(e) => updateSetting('dashboard_subtitle', e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Botão Principal</Label>
                    <div className="flex gap-2">
                      <Input value={settings.dashboardButtonText} onChange={(e) => updateSetting('dashboard_button_text', e.target.value)} className="font-bold text-sky-600" />
                      <div className="bg-sky-500 text-white rounded-md px-3 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">Preview</div>
                    </div>
                  </div>
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>

        {/* Rodapé Fixo com Botão Salvar */}
        <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md">
            <Button className="w-full bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl shadow-lg transition-all active:scale-95 group" onClick={() => showSuccess('Todas as alterações foram salvas!')}>
                <Save className="mr-2 h-4 w-4 group-hover:text-green-400 transition-colors" /> Salvar Alterações
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminCustomizer;