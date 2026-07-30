import { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  hoverScale?: boolean;
  grayscale?: boolean;
  rounded?: string;
  showLoader?: boolean;
}

export default function ProductImage({
  src,
  alt,
  className = '',
  imgClassName = '',
  hoverScale = false,
  grayscale = false,
  rounded = 'rounded-xl',
  showLoader = false,
}: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const hasImage = src && !errored;

  return (
    <div
      className={`relative aspect-[3/2] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 ${rounded} ${className}`}
    >
      {/* Background frame pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.04),transparent_70%)]" />

      {/* Loading placeholder */}
      {showLoader && hasImage && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {hasImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`w-full h-full object-cover transition-transform duration-500 ${
            hoverScale ? 'group-hover:scale-110' : ''
          } ${grayscale ? 'grayscale opacity-60' : ''} ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Package className="w-8 h-8 text-gray-400 dark:text-gray-600" />
        </div>
      )}
    </div>
  );
}
