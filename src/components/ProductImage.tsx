import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  // If true, load with high priority (no lazy). Default false.
  priority?: boolean;
}

const Placeholder = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'w-full h-full bg-stone-100 rounded-lg animate-pulse',
      className
    )}
  />
);

const ProductImage = ({ src, alt, className, priority = false }: ProductImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [shouldLoad, setShouldLoad] = useState<boolean>(priority);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // If src changes, reset state
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    setShouldLoad(priority);
  }, [src, priority]);

  // IntersectionObserver to start loading images slightly before they enter viewport
  useEffect(() => {
    if (priority) return; // already should load
    if (!containerRef.current) return;

    let obs: IntersectionObserver | null = null;
    try {
      obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setShouldLoad(true);
              if (obs) {
                obs.disconnect();
                obs = null;
              }
            }
          });
        },
        { rootMargin: '400px 0px' }
      );
      obs.observe(containerRef.current);
    } catch (e) {
      // If IntersectionObserver not supported, fallback to eager load
      setShouldLoad(true);
    }

    return () => {
      if (obs) try { obs.disconnect(); } catch { /* noop */ }
    };
  }, [priority]);

  // Preload image only when allowed to load (shouldLoad)
  useEffect(() => {
    if (!src || !shouldLoad) return;
    const img = new Image();
    img.src = src;
    img.decoding = 'async';
    img.onload = () => {
      // let the actual <img> onLoad handler setLoaded
    };
    img.onerror = () => { /* noop */ };
  }, [src, shouldLoad]);

  if (!src) {
    return <Placeholder className={className} />;
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden rounded-lg', className)}>
      {!loaded && !errored && <div className="absolute inset-0"><Placeholder /></div>}

      {shouldLoad ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'low'}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            'w-full h-full object-cover block transition-opacity duration-500 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : (
        // Render an empty img-less container until shouldLoad becomes true to avoid browser fetching
        <div aria-hidden className="w-full h-full" />
      )}

      {errored && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
          <svg className="h-8 w-8 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default ProductImage;