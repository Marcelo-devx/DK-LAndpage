import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

const BackButton = ({ className }: { className?: string }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    // If there's history, go back; otherwise go to home
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <Button onClick={handleBack} variant="ghost" size="icon" className={className || 'h-10 w-10 rounded-lg bg-white/5 text-white hover:bg-white/10'}>
      <ChevronLeft className="h-4 w-4" />
    </Button>
  );
};

export default BackButton;
