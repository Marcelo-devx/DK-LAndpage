import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Settings, 
  Save, 
  Globe, 
  Home, 
  LogIn, 
  LayoutTemplate,
  Network,
  Webhook,
  Activity,
  CheckCircle2,
  XCircle,
  Copy,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Zap,
  Trash2,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';

// Mapeamento explícito para evitar erros de regex
const settingKeysMap: Record<string, string> = {
  'show_hero_banner': 'showHero',
  'show_info_section': 'showInfo',
  'show_brands': 'showBrands',
  'show_promotions': 'showPromotions'
};

const AdminCustomizer = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const { settings, updateSetting } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("global");
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isSimulating, setIsSimulating] = useState<string | null>(null);

  // NOVO: Estado para gerenciar categorias
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Constantes de URL (Projeto)
  const PROJECT_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";

  // Configuração dos Webhooks a serem exibidos
  const webhookDefinitions = [
    { key: 'order_created', label: 'Pedido Criado', color: 'text-green-600 bg-green-50 border-green-200' },
    { key: 'order_updated', label: 'Pedido Atualizado', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { key: 'customer_created', label: 'Novo Cliente', color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { key: 'chat_message_sent', label: 'Mensagem de Chat', color: 'text-pink-600 bg-pink-50 border-pink-200' },
    { key: 'support_contact_clicked', label: 'Botão WhatsApp', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { key: 'product_updated', label: 'Produto Alterado', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  ];

  // Estado Dinâmico para Webhooks
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const webhookTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);

  // Função para buscar webhooks (pode ser chamada manualmente)
  const fetchWebhooks = async () => {
    setLoadingWebhooks(true);
    try {
      const { data, error } = await supabase.from('webhook_configs').select('trigger_event, target_url');
      if (!error && data) {
        const currentHooks: Record<string, string> = {};
        data.forEach((config: any) => {
          currentHooks[config.trigger_event] = config.target_url;
        });
        setWebhooks(currentHooks);
        setLastFetched(Date.now());
      } else if (error) {
        console.error('Erro ao carregar webhooks:', error);
      }
    } catch (e) {
      console.error('Erro ao buscar webhooks:', e);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }

      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (data?.role === 'adm') {
        setIsAdmin(true);
        fetchWebhooks();
        fetchCategories(); // NOVO: Carregar categorias
      } else {
        setIsAdmin(false);
      }
    };

    // NOVO: Função para buscar categorias
    const fetchCategories = async () => {
      setLoadingCategories(true);
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (data) {
        setCategories(data);
      }
      setLoadingCategories(false);
    };

    checkAdmin();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => checkAdmin());
    return () => subscription.unsubscribe();
  }, []);

  const updateWebhook = (event: string, url: string) => {
    setWebhooks(prev => ({ ...prev, [event]: url }));

    if (webhookTimeouts.current[event]) clearTimeout(webhookTimeouts.current[event]);
    
    webhookTimeouts.current[event] = setTimeout(async () => {
      const isActive = url.trim().length > 0;
      
      const { error, count } = await supabase
        .from('webhook_configs')
        .update({ target_url: url, is_active: isActive })
        .eq('trigger_event', event)
        .select();

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
        showError('Erro ao salvar configuração.');
      }
    }, 1000);
  };

  // NOVO: Função para atualizar restrição de idade da categoria
  const updateCategoryAgeRestriction = async (categoryId: number, value: boolean) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, show_age_restriction: value } : cat
    ));
    
    const { error } = await supabase
      .from('categories')
      .update({ show_age_restriction: value })
      .eq('id', categoryId);
    
    if (error) {
      console.error('Erro ao atualizar categoria:', error);
      showError('Erro ao salvar categoria');
      // Reverter em caso de erro
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, show_age_restriction: !value } : cat
      ));
    } else {
      showSuccess('Categoria atualizada!');
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('loading');
    try {
      const response = await fetch("https://n8n-ws.dkcwb.cloud/webhook/testar-conexão", {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) { setTestStatus('success'); showSuccess("Conexão OK!"); } 
      else { setTestStatus('error'); showError("Erro no N8N."); }
    } catch { setTestStatus('error'); showError("Sem conexão."); } 
    finally { setTimeout(() => setTestStatus('idle'), 3000); }
  };

  const handleSimulateWebhook = async (eventType: string) => {
    if (!webhooks[eventType]) { showError("Configure uma URL primeiro."); return; }
    
    setIsSimulating(eventType);
    const toastId = showLoading(`Testando ${eventType}...`);

    try {
      const { data, error } = await supabase.functions.invoke('trigger-integration', {
        body: { event_type: eventType, simulate: true }
      });

      dismissToast(toastId);
      if (error) throw error;
      
      if (data?.success) showSuccess("Teste enviado com sucesso!");
      else showError(data?.error || "Erro no teste.");
    } catch (error: any) {
      // Melhor logging para debugar falhas de Edge Function
      console.error('[AdminCustomizer] trigger-integration invoke error:', error);
      // Tenta capturar detalhes retornados pelo supabase error object
      const detailed = error?.message || (error && typeof error === 'object' ? JSON.stringify(error) : String(error));

      // Fallback diagnóstico: tentar chamar a URL direta da Edge Function (apenas para debug no console)
      try {
        const debugResp = await fetch(`${PROJECT_URL}/functions/v1/trigger-integration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: eventType, simulate: true })
        });
        if (!debugResp.ok) {
          console.warn('[AdminCustomizer] direct function fetch response not ok:', debugResp.status, debugResp.statusText);
        } else {
          console.info('[AdminCustomizer] direct function fetch succeeded (for debug).');
        }
      } catch (fetchErr) {
        console.error('[AdminCustomizer] direct function fetch error (CORS/network):', fetchErr);
      }

      dismissToast(toastId);
      showError(detailed || "Falha na simulação. Verifique o console para mais detalhes.");
    } finally {
      setIsSimulating(null);
    }
  };

  const copyToClipboard = (text: string, msg = "Copiado!") => {
    navigator.clipboard.writeText(text);
    showSuccess(msg);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    switch (value) {
      case 'home': if (location.pathname !== '/') navigate('/'); break;
      case 'login': if (location.pathname !== '/login') navigate('/login'); break;
      case 'dashboard': if (location.pathname !== '/dashboard') navigate('/dashboard'); break;
    }
  };

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') setActiveTab('home');
    else if (path === '/login') setActiveTab('login');
    else if (path === '/dashboard' || path === '/perfil') setActiveTab('dashboard');
  }, [location.pathname]);

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
      <SheetContent side="left" className="w-[450px] p-0 gap-0 overflow-hidden bg-white/95 backdrop-blur-md z-[99999] flex flex-col">
        
        <div className="p-6 border-b border-slate-100 bg-white/50">
          <SheetHeader>
            <SheetTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2 text-slate-900">
              <div className="p-2 bg-slate-900 rounded-lg">
                <LayoutTemplate className="h-5 w-5 text-sky-400" />
              </div>
              Gestão DKCWB
            </SheetTitle>
            <SheetDescription className="text-xs font-medium text-slate-500">
              Painel de controle e integrações.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col h-full">
            
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 overflow-x-auto no-scrollbar">
              <TabsList className="bg-transparent p-0 gap-2 h-auto flex w-max">
                <TabsTrigger value="global" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Globe className="h-3.5 w-3.5" /> Global</TabsTrigger>
                <TabsTrigger value="integrations" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-purple-600 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Network className="h-3.5 w-3.5" /> Webhooks</TabsTrigger>
                <TabsTrigger value="categories" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <Package className="h-3.5 w-3.5" /> Categorias
                </TabsTrigger>
                <TabsTrigger value="home" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-sky-500 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Home className="h-3.5 w-3.5" /> Home</TabsTrigger>
                <TabsTrigger value="login" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-indigo-500 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><LogIn className="h-3.5 w-3.5" /> Login</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
              
              {/* --- NOVA ABA CATEGORIAS --- */}
              <TabsContent value="categories" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Package className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-emerald-900 text-sm">Restrição de Idade por Categoria</h3>
                  </div>
                  <p className="text-xs text-emerald-700 font-medium">
                    Ative ou desative a tarja "+18" para cada categoria. Produtos de categorias desativadas não mostrarão a faixa de restrição.
                  </p>
                </div>

                {loadingCategories ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div key={category.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-emerald-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {category.image_url && (
                              <img 
                                src={category.image_url} 
                                alt={category.name} 
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            )}
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{category.name}</h4>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                                {category.show_age_restriction ? 'Mostrar +18' : 'Ocultar +18'}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={category.show_age_restriction !== false}
                            onCheckedChange={(checked) => updateCategoryAgeRestriction(category.id, checked)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* --- ABA INTEGRAÇÕES (WEBHOOKS) --- */}
              <TabsContent value="integrations" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-500/10 p-2 rounded-lg"><Webhook className="h-5 w-5 text-purple-600" /></div>
                            <h3 className="font-bold text-purple-900 text-sm">Conexão N8N</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {testStatus === 'success' && <div className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-100 px-2 py-1 rounded-md uppercase tracking-wider"><CheckCircle2 className="h-3 w-3" /> Online</div>}
                          {testStatus === 'error' && <div className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-md uppercase tracking-wider"><XCircle className="h-3 w-3" /> Erro</div>}
                          <Button size="sm" variant="ghost" className="ml-2 text-[10px]" onClick={fetchWebhooks} disabled={loadingWebhooks} title="Atualizar configurações">
                            {loadingWebhooks ? <Loader2 className="h-3 w-3 animate-spin text-purple-600" /> : 'Atualizar'}
                          </Button>
                        </div>
                    </div>
                    
                    <Button 
                        onClick={handleTestConnection} 
                        disabled={testStatus === 'loading'}
                        variant="outline" 
                        className="w-full mt-4 border-purple-200 text-purple-700 hover:bg-white h-8 text-[10px] font-bold uppercase tracking-wider"
                    >
                        {testStatus === 'loading' ? 'Testando...' : 'Testar Ping'} <Activity className="ml-2 h-3 w-3" />
                    </Button>
                    {lastFetched && (
                      <p className="text-[10px] text-slate-500 mt-2">Última sincronização: {new Date(lastFetched).toLocaleString()}</p>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <ArrowUpCircle className="h-4 w-4 text-sky-500" />
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Eventos de Saída (Outbound)</h3>
                    </div>
                    
                    {/* Lista Dinâmica de Webhooks */}
                    <div className="grid gap-3">
                        {webhookDefinitions.map((hook) => (
                            <div key={hook.key} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-slate-300">
                                <div className="flex items-center justify-between mb-3">
                                    <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border", hook.color)}>
                                        {hook.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            size="icon" 
                                            variant="ghost"
                                            className="h-6 w-6 text-slate-300 hover:text-red-500"
                                            onClick={() => updateWebhook(hook.key, '')}
                                            title="Limpar URL"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                            size="sm"
                                            variant="secondary"
                                            className="h-6 w-8 bg-slate-100 hover:bg-orange-100 text-orange-600 p-0"
                                            onClick={() => handleSimulateWebhook(hook.key)}
                                            disabled={!webhooks[hook.key] || isSimulating === hook.key}
                                            title="Testar Disparo"
                                        >
                                            {isSimulating === hook.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3.5 w-3.5 fill-current" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <Input 
                                        value={webhooks[hook.key] || ''} 
                                        onChange={(e) => updateWebhook(hook.key, e.target.value)} 
                                        placeholder={`https://n8n.../${hook.key}`} 
                                        className="bg-slate-50 font-mono text-[10px] h-9 pr-2 text-slate-600 focus:bg-white transition-colors"
                                    />
                                    {webhooks[hook.key] && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Ativo" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <ArrowDownCircle className="h-4 w-4 text-orange-500" />
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">APIs de Entrada (Inbound)</h3>
                    </div>
                    
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-white">Atualizar Pedido (PIX/Status)</Label>
                            <Badge className="text-[9px] bg-orange-500 border-none">POST</Badge>
                        </div>
                        <div className="flex gap-2">
                            <Input readOnly value={`${PROJECT_URL}/functions/v1/update-order-status`} className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-[10px] h-8" />
                            <Button size="icon" className="h-8 w-8 bg-slate-700 hover:bg-slate-600 shrink-0" onClick={() => copyToClipboard(`${PROJECT_URL}/functions/v1/update-order-status`)}>
                                <Copy className="h-3.5 w-3.5 text-white" />
                            </Button>
                        </div>
                        <div className="mt-3 bg-black/50 p-3 rounded-lg border border-white/5">
                            <pre className="text-[9px] text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
{`{
  "order_id": 123,
  "status": "Finalizada", 
  "delivery_status": "Em Trânsito"
}`}
                            </pre>
                        </div>
                    </div>
                </div>
              </TabsContent>

              {/* --- OUTRAS ABAS --- */}
              <TabsContent value="global" className="space-y-6 mt-0">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    <div><Label className="text-xs text-slate-500 mb-1">Cor de Fundo</Label><div className="flex gap-2"><Input type="color" value={settings.backgroundColor} onChange={(e) => updateSetting('site_background_color', e.target.value)} className="w-10 h-10 p-1" /><Input value={settings.backgroundColor} onChange={(e) => updateSetting('site_background_color', e.target.value)} className="flex-1 text-xs" /></div></div>
                    <div><Label className="text-xs text-slate-500 mb-1">Cor de Destaque</Label><div className="flex gap-2"><Input type="color" value={settings.primaryColor} onChange={(e) => updateSetting('site_primary_color', e.target.value)} className="w-10 h-10 p-1" /><Input value={settings.primaryColor} onChange={(e) => updateSetting('site_primary_color', e.target.value)} className="flex-1 text-xs" /></div></div>
                </div>
              </TabsContent>

              <TabsContent value="home" className="space-y-4 mt-0">
                 <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <Label className="text-xs font-bold text-slate-700 mb-4 block">Seções da Home</Label>
                    <div className="space-y-3">
                        {['show_hero_banner', 'show_info_section', 'show_brands', 'show_promotions'].map(key => {
                            // Uso do mapeamento seguro
                            const settingKey = settingKeysMap[key];
                            return (
                                <div key={key} className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500 uppercase tracking-wide">{key.replace('show_', '').replace('_', ' ')}</span>
                                    <Switch 
                                        // @ts-ignore
                                        checked={settingKey ? settings[settingKey] : false} 
                                        onCheckedChange={(c) => updateSetting(key, String(c))} 
                                    />
                                </div>
                            );
                        })}
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="login" className="space-y-4 mt-0">
                 <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3">
                    <div><Label className="text-xs">Título</Label><Input value={settings.loginTitle} onChange={(e) => updateSetting('login_title', e.target.value)} /></div>
                    <div><Label className="text-xs">Subtítulo</Label><Input value={settings.loginSubtitle} onChange={(e) => updateSetting('login_subtitle', e.target.value)} /></div>
                 </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md">
            <Button className="w-full bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl shadow-lg transition-all active:scale-95 group" onClick={() => showSuccess('Salvo!')}>
                <Save className="mr-2 h-4 w-4 group-hover:text-green-400 transition-colors" /> Salvar Alterações
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminCustomizer;