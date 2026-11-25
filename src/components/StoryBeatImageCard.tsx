import { memo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Download,
  Loader2,
  Maximize2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  STORY_IMAGE_POSITION_META,
  type StoryImageItem,
  type StoryImagePosition,
} from '../types/ark';
import { deriveReferenceComparisonPromptPatch } from '../utils/api';
import { useResolvedMediaUrl } from '../hooks/useResolvedMediaUrl';
import { buildTurnMediaKey } from '../utils/mediaMemoryManager';

interface StoryBeatImageCardProps {
  item: StoryImageItem;
  turnId: string;
  pageIndex: number;
  storyImageEnabled: boolean;
  isAnyGenerating: boolean;
  isVerifyingReference?: boolean;
  onVerifyReference?: (position: StoryImagePosition) => void;
  onToggleApplyComparison?: (
    position: StoryImagePosition,
    enabled: boolean,
  ) => void;
  onRegenerate: (position: StoryImagePosition) => void;
  onClear: (position: StoryImagePosition) => void;
  onCancel: () => void;
  onDownload: (src: string, filename: string) => void;
  onOpenLightbox: (src: string, label: string) => void;
}

const BEAT_ACCENT: Record<
  StoryImagePosition,
  {
    badge: string;
    title: string;
    ring: string;
    loadingBg: string;
    loadingRing: string;
  }
> = {
  opening: {
    badge: 'bg-sky-500/15 text-sky-200 ring-sky-400/30',
    title: 'text-sky-300',
    ring: 'ring-sky-400/[0.16]',
    loadingBg: 'bg-sky-500/10',
    loadingRing: 'ring-sky-400/25',
  },
  middle: {
    badge: 'bg-violet-500/15 text-violet-200 ring-violet-400/30',
    title: 'text-violet-300',
    ring: 'ring-violet-400/[0.16]',
    loadingBg: 'bg-violet-500/10',
    loadingRing: 'ring-violet-400/25',
  },
  ending: {
    badge: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
    title: 'text-amber-300',
    ring: 'ring-amber-400/[0.16]',
    loadingBg: 'bg-amber-500/10',
    loadingRing: 'ring-amber-400/25',
  },
};

