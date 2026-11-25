import { useEffect, useState } from 'react';
import {
  ensureObjectUrlForSource,
  getCachedObjectUrl,
  isMediaRef,
  subscribeMediaCache,
  type ManagedMediaKind,
} from '../utils/mediaMemoryManager';

interface UseResolvedMediaUrlOptions {
  keyHint: string;
  pageIndex: number | null;
  kind: ManagedMediaKind;
  enabled?: boolean;
}

interface UseResolvedMediaUrlResult {
  resolvedUrl: string;
  isLoading: boolean;
}

/**
 * Resolves `idb-media://`, `data:image/...`, or direct URLs into a renderable URL
 * backed by managed revocable Object URLs. Automatically avoids loading when
 * `enabled` is false (e.g. off-screen or > 10 pages away from `currentPage`) and
 * reloads seamlessly when the user returns near the page.
 */
export function useResolvedMediaUrl(
  source: string | undefined,
  options: UseResolvedMediaUrlOptions,
): UseResolvedMediaUrlResult {
  const { keyHint, pageIndex, kind, enabled = true } = options;
  const trimmed = (source || '').trim();

  const computeSyncUrl = (): string => {
    if (!enabled || !trimmed) return '';
    if (!isMediaRef(trimmed) && !trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    return getCachedObjectUrl(trimmed, keyHint) || '';
  };

  const [resolvedUrl, setResolvedUrl] = useState<string>(computeSyncUrl);
  const [isLoading, setIsLoading] = useState<boolean>(
    () => Boolean(enabled && trimmed && !computeSyncUrl()),
  );
  const [cacheTick, setCacheTick] = useState(0);

  useEffect(() => {
    return subscribeMediaCache(() => {
      setCacheTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !trimmed) {
      setResolvedUrl('');
      setIsLoading(false);
      return;
    }

    if (!isMediaRef(trimmed) && !trimmed.startsWith('data:image/')) {
      setResolvedUrl(trimmed);
      setIsLoading(false);
      return;
    }

    const cached = getCachedObjectUrl(trimmed, keyHint);
    if (cached) {
      setResolvedUrl(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void ensureObjectUrlForSource(trimmed, {
      keyHint,
      pageIndex,
      kind,
    }).then((url) => {
      if (cancelled) return;
      setResolvedUrl(url);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [trimmed, keyHint, pageIndex, kind, enabled, cacheTick]);

  return { resolvedUrl, isLoading };
}
