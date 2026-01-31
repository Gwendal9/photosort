import { create } from 'zustand';
import type { Photo, SimilarityGroup, TrashItem, AnalysisProgress, AppError, Folder } from '../types';
import { revokeAllBlobUrls } from '../services/fileSystemService';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

type QualityFilter = 'all' | 'poor' | 'average' | 'good';
type TypeFilter = 'all' | 'photo' | 'screenshot' | 'document';

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
  qualityFilter: QualityFilter;
  typeFilter: TypeFilter;
  selectedIds: string[];
  lastSelectedId: string | null;
  toasts: ToastMessage[];

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
  setQualityFilter: (filter: QualityFilter) => void;
  setTypeFilter: (filter: TypeFilter) => void;
  toggleSelect: (id: string) => void;
  shiftSelect: (id: string, visibleIds: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  trashSelected: () => void;
  startAnalysis: () => void;
  stopAnalysis: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  revokeAllBlobUrls: () => void;
}

export const usePhotoStore = create<PhotoStore>((set, get) => ({
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
  qualityFilter: 'all',
  typeFilter: 'all',
  selectedIds: [],
  lastSelectedId: null,
  toasts: [],

  // Actions
  setPhotos: (photos) => set({ photos }),

  setSimilarityGroups: (groups) => set({ similarityGroups: groups }),

  addToTrash: (photo) =>
    set((state) => {
      const alreadyInTrash = state.trashItems.some(
        (item) => item.photo.path === photo.path
      );

      if (alreadyInTrash) {
        const toastId = crypto.randomUUID();
        setTimeout(() => get().removeToast(toastId), 3000);
        return {
          toasts: [...state.toasts, {
            id: toastId,
            message: 'Cette photo est déjà dans la corbeille',
            type: 'info' as const,
          }],
        };
      }

      const toastId = crypto.randomUUID();
      setTimeout(() => get().removeToast(toastId), 3000);

      const updatedGroups = state.similarityGroups.map(group => ({
        ...group,
        photos: group.photos.filter(p => p.id !== photo.id),
      })).filter(group => group.photos.length >= 2);

      return {
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
        similarityGroups: updatedGroups,
        toasts: [...state.toasts, {
          id: toastId,
          message: `"${photo.filename}" déplacé vers la corbeille`,
          type: 'success' as const,
        }],
      };
    }),

  restoreFromTrash: (id) =>
    set((state) => {
      const item = state.trashItems.find((t) => t.id === id);
      if (!item) return state;

      const toastId = crypto.randomUUID();
      setTimeout(() => get().removeToast(toastId), 3000);

      return {
        trashItems: state.trashItems.filter((t) => t.id !== id),
        photos: [...state.photos, item.photo],
        toasts: [...state.toasts, {
          id: toastId,
          message: `"${item.photo.filename}" restauré`,
          type: 'success' as const,
        }],
      };
    }),

  emptyTrash: () => set((state) => {
    const count = state.trashItems.length;
    const toastId = crypto.randomUUID();
    setTimeout(() => get().removeToast(toastId), 3000);

    return {
      trashItems: [],
      toasts: [...state.toasts, {
        id: toastId,
        message: `${count} photo${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''} définitivement`,
        type: 'success' as const,
      }],
    };
  }),

  setSelectedFolders: (folders) => set({ selectedFolders: folders }),

  setAnalysisProgress: (progress) =>
    set({
      analysisProgress: progress,
      isAnalyzing: progress.status !== 'idle' && progress.status !== 'complete',
    }),

  setError: (error) => set({ error }),

  setSimilarityThreshold: (threshold) => set({ similarityThreshold: threshold }),

  setQualityFilter: (filter) => set({ qualityFilter: filter }),

  setTypeFilter: (filter) => set({ typeFilter: filter }),

  toggleSelect: (id) =>
    set((state) => {
      const isSelected = state.selectedIds.includes(id);
      return {
        selectedIds: isSelected
          ? state.selectedIds.filter((sid) => sid !== id)
          : [...state.selectedIds, id],
        lastSelectedId: isSelected ? state.lastSelectedId : id,
      };
    }),

  shiftSelect: (id, visibleIds) =>
    set((state) => {
      const lastId = state.lastSelectedId;
      if (!lastId) return { selectedIds: [id], lastSelectedId: id };

      const lastIdx = visibleIds.indexOf(lastId);
      const curIdx = visibleIds.indexOf(id);
      if (lastIdx === -1 || curIdx === -1) return { selectedIds: [id], lastSelectedId: id };

      const start = Math.min(lastIdx, curIdx);
      const end = Math.max(lastIdx, curIdx);
      const rangeIds = visibleIds.slice(start, end + 1);

      // Merge with existing selection
      const merged = new Set([...state.selectedIds, ...rangeIds]);
      return { selectedIds: [...merged], lastSelectedId: id };
    }),

  selectAll: (ids) => set({ selectedIds: ids }),

  clearSelection: () => set({ selectedIds: [], lastSelectedId: null }),

  trashSelected: () =>
    set((state) => {
      const selectedSet = new Set(state.selectedIds);
      const photosToTrash = state.photos.filter((p) => selectedSet.has(p.id));
      if (photosToTrash.length === 0) return state;

      const toastId = crypto.randomUUID();
      setTimeout(() => get().removeToast(toastId), 3000);

      const newTrashItems = photosToTrash.map((photo) => ({
        id: crypto.randomUUID(),
        photo,
        deletedAt: new Date().toISOString(),
        originalPath: photo.path,
      }));

      const updatedGroups = state.similarityGroups.map((group) => ({
        ...group,
        photos: group.photos.filter((p) => !selectedSet.has(p.id)),
      })).filter((group) => group.photos.length >= 2);

      return {
        photos: state.photos.filter((p) => !selectedSet.has(p.id)),
        trashItems: [...state.trashItems, ...newTrashItems],
        similarityGroups: updatedGroups,
        selectedIds: [],
        lastSelectedId: null,
        toasts: [...state.toasts, {
          id: toastId,
          message: `${photosToTrash.length} photo${photosToTrash.length > 1 ? 's' : ''} déplacée${photosToTrash.length > 1 ? 's' : ''} vers la corbeille`,
          type: 'success' as const,
        }],
      };
    }),

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

  showToast: (message, type = 'info') =>
    set((state) => {
      const toastId = crypto.randomUUID();
      setTimeout(() => get().removeToast(toastId), 3000);
      return {
        toasts: [...state.toasts, { id: toastId, message, type }],
      };
    }),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  revokeAllBlobUrls: () => {
    revokeAllBlobUrls();
  },
}));
