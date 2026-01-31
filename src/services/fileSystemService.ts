// File System Access API service — replaces Tauri backend
// Only works on Chromium-based browsers (Chrome, Edge)

import type { Photo } from '../types';

export const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif',
  'heic', 'heif', 'cr2', 'nef', 'arw', 'dng',
]);

export async function countPhotosInDirectory(
  dirHandle: FileSystemDirectoryHandle,
): Promise<number> {
  let count = 0;

  async function walk(handle: FileSystemDirectoryHandle) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        await walk(entry);
      } else if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        if (IMAGE_EXTENSIONS.has(ext)) count++;
      }
    }
  }

  await walk(dirHandle);
  return count;
}

interface FileEntry {
  fileHandle: FileSystemFileHandle;
  parentDirHandle: FileSystemDirectoryHandle;
  fileName: string;
  relativePath: string;
}

// Internal registry: maps photo ID → file entry (non-serializable handles)
const fileRegistry = new Map<string, FileEntry>();
const blobUrlRegistry = new Map<string, string>();

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    // User cancelled the picker
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null;
    }
    throw err;
  }
}

export async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (count: number) => void,
): Promise<Photo[]> {
  const photos: Photo[] = [];

  async function walk(
    handle: FileSystemDirectoryHandle,
    pathPrefix: string,
  ) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        await walk(entry, `${pathPrefix}/${entry.name}`);
      } else if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        if (!IMAGE_EXTENSIONS.has(ext)) continue;

        const file = await entry.getFile();
        const id = crypto.randomUUID();
        const relativePath = `${pathPrefix}/${entry.name}`;

        fileRegistry.set(id, {
          fileHandle: entry,
          parentDirHandle: handle,
          fileName: entry.name,
          relativePath,
        });

        // Try to get image dimensions + create blob URL while we have the File
        let width = 0;
        let height = 0;
        try {
          const bitmap = await createImageBitmap(file);
          width = bitmap.width;
          height = bitmap.height;
          bitmap.close();
        } catch {
          // Can't decode (e.g. RAW files) — dimensions stay 0
        }

        // Cache blob URL now — avoids a second getFile() later
        if (!blobUrlRegistry.has(id)) {
          blobUrlRegistry.set(id, URL.createObjectURL(file));
        }

        photos.push({
          id,
          path: relativePath,
          filename: entry.name,
          size: file.size,
          width,
          height,
          createdAt: new Date(file.lastModified).toISOString(),
          modifiedAt: new Date(file.lastModified).toISOString(),
        });

        onProgress?.(photos.length);
      }
    }
  }

  await walk(dirHandle, dirHandle.name);
  return photos;
}

export async function getFileArrayBuffer(photoId: string): Promise<ArrayBuffer> {
  const entry = fileRegistry.get(photoId);
  if (!entry) throw new Error(`Photo ${photoId} not found in registry`);
  const file = await entry.fileHandle.getFile();
  return file.arrayBuffer();
}

export function createBlobUrl(photoId: string, file: File): string {
  // Revoke previous URL if exists
  const existing = blobUrlRegistry.get(photoId);
  if (existing) return existing;

  const url = URL.createObjectURL(file);
  blobUrlRegistry.set(photoId, url);
  return url;
}

/** Synchronous cache check — returns cached blob URL or null */
export function getCachedBlobUrl(photoId: string): string | null {
  return blobUrlRegistry.get(photoId) ?? null;
}

export async function getBlobUrl(photoId: string): Promise<string> {
  const existing = blobUrlRegistry.get(photoId);
  if (existing) return existing;

  const entry = fileRegistry.get(photoId);
  if (!entry) throw new Error(`Photo ${photoId} not found in registry`);

  const file = await entry.fileHandle.getFile();
  const url = URL.createObjectURL(file);
  blobUrlRegistry.set(photoId, url);
  return url;
}

/** Preload blob URLs for a batch of photo IDs (parallel with concurrency limit) */
export async function preloadBlobUrls(photoIds: string[], concurrency = 6): Promise<void> {
  const toLoad = photoIds.filter((id) => !blobUrlRegistry.has(id) && fileRegistry.has(id));
  if (toLoad.length === 0) return;

  let i = 0;
  async function next(): Promise<void> {
    while (i < toLoad.length) {
      const id = toLoad[i++];
      try {
        await getBlobUrl(id);
      } catch { /* skip errors */ }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, toLoad.length) }, () => next());
  await Promise.all(workers);
}

export function revokeBlobUrl(photoId: string): void {
  const url = blobUrlRegistry.get(photoId);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrlRegistry.delete(photoId);
  }
}

export function revokeAllBlobUrls(): void {
  for (const url of blobUrlRegistry.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlRegistry.clear();
}

export interface DeleteResult {
  deleted_count: number;
  freed_bytes: number;
  errors: string[];
}

export async function deleteFiles(photoIds: string[]): Promise<DeleteResult> {
  let deleted_count = 0;
  let freed_bytes = 0;
  const errors: string[] = [];

  for (const id of photoIds) {
    const entry = fileRegistry.get(id);
    if (!entry) {
      errors.push(`Photo ${id} not found in registry`);
      continue;
    }

    try {
      const file = await entry.fileHandle.getFile();
      const size = file.size;
      await entry.parentDirHandle.removeEntry(entry.fileName);
      deleted_count++;
      freed_bytes += size;

      // Clean up registries
      revokeBlobUrl(id);
      fileRegistry.delete(id);
    } catch (err) {
      errors.push(`Failed to delete ${entry.fileName}: ${err}`);
    }
  }

  return { deleted_count, freed_bytes, errors };
}

export function getRegisteredPhotoIds(): string[] {
  return Array.from(fileRegistry.keys());
}

export function isPhotoRegistered(photoId: string): boolean {
  return fileRegistry.has(photoId);
}
