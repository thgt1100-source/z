import type {
  CharacterPortrait,
  CompanionProfile,
  ContextConfig,
  MemoryManagerConfig,
  PlayerInfo,
  Turn,
  WorldInfo,
} from '../types/ark';
import {
  isChatOrNonPersonDescription,
  resolvePortraitRoleTier,
  sanitizeCharacterName,
  sanitizeNpcFieldText,
} from './characterUtils';

export const DEFAULT_GENERIC_ENTITIES_NOTE =
  'Bối cảnh hiện đại, nhịp kể chậm rãi, chi tiết; tên và xưng hô do AI tự quyết định hoặc theo ngữ cảnh người dùng.';

const GENERIC_WORLD_NAMES = new Set([
  '',
  'the gioi moi',
  'the gioi tu do',
  'the gioi dong nhan',
  'the gioi mac dinh',
  'new world',
  'default',
  'khong ten',
]);

function normalizeTextForCompare(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateClean(text: string, maxLen: number): string {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;
  const sliced = cleaned.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > maxLen * 0.65 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.replace(/[,;:\-–\s]+$/, '')}…`;
}

function isMeaningfulWorldName(name?: string): boolean {
  const norm = normalizeTextForCompare(name || '');
  if (!norm || norm.length < 2) return false;
  if (GENERIC_WORLD_NAMES.has(norm)) return false;
  if (/^the gioi dong nhan \d+$/.test(norm)) return false;
  return true;
}

export function isGenericEntitiesNote(note?: string): boolean {
  const trimmed = (note || '').trim();
  if (!trimmed) return true;
  const normNote = normalizeTextForCompare(trimmed);
  const normDefault = normalizeTextForCompare(DEFAULT_GENERIC_ENTITIES_NOTE);
  if (normNote === normDefault) return true;
  if (
    normNote.includes('boi canh hien dai nhip ke cham rai chi tiet') &&
    normNote.includes('ten va xung ho do ai tu quyet dinh')
  ) {
    return true;
  }
  return false;
}

export function normalizeContextConfig(
  raw: unknown,
  fallback?: ContextConfig,
): ContextConfig {
  const base: ContextConfig = fallback
    ? {
        historyTurns: Math.max(1, Math.min(100, Number(fallback.historyTurns) || 12)),
        targetLength: fallback.targetLength || '900 - 1800 từ',
        entitiesNote: fallback.entitiesNote ?? DEFAULT_GENERIC_ENTITIES_NOTE,
      }
    : {
        historyTurns: 12,
        targetLength: '900 - 1800 từ',
        entitiesNote: DEFAULT_GENERIC_ENTITIES_NOTE,
      };

  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const rawTurns = Number(obj.historyTurns);
  const historyTurns =
    Number.isFinite(rawTurns) && rawTurns >= 1
      ? Math.max(1, Math.min(100, Math.round(rawTurns)))
      : base.historyTurns;
  const targetLength =
    typeof obj.targetLength === 'string' && obj.targetLength.trim()
      ? obj.targetLength.trim()
      : base.targetLength;
  const entitiesNote =
    typeof obj.entitiesNote === 'string'
      ? obj.entitiesNote.trim()
      : base.entitiesNote;

  return {
    historyTurns,
    targetLength,
    entitiesNote,
  };
}

export interface BuildEntitiesNoteParams {
  world?: WorldInfo;
  player?: PlayerInfo;
  companion?: CompanionProfile | null;
  portraits?: CharacterPortrait[];
  memory?: MemoryManagerConfig;
  turns?: Turn[];
}

function extractFallbackCueFromTurns(turns?: Turn[]): string {
  if (!Array.isArray(turns) || turns.length === 0) return '';
  const latest = turns[turns.length - 1];
  const first = turns[0];
  const sampleText = (latest?.assistant || first?.assistant || first?.user || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[[^\]]{1,40}\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sampleText) return '';
  const sentences = sampleText
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 24 && !/^trang truyện riêng cho/i.test(s));
  const best = sentences[0] || sampleText;
  return truncateClean(best, 160);
}

/**
 * Deterministically builds a concise, accurate "Ghi chú thực thể & thế giới"
 * matching the currently opened save, world, companion profile, portrait bank, and memory.
 */
export function buildSuggestedEntitiesNote(
  params: BuildEntitiesNoteParams,
): string {
  const { world, player, companion, portraits, memory, turns } = params;
  const parts: string[] = [];

  const worldName =
    (isMeaningfulWorldName(world?.name) ? world?.name?.trim() : '') ||
    (isMeaningfulWorldName(companion?.name) ? companion?.name?.trim() : '') ||
    '';
  const genreLabel = (world?.genreLabel || companion?.role || '').trim();
  const sourceQuery = (companion?.sourceQuery || '').trim();
  const atmosphere = (world?.atmosphere || '').trim();
  const setting = (world?.setting || companion?.worldSetting || '').trim();
  const rules = (world?.rules || companion?.worldRules || '').trim();
  const compNote = (companion?.note || '').trim();

  if (worldName) {
    const genreSuffix = genreLabel ? ` (${genreLabel})` : '';
    const sourceSuffix =
      sourceQuery &&
      normalizeTextForCompare(sourceQuery) !== normalizeTextForCompare(worldName)
        ? ` — nguyên tác: ${truncateClean(sourceQuery, 60)}`
        : '';
    parts.push(`Thế giới: ${worldName}${genreSuffix}${sourceSuffix}.`);
  } else if (genreLabel) {
    parts.push(`Thể loại/bối cảnh: ${genreLabel}.`);
  }

  if (atmosphere) {
    parts.push(`Không khí: ${truncateClean(atmosphere, 80)}.`);
  }
  if (setting) {
    parts.push(`Bối cảnh: ${truncateClean(setting, 180)}`);
  }
  if (rules) {
    parts.push(`Quy tắc: ${truncateClean(rules, 130)}`);
  }
  if (companion?.animeTone?.trim()) {
    parts.push(`Văn phong & không khí: ${truncateClean(companion.animeTone, 120)}`);
  }
  if (companion?.creativeDirection?.trim()) {
    parts.push(
      `Định hướng Đồng nhân: ${truncateClean(companion.creativeDirection, 140)}`,
    );
  }
  if (
    Array.isArray(companion?.journeyMilestones) &&
    companion.journeyMilestones.length > 0
  ) {
    parts.push(
      `Lộ trình ${companion.journeyMilestones.length} chặng hành trình: ${truncateClean(
        companion.journeyMilestones[0],
        100,
      )}`,
    );
  }

  const mcName = (player?.name || companion?.mc?.name || '').trim();
  const mcPronoun = (player?.pronoun || companion?.mc?.pronoun || '').trim();
  const mcRole = (
    player?.role ||
    companion?.mc?.originRole ||
    ''
  ).trim();

  if (player?.absentAtStart) {
    parts.push(
      'Nhân vật chính chưa có mặt từ đầu; tập trung diễn biến quanh bối cảnh và dàn NPC.',
    );
  } else if (mcName) {
    const details = [
      mcPronoun ? `xưng hô: ${mcPronoun}` : '',
      mcRole ? truncateClean(mcRole, 60) : '',
    ]
      .filter(Boolean)
      .join(', ');
    parts.push(
      `Nhân vật chính: ${mcName}${details ? ` (${details})` : ''}.`,
    );
  }

  // Collect key entities prioritized by Main / Pinned / NPC (excluding Mob)
  const entityLabels: string[] = [];
  const seenKeys = new Set<string>();
  if (mcName) {
    seenKeys.add(normalizeTextForCompare(mcName));
  }

  const pushEntity = (name?: string, role?: string) => {
    const cleanName = sanitizeCharacterName(name || '');
    if (!cleanName || isChatOrNonPersonDescription(role)) return;
    const key = normalizeTextForCompare(cleanName);
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    const cleanRole = truncateClean(
      sanitizeNpcFieldText('role', role || ''),
      32,
    );
    entityLabels.push(cleanRole ? `${cleanName} (${cleanRole})` : cleanName);
  };

  if (Array.isArray(portraits) && portraits.length > 0) {
    const ranked = portraits
      .map((p) => {
        const { tier } = resolvePortraitRoleTier(p);
        const score =
          (p.pinned ? 10 : 0) +
          (tier === 'main' ? 6 : tier === 'npc' ? 3 : -5) +
          (p.isMc ? 4 : 0) +
          (typeof p.lastSeenTurnIndex === 'number' ? 1 : 0);
        return { p, tier, score };
      })
      .filter((item) => item.tier !== 'mob' && !item.p.isMc)
      .sort((a, b) => b.score - a.score);

    for (const item of ranked) {
      if (entityLabels.length >= 6) break;
      pushEntity(item.p.name, item.p.role);
    }
  }

  if (entityLabels.length < 6 && companion?.npcs?.length) {
    for (const npc of companion.npcs) {
      if (entityLabels.length >= 6) break;
      pushEntity(npc.name, npc.role);
    }
  }

  if (entityLabels.length < 6 && memory?.characterStates?.length) {
    for (const st of memory.characterStates) {
      if (entityLabels.length >= 6) break;
      pushEntity(st.name, st.location);
    }
  }

  if (entityLabels.length > 0) {
    parts.push(`Nhân vật chủ chốt: ${entityLabels.join(', ')}.`);
  }

  // Current active locations from state tracker
  if (memory?.characterStates?.length) {
    const locations: string[] = [];
    const seenLocs = new Set<string>();
    for (const st of memory.characterStates) {
      const loc = (st.location || '').trim();
      const key = normalizeTextForCompare(loc);
      if (!loc || !key || seenLocs.has(key)) continue;
      seenLocs.add(key);
      locations.push(truncateClean(loc, 45));
      if (locations.length >= 3) break;
    }
    if (locations.length > 0 && parts.join(' ').length < 440) {
      parts.push(`Địa điểm hiện tại: ${locations.join('; ')}.`);
    }
  }

  // Key pinned / high-importance memory or rolling summary hook when setting is sparse
  const rollingText = memory?.rollingSummary?.content?.trim() || '';
  if (!setting && rollingText) {
    parts.push(`Tình hình hiện tại: ${truncateClean(rollingText, 160)}`);
  } else if (memory?.entries?.length && parts.join(' ').length < 480) {
    const keyMem = memory.entries.find(
      (e) => e.pinned || (e.importance && e.importance >= 3),
    );
    if (keyMem) {
      parts.push(
        `Mốc đáng chú ý: ${truncateClean(keyMem.title || keyMem.content, 110)}.`,
      );
    }
  }

  if (compNote && parts.join(' ').length < 520) {
    parts.push(`Lưu ý: ${truncateClean(compNote, 120)}`);
  }

  if (parts.length === 0) {
    const turnCue = extractFallbackCueFromTurns(turns);
    if (turnCue) {
      parts.push(`Mạch truyện đang mở (${turns?.length || 0} lượt): ${turnCue}`);
    }
  }

  return truncateClean(parts.join(' '), 680);
}

export interface ResolveTransitionContextParams extends BuildEntitiesNoteParams {
  currentContext: ContextConfig;
  incomingContext?: Partial<ContextConfig> | null;
}

export function resolveContextForTransition(
  params: ResolveTransitionContextParams,
): { context: ContextConfig; autoUpdated: boolean } {
  const { currentContext, incomingContext } = params;
  const baseNormalized = normalizeContextConfig(incomingContext, currentContext);

  const hasExplicitCustomNote = Boolean(
    incomingContext &&
      typeof incomingContext.entitiesNote === 'string' &&
      incomingContext.entitiesNote.trim().length > 0 &&
      !isGenericEntitiesNote(incomingContext.entitiesNote),
  );

  if (hasExplicitCustomNote) {
    return {
      context: {
        ...baseNormalized,
        entitiesNote: (incomingContext?.entitiesNote || '').trim(),
      },
      autoUpdated: false,
    };
  }

  const suggested = buildSuggestedEntitiesNote(params);
  if (suggested) {
    return {
      context: {
        ...baseNormalized,
        entitiesNote: suggested,
      },
      autoUpdated: true,
    };
  }

  return {
    context: {
      ...baseNormalized,
      entitiesNote: DEFAULT_GENERIC_ENTITIES_NOTE,
    },
    autoUpdated: !isGenericEntitiesNote(currentContext.entitiesNote),
  };
}

function tokenizeSignificantWords(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'gioi', 'boi', 'canh', 'nhan', 'vat', 'chinh', 'khong', 'khi',
    'quy', 'tac', 'chu', 'chot', 'dia', 'diem', 'hien', 'tai', 'luu', 'va',
    'cua', 'cho', 'voi', 'trong', 'mot', 'cac', 'nay', 'khi', 'tu', 'xung',
    'ho', 'ai', 'ngu', 'canh', 'nguoi', 'dung', 'mach', 'truyen', 'dang', 'mo',
  ]);
  const tokens = normalizeTextForCompare(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !stopWords.has(w));
  return new Set(tokens);
}

export function detectEntitiesNoteMismatch(
  currentNote: string,
  suggestedNote: string,
  params: Pick<
    BuildEntitiesNoteParams,
    'world' | 'player' | 'companion' | 'portraits'
  >,
): { isMismatched: boolean; reason: string } {
  const cleanSuggested = (suggestedNote || '').trim();
  if (!cleanSuggested) {
    return { isMismatched: false, reason: '' };
  }

  const cleanCurrent = (currentNote || '').trim();
  if (isGenericEntitiesNote(cleanCurrent)) {
    return {
      isMismatched: true,
      reason:
        'Ghi chú đang dùng mẫu mặc định chung, chưa khớp với bối cảnh/save đang mở.',
    };
  }

  const normCurrent = normalizeTextForCompare(cleanCurrent);
  const normSuggested = normalizeTextForCompare(cleanSuggested);
  if (normCurrent === normSuggested) {
    return { isMismatched: false, reason: '' };
  }

  const worldName =
    (isMeaningfulWorldName(params.world?.name) ? params.world?.name : '') ||
    (isMeaningfulWorldName(params.companion?.name)
      ? params.companion?.name
      : '') ||
    '';
  const normWorldName = normalizeTextForCompare(worldName);

  const activeAnchors: string[] = [];
  if (params.player?.name?.trim()) {
    activeAnchors.push(normalizeTextForCompare(params.player.name));
  }
  if (Array.isArray(params.portraits)) {
    for (const p of params.portraits) {
      const { tier } = resolvePortraitRoleTier(p);
      if (tier === 'main' || p.pinned) {
        const key = normalizeTextForCompare(p.name);
        if (key && key.length >= 2 && !activeAnchors.includes(key)) {
          activeAnchors.push(key);
        }
      }
      if (activeAnchors.length >= 5) break;
    }
  }

  const matchedAnchorCount = activeAnchors.filter(
    (anchor) => anchor.length >= 2 && normCurrent.includes(anchor),
  ).length;

  const currentTokens = tokenizeSignificantWords(cleanCurrent);
  const suggestedTokens = tokenizeSignificantWords(cleanSuggested);
  let overlapCount = 0;
  for (const token of suggestedTokens) {
    if (currentTokens.has(token)) overlapCount += 1;
  }
  const overlapRatio =
    suggestedTokens.size > 0 ? overlapCount / suggestedTokens.size : 1;

  if (
    normWorldName &&
    !normCurrent.includes(normWorldName) &&
    (matchedAnchorCount === 0 || overlapRatio < 0.22)
  ) {
    return {
      isMismatched: true,
      reason: `Ghi chú hiện tại chưa đề cập thế giới "${worldName.trim()}" và có thể thuộc phiên/save cũ.`,
    };
  }

  if (
    activeAnchors.length >= 2 &&
    matchedAnchorCount === 0 &&
    overlapRatio < 0.16
  ) {
    return {
      isMismatched: true,
      reason:
        'Ghi chú hiện tại không trùng khớp với nhân vật/thực thể chính trong save đang mở.',
    };
  }

  return { isMismatched: false, reason: '' };
}
