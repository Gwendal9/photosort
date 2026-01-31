import { useState, useRef, useEffect } from 'react';
import { usePhotoStore } from '../../stores/photoStore';
import { pickDirectory, scanDirectory, isFileSystemAccessSupported, countPhotosInDirectory, IMAGE_EXTENSIONS } from '../../services/fileSystemService';
import { analyzePhotos } from '../../services/analysisService';
import type { Folder, Photo } from '../../types';

export function FolderPicker() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [resultSummary, setResultSummary] = useState<{ photos: number; groups: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const {
    setSelectedFolders,
    startAnalysis: beginAnalysis,
    stopAnalysis,
    setSimilarityGroups,
    setAnalysisProgress,
    setPhotos,
    similarityThreshold,
    setSimilarityThreshold,
    showToast,
    isAnalyzing,
  } = usePhotoStore();

  const supported = isFileSystemAccessSupported();

  // Reset completion animation after 5 seconds
  useEffect(() => {
    if (analysisComplete) {
      const timer = setTimeout(() => setAnalysisComplete(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [analysisComplete]);

  // Reset start animation after 2 seconds
  useEffect(() => {
    if (analysisStarted && !isAnalyzing) {
      setAnalysisStarted(false);
    }
  }, [analysisStarted, isAnalyzing]);

  const handleAddFolder = async () => {
    if (!supported) return;

    const dirHandle = await pickDirectory();
    if (!dirHandle) return;

    // Check if folder is already added
    if (folders.some(f => f.name === dirHandle.name)) {
      showToast('Ce dossier est déjà ajouté', 'info');
      return;
    }

    const newFolder: Folder = {
      path: dirHandle.name,
      name: dirHandle.name,
      isExcluded: false,
      dirHandle,
    };

    setFolders((prev) => [...prev, newFolder]);

    // Pre-scan: count photos without reading file contents
    countPhotosInDirectory(dirHandle).then((count) => {
      setFolders((prev) =>
        prev.map((f) => (f.name === dirHandle.name ? { ...f, photoCount: count } : f)),
      );
    });
  };

  const handleRemoveFolder = (name: string) => {
    setFolders((prev) => prev.filter((f) => f.name !== name));
  };

  const handleStartAnalysis = async () => {
    const activeFolders = folders.filter((f) => !f.isExcluded && f.dirHandle);
    if (activeFolders.length === 0) return;

    setSelectedFolders(activeFolders);
    beginAnalysis();
    setAnalysisStarted(true);
    setAnalysisComplete(false);
    setResultSummary(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // Phase 1: Scan directories
      setAnalysisProgress({ current: 0, total: 0, status: 'scanning' });
      const photos: Photo[] = [];

      for (const folder of activeFolders) {
        if (abort.signal.aborted) return;
        const folderPhotos = await scanDirectory(folder.dirHandle!, (count) => {
          setAnalysisProgress({ current: photos.length + count, total: 0, status: 'scanning' });
        });
        photos.push(...folderPhotos);
      }

      if (photos.length === 0) {
        showToast('Aucune photo trouvée dans les dossiers sélectionnés', 'info');
        stopAnalysis();
        return;
      }

      // Phase 2+3: Hash (with quality) & Compare — single file read per photo
      const { groups, qualityMap } = await analyzePhotos(
        photos,
        similarityThreshold,
        setAnalysisProgress,
        abort.signal,
      );

      if (abort.signal.aborted) return;

      // Merge quality scores + classification into photos
      const photosWithQuality = photos.map((p) => {
        const q = qualityMap.get(p.id);
        return q
          ? { ...p, qualityScore: q.qualityScore, blurScore: q.blurScore, exposureScore: q.exposureScore, photoType: q.photoType }
          : p;
      });

      setPhotos(photosWithQuality);
      setAllPhotos(photosWithQuality);

      setSimilarityGroups(groups);
      setAnalysisProgress({ current: 0, total: 0, status: 'complete' });
      setAnalysisComplete(true);
      setResultSummary({ photos: photosWithQuality.length, groups: groups.length });
      showToast(
        groups.length > 0
          ? `${groups.length} groupe${groups.length > 1 ? 's' : ''} de photos similaires trouvé${groups.length > 1 ? 's' : ''}`
          : 'Aucune photo similaire détectée',
        groups.length > 0 ? 'success' : 'info',
      );
    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
      showToast('Erreur lors de l\'analyse', 'error');
    } finally {
      abortRef.current = null;
      stopAnalysis();
    }
  };

  const handleCancelAnalysis = () => {
    abortRef.current?.abort();
    stopAnalysis();
    showToast('Analyse annulée', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-white mb-4">
          Bienvenue sur PhotoSort
        </h2>
        <p className="text-white/70 mb-8 max-w-md mx-auto">
          Sélectionnez les dossiers contenant vos photos pour commencer l'analyse et identifier les photos similaires.
        </p>

        <button
          onClick={handleAddFolder}
          disabled={!supported}
          className="glass-button inline-flex items-center px-6 py-3"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Ajouter un dossier
        </button>

        <div className="mt-6 text-sm text-white/50">
          <p className="mb-2">Formats pris en charge :</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {[...IMAGE_EXTENSIONS].map((ext) => (
              <span key={ext} className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/70 uppercase">
                .{ext}
              </span>
            ))}
          </div>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Dossiers sélectionnés</h3>
          <ul className="space-y-2 mb-6">
            {folders.map((folder) => (
              <li
                key={folder.name}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="text-white/90">{folder.name}</span>
                  {folder.photoCount !== undefined && (
                    <span className="ml-2 text-sm text-white/50">
                      ({folder.photoCount} photos)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveFolder(folder.name)}
                  className="text-red-400 hover:text-red-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {folders.some((f) => f.photoCount !== undefined) && (
            <div className="mb-4 text-sm text-white/60 text-right">
              Total : {folders.reduce((sum, f) => sum + (f.photoCount ?? 0), 0)} photos détectées
            </div>
          )}

          <div className="mb-6 pt-4 border-t border-white/10">
            <label className="flex items-center justify-between text-sm font-medium text-white/70 mb-2">
              <span>Seuil de similarité</span>
              <span className="text-white font-semibold">{Math.round(similarityThreshold * 100)}%</span>
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
              <span>50% — Plus de résultats</span>
              <span>99% — Plus précis</span>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={handleAddFolder}
              className="px-4 py-2 text-white/70 hover:bg-white/10 rounded-lg transition-colors"
            >
              Ajouter un autre dossier
            </button>
            {isAnalyzing ? (
              <button
                onClick={handleCancelAnalysis}
                className="px-6 py-2 bg-red-500/30 border border-red-400/30 text-white rounded-lg hover:bg-red-500/40 transition-colors"
              >
                Annuler l'analyse
              </button>
            ) : (
              <button
                onClick={handleStartAnalysis}
                className="px-6 py-2 bg-green-500/30 border border-green-400/30 text-white rounded-lg hover:bg-green-500/40 transition-colors"
              >
                Lancer l'analyse
              </button>
            )}
          </div>
        </div>
      )}

      {/* Analysis started animation */}
      {isAnalyzing && analysisStarted && (
        <div className="glass-card p-6 text-center animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
            <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Analyse en cours...</h3>
          <p className="text-white/60 text-sm">
            Analyse des photos au seuil de {Math.round(similarityThreshold * 100)}%
          </p>
        </div>
      )}

      {/* Analysis complete animation */}
      {analysisComplete && resultSummary && (
        <div className="glass-card p-6 text-center animate-slide-up border border-green-400/30">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Analyse terminée</h3>
          <div className="flex justify-center gap-8 text-sm">
            <div>
              <p className="text-2xl font-bold text-blue-300">{resultSummary.photos}</p>
              <p className="text-white/50">photos analysées</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-300">{resultSummary.groups}</p>
              <p className="text-white/50">groupes similaires</p>
            </div>
          </div>
          <p className="text-white/40 text-xs mt-3">
            Consultez les onglets Comparaison, Qualité et Timeline pour explorer vos photos.
          </p>
        </div>
      )}

      {/* Show scanned photos count */}
      {allPhotos.length > 0 && !isAnalyzing && !analysisComplete && (
        <div className="glass-card p-4 text-center">
          <p className="text-white/70">
            {allPhotos.length} photo{allPhotos.length > 1 ? 's' : ''} trouvée{allPhotos.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
