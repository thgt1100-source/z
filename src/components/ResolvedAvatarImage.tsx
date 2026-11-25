import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useResolvedMediaUrl } from '../hooks/useResolvedMediaUrl';

interface ResolvedAvatarImageProps {
  src?: string;
  alt: string;
  keyHint: string;
  className?: string;
  compactError?: boolean;
  onClick?: () => void;
  onLoadError?: (failedSrc: string) => void;
}

/**
 * Resilient Avatar renderer for mobile & desktop:
 * - Resolves `data:image/`, `https://`, `blob:`, and `idb-media://` transparently.
 * - Immediately updates when `src` changes (resets stale load/error state).
 * - Shows a crisp loading indicator for external URLs and an explicit error fallback
 *   (with tap-to-retry) if a remote link breaks or gets blocked.
 */
export function ResolvedAvatarImage({
  src,
  alt,
  keyHint,
  className = 'h-full w-full object-cover',
  compactError = false,
  onClick,
  onLoadError,
}: ResolvedAvatarImageProps) {
  const [retryNonce, setRetryNonce] = useState(0);
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );

  const { resolvedUrl, isLoading } = useResolvedMediaUrl(src, {
    keyHint: `avatar:${keyHint}`,
    pageIndex: null,
    kind: 'misc',
    enabled: Boolean(src?.trim()),
  });

  useEffect(() => {
    if (isLoading) {
      setImgStatus('loading');
      return;
    }
    setImgStatus(resolvedUrl ? 'loading' : 'error');
  }, [resolvedUrl, isLoading, retryNonce]);

  const effectiveUrl =
    retryNonce > 0 && resolvedUrl && /^https?:\/\//i.test(resolvedUrl)
      ? `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}_arkr=${retryNonce}`
      : resolvedUrl;

  if (!src?.trim()) return null;

  if (isLoading && !resolvedUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0c1422] text-sky-300">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!isLoading && (!effectiveUrl || imgStatus === 'error')) {
    return (
      <div
        title="Không tải được ảnh (link lỗi hoặc bị chặn CORS)"
        className="flex h-full w-full flex-col items-center justify-center gap-1 bg-rose-950/45 p-1 text-center text-rose-200"
      >
        <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" />
        {!compactError && (
          <>
            <span className="text-[9px] font-semibold leading-tight">
              Lỗi tải ảnh
            </span>
            {resolvedUrl && /^https?:\/\//i.test(resolvedUrl) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRetryNonce((n) => n + 1);
                }}
                className="inline-flex items-center gap-0.5 rounded bg-rose-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-rose-100 hover:bg-rose-500/35"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                <span>Thử lại</span>
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const imgRenderKey = `${effectiveUrl.length}:${effectiveUrl.slice(0, 32)}:${effectiveUrl.slice(-32)}:${retryNonce}`;

  return (
    <div className="relative h-full w-full">
      {imgStatus === 'loading' &&
        !effectiveUrl.startsWith('data:') &&
        !effectiveUrl.startsWith('blob:') && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#0c1422]/75">
            <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
          </div>
        )}
      <img
        key={imgRenderKey}
        src={effectiveUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        decoding="async"
        onClick={onClick}
        onLoad={() => setImgStatus('loaded')}
        onError={() => {
          setImgStatus('error');
          onLoadError?.(src);
        }}
        className={className}
      />
    </div>
  );
}
