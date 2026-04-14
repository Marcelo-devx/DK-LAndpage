import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop — resets the window scroll position to the top on every ROUTE change.
 * Ignores query string changes (search) to avoid breaking Mercado Pago redirect flow.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Só rola para o topo se o pathname realmente mudou (ignora mudança de ?search)
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;

    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
