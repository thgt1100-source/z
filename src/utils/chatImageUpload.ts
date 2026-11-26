import {
  blobToDataUrl,
  extractMediaKey,
  getMediaBlob,
  isMediaRef,
} from './mediaMemoryManager';

export const DEFAULT_CHAT_IMAGE_MAX_INPUT_MB = 30;
export const MIN_CHAT_IMAGE_MAX_INPUT_MB = 5;
export const MAX_CHAT_IMAGE_MAX_INPUT_MB = 80;

export const DEFAULT_CHAT_IMAGE_MAX_DIMENSION = 1600;
export const DEFAULT_CHAT_IMAGE_QUALITY = 0.84;
export const DEFAULT_CHAT_IMAGE_TARGET_PAYLOAD_KB = 1500;

export const CHAT_IMAGE_MAX_INPUT_MB_OPTIONS = [15, 30, 50, 80] as const;
export const CHAT_IMAGE_MAX_DIMENSION_OPTIONS = [
  { value: 1024, label: '1024px (Nhẹ · nhanh qua 4G)' },
  { value: 1280, label: '1280px (Cân bằng)' },
  { value: 1600, label: '1600px (Rõ chữ chụp màn hình)' },
  { value: 2048, label: '2048px (Chi tiết cao)' },
  { value: 0, label: 'Giữ nguyên độ phân giải' },
] as const;
export const CHAT_IMAGE_QUALITY_OPTIONS = [
  { value: 0.72, label: '72% (Nhẹ máy)' },
  { value: 0.84, label: '84% (Khuyên dùng)' },
  { value: 0.92, label: '92% (Nét cao)' },
] as const;

const IMAGE_FILE_EXT_RE =
  /\.(?:png|jpe?g|webp|gif|bmp|avif|ico|heic|heif|jfif|tiff?)$/i;

const UNIVERSAL_VISION_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface ChatImageUploadSettings {
  maxInputMb?: number;
  maxDimension?: number;
  quality?: number;
  targetMaxPayloadKb?: number;
}

export interface PreparedChatImageResult {
  ok: boolean;
  dataUrl?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  originalBytes?: number;
  compressedBytes?: number;
  wasResized?: boolean;
  wasCompressed?: boolean;
  error?: string;
}

export function clampChatImageMaxInputMb(val: unknown): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CHAT_IMAGE_MAX_INPUT_MB;
  return Math.max(
    MIN_CHAT_IMAGE_MAX_INPUT_MB,
    Math.min(MAX_CHAT_IMAGE_MAX_INPUT_MB, Math.round(n)),
  );
}

export function clampChatImageMaxDimension(val: unknown): number {
  if (val === 0 || val === '0') return 0;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_CHAT_IMAGE_MAX_DIMENSION;
  if (n === 0) return 0;
  return Math.max(512, Math.min(4096, Math.round(n)));
}

export function clampChatImageQuality(val: unknown): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CHAT_IMAGE_QUALITY;
  return Math.max(0.5, Math.min(0.96, Math.round(n * 100) / 100));
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return 0;
  const b64Len = dataUrl.length - commaIdx - 1;
  return Math.max(0, Math.floor((b64Len * 3) / 4));
}

export function formatBytesCompact(bytes?: number | null): string {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toFixed(b >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      if (!res.startsWith('data:')) {
        reject(new Error('Không thể đọc dữ liệu ảnh.'));
        return;
      }
      resolve(res);
    };
    reader.onerror = () =>
      reject(reader.error || new Error('Lỗi khi đọc tệp ảnh từ thiết bị.'));
    reader.onabort = () => reject(new Error('Đã hủy đọc tệp ảnh.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const mimeMatch = /^data:([^;,]+)/i.exec(header);
    const mime = mimeMatch?.[1]?.trim() || 'image/jpeg';
    if (/;base64/i.test(header)) {
      const binary = atob(body.replace(/\s+/g, ''));
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(body)], { type: mime });
  } catch {
    return null;
  }
}

interface DecodedImageHandle {
  width: number;
  height: number;
  drawTo: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}

async function decodeBlobToDrawable(blob: Blob): Promise<DecodedImageHandle> {
  // Prefer createImageBitmap when available (fast, respects EXIF orientation in modern mobile browsers)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          width: bitmap.width,
          height: bitmap.height,
          drawTo: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
          cleanup: () => {
            try {
              bitmap.close();
            } catch {
              // ignore
            }
          },
        };
      }
      bitmap.close();
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error('Trình duyệt không thể giải mã hình ảnh này.'));
      el.src = objectUrl;
    });
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('Kích thước hình ảnh không hợp lệ.');
    }
    return {
      width,
      height,
      drawTo: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      },
    };
  } catch (err) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore
    }
    throw err;
  }
}

