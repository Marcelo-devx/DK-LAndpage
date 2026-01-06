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
      <div className="space-y-2">
        {section.trim().split('\n').map((line, lineIndex) => (
          <p key={lineIndex} className="text-stone-700 text-center leading-relaxed">
            {line.split('*').map((part, partIndex) => 
              partIndex % 2 === 1 
                ? <strong key={partIndex} className="font-bold text-charcoal-gray">{part}</strong> 
                : part
            )}
          </p>
        ))}
      </div>
      {sectionIndex < sections.length - 1 && <Separator className="my-6 bg-stone-300" />}
    </React.Fragment>
  ));
};

const InformationalPopup = ({ isOpen, onClose, title, content }: InformationalPopupProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-off-white p-6 md:p-8">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl md:text-3xl text-charcoal-gray text-center">{title}</DialogTitle>
        </DialogHeader>
        <div className="my-6">
          {renderContent(content)}
        </div>
        <DialogFooter className="sm:justify-center">
            <Button type="button" onClick={onClose} className="bg-gold-accent hover:bg-gold-accent/90 text-charcoal-gray font-bold">
              Entendi
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InformationalPopup;