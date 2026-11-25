import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookImage,
  Check,
  Image as ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Search,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  getTurnAttachedImages,
  getTurnStoryImages,
  STORY_IMAGE_POSITION_META,
  type CharacterPortrait,
  type PendingImage,
  type Turn,
} from '../types/ark';
import { matchesQuery } from '../utils/search';
import { useResolvedMediaUrl } from '../hooks/useResolvedMediaUrl';
import {
  isMediaRef,
  resolveMediaSourceToDataUrl,
  type ManagedMediaKind,
} from '../utils/mediaMemoryManager';
import {
  importExternalAvatarFromFile,
  importExternalAvatarFromUrl,
  resolveAvatarSourceForStorage,
} from '../utils/avatarUpload';
import { ResolvedAvatarImage } from './ResolvedAvatarImage';

export type ImagePickerSource = 'all' | 'portraits' | 'story' | 'attached';
type PickerPanelMode = 'library' | 'device' | 'url';

export interface ImagePickerTarget {
  mode: 'composer' | 'turn' | 'character';
  portraitId?: string;
  portraitName?: string;
}

export interface PickableImageItem {
  id: string;
  src: string;
  title: string;
  subtitle: string;
  source: Exclude<ImagePickerSource, 'all'>;
  sourceLabel: string;
  caption?: string;
  pageIndex?: number | null;
}

function LazyPickerImage({
  src,
  alt,
  keyHint,
  pageIndex = null,
  kind = 'misc',
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  keyHint: string;
  pageIndex?: number | null;
  kind?: ManagedMediaKind;
  className: string;
  eager?: boolean;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(eager);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (eager || inView) return;
    const el = holderRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, inView]);

  const { resolvedUrl } = useResolvedMediaUrl(src, {
    keyHint,
    pageIndex,
    kind,
    enabled: inView,
  });

  return (
    <div ref={holderRef} className="h-full w-full">
      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-rose-950/35 px-1 text-center text-[10px] text-rose-200">
          <AlertCircle className="h-3.5 w-3.5 text-rose-300" />
          <span>Lỗi ảnh</span>
        </div>
      ) : resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={className}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#0a101d] text-[10px] text-slate-500">
          Đang tải...
        </div>
      )}
    </div>
  );
}

interface ImagePickerModalProps {
  target: ImagePickerTarget;
  portraits: CharacterPortrait[];
  turns: Turn[];
  currentPage: number;
  pendingImage?: PendingImage | null;
  pendingImages?: PendingImage[];
  onClose: () => void;
  onAttachToComposer?: (img: PendingImage, suggestedCaption?: string) => void;
  onAssignToCurrentTurn?: (src: string, subjectLabel: string) => void;
  onAssignToCharacter?: (portraitId: string, src: string, label: string) => void;
  onPickFromDevice?: () => void;
}

const SOURCE_TABS: Array<{
  id: ImagePickerSource;
  label: string;
}> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'portraits', label: 'Ảnh NV/NPC' },
  { id: 'story', label: 'Ảnh trong truyện' },
  { id: 'attached', label: 'Ảnh đính kèm' },
];

