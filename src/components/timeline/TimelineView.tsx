import { useMemo, useState, useCallback } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { PhotoCard } from '../photos/PhotoCard';
import { PhotoViewer } from '../common/PhotoViewer';
import type { Photo } from '../../types';

interface DayGroup {
  key: string;       // YYYY-MM-DD
  label: string;     // formatted display label
  photos: Photo[];
}

const DAYS_PER_PAGE = 10;

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const formatted = DATE_FORMATTER.format(date);
  // Capitalize first letter
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function toDayKey(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '0000-00-00';
  return d.toISOString().slice(0, 10);
}

export function TimelineView() {
  const { photos, selectedIds, toggleSelect, shiftSelect, selectAll, typeFilter, setTypeFilter } = usePhotoStore();
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);

  const batchMode = selectedIds.length > 0;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Group photos by day, sorted newest first
  const dayGroups = useMemo(() => {
    let filtered = photos;
    if (typeFilter !== 'all') {
      filtered = photos.filter((p) => (p.photoType ?? 'photo') === typeFilter);
    }

    const groups = new Map<string, Photo[]>();
    for (const photo of filtered) {
      const key = toDayKey(photo.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(photo);
    }

    // Sort each day's photos by time (newest first)
    const result: DayGroup[] = [];
    for (const [key, dayPhotos] of groups) {
      dayPhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      result.push({
        key,
        label: key === '0000-00-00' ? 'Date inconnue' : formatDayLabel(key),
        photos: dayPhotos,
      });
    }

    // Sort days newest first
    result.sort((a, b) => (b.key > a.key ? 1 : b.key < a.key ? -1 : 0));
    return result;
  }, [photos, typeFilter]);

  // All visible photo IDs (for shift-select)
  const allVisibleIds = useMemo(() => {
    return dayGroups.slice(0, visibleDays).flatMap((g) => g.photos.map((p) => p.id));
  }, [dayGroups, visibleDays]);

  const handleToggleSelect = useCallback((id: string, shiftKey: boolean) => {
    if (shiftKey) {
      shiftSelect(id, allVisibleIds);
    } else {
      toggleSelect(id);
    }
  }, [shiftSelect, toggleSelect, allVisibleIds]);

  const handleSelectDay = useCallback((dayPhotos: Photo[]) => {
    const dayIds = dayPhotos.map((p) => p.id);
    const allSelected = dayIds.every((id) => selectedSet.has(id));
    if (allSelected) {
      // Deselect all from this day
      const remaining = selectedIds.filter((id) => !new Set(dayIds).has(id));
      selectAll(remaining);
    } else {
      // Add all from this day
      const merged = new Set([...selectedIds, ...dayIds]);
      selectAll([...merged]);
    }
  }, [selectedIds, selectedSet, selectAll]);

  const handleTypeFilter = useCallback((f: typeof typeFilter) => {
    setTypeFilter(f);
    setVisibleDays(DAYS_PER_PAGE);
  }, [setTypeFilter]);

  const visibleGroups = dayGroups.slice(0, visibleDays);
  const hasMore = visibleDays < dayGroups.length;
  const totalPhotos = dayGroups.reduce((sum, g) => sum + g.photos.length, 0);

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-white/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-xl font-semibold text-white mb-2">Aucune photo</h3>
        <p className="text-white/60">
          Lancez une analyse depuis l'accueil pour voir la chronologie.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header stats + type filter */}
      <div className="flex items-center justify-between">
        <p className="text-white/70">
          {totalPhotos} photo{totalPhotos > 1 ? 's' : ''} sur {dayGroups.length} jour{dayGroups.length > 1 ? 's' : ''}
        </p>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['all', 'photo', 'document'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => handleTypeFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-sm transition-colors ${
                typeFilter === cat
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {{ all: 'Tous', photo: 'Photos', document: 'Documents' }[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Day groups */}
      {visibleGroups.map((group) => {
        const allDaySelected = group.photos.every((p) => selectedSet.has(p.id));

        return (
          <div key={group.key}>
            {/* Day header */}
            <div className="sticky top-[72px] z-30 glass-header py-2 px-3 rounded-lg mb-3 flex items-center justify-between">
              <div>
                <span className="text-white font-medium">{group.label}</span>
                <span className="text-white/50 text-sm ml-2">
                  {group.photos.length} photo{group.photos.length > 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => handleSelectDay(group.photos)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  allDaySelected
                    ? 'bg-blue-500/30 text-blue-300'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {allDaySelected ? 'Désélectionner le jour' : 'Sélectionner le jour'}
              </button>
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {group.photos.map((photo) => (
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
          </div>
        );
      })}

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => setVisibleDays((c) => c + DAYS_PER_PAGE)}
            className="px-6 py-2 bg-white/10 text-white/80 rounded-lg hover:bg-white/15 transition-colors"
          >
            Voir plus ({dayGroups.length - visibleDays} jour{dayGroups.length - visibleDays > 1 ? 's' : ''} restant{dayGroups.length - visibleDays > 1 ? 's' : ''})
          </button>
        </div>
      )}

      {/* Bottom spacing for selection bar */}
      {batchMode && <div className="h-16" />}

      {/* Photo viewer lightbox */}
      {viewingPhotoId && (() => {
        const allVisiblePhotos = visibleGroups.flatMap((g) => g.photos);
        const viewingPhoto = allVisiblePhotos.find((p) => p.id === viewingPhotoId);
        if (!viewingPhoto) return null;
        return (
          <PhotoViewer
            photo={viewingPhoto}
            photoIds={allVisibleIds}

            onClose={() => setViewingPhotoId(null)}
            onNavigate={setViewingPhotoId}
          />
        );
      })()}
    </div>
  );
}
