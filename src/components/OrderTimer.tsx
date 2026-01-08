import { useEffect, useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderTimerProps {
  createdAt: string;
  onExpire?: () => void;
  className?: string;
}

const OrderTimer = ({ createdAt, onExpire, className }: OrderTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const RESERVATION_TIME_MS = 15 * 60 * 1000; // 15 minutos

  useEffect(() => {
    const calculateTimeLeft = () => {
      const createdDate = new Date(createdAt).getTime();
      const now = new Date().getTime();
      const difference = createdDate + RESERVATION_TIME_MS - now;
      
      return Math.max(0, Math.floor(difference / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt, onExpire]);

  if (timeLeft <= 0) {
    return (
      <div className={cn("bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center space-x-3 text-red-400", className)}>
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-xs font-black uppercase tracking-widest">Reserva Expirada. Os itens voltaram para o estoque.</p>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className={cn("bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl flex items-center justify-between", className)}>
      <div className="flex items-center space-x-3">
        <Clock className="h-5 w-5 text-sky-400" />
        <div>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Reserva de Estoque</p>
          <p className="text-xs text-white font-medium">Seu pedido está garantido por:</p>
        </div>
      </div>
      <div className="text-2xl font-black text-sky-400 tracking-tighter tabular-nums">
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
};

export default OrderTimer;