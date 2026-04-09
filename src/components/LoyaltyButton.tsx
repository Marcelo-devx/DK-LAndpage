import { Gem, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LoyaltyWidget from './LoyaltyWidget';
import { useIsMobile } from '@/hooks/use-mobile';
import { memo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

const LoyaltyButtonContent = memo(() => <LoyaltyWidget />);
LoyaltyButtonContent.displayName = 'LoyaltyButtonContent';

const LoyaltyButton = () => {
  const isMobile = useIsMobile();
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const [availableCouponsCount, setAvailableCouponsCount] = useState(0);
  const [session, setSession] = useState<any>(null);
  const [userPoints, setUserPoints] = useState(0);

  // Buscar cupons disponíveis para resgate
  useEffect(() => {
    const fetchAvailableCoupons = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAvailableCouponsCount(0);
        setExpiringSoonCount(0);
        setSession(null);
        setUserPoints(0);
        return;
      }

      setSession(session);

      try {
        // Buscar pontos do usuário
        const { data: profileData } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', session.user.id)
          .single();

        const points = profileData?.points || 0;
        setUserPoints(points);

        // Buscar cupons ativos
        const { data: coupons } = await supabase
          .from('coupons')
          .select('points_cost, is_active, stock_quantity')
          .eq('is_active', true)
          .gt('stock_quantity', 0);

        // Calcular quantos cupons o usuário pode resgatar
        if (coupons) {
          const affordableCoupons = coupons.filter(c => points >= c.points_cost);
          setAvailableCouponsCount(affordableCoupons.length);
        }

        // Buscar cupons prestes a expirar
        const now = new Date();
        const { data: userCoupons } = await supabase
          .from('user_coupons')
          .select('id, expires_at, is_used')
          .eq('user_id', session.user.id)
          .eq('is_used', false)
          .gt('expires_at', now.toISOString());

        if (userCoupons) {
          const expiring = userCoupons.filter(uc => {
            const daysLeft = differenceInDays(new Date(uc.expires_at), now);
            return daysLeft <= 3 && daysLeft > 0;
          });
          setExpiringSoonCount(expiring.length);
        }
      } catch (error) {
        console.error('[LoyaltyButton] Error fetching coupons:', error);
      }
    };

    fetchAvailableCoupons();

    const handleVisibilityChange = () => {
      fetchAvailableCoupons();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <Popover onOpenChange={(open) => {
      if (open) {
        (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            try {
              // Buscar pontos do usuário
              const { data: profileData } = await supabase
                .from('profiles')
                .select('points')
                .eq('id', session.user.id)
                .single();

              const points = profileData?.points || 0;
              setUserPoints(points);

              // Buscar cupons ativos
              const { data: coupons } = await supabase
                .from('coupons')
                .select('points_cost, is_active, stock_quantity')
                .eq('is_active', true)
                .gt('stock_quantity', 0);

              if (coupons) {
                const affordableCoupons = coupons.filter(c => points >= c.points_cost);
                setAvailableCouponsCount(affordableCoupons.length);
              }

              const now = new Date();
              const { data: userCoupons } = await supabase
                .from('user_coupons')
                .select('id, expires_at, is_used')
                .eq('user_id', session.user.id)
                .eq('is_used', false)
                .gt('expires_at', now.toISOString());

              if (userCoupons) {
                const expiring = userCoupons.filter(uc => {
                  const daysLeft = differenceInDays(new Date(uc.expires_at), now);
                  return daysLeft <= 3 && daysLeft > 0;
                });
                setExpiringSoonCount(expiring.length);
              }
            } catch (error) {
              console.error('[LoyaltyButton] Error fetching coupons on open:', error);
            }
          }
        })();
      }
    }}>
      <PopoverTrigger asChild>
        <button
          className="fixed bottom-6 right-6 z-[99999] rounded-full h-14 w-14 bg-slate-900 text-white shadow-2xl border-2 border-white/20 hover:scale-110 transition-transform flex items-center justify-center group"
          aria-label="Acessar DK Clube Points"
        >
          {/* Badge de cupons disponíveis para resgatar */}
          {availableCouponsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
              {availableCouponsCount}
            </span>
          )}
          
          {/* Badge de cupons prestes a expirar (prioridade menor) */}
          {expiringSoonCount > 0 && availableCouponsCount === 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse">
              {expiringSoonCount}
            </span>
          )}
          
          <Gem className="h-6 w-6 group-hover:text-sky-400 transition-colors" />
          
          {/* Tooltip flutuante à esquerda (apenas desktop) */}
          <span className="absolute right-full mr-4 bg-white text-charcoal-gray text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-stone-100 hidden md:block">
            {availableCouponsCount > 0 ? `${availableCouponsCount} cupons disponíveis` : 'Meus Pontos'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-32px)] sm:w-[380px] p-0 rounded-2xl overflow-hidden border-none shadow-2xl h-[550px] max-h-[85vh] animate-in slide-in-from-bottom-2 duration-300 z-[99999]"
        side="top"
        align="end"
        sideOffset={16}
        collisionPadding={16}
      >
        <LoyaltyButtonContent />
      </PopoverContent>
    </Popover>
  );
};

export default memo(LoyaltyButton);