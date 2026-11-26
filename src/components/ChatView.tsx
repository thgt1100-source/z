import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ImageOff,
  ImagePlus,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  Music2,
  PanelBottom,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  Swords,
  Trash2,
  User,
  Users,
  X,
  Zap,
  ZapOff,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  getImageProviderLabel,
  getTurnAttachedImages,
  getTurnStoryImages,
  MAX_PENDING_CHAT_IMAGES,
  resolveEnabledStoryImagePositions,
  STORY_IMAGE_POSITION_META,
  STORY_IMAGE_POSITIONS,
  type ArkState,
  type CompanionNpc,
  type CultivationRankingBoard,
  type CultivationRankingEntry,
  type MemoryManagerConfig,
  type PendingImage,
  type PortraitBankConfig,
  type PortraitGenProgress,
  type ShowbizPhoneApiConfig,
  type ShowbizPhoneState,
  type StoryImageConfig,
  type StoryImageGenerationProgress,
  type StoryImageItem,
  type StoryImagePosition,
  type StoryImageTargetMode,
  type Turn,
  type ViewName,
  type WorldInfo,
} from '../types/ark';
import {
  CHAT_IMAGE_MAX_DIMENSION_OPTIONS,
  CHAT_IMAGE_MAX_INPUT_MB_OPTIONS,
  CHAT_IMAGE_QUALITY_OPTIONS,
  formatBytesCompact,
} from '../utils/chatImageUpload';
import {
  generateCultivationRankingsWithAi,
  recalculateCultivationRankingsWithAi,
  resolveActiveSceneCharacters,
  resolveModelForTask,
  simulateTopNpcSparWithAi,
  stripStoryPlanningAndMeta,
  TURN_SUGGESTION_CATEGORY_LABELS,
  unlockRankingNpcIntelWithAi,
  type TurnSuggestionCategory,
  type TurnSuggestionItem,
} from '../utils/api';
import {
  computeAgeFromBirthday,
  formatAgeBirthdayLabel,
  isInvalidNpcPortrait,
  isInvalidNpcState,
  lookupKnownCelebrityProfile,
  normalizeCharacterKey,
  resolveSceneCharacterRoles,
  sanitizeCharacterName,
  type ResolvedSceneCharacterRole,
} from '../utils/characterUtils';
import {
  parseStoryTurnStream,
  splitNarrativeAndMeta,
} from '../utils/saveParser';
import { extractMatchSnippet, matchesQuery } from '../utils/search';
import { useResolvedMediaUrl } from '../hooks/useResolvedMediaUrl';
import {
  buildTurnMediaKey,
  revokeMediaKey,
} from '../utils/mediaMemoryManager';
import {
  addMinutesToClock,
  addMonthsToClock,
  addYearsToClock,
  clockToEpochMinutes,
  formatDeltaMinutesVi,
  formatStoryClock,
  normalizeStoryClock,
} from '../utils/storyClock';
import {
  applyClockDeltaToCultivation,
  CULTIVATION_SYSTEM_META,
  detectRankingIntelLocation,
  enforceTopTenPerBoard,
  getConstitutionLabels,
  getCultivationDisplayInfo,
  getRealmVisualTheme,
  normalizeConstitutionState,
  TECHNIQUE_TIER_META,
} from '../utils/cultivation';
import { collectAllAvailablePortraits } from '../utils/imageStyles';
import {
  clearComposerDraft,
  loadComposerDraft,
  loadComposerDraftFromIndexedDb,
  saveComposerDraft,
} from '../utils/storage';
import { getShowbizMcProfile } from '../utils/showbizPhone';
import { ShowbizPhonePanel } from './ShowbizPhonePanel';
import { CharacterNameBadge } from './CharacterNameBadge';
import {
  CultivationPanel,
  type CultivationSubTab,
  type QuickCultivateResult,
} from './CultivationPanel';
import {
  ImagePickerModal,
  type ImagePickerTarget,
} from './ImagePickerModal';
import { ImagePromptTemplatePanel } from './ImagePromptTemplatePanel';
import { ImageStylePicker } from './ImageStylePicker';
import { MemoryManagerPanel, type MemorySubTab } from './MemoryManagerPanel';
import {
  PortraitBankPanel,
  type BgPortraitStatus,
} from './PortraitBankPanel';
import { ProseRenderer } from './ProseRenderer';
import { ResolvedAvatarImage } from './ResolvedAvatarImage';
import { StoryBeatImageCard } from './StoryBeatImageCard';

const PAGE_SCROLL_SESSION_KEY = 'ARK_LITE_PAGE_SCROLL_V1';
const MAX_SAVED_PAGE_SCROLLS = 400;
const MAX_LOCAL_PERSISTED_SCROLLS = 60;
const savedPageScrollPositions = new Map<string, number>();
let pageScrollPositionsHydrated = false;
let pageScrollPersistTimer: number | null = null;

function hydrateSavedPageScrollPositions(): void {
  if (pageScrollPositionsHydrated || typeof window === 'undefined') return;
  pageScrollPositionsHydrated = true;
  const loadFrom = (storage: Storage | null | undefined) => {
    if (!storage) return false;
    try {
      const raw = storage.getItem(PAGE_SCROLL_SESSION_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return false;
      let loadedAny = false;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          savedPageScrollPositions.set(k, Math.round(v));
          loadedAny = true;
        }
      }
      return loadedAny;
    } catch {
      return false;
    }
  };
  // Prefer localStorage (survives mobile tab discard/reopen), then overlay sessionStorage
  try {
    loadFrom(window.localStorage);
  } catch {
    // Ignore localStorage errors in restricted browser contexts
  }
  try {
    loadFrom(window.sessionStorage);
  } catch {
    // Ignore sessionStorage errors in restricted browser contexts
  }
}

function flushSavedPageScrollPositions(): void {
  if (typeof window === 'undefined') return;
  if (pageScrollPersistTimer !== null) {
    window.clearTimeout(pageScrollPersistTimer);
    pageScrollPersistTimer = null;
  }
  const entries = Array.from(savedPageScrollPositions.entries());
  try {
    const obj: Record<string, number> = {};
    for (const [k, v] of entries) {
      obj[k] = v;
    }
    window.sessionStorage.setItem(PAGE_SCROLL_SESSION_KEY, JSON.stringify(obj));
  } catch {
    // Ignore sessionStorage quota / access errors
  }
  try {
    const recentEntries = entries.slice(-MAX_LOCAL_PERSISTED_SCROLLS);
    const localObj: Record<string, number> = {};
    for (const [k, v] of recentEntries) {
      localObj[k] = v;
    }
    window.localStorage.setItem(
      PAGE_SCROLL_SESSION_KEY,
      JSON.stringify(localObj),
    );
  } catch {
    // Ignore localStorage quota / access errors
  }
}

function savePageScrollPosition(
  key: string,
  scrollY: number,
  immediate = false,
): void {
  if (!key || !Number.isFinite(scrollY)) return;
  const clamped = Math.max(0, Math.round(scrollY));
  if (savedPageScrollPositions.has(key)) {
    savedPageScrollPositions.delete(key);
  }
  savedPageScrollPositions.set(key, clamped);
  if (savedPageScrollPositions.size > MAX_SAVED_PAGE_SCROLLS) {
    const oldestKey = savedPageScrollPositions.keys().next().value;
    if (oldestKey) savedPageScrollPositions.delete(oldestKey);
  }
  if (immediate) {
    flushSavedPageScrollPositions();
  } else if (typeof window !== 'undefined' && pageScrollPersistTimer === null) {
    pageScrollPersistTimer = window.setTimeout(() => {
      pageScrollPersistTimer = null;
      flushSavedPageScrollPositions();
    }, 200);
  }
}

function getDocumentScrollY(): number {
  if (typeof window === 'undefined') return 0;
  return (
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement?.scrollTop ||
    document.body?.scrollTop ||
    0
  );
}

function getMaxDocumentScrollY(): number {
  if (typeof window === 'undefined') return 0;
  const docEl = document.documentElement;
  const scrollHeight = Math.max(
    docEl?.scrollHeight || 0,
    document.body?.scrollHeight || 0,
  );
  return Math.max(0, scrollHeight - window.innerHeight);
}

const STORY_IMAGE_SIZES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Mặc định theo Cấu hình' },
  { value: '920x1536', label: 'Khổ Dọc (920×1536 — Nhân vật / Kiếm hiệp)' },
  { value: '1536x920', label: 'Khổ Ngang (1536×920 — Đại cảnh giang hồ)' },
  { value: '1024x1024', label: 'Khổ Vuông 1:1 (1024×1024 — Avatar / Cận cảnh)' },
  { value: '1280x720', label: 'Ngang 16:9 (1280x720)' },
  { value: '720x1280', label: 'Dọc 9:16 (720x1280)' },
  { value: '896x1152', label: 'Chân dung 3:4 (896x1152)' },
];

function countWords(text: string): number {
  const clean = String(text || '').trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function extractTurnTimestamp(turn: Turn): number | null {
  if (
    typeof turn.createdAt === 'number' &&
    Number.isFinite(turn.createdAt) &&
    turn.createdAt > 1_000_000_000_000
  ) {
    return turn.createdAt;
  }
  const match = /(?:^|_)(\d{13})(?:$|_)/.exec(turn.id || '');
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 1_000_000_000_000) {
      return parsed;
    }
  }
  return null;
}

function formatDurationVi(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 giây';
  const totalSec = ms / 1000;
  if (totalSec < 60) {
    return totalSec < 10
      ? `${totalSec.toFixed(1).replace('.', ',')} giây`
      : `${Math.round(totalSec)} giây`;
  }
  const totalMin = Math.floor(totalSec / 60);
  const remSec = Math.round(totalSec % 60);
  if (totalMin < 60) {
    return remSec > 0 ? `${totalMin}p ${remSec}s` : `${totalMin} phút`;
  }
  const hours = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  return remMin > 0 ? `${hours}g ${remMin}p` : `${hours} giờ`;
}

const SUGGESTION_CATEGORY_STYLES: Record<TurnSuggestionCategory, string> = {
  continue: 'bg-sky-500/14 text-sky-200 ring-sky-400/28',
  tease: 'bg-amber-500/14 text-amber-200 ring-amber-400/28',
  probe: 'bg-violet-500/14 text-violet-200 ring-violet-400/28',
  move: 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/28',
  bold: 'bg-rose-500/14 text-rose-200 ring-rose-400/28',
  rest: 'bg-indigo-500/14 text-indigo-200 ring-indigo-400/28',
};

interface DialoguePronounPair {
  self: string;
  other: string;
  otherNarr: string;
  selfCap: string;
  otherCap: string;
  we: string;
  hasPersonalPair: boolean;
}

function capFirstVi(s: string): string {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s;
}

function inferCharacterGenderHint(
  name: string | null | undefined,
  prose: string,
  npcs: CompanionNpc[],
): 'female' | 'male' | null {
  const clean = (name || '').trim();
  if (!clean) return null;

  const celeb = lookupKnownCelebrityProfile(clean);
  if (celeb) {
    const celebMeta = `${celeb.role || ''} ${celeb.appearance || ''}`.toLowerCase();
    if (
      /(?:nữ|cô|nàng|mỹ nhân|ca sĩ nữ|người mẫu nữ|nữ diễn viên|female|woman|girl|actress|model|singer|blackpink|twice|aespa|ive|kardashian|jenner|jennie|jisoo|rosé|lisa|kendall|kylie|bella|gigi|taylor|selena|ariana|dua|scarlett|margot|emma|anne|sydney)/i.test(
        `${celeb.canonicalName} ${celebMeta}`,
      )
    ) {
      return 'female';
    }
    if (
      /(?:nam|anh|chàng|nam diễn viên|nam ca sĩ|male|man|actor)/i.test(celebMeta)
    ) {
      return 'male';
    }
  }

  const targetKey = normalizeCharacterKey(clean);
  const matchedNpc = npcs.find(
    (n) => normalizeCharacterKey(n.name) === targetKey,
  );
  if (matchedNpc) {
    const npcBlob = `${matchedNpc.role || ''} ${matchedNpc.desc || ''} ${matchedNpc.appearance || ''} ${matchedNpc.fashionStyle || ''}`.toLowerCase();
    if (
      /(?:nữ|cô|nàng|tiểu thư|váy|đầm|son môi|tóc dài|gợi cảm|xinh đẹp|nữ thần|ca sĩ nữ|người mẫu nữ|idol nữ|bạn gái|vợ)/i.test(
        npcBlob,
      )
    ) {
      return 'female';
    }
    if (
      /(?:nam|công tử|thiếu gia|tổng tài|bạn trai|chồng|vest nam|điển trai|tuấn tú|đàn ông)/i.test(
        npcBlob,
      )
    ) {
      return 'male';
    }
  }

  // Inspect unquoted prose sentences mentioning this character for nearby Vietnamese pronouns
  const unquoted = String(prose ?? '')
    .replace(/“[^”\n]{1,700}”/g, ' ')
    .replace(/"[^"\n]{1,700}"/g, ' ')
    .replace(/«[^»\n]{1,700}»/g, ' ');
  const sentences = unquoted.split(/(?<=[.!?…])\s+|\n+/);
  let femScore = 0;
  let maleScore = 0;
  const escaped = String(clean ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRe = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'iu');

  for (const s of sentences) {
    if (!nameRe.test(s)) continue;
    const afterName = s.slice(s.search(nameRe) + clean.length);
    const beforeName = s.slice(0, s.search(nameRe));
    if (
      /(?:^|[^\p{L}])(?:cô\s+ấy|cô\s+nàng|cô\s+bé|nàng|cô)(?=$|[^\p{L}])/iu.test(
        afterName.slice(0, 80),
      ) ||
      /(?:cô|nàng|em)\s+$/iu.test(beforeName.slice(-16))
    ) {
      femScore += 2;
    }
    if (
      /(?:^|[^\p{L}])(?:anh\s+ấy|hắn|chàng|gã|anh)(?=$|[^\p{L}])/iu.test(
        afterName.slice(0, 80),
      ) ||
      /(?:anh|chàng|hắn)\s+$/iu.test(beforeName.slice(-16))
    ) {
      maleScore += 2;
    }
  }

  if (femScore > maleScore) return 'female';
  if (maleScore > femScore) return 'male';
  return null;
}

function detectDialoguePronounPair(params: {
  proseText: string;
  actorName: string | null;
  targetName: string | null;
  mcPronoun: string;
  npcs: CompanionNpc[];
  isAncient: boolean;
  isIntimateOrWarm: boolean;
}): DialoguePronounPair {
  const {
    proseText,
    actorName,
    targetName,
    mcPronoun,
    npcs,
    isAncient,
    isIntimateOrWarm,
  } = params;

  const quoteMatches =
    proseText.match(/“[^”\n]{1,700}”|"[^"\n]{1,700}"|«[^»\n]{1,700}»/g) || [];
  const quotesBlob = quoteMatches.join(' ');

  const actorGender = inferCharacterGenderHint(actorName, proseText, npcs);
  const targetGender = inferCharacterGenderHint(targetName, proseText, npcs);
  const mcPronounNorm = normalizeCharacterKey(mcPronoun || '');

  const makePair = (
    self: string,
    other: string,
    otherNarr: string,
    we: string,
    hasPersonalPair: boolean,
  ): DialoguePronounPair => ({
    self,
    other,
    otherNarr,
    selfCap: capFirstVi(self),
    otherCap: capFirstVi(other),
    we,
    hasPersonalPair,
  });

  if (isAncient) {
    const hasHuynhMuoi =
      /(?:^|[^\p{L}])(?:huynh|muội)(?=$|[^\p{L}])/iu.test(quotesBlob);
    if (hasHuynhMuoi) {
      return actorGender === 'female'
        ? makePair('muội', 'huynh', 'huynh ấy', 'hai ta', true)
        : makePair('huynh', 'muội', 'muội ấy', 'hai ta', true);
    }
    if (
      /(?:^|[^\p{L}])nàng(?=$|[^\p{L}])/iu.test(proseText) ||
      targetGender === 'female'
    ) {
      return makePair('ta', 'nàng', 'nàng', 'hai ta', true);
    }
    if (
      /(?:^|[^\p{L}])chàng(?=$|[^\p{L}])/iu.test(proseText) ||
      (actorGender === 'female' && targetGender === 'male')
    ) {
      return makePair('ta', 'chàng', 'chàng', 'hai ta', true);
    }
    return makePair('ta', targetName || 'ngươi', targetName || 'người trước mặt', 'hai ta', false);
  }

  const hasAnh = /(?:^|[^\p{L}])anh(?=$|[^\p{L}])/iu.test(quotesBlob);
  const hasEm = /(?:^|[^\p{L}])em(?=$|[^\p{L}])/iu.test(quotesBlob);
  const hasCau = /(?:^|[^\p{L}])cậu(?=$|[^\p{L}])/iu.test(quotesBlob);
  const hasToMinh = /(?:^|[^\p{L}])(?:tớ|mình)(?=$|[^\p{L}])/iu.test(quotesBlob);

  if (hasAnh && hasEm) {
    if (
      (actorGender === 'female' && targetGender === 'male') ||
      mcPronounNorm === 'em' ||
      (actorGender === 'female' && !targetGender)
    ) {
      return makePair('em', 'anh', 'anh', 'hai đứa mình', true);
    }
    return makePair('anh', 'em', 'em', 'hai đứa mình', true);
  }

  if (hasCau && hasToMinh) {
    return makePair('mình', 'cậu', 'cậu', 'hai đứa mình', true);
  }

  if (isIntimateOrWarm) {
    if (actorGender === 'female' && targetGender === 'male') {
      return makePair('em', 'anh', 'anh', 'hai đứa mình', true);
    }
    if (
      (actorGender === 'male' && targetGender === 'female') ||
      (targetGender === 'female' && mcPronounNorm !== 'em' && mcPronounNorm !== 'co')
    ) {
      return makePair('anh', 'em', 'em', 'hai đứa mình', true);
    }
  }

  if (mcPronounNorm === 'anh') {
    return makePair('anh', 'em', targetGender === 'female' ? 'em' : targetName || 'em', 'hai đứa mình', true);
  }
  if (mcPronounNorm === 'em') {
    return makePair('em', 'anh', targetGender === 'male' ? 'anh' : targetName || 'anh', 'hai đứa mình', true);
  }
  if (mcPronounNorm === 'toi' && targetGender === 'female') {
    return makePair('tôi', 'cô', 'cô', 'chúng ta', true);
  }
  if (mcPronounNorm === 'toi' && targetGender === 'male') {
    return makePair('tôi', 'anh', 'anh', 'chúng ta', true);
  }

  const fallbackNarr =
    targetGender === 'female'
      ? 'cô'
      : targetGender === 'male'
        ? 'anh'
        : targetName || 'người bên cạnh';
  return makePair('mình', targetName || 'cậu', fallbackNarr, 'hai đứa mình', false);
}

type SuggestionGenreRealm =
  | 'xianxia'
  | 'ancient'
  | 'fantasy'
  | 'showbiz'
  | 'modern';

function resolveSuggestionRealm(params: {
  world?: WorldInfo;
  eraLabel?: string;
  envBlob: string;
}): SuggestionGenreRealm {
  const { world, eraLabel, envBlob } = params;
  const g = world?.genre;
  const worldMeta = `${world?.name || ''} ${world?.genreLabel || ''} ${world?.setting || ''} ${world?.atmosphere || ''} ${world?.eraLabel || ''} ${eraLabel || ''}`;
  const full = `${worldMeta}\n${envBlob}`;

  if (
    g === 'xianxia' ||
    g === 'xuanhuan' ||
    /(?:tông\s+môn|linh\s+khí|đan\s+dược|tu\s+vi|trúc\s+cơ|kim\s+đan|nguyên\s+anh|kiếm\s+khí|linh\s+thạch|pháp\s+bảo|động\s+phủ|trận\s+pháp|tiên\s+môn|yêu\s+thú|bí\s+cảnh|huyền\s+lực|đấu\s+khí|trưởng\s+lão|sư\s+tỷ|sư\s+muội|sư\s+huynh|sư\s+tôn|tiên\s+tử|tu\s+tiên|huyền\s+huyễn)/i.test(
      full,
    )
  ) {
    return 'xianxia';
  }

  if (
    g === 'ancient' ||
    Boolean(eraLabel?.trim()) ||
    /(?:triều\s+đình|hoàng\s+cung|điện\s+hạ|vương\s+gia|công\s+tử|tiểu\s+thư|tửu\s+lâu|giang\s+hồ|kiếm\s+khách|hiệp\s+nữ|khách\s+điếm|phu\s+nhân|tướng\s+quân|nha\s+môn|trà\s+lâu|thư\s+phòng|phủ\s+đệ|cổ\s+đại|kiếm\s+hiệp)/i.test(
      full,
    )
  ) {
    return 'ancient';
  }

  if (
    g === 'fantasy' ||
    g === 'apocalypse' ||
    g === 'scifi' ||
    /(?:ma\s+pháp|pháp\s+sư|công\s+hội|mạo\s+hiểm|hầm\s+ngục|căn\s+cứ|sinh\s+tồn|tang\s+thi|dị\s+năng|phi\s+thuyền|trạm\s+không\s+gian|vũ\s+trụ|mạt\s+thế|khoa\s+huyễn|kỳ\s+ảo)/i.test(
      full,
    )
  ) {
    return 'fantasy';
  }

  if (
    g === 'showbiz' ||
    /(?:showbiz|sân\s+khấu|hậu\s+trường|studio|phòng\s+thu|thảm\s+đỏ|ống\s+kính|paparazzi|lịch\s+trình|beverly\s+hills|hollywood|biệt\s+thự|penthouse|tour\s+diễn|album|tạp\s+chí|blackpink|jenner|kardashian|giải\s+trí)/i.test(
      full,
    )
  ) {
    return 'showbiz';
  }

  return 'modern';
}

function resolveSceneLocationLabel(
  curLocation: string,
  tailText: string,
  realm: SuggestionGenreRealm,
): string {
  const cleanStateLoc = String(curLocation ?? '')
    .replace(/^tại\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleanStateLoc && cleanStateLoc.length >= 3 && cleanStateLoc.length <= 44) {
    return cleanStateLoc;
  }

  const knownPlacePatterns: Array<[RegExp, string]> = [
    [/beverly\s+hills/i, 'biệt thự trên đồi Beverly Hills'],
    [/phòng\s+ngủ/i, 'phòng ngủ'],
    [/phòng\s+khách/i, 'phòng khách'],
    [/ban\s+công/i, 'ban công'],
    [/biệt\s+thự/i, 'biệt thự'],
    [/penthouse/i, 'căn penthouse'],
    [/phòng\s+thu|studio/i, 'phòng thu'],
    [/hậu\s+trường/i, 'hậu trường'],
    [/nhà\s+hàng/i, 'nhà hàng'],
    [/quán\s+cà\s+phê/i, 'quán cà phê'],
    [/tửu\s+lâu/i, 'tửu lâu'],
    [/trà\s+lâu|trà\s+thất/i, 'trà lâu'],
    [/khách\s+điếm/i, 'khách điếm'],
    [/phường\s+thị/i, 'phường thị'],
    [/bí\s+cảnh/i, 'bí cảnh'],
    [/đại\s+điện/i, 'đại điện'],
    [/hậu\s+sơn/i, 'hậu sơn'],
    [/thư\s+phòng/i, 'thư phòng'],
    [/căn\s+cứ/i, 'căn cứ'],
    [/công\s+hội/i, 'công hội'],
  ];

  for (const [re, label] of knownPlacePatterns) {
    if (re.test(tailText)) return label;
  }

  if (realm === 'xianxia') return 'nơi này';
  if (realm === 'ancient') return 'chốn này';
  return 'chỗ này';
}

function hashSuggestionSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function getClockTransitionPhrase(
  hour: number,
  realm: SuggestionGenreRealm,
  ctx: {
    isIntimate: boolean;
    isBedroom: boolean;
    hasHillOrView: boolean;
    p: DialoguePronounPair;
  },
): {
  periodShort: string;
  moveTimeHint: string;
  restWithPair: (subject: string, target: string) => string[];
  restSolo: (name: string) => string[];
  restGeneric: (subjPrefix: string) => string[];
} {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  const isClassical = realm === 'xianxia' || realm === 'ancient';
  const { isIntimate, isBedroom, hasHillOrView, p } = ctx;
  const viewPhrase = hasHillOrView ? 'ngoài cửa kính' : 'ngoài cửa sổ';

  if (h >= 4 && h <= 5) {
    return {
      periodShort: 'rạng sáng',
      moveTimeHint: isClassical ? 'khi sương sớm còn giăng' : 'đón gió đầu ngày',
      restWithPair: (s, t) =>
        realm === 'xianxia'
          ? [
              `${s} liếc ráng hồng ngoài hiên, hất cằm bảo ${t}: "Còn sớm, ngủ bù một khắc rồi hẳn lên đường."`,
              `${s} khép hờ cửa chắn sương, hẹn ${t} nghỉ tạm tới khi trời tỏ rồi ra phường thị.`,
              `${s} đặt chén trà nóng xuống bàn, bảo ${t} dưỡng thần thêm chút nữa kẻo lát lại thiếu sức.`,
              `${s} chuyển nhịp sang lúc trời sáng hẳn, cả hai chỉnh đốn hành trang chuẩn bị cho việc hôm nay.`,
            ]
          : realm === 'ancient'
            ? [
                `${s} nhìn trời mới tờ mờ ngoài hiên, bảo ${t} cứ chợp mắt thêm một canh rồi hẵng tính.`,
                `${s} khép bớt cửa gỗ chắn gió sương, tạm dừng chuyện đang dở chờ sáng rõ nói tiếp.`,
                `${s} rót chén nước ấm cho ${t}: "Còn sớm lắm, nghỉ thêm chút đi, việc hôm nay không vội."`,
                `${s} chờ tới khi nắng sớm lên qua mái ngói rồi mới gọi ${t} dùng điểm tâm.`,
              ]
            : realm === 'fantasy'
              ? [
                  `${s} nhìn đồng hồ lúc rạng sáng, bảo ${t} tranh thủ chợp mắt thêm trước giờ xuất phát.`,
                  `${s} nhận ca gác một lát để ${t} ngủ bù, hẹn trời sáng rõ hẳn sẽ gọi dậy.`,
                  `${s} thu gọn đồ đạc lại, để cả hai nghỉ ngắn rồi chuyển cảnh sang đầu buổi sáng.`,
                  `${s} ngả lưng cạnh ${t}: "Còn gần tiếng nữa mới sáng, nghỉ nạp sức chút đã."`,
                ]
              : [
                  `${s} liếc trời mới tờ mờ ${viewPhrase}, kéo chăn lên bảo ${t}: "Còn sớm, ngủ nướng thêm chút nữa đi."`,
                  `${s} tắt báo thức sớm, nằm lười cạnh ${t} thêm nửa tiếng rồi mới tính chuyện ăn sáng.`,
                  `${s} quay sang ${t}: "Tỉnh sớm quá rồi, ${p.we} nằm ườn thêm lát nữa rồi dậy pha cà phê."`,
                  `${s} tạm khép cảnh rạng sáng, chuyển nhanh sang lúc nắng đã lên và cả hai bắt đầu ngày mới.`,
                ],
      restSolo: (n) =>
        isClassical
          ? [
              `${n} khép cửa chắn sương, chợp mắt thêm một khắc rồi mới khởi hành.`,
              `${n} nhấp chén trà nóng chờ trời sáng hẳn, gác mọi việc sang đầu buổi sáng.`,
              `${n} ngồi tĩnh tâm ít phút ngoài hiên, đợi nắng lên mới bắt đầu lịch trình.`,
            ]
          : [
              `${n} tắt báo thức ngủ nướng thêm một giấc ngắn trước khi bắt đầu ngày mới.`,
              `${n} nằm ườn thêm chút nữa ${viewPhrase} còn tờ mờ, chờ sáng hẳn mới dậy.`,
              `${n} pha ly đồ uống nóng, thả lỏng vài phút rồi chuyển sang lịch trình buổi sáng.`,
            ],
      restGeneric: (pre) => [
        `${pre ? `${pre}tranh` : 'Tranh'} thủ ngủ bù thêm chút lúc trời còn tờ mờ, sáng hẳn rồi tính tiếp.`,
        `${pre ? `${pre}tạm` : 'Tạm'} dừng nhịp một lát, chuyển nhanh sang đầu buổi sáng khi mọi thứ bắt đầu nhộn nhịp.`,
        `${pre ? `${pre}ngả` : 'Ngả'} lưng nghỉ ngắn chờ bình minh lên rõ rồi mới xuất phát.`,
      ],
    };
  }

  if (h >= 6 && h <= 10) {
    return {
      periodShort: 'buổi sáng',
      moveTimeHint: isClassical ? 'dưới nắng sớm quang đãng' : 'trong nắng sáng',
      restWithPair: (s, t) =>
        realm === 'xianxia'
          ? [
              `${s} liếc bóng nắng đã lên cao, rủ ${t} tạm ngưng việc buổi sớm đi kiếm gì bỏ bụng đã.`,
              `${s} cất đồ trên bàn, hẹn ${t} nghỉ chân tới quá ngọ rồi chiều mới xử lý việc kế tiếp.`,
              `${s} đứng dậy vươn vai: "Sáng nay chạy đủ rồi, ${p.we} ghé tửu lâu ăn bữa ra trò đi."`,
              `${s} tạm dừng chuyện đang bàn với ${t}, chuyển nhịp sang giữa trưa cho thư thả.`,
            ]
          : realm === 'ancient'
            ? [
                `${s} nhìn nắng đã lên qua hiên, bảo ${t} gác chuyện lại đi dùng bữa trưa trước đã.`,
                `${s} thu gọn giấy mực trên bàn, hẹn ${t} nghỉ qua giờ ngọ rồi chiều bàn tiếp.`,
                `${s} vươn vai nhìn ${t}: "Cũng sắp trưa rồi, ${p.we} đi ăn chút gì kẻo đói."`,
                `${s} tạm khép buổi sáng, cùng ${t} nghỉ chân tới đầu giờ chiều.`,
              ]
            : realm === 'fantasy'
              ? [
                  `${s} gấp bản đồ lại, rủ ${t} dừng tay ăn trưa nạp sức rồi đầu chiều đi tiếp.`,
                  `${s} ném cho ${t} chai nước mát: "Nghỉ tới trưa đi, chạy thông buổi sáng mệt lắm."`,
                  `${s} tạm dừng kế hoạch buổi sáng cùng ${t}, chuyển cảnh sang giờ ăn trưa.`,
                  `${s} gác vũ khí sang bên, bảo ${t} tranh thủ nghỉ ngơi chút trước khi tới chặng sau.`,
                ]
              : isIntimate || isBedroom
                ? [
                    `${s} kéo hé rèm cho nắng vào phòng, gọi ${t}: "Dậy đi hay định ngủ nướng tới trưa luôn đấy?"`,
                    `${s} vươn vai khỏi giường, rủ ${t} đi rửa mặt rồi xuống pha cà phê ăn sáng.`,
                    `${s} nằm ườn cạnh ${t}: "Sáng nay khỏi vội, nằm thêm chục phút nữa rồi đi kiếm đồ ăn."`,
                    `${s} tạm khép buổi sáng lười biếng cùng ${t}, chuyển nhịp sang gần trưa.`,
                  ]
                : [
                    `${s} liếc đồng hồ, bảo ${t}: "Sắp trưa rồi, tạm dừng ở đây đi kiếm gì ngon ăn đã."`,
                    `${s} gập máy lại, rủ ${t} nghỉ tay làm ly cà phê rồi chiều xử lý tiếp.`,
                    `${s} ngả người ra ghế nhìn ${t}: "Xả hơi chút đi, sáng nay thế là đủ năng suất rồi."`,
                    `${s} tạm khép cuộc nói chuyện buổi sáng cùng ${t}, chuyển cảnh sang bữa trưa.`,
                  ],
      restSolo: (n) =>
        isClassical
          ? [
              `${n} thu xếp đồ đạc, tạm gác chuyện buổi sáng để ghé quán ăn bữa trưa.`,
              `${n} nghỉ chân dưới hiên mát, chờ quá ngọ rồi mới đi tiếp.`,
              `${n} chuyển nhịp nhanh sang buổi trưa, nạp lại tinh thần cho chặng kế.`,
            ]
          : [
              `${n} vươn vai đứng dậy, tạm nghỉ tay đi pha cà phê và ăn lót dạ.`,
              `${n} gác hết lịch trình buổi sáng sang bên, xả hơi tới gần trưa rồi tính tiếp.`,
              `${n} chuyển cảnh gọn sang giờ trưa sau khi xử lý xong việc buổi sáng.`,
            ],
      restGeneric: (pre) => [
        `${pre ? `${pre}tạm` : 'Tạm'} gác việc buổi sáng, đi kiếm đồ ăn rồi nghỉ chân tới trưa.`,
        `${pre ? `${pre}xả` : 'Xả'} hơi vài chục phút, chuyển nhịp sang bữa trưa cho thoải mái.`,
        `${pre ? `${pre}dừng` : 'Dừng'} tay làm ly cà phê, đợi quá trưa rồi tính bước kế tiếp.`,
      ],
    };
  }

  if (h >= 11 && h <= 12) {
    return {
      periodShort: 'buổi trưa',
      moveTimeHint: 'chỗ râm mát tránh nắng trưa',
      restWithPair: (s, t) =>
        isClassical
          ? [
              `${s} khép bớt cửa tránh nắng gắt, bảo ${t}: "Giữa trưa nóng lắm, nghỉ lưng tới chiều mát hẵng đi."`,
              `${s} đặt chén trà mát trước mặt ${t}, hẹn cả hai ngủ trưa một lát qua giờ ngọ.`,
              `${s} gác chuyện sang bên, rủ ${t} ăn trưa xong rồi nghỉ cho lại sức.`,
              `${s} tạm dừng nhịp giữa trưa, chuyển cảnh sang đầu giờ chiều khi nắng dịu xuống.`,
            ]
          : [
              `${s} kéo rèm che nắng trưa, bảo ${t}: "Ăn xong rồi, ngủ trưa nửa tiếng lấy sức đi."`,
              `${s} ngả phịch ra ghế nhìn ${t}: "Trưa nắng đổ lửa thế này, ở yên trong phòng tránh nóng đã."`,
              `${s} đẩy ly nước đá về phía ${t}, hẹn tạm gác mọi việc tới đầu chiều hẵng tính.`,
              `${s} chuyển nhanh qua giờ nghỉ trưa cùng ${t}, sang đầu buổi chiều cho gọn nhịp.`,
            ],
      restSolo: (n) => [
        `${n} kéo rèm tránh nắng trưa, chợp mắt một giấc ngắn tới đầu giờ chiều.`,
        `${n} ăn trưa xong liền xả hơi trong phòng mát, bỏ qua mọi việc tới chiều.`,
        `${n} chuyển nhanh qua giờ trưa, đợi nắng dịu xuống mới bắt đầu việc tiếp theo.`,
      ],
      restGeneric: (pre) => [
        `${pre ? `${pre}tránh` : 'Tránh'} nắng giữa trưa, chợp mắt một lát rồi đầu chiều tính tiếp.`,
        `${pre ? `${pre}ăn` : 'Ăn'} trưa xong liền xả hơi, chuyển cảnh sang đầu buổi chiều.`,
        `${pre ? `${pre}tạm` : 'Tạm'} gác mọi chuyện qua giờ trưa, nạp sức cho chặng chiều.`,
      ],
    };
  }

  if (h >= 13 && h <= 17) {
    return {
      periodShort: 'buổi chiều',
      moveTimeHint: 'khi nắng chiều bắt đầu dịu',
      restWithPair: (s, t) =>
        realm === 'xianxia'
          ? [
              `${s} nhìn ráng chiều ngoài mái ngói, bảo ${t} nghỉ chân uống trà chờ tối phố lên đèn.`,
              `${s} thu đồ lại, hẹn ${t} thả lỏng tới hoàng hôn rồi tối đi kiếm chỗ ăn uống.`,
              `${s} gác chuyện sang bên: "Chiều cũng sắp tàn rồi, nghỉ tay đợi tối mát rồi tính."`,
              `${s} tạm khép buổi chiều cùng ${t}, chuyển cảnh sang lúc phố chợ vừa lên đèn.`,
            ]
          : realm === 'ancient'
            ? [
                `${s} thấy bóng nắng chiều nghiêng ngoài hiên, rủ ${t} nghỉ tay chờ tối dùng bữa.`,
                `${s} châm thêm ấm trà mới, ngồi tán gẫu vu vơ với ${t} tới lúc hoàng hôn buông.`,
                `${s} cất gọn đồ đạc, hẹn ${t} nghỉ ngơi tới chập tối rồi tính chuyện kế tiếp.`,
                `${s} tạm dừng buổi chiều yên ắng, chuyển nhịp sang bữa tối cùng ${t}.`,
              ]
            : isIntimate || isBedroom
              ? [
                  `${s} nhìn nắng chiều ngả vàng ${viewPhrase}, bảo ${t}: "Chiều nay khỏi chạy đâu nữa, nằm lười đợi tối đi ăn."`,
                  `${s} quăng điện thoại sang bên, rủ ${t} ngủ bù một giấc chiều rồi tối ${p.self} gọi dậy.`,
                  `${s} thả lỏng bên ${t}, để buổi chiều trôi chậm lại rồi chuyển cảnh sang lúc thành phố lên đèn.`,
                  `${s} bảo ${t} cứ nghỉ thoải mái, lát chập tối hai đứa thay đồ đi kiếm món gì ngon.`,
                ]
              : [
                  `${s} liếc nắng chiều dịu xuống ${viewPhrase}, bảo ${t}: "Nghỉ tay đi, đợi tối mát ${p.we} đi ăn."`,
                  `${s} gập máy lại, rủ ${t} xả hơi hết buổi chiều không cần vội nữa.`,
                  `${s} tựa lưng ra ghế nói với ${t}: "Chiều nay chốt tới đây thôi, tối tính tiếp."`,
                  `${s} tạm dừng nhịp buổi chiều cùng ${t}, chuyển nhanh sang lúc chập tối.`,
                ],
      restSolo: (n) => [
        `${n} tựa lưng nghỉ chân hết buổi chiều, chờ trời chuyển hoàng hôn rồi đi ăn tối.`,
        `${n} tạm gác mọi việc, làm ly đồ uống mát xả hơi cho tới chập tối.`,
        `${n} chuyển nhịp gọn sang lúc trời sập tối và thành phố bắt đầu lên đèn.`,
      ],
      restGeneric: (pre) => [
        `${pre ? `${pre}tạm` : 'Tạm'} dừng tay xả hơi hết buổi chiều, chờ trời chập tối đi ăn.`,
        `${pre ? `${pre}ngả` : 'Ngả'} lưng nghỉ ngắn, chuyển cảnh sang lúc hoàng hôn buông xuống.`,
        `${pre ? `${pre}gác` : 'Gác'} mọi việc sang bên, chờ buổi tối mát mẻ rồi mới tính bước tiếp.`,
      ],
    };
  }

  if (h === 18) {
    return {
      periodShort: 'chập tối',
      moveTimeHint: isClassical ? 'khi phố vừa thắp đèn lồng' : 'khi ngoài phố vừa lên đèn',
      restWithPair: (s, t) =>
        isClassical
          ? [
              `${s} thấy đèn lồng ngoài phố đã sáng, rủ ${t} sửa soạn rồi đi dùng bữa tối.`,
              `${s} châm đèn trong phòng, bảo ${t} tạm dừng hết mọi việc để ăn tối trước đã.`,
              `${s} nhìn trời vừa sập tối, hẹn ${t} nghỉ chân vài khắc rồi bước vào chuyện tối nay.`,
              `${s} gác chuyện dang dở lại, chuyển cảnh sang bữa tối cùng ${t}.`,
            ]
          : [
              `${s} nhìn ngoài phố vừa lên đèn, bảo ${t}: "Tối rồi đấy, sửa soạn chút rồi đi ăn thôi."`,
              `${s} bật đèn phòng lên, rủ ${t} tắm rửa thay đồ cho thoải mái trước khi ăn tối.`,
              `${s} quay sang ${t}: "Chốt sổ hôm nay ở đây nhé, đi kiếm bữa tối thật ngon trước đã."`,
              `${s} tạm dừng mọi việc lúc chập tối, chuyển nhịp sang buổi tối cùng ${t}.`,
            ],
      restSolo: (n) => [
        `${n} bật đèn khi trời vừa sập tối, chỉnh lại đồ đạc rồi đi ăn tối.`,
        `${n} kéo rèm lại lúc ngoài phố lên đèn, xả hơi vài phút trước bữa tối.`,
        `${n} tạm dừng nhịp chập tối, chuyển cảnh sang buổi tối thư thả.`,
      ],
      restGeneric: (pre) => [
        `${pre ? `${pre}bật` : 'Bật'} đèn khi trời chập tối, sửa soạn gọn gàng rồi đi ăn tối.`,
        `${pre ? `${pre}dừng` : 'Dừng'} tay lúc ngoài kia vừa lên đèn, chuyển sang không khí buổi tối.`,
        `${pre ? `${pre}nghỉ` : 'Nghỉ'} vài phút xả hơi trước khi bắt đầu bữa tối.`,
      ],
    };
  }

  if (h >= 19 && h <= 21) {
    return {
      periodShort: 'buổi tối',
      moveTimeHint: isClassical ? 'dưới ánh đèn lồng gió mát' : 'ngoài trời tối mát',
      restWithPair: (s, t) =>
        isClassical
          ? [
              `${s} khép cửa chắn gió đêm, bảo ${t}: "Tối hẳn rồi, hôm nay nghỉ sớm cho khỏe."`,
              `${s} dọn gọn chén trà trên bàn, bảo ${t} về phòng nghỉ ngơi lấy sức cho ngày mai.`,
              `${s} vặn nhỏ bấc đèn, hẹn ${t} mọi chuyện còn lại để sáng mai trời tỏ tính tiếp.`,
              `${s} tạm khép buổi tối yên tĩnh cùng ${t}, chuyển cảnh sang sáng hôm sau.`,
            ]
          : isIntimate || isBedroom
            ? [
                `${s} vặn nhỏ đèn ngủ, quăng điện thoại sang tủ rồi bảo ${t}: "Tối nay khỏi nghĩ nữa, nghỉ sớm đi."`,
                `${s} tắt bớt đèn lớn cho phòng dịu lại, nằm thả lỏng cạnh ${t} tán gẫu mấy câu trước khi ngủ.`,
                `${s} kéo chăn lên nhìn ${t}: "Hôm nay thế là đủ dài rồi, ngủ sớm nạp pin cho mai nhé."`,
                `${s} tạm khép buổi tối bên ${t}, chuyển nhịp mượt sang sáng hôm sau.`,
              ]
            : [
                `${s} ngả lưng ra ghế nhìn ${t}: "Tối nay ở yên xả hơi thôi, có gì để mai tính."`,
                `${s} dọn gọn đồ trên bàn, bảo ${t} tối nay nghỉ sớm kẻo mai lại thiếu ngủ.`,
                `${s} đặt ly nước xuống: "Dừng kèo ở đây nhé ${p.other}, về nghỉ cho thoải mái."`,
                `${s} tạm khép buổi tối cùng ${t}, chuyển nhanh sang sáng hôm sau.`,
              ],
      restSolo: (n) =>
        isClassical
          ? [
              `${n} khép cửa chắn gió đêm, tắt bớt đèn rồi nghỉ sớm lấy sức cho mai.`,
              `${n} đặt chén trà xuống, gác mọi chuyện lại chờ sáng mai tính tiếp.`,
              `${n} về phòng nghỉ ngơi trọn vẹn buổi tối, chuyển cảnh sang bình minh.`,
            ]
          : [
              `${n} tắt đèn lớn, bật chế độ im lặng điện thoại rồi đi ngủ sớm.`,
              `${n} thả lỏng trên giường, chốt sổ một ngày dài để nạp pin cho sáng mai.`,
              `${n} tạm khép buổi tối, chuyển nhanh sang sáng hôm sau.`,
            ],
      restGeneric: (pre) => [
        `${pre ? `${pre}vặn` : 'Vặn'} nhỏ đèn, xả hơi buổi tối rồi đi ngủ sớm.`,
        `${pre ? `${pre}gác` : 'Gác'} mọi bận tâm sang mai, kết thúc ngày hôm nay gọn gàng.`,
        `${pre ? `${pre}chuyển` : 'Chuyển'} nhanh qua buổi tối yên tĩnh sang sáng hôm sau.`,
      ],
    };
  }

  return {
    periodShort: 'đêm khuya',
    moveTimeHint: 'giữa đêm yên tĩnh',
    restWithPair: (s, t) =>
      isClassical
        ? [
            `${s} thổi tắt ngọn nến cuối, bảo ${t}: "Canh đã khuya, ngủ một giấc tới sáng rồi tính."`,
            `${s} khép cửa nghỉ đêm cùng ${t}, hẹn sáng mai trời sáng rõ mới bàn chuyện tiếp.`,
            `${s} chúc ${t} ngủ ngon gọn gàng rồi tạm dừng mọi việc tới bình minh hôm sau.`,
            `${s} tắt đèn đi nghỉ, chuyển cảnh thẳng sang sáng hôm sau cùng ${t}.`,
          ]
        : [
            `${s} với tay tắt đèn ngủ, bảo ${t}: "Khuya lắm rồi, ngủ thôi, có gì sáng mai xử lý."`,
            `${s} bật chế độ im lặng điện thoại, kéo chăn lên ngang vai ${t} rồi nhắm mắt ngủ qua đêm.`,
            `${s} ngáp một cái nhìn ${t}: "Hết pin thật rồi, chúc ${p.other} ngủ ngon nhé."`,
            `${s} tắt hết đèn trong phòng, chuyển cảnh thẳng sang sáng hôm sau cùng ${t}.`,
          ],
    restSolo: (n) =>
      isClassical
        ? [
            `${n} thổi tắt nến, kéo chăn ngủ một giấc sâu tới sáng mai.`,
            `${n} khép cửa nghỉ đêm, gác mọi chuyện sang bình minh hôm sau.`,
            `${n} tắt đèn đi ngủ, chuyển cảnh thẳng sang sáng hôm sau.`,
          ]
        : [
            `${n} tắt đèn đầu giường, đặt điện thoại xuống rồi ngủ một giấc thẳng tới sáng.`,
            `${n} kết thúc ngày dài lúc đêm muộn, chuyển cảnh nhanh sang sáng hôm sau.`,
            `${n} kéo chăn lên vai, tắt hết thông báo rồi ngủ bù cho lại sức.`,
          ],
    restGeneric: (pre) => [
      `${pre ? `${pre}tắt` : 'Tắt'} đèn đầu giường, ngủ một giấc sâu tới sáng hôm sau.`,
      `${pre ? `${pre}khép` : 'Khép'} lại ngày dài lúc đêm muộn, chuyển cảnh sang sáng mai.`,
      `${pre ? `${pre}bật` : 'Bật'} chế độ im lặng rồi đi ngủ, mọi việc để sáng mai hẵng tính.`,
    ],
  };
}