export const ImagePickerModal = memo(function ImagePickerModal({
  target,
  portraits,
  turns,
  currentPage,
  pendingImage,
  pendingImages,
  onClose,
  onAttachToComposer,
  onAssignToCurrentTurn,
  onAssignToCharacter,
  onPickFromDevice,
}: ImagePickerModalProps) {
  const [panelMode, setPanelMode] = useState<PickerPanelMode>('library');
  const [sourceFilter, setSourceFilter] = useState<ImagePickerSource>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignCharId, setAssignCharId] = useState<string>(
    target.portraitId || portraits[0]?.id || '',
  );

  // External file upload state
  const [localUploadItem, setLocalUploadItem] =
    useState<PickableImageItem | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  // External URL import state
  const [urlInput, setUrlInput] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlStatus, setUrlStatus] = useState<string | null>(null);
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlUploadItem, setUrlUploadItem] = useState<PickableImageItem | null>(
    null,
  );

  // Confirm apply state
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const allItems = useMemo<PickableImageItem[]>(() => {
    const items: PickableImageItem[] = [];

    if (localUploadItem) {
      items.push(localUploadItem);
    }
    if (urlUploadItem) {
      items.push(urlUploadItem);
    }

    // 1. Character / NPC Portraits
    for (const p of portraits) {
      const src = (p.imageData || '').trim();
      if (!src) continue;
      items.push({
        id: `portrait:${p.id}`,
        src,
        title: p.name || 'Nhân vật',
        subtitle: p.role || (p.isMc ? 'Nhân vật chính' : 'NPC'),
        source: 'portraits',
        sourceLabel: 'Ảnh NV/NPC',
        caption: p.name ? `Chân dung ${p.name}` : undefined,
      });
    }

    // 2. Story generated images (newest first, including all beat frames)
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      const beatImgs = getTurnStoryImages(t).filter((item) =>
        Boolean(item.imageData?.trim()),
      );
      for (const beat of beatImgs) {
        const src = (beat.imageData || '').trim();
        if (!src) continue;
        const posMeta = STORY_IMAGE_POSITION_META[beat.position];
        const subject = (beat.subject || '').trim() || posMeta.label;
        items.push({
          id: `story:${t.id || i}:${beat.position}`,
          src,
          title: subject || `Minh họa Trang ${i + 1}`,
          subtitle: `Trang ${i + 1} · ${posMeta.shortLabel}`,
          source: 'story',
          sourceLabel: 'Ảnh trong truyện',
          caption: subject || `Ảnh minh họa Trang ${i + 1}`,
          pageIndex: i,
        });
      }
    }

    // 3. Attached images (pending queue + turn attachments, newest first)
    const effectivePending =
      Array.isArray(pendingImages) && pendingImages.length > 0
        ? pendingImages
        : pendingImage?.dataUrl
          ? [pendingImage]
          : [];
    effectivePending.forEach((pImg, pIdx) => {
      if (!pImg?.dataUrl) return;
      items.push({
        id: `attached:pending:${pImg.id || pIdx}`,
        src: pImg.dataUrl,
        title:
          pImg.name ||
          (effectivePending.length > 1
            ? `Ảnh chờ gửi #${pIdx + 1}`
            : 'Ảnh đang chờ gửi'),
        subtitle:
          effectivePending.length > 1
            ? `Hàng chờ lượt mới (${pIdx + 1}/${effectivePending.length})`
            : 'Đang đính kèm lượt mới',
        source: 'attached',
        sourceLabel: 'Ảnh đính kèm',
        caption: pImg.name,
      });
    });

    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      const attachedList = getTurnAttachedImages(t);
      if (!attachedList.length) continue;
      const cap = (t.imageCaption || '').trim();
      attachedList.forEach((src, imgIdx) => {
        const suffix =
          attachedList.length > 1
            ? ` (${imgIdx + 1}/${attachedList.length})`
            : '';
        items.push({
          id: `attached:${t.id || i}:${imgIdx}`,
          src,
          title: `${cap || `Ảnh đính kèm Trang ${i + 1}`}${suffix}`,
          subtitle: `Trang ${i + 1}`,
          source: 'attached',
          sourceLabel: 'Ảnh đính kèm',
          caption: cap || undefined,
          pageIndex: i,
        });
      });
    }

    return items;
  }, [
    localUploadItem,
    urlUploadItem,
    portraits,
    turns,
    pendingImage,
    pendingImages,
  ]);

  const counts = useMemo(() => {
    let portraitsCount = 0;
    let storyCount = 0;
    let attachedCount = 0;
    for (const item of allItems) {
      if (item.source === 'portraits') portraitsCount++;
      else if (item.source === 'story') storyCount++;
      else attachedCount++;
    }
    return {
      all: allItems.length,
      portraits: portraitsCount,
      story: storyCount,
      attached: attachedCount,
    };
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const q = query.trim();
    return allItems.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (!q) return true;
      return matchesQuery(
        `${item.title} ${item.subtitle} ${item.sourceLabel} ${item.caption || ''}`,
        q,
      );
    });
  }, [allItems, sourceFilter, query]);

  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === selectedId) || null,
    [allItems, selectedId],
  );

  const hasCurrentTurn = currentPage >= 0 && currentPage < turns.length;

  const handleLocalFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setDeviceBusy(true);
    setDeviceError(null);
    setDeviceStatus(null);
    setApplyError(null);
    try {
      const res = await importExternalAvatarFromFile(file);
      if (!res.ok || !res.imageData) {
        setDeviceError(
          res.error || 'Không thể đọc tệp ảnh đã chọn từ thiết bị.',
        );
        return;
      }
      const item: PickableImageItem = {
        id: `local:${Date.now()}`,
        src: res.imageData,
        title: file.name || 'Ảnh từ thiết bị',
        subtitle: res.approxKb
          ? `Tải từ máy (~${res.approxKb} KB)`
          : 'Tải lên từ máy',
        source: 'attached',
        sourceLabel: 'Ảnh từ thiết bị',
        caption: String(file?.name ?? '').replace(/\.[^.]+$/, ''),
      };
      setLocalUploadItem(item);
      setSelectedId(item.id);
      setDeviceStatus(res.note || 'Đã tải ảnh từ thiết bị.');
      if (sourceFilter !== 'all' && sourceFilter !== 'attached') {
        setSourceFilter('all');
      }
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleFetchUrlPreview = async () => {
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      setUrlError('Vui lòng dán đường dẫn URL ảnh trước.');
      return;
    }
    setUrlBusy(true);
    setUrlError(null);
    setUrlWarning(null);
    setUrlStatus(null);
    setApplyError(null);
    try {
      const res = await importExternalAvatarFromUrl(cleanUrl);
      if (!res.ok || !res.imageData) {
        setUrlError(
          res.error ||
            'Không thể tải ảnh từ URL này. Kiểm tra lại đường dẫn hoặc CORS.',
        );
        return;
      }
      const urlName = (() => {
        try {
          const parsed = new URL(cleanUrl);
          const seg = parsed.pathname.split('/').filter(Boolean).pop();
          return seg ? decodeURIComponent(seg).slice(0, 42) : parsed.hostname;
        } catch {
          return 'Ảnh từ URL';
        }
      })();
      const item: PickableImageItem = {
        id: `url:${Date.now()}`,
        src: res.imageData,
        title: urlName || 'Ảnh từ URL',
        subtitle:
          res.mode === 'url_cached' && res.approxKb
            ? `Đã tải & lưu cục bộ (~${res.approxKb} KB)`
            : 'Liên kết URL trực tiếp',
        source: 'attached',
        sourceLabel: 'Ảnh từ URL',
        caption: urlName,
      };
      setUrlUploadItem(item);
      setSelectedId(item.id);
      setUrlStatus(res.note || 'Đã tải ảnh từ URL thành công.');
      if (res.warning) {
        setUrlWarning(res.warning);
      }
    } finally {
      setUrlBusy(false);
    }
  };

  const handleConfirmAttachComposer = async () => {
    if (!selectedItem || !onAttachToComposer) return;
    setApplying(true);
    setApplyError(null);
    try {
      const safeName =
        String(selectedItem?.title ?? '').replace(/[^\p{L}\p{N}_ .-]+/gu, '').trim() ||
        'anh_da_chon';
      const resolvedSrc = isMediaRef(selectedItem.src)
        ? await resolveMediaSourceToDataUrl(selectedItem.src)
        : selectedItem.src;
      if (!resolvedSrc) {
        setApplyError(
          'Không thể khôi phục dữ liệu ảnh đã chọn. Hãy thử tải lại từ thiết bị.',
        );
        return;
      }
      onAttachToComposer(
        {
          dataUrl: resolvedSrc,
          name: `${safeName}.png`,
        },
        selectedItem.caption,
      );
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const handleConfirmAssignTurn = () => {
    if (!selectedItem || !onAssignToCurrentTurn || !hasCurrentTurn) return;
    onAssignToCurrentTurn(selectedItem.src, selectedItem.title);
    onClose();
  };

  const handleConfirmAssignCharacter = async (portraitIdOverride?: string) => {
    const targetPid = portraitIdOverride || target.portraitId || assignCharId;
    if (!selectedItem || !onAssignToCharacter || !targetPid) return;
    setApplying(true);
    setApplyError(null);
    try {
      const resolved = await resolveAvatarSourceForStorage(selectedItem.src);
      if (!resolved.ok || !resolved.imageData) {
        setApplyError(
          resolved.error ||
            'Không thể lưu ảnh này làm Avatar nhân vật. Vui lòng thử ảnh khác.',
        );
        return;
      }
      onAssignToCharacter(targetPid, resolved.imageData, selectedItem.title);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const modalTitle =
    target.mode === 'character' && target.portraitName
      ? `Chọn Avatar cho ${target.portraitName}`
      : 'Chọn ảnh';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[#070c16]/78 sm:items-center sm:p-4 backdrop-blur-sm"
    >
      <input
        ref={localFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleLocalFileChange(e)}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-[#162032] ring-1 ring-white/[0.10] shadow-[0_24px_60px_-14px_rgba(2,6,23,0.88)] sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ImageIcon className="h-4 w-4 shrink-0 text-sky-300" />
            <h2 className="truncate text-sm font-bold text-slate-50">
              {modalTitle}
            </h2>
            <span className="shrink-0 text-[11px] font-medium text-slate-400 tabular-nums">
              {allItems.length} ảnh
            </span>
          </div>

          <button
            type="button"
            aria-label="Đóng chọn ảnh"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.12]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top Source Mode Switcher: Library | Device Upload | Paste URL */}
        <div className="grid grid-cols-3 gap-1.5 border-b border-white/[0.07] bg-[#101827] px-3 py-2">
          <button
            type="button"
            onClick={() => setPanelMode('library')}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors ${
              panelMode === 'library'
                ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                : 'bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.08]'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Thư viện</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (target.mode === 'composer' && onPickFromDevice) {
                onClose();
                onPickFromDevice();
              } else {
                setPanelMode('device');
              }
            }}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors ${
              panelMode === 'device'
                ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/40'
                : 'bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.08]'
            }`}
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Từ thiết bị</span>
          </button>
          <button
            type="button"
            onClick={() => setPanelMode('url')}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors ${
              panelMode === 'url'
                ? 'bg-amber-500/20 text-amber-100 ring-1 ring-inset ring-amber-400/40'
                : 'bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.08]'
            }`}
          >
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Dán URL ảnh</span>
          </button>
        </div>

        {/* Mode 1: Library Filter Tabs + Search */}
        {panelMode === 'library' && (
          <div className="space-y-2 border-b border-white/[0.07] bg-[#121b2b] px-4 py-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {SOURCE_TABS.map((tab) => {
                const active = sourceFilter === tab.id;
                const count = counts[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSourceFilter(tab.id)}
                    className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-sky-500/18 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                        : 'bg-white/[0.045] text-slate-300 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.09] hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] tabular-nums ${
                        active ? 'text-sky-200/90' : 'text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm ảnh theo tên nhân vật, số trang hoặc chú thích..."
                className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625] py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa tìm ảnh"
                  onClick={() => setQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="min-h-[210px] flex-1 overflow-y-auto bg-[#0f1726] p-3">
          {panelMode === 'device' ? (
            <div className="space-y-3 p-1">
              <button
                type="button"
                disabled={deviceBusy}
                onClick={() => localFileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-400/35 bg-emerald-500/[0.06] px-4 py-8 text-center transition-colors hover:bg-emerald-500/[0.10] active:scale-[0.99] disabled:opacity-60"
              >
                {deviceBusy ? (
                  <>
                    <Loader2 className="mb-2 h-7 w-7 animate-spin text-emerald-300" />
                    <p className="text-xs font-semibold text-emerald-100">
                      Đang đọc & tối ưu ảnh từ thiết bị...
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="mb-2 h-7 w-7 text-emerald-300" />
                    <p className="text-xs font-semibold text-slate-100">
                      Chạm để chọn ảnh từ thư viện điện thoại / máy tính
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Hỗ trợ JPG, PNG, WebP (tối đa 20 MB). Ảnh sẽ tự động nén
                      gọn sắc nét để lưu bền vững trên mobile.
                    </p>
                  </>
                )}
              </button>

              {deviceError && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-500/12 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/30">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <span>{deviceError}</span>
                </div>
              )}

              {deviceStatus && (
                <div className="rounded-xl bg-emerald-500/12 px-3 py-2 text-xs text-emerald-100 ring-1 ring-inset ring-emerald-400/30">
                  {deviceStatus}
                </div>
              )}

              {localUploadItem && (
                <div className="flex items-center gap-3 rounded-2xl bg-[#141f33] p-3 ring-1 ring-white/[0.08]">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#0a101d] ring-1 ring-emerald-400/35">
                    <ResolvedAvatarImage
                      src={localUploadItem.src}
                      alt={localUploadItem.title}
                      keyHint={localUploadItem.id}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-slate-100">
                      {localUploadItem.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {localUploadItem.subtitle}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(localUploadItem.id)}
                      className="mt-2 inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/18 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30"
                    >
                      <Check className="h-3 w-3" />
                      <span>Đã chọn — bấm xác nhận bên dưới</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : panelMode === 'url' ? (
            <div className="space-y-3 p-1">
              <div className="rounded-2xl bg-[#131d2f] p-3.5 ring-1 ring-white/[0.08]">
                <label className="mb-1.5 block text-xs font-semibold text-slate-200">
                  Dán đường dẫn URL ảnh trực tiếp (HTTPS)
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    inputMode="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setUrlError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleFetchUrlPreview();
                      }
                    }}
                    placeholder="https://example.com/character-avatar.jpg"
                    className="min-h-[38px] flex-1 rounded-xl border border-white/[0.10] bg-[#0c1422] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                  <button
                    type="button"
                    disabled={urlBusy || !urlInput.trim()}
                    onClick={() => void handleFetchUrlPreview()}
                    className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500/20 px-4 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/35 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    {urlBusy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3.5 w-3.5" />
                        <span>Tải & Xem trước</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Hệ thống tự động kiểm tra lỗi link hỏng, Mixed Content hoặc bị
                  chặn CORS. Nếu máy chủ cho phép CORS, ảnh sẽ được nén lưu cục
                  bộ để không bao giờ mất ảnh khi tải lại.
                </p>
              </div>

              {urlError && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-500/12 px-3 py-2.5 text-xs leading-relaxed text-rose-200 ring-1 ring-inset ring-rose-400/30">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <span>{urlError}</span>
                </div>
              )}

              {urlWarning && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-500/12 px-3 py-2 text-xs leading-relaxed text-amber-100 ring-1 ring-inset ring-amber-400/30">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <span>{urlWarning}</span>
                </div>
              )}

              {urlStatus && !urlWarning && (
                <div className="rounded-xl bg-emerald-500/12 px-3 py-2 text-xs text-emerald-100 ring-1 ring-inset ring-emerald-400/30">
                  {urlStatus}
                </div>
              )}

              {urlUploadItem && (
                <div className="flex items-center gap-3 rounded-2xl bg-[#141f33] p-3 ring-1 ring-white/[0.08]">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#0a101d] ring-1 ring-amber-400/35">
                    <ResolvedAvatarImage
                      src={urlUploadItem.src}
                      alt={urlUploadItem.title}
                      keyHint={urlUploadItem.id}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-slate-100">
                      {urlUploadItem.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {urlUploadItem.subtitle}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(urlUploadItem.id)}
                      className="mt-2 inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-amber-500/18 px-2.5 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/30"
                    >
                      <Check className="h-3 w-3" />
                      <span>Xem trước OK — bấm xác nhận bên dưới</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.10] bg-[#131d2f] px-4 py-8 text-center">
              <ImageIcon className="mb-2 h-7 w-7 text-slate-500" />
              <p className="text-xs font-medium text-slate-300">
                {allItems.length === 0
                  ? 'Chưa có ảnh nào trong thư viện hoặc các lượt truyện.'
                  : 'Không có ảnh nào khớp với bộ lọc hiện tại.'}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Bạn có thể tải ảnh trực tiếp từ thiết bị hoặc dán URL ảnh ở hai
                tab bên trên.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPanelMode('device');
                    localFileInputRef.current?.click();
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-emerald-500/16 px-3.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 transition-colors hover:bg-emerald-500/24"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Chọn từ thiết bị</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelMode('url')}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-amber-500/16 px-3.5 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/30 transition-colors hover:bg-amber-500/24"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Dán URL ảnh</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {filteredItems.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setApplyError(null);
                      setSelectedId((prev) =>
                        prev === item.id ? null : item.id,
                      );
                    }}
                    className={`group relative aspect-square overflow-hidden rounded-xl bg-[#0a101d] text-left transition-transform active:scale-[0.98] focus:outline-none ${
                      isSelected
                        ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-[#0f1726]'
                        : 'ring-1 ring-white/[0.08] hover:ring-sky-400/50'
                    }`}
                  >
                    <LazyPickerImage
                      src={item.src}
                      alt={item.title}
                      keyHint={item.id}
                      pageIndex={item.pageIndex ?? null}
                      kind={
                        item.source === 'story'
                          ? 'story'
                          : item.source === 'attached'
                            ? 'attach'
                            : 'misc'
                      }
                      className="h-full w-full object-cover"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#080d18]/92 via-[#080d18]/45 to-transparent"
                    />
                    <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 block truncate text-[11px] font-semibold text-slate-100">
                      {item.title}
                    </span>

                    {/* Compact Source Indicator */}
                    <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#0b1220]/80 text-slate-200 ring-1 ring-white/[0.12]">
                      {item.source === 'portraits' ? (
                        <Users className="h-3 w-3 text-emerald-300" />
                      ) : item.source === 'story' ? (
                        <BookImage className="h-3 w-3 text-sky-300" />
                      ) : (
                        <Paperclip className="h-3 w-3 text-amber-300" />
                      )}
                    </span>

                    {isSelected && (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white shadow">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Preview & Confirm Footer */}
        <div className="border-t border-white/[0.08] bg-[#141e30] px-4 py-3">
          {applyError && (
            <div className="mb-2 flex items-start gap-2 rounded-xl bg-rose-500/14 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/30">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
              <span>{applyError}</span>
            </div>
          )}

          {!selectedItem ? (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                Chọn ảnh từ thư viện, tải từ máy hoặc dán URL để xác nhận áp
                dụng.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[34px] shrink-0 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
              >
                Đóng
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#0a101d] ring-1 ring-white/[0.12] sm:h-20 sm:w-20">
                  <LazyPickerImage
                    src={selectedItem.src}
                    alt={selectedItem.title}
                    keyHint={selectedItem.id}
                    pageIndex={selectedItem.pageIndex ?? null}
                    kind={
                      selectedItem.source === 'story'
                        ? 'story'
                        : selectedItem.source === 'attached'
                          ? 'attach'
                          : 'misc'
                    }
                    eager
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-50">
                    {selectedItem.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-400">
                    {selectedItem.sourceLabel} · {selectedItem.subtitle}
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {target.mode === 'character' &&
                      target.portraitId &&
                      onAssignToCharacter && (
                        <button
                          type="button"
                          disabled={applying}
                          onClick={() =>
                            void handleConfirmAssignCharacter(target.portraitId)
                          }
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500 disabled:opacity-60 whitespace-nowrap"
                        >
                          {applying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {applying
                              ? 'Đang lưu...'
                              : `Gán làm Avatar ${target.portraitName || 'NV'}`}
                          </span>
                        </button>
                      )}

                    {onAttachToComposer && (
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => void handleConfirmAttachComposer()}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold disabled:opacity-60 whitespace-nowrap ${
                          target.mode === 'character'
                            ? 'bg-white/[0.06] text-slate-100 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.11]'
                            : 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500'
                        }`}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>Đính kèm lượt mới</span>
                      </button>
                    )}

                    {onAssignToCurrentTurn && hasCurrentTurn && (
                      <button
                        type="button"
                        disabled={applying}
                        onClick={handleConfirmAssignTurn}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-colors hover:bg-emerald-500/22 disabled:opacity-60 whitespace-nowrap"
                      >
                        <BookImage className="h-3.5 w-3.5" />
                        <span>Gán vào Trang {currentPage + 1}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional Character Assignment Row (when opened from composer/utility) */}
              {target.mode !== 'character' &&
                onAssignToCharacter &&
                portraits.length > 0 && (
                  <div className="flex items-center gap-2 border-t border-white/[0.07] pt-2">
                    <select
                      aria-label="Chọn nhân vật để gán ảnh"
                      value={assignCharId}
                      onChange={(e) => setAssignCharId(e.target.value)}
                      className="min-h-[34px] min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-[#0e1625] px-2.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                    >
                      {portraits.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.isMc ? ' (NV chính)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!assignCharId || applying}
                      onClick={() =>
                        void handleConfirmAssignCharacter(assignCharId)
                      }
                      className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.11] disabled:opacity-40 whitespace-nowrap"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Gán cho NV</span>
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
