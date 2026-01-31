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
 * Checks cache synchronously on mount — if already cached (e.g. from scan),
 * returns instantly with no loading state.
 * When an elementRef is provided and not cached, loading is deferred until
 * the element is near the viewport (shared IntersectionObserver).
 */
export function useBlobUrl(
  photoId: string,
  elementRef?: RefObject<HTMLElement | null>,
): { url: string | null; loading: boolean; error: boolean } {
  // Synchronous cache check — skip loading entirely if blob URL exists
  const cached = getCachedBlobUrl(photoId);
  const [url, setUrl] = useState<string | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(!elementRef || !!cached);

  // If already cached, nothing else to do
  if (cached && url !== cached) {
    // Handle case where photoId changed and cache has a new value
    setUrl(cached);
    setLoading(false);
  }

  // Observe visibility via shared observer (only when not cached)
  useEffect(() => {
    if (cached) return; // Already loaded synchronously
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
  }, [elementRef, cached]);

  // Load blob URL once visible (only when not cached)
  useEffect(() => {
    if (cached) return; // Already loaded synchronously
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
  }, [photoId, visible, cached]);

  return { url, loading, error };
}
