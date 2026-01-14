import { useEffect, useState } from 'react';
import { Truck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const DeliveryTimerBar = () => {
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const day = now.getDay(); // 0 = Domingo, 6 = Sábado
      let deadline = new Date();
      let showTimer = false;
      let msg = "";
      let urgent = false;

      // Lógica de horários
      if (day >= 1 && day <= 5) { // Segunda a Sexta
        deadline.setHours(14, 0, 0, 0); // 14:00
        if (now < deadline) {
          showTimer = true;
          msg = "Peça antes das 14h para envio hoje!";
          urgent = true;
        } else {
          msg = "Pedidos feitos agora serão enviados na próxima rota.";
        }
      } else if (day === 6) { // Sábado
        deadline.setHours(12, 30, 0, 0); // 12:30
        if (now < deadline) {
          showTimer = true;
          msg = "Peça antes das 12:30h para envio hoje!";
          urgent = true;
        } else {
          msg = "Pedidos feitos agora serão enviados na próxima rota (Segunda-feira).";
        }
      } else { // Domingo
        msg = "Hoje é Domingo. Seu pedido será enviado no próximo dia útil!";
      }

      setMessage(msg);
      setIsUrgent(urgent);

      if (showTimer) {
        const diff = deadline.getTime() - now.getTime();
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setTimeLeft(formattedTime);
      } else {
        setTimeLeft(null);
      }
    };

    // Atualiza imediatamente e depois a cada segundo
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn(
      "w-full py-2 px-4 flex justify-center items-center text-center text-[10px] md:text-xs font-bold uppercase tracking-widest transition-colors duration-300",
      isUrgent 
        ? "bg-sky-500 text-slate-950" 
        : "bg-slate-900 text-slate-400 border-b border-white/5"
    )}>
      <div className="flex items-center gap-2">
        {isUrgent ? <Clock className="h-3 w-3 md:h-4 md:w-4 animate-pulse" /> : <Truck className="h-3 w-3 md:h-4 md:w-4" />}
        <span>{message}</span>
        {timeLeft && (
          <span className="bg-black/20 px-1.5 py-0.5 rounded ml-1 font-black tabular-nums">
            {timeLeft}
          </span>
        )}
      </div>
    </div>
  );
};

export default DeliveryTimerBar;