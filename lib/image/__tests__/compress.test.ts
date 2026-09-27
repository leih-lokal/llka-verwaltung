import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImageWithOutcome } from '../compress';
import { DEFAULT_IMAGE_COMPRESSION, type ImageCompressionSettings } from '@/types';

const cfg: ImageCompressionSettings = { ...DEFAULT_IMAGE_COMPRESSION, skip_if_smaller_than_kb: 0 };

const makeFile = (type: string, name = 'photo.png', size = 4096) =>
  new File([new Uint8Array(size)], name, { type });

const blobOf = (type: string, size = 16) => new Blob([new Uint8Array(size)], { type });

/**
 * Minimal Image + canvas stand-ins for the node test environment.
 * `blob` is what canvas.toBlob yields (null = encoder failure).
 * Returns the recorded 2D-context calls.
 */
function stubBrowser({ decodes = true, blob }: { decodes?: boolean; blob: Blob | null }) {
  const calls: string[] = [];
  class FakeImage {
    width = 800;
    height = 600;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_url: string) {
      queueMicrotask(() => (decodes ? this.onload?.() : this.onerror?.()));
    }
  }
  const ctx = {
    set fillStyle(value: string) {
      calls.push(`fillStyle:${value}`);
    },
    fillRect: () => calls.push('fillRect'),
    drawImage: () => calls.push('drawImage'),
  };
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) => cb(blob),
    }),
  });
  return calls;
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('compressImageWithOutcome', () => {
  it('skips SVG and GIF without touching the canvas', async () => {
    for (const type of ['image/svg+xml', 'image/gif']) {
      const file = makeFile(type);
      expect(await compressImageWithOutcome(file, cfg)).toEqual({ file, outcome: 'unsupported' });
    }
  });

  it('falls back to the original when decoding fails', async () => {
    stubBrowser({ decodes: false, blob: null });
    const file = makeFile('image/png');
    expect(await compressImageWithOutcome(file, cfg)).toEqual({ file, outcome: 'failed' });
  });

  it('falls back to the original when toBlob yields null', async () => {
    stubBrowser({ blob: null });
    const file = makeFile('image/png');
    expect(await compressImageWithOutcome(file, cfg)).toEqual({ file, outcome: 'failed' });
  });

  it('keeps the original when the output is not smaller', async () => {
    stubBrowser({ blob: blobOf('image/png', 8192) });
    const file = makeFile('image/png');
    expect(await compressImageWithOutcome(file, cfg)).toEqual({ file, outcome: 'larger' });
  });

  it('paints a white background before drawing when encoding to JPEG', async () => {
    const calls = stubBrowser({ blob: blobOf('image/jpeg') });
    const { file, outcome } = await compressImageWithOutcome(makeFile('image/png'), {
      ...cfg,
      output_format: 'jpeg',
    });
    expect(outcome).toBe('compressed');
    expect(file.name).toBe('photo.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(calls).toEqual(['fillStyle:#fff', 'fillRect', 'drawImage']);
  });

  it('does not fill the background for PNG output', async () => {
    const calls = stubBrowser({ blob: blobOf('image/png') });
    await compressImageWithOutcome(makeFile('image/png'), cfg);
    expect(calls).toEqual(['drawImage']);
  });

  it('names and types the output after the encoded blob, not the source', async () => {
    // 'keep' on a type the browser can't encode: canvas falls back to PNG.
    stubBrowser({ blob: blobOf('image/png') });
    const { file } = await compressImageWithOutcome(makeFile('image/bmp', 'scan.bmp'), cfg);
    expect(file.name).toBe('scan.png');
    expect(file.type).toBe('image/png');
  });
});