function buildLocalTurnSuggestions(params: {
  currentTurn?: Turn;
  recentTurns?: Turn[];
  world?: WorldInfo;
  npcs: CompanionNpc[];
  portraitBank: PortraitBankConfig;
  memoryConfig: MemoryManagerConfig;
  mcName: string;
  mcPronoun: string;
  mcAbsentAtStart?: boolean;
  storyClock: ReturnType<typeof normalizeStoryClock>;
  clockFmt: ReturnType<typeof formatStoryClock>;
  variant: number;
}): {
  items: TurnSuggestionItem[];
  primaryNpc: string | null;
  presentNames: string[];
  presentCharacters: ResolvedSceneCharacterRole[];
} {
  const {
    currentTurn,
    recentTurns = [],
    world,
    npcs,
    portraitBank,
    memoryConfig,
    mcName,
    mcPronoun,
    mcAbsentAtStart,
    storyClock,
    clockFmt,
    variant,
  } = params;

  const rawAi = currentTurn?.assistant || '';
  const cleanAi = rawAi ? stripStoryPlanningAndMeta(rawAi) : '';
  const cleanUser = currentTurn?.user || '';
  const tailText = cleanAi.slice(-1500);
  const recentCombined = [
    ...recentTurns
      .slice(-1)
      .map((t) => stripStoryPlanningAndMeta(t.assistant || '')),
    cleanUser,
    cleanAi,
  ]
    .filter(Boolean)
    .join('\n');

  const sceneChars = resolveActiveSceneCharacters({
    currentUserText: cleanUser,
    currentAiText: rawAi,
    recentTurns,
    mcName,
    mcPronoun,
    mcAbsentAtStart,
    npcs,
    portraits: portraitBank?.portraits,
    characterStates: memoryConfig?.characterStates,
    isolateUnconfirmedPortraits: true,
  });

  const presentNames = sceneChars.presentNames;
  const actorName = sceneChars.actorName;
  const rawPresentCharacters = resolveSceneCharacterRoles({
    names: presentNames,
    portraits: portraitBank?.portraits,
    npcs,
    mcName,
  });

  const roleTierRank = (r: ResolvedSceneCharacterRole): number => {
    const base = r.tier === 'main' ? 30 : r.tier === 'npc' ? 18 : 6;
    return base + (r.pinned ? 12 : 0);
  };

  // Sort present characters for display & target prioritization: Main/Pinned > NPC > Mob,
  // preserving natural scene order among ties.
  const presentCharacters = [...rawPresentCharacters]
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const diff = roleTierRank(b.item) - roleTierRank(a.item);
      return diff !== 0 ? diff : a.idx - b.idx;
    })
    .map((x) => x.item);

  const actorKey = actorName ? normalizeCharacterKey(actorName) : '';
  const findRoleMeta = (
    name: string | null | undefined,
  ): ResolvedSceneCharacterRole | undefined => {
    if (!name) return undefined;
    const k = normalizeCharacterKey(name);
    if (!k) return undefined;
    return rawPresentCharacters.find((c) => normalizeCharacterKey(c.name) === k);
  };

  const rankedPartners = presentCharacters.filter((c) => {
    if (!actorKey) return true;
    return normalizeCharacterKey(c.name) !== actorKey;
  });

  const targetName =
    rankedPartners[0]?.name || sceneChars.targetName || null;
  const secondaryName =
    rankedPartners[1]?.name ||
    (sceneChars.secondaryTargetName &&
    normalizeCharacterKey(sceneChars.secondaryTargetName) !==
      normalizeCharacterKey(targetName || '')
      ? sceneChars.secondaryTargetName
      : null);

  const pronounCap = sceneChars.validPronoun
    ? capFirstVi(sceneChars.validPronoun)
    : null;

  const subject = actorName || (sceneChars.mcPresent ? pronounCap : null);
  const primaryNpc =
    targetName ||
    actorName ||
    presentCharacters[0]?.name ||
    presentNames[0] ||
    null;

  const secondaryRoleMeta = findRoleMeta(secondaryName);
  const targetRoleMetaPrimary = findRoleMeta(targetName);
  const canRotateToSecondary = Boolean(
    secondaryName &&
      Math.abs(variant) % 2 === 1 &&
      !(
        targetRoleMetaPrimary &&
        targetRoleMetaPrimary.tier !== 'mob' &&
        secondaryRoleMeta?.tier === 'mob'
      ),
  );
  const interactTarget = canRotateToSecondary ? secondaryName : targetName;
  const activeTargetRole = findRoleMeta(interactTarget || targetName);
  const primaryNpcRole = findRoleMeta(primaryNpc);

  const targetTier = activeTargetRole?.tier || 'npc';
  const isTargetMob = targetTier === 'mob';
  const isPrimaryMob = primaryNpcRole?.tier === 'mob';
  const targetRoleBlob = `${activeTargetRole?.detailLabel || ''} ${activeTargetRole?.relationships || ''}`;
  const isTargetRivalOrGuarded =
    /(?:đối\s*thủ|phản\s*diện|kẻ\s*thù|địch|đe\s*dọa|đề\s*phòng|căng\s*thẳng|ghét|hiềm\s*khích|tranh\s*chấp|lạnh\s*nhạt|kình\s*địch)/i.test(
      targetRoleBlob,
    );
  const isTargetWarmAlly =
    /(?:người\s*thương|người\s*yêu|vợ|chồng|đạo\s*lữ|bạn\s*thân|đồng\s*minh|thân\s*mật|tri\s*kỷ|cộng\s*sự|tin\s*cậy)/i.test(
      targetRoleBlob,
    );

  const primaryState =
    targetName || actorName
      ? (memoryConfig?.characterStates || []).find((s) => {
          const key = normalizeCharacterKey(s.name);
          return (
            (targetName && key === normalizeCharacterKey(targetName)) ||
            (actorName && key === normalizeCharacterKey(actorName))
          );
        })
      : undefined;
  const curLocation = primaryState?.location?.trim() || '';
  const envBlob = `${tailText}\n${curLocation}`;

  const realm = resolveSuggestionRealm({
    world,
    eraLabel: storyClock.eraLabel,
    envBlob,
  });
  const isClassical = realm === 'xianxia' || realm === 'ancient';
  const locLabel = resolveSceneLocationLabel(curLocation, tailText, realm);

  const hasQuestion =
    /[?？]["”»]?\s*$/.test(tailText.trim()) ||
    /["“«][^"”»]{3,}[?？]["”»]/.test(tailText.slice(-500));

  const isIntimate =
    /(?:giường|chăn|gối|ôm\s+(?:lấy|chặt|sát|eo|vào\s+lòng)|hôn|khóe\s+môi|tựa\s+(?:đầu|vào\s+ngực|vai)|rúc\s+vào|nằm\s+cạnh|nằm\s+bên|vòng\s+tay|thì\s+thầm|hơi\s+thở|vuốt\s+(?:tóc|má|lưng)|phòng\s+ngủ|áo\s+ngủ|đắp\s+chăn|âu\s+yếm|dịu\s+ngọt)/i.test(
      tailText,
    );

  const isWarmOrCozy =
    isIntimate ||
    /(?:mỉm\s+cười|cười\s+khẽ|phì\s+cười|dịu\s+dàng|ánh\s+mắt\s+(?:ấm|dịu|mềm)|ngại\s+ngùng|đỏ\s+mặt|ghé\s+sát|nhẹ\s+nhàng|thân\s+mật|thư\s+giãn|bình\s+yên|thoải\s+mái|ấm\s+áp|yên\s+bình|trêu)/i.test(
      tailText,
    );

  const hasHardTension =
    /(?:cau\s+mày|lạnh\s+lùng|căng\s+thẳng|nghi\s+ngờ|giận|bực|cãi|tranh\s+luận|tránh\s+ánh\s+mắt|sắc\s+mặt\s+trầm|lạnh\s+nhạt|gắt\s+lên|đối\s+đầu|cảnh\s+giác|nổi\s+nóng|sát\s+khí|rút\s+kiếm|uy\s+áp)/i.test(
      tailText,
    );
  const isTense =
    (hasHardTension || (isTargetRivalOrGuarded && !isTargetMob)) && !isIntimate;
  const effectiveIntimate = isIntimate && !isTargetMob;
  const effectiveWarmOrCozy =
    !isTargetMob &&
    (isWarmOrCozy || (isTargetWarmAlly && !hasHardTension));

  const hasPhoneOrMsgCue =
    /(?:điện\s+thoại|tin\s+nhắn|nhắn\s+tin|cuộc\s+gọi|màn\s+hình|nhắn\s+cho|gọi\s+cho)/i.test(
      tailText,
    );
  const hasFoodOrDrink =
    /(?:cà\s+phê|trà|rượu|ly\s+|chén|bữa|ăn|đồ\s+uống|bánh|bia|cocktail)/i.test(
      tailText,
    );
  const isBedroom =
    /(?:phòng\s+ngủ|giường|chăn|gối|đèn\s+ngủ|đầu\s+giường)/i.test(envBlob);
  const hasHillOrView =
    /(?:đỉnh\s+đồi|sườn\s+đồi|beverly\s+hills|los\s+angeles|thành\s+phố|ánh\s+đèn\s+(?:đêm|thành\s+phố)|khung\s+cửa\s+kính|ban\s+công|sân\s+thượng)/i.test(
      envBlob,
    );
  const isHomeIndoor =
    isBedroom ||
    /(?:ghế\s+sofa|ban\s+công|căn\s+hộ|biệt\s+thự|penthouse|phòng\s+khách|khách\s+sạn|bếp|hồ\s+bơi|sân\s+thượng|beverly)/i.test(
      envBlob,
    );
  const isVenueOrDining =
    /(?:nhà\s+hàng|quán|cà\s+phê|rượu|ly\s+|bàn\s+ăn|tiệc|bar|lounge|sảnh|sân\s+khấu|hậu\s+trường|studio)/i.test(
      envBlob,
    );
  const isCarOrTransit =
    /(?:trên\s+xe|ghế\s+lái|ghế\s+phụ|vô\s+lăng|cửa\s+kính\s+xe|chuyên\s+cơ|máy\s+bay|sân\s+bay)/i.test(
      envBlob,
    );

  const p = detectDialoguePronounPair({
    proseText: recentCombined || cleanAi || cleanUser,
    actorName,
    targetName: interactTarget || targetName,
    mcPronoun,
    npcs,
    isAncient: isClassical,
    isIntimateOrWarm: effectiveWarmOrCozy,
  });

  const clockInfo = getClockTransitionPhrase(storyClock.hour, realm, {
    isIntimate,
    isBedroom,
    hasHillOrView,
    p,
  });

  // Seed rotation from current turn + tail content + variant so consecutive turns naturally rotate
  // instead of repeating index 0 on every turn.
  const turnSeed = hashSuggestionSeed(
    `${currentTurn?.id || 'open'}|${recentTurns.length}|${tailText.slice(-90)}`,
  );
  const pick = <T,>(arr: T[], offset = 0): T =>
    arr[(turnSeed + Math.abs(variant) + offset) % arr.length];

  // Blank 0-turn session before Turn 1
  if (!currentTurn || (!cleanAi.trim() && !cleanUser.trim())) {
    const openingItems: Array<{
      category: TurnSuggestionCategory;
      text: string;
    }> =
      subject && targetName
        ? isTargetMob
          ? [
              {
                category: 'continue',
                text: `${subject} liếc nhanh quanh ${locLabel} lúc ${clockFmt.timeStr}, gật đầu chào gọn ${targetName} rồi vào thẳng việc.`,
              },
              {
                category: 'tease',
                text: `${subject} buông một câu đùa tỉnh bơ với ${targetName} cho đỡ gượng trước khi hỏi chuyện.`,
              },
              {
                category: 'probe',
                text: `${subject} thuận miệng dò ${targetName} xem quanh ${locLabel} hôm nay có gì lạ hay ai vừa ghé qua.`,
              },
              {
                category: 'move',
                text: `${subject} cảm ơn gọn ${targetName} rồi rời ${locLabel}, tự đi tìm tâm điểm câu chuyện.`,
              },
              {
                category: 'bold',
                text: `${subject} bỏ qua màn xã giao, ra giá sòng phẳng để ${targetName} nhả ngay thông tin đáng tiền nhất.`,
              },
              {
                category: 'rest',
                text: pick(clockInfo.restSolo(subject), 0),
              },
            ]
          : realm === 'xianxia'
            ? [
                {
                  category: 'continue',
                  text: `${subject} đảo mắt một vòng quanh ${locLabel} lúc ${clockFmt.timeStr}, chắp tay bắt chuyện với ${targetName}.`,
                },
                {
                  category: 'tease',
                  text: `${subject} nhướng mày chọc ${targetName}: "Đứng ở đây lâu thế, đang đợi ${p.self} hay đợi ai?"`,
                },
                {
                  category: 'probe',
                  text: `${subject} hạ giọng dò ${targetName} xem quanh ${locLabel} gần đây có biến động hay tin đồn gì đáng gờm.`,
                },
                {
                  category: 'move',
                  text: `${subject} hất cằm rủ ${targetName} rời ${locLabel}, ghé tửu lâu gần đó vừa uống vừa nghe phong thanh.`,
                },
                {
                  category: 'bold',
                  text: `${subject} đặt phịch một món đồ lạ trước mặt ${targetName}, đề nghị làm một kèo trao đổi ngay tại chỗ.`,
                },
                {
                  category: 'rest',
                  text: pick(clockInfo.restWithPair(subject, targetName), 0),
                },
              ]
            : realm === 'ancient'
              ? [
                  {
                    category: 'continue',
                    text: `${subject} nâng chén trà lúc ${clockFmt.timeStr}, quay sang mở lời bắt chuyện với ${targetName}.`,
                  },
                  {
                    category: 'tease',
                    text: `${subject} cười nửa đùa nửa thật với ${targetName}: "Gặp đúng lúc thế này, xem ra hôm nay khỏi lo buồn chán."`,
                  },
                  {
                    category: 'probe',
                    text: `${subject} hạ giọng hỏi ${targetName} xem quanh ${locLabel} dạo này có tin đồn nào đang rộ lên không.`,
                  },
                  {
                    category: 'move',
                    text: `${subject} rủ ${targetName} rời ${locLabel}, ra gian trà lâu thoáng gió bên cạnh nói chuyện cho tiện.`,
                  },
                  {
                    category: 'bold',
                    text: `${subject} đặt chén trà xuống, nhìn thẳng ${targetName} đặt thẳng một giao kèo ngay từ lần gặp đầu.`,
                  },
                  {
                    category: 'rest',
                    text: pick(clockInfo.restWithPair(subject, targetName), 0),
                  },
                ]
              : [
                  {
                    category: 'continue',
                    text: `${subject} bước tới gần ${targetName} lúc ${clockFmt.timeStr}, bắt chuyện tự nhiên như hai người đã quen sẵn.`,
                  },
                  {
                    category: 'tease',
                    text: `${subject} nghiêng đầu chọc ${targetName}: "Mặt nghiêm túc thế kia, đang tính âm mưu gì đấy?"`,
                  },
                  {
                    category: 'probe',
                    text: `${subject} để ý chi tiết lạ quanh ${locLabel}, thuận miệng hỏi ${targetName} xem ở đây vừa có chuyện gì.`,
                  },
                  {
                    category: 'move',
                    text: `${subject} hất cằm về phía góc thoáng hơn: "Ngồi đây chán quá, sang kia kiếm gì uống đi ${p.other}."`,
                  },
                  {
                    category: 'bold',
                    text: `${subject} bẻ kèo ngay từ phút đầu: "Dẹp hết lịch trình hôm nay đi, theo ${p.self} làm vụ này hay hơn."`,
                  },
                  {
                    category: 'rest',
                    text: pick(clockInfo.restWithPair(subject, targetName), 0),
                  },
                ]
        : primaryNpc
          ? [
              {
                category: 'continue',
                text: `${primaryNpc} liếc quanh ${locLabel} lúc ${clockFmt.timeStr} rồi mở lời bắt chuyện thẳng thắn, không vòng vo.`,
              },
              {
                category: 'tease',
                text: `${primaryNpc} nhướng mày tung một câu đùa tỉnh bơ để xem phản ứng của người đối diện.`,
              },
              {
                category: 'probe',
                text: `${primaryNpc} tinh ý bắt gặp một chi tiết lạ quanh ${locLabel} liền hỏi thẳng đầu đuôi.`,
              },
              {
                category: 'move',
                text: `${primaryNpc} đứng dậy rời ${locLabel}, vẫy tay rủ sang chỗ khác thoáng hơn.`,
              },
              {
                category: 'bold',
                text: `${primaryNpc} bất ngờ tung ra một lời đề nghị khó đoán khiến không khí xoay chiều ngay lập tức.`,
              },
              {
                category: 'rest',
                text: pick(clockInfo.restSolo(primaryNpc), 0),
              },
            ]
          : [
              {
                category: 'continue',
                text: `Quan sát nhanh quanh ${locLabel} lúc ${clockFmt.timeStr}, chủ động mở lời bắt nhịp câu chuyện.`,
              },
              {
                category: 'tease',
                text: `Tung một câu đùa hơi lầy để phá băng và xem người đối diện phản ứng ra sao.`,
              },
              {
                category: 'probe',
                text: `Chấm ngay một chi tiết đáng ngờ quanh ${locLabel} rồi hỏi thẳng cho ra nhẽ.`,
              },
              {
                category: 'move',
                text: `Đề nghị rời ${locLabel}, kéo sang một điểm hẹn khác thú vị hơn lúc ${clockFmt.timeStr}.`,
              },
              {
                category: 'bold',
                text: `Quăng ngay một đề nghị bất ngờ hoặc một biến cố nhỏ chen ngang để mở màn thật mạnh.`,
              },
              {
                category: 'rest',
                text: pick(clockInfo.restGeneric(''), 0),
              },
            ];

    return {
      primaryNpc,
      presentNames,
      presentCharacters,
      items: openingItems.map((it, idx) => ({
        id: `local_open_${variant}_${idx}`,
        category: it.category,
        label: TURN_SUGGESTION_CATEGORY_LABELS[it.category],
        text: it.text,
        source: 'local',
      })),
    };
  }

  let continueOptions: string[];
  let teaseOptions: string[];
  let probeOptions: string[];
  let moveOptions: string[];
  let boldOptions: string[];
  let restOptions: string[];

  if (subject && targetName) {
    const tgt = interactTarget || targetName;
    const hillScenery = hasHillOrView
      ? 'hóng gió ngắm đèn dưới đồi'
      : 'ra ngoài hóng chút gió';

    if (isTargetMob) {
      continueOptions = isClassical
        ? [
            `${subject} gật đầu đáp gọn ${targetName}, xử lý xong việc trước mắt rồi lia mắt quan sát quanh ${locLabel}.`,
            `${subject} dặn ngắn một câu với ${targetName}, không dây dưa thêm để đỡ mất thời gian.`,
            `${subject} nghe ${targetName} báo lại xong liền xác nhận dứt khoát, giữ đúng khoảng cách xã giao.`,
          ]
        : [
            `${subject} đáp gọn ${targetName} cho xong việc, rồi đưa mắt quét lại tình hình quanh ${locLabel}.`,
            `${subject} cảm ơn ngắn gọn ${targetName}, chốt nhanh yêu cầu trước mắt để tiết kiệm thời gian.`,
            `${subject} trao đổi thêm đúng một chi tiết cần thiết với ${targetName} rồi chờ đối phương làm tiếp.`,
          ];

      teaseOptions = isClassical
        ? [
            `${subject} tung cho ${targetName} mấy đồng bạc lẻ, đùa nửa thật nửa giả để người này mở miệng dễ hơn.`,
            `${subject} khen lơ lửng độ lanh lợi của ${targetName} một câu, xem đối phương có buột miệng thêm gì không.`,
            `${subject} nhướng mày hỏi đùa ${targetName}: "Ở đây ngày nào cũng náo nhiệt thế này à?"`,
          ]
        : [
            `${subject} tung một câu đùa xã giao với ${targetName} cho bớt cứng, tiện dò xem người này biết thêm gì.`,
            `${subject} hào phóng thưởng thêm chút tiền boa cho ${targetName}: "Cứ nói thoải mái, không cần giữ kẽ."`,
            `${subject} nhún vai pha trò gọn gàng với ${targetName} rồi lái ngay về đúng việc mình cần.`,
          ];

      probeOptions = isClassical
        ? [
            `${subject} tiện miệng hỏi ${targetName} xem mấy hôm nay quanh ${locLabel} có nhân vật lạ mặt nào ghé qua không.`,
            `${subject} hạ giọng hỏi gọn ${targetName} về chuyện vừa nghe thoáng qua quanh đây.`,
            `${subject} dò nhanh ${targetName} về đường đi lối lại và những ai đang có mặt tại ${locLabel}.`,
          ]
        : [
            `${subject} tranh thủ hỏi nhanh ${targetName} xem ở ${locLabel} gần đây có tin gì nóng hoặc ai vừa qua đây.`,
            `${subject} vặn hỏi thêm một chi tiết thực tế từ ${targetName} để kiểm chứng lời vừa nghe.`,
            `${subject} liếc quanh ${locLabel}, hỏi thẳng ${targetName} xem còn đầu mối nào đáng chú ý không.`,
          ];

      moveOptions = isClassical
        ? [
            `${subject} gật đầu chào gọn rồi rời chỗ ${targetName}, tự đi sang khu khác quanh ${locLabel}.`,
            `${subject} thấy hỏi đủ rồi liền rời ${locLabel}, tiến thẳng tới điểm hẹn chính lúc ${clockFmt.timeStr}.`,
            `${subject} bảo ${targetName} cứ làm tiếp việc, còn mình rẽ sang lối khác thoáng hơn.`,
          ]
        : [
            `${subject} cảm ơn ngắn gọn rồi tạm biệt ${targetName}, rời ${locLabel} quay về mạch việc chính.`,
            `${subject} kết thúc cuộc nói chuyện gọn với ${targetName}, di chuyển sang khu khác tìm đúng người cần gặp.`,
            `${subject} gật đầu chào ${targetName} rồi bước thẳng ra ngoài ${locLabel} cho kịp việc lúc ${clockFmt.timeStr}.`,
          ];

      boldOptions = isClassical
        ? [
            `${subject} đặt thẳng một thỏi bạc trước mặt ${targetName}: "Nói điều đáng giá nhất ngươi biết đi."`,
            `${subject} cắt ngang lời vòng vo của ${targetName}, ép đối phương chỉ thẳng lối vào bên trong.`,
            `${subject} phẩy tay bảo ${targetName} né sang một bên, tự mình bước lên giải quyết thẳng tại ${locLabel}.`,
          ]
        : [
            `${subject} bỏ qua thủ tục rườm rà, đưa thẳng yêu cầu dứt khoát kèm lời đề nghị khó từ chối cho ${targetName}.`,
            `${subject} ngắt lời khách sáo của ${targetName}, tự mình bước thẳng vào khu vực trung tâm nắm thế chủ động.`,
            `${subject} nhìn thẳng vào ${targetName} chốt một câu sắc lẹm, buộc đối phương phải hợp tác ngay.`,
          ];

      restOptions = clockInfo.restSolo(subject);
    } else {
      // =========================================================================
      // 1. TIẾP NHỊP / BẮT SÓNG TỰ NHIÊN (continue)
      // =========================================================================
      if (effectiveIntimate && !isClassical) {
        continueOptions = hasPhoneOrMsgCue
          ? [
              `${subject} úp mặt điện thoại xuống bàn, kéo ${targetName} lại gần: "Kệ tin nhắn đi, lát trả lời sau."`,
              `${subject} liếc qua màn hình rồi quăng máy sang bên, quay lại bắt chuyện tiếp với ${targetName}.`,
              `${subject} tựa cằm lên vai ${targetName}, vừa đáp lại câu vừa rồi vừa lười biếng không muốn nhúc nhích.`,
              `${subject} cướp nhẹ điện thoại khỏi tay ${targetName} đặt sang tủ: "Giờ là giờ của ${p.we}, đừng bấm nữa."`,
            ]
          : hasQuestion
            ? [
                `${subject} nhìn thẳng ${targetName}, trả lời thật thà câu vừa hỏi rồi hỏi ngược lại ý ${p.otherNarr}.`,
                `${subject} kéo ${targetName} tựa sát lại hơn, đáp gọn câu hỏi vừa rồi không chút né tránh.`,
                `${subject} bật cười trước câu hỏi của ${targetName}: "${p.otherCap} đoán thử xem, đoán đúng có thưởng."`,
                `${subject} đan tay vào tay ${targetName}, trả lời thẳng câu hỏi vừa rồi theo đúng suy nghĩ thật.`,
              ]
            : [
                `${subject} kéo ${targetName} xích lại gần hơn, hưởng ứng câu vừa nói bằng giọng thoải mái.`,
                `${subject} gật gù theo lời ${targetName}, kể nối thêm một chuyện riêng đúng mạch hai người đang nói.`,
                `${subject} tựa người thật thoải mái cạnh ${targetName}: "Nói tiếp đi, ${p.self} vẫn đang nghe đây."`,
                `${subject} nắm cổ tay ${targetName} kéo nhẹ lại, đáp lại theo đúng nhịp gần gũi giữa hai người.`,
              ];
      } else if (realm === 'xianxia') {
        continueOptions = isTense
          ? [
              `${subject} giữ mặt tỉnh bơ đáp lại ${targetName}: "Nói tới nước này rồi, bày thẳng điều kiện ra đi."`,
              `${subject} xoay chén linh tửu trong tay, đáp lại ${targetName} từng chữ rõ ràng không hề xuống nước.`,
              `${subject} thu bớt sát khí, nhún vai bảo ${targetName} bình tĩnh nói cho hết đầu đuôi đã.`,
              `${subject} nhìn thẳng ${targetName}, đáp trả gãy gọn rồi chờ xem ${p.otherNarr} còn chiêu gì.`,
            ]
          : isIntimate
            ? [
                `${subject} kéo tay ${targetName} ngồi sát lại bên mình, đáp lời tự nhiên không giữ khoảng cách.`,
                `${subject} dựa nhẹ gần ${targetName}, gật đầu hưởng ứng điều ${p.otherNarr} vừa nhắc tới.`,
                `${subject} rót chén trà ấm đặt vào tay ${targetName}, thuận miệng tiếp câu chuyện đang dở.`,
              ]
            : [
                `${subject} đẩy thêm chén linh tửu sang cho ${targetName}, thuận mạch bàn tiếp chuyện ${p.otherNarr} vừa khơi.`,
                `${subject} gật đầu trước lời ${targetName}, nói thẳng phần tính toán của mình xem ${p.otherNarr} thấy sao.`,
                `${subject} nhấp ngụm rượu, hưởng ứng lời ${tgt} rồi quăng thêm một ý kiến thực tế.`,
                `${subject} khoanh tay nghe ${targetName} nói hết, rồi đáp lại gãy gọn đúng trọng tâm.`,
              ];
      } else if (realm === 'ancient') {
        continueOptions = isTense
          ? [
              `${subject} đặt chén trà xuống bàn, nhìn thẳng ${targetName}: "Khoan vội kết luận, nghe ${p.self} nói hết đã."`,
              `${subject} giữ vẻ điềm nhiên không cãi tay đôi, đáp lại từng ý của ${targetName} thật rành mạch.`,
              `${subject} nhướn mày đáp lời ${targetName}, chấp nhận đối chất thẳng mặt chứ không né.`,
              `${subject} thở hắt một hơi, hạ nhiệt giọng lại để đôi bên nói chuyện cho ra lẽ.`,
            ]
          : isIntimate
            ? [
                `${subject} kéo ${targetName} ngồi gần lại, thuận tay nắm lấy tay ${p.otherNarr} rồi đáp lời.`,
                `${subject} nghiêng người lại gần ${targetName}, hưởng ứng điều ${p.otherNarr} vừa nói một cách tự nhiên.`,
                `${subject} rót thêm trà cho ${targetName}, tiếp lời câu chuyện trong không khí rất thoải mái.`,
              ]
            : [
                `${subject} châm thêm nước trà cho ${targetName}, gật đầu nối tiếp câu chuyện ${p.otherNarr} đang nói dở.`,
                `${subject} đáp lại lời ${targetName} thẳng thắn, tiện thể chia sẻ thêm góc nhìn của mình.`,
                `${subject} nghe ${tgt} nói xong liền tán thành một nửa, phần còn lại vặn nhẹ cho vui chuyện.`,
                `${subject} nâng chén nhấp một ngụm, tiếp lời ${targetName} gọn gàng và tự nhiên.`,
              ];
      } else if (realm === 'fantasy') {
        continueOptions = isTense
          ? [
              `${subject} nhìn thẳng ${targetName}: "${p.selfCap} hiểu ${p.other} lo gì, nhưng giờ cãi nhau chỉ mất thời gian."`,
              `${subject} giữ giọng chắc nịch đáp lại ${targetName}, chốt rõ lý do của mình không vòng vo.`,
              `${subject} khoanh tay đối mặt ${targetName}, đáp thẳng và chờ xem ${p.otherNarr} chọn tin hay không.`,
              `${subject} hạ giọng xuống một tông, đưa ra phương án thực tế để hai bên phối hợp trước đã.`,
            ]
          : [
              `${subject} gật đầu chốt nhanh theo ý ${targetName}, sẵn tiện rà lại tình hình trước mắt.`,
              `${subject} dựa vào thành bàn đáp lời ${tgt}, hỏi thêm xem ${p.otherNarr} còn phương án dự phòng nào không.`,
              `${subject} tiếp lời ${targetName} thoải mái, bổ sung ngay một chi tiết thực dụng cho kế hoạch.`,
              `${subject} nhún vai hưởng ứng câu nói của ${tgt}, tung hứng theo đúng nhịp cảnh.`,
            ];
      } else if (isTense) {
        continueOptions = [
          `${subject} nhìn thẳng vào ${targetName}, không né tránh: "Có gì bực thì nói thẳng ra, đừng giữ trong lòng."`,
          `${subject} khoanh tay nghe ${targetName} nói hết, rồi đáp lại thật gọn và rành mạch.`,
          `${subject} thở dài một hơi: "${p.selfCap} không định cãi nhau với ${p.other}, nhưng chỗ này phải nói cho rõ."`,
          `${subject} đặt tay xuống bàn, giữ tông giọng bình tĩnh nhưng cứng cỏi đáp lại từng ý của ${targetName}.`,
        ];
      } else if (effectiveWarmOrCozy) {
        continueOptions = hasQuestion
          ? [
              `${subject} đáp thẳng câu hỏi của ${targetName}, tiện thể hỏi ngược lại một câu cho công bằng.`,
              `${subject} gật gù trả lời ${targetName}, kể thêm một chi tiết nhỏ đúng gu câu chuyện đang rôm rả.`,
              `${subject} nghiêng người nhìn ${targetName}: "Hỏi thật đấy à? Nghe kỹ đây, ${p.self} chỉ nói một lần thôi."`,
              `${subject} bật cười đáp câu hỏi vừa rồi của ${targetName} một cách thoải mái, không màu mè.`,
            ]
          : hasFoodOrDrink
            ? [
                `${subject} nhấp một ngụm đồ uống, gật gù hưởng ứng chuyện ${tgt} vừa kể rồi nói tiếp thật ăn ý.`,
                `${subject} đẩy đồ ăn sang cho ${targetName}: "Ăn đi kẻo nguội, rồi kể tiếp đoạn sau ${p.self} nghe."`,
                `${subject} dựa lưng ra ghế nghe ${targetName} kể, xen vào một câu bình luận rất đúng tâm lý.`,
                `${subject} cụng ly nhẹ với ${tgt}, nối tiếp câu chuyện theo đúng mood thoải mái hiện tại.`,
              ]
            : [
                `${subject} thả lỏng tựa lưng, hưởng ứng câu của ${tgt} rồi quăng thêm một góc nhìn thú vị.`,
                `${subject} gật gù nhìn ${targetName}: "Nghe hợp lý phết, rồi sao nữa kể tiếp đi."`,
                `${subject} bắt sóng ngay ý của ${tgt}, đáp lại ngắn gọn mà đúng chỗ ngứa.`,
                `${subject} nhoài người về phía trước nghe ${targetName} nói, tỏ rõ hứng thú thật sự.`,
              ];
      } else {
        continueOptions = [
          `${subject} đáp lại ${targetName} thẳng thắn và tự nhiên, giữ đúng nhịp chuyện đang mở ra.`,
          `${subject} gật đầu bắt sóng lời ${tgt}, nối thêm một ý thực tế rồi quan sát phản ứng của ${p.otherNarr}.`,
          `${subject} nhún vai chia sẻ thẳng suy nghĩ của mình với ${targetName}, không cần khách sáo.`,
          `${subject} nghiêng đầu nhìn ${targetName}, đáp gọn một câu vừa đủ gợi mở cho ${p.otherNarr} nói tiếp.`,
        ];
      }

      // =========================================================================
      // 2. TRÊU GHẸO / LẦY LỘI / CÀ KHỊA NHẸ / ĐỔI VỊ (tease)
      // =========================================================================
      if (effectiveIntimate && !isClassical) {
        teaseOptions = [
          `${subject} ghé sát tai ${tgt} trêu tỉnh bơ: "Bình thường cứng miệng lắm mà, giờ sao ngoan thế?"`,
          `${subject} chọc nhẹ vào má ${tgt}: "Đỏ mặt rồi kìa, định chối là do trời nóng à?"`,
          `${subject} nheo mắt nhìn ${targetName}: "Ở yên thế này dễ nghiện lắm đấy, ${p.other} tính chịu trách nhiệm thế nào?"`,
          `${subject} giả vờ xoay người định đứng dậy xem ${tgt} có vội níu tay mình lại không.`,
        ];
      } else if (realm === 'xianxia') {
        teaseOptions = [
          `${subject} nhếch mép trêu ${tgt}: "Câu vừa rồi của ${p.other} chắc thật được ba phần, bảy phần còn lại là giấu nghề nhỉ?"`,
          `${subject} gõ nhẹ vào miệng chén nhìn ${targetName}: "Đừng căng thế, ${p.self} có đòi ăn thịt ${p.other} đâu."`,
          `${subject} bật cười khẩy đầy tinh quái: "Tưởng ${targetName} cao ngạo khó gần thế nào, hóa ra cũng dễ mắc bẫy phết."`,
          `${subject} tung hứng một câu nửa đùa nửa cà khịa để xem vẻ mặt điềm tĩnh của ${tgt} có vỡ trận không.`,
        ];
      } else if (realm === 'ancient') {
        teaseOptions = [
          `${subject} lắc đầu cười trêu ${tgt}: "Miệng thì nói khéo lắm, không biết trong bụng đang tính toán gì đây."`,
          `${subject} cố tình kể lệch sang một giai thoại hài hước ngoài lề để phá bầu không khí nghiêm trang của ${targetName}.`,
          `${subject} nhướng mày chọc ${targetName}: "Hiếm khi thấy ${p.other} sững người thế này, hôm nay ${p.self} lời to rồi."`,
          `${subject} gõ nhẹ lên bàn: "Đánh cược không? Nếu ${p.self} đoán đúng ý ${p.other}, bữa rượu sau ${p.other} mời."`,
        ];
      } else if (realm === 'fantasy') {
        teaseOptions = [
          `${subject} nhướng mày tung một giả thuyết cực kỳ lầy lội để xem ${tgt} có nhịn được cười không.`,
          `${subject} chọc ${targetName}: "Chốt kèo đi, ai đoán sai vụ này tối nay lo phần ăn cho cả nhóm."`,
          `${subject} giả bộ nghiêm trọng rồi bẻ lái sang một câu đùa tỉnh bơ khiến ${tgt} đứng hình mất hai giây.`,
          `${subject} huých vai ${tgt}: "Bớt trưng bộ mặt sắp cứu thế giới ra đi, nghe ${p.self} nói câu này đã."`,
        ];
      } else if (isTense) {
        teaseOptions = [
          `${subject} bật cười nửa bất lực nửa trêu ${tgt}: "Lườm nữa là rách áo ${p.self} mất, hạ hỏa chút đi."`,
          `${subject} đẩy ly nước về phía ${tgt}: "Uống miếng cho hạ nhiệt đã, rồi muốn mắng ${p.self} tiếp cũng chưa muộn."`,
          `${subject} cố tình nói một câu tỉnh bơ trật ray hoàn toàn để cắt ngang cơn căng thẳng của ${targetName}.`,
          `${subject} nhún vai chọc ${tgt}: "Giận nhìn còn dữ hơn lúc bình thường, nhưng công nhận là... khá hợp."`,
        ];
      } else {
        teaseOptions = [
          `${subject} nheo mắt chọc ${tgt}: "Nói thật đi, ${p.other} đang giả vờ nghiêm túc để che vụ gì đúng không?"`,
          `${subject} cười khẩy rủ rê ${targetName}: "Cá không? Nếu giờ ${p.self} rủ bùng hết lịch đi chơi, ${p.other} dám gật đầu không?"`,
          `${subject} buông một câu cà khịa nhẹ cực duyên trúng đúng tật quen của ${tgt} để xem ${p.otherNarr} phản đòn thế nào.`,
          `${subject} giả vờ làm mặt tỉnh bơ trêu ngược lại câu ${tgt} vừa nói, cố tình chọc cho ${p.otherNarr} bật cười hoặc cãi lại.`,
        ];
      }

      // =========================================================================
      // 3. DÒ XÉT / BẮT BẺ / ĐẨY NHỊP TÒ MÒ HOẶC KỊCH TÍNH (probe)
      // =========================================================================
      if (effectiveIntimate && !isClassical) {
        probeOptions = [
          `${subject} nhìn kỹ mắt ${targetName}, hỏi thẳng: "Lúc nãy ${p.other} định nói gì mà lại nuốt vào thế?"`,
          `${subject} gõ nhẹ lên mu bàn tay ${tgt}: "Khai thật đi, hôm nay có chuyện gì làm ${p.other} để tâm đúng không?"`,
          `${subject} tò mò hỏi nhỏ ${targetName} về một bí mật hoặc thói quen riêng mà ${p.otherNarr} ít khi kể với ai.`,
          `${subject} hỏi thẳng ${tgt}: "Xong hôm nay rồi, ${p.other} thật sự muốn mối quan hệ của ${p.we} đi tới đâu?"`,
        ];
      } else if (realm === 'xianxia') {
        probeOptions = [
          `${subject} hạ giọng nhìn quanh ${locLabel}, hỏi ${tgt}: "${p.otherCap} có thấy quanh đây có luồng khí tức lạ không?"`,
          `${subject} gõ ngón tay xuống bàn, truy thẳng ${targetName} về ẩn tình phía sau tin đồn vừa rồi.`,
          `${subject} chỉ vào một chi tiết bất thường trên đồ của ${tgt} hoặc quanh ${locLabel}, hỏi thẳng lai lịch của nó.`,
          `${subject} nghiêng người nói nhỏ với ${targetName}: "Đằng sau vụ này có kẻ nào đang giật dây không?"`,
        ];
      } else if (realm === 'ancient') {
        probeOptions = [
          `${subject} liếc ra ngoài ${locLabel}, hạ giọng hỏi ${tgt} xem sau lưng chuyện vừa nhắc còn ẩn khúc gì.`,
          `${subject} bắt ngay một điểm mâu thuẫn trong lời ${targetName}, hỏi vặn lại xem ${p.otherNarr} giải thích ra sao.`,
          `${subject} dừng tay bên chén trà, nhìn thẳng ${tgt}: "Chuyện này chắc không đơn giản như lời ngoài phố đồn chứ?"`,
          `${subject} chỉ vào một vật tín hay chi tiết nhỏ quanh ${locLabel}, dò xem ${targetName} có biết gốc tích không.`,
        ];
      } else if (realm === 'fantasy') {
        probeOptions = [
          `${subject} kiểm tra nhanh dấu vết lạ quanh ${locLabel}, quay sang hỏi ${targetName} có nhận ra thứ gì không.`,
          `${subject} hỏi thẳng ${tgt} về lỗ hổng đáng ngờ trong thông tin hai người vừa nhận được.`,
          `${subject} nhặt một chi tiết bất thường gần đó lên, kéo ${targetName} lại cùng soi manh mối.`,
          `${subject} nhìn chằm chằm ${tgt}: "${p.otherCap} biết nhiều hơn những gì vừa nói đúng không?"`,
        ];
      } else if (realm === 'showbiz') {
        probeOptions = [
          `${subject} hạ giọng hỏi ${targetName} về chuyện hậu trường thật sự đằng sau dự án hay tin đồn gần đây.`,
          `${subject} liếc quanh ${locLabel} xem có ai để ý không rồi dò ${tgt}: "Trong giới dạo này đang xì xào vụ gì thế?"`,
          `${subject} bắt trúng chi tiết ${targetName} vừa lỡ miệng nhắc qua, hỏi xoáy thêm cho ra đầu đuôi.`,
          `${subject} hỏi thẳng ${tgt}: "Giữa lịch trình dày đặc thế này, rốt cuộc điều gì đang làm ${p.other} đau đầu nhất?"`,
        ];
      } else if (isTense) {
        probeOptions = [
          `${subject} cắt thẳng vào trọng tâm, nhìn ${tgt}: "Rốt cuộc ${p.other} đang giấu ${p.self} chuyện gì?"`,
          `${subject} bắt bẻ ngay điểm bất hợp lý trong lời ${targetName}, buộc ${p.otherNarr} phải giải thích rõ.`,
          `${subject} hạ giọng nhưng ánh mắt rất sắc: "Nói thật đi, điều khiến ${p.other} lo nhất lúc này là gì?"`,
          `${subject} im lặng đúng hai giây nhìn chằm chằm ${tgt}, rồi hỏi một câu trúng ngay tim đen.`,
        ];
      } else {
        probeOptions = [
          `${subject} bắt ngay chi tiết hở ${targetName} vừa lỡ nhắc, hỏi xoáy thêm xem có bí mật gì không.`,
          `${subject} để ý một điểm lạ quanh ${locLabel}, hất cằm hỏi ${tgt} xem ở đây vừa xảy ra chuyện gì.`,
          `${subject} nhìn thẳng ${targetName}: "Thật lòng nhé, ${p.other} đang tính toán chuyện gì cho sắp tới đấy?"`,
          `${subject} gõ nhẹ lên bàn dò ${tgt}: "Còn đoạn nào ${p.other} cố tình bỏ qua chưa kể không?"`,
        ];
      }

      // =========================================================================
      // 4. ĐỔI CẢNH / PHÁ THẾ TĨNH / ĐỔI HOẠT ĐỘNG (move)
      // =========================================================================
      if (realm === 'xianxia') {
        moveOptions = [
          `${subject} đứng dậy phủi áo, rủ ${targetName}: "Ngồi ở ${locLabel} chán rồi, ra phường thị lượn một vòng đi."`,
          `${subject} hất cằm về phía phố ngoài, kéo ${targetName} sang tửu lâu gọi bình rượu ngon đổi gió.`,
          `${subject} liếc sắc trời lúc ${clockFmt.timeStr}, rủ ${targetName} rời ${locLabel} đi tới chỗ hẹn tiếp theo.`,
          `${subject} rủ ${targetName} tách khỏi chỗ ồn ào, lên đình hóng gió trên sườn núi cho thoáng.`,
        ];
      } else if (realm === 'ancient') {
        moveOptions = [
          `${subject} đứng dậy chỉnh vạt áo, rủ ${targetName} rời ${locLabel} ra hành lang ngoài hiên hóng gió.`,
          `${subject} hỏi ${targetName} có muốn sang trà lâu ven hồ vừa uống trà vừa hóng chuyện phố chợ không.`,
          `${subject} bước ra bậc cửa ngoái lại gọi ${targetName} đi dạo một vòng ${clockInfo.moveTimeHint}.`,
          `${subject} tính giờ thấy đã ${clockFmt.timeStr}, nhắc ${targetName} lên đường sang chỗ hẹn kế kẻo trễ.`,
        ];
      } else if (realm === 'fantasy') {
        moveOptions = [
          `${subject} đứng dậy vơ nhanh đồ đạc, rủ ${targetName} rời ${locLabel} sang khu chợ giao dịch nắm tình hình.`,
          `${subject} liếc đồng hồ lúc ${clockFmt.timeStr}, ra hiệu cho ${targetName} di chuyển tới điểm tập kết tiếp theo.`,
          `${subject} hất cằm về phía lối ra, rủ ${targetName} lên đài quan sát hóng gió đổi không khí.`,
          `${subject} kéo ${targetName} rời khỏi chỗ cũ: "Ở yên đây không ra manh mối đâu, đi thực địa luôn."`,
        ];
      } else if (isBedroom) {
        moveOptions = [
          `${subject} kéo tay ${targetName}: "Ra ban công ${hillScenery} chút đi, trong phòng bí quá."`,
          `${subject} bật dậy rủ ${targetName} xuống bếp lục đồ ăn vặt hoặc pha hai ly đồ uống mang ra sofa.`,
          `${subject} vơ chìa khóa xe nhìn ${targetName}: "Thay đồ không? Lái xe lượn một vòng cho tỉnh ngủ."`,
          `${subject} liếc đồng hồ đã ${clockFmt.timeStr}, hỏi ${targetName} muốn nằm tiếp hay ra ngoài đổi gió luôn.`,
        ];
      } else if (isHomeIndoor) {
        moveOptions = [
          `${subject} đứng dậy kéo ${targetName} ra ban công ${hillScenery} cho đổi không khí.`,
          `${subject} xuống bếp pha hai ly đồ uống, gọi ${targetName} qua quầy bar ngồi tán gẫu tiếp.`,
          `${subject} vơ áo khoác rủ ${targetName}: "Đã ${clockFmt.timeStr} rồi, ra ngoài lượn một vòng hoặc kiếm quán nào ngồi đi."`,
          `${subject} bật chút nhạc nền, kéo ${targetName} sang góc sofa nằm xem phim hoặc bày trò gì đó cho vui.`,
        ];
      } else if (isCarOrTransit) {
        moveOptions = [
          `${subject} hạ cửa kính cho gió lùa vào, hỏi ${targetName} có muốn tấp vào quán nhỏ ven đường làm ly gì không.`,
          `${subject} liếc sang ${targetName}: "Về thẳng nhà hay tạt qua chỗ nào chơi thêm chút nữa?"`,
          `${subject} bẻ lái sang cung đường thoáng hơn, bảo ${targetName} cứ chọn đại một góc nào thích để dừng chân.`,
          `${subject} bật bản nhạc hợp mood trên xe, rủ ${targetName} chạy thẳng tới điểm hẹn kế tiếp luôn.`,
        ];
      } else if (isVenueOrDining) {
        moveOptions = [
          `${subject} ghé sát bảo ${targetName}: "Trong này ồn quá, ra ngoài hiên hóng gió nói chuyện cho dễ."`,
          `${subject} đặt ly xuống bàn, rủ ${targetName} chuồn khỏi ${locLabel} để sang tăng hai ở chỗ vắng hơn.`,
          `${subject} nắm cổ tay ${targetName} kéo nhẹ khỏi đám đông, rẽ ra khoảng ban công thoáng gió bên ngoài.`,
          `${subject} gọi thanh toán gọn gàng, hất cằm hỏi ${targetName} muốn đi đâu tiếp lúc ${clockFmt.timeStr}.`,
        ];
      } else {
        moveOptions = [
          `${subject} đứng dậy rủ ${targetName} rời ${locLabel}, kiếm góc nào vắng và chill hơn để ngồi.`,
          `${subject} sánh bước cạnh ${targetName}, gợi ý tạt vào một quán quen ${clockInfo.moveTimeHint}.`,
          `${subject} liếc đồng hồ lúc ${clockFmt.timeStr}: "Đi thôi ${p.other}, sang địa điểm tiếp theo kẻo muộn."`,
          `${subject} kéo ${targetName} đổi hoạt động: "Đứng nói mãi chán lắm, đi dạo hoặc kiếm gì ăn đi."`,
        ];
      }

      // =========================================================================
      // 5. TÁO BẠO / TẠO BIẾN SỐ / TÌNH HUỐNG CHEN NGANG (bold)
      // =========================================================================
      if (effectiveIntimate && !isClassical) {
        boldOptions = [
          `${subject} chẳng buồn nói thêm, kéo ${targetName} sát lại rồi hôn thẳng lên môi ${p.otherNarr}.`,
          `${subject} chặn tay giữ ${targetName} lại, nhìn sát vào mắt ${p.otherNarr}: "Đừng đánh trống lảng nữa, nhìn ${p.self} đây này."`,
          `${subject} ghé sát tai ${targetName} nói thẳng một lời thách thức đầy ẩn ý khiến nhịp thở ${p.otherNarr} khựng lại.`,
          `Đúng lúc không khí đang nóng lên thì điện thoại của ${targetName} bất ngờ đổ chuông liên hồi với một cuộc gọi khẩn.`,
        ];
      } else if (realm === 'xianxia') {
        boldOptions = isIntimate
          ? [
              `${subject} vòng tay siết eo kéo ${targetName} áp sát vào mình, hôn gọn một cái không báo trước.`,
              `${subject} nâng cằm ${targetName} lên, nói thẳng lời hứa không chút vòng vo khiến không gian lặng đi.`,
              `Đúng lúc hai người sát gần nhau, bên ngoài ${locLabel} bất ngờ vang lên tiếng truyền âm hoặc động tĩnh lạ cắt ngang.`,
            ]
          : [
              `${subject} ném thẳng quân bài tẩy lên bàn trước mặt ${targetName}: "Thế này đủ đổi luật chơi chưa?"`,
              `${subject} bước lên một bước thu hẹp khoảng cách, đề nghị giao đấu vài chiêu hoặc lập kèo cược ngay tại ${locLabel}.`,
              `${subject} bóc trần luôn điểm mấu chốt của cục diện trước mặt ${targetName} để cướp thế chủ động.`,
              `Bất ngờ bên ngoài ${locLabel} nổi lên một trận xôn xao, có kẻ không mời mà tới cắt ngang cuộc đối thoại.`,
            ];
      } else if (realm === 'ancient') {
        boldOptions = isIntimate
          ? [
              `${subject} giữ chặt cổ tay ${targetName} kéo lại sát mình, nói thẳng tâm ý giấu bấy lâu.`,
              `${subject} tiến sát thêm một tấc, nhìn thẳng mắt ${targetName} không cho ${p.otherNarr} đường né.`,
              `Ngay lúc bầu không khí vừa chùng xuống, ngoài cửa bỗng có tiếng gõ gấp cùng mật thư khẩn gửi tới.`,
            ]
          : [
              `${subject} đặt mạnh chén trà xuống bàn, đưa thẳng một điều kiện lật ngược hoàn toàn thế cờ với ${targetName}.`,
              `${subject} bất ngờ tung ra một bí mật then chốt khiến sắc mặt ${targetName} lập tức đổi khác.`,
              `${subject} thách ${targetName} một ván cược ngay tại ${locLabel}, thắng thua phân định lập trường đôi bên.`,
              `Đúng lúc đôi bên đang giằng co, ngoài cửa ${locLabel} bất chợt có người vội vã bước vào báo tin dữ.`,
            ];
      } else if (realm === 'fantasy') {
        boldOptions = [
          `${subject} bất ngờ bẻ kế hoạch cũ, tung ra một phương án liều ăn nhiều ngay trước mặt ${targetName}.`,
          `${subject} lật ngửa lá bài tẩy mình đang giấu, đề nghị ${targetName} bắt tay hành động ngay lập tức.`,
          `${subject} cắt ngang sự chần chừ bằng một quyết định dứt khoát tại chỗ khiến ${targetName} không kịp trở tay.`,
          `Ngay lúc đó, một tín hiệu lạ hoặc sự cố bất ngờ ập tới ngay quanh ${locLabel} buộc cả hai phải ứng biến tức thì.`,
        ];
      } else if (effectiveWarmOrCozy) {
        boldOptions = [
          `${subject} bất ngờ kéo ${targetName} lại sát mình, nhìn thẳng vào mắt ${p.otherNarr}: "${p.selfCap} hỏi thật, ${p.other} có thích ${p.self} không?"`,
          `${subject} bẻ kèo phút chót: "Bỏ hết kế hoạch đi, giờ đi làm một chuyện điên rồ với ${p.self} không?"`,
          `${subject} bất chợt nắm chặt tay ${targetName} kéo đi luôn không chờ trả lời, mặc kệ mọi ánh nhìn xung quanh.`,
          `Đúng lúc không khí đang vui vẻ, điện thoại ${subject} bỗng rung lên một tin nhắn bất ngờ làm thay đổi hẳn cục diện.`,
        ];
      } else {
        boldOptions = [
          `${subject} bước thẳng tới trước mặt ${targetName}, lật ngửa bài nói hết điều bấy lâu còn giấu.`,
          `${subject} đưa ra một lời thách đố táo bạo ngay tại ${locLabel}, phá tan nhịp nói chuyện an toàn cũ.`,
          `${subject} chủ động làm một hành động ngược hẳn dự đoán khiến ${targetName} phải sững người đứng hình.`,
          `Ngay lúc cuộc nói chuyện đang lửng lơ, một vị khách không mời hoặc tin nhắn khẩn bất ngờ xen ngang vào cảnh.`,
        ];
      }

      // =========================================================================
      // 6. ĐỔI NHỊP / HẠ NHIỆT / CHUYỂN MỐC GIỜ (rest)
      // =========================================================================
      restOptions = clockInfo.restWithPair(subject, targetName);
    }
  } else if (primaryNpc) {
    if (isPrimaryMob) {
      continueOptions = [
        `${primaryNpc} gật đầu đáp gọn đúng phần việc tại ${locLabel}, giữ chừng mực rồi lui lại.`,
        `${primaryNpc} trao đổi thêm vài câu thực tế, nhanh chóng xử lý xong để nhường lại không gian.`,
        `${primaryNpc} phản hồi ngắn gọn, rõ ràng rồi quay lại công việc của mình.`,
      ];
      teaseOptions = [
        `${primaryNpc} bật cười xã giao trước tình huống vừa rồi, buông một câu nhận xét khá hài rồi thôi.`,
        `${primaryNpc} nhún vai pha trò một câu gọn gàng cho đỡ căng không khí tại ${locLabel}.`,
        `${primaryNpc} đáp lại bằng một câu đùa tỉnh bơ đúng kiểu người làm dịch vụ lanh lợi.`,
      ];
      probeOptions = [
        `${primaryNpc} vô tình buột miệng nhắc tới một tin đồn đáng chú ý quanh ${locLabel} lúc ${clockFmt.timeStr}.`,
        `${primaryNpc} liếc ra ngoài rồi kể nhanh về một vị khách lạ mặt vừa ghé qua đây lúc nãy.`,
        `${primaryNpc} hạ giọng tiết lộ một thông tin thực tế nghe lỏm được quanh khu này.`,
      ];
      moveOptions = [
        `${primaryNpc} làm xong việc tại ${locLabel}, gật đầu chào gọn rồi rời đi nhường chỗ.`,
        `${primaryNpc} liếc giờ lúc ${clockFmt.timeStr} rồi quay sang khu khác xử lý việc tiếp theo.`,
        `${primaryNpc} tạm khép cuộc nói chuyện xã giao và rời khỏi khung cảnh.`,
      ];
      boldOptions = [
        `${primaryNpc} bất ngờ lỡ miệng lộ ra một chi tiết quan trọng làm xoay hẳn không khí tại ${locLabel}.`,
        `${primaryNpc} đột ngột dừng tay, buông một câu cảnh báo ngắn nhưng đủ làm thay đổi kế hoạch.`,
        `${primaryNpc} hớt hải báo có một sự cố bất ngờ vừa nổ ra ngay ngoài ${locLabel}.`,
      ];
      restOptions = clockInfo.restSolo(primaryNpc);
    } else {
      continueOptions = isClassical
        ? [
            `${primaryNpc} nâng chén trà, gật đầu đáp lại mạch chuyện vừa rồi gọn gàng và tự tin.`,
            `${primaryNpc} nói tiếp chuyện đang dở với giọng điệu tỉnh bơ nhưng đầy ẩn ý.`,
            `${primaryNpc} liếc người đối diện một lượt rồi phản hồi thẳng vào trọng tâm.`,
          ]
        : [
            `${primaryNpc} thả lỏng vai, tiếp lời câu chuyện đang dở thật tự nhiên và thoải mái.`,
            `${primaryNpc} đặt món đồ trên tay xuống, đáp lại thẳng thắn không vòng vo.`,
            `${primaryNpc} tựa người ra ghế, buông thêm một câu bình luận rất đúng chất riêng.`,
          ];

      teaseOptions = isClassical
        ? [
            `${primaryNpc} nhướng mày tung một câu nửa đùa nửa cà khịa để thử phản ứng người đối diện.`,
            `${primaryNpc} xoay chén trà trong tay, bẻ lái câu chuyện sang một góc trêu chọc đầy bất ngờ.`,
            `${primaryNpc} cười khẩy một tiếng, buông câu chọc quê nhẹ làm tan bầu không khí khách sáo.`,
          ]
        : [
            `${primaryNpc} nhướng mày thả một câu đùa hơi lầy khiến không khí lập tức vui lên hẳn.`,
            `${primaryNpc} bật cười cà khịa nhẹ một câu cực duyên để xem đối phương chống đỡ thế nào.`,
            `${primaryNpc} giả bộ nghiêm túc rồi bẻ sang một câu trêu tỉnh bơ đầy bất ngờ.`,
          ];

      probeOptions = isClassical
        ? [
            `${primaryNpc} lia mắt quan sát quanh ${locLabel}, hạ giọng hỏi thẳng về tin đồn đáng ngờ gần đây.`,
            `${primaryNpc} khựng lại trước một chi tiết hở vừa nghe, lập tức hỏi vặn cho rõ ẩn tình.`,
            `${primaryNpc} nhặt một vật nhỏ lạ mắt gần đó lên, dò hỏi lai lịch thật sự của nó.`,
          ]
        : [
            `${primaryNpc} bắt trúng chi tiết đáng ngờ vừa lướt qua, hỏi thẳng xem phía sau còn giấu gì.`,
            `${primaryNpc} để ý điểm bất thường quanh ${locLabel}, nghiêng đầu truy hỏi đầu đuôi.`,
            `${primaryNpc} nhìn thẳng người đối diện, đặt một câu hỏi sắc lẹm đánh trúng tim đen.`,
          ];

      moveOptions = isClassical
        ? [
            `${primaryNpc} đứng dậy phủi tay áo, rời ${locLabel} sang phường thị hoặc trà lâu nghe ngóng.`,
            `${primaryNpc} liếc sắc trời lúc ${clockFmt.timeStr}, cất bước sang điểm hẹn tiếp theo.`,
            `${primaryNpc} bước ra hành lang hóng gió ${clockInfo.moveTimeHint} cho đổi không khí.`,
          ]
        : isBedroom || isHomeIndoor
          ? [
              `${primaryNpc} đứng dậy bước ra ban công đón gió lúc ${clockFmt.timeStr} để xả hơi.`,
              `${primaryNpc} vươn vai đi xuống bếp kiếm đồ uống, sẵn tiện thay đổi không khí.`,
              `${primaryNpc} liếc đồng hồ rồi rủ rời ${locLabel}, ra ngoài lượn một vòng đổi gió.`,
            ]
          : [
              `${primaryNpc} đứng dậy rời ${locLabel}, sang một góc vắng và thoải mái hơn gần đó.`,
              `${primaryNpc} liếc đồng hồ lúc ${clockFmt.timeStr} rồi rủ di chuyển sang địa điểm kế tiếp.`,
              `${primaryNpc} tách khỏi chỗ ồn ào, kéo sang góc thoáng gió ${clockInfo.moveTimeHint}.`,
            ];

      boldOptions = isClassical
        ? [
            `${primaryNpc} đặt thẳng một tín vật lạ lên bàn, chủ động lật ngược toàn bộ cục diện.`,
            `${primaryNpc} bước lên một bước, tung ra một lời đề nghị táo bạo khiến xung quanh sững lại.`,
            `Đúng lúc đang đối đáp, bên ngoài ${locLabel} bất ngờ nổi lên tiếng ồn báo hiệu biến cố mới.`,
          ]
        : [
            `${primaryNpc} tiến sát thêm một bước, nói thẳng điều thật lòng nhất không thèm giữ kẽ.`,
            `${primaryNpc} bất ngờ bẻ kế hoạch lúc ${clockFmt.timeStr} bằng một ý tưởng cực kỳ táo bạo.`,
            `Đúng lúc bầu không khí đang chững lại, điện thoại ${primaryNpc} bất ngờ rung lên tin nhắn khẩn.`,
          ];

      restOptions = clockInfo.restSolo(primaryNpc);
    }
  } else {
    const subjPrefix = subject ? `${subject} ` : '';
    continueOptions = [
      `${subjPrefix ? `${subjPrefix}gật` : 'Gật'} đầu bắt sóng ngay, đáp lại ngắn gọn và tự nhiên theo đúng mạch cảnh.`,
      `${subjPrefix ? `${subjPrefix}nghe` : 'Nghe'} hết câu rồi tung hứng lại một ý thật đời thường, không khách sáo.`,
      `${subjPrefix ? `${subjPrefix}thả` : 'Thả'} lỏng tựa lưng, nói thẳng cảm nghĩ thật của mình về chuyện vừa rồi.`,
    ];

    teaseOptions = [
      `${subjPrefix ? `${subjPrefix}tung` : 'Tung'} một câu đùa hơi lầy để phá vỡ sự nghiêm túc và xem phản ứng đối phương.`,
      `${subjPrefix ? `${subjPrefix}nhướng` : 'Nhướng'} mày cà khịa nhẹ một câu cực duyên, bẻ mood câu chuyện sang hướng vui nhộn.`,
      `${subjPrefix ? `${subjPrefix}giả` : 'Giả'} vờ nghiêm trọng rồi nói một câu trêu tỉnh bơ khiến đối phương bật cười.`,
    ];

    probeOptions = [
      `${subjPrefix ? `${subjPrefix}bắt` : 'Bắt'} ngay chi tiết hở vừa lướt qua, hỏi thẳng xem phía sau còn giấu chuyện gì.`,
      `${subjPrefix ? `${subjPrefix}để` : 'Để'} ý một điểm bất thường quanh ${locLabel} rồi truy hỏi cho ra đầu đuôi.`,
      `${subjPrefix ? `${subjPrefix}đặt` : 'Đặt'} một câu hỏi sắc lẹm đánh thẳng vào điều đối phương đang né tránh.`,
    ];

    moveOptions = [
      `${subjPrefix ? `${subjPrefix}đứng` : 'Đứng'} dậy rủ rời ${locLabel}, kéo sang một góc thoáng hơn để đổi gió.`,
      `${subjPrefix ? `${subjPrefix}liếc` : 'Liếc'} đồng hồ lúc ${clockFmt.timeStr}, gợi ý di chuyển sang điểm hẹn hoặc hoạt động kế tiếp.`,
      `${subjPrefix ? `${subjPrefix}kéo` : 'Kéo'} đổi không khí bằng cách đi dạo hoặc tạt vào quán nước ${clockInfo.moveTimeHint}.`,
    ];

    boldOptions = [
      `${subjPrefix ? `${subjPrefix}bỏ` : 'Bỏ'} qua màn vòng vo, tung ra một đề nghị táo bạo lật ngược thế chủ động ngay tại chỗ.`,
      `${subjPrefix ? `${subjPrefix}bất` : 'Bất'} ngờ rút ngắn khoảng cách và nói thẳng điều không ai ngờ tới.`,
      `Đúng lúc không khí đang lửng lơ, một tình huống chen ngang bất ngờ (tin nhắn lạ hoặc tiếng gõ cửa) cắt ngang cảnh.`,
    ];

    restOptions = clockInfo.restGeneric(subjPrefix);
  }

  const built: Array<{ category: TurnSuggestionCategory; text: string }> = [
    { category: 'continue', text: pick(continueOptions, 0) },
    { category: 'tease', text: pick(teaseOptions, 1) },
    { category: 'probe', text: pick(probeOptions, 2) },
    { category: 'move', text: pick(moveOptions, 3) },
    { category: 'bold', text: pick(boldOptions, 1) },
    { category: 'rest', text: pick(restOptions, 2) },
  ];

  return {
    primaryNpc,
    presentNames,
    presentCharacters,
    items: built.map((item, idx) => ({
      id: `local_${currentTurn.id || 'p'}_${variant}_${idx}`,
      category: item.category,
      label: TURN_SUGGESTION_CATEGORY_LABELS[item.category],
      text: item.text,
      source: 'local',
    })),
  };
}

interface ChatViewProps {
  appState: ArkState;
  turns: Turn[];
  currentPage: number;
  streamEnabled: boolean;
  showRawTags: boolean;
  showPostMeta: boolean;
  hideBottomNav: boolean;
  lyricModeEnabled: boolean;
  isGenerating: boolean;
  genStatus: { text: string; isErr: boolean };
  streamingTurnIndex: number | null;
  streamingTurnId?: string | null;
  streamingText: string;
  pendingImages: PendingImage[];
  isPreparingChatImages?: boolean;
  chatImageMaxInputMb?: number;
  chatImageMaxDimension?: number;
  chatImageQuality?: number;
  chatImageAutoClearAfterReply?: boolean;
  imageCaption: string;
  storyImageConfig: StoryImageConfig;
  memoryConfig: MemoryManagerConfig;
  portraitBank: PortraitBankConfig;
  generatingPortraitIds: string[];
  portraitProgress?: Record<string, PortraitGenProgress>;
  portraitErrors?: Record<string, string>;
  enrichingAppearanceIds: string[];
  isEnrichingAppearances: boolean;
  analyzingIdentityIds?: string[];
  verifyingReferenceIds?: string[];
  verifyingStoryBeatKey?: string | null;
  bgPortraitStatus: BgPortraitStatus | null;
  historyTurns: number;
  hasProxyConfigured: boolean;
  isSyncingMemory: boolean;
  isSyncingStates: boolean;
  isSummarizing: boolean;
  npcs: CompanionNpc[];
  activeCompanionName: string;
  mcName: string;
  mcPronoun: string;
  mcAbsentAtStart?: boolean;
  hasSeedreamConfigured: boolean;
  isGeneratingImage: boolean;
  generatingImageTurnIdx: number | null;
  generatingImageTurnId?: string | null;
  generatingImageProgress?: StoryImageGenerationProgress | null;
  isGeneratingSuggestions: boolean;
  onRequestAiSuggestions: (
    existingSuggestions: string[],
    turnIndex?: number,
  ) => Promise<{
    ok: boolean;
    suggestions?: TurnSuggestionItem[];
    error?: string;
    aborted?: boolean;
  }>;
  onCancelAiSuggestions: () => void;
  onImageCaptionChange: (val: string) => void;
  onNavigate: (view: ViewName) => void;
  onPageChange: (page: number) => void;
  onToggleStream: () => void;
  onStopGeneration: () => void;
  onRegenerateCurrent: () => void;
  onToggleRawTags: () => void;
  onTogglePostMeta: () => void;
  onToggleBottomNav: () => void;
  onToggleLyricMode: () => void;
  onUpdateStoryImageConfig: (
    patch:
      | Partial<StoryImageConfig>
      | ((prev: StoryImageConfig) => Partial<StoryImageConfig>),
  ) => void;
  onUpdateMemory: (
    updater: (prev: MemoryManagerConfig) => MemoryManagerConfig,
  ) => void;
  onUpdatePortraitBank: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
  onSyncPortraitsFromCompanion: () => void;
  onCleanJunkPortraits: () => void;
  onAutoFillAppearances: () => void;
  onRefreshPortraitAppearance: (portraitId: string, force?: boolean) => void;
  onGeneratePortrait: (portraitId: string) => void;
  onPreviewPortraitPrompt?: (
    portraitId: string,
    options?: { ignoreCustomPrompt?: boolean; includeSceneContext?: boolean },
  ) => string;
  onAnalyzePortraitIdentity?: (
    portraitId: string,
    options?: {
      overwrite?: boolean;
      imageDataOverride?: string;
      isRealPhoto?: boolean;
    },
  ) => void;
  onVerifyPortraitAgainstReference?: (portraitId: string) => void;
  onVerifyStoryBeatImage?: (
    turnIndex: number,
    position: StoryImagePosition,
  ) => void;
  onToggleStoryBeatApplyComparison?: (
    turnIndex: number,
    position: StoryImagePosition,
    enabled: boolean,
  ) => void;
  onCancelPortrait?: (portraitId: string) => void;
  onScanCurrentPagePortraits: (turnIndex: number) => void;
  onCancelBgPortraits: () => void;
  onDismissBgPortraitStatus: () => void;
  onExtractMemories: (turnIndex: number) => void;
  onExtractStates: (turnIndex: number) => void;
  onRunRollingSummary: (forceAllOlder?: boolean) => void;
  onGenerateStoryImage: (
    turnIndex: number,
    position?: StoryImagePosition,
  ) => void;
  onCancelStoryImage: () => void;
  onClearTurnStoryImage: (
    turnIndex: number,
    position?: StoryImagePosition,
  ) => void;
  onUpdateTurn: (index: number, patch: Partial<Turn>) => void;
  onDeleteTurn: (index: number) => void;
  onPickImage: () => void;
  onSelectPendingImage: (img: PendingImage, suggestedCaption?: string) => void;
  onRemovePendingImage: (index: number) => void;
  onClearPendingImages: () => void;
  onUpdateChatImageConfig?: (patch: {
    chatImageMaxInputMb?: number;
    chatImageMaxDimension?: number;
    chatImageQuality?: number;
    chatImageAutoClearAfterReply?: boolean;
  }) => void;
  onClearTurnAttachedImages?: (turnIndex: number) => void;
  onSendTurn: (userText: string) => void;
  onDownloadImage: (imgSrc: string, filename: string) => void;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
  turnsSinceLastBackup?: number;
  showBackupReminder?: boolean;
  isQuickBackingUp?: boolean;
  onQuickBackup?: () => void;
  onDismissBackupReminder?: () => void;
  onUpdateShowbizPhone?: (
    updater: (prev: ShowbizPhoneState) => ShowbizPhoneState,
  ) => void;
  onUpdateShowbizPhoneAiConfig?: (nextConfig: ShowbizPhoneApiConfig) => void;
}

function TurnAttachedImageItem({
  source,
  index,
  total,
  pageNumber,
  keyHint,
  caption,
  onDownload,
  onClearAttached,
  onOpenLightbox,
}: {
  source: string;
  index: number;
  total: number;
  pageNumber: number;
  keyHint: string;
  caption?: string;
  onDownload: (src: string, filename: string) => void;
  onClearAttached?: () => void;
  onOpenLightbox: (url: string, label: string) => void;
}) {
  const { resolvedUrl, isLoading } = useResolvedMediaUrl(source, {
    keyHint,
    pageIndex: pageNumber - 1,
    kind: 'attach',
    enabled: Boolean(source),
  });
  const isSingle = total === 1;
  const label =
    total > 1
      ? `${caption || `Ảnh đính kèm Trang ${pageNumber}`} (${index + 1}/${total})`
      : caption || `Ảnh đính kèm Trang ${pageNumber}`;
  const filename =
    total > 1
      ? `luot_${pageNumber}_anh_${index + 1}.png`
      : `luot_${pageNumber}.png`;

  if (isSingle) {
    return (
      <div className="space-y-2">
        {resolvedUrl ? (
          <button
            type="button"
            onClick={() => onOpenLightbox(resolvedUrl, label)}
            className="group relative block max-w-full overflow-hidden rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          >
            <img
              src={resolvedUrl}
              alt={label}
              decoding="async"
              referrerPolicy="no-referrer"
              className="max-h-64 w-auto max-w-full rounded-xl ring-1 ring-white/[0.10] object-contain transition-transform duration-200 group-hover:scale-[1.01]"
            />
          </button>
        ) : (
          <div className="flex h-36 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#0e1625]/80 text-xs text-slate-400 ring-1 ring-white/[0.08]">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            <span>
              {isLoading
                ? 'Đang tải lại ảnh đính kèm...'
                : 'Đang khôi phục ảnh...'}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onDownload(source, filename)}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải ảnh về máy</span>
          </button>
          {onClearAttached && (
            <button
              type="button"
              onClick={onClearAttached}
              title="Xóa dữ liệu ảnh tạm của lượt này để giảm RAM/lưu trữ (giữ nguyên chữ & chú thích)"
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-rose-500/12 px-2.5 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/24 transition-colors hover:bg-rose-500/22"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa ảnh tạm (nhẹ máy)</span>
            </button>
          )}
          {caption && (
            <span className="text-xs text-slate-400">Chú thích: {caption}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl bg-[#0e1625]/85 ring-1 ring-white/[0.10]">
      {resolvedUrl ? (
        <button
          type="button"
          onClick={() => onOpenLightbox(resolvedUrl, label)}
          className="block aspect-[4/3] w-full overflow-hidden bg-[#0a111f] focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          title="Bấm để phóng to ảnh"
        >
          <img
            src={resolvedUrl}
            alt={label}
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </button>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
          <span>{isLoading ? 'Đang tải...' : 'Khôi phục...'}</span>
        </div>
      )}
      <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-md bg-[#090f1b]/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-100 ring-1 ring-white/15 backdrop-blur-sm">
        {index + 1}/{total}
      </span>
      <button
        type="button"
        onClick={() => onDownload(source, filename)}
        aria-label={`Tải ảnh ${index + 1} về máy`}
        title="Tải ảnh về máy"
        className="absolute right-1.5 bottom-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#090f1b]/82 text-slate-200 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-sky-500/30 hover:text-white"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ChatView({
  appState,
  turns,
  currentPage,
  streamEnabled,
  showRawTags,
  showPostMeta,
  hideBottomNav,
  lyricModeEnabled,
  isGenerating,
  genStatus,
  streamingTurnIndex,
  streamingTurnId,
  streamingText,
  pendingImages,
  isPreparingChatImages = false,
  chatImageMaxInputMb = 30,
  chatImageMaxDimension = 1600,
  chatImageQuality = 0.84,
  chatImageAutoClearAfterReply = true,
  imageCaption,
  storyImageConfig,
  memoryConfig,
  portraitBank,
  generatingPortraitIds,
  portraitProgress,
  portraitErrors,
  enrichingAppearanceIds,
  analyzingIdentityIds,
  verifyingReferenceIds,
  verifyingStoryBeatKey,
  isEnrichingAppearances,
  bgPortraitStatus,
  historyTurns,
  hasProxyConfigured,
  isSyncingMemory,
  isSyncingStates,
  isSummarizing,
  npcs,
  activeCompanionName,
  mcName,
  mcPronoun,
  mcAbsentAtStart,
  hasSeedreamConfigured,
  isGeneratingImage,
  generatingImageTurnIdx,
  generatingImageTurnId,
  generatingImageProgress,
  isGeneratingSuggestions,
  onRequestAiSuggestions,
  onCancelAiSuggestions,
  onImageCaptionChange,
  onNavigate,
  onPageChange,
  onToggleStream,
  onStopGeneration,
  onRegenerateCurrent,
  onToggleRawTags,
  onTogglePostMeta,
  onToggleBottomNav,
  onToggleLyricMode,
  onUpdateStoryImageConfig,
  onUpdateMemory,
  onUpdatePortraitBank,
  onSyncPortraitsFromCompanion,
  onCleanJunkPortraits,
  onAutoFillAppearances,
  onRefreshPortraitAppearance,
  onGeneratePortrait,
  onPreviewPortraitPrompt,
  onAnalyzePortraitIdentity,
  onVerifyPortraitAgainstReference,
  onVerifyStoryBeatImage,
  onToggleStoryBeatApplyComparison,
  onCancelPortrait,
  onScanCurrentPagePortraits,
  onCancelBgPortraits,
  onDismissBgPortraitStatus,
  onExtractMemories,
  onExtractStates,
  onRunRollingSummary,
  onGenerateStoryImage,
  onCancelStoryImage,
  onClearTurnStoryImage,
  onUpdateTurn,
  onDeleteTurn,
  onPickImage,
  onSelectPendingImage,
  onRemovePendingImage,
  onClearPendingImages,
  onUpdateChatImageConfig,
  onClearTurnAttachedImages,
  onSendTurn,
  onDownloadImage,
  onNotify,
  turnsSinceLastBackup = 0,
  showBackupReminder = false,
  isQuickBackingUp = false,
  onQuickBackup,
  onDismissBackupReminder,
  onUpdateShowbizPhone,
  onUpdateShowbizPhoneAiConfig,
}: ChatViewProps) {
  const [showChatImageOptions, setShowChatImageOptions] = useState(false);
  const draftScopeKey = appState.activeStoryCompanionId || 'main';
  const [newTurnText, setNewTurnText] = useState<string>(() =>
    loadComposerDraft(draftScopeKey),
  );
  const newTurnTextRef = useRef<string>(newTurnText);
  newTurnTextRef.current = newTurnText;
  const draftScopeRef = useRef<string>(draftScopeKey);
  const userTypedDraftRef = useRef<boolean>(false);
  const submitLockRef = useRef<boolean>(false);
  const aiSuggestLockRef = useRef<boolean>(false);
  const storyImgLockRef = useRef<boolean>(false);

  // Sync draft when switching between main story and companion stories, or hydrate from IndexedDB fallback
  useEffect(() => {
    const prevScope = draftScopeRef.current;
    if (prevScope !== draftScopeKey) {
      saveComposerDraft(prevScope, newTurnTextRef.current);
      draftScopeRef.current = draftScopeKey;
      const loaded = loadComposerDraft(draftScopeKey);
      userTypedDraftRef.current = false;
      setNewTurnText(loaded);
      newTurnTextRef.current = loaded;
    }
    if (!newTurnTextRef.current) {
      let cancelled = false;
      void loadComposerDraftFromIndexedDb(draftScopeKey).then((idbDraft) => {
        if (
          cancelled ||
          !idbDraft ||
          userTypedDraftRef.current ||
          newTurnTextRef.current
        ) {
          return;
        }
        setNewTurnText(idbDraft);
        newTurnTextRef.current = idbDraft;
      });
      return () => {
        cancelled = true;
      };
    }
  }, [draftScopeKey]);

  // Auto-save unsent composer draft (debounced) + immediate flush on mobile background/hide
  useEffect(() => {
    if (newTurnText.length > 0) {
      userTypedDraftRef.current = true;
    }
    const timer = window.setTimeout(() => {
      saveComposerDraft(draftScopeKey, newTurnText);
    }, 180);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draftScopeKey, newTurnText]);

  useEffect(() => {
    const flushDraftNow = () => {
      saveComposerDraft(draftScopeRef.current, newTurnTextRef.current);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushDraftNow();
    };
    window.addEventListener('pagehide', flushDraftNow);
    window.addEventListener('blur', flushDraftNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flushDraftNow);
      window.removeEventListener('blur', flushDraftNow);
      document.removeEventListener('visibilitychange', handleVisibility);
      flushDraftNow();
    };
  }, []);
  const [zenMode, setZenMode] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [localSuggestionVariant, setLocalSuggestionVariant] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState<TurnSuggestionItem[]>([]);
  const [aiSuggestionMode, setAiSuggestionMode] = useState<'append' | 'replace'>(
    'append',
  );
  const [aiSuggestionError, setAiSuggestionError] = useState<string | null>(
    null,
  );
  const [storyQuery, setStoryQuery] = useState('');
  const [editingUserIdx, setEditingUserIdx] = useState<number | null>(null);
  const [editingUserDraft, setEditingUserDraft] = useState('');
  const [editingAiIdx, setEditingAiIdx] = useState<number | null>(null);
  const [editingAiDraft, setEditingAiDraft] = useState('');
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] =
    useState<ImagePickerTarget | null>(null);
  type UtilityPanelId =
    | 'none'
    | 'search'
    | 'memory'
    | 'cultivation'
    | 'image'
    | 'portraits'
    | 'showbiz_phone'
    | 'stats';

  const [activeUtility, setActiveUtility] = useState<UtilityPanelId>('none');
  const activeUtilityRef = useRef<UtilityPanelId>('none');
  activeUtilityRef.current = activeUtility;
  const prevUtilityOpenRef = useRef<boolean>(false);

  const handleToggleZenMode = useCallback(() => {
    setZenMode((prev) => {
      const next = !prev;
      if (next) {
        setSuggestionsOpen(false);
        setUtilityMenuOpen(false);
        setActiveUtility('none');
        setEditingUserIdx(null);
        setEditingAiIdx(null);
      }
      return next;
    });
  }, []);
  const [memoryInitialTab, setMemoryInitialTab] =
    useState<MemorySubTab>('lorebook');
  const [cultivationInitialTab, setCultivationInitialTab] =
    useState<CultivationSubTab>('realm');
  const [cultivationInitialSeclusionOpen, setCultivationInitialSeclusionOpen] =
    useState(false);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    label: string;
  } | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  useEffect(() => {
    setLightboxZoomed(false);
  }, [lightboxImage?.src]);

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImage(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxImage]);
  const [quickCharacterName, setQuickCharacterName] = useState<string | null>(
    null,
  );

  const utilityMenuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const newTurnInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!utilityMenuOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        utilityMenuRef.current &&
        !utilityMenuRef.current.contains(e.target as Node)
      ) {
        setUtilityMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUtilityMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [utilityMenuOpen]);

  useEffect(() => {
    if (activeUtility === 'search') {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [activeUtility]);

  const totalPages = Math.max(1, turns.length);
  const safePage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const currentTurn = turns[safePage];
  const currentTurnId = currentTurn?.id || '';

  // Clear inline turn editors when switching pages or deleting the currently edited turn
  useEffect(() => {
    setEditingUserIdx(null);
    setEditingAiIdx(null);
  }, [safePage, currentTurnId]);

  const onlineCharacterNames = useMemo(() => {
    if (!currentTurn) return [];
    const rawAi = currentTurn.assistant || '';
    const cleanAi = splitNarrativeAndMeta(rawAi, false).mainText || rawAi;
    const cleanUser = currentTurn.user || '';
    if (!cleanAi.trim() && !cleanUser.trim()) return [];
    return resolveActiveSceneCharacters({
      currentUserText: cleanUser,
      currentAiText: cleanAi,
      recentTurns: [],
      mcName,
      mcPronoun,
      mcAbsentAtStart,
      npcs,
      portraits: portraitBank.portraits || [],
      characterStates: memoryConfig.characterStates || [],
    }).presentNames;
  }, [
    currentTurn,
    mcName,
    mcPronoun,
    mcAbsentAtStart,
    npcs,
    portraitBank.portraits,
    memoryConfig.characterStates,
  ]);

  const currentTurnAttachedImages = useMemo(
    () => getTurnAttachedImages(currentTurn),
    [currentTurn],
  );
  const currentAttachKey = currentTurn
    ? buildTurnMediaKey('attach', currentTurn, safePage)
    : '';
  const currentStoryKey = currentTurn
    ? buildTurnMediaKey('story', currentTurn, safePage)
    : '';

  const currentTurnStoryImages = useMemo(
    () => getTurnStoryImages(currentTurn),
    [currentTurn],
  );
  const currentTurnBeatMap = useMemo(() => {
    const map: Partial<Record<StoryImagePosition, StoryImageItem>> = {};
    for (const item of currentTurnStoryImages) {
      map[item.position] = item;
    }
    return map;
  }, [currentTurnStoryImages]);
  const hasAnyCurrentTurnStoryImage = useMemo(
    () => currentTurnStoryImages.some((item) => Boolean(item.imageData)),
    [currentTurnStoryImages],
  );
  const enabledBeatPositions = useMemo(
    () => resolveEnabledStoryImagePositions(storyImageConfig),
    [storyImageConfig],
  );
  const configuredBeatCount = enabledBeatPositions.length;
  const isAutoStoryImageOn = Boolean(
    storyImageConfig.enabled && storyImageConfig.autoGenerate,
  );
  const preferClearFaceSolo = storyImageConfig.preferClearFaceSolo !== false;
  const lockAvatarIdentity = storyImageConfig.lockAvatarIdentity !== false;

  const handleToggleQuickAutoStoryImage = useCallback(() => {
    if (isAutoStoryImageOn) {
      onUpdateStoryImageConfig({ autoGenerate: false });
      onNotify?.(
        'Đã chuyển sang đọc thuần chữ (tắt tự động sinh ảnh theo lượt).',
      );
    } else {
      onUpdateStoryImageConfig({ enabled: true, autoGenerate: true });
      onNotify?.('Đã bật tự động sinh ảnh minh họa theo lượt truyện.');
    }
  }, [isAutoStoryImageOn, onNotify, onUpdateStoryImageConfig]);

  const handleToggleBeatPosition = useCallback(
    (pos: StoryImagePosition) => {
      const current = resolveEnabledStoryImagePositions(storyImageConfig);
      const exists = current.includes(pos);
      if (exists && current.length <= 1) {
        onNotify?.(
          'Cần giữ lại ít nhất 1 khung ảnh (hoặc tắt Tự động sinh ảnh để đọc thuần chữ).',
        );
        return;
      }
      const next = exists
        ? current.filter((p) => p !== pos)
        : STORY_IMAGE_POSITIONS.filter(
            (p) => current.includes(p) || p === pos,
          );
      const nextCount = (
        next.length === 1 ? 1 : next.length === 2 ? 2 : 3
      ) as 1 | 2 | 3;
      onUpdateStoryImageConfig({
        enabledPositions: next,
        maxImagesPerTurn: nextCount,
      });
    },
    [onNotify, onUpdateStoryImageConfig, storyImageConfig],
  );

  // Compute full-story totals ONLY when turns or showRawTags change (never on page flip) for snappy mobile paging
  const storyStatsBase = useMemo(() => {
    let userWords = 0;
    let aiWords = 0;
    let repliedTurns = 0;
    let imageCount = 0;
    const measuredDurations: number[] = [];
    const timestamps: number[] = [];

    turns.forEach((t) => {
      const uW = countWords(t.user || '');
      const cleanedAi = splitNarrativeAndMeta(
        t.assistant || '',
        showRawTags,
      ).mainText;
      const aW = countWords(cleanedAi);
      userWords += uW;
      aiWords += aW;
      if (aW > 0) repliedTurns += 1;
      imageCount += getTurnAttachedImages(t).length;
      imageCount += getTurnStoryImages(t).filter((b) =>
        Boolean(b.imageData),
      ).length;
      if (
        typeof t.durationMs === 'number' &&
        Number.isFinite(t.durationMs) &&
        t.durationMs > 0
      ) {
        measuredDurations.push(t.durationMs);
      }
      const ts = extractTurnTimestamp(t);
      if (ts !== null) {
        timestamps.push(ts);
      }
    });

    const totalWords = userWords + aiWords;
    const turnCount = turns.length;
    const avgWordsPerTurn =
      turnCount > 0 ? Math.round(totalWords / turnCount) : 0;
    const totalReadingMinutes = Math.max(
      totalWords > 0 ? 1 : 0,
      Math.round(totalWords / 220),
    );

    let avgTimeDisplay = '—';
    let avgTimeHint = 'Chưa có lượt truyện';

    if (turnCount > 0) {
      if (measuredDurations.length > 0) {
        const avgMs =
          measuredDurations.reduce((sum, d) => sum + d, 0) /
          measuredDurations.length;
        avgTimeDisplay = formatDurationVi(avgMs);
        avgTimeHint = `Đo thực tế (${measuredDurations.length} lượt gọi AI)`;
      } else {
        const gaps: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          const diff = timestamps[i] - timestamps[i - 1];
          if (diff > 1000 && diff <= 2 * 60 * 60 * 1000) {
            gaps.push(diff);
          }
        }
        if (gaps.length > 0) {
          const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
          avgTimeDisplay = formatDurationVi(avgGap);
          avgTimeHint = `Theo mốc thời gian (${gaps.length} khoảng lượt)`;
        } else if (totalWords > 0) {
          const estMsPerTurn = (totalWords / turnCount / 220) * 60 * 1000;
          avgTimeDisplay = `~${formatDurationVi(estMsPerTurn)}`;
          avgTimeHint = 'Ước tính nhịp đọc (~220 từ/phút)';
        } else {
          avgTimeDisplay = '0 giây';
          avgTimeHint = 'Chưa có dữ liệu thời gian';
        }
      }
    }

    return {
      totalWords,
      userWords,
      aiWords,
      turnCount,
      repliedTurns,
      imageCount,
      avgWordsPerTurn,
      totalReadingMinutes,
      avgTimeDisplay,
      avgTimeHint,
    };
  }, [turns, showRawTags]);

  const currentPageWords = useMemo(() => {
    if (!currentTurn) return 0;
    const uW = countWords(currentTurn.user || '');
    const aW = countWords(
      splitNarrativeAndMeta(currentTurn.assistant || '', showRawTags).mainText,
    );
    return uW + aW;
  }, [currentTurn, showRawTags]);

  const storyStats = useMemo(
    () => ({
      ...storyStatsBase,
      currentPageWords,
    }),
    [storyStatsBase, currentPageWords],
  );

  const activeSelectedNpc = useMemo(() => {
    if (!npcs.length) return null;
    return (
      npcs.find((n) => n.id === storyImageConfig.selectedNpcId) || npcs[0]
    );
  }, [npcs, storyImageConfig.selectedNpcId]);

  const activeTargetSummary = useMemo(() => {
    if (storyImageConfig.targetMode === 'npc') {
      return activeSelectedNpc
        ? `NPC: ${activeSelectedNpc.name || 'NPC'}`
        : 'Chọn NPC';
    }
    if (storyImageConfig.targetMode === 'mc') {
      return `NV chính${mcName ? `: ${mcName}` : ''}`;
    }
    if (storyImageConfig.targetMode === 'custom') {
      const c = storyImageConfig.customSubject.trim();
      return c
        ? `Tùy chọn: ${c.slice(0, 24)}${c.length > 24 ? '…' : ''}`
        : 'Tùy chọn mô tả';
    }
    return 'Cảnh truyện';
  }, [
    activeSelectedNpc,
    mcName,
    storyImageConfig.customSubject,
    storyImageConfig.targetMode,
  ]);

  const isGeneratingCurrentPageImage =
    isGeneratingImage &&
    (generatingImageTurnId
      ? Boolean(currentTurnId) && generatingImageTurnId === currentTurnId
      : generatingImageTurnIdx === safePage);

  const trimmedQuery = storyQuery.trim();
  const storyMatches = useMemo(() => {
    if (!trimmedQuery) return [];
    const results: Array<{
      turnIndex: number;
      sourceLabel: string;
      snippet: string;
    }> = [];
    turns.forEach((t, idx) => {
      const parsed = splitNarrativeAndMeta(t.assistant || '', showRawTags);
      const userMatched = matchesQuery(t.user || '', trimmedQuery);
      const aiMatched = matchesQuery(parsed.mainText || '', trimmedQuery);
      const capMatched = matchesQuery(t.imageCaption || '', trimmedQuery);

      if (userMatched || aiMatched || capMatched) {
        const sourceLabel =
          aiMatched && userMatched
            ? 'Lượt gọi & Trả lời'
            : aiMatched
              ? 'Lượt trả lời'
              : userMatched
                ? 'Lượt gọi'
                : 'Chú thích ảnh';
        const snippetSource = aiMatched
          ? parsed.mainText
          : userMatched
            ? t.user
            : t.imageCaption || '';
        results.push({
          turnIndex: idx,
          sourceLabel,
          snippet: extractMatchSnippet(snippetSource, trimmedQuery, 42),
        });
      }
    });
    return results;
  }, [turns, trimmedQuery, showRawTags]);

  const currentMatchPos = storyMatches.findIndex(
    (m) => m.turnIndex === safePage,
  );

  const storyScopeKey = appState.activeStoryCompanionId || 'main';
  const pageScrollKey = currentTurn
    ? currentTurnId
      ? `${storyScopeKey}::${currentTurnId}`
      : `${storyScopeKey}::idx_${safePage}`
    : '';

  const turnsRef = useRef<Turn[]>(turns);
  turnsRef.current = turns;
  const activePageScrollKeyRef = useRef<string>(pageScrollKey);
  const prevPageScrollKeyRef = useRef<string | null>(null);
  const isRestoringScrollRef = useRef<boolean>(false);
  const restoreSeqRef = useRef<number>(0);
  const cancelActiveRestoreRef = useRef<(() => void) | null>(null);
  const navigationIntentRef = useRef<'switch' | 'new_turn' | null>(null);
  const lastScrollBeforeSwitchRef = useRef<number | null>(null);
  const seenTurnIdsRef = useRef<Set<string>>(
    new Set(turns.map((t) => t.id).filter(Boolean)),
  );
  const prevTurnsLengthRef = useRef<number>(turns.length);

  // Immediately invalidate any in-flight scroll restore (rAF, setTimeout, ResizeObserver, listeners)
  const invalidateActiveRestore = useCallback(() => {
    restoreSeqRef.current += 1;
    if (cancelActiveRestoreRef.current) {
      const cancelFn = cancelActiveRestoreRef.current;
      cancelActiveRestoreRef.current = null;
      cancelFn();
    }
  }, []);

  // Continuously record the current page's reading scroll offset (ignored while on utility sub-screens or restoring)
  useEffect(() => {
    hydrateSavedPageScrollPositions();
    const handleWindowScroll = () => {
      if (isRestoringScrollRef.current || activeUtilityRef.current !== 'none') {
        return;
      }
      const key = activePageScrollKeyRef.current;
      if (!key) return;
      savePageScrollPosition(key, getDocumentScrollY(), false);
    };
    const flushScrollNow = () => {
      const key = activePageScrollKeyRef.current;
      if (
        key &&
        !isRestoringScrollRef.current &&
        activeUtilityRef.current === 'none'
      ) {
        savePageScrollPosition(key, getDocumentScrollY(), true);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushScrollNow();
      }
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('pagehide', flushScrollNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('pagehide', flushScrollNow);
      document.removeEventListener('visibilitychange', handleVisibility);
      flushScrollNow();
      invalidateActiveRestore();
    };
  }, [invalidateActiveRestore]);

  const openUtilityScreen = useCallback(
    (
      panel: Exclude<UtilityPanelId, 'none'>,
    ) => {
      setUtilityMenuOpen(false);
      if (activeUtilityRef.current === 'none') {
        const key = activePageScrollKeyRef.current;
        if (key && !isRestoringScrollRef.current) {
          savePageScrollPosition(key, getDocumentScrollY(), true);
        }
        invalidateActiveRestore();
      }
      activeUtilityRef.current = panel;
      setActiveUtility(panel);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [invalidateActiveRestore],
  );

  const closeUtilityScreen = useCallback(() => {
    setUtilityMenuOpen(false);
    setActiveUtility('none');
  }, []);

  const isUtilityScreenOpen = activeUtility !== 'none';

  // Restore saved scroll position when switching pages OR returning from a utility sub-screen;
  // only scroll to top when creating a brand-new turn/page
  useLayoutEffect(() => {
    hydrateSavedPageScrollPositions();

    const wasUtilityOpen = prevUtilityOpenRef.current;
    prevUtilityOpenRef.current = isUtilityScreenOpen;

    if (isUtilityScreenOpen) {
      return;
    }

    const returningFromUtility = wasUtilityOpen && !isUtilityScreenOpen;
    const prevKey = prevPageScrollKeyRef.current;
    const prevLen = prevTurnsLengthRef.current;
    const currentTurns = turnsRef.current;

    const isNewlyCreatedTurn =
      navigationIntentRef.current === 'new_turn' ||
      (prevKey !== null &&
        Boolean(currentTurnId) &&
        !seenTurnIdsRef.current.has(currentTurnId) &&
        currentTurns.length > prevLen &&
        safePage === currentTurns.length - 1);

    for (const t of currentTurns) {
      if (t.id) seenTurnIdsRef.current.add(t.id);
    }
    prevTurnsLengthRef.current = currentTurns.length;

    if (prevKey === pageScrollKey && !returningFromUtility) {
      return;
    }

    // Cancel any leftover restore work from intermediate pages and claim a fresh sequence token
    invalidateActiveRestore();
    const mySeq = restoreSeqRef.current;

    activePageScrollKeyRef.current = pageScrollKey;
    prevPageScrollKeyRef.current = pageScrollKey;
    const intent = navigationIntentRef.current;
    const scrollBeforeSwitch = lastScrollBeforeSwitchRef.current;
    navigationIntentRef.current = null;

    if (!pageScrollKey) {
      lastScrollBeforeSwitchRef.current = null;
      if (restoreSeqRef.current === mySeq) {
        isRestoringScrollRef.current = false;
      }
      return;
    }

    let targetY: number | null = null;
    let shouldResetToTop = false;

    if (isNewlyCreatedTurn) {
      targetY = 0;
      shouldResetToTop = true;
      lastScrollBeforeSwitchRef.current = 0;
      savePageScrollPosition(pageScrollKey, 0, true);
    } else {
      const savedY = savedPageScrollPositions.get(pageScrollKey);
      if (typeof savedY === 'number') {
        targetY = savedY;
      } else if (prevKey === null || returningFromUtility) {
        // Fresh mount from another view or returning from utility onto a page with no saved offset
        targetY = 0;
      } else if (intent === 'switch' && scrollBeforeSwitch !== null) {
        // Switched to an unvisited existing page: keep previous scroll (clamped) rather than jumping to top
        targetY = scrollBeforeSwitch;
      } else {
        if (restoreSeqRef.current === mySeq) {
          isRestoringScrollRef.current = false;
        }
        return;
      }
    }

    isRestoringScrollRef.current = true;
    let cancelled = false;
    let rafId: number | null = null;
    let releaseRafId: number | null = null;
    let timeoutId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const isStale = () => cancelled || restoreSeqRef.current !== mySeq;

    const stopRestoring = () => {
      if (cancelled) return;
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (releaseRafId !== null) {
        cancelAnimationFrame(releaseRafId);
        releaseRafId = null;
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      window.removeEventListener('wheel', onUserInteract);
      window.removeEventListener('touchstart', onUserInteract);
      window.removeEventListener('pointerdown', onUserInteract);
      window.removeEventListener('keydown', onUserInteract);
      if (cancelActiveRestoreRef.current === stopRestoring) {
        cancelActiveRestoreRef.current = null;
      }
      // Only unlock scroll recording if no newer navigation sequence has taken over
      if (restoreSeqRef.current === mySeq) {
        isRestoringScrollRef.current = false;
        lastScrollBeforeSwitchRef.current = null;
      }
    };

    const onUserInteract = (ev: Event) => {
      if (isStale()) return;
      const target = ev.target;
      if (
        target instanceof Element &&
        target.closest('[data-pagination-nav="true"]')
      ) {
        // Let the pagination button's click handler snapshot & advance restoreSeqRef cleanly
        return;
      }
      stopRestoring();
    };

    cancelActiveRestoreRef.current = stopRestoring;

    const applyTargetScroll = (): boolean => {
      if (isStale() || targetY === null) return true;
      const maxScroll = getMaxDocumentScrollY();
      const clamped = Math.min(targetY, maxScroll);
      window.scrollTo({ top: clamped, behavior: 'auto' });
      return shouldResetToTop || maxScroll >= targetY - 2;
    };

    const scheduleRelease = () => {
      if (isStale()) return;
      if (releaseRafId !== null) {
        cancelAnimationFrame(releaseRafId);
      }
      releaseRafId = requestAnimationFrame(() => {
        releaseRafId = null;
        if (isStale()) return;
        stopRestoring();
      });
    };

    const reachedTarget = applyTargetScroll();

    if (reachedTarget) {
      scheduleRelease();
    } else {
      window.addEventListener('wheel', onUserInteract, { passive: true });
      window.addEventListener('touchstart', onUserInteract, { passive: true });
      window.addEventListener('pointerdown', onUserInteract, { passive: true });
      window.addEventListener('keydown', onUserInteract, { passive: true });

      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (isStale()) return;
        if (applyTargetScroll()) {
          scheduleRelease();
        }
      });

      if (typeof ResizeObserver !== 'undefined' && document.body) {
        resizeObserver = new ResizeObserver(() => {
          if (isStale()) return;
          if (applyTargetScroll()) {
            scheduleRelease();
          }
        });
        resizeObserver.observe(document.body);
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        if (isStale()) return;
        applyTargetScroll();
        stopRestoring();
      }, 600);
    }

    return () => {
      stopRestoring();
    };
  }, [
    pageScrollKey,
    currentTurnId,
    safePage,
    turns.length,
    isUtilityScreenOpen,
    invalidateActiveRestore,
  ]);

  const navigateToPage = useCallback(
    (targetPage: number) => {
      if (!turns.length) return;
      const clampedTarget = Math.min(Math.max(0, targetPage), turns.length - 1);
      if (clampedTarget === safePage) {
        if (activeUtilityRef.current !== 'none') {
          setActiveUtility('none');
        }
        return;
      }

      // Capture leaving page's scroll right at click time BEFORE switching page (only when actually reading story)
      const isReadingStory = activeUtilityRef.current === 'none';
      const currentY = getDocumentScrollY();
      const wasRestoring = isRestoringScrollRef.current;
      const curKey = activePageScrollKeyRef.current;

      // Immediately increment restoreSeqRef & cancel all pending rAF / setTimeout / ResizeObserver from previous click
      invalidateActiveRestore();

      // Save leaving page's scroll position before leaving (don't overwrite with utility screen scroll)
      if (
        isReadingStory &&
        curKey &&
        (!wasRestoring || !savedPageScrollPositions.has(curKey))
      ) {
        savePageScrollPosition(curKey, currentY, true);
      }

      // Maintain fallback scroll anchor across rapid page bursts so short intermediate pages don't reset scroll to 0
      if (isReadingStory) {
        if (!wasRestoring || lastScrollBeforeSwitchRef.current === null) {
          lastScrollBeforeSwitchRef.current = currentY;
        } else if (currentY > 0) {
          lastScrollBeforeSwitchRef.current = currentY;
        }
      } else {
        lastScrollBeforeSwitchRef.current = 0;
      }

      isRestoringScrollRef.current = true;
      navigationIntentRef.current = 'switch';

      setActiveUtility('none');
      setEditingUserIdx(null);
      setEditingAiIdx(null);
      onPageChange(clampedTarget);
    },
    [invalidateActiveRestore, onPageChange, safePage, turns.length],
  );

  const jumpToMatch = (dir: -1 | 1) => {
    if (!storyMatches.length) return;
    if (currentMatchPos === -1) {
      const target =
        dir === 1
          ? storyMatches.find((m) => m.turnIndex > safePage) || storyMatches[0]
          : [...storyMatches].reverse().find((m) => m.turnIndex < safePage) ||
            storyMatches[storyMatches.length - 1];
      navigateToPage(target.turnIndex);
    } else {
      const nextPos =
        (currentMatchPos + dir + storyMatches.length) % storyMatches.length;
      navigateToPage(storyMatches[nextPos].turnIndex);
    }
  };

  const handlePrev = () => {
    if (safePage > 0) {
      navigateToPage(safePage - 1);
    }
  };

  const handleNext = () => {
    if (safePage < turns.length - 1) {
      navigateToPage(safePage + 1);
    }
  };

  const handleSubmit = () => {
    if (isGenerating || submitLockRef.current) return;
    const trimmed = newTurnText.trim();
    if (!trimmed && pendingImages.length === 0) {
      onSendTurn('');
      return;
    }
    submitLockRef.current = true;
    window.setTimeout(() => {
      submitLockRef.current = false;
    }, 350);
    const currentY = getDocumentScrollY();
    const wasRestoring = isRestoringScrollRef.current;
    const curKey = activePageScrollKeyRef.current;
    invalidateActiveRestore();
    if (curKey && (!wasRestoring || !savedPageScrollPositions.has(curKey))) {
      savePageScrollPosition(curKey, currentY, true);
    }
    navigationIntentRef.current = 'new_turn';
    onSendTurn(trimmed);
    clearComposerDraft(draftScopeKey);
    userTypedDraftRef.current = false;
    setNewTurnText('');
  };

  const isStreamingCurrentPage =
    isGenerating &&
    (streamingTurnId
      ? Boolean(currentTurnId) && streamingTurnId === currentTurnId
      : streamingTurnIndex === safePage);

  const effectiveAssistantText = isStreamingCurrentPage
    ? streamingText
    : showRawTags && currentTurn?.rawAssistant
      ? currentTurn.rawAssistant
      : currentTurn?.assistant || '';

  const parsedAi = useMemo(
    () =>
      parseStoryTurnStream(
        effectiveAssistantText,
        showRawTags,
        isStreamingCurrentPage,
      ),
    [effectiveAssistantText, showRawTags, isStreamingCurrentPage],
  );

  // Track manual draft/preset expand state; auto-collapse the instant main story begins
  const [draftOpenOverride, setDraftOpenOverride] = useState<boolean | null>(
    null,
  );
  const prevHasMainStoryRef = useRef<boolean>(parsedAi.hasMainStory);
  const aiArticleRef = useRef<HTMLElement | null>(null);
  const draftPreviewRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef<boolean>(true);
  const isUserTouchingRef = useRef<boolean>(false);
  const touchStartYRef = useRef<number | null>(null);
  const touchMovedUpwardRef = useRef<boolean>(false);
  const lastScrollYRef = useRef<number>(0);
  const ignoreScrollUntilRef = useRef<number>(0);
  const [showScrollToBottomBtn, setShowScrollToBottomBtn] = useState(false);

  const STREAM_NEAR_BOTTOM_PX = 100;
  const STREAM_BOTTOM_COMFORT_OFFSET_PX = 84;

  const getDistanceToStreamBottom = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    const curY = getDocumentScrollY();
    const docDistFromBottom = Math.max(0, getMaxDocumentScrollY() - curY);
    const el = aiArticleRef.current;
    if (!el) return docDistFromBottom;
    const rect = el.getBoundingClientRect();
    const articleDistFromViewport = Math.max(
      0,
      rect.bottom - (window.innerHeight - STREAM_BOTTOM_COMFORT_OFFSET_PX),
    );
    return Math.min(docDistFromBottom, articleDistFromViewport);
  }, []);

  const handleJumpToStreamBottom = useCallback(() => {
    if (typeof window === 'undefined') return;
    const el = aiArticleRef.current;
    const maxDocY = getMaxDocumentScrollY();
    let targetY = maxDocY;
    if (el) {
      const rect = el.getBoundingClientRect();
      const desiredY =
        getDocumentScrollY() +
        (rect.bottom - (window.innerHeight - STREAM_BOTTOM_COMFORT_OFFSET_PX));
      targetY = Math.max(0, Math.min(maxDocY, Math.round(desiredY)));
    }
    autoFollowRef.current = true;
    touchMovedUpwardRef.current = false;
    setShowScrollToBottomBtn(false);
    lastScrollYRef.current = targetY;
    ignoreScrollUntilRef.current = performance.now() + 450;
    window.scrollTo({
      top: targetY,
      behavior: 'smooth',
    });
  }, []);

  // Reset all per-page transient UI states whenever active page or turn identity changes
  // so editing drafts, modals, or prompt previews can NEVER bleed across pages after switch/delete.
  useEffect(() => {
    setEditingUserIdx(null);
    setEditingUserDraft('');
    setEditingAiIdx(null);
    setEditingAiDraft('');
    setQuickCharacterName(null);
    setDraftOpenOverride(null);
    setAiSuggestions([]);
    setAiSuggestionError(null);
    setShowScrollToBottomBtn(false);
    prevHasMainStoryRef.current = false;
  }, [safePage, currentTurnId, streamingTurnIndex, streamingTurnId]);

  useEffect(() => {
    if (!prevHasMainStoryRef.current && parsedAi.hasMainStory && !showRawTags) {
      // Automatically collapse open preset/draft blocks as soon as main narrative begins
      setDraftOpenOverride(false);
    }
    prevHasMainStoryRef.current = parsedAi.hasMainStory;
  }, [parsedAi.hasMainStory, showRawTags]);

  // User-first scroll & touch observer during streaming:
  // - Immediately pauses auto-follow the moment the user swipes/wheels/scrolls upward (never fights mobile touch)
  // - Only resumes auto-follow when the user scrolls back within <= 100px of the bottom
  useEffect(() => {
    if (!isStreamingCurrentPage || isUtilityScreenOpen) {
      autoFollowRef.current = true;
      isUserTouchingRef.current = false;
      touchStartYRef.current = null;
      touchMovedUpwardRef.current = false;
      setShowScrollToBottomBtn(false);
      return;
    }

    const initialNearBottom =
      getDistanceToStreamBottom() <= STREAM_NEAR_BOTTOM_PX;
    autoFollowRef.current = initialNearBottom;
    setShowScrollToBottomBtn(!initialNearBottom);
    lastScrollYRef.current = getDocumentScrollY();

    const pauseAutoFollow = () => {
      if (autoFollowRef.current) {
        autoFollowRef.current = false;
      }
      if (getDistanceToStreamBottom() > 24) {
        setShowScrollToBottomBtn(true);
      }
    };

    const handleTouchStart = (ev: TouchEvent) => {
      isUserTouchingRef.current = true;
      touchMovedUpwardRef.current = false;
      touchStartYRef.current = ev.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (ev: TouchEvent) => {
      const startY = touchStartYRef.current;
      const curTouchY = ev.touches[0]?.clientY;
      if (startY !== null && typeof curTouchY === 'number') {
        // Finger moving downward on screen = scrolling content UP to read earlier text
        if (curTouchY - startY > 6) {
          touchMovedUpwardRef.current = true;
          pauseAutoFollow();
        }
      }
    };

    const handleTouchEnd = () => {
      const wasUpwardGesture = touchMovedUpwardRef.current;
      isUserTouchingRef.current = false;
      touchStartYRef.current = null;
      touchMovedUpwardRef.current = false;
      const dist = getDistanceToStreamBottom();
      if (!wasUpwardGesture && !autoFollowRef.current && dist <= STREAM_NEAR_BOTTOM_PX) {
        autoFollowRef.current = true;
        setShowScrollToBottomBtn(false);
      } else if (!autoFollowRef.current && dist > STREAM_NEAR_BOTTOM_PX) {
        setShowScrollToBottomBtn(true);
      }
    };

    const handleWheel = (ev: WheelEvent) => {
      if (ev.deltaY < 0) {
        pauseAutoFollow();
      }
    };

    const handleScroll = () => {
      const curY = getDocumentScrollY();
      const prevY = lastScrollYRef.current;
      lastScrollYRef.current = curY;

      // Ignore scroll events triggered by our own programmatic auto-scroll step
      if (performance.now() < ignoreScrollUntilRef.current) {
        return;
      }

      const dist = getDistanceToStreamBottom();

      // Any upward manual scroll immediately pauses auto-follow
      if (curY < prevY - 4) {
        autoFollowRef.current = false;
        setShowScrollToBottomBtn(dist > 24);
        return;
      }

      // If user scrolled down or dragged scrollbar back near the bottom (<= 100px), re-enable auto-follow
      if (!autoFollowRef.current) {
        if (dist <= STREAM_NEAR_BOTTOM_PX && !isUserTouchingRef.current) {
          autoFollowRef.current = true;
          setShowScrollToBottomBtn(false);
        } else {
          setShowScrollToBottomBtn(dist > STREAM_NEAR_BOTTOM_PX);
        }
      } else if (dist > STREAM_NEAR_BOTTOM_PX + 40) {
        // User left the bottom (e.g. scrollbar jump) without upward delta
        autoFollowRef.current = false;
        setShowScrollToBottomBtn(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isStreamingCurrentPage, isUtilityScreenOpen, getDistanceToStreamBottom]);

  // Smooth rAF-driven scroll-follow while streaming (strictly only when near bottom & user is not touching/scrolled up)
  useEffect(() => {
    if (!isStreamingCurrentPage || isUtilityScreenOpen) return;
    const rafId = requestAnimationFrame(() => {
      if (parsedAi.inDraftPhase && draftPreviewRef.current) {
        const draftEl = draftPreviewRef.current;
        const draftDist =
          draftEl.scrollHeight - draftEl.scrollTop - draftEl.clientHeight;
        if (draftDist <= STREAM_NEAR_BOTTOM_PX) {
          draftEl.scrollTop = draftEl.scrollHeight;
        }
        return;
      }

      if (isUserTouchingRef.current) {
        return;
      }

      if (!autoFollowRef.current) {
        const dist = getDistanceToStreamBottom();
        if (dist > STREAM_NEAR_BOTTOM_PX) {
          setShowScrollToBottomBtn(true);
        }
        return;
      }

      if (aiArticleRef.current) {
        const rect = aiArticleRef.current.getBoundingClientRect();
        const bottomGap =
          rect.bottom - (window.innerHeight - STREAM_BOTTOM_COMFORT_OFFSET_PX);
        // If viewport has drifted far above the bottom, pause auto-follow instead of yanking the user down
        if (bottomGap > STREAM_NEAR_BOTTOM_PX + 80) {
          autoFollowRef.current = false;
          setShowScrollToBottomBtn(true);
          return;
        }
        if (bottomGap > 4) {
          const gentleStep = Math.min(
            bottomGap,
            Math.max(2, Math.ceil(bottomGap * 0.3)),
          );
          const maxDocY = getMaxDocumentScrollY();
          const nextTop = Math.min(maxDocY, getDocumentScrollY() + gentleStep);
          lastScrollYRef.current = nextTop;
          ignoreScrollUntilRef.current = performance.now() + 120;
          window.scrollTo({
            top: nextTop,
            behavior: 'auto',
          });
        }
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    isStreamingCurrentPage,
    isUtilityScreenOpen,
    streamingText,
    parsedAi.inDraftPhase,
    getDistanceToStreamBottom,
  ]);

  const isDraftExpanded =
    draftOpenOverride !== null
      ? draftOpenOverride
      : isStreamingCurrentPage && parsedAi.inDraftPhase;

  const cultivationProfile = memoryConfig.cultivation?.enabled
    ? memoryConfig.cultivation
    : undefined;
  const cultivationDisplay = cultivationProfile
    ? getCultivationDisplayInfo(cultivationProfile)
    : null;
  const cultivationRealmTheme = cultivationProfile
    ? getRealmVisualTheme(cultivationProfile)
    : null;
  const cultivationConstitution = cultivationProfile
    ? normalizeConstitutionState(
        cultivationProfile.constitution,
        cultivationProfile.systemKind,
        cultivationProfile.realmIndex,
      )
    : null;

  const rankingIntelLocationStatus = useMemo(() => {
    const recentTurn = turns[turns.length - 1] || currentTurn;
    const recentText = recentTurn
      ? splitNarrativeAndMeta(recentTurn.assistant || '', false).mainText
      : '';
    return detectRankingIntelLocation({
      characterStates: memoryConfig.characterStates,
      mcName,
      recentTurnText: recentText,
      worldSetting: appState.world?.setting,
    });
  }, [
    turns,
    currentTurn,
    memoryConfig.characterStates,
    mcName,
    appState.world?.setting,
  ]);

  const portraitCountSummary = useMemo(() => {
    const list = portraitBank?.portraits || [];
    const withImg = list.filter((p) => Boolean(p.imageData)).length;
    const autoText = portraitBank?.autoGenerateOnAppear
      ? 'Tự sinh ngầm: Bật'
      : 'Tự sinh ngầm: Tắt';
    return `${withImg}/${list.length} có ảnh · ${autoText}`;
  }, [portraitBank]);

  const mcNameKey = useMemo(
    () => normalizeCharacterKey(mcName || ''),
    [mcName],
  );

  const knownCharacterKeys = useMemo(() => {
    const keys = new Set<string>();
    const add = (raw?: string, isMcFlag = false) => {
      const clean = isMcFlag ? String(raw || '').trim() : sanitizeCharacterName(raw || '') || '';
      if (!clean) return;
      const k = normalizeCharacterKey(clean);
      if (k && k.length >= 2) keys.add(k);
    };
    add(mcName, true);
    for (const n of npcs || []) add(n.name);
    for (const p of portraitBank?.portraits || []) {
      if (!isInvalidNpcPortrait(p)) add(p.name, Boolean(p.isMc));
    }
    for (const s of memoryConfig?.characterStates || []) {
      if (!isInvalidNpcState(s)) add(s.name, Boolean(s.isMc));
    }
    return keys;
  }, [mcName, memoryConfig?.characterStates, npcs, portraitBank?.portraits]);

  const quickCharacterInfo = useMemo(() => {
    if (!quickCharacterName) return null;
    const targetKey = normalizeCharacterKey(quickCharacterName);
    const celeb = lookupKnownCelebrityProfile(quickCharacterName);
    const celebKey = celeb ? normalizeCharacterKey(celeb.canonicalName) : '';
    const matchesName = (candidate?: string) => {
      const k = normalizeCharacterKey(candidate || '');
      if (!k) return false;
      return k === targetKey || (Boolean(celebKey) && k === celebKey);
    };

    const portrait = (portraitBank?.portraits || []).find((p) =>
      matchesName(p.name),
    );
    const npc = (npcs || []).find((n) => matchesName(n.name));
    const stateSnap = (memoryConfig?.characterStates || []).find((s) =>
      matchesName(s.name),
    );
    const isMc = Boolean(
      portrait?.isMc ||
        stateSnap?.isMc ||
        (mcNameKey && targetKey === mcNameKey),
    );

    const displayName =
      portrait?.name || npc?.name || stateSnap?.name || celeb?.canonicalName || quickCharacterName;
    const role =
      portrait?.role || npc?.role || celeb?.role || (isMc ? 'Nhân vật chính' : 'Nhân vật');
    const birthday =
      portrait?.birthday || npc?.birthday || celeb?.birthday || '';
    const age =
      portrait?.age ||
      npc?.age ||
      computeAgeFromBirthday(birthday, memoryConfig?.storyClock) ||
      '';
    const ageBirthLabel = formatAgeBirthdayLabel(age, birthday);
    const fashionStyle =
      portrait?.fashionStyle || npc?.fashionStyle || celeb?.fashionStyle || '';
    const appearance =
      portrait?.appearance || npc?.appearance || celeb?.appearance || npc?.desc || '';
    const personality =
      portrait?.personality || npc?.personality || celeb?.personality || '';
    const relationships =
      portrait?.relationships || npc?.relationships || celeb?.relationships || '';
    const signature =
      portrait?.signature || npc?.signature || celeb?.signature || '';

    return {
      displayName,
      isMc,
      role,
      age,
      birthday,
      ageBirthLabel,
      fashionStyle,
      appearance,
      personality,
      relationships,
      signature,
      portrait,
      stateSnap,
    };
  }, [
    mcNameKey,
    memoryConfig?.characterStates,
    memoryConfig?.storyClock,
    npcs,
    portraitBank?.portraits,
    quickCharacterName,
  ]);

  const storyClockState = useMemo(
    () => normalizeStoryClock(memoryConfig.storyClock),
    [memoryConfig.storyClock],
  );
  const formattedStoryClock = useMemo(
    () => formatStoryClock(storyClockState),
    [storyClockState],
  );

  const memorySummarySubtitle = useMemo(() => {
    const parts: string[] = [];
    if (storyClockState.enabled) {
      parts.push(formattedStoryClock.shortDateTime);
    }
    if (memoryConfig.entries.length > 0) {
      parts.push(`${memoryConfig.entries.length} ký ức`);
    }
    if (memoryConfig.characterStates.length > 0) {
      parts.push(`${memoryConfig.characterStates.length} trạng thái`);
    }
    if (memoryConfig.rollingSummary?.content?.trim()) {
      parts.push('Có tóm tắt');
    }
    if (!memoryConfig.enabled) {
      return parts.length > 0
        ? `Đang tắt tiêm · ${parts.join(' · ')}`
        : 'Đang tắt tiêm ngữ cảnh';
    }
    return parts.length > 0
      ? parts.join(' · ')
      : 'Đồng hồ, sổ tay, trạng thái & tóm tắt';
  }, [memoryConfig, storyClockState.enabled, formattedStoryClock.shortDateTime]);

  const latestTurnId = turns[turns.length - 1]?.id || '';
  const currentTurnSignature = `${turns.length}:${latestTurnId}:${safePage}:${currentTurn?.id || ''}:${(currentTurn?.assistant || '').slice(0, 64)}`;
  const prevSuggestionSignatureRef = useRef<string>(currentTurnSignature);
  useEffect(() => {
    if (prevSuggestionSignatureRef.current === currentTurnSignature) return;
    prevSuggestionSignatureRef.current = currentTurnSignature;
    onCancelAiSuggestions();
    setAiSuggestions([]);
    setAiSuggestionError(null);
  }, [currentTurnSignature, onCancelAiSuggestions]);

  const recentTurnsForSuggestions = useMemo(
    () => turns.slice(Math.max(0, safePage - 2), safePage),
    [turns, safePage],
  );

  const localSuggestionBundle = useMemo(() => {
    if (!suggestionsOpen) {
      return {
        items: [] as TurnSuggestionItem[],
        primaryNpc: null as string | null,
        presentNames: [] as string[],
        presentCharacters: [] as ResolvedSceneCharacterRole[],
      };
    }
    return buildLocalTurnSuggestions({
      currentTurn,
      recentTurns: recentTurnsForSuggestions,
      world: appState.world,
      npcs,
      portraitBank,
      memoryConfig,
      mcName,
      mcPronoun,
      mcAbsentAtStart,
      storyClock: storyClockState,
      clockFmt: formattedStoryClock,
      variant: localSuggestionVariant,
    });
  }, [
    suggestionsOpen,
    currentTurn,
    recentTurnsForSuggestions,
    appState.world,
    npcs,
    portraitBank,
    memoryConfig,
    mcName,
    mcPronoun,
    mcAbsentAtStart,
    storyClockState,
    formattedStoryClock,
    localSuggestionVariant,
  ]);

  const displayedSuggestions = useMemo(() => {
    if (!suggestionsOpen) return [] as TurnSuggestionItem[];
    if (aiSuggestionMode === 'replace' && aiSuggestions.length > 0) {
      return aiSuggestions;
    }
    const seen = new Set<string>();
    const combined: TurnSuggestionItem[] = [];
    for (const item of [...aiSuggestions, ...localSuggestionBundle.items]) {
      const k = normalizeCharacterKey(item.text);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      combined.push(item);
    }
    return combined;
  }, [
    suggestionsOpen,
    aiSuggestionMode,
    aiSuggestions,
    localSuggestionBundle.items,
  ]);

  const handleTriggerAiSuggestions = async () => {
    if (isGeneratingSuggestions || aiSuggestLockRef.current) return;
    aiSuggestLockRef.current = true;
    setAiSuggestionError(null);
    const existingTexts =
      aiSuggestionMode === 'append'
        ? displayedSuggestions.map((s) => s.text)
        : [];
    try {
      const res = await onRequestAiSuggestions(existingTexts, safePage);
      if (res.aborted) return;
      if (!res.ok || !res.suggestions?.length) {
        setAiSuggestionError(
          res.error ||
            'Chưa thể tạo gợi ý từ AI lúc này. Bạn có thể dùng gợi ý nhanh bên dưới hoặc thử lại.',
        );
        return;
      }
      const fresh = res.suggestions.slice(0, 6);
      setAiSuggestions((prev) => {
        if (aiSuggestionMode === 'replace') {
          return fresh;
        }
        const seen = new Set<string>();
        const merged: TurnSuggestionItem[] = [];
        for (const item of [...fresh, ...prev]) {
          const k = normalizeCharacterKey(item.text);
          if (!k || seen.has(k)) continue;
          seen.add(k);
          merged.push(item);
        }
        return merged.slice(0, 24);
      });
    } finally {
      aiSuggestLockRef.current = false;
    }
  };

  const handleToggleSuggestions = () => {
    setSuggestionsOpen((v) => !v);
  };

  const handleSelectSuggestionCard = (text: string) => {
    setNewTurnText(text);
    requestAnimationFrame(() => {
      const el = newTurnInputRef.current;
      if (el) {
        el.focus();
        const len = text.length;
        el.setSelectionRange(len, len);
      }
    });
  };

  const utilityScreenMeta =
    activeUtility === 'portraits'
      ? {
          title: 'Ảnh nhân vật / NPC',
          subtitle: portraitCountSummary,
          icon: Users,
          accentClass: 'text-emerald-300',
        }
      : activeUtility === 'memory'
        ? {
            title: 'Ký ức / AI Ghi nhớ',
            subtitle: memorySummarySubtitle,
            icon: Brain,
            accentClass: 'text-violet-300',
          }
        : activeUtility === 'cultivation' && cultivationProfile
          ? {
              title: 'Tu luyện & Túi đồ',
              subtitle: `${cultivationDisplay?.fullLabel || cultivationProfile.realmName} · ${cultivationProfile.techniques.length} công pháp`,
              icon: Swords,
              accentClass: 'text-emerald-300',
            }
          : activeUtility === 'image'
            ? {
                title: 'Sinh ảnh trong truyện',
                subtitle: activeTargetSummary,
                icon: Sparkles,
                accentClass: 'text-sky-300',
              }
            : activeUtility === 'search'
              ? {
                  title: 'Tìm kiếm trong truyện',
                  subtitle: trimmedQuery
                    ? `"${trimmedQuery}" · ${storyMatches.length} trang`
                    : `${turns.length} trang truyện`,
                  icon: Search,
                  accentClass: 'text-sky-300',
                }
              : activeUtility === 'showbiz_phone'
                ? {
                    title: 'Điện thoại Showbiz',
                    subtitle: `${appState.showbizPhone?.contacts?.length || 0} liên hệ · ${appState.showbizPhone?.groups?.length || 0} nhóm · ${appState.showbizPhone?.posts?.length || 0} bài MXH`,
                    icon: Smartphone,
                    accentClass: 'text-amber-300',
                  }
                : activeUtility === 'stats'
                  ? {
                      title: 'Thống kê lượt truyện',
                      subtitle: `${storyStats.totalWords.toLocaleString('vi-VN')} từ · ${storyStats.turnCount} lượt`,
                      icon: BarChart3,
                      accentClass: 'text-indigo-300',
                    }
                  : null;

  const utilityQuickTabs: Array<{
    id: Exclude<UtilityPanelId, 'none'>;
    label: string;
    icon: typeof Search;
  }> = [
    { id: 'showbiz_phone', label: 'Điện thoại', icon: Smartphone },
    { id: 'portraits', label: 'Ảnh NV/NPC', icon: Users },
    { id: 'memory', label: 'Ký ức', icon: Brain },
    ...(cultivationProfile
      ? [{ id: 'cultivation' as const, label: 'Tu luyện', icon: Swords }]
      : []),
    { id: 'image', label: 'Sinh ảnh', icon: Sparkles },
    { id: 'search', label: 'Tìm kiếm', icon: Search },
    { id: 'stats', label: 'Thống kê', icon: BarChart3 },
  ];

  return (
    <section className="space-y-3.5">
      {isUtilityScreenOpen && utilityScreenMeta ? (
        <div className="space-y-3.5">
          {/* Dedicated Sub-Screen Sticky Header with Direct Return to Story */}
          <div className="sticky top-2 z-30 space-y-2.5 rounded-2xl bg-[#162032]/96 p-3.5 ring-1 ring-white/[0.10] shadow-[0_14px_34px_-14px_rgba(2,8,23,0.82)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={closeUtilityScreen}
                  title="Quay lại thẳng trang truyện đang đọc (giữ nguyên trang và vị trí cuộn)"
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/40 shadow-[0_6px_16px_-8px_rgba(14,165,233,0.55)] transition-all hover:bg-sky-500/28 hover:text-white active:scale-[0.98] whitespace-nowrap"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-sky-300" />
                  <span>Quay lại Truyện</span>
                  {turns.length > 0 && (
                    <span className="rounded-md bg-sky-400/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-200 tabular-nums">
                      Tr. {safePage + 1}
                    </span>
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <utilityScreenMeta.icon
                      className={`h-4 w-4 shrink-0 ${utilityScreenMeta.accentClass}`}
                    />
                    <h2 className="truncate text-sm font-bold tracking-tight text-slate-50">
                      {utilityScreenMeta.title}
                    </h2>
                  </div>
                  <p className="truncate text-[11px] text-slate-400">
                    {utilityScreenMeta.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('config')}
                className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] hover:text-white whitespace-nowrap"
              >
                <Settings className="h-3.5 w-3.5 text-slate-300" />
                <span>Cài đặt</span>
              </button>
            </div>

            {/* Quick Sub-Screen Switcher Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/[0.07] pt-2 pb-0.5">
              {utilityQuickTabs.map((tab) => {
                const TabIcon = tab.icon;
                const active = activeUtility === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (tab.id === 'image' && !storyImageConfig.enabled) {
                        onUpdateStoryImageConfig({ enabled: true });
                      }
                      openUtilityScreen(tab.id);
                    }}
                    className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-all whitespace-nowrap ${
                      active
                        ? 'bg-sky-500/20 text-sky-100 ring-sky-400/40'
                        : 'bg-white/[0.04] text-slate-300 ring-white/[0.07] hover:bg-white/[0.09] hover:text-white'
                    }`}
                  >
                    <TabIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dedicated Sub-Screen Content: Character / NPC Portrait Bank */}
          {activeUtility === 'portraits' && (
            <PortraitBankPanel
              portraitBank={portraitBank}
              appConfig={appState.config}
              activeCompanionName={activeCompanionName}
              activeMainName={getShowbizMcProfile(appState).name}
              storyClock={memoryConfig.storyClock}
              hasSeedreamConfigured={hasSeedreamConfigured}
              generatingPortraitIds={generatingPortraitIds}
              portraitProgress={portraitProgress}
              portraitErrors={portraitErrors}
              enrichingAppearanceIds={enrichingAppearanceIds}
              analyzingIdentityIds={analyzingIdentityIds}
              verifyingReferenceIds={verifyingReferenceIds}
              isEnrichingAppearances={isEnrichingAppearances}
              bgPortraitStatus={bgPortraitStatus}
              onlineCharacterNames={onlineCharacterNames}
              currentPage={safePage}
              turnCount={turns.length}
              onClose={closeUtilityScreen}
              onNavigate={onNavigate}
              onUpdatePortraitBank={onUpdatePortraitBank}
              onSyncFromCompanion={onSyncPortraitsFromCompanion}
              onCleanJunkPortraits={onCleanJunkPortraits}
              onAutoFillAppearances={onAutoFillAppearances}
              onRefreshPortraitAppearance={onRefreshPortraitAppearance}
              onGeneratePortrait={onGeneratePortrait}
              onPreviewPortraitPrompt={onPreviewPortraitPrompt}
              onAnalyzePortraitIdentity={onAnalyzePortraitIdentity}
              onVerifyPortraitAgainstReference={onVerifyPortraitAgainstReference}
              onCancelPortrait={onCancelPortrait}
              onScanCurrentPagePortraits={onScanCurrentPagePortraits}
              onCancelBgPortraits={onCancelBgPortraits}
              onDismissBgPortraitStatus={onDismissBgPortraitStatus}
              onDownloadImage={onDownloadImage}
              onNotify={onNotify}
              onOpenImagePicker={(portraitId, portraitName) =>
                setImagePickerTarget({
                  mode: 'character',
                  portraitId,
                  portraitName,
                })
              }
            />
          )}

          {/* Dedicated Sub-Screen Content: Showbiz Phone (DM / Group / MXH) */}
          {activeUtility === 'showbiz_phone' && (
            <ShowbizPhonePanel
              state={appState}
              onUpdatePhone={(updater) => onUpdateShowbizPhone?.(updater)}
              onUpdatePhoneAiConfig={(nextCfg) =>
                onUpdateShowbizPhoneAiConfig?.(nextCfg)
              }
              onBridgeToStory={(storyPrompt) => {
                const nextVal = newTurnText.trim()
                  ? `${newTurnText.trim()}\n\n${storyPrompt}`
                  : storyPrompt;
                setNewTurnText(nextVal);
                newTurnTextRef.current = nextVal;
                closeUtilityScreen();
                onNotify?.(
                  'Đã đưa bài đăng MXH sang khung nhập truyện. Bạn có thể chỉnh nhẹ hoặc bấm Gửi ngay.',
                  'info',
                );
                requestAnimationFrame(() => newTurnInputRef.current?.focus());
              }}
              onShowBanner={onNotify}
            />
          )}

          {/* Dedicated Sub-Screen Content: AI Memory & State Manager */}
          {activeUtility === 'memory' && (
            <MemoryManagerPanel
              memory={memoryConfig}
              turnCount={turns.length}
              currentPage={safePage}
              historyTurns={historyTurns}
              hasProxyConfigured={hasProxyConfigured}
              isSyncingMemory={isSyncingMemory}
              isSyncingStates={isSyncingStates}
              isSummarizing={isSummarizing}
              initialTab={memoryInitialTab}
              onClose={closeUtilityScreen}
              onNavigate={onNavigate}
              onJumpToPage={(pageIdx) => {
                if (pageIdx >= 0 && pageIdx < turns.length) {
                  navigateToPage(pageIdx);
                }
              }}
              onUpdateMemory={onUpdateMemory}
              onExtractMemories={onExtractMemories}
              onExtractStates={onExtractStates}
              onRunRollingSummary={onRunRollingSummary}
              onSelectCharacter={setQuickCharacterName}
            />
          )}

          {/* Dedicated Sub-Screen Content: Cultivation / Martial Arts & Inventory */}
          {activeUtility === 'cultivation' && cultivationProfile && (
            <CultivationPanel
              profile={cultivationProfile}
              mcName={mcName}
              storyClock={memoryConfig.storyClock}
              currentTurnText={
                splitNarrativeAndMeta(currentTurn?.assistant || '', false)
                  .mainText
              }
              initialTab={cultivationInitialTab}
              initialSeclusionOpen={cultivationInitialSeclusionOpen}
              intelLocationStatus={rankingIntelLocationStatus}
              mainModelName={appState.config?.model}
              onUpdateProfile={(updater) =>
                onUpdateMemory((prev) => ({
                  ...prev,
                  cultivation: updater(prev.cultivation || cultivationProfile),
                }))
              }
              onInsertStoryPrompt={(promptText: string) => {
                const nextVal = newTurnText.trim()
                  ? `${newTurnText.trim()}\n${promptText}`
                  : promptText;
                setNewTurnText(nextVal);
                newTurnTextRef.current = nextVal;
                requestAnimationFrame(() => newTurnInputRef.current?.focus());
              }}
              onQuickCultivate={(
                durationMinutes: number,
                label: string,
                options?: {
                  months?: number;
                  years?: number;
                  isSeclusionJump?: boolean;
                },
              ): QuickCultivateResult | null => {
                const computeShiftedClock = (base: ReturnType<typeof normalizeStoryClock>) => {
                  if (options?.years && options.years > 0) {
                    return addYearsToClock(base, options.years);
                  }
                  if (options?.months && options.months > 0) {
                    return addMonthsToClock(base, options.months);
                  }
                  return addMinutesToClock(base, durationMinutes);
                };

                const baseClock = normalizeStoryClock(memoryConfig.storyClock);
                const shifted = computeShiftedClock(baseClock);
                const exactDeltaMinutes = Math.max(
                  1,
                  clockToEpochMinutes(shifted) - clockToEpochMinutes(baseClock),
                );
                const isSeclusion = Boolean(options?.isSeclusionJump);
                const reasonLabel = isSeclusion
                  ? `Khóa tu luyện nhanh (${label})`
                  : `Tu luyện ngắn (${label})`;
                const beforeClockFmt = formatStoryClock(baseClock);
                const afterClockFmt = formatStoryClock(shifted);
                const clockRangeLabel = `${beforeClockFmt.canChiDateTime} → ${afterClockFmt.canChiDateTime}`;

                const calc = applyClockDeltaToCultivation(
                  cultivationProfile,
                  exactDeltaMinutes,
                  {
                    sceneText:
                      'bế quan đả tọa tu luyện chuyên tâm vận công luyện võ diễn võ',
                    reason: reasonLabel,
                    forceActiveTraining: true,
                    isSeclusionJump: isSeclusion,
                    periodLabel: label,
                    clockRangeLabel,
                  },
                );
                if (!calc.nextProfile) return null;

                onUpdateMemory((prev) => {
                  const prevClock = normalizeStoryClock(prev.storyClock);
                  const advancedBase = computeShiftedClock(prevClock);
                  const prevExactDelta = Math.max(
                    1,
                    clockToEpochMinutes(advancedBase) -
                      clockToEpochMinutes(prevClock),
                  );
                  const advancedClock = {
                    ...advancedBase,
                    initialized: true,
                    lastDeltaMinutes: prevExactDelta,
                    lastAdvanceReason: reasonLabel,
                    updatedAt: Date.now(),
                  };
                  const updatedCult =
                    applyClockDeltaToCultivation(
                      prev.cultivation || cultivationProfile,
                      prevExactDelta,
                      {
                        sceneText:
                          'bế quan đả tọa tu luyện chuyên tâm vận công luyện võ diễn võ',
                        reason: reasonLabel,
                        forceActiveTraining: true,
                        isSeclusionJump: isSeclusion,
                        periodLabel: label,
                        clockRangeLabel,
                      },
                    ).nextProfile || prev.cultivation;
                  return {
                    ...prev,
                    storyClock: advancedClock,
                    cultivation: updatedCult,
                  };
                });

                const beforeFmt = beforeClockFmt.shortDateTime;
                const afterFmt = afterClockFmt.shortDateTime;
                const deltaLabel = isSeclusion
                  ? label
                  : formatDeltaMinutesVi(exactDeltaMinutes);
                const energyShort = cultivationProfile.energyLabel
                  .split('/')[0]
                  .trim();

                if (
                  calc.becameReadyToBreakthrough ||
                  calc.nextProfile.readyToBreakthrough
                ) {
                  onNotify?.(
                    `${isSeclusion ? 'Bế quan' : 'Tu luyện'} ${label} (+${calc.expGained} ${energyShort}, → Năm ${afterClockFmt.canChiYear} ${afterClockFmt.dateStr}) — Chạm bình cảnh, đã khóa chờ chủ động đột phá!`,
                  );
                } else {
                  const extraParts: string[] = [];
                  if (calc.lockedTechniques.length > 0) {
                    extraParts.push(
                      `Công pháp chạm bình cảnh: ${calc.lockedTechniques.slice(0, 2).join(', ')}`,
                    );
                  }
                  if (calc.lockedMoves.length > 0) {
                    extraParts.push(
                      `Chiêu chạm bình cảnh: ${calc.lockedMoves.slice(0, 2).join(', ')}`,
                    );
                  }
                  onNotify?.(
                    `${isSeclusion ? 'Bế quan' : 'Tu luyện'} ${label}: +${calc.expGained} ${energyShort} (→ Năm ${afterClockFmt.canChiYear} ${afterClockFmt.dateStr})${extraParts.length ? ` · ${extraParts.join(' · ')}` : ''}.`,
                  );
                }

                return {
                  expGained: calc.expGained,
                  leveledTechniques: calc.leveledTechniques,
                  leveledMoves: calc.leveledMoves,
                  lockedTechniques: calc.lockedTechniques,
                  lockedMoves: calc.lockedMoves,
                  becameReadyToBreakthrough: calc.becameReadyToBreakthrough,
                  readyToBreakthrough: Boolean(
                    calc.nextProfile.readyToBreakthrough ||
                      calc.nextProfile.exp >= calc.nextProfile.maxExp,
                  ),
                  clockBeforeLabel: beforeFmt,
                  clockAfterLabel: afterFmt,
                  canChiBefore: `Năm ${beforeClockFmt.canChiYear} (${beforeClockFmt.dateStr})`,
                  canChiAfter: `Năm ${afterClockFmt.canChiYear} (${afterClockFmt.dateStr})`,
                  deltaLabel,
                  seclusionSummary: calc.seclusionSummary,
                  isSeclusionJump: isSeclusion,
                };
              }}
              onGenerateRankings={async (
                targetBoard: CultivationRankingBoard | 'all',
                onProgress?: (msg: string) => void,
              ) => {
                const res = await generateCultivationRankingsWithAi({
                  state: appState,
                  targetBoard,
                  onProgress,
                });
                if (!res.ok || !res.entries) {
                  return { ok: false, error: res.error };
                }
                const generatedBoards = new Set(res.boardsGenerated || []);
                onUpdateMemory((prev) => {
                  const curCult = prev.cultivation || cultivationProfile;
                  const keptOld = (curCult.rankings || []).filter(
                    (entry) => !generatedBoards.has(entry.board),
                  );
                  return {
                    ...prev,
                    cultivation: {
                      ...curCult,
                      rankings: enforceTopTenPerBoard([
                        ...keptOld,
                        ...res.entries!,
                      ]),
                      lastUpdatedAt: Date.now(),
                    },
                  };
                });
                return {
                  ok: true,
                  count: res.entries.length,
                  boardsCount: generatedBoards.size,
                };
              }}
              onUnlockRankingIntel={async (
                entry: CultivationRankingEntry,
                locationHint: string,
              ) => {
                const res = await unlockRankingNpcIntelWithAi({
                  state: appState,
                  entry,
                  locationHint,
                });
                if (!res.ok || !res.updatedEntry) {
                  return { ok: false, error: res.error };
                }
                onUpdateMemory((prev) => {
                  const curCult = prev.cultivation || cultivationProfile;
                  return {
                    ...prev,
                    cultivation: {
                      ...curCult,
                      rankings: enforceTopTenPerBoard(
                        (curCult.rankings || []).map((r) =>
                          r.id === entry.id ? res.updatedEntry! : r,
                        ),
                      ),
                      lastUpdatedAt: Date.now(),
                    },
                  };
                });
                return { ok: true };
              }}
              onRecalculateRankings={async (
                targetBoard: CultivationRankingBoard | 'all',
                onProgress?: (msg: string) => void,
              ) => {
                const res = await recalculateCultivationRankingsWithAi({
                  state: appState,
                  targetBoard,
                  onProgress,
                });
                if (!res.ok || !res.updatedRankings) {
                  return { ok: false, error: res.error };
                }
                onUpdateMemory((prev) => {
                  const curCult = prev.cultivation || cultivationProfile;
                  return {
                    ...prev,
                    cultivation: {
                      ...curCult,
                      rankings: enforceTopTenPerBoard(res.updatedRankings!),
                      lastUpdatedAt: Date.now(),
                    },
                  };
                });
                return { ok: true, changeSummary: res.changeSummary };
              }}
              onSimulateRankingSpar={async (
                targetBoard: CultivationRankingBoard | 'all',
                npcA: CultivationRankingEntry,
                npcB: CultivationRankingEntry,
                onProgress?: (msg: string) => void,
              ) => {
                // Read-only AI simulation: intentionally does NOT call onUpdateMemory or mutate MC state.
                const res = await simulateTopNpcSparWithAi({
                  state: appState,
                  targetBoard,
                  npcA,
                  npcB,
                  onProgress,
                });
                if (!res.ok || !res.summary) {
                  return { ok: false, error: res.error };
                }
                return {
                  ok: true,
                  npcAName: res.npcAName,
                  npcARank: res.npcARank,
                  npcBName: res.npcBName,
                  npcBRank: res.npcBRank,
                  boardLabel: res.boardLabel,
                  venue: res.venue,
                  summary: res.summary,
                  verdict: res.verdict,
                };
              }}
              onOpenClock={() => {
                setMemoryInitialTab('states');
                openUtilityScreen('memory');
              }}
              onClose={() => {
                setCultivationInitialSeclusionOpen(false);
                closeUtilityScreen();
              }}
              onNotify={onNotify}
            />
          )}

          {/* Dedicated Sub-Screen Content: Story Turn Statistics */}
          {activeUtility === 'stats' && (
            <div className="space-y-3.5 rounded-2xl bg-[#162032]/90 p-4 sm:p-5 ring-1 ring-inset ring-indigo-400/20 shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#111b2c]/90 p-3.5 ring-1 ring-inset ring-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <FileText className="h-3.5 w-3.5 text-sky-300" />
                    <span>Tổng số từ</span>
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-50 tabular-nums">
                    {storyStats.totalWords.toLocaleString('vi-VN')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                    TB {storyStats.avgWordsPerTurn.toLocaleString('vi-VN')}{' '}
                    từ/lượt
                    {storyStats.turnCount > 0 && (
                      <>
                        {' '}
                        · Trang {safePage + 1}:{' '}
                        {storyStats.currentPageWords.toLocaleString('vi-VN')}
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-[#111b2c]/90 p-3.5 ring-1 ring-inset ring-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Số lượt đã tương tác</span>
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-50 tabular-nums">
                    {storyStats.turnCount.toLocaleString('vi-VN')}{' '}
                    <span className="text-xs font-semibold text-slate-400">
                      lượt
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                    {storyStats.repliedTurns}/{storyStats.turnCount} lượt có
                    phản hồi AI
                    {storyStats.imageCount > 0 && (
                      <> · {storyStats.imageCount} ảnh</>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-[#111b2c]/90 p-3.5 ring-1 ring-inset ring-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-amber-300" />
                    <span>Thời gian TB mỗi lượt</span>
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-50 tabular-nums">
                    {storyStats.avgTimeDisplay}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {storyStats.avgTimeHint}
                  </div>
                </div>
              </div>

              {storyStats.turnCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3 text-xs text-slate-400 tabular-nums">
                  <span>
                    Lượt gọi:{' '}
                    <strong className="font-semibold text-slate-200">
                      {storyStats.userWords.toLocaleString('vi-VN')}
                    </strong>{' '}
                    từ · Lượt trả lời:{' '}
                    <strong className="font-semibold text-slate-200">
                      {storyStats.aiWords.toLocaleString('vi-VN')}
                    </strong>{' '}
                    từ
                  </span>
                  <span>
                    Đọc toàn truyện:{' '}
                    <strong className="font-semibold text-slate-200">
                      ~{storyStats.totalReadingMinutes} phút
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Dedicated Sub-Screen Content: In-Story Image Generation (Seedream 5 Pro) */}
          {activeUtility === 'image' && (
            <div className="space-y-3.5 rounded-2xl bg-[#162032]/90 p-4 sm:p-5 ring-1 ring-inset ring-sky-400/20 shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 shrink-0 text-sky-300" />
                  <span className="text-xs font-bold text-slate-100">
                    Thiết lập sinh ảnh cho Trang {safePage + 1}
                  </span>
                  <span className="truncate text-[11px] font-medium text-sky-300">
                    · {activeTargetSummary}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStoryImageConfig({
                        enabled: !storyImageConfig.enabled,
                      })
                    }
                    className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                      storyImageConfig.enabled
                        ? 'bg-sky-500/16 text-sky-200 ring-sky-400/32'
                        : 'bg-white/[0.06] text-slate-300 ring-white/[0.09]'
                    }`}
                  >
                    Sinh ảnh: {storyImageConfig.enabled ? 'Bật' : 'Tắt'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStoryImageConfig({
                        autoGenerate: !storyImageConfig.autoGenerate,
                      })
                    }
                    className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                      storyImageConfig.autoGenerate
                        ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/32'
                        : 'bg-white/[0.06] text-slate-300 ring-white/[0.09] hover:bg-white/[0.10]'
                    }`}
                  >
                    Tự động: {storyImageConfig.autoGenerate ? 'Bật' : 'Tắt'}
                  </button>
                </div>
              </div>

              <div className="space-y-3 border-t border-white/[0.07] pt-3">
                {/* Target Mode Selector */}
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-slate-400">
                    Đối tượng sinh ảnh
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {(
                      [
                        {
                          id: 'scene',
                          label: 'Cảnh truyện',
                          icon: ImageIcon,
                        },
                        {
                          id: 'npc',
                          label: npcs.length
                            ? `Chọn NPC (${npcs.length})`
                            : 'Chọn NPC',
                          icon: Users,
                        },
                        {
                          id: 'mc',
                          label: 'Nhân vật chính',
                          icon: User,
                        },
                        {
                          id: 'custom',
                          label: 'Tùy chọn',
                          icon: SlidersHorizontal,
                        },
                      ] as Array<{
                        id: StoryImageTargetMode;
                        label: string;
                        icon: typeof ImageIcon;
                      }>
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const active = storyImageConfig.targetMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            const patch: Partial<StoryImageConfig> = {
                              targetMode: opt.id,
                            };
                            if (
                              opt.id === 'npc' &&
                              !storyImageConfig.selectedNpcId &&
                              npcs.length
                            ) {
                              patch.selectedNpcId = npcs[0].id;
                            }
                            onUpdateStoryImageConfig(patch);
                          }}
                          className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold ring-1 ring-inset transition-all ${
                            active
                              ? 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                              : 'bg-white/[0.045] text-slate-300 ring-white/[0.07] hover:bg-white/[0.09]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* NPC Picker when mode === 'npc' */}
                {storyImageConfig.targetMode === 'npc' && (
                  <div className="space-y-2 rounded-xl bg-[#0e1625]/85 p-3 ring-1 ring-inset ring-white/[0.07]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-400">
                        Chọn NPC từ hồ sơ{' '}
                        <span className="text-slate-200">
                          {activeCompanionName || 'Đồng nhân'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('companion')}
                        className="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                      >
                        Quản lý NPC →
                      </button>
                    </div>

                    {npcs.length === 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400">
                        <span>
                          Hồ sơ hiện tại chưa có NPC nào. Hãy thêm NPC trong mục
                          Đồng nhân hoặc chuyển sang Tùy chọn.
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onNavigate('companion')}
                            className="min-h-[30px] rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24"
                          >
                            Thêm NPC
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateStoryImageConfig({
                                targetMode: 'custom',
                              })
                            }
                            className="min-h-[30px] rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09]"
                          >
                            Dùng Tùy chọn
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {npcs.map((npc) => {
                            const selected = activeSelectedNpc?.id === npc.id;
                            return (
                              <button
                                key={npc.id}
                                type="button"
                                onClick={() =>
                                  onUpdateStoryImageConfig({
                                    selectedNpcId: npc.id,
                                  })
                                }
                                className={`inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
                                  selected
                                    ? 'bg-emerald-500/18 text-emerald-100 ring-emerald-400/38'
                                    : 'bg-white/[0.05] text-slate-300 ring-white/[0.07] hover:bg-white/[0.09]'
                                }`}
                              >
                                <span className="truncate">
                                  {npc.name || 'NPC'}
                                </span>
                                {npc.role && (
                                  <span className="truncate text-[10px] font-normal text-slate-400">
                                    ({npc.role})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {activeSelectedNpc?.desc && (
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                            <span className="font-semibold text-slate-300">
                              Mô tả NPC:
                            </span>{' '}
                            {activeSelectedNpc.desc}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Custom Subject / Extra Prompt Details */}
                <div>
                  <label
                    htmlFor="storyImageCustomInput"
                    className="mb-1.5 block text-[11px] font-medium text-slate-400"
                  >
                    {storyImageConfig.targetMode === 'custom'
                      ? 'Mô tả tùy chọn để sinh ảnh (nhân vật, hành động, khung cảnh...)'
                      : 'Chi tiết bổ sung (tùy chọn — góc máy, biểu cảm, trang phục, ánh sáng...)'}
                  </label>
                  <input
                    id="storyImageCustomInput"
                    type="text"
                    value={storyImageConfig.customSubject}
                    onChange={(e) =>
                      onUpdateStoryImageConfig({
                        customSubject: e.target.value,
                      })
                    }
                    placeholder={
                      storyImageConfig.targetMode === 'custom'
                        ? 'Ví dụ: Cô gái tóc bạc đứng dưới mưa đèn neon, ánh mắt bình thản...'
                        : 'Ví dụ: góc cận mặt, ánh hoàng hôn ấm áp, nụ cười nhẹ...'
                    }
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>

                {/* Art Style & Camera Angle Selector */}
                <ImageStylePicker
                  storyImageConfig={storyImageConfig}
                  onUpdateStoryImageConfig={onUpdateStoryImageConfig}
                  portraits={collectAllAvailablePortraits(appState)}
                  compact
                  onInsertVariable={(token) => {
                    const prev = storyImageConfig.customSubject || '';
                    onUpdateStoryImageConfig({
                      customSubject: prev.trim()
                        ? `${prev.trimEnd()} ${token}`
                        : token,
                    });
                  }}
                  onDownloadImage={onDownloadImage}
                  onNotify={onNotify}
                />

                {/* Editable Prompt Template & Before/After Injection Preview */}
                <ImagePromptTemplatePanel
                  appState={appState}
                  currentTurn={currentTurn}
                  storyImageConfig={storyImageConfig}
                  onUpdateStoryImageConfig={onUpdateStoryImageConfig}
                  onDownloadImage={onDownloadImage}
                  onNotify={onNotify}
                />

                {/* Selective Beat Frame Selector (Opening / Middle / Ending) */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-400">
                    <span>Chọn khung ảnh cần sinh theo lượt</span>
                    <span className="text-[10.5px] text-sky-300/90">
                      Đang bật {configuredBeatCount}/3 khung
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        {
                          pos: 'opening' as const,
                          label: 'Mở cảnh',
                          sub: 'Đầu đoạn',
                        },
                        {
                          pos: 'middle' as const,
                          label: 'Rõ mặt',
                          sub: 'Giữa đoạn',
                        },
                        {
                          pos: 'ending' as const,
                          label: 'Kết mở',
                          sub: 'Cuối đoạn',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = enabledBeatPositions.includes(opt.pos);
                      return (
                        <button
                          key={opt.pos}
                          type="button"
                          aria-pressed={active}
                          onClick={() => handleToggleBeatPosition(opt.pos)}
                          className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center ring-1 ring-inset transition-all ${
                            active
                              ? 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                              : 'bg-white/[0.04] text-slate-400 ring-white/[0.07] hover:bg-white/[0.08] hover:text-slate-200'
                          }`}
                        >
                          <span className="text-xs font-semibold leading-tight">
                            {opt.label}
                          </span>
                          <span className="text-[10px] opacity-80">
                            {opt.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        {
                          label: 'Chỉ 1 khung rõ mặt',
                          positions: ['middle'] as StoryImagePosition[],
                          count: 1 as const,
                        },
                        {
                          label: 'Đầu + Cuối',
                          positions: [
                            'opening',
                            'ending',
                          ] as StoryImagePosition[],
                          count: 2 as const,
                        },
                        {
                          label: 'Đủ 3 khung',
                          positions: [
                            'opening',
                            'middle',
                            'ending',
                          ] as StoryImagePosition[],
                          count: 3 as const,
                        },
                      ] as const
                    ).map((preset) => {
                      const isMatch =
                        enabledBeatPositions.length ===
                          preset.positions.length &&
                        preset.positions.every((p) =>
                          enabledBeatPositions.includes(p),
                        );
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            onUpdateStoryImageConfig({
                              enabledPositions: [...preset.positions],
                              maxImagesPerTurn: preset.count,
                            })
                          }
                          className={`min-h-[26px] rounded-lg px-2 text-[10.5px] font-medium ring-1 ring-inset transition-colors ${
                            isMatch
                              ? 'bg-sky-500/16 text-sky-200 ring-sky-400/32'
                              : 'bg-white/[0.035] text-slate-400 ring-white/[0.07] hover:bg-white/[0.08] hover:text-slate-200'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Face Clarity & Avatar Identity Lock Controls */}
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={preferClearFaceSolo}
                    onClick={() =>
                      onUpdateStoryImageConfig({
                        preferClearFaceSolo: !preferClearFaceSolo,
                      })
                    }
                    className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-all ${
                      preferClearFaceSolo
                        ? 'bg-emerald-500/14 text-emerald-100 ring-emerald-400/32'
                        : 'bg-white/[0.04] text-slate-300 ring-white/[0.08] hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span>Ưu tiên 1 người rõ mặt</span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-slate-400">
                        Tránh cảnh 2+ người, quay lưng hoặc góc xa gây biến dạng
                        khuôn mặt.
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        preferClearFaceSolo
                          ? 'bg-emerald-400/20 text-emerald-200'
                          : 'bg-white/[0.07] text-slate-400'
                      }`}
                    >
                      {preferClearFaceSolo ? 'Bật' : 'Tắt'}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={lockAvatarIdentity}
                    onClick={() =>
                      onUpdateStoryImageConfig({
                        lockAvatarIdentity: !lockAvatarIdentity,
                      })
                    }
                    className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-all ${
                      lockAvatarIdentity
                        ? 'bg-indigo-500/15 text-indigo-100 ring-indigo-400/35'
                        : 'bg-white/[0.04] text-slate-300 ring-white/[0.08] hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span>Khóa nhận diện từ Avatar</span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-slate-400">
                        Tự kéo tuổi trẻ trung, nét mặt, kiểu tóc từ avatar/hồ sơ
                        vào prompt.
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        lockAvatarIdentity
                          ? 'bg-indigo-400/20 text-indigo-200'
                          : 'bg-white/[0.07] text-slate-400'
                      }`}
                    >
                      {lockAvatarIdentity ? 'Bật' : 'Tắt'}
                    </span>
                  </button>
                </div>

                {/* Size Selector */}
                <div>
                  <label
                    htmlFor="storyImageSizeSelect"
                    className="mb-1.5 block text-[11px] font-medium text-slate-400"
                  >
                    Tỷ lệ / Kích thước
                  </label>
                  <select
                    id="storyImageSizeSelect"
                    value={storyImageConfig.size}
                    onChange={(e) =>
                      onUpdateStoryImageConfig({ size: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  >
                    {STORY_IMAGE_SIZES.map((sz) => (
                      <option key={sz.value || 'default'} value={sz.value}>
                        {sz.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  {!hasSeedreamConfigured ? (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-200">
                      <span>
                        {appState.config.imageProvider === 'comfyui'
                          ? 'Chưa cấu hình ComfyUI URL / Workflow.'
                          : appState.config.imageProvider === 'custom'
                            ? 'Chưa có Custom Image Endpoint.'
                            : appState.config.imageProvider === 'latent'
                              ? 'Chưa nhập Latent API Key (lat_sk_...).'
                              : 'Chưa có Seedream Endpoint.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('config')}
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-amber-500/16 px-2.5 font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/32 hover:bg-amber-500/24"
                      >
                        <Settings className="h-3 w-3" />
                        <span>Mở Cấu hình</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Dùng {getImageProviderLabel(appState.config.imageProvider)} đã cấu hình · Gọi tuần tự
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    {isGeneratingImage && (
                      <button
                        type="button"
                        onClick={onCancelStoryImage}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-rose-500/16 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/24"
                      >
                        <Square className="h-3 w-3 fill-current" />
                        <span>Hủy ảnh</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isGeneratingImage || !currentTurn}
                      onClick={() => {
                        if (isGeneratingImage || storyImgLockRef.current) return;
                        storyImgLockRef.current = true;
                        window.setTimeout(() => {
                          storyImgLockRef.current = false;
                        }, 350);
                        onGenerateStoryImage(safePage);
                        closeUtilityScreen();
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
                    >
                      {isGeneratingImage ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isGeneratingImage
                          ? 'Đang sinh ảnh...'
                          : hasAnyCurrentTurnStoryImage
                            ? `Vẽ lại (${configuredBeatCount} khung)`
                            : `Sinh ${configuredBeatCount} ảnh trang này`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dedicated Sub-Screen Content: Quick Story Search */}
          {activeUtility === 'search' && (
            <div className="space-y-3 rounded-2xl bg-[#162032]/90 p-4 sm:p-5 ring-1 ring-inset ring-sky-400/20 shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)]">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={storyQuery}
                    onChange={(e) => setStoryQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && storyMatches.length) {
                        e.preventDefault();
                        jumpToMatch(e.shiftKey ? -1 : 1);
                      }
                    }}
                    aria-label="Tìm nhanh trong nội dung truyện"
                    placeholder="Nhập từ khóa trong truyện (hỗ trợ không dấu)..."
                    className="min-h-[42px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-2 pl-9 pr-9 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                  {storyQuery && (
                    <button
                      type="button"
                      aria-label="Xóa tìm kiếm"
                      onClick={() => setStoryQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {trimmedQuery && (
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="px-1.5 text-[11px] font-medium text-slate-300 tabular-nums whitespace-nowrap">
                      {storyMatches.length
                        ? currentMatchPos >= 0
                          ? `${currentMatchPos + 1} / ${storyMatches.length}`
                          : `${storyMatches.length} trang`
                        : '0 kết quả'}
                    </span>
                    <button
                      type="button"
                      disabled={!storyMatches.length}
                      aria-label="Kết quả trước"
                      onClick={() => jumpToMatch(-1)}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] disabled:opacity-35"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!storyMatches.length}
                      aria-label="Kết quả tiếp theo"
                      onClick={() => jumpToMatch(1)}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] disabled:opacity-35"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {trimmedQuery ? (
                <div className="space-y-2">
                  {!storyMatches.length ? (
                    <p className="text-xs text-slate-400">
                      Không tìm thấy &quot;{trimmedQuery}&quot; trong{' '}
                      {turns.length} trang truyện.
                    </p>
                  ) : (
                    storyMatches.map((m) => {
                      const isCurrent = m.turnIndex === safePage;
                      return (
                        <button
                          key={m.turnIndex}
                          type="button"
                          onClick={() => {
                            navigateToPage(m.turnIndex);
                          }}
                          className={`block w-full rounded-xl px-3.5 py-2.5 text-left ring-1 ring-inset transition-colors ${
                            isCurrent
                              ? 'bg-sky-500/16 ring-sky-400/35'
                              : 'bg-[#0e1625]/80 ring-white/[0.06] hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-sky-300 tabular-nums">
                              Trang {m.turnIndex + 1}
                              {isCurrent ? ' (Đang đọc)' : ''}
                            </span>
                            <span className="text-slate-400">
                              {m.sourceLabel}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-300">
                            {m.snippet}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Nhập tên nhân vật, địa điểm hoặc cụm từ bất kỳ để tìm xuyên
                  suốt {turns.length} trang truyện. Bấm vào kết quả để nhảy
                  thẳng tới trang đó.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Smart Backup Reminder Strip after X unbacked-up turns */}
          {!zenMode &&
            showBackupReminder &&
            turns.length > 0 &&
            onQuickBackup && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-950/65 px-3.5 py-2.5 text-xs ring-1 ring-inset ring-amber-400/35">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-amber-300" />
                  <span className="leading-snug text-amber-100">
                    Bạn đã chơi thêm{' '}
                    <strong className="font-bold tabular-nums">
                      {turnsSinceLastBackup} lượt
                    </strong>{' '}
                    chưa tải file backup .json về máy.
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isQuickBackingUp}
                    onClick={onQuickBackup}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-amber-400/22 px-3 text-xs font-semibold text-amber-50 ring-1 ring-inset ring-amber-300/45 transition-colors hover:bg-amber-400/32 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
                  >
                    {isQuickBackingUp ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Sao lưu ngay</span>
                  </button>
                  {onDismissBackupReminder && (
                    <button
                      type="button"
                      aria-label="Ẩn nhắc sao lưu"
                      onClick={onDismissBackupReminder}
                      className="rounded-lg p-1.5 text-amber-200/75 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

          {/* Compact Mobile-First Reader Control Bar */}
          <div className="relative z-20 space-y-2 rounded-2xl bg-[#162032]/88 p-2.5 sm:p-3.5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)]">
            {/* Row 1: Navigation, Zen Mode & Utility Menu */}
            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onNavigate('lobby')}
                  className="inline-flex h-10 sm:h-9 items-center justify-center gap-1 rounded-xl bg-white/[0.055] px-2.5 sm:px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  <span>Sảnh</span>
                </button>

                {zenMode && (
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate px-1 text-xs font-medium text-slate-300 tabular-nums">
                    <span className="shrink-0">
                      Tr. {safePage + 1}/{totalPages}
                    </span>
                    {storyClockState.enabled && (
                      <>
                        <span className="text-slate-500" aria-hidden="true">
                          ·
                        </span>
                        <span className="truncate text-amber-200/85">
                          {formattedStoryClock.timeStr}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {/* 1-Tap Quick Backup (.json) for Mobile */}
                {!zenMode && turns.length > 0 && onQuickBackup && (
                  <button
                    type="button"
                    disabled={isQuickBackingUp}
                    onClick={onQuickBackup}
                    title="Sao lưu nhanh toàn bộ truyện hiện tại ra file .json về máy (1 chạm)"
                    className={`inline-flex h-10 sm:h-9 items-center justify-center gap-1 rounded-xl px-2.5 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] disabled:opacity-60 whitespace-nowrap shrink-0 ${
                      turnsSinceLastBackup >= 5
                        ? 'bg-amber-500/20 text-amber-100 ring-amber-400/45 hover:bg-amber-500/30'
                        : 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/30 hover:bg-emerald-500/22'
                    }`}
                  >
                    {isQuickBackingUp ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="hidden xs:inline sm:inline">Sao lưu</span>
                    {turnsSinceLastBackup >= 5 && (
                      <span className="rounded bg-amber-400/25 px-1 py-0.5 text-[10px] font-bold tabular-nums text-amber-100">
                        +{turnsSinceLastBackup}
                      </span>
                    )}
                  </button>
                )}

                {/* Zen Mode (Đọc tập trung) Toggle Button */}
                <button
                  type="button"
                  aria-pressed={zenMode}
                  onClick={handleToggleZenMode}
                  title={
                    zenMode
                      ? 'Thoát chế độ Đọc tập trung (hiện lại thanh Gợi ý và Lượt mới)'
                      : 'Bật chế độ Đọc tập trung (ẩn các nút thao tác để tập trung đọc truyện)'
                  }
                  className={`inline-flex h-10 sm:h-9 items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                    zenMode
                      ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/45 shadow-[0_4px_14px_-6px_rgba(16,185,129,0.45)] hover:bg-emerald-500/28'
                      : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                  }`}
                >
                  <BookOpen
                    className={`h-3.5 w-3.5 shrink-0 ${
                      zenMode ? 'text-emerald-300' : 'text-sky-300'
                    }`}
                  />
                  <span className="sm:hidden">
                    {zenMode ? 'Thoát' : 'Tập trung'}
                  </span>
                  <span className="hidden sm:inline">
                    {zenMode ? 'Thoát tập trung' : 'Đọc tập trung'}
                  </span>
                </button>

                {/* Quick 1-tap Showbiz Phone Button */}
                {!zenMode && (
                  <button
                    type="button"
                    onClick={() => openUtilityScreen('showbiz_phone')}
                    title="Mở Điện thoại Showbiz (DM, Chat nhóm, MXH chạy AI riêng)"
                    className="inline-flex h-10 sm:h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-500/14 px-2.5 sm:px-3 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/30 transition-all hover:bg-amber-500/22 active:scale-[0.98] whitespace-nowrap shrink-0"
                  >
                    <Smartphone className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <span className="hidden sm:inline">Điện thoại</span>
                  </button>
                )}

                {/* Tiện ích Dropdown / Popover (opens each tool on its own dedicated screen) */}
                {!zenMode && (
                  <div ref={utilityMenuRef} className="relative">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={utilityMenuOpen}
                      onClick={() => setUtilityMenuOpen((v) => !v)}
                      className={`inline-flex h-10 sm:h-9 items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                        utilityMenuOpen
                          ? 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                          : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                      }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                      <span>Tiện ích</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                          utilityMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {utilityMenuOpen && (
                      <div
                        role="menu"
                        aria-label="Menu tiện ích truyện"
                        className="absolute right-0 top-full z-40 mt-2 w-[min(324px,calc(100vw-2rem))] rounded-2xl bg-[#182438]/96 p-2 ring-1 ring-white/[0.10] shadow-[0_24px_56px_-12px_rgba(2,6,23,0.82)] backdrop-blur-xl"
                      >
                        <div className="space-y-1">
                          {/* 0. Điện thoại Showbiz */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openUtilityScreen('showbiz_phone')}
                            className="flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Smartphone className="h-4 w-4 shrink-0 text-amber-300" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Điện thoại Showbiz
                                </div>
                                <div className="truncate text-[11px] text-slate-400 tabular-nums">
                                  DM · Chat nhóm · MXH ({appState.showbizPhone?.contacts?.length || 0} liên hệ)
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] font-medium text-amber-300">
                              Mở →
                            </span>
                          </button>

                          {/* 1. Tìm kiếm */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openUtilityScreen('search')}
                            className="flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Search className="h-4 w-4 shrink-0 text-sky-300" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Tìm kiếm
                                </div>
                                <div className="truncate text-[11px] text-slate-400">
                                  {trimmedQuery
                                    ? `"${trimmedQuery}" · ${storyMatches.length} trang`
                                    : 'Tìm nhanh từ khóa trong truyện'}
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] font-medium text-sky-300">
                              Mở →
                            </span>
                          </button>

                          {/* 2. Ký ức / AI Ghi nhớ */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMemoryInitialTab('lorebook');
                              openUtilityScreen('memory');
                            }}
                            className="flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Brain className="h-4 w-4 shrink-0 text-violet-300" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Ký ức / AI Ghi nhớ
                                </div>
                                <div className="truncate text-[11px] text-slate-400">
                                  {memorySummarySubtitle}
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] font-medium text-sky-300">
                              Mở →
                            </span>
                          </button>

                          {/* 2b. Hồ sơ Tu luyện / Võ học & Túi đồ */}
                          {cultivationProfile && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setCultivationInitialTab('realm');
                                openUtilityScreen('cultivation');
                              }}
                              className="flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <Swords className="h-4 w-4 shrink-0 text-emerald-300" />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold">
                                    Tu luyện &amp; Túi đồ
                                  </div>
                                  <div className="truncate text-[11px] text-slate-400 tabular-nums">
                                    {cultivationDisplay?.fullLabel ||
                                      cultivationProfile.realmName}{' '}
                                    ·{' '}
                                    {cultivationProfile.readyToBreakthrough ||
                                    cultivationProfile.exp >=
                                      cultivationProfile.maxExp
                                      ? 'Sẵn sàng đột phá'
                                      : `${cultivationProfile.exp}/${cultivationProfile.maxExp}`}{' '}
                                    · {cultivationProfile.techniques.length} công
                                    pháp · {cultivationProfile.inventory.length}{' '}
                                    vật phẩm
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 text-[11px] font-medium text-sky-300">
                                Mở →
                              </span>
                            </button>
                          )}

                          {/* 3. Sinh ảnh trong truyện */}
                          <div className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 py-2 text-slate-200 transition-colors hover:bg-white/[0.06]">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                if (!storyImageConfig.enabled) {
                                  onUpdateStoryImageConfig({ enabled: true });
                                }
                                openUtilityScreen('image');
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            >
                              <Sparkles className="h-4 w-4 shrink-0 text-sky-300" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Sinh ảnh trong truyện
                                </div>
                                <div className="truncate text-[11px] text-slate-400">
                                  {storyImageConfig.enabled
                                    ? activeTargetSummary
                                    : `Đang tắt · ${getImageProviderLabel(appState.config.imageProvider)}`}
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateStoryImageConfig({
                                  enabled: !storyImageConfig.enabled,
                                });
                              }}
                              className={`min-h-[30px] shrink-0 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                                storyImageConfig.enabled
                                  ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/30'
                                  : 'bg-white/[0.06] text-slate-300 ring-white/[0.09]'
                              }`}
                            >
                              {storyImageConfig.enabled ? 'Bật' : 'Tắt'}
                            </button>
                          </div>

                          {/* 4. Thư viện Ảnh Nhân vật / NPC */}
                          <div className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 py-2 text-slate-200 transition-colors hover:bg-white/[0.06]">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => openUtilityScreen('portraits')}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            >
                              <Users className="h-4 w-4 shrink-0 text-emerald-300" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Ảnh nhân vật / NPC
                                </div>
                                <div className="truncate text-[11px] text-slate-400 tabular-nums">
                                  {portraitCountSummary}
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdatePortraitBank((prev) => ({
                                  ...prev,
                                  autoGenerateOnAppear:
                                    !prev.autoGenerateOnAppear,
                                }))
                              }
                              title="Bật/Tắt tự sinh ảnh NPC chạy ngầm khi xuất hiện"
                              className={`min-h-[30px] shrink-0 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                                portraitBank?.autoGenerateOnAppear
                                  ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/30'
                                  : 'bg-white/[0.06] text-slate-300 ring-white/[0.09]'
                              }`}
                            >
                              {portraitBank?.autoGenerateOnAppear
                                ? 'Tự động'
                                : 'Thủ công'}
                            </button>
                          </div>

                          {/* 4b. Giao diện chọn ảnh nhanh (modal) */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setUtilityMenuOpen(false);
                              setImagePickerTarget({ mode: 'composer' });
                            }}
                            className="flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <ImageIcon className="h-4 w-4 shrink-0 text-sky-300" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Chọn ảnh
                                </div>
                                <div className="truncate text-[11px] text-slate-400">
                                  Ảnh NV/NPC, ảnh truyện &amp; đính kèm
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] font-medium text-sky-300">
                              Mở
                            </span>
                          </button>

                          {/* 5. Thống kê */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openUtilityScreen('stats')}
                            className="flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <BarChart3 className="h-4 w-4 shrink-0 text-indigo-300" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Thống kê
                                </div>
                                <div className="truncate text-[11px] text-slate-400 tabular-nums">
                                  {storyStats.totalWords.toLocaleString(
                                    'vi-VN',
                                  )}{' '}
                                  từ · {storyStats.turnCount} lượt
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] font-medium text-sky-300">
                              Mở →
                            </span>
                          </button>

                          {/* 6. Cài đặt hệ thống (mở trang riêng) */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setUtilityMenuOpen(false);
                              onNavigate('config');
                            }}
                            className="flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Settings className="h-4 w-4 shrink-0 text-slate-300" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Cài đặt hệ thống
                                </div>
                                <div className="truncate text-[11px] text-slate-400">
                                  Proxy API, Model &amp; Seedream 5 Pro
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] font-medium text-sky-300">
                              Mở →
                            </span>
                          </button>

                          <div className="my-1 border-t border-white/[0.07]" />

                          {/* Chế độ Lyric 4-Bar (mô-đun ẩn gọn nhẹ) */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onToggleLyricMode();
                              setUtilityMenuOpen(false);
                            }}
                            className="flex min-h-[42px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-1.5 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Music2
                                className={`h-4 w-4 shrink-0 ${
                                  lyricModeEnabled
                                    ? 'text-emerald-300'
                                    : 'text-slate-400'
                                }`}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold">
                                  Lyric 4-Bar (Diễn theo nhạc)
                                </div>
                                <div className="truncate text-[10px] text-slate-400">
                                  Giữ nguyên văn ca từ · NPC diễn nhịp 4 bar
                                </div>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 text-[11px] font-semibold ${
                                lyricModeEnabled
                                  ? 'text-emerald-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {lyricModeEnabled ? 'Bật' : 'Tắt'}
                            </span>
                          </button>

                          {/* Hậu kỳ */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onTogglePostMeta();
                              setUtilityMenuOpen(false);
                            }}
                            className="flex min-h-[42px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-1.5 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              {showPostMeta ? (
                                <Eye className="h-4 w-4 shrink-0 text-emerald-300" />
                              ) : (
                                <EyeOff className="h-4 w-4 shrink-0 text-slate-400" />
                              )}
                              <span className="text-xs font-semibold">
                                Hậu kỳ (thẻ meta)
                              </span>
                            </div>
                            <span
                              className={`shrink-0 text-[11px] font-semibold ${
                                showPostMeta
                                  ? 'text-emerald-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {showPostMeta ? 'Hiện' : 'Ẩn'}
                            </span>
                          </button>

                          {/* Ẩn / Hiện thanh mục cấu hình dưới */}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onToggleBottomNav();
                              setUtilityMenuOpen(false);
                            }}
                            className="flex min-h-[42px] w-full items-center justify-between gap-2.5 rounded-xl px-3 py-1.5 text-left text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <PanelBottom
                                className={`h-4 w-4 shrink-0 ${
                                  hideBottomNav
                                    ? 'text-amber-300'
                                    : 'text-slate-400'
                                }`}
                              />
                              <span className="text-xs font-semibold">
                                {hideBottomNav
                                  ? 'Hiện thanh mục dưới'
                                  : 'Ẩn thanh mục dưới'}
                              </span>
                            </div>
                            <span
                              className={`shrink-0 text-[11px] font-semibold ${
                                hideBottomNav
                                  ? 'text-amber-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {hideBottomNav ? 'Đang ẩn' : 'Đang hiện'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Compact AI Generation, Pure-Text / Auto-Image & Display Controls */}
            {!zenMode && (
              <div className="grid grid-cols-3 gap-1.5 border-t border-white/[0.07] pt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                <button
                  type="button"
                  aria-pressed={streamEnabled}
                  onClick={onToggleStream}
                  title={
                    isGenerating
                      ? streamEnabled
                        ? 'Đang stream phản hồi AI (bấm để tắt stream cho lượt sau)'
                        : 'Đang gọi AI không stream'
                      : streamEnabled
                        ? 'Chế độ Stream đang bật (bấm để tắt)'
                        : 'Chế độ Stream đang tắt (bấm để bật)'
                  }
                  className={`inline-flex h-10 sm:h-9 items-center justify-center gap-1 rounded-xl px-1.5 sm:px-3 text-[11px] sm:text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap ${
                    isGenerating
                      ? streamEnabled
                        ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/42'
                        : 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                      : streamEnabled
                        ? 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/28 hover:bg-emerald-500/22'
                        : 'bg-white/[0.05] text-slate-400 ring-white/[0.08] hover:bg-white/[0.09] hover:text-slate-200'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      <span>{streamEnabled ? 'Streaming' : 'Đang gọi'}</span>
                    </>
                  ) : streamEnabled ? (
                    <>
                      <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      <span>Stream</span>
                    </>
                  ) : (
                    <>
                      <ZapOff className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>Stream</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onStopGeneration}
                  disabled={!isGenerating}
                  title="Dừng tạo nội dung đang chạy"
                  className={`inline-flex h-10 sm:h-9 items-center justify-center gap-1 rounded-xl px-1.5 sm:px-3 text-[11px] sm:text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] disabled:opacity-35 whitespace-nowrap ${
                    isGenerating
                      ? 'bg-rose-500/22 text-rose-100 ring-rose-400/45 hover:bg-rose-500/30'
                      : 'bg-rose-500/12 text-rose-200 ring-rose-400/24 hover:bg-rose-500/20'
                  }`}
                >
                  <Square className="h-3 w-3 shrink-0 fill-current" />
                  <span>Dừng</span>
                </button>

                <button
                  type="button"
                  onClick={onRegenerateCurrent}
                  disabled={isGenerating || !turns.length}
                  title="Tạo lại lượt trả lời hiện tại"
                  className="inline-flex h-10 sm:h-9 items-center justify-center gap-1 rounded-xl bg-amber-500/14 px-1.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-all hover:bg-amber-500/22 active:scale-[0.98] disabled:opacity-35 whitespace-nowrap"
                >
                  <RefreshCw className="h-3 w-3 shrink-0" />
                  <span>Làm lại</span>
                </button>

                <button
                  type="button"
                  aria-pressed={showRawTags}
                  onClick={onToggleRawTags}
                  title={
                    showRawTags
                      ? 'Đang hiện thẻ thô — bấm để ẩn'
                      : 'Đang ẩn thẻ thô — bấm để hiện'
                  }
                  className={`inline-flex h-10 sm:h-9 items-center justify-center gap-1 rounded-xl px-1.5 sm:px-3 text-[11px] sm:text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap ${
                    showRawTags
                      ? 'bg-sky-500/18 text-sky-100 ring-sky-400/36 hover:bg-sky-500/25'
                      : 'bg-white/[0.05] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                  }`}
                >
                  {showRawTags ? (
                    <Eye className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                  <span>Thẻ thô</span>
                </button>

                <button
                  type="button"
                  aria-pressed={isAutoStoryImageOn}
                  onClick={handleToggleQuickAutoStoryImage}
                  title={
                    isAutoStoryImageOn
                      ? 'Đang tự động vẽ ảnh minh họa theo lượt — bấm để chuyển sang đọc thuần chữ'
                      : 'Đang đọc thuần chữ (tắt tự động vẽ ảnh) — bấm để bật lại tự động vẽ ảnh'
                  }
                  className={`col-span-2 sm:col-span-1 inline-flex h-10 sm:h-9 items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap ${
                    isAutoStoryImageOn
                      ? 'bg-sky-500/16 text-sky-100 ring-sky-400/34 hover:bg-sky-500/24'
                      : 'bg-white/[0.05] text-slate-300 ring-white/[0.09] hover:bg-white/[0.10] hover:text-white'
                  }`}
                >
                  {isAutoStoryImageOn ? (
                    <>
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                      <span>
                        Ảnh tự động ({configuredBeatCount})
                      </span>
                    </>
                  ) : (
                    <>
                      <ImageOff className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>Đọc thuần chữ</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Compact error notice (only shown when generation errors) */}
            {genStatus.isErr && genStatus.text && (
              <div className="border-t border-rose-400/20 pt-2 text-[11px] font-medium text-rose-300">
                {genStatus.text}
              </div>
            )}

            {/* Clean single-line Story Clock strip (opens dedicated Memory/Clock page on tap) */}
            {!zenMode && storyClockState.enabled && (
              <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2.5 text-[11px] text-slate-300">
                <button
                  type="button"
                  onClick={() => {
                    setMemoryInitialTab('states');
                    openUtilityScreen('memory');
                  }}
                  className="flex min-w-0 items-center gap-1.5 truncate text-left transition-colors hover:text-amber-200"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <span className="font-semibold text-amber-200 tabular-nums shrink-0">
                    {formattedStoryClock.timeStr}
                  </span>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span className="truncate tabular-nums text-slate-300">
                    {formattedStoryClock.eraLabel
                      ? `${formattedStoryClock.eraLabel} · ${formattedStoryClock.dateStr}`
                      : `${formattedStoryClock.weekday}, ${formattedStoryClock.dateStr} · ${formattedStoryClock.period}`}
                  </span>
                  {storyClockState.lastDeltaMinutes &&
                    storyClockState.lastDeltaMinutes > 0 && (
                      <span className="hidden text-slate-400 tabular-nums sm:inline shrink-0">
                        ({formatDeltaMinutesVi(storyClockState.lastDeltaMinutes)}
                        )
                      </span>
                    )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMemoryInitialTab('states');
                    openUtilityScreen('memory');
                  }}
                  className="shrink-0 font-semibold text-slate-400 transition-colors hover:text-amber-200 whitespace-nowrap"
                >
                  Chỉnh giờ
                </button>
              </div>
            )}

            {/* Clean single-line Cultivation & Bag strip */}
            {!zenMode && cultivationProfile && (
              <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2 text-[11px] text-slate-300">
                <button
                  type="button"
                  onClick={() => {
                    setCultivationInitialTab('realm');
                    openUtilityScreen('cultivation');
                  }}
                  className="flex min-w-0 items-center gap-1.5 truncate text-left transition-colors hover:text-emerald-200"
                >
                  <Swords
                    className={`h-3.5 w-3.5 shrink-0 ${
                      cultivationRealmTheme?.compactIconClass || 'text-emerald-300'
                    }`}
                  />
                  <span
                    className={`font-semibold truncate ${
                      cultivationRealmTheme?.compactTextClass || 'text-emerald-200'
                    }`}
                  >
                    {cultivationDisplay?.fullLabel || cultivationProfile.realmName}
                  </span>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${
                      cultivationProfile.readyToBreakthrough ||
                      cultivationProfile.exp >= cultivationProfile.maxExp
                        ? 'font-semibold text-amber-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {cultivationProfile.readyToBreakthrough ||
                    cultivationProfile.exp >= cultivationProfile.maxExp
                      ? cultivationDisplay && cultivationDisplay.overflowExp > 0
                        ? `Đột phá (+${cultivationDisplay.overflowExp} dư)`
                        : 'Sẵn sàng đột phá'
                      : `${cultivationProfile.exp}/${cultivationProfile.maxExp}`}
                  </span>
                  <span
                    className="hidden text-slate-500 sm:inline"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <span className="hidden shrink-0 tabular-nums text-slate-400 sm:inline">
                    {cultivationProfile.techniques.length} công pháp ·{' '}
                    {cultivationProfile.inventory.length} món
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      setCultivationInitialTab('realm');
                      setCultivationInitialSeclusionOpen(true);
                      openUtilityScreen('cultivation');
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30 transition-colors hover:bg-amber-500/25"
                  >
                    <Lock className="h-3 w-3 text-amber-300" />
                    <span>Khóa tu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCultivationInitialTab('realm');
                      setCultivationInitialSeclusionOpen(false);
                      openUtilityScreen('cultivation');
                    }}
                    className="font-semibold text-emerald-300 transition-colors hover:text-emerald-200"
                  >
                    Hồ sơ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCultivationInitialTab('rankings');
                      setCultivationInitialSeclusionOpen(false);
                      openUtilityScreen('cultivation');
                    }}
                    className="font-semibold text-sky-300 transition-colors hover:text-sky-200"
                  >
                    Bảng XH
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCultivationInitialTab('inventory');
                      setCultivationInitialSeclusionOpen(false);
                      openUtilityScreen('cultivation');
                    }}
                    className="font-semibold text-slate-400 transition-colors hover:text-amber-200"
                  >
                    Túi đồ
                  </button>
                </div>
              </div>
            )}

            {/* Minimal 1-line active search reminder */}
            {!zenMode && trimmedQuery && (
              <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2 text-[11px] text-slate-300">
                <button
                  type="button"
                  onClick={() => openUtilityScreen('search')}
                  className="flex min-w-0 items-center gap-1.5 truncate text-left hover:text-sky-300"
                >
                  <Search className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                  <span className="truncate">
                    Đang tìm &quot;{trimmedQuery}&quot; ({storyMatches.length}{' '}
                    trang)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStoryQuery('')}
                  className="shrink-0 font-semibold text-slate-400 hover:text-slate-100"
                >
                  Xóa lọc
                </button>
              </div>
            )}

            {/* Lightweight 1-line Background Auto-Portrait Status */}
            {!zenMode && bgPortraitStatus && (
              <div
                className={`flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2 text-[11px] ${
                  bgPortraitStatus.isErr
                    ? 'text-rose-300'
                    : bgPortraitStatus.active
                      ? 'text-sky-300'
                      : 'text-emerald-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => openUtilityScreen('portraits')}
                  className="flex min-w-0 flex-1 items-start gap-1.5 text-left hover:underline"
                >
                  {bgPortraitStatus.active ? (
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span
                    className={
                      bgPortraitStatus.isErr
                        ? 'break-words leading-snug'
                        : 'truncate'
                    }
                  >
                    {bgPortraitStatus.text}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  {bgPortraitStatus.active ? (
                    <button
                      type="button"
                      onClick={onCancelBgPortraits}
                      className="font-semibold text-rose-300 hover:text-rose-200"
                    >
                      Dừng
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openUtilityScreen('portraits')}
                        className="font-semibold text-sky-300 hover:text-sky-200"
                      >
                        Xem ảnh
                      </button>
                      <button
                        type="button"
                        aria-label="Ẩn thông báo ảnh ngầm"
                        onClick={onDismissBgPortraitStatus}
                        className="rounded p-0.5 text-slate-400 hover:text-slate-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

      {/* Turn Content */}
      {!currentTurn ? (
        <div className="rounded-2xl bg-[#162032]/88 p-6 text-sm text-slate-300 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)]">
          Chưa có lượt nào. Nhập file Save (.json) hoặc nhập lượt gọi mới bên dưới.
        </div>
      ) : (
        <div className="space-y-3.5 [overflow-anchor:none]">
          {/* User Turn Box */}
          <article className="rounded-2xl bg-[#141e30]/86 p-4 sm:p-5 ring-1 ring-white/[0.07] shadow-[0_10px_28px_-18px_rgba(2,8,23,0.65)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <span className="font-semibold text-slate-100">Lượt gọi</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Trang {safePage + 1}</span>
              </div>
              {!zenMode && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingUserIdx === safePage) {
                        onUpdateTurn(safePage, { user: editingUserDraft });
                        setEditingUserIdx(null);
                      } else {
                        setEditingUserDraft(currentTurn.user || '');
                        setEditingUserIdx(safePage);
                      }
                    }}
                    className="inline-flex min-h-[34px] items-center justify-center rounded-lg bg-white/[0.055] px-2.5 sm:px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
                  >
                    {editingUserIdx === safePage ? 'Lưu' : 'Sửa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTurn(safePage)}
                    aria-label={`Xóa Trang ${safePage + 1}`}
                    className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg bg-rose-500/12 px-2.5 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/24 transition-all hover:bg-rose-500/22 hover:text-rose-100 active:scale-[0.98] whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Xóa<span className="hidden sm:inline"> trang</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            {currentTurnAttachedImages.length > 0 ? (
              <div className="mb-3.5 space-y-2">
                {currentTurnAttachedImages.length === 1 ? (
                  <TurnAttachedImageItem
                    source={currentTurnAttachedImages[0]}
                    index={0}
                    total={1}
                    pageNumber={safePage + 1}
                    keyHint={currentAttachKey}
                    caption={currentTurn.imageCaption}
                    onDownload={onDownloadImage}
                    onClearAttached={
                      onClearTurnAttachedImages && !isGenerating
                        ? () => onClearTurnAttachedImages(safePage)
                        : undefined
                    }
                    onOpenLightbox={(url, label) =>
                      setLightboxImage({
                        src: url,
                        label,
                      })
                    }
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-400">
                      <span>
                        Đã đính kèm {currentTurnAttachedImages.length} ảnh · Bấm ảnh để phóng to
                      </span>
                      {onClearTurnAttachedImages && !isGenerating && (
                        <button
                          type="button"
                          onClick={() => onClearTurnAttachedImages(safePage)}
                          className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-rose-500/12 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/24 transition-colors hover:bg-rose-500/22"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Xóa {currentTurnAttachedImages.length} ảnh tạm</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {currentTurnAttachedImages.map((src, imgIdx) => (
                        <TurnAttachedImageItem
                          key={`${currentTurn.id}_att_${imgIdx}`}
                          source={src}
                          index={imgIdx}
                          total={currentTurnAttachedImages.length}
                          pageNumber={safePage + 1}
                          keyHint={
                            imgIdx === 0
                              ? currentAttachKey
                              : `${currentAttachKey}:${imgIdx}`
                          }
                          caption={currentTurn.imageCaption}
                          onDownload={onDownloadImage}
                          onOpenLightbox={(url, label) =>
                            setLightboxImage({
                              src: url,
                              label,
                            })
                          }
                        />
                      ))}
                    </div>
                    {currentTurn.imageCaption && (
                      <div className="text-xs text-slate-400">
                        Chú thích: {currentTurn.imageCaption}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (currentTurn.attachedImageClearedCount || 0) > 0 ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-[11.5px] text-slate-400 ring-1 ring-inset ring-white/[0.07]">
                <ImageOff className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>
                  Đã giải phóng {currentTurn.attachedImageClearedCount} ảnh đính kèm sau khi phản hồi (nhẹ máy)
                </span>
                {currentTurn.imageCaption && (
                  <span className="text-slate-300">
                    · Chú thích: {currentTurn.imageCaption}
                  </span>
                )}
              </div>
            ) : null}

            {editingUserIdx === safePage ? (
              <textarea
                value={editingUserDraft}
                onChange={(e) => setEditingUserDraft(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-sky-400/50 bg-[#0e1625]/90 p-3 text-sm leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            ) : (
              <ProseRenderer
                text={currentTurn.user || ''}
                highlightQuery={trimmedQuery}
                knownCharacterKeys={knownCharacterKeys}
                mcNameKey={mcNameKey}
                onCharacterClick={setQuickCharacterName}
              />
            )}
          </article>

          {/* AI Response Box */}
          <article
            ref={aiArticleRef}
            className="rounded-2xl bg-[#182336]/95 p-4 sm:p-6 ring-1 ring-sky-400/[0.16] shadow-[0_16px_38px_-18px_rgba(2,8,23,0.75)]"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                <span className="font-semibold text-sky-300">Lượt trả lời</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Trang {safePage + 1}</span>
                {currentTurn.storyClockSnapshot && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-200/90 tabular-nums">
                      {currentTurn.storyClockSnapshot}
                    </span>
                  </>
                )}
              </div>
              {!zenMode && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={isAutoStoryImageOn}
                    onClick={handleToggleQuickAutoStoryImage}
                    title={
                      isAutoStoryImageOn
                        ? 'Đang bật tự động sinh ảnh theo lượt — bấm để đọc thuần chữ'
                        : 'Đang đọc thuần chữ — bấm để bật lại tự động sinh ảnh'
                    }
                    className={`inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold ring-1 ring-inset transition-colors active:scale-[0.98] whitespace-nowrap ${
                      isAutoStoryImageOn
                        ? 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/28 hover:bg-emerald-500/22'
                        : 'bg-white/[0.05] text-slate-300 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                    }`}
                  >
                    {isAutoStoryImageOn ? (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ImageOff className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{isAutoStoryImageOn ? 'Tự vẽ' : 'Thuần chữ'}</span>
                  </button>
                  {(storyImageConfig.enabled || hasSeedreamConfigured) && (
                    <button
                      type="button"
                      disabled={isGeneratingImage || isStreamingCurrentPage}
                      onClick={() => {
                        if (isGeneratingImage || storyImgLockRef.current) return;
                        storyImgLockRef.current = true;
                        window.setTimeout(() => {
                          storyImgLockRef.current = false;
                        }, 350);
                        if (!storyImageConfig.enabled) {
                          onUpdateStoryImageConfig({ enabled: true });
                        }
                        onGenerateStoryImage(safePage);
                      }}
                      className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg bg-sky-500/14 px-2.5 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/28 transition-colors hover:bg-sky-500/22 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
                    >
                      {isGeneratingCurrentPageImage ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>
                        {isGeneratingCurrentPageImage
                          ? generatingImageProgress &&
                            generatingImageProgress.total > 1
                            ? `Đang vẽ (${generatingImageProgress.currentIndex}/${generatingImageProgress.total})...`
                            : 'Đang vẽ...'
                          : hasAnyCurrentTurnStoryImage
                            ? 'Vẽ lại'
                            : configuredBeatCount > 1
                              ? `Sinh ${configuredBeatCount} ảnh`
                              : 'Minh họa lượt truyện'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isStreamingCurrentPage}
                    onClick={() => {
                      if (editingAiIdx === safePage) {
                        onUpdateTurn(safePage, { assistant: editingAiDraft });
                        setEditingAiIdx(null);
                      } else {
                        setEditingAiDraft(currentTurn.assistant || '');
                        setEditingAiIdx(safePage);
                      }
                    }}
                    className="inline-flex min-h-[34px] items-center justify-center rounded-lg bg-white/[0.055] px-2.5 sm:px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
                  >
                    {editingAiIdx === safePage ? 'Lưu' : 'Sửa'}
                  </button>
                </div>
              )}
            </div>

            {/* Non-blocking Sequential Beat Image Progress Strip */}
            {isGeneratingCurrentPageImage && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-500/10 px-3.5 py-2.5 ring-1 ring-inset ring-sky-400/25">
                <div className="flex min-w-0 items-center gap-2.5 text-xs text-sky-100">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
                  <span className="truncate">
                    {generatingImageProgress
                      ? `Đang vẽ tuần tự (${generatingImageProgress.currentIndex}/${generatingImageProgress.total}) · ${
                          STORY_IMAGE_POSITION_META[
                            generatingImageProgress.currentPosition
                          ].label
                        }...`
                      : `Đang sinh ảnh minh họa (${activeTargetSummary})...`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCancelStoryImage}
                  className="min-h-[28px] shrink-0 rounded-lg bg-rose-500/16 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/25"
                >
                  Hủy
                </button>
              </div>
            )}

            {editingAiIdx === safePage ? (
              <textarea
                value={editingAiDraft}
                onChange={(e) => setEditingAiDraft(e.target.value)}
                rows={9}
                className="w-full rounded-xl border border-sky-400/50 bg-[#0e1625]/90 p-3 text-sm leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            ) : (
              <>
                {/* Preset / Thinking / Draft Stage Panel */}
                {!showRawTags && parsedAi.draftText && (
                  <div
                    className={`mb-4 overflow-hidden rounded-xl ring-1 ring-inset transition-colors ${
                      isStreamingCurrentPage && parsedAi.inDraftPhase
                        ? 'bg-sky-500/[0.08] ring-sky-400/28'
                        : 'bg-[#111a2b]/85 ring-white/[0.07]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDraftOpenOverride(!isDraftExpanded)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-xs">
                        <Cpu
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isStreamingCurrentPage && parsedAi.inDraftPhase
                              ? 'text-sky-300'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate font-semibold text-slate-200">
                          {isStreamingCurrentPage && parsedAi.inDraftPhase
                            ? parsedAi.currentStepLabel ||
                              'Đang xử lý preset & dàn ý...'
                            : parsedAi.steps.length > 1
                              ? `Đã xử lý ${parsedAi.steps.length} bước preset / suy nghĩ`
                              : 'Khối suy nghĩ / preset đã thu gọn'}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-400">
                        <span>{isDraftExpanded ? 'Thu gọn' : 'Xem nháp'}</span>
                        {isDraftExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </button>

                    {isDraftExpanded && (
                      <div className="space-y-2 border-t border-white/[0.07] px-3.5 py-3">
                        {parsedAi.steps.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {parsedAi.steps.map((step, sIdx) => {
                              const isActiveStep =
                                isStreamingCurrentPage &&
                                parsedAi.inDraftPhase &&
                                sIdx === parsedAi.steps.length - 1;
                              return (
                                <span
                                  key={`${step.label}-${sIdx}`}
                                  className={`inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] ring-1 ring-inset ${
                                    isActiveStep
                                      ? 'bg-sky-500/16 font-semibold text-sky-200 ring-sky-400/32'
                                      : 'bg-white/[0.045] text-slate-300 ring-white/[0.07]'
                                  }`}
                                >
                                  {isActiveStep ? (
                                    <ChevronRight className="h-2.5 w-2.5 shrink-0 text-sky-300" />
                                  ) : (
                                    <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
                                  )}
                                  <span className="truncate">{step.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div
                          ref={draftPreviewRef}
                          className={`max-h-40 overflow-y-auto rounded-xl bg-[#0c1322] p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-slate-400 ring-1 ring-inset ring-white/[0.05] transition-opacity duration-700 ease-out ${
                            isStreamingCurrentPage && parsedAi.inDraftPhase
                              ? 'stream-text-breathing'
                              : 'opacity-100'
                          }`}
                        >
                          {parsedAi.draftText}
                          {isStreamingCurrentPage && parsedAi.inDraftPhase && (
                            <span
                              aria-hidden="true"
                              className="stream-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-sky-400 align-baseline"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Calm static status strip when Raw Tags are shown during streaming draft phase */}
                {showRawTags &&
                  isStreamingCurrentPage &&
                  parsedAi.inDraftPhase &&
                  parsedAi.currentStepLabel && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-200 ring-1 ring-inset ring-sky-400/25">
                      <Cpu className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                      <span className="truncate">
                        Đang xử lý: {parsedAi.currentStepLabel}
                      </span>
                    </div>
                  )}

                {/* Main Story Narrative */}
                {!showRawTags &&
                isStreamingCurrentPage &&
                !parsedAi.hasMainStory ? (
                  !parsedAi.draftText && (
                    <p className="stream-text-breathing py-1 text-sm text-slate-400">
                      Đang khởi tạo lượt truyện
                      <span
                        aria-hidden="true"
                        className="stream-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-sky-400 align-baseline"
                      />
                    </p>
                  )
                ) : (
                  <ProseRenderer
                    text={parsedAi.mainText}
                    highlightQuery={trimmedQuery}
                    isStreaming={
                      isStreamingCurrentPage &&
                      (showRawTags || parsedAi.hasMainStory)
                    }
                    knownCharacterKeys={knownCharacterKeys}
                    mcNameKey={mcNameKey}
                    onCharacterClick={setQuickCharacterName}
                    emptyPlaceholder={
                      isStreamingCurrentPage
                        ? 'Đang nhận nội dung'
                        : '(Chưa có nội dung)'
                    }
                    {...(() => {
                      const renderBeatSlot = (pos: StoryImagePosition) => {
                        const item = currentTurnBeatMap[pos];
                        if (!item) return undefined;
                        return (
                          <StoryBeatImageCard
                            key={`${currentTurn.id}_${pos}`}
                            item={item}
                            turnId={currentTurn.id}
                            pageIndex={safePage}
                            storyImageEnabled={storyImageConfig.enabled}
                            isAnyGenerating={isGeneratingImage}
                            isVerifyingReference={
                              verifyingStoryBeatKey ===
                              `${currentTurn.id}_${pos}`
                            }
                            onRegenerate={(p) =>
                              onGenerateStoryImage(safePage, p)
                            }
                            onVerifyReference={
                              onVerifyStoryBeatImage
                                ? (p) => onVerifyStoryBeatImage(safePage, p)
                                : undefined
                            }
                            onToggleApplyComparison={
                              onToggleStoryBeatApplyComparison
                                ? (p, enabled) =>
                                    onToggleStoryBeatApplyComparison(
                                      safePage,
                                      p,
                                      enabled,
                                    )
                                : undefined
                            }
                            onClear={(p) => onClearTurnStoryImage(safePage, p)}
                            onCancel={onCancelStoryImage}
                            onDownload={onDownloadImage}
                            onOpenLightbox={(src, label) =>
                              setLightboxImage({ src, label })
                            }
                          />
                        );
                      };
                      return {
                        openingSlot: renderBeatSlot('opening'),
                        middleSlot: renderBeatSlot('middle'),
                        endingSlot: renderBeatSlot('ending'),
                      };
                    })()}
                  />
                )}

                {showPostMeta && parsedAi.metaText && (
                  <div className="mt-4 rounded-xl border border-dashed border-white/[0.12] bg-[#101828]/80 p-3 font-mono text-xs whitespace-pre-wrap text-slate-400">
                    {parsedAi.metaText}
                  </div>
                )}
              </>
            )}
          </article>
        </div>
      )}

      {/* Bottom Pagination Bar (One-Handed Thumb Zone, directly above New Turn Composer) */}
      <nav
        aria-label="Điều hướng trang truyện"
        data-pagination-nav="true"
        className="rounded-2xl bg-[#162032]/88 p-2.5 sm:p-3 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md"
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={safePage <= 0}
            aria-label="Trang trước"
            className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-35 whitespace-nowrap sm:justify-self-start sm:px-3.5"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">Trước</span>
            <span className="hidden sm:inline">Trang trước</span>
          </button>

          <span className="px-1.5 text-center text-xs font-semibold text-slate-200 tabular-nums whitespace-nowrap">
            <span className="sm:hidden">
              Tr. {safePage + 1}/{totalPages}
            </span>
            <span className="hidden sm:inline">
              Trang {safePage + 1} / {totalPages}
            </span>
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={safePage >= turns.length - 1}
            aria-label="Trang sau"
            className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-35 whitespace-nowrap sm:justify-self-end sm:px-3.5"
          >
            <span className="sm:hidden">Sau</span>
            <span className="hidden sm:inline">Trang sau</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </nav>

      {/* New Turn Composer (completely hidden in Zen Mode / Đọc tập trung) */}
      {!zenMode && (
      <div className="space-y-3 rounded-[22px] bg-[#152033]/94 p-3.5 sm:p-4.5 ring-1 ring-white/[0.10] shadow-[0_18px_42px_-18px_rgba(2,8,23,0.82)]">
        {/* Composer Header Row */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <label
              htmlFor="newTurnInput"
              className="text-[13px] font-semibold tracking-tight text-slate-100"
            >
              Lượt gọi mới
            </label>
            {turns.length > 0 && (
              <span className="truncate text-[11px] font-medium text-slate-400 tabular-nums">
                · Trang {safePage + 1}
              </span>
            )}
          </div>

          <button
            type="button"
            aria-expanded={suggestionsOpen}
            onClick={handleToggleSuggestions}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap ${
              suggestionsOpen
                ? 'bg-sky-500/18 text-sky-100 ring-sky-400/40 shadow-[0_4px_14px_-6px_rgba(56,189,248,0.45)]'
                : 'bg-white/[0.055] text-slate-200 ring-white/[0.09] hover:bg-white/[0.10] hover:text-white'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
            <span>Gợi ý</span>
            {suggestionsOpen && displayedSuggestions.length > 0 && (
              <span className="text-[11px] font-medium text-sky-200/90 tabular-nums">
                ({displayedSuggestions.length})
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${
                suggestionsOpen ? 'rotate-180 text-sky-300' : 'text-slate-400'
              }`}
            />
          </button>
        </div>

        {/* Instant Contextual Suggestions Drawer (with optional AI boost) */}
        {suggestionsOpen && (
          <div className="space-y-2.5 rounded-2xl bg-[#0e1727]/95 p-3 ring-1 ring-inset ring-sky-400/22">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-300/90" />
                {localSuggestionBundle.presentCharacters.length > 0 ? (
                  <>
                    <span className="shrink-0 font-medium text-slate-300">
                      Bám cảnh
                    </span>
                    {localSuggestionBundle.presentCharacters
                      .slice(0, 3)
                      .map((char) => {
                        const badgeCls =
                          char.tier === 'main'
                            ? 'bg-orange-500/16 text-orange-200 ring-orange-400/35'
                            : char.tier === 'mob'
                              ? 'bg-slate-500/18 text-slate-300 ring-slate-400/30'
                              : 'bg-sky-500/16 text-sky-200 ring-sky-400/35';
                        const dotCls =
                          char.tier === 'main'
                            ? 'bg-orange-400'
                            : char.tier === 'mob'
                              ? 'bg-slate-400'
                              : 'bg-sky-400';
                        return (
                          <span
                            key={char.name}
                            title={`${char.name} · ${char.tierLabel}${char.detailLabel ? ` (${char.detailLabel})` : ''}${char.pinned ? ' · Đang ghim' : ''}`}
                            className={`inline-flex max-w-[165px] items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${badgeCls}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}`}
                            />
                            <span className="truncate">{char.name}</span>
                            <span className="shrink-0 opacity-75">
                              · {char.tierLabel}
                            </span>
                          </span>
                        );
                      })}
                  </>
                ) : (
                  <span className="truncate font-medium text-slate-200">
                    {turns.length > 0
                      ? `Gợi ý nhanh theo Trang ${safePage + 1}`
                      : 'Gợi ý nhanh theo cảnh hiện tại'}
                  </span>
                )}
                {storyClockState.enabled && (
                  <span className="shrink-0 text-[10px] text-amber-200/80 tabular-nums">
                    · {formattedStoryClock.timeStr} ({formattedStoryClock.period})
                  </span>
                )}
                {(() => {
                  const sugSlot = resolveModelForTask(
                    appState.config,
                    'suggestions',
                  );
                  return (
                    <button
                      type="button"
                      onClick={() => onNavigate('config')}
                      title={`Slot AI Gợi ý đang dùng: ${sugSlot.model || 'Chưa chọn'} (${sugSlot.isCustomSlot ? 'Slot riêng' : 'Mặc định theo Model chính'}). Bấm để đổi slot model.`}
                      className={`inline-flex max-w-[180px] shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        sugSlot.isCustomSlot
                          ? 'bg-sky-500/16 text-sky-200 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24'
                          : 'bg-white/[0.05] text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:text-slate-200'
                      }`}
                    >
                      <Cpu className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">
                        {sugSlot.isCustomSlot
                          ? `Riêng: ${sugSlot.model}`
                          : `Mặc định: ${sugSlot.model || '—'}`}
                      </span>
                    </button>
                  );
                })()}
              </div>

              <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:items-center">
                <button
                  type="button"
                  title="Đổi nhanh 6 gợi ý ngay lập tức (không tốn API)"
                  onClick={() => {
                    setLocalSuggestionVariant((v) => v + 1);
                    if (
                      aiSuggestionMode === 'replace' &&
                      aiSuggestions.length > 0
                    ) {
                      setAiSuggestions([]);
                    }
                  }}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-white/[0.05] px-2 sm:px-2.5 text-[11px] font-medium text-slate-200 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
                >
                  <RefreshCw className="h-3 w-3 shrink-0" />
                  <span>Đổi nhanh</span>
                </button>

                <button
                  type="button"
                  title="Chọn chế độ khi bấm AI gợi ý: Nối thêm vào danh sách hoặc Thay thế danh sách"
                  onClick={() =>
                    setAiSuggestionMode((m) =>
                      m === 'append' ? 'replace' : 'append',
                    )
                  }
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-white/[0.05] px-2 sm:px-2.5 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
                >
                  {aiSuggestionMode === 'append' ? 'Nối thêm' : 'Thay thế'}
                </button>

                {isGeneratingSuggestions ? (
                  <button
                    type="button"
                    onClick={onCancelAiSuggestions}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-rose-500/15 px-2 sm:px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 transition-colors hover:bg-rose-500/24 active:scale-[0.98] whitespace-nowrap"
                  >
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                    <span>Đang tạo · Hủy</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleTriggerAiSuggestions()}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-sky-500/18 px-2 sm:px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/26 active:scale-[0.98] whitespace-nowrap"
                  >
                    <Sparkles className="h-3 w-3 shrink-0 text-sky-300" />
                    <span>AI gợi ý</span>
                  </button>
                )}
              </div>
            </div>

            {aiSuggestionError && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/[0.09] px-3 py-2 text-xs text-amber-100/95 ring-1 ring-inset ring-amber-400/25">
                <span className="min-w-0 flex-1 break-words leading-relaxed">
                  {aiSuggestionError}
                </span>
                {!hasProxyConfigured && (
                  <button
                    type="button"
                    onClick={() => onNavigate('config')}
                    className="min-h-[28px] shrink-0 rounded-lg bg-amber-500/20 px-2.5 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-300/30 transition-colors hover:bg-amber-500/30 whitespace-nowrap"
                  >
                    Cấu hình Proxy
                  </button>
                )}
              </div>
            )}

            <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
              {displayedSuggestions.map((item) => {
                const isPicked =
                  newTurnText.trim().length > 0 &&
                  newTurnText.trim() === item.text.trim();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestionCard(item.text)}
                    className={`group flex min-h-[44px] flex-col items-start gap-1.5 rounded-xl p-2.5 text-left ring-1 ring-inset transition-all active:scale-[0.99] ${
                      isPicked
                        ? 'bg-sky-500/18 ring-sky-400/45'
                        : 'bg-[#152136]/90 ring-white/[0.08] hover:bg-[#1a2942] hover:ring-sky-400/30'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          SUGGESTION_CATEGORY_STYLES[item.category]
                        }`}
                      >
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.source === 'ai' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-300">
                            <Sparkles className="h-2.5 w-2.5" />
                            <span>AI</span>
                          </span>
                        )}
                        {isPicked && (
                          <span className="text-[10px] font-semibold text-sky-300">
                            Đã chọn
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-200 group-hover:text-white">
                      {item.text}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Unified Input Well + Attached Image + Action Bar */}
        <div className="overflow-hidden rounded-2xl bg-[#0d1524]/92 ring-1 ring-inset ring-white/[0.10] transition-all focus-within:bg-[#0c1526] focus-within:ring-sky-400/50 focus-within:shadow-[0_0_0_3px_rgba(56,189,248,0.10)]">
          <textarea
            ref={newTurnInputRef}
            id="newTurnInput"
            value={newTurnText}
            onChange={(e) => setNewTurnText(e.target.value)}
            placeholder="Nhập hành động hoặc lời thoại..."
            rows={3}
            className="block min-h-[92px] max-h-[260px] w-full resize-y bg-transparent px-3.5 pt-3 pb-2.5 text-[15px] leading-relaxed text-slate-100 placeholder:text-slate-400/65 focus:outline-none sm:text-sm"
          />

          {pendingImages.length > 0 && (
            <div className="mx-2.5 mb-2.5 space-y-2 rounded-xl bg-[#142035]/90 p-2.5 ring-1 ring-inset ring-sky-400/25">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-semibold text-slate-200">
                    {pendingImages.length === 1
                      ? pendingImages[0].name
                      : `Ảnh chờ gửi (${pendingImages.length}/${MAX_PENDING_CHAT_IMAGES})`}
                  </span>
                  {pendingImages.length === 1 && (
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-sky-300/80">
                      1/{MAX_PENDING_CHAT_IMAGES}
                      {pendingImages[0].compressedBytes
                        ? ` · ${formatBytesCompact(pendingImages[0].compressedBytes)}`
                        : ''}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {onUpdateChatImageConfig && (
                    <button
                      type="button"
                      onClick={() => setShowChatImageOptions((v) => !v)}
                      aria-expanded={showChatImageOptions}
                      title="Tùy chọn giới hạn & nén/resize ảnh gửi"
                      className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                        showChatImageOptions
                          ? 'bg-sky-500/24 text-sky-100 ring-sky-400/45'
                          : 'bg-white/[0.06] text-slate-200 ring-white/[0.12] hover:bg-white/[0.12]'
                      }`}
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                      <span className="hidden xs:inline">Nén</span>
                    </button>
                  )}
                  {pendingImages.length < MAX_PENDING_CHAT_IMAGES && (
                    <button
                      type="button"
                      disabled={isPreparingChatImages}
                      onClick={onPickImage}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/14 px-2 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/28 transition-colors hover:bg-sky-500/24 disabled:opacity-50 whitespace-nowrap"
                    >
                      <ImagePlus className="h-3 w-3" />
                      <span>Thêm ảnh</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClearPendingImages}
                    aria-label="Xóa toàn bộ ảnh đính kèm"
                    className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-rose-500/14 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-colors hover:bg-rose-500/24 whitespace-nowrap"
                  >
                    <X className="h-3 w-3" />
                    <span>{pendingImages.length > 1 ? 'Xóa hết' : 'Bỏ ảnh'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {pendingImages.map((img, idx) => (
                  <div
                    key={img.id || `${img.name}_${idx}`}
                    className="group relative w-[76px] shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxImage({
                          src: img.dataUrl,
                          label: img.name || `Ảnh chờ gửi #${idx + 1}`,
                        })
                      }
                      title={
                        img.compressedBytes
                          ? `${img.name} (${formatBytesCompact(img.compressedBytes)}${img.width && img.height ? ` · ${img.width}×${img.height}` : ''})`
                          : img.name
                      }
                      className="block h-16 w-[76px] overflow-hidden rounded-lg bg-[#0b1322] ring-1 ring-white/[0.14] focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.name || `Ảnh đính kèm ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                      />
                    </button>
                    {(pendingImages.length > 1 || img.compressedBytes) && (
                      <span className="pointer-events-none absolute right-1 bottom-1 left-1 truncate rounded bg-[#090f1b]/82 px-1 py-0.5 text-center text-[9px] font-semibold tabular-nums text-slate-100 ring-1 ring-white/15">
                        {pendingImages.length > 1 ? `#${idx + 1}` : ''}
                        {pendingImages.length > 1 && img.compressedBytes ? ' · ' : ''}
                        {img.compressedBytes
                          ? formatBytesCompact(img.compressedBytes)
                          : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemovePendingImage(idx)}
                      aria-label={`Xóa ảnh ${img.name || idx + 1}`}
                      title="Xóa ảnh này"
                      className="absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm ring-2 ring-[#142035] transition-colors hover:bg-rose-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {onUpdateChatImageConfig && (
                <div className="space-y-2 rounded-lg bg-[#0e1729]/85 px-2.5 py-2 ring-1 ring-inset ring-white/[0.07]">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex min-w-0 cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-200">
                      <input
                        type="checkbox"
                        checked={chatImageAutoClearAfterReply}
                        onChange={(e) =>
                          onUpdateChatImageConfig({
                            chatImageAutoClearAfterReply: e.target.checked,
                          })
                        }
                        className="h-3.5 w-3.5 rounded border-slate-500 bg-[#0b1322] accent-sky-400"
                      />
                      <span className="truncate">
                        Tự xóa ảnh sau khi nhận phản hồi (nhẹ máy)
                      </span>
                    </label>
                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400">
                      ≤{chatImageMaxInputMb}MB ·{' '}
                      {chatImageMaxDimension > 0
                        ? `${chatImageMaxDimension}px`
                        : 'Gốc'}
                    </span>
                  </div>

                  {showChatImageOptions && (
                    <div className="grid grid-cols-1 gap-2 border-t border-white/[0.07] pt-2 sm:grid-cols-3">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-slate-400">
                          Giới hạn đầu vào
                        </span>
                        <select
                          value={chatImageMaxInputMb}
                          onChange={(e) =>
                            onUpdateChatImageConfig({
                              chatImageMaxInputMb: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-white/[0.10] bg-[#0b1322] px-2 py-1 text-[11px] text-slate-100 focus:border-sky-400/70 focus:outline-none"
                        >
                          {CHAT_IMAGE_MAX_INPUT_MB_OPTIONS.map((mb) => (
                            <option key={mb} value={mb}>
                              Tối đa {mb} MB
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-slate-400">
                          Resize tự động
                        </span>
                        <select
                          value={chatImageMaxDimension}
                          onChange={(e) =>
                            onUpdateChatImageConfig({
                              chatImageMaxDimension: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-white/[0.10] bg-[#0b1322] px-2 py-1 text-[11px] text-slate-100 focus:border-sky-400/70 focus:outline-none"
                        >
                          {CHAT_IMAGE_MAX_DIMENSION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-slate-400">
                          Chất lượng nén
                        </span>
                        <select
                          value={chatImageQuality}
                          onChange={(e) =>
                            onUpdateChatImageConfig({
                              chatImageQuality: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-white/[0.10] bg-[#0b1322] px-2 py-1 text-[11px] text-slate-100 focus:border-sky-400/70 focus:outline-none"
                        >
                          {CHAT_IMAGE_QUALITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <input
                id="imageCaptionInput"
                type="text"
                aria-label="Chú thích ảnh đính kèm"
                value={imageCaption}
                onChange={(e) => onImageCaptionChange(e.target.value)}
                placeholder={
                  pendingImages.length > 1
                    ? `Chú thích ngắn cho loạt ${pendingImages.length} ảnh để NPC chú ý (tùy chọn)...`
                    : 'Chú thích ngắn để NPC chú ý chi tiết ảnh (tùy chọn)...'
                }
                className="w-full rounded-lg border border-white/[0.10] bg-[#0c1423]/90 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-400/70 focus:border-sky-400/70 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          )}

          {/* Harmonized Action Cluster (Mobile-First One-Handed Touch Targets) */}
          <div className="flex items-center justify-between gap-1.5 border-t border-white/[0.08] bg-white/[0.02] px-2.5 py-2 sm:gap-2 sm:px-3 sm:py-2.5">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={isPreparingChatImages}
                onClick={onPickImage}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.10] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-60 whitespace-nowrap sm:px-3.5"
              >
                {isPreparingChatImages ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
                ) : (
                  <ImagePlus className="h-4 w-4 shrink-0 text-sky-300" />
                )}
                <span>
                  {isPreparingChatImages
                    ? 'Đang nén ảnh...'
                    : `Gửi ảnh${
                        pendingImages.length > 0
                          ? ` (${pendingImages.length}/${MAX_PENDING_CHAT_IMAGES})`
                          : ''
                      }`}
                </span>
              </button>
              <button
                type="button"
                disabled={isPreparingChatImages}
                onClick={() => setImagePickerTarget({ mode: 'composer' })}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.10] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-60 whitespace-nowrap sm:px-3.5"
              >
                <ImageIcon className="h-4 w-4 shrink-0 text-indigo-300" />
                <span>Chọn ảnh</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isGenerating || isPreparingChatImages}
              onClick={handleSubmit}
              className="inline-flex h-11 min-w-[84px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 px-4 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/20 shadow-[0_8px_20px_-6px_rgba(14,165,233,0.55)] transition-all hover:from-sky-300 hover:to-blue-500 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap sm:min-w-[108px] sm:px-5"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Send className="h-4 w-4 shrink-0" />
              )}
              <span>{isGenerating ? 'Đang tạo...' : 'Gửi'}</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {isStreamingCurrentPage && !isUtilityScreenOpen && showScrollToBottomBtn && (
        <div
          className={`fixed right-4 z-[85] ${
            hideBottomNav ? 'bottom-5' : 'bottom-20 sm:bottom-24'
          }`}
        >
          <button
            type="button"
            onClick={handleJumpToStreamBottom}
            aria-label="Cuộn xuống cuối để tiếp tục theo dõi đoạn đang stream"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#101a2d]/92 px-3 py-2 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/38 shadow-[0_12px_28px_-8px_rgba(2,8,23,0.85)] backdrop-blur-md transition-all hover:bg-[#162540] hover:text-white active:scale-[0.97]"
          >
            <ChevronDown className="h-4 w-4 shrink-0 text-sky-300" />
            <span>Xuống cuối</span>
          </button>
        </div>
      )}
        </>
      )}

      {/* Quick Character Profile & Portrait Modal (opened by tapping any blue CharacterNameBadge) */}
      {quickCharacterInfo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Hồ sơ nhanh của ${quickCharacterInfo.displayName}`}
          onClick={() => setQuickCharacterName(null)}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#090f1b]/74 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-3xl bg-[#172235]/96 ring-1 ring-blue-400/25 shadow-[0_24px_60px_-14px_rgba(2,6,23,0.85)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CharacterNameBadge
                  name={quickCharacterInfo.displayName}
                  variant="list"
                  isMc={quickCharacterInfo.isMc}
                />
                <span className="truncate text-xs text-slate-400">
                  {quickCharacterInfo.isMc ? 'NV chính' : 'NPC'} ·{' '}
                  {quickCharacterInfo.role}
                  {quickCharacterInfo.ageBirthLabel
                    ? ` · ${quickCharacterInfo.ageBirthLabel}`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                aria-label="Đóng hồ sơ nhanh"
                onClick={() => setQuickCharacterName(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70dvh] space-y-3 overflow-y-auto p-4">
              <div className="flex items-start gap-3">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#0e1625] ring-1 ring-white/[0.10]">
                  {quickCharacterInfo.portrait?.imageData ? (
                    <button
                      type="button"
                      onClick={() => {
                        const img = quickCharacterInfo.portrait?.imageData;
                        if (img) {
                          setLightboxImage({
                            src: img,
                            label: quickCharacterInfo.displayName,
                          });
                        }
                      }}
                      className="group relative block h-full w-full focus:outline-none"
                      aria-label={`Phóng to ảnh ${quickCharacterInfo.displayName}`}
                    >
                      <ResolvedAvatarImage
                        src={quickCharacterInfo.portrait.imageData}
                        alt={quickCharacterInfo.displayName}
                        keyHint={quickCharacterInfo.portrait.id}
                        className="h-full w-full object-cover"
                        compactError
                      />
                      <span className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-black/65 p-0.5 text-slate-100 backdrop-blur-sm">
                        <Maximize2 className="h-3 w-3" />
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                      <User className="h-5 w-5 text-blue-300/80" />
                      <span className="text-[10px] font-medium">Chưa có ảnh</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                  {quickCharacterInfo.stateSnap ? (
                    <div className="space-y-1 rounded-xl bg-[#101829]/85 p-2.5 text-[11px] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                      <div className="font-semibold text-blue-200">
                        Trạng thái hiện tại
                      </div>
                      {quickCharacterInfo.stateSnap.location && (
                        <div>
                          <span className="text-slate-400">Vị trí: </span>
                          {quickCharacterInfo.stateSnap.location}
                        </div>
                      )}
                      {quickCharacterInfo.stateSnap.mood && (
                        <div>
                          <span className="text-slate-400">Tâm trạng: </span>
                          {quickCharacterInfo.stateSnap.mood}
                        </div>
                      )}
                      {quickCharacterInfo.stateSnap.status && (
                        <div>
                          <span className="text-slate-400">Mới nhất: </span>
                          {quickCharacterInfo.stateSnap.status}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-slate-300">
                      {quickCharacterInfo.appearance ||
                        'Chưa có mô tả chi tiết cho nhân vật này trong thư viện.'}
                    </p>
                  )}
                </div>
              </div>

              {(quickCharacterInfo.ageBirthLabel ||
                quickCharacterInfo.fashionStyle ||
                quickCharacterInfo.personality ||
                (quickCharacterInfo.stateSnap && quickCharacterInfo.appearance) ||
                quickCharacterInfo.relationships ||
                quickCharacterInfo.signature) && (
                <div className="space-y-1.5 rounded-xl bg-[#101829]/85 p-3 text-xs leading-relaxed ring-1 ring-inset ring-white/[0.06]">
                  {quickCharacterInfo.ageBirthLabel && (
                    <div>
                      <span className="font-semibold text-cyan-300">
                        Tuổi tác &amp; ngày sinh:{' '}
                      </span>
                      <span className="tabular-nums text-slate-200">
                        {quickCharacterInfo.ageBirthLabel}
                      </span>
                    </div>
                  )}
                  {quickCharacterInfo.fashionStyle && (
                    <div>
                      <span className="font-semibold text-violet-300">
                        Style ăn mặc:{' '}
                      </span>
                      <span className="text-slate-200">
                        {quickCharacterInfo.fashionStyle}
                      </span>
                    </div>
                  )}
                  {quickCharacterInfo.personality && (
                    <div>
                      <span className="font-semibold text-sky-300">
                        Tính cách &amp; khí chất:{' '}
                      </span>
                      <span className="text-slate-200">
                        {quickCharacterInfo.personality}
                      </span>
                    </div>
                  )}
                  {quickCharacterInfo.stateSnap &&
                    quickCharacterInfo.appearance && (
                      <div>
                        <span className="font-semibold text-indigo-300">
                          Ngoại hình:{' '}
                        </span>
                        <span className="text-slate-200">
                          {quickCharacterInfo.appearance}
                        </span>
                      </div>
                    )}
                  {quickCharacterInfo.relationships && (
                    <div>
                      <span className="font-semibold text-emerald-300">
                        Quan hệ &amp; thái độ:{' '}
                      </span>
                      <span className="text-slate-200">
                        {quickCharacterInfo.relationships}
                      </span>
                    </div>
                  )}
                  {quickCharacterInfo.signature && (
                    <div>
                      <span className="font-semibold text-amber-300">
                        Điểm nhấn:{' '}
                      </span>
                      <span className="text-slate-200">
                        {quickCharacterInfo.signature}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {quickCharacterInfo.isMc && cultivationProfile && (
                <div
                  className={`space-y-2 rounded-xl p-3 text-xs leading-relaxed ring-1 ring-inset ${
                    cultivationRealmTheme
                      ? `${cultivationRealmTheme.cardClass} ${cultivationRealmTheme.shimmerClass}`
                      : 'bg-emerald-500/[0.07] ring-emerald-400/20'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                      <Swords
                        className={`h-3.5 w-3.5 shrink-0 ${
                          cultivationRealmTheme?.compactIconClass || 'text-emerald-300'
                        }`}
                      />
                      <span>
                        {CULTIVATION_SYSTEM_META[cultivationProfile.systemKind].label}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        cultivationRealmTheme?.compactTextClass || 'text-amber-200'
                      }`}
                    >
                      {cultivationDisplay?.fullLabel || cultivationProfile.realmName}{' '}
                      · {cultivationProfile.exp}/{cultivationProfile.maxExp}
                      {cultivationDisplay && cultivationDisplay.overflowExp > 0
                        ? ` (+${cultivationDisplay.overflowExp} dư)`
                        : ''}
                    </span>
                  </div>
                  {cultivationConstitution && (
                    <div className="rounded-lg bg-[#0a111f]/65 px-2.5 py-1.5 text-[11px] text-slate-200/95 ring-1 ring-inset ring-white/[0.07]">
                      {(() => {
                        const cLbl = getConstitutionLabels(
                          cultivationProfile.systemKind,
                        );
                        return (
                          <>
                            <span className="text-slate-400">{cLbl.rootTitle}: </span>
                            <span className="font-semibold text-cyan-200">
                              {cultivationConstitution.spiritRoot.name} ({cultivationConstitution.spiritRoot.purity}%)
                            </span>
                            <span className="text-slate-500"> · </span>
                            <span className="text-slate-400">{cLbl.physiqueTitle}: </span>
                            <span className="font-semibold text-amber-200">
                              {cultivationConstitution.physique.name}
                            </span>
                            <span className="text-slate-500"> · </span>
                            <span className="text-slate-400">{cLbl.foundationTitle}: </span>
                            <span className="font-semibold text-emerald-200">
                              {cultivationConstitution.foundation.solidity}%
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {cultivationProfile.techniques.length > 0 && (
                    <div className="space-y-1 text-[11px] text-slate-300">
                      {cultivationProfile.techniques.slice(0, 3).map((tech) => (
                        <div
                          key={tech.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate font-medium text-slate-100">
                            {tech.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-400">
                            {TECHNIQUE_TIER_META[tech.tier].label} · T{tech.level} ·{' '}
                            {tech.mastery}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-1.5 text-[11px] text-slate-400">
                    <span className="tabular-nums">
                      {cultivationProfile.bagName}:{' '}
                      {cultivationProfile.inventory.length} vật phẩm
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCharacterName(null);
                        setCultivationInitialTab('realm');
                        openUtilityScreen('cultivation');
                      }}
                      className="font-semibold text-emerald-300 hover:text-emerald-200"
                    >
                      Mở Hồ sơ &amp; Túi đồ →
                    </button>
                  </div>
                </div>
              )}

              {quickCharacterInfo.portrait &&
                generatingPortraitIds.includes(quickCharacterInfo.portrait.id) &&
                (() => {
                  const prog =
                    portraitProgress?.[quickCharacterInfo.portrait!.id];
                  return (
                    <div className="rounded-xl bg-sky-500/12 px-3 py-2 text-[11px] text-sky-100 ring-1 ring-inset ring-sky-400/25">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-sky-200">
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                          <span className="truncate">
                            {prog?.label || 'Đang tạo ảnh nhân vật...'}
                          </span>
                        </span>
                        {prog && (
                          <span className="shrink-0 text-[10px] font-medium tabular-nums text-sky-200/80">
                            {getImageProviderLabel(prog.provider)}{' '}
                            · Tối đa {prog.timeoutSec}s
                          </span>
                        )}
                      </div>
                      {prog && prog.maxAttempts > 1 && (
                        <div className="mt-1 text-[10px] text-sky-200/80">
                          Lần thử {prog.attempt}/{prog.maxAttempts} (tự động thử
                          lại nếu gặp timeout tạm thời).
                        </div>
                      )}
                    </div>
                  );
                })()}

              {quickCharacterInfo.portrait &&
                !generatingPortraitIds.includes(
                  quickCharacterInfo.portrait.id,
                ) &&
                portraitErrors?.[quickCharacterInfo.portrait.id] && (
                  <div className="rounded-xl bg-rose-500/12 px-3 py-2 text-[11px] leading-relaxed text-rose-100 ring-1 ring-inset ring-rose-400/25">
                    <div className="font-semibold text-rose-200">
                      Không tạo được ảnh nhân vật
                    </div>
                    <p className="mt-0.5 break-words text-rose-100/90">
                      {portraitErrors[quickCharacterInfo.portrait.id]}
                    </p>
                  </div>
                )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {quickCharacterInfo.isMc && cultivationProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCharacterName(null);
                      setCultivationInitialTab('realm');
                      openUtilityScreen('cultivation');
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/16 px-3.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24 whitespace-nowrap"
                  >
                    <Swords className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Tu luyện &amp; Túi đồ</span>
                  </button>
                )}
                {quickCharacterInfo.portrait && (
                  <button
                    type="button"
                    onClick={() => {
                      const pid = quickCharacterInfo.portrait?.id;
                      const pname = quickCharacterInfo.displayName;
                      setQuickCharacterName(null);
                      if (pid) {
                        setImagePickerTarget({
                          mode: 'character',
                          portraitId: pid,
                          portraitName: pname,
                        });
                      }
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/14 px-3.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/28 hover:bg-sky-500/22 whitespace-nowrap"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-sky-300" />
                    <span>Ảnh ngoài / Thư viện</span>
                  </button>
                )}
                {quickCharacterInfo.portrait &&
                  hasSeedreamConfigured &&
                  (generatingPortraitIds.includes(
                    quickCharacterInfo.portrait.id,
                  ) ? (
                    <div className="inline-flex items-center gap-1.5">
                      <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/18 px-3 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 whitespace-nowrap">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang vẽ...</span>
                      </span>
                      {onCancelPortrait && (
                        <button
                          type="button"
                          onClick={() => {
                            const pid = quickCharacterInfo.portrait?.id;
                            if (pid) onCancelPortrait(pid);
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-rose-500/16 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/24 whitespace-nowrap"
                        >
                          <Square className="h-3 w-3 fill-current" />
                          <span>Hủy</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const pid = quickCharacterInfo.portrait?.id;
                        if (pid) onGeneratePortrait(pid);
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500 whitespace-nowrap"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>
                        {portraitErrors?.[quickCharacterInfo.portrait.id]
                          ? 'Thử lại'
                          : quickCharacterInfo.portrait.imageData
                            ? 'Vẽ lại ảnh'
                            : 'Tạo ảnh NV'}
                      </span>
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => {
                    setQuickCharacterName(null);
                    openUtilityScreen('portraits');
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.11] whitespace-nowrap"
                >
                  <Users className="h-3.5 w-3.5 text-blue-300" />
                  <span>Mở Thư viện Ảnh NV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightweight On-Demand Image Picker Modal */}
      {imagePickerTarget && (
        <ImagePickerModal
          target={imagePickerTarget}
          portraits={portraitBank?.portraits || []}
          turns={turns}
          currentPage={safePage}
          pendingImage={pendingImages[0] || null}
          pendingImages={pendingImages}
          onClose={() => setImagePickerTarget(null)}
          onAttachToComposer={onSelectPendingImage}
          onAssignToCurrentTurn={(src, subjectLabel) => {
            if (safePage >= 0 && safePage < turns.length) {
              const targetT = turns[safePage];
              if (currentStoryKey) {
                revokeMediaKey(currentStoryKey);
                revokeMediaKey(`inline:${currentStoryKey}`);
              }
              if (targetT) {
                const openKey = buildTurnMediaKey(
                  'story',
                  targetT,
                  safePage,
                  'opening',
                );
                revokeMediaKey(openKey);
                revokeMediaKey(`inline:${openKey}`);
              }
              const existingBeats = getTurnStoryImages(targetT).filter(
                (b) => b.position !== 'opening',
              );
              const assignedOpening: StoryImageItem = {
                id: `${targetT?.id || safePage}_opening`,
                position: 'opening',
                imageData: src,
                prompt: '',
                subject: subjectLabel || STORY_IMAGE_POSITION_META.opening.label,
                status: 'done',
              };
              const nextBeats = STORY_IMAGE_POSITIONS.map((pos) =>
                pos === 'opening'
                  ? assignedOpening
                  : existingBeats.find((b) => b.position === pos),
              ).filter((x): x is StoryImageItem => Boolean(x));
              onUpdateTurn(safePage, {
                storyImageData: src,
                storyImageSubject: subjectLabel,
                storyImages: nextBeats,
              });
              onNotify?.(`Đã gán ảnh "${subjectLabel}" cho Trang ${safePage + 1}.`);
            }
          }}
          onAssignToCharacter={(portraitId, src) => {
            const targetChar = (portraitBank?.portraits || []).find(
              (p) => p.id === portraitId,
            );
            onUpdatePortraitBank((prev) => ({
              ...prev,
              portraits: (prev.portraits || []).map((p) =>
                p.id === portraitId
                  ? {
                      ...p,
                      imageData: src,
                      autoGenerated: false,
                      avatarLockSourceSig: undefined,
                      updatedAt: Date.now(),
                    }
                  : p,
              ),
            }));
            onNotify?.(
              `Đã gán ảnh chân dung cho ${targetChar?.name || 'nhân vật'}.`,
            );
          }}
          onPickFromDevice={onPickImage}
        />
      )}

      {/* Fullscreen Image Lightbox (portaled to document.body so ancestor transforms/blur never clip it) */}
      {lightboxImage &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh minh họa toàn màn hình"
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#050a14]/92 p-2 backdrop-blur-md sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#162032]/98 ring-1 ring-white/[0.12] shadow-[0_24px_60px_-14px_rgba(2,6,23,0.92)] sm:rounded-3xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-3.5 py-2.5 sm:px-4 sm:py-3">
                <span className="truncate text-xs font-semibold text-slate-100 sm:text-sm">
                  {lightboxImage.label}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLightboxZoomed((v) => !v)}
                    title={
                      lightboxZoomed ? 'Thu về vừa khung' : 'Phóng lớn thêm'
                    }
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-white/[0.06] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.10] transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    {lightboxZoomed ? (
                      <ZoomOut className="h-3.5 w-3.5 text-sky-300" />
                    ) : (
                      <ZoomIn className="h-3.5 w-3.5 text-sky-300" />
                    )}
                    <span className="hidden sm:inline">
                      {lightboxZoomed ? 'Vừa khung' : 'Phóng lớn'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onDownloadImage(
                        lightboxImage.src,
                        `minh_hoa_trang_${safePage + 1}.png`,
                      )
                    }
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-sky-500/16 px-2.5 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24 sm:px-3"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tải ảnh</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Đóng"
                    onClick={() => setLightboxImage(null)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.10] hover:bg-white/[0.12]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 overflow-auto overscroll-contain bg-[#080e1a] p-2 sm:p-4">
                <img
                  src={lightboxImage.src}
                  alt={lightboxImage.label}
                  referrerPolicy="no-referrer"
                  onClick={() => setLightboxZoomed((v) => !v)}
                  className={`m-auto block shrink-0 rounded-xl object-contain shadow-[0_16px_44px_-12px_rgba(0,0,0,0.85)] transition-all duration-200 select-auto [-webkit-touch-callout:default] ${
                    lightboxZoomed
                      ? 'h-auto max-h-none w-[160%] max-w-none cursor-zoom-out sm:w-[135%]'
                      : 'h-auto w-auto max-h-[82dvh] max-w-full cursor-zoom-in sm:max-h-[85dvh]'
                  }`}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
