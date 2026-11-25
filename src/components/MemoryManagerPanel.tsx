import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookMarked,
  Brain,
  Calendar,
  Check,
  Clock,
  FileStack,
  Loader2,
  MapPin,
  Minimize2,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Smile,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  CharacterStateSnapshot,
  MemoryEntry,
  MemoryEntryCategory,
  MemoryManagerConfig,
  StoryClockState,
  ViewName,
} from '../types/ark';
import {
  compactLongTermMemory,
  estimateMemoryFootprintBytes,
  extractMemoryKeywords,
  MAX_LONG_TERM_ENTRIES,
} from '../utils/longTermMemory';
import { matchesQuery } from '../utils/search';
import {
  addDaysToClock,
  addMinutesToClock,
  clockToEpochMinutes,
  daysInMonth,
  formatDeltaMinutesVi,
  formatStoryClock,
  normalizeStoryClock,
} from '../utils/storyClock';
import { applyClockDeltaToCultivation } from '../utils/cultivation';
import { isInvalidNpcState } from '../utils/characterUtils';
import { CharacterNameBadge } from './CharacterNameBadge';

export type MemorySubTab = 'lorebook' | 'states' | 'summary';

const CATEGORY_META: Record<
  MemoryEntryCategory,
  { label: string; badgeClass: string }
> = {
  event: {
    label: 'Sự kiện',
    badgeClass: 'border-sky-400/35 bg-sky-500/15 text-sky-200',
  },
  relationship: {
    label: 'Quan hệ',
    badgeClass: 'border-rose-400/35 bg-rose-500/15 text-rose-200',
  },
  promise: {
    label: 'Lời hứa / Bí mật',
    badgeClass: 'border-violet-400/35 bg-violet-500/18 text-violet-200',
  },
  timeline: {
    label: 'Mốc thời gian',
    badgeClass: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
  },
  detail: {
    label: 'Chi tiết',
    badgeClass: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
  },
};

interface MemoryManagerPanelProps {
  memory: MemoryManagerConfig;
  turnCount: number;
  currentPage: number;
  historyTurns: number;
  hasProxyConfigured: boolean;
  isSyncingMemory: boolean;
  isSyncingStates: boolean;
  isSummarizing: boolean;
  initialTab?: MemorySubTab;
  compact?: boolean;
  onClose?: () => void;
  onNavigate?: (view: ViewName) => void;
  onJumpToPage?: (pageIndex: number) => void;
  onUpdateMemory: (
    updater: (prev: MemoryManagerConfig) => MemoryManagerConfig,
  ) => void;
  onExtractMemories: (turnIndex: number) => void;
  onExtractStates: (turnIndex: number) => void;
  onRunRollingSummary: (forceAllOlder?: boolean) => void;
  onSelectCharacter?: (characterName: string) => void;
}

