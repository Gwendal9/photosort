import { useState } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { startAnalysis } from '../../services/tauriCommands';
import { FolderBrowser } from './FolderBrowser';
import type { Folder } from '../../types';

export function FolderPicker() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const { setSelectedFolders, startAnalysis: beginAnalysis, setSimilarityGroups, setAnalysisProgress } = usePhotoStore();

  const handleAddFolder = (path: string) => {
    // Check if folder is already added
    if (folders.some(f => f.path === path)) {
      return;
    }
    const newFolder: Folder = {
      path,
      name: path.split(/[/\\]/).pop() || path,
      isExcluded: false,
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  const handleRemoveFolder = (path: string) => {
    setFolders((prev) => prev.filter((f) => f.path !== path));
  };

  const handleStartAnalysis = async () => {
    if (folders.length === 0) return;

    const activeFolders = folders.filter((f) => !f.isExcluded);
    setSelectedFolders(activeFolders);
    beginAnalysis();

    try {
      const groups = await startAnalysis(
        activeFolders.map((f) => f.path),
        setAnalysisProgress
      );
      setSimilarityGroups(groups);
    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Bienvenue sur PhotoSort
        </h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          Sélectionnez les dossiers contenant vos photos pour commencer l'analyse et identifier les photos similaires.
        </p>

        <button
          onClick={() => setIsBrowserOpen(true)}
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Ajouter un dossier
        </button>
      </div>

      <FolderBrowser
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onSelect={handleAddFolder}
      />

      {folders.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Dossiers sélectionnés</h3>
          <ul className="space-y-2 mb-6">
            {folders.map((folder) => (
              <li
                key={folder.path}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="text-gray-700">{folder.path}</span>
                </div>
                <button
                  onClick={() => handleRemoveFolder(folder.path)}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex justify-end gap-4">
            <button
              onClick={() => setIsBrowserOpen(true)}
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Ajouter un autre dossier
            </button>
            <button
              onClick={handleStartAnalysis}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Lancer l'analyse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
