import { useEffect, useState } from 'react';
import { Truck, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const defaultMessages = {
  weekday_before: "Faça seu pedido antes das 14h para ser enviado ainda hoje! Tempo restante:",
  weekday_after: "Seu pedido será enviado no próximo dia com entrega disponível:",
  saturday_before: "Faça seu pedido antes das 12:30h para ser enviado ainda hoje! Tempo restante:",
  saturday_after: "Seu pedido será enviado no próximo dia com entrega disponível:",
  sunday: "Seu pedido será enviado no próximo dia com entrega disponível:",
  holiday: "Hoje é feriado! Seu pedido será enviado no próximo dia útil.",
  eve: "Amanhã é feriado! Pedidos feitos agora serão enviados após o feriado.",
};

type Messages = typeof defaultMessages;

// Retorna a data local no formato YYYY-MM-DD
const getDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Retorna o nome do próximo dia com entrega (pula domingos e feriados)
const getNextDeliveryDay = (from: Date, holidays: string[]): string => {
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const next = new Date(from);
  next.setDate(next.getDate() + 1);

  // Avança até encontrar um dia que não seja domingo nem feriado
  for (let i = 0; i < 14; i++) {
    const dayOfWeek = next.getDay();
    const dateStr = getDateString(next);
    if (dayOfWeek !== 0 && !holidays.includes(dateStr)) {
      return dayNames[dayOfWeek];
    }
    next.setDate(next.getDate() + 1);
  }
  return 'próximo dia útil';
};

const DeliveryTimerBar = () => {
  const [messages, setMessages] = useState<Messages>(defaultMessages);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [nextDeliveryDay, setNextDeliveryDay] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'timer_weekday_before',
        'timer_weekday_after',
        'timer_saturday_before',
        'timer_saturday_after',
        'timer_sunday',
        'timer_holidays',
        'timer_holiday_message',
        'timer_eve_message',
      ])
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map: Record<string, string> = {};
          data.forEach((row: any) => { map[row.key] = row.value; });

          setMessages({
            weekday_before: map['timer_weekday_before'] || defaultMessages.weekday_before,
            weekday_after: map['timer_weekday_after'] || defaultMessages.weekday_after,
            saturday_before: map['timer_saturday_before'] || defaultMessages.saturday_before,
            saturday_after: map['timer_saturday_after'] || defaultMessages.saturday_after,
            sunday: map['timer_sunday'] || defaultMessages.sunday,
            holiday: map['timer_holiday_message'] || defaultMessages.holiday,
            eve: map['timer_eve_message'] || defaultMessages.eve,
          });

          if (map['timer_holidays']) {
            const list = map['timer_holidays']
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean);
            setHolidays(list);
          }
        }
      });
  }, []);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const today = getDateString(now);

      // Amanhã
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = getDateString(tomorrow);

      const isHoliday = holidays.includes(today);
      const isTomorrowHoliday = holidays.includes(tomorrowStr);

      // Feriado hoje → sem timer, mensagem de feriado
      if (isHoliday) {
        setMessage(messages.holiday);
        setShowTimer(false);
        setTimeLeft(null);
        setNextDeliveryDay(null);
        return;
      }

      const day = now.getDay();
      let deadline = new Date();
      let isTimerVisible = false;
      let msg = '';
      let showNextDay = false;

      if (day >= 1 && day <= 5) {
        // Seg–Sex
        deadline = new Date();
        deadline.setHours(14, 0, 0, 0);

        if (now.getTime() <= deadline.getTime()) {
          isTimerVisible = true;
          msg = messages.weekday_before;
          showNextDay = false;
        } else {
          if (isTomorrowHoliday) {
            msg = messages.eve;
            showNextDay = false;
          } else {
            msg = messages.weekday_after;
            showNextDay = true;
          }
          isTimerVisible = false;
        }
      } else if (day === 6) {
        // Sábado
        deadline = new Date();
        deadline.setHours(12, 30, 0, 0);

        if (now.getTime() <= deadline.getTime()) {
          isTimerVisible = true;
          msg = messages.saturday_before;
          showNextDay = false;
        } else {
          if (isTomorrowHoliday) {
            msg = messages.eve;
            showNextDay = false;
          } else {
            msg = messages.saturday_after;
            showNextDay = true;
          }
          isTimerVisible = false;
        }
      } else {
        // Domingo
        if (isTomorrowHoliday) {
          msg = messages.eve;
          showNextDay = false;
        } else {
          msg = messages.sunday;
          showNextDay = true;
        }
        isTimerVisible = false;
      }

      setMessage(msg);
      setShowTimer(isTimerVisible);
      setNextDeliveryDay(showNextDay ? getNextDeliveryDay(now, holidays) : null);

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
  }, [messages, holidays]);

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
        {nextDeliveryDay && (
          <span className="bg-slate-950/20 px-2 py-0.5 rounded-md font-black border border-slate-950/10">
            {nextDeliveryDay}
          </span>
        )}
      </div>
    </div>
  );
};

export default DeliveryTimerBar;