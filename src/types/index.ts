// Core domain types for PhotoSort

export interface Photo {
  id: string;
  path: string;
  filename: string;
  size: number;
  width: number;
  height: number;
  createdAt: string;
  modifiedAt: string;
  thumbnailPath?: string;
  embedding?: number[];
}

export interface SimilarityGroup {
  id: string;
  photos: Photo[];
  similarity: number;
}

export interface TrashItem {
  id: string;
  photo: Photo;
  deletedAt: string;
  originalPath: string;
}

export interface AnalysisProgress {
  current: number;
  total: number;
  status: 'idle' | 'scanning' | 'analyzing' | 'grouping' | 'complete';
  estimatedTimeRemaining?: number;
}

export interface AppError {
  code: 'FILE_NOT_FOUND' | 'PERMISSION_DENIED' | 'ANALYSIS_FAILED' | 'DB_ERROR' | 'SIDECAR_ERROR';
  message: string;
  userMessage: string;
}

export interface Folder {
  path: string;
  name: string;
  photoCount?: number;
  isExcluded: boolean;
}
