import { useEffect, useRef } from 'react';

/**
 * Executa `onRefresh` quando o usuário volta para a aba/app após ficar
 * ausente por mais de `thresholdMs` milissegundos.
 *
 * Usa refs para evitar que re-renders do componente pai resetem o `hiddenAt`,
 * o que causava o threshold de 30s ser ignorado e fetches desnecessários.
 */
export function useVisibilityRefresh(
  onRefresh: () => Promise<void> | void,
  thresholdMs = 30_000
) {
  const onRefreshRef = useRef(onRefresh);
  const hiddenAtRef = useRef(0);
  const isFetchingRef = useRef(false);

  // Mantém a ref sempre atualizada sem recriar os listeners
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const schedule = (cb: () => void) => {
      if ((window as any).requestIdleCallback) {
        (window as any).requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 500);
      }
    };

    const runRefresh = () => {
      schedule(async () => {
        if (document.visibilityState !== 'visible') return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
          await onRefreshRef.current();
        } catch {
          // silently ignore background refresh errors
        } finally {
          isFetchingRef.current = false;
        }
      });
    };

    const handleVisibility = () => {
      try {
        if (document.hidden) {
          hiddenAtRef.current = Date.now();
        } else {
          if (!hiddenAtRef.current) return;
          const elapsed = Date.now() - hiddenAtRef.current;
          hiddenAtRef.current = 0;
          if (elapsed > thresholdMs && !isFetchingRef.current) {
            runRefresh();
          }
        }
      } catch {
        // noop
      }
    };

    const handleFocus = () => {
      try {
        if (
          hiddenAtRef.current &&
          Date.now() - hiddenAtRef.current > thresholdMs &&
          !isFetchingRef.current
        ) {
          hiddenAtRef.current = 0;
          runRefresh();
        }
      } catch {
        // noop
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholdMs]); // só recria se o threshold mudar
}
