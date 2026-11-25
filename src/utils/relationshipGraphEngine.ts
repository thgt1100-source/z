import type {
  CharacterPortrait,
  CharacterStateSnapshot,
  MemoryEntry,
  PortraitBankConfig,
  RelationshipEdgeOverride,
  RelationshipGroup,
  RelationshipGroupKind,
  RelationshipLayerKind,
  RelationshipTone,
} from '../types/ark';
import {
  isInvalidNpcState,
  normalizeCharacterKey,
  resolvePortraitRoleTier,
} from './characterUtils';

export type ClusterMode = 'layered' | 'faction' | 'role' | 'none';

export type LayerFilter = 'all' | RelationshipLayerKind;

export type ToneFilter =
  | 'all'
  | 'family'
  | 'intimate'
  | 'ally'
  | 'rival'
  | 'mystery'
  | 'neutral';

export interface GraphCluster {
  id: string;
  label: string;
  kind: RelationshipGroupKind | 'role' | 'auto';
  isCustom: boolean;
  customGroupId?: string;
  color: string;
  fill: string;
  pillClass: string;
  dotClass: string;
  memberIds: string[];
  anchorX: number;
  anchorY: number;
  collapsed?: boolean;
}

export interface GraphNode {
  id: string;
  portrait: CharacterPortrait;
  tier: 'main' | 'npc' | 'mob';
  tierLabel: string;
  detailLabel: string;
  badgeClass: string;
  dotClass: string;
  initialX: number;
  initialY: number;
  ringColor: string;
  fillBg: string;
  degree: number;
  clusterId: string;
  clusterLabel: string;
  customGroupIds: string[];
  isClusterHub?: boolean;
  collapsedMemberCount?: number;
  collapsedMemberNames?: string[];
  hubColor?: string;
  hubKind?: RelationshipGroupKind | 'role' | 'auto';
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  tone: RelationshipTone;
  layer: RelationshipLayerKind;
  label: string;
  reason: string;
  sourceKind:
    | 'manual'
    | 'custom_group'
    | 'relationships_tag'
    | 'memory'
    | 'role'
    | 'scene'
    | 'collapsed_summary';
  dashed: boolean;
  dashPattern?: string;
  strength: number;
  isManual?: boolean;
  aggregatedCount?: number;
}

export const SVG_WIDTH = 820;
export const SVG_HEIGHT = 510;
export const PAD_X = 62;
export const PAD_TOP = 54;
export const PAD_BOTTOM = 72;

export const GROUP_KIND_META: Record<
  RelationshipGroupKind,
  {
    label: string;
    shortLabel: string;
    defaultColor: string;
    layer: RelationshipLayerKind;
    description: string;
    badgeClass: string;
  }
> = {
  family: {
    label: 'Gia tộc / Huyết thống',
    shortLabel: 'Gia tộc',
    defaultColor: '#f59e0b',
    layer: 'family',
    description: 'Gia đình, huyết thống, họ hàng, nhà tộc',
    badgeClass:
      'bg-amber-500/16 text-amber-200 ring-1 ring-inset ring-amber-400/35',
  },
  close_circle: {
    label: 'Nhóm thân thiết / Bạn thân',
    shortLabel: 'Nhóm thân',
    defaultColor: '#34d399',
    layer: 'close_circle',
    description: 'Hội bạn thân, nhóm ruột thịt, ê-kíp thân cận',
    badgeClass:
      'bg-emerald-500/16 text-emerald-200 ring-1 ring-inset ring-emerald-400/35',
  },
  faction: {
    label: 'Phe phái / Băng nhóm / Tổ chức',
    shortLabel: 'Phe phái',
    defaultColor: '#38bdf8',
    layer: 'faction',
    description: 'Tổ chức, băng nhóm, hãng đĩa, tông môn, phe đối lập',
    badgeClass: 'bg-sky-500/16 text-sky-200 ring-1 ring-inset ring-sky-400/35',
  },
};

export const LAYER_META: Record<
  RelationshipLayerKind,
  {
    label: string;
    shortLabel: string;
    dotClass: string;
    pillClass: string;
  }
> = {
  family: {
    label: 'Gia tộc / Huyết thống',
    shortLabel: 'Gia tộc',
    dotClass: 'bg-amber-400',
    pillClass:
      'bg-amber-500/16 text-amber-200 ring-1 ring-inset ring-amber-400/35',
  },
  close_circle: {
    label: 'Nhóm thân thiết / Bạn thân',
    shortLabel: 'Nhóm thân',
    dotClass: 'bg-emerald-400',
    pillClass:
      'bg-emerald-500/16 text-emerald-200 ring-1 ring-inset ring-emerald-400/35',
  },
  faction: {
    label: 'Phe phái / Đối đầu',
    shortLabel: 'Phe phái & Đối đầu',
    dotClass: 'bg-red-400',
    pillClass: 'bg-red-500/16 text-red-200 ring-1 ring-inset ring-red-400/35',
  },
  personal: {
    label: 'Quan hệ cá nhân',
    shortLabel: 'Cá nhân',
    dotClass: 'bg-pink-400',
    pillClass:
      'bg-pink-500/16 text-pink-200 ring-1 ring-inset ring-pink-400/35',
  },
};

export const TONE_META: Record<
  RelationshipTone,
  {
    label: string;
    shortLabel: string;
    stroke: string;
    strokeWidth: number;
    dashPattern: string | null;
    lineStyleLabel: string;
    pillClass: string;
    dotClass: string;
    defaultLayer: RelationshipLayerKind;
  }
> = {
  family: {
    label: 'Gia tộc / Huyết thống',
    shortLabel: 'Gia tộc',
    stroke: '#f59e0b',
    strokeWidth: 2.4,
    dashPattern: null,
    lineStyleLabel: 'Nét liền vàng',
    pillClass:
      'bg-amber-500/16 text-amber-200 ring-1 ring-inset ring-amber-400/35',
    dotClass: 'bg-amber-400',
    defaultLayer: 'family',
  },
  intimate: {
    label: 'Thân mật / Tình cảm',
    shortLabel: 'Thân mật',
    stroke: '#f472b6',
    strokeWidth: 2.2,
    dashPattern: null,
    lineStyleLabel: 'Nét liền hồng',
    pillClass:
      'bg-pink-500/16 text-pink-200 ring-1 ring-inset ring-pink-400/35',
    dotClass: 'bg-pink-400',
    defaultLayer: 'personal',
  },
  ally: {
    label: 'Đồng minh / Bạn thân',
    shortLabel: 'Đồng minh',
    stroke: '#34d399',
    strokeWidth: 1.95,
    dashPattern: null,
    lineStyleLabel: 'Nét liền xanh',
    pillClass:
      'bg-emerald-500/16 text-emerald-200 ring-1 ring-inset ring-emerald-400/35',
    dotClass: 'bg-emerald-400',
    defaultLayer: 'close_circle',
  },
  rival: {
    label: 'Đối đầu / Xung đột',
    shortLabel: 'Đối đầu',
    stroke: '#ef4444',
    strokeWidth: 2.5,
    dashPattern: '8 4',
    lineStyleLabel: 'Nét đứt đỏ',
    pillClass: 'bg-red-500/18 text-red-200 ring-1 ring-inset ring-red-400/40',
    dotClass: 'bg-red-500',
    defaultLayer: 'faction',
  },
  mystery: {
    label: 'Bí ẩn / Khó đoán',
    shortLabel: 'Bí ẩn',
    stroke: '#a78bfa',
    strokeWidth: 1.8,
    dashPattern: '3 4',
    lineStyleLabel: 'Nét chấm tím',
    pillClass:
      'bg-violet-500/16 text-violet-200 ring-1 ring-inset ring-violet-400/35',
    dotClass: 'bg-violet-400',
    defaultLayer: 'personal',
  },
  neutral: {
    label: 'Cùng cảnh / Trung lập',
    shortLabel: 'Trung lập',
    stroke: '#64748b',
    strokeWidth: 1.25,
    dashPattern: '2 5',
    lineStyleLabel: 'Nét chấm mảnh xám',
    pillClass:
      'bg-slate-500/18 text-slate-300 ring-1 ring-inset ring-slate-400/30',
    dotClass: 'bg-slate-400',
    defaultLayer: 'personal',
  },
};

