import { cn } from '@/lib/utils';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
}

const ProductImage = ({ src, alt, className }: ProductImageProps) => {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
    />
  );
};

export default ProductImage;
