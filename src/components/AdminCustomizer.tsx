import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Palette, Layout, Type, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (data?.role === 'adm') {
          setIsAdmin(true);
        }
      }
    };
    checkAdmin();
  }, []);

  if (!isAdmin) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          className="fixed bottom-6 left-6 z-50 rounded-full h-14 w-14 bg-slate-900 text-white shadow-2xl border-2 border-white/20 hover:scale-110 transition-transform"
          size="icon"
        >
          <Settings className="h-6 w-6 animate-spin-slow" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[400px] overflow-y-auto bg-white/95 backdrop-blur-md">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-black uppercase italic tracking-tighter">Editor Visual</SheetTitle>
          <SheetDescription>
            Personalize a aparência da loja em tempo real.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="colors" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="colors"><Palette className="h-4 w-4 mr-2" /> Cores</TabsTrigger>
            <TabsTrigger value="layout"><Layout className="h-4 w-4 mr-2" /> Layout</TabsTrigger>
            <TabsTrigger value="content"><Type className="h-4 w-4 mr-2" /> Texto</TabsTrigger>
          </TabsList>

          <TabsContent value="colors" className="space-y-6">
            <div className="space-y-2">
              <Label>Cor de Fundo do Site</Label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={settings.backgroundColor} 
                  onChange={(e) => updateSetting('site_background_color', e.target.value)}
                  className="w-12 h-12 p-1 rounded-lg cursor-pointer" 
                />
                <Input 
                  type="text" 
                  value={settings.backgroundColor} 
                  onChange={(e) => updateSetting('site_background_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor Primária (Botões/Destaques)</Label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={settings.primaryColor} 
                  onChange={(e) => updateSetting('site_primary_color', e.target.value)}
                  className="w-12 h-12 p-1 rounded-lg cursor-pointer" 
                />
                <Input 
                  type="text" 
                  value={settings.primaryColor} 
                  onChange={(e) => updateSetting('site_primary_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor do Texto Principal</Label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={settings.textColor} 
                  onChange={(e) => updateSetting('site_text_color', e.target.value)}
                  className="w-12 h-12 p-1 rounded-lg cursor-pointer" 
                />
                <Input 
                  type="text" 
                  value={settings.textColor} 
                  onChange={(e) => updateSetting('site_text_color', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50">
              <Label htmlFor="hero-toggle" className="font-bold">Banner Principal</Label>
              <Switch 
                id="hero-toggle" 
                checked={settings.showHero}
                onCheckedChange={(checked) => updateSetting('show_hero_banner', String(checked))}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50">
              <Label htmlFor="info-toggle" className="font-bold">Faixa Informativa</Label>
              <Switch 
                id="info-toggle" 
                checked={settings.showInfo}
                onCheckedChange={(checked) => updateSetting('show_info_section', String(checked))}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50">
              <Label htmlFor="brands-toggle" className="font-bold">Carrossel de Marcas</Label>
              <Switch 
                id="brands-toggle" 
                checked={settings.showBrands}
                onCheckedChange={(checked) => updateSetting('show_brands', String(checked))}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50">
              <Label htmlFor="promo-toggle" className="font-bold">Seção de Promoções</Label>
              <Switch 
                id="promo-toggle" 
                checked={settings.showPromotions}
                onCheckedChange={(checked) => updateSetting('show_promotions', String(checked))}
              />
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <div className="space-y-2">
              <Label>URL do Logo</Label>
              <Input 
                value={settings.logoUrl || ''} 
                onChange={(e) => updateSetting('logo_url', e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>Anúncio no Topo (Barra de Timer)</Label>
              <Input 
                value={settings.headerAnnouncement} 
                onChange={(e) => updateSetting('header_announcement_text', e.target.value)}
                placeholder="Ex: Frete Grátis acima de R$ 200"
              />
              <p className="text-xs text-slate-500">
                Deixe em branco para usar o timer de entrega padrão.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 pt-6 border-t">
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => showSuccess('Alterações salvas e aplicadas!')}>
                <Save className="mr-2 h-4 w-4" /> Concluir Edição
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminCustomizer;