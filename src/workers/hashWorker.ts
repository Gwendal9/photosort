// Web Worker for perceptual image hashing
// Replicates the Gradient hash algorithm from the Rust backend (8x8 = 64-bit hash)

// Message types
interface HashRequest {
  type: 'hash';
  id: string;
  buffer: ArrayBuffer;
}

interface HashResponse {
  type: 'result';
  id: string;
  hash: Uint8Array;
}

interface ErrorResponse {
  type: 'error';
  id: string;
  message: string;
}

self.onmessage = async (e: MessageEvent<HashRequest>) => {
  const { type, id, buffer } = e.data;

  if (type !== 'hash') return;

  try {
    // Create image bitmap from buffer
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);

    // Draw onto 9x8 OffscreenCanvas (9 wide for gradient calculation → 8x8 hash)
    const canvas = new OffscreenCanvas(9, 8);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, 9, 8);
    bitmap.close();

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, 9, 8);
    const pixels = imageData.data; // RGBA flat array

    // Convert to grayscale (9x8 grid)
    const gray: number[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
      // Luminance formula: 0.299R + 0.587G + 0.114B
      gray.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }

    // Gradient hash: compare each pixel with its right neighbor
    // This produces 8x8 = 64 bits packed into 8 bytes
    const hash = new Uint8Array(8);
    for (let y = 0; y < 8; y++) {
      let byte = 0;
      for (let x = 0; x < 8; x++) {
        const idx = y * 9 + x;
        if (gray[idx] < gray[idx + 1]) {
          byte |= 1 << (7 - x);
        }
      }
      hash[y] = byte;
    }

    const response: HashResponse = { type: 'result', id, hash };
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
