import { useState, useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Photo } from '../../types';
import { usePhotoStore } from '../../stores/photoStore';

interface PhotoCardProps {
  photo: Photo;
  selectable?: boolean;
  onSelect?: (id: string) => void;
}

export function PhotoCard({ photo, selectable = false, onSelect }: PhotoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { addToTrash } = usePhotoStore();

  // Convert local file path to Tauri asset URL
  const imageSrc = useMemo(() => {
    return convertFileSrc(photo.path);
  }, [photo.path]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleDelete = () => {
    addToTrash(photo);
  };

  return (
    <div
      className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-square"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!imageError ? (
        <img
          src={imageSrc}
          alt={photo.filename}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* Overlay on hover */}
      {isHovered && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col justify-between p-2 transition-opacity">
          <div className="flex justify-end">
            {selectable && onSelect && (
              <button
                onClick={() => onSelect(photo.id)}
                className="p-1 bg-white rounded-full hover:bg-blue-100"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-1 bg-white rounded-full hover:bg-red-100 ml-1"
            >
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
}
