/**
 * Image Optimizer Utility
 *
 * Detects Cloudinary URLs and adds optimization parameters automatically.
 * Falls back to original URL if not a Cloudinary URL or on error.
 */

import { logger } from '@/lib/logger';

const CLOUDINARY_DOMAINS = ['res.cloudinary.com', 'cloudinary.com'];

/**
 * Check if a URL is from Cloudinary
 */
export function isCloudinaryUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return CLOUDINARY_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Extract transformation parameters from an existing Cloudinary URL
 */
function extractExistingTransformations(url: string): { baseUrl: string; versionAndAfter?: string } {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1) return { baseUrl: url };

    const versionIndex = pathParts.findIndex((part, index) => index > uploadIndex && part.startsWith('v'));
    if (versionIndex === -1) return { baseUrl: url };

    const basePath = pathParts.slice(0, uploadIndex + 1).join('/');
    const versionAndAfter = pathParts.slice(versionIndex).join('/');

    return {
      baseUrl: `${urlObj.origin}${basePath}/`,
      versionAndAfter,
    };
  } catch (error) {
    logger.warn('[imageOptimizer] Error extracting transformations:', error);
    return { baseUrl: url };
  }
}

/**
 * Generate optimized Cloudinary URL with specific parameters
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  width: number,
  quality: number = 85,
  format: 'auto' | 'webp' | 'jpg' = 'auto'
): string | null {
  if (!url) return null;

  if (!isCloudinaryUrl(url)) return url;

  try {
    const transforms = [
      'c_fill',
      `w_${width}`,
      `q_${quality}`,
      `f_${format}`,
    ].join(',');

    const { baseUrl, versionAndAfter } = extractExistingTransformations(url);
    if (!baseUrl || baseUrl === url || !versionAndAfter) return url;

    return `${baseUrl}${transforms}/${versionAndAfter}`;
  } catch (error) {
    logger.warn('[imageOptimizer] Error optimizing image:', error);
    return url;
  }
}

/**
 * Generate srcset for responsive images
 */
export function getResponsiveSrcset(
  url: string | null | undefined,
  sizes: number[] = [300, 600, 900, 1200],
  quality: number = 85
): string {
  if (!url) return '';

  if (!isCloudinaryUrl(url)) return url;

  return sizes
    .map(width => {
      const optimizedUrl = getOptimizedImageUrl(url, width, quality);
      return optimizedUrl ? `${optimizedUrl} ${width}w` : '';
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Get the best URL for a specific container width
 */
export function getBestImageUrl(
  url: string | null | undefined,
  containerWidth: number
): string | null {
  if (!url) return null;

  const sizes = [300, 600, 900, 1200];
  const bestWidth = sizes.find(s => s >= containerWidth) || sizes[sizes.length - 1];

  return getOptimizedImageUrl(url, bestWidth);
}

/**
 * Generate a tiny placeholder for blur effect (data URL)
 * This creates a very small blur placeholder to prevent layout shift
 */
export function getBlurPlaceholder(): string {
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3Crect width="100%25" height="100%25" fill="%23f5f5f4"/%3E%3C/svg%3E';
}