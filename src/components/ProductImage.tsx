import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { getOptimizedImageUrl, getResponsiveSrcset, getBlurPlaceholder } from '@/utils/imageOptimizer';
import { useImageCache } from '@/context/ImageCacheContext';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  fit?: 'cover' | 'contain';
  maxWidth?: number;
  quality?: number;
  skipOptimization?: boolean;
}

const Placeholder = ({ className }: { className?: string }) => (
  <div
    className={cn('w-full h-full bg-stone-100', className)}
    style={{
      backgroundImage: `url(${getBlurPlaceholder()})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
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
  maxWidth = 700,
  quality = 25,

  skipOptimization = false,
}: ProductImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [shouldLoad, setShouldLoad] = useState<boolean>(priority);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { markAsLoaded, isLoaded: isImageLoaded, markAsErrored, isErrored: isImageErrored } = useImageCache();

  useEffect(() => {
    if (src && isImageLoaded(src)) setLoaded(true);
    if (src && isImageErrored(src)) setErrored(true);
  }, [src, isImageLoaded, isImageErrored]);

  useEffect(() => {
    if (!src || !isImageLoaded(src)) setLoaded(false);
    if (!src || !isImageErrored(src)) setErrored(false);
    setShouldLoad(priority);
  }, [src, priority, isImageLoaded, isImageErrored]);

  useEffect(() => {
    if (priority) return;
    if (!containerRef.current) return;

    let obs: IntersectionObserver | null = null;
    try {
      obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            obs?.disconnect();
            obs = null;
          }
        });
      }, { rootMargin: '300px 0px' });
      obs.observe(containerRef.current);
    } catch {
      setShouldLoad(true);
    }

    return () => obs?.disconnect();
  }, [priority]);

  useEffect(() => {
    if (!src || !shouldLoad) return;
    const preloadUrl = getOptimizedImageUrl(src, 360, Math.max(quality - 5, 20));
    if (!preloadUrl) return;

    const img = new Image();
    img.src = preloadUrl;
    img.decoding = 'async';
  }, [src, shouldLoad, quality]);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    if (priority) el.setAttribute('fetchpriority', 'high');
    else el.removeAttribute('fetchpriority');
  }, [priority]);

  if (!src) return <FallbackImage className={className} />;

  const imgFitClass = fit === 'contain' ? 'object-contain object-center' : 'object-cover object-center';
  const optimizedSrc = skipOptimization ? src : getOptimizedImageUrl(src, maxWidth, quality);
  const srcset = skipOptimization ? undefined : getResponsiveSrcset(src, [180, 280, 400, 600, 800], quality);
  const sizes = skipOptimization ? undefined : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';

  const handleLoad = () => {
    setLoaded(true);
    markAsLoaded(src);
  };

  const handleError = () => {
    setErrored(true);
    markAsErrored(src);
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
          className={cn('w-full h-full block transition-opacity duration-300 ease-out', imgFitClass, loaded ? 'opacity-100' : 'opacity-0')}
        />
      ) : (
        <div aria-hidden className="w-full h-full" />
      )}

      {errored && <div className="absolute inset-0"><FallbackImage /></div>}
    </div>
  );
};

export default ProductImage;