export const GROUP_COLOR_SWATCHES: Array<{
  hex: string;
  name: string;
  fill: string;
  pillClass: string;
  dotClass: string;
}> = [
  {
    hex: '#f59e0b',
    name: 'Vàng hổ phách',
    fill: 'rgba(245, 158, 11, 0.09)',
    pillClass:
      'bg-amber-500/16 text-amber-200 ring-1 ring-inset ring-amber-400/35',
    dotClass: 'bg-amber-400',
  },
  {
    hex: '#34d399',
    name: 'Xanh ngọc',
    fill: 'rgba(52, 211, 153, 0.09)',
    pillClass:
      'bg-emerald-500/16 text-emerald-200 ring-1 ring-inset ring-emerald-400/35',
    dotClass: 'bg-emerald-400',
  },
  {
    hex: '#38bdf8',
    name: 'Xanh dương',
    fill: 'rgba(56, 189, 248, 0.09)',
    pillClass: 'bg-sky-500/16 text-sky-200 ring-1 ring-inset ring-sky-400/35',
    dotClass: 'bg-sky-400',
  },
  {
    hex: '#ef4444',
    name: 'Đỏ đối đầu',
    fill: 'rgba(239, 68, 68, 0.09)',
    pillClass: 'bg-red-500/16 text-red-200 ring-1 ring-inset ring-red-400/35',
    dotClass: 'bg-red-400',
  },
  {
    hex: '#f472b6',
    name: 'Hồng phấn',
    fill: 'rgba(244, 114, 182, 0.09)',
    pillClass:
      'bg-pink-500/16 text-pink-200 ring-1 ring-inset ring-pink-400/35',
    dotClass: 'bg-pink-400',
  },
  {
    hex: '#a78bfa',
    name: 'Tím bí ẩn',
    fill: 'rgba(167, 139, 250, 0.09)',
    pillClass:
      'bg-violet-500/16 text-violet-200 ring-1 ring-inset ring-violet-400/35',
    dotClass: 'bg-violet-400',
  },
  {
    hex: '#fb923c',
    name: 'Cam rực',
    fill: 'rgba(251, 146, 60, 0.09)',
    pillClass:
      'bg-orange-500/16 text-orange-200 ring-1 ring-inset ring-orange-400/35',
    dotClass: 'bg-orange-400',
  },
  {
    hex: '#22d3ee',
    name: 'Xanh cyan',
    fill: 'rgba(34, 211, 238, 0.09)',
    pillClass:
      'bg-cyan-500/16 text-cyan-200 ring-1 ring-inset ring-cyan-400/35',
    dotClass: 'bg-cyan-400',
  },
];

export const QUICK_RELATION_PRESETS: Array<{
  label: string;
  tone: RelationshipTone;
  layer: RelationshipLayerKind;
}> = [
  { label: 'Gia đình / Người thân', tone: 'family', layer: 'family' },
  { label: 'Anh chị em', tone: 'family', layer: 'family' },
  { label: 'Thân mật / Người thương', tone: 'intimate', layer: 'personal' },
  { label: 'Bạn thân / Tri kỷ', tone: 'ally', layer: 'close_circle' },
  { label: 'Đồng minh / Hợp tác', tone: 'ally', layer: 'faction' },
  { label: 'Đối đầu / Xung đột', tone: 'rival', layer: 'faction' },
  { label: 'Kẻ thù / Thù địch', tone: 'rival', layer: 'faction' },
  { label: 'Đối thủ cạnh tranh', tone: 'rival', layer: 'faction' },
  { label: 'Đề phòng / Căng thẳng', tone: 'rival', layer: 'personal' },
  { label: 'Bí ẩn / Khó đoán', tone: 'mystery', layer: 'personal' },
  { label: 'Lạnh nhạt / Xã giao', tone: 'neutral', layer: 'personal' },
];

export function resolveSwatchForHex(hex?: string) {
  const clean = String(hex || '').trim().toLowerCase();
  const hit = GROUP_COLOR_SWATCHES.find((s) => s.hex.toLowerCase() === clean);
  if (hit) return hit;
  return {
    hex: clean && /^#[0-9a-f]{3,8}$/i.test(clean) ? clean : '#38bdf8',
    name: 'Tùy chỉnh',
    fill: 'rgba(56, 189, 248, 0.085)',
    pillClass: 'bg-sky-500/16 text-sky-200 ring-1 ring-inset ring-sky-400/35',
    dotClass: 'bg-sky-400',
  };
}

