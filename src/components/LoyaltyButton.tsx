import { Gem } from 'lucide-react';
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
  const [session, setSession] = useState<any>(null);

  // Buscar cupons prestes a expirar
  useEffect(() => {
    const fetchExpiringCoupons = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setExpiringSoonCount(0);
        setSession(null);
        return;
      }

      setSession(session);

      try {
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
        console.error('[LoyaltyButton] Error fetching expiring coupons:', error);
      }
    };

    fetchExpiringCoupons();

    // Opcional: recarregar quando popover abre/fecha
    const handleVisibilityChange = () => {
      fetchExpiringCoupons();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <Popover onOpenChange={(open) => {
      if (open) {
        // Recarregar cupons quando popover abre
        (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            try {
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
              console.error('[LoyaltyButton] Error fetching expiring coupons:', error);
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
          {/* Badge de cupons prestes a expirar */}
          {expiringSoonCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse">
              {expiringSoonCount}
            </span>
          )}
          
          <Gem className="h-6 w-6 group-hover:text-sky-400 transition-colors" />
          
          {/* Tooltip flutuante à esquerda (apenas desktop) */}
          <span className="absolute right-full mr-4 bg-white text-charcoal-gray text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-stone-100 hidden md:block">
            Meus Pontos
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        // Sempre abre para cima em todas as telas para não cobrir o botão
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