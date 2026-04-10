import { useEffect, useState } from 'react';
import { Truck, Clock } from 'lucide-react';

const defaultMessages = {
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
          msg = defaultMessages.weekday_before;
        } else {
          msg = defaultMessages.weekday_after;
          isTimerVisible = false;
        }
      } else if (day === 6) {
        deadline = new Date();
        deadline.setHours(12, 30, 0, 0);
        if (now.getTime() <= deadline.getTime()) {
          isTimerVisible = true;
          msg = defaultMessages.saturday_before;
        } else {
          msg = defaultMessages.saturday_after;
          isTimerVisible = false;
        }
      } else {
        msg = defaultMessages.sunday;
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
  }, []);

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
