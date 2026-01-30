// Analysis service: orchestrates hashing + quality + comparison using Web Workers

import type { Photo, SimilarityGroup, AnalysisProgress } from '../types';
import { getFileArrayBuffer } from './fileSystemService';
// @ts-ignore — Vite worker URL import
import HashWorkerURL from '../workers/hashWorker.ts?worker&url';

type ProgressCallback = (progress: AnalysisProgress) => void;

interface HashResult {
  id: string;
  hash: Uint8Array;
  qualityScore: number;
  blurScore: number;
  exposureScore: number;
}

const HASH_BITS = 256; // 16x16 hash

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
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
  return 1 - dist / HASH_BITS;
}

export interface AnalysisResult {
  groups: SimilarityGroup[];
  qualityMap: Map<string, { qualityScore: number; blurScore: number; exposureScore: number }>;
}

export async function analyzePhotos(
  photos: Photo[],
  threshold: number,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  if (photos.length === 0) return { groups: [], qualityMap: new Map() };

  // Phase 1: Hashing + Quality (single pass)
  onProgress({ current: 0, total: photos.length, status: 'hashing' });

  const workerCount = Math.min(navigator.hardwareConcurrency || 4, photos.length, 8);
  const hashes = await hashPhotos(photos, workerCount, onProgress, signal);

  if (signal?.aborted) return { groups: [], qualityMap: new Map() };

  // Extract quality map
  const qualityMap = new Map<string, { qualityScore: number; blurScore: number; exposureScore: number }>();
  for (const h of hashes) {
    qualityMap.set(h.id, {
      qualityScore: h.qualityScore,
      blurScore: h.blurScore,
      exposureScore: h.exposureScore,
    });
  }

  // Phase 2: Comparing (with date-based pre-grouping for performance)
  const totalPairs = estimatePairs(hashes, photos);
  onProgress({ current: 0, total: totalPairs, status: 'comparing' });

  const groups = compareAndGroup(hashes, photos, threshold, onProgress, signal);

  if (signal?.aborted) return { groups: [], qualityMap: new Map() };

  onProgress({ current: totalPairs, total: totalPairs, status: 'complete' });
  return { groups, qualityMap };
}

function estimatePairs(hashes: HashResult[], photos: Photo[]): number {
  // Estimate pair count for progress (uses date buckets if available)
  const buckets = buildDateBuckets(hashes, photos);
  let total = 0;
  for (const bucket of buckets.values()) {
    total += (bucket.length * (bucket.length - 1)) / 2;
  }
  return total;
}

async function hashPhotos(
  photos: Photo[],
  workerCount: number,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<HashResult[]> {
  const results: HashResult[] = [];
  let completed = 0;
  let lastProgressTime = 0;

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

    const reportProgress = () => {
      const now = performance.now();
      // Throttle to max ~15 updates/sec to avoid UI jank
      if (now - lastProgressTime > 66 || completed === photos.length) {
        onProgress({ current: completed, total: photos.length, status: 'hashing' });
        lastProgressTime = now;
      }
    };

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(HashWorkerURL, { type: 'module' });
      workers.push(worker);

      worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'result') {
          results.push({
            id: data.id,
            hash: new Uint8Array(data.hash),
            qualityScore: data.qualityScore,
            blurScore: data.blurScore,
            exposureScore: data.exposureScore,
          });
        } else if (data.type === 'error') {
          console.warn(`Hash error for ${data.id}: ${data.message}`);
        }

        completed++;
        reportProgress();

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
        reportProgress();
        processNext(worker);
        if (completed === photos.length) {
          cleanup();
          resolve(results);
        }
      }
    }
  });
}

// Group hashes into date buckets (±24h window) for faster comparison
function buildDateBuckets(
  hashes: HashResult[],
  photos: Photo[],
): Map<string, HashResult[]> {
  const photoMap = new Map(photos.map((p) => [p.id, p]));
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Photos without dates go into a single "unknown" bucket
  const buckets = new Map<string, HashResult[]>();
  const unknownBucket: HashResult[] = [];

  for (const h of hashes) {
    const photo = photoMap.get(h.id);
    if (!photo || !photo.createdAt) {
      unknownBucket.push(h);
      continue;
    }

    const time = new Date(photo.createdAt).getTime();
    if (isNaN(time)) {
      unknownBucket.push(h);
      continue;
    }

    // Add to this day and adjacent days (±1) so photos near midnight boundaries match
    for (let offset = -1; offset <= 1; offset++) {
      const key = String(Math.floor(time / DAY_MS) + offset);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(h);
    }
  }

  // If there are few photos or no date info, fall back to single bucket
  if (buckets.size === 0 || unknownBucket.length > hashes.length * 0.5) {
    return new Map([['all', hashes]]);
  }

  if (unknownBucket.length > 0) {
    buckets.set('unknown', unknownBucket);
  }

  return buckets;
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
      const currentSim = groupSimilarity.get(rootA) ?? 1;
      groupSimilarity.set(rootA, Math.min(currentSim, sim));
    }
  }

  // Date-based bucketing for O(n) within buckets instead of global O(n²)
  const buckets = buildDateBuckets(hashes, photos);

  let pairsChecked = 0;
  let lastProgressTime = 0;

  const totalPairs = estimatePairs(hashes, photos);

  // Track already-compared pairs to avoid duplicates across overlapping buckets
  const comparedPairs = new Set<string>();

  for (const bucket of buckets.values()) {
    if (signal?.aborted) return [];

    for (let i = 0; i < bucket.length; i++) {
      if (signal?.aborted) return [];
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];

        // Skip if same photo or already compared
        if (a.id === b.id) continue;
        const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (comparedPairs.has(pairKey)) {
          continue;
        }
        comparedPairs.add(pairKey);

        const sim = similarity(a.hash, b.hash);
        if (sim >= threshold) {
          union(a.id, b.id, sim);
        }
        pairsChecked++;

        const now = performance.now();
        if (now - lastProgressTime > 66) {
          onProgress({ current: Math.min(pairsChecked, totalPairs), total: totalPairs, status: 'comparing' });
          lastProgressTime = now;
        }
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

    const uniqueIds = [...new Set(memberIds)];
    const groupPhotos = uniqueIds
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
