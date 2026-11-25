import {
  compressSampleImageForStorage,
  validateImageSampleUrl,
  verifyBrowserCanLoadImageUrl,
} from './imageStyles';
import {
  isMediaRef,
  resolveMediaSourceToDataUrl,
} from './mediaMemoryManager';

export interface AvatarImportResult {
  ok: boolean;
  imageData?: string;
  mode?: 'file' | 'url_cached' | 'url_direct' | 'library';
  approxKb?: number;
  note?: string;
  warning?: string;
  error?: string;
}

const IMAGE_FILE_EXT_RE = /\.(?:png|jpe?g|webp|gif|bmp|avif|svg|ico|heic|heif)$/i;
const MAX_DIRECT_FILE_BYTES = 20 * 1024 * 1024; // 20 MB mobile safety cap

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result.startsWith('data:')) {
        reject(new Error('Không thể đọc dữ liệu ảnh từ tệp đã chọn.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () =>
      reject(reader.error || new Error('Lỗi khi đọc tệp ảnh từ thiết bị.'));
    reader.onabort = () => reject(new Error('Đã hủy đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

function estimateBase64Kb(dataUrl: string): number {
  return Math.max(1, Math.round((dataUrl.length * 0.75) / 1024));
}

/**
 * Imports an image from a mobile/desktop device File (`<input type="file" accept="image/*" />`).
 * Compresses large photos into crisp, storage-safe WebP/JPEG (~40–115 KB) so they render
 * instantaneously and persist reliably in both localStorage and IndexedDB on mobile.
 */
export async function importExternalAvatarFromFile(
  file: File,
  options?: { maxEdge?: number; quality?: number },
): Promise<AvatarImportResult> {
  if (!file) {
    return { ok: false, error: 'Chưa chọn tệp ảnh.' };
  }

  const looksLikeImage =
    (file.type && file.type.toLowerCase().startsWith('image/')) ||
    IMAGE_FILE_EXT_RE.test(file.name || '');
  if (!looksLikeImage) {
    return {
      ok: false,
      error:
        'Tệp đã chọn không phải định dạng ảnh hợp lệ (hỗ trợ JPG, PNG, WebP, GIF, AVIF...).',
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: 'Tệp ảnh bị rỗng (0 byte).' };
  }

  if (file.size > MAX_DIRECT_FILE_BYTES) {
    return {
      ok: false,
      error:
        'Tệp ảnh quá lớn (> 20 MB). Hãy chọn ảnh nhẹ hơn để tránh tràn bộ nhớ trình duyệt mobile.',
    };
  }

  const maxEdge = options?.maxEdge ?? 768;
  const quality = options?.quality ?? 0.84;

  try {
    const compressed = await compressSampleImageForStorage(file, {
      maxEdge,
      quality,
    });
    if (compressed.dataUrl && compressed.dataUrl.startsWith('data:image/')) {
      return {
        ok: true,
        imageData: compressed.dataUrl,
        mode: 'file',
        approxKb: compressed.approxKb,
        note: `Đã nạp ảnh từ thiết bị (~${compressed.approxKb} KB).`,
      };
    }
  } catch {
    // Fall back to direct FileReader base64 if canvas decode fails on exotic format (e.g. animated/SVG)
  }

  try {
    const rawDataUrl = await readFileAsDataUrl(file);
    if (!rawDataUrl.startsWith('data:image/')) {
      return {
        ok: false,
        error:
          'Trình duyệt không thể giải mã tệp ảnh này (nếu là ảnh HEIC từ iPhone, hãy chọn định dạng JPG/PNG hoặc chụp màn hình).',
      };
    }
    const approxKb = estimateBase64Kb(rawDataUrl);
    return {
      ok: true,
      imageData: rawDataUrl,
      mode: 'file',
      approxKb,
      note: `Đã nạp ảnh gốc từ thiết bị (~${approxKb} KB).`,
      warning:
        approxKb > 900
          ? 'Ảnh gốc có dung lượng lớn nên có thể tốn bộ nhớ lưu trữ; khuyến nghị dùng ảnh JPG/WebP nhẹ hơn.'
          : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Không thể đọc tệp ảnh từ thiết bị.',
    };
  }
}

/**
 * Imports an external image URL for an NPC Avatar.
 * 1) Validates URL & checks Mixed Content (HTTPS page loading HTTP link).
 * 2) Attempts CORS fetch + local compression so the avatar works offline & never breaks.
 * 3) If CORS blocks fetch, verifies direct <img> rendering and reports a clear CORS notice;
 *    if the link is broken / 404 / HTML page / blocked hotlink, returns a specific error.
 */
export async function importExternalAvatarFromUrl(
  rawUrl: string,
  options?: { maxEdge?: number; quality?: number; signal?: AbortSignal },
): Promise<AvatarImportResult> {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Hãy dán đường dẫn URL ảnh (http:// hoặc https://).' };
  }

  // Allow pasting a raw data:image/... URL directly as well
  if (trimmed.startsWith('data:image/')) {
    try {
      const compressed = await compressSampleImageForStorage(trimmed, {
        maxEdge: options?.maxEdge ?? 768,
        quality: options?.quality ?? 0.84,
      });
      return {
        ok: true,
        imageData: compressed.dataUrl,
        mode: 'url_cached',
        approxKb: compressed.approxKb,
        note: `Đã nạp & tối ưu ảnh từ chuỗi dữ liệu (~${compressed.approxKb} KB).`,
      };
    } catch {
      return {
        ok: true,
        imageData: trimmed,
        mode: 'url_cached',
        approxKb: estimateBase64Kb(trimmed),
        note: 'Đã nạp ảnh từ dữ liệu base64.',
      };
    }
  }

  const check = validateImageSampleUrl(trimmed);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }
  const url = check.url;

  const isMixedContent =
    typeof location !== 'undefined' &&
    /^https:/i.test(location.protocol) &&
    /^http:/i.test(url);

  let corsBlockedFetch = false;
  let fetchErrorReason = '';

  if (typeof fetch === 'function') {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        return { ok: false, error: 'Đã hủy tải ảnh từ URL.' };
      }
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }
    const timer = globalThis.setTimeout(() => controller.abort(), 11_000);
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      if (!res.ok) {
        if (res.status === 404) {
          fetchErrorReason = 'Link ảnh không tồn tại (HTTP 404).';
        } else if (res.status === 403 || res.status === 401) {
          fetchErrorReason = `Máy chủ ảnh từ chối truy cập / chặn hotlink (HTTP ${res.status}).`;
        } else {
          fetchErrorReason = `Máy chủ ảnh trả về lỗi HTTP ${res.status}.`;
        }
      } else {
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType && contentType.includes('text/html')) {
          return {
            ok: false,
            error:
              'Đường dẫn này là trang web (HTML), không phải link ảnh trực tiếp. Hãy sao chép "Địa chỉ hình ảnh" (.jpg, .png, .webp...).',
          };
        }
        const blob = await res.blob();
        const looksLikeImage =
          !blob.type ||
          blob.type.toLowerCase().startsWith('image/') ||
          blob.type === 'application/octet-stream';
        if (!looksLikeImage || blob.size <= 0) {
          return {
            ok: false,
            error:
              'URL không trả về dữ liệu hình ảnh hợp lệ. Hãy kiểm tra lại link ảnh trực tiếp.',
          };
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Không thể giải mã dữ liệu ảnh.'));
          reader.readAsDataURL(blob);
        });
        if (dataUrl.startsWith('data:')) {
          try {
            const compressed = await compressSampleImageForStorage(dataUrl, {
              maxEdge: options?.maxEdge ?? 768,
              quality: options?.quality ?? 0.84,
            });
            return {
              ok: true,
              imageData: compressed.dataUrl,
              mode: 'url_cached',
              approxKb: compressed.approxKb,
              note: `Đã tải & lưu cục bộ ảnh từ URL (~${compressed.approxKb} KB) — hiển thị mượt và không bị lỗi khi offline.`,
            };
          } catch {
            return {
              ok: true,
              imageData: dataUrl,
              mode: 'url_cached',
              approxKb: estimateBase64Kb(dataUrl),
              note: 'Đã tải ảnh từ URL vào bộ nhớ.',
            };
          }
        }
      }
    } catch (err) {
      if (options?.signal?.aborted) {
        return { ok: false, error: 'Đã hủy tải ảnh từ URL.' };
      }
      corsBlockedFetch = true;
      if (err instanceof Error && err.name === 'AbortError') {
        fetchErrorReason = 'Hết thời gian chờ khi tải ảnh (timeout).';
      }
    } finally {
      globalThis.clearTimeout(timer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }
    }
  }

  if (options?.signal?.aborted) {
    return { ok: false, error: 'Đã hủy tải ảnh từ URL.' };
  }

  // Step 2: Fallback direct <img> load test (handles servers that block fetch CORS but allow <img>)
  const canRenderDirectly = await verifyBrowserCanLoadImageUrl(url, 10_000);
  if (canRenderDirectly) {
    return {
      ok: true,
      imageData: url,
      mode: 'url_direct',
      note: 'Đã xác minh hiển thị trực tiếp từ URL ảnh.',
      warning: corsBlockedFetch
        ? 'Máy chủ nguồn chặn CORS nên không thể nén cục bộ; ảnh đã được gắn trực tiếp qua URL và vẫn hiển thị bình thường (lưu ý: tính năng Vision AI đối chiếu có thể bị giới hạn bởi CORS từ nguồn này).'
        : undefined,
    };
  }

  if (isMixedContent) {
    return {
      ok: false,
      error:
        'Trình duyệt chặn ảnh HTTP không bảo mật trên trang HTTPS (Mixed Content). Hãy đổi sang link https:// hoặc tải ảnh về máy rồi chọn từ thiết bị.',
    };
  }

  if (fetchErrorReason) {
    return {
      ok: false,
      error: `${fetchErrorReason} Hãy thử link ảnh trực tiếp khác hoặc tải ảnh về thiết bị.`,
    };
  }

  return {
    ok: false,
    error:
      'Không thể tải hoặc hiển thị ảnh từ URL này (link bị hỏng, bị chặn hotlink/CORS hoặc không phải file ảnh trực tiếp). Hãy kiểm tra lại link hoặc tải ảnh từ thiết bị.',
  };
}

