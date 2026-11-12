import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export default function DoublePointsCartBanner({ isOpen }: { isOpen: boolean }) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsActive(false);
      return;
    }

    let cancelled = false;
    const checkPromotion = async () => {
      const { data, error } = await supabase.rpc('is_double_points_day');
      if (!cancelled) setIsActive(!error && data === true);
    };

    void checkPromotion();
    const interval = window.setInterval(checkPromotion, 60_000);
    window.addEventListener('focus', checkPromotion);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkPromotion);
    };
  }, [isOpen]);

  if (!isOpen || !isActive) return null;

  return (
    <Alert className="mb-4 shrink-0 border-amber-200 bg-amber-50 text-amber-950" role="status">
      <Gift className="h-5 w-5 text-amber-600" />
      <AlertTitle className="font-black">Hoje tem pontos em dobro! 🎉</AlertTitle>
      <AlertDescription className="text-xs leading-relaxed text-amber-900">
        Ganhe 2x os pontos de fidelidade nos pedidos com pagamento confirmado hoje,
        no horário de Brasília. Os pontos serão creditados após a entrega,
        conforme as regras do programa.
      </AlertDescription>
    </Alert>
  );
}
