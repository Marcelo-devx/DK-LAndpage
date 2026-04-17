import { useState, useEffect, useRef, useCallback } from 'react';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pré-carrega imagens em background para evitar flash ao trocar
function preloadImages(items: any[]) {
  items.forEach((item) => {
    const url = item?.imageUrl || item?.image_url;
    if (url) {
      const img = new Image();
      img.src = url;
    }
  });
}

/**
 * Embaralha um pool de itens, rotaciona automaticamente um slice visível
 * e pré-carrega as imagens do próximo slice antes de exibir.
 *
 * @param pool       - todos os itens disponíveis (já filtrados, sem esgotados)
 * @param pageSize   - quantos itens mostrar por vez
 * @param intervalMs - intervalo de rotação em ms (padrão: 10000)
 */
export function useProductRotation<T extends Record<string, any>>(
  pool: T[],
  pageSize: number,
  intervalMs = 10000
) {
  const shuffledRef = useRef<T[]>([]);
  const indexRef = useRef(0);
  const [visible, setVisible] = useState<T[]>([]);
  const [fade, setFade] = useState(true);

  // Quando o pool muda (dados carregados ou atualizados pelo cron), embaralha
  useEffect(() => {
    if (pool.length === 0) return;
    const shuffled = shuffle(pool);
    shuffledRef.current = shuffled;
    indexRef.current = 0;
    const first = shuffled.slice(0, pageSize);
    setVisible(first);
    setFade(true);
    // Pré-carrega o segundo slice imediatamente
    const second = shuffled.slice(pageSize, pageSize * 2);
    preloadImages(second);
  }, [pool, pageSize]);

  const rotate = useCallback(() => {
    const arr = shuffledRef.current;
    if (arr.length <= pageSize) return;

    // Calcula o próximo slice
    const next = (indexRef.current + pageSize) % arr.length;
    const slice: T[] = [];
    for (let i = 0; i < pageSize; i++) {
      slice.push(arr[(next + i) % arr.length]);
    }

    // Pré-carrega o slice DEPOIS do próximo (2 slices à frente)
    const afterNext = (next + pageSize) % arr.length;
    const preloadSlice: T[] = [];
    for (let i = 0; i < pageSize; i++) {
      preloadSlice.push(arr[(afterNext + i) % arr.length]);
    }
    preloadImages(preloadSlice);

    // Fade out → troca → fade in
    setFade(false);
    setTimeout(() => {
      indexRef.current = next;
      setVisible(slice);
      setFade(true);
    }, 500); // 500ms de fade-out suave
  }, [pageSize]);

  useEffect(() => {
    if (pool.length <= pageSize) return;
    const id = setInterval(rotate, intervalMs);
    return () => clearInterval(id);
  }, [pool, pageSize, intervalMs, rotate]);

  return { visible, fade };
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Executa um callback de re-fetch silencioso a cada 6 horas,
 * sem recarregar a página.
 *
 * @param onRefresh - função assíncrona que busca dados frescos e atualiza o estado
 */
export function useBackgroundRefresh(onRefresh: () => Promise<void>) {
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  useEffect(() => {
    const id = setInterval(() => {
      callbackRef.current().catch(() => {
        // falha silenciosa — não interrompe a experiência do usuário
      });
    }, SIX_HOURS_MS);
    return () => clearInterval(id);
  }, []);
}
