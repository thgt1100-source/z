import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Download,
  Gauge,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { useActionConfirmFeedback } from '../utils/touchFeedback';
import type { CharacterPortrait, SaveSlot, Turn } from '../types/ark';
import {
  ESTIMATED_RAM_BUDGET_MB,
  getMediaCacheStats,
  QUICK_OPTIMIZE_PAGE_RADIUS,
  subscribeMediaCache,
} from '../utils/mediaMemoryManager';
import {
  getCultivationDisplayInfo,
  getRealmVisualTheme,
  normalizeCultivationProfile,
} from '../utils/cultivation';
import { matchesQuery } from '../utils/search';
import type { AutoSaveStatus, StorageHealthInfo } from '../utils/storage';

export interface QuickOptimizeResult {
  revokedUrls: number;
  offloadedImages: number;
  freedBytes: number;
  prunedOrphanBlobs?: number;
  compactedMemoryEntries?: number;
}

interface DataViewProps {
  slots: SaveSlot[];
  turns: Turn[];
  portraits: CharacterPortrait[];
  currentPage: number;
  lobbyBgDataUrl?: string;
  hasCheckpoint: boolean;
  autoSaveStatus?: AutoSaveStatus;
  storageHealth?: StorageHealthInfo | null;
  turnsSinceLastBackup?: number;
  lastBackupAt?: number | null;
  isQuickBackingUp?: boolean;
  onQuickBackup?: () => void;
  onQuickOptimizeMemory: () => Promise<QuickOptimizeResult>;
  onTriggerImport: () => void;
  onImportJsonText: (raw: string) => void;
  onSaveSlot: () => void;
  onDownloadSave: (slotIdx?: number) => void;
  onDownloadFullBackup: () => void;
  onUndoCheckpoint: () => void;
  onRequestResetClean: () => void;
  onLoadSlot: (idx: number) => void;
  onCloneSlot: (idx: number) => void;
  onDeleteSlot: (idx: number) => void;
}

function formatMemoryBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${Math.max(0, Math.round(bytes))} B`;
}

const BAR_WIDTH_STEPS = [
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
] as const;

function resolveBarWidthClass(percent: number): string {
  const idx = Math.min(
    BAR_WIDTH_STEPS.length - 1,
    Math.max(0, Math.round(percent / 5) - 1),
  );
  return BAR_WIDTH_STEPS[idx];
}

export function DataView({
  slots,
  turns,
  portraits,
  currentPage,
  lobbyBgDataUrl,
  hasCheckpoint,
  autoSaveStatus,
  storageHealth,
  turnsSinceLastBackup = 0,
  lastBackupAt = null,
  isQuickBackingUp = false,
  onQuickBackup,
  onQuickOptimizeMemory,
  onTriggerImport,
  onImportJsonText,
  onSaveSlot,
  onDownloadSave,
  onDownloadFullBackup,
  onUndoCheckpoint,
  onRequestResetClean,
  onLoadSlot,
  onCloneSlot,
  onDeleteSlot,
}: DataViewProps) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [slotSearch, setSlotSearch] = useState('');
  const [cacheTick, setCacheTick] = useState(0);
  const [dismissedStorageWarn, setDismissedStorageWarn] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeNote, setOptimizeNote] = useState<string | null>(null);
  const { isConfirmed, triggerConfirm } = useActionConfirmFeedback(1150);

  useEffect(() => {
    return subscribeMediaCache(() => {
      setCacheTick((t) => t + 1);
    });
  }, []);

  const memorySummary = useMemo(() => {
    void cacheTick;
    const cacheStats = getMediaCacheStats(
      currentPage,
      QUICK_OPTIMIZE_PAGE_RADIUS,
    );

    let inlineImageBytes = 0;
    let distantInlineCount = 0;
    let textBytes = 0;

    for (let i = 0; i < turns.length; i += 1) {
      const t = turns[i];
      const isDistant = Math.abs(i - currentPage) > QUICK_OPTIMIZE_PAGE_RADIUS;
      textBytes += ((t.user?.length || 0) + (t.assistant?.length || 0)) * 2;
      if (t.storyImageData && t.storyImageData.startsWith('data:image/')) {
        inlineImageBytes += t.storyImageData.length;
        if (isDistant) distantInlineCount += 1;
      }
      if (Array.isArray(t.imageList) && t.imageList.length > 0) {
        for (const src of t.imageList) {
          if (src && src.startsWith('data:image/')) {
            inlineImageBytes += src.length;
            if (isDistant) distantInlineCount += 1;
          }
        }
      } else if (t.imageData && t.imageData.startsWith('data:image/')) {
        inlineImageBytes += t.imageData.length;
        if (isDistant) distantInlineCount += 1;
      }
    }

    for (const p of portraits) {
      textBytes +=
        ((p.name?.length || 0) +
          (p.appearance?.length || 0) +
          (p.personality?.length || 0) +
          (p.relationships?.length || 0)) *
        2;
      if (p.imageData && p.imageData.startsWith('data:image/')) {
        inlineImageBytes += p.imageData.length;
      }
    }

    if (lobbyBgDataUrl && lobbyBgDataUrl.startsWith('data:image/')) {
      inlineImageBytes += lobbyBgDataUrl.length;
      distantInlineCount += 1;
    }

    for (const s of slots) {
      for (const t of s.turns || []) {
        textBytes += ((t.user?.length || 0) + (t.assistant?.length || 0)) * 2;
        if (t.storyImageData && t.storyImageData.startsWith('data:image/')) {
          inlineImageBytes += t.storyImageData.length;
        }
        if (Array.isArray(t.imageList) && t.imageList.length > 0) {
          for (const src of t.imageList) {
            if (src && src.startsWith('data:image/')) {
              inlineImageBytes += src.length;
            }
          }
        } else if (t.imageData && t.imageData.startsWith('data:image/')) {
          inlineImageBytes += t.imageData.length;
        }
      }
    }

    const totalEstimatedBytes =
      cacheStats.activeObjectUrlBytes + inlineImageBytes + textBytes;
    const totalMb = totalEstimatedBytes / (1024 * 1024);
    const barPercent = Math.min(
      100,
      Math.max(4, Math.round((totalMb / ESTIMATED_RAM_BUDGET_MB) * 100)),
    );
    const level: 'low' | 'medium' | 'high' =
      totalMb >= 200 ? 'high' : totalMb >= 110 ? 'medium' : 'low';
    const reclaimableCount =
      cacheStats.distantObjectUrlCount + distantInlineCount;

    return {
      totalEstimatedBytes,
      activeObjectUrlCount: cacheStats.activeObjectUrlCount,
      activeObjectUrlBytes: cacheStats.activeObjectUrlBytes,
      distantObjectUrlCount: cacheStats.distantObjectUrlCount,
      distantInlineCount,
      reclaimableCount,
      barPercent,
      level,
    };
  }, [cacheTick, currentPage, turns, portraits, lobbyBgDataUrl, slots]);

  const handleQuickOptimize = async () => {
    if (isOptimizing) return;
    setIsOptimizing(true);
    try {
      const res = await onQuickOptimizeMemory();
      setCacheTick((t) => t + 1);
      const prunedBlobs = res.prunedOrphanBlobs || 0;
      const compactedMem = res.compactedMemoryEntries || 0;
      if (
        res.revokedUrls > 0 ||
        res.offloadedImages > 0 ||
        prunedBlobs > 0 ||
        compactedMem > 0
      ) {
        const parts: string[] = [];
        if (res.revokedUrls > 0) {
          parts.push(`${res.revokedUrls} Object URL ảnh xa`);
        }
        if (res.offloadedImages > 0) {
          parts.push(`tách ${res.offloadedImages} ảnh sang kho IndexedDB`);
        }
        if (prunedBlobs > 0) {
          parts.push(`dọn ${prunedBlobs} ảnh rác không còn dùng`);
        }
        if (compactedMem > 0) {
          parts.push(`gộp gọn ${compactedMem} mục trí nhớ`);
        }
        const savedText =
          res.freedBytes > 0
            ? ` (~${formatMemoryBytes(res.freedBytes)})`
            : '';
        setOptimizeNote(`Đã tối ưu ${parts.join(' · ')}${savedText}.`);
      } else {
        setOptimizeNote(
          'Bộ nhớ & kho IndexedDB đã gọn — không có ảnh xa hay dữ liệu thừa cần dọn.',
        );
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const filteredSlots = useMemo(() => {
    const indexed = slots.map((slot, originalIdx) => ({ slot, originalIdx }));
    if (!slotSearch.trim()) return indexed;
    return indexed.filter(({ slot }) => {
      const slotCult = slot.memory?.cultivation?.enabled
        ? normalizeCultivationProfile(slot.memory.cultivation)
        : undefined;
      const slotCultInfo = slotCult ? getCultivationDisplayInfo(slotCult) : null;
      const metaMatch = matchesQuery(
        `${slot.name || ''} ${slot.player?.name || ''} ${slot.world?.name || ''} ${slotCultInfo?.fullLabel || ''} ${slotCultInfo?.majorRealm || ''} ${slotCultInfo?.subStage || ''}`,
        slotSearch,
      );
      if (metaMatch) return true;
      return (slot.turns || []).some(
        (t) =>
          matchesQuery(t.user || '', slotSearch) ||
          matchesQuery(t.assistant || '', slotSearch),
      );
    });
  }, [slots, slotSearch]);

  const handleImportPaste = () => {
    onImportJsonText(pasteValue.trim());
  };

  const levelTone =
    memorySummary.level === 'high'
      ? {
          bar: 'bg-rose-400',
          badge: 'bg-rose-500/18 text-rose-200 ring-rose-400/30',
          label: 'Cao',
        }
      : memorySummary.level === 'medium'
        ? {
            bar: 'bg-amber-400',
            badge: 'bg-amber-500/18 text-amber-200 ring-amber-400/30',
            label: 'Trung bình',
          }
        : {
            bar: 'bg-emerald-400',
            badge: 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/28',
            label: 'Ổn định',
          };

  const isTieredStorage = Boolean(
    autoSaveStatus?.tiered || storageHealth?.tieredActive,
  );
  const backendLabel =
    autoSaveStatus?.backend === 'idb+ls'
      ? isTieredStorage
        ? 'IndexedDB phân tầng + Hot Cache'
        : 'IndexedDB + localStorage'
      : autoSaveStatus?.backend === 'idb'
        ? isTieredStorage
          ? 'IndexedDB phân tầng'
          : 'IndexedDB (bền)'
        : autoSaveStatus?.backend === 'ls'
          ? 'localStorage (dự phòng)'
          : 'Chưa ghi nhận';

  const storageUsageText =
    typeof storageHealth?.usageBytes === 'number' &&
    typeof storageHealth?.quotaBytes === 'number' &&
    storageHealth.quotaBytes > 0
      ? `${formatMemoryBytes(storageHealth.usageBytes)} / ${
          storageHealth.quotaBytes >= 1024 * 1024 * 1024
            ? `${(storageHealth.quotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
            : formatMemoryBytes(storageHealth.quotaBytes)
        }`
      : null;

  const lastSavedText = autoSaveStatus?.lastSavedAt
    ? new Date(autoSaveStatus.lastSavedAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : 'Sẵn sàng tự lưu';

  const lastBackupText = lastBackupAt
    ? new Date(lastBackupAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : 'Chưa tải file .json';

  return (
    <section className="space-y-3.5">
      {/* Subtle Storage / Iframe Warning Banner */}
      {storageHealth?.hasRestrictionWarning && !dismissedStorageWarn && (
        <div className="rounded-2xl bg-amber-950/65 px-4 py-3 ring-1 ring-inset ring-amber-400/35 shadow-[0_10px_24px_-16px_rgba(245,158,11,0.35)]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-semibold text-amber-100">
                {storageHealth.warningTitle}
              </div>
              <p className="text-[11px] leading-relaxed text-amber-100/85">
                {storageHealth.warningMessage}
              </p>
              {onQuickBackup && (
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={isQuickBackingUp}
                    onClick={onQuickBackup}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-amber-400/20 px-3 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-300/40 transition-colors hover:bg-amber-400/30 active:scale-[0.98] disabled:opacity-60"
                  >
                    {isQuickBackingUp ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Tải backup .json về máy ngay</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Đóng cảnh báo lưu trữ"
              onClick={() => setDismissedStorageWarn(true)}
              className="shrink-0 rounded-lg p-1 text-amber-200/75 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Auto-Save Phiên Hiện Tại & 1-Tap Quick Backup Card */}
      <div className="rounded-2xl bg-[#162032]/88 px-4 py-3.5 ring-1 ring-white/[0.08] shadow-[0_10px_28px_-16px_rgba(2,8,23,0.65)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-xs font-bold text-slate-50">
                Auto-Save Phiên Hiện Tại
              </span>
              <span className="inline-flex items-center rounded-md bg-emerald-500/16 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28">
                {backendLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span className="tabular-nums">
                Lưu gần nhất:{' '}
                <strong className="font-semibold text-slate-200">
                  {lastSavedText}
                </strong>
              </span>
              <span className="tabular-nums">
                File backup:{' '}
                <strong className="font-semibold text-slate-200">
                  {lastBackupText}
                </strong>
                {turnsSinceLastBackup > 0 && (
                  <span
                    className={`ml-1 font-semibold ${
                      turnsSinceLastBackup >= 5
                        ? 'text-amber-300'
                        : 'text-slate-300'
                    }`}
                  >
                    (+{turnsSinceLastBackup} lượt mới)
                  </span>
                )}
              </span>
              {storageUsageText && (
                <span className="tabular-nums">
                  Kho trình duyệt:{' '}
                  <strong
                    className={`font-semibold ${
                      (storageHealth?.usagePercent || 0) >= 85
                        ? 'text-amber-300'
                        : 'text-slate-200'
                    }`}
                  >
                    {storageUsageText}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {onQuickBackup && (
            <button
              type="button"
              disabled={isQuickBackingUp}
              onClick={onQuickBackup}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-all active:scale-[0.985] disabled:opacity-60 whitespace-nowrap ${
                turnsSinceLastBackup >= 5
                  ? 'bg-gradient-to-b from-amber-500 to-orange-600 text-white shadow-[0_8px_18px_-6px_rgba(245,158,11,0.5)] hover:from-amber-400 hover:to-orange-500'
                  : 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-[0_8px_18px_-6px_rgba(16,185,129,0.45)] hover:from-emerald-400 hover:to-teal-500'
              }`}
            >
              {isQuickBackingUp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>Sao lưu nhanh 1 chạm (.json)</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact RAM / Temporary Memory Status Bar + Proactive Quick Optimize */}
      <div className="rounded-2xl bg-[#162032]/88 px-4 py-3 ring-1 ring-white/[0.08] shadow-[0_10px_28px_-16px_rgba(2,8,23,0.65)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Gauge className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span className="text-xs font-semibold text-slate-100">
                RAM / Bộ nhớ tạm ước lượng
              </span>
              <span className="text-xs font-bold tabular-nums text-white">
                ~{formatMemoryBytes(memorySummary.totalEstimatedBytes)}
                <span className="font-medium text-slate-400">
                  {' '}
                  / {ESTIMATED_RAM_BUDGET_MB} MB
                </span>
              </span>
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${levelTone.badge}`}
              >
                {levelTone.label}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span className="tabular-nums">
                Object URL ảnh đang giữ:{' '}
                <strong className="font-semibold text-slate-200">
                  {memorySummary.activeObjectUrlCount}
                </strong>
                {memorySummary.activeObjectUrlBytes > 0
                  ? ` (${formatMemoryBytes(memorySummary.activeObjectUrlBytes)})`
                  : ''}
              </span>
              <span className="tabular-nums">
                Ảnh xa có thể giải phóng:{' '}
                <strong
                  className={`font-semibold ${
                    memorySummary.reclaimableCount > 0
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }`}
                >
                  {memorySummary.reclaimableCount}
                </strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isOptimizing}
            onClick={() => void handleQuickOptimize()}
            title={`Chủ động thu hồi Object URL của ảnh cách trang hiện tại > ${QUICK_OPTIMIZE_PAGE_RADIUS} lượt và nén ảnh xa vào bộ nhớ đệm`}
            className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all active:scale-[0.985] disabled:opacity-60 whitespace-nowrap ${
              memorySummary.reclaimableCount > 0
                ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-500/30'
                : 'bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.10] hover:text-white'
            }`}
          >
            {isOptimizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
            ) : (
              <Zap
                className={`h-3.5 w-3.5 ${
                  memorySummary.reclaimableCount > 0
                    ? 'text-amber-300'
                    : 'text-sky-300'
                }`}
              />
            )}
            <span>Tối ưu nhanh</span>
            {memorySummary.reclaimableCount > 0 && !isOptimizing && (
              <span className="rounded-md bg-sky-400/25 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-sky-100">
                {memorySummary.reclaimableCount}
              </span>
            )}
          </button>
        </div>

        {/* Slim RAM usage indicator bar */}
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90"
          role="progressbar"
          aria-label="Ước lượng mức sử dụng bộ nhớ tạm"
          aria-valuenow={memorySummary.barPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${levelTone.bar} ${resolveBarWidthClass(memorySummary.barPercent)}`}
          />
        </div>

        {optimizeNote && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-emerald-950/55 px-2.5 py-1.5 text-[11px] text-emerald-100 ring-1 ring-inset ring-emerald-400/25">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>{optimizeNote}</span>
            </span>
            <button
              type="button"
              onClick={() => setOptimizeNote(null)}
              aria-label="Đóng thông báo tối ưu"
              className="rounded p-0.5 text-emerald-200/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5">
          <h2 className="text-base font-bold tracking-tight text-slate-50">
            Quản lý Dữ liệu &amp; Tải Save
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Nhập save (.json), tải file save về máy, quản lý đa slot và hoàn tác
            checkpoint.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTriggerImport}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Nhập Save (.json)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>Dán JSON</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSaveSlot();
              triggerConfirm('save_new_slot');
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] whitespace-nowrap"
          >
            {isConfirmed('save_new_slot') ? (
              <Check className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>
              {isConfirmed('save_new_slot') ? '✓ Đã lưu' : 'Lưu Slot Mới'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDownloadSave()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải Save (.json)</span>
          </button>
          <button
            type="button"
            onClick={onDownloadFullBackup}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Xuất Full Backup</span>
          </button>
          <button
            type="button"
            disabled={!hasCheckpoint}
            onClick={onUndoCheckpoint}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-amber-500/14 px-3 text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-all hover:bg-amber-500/22 active:scale-[0.98] disabled:opacity-40 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Hoàn tác</span>
          </button>
          <button
            type="button"
            onClick={onRequestResetClean}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22 active:scale-[0.98] whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Reset sạch dữ liệu</span>
          </button>
        </div>

        {showPaste && (
          <div className="mt-3.5 space-y-2.5 border-t border-white/[0.07] pt-3.5">
            <label className="block text-xs font-medium text-slate-300">
              Dán JSON save / backup
            </label>
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              rows={5}
              placeholder='{"turns": [...]}'
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <button
              type="button"
              onClick={handleImportPaste}
              className="min-h-[38px] rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500"
            >
              Nạp JSON
            </button>
          </div>
        )}
      </div>

      {/* Slots List */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-50">
            Danh sách Slot &amp; Tải Save
          </h3>
          {slots.length > 0 && (
            <span className="text-xs text-slate-400 tabular-nums">
              {slotSearch.trim()
                ? `${filteredSlots.length} / ${slots.length} slot`
                : `${slots.length} slot`}
            </span>
          )}
        </div>

        {slots.length > 0 && (
          <div className="relative mb-3.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={slotSearch}
              onChange={(e) => setSlotSearch(e.target.value)}
              aria-label="Tìm kiếm slot save"
              placeholder="Tìm slot theo tên, nhân vật, thế giới hoặc nội dung truyện..."
              className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            {slotSearch && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm slot"
                onClick={() => setSlotSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {!slots.length ? (
          <p className="text-xs text-slate-400">
            Chưa có slot nào. Bấm &quot;Lưu Slot Mới&quot; hoặc nhập file Save
            (.json).
          </p>
        ) : !filteredSlots.length ? (
          <p className="text-xs text-slate-400">
            Không tìm thấy slot nào khớp với &quot;{slotSearch.trim()}&quot;.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredSlots.map(({ slot: s, originalIdx }) => {
              const slotCult = s.memory?.cultivation?.enabled
                ? normalizeCultivationProfile(s.memory.cultivation)
                : undefined;
              const slotCultInfo = slotCult
                ? getCultivationDisplayInfo(slotCult)
                : null;
              return (
              <div
                key={s.id || originalIdx}
                className="rounded-xl bg-[#111b2c]/85 p-3.5 ring-1 ring-inset ring-white/[0.07]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-50">
                    {s.name || `Slot ${originalIdx + 1}`}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {s.turns?.length || 0} lượt
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Cập nhật:{' '}
                  {s.savedAt ? new Date(s.savedAt).toLocaleString('vi-VN') : ''}
                  {s.world?.name ? ` · ${s.world.name}` : ''}
                  {slotCultInfo && slotCult ? (
                    <span
                      className={`font-medium ${getRealmVisualTheme(slotCult, { reduceEffects: true }).compactTextClass}`}
                    >
                      {' · '}
                      {slotCultInfo.fullLabel}
                    </span>
                  ) : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onLoadSlot(originalIdx)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24 whitespace-nowrap"
                  >
                    <Play className="h-3 w-3" />
                    <span>Tải vào chơi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadSave(originalIdx)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-colors hover:bg-emerald-500/22 whitespace-nowrap"
                  >
                    <Download className="h-3 w-3" />
                    <span>Tải Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCloneSlot(originalIdx)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] whitespace-nowrap"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Nhân bản</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSlot(originalIdx)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-colors hover:bg-rose-500/22 whitespace-nowrap"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
