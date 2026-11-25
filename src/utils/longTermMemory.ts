import type {
  CharacterStateSnapshot,
  MemoryEntry,
  MemoryEntryCategory,
  MemoryEntrySource,
  MemoryImportance,
  MemoryManagerConfig,
} from '../types/ark';
import {
  cleanAndDeduplicateCharacterStates,
  normalizeCharacterKey,
} from './characterUtils';

export const MAX_LONG_TERM_ENTRIES = 60;
export const MAX_PINNED_ENTRIES = 24;
export const MAX_CHARACTER_STATES = 24;
export const MAX_ROLLING_SUMMARY_CHARS = 2400;
export const MAX_ENTRY_TITLE_CHARS = 88;
export const MAX_ENTRY_CONTENT_CHARS = 260;
export const MAX_ENTITIES_PER_ENTRY = 6;
export const MAX_KEYWORDS_PER_ENTRY = 8;

export const MEMORY_CATEGORY_LABELS: Record<MemoryEntryCategory, string> = {
  event: 'Sự kiện',
  relationship: 'Quan hệ',
  promise: 'Lời hứa / Bí mật',
  timeline: 'Mốc thời gian',
  detail: 'Chi tiết cốt lõi',
};

const STOP_WORDS = new Set([
  'cua', 'nhung', 'trong', 'duoc', 'mot', 'nguoi', 'voi', 'nhung', 'rang',
  'dang', 'cung', 'van', 'nay', 'kia', 'han', 'nang', 'co', 'anh', 'toi',
  'ta', 'nguoi', 'chang', 'chi', 'vao', 'ra', 'len', 'xuong', 'tren', 'duoi',
  'giua', 'nhu', 'khi', 'luc', 'sau', 'truoc', 'da', 'se', 'bang', 'tu',
  'den', 've', 'lai', 'thi', 'ma', 'boi', 'vi', 'neu', 'tuy', 'rat', 'qua',
  'that', 'khe', 'nhe', 'lang', 'buoc', 'nhin', 'noi', 'cuoi', 'tieng',
  'anh', 'mat', 'tay', 'gio', 'dem', 'troi', 'long', 'hoi', 'tho', 'dung',
  'ngoi', 'quay', 'nghe', 'thay', 'biet', 'muon', 'phai', 'con', 'deu',
  'chua', 'tung', 'theo', 'noi', 'ben', 'ngoai', 'cua', 'chiec', 'khong',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'about',
  'trang', 'luot', 'truyen', 'canh', 'hien', 'tai', 'vua', 'moi', 'hay',
  'hoac', 'day', 'kia', 'nen', 'cu', 'chang', 'dung', 'nua', 'roi', 'xong',
  'cho', 'de', 'lam', 'di', 'toi', 'mot', 'hai', 'ba', 'bon', 'nam', 'nhieu',
]);

export function normalizeMemoryTextKey(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimClean(text: string, maxLen: number): string {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen);
  const lastPunct = Math.max(
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('; '),
    sliced.lastIndexOf('! '),
    sliced.lastIndexOf('? '),
    sliced.lastIndexOf(', '),
  );
  if (lastPunct >= Math.floor(maxLen * 0.58)) {
    return sliced.slice(0, lastPunct + 1).trim();
  }
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace >= Math.floor(maxLen * 0.65)
    ? sliced.slice(0, lastSpace)
    : sliced
  ).trim();
}

function tokenizeKeywords(text: string): string[] {
  const norm = normalizeMemoryTextKey(text);
  if (!norm) return [];
  const rawTokens = norm.split(' ');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tok of rawTokens) {
    if (tok.length < 3 || STOP_WORDS.has(tok) || /^\d+$/.test(tok)) continue;
    if (!seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

export function extractMemoryKeywords(
  title: string,
  content: string,
  entities?: string[],
): string[] {
  const combined = [title, content, ...(entities || [])].join(' ');
  return tokenizeKeywords(combined).slice(0, MAX_KEYWORDS_PER_ENTRY);
}

export function sanitizeEntityList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const clean = String(item || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
    if (clean.length < 2) continue;
    const key = normalizeCharacterKey(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= MAX_ENTITIES_PER_ENTRY) break;
  }
  return result;
}

export function detectMentionedEntities(
  text: string,
  knownNames: string[],
): string[] {
  const normText = ` ${normalizeMemoryTextKey(text)} `;
  if (normText.trim().length < 2) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const rawName of knownNames) {
    const clean = (rawName || '').trim();
    if (clean.length < 2) continue;
    const key = normalizeCharacterKey(clean);
    if (!key || seen.has(key)) continue;
    const normName = normalizeMemoryTextKey(clean);
    if (!normName || normName.length < 2) continue;
    if (normText.includes(` ${normName} `)) {
      seen.add(key);
      found.push(clean);
      if (found.length >= MAX_ENTITIES_PER_ENTRY) break;
    }
  }
  return found;
}

