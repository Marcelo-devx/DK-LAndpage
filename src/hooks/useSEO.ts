import { useEffect, useRef } from 'react';

interface SEOOptions {
  title: string;
  description: string;
  image?: string | null;
  url?: string;
  type?: 'website' | 'product' | 'article';
  jsonLd?: object;
}

const DEFAULT_TITLE = 'DKCWB';
const DEFAULT_DESCRIPTION = 'Curadoria exclusiva dos melhores produtos para você. Encontre promoções, novidades e muito mais na DKCWB.';
const DEFAULT_IMAGE = 'https://dkcwb.com/og-image.jpg';

/**
 * useSEO Hook
 * 
 * Gerencia meta tags SEO e Open Graph de forma client-side.
 * Atualiza o título da página e todas as meta tags relevantes.
 * 
 * @example
 * useSEO({
 *   title: 'Meu Produto | DKCWB',
 *   description: 'Descrição do produto...',
 *   image: 'https://...',
 *   url: 'https://dkcwb.com/produto/123',
 *   type: 'product'
 * })
 */
export const useSEO = ({
  title,
  description,
  image,
  url,
  type = 'website',
  jsonLd
}: SEOOptions) => {
  const previousJsonLdId = useRef<string | null>(null);

  useEffect(() => {
    // Sanitização básica da descrição (remover HTML excessivo e truncar)
    const sanitizedDescription = description
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim()
      .substring(0, 160);

    // URL completa (usa window.location se não fornecida)
    const fullUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    const fullImage = image || DEFAULT_IMAGE;

    // Atualizar título
    if (typeof document !== 'undefined') {
      document.title = title;
    }

    // Meta tags para atualizar
    const metaTags: Array<{ name?: string; property?: string; content: string }> = [
      // Meta tags básicas
      { name: 'description', content: sanitizedDescription },
      
      // Open Graph
      { property: 'og:title', content: title },
      { property: 'og:description', content: sanitizedDescription },
      { property: 'og:image', content: fullImage },
      { property: 'og:url', content: fullUrl },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: 'DKCWB' },
      
      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: sanitizedDescription },
      { name: 'twitter:image', content: fullImage },
      { name: 'twitter:site', content: '@dkcwb' },
    ];

    // Criar ou atualizar meta tags
    if (typeof document !== 'undefined') {
      metaTags.forEach(meta => {
        let metaElement: HTMLMetaElement | null = null;
        
        if (meta.name) {
          metaElement = document.querySelector(`meta[name="${meta.name}"]`);
        } else if (meta.property) {
          metaElement = document.querySelector(`meta[property="${meta.property}"]`);
        }

        if (!metaElement) {
          metaElement = document.createElement('meta');
          if (meta.name) metaElement.setAttribute('name', meta.name);
          if (meta.property) metaElement.setAttribute('property', meta.property);
          document.head.appendChild(metaElement);
        }

        metaElement.setAttribute('content', meta.content);
      });

      // Atualizar ou criar link canonical
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute('href', fullUrl);

      // Inserir JSON-LD Schema.org (se fornecido)
      if (jsonLd) {
        // Remover JSON-LD anterior se existir
        if (previousJsonLdId.current) {
          const previousScript = document.getElementById(previousJsonLdId.current);
          if (previousScript) {
            previousScript.remove();
          }
        }

        // Criar novo script JSON-LD
        const scriptId = `json-ld-${Date.now()}`;
        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(jsonLd);
        document.head.appendChild(script);
        
        previousJsonLdId.current = scriptId;
      }
    }

    // Cleanup: restaurar título padrão ao desmontar
    return () => {
      if (typeof document !== 'undefined') {
        document.title = DEFAULT_TITLE;
        
        // Remover JSON-LD ao desmontar
        if (previousJsonLdId.current) {
          const script = document.getElementById(previousJsonLdId.current);
          if (script) {
            script.remove();
          }
          previousJsonLdId.current = null;
        }
      }
    };
  }, [title, description, image, url, type, jsonLd]);
};
