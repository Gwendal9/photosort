import { useRef, useEffect, useState, memo } from 'react';
import { PhotoCard } from './PhotoCard';
import type { Photo } from '../../types';

interface LazyPhotoCardProps {
  photo: Photo;
  selected?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
  batchMode?: boolean;
  onView?: (id: string) => void;
}

// Shared bidirectional observer — mounts when near viewport, unmounts when far
const visibilityCallbacks = new Map<Element, (visible: boolean) => void>();
let visibilityObserver: IntersectionObserver | null = null;

function getVisibilityObserver(): IntersectionObserver {
  if (!visibilityObserver) {
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = visibilityCallbacks.get(entry.target);
          cb?.(entry.isIntersecting);
        }
      },
      { rootMargin: '400px' },
    );
  }
  return visibilityObserver;
}

/**
 * Wraps PhotoCard with viewport-based mount/unmount.
 * Off-screen cards render as lightweight placeholder divs (no hooks, no store sub).
 * Only cards near the viewport mount the full PhotoCard.
 */
export const LazyPhotoCard = memo(function LazyPhotoCard({
  photo,
  selected,
  onToggleSelect,
  batchMode,
  onView,
}: LazyPhotoCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = getVisibilityObserver();
    visibilityCallbacks.set(el, setMounted);
    observer.observe(el);

    return () => {
      visibilityCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, []);

  if (!mounted) {
    return <div ref={ref} className="aspect-square bg-white/5 rounded-lg" />;
  }

  return (
    <div ref={ref}>
      <PhotoCard
        photo={photo}
        selected={selected}
        onToggleSelect={onToggleSelect}
        batchMode={batchMode}
        onView={onView}
      />
    </div>
  );
});
