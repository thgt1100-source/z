import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  List,
  Lock,
  Network,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type {
  CharacterPortrait,
  CharacterStateSnapshot,
  CompanionProfile,
  ContextConfig,
  MemoryManagerConfig,
  PlayerInfo,
  PortraitBankConfig,
  Turn,
  ViewName,
  WorldGenreId,
  WorldInfo,
} from '../types/ark';
import { resolveActiveSceneCharacters } from '../utils/api';
import {
  buildSuggestedEntitiesNote,
  detectEntitiesNoteMismatch,
} from '../utils/contextNote';
import {
  isInvalidNpcPortrait,
  normalizeCharacterKey,
  resolvePortraitRoleTier,
} from '../utils/characterUtils';
import { splitNarrativeAndMeta } from '../utils/saveParser';
import {
  extractMediaKey,
  isMediaRef,
  LAZY_UNLOAD_PAGE_RADIUS,
  revokeMediaKey,
} from '../utils/mediaMemoryManager';
import {
  ContextCharacterControlPanel,
  type ControlViewMode,
} from './ContextCharacterControlPanel';
import { MemoryManagerPanel } from './MemoryManagerPanel';
import { RelationshipNetworkGraph } from './RelationshipNetworkGraph';

interface CleanupCandidate {
  portrait: CharacterPortrait;
  reason: 'mob' | 'stale_empty';
  estimatedBytes: number;
}

interface CleanupScanSummary {
  candidates: CleanupCandidate[];
  mobCount: number;
  staleEmptyCount: number;
  estimatedBytes: number;
  staleThreshold: number;
}

interface CleanupFeedbackState {
  status: 'cleaned' | 'already_clean' | 'restored';
  removedPortraits: CharacterPortrait[];
  removedStates: CharacterStateSnapshot[];
  mobCount: number;
  staleEmptyCount: number;
  estimatedBytes: number;
  staleThreshold: number;
}

function estimatePortraitMemoryBytes(p: CharacterPortrait): number {
  const imageLen = p.imageData
    ? isMediaRef(p.imageData)
      ? 96 * 1024 // Approximate decoded/blob footprint for vaulted portrait media
      : p.imageData.length
    : 0;
  const textLen =
    (p.name?.length || 0) +
    (p.role?.length || 0) +
    (p.appearance?.length || 0) +
    (p.personality?.length || 0) +
    (p.relationships?.length || 0) +
    (p.signature?.length || 0) +
    (p.prompt?.length || 0) +
    (p.contextSnippet?.length || 0);
  return imageLen + textLen * 2 + 256;
}

function formatFreedBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${Math.max(0, Math.round(bytes))} B`;
}

function scanPortraitBankJunk(params: {
  portraits: CharacterPortrait[];
  characterStates: CharacterStateSnapshot[];
  currentPage: number;
  turnCount: number;
  historyTurns: number;
}): CleanupScanSummary {
  const { portraits, characterStates, currentPage, turnCount, historyTurns } =
    params;
  const staleThreshold = Math.max(
    LAZY_UNLOAD_PAGE_RADIUS,
    Math.min(24, historyTurns || 12),
  );
  const referenceTurn = Math.max(currentPage, Math.max(0, turnCount - 1));

  const stateTurnByNameKey = new Map<string, number>();
  for (const st of characterStates) {
    const key = normalizeCharacterKey(st.name);
    if (!key || typeof st.lastTurnIndex !== 'number') continue;
    const prev = stateTurnByNameKey.get(key);
    if (prev === undefined || st.lastTurnIndex > prev) {
      stateTurnByNameKey.set(key, st.lastTurnIndex);
    }
  }

  const candidates: CleanupCandidate[] = [];
  let mobCount = 0;
  let staleEmptyCount = 0;
  let estimatedBytes = 0;

  for (const p of portraits) {
    // Always flag blatant non-person junk entries (companies, venues, colors, songs, 'nhóm chat')
    if (!p.isMc && isInvalidNpcPortrait(p)) {
      const bytes = estimatePortraitMemoryBytes(p);
      candidates.push({ portrait: p, reason: 'mob', estimatedBytes: bytes });
      mobCount += 1;
      estimatedBytes += bytes;
      continue;
    }

    // Always protect pinned profiles and AI-locked profiles
    if (p.pinned || p.aiAutoEnrichLocked) continue;

    const { tier } = resolvePortraitRoleTier(p);

    // Protect MC unless the user explicitly demoted the entry to Mob
    if (p.isMc && tier !== 'mob') continue;

    if (tier === 'mob') {
      const bytes = estimatePortraitMemoryBytes(p);
      candidates.push({ portrait: p, reason: 'mob', estimatedBytes: bytes });
      mobCount += 1;
      estimatedBytes += bytes;
      continue;
    }

    // Never auto-prune Main characters
    if (tier === 'main') continue;

    const hasImage = Boolean(p.imageData && p.imageData.trim().length > 0);
    const hasMeaningfulDesc = Boolean(
      (p.appearance && p.appearance.trim().length >= 12) ||
        (p.personality && p.personality.trim().length >= 8) ||
        (p.relationships && p.relationships.trim().length >= 6),
    );
    const isManualProfile = Boolean(p.appearanceManual || p.profileManual);

    // Check if the character lacks an image or meaningful description
    const isMissingImageOrDesc = isManualProfile
      ? !hasImage && !hasMeaningfulDesc
      : !hasImage || !hasMeaningfulDesc;

    if (!isMissingImageOrDesc) continue;

    const nameKey = normalizeCharacterKey(p.name);
    const stateTurn = nameKey ? stateTurnByNameKey.get(nameKey) : undefined;
    const lastSeen =
      typeof p.lastSeenTurnIndex === 'number' && typeof stateTurn === 'number'
        ? Math.max(p.lastSeenTurnIndex, stateTurn)
        : typeof p.lastSeenTurnIndex === 'number'
          ? p.lastSeenTurnIndex
          : stateTurn;

    const isFarOldTurn =
      typeof lastSeen === 'number'
        ? referenceTurn - lastSeen > staleThreshold
        : turnCount > staleThreshold && !isManualProfile;

    if (isFarOldTurn) {
      const bytes = estimatePortraitMemoryBytes(p);
      candidates.push({
        portrait: p,
        reason: 'stale_empty',
        estimatedBytes: bytes,
      });
      staleEmptyCount += 1;
      estimatedBytes += bytes;
    }
  }

  return {
    candidates,
    mobCount,
    staleEmptyCount,
    estimatedBytes,
    staleThreshold,
  };
}

interface ContextViewProps {
  context: ContextConfig;
  memory: MemoryManagerConfig;
  portraitBank: PortraitBankConfig;
  world?: WorldInfo;
  player?: PlayerInfo;
  activeCompanion?: CompanionProfile | null;
  turns?: Turn[];
  worldGenre?: WorldGenreId;
  turnCount: number;
  currentPage: number;
  hasProxyConfigured: boolean;
  isSyncingMemory: boolean;
  isSyncingStates: boolean;
  isSummarizing: boolean;
  onSaveContext: (next: ContextConfig) => void;
  onNavigate: (view: ViewName) => void;
  onUpdateMemory: (
    updater: (prev: MemoryManagerConfig) => MemoryManagerConfig,
  ) => void;
  onUpdatePortraitBank: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
  onSyncPortraitsFromCompanion: () => void;
  onExtractMemories: (turnIndex: number) => void;
  onExtractStates: (turnIndex: number) => void;
  onRunRollingSummary: (forceAllOlder?: boolean) => void;
}

export function ContextView({
  context,
  memory,
  portraitBank,
  world,
  player,
  activeCompanion,
  turns,
  worldGenre,
  turnCount,
  currentPage,
  hasProxyConfigured,
  isSyncingMemory,
  isSyncingStates,
  isSummarizing,
  onSaveContext,
  onNavigate,
  onUpdateMemory,
  onUpdatePortraitBank,
  onSyncPortraitsFromCompanion,
  onExtractMemories,
  onExtractStates,
  onRunRollingSummary,
}: ContextViewProps) {
  const [viewMode, setViewMode] = useState<ControlViewMode>('list');
  const [cleanupFeedback, setCleanupFeedback] =
    useState<CleanupFeedbackState | null>(null);
  const [historyTurns, setHistoryTurns] = useState(
    String(context.historyTurns || 12),
  );
  const [targetLength, setTargetLength] = useState(
    context.targetLength || '900 - 1800 từ',
  );
  const [entitiesNote, setEntitiesNote] = useState(context.entitiesNote || '');
  const [prevNoteBeforeSuggest, setPrevNoteBeforeSuggest] = useState<
    string | null
  >(null);
  const [dismissedSuggestionText, setDismissedSuggestionText] = useState('');

  useEffect(() => {
    setHistoryTurns(String(context.historyTurns || 12));
    setTargetLength(context.targetLength || '900 - 1800 từ');
    setEntitiesNote(context.entitiesNote || '');
  }, [context]);

  const suggestedEntitiesNote = useMemo(
    () =>
      buildSuggestedEntitiesNote({
        world,
        player,
        companion: activeCompanion,
        portraits: portraitBank.portraits || [],
        memory,
        turns,
      }),
    [world, player, activeCompanion, portraitBank.portraits, memory, turns],
  );

  const onlineCharacterNames = useMemo(() => {
    const list = turns || [];
    if (!list.length) return [];
    const safeIdx = Math.min(Math.max(0, currentPage), list.length - 1);
    const activeTurn = list[safeIdx];
    if (!activeTurn) return [];
    const rawAi = activeTurn.assistant || '';
    const cleanAi = splitNarrativeAndMeta(rawAi, false).mainText || rawAi;
    const cleanUser = activeTurn.user || '';
    if (!cleanAi.trim() && !cleanUser.trim()) return [];
    return resolveActiveSceneCharacters({
      currentUserText: cleanUser,
      currentAiText: cleanAi,
      recentTurns: [],
      mcName: player?.name || activeCompanion?.mc?.name || '',
      mcPronoun: activeCompanion?.mc?.pronoun || '',
      mcAbsentAtStart: Boolean(player?.absentAtStart),
      npcs: activeCompanion?.npcs || [],
      portraits: portraitBank.portraits || [],
      characterStates: memory?.characterStates || [],
    }).presentNames;
  }, [turns, currentPage, player, activeCompanion, portraitBank.portraits, memory]);

  const noteMismatch = useMemo(
    () =>
      detectEntitiesNoteMismatch(entitiesNote, suggestedEntitiesNote, {
        world,
        player,
        companion: activeCompanion,
        portraits: portraitBank.portraits || [],
      }),
    [
      entitiesNote,
      suggestedEntitiesNote,
      world,
      player,
      activeCompanion,
      portraitBank.portraits,
    ],
  );

  const cleanupScan = useMemo(
    () =>
      scanPortraitBankJunk({
        portraits: portraitBank.portraits || [],
        characterStates: memory.characterStates || [],
        currentPage,
        turnCount,
        historyTurns: context.historyTurns || 12,
      }),
    [
      portraitBank.portraits,
      memory.characterStates,
      currentPage,
      turnCount,
      context.historyTurns,
    ],
  );

  const handleCleanPortraitJunk = () => {
    if (cleanupScan.candidates.length === 0) {
      setCleanupFeedback({
        status: 'already_clean',
        removedPortraits: [],
        removedStates: [],
        mobCount: 0,
        staleEmptyCount: 0,
        estimatedBytes: 0,
        staleThreshold: cleanupScan.staleThreshold,
      });
      return;
    }

    const removedPortraits = cleanupScan.candidates.map((c) => c.portrait);
    const removeIds = new Set(removedPortraits.map((p) => p.id));
    const removeNameKeys = new Set(
      removedPortraits
        .map((p) => normalizeCharacterKey(p.name))
        .filter(Boolean),
    );

    // Immediately revoke any active Object URLs for vaulted portrait images to free RAM
    for (const p of removedPortraits) {
      if (p.imageData && isMediaRef(p.imageData)) {
        revokeMediaKey(extractMediaKey(p.imageData));
      }
    }

    const removedStates = (memory.characterStates || []).filter((st) => {
      if (st.isMc) return false;
      const key = normalizeCharacterKey(st.name);
      return Boolean(key && removeNameKeys.has(key));
    });
    const removeStateIds = new Set(removedStates.map((s) => s.id));

    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).filter((p) => !removeIds.has(p.id)),
    }));

    if (removeStateIds.size > 0) {
      onUpdateMemory((prev) => ({
        ...prev,
        characterStates: (prev.characterStates || []).filter(
          (st) => !removeStateIds.has(st.id),
        ),
      }));
    }

    setCleanupFeedback({
      status: 'cleaned',
      removedPortraits,
      removedStates,
      mobCount: cleanupScan.mobCount,
      staleEmptyCount: cleanupScan.staleEmptyCount,
      estimatedBytes: cleanupScan.estimatedBytes,
      staleThreshold: cleanupScan.staleThreshold,
    });
  };

  const handleUndoCleanup = () => {
    if (
      !cleanupFeedback ||
      cleanupFeedback.status !== 'cleaned' ||
      cleanupFeedback.removedPortraits.length === 0
    ) {
      return;
    }

    const toRestorePortraits = cleanupFeedback.removedPortraits;
    const toRestoreStates = cleanupFeedback.removedStates;

    onUpdatePortraitBank((prev) => {
      const existingIds = new Set((prev.portraits || []).map((p) => p.id));
      const merged = [
        ...(prev.portraits || []),
        ...toRestorePortraits.filter((p) => !existingIds.has(p.id)),
      ];
      return { ...prev, portraits: merged };
    });

    if (toRestoreStates.length > 0) {
      onUpdateMemory((prev) => {
        const existingIds = new Set(
          (prev.characterStates || []).map((s) => s.id),
        );
        return {
          ...prev,
          characterStates: [
            ...(prev.characterStates || []),
            ...toRestoreStates.filter((s) => !existingIds.has(s.id)),
          ],
        };
      });
    }

    setCleanupFeedback({
      ...cleanupFeedback,
      status: 'restored',
    });
  };

  const handleSave = () => {
    const parsedTurns = Math.min(
      100,
      Math.max(1, parseInt(historyTurns, 10) || 12),
    );
    onSaveContext({
      historyTurns: parsedTurns,
      targetLength: targetLength.trim() || '900 - 1800 từ',
      entitiesNote,
    });
  };

  const handleApplySuggestedNote = () => {
    if (!suggestedEntitiesNote) return;
    if (entitiesNote.trim() !== suggestedEntitiesNote.trim()) {
      setPrevNoteBeforeSuggest(entitiesNote);
    }
    setEntitiesNote(suggestedEntitiesNote);
    setDismissedSuggestionText('');
    const parsedTurns = Math.min(
      100,
      Math.max(1, parseInt(historyTurns, 10) || 12),
    );
    onSaveContext({
      historyTurns: parsedTurns,
      targetLength: targetLength.trim() || '900 - 1800 từ',
      entitiesNote: suggestedEntitiesNote,
    });
  };

  const handleUndoSuggestedNote = () => {
    if (prevNoteBeforeSuggest === null) return;
    const restored = prevNoteBeforeSuggest;
    setPrevNoteBeforeSuggest(null);
    setEntitiesNote(restored);
    const parsedTurns = Math.min(
      100,
      Math.max(1, parseInt(historyTurns, 10) || 12),
    );
    onSaveContext({
      historyTurns: parsedTurns,
      targetLength: targetLength.trim() || '900 - 1800 từ',
      entitiesNote: restored,
    });
  };

  const handleTogglePin = (portraitId: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === portraitId
          ? { ...p, pinned: !p.pinned, updatedAt: Date.now() }
          : p,
      ),
    }));
  };

  const handleToggleAiLock = (portraitId: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === portraitId
          ? {
              ...p,
              aiAutoEnrichLocked: !p.aiAutoEnrichLocked,
              updatedAt: Date.now(),
            }
          : p,
      ),
    }));
  };

  const handleAssignRole = (portraitId: string, nextRole: string) => {
    const cleaned = nextRole.trim();
    if (!cleaned) return;
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === portraitId
          ? { ...p, role: cleaned, updatedAt: Date.now() }
          : p,
      ),
    }));
  };

  const handleAddRelationshipTag = (
    sourceId: string,
    targetName: string,
    relationLabel: string,
  ) => {
    const cleanTarget = targetName.trim();
    const cleanRel = relationLabel.trim();
    if (!cleanTarget || !cleanRel) return;
    const newClause = `${cleanRel} với ${cleanTarget}`;
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) => {
        if (p.id !== sourceId) return p;
        const existing = (p.relationships || '').trim();
        const nextRelationships = existing
          ? existing.toLowerCase().includes(newClause.toLowerCase())
            ? existing
            : `${existing.replace(/[;.\s]+$/, '')}; ${newClause}`
          : newClause;
        return {
          ...p,
          relationships: nextRelationships,
          updatedAt: Date.now(),
        };
      }),
    }));
  };

  const handleAssignFactionTag = (portraitId: string, factionName: string) => {
    const cleanFaction = String(factionName ?? '')
      .replace(/[\[\]]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanFaction) return;
    const tag = `[Phe: ${cleanFaction}]`;
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) => {
        if (p.id !== portraitId) return p;
        const existing = (p.relationships || '').trim();
        const stripped = existing
          .replace(
            /\[\s*(?:phe(?:\s*phái)?|tổ\s*chức|nhóm|tông\s*môn|gia\s*tộc|công\s*hội|bang|đội)\s*[:=]\s*[^\]]+\]\s*[;,.·•]?\s*/giu,
            '',
          )
          .trim();
        const nextRelationships = stripped ? `${tag}; ${stripped}` : tag;
        return {
          ...p,
          relationships: nextRelationships,
          updatedAt: Date.now(),
        };
      }),
    }));
  };

  const portraitCount = (portraitBank.portraits || []).length;
  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === 'list' ? 'network' : 'list'));
  };

  return (
    <section className="space-y-3.5">
      {/* Top-Level ContextView Mode Bar with Dedicated 'Chuyển chế độ' & 'Dọn dẹp rác' */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#162032]/88 p-2 ring-1 ring-white/[0.08] shadow-[0_10px_28px_-16px_rgba(2,8,23,0.65)]">
        <div
          role="tablist"
          aria-label="Chế độ hiển thị Ngữ cảnh"
          className="inline-flex flex-wrap items-center gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'list'
                ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Danh sách nhân vật</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'network'}
            onClick={() => setViewMode('network')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-all whitespace-nowrap ${
              viewMode === 'network'
                ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            <span>Sơ đồ mạng lưới quan hệ</span>
            <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-200">
              {portraitCount}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleCleanPortraitJunk}
            title={`Quét Portrait Bank để dọn nhân vật Mob (chưa ghim/khóa) và hồ sơ thiếu ảnh/mô tả cách quá ${cleanupScan.staleThreshold} lượt truyện`}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all active:scale-[0.985] whitespace-nowrap ${
              cleanupScan.candidates.length > 0
                ? 'bg-amber-500/18 text-amber-100 ring-1 ring-inset ring-amber-400/40 hover:bg-amber-500/28'
                : 'bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.10] hover:text-white'
            }`}
          >
            <Trash2
              className={`h-3.5 w-3.5 ${
                cleanupScan.candidates.length > 0
                  ? 'text-amber-300'
                  : 'text-slate-400'
              }`}
            />
            <span>Dọn dẹp rác</span>
            {cleanupScan.candidates.length > 0 && (
              <span className="rounded-md bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-100">
                {cleanupScan.candidates.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleViewMode}
            title={
              viewMode === 'list'
                ? 'Chuyển sang Sơ đồ mạng lưới quan hệ'
                : 'Chuyển về Danh sách nhân vật'
            }
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500/25 to-blue-600/25 px-3.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/40 transition-all hover:from-sky-500/35 hover:to-blue-500/35 active:scale-[0.985] whitespace-nowrap"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-sky-300" />
            <span>Chuyển chế độ</span>
          </button>

          {viewMode === 'network' && (
            <button
              type="button"
              onClick={onSyncPortraitsFromCompanion}
              title="Quét nhân vật, mối quan hệ và trạng thái từ lượt truyện hiện tại (kèm hồ sơ Đồng nhân)"
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5 text-sky-300" />
              <span>Đồng bộ NPC lượt này</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline PortraitBank Cleanup Feedback & 1-Click Undo Banner */}
      {cleanupFeedback && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs ring-1 ${
            cleanupFeedback.status === 'cleaned'
              ? 'bg-emerald-950/75 text-emerald-100 ring-emerald-400/30'
              : cleanupFeedback.status === 'restored'
                ? 'bg-sky-950/75 text-sky-100 ring-sky-400/30'
                : 'bg-[#162032]/88 text-slate-200 ring-white/[0.10]'
          }`}
        >
          <div className="flex min-w-0 items-start gap-2">
            <CheckCircle2
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                cleanupFeedback.status === 'cleaned'
                  ? 'text-emerald-400'
                  : cleanupFeedback.status === 'restored'
                    ? 'text-sky-400'
                    : 'text-slate-400'
              }`}
            />
            <div className="min-w-0 leading-relaxed">
              {cleanupFeedback.status === 'already_clean' && (
                <span>
                  Portrait Bank đang gọn sạch — không phát hiện nhân vật{' '}
                  <strong className="font-semibold text-slate-100">Mob</strong>{' '}
                  (chưa ghim/khóa) hoặc hồ sơ thiếu ảnh/mô tả cách quá{' '}
                  <span className="tabular-nums">
                    {cleanupFeedback.staleThreshold}
                  </span>{' '}
                  lượt cần dọn.
                </span>
              )}

              {cleanupFeedback.status === 'cleaned' && (
                <>
                  <span>
                    Đã dọn{' '}
                    <strong className="font-bold tabular-nums text-white">
                      {cleanupFeedback.removedPortraits.length}
                    </strong>{' '}
                    mục rác (
                    {[
                      cleanupFeedback.mobCount > 0
                        ? `${cleanupFeedback.mobCount} Mob`
                        : '',
                      cleanupFeedback.staleEmptyCount > 0
                        ? `${cleanupFeedback.staleEmptyCount} hồ sơ trống >${cleanupFeedback.staleThreshold} lượt`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    ) • Giải phóng khoảng{' '}
                    <strong className="font-semibold tabular-nums text-emerald-200">
                      {formatFreedBytes(cleanupFeedback.estimatedBytes)}
                    </strong>
                    {cleanupFeedback.removedStates.length > 0
                      ? ` & giảm ${cleanupFeedback.removedStates.length} trạng thái cũ`
                      : ''}
                    .
                  </span>
                  <div className="mt-0.5 truncate text-[11px] text-emerald-200/80">
                    Đã xóa:{' '}
                    {cleanupFeedback.removedPortraits
                      .slice(0, 5)
                      .map((p) => p.name)
                      .join(', ')}
                    {cleanupFeedback.removedPortraits.length > 5
                      ? ` và +${cleanupFeedback.removedPortraits.length - 5} mục khác`
                      : ''}
                  </div>
                </>
              )}

              {cleanupFeedback.status === 'restored' && (
                <span>
                  Đã hoàn tác và khôi phục{' '}
                  <strong className="font-bold tabular-nums text-white">
                    {cleanupFeedback.removedPortraits.length}
                  </strong>{' '}
                  hồ sơ nhân vật về Portrait Bank.
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {cleanupFeedback.status === 'cleaned' && (
              <button
                type="button"
                onClick={handleUndoCleanup}
                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20"
              >
                <Undo2 className="h-3 w-3" />
                <span>Hoàn tác</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCleanupFeedback(null)}
              aria-label="Đóng thông báo dọn dẹp"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {viewMode === 'network' ? (
        <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)]">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-sky-400" />
                <h2 className="text-base font-bold tracking-tight text-slate-50">
                  Sơ đồ mạng lưới quan hệ
                </h2>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                Sơ đồ lực tương tác D3 từ danh sách Portrait Bank và thuộc tính{' '}
                <code className="text-slate-300">relationships</code>. Kéo thả
                các node để sắp xếp, rê chuột vào nhân vật để xem chú thích vai
                trò (tag màu), hoặc bấm vào node để đổi vai trò / khóa AI.
              </p>
            </div>
          </div>

          {/* Role Color Legend */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-xl bg-[#0e1625]/70 px-3 py-2 text-[11px] text-slate-400 ring-1 ring-inset ring-white/[0.06]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              <span className="font-medium text-orange-200">Main</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="font-medium text-sky-200">NPC</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="font-medium text-slate-300">Mob</span>
            </span>
            <span className="inline-flex items-center gap-1 text-rose-300/90">
              <Lock className="h-3 w-3" />
              <span>Tạm khóa AI</span>
            </span>
          </div>

          <RelationshipNetworkGraph
            portraitBank={portraitBank}
            memory={memory}
            onTogglePin={handleTogglePin}
            onToggleAiLock={handleToggleAiLock}
            onAssignRole={handleAssignRole}
            onAddRelationshipTag={handleAddRelationshipTag}
            onAssignFactionTag={handleAssignFactionTag}
            onUpdatePortraitBank={onUpdatePortraitBank}
          />
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-50">
                  Cửa sổ Ngữ cảnh &amp; Thực thể
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Điều chỉnh số lượt lịch sử gửi kèm và ghi chú thực thể/bối
                  cảnh.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Lưu Ngữ cảnh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Số lượt lịch sử tối đa
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={historyTurns}
                  onChange={(e) => setHistoryTurns(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2 text-sm text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Mục tiêu độ dài hồi đáp (từ)
                </label>
                <input
                  type="text"
                  value={targetLength}
                  onChange={(e) => setTargetLength(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div className="mt-3.5">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-300">
                  Ghi chú thực thể &amp; thế giới
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {prevNoteBeforeSuggest !== null && (
                    <button
                      type="button"
                      onClick={handleUndoSuggestedNote}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.1] transition-colors hover:bg-white/[0.12] hover:text-white"
                    >
                      <Undo2 className="h-3 w-3" />
                      <span>Hoàn tác</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleApplySuggestedNote}
                    disabled={!suggestedEntitiesNote}
                    title="Tự tạo lại ghi chú khớp với thế giới, nhân vật và save đang mở rồi lưu ngay"
                    className="inline-flex min-h-[28px] items-center gap-1.5 rounded-lg bg-sky-500/15 px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Sparkles className="h-3 w-3 text-sky-300" />
                    <span>Gợi ý lại theo bối cảnh</span>
                  </button>
                </div>
              </div>

              {noteMismatch.isMismatched &&
                suggestedEntitiesNote &&
                dismissedSuggestionText !== suggestedEntitiesNote && (
                  <div className="mb-2.5 rounded-xl bg-amber-950/45 p-3 text-xs ring-1 ring-inset ring-amber-400/25">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-amber-200">
                          {noteMismatch.reason}
                        </p>
                        <p className="mt-1 line-clamp-3 leading-relaxed text-amber-100/80">
                          <span className="font-medium text-amber-200/95">
                            Gợi ý khớp bối cảnh đang mở:{' '}
                          </span>
                          {suggestedEntitiesNote}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedSuggestionText(suggestedEntitiesNote)
                        }
                        aria-label="Đóng gợi ý ghi chú"
                        className="rounded-lg p-1 text-amber-200/70 transition-colors hover:bg-white/[0.08] hover:text-amber-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleApplySuggestedNote}
                        className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40 transition-colors hover:bg-amber-500/30 hover:text-white"
                      >
                        <Sparkles className="h-3 w-3 text-amber-300" />
                        <span>Áp dụng &amp; Lưu ngay</span>
                      </button>
                    </div>
                  </div>
                )}

              <textarea
                value={entitiesNote}
                onChange={(e) => setEntitiesNote(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>

          {/* Portrait Bank Character Control Panel (Pin / Lock AI / Quick Role / Relationship Network) */}
          <ContextCharacterControlPanel
            portraitBank={portraitBank}
            memory={memory}
            worldGenre={worldGenre}
            onlineCharacterNames={onlineCharacterNames}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onUpdatePortraitBank={onUpdatePortraitBank}
            onSyncFromCompanion={onSyncPortraitsFromCompanion}
          />

          {/* AI Memory & State Manager Hub */}
          <MemoryManagerPanel
            memory={memory}
            turnCount={turnCount}
            currentPage={currentPage}
            historyTurns={context.historyTurns || 12}
            hasProxyConfigured={hasProxyConfigured}
            isSyncingMemory={isSyncingMemory}
            isSyncingStates={isSyncingStates}
            isSummarizing={isSummarizing}
            onNavigate={onNavigate}
            onUpdateMemory={onUpdateMemory}
            onExtractMemories={onExtractMemories}
            onExtractStates={onExtractStates}
            onRunRollingSummary={onRunRollingSummary}
          />
        </>
      )}
    </section>
  );
}
