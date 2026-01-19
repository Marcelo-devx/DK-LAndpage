import React, { createContext, useContext, useEffect, useState } from 'react';
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
  logoUrl: null
};

const ThemeContext = createContext<ThemeContextType>({
  settings: defaultSettings,
  refreshSettings: async () => {},
  updateSetting: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<ThemeSettings>(defaultSettings);

  const applyColors = (s: ThemeSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--color-off-white', s.backgroundColor);
    root.style.setProperty('--color-gold-accent', s.primaryColor); // Usando a variável de "sotaque"
    root.style.setProperty('--color-charcoal-gray', s.textColor);
    
    // Atualiza também o background-color do body para garantir
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
      });

      setSettings(newSettings);
      applyColors(newSettings);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    // Atualiza localmente para feedback instantâneo
    const mapKey: Record<string, keyof ThemeSettings> = {
      'site_background_color': 'backgroundColor',
      'site_primary_color': 'primaryColor',
      'site_text_color': 'textColor',
      'show_hero_banner': 'showHero',
      'show_info_section': 'showInfo',
      'show_promotions': 'showPromotions',
      'show_brands': 'showBrands',
      'header_announcement_text': 'headerAnnouncement',
      'logo_url': 'logoUrl'
    };

    const settingKey = mapKey[key];
    if (settingKey) {
        // Lógica específica para booleanos
        let finalValue: any = value;
        if (['showHero', 'showInfo', 'showPromotions', 'showBrands'].includes(settingKey)) {
            finalValue = value === 'true';
        }

        const newSettings = { ...settings, [settingKey]: finalValue };
        setSettings(newSettings);
        applyColors(newSettings);
    }

    // Salva no banco
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value });

    if (error) console.error('Erro ao salvar configuração:', error);
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