function encodeCanvasAsJpegDataUrl(
  decoded: DecodedImageHandle,
  targetW: number,
  targetH: number,
  quality: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(targetW));
  canvas.height = Math.max(1, Math.round(targetH));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không khởi tạo được bộ xử lý ảnh Canvas.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  decoded.drawTo(ctx, canvas.width, canvas.height);
  const out = canvas.toDataURL('image/jpeg', quality);
  // Release canvas backing store promptly on mobile Safari/Chrome
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

/**
 * Resizes and encodes an image Blob into a universal, vision-API-safe JPEG data URL
 * while respecting configurable max dimension, quality, and payload budget.
 */
async function transcodeImageBlobForChat(
  blob: Blob,
  options?: {
    maxDimension?: number;
    quality?: number;
    targetMaxPayloadKb?: number;
  },
): Promise<{
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  compressedBytes: number;
  wasResized: boolean;
}> {
  const maxDimension = clampChatImageMaxDimension(options?.maxDimension);
  let quality = clampChatImageQuality(options?.quality);
  const targetMaxBytes =
    Math.max(200, options?.targetMaxPayloadKb ?? DEFAULT_CHAT_IMAGE_TARGET_PAYLOAD_KB) *
    1024;

  const decoded = await decodeBlobToDrawable(blob);
  try {
    let targetW = decoded.width;
    let targetH = decoded.height;
    let wasResized = false;

    if (maxDimension > 0) {
      const longest = Math.max(targetW, targetH);
      if (longest > maxDimension) {
        const scale = maxDimension / longest;
        targetW = Math.max(1, Math.round(targetW * scale));
        targetH = Math.max(1, Math.round(targetH * scale));
        wasResized = true;
      }
    }

    // Mobile Safari / Chrome canvas safety cap (~4096px edge)
    const hardCap = 3840;
    const curLongest = Math.max(targetW, targetH);
    if (curLongest > hardCap) {
      const scale = hardCap / curLongest;
      targetW = Math.max(1, Math.round(targetW * scale));
      targetH = Math.max(1, Math.round(targetH * scale));
      wasResized = true;
    }

    let dataUrl = encodeCanvasAsJpegDataUrl(decoded, targetW, targetH, quality);
    let compressedBytes = estimateDataUrlBytes(dataUrl);

    // Adaptive step-down if image is still above payload budget (common for dense 4K screenshots)
    let pass = 0;
    while (compressedBytes > targetMaxBytes && pass < 4) {
      pass += 1;
      if (quality > 0.66) {
        quality = Math.max(0.62, Math.round((quality - 0.1) * 100) / 100);
      } else {
        targetW = Math.max(480, Math.round(targetW * 0.8));
        targetH = Math.max(480, Math.round(targetH * 0.8));
        wasResized = true;
      }
      dataUrl = encodeCanvasAsJpegDataUrl(decoded, targetW, targetH, quality);
      compressedBytes = estimateDataUrlBytes(dataUrl);
    }

    return {
      dataUrl,
      mimeType: 'image/jpeg',
      width: targetW,
      height: targetH,
      compressedBytes,
      wasResized,
    };
  } finally {
    decoded.cleanup();
  }
}

/**
 * Prepares a user-selected File for chat attachment:
 * - Validates file type and configurable max input size (default 30 MB, up to 80 MB).
 * - Automatically resizes & converts screenshots / camera photos to universal JPEG
 *   so they transmit cleanly through mobile networks, /api/proxy, OpenAI & Gemini vision APIs.
 */
