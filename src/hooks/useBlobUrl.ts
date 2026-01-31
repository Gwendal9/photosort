import { useState, useEffect, type RefObject } from 'react';
import { getBlobUrl } from '../services/fileSystemService';

/**
 * Hook to load and manage a blob URL for a photo.
 * When an elementRef is provided, loading is deferred until the element
 * is near the viewport (IntersectionObserver with 300px rootMargin).
 */
export function useBlobUrl(
  photoId: string,
  elementRef?: RefObject<HTMLElement | null>,
): { url: string | null; loading: boolean; error: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(!elementRef);

  // Observe visibility when an element ref is provided
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
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
