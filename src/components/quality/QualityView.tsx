import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { PhotoCard } from '../photos/PhotoCard';
import { PhotoViewer } from '../common/PhotoViewer';

type QualityCategory = 'all' | 'poor' | 'average' | 'good';
type TypeCategory = 'all' | 'photo' | 'document';

const QUALITY_LABELS: Record<QualityCategory, string> = {
  all: 'Toutes',
  poor: 'Mauvaises',
  average: 'Moyennes',
  good: 'Bonnes',
};

const TYPE_LABELS: Record<TypeCategory, string> = {
  all: 'Tous types',
  photo: 'Photos',
  document: 'Documents',
};

const PAGE_SIZE = 40;

function categorize(score: number | undefined): 'poor' | 'average' | 'good' {
  if (score === undefined) return 'average';
  if (score < 40) return 'poor';
  if (score < 70) return 'average';
  return 'good';
}

export function QualityView() {
  const photos = usePhotoStore((s) => s.photos);
  const qualityFilter = usePhotoStore((s) => s.qualityFilter);
  const setQualityFilter = usePhotoStore((s) => s.setQualityFilter);
  const typeFilter = usePhotoStore((s) => s.typeFilter);
  const setTypeFilter = usePhotoStore((s) => s.setTypeFilter);
  const addToTrash = usePhotoStore((s) => s.addToTrash);
  const showToast = usePhotoStore((s) => s.showToast);
  const selectedIds = usePhotoStore((s) => s.selectedIds);
  const toggleSelect = usePhotoStore((s) => s.toggleSelect);
  const shiftSelect = usePhotoStore((s) => s.shiftSelect);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const batchMode = selectedIds.length > 0;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const photosWithQuality = useMemo(
    () => photos.filter((p) => p.qualityScore !== undefined),
    [photos],
  );

  const stats = useMemo(() => {
    let good = 0, average = 0, poor = 0;
    let documents = 0, realPhotos = 0;
    for (const p of photosWithQuality) {
      const cat = categorize(p.qualityScore);
      if (cat === 'good') good++;
      else if (cat === 'average') average++;
      else poor++;

      if (p.photoType === 'document') documents++;
      else realPhotos++;
    }
    return { good, average, poor, total: photosWithQuality.length, documents, realPhotos };
  }, [photosWithQuality]);

  const filtered = useMemo(() => {
    let list = photosWithQuality;

    if (qualityFilter !== 'all') {
      list = list.filter((p) => categorize(p.qualityScore) === qualityFilter);
    }
    if (typeFilter !== 'all') {
      list = list.filter((p) => (p.photoType ?? 'photo') === typeFilter);
    }

    return [...list].sort((a, b) => (a.qualityScore ?? 50) - (b.qualityScore ?? 50));
  }, [photosWithQuality, qualityFilter, typeFilter]);

  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered]);

  // Ref-stabilize so handleToggleSelect callback never changes
  const filteredIdsRef = useRef(filteredIds);
  filteredIdsRef.current = filteredIds;

  // Reset pagination when filters change
  const handleQualityFilter = useCallback((f: QualityCategory) => {
    setQualityFilter(f);
    setVisibleCount(PAGE_SIZE);
  }, [setQualityFilter]);

  const handleTypeFilter = useCallback((f: TypeCategory) => {
    setTypeFilter(f);
    setVisibleCount(PAGE_SIZE);
  }, [setTypeFilter]);

  const handleTrashPoor = () => {
    const poorPhotos = photosWithQuality.filter((p) => categorize(p.qualityScore) === 'poor');
    if (poorPhotos.length === 0) return;
    for (const p of poorPhotos) addToTrash(p);
    showToast(`${poorPhotos.length} photo${poorPhotos.length > 1 ? 's' : ''} de mauvaise qualité mise${poorPhotos.length > 1 ? 's' : ''} en corbeille`, 'success');
  };

  const handleTrashType = (type: 'document') => {
    const targets = photosWithQuality.filter((p) => p.photoType === type);
    if (targets.length === 0) return;
    for (const p of targets) addToTrash(p);
    showToast(`${targets.length} document${targets.length > 1 ? 's' : ''} mis en corbeille`, 'success');
  };

  // Stable callback — never changes reference
  const handleToggleSelect = useCallback((id: string, shiftKey: boolean) => {
    if (shiftKey) {
      shiftSelect(id, filteredIdsRef.current);
    } else {
      toggleSelect(id);
    }
  }, [shiftSelect, toggleSelect]);

  const visiblePhotos = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Infinite scroll: auto-load more when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { rootMargin: '600px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

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
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        <div className="bg-white/8 border border-white/15 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.good}</p>
          <p className="text-xs text-white/60">Bonnes</p>
        </div>
        <div className="bg-white/8 border border-white/15 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.average}</p>
          <p className="text-xs text-white/60">Moyennes</p>
        </div>
        <div className="bg-white/8 border border-white/15 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.poor}</p>
          <p className="text-xs text-white/60">Mauvaises</p>
        </div>
        <div className="bg-white/8 border border-white/15 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.realPhotos}</p>
          <p className="text-xs text-white/60">Photos</p>
        </div>
        <div className="bg-white/8 border border-white/15 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-cyan-400">{stats.documents}</p>
          <p className="text-xs text-white/60">Documents</p>
        </div>
      </div>

      {/* Filter toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {(['all', 'poor', 'average', 'good'] as QualityCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => handleQualityFilter(cat)}
                className={`px-2.5 py-1 rounded-md text-sm transition-colors ${
                  qualityFilter === cat
                    ? 'bg-white/20 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {QUALITY_LABELS[cat]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {(['all', 'photo', 'document'] as TypeCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => handleTypeFilter(cat)}
                className={`px-2.5 py-1 rounded-md text-sm transition-colors ${
                  typeFilter === cat
                    ? 'bg-white/20 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {TYPE_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {stats.poor > 0 && (
            <button
              onClick={handleTrashPoor}
              className="px-3 py-1.5 bg-red-500/30 border border-red-400/30 text-white text-sm rounded-lg hover:bg-red-500/40 transition-colors"
            >
              Corbeille mauvaises ({stats.poor})
            </button>
          )}
          {stats.documents > 0 && (
            <button
              onClick={() => handleTrashType('document')}
              className="px-3 py-1.5 bg-cyan-500/30 border border-cyan-400/30 text-white text-sm rounded-lg hover:bg-cyan-500/40 transition-colors"
            >
              Corbeille documents ({stats.documents})
            </button>
          )}
        </div>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {visiblePhotos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            selected={selectedSet.has(photo.id)}
            onToggleSelect={handleToggleSelect}
            batchMode={batchMode}
            onView={setViewingPhotoId}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-4" />}

      {filtered.length === 0 && (
        <p className="text-center text-white/50 py-8">
          Aucune photo dans cette catégorie.
        </p>
      )}

      {batchMode && <div className="h-16" />}

      {/* Photo viewer lightbox */}
      {viewingPhotoId && (() => {
        const viewingPhoto = filtered.find((p) => p.id === viewingPhotoId);
        if (!viewingPhoto) return null;
        return (
          <PhotoViewer
            photo={viewingPhoto}
            photoIds={filteredIds}
            onClose={() => setViewingPhotoId(null)}
            onNavigate={setViewingPhotoId}
          />
        );
      })()}
    </div>
  );
}
