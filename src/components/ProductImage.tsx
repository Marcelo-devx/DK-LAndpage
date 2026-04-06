import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { getOptimizedImageUrl, getResponsiveSrcset, getBlurPlaceholder } from '@/utils/imageOptimizer';
import { useImageCache } from '@/context/ImageCacheContext';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  // If true, load with high priority (no lazy). Default false.
  priority?: boolean;
  // object-fit mode: 'cover' (default) or 'contain'
  fit?: 'cover' | 'contain';
  // Maximum container width for responsive sizing
  maxWidth?: number;
  // JPEG/WebP quality (1-100). Default 85.
  quality?: number;
}

const Placeholder = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'w-full h-full bg-stone-100',
      className
    )}
    style={{
      backgroundImage: `url(${getBlurPlaceholder()})`,
      backgroundSize: 'cover',
    }}
  />
);

const FallbackImage = ({ className }: { className?: string }) => (
  <div className={cn('w-full h-full bg-white border border-stone-100 rounded-lg flex items-center justify-center', className)}>
    <div className="flex flex-col items-center gap-2">
      <svg className="h-12 w-12 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="14" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <path d="M21 21l-5-5L13 17l-4-4-6 6"></path>
      </svg>
      <div className="text-[12px] text-stone-400 font-semibold">Imagem indisponível</div>
    </div>
  </div>
);

const ProductImage = ({ 
  src, 
  alt, 
  className, 
  priority = false, 
  fit = 'cover',
  maxWidth = 1200,
  quality = 85
}: ProductImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [shouldLoad, setShouldLoad] = useState<boolean>(priority);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { markAsLoaded, isLoaded: isImageLoaded, markAsErrored, isErrored: isImageErrored } = useImageCache();

  // Check cache on mount - if image is already loaded, set loaded immediately
  useEffect(() => {
    if (src && isImageLoaded(src)) {
      setLoaded(true);
    }
    if (src && isImageErrored(src)) {
      setErrored(true);
    }
  }, [src, isImageLoaded, isImageErrored]);

  // If src changes, reset state (except for cached images)
  useEffect(() => {
    if (!src || !isImageLoaded(src)) {
      setLoaded(false);
    }
    if (!src || !isImageErrored(src)) {
      setErrored(false);
    }
    setShouldLoad(priority);
  }, [src, priority, isImageLoaded, isImageErrored]);

  // IntersectionObserver to start loading images before they enter viewport
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
        { rootMargin: '300px 0px' } // Reduced from 400px for faster loading
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
    
    // Get optimized URL for preloading (use a mid-size for preloading)
    const preloadUrl = getOptimizedImageUrl(src, 600, Math.max(quality - 5, 75));
    if (!preloadUrl) return;
    
    const img = new Image();
    img.src = preloadUrl;
    img.decoding = 'async';
    img.onload = () => {
      // preloaded, actual <img> will setLoaded on its onLoad
    };
    img.onerror = (e) => {
      console.error('Preload image error', src, e);
    };
  }, [src, shouldLoad, quality]);

  // Set fetchpriority attribute directly on the DOM node
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    try {
      if (priority) {
        el.setAttribute('fetchpriority', 'high');
      } else {
        el.removeAttribute('fetchpriority');
      }
    } catch (e) {
      // ignore
    }
  }, [priority, shouldLoad]);

  // If src is missing, show a clear fallback
  if (!src) {
    return <FallbackImage className={className} />;
  }

  // For contain we also center the image so focal point appears centered
  const imgFitClass = fit === 'contain' ? 'object-contain object-center' : 'object-cover object-center';

  // Get optimized image URLs with custom quality
  const optimizedSrc = getOptimizedImageUrl(src, maxWidth, quality);
  const srcset = getResponsiveSrcset(src, [300, 600, 900, 1200, 1920], quality);
  const sizes = `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw`;

  const handleLoad = () => {
    setLoaded(true);
    if (src) markAsLoaded(src);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Failed to load image', src, e);
    setErrored(true);
    if (src) markAsErrored(src);
  };

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden rounded-lg flex items-center justify-center bg-white', className)}>
      {!loaded && !errored && <div className="absolute inset-0"><Placeholder /></div>}

      {shouldLoad ? (
        <img
          ref={imgRef}
          src={optimizedSrc || undefined}
          srcSet={srcset || undefined}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full block transition-opacity duration-300 ease-out',
            imgFitClass,
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : (
        // Render an empty div until shouldLoad becomes true to avoid browser fetching
        <div aria-hidden className="w-full h-full" />
      )}

      {errored && (
        <div className="absolute inset-0">
          <FallbackImage />
        </div>
      )}
    </div>
  );
};

export default ProductImage;