import { useState, useEffect, useRef, useCallback } from 'react';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Embaralha um pool de itens e rotaciona automaticamente um slice visível.
 * @param pool - todos os itens disponíveis (já filtrados, sem esgotados)
 * @param pageSize - quantos itens mostrar por vez
 * @param intervalMs - intervalo de rotação em ms (padrão: 4000)
 */
export function useProductRotation<T>(
  pool: T[],
  pageSize: number,
  intervalMs = 10000
) {
  const shuffledRef = useRef<T[]>([]);
  const indexRef = useRef(0);
  const [visible, setVisible] = useState<T[]>([]);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (pool.length === 0) return;
    const shuffled = shuffle(pool);
    shuffledRef.current = shuffled;
    indexRef.current = 0;
    setVisible(shuffled.slice(0, pageSize));
    setFade(true);
  }, [pool, pageSize]);

  const rotate = useCallback(() => {
    const arr = shuffledRef.current;
    if (arr.length <= pageSize) return;
    setFade(false);
    setTimeout(() => {
      const next = (indexRef.current + pageSize) % arr.length;
      indexRef.current = next;
      const slice: T[] = [];
      for (let i = 0; i < pageSize; i++) {
        slice.push(arr[(next + i) % arr.length]);
      }
      setVisible(slice);
      setFade(true);
    }, 300);
  }, [pageSize]);

  useEffect(() => {
    if (pool.length <= pageSize) return;
    const id = setInterval(rotate, intervalMs);
    return () => clearInterval(id);
  }, [pool, pageSize, intervalMs, rotate]);

  return { visible, fade };
}
