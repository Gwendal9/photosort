import { useState } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { SimilarityGroupCard } from './SimilarityGroup';

export function ComparisonView() {
  const { similarityGroups, similarityThreshold, setSimilarityThreshold } = usePhotoStore();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const filteredGroups = similarityGroups.filter((g) => g.similarity >= similarityThreshold);

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
          <label className="block text-sm font-medium text-white/70 mb-2">
            Seuil de similarité : {Math.round(similarityThreshold * 100)}%
          </label>
          <input
            type="range"
            min="50"
            max="99"
            value={similarityThreshold * 100}
            onChange={(e) => setSimilarityThreshold(Number(e.target.value) / 100)}
            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>Plus permissif</span>
            <span>Plus strict</span>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
