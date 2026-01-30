// Quality analysis service: orchestrates quality workers

import type { Photo, AnalysisProgress } from '../types';
import { getFileArrayBuffer } from './fileSystemService';
// @ts-ignore — Vite worker URL import
import QualityWorkerURL from '../workers/qualityWorker.ts?worker&url';

type ProgressCallback = (progress: AnalysisProgress) => void;

export interface QualityResult {
  id: string;
  qualityScore: number;
  blurScore: number;
  exposureScore: number;
}

export async function analyzeQuality(
  photos: Photo[],
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<Map<string, QualityResult>> {
  if (photos.length === 0) return new Map();

  onProgress({ current: 0, total: photos.length, status: 'quality' });

  const workerCount = Math.min(navigator.hardwareConcurrency || 4, photos.length, 8);
  const results = await runQualityWorkers(photos, workerCount, onProgress, signal);

  const resultMap = new Map<string, QualityResult>();
  for (const r of results) {
    resultMap.set(r.id, r);
  }
  return resultMap;
}

async function runQualityWorkers(
  photos: Photo[],
  workerCount: number,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<QualityResult[]> {
  const results: QualityResult[] = [];
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
      const worker = new Worker(QualityWorkerURL, { type: 'module' });
      workers.push(worker);

      worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'result') {
          results.push({
            id: data.id,
            qualityScore: data.qualityScore,
            blurScore: data.blurScore,
            exposureScore: data.exposureScore,
          });
        } else if (data.type === 'error') {
          console.warn(`Quality analysis error for ${data.id}: ${data.message}`);
        }

        completed++;
        onProgress({ current: completed, total: photos.length, status: 'quality' });

        processNext(worker);

        if (completed === photos.length) {
          cleanup();
          resolve(results);
        }
      };

      worker.onerror = (err) => {
        console.error('Quality worker error:', err);
        completed++;
        processNext(worker);

        if (completed === photos.length) {
          cleanup();
          resolve(results);
        }
      };

      processNext(worker);
    }

    async function processNext(worker: Worker) {
      if (signal?.aborted) return;
      const photo = queue.shift();
      if (!photo) return;

      try {
        const buffer = await getFileArrayBuffer(photo.id);
        worker.postMessage(
          { type: 'analyze', id: photo.id, buffer },
          { transfer: [buffer] },
        );
      } catch (err) {
        console.warn(`Failed to read ${photo.filename} for quality:`, err);
        completed++;
        onProgress({ current: completed, total: photos.length, status: 'quality' });
        processNext(worker);
        if (completed === photos.length) {
          cleanup();
          resolve(results);
        }
      }
    }
  });
}