/**
 * Normalizes any selected library source (`idb-media://`, oversized `data:image/`, or remote URL)
 * into a crisp, immediately-renderable, mobile-storage-safe Avatar value.
 */
export async function resolveAvatarSourceForStorage(
  rawSrc: string,
  options?: { maxEdge?: number; quality?: number },
): Promise<AvatarImportResult> {
  const src = String(rawSrc || '').trim();
  if (!src) {
    return { ok: false, error: 'Nguồn ảnh rỗng.' };
  }

  let resolved = src;
  if (isMediaRef(src)) {
    const dataUrl = await resolveMediaSourceToDataUrl(src);
    if (!dataUrl) {
      return {
        ok: false,
        error:
          'Không thể khôi phục ảnh này từ bộ nhớ cục bộ (có thể đã bị dọn dẹp). Hãy chọn ảnh khác.',
      };
    }
    resolved = dataUrl;
  }

  if (resolved.startsWith('data:image/')) {
    const approxKb = estimateBase64Kb(resolved);
    // Compress oversized data URLs so mobile localStorage/IndexedDB stays fast and never drops avatars
    if (approxKb > 150) {
      try {
        const compressed = await compressSampleImageForStorage(resolved, {
          maxEdge: options?.maxEdge ?? 768,
          quality: options?.quality ?? 0.84,
        });
        if (compressed.dataUrl) {
          return {
            ok: true,
            imageData: compressed.dataUrl,
            mode: 'library',
            approxKb: compressed.approxKb,
            note: `Đã gắn ảnh và tối ưu dung lượng (~${compressed.approxKb} KB).`,
          };
        }
      } catch {
        // Keep original dataUrl if compression fails
      }
    }
    return {
      ok: true,
      imageData: resolved,
      mode: 'library',
      approxKb,
    };
  }

  return {
    ok: true,
    imageData: resolved,
    mode: 'library',
  };
}
