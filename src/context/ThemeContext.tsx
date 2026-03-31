import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ThemeSettings {
  backgroundColor: string;
  primaryColor: string;
  textColor: string;
  showHero: boolean;
  showInfo: boolean;
  showPromotions: boolean;
  showBrands: boolean;
  headerAnnouncement: string;
  logoUrl: string | null;
  footerBannerTitle: string;
  footerBannerSubtitle: string;
  footerBannerButtonText: string;
  contactEmail: string;
  contactPhone: string;
  contactHours: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  loginTitle: string;
  loginSubtitle: string;
  dashboardGreeting: string;
  dashboardSubtitle: string;
  dashboardPointsLabel: string;
  dashboardButtonText: string;
  maintenanceMode: boolean;
}

interface ThemeContextType {
  settings: ThemeSettings;
  refreshSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  saveAllSettings: (s?: ThemeSettings) => Promise<void>;
}

const defaultSettings: ThemeSettings = {
  backgroundColor: '#F4EEE3',
  primaryColor: '#0ea5e9',
  textColor: '#0f172a',
  showHero: true,
  showInfo: true,
  showPromotions: true,
  showBrands: true,
  headerAnnouncement: '',
  logoUrl: null,
  footerBannerTitle: 'O Futuro da Sua Experiência',
  footerBannerSubtitle: 'Curadoria exclusiva dos melhores produtos do mundo para quem não aceita o comum.',
  footerBannerButtonText: 'Explorar Tudo',
  contactEmail: 'contato@dkcwb.com',
  contactPhone: '(48) 99999-9999',
  contactHours: 'Segunda a Sábado: 10h - 18h',
  socialFacebook: '#',
  socialInstagram: '#',
  socialTwitter: '#',
  loginTitle: 'DKCWB',
  loginSubtitle: 'Acesso Exclusivo',
  dashboardGreeting: 'Olá',
  dashboardSubtitle: 'Bem-vindo à sua conta exclusiva DKCWB.',
  dashboardPointsLabel: 'Saldo acumulado',
  dashboardButtonText: 'Resgatar Cupons',
  maintenanceMode: false,
};

const ThemeContext = createContext<ThemeContextType>({
  settings: defaultSettings,
  refreshSettings: async () => {},
  updateSetting: async () => {},
  saveAllSettings: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<ThemeSettings>(defaultSettings);
  
  // Ref para armazenar os timers de debounce de cada chave
  const dbTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const applyColors = (s: ThemeSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--color-off-white', s.backgroundColor);
    root.style.setProperty('--color-gold-accent', s.primaryColor);
    root.style.setProperty('--color-charcoal-gray', s.textColor);
    document.body.style.backgroundColor = s.backgroundColor;
  };

  const refreshSettings = async () => {
    // order by newest first so we pick the latest value when duplicates exist
    const { data, error } = await supabase.from('app_settings').select('key, value, created_at').order('created_at', { ascending: false });
    
    if (error) {
      console.error('[ThemeContext] refreshSettings supabase error', error);
      return;
    }
    
    if (data) {
      const newSettings = { ...defaultSettings };

      // Build a map of latest values per key to avoid duplicate-row ambiguity
      const latest: Record<string, string> = {};
      for (const row of data) {
        if (!(row.key in latest)) latest[row.key] = row.value;
      }

      // If there's a footer_config (atomic JSON) use it first
      if (latest['footer_config']) {
        try {
          const parsed = JSON.parse(latest['footer_config']);
          if (parsed.contactEmail) newSettings.contactEmail = parsed.contactEmail;
          if (parsed.contactPhone) newSettings.contactPhone = parsed.contactPhone;
          if (parsed.contactHours) newSettings.contactHours = parsed.contactHours;
          if (parsed.socialFacebook) newSettings.socialFacebook = parsed.socialFacebook;
          if (parsed.socialInstagram) newSettings.socialInstagram = parsed.socialInstagram;
          if (parsed.socialTwitter) newSettings.socialTwitter = parsed.socialTwitter;
          if (parsed.logoUrl) newSettings.logoUrl = parsed.logoUrl;
        } catch (e) {
          console.warn('Invalid footer_config JSON', e);
        }
      }

      // Individual keys (only apply when footer_config not overriding)
      if (latest['site_background_color']) newSettings.backgroundColor = latest['site_background_color'] || '#F4EEE3';
      if (latest['site_primary_color']) newSettings.primaryColor = latest['site_primary_color'] || '#0ea5e9';
      if (latest['site_text_color']) newSettings.textColor = latest['site_text_color'] || '#0f172a';
      if (latest['show_hero_banner']) newSettings.showHero = latest['show_hero_banner'] === 'true';
      if (latest['show_info_section']) newSettings.showInfo = latest['show_info_section'] === 'true';
      if (latest['show_promotions']) newSettings.showPromotions = latest['show_promotions'] === 'true';
      if (latest['show_brands']) newSettings.showBrands = latest['show_brands'] === 'true';
      if (latest['header_announcement_text']) newSettings.headerAnnouncement = latest['header_announcement_text'] || '';
      if (latest['logo_url'] && !latest['footer_config']) newSettings.logoUrl = latest['logo_url'];
      if (latest['footer_banner_title']) newSettings.footerBannerTitle = latest['footer_banner_title'] || '';
      if (latest['footer_banner_subtitle']) newSettings.footerBannerSubtitle = latest['footer_banner_subtitle'] || '';
      if (latest['footer_banner_button_text']) newSettings.footerBannerButtonText = latest['footer_banner_button_text'] || '';
      if (latest['contact_email'] && !latest['footer_config']) newSettings.contactEmail = latest['contact_email'] || '';
      if (latest['contact_phone'] && !latest['footer_config']) newSettings.contactPhone = latest['contact_phone'] || '';
      if (latest['contact_hours'] && !latest['footer_config']) newSettings.contactHours = latest['contact_hours'] || '';
      if (latest['social_facebook'] && !latest['footer_config']) newSettings.socialFacebook = latest['social_facebook'] || '';
      if (latest['social_instagram'] && !latest['footer_config']) newSettings.socialInstagram = latest['social_instagram'] || '';
      if (latest['social_twitter'] && !latest['footer_config']) newSettings.socialTwitter = latest['social_twitter'] || '';
      if (latest['login_title']) newSettings.loginTitle = latest['login_title'] || 'DKCWB';
      if (latest['login_subtitle']) newSettings.loginSubtitle = latest['login_subtitle'] || 'Acesso Exclusivo';
      if (latest['dashboard_greeting']) newSettings.dashboardGreeting = latest['dashboard_greeting'] || 'Olá';
      if (latest['dashboard_subtitle']) newSettings.dashboardSubtitle = latest['dashboard_subtitle'] || 'Bem-vindo à sua conta exclusiva DKCWB.';
      if (latest['dashboard_points_label']) newSettings.dashboardPointsLabel = latest['dashboard_points_label'] || 'Saldo acumulado';
      if (latest['dashboard_button_text']) newSettings.dashboardButtonText = latest['dashboard_button_text'] || 'Resgatar Cupons';
      if (latest['maintenance_mode']) newSettings.maintenanceMode = latest['maintenance_mode'] === 'true';

      setSettings(newSettings);
      applyColors(newSettings);
    }
  };

  // Chaves relacionadas ao footer
  const footerKeys = [
    'contact_email',
    'contact_phone',
    'contact_hours',
    'social_facebook',
    'social_instagram',
    'social_twitter',
    'logo_url',
  ];

  const updateSetting = async (key: string, value: string) => {
    // 1. Atualização Otimista Instantânea (Local)
    const mapKey: Record<string, keyof ThemeSettings> = {
      'site_background_color': 'backgroundColor',
      'site_primary_color': 'primaryColor',
      'site_text_color': 'textColor',
      'show_hero_banner': 'showHero',
      'show_info_section': 'showInfo',
      'show_promotions': 'showPromotions',
      'show_brands': 'showBrands',
      'header_announcement_text': 'headerAnnouncement',
      'logo_url': 'logoUrl',
      'footer_banner_title': 'footerBannerTitle',
      'footer_banner_subtitle': 'footerBannerSubtitle',
      'footer_banner_button_text': 'footerBannerButtonText',
      'contact_email': 'contactEmail',
      'contact_phone': 'contactPhone',
      'contact_hours': 'contactHours',
      'social_facebook': 'socialFacebook',
      'social_instagram': 'socialInstagram',
      'social_twitter': 'socialTwitter',
      'login_title': 'loginTitle',
      'login_subtitle': 'loginSubtitle',
      'dashboard_greeting': 'dashboardGreeting',
      'dashboard_subtitle': 'dashboardSubtitle',
      'dashboard_points_label': 'dashboardPointsLabel',
      'dashboard_button_text': 'dashboardButtonText',
      'maintenance_mode': 'maintenanceMode',
    };

    const settingKey = mapKey[key];
    let finalValue: any = value;
    if (settingKey && ['showHero', 'showInfo', 'showPromotions', 'showBrands', 'maintenanceMode'].includes(settingKey)) {
        finalValue = value === 'true';
    }

    // MOVED: Define newSettings outside if block so it's accessible in setTimeout
    const newSettings = { ...settings, ...(settingKey ? { [settingKey]: finalValue } : {}) };

    if (settingKey) {
        setSettings(newSettings);
        applyColors(newSettings);
    }

    // 2. Atualização Debounced no Banco de Dados (espera 1s após parar de digitar)
    if (dbTimeouts.current[key]) {
      clearTimeout(dbTimeouts.current[key]);
    }

    dbTimeouts.current[key] = setTimeout(async () => {
      // Use onConflict so that upsert merges with existing rows that have the same key.
      const { error } = await supabase
        .from('app_settings')
        .upsert([{ key, value }], { onConflict: 'key' });

      if (error) {
        console.error(`Erro ao salvar ${key}:`, error);

        if ((error as any)?.code === '23505') {
          const { error: updateError } = await supabase
            .from('app_settings')
            .update({ value })
            .eq('key', key);

          if (updateError) console.error(`Erro ao atualizar ${key} após conflito:`, updateError);
        }
      }

      // NOVO: Se a chave alterada for relacionada ao footer, atualizar footer_config automaticamente
      if (footerKeys.includes(key)) {
        const footerConfig = {
          contactEmail: newSettings.contactEmail,
          contactPhone: newSettings.contactPhone,
          contactHours: newSettings.contactHours,
          socialFacebook: newSettings.socialFacebook,
          socialInstagram: newSettings.socialInstagram,
          socialTwitter: newSettings.socialTwitter,
          logoUrl: newSettings.logoUrl || '',
        };

        const { error: footerError } = await supabase
          .from('app_settings')
          .upsert([{ key: 'footer_config', value: JSON.stringify(footerConfig) }], { onConflict: 'key' });

        if (footerError) {
          console.error('Erro ao atualizar footer_config:', footerError);
        } else {
          console.log('footer_config atualizado automaticamente após alteração em:', key);
        }
      }

      delete dbTimeouts.current[key];
    }, 1000);
  };

  // Persist all settings at once (called by Save button to ensure a concrete write)
  const saveAllSettings = async (s?: ThemeSettings) => {
    const toSave = s || settings;
    // create an atomic footer config to ensure footer updates are saved together
    const footerConfig = {
      contactEmail: toSave.contactEmail,
      contactPhone: toSave.contactPhone,
      contactHours: toSave.contactHours,
      socialFacebook: toSave.socialFacebook,
      socialInstagram: toSave.socialInstagram,
      socialTwitter: toSave.socialTwitter,
      logoUrl: toSave.logoUrl || '',
    };

    const payload = [
      { key: 'site_background_color', value: toSave.backgroundColor },
      { key: 'site_primary_color', value: toSave.primaryColor },
      { key: 'site_text_color', value: toSave.textColor },
      { key: 'show_hero_banner', value: String(toSave.showHero) },
      { key: 'show_info_section', value: String(toSave.showInfo) },
      { key: 'show_promotions', value: String(toSave.showPromotions) },
      { key: 'show_brands', value: String(toSave.showBrands) },
      { key: 'header_announcement_text', value: toSave.headerAnnouncement },
      { key: 'logo_url', value: toSave.logoUrl || '' },
      { key: 'footer_banner_title', value: toSave.footerBannerTitle },
      { key: 'footer_banner_subtitle', value: toSave.footerBannerSubtitle },
      { key: 'footer_banner_button_text', value: toSave.footerBannerButtonText },
      // footer atomic entry
      { key: 'footer_config', value: JSON.stringify(footerConfig) },
      // keep individual footer keys as compatibility fallback (they will be ignored if footer_config exists)
      { key: 'contact_email', value: toSave.contactEmail },
      { key: 'contact_phone', value: toSave.contactPhone },
      { key: 'contact_hours', value: toSave.contactHours },
      { key: 'social_facebook', value: toSave.socialFacebook },
      { key: 'social_instagram', value: toSave.socialInstagram },
      { key: 'social_twitter', value: toSave.socialTwitter },
      { key: 'login_title', value: toSave.loginTitle },
      { key: 'login_subtitle', value: toSave.loginSubtitle },
      { key: 'dashboard_greeting', value: toSave.dashboardGreeting },
      { key: 'dashboard_subtitle', value: toSave.dashboardSubtitle },
      { key: 'dashboard_points_label', value: toSave.dashboardPointsLabel },
      { key: 'dashboard_button_text', value: toSave.dashboardButtonText },
      { key: 'maintenance_mode', value: String(toSave.maintenanceMode) },
    ];

    try {
      // SOLUÇÃO DEFINITIVA: Usar upsert com onConflict em vez de delete+insert
      // Isso garante que sempre atualiza a mesma linha e evita race conditions
      for (const row of payload) {
        const { error } = await supabase
          .from('app_settings')
          .upsert([row], { 
            onConflict: 'key', 
            ignoreDuplicates: false 
          });
        
        if (error) {
          console.error(`Erro ao salvar ${row.key}:`, error);
          throw new Error(`Falha ao salvar ${row.key}: ${error.message}`);
        }
      }
      
      console.log('[ThemeContext] Todas as configurações salvas com sucesso via upsert');
    } catch (e) {
      console.error('[ThemeContext] Erro ao salvar configurações:', e);
      throw e;
    }
  };

  useEffect(() => {
    // catch any errors from refreshSettings to avoid unhandled promise rejections
    refreshSettings().catch((e) => {
      console.error('[ThemeContext] refreshSettings failed', e);
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, refreshSettings, updateSetting, saveAllSettings }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;