import { useState, useRef, memo } from 'react';
import type { Photo } from '../../types';
import { usePhotoStore } from '../../stores/photoStore';
import { useBlobUrl } from '../../hooks/useBlobUrl';

interface PhotoCardProps {
  photo: Photo;
  selectable?: boolean;
  onSelect?: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
  batchMode?: boolean;
  onView?: (id: string) => void;
}

export const PhotoCard = memo(function PhotoCard({ photo, selectable = false, onSelect, selected, onToggleSelect, batchMode, onView }: PhotoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const addToTrash = usePhotoStore((s) => s.addToTrash);
  const cardRef = useRef<HTMLDivElement>(null);
  const { url: imageSrc, loading, error: imageError } = useBlobUrl(photo.id, cardRef);

  const showCheckbox = batchMode || selected;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToTrash(photo);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(photo.id, e.shiftKey);
  };

  const handleCardClick = () => {
    onView?.(photo.id);
  };

  return (
    <div
      ref={cardRef}
      className={`relative group rounded-lg overflow-hidden bg-white/5 aspect-square ${
        selected ? 'ring-2 ring-blue-400' : ''
      } ${onView ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Loading placeholder */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      )}

      {!imageError && imageSrc ? (
        <img
          src={imageSrc}
          alt={photo.filename}
          className={`w-full h-full object-cover transition-opacity duration-200 ${!loading ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
        />
      ) : imageError ? (
        <div className="w-full h-full flex items-center justify-center bg-white/5">
          <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      ) : null}

      {/* Batch selection checkbox */}
      {onToggleSelect && (showCheckbox || isHovered) && (
        <button
          onClick={handleCheckboxClick}
          className={`absolute top-1 left-1 z-20 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            selected
              ? 'bg-blue-500 border-blue-400'
              : 'bg-black/40 border-white/50 hover:border-white/80'
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      )}

      {/* Quality badge — shifted right when checkbox is visible */}
      {photo.qualityScore !== undefined && (
        <div
          className={`absolute ${onToggleSelect ? 'top-1 left-7' : 'top-1 left-1'} z-10 px-1.5 py-0.5 rounded text-xs font-semibold ${
            photo.qualityScore >= 70
              ? 'bg-green-500/80 text-white'
              : photo.qualityScore >= 40
                ? 'bg-orange-500/80 text-white'
                : 'bg-red-500/80 text-white'
          }`}
          title={`Netteté: ${photo.blurScore ?? '?'} — Exposition: ${photo.exposureScore ?? '?'}`}
        >
          {isHovered ? `Q ${photo.qualityScore}` : photo.qualityScore}
        </div>
      )}

      {/* Type badge — document only */}
      {photo.photoType === 'document' && (
        <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded text-xs font-semibold bg-cyan-500/80 text-white">
          Doc
        </div>
      )}

      {/* Overlay on hover */}
      {isHovered && (
        <div className="absolute inset-0 bg-black/50 flex flex-col justify-between p-2">
          <div className="flex justify-end">
            {selectable && onSelect && (
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(photo.id); }}
                className="p-1 bg-white/20 rounded-full hover:bg-white/30"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-1 bg-red-500/30 rounded-full hover:bg-red-500/50 ml-1"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <div className="text-white text-xs">
            <p className="truncate">{photo.filename}</p>
            <p>{formatSize(photo.size)}</p>
          </div>
        </div>
      )}
    </div>
  );
});
