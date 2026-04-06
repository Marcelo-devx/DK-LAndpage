import { createContext, useContext, useRef, ReactNode } from 'react';

interface ImageCacheContextType {
  markAsLoaded: (src: string) => void;
  isLoaded: (src: string) => boolean;
  markAsErrored: (src: string) => void;
  isErrored: (src: string) => boolean;
  clearCache: () => void;
}

const ImageCacheContext = createContext<ImageCacheContextType | undefined>(undefined);

const MAX_CACHE_SIZE = 150; // Limite de imagens no cache

export const ImageCacheProvider = ({ children }: { children: ReactNode }) => {
  // Usamos Map para O(1) lookup e arrays adicionais para ordem LRU
  const loadedCacheRef = useRef<Map<string, boolean>>(new Map());
  const erroredCacheRef = useRef<Map<string, boolean>>(new Map());
  const loadedOrderRef = useRef<string[]>([]);

  const markAsLoaded = (src: string) => {
    if (!src || loadedCacheRef.current.has(src)) return;

    // Se cache atingiu limite, remove a mais antiga
    if (loadedCacheRef.current.size >= MAX_CACHE_SIZE) {
      const oldest = loadedOrderRef.current.shift();
      if (oldest) {
        loadedCacheRef.current.delete(oldest);
      }
    }

    loadedCacheRef.current.set(src, true);
    loadedOrderRef.current.push(src);

    // Remove de erro se estava lá
    erroredCacheRef.current.delete(src);
  };

  const isLoaded = (src: string) => {
    return loadedCacheRef.current.has(src);
  };

  const markAsErrored = (src: string) => {
    if (!src) return;
    erroredCacheRef.current.set(src, true);
    // Não remove do loadedCache pois pode dar certo na próxima tentativa
  };

  const isErrored = (src: string) => {
    return erroredCacheRef.current.has(src);
  };

  const clearCache = () => {
    loadedCacheRef.current.clear();
    erroredCacheRef.current.clear();
    loadedOrderRef.current = [];
  };

  return (
    <ImageCacheContext.Provider value={{ markAsLoaded, isLoaded, markAsErrored, isErrored, clearCache }}>
      {children}
    </ImageCacheContext.Provider>
  );
};

export const useImageCache = () => {
  const context = useContext(ImageCacheContext);
  if (!context) {
    throw new Error('useImageCache must be used within ImageCacheProvider');
  }
  return context;
};
