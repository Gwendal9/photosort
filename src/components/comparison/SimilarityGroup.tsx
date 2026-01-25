import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { SimilarityGroup } from '../../types';
import { usePhotoStore } from '../../stores/photoStore';
import { PhotoCard } from '../photos/PhotoCard';

interface SimilarityGroupCardProps {
  group: SimilarityGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

export function SimilarityGroupCard({ group, isExpanded, onToggle }: SimilarityGroupCardProps) {
  const { addToTrash } = usePhotoStore();
  const [keepPhoto, setKeepPhoto] = useState<string>(group.photos[0]?.id || '');

  const handleKeepOnly = () => {
    group.photos
      .filter((p) => p.id !== keepPhoto)
      .forEach((photo) => addToTrash(photo));
  };

  const totalSize = group.photos.reduce((acc, p) => acc + p.size, 0);
  const savedSize = group.photos
    .filter((p) => p.id !== keepPhoto)
    .reduce((acc, p) => acc + p.size, 0);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Preview thumbnails */}
          <div className="flex -space-x-2">
            {group.photos.slice(0, 3).map((photo, i) => (
              <div
                key={photo.id}
                className="w-10 h-10 rounded-lg border-2 border-white bg-gray-200 overflow-hidden"
                style={{ zIndex: 3 - i }}
              >
                <img
                  src={convertFileSrc(photo.path)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            ))}
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">
              {group.photos.length} photos similaires
            </p>
            <p className="text-sm text-gray-500">
              Similarité : {Math.round(group.similarity * 100)}% • {formatSize(totalSize)}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            Sélectionnez la photo à conserver. Les autres seront déplacées vers la corbeille.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
            {group.photos.map((photo) => (
              <div
                key={photo.id}
                className={`relative cursor-pointer rounded-lg overflow-hidden ${
                  keepPhoto === photo.id ? 'ring-4 ring-green-500' : 'ring-1 ring-gray-200'
                }`}
                onClick={() => setKeepPhoto(photo.id)}
              >
                <PhotoCard photo={photo} />
                {keepPhoto === photo.id && (
                  <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    Garder
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-600">
              Espace libéré : <span className="font-semibold text-green-600">{formatSize(savedSize)}</span>
            </p>
            <button
              onClick={handleKeepOnly}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Supprimer les autres ({group.photos.length - 1})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
