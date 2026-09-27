/**
 * Browser-side image compression for upload.
 *
 * Resizes images to a maximum longest edge and re-encodes them according to
 * the configured output format. Reads its parameters from the global
 * `image_compression` settings via `useSettings`, but accepts overrides for
 * special cases (e.g., favicons).
 */

import {
  DEFAULT_IMAGE_COMPRESSION,
  ImageCompressionSettings,
  ImageOutputFormat,
} from '@/types';

export interface CompressOverrides {
  max_dimension_px?: number;
  quality?: number;
  output_format?: ImageOutputFormat;
  skip_if_smaller_than_kb?: number;
  /** Force-disable compression for this call (e.g., user toggled it off mid-flow) */
  enabled?: boolean;
}

/**
 * What `compressImageWithOutcome` did. Anything but `compressed` means the
 * original file was returned unchanged:
 * - `unsupported`: SVG, GIF or not an image
 * - `larger`: the re-encoded output was not smaller than the input
 * - `failed`: decode/draw/encode error (e.g. canvas size limits on iOS Safari)
 */
export type CompressOutcome =
  | 'compressed'
  | 'disabled'
  | 'unsupported'
  | 'below_threshold'
  | 'larger'
  | 'failed';

export interface CompressResult {
  file: File;
  outcome: CompressOutcome;
}

// Canvas would rasterise SVGs and flatten animated GIFs to their first frame.
const SKIPPED_MIME = new Set(['image/svg+xml', 'image/gif']);

const FORMAT_TO_MIME: Record<Exclude<ImageOutputFormat, 'keep'>, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};

const MIME_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function renameForMime(name: string, mime: string): string {
  const ext = MIME_EXT[mime];
  if (!ext) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${ext}`;
}

function loadImage(file: Blob): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const revoke = () => URL.revokeObjectURL(url);
    img.onload = () => resolve({ img, revoke });
    img.onerror = () => {
      revoke();
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

/**
 * Read an image's pixel dimensions, or null if the browser can't decode it.
 */
export async function readImageDimensions(
  file: Blob,
): Promise<{ width: number; height: number } | null> {
  try {
    const { img, revoke } = await loadImage(file);
    revoke();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

/** Downscale + re-encode. Throws on any decode/draw/encode failure. */
async function encode(
  file: File,
  cfg: ImageCompressionSettings,
  targetMime: string,
): Promise<Blob> {
  const { img, revoke } = await loadImage(file);
  const canvas = document.createElement('canvas');
  try {
    let { width, height } = img;
    const longest = Math.max(width, height);
    if (longest > cfg.max_dimension_px) {
      const scale = cfg.max_dimension_px / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // JPEG has no alpha channel; transparent pixels would otherwise turn black.
    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    // PNG ignores quality; pass undefined to let the browser pick its default.
    const quality =
      targetMime === 'image/png' ? undefined : Math.max(1, Math.min(100, cfg.quality)) / 100;

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
        targetMime,
        quality,
      );
    });
  } finally {
    // Release the canvas backing store (can be hundreds of MB for large dimensions)
    canvas.width = canvas.height = 0;
    revoke();
  }
}

/**
 * Compress an image file using the merged settings + overrides, and report
 * what happened. Never throws: on any failure the original file is returned.
 * - SVG, GIF and unknown image types are returned unchanged.
 * - When compression is disabled, returns the original file.
 * - Files below the skip threshold are returned unchanged.
 * - Output never upscales: dimensions only shrink.
 * - If the re-encoded file isn't smaller, the original is kept.
 */
export async function compressImageWithOutcome(
  file: File,
  base: ImageCompressionSettings = DEFAULT_IMAGE_COMPRESSION,
  overrides: CompressOverrides = {}
): Promise<CompressResult> {
  const cfg: ImageCompressionSettings = {
    enabled: overrides.enabled ?? base.enabled,
    max_dimension_px: overrides.max_dimension_px ?? base.max_dimension_px,
    quality: overrides.quality ?? base.quality,
    output_format: overrides.output_format ?? base.output_format,
    skip_if_smaller_than_kb:
      overrides.skip_if_smaller_than_kb ?? base.skip_if_smaller_than_kb,
  };

  if (!cfg.enabled) return { file, outcome: 'disabled' };
  if (!file.type.startsWith('image/') || SKIPPED_MIME.has(file.type)) {
    return { file, outcome: 'unsupported' };
  }
  if (file.size <= cfg.skip_if_smaller_than_kb * 1024) {
    return { file, outcome: 'below_threshold' };
  }

  const targetMime =
    cfg.output_format === 'keep' ? file.type : FORMAT_TO_MIME[cfg.output_format];

  let blob: Blob;
  try {
    blob = await encode(file, cfg, targetMime);
  } catch (err) {
    console.warn('Image compression failed, keeping original', err);
    return { file, outcome: 'failed' };
  }

  if (blob.size >= file.size) return { file, outcome: 'larger' };

  // Browsers silently fall back to PNG for types they can't encode (e.g.
  // 'keep' on BMP/ICO/HEIC, or WebP on old Safari), so trust blob.type.
  const mime = blob.type || targetMime;
  return {
    file: new File([blob], renameForMime(file.name, mime), {
      type: mime,
      lastModified: Date.now(),
    }),
    outcome: 'compressed',
  };
}

/**
 * Compress an image file; see `compressImageWithOutcome`. Resolves to the
 * compressed file or, if compression was skipped/failed, the original.
 */
export async function compressImage(
  file: File,
  base: ImageCompressionSettings = DEFAULT_IMAGE_COMPRESSION,
  overrides: CompressOverrides = {}
): Promise<File> {
  return (await compressImageWithOutcome(file, base, overrides)).file;
}

/**
 * Compress a logo/favicon. Branding fields (`logo`, `favicon`) reject WebP
 * via mimeType validators, so we always keep the source format and never
 * skip — small inputs still get downscaled.
 */
export async function compressBrandingAsset(
  file: File,
  base: ImageCompressionSettings,
  maxDimensionPx: number,
): Promise<File> {
  return compressImage(file, base, {
    enabled: true,
    output_format: 'keep',
    skip_if_smaller_than_kb: 0,
    max_dimension_px: maxDimensionPx,
  });
}
