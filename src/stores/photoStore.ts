import { create } from 'zustand';
import type { Photo, SimilarityGroup, TrashItem, AnalysisProgress, AppError, Folder } from '../types';

interface PhotoStore {
  // State
  photos: Photo[];
  similarityGroups: SimilarityGroup[];
  trashItems: TrashItem[];
  selectedFolders: Folder[];
  isLoading: boolean;
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress;
  error: AppError | null;
  similarityThreshold: number;

  // Actions
  setPhotos: (photos: Photo[]) => void;
  setSimilarityGroups: (groups: SimilarityGroup[]) => void;
  addToTrash: (photo: Photo) => void;
  restoreFromTrash: (id: string) => void;
  emptyTrash: () => void;
  setSelectedFolders: (folders: Folder[]) => void;
  setAnalysisProgress: (progress: AnalysisProgress) => void;
  setError: (error: AppError | null) => void;
  setSimilarityThreshold: (threshold: number) => void;
  startAnalysis: () => void;
  stopAnalysis: () => void;
}

export const usePhotoStore = create<PhotoStore>((set) => ({
  // Initial state
  photos: [],
  similarityGroups: [],
  trashItems: [],
  selectedFolders: [],
  isLoading: false,
  isAnalyzing: false,
  analysisProgress: { current: 0, total: 0, status: 'idle' },
  error: null,
  similarityThreshold: 0.85,

  // Actions
  setPhotos: (photos) => set({ photos }),

  setSimilarityGroups: (groups) => set({ similarityGroups: groups }),

  addToTrash: (photo) =>
    set((state) => ({
      trashItems: [
        ...state.trashItems,
        {
          id: crypto.randomUUID(),
          photo,
          deletedAt: new Date().toISOString(),
          originalPath: photo.path,
        },
      ],
      photos: state.photos.filter((p) => p.id !== photo.id),
    })),

  restoreFromTrash: (id) =>
    set((state) => {
      const item = state.trashItems.find((t) => t.id === id);
      if (!item) return state;
      return {
        trashItems: state.trashItems.filter((t) => t.id !== id),
        photos: [...state.photos, item.photo],
      };
    }),

  emptyTrash: () => set({ trashItems: [] }),

  setSelectedFolders: (folders) => set({ selectedFolders: folders }),

  setAnalysisProgress: (progress) =>
    set({
      analysisProgress: progress,
      isAnalyzing: progress.status !== 'idle' && progress.status !== 'complete',
    }),

  setError: (error) => set({ error }),

  setSimilarityThreshold: (threshold) => set({ similarityThreshold: threshold }),

  startAnalysis: () =>
    set({
      isAnalyzing: true,
      analysisProgress: { current: 0, total: 0, status: 'scanning' },
      error: null,
    }),

  stopAnalysis: () =>
    set({
      isAnalyzing: false,
      analysisProgress: { current: 0, total: 0, status: 'idle' },
    }),
}));