export function MemoryManagerPanel({
  memory,
  turnCount,
  currentPage,
  historyTurns,
  hasProxyConfigured,
  isSyncingMemory,
  isSyncingStates,
  isSummarizing,
  initialTab = 'lorebook',
  compact = false,
  onClose,
  onNavigate,
  onJumpToPage,
  onUpdateMemory,
  onExtractMemories,
  onExtractStates,
  onRunRollingSummary,
  onSelectCharacter,
}: MemoryManagerPanelProps) {
  const [activeTab, setActiveTab] = useState<MemorySubTab>(initialTab);
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | MemoryEntryCategory
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [compactFeedback, setCompactFeedback] = useState<string | null>(null);

  const memoryFootprintKb = useMemo(() => {
    const bytes = estimateMemoryFootprintBytes(memory);
    return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
  }, [memory]);

  const handleCompactMemoryNow = () => {
    const res = compactLongTermMemory(memory);
    onUpdateMemory(() => res.memory);
    if (
      res.removedDuplicates > 0 ||
      res.compactedCount > 0 ||
      res.prunedStates > 0 ||
      res.savedBytes > 64
    ) {
      const parts: string[] = [];
      if (res.removedDuplicates > 0) {
        parts.push(`gộp ${res.removedDuplicates} mục trùng`);
      }
      if (res.compactedCount > 0) {
        parts.push(`nén ${res.compactedCount} mục cũ`);
      }
      if (res.prunedStates > 0) {
        parts.push(`gọn ${res.prunedStates} trạng thái`);
      }
      const savedTxt =
        res.savedBytes >= 1024
          ? ` (giảm ${(res.savedBytes / 1024).toFixed(1)} KB)`
          : res.savedBytes > 0
            ? ` (giảm ${res.savedBytes} B)`
            : '';
      setCompactFeedback(
        `Đã nén trí nhớ dài hạn${parts.length ? `: ${parts.join(', ')}` : ''}${savedTxt}.`,
      );
    } else {
      setCompactFeedback(
        'Trí nhớ dài hạn đã tối ưu và nằm gọn trong giới hạn dung lượng.',
      );
    }
  };

  // Memory entry add / edit state
  const [addingMemory, setAddingMemory] = useState(false);
  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemCategory, setNewMemCategory] =
    useState<MemoryEntryCategory>('event');
  const [newMemContent, setNewMemContent] = useState('');

  const [editingMemId, setEditingMemId] = useState<string | null>(null);
  const [editMemTitle, setEditMemTitle] = useState('');
  const [editMemCategory, setEditMemCategory] =
    useState<MemoryEntryCategory>('event');
  const [editMemContent, setEditMemContent] = useState('');

  // Character state add / edit state
  const [addingState, setAddingState] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [newStateIsMc, setNewStateIsMc] = useState(false);
  const [newStateLoc, setNewStateLoc] = useState('');
  const [newStateMood, setNewStateMood] = useState('');
  const [newStateStatus, setNewStateStatus] = useState('');

  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [editStateName, setEditStateName] = useState('');
  const [editStateIsMc, setEditStateIsMc] = useState(false);
  const [editStateLoc, setEditStateLoc] = useState('');
  const [editStateMood, setEditStateMood] = useState('');
  const [editStateStatus, setEditStateStatus] = useState('');

  // Rolling summary local draft
  const [summaryDraft, setSummaryDraft] = useState(
    memory.rollingSummary?.content || '',
  );

  // Story Clock inline quick-edit state
  const currentClock = useMemo(
    () => normalizeStoryClock(memory.storyClock),
    [memory.storyClock],
  );
  const formattedClock = useMemo(
    () => formatStoryClock(currentClock),
    [currentClock],
  );
  const [editingClock, setEditingClock] = useState(false);
  const [clockDraft, setClockDraft] = useState<StoryClockState>(currentClock);

  useEffect(() => {
    if (!editingClock) {
      setClockDraft(currentClock);
    }
  }, [currentClock, editingClock]);

  const draftClockFormatted = useMemo(
    () => formatStoryClock(clockDraft),
    [clockDraft],
  );

  const openClockEditor = () => {
    setClockDraft(currentClock);
    setEditingClock(true);
  };

  const applyClockDraftField = (
    field: 'day' | 'month' | 'year' | 'hour' | 'minute',
    rawVal: string,
  ) => {
    const parsed = parseInt(rawVal, 10);
    if (Number.isNaN(parsed)) return;
    setClockDraft((prev) => {
      const next = { ...prev, [field]: parsed };
      const safeYear = Math.min(9999, Math.max(1, next.year));
      const safeMonth = Math.min(12, Math.max(1, next.month));
      const maxD = daysInMonth(safeYear, safeMonth);
      return {
        ...next,
        year: safeYear,
        month: safeMonth,
        day: Math.min(maxD, Math.max(1, next.day)),
        hour: Math.min(23, Math.max(0, next.hour)),
        minute: Math.min(59, Math.max(0, next.minute)),
      };
    });
  };

  const handleSaveClockManual = () => {
    const clean = normalizeStoryClock({
      ...clockDraft,
      initialized: true,
      lastDeltaMinutes: undefined,
      lastAdvanceReason: 'Chỉnh tay',
      updatedAt: Date.now(),
    });
    const deltaMinutes =
      clockToEpochMinutes(clean) - clockToEpochMinutes(currentClock);

    onUpdateMemory((prev) => {
      const nextCultivation =
        deltaMinutes > 0 && prev.cultivation?.enabled
          ? applyClockDeltaToCultivation(prev.cultivation, deltaMinutes, {
              reason: 'Chỉnh mốc đồng hồ truyện',
            }).nextProfile
          : prev.cultivation;
      return {
        ...prev,
        storyClock:
          deltaMinutes > 0
            ? {
                ...clean,
                lastDeltaMinutes: deltaMinutes,
              }
            : clean,
        ...(nextCultivation ? { cultivation: nextCultivation } : {}),
      };
    });
    setEditingClock(false);
  };

  useEffect(() => {
    setSummaryDraft(memory.rollingSummary?.content || '');
  }, [memory.rollingSummary?.content]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const safeTurnIdx = Math.min(Math.max(0, currentPage), Math.max(0, turnCount - 1));
  const cutoffOlderTurns = Math.max(0, turnCount - Math.max(1, historyTurns));
  const summarizedUpTo = Math.min(
    memory.rollingSummary?.summarizedUpToTurn || 0,
    cutoffOlderTurns,
  );
  const pendingOlderTurns = Math.max(0, cutoffOlderTurns - summarizedUpTo);

  const filteredMemories = useMemo(() => {
    const q = searchQuery.trim();
    return [...(memory.entries || [])]
      .filter((e) => {
        if (categoryFilter !== 'all' && e.category !== categoryFilter) {
          return false;
        }
        if (q) {
          return (
            matchesQuery(e.title, q) ||
            matchesQuery(e.content, q) ||
            matchesQuery(CATEGORY_META[e.category]?.label || '', q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [memory.entries, categoryFilter, searchQuery]);

  const sortedStates = useMemo(() => {
    return (memory.characterStates || [])
      .filter((s) => !isInvalidNpcState(s))
      .sort((a, b) => {
        if (a.isMc !== b.isMc) return a.isMc ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [memory.characterStates]);

  const handleSaveNewMemory = () => {
    const title = newMemTitle.trim();
    const content = newMemContent.trim();
    if (!title && !content) return;
    const finalTitle = title || content.slice(0, 48);
    const finalContent = content || title;
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: finalTitle,
      content: finalContent,
      category: newMemCategory,
      turnIndex: turnCount > 0 ? safeTurnIdx : undefined,
      pinned: false,
      importance:
        newMemCategory === 'promise' || newMemCategory === 'relationship'
          ? 3
          : 2,
      keywords: extractMemoryKeywords(finalTitle, finalContent),
      source: 'manual',
      updatedAt: Date.now(),
    };
    onUpdateMemory((prev) =>
      compactLongTermMemory({
        ...prev,
        entries: [entry, ...prev.entries],
      }).memory,
    );
    setNewMemTitle('');
    setNewMemContent('');
    setNewMemCategory('event');
    setAddingMemory(false);
  };

  const handleSaveEditMemory = (id: string) => {
    const title = editMemTitle.trim();
    const content = editMemContent.trim();
    if (!title && !content) return;
    onUpdateMemory((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === id
          ? {
              ...e,
              title: title || content.slice(0, 48),
              content: content || title,
              category: editMemCategory,
              updatedAt: Date.now(),
            }
          : e,
      ),
    }));
    setEditingMemId(null);
  };

  const handleTogglePin = (id: string) => {
    onUpdateMemory((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === id ? { ...e, pinned: !e.pinned } : e,
      ),
    }));
  };

  const handleDeleteMemory = (id: string) => {
    onUpdateMemory((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== id),
    }));
  };

  const handleSaveNewState = () => {
    const name = newStateName.trim();
    if (!name) return;
    const item: CharacterStateSnapshot = {
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      isMc: newStateIsMc,
      location: newStateLoc.trim(),
      mood: newStateMood.trim(),
      status: newStateStatus.trim(),
      lastTurnIndex: turnCount > 0 ? safeTurnIdx : undefined,
      updatedAt: Date.now(),
    };
    onUpdateMemory((prev) => ({
      ...prev,
      characterStates: [item, ...prev.characterStates],
    }));
    setNewStateName('');
    setNewStateIsMc(false);
    setNewStateLoc('');
    setNewStateMood('');
    setNewStateStatus('');
    setAddingState(false);
  };

  const handleSaveEditState = (id: string) => {
    const name = editStateName.trim();
    if (!name) return;
    onUpdateMemory((prev) => ({
      ...prev,
      characterStates: prev.characterStates.map((s) =>
        s.id === id
          ? {
              ...s,
              name,
              isMc: editStateIsMc,
              location: editStateLoc.trim(),
              mood: editStateMood.trim(),
              status: editStateStatus.trim(),
              updatedAt: Date.now(),
            }
          : s,
      ),
    }));
    setEditingStateId(null);
  };

  const handleDeleteState = (id: string) => {
    onUpdateMemory((prev) => ({
      ...prev,
      characterStates: prev.characterStates.filter((s) => s.id !== id),
    }));
  };

  const summaryDirty = summaryDraft !== (memory.rollingSummary?.content || '');

  return (
    <div
      className={`space-y-3 rounded-2xl backdrop-blur-md ${
        compact
          ? 'bg-[#162135]/94 p-3.5 ring-1 ring-violet-400/22 shadow-[0_12px_32px_-16px_rgba(2,8,23,0.65)]'
          : 'bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/16 text-violet-300 ring-1 ring-inset ring-violet-400/28">
            <Brain className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-tight text-slate-50">
              AI Trí nhớ dài hạn &amp; Quản lý
            </h3>
            <p className="text-[11px] text-slate-400 tabular-nums">
              {memory.entries.length}/{MAX_LONG_TERM_ENTRIES} ký ức ·{' '}
              {memory.characterStates.length} trạng thái · {memoryFootprintKb} ·{' '}
              {memory.rollingSummary?.content?.trim()
                ? `Tóm tắt 1–${memory.rollingSummary.summarizedUpToTurn || cutoffOlderTurns}`
                : 'Chưa có tóm tắt dài'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onUpdateMemory((prev) => ({ ...prev, enabled: !prev.enabled }))
            }
            className={`min-h-[32px] rounded-xl px-2.5 text-xs font-semibold transition-all whitespace-nowrap ${
              memory.enabled
                ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
            }`}
          >
            Tiêm ngữ cảnh AI: {memory.enabled ? 'Bật' : 'Tắt'}
          </button>
          {onClose && (
            <button
              type="button"
              aria-label="Đóng bảng AI Quản lý & Ghi nhớ"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Story Timeline & Clock Tracker Strip */}
      <div className="space-y-2 rounded-xl bg-[#111b2c]/85 p-3 ring-1 ring-inset ring-white/[0.07]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
                <span className="font-bold text-amber-200 tabular-nums">
                  {formattedClock.timeStr}
                </span>
                <span className="text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className="font-semibold text-slate-100 tabular-nums">
                  {formattedClock.weekday}, {formattedClock.dateStr}
                </span>
                <span className="text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-300">{formattedClock.period}</span>
              </div>
              {formattedClock.eraLabel && (
                <div className="mt-0.5 text-[11px] font-medium text-amber-200/90">
                  {formattedClock.eraLabel}
                </div>
              )}
              <div className="mt-0.5 text-[11px] text-slate-400">
                {currentClock.lastDeltaMinutes &&
                currentClock.lastDeltaMinutes > 0 ? (
                  <span className="tabular-nums">
                    Lượt gần nhất:{' '}
                    {formatDeltaMinutesVi(currentClock.lastDeltaMinutes)}
                    {currentClock.lastAdvanceReason
                      ? ` · ${currentClock.lastAdvanceReason}`
                      : ''}
                  </span>
                ) : currentClock.lastAdvanceReason === 'Chỉnh tay' ? (
                  <span>Đã đặt mốc thời gian thủ công · Liên tục theo truyện</span>
                ) : currentClock.initialized ? (
                  <span>Đang giữ mạch thời gian liên tục của phiên truyện</span>
                ) : (
                  <span>
                    Mốc khởi điểm truyện · Sẽ tự bám theo lượt đầu hoặc chỉnh tay
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onUpdateMemory((prev) => {
                  const cur = normalizeStoryClock(prev.storyClock);
                  return {
                    ...prev,
                    storyClock: {
                      ...cur,
                      autoAdvance: !cur.autoAdvance,
                    },
                  };
                })
              }
              className={`min-h-[32px] rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 ${
                currentClock.autoAdvance
                  ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                  : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
              }`}
            >
              Tự tịnh tiến: {currentClock.autoAdvance ? 'Bật' : 'Tắt'}
            </button>
            <button
              type="button"
              onClick={() =>
                editingClock ? setEditingClock(false) : openClockEditor()
              }
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 ${
                editingClock
                  ? 'bg-amber-500/16 text-amber-100 ring-1 ring-inset ring-amber-400/32'
                  : 'bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
              }`}
            >
              <Calendar className="h-3 w-3" />
              <span>{editingClock ? 'Đóng' : 'Chỉnh giờ'}</span>
            </button>
          </div>
        </div>

        {editingClock && (
          <div className="space-y-2.5 border-t border-white/[0.07] pt-2.5">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <label className="space-y-1">
                <span className="block text-[10px] font-medium text-slate-400">
                  Ngày
                </span>
                <input
                  type="number"
                  min={1}
                  max={daysInMonth(clockDraft.year, clockDraft.month)}
                  value={clockDraft.day}
                  onChange={(e) => applyClockDraftField('day', e.target.value)}
                  className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-medium text-slate-400">
                  Tháng
                </span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={clockDraft.month}
                  onChange={(e) => applyClockDraftField('month', e.target.value)}
                  className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-medium text-slate-400">
                  Năm
                </span>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={clockDraft.year}
                  onChange={(e) => applyClockDraftField('year', e.target.value)}
                  className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-medium text-slate-400">
                  Giờ (0–23)
                </span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={clockDraft.hour}
                  onChange={(e) => applyClockDraftField('hour', e.target.value)}
                  className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-medium text-slate-400">
                  Phút (0–59)
                </span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={clockDraft.minute}
                  onChange={(e) =>
                    applyClockDraftField('minute', e.target.value)
                  }
                  className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="block text-[10px] font-medium text-slate-400">
                Niên đại / Lịch bối cảnh / Giờ canh (tùy chọn)
              </span>
              <input
                type="text"
                value={clockDraft.eraLabel || ''}
                onChange={(e) =>
                  setClockDraft((prev) => ({
                    ...prev,
                    eraLabel: e.target.value,
                  }))
                }
                placeholder="VD: Năm Khai Nguyên thứ 12 · Tiết Thanh Minh · Giờ Dậu"
                className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <span className="tabular-nums">
                Xem trước:{' '}
                <strong className="text-amber-200">
                  {draftClockFormatted.fullLabel}
                </strong>
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { label: '+5p', fn: (c: StoryClockState) => addMinutesToClock(c, 5) },
                    { label: '+15p', fn: (c: StoryClockState) => addMinutesToClock(c, 15) },
                    { label: '+30p', fn: (c: StoryClockState) => addMinutesToClock(c, 30) },
                    { label: '+1g', fn: (c: StoryClockState) => addMinutesToClock(c, 60) },
                    { label: '+1 ngày', fn: (c: StoryClockState) => addDaysToClock(c, 1) },
                  ] as const
                ).map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => setClockDraft((prev) => step.fn(prev))}
                    className="min-h-[30px] rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={() =>
                  setClockDraft((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                  }))
                }
                className={`min-h-[32px] rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                  clockDraft.enabled
                    ? 'bg-sky-500/16 text-sky-100 ring-1 ring-inset ring-sky-400/30'
                    : 'bg-white/[0.055] text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:text-slate-200'
                }`}
              >
                Tiêm đồng hồ vào AI: {clockDraft.enabled ? 'Bật' : 'Tắt'}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingClock(false)}
                  className="min-h-[32px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveClockManual}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-amber-500/16 px-3 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/32 hover:bg-amber-500/24 whitespace-nowrap"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu mốc</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Proxy warning */}
      {!hasProxyConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/[0.10] px-3 py-2 text-[11px] text-amber-200 ring-1 ring-inset ring-amber-400/28">
          <span>
            Chưa cấu hình Proxy URL để AI tự trích xuất ký ức/trạng thái/tóm
            tắt. Bạn vẫn có thể thêm hoặc sửa thủ công.
          </span>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('config')}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-amber-500/16 px-2.5 font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/32 hover:bg-amber-500/25"
            >
              <Settings className="h-3 w-3" />
              <span>Cấu hình</span>
            </button>
          )}
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#0e1625]/85 p-1 ring-1 ring-inset ring-white/[0.07]">
        {(
          [
            {
              id: 'lorebook',
              label: `Sổ tay (${memory.entries.length})`,
              icon: BookMarked,
            },
            {
              id: 'states',
              label: `Trạng thái (${memory.characterStates.length})`,
              icon: Activity,
            },
            {
              id: 'summary',
              label:
                pendingOlderTurns > 0
                  ? `Tóm tắt (+${pendingOlderTurns})`
                  : 'Tóm tắt dài',
              icon: FileStack,
            },
          ] as Array<{
            id: MemorySubTab;
            label: string;
            icon: typeof BookMarked;
          }>
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-all ${
                active
                  ? 'bg-violet-500/18 text-violet-100 ring-1 ring-inset ring-violet-400/35 shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: AUTO MEMORY / LOREBOOK */}
      {activeTab === 'lorebook' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                onUpdateMemory((prev) => ({
                  ...prev,
                  autoMemory: !prev.autoMemory,
                }))
              }
              className={`min-h-[32px] rounded-xl px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                memory.autoMemory
                  ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                  : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
              }`}
            >
              Tự động ghi sau lượt AI: {memory.autoMemory ? 'Bật' : 'Tắt'}
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={isSyncingMemory || turnCount === 0}
                onClick={() => onExtractMemories(safeTurnIdx)}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-violet-500/18 px-3 text-xs font-semibold text-violet-100 ring-1 ring-inset ring-violet-400/35 transition-all hover:bg-violet-500/26 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
              >
                {isSyncingMemory ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>
                  {isSyncingMemory
                    ? 'Đang trích xuất...'
                    : `Cập nhật ký ức (Trang ${safeTurnIdx + 1})`}
                </span>
              </button>
              <button
                type="button"
                onClick={handleCompactMemoryNow}
                title="Gộp ký ức trùng lặp và nén gọn trí nhớ dài hạn để tối ưu RAM & file Save"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
              >
                <Minimize2 className="h-3.5 w-3.5 text-sky-300" />
                <span>Nén gọn</span>
              </button>
              <button
                type="button"
                onClick={() => setAddingMemory((v) => !v)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm</span>
              </button>
            </div>
          </div>

          {compactFeedback && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-950/60 px-3 py-1.5 text-[11px] text-emerald-100 ring-1 ring-inset ring-emerald-400/25">
              <span>{compactFeedback}</span>
              <button
                type="button"
                onClick={() => setCompactFeedback(null)}
                aria-label="Đóng thông báo nén trí nhớ"
                className="rounded p-0.5 text-emerald-200/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Add Memory Form */}
          {addingMemory && (
            <div className="space-y-2 rounded-xl bg-[#111b2c]/90 p-3 ring-1 ring-inset ring-sky-400/28">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={newMemTitle}
                  onChange={(e) => setNewMemTitle(e.target.value)}
                  placeholder="Tiêu đề ngắn (VD: Lời hứa ở bến cảng)..."
                  className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20 sm:col-span-2"
                />
                <select
                  value={newMemCategory}
                  onChange={(e) =>
                    setNewMemCategory(e.target.value as MemoryEntryCategory)
                  }
                  className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                >
                  <option value="event">Sự kiện</option>
                  <option value="relationship">Quan hệ</option>
                  <option value="promise">Lời hứa / Bí mật</option>
                  <option value="timeline">Mốc thời gian</option>
                  <option value="detail">Chi tiết</option>
                </select>
              </div>
              <textarea
                value={newMemContent}
                onChange={(e) => setNewMemContent(e.target.value)}
                rows={2}
                placeholder="Nội dung chi tiết đáng nhớ..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setAddingMemory(false)}
                  className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewMemory}
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/16 px-3 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu mục</span>
                </button>
              </div>
            </div>
          )}

          {/* Filter & Search Row */}
          {memory.entries.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'Tất cả' },
                    { id: 'promise', label: 'Lời hứa / Bí mật' },
                    { id: 'relationship', label: 'Quan hệ' },
                    { id: 'event', label: 'Sự kiện' },
                    { id: 'timeline', label: 'Mốc thời gian' },
                    { id: 'detail', label: 'Chi tiết' },
                  ] as Array<{ id: 'all' | MemoryEntryCategory; label: string }>
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`min-h-[28px] rounded-lg px-2.5 text-[11px] font-semibold transition-all ${
                      categoryFilter === cat.id
                        ? 'bg-sky-500/18 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                        : 'bg-[#111b2c]/80 text-slate-400 ring-1 ring-inset ring-white/[0.06] hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {memory.entries.length >= 3 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lọc nhanh ký ức (hỗ trợ không dấu)..."
                    className="min-h-[34px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1 pl-8 pr-7 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Xóa lọc ký ức"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Memory Entries List */}
          {!filteredMemories.length ? (
            <div className="rounded-xl border border-dashed border-white/[0.10] bg-[#111b2c]/60 px-3 py-4 text-center text-xs text-slate-400">
              {memory.entries.length === 0
                ? 'Chưa có mục ký ức nào. Bấm "Cập nhật ký ức" để AI trích xuất từ trang truyện hoặc bấm "Thêm" để tự ghi.'
                : 'Không có mục ký ức nào khớp bộ lọc hiện tại.'}
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
              {filteredMemories.map((entry) => {
                const meta = CATEGORY_META[entry.category] || CATEGORY_META.event;
                const isEditing = editingMemId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`rounded-xl p-3 ring-1 ring-inset transition-colors ${
                      entry.pinned
                        ? 'bg-amber-500/[0.07] ring-amber-400/30'
                        : 'bg-[#111b2c]/85 ring-white/[0.07]'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                          <input
                            type="text"
                            value={editMemTitle}
                            onChange={(e) => setEditMemTitle(e.target.value)}
                            className="rounded-xl border border-sky-400/45 bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/20 sm:col-span-2"
                          />
                          <select
                            value={editMemCategory}
                            onChange={(e) =>
                              setEditMemCategory(
                                e.target.value as MemoryEntryCategory,
                              )
                            }
                            className="rounded-xl border border-sky-400/45 bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          >
                            <option value="event">Sự kiện</option>
                            <option value="relationship">Quan hệ</option>
                            <option value="promise">Lời hứa / Bí mật</option>
                            <option value="timeline">Mốc thời gian</option>
                            <option value="detail">Chi tiết</option>
                          </select>
                        </div>
                        <textarea
                          value={editMemContent}
                          onChange={(e) => setEditMemContent(e.target.value)}
                          rows={2}
                          className="w-full rounded-xl border border-sky-400/45 bg-[#0e1625]/85 px-2.5 py-1.5 text-xs leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMemId(null)}
                            className="min-h-[28px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditMemory(entry.id)}
                            className="min-h-[28px] rounded-lg bg-emerald-500/16 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24"
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                            {typeof entry.turnIndex === 'number' &&
                              (onJumpToPage ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onJumpToPage(entry.turnIndex as number)
                                  }
                                  className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-inset ring-white/[0.08] tabular-nums hover:bg-white/[0.12]"
                                >
                                  Trang {entry.turnIndex + 1}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 tabular-nums">
                                  Trang {entry.turnIndex + 1}
                                </span>
                              ))}
                            <span className="text-xs font-bold text-slate-100">
                              {entry.title}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              title={entry.pinned ? 'Bỏ ghim' : 'Ghim ưu tiên gửi AI'}
                              aria-label={entry.pinned ? 'Bỏ ghim' : 'Ghim'}
                              onClick={() => handleTogglePin(entry.id)}
                              className={`rounded-md p-1 transition-colors ${
                                entry.pinned
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-100'
                              }`}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Sửa mục ký ức"
                              aria-label="Sửa mục ký ức"
                              onClick={() => {
                                setEditingMemId(entry.id);
                                setEditMemTitle(entry.title);
                                setEditMemCategory(entry.category);
                                setEditMemContent(entry.content);
                              }}
                              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Xóa mục ký ức"
                              aria-label="Xóa mục ký ức"
                              onClick={() => handleDeleteMemory(entry.id)}
                              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                          {entry.content}
                        </p>
                        {((entry.entities && entry.entities.length > 0) ||
                          entry.importance === 3) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {entry.importance === 3 && (
                              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28">
                                Cốt lõi
                              </span>
                            )}
                            {(entry.entities || []).slice(0, 4).map((ent) => (
                              <span
                                key={ent}
                                className="rounded-md bg-white/[0.055] px-1.5 py-0.5 text-[10px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.07]"
                              >
                                {ent}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI STATE TRACKER */}
      {activeTab === 'states' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                onUpdateMemory((prev) => ({
                  ...prev,
                  autoStateTracker: !prev.autoStateTracker,
                }))
              }
              className={`min-h-[32px] rounded-xl px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                memory.autoStateTracker
                  ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                  : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
              }`}
            >
              Tự động cập nhật sau lượt AI:{' '}
              {memory.autoStateTracker ? 'Bật' : 'Tắt'}
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={isSyncingStates || turnCount === 0}
                onClick={() => onExtractStates(safeTurnIdx)}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
              >
                {isSyncingStates ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>
                  {isSyncingStates
                    ? 'Đang phân tích...'
                    : `Cập nhật trạng thái (Trang ${safeTurnIdx + 1})`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAddingState((v) => !v)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm NV</span>
              </button>
            </div>
          </div>

          {/* Add State Form */}
          {addingState && (
            <div className="space-y-2 rounded-xl bg-[#111b2c]/90 p-3 ring-1 ring-inset ring-sky-400/28">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newStateName}
                  onChange={(e) => setNewStateName(e.target.value)}
                  placeholder="Tên nhân vật..."
                  className="flex-1 rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newStateIsMc}
                    onChange={(e) => setNewStateIsMc(e.target.checked)}
                    className="rounded border-white/20 bg-[#0e1625]"
                  />
                  <span>Nhân vật chính</span>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={newStateLoc}
                  onChange={(e) => setNewStateLoc(e.target.value)}
                  placeholder="Vị trí hiện tại..."
                  className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
                <input
                  type="text"
                  value={newStateMood}
                  onChange={(e) => setNewStateMood(e.target.value)}
                  placeholder="Tâm trạng hiện tại..."
                  className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
              <input
                type="text"
                value={newStateStatus}
                onChange={(e) => setNewStateStatus(e.target.value)}
                placeholder="Trạng thái / diễn biến mới nhất..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setAddingState(false)}
                  className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewState}
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/16 px-3 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu</span>
                </button>
              </div>
            </div>
          )}

          {/* States List */}
          {!sortedStates.length ? (
            <div className="rounded-xl border border-dashed border-white/[0.10] bg-[#111b2c]/60 px-3 py-4 text-center text-xs text-slate-400">
              Chưa có dữ liệu trạng thái nhân vật. Bấm &quot;Cập nhật trạng thái&quot;
              để AI tự ghi nhận vị trí, tâm trạng và diễn biến mới nhất của nhân
              vật chính &amp; NPC gần đây.
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
              {sortedStates.map((st) => {
                const isEditing = editingStateId === st.id;
                return (
                  <div
                    key={st.id}
                    className={`rounded-xl p-3 ring-1 ring-inset ${
                      st.isMc
                        ? 'bg-sky-500/[0.08] ring-sky-400/32'
                        : 'bg-[#111b2c]/85 ring-white/[0.07]'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editStateName}
                            onChange={(e) => setEditStateName(e.target.value)}
                            className="min-w-0 flex-1 rounded-xl border border-sky-400/45 bg-[#0e1625]/85 px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <label className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-300">
                            <input
                              type="checkbox"
                              checked={editStateIsMc}
                              onChange={(e) =>
                                setEditStateIsMc(e.target.checked)
                              }
                            />
                            <span>MC</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          value={editStateLoc}
                          onChange={(e) => setEditStateLoc(e.target.value)}
                          placeholder="Vị trí..."
                          className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editStateMood}
                          onChange={(e) => setEditStateMood(e.target.value)}
                          placeholder="Tâm trạng..."
                          className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editStateStatus}
                          onChange={(e) => setEditStateStatus(e.target.value)}
                          placeholder="Trạng thái / diễn biến..."
                          className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                        <div className="flex justify-end gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setEditingStateId(null)}
                            className="min-h-[26px] rounded-lg bg-white/[0.055] px-2 text-[11px] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditState(st.id)}
                            className="min-h-[26px] rounded-lg bg-emerald-500/16 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24"
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {st.isMc ? (
                              <User className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                            ) : (
                              <Users className="h-3.5 w-3.5 shrink-0 text-sky-400/80" />
                            )}
                            <CharacterNameBadge
                              name={st.name}
                              variant="list"
                              isMc={st.isMc}
                              onClick={
                                onSelectCharacter
                                  ? () => onSelectCharacter(st.name)
                                  : undefined
                              }
                            />
                            <span className="shrink-0 text-[10px] font-medium text-slate-400">
                              {st.isMc ? 'NV chính' : 'NPC'}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              aria-label="Sửa trạng thái"
                              onClick={() => {
                                setEditingStateId(st.id);
                                setEditStateName(st.name);
                                setEditStateIsMc(st.isMc);
                                setEditStateLoc(st.location);
                                setEditStateMood(st.mood);
                                setEditStateStatus(st.status);
                              }}
                              className="rounded p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              aria-label="Xóa trạng thái"
                              onClick={() => handleDeleteState(st.id)}
                              className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                          {st.location && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
                              <span>
                                <strong className="font-medium text-slate-400">
                                  Vị trí:
                                </strong>{' '}
                                {st.location}
                              </span>
                            </div>
                          )}
                          {st.mood && (
                            <div className="flex items-start gap-1.5">
                              <Smile className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" />
                              <span>
                                <strong className="font-medium text-slate-400">
                                  Tâm trạng:
                                </strong>{' '}
                                {st.mood}
                              </span>
                            </div>
                          )}
                          {st.status && (
                            <div className="flex items-start gap-1.5">
                              <Activity className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                              <span>
                                <strong className="font-medium text-slate-400">
                                  Mới nhất:
                                </strong>{' '}
                                {st.status}
                              </span>
                            </div>
                          )}
                          {typeof st.lastTurnIndex === 'number' && (
                            <div className="pt-0.5 text-[10px] text-slate-500 tabular-nums">
                              Cập nhật tại Trang {st.lastTurnIndex + 1}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ROLLING SUMMARY */}
      {activeTab === 'summary' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                onUpdateMemory((prev) => ({
                  ...prev,
                  autoRollingSummary: !prev.autoRollingSummary,
                }))
              }
              className={`min-h-[32px] rounded-xl px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                memory.autoRollingSummary
                  ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                  : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
              }`}
            >
              Tự động tóm tắt lượt cũ:{' '}
              {memory.autoRollingSummary ? 'Bật' : 'Tắt'}
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              {memory.rollingSummary?.content?.trim() &&
                cutoffOlderTurns > 0 && (
                  <button
                    type="button"
                    disabled={isSummarizing}
                    onClick={() => onRunRollingSummary(true)}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white disabled:opacity-45 whitespace-nowrap"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Tổng hợp lại</span>
                  </button>
                )}
              <button
                type="button"
                disabled={isSummarizing || cutoffOlderTurns === 0}
                onClick={() => onRunRollingSummary(false)}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-indigo-500/18 px-3 text-xs font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-400/35 transition-all hover:bg-indigo-500/26 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
              >
                {isSummarizing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileStack className="h-3.5 w-3.5" />
                )}
                <span>
                  {isSummarizing
                    ? 'Đang tóm tắt...'
                    : pendingOlderTurns > 0
                      ? `Tóm tắt ${pendingOlderTurns} lượt cũ`
                      : 'Tóm tắt lượt cũ'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#111b2c]/85 p-3 text-center ring-1 ring-inset ring-white/[0.07]">
            <div>
              <div className="text-[10px] text-slate-400">Ngưỡng lịch sử</div>
              <div className="mt-0.5 text-xs font-bold text-slate-100 tabular-nums">
                {historyTurns} lượt gần nhất
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Đã tóm tắt</div>
              <div className="mt-0.5 text-xs font-bold text-emerald-300 tabular-nums">
                {summarizedUpTo > 0 ? `Trang 1–${summarizedUpTo}` : 'Chưa có'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Lượt cũ chờ gộp</div>
              <div className="mt-0.5 text-xs font-bold text-amber-300 tabular-nums">
                {pendingOlderTurns} lượt
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="rollingSummaryTextarea"
              className="block text-[11px] font-medium text-slate-300"
            >
              Bản tóm tắt mạch truyện dài (tự động gửi kèm ngữ cảnh AI khi bật)
            </label>
            <textarea
              id="rollingSummaryTextarea"
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              rows={compact ? 4 : 6}
              placeholder={
                cutoffOlderTurns === 0
                  ? `Khi truyện vượt quá ${historyTurns} lượt, hệ thống sẽ gộp các lượt cũ vào đây (hoặc bạn có thể tự nhập tóm tắt bối cảnh).`
                  : 'Bấm "Tóm tắt lượt cũ" để AI tự tổng hợp các lượt vượt ngưỡng lịch sử.'
              }
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 p-3 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                Tổng hiện tại: {turnCount} lượt truyện.
              </span>
              <div className="flex items-center gap-1.5">
                {memory.rollingSummary?.content && (
                  <button
                    type="button"
                    onClick={() => {
                      setSummaryDraft('');
                      onUpdateMemory((prev) => ({
                        ...prev,
                        rollingSummary: {
                          content: '',
                          summarizedUpToTurn: 0,
                          updatedAt: Date.now(),
                        },
                      }));
                    }}
                    className="min-h-[30px] rounded-lg bg-rose-500/14 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22"
                  >
                    Xóa tóm tắt
                  </button>
                )}
                <button
                  type="button"
                  disabled={!summaryDirty}
                  onClick={() =>
                    onUpdateMemory((prev) => ({
                      ...prev,
                      rollingSummary: {
                        ...prev.rollingSummary,
                        content: summaryDraft.trim(),
                        updatedAt: Date.now(),
                      },
                    }))
                  }
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/16 px-3 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 disabled:opacity-40"
                >
                  <Check className="h-3 w-3" />
                  <span>Lưu tóm tắt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
