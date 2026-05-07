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

function loadImage(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
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
 * Compress an image file using the merged settings + overrides.
 * - SVG and unknown image types are returned unchanged.
 * - When compression is disabled, returns the original file.
 * - Files below the skip threshold are returned unchanged.
 * - Output never upscales: dimensions only shrink.
 */
export async function compressImage(
  file: File,
  base: ImageCompressionSettings = DEFAULT_IMAGE_COMPRESSION,
  overrides: CompressOverrides = {}
): Promise<File> {
  const cfg: ImageCompressionSettings = {
    enabled: overrides.enabled ?? base.enabled,
    max_dimension_px: overrides.max_dimension_px ?? base.max_dimension_px,
    quality: overrides.quality ?? base.quality,
    output_format: overrides.output_format ?? base.output_format,
    skip_if_smaller_than_kb:
      overrides.skip_if_smaller_than_kb ?? base.skip_if_smaller_than_kb,
  };

  if (!cfg.enabled) return file;
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  if (file.size <= cfg.skip_if_smaller_than_kb * 1024) return file;

  const { img, revoke } = await loadImage(file);
  try {
    let { width, height } = img;
    const longest = Math.max(width, height);
    if (longest > cfg.max_dimension_px) {
      const scale = cfg.max_dimension_px / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(img, 0, 0, width, height);

    const targetMime =
      cfg.output_format === 'keep' ? file.type : FORMAT_TO_MIME[cfg.output_format];

    // PNG ignores quality; pass undefined to let the browser pick its default.
    const quality =
      targetMime === 'image/png' ? undefined : Math.max(1, Math.min(100, cfg.quality)) / 100;

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
        targetMime,
        quality,
      );
    });

    // Release the canvas backing store (can be hundreds of MB for large dimensions)
    canvas.width = canvas.height = 0;

    if (blob.size >= file.size) return file;

    return new File([blob], renameForMime(file.name, targetMime), {
      type: targetMime,
      lastModified: Date.now(),
    });
  } finally {
    revoke();
  }
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
