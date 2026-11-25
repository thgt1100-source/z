import type { Turn } from '../types/ark';

export const MEDIA_REF_PREFIX = 'idb-media://';
export const LAZY_UNLOAD_PAGE_RADIUS = 20;
export const QUICK_OPTIMIZE_PAGE_RADIUS = 2;
export const ESTIMATED_RAM_BUDGET_MB = 256;
export const MAX_ACTIVE_OBJECT_URL_BYTES =
  ESTIMATED_RAM_BUDGET_MB * 1024 * 1024;
const MAX_ACTIVE_OBJECT_URLS = 160;

const DB_NAME = 'ark_lite_media_vault_v1';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

export type ManagedMediaKind = 'story' | 'attach' | 'bg' | 'misc';

interface ActiveObjectUrlEntry {
  key: string;
  objectUrl: string;
  pageIndex: number | null;
  kind: ManagedMediaKind;
  sizeBytes: number;
  lastUsedAt: number;
  sourceSig?: string;
}

function computeInlineMediaSig(src: string): string {
  const len = src.length;
  const head = src.slice(0, 48);
  const mid = len > 120 ? src.slice(Math.floor(len / 2), Math.floor(len / 2) + 24) : '';
  const tail = len > 48 ? src.slice(-32) : '';
  return `${len}:${head}:${mid}:${tail}`;
}

const activeObjectUrls = new Map<string, ActiveObjectUrlEntry>();
const inflightHydrations = new Map<string, Promise<string>>();
const cacheListeners = new Set<() => void>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function notifyCacheListeners(): void {
  for (const listener of cacheListeners) {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  }
}

export function subscribeMediaCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

export function isMediaRef(src?: string | null): boolean {
  return typeof src === 'string' && src.startsWith(MEDIA_REF_PREFIX);
}

export function extractMediaKey(ref: string): string {
  return ref.startsWith(MEDIA_REF_PREFIX)
    ? ref.slice(MEDIA_REF_PREFIX.length)
    : ref;
}

export function makeMediaRef(key: string): string {
  return `${MEDIA_REF_PREFIX}${key}`;
}

export function buildTurnMediaKey(
  kind: 'story' | 'attach',
  turn: Pick<Turn, 'id'>,
  index: number,
  slotSuffix?: string,
): string {
  const safeId = String(turn?.id || `idx_${index}`).replace(/[^a-zA-Z0-9_:-]+/g, '_');
  const cleanSuffix = slotSuffix
    ? String(slotSuffix).replace(/[^a-zA-Z0-9_-]+/g, '_')
    : '';
  return cleanSuffix
    ? `turn_${kind}:${safeId}:${cleanSuffix}`
    : `turn_${kind}:${safeId}`;
}

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
      req.onblocked = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

