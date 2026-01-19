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
}

interface ThemeContextType {
  settings: ThemeSettings;
  refreshSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
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
  socialTwitter: '#'
};

const ThemeContext = createContext<ThemeContextType>({
  settings: defaultSettings,
  refreshSettings: async () => {},
  updateSetting: async () => {},
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
    const { data } = await supabase.from('app_settings').select('key, value');
    
    if (data) {
      const newSettings = { ...defaultSettings };
      
      data.forEach(item => {
        if (item.key === 'site_background_color') newSettings.backgroundColor = item.value || '#F4EEE3';
        if (item.key === 'site_primary_color') newSettings.primaryColor = item.value || '#0ea5e9';
        if (item.key === 'site_text_color') newSettings.textColor = item.value || '#0f172a';
        if (item.key === 'show_hero_banner') newSettings.showHero = item.value === 'true';
        if (item.key === 'show_info_section') newSettings.showInfo = item.value === 'true';
        if (item.key === 'show_promotions') newSettings.showPromotions = item.value === 'true';
        if (item.key === 'show_brands') newSettings.showBrands = item.value === 'true';
        if (item.key === 'header_announcement_text') newSettings.headerAnnouncement = item.value || '';
        if (item.key === 'logo_url') newSettings.logoUrl = item.value;
        if (item.key === 'footer_banner_title') newSettings.footerBannerTitle = item.value || '';
        if (item.key === 'footer_banner_subtitle') newSettings.footerBannerSubtitle = item.value || '';
        if (item.key === 'footer_banner_button_text') newSettings.footerBannerButtonText = item.value || '';
        if (item.key === 'contact_email') newSettings.contactEmail = item.value || '';
        if (item.key === 'contact_phone') newSettings.contactPhone = item.value || '';
        if (item.key === 'contact_hours') newSettings.contactHours = item.value || '';
        if (item.key === 'social_facebook') newSettings.socialFacebook = item.value || '';
        if (item.key === 'social_instagram') newSettings.socialInstagram = item.value || '';
        if (item.key === 'social_twitter') newSettings.socialTwitter = item.value || '';
      });

      setSettings(newSettings);
      applyColors(newSettings);
    }
  };

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
      'social_twitter': 'socialTwitter'
    };

    const settingKey = mapKey[key];
    if (settingKey) {
        let finalValue: any = value;
        if (['showHero', 'showInfo', 'showPromotions', 'showBrands'].includes(settingKey)) {
            finalValue = value === 'true';
        }

        const newSettings = { ...settings, [settingKey]: finalValue };
        setSettings(newSettings);
        applyColors(newSettings);
    }

    // 2. Atualização Debounced no Banco de Dados (espera 1s após parar de digitar)
    if (dbTimeouts.current[key]) {
      clearTimeout(dbTimeouts.current[key]);
    }

    dbTimeouts.current[key] = setTimeout(async () => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value });

      if (error) console.error(`Erro ao salvar ${key}:`, error);
      delete dbTimeouts.current[key];
    }, 1000);
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, refreshSettings, updateSetting }}>
      {children}
    </ThemeContext.Provider>
  );
};