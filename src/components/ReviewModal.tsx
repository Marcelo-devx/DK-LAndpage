import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StarRating from './StarRating';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Star } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  orderId: number;
  productName: string;
  onReviewSubmitted: () => void;
}

const ReviewModal = ({ isOpen, onOpenChange, productId, orderId, productName, onReviewSubmitted }: ReviewModalProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      showError("Por favor, selecione uma avaliação de 1 a 5 estrelas.");
      return;
    }
    setIsSubmitting(true);
    const toastId = showLoading("Enviando seu veredito...");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showError("Você precisa estar logado para avaliar.");
      setIsSubmitting(false);
      dismissToast(toastId);
      return;
    }

    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      order_id: orderId,
      user_id: user.id,
      rating,
      comment,
    });

    dismissToast(toastId);
    if (error) {
      showError("Ocorreu um erro ao enviar sua avaliação.");
    } else {
      showSuccess("Avaliação enviada! Em breve ela estará no ar.");
      onReviewSubmitted();
      onOpenChange(false);
      setRating(0);
      setComment('');
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-slate-950 border-white/10 text-white">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-yellow-400/20 rounded-lg">
                <Star className="h-5 w-5 text-yellow-400" />
            </div>
            <DialogTitle className="font-black text-2xl tracking-tighter italic uppercase">Avaliar Produto.</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 font-medium">
            Sua opinião é fundamental para nossa curadoria: <span className="text-white font-bold">{productName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 space-y-8">
          <div className="space-y-4">
            <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Sua Nota</Label>
            <div className="bg-white/5 p-6 rounded-2xl flex justify-center border border-white/5">
                <StarRating rating={rating} onRatingChange={setRating} size={40} />
            </div>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="comment" className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Seu Comentário (opcional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conte-nos sua experiência com o produto..."
              className="bg-slate-950 border-white/10 rounded-xl min-h-[120px] focus:border-sky-500 transition-colors placeholder:text-slate-700"
            />
          </div>
        </div>

        <DialogFooter className="gap-3 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-500 hover:text-white hover:bg-white/5 rounded-xl font-bold uppercase text-[10px] tracking-widest h-12">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0} className="bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-12 px-8 rounded-xl shadow-lg transition-all">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Publicar Avaliação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewModal;