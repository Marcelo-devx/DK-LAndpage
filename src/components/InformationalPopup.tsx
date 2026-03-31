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
import { Info, X } from "lucide-react";

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
      const classAttr = el.getAttribute('class') || '';

      if (alignAttr && alignAttr.trim().toLowerCase() === 'center') return 'text-center';
      if (/text-align\s*:\s*center/i.test(style)) return 'text-center';

      // Detect common editor classes (Quill, etc.) and utility classes
      if (/ql-align-center|text-center|align-center/i.test(classAttr)) return 'text-center';
      if (/ql-align-right|text-right|align-right/i.test(classAttr)) return 'text-right';
      if (/ql-align-left|text-left|align-left/i.test(classAttr)) return 'text-left';

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
            // For unknown tags, preserve alignment by wrapping children in a div when needed
            if (alignClass) {
              return <div key={idx} className={alignClass}>{children}</div>;
            }
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
        className="relative w-[95vw] sm:max-w-2xl bg-slate-900 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-hidden rounded-[1.5rem] md:rounded-[2rem] max-h-[90vh] md:max-h-[90vh] flex flex-col outline-none [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby="info-popup-desc"
      >
        <DialogDescription className="sr-only">
            Popup com informações importantes sobre a loja.
        </DialogDescription>

        {/* Close button (top-right) - wrapped in a div so it's not hidden by the [&>button]:hidden rule */}
        <div className="absolute top-3 right-3 z-50">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Barra superior de destaque */}
        <div className="h-1.5 md:h-1.5 bg-gradient-to-r from-sky-500 to-indigo-500 w-full shrink-0" />
        
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header com ajuste mobile */}
          <div className="px-4 py-4 md:px-10 md:py-6 flex flex-col flex-shrink-0">
            <DialogHeader className="items-center text-center mb-3 md:mb-6 shrink-0">
              <div className="flex items-center justify-center mb-3 md:mb-4">
                <div className="p-2 md:p-2.5 bg-sky-500/20 rounded-xl md:rounded-2xl">
                  <Info className="h-5 w-5 md:h-7 md:w-7 text-sky-400 shrink-0" />
                </div>
              </div>
              <DialogTitle className="font-black text-xl md:text-4xl text-white tracking-tighter italic uppercase leading-tight text-center break-words">
                {title}.
              </DialogTitle>
            </DialogHeader>

            {/* Área de conteúdo com rolagem otimizada */}
            <div className="flex-1 overflow-y-auto pr-1 md:pr-2 custom-scrollbar" id="info-popup-desc">
              <div className="pb-4">
                {parseHtmlToReact(content)}
              </div>
            </div>
          </div>

          {/* Footer com botões otimizados para mobile */}
          <DialogFooter className="px-4 py-4 md:px-10 md:py-6 flex flex-col sm:flex-row sm:justify-center gap-3 shrink-0">
            {onAccept ? (
              <>
                <Button 
                  type="button" 
                  onClick={handleAccept} 
                  className="w-full sm:w-full md:w-auto bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-11 md:h-14 px-4 md:px-12 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95 text-wrap break-words"
                >
                  Aceitar e Continuar
                </Button>
                <Button 
                  type="button" 
                  onClick={onClose} 
                  variant="ghost"
                  className="w-full sm:w-full md:w-auto bg-white/5 text-white font-black uppercase tracking-widest h-11 md:h-14 px-4 md:px-12 rounded-xl border border-white/10 hover:bg-white/10"
                >
                  Fechar
                </Button>
              </>
            ) : (
              <Button 
                type="button" 
                onClick={onClose} 
                className="w-full sm:w-full md:w-auto bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-11 md:h-14 px-4 md:px-12 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95"
              >
                Entendi
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InformationalPopup;