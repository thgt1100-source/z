import type {
  ArkState,
  MemoryManagerConfig,
  StoryClockState,
  Turn,
} from '../types/ark';

/**
 * Clamp any page index cleanly into [0, Math.max(0, turnCount - 1)].
 */
export function clampPageIndex(page: number, turnCount: number): number {
  const safeCount = Number.isFinite(turnCount) ? Math.max(0, Math.floor(turnCount)) : 0;
  if (safeCount <= 1) return 0;
  const parsed = Number.isFinite(page) ? Math.floor(page) : 0;
  return Math.min(Math.max(0, parsed), safeCount - 1);
}

/**
 * Guarantee every Turn has a unique, stable non-empty `id` so React keys and
 * async stream/image updates can match turns by ID instead of shifting indices.
 */
export function ensureUniqueTurnIds(turns: Turn[]): Turn[] {
  if (!Array.isArray(turns) || turns.length === 0) return [];
  const seen = new Set<string>();
  let changed = false;
  const baseTs = Date.now();

  const normalized = turns.map((turn, idx) => {
    const rawId = typeof turn?.id === 'string' ? turn.id.trim() : '';
    if (rawId && !seen.has(rawId)) {
      seen.add(rawId);
      return turn;
    }
    changed = true;
    const prefix = rawId ? `${rawId}_` : `turn_${turn?.createdAt || baseTs}_`;
    let candidate = `${prefix}${idx}`;
    let salt = 1;
    while (seen.has(candidate)) {
      candidate = `${prefix}${idx}_${salt++}`;
    }
    seen.add(candidate);
    return {
      ...turn,
      id: candidate,
    };
  });

  return changed ? normalized : turns;
}

/**
 * Resolve which companion story key (if any) currently owns `state.turns`.
 * Supports explicit `activeStoryCompanionId` (string or null) and safely infers
 * ownership for legacy persisted states saved before `activeStoryCompanionId` existed.
 */
export function resolveActiveStoryCompanionKey(
  state: Pick<
    ArkState,
    'activeStoryCompanionId' | 'activeCompanionId' | 'companionStories' | 'turns'
  >,
): string | null {
  if (typeof state.activeStoryCompanionId === 'string') {
    const trimmed = state.activeStoryCompanionId.trim();
    return trimmed || null;
  }
  if (state.activeStoryCompanionId === null) {
    return null;
  }

  // Legacy migration: infer whether `state.turns` mirrors `companionStories[activeCompanionId]`
  const activeId = (state.activeCompanionId || '').trim();
  if (!activeId || !state.companionStories) return null;
  const compTurns = state.companionStories[activeId];
  if (!Array.isArray(compTurns)) return null;

  const curTurns = Array.isArray(state.turns) ? state.turns : [];
  if (compTurns.length !== curTurns.length) return null;
  if (curTurns.length === 0) return activeId;

  const firstMatches =
    Boolean(curTurns[0]?.id && compTurns[0]?.id && curTurns[0].id === compTurns[0].id) ||
    ((curTurns[0]?.user || '') === (compTurns[0]?.user || '') &&
      (curTurns[0]?.assistant || '') === (compTurns[0]?.assistant || ''));
  const lastIdx = curTurns.length - 1;
  const lastMatches =
    Boolean(
      curTurns[lastIdx]?.id &&
        compTurns[lastIdx]?.id &&
        curTurns[lastIdx].id === compTurns[lastIdx].id,
    ) ||
    ((curTurns[lastIdx]?.user || '') === (compTurns[lastIdx]?.user || '') &&
      (curTurns[lastIdx]?.assistant || '') === (compTurns[lastIdx]?.assistant || ''));

  return firstMatches && lastMatches ? activeId : null;
}

/**
 * Re-index all turn-referenced metadata inside MemoryManagerConfig when a turn at
 * `deletedIndex` is removed, preventing stale turn pointers or hidden deleted history.
 */
