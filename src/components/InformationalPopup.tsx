import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import React from "react";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

interface InformationalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  // optional accept action (e.g., accept terms)
  onAccept?: () => void;
}

// Helper: sanitize and decode HTML so raw tags like <p> don't appear in the UI
const sanitizeText = (input: string) => {
  if (!input) return '';
  // If running in browser, use a temporary element to decode entities and strip tags
  try {
    if (typeof document !== 'undefined') {
      const tmp = document.createElement('div');
      // Set as HTML to allow decoding entities
      tmp.innerHTML = input;
      // textContent gives decoded text with tags removed
      return tmp.textContent || tmp.innerText || '';
    }
  } catch (e) {
    // fallback to a simple regex removal if DOM unavailable
    return input.replace(/<[^>]*>/g, '');
  }
  return input.replace(/<[^>]*>/g, '');
};

const renderContent = (text: string) => {
  if (!text) return null;

  // First sanitize the incoming content so HTML tags (e.g. <p>) don't show raw
  const cleaned = sanitizeText(text);

  const sections = cleaned.split('---');
  
  return sections.map((section, sectionIndex) => (
    <React.Fragment key={sectionIndex}>
      <div className="space-y-3">
        {section.trim().split('\n').map((line, lineIndex) => (
          <p key={lineIndex} className="text-slate-300 text-sm md:text-base leading-relaxed">
            {line.split('*').map((part, partIndex) => 
              partIndex % 2 === 1 
                ? <strong key={partIndex} className="font-black text-white bg-sky-500/20 px-1 rounded">{part}</strong> 
                : part
            )}
          </p>
        ))}
      </div>
      {sectionIndex < sections.length - 1 && (
        <div className="py-4">
          <Separator className="bg-white/10" />
        </div>
      )}
    </React.Fragment>
  ));
};

const InformationalPopup = ({ isOpen, onClose, title, content, onAccept }: InformationalPopupProps) => {
  const handleAccept = () => {
    if (onAccept) onAccept();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[95vw] sm:max-w-2xl bg-slate-900 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-hidden rounded-[1.5rem] md:rounded-[2rem] max-h-[85vh] md:max-h-[90vh] flex flex-col outline-none [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby="info-popup-desc"
      >
        <DialogDescription className="sr-only">
            Popup com informações importantes sobre a loja.
        </DialogDescription>

        {/* Barra superior de destaque */}
        <div className="h-1.5 bg-gradient-to-r from-sky-500 to-indigo-500 w-full shrink-0" />
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 md:p-10 flex flex-col flex-1 min-h-0">
            <DialogHeader className="items-center text-center mb-4 md:mb-8 shrink-0">
              <div className="p-2.5 md:p-3 bg-sky-500/20 rounded-xl md:rounded-2xl mb-3 md:mb-4">
                <Info className="h-5 w-5 md:h-8 md:w-8 text-sky-400" />
              </div>
              <DialogTitle className="font-black text-lg md:text-4xl text-white tracking-tighter italic uppercase px-2 leading-tight">
                {title}.
              </DialogTitle>
            </DialogHeader>

            {/* Área de conteúdo com rolagem otimizada */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar" id="info-popup-desc">
              <div className="pb-4">
                {renderContent(content)}
              </div>
            </div>

            <DialogFooter className="mt-4 md:mt-10 sm:justify-center shrink-0 flex gap-3">
              {onAccept ? (
                <>
                  <Button 
                    type="button" 
                    onClick={handleAccept} 
                    className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-12 md:h-14 px-10 md:px-12 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95"
                  >
                    Aceitar e Continuar
                  </Button>
                  <Button 
                    type="button" 
                    onClick={onClose} 
                    variant="ghost"
                    className="w-full sm:w-auto bg-white/5 text-white font-black uppercase tracking-widest h-12 md:h-14 px-10 md:px-12 rounded-xl border border-white/5"
                  >
                    Fechar
                  </Button>
                </>
              ) : (
                <Button 
                  type="button" 
                  onClick={onClose} 
                  className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-12 md:h-14 px-10 md:px-12 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95"
                >
                  Entendi
                </Button>
              )}
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InformationalPopup;