export const StoryBeatImageCard = memo(function StoryBeatImageCard({
  item,
  turnId,
  pageIndex,
  storyImageEnabled,
  isAnyGenerating,
  isVerifyingReference = false,
  onVerifyReference,
  onToggleApplyComparison,
  onRegenerate,
  onClear,
  onCancel,
  onDownload,
  onOpenLightbox,
}: StoryBeatImageCardProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const meta = STORY_IMAGE_POSITION_META[item.position];
  const accent = BEAT_ACCENT[item.position];
  const mediaKey = buildTurnMediaKey(
    'story',
    { id: turnId },
    pageIndex,
    item.position,
  );

  const { resolvedUrl, isLoading } = useResolvedMediaUrl(item.imageData, {
    keyHint: mediaKey,
    pageIndex,
    kind: 'story',
    enabled: Boolean(item.imageData),
  });

  const displayLabel = item.subject || meta.label;
  const isThisGenerating = item.status === 'generating';
  const isThisPending = item.status === 'pending';
  const isThisError = item.status === 'error';

  // Pending in sequential queue (no existing image yet)
  if (!item.imageData && isThisPending) {
    return (
      <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.035] px-3.5 py-2.5 ring-1 ring-inset ring-white/[0.08]">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-300">
          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span
            className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${accent.badge}`}
          >
            {meta.shortLabel}
          </span>
          <span className="truncate text-slate-400">
            Đang chờ lượt vẽ tuần tự ({meta.badgeLabel.toLowerCase()})...
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[28px] rounded-lg bg-rose-500/14 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 hover:bg-rose-500/24"
        >
          Hủy
        </button>
      </div>
    );
  }

  // Actively generating (no existing image yet)
  if (!item.imageData && isThisGenerating) {
    return (
      <div
        className={`my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-3 ring-1 ring-inset ${accent.loadingBg} ${accent.loadingRing}`}
      >
        <div className="flex min-w-0 items-center gap-2.5 text-xs text-slate-100">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
          <span
            className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${accent.badge}`}
          >
            {meta.shortLabel}
          </span>
          <span className="truncate">Đang sinh ảnh ({displayLabel})...</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[28px] rounded-lg bg-rose-500/16 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/25"
        >
          Hủy
        </button>
      </div>
    );
  }

  // Error state with no fallback image
  if (!item.imageData && isThisError) {
    return (
      <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-500/10 px-3.5 py-3 ring-1 ring-inset ring-rose-400/25">
        <div className="flex min-w-0 items-start gap-2 text-xs text-rose-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5 font-semibold">
              <span>{meta.label}</span>
              <span className="text-[11px] font-normal text-rose-200/80">
                · Tạo ảnh thất bại
              </span>
            </div>
            {item.error && (
              <p className="text-[11px] leading-snug text-rose-200/80">
                {item.error}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {storyImageEnabled && (
            <button
              type="button"
              disabled={isAnyGenerating}
              onClick={() => onRegenerate(item.position)}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24 disabled:opacity-45"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Thử lại</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onClear(item.position)}
            className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-white/[0.06] px-2 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12]"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (!item.imageData) {
    return null;
  }

  return (
    <figure
      className={`my-3.5 overflow-hidden rounded-2xl bg-[#101829] ring-1 ${accent.ring}`}
    >
      <div className="relative flex justify-center bg-[#0b111e]">
        {resolvedUrl ? (
          <button
            type="button"
            onClick={() => onOpenLightbox(resolvedUrl, displayLabel)}
            className="group relative block w-full focus:outline-none"
            aria-label={`Phóng to ${displayLabel}`}
          >
            <img
              src={resolvedUrl}
              alt={displayLabel}
              decoding="async"
              referrerPolicy="no-referrer"
              className="mx-auto max-h-[420px] w-full object-contain"
            />
            <span
              className={`pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center rounded-lg px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${accent.badge} bg-[#101828]/85`}
            >
              {meta.shortLabel} · {meta.badgeLabel}
            </span>
            <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-[#101828]/82 px-2.5 py-1 text-[11px] font-medium text-slate-100 ring-1 ring-inset ring-white/[0.12] opacity-90 transition-opacity group-hover:opacity-100">
              <Maximize2 className="h-3 w-3" />
              <span>Phóng to</span>
            </span>
          </button>
        ) : (
          <div className="flex h-52 w-full items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            <span>
              {isLoading
                ? `Đang tải lại ${meta.shortLabel.toLowerCase()}...`
                : 'Đang khôi phục ảnh...'}
            </span>
          </div>
        )}

        {(isThisGenerating || isThisPending) && (
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#0c1322]/90 px-2.5 py-1 text-[11px] font-medium text-sky-200 ring-1 ring-inset ring-sky-400/30">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>
              {isThisGenerating ? 'Đang vẽ lại khung này...' : 'Đang chờ vẽ lại...'}
            </span>
          </div>
        )}
      </div>

      <figcaption className="space-y-2 border-t border-white/[0.07] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-xs font-medium ${accent.title}`}>
            {displayLabel}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.prompt && (
              <button
                type="button"
                onClick={() => setShowPrompt((v) => !v)}
                className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
              >
                {showPrompt ? 'Ẩn prompt' : 'Xem prompt'}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onDownload(
                  item.imageData || '',
                  `minh_hoa_trang_${pageIndex + 1}_${meta.fileSlug}.png`,
                )
              }
              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
            >
              <Download className="h-3 w-3" />
              <span>Tải</span>
            </button>
            {onVerifyReference && (
              <button
                type="button"
                disabled={isVerifyingReference || isThisGenerating}
                onClick={() => onVerifyReference(item.position)}
                title="Gửi ảnh khung truyện này cùng Ảnh mẫu người thật của nhân vật qua Vision API để đối chiếu độ sát mặt, tuổi tác & kết cấu da"
                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/14 px-2.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/24 disabled:opacity-45"
              >
                {isVerifyingReference ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3 w-3" />
                )}
                <span>{isVerifyingReference ? 'Đang so khớp...' : 'So khớp mẫu'}</span>
              </button>
            )}
            {storyImageEnabled && (
              <button
                type="button"
                disabled={isAnyGenerating}
                onClick={() => onRegenerate(item.position)}
                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/14 px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/28 hover:bg-sky-500/22 disabled:opacity-45"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Vẽ lại</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onClear(item.position)}
              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-rose-500/14 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 hover:bg-rose-500/22"
            >
              <Trash2 className="h-3 w-3" />
              <span>Xóa</span>
            </button>
          </div>
        </div>

        {item.referenceComparison && (
          <div
            className={`rounded-xl px-2.5 py-2 text-[11px] leading-relaxed ring-1 ring-inset ${
              item.referenceComparison.status === 'error'
                ? 'bg-rose-500/10 text-rose-100 ring-rose-400/25'
                : item.referenceComparison.verdict === 'match'
                  ? 'bg-emerald-500/[0.08] text-emerald-100 ring-emerald-400/25'
                  : item.referenceComparison.verdict === 'partial'
                    ? 'bg-amber-500/[0.08] text-amber-100 ring-amber-400/25'
                    : 'bg-rose-500/10 text-rose-100 ring-rose-400/25'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="inline-flex items-center gap-1 font-semibold">
                {item.referenceComparison.status === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                )}
                <span>
                  {item.referenceComparison.status === 'error'
                    ? 'Đối chiếu mẫu thất bại'
                    : `${item.referenceComparison.targetCharacterName ? `${item.referenceComparison.targetCharacterName}: ` : ''}${
                        item.referenceComparison.verdict === 'match'
                          ? 'Khớp tốt'
                          : item.referenceComparison.verdict === 'partial'
                            ? 'Khớp một phần'
                            : 'Lệch nét'
                      } (${item.referenceComparison.overallScore}/100)`}
                </span>
              </span>
              <span className="font-mono text-[10px] text-slate-300/85">
                {item.referenceComparison.modelUsed} ·{' '}
                {(item.referenceComparison.elapsedMs / 1000).toFixed(1)}s
              </span>
            </div>
            {item.referenceComparison.status === 'error' ? (
              <p className="mt-1 text-[10.5px] text-rose-200/90 break-words">
                {item.referenceComparison.errorMessage}
              </p>
            ) : (
              <>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] tabular-nums">
                  {typeof item.referenceComparison.faceMatchScore === 'number' && (
                    <span className="rounded bg-[#0b1322]/75 px-1.5 py-0.5 text-slate-200 ring-1 ring-white/[0.08]">
                      Mặt: <strong>{item.referenceComparison.faceMatchScore}</strong>
                    </span>
                  )}
                  {typeof item.referenceComparison.ageAccuracyScore === 'number' && (
                    <span className="rounded bg-[#0b1322]/75 px-1.5 py-0.5 text-slate-200 ring-1 ring-white/[0.08]">
                      Tuổi: <strong>{item.referenceComparison.ageAccuracyScore}</strong>
                    </span>
                  )}
                  {typeof item.referenceComparison.skinRealismScore === 'number' && (
                    <span className="rounded bg-[#0b1322]/75 px-1.5 py-0.5 text-slate-200 ring-1 ring-white/[0.08]">
                      Da thật: <strong>{item.referenceComparison.skinRealismScore}</strong>
                    </span>
                  )}
                  {typeof item.referenceComparison.hairBeardScore === 'number' && (
                    <span className="rounded bg-[#0b1322]/75 px-1.5 py-0.5 text-slate-200 ring-1 ring-white/[0.08]">
                      Tóc/Râu: <strong>{item.referenceComparison.hairBeardScore}</strong>
                    </span>
                  )}
                </div>
                {item.referenceComparison.summary && (
                  <p className="mt-1 text-[10.5px] text-slate-200/95">
                    {item.referenceComparison.summary}
                  </p>
                )}
                {item.referenceComparison.mismatches &&
                  item.referenceComparison.mismatches.length > 0 && (
                    <div className="mt-1 text-[10px] text-amber-200/95">
                      <span className="font-semibold">Điểm lệch: </span>
                      {item.referenceComparison.mismatches.join(' · ')}
                    </div>
                  )}
                {(() => {
                  const cmpObj = item.referenceComparison;
                  if (!cmpObj || cmpObj.status !== 'verified') return null;
                  const applyEnabled = cmpObj.applyToPrompt !== false;
                  const patchInfo = deriveReferenceComparisonPromptPatch(cmpObj);
                  return (
                    <div className="mt-2 space-y-1.5 rounded-lg bg-[#0b1322]/80 p-2 ring-1 ring-inset ring-white/[0.08]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10.5px] font-semibold text-slate-100 select-none">
                          <input
                            type="checkbox"
                            checked={applyEnabled}
                            onChange={(e) =>
                              onToggleApplyComparison?.(
                                item.position,
                                e.target.checked,
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-white/25 bg-[#0f1a2d] text-sky-400 focus:ring-sky-400/40"
                          />
                          <span>Áp dụng kết quả đối chiếu vào prompt</span>
                        </label>
                        {patchInfo.active && !isAnyGenerating && (
                          <button
                            type="button"
                            onClick={() => onRegenerate(item.position)}
                            className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-sky-500/20 px-2 text-[10px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/30"
                          >
                            <RefreshCw className="h-2.5 w-2.5" />
                            <span>Vẽ lại theo chỉnh sửa</span>
                          </button>
                        )}
                      </div>
                      {patchInfo.statusLabel && (
                        <p className="text-[10px] text-slate-300/90">
                          {patchInfo.statusLabel}
                        </p>
                      )}
                      {patchInfo.active && patchInfo.patchText && (
                        <div className="rounded-md bg-sky-500/[0.08] px-2 py-1 font-mono text-[10px] leading-snug text-sky-100/95 ring-1 ring-inset ring-sky-400/25 break-words">
                          <span className="font-sans font-semibold text-sky-300">
                            Sẽ ghép vào prompt:{' '}
                          </span>
                          {patchInfo.patchText}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {item.appliedComparisonPatch && (
          <div className="rounded-xl bg-emerald-500/[0.08] px-2.5 py-1.5 text-[10.5px] leading-snug text-emerald-100 ring-1 ring-inset ring-emerald-400/25">
            <span className="font-semibold text-emerald-300">
              Đã nạp chỉnh sửa đối chiếu vào prompt:{' '}
            </span>
            <span className="font-mono text-[10px] text-emerald-100/90 break-words">
              {item.appliedComparisonPatch}
            </span>
          </div>
        )}

        {isThisError && item.error && (
          <p className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200 ring-1 ring-inset ring-rose-400/25">
            Vẽ lại thất bại: {item.error}
          </p>
        )}

        {showPrompt && item.prompt && (
          <p className="rounded-xl bg-[#0c1322] p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-400 ring-1 ring-inset ring-white/[0.06]">
            {item.prompt}
          </p>
        )}
      </figcaption>
    </figure>
  );
});
