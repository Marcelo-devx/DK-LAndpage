import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import React from "react";
import { Button } from "@/components/ui/button";
import { Info, X } from "lucide-react";

interface InformationalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

const renderContent = (text: string) => {
  if (!text) return null;

  const sections = text.split('---');
  
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

const InformationalPopup = ({ isOpen, onClose, title, content }: InformationalPopupProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl bg-slate-900 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-hidden rounded-[1.5rem] md:rounded-[2rem] max-h-[85vh] md:max-h-[90vh] flex flex-col outline-none">
        {/* Barra superior de destaque */}
        <div className="h-1.5 bg-gradient-to-r from-sky-500 to-indigo-500 w-full shrink-0" />
        
        {/* Botão de fechar (X) mais proeminente no mobile */}
        <button 
          onClick={onClose}
          className="absolute right-3 top-4 text-slate-500 hover:text-white transition-colors z-[60] p-2"
          aria-label="Fechar"
        >
          <X className="h-5 w-5 md:h-6 md:w-6" />
        </button>

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
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              <div className="pb-4">
                {renderContent(content)}
              </div>
            </div>

            <DialogFooter className="mt-4 md:mt-10 sm:justify-center shrink-0">
              <Button 
                type="button" 
                onClick={onClose} 
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-12 md:h-14 px-10 md:px-12 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95"
              >
                Entendi
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InformationalPopup;