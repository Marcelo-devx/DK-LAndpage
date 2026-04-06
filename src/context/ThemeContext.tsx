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
    // Timeout de 5s para evitar loading infinito ao voltar de outra aba
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    );

    try {
      const fetchPromise = supabase
        .from('app_settings')
        .select('key, value, created_at')
        .order('created_at', { ascending: false });

      const result = await Promise.race([fetchPromise, timeout]) as any;
      const { data, error } = result;

      if (error) {
        console.error('[ThemeContext] refreshSettings supabase error', error);
        // Não quebra a app se falhar o fetch de settings - usa valores default
        return;
      }

      if (data) {
        const newSettings = { ...defaultSettings };
        const latest: Record<string, string> = {};
        for (const row of data) {
          if (!(row.key in latest)) latest[row.key] = row.value;
        }

        // First prefer footer_settings table if present (canonical source)
        try {
          // Try to fetch the canonical footer_settings row — prefer the latest entry instead of hardcoded id
          const { data: footerRow } = await supabase
            .from('footer_settings')
            .select('contact_email, contact_phone, contact_hours, social_facebook, social_instagram, social_twitter, logo_url')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (footerRow) {
            if (footerRow.contact_email) newSettings.contactEmail = footerRow.contact_email;
            if (footerRow.contact_phone) newSettings.contactPhone = footerRow.contact_phone;
            if (footerRow.contact_hours) newSettings.contactHours = footerRow.contact_hours;
            if (footerRow.social_facebook) newSettings.socialFacebook = footerRow.social_facebook;
            if (footerRow.social_instagram) newSettings.socialInstagram = footerRow.social_instagram;
            if (footerRow.social_twitter) newSettings.socialTwitter = footerRow.social_twitter;
            if (footerRow.logo_url) newSettings.logoUrl = footerRow.logo_url;
          }
        } catch (e) {
          // ignore footer_settings read errors - use default values
          console.warn('[ThemeContext] Could not read footer_settings, using default values', e);
        }

        if (latest['site_background_color']) newSettings.backgroundColor = latest['site_background_color'] || '#F4EEE3';
        if (latest['site_primary_color']) newSettings.primaryColor = latest['site_primary_color'] || '#0ea5e9';
        if (latest['site_text_color']) newSettings.textColor = latest['site_text_color'] || '#0f172a';
        if (latest['show_hero_banner']) newSettings.showHero = latest['show_hero_banner'] === 'true';
        if (latest['show_info_section']) newSettings.showInfo = latest['show_info_section'] === 'true';
        if (latest['show_promotions']) newSettings.showPromotions = latest['show_promotions'] === 'true';
        if (latest['show_brands']) newSettings.showBrands = latest['show_brands'] === 'true';
        if (latest['header_announcement_text']) newSettings.headerAnnouncement = latest['header_announcement_text'] || '';
        if (latest['footer_banner_title']) newSettings.footerBannerTitle = latest['footer_banner_title'] || '';
        if (latest['footer_banner_subtitle']) newSettings.footerBannerSubtitle = latest['footer_banner_subtitle'] || '';
        if (latest['footer_banner_button_text']) newSettings.footerBannerButtonText = latest['footer_banner_button_text'] || '';
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
    } catch (e: any) {
      if (e?.message === 'timeout') {
        console.warn('[ThemeContext] refreshSettings timed out — using default/cached settings');
        // Aplica as cores dos defaults para garantir que o app renderize corretamente
        applyColors(defaultSettings);
      } else {
        console.error('[ThemeContext] refreshSettings error:', e);
        // Não quebra a app se falhar o fetch de settings - usa valores default
        applyColors(defaultSettings);
      }
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
      // If this is a footer-related key, update the dedicated footer_settings table
      if (footerKeys.includes(key)) {
        const footerPayload = {
          id: '00000000-0000-0000-0000-000000000001',
          contact_email: newSettings.contactEmail,
          contact_phone: newSettings.contactPhone,
          contact_hours: newSettings.contactHours,
          social_facebook: newSettings.socialFacebook,
          social_instagram: newSettings.socialInstagram,
          social_twitter: newSettings.socialTwitter,
          logo_url: newSettings.logoUrl || '',
        };

        const { error: footerError } = await supabase
          .from('footer_settings')
          .upsert([footerPayload], { onConflict: 'id' });

        if (footerError) {
          console.error('[ThemeContext] Erro ao atualizar footer_settings:', footerError);
        } else {
          console.log('footer_settings atualizado automaticamente após alteração em:', key);
        }
      } else {
        // Persist generic setting to app_settings for other settings
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
      }

      delete dbTimeouts.current[key];
    }, 1000);
  };

  // Persist all settings at once (called by Save button to ensure a concrete write)
  const saveAllSettings = async (s?: ThemeSettings) => {
    const toSave = s || settings;
    const payload = [
      { key: 'site_background_color', value: toSave.backgroundColor },
      { key: 'site_primary_color', value: toSave.primaryColor },
      { key: 'site_text_color', value: toSave.textColor },
      { key: 'show_hero_banner', value: String(toSave.showHero) },
      { key: 'show_info_section', value: String(toSave.showInfo) },
      { key: 'show_promotions', value: String(toSave.showPromotions) },
      { key: 'show_brands', value: String(toSave.showBrands) },
      { key: 'header_announcement_text', value: toSave.headerAnnouncement },
      { key: 'footer_banner_title', value: toSave.footerBannerTitle },
      { key: 'footer_banner_subtitle', value: toSave.footerBannerSubtitle },
      { key: 'footer_banner_button_text', value: toSave.footerBannerButtonText },
      { key: 'login_title', value: toSave.loginTitle },
      { key: 'login_subtitle', value: toSave.loginSubtitle },
      { key: 'dashboard_greeting', value: toSave.dashboardGreeting },
      { key: 'dashboard_subtitle', value: toSave.dashboardSubtitle },
      { key: 'dashboard_points_label', value: toSave.dashboardPointsLabel },
      { key: 'dashboard_button_text', value: toSave.dashboardButtonText },
      { key: 'maintenance_mode', value: String(toSave.maintenanceMode) },
    ];

    try {
      // First ensure footer_settings row is upserted as canonical source
      const { error: footerError } = await supabase
        .from('footer_settings')
        .upsert([
          {
            id: '00000000-0000-0000-0000-000000000001',
            contact_email: toSave.contactEmail,
            contact_phone: toSave.contactPhone,
            contact_hours: toSave.contactHours,
            social_facebook: toSave.socialFacebook,
            social_instagram: toSave.socialInstagram,
            social_twitter: toSave.socialTwitter,
            logo_url: toSave.logoUrl || '',
          }
        ], { onConflict: 'id' });

      if (footerError) {
        console.error('[ThemeContext] Erro ao salvar footer_settings via saveAllSettings:', footerError);
        throw footerError;
      }

      // SOLUÇÃO DEFINITIVA: Usar upsert com onConflict em vez de delete+insert
      // Isso garante que sempre atualiza a mesma linha e evita race conditions
      for (const row of payload) {
        const { error: rowError } = await supabase
          .from('app_settings')
          .upsert([row], { 
            onConflict: 'key', 
            ignoreDuplicates: false 
          });
        
        if (rowError) {
          console.error(`Erro ao salvar ${row.key}:`, rowError);
          throw new Error(`Falha ao salvar ${row.key}: ${rowError.message}`);
        }
      }
      
      console.log('[ThemeContext] Todas as configurações salvas com sucesso via upsert');
    } catch (e) {
      console.error('[ThemeContext] Erro ao salvar configurações:', e);
      throw e;
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    refreshSettings()
      .catch((e) => {
        console.error('[ThemeContext] refreshSettings failed', e);
      })
      .finally(() => {
        if (isMounted) {
          console.log('[ThemeContext] Settings initialized');
        }
      });
    
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, refreshSettings, updateSetting, saveAllSettings }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;