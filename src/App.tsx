import { useState } from 'react';
import { FolderPicker } from './components/folders/FolderPicker';
import { PhotoGrid } from './components/photos/PhotoGrid';
import { ComparisonView } from './components/comparison/ComparisonView';
import { TrashView } from './components/trash/TrashView';
import { ProgressBar } from './components/common/ProgressBar';
import { usePhotoStore } from './stores/photoStore';

type View = 'home' | 'photos' | 'comparison' | 'trash';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const { isAnalyzing, analysisProgress } = usePhotoStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
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
                onClick={() => setCurrentView('photos')}
                className={`px-3 py-2 rounded-md ${currentView === 'photos' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Photos
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
            label="Analyse en cours..."
          />
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {currentView === 'home' && <FolderPicker />}
        {currentView === 'photos' && <PhotoGrid />}
        {currentView === 'comparison' && <ComparisonView />}
        {currentView === 'trash' && <TrashView />}
      </main>
    </div>
  );
}

export default App;
