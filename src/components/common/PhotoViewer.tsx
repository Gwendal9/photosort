import { useState, useEffect, useCallback } from 'react';
import type { Photo } from '../../types';
import { usePhotoStore } from '../../stores/photoStore';
import { getFullBlobUrl, getCachedBlobUrl } from '../../services/fileSystemService';

interface PhotoViewerProps {
  photo: Photo;
  photoIds: string[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function PhotoViewer({ photo, photoIds, onClose, onNavigate }: PhotoViewerProps) {
  // Start with thumbnail (instant), upgrade to full-res
  const [imageSrc, setImageSrc] = useState<string | null>(getCachedBlobUrl(photo.id));
  const addToTrash = usePhotoStore((s) => s.addToTrash);

  useEffect(() => {
    let cancelled = false;
    getFullBlobUrl(photo.id).then((url) => {
      if (!cancelled) setImageSrc(url);
    });
    return () => { cancelled = true; };
  }, [photo.id]);

  const currentIndex = photoIds.indexOf(photo.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photoIds.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(photoIds[currentIndex - 1]);
  }, [hasPrev, onNavigate, photoIds, currentIndex]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(photoIds[currentIndex + 1]);
  }, [hasNext, onNavigate, photoIds, currentIndex]);

  const handleTrash = useCallback(() => {
    // Determine where to navigate after trashing
    if (hasNext) {
      onNavigate(photoIds[currentIndex + 1]);
    } else if (hasPrev) {
      onNavigate(photoIds[currentIndex - 1]);
    } else {
      onClose();
    }
    addToTrash(photo);
  }, [addToTrash, photo, hasNext, hasPrev, photoIds, currentIndex, onNavigate, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Delete' || e.key === 'Backspace') handleTrash();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goPrev, goNext, handleTrash]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/90"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation: Previous */}
      {hasPrev && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Navigation: Next */}
      {hasNext && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Image container — scrollable if image is larger than viewport */}
      <div className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-8rem)] overflow-auto">
        {imageSrc && (
          <img
            src={imageSrc}
            alt={photo.filename}
            className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-8rem)] object-contain"
          />
        )}
      </div>

      {/* Info bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur px-6 py-3 flex items-center justify-between text-sm text-white/80">
        <div className="flex items-center gap-4">
          <span className="font-medium text-white">{photo.filename}</span>
          <span>{formatSize(photo.size)}</span>
          <span>{photo.width} x {photo.height}</span>
          {photo.qualityScore !== undefined && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
              photo.qualityScore >= 70 ? 'bg-green-500/80' : photo.qualityScore >= 40 ? 'bg-orange-500/80' : 'bg-red-500/80'
            }`}>
              Q {photo.qualityScore}
            </span>
          )}
          {photo.photoType === 'document' && (
            <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-cyan-500/80">
              Document
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleTrash}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/30 border border-red-400/30 rounded-lg hover:bg-red-500/50 transition-colors text-white text-xs"
            title="Supprimer (Delete)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Corbeille
          </button>
          <span className="text-white/50">
            {currentIndex + 1} / {photoIds.length}
          </span>
        </div>
      </div>
    </div>
  );
}
