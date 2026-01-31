import { useState } from 'react';
import { FolderPicker } from './components/folders/FolderPicker';
import { ComparisonView } from './components/comparison/ComparisonView';
import { QualityView } from './components/quality/QualityView';
import { TrashView } from './components/trash/TrashView';
import { TimelineView } from './components/timeline/TimelineView';
import { ProgressBar } from './components/common/ProgressBar';
import { Toast } from './components/common/Toast';
import { SelectionBar } from './components/common/SelectionBar';
import { usePhotoStore } from './stores/photoStore';
import { isFileSystemAccessSupported } from './services/fileSystemService';

type View = 'home' | 'comparison' | 'quality' | 'timeline' | 'trash';

const STATUS_LABELS: Record<string, string> = {
  scanning: 'Scan des dossiers...',
  hashing: 'Analyse des photos...',
  comparing: 'Comparaison des photos...',
  complete: 'Analyse terminée',
};

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const { isAnalyzing, analysisProgress, toasts, removeToast } = usePhotoStore();
  const supported = isFileSystemAccessSupported();

  return (
    <div className="min-h-screen">
      {/* Browser compatibility banner */}
      {!supported && (
        <div className="bg-red-500/80 backdrop-blur text-white px-4 py-3 text-center text-sm">
          <strong>Navigateur non compatible.</strong> PhotoSort nécessite Chrome ou Edge pour accéder à vos fichiers locaux.
        </div>
      )}

      <header className="glass-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">PhotoSort</h1>
            <nav className="flex gap-2">
              <button
                onClick={() => setCurrentView('home')}
                className={`px-3 py-2 rounded-md transition-colors ${currentView === 'home' ? 'bg-white/25 text-white' : 'text-white/70 hover:bg-white/10'}`}
              >
                Accueil
              </button>
              <button
                onClick={() => setCurrentView('comparison')}
                className={`px-3 py-2 rounded-md transition-colors ${currentView === 'comparison' ? 'bg-white/25 text-white' : 'text-white/70 hover:bg-white/10'}`}
              >
                Comparaison
              </button>
              <button
                onClick={() => setCurrentView('quality')}
                className={`px-3 py-2 rounded-md transition-colors ${currentView === 'quality' ? 'bg-white/25 text-white' : 'text-white/70 hover:bg-white/10'}`}
              >
                Qualité
              </button>
              <button
                onClick={() => setCurrentView('timeline')}
                className={`px-3 py-2 rounded-md transition-colors ${currentView === 'timeline' ? 'bg-white/25 text-white' : 'text-white/70 hover:bg-white/10'}`}
              >
                Timeline
              </button>
              <button
                onClick={() => setCurrentView('trash')}
                className={`px-3 py-2 rounded-md transition-colors ${currentView === 'trash' ? 'bg-white/25 text-white' : 'text-white/70 hover:bg-white/10'}`}
              >
                Corbeille
              </button>
            </nav>
          </div>
        </div>
      </header>

      {isAnalyzing && (
        <div className="glass border-b border-white/10 px-4 py-3">
          <ProgressBar
            current={analysisProgress.current}
            total={analysisProgress.total}
            label={STATUS_LABELS[analysisProgress.status] || 'Analyse en cours...'}
          />
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {currentView === 'home' && <FolderPicker />}
        {currentView === 'comparison' && <ComparisonView />}
        {currentView === 'quality' && <QualityView />}
        {currentView === 'timeline' && <TimelineView />}
        {currentView === 'trash' && <TrashView />}
      </main>

      {/* Selection bar */}
      <SelectionBar />

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
