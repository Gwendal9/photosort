import { useMemo } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { PhotoCard } from '../photos/PhotoCard';

type QualityCategory = 'all' | 'poor' | 'average' | 'good';

const CATEGORY_LABELS: Record<QualityCategory, string> = {
  all: 'Toutes',
  poor: 'Mauvaises',
  average: 'Moyennes',
  good: 'Bonnes',
};

function categorize(score: number | undefined): 'poor' | 'average' | 'good' {
  if (score === undefined) return 'average';
  if (score < 40) return 'poor';
  if (score < 70) return 'average';
  return 'good';
}

export function QualityView() {
  const { photos, qualityFilter, setQualityFilter, addToTrash, showToast } = usePhotoStore();

  const photosWithQuality = useMemo(
    () => photos.filter((p) => p.qualityScore !== undefined),
    [photos],
  );

  const stats = useMemo(() => {
    let good = 0, average = 0, poor = 0;
    for (const p of photosWithQuality) {
      const cat = categorize(p.qualityScore);
      if (cat === 'good') good++;
      else if (cat === 'average') average++;
      else poor++;
    }
    return { good, average, poor, total: photosWithQuality.length };
  }, [photosWithQuality]);

  const filtered = useMemo(() => {
    const list = qualityFilter === 'all'
      ? photosWithQuality
      : photosWithQuality.filter((p) => categorize(p.qualityScore) === qualityFilter);
    // Sort by quality score ascending (worst first)
    return [...list].sort((a, b) => (a.qualityScore ?? 50) - (b.qualityScore ?? 50));
  }, [photosWithQuality, qualityFilter]);

  const handleTrashPoor = () => {
    const poorPhotos = photosWithQuality.filter((p) => categorize(p.qualityScore) === 'poor');
    if (poorPhotos.length === 0) return;
    for (const p of poorPhotos) {
      addToTrash(p);
    }
    showToast(`${poorPhotos.length} photo${poorPhotos.length > 1 ? 's' : ''} de mauvaise qualité mise${poorPhotos.length > 1 ? 's' : ''} en corbeille`, 'success');
  };

  if (photosWithQuality.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-white/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 className="text-xl font-semibold text-white mb-2">Aucune analyse de qualité</h3>
        <p className="text-white/60">
          Lancez une analyse depuis l'accueil pour obtenir les scores de qualité.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.good}</p>
          <p className="text-sm text-white/60">Bonnes</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.average}</p>
          <p className="text-sm text-white/60">Moyennes</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.poor}</p>
          <p className="text-sm text-white/60">Mauvaises</p>
        </div>
      </div>

      {/* Filter toggles + trash action */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'poor', 'average', 'good'] as QualityCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setQualityFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                qualityFilter === cat
                  ? 'bg-white/25 text-white'
                  : 'text-white/60 hover:bg-white/10'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        {stats.poor > 0 && (
          <button
            onClick={handleTrashPoor}
            className="px-4 py-1.5 bg-red-500/30 border border-red-400/30 text-white text-sm rounded-lg hover:bg-red-500/40 transition-colors"
          >
            Mettre les mauvaises en corbeille ({stats.poor})
          </button>
        )}
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-white/50 py-8">
          Aucune photo dans cette catégorie.
        </p>
      )}
    </div>
  );
}
