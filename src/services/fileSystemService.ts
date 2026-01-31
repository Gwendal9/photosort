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
const blobUrlRegistry = new Map<string, string>();      // full-res blob URLs (for viewer)
const thumbUrlRegistry = new Map<string, string>();      // thumbnail blob URLs (for grid)

const THUMB_SIZE = 300; // max dimension for grid thumbnails

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

        // Try to get image dimensions + create thumbnail while we have the File
        let width = 0;
        let height = 0;
        try {
          const bitmap = await createImageBitmap(file);
          width = bitmap.width;
          height = bitmap.height;

          // Generate thumbnail for grid display (avoids decoding full-res on scroll)
          if (!thumbUrlRegistry.has(id)) {
            const scale = Math.min(1, THUMB_SIZE / Math.max(width, height));
            const tw = Math.round(width * scale);
            const th = Math.round(height * scale);
            const canvas = new OffscreenCanvas(tw, th);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(bitmap, 0, 0, tw, th);
            const thumbBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
            thumbUrlRegistry.set(id, URL.createObjectURL(thumbBlob));
          }

          bitmap.close();
        } catch {
          // Can't decode (e.g. RAW files) — dimensions stay 0
          // Fallback: use full file as blob URL
          if (!thumbUrlRegistry.has(id)) {
            thumbUrlRegistry.set(id, URL.createObjectURL(file));
          }
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

/** Synchronous cache check — returns thumbnail URL for grid display */
export function getCachedBlobUrl(photoId: string): string | null {
  return thumbUrlRegistry.get(photoId) ?? blobUrlRegistry.get(photoId) ?? null;
}

/** Get thumbnail blob URL (for grid cards) */
export async function getBlobUrl(photoId: string): Promise<string> {
  const thumb = thumbUrlRegistry.get(photoId);
  if (thumb) return thumb;

  const existing = blobUrlRegistry.get(photoId);
  if (existing) return existing;

  const entry = fileRegistry.get(photoId);
  if (!entry) throw new Error(`Photo ${photoId} not found in registry`);

  const file = await entry.fileHandle.getFile();
  const url = URL.createObjectURL(file);
  blobUrlRegistry.set(photoId, url);
  return url;
}

/** Get full-resolution blob URL (for viewer/lightbox) */
export async function getFullBlobUrl(photoId: string): Promise<string> {
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
  if (url) { URL.revokeObjectURL(url); blobUrlRegistry.delete(photoId); }
  const thumb = thumbUrlRegistry.get(photoId);
  if (thumb) { URL.revokeObjectURL(thumb); thumbUrlRegistry.delete(photoId); }
}

export function revokeAllBlobUrls(): void {
  for (const url of blobUrlRegistry.values()) URL.revokeObjectURL(url);
  blobUrlRegistry.clear();
  for (const url of thumbUrlRegistry.values()) URL.revokeObjectURL(url);
  thumbUrlRegistry.clear();
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
