import { useState } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { deleteFiles } from '../../services/fileSystemService';
import { useBlobUrl } from '../../hooks/useBlobUrl';

function TrashItemImage({ photoId, filename }: { photoId: string; filename: string }) {
  const { url } = useBlobUrl(photoId);
  return (
    <img
      src={url ?? undefined}
      alt={filename}
      className="w-full h-full object-cover opacity-75"
      onError={(e) => (e.currentTarget.style.display = 'none')}
    />
  );
}

export function TrashView() {
  const { trashItems, restoreFromTrash, emptyTrash, showToast } = usePhotoStore();
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);

  const totalSize = trashItems.reduce((acc, item) => acc + item.photo.size, 0);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleEmptyTrash = async () => {
    try {
      const photoIds = trashItems.map(item => item.photo.id);
      const result = await deleteFiles(photoIds);

      if (result.errors.length > 0) {
        console.error('Erreurs lors de la suppression:', result.errors);
        showToast(`${result.errors.length} erreur(s) lors de la suppression`, 'error');
      }

      emptyTrash();
      setShowConfirmEmpty(false);
    } catch (error) {
      console.error('Erreur lors du vidage de la corbeille:', error);
      showToast('Erreur lors du vidage de la corbeille', 'error');
    }
  };

  if (trashItems.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-white/20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <h3 className="text-lg font-medium text-white mb-2">Corbeille vide</h3>
        <p className="text-white/50">
          Les photos supprimées apparaîtront ici avant suppression définitive.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Corbeille</h2>
            <p className="text-white/50">
              {trashItems.length} photo{trashItems.length > 1 ? 's' : ''} • {formatSize(totalSize)}
            </p>
          </div>
          <button
            onClick={() => setShowConfirmEmpty(true)}
            className="px-4 py-2 bg-red-500/30 border border-red-400/30 text-white rounded-lg hover:bg-red-500/40 transition-colors"
          >
            Vider la corbeille
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirmEmpty && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">
              Vider la corbeille ?
            </h3>
            <p className="text-white/60 mb-4">
              Cette action est irréversible. {trashItems.length} photo{trashItems.length > 1 ? 's' : ''}
              {' '}seront supprimées définitivement, libérant {formatSize(totalSize)}.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmEmpty(false)}
                className="px-4 py-2 text-white/70 hover:bg-white/10 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleEmptyTrash}
                className="px-4 py-2 bg-red-500/30 border border-red-400/30 text-white rounded-lg hover:bg-red-500/40 transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash items grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {trashItems.map((item) => (
          <div key={item.id} className="glass-card overflow-hidden">
            <div className="aspect-video bg-white/5 relative">
              <TrashItemImage photoId={item.photo.id} filename={item.photo.filename} />
            </div>
            <div className="p-4">
              <p className="font-medium text-white truncate">{item.photo.filename}</p>
              <p className="text-sm text-white/50">
                {formatSize(item.photo.size)} • Supprimé le {formatDate(item.deletedAt)}
              </p>
              <button
                onClick={() => restoreFromTrash(item.id)}
                className="mt-3 w-full px-4 py-2 text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
              >
                Restaurer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
