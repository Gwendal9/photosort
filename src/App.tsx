import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { FolderPicker } from './components/folders/FolderPicker';
import { ComparisonView } from './components/comparison/ComparisonView';
import { TrashView } from './components/trash/TrashView';
import { ProgressBar } from './components/common/ProgressBar';
import { Toast } from './components/common/Toast';
import { usePhotoStore } from './stores/photoStore';
import type { AnalysisProgress } from './types';

type View = 'home' | 'comparison' | 'trash';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const { isAnalyzing, analysisProgress, setAnalysisProgress, toasts, removeToast } = usePhotoStore();

  // Listen for analysis progress events from Tauri
  useEffect(() => {
    const unlisten = listen<AnalysisProgress>('analysis-progress', (event) => {
      setAnalysisProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setAnalysisProgress]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">PhotoSort</h1>
            <nav className="flex gap-4">
              <button
                onClick={() => setCurrentView('home')}
                className={`px-3 py-2 rounded-md ${currentView === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Accueil
              </button>
              <button
                onClick={() => setCurrentView('comparison')}
                className={`px-3 py-2 rounded-md ${currentView === 'comparison' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Comparaison
              </button>
              <button
                onClick={() => setCurrentView('trash')}
                className={`px-3 py-2 rounded-md ${currentView === 'trash' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Corbeille
              </button>
            </nav>
          </div>
        </div>
      </header>

      {isAnalyzing && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <ProgressBar
            current={analysisProgress.current}
            total={analysisProgress.total}
            label={analysisProgress.status || "Analyse en cours..."}
          />
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {currentView === 'home' && <FolderPicker />}
        {currentView === 'comparison' && <ComparisonView />}
        {currentView === 'trash' && <TrashView />}
      </main>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
