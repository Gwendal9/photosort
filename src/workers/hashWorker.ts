// Web Worker for perceptual image hashing + quality analysis + document detection
// Computes: 16x16 gradient hash (256-bit) + Laplacian sharpness + exposure histogram
//           + document detection

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
  photoType: 'photo' | 'document';
}

interface ErrorResponse {
  type: 'error';
  id: string;
  message: string;
}

const HASH_SIZE = 16; // 16x16 = 256-bit hash
const QUALITY_MAX_DIM = 200;

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { type, id, buffer } = e.data;
  if (type !== 'hash') return;

  try {
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);

    const imgWidth = bitmap.width;
    const imgHeight = bitmap.height;

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

    // Gradient hash: compare each pixel with right neighbor
    const hashBytes = HASH_SIZE * HASH_SIZE / 8;
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

    // --- Quality + classification: resize to ~200px max ---
    const scale = Math.min(1, QUALITY_MAX_DIM / Math.max(imgWidth, imgHeight));
    const qw = Math.round(imgWidth * scale);
    const qh = Math.round(imgHeight * scale);

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

    // --- Classification: document vs photo ---
    const totalPixels = qw * qh;
    const photoType = isDocument(qualPixels, totalPixels, imgWidth, imgHeight, histogram)
      ? 'document' as const
      : 'photo' as const;

    const response: AnalyzeResponse = {
      type: 'result',
      id,
      hash,
      qualityScore,
      blurScore: Math.round(blurScore),
      exposureScore: Math.round(exposureScore),
      photoType,
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

// --- Document detection ---

function isDocument(
  pixels: Uint8ClampedArray,
  totalPixels: number,
  origW: number,
  origH: number,
  histogram: Uint32Array,
): boolean {
  // Criterion 1: aspect ratio close to A4 (1:1.414) or Letter (1:1.294)
  const ratio = Math.max(origW, origH) / Math.min(origW, origH);
  const isA4Ratio = Math.abs(ratio - 1.414) < 0.15;
  const isLetterRatio = Math.abs(ratio - 1.294) < 0.15;
  const hasDocRatio = isA4Ratio || isLetterRatio;

  // Criterion 2: high percentage of near-white pixels (luminance > 220)
  let whitePixels = 0;
  for (let i = 220; i < 256; i++) whitePixels += histogram[i];
  const whitePct = whitePixels / totalPixels;

  // Criterion 3: low color diversity — count unique color "buckets" (quantized to 4-bit per channel)
  const colorBuckets = new Set<number>();
  for (let i = 0; i < totalPixels * 4; i += 4) {
    const r = pixels[i] >> 4;
    const g = pixels[i + 1] >> 4;
    const b = pixels[i + 2] >> 4;
    colorBuckets.add((r << 8) | (g << 4) | b);
  }
  const lowColors = colorBuckets.size < 150;

  // Document = high white + low colors, or doc ratio + decent white
  if (whitePct > 0.55 && lowColors) return true;
  if (hasDocRatio && whitePct > 0.45 && colorBuckets.size < 250) return true;

  return false;
}

// --- Quality scoring ---

function computeBlurScore(gray: Float32Array, w: number, h: number): number {
  // Split image into blocks and take the sharpest block.
  // This prevents artistic bokeh (sharp subject + blurred bg) from being
  // penalized: if any region is sharp, the photo is intentionally composed.
  const BLOCKS = 4; // 4x4 = 16 blocks
  const bw = Math.floor((w - 2) / BLOCKS);
  const bh = Math.floor((h - 2) / BLOCKS);

  if (bw < 4 || bh < 4) {
    // Image too small for blocks, fall back to global
    return computeLaplacianVariance(gray, w, 1, 1, w - 2, h - 2);
  }

  let maxScore = 0;
  let globalSum = 0;
  let globalSumSq = 0;
  let globalCount = 0;

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      const x0 = 1 + bx * bw;
      const y0 = 1 + by * bh;
      const x1 = (bx === BLOCKS - 1) ? w - 1 : x0 + bw;
      const y1 = (by === BLOCKS - 1) ? h - 1 : y0 + bh;

      let sum = 0;
      let sumSq = 0;
      let count = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * w + x;
          const lap =
            gray[idx - w] + gray[idx - 1] + -4 * gray[idx] + gray[idx + 1] + gray[idx + w];
          sum += lap;
          sumSq += lap * lap;
          count++;
        }
      }

      if (count > 0) {
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        const score = Math.min(variance / 800, 1) * 100;
        if (score > maxScore) maxScore = score;
        globalSum += sum;
        globalSumSq += sumSq;
        globalCount += count;
      }
    }
  }

  // Final score: 70% sharpest block + 30% global average
  // Photos with intentional blur score high because their sharp region dominates
  const globalMean = globalSum / globalCount;
  const globalVariance = globalSumSq / globalCount - globalMean * globalMean;
  const globalScore = Math.min(globalVariance / 800, 1) * 100;

  return Math.round(0.7 * maxScore + 0.3 * globalScore);
}

function computeLaplacianVariance(
  gray: Float32Array, w: number,
  x0: number, y0: number, x1: number, y1: number,
): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = y * w + x;
      const lap =
        gray[idx - w] + gray[idx - 1] + -4 * gray[idx] + gray[idx + 1] + gray[idx + w];
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
