import { usePhotoStore } from '../../stores/photoStore';

export function SelectionBar() {
  const { selectedIds, clearSelection, trashSelected } = usePhotoStore();

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 glass-header border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-white font-medium">
          {selectedIds.length} photo{selectedIds.length > 1 ? 's' : ''} sélectionnée{selectedIds.length > 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <button
            onClick={clearSelection}
            className="px-4 py-1.5 text-white/70 hover:bg-white/10 rounded-lg transition-colors text-sm"
          >
            Tout désélectionner
          </button>
          <button
            onClick={trashSelected}
            className="px-4 py-1.5 bg-red-500/30 border border-red-400/30 text-white rounded-lg hover:bg-red-500/40 transition-colors text-sm"
          >
            Mettre en corbeille ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
}