export function reindexMemoryOnTurnDelete(
  memory: MemoryManagerConfig,
  deletedIndex: number,
  nextTurnCount: number,
): MemoryManagerConfig {
  const safeCount = Math.max(0, nextTurnCount);

  // 1. Lorebook / Memory entries: remove unpinned entries extracted strictly from the deleted turn,
  // detach turnIndex on pinned entries from that turn, and shift higher indices down by 1.
  const nextEntries = (memory.entries || []).reduce<MemoryManagerConfig['entries']>(
    (acc, entry) => {
      if (typeof entry.turnIndex !== 'number') {
        acc.push(entry);
        return acc;
      }
      if (entry.turnIndex === deletedIndex) {
        if (entry.pinned) {
          acc.push({
            ...entry,
            turnIndex: undefined,
          });
        }
        return acc;
      }
      if (entry.turnIndex > deletedIndex) {
        acc.push({
          ...entry,
          turnIndex: entry.turnIndex - 1,
        });
        return acc;
      }
      acc.push(entry);
      return acc;
    },
    [],
  );

  // 2. Character states: shift lastTurnIndex > deletedIndex down by 1, clamp === deletedIndex
  const nextCharStates = (memory.characterStates || []).map((cs) => {
    if (typeof cs.lastTurnIndex !== 'number') return cs;
    if (safeCount === 0) {
      return { ...cs, lastTurnIndex: undefined };
    }
    if (cs.lastTurnIndex > deletedIndex) {
      return { ...cs, lastTurnIndex: cs.lastTurnIndex - 1 };
    }
    if (cs.lastTurnIndex === deletedIndex) {
      return {
        ...cs,
        lastTurnIndex: deletedIndex > 0 ? Math.min(deletedIndex - 1, safeCount - 1) : undefined,
      };
    }
    return cs;
  });

  // 3. Story clock lastTurnIndex
  let nextStoryClock = memory.storyClock;
  if (nextStoryClock && typeof nextStoryClock.lastTurnIndex === 'number') {
    const prevIdx = nextStoryClock.lastTurnIndex;
    let adjustedIdx: number | undefined = prevIdx;
    if (safeCount === 0) {
      adjustedIdx = undefined;
    } else if (prevIdx > deletedIndex) {
      adjustedIdx = prevIdx - 1;
    } else if (prevIdx === deletedIndex) {
      adjustedIdx = deletedIndex > 0 ? Math.min(deletedIndex - 1, safeCount - 1) : undefined;
    }
    if (adjustedIdx !== prevIdx) {
      nextStoryClock = {
        ...nextStoryClock,
        lastTurnIndex: adjustedIdx,
      };
    }
  }

  // 4. Rolling summary: keep summarizedUpToTurn strictly aligned and clear stale summary when empty
  const prevRolling = memory.rollingSummary || {
    content: '',
    summarizedUpToTurn: 0,
    updatedAt: 0,
  };
  let nextRolling = prevRolling;
  if (safeCount === 0) {
    if (prevRolling.content || prevRolling.summarizedUpToTurn > 0) {
      nextRolling = {
        content: '',
        summarizedUpToTurn: 0,
        updatedAt: Date.now(),
      };
    }
  } else if (prevRolling.summarizedUpToTurn > 0) {
    let nextUpTo = prevRolling.summarizedUpToTurn;
    if (deletedIndex < prevRolling.summarizedUpToTurn) {
      nextUpTo = Math.max(0, prevRolling.summarizedUpToTurn - 1);
    }
    nextUpTo = Math.min(nextUpTo, safeCount);
    if (nextUpTo !== prevRolling.summarizedUpToTurn) {
      nextRolling = {
        content: nextUpTo === 0 ? '' : prevRolling.content,
        summarizedUpToTurn: nextUpTo,
        updatedAt: Date.now(),
      };
    }
  }

  return {
    ...memory,
    entries: nextEntries,
    characterStates: nextCharStates,
    storyClock: nextStoryClock,
    rollingSummary: nextRolling,
  };
}

/**
 * Re-index the in-memory `turnPreClockRef` map when a turn at `deletedIndex` is removed.
 */
export function reindexPreClockMapOnDelete(
  map: Map<number, StoryClockState>,
  deletedIndex: number,
): void {
  if (!map || map.size === 0) return;
  const entries = Array.from(map.entries());
  map.clear();
  for (const [key, val] of entries) {
    if (key === deletedIndex) continue;
    if (key > deletedIndex) {
      map.set(key - 1, val);
    } else {
      map.set(key, val);
    }
  }
}

/**
 * Pure, atomic deletion of a turn/page at `turnIndex` from `ArkState`.
 * Removes the turn cleanly, syncs companionStories & companionMemories, re-indexes
 * memory/clock/rollingSummary, and computes the exact non-drifting `currentPage`.
 */
export function deleteTurnFromState(
  state: ArkState,
  turnIndex: number,
  explicitCompKey?: string | null,
): {
  nextState: ArkState;
  deletedTurn: Turn | null;
  nextPage: number;
} {
  if (
    !Array.isArray(state.turns) ||
    turnIndex < 0 ||
    turnIndex >= state.turns.length
  ) {
    return {
      nextState: state,
      deletedTurn: null,
      nextPage: clampPageIndex(state.currentPage, state.turns?.length || 0),
    };
  }

  const deletedTurn = state.turns[turnIndex] || null;
  const nextTurns = ensureUniqueTurnIds(
    state.turns.filter((_, i) => i !== turnIndex),
  );

  // Compute exact non-drifting page index
  let nextPage = 0;
  if (nextTurns.length > 0) {
    if (turnIndex < state.currentPage) {
      nextPage = clampPageIndex(state.currentPage - 1, nextTurns.length);
    } else {
      nextPage = clampPageIndex(state.currentPage, nextTurns.length);
    }
  }

  const nextMemory = reindexMemoryOnTurnDelete(
    state.memory,
    turnIndex,
    nextTurns.length,
  );

  const compKey =
    explicitCompKey !== undefined
      ? explicitCompKey
      : resolveActiveStoryCompanionKey(state);

  let nextCompanionStories = state.companionStories || {};
  if (compKey) {
    nextCompanionStories = {
      ...nextCompanionStories,
      [compKey]: nextTurns,
    };
  } else if (deletedTurn?.id && state.activeCompanionId) {
    // Extra safety: if activeCompanionId's cached story still holds the exact deleted turn ID, prune it too
    const cached = nextCompanionStories[state.activeCompanionId];
    if (Array.isArray(cached) && cached.some((t) => t.id === deletedTurn.id)) {
      nextCompanionStories = {
        ...nextCompanionStories,
        [state.activeCompanionId]: cached.filter((t) => t.id !== deletedTurn.id),
      };
    }
  }

  const nextCompanionMemories = compKey
    ? {
        ...(state.companionMemories || {}),
        [compKey]: nextMemory,
      }
    : state.companionMemories || {};

  const nextState: ArkState = {
    ...state,
    turns: nextTurns,
    currentPage: nextPage,
    memory: nextMemory,
    companionStories: nextCompanionStories,
    companionMemories: nextCompanionMemories,
  };

  return {
    nextState,
    deletedTurn,
    nextPage,
  };
}