export function canonicalPairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}__${bId}` : `${bId}__${aId}`;
}

export function clampCoord(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getSearchTokensForName(name: string): string[] {
  const key = normalizeCharacterKey(name);
  if (!key) return [];
  const out = [key];
  const parts = key.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    if (parts[0].length >= 3) out.push(parts[0]);
    const last = parts[parts.length - 1];
    if (last.length >= 3 && !out.includes(last)) out.push(last);
  }
  return out;
}

export function textMentionsName(normText: string, tokens: string[]): boolean {
  if (!normText || !tokens.length) return false;
  return tokens.some((tok) => {
    const safeTok = String(tok ?? '');
    if (!safeTok) return false;
    if (safeTok.includes(' ')) return normText.includes(safeTok);
    const escaped = safeTok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(normText);
  });
}

export function splitRelationshipClauses(raw?: string): string[] {
  const clean = String(raw || '').trim();
  if (!clean) return [];
  return clean
    .split(
      /[;\n.!?·•|]+|,\s*(?=(?:#|\[|thân|đồng|đối|kẻ|bạn|người|yêu|ghét|đề|nghi|căng|hợp|gần|lạnh|xung|mâu|thù|cạnh|hòa|sư|chị|anh|em|với|cùng|phản|bí\s*ẩn|mập\s*mờ|lấn\s*át|gia\s*(?:đình|tộc)))/i,
    )
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);
}

// Strict hostility / conflict regex — ALWAYS evaluated BEFORE intimate/ally so conflict NEVER gets mislabeled as intimate!
export const CONFLICT_RELATION_RE =
  /(?:doi\s*dau|thu\s*dich|ke\s*thu|doi\s*thu|mau\s*thuan|xung\s*dot|cang\s*thang|canh\s*tranh|phan\s*dien|phan\s*boi|de\s*phong|nghi\s*ngo|cam\s*ghet|ghet\s*bo|ghet|ac\s*cam|va\s*cham|tranh\s*chap|cai\s*va|danh\s*nhau|doi\s*lap|uy\s*hiep|lan\s*at|am\s*muu|lanh\s*nhat|xa\s*cach|coi\s*thuong|khong\s*ua|khac\s*khau|han\s*hoc|chong\s*doi|tra\s*thu|bat\s*hoa|cach\s*mat|ran\s*nut|khieu\s*khich|tan\s*cong|chui\s*nhau|bat\s*dong|phe\s*doi\s*nghich|doi\s*nghich)/;

const FAMILY_RELATION_RE =
  /(?:gia\s*toc|gia\s*dinh|huyet\s*thong|ruot\s*thit|me\s*con|cha\s*con|bo\s*con|me\s*ruot|cha\s*ruot|bo\s*ruot|anh\s*em|chi\s*em|em\s*gai|em\s*trai|anh\s*trai|chi\s*gai|nguoi\s*than|ho\s*hang|nha\s*ho|con\s*gai|con\s*trai|co\s*chu|ong\s*ba|vo\s*chong|hon\s*phu|hon\s*the|chi\s*dau|anh\s*re|em\s*re|me\s*ke|bo\s*duong|kardashian|jenner)/;

const INTIMATE_RELATION_RE =
  /(?:nguoi\s*thuong|tinh\s*nhan|nguoi\s*yeu|yeu\s*tham|ai\s*mo|than\s*mat|au\s*yem|lang\s*man|rung\s*dong|cap\s*doi|ban\s*gai|ban\s*trai|hen\s*ho|tinh\s*cam\s*sau\s*dam|phai\s*long|si\s*me)/;

const MYSTERY_RELATION_RE =
  /(?:bi\s*an|kho\s*doan|map\s*mo|an\s*giau|noi\s*gian|hai\s*mat|nghi\s*van|an\s*so)/;

const CLOSE_CIRCLE_RELATION_RE =
  /(?:ban\s*than|tri\s*ky|hoi\s*ban|nhom\s*than|than\s*thiet|than\s*can|ban\s*cung\s*phong|gan\s*bo|quy\s*men|choi\s*than)/;

const ALLY_RELATION_RE =
  /(?:dong\s*minh|dong\s*mon|dong\s*doi|quan\s*ly|tro\s*ly|doi\s*tac|hop\s*tac|su\s*ton|truong\s*lao|ho\s*ve|thu\s*ha|tin\s*tuong|ung\s*ho|giup\s*do|hoa\s*nha|cung\s*phe|cung\s*nhom|ekip|e-kip)/;

export interface ClassifiedRelation {
  tone: RelationshipTone;
  layer: RelationshipLayerKind;
  shortLabel: string;
  hasConflictCue: boolean;
}

/**
 * Classifies a SPECIFIC relationship clause between two characters.
 * CRITICAL RULES:
 * 1. NEVER mixes unrelated role strings of third parties.
 * 2. Conflict / hostility ALWAYS overrides intimate / ally when both words appear.
 * 3. `allowIntimate` defaults to true ONLY for direct explicit relationship clauses;
 *    scene co-presence, snippets, and multi-person memories MUST pass `allowIntimate: false`.
 */
export function classifyClauseRelationTone(
  clauseText: string,
  options?: { allowIntimate?: boolean },
): ClassifiedRelation {
  const allowIntimate = options?.allowIntimate !== false;
  const norm = normalizeCharacterKey(clauseText || '');
  const bracketTag = String(clauseText || '').match(/\[([^\]]{2,22})\]/);
  const bracketClean =
    bracketTag?.[1] &&
    !/^(?:phe|tổ\s*chức|nhóm|gia\s*tộc|tông\s*môn|băng|hội)\s*[:=]/iu.test(
      bracketTag[1].trim(),
    )
      ? bracketTag[1].trim()
      : '';

  const hasConflictCue = CONFLICT_RELATION_RE.test(norm);

  // 1. CONFLICT / HOSTILITY ALWAYS WINS FIRST — never misclassify an enemy/rival as intimate!
  if (hasConflictCue) {
    const lbl = bracketClean
      ? bracketClean
      : /(?:ke\s*thu|thu\s*dich|phan\s*dien|tra\s*thu)/.test(norm)
        ? 'Thù địch / Kẻ thù'
        : /(?:doi\s*dau|xung\s*dot|va\s*cham|danh\s*nhau|mau\s*thuan|chong\s*doi)/.test(
              norm,
            )
          ? 'Đối đầu / Xung đột'
          : /(?:canh\s*tranh|doi\s*thu|tranh\s*chap)/.test(norm)
            ? 'Đối thủ cạnh tranh'
            : /(?:de\s*phong|nghi\s*ngo|am\s*muu|phan\s*boi)/.test(norm)
              ? 'Đề phòng / Nghi ngờ'
              : 'Căng thẳng / Mâu thuẫn';
    return {
      tone: 'rival',
      layer: 'faction',
      shortLabel: lbl,
      hasConflictCue: true,
    };
  }

  // 2. FAMILY / BLOODLINE LAYER
  if (FAMILY_RELATION_RE.test(norm)) {
    const lbl = bracketClean
      ? bracketClean
      : /(?:vo\s*chong|hon\s*phu|hon\s*the)/.test(norm)
        ? 'Vợ chồng / Hôn ước'
        : /(?:me\s*con|cha\s*con|bo\s*con|me\s*ruot|cha\s*ruot)/.test(norm)
          ? 'Gia đình (Cha/Mẹ - Con)'
          : /(?:anh\s*em|chi\s*em|em\s*gai|em\s*trai|anh\s*trai|chi\s*gai)/.test(
                norm,
              )
            ? 'Anh chị em'
            : 'Gia tộc / Người thân';
    return {
      tone: 'family',
      layer: 'family',
      shortLabel: lbl,
      hasConflictCue: false,
    };
  }

  // 3. INTIMATE (ONLY when explicitly permitted AND zero conflict cues exist)
  if (allowIntimate && INTIMATE_RELATION_RE.test(norm)) {
    const lbl = bracketClean
      ? bracketClean
      : /(?:nguoi\s*thuong|tinh\s*nhan|nguoi\s*yeu|ban\s*gai|ban\s*trai)/.test(
            norm,
          )
        ? 'Người thương'
        : 'Thân mật';
    return {
      tone: 'intimate',
      layer: 'personal',
      shortLabel: lbl,
      hasConflictCue: false,
    };
  }

  // 4. MYSTERY
  if (MYSTERY_RELATION_RE.test(norm)) {
    return {
      tone: 'mystery',
      layer: 'personal',
      shortLabel: bracketClean || 'Bí ẩn',
      hasConflictCue: false,
    };
  }

  // 5. CLOSE CIRCLE / FRIENDSHIP
  if (CLOSE_CIRCLE_RELATION_RE.test(norm)) {
    const lbl = bracketClean
      ? bracketClean
      : /(?:ban\s*than|tri\s*ky)/.test(norm)
        ? 'Bạn thân'
        : 'Thân thiết';
    return {
      tone: 'ally',
      layer: 'close_circle',
      shortLabel: lbl,
      hasConflictCue: false,
    };
  }

  // 6. ALLY / FACTION / WORK COOPERATION
  if (ALLY_RELATION_RE.test(norm)) {
    const lbl = bracketClean
      ? bracketClean
      : /(?:hop\s*tac|doi\s*tac|quan\s*ly|tro\s*ly|ekip|e-kip)/.test(norm)
        ? 'Hợp tác / Ê-kíp'
        : 'Đồng minh';
    return {
      tone: 'ally',
      layer: 'faction',
      shortLabel: lbl,
      hasConflictCue: false,
    };
  }

  return {
    tone: 'neutral',
    layer: 'personal',
    shortLabel: bracketClean || 'Liên kết',
    hasConflictCue: false,
  };
}

export interface ExtractedExplicitGroup {
  name: string;
  kind: RelationshipGroupKind;
}

export function extractExplicitGroupTags(raw?: string): ExtractedExplicitGroup[] {
  const text = String(raw || '').trim();
  if (!text) return [];
  const tags: ExtractedExplicitGroup[] = [];

  const inferKind = (prefix: string, full: string): RelationshipGroupKind => {
    const n = normalizeCharacterKey(`${prefix} ${full}`);
    if (/(?:gia\s*toc|gia\s*dinh|nha\s+ho|nha\s+kardashian|huyet\s*thong)/.test(n)) {
      return 'family';
    }
    if (/(?:hoi\s*ban|nhom\s*than|ban\s*than|nhom\s*ban|tri\s*ky)/.test(n)) {
      return 'close_circle';
    }
    return 'faction';
  };

  const pushTag = (name: string, kind: RelationshipGroupKind) => {
    const clean = String(name ?? '')
      .replace(/^[\s:;,\-–—·•]+|[\s:;,\-–—·•.!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (
      clean.length >= 2 &&
      clean.length <= 36 &&
      !tags.some(
        (existing) =>
          normalizeCharacterKey(existing.name) === normalizeCharacterKey(clean),
      )
    ) {
      tags.push({ name: clean, kind });
    }
  };

  // 1. Explicit [Gia tộc: ...], [Nhóm thân: ...], [Phe: ...], [Nhóm: ...], [Tổ chức: ...]
  const bracketRe =
    /\[\s*(gia\s*tộc|gia\s*đình|hội\s*bạn|nhóm\s*thân|phe(?:\s*phái)?|tổ\s*chức|nhóm|tông\s*môn|công\s*hội|băng(?:\s*nhóm)?|bang|đội)\s*[:=]\s*([^\]]{2,36})\]/giu;
  let bm: RegExpExecArray | null;
  while ((bm = bracketRe.exec(text)) !== null) {
    if (bm[1] && bm[2]) {
      pushTag(bm[2], inferKind(bm[1], bm[2]));
    }
  }

  // 2. Explicit #Hashtag
  const hashMatches = text.match(/#[\p{L}\p{N}_-]{2,28}/gu) || [];
  for (const hm of hashMatches) {
    const label = hm.slice(1).replace(/_/g, ' ');
    pushTag(label, inferKind('', label));
  }

  // 3. Named organizations / families / friend groups in Vietnamese prose
  const groupRe =
    /(gia\s+tộc|gia\s+đình|nhà|hội\s+bạn(?:\s+thân)?|nhóm\s+thân|tông\s+môn|môn\s+phái|tổ\s+chức|phe(?:\s+phái)?|học\s+viện|triều\s+đình|tập\s+đoàn|công\s+ty|hãng|công\s+hội|băng(?:\s+đảng|\s+nhóm)?|nhóm|ê-kíp|đội|bang|giáo\s+phái|thương\s+hội|clb)\s+([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ0-9][\p{L}\p{N}-]*(?:\s+[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ0-9][\p{L}\p{N}-]*){0,2})/gu;
  let m: RegExpExecArray | null;
  while ((m = groupRe.exec(text)) !== null) {
    if (m[0] && m[1] && m[2]) {
      const fullPhrase = m[0].trim();
      pushTag(
        fullPhrase.length <= 32 ? fullPhrase : m[2],
        inferKind(m[1], fullPhrase),
      );
    }
  }

  // 4. Suffix-style East Asian / fantasy organization names
  const suffixOrgRe =
    /\b([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{L}]+(?:\s+[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{L}]+){1,2}\s+(?:Tông|Môn|Phái|Bang|Giáo|Điện|Các|Lâu|Minh|Hội|Viện|Phủ|Quân|Đoàn))\b/gu;
  let sm: RegExpExecArray | null;
  while ((sm = suffixOrgRe.exec(text)) !== null) {
    if (sm[1]) pushTag(sm[1], 'faction');
  }

  return tags;
}

export function extractPrimaryAutoGroupForPortrait(
  p: CharacterPortrait,
): ExtractedExplicitGroup | null {
  const relTags = extractExplicitGroupTags(p.relationships);
  if (relTags.length > 0) return relTags[0];

  const roleTags = extractExplicitGroupTags(p.role);
  if (roleTags.length > 0) return roleTags[0];

  const relNorm = normalizeCharacterKey(`${p.relationships || ''} ${p.role || ''}`);
  if (/kardashian|jenner/.test(relNorm)) {
    return { name: 'Gia tộc Kardashian-Jenner', kind: 'family' };
  }
  if (/blackpink/.test(relNorm)) {
    return { name: 'BLACKPINK', kind: 'close_circle' };
  }
  return null;
}

function resolveBadgeSummary(p: CharacterPortrait) {
  const tierInfo = resolvePortraitRoleTier(p);
  if (tierInfo.tier === 'main') {
    return {
      tier: 'main' as const,
      tierLabel: 'Main',
      detailLabel: tierInfo.detailLabel || '',
      badgeClass:
        'bg-orange-500/18 text-orange-200 ring-1 ring-inset ring-orange-400/38',
      dotClass: 'bg-orange-400',
    };
  }
  if (tierInfo.tier === 'mob') {
    return {
      tier: 'mob' as const,
      tierLabel: 'Mob',
      detailLabel: tierInfo.detailLabel || '',
      badgeClass:
        'bg-slate-500/20 text-slate-300 ring-1 ring-inset ring-slate-400/32',
      dotClass: 'bg-slate-400',
    };
  }
  return {
    tier: 'npc' as const,
    tierLabel: 'NPC',
    detailLabel: tierInfo.detailLabel || '',
    badgeClass: 'bg-sky-500/18 text-sky-200 ring-1 ring-inset ring-sky-400/38',
    dotClass: 'bg-sky-400',
  };
}

function computeLayeredClusterAnchors(
  clusters: Array<{ kind: GraphCluster['kind']; memberCount: number }>,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const count = clusters.length;
  const cx = width / 2;
  const cy = height / 2 + 6;
  if (count <= 1) return [{ x: cx, y: cy }];

  // Group clusters into horizontal bands by layer kind:
  // Top band: family | Middle band: close_circle & auto | Bottom/side band: faction & rival
  const familyIdx: number[] = [];
  const circleIdx: number[] = [];
  const factionIdx: number[] = [];
  clusters.forEach((c, idx) => {
    if (c.kind === 'family') familyIdx.push(idx);
    else if (c.kind === 'close_circle') circleIdx.push(idx);
    else factionIdx.push(idx);
  });

  const activeBands = [familyIdx, circleIdx, factionIdx].filter(
    (b) => b.length > 0,
  );

  // If there are multiple distinct layer bands, place each band cleanly so layers never tangle
  if (activeBands.length >= 2 && count <= 8) {
    const out: Array<{ x: number; y: number }> = new Array(count);
    const bandY =
      activeBands.length === 2
        ? [height * 0.31, height * 0.7]
        : [height * 0.24, height * 0.54, height * 0.78];

    activeBands.forEach((indices, bIdx) => {
      const y = bandY[bIdx] ?? cy;
      const n = indices.length;
      indices.forEach((clusterIdx, i) => {
        const x =
          n === 1
            ? cx
            : width * (0.22 + (0.56 * i) / Math.max(1, n - 1));
        out[clusterIdx] = { x, y };
      });
    });
    return out;
  }

  // Fallback radial layout for single-band or many clusters
  if (count === 2) {
    return [
      { x: width * 0.28, y: cy },
      { x: width * 0.72, y: cy },
    ];
  }
  if (count === 3) {
    return [
      { x: cx, y: height * 0.3 },
      { x: width * 0.26, y: height * 0.7 },
      { x: width * 0.74, y: height * 0.7 },
    ];
  }
  if (count === 4) {
    return [
      { x: width * 0.27, y: height * 0.31 },
      { x: width * 0.73, y: height * 0.31 },
      { x: width * 0.27, y: height * 0.71 },
      { x: width * 0.73, y: height * 0.71 },
    ];
  }
  const rx = width * 0.33;
  const ry = height * 0.3;
  return Array.from({ length: count }, (_, idx) => {
    const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    };
  });
}

export interface BuildRelationshipGraphParams {
  portraits: CharacterPortrait[];
  memoryEntries: MemoryEntry[];
  characterStates: CharacterStateSnapshot[];
  customGroups?: RelationshipGroup[];
  edgeOverrides?: RelationshipEdgeOverride[];
  clusterMode: ClusterMode;
  includeSceneCoPresence?: boolean;
  collapsedClusterIds?: Set<string>;
}

export interface BuildRelationshipGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  allRawEdges: GraphEdge[];
  deletedOverrideCount: number;
  blockedContagionCount: number;
}

export function buildRelationshipGraph(
  params: BuildRelationshipGraphParams,
): BuildRelationshipGraphResult {
  const {
    portraits,
    memoryEntries,
    characterStates,
    customGroups = [],
    edgeOverrides = [],
    clusterMode,
    includeSceneCoPresence = true,
    collapsedClusterIds,
  } = params;

  const visiblePortraits = portraits.slice(0, 24);
  if (!visiblePortraits.length) {
    return {
      nodes: [],
      edges: [],
      clusters: [],
      allRawEdges: [],
      deletedOverrideCount: 0,
      blockedContagionCount: 0,
    };
  }

  const portraitById = new Map<string, CharacterPortrait>();
  const tokenMap = new Map<string, string[]>();
  const autoGroupMap = new Map<string, ExtractedExplicitGroup[]>();
  const stateLocMap = new Map<string, string>();

  for (const s of characterStates || []) {
    if (isInvalidNpcState(s)) continue;
    const k = normalizeCharacterKey(s.name);
    const loc = normalizeCharacterKey(s.location || '');
    if (k && loc && loc.length >= 3) {
      stateLocMap.set(k, s.location.trim());
    }
  }

  for (const p of visiblePortraits) {
    portraitById.set(p.id, p);
    tokenMap.set(p.id, getSearchTokensForName(p.name));
    autoGroupMap.set(p.id, extractExplicitGroupTags(p.relationships));
  }

  // Index overrides by canonical pair key
  const overrideByKey = new Map<string, RelationshipEdgeOverride>();
  let deletedOverrideCount = 0;
  for (const ov of edgeOverrides) {
    if (!ov.sourceId || !ov.targetId || ov.sourceId === ov.targetId) continue;
    if (!portraitById.has(ov.sourceId) || !portraitById.has(ov.targetId)) {
      continue;
    }
    const key = canonicalPairKey(ov.sourceId, ov.targetId);
    overrideByKey.set(key, ov);
    if (ov.status === 'deleted') deletedOverrideCount += 1;
  }

  // Index custom groups per character
  const customGroupIdsByPortrait = new Map<string, string[]>();
  const validCustomGroups = customGroups.filter((g) => g.name.trim().length > 0);
  for (const g of validCustomGroups) {
    for (const mId of g.memberIds) {
      if (!portraitById.has(mId)) continue;
      const list = customGroupIdsByPortrait.get(mId) || [];
      if (!list.includes(g.id)) list.push(g.id);
      customGroupIdsByPortrait.set(mId, list);
    }
  }

  const edgeMap = new Map<string, GraphEdge>();

  const upsertEdge = (
    aId: string,
    bId: string,
    candidate: Omit<GraphEdge, 'id' | 'sourceId' | 'targetId'>,
  ) => {
    if (aId === bId) return;
    const [sId, tId] = aId < bId ? [aId, bId] : [bId, aId];
    const key = `${sId}__${tId}`;
    const existing = edgeMap.get(key);
    if (!existing) {
      edgeMap.set(key, {
        id: key,
        sourceId: sId,
        targetId: tId,
        ...candidate,
      });
      return;
    }

    // HARD RULE: Explicit conflict ('rival') beats auto-inferred 'intimate' or 'ally'!
    // Only a direct profile tag ('relationships_tag') can override another 'relationships_tag'/'custom_group',
    // preventing a noisy memory snippet from flipping verified family/partners into rivals.
    const canCandidateConflictOverride =
      candidate.tone === 'rival' &&
      existing.tone !== 'rival' &&
      (candidate.sourceKind === 'relationships_tag' ||
        (existing.sourceKind !== 'relationships_tag' &&
          existing.sourceKind !== 'custom_group'));

    if (canCandidateConflictOverride) {
      edgeMap.set(key, {
        id: key,
        sourceId: sId,
        targetId: tId,
        ...candidate,
        reason:
          existing.sourceKind === 'relationships_tag' &&
          !candidate.reason.includes(existing.reason)
            ? `${candidate.reason} · (${existing.reason})`
            : candidate.reason,
        strength: Math.max(existing.strength, candidate.strength) + 8,
      });
      return;
    }
    if (existing.tone === 'rival' && candidate.tone !== 'rival') {
      // Never downgrade an established conflict edge to intimate/ally/neutral!
      return;
    }

    if (
      existing.sourceKind === 'relationships_tag' &&
      candidate.sourceKind === 'relationships_tag' &&
      !existing.reason.includes(candidate.reason)
    ) {
      const preferredTone =
        candidate.tone === 'family' || existing.tone === 'family'
          ? 'family'
          : candidate.tone === 'intimate' || existing.tone === 'intimate'
            ? 'intimate'
            : candidate.strength > existing.strength
              ? candidate.tone
              : existing.tone;
      const preferredLayer =
        preferredTone === 'family'
          ? 'family'
          : candidate.strength > existing.strength
            ? candidate.layer
            : existing.layer;
      const combinedLabel =
        existing.label === candidate.label
          ? existing.label
          : `${existing.label} / ${candidate.label}`;
      edgeMap.set(key, {
        ...existing,
        tone: preferredTone,
        layer: preferredLayer,
        label: combinedLabel.length <= 26 ? combinedLabel : existing.label,
        reason: `${existing.reason} · ${candidate.reason}`,
        dashed: preferredTone === 'rival' || preferredTone === 'mystery',
        dashPattern: TONE_META[preferredTone].dashPattern || undefined,
        strength: Math.max(existing.strength, candidate.strength) + 4,
      });
      return;
    }

    if (candidate.strength > existing.strength) {
      edgeMap.set(key, {
        id: key,
        sourceId: sId,
        targetId: tId,
        ...candidate,
      });
    }
  };

  // 1. Direct clause-by-clause edges from each character's `relationships` field
  // (NEVER mixes `other.role` into classification so third-party roles can NEVER corrupt the link!)
  for (const p of visiblePortraits) {
    const clauses = splitRelationshipClauses(p.relationships);
    for (const clause of clauses) {
      const clauseNorm = normalizeCharacterKey(clause);
      const mentionedOthers: CharacterPortrait[] = [];
      for (const other of visiblePortraits) {
        if (other.id === p.id) continue;
        const otherToks = tokenMap.get(other.id) || [];
        if (textMentionsName(clauseNorm, otherToks)) {
          mentionedOthers.push(other);
        }
      }
      if (!mentionedOthers.length) continue;

      // If a single clause mentions multiple characters AND contains conflict cues, allowIntimate=false for safety
      const clauseHasConflict = CONFLICT_RELATION_RE.test(clauseNorm);
      const classified = classifyClauseRelationTone(clause, {
        allowIntimate: !clauseHasConflict && mentionedOthers.length <= 2,
      });

      for (const other of mentionedOthers) {
        upsertEdge(p.id, other.id, {
          tone: classified.tone,
          layer: classified.layer,
          label: classified.shortLabel,
          reason: `${p.name} → ${other.name}: ${clause.slice(0, 140)}`,
          sourceKind: 'relationships_tag',
          dashed: Boolean(TONE_META[classified.tone].dashPattern),
          dashPattern: TONE_META[classified.tone].dashPattern || undefined,
          strength: classified.tone === 'rival' ? 100 : 94,
        });
      }
    }
  }

  // 2. Custom user-defined groups (Gia tộc / Nhóm thân thiết / Phe phái)
  for (const grp of validCustomGroups) {
    const members = grp.memberIds.filter((id) => portraitById.has(id));
    if (members.length < 2) continue;
    const tone: RelationshipTone = grp.kind === 'family' ? 'family' : 'ally';
    const layer: RelationshipLayerKind = GROUP_KIND_META[grp.kind].layer;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        upsertEdge(members[i], members[j], {
          tone,
          layer,
          label: grp.name.slice(0, 22),
          reason: `Cùng thuộc ${GROUP_KIND_META[grp.kind].shortLabel.toLowerCase()} "${grp.name}"`,
          sourceKind: 'custom_group',
          dashed: false,
          strength: 86,
        });
      }
    }
  }

  // 3. Shared explicit auto-extracted group/family/faction tags inside `relationships`
  for (let i = 0; i < visiblePortraits.length; i++) {
    const a = visiblePortraits[i];
    const aTags = autoGroupMap.get(a.id) || [];
    if (!aTags.length) continue;
    for (let j = i + 1; j < visiblePortraits.length; j++) {
      const b = visiblePortraits[j];
      const bTags = autoGroupMap.get(b.id) || [];
      if (!bTags.length) continue;
      const shared = aTags.find((at) =>
        bTags.some(
          (bt) =>
            normalizeCharacterKey(at.name) === normalizeCharacterKey(bt.name),
        ),
      );
      if (shared) {
        const tone: RelationshipTone =
          shared.kind === 'family' ? 'family' : 'ally';
        const layer: RelationshipLayerKind = GROUP_KIND_META[shared.kind].layer;
        upsertEdge(a.id, b.id, {
          tone,
          layer,
          label: shared.name.slice(0, 22),
          reason: `Chung nhóm "${shared.name}" trong hồ sơ Quan hệ`,
          sourceKind: 'relationships_tag',
          dashed: false,
          strength: 76,
        });
      }
    }
  }

  // 4. Memory Entries — clause-scoped & conflict-safe!
  // NEVER infer 'intimate', 'ally', or 'rival' indiscriminately across 3+ people in a single sentence:
  // only pair-exclusive clauses (exact 2 characters) may infer strong tones; multi-person events stay strictly 'neutral'.
  for (const entry of memoryEntries || []) {
    const combinedRaw = `${entry.title || ''}. ${entry.content || ''}`.trim();
    const normWhole = normalizeCharacterKey(combinedRaw);
    if (!normWhole) continue;

    const wholeMentionedIds: string[] = [];
    for (const p of visiblePortraits) {
      const toks = tokenMap.get(p.id) || [];
      if (textMentionsName(normWhole, toks)) {
        wholeMentionedIds.push(p.id);
      }
    }
    if (wholeMentionedIds.length < 2 || wholeMentionedIds.length > 6) continue;

    const wholeHasConflict = CONFLICT_RELATION_RE.test(normWhole);
    const isRelCat = entry.category === 'relationship';

    // Split memory into sentences/clauses and count how many characters appear in each clause
    const sentences = combinedRaw
      .split(/[;\n.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3)
      .map((text) => {
        const norm = normalizeCharacterKey(text);
        const mentionedInClause = wholeMentionedIds.filter((id) =>
          textMentionsName(norm, tokenMap.get(id) || []),
        );
        return { text, norm, mentionedInClause };
      });

    for (let i = 0; i < wholeMentionedIds.length; i++) {
      for (let j = i + 1; j < wholeMentionedIds.length; j++) {
        const idA = wholeMentionedIds[i];
        const idB = wholeMentionedIds[j];

        const sharedClauses = sentences.filter(
          (sent) =>
            sent.mentionedInClause.includes(idA) &&
            sent.mentionedInClause.includes(idB),
        );

        // If 3+ people are in the memory, require them to actually co-occur in the same sentence/clause
        if (wholeMentionedIds.length > 2 && sharedClauses.length === 0) {
          continue;
        }

        // Pair-exclusive clauses mention ONLY these two characters (no ambiguous 3rd/4th party)
        const pairExclusiveClauses = sharedClauses.filter(
          (sent) => sent.mentionedInClause.length === 2,
        );
        const isPairExclusive =
          wholeMentionedIds.length === 2 || pairExclusiveClauses.length > 0;

        const evalText =
          pairExclusiveClauses.length > 0
            ? pairExclusiveClauses.map((s) => s.text).join('. ')
            : sharedClauses.length > 0
              ? sharedClauses.map((s) => s.text).join('. ')
              : combinedRaw;

        const allowIntimateHere =
          isRelCat && isPairExclusive && !wholeHasConflict;
        const classified = classifyClauseRelationTone(evalText, {
          allowIntimate: allowIntimateHere,
        });

        // Multi-person clause (3+ characters in the same sentence): NEVER guess rival/intimate/ally
        // because we cannot tell who is allied with whom vs fighting whom -> keep strictly 'neutral'!
        const finalTone: RelationshipTone = !isPairExclusive
          ? 'neutral'
          : classified.tone;
        const finalLayer: RelationshipLayerKind =
          finalTone === 'neutral' ? 'personal' : classified.layer;

        upsertEdge(idA, idB, {
          tone: finalTone,
          layer: finalLayer,
          label:
            finalTone === 'neutral'
              ? entry.title.slice(0, 22) || 'Cùng sự kiện'
              : classified.shortLabel,
          reason: `Ký ức (${entry.title}): ${entry.content.slice(0, 140)}`,
          sourceKind: 'memory',
          dashed: Boolean(TONE_META[finalTone].dashPattern),
          dashPattern: TONE_META[finalTone].dashPattern || undefined,
          strength:
            finalTone === 'rival'
              ? 88
              : isRelCat && isPairExclusive
                ? 82
                : 52,
        });
      }
    }
  }

  // 5. Scene Co-Location / Same-Turn edges — STRICTLY 'neutral' (NEVER infers 'intimate' or 'ally'!)
  if (includeSceneCoPresence) {
    for (let i = 0; i < visiblePortraits.length; i++) {
      const a = visiblePortraits[i];
      const aLoc = stateLocMap.get(normalizeCharacterKey(a.name));
      for (let j = i + 1; j < visiblePortraits.length; j++) {
        const b = visiblePortraits[j];
        const bLoc = stateLocMap.get(normalizeCharacterKey(b.name));
        const sameLocation =
          Boolean(aLoc && bLoc) &&
          normalizeCharacterKey(aLoc!) === normalizeCharacterKey(bLoc!);
        const sameTurn =
          typeof a.lastSeenTurnIndex === 'number' &&
          typeof b.lastSeenTurnIndex === 'number' &&
          a.lastSeenTurnIndex === b.lastSeenTurnIndex;

        if (sameLocation || sameTurn) {
          upsertEdge(a.id, b.id, {
            tone: 'neutral',
            layer: 'personal',
            label: sameLocation
              ? 'Cùng vị trí'
              : `Cùng Trang ${(a.lastSeenTurnIndex ?? 0) + 1}`,
            reason: sameLocation
              ? `Đang cùng xuất hiện tại: ${aLoc}`
              : `Cùng xuất hiện ở Trang ${(a.lastSeenTurnIndex ?? 0) + 1}`,
            sourceKind: 'scene',
            dashed: true,
            dashPattern: TONE_META.neutral.dashPattern || '2 5',
            strength: sameLocation ? 32 : 24,
          });
        }
      }
    }
  }

  // =========================================================================
  // 6. HARD CONFLICT & FAMILY/GROUP CONTAGION FIREWALL
  // =========================================================================
  // Step 6a: Collect all direct hostile pairs (both auto-detected rival & manual rival overrides)
  const hostilePairs = new Set<string>();
  const hostileNeighbors = new Map<string, Set<string>>();
  const addHostile = (u: string, v: string) => {
    const k = canonicalPairKey(u, v);
    hostilePairs.add(k);
    if (!hostileNeighbors.has(u)) hostileNeighbors.set(u, new Set());
    if (!hostileNeighbors.has(v)) hostileNeighbors.set(v, new Set());
    hostileNeighbors.get(u)!.add(v);
    hostileNeighbors.get(v)!.add(u);
  };

  for (const e of edgeMap.values()) {
    if (e.tone === 'rival') {
      addHostile(e.sourceId, e.targetId);
    }
  }
  for (const ov of overrideByKey.values()) {
    if (ov.status === 'manual' && ov.tone === 'rival') {
      addHostile(ov.sourceId, ov.targetId);
    }
  }

  // Step 6b: Collect each character's family / close-circle / kin neighbors
  const kinOrCloseNeighbors = new Map<string, Set<string>>();
  const addKin = (u: string, v: string) => {
    if (u === v) return;
    if (!kinOrCloseNeighbors.has(u)) kinOrCloseNeighbors.set(u, new Set());
    if (!kinOrCloseNeighbors.has(v)) kinOrCloseNeighbors.set(v, new Set());
    kinOrCloseNeighbors.get(u)!.add(v);
    kinOrCloseNeighbors.get(v)!.add(u);
  };

  for (const g of validCustomGroups) {
    if (g.kind === 'family' || g.kind === 'close_circle') {
      const members = g.memberIds.filter((id) => portraitById.has(id));
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          addKin(members[i], members[j]);
        }
      }
    }
  }
  for (const e of edgeMap.values()) {
    if (
      e.tone === 'family' ||
      e.tone === 'intimate' ||
      (e.tone === 'ally' &&
        (e.layer === 'close_circle' ||
          e.sourceKind === 'custom_group' ||
          e.sourceKind === 'relationships_tag'))
    ) {
      addKin(e.sourceId, e.targetId);
    }
  }
  for (const ov of overrideByKey.values()) {
    if (
      ov.status === 'manual' &&
      (ov.tone === 'family' || ov.tone === 'intimate' || ov.tone === 'ally')
    ) {
      addKin(ov.sourceId, ov.targetId);
    }
  }

  // Step 6c: Enforce firewall on ALL non-manual edges
  let blockedContagionCount = 0;
  for (const [key, edge] of Array.from(edgeMap.entries())) {
    const manualOv = overrideByKey.get(key);
    if (manualOv) continue; // Handled in Step 7 below

    // Rule A: Direct hostile pair can NEVER be intimate/ally/family
    if (hostilePairs.has(key) && edge.tone !== 'rival') {
      edgeMap.set(key, {
        ...edge,
        tone: 'rival',
        layer: 'faction',
        label: 'Đối đầu / Xung đột',
        dashed: true,
        dashPattern: TONE_META.rival.dashPattern || '8 4',
      });
      blockedContagionCount += 1;
      continue;
    }

    // Rule B: Family / Close-Circle Contagion Firewall
    // If A is kin/close-circle of X who is hostile to B (e.g. Kim/Kris is family of Thiện, Thiện is rival of Hoàng Long),
    // NEVER allow auto-inferred 'intimate' or 'ally' between A and B!
    const aKins = kinOrCloseNeighbors.get(edge.sourceId);
    const bKins = kinOrCloseNeighbors.get(edge.targetId);
    let hasCrossHostility = false;
    if (aKins) {
      for (const kin of aKins) {
        if (hostilePairs.has(canonicalPairKey(kin, edge.targetId))) {
          hasCrossHostility = true;
          break;
        }
      }
    }
    if (!hasCrossHostility && bKins) {
      for (const kin of bKins) {
        if (hostilePairs.has(canonicalPairKey(kin, edge.sourceId))) {
          hasCrossHostility = true;
          break;
        }
      }
    }

    if (
      hasCrossHostility &&
      (edge.tone === 'intimate' || edge.tone === 'ally')
    ) {
      blockedContagionCount += 1;
      if (edge.sourceKind === 'scene' || edge.sourceKind === 'memory') {
        // Drop false contagion edge entirely
        edgeMap.delete(key);
      } else {
        // Downgrade unconfirmed positive tag to neutral tension awareness
        edgeMap.set(key, {
          ...edge,
          tone: 'neutral',
          layer: 'faction',
          label: 'Liên đới phe đối đầu',
          reason: `${edge.reason} (đã chặn tự gán thân mật do đối lập phe/gia đình)`,
          dashed: true,
          dashPattern: TONE_META.neutral.dashPattern || '2 5',
        });
      }
    }
  }

  // =========================================================================
  // 7. APPLY USER MANUAL OVERRIDES & DELETIONS (FINAL AUTHORITY)
  // =========================================================================
  for (const [key, ov] of overrideByKey.entries()) {
    if (ov.status === 'deleted') {
      edgeMap.delete(key);
      continue;
    }
    const tone: RelationshipTone = ov.tone || 'ally';
    const layer: RelationshipLayerKind =
      ov.layer || TONE_META[tone].defaultLayer;
    const srcName = portraitById.get(ov.sourceId)?.name || '';
    const tgtName = portraitById.get(ov.targetId)?.name || '';
    const label = ov.label?.trim() || TONE_META[tone].shortLabel;
    edgeMap.set(key, {
      id: key,
      sourceId: ov.sourceId,
      targetId: ov.targetId,
      tone,
      layer,
      label,
      reason:
        ov.note?.trim() ||
        `Người chơi thiết lập: ${srcName} ↔ ${tgtName} (${label})`,
      sourceKind: 'manual',
      dashed: Boolean(TONE_META[tone].dashPattern),
      dashPattern: TONE_META[tone].dashPattern || undefined,
      strength: 120,
      isManual: true,
    });
  }

  const allRawEdges = Array.from(edgeMap.values());
  const degreeMap = new Map<string, number>();
  for (const e of allRawEdges) {
    degreeMap.set(e.sourceId, (degreeMap.get(e.sourceId) || 0) + 1);
    degreeMap.set(e.targetId, (degreeMap.get(e.targetId) || 0) + 1);
  }

  const rankedPortraits = [...visiblePortraits].sort((a, b) => {
    const aDeg = degreeMap.get(a.id) || 0;
    const bDeg = degreeMap.get(b.id) || 0;
    if (aDeg !== bDeg) return bDeg - aDeg;
    const aPin = a.pinned ? 1 : 0;
    const bPin = b.pinned ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    const aMob = resolveBadgeSummary(a).tier === 'mob' ? 1 : 0;
    const bMob = resolveBadgeSummary(b).tier === 'mob' ? 1 : 0;
    if (aMob !== bMob) return aMob - bMob;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  // =========================================================================
  // 8. CLUSTER BUCKETING (Custom Groups First -> Auto Family/Circle/Faction)
  // =========================================================================
  interface RawClusterBucket {
    id: string;
    label: string;
    kind: GraphCluster['kind'];
    isCustom: boolean;
    customGroupId?: string;
    memberIds: string[];
    fixedHex?: string;
  }

  const bucketMap = new Map<string, RawClusterBucket>();
  const nodeClusterMap = new Map<
    string,
    { clusterId: string; clusterLabel: string }
  >();

  if (clusterMode === 'role') {
    for (const p of rankedPortraits) {
      const badge = resolveBadgeSummary(p);
      const cId = `role_${badge.tier}`;
      const cLabel =
        badge.tier === 'main'
          ? 'Nhóm Main'
          : badge.tier === 'mob'
            ? 'Nhóm Mob / Nền'
            : 'Nhóm NPC';
      const fixedHex =
        badge.tier === 'main'
          ? '#fb923c'
          : badge.tier === 'mob'
            ? '#64748b'
            : '#38bdf8';
      const existing = bucketMap.get(cId);
      if (existing) existing.memberIds.push(p.id);
      else {
        bucketMap.set(cId, {
          id: cId,
          label: cLabel,
          kind: 'role',
          isCustom: false,
          memberIds: [p.id],
          fixedHex,
        });
      }
      nodeClusterMap.set(p.id, { clusterId: cId, clusterLabel: cLabel });
    }
  } else if (clusterMode === 'layered' || clusterMode === 'faction') {
    // Priority 1: User-defined custom groups (family > close_circle > faction)
    const kindOrder: Record<RelationshipGroupKind, number> = {
      family: 0,
      close_circle: 1,
      faction: 2,
    };
    const sortedCustomGroups = [...validCustomGroups].sort(
      (a, b) => kindOrder[a.kind] - kindOrder[b.kind],
    );

    const assignedByCustom = new Map<string, RelationshipGroup>();
    for (const grp of sortedCustomGroups) {
      const activeMembers = grp.memberIds.filter((id) => portraitById.has(id));
      if (!activeMembers.length) continue;
      for (const mId of activeMembers) {
        if (!assignedByCustom.has(mId)) {
          assignedByCustom.set(mId, grp);
        }
      }
    }

    // Priority 2: Auto-extracted group/family/faction tags
    const autoGroupByPortrait = new Map<string, ExtractedExplicitGroup | null>();
    const canonicalAutoLabel = new Map<string, ExtractedExplicitGroup>();
    for (const p of rankedPortraits) {
      if (assignedByCustom.has(p.id)) continue;
      const found = extractPrimaryAutoGroupForPortrait(p);
      autoGroupByPortrait.set(p.id, found);
      if (found) {
        const fk = normalizeCharacterKey(found.name);
        if (fk && !canonicalAutoLabel.has(fk)) {
          canonicalAutoLabel.set(fk, found);
        }
      }
    }

    const hasAnyNamedGroup =
      assignedByCustom.size > 0 || canonicalAutoLabel.size > 0;

    for (const p of rankedPortraits) {
      const badge = resolveBadgeSummary(p);
      const customGrp = assignedByCustom.get(p.id);
      let cId: string;
      let cLabel: string;
      let cKind: GraphCluster['kind'];
      let isCustom = false;
      let customGroupId: string | undefined;
      let fixedHex: string | undefined;

      if (customGrp) {
        cId = `custom_${customGrp.id}`;
        cLabel = customGrp.name;
        cKind = customGrp.kind;
        isCustom = true;
        customGroupId = customGrp.id;
        fixedHex = customGrp.color;
      } else {
        const autoGrp = autoGroupByPortrait.get(p.id);
        if (autoGrp) {
          const fk = normalizeCharacterKey(autoGrp.name);
          const canon = canonicalAutoLabel.get(fk) || autoGrp;
          cId = `auto_${canon.kind}_${fk}`;
          cLabel = canon.name;
          cKind = canon.kind;
          fixedHex = GROUP_KIND_META[canon.kind].defaultColor;
        } else {
          // Classify unassigned character cleanly by actual verified edges (never false-positive role strings)
          const myEdges = allRawEdges.filter(
            (e) => e.sourceId === p.id || e.targetId === p.id,
          );
          const hasFamilyEdge = myEdges.some((e) => e.tone === 'family');
          const hasRivalEdge = myEdges.some((e) => e.tone === 'rival');
          const hasCloseEdge = myEdges.some(
            (e) => e.tone === 'intimate' || e.tone === 'ally',
          );

          if (badge.tier === 'mob') {
            cId = 'auto_mob';
            cLabel = 'Quần chúng / Mob';
            cKind = 'auto';
            fixedHex = '#64748b';
          } else if (hasRivalEdge && !hasFamilyEdge && !hasCloseEdge) {
            cId = 'auto_rival';
            cLabel = 'Phe đối đầu / Xung đột';
            cKind = 'faction';
            fixedHex = '#ef4444';
          } else if (hasFamilyEdge) {
            cId = 'auto_family_core';
            cLabel = 'Gia đình / Người thân';
            cKind = 'family';
            fixedHex = '#f59e0b';
          } else if (badge.tier === 'main' || hasCloseEdge) {
            cId = 'auto_close_core';
            cLabel = hasAnyNamedGroup
              ? 'Nhóm thân cận / Trung tâm'
              : 'Nhân vật chủ chốt & Thân cận';
            cKind = 'close_circle';
            fixedHex = '#34d399';
          } else {
            cId = 'auto_independent';
            cLabel = hasAnyNamedGroup
              ? 'Tự do / Chưa xếp nhóm'
              : 'Nhân vật tương tác (NPC)';
            cKind = 'auto';
            fixedHex = '#38bdf8';
          }
        }
      }

      const existing = bucketMap.get(cId);
      if (existing) {
        existing.memberIds.push(p.id);
      } else {
        bucketMap.set(cId, {
          id: cId,
          label: cLabel,
          kind: cKind,
          isCustom,
          customGroupId,
          memberIds: [p.id],
          fixedHex,
        });
      }
      nodeClusterMap.set(p.id, { clusterId: cId, clusterLabel: cLabel });
    }
  }

  const orderedBuckets = Array.from(bucketMap.values()).sort((a, b) => {
    if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
    const layerRank = (k: GraphCluster['kind']) =>
      k === 'family' ? 0 : k === 'close_circle' ? 1 : k === 'faction' ? 2 : 3;
    const lr = layerRank(a.kind) - layerRank(b.kind);
    if (lr !== 0) return lr;
    return b.memberIds.length - a.memberIds.length;
  });

  const anchors = computeLayeredClusterAnchors(
    orderedBuckets.map((b) => ({
      kind: b.kind,
      memberCount: b.memberIds.length,
    })),
    SVG_WIDTH,
    SVG_HEIGHT,
  );

  let dynamicSwatchCursor = 0;
  const clusters: GraphCluster[] = orderedBuckets.map((bucket, idx) => {
    const swatch = bucket.fixedHex
      ? resolveSwatchForHex(bucket.fixedHex)
      : GROUP_COLOR_SWATCHES[dynamicSwatchCursor++ % GROUP_COLOR_SWATCHES.length];
    const anchor = anchors[idx] || { x: SVG_WIDTH / 2, y: SVG_HEIGHT / 2 };
    const isCollapsed = Boolean(
      collapsedClusterIds?.has(bucket.id) && bucket.memberIds.length >= 2,
    );
    return {
      id: bucket.id,
      label: bucket.label,
      kind: bucket.kind,
      isCustom: bucket.isCustom,
      customGroupId: bucket.customGroupId,
      color: swatch.hex,
      fill: swatch.fill,
      pillClass: swatch.pillClass,
      dotClass: swatch.dotClass,
      memberIds: bucket.memberIds,
      anchorX: Math.round(anchor.x),
      anchorY: Math.round(anchor.y),
      collapsed: isCollapsed,
    };
  });

  const clusterById = new Map<string, GraphCluster>();
  for (const c of clusters) clusterById.set(c.id, c);

  // =========================================================================
  // 9. BUILD VISIBLE NODES & EDGES (RESPECTING COLLAPSED CLUSTERS)
  // =========================================================================
  const cx = SVG_WIDTH / 2;
  const cy = SVG_HEIGHT / 2;
  const collapsedMemberToHubId = new Map<string, string>();
  const nodes: GraphNode[] = [];

  for (const c of clusters) {
    if (c.collapsed) {
      const hubId = `hub__${c.id}`;
      for (const mId of c.memberIds) {
        collapsedMemberToHubId.set(mId, hubId);
      }
      const memberNames = c.memberIds
        .map((id) => portraitById.get(id)?.name || '')
        .filter(Boolean);
      const firstPortrait = portraitById.get(c.memberIds[0]);
      if (firstPortrait) {
        nodes.push({
          id: hubId,
          portrait: {
            ...firstPortrait,
            id: hubId,
            name: c.label,
            imageData: undefined,
            role: `${c.memberIds.length} thành viên`,
          },
          tier: 'npc',
          tierLabel:
            c.kind === 'family'
              ? 'Gia tộc'
              : c.kind === 'close_circle'
                ? 'Nhóm thân'
                : c.kind === 'faction'
                  ? 'Phe phái'
                  : 'Nhóm',
          detailLabel: `${c.memberIds.length} thành viên`,
          badgeClass: c.pillClass,
          dotClass: c.dotClass,
          initialX: c.anchorX,
          initialY: c.anchorY,
          ringColor: c.color,
          fillBg: '#101d32',
          degree: 0,
          clusterId: c.id,
          clusterLabel: c.label,
          customGroupIds: c.customGroupId ? [c.customGroupId] : [],
          isClusterHub: true,
          collapsedMemberCount: c.memberIds.length,
          collapsedMemberNames: memberNames,
          hubColor: c.color,
          hubKind: c.kind,
        });
      }
    }
  }

  const totalVisibleIndividuals = rankedPortraits.filter(
    (p) => !collapsedMemberToHubId.has(p.id),
  ).length;

  rankedPortraits.forEach((p, idx) => {
    if (collapsedMemberToHubId.has(p.id)) return;
    const badge = resolveBadgeSummary(p);
    const ringColor =
      badge.tier === 'main'
        ? '#fb923c'
        : badge.tier === 'mob'
          ? '#94a3b8'
          : '#38bdf8';
    const fillBg =
      badge.tier === 'main'
        ? '#2c1c12'
        : badge.tier === 'mob'
          ? '#1a2232'
          : '#10233a';

    const assigned = nodeClusterMap.get(p.id);
    const cluster = assigned ? clusterById.get(assigned.clusterId) : undefined;

    let x = cx;
    let y = cy;

    if (cluster && clusterMode !== 'none') {
      const mIdx = cluster.memberIds.indexOf(p.id);
      const mTotal = cluster.memberIds.length;
      if (mTotal === 1) {
        x = cluster.anchorX;
        y = cluster.anchorY;
      } else {
        const angle = (mIdx / mTotal) * Math.PI * 2 - Math.PI / 2;
        const spread = Math.min(76, 36 + mTotal * 9);
        x = clampCoord(
          cluster.anchorX + Math.cos(angle) * spread,
          PAD_X,
          SVG_WIDTH - PAD_X,
        );
        y = clampCoord(
          cluster.anchorY + Math.sin(angle) * spread,
          PAD_TOP,
          SVG_HEIGHT - PAD_BOTTOM,
        );
      }
    } else if (totalVisibleIndividuals === 2) {
      x = idx === 0 ? cx - 135 : cx + 135;
      y = cy;
    } else if (totalVisibleIndividuals > 2 && idx > 0) {
      const ringTotal = totalVisibleIndividuals - 1;
      const angle = ((idx - 1) / ringTotal) * Math.PI * 2 - Math.PI / 2;
      const rx = badge.tier === 'mob' ? 235 : 175;
      const ry = badge.tier === 'mob' ? 150 : 120;
      x = cx + Math.cos(angle) * rx;
      y = cy + Math.sin(angle) * ry;
    }

    nodes.push({
      id: p.id,
      portrait: p,
      tier: badge.tier,
      tierLabel: badge.tierLabel,
      detailLabel: badge.detailLabel,
      badgeClass: badge.badgeClass,
      dotClass: badge.dotClass,
      initialX: Math.round(x),
      initialY: Math.round(y),
      ringColor,
      fillBg,
      degree: degreeMap.get(p.id) || 0,
      clusterId: assigned?.clusterId || '',
      clusterLabel: assigned?.clusterLabel || '',
      customGroupIds: customGroupIdsByPortrait.get(p.id) || [],
    });
  });

  // Project edges onto collapsed hub nodes (aggregating multiple cross-cluster wires cleanly!)
  const projectedEdgeMap = new Map<string, GraphEdge>();
  const tonePriority = (t: RelationshipTone): number =>
    t === 'rival'
      ? 6
      : t === 'family'
        ? 5
        : t === 'intimate'
          ? 4
          : t === 'ally'
            ? 3
            : t === 'mystery'
              ? 2
              : 1;

  for (const e of allRawEdges) {
    const mappedS = collapsedMemberToHubId.get(e.sourceId) || e.sourceId;
    const mappedT = collapsedMemberToHubId.get(e.targetId) || e.targetId;
    if (mappedS === mappedT) continue; // Internal wire folded inside collapsed hub!

    const isAggregated =
      mappedS !== e.sourceId || mappedT !== e.targetId;
    const pKey = canonicalPairKey(mappedS, mappedT);
    const [sId, tId] = mappedS < mappedT ? [mappedS, mappedT] : [mappedT, mappedS];

    const prev = projectedEdgeMap.get(pKey);
    if (!prev) {
      projectedEdgeMap.set(pKey, {
        ...e,
        id: isAggregated ? `agg__${pKey}` : e.id,
        sourceId: sId,
        targetId: tId,
        sourceKind: isAggregated ? 'collapsed_summary' : e.sourceKind,
        aggregatedCount: isAggregated ? 1 : undefined,
      });
    } else {
      const nextCount = (prev.aggregatedCount || 1) + 1;
      const useNew = tonePriority(e.tone) > tonePriority(prev.tone);
      const chosenTone = useNew ? e.tone : prev.tone;
      const chosenLayer = useNew ? e.layer : prev.layer;
      projectedEdgeMap.set(pKey, {
        ...prev,
        tone: chosenTone,
        layer: chosenLayer,
        label: `${TONE_META[chosenTone].shortLabel} (${nextCount})`,
        reason: `${prev.reason} · ${e.reason}`,
        dashed: Boolean(TONE_META[chosenTone].dashPattern),
        dashPattern: TONE_META[chosenTone].dashPattern || undefined,
        strength: Math.max(prev.strength, e.strength),
        aggregatedCount: nextCount,
      });
    }
  }

  const edges = Array.from(projectedEdgeMap.values());
  // Recompute hub degrees after projection
  const projectedDegrees = new Map<string, number>();
  for (const e of edges) {
    projectedDegrees.set(e.sourceId, (projectedDegrees.get(e.sourceId) || 0) + 1);
    projectedDegrees.set(e.targetId, (projectedDegrees.get(e.targetId) || 0) + 1);
  }
  for (const n of nodes) {
    n.degree = projectedDegrees.get(n.id) || 0;
  }

  return {
    nodes,
    edges,
    clusters,
    allRawEdges,
    deletedOverrideCount,
    blockedContagionCount,
  };
}

/**
 * Helper: strips any clauses mentioning `targetName` from a portrait's `relationships` text
 * so deleting or overriding an edge cleanly removes stale conflicting clauses.
 */
export function stripRelationshipClausesForTarget(
  rawRelationships: string | undefined,
  targetName: string,
): string {
  const clean = String(rawRelationships || '').trim();
  if (!clean) return '';
  const targetTokens = getSearchTokensForName(targetName);
  if (!targetTokens.length) return clean;
  const clauses = splitRelationshipClauses(clean);
  const kept = clauses.filter((clause) => {
    const norm = normalizeCharacterKey(clause);
    // Keep bracketed group tags like [Phe: ...] intact
    if (/^\[\s*(?:phe|tổ\s*chức|nhóm|gia\s*tộc|tông\s*môn|băng|hội)\s*[:=]/iu.test(clause.trim())) {
      return true;
    }
    return !textMentionsName(norm, targetTokens);
  });
  return kept.join('; ').trim();
}

/**
 * Pure state-updater helpers for PortraitBankConfig (edges + custom groups)
 */
export function applyManualRelationshipEdgeToBank(
  prev: PortraitBankConfig,
  params: {
    sourceId: string;
    targetId: string;
    tone: RelationshipTone;
    layer?: RelationshipLayerKind;
    label: string;
    note?: string;
  },
): PortraitBankConfig {
  const { sourceId, targetId, tone, label, note } = params;
  if (!sourceId || !targetId || sourceId === targetId) return prev;
  const [sId, tId] =
    sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
  const pairId = `${sId}__${tId}`;
  const cleanLabel = label.trim() || TONE_META[tone].shortLabel;
  const layer = params.layer || TONE_META[tone].defaultLayer;
  const now = Date.now();

  const existingOverrides = prev.relationshipOverrides || [];
  const nextOverride: RelationshipEdgeOverride = {
    id: pairId,
    sourceId: sId,
    targetId: tId,
    status: 'manual',
    tone,
    layer,
    label: cleanLabel.slice(0, 36),
    ...(note?.trim() ? { note: note.trim().slice(0, 240) } : {}),
    updatedAt: now,
  };
  const nextOverrides = [
    ...existingOverrides.filter((o) => o.id !== pairId),
    nextOverride,
  ];

  // Also keep source portrait's `relationships` field clean & consistent (replace conflicting old clause for target)
  const targetPortrait = (prev.portraits || []).find((p) => p.id === targetId);
  const sourcePortrait = (prev.portraits || []).find((p) => p.id === sourceId);
  const nextPortraits = (prev.portraits || []).map((p) => {
    if (p.id === sourceId && targetPortrait) {
      const stripped = stripRelationshipClausesForTarget(
        p.relationships,
        targetPortrait.name,
      );
      const newClause = `${cleanLabel} với ${targetPortrait.name}`;
      const nextRel = stripped ? `${stripped}; ${newClause}` : newClause;
      return { ...p, relationships: nextRel, updatedAt: now };
    }
    if (p.id === targetId && sourcePortrait) {
      // Remove any contradictory clause pointing back to sourceId so conflict never clashes with manual tone
      const stripped = stripRelationshipClausesForTarget(
        p.relationships,
        sourcePortrait.name,
      );
      if (stripped !== (p.relationships || '').trim()) {
        return { ...p, relationships: stripped || undefined, updatedAt: now };
      }
    }
    return p;
  });

  return {
    ...prev,
    portraits: nextPortraits,
    relationshipOverrides: nextOverrides,
  };
}

export function deleteRelationshipEdgeFromBank(
  prev: PortraitBankConfig,
  sourceId: string,
  targetId: string,
): PortraitBankConfig {
  if (!sourceId || !targetId || sourceId === targetId) return prev;
  const [sId, tId] =
    sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
  const pairId = `${sId}__${tId}`;
  const now = Date.now();

  const existingOverrides = prev.relationshipOverrides || [];
  const nextOverride: RelationshipEdgeOverride = {
    id: pairId,
    sourceId: sId,
    targetId: tId,
    status: 'deleted',
    updatedAt: now,
  };
  const nextOverrides = [
    ...existingOverrides.filter((o) => o.id !== pairId),
    nextOverride,
  ];

  const srcP = (prev.portraits || []).find((p) => p.id === sId);
  const tgtP = (prev.portraits || []).find((p) => p.id === tId);
  const nextPortraits = (prev.portraits || []).map((p) => {
    if (p.id === sId && tgtP) {
      const stripped = stripRelationshipClausesForTarget(
        p.relationships,
        tgtP.name,
      );
      if (stripped !== (p.relationships || '').trim()) {
        return { ...p, relationships: stripped || undefined, updatedAt: now };
      }
    }
    if (p.id === tId && srcP) {
      const stripped = stripRelationshipClausesForTarget(
        p.relationships,
        srcP.name,
      );
      if (stripped !== (p.relationships || '').trim()) {
        return { ...p, relationships: stripped || undefined, updatedAt: now };
      }
    }
    return p;
  });

  return {
    ...prev,
    portraits: nextPortraits,
    relationshipOverrides: nextOverrides,
  };
}

export function restoreDeletedEdgesInBank(
  prev: PortraitBankConfig,
): PortraitBankConfig {
  const existingOverrides = prev.relationshipOverrides || [];
  const kept = existingOverrides.filter((o) => o.status !== 'deleted');
  return {
    ...prev,
    relationshipOverrides: kept,
  };
}

export function upsertCustomRelationshipGroupInBank(
  prev: PortraitBankConfig,
  group: Omit<RelationshipGroup, 'id' | 'updatedAt'> & { id?: string },
): PortraitBankConfig {
  const cleanName = group.name.trim().slice(0, 48);
  if (!cleanName) return prev;
  const now = Date.now();
  const id =
    group.id && group.id.trim()
      ? group.id.trim()
      : `rel_grp_${now}_${Math.random().toString(36).slice(2, 6)}`;
  const nextGroup: RelationshipGroup = {
    id,
    name: cleanName,
    kind: group.kind,
    color: group.color || GROUP_KIND_META[group.kind].defaultColor,
    memberIds: Array.from(new Set(group.memberIds.filter(Boolean))),
    ...(group.note?.trim() ? { note: group.note.trim().slice(0, 200) } : {}),
    updatedAt: now,
  };
  const existing = prev.relationshipGroups || [];
  const idx = existing.findIndex((g) => g.id === id);
  const nextGroups =
    idx >= 0
      ? existing.map((g, i) => (i === idx ? nextGroup : g))
      : [...existing, nextGroup];
  return {
    ...prev,
    relationshipGroups: nextGroups,
  };
}

export function deleteCustomRelationshipGroupInBank(
  prev: PortraitBankConfig,
  groupId: string,
): PortraitBankConfig {
  const existing = prev.relationshipGroups || [];
  return {
    ...prev,
    relationshipGroups: existing.filter((g) => g.id !== groupId),
  };
}

export function toggleMemberInCustomGroupInBank(
  prev: PortraitBankConfig,
  groupId: string,
  portraitId: string,
): PortraitBankConfig {
  const existing = prev.relationshipGroups || [];
  const now = Date.now();
  return {
    ...prev,
    relationshipGroups: existing.map((g) => {
      if (g.id !== groupId) return g;
      const has = g.memberIds.includes(portraitId);
      return {
        ...g,
        memberIds: has
          ? g.memberIds.filter((id) => id !== portraitId)
          : [...g.memberIds, portraitId],
        updatedAt: now,
      };
    }),
  };
}
