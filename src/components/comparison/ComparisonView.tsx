import { useState, useMemo } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { SimilarityGroupCard } from './SimilarityGroup';
import { PhotoViewer } from '../common/PhotoViewer';

export function ComparisonView() {
  const { similarityGroups, similarityThreshold, setSimilarityThreshold, analysisThreshold } = usePhotoStore();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);

  const filteredGroups = similarityGroups.filter((g) => g.similarity >= similarityThreshold);

  const allGroupPhotos = useMemo(
    () => filteredGroups.flatMap((g) => g.photos),
    [filteredGroups],
  );
  const allGroupPhotoIds = useMemo(
    () => allGroupPhotos.map((p) => p.id),
    [allGroupPhotos],
  );

  if (similarityGroups.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-white/20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-lg font-medium text-white mb-2">Aucun groupe détecté</h3>
        <p className="text-white/50">
          Lancez une analyse pour détecter les photos similaires.
        </p>
      </div>
    );
  }

  const totalDuplicates = filteredGroups.reduce((acc, g) => acc + g.photos.length - 1, 0);
  const potentialSpaceSaved = filteredGroups.reduce(
    (acc, g) => acc + g.photos.slice(1).reduce((sum, p) => sum + p.size, 0),
    0
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
  };

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-blue-300">{filteredGroups.length}</p>
            <p className="text-white/50">Groupes détectés</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-orange-300">{totalDuplicates}</p>
            <p className="text-white/50">Photos similaires</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-300">{formatSize(potentialSpaceSaved)}</p>
            <p className="text-white/50">Espace récupérable</p>
          </div>
        </div>

        {/* Similarity threshold slider */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-white/70">
              Seuil de similarité
            </label>
            <span className="text-2xl font-bold text-white tabular-nums">
              {Math.round(similarityThreshold * 100)}%
            </span>
          </div>
          {/* Custom slider track */}
          <div className="relative h-10 flex items-center">
            {/* Track background */}
            <div className="absolute inset-x-0 h-2 rounded-lg overflow-hidden top-1/2 -translate-y-1/2">
              {/* Full track */}
              <div className="absolute inset-0 bg-white/20 rounded-lg" />
              {/* Red zone below analysis threshold */}
              {analysisThreshold !== null && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-red-500/25 rounded-l-lg"
                  style={{ width: `${((analysisThreshold * 100 - 50) / 49) * 100}%` }}
                />
              )}
            </div>
            {/* Analysis threshold marker */}
            {analysisThreshold !== null && (
              <div
                className="absolute flex flex-col items-center pointer-events-none"
                style={{ left: `${((analysisThreshold * 100 - 50) / 49) * 100}%`, transform: 'translateX(-50%)', top: 0, bottom: 0 }}
              >
                <span className="text-[10px] font-semibold text-orange-300 whitespace-nowrap bg-orange-500/20 px-1 rounded">
                  Analyse {Math.round(analysisThreshold * 100)}%
                </span>
                <div className="w-0.5 flex-1 bg-orange-400/60 rounded mt-0.5" />
              </div>
            )}
            {/* Native range input */}
            <input
              type="range"
              min="50"
              max="99"
              value={similarityThreshold * 100}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value) / 100)}
              className="absolute inset-x-0 h-2 appearance-none bg-transparent cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-track]:bg-transparent"
            />
          </div>
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>50% — Plus permissif</span>
            {analysisThreshold !== null && similarityThreshold < analysisThreshold && (
              <span className="text-red-300 font-medium">En dessous du seuil d'analyse</span>
            )}
            <span>99% — Plus strict</span>
          </div>
        </div>
      </div>

      {/* Groups list */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-8 text-white/50">
          <p>Aucun groupe ne correspond au seuil de {Math.round(similarityThreshold * 100)}%.</p>
          <p className="text-sm mt-1">Baissez le seuil pour voir plus de résultats.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <SimilarityGroupCard
              key={group.id}
              group={group}
              isExpanded={expandedGroup === group.id}
              onToggle={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
              onView={setViewingPhotoId}
            />
          ))}
        </div>
      )}

      {/* Photo viewer lightbox */}
      {viewingPhotoId && (() => {
        const viewingPhoto = allGroupPhotos.find((p) => p.id === viewingPhotoId);
        if (!viewingPhoto) return null;
        return (
          <PhotoViewer
            photo={viewingPhoto}
            photoIds={allGroupPhotoIds}

            onClose={() => setViewingPhotoId(null)}
            onNavigate={setViewingPhotoId}
          />
        );
      })()}
    </div>
  );
}
