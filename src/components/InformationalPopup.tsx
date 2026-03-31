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

// Parse limited safe HTML and convert to React nodes. Allows these tags: p, br, ul, ol, li, strong, b, em, i, u, a
const parseHtmlToReact = (html: string) => {
  if (!html) return null;
  try {
    const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
    const doc = parser ? parser.parseFromString(html, 'text/html') : null;
    const root = doc ? doc.body : null;

    const isSafeHref = (href: string | null) => {
      if (!href) return false;
      const trimmed = href.trim().toLowerCase();
      return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:') || trimmed.startsWith('#');
    };

    const getAlignmentClass = (el: Element) => {
      const alignAttr = el.getAttribute('align');
      const style = el.getAttribute('style') || '';
      if (alignAttr && alignAttr.trim().toLowerCase() === 'center') return 'text-center';
      if (/text-align\s*:\s*center/i.test(style)) return 'text-center';
      return '';
    };

    const walk = (node: ChildNode, idx: number): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        const children = Array.from(el.childNodes).map((n, i) => walk(n, i));
        const alignClass = getAlignmentClass(el);

        switch (tag) {
          case 'p':
            return <p key={idx} className={`text-slate-300 text-sm md:text-base leading-relaxed mb-3 ${alignClass}`.trim()}>{children}</p>;
          case 'br':
            return <br key={idx} />;
          case 'ul':
            return <ul key={idx} className={`list-disc list-inside ml-4 text-slate-300 text-sm md:text-base leading-relaxed ${alignClass}`.trim()}>{children}</ul>;
          case 'ol':
            return <ol key={idx} className={`list-decimal list-inside ml-4 text-slate-300 text-sm md:text-base leading-relaxed ${alignClass}`.trim()}>{children}</ol>;
          case 'li':
            return <li key={idx} className={`${alignClass} mb-1`.trim()}>{children}</li>;
          case 'strong':
          case 'b':
            return <strong key={idx} className="font-black text-white">{children}</strong>;
          case 'em':
          case 'i':
            return <em key={idx} className="italic">{children}</em>;
          case 'u':
            return <u key={idx}>{children}</u>;
          case 'a': {
            const href = el.getAttribute('href');
            if (isSafeHref(href)) {
              return (
                <a key={idx} href={href || undefined} target={href && href.startsWith('#') ? undefined : '_blank'} rel={href && href.startsWith('#') ? undefined : 'noopener noreferrer'} className="text-sky-400 underline">
                  {children}
                </a>
              );
            }
            // if not safe, render children only
            return <>{children}</>;
          }
          default:
            // For unknown tags, render their children (strip tag)
            return <React.Fragment key={idx}>{children}</React.Fragment>;
        }
      }

      return null;
    };

    const nodes = Array.from(root.childNodes).map((n, i) => walk(n, i));
    return <div className="space-y-2">{nodes}</div>;
  } catch (e) {
    // fallback: plain text with simple line breaks
    const plain = html.replace(/<[^>]*>/g, '');
    return plain.split(/\r?\n/).map((line, i) => (
      <p key={i} className="text-slate-300 text-sm md:text-base leading-relaxed mb-2">{line}</p>
    ));
  }
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
              <DialogTitle className="font-black text-lg md:text-4xl text-white tracking-tighter italic uppercase px-2 leading-tight text-center">
                {title}.
              </DialogTitle>
            </DialogHeader>

            {/* Área de conteúdo com rolagem otimizada */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar" id="info-popup-desc">
              <div className="pb-4">
                {parseHtmlToReact(content)}
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