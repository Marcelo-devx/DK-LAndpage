import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollAnimationWrapperProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

const ScrollAnimationWrapper = ({ children, delay = 0, className }: ScrollAnimationWrapperProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback para browsers sem IntersectionObserver (Android antigo, iOS 11-)
    // Sem isso, a seção ficava com opacity:0 para sempre nesses devices
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      {
        threshold: 0,
        // rootMargin negativo (-40px) causava problema no iOS/Android:
        // seções próximas ao fim da tela nunca disparavam e ficavam invisíveis.
        // Usando 0px garante que dispara assim que qualquer pixel entra na tela.
        rootMargin: "0px 0px 0px 0px",
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
};

export default ScrollAnimationWrapper;