export function sanitizeMemoryEntry(
  entry: MemoryEntry,
  knownNames: string[] = [],
): MemoryEntry {
  const title = trimClean(
    entry.title || entry.content.slice(0, 52) || 'Ký ức',
    MAX_ENTRY_TITLE_CHARS,
  );
  const content = trimClean(
    entry.content || entry.title || '',
    MAX_ENTRY_CONTENT_CHARS,
  );
  const validCategories = new Set<MemoryEntryCategory>([
    'event',
    'relationship',
    'promise',
    'timeline',
    'detail',
  ]);
  const category: MemoryEntryCategory = validCategories.has(entry.category)
    ? entry.category
    : 'event';

  const baseEntities = sanitizeEntityList(entry.entities);
  const inferredEntities = knownNames.length
    ? detectMentionedEntities(`${title} ${content}`, knownNames)
    : [];
  const mergedEntities = sanitizeEntityList([
    ...baseEntities,
    ...inferredEntities,
  ]);

  const rawImp = entry.importance;
  const importance: MemoryImportance =
    rawImp === 1 || rawImp === 2 || rawImp === 3
      ? rawImp
      : category === 'promise' || category === 'relationship'
        ? 3
        : category === 'event'
          ? 2
          : 1;

  const keywords =
    Array.isArray(entry.keywords) && entry.keywords.length > 0
      ? entry.keywords
          .map((k) => normalizeMemoryTextKey(k))
          .filter((k) => k.length >= 2)
          .slice(0, MAX_KEYWORDS_PER_ENTRY)
      : extractMemoryKeywords(title, content, mergedEntities);

  const validSources = new Set<MemoryEntrySource>([
    'ai',
    'local',
    'manual',
    'compacted',
  ]);

  return {
    id: entry.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    content,
    category,
    ...(typeof entry.turnIndex === 'number' && Number.isFinite(entry.turnIndex)
      ? { turnIndex: Math.max(0, Math.floor(entry.turnIndex)) }
      : {}),
    pinned: Boolean(entry.pinned),
    ...(mergedEntities.length ? { entities: mergedEntities } : {}),
    importance,
    ...(keywords.length ? { keywords } : {}),
    ...(entry.source && validSources.has(entry.source)
      ? { source: entry.source }
      : {}),
    updatedAt:
      typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
        ? entry.updatedAt
        : Date.now(),
  };
}

interface HeuristicSignalRule {
  category: MemoryEntryCategory;
  importance: MemoryImportance;
  titlePrefix: string;
  pattern: RegExp;
}

const LOCAL_MEMORY_SIGNAL_RULES: HeuristicSignalRule[] = [
  {
    category: 'promise',
    importance: 3,
    titlePrefix: 'Lời hứa / Bí mật',
    pattern:
      /(?:\b(?:hứa|lời\s+hứa|thề|lời\s+thề|ước\s+hẹn|giao\s+ước|mật\s+ước|cam\s+kết|đừng\s+nói\s+với\s+ai|giữ\s+bí\s+mật|bí\s+mật|thân\s+phận\s+thật|sự\s+thật\s+đằng\s+sau|che\s+giấu|nợ\s+ân\s+tình|hẹn\s+gặp\s+lại|giao\s+kèo)\b)/i,
  },
  {
    category: 'relationship',
    importance: 3,
    titlePrefix: 'Mốc quan hệ',
    pattern:
      /(?:\b(?:tỏ\s+tình|đính\s+ước|cầu\s+hôn|kết\s+nghĩa|bái\s+sư|nhận\s+đệ\s+tử|phản\s+bội|trở\s+mặt|từ\s+mặt|hòa\s+giải|tha\s+thứ|kết\s+đồng\s+minh|liên\s+minh|thù\s+địch|thừa\s+nhận\s+tình\s+cảm|chính\s+thức\s+(?:yêu|hẹn\s+hò|chia\s+tay))\b)/i,
  },
  {
    category: 'event',
    importance: 2,
    titlePrefix: 'Sự kiện',
    pattern:
      /(?:\b(?:đột\s+phá|phát\s+hiện\s+ra|bị\s+phục\s+kích|bị\s+bắt\s+cóc|đánh\s+bại|ký\s+kết|nhận\s+nhiệm\s+vụ|lên\s+đường\s+(?:đến|tới)|trọng\s+thương|mất\s+tích|tuyên\s+chiến|vén\s+màn|chiếm\s+được|phá\s+hủy)\b)/i,
  },
  {
    category: 'detail',
    importance: 2,
    titlePrefix: 'Chi tiết then chốt',
    pattern:
      /(?:\b(?:trao\s+cho|tặng\s+lại|giao\s+lại|tín\s+vật|chìa\s+khóa|mật\s+thư|bản\s+đồ\s+cổ|di\s+vật|mật\s+mã|dấu\s+ấn|lời\s+nguyền|nhật\s+ký\s+cũ)\b)/i,
  },
];

