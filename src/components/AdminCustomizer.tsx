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
  Palette,
  Network,
  Webhook,
  Activity,
  CheckCircle2,
  XCircle,
  Copy,
  ArrowDownCircle,
  ArrowUpCircle,
  FileJson,
  Truck,
  CreditCard
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
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

const AdminCustomizer = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const { settings, updateSetting } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("global");
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Constantes de URL (Projeto)
  const PROJECT_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";

  // Estado para Webhooks
  const [webhooks, setWebhooks] = useState({
    order_created: '',
    order_updated: '',
    customer_created: '',
    chat_message_sent: ''
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
          customer_created: '',
          chat_message_sent: ''
        };
        data.forEach(config => {
          if (config.trigger_event === 'order_created') currentHooks.order_created = config.target_url;
          if (config.trigger_event === 'order_updated') currentHooks.order_updated = config.target_url;
          if (config.trigger_event === 'customer_created') currentHooks.customer_created = config.target_url;
          if (config.trigger_event === 'chat_message_sent') currentHooks.chat_message_sent = config.target_url;
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
    setWebhooks(prev => ({ ...prev, [event as keyof typeof prev]: url }));

    // Debounce para salvar no banco
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
        showError('Erro ao salvar configuração de integração.');
      }
    }, 1000);
  };

  const handleTestConnection = async () => {
    setTestStatus('loading');
    try {
      // Fazendo a requisição GET para a URL de teste fornecida
      const response = await fetch("https://n8n-ws.dkcwb.cloud/webhook/testar-conexão", {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok && (data.status_code === 200 || data.mensagem)) {
        setTestStatus('success');
        showSuccess(data.mensagem || "Conexão estabelecida com sucesso!");
      } else {
        setTestStatus('error');
        showError("O N8N respondeu, mas com erro.");
      }
    } catch (error) {
      console.error("Erro no teste de conexão:", error);
      setTestStatus('error');
      showError("Não foi possível conectar ao N8N. Verifique se o serviço está online.");
    } finally {
      setTimeout(() => setTestStatus('idle'), 3000);
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

  // Sincroniza a aba com a rota atual
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
      <SheetContent side="left" className="w-[400px] p-0 gap-0 overflow-hidden bg-white/95 backdrop-blur-md z-[99999] flex flex-col">
        
        <div className="p-6 border-b border-slate-100 bg-white/50">
          <SheetHeader>
            <SheetTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2 text-slate-900">
              <div className="p-2 bg-slate-900 rounded-lg">
                <LayoutTemplate className="h-5 w-5 text-sky-400" />
              </div>
              Gestão DKCWB
            </SheetTitle>
            <SheetDescription className="text-xs font-medium text-slate-500">
              Controle de integrações e aparência da loja.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col h-full">
            
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 overflow-x-auto no-scrollbar">
              <TabsList className="bg-transparent p-0 gap-2 h-auto flex w-max">
                <TabsTrigger value="global" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-slate-900 data-[state=active]:shadow-lg hover:bg-white hover:border-slate-300 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Globe className="h-3.5 w-3.5" /> Global</TabsTrigger>
                <TabsTrigger value="integrations" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:border-purple-600 data-[state=active]:shadow-lg hover:bg-white hover:border-purple-200 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Network className="h-3.5 w-3.5" /> API & N8N</TabsTrigger>
                <TabsTrigger value="home" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:border-sky-500 data-[state=active]:shadow-lg hover:bg-white hover:border-sky-200 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Home className="h-3.5 w-3.5" /> Home</TabsTrigger>
                <TabsTrigger value="login" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:border-indigo-500 data-[state=active]:shadow-lg hover:bg-white hover:border-indigo-200 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><LogIn className="h-3.5 w-3.5" /> Login</TabsTrigger>
                <TabsTrigger value="dashboard" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:border-emerald-500 data-[state=active]:shadow-lg hover:bg-white hover:border-emerald-200 bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><User className="h-3.5 w-3.5" /> Conta</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
              
              <TabsContent value="global" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Global Content */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-2"><Palette className="h-4 w-4" /><h3 className="font-bold text-xs uppercase tracking-widest">Identidade Visual</h3></div>
                  <div className="grid gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm"><Label className="text-xs text-slate-500 mb-1.5 block">Cor de Fundo</Label><div className="flex gap-2"><Input type="color" value={settings.backgroundColor} onChange={(e) => updateSetting('site_background_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" /><Input type="text" value={settings.backgroundColor} onChange={(e) => updateSetting('site_background_color', e.target.value)} className="flex-1 font-mono text-xs bg-slate-50" /></div></div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm"><Label className="text-xs text-slate-500 mb-1.5 block">Cor de Destaque</Label><div className="flex gap-2"><Input type="color" value={settings.primaryColor} onChange={(e) => updateSetting('site_primary_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" /><Input type="text" value={settings.primaryColor} onChange={(e) => updateSetting('site_primary_color', e.target.value)} className="flex-1 font-mono text-xs bg-slate-50" /></div></div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm"><Label className="text-xs text-slate-500 mb-1.5 block">Cor do Texto</Label><div className="flex gap-2"><Input type="color" value={settings.textColor} onChange={(e) => updateSetting('site_text_color', e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer shrink-0" /><Input type="text" value={settings.textColor} onChange={(e) => updateSetting('site_text_color', e.target.value)} className="flex-1 font-mono text-xs bg-slate-50" /></div></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-2"><Globe className="h-4 w-4" /><h3 className="font-bold text-xs uppercase tracking-widest">Informações Gerais</h3></div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    <div className="space-y-2"><Label className="text-xs">URL do Logo</Label><Input value={settings.logoUrl || ''} onChange={(e) => updateSetting('logo_url', e.target.value)} placeholder="https://..." className="bg-slate-50" /></div>
                    <div className="space-y-2"><Label className="text-xs">Barra de Topo (Anúncio)</Label><Input value={settings.headerAnnouncement} onChange={(e) => updateSetting('header_announcement_text', e.target.value)} placeholder="Ex: Frete Grátis..." className="bg-slate-50" /></div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="integrations" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* 1. STATUS E TESTE */}
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-500/10 p-2 rounded-lg"><Webhook className="h-5 w-5 text-purple-600" /></div>
                            <h3 className="font-bold text-purple-900 text-sm">Status N8N</h3>
                        </div>
                        {testStatus === 'success' && <div className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-100 px-2 py-1 rounded-md uppercase tracking-wider"><CheckCircle2 className="h-3 w-3" /> Online</div>}
                        {testStatus === 'error' && <div className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-md uppercase tracking-wider"><XCircle className="h-3 w-3" /> Erro</div>}
                    </div>
                    <p className="text-xs text-purple-700 leading-relaxed mt-2 mb-4">Verifique se o seu servidor de automação (N8N) está respondendo corretamente.</p>
                    
                    <Button 
                        onClick={handleTestConnection} 
                        disabled={testStatus === 'loading'}
                        variant="outline" 
                        className={cn(
                            "w-full border-purple-200 text-purple-700 hover:bg-white hover:text-purple-900 h-9 text-xs font-bold uppercase tracking-wider transition-all",
                            testStatus === 'success' && "border-green-300 text-green-700 bg-green-50",
                            testStatus === 'error' && "border-red-300 text-red-700 bg-red-50"
                        )}
                    >
                        {testStatus === 'loading' ? 'Testando...' : 'Testar Conexão (Ping)'} <Activity className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </div>

                {/* 3. WEBHOOKS DE ENTRADA (O que o N8N deve chamar) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <ArrowDownCircle className="h-4 w-4 text-orange-500" />
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">APIs de Entrada (Para N8N)</h3>
                    </div>
                    
                    <div className="space-y-4">
                        {/* UPDATE ORDER (FINALIZAR PIX) */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-400" /> Confirmar Pagamento PIX
                                </Label>
                                <Badge className="text-[9px] bg-orange-500 text-white hover:bg-orange-600 border-none">Auth Required</Badge>
                            </div>
                            <div className="flex gap-2 mb-3">
                                <Input readOnly value={`${PROJECT_URL}/functions/v1/update-order-status`} className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-[10px] h-8" />
                                <Button size="icon" className="h-8 w-8 bg-slate-700 hover:bg-slate-600 shrink-0" onClick={() => copyToClipboard(`${PROJECT_URL}/functions/v1/update-order-status`, "URL Copiada!")}>
                                    <Copy className="h-3.5 w-3.5 text-white" />
                                </Button>
                            </div>
                            
                            {/* JSON HELPER */}
                            <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Exemplo JSON (Finalizar)</span>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-5 text-[9px] text-sky-400 hover:text-white p-0 hover:bg-transparent"
                                        onClick={() => copyToClipboard(JSON.stringify({
                                            order_id: 12345,
                                            status: "Finalizada",
                                            delivery_status: "Em Preparação",
                                            delivery_info: "PIX Confirmado"
                                        }, null, 2), "JSON Copiado!")}
                                    >
                                        <FileJson className="h-3 w-3 mr-1" /> Copiar Payload
                                    </Button>
                                </div>
                                <pre className="text-[9px] text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
{`{
  "order_id": 12345,
  "status": "Finalizada",
  "delivery_status": "Em Preparação"
}`}
                                </pre>
                            </div>
                        </div>

                        {/* UPDATE ORDER (RASTREIO) */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-sky-400" /> Atualizar Rastreio
                                </Label>
                            </div>
                            <div className="bg-black/50 p-2 rounded-lg border border-white/5 mt-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Exemplo JSON</span>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-5 text-[9px] text-sky-400 hover:text-white p-0 hover:bg-transparent"
                                        onClick={() => copyToClipboard(JSON.stringify({
                                            order_id: 12345,
                                            status: "Em Trânsito",
                                            delivery_status: "Enviado",
                                            tracking_code: "BR123456789"
                                        }, null, 2), "JSON Copiado!")}
                                    >
                                        <FileJson className="h-3 w-3 mr-1" /> Copiar Payload
                                    </Button>
                                </div>
                                <pre className="text-[9px] text-blue-300 font-mono overflow-x-auto whitespace-pre-wrap">
{`{
  "order_id": 12345,
  "status": "Em Trânsito",
  "delivery_status": "Enviado",
  "tracking_code": "BR123456789"
}`}
                                </pre>
                            </div>
                        </div>

                        {/* GET ORDER DETAILS (NOVO) */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-white">Consultar Pedido Completo</Label>
                                <Badge className="text-[9px] bg-sky-500 text-white hover:bg-sky-600 border-none">GET</Badge>
                            </div>
                            <div className="flex gap-2">
                                <Input readOnly value={`${PROJECT_URL}/functions/v1/get-order-details?id={ORDER_ID}`} className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-[10px] h-8" />
                                <Button size="icon" className="h-8 w-8 bg-slate-700 hover:bg-slate-600 shrink-0" onClick={() => copyToClipboard(`${PROJECT_URL}/functions/v1/get-order-details`)}>
                                    <Copy className="h-3.5 w-3.5 text-white" />
                                </Button>
                            </div>
                        </div>

                        {/* MERCADO PAGO */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-2">
                                <CreditCard className="h-3.5 w-3.5" /> Mercado Pago (Webhook)
                            </Label>
                            <div className="flex gap-2">
                                <Input readOnly value={`${PROJECT_URL}/functions/v1/mercadopago-webhook`} className="bg-slate-50 font-mono text-[10px] h-8" />
                                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(`${PROJECT_URL}/functions/v1/mercadopago-webhook`)}>
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. WEBHOOKS DE SAÍDA (O que o Site envia para o N8N) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <ArrowUpCircle className="h-4 w-4 text-sky-500" />
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Webhooks de Saída (Events)</h3>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between"><Label className="text-xs font-bold uppercase tracking-wider text-slate-600">Novo Pedido</Label><span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded", webhooks.order_created ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400")}>{webhooks.order_created ? 'Ativo' : 'Inativo'}</span></div>
                        <Input value={webhooks.order_created} onChange={(e) => updateWebhook('order_created', e.target.value)} placeholder="https://seu-n8n.com/webhook/..." className="bg-slate-50 font-mono text-[10px] h-8"/>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between"><Label className="text-xs font-bold uppercase tracking-wider text-slate-600">Novo Cliente</Label><span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded", webhooks.customer_created ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400")}>{webhooks.customer_created ? 'Ativo' : 'Inativo'}</span></div>
                        <Input value={webhooks.customer_created} onChange={(e) => updateWebhook('customer_created', e.target.value)} placeholder="https://seu-n8n.com/webhook/..." className="bg-slate-50 font-mono text-[10px] h-8"/>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3 border-l-4 border-l-emerald-500">
                        <div className="flex items-center justify-between"><Label className="text-xs font-bold uppercase tracking-wider text-emerald-600">Chat Bot (Msg Enviada)</Label><span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded", webhooks.chat_message_sent ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400")}>{webhooks.chat_message_sent ? 'Ativo' : 'Inativo'}</span></div>
                        <Input value={webhooks.chat_message_sent} onChange={(e) => updateWebhook('chat_message_sent', e.target.value)} placeholder="https://seu-n8n.com/webhook/..." className="bg-slate-50 font-mono text-[10px] h-8"/>
                    </div>
                </div>
              </TabsContent>

              <TabsContent value="home" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Home Content */}
                <div className="space-y-3">
                  {[
                    { id: 'hero', label: 'Banner Principal', sub: 'Carrossel grande no topo', key: 'show_hero_banner', checked: settings.showHero },
                    { id: 'info', label: 'Faixa Informativa', sub: 'Ícones de frete e pagamento', key: 'show_info_section', checked: settings.showInfo },
                    { id: 'brands', label: 'Carrossel de Marcas', sub: 'Logos dos parceiros', key: 'show_brands', checked: settings.showBrands },
                    { id: 'promo', label: 'Promoções', sub: 'Destaques de ofertas', key: 'show_promotions', checked: settings.showPromotions },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-white shadow-sm hover:border-sky-200 transition-colors">
                      <div className="space-y-0.5"><Label htmlFor={`${item.id}-toggle`} className="text-sm font-bold cursor-pointer text-slate-800">{item.label}</Label><p className="text-[10px] text-slate-500 font-medium">{item.sub}</p></div>
                      <Switch id={`${item.id}-toggle`} checked={item.checked} onCheckedChange={(checked) => updateSetting(item.key, String(checked))} />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="login" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Título Principal</Label><Input value={settings.loginTitle} onChange={(e) => updateSetting('login_title', e.target.value)} placeholder="Nome da Marca" className="font-black text-lg h-12" /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subtítulo</Label><Input value={settings.loginSubtitle} onChange={(e) => updateSetting('login_subtitle', e.target.value)} placeholder="Frase de efeito" /></div>
                </div>
              </TabsContent>

              <TabsContent value="dashboard" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saudação</Label><Input value={settings.dashboardGreeting} onChange={(e) => updateSetting('dashboard_greeting', e.target.value)} /></div>
                    <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rótulo Pontos</Label><Input value={settings.dashboardPointsLabel} onChange={(e) => updateSetting('dashboard_points_label', e.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mensagem de Boas-vindas</Label><Input value={settings.dashboardSubtitle} onChange={(e) => updateSetting('dashboard_subtitle', e.target.value)} /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Botão Principal</Label><div className="flex gap-2"><Input value={settings.dashboardButtonText} onChange={(e) => updateSetting('dashboard_button_text', e.target.value)} className="font-bold text-sky-600" /><div className="bg-sky-500 text-white rounded-md px-3 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">Preview</div></div></div>
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>

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