import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
}

const ProductImage = ({ src, alt, className }: ProductImageProps) => {
  const [imageSrc, setImageSrc] = useState(src);

  // Add timestamp to prevent browser caching
  useEffect(() => {
    if (src) {
      const url = new URL(src, window.location.origin);
      url.searchParams.set('t', Date.now().toString());
      setImageSrc(url.toString());
    }
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
    />
  );
};

export default ProductImage;
