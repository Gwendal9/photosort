import { invoke } from '@tauri-apps/api/core';
import type { Photo, SimilarityGroup, Folder, AnalysisProgress } from '../types';

// Scan commands
export async function scanFolder(path: string): Promise<Photo[]> {
  return invoke('scan_folder', { path });
}

export async function listSubfolders(path: string): Promise<Folder[]> {
  return invoke('list_subfolders', { path });
}

// Analysis commands
export async function startAnalysis(
  folderPaths: string[],
  _onProgress?: (progress: AnalysisProgress) => void
): Promise<SimilarityGroup[]> {
  // TODO: Listen for progress events via Tauri's event system
  return invoke('start_analysis', { folderPaths });
}

export async function cancelAnalysis(): Promise<void> {
  return invoke('cancel_analysis');
}

// Photo commands
export async function getPhotoThumbnail(photoId: string): Promise<string> {
  return invoke('get_photo_thumbnail', { photoId });
}

export async function getPhotoMetadata(photoId: string): Promise<Photo> {
  return invoke('get_photo_metadata', { photoId });
}

// Trash commands
export async function moveToTrash(photoIds: string[]): Promise<void> {
  return invoke('move_to_trash', { photoIds });
}

export async function restoreFromTrash(photoIds: string[]): Promise<void> {
  return invoke('restore_from_trash', { photoIds });
}

export async function emptyTrash(): Promise<{ freedBytes: number }> {
  return invoke('empty_trash');
}

// Delete files permanently from disk
export interface DeleteResult {
  deleted_count: number;
  freed_bytes: number;
  errors: string[];
}

export async function deleteFiles(filePaths: string[]): Promise<DeleteResult> {
  return invoke('delete_files', { filePaths });
}

export async function getTrashSize(): Promise<{ count: number; totalBytes: number }> {
  return invoke('get_trash_size');
}

// Settings commands
export async function setSimilarityThreshold(threshold: number): Promise<void> {
  return invoke('set_similarity_threshold', { threshold });
}

// File dialog
export async function selectFolder(): Promise<string | null> {
  return invoke('select_folder');
}

// Drive info type
export interface DriveInfo {
  path: string;
  name: string;
  drive_type: 'local' | 'wsl' | 'network';
}

// List available drives (including WSL mounts)
export async function listDrives(): Promise<DriveInfo[]> {
  return invoke('list_drives');
}

// Browse a directory
export async function browseDirectory(path: string): Promise<{ path: string; name: string }[]> {
  return invoke('browse_directory', { path });
}
