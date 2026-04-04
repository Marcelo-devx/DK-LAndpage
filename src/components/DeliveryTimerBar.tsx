import { useEffect, useState } from 'react';
import { Truck, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TimerMessages {
  weekday_before: string;
  weekday_after: string;
  saturday_before: string;
  saturday_after: string;
  sunday: string;
}

const defaultMessages: TimerMessages = {
  weekday_before: "Faça seu pedido antes das 14h para ser enviado ainda hoje! Tempo restante:",
  weekday_after: "Fazendo seu pedido após as 14h será enviado na próxima rota!",
  saturday_before: "Faça seu pedido antes das 12:30h para ser enviado ainda hoje! Tempo restante:",
  saturday_after: "Fazendo o pedido após as 12:30h será enviado na próxima rota!",
  sunday: "Hoje é Domingo. Seu pedido será enviado no próximo dia útil!",
};

const DeliveryTimerBar = () => {
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [messages, setMessages] = useState<TimerMessages>(defaultMessages);

  useEffect(() => {
    const fetchMessages = async () => {
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
        data.forEach((row) => { map[row.key] = row.value; });
        setMessages({
          weekday_before: map['timer_weekday_before'] || defaultMessages.weekday_before,
          weekday_after: map['timer_weekday_after'] || defaultMessages.weekday_after,
          saturday_before: map['timer_saturday_before'] || defaultMessages.saturday_before,
          saturday_after: map['timer_saturday_after'] || defaultMessages.saturday_after,
          sunday: map['timer_sunday'] || defaultMessages.sunday,
        });
      }
    };

    fetchMessages();
  }, []);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const day = now.getDay();
      let deadline = new Date();
      let isTimerVisible = false;
      let msg = "";

      if (day >= 1 && day <= 5) {
        deadline = new Date();
        deadline.setHours(14, 0, 0, 0);
        
        if (now.getTime() <= deadline.getTime()) {
          isTimerVisible = true;
          msg = messages.weekday_before;
        } else {
          msg = messages.weekday_after;
          isTimerVisible = false;
        }
      } else if (day === 6) {
        deadline = new Date();
        deadline.setHours(12, 30, 0, 0);
        
        if (now.getTime() <= deadline.getTime()) {
          isTimerVisible = true;
          msg = messages.saturday_before;
        } else {
          msg = messages.saturday_after;
          isTimerVisible = false;
        }
      } else {
        msg = messages.sunday;
        isTimerVisible = false;
      }

      setMessage(msg);
      setShowTimer(isTimerVisible);

      if (isTimerVisible) {
        const diff = deadline.getTime() - now.getTime();
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [messages]);

  return (
    <div className="w-full py-2.5 md:py-3 xl:py-3.5 px-4 flex justify-center items-center text-center font-black uppercase tracking-widest shadow-lg relative z-50 bg-yellow-400 text-slate-900">
      <div className="flex flex-wrap justify-center items-center gap-2 text-[10px] md:text-xs xl:text-sm leading-tight">
        {showTimer ? (
          <Clock className="h-4 w-4 md:h-5 md:w-5 xl:h-5 xl:w-5 animate-pulse shrink-0" strokeWidth={2.5} />
        ) : (
          <Truck className="h-4 w-4 md:h-5 md:w-5 xl:h-5 xl:w-5 shrink-0" strokeWidth={2.5} />
        )}
        <span>{message}</span>
        {showTimer && timeLeft && (
          <span className="bg-slate-950/20 px-2 py-0.5 rounded-md font-black tabular-nums border border-slate-950/10 inline-block min-w-[70px] xl:min-w-[80px]">
            {timeLeft}
          </span>
        )}
      </div>
    </div>
  );
};

export default DeliveryTimerBar;