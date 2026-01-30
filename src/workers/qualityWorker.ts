// Web Worker for image quality analysis (sharpness + exposure)

interface QualityRequest {
  type: 'analyze';
  id: string;
  buffer: ArrayBuffer;
}

interface QualityResponse {
  type: 'result';
  id: string;
  qualityScore: number;
  blurScore: number;
  exposureScore: number;
}

interface ErrorResponse {
  type: 'error';
  id: string;
  message: string;
}

const MAX_DIM = 200;

self.onmessage = async (e: MessageEvent<QualityRequest>) => {
  const { type, id, buffer } = e.data;
  if (type !== 'analyze') return;

  try {
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);

    // Resize to max ~200px for performance
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;

    // Convert to grayscale
    const gray = new Float32Array(w * h);
    const histogram = new Uint32Array(256);
    for (let i = 0; i < w * h; i++) {
      const ri = i * 4;
      const lum = 0.299 * pixels[ri] + 0.587 * pixels[ri + 1] + 0.114 * pixels[ri + 2];
      gray[i] = lum;
      histogram[Math.min(255, Math.round(lum))]++;
    }

    // --- Sharpness via Laplacian variance ---
    const blurScore = computeBlurScore(gray, w, h);

    // --- Exposure score via histogram analysis ---
    const exposureScore = computeExposureScore(histogram, w * h);

    // Global score: weighted combination
    const qualityScore = Math.round(0.7 * blurScore + 0.3 * exposureScore);

    const response: QualityResponse = {
      type: 'result',
      id,
      qualityScore,
      blurScore: Math.round(blurScore),
      exposureScore: Math.round(exposureScore),
    };
    self.postMessage(response);
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
  // Apply Laplacian kernel [0,1,0; 1,-4,1; 0,1,0]
  // Then compute variance of the result
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        gray[idx - w] +          // top
        gray[idx - 1] +          // left
        -4 * gray[idx] +         // center
        gray[idx + 1] +          // right
        gray[idx + w];           // bottom

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 50;

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;

  // Map variance to 0-100 score
  // Typical values: blurry < 100, sharp > 500
  // Use a sigmoid-like mapping
  const normalized = Math.min(variance / 800, 1);
  return Math.round(normalized * 100);
}

function computeExposureScore(histogram: Uint32Array, totalPixels: number): number {
  // Compute mean and standard deviation of the luminance distribution
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
    sumSq += i * i * histogram[i];
  }

  const mean = sum / totalPixels;
  const variance = sumSq / totalPixels - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));

  // Penalize mean too far from center (128)
  const meanPenalty = 1 - Math.abs(mean - 128) / 128;

  // Penalize very low spread (flat/washed out) or very narrow (low contrast)
  // Good stdDev is around 50-70
  const spreadScore = Math.min(stdDev / 60, 1);

  // Check for clipping: too many pixels at extremes
  const darkClip = histogram.slice(0, 10).reduce((a, b) => a + b, 0) / totalPixels;
  const brightClip = histogram.slice(246).reduce((a, b) => a + b, 0) / totalPixels;
  const clipPenalty = 1 - Math.min(1, (darkClip + brightClip) * 3);

  const score = (0.5 * meanPenalty + 0.3 * spreadScore + 0.2 * Math.max(0, clipPenalty)) * 100;
  return Math.max(0, Math.min(100, score));
}
