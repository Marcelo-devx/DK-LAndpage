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
function extractExistingTransformations(url: string): { baseUrl: string; existingTransforms: string; versionAndAfter?: string } {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Find the version part (e.g., /v1234567890/)
    const versionIndex = pathParts.findIndex(part => part.startsWith('v'));
    
    if (versionIndex === -1) {
      // No version found, transformations might be between upload/ and filename
      const uploadIndex = pathParts.indexOf('upload');
      if (uploadIndex === -1) return { baseUrl: url, existingTransforms: '' };
      
      const afterUpload = pathParts.slice(uploadIndex + 1);
      const filename = afterUpload[afterUpload.length - 1];
      const transforms = afterUpload.slice(0, afterUpload.length - 1).join('/');
      
      const basePath = pathParts.slice(0, uploadIndex + 1).join('/');
      return { 
        baseUrl: `${urlObj.origin}${basePath}/`, 
        existingTransforms: transforms 
      };
    }
    
    // Version found: transformations are between upload/ and v1234567890/
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1 || uploadIndex >= versionIndex) {
      return { baseUrl: url, existingTransforms: '' };
    }
    
    const transforms = pathParts.slice(uploadIndex + 1, versionIndex).join('/');
    const basePath = pathParts.slice(0, uploadIndex + 1).join('/');
    const versionAndAfter = pathParts.slice(versionIndex).join('/');
    
    return { 
      baseUrl: `${urlObj.origin}${basePath}/`, 
      existingTransforms: transforms,
      versionAndAfter
    };
    
  } catch (error) {
    logger.warn('[imageOptimizer] Error extracting transformations:', error);
    return { baseUrl: url, existingTransforms: '' };
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
  
  // If not Cloudinary, return as is
  if (!isCloudinaryUrl(url)) return url;
  
  try {
    // Build transformation parameters
    const transforms = [
      `q_${quality}`, // Quality
      `f_${format}`, // Format
      `w_${width}`, // Width
      'c_fill', // Crop to fill
      'q_auto', // Auto quality
    ].join(',');
    
    const { baseUrl, existingTransforms, versionAndAfter } = extractExistingTransformations(url);
    
    // If we couldn't parse properly, return original
    if (!baseUrl || baseUrl === url) return url;
    
    // Build the optimized URL
    if (versionAndAfter) {
      return `${baseUrl}${transforms}/${versionAndAfter}`;
    }
    
    return url; // Fallback if parsing failed
    
  } catch (error) {
    logger.warn('[imageOptimizer] Error optimizing image:', error);
    return url; // Always return original URL on error
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
  
  // If not Cloudinary, return single URL in srcset
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
  
  // Choose appropriate size based on container
  const sizes = [300, 600, 900, 1200];
  const bestWidth = sizes.find(s => s >= containerWidth) || sizes[sizes.length - 1];
  
  return getOptimizedImageUrl(url, bestWidth);
}

/**
 * Generate a tiny placeholder for blur effect (data URL)
 * This creates a very small blur placeholder to prevent layout shift
 */
export function getBlurPlaceholder(): string {
  // A simple SVG placeholder with a subtle gradient
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3Crect width="100%25" height="100%25" fill="%23f5f5f4"/%3E%3C/svg%3E';
}