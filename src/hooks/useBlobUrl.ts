import { useState, useEffect, type RefObject } from 'react';
import { getBlobUrl, getCachedBlobUrl } from '../services/fileSystemService';

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
 * If blob URL is already cached (from scan), hooks are no-ops.
 */
export function useBlobUrl(
  photoId: string,
  elementRef?: RefObject<HTMLElement | null>,
): { url: string | null; loading: boolean; error: boolean } {
  const cached = getCachedBlobUrl(photoId);
  const [url, setUrl] = useState<string | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(!elementRef || !!cached);

  // Observe visibility via shared observer (skip if cached)
  useEffect(() => {
    if (cached || !elementRef) return;

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
  }, [elementRef, cached]);

  // Load blob URL once visible (skip if cached)
  useEffect(() => {
    if (cached || !visible) return;

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
  }, [photoId, visible, cached]);

  // Fast path: return cached value directly
  if (cached) {
    return { url: cached, loading: false, error: false };
  }

  return { url, loading, error };
}