export async function prepareChatImageFile(
  file: File,
  settings?: ChatImageUploadSettings,
): Promise<PreparedChatImageResult> {
  if (!file) {
    return { ok: false, error: 'Chưa chọn tệp ảnh.' };
  }

  const lowerType = (file.type || '').toLowerCase();
  const looksLikeImage =
    lowerType.startsWith('image/') || IMAGE_FILE_EXT_RE.test(file.name || '');
  if (!looksLikeImage) {
    return {
      ok: false,
      error: `Tệp "${file.name || 'không rõ tên'}" không phải hình ảnh hợp lệ.`,
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: `Tệp ảnh "${file.name}" bị rỗng (0 byte).` };
  }

  const maxInputMb = clampChatImageMaxInputMb(settings?.maxInputMb);
  const maxInputBytes = maxInputMb * 1024 * 1024;
  if (file.size > maxInputBytes) {
    return {
      ok: false,
      error: `Ảnh "${file.name}" (${formatBytesCompact(file.size)}) vượt giới hạn ${maxInputMb} MB. Hãy tăng giới hạn ảnh đầu vào hoặc chọn ảnh nhỏ hơn.`,
    };
  }

  const maxDimension = clampChatImageMaxDimension(settings?.maxDimension);
  const quality = clampChatImageQuality(settings?.quality);
  const targetMaxPayloadKb =
    settings?.targetMaxPayloadKb ?? DEFAULT_CHAT_IMAGE_TARGET_PAYLOAD_KB;

  // Always rasterize SVG / HEIC / BMP / AVIF / oversized / non-JPEG images via Canvas
  const isSvg = lowerType === 'image/svg+xml' || /\.svg$/i.test(file.name || '');

  try {
    const transcoded = await transcodeImageBlobForChat(file, {
      maxDimension,
      quality,
      targetMaxPayloadKb,
    });
    if (
      transcoded.dataUrl &&
      /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(transcoded.dataUrl)
    ) {
      return {
        ok: true,
        dataUrl: transcoded.dataUrl,
        mimeType: transcoded.mimeType,
        width: transcoded.width,
        height: transcoded.height,
        originalBytes: file.size,
        compressedBytes: transcoded.compressedBytes,
        wasResized: transcoded.wasResized,
        wasCompressed:
          transcoded.compressedBytes < file.size ||
          lowerType !== 'image/jpeg' ||
          transcoded.wasResized,
      };
    }
  } catch {
    if (isSvg) {
      return {
        ok: false,
        error: `Không thể chuyển đổi tệp SVG "${file.name}" sang ảnh raster để gửi AI.`,
      };
    }
    // Fall through to raw FileReader fallback for standard formats if Canvas failed
  }

  // Fallback: direct FileReader ONLY for standard vision-safe raster formats within reasonable wire size
  if (
    /\.heic$|\.heif$/i.test(file.name || '') ||
    lowerType === 'image/heic' ||
    lowerType === 'image/heif'
  ) {
    return {
      ok: false,
      error: `Trình duyệt này chưa giải mã được ảnh HEIC/HEIF ("${file.name}"). Hãy chuyển sang JPG/PNG hoặc chụp màn hình lại.`,
    };
  }

  try {
    const rawDataUrl = await readBlobAsDataUrl(file);
    const mimeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/i.exec(rawDataUrl);
    const detectedMime = mimeMatch?.[1]?.toLowerCase() || '';
    if (!detectedMime || !UNIVERSAL_VISION_MIMES.has(detectedMime)) {
      return {
        ok: false,
        error: `Định dạng ảnh "${file.name}" (${detectedMime || 'không rõ'}) chưa được trình duyệt chuyển đổi thành công sang JPG/PNG.`,
      };
    }
    const rawBytes = estimateDataUrlBytes(rawDataUrl);
    if (rawBytes > 8 * 1024 * 1024) {
      return {
        ok: false,
        error: `Ảnh "${file.name}" quá nặng (${formatBytesCompact(rawBytes)}) và không thể nén trên thiết bị này. Hãy thử giảm độ phân giải ảnh trước khi gửi.`,
      };
    }
    return {
      ok: true,
      dataUrl: rawDataUrl,
      mimeType: detectedMime,
      originalBytes: file.size,
      compressedBytes: rawBytes,
      wasResized: false,
      wasCompressed: false,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : `Không thể đọc tệp ảnh "${file.name}".`,
    };
  }
}

export interface NormalizedVisionImage {
  dataUrl: string;
  mimeType: string;
  base64: string;
  bytes: number;
}

/**
 * Normalizes any stored chat image (`data:image/...`, `idb-media://`, `blob:`, or `http(s)://`)
 * right before API dispatch into a clean, guaranteed-valid `data:image/...;base64,...` payload
 * within the target size budget. Prevents empty Gemini inlineData, broken `idb-media://` refs,
 * unsupported WebP/AVIF MIME rejections, and HTTP 413 payload errors.
 */
