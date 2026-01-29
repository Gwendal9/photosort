import { useState, useEffect } from 'react';
import { getBlobUrl } from '../services/fileSystemService';

/**
 * Hook to load and manage a blob URL for a photo.
 * Automatically revokes the URL when the component unmounts.
 */
export function useBlobUrl(photoId: string): { url: string | null; loading: boolean; error: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
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
      // Don't revoke here — the URL may be shared across components.
      // Revocation is handled by revokeAllBlobUrls on cleanup.
    };
  }, [photoId]);

  return { url, loading, error };
}
