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
import { Info } from "lucide-react";

interface InformationalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

const renderContent = (text: string) => {
  if (!text) return null;

  // Split by sections using '---'
  const sections = text.split('---');
  
  return sections.map((section, sectionIndex) => (
    <React.Fragment key={sectionIndex}>
      <div className="space-y-4">
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
        <div className="py-6">
          <Separator className="bg-white/10" />
        </div>
      )}
    </React.Fragment>
  ));
};

const InformationalPopup = ({ isOpen, onClose, title, content }: InformationalPopupProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-slate-900 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-hidden rounded-[2rem]">
        {/* Header Decorativo */}
        <div className="h-2 bg-gradient-to-r from-sky-500 to-indigo-500 w-full" />
        
        <div className="p-8 md:p-10">
          <DialogHeader className="items-center text-center mb-8">
            <div className="p-3 bg-sky-500/20 rounded-2xl mb-4">
              <Info className="h-8 w-8 text-sky-400" />
            </div>
            <DialogTitle className="font-black text-2xl md:text-3xl text-white tracking-tighter italic uppercase">
              {title}.
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {renderContent(content)}
          </div>

          <DialogFooter className="mt-10 sm:justify-center">
            <Button 
              type="button" 
              onClick={onClose} 
              className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-14 px-12 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95"
            >
              Entendi
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InformationalPopup;