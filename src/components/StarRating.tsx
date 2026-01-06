import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: number;
  className?: string;
}

const StarRating = ({ rating, onRatingChange, readOnly = false, size = 20, className }: StarRatingProps) => {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {stars.map((starValue) => (
        <Star
          key={starValue}
          size={size}
          className={cn(
            'transition-colors',
            starValue <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300',
            !readOnly && 'cursor-pointer hover:text-yellow-300'
          )}
          onClick={() => !readOnly && onRatingChange?.(starValue)}
        />
      ))}
    </div>
  );
};

export default StarRating;