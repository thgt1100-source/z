import React from 'react';
import { Sparkles } from 'lucide-react';

export type MasteryBarStatus =
  | 'normal'
  | 'active'
  | 'bottleneck'
  | 'maxed'
  | 'tieu_thanh'
  | 'dai_thanh'
  | 'vien_man';

export interface MasteryBarVisualClasses {
  fillClass: string;
  percentTextClass: string;
  statusTextClass: string;
  trackGlowClass: string;
  isShimmer: boolean;
}

/**
 * Resolves the visual status for a skill/technique/move mastery bar based on
 * its mastery percentage and stage label:
 * - >= 99% or maxed / Viên mãn / Đỉnh phong / Tạo cực -> 'vien_man' (sparkling)
 * - >= 80% or Đại thành -> 'dai_thanh' (purple)
 * - >= 50% or Tiểu thành -> 'tieu_thanh' (gold)
 * - Otherwise falls back to bottleneck / active / normal.
 */
export function resolveSkillMasteryBarStatus(
  mastery: number,
  options?: {
    isMaxed?: boolean;
    isLocked?: boolean;
    isActive?: boolean;
    stageShortLabel?: string;
  },
): MasteryBarStatus {
  const pct = Math.max(
    0,
    Math.min(100, Math.round(Number.isFinite(mastery) ? mastery : 0)),
  );
  const stage = (options?.stageShortLabel || '').trim();

  if (
    options?.isMaxed ||
    pct >= 99 ||
    /viên\s*mãn|đỉnh\s*phong|tạo\s*cực/i.test(stage)
  ) {
    return 'vien_man';
  }
  if (pct >= 80 || /đại\s*thành/i.test(stage)) {
    return 'dai_thanh';
  }
  if (pct >= 50 || /tiểu\s*thành/i.test(stage)) {
    return 'tieu_thanh';
  }
  if (options?.isLocked) {
    return 'bottleneck';
  }
  if (options?.isActive) {
    return 'active';
  }
  return 'normal';
}

export function getSkillMasteryBarClasses(
  status: MasteryBarStatus,
): MasteryBarVisualClasses {
  switch (status) {
    case 'vien_man':
      return {
        fillClass:
          'bg-gradient-to-r from-amber-300 via-fuchsia-400 to-sky-300 item-card-shimmer item-shimmer-immortal',
        percentTextClass: 'item-text-immortal',
        statusTextClass: 'item-text-immortal',
        trackGlowClass: 'ring-1 ring-inset ring-amber-200/35 shadow-[0_0_10px_rgba(254,240,138,0.22)]',
        isShimmer: true,
      };
    case 'dai_thanh':
      return {
        fillClass: 'bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-400',
        percentTextClass: 'text-purple-300',
        statusTextClass: 'text-purple-300',
        trackGlowClass: '',
        isShimmer: false,
      };
    case 'tieu_thanh':
      return {
        fillClass: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-200',
        percentTextClass: 'text-amber-300',
        statusTextClass: 'text-amber-300',
        trackGlowClass: '',
        isShimmer: false,
      };
    case 'bottleneck':
      return {
        fillClass: 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-300',
        percentTextClass: 'text-amber-300',
        statusTextClass: 'text-amber-300',
        trackGlowClass: '',
        isShimmer: false,
      };
    case 'maxed':
      return {
        fillClass: 'bg-gradient-to-r from-emerald-500 to-teal-300',
        percentTextClass: 'text-emerald-300',
        statusTextClass: 'text-emerald-300',
        trackGlowClass: '',
        isShimmer: false,
      };
    case 'active':
      return {
        fillClass: 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400',
        percentTextClass: 'text-emerald-300',
        statusTextClass: 'text-cyan-300',
        trackGlowClass: '',
        isShimmer: false,
      };
    case 'normal':
    default:
      return {
        fillClass: 'bg-gradient-to-r from-sky-500 to-indigo-400',
        percentTextClass: 'text-sky-200',
        statusTextClass: 'text-slate-400',
        trackGlowClass: '',
        isShimmer: false,
      };
  }
}

interface CompactMasteryBarProps {
  label: string;
  sublabel?: string;
  percent: number;
  status?: MasteryBarStatus;
  statusLabel?: string;
  size?: 'sm' | 'md';
  showMilestones?: boolean;
  footerNote?: string;
  action?: React.ReactNode;
  className?: string;
  /** Optional visual override (e.g., synced to Realm quality tier palette). */
  customVisual?: Partial<MasteryBarVisualClasses>;
}

export const CompactMasteryBar: React.FC<CompactMasteryBarProps> = ({
  label,
  sublabel,
  percent,
  status = 'normal',
  statusLabel,
  size = 'md',
  showMilestones = false,
  footerNote,
  action,
  className = '',
  customVisual,
}) => {
  const clamped = Math.max(
    0,
    Math.min(100, Math.round(Number.isFinite(percent) ? percent : 0)),
  );

  const baseVisual = getSkillMasteryBarClasses(status);
  const visual: MasteryBarVisualClasses = customVisual
    ? { ...baseVisual, ...customVisual }
    : baseVisual;

  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2';
  const titleSize = size === 'sm' ? 'text-[11px]' : 'text-xs';
  const pctSize = size === 'sm' ? 'text-[11px]' : 'text-xs';

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className={`truncate font-medium text-slate-200 ${titleSize}`}>
            {label}
          </span>
          {sublabel && (
            <span className="text-[10px] text-slate-400 tabular-nums">
              · {sublabel}
            </span>
          )}
          {statusLabel && (
            <span className={`text-[10px] font-semibold ${visual.statusTextClass}`}>
              · {statusLabel}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {visual.isShimmer && (
            <Sparkles
              aria-hidden="true"
              className="h-3 w-3 text-amber-200 item-twinkle-star"
            />
          )}
          <span
            className={`font-semibold tabular-nums ${pctSize} ${visual.percentTextClass}`}
          >
            {clamped}%
          </span>
          {action}
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${clamped}%`}
        className={`relative w-full overflow-hidden rounded-full bg-white/[0.08] ${trackHeight} ${visual.trackGlowClass}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${visual.fillClass}`}
          style={{ width: `${clamped}%` }}
        />
        {showMilestones && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-1/4 w-px bg-[#0b1220]/60"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[#0b1220]/60"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-[80%] w-px bg-[#0b1220]/60"
            />
          </>
        )}
      </div>

      {footerNote && (
        <div className="text-[10px] leading-snug text-slate-400 tabular-nums">
          {footerNote}
        </div>
      )}
    </div>
  );
};
