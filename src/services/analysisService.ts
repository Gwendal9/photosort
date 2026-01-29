// Analysis service: orchestrates hashing + comparison using Web Workers

import type { Photo, SimilarityGroup, AnalysisProgress } from '../types';
import { getFileArrayBuffer } from './fileSystemService';
// @ts-ignore — Vite worker URL import
import HashWorkerURL from '../workers/hashWorker.ts?worker&url';

type ProgressCallback = (progress: AnalysisProgress) => void;

interface HashResult {
  id: string;
  hash: Uint8Array;
}

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let distance = 0;
  for (let i = 0; i < 8; i++) {
    let xor = a[i] ^ b[i];
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

function similarity(a: Uint8Array, b: Uint8Array): number {
  const dist = hammingDistance(a, b);
  return 1 - dist / 64;
}

export async function analyzePhotos(
  photos: Photo[],
  threshold: number,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<SimilarityGroup[]> {
  if (photos.length === 0) return [];

  // Phase 1: Hashing
  onProgress({ current: 0, total: photos.length, status: 'hashing' });

  const workerCount = Math.min(navigator.hardwareConcurrency || 4, photos.length, 8);
  const hashes = await hashPhotos(photos, workerCount, onProgress, signal);

  if (signal?.aborted) return [];

  // Phase 2: Comparing
  const totalPairs = (hashes.length * (hashes.length - 1)) / 2;
  onProgress({ current: 0, total: totalPairs, status: 'comparing' });

  const groups = compareAndGroup(hashes, photos, threshold, onProgress, signal);

  if (signal?.aborted) return [];

  onProgress({ current: totalPairs, total: totalPairs, status: 'complete' });
  return groups;
}

async function hashPhotos(
  photos: Photo[],
  workerCount: number,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<HashResult[]> {
  const results: HashResult[] = [];
  let completed = 0;

  return new Promise((resolve) => {
    const workers: Worker[] = [];
    const queue = [...photos];

    const cleanup = () => {
      workers.forEach((w) => w.terminate());
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        resolve([]);
      });
    }

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(HashWorkerURL, { type: 'module' });
      workers.push(worker);

      worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'result') {
          results.push({ id: data.id, hash: new Uint8Array(data.hash) });
        } else if (data.type === 'error') {
          console.warn(`Hash error for ${data.id}: ${data.message}`);
        }

        completed++;
        onProgress({ current: completed, total: photos.length, status: 'hashing' });

        // Feed next item from queue
        processNext(worker);

        if (completed === photos.length) {
          cleanup();
          resolve(results);
        }
      };

      worker.onerror = (err) => {
        console.error('Worker error:', err);
        completed++;
        processNext(worker);

        if (completed === photos.length) {
          cleanup();
          resolve(results);
        }
      };

      // Start first item
      processNext(worker);
    }

    async function processNext(worker: Worker) {
      if (signal?.aborted) return;
      const photo = queue.shift();
      if (!photo) return;

      try {
        const buffer = await getFileArrayBuffer(photo.id);
        worker.postMessage(
          { type: 'hash', id: photo.id, buffer },
          { transfer: [buffer] },
        );
      } catch (err) {
        console.warn(`Failed to read ${photo.filename}:`, err);
        completed++;
        onProgress({ current: completed, total: photos.length, status: 'hashing' });
        processNext(worker);
        if (completed === photos.length) {
          cleanup();
          resolve(results);
        }
      }
    }
  });
}

function compareAndGroup(
  hashes: HashResult[],
  photos: Photo[],
  threshold: number,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): SimilarityGroup[] {
  const photoMap = new Map(photos.map((p) => [p.id, p]));

  // Union-Find for grouping
  const parent = new Map<string, string>();
  const groupSimilarity = new Map<string, number>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  function union(a: string, b: string, sim: number) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
      // Track minimum similarity in group
      const currentSim = groupSimilarity.get(rootA) ?? 1;
      groupSimilarity.set(rootA, Math.min(currentSim, sim));
    }
  }

  const totalPairs = (hashes.length * (hashes.length - 1)) / 2;
  let pairsChecked = 0;
  let lastProgressUpdate = 0;

  for (let i = 0; i < hashes.length; i++) {
    if (signal?.aborted) return [];
    for (let j = i + 1; j < hashes.length; j++) {
      const sim = similarity(hashes[i].hash, hashes[j].hash);
      if (sim >= threshold) {
        union(hashes[i].id, hashes[j].id, sim);
      }
      pairsChecked++;

      // Update progress every 1000 pairs
      if (pairsChecked - lastProgressUpdate >= 1000 || pairsChecked === totalPairs) {
        onProgress({ current: pairsChecked, total: totalPairs, status: 'comparing' });
        lastProgressUpdate = pairsChecked;
      }
    }
  }

  // Collect groups
  const groupMembers = new Map<string, string[]>();
  for (const hash of hashes) {
    const root = find(hash.id);
    if (!groupMembers.has(root)) groupMembers.set(root, []);
    groupMembers.get(root)!.push(hash.id);
  }

  const groups: SimilarityGroup[] = [];
  for (const [root, memberIds] of groupMembers) {
    if (memberIds.length < 2) continue;

    const groupPhotos = memberIds
      .map((id) => photoMap.get(id))
      .filter((p): p is Photo => p !== undefined);

    if (groupPhotos.length < 2) continue;

    groups.push({
      id: crypto.randomUUID(),
      photos: groupPhotos,
      similarity: groupSimilarity.get(root) ?? threshold,
    });
  }

  // Sort groups by number of photos (descending)
  groups.sort((a, b) => b.photos.length - a.photos.length);

  return groups;
}
