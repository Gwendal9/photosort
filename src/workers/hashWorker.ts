// Web Worker for perceptual image hashing + quality analysis (combined single pass)
// Computes: 16x16 gradient hash (256-bit) + Laplacian sharpness + exposure histogram

interface AnalyzeRequest {
  type: 'hash';
  id: string;
  buffer: ArrayBuffer;
}

interface AnalyzeResponse {
  type: 'result';
  id: string;
  hash: Uint8Array;
  qualityScore: number;
  blurScore: number;
  exposureScore: number;
}

interface ErrorResponse {
  type: 'error';
  id: string;
  message: string;
}

const HASH_SIZE = 16; // 16x16 = 256-bit hash (was 8x8 = 64-bit)
const QUALITY_MAX_DIM = 200;

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { type, id, buffer } = e.data;
  if (type !== 'hash') return;

  try {
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);

    // --- Hash: draw onto (HASH_SIZE+1) x HASH_SIZE for gradient ---
    const hashCanvas = new OffscreenCanvas(HASH_SIZE + 1, HASH_SIZE);
    const hashCtx = hashCanvas.getContext('2d')!;
    hashCtx.drawImage(bitmap, 0, 0, HASH_SIZE + 1, HASH_SIZE);
    const hashImageData = hashCtx.getImageData(0, 0, HASH_SIZE + 1, HASH_SIZE);
    const hashPixels = hashImageData.data;

    // Grayscale for hash
    const hashGray: number[] = [];
    for (let i = 0; i < hashPixels.length; i += 4) {
      hashGray.push(0.299 * hashPixels[i] + 0.587 * hashPixels[i + 1] + 0.114 * hashPixels[i + 2]);
    }

    // Gradient hash: compare each pixel with right neighbor → HASH_SIZE x HASH_SIZE bits
    const hashBytes = HASH_SIZE * HASH_SIZE / 8; // 256 / 8 = 32 bytes
    const hash = new Uint8Array(hashBytes);
    let bitIndex = 0;
    for (let y = 0; y < HASH_SIZE; y++) {
      for (let x = 0; x < HASH_SIZE; x++) {
        const idx = y * (HASH_SIZE + 1) + x;
        if (hashGray[idx] < hashGray[idx + 1]) {
          const byteIdx = bitIndex >> 3;
          const bitPos = 7 - (bitIndex & 7);
          hash[byteIdx] |= 1 << bitPos;
        }
        bitIndex++;
      }
    }

    // --- Quality: resize to ~200px max ---
    const scale = Math.min(1, QUALITY_MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const qw = Math.round(bitmap.width * scale);
    const qh = Math.round(bitmap.height * scale);

    const qualCanvas = new OffscreenCanvas(qw, qh);
    const qualCtx = qualCanvas.getContext('2d')!;
    qualCtx.drawImage(bitmap, 0, 0, qw, qh);
    bitmap.close();

    const qualImageData = qualCtx.getImageData(0, 0, qw, qh);
    const qualPixels = qualImageData.data;

    const gray = new Float32Array(qw * qh);
    const histogram = new Uint32Array(256);
    for (let i = 0; i < qw * qh; i++) {
      const ri = i * 4;
      const lum = 0.299 * qualPixels[ri] + 0.587 * qualPixels[ri + 1] + 0.114 * qualPixels[ri + 2];
      gray[i] = lum;
      histogram[Math.min(255, Math.round(lum))]++;
    }

    const blurScore = computeBlurScore(gray, qw, qh);
    const exposureScore = computeExposureScore(histogram, qw * qh);
    const qualityScore = Math.round(0.7 * blurScore + 0.3 * exposureScore);

    const response: AnalyzeResponse = {
      type: 'result',
      id,
      hash,
      qualityScore,
      blurScore: Math.round(blurScore),
      exposureScore: Math.round(exposureScore),
    };
    self.postMessage(response, { transfer: [hash.buffer] });
  } catch (err) {
    const response: ErrorResponse = {
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};

function computeBlurScore(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        gray[idx - w] +
        gray[idx - 1] +
        -4 * gray[idx] +
        gray[idx + 1] +
        gray[idx + w];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 50;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.round(Math.min(variance / 800, 1) * 100);
}

function computeExposureScore(histogram: Uint32Array, totalPixels: number): number {
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
    sumSq += i * i * histogram[i];
  }

  const mean = sum / totalPixels;
  const variance = sumSq / totalPixels - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));

  const meanPenalty = 1 - Math.abs(mean - 128) / 128;
  const spreadScore = Math.min(stdDev / 60, 1);

  let darkClip = 0;
  for (let i = 0; i < 10; i++) darkClip += histogram[i];
  let brightClip = 0;
  for (let i = 246; i < 256; i++) brightClip += histogram[i];
  const clipPenalty = 1 - Math.min(1, ((darkClip + brightClip) / totalPixels) * 3);

  const score = (0.5 * meanPenalty + 0.3 * spreadScore + 0.2 * Math.max(0, clipPenalty)) * 100;
  return Math.max(0, Math.min(100, score));
}