function dataUrlToBlobLocal(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const mimeMatch = /^data:([^;,]+)/i.exec(header);
    const mime = mimeMatch?.[1]?.trim() || 'image/png';
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

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export async function putMediaBlob(key: string, blob: Blob): Promise<boolean> {
  const db = await openMediaDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getMediaBlob(key: string): Promise<Blob | null> {
  const db = await openMediaDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const val = req.result;
        resolve(val instanceof Blob ? val : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteMediaBlob(key: string): Promise<void> {
  revokeMediaKey(key);
  const db = await openMediaDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function storeBlobInMediaVault(
  key: string,
  blob: Blob,
): Promise<string | null> {
  const saved = await putMediaBlob(key, blob);
  if (!saved) return null;
  return makeMediaRef(key);
}

export async function storeDataUrlInMediaVault(
  key: string,
  dataUrl: string,
): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const blob = dataUrlToBlobLocal(dataUrl);
  if (!blob) return null;
  return storeBlobInMediaVault(key, blob);
}

function registerObjectUrl(
  key: string,
  blob: Blob,
  meta: { pageIndex: number | null; kind: ManagedMediaKind },
  sourceSig?: string,
): string {
  const existing = activeObjectUrls.get(key);
  if (existing && (!sourceSig || existing.sourceSig === sourceSig)) {
    existing.pageIndex = meta.pageIndex;
    existing.kind = meta.kind;
    existing.lastUsedAt = Date.now();
    return existing.objectUrl;
  }
  if (existing) {
    try {
      URL.revokeObjectURL(existing.objectUrl);
    } catch {
      // ignore
    }
    activeObjectUrls.delete(key);
  }

  const objectUrl = URL.createObjectURL(blob);
  activeObjectUrls.set(key, {
    key,
    objectUrl,
    pageIndex: meta.pageIndex,
    kind: meta.kind,
    sizeBytes: blob.size || 0,
    lastUsedAt: Date.now(),
    sourceSig,
  });
  enforceActiveUrlCap(meta.pageIndex);
  notifyCacheListeners();
  return objectUrl;
}

function enforceActiveUrlCap(anchorPage: number | null): void {
  let totalBytes = 0;
  for (const entry of activeObjectUrls.values()) {
    totalBytes += entry.sizeBytes || 0;
  }
  if (
    activeObjectUrls.size <= MAX_ACTIVE_OBJECT_URLS &&
    totalBytes <= MAX_ACTIVE_OBJECT_URL_BYTES
  ) {
    return;
  }
  const candidates = Array.from(activeObjectUrls.values()).sort((a, b) => {
    // Prefer keeping items closest to anchorPage and most recently accessed
    const aDist =
      anchorPage !== null && a.pageIndex !== null
        ? Math.abs(a.pageIndex - anchorPage)
        : 0;
    const bDist =
      anchorPage !== null && b.pageIndex !== null
        ? Math.abs(b.pageIndex - anchorPage)
        : 0;
    if (aDist !== bDist) return bDist - aDist;
    return a.lastUsedAt - b.lastUsedAt;
  });

  while (
    (activeObjectUrls.size > MAX_ACTIVE_OBJECT_URLS ||
      totalBytes > MAX_ACTIVE_OBJECT_URL_BYTES) &&
    candidates.length
  ) {
    const victim = candidates.shift();
    if (!victim) break;
    try {
      URL.revokeObjectURL(victim.objectUrl);
    } catch {
      // ignore
    }
    totalBytes = Math.max(0, totalBytes - (victim.sizeBytes || 0));
    activeObjectUrls.delete(victim.key);
  }
}

export function getCachedObjectUrl(
  src: string | undefined,
  keyHint?: string,
): string | null {
  if (!src) return null;
  const key = isMediaRef(src)
    ? extractMediaKey(src)
    : src.startsWith('data:image/') && keyHint
      ? `inline:${keyHint}`
      : null;
  if (!key) return null;
  const entry = activeObjectUrls.get(key);
  if (!entry) return null;
  if (src.startsWith('data:image/') && entry.sourceSig) {
    if (entry.sourceSig !== computeInlineMediaSig(src)) {
      return null;
    }
  }
  entry.lastUsedAt = Date.now();
  return entry.objectUrl;
}

export function revokeMediaKey(key: string): boolean {
  const entry = activeObjectUrls.get(key);
  if (!entry) return false;
  try {
    URL.revokeObjectURL(entry.objectUrl);
  } catch {
    // ignore
  }
  activeObjectUrls.delete(key);
  notifyCacheListeners();
  return true;
}

/**
 * Resolves any image source (`idb-media://`, `data:image/...`, or direct URL) into
 * a renderable URL. Managed blobs and inline data URLs are backed by revocable
 * `blob:` Object URLs so distant pages can be cleanly lazy-unloaded from RAM.
 */
export async function ensureObjectUrlForSource(
  src: string,
  meta: {
    keyHint: string;
    pageIndex: number | null;
    kind: ManagedMediaKind;
  },
): Promise<string> {
  if (!src) return '';

  // 1. IndexedDB media reference (`idb-media://<key>`)
  if (isMediaRef(src)) {
    const key = extractMediaKey(src);
    const cached = activeObjectUrls.get(key);
    if (cached) {
      cached.pageIndex = meta.pageIndex;
      cached.lastUsedAt = Date.now();
      return cached.objectUrl;
    }

    const inflight = inflightHydrations.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      try {
        const blob = await getMediaBlob(key);
        if (!blob) return '';
        return registerObjectUrl(key, blob, meta);
      } finally {
        inflightHydrations.delete(key);
      }
    })();

    inflightHydrations.set(key, promise);
    return promise;
  }

  // 2. Inline data:image/... URL -> convert to managed revocable Object URL
  if (src.startsWith('data:image/')) {
    const cacheKey = `inline:${meta.keyHint}`;
    const srcSig = computeInlineMediaSig(src);
    const cached = activeObjectUrls.get(cacheKey);
    if (cached && cached.sourceSig === srcSig) {
      cached.pageIndex = meta.pageIndex;
      cached.lastUsedAt = Date.now();
      return cached.objectUrl;
    }
    const blob = dataUrlToBlobLocal(src);
    if (!blob) return src;
    return registerObjectUrl(cacheKey, blob, meta, srcSig);
  }

  // 3. Remote HTTPS / local static asset URL
  return src;
}

/**
 * Immediately revokes all active Object URLs for story turns farther than `radius`
 * pages from `currentPage` (default > 10 pages), and optionally revokes the custom
 * lobby background Object URL when the user is not on the Lobby screen.
 */
export function evictDistantMediaUrls(
  currentPage: number,
  radius: number = LAZY_UNLOAD_PAGE_RADIUS,
  options?: { keepLobbyBg?: boolean },
): number {
  let evictedCount = 0;
  const keepLobbyBg = options?.keepLobbyBg ?? true;

  for (const [key, entry] of activeObjectUrls.entries()) {
    const shouldEvictTurn =
      (entry.kind === 'story' || entry.kind === 'attach') &&
      entry.pageIndex !== null &&
      Math.abs(entry.pageIndex - currentPage) > radius;

    const shouldEvictBg = entry.kind === 'bg' && !keepLobbyBg;

    if (shouldEvictTurn || shouldEvictBg) {
      try {
        URL.revokeObjectURL(entry.objectUrl);
      } catch {
        // ignore
      }
      activeObjectUrls.delete(key);
      evictedCount += 1;
    }
  }

  if (evictedCount > 0) {
    notifyCacheListeners();
  }
  return evictedCount;
}

export interface MediaCacheStats {
  activeObjectUrlCount: number;
  activeObjectUrlBytes: number;
  distantObjectUrlCount: number;
  distantObjectUrlBytes: number;
}

/**
 * Computes live stats for all active Object URLs currently held in RAM,
 * including how many belong to distant pages or inactive backgrounds.
 */
export function getMediaCacheStats(
  currentPage: number,
  radius: number = QUICK_OPTIMIZE_PAGE_RADIUS,
): MediaCacheStats {
  let activeObjectUrlCount = 0;
  let activeObjectUrlBytes = 0;
  let distantObjectUrlCount = 0;
  let distantObjectUrlBytes = 0;

  for (const entry of activeObjectUrls.values()) {
    activeObjectUrlCount += 1;
    activeObjectUrlBytes += entry.sizeBytes || 0;

    const isDistantTurn =
      (entry.kind === 'story' || entry.kind === 'attach') &&
      entry.pageIndex !== null &&
      Math.abs(entry.pageIndex - currentPage) > radius;
    const isInactiveBg = entry.kind === 'bg';

    if (isDistantTurn || isInactiveBg) {
      distantObjectUrlCount += 1;
      distantObjectUrlBytes += entry.sizeBytes || 0;
    }
  }

  return {
    activeObjectUrlCount,
    activeObjectUrlBytes,
    distantObjectUrlCount,
    distantObjectUrlBytes,
  };
}

/**
 * Proactively revokes Object URLs for distant story pages (> `radius` pages
 * from `currentPage`) and inactive background images on user demand,
 * without waiting for the automatic Lazy Unload threshold.
 */
export function quickOptimizeMediaMemory(
  currentPage: number,
  radius: number = QUICK_OPTIMIZE_PAGE_RADIUS,
): { revokedCount: number; freedBytes: number } {
  let revokedCount = 0;
  let freedBytes = 0;

  for (const [key, entry] of activeObjectUrls.entries()) {
    const isDistantTurn =
      (entry.kind === 'story' || entry.kind === 'attach') &&
      entry.pageIndex !== null &&
      Math.abs(entry.pageIndex - currentPage) > radius;
    const isInactiveBg = entry.kind === 'bg';

    if (isDistantTurn || isInactiveBg) {
      try {
        URL.revokeObjectURL(entry.objectUrl);
      } catch {
        // ignore
      }
      activeObjectUrls.delete(key);
      revokedCount += 1;
      freedBytes += entry.sizeBytes || 0;
    }
  }

  if (revokedCount > 0) {
    notifyCacheListeners();
  }

  return { revokedCount, freedBytes };
}

/**
 * Offloads heavy inline `data:image/...` strings on turns farther than `radius`
 * pages from `currentPage` into IndexedDB Blobs and replaces them in React state
 * with compact `idb-media://` refs, freeing JS heap & mobile RAM with zero data loss.
 */
export async function offloadDistantTurnImagesToVault(
  turns: Turn[],
  currentPage: number,
  radius: number = LAZY_UNLOAD_PAGE_RADIUS,
): Promise<{ changed: boolean; turns: Turn[]; offloadedCount: number }> {
  if (!Array.isArray(turns) || !turns.length) {
    return { changed: false, turns, offloadedCount: 0 };
  }

  let changed = false;
  let offloadedCount = 0;
  const nextTurns = [...turns];

  for (let i = 0; i < turns.length; i += 1) {
    if (Math.abs(i - currentPage) <= radius) continue;
    const t = turns[i];
    let updatedTurn: Turn | null = null;

    let primaryStoryRef: string | null = null;
    if (t.storyImageData && t.storyImageData.startsWith('data:image/')) {
      const key = buildTurnMediaKey('story', t, i);
      const ref = await storeDataUrlInMediaVault(key, t.storyImageData);
      if (ref) {
        primaryStoryRef = ref;
        revokeMediaKey(`inline:${key}`);
        revokeMediaKey(key);
        updatedTurn = { ...(updatedTurn || t), storyImageData: ref };
        offloadedCount += 1;
      }
    }

    if (Array.isArray(t.storyImages) && t.storyImages.length > 0) {
      let beatListChanged = false;
      const nextBeatImages = [...t.storyImages];
      for (let bIdx = 0; bIdx < nextBeatImages.length; bIdx += 1) {
        const item = nextBeatImages[bIdx];
        if (!item?.imageData || !item.imageData.startsWith('data:image/')) {
          continue;
        }
        if (
          primaryStoryRef &&
          item.imageData === t.storyImageData
        ) {
          nextBeatImages[bIdx] = { ...item, imageData: primaryStoryRef };
          beatListChanged = true;
          continue;
        }
        const key = buildTurnMediaKey('story', t, i, item.position);
        const ref = await storeDataUrlInMediaVault(key, item.imageData);
        if (ref) {
          revokeMediaKey(`inline:${key}`);
          revokeMediaKey(key);
          nextBeatImages[bIdx] = { ...item, imageData: ref };
          beatListChanged = true;
          offloadedCount += 1;
        }
      }
      if (beatListChanged) {
        updatedTurn = {
          ...(updatedTurn || t),
          storyImages: nextBeatImages,
        };
      }
    }

    let primaryAttachRef: string | null = null;
    if (t.imageData && t.imageData.startsWith('data:image/')) {
      const key = buildTurnMediaKey('attach', t, i);
      const ref = await storeDataUrlInMediaVault(key, t.imageData);
      if (ref) {
        primaryAttachRef = ref;
        revokeMediaKey(`inline:${key}`);
        revokeMediaKey(key);
        updatedTurn = { ...(updatedTurn || t), imageData: ref };
        offloadedCount += 1;
      }
    }

    if (Array.isArray(t.imageList) && t.imageList.length > 0) {
      let listChanged = false;
      const nextList = [...t.imageList];
      for (let imgIdx = 0; imgIdx < nextList.length; imgIdx += 1) {
        const src = nextList[imgIdx];
        if (!src || !src.startsWith('data:image/')) continue;
        if (imgIdx === 0 && primaryAttachRef && src === t.imageData) {
          nextList[0] = primaryAttachRef;
          listChanged = true;
          continue;
        }
        const key =
          imgIdx === 0
            ? buildTurnMediaKey('attach', t, i)
            : `${buildTurnMediaKey('attach', t, i)}:${imgIdx}`;
        const ref = await storeDataUrlInMediaVault(key, src);
        if (ref) {
          revokeMediaKey(`inline:${key}`);
          revokeMediaKey(key);
          nextList[imgIdx] = ref;
          listChanged = true;
          offloadedCount += 1;
        }
      }
      if (listChanged) {
        updatedTurn = {
          ...(updatedTurn || t),
          imageList: nextList,
          ...(nextList[0] ? { imageData: nextList[0] } : {}),
        };
      }
    }

    if (updatedTurn) {
      nextTurns[i] = updatedTurn;
      changed = true;
    }
  }

  return { changed, turns: changed ? nextTurns : turns, offloadedCount };
}

/**
 * Gently pre-hydrates Object URLs for pages immediately adjacent to `currentPage`
 * so stepping forward/backward feels instantaneous even after lazy-unloading.
 */
export function prefetchNearbyTurnImages(
  turns: Turn[],
  currentPage: number,
  prefetchRadius = 2,
): void {
  if (!Array.isArray(turns) || !turns.length) return;
  const start = Math.max(0, currentPage - prefetchRadius);
  const end = Math.min(turns.length - 1, currentPage + prefetchRadius);

  for (let i = start; i <= end; i += 1) {
    const t = turns[i];
    if (!t) continue;
    if (t.storyImageData && isMediaRef(t.storyImageData)) {
      void ensureObjectUrlForSource(t.storyImageData, {
        keyHint: buildTurnMediaKey('story', t, i),
        pageIndex: i,
        kind: 'story',
      });
    }
    if (Array.isArray(t.storyImages) && t.storyImages.length > 0) {
      for (const item of t.storyImages) {
        if (item?.imageData && isMediaRef(item.imageData)) {
          void ensureObjectUrlForSource(item.imageData, {
            keyHint: buildTurnMediaKey('story', t, i, item.position),
            pageIndex: i,
            kind: 'story',
          });
        }
      }
    }
    if (Array.isArray(t.imageList) && t.imageList.length > 0) {
      t.imageList.forEach((src, imgIdx) => {
        if (src && isMediaRef(src)) {
          const keyHint =
            imgIdx === 0
              ? buildTurnMediaKey('attach', t, i)
              : `${buildTurnMediaKey('attach', t, i)}:${imgIdx}`;
          void ensureObjectUrlForSource(src, {
            keyHint,
            pageIndex: i,
            kind: 'attach',
          });
        }
      });
    } else if (t.imageData && isMediaRef(t.imageData)) {
      void ensureObjectUrlForSource(t.imageData, {
        keyHint: buildTurnMediaKey('attach', t, i),
        pageIndex: i,
        kind: 'attach',
      });
    }
  }
}

/**
 * Converts an `idb-media://` reference back into a portable `data:image/...` string
 * (used when exporting `.json` saves/backups or assigning into Portrait Bank / styles).
 */
export async function resolveMediaSourceToDataUrl(src: string): Promise<string> {
  if (!src) return '';
  if (!isMediaRef(src)) return src;
  const blob = await getMediaBlob(extractMediaKey(src));
  if (!blob) return '';
  try {
    return await blobToDataUrl(blob);
  } catch {
    return '';
  }
}

export async function hydrateTurnsMediaForExport(turns: Turn[]): Promise<Turn[]> {
  if (!Array.isArray(turns) || !turns.length) return turns;
  const result: Turn[] = [];
  for (const t of turns) {
    let next = t;
    if (t.storyImageData && isMediaRef(t.storyImageData)) {
      const hydrated = await resolveMediaSourceToDataUrl(t.storyImageData);
      if (hydrated) next = { ...next, storyImageData: hydrated };
    }
    if (Array.isArray(t.storyImages) && t.storyImages.length > 0) {
      let beatChanged = false;
      const hydratedBeats = [...t.storyImages];
      for (let bIdx = 0; bIdx < hydratedBeats.length; bIdx += 1) {
        const item = hydratedBeats[bIdx];
        if (item?.imageData && isMediaRef(item.imageData)) {
          const hydrated = await resolveMediaSourceToDataUrl(item.imageData);
          if (hydrated) {
            hydratedBeats[bIdx] = { ...item, imageData: hydrated };
            beatChanged = true;
          }
        }
      }
      if (beatChanged) {
        next = { ...next, storyImages: hydratedBeats };
      }
    }
    if (t.imageData && isMediaRef(t.imageData)) {
      const hydrated = await resolveMediaSourceToDataUrl(t.imageData);
      if (hydrated) next = { ...next, imageData: hydrated };
    }
    if (Array.isArray(t.imageList) && t.imageList.length > 0) {
      let listChanged = false;
      const hydratedList = [...t.imageList];
      for (let idx = 0; idx < hydratedList.length; idx += 1) {
        const src = hydratedList[idx];
        if (src && isMediaRef(src)) {
          const hydrated = await resolveMediaSourceToDataUrl(src);
          if (hydrated) {
            hydratedList[idx] = hydrated;
            listChanged = true;
          }
        }
      }
      if (listChanged) {
        next = {
          ...next,
          imageList: hydratedList,
          ...(hydratedList[0] ? { imageData: hydratedList[0] } : {}),
        };
      }
    }
    result.push(next);
  }
  return result;
}

export function revokeAllMediaUrls(): void {
  for (const entry of activeObjectUrls.values()) {
    try {
      URL.revokeObjectURL(entry.objectUrl);
    } catch {
      // ignore
    }
  }
  activeObjectUrls.clear();
}

function collectTurnMediaRefs(turns: Turn[] | undefined, into: Set<string>): void {
  if (!Array.isArray(turns) || !turns.length) return;
  for (const t of turns) {
    if (!t) continue;
    if (t.storyImageData && isMediaRef(t.storyImageData)) {
      into.add(extractMediaKey(t.storyImageData));
    }
    if (Array.isArray(t.storyImages)) {
      for (const item of t.storyImages) {
        if (item?.imageData && isMediaRef(item.imageData)) {
          into.add(extractMediaKey(item.imageData));
        }
      }
    }
    if (t.imageData && isMediaRef(t.imageData)) {
      into.add(extractMediaKey(t.imageData));
    }
    if (Array.isArray(t.imageList)) {
      for (const src of t.imageList) {
        if (src && isMediaRef(src)) {
          into.add(extractMediaKey(src));
        }
      }
    }
  }
}

/**
 * Collects every `idb-media://` key still referenced by active turns, save slots,
 * companion story archives, checkpoint, or lobby background so garbage collection
 * never deletes live user media.
 */
export function collectReferencedMediaKeys(state: {
  turns?: Turn[];
  slots?: Array<{ turns?: Turn[] }>;
  companionStories?: Record<string, Turn[]>;
  checkpoint?: { turns?: Turn[] } | null;
  lobbyBgDataUrl?: string;
}): Set<string> {
  const keys = new Set<string>();
  collectTurnMediaRefs(state.turns, keys);
  if (Array.isArray(state.slots)) {
    for (const slot of state.slots) {
      collectTurnMediaRefs(slot?.turns, keys);
    }
  }
  if (state.companionStories && typeof state.companionStories === 'object') {
    for (const list of Object.values(state.companionStories)) {
      collectTurnMediaRefs(list, keys);
    }
  }
  if (state.checkpoint?.turns) {
    collectTurnMediaRefs(state.checkpoint.turns, keys);
  }
  if (state.lobbyBgDataUrl && isMediaRef(state.lobbyBgDataUrl)) {
    keys.add(extractMediaKey(state.lobbyBgDataUrl));
  }
  return keys;
}

/**
 * Offloads all inline `data:image/...` strings inside inactive archive turn lists
 * (save slots and non-active companion stories) into IndexedDB Blobs so they stop
 * duplicating multi-megabyte base64 payloads inside JS heap and state snapshots.
 */
export async function offloadArchivedTurnsMediaToVault(
  turns: Turn[],
  keyPrefix = 'archive',
): Promise<{
  changed: boolean;
  turns: Turn[];
  offloadedCount: number;
  offloadedBytes: number;
}> {
  if (!Array.isArray(turns) || !turns.length) {
    return { changed: false, turns, offloadedCount: 0, offloadedBytes: 0 };
  }

  const safePrefix = keyPrefix.replace(/[^a-zA-Z0-9_:-]+/g, '_').slice(0, 48);
  let changed = false;
  let offloadedCount = 0;
  let offloadedBytes = 0;
  const nextTurns = [...turns];

  for (let i = 0; i < turns.length; i += 1) {
    const t = turns[i];
    if (!t) continue;
    let updatedTurn: Turn | null = null;

    let primaryStoryRef: string | null = null;
    if (t.storyImageData && t.storyImageData.startsWith('data:image/')) {
      const key = `${safePrefix}:${buildTurnMediaKey('story', t, i)}`;
      const ref = await storeDataUrlInMediaVault(key, t.storyImageData);
      if (ref) {
        primaryStoryRef = ref;
        offloadedBytes += t.storyImageData.length;
        offloadedCount += 1;
        updatedTurn = { ...(updatedTurn || t), storyImageData: ref };
      }
    }

    if (Array.isArray(t.storyImages) && t.storyImages.length > 0) {
      let beatListChanged = false;
      const nextBeatImages = [...t.storyImages];
      for (let bIdx = 0; bIdx < nextBeatImages.length; bIdx += 1) {
        const item = nextBeatImages[bIdx];
        if (!item?.imageData || !item.imageData.startsWith('data:image/')) {
          continue;
        }
        if (primaryStoryRef && item.imageData === t.storyImageData) {
          nextBeatImages[bIdx] = { ...item, imageData: primaryStoryRef };
          beatListChanged = true;
          continue;
        }
        const key = `${safePrefix}:${buildTurnMediaKey('story', t, i, item.position)}`;
        const ref = await storeDataUrlInMediaVault(key, item.imageData);
        if (ref) {
          offloadedBytes += item.imageData.length;
          offloadedCount += 1;
          nextBeatImages[bIdx] = { ...item, imageData: ref };
          beatListChanged = true;
        }
      }
      if (beatListChanged) {
        updatedTurn = {
          ...(updatedTurn || t),
          storyImages: nextBeatImages,
        };
      }
    }

    let primaryAttachRef: string | null = null;
    if (t.imageData && t.imageData.startsWith('data:image/')) {
      const key = `${safePrefix}:${buildTurnMediaKey('attach', t, i)}`;
      const ref = await storeDataUrlInMediaVault(key, t.imageData);
      if (ref) {
        primaryAttachRef = ref;
        offloadedBytes += t.imageData.length;
        offloadedCount += 1;
        updatedTurn = { ...(updatedTurn || t), imageData: ref };
      }
    }

    if (Array.isArray(t.imageList) && t.imageList.length > 0) {
      let listChanged = false;
      const nextList = [...t.imageList];
      for (let imgIdx = 0; imgIdx < nextList.length; imgIdx += 1) {
        const src = nextList[imgIdx];
        if (!src || !src.startsWith('data:image/')) continue;
        if (imgIdx === 0 && primaryAttachRef && src === t.imageData) {
          nextList[0] = primaryAttachRef;
          listChanged = true;
          continue;
        }
        const baseKey = buildTurnMediaKey('attach', t, i);
        const key =
          imgIdx === 0
            ? `${safePrefix}:${baseKey}`
            : `${safePrefix}:${baseKey}:${imgIdx}`;
        const ref = await storeDataUrlInMediaVault(key, src);
        if (ref) {
          offloadedBytes += src.length;
          offloadedCount += 1;
          nextList[imgIdx] = ref;
          listChanged = true;
        }
      }
      if (listChanged) {
        updatedTurn = {
          ...(updatedTurn || t),
          imageList: nextList,
          ...(nextList[0] ? { imageData: nextList[0] } : {}),
        };
      }
    }

    if (updatedTurn) {
      nextTurns[i] = updatedTurn;
      changed = true;
    }
  }

  return {
    changed,
    turns: changed ? nextTurns : turns,
    offloadedCount,
    offloadedBytes,
  };
}

/**
 * Safely deletes unreferenced orphaned blobs from `ark_lite_media_vault_v1`.
 * Keeps every blob present in `referencedKeys` or currently held in active RAM cache.
 */
export async function pruneOrphanedMediaBlobs(
  referencedKeys: Set<string>,
): Promise<{ deletedCount: number; freedBytes: number }> {
  const db = await openMediaDb();
  if (!db) return { deletedCount: 0, freedBytes: 0 };

  return new Promise<{ deletedCount: number; freedBytes: number }>((resolve) => {
    let deletedCount = 0;
    let freedBytes = 0;
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = String(cursor.key || '');
        const keep = referencedKeys.has(key) || activeObjectUrls.has(key);
        if (!keep) {
          const val = cursor.value;
          if (val instanceof Blob) {
            freedBytes += val.size || 0;
          }
          try {
            cursor.delete();
            deletedCount += 1;
          } catch {
            // ignore single-record delete errors
          }
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve({ deletedCount, freedBytes });
      tx.onerror = () => resolve({ deletedCount, freedBytes });
      tx.onabort = () => resolve({ deletedCount, freedBytes });
    } catch {
      resolve({ deletedCount: 0, freedBytes: 0 });
    }
  });
}

/**
 * Fast read-only size estimate of stored blobs in `ark_lite_media_vault_v1`.
 */
export async function estimateMediaVaultUsage(): Promise<{
  blobCount: number;
  totalBytes: number;
}> {
  const db = await openMediaDb();
  if (!db) return { blobCount: 0, totalBytes: 0 };

  return new Promise<{ blobCount: number; totalBytes: number }>((resolve) => {
    let blobCount = 0;
    let totalBytes = 0;
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        blobCount += 1;
        const val = cursor.value;
        if (val instanceof Blob) {
          totalBytes += val.size || 0;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve({ blobCount, totalBytes });
      tx.onerror = () => resolve({ blobCount, totalBytes });
      tx.onabort = () => resolve({ blobCount, totalBytes });
    } catch {
      resolve({ blobCount: 0, totalBytes: 0 });
    }
  });
}