/**
 * Lightweight deterministic extractor that captures promises, secrets,
 * relationship milestones, and key plot details locally right after a turn
 * completes — ensuring long-term continuity even offline or before AI sync.
 */
export function extractLocalLongTermMemories(params: {
  userText: string;
  assistantText: string;
  turnIndex: number;
  knownCharacterNames: string[];
}): Omit<MemoryEntry, 'id' | 'pinned' | 'updatedAt'>[] {
  const { userText, assistantText, turnIndex, knownCharacterNames } = params;
  const combined = [assistantText, userText]
    .filter(Boolean)
    .join('\n')
    .replace(/\r?\n+/g, ' ')
    .trim();

  if (combined.length < 30) return [];

  const sentences = combined
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 24 && s.length <= 360);

  if (!sentences.length) return [];

  interface ScoredCandidate {
    rule: HeuristicSignalRule;
    sentence: string;
    entities: string[];
    score: number;
  }

  const scored: ScoredCandidate[] = [];
  for (const sentence of sentences) {
    for (const rule of LOCAL_MEMORY_SIGNAL_RULES) {
      if (!rule.pattern.test(sentence)) continue;
      const entities = detectMentionedEntities(sentence, knownCharacterNames);
      let score = rule.importance * 12 + entities.length * 10;
      if (sentence.length >= 45 && sentence.length <= 210) score += 6;
      if (/[“”"]/.test(sentence) && rule.category === 'promise') score += 8;
      scored.push({ rule, sentence, entities, score });
      break;
    }
  }

  if (!scored.length) return [];

  scored.sort((a, b) => b.score - a.score);

  const picked: Omit<MemoryEntry, 'id' | 'pinned' | 'updatedAt'>[] = [];
  const usedCategories = new Set<MemoryEntryCategory>();

  for (const item of scored) {
    if (picked.length >= 2) break;
    // Prefer diverse categories within the same turn
    if (usedCategories.has(item.rule.category) && scored.length > 2) continue;
    usedCategories.add(item.rule.category);

    const entityLead = item.entities.length
      ? item.entities.slice(0, 2).join(' & ')
      : '';
    const title = trimClean(
      entityLead
        ? `${item.rule.titlePrefix}: ${entityLead}`
        : `${item.rule.titlePrefix} (Trang ${turnIndex + 1})`,
      MAX_ENTRY_TITLE_CHARS,
    );
    const content = trimClean(item.sentence, MAX_ENTRY_CONTENT_CHARS);
    const keywords = extractMemoryKeywords(title, content, item.entities);

    picked.push({
      title,
      content,
      category: item.rule.category,
      turnIndex,
      ...(item.entities.length ? { entities: item.entities } : {}),
      importance: item.rule.importance,
      ...(keywords.length ? { keywords } : {}),
      source: 'local',
    });
  }

  return picked;
}

function tokenJaccardSimilarity(aTokens: string[], bTokens: string[]): number {
  if (!aTokens.length || !bTokens.length) return 0;
  const setA = new Set(aTokens);
  const setB = new Set(bTokens);
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

function areEntriesDuplicateOrOverlapping(
  existing: MemoryEntry,
  incoming: MemoryEntry,
): boolean {
  const titleA = normalizeMemoryTextKey(existing.title);
  const titleB = normalizeMemoryTextKey(incoming.title);
  if (titleA && titleB && titleA === titleB) return true;

  const contentA = normalizeMemoryTextKey(existing.content);
  const contentB = normalizeMemoryTextKey(incoming.content);
  if (contentA && contentB) {
    if (contentA === contentB) return true;
    if (
      contentA.length >= 28 &&
      contentB.length >= 28 &&
      (contentA.includes(contentB) || contentB.includes(contentA))
    ) {
      return true;
    }
  }

  // AI extraction for the same turn upgrades a local heuristic entry of the same category
  if (
    existing.source === 'local' &&
    incoming.source === 'ai' &&
    existing.turnIndex !== undefined &&
    existing.turnIndex === incoming.turnIndex &&
    existing.category === incoming.category
  ) {
    return true;
  }

  const tokensA = tokenizeKeywords(`${existing.title} ${existing.content}`);
  const tokensB = tokenizeKeywords(`${incoming.title} ${incoming.content}`);
  const sim = tokenJaccardSimilarity(tokensA, tokensB);
  if (sim >= 0.62) return true;
  if (existing.category === incoming.category && sim >= 0.48) return true;

  return false;
}

export function mergeMemoryEntries(
  existingEntries: MemoryEntry[],
  incomingItems: Array<Omit<MemoryEntry, 'id' | 'pinned' | 'updatedAt'> & Partial<Pick<MemoryEntry, 'id' | 'pinned' | 'updatedAt'>>>,
  knownNames: string[] = [],
): MemoryEntry[] {
  const nowTs = Date.now();
  const next = existingEntries.map((e) => sanitizeMemoryEntry(e, knownNames));

  for (let i = 0; i < incomingItems.length; i += 1) {
    const raw = incomingItems[i];
    const candidate = sanitizeMemoryEntry(
      {
        id:
          raw.id ||
          `mem_${nowTs}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        title: raw.title,
        content: raw.content,
        category: raw.category,
        turnIndex: raw.turnIndex,
        pinned: Boolean(raw.pinned),
        entities: raw.entities,
        importance: raw.importance,
        keywords: raw.keywords,
        source: raw.source,
        updatedAt: raw.updatedAt || nowTs + i,
      },
      knownNames,
    );
    if (!candidate.title && !candidate.content) continue;

    const existingIdx = next.findIndex((e) =>
      areEntriesDuplicateOrOverlapping(e, candidate),
    );
    if (existingIdx >= 0) {
      const cur = next[existingIdx];
      // Do not let a local heuristic overwrite a manual or AI-curated memory
      if (
        candidate.source === 'local' &&
        (cur.source === 'manual' || cur.source === 'ai')
      ) {
        continue;
      }
      const mergedEntities = sanitizeEntityList([
        ...(cur.entities || []),
        ...(candidate.entities || []),
      ]);
      const mergedImp = Math.max(
        cur.importance || 1,
        candidate.importance || 1,
      ) as MemoryImportance;
      const preferCandidateText =
        candidate.source === 'manual' ||
        candidate.source === 'ai' ||
        candidate.content.length >= cur.content.length;
      const mergedTitle = preferCandidateText
        ? candidate.title || cur.title
        : cur.title;
      const mergedContent = preferCandidateText
        ? candidate.content || cur.content
        : cur.content;

      next[existingIdx] = sanitizeMemoryEntry(
        {
          ...cur,
          title: mergedTitle,
          content: mergedContent,
          category: candidate.category || cur.category,
          turnIndex: candidate.turnIndex ?? cur.turnIndex,
          pinned: cur.pinned || candidate.pinned,
          entities: mergedEntities,
          importance: mergedImp,
          source:
            cur.source === 'manual'
              ? 'manual'
              : candidate.source || cur.source,
          updatedAt: Math.max(cur.updatedAt || 0, candidate.updatedAt || nowTs),
        },
        knownNames,
      );
    } else {
      next.unshift(candidate);
    }
  }

  return next;
}

export function estimateMemoryFootprintBytes(
  memory: MemoryManagerConfig | undefined,
): number {
  if (!memory) return 0;
  try {
    return JSON.stringify(memory).length;
  } catch {
    return 0;
  }
}

export interface MemoryCompactionResult {
  memory: MemoryManagerConfig;
  removedDuplicates: number;
  compactedCount: number;
  prunedStates: number;
  savedBytes: number;
}

/**
 * Enforces strict storage/RAM budgets on Long-Term Memory:
 * - Trims oversized fields & deduplicates overlapping entries
 * - Caps character states to MAX_CHARACTER_STATES (always keeping MC)
 * - Caps entries to MAX_LONG_TERM_ENTRIES while folding overflowed old low-priority
 *   entries into a compact archived milestone digest so story continuity isn't lost.
 */
export function compactLongTermMemory(
  memory: MemoryManagerConfig,
  knownNames: string[] = [],
): MemoryCompactionResult {
  const beforeBytes = estimateMemoryFootprintBytes(memory);
  const rawEntries = Array.isArray(memory.entries) ? memory.entries : [];

  // 1. Deduplicate and sanitize all entries (newest/manual/pinned first)
  const sortedRaw = [...rawEntries].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const impDiff = (b.importance || 1) - (a.importance || 1);
    if (impDiff !== 0) return impDiff;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const deduped: MemoryEntry[] = [];
  let removedDuplicates = 0;
  for (const raw of sortedRaw) {
    const clean = sanitizeMemoryEntry(raw, knownNames);
    if (!clean.title && !clean.content) {
      removedDuplicates += 1;
      continue;
    }
    const dupIdx = deduped.findIndex((e) =>
      areEntriesDuplicateOrOverlapping(e, clean),
    );
    if (dupIdx >= 0) {
      removedDuplicates += 1;
      const cur = deduped[dupIdx];
      deduped[dupIdx] = sanitizeMemoryEntry(
        {
          ...cur,
          pinned: cur.pinned || clean.pinned,
          importance: Math.max(
            cur.importance || 1,
            clean.importance || 1,
          ) as MemoryImportance,
          entities: sanitizeEntityList([
            ...(cur.entities || []),
            ...(clean.entities || []),
          ]),
          updatedAt: Math.max(cur.updatedAt || 0, clean.updatedAt || 0),
        },
        knownNames,
      );
    } else {
      deduped.push(clean);
    }
  }

  // 2. Enforce entry cap with archive compaction for overflow
  const pinnedEntries = deduped
    .filter((e) => e.pinned)
    .slice(0, MAX_PINNED_ENTRIES);
  const pinnedIds = new Set(pinnedEntries.map((e) => e.id));
  const unpinnedEntries = deduped.filter((e) => !pinnedIds.has(e.id));

  const maxUnpinned = Math.max(0, MAX_LONG_TERM_ENTRIES - pinnedEntries.length);
  let finalEntries = [...pinnedEntries, ...unpinnedEntries];
  let compactedCount = 0;
  let nextSummaryContent = (memory.rollingSummary?.content || '').trim();

  if (unpinnedEntries.length > maxUnpinned) {
    // Score unpinned entries to retain the most important & freshest milestones
    const scoredUnpinned = unpinnedEntries.map((e, idx) => {
      const catBonus =
        e.category === 'promise'
          ? 16
          : e.category === 'relationship'
            ? 12
            : e.category === 'event'
              ? 8
              : 4;
      const impBonus = (e.importance || 1) * 14;
      const recencyBonus = Math.max(0, 20 - idx * 0.4);
      const sourceBonus = e.source === 'manual' ? 18 : e.source === 'ai' ? 6 : 0;
      return {
        entry: e,
        score: catBonus + impBonus + recencyBonus + sourceBonus,
      };
    });

    scoredUnpinned.sort((a, b) => b.score - a.score);

    const keepBudget = Math.max(0, maxUnpinned - 1); // reserve 1 slot for compact archive digest if needed
    const keptUnpinned = scoredUnpinned.slice(0, keepBudget).map((s) => s.entry);
    const overflow = scoredUnpinned.slice(keepBudget).map((s) => s.entry);
    compactedCount = overflow.length;

    // Fold top overflowed milestones into a compact archive digest
    const digestSnippets = overflow
      .filter((e) => e.source !== 'compacted')
      .slice(0, 4)
      .map((e) => {
        const tag =
          e.turnIndex !== undefined ? `T${e.turnIndex + 1}` : '';
        return `${tag ? `[${tag}] ` : ''}${trimClean(e.title, 36)}`;
      })
      .filter(Boolean);

    const existingArchive = keptUnpinned.find((e) => e.source === 'compacted');
    if (digestSnippets.length > 0 && !existingArchive) {
      const archiveContent = trimClean(
        `Các mốc cũ đã nén gọn: ${digestSnippets.join('; ')}.`,
        MAX_ENTRY_CONTENT_CHARS,
      );
      const archiveEntities = sanitizeEntityList(
        overflow.flatMap((e) => e.entities || []),
      );
      keptUnpinned.push(
        sanitizeMemoryEntry(
          {
            id: `mem_archive_${Date.now()}`,
            title: 'Lưu trữ nén ký ức cũ',
            content: archiveContent,
            category: 'timeline',
            pinned: false,
            entities: archiveEntities,
            importance: 1,
            source: 'compacted',
            updatedAt: Date.now(),
          },
          knownNames,
        ),
      );
    }

    finalEntries = [...pinnedEntries, ...keptUnpinned];
  }

  // 3. Enforce rolling summary char budget cleanly
  if (nextSummaryContent.length > MAX_ROLLING_SUMMARY_CHARS) {
    // Keep the beginning anchor and the latest section so old + recent arcs remain coherent
    const headLen = Math.floor(MAX_ROLLING_SUMMARY_CHARS * 0.35);
    const tailLen = MAX_ROLLING_SUMMARY_CHARS - headLen - 12;
    const head = trimClean(nextSummaryContent.slice(0, headLen), headLen);
    const tail = nextSummaryContent.slice(-tailLen).trim();
    nextSummaryContent = `${head}\n[...]\n${tail}`;
  }

  // 4. Sanitize, deduplicate (including real-name/stage-name aliases) & enforce character states budget
  const rawStates = Array.isArray(memory.characterStates)
    ? memory.characterStates
    : [];
  const { states: cleanedStates } = cleanAndDeduplicateCharacterStates(
    rawStates,
    { knownValidNames: knownNames },
  );
  const dedupedStates = cleanedStates
    .map((st) => ({
      ...st,
      location: trimClean(st.location || '', 90),
      mood: trimClean(st.mood || '', 72),
      status: trimClean(st.status || '', 140),
    }))
    .sort((a, b) => {
      if (a.isMc !== b.isMc) return a.isMc ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  const nextStates = dedupedStates.slice(0, MAX_CHARACTER_STATES);
  const prunedStates = Math.max(0, rawStates.length - nextStates.length);

  const nextMemory: MemoryManagerConfig = {
    ...memory,
    entries: finalEntries,
    characterStates: nextStates,
    rollingSummary: {
      ...memory.rollingSummary,
      content: nextSummaryContent,
    },
  };

  const afterBytes = estimateMemoryFootprintBytes(nextMemory);
  return {
    memory: nextMemory,
    removedDuplicates,
    compactedCount,
    prunedStates,
    savedBytes: Math.max(0, beforeBytes - afterBytes),
  };
}

export interface RetrievedLongTermMemory {
  entry: MemoryEntry;
  score: number;
  matchedEntities: string[];
}

export function retrieveRelevantLongTermMemories(params: {
  memory: MemoryManagerConfig | undefined;
  activeCharacterNames?: string[];
  sceneText?: string;
  locationHints?: string[];
  currentTurnIndex?: number;
  maxEntries?: number;
}): RetrievedLongTermMemory[] {
  const {
    memory,
    activeCharacterNames = [],
    sceneText = '',
    locationHints = [],
    currentTurnIndex = 0,
    maxEntries = 12,
  } = params;

  if (!memory || !Array.isArray(memory.entries) || memory.entries.length === 0) {
    return [];
  }

  const activeNameKeys = new Set<string>();
  const activeNormNames: string[] = [];
  for (const name of activeCharacterNames) {
    const clean = (name || '').trim();
    if (clean.length < 2) continue;
    const key = normalizeCharacterKey(clean);
    const norm = normalizeMemoryTextKey(clean);
    if (key) activeNameKeys.add(key);
    if (norm && norm.length >= 2) activeNormNames.push(norm);
  }

  const queryTokens = new Set<string>(
    tokenizeKeywords([sceneText, ...locationHints].join(' ')),
  );

  const scored: RetrievedLongTermMemory[] = [];

  for (const entry of memory.entries) {
    const entryNormText = ` ${normalizeMemoryTextKey(`${entry.title} ${entry.content}`)} `;
    const entryEntityKeys = (entry.entities || [])
      .map((e) => normalizeCharacterKey(e))
      .filter(Boolean);

    const matchedEntities: string[] = [];
    const matchedKeySet = new Set<string>();

    // 1. Direct entity match against characters currently present in the scene
    for (const rawEntity of entry.entities || []) {
      const ek = normalizeCharacterKey(rawEntity);
      if (!ek) continue;
      const isDirect =
        activeNameKeys.has(ek) ||
        Array.from(activeNameKeys).some(
          (ak) =>
            ak.length >= 3 &&
            ek.length >= 3 &&
            (ak.startsWith(`${ek} `) || ek.startsWith(`${ak} `)),
        );
      if (isDirect && !matchedKeySet.has(ek)) {
        matchedKeySet.add(ek);
        matchedEntities.push(rawEntity);
      }
    }

    // 2. Active character name appearing in memory title/content
    let textEntityHits = 0;
    for (let i = 0; i < activeCharacterNames.length; i += 1) {
      const rawName = activeCharacterNames[i];
      const normName = normalizeMemoryTextKey(rawName);
      const key = normalizeCharacterKey(rawName);
      if (!normName || normName.length < 2 || matchedKeySet.has(key)) continue;
      if (entryNormText.includes(` ${normName} `)) {
        textEntityHits += 1;
        matchedKeySet.add(key);
        matchedEntities.push(rawName);
      }
    }

    // 3. Keyword / location / topic overlap with current scene
    const entryKeywords =
      entry.keywords && entry.keywords.length > 0
        ? entry.keywords
        : tokenizeKeywords(`${entry.title} ${entry.content}`);
    let keywordHits = 0;
    for (const kw of entryKeywords) {
      if (queryTokens.has(kw)) keywordHits += 1;
    }

    // 4. Priority weights: promises/secrets & relationship milestones stay sticky
    const categoryWeight =
      entry.category === 'promise'
        ? 18
        : entry.category === 'relationship'
          ? 15
          : entry.category === 'event'
            ? 10
            : entry.category === 'timeline'
              ? 9
              : 6;
    const importanceWeight =
      entry.importance === 3 ? 16 : entry.importance === 2 ? 8 : 2;
    const pinWeight = entry.pinned ? 42 : 0;

    // 5. Gentle recency bonus so fresh memories remain warm without burying old relevant ones
    let recencyWeight = 4;
    if (typeof entry.turnIndex === 'number' && currentTurnIndex > 0) {
      const dist = Math.max(0, currentTurnIndex - entry.turnIndex);
      recencyWeight = Math.max(0, 12 - Math.min(12, Math.floor(dist / 3)));
    }

    // 6. Active-character + scene-topic/location synergy boost
    const synergyWeight =
      matchedEntities.length > 0 && keywordHits > 0 ? 16 : 0;

    let score =
      Math.min(96, matchedEntities.length * 44) +
      Math.min(48, textEntityHits * 12) +
      Math.min(40, keywordHits * 10) +
      categoryWeight +
      importanceWeight +
      pinWeight +
      recencyWeight +
      synergyWeight;

    // 7. Anti-dilution penalty: if an unpinned entry is explicitly bound to OTHER characters
    // who are NOT in this scene and shares zero scene keywords, push it down so context stays focused.
    if (
      !entry.pinned &&
      activeNameKeys.size > 0 &&
      entryEntityKeys.length > 0 &&
      matchedEntities.length === 0 &&
      keywordHits === 0
    ) {
      score -= 30;
    }

    scored.push({ entry, score, matchedEntities });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.entry.updatedAt || 0) - (a.entry.updatedAt || 0);
  });

  // Always include top-scoring entries; skip clearly irrelevant negatively scored items unless few exist
  const filtered = scored.filter(
    (s, idx) => s.entry.pinned || s.score > 10 || idx < 3,
  );
  if (filtered.length <= maxEntries) {
    return filtered;
  }

  // Lightweight O(N) category diversity balancing: keep top pinned/priority items,
  // while ensuring promises, relationships, core events, and character traits aren't
  // crowded out by repetitive low-importance entries.
  const selected: RetrievedLongTermMemory[] = [];
  const selectedIds = new Set<string>();
  const categoryCounts: Record<string, number> = {};
  const maxPerNonPinnedCategory = Math.max(3, Math.ceil(maxEntries * 0.45));

  for (const item of filtered) {
    if (selected.length >= maxEntries) break;
    const cat = item.entry.category || 'fact';
    const currentCount = categoryCounts[cat] || 0;
    if (!item.entry.pinned && currentCount >= maxPerNonPinnedCategory) {
      continue;
    }
    selected.push(item);
    selectedIds.add(item.entry.id);
    categoryCounts[cat] = currentCount + 1;
  }

  // Fill remaining slots by pure score if category cap left headroom
  if (selected.length < maxEntries) {
    for (const item of filtered) {
      if (selected.length >= maxEntries) break;
      if (selectedIds.has(item.entry.id)) continue;
      selected.push(item);
      selectedIds.add(item.entry.id);
    }
  }

  return selected;
}

export interface CoreCharacterTraitAnchor {
  name: string;
  role?: string;
  personality?: string;
  relationships?: string;
  locked?: boolean;
}

/**
 * Builds a concise, character-budgeted Long-Term Memory prompt block tailored
 * to the active scene's characters and context (used in both story turn generation
 * and AI turn suggestions).
 */
export function buildLongTermMemoryContextBlock(params: {
  memory: MemoryManagerConfig | undefined;
  activeCharacterNames?: string[];
  sceneText?: string;
  locationHints?: string[];
  currentTurnIndex?: number;
  maxEntries?: number;
  maxChars?: number;
  includeRollingSummary?: boolean;
  compactMode?: boolean;
  coreCharacterTraits?: CoreCharacterTraitAnchor[];
}): string {
  const {
    memory,
    activeCharacterNames = [],
    sceneText = '',
    locationHints = [],
    currentTurnIndex = 0,
    maxEntries = 12,
    maxChars = 1900,
    includeRollingSummary = true,
    compactMode = false,
    coreCharacterTraits = [],
  } = params;

  if (!memory || !memory.enabled) return '';

  const sections: string[] = [];
  let usedChars = 0;

  // 1. Compact Rolling Summary (Long-Term Arc)
  const rsText = (memory.rollingSummary?.content || '').trim();
  if (includeRollingSummary && rsText && (currentTurnIndex > 0 || compactMode)) {
    const upTo =
      currentTurnIndex > 0
        ? Math.min(currentTurnIndex, memory.rollingSummary.summarizedUpToTurn || 0)
        : memory.rollingSummary.summarizedUpToTurn || 0;
    const summaryCap = compactMode
      ? Math.min(420, Math.floor(maxChars * 0.42))
      : Math.min(900, Math.floor(maxChars * 0.44));
    const clippedRs = trimClean(rsText, summaryCap);
    const header = `[TÓM TẮT MẠCH TRUYỆN DÀI HẠN${upTo > 0 ? ` (Lượt 1–${upTo})` : ''}]`;
    const block = `${header}\n${clippedRs}`;
    sections.push(block);
    usedChars += block.length + 2;
  }

  // 2. Concise Core Character Traits & Relationship Anchor for active on-scene characters
  if (!compactMode && coreCharacterTraits.length > 0 && maxChars - usedChars >= 360) {
    const traitLines: string[] = [];
    const traitBudget = Math.min(440, Math.floor((maxChars - usedChars) * 0.32));
    let traitChars = 0;
    for (const item of coreCharacterTraits.slice(0, 4)) {
      const name = trimClean(item.name || '', 42);
      if (!name) continue;
      const details = [
        item.role ? trimClean(item.role, 36) : '',
        item.personality ? `Tính cách: ${trimClean(item.personality, 68)}` : '',
        item.relationships ? `Quan hệ: ${trimClean(item.relationships, 68)}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      if (!details) continue;
      const lockMark = item.locked ? ' [Khóa]' : '';
      const line = `- ${name}${lockMark}: ${details}`;
      if (traitChars + line.length + 1 > traitBudget && traitLines.length >= 1) {
        break;
      }
      traitLines.push(line);
      traitChars += line.length + 1;
    }
    if (traitLines.length > 0) {
      const block = `[ĐẶC ĐIỂM CỐT LÕI NHÂN VẬT ĐANG TƯƠNG TÁC]\n${traitLines.join('\n')}`;
      sections.push(block);
      usedChars += block.length + 2;
    }
  }

  // 3. Context-Targeted Long-Term Memories (Promises, Secrets, Relationships, Key Events)
  const retrieved = retrieveRelevantLongTermMemories({
    memory,
    activeCharacterNames,
    sceneText,
    locationHints,
    currentTurnIndex,
    maxEntries,
  });

  if (retrieved.length > 0) {
    const remainingBudget = Math.max(260, maxChars - usedChars);
    const header = compactMode
      ? '[TRÍ NHỚ DÀI HẠN LIÊN QUAN CẢNH HIỆN TẠI]'
      : '[TRÍ NHỚ DÀI HẠN LIÊN QUAN NHÂN VẬT & BỐI CẢNH HIỆN TẠI]';
    const guide = compactMode
      ? ''
      : '(Giữ nhất quán lời hứa, bí mật, mốc quan hệ và hệ quả sự kiện cũ dưới đây; chỉ gợi nhắc tự nhiên khi hợp mạch cảnh hiện tại, không nhồi nhét gượng ép.)';

    const lines: string[] = [];
    let linesChars = header.length + guide.length + 4;

    for (const { entry, matchedEntities } of retrieved) {
      const catLabel = MEMORY_CATEGORY_LABELS[entry.category] || 'Ký ức';
      const pageTag =
        typeof entry.turnIndex === 'number' ? ` · T${entry.turnIndex + 1}` : '';
      const pinTag = entry.pinned ? ' · Ghim' : '';
      const entityTag =
        matchedEntities.length > 0
          ? ` · NV: ${matchedEntities.slice(0, 3).join(', ')}`
          : entry.entities && entry.entities.length > 0
            ? ` · NV: ${entry.entities.slice(0, 2).join(', ')}`
            : '';
      const contentCap = compactMode ? 115 : 185;
      const snippet = trimClean(entry.content, contentCap);
      const line = `- (${catLabel}${pageTag}${pinTag}${entityTag}) ${entry.title}: ${snippet}`;
      if (linesChars + line.length + 1 > remainingBudget && lines.length >= 2) {
        break;
      }
      lines.push(line);
      linesChars += line.length + 1;
    }

    if (lines.length > 0) {
      sections.push(
        [header, guide, ...lines].filter(Boolean).join('\n'),
      );
    }
  }

  return sections.join('\n\n');
}
