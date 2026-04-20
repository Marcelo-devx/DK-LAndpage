import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/lib/logger';
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
  Package,
  Wrench,
  AlertTriangle,
  Timer,
  Truck,
  Plus,
  PencilLine,
  CalendarX
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

// Campo isolado para salvar a Public Key do MP diretamente no banco
const MpPublicKeyField = () => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'mercadopago_public_key').maybeSingle().then(({ data }) => {
      if (data?.value) setValue(data.value);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert([{ key: 'mercadopago_public_key', value }], { onConflict: 'key' });
    setSaving(false);
    if (error) showError('Erro ao salvar Public Key.');
    else showSuccess('Public Key salva!');
  };

  if (!loaded) return <div className="h-9 bg-sky-100 rounded-lg animate-pulse" />;

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        className="font-mono text-[10px] flex-1"
      />
      <Button size="sm" onClick={handleSave} disabled={saving} className="bg-sky-500 hover:bg-sky-600 text-white h-10 px-3 shrink-0">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
      </Button>
    </div>
  );
};

interface FreeShippingRule {
  id: number;
  shipping_price: number;
  min_order_value: number;
  is_active: boolean;
}

const AdminCustomizer = () => {
  const { isAdmin, isGerenteGeral } = useAuth();
  const canManageShipping = isAdmin || isGerenteGeral;
  const { settings, updateSetting, refreshSettings, saveAllSettings } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("global");
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isSimulating, setIsSimulating] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // NOVO: Estado para gerenciar categorias
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Estado para regras de frete grátis
  const [freeShippingRules, setFreeShippingRules] = useState<FreeShippingRule[]>([]);
  const [loadingFreeShipping, setLoadingFreeShipping] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<number | 'new' | null>(null);
  const [newRule, setNewRule] = useState<{ shipping_price: string; min_order_value: string } | null>(null);

  // Estado para feriados
  const [holidays, setHolidays] = useState<string[]>([]);
  const [holidayMessage, setHolidayMessage] = useState('Hoje é feriado! Seu pedido será enviado no próximo dia útil.');
  const [eveMessage, setEveMessage] = useState('Amanhã é feriado! Pedidos feitos agora serão enviados após o feriado.');
  const [newHoliday, setNewHoliday] = useState('');
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [savingHolidays, setSavingHolidays] = useState(false);

  // Helper: wrap a promise with a timeout so UI doesn't hang indefinitely
  const withTimeout = async <T,>(promise: Promise<T>, ms = 10000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('timeout'));
      }, ms);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result as T;
    } catch (err) {
      // Ensure the timeout cleared
      try { clearTimeout(timeoutId!); } catch {}
      throw err;
    }
  };

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

  const defaultTimerJson = JSON.stringify({
    weekday_before: "Faça seu pedido antes das 14h para ser enviado ainda hoje! Tempo restante:",
    weekday_after: "Fazendo seu pedido após as 14h será enviado na próxima rota!",
    saturday_before: "Faça seu pedido antes das 12:30h para ser enviado ainda hoje! Tempo restante:",
    saturday_after: "Fazendo o pedido após as 12:30h será enviado na próxima rota!",
    sunday: "Hoje é Domingo. Seu pedido será enviado no próximo dia útil!",
  }, null, 2);
  const [timerJson, setTimerJson] = useState(defaultTimerJson);
  const [timerJsonError, setTimerJsonError] = useState<string | null>(null);
  const [loadingTimer, setLoadingTimer] = useState(false);
  const [savingTimer, setSavingTimer] = useState(false);

  const fetchFreeShippingRules = async () => {
    setLoadingFreeShipping(true);
    const { data } = await supabase
      .from('free_shipping_rules')
      .select('id, shipping_price, min_order_value, is_active')
      .order('shipping_price');
    if (data) setFreeShippingRules(data as FreeShippingRule[]);
    setLoadingFreeShipping(false);
  };

  const saveFreeShippingRule = async (rule: FreeShippingRule) => {
    setSavingRuleId(rule.id);
    const { error } = await supabase
      .from('free_shipping_rules')
      .update({ shipping_price: rule.shipping_price, min_order_value: rule.min_order_value, is_active: rule.is_active })
      .eq('id', rule.id);
    setSavingRuleId(null);
    if (error) showError('Erro ao salvar regra.');
    else showSuccess('Regra salva!');
  };

  const deleteFreeShippingRule = async (id: number) => {
    const { error } = await supabase.from('free_shipping_rules').delete().eq('id', id);
    if (error) showError('Erro ao excluir regra.');
    else {
      setFreeShippingRules(prev => prev.filter(r => r.id !== id));
      showSuccess('Regra excluída!');
    }
  };

  const addFreeShippingRule = async () => {
    if (!newRule) return;
    const sp = parseFloat(newRule.shipping_price);
    const mo = parseFloat(newRule.min_order_value);
    if (isNaN(sp) || isNaN(mo) || sp <= 0 || mo <= 0) {
      showError('Informe valores válidos maiores que zero.');
      return;
    }
    setSavingRuleId('new');
    const { data, error } = await supabase
      .from('free_shipping_rules')
      .insert({ shipping_price: sp, min_order_value: mo, is_active: true })
      .select()
      .single();
    setSavingRuleId(null);
    if (error) showError('Erro ao adicionar regra.');
    else {
      setFreeShippingRules(prev => [...prev, data as FreeShippingRule].sort((a, b) => a.shipping_price - b.shipping_price));
      setNewRule(null);
      showSuccess('Regra adicionada!');
    }
  };

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

  const fetchTimerMessages = async () => {
    setLoadingTimer(true);
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'timer_weekday_before',
        'timer_weekday_after',
        'timer_saturday_before',
        'timer_saturday_after',
        'timer_sunday',
      ]);

    if (data && data.length > 0) {
      const map: Record<string, string> = {};
      data.forEach((row: any) => { map[row.key] = row.value; });
      const obj = {
        weekday_before: map['timer_weekday_before'] || '',
        weekday_after: map['timer_weekday_after'] || '',
        saturday_before: map['timer_saturday_before'] || '',
        saturday_after: map['timer_saturday_after'] || '',
        sunday: map['timer_sunday'] || '',
      };
      setTimerJson(JSON.stringify(obj, null, 2));
    }
    setLoadingTimer(false);
  };

  const fetchHolidays = async () => {
    setLoadingHolidays(true);
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['timer_holidays', 'timer_holiday_message']);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((row: any) => { map[row.key] = row.value; });
      if (map['timer_holidays']) {
        setHolidays(map['timer_holidays'].split(',').map((d: string) => d.trim()).filter(Boolean));
      }
      if (map['timer_holiday_message']) {
        setHolidayMessage(map['timer_holiday_message']);
      }
      if (map['timer_eve_message']) {
        setEveMessage(map['timer_eve_message']);
      }
    }
    setLoadingHolidays(false);
  };

  const saveHolidays = async (list: string[], msg: string, eve: string) => {
    setSavingHolidays(true);
    await supabase.from('app_settings').upsert([
      { key: 'timer_holidays', value: list.join(',') },
      { key: 'timer_holiday_message', value: msg },
      { key: 'timer_eve_message', value: eve },
    ], { onConflict: 'key' });
    setSavingHolidays(false);
    showSuccess('Feriados salvos!');
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    if (holidays.includes(newHoliday)) { showError('Data já cadastrada.'); return; }
    const updated = [...holidays, newHoliday].sort();
    setHolidays(updated);
    setNewHoliday('');
    saveHolidays(updated, holidayMessage, eveMessage);
  };

  const removeHoliday = (date: string) => {
    const updated = holidays.filter(d => d !== date);
    setHolidays(updated);
    saveHolidays(updated, holidayMessage, eveMessage);
  };

  useEffect(() => {
    const loadAdminData = async () => {
      if (isAdmin || isGerenteGeral) {
        fetchWebhooks();
        fetchCategories();
        fetchTimerMessages();
        fetchFreeShippingRules();
        fetchHolidays();
      }
    };
    loadAdminData();
  }, [isAdmin, isGerenteGeral]);

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
          logger.warn('[AdminCustomizer] direct function fetch response not ok:', debugResp.status, debugResp.statusText);
        } else {
          logger.info('[AdminCustomizer] direct function fetch succeeded (for debug).');
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

  const saveTimerMessages = async () => {
    let parsed: any;
    try {
      parsed = JSON.parse(timerJson);
    } catch (e) {
      setTimerJsonError('JSON inválido. Corrija antes de salvar.');
      return;
    }
    setTimerJsonError(null);
    setSavingTimer(true);

    const rows = [
      { key: 'timer_weekday_before', value: parsed.weekday_before || '' },
      { key: 'timer_weekday_after', value: parsed.weekday_after || '' },
      { key: 'timer_saturday_before', value: parsed.saturday_before || '' },
      { key: 'timer_saturday_after', value: parsed.saturday_after || '' },
      { key: 'timer_sunday', value: parsed.sunday || '' },
    ];

    for (const row of rows) {
      await supabase.from('app_settings').upsert([row], { onConflict: 'key' });
    }

    setSavingTimer(false);
    showSuccess('Barra atualizada!');
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

  if (!isAdmin && !isGerenteGeral) return null;

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
                <TabsTrigger value="footer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-sky-500 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <Save className="h-3.5 w-3.5" /> Footer
                </TabsTrigger>
                <TabsTrigger value="home" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-sky-500 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Home className="h-3.5 w-3.5" /> Home</TabsTrigger>
                <TabsTrigger value="login" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-indigo-500 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><LogIn className="h-3.5 w-3.5" /> Login</TabsTrigger>
                <TabsTrigger value="maintenance" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-orange-600 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Wrench className="h-3.5 w-3.5" /> Manutenção</TabsTrigger>
                <TabsTrigger value="timerbar" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-sky-500 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Timer className="h-3.5 w-3.5" /> Barra Azul</TabsTrigger>
                <TabsTrigger value="feriados" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-rose-500 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><CalendarX className="h-3.5 w-3.5" /> Feriados</TabsTrigger>
                {canManageShipping && (
                  <TabsTrigger value="frete" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all data-[state=active]:bg-green-600 data-[state=active]:text-white hover:bg-white bg-white border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider"><Truck className="h-3.5 w-3.5" /> Frete</TabsTrigger>
                )}
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
                                loading="lazy"
                                decoding="async"
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
                            <Button size="icon" className="h-8 w-8 bg-slate-700 hover:bg-slate-600 shrink-0" onClick={() => copyToClipboard(`${PROJECT_URL}/functions/v1/update-order-status`)} >
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

              {/* --- ABA FOOTER --- */}
              <TabsContent value="footer" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Save className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-emerald-900 text-sm">Configurações do Rodapé</h3>
                  </div>
                  <p className="text-xs text-emerald-700 font-medium">
                    Edite os contatos e links sociais exibidos no rodapé do site.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1">E-mail de Contato</Label>
                    <Input value={settings.contactEmail} onChange={(e) => updateSetting('contact_email', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1">Telefone</Label>
                    <Input value={settings.contactPhone} onChange={(e) => updateSetting('contact_phone', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1">Horário de Atendimento</Label>
                    <Input value={settings.contactHours} onChange={(e) => updateSetting('contact_hours', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1">Instagram (@usuario ou URL)</Label>
                    <Input 
                      value={settings.socialInstagram} 
                      onChange={(e) => updateSetting('social_instagram', e.target.value)} 
                      placeholder="@seu_perfil"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1">URL do Logo (opcional)</Label>
                    <Input value={settings.logoUrl || ''} onChange={(e) => updateSetting('logo_url', e.target.value)} />
                  </div>
                </div>

                {/* Mercado Pago Public Key */}
                <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sky-600 font-black text-sm">💳</span>
                    <h3 className="font-bold text-sky-900 text-sm">Mercado Pago — Checkout Transparente</h3>
                  </div>
                  <p className="text-xs text-sky-700 font-medium mb-3">
                    Cole aqui a <strong>Public Key</strong> do Mercado Pago (começa com <code>APP_USR-</code>). Encontre em: <strong>MP Developers → Suas integrações → Credenciais</strong>.
                  </p>
                  <MpPublicKeyField />
                </div>
              </TabsContent>

              {/* --- ABA FERIADOS --- */}
              <TabsContent value="feriados" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <CalendarX className="h-5 w-5 text-rose-600" />
                    <h3 className="font-bold text-rose-900 text-sm">Feriados — Sem Timer</h3>
                  </div>
                  <p className="text-xs text-rose-700 font-medium">
                    Nos dias cadastrados aqui, a barra amarela exibe a mensagem de feriado e <strong>não mostra o timer</strong> de contagem regressiva.
                  </p>
                </div>

                {loadingHolidays ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Mensagem do feriado */}
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-2">
                      <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mensagem no dia do feriado</Label>
                      <div className="flex gap-2">
                        <Input
                          value={holidayMessage}
                          onChange={(e) => setHolidayMessage(e.target.value)}
                          placeholder="Hoje é feriado! Seu pedido será enviado no próximo dia útil."
                          className="text-sm flex-1"
                        />
                        <Button
                          size="sm"
                          className="bg-rose-500 hover:bg-rose-600 text-white h-10 px-3 shrink-0"
                          onClick={() => saveHolidays(holidays, holidayMessage, eveMessage)}
                          disabled={savingHolidays}
                        >
                          {savingHolidays ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-400">Exibida <strong>no próprio dia</strong> do feriado, sem timer.</p>
                    </div>

                    {/* Mensagem de véspera */}
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-2">
                      <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mensagem na véspera do feriado</Label>
                      <div className="flex gap-2">
                        <Input
                          value={eveMessage}
                          onChange={(e) => setEveMessage(e.target.value)}
                          placeholder="Amanhã é feriado! Pedidos feitos agora serão enviados após o feriado."
                          className="text-sm flex-1"
                        />
                        <Button
                          size="sm"
                          className="bg-rose-500 hover:bg-rose-600 text-white h-10 px-3 shrink-0"
                          onClick={() => saveHolidays(holidays, holidayMessage, eveMessage)}
                          disabled={savingHolidays}
                        >
                          {savingHolidays ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-400">Exibida <strong>após o horário de corte</strong> do dia anterior ao feriado.</p>
                    </div>

                    {/* Adicionar feriado */}
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-2">
                      <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Adicionar data de feriado</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={newHoliday}
                          onChange={(e) => setNewHoliday(e.target.value)}
                          className="flex-1 text-sm"
                        />
                        <Button
                          size="sm"
                          className="bg-rose-500 hover:bg-rose-600 text-white h-10 px-3 shrink-0"
                          onClick={addHoliday}
                          disabled={!newHoliday}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Lista de feriados */}
                    <div className="space-y-2">
                      {holidays.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          Nenhum feriado cadastrado
                        </div>
                      ) : (
                        holidays.map((date) => {
                          const [y, m, d] = date.split('-');
                          const formatted = `${d}/${m}/${y}`;
                          const isToday = date === new Date().toISOString().split('T')[0];
                          const isPast = date < new Date().toISOString().split('T')[0];
                          return (
                            <div key={date} className={`flex items-center justify-between bg-white border rounded-xl px-4 py-3 shadow-sm ${isToday ? 'border-rose-300 bg-rose-50' : isPast ? 'border-slate-100 opacity-50' : 'border-slate-100'}`}>
                              <div className="flex items-center gap-3">
                                <CalendarX className={`h-4 w-4 ${isToday ? 'text-rose-500' : 'text-slate-400'}`} />
                                <div>
                                  <p className="font-bold text-sm text-slate-900">{formatted}</p>
                                  {isToday && <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider">Hoje</p>}
                                  {isPast && !isToday && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Passado</p>}
                                </div>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600"
                                onClick={() => removeHoliday(date)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                        <span className="font-black">💡 Dica:</span> Datas passadas podem ser removidas para manter a lista limpa. O formato da data é <strong>AAAA-MM-DD</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* --- ABA BARRA AZUL (TIMER) --- */}
              <TabsContent value="timerbar" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Timer className="h-5 w-5 text-sky-600" />
                    <h3 className="font-bold text-sky-900 text-sm">Mensagens da Barra de Entrega</h3>
                  </div>
                  <p className="text-xs text-sky-700 font-medium">
                    Edite os textos exibidos na barra azul no topo do site. As alterações são salvas ao clicar em "Salvar Mensagens".
                  </p>
                </div>

                {loadingTimer ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">JSON — Barra de Entrega</span>
                        <button
                          onClick={() => { setTimerJson(defaultTimerJson); setTimerJsonError(null); }}
                          className="text-[10px] text-slate-500 hover:text-sky-400 font-bold uppercase tracking-wider transition-colors"
                        >
                          Resetar
                        </button>
                      </div>
                      <textarea
                        value={timerJson}
                        onChange={(e) => { setTimerJson(e.target.value); setTimerJsonError(null); }}
                        rows={14}
                        spellCheck={false}
                        className="w-full bg-transparent text-green-400 font-mono text-xs p-4 resize-none outline-none leading-relaxed"
                      />
                    </div>

                    {timerJsonError && (
                      <p className="text-xs text-red-500 font-bold flex items-center gap-1">
                        ⚠️ {timerJsonError}
                      </p>
                    )}

                    <div className="bg-slate-800 rounded-lg p-3 text-[10px] text-slate-400 font-mono leading-relaxed">
                      <p className="text-slate-300 font-bold mb-1">Chaves disponíveis:</p>
                      <p>• <span className="text-sky-400">weekday_before</span> — Seg–Sex antes das 14h</p>
                      <p>• <span className="text-sky-400">weekday_after</span> — Seg–Sex após as 14h</p>
                      <p>• <span className="text-sky-400">saturday_before</span> — Sábado antes das 12:30h</p>
                      <p>• <span className="text-sky-400">saturday_after</span> — Sábado após as 12:30h</p>
                      <p>• <span className="text-sky-400">sunday</span> — Domingo</p>
                    </div>

                    <button
                      onClick={saveTimerMessages}
                      disabled={savingTimer}
                      className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold h-11 rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                      {savingTimer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingTimer ? 'Salvando...' : 'Salvar JSON'}
                    </button>
                  </div>
                )}
              </TabsContent>

              {/* --- ABA FRETE GRÁTIS --- */}
              {canManageShipping && (
                <TabsContent value="frete" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-green-50 border border-green-100 p-4 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Truck className="h-5 w-5 text-green-600" />
                      <h3 className="font-bold text-green-900 text-sm">Política de Frete Grátis</h3>
                    </div>
                    <p className="text-xs text-green-700 font-medium">
                      Configure o valor mínimo de compra (em produtos, sem contar o frete) para cada faixa de frete. Quando o cliente atingir o valor mínimo, o frete é zerado automaticamente.
                    </p>
                  </div>

                  {loadingFreeShipping ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Cabeçalho */}
                      <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Valor do Frete</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Mínimo p/ Grátis</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ativo</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ações</span>
                      </div>

                      {/* Regras existentes */}
                      {freeShippingRules.map(rule => (
                        <div key={rule.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                            {/* Valor do frete */}
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={rule.shipping_price}
                                onChange={e => setFreeShippingRules(prev =>
                                  prev.map(r => r.id === rule.id ? { ...r, shipping_price: parseFloat(e.target.value) || 0 } : r)
                                )}
                                className="pl-8 h-9 text-sm font-bold bg-slate-50"
                              />
                            </div>
                            {/* Valor mínimo */}
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={rule.min_order_value}
                                onChange={e => setFreeShippingRules(prev =>
                                  prev.map(r => r.id === rule.id ? { ...r, min_order_value: parseFloat(e.target.value) || 0 } : r)
                                )}
                                className="pl-8 h-9 text-sm font-bold bg-slate-50"
                              />
                            </div>
                            {/* Toggle ativo */}
                            <Switch
                              checked={rule.is_active}
                              onCheckedChange={checked => {
                                const updated = { ...rule, is_active: checked };
                                setFreeShippingRules(prev => prev.map(r => r.id === rule.id ? updated : r));
                                saveFreeShippingRule(updated);
                              }}
                            />
                            {/* Ações */}
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                                onClick={() => saveFreeShippingRule(rule)}
                                disabled={savingRuleId === rule.id}
                                title="Salvar"
                              >
                                {savingRuleId === rule.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Save className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600"
                                onClick={() => deleteFreeShippingRule(rule.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {/* Label informativo */}
                          <p className="text-[9px] text-slate-400 font-medium mt-2 px-1">
                            Frete R$ {rule.shipping_price.toFixed(2).replace('.', ',')} → grátis a partir de R$ {rule.min_order_value.toFixed(2).replace('.', ',')} em produtos
                          </p>
                        </div>
                      ))}

                      {/* Formulário de nova regra */}
                      {newRule !== null ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Nova Regra</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Valor do frete"
                                value={newRule.shipping_price}
                                onChange={e => setNewRule(prev => prev ? { ...prev, shipping_price: e.target.value } : null)}
                                className="pl-8 h-9 text-sm bg-white"
                              />
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Mínimo p/ grátis"
                                value={newRule.min_order_value}
                                onChange={e => setNewRule(prev => prev ? { ...prev, min_order_value: e.target.value } : null)}
                                className="pl-8 h-9 text-sm bg-white"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white h-9 text-xs font-bold"
                              onClick={addFreeShippingRule}
                              disabled={savingRuleId === 'new'}
                            >
                              {savingRuleId === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-xs font-bold"
                              onClick={() => setNewRule(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full border-dashed border-green-300 text-green-700 hover:bg-green-50 h-10 text-xs font-bold uppercase tracking-wider"
                          onClick={() => setNewRule({ shipping_price: '', min_order_value: '' })}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Adicionar Regra
                        </Button>
                      )}

                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                          <span className="font-black">⚠️ Atenção:</span> O valor mínimo é calculado sobre os <span className="font-black">produtos</span> do carrinho, sem incluir o valor do frete. Após salvar, o banner no checkout é atualizado automaticamente.
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

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

              {/* --- ABA MANUTENÇÃO --- */}
              <TabsContent value="maintenance" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <h3 className="font-bold text-orange-900 text-sm">Modo de Manutenção</h3>
                  </div>
                  <p className="text-xs text-orange-800 font-medium leading-relaxed">
                    <strong>⚠️ ATENÇÃO:</strong> Ao ativar, <strong>TODOS</strong> os usuários (incluindo você) verão a tela de manutenção. O painel administrativo continuará visível para desativar o modo.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <Wrench className="h-5 w-5 text-slate-900" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Ativar Manutenção</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {settings.maintenanceMode ? 'O site está em manutenção' : 'O site está normal'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.maintenanceMode}
                      onCheckedChange={(checked) => updateSetting('maintenance_mode', String(checked))}
                    />
                  </div>

                  {settings.maintenanceMode && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse" />
                        <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">
                          Manutenção Ativa - O site está bloqueado para todos os usuários
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider">Dica de Uso</h4>
                  </div>
                  <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                    Se você ativar acidentalmente, basta acessar o painel AdminCustomizer (botão flutuante) e desativar o switch. O site voltará ao normal imediatamente.
                  </p>
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md">
            <Button 
              className="w-full bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl shadow-lg transition-all active:scale-95 group"
              onClick={async () => {
                // Wait a short moment so any debounced upserts finish (updateSetting debounces 1s)
                setIsSaving(true);
                await new Promise((r) => setTimeout(r, 1200));
                try {
                  // Use timeout wrapper to avoid infinite hanging if Supabase/network stalls
                  await withTimeout(saveAllSettings(), 10000);
                  // Refresh the latest settings after successful save
                  await withTimeout(refreshSettings(), 8000);
                  // Expose a global hook for debug/testing if needed
                  (window as any).__refreshThemeSettings = refreshSettings;
                  showSuccess('Salvo!');
                } catch (e: any) {
                  logger.warn('[AdminCustomizer] saveAllSettings failed or timed out', e);
                  // Distinguish timeout vs other errors for clearer messages
                  if (e?.message === 'timeout') {
                    showError('Tempo de salvamento excedido. Verifique sua conexão e tente novamente.');
                  } else {
                    const errorMessage = e?.message || e?.error_description || JSON.stringify(e);
                    showError(`Erro ao salvar: ${errorMessage}`);
                  }
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin text-white" /> : <Save className="mr-2 h-4 w-4 group-hover:text-green-400 transition-colors" />} {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
         </div>
       </SheetContent>
     </Sheet>
   );
 };

 export default AdminCustomizer;