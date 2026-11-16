'use client';

import { useEffect, useRef } from 'react';

export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const replaceFailedImage = (image: HTMLImageElement) => {
      if (image.dataset.fallbackShown === 'true') return;
      image.dataset.fallbackShown = 'true';
      const fallback = document.createElement('span');
      fallback.className = 'mw-image-fallback';
      fallback.textContent = 'Image unavailable';
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', image.alt || 'Image unavailable');
      image.replaceWith(fallback);
    };

    const handleImageError = (event: Event) => {
      const image = event.target;
      if (image instanceof HTMLImageElement) replaceFailedImage(image);
    };

    container.addEventListener('error', handleImageError, true);
    container.querySelectorAll('img').forEach((image) => {
      if (image.complete && image.naturalWidth === 0) replaceFailedImage(image);
    });
    return () => container.removeEventListener('error', handleImageError, true);
  }, [html]);

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
