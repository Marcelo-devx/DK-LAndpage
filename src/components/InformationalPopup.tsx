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
            return <p key={idx} className={`text-slate-300 text-xs md:text-base leading-relaxed mb-2 md:mb-3 ${alignClass}`.trim()}>{children}</p>;
          case 'br':
            return <br key={idx} />;
          case 'ul':
            return <ul key={idx} className={`list-disc list-inside ml-2 md:ml-4 text-slate-300 text-xs md:text-base leading-relaxed ${alignClass}`.trim()}>{children}</ul>;
          case 'ol':
            return <ol key={idx} className={`list-decimal list-inside ml-2 md:ml-4 text-slate-300 text-xs md:text-base leading-relaxed ${alignClass}`.trim()}>{children}</ol>;
          case 'li':
            return <li key={idx} className={`${alignClass} mb-1 md:mb-1.5`.trim()}>{children}</li>;
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
            return <>{children}</>;
          }
          default:
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
    const plain = html.replace(/<[^>]*>/g, '');
    return plain.split(/\r?\n/).map((line, i) => (
      <p key={i} className="text-slate-300 text-xs md:text-base leading-relaxed mb-2 md:mb-3">{line}</p>
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
        className="w-[95vw] sm:max-w-2xl bg-slate-900 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-hidden rounded-[1.5rem] md:rounded-[2rem] max-h-[90vh] flex flex-col outline-none [&>button]:hidden z-[10000]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby="info-popup-desc"
      >
        <DialogDescription className="sr-only">
          Popup com informações importantes sobre a loja.
        </DialogDescription>

        {/* Barra superior de destaque */}
        <div className="h-1 md:h-1.5 bg-gradient-to-r from-sky-500 to-indigo-500 w-full shrink-0" />

        {/* Botão fechar no canto superior direito — posicionado dentro do header */}
        <div className="relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-2 right-3 md:top-3 md:right-4 z-50 p-2.5 rounded-full bg-white/8 hover:bg-white/16 text-white/80 hover:text-white transition-all"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 md:h-5 md:w-5" />
          </button>

          {/* Header */}
          <div className="px-4 pt-4 pb-2 md:px-10 md:pt-6 md:pb-3">
            <DialogHeader className="items-center text-center">
              <div className="flex items-center justify-center mb-2 md:mb-4">
                <div className="p-1.5 md:p-2.5 bg-sky-500/20 rounded-xl md:rounded-2xl">
                  <Info className="h-5 w-5 md:h-7 md:w-7 text-sky-400 shrink-0" />
                </div>
              </div>
              <DialogTitle className="font-black text-2xl md:text-4xl text-white tracking-tighter italic uppercase leading-tight text-center break-words px-2 md:px-0">
                {title}.
              </DialogTitle>
            </DialogHeader>
          </div>
        </div>

        {/* Conteúdo — única parte que rola */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 custom-scrollbar min-h-0 pb-6" id="info-popup-desc">
          <div className="pb-4">
            {parseHtmlToReact(content)}
          </div>
        </div>

        {/* Footer com botão — fixo, sempre visível */}
        <DialogFooter style={{paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)'}} className="px-4 py-3 md:px-10 md:py-5 flex flex-col sm:flex-row sm:justify-center gap-2 md:gap-3 shrink-0 border-t border-white/10 bg-slate-900">
          {onAccept ? (
            <>
              <Button
                type="button"
                onClick={handleAccept}
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-11 md:h-14 px-6 md:px-12 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95 text-xs md:text-base"
              >
                Aceitar e Continuar
              </Button>
              <Button
                type="button"
                onClick={onClose}
                variant="ghost"
                className="w-full sm:w-auto bg-white/5 text-white font-black uppercase tracking-widest h-11 md:h-14 px-6 md:px-12 rounded-xl border border-white/10 hover:bg-white/10 text-xs md:text-base"
              >
                Fechar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-widest h-11 md:h-14 px-6 md:px-12 rounded-xl shadow-[0_10px_20px_-5px_rgba(14,165,233,0.4)] transition-all active:scale-95 text-xs md:text-base"
            >
              Entendi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InformationalPopup;