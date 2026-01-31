import { useState, useEffect, type RefObject } from 'react';
import { getBlobUrl } from '../services/fileSystemService';

// Shared singleton IntersectionObserver — one observer for all PhotoCards
const callbacks = new Map<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = callbacks.get(entry.target);
            if (cb) {
              cb();
              callbacks.delete(entry.target);
              sharedObserver!.unobserve(entry.target);
            }
          }
        }
      },
      { rootMargin: '300px' },
    );
  }
  return sharedObserver;
}

/**
 * Hook to load and manage a blob URL for a photo.
 * When an elementRef is provided, loading is deferred until the element
 * is near the viewport (shared IntersectionObserver with 300px rootMargin).
 */
export function useBlobUrl(
  photoId: string,
  elementRef?: RefObject<HTMLElement | null>,
): { url: string | null; loading: boolean; error: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(!elementRef);

  // Observe visibility via shared observer
  useEffect(() => {
    if (!elementRef) {
      setVisible(true);
      return;
    }

    const el = elementRef.current;
    if (!el) {
      setVisible(true);
      return;
    }

    const observer = getSharedObserver();
    callbacks.set(el, () => setVisible(true));
    observer.observe(el);

    return () => {
      callbacks.delete(el);
      observer.unobserve(el);
    };
  }, [elementRef]);

  // Load blob URL once visible
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    setLoading(true);
    setError(false);

    getBlobUrl(photoId)
      .then((blobUrl) => {
        if (!cancelled) {
          setUrl(blobUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [photoId, visible]);

  return { url, loading, error };
}