export async function normalizeChatImageForVisionApi(
  rawSrc: string,
  options?: {
    maxDimension?: number;
    quality?: number;
    targetMaxPayloadKb?: number;
    forceRecompress?: boolean;
    signal?: AbortSignal;
  },
): Promise<{
  ok: boolean;
  image?: NormalizedVisionImage;
  remoteFallbackUrl?: string;
  error?: string;
}> {
  const src = String(rawSrc || '').trim();
  if (!src) {
    return { ok: false, error: 'Dữ liệu ảnh đính kèm bị rỗng.' };
  }

  let resolvedDataUrl = '';
  let sourceBlob: Blob | null = null;

  if (src.startsWith('data:image/')) {
    resolvedDataUrl = src;
  } else if (isMediaRef(src)) {
    try {
      const key = extractMediaKey(src);
      const blob = key ? await getMediaBlob(key) : null;
      if (!blob || blob.size <= 0) {
        return {
          ok: false,
          error:
            'Ảnh đính kèm trong bộ nhớ cục bộ đã bị dọn dẹp hoặc không còn tồn tại.',
        };
      }
      sourceBlob = blob;
    } catch (err) {
      return {
        ok: false,
        error: `Lỗi khôi phục ảnh cục bộ: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  } else if (src.startsWith('blob:') || /^https?:\/\//i.test(src)) {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        return { ok: false, error: 'Đã hủy tải ảnh đính kèm.' };
      }
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }
    const timer = globalThis.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(src, {
        signal: controller.signal,
        credentials: 'omit',
      });
      if (!res.ok) {
        return {
          ok: false,
          remoteFallbackUrl: /^https?:\/\//i.test(src) ? src : undefined,
          error: `Không tải được ảnh nguồn (HTTP ${res.status}).`,
        };
      }
      const blob = await res.blob();
      if (!blob || blob.size <= 0) {
        return {
          ok: false,
          remoteFallbackUrl: /^https?:\/\//i.test(src) ? src : undefined,
          error: 'Tệp ảnh tải về bị rỗng.',
        };
      }
      sourceBlob = blob;
    } catch (err) {
      return {
        ok: false,
        remoteFallbackUrl: /^https?:\/\//i.test(src) ? src : undefined,
        error: `Không thể đọc ảnh từ đường dẫn (${err instanceof Error ? err.message : 'CORS/Mạng'}).`,
      };
    } finally {
      globalThis.clearTimeout(timer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }
    }
  } else {
    return { ok: false, error: 'Định dạng nguồn ảnh không được hỗ trợ.' };
  }

  const maxDimension = clampChatImageMaxDimension(options?.maxDimension);
  const quality = clampChatImageQuality(options?.quality);
  const targetMaxPayloadKb =
    options?.targetMaxPayloadKb ?? DEFAULT_CHAT_IMAGE_TARGET_PAYLOAD_KB;
  const targetMaxBytes = targetMaxPayloadKb * 1024;

  if (sourceBlob) {
    try {
      const transcoded = await transcodeImageBlobForChat(sourceBlob, {
        maxDimension,
        quality,
        targetMaxPayloadKb,
      });
      resolvedDataUrl = transcoded.dataUrl;
    } catch {
      try {
        resolvedDataUrl = await blobToDataUrl(sourceBlob);
      } catch {
        return { ok: false, error: 'Không thể giải mã dữ liệu ảnh sang base64.' };
      }
    }
  }

  const parsedMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(
    resolvedDataUrl.trim(),
  );
  if (!parsedMatch) {
    return {
      ok: false,
      error: 'Dữ liệu ảnh không đúng chuẩn base64 để gửi tới AI.',
    };
  }

  let mimeType = parsedMatch[1].toLowerCase();
  let base64 = parsedMatch[2].replace(/\s+/g, '');
  let cleanDataUrl = `data:${mimeType};base64,${base64}`;
  let bytes = estimateDataUrlBytes(cleanDataUrl);

  const needsRecompress =
    Boolean(options?.forceRecompress) ||
    bytes > targetMaxBytes ||
    (mimeType !== 'image/jpeg' && mimeType !== 'image/png');

  if (needsRecompress && typeof document !== 'undefined') {
    const blobForCanvas = sourceBlob || dataUrlToBlob(cleanDataUrl);
    if (blobForCanvas) {
      try {
        const transcoded = await transcodeImageBlobForChat(blobForCanvas, {
          maxDimension,
          quality,
          targetMaxPayloadKb,
        });
        const reMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(
          transcoded.dataUrl,
        );
        if (reMatch) {
          mimeType = reMatch[1].toLowerCase();
          base64 = reMatch[2].replace(/\s+/g, '');
          cleanDataUrl = `data:${mimeType};base64,${base64}`;
          bytes = transcoded.compressedBytes;
        }
      } catch {
        // Keep existing valid base64 if canvas transcode fails
      }
    }
  }

  if (!base64) {
    return { ok: false, error: 'Dữ liệu base64 của ảnh bị rỗng.' };
  }

  return {
    ok: true,
    image: {
      dataUrl: cleanDataUrl,
      mimeType,
      base64,
      bytes,
    },
  };
}
