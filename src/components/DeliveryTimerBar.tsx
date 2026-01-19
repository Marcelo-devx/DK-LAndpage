import { useEffect, useState } from 'react';
import { Truck, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

const DeliveryTimerBar = () => {
  const { settings } = useTheme();
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    // Se houver anúncio personalizado no painel (e não for vazio), usa ele
    if (settings.headerAnnouncement && settings.headerAnnouncement.trim() !== '') {
      setMessage(settings.headerAnnouncement);
      setTimeLeft(null);
      setIsUrgent(true);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const day = now.getDay();
      let deadline = new Date();
      let showTimer = false;
      let msg = "";
      let urgent = false; // Define se a cor de fundo será azul (urgente) ou roxo (info)

      // Segunda a Sexta (1 a 5)
      if (day >= 1 && day <= 5) {
        deadline = new Date();
        deadline.setHours(14, 0, 0, 0);
        
        if (now.getTime() <= deadline.getTime()) {
          showTimer = true;
          msg = "Faça seu pedido antes das 14h para ser enviado ainda hoje! Tempo restante:";
          urgent = true; // Azul
        } else {
          msg = "Fazendo seu pedido após as 14h será enviado na próxima rota!";
          urgent = false; // Roxo
        }
      } 
      // Sábado (6)
      else if (day === 6) {
        deadline = new Date();
        deadline.setHours(12, 30, 0, 0);
        
        if (now.getTime() <= deadline.getTime()) {
          showTimer = true;
          msg = "Faça seu pedido antes das 12:30h para ser enviado ainda hoje! Tempo restante:";
          urgent = true; // Azul
        } else {
          msg = "Fazendo o pedido após as 12:30h será enviado na próxima rota!.";
          urgent = false; // Roxo
        }
      } 
      // Domingo (0)
      else {
        msg = "Hoje é Domingo. Seu pedido será enviado no próximo dia útil!";
        urgent = false; // Roxo
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

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [settings.headerAnnouncement]);

  return (
    <div className={cn(
      "w-full py-3 px-4 flex justify-center items-center text-center font-black uppercase tracking-widest transition-all duration-300 shadow-lg relative z-50",
      isUrgent 
        ? "bg-sky-500 text-slate-950" 
        : "bg-indigo-600 text-white"
    )}>
      <div className="flex flex-wrap justify-center items-center gap-2 text-[10px] md:text-xs leading-tight">
        {settings.headerAnnouncement && settings.headerAnnouncement.trim() !== '' ? (
            <Info className="h-4 w-4 md:h-5 md:w-5 shrink-0" strokeWidth={2.5} />
        ) : isUrgent ? (
          <Clock className="h-4 w-4 md:h-5 md:w-5 animate-pulse shrink-0" strokeWidth={2.5} />
        ) : (
          <Truck className="h-4 w-4 md:h-5 md:w-5 shrink-0" strokeWidth={2.5} />
        )}
        
        <span className={cn(
          (!settings.headerAnnouncement || settings.headerAnnouncement.trim() === '') && isUrgent && "animate-pulse"
        )}>
          {message}
        </span>
        
        {timeLeft && (
          <span className="bg-slate-950/20 px-2 py-0.5 rounded-md font-black tabular-nums border border-slate-950/10 inline-block min-w-[70px]">
            {timeLeft}
          </span>
        )}
      </div>
    </div>
  );
};

export default DeliveryTimerBar;