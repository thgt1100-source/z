import JSZip from 'jszip';
import {
  getTurnAttachedImages,
  getTurnStoryImages,
  resolveEnabledStoryImagePositions,
  STORY_IMAGE_POSITION_META,
  type AiTaskSlotId,
  type AppConfig,
  type ArkState,
  type CharacterIdentityLock,
  type CharacterPortrait,
  type CharacterStateSnapshot,
  type ComfyUiNodeMapping,
  type CompanionNpc,
  type CompanionProfile,
  type CultivationRankingBoard,
  type CultivationRankingEntry,
  type CustomImageFormatMode,
  type DramaLevel,
  type ImageProvider,
  type MemoryEntry,
  type MemoryEntryCategory,
  type PortraitGenProgress,
  type ProdigyTier,
  type ReferenceComparisonResult,
  type StoryImageBeatPrompts,
  type StoryImageConfig,
  type StoryImagePosition,
  type Turn,
  type WorldGenreId,
  type WorldSetupNpcDraft,
} from '../types/ark';
import {
  clampChatImageMaxDimension,
  clampChatImageQuality,
  formatBytesCompact,
  normalizeChatImageForVisionApi,
} from './chatImageUpload';
import {
  analyzeCharacterDirectPresence,
  areIdentityKeysShadowMatch,
  buildAllowedRosterKeys,
  buildCultivationNonNpcKeys,
  cleanAndDeduplicateCharacterStates,
  collectCharacterIdentityKeys,
  computeAgeFromBirthday,
  evaluateCharacterSceneEngagement,
  extractInlineAliasPairsFromText,
  extractSoloPoseAndExpression,
  extractSpeakerPrefixFromLine,
  extractTeasingNicknamePairsFromText,
  findCanonicalVariantMatch,
  findExactProperNameInText,
  findKnownCelebritiesInText,
  hasPersonSurnameStart,
  INTERACT_WITH_PERSON_BEFORE_RE,
  isCharacterExplicitlyAbsent,
  isChatOrNonPersonDescription,
  isContextSnippetRelevantToCharacter,
  isEnglishHeadingOrMetaPhrase,
  isEnglishTitleCaseHeadingLine,
  isExplicitCharacterDesignation,
  isGenericUnnamedFillerNpcName,
  isInvalidNpcPortrait,
  isInvalidNpcState,
  isMcPresentInTurn,
  isNonPersonCultivationOrWorldTerm,
  isPlayfulTeasingOrParodyName,
  isPortraitAutoScannedUnconfirmed,
  isShortCodeOrBracketedJunkName,
  isSoloPoseExpressionSnippet,
  isTeasingOrSpellingVariantOf,
  lookupKnownCelebrityProfile,
  matchPortraitByName,
  NON_ACTOR_PRE_CONTEXT_RE,
  normalizeCharacterKey,
  resolveEffectiveCharacterAge,
  resolveLocalVividNpcProfile,
  resolvePortraitRoleTier,
  resolveSceneCharacterRoles,
  sanitizeCharacterName,
  sanitizeLegacyContextSnippetForPortrait,
  sanitizeNpcFieldText,
  stripNonSceneChatBlocks,
  stripQuotedMediaAndDialogue,
  SUBJECT_ACTIVE_VERB_AFTER_RE,
} from './characterUtils';
import {
  extractStoryImageBeatPrompts,
  isEnglishThinkingBlock,
  isEnglishThinkingHeadingLine,
  repairTruncatedJson,
  sanitizeCompletedStoryResponse,
  splitNarrativeAndMeta,
} from './saveParser';
import {
  CHARACTER_MOTIVATION_MODULE,
  CHARACTER_MOTIVATION_MODULE_ID,
  DEFAULT_LATENT_ENDPOINT,
  DEFAULT_LATENT_KEYS_URL,
  DEFAULT_LATENT_MODEL,
  DEFAULT_LATENT_NATIVE_ENDPOINT,
  DEFAULT_LATENT_NEGATIVE_PROMPT,
  DEFAULT_LATENT_NOISE_SCHEDULE,
  DEFAULT_LATENT_POSITIVE_PREFIX,
  DEFAULT_LATENT_SAMPLER,
  DEFAULT_LATENT_SCALE,
  DEFAULT_LATENT_SIZE,
  DEFAULT_LATENT_STEPS,
  DEFAULT_SAFETY,
  getStoryBoundCompanionFromState,
  INFORMATION_BOUNDARY_MODULE,
  INFORMATION_BOUNDARY_MODULE_ID,
  MIND_PRESENTATION_MODULE,
  MIND_PRESENTATION_MODULE_ID,
  MODERN_DIALOGUE_STYLE_MODULE,
  MODERN_DIALOGUE_STYLE_MODULE_ID,
  PARALLEL_WORLD_MODULE,
  PARALLEL_WORLD_MODULE_ID,
  REALISTIC_CONSEQUENCES_MODULE,
  REALISTIC_CONSEQUENCES_MODULE_ID,
  VARIED_PORTRAIT_MODULE,
  VARIED_PORTRAIT_MODULE_ID,
  WAVE_COMMITMENT_MODULE,
  WAVE_COMMITMENT_MODULE_ID,
  WAVE_LICENSE_MODULE,
  WAVE_LICENSE_MODULE_ID,
  WORLD_NARRATOR_PRINCIPLES_MODULE,
  WORLD_NARRATOR_PRINCIPLES_MODULE_ID,
  WUXIA_XIANXIA_3D_DONGHUA_FEMALE_REFINEMENT_TAGS,
  WUXIA_XIANXIA_3D_DONGHUA_MALE_REFINEMENT_TAGS,
  WUXIA_XIANXIA_3D_DONGHUA_SEEDREAM_CUES,
  WUXIA_XIANXIA_3D_DONGHUA_SEEDREAM_FEMALE_CUES,
  WUXIA_XIANXIA_3D_DONGHUA_SEEDREAM_MALE_CUES,
  WUXIA_XIANXIA_3D_DONGHUA_STYLE_BLOCK,
} from './storage';
import {
  formatDeltaMinutesVi,
  formatStoryClock,
  normalizeStoryClock,
} from './storyClock';
import {
  CULTIVATION_CHARACTER_NAMING_GUIDELINE,
  CULTIVATION_RANKING_BOARD_META,
  CULTIVATION_RANKING_BOARD_ORDER,
  CULTIVATION_SYSTEM_META,
  enforceTopTenPerBoard,
  formatCultivationContextBlock,
  getCultivationDisplayInfo,
  MAX_RANKING_ENTRIES_PER_BOARD,
  WUXIA_NPC_RARITY_RANKING_RULE,
} from './cultivation';
import {
  buildLongTermMemoryContextBlock,
  detectMentionedEntities,
  extractMemoryKeywords,
  sanitizeEntityList,
} from './longTermMemory';
import { isLegacyPoisonedImagePromptTemplate } from './embeddedPresets';
import {
  appendNoTextVisualConstraint,
  appendPortraitNoTextConstraint,
  applyImageStyleVariables,
  buildHeadcountNegativeDirective,
  compressSampleImageForStorage,
  containsVietnameseText,
  DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE,
  getAllImageStyles,
  HAS_ANY_IMAGE_TEMPLATE_VAR_RE,
  IMAGE_CAMERA_ANGLES,
  IMAGE_GENERATION_MODE_LABELS,
  IMAGE_GRID_MODE_LABELS,
  IMAGE_PROMPT_TEMPLATE_VARIABLES,
  IMAGE_STYLE_VARIABLES,
  interpolateImagePromptTemplate,
  mergeStoryImageNegativePrompt,
  normalizeStoryImageStyleId,
  resolveCameraAngle,
  resolveSceneLightingCue,
  resolveStoryImageStyle,
  sanitizeVisualPromptFragment,
  STORY_IMAGE_CLEAR_FACE_NEGATIVE_DIRECTIVE,
  STORY_IMAGE_CLEAR_FACE_POSITIVE_DIRECTIVE,
  STORY_IMAGE_STYLES,
} from './imageStyles';
import {
  buildDistinctCharacterGroupEn,
  buildSafeCompactPortraitPrompt,
  buildStructuredCharacterIdentityEn,
  composeCohesiveEnglishImagePrompt,
  distillVisualAuraFromProfileTextEn,
  extractExplicitHairProfileEn,
  extractTattooAndBodyMarkingsEn,
  IMAGE_GENERATION_MODE_EN,
  IMAGE_GRID_MODE_EN,
  reconcilePortraitContradictionsEn,
  resolveEnglishStyleTokens,
  resolvePortraitStyleGuideEn,
  sanitizeImagePromptForApiSafety,
  stripConflictingHairColorsFromText,
  stripOverAgingWordsFromText,
  stripResidualVietnameseFromEnglishClause,
  stripUnauthorizedBodyMarksAndCultureDriftEn,
  translateVietnameseVisualToEnglish,
} from './imagePromptComposer';
import {
  extractMediaKey,
  getMediaBlob,
  isMediaRef,
} from './mediaMemoryManager';

export const AI_TASK_SLOT_ORDER: AiTaskSlotId[] = [
  'suggestions',
  'referenceCheck',
  'fanfic',
  'utility',
  'showbizPhone',
];

export const AI_TASK_SLOT_META: Record<
  AiTaskSlotId,
  {
    label: string;
    shortLabel: string;
    description: string;
    placeholder: string;
  }
> = {
  suggestions: {
    label: 'Slot Model — Gợi ý lượt đi (AI gợi ý)',
    shortLabel: 'Gợi ý',
    description:
      'Dùng riêng cho nút "AI gợi ý" trong khung chat. Nên chọn model nhanh/nhẹ (VD: gemini-3.5-flash-lite, gemini-3.8...) để tiết kiệm quota luồng chính.',
    placeholder: 'VD: gemini-3.5-flash-lite, gemini-3.8...',
  },
  referenceCheck: {
    label: 'Slot Model — Đối chiếu Ảnh mẫu (Vision)',
    shortLabel: 'Đối chiếu',
    description:
      'Dùng cho đối chiếu Ảnh mẫu người thật với ảnh vẽ (gửi 2 ảnh thật qua API), trích khóa nhận diện & kiểm tra prompt trước khi vẽ. Cần model hỗ trợ Vision.',
    placeholder: 'VD: gemini-3.8, pg-gemini-3.8-flash, gpt-4o...',
  },
  fanfic: {
    label: 'Slot Model — AI Đồng nhân (Fanfic)',
    shortLabel: 'Đồng nhân',
    description:
      'Dùng cho Phân tích tác phẩm gốc, Dựng Hành trình Anime Nhanh và Tra cứu chuyên sâu trong tab Đồng nhân.',
    placeholder: 'VD: gemini-3.8, gemini-3.5-flash-lite...',
  },
  utility: {
    label: 'Slot Model — Tác vụ phụ (Trí nhớ / NPC / Dựng TG)',
    shortLabel: 'Tác vụ phụ',
    description:
      'Dùng cho Trích xuất trí nhớ/trạng thái, Tóm tắt cuộn, Làm sinh động hồ sơ NPC và AI Dựng thế giới.',
    placeholder: 'VD: gemini-3.5-flash-lite, pg-gemini-3.8-flash...',
  },
  showbizPhone: {
    label: 'Slot Model — Điện thoại Showbiz (DM / Nhóm / MXH)',
    shortLabel: 'Điện thoại',
    description:
      'Dùng riêng cho nhắn tin DM, chat nhóm hậu trường và phản ứng MXH trong Điện thoại Showbiz. Tách biệt hoàn toàn khỏi model/ngữ cảnh màn Truyện chính.',
    placeholder: 'VD: gemini-2.5-flash, gemini-3.5-flash-lite, gpt-4o-mini...',
  },
};

export const DEFAULT_PROXY_MODEL = 'gemini-2.5-flash';

export function detectIsGeminiProtocol(
  config?: Partial<AppConfig> | null,
): boolean {
  const proto = config?.apiProtocol || 'openai';
  const url = (config?.proxyUrl || '').trim();
  if (proto === 'gemini') return true;
  if (proto === 'openai') return false;
  if (/\/openai(\/|$)/i.test(url)) return false;
  return (
    /generativelanguage\.googleapis\.com/i.test(url) ||
    /:(generateContent|streamGenerateContent)/i.test(url)
  );
}

export function resolveModelForTask(
  config: Partial<AppConfig> | null | undefined,
  slot?: AiTaskSlotId,
): {
  model: string;
  isCustomSlot: boolean;
  slot?: AiTaskSlotId;
  mainModel: string;
} {
  const mainModel = (config?.model || '').trim() || DEFAULT_PROXY_MODEL;
  if (!slot) {
    return { model: mainModel, isCustomSlot: false, mainModel };
  }
  if (slot === 'showbizPhone') {
    const dedicated = (config?.showbizPhoneConfig?.model || '').trim();
    if (dedicated) {
      return { model: dedicated, isCustomSlot: true, slot, mainModel };
    }
  }
  const custom = (config?.taskModels?.[slot] || '').trim();
  if (custom) {
    return { model: custom, isCustomSlot: true, slot, mainModel };
  }
  return { model: mainModel, isCustomSlot: false, slot, mainModel };
}

export async function ensureVisionInlineDataUrl(
  rawImage: string | undefined | null,
  signal?: AbortSignal,
): Promise<{
  ok: boolean;
  dataUrl?: string;
  remoteFallbackUrl?: string;
  error?: string;
}> {
  const src = String(rawImage || '').trim();
  if (!src) {
    return { ok: false, error: 'Thiếu dữ liệu ảnh đầu vào.' };
  }
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(src)) {
    return { ok: true, dataUrl: src };
  }
  if (isMediaRef(src)) {
    try {
      const key = extractMediaKey(src);
      const blob = key ? await getMediaBlob(key) : null;
      if (!blob) {
        return {
          ok: false,
          error: 'Không tìm thấy tệp ảnh trong bộ nhớ cục bộ (IndexedDB).',
        };
      }
      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return { ok: false, error: 'Không thể giải mã ảnh từ bộ nhớ cục bộ.' };
      }
      return { ok: true, dataUrl };
    } catch (err) {
      return {
        ok: false,
        error: `Lỗi đọc ảnh cục bộ: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  if (/^https?:\/\//i.test(src) || src.startsWith('blob:')) {
    const timed = createTimedAbortSignal(signal, 10_000);
    try {
      const res = await fetch(src, {
        signal: timed.signal,
        credentials: 'omit',
      });
      if (!res.ok) {
        return {
          ok: false,
          remoteFallbackUrl: /^https?:\/\//i.test(src) ? src : undefined,
          error: `Không tải được ảnh từ URL (HTTP ${res.status}).`,
        };
      }
      const blob = await res.blob();
      if (!blob.size) {
        return {
          ok: false,
          remoteFallbackUrl: /^https?:\/\//i.test(src) ? src : undefined,
          error: 'Ảnh tải về bị rỗng.',
        };
      }
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        return { ok: true, dataUrl };
      }
      return {
        ok: false,
        remoteFallbackUrl: /^https?:\/\//i.test(src) ? src : undefined,
        error: 'Dữ liệu trả về từ URL không phải ảnh hợp lệ.',
      };
    } catch (err) {
      return {
        ok: false,
        remoteFallbackUrl: /^https?:\/\//i.test(src) ? src : undefined,
        error: `Không thể đọc ảnh từ URL (${err instanceof Error ? err.message : 'CORS/Mạng'}).`,
      };
    } finally {
      timed.cleanup();
    }
  }
  return { ok: false, error: 'Định dạng ảnh không được hỗ trợ để đối chiếu Vision.' };
}

export {
  applyImageStyleVariables,
  DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE,
  getAllImageStyles,
  HAS_ANY_IMAGE_TEMPLATE_VAR_RE,
  IMAGE_CAMERA_ANGLES,
  IMAGE_GENERATION_MODE_LABELS,
  IMAGE_GRID_MODE_LABELS,
  IMAGE_PROMPT_TEMPLATE_VARIABLES,
  IMAGE_STYLE_VARIABLES,
  interpolateImagePromptTemplate,
  normalizeCharacterKey,
  normalizeStoryImageStyleId,
  resolveCameraAngle,
  resolveStoryImageStyle,
  STORY_IMAGE_STYLES,
};

type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContentPart[];
}

export function normalizeProxyBaseUrl(rawUrl: string): string {
  return String(rawUrl ?? '').trim().replace(/\/+$/, '');
}

export function shouldUseServerProxy(
  config?: Partial<AppConfig> | null,
): boolean {
  return config?.useServerProxy !== false;
}

export async function fetchProxyTarget(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  useServerProxy?: boolean;
  credentials?: RequestCredentials;
  referrerPolicy?: ReferrerPolicy;
}): Promise<Response> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    signal,
    useServerProxy = true,
    credentials,
    referrerPolicy,
  } = options;

  if (useServerProxy) {
    return fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ArkLiteProxy',
      },
      body: JSON.stringify({
        targetUrl: url,
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
      }),
      signal,
    });
  }

  const serializedBody =
    method === 'GET' || method === 'HEAD' || body === undefined
      ? undefined
      : typeof body === 'string'
        ? body
        : JSON.stringify(body);

  return fetch(url, {
    method,
    headers,
    ...(serializedBody !== undefined ? { body: serializedBody } : {}),
    ...(credentials ? { credentials } : {}),
    ...(referrerPolicy ? { referrerPolicy } : {}),
    signal,
  });
}

export function buildModelListEndpointCandidates(
  baseUrl: string,
  isGemini = false,
): string[] {
  const raw = normalizeProxyBaseUrl(baseUrl);
  if (!raw) return [];
  if (/\/models$/i.test(raw)) return [raw];

  const clean = raw
    .replace(/\/models\/[^/]+:(generateContent|streamGenerateContent)(\?.*)?$/i, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/responses$/i, '')
    .replace(/\/images\/generations$/i, '')
    .replace(/\/+$/, '');

  if (!clean) return [];

  if (/\/(v\d+(beta)?|openai)$/i.test(clean)) {
    const list = [`${clean}/models`];
    if (isGemini && /\/v1$/i.test(clean)) {
      list.push(`${clean.replace(/\/v1$/i, '')}/v1beta/models`);
    }
    return Array.from(new Set(list));
  }

  if (isGemini) {
    return Array.from(
      new Set([
        `${clean}/v1beta/models`,
        `${clean}/v1/models`,
        `${clean}/models`,
      ]),
    );
  }

  return Array.from(new Set([`${clean}/v1/models`, `${clean}/models`]));
}

export function buildEndpointCandidates(
  baseUrl: string,
  model: string,
  isStream: boolean,
  isGemini: boolean,
): string[] {
  const clean = normalizeProxyBaseUrl(baseUrl);
  if (!clean) return [];
  if (isGemini) {
    if (/:(generateContent|streamGenerateContent)/i.test(clean)) {
      return [clean];
    }
    const base = clean
      .replace(/\/chat\/completions$/i, '')
      .replace(/\/models$/i, '')
      .replace(/\/+$/, '');
    if (!base) return [];
    const m = encodeURIComponent(String(model ?? '') || DEFAULT_PROXY_MODEL);
    const action = isStream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const withoutVersion = base.replace(/\/v\d+(beta)?$/i, '');
    if (/\/v\d+(beta)?$/i.test(base)) {
      return Array.from(
        new Set([
          `${base}/models/${m}:${action}`,
          `${withoutVersion}/v1beta/models/${m}:${action}`,
          `${withoutVersion}/models/${m}:${action}`,
        ]),
      );
    }
    return Array.from(
      new Set([
        `${withoutVersion}/v1beta/models/${m}:${action}`,
        `${withoutVersion}/v1/models/${m}:${action}`,
        `${withoutVersion}/models/${m}:${action}`,
      ]),
    );
  }
  if (/\/chat\/completions$/i.test(clean)) return [clean];
  const base = clean
    .replace(/\/models$/i, '')
    .replace(/\/responses$/i, '')
    .replace(/\/+$/, '');
  if (!base) return [];
  if (/\/(v\d+(beta)?|openai)$/i.test(base)) return [`${base}/chat/completions`];
  return [`${base}/v1/chat/completions`, `${base}/chat/completions`];
}

const MAJOR_STORY_BEAT_RE =
  /(?:giao\s*đấu|động\s*thủ|ra\s*tay|rút\s*kiếm|rút\s*đao|tấn\s*công|ám\s*sát|phục\s*kích|đột\s*kích|bị\s*thương|trọng\s*thương|đổ\s*máu|vây\s*hãm|truy\s*sát|chạy\s*trốn|bại\s*lộ|lật\s*bài|phản\s*bội|mật\s*thư|tối\s*hậu\s*thư|sứ\s*giả|cảnh\s*báo|biến\s*cố|khủng\s*hoảng|đột\s*phá|tẩu\s*hỏa|sinh\s*tử|đoạt\s*lấy|chiếm\s*được|bị\s*bắt|vượt\s*ngục|báo\s*tin|tin\s*dữ|xông\s*vào|ập\s*vào|phát\s*hiện\s*manh\s*mối|bắt\s*gặp|tận\s*mắt\s*thấy|vỡ\s*lở)/i;

const AUTHORITATIVE_STATE_RULE_BLOCK = [
  '[CHỐT SỰ THẬT VÀO STATE — LỜI NÓI ≠ SỰ THẬT]',
  '- Lời thoại, khoe khoang, hứa hẹn hay nói dối (VD: NPC buông lời "ta đang giữ tàn phổ", hoặc nhân vật nói suông "ta đã lấy được chìa khóa") CHỈ là lời nói/ý định — TUYỆT ĐỐI KHÔNG tự động biến thành sự thật vật lý, KHÔNG tự cộng/trừ bạc, đổi sở hữu túi đồ/bí kíp hay mở khóa bí mật.',
  '- Chỉ công nhận thay đổi quyền sở hữu vật phẩm, tiền bạc, vị_trí_hiện_tại, quan hệ hay mở khóa bí_mật_riêng khi đã diễn ra hành động thực tế có kết quả xác thực rõ ràng ngay trong diễn biến cảnh.',
].join('\n');

function normalizeLocationCompareKey(loc?: string): string {
  return String(loc || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areLocationsLikelySamePlace(locA?: string, locB?: string): boolean {
  const a = normalizeLocationCompareKey(locA);
  const b = normalizeLocationCompareKey(locB);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const tokensA = a.split(' ').filter((w) => w.length >= 2);
  const tokensB = new Set(b.split(' ').filter((w) => w.length >= 2));
  if (!tokensA.length || !tokensB.size) return false;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap += 1;
  }
  return overlap >= Math.min(2, tokensA.length, tokensB.size);
}

function buildPerspectraNpcIsolationBlock(
  state: ArkState,
  activeComp: CompanionProfile | undefined,
  turnIndex: number,
): { block: string; sceneNpcNames: string[] } {
  const allowedRoster = buildAllowedRosterKeys(activeComp, state.player?.name);
  const portraits = (state.portraitBank?.portraits || []).filter(
    (p) =>
      p &&
      Boolean(p.name?.trim()) &&
      !isInvalidNpcPortrait(p, allowedRoster) &&
      !isPortraitAutoScannedUnconfirmed(p),
  );
  const charStates = Array.isArray(state.memory?.characterStates)
    ? state.memory.characterStates
    : [];
  const compNpcs = activeComp?.npcs || [];

  const curTurn = state.turns[turnIndex];
  const recentBefore = state.turns.slice(Math.max(0, turnIndex - 2), turnIndex);
  const activeScene = resolveActiveSceneCharacters({
    currentUserText: [curTurn?.user || '', curTurn?.imageCaption || '']
      .filter(Boolean)
      .join('\n'),
    currentAiText: recentBefore[recentBefore.length - 1]?.assistant || '',
    recentTurns: recentBefore,
    mcName: activeComp?.mc?.name || state.player?.name || '',
    mcPronoun: activeComp?.mc?.pronoun || state.player?.pronoun || '',
    mcAbsentAtStart: Boolean(state.player?.absentAtStart),
    npcs: compNpcs,
    portraits,
    characterStates: charStates,
    isolateUnconfirmedPortraits: true,
  });
  const presentKeys = new Set(
    activeScene.presentNames.map((n) => normalizeCharacterKey(n)).filter(Boolean),
  );

  interface IsolationProfile {
    name: string;
    isMc: boolean;
    location: string;
    locationUpdatedAt: number;
    secret: string;
    agenda: string;
    presentInText: boolean;
  }

  const byKey = new Map<string, IsolationProfile>();
  const upsertProfile = (
    rawName: string,
    patch: Partial<Omit<IsolationProfile, 'name'>>,
  ) => {
    const cleanName = String(rawName || '').trim();
    const key = normalizeCharacterKey(cleanName);
    if (!key) return;
    const prev = byKey.get(key) || {
      name: cleanName,
      isMc: false,
      location: '',
      locationUpdatedAt: 0,
      secret: '',
      agenda: '',
      presentInText: presentKeys.has(key),
    };
    const nextLoc = patch.location?.trim() || '';
    const nextLocTs = patch.locationUpdatedAt ?? 0;
    const shouldReplaceLoc =
      Boolean(nextLoc) &&
      (!prev.location || nextLocTs >= prev.locationUpdatedAt);
    byKey.set(key, {
      name: prev.name || cleanName,
      isMc: Boolean(prev.isMc || patch.isMc),
      location: shouldReplaceLoc ? nextLoc : prev.location,
      locationUpdatedAt: shouldReplaceLoc ? nextLocTs : prev.locationUpdatedAt,
      secret: patch.secret?.trim() || prev.secret,
      agenda: patch.agenda?.trim() || prev.agenda,
      presentInText: prev.presentInText || Boolean(patch.presentInText),
    });
  };

  for (const n of compNpcs) {
    upsertProfile(n.name, {
      location: n.currentLocation,
      locationUpdatedAt: 1,
      secret: n.privateSecret,
      agenda: n.agenda,
    });
  }
  for (const p of portraits) {
    upsertProfile(p.name, {
      isMc: p.isMc,
      location: p.currentLocation,
      locationUpdatedAt: p.updatedAt || 1,
      secret: p.privateSecret,
    });
  }
  for (const st of charStates) {
    upsertProfile(st.name, {
      isMc: st.isMc,
      location: sanitizeNpcFieldText('location', st.location),
      locationUpdatedAt: st.updatedAt || 1,
    });
  }

  const mcEntry = Array.from(byKey.values()).find((e) => e.isMc);
  const activeSceneLoc =
    mcEntry?.location ||
    Array.from(byKey.values()).find((e) => !e.isMc && e.presentInText && e.location)
      ?.location ||
    '';

  const npcEntries = Array.from(byKey.values()).filter((e) => !e.isMc);
  const prioritizedNpcs = [...npcEntries]
    .sort((a, b) => {
      const aWeight =
        (a.presentInText ? 4 : 0) + (a.secret ? 2 : 0) + (a.location ? 1 : 0);
      const bWeight =
        (b.presentInText ? 4 : 0) + (b.secret ? 2 : 0) + (b.location ? 1 : 0);
      return bWeight - aWeight;
    })
    .slice(0, 12);

  const npcLines = prioritizedNpcs
    .filter((e) => e.location || e.secret || e.presentInText)
    .map((e) => {
      const samePlace =
        e.location && activeSceneLoc
          ? areLocationsLikelySamePlace(e.location, activeSceneLoc)
          : e.presentInText;
      const scopeTag = e.location
        ? samePlace
          ? 'Cùng khu vực cảnh'
          : 'Ở nơi khác — CÁCH LY NHẬN THỨC'
        : e.presentInText
          ? 'Đang có mặt'
          : 'Chưa rõ vị trí';
      const locText = e.location ? `vị_trí_hiện_tại="${e.location}"` : 'vị_trí_hiện_tại=(theo ngữ cảnh gần nhất)';
      const secretText = e.secret
        ? ` | bí_mật_riêng (MẬT — NPC khác không biết)="${trimToCleanSentence(e.secret, 160)}"`
        : '';
      return `- ${e.name} [${scopeTag}]: ${locText}${secretText}`;
    });

  const block = [
    '[CÁCH LY NHẬN THỨC & BÍ MẬT TỪNG NPC (INFORMATION ISOLATION)]',
    '- Khóa nhận thức theo vị trí: Mỗi NPC CHỈ phản ứng dựa trên những gì họ trực tiếp nhìn/nghe thấy tại vị_trí_hiện_tại của chính họ. NPC ở vị_trí_hiện_tại khác KHÔNG tự nhiên biết sự kiện vừa xảy ra nếu chưa có người báo tin hoặc chứng kiến thực tế.',
    '- Bảo mật bí_mật_riêng: Các NPC khác TUYỆT ĐỐI KHÔNG "đọc suy nghĩ" hay vô tình làm lộ bí_mật_riêng của nhau khi chưa trải qua điều tra, đối chất hoặc lộ manh mối trực tiếp.',
    activeSceneLoc
      ? `Vị trí hiện trường hiện tại: ${activeSceneLoc}.`
      : '',
    npcLines.length ? `Hồ sơ vị trí & bí mật NPC:\n${npcLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    block,
    sceneNpcNames: prioritizedNpcs
      .filter((e) => e.presentInText || e.secret || e.agenda)
      .slice(0, 4)
      .map((e) => e.name),
  };
}

function detectAutoStoryBeatBlock(
  state: ArkState,
  turnIndex: number,
  sceneNpcNames: string[],
): string {
  if (state.config?.autoStoryBeatsEnabled === false) return '';
  if (turnIndex < 2) return '';

  let stagnantTurns = 0;
  for (let i = turnIndex - 1; i >= Math.max(0, turnIndex - 3); i--) {
    const past = state.turns[i];
    if (!past || !past.assistant?.trim()) break;
    const cleanProse = stripStoryPlanningAndMeta(past.assistant);
    const combined = `${past.user || ''}\n${cleanProse}`;
    if (MAJOR_STORY_BEAT_RE.test(combined)) {
      break;
    }
    stagnantTurns += 1;
  }

  if (stagnantTurns < 2) return '';

  const npcHint = sceneNpcNames.length
    ? ` (ưu tiên tận dụng NPC sẵn có như ${sceneNpcNames.join(', ')})`
    : '';
  return [
    `[NHỊP BIẾN CỐ TỰ ĐỘNG · STORY BEATS (${stagnantTurns} lượt trò chuyện liên tiếp chưa có biến cố mới)]`,
    `- Nhịp truyện đang trầm/nói chuyện suông ${stagnantTurns} lượt liền. Trong lượt này, hãy CHỦ ĐỘNG chèn 1 biến cố/động thái tự nhiên hợp bối cảnh${npcHint} để đẩy mạch truyện tiến lên — giữ chặt quy tắc cách ly vị trí & bí mật riêng:`,
    '  1) Một NPC đang có mặt chủ động hành động theo động cơ riêng hoặc vô tình để lộ 1 manh mối vật lý nhỏ liên quan tới bí_mật_riêng; HOẶC',
    '  2) Có tín sứ, khách lạ, tin đồn khẩn, mật thư hoặc tình huống va chạm lợi ích bất ngờ ập tới hiện trường; HOẶC',
    '  3) Hệ quả từ thế lực/tuyến song song ngoài sân khấu tác động trực tiếp vào bối cảnh hiện tại khiến các nhân vật phải phản ứng thực tế.',
  ].join('\n');
}

export function buildMessagesPayload(
  state: ArkState,
  turnIndex: number,
): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  const activeComp = getStoryBoundCompanionFromState(state);

  if (activeComp) {
    const npcLines =
      Array.isArray(activeComp.npcs) && activeComp.npcs.length
        ? activeComp.npcs
            .map((n) => {
              const effectiveAge =
                n.age?.trim() ||
                computeAgeFromBirthday(n.birthday, state.memory?.storyClock);
              const details = [
                effectiveAge ? `Tuổi: ${effectiveAge}` : '',
                n.birthday?.trim() ? `Ngày sinh: ${n.birthday.trim()}` : '',
                n.currentLocation?.trim()
                  ? `Vị trí hiện tại: ${n.currentLocation.trim()}`
                  : '',
                n.fashionStyle?.trim()
                  ? `Style ăn mặc: ${n.fashionStyle.trim()}`
                  : '',
                n.personality?.trim() ? `Tính cách: ${n.personality.trim()}` : '',
                n.appearance?.trim() ? `Ngoại hình: ${n.appearance.trim()}` : '',
                n.relationships?.trim() ? `Quan hệ: ${n.relationships.trim()}` : '',
                n.agenda?.trim() ? `Động cơ & lập trường riêng: ${n.agenda.trim()}` : '',
                n.friction?.trim()
                  ? `Điểm xung đột / ma sát tiềm năng: ${n.friction.trim()}`
                  : '',
                n.privateSecret?.trim()
                  ? `Bí mật riêng (MẬT — cấm tự lộ): ${n.privateSecret.trim()}`
                  : '',
                n.signature?.trim() ? `Điểm nhấn: ${n.signature.trim()}` : '',
              ].filter(Boolean);
              const body = details.length
                ? details.join(' | ')
                : (n.desc || '').trim();
              return `- ${n.name || 'NPC'}${n.role ? ` (${n.role})` : ''}${body ? `: ${body}` : ''}`;
            })
            .join('\n')
        : '';
    const mc = activeComp.mc || ({} as CompanionProfile['mc']);
    const roleLabels: Record<string, string> = {
      transmigrator: 'Người xuyên không / Chuyển sinh',
      powerhouse: 'Đại năng / Cường giả thế giới',
      custom: 'Nhân vật chính tự tạo',
    };
    const mcRoleText = (mc.roleType && roleLabels[mc.roleType]) || mc.roleType || '';
    const mcSummary = [
      mc.name ? `Tên: ${mc.name}` : '',
      mc.pronoun ? `Xưng hô: ${mc.pronoun}` : '',
      mcRoleText ? `Dạng vai trò: ${mcRoleText}` : '',
      mc.originRole ? `Thân phận/Lai lịch: ${mc.originRole}` : '',
      mc.canonMcName ? `Nhân vật chính nguyên tác song song: ${mc.canonMcName}` : '',
      mc.canonMcRelation ? `Liên hệ NV chính gốc: ${mc.canonMcRelation}` : '',
      mc.gender ? `Giới tính: ${mc.gender}` : '',
      mc.age ? `Tuổi: ${mc.age}` : '',
      mc.personality ? `Tính cách: ${mc.personality}` : '',
      mc.appearance ? `Ngoại hình: ${mc.appearance}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const divergenceLines =
      Array.isArray(activeComp.divergencePoints) &&
      activeComp.divergencePoints.length > 0
        ? activeComp.divergencePoints
            .map((pt, idx) => `${idx + 1}. ${String(pt || '').trim()}`)
            .filter((line) => line.length > 3)
            .join('\n')
        : '';

    const journeyMilestoneLines =
      Array.isArray(activeComp.journeyMilestones) &&
      activeComp.journeyMilestones.length > 0
        ? activeComp.journeyMilestones
            .map((m, idx) => `${idx + 1}. ${String(m || '').trim()}`)
            .filter((line) => line.length > 3)
            .join('\n')
        : '';

    const compSummary = [
      '[HỒ SƠ ĐỒNG NHÂN ĐANG ÁP DỤNG]',
      activeComp.name ? `Tên bản đồng nhân / thế giới: ${activeComp.name}` : '',
      activeComp.sourceQuery
        ? `Tác phẩm gốc / Thể loại: ${activeComp.sourceQuery}`
        : '',
      mcSummary ? `Nhân vật chính (người chơi tự tạo) -> ${mcSummary}` : '',
      mc.canonMcName || mc.canonMcRelation
        ? `Thiết lập nhân vật gốc: Nhân vật chính nguyên tác${
            mc.canonMcName ? ` (${mc.canonMcName})` : ''
          } vẫn tồn tại trong thế giới, đồng thời tôn trọng nhân vật chính tự tạo của người chơi.`
        : '',
      activeComp.animeTone?.trim()
        ? `Văn phong & không khí đặc trưng của tác phẩm:\n${activeComp.animeTone.trim()}`
        : '',
      journeyMilestoneLines
        ? `Lộ trình hành trình & tiến triển (theo mạch thế giới — dẫn dắt tự nhiên qua từng chặng theo lựa chọn của người chơi):\n${journeyMilestoneLines}`
        : '',
      activeComp.creativeDirection?.trim()
        ? `Định hướng sáng tạo Đồng nhân:\n${activeComp.creativeDirection.trim()}`
        : '',
      divergenceLines
        ? `Điểm rẽ nhánh / Biến số có thể bẻ lái từ nguyên tác:\n${divergenceLines}`
        : '',
      activeComp.worldSetting ? `Bối cảnh & Thế giới: ${activeComp.worldSetting}` : '',
      activeComp.worldRules ? `Quy tắc thế giới: ${activeComp.worldRules}` : '',
      npcLines ? `Danh sách NPC đồng nhân (giữ đúng động cơ, lập trường và ma sát riêng):\n${npcLines}` : '',
      activeComp.sourceContent
        ? `Tư liệu tác phẩm gốc:\n${activeComp.sourceContent.slice(0, 2400)}`
        : '',
      activeComp.note ? `Ghi chú bổ sung: ${activeComp.note}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (compSummary.trim() !== '[HỒ SƠ ĐỒNG NHÂN ĐANG ÁP DỤNG]') {
      msgs.push({ role: 'system', content: compSummary });
    }
  }

  // Inject World Setup & Protagonist Presence rules when initialized
  const wInfo = state.world;
  const pInfo = state.player;
  const dramaLabels: Record<DramaLevel, string> = {
    chill: 'Nhẹ nhàng / Đời thường (ưu tiên đối thoại tự nhiên, nhịp chậm rãi, không tạo drama gượng ép)',
    balanced: 'Cân bằng (kết hợp tương tác tự nhiên và các điểm nhấn cao trào hợp lý)',
    intense: 'Kịch tính / Căng thẳng (nhiều nút thắt, áp lực, bí mật và lựa chọn đánh đổi)',
  };
  const hasRichWorldOrPlayer = Boolean(
    wInfo?.genreLabel ||
      wInfo?.setting ||
      wInfo?.rules ||
      wInfo?.atmosphere ||
      wInfo?.dramaLevel ||
      wInfo?.openingScenario ||
      pInfo?.role ||
      pInfo?.description ||
      pInfo?.absentAtStart,
  );
  if (hasRichWorldOrPlayer) {
    const worldSetupLines = [
      '[THIẾT LẬP THẾ GIỚI & NHÂN VẬT KHỞI ĐẦU]',
      wInfo?.name ? `Tên thế giới / phiên chơi: ${wInfo.name}` : '',
      wInfo?.genreLabel ? `Thể loại / Kiểu thế giới: ${wInfo.genreLabel}` : '',
      wInfo?.atmosphere ? `Không khí & tông màu: ${wInfo.atmosphere}` : '',
      wInfo?.dramaLevel
        ? `Mức độ kịch tính: ${dramaLabels[wInfo.dramaLevel] || wInfo.dramaLevel}`
        : '',
      wInfo?.setting ? `Bối cảnh chính: ${wInfo.setting}` : '',
      wInfo?.rules ? `Luật lệ & chuẩn mực vận hành: ${wInfo.rules}` : '',
      pInfo?.absentAtStart
        ? 'QUY TẮC NHÂN VẬT CHÍNH: Nhân vật chính KHÔNG có mặt / KHÔNG tham gia ngay từ đầu. Hãy tập trung hoàn toàn vào dàn NPC và bối cảnh thế giới; tuyệt đối không tự ý kéo nhân vật chính vào cảnh cho đến khi người chơi chủ động đưa vào.'
        : [
            pInfo?.name ? `Nhân vật chính: ${pInfo.name}` : '',
            pInfo?.pronoun ? `Xưng hô: ${pInfo.pronoun}` : '',
            pInfo?.role ? `Vai trò / Vị trí ban đầu: ${pInfo.role}` : '',
            pInfo?.description ? `Mô tả nhân vật chính: ${pInfo.description}` : '',
          ]
            .filter(Boolean)
            .join(' | '),
      wInfo?.openingScenario && state.turns.length <= 1
        ? `Tình huống mở đầu: ${wInfo.openingScenario}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (worldSetupLines.trim() !== '[THIẾT LẬP THẾ GIỚI & NHÂN VẬT KHỞI ĐẦU]') {
      msgs.push({ role: 'system', content: worldSetupLines });
    }
  }

  // Inject Story Timeline & Clock Tracker context (always independent of real system wall-clock)
  const memCfg = state.memory;
  const storyClock = normalizeStoryClock(memCfg?.storyClock);
  if (storyClock.enabled) {
    const fmt = formatStoryClock(storyClock);
    const deltaNote =
      storyClock.lastDeltaMinutes && storyClock.lastDeltaMinutes > 0
        ? `Diễn biến lượt gần nhất vừa trôi ${formatDeltaMinutesVi(storyClock.lastDeltaMinutes)}${storyClock.lastAdvanceReason ? ` (${storyClock.lastAdvanceReason})` : ''}.`
        : '';
    const clockPrompt = [
      '[ĐỒNG HỒ & DÒNG THỜI GIAN TRUYỆN HIỆN TẠI]',
      `Mốc thời gian hiện hành trong truyện: ${fmt.fullLabel}.`,
      fmt.eraLabel
        ? `Niên đại / Lịch bối cảnh: ${fmt.eraLabel} (giữ nhất quán cách gọi niên đại/giờ canh của thế giới này song song với đồng hồ liên tục).`
        : '',
      deltaNote,
      'Quy tắc thời gian bắt buộc:',
      '- Tuyệt đối bám sát mốc ngày/tháng/năm/thứ/giờ/buổi trong truyện ở trên; KHÔNG BAO GIỜ tự ý lấy ngày giờ thực tế của máy tính hay hệ thống.',
      '- Duy trì dòng thời gian trôi liên tục, hợp lý theo từng hành động, cuộc trò chuyện, cuộc gọi, di chuyển hoặc bước nhảy thời gian mà người chơi nêu ra; không để giờ đứng im vô lý qua nhiều lượt hội thoại dài, cũng không nhảy cóc bất hợp lý.',
      '- Nếu cảnh kéo dài qua 23:59 sang rạng sáng/hôm sau, tự động sang ngày và thứ kế tiếp đúng lịch chuẩn.',
    ]
      .filter(Boolean)
      .join('\n');
    msgs.push({ role: 'system', content: clockPrompt });
  }

  // Inject Cultivation / Martial Arts Profile, Techniques & Inventory ONLY when enabled (Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp)
  if (memCfg?.cultivation?.enabled) {
    const activeMcName = (
      state.player?.name ||
      activeComp?.mc?.name ||
      ''
    ).trim();
    const cultBlock = formatCultivationContextBlock(
      memCfg.cultivation,
      activeMcName,
    );
    if (cultBlock) {
      msgs.push({ role: 'system', content: cultBlock });
    }
  }

  // Inject Context-Aware Long-Term Memory & State Manager context (Rolling Summary, Relevant Promises/Secrets/Events, Character States)
  if (memCfg?.enabled) {
    const blocks: string[] = [];
    const curTurnForMem = state.turns[turnIndex];
    const recentBeforeForMem = state.turns.slice(
      Math.max(0, turnIndex - 2),
      turnIndex,
    );
    const activeSceneForMem = resolveActiveSceneCharacters({
      currentUserText: [
        curTurnForMem?.user || '',
        curTurnForMem?.imageCaption || '',
      ]
        .filter(Boolean)
        .join('\n'),
      currentAiText:
        recentBeforeForMem[recentBeforeForMem.length - 1]?.assistant || '',
      recentTurns: recentBeforeForMem,
      mcName: activeComp?.mc?.name || state.player?.name || '',
      mcPronoun: activeComp?.mc?.pronoun || state.player?.pronoun || '',
      mcAbsentAtStart: Boolean(state.player?.absentAtStart),
      npcs: activeComp?.npcs || [],
      portraits: state.portraitBank?.portraits || [],
      characterStates: memCfg.characterStates || [],
      isolateUnconfirmedPortraits: true,
    });

    const activeNamesForMem = activeSceneForMem.presentNames;
    const activeNameKeySet = new Set(
      activeNamesForMem.map((n) => normalizeCharacterKey(n)).filter(Boolean),
    );
    const locationHints = [
      state.world?.name || '',
      state.world?.setting?.slice(0, 120) || '',
      ...(memCfg.characterStates || [])
        .filter((s) => activeNameKeySet.has(normalizeCharacterKey(s.name)))
        .map((s) => s.location || ''),
    ].filter(Boolean);

    const sceneQueryText = [
      curTurnForMem?.user || '',
      curTurnForMem?.imageCaption || '',
      trimToCleanSentence(
        stripStoryPlanningAndMeta(
          recentBeforeForMem[recentBeforeForMem.length - 1]?.assistant || '',
        ),
        600,
      ),
    ]
      .filter(Boolean)
      .join(' ');

    const coreCharacterTraitsForMem: Array<{
      name: string;
      role?: string;
      personality?: string;
      relationships?: string;
      locked?: boolean;
    }> = [];
    const seenTraitKeys = new Set<string>();
    const allowedRosterForMem = buildAllowedRosterKeys(
      activeComp,
      state.player?.name,
    );
    // Isolate Portrait Bank scanning: only confirmed/pinned/manual/locked/companion-linked portraits feed story memory context
    const allPortraitsForMem = (state.portraitBank?.portraits || []).filter(
      (p) =>
        !isInvalidNpcPortrait(p, allowedRosterForMem) &&
        !isPortraitAutoScannedUnconfirmed(p),
    );
    const allNpcsForMem = activeComp?.npcs || [];
    for (const rawName of activeNamesForMem.slice(0, 5)) {
      const key = normalizeCharacterKey(rawName);
      if (!key || seenTraitKeys.has(key)) continue;
      seenTraitKeys.add(key);
      const portrait = allPortraitsForMem.find(
        (p) => normalizeCharacterKey(p.name) === key,
      );
      const npc = allNpcsForMem.find(
        (n) => normalizeCharacterKey(n.name) === key,
      );
      const personality =
        sanitizeNpcFieldText('personality', portrait?.personality || '') ||
        sanitizeNpcFieldText('personality', npc?.personality || '');
      const relationships =
        sanitizeNpcFieldText('relationships', portrait?.relationships || '') ||
        sanitizeNpcFieldText('relationships', npc?.relationships || '');
      const role =
        sanitizeNpcFieldText('role', portrait?.role || '') ||
        sanitizeNpcFieldText('role', npc?.role || '');
      if (personality || relationships || role) {
        coreCharacterTraitsForMem.push({
          name: portrait?.name || npc?.name || rawName,
          role: role || undefined,
          personality: personality || undefined,
          relationships: relationships || undefined,
          locked: Boolean(portrait?.aiAutoEnrichLocked || portrait?.pinned),
        });
      }
    }

    const longTermBlock = buildLongTermMemoryContextBlock({
      memory: memCfg,
      activeCharacterNames: activeNamesForMem,
      sceneText: sceneQueryText,
      locationHints,
      currentTurnIndex: turnIndex,
      maxEntries: 12,
      maxChars: 2100,
      includeRollingSummary: true,
      compactMode: false,
      coreCharacterTraits: coreCharacterTraitsForMem,
    });
    if (longTermBlock) {
      blocks.push(longTermBlock);
    }

    const allowedRosterForPrompt = buildAllowedRosterKeys(
      activeComp,
      state.player?.name,
    );
    const confirmedPortraitNamesForPrompt = (
      state.portraitBank?.portraits || []
    )
      .filter(
        (p) =>
          p &&
          !isPortraitAutoScannedUnconfirmed(p) &&
          !isInvalidNpcPortrait(p, allowedRosterForPrompt),
      )
      .map((p) => p.name);
    const validStatesForPrompt = Array.isArray(memCfg.characterStates)
      ? cleanAndDeduplicateCharacterStates(memCfg.characterStates, {
          comp: activeComp,
          fallbackMcName: state.player?.name,
          knownValidNames: confirmedPortraitNamesForPrompt,
        }).states.filter((s) => s && !isInvalidNpcState(s, allowedRosterForPrompt))
      : [];

    if (validStatesForPrompt.length > 0) {
      const sortedStates = [...validStatesForPrompt].sort((a, b) => {
        const aPresent = activeNameKeySet.has(normalizeCharacterKey(a.name))
          ? 1
          : 0;
        const bPresent = activeNameKeySet.has(normalizeCharacterKey(b.name))
          ? 1
          : 0;
        if (aPresent !== bPresent) return bPresent - aPresent;
        if (a.isMc !== b.isMc) return a.isMc ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      const stateLines = sortedStates.slice(0, 12).map((s) => {
        const roleTag = s.isMc ? 'NV chính' : 'NPC';
        const cleanLoc = sanitizeNpcFieldText('location', s.location);
        const cleanMood = sanitizeNpcFieldText('mood', s.mood);
        const cleanStatus = sanitizeNpcFieldText('status', s.status);
        const parts = [
          cleanLoc ? `Vị trí: ${cleanLoc}` : '',
          cleanMood ? `Tâm trạng: ${cleanMood}` : '',
          cleanStatus ? `Trạng thái: ${cleanStatus}` : '',
        ]
          .filter(Boolean)
          .join(' | ');
        return `- ${s.name} (${roleTag}): ${parts || 'Chưa rõ'}`;
      });
      blocks.push(
        `[TRẠNG THÁI HIỆN TẠI CỦA NHÂN VẬT]\n${stateLines.join('\n')}`,
      );
    }

    if (blocks.length) {
      msgs.push({ role: 'system', content: blocks.join('\n\n') });
    }
  }

  const allowedRosterForPinned = buildAllowedRosterKeys(
    activeComp,
    state.player?.name,
  );
  const pinnedPortraits = (state.portraitBank?.portraits || []).filter(
    (p) =>
      Boolean(p?.pinned) &&
      Boolean(p?.name?.trim()) &&
      !isInvalidNpcPortrait(p, allowedRosterForPinned),
  );
  if (pinnedPortraits.length > 0) {
    const pinnedLines = pinnedPortraits.slice(0, 12).map((p) => {
      const roleLabel =
        sanitizeNpcFieldText('role', p.role) ||
        (p.isMc ? 'Nhân vật chính' : 'NPC');
      const details = [
        p.personality?.trim()
          ? `Tính cách: ${trimToCleanSentence(sanitizeNpcFieldText('personality', p.personality), 110)}`
          : '',
        p.relationships?.trim()
          ? `Quan hệ: ${trimToCleanSentence(sanitizeNpcFieldText('relationships', p.relationships), 100)}`
          : '',
        p.appearance?.trim()
          ? `Ngoại hình: ${trimToCleanSentence(sanitizeNpcFieldText('appearance', p.appearance), 100)}`
          : '',
        p.contextSnippet?.trim()
          ? `Dáng & biểu cảm: ${trimToCleanSentence(
              sanitizeLegacyContextSnippetForPortrait(p) || p.contextSnippet,
              140,
            )}`
          : '',
      ]
        .filter(Boolean)
        .join(' | ');
      const lockMark = p.aiAutoEnrichLocked ? ' · Khóa hồ sơ' : '';
      return `- ${p.name} [Ghim · Vai trò: ${roleLabel}${lockMark}]${details ? ` — ${details}` : ''}`;
    });
    msgs.push({
      role: 'system',
      content: `[HỒ SƠ NHÂN VẬT ĐÃ GHIM TỪ PORTRAIT BANK — THAM CHIẾU NHẬN DIỆN KHI CHUYỂN CẢNH]\n(Lưu ý: Nhãn vai trò như Main / NPC / Mob chỉ dùng để nhận diện hồ sơ và kiểm soát ngữ cảnh linh hoạt theo ván chơi — KHÔNG áp đặt bất tử, giáp cốt truyện hay ưu tiên diễn biến cứng nhắc cho bất kỳ nhân vật nào kể cả Main.)\n${pinnedLines.join('\n')}`,
    });
  }

  // Inject strict Scene Focus & Anti-NPC-Spam Discipline (always active so scene transitions stay focused)
  {
    const curTurnForScene = state.turns[turnIndex];
    const recentBeforeForScene = state.turns.slice(
      Math.max(0, turnIndex - 2),
      turnIndex,
    );
    const mcNameForScene = (
      activeComp?.mc?.name ||
      state.player?.name ||
      ''
    ).trim();
    const activeSceneFocus = resolveActiveSceneCharacters({
      currentUserText: [
        curTurnForScene?.user || '',
        curTurnForScene?.imageCaption || '',
      ]
        .filter(Boolean)
        .join('\n'),
      currentAiText:
        recentBeforeForScene[recentBeforeForScene.length - 1]?.assistant || '',
      recentTurns: recentBeforeForScene,
      mcName: mcNameForScene,
      mcPronoun: activeComp?.mc?.pronoun || state.player?.pronoun || '',
      mcAbsentAtStart: Boolean(state.player?.absentAtStart),
      npcs: activeComp?.npcs || [],
      portraits: state.portraitBank?.portraits || [],
      characterStates: state.memory?.characterStates || [],
      isolateUnconfirmedPortraits: true,
    });

    const lockedOrTaggedPortraits = (state.portraitBank?.portraits || []).filter(
      (p) =>
        Boolean(p?.name?.trim()) &&
        !isInvalidNpcPortrait(p, allowedRosterForPinned) &&
        !isPortraitAutoScannedUnconfirmed(p) &&
        (Boolean(p.pinned) || Boolean(p.aiAutoEnrichLocked)),
    );

    const roleFocusNames = Array.from(
      new Set(
        [
          ...activeSceneFocus.presentNames.slice(0, 6),
          ...lockedOrTaggedPortraits.slice(0, 6).map((p) => p.name),
        ].filter(Boolean),
      ),
    ).slice(0, 10);

    const resolvedRolesForScene = resolveSceneCharacterRoles({
      names: roleFocusNames,
      portraits: (state.portraitBank?.portraits || []).filter(
        (p) =>
          !isInvalidNpcPortrait(p, allowedRosterForPinned) &&
          !isPortraitAutoScannedUnconfirmed(p),
      ),
      npcs: activeComp?.npcs || [],
      mcName: mcNameForScene,
    });

    const roleControlLines = resolvedRolesForScene.map((r) => {
      const roleTag = r.detailLabel
        ? `[${r.tierLabel} · ${r.detailLabel}]`
        : `[${r.tierLabel}]`;
      const flags = [
        r.pinned ? 'Ghim' : '',
        r.locked ? 'Khóa hồ sơ' : '',
      ]
        .filter(Boolean)
        .join(', ');
      return `- ${r.name} ${roleTag}${flags ? ` (${flags})` : ''}`;
    });

    const sceneNpcDisciplineBlock = [
      '[KIỂM SOÁT PHÂN CẢNH & KỶ LUẬT NHÂN VẬT / NPC]',
      '- MẶC ĐỊNH KHÔNG TỰ SINH NPC TRÀN LAN: Khi mở phân cảnh mới, đổi địa điểm hoặc chuyển cảnh, KHÔNG tự ý tạo thêm hàng loạt NPC nền/ngẫu nhiên có tên riêng chỉ để lấp đầy không gian.',
      '- CHỈ THÊM NPC MỚI KHI THẬT SỰ CẦN: Chỉ giới thiệu NPC mới nếu người chơi trực tiếp nhắc tới/tìm gặp, hoặc khi nhân vật đó có vai trò rõ ràng, trực tiếp thúc đẩy diễn biến/nút thắt hiện tại. Nếu cảnh chỉ cần không khí nền (quán cà phê, hành lang, hậu trường, đường phố...), hãy tả khái quát không gian thay vì đặt tên riêng cho lễ tân, phục vụ, bảo vệ, tài xế hay người qua đường.',
      '- CHỐNG TRÙNG VAI TRÒ & NPC RÁC: Không tự đẻ thêm NPC phụ trùng vai trò với nhân vật đã có (VD: thêm trợ lý/quản lý/đồng nghiệp mới khi đã có người đảm nhiệm), không tạo nhân vật vô danh hoặc không mục đích chen ngang làm loãng mạch truyện.',
      '- KHÔNG BIẾN LYRIC NHẠC HOẶC TÊN TRÊU ĐÙA THÀNH NPC MỚI: Mọi đoạn lời bài hát, ca từ, rap, 4-bar, beat/drop, tên ca khúc hoặc câu cảm thán trong nhạc chỉ là âm thanh/tiết mục — tuyệt đối không nhân hóa hay tách thành NPC có lời thoại riêng. Khi người chơi gọi trêu, chế tên hoặc dùng biệt danh biến thể cho nhân vật sẵn có (VD: gọi Jacob Elordi là "Jacob Elordeep", Timothée Chalamet là "Lil Timmy", Central Cee là "Cench"...), phải hiểu đó vẫn là CHÍNH nhân vật gốc chứ KHÔNG được đẻ thêm một NPC riêng biệt mang cái tên trêu đùa đó.',
      '- GIỮ TRỌNG TÂM CẢNH & TÔN TRỌNG NHÃN VAI TRÒ / TRẠNG THÁI KHÓA: Giữ trọng tâm diễn biến vào nhân vật chính (khi có mặt) và các nhân vật [Main] / [NPC] đang tương tác trực tiếp. Với nhân vật gắn nhãn [Mob], chỉ cho xuất hiện ngắn gọn, đúng chức năng, không đẩy thành tâm điểm cảm xúc. Với nhân vật có nhãn (Khóa hồ sơ) hoặc (Ghim), tuyệt đối giữ nhất quán tên gọi, vai trò, tính cách và quan hệ đã khóa.',
      roleControlLines.length
        ? `Danh sách trọng tâm & nhãn vai trò đang áp dụng:\n${roleControlLines.join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    msgs.push({
      role: 'system',
      content: sceneNpcDisciplineBlock,
    });
  }

  const compactOlderHistoryProse = (text: string, maxChars: number): string => {
    const cleaned = stripStoryPlanningAndMeta(text || '').trim();
    if (!cleaned || cleaned.length <= maxChars) return cleaned;
    const paragraphs = cleaned
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length <= 2) {
      const headBudget = Math.floor(maxChars * 0.52);
      const tailBudget = Math.max(160, maxChars - headBudget - 10);
      return `${trimToCleanSentence(cleaned, headBudget)}\n[...]\n${cleaned
        .slice(-tailBudget)
        .trim()}`;
    }

    const headBudget = Math.floor(maxChars * 0.42);
    const tailBudget = Math.floor(maxChars * 0.32);
    const midBudget = Math.max(120, maxChars - headBudget - tailBudget - 16);

    const headText = trimToCleanSentence(paragraphs[0], headBudget);
    const tailText = trimToCleanSentence(
      paragraphs[paragraphs.length - 1],
      tailBudget,
    );

    // Pick highest-signal middle paragraph (dialogue or turning-point cues)
    const middleParagraphs = paragraphs.slice(1, -1);
    const keyMiddle =
      middleParagraphs.find((p) => /[“”"«»—:]/.test(p)) ||
      middleParagraphs[Math.floor(middleParagraphs.length / 2)] ||
      '';
    const midText = keyMiddle ? trimToCleanSentence(keyMiddle, midBudget) : '';

    return [headText, midText ? `[...]\n${midText}` : '', `[...]\n${tailText}`]
      .filter(Boolean)
      .join('\n');
  };

  for (const m of state.tawaPreset.modules) {
    if (!m || !m.enabled) continue;
    if (m.content === 'Chat History') {
      const start = Math.max(0, turnIndex - (state.context.historyTurns || 12));
      const verbatimStart = Math.max(start, turnIndex - 4);

      // Compute total char volume of older turns outside the 4-turn verbatim recency window
      let olderTurnsTotalChars = 0;
      const olderTurnCount = Math.max(0, verbatimStart - start);
      for (let i = start; i < verbatimStart; i++) {
        const past = state.turns[i];
        if (!past) continue;
        olderTurnsTotalChars +=
          (past.user?.length || 0) + (past.assistant?.length || 0);
      }

      const OLDER_HISTORY_CHAR_BUDGET = 14_000;
      const shouldBudgetOlderTurns =
        olderTurnCount > 0 && olderTurnsTotalChars > OLDER_HISTORY_CHAR_BUDGET;
      const perOlderAssistantCap = shouldBudgetOlderTurns
        ? Math.max(
            750,
            Math.min(
              1800,
              Math.floor(OLDER_HISTORY_CHAR_BUDGET / olderTurnCount),
            ),
          )
        : 0;

      for (let i = start; i < turnIndex; i++) {
        const past = state.turns[i];
        if (!past) continue;
        const isOlder = i < verbatimStart;
        if (past.user) {
          const userContent =
            isOlder && shouldBudgetOlderTurns && past.user.length > 650
              ? trimToCleanSentence(past.user, 650)
              : past.user;
          msgs.push({ role: 'user', content: userContent });
        }
        if (past.assistant) {
          const assistantContent =
            isOlder && shouldBudgetOlderTurns
              ? compactOlderHistoryProse(past.assistant, perOlderAssistantCap)
              : isOlder
                ? stripStoryPlanningAndMeta(past.assistant) || past.assistant
                : past.assistant;
          msgs.push({ role: 'assistant', content: assistantContent });
        }
      }
    } else if (m.content && m.content.trim()) {
      msgs.push({ role: 'system', content: m.content.trim() });
    }
  }

  // Fallback safeguard: if an un-normalized legacy preset lacks built-in core narrative modules entirely,
  // inject them cleanly once (if a module exists and was explicitly disabled by the user, respect their toggle).
  const presetModulesList = state.tawaPreset?.modules || [];
  const legacyCoreFallbacks: Array<{
    id: string;
    tagRe: RegExp;
    content: string;
  }> = [
    {
      id: WORLD_NARRATOR_PRINCIPLES_MODULE_ID,
      tagRe: /<world_narrator_principles>/i,
      content: WORLD_NARRATOR_PRINCIPLES_MODULE.content,
    },
    {
      id: WAVE_LICENSE_MODULE_ID,
      tagRe: /<wave_license>/i,
      content: WAVE_LICENSE_MODULE.content,
    },
    {
      id: WAVE_COMMITMENT_MODULE_ID,
      tagRe: /<wave_commitment>/i,
      content: WAVE_COMMITMENT_MODULE.content,
    },
    {
      id: CHARACTER_MOTIVATION_MODULE_ID,
      tagRe: /<character_motivation>/i,
      content: CHARACTER_MOTIVATION_MODULE.content,
    },
    {
      id: REALISTIC_CONSEQUENCES_MODULE_ID,
      tagRe: /<realistic_consequences>/i,
      content: REALISTIC_CONSEQUENCES_MODULE.content,
    },
    {
      id: INFORMATION_BOUNDARY_MODULE_ID,
      tagRe: /<information_boundary>/i,
      content: INFORMATION_BOUNDARY_MODULE.content,
    },
    {
      id: VARIED_PORTRAIT_MODULE_ID,
      tagRe: /<varied_portrait>/i,
      content: VARIED_PORTRAIT_MODULE.content,
    },
    {
      id: MIND_PRESENTATION_MODULE_ID,
      tagRe: /<mind_presentation>/i,
      content: MIND_PRESENTATION_MODULE.content,
    },
    {
      id: PARALLEL_WORLD_MODULE_ID,
      tagRe: /<parallel_world>/i,
      content: PARALLEL_WORLD_MODULE.content,
    },
    {
      id: MODERN_DIALOGUE_STYLE_MODULE_ID,
      tagRe: /<modern_dialogue_style>/i,
      content: MODERN_DIALOGUE_STYLE_MODULE.content,
    },
  ];
  for (const fallbackMod of legacyCoreFallbacks) {
    const existsInPreset = presetModulesList.some(
      (m) =>
        Boolean(m) &&
        (m.id === fallbackMod.id || fallbackMod.tagRe.test(m.content || '')),
    );
    if (!existsInPreset) {
      msgs.push({ role: 'system', content: fallbackMod.content.trim() });
    }
  }

  const isolationCtx = buildPerspectraNpcIsolationBlock(
    state,
    activeComp,
    turnIndex,
  );
  if (isolationCtx.block) {
    msgs.push({ role: 'system', content: isolationCtx.block });
  }

  msgs.push({ role: 'system', content: AUTHORITATIVE_STATE_RULE_BLOCK });

  const storyBeatBlock = detectAutoStoryBeatBlock(
    state,
    turnIndex,
    isolationCtx.sceneNpcNames,
  );
  if (storyBeatBlock) {
    msgs.push({ role: 'system', content: storyBeatBlock });
  }

  const pacingLines = [
    '[YÊU CẦU ĐỘ DÀI & DIỄN BIẾN]',
    `Mục tiêu độ dài hồi đáp: ${state.context?.targetLength || '900 - 1800 từ'}.`,
    'Hãy viết đầy đủ, chậm rãi, giàu chi tiết hành động, đối thoại, biểu cảm, không gian và nội tâm nhân vật. Không tóm tắt ngắn gọn hay cắt cụt diễn biến.',
    state.context?.entitiesNote
      ? `Ghi chú thực thể & bối cảnh: ${state.context.entitiesNote}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  if (pacingLines) {
    msgs.push({ role: 'system', content: pacingLines });
  }

  if (state.storyImage?.enabled) {
    const activeBeatPositions = resolveEnabledStoryImagePositions(
      state.storyImage,
    );
    const preferSoloClearFace = state.storyImage.preferClearFaceSolo !== false;
    const lockAvatarIdentity = state.storyImage.lockAvatarIdentity !== false;

    // Build compact locked avatar/profile identity anchors for MC + key portraits so the storyteller
    // NEVER writes generic labels like "the Vietnamese male producer" when describing characters.
    const identityLockLines: string[] = [];
    if (lockAvatarIdentity) {
      const seenKeys = new Set<string>();
      const pushIdentityHint = (rawName: string) => {
        const clean = rawName.trim();
        if (!clean) return;
        const k = normalizeCharacterKey(clean);
        if (!k || seenKeys.has(k)) return;
        seenKeys.add(k);
        const info = resolveImageCharacterIdentity(clean, state);
        const lockSummary = composeCharacterIdentityLockPrompt(
          info.identityLock,
          info.avatarVisualLock,
        );
        if (!lockSummary && !info.appearance && !info.age) return;
        const brief = formatCompactEnglishCharacterBrief(info, '', {
          lockAvatarIdentity: true,
        });
        const isTargetMc =
          Boolean(mcNameKey) && normalizeCharacterKey(clean) === mcNameKey;
        const equippedGear = resolveCharacterEquippedGearForVisualPrompt(
          state,
          clean,
          isTargetMc,
        );
        const equippedSuffix = equippedGear.combinedCleanEn
          ? ` | Currently equipped attire/gear: ${equippedGear.combinedCleanEn}`
          : '';
        if (brief) identityLockLines.push(`- ${brief}${equippedSuffix}`);
      };
      const mcName = (activeComp?.mc?.name || state.player?.name || '').trim();
      const mcNameKey = normalizeCharacterKey(mcName);
      if (mcName) pushIdentityHint(mcName);
      for (const p of (state.portraitBank?.portraits || []).slice(0, 8)) {
        if (identityLockLines.length >= 5) break;
        if (
          isInvalidNpcPortrait(p, allowedRosterForPinned) ||
          isPortraitAutoScannedUnconfirmed(p)
        ) {
          continue;
        }
        if (
          p.referenceImageData ||
          p.identityLock ||
          p.avatarVisualLock ||
          p.imageData ||
          p.appearance
        ) {
          pushIdentityHint(p.name);
        }
      }
      for (const n of (activeComp?.npcs || []).slice(0, 4)) {
        if (identityLockLines.length >= 5) break;
        pushIdentityHint(n.name);
      }
    }

    const isLatentStoryProvider = state.config.imageProvider === 'latent';
    const isAncientWuxiaXianxia = isWuxiaOrXianxiaWorldState(state);
    const soloFramingNote = isLatentStoryProvider
      ? preferSoloClearFace
        ? 'Use compact structured subject, style & framing tags (e.g. "1boy, solo, 3d donghua style, stylized 3d, upper body" or "1girl, solo, 3d donghua style, stylized 3d, upper body") with dynamic presence facing camera; avoid crowded wide shots or turned-back angles.'
        : 'Start with exact subject count, 3D donghua style & framing tags ("no humans, 3d donghua style, stylized 3d scenery" OR "1boy, solo, 3d donghua style, upper body" / "1girl, solo, 3d donghua style, upper body" OR "1boy, 1girl, 3d donghua style, upper body").'
      : preferSoloClearFace
        ? 'Prefer single-subject clear-face medium close-up / upper body framing with commanding presence facing camera (front or three-quarter view) — AVOID 2-person wide shots, crowds, far-away figures, or muddy dark shadows.'
        : 'Lock exact visible headcount ("empty scene, no people" OR "single person only, 1 man/woman alone, no extra people" OR "two people only, 1 man and 1 woman, no extra people").';

    const promptStyleFormatDirective = isLatentStoryProvider
      ? 'TARGET ENGINE: latent.moe — output ONE line of compact, well-structured comma-separated English tags & visual phrases in high-craft 3D donghua / stylized 3D aesthetic (NO contradictory 2D flat/lineart tags clashing, NO storytelling sentences). Structure: [Subject, Framing & Style: e.g. 1boy, 3d donghua style, stylized 3d, upper body], [Core Appearance & Fixed Marks], [Expression, Pose & Presence], [Outfit & Gear], [Lighting & Environment: clear key/rim lighting keeping face & details readable, crisp depth].'
      : 'SHARP COMMA-SEPARATED ENGLISH TAGS/PHRASES ONLY in high-craft 3D donghua / stylized 3D aesthetic (no storytelling sentences, no muddy dark shadows swallowing face/outfit). Structure: [Subject, Framing & Style], [Core Appearance & Fixed Marks], [Expression, Pose & Presence], [Outfit & Gear], [Lighting & Environment: clear key/rim lighting, crisp depth].';

    const beatTagInstructions: Record<StoryImagePosition, string> = {
      opening: `<opening>${promptStyleFormatDirective} Opening establishing beat for the FIRST part of this turn. If focused on environment, start with ${isLatentStoryProvider ? '"no humans, 3d donghua style, stylized 3d scenery"' : '"empty scene, no people, 3d donghua style, stylized 3d environment"'} (or at most one central figure if anchored in the opening). Include concrete setting, material details, dynamic framing, and clear key/rim lighting.</opening>`,
      middle: `<middle>${promptStyleFormatDirective} Mid-scene focal beat for the MIDDLE part of this turn. ${soloFramingNote} Keep core appearance traits (hair, eyes, exact anatomical placement of any real profile marks) strictly grounded in profile — NEVER invent tattoos, scars, piercings, or unowned weapons; prioritize currently equipped outfit/gear and authentic setting attire; convey personality and status via sharp gaze, confident/composed posture, rich fabric/metal textures, and readable key/rim lighting.</middle>`,
      ending: `<ending>${promptStyleFormatDirective} Closing beat for the FINAL part of this turn. ${soloFramingNote} Keep fixed appearance traits & currently equipped outfit/gear consistent with earlier beats while updating only expression, pose, camera angle, and closing key/rim lighting/background.</ending>`,
    };
    const requestedTags = activeBeatPositions
      .map((pos) => beatTagInstructions[pos])
      .join('\n');
    msgs.push({
      role: 'system',
      content: [
        '[HỆ THỐNG KHUNG ẢNH MINH HỌA THEO NHỊP TRUYỆN — 3D DONGHUA STRICT VISUAL PROMPT COMPILER]',
        `Sau khi hoàn tất trọn vẹn phần văn bản truyện, hãy đặt ở CUỐI CÙNG hồi đáp một khối XML duy nhất <story_image_prompts> chứa đúng ${activeBeatPositions.length} prompt ảnh VIẾT HOÀN TOÀN BẰNG TIẾNG ANH DẠNG TAG/CỤM TỪ CÁCH NHAU BỞI DẤU PHẨY (không trộn tiếng Việt, không viết câu kể chuyện, không trích thoại, không thêm nhãn giải thích):`,
        '<story_image_prompts>',
        requestedTags,
        '</story_image_prompts>',
        ...(identityLockLines.length
          ? [
              'KHÓA NHẬN DIỆN NHÂN VẬT CỐ ĐỊNH & TRANG BỊ HIỆN TẠI (BẮT BUỘC bám chặt ngoại hình, trang phục đang mặc và vũ khí/vật phẩm thực có; CẤM tự bịa thêm đặc điểm ngoài hồ sơ):',
              ...identityLockLines,
            ]
          : []),
        'Quy tắc BẮT BUỘC (3D Donghua / Stylized 3D Visual Prompt Compiler):',
        '- CẤM TUYỆT ĐỐI TỰ BỊA ĐẶC ĐIỂM NGOÀI HỒ SƠ: Chỉ lấy ngoại hình, phụ kiện, vũ khí, trang phục và dấu ấn có thật trong hồ sơ / trạng thái trang bị / vết thương thực tế của lượt truyện. TUYỆT ĐỐI KHÔNG tự sinh `tattoo`, `tattoos`, `neck tattoo`, `scar`, `piercing` hay vật phẩm không tồn tại.',
        '- BẢO TOÀN ĐÚNG VỊ TRÍ GIẢI PHẪU (NẾU HỒ SƠ CÓ): Nếu nhân vật thực sự có sẹo/hình xăm/phụ kiện trong hồ sơ, giữ đúng vị trí trái/phải và không dời chỗ.',
        isAncientWuxiaXianxia
          ? '- ĐỒNG BỘ TRANG PHỤC KIẾM HIỆP / TIÊN HIỆP (CẤM KIMONO / KATANA): Tuyệt đối KHÔNG gán `kimono`, `yukata`, `katana`, `samurai` trừ khi hồ sơ/bối cảnh ghi rõ. Luôn ưu tiên trang phục đang mặc từ hồ sơ hoặc Kho đồ / Phong Vật Chí (y phục môn phái, đạo bào, giáp nhẹ, trường bào Hán phục, trường kiếm `Chinese jian sword`, đao `dao saber`...).'
          : '- ĐỒNG BỘ TRANG PHỤC THEO HỒ SƠ & KHO ĐỒ: Luôn ưu tiên trang phục đang mặc / trang phục đặc trưng trong hồ sơ nhân vật hoặc Kho đồ, không tự đổi sang trang phục lạ hay lệch bối cảnh.',
        '- KHÍ CHẤT & THẦN THÁI 3D DONGHUA RÕ DÁNG (CẢ MAIN LẪN NPC): Chuyển tính cách và thân phận thành thần thái sắc nét (ánh mắt sắc, tư thế tự tin/trầm ổn, góc máy có chiều sâu, ánh sáng key & rim light rõ mặt), không để nhân vật chính bị tối bệt, mờ nhạt hay biến dạng mặt.',
        isLatentStoryProvider
          ? '- PHONG CÁCH 3D DONGHUA / STYLIZED 3D (LATENT.MOE): 1 dòng duy nhất gồm tag/cụm tiếng Anh gọn, sạch mâu thuẫn theo thứ tự [Subject, Framing & Style: 1boy/1girl, 3d donghua style, stylized 3d, upper body], [Core Appearance & Fixed Marks], [Expression, Pose & Presence], [Outfit & Gear], [Lighting & Environment: clear key/rim lighting, high clarity]. Không trộn tag 2D phẳng gây xung đột.'
          : '- PHONG CÁCH 3D DONGHUA / STYLIZED 3D: 1 dòng duy nhất gồm cụm thị giác tiếng Anh theo thứ tự [Subject, Framing & Style], [Core Appearance & Fixed Marks], [Expression, Pose & Presence], [Outfit & Gear], [Lighting & Environment: clear key/rim lighting, crisp depth].',
        '- TUYỆT ĐỐI KHÔNG chèn ngày giờ, số lượt, chữ viết, phụ đề, tiêu đề, bảng UI hay watermark.',
        'Lưu ý: Chỉ đặt <story_image_prompts> sau khi kết thúc hoàn toàn đoạn văn truyện; không nhúng thẻ XML này vào giữa đoạn văn.',
      ].join('\n'),
    });
  }

  const cur = state.turns[turnIndex];
  const attachedImages = getTurnAttachedImages(cur);
  const hasAttachedImages = attachedImages.length > 0;
  const isMultiImage = attachedImages.length > 1;
  let visionHint = '';
  if (hasAttachedImages) {
    const cleanCaption = (cur.imageCaption || '').trim();
    const recentBefore = state.turns.slice(Math.max(0, turnIndex - 2), turnIndex);
    const activeSceneChars = resolveActiveSceneCharacters({
      currentUserText: [cur.user || '', cleanCaption].filter(Boolean).join('\n'),
      currentAiText: recentBefore[recentBefore.length - 1]?.assistant || '',
      recentTurns: recentBefore,
      mcName: activeComp?.mc?.name || state.player?.name || '',
      mcPronoun: activeComp?.mc?.pronoun || state.player?.pronoun || '',
      mcAbsentAtStart: Boolean(state.player?.absentAtStart),
      npcs: activeComp?.npcs || [],
      portraits: state.portraitBank?.portraits || [],
      characterStates: state.memory?.characterStates || [],
      isolateUnconfirmedPortraits: true,
    });
    const presentNames = activeSceneChars.presentNames.slice(0, 6);
    const clockFmtForImg = storyClock.enabled ? formatStoryClock(storyClock) : null;
    const countLine = isMultiImage
      ? `Số lượng ảnh đính kèm: ${attachedImages.length} ảnh (hãy quan sát lần lượt từng ảnh từ ảnh 1 đến ảnh ${attachedImages.length}).`
      : '';
    const captionLine = cleanCaption
      ? `Chi tiết / Chú thích ảnh: ${cleanCaption}`
      : isMultiImage
        ? `Chi tiết / Chú thích ảnh: (Không có chú thích riêng — hãy trực tiếp quan sát kỹ mọi chi tiết cụ thể trên cả ${attachedImages.length} bức ảnh như chủ thể/nhân vật, trang phục, phụ kiện, đồ vật, biểu cảm, góc chụp, ánh sáng và không gian để phản ứng chi tiết, không nhận xét chung chung).`
        : 'Chi tiết / Chú thích ảnh: (Không có chú thích riêng — hãy trực tiếp quan sát kỹ mọi chi tiết cụ thể trong ảnh như chủ thể/nhân vật, trang phục, kiểu dáng, phụ kiện, giày/đồ vật, biểu cảm, góc chụp, ánh sáng và không gian để phản ứng chi tiết, không nhận xét chung chung).';
    const charsLine = presentNames.length
      ? `Nhân vật đang có mặt trong cảnh: ${presentNames.join(', ')}.`
      : '';
    const timeLine = clockFmtForImg
      ? `Mốc thời gian truyện hiện hành: ${clockFmtForImg.fullLabel}.`
      : '';
    const reactLine = presentNames.length
      ? `Yêu cầu tương tác: Hãy để ${presentNames.join(', ')} trực tiếp nhìn thấy ${isMultiImage ? `loạt ${attachedImages.length} bức ảnh` : 'bức ảnh'} và phản ứng tự nhiên bằng ánh mắt, biểu cảm, cử chỉ và lời thoại sát đúng chi tiết trong ảnh, đúng bối cảnh và đúng thời điểm hiện tại.`
      : `Yêu cầu tương tác: Hãy để các nhân vật đang có mặt trực tiếp quan sát chi tiết nổi bật trên ${isMultiImage ? `cả ${attachedImages.length} bức ảnh` : 'ảnh'} và phản ứng tự nhiên, cụ thể, khớp với bối cảnh và thời điểm hiện tại.`;
    visionHint = `\n[NGỮ CẢNH ẢNH ĐÍNH KÈM TRONG LƯỢT GỌI]\n${[
      countLine,
      captionLine,
      charsLine,
      timeLine,
      reactLine,
    ]
      .filter(Boolean)
      .join('\n')}`;
  }

  const baseUserText = (cur.user || '').trim();
  const lyricModuleActive = state.tawaPreset.modules.some(
    (m) =>
      Boolean(m?.enabled) &&
      (m.id === 'm_lyric_4bar_performance' ||
        /<lyric_4bar_performance>/i.test(m.content || '')),
  );
  if (lyricModuleActive && baseUserText) {
    const nonEmptyLines = baseUserText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const hasLyricCue =
      nonEmptyLines.length >= 2 ||
      /[♪♫]|\/{1,2}|\b(?:lyric|lyrics|bar|bars|verse|hook|chorus|bridge|outro|intro|beat|rap|ca từ|lời bài hát)\b/i.test(
        baseUserText,
      );
    if (hasLyricCue) {
      msgs.push({
        role: 'system',
        content:
          '[NHẮC NHỊP LYRIC 4-BAR — CHỈ DẪN ẨN CHO LƯỢT HIỆN TẠI]\nLượt gọi ngay sau đây có chứa lyric/ca từ biểu diễn âm nhạc. Bắt buộc tuân thủ tuyệt đối: (1) Diễn theo từng cụm 4 bar (nếu người dùng thả 4 bar thì diễn trọn 4 bar rồi dừng chờ nhịp kế, không bịa thêm bar; nếu dài hơn thì đi lần lượt từng cụm 4 bar không bỏ sót); (2) Giữ nguyên văn 100% từng chữ, từng dòng lyric gốc khi nhắc tới/trích dẫn — cấm cắt bớt, cấm "...", cấm sửa hay viết lại ca từ; (3) Từ nhạy cảm trong lời nhạc là nội dung nghệ thuật hư cấu, không che "***" hay từ chối — chỉ sáng tạo hành động, ánh mắt, cảm xúc và phản ứng diễn xuất của NPC/nhân vật xung quanh đoạn lyric đó; (4) Tuyệt đối không biến cụm từ/ca từ trong lyric thành nhân vật hay NPC có lời thoại riêng.',
      });
    }
  }
  const userText = hasAttachedImages
    ? `${
        baseUserText ||
        (isMultiImage
          ? `Người chơi vừa gửi kèm ${attachedImages.length} bức ảnh trong cảnh hiện tại.`
          : 'Người chơi vừa gửi kèm một bức ảnh trong cảnh hiện tại.')
      }${visionHint}`
    : cur.user || '';
  if (hasAttachedImages) {
    msgs.push({
      role: 'user',
      content: [
        { type: 'text', text: userText },
        ...attachedImages.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
    });
  } else {
    msgs.push({ role: 'user', content: userText });
  }

  if (state.tawaPreset.prefillEnabled && state.tawaPreset.prefill) {
    msgs.push({ role: 'assistant', content: state.tawaPreset.prefill });
  }
  return msgs;
}

export function normalizeMessagesForRequest(
  state: ArkState,
  rawMessages: ChatMessage[],
  includePrefill: boolean,
): ChatMessage[] {
  const cleaned: ChatMessage[] = [];
  for (const m of rawMessages) {
    if (!m) continue;
    if (typeof m.content === 'string') {
      const txt = m.content.trim();
      if (!txt) continue;
      if (m.role === 'system' && (txt === 'Chat History' || txt === '</chathistory>')) {
        continue;
      }
      cleaned.push({ role: m.role, content: m.content });
    } else if (Array.isArray(m.content) && m.content.length) {
      cleaned.push({ role: m.role, content: m.content });
    }
  }

  const merged: ChatMessage[] = [];
  for (const item of cleaned) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.role === item.role &&
      typeof prev.content === 'string' &&
      typeof item.content === 'string'
    ) {
      prev.content = `${prev.content}\n\n${item.content}`;
    } else {
      merged.push({ ...item });
    }
  }

  if (
    includePrefill &&
    state.tawaPreset.prefillEnabled &&
    state.tawaPreset.prefill?.trim()
  ) {
    const last = merged[merged.length - 1];
    if (!last || last.role !== 'assistant') {
      merged.push({ role: 'assistant', content: state.tawaPreset.prefill.trim() });
    }
  }
  if (!includePrefill && merged.length && merged[merged.length - 1].role === 'assistant') {
    merged.pop();
  }
  return merged;
}

function extractTextFromStructuredContent(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    let out = '';
    for (const part of raw) {
      if (typeof part === 'string') {
        out += part;
      } else if (part && typeof part === 'object') {
        const rec = part as Record<string, unknown>;
        if (typeof rec.text === 'string') {
          out += rec.text;
        } else if (typeof rec.content === 'string') {
          out += rec.content;
        } else if (
          rec.text &&
          typeof rec.text === 'object' &&
          typeof (rec.text as Record<string, unknown>).value === 'string'
        ) {
          out += String((rec.text as Record<string, unknown>).value);
        }
      }
    }
    return out;
  }
  return '';
}

function extractPiecesFromModelPayload(json: Record<string, unknown>): {
  contentPiece: string;
  reasoningPiece: string;
} {
  let contentPiece = '';
  let reasoningPiece = '';

  const choices = Array.isArray(json.choices) ? json.choices : null;
  const firstChoice =
    choices && choices[0] && typeof choices[0] === 'object'
      ? (choices[0] as Record<string, unknown>)
      : null;

  const delta =
    firstChoice?.delta && typeof firstChoice.delta === 'object'
      ? (firstChoice.delta as Record<string, unknown>)
      : null;
  const msgObj =
    firstChoice?.message && typeof firstChoice.message === 'object'
      ? (firstChoice.message as Record<string, unknown>)
      : null;

  if (delta) {
    contentPiece = extractTextFromStructuredContent(delta.content);
    const rawReasoning =
      delta.reasoning_content ?? delta.reasoning ?? delta.thought;
    reasoningPiece = extractTextFromStructuredContent(rawReasoning);
  } else if (msgObj) {
    contentPiece = extractTextFromStructuredContent(msgObj.content);
    const rawReasoning =
      msgObj.reasoning_content ?? msgObj.reasoning ?? msgObj.thought;
    reasoningPiece = extractTextFromStructuredContent(rawReasoning);
  } else if (
    Array.isArray(
      (
        (json.candidates as Array<Record<string, unknown>> | undefined)?.[0]
          ?.content as Record<string, unknown> | undefined
      )?.parts,
    )
  ) {
    const parts = (
      (json.candidates as Array<Record<string, unknown>>)[0].content as {
        parts: Array<{ text?: string; thought?: boolean }>;
      }
    ).parts;
    for (const part of parts) {
      if (typeof part?.text !== 'string' || !part.text) continue;
      if (part.thought) {
        reasoningPiece += part.text;
      } else {
        contentPiece += part.text;
      }
    }
  } else if (typeof firstChoice?.text === 'string') {
    contentPiece = firstChoice.text;
  } else {
    const fallback = json.delta ?? json.content ?? json.text ?? '';
    contentPiece = extractTextFromStructuredContent(fallback);
  }

  return { contentPiece, reasoningPiece };
}

function replaceAttachedImageUrlsInMessages(
  messages: ChatMessage[],
  imageUrls: string[],
): ChatMessage[] {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return messages;
  return messages.map((msg, idx) => {
    if (idx !== lastUserIdx || !Array.isArray(msg.content)) return msg;
    const textParts = msg.content.filter((p) => p.type === 'text');
    const nextParts: MessageContentPart[] = [
      ...textParts,
      ...imageUrls.map((url) => ({
        type: 'image_url' as const,
        image_url: { url },
      })),
    ];
    return { ...msg, content: nextParts };
  });
}

function isPayloadTooLargeFailure(status: number, errText: string): boolean {
  if (status === 413) return true;
  return /\b(?:413|payload\s+too\s+large|request\s+entity\s+too\s+large|body\s+size|too\s+large|exceeds?\s+(?:the\s+)?(?:max|limit|size)|image\s+too\s+large)\b/i.test(
    errText,
  );
}

class StreamIdleTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamIdleTimeoutError';
  }
}

async function readChunkWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
  userSignal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (userSignal.aborted) {
    const abortErr = new Error('Đã dừng theo yêu cầu người dùng.');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let onUserAbort: (() => void) | null = null;

  try {
    return await new Promise<ReadableStreamReadResult<Uint8Array>>(
      (resolve, reject) => {
        onUserAbort = () => {
          const abortErr = new Error('Đã dừng theo yêu cầu người dùng.');
          abortErr.name = 'AbortError';
          reject(abortErr);
        };
        userSignal.addEventListener('abort', onUserAbort, { once: true });

        timer = globalThis.setTimeout(() => {
          reject(
            new StreamIdleTimeoutError(
              `Luồng stream bị treo quá ${Math.round(idleTimeoutMs / 1000)} giây không có dữ liệu mới.`,
            ),
          );
        }, idleTimeoutMs);

        reader.read().then(resolve, reject);
      },
    );
  } finally {
    if (timer !== null) {
      globalThis.clearTimeout(timer);
    }
    if (onUserAbort) {
      userSignal.removeEventListener('abort', onUserAbort);
    }
  }
}

export async function executeModelTurn(options: {
  state: ArkState;
  turnIndex: number;
  signal: AbortSignal;
  onChunk: (accumulated: string) => void;
  onLog: (line: string) => void;
}): Promise<{
  ok: boolean;
  text: string;
  rawText?: string;
  statusLabel: string;
  aborted?: boolean;
}> {
  const { state, turnIndex, signal, onChunk, onLog } = options;
  const baseUrl = (state.config.proxyUrl || '').trim();
  const model = (state.config.model || '').trim() || DEFAULT_PROXY_MODEL;
  const apiKey = (state.config.proxyKey || '').trim();
  const targetTurn = state.turns[turnIndex];

  if (!targetTurn) {
    return { ok: false, text: '', statusLabel: 'Không tìm thấy lượt' };
  }

  if (!baseUrl) {
    const localReply = `[Chế độ bản xem trước cục bộ] Chưa cấu hình Proxy URL nên hệ thống ghi nhận lượt của ${
      state.player.pronoun || 'nhân vật'
    }:\n\n"${
      targetTurn.user || 'Đã gửi ảnh đính kèm'
    }"\n\nHãy vào mục Cấu hình để nhập Proxy URL nếu muốn gọi mô hình trực tuyến, hoặc bấm Sửa để chỉnh nội dung trực tiếp.`;
    return { ok: true, text: localReply, statusLabel: 'Bản xem trước cục bộ' };
  }

  const isGemini = detectIsGeminiProtocol(state.config);
  const rawAttachedImages = getTurnAttachedImages(targetTurn);
  const hasAttachedImages = rawAttachedImages.length > 0;

  let activeImageUrls: string[] = [];
  let compactRetryApplied = false;

  const normalizeTurnImages = async (opts?: {
    compactRetry?: boolean;
  }): Promise<{ ok: boolean; urls: string[]; error?: string }> => {
    const compact = Boolean(opts?.compactRetry);
    const configuredDim = clampChatImageMaxDimension(
      state.config.chatImageMaxDimension,
    );
    const configuredQuality = clampChatImageQuality(
      state.config.chatImageQuality,
    );
    const maxDimension = compact
      ? configuredDim > 0
        ? Math.min(configuredDim, 1024)
        : 1024
      : configuredDim;
    const quality = compact ? Math.min(configuredQuality, 0.72) : configuredQuality;
    const perImageBudgetKb = compact
      ? Math.max(260, Math.floor(1800 / Math.max(1, rawAttachedImages.length)))
      : Math.max(520, Math.floor(4200 / Math.max(1, rawAttachedImages.length)));

    const urls: string[] = [];
    const errors: string[] = [];
    let totalBytes = 0;

    for (let i = 0; i < rawAttachedImages.length; i += 1) {
      if (signal.aborted) {
        return { ok: false, urls: [], error: 'Đã dừng.' };
      }
      const res = await normalizeChatImageForVisionApi(rawAttachedImages[i], {
        maxDimension,
        quality,
        targetMaxPayloadKb: perImageBudgetKb,
        forceRecompress: compact,
        signal,
      });
      if (res.ok && res.image) {
        urls.push(res.image.dataUrl);
        totalBytes += res.image.bytes;
      } else if (!isGemini && res.remoteFallbackUrl) {
        urls.push(res.remoteFallbackUrl);
      } else {
        errors.push(
          `Ảnh #${i + 1}: ${res.error || 'Không chuẩn hóa được dữ liệu ảnh.'}`,
        );
      }
    }

    if (!urls.length) {
      return {
        ok: false,
        urls: [],
        error:
          errors.join(' · ') ||
          'Không thể đọc hoặc chuẩn hóa ảnh đính kèm để gửi lên AI.',
      };
    }

    onLog(
      `[Ảnh đính kèm] Đã chuẩn hóa ${urls.length}/${rawAttachedImages.length} ảnh (${formatBytesCompact(totalBytes)}${compact ? ' · chế độ nén gọn dự phòng' : ''}).`,
    );
    return { ok: true, urls };
  };

  if (hasAttachedImages) {
    const prep = await normalizeTurnImages({ compactRetry: false });
    if (signal.aborted) {
      return { ok: false, text: '', statusLabel: 'Đã dừng', aborted: true };
    }
    if (!prep.ok) {
      onLog(`[Ảnh đính kèm] Lỗi: ${prep.error}`);
      return {
        ok: false,
        text: `[Không thể gửi ảnh đính kèm] ${prep.error}\n\nHãy chọn lại ảnh (JPG/PNG) hoặc giảm độ phân giải trong mục Tùy chọn nén ảnh rồi thử lại.`,
        statusLabel: 'Lỗi xử lý ảnh',
      };
    }
    activeImageUrls = prep.urls;
  }

  const rawMessages = buildMessagesPayload(state, turnIndex);
  const hasPrefill = Boolean(
    state.tawaPreset?.prefillEnabled && state.tawaPreset?.prefill?.trim(),
  );
  const hasGeminiSafety = Boolean(isGemini || /gemini/i.test(model));

  const buildAttemptVariants = (imageUrls: string[]) => {
    const msgsWithNormalizedImages = hasAttachedImages
      ? replaceAttachedImageUrlsInMessages(rawMessages, imageUrls)
      : rawMessages;
    const list: Array<{
      msgs: ChatMessage[];
      withSafety: boolean;
      label: string;
    }> = [];
    if (hasPrefill || hasGeminiSafety) {
      list.push({
        msgs: normalizeMessagesForRequest(state, msgsWithNormalizedImages, true),
        withSafety: hasGeminiSafety,
        label: 'chuẩn',
      });
    }
    list.push({
      msgs: normalizeMessagesForRequest(state, msgsWithNormalizedImages, false),
      withSafety: false,
      label: 'tương thích',
    });
    return list;
  };

  // Build execution modes:
  // Always honor streamEnabled first; if this turn has attached images and streaming fails/hangs/returns empty,
  // automatically fall back to non-stream (stream: false) so multimodal proxies that choke on SSE still succeed.
  const modeQueue: Array<{ useStream: boolean; modeLabel: string }> = [
    {
      useStream: Boolean(state.streamEnabled),
      modeLabel: state.streamEnabled ? 'stream' : 'non-stream',
    },
  ];
  if (hasAttachedImages && state.streamEnabled) {
    modeQueue.push({
      useStream: false,
      modeLabel: 'non-stream dự phòng',
    });
  }

  const requestConnectTimeoutMs = hasAttachedImages ? 135_000 : 180_000;
  const streamIdleTimeoutMs = hasAttachedImages ? 85_000 : 110_000;

  let lastErr = '';
  let sawHttp413 = false;

  for (const mode of modeQueue) {
    const endpoints = buildEndpointCandidates(
      baseUrl,
      model,
      mode.useStream,
      isGemini,
    );

    if (mode.modeLabel === 'non-stream dự phòng') {
      onLog(
        `[Ảnh đính kèm] Luồng stream không trả về nội dung ổn định — tự động chuyển sang chế độ non-stream dự phòng...`,
      );
    }

    for (const url of endpoints) {
      let attemptVariants = buildAttemptVariants(activeImageUrls);
      let variantIdx = 0;

      while (variantIdx < attemptVariants.length) {
        if (signal.aborted) {
          return { ok: false, text: '', statusLabel: 'Đã dừng', aborted: true };
        }
        const variant = attemptVariants[variantIdx];
        const timed = createTimedAbortSignal(signal, requestConnectTimeoutMs);

        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: mode.useStream
              ? 'application/json, text/event-stream'
              : 'application/json',
          };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            if (isGemini) {
              headers['x-goog-api-key'] = apiKey;
            }
          }

          const messages = variant.msgs;
          const sysPrompts = messages
            .filter((m) => m.role === 'system')
            .map((m) => (typeof m.content === 'string' ? m.content : ''))
            .filter(Boolean);
          const nonSys = messages.filter((m) => m.role !== 'system');
          const targetMaxTokens = 65536;

          const body = isGemini
            ? {
                ...(sysPrompts.length
                  ? {
                      systemInstruction: {
                        parts: [{ text: sysPrompts.join('\n\n') }],
                      },
                    }
                  : {}),
                contents: nonSys.map((m) => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: Array.isArray(m.content)
                    ? m.content
                        .map((c) => {
                          if (c.type === 'image_url') {
                            const rawUrl = (c.image_url?.url || '').trim();
                            const mimeMatch =
                              /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(
                                rawUrl,
                              );
                            if (!mimeMatch || !mimeMatch[2]) return null;
                            return {
                              inlineData: {
                                mimeType: mimeMatch[1].toLowerCase(),
                                data: mimeMatch[2].replace(/\s+/g, ''),
                              },
                            };
                          }
                          return { text: c.text || '' };
                        })
                        .filter((p): p is NonNullable<typeof p> => Boolean(p))
                    : [
                        {
                          text:
                            typeof m.content === 'string'
                              ? m.content
                              : JSON.stringify(m.content),
                        },
                      ],
                })),
                generationConfig: { maxOutputTokens: targetMaxTokens },
                ...(variant.withSafety
                  ? {
                      safetySettings:
                        state.config.safetySettings || DEFAULT_SAFETY,
                    }
                  : {}),
              }
            : {
                model,
                messages,
                max_tokens: targetMaxTokens,
                stream: Boolean(mode.useStream),
                ...(variant.withSafety && /gemini/i.test(model)
                  ? {
                      safetySettings:
                        state.config.safetySettings || DEFAULT_SAFETY,
                    }
                  : {}),
              };

          const res = await fetchProxyTarget({
            url,
            method: 'POST',
            headers,
            body,
            signal: timed.signal,
            useServerProxy: shouldUseServerProxy(state.config),
          });

          // Clear connect timer once response headers arrive (stream idle timer takes over below)
          timed.cleanup();

          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            lastErr = `HTTP ${res.status} [${variant.label} · ${mode.modeLabel}] tại ${url}${
              errTxt ? `: ${errTxt.slice(0, 320)}` : ''
            }`;
            onLog(lastErr);

            // Auto re-compress once on HTTP 413 / payload-too-large errors for image-bearing turns
            if (
              hasAttachedImages &&
              !compactRetryApplied &&
              isPayloadTooLargeFailure(res.status, errTxt)
            ) {
              sawHttp413 = true;
              compactRetryApplied = true;
              onLog(
                '[Ảnh đính kèm] Máy chủ báo gói ảnh quá lớn (HTTP 413) — tự động nén gọn xuống ≤1024px và thử lại...',
              );
              const rePrepped = await normalizeTurnImages({
                compactRetry: true,
              });
              if (rePrepped.ok && rePrepped.urls.length > 0) {
                activeImageUrls = rePrepped.urls;
                attemptVariants = buildAttemptVariants(activeImageUrls);
                // Retry the same variant index with smaller images
                continue;
              }
            }

            variantIdx += 1;
            continue;
          }

          const respContentType = (
            res.headers.get('content-type') || ''
          ).toLowerCase();
          const canReadAsStream =
            mode.useStream &&
            res.body &&
            typeof res.body.getReader === 'function' &&
            !respContentType.includes('application/json');

          if (canReadAsStream && res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let rawEntireStream = '';
            let reasoningAcc = '';
            let contentAcc = '';

            const composeStreamedRaw = () => {
              if (reasoningAcc.trim()) {
                if (contentAcc) {
                  return `<thinking>\n${reasoningAcc.trim()}\n</thinking>\n\n${contentAcc}`;
                }
                return `<thinking>\n${reasoningAcc}`;
              }
              return contentAcc;
            };

            const processSseLine = (rawLine: string) => {
              const trimmed = rawLine.trim();
              if (!trimmed || trimmed === 'data: [DONE]' || trimmed === '[DONE]') {
                return;
              }
              if (trimmed.startsWith(':')) return; // SSE comment / keepalive
              const payloadStr = trimmed.startsWith('data:')
                ? trimmed.slice(5).trim()
                : trimmed;
              if (!payloadStr || payloadStr === '[DONE]') return;
              try {
                const json = JSON.parse(payloadStr) as Record<string, unknown>;
                const { contentPiece, reasoningPiece } =
                  extractPiecesFromModelPayload(json);
                if (reasoningPiece) {
                  reasoningAcc += reasoningPiece;
                }
                if (contentPiece) {
                  contentAcc += contentPiece;
                }
                if (reasoningPiece || contentPiece) {
                  onChunk(composeStreamedRaw());
                }
              } catch {
                // Ignore incomplete JSON fragments; non-JSON plain text lines only if not starting with '{' or '['
                if (
                  !payloadStr.startsWith('{') &&
                  !payloadStr.startsWith('[') &&
                  !trimmed.startsWith('event:') &&
                  !trimmed.startsWith('id:') &&
                  !trimmed.startsWith('retry:')
                ) {
                  contentAcc += payloadStr;
                  onChunk(composeStreamedRaw());
                }
              }
            };

            try {
              while (true) {
                const { done, value } = await readChunkWithIdleTimeout(
                  reader,
                  streamIdleTimeoutMs,
                  signal,
                );
                if (done) break;
                const decoded = decoder.decode(value, { stream: true });
                rawEntireStream += decoded;
                buffer += decoded;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  processSseLine(line);
                }
              }
              // Flush any final UTF-8 bytes & remaining tail line without trailing newline
              const finalDecoded = decoder.decode();
              if (finalDecoded) {
                rawEntireStream += finalDecoded;
                buffer += finalDecoded;
              }
              if (buffer.trim()) {
                for (const tailLine of buffer.split('\n')) {
                  processSseLine(tailLine);
                }
              }
            } catch (streamErr) {
              await reader.cancel().catch(() => {});
              throw streamErr;
            } finally {
              try {
                reader.releaseLock();
              } catch {
                // ignore
              }
            }

            // Fallback: some proxies ignore `stream: true` on vision requests and send a single multi-line JSON body
            if (!contentAcc.trim() && !reasoningAcc.trim() && rawEntireStream.trim()) {
              try {
                const wholeJson = JSON.parse(rawEntireStream.trim()) as Record<
                  string,
                  unknown
                >;
                const parsed = extractPiecesFromModelPayload(wholeJson);
                if (parsed.reasoningPiece) reasoningAcc += parsed.reasoningPiece;
                if (parsed.contentPiece) contentAcc += parsed.contentPiece;
                if (parsed.contentPiece || parsed.reasoningPiece) {
                  onChunk(composeStreamedRaw());
                }
              } catch {
                // Not single JSON object
              }
            }

            const rawCombined = composeStreamedRaw();
            if (!rawCombined.trim()) {
              lastErr = `Stream [${variant.label}] hoàn tất nhưng không có nội dung văn bản từ ${url}`;
              onLog(lastErr);
              variantIdx += 1;
              continue;
            }
            const cleanedStory = sanitizeCompletedStoryResponse(
              contentAcc.trim() ? contentAcc : rawCombined,
            );
            return {
              ok: true,
              text: cleanedStory,
              rawText: rawCombined,
              statusLabel: 'Hoàn tất',
            };
          } else {
            const rawBodyText = await res.text();
            let reasoningOut = '';
            let contentOut = '';

            if (rawBodyText.trim()) {
              try {
                const data = JSON.parse(rawBodyText) as Record<string, unknown>;
                const parsed = extractPiecesFromModelPayload(data);
                contentOut = parsed.contentPiece;
                reasoningOut = parsed.reasoningPiece;
              } catch {
                // Some proxies still return SSE lines even when stream: false
                for (const rawLine of rawBodyText.split('\n')) {
                  const trimmed = rawLine.trim();
                  if (!trimmed || trimmed === 'data: [DONE]' || trimmed.startsWith(':')) {
                    continue;
                  }
                  const payloadStr = trimmed.startsWith('data:')
                    ? trimmed.slice(5).trim()
                    : trimmed;
                  if (!payloadStr || payloadStr === '[DONE]') continue;
                  try {
                    const chunkJson = JSON.parse(payloadStr) as Record<
                      string,
                      unknown
                    >;
                    const parsed = extractPiecesFromModelPayload(chunkJson);
                    if (parsed.reasoningPiece) reasoningOut += parsed.reasoningPiece;
                    if (parsed.contentPiece) contentOut += parsed.contentPiece;
                  } catch {
                    // skip unparseable SSE metadata
                  }
                }
              }
            }

            const rawCombined = reasoningOut.trim()
              ? contentOut.trim()
                ? `<thinking>\n${reasoningOut.trim()}\n</thinking>\n\n${contentOut}`
                : `<thinking>\n${reasoningOut.trim()}\n</thinking>`
              : contentOut;

            if (!rawCombined.trim()) {
              lastErr = `Phản hồi rỗng [${variant.label} · ${mode.modeLabel}] từ ${url}`;
              onLog(lastErr);
              variantIdx += 1;
              continue;
            }
            const cleanedStory = sanitizeCompletedStoryResponse(
              contentOut.trim() ? contentOut : rawCombined,
            );
            return {
              ok: true,
              text: cleanedStory,
              rawText: rawCombined,
              statusLabel:
                mode.modeLabel === 'non-stream dự phòng'
                  ? 'Hoàn tất (dự phòng)'
                  : 'Hoàn tất',
            };
          }
        } catch (err) {
          timed.cleanup();
          if (signal.aborted) {
            return { ok: false, text: '', statusLabel: 'Đã dừng', aborted: true };
          }
          if (err instanceof StreamIdleTimeoutError) {
            lastErr = `${err.message} [${mode.modeLabel}] (${url})`;
            onLog(`Timeout stream: ${lastErr}`);
          } else if (err instanceof Error && err.name === 'AbortError') {
            lastErr = `Quá thời gian chờ phản hồi (${Math.round(requestConnectTimeoutMs / 1000)}s) [${mode.modeLabel}] (${url})`;
            onLog(`Timeout: ${lastErr}`);
          } else {
            lastErr = `${err instanceof Error ? err.message : String(err)} [${mode.modeLabel}] (${url})`;
            onLog(`Lỗi: ${lastErr}`);
          }
          variantIdx += 1;
        }
      }
    }
  }

  const visionHintNote = hasAttachedImages
    ? sawHttp413
      ? '\n\nGợi ý: Gói ảnh vẫn vượt giới hạn của Proxy/Model đích. Hãy hạ "Độ phân giải resize ảnh" xuống 1024px hoặc gửi từng ảnh một.'
      : '\n\nGợi ý: Nếu proxy hoặc model hiện tại chưa hỗ trợ đầu vào hình ảnh (Vision) hoặc mạng chậm làm rớt kết nối, hãy kiểm tra Model hỗ trợ Vision, hạ độ phân giải nén ảnh (1024px–1280px) hoặc bật/tắt Server Proxy (/api/proxy) trong Cấu hình.'
    : '';

  return {
    ok: false,
    text: `[Không thể gọi AI] ${lastErr || 'Không kết nối được proxy.'}${visionHintNote}`,
    statusLabel: hasAttachedImages ? 'Lỗi gửi ảnh tới AI' : 'Lỗi gọi AI',
  };
}

export interface AiJsonTextResult {
  ok: boolean;
  text: string | null;
  errorKind?:
    | 'no_proxy'
    | 'timeout'
    | 'aborted'
    | 'http'
    | 'network'
    | 'invalid_json'
    | 'empty'
    | 'vision_unavailable';
  errorMessage?: string;
  httpStatus?: number;
  elapsedMs: number;
  modelUsed?: string;
  usedCustomSlot?: boolean;
}

export interface CallAiJsonOrTextOptions {
  systemPrompt?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onLog?: (line: string) => void;
  logPrefix?: string;
  maxTokens?: number;
  imageDataUrls?: string[];
  taskSlot?: AiTaskSlotId;
  modelOverride?: string;
  /** When true, abort with explicit error instead of silently falling back to text-only if images cannot be encoded. */
  requireVisionImages?: boolean;
}

export async function callAiJsonOrTextDetailed(
  state: ArkState,
  promptText: string,
  options?: CallAiJsonOrTextOptions,
): Promise<AiJsonTextResult> {
  const startTs = Date.now();
  const baseUrl = (state.config.proxyUrl || '').trim();
  const resolvedTask = resolveModelForTask(state.config, options?.taskSlot);
  const overrideModel = (options?.modelOverride || '').trim();
  const model = overrideModel || resolvedTask.model;
  const usedCustomSlot = Boolean(overrideModel || resolvedTask.isCustomSlot);
  const apiKey = (state.config.proxyKey || '').trim();
  const logPrefix = options?.logPrefix || '[AI]';

  if (!baseUrl) {
    return {
      ok: false,
      text: null,
      errorKind: 'no_proxy',
      errorMessage: 'Chưa cấu hình Proxy URL trong mục Cấu hình.',
      elapsedMs: Date.now() - startTs,
      modelUsed: model,
      usedCustomSlot,
    };
  }

  const isGemini = detectIsGeminiProtocol(state.config);
  const endpoints = buildEndpointCandidates(baseUrl, model, false, isGemini);
  if (!endpoints.length) {
    return {
      ok: false,
      text: null,
      errorKind: 'no_proxy',
      errorMessage: 'Địa chỉ Proxy URL không hợp lệ.',
      elapsedMs: Date.now() - startTs,
      modelUsed: model,
      usedCustomSlot,
    };
  }

  // Prepare Vision images upfront so IDB refs & remote URLs convert cleanly to inline base64
  const rawInputImages = (options?.imageDataUrls || [])
    .map((u) => String(u || '').trim())
    .filter(Boolean);
  const preparedImages: string[] = [];
  const imagePrepErrors: string[] = [];
  if (rawInputImages.length > 0) {
    for (const rawImg of rawInputImages) {
      const prepped = await ensureVisionInlineDataUrl(rawImg, options?.signal);
      if (prepped.ok && prepped.dataUrl) {
        preparedImages.push(prepped.dataUrl);
      } else if (!isGemini && prepped.remoteFallbackUrl) {
        preparedImages.push(prepped.remoteFallbackUrl);
      } else {
        imagePrepErrors.push(prepped.error || 'Không đọc được dữ liệu ảnh.');
      }
    }
    if (
      options?.requireVisionImages &&
      preparedImages.length < rawInputImages.length
    ) {
      const reason =
        imagePrepErrors[0] ||
        'Không thể mã hóa đủ ảnh đầu vào để gửi API Vision đối chiếu.';
      options?.onLog?.(`${logPrefix} [model=${model}] ${reason}`);
      return {
        ok: false,
        text: null,
        errorKind: 'vision_unavailable',
        errorMessage: reason,
        elapsedMs: Date.now() - startTs,
        modelUsed: model,
        usedCustomSlot,
      };
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    if (isGemini) {
      headers['x-goog-api-key'] = apiKey;
    }
  }

  const sysPrompt = options?.systemPrompt?.trim() || '';
  const maxTokens = options?.maxTokens || 4096;
  const timeoutMs =
    typeof options?.timeoutMs === 'number' && options.timeoutMs > 0
      ? options.timeoutMs
      : 45_000;
  const deadlineTs = startTs + timeoutMs;

  let lastErrorKind: AiJsonTextResult['errorKind'] = 'network';
  let lastErrorMessage = 'Không nhận được phản hồi từ Proxy AI.';
  let lastHttpStatus: number | undefined;

  for (const url of endpoints) {
    if (options?.signal?.aborted) {
      return {
        ok: false,
        text: null,
        errorKind: 'aborted',
        errorMessage: 'Yêu cầu đã bị hủy.',
        elapsedMs: Date.now() - startTs,
        modelUsed: model,
        usedCustomSlot,
      };
    }

    const remainingMs = deadlineTs - Date.now();
    if (remainingMs <= 250) {
      const msg = `Quá thời gian chờ (${Math.round(timeoutMs / 1000)}s) — proxy hoặc model (${model}) phản hồi quá chậm.`;
      options?.onLog?.(`${logPrefix} ${msg}`);
      return {
        ok: false,
        text: null,
        errorKind: 'timeout',
        errorMessage: msg,
        elapsedMs: Date.now() - startTs,
        modelUsed: model,
        usedCustomSlot,
      };
    }

    const timed = createTimedAbortSignal(options?.signal, remainingMs);
    try {
      const validImages = preparedImages.filter(
        (u) => u.startsWith('data:image/') || /^https?:\/\//i.test(u),
      );

      const geminiUserParts: Array<Record<string, unknown>> = [];
      for (const imgUrl of validImages) {
        const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imgUrl);
        if (m) {
          geminiUserParts.push({
            inlineData: { mimeType: m[1], data: m[2] },
          });
        }
      }
      if (
        isGemini &&
        options?.requireVisionImages &&
        geminiUserParts.length < rawInputImages.length
      ) {
        const msg =
          'Giao thức Gemini Native yêu cầu ảnh dạng base64 inline nhưng không thể chuyển đổi đủ ảnh để đối chiếu.';
        options?.onLog?.(`${logPrefix} [model=${model}] ${msg}`);
        return {
          ok: false,
          text: null,
          errorKind: 'vision_unavailable',
          errorMessage: msg,
          elapsedMs: Date.now() - startTs,
          modelUsed: model,
          usedCustomSlot,
        };
      }
      geminiUserParts.push({ text: promptText });

      const openAiUserContent =
        validImages.length > 0
          ? [
              ...validImages.map((imgU) => ({
                type: 'image_url' as const,
                image_url: { url: imgU },
              })),
              { type: 'text' as const, text: promptText },
            ]
          : promptText;

      const body = isGemini
        ? {
            ...(sysPrompt
              ? { systemInstruction: { parts: [{ text: sysPrompt }] } }
              : {}),
            contents: [{ role: 'user', parts: geminiUserParts }],
            generationConfig: { maxOutputTokens: maxTokens },
            safetySettings: state.config.safetySettings || DEFAULT_SAFETY,
          }
        : {
            model,
            messages: [
              ...(sysPrompt ? [{ role: 'system', content: sysPrompt }] : []),
              { role: 'user', content: openAiUserContent },
            ],
            max_tokens: maxTokens,
            stream: false,
            ...(/gemini/i.test(model)
              ? { safetySettings: state.config.safetySettings || DEFAULT_SAFETY }
              : {}),
          };

      const res = await fetchProxyTarget({
        url,
        method: 'POST',
        headers,
        body,
        signal: timed.signal,
        useServerProxy: shouldUseServerProxy(state.config),
      });

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        const cleanSnippet = String(errTxt ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
        lastErrorKind = 'http';
        lastHttpStatus = res.status;
        lastErrorMessage = `Lỗi Proxy HTTP ${res.status} (model=${model})${
          cleanSnippet ? `: ${cleanSnippet}` : ''
        }`;
        options?.onLog?.(`${logPrefix} ${lastErrorMessage} (${url})`);
        // Only try alternate endpoint candidate for route mismatch (404/405);
        // auth/rate-limit/gateway/server errors should fail fast instead of hanging.
        if (res.status === 404 || res.status === 405) {
          continue;
        }
        return {
          ok: false,
          text: null,
          errorKind: 'http',
          httpStatus: res.status,
          errorMessage: lastErrorMessage,
          elapsedMs: Date.now() - startTs,
          modelUsed: model,
          usedCustomSlot,
        };
      }

      const rawBody = await res.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        lastErrorKind = 'invalid_json';
        lastErrorMessage = `Proxy trả về dữ liệu không phải JSON hợp lệ (${rawBody.slice(0, 100).trim() || 'trống'}).`;
        options?.onLog?.(`${logPrefix} ${lastErrorMessage}`);
        continue;
      }

      const choices = Array.isArray(data?.choices)
        ? (data.choices as Array<{ message?: { content?: unknown } }>)
        : [];
      const candidates = Array.isArray(data?.candidates)
        ? (data.candidates as Array<{
            content?: { parts?: Array<{ text?: unknown }> };
          }>)
        : [];
      const out =
        choices[0]?.message?.content ??
        candidates[0]?.content?.parts?.[0]?.text ??
        data?.content ??
        data?.text ??
        '';

      if (typeof out === 'string' && out.trim()) {
        return {
          ok: true,
          text: out.trim(),
          elapsedMs: Date.now() - startTs,
          modelUsed: model,
          usedCustomSlot,
        };
      }

      lastErrorKind = 'empty';
      lastErrorMessage = `Model (${model}) trả về nội dung rỗng (có thể do bộ lọc an toàn, không hỗ trợ Vision hoặc giới hạn token).`;
      options?.onLog?.(`${logPrefix} ${lastErrorMessage}`);
    } catch (err) {
      if (options?.signal?.aborted) {
        return {
          ok: false,
          text: null,
          errorKind: 'aborted',
          errorMessage: 'Yêu cầu đã bị hủy.',
          elapsedMs: Date.now() - startTs,
          modelUsed: model,
          usedCustomSlot,
        };
      }
      if (timed.didTimeout()) {
        const msg = `Quá thời gian chờ (${Math.round(timeoutMs / 1000)}s) — proxy hoặc model (${model}) phản hồi quá chậm.`;
        options?.onLog?.(`${logPrefix} ${msg}`);
        return {
          ok: false,
          text: null,
          errorKind: 'timeout',
          errorMessage: msg,
          elapsedMs: Date.now() - startTs,
          modelUsed: model,
          usedCustomSlot,
        };
      }
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          ok: false,
          text: null,
          errorKind: 'aborted',
          errorMessage: 'Kết nối đã bị ngắt (AbortError).',
          elapsedMs: Date.now() - startTs,
          modelUsed: model,
          usedCustomSlot,
        };
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      lastErrorKind = 'network';
      lastErrorMessage = `Lỗi mạng / Proxy (${errMsg || 'Failed to fetch'}).`;
      options?.onLog?.(`${logPrefix} ${lastErrorMessage}`);
    } finally {
      timed.cleanup();
    }
  }

  return {
    ok: false,
    text: null,
    errorKind: lastErrorKind,
    errorMessage: lastErrorMessage,
    httpStatus: lastHttpStatus,
    elapsedMs: Date.now() - startTs,
    modelUsed: model,
    usedCustomSlot,
  };
}

export async function callAiJsonOrText(
  state: ArkState,
  promptText: string,
  options?: CallAiJsonOrTextOptions,
): Promise<string | null> {
  const res = await callAiJsonOrTextDetailed(state, promptText, options);
  return res.ok ? res.text : null;
}

function parseAiJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let cleaned = String(raw)
    .replace(/<(thinking|thought|reasoning|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .trim();

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0) {
    cleaned =
      lastBrace > firstBrace
        ? cleaned.slice(firstBrace, lastBrace + 1)
        : cleaned.slice(firstBrace);
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    try {
      const repaired = repairTruncatedJson(cleaned);
      const parsed = JSON.parse(repaired);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

export async function runAiMemorySync(options: {
  state: ArkState;
  turnIndex: number;
  mode: 'memory' | 'state' | 'both';
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  memories?: Omit<MemoryEntry, 'id' | 'pinned' | 'updatedAt'>[];
  states?: Omit<CharacterStateSnapshot, 'id' | 'updatedAt'>[];
  clockUpdate?: {
    elapsedMinutes?: number;
    explicitTime?: string;
    note?: string;
  };
  error?: string;
}> {
  const { state, turnIndex, mode, signal, onLog } = options;
  if (!(state.config.proxyUrl || '').trim()) {
    return {
      ok: false,
      error:
        'Chưa cấu hình Proxy URL. Hãy vào tab Cấu hình để nhập Proxy API trước khi dùng AI Quản lý & Ghi nhớ.',
    };
  }

  const safeIdx = Math.min(Math.max(0, turnIndex), state.turns.length - 1);
  const targetTurn = state.turns[safeIdx];
  if (!targetTurn) {
    return { ok: false, error: 'Chưa có lượt truyện nào để trích xuất.' };
  }

  const cleanUser = stripStoryPlanningAndMeta(targetTurn.user || '');
  const cleanAi = stripStoryPlanningAndMeta(targetTurn.assistant || '');
  if (!cleanUser && !cleanAi) {
    return { ok: false, error: 'Trang truyện hiện tại chưa có nội dung diễn biến.' };
  }

  const activeComp = getStoryBoundCompanionFromState(state);
  const rawMcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    ''
  ).trim();
  const mcName = rawMcName || 'Nhân vật chính';
  const mcPresent = isMcPresentInTurn(
    cleanAi,
    cleanUser,
    rawMcName,
    activeComp?.mc?.pronoun,
  );
  const mcKey = normalizeCharacterKey(rawMcName);
  const knownNpcs = (activeComp?.npcs || [])
    .map((n) => n.name)
    .filter(Boolean)
    .slice(0, 15);

  const existingMemoryTitles = (state.memory?.entries || [])
    .slice(0, 20)
    .map((e) => `- ${e.title}: ${e.content.slice(0, 80)}`)
    .join('\n');

  const existingStatesText = (state.memory?.characterStates || [])
    .slice(0, 12)
    .map(
      (s) =>
        `- ${s.name}${s.isMc ? ' (NV chính)' : ''}: Vị trí=${s.location || '?'} | Tâm trạng=${s.mood || '?'} | Trạng thái=${s.status || '?'}`,
    )
    .join('\n');

  // Include brief previous turn context for continuity when available
  const prevTurn = safeIdx > 0 ? state.turns[safeIdx - 1] : null;
  const prevSceneSnippet = prevTurn
    ? trimToCleanSentence(
        stripStoryPlanningAndMeta(prevTurn.assistant || prevTurn.user || ''),
        360,
      )
    : '';

  const wantMemories = mode === 'memory' || mode === 'both';
  const wantStates = mode === 'state' || mode === 'both';

  const activeClock = normalizeStoryClock(state.memory?.storyClock);
  const activeClockLabel = formatStoryClock(activeClock).fullLabel;

  const schemaHint =
    mode === 'both'
      ? `{"memories":[{"title":"Tiêu đề ngắn","content":"Nội dung cô đọng 1-2 câu","category":"event|relationship|promise|timeline|detail","entities":["Tên NV/địa điểm"],"importance":2}],"states":[{"name":"Tên nhân vật","isMc":false,"location":"Vị trí hiện tại","mood":"Tâm trạng hiện tại","status":"Trạng thái/diễn biến mới nhất"}],"clockUpdate":{"elapsedMinutes":10,"explicitTime":"","note":"lý do ngắn"}}`
      : mode === 'memory'
        ? `{"memories":[{"title":"Tiêu đề ngắn","content":"Nội dung cô đọng 1-2 câu","category":"event|relationship|promise|timeline|detail","entities":["Tên NV/địa điểm"],"importance":2}],"clockUpdate":{"elapsedMinutes":10,"explicitTime":"","note":"lý do ngắn"}}`
        : `{"states":[{"name":"Tên nhân vật","isMc":false,"location":"Vị trí hiện tại","mood":"Tâm trạng hiện tại","status":"Trạng thái/diễn biến mới nhất"}],"clockUpdate":{"elapsedMinutes":10,"explicitTime":"","note":"lý do ngắn"}}`;

  const knownMobNames = (state.portraitBank?.portraits || [])
    .filter(
      (p) =>
        !p.isMc &&
        Boolean(p.name?.trim()) &&
        resolvePortraitRoleTier(p).tier === 'mob',
    )
    .map((p) => p.name.trim())
    .slice(0, 8);

  const systemPrompt =
    'Bạn là trợ lý quản lý trí nhớ dài hạn, trạng thái & dòng thời gian cho truyện nhập vai tiếng Việt. Chỉ trả về DUY NHẤT một đối tượng JSON hợp lệ (không giải thích thêm, không thẻ <thinking>). Tuyệt đối chỉ ghi nhận nhân vật là CON NGƯỜI / THỰC THỂ NHÂN VẬT có mặt VÀ tương tác thực sự / giữ vai trò cụ thể trong cảnh. CHỐT SỰ THẬT VÀO STATE (LỜI NÓI ≠ SỰ THẬT): Lời nói dối, khoe khoang, hứa suông hoặc tuyên bố chưa kiểm chứng trong hội thoại (VD: NPC nói "ta đang giữ tàn phổ" hoặc người chơi nói "ta đã lấy được chìa khóa" khi hành động thực tế chưa diễn ra hoặc chưa xác nhận kết quả) CHỈ là lời nói — TUYỆT ĐỐI KHÔNG ghi nhận như sự thật vật lý, vật phẩm đã sở hữu, tiền bạc đã đổi hay bí mật đã mở khóa; nếu cần ghi nhớ lời nói đó, phải ghi rõ là "tuyên bố / nghi vấn trong thoại". TUYỆT ĐỐI KHÔNG đưa vào "states": lời bài hát/lyric, đoạn rap/4-bar/beat/drop, tên ca khúc/bài hát, câu chửi đùa/cảm thán/tiếng lóng ngắn rời rạc (VD: "Ngu Nè", "Trời Ơi", "Đồ Ngốc", "Yeah Yeah"...), tên gọi trêu đùa/chế tên/biệt danh biến thể của người chơi (VD: gọi Jacob Elordi là "Jacob Elordeep", Timothée Chalamet là "Lil Timmy", Central Cee là "Cench" — bắt buộc quy về tên gốc duy nhất, cấm tách thành NPC riêng), quần chúng/nhân vật nền vô danh (phục vụ, lễ tân, bảo vệ, tài xế, người qua đường, người đàn ông lạ, cô gái lạ, nhân viên hậu trường...), NPC phụ thoáng qua không có tương tác thực sự, NPC trùng vai trò thừa, tên công ty/tổ chức (SM, YG, JYP, HYBE...), địa điểm (Quán cà phê...), màu sắc, kênh giao tiếp ("nhóm chat", tin nhắn...), hay người chỉ xuất hiện qua tin nhắn nhóm chat hoặc bị nhắc thoáng qua. Không bao giờ bịa đặt sự có mặt của Nhân vật chính khi Nhân vật chính vắng mặt.';

  const promptParts = [
    `Phân tích TRANG ${safeIdx + 1} dưới đây bằng tiếng Việt tự nhiên, chính xác.`,
    `Mốc thời gian trong truyện hiện hành (tham chiếu): ${activeClockLabel}.`,
    mcPresent
      ? `Nhân vật chính (MC): ${mcName} (có xuất hiện trong trang này).`
      : `LƯU Ý QUAN TRỌNG VỀ NHÂN VẬT CHÍNH: Nhân vật chính${rawMcName ? ` (${rawMcName})` : ''} KHÔNG XUẤT HIỆN / VẮNG MẶT ở trang này. TUYỆT ĐỐI KHÔNG đưa Nhân vật chính vào mảng "states", KHÔNG bịa đặt vị trí hay hành động của Nhân vật chính tại hiện trường, và KHÔNG gán ghép diễn biến của các NPC với Nhân vật chính.`,
    knownNpcs.length ? `NPC đã biết: ${knownNpcs.join(', ')}.` : '',
    knownMobNames.length
      ? `Nhân vật gắn nhãn [Mob] (nhân vật nền — không cần thêm mới vào states nếu chỉ lướt qua): ${knownMobNames.join(', ')}.`
      : '',
    prevSceneSnippet ? `Bối cảnh trang trước (tham khảo): ${prevSceneSnippet}` : '',
    existingMemoryTitles && wantMemories
      ? `Ký ức dài hạn đã lưu trước đó (tránh lặp lại y hệt, chỉ thêm chi tiết mới hoặc bước ngoặt mới):\n${existingMemoryTitles}`
      : '',
    existingStatesText && wantStates
      ? `Trạng thái nhân vật gần nhất:\n${existingStatesText}`
      : '',
    `--- NỘI DUNG TRANG ${safeIdx + 1} ---`,
    cleanUser ? `[Lượt gọi]: ${trimToCleanSentence(cleanUser, 700)}` : '',
    cleanAi ? `[Diễn biến truyện]: ${trimToCleanSentence(cleanAi, 2600)}` : '',
    '--- YÊU CẦU ---',
    wantMemories
      ? '- "memories": Trích xuất 1–4 mục TRÍ NHỚ DÀI HẠN THỰC SỰ ĐÁNG NHỚ trong trang này: sự kiện quan trọng = "event", mốc phát triển quan hệ = "relationship", lời hứa / giao ước / bí mật / sự thật che giấu = "promise", mốc thời gian/địa điểm mới = "timeline", vật phẩm / chi tiết cốt truyện then chốt = "detail". Ghi rõ "entities" (danh sách tên nhân vật/phe phái/địa điểm liên quan) và "importance" (3 = cốt lõi/lời hứa/bí mật/bước ngoặt lớn, 2 = quan trọng, 1 = bổ trợ). Chỉ ghi nhận đúng sự kiện vật lý/kết quả thực tế đã xác nhận; nếu chỉ là lời nói dối/khoe khoang/tuyên bố suông trong đối thoại thì KHÔNG ghi thành sự thật hay sở hữu vật phẩm; nếu không có gì mới đáng lưu dài hạn, trả mảng rỗng [].'
      : '',
    wantStates
      ? mcPresent
        ? '- "states": CHỈ cập nhật trạng thái của Nhân vật chính (isMc: true) nếu thực sự có mặt và các NPC CON NGƯỜI thực sự có mặt VÀ có tương tác/vai trò cụ thể tại hiện trường (isMc: false). Cập nhật chính xác vị_trí_hiện_tại ("location") theo hành động thực tế; KHÔNG coi lời khoe khoang/nói dối trong thoại là thay đổi vị trí hay sở hữu vật phẩm. NGHIÊM CẤM đưa vào "states": cụm từ từ lời bài hát/lyric/rap/4-bar/beat/drop, tên ca khúc, câu chửi đùa/cảm thán/tiếng lóng ngắn rời rạc (VD: "Ngu Nè", "Trời Ơi"...), tên gọi trêu đùa/chế tên/biệt danh biến thể (VD: "Jacob Elordeep", "Lil Timmy", "Cench" — phải gom về tên nhân vật thật), nhân vật nền vô danh (phục vụ, bảo vệ, lễ tân, tài xế, người qua đường, quần chúng), người chỉ lướt qua không có đối thoại/tác động rõ ràng, công ty/tổ chức (SM, YG...), địa điểm (Quán cà phê...), màu sắc, "nhóm chat"/tin nhắn, hay người chỉ nhắn trong nhóm chat/được nhắc tên thoáng qua.'
        : '- "states": CHỈ cập nhật trạng thái các NPC CON NGƯỜI thực sự có mặt VÀ có tương tác/vai trò cụ thể tại hiện trường (isMc: false). KHÔNG đưa Nhân vật chính vào danh sách này. Cập nhật chính xác vị_trí_hiện_tại ("location") theo hành động thực tế; KHÔNG coi lời khoe khoang/nói dối trong thoại là sự thật. NGHIÊM CẤM đưa cụm từ từ lời bài hát/lyric/rap/4-bar/beat/drop, tên bài hát, câu chửi đùa/cảm thán/tiếng lóng ngắn (VD: "Ngu Nè"...), tên gọi trêu đùa/chế tên/biệt danh biến thể (phải gom về tên gốc), nhân vật nền vô danh (phục vụ, bảo vệ, lễ tân, tài xế, người qua đường), người chỉ lướt qua không có vai trò, công ty/tổ chức (SM, YG...), địa điểm (Quán cà phê...), màu sắc, "nhóm chat", hay người chỉ được nhắc qua nhóm chat/lời kể vào "states".'
      : '',
    '- "clockUpdate": Ước lượng số phút thực tế đã trôi qua trong trang này ("elapsedMinutes": số nguyên >= 2 cho hội thoại/hành động liên tục, hoặc lớn hơn nếu có nhảy thời gian rõ ràng), điền "explicitTime" dạng "HH:mm" CHỈ KHI trong truyện nêu rõ giờ mới, và "note" ngắn gọn 3–6 từ.',
    `Trả về đúng định dạng JSON:\n${schemaHint}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const memModelInfo = resolveModelForTask(state.config, 'utility');
  onLog?.(
    `[AI Memory · ${memModelInfo.model}] Đang trích xuất (${mode}) cho Trang ${safeIdx + 1}...`,
  );
  const rawOut = await callAiJsonOrText(state, promptParts, {
    systemPrompt,
    signal,
    onLog,
    maxTokens: 2048,
    taskSlot: 'utility',
    logPrefix: '[AI Memory]',
  });

  if (!rawOut) {
    return {
      ok: false,
      error:
        'Không nhận được phản hồi từ Proxy API. Kiểm tra lại kết nối và cấu hình Proxy.',
    };
  }

  const parsed = parseAiJsonObject(rawOut);
  if (!parsed) {
    return {
      ok: false,
      error: 'Phản hồi AI không đúng định dạng JSON hợp lệ để trích xuất.',
    };
  }

  const validCats = new Set<MemoryEntryCategory>([
    'event',
    'relationship',
    'promise',
    'timeline',
    'detail',
  ]);
  const allowedRosterForStates = buildAllowedRosterKeys(activeComp, rawMcName);
  const confirmedPortraitsForStates = (state.portraitBank?.portraits || []).filter(
    (p) =>
      !isInvalidNpcPortrait(p, allowedRosterForStates) &&
      !isPortraitAutoScannedUnconfirmed(p),
  );
  const allKnownNames = Array.from(
    new Set(
      [
        ...(mcPresent && rawMcName ? [rawMcName] : []),
        ...knownNpcs,
        ...confirmedPortraitsForStates.map((p) => p.name),
      ].filter(Boolean),
    ),
  );

  const memories: Omit<MemoryEntry, 'id' | 'pinned' | 'updatedAt'>[] = [];
  if (wantMemories && Array.isArray(parsed.memories)) {
    for (const item of parsed.memories) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const title = String(r.title || '').trim();
      const content = String(r.content || '').trim();
      if (!title && !content) continue;
      const rawCat = String(r.category || 'event').toLowerCase() as MemoryEntryCategory;
      const category = validCats.has(rawCat) ? rawCat : 'event';
      const parsedEntities = sanitizeEntityList([
        ...(Array.isArray(r.entities) ? r.entities : []),
        ...detectMentionedEntities(`${title} ${content}`, allKnownNames),
      ]);
      const rawImp = Number(r.importance);
      const importance: 1 | 2 | 3 =
        rawImp === 1 || rawImp === 2 || rawImp === 3
          ? (rawImp as 1 | 2 | 3)
          : category === 'promise' || category === 'relationship'
            ? 3
            : category === 'event'
              ? 2
              : 1;
      const finalTitle = title || content.slice(0, 48);
      const finalContent = content || title;
      memories.push({
        title: finalTitle,
        content: finalContent,
        category,
        turnIndex: safeIdx,
        ...(parsedEntities.length ? { entities: parsedEntities } : {}),
        importance,
        keywords: extractMemoryKeywords(finalTitle, finalContent, parsedEntities),
        source: 'ai',
      });
    }
  }

  const rawStatesList: CharacterStateSnapshot[] = [];
  const existingStateAndPortraitKeys = new Set<string>(allowedRosterForStates);
  for (const p of confirmedPortraitsForStates) {
    const pk = normalizeCharacterKey(p.name || '');
    if (pk) existingStateAndPortraitKeys.add(pk);
  }
  for (const s of state.memory?.characterStates || []) {
    if (isInvalidNpcState(s, allowedRosterForStates)) continue;
    const sk = normalizeCharacterKey(s.name || '');
    if (sk) existingStateAndPortraitKeys.add(sk);
  }
  const rawTurnCombinedForStates = [cleanAi, cleanUser]
    .filter(Boolean)
    .join('\n');
  const sceneOnlyForStates = stripNonSceneChatBlocks(rawTurnCombinedForStates);
  const teasingPairsForStates = extractTeasingNicknamePairsFromText(
    rawTurnCombinedForStates,
  );
  const teasingAliasToCanonicalForStates = new Map<string, string>();
  const standaloneTeasingForStates = new Set<string>();
  for (const pair of teasingPairsForStates) {
    const nickKey = normalizeCharacterKey(pair.nickname);
    if (!nickKey) continue;
    if (pair.canonical) {
      teasingAliasToCanonicalForStates.set(nickKey, pair.canonical);
    } else {
      standaloneTeasingForStates.add(nickKey);
    }
  }
  const canonicalPoolForStates = Array.from(
    new Set(
      [
        ...allKnownNames,
        ...findKnownCelebritiesInText(sceneOnlyForStates).map(
          (c) => c.displayName,
        ),
      ].filter(Boolean),
    ),
  );
  const MAX_NEW_UNPROMPTED_STATES_PER_TURN = 2;
  let addedUnpromptedNewStates = 0;

  if (wantStates && Array.isArray(parsed.states)) {
    for (let idx = 0; idx < parsed.states.length; idx++) {
      const item = parsed.states[idx];
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const rawName = String(r.name || '').trim();
      if (!rawName) continue;
      const itemKey = normalizeCharacterKey(rawName);
      const isItemMc =
        Boolean(r.isMc) ||
        (Boolean(mcKey) && itemKey === mcKey) ||
        itemKey === 'nhan vat chinh' ||
        itemKey === 'nvc' ||
        itemKey === 'mc';
      // Hard guard: never leak MC into State Tracker when MC is absent in this turn
      if (!mcPresent && isItemMc) continue;

      let candidateName = rawName;
      if (!isItemMc) {
        const mappedFromPair = teasingAliasToCanonicalForStates.get(itemKey);
        if (mappedFromPair) {
          candidateName = mappedFromPair;
        } else if (standaloneTeasingForStates.has(itemKey)) {
          continue;
        } else {
          const variantMatch = findCanonicalVariantMatch(
            rawName,
            canonicalPoolForStates,
          );
          if (variantMatch) {
            candidateName = variantMatch;
          } else if (
            isPlayfulTeasingOrParodyName(rawName, allowedRosterForStates)
          ) {
            continue;
          }
        }
      }

      const cleanName = isItemMc
        ? rawMcName || candidateName
        : sanitizeCharacterName(candidateName, allowedRosterForStates);
      if (!cleanName) continue;

      const cleanLocation = sanitizeNpcFieldText(
        'location',
        String(r.location || '').trim(),
      );
      const cleanMood = sanitizeNpcFieldText(
        'mood',
        String(r.mood || '').trim(),
      );
      const cleanStatus = sanitizeNpcFieldText(
        'status',
        String(r.status || '').trim(),
      );

      const candidateSnapshot: CharacterStateSnapshot = {
        id: `ai_st_${idx}`,
        name: cleanName,
        isMc: isItemMc,
        location: cleanLocation,
        mood: cleanMood,
        status: cleanStatus,
        lastTurnIndex: safeIdx,
        updatedAt: Date.now() + idx,
      };

      if (
        !isItemMc &&
        isInvalidNpcState(candidateSnapshot, allowedRosterForStates)
      ) {
        continue;
      }

      // Require direct in-scene presence for non-MC NPCs (excludes chat-only, passing mentions & passive extras)
      if (!isItemMc && sceneOnlyForStates.trim().length > 0) {
        if (isCharacterExplicitlyAbsent(sceneOnlyForStates, cleanName, false)) {
          continue;
        }
        const directClean = analyzeCharacterDirectPresence(
          sceneOnlyForStates,
          cleanName,
          { allowHonorificShortName: true },
        ).directCount;
        const directRaw =
          rawName !== cleanName
            ? analyzeCharacterDirectPresence(sceneOnlyForStates, rawName, {
                allowHonorificShortName: true,
              }).directCount
            : 0;
        if (directClean === 0 && directRaw === 0) {
          continue;
        }

        const cleanKey = normalizeCharacterKey(cleanName);
        const isKnownCharacter =
          existingStateAndPortraitKeys.has(cleanKey) ||
          Boolean(matchPortraitByName(cleanName, confirmedPortraitsForStates));

        if (!isKnownCharacter) {
          if (
            isGenericUnnamedFillerNpcName(cleanName, allowedRosterForStates) ||
            isPlayfulTeasingOrParodyName(cleanName, allowedRosterForStates)
          ) {
            continue;
          }
          const engagement = evaluateCharacterSceneEngagement(
            sceneOnlyForStates,
            cleanName,
            cleanUser,
          );
          if (!engagement.qualifiesAsNewNpc) {
            continue;
          }
          if (
            !engagement.mentionedByUser &&
            addedUnpromptedNewStates >= MAX_NEW_UNPROMPTED_STATES_PER_TURN
          ) {
            continue;
          }
          if (!engagement.mentionedByUser) {
            addedUnpromptedNewStates += 1;
          }
        }
      }

      rawStatesList.push(candidateSnapshot);
    }
  }

  const dedupedStateSnapshots = cleanAndDeduplicateCharacterStates(
    rawStatesList,
    {
      comp: activeComp,
      fallbackMcName: rawMcName,
      knownValidNames: allKnownNames,
    },
  ).states;

  const states: Omit<CharacterStateSnapshot, 'id' | 'updatedAt'>[] =
    dedupedStateSnapshots.map((s) => ({
      name: s.name,
      isMc: s.isMc,
      location: s.location,
      mood: s.mood,
      status: s.status,
      lastTurnIndex: s.lastTurnIndex,
    }));

  let clockUpdate:
    | { elapsedMinutes?: number; explicitTime?: string; note?: string }
    | undefined;
  if (parsed.clockUpdate && typeof parsed.clockUpdate === 'object') {
    const cu = parsed.clockUpdate as Record<string, unknown>;
    const elapsedRaw = Number(cu.elapsedMinutes);
    const explicitTime =
      typeof cu.explicitTime === 'string' ? cu.explicitTime.trim() : '';
    const note = typeof cu.note === 'string' ? cu.note.trim() : '';
    if (
      (Number.isFinite(elapsedRaw) && elapsedRaw >= 1) ||
      /^([01]?\d|2[0-3]):([0-5]\d)$/.test(explicitTime)
    ) {
      clockUpdate = {
        ...(Number.isFinite(elapsedRaw) && elapsedRaw >= 1
          ? { elapsedMinutes: Math.round(elapsedRaw) }
          : {}),
        ...(explicitTime ? { explicitTime } : {}),
        ...(note ? { note } : {}),
      };
    }
  }

  onLog?.(
    `[AI Memory] Hoàn tất Trang ${safeIdx + 1}: ${memories.length} ký ức, ${states.length} trạng thái.`,
  );
  return { ok: true, memories, states, clockUpdate };
}

export async function runRollingSummaryUpdate(options: {
  state: ArkState;
  forceAllOlder?: boolean;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  content?: string;
  summarizedUpToTurn?: number;
  error?: string;
}> {
  const { state, forceAllOlder = false, signal, onLog } = options;
  if (!(state.config.proxyUrl || '').trim()) {
    return {
      ok: false,
      error:
        'Chưa cấu hình Proxy URL. Hãy vào tab Cấu hình để nhập Proxy API trước khi tóm tắt ngữ cảnh.',
    };
  }

  const historyWindow = Math.max(1, state.context?.historyTurns || 12);
  const cutoff = Math.max(0, state.turns.length - historyWindow);
  if (cutoff <= 0) {
    return {
      ok: false,
      error: `Số lượt hiện tại (${state.turns.length}) chưa vượt ngưỡng cửa sổ lịch sử (${historyWindow} lượt).`,
    };
  }

  const existingUpTo = forceAllOlder
    ? 0
    : Math.min(state.memory?.rollingSummary?.summarizedUpToTurn || 0, cutoff);
  const existingSummary = forceAllOlder
    ? ''
    : (state.memory?.rollingSummary?.content || '').trim();

  if (!forceAllOlder && existingUpTo >= cutoff && existingSummary) {
    return {
      ok: true,
      content: existingSummary,
      summarizedUpToTurn: cutoff,
    };
  }

  const turnsToFold: string[] = [];
  for (let i = existingUpTo; i < cutoff; i++) {
    const t = state.turns[i];
    if (!t) continue;
    const u = trimToCleanSentence(stripStoryPlanningAndMeta(t.user || ''), 240);
    const a = trimToCleanSentence(
      stripStoryPlanningAndMeta(t.assistant || ''),
      520,
    );
    if (!u && !a) continue;
    turnsToFold.push(
      `[Trang ${i + 1}]${u ? `\nNgười chơi: ${u}` : ''}${a ? `\nDiễn biến: ${a}` : ''}`,
    );
  }

  if (!turnsToFold.length) {
    return {
      ok: false,
      error: 'Không có nội dung mới ở các lượt cũ cần tóm tắt.',
    };
  }

  const systemPrompt =
    'Bạn là biên tập viên tóm tắt cốt truyện tiếng Việt cho truyện nhập vai dài kỳ. Chỉ trả về văn bản tóm tắt cô đọng, rõ mạch thời gian, giữ nguyên tên nhân vật, mối quan hệ, bí mật và nút thắt chưa giải quyết. Không viết lời mở đầu hay thẻ <thinking>.';

  const promptText = [
    existingSummary
      ? `--- TÓM TẮT HIỆN CÓ (Trang 1–${existingUpTo}) ---\n${existingSummary}`
      : '',
    `--- CÁC LƯỢT CŨ CẦN GỘP THÊM (Trang ${existingUpTo + 1}–${cutoff}) ---\n${turnsToFold.join('\n\n')}`,
    '--- YÊU CẦU ---',
    'Hãy gộp và viết lại thành 1 bản tóm tắt mạch truyện liền mạch bằng tiếng Việt (khoảng 180–380 từ, chia gạch đầu dòng ngắn gọn theo tiến trình nếu cần). Giữ lại mọi sự kiện bước ngoặt, thay đổi quan hệ, địa điểm, vật phẩm và nút thắt đang mở; bỏ miêu tả rườm rà.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const summaryModelInfo = resolveModelForTask(state.config, 'utility');
  onLog?.(
    `[Rolling Summary · ${summaryModelInfo.model}] Đang tóm tắt các lượt cũ (Trang ${existingUpTo + 1}–${cutoff})...`,
  );
  const rawOut = await callAiJsonOrText(state, promptText, {
    systemPrompt,
    signal,
    onLog,
    maxTokens: 2048,
    taskSlot: 'utility',
    logPrefix: '[Rolling Summary]',
  });

  if (!rawOut) {
    return {
      ok: false,
      error:
        'Không nhận được phản hồi từ Proxy API khi tạo bản tóm tắt ngữ cảnh.',
    };
  }

  const cleaned = String(rawOut ?? '')
    .replace(/<(thinking|thought|reasoning|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .trim();

  if (!cleaned) {
    return { ok: false, error: 'Bản tóm tắt trả về bị rỗng.' };
  }

  onLog?.(`[Rolling Summary] Đã tổng hợp xong tới hết Trang ${cutoff}.`);
  return {
    ok: true,
    content: cleaned,
    summarizedUpToTurn: cutoff,
  };
}

export const SEEDREAM_REQUEST_TIMEOUT_MS = 180_000;
export const AVATAR_SEEDREAM_TIMEOUT_MS = 120_000;
export const AVATAR_COMFYUI_TIMEOUT_MS = 240_000;

export function createTimedAbortSignal(
  parentSignal?: AbortSignal,
  timeoutMs = SEEDREAM_REQUEST_TIMEOUT_MS,
): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;

  const onParentAbort = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const timerId =
    timeoutMs > 0
      ? globalThis.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      if (timerId !== null) {
        globalThis.clearTimeout(timerId);
      }
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    },
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () =>
      reject(reader.error || new Error('Không thể đọc dữ liệu ảnh nhị phân.'));
    reader.onabort = () => reject(new Error('Đọc dữ liệu ảnh đã bị hủy.'));
    reader.readAsDataURL(blob);
  });
}

// Seedream 5 Pro helpers
export function buildSeedreamEndpoints(rawUrl: string): string[] {
  const rawClean = String(rawUrl ?? '').trim().replace(/\/+$/, '');
  if (!rawClean) return [];
  if (/\/images\/generations$/i.test(rawClean)) return [rawClean];

  // If user fell back to a chat/models proxy URL (e.g. .../v1/chat/completions), normalize to base first
  const strippedChat = rawClean
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/responses$/i, '')
    .replace(/\/models$/i, '')
    .replace(/\/+$/, '');

  const base = strippedChat || rawClean;
  if (/\/images\/generations$/i.test(base)) return [base];
  if (/\/images$/i.test(base)) {
    return Array.from(new Set([`${base}/generations`, base]));
  }
  // Support any versioned API base such as /v1, /v2, /v3, /api/v3 (e.g. BytePlus / Volcengine Ark)
  if (/\/v\d+$/i.test(base)) {
    return [`${base}/images/generations`];
  }

  const candidates = [
    `${base}/v1/images/generations`,
    `${base}/images/generations`,
  ];
  if (base === rawClean) {
    candidates.push(rawClean);
  }
  return Array.from(new Set(candidates));
}

export function buildSeedreamModelEndpoints(rawUrl: string): string[] {
  const clean = String(rawUrl ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/images\/generations$/i, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/responses$/i, '')
    .replace(/\/models$/i, '')
    .replace(/\/+$/, '');
  if (!clean) return [];
  if (/\/v\d+$/i.test(clean)) {
    return [`${clean}/models`];
  }
  return [`${clean}/v1/models`, `${clean}/models`];
}

export function extractSeedreamErrorMessage(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const rec = json as Record<string, unknown>;
  if (typeof rec.error === 'string' && rec.error.trim()) {
    return rec.error.trim();
  }
  if (rec.error && typeof rec.error === 'object') {
    const errObj = rec.error as Record<string, unknown>;
    if (typeof errObj.message === 'string' && errObj.message.trim()) {
      return errObj.message.trim();
    }
    if (typeof errObj.detail === 'string' && errObj.detail.trim()) {
      return errObj.detail.trim();
    }
  }
  if (typeof rec.message === 'string' && rec.message.trim()) {
    return rec.message.trim();
  }
  if (typeof rec.detail === 'string' && rec.detail.trim()) {
    return rec.detail.trim();
  }
  return '';
}

function resolveMaybeRelativeImageUrl(raw: string, baseOriginUrl?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (baseOriginUrl && (trimmed.startsWith('/') || /^images?\//i.test(trimmed) || /^outputs?\//i.test(trimmed))) {
    try {
      return new URL(trimmed, baseOriginUrl).toString();
    } catch {
      return '';
    }
  }
  return '';
}

function normalizeImageValue(val: unknown, baseOriginUrl?: string): string {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    const resolvedDirect = resolveMaybeRelativeImageUrl(trimmed, baseOriginUrl);
    if (resolvedDirect) return resolvedDirect;
    // Markdown image syntax returned by chat-compatible image proxies
    const mdMatch = /!\[[^\]]*\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/i.exec(
      trimmed,
    );
    if (mdMatch?.[1]) return mdMatch[1];
    // Raw base64 payload (no whitespace, long)
    if (trimmed.length > 100 && !/\s/.test(trimmed) && /^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
      return `data:image/png;base64,${trimmed}`;
    }
    return '';
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      const found = normalizeImageValue(item, baseOriginUrl);
      if (found) return found;
    }
    return '';
  }
  if (val && typeof val === 'object') {
    const f = val as Record<string, unknown>;
    const stringUrlKeys = ['url', 'image_url', 'img_url', 'src', 'uri', 'href'] as const;
    for (const k of stringUrlKeys) {
      const candidate = f[k];
      if (typeof candidate === 'string' && candidate.trim()) {
        const resolved = resolveMaybeRelativeImageUrl(candidate, baseOriginUrl);
        if (resolved) return resolved;
      }
    }
    if (f.image_url && typeof f.image_url === 'object') {
      const nestedUrl = (f.image_url as Record<string, unknown>).url;
      if (typeof nestedUrl === 'string' && nestedUrl.trim()) {
        const resolved = resolveMaybeRelativeImageUrl(nestedUrl, baseOriginUrl);
        if (resolved) return resolved;
      }
    }
    const b64Keys = ['b64_json', 'base64', 'image_base64', 'img_base64'] as const;
    for (const k of b64Keys) {
      const rawB64 = f[k];
      if (typeof rawB64 === 'string' && rawB64.trim()) {
        const cleaned = rawB64.trim();
        return cleaned.startsWith('data:')
          ? cleaned
          : `data:image/png;base64,${cleaned}`;
      }
    }
    for (const nestedKey of ['image', 'img', 'output', 'result'] as const) {
      if (f[nestedKey] !== undefined && f[nestedKey] !== null) {
        const nestedFound = normalizeImageValue(f[nestedKey], baseOriginUrl);
        if (nestedFound) return nestedFound;
      }
    }
  }
  return '';
}

export function extractImageFromSeedreamResponse(
  json: unknown,
  baseOriginUrl?: string,
): string {
  if (typeof json === 'string') {
    return normalizeImageValue(json, baseOriginUrl);
  }
  if (Array.isArray(json)) {
    return normalizeImageValue(json, baseOriginUrl);
  }
  if (!json || typeof json !== 'object') return '';
  const rec = json as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (Array.isArray(rec.data)) candidates.push(...rec.data);
  else if (rec.data) candidates.push(rec.data);

  if (Array.isArray(rec.images)) candidates.push(...rec.images);
  else if (rec.images) candidates.push(rec.images);

  if (Array.isArray(rec.artifacts)) candidates.push(...rec.artifacts);

  if (Array.isArray(rec.output)) candidates.push(...rec.output);
  else if (rec.output) candidates.push(rec.output);

  if (Array.isArray(rec.result)) candidates.push(...rec.result);
  else if (rec.result) candidates.push(rec.result);

  if (rec.image !== undefined) candidates.push(rec.image);
  if (rec.image_url !== undefined) candidates.push(rec.image_url);
  if (rec.url !== undefined) candidates.push(rec.url);
  if (rec.b64_json !== undefined) candidates.push({ b64_json: rec.b64_json });
  if (rec.base64 !== undefined) candidates.push({ base64: rec.base64 });

  if (Array.isArray(rec.choices)) {
    for (const ch of rec.choices) {
      if (ch && typeof ch === 'object') {
        const msg = (ch as Record<string, unknown>).message as
          | Record<string, unknown>
          | undefined;
        if (msg) {
          if (Array.isArray(msg.images)) candidates.push(...msg.images);
          if (msg.content) candidates.push(msg.content);
        }
      }
    }
  }
  candidates.push(rec);

  for (const item of candidates) {
    const found = normalizeImageValue(item, baseOriginUrl);
    if (found) return found;
  }
  return '';
}

export function formatSeedreamFetchError(url: string, err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const isHttpsToHttp =
    typeof location !== 'undefined' &&
    /^https:/i.test(location.protocol) &&
    /^http:/i.test(url);
  const hints: string[] = [];
  if (isHttpsToHttp) hints.push('Mixed Content (trang HTTPS gọi endpoint HTTP)');
  hints.push(
    'có thể do chặn CORS từ trình duyệt, sai tên miền/DNS, hoặc server từ chối kết nối',
  );
  return `Lỗi gọi ${url}: ${rawMsg} (${hints.join('; ')}).`;
}

export async function requestSeedreamImage(options: {
  endpointRaw: string;
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  usingProxyFallback?: boolean;
  useServerProxy?: boolean;
  logPrefix?: string;
  onLog?: (line: string) => void;
  onProgress?: (label: string) => void;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  usedUrl?: string;
  error?: string;
  aborted?: boolean;
  timedOut?: boolean;
}> {
  const {
    endpointRaw,
    apiKey,
    model,
    prompt,
    size,
    signal,
    timeoutMs = SEEDREAM_REQUEST_TIMEOUT_MS,
    usingProxyFallback = false,
    useServerProxy = true,
    logPrefix = '',
    onLog,
    onProgress,
  } = options;

  const log = (msg: string) => {
    onLog?.(logPrefix ? `${logPrefix} ${msg}` : msg);
  };

  if (!endpointRaw.trim()) {
    return {
      ok: false,
      error:
        'Chưa cấu hình Seedream 5 Pro Endpoint. Hãy vào tab Cấu hình để nhập Endpoint tạo ảnh.',
    };
  }

  const endpoints = buildSeedreamEndpoints(endpointRaw);
  if (!endpoints.length) {
    return {
      ok: false,
      error: 'Endpoint Seedream 5 Pro không hợp lệ.',
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    headers['x-api-key'] = apiKey.trim();
  }

  if (usingProxyFallback) {
    log(
      `Lưu ý: Seedream Endpoint đang trống, đang dùng tạm Proxy URL chat (${endpointRaw}).`,
    );
  }

  let lastErr = '';
  let hadTimeout = false;
  const overallDeadline = Date.now() + Math.max(15_000, timeoutMs);

  for (let urlIdx = 0; urlIdx < endpoints.length; urlIdx++) {
    const url = endpoints[urlIdx];
    if (signal?.aborted) {
      return { ok: false, aborted: true };
    }
    const remainingBudgetMs = overallDeadline - Date.now();
    if (urlIdx > 0 && remainingBudgetMs < 8_000) {
      break;
    }

    // Omit response_format on the first attempt so proxies/providers return their
    // fastest native format (url or b64_json) without stalling on server-side conversion.
    // If a server explicitly requires response_format (HTTP 400), retry once with 'url'.
    const attempts: Array<{ includeResponseFormat: boolean }> = [
      { includeResponseFormat: false },
    ];

    // Keep total wait across fallback candidates strictly bounded within timeoutMs
    const effectiveTimeoutMs =
      urlIdx > 0
        ? Math.max(10_000, Math.min(timeoutMs, remainingBudgetMs))
        : timeoutMs;

    for (let attemptIdx = 0; attemptIdx < attempts.length; attemptIdx++) {
      if (signal?.aborted) {
        return { ok: false, aborted: true };
      }

      const { includeResponseFormat } = attempts[attemptIdx];
      const timed = createTimedAbortSignal(signal, effectiveTimeoutMs);
      const startedAt = Date.now();
      try {
        const payload: Record<string, unknown> = {
          model,
          prompt,
          size,
          n: 1,
        };
        if (includeResponseFormat) {
          payload.response_format = 'url';
        }

        onProgress?.(
          urlIdx === 0
            ? `Đang gửi yêu cầu tới Seedream (${model})...`
            : `Đang thử endpoint dự phòng ${urlIdx + 1}/${endpoints.length}...`,
        );

        log(
          `POST ${url} (model=${model}, size=${size}, prompt=${prompt.length} ký tự${
            includeResponseFormat ? ', response_format=url' : ''
          })`,
        );

        const res = await fetchProxyTarget({
          url,
          method: 'POST',
          headers,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: timed.signal,
          body: payload,
          useServerProxy,
        });

        const elapsedSec = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000),
        );

        if (!res.ok) {
          const errTxt = await res.text().catch(() => '');
          let parsedErr = '';
          try {
            parsedErr = extractSeedreamErrorMessage(JSON.parse(errTxt));
          } catch {
            // plain text / html body
          }
          const detail = String(parsedErr || errTxt || '').replace(/\s+/g, ' ').trim();
          lastErr = `HTTP ${res.status} tại ${url} (${elapsedSec}s)${
            detail ? `: ${detail.slice(0, 220)}` : ''
          }`;
          log(lastErr);

          // If endpoint requires response_format field with 400, retry once with 'url'
          if (
            !includeResponseFormat &&
            res.status === 400 &&
            /response_format/i.test(detail) &&
            attempts.length === 1
          ) {
            attempts.push({ includeResponseFormat: true });
            continue;
          }

          // Only try the next candidate URL path if this route genuinely does not exist (404/405).
          // NEVER fire another POST to an alternate URL after 5xx/400/422/429/timeout where the server
          // may already have queued or rendered an image.
          if (res.status !== 404 && res.status !== 405) {
            return { ok: false, error: lastErr };
          }
          break;
        }

        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('image/')) {
          const blob = await res.blob();
          const dataUrl = await blobToDataUrl(blob);
          if (!dataUrl) {
            lastErr = `Dữ liệu ảnh nhị phân rỗng từ ${url}`;
            log(lastErr);
            return { ok: false, error: lastErr };
          }
          log(`Nhận ảnh nhị phân thành công từ ${url} (${elapsedSec}s).`);
          return { ok: true, imageUrl: dataUrl, usedUrl: url };
        }

        const rawText = await res.text();
        let json: unknown;
        try {
          json = JSON.parse(rawText);
        } catch {
          const snippet = String(rawText ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
          lastErr = `Phản hồi không phải JSON ảnh hợp lệ từ ${url}${
            snippet ? ` (${snippet})` : ''
          }`;
          log(lastErr);
          return { ok: false, error: lastErr };
        }

        const imgSrc = extractImageFromSeedreamResponse(json);
        if (!imgSrc) {
          const apiErr = extractSeedreamErrorMessage(json);
          lastErr = apiErr
            ? `Máy chủ ảnh báo lỗi tại ${url}: ${apiErr.slice(0, 220)}`
            : `Phản hồi không chứa url/base64 ảnh hợp lệ từ ${url}`;
          log(lastErr);
          return { ok: false, error: lastErr };
        }

        log(`Nhận ảnh thành công từ ${url} (${elapsedSec}s).`);
        return { ok: true, imageUrl: imgSrc, usedUrl: url };
      } catch (err) {
        if (signal?.aborted) {
          return { ok: false, aborted: true };
        }
        if (timed.didTimeout()) {
          hadTimeout = true;
          const elapsedSec = Math.max(
            1,
            Math.round((Date.now() - startedAt) / 1000),
          );
          const fallbackNote = usingProxyFallback
            ? ' (Đang dùng tạm Proxy URL chat vì Seedream Endpoint đang trống trong Cấu hình)'
            : '';
          lastErr = `Quá thời gian chờ (${elapsedSec}s) khi gọi ${url} [model=${model}, size=${size}, prompt=${prompt.length} ký tự].${fallbackNote}`;
          log(lastErr);
          return { ok: false, timedOut: true, error: lastErr };
        }
        if (err instanceof Error && err.name === 'AbortError') {
          return { ok: false, aborted: true };
        }
        lastErr = formatSeedreamFetchError(url, err);
        log(lastErr);
        return { ok: false, error: lastErr };
      } finally {
        timed.cleanup();
      }
    }
  }

  return {
    ok: false,
    timedOut: hadTimeout,
    error:
      lastErr ||
      'Không thể sinh ảnh từ Seedream 5 Pro. Hãy kiểm tra Endpoint, Model và API Key trong Cấu hình.',
  };
}

// ============================================================================
// Custom External Image API Endpoint Helpers (OpenAI Images / Custom JSON)
// ============================================================================

export const CUSTOM_IMAGE_REQUEST_TIMEOUT_MS = 180_000;

export const DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE = `{
  "prompt": "{{prompt}}",
  "negative_prompt": "{{negative_prompt}}",
  "width": 832,
  "height": 1216
}`;

export function normalizeCustomImageEndpointUrl(rawUrl: string): string {
  const trimmed = String(rawUrl ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

export function buildCustomImageEndpoints(
  rawUrl: string,
  formatMode: CustomImageFormatMode = 'openai',
): string[] {
  const clean = normalizeCustomImageEndpointUrl(rawUrl);
  if (!clean) return [];
  if (formatMode === 'custom_json') {
    return [clean];
  }
  if (/\/images\/generations$/i.test(clean)) {
    return [clean];
  }
  try {
    const parsed = new URL(clean);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') {
      return [`${clean}/v1/images/generations`, `${clean}/images/generations`, clean];
    }
    if (/\/v\d+$/i.test(pathname)) {
      return [`${clean}/images/generations`, clean];
    }
    if (/\/images$/i.test(pathname)) {
      return [`${clean}/generations`, clean];
    }
    // User provided a specific endpoint path (e.g. https://latent.moe/api/generate): call exact URL first
    return [clean, `${clean}/v1/images/generations`];
  } catch {
    return [clean];
  }
}

export function buildCustomImageAuthHeaders(
  apiKeyRaw?: string,
  authHeaderRaw?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, image/*, */*;q=0.8',
  };
  const key = String(apiKeyRaw ?? '').trim();
  if (!key) {
    return headers;
  }
  const cleanHeaderName = String(authHeaderRaw ?? '')
    .trim()
    .replace(/[\r\n:]/g, '');
  const headerName =
    cleanHeaderName && /^[a-z0-9-]+$/i.test(cleanHeaderName)
      ? cleanHeaderName
      : 'Authorization';
  if (headerName.toLowerCase() === 'authorization') {
    headers.Authorization = /^(bearer|basic|token)\s+/i.test(key)
      ? key
      : `Bearer ${key}`;
  } else {
    headers[headerName] = key;
  }
  return headers;
}

export function renderCustomImageJsonPayload(
  templateRaw: string,
  vars: {
    prompt: string;
    negativePrompt?: string;
    model?: string;
    size?: string;
    width?: number;
    height?: number;
    seed?: number;
  },
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const source = String(templateRaw ?? '').trim() || DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE;
  const width = Math.max(64, Math.round(Number(vars.width) || 1024));
  const height = Math.max(64, Math.round(Number(vars.height) || 1024));
  const seed = Number.isFinite(vars.seed)
    ? Math.floor(Number(vars.seed))
    : Math.floor(Math.random() * 2_147_483_647);
  const sizeStr = String(vars.size || `${width}x${height}`).trim() || `${width}x${height}`;

  // Allow unquoted numeric placeholders like `"width": {{width}}` before JSON.parse
  const preNumeric = source.replace(
    /([:,[\s])\{\{(width|height|seed)\}\}(?=\s*[,\]}])/gi,
    (_m, prefix: string, token: string) => {
      const lower = token.toLowerCase();
      if (lower === 'width') return `${prefix}${width}`;
      if (lower === 'height') return `${prefix}${height}`;
      return `${prefix}${seed}`;
    },
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(preNumeric);
  } catch (err) {
    return {
      ok: false,
      error: `Custom JSON Payload không đúng cú pháp JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'Custom JSON Payload phải là một JSON Object ({ ... }).',
    };
  }

  const stringTokenValues: Record<string, string> = {
    prompt: vars.prompt || '',
    negative_prompt: vars.negativePrompt || '',
    model: vars.model || '',
    size: sizeStr,
    width: String(width),
    height: String(height),
    seed: String(seed),
  };

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return node.replace(
        /\{\{\s*(prompt|negative_prompt|model|size|width|height|seed)\s*\}\}/gi,
        (_m, key: string) => stringTokenValues[key.toLowerCase()] ?? '',
      );
    }
    if (Array.isArray(node)) {
      return node.map((item) => walk(item));
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };

  const rendered = walk(parsed) as Record<string, unknown>;
  // If user left model empty in template `"model": "{{model}}"`, omit empty model key cleanly
  if (typeof rendered.model === 'string' && !rendered.model.trim()) {
    delete rendered.model;
  }
  return { ok: true, payload: rendered };
}

async function hydrateRemoteImageViaProxyIfHelpful(options: {
  imageUrl: string;
  useServerProxy: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const { imageUrl, useServerProxy, signal } = options;
  if (!useServerProxy || !/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  const timed = createTimedAbortSignal(signal, 25_000);
  try {
    const res = await fetchProxyTarget({
      url: imageUrl,
      method: 'GET',
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
      signal: timed.signal,
      useServerProxy: true,
    });
    if (!res.ok) return imageUrl;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('image/')) return imageUrl;
    const blob = await res.blob();
    if (!blob || blob.size === 0 || blob.size > 15 * 1024 * 1024) {
      return imageUrl;
    }
    const dataUrl = await blobToDataUrl(blob);
    return dataUrl || imageUrl;
  } catch {
    return imageUrl;
  } finally {
    timed.cleanup();
  }
}

export async function requestCustomImage(options: {
  endpointRaw: string;
  apiKey?: string;
  authHeader?: string;
  model?: string;
  formatMode?: CustomImageFormatMode;
  jsonTemplate?: string;
  prompt: string;
  negativePrompt?: string;
  size?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  useServerProxy?: boolean;
  logPrefix?: string;
  onLog?: (line: string) => void;
  onProgress?: (label: string) => void;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  usedUrl?: string;
  statusCode?: number;
  responsePreview?: string;
  error?: string;
  aborted?: boolean;
  timedOut?: boolean;
}> {
  const {
    endpointRaw,
    apiKey = '',
    authHeader = 'Authorization',
    model = '',
    formatMode = 'openai',
    jsonTemplate = DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE,
    prompt,
    negativePrompt = '',
    size = '1024x1024',
    signal,
    timeoutMs = CUSTOM_IMAGE_REQUEST_TIMEOUT_MS,
    useServerProxy = true,
    logPrefix = '[Custom Image API]',
    onLog,
    onProgress,
  } = options;

  const log = (msg: string) => {
    onLog?.(logPrefix ? `${logPrefix} ${msg}` : msg);
  };

  const normalizedUrl = normalizeCustomImageEndpointUrl(endpointRaw);
  if (!normalizedUrl || !/^https?:\/\//i.test(normalizedUrl)) {
    return {
      ok: false,
      error:
        'Image Endpoint URL không hợp lệ. Vui lòng nhập URL đầy đủ bắt đầu bằng http:// hoặc https://.',
    };
  }

  const endpoints = buildCustomImageEndpoints(normalizedUrl, formatMode);
  if (!endpoints.length) {
    return {
      ok: false,
      error: 'Không xác định được URL đích từ Image Endpoint đã nhập.',
    };
  }

  const cleanModel = String(model ?? '').trim();
  const cleanSize = String(size ?? '').trim() || '1024x1024';
  const dims = parseImageDimensions(cleanSize) ?? { width: 1024, height: 1024 };
  const headers = buildCustomImageAuthHeaders(apiKey, authHeader);

  let customJsonPayload: Record<string, unknown> | undefined;
  if (formatMode === 'custom_json') {
    const rendered = renderCustomImageJsonPayload(jsonTemplate, {
      prompt,
      negativePrompt,
      model: cleanModel,
      size: cleanSize,
      width: dims.width,
      height: dims.height,
    });
    if (!rendered.ok) {
      log(rendered.error);
      return { ok: false, error: rendered.error };
    }
    customJsonPayload = rendered.payload;
  }

  let lastErr = '';
  let lastStatus: number | undefined;
  let lastPreview = '';
  let hadTimeout = false;
  const overallDeadline = Date.now() + Math.max(15_000, timeoutMs);

  for (let idx = 0; idx < endpoints.length; idx += 1) {
    const url = endpoints[idx];
    if (signal?.aborted) {
      return { ok: false, aborted: true };
    }
    const remainingBudgetMs = overallDeadline - Date.now();
    if (idx > 0 && remainingBudgetMs < 8_000) {
      break;
    }

    const effectiveTimeoutMs =
      idx > 0
        ? Math.max(10_000, Math.min(timeoutMs, remainingBudgetMs))
        : timeoutMs;
    const timed = createTimedAbortSignal(signal, effectiveTimeoutMs);
    const startedAt = Date.now();

    try {
      const payload: Record<string, unknown> =
        formatMode === 'custom_json' && customJsonPayload
          ? customJsonPayload
          : {
              ...(cleanModel ? { model: cleanModel } : {}),
              prompt,
              n: 1,
              size: cleanSize,
            };

      onProgress?.(
        `Đang gọi Custom Image API${cleanModel ? ` (${cleanModel})` : ''}...`,
      );
      log(
        `POST ${url} (${useServerProxy ? 'Server Proxy /api/proxy' : 'Direct Fetch'} · mode=${
          formatMode === 'custom_json' ? 'Custom JSON' : 'OpenAI Images'
        }${cleanModel ? ` · model=${cleanModel}` : ''})`,
      );

      const res = await fetchProxyTarget({
        url,
        method: 'POST',
        headers,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: timed.signal,
        body: payload,
        useServerProxy,
      });

      lastStatus = res.status;
      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 1000),
      );

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        let parsedErr = '';
        try {
          parsedErr = extractSeedreamErrorMessage(JSON.parse(errTxt));
        } catch {
          // non-JSON response
        }
        const rawSnippet = String(errTxt || '').replace(/\s+/g, ' ').trim();
        lastPreview = rawSnippet.slice(0, 320);
        const detail = (parsedErr || rawSnippet).slice(0, 260);
        lastErr = `HTTP ${res.status} tại ${url} (${elapsedSec}s)${
          detail ? `: ${detail}` : ''
        }`;
        log(lastErr);

        if (res.status !== 404 && res.status !== 405) {
          return {
            ok: false,
            usedUrl: url,
            statusCode: res.status,
            responsePreview: lastPreview,
            error: lastErr,
          };
        }
        continue;
      }

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('image/')) {
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        if (!dataUrl) {
          lastErr = `Dữ liệu ảnh nhị phân rỗng từ ${url}`;
          log(lastErr);
          return { ok: false, usedUrl: url, statusCode: res.status, error: lastErr };
        }
        log(`Nhận ảnh nhị phân (${ct}) thành công từ ${url} (${elapsedSec}s).`);
        return { ok: true, imageUrl: dataUrl, usedUrl: url, statusCode: res.status };
      }

      const rawText = await res.text();
      lastPreview = String(rawText ?? '').replace(/\s+/g, ' ').trim().slice(0, 320);
      let parsedBody: unknown = rawText;
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        // Handle plain-text URL / data:image / base64 payloads directly
      }

      const extracted = extractImageFromSeedreamResponse(parsedBody, url);
      if (!extracted) {
        const apiErr = extractSeedreamErrorMessage(parsedBody);
        lastErr = apiErr
          ? `Endpoint báo lỗi tại ${url} (HTTP ${res.status}): ${apiErr.slice(0, 240)}`
          : `HTTP ${res.status} tại ${url} nhưng không tìm thấy URL/base64 ảnh trong phản hồi${
              lastPreview ? `: ${lastPreview.slice(0, 200)}` : ''
            }`;
        log(lastErr);
        return {
          ok: false,
          usedUrl: url,
          statusCode: res.status,
          responsePreview: lastPreview,
          error: lastErr,
        };
      }

      const finalImageUrl = await hydrateRemoteImageViaProxyIfHelpful({
        imageUrl: extracted,
        useServerProxy,
        signal,
      });

      log(`Nhận ảnh thành công từ ${url} (${elapsedSec}s).`);
      return {
        ok: true,
        imageUrl: finalImageUrl,
        usedUrl: url,
        statusCode: res.status,
      };
    } catch (err) {
      if (signal?.aborted) {
        return { ok: false, aborted: true };
      }
      if (timed.didTimeout()) {
        hadTimeout = true;
        const elapsedSec = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000),
        );
        lastErr = `Quá thời gian chờ (${elapsedSec}s) khi gọi ${url}.`;
        log(lastErr);
        return { ok: false, usedUrl: url, timedOut: true, error: lastErr };
      }
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, aborted: true };
      }
      lastErr = formatSeedreamFetchError(url, err);
      log(lastErr);
      return { ok: false, usedUrl: url, error: lastErr };
    } finally {
      timed.cleanup();
    }
  }

  return {
    ok: false,
    statusCode: lastStatus,
    responsePreview: lastPreview || undefined,
    timedOut: hadTimeout,
    error:
      lastErr ||
      'Không thể tạo ảnh từ Custom Image Endpoint. Kiểm tra Endpoint URL, API Key và định dạng Payload.',
  };
}

// ============================================================================
// Họa Đồ AI · Latent.moe (NovelAI / ComfyUI Anima Protocol + ZIP Extraction)
// ============================================================================

export const LATENT_REQUEST_TIMEOUT_MS = 180_000;
export const LATENT_DEFAULT_ENDPOINT = DEFAULT_LATENT_ENDPOINT;
export const LATENT_NATIVE_ENDPOINT = DEFAULT_LATENT_NATIVE_ENDPOINT;
export const LATENT_KEYS_DASHBOARD_URL = DEFAULT_LATENT_KEYS_URL;

export interface LatentModelPreset {
  id: string;
  label: string;
  shortLabel: string;
  desc: string;
}

export const LATENT_MODEL_PRESETS: LatentModelPreset[] = [
  {
    id: 'nai-diffusion-4-5-full',
    label: 'NovelAI V4.5 Full (nai-diffusion-4-5-full · Mặc định)',
    shortLabel: 'NAI V4.5 Full',
    desc: 'Mới nhất, chi tiết sắc nét, hiểu ngữ cảnh kiếm hiệp & đa nhân vật rất tốt',
  },
  {
    id: 'nai-diffusion-4-full',
    label: 'NovelAI V4 Full (nai-diffusion-4-full)',
    shortLabel: 'NAI V4 Full',
    desc: 'Chi tiết cao, phối cảnh cổ trang và phục sức chuẩn xác',
  },
  {
    id: 'nai-diffusion-4-curated-preview',
    label: 'NovelAI V4 Curated (nai-diffusion-4-curated-preview)',
    shortLabel: 'NAI V4 Curated',
    desc: 'Màu sắc hài hòa, nét vẽ anime / cổ trang sạch sẽ',
  },
  {
    id: 'nai-diffusion-3',
    label: 'NovelAI V3 (nai-diffusion-3)',
    shortLabel: 'NAI V3',
    desc: 'Ổn định, tối ưu mạnh với bộ tag anime kinh điển',
  },
  {
    id: 'anima',
    label: 'ComfyUI Anima (anima)',
    shortLabel: 'Anima',
    desc: 'Phong cách minh họa tiểu thuyết / ánh sáng điện ảnh sắc nét',
  },
];

export interface LatentAspectRatioPreset {
  id: 'portrait' | 'landscape' | 'square';
  value: string;
  width: number;
  height: number;
  label: string;
  shortLabel: string;
  hint: string;
}

export const LATENT_ASPECT_RATIOS: LatentAspectRatioPreset[] = [
  {
    id: 'portrait',
    value: '920x1536',
    width: 920,
    height: 1536,
    label: 'Khổ Dọc (920 × 1536 px)',
    shortLabel: 'Khổ Dọc (920×1536)',
    hint: 'Nhân vật toàn thân · Kiếm hiệp · Minh họa lượt truyện',
  },
  {
    id: 'landscape',
    value: '1536x920',
    width: 1536,
    height: 920,
    label: 'Khổ Ngang (1536 × 920 px)',
    shortLabel: 'Khổ Ngang (1536×920)',
    hint: 'Đại cảnh giang hồ · Sơn hà · Chiến trường',
  },
  {
    id: 'square',
    value: '1024x1024',
    width: 1024,
    height: 1024,
    label: 'Khổ Vuông (1024 × 1024 px)',
    shortLabel: 'Khổ Vuông (1024×1024)',
    hint: 'Avatar nhân vật · Chân dung cận cảnh',
  },
];

export const LATENT_SAMPLER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'k_euler_ancestral', label: 'k_euler_ancestral (Khuyên dùng)' },
  { value: 'k_euler', label: 'k_euler' },
  { value: 'k_dpmpp_2s_ancestral', label: 'k_dpmpp_2s_ancestral' },
  { value: 'k_dpmpp_2m', label: 'k_dpmpp_2m' },
  { value: 'k_dpmpp_sde', label: 'k_dpmpp_sde' },
  { value: 'ddim_v3', label: 'ddim_v3' },
];

export const LATENT_HOADO_SAMPLE_PRESET = {
  positivePrefix: WUXIA_XIANXIA_3D_DONGHUA_STYLE_BLOCK,
  negativePrompt:
    'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, deformed face, disfigured, extra limbs, fused fingers, ugly, flat lighting, muddy shadows, dark obscured face, flat 2d',
  steps: DEFAULT_LATENT_STEPS,
  scale: DEFAULT_LATENT_SCALE,
  sampler: DEFAULT_LATENT_SAMPLER,
  noiseSchedule: DEFAULT_LATENT_NOISE_SCHEDULE,
  ucPreset: 0,
  qualityToggle: true,
} as const;

export function splitTopLevelPromptSegments(raw: string): string[] {
  const input = String(raw || '').trim();
  if (!input) return [];
  const out: string[] = [];
  let current = '';
  let braceDepth = 0;
  let parenDepth = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '{') braceDepth += 1;
    else if (ch === '}' && braceDepth > 0) braceDepth -= 1;
    else if (ch === '(') parenDepth += 1;
    else if (ch === ')' && parenDepth > 0) parenDepth -= 1;

    if (ch === ',' && braceDepth === 0 && parenDepth === 0) {
      const seg = current.trim();
      if (seg) out.push(seg);
      current = '';
    } else {
      current += ch;
    }
  }
  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

const FEMININE_BODY_OR_FACE_TAG_RE =
  /\b(?:soft\s+curves|delicate\s+frame|small\s+waist|narrow\s+waist|slim\s+waist|slender\s+waist|slender\s+thighs|thin\s+legs|delicate\s+collarbone|slender\s+torso|slim\s+body|slender\s+figure|v-shaped\s+jaw|thin\s+face|delicate\s+jawline|feminine\s+figure|petite\s+frame)\b/i;

export function stripFeminineBodyTagsForMalePrompt(raw: string): string {
  return splitTopLevelPromptSegments(raw)
    .filter((seg) => seg && !FEMININE_BODY_OR_FACE_TAG_RE.test(seg))
    .join(', ');
}

function inferPromptGenderKind(
  prompt: string,
): 'male' | 'female' | 'mixed' | 'neutral' {
  const text = String(prompt || '').toLowerCase();
  if (/\b(?:no\s+humans|empty\s+scene|no\s+people)\b/.test(text)) {
    return 'neutral';
  }
  const hasFemale =
    /\b(?:1girl|[2-9]\+?girls|girl|woman|female|swordswoman|maiden|lady|nữ|cô\s+gái|thiếu\s+nữ)\b/.test(
      text,
    );
  const hasMale =
    /\b(?:1boy|[2-9]\+?boys|boy|man|male|swordsman|gentleman|nam\s+nhân|thiếu\s+niên)\b/.test(
      text,
    );
  if (hasMale && hasFemale) return 'mixed';
  if (hasMale) return 'male';
  if (hasFemale) return 'female';
  return 'neutral';
}

export function normalizeLatentEndpointUrl(rawUrl?: string): string {
  const clean = String(rawUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!clean) return DEFAULT_LATENT_ENDPOINT;
  try {
    const parsed = new URL(clean);
    const isLatentHost = /(?:^|\.)latent\.moe$/i.test(parsed.hostname);
    const pathLower = parsed.pathname.replace(/\/+$/, '').toLowerCase();

    if (isLatentHost) {
      if (
        !pathLower ||
        pathLower === '/' ||
        pathLower === '/ai/generate-image' ||
        pathLower === '/api/novelai' ||
        pathLower === '/api/novelai/ai' ||
        pathLower === '/novelai/ai/generate-image' ||
        /(\/api\/novelai){2,}/i.test(pathLower) ||
        /(\/ai\/generate-image)$/i.test(pathLower)
      ) {
        parsed.pathname = '/api/novelai/ai/generate-image';
        return parsed.toString().replace(/\/+$/, '');
      }
      if (
        pathLower === '/api/generate' ||
        pathLower === '/generate' ||
        /(\/api){2,}\/generate$/i.test(pathLower)
      ) {
        parsed.pathname = '/api/generate';
        return parsed.toString().replace(/\/+$/, '');
      }
      return parsed.toString().replace(/\/+$/, '');
    }

    if (!pathLower || pathLower === '/') {
      parsed.pathname = '/api/novelai/ai/generate-image';
      return parsed.toString().replace(/\/+$/, '');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return clean;
  }
}

function detectImageMimeFromBytes(
  bytes: Uint8Array,
  filenameHint = '',
): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }
  const lower = filenameHint.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return null;
}

const MAX_LATENT_ZIP_IMAGE_BYTES = 25 * 1024 * 1024;

export async function extractFirstImageFromZipBuffer(
  buffer: ArrayBuffer,
): Promise<
  | { ok: true; dataUrl: string; entryName: string }
  | { ok: false; error: string }
> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const allFiles = Object.values(zip.files)
      .filter(
        (entry) =>
          !entry.dir &&
          !entry.name.startsWith('__MACOSX/') &&
          !entry.name.endsWith('/.DS_Store'),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!allFiles.length) {
      return {
        ok: false,
        error: 'Tệp ZIP trả về từ Latent.moe rỗng (không chứa tệp ảnh).',
      };
    }

    const imageEntry =
      allFiles.find((f) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)) ||
      allFiles[0];

    const imgBytes = await imageEntry.async('uint8array');
    if (!imgBytes || imgBytes.byteLength === 0) {
      return {
        ok: false,
        error: `Tệp ảnh "${imageEntry.name}" bên trong ZIP bị rỗng.`,
      };
    }
    if (imgBytes.byteLength > MAX_LATENT_ZIP_IMAGE_BYTES) {
      return {
        ok: false,
        error: `Tệp ảnh "${imageEntry.name}" vượt quá giới hạn 25MB.`,
      };
    }

    const mime =
      detectImageMimeFromBytes(imgBytes, imageEntry.name) || 'image/png';
    const copy = new Uint8Array(imgBytes.byteLength);
    copy.set(imgBytes);
    const blob = new Blob([copy.buffer], { type: mime });
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl) {
      return {
        ok: false,
        error: `Không chuyển đổi được "${imageEntry.name}" từ ZIP sang Data URL.`,
      };
    }

    return { ok: true, dataUrl, entryName: imageEntry.name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    return {
      ok: false,
      error: `Không giải nén được tệp ZIP từ Latent.moe: ${msg || 'định dạng ZIP không hợp lệ'}.`,
    };
  }
}

export async function requestLatentImage(options: {
  endpointRaw?: string;
  apiKey: string;
  model?: string;
  prompt: string;
  positivePrefix?: string;
  negativePrompt?: string;
  extraNegativePrompt?: string;
  size?: string;
  steps?: number;
  scale?: number;
  sampler?: string;
  noiseSchedule?: string;
  ucPreset?: number;
  qualityToggle?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  useServerProxy?: boolean;
  logPrefix?: string;
  onLog?: (line: string) => void;
  onProgress?: (label: string) => void;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  usedUrl?: string;
  statusCode?: number;
  responsePreview?: string;
  entryName?: string;
  error?: string;
  aborted?: boolean;
  timedOut?: boolean;
}> {
  const {
    endpointRaw,
    apiKey,
    model = DEFAULT_LATENT_MODEL,
    prompt,
    positivePrefix = '',
    negativePrompt = '',
    extraNegativePrompt = '',
    size = DEFAULT_LATENT_SIZE,
    steps = DEFAULT_LATENT_STEPS,
    scale = DEFAULT_LATENT_SCALE,
    sampler = DEFAULT_LATENT_SAMPLER,
    noiseSchedule = DEFAULT_LATENT_NOISE_SCHEDULE,
    ucPreset = 0,
    qualityToggle = true,
    signal,
    timeoutMs = LATENT_REQUEST_TIMEOUT_MS,
    useServerProxy = false,
    logPrefix = '[Họa Đồ AI · Latent.moe]',
    onLog,
    onProgress,
  } = options;

  const log = (msg: string) => {
    onLog?.(logPrefix ? `${logPrefix} ${msg}` : msg);
  };

  const url = normalizeLatentEndpointUrl(endpointRaw);
  if (!/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      error:
        'Latent.moe Endpoint URL không hợp lệ. Vui lòng dùng URL bắt đầu bằng https:// hoặc http://.',
    };
  }

  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    return {
      ok: false,
      usedUrl: url,
      error:
        'Chưa nhập Latent API Key (lat_sk_...). Hãy bấm "Lấy Key Latent.moe" và dán vào phần Cài đặt.',
    };
  }

  const cleanModel = String(model || '').trim() || DEFAULT_LATENT_MODEL;
  const cleanSize = String(size || '').trim() || DEFAULT_LATENT_SIZE;
  const dims = parseImageDimensions(cleanSize) ?? { width: 920, height: 1536 };

  const rawCleanPrefix = String(positivePrefix || '').trim().replace(/,+\s*$/, '');
  const cleanPrompt = String(prompt || '').trim().replace(/^,+\s*/, '');
  const promptGenderKind = inferPromptGenderKind(cleanPrompt);
  const isSceneryPrompt = /\b(?:no\s+humans|empty\s+scene|no\s+people)\b/i.test(
    cleanPrompt,
  );
  const is3dDonghuaPrompt = /\b(?:3d\s+donghua|chinese\s+3d\s+donghua|stylized\s+3d|3d\s+render|3d\s+cg)\b/i.test(
    `${rawCleanPrefix} ${cleanPrompt}`,
  );
  const cleanPromptLower = cleanPrompt.toLowerCase();
  // Brace-safe prefix cleanup: never split inside {...:1.25} or (...:3) weight blocks,
  // strip legacy 2D/robe clashes, and NEVER allow feminine body tags to leak onto male or scenery prompts.
  const filteredPrefixSegments = splitTopLevelPromptSegments(rawCleanPrefix).filter(
    (seg) => {
      if (!seg) return false;
      if (
        is3dDonghuaPrompt &&
        /^(?:crisp\s+linework|clean\s+anime\s+lineart|painterly\s+(?:anime\s+)?illustration|2d\s+flat\s+color|flat\s+cel\s+shading|intricate\s+silk\s+robes|dynamic\s+wuxia\s+composition)$/i.test(
          seg,
        )
      ) {
        return false;
      }
      if (
        (promptGenderKind === 'male' ||
          promptGenderKind === 'mixed' ||
          isSceneryPrompt) &&
        FEMININE_BODY_OR_FACE_TAG_RE.test(seg)
      ) {
        return false;
      }
      if (cleanPromptLower.includes(seg.toLowerCase())) {
        return false;
      }
      return true;
    },
  );
  const cleanPrefix = filteredPrefixSegments.join(', ');
  // Always prioritize character profile / appearance / outfit / weapon FIRST, then append shared style & quality block
  const fullInput = [cleanPrompt, cleanPrefix].filter(Boolean).join(', ');
  const fullNegative = [
    String(negativePrompt || '').trim(),
    String(extraNegativePrompt || '').trim(),
  ]
    .filter(Boolean)
    .join(', ');

  const safeSteps = Number.isFinite(steps)
    ? Math.max(1, Math.min(50, Math.round(steps)))
    : DEFAULT_LATENT_STEPS;
  const safeScale = Number.isFinite(scale)
    ? Math.max(1, Math.min(20, Number(scale)))
    : DEFAULT_LATENT_SCALE;
  const safeSampler = String(sampler || '').trim() || DEFAULT_LATENT_SAMPLER;
  const safeNoise =
    String(noiseSchedule || '').trim() || DEFAULT_LATENT_NOISE_SCHEDULE;
  const safeUcPreset = Number.isFinite(ucPreset)
    ? Math.max(0, Math.min(4, Math.round(ucPreset)))
    : 0;
  const seed = Math.floor(Math.random() * 4_294_967_295);

  const payload: Record<string, unknown> = {
    input: fullInput,
    model: cleanModel,
    parameters: {
      width: dims.width,
      height: dims.height,
      steps: safeSteps,
      sampler: safeSampler,
      negative_prompt: fullNegative,
      scale: safeScale,
      noise_schedule: safeNoise,
      n_samples: 1,
      ucPreset: safeUcPreset,
      qualityToggle: Boolean(qualityToggle),
      seed,
    },
  };

  const isExplicitNativeEndpoint = /\/api\/generate$/i.test(url);
  const nativeAsyncUrl = (() => {
    if (isExplicitNativeEndpoint) return url;
    try {
      const parsed = new URL(url);
      parsed.pathname = '/api/generate';
      parsed.search = '';
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return DEFAULT_LATENT_NATIVE_ENDPOINT;
    }
  })();

  const buildMediaUrl = (artworkId: string): string => {
    const encoded = encodeURIComponent(artworkId);
    try {
      const parsed = new URL(nativeAsyncUrl);
      parsed.pathname = `/api/media/${encoded}`;
      parsed.search = '?size=preview';
      return parsed.toString();
    } catch {
      return `https://latent.moe/api/media/${encoded}?size=preview`;
    }
  };

  const waitMsWithAbort = (ms: number, abortSig: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      if (abortSig.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(() => {
        abortSig.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      abortSig.addEventListener('abort', onAbort, { once: true });
    });

  if (signal?.aborted) {
    return { ok: false, aborted: true };
  }

  const timed = createTimedAbortSignal(signal, Math.max(15_000, timeoutMs));
  const startedAt = Date.now();

  const runNativeAsyncMode = async (primaryFailure?: {
    usedUrl: string;
    statusCode?: number;
    error: string;
    responsePreview?: string;
  }): Promise<{
    ok: boolean;
    imageUrl?: string;
    usedUrl?: string;
    statusCode?: number;
    responsePreview?: string;
    entryName?: string;
    error?: string;
    aborted?: boolean;
    timedOut?: boolean;
  }> => {
    const resolutionTag: 'portrait' | 'landscape' | 'square' =
      dims.width > dims.height
        ? 'landscape'
        : dims.width < dims.height
          ? 'portrait'
          : 'square';
    const nativePayload = {
      prompt: fullInput,
      negativePrompt: fullNegative,
      resolution: resolutionTag,
      steps: 12,
      sampler: 'euler',
      scheduler: 'sgm_uniform',
    };

    onProgress?.(
      `Đang vẽ qua Latent.moe Native Async (${resolutionTag} · 12 steps)...`,
    );
    log(
      `POST ${nativeAsyncUrl} (Native Async: resolution=${resolutionTag}, steps=12, sampler=euler, scheduler=sgm_uniform, ${
        useServerProxy ? 'Server Proxy /api/proxy' : 'Direct Fetch'
      })`,
    );

    const postRes = await fetchProxyTarget({
      url: nativeAsyncUrl,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: timed.signal,
      body: nativePayload,
      useServerProxy,
    });

    const postElapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const postTxt = await postRes.text().catch(() => '');
    let postJson: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(postTxt);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        postJson = parsed as Record<string, unknown>;
      }
    } catch {
      // non-JSON response
    }

    if (!postRes.ok) {
      const preview = postTxt.replace(/\s+/g, ' ').trim().slice(0, 320);
      const parsedErr = postJson ? extractSeedreamErrorMessage(postJson) : '';
      const detail = (parsedErr || preview).slice(0, 240);
      const nativeErr = `HTTP ${postRes.status} từ POST ${nativeAsyncUrl} (${postElapsed}s)${
        detail ? `: ${detail}` : ''
      }`;
      const combinedError = primaryFailure
        ? `${primaryFailure.error}\n[Dự phòng Native Async] ${nativeErr}`
        : nativeErr;
      log(nativeErr);
      return {
        ok: false,
        usedUrl: primaryFailure ? `${primaryFailure.usedUrl} -> ${nativeAsyncUrl}` : nativeAsyncUrl,
        statusCode: postRes.status,
        responsePreview: preview || primaryFailure?.responsePreview,
        error: combinedError,
      };
    }

    const extractArtworkId = (obj: Record<string, unknown> | null): string => {
      if (!obj) return '';
      const direct =
        obj.artworkId ??
        (obj.artwork && typeof obj.artwork === 'object'
          ? (obj.artwork as Record<string, unknown>).id
          : undefined) ??
        (obj.result && typeof obj.result === 'object'
          ? (obj.result as Record<string, unknown>).artworkId
          : undefined) ??
        (obj.output && typeof obj.output === 'object'
          ? (obj.output as Record<string, unknown>).artworkId
          : undefined) ??
        (obj.data && typeof obj.data === 'object'
          ? (obj.data as Record<string, unknown>).artworkId
          : undefined);
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      if (Array.isArray(obj.images) && obj.images.length > 0) {
        const first = obj.images[0];
        if (first && typeof first === 'object') {
          const rec = first as Record<string, unknown>;
          const idVal = rec.artworkId ?? rec.id;
          if (typeof idVal === 'string' && idVal.trim()) return idVal.trim();
        }
      }
      return '';
    };

    let artworkId = extractArtworkId(postJson);
    const directUrl = postJson
      ? extractImageFromSeedreamResponse(postJson, nativeAsyncUrl)
      : null;

    if (!artworkId && directUrl) {
      const hydrated = await hydrateRemoteImageViaProxyIfHelpful({
        imageUrl: directUrl,
        useServerProxy,
        signal: timed.signal,
      });
      return {
        ok: true,
        imageUrl: hydrated,
        usedUrl: nativeAsyncUrl,
        statusCode: postRes.status,
        entryName: 'native_direct.png',
      };
    }

    const jobIdRaw =
      postJson?.id ??
      postJson?.jobId ??
      postJson?.taskId ??
      postJson?.generationId ??
      (postJson?.data && typeof postJson.data === 'object'
        ? (postJson.data as Record<string, unknown>).id
        : undefined);
    const jobId =
      typeof jobIdRaw === 'string' || typeof jobIdRaw === 'number'
        ? String(jobIdRaw).trim()
        : '';

    if (!artworkId && !jobId) {
      const preview = postTxt.replace(/\s+/g, ' ').trim().slice(0, 260);
      const err = `Phản hồi từ POST ${nativeAsyncUrl} thiếu id hoặc artworkId${
        preview ? `: ${preview}` : ''
      }`;
      return {
        ok: false,
        usedUrl: nativeAsyncUrl,
        statusCode: postRes.status,
        error: primaryFailure ? `${primaryFailure.error}\n${err}` : err,
      };
    }

    let pollUrl = nativeAsyncUrl;
    if (!artworkId && jobId) {
      pollUrl = `${nativeAsyncUrl.replace(/\/+$/, '')}/${encodeURIComponent(jobId)}`;
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await waitMsWithAbort(1500, timed.signal);
        onProgress?.(`Đang chờ Latent.moe xử lý (${attempt + 1})...`);
        const pollRes = await fetchProxyTarget({
          url: pollUrl,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            Accept: 'application/json',
          },
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: timed.signal,
          useServerProxy,
        });

        const pollTxt = await pollRes.text().catch(() => '');
        let pollJson: Record<string, unknown> | null = null;
        try {
          const parsed = JSON.parse(pollTxt);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            pollJson = parsed as Record<string, unknown>;
          }
        } catch {
          // non-JSON body
        }

        if (!pollRes.ok) {
          const preview = pollTxt.replace(/\s+/g, ' ').trim().slice(0, 260);
          const parsedErr = pollJson ? extractSeedreamErrorMessage(pollJson) : '';
          const detail = (parsedErr || preview).slice(0, 220);
          const pollErr = `HTTP ${pollRes.status} từ GET ${pollUrl}${
            detail ? `: ${detail}` : ''
          }`;
          log(pollErr);
          return {
            ok: false,
            usedUrl: pollUrl,
            statusCode: pollRes.status,
            error: primaryFailure ? `${primaryFailure.error}\n${pollErr}` : pollErr,
          };
        }

        const statusStr = String(
          pollJson?.status ?? pollJson?.state ?? '',
        ).toLowerCase();
        if (
          statusStr === 'failed' ||
          statusStr === 'error' ||
          statusStr === 'cancelled' ||
          statusStr === 'canceled'
        ) {
          const reason =
            (pollJson ? extractSeedreamErrorMessage(pollJson) : '') ||
            String(pollJson?.error || pollJson?.message || '');
          const failMsg = `Tác vụ thất bại tại GET ${pollUrl}${
            reason ? `: ${reason}` : ''
          }`;
          return {
            ok: false,
            usedUrl: pollUrl,
            statusCode: pollRes.status,
            error: primaryFailure ? `${primaryFailure.error}\n${failMsg}` : failMsg,
          };
        }

        artworkId = extractArtworkId(pollJson);
        if (artworkId) break;

        const polledDirectUrl = pollJson
          ? extractImageFromSeedreamResponse(pollJson, pollUrl)
          : null;
        if (polledDirectUrl) {
          const hydrated = await hydrateRemoteImageViaProxyIfHelpful({
            imageUrl: polledDirectUrl,
            useServerProxy,
            signal: timed.signal,
          });
          return {
            ok: true,
            imageUrl: hydrated,
            usedUrl: pollUrl,
            statusCode: pollRes.status,
            entryName: `native_${jobId}.png`,
          };
        }
      }
    }

    if (!artworkId) {
      const err = `Không nhận được artworkId từ GET ${pollUrl}.`;
      return {
        ok: false,
        usedUrl: pollUrl,
        error: primaryFailure ? `${primaryFailure.error}\n${err}` : err,
      };
    }

    const mediaUrl = buildMediaUrl(artworkId);
    onProgress?.('Đang tải ảnh kết quả từ Latent.moe...');
    log(`GET ${mediaUrl}`);

    const mediaRes = await fetchProxyTarget({
      url: mediaUrl,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        Accept: 'image/*, application/octet-stream, application/json',
      },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: timed.signal,
      useServerProxy,
    });

    if (!mediaRes.ok) {
      const errTxt = await mediaRes.text().catch(() => '');
      const preview = errTxt.replace(/\s+/g, ' ').trim().slice(0, 260);
      const mediaErr = `HTTP ${mediaRes.status} từ GET ${mediaUrl}${
        preview ? `: ${preview}` : ''
      }`;
      log(mediaErr);
      return {
        ok: false,
        usedUrl: mediaUrl,
        statusCode: mediaRes.status,
        error: primaryFailure ? `${primaryFailure.error}\n${mediaErr}` : mediaErr,
      };
    }

    const mediaCt = (mediaRes.headers.get('content-type') || '').toLowerCase();
    const mediaBuf = await mediaRes.arrayBuffer();
    const mediaBytes = new Uint8Array(mediaBuf);
    const mime =
      detectImageMimeFromBytes(mediaBytes) ||
      (mediaCt.includes('image/') ? mediaCt.split(';')[0].trim() : null);

    if (mime && mediaBytes.byteLength > 0) {
      const blob = new Blob([mediaBuf], { type: mime });
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl) {
        const totalSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        log(
          `Nhận ảnh Native Async thành công từ GET ${mediaUrl} (${totalSec}s).`,
        );
        return {
          ok: true,
          imageUrl: dataUrl,
          usedUrl: mediaUrl,
          statusCode: mediaRes.status,
          entryName: `artwork_${artworkId}.png`,
        };
      }
    }

    const mediaText = new TextDecoder('utf-8', { fatal: false }).decode(mediaBytes);
    let parsedMedia: unknown = mediaText;
    try {
      parsedMedia = JSON.parse(mediaText);
    } catch {
      // raw text
    }
    const extractedMediaUrl = extractImageFromSeedreamResponse(
      parsedMedia,
      mediaUrl,
    );
    if (extractedMediaUrl) {
      const hydrated = await hydrateRemoteImageViaProxyIfHelpful({
        imageUrl: extractedMediaUrl,
        useServerProxy,
        signal: timed.signal,
      });
      return {
        ok: true,
        imageUrl: hydrated,
        usedUrl: mediaUrl,
        statusCode: mediaRes.status,
        entryName: `artwork_${artworkId}.png`,
      };
    }

    const fallbackErr = `Phản hồi từ GET ${mediaUrl} không phải dữ liệu ảnh hợp lệ.`;
    return {
      ok: false,
      usedUrl: mediaUrl,
      statusCode: mediaRes.status,
      error: primaryFailure ? `${primaryFailure.error}\n${fallbackErr}` : fallbackErr,
    };
  };

  try {
    if (isExplicitNativeEndpoint) {
      return await runNativeAsyncMode();
    }

    onProgress?.(
      `Đang vẽ qua Latent.moe (${cleanModel} · ${dims.width}×${dims.height})...`,
    );
    log(
      `POST ${url} (model=${cleanModel}, size=${dims.width}x${dims.height}, steps=${safeSteps}, scale=${safeScale}, sampler=${safeSampler}, ${
        useServerProxy ? 'Server Proxy /api/proxy' : 'Direct Fetch'
      })`,
    );

    const res = await fetchProxyTarget({
      url,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
        Accept:
          'application/x-zip-compressed, application/octet-stream, application/json',
      },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: timed.signal,
      body: payload,
      useServerProxy,
    });

    const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      let parsedErr = '';
      try {
        parsedErr = extractSeedreamErrorMessage(JSON.parse(errTxt));
      } catch {
        // non-JSON error body
      }
      const preview = String(errTxt || '').replace(/\s+/g, ' ').trim().slice(0, 320);
      const detail = (parsedErr || preview).slice(0, 260);
      const errMsg = `HTTP ${res.status} từ POST ${url} (${elapsedSec}s)${
        detail ? `: ${detail}` : ''
      }`;
      log(errMsg);

      const shouldTryNativeFallback =
        (res.status === 404 ||
          res.status === 405 ||
          res.status >= 500) &&
        nativeAsyncUrl !== url;

      if (shouldTryNativeFallback) {
        log(
          `Chuyển sang chế độ dự phòng Native Async (${nativeAsyncUrl}) sau lỗi HTTP ${res.status}...`,
        );
        return await runNativeAsyncMode({
          usedUrl: url,
          statusCode: res.status,
          error: errMsg,
          responsePreview: preview || undefined,
        });
      }

      return {
        ok: false,
        usedUrl: url,
        statusCode: res.status,
        responsePreview: preview || undefined,
        error: errMsg,
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.byteLength === 0) {
      const emptyMsg = `Latent.moe (POST ${url}) trả về dữ liệu rỗng (HTTP ${res.status}, ${elapsedSec}s).`;
      log(emptyMsg);
      return {
        ok: false,
        usedUrl: url,
        statusCode: res.status,
        error: emptyMsg,
      };
    }

    const hasZipSignature =
      bytes.byteLength >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

    if (hasZipSignature || contentType.includes('zip')) {
      onProgress?.('Đang giải nén ảnh từ gói ZIP của Latent.moe...');
      const extractedZip = await extractFirstImageFromZipBuffer(arrayBuffer);
      if (!extractedZip.ok) {
        const zipErr = `${extractedZip.error} (POST ${url})`;
        log(zipErr);
        return {
          ok: false,
          usedUrl: url,
          statusCode: res.status,
          error: zipErr,
        };
      }
      log(
        `Đã giải nén thành công "${extractedZip.entryName}" từ ZIP (${Math.round(
          bytes.byteLength / 1024,
        )} KB, ${elapsedSec}s) từ ${url}.`,
      );
      return {
        ok: true,
        imageUrl: extractedZip.dataUrl,
        usedUrl: url,
        statusCode: res.status,
        entryName: extractedZip.entryName,
      };
    }

    const directMime =
      detectImageMimeFromBytes(bytes) ||
      (contentType.includes('image/') ? contentType.split(';')[0].trim() : null);

    if (directMime) {
      const blob = new Blob([arrayBuffer], { type: directMime });
      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl) {
        const msg = `Không đọc được dữ liệu ảnh nhị phân (${directMime}) từ POST ${url}.`;
        log(msg);
        return { ok: false, usedUrl: url, statusCode: res.status, error: msg };
      }
      log(
        `Nhận ảnh nhị phân trực tiếp (${directMime}, ${elapsedSec}s) từ ${url}.`,
      );
      return {
        ok: true,
        imageUrl: dataUrl,
        usedUrl: url,
        statusCode: res.status,
      };
    }

    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const preview = rawText.replace(/\s+/g, ' ').trim().slice(0, 320);
    let parsedBody: unknown = rawText;
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      // keep raw text fallback
    }

    const extracted = extractImageFromSeedreamResponse(parsedBody, url);
    if (extracted) {
      const hydrated = await hydrateRemoteImageViaProxyIfHelpful({
        imageUrl: extracted,
        useServerProxy,
        signal,
      });
      log(`Nhận ảnh dạng JSON/URL từ ${url} thành công (${elapsedSec}s).`);
      return {
        ok: true,
        imageUrl: hydrated,
        usedUrl: url,
        statusCode: res.status,
      };
    }

    const apiErr = extractSeedreamErrorMessage(parsedBody);
    const errMsg = apiErr
      ? `Latent.moe báo lỗi tại POST ${url} (HTTP ${res.status}): ${apiErr.slice(0, 240)}`
      : `Phản hồi từ POST ${url} (HTTP ${res.status}) không phải ZIP hay ảnh hợp lệ${
          preview ? `: ${preview.slice(0, 200)}` : ''
        }`;
    log(errMsg);
    return {
      ok: false,
      usedUrl: url,
      statusCode: res.status,
      responsePreview: preview || undefined,
      error: errMsg,
    };
  } catch (err) {
    if (signal?.aborted) {
      return { ok: false, aborted: true };
    }
    if (timed.didTimeout()) {
      const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const msg = `Quá thời gian chờ (${elapsedSec}s) khi gọi ${url}.`;
      log(msg);
      return { ok: false, usedUrl: url, timedOut: true, error: msg };
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, aborted: true };
    }
    const msg = formatSeedreamFetchError(url, err);
    log(msg);
    return { ok: false, usedUrl: url, error: msg };
  } finally {
    timed.cleanup();
  }
}

// ============================================================================
// ComfyUI API Workflow Helpers (POST /prompt -> /history/{id} -> /view)
// ============================================================================

export const COMFYUI_REQUEST_TIMEOUT_MS = 240_000;
const COMFYUI_POLL_INTERVAL_MS = 1_500;

interface ComfyUiNode {
  class_type?: string;
  inputs?: Record<string, unknown>;
  _meta?: { title?: string };
}

export interface ComfyUiNodeSummary {
  id: string;
  classType: string;
  title: string;
}

export interface ComfyUiWorkflowAnalysis {
  ok: boolean;
  error?: string;
  workflow?: Record<string, ComfyUiNode>;
  detected: {
    positiveNodeId: string;
    negativeNodeId: string;
    seedNodeId: string;
    sizeNodeId: string;
    outputNodeId: string;
  };
  nodeSummaries: ComfyUiNodeSummary[];
}

export function normalizeComfyUiBaseUrl(rawUrl: string): string {
  const clean = (rawUrl || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:prompt|history|view|system_stats|queue|interrupt)(?:\/.*)?$/i, '')
    .replace(/\/+$/, '');
  return clean;
}

export function parseImageDimensions(
  sizeStr?: string,
): { width: number; height: number } | null {
  const raw = (sizeStr || '').trim();
  if (!raw) return null;
  const match = /^(\d{3,4})\s*[x×*]\s*(\d{3,4})$/i.exec(raw);
  if (!match) return null;
  const rawW = Number(match[1]);
  const rawH = Number(match[2]);
  if (!Number.isFinite(rawW) || !Number.isFinite(rawH)) return null;
  const snap8 = (n: number) =>
    Math.max(256, Math.min(4096, Math.round(n / 8) * 8));
  return { width: snap8(rawW), height: snap8(rawH) };
}

function formatComfyUiFetchError(url: string, err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const isHttpsToHttp =
    typeof location !== 'undefined' &&
    /^https:/i.test(location.protocol) &&
    /^http:/i.test(url);
  const hints: string[] = [];
  if (isHttpsToHttp) {
    hints.push(
      'Mixed Content (trang HTTPS gọi ComfyUI HTTP — hãy dùng tunnel HTTPS hoặc chạy cùng giao thức)',
    );
  }
  hints.push(
    'kiểm tra ComfyUI đã bật --enable-cors-header và Base URL đúng cổng',
  );
  return `Lỗi kết nối ComfyUI (${url}): ${rawMsg} (${hints.join('; ')}).`;
}

function sleepWithAbortSignal(
  ms: number,
  signal?: AbortSignal,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      resolve(false);
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function getComfyLinkSourceId(val: unknown): string {
  if (
    Array.isArray(val) &&
    val.length >= 1 &&
    (typeof val[0] === 'string' || typeof val[0] === 'number')
  ) {
    return String(val[0]);
  }
  return '';
}

function getComfyPromptFieldKeys(node: ComfyUiNode): string[] {
  const inputs = node.inputs;
  if (!inputs || typeof inputs !== 'object') return [];
  const preferredKeys = [
    'text',
    'prompt',
    't5xxl',
    'clip_l',
    'positive',
    'text_positive',
    'string',
    'value',
  ];
  return preferredKeys.filter((k) => typeof inputs[k] === 'string');
}

function getComfyNegativeFieldKeys(node: ComfyUiNode): string[] {
  const inputs = node.inputs;
  if (!inputs || typeof inputs !== 'object') return [];
  const preferredKeys = [
    'negative',
    'text_negative',
    'text',
    'prompt',
    't5xxl',
    'clip_l',
    'string',
    'value',
  ];
  return preferredKeys.filter((k) => typeof inputs[k] === 'string');
}

function traceUpstreamPromptNode(
  workflow: Record<string, ComfyUiNode>,
  startNodeId: string,
  maxDepth = 5,
): string {
  let curId = startNodeId;
  const visited = new Set<string>();
  for (let depth = 0; depth < maxDepth && curId; depth += 1) {
    if (visited.has(curId)) break;
    visited.add(curId);
    const node = workflow[curId];
    if (!node || typeof node !== 'object') break;
    const cls = String(node.class_type || '');
    const textKeys = getComfyPromptFieldKeys(node);
    if (
      textKeys.length > 0 &&
      /(?:CLIPTextEncode|Prompt|String|Text|Conditioning|Encode)/i.test(cls)
    ) {
      return curId;
    }
    const inputs = node.inputs || {};
    const nextLink =
      getComfyLinkSourceId(inputs.conditioning) ||
      getComfyLinkSourceId(inputs.positive) ||
      getComfyLinkSourceId(inputs.negative) ||
      getComfyLinkSourceId(inputs.text) ||
      getComfyLinkSourceId(inputs.prompt) ||
      getComfyLinkSourceId(inputs.conditioning_1) ||
      getComfyLinkSourceId(inputs.conditioning_to);
    if (nextLink) {
      curId = nextLink;
      continue;
    }
    if (textKeys.length > 0) return curId;
    break;
  }
  return '';
}

export function analyzeComfyUiWorkflowJson(
  workflowJson: string,
): ComfyUiWorkflowAnalysis {
  const emptyDetected = {
    positiveNodeId: '',
    negativeNodeId: '',
    seedNodeId: '',
    sizeNodeId: '',
    outputNodeId: '',
  };
  const trimmed = (workflowJson || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      error:
        'Chưa dán Workflow API JSON của ComfyUI. Hãy xuất file bằng Save (API Format) rồi dán hoặc tải lên.',
      detected: emptyDetected,
      nodeSummaries: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      ok: false,
      error: `Workflow JSON không hợp lệ: ${
        err instanceof Error ? err.message : String(err)
      }`,
      detected: emptyDetected,
      nodeSummaries: [],
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error:
        'Workflow JSON phải là object JSON theo chuẩn Export (API Format) của ComfyUI.',
      detected: emptyDetected,
      nodeSummaries: [],
    };
  }

  const rootObj = parsed as Record<string, unknown>;
  if (Array.isArray(rootObj.nodes) && !rootObj.prompt) {
    return {
      ok: false,
      error:
        'Đây là file Workflow giao diện (có mảng "nodes"), chưa phải Workflow API JSON. Hãy bật Dev Mode trong ComfyUI rồi chọn "Export (API)" / "Save (API Format)".',
      detected: emptyDetected,
      nodeSummaries: [],
    };
  }

  const graphCandidate =
    rootObj.prompt &&
    typeof rootObj.prompt === 'object' &&
    !Array.isArray(rootObj.prompt)
      ? (rootObj.prompt as Record<string, unknown>)
      : rootObj;

  const workflow: Record<string, ComfyUiNode> = {};
  const nodeSummaries: ComfyUiNodeSummary[] = [];

  for (const [id, rawNode] of Object.entries(graphCandidate)) {
    if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
      continue;
    }
    const node = rawNode as ComfyUiNode;
    if (typeof node.class_type !== 'string' || !node.class_type.trim()) {
      continue;
    }
    workflow[id] = node;
    nodeSummaries.push({
      id,
      classType: node.class_type.trim(),
      title: String(node._meta?.title || node.class_type || id).trim(),
    });
  }

  if (nodeSummaries.length === 0) {
    return {
      ok: false,
      error:
        'Không tìm thấy node ComfyUI hợp lệ (thiếu trường "class_type"). Hãy dùng file xuất theo chuẩn API Format.',
      detected: emptyDetected,
      nodeSummaries: [],
    };
  }

  const entries = Object.entries(workflow);

  // 1. Seed / Sampler node detection
  let seedNodeId = '';
  let primarySamplerNode: ComfyUiNode | null = null;
  for (const [id, node] of entries) {
    const cls = String(node.class_type || '');
    const inputs = node.inputs || {};
    const hasSeedInput =
      typeof inputs.seed === 'number' || typeof inputs.noise_seed === 'number';
    if (
      /(?:KSampler|SamplerCustom|RandomNoise|SharkSampler)/i.test(cls) &&
      hasSeedInput
    ) {
      seedNodeId = id;
      primarySamplerNode = node;
      break;
    }
  }
  if (!primarySamplerNode) {
    for (const [id, node] of entries) {
      const cls = String(node.class_type || '');
      if (/(?:KSampler|SamplerCustom|BasicGuider|CFGGuider)/i.test(cls)) {
        primarySamplerNode = node;
        if (!seedNodeId) {
          const inputs = node.inputs || {};
          if (
            typeof inputs.seed === 'number' ||
            typeof inputs.noise_seed === 'number'
          ) {
            seedNodeId = id;
          }
        }
        break;
      }
    }
  }
  if (!seedNodeId) {
    for (const [id, node] of entries) {
      const inputs = node.inputs || {};
      if (
        typeof inputs.seed === 'number' ||
        typeof inputs.noise_seed === 'number'
      ) {
        seedNodeId = id;
        break;
      }
    }
  }

  // 2. Positive & Negative prompt nodes (follow sampler links first)
  let positiveNodeId = '';
  let negativeNodeId = '';
  if (primarySamplerNode?.inputs) {
    const posLink =
      getComfyLinkSourceId(primarySamplerNode.inputs.positive) ||
      getComfyLinkSourceId(primarySamplerNode.inputs.conditioning);
    const negLink = getComfyLinkSourceId(primarySamplerNode.inputs.negative);
    if (posLink) {
      positiveNodeId = traceUpstreamPromptNode(workflow, posLink);
    }
    if (negLink) {
      negativeNodeId = traceUpstreamPromptNode(workflow, negLink);
    }
  }

  // Also check explicit placeholder markers {{prompt}} / {{negative_prompt}}
  if (!positiveNodeId || !negativeNodeId) {
    for (const [id, node] of entries) {
      const inputs = node.inputs || {};
      for (const val of Object.values(inputs)) {
        if (typeof val !== 'string') continue;
        if (!positiveNodeId && /\{\{\s*prompt\s*\}\}|\$\{prompt\}|%prompt%/i.test(val)) {
          positiveNodeId = id;
        }
        if (
          !negativeNodeId &&
          /\{\{\s*negative_prompt\s*\}\}|\$\{negative_prompt\}|%negative_prompt%/i.test(val)
        ) {
          negativeNodeId = id;
        }
      }
    }
  }

  // Fallback scan on CLIPTextEncode / prompt nodes by title and order
  const promptCandidates = entries.filter(([, node]) => {
    const cls = String(node.class_type || '');
    return (
      /(?:CLIPTextEncode|Prompt|TextEncode)/i.test(cls) &&
      getComfyPromptFieldKeys(node).length > 0
    );
  });

  if (!positiveNodeId && promptCandidates.length > 0) {
    const explicitPos = promptCandidates.find(([, n]) =>
      /(?:pos|positive|tích\s*cực|main)/i.test(String(n._meta?.title || '')),
    );
    const nonNeg = promptCandidates.find(
      ([id, n]) =>
        id !== negativeNodeId &&
        !/(?:neg|negative|tiêu\s*cực|bad)/i.test(String(n._meta?.title || '')),
    );
    positiveNodeId =
      explicitPos?.[0] || nonNeg?.[0] || promptCandidates[0][0];
  }

  if (!negativeNodeId && promptCandidates.length > 1) {
    const explicitNeg = promptCandidates.find(
      ([id, n]) =>
        id !== positiveNodeId &&
        /(?:neg|negative|tiêu\s*cực|bad)/i.test(String(n._meta?.title || '')),
    );
    const other = promptCandidates.find(([id]) => id !== positiveNodeId);
    negativeNodeId = explicitNeg?.[0] || other?.[0] || '';
  }

  // 3. Latent Width/Height node
  let sizeNodeId = '';
  for (const [id, node] of entries) {
    const cls = String(node.class_type || '');
    const inputs = node.inputs || {};
    if (
      /(?:Empty.*Latent|LatentImage|ModelSampling)/i.test(cls) &&
      typeof inputs.width === 'number' &&
      typeof inputs.height === 'number'
    ) {
      sizeNodeId = id;
      break;
    }
  }
  if (!sizeNodeId) {
    for (const [id, node] of entries) {
      const inputs = node.inputs || {};
      if (
        typeof inputs.width === 'number' &&
        typeof inputs.height === 'number'
      ) {
        sizeNodeId = id;
        break;
      }
    }
  }

  // 4. Output image node (prefer SaveImage over PreviewImage)
  let outputNodeId = '';
  for (const [id, node] of entries) {
    const cls = String(node.class_type || '');
    if (/^SaveImage$/i.test(cls)) {
      outputNodeId = id;
      break;
    }
  }
  if (!outputNodeId) {
    for (const [id, node] of entries) {
      const cls = String(node.class_type || '');
      if (/(?:SaveImage|PreviewImage)/i.test(cls)) {
        outputNodeId = id;
        break;
      }
    }
  }

  return {
    ok: true,
    workflow,
    detected: {
      positiveNodeId,
      negativeNodeId,
      seedNodeId,
      sizeNodeId,
      outputNodeId,
    },
    nodeSummaries,
  };
}

export function prepareComfyUiWorkflowPrompt(options: {
  workflowJson: string;
  prompt: string;
  negativePrompt?: string;
  size?: string;
  seed?: number;
  nodeMapping?: ComfyUiNodeMapping;
}): {
  ok: boolean;
  error?: string;
  promptGraph?: Record<string, ComfyUiNode>;
  outputNodeId?: string;
  appliedSummary?: string;
  seedUsed?: number;
} {
  const analysis = analyzeComfyUiWorkflowJson(options.workflowJson);
  if (!analysis.ok || !analysis.workflow) {
    return { ok: false, error: analysis.error || 'Workflow JSON không hợp lệ.' };
  }

  const graph = JSON.parse(
    JSON.stringify(analysis.workflow),
  ) as Record<string, ComfyUiNode>;
  const map = options.nodeMapping || {};

  const positiveNodeId =
    (map.positiveNodeId || '').trim() || analysis.detected.positiveNodeId;
  const negativeNodeId =
    (map.negativeNodeId || '').trim() || analysis.detected.negativeNodeId;
  const seedNodeId =
    (map.seedNodeId || '').trim() || analysis.detected.seedNodeId;
  const sizeNodeId =
    (map.sizeNodeId || '').trim() || analysis.detected.sizeNodeId;
  const outputNodeId =
    (map.outputNodeId || '').trim() || analysis.detected.outputNodeId;

  const seedUsed =
    typeof options.seed === 'number' && Number.isFinite(options.seed)
      ? Math.max(0, Math.floor(options.seed))
      : Math.floor(Math.random() * 2_147_483_646) + 1;
  const dims = parseImageDimensions(options.size);
  const posText = (options.prompt || '').trim();
  const negText = (options.negativePrompt || '').trim();

  // First replace any explicit placeholders across all nodes
  let replacedPosPlaceholder = false;
  let replacedNegPlaceholder = false;
  for (const node of Object.values(graph)) {
    if (!node?.inputs || typeof node.inputs !== 'object') continue;
    for (const [key, val] of Object.entries(node.inputs)) {
      if (typeof val !== 'string') continue;
      let nextVal = val;
      if (/\{\{\s*prompt\s*\}\}|\$\{prompt\}|%prompt%/i.test(nextVal)) {
        nextVal = nextVal.replace(
          /\{\{\s*prompt\s*\}\}|\$\{prompt\}|%prompt%/gi,
          posText,
        );
        replacedPosPlaceholder = true;
      }
      if (
        /\{\{\s*negative_prompt\s*\}\}|\$\{negative_prompt\}|%negative_prompt%/i.test(
          nextVal,
        )
      ) {
        nextVal = nextVal.replace(
          /\{\{\s*negative_prompt\s*\}\}|\$\{negative_prompt\}|%negative_prompt%/gi,
          negText,
        );
        replacedNegPlaceholder = true;
      }
      if (nextVal !== val) {
        node.inputs[key] = nextVal;
      }
    }
  }

  const appliedBits: string[] = [];

  if (!replacedPosPlaceholder && positiveNodeId && graph[positiveNodeId]) {
    const posNode = graph[positiveNodeId];
    if (!posNode.inputs) posNode.inputs = {};
    const keys = getComfyPromptFieldKeys(posNode);
    if (keys.includes('t5xxl') && keys.includes('clip_l')) {
      posNode.inputs.t5xxl = posText;
      posNode.inputs.clip_l = posText;
    } else if (keys.length > 0) {
      posNode.inputs[keys[0]] = posText;
    } else {
      posNode.inputs.text = posText;
    }
    appliedBits.push(`+prompt=#${positiveNodeId}`);
  } else if (replacedPosPlaceholder) {
    appliedBits.push('+prompt=placeholder');
  }

  if (
    negText &&
    !replacedNegPlaceholder &&
    negativeNodeId &&
    graph[negativeNodeId]
  ) {
    const negNode = graph[negativeNodeId];
    if (!negNode.inputs) negNode.inputs = {};
    const negKeys = getComfyNegativeFieldKeys(negNode);
    if (negativeNodeId === positiveNodeId) {
      if (typeof negNode.inputs.negative === 'string') {
        negNode.inputs.negative = negText;
        appliedBits.push(`-prompt=#${negativeNodeId}`);
      } else if (typeof negNode.inputs.text_negative === 'string') {
        negNode.inputs.text_negative = negText;
        appliedBits.push(`-prompt=#${negativeNodeId}`);
      }
    } else if (negKeys.length > 0) {
      negNode.inputs[negKeys[0]] = negText;
      appliedBits.push(`-prompt=#${negativeNodeId}`);
    } else {
      negNode.inputs.text = negText;
      appliedBits.push(`-prompt=#${negativeNodeId}`);
    }
  } else if (replacedNegPlaceholder) {
    appliedBits.push('-prompt=placeholder');
  }

  if (seedNodeId && graph[seedNodeId]) {
    const seedNode = graph[seedNodeId];
    if (!seedNode.inputs) seedNode.inputs = {};
    if (typeof seedNode.inputs.noise_seed === 'number') {
      seedNode.inputs.noise_seed = seedUsed;
    } else {
      seedNode.inputs.seed = seedUsed;
    }
    appliedBits.push(`seed=#${seedNodeId}(${seedUsed})`);
  }

  if (dims && sizeNodeId && graph[sizeNodeId]) {
    const sizeNode = graph[sizeNodeId];
    if (!sizeNode.inputs) sizeNode.inputs = {};
    if (
      typeof sizeNode.inputs.width === 'number' ||
      map.sizeNodeId?.trim()
    ) {
      sizeNode.inputs.width = dims.width;
    }
    if (
      typeof sizeNode.inputs.height === 'number' ||
      map.sizeNodeId?.trim()
    ) {
      sizeNode.inputs.height = dims.height;
    }
    appliedBits.push(`size=#${sizeNodeId}(${dims.width}x${dims.height})`);
  }

  // Strictly enforce single-image generation (batch_size = 1) so a workflow with batch_size 2..4
  // never renders 2-4 images on ComfyUI before returning 1 image to the game.
  let clampedBatchNodes = 0;
  for (const node of Object.values(graph)) {
    if (!node?.inputs || typeof node.inputs !== 'object') continue;
    const cls = String(node.class_type || '');
    if (typeof node.inputs.batch_size === 'number' && node.inputs.batch_size > 1) {
      node.inputs.batch_size = 1;
      clampedBatchNodes += 1;
    }
    if (
      /RepeatLatentBatch/i.test(cls) &&
      typeof node.inputs.amount === 'number' &&
      node.inputs.amount > 1
    ) {
      node.inputs.amount = 1;
      clampedBatchNodes += 1;
    }
  }
  if (clampedBatchNodes > 0) {
    appliedBits.push(`batch=1(clamped:${clampedBatchNodes})`);
  }

  if (outputNodeId) {
    appliedBits.push(`out=#${outputNodeId}`);
  }

  return {
    ok: true,
    promptGraph: graph,
    outputNodeId,
    appliedSummary: appliedBits.join(', '),
    seedUsed,
  };
}

interface ComfyUiOutputFile {
  filename: string;
  subfolder?: string;
  type?: string;
  directUrl?: string;
}

const activeComfyUiJobsByBaseUrl = new Map<
  string,
  { startedAt: number; promptId: string }
>();

export function isComfyUiBusy(baseUrlRaw?: string): boolean {
  if (!baseUrlRaw) return activeComfyUiJobsByBaseUrl.size > 0;
  const baseUrl = normalizeComfyUiBaseUrl(baseUrlRaw);
  if (!baseUrl) return activeComfyUiJobsByBaseUrl.size > 0;
  return activeComfyUiJobsByBaseUrl.has(baseUrl);
}

function inferComfyUiImageMimeType(
  contentTypeHeader: string | null | undefined,
  filename?: string,
): string {
  const ct = String(contentTypeHeader || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (ct.startsWith('image/')) return ct;
  const ext = String(filename || '')
    .split('?')[0]
    .toLowerCase();
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';
  if (ext.endsWith('.webp')) return 'image/webp';
  if (ext.endsWith('.gif')) return 'image/gif';
  if (ext.endsWith('.avif')) return 'image/avif';
  if (ext.endsWith('.bmp')) return 'image/bmp';
  return 'image/png';
}

function extractComfyUiOutputFile(
  historyEntry: Record<string, unknown>,
  preferredOutputNodeId?: string,
): ComfyUiOutputFile | null {
  const outputs = historyEntry.outputs as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!outputs || typeof outputs !== 'object') return null;

  const pickFromContainer = (
    container: Record<string, unknown> | undefined,
  ): ComfyUiOutputFile[] => {
    if (!container || typeof container !== 'object') return [];
    const collected: ComfyUiOutputFile[] = [];
    const buckets = ['images', 'gifs', 'webp', 'image', 'result', 'png', 'files'];
    for (const bucketKey of buckets) {
      const rawBucket = container[bucketKey];
      const arr = Array.isArray(rawBucket)
        ? rawBucket
        : rawBucket && typeof rawBucket === 'object'
          ? [rawBucket]
          : [];
      for (const item of arr) {
        if (typeof item === 'string' && item.trim()) {
          const trimmed = item.trim();
          if (trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed)) {
            collected.push({ filename: 'inline_output.png', directUrl: trimmed });
          } else {
            collected.push({ filename: trimmed, subfolder: '', type: 'output' });
          }
          continue;
        }
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          const direct =
            typeof rec.url === 'string' && rec.url.trim()
              ? rec.url.trim()
              : typeof rec.b64_json === 'string' && rec.b64_json.trim()
                ? `data:image/png;base64,${rec.b64_json.trim()}`
                : '';
          if (typeof rec.filename === 'string' && rec.filename.trim()) {
            collected.push({
              filename: rec.filename.trim(),
              subfolder:
                typeof rec.subfolder === 'string' ? rec.subfolder : '',
              type: typeof rec.type === 'string' && rec.type.trim() ? rec.type.trim() : 'output',
              ...(direct ? { directUrl: direct } : {}),
            });
          } else if (direct) {
            collected.push({ filename: 'inline_output.png', directUrl: direct });
          }
        }
      }
    }
    return collected;
  };

  const pickFromNodeOutput = (
    nodeOut: Record<string, unknown> | undefined,
  ): ComfyUiOutputFile[] => {
    if (!nodeOut || typeof nodeOut !== 'object') return [];
    const direct = pickFromContainer(nodeOut);
    const nestedUi =
      nodeOut.ui && typeof nodeOut.ui === 'object'
        ? pickFromContainer(nodeOut.ui as Record<string, unknown>)
        : [];
    return [...direct, ...nestedUi];
  };

  const selectBestOutputFile = (
    files: ComfyUiOutputFile[],
  ): ComfyUiOutputFile | null => {
    if (!files.length) return null;
    const savedOutputs = files.filter((f) => f.type === 'output');
    if (savedOutputs.length > 0) {
      return savedOutputs[savedOutputs.length - 1];
    }
    const tempOutputs = files.filter((f) => f.type === 'temp');
    if (tempOutputs.length > 0) {
      return tempOutputs[tempOutputs.length - 1];
    }
    return files[files.length - 1];
  };

  if (preferredOutputNodeId && outputs[preferredOutputNodeId]) {
    const preferredBest = selectBestOutputFile(
      pickFromNodeOutput(outputs[preferredOutputNodeId]),
    );
    if (preferredBest) return preferredBest;
  }

  const allFiles: ComfyUiOutputFile[] = [];
  for (const nodeOut of Object.values(outputs)) {
    allFiles.push(...pickFromNodeOutput(nodeOut));
  }
  return selectBestOutputFile(allFiles);
}

function extractComfyUiExecutionError(
  historyEntry: Record<string, unknown>,
): string {
  const status = historyEntry.status as Record<string, unknown> | undefined;
  if (!status || typeof status !== 'object') return '';
  if (status.status_str !== 'error') return '';
  const messages = Array.isArray(status.messages) ? status.messages : [];
  for (const msg of messages) {
    if (Array.isArray(msg) && msg[0] === 'execution_error' && msg[1]) {
      const detail = msg[1] as Record<string, unknown>;
      const nodeType = String(detail.node_type || detail.node_id || '').trim();
      const excMsg = String(detail.exception_message || '').trim();
      if (excMsg) {
        return nodeType ? `[${nodeType}] ${excMsg}` : excMsg;
      }
    }
  }
  return 'ComfyUI báo lỗi thực thi workflow (status: error).';
}

export async function testComfyUiConnection(options: {
  baseUrlRaw: string;
  workflowJson?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  message: string;
  analysis?: ComfyUiWorkflowAnalysis;
}> {
  const baseUrl = normalizeComfyUiBaseUrl(options.baseUrlRaw);
  if (!baseUrl) {
    return {
      ok: false,
      message: 'Chưa nhập ComfyUI Base URL (ví dụ http://127.0.0.1:8188).',
    };
  }

  const analysis = options.workflowJson?.trim()
    ? analyzeComfyUiWorkflowJson(options.workflowJson)
    : undefined;

  const timed = createTimedAbortSignal(options.signal, options.timeoutMs ?? 20_000);
  const probeUrls = [`${baseUrl}/system_stats`, `${baseUrl}/queue`];
  let lastErr = '';
  try {
    for (const url of probeUrls) {
      const startedAt = Date.now();
      try {
        options.onLog?.(`[ComfyUI] GET ${url}...`);
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: timed.signal,
        });
        const elapsedSec = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000),
        );
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          lastErr = `HTTP ${res.status} tại ${url} (${elapsedSec}s)${
            txt ? `: ${txt.slice(0, 160)}` : ''
          }`;
          options.onLog?.(`[ComfyUI] ${lastErr}`);
          continue;
        }
        let versionHint = '';
        try {
          const json = (await res.json()) as Record<string, unknown>;
          const sys = json.system as Record<string, unknown> | undefined;
          if (sys?.comfyui_version) {
            versionHint = ` · ComfyUI ${String(sys.comfyui_version)}`;
          }
        } catch {
          // ignore non-json stats
        }

        if (analysis && !analysis.ok) {
          const warnMsg = `Kết nối ComfyUI thành công (${elapsedSec}s${versionHint}), nhưng Workflow JSON có lỗi: ${analysis.error}`;
          options.onLog?.(`[ComfyUI] ${warnMsg}`);
          return { ok: false, message: warnMsg, analysis };
        }

        const wfNote = analysis?.ok
          ? ` · Đã nhận diện ${analysis.nodeSummaries.length} node (pos:#${
              analysis.detected.positiveNodeId || '?'
            }, seed:#${analysis.detected.seedNodeId || '?'}, out:#${
              analysis.detected.outputNodeId || '?'
            })`
          : ' · Chưa dán Workflow API JSON';
        const okMsg = `Kết nối ComfyUI thành công (${elapsedSec}s${versionHint}${wfNote}).`;
        options.onLog?.(`[ComfyUI] ${okMsg}`);
        return { ok: true, message: okMsg, analysis };
      } catch (err) {
        if (options.signal?.aborted) {
          return { ok: false, message: 'Đã hủy kiểm tra ComfyUI.' };
        }
        if (timed.didTimeout()) {
          lastErr = `Quá thời gian chờ khi kiểm tra ${url}.`;
          options.onLog?.(`[ComfyUI] ${lastErr}`);
          break;
        }
        lastErr = formatComfyUiFetchError(url, err);
        options.onLog?.(`[ComfyUI] ${lastErr}`);
      }
    }
  } finally {
    timed.cleanup();
  }

  return {
    ok: false,
    message: lastErr || `Không thể kết nối ComfyUI tại ${baseUrl}.`,
    analysis,
  };
}

export async function requestComfyUiImage(options: {
  baseUrlRaw: string;
  workflowJson: string;
  prompt: string;
  negativePrompt?: string;
  size?: string;
  nodeMapping?: ComfyUiNodeMapping;
  signal?: AbortSignal;
  timeoutMs?: number;
  logPrefix?: string;
  onLog?: (line: string) => void;
  onProgress?: (label: string) => void;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  usedUrl?: string;
  promptId?: string;
  error?: string;
  aborted?: boolean;
  timedOut?: boolean;
  busy?: boolean;
}> {
  const {
    baseUrlRaw,
    workflowJson,
    prompt,
    negativePrompt,
    size,
    nodeMapping,
    signal,
    timeoutMs = COMFYUI_REQUEST_TIMEOUT_MS,
    logPrefix = '[ComfyUI]',
    onLog,
    onProgress,
  } = options;

  const log = (msg: string) => {
    onLog?.(logPrefix ? `${logPrefix} ${msg}` : msg);
  };

  const baseUrl = normalizeComfyUiBaseUrl(baseUrlRaw);
  if (!baseUrl) {
    return {
      ok: false,
      error:
        'Chưa cấu hình ComfyUI Base URL. Hãy vào tab Cấu hình để nhập URL máy chủ ComfyUI.',
    };
  }

  // Strict global single-flight lock so overlapping clicks/triggers across ANY view can NEVER fire 2+ prompts at once
  const existingJob =
    activeComfyUiJobsByBaseUrl.get(baseUrl) ||
    activeComfyUiJobsByBaseUrl.values().next().value;
  if (existingJob) {
    const runningSec = Math.max(
      1,
      Math.round((Date.now() - existingJob.startedAt) / 1000),
    );
    const busyMsg = `ComfyUI đang xử lý yêu cầu trước đó (${runningSec}s${
      existingJob.promptId ? `, id=${existingJob.promptId.slice(0, 8)}` : ''
    }). Vui lòng chờ hoàn tất hoặc bấm Hủy trước khi tạo ảnh mới.`;
    log(busyMsg);
    return { ok: false, busy: true, error: busyMsg };
  }

  const prepared = prepareComfyUiWorkflowPrompt({
    workflowJson,
    prompt,
    negativePrompt,
    size,
    nodeMapping,
  });
  if (!prepared.ok || !prepared.promptGraph) {
    return {
      ok: false,
      error:
        prepared.error ||
        'Workflow API JSON của ComfyUI không hợp lệ. Hãy kiểm tra lại trong tab Cấu hình.',
    };
  }

  const startedAt = Date.now();
  const jobRecord = { startedAt, promptId: '' };
  activeComfyUiJobsByBaseUrl.set(baseUrl, jobRecord);

  const timed = createTimedAbortSignal(signal, timeoutMs);
  const clientId = `ark_lite_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const promptEndpoint = `${baseUrl}/prompt`;
  let activePromptId = '';

  const cancelComfyPromptBestEffort = (pid: string, interruptRunning = false) => {
    if (!pid) return;
    try {
      void fetch(`${baseUrl}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({ delete: [pid] }),
      }).catch(() => {});
      if (interruptRunning) {
        void fetch(`${baseUrl}/interrupt`, {
          method: 'POST',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        }).catch(() => {});
      }
    } catch {
      // best-effort cleanup
    }
  };

  const resolveHistoryEntry = (
    histJson: Record<string, unknown>,
    pid: string,
  ): Record<string, unknown> | undefined => {
    const direct = histJson[pid];
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }
    if (histJson.outputs && typeof histJson.outputs === 'object') {
      return histJson;
    }
    // Some proxies wrap or normalize keys case-insensitively
    const pidLower = pid.toLowerCase();
    for (const [k, v] of Object.entries(histJson)) {
      if (
        k.toLowerCase() === pidLower &&
        v &&
        typeof v === 'object' &&
        !Array.isArray(v)
      ) {
        return v as Record<string, unknown>;
      }
    }
    return undefined;
  };

  try {
    // 1. Submit workflow graph ONCE via POST /prompt
    onProgress?.('Đang gửi workflow tới máy chủ ComfyUI...');
    log(
      `POST ${promptEndpoint} (${prepared.appliedSummary || 'workflow mặc định'}, prompt=${prompt.length} ký tự)`,
    );

    const submitRes = await fetch(promptEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: timed.signal,
      body: JSON.stringify({
        prompt: prepared.promptGraph,
        client_id: clientId,
      }),
    });

    if (!submitRes.ok) {
      const errTxt = await submitRes.text().catch(() => '');
      let detail = String(errTxt ?? '').replace(/\s+/g, ' ').trim();
      try {
        const errJson = JSON.parse(errTxt) as Record<string, unknown>;
        const mainErr = extractSeedreamErrorMessage(errJson);
        const nodeErrs =
          errJson.node_errors && typeof errJson.node_errors === 'object'
            ? Object.keys(errJson.node_errors as Record<string, unknown>).join(', ')
            : '';
        detail = [
          mainErr,
          nodeErrs ? `node lỗi: #${nodeErrs}` : '',
        ]
          .filter(Boolean)
          .join(' · ') || detail;
      } catch {
        // plain text error
      }
      const msg = `ComfyUI từ chối workflow (HTTP ${submitRes.status} tại ${promptEndpoint})${
        detail ? `: ${detail.slice(0, 260)}` : ''
      }`;
      log(msg);
      return { ok: false, error: msg };
    }

    const submitJson = (await submitRes.json()) as Record<string, unknown>;
    const promptId =
      typeof submitJson.prompt_id === 'string'
        ? submitJson.prompt_id.trim()
        : '';
    if (!promptId) {
      const msg = `Phản hồi từ ${promptEndpoint} không chứa prompt_id hợp lệ.`;
      log(msg);
      return { ok: false, error: msg };
    }
    activePromptId = promptId;
    jobRecord.promptId = promptId;
    const queueNum =
      typeof submitJson.number === 'number' ? ` #${submitJson.number}` : '';
    onProgress?.('ComfyUI đã xếp hàng (1 ảnh), đang render...');
    log(
      `Đã xếp hàng ComfyUI (prompt_id=${promptId}${queueNum}), đang theo dõi /history/${promptId}...`,
    );

    // 2. Poll GET /history/{prompt_id} (with no-store + cache-buster) until output image is ready
    const historyEndpointBase = `${baseUrl}/history/${encodeURIComponent(promptId)}`;
    let outputFile: ComfyUiOutputFile | null = null;
    let pollCount = 0;
    let consecutivePollErrors = 0;
    let completedEmptyChecks = 0;
    let lastPollErrMsg = '';

    while (!timed.signal.aborted) {
      const slept = await sleepWithAbortSignal(
        pollCount === 0 ? 1_000 : COMFYUI_POLL_INTERVAL_MS,
        timed.signal,
      );
      if (!slept || timed.signal.aborted) break;
      pollCount += 1;
      if (pollCount === 2 || pollCount % 3 === 0) {
        const sec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        onProgress?.(`ComfyUI đang vẽ ảnh (${sec}s)...`);
      }

      // Every 4th poll (after initial polls), also try full /history if /history/{id} stayed empty
      const checkUrls =
        pollCount >= 4 && pollCount % 4 === 0
          ? [
              `${historyEndpointBase}?_t=${Date.now()}`,
              `${baseUrl}/history?_t=${Date.now()}`,
            ]
          : [`${historyEndpointBase}?_t=${Date.now()}`];

      let entry: Record<string, unknown> | undefined;
      let fatalPollError = '';

      for (const pollUrl of checkUrls) {
        if (timed.signal.aborted) break;
        const pollTimed = createTimedAbortSignal(timed.signal, 20_000);
        try {
          const histRes = await fetch(pollUrl, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: pollTimed.signal,
          });

          if (!histRes.ok) {
            if (histRes.status === 404) {
              consecutivePollErrors = 0;
              continue;
            }
            if (
              histRes.status === 408 ||
              histRes.status === 429 ||
              histRes.status >= 500
            ) {
              consecutivePollErrors += 1;
              lastPollErrMsg = `HTTP ${histRes.status} tại ${pollUrl}`;
              if (consecutivePollErrors === 1 || consecutivePollErrors % 3 === 0) {
                log(
                  `Tạm thời gặp ${lastPollErrMsg} khi kiểm tra /history (vẫn tiếp tục chờ prompt_id=${promptId}, không gửi lại workflow)...`,
                );
              }
              continue;
            }
            const errTxt = await histRes.text().catch(() => '');
            fatalPollError = `Lỗi theo dõi lịch sử ComfyUI (HTTP ${histRes.status} tại ${pollUrl})${
              errTxt ? `: ${errTxt.slice(0, 180)}` : ''
            }`;
            break;
          }

          consecutivePollErrors = 0;
          const histJson = (await histRes.json()) as Record<string, unknown>;
          const matched = resolveHistoryEntry(histJson, promptId);
          if (matched) {
            entry = matched;
            break;
          }
        } catch (pollErr) {
          if (signal?.aborted || timed.didTimeout()) {
            break;
          }
          consecutivePollErrors += 1;
          lastPollErrMsg = formatComfyUiFetchError(pollUrl, pollErr);
          if (consecutivePollErrors === 1 || consecutivePollErrors % 3 === 0) {
            log(
              `Mạng chập chờn khi poll /history (lần ${consecutivePollErrors}/10, giữ nguyên prompt_id=${promptId}): ${lastPollErrMsg}`,
            );
          }
        } finally {
          pollTimed.cleanup();
        }
      }

      if (fatalPollError) {
        log(fatalPollError);
        return { ok: false, promptId, error: fatalPollError };
      }

      if (consecutivePollErrors >= 10) {
        const msg = `Mất kết nối liên tiếp khi theo dõi /history/${promptId} tại ${baseUrl}: ${lastPollErrMsg}`;
        log(msg);
        return { ok: false, promptId, error: msg };
      }

      if (!entry) {
        continue;
      }

      const execErr = extractComfyUiExecutionError(entry);
      if (execErr) {
        const msg = `ComfyUI lỗi khi chạy workflow (${promptId}): ${execErr.slice(0, 260)}`;
        log(msg);
        return { ok: false, promptId, error: msg };
      }

      const foundFile = extractComfyUiOutputFile(entry, prepared.outputNodeId);
      if (foundFile) {
        outputFile = foundFile;
        break;
      }

      const statusObj = entry.status as Record<string, unknown> | undefined;
      if (statusObj?.completed === true) {
        completedEmptyChecks += 1;
        // Allow 2 grace polls in case custom save nodes flush outputs right after status.completed flips true
        if (completedEmptyChecks < 3) {
          continue;
        }
        const msg = `ComfyUI đã chạy xong (${promptId}) nhưng không tìm thấy ảnh đầu ra trong /history. Hãy kiểm tra node SaveImage/PreviewImage trong workflow.`;
        log(msg);
        return { ok: false, promptId, error: msg };
      }
    }

    if (signal?.aborted) {
      cancelComfyPromptBestEffort(activePromptId, true);
      return { ok: false, promptId: activePromptId, aborted: true };
    }
    if (timed.didTimeout()) {
      cancelComfyPromptBestEffort(activePromptId, false);
      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 1000),
      );
      const msg = `Quá thời gian chờ (${elapsedSec}s) khi chờ ComfyUI hoàn tất prompt_id=${activePromptId} tại ${baseUrl}.`;
      log(msg);
      return { ok: false, promptId: activePromptId, error: msg, timedOut: true };
    }
    if (!outputFile) {
      return {
        ok: false,
        promptId: activePromptId,
        error: 'Không nhận được tệp ảnh đầu ra từ ComfyUI.',
      };
    }

    // Direct inline data/url output from custom nodes
    if (outputFile.directUrl && outputFile.directUrl.startsWith('data:image/')) {
      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 1000),
      );
      log(`Nhận ảnh ComfyUI trực tiếp thành công (${elapsedSec}s).`);
      return {
        ok: true,
        imageUrl: outputFile.directUrl,
        promptId: activePromptId,
      };
    }

    // 3. Download generated image from GET /view with its own dedicated 45s timeout
    // (never killed by a nearly-expired polling timer!)
    const viewParams = new URLSearchParams({
      filename: outputFile.filename,
      subfolder: outputFile.subfolder || '',
      type: outputFile.type || 'output',
    });
    const viewUrl =
      outputFile.directUrl && /^https?:\/\//i.test(outputFile.directUrl)
        ? outputFile.directUrl
        : `${baseUrl}/view?${viewParams.toString()}`;
    onProgress?.('Đang tải ảnh kết quả từ ComfyUI /view...');
    log(`Đang tải ảnh từ ${viewUrl}...`);

    const downloadTimed = createTimedAbortSignal(signal, 45_000);
    let dataUrl = '';
    let viewFetchErr = '';
    try {
      let viewRes: Response | null = null;
      try {
        viewRes = await fetch(viewUrl, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: downloadTimed.signal,
        });
      } catch (firstErr) {
        if (signal?.aborted) {
          return { ok: false, promptId: activePromptId, aborted: true };
        }
        // Retry once without cache option in case strict CORS proxy rejects it
        try {
          viewRes = await fetch(viewUrl, {
            method: 'GET',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: downloadTimed.signal,
          });
        } catch (secondErr) {
          viewFetchErr = formatComfyUiFetchError(viewUrl, secondErr || firstErr);
        }
      }

      if (viewRes) {
        if (!viewRes.ok) {
          const msg = `Không thể tải ảnh từ ComfyUI /view (HTTP ${viewRes.status} tại ${viewUrl}).`;
          log(msg);
          return { ok: false, promptId: activePromptId, error: msg };
        }
        const arrayBuf = await viewRes.arrayBuffer();
        if (arrayBuf.byteLength > 0) {
          const imageMime = inferComfyUiImageMimeType(
            viewRes.headers.get('content-type'),
            outputFile.filename,
          );
          const typedBlob = new Blob([arrayBuf], { type: imageMime });
          const converted = await blobToDataUrl(typedBlob);
          if (converted && converted.startsWith('data:image/')) {
            dataUrl = converted;
          }
        }
      }
    } finally {
      downloadTimed.cleanup();
    }

    if (signal?.aborted) {
      return { ok: false, promptId: activePromptId, aborted: true };
    }

    const elapsedSec = Math.max(
      1,
      Math.round((Date.now() - startedAt) / 1000),
    );

    if (dataUrl) {
      log(
        `Nhận ảnh ComfyUI thành công (${outputFile.filename}, ${elapsedSec}s).`,
      );
      return {
        ok: true,
        imageUrl: dataUrl,
        usedUrl: viewUrl,
        promptId: activePromptId,
      };
    }

    // Fallback: if fetch(/view) was blocked by CORS on binary download but /history confirmed
    // the file exists, return the direct /view URL so <img> can still render it immediately
    if (viewFetchErr && /^https?:\/\//i.test(viewUrl)) {
      const directRenderUrl = `${viewUrl}${viewUrl.includes('?') ? '&' : '?'}_arkv=${Date.now()}`;
      log(
        `Không thể đọc binary từ /view do CORS (${viewFetchErr}) — chuyển sang hiển thị trực tiếp URL ảnh ${outputFile.filename} (${elapsedSec}s).`,
      );
      return {
        ok: true,
        imageUrl: directRenderUrl,
        usedUrl: viewUrl,
        promptId: activePromptId,
      };
    }

    const emptyMsg = `Dữ liệu ảnh tải từ ${viewUrl} bị rỗng hoặc không hợp lệ.`;
    log(emptyMsg);
    return { ok: false, promptId: activePromptId, error: emptyMsg };
  } catch (err) {
    if (signal?.aborted) {
      cancelComfyPromptBestEffort(activePromptId, true);
      return { ok: false, promptId: activePromptId, aborted: true };
    }
    if (timed.didTimeout()) {
      cancelComfyPromptBestEffort(activePromptId, false);
      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 1000),
      );
      const msg = `Quá thời gian chờ (${elapsedSec}s) khi gọi ComfyUI tại ${baseUrl}${
        activePromptId ? ` (prompt_id=${activePromptId})` : ''
      }.`;
      log(msg);
      return { ok: false, promptId: activePromptId, error: msg, timedOut: true };
    }
    if (err instanceof Error && err.name === 'AbortError') {
      cancelComfyPromptBestEffort(activePromptId, true);
      return { ok: false, promptId: activePromptId, aborted: true };
    }
    const msg = formatComfyUiFetchError(baseUrl, err);
    log(msg);
    return { ok: false, promptId: activePromptId, error: msg };
  } finally {
    timed.cleanup();
    if (activeComfyUiJobsByBaseUrl.get(baseUrl) === jobRecord) {
      activeComfyUiJobsByBaseUrl.delete(baseUrl);
    }
  }
}

const META_BLOCK_TAG_RE =
  /<(thinking|thought|reasoning|analysis|plan|outline|meta|system|ooc|scratchpad|state_update|world_state|memory|summary|incrementalSummary|tableEdit|finish|status|draft|cot|preset)\b[^>]*>[\s\S]*?<\/\1>/gi;

const ORPHAN_CLOSE_THINKING_RE =
  /<\/(?:thinking|thought|reasoning|analysis|plan|outline|scratchpad|cot|preset)\s*>/gi;

const ORPHAN_OPEN_THINKING_RE =
  /<(?:thinking|thought|reasoning|analysis|plan|outline|scratchpad|cot|preset)\b[^>]*>/i;

const CONTAINS_META_NOISE_RE =
  /(?:\bword\s*count\b|\bwords?\s+per\s+paragraph\b|\bplan\s+for\s+(?:the\s+)?stage\b|\bstage\s*\d+\s*[:\-–—(]|\bgoal\s*:|\bgoals\s*:|\bsystem\s*boot\b|\bresource\s*loading\b|\btarget\s*(?:length|word\s*count|words)\b|\b(?:scene|plot|action|stage|writing|paragraph)\s*plan\b|\bcharacter\s*(?:check|voice|consistency|roster)\s*:|\b(?:continuity|self|nsfw|tone|pacing)\s*[- ]?check\b|\b(?:pacing|tone|pov|checklist|constraints?|outline|drafting|reasoning|thinking|thought\s*process|ooc)\s*:|\bbeat\s*\d+\s*:|\b(?:defining\s+the\s+setting|expanding\s+the\s+guest\s+list|crafting\s+the\s+narrative(?:\s+flow)?|analy[sz]ing\s+the\s+aftermath|establishing\s+the\s+(?:scene|setting|atmosphere|tone)|developing\s+the\s+(?:dialogue|scene|plot)|building\s+the\s+(?:tension|scene)|planning\s+the\s+(?:response|scene|narrative)|structuring\s+the\s+(?:response|scene|narrative))\b|\b(?:mục\s*tiêu|số\s*từ|độ\s*dài\s*mục\s*tiêu|kế\s*hoạch\s*(?:cảnh|giai\s*đoạn|viết)|dàn\s*ý|ghi\s*chú\s*hệ\s*thống)\s*:|\[(?:system|ooc|plan|goal|stage|word\s*count|kết\s*thúc|yêu\s*cầu|chế\s*độ\s*bản\s*xem\s*trước|hồ\s*sơ|ảnh\s*đính\s*kèm)[^\]]*\])/i;

const COT_BOLD_OR_SECTION_HEADING_RE =
  /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#+\s*)?(?:\*\*|__)?\s*(?:defining|expanding|crafting|analyzing|analysing|establishing|developing|building|structuring|planning|outlining|reviewing|checking|confirming|verifying|validating|framing|balancing|pacing|refining|introducing|incorporating|exploring|managing|navigating|handling|considering|evaluating|designing|writing|drafting|setting|mapping|tracking|focusing|maintaining|ensuring|assessing|determining|identifying|selecting|orchestrating|weaving|shaping|tuning|adjusting|aligning|synthesizing|brainstorming|finalizing|wrapping|addressing|continuing|deepening|escalating|heightening|concluding|resolving|capturing|portraying|depicting|applying|following|respecting|adhering|preparing|initiating|executing|polishing|formatting|updating|reconciling|integrating|grounding|anchoring|elevating|amplifying|intensifying|layering|immersing|rendering|composing|generating|delivering|completing|finishing|transitioning|shifting)\b[^*\n.!?]{2,95}(?:\*\*|__)?\s*:?\s*$/i;

const ENGLISH_COT_FIRST_PERSON_RE =
  /(?:^\s*(?:I['’]m|I['’]ve|I['’]ll|I['’]d|I\s+(?:need|want|will|should|have|am|plan|intend|decided|aim|think|notice|see|can)\b|Let['’]s\b|My\s+(?:goal|plan|focus|aim|approach)\b|The\s+(?:goal|plan|scene|setting|guest\s+list|narrative|aftermath|user|prompt)\b|Now\s+(?:I['’]ll|I['’]m|let['’]s|for\s+the)\b|First,|Next,|Finally,|Okay,|Alright,|So,|Here['’]s\s+(?:the|my)\b)|\b(?:I['’]m\s+(?:going\s+to|setting|aiming|planning|crafting|expanding|focusing|keeping|making|trying|writing|bringing|having|putting|introducing|weaving|shifting)|I['’]ve\s+(?:set|expanded|added|included|established|crafted|decided|planned|kept|built|chosen|selected)|I['’]ll\s+(?:start|begin|focus|keep|have|make|introduce|weave|describe|show|move|transition|end|close|write)|the\s+user['’]s\s+(?:prompt|request|input|character)|narrative\s+flow|guest\s+list|word\s+count|words?\s+per\s+paragraph|plan\s+for\s+stage)\b)/i;

const META_HEADER_LINE_RE =
  /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#+\s*)?(?:\*\*|__)?\s*(?:(?:plan\s+for\s+(?:the\s+)?stage|word\s*count|words?\s+per\s+paragraph|target\s*word\s*count|system\s*boot|resource\s*loading|scene\s*plan|plot\s*plan|action\s*plan|stage\s*plan|writing\s*plan|defining\s+the\s+setting|expanding\s+the\s+guest\s+list|crafting\s+the\s+narrative(?:\s+flow)?|analy[sz]ing\s+the\s+aftermath)\b.*|(?:goal|goals|objective|target|length|stage\s*\d+|phase\s*\d+|step\s*\d+|part\s*\d+|pacing|tone|pov|perspective|checklist|constraint|constraints|rule|rules|instruction|instructions|reasoning|thinking|thought\s*process|analysis|outline|beat\s*\d*|beats|drafting|execution|review|self-check|verification|ooc|note\s*to\s*self|meta|summary|status|mục\s*tiêu|số\s*từ|độ\s*dài|kế\s*hoạch|giai\s*đoạn\s*\d+|kiểm\s*tra|ghi\s*chú\s*hệ\s*thống|tóm\s*tắt\s*diễn\s*biến)\b(?:\*\*|__)?(?:\s*[:\-–—.\]]|$|\s+\d))/i;

const INLINE_META_NOISE_RE =
  /(?:\(|\[)\s*(?:word\s*count|target\s*word\s*count|words?\s+per\s+paragraph|approx\.?\s*\d+\s*words?|~\s*\d+\s*(?:words?|từ)|số\s*từ|stage\s*\d+|ooc|plan\s+for\s+stage[^)\]]*)\s*(?::[^)\]]*)?(?:\)|\])/gi;

const VIET_DIACRITIC_RE =
  /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

function trimToCleanSentence(text: string | undefined | null, maxLen: number): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen);
  const lastPunct = Math.max(
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('! '),
    sliced.lastIndexOf('? '),
    sliced.lastIndexOf('… '),
    sliced.lastIndexOf('."'),
    sliced.lastIndexOf('.”'),
  );
  if (lastPunct >= Math.floor(maxLen * 0.55)) {
    return sliced.slice(0, lastPunct + 1).trim();
  }
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.7)
    ? sliced.slice(0, lastSpace)
    : sliced
  ).trim();
}

export function stripStoryPlanningAndMeta(raw: string): string {
  let txt = String(raw || '');
  if (!txt.trim()) return '';

  // 1. Strip paired reasoning/system XML tags, private <wave_mind> / off-stage <wave_parallel> cards, and beat image prompt blocks
  txt = txt
    .replace(/<story_image_prompts\b[^>]*>[\s\S]*?(?:<\/story_image_prompts>|$)/gi, '\n')
    .replace(/<image_prompts\b[^>]*>[\s\S]*?(?:<\/image_prompts>|$)/gi, '\n')
    .replace(/<wave_mind\b[^>]*>[\s\S]*?(?:<\/wave_mind>|$)/gi, '\n')
    .replace(/<wave_parallel\b[^>]*>[\s\S]*?(?:<\/wave_parallel>|$)/gi, '\n')
    .replace(META_BLOCK_TAG_RE, '\n');

  // 2. If an orphan closing </thinking> / </plan> remains (e.g. from prefill-started thinking),
  // drop everything up to and including the last orphan closing tag when narrative follows it.
  let lastCloseEnd = -1;
  let closeMatch: RegExpExecArray | null;
  ORPHAN_CLOSE_THINKING_RE.lastIndex = 0;
  while ((closeMatch = ORPHAN_CLOSE_THINKING_RE.exec(txt)) !== null) {
    lastCloseEnd = closeMatch.index + closeMatch[0].length;
  }
  if (lastCloseEnd >= 0) {
    const afterClose = txt.slice(lastCloseEnd).trim();
    if (afterClose) {
      txt = afterClose;
    }
  }

  // 3. Handle unclosed <thinking>/<plan> opening tag by keeping only non-meta narrative after it
  const openMatch = ORPHAN_OPEN_THINKING_RE.exec(txt);
  if (openMatch) {
    const beforeOpen = txt.slice(0, openMatch.index).trim();
    const afterOpen = txt.slice(openMatch.index + openMatch[0].length);
    const afterParas = afterOpen.split(/\n{2,}/);
    const proseIdx = afterParas.findIndex(
      (p) =>
        p.trim() &&
        !CONTAINS_META_NOISE_RE.test(p) &&
        !META_HEADER_LINE_RE.test(p.trim()) &&
        !COT_BOLD_OR_SECTION_HEADING_RE.test(p.trim()) &&
        VIET_DIACRITIC_RE.test(p),
    );
    const recoveredAfter =
      proseIdx >= 0 ? afterParas.slice(proseIdx).join('\n\n').trim() : '';
    txt = [beforeOpen, recoveredAfter].filter(Boolean).join('\n\n');
  }

  // 4. Cut post-story meta blocks ([KẾT THÚC PHẦN TRUYỆN], <tableEdit>, #0 Thông tin Hiện tại...)
  txt = splitNarrativeAndMeta(txt, false).mainText;
  txt = txt
    .replace(META_BLOCK_TAG_RE, '\n')
    .replace(
      /<\/?(?:thinking|thought|reasoning|analysis|plan|outline|meta|system|ooc|scratchpad|chathistory|response|story|narrative|draft|cot|preset)[^>]*>/gi,
      '',
    )
    .replace(INLINE_META_NOISE_RE, ' ');

  // 5. Filter paragraph-by-paragraph and line-by-line (handles English CoT even when Vietnamese character names like "Uyển Nhi" appear inside)
  const rawParagraphs = txt.split(/\n{2,}/);
  const hasVietnameseProse = rawParagraphs.some(
    (p) =>
      VIET_DIACRITIC_RE.test(p) &&
      !CONTAINS_META_NOISE_RE.test(p) &&
      !META_HEADER_LINE_RE.test(p.trim()) &&
      !COT_BOLD_OR_SECTION_HEADING_RE.test(p.trim()) &&
      !isEnglishThinkingHeadingLine(p.trim()) &&
      !isEnglishThinkingBlock(p, false),
  );

  const keptParagraphs: string[] = [];

  for (const para of rawParagraphs) {
    // Drop English CoT/thinking/planning paragraphs even if they quote Vietnamese proper names (e.g. **Defining Uyển Nhi's Presence**)
    if (
      isEnglishThinkingBlock(para, hasVietnameseProse) ||
      (hasVietnameseProse &&
        !VIET_DIACRITIC_RE.test(para) &&
        (COT_BOLD_OR_SECTION_HEADING_RE.test(para.trim()) ||
          isEnglishTitleCaseHeadingLine(para.trim()) ||
          ENGLISH_COT_FIRST_PERSON_RE.test(para) ||
          CONTAINS_META_NOISE_RE.test(para) ||
          META_HEADER_LINE_RE.test(para.trim())))
    ) {
      continue;
    }

    const rawLines = para.split(/\r?\n/);
    const keptLines: string[] = [];
    let inPlanBlock = false;
    let droppedMetaInPara = 0;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed || /^[-*_]{3,}$/.test(trimmed)) {
        inPlanBlock = false;
        continue;
      }

      if (
        META_HEADER_LINE_RE.test(trimmed) ||
        COT_BOLD_OR_SECTION_HEADING_RE.test(trimmed) ||
        isEnglishThinkingHeadingLine(trimmed) ||
        isEnglishTitleCaseHeadingLine(trimmed) ||
        CONTAINS_META_NOISE_RE.test(trimmed)
      ) {
        inPlanBlock = true;
        droppedMetaInPara += 1;
        continue;
      }

      if (inPlanBlock) {
        const looksLikePlanSubLine =
          /^(?:[-*+•]\s+|\d+[.)]\s+|stage\s*\d+|beat\s*\d+|step\s*\d+|part\s*\d+)/i.test(
            trimmed,
          ) ||
          /^[A-Za-z][A-Za-z\s/&'-]{1,32}:\s*/.test(trimmed) ||
          isEnglishThinkingBlock(trimmed, hasVietnameseProse) ||
          (hasVietnameseProse && !VIET_DIACRITIC_RE.test(trimmed));
        if (looksLikePlanSubLine) {
          droppedMetaInPara += 1;
          continue;
        }
        inPlanBlock = false;
      }

      // Preserve quoted dialogue/lyrics and music-marked lines (including English or bilingual rap bars)
      const isQuotedOrMusicLine =
        /^[""“«'♪♫]/.test(trimmed) ||
        /[♪♫]/.test(trimmed) ||
        /^\[(?:verse|hook|chorus|bridge|intro|outro|pre-chorus|bar\s*\d)[^\]]*\]/i.test(
          trimmed,
        );

      // Skip English-only or English-CoT lines (including lines referencing Vietnamese names) when the story itself is in Vietnamese
      if (
        !isQuotedOrMusicLine &&
        (isEnglishThinkingBlock(trimmed, hasVietnameseProse) ||
          (hasVietnameseProse &&
            !VIET_DIACRITIC_RE.test(trimmed) &&
            (/^(?:[-*+•]\s+|\d+[.)]\s+)/.test(trimmed) ||
              /^[A-Za-z][A-Za-z\s/&'-]{1,32}:\s*/.test(trimmed) ||
              ENGLISH_COT_FIRST_PERSON_RE.test(trimmed) ||
              /\b(?:paragraph|paragraphs|dialogue|narration|narrator|character|scene|stage|focus on|describe|transition|maintain|ensure|keep|avoid|establish|introduce|highlight|guest list|narrative flow|aftermath)\b/i.test(
                trimmed,
              ))))
      ) {
        droppedMetaInPara += 1;
        continue;
      }

      const cleanedLine = trimmed
        .replace(/[*_`~#>]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanedLine) {
        keptLines.push(cleanedLine);
      }
    }

    // If a paragraph was predominantly planning/outline notes with English fragments left over, skip it
    if (
      keptLines.length &&
      !(
        droppedMetaInPara > 0 &&
        hasVietnameseProse &&
        !VIET_DIACRITIC_RE.test(keptLines.join(' '))
      )
    ) {
      // Preserve newline boundaries so words from different lines never fuse together
      keptParagraphs.push(keptLines.join('\n'));
    }
  }

  // 6. Final sentence-level safety scrub so zero planning/CoT phrases can ever leak through
  const joined = keptParagraphs.join('\n').trim();
  const safeLines = joined
    .split(/\n+/)
    .map((line) => {
      const safeSentences = line
        .split(/(?<=[.!?…])\s+/)
        .map((s) => s.trim())
        .filter((s) => {
          if (!s) return false;
          if (CONTAINS_META_NOISE_RE.test(s)) return false;
          if (
            hasVietnameseProse &&
            !VIET_DIACRITIC_RE.test(s) &&
            ENGLISH_COT_FIRST_PERSON_RE.test(s)
          ) {
            return false;
          }
          return true;
        });
      return safeSentences.join(' ').replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);

  return safeLines.join('\n').trim();
}

export function extractCleanStoryScene(
  rawAssistant: string,
  rawUser: string,
): string {
  const narrative = stripStoryPlanningAndMeta(rawAssistant);
  if (narrative) {
    return trimToCleanSentence(narrative, 500);
  }
  const userFallback = stripStoryPlanningAndMeta(rawUser);
  return userFallback ? trimToCleanSentence(userFallback, 320) : '';
}

const NON_PERSON_ACRONYMS = new Set([
  'VIP',
  'CEO',
  'CFO',
  'CTO',
  'COO',
  'DJ',
  'MC',
  'PR',
  'HR',
  'IT',
  'AI',
  'UI',
  'UX',
  'VR',
  'AR',
  'OK',
  'DM',
  'IG',
  'FB',
  'TV',
  'LED',
  'LCD',
  'ID',
  'SMS',
  'GPS',
  'USB',
  'PDF',
  'URL',
  'API',
  'HTTP',
  'HTML',
  'JSON',
  'ATM',
  'BMW',
  'SUV',
  'DNA',
  'LA',
  'NY',
  'NYC',
  'UK',
  'US',
  'USA',
  'VN',
  'EU',
  'UN',
  'FBI',
  'CIA',
  'SWAT',
  'NBA',
  'NFL',
  'UFC',
  'WWE',
  'BBQ',
  'KTV',
  'OOC',
  'POV',
  'NPC',
  'HP',
  'MP',
  'XP',
  'RPG',
  'FPS',
  'SFX',
  'BGM',
  'HUD',
  'AM',
  'PM',
  'BC',
  'AD',
  'LV',
  'YSL',
  'CDG',
  'NYC',
  'VIP',
]);

const LEADING_NON_NAME_EXACT_LOWER = new Set([
  'mình',
  'họ',
  'đó',
  'năm',
  'từng',
  'đừng',
  'đúng',
  'nhưng',
  'những',
  'chị',
  'chỉ',
  'hai',
  'ba',
  'bà',
  'cô',
  'tôi',
  'anh',
  'em',
  'cậu',
  'ông',
  'nàng',
  'hắn',
  'gã',
  'nếu',
  'vì',
  'bởi',
  'nên',
  'còn',
  'cũng',
  'vẫn',
  'lại',
  'chợt',
  'bỗng',
  'ngay',
  'thậm',
  'không',
  'chưa',
  'hay',
  'một',
  'bốn',
  'mỗi',
  'các',
  'cả',
  'toàn',
  'đây',
  'kia',
  'nơi',
  'chỗ',
  'với',
  'của',
  'từ',
  'đến',
  'về',
  'cho',
  'theo',
  'như',
  'tại',
  'ở',
]);

const LEADING_NON_NAME_WORDS = new Set([
  'trong',
  'ngoai',
  'tren',
  'duoi',
  'giua',
  'ben',
  'sau',
  'truoc',
  'khi',
  'luc',
  'vua',
  'dang',
  'da',
  'se',
  'roi',
  'tuy',
  'neu',
  'vi',
  'boi',
  'nen',
  'con',
  'cung',
  'van',
  'lai',
  'chot',
  'bong',
  'ngay',
  'tham',
  'khong',
  'chua',
  'hay',
  'mot',
  'bon',
  'moi',
  'cac',
  'ca',
  'toan',
  'day',
  'kia',
  'noi',
  'cho',
  'voi',
  'cua',
  'tu',
  'den',
  've',
  'theo',
  'nhu',
  'tai',
  'o',
  'em',
  'cau',
  'ong',
  'toi',
  'ta',
  'chung',
  'nguoi',
  'nang',
  'han',
  'ga',
  'nho',
  'be',
  'rapper',
  'ca',
  'sieu',
  'dien',
  'nghe',
  'bac',
  'giao',
  'su',
  'tieu',
  'thieu',
  'cong',
  'nhin',
  'thay',
  'gap',
  'hoi',
  'dap',
  'noi',
  'cuoi',
  'buoc',
  'quay',
  'ngoi',
  'dung',
  'cam',
  'nang',
  'dua',
  'goi',
  'the',
  'and',
  'with',
  'from',
  'near',
  'next',
  'while',
  'when',
  'then',
  'after',
  'before',
  'where',
  'here',
  'there',
  'this',
  'that',
  'these',
  'those',
]);

const NON_PERSON_PHRASES = new Set([
  'los angeles',
  'new york',
  'new york city',
  'beverly hills',
  'hollywood hills',
  'las vegas',
  'san francisco',
  'hong kong',
  'south korea',
  'united states',
  'united kingdom',
  'viet nam',
  'sai gon',
  'ha noi',
  'da nang',
  'thuong hai',
  'bac kinh',
  'rolls royce',
  'louis vuitton',
  'chrome hearts',
  'saint laurent',
  'bottega veneta',
  'ralph lauren',
  'dom perignon',
  'audemars piguet',
  'patek philippe',
  'richard mille',
  'mercedes benz',
  'aston martin',
  'range rover',
  'balenciaga',
  'met gala',
  'fashion week',
  'after party',
  'vip lounge',
  'rooftop bar',
  'word count',
  'plan for',
  'system boot',
  'resource loading',
]);

const normalizeNameKey = normalizeCharacterKey;

export function extractPresentCharactersFromScene(
  cleanSceneText: string,
  state: ArkState,
): string[] {
  const text = String(cleanSceneText || '').trim();
  if (!text) return [];

  // Strip simulated group-chat / messaging blocks first so chat-only members never auto-spawn as NPCs
  const sceneOnlyText = stripNonSceneChatBlocks(text);
  if (!sceneOnlyText.trim()) return [];
  const unquotedNarrative = stripQuotedMediaAndDialogue(sceneOnlyText);

  const found: Array<{ name: string; pos: number; priority: number }> = [];

  const activeComp = getStoryBoundCompanionFromState(state);
  const allowedKnownKeys = buildAllowedRosterKeys(activeComp, state.player?.name);
  const cultivationBlockedKeys = buildCultivationNonNpcKeys(
    state.memory?.cultivation,
  );

  // Extract explicit teasing/parody nickname declarations ("gọi trêu X là Y", "chế tên X thành Y")
  const teasingPairs = extractTeasingNicknamePairsFromText(sceneOnlyText);
  const teasingAliasToCanonical = new Map<string, string>();
  const standaloneTeasingKeys = new Set<string>();
  for (const pair of teasingPairs) {
    const nickKey = normalizeNameKey(pair.nickname);
    if (!nickKey) continue;
    if (pair.canonical) {
      teasingAliasToCanonical.set(nickKey, pair.canonical);
    } else {
      standaloneTeasingKeys.add(nickKey);
    }
  }

  // 1. Known roster characters (active companion NPCs, canon candidates, MC, player)
  // Require direct in-scene presence (not just mentioned in passing or inside group chats)
  const mcNamesNorm = new Set(
    [activeComp?.mc?.name || '', state.player?.name || '']
      .map((s) => normalizeNameKey(s))
      .filter((s) => s.length >= 2),
  );
  const knownNames = [
    ...(activeComp?.npcs || []).map((n) => n.name),
    ...(activeComp?.canonCandidates || []).map((c) => c.name),
    ...(state.portraitBank?.portraits || [])
      .filter(
        (p) =>
          p.isMc ||
          !isInvalidNpcPortrait(p, allowedKnownKeys, cultivationBlockedKeys),
      )
      .map((p) => p.name),
    activeComp?.mc?.name || '',
    activeComp?.mc?.canonMcName || '',
    state.player?.name || '',
  ]
    .map((s) => String(s || '').trim())
    .filter((s) => s.length >= 2 && !isShortCodeOrBracketedJunkName(s))
    .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);

  const registerName = (
    rawName: string,
    pos: number,
    priority = 1,
    skipPresenceCheck = false,
  ) => {
    const rawTrim = String(rawName || '').trim();
    if (!rawTrim || isShortCodeOrBracketedJunkName(rawTrim)) return;
    const rawKey = normalizeNameKey(rawTrim);
    if (!rawKey) return;

    let resolvedCandidate = rawTrim;
    let resolvedFromVariant = false;
    if (teasingAliasToCanonical.has(rawKey)) {
      resolvedCandidate = teasingAliasToCanonical.get(rawKey)!;
      resolvedFromVariant = true;
    } else if (standaloneTeasingKeys.has(rawKey)) {
      return;
    } else {
      const variantTarget = findCanonicalVariantMatch(rawTrim, [
        ...knownNames,
        ...found.map((f) => f.name),
      ]);
      if (variantTarget) {
        resolvedCandidate = variantTarget;
        resolvedFromVariant = true;
      } else if (isPlayfulTeasingOrParodyName(rawTrim, allowedKnownKeys)) {
        return;
      }
    }

    if (
      isShortCodeOrBracketedJunkName(resolvedCandidate) ||
      isNonPersonCultivationOrWorldTerm(
        resolvedCandidate,
        cultivationBlockedKeys,
      )
    ) {
      return;
    }

    const cleaned = sanitizeCharacterName(
      resolvedCandidate,
      allowedKnownKeys,
      cultivationBlockedKeys,
    );
    if (!cleaned) return;
    const key = normalizeNameKey(cleaned);
    if (!key || NON_PERSON_PHRASES.has(key)) return;
    if (NON_PERSON_ACRONYMS.has(cleaned)) return;
    if (LEADING_NON_NAME_WORDS.has(key)) return;
    if (isChatOrNonPersonDescription(cleaned)) return;
    if (
      !isExplicitCharacterDesignation(cleaned) &&
      isGenericUnnamedFillerNpcName(cleaned, allowedKnownKeys)
    ) {
      return;
    }
    if (
      !resolvedFromVariant &&
      isPlayfulTeasingOrParodyName(cleaned, allowedKnownKeys)
    ) {
      return;
    }
    if (!skipPresenceCheck) {
      const presence = analyzeCharacterDirectPresence(sceneOnlyText, cleaned, {
        allowHonorificShortName: true,
      });
      const rawPresence = resolvedFromVariant
        ? analyzeCharacterDirectPresence(sceneOnlyText, rawTrim, {
            allowHonorificShortName: true,
          })
        : null;
      if (presence.directCount <= 0 && (rawPresence?.directCount ?? 0) <= 0) {
        return;
      }
    }
    found.push({ name: cleaned, pos, priority });
  };

  for (const kn of knownNames) {
    const knNorm = normalizeNameKey(kn);
    if (!knNorm) continue;
    if (isCharacterExplicitlyAbsent(sceneOnlyText, kn, mcNamesNorm.has(knNorm))) {
      continue;
    }
    const presence = analyzeCharacterDirectPresence(sceneOnlyText, kn, {
      allowHonorificShortName: true,
    });
    if (presence.directCount > 0) {
      registerName(
        kn,
        presence.firstDirectIndex >= 0 ? presence.firstDirectIndex : 0,
        3,
        true,
      );
    }
  }

  // 2. Known real-world celebrities / canon figures ONLY when directly present in the scene
  // (Replaces the old blind [A-Z]{2,5} acronym regex that falsely matched SM, YG, JYP, HYBE...)
  for (const hit of findKnownCelebritiesInText(sceneOnlyText)) {
    if (isCharacterExplicitlyAbsent(sceneOnlyText, hit.displayName, false)) {
      continue;
    }
    const presence = analyzeCharacterDirectPresence(
      sceneOnlyText,
      hit.displayName,
    );
    if (presence.directCount > 0) {
      registerName(
        hit.displayName,
        presence.firstDirectIndex >= 0 ? presence.firstDirectIndex : 0,
        2,
        true,
      );
    }
  }

  // 3. Dialogue speaker prefix at line start in real in-scene prose (excluding messaging verbs like "nhắn")
  const speakerPrefixRe =
    /^(?:[—–-]\s*)?([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}-]{1,20}(?:\s+[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}-]{1,20}){0,2})\s*(?::\s*[“"«]|(?:nói|đáp|hỏi|cười|thầm\s+thì|nhắc|thở\s+dài|khẽ\s+nói|ngắt\s+lời)[^:\n]{0,28}:\s*[“"«])/u;

  const isLeadingNonNameWord = (rawWord: string): boolean => {
    const low = rawWord.trim().toLowerCase();
    if (!low) return true;
    if (LEADING_NON_NAME_EXACT_LOWER.has(low)) return true;
    return LEADING_NON_NAME_WORDS.has(normalizeNameKey(low));
  };

  const sceneLines = sceneOnlyText.split(/\n+/);
  let sceneLineOffset = 0;
  for (const line of sceneLines) {
    const trimmed = line.trim();
    const spMatch = trimmed.match(speakerPrefixRe);
    if (spMatch && spMatch[1]) {
      const spWords = spMatch[1].split(/\s+/);
      while (spWords.length > 1 && isLeadingNonNameWord(spWords[0])) {
        spWords.shift();
      }
      const spCand = spWords.join(' ').trim();
      if (spCand && !isLeadingNonNameWord(spCand)) {
        registerName(spCand, sceneLineOffset, 2, false);
      }
    }
    sceneLineOffset += line.length + 1;
  }

  // 3b. Explicit active Vietnamese character designations (e.g. "Lão nhân nón lá", "Chưởng quỹ tiệm đan", "Hộ vệ áo đen")
  // Extracted ONLY when followed by a concrete human speech/action verb within the same sentence
  const explicitDesignationRe =
    /(?<![\p{L}\p{N}])((?:Lão\s+nhân|Ông\s+lão|Bà\s+lão|Lão\s+giả|Chưởng\s+quỹ|Chủ\s+tiệm|Hộ\s+vệ|Thị\s+vệ|Trưởng\s+lão|Chưởng\s+môn|Tông\s+chủ|Sư\s+tôn|Sư\s+phụ|Sư\s+huynh|Sư\s+tỷ|Sư\s+muội|Sư\s+đệ|Đạo\s+hữu|Đạo\s+trưởng|Tiền\s+bối|Kiếm\s+khách|Đan\s+sư|Tiên\s+tử|Công\s+tử|Tiểu\s+thư|Thiếu\s+chủ|Hắc\s+y\s+nhân|Bạch\s+y\s+nhân)\s+[\p{L}][\p{Ll}\p{Lu}-]{1,16}(?:\s+[\p{L}][\p{Ll}\p{Lu}-]{1,16}){0,2})(?=\s+(?:nói|đáp|hỏi|cười|khẽ|mỉm|gật|lắc|nhíu|cau|quay|ngước|nhìn|bước|tiến|chắp|hành|vẫy|phất|dừng|chắn|rút|đưa|trao|ngồi|đứng|thở|lên\s+tiếng|cất\s+giọng|buông\s+lời|quát|hừ|truyền\s+âm)|:)/gu;

  // 4. Multi-word proper names & titled single names scanned on unquoted narrative only
  // (avoids song titles in quotes, dialogue mentions, cultivation terms, and single-letter stage tails like "Low G")
  const multiWordRe =
    /(?<![\p{L}\p{N}])((?:(?:O|D|L|Mc)['’])?[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}\p{Lu}-]*(?:-[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}-]+)?(?:\s+(?:(?:van|von|de|del|la|le|da|di|du)\s+)?(?:(?:O|D|L|Mc)['’])?[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}\p{Lu}-]*(?:['’]s)?){1,3})(?![\p{L}\p{N}])/gu;

  const titledSingleRe =
    /\b(?:anh|chị|cô|cậu|ông|bà|em|nàng|hắn|gã|sư\s+tỷ|sư\s+huynh|sư\s+muội|sư\s+đệ|trưởng\s+lão|đạo\s+hữu|tiền\s+bối|chưởng\s+quỹ|công\s+tử|tiểu\s+thư)\s+([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][\p{Ll}-]{2,})(?![\p{L}\p{N}])/gu;

  const honorificPrefixCheckRe =
    /(?:^|[\s,.;:!?("“«—-])(?:anh|chị|cô|em|chú|bác|ông|bà|cậu|nàng|chàng|tiểu\s+thư|công\s+tử|thiếu\s+gia|thiếu\s+chủ|ngài|lão|thầy|sư\s+tỷ|sư\s+huynh|sư\s+muội|sư\s+đệ|sư\s+phụ|sư\s+tôn|trưởng\s+lão|đạo\s+hữu|đạo\s+trưởng|tiền\s+bối|chưởng\s+quỹ|chưởng\s+môn|tông\s+chủ|lão\s+nhân|tiên\s+tử)\s+$/iu;

  const narrativeLines = unquotedNarrative.split(/\n+/);
  let narrativeLineOffset = 0;
  for (const line of narrativeLines) {
    let m: RegExpExecArray | null;

    explicitDesignationRe.lastIndex = 0;
    while ((m = explicitDesignationRe.exec(line)) !== null) {
      const desigCand = (m[1] || '').trim();
      if (desigCand && isExplicitCharacterDesignation(desigCand)) {
        registerName(desigCand, narrativeLineOffset + m.index, 2, false);
      }
    }

    multiWordRe.lastIndex = 0;
    while ((m = multiWordRe.exec(line)) !== null) {
      const words = m[1].split(/\s+/);
      while (words.length > 1 && isLeadingNonNameWord(words[0])) {
        words.shift();
      }
      if (words.length >= 2) {
        const candidate = words.join(' ');
        // Do NOT allow single-letter trailing tokens (blocks "Low G", "J B", etc.)
        if (
          !words.every(
            (w) =>
              w.length >= 2 ||
              /^(?:de|la|le|da|di|du|van|von)$/i.test(w),
          )
        ) {
          continue;
        }
        if (
          isNonPersonCultivationOrWorldTerm(candidate, cultivationBlockedKeys)
        ) {
          continue;
        }

        const candKey = normalizeNameKey(candidate);
        const isKnownOrCeleb =
          allowedKnownKeys.has(candKey) ||
          Boolean(lookupKnownCelebrityProfile(candidate));
        const isExplicitDesig = isExplicitCharacterDesignation(candidate);

        if (!isKnownOrCeleb && !isExplicitDesig) {
          const beforeRaw = line.slice(Math.max(0, m.index - 55), m.index);
          const afterRaw = line.slice(
            m.index + m[0].length,
            Math.min(line.length, m.index + m[0].length + 75),
          );
          const beforeSent = beforeRaw.split(/[.!?;]/).pop() || '';
          const afterSent = afterRaw.split(/[.!?;]/)[0] || '';
          const beforeNorm = normalizeNameKey(beforeSent);
          const afterNorm = normalizeNameKey(afterSent);

          // Skip phrases immediately preceded by item/place/realm/technique cues ("cầm lấy ...", "tại ...", "đột phá ...")
          if (NON_ACTOR_PRE_CONTEXT_RE.test(beforeNorm.slice(-42))) {
            continue;
          }

          // For unknown 2-word Vietnamese capitalized phrases that do NOT begin with a real personal surname,
          // require direct active human-actor context or explicit personal honorific (blocks stray poetic prose nouns)
          const hasViDiacritics = /[\u00C0-\u024F\u1E00-\u1EFF]/.test(candidate);
          if (
            hasViDiacritics &&
            words.length === 2 &&
            !hasPersonSurnameStart(candidate)
          ) {
            const hasActiveHumanCue =
              honorificPrefixCheckRe.test(beforeSent) ||
              SUBJECT_ACTIVE_VERB_AFTER_RE.test(afterNorm) ||
              INTERACT_WITH_PERSON_BEFORE_RE.test(beforeNorm);
            if (!hasActiveHumanCue) {
              continue;
            }
          }
        }

        registerName(candidate, narrativeLineOffset + m.index, 1, false);
      }
    }

    titledSingleRe.lastIndex = 0;
    while ((m = titledSingleRe.exec(line)) !== null) {
      const single = m[1];
      if (
        !isLeadingNonNameWord(single) &&
        !isNonPersonCultivationOrWorldTerm(single, cultivationBlockedKeys)
      ) {
        registerName(single, narrativeLineOffset + m.index, 1, false);
      }
    }

    narrativeLineOffset += line.length + 1;
  }

  // 5. Deduplicate using canonical identity keys + inline real-name/stage-name alias pairs
  const inlineAliasPairs = extractInlineAliasPairsFromText(sceneOnlyText);
  const inlineAliasMap = new Map<string, Set<string>>();
  for (const pair of inlineAliasPairs) {
    const kA = normalizeNameKey(pair.primary);
    const kB = normalizeNameKey(pair.alias);
    if (!kA || !kB) continue;
    if (!inlineAliasMap.has(kA)) inlineAliasMap.set(kA, new Set([kA]));
    if (!inlineAliasMap.has(kB)) inlineAliasMap.set(kB, new Set([kB]));
    inlineAliasMap.get(kA)!.add(kB);
    inlineAliasMap.get(kB)!.add(kA);
  }

  found.sort((a, b) => a.pos - b.pos || b.priority - a.priority);
  const unique: Array<{
    name: string;
    key: string;
    aliasKeys: Set<string>;
    pos: number;
    priority: number;
  }> = [];

  for (const item of found) {
    const key = normalizeNameKey(item.name);
    if (!key) continue;
    const idObj = collectCharacterIdentityKeys(item.name);
    const aliasKeys = new Set<string>(idObj.aliasKeys);
    const extraAliases = inlineAliasMap.get(key);
    if (extraAliases) {
      for (const ea of extraAliases) aliasKeys.add(ea);
    }

    const dupIdx = unique.findIndex((u) => {
      for (const ak of aliasKeys) {
        if (u.aliasKeys.has(ak)) return true;
      }
      // Teasing / pun / nickname variant shadow (e.g. "Jacob Elordeep" <-> "Jacob Elordi")
      if (
        isTeasingOrSpellingVariantOf(item.name, u.name) ||
        isTeasingOrSpellingVariantOf(u.name, item.name)
      ) {
        return true;
      }
      // Short/full word-boundary shadow (e.g. "Jennie" <-> "Jennie Kim")
      const isSingleItem = !key.includes(' ');
      const isSingleU = !u.key.includes(' ');
      if (isSingleItem !== isSingleU) {
        const full = isSingleItem ? u.key : key;
        const short = isSingleItem ? key : u.key;
        if (
          short.length >= 3 &&
          (full.startsWith(`${short} `) || full.endsWith(` ${short}`))
        ) {
          return true;
        }
      }
      return false;
    });

    if (dupIdx >= 0) {
      const existing = unique[dupIdx];
      const itemIsParody = isPlayfulTeasingOrParodyName(
        item.name,
        allowedKnownKeys,
      );
      const existingIsParody = isPlayfulTeasingOrParodyName(
        existing.name,
        allowedKnownKeys,
      );
      // Prefer canonical non-parody name, fuller multi-word name, or higher priority roster name
      if (
        (existingIsParody && !itemIsParody) ||
        (!itemIsParody &&
          ((item.name.includes(' ') && !existing.name.includes(' ')) ||
            item.priority > existing.priority))
      ) {
        existing.name = item.name;
        existing.key = key;
        existing.priority = Math.max(existing.priority, item.priority);
      }
      for (const ak of aliasKeys) existing.aliasKeys.add(ak);
      continue;
    }

    unique.push({
      name: item.name,
      key,
      aliasKeys,
      pos: item.pos,
      priority: item.priority,
    });
  }

  return unique.map((item) => item.name).slice(0, 10);
}

export interface StoryImagePromptContextResult {
  variables: Record<string, string>;
  subjectLabel: string;
  presentCharacters: string[];
  newCharacters: string[];
  defaultPartsPrompt: string;
  personCount: number;
  headcountLock: string;
  headcountNegative: string;
  visualLightingCue: string;
  lockedCharacterBriefs: string[];
  lockedIdentities: ResolvedImageCharacterIdentity[];
  beatProseSlice: string;
  currentLocation: string;
  isAiPromptCleanEnglish: boolean;
}

export interface ResolvedImageCharacterIdentity {
  canonicalName: string;
  matchedDisplay?: string;
  portraitId?: string;
  avatarImageData?: string;
  referenceImageData?: string;
  anchorImageData?: string;
  identityLock?: CharacterIdentityLock;
  avatarVisualLock?: string;
  avatarLockSourceSig?: string;
  isMc: boolean;
  role: string;
  age?: string;
  ageNum?: number;
  birthYear?: number;
  gender?: string;
  appearance: string;
  fashionStyle?: string;
  signature?: string;
  mood?: string;
  hasConcreteVisual: boolean;
}

export function computeAvatarSignature(imageData?: string | null): string {
  const raw = String(imageData || '').trim();
  if (!raw) return '';
  return `${raw.length}:${raw.slice(0, 48)}:${raw.slice(-32)}`;
}

export function hasAnyCharacterIdentityLock(
  lock?: CharacterIdentityLock | null,
): boolean {
  if (!lock) return false;
  return Boolean(
    lock.gender?.trim() ||
      lock.facialFeatures?.trim() ||
      lock.hairstyle?.trim() ||
      lock.signatureStyle?.trim() ||
      lock.fixedTags?.trim(),
  );
}

export function mergeCharacterIdentityLock(
  existing?: CharacterIdentityLock,
  incoming?: CharacterIdentityLock,
  overwrite = false,
): CharacterIdentityLock | undefined {
  if (!existing && !incoming) return undefined;
  const pick = (oldVal?: string, newVal?: string) => {
    const o = String(oldVal || '').trim();
    const n = String(newVal || '').trim();
    if (overwrite) return n || o || undefined;
    return o || n || undefined;
  };
  const merged: CharacterIdentityLock = {
    gender: pick(existing?.gender, incoming?.gender),
    facialFeatures: pick(existing?.facialFeatures, incoming?.facialFeatures),
    hairstyle: pick(existing?.hairstyle, incoming?.hairstyle),
    signatureStyle: pick(existing?.signatureStyle, incoming?.signatureStyle),
    fixedTags: pick(existing?.fixedTags, incoming?.fixedTags),
  };
  return hasAnyCharacterIdentityLock(merged) ? merged : undefined;
}

function normalizeGenderTagEn(rawGender?: string): string {
  const raw = String(rawGender || '').trim();
  if (!raw) return '';
  const low = raw.toLowerCase();
  if (/\b(?:female|woman|girl|nữ|nu|lady)\b/i.test(low)) return 'female';
  if (/\b(?:male|man|boy|nam|gentleman)\b/i.test(low)) return 'male';
  return translateCommonViVisualTerms(raw);
}

const IDENTITY_OVERGLAM_NOISE_PATTERNS: RegExp[] = [
  /\b(?:ultra[-\s]*)?(?:handsome|gorgeous)\s+(?:actor|movie\s+star|celebrity|idol|male\s+model|model)\b/gi,
  /\b(?:k[-\s]*pop\s+idol|runway\s+model|magazine\s+cover|fashion\s+model|movie\s+star|actor[-\s]*like)\b/gi,
  /\b(?:flawless\s+porcelain\s+skin|porcelain\s+skin|airbrushed\s+skin|plastic\s+skin|glass\s+skin|silky\s+smooth\s+skin|baby[-\s]*smooth\s+skin|smooth\s+flawless\s+skin|flawless\s+complexion|beauty\s+filter|retouched\s+skin|waxy\s+skin|doll[-\s]*like\s+skin|overly\s+polished|overly\s+smooth\s+skin)\b/gi,
  /\b(?:glossy\s+slicked[-\s]*back|heavily\s+gelled|stiff\s+salon\s+hair)\b/gi,
  /\b(?:masterpiece|best\s+quality|ultra\s+detailed|8k|4k|uhd|photorealistic|hyperrealistic|bokeh|cinematic\s+lighting|studio\s+lighting|soft\s+lighting|depth\s+of\s+field|close[-\s]*up|waist[-\s]*up|portrait\s+shot|looking\s+at\s+viewer|1boy|1girl)\b/gi,
];

function stripOverGlamorizedIdentityPhrases(raw: string): string {
  let out = sanitizeVisualPromptFragment(
    translateCommonViVisualTerms(String(raw || '').trim()),
  );
  if (!out) return '';
  for (const re of IDENTITY_OVERGLAM_NOISE_PATTERNS) {
    out = out.replace(re, ' ');
  }
  return out
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const IDENTITY_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'with',
  'and',
  'or',
  'of',
  'in',
  'on',
  'to',
  'very',
  'slightly',
  'natural',
  'look',
  'vibe',
  'style',
  'face',
  'hair',
  'skin',
]);

function extractIdentitySignatureTokens(phrase?: string | null): string[] {
  return String(phrase ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !IDENTITY_STOP_WORDS.has(w));
}

function isRedundantIdentityFragment(
  candidate: string,
  existingParts: string[],
): boolean {
  const candLower = String(candidate ?? '').toLowerCase();
  for (const prev of existingParts || []) {
    const prevLower = String(prev ?? '').toLowerCase();
    if (prevLower === candLower || prevLower.includes(candLower)) return true;
  }
  const candTokens = extractIdentitySignatureTokens(candidate);
  if (!candTokens.length) return false;
  const existingTokenSet = new Set<string>();
  for (const prev of existingParts) {
    for (const tok of extractIdentitySignatureTokens(prev)) {
      existingTokenSet.add(tok);
    }
  }
  let overlap = 0;
  for (const tok of candTokens) {
    if (existingTokenSet.has(tok)) overlap += 1;
  }
  return overlap / candTokens.length >= 0.72;
}

/**
 * Condenses comma/semicolon-separated fixed identity tags down to the 5–7
 * highest-signal core identity anchors, removing glossy/actor hype words,
 * camera/lighting clutter, and duplicate tags so scene & outfit prompts stay clear.
 */
export function condenseFixedIdentityTags(
  rawTags?: string | null,
  maxTags = 7,
): string {
  const raw = String(rawTags || '').trim();
  if (!raw) return '';
  const pieces = raw
    .split(/[,;|\n]+/)
    .map((p) => stripOverGlamorizedIdentityPhrases(p))
    .filter((p) => p.length >= 2);
  const kept: string[] = [];
  for (const piece of pieces) {
    if (kept.length >= maxTags) break;
    if (isRedundantIdentityFragment(piece, kept)) continue;
    kept.push(piece);
  }
  return kept.join(', ').slice(0, 165).replace(/[,\s]+$/g, '');
}

/**
 * Composes a tight, non-repetitive core identity-lock anchor (~20–34 words, <=215 chars)
 * prioritizing authentic immutable identity (gender, facial features & beard contour,
 * natural hairstyle, condensed core fixedTags) without crowding out scene/outfit/expression.
 */
export function composeCharacterIdentityLockPrompt(
  identityLock?: CharacterIdentityLock | null,
  avatarVisualLock?: string | null,
): string {
  const parts: string[] = [];
  const pushCore = (raw?: string, maxLen = 95) => {
    const clean = stripOverGlamorizedIdentityPhrases(String(raw || ''));
    if (!clean) return;
    const trimmed =
      clean.length > maxLen
        ? clean.slice(0, maxLen).replace(/[,\s;]+[^,\s;]*$/, '').trim() ||
          clean.slice(0, maxLen).trim()
        : clean;
    if (!trimmed) return;
    if (isRedundantIdentityFragment(trimmed, parts)) return;
    parts.push(trimmed);
  };

  if (identityLock) {
    const g = normalizeGenderTagEn(identityLock.gender);
    const condensedTags = condenseFixedIdentityTags(identityLock.fixedTags, 6);
    const hasFacialOrHair = Boolean(
      identityLock.facialFeatures?.trim() || identityLock.hairstyle?.trim(),
    );

    if (hasFacialOrHair) {
      // Structured face + hair ground truth first so beard/hair/age stay faithful to the reference photo
      if (g) {
        const faceAndHair = `${identityLock.facialFeatures || ''} ${identityLock.hairstyle || ''}`;
        if (
          !/\b(?:male|female|man|woman|boy|girl)\b/i.test(faceAndHair)
        ) {
          pushCore(g, 24);
        }
      }
      if (identityLock.facialFeatures?.trim()) {
        pushCore(identityLock.facialFeatures, 110);
      }
      if (identityLock.hairstyle?.trim()) {
        pushCore(identityLock.hairstyle, 75);
      }
      // Append only non-redundant core fixedTags (up to 2 complementary anchors)
      if (condensedTags) {
        let addedExtraTags = 0;
        for (const tag of condensedTags.split(/,\s*/)) {
          if (addedExtraTags >= 2) break;
          if (!tag || isRedundantIdentityFragment(tag, parts)) continue;
          parts.push(tag);
          addedExtraTags += 1;
        }
      }
    } else if (condensedTags) {
      if (
        g &&
        !/\b(?:male|female|man|woman|boy|girl)\b/i.test(condensedTags)
      ) {
        pushCore(g, 24);
      }
      pushCore(condensedTags, 165);
    } else if (g) {
      pushCore(g, 24);
    }

    // Keep signatureStyle short & non-redundant so it never overrides scene-specific clothing
    if (identityLock.signatureStyle?.trim() && parts.join(', ').length < 175) {
      pushCore(identityLock.signatureStyle, 52);
    }
  }

  const fallbackLock = stripOverGlamorizedIdentityPhrases(
    String(avatarVisualLock || ''),
  );
  if (fallbackLock && parts.length === 0) {
    pushCore(fallbackLock, 195);
  }

  const joined = parts.join(', ');
  if (joined.length <= 215) return joined;
  return joined
    .slice(0, 215)
    .replace(/[,\s;]+[^,\s;]*$/, '')
    .trim();
}

/**
 * Uses a Vision-capable proxy to inspect a character's real-person reference photo
 * or avatar image and extract authentic, grounded structured identity lock traits
 * (gender, facial features, hairstyle, signature style, 5–7 core fixed tags) + concise summary.
 * Fails gracefully to null on timeout or non-vision proxies so image gen never stalls.
 */
export interface ExtractIdentityLockResult {
  ok: boolean;
  visualLock?: string;
  identityLock?: CharacterIdentityLock;
  modelUsed: string;
  usedCustomSlot: boolean;
  elapsedMs: number;
  errorMessage?: string;
}

/**
 * Uses a Vision-capable API (via the `referenceCheck` model slot) to inspect a character's
 * real-person reference photo or avatar image and extract authentic, grounded structured
 * identity lock traits. Always returns explicit status, modelUsed, and errorMessage on failure
 * (never fakes a visual match from text).
 */
export async function extractCharacterIdentityLockFromImageWithAiDetailed(options: {
  state: ArkState;
  characterName: string;
  imageData: string;
  existingProfileHints?: string;
  isRealPhotoReference?: boolean;
  knownAgeLabel?: string;
  knownAgeNum?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onLog?: (line: string) => void;
}): Promise<ExtractIdentityLockResult> {
  const {
    state,
    characterName,
    imageData,
    existingProfileHints,
    isRealPhotoReference,
    knownAgeLabel,
    knownAgeNum,
    signal,
    timeoutMs,
    onLog,
  } = options;
  const startTs = Date.now();
  const slotInfo = resolveModelForTask(state.config, 'referenceCheck');
  const cleanImg = String(imageData || '').trim();
  if (!cleanImg) {
    return {
      ok: false,
      modelUsed: slotInfo.model,
      usedCustomSlot: slotInfo.isCustomSlot,
      elapsedMs: Date.now() - startTs,
      errorMessage: 'Thiếu ảnh mẫu hoặc ảnh avatar để gửi API Vision phân tích.',
    };
  }
  if (!state.config.proxyUrl?.trim()) {
    return {
      ok: false,
      modelUsed: slotInfo.model,
      usedCustomSlot: slotInfo.isCustomSlot,
      elapsedMs: Date.now() - startTs,
      errorMessage:
        'Chưa cấu hình Proxy URL nên chưa thể gọi API Vision đối chiếu ảnh.',
    };
  }
  if (signal?.aborted) {
    return {
      ok: false,
      modelUsed: slotInfo.model,
      usedCustomSlot: slotInfo.isCustomSlot,
      elapsedMs: Date.now() - startTs,
      errorMessage: 'Đã hủy yêu cầu đối chiếu ảnh.',
    };
  }

  const photoKind = isRealPhotoReference
    ? 'real-person reference photo'
    : 'character avatar image';

  const ageConstraintLine = knownAgeNum
    ? `- MANDATORY REAL AGE (${knownAgeLabel || `${knownAgeNum} years old`}): Anchor facial maturity strictly to a real ${knownAgeNum}-year-old adult! ${
        knownAgeNum >= 30
          ? 'NEVER de-age into a teen or early-20s baby-face, and NEVER over-age into an elderly 50s–60s look. Reflect natural bone maturity and light realistic expression/smile/eye lines fitting this exact age.'
          : 'Match this exact natural age accurately without turning into a glossy teen idol or artificially aging into 40s–50s.'
      }`
    : '- Real age fidelity: match the person’s TRUE apparent age in the photo accurately — NEVER artificially de-age a 30s+ adult into a teen/early-20s baby-face, and NEVER over-age into 50s–60s.';

  onLog?.(
    `${isRealPhotoReference ? '[Ảnh mẫu thật -> Khóa NV]' : '[Avatar Lock]'} Gọi Vision API (${slotInfo.model}${slotInfo.isCustomSlot ? ' · slot Đối chiếu' : ' · fallback model chính'}) cho "${characterName}"...`,
  );

  const res = await callAiJsonOrTextDetailed(
    state,
    [
      `Character: ${characterName}`,
      knownAgeLabel ? `Verified Real Age: ${knownAgeLabel}` : '',
      existingProfileHints ? `Profile hints: ${existingProfileHints}` : '',
      `Inspect this ${photoKind} carefully and extract ONLY the person's real, immutable visual identity traits for faithful image-generation consistency.`,
      'ACCURACY, AGE & NATURAL SKIN RULES (CRITICAL):',
      ageConstraintLine,
      '- Authentic real skin texture (NO plastic / beauty-filter skin AND NO over-aging): describe natural skin tone with subtle pores. For anyone under 40, keep skin fresh and youthful-looking — NEVER describe them as "mature", "weathered", "wrinkled", or add heavy forehead/eye lines that make a 20s-30s person look 45-50.',
      '- Facial hair precision: ONLY describe facial hair if clearly visible in the photo. If the person is clean-shaven, explicitly write "clean-shaven" — NEVER invent a beard or heavy stubble.',
      '- Natural hairstyle & TRUE hair color precision: respect explicit hair color in Profile hints (e.g. platinum-blonde / bleached blonde / dyed hair) — NEVER darken platinum/blonde hair into brown or black just because the photo has dim/stage lighting.',
      '- Visible tattoos, scars & piercings (CRITICAL — NEVER ERASE): if any tattoos (neck, throat, chest, shoulders, arms/sleeves, forearms, hands, face), scars, or piercings are visible in the photo or noted in Profile hints, explicitly include their exact body locations and density/coverage.',
      '- Balanced facial proportions: keep eyes, eyebrows, nose, lips, jawline, and authentic grounded everyday vibe faithful to the photo — do NOT soften/feminize masculine features or distort proportions.',
      '- Keep tags tight and high-signal: do NOT bloat with redundant adjectives, cinematic film effects, camera angles, backgrounds, lighting, or temporary outfits.',
      'Return STRICT JSON ONLY with keys:',
      '{',
      '  "gender": "male" or "female",',
      '  "facialFeatures": "exact real age look (fresh/youthful if under 40), ethnicity, face shape, bone structure, eyes, eyebrows, nose, lips, natural skin texture with subtle pores, clean-shaven or exact facial hair if any, and visible neck/face/chest tattoos or scars (14-28 words English)",',
      '  "hairstyle": "exact hair color (prioritizing Profile hints if lighting is dim), length, natural texture, messy/tousled or relaxed fall/parting (6-14 words English)",',
      '  "signatureStyle": "grounded everyday personal vibe, natural build, visible body tattoos (neck/chest/arms) or recurring accessories if any (6-16 words English, no background/cinematic terms)",',
      '  "fixedTags": "EXACTLY 5 to 8 crisp comma-separated core English identity tags only (exact age+gender+ethnicity, exact hair color+style, natural skin texture, exact visible tattoo locations/coverage if any, grounded vibe — NO aging words for under-40, NO plastic beauty terms, NO cinematic/lighting/background/camera)",',
      '  "visualLock": "ONE concise grounded English phrase (18-34 words) summarizing gender, natural age look, exact hair color/style, natural skin texture, facial likeness, visible tattoos/scars with locations if any, and authentic vibe"',
      '}',
      'Pure English only. No markdown fences, no commentary.',
    ]
      .filter(Boolean)
      .join('\n'),
    {
      systemPrompt:
        'You are a precision real-person identity analyzer for consistent character image generation. Visually analyze the attached photo with high fidelity and output ONLY a valid JSON object (gender, facialFeatures, hairstyle, signatureStyle, fixedTags, visualLock). Respect the person’s exact true age (never de-age 30s+ into teen/early-20s and never over-age into 50s–60s), preserve authentic natural skin texture with subtle pores and realistic age-appropriate expression lines (never smooth plastic/airbrushed beauty-filter skin or glossy actor/model style), and output strictly 5-7 tight core tags in fixedTags. Pure English only.',
      imageDataUrls: [cleanImg],
      requireVisionImages: true,
      taskSlot: 'referenceCheck',
      signal,
      timeoutMs: timeoutMs ?? 20_000,
      maxTokens: 360,
      logPrefix: isRealPhotoReference ? '[Ảnh mẫu thật -> Khóa NV]' : '[Avatar Lock]',
      onLog,
    },
  );

  const modelUsed = res.modelUsed || slotInfo.model;
  const usedCustomSlot = res.usedCustomSlot ?? slotInfo.isCustomSlot;

  if (!res.ok || !res.text) {
    return {
      ok: false,
      modelUsed,
      usedCustomSlot,
      elapsedMs: res.elapsedMs || Date.now() - startTs,
      errorMessage:
        res.errorMessage ||
        `Model (${modelUsed}) không trả về dữ liệu Vision hợp lệ.`,
    };
  }

  const cleanField = (val: unknown, maxLen = 150): string | undefined => {
    const raw = stripOverGlamorizedIdentityPhrases(
      String(val ?? '')
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/\s*\n+\s*/g, ', ')
        .trim(),
    );
    if (!raw || raw.length < 2) return undefined;
    return raw.slice(0, maxLen).replace(/[,\s]+$/g, '');
  };

  let parsed: Record<string, unknown> | null = null;
  try {
    const trimmed = String(res.text ?? '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const candidate = trimmed.slice(jsonStart, jsonEnd + 1);
      try {
        parsed = JSON.parse(candidate) as Record<string, unknown>;
      } catch {
        const repaired = repairTruncatedJson(candidate);
        if (repaired) parsed = JSON.parse(repaired) as Record<string, unknown>;
      }
    }
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === 'object') {
    const rawFixedTags = cleanField(parsed.fixedTags, 220);
    const condensedFixedTags = rawFixedTags
      ? condenseFixedIdentityTags(rawFixedTags, 7)
      : undefined;
    const identityLock: CharacterIdentityLock = {
      gender: cleanField(parsed.gender, 32),
      facialFeatures: cleanField(parsed.facialFeatures, 165),
      hairstyle: cleanField(parsed.hairstyle, 115),
      signatureStyle: cleanField(parsed.signatureStyle, 100),
      fixedTags: condensedFixedTags || undefined,
    };
    const rawVisualLock = cleanField(parsed.visualLock, 210);
    const composedLock =
      composeCharacterIdentityLockPrompt(identityLock, rawVisualLock) ||
      rawVisualLock ||
      '';
    if (
      composedLock &&
      composedLock.length >= 12 &&
      !containsVietnameseText(composedLock)
    ) {
      return {
        ok: true,
        visualLock: composedLock.slice(0, 215),
        identityLock: hasAnyCharacterIdentityLock(identityLock)
          ? identityLock
          : { fixedTags: condenseFixedIdentityTags(composedLock, 7) },
        modelUsed,
        usedCustomSlot,
        elapsedMs: res.elapsedMs || Date.now() - startTs,
      };
    }
  }

  // Fallback: model returned a single plain-text visual lock line
  const cleaned = stripOverGlamorizedIdentityPhrases(
    String(res.text ?? '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^(?:identity|visual\s*lock|appearance|traits?)\s*[:：\-]\s*/i, '')
      .replace(/\s*\n+\s*/g, ', ')
      .trim(),
  );
  if (!cleaned || cleaned.length < 14 || containsVietnameseText(cleaned)) {
    return {
      ok: false,
      modelUsed,
      usedCustomSlot,
      elapsedMs: res.elapsedMs || Date.now() - startTs,
      errorMessage: `Model (${modelUsed}) không trả về đặc điểm nhận diện tiếng Anh hợp lệ (có thể model không đọc được ảnh Vision).`,
    };
  }
  const condensed = condenseFixedIdentityTags(cleaned, 7) || cleaned.slice(0, 190);
  return {
    ok: true,
    visualLock: cleaned.slice(0, 210),
    identityLock: {
      fixedTags: condensed,
    },
    modelUsed,
    usedCustomSlot,
    elapsedMs: res.elapsedMs || Date.now() - startTs,
  };
}

export async function extractCharacterIdentityLockFromImageWithAi(options: {
  state: ArkState;
  characterName: string;
  imageData: string;
  existingProfileHints?: string;
  isRealPhotoReference?: boolean;
  knownAgeLabel?: string;
  knownAgeNum?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onLog?: (line: string) => void;
}): Promise<{
  visualLock: string;
  identityLock: CharacterIdentityLock;
} | null> {
  const res = await extractCharacterIdentityLockFromImageWithAiDetailed(options);
  if (!res.ok || !res.visualLock || !res.identityLock) return null;
  return {
    visualLock: res.visualLock,
    identityLock: res.identityLock,
  };
}

/**
 * Backward-compatible wrapper returning only the concise visual lock string.
 */
export async function extractAvatarVisualLockWithAi(options: {
  state: ArkState;
  characterName: string;
  imageData: string;
  existingProfileHints?: string;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<string | null> {
  const result = await extractCharacterIdentityLockFromImageWithAi(options);
  return result?.visualLock || null;
}

/**
 * Performs a REAL side-by-side Vision API verification comparing:
 *   Image #1: real-person reference photo (`referenceImageData`)
 *   Image #2: generated character portrait or story scene image (`targetImageData`)
 * Uses the dedicated `referenceCheck` model slot (or falls back to main model).
 * NEVER fabricates a pass from text/tags — returns explicit `status: 'error'` if
 * either image is missing, proxy is unconfigured, or Vision API fails.
 */
export async function verifyCharacterImageAgainstReferenceWithAi(options: {
  state: ArkState;
  characterName: string;
  referenceImageData?: string | null;
  targetImageData?: string | null;
  knownAgeLabel?: string;
  knownAgeNum?: number;
  identityLock?: CharacterIdentityLock;
  profileHints?: {
    appearance?: string;
    fashionStyle?: string;
    signature?: string;
    personality?: string;
    gender?: string;
  };
  targetLabel?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onLog?: (line: string) => void;
}): Promise<ReferenceComparisonResult> {
  const {
    state,
    characterName,
    referenceImageData,
    targetImageData,
    knownAgeLabel,
    knownAgeNum,
    identityLock,
    profileHints,
    targetLabel,
    signal,
    timeoutMs,
    onLog,
  } = options;
  const startTs = Date.now();
  const slotInfo = resolveModelForTask(state.config, 'referenceCheck');
  const cleanRef = String(referenceImageData || '').trim();
  const cleanTarget = String(targetImageData || '').trim();

  if (!cleanRef) {
    return {
      status: 'error',
      targetCharacterName: characterName,
      modelUsed: slotInfo.model,
      usedCustomSlot: slotInfo.isCustomSlot,
      elapsedMs: Date.now() - startTs,
      comparedAt: Date.now(),
      errorMessage: `Chưa có "Ảnh mẫu người thật" cho ${characterName}. Hãy tải ảnh mẫu trước khi đối chiếu.`,
    };
  }
  if (!cleanTarget) {
    return {
      status: 'error',
      targetCharacterName: characterName,
      modelUsed: slotInfo.model,
      usedCustomSlot: slotInfo.isCustomSlot,
      elapsedMs: Date.now() - startTs,
      comparedAt: Date.now(),
      errorMessage: `Chưa có ảnh kết quả (${targetLabel || 'chân dung/cảnh'}) để đối chiếu với ảnh mẫu của ${characterName}.`,
    };
  }
  if (!state.config.proxyUrl?.trim()) {
    return {
      status: 'error',
      targetCharacterName: characterName,
      modelUsed: slotInfo.model,
      usedCustomSlot: slotInfo.isCustomSlot,
      elapsedMs: Date.now() - startTs,
      comparedAt: Date.now(),
      errorMessage:
        'Chưa cấu hình Proxy API nên chưa thể gọi Vision API để đối chiếu 2 ảnh.',
    };
  }

  const pairSig = `${computeAvatarSignature(cleanRef)}::${computeAvatarSignature(cleanTarget)}`;
  const lockSummary = composeCharacterIdentityLockPrompt(identityLock, '');
  const genderBlob = `${profileHints?.gender || ''} ${identityLock?.gender || ''} ${profileHints?.appearance || ''}`.toLowerCase();
  const isFemaleCharacter =
    /\b(?:female|woman|girl|lady|nữ|cô gái|thiếu nữ|phụ nữ|quý cô)\b/i.test(
      genderBlob,
    ) && !/\b(?:male|man|nam giới|đàn ông)\b/i.test(genderBlob);
  const explicitHair = extractExplicitHairProfileEn(
    profileHints?.appearance,
    profileHints?.fashionStyle,
    profileHints?.signature,
    identityLock?.hairstyle,
  );
  const explicitTattoos = extractTattooAndBodyMarkingsEn(
    profileHints?.appearance,
    profileHints?.fashionStyle,
    profileHints?.signature,
  );
  const profileSummaryParts = [
    profileHints?.gender || identityLock?.gender
      ? `Giới tính: ${profileHints?.gender || identityLock?.gender}`
      : '',
    explicitHair.hasExplicitHair && explicitHair.hairClauseEn
      ? `Màu & kiểu tóc khóa cứng: ${explicitHair.hairClauseEn}`
      : '',
    explicitTattoos.hasTattoos && explicitTattoos.clauseEn
      ? `Hình xăm/dấu hiệu khóa cứng: ${explicitTattoos.clauseEn}`
      : '',
    profileHints?.appearance
      ? `Ngoại hình hồ sơ: ${trimToCleanSentence(profileHints.appearance, 220)}`
      : '',
    profileHints?.fashionStyle
      ? `Style hồ sơ: ${trimToCleanSentence(profileHints.fashionStyle, 140)}`
      : '',
    profileHints?.signature
      ? `Điểm nhấn hồ sơ: ${trimToCleanSentence(profileHints.signature, 120)}`
      : '',
  ].filter(Boolean);

  onLog?.(
    `[Đối chiếu API · ${slotInfo.model}${slotInfo.isCustomSlot ? ' (slot Đối chiếu)' : ' (fallback model chính)'}] Đang gửi 2 ảnh (Ảnh mẫu thật + ${targetLabel || 'Ảnh kết quả'}) của "${characterName}" để so khớp nhận diện cốt lõi & hồ sơ...`,
  );

  const ageSpec = knownAgeNum
    ? knownAgeNum < 38
      ? `${knownAgeLabel || `${knownAgeNum} tuổi`} (giữ độ tươi trẻ tự nhiên đúng ${knownAgeNum} tuổi; KHÔNG đề xuất làm già/nhăn mặt, chỉ trừ điểm nếu trẻ hóa thành học sinh/teen hoặc bị đẩy già hóa thành 45–60)`
      : `${knownAgeLabel || `${knownAgeNum} tuổi`} (khớp độ chín thực tế khoảng ${knownAgeNum} tuổi; trừ điểm nếu bị trẻ hóa giả tạo thành đầu 20 hoặc già hóa quá mức)`
    : 'Khớp độ tuổi thực tế trên Ảnh #1 (không trẻ hóa giả tạo, không đẩy già quá mức)';

  const promptText = [
    `Nhân vật cần đối chiếu: ${characterName}`,
    targetLabel ? `Loại ảnh kết quả (Ảnh #2): ${targetLabel}` : '',
    `Chuẩn tuổi tác thật: ${ageSpec}`,
    lockSummary ? `Khóa nhận diện cố định: ${lockSummary}` : '',
    profileSummaryParts.length
      ? `Hồ sơ nhân vật đang khóa:\n- ${profileSummaryParts.join('\n- ')}`
      : '',
    '',
    'BẠN ĐƯỢC CUNG CẤP ĐÚNG 2 HÌNH ẢNH:',
    '- Ảnh #1 (ảnh đầu tiên): ẢNH MẪU NGƯỜI THẬT (chuẩn nhận diện gốc).',
    '- Ảnh #2 (ảnh thứ hai): ẢNH KẾT QUẢ DO AI VẼ CẦN ĐÁNH GIÁ.',
    '',
    'NGUYÊN TẮC ĐÁNH GIÁ THÔNG MINH & THỰC TẾ:',
    '- Ưu tiên cao nhất cho NHẬN DIỆN CỐT LÕI: cấu trúc gương mặt & tỷ lệ (xương hàm, mắt, chân mày, mũi, miệng), màu tóc & kiểu tóc gốc theo Ảnh #1 và hồ sơ, độ tuổi thật, vóc dáng và hình xăm/dấu hiệu đặc trưng đã khai báo.',
    '- KHÔNG bắt bẻ tiểu tiết vô ích (ánh sáng khác nhẹ, phông nền khác, góc nghiêng hơi khác hoặc trang phục đổi theo cảnh) nếu nhìn vào vẫn nhận ra ngay cùng một người.',
    '- TUYỆT ĐỐI KHÔNG đề xuất chỉnh sửa trái với đặc điểm gốc đã khóa: không đổi màu tóc gốc sang màu khác, không đẩy già gương mặt trẻ, không tự bịa thêm râu/ria cho nhân vật nữ hoặc người cạo sạch, không xóa hình xăm đã khai báo.',
    '- Nếu Ảnh #2 đã nhận diện rõ là cùng một người, khớp cốt lõi và đạt chuẩn thực tế (overallScore >= 82 và faceMatchScore >= 80), hãy đánh giá khách quan verdict="match", viết nhận xét ngắn gọn, để correctionTags=[] và suggestedPromptFix="" (không ép sửa thừa).',
    '',
    'Chấm điểm khách quan (0–100) từng tiêu chí:',
    '1. faceMatchScore (0–100): Độ giống đường nét & tỷ lệ khuôn mặt cốt lõi so với Ảnh #1.',
    '2. ageAccuracyScore (0–100): Độ chuẩn tuổi tác thực tế so với Ảnh #1 & tuổi hồ sơ.',
    '3. skinRealismScore (0–100): Kết cấu da tự nhiên hợp tuổi (trừ điểm nếu da mịn nhựa/airbrush bóng giả rõ rệt).',
    `4. hairBeardScore (0–100): Độ khớp màu tóc, kiểu tóc${isFemaleCharacter ? ' (NHÂN VẬT NỮ — chỉ chấm tóc, KHÔNG chấm hay đề xuất râu/ria)' : ' và râu/ria nếu Ảnh #1 thực sự có râu'} cùng dấu hiệu nhận diện (hình xăm/phụ kiện gốc).`,
    '5. overallScore (0–100): Điểm tổng thể sát thực tế.',
    '',
    'CHỈ TRẢ VỀ ĐÚNG 1 JSON HỢP LỆ (không markdown, không lời dẫn):',
    '{',
    '  "overallScore": 0-100,',
    '  "faceMatchScore": 0-100,',
    '  "ageAccuracyScore": 0-100,',
    '  "skinRealismScore": 0-100,',
    '  "hairBeardScore": 0-100,',
    '  "verdict": "match" | "partial" | "mismatch",',
    '  "summary": "1–2 câu tiếng Việt súc tích, thực tế dựa trên 2 ảnh",',
    '  "matchedTraits": ["2–3 điểm khớp cốt lõi bằng tiếng Việt"],',
    '  "mismatches": ["0–3 điểm lệch CỐT LÕI thực sự cần sửa bằng tiếng Việt (bỏ qua tiểu tiết nền/ánh sáng/góc nhẹ; để [] nếu ảnh đã khớp tốt >= 82)"],',
    '  "correctionTags": ["0–3 cụm TIẾNG ANH ngắn gọn, chỉ nhắm vào điểm lệch cốt lõi thực sự và KHÔNG mâu thuẫn với hồ sơ/ảnh gốc. Nếu verdict=match và overallScore >= 82 thì BẮT BUỘC để []"],',
    '  "suggestedPromptFix": "1 cụm TIẾNG ANH ngắn gọn (<= 30 từ) chỉ sửa điểm lệch cốt lõi thực sự mà không phá đặc điểm đã khớp; để chuỗi rỗng nếu verdict=match và overallScore >= 82"',
    '}',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callAiJsonOrTextDetailed(state, promptText, {
    systemPrompt:
      'You are a pragmatic, high-precision computer-vision character likeness auditor. Visually inspect BOTH attached images (Image #1 = real-person reference photo, Image #2 = generated result) against the provided character profile and return STRICT JSON ONLY. Prioritize CORE IDENTITY LIKENESS: facial bone structure/proportions, original hair color & hairstyle from reference/profile, authentic true age, body build, and declared tattoos/marks. Do NOT nitpick minor background, lighting, camera angle, or outfit variations when the person is clearly recognizable. NEVER suggest edits that contradict locked identity traits (never change original hair color, never over-age a youthful face, never suggest facial hair on female or clean-shaven characters, never remove declared tattoos). If the image already captures core likeness well (overallScore >= 82 and faceMatchScore >= 80), return verdict="match", concise Vietnamese summary, empty correctionTags=[], and empty suggestedPromptFix="" so already-good portraits are NOT needlessly altered.',
    imageDataUrls: [cleanRef, cleanTarget],
    requireVisionImages: true,
    taskSlot: 'referenceCheck',
    signal,
    timeoutMs: timeoutMs ?? 28_000,
    maxTokens: 650,
    logPrefix: '[Đối chiếu API]',
    onLog,
  });

  const modelUsed = res.modelUsed || slotInfo.model;
  const usedCustomSlot = res.usedCustomSlot ?? slotInfo.isCustomSlot;
  const elapsedMs = res.elapsedMs || Date.now() - startTs;

  if (!res.ok || !res.text) {
    const errMsg =
      res.errorMessage ||
      `Không thể gọi Vision API (${modelUsed}) để đối chiếu 2 ảnh.`;
    onLog?.(`[Đối chiếu API · ${modelUsed}] Thất bại: ${errMsg}`);
    return {
      status: 'error',
      targetCharacterName: characterName,
      modelUsed,
      usedCustomSlot,
      elapsedMs,
      comparedAt: Date.now(),
      sourceSig: pairSig,
      errorMessage: errMsg,
    };
  }

  const parsed = parseAiJsonObject(res.text);
  if (!parsed) {
    const errMsg = `Model (${modelUsed}) trả về dữ liệu đối chiếu không đúng định dạng JSON (có thể model chưa hỗ trợ đọc 2 ảnh Vision cùng lúc).`;
    onLog?.(`[Đối chiếu API · ${modelUsed}] ${errMsg}`);
    return {
      status: 'error',
      targetCharacterName: characterName,
      modelUsed,
      usedCustomSlot,
      elapsedMs,
      comparedAt: Date.now(),
      sourceSig: pairSig,
      errorMessage: errMsg,
    };
  }

  const clampScore = (v: unknown): number | undefined => {
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  const faceMatchScore = clampScore(parsed.faceMatchScore);
  const ageAccuracyScore = clampScore(parsed.ageAccuracyScore);
  const skinRealismScore = clampScore(parsed.skinRealismScore);
  const hairBeardScore = clampScore(parsed.hairBeardScore);
  const subScores = [
    faceMatchScore,
    ageAccuracyScore,
    skinRealismScore,
    hairBeardScore,
  ].filter((x): x is number => typeof x === 'number');
  const overallScore =
    clampScore(parsed.overallScore) ??
    (subScores.length
      ? Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length)
      : undefined);

  if (typeof overallScore !== 'number') {
    const errMsg = `Model (${modelUsed}) không trả về điểm số đối chiếu hợp lệ.`;
    onLog?.(`[Đối chiếu API · ${modelUsed}] ${errMsg}`);
    return {
      status: 'error',
      targetCharacterName: characterName,
      modelUsed,
      usedCustomSlot,
      elapsedMs,
      comparedAt: Date.now(),
      sourceSig: pairSig,
      errorMessage: errMsg,
    };
  }

  const rawVerdict = String(parsed.verdict || '').trim().toLowerCase();
  const verdict: 'match' | 'partial' | 'mismatch' =
    rawVerdict === 'match' ||
    rawVerdict === 'partial' ||
    rawVerdict === 'mismatch'
      ? rawVerdict
      : overallScore >= 80
        ? 'match'
        : overallScore >= 55
          ? 'partial'
          : 'mismatch';

  const toStrList = (val: unknown, maxItems = 4): string[] =>
    Array.isArray(val)
      ? val
          .map((x) => String(x || '').trim())
          .filter(Boolean)
          .slice(0, maxItems)
      : [];

  const isAlreadyStrongMatch =
    verdict === 'match' &&
    overallScore >= 82 &&
    (faceMatchScore ?? 100) >= 80 &&
    (ageAccuracyScore ?? 100) >= 78 &&
    (hairBeardScore ?? 100) >= 78;

  const summary = String(parsed.summary || '').trim().slice(0, 340);
  const matchedTraits = toStrList(parsed.matchedTraits, 4);
  const mismatches = isAlreadyStrongMatch
    ? []
    : toStrList(parsed.mismatches, 4);
  const stripFemaleFacialHairTag = (txt: string): string =>
    isFemaleCharacter
      ? txt
          .replace(
            /\b(?:trimmed\s+|contoured\s+|short\s+|heavy\s+|thick\s+|neat\s+|natural\s+){0,2}(?:jawline\s+|chinstrap\s+|chin\s+|facial\s+)?(?:beard|mustache|stubble|goatee)\b/gi,
            ' ',
          )
          .replace(/\s*,\s*(?:,\s*)+/g, ', ')
          .replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
      : txt;
  const correctionTags = isAlreadyStrongMatch
    ? []
    : toStrList(parsed.correctionTags, 4)
        .map((tag) =>
          stripFemaleFacialHairTag(sanitizeVisualPromptFragment(tag)).slice(
            0,
            95,
          ),
        )
        .filter((tag) => tag.length >= 4 && !containsVietnameseText(tag));
  const rawFix = isAlreadyStrongMatch
    ? ''
    : stripFemaleFacialHairTag(
        sanitizeVisualPromptFragment(
          String(parsed.suggestedPromptFix || '').trim(),
        ),
      ).slice(0, 260);
  const suggestedPromptFix =
    rawFix && !containsVietnameseText(rawFix) ? rawFix : '';

  onLog?.(
    `[Đối chiếu API · ${modelUsed}] Hoàn tất (${(elapsedMs / 1000).toFixed(1)}s): ${overallScore}/100 (${verdict}) cho "${characterName}".`,
  );

  return {
    status: 'verified',
    overallScore,
    faceMatchScore,
    ageAccuracyScore,
    skinRealismScore,
    hairBeardScore,
    verdict,
    summary:
      summary ||
      `Điểm đối chiếu tổng thể ${overallScore}/100 (so khớp trực tiếp 2 ảnh qua ${modelUsed}).`,
    matchedTraits,
    mismatches,
    ...(correctionTags.length > 0 ? { correctionTags } : {}),
    ...(suggestedPromptFix ? { suggestedPromptFix } : {}),
    applyToPrompt: !isAlreadyStrongMatch,
    targetCharacterName: characterName,
    modelUsed,
    usedCustomSlot,
    elapsedMs,
    comparedAt: Date.now(),
    sourceSig: pairSig,
  };
}

export interface DerivedComparisonPromptPatch {
  active: boolean;
  mode: 'targeted_fix' | 'light_refine' | 'keep_matched' | 'disabled' | 'none';
  statusLabel: string;
  patchText: string;
  reasons: string[];
  filteredConflictNote?: string;
}

/**
 * Single source of truth converting a verified ReferenceComparisonResult into a concise,
 * targeted English prompt adjustment fragment (strictly fixing ONLY detected mismatches,
 * protecting the character profile's explicit hair color & youthful appearance from conflicting
 * stale/shadowy comparison drift).
 */
export function deriveReferenceComparisonPromptPatch(
  comparison?: ReferenceComparisonResult | null,
  options?: {
    globalEnabled?: boolean;
    knownAgeNum?: number;
    profileGender?: string;
    profileAppearance?: string;
    profileFashionStyle?: string;
    profileSignature?: string;
  },
): DerivedComparisonPromptPatch {
  if (!comparison || comparison.status !== 'verified') {
    return {
      active: false,
      mode: 'none',
      statusLabel: '',
      patchText: '',
      reasons: [],
    };
  }

  if (options?.globalEnabled === false || comparison.applyToPrompt === false) {
    return {
      active: false,
      mode: 'disabled',
      statusLabel:
        'Đang tắt áp dụng kết quả đối chiếu — lần vẽ lại sẽ chỉ dùng hồ sơ/khóa nhận diện gốc.',
      patchText: '',
      reasons: [],
    };
  }

  const expectedHair = extractExplicitHairProfileEn(
    options?.profileAppearance,
    options?.profileFashionStyle,
    options?.profileSignature,
  );
  const genderText = `${options?.profileGender || ''} ${options?.profileAppearance || ''}`.toLowerCase();
  const isFemaleProfile =
    /\b(?:female|woman|girl|lady|nữ|cô gái|thiếu nữ|phụ nữ|quý cô)\b/i.test(
      genderText,
    ) && !/\b(?:male|man|nam giới|đàn ông)\b/i.test(genderText);
  const rawMismatchBlob = (comparison.mismatches || []).join(' | ').toLowerCase();
  const mismatchFlagsUnwantedBeard =
    isFemaleProfile ||
    /(?:thừa\s*râu|không\s*có\s*râu|cạo\s*sạch|unwanted\s+beard|clean-shaven)/i.test(
      rawMismatchBlob,
    );
  let filteredHairConflict = false;
  let filteredAgingConflict = false;
  let filteredFacialHairConflict = false;

  const isBackgroundOrLightingNitpickOnly = (clause: string): boolean => {
    const low = clause.toLowerCase();
    const mentionsTrivial =
      /\b(?:background|backdrop|lighting|light\s+direction|shadow\s+angle|camera\s+angle|crop|framing|wall|room\s+decor|bokeh|color\s+grading)\b/i.test(
        low,
      );
    const mentionsCoreIdentity =
      /\b(?:face|facial|eye|eyebrow|nose|lip|jaw|chin|cheek|hair|bangs|fringe|skin|pore|age|year-old|youthful|beard|mustache|tattoo|scar|build|body|silhouette)\b/i.test(
        low,
      );
    return mentionsTrivial && !mentionsCoreIdentity;
  };

  const sanitizePatchAgainstProfile = (rawText: string): string => {
    let out = String(rawText ?? '').trim();
    if (!out) return '';
    if (expectedHair.colorFamily) {
      const hairCheck = stripConflictingHairColorsFromText(
        out,
        expectedHair.colorFamily,
      );
      if (hairCheck.removedConflict) filteredHairConflict = true;
      out = hairCheck.cleaned;
    }
    if (mismatchFlagsUnwantedBeard) {
      const before = out;
      out = out
        .replace(
          /\b(?:trimmed\s+|contoured\s+|short\s+|heavy\s+|thick\s+|neat\s+|natural\s+){0,2}(?:jawline\s+|chinstrap\s+|chin\s+|facial\s+)?(?:beard|mustache|stubble|goatee)\b/gi,
          ' ',
        )
        .replace(/\s*,\s*(?:,\s*)+/g, ', ')
        .replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (out !== before && isFemaleProfile) {
        filteredFacialHairConflict = true;
      }
    }
    const ageCheck = stripOverAgingWordsFromText(out, options?.knownAgeNum);
    if (ageCheck.removedAging) filteredAgingConflict = true;
    out = ageCheck.cleaned;
    return out;
  };

  const overall = comparison.overallScore ?? 0;
  const hasCriticalSubScoreBelow78 = [
    comparison.faceMatchScore,
    comparison.ageAccuracyScore,
    comparison.skinRealismScore,
    comparison.hairBeardScore,
  ].some((s) => typeof s === 'number' && s < 78);

  // If image already matched core likeness cleanly (overall >= 82 & no critical sub-score < 78),
  // keep the portrait stable and DO NOT force unnecessary prompt patches!
  if (
    comparison.verdict === 'match' &&
    overall >= 82 &&
    !hasCriticalSubScoreBelow78
  ) {
    return {
      active: false,
      mode: 'keep_matched',
      statusLabel:
        'Ảnh đã sát nhận diện & hồ sơ — giữ nguyên đặc điểm gốc, không cần thêm chỉnh sửa thừa.',
      patchText: '',
      reasons: [],
    };
  }

  const cleanFix = comparison.suggestedPromptFix
    ? sanitizePatchAgainstProfile(
        sanitizeVisualPromptFragment(comparison.suggestedPromptFix).trim(),
      )
    : '';
  const cleanTags = (comparison.correctionTags || [])
    .map((t) =>
      sanitizePatchAgainstProfile(sanitizeVisualPromptFragment(t).trim()),
    )
    .filter(
      (t) =>
        t.length >= 4 &&
        !containsVietnameseText(t) &&
        !isBackgroundOrLightingNitpickOnly(t),
    );

  const clauses: string[] = [];
  const reasons: string[] = [];
  const seenLower = new Set<string>();

  const pushClause = (rawClause?: string | null) => {
    const cleaned = sanitizePatchAgainstProfile(
      String(sanitizeVisualPromptFragment(String(rawClause ?? '')) ?? '')
        .replace(/^[,.;:\s]+|[,.;:\s]+$/g, '')
        .trim(),
    );
    if (
      !cleaned ||
      cleaned.length < 4 ||
      containsVietnameseText(cleaned) ||
      isBackgroundOrLightingNitpickOnly(cleaned)
    ) {
      return;
    }
    const norm = cleaned.toLowerCase();
    if (seenLower.has(norm)) return;
    // Avoid adding a redundant sub-clause already contained in a longer clause
    for (const existing of seenLower) {
      if (existing.includes(norm) || norm.includes(existing)) {
        if (norm.length <= existing.length) return;
      }
    }
    seenLower.add(norm);
    clauses.push(cleaned);
  };

  if (cleanFix && !containsVietnameseText(cleanFix)) {
    pushClause(cleanFix);
  }
  for (const tag of cleanTags) {
    pushClause(tag);
  }

  // Deterministic fallback mapping from Vietnamese mismatches & low sub-scores
  // ONLY for aspects not already covered by AI English correctionTags/suggestedPromptFix
  const joinedClausesLower = clauses.join(' ').toLowerCase();
  const mismatchBlob = (comparison.mismatches || []).join(' | ').toLowerCase();

  const coversHairBeard =
    /\b(?:hair|hairstyle|bangs|fringe|wavy|beard|mustache|stubble|facial\s+hair|jawline\s+beard|clean-shaven)\b/i.test(
      joinedClausesLower,
    );
  const coversAge =
    /\b(?:age|year-old|youthful|fresh|de-ag|over-ag|younger)\b/i.test(
      joinedClausesLower,
    );
  const coversSkin =
    /\b(?:skin|pores|texture|plastic|airbrush|beauty\s+filter|smooth|natural\s+complexion)\b/i.test(
      joinedClausesLower,
    );
  const coversFaceAngle =
    /\b(?:face|facial|bone\s+structure|jaw|eyes|eyebrow|nose|lips|angle|expression|gaze|likeness)\b/i.test(
      joinedClausesLower,
    );

  if (
    !coversHairBeard &&
    ((typeof comparison.hairBeardScore === 'number' &&
      comparison.hairBeardScore < 80) ||
      /(?:tóc|mái|râu|ria|quai nón|hair|beard|mustache)/i.test(mismatchBlob))
  ) {
    const hairParts: string[] = [];
    if (/(?:tóc|mái|hair)/i.test(mismatchBlob) || (comparison.hairBeardScore ?? 100) < 80) {
      if (expectedHair.hasExplicitHair && expectedHair.hairClauseEn) {
        hairParts.push(
          `strictly keep exact ${expectedHair.hairClauseEn} matching character profile`,
        );
      } else {
        hairParts.push(
          /(?:dài|ngắn|rủ|gợn|bóng|chải)/i.test(mismatchBlob)
            ? 'exact natural hair length, color, and relaxed texture matching reference photo (not stiff or glossy)'
            : 'natural hair shape and texture matching reference photo',
        );
      }
      reasons.push('chỉnh dáng/màu/độ tự nhiên của tóc đúng hồ sơ');
    }
    // Only add beard fix if mismatch specifically indicates MISSING beard (never add beard onto clean-shaven characters!)
    if (
      /(?:thiếu\s*râu|mất\s*râu|nhạt\s*râu|râu\s*quai\s*nón|missing\s+beard)/i.test(
        mismatchBlob,
      )
    ) {
      hairParts.push(
        'exact natural contoured jawline beard and neat trimmed mustache matching reference photo',
      );
      reasons.push('khôi phục đúng viền râu & ria mép');
    } else if (
      /(?:thừa\s*râu|không\s*có\s*râu|cạo\s*sạch|unwanted\s+beard|clean-shaven)/i.test(
        mismatchBlob,
      )
    ) {
      hairParts.push('clean-shaven smooth jawline');
      reasons.push('bỏ râu thừa giữ mặt sạch gọn');
    }
    if (hairParts.length) pushClause(hairParts.join(', '));
  }

  if (
    !coversAge &&
    ((typeof comparison.ageAccuracyScore === 'number' &&
      comparison.ageAccuracyScore < 80) ||
      /(?:tuổi|trẻ\s*hóa|teen|đầu\s*20|già|dừ|trung\s*niên|age)/i.test(mismatchBlob))
  ) {
    const looksTooOld = /(?:già|dừ|trung\s*niên|nhăn|over-?ag|older)/i.test(
      mismatchBlob,
    );
    const agePhrase = looksTooOld
      ? options?.knownAgeNum && options.knownAgeNum < 40
        ? `fresh youthful-looking ${options.knownAgeNum}-year-old appearance with vibrant energy, not over-aged`
        : 'fresh youthful-looking face matching reference photo, not over-aged'
      : options?.knownAgeNum
        ? options.knownAgeNum < 40
          ? `fresh authentic ${options.knownAgeNum}-year-old look matching reference photo (natural youthful energy, not over-aged)`
          : `exact ${options.knownAgeNum}-year-old facial structure matching reference photo`
        : 'exact true facial age matching reference photo (not over-aged)';
    pushClause(agePhrase);
    reasons.push(
      looksTooOld
        ? 'giữ nét trẻ trung, tránh bị già/dừ'
        : options?.knownAgeNum
          ? `chỉnh đúng độ tuổi thật (${options.knownAgeNum} tuổi)`
          : 'chỉnh đúng độ tuổi thực tế theo ảnh mẫu',
    );
  }

  if (
    !coversSkin &&
    ((typeof comparison.skinRealismScore === 'number' &&
      comparison.skinRealismScore < 80) ||
      /(?:da|nhựa|láng\s*mịn|filter|bóng\s*lộn|airbrush|skin|plastic)/i.test(
        mismatchBlob,
      ))
  ) {
    pushClause(
      'authentic natural skin texture with visible subtle pores and realistic complexion, strictly no plastic smoothing or beauty filter',
    );
    reasons.push('giữ chất da thật có lỗ chân lông nhẹ, bỏ hiệu ứng mịn nhựa');
  }

  if (
    !coversFaceAngle &&
    ((typeof comparison.faceMatchScore === 'number' &&
      comparison.faceMatchScore < 80) ||
      /(?:mặt|khuôn|xương|hàm|mắt|mày|mũi|môi|góc\s*mặt|biểu\s*cảm|lệch\s*nét|face|angle|expression)/i.test(
        mismatchBlob,
      ))
  ) {
    const hasAngleOrExpr = /(?:góc\s*mặt|nghiêng|quay|biểu\s*cảm|cười|ánh\s*mắt|angle|expression)/i.test(
      mismatchBlob,
    );
    pushClause(
      hasAngleOrExpr
        ? 'faithful reference facial bone structure, eyes, eyebrows, nose, lips, clear three-quarter/front angle and grounded natural expression'
        : 'faithful reference facial bone structure, eyes, eyebrows, nose, and jawline likeness',
    );
    reasons.push(
      hasAngleOrExpr
        ? 'chỉnh sát đường nét khuôn mặt, góc mặt & biểu cảm'
        : 'chỉnh sát cấu trúc khuôn mặt theo ảnh mẫu',
    );
  }

  // Add raw Vietnamese mismatches into reasons for clear user transparency
  for (const m of comparison.mismatches || []) {
    if (m && !reasons.includes(m)) {
      reasons.push(m);
    }
  }

  const conflictNotes: string[] = [];
  if (filteredHairConflict && expectedHair.hairClauseEn) {
    conflictNotes.push(
      `đã chặn ghi đè màu tóc lệch hồ sơ (giữ nguyên ${expectedHair.hairClauseEn})`,
    );
  }
  if (filteredAgingConflict) {
    conflictNotes.push('đã lọc bỏ cụm từ gây già/dừ gương mặt');
  }
  if (filteredFacialHairConflict) {
    conflictNotes.push('đã chặn gợi ý râu/ria không phù hợp với giới tính hồ sơ');
  }
  const filteredConflictNote = conflictNotes.length
    ? `Bảo vệ hồ sơ: ${conflictNotes.join('; ')}.`
    : undefined;

  if (clauses.length === 0) {
    return {
      active: false,
      mode: 'keep_matched',
      statusLabel:
        filteredConflictNote ||
        'Ảnh hiện tại đã đạt — giữ nguyên nét gốc, không có điểm lệch cần sửa.',
      patchText: '',
      reasons: [],
      filteredConflictNote,
    };
  }

  // Keep total injected patch compact so it guides Seedream/Flux sharply without crowding out the scene
  const joined = clauses.join(', ');
  const compactPatch =
    joined.length > 235
      ? `${joined.slice(0, 232).replace(/[,;\s]+[^,;\s]*$/, '')}`.trim()
      : joined;

  const isLightRefine = comparison.verdict === 'match' || overall >= 78;
  return {
    active: Boolean(compactPatch),
    mode: isLightRefine ? 'light_refine' : 'targeted_fix',
    statusLabel: isLightRefine
      ? 'Ảnh gần đạt — chỉ tinh chỉnh nhẹ đúng chi tiết còn lệch, giữ nguyên các phần đã khớp.'
      : 'Sẽ tự động ghép chỉnh sửa đối chiếu vào prompt để sửa đúng các điểm bị lệch.',
    patchText: compactPatch,
    reasons: reasons.slice(0, 4),
    filteredConflictNote,
  };
}

/**
 * Anti-overwrite guard: ensures a derived comparison patch survives LLM/Vision prompt rewriting
 * or custom template interpolation, inserting it right before trailing negative no-text directives
 * if it was dropped or diluted.
 */
export function enforceComparisonPatchOnPrompt(
  prompt: string,
  patchText?: string | null,
): string {
  const base = String(prompt || '').trim();
  const patch = sanitizeVisualPromptFragment(String(patchText || '')).trim();
  if (!base || !patch) return base;

  const baseLower = base.toLowerCase();
  const patchTokens = patch
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((w) => w.length >= 4 && !['with', 'that', 'from', 'only', 'this', 'very', 'keep', 'more'].includes(w));

  if (patchTokens.length > 0) {
    let matchedCount = 0;
    for (const token of patchTokens) {
      if (baseLower.includes(token)) matchedCount += 1;
    }
    if (matchedCount / patchTokens.length >= 0.72) {
      return base;
    }
  } else if (baseLower.includes(patch.toLowerCase())) {
    return base;
  }

  // Insert right before the trailing negative no-text constraint so it sits in the positive visual body
  const noTextIdx = base.search(/,\s*no\s+text\b/i);
  const labeledFix = `reference likeness correction: ${patch}`;
  if (noTextIdx > 0) {
    const head = base.slice(0, noTextIdx).replace(/[,;\s]+$/, '');
    const tail = base.slice(noTextIdx);
    return `${head}, ${labeledFix}${tail}`;
  }
  return `${base.replace(/[,;\s]+$/, '')}, ${labeledFix}`;
}

/**
 * Resolves the highest-priority verified ReferenceComparisonResult applicable to a story beat:
 * 1) The beat's own referenceComparison (if already compared), OR
 * 2) The lastReferenceComparison of an on-scene locked character portrait (if it has active fixes).
 */
function resolveStoryBeatComparisonSource(
  state: ArkState,
  existingBeatComparison?: ReferenceComparisonResult | null,
  lockedIdentities?: ResolvedImageCharacterIdentity[],
): {
  comparison?: ReferenceComparisonResult;
  knownAgeNum?: number;
  profileAppearance?: string;
  profileFashionStyle?: string;
  profileSignature?: string;
  sourceLabel?: string;
} {
  if (existingBeatComparison?.status === 'verified') {
    const matchedId = (lockedIdentities || []).find(
      (id) =>
        existingBeatComparison.targetCharacterName &&
        normalizeCharacterKey(id.canonicalName) ===
          normalizeCharacterKey(existingBeatComparison.targetCharacterName),
    );
    return {
      comparison: existingBeatComparison,
      knownAgeNum: matchedId?.ageNum,
      profileAppearance: matchedId?.appearance,
      profileFashionStyle: matchedId?.fashionStyle,
      profileSignature: matchedId?.signature,
      sourceLabel: 'kết quả đối chiếu của ảnh cảnh này',
    };
  }

  const portraits = state.portraitBank?.portraits || [];
  if (!portraits.length || !lockedIdentities?.length) return {};

  for (const idInfo of lockedIdentities) {
    const matchedPortrait = portraits.find(
      (p) =>
        (idInfo.portraitId && p.id === idInfo.portraitId) ||
        normalizeCharacterKey(p.name) ===
          normalizeCharacterKey(idInfo.canonicalName),
    );
    if (matchedPortrait?.lastReferenceComparison?.status === 'verified') {
      const probe = deriveReferenceComparisonPromptPatch(
        matchedPortrait.lastReferenceComparison,
        {
          globalEnabled: state.storyImage?.applyComparisonToPrompt !== false,
          knownAgeNum: idInfo.ageNum,
          profileAppearance: matchedPortrait.appearance || idInfo.appearance,
          profileFashionStyle: matchedPortrait.fashionStyle || idInfo.fashionStyle,
          profileSignature: matchedPortrait.signature || idInfo.signature,
        },
      );
      if (probe.active) {
        return {
          comparison: matchedPortrait.lastReferenceComparison,
          knownAgeNum: idInfo.ageNum,
          profileAppearance: matchedPortrait.appearance || idInfo.appearance,
          profileFashionStyle: matchedPortrait.fashionStyle || idInfo.fashionStyle,
          profileSignature: matchedPortrait.signature || idInfo.signature,
          sourceLabel: `kết quả đối chiếu chân dung ${matchedPortrait.name}`,
        };
      }
    }
  }
  return {};
}

function buildExpandedCharacterIdentityKeys(
  rawName: string,
  extraHints: Array<string | undefined> = [],
): Set<string> {
  const keys = new Set<string>();
  const clean = String(rawName || '').trim();
  if (!clean) return keys;
  const base = collectCharacterIdentityKeys(clean, extraHints);
  for (const k of base.aliasKeys) keys.add(k);
  const celeb = lookupKnownCelebrityProfile(clean);
  if (celeb) {
    const celebKeys = collectCharacterIdentityKeys(celeb.canonicalName, [
      ...(celeb.aliases || []),
    ]);
    for (const k of celebKeys.aliasKeys) keys.add(k);
  }
  return keys;
}

function hasAnyKeyOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const k of a) {
    if (b.has(k)) return true;
  }
  return false;
}

function resolveImageCharacterIdentity(
  rawName: string,
  state: ArkState,
  matchedDisplay?: string,
): ResolvedImageCharacterIdentity {
  const cleanRaw = String(rawName || '').trim();
  const activeComp = getStoryBoundCompanionFromState(state);
  const portraits = Array.isArray(state.portraitBank?.portraits)
    ? state.portraitBank.portraits
    : [];
  const npcs = Array.isArray(activeComp?.npcs) ? activeComp.npcs : [];
  const charStates = Array.isArray(state.memory?.characterStates)
    ? state.memory.characterStates
    : [];
  const mcName = (activeComp?.mc?.name || state.player?.name || '').trim();

  const celebDirect = lookupKnownCelebrityProfile(cleanRaw);
  const queryKeys = buildExpandedCharacterIdentityKeys(cleanRaw);

  const mcKeys = mcName ? buildExpandedCharacterIdentityKeys(mcName) : new Set<string>();
  const matchedPortrait =
    matchPortraitByName(cleanRaw, portraits) ||
    (celebDirect
      ? matchPortraitByName(celebDirect.canonicalName, portraits)
      : undefined);

  const matchedNpc = npcs.find((n) => {
    const nKeys = buildExpandedCharacterIdentityKeys(n.name || '', [
      n.role,
      n.signature,
    ]);
    return hasAnyKeyOverlap(queryKeys, nKeys);
  });

  const isMc =
    Boolean(matchedPortrait?.isMc) ||
    (mcKeys.size > 0 && hasAnyKeyOverlap(queryKeys, mcKeys));

  const canonicalName =
    matchedPortrait?.name?.trim() ||
    matchedNpc?.name?.trim() ||
    celebDirect?.canonicalName ||
    (isMc && mcName ? mcName : cleanRaw);

  const celeb =
    celebDirect ||
    lookupKnownCelebrityProfile(canonicalName) ||
    (matchedPortrait?.name ? lookupKnownCelebrityProfile(matchedPortrait.name) : null) ||
    (matchedNpc?.name ? lookupKnownCelebrityProfile(matchedNpc.name) : null);

  const canonicalKeys = buildExpandedCharacterIdentityKeys(canonicalName, [
    cleanRaw,
    matchedPortrait?.role,
    matchedNpc?.role,
  ]);
  const matchedState = charStates.find((cs) => {
    const csKeys = buildExpandedCharacterIdentityKeys(cs.name || '');
    return hasAnyKeyOverlap(canonicalKeys, csKeys);
  });

  const resolvedAge = resolveEffectiveCharacterAge({
    age: matchedPortrait?.age || (isMc ? activeComp?.mc?.age : '') || '',
    birthday: matchedPortrait?.birthday || celeb?.birthday || '',
    extraText: [
      matchedPortrait?.appearance,
      matchedPortrait?.role,
      matchedPortrait?.signature,
      matchedNpc?.appearance,
      matchedNpc?.desc,
      isMc ? activeComp?.mc?.appearance : '',
    ]
      .filter(Boolean)
      .join(' '),
    clock: state.memory?.storyClock,
  });
  const effectiveAge = resolvedAge.ageLabel;

  const identityLock = matchedPortrait?.identityLock;
  const gender = (
    identityLock?.gender ||
    (isMc ? activeComp?.mc?.gender || '' : '')
  ).trim();

  const role =
    sanitizeNpcFieldText(
      'role',
      matchedPortrait?.role ||
        matchedNpc?.role ||
        celeb?.role ||
        (isMc ? 'Nhân vật chính' : ''),
    ) || '';

  const storedAppearance = sanitizeNpcFieldText(
    'appearance',
    matchedPortrait?.appearance?.trim() ||
      (isMc ? activeComp?.mc?.appearance?.trim() : '') ||
      matchedNpc?.appearance?.trim() ||
      matchedNpc?.desc?.trim() ||
      '',
  );

  // Preserve manual/detailed portrait appearance; supplement short/missing stubs with known celebrity visual traits
  // so well-known figures (e.g., Jennie Kim) always retain unmistakable face/hair/ethnicity cues.
  let appearance = storedAppearance;
  if (celeb?.appearance) {
    if (!appearance) {
      appearance = celeb.appearance;
    } else if (!matchedPortrait?.appearanceManual && appearance.length < 48) {
      const appNorm = normalizeCharacterKey(appearance);
      const celebNorm = normalizeCharacterKey(celeb.appearance);
      if (!appNorm.includes(celebNorm.slice(0, 24))) {
        appearance = `${celeb.appearance} (${appearance})`;
      }
    }
  }

  const fashionStyle = sanitizeNpcFieldText(
    'fashionStyle',
    matchedPortrait?.fashionStyle?.trim() || celeb?.fashionStyle || '',
  );
  const signature = sanitizeNpcFieldText(
    'signature',
    matchedPortrait?.signature?.trim() ||
      matchedNpc?.signature?.trim() ||
      celeb?.signature ||
      '',
  );
  const mood = (matchedState?.mood || '').trim();

  const avatarImageData = (matchedPortrait?.imageData || '').trim();
  const referenceImageData = (matchedPortrait?.referenceImageData || '').trim();
  const anchorImageData = referenceImageData || avatarImageData;
  const avatarVisualLock = sanitizeVisualPromptFragment(
    matchedPortrait?.avatarVisualLock || '',
  );
  const avatarLockSourceSig = (matchedPortrait?.avatarLockSourceSig || '').trim();
  const composedLockSummary = composeCharacterIdentityLockPrompt(
    identityLock,
    avatarVisualLock,
  );

  const hasConcreteVisual = Boolean(
    referenceImageData ||
      (composedLockSummary && composedLockSummary.length >= 12) ||
      (appearance && appearance.length >= 12) ||
      (gender && effectiveAge && fashionStyle && fashionStyle.length >= 12),
  );

  return {
    canonicalName,
    matchedDisplay:
      matchedDisplay &&
      normalizeCharacterKey(matchedDisplay) !== normalizeCharacterKey(canonicalName)
        ? matchedDisplay.trim()
        : undefined,
    ...(matchedPortrait?.id ? { portraitId: matchedPortrait.id } : {}),
    ...(avatarImageData ? { avatarImageData } : {}),
    ...(referenceImageData ? { referenceImageData } : {}),
    ...(anchorImageData ? { anchorImageData } : {}),
    ...(hasAnyCharacterIdentityLock(identityLock) ? { identityLock } : {}),
    ...(avatarVisualLock ? { avatarVisualLock } : {}),
    ...(avatarLockSourceSig ? { avatarLockSourceSig } : {}),
    isMc,
    role,
    ...(effectiveAge ? { age: effectiveAge } : {}),
    ...(resolvedAge.ageNum ? { ageNum: resolvedAge.ageNum } : {}),
    ...(resolvedAge.birthYear ? { birthYear: resolvedAge.birthYear } : {}),
    ...(gender ? { gender } : {}),
    appearance,
    ...(fashionStyle ? { fashionStyle } : {}),
    ...(signature ? { signature } : {}),
    ...(mood ? { mood } : {}),
    hasConcreteVisual,
  };
}

export function detectSecondaryCharactersInSceneText(
  sceneText: string,
  primaryNames: string[],
  state: ArkState,
): {
  resolved: ResolvedImageCharacterIdentity[];
  unresolved: string[];
} {
  const cleanText = stripNonSceneChatBlocks(
    stripStoryPlanningAndMeta(sceneText || ''),
  ).trim();
  if (!cleanText) return { resolved: [], unresolved: [] };

  const activeComp = getStoryBoundCompanionFromState(state);
  const allowedKnownKeys = buildAllowedRosterKeys(activeComp, state.player?.name);
  const portraits = (state.portraitBank?.portraits || []).filter(
    (p) => !isInvalidNpcPortrait(p, allowedKnownKeys),
  );
  const npcs = Array.isArray(activeComp?.npcs) ? activeComp.npcs : [];
  const mcName = (activeComp?.mc?.name || state.player?.name || '').trim();

  const excludedKeys = new Set<string>();
  for (const pn of primaryNames) {
    for (const k of buildExpandedCharacterIdentityKeys(pn)) {
      excludedKeys.add(k);
    }
    const pMatched = matchPortraitByName(pn, portraits);
    if (pMatched) {
      for (const k of buildExpandedCharacterIdentityKeys(pMatched.name, [
        pMatched.role,
        pMatched.signature,
      ])) {
        excludedKeys.add(k);
      }
    }
  }

  const seenKeys = new Set<string>(excludedKeys);
  const candidates: Array<{
    name: string;
    matchedDisplay?: string;
    firstIndex: number;
  }> = [];

  const registerCandidate = (
    rawName: string,
    firstIndex: number,
    matchedDisplay?: string,
  ) => {
    const cleanName = String(rawName || '').trim();
    if (!cleanName || cleanName.length < 2) return;
    const idKeys = buildExpandedCharacterIdentityKeys(cleanName);
    if (!idKeys.size || hasAnyKeyOverlap(idKeys, seenKeys)) return;
    for (const k of idKeys) seenKeys.add(k);
    candidates.push({
      name: cleanName,
      matchedDisplay,
      firstIndex: firstIndex >= 0 ? firstIndex : 999999,
    });
  };

  // 1) Known celebrities mentioned in the scene text (e.g., "Jennie" -> "Jennie Kim")
  const celebHits = findKnownCelebritiesInText(cleanText);
  for (const hit of celebHits) {
    const idx = cleanText.toLowerCase().indexOf(hit.displayName.toLowerCase());
    registerCandidate(hit.canonicalName, idx, hit.displayName);
  }

  // 2) Existing Portrait Bank characters, Companion NPCs, and MC mentioned in the scene text
  const rosterEntries: Array<{ name: string; role?: string; signature?: string }> = [];
  if (mcName) rosterEntries.push({ name: mcName });
  for (const p of portraits) {
    if (p.name?.trim()) {
      rosterEntries.push({ name: p.name.trim(), role: p.role, signature: p.signature });
    }
  }
  for (const n of npcs) {
    if (n.name?.trim()) {
      rosterEntries.push({ name: n.name.trim(), role: n.role, signature: n.signature });
    }
  }
  for (const entry of rosterEntries) {
    const exactHit = findExactProperNameInText(cleanText, entry.name, {
      allowHonorificShortName: true,
    });
    if (exactHit.count > 0) {
      registerCandidate(entry.name, exactHit.firstIndex, exactHit.matchedDisplay);
      continue;
    }
    const idObj = collectCharacterIdentityKeys(entry.name, [
      entry.role,
      entry.signature,
    ]);
    for (const alias of idObj.aliasKeys) {
      if (alias.length < 4) continue;
      const aliasHit = findExactProperNameInText(cleanText, alias, {
        allowHonorificShortName: false,
      });
      if (aliasHit.count > 0) {
        registerCandidate(entry.name, aliasHit.firstIndex, aliasHit.matchedDisplay);
        break;
      }
    }
  }

  // 3) Any other proper person name extracted directly from the scene text
  const extracted = extractPresentCharactersFromScene(cleanText, state);
  for (const name of extracted) {
    const cleaned = sanitizeCharacterName(name, allowedKnownKeys);
    if (!cleaned) continue;
    const hit = findExactProperNameInText(cleanText, cleaned, {
      allowHonorificShortName: false,
    });
    registerCandidate(cleaned, hit.firstIndex, hit.matchedDisplay || cleaned);
  }

  candidates.sort((a, b) => a.firstIndex - b.firstIndex);

  const resolved: ResolvedImageCharacterIdentity[] = [];
  const unresolved: string[] = [];
  const emittedCanonicalKeys = new Set<string>(excludedKeys);

  for (const cand of candidates) {
    const info = resolveImageCharacterIdentity(
      cand.name,
      state,
      cand.matchedDisplay,
    );
    const canonKeys = buildExpandedCharacterIdentityKeys(info.canonicalName);
    if (hasAnyKeyOverlap(canonKeys, emittedCanonicalKeys)) continue;
    for (const k of canonKeys) emittedCanonicalKeys.add(k);

    if (info.hasConcreteVisual) {
      resolved.push(info);
    } else {
      unresolved.push(info.canonicalName);
    }
  }

  return { resolved, unresolved };
}

const STORY_BEAT_DIRECTIVES: Record<
  StoryImagePosition,
  {
    viFocus: string;
    enCue: string;
  }
> = {
  opening: {
    viFocus:
      'Khung đầu (mở cảnh): tập trung vào không gian, kiến trúc/phòng ốc, ánh sáng và bầu không khí mở đầu lượt truyện.',
    enCue: 'wide atmospheric establishing shot',
  },
  middle: {
    viFocus:
      'Khung giữa (tương tác): tập trung vào hành động, tư thế, biểu cảm và tương tác trực tiếp giữa các nhân vật.',
    enCue: 'medium cinematic shot capturing natural posture, gesture, and expression',
  },
  ending: {
    viFocus:
      'Khung cuối (kết mở): tập trung vào khoảnh khắc kết mở, góc máy đặc tả hoặc cận cảnh giàu dư âm.',
    enCue: 'cinematic closing shot with lingering composition and focused detail',
  },
};

function inferCharacterGenderEn(
  info: ResolvedImageCharacterIdentity,
  contextText: string,
): 'man' | 'woman' | 'person' {
  // 1. Always respect explicitly locked per-character gender or fixedTags first
  const lockedGender = `${info.identityLock?.gender || ''} ${info.gender || ''}`.toLowerCase();
  if (/\b(?:female|woman|girl|lady|nữ|nu)\b/i.test(lockedGender)) {
    return 'woman';
  }
  if (/\b(?:male|man|boy|gentleman|nam)\b/i.test(lockedGender)) {
    return 'man';
  }
  const lockedTags = `${info.identityLock?.fixedTags || ''} ${info.avatarVisualLock || ''}`.toLowerCase();
  if (/\b(?:female|woman|girl|1girl|young\s+woman)\b/i.test(lockedTags)) {
    return 'woman';
  }
  if (/\b(?:male|man|boy|1boy|young\s+man)\b/i.test(lockedTags)) {
    return 'man';
  }

  const direct = `${info.role || ''} ${info.appearance || ''} ${info.fashionStyle || ''}`.toLowerCase();
  if (
    /\b(?:female|woman|girl|lady|actress|idol\s*nữ|nữ|cô\s*gái|thiếu\s*nữ|phụ\s*nữ|đầm|váy|son\s*môi)\b/i.test(
      direct,
    )
  ) {
    return 'woman';
  }
  if (
    /\b(?:male|man|boy|gentleman|actor|nam|đàn\s*ông|thiếu\s*niên|chàng\s*trai|râu)\b/i.test(
      direct,
    )
  ) {
    return 'man';
  }

  // Check known real-person persona gender if profile omitted explicit gender
  const knownPersonaLower = String(info?.canonicalName ?? '').toLowerCase().trim();
  if (
    /^(?:mgk|machine\s+gun\s+kelly|colson\s+baker|justin\s+bieber|the\s+weeknd|drake|eminem|post\s+malone|travis\s+scott|kendrick\s+lamar|sơn\s+tùng|son\s+tung|hieuthuhai|binz|đen\s+vâu|den\s+vau|bray|tlinh\s*boy)$/i.test(
      knownPersonaLower,
    )
  ) {
    return 'man';
  }
  if (
    /^(?:charli\s*xcx|taylor\s+swift|billie\s+eilish|megan\s+fox|dua\s+lipa|ariana\s+grande|sabrina\s+carpenter|olivia\s+rodrigo|lisa|jennie|rosé|rose|jisoo|iu|mỹ\s+tâm|bích\s+phương|tlinh|pháo|min)$/i.test(
      knownPersonaLower,
    )
  ) {
    return 'woman';
  }

  // Check pronoun cues near character name in the beat/turn text
  const lowerText = String(contextText || '').toLowerCase();
  const nameLower = knownPersonaLower;
  const shortName = nameLower.split(/\s+/).filter(Boolean).pop() || nameLower;
  const escaped = String(shortName ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escaped.length >= 2) {
    const femaleNear = new RegExp(
      `(?:\\b(?:cô|nàng|chị|em\\s+gái|bà)\\s+${escaped}\\b|\\b${escaped}\\b[^.\\n]{0,48}\\b(?:cô|nàng|cô\\s+ấy|she|her)\\b)`,
      'i',
    );
    const maleNear = new RegExp(
      `(?:\\b(?:anh|hắn|cậu|chàng|ông)\\s+${escaped}\\b|\\b${escaped}\\b[^.\\n]{0,48}\\b(?:anh|hắn|anh\\s+ta|he|him|his)\\b)`,
      'i',
    );
    const hasFem = femaleNear.test(lowerText);
    const hasMale = maleNear.test(lowerText);
    if (hasFem && !hasMale) return 'woman';
    if (hasMale && !hasFem) return 'man';
  }
  return 'person';
}

function buildHeadcountLockDirective(
  identities: ResolvedImageCharacterIdentity[],
  contextText: string,
): {
  personCount: number;
  lockPhrase: string;
  negativeExtra: string;
} {
  const count = identities.length;
  if (count <= 0) {
    return {
      personCount: 0,
      lockPhrase: 'empty scene, no people, no humans',
      negativeExtra: buildHeadcountNegativeDirective(0),
    };
  }
  if (count === 1) {
    const g = inferCharacterGenderEn(identities[0], contextText);
    return {
      personCount: 1,
      lockPhrase: `single person only, 1 ${g} alone, no extra people, no crowd`,
      negativeExtra: buildHeadcountNegativeDirective(1),
    };
  }
  if (count === 2) {
    const genders = identities.map((id) =>
      inferCharacterGenderEn(id, contextText),
    );
    const men = genders.filter((g) => g === 'man').length;
    const women = genders.filter((g) => g === 'woman').length;
    let breakdown = '2 people';
    if (men === 1 && women === 1) breakdown = '1 man and 1 woman';
    else if (men === 2) breakdown = '2 men';
    else if (women === 2) breakdown = '2 women';
    else if (men === 1) breakdown = '1 man and 1 person';
    else if (women === 1) breakdown = '1 woman and 1 person';
    return {
      personCount: 2,
      lockPhrase: `two people only, ${breakdown}, no extra people, no crowd`,
      negativeExtra: buildHeadcountNegativeDirective(2),
    };
  }
  const genders = identities.map((id) =>
    inferCharacterGenderEn(id, contextText),
  );
  const men = genders.filter((g) => g === 'man').length;
  const women = genders.filter((g) => g === 'woman').length;
  const unknown = count - men - women;
  const parts: string[] = [];
  if (men > 0) parts.push(`${men} ${men === 1 ? 'man' : 'men'}`);
  if (women > 0) parts.push(`${women} ${women === 1 ? 'woman' : 'women'}`);
  if (unknown > 0) parts.push(`${unknown} ${unknown === 1 ? 'person' : 'people'}`);
  const countWord = count === 3 ? 'three' : String(count);
  return {
    personCount: count,
    lockPhrase: `exactly ${countWord} people only (${parts.join(' and ')}), no extra people, no crowd`,
    negativeExtra: buildHeadcountNegativeDirective(count),
  };
}

function detectExplicitHeadcountInEnglishPrompt(prompt: string): number | null {
  const lower = String(prompt || '').toLowerCase();
  if (!lower) return null;
  if (
    /\b(?:empty\s+(?:scene|room|studio|hallway|street|space|interior)|no\s+people|no\s+humans|unoccupied)\b/i.test(
      lower,
    )
  ) {
    return 0;
  }
  if (
    /\b(?:single\s+person\s+only|1\s+(?:man|woman|boy|girl|person)\s+alone|solo\s+(?:man|woman|figure|person))\b/i.test(
      lower,
    )
  ) {
    return 1;
  }
  if (
    /\b(?:two\s+people\s+only|1\s+man\s+and\s+1\s+woman|2\s+(?:men|women|people)\s+only|two\s+(?:men|women)\s+only)\b/i.test(
      lower,
    )
  ) {
    return 2;
  }
  return null;
}

function hasLightingTermsInPrompt(prompt: string): boolean {
  return /\b(?:light|lighting|lamp|neon|glow|shadow|shadows|daylight|sunlight|moonlight|candlelight|sunset|dusk|dawn|dim|dimly|dark|led|spotlight|ambient)\b/i.test(
    String(prompt || ''),
  );
}

function isEnvironmentFocusedOpening(
  beatProseSlice: string,
  cleanAiBeatPrompt: string,
): boolean {
  const text = `${beatProseSlice || ''}\n${cleanAiBeatPrompt || ''}`.toLowerCase();
  if (!text.trim()) return true;
  if (detectExplicitHeadcountInEnglishPrompt(cleanAiBeatPrompt) === 0) {
    return true;
  }
  const hasEnvironmentCues =
    /(?:phòng\s*thu|căn\s*phòng|không\s*gian|khung\s*cảnh|ánh\s*đèn|ánh\s*sáng|bàn\s*mixer|cửa\s*sổ|hành\s*lang|con\s*phố|bầu\s*trời|cơn\s*mưa|đêm\s*khuya|bóng\s*tối|tiếng\s*mưa|mùi|bàn\s*làm\s*việc|ghế\s*sofa|studio|room|interior|street|hallway|sky|window|lamp|lighting|atmosphere|establishing)/i.test(
      text,
    );
  const hasActiveTwoPersonExchange =
    /(?:hai\s*người|cả\s*hai|nhìn\s*nhau|đối\s*diện\s*nhau|nắm\s*tay|ôm\s*chặt|hôn\s*nhau|cãi\s*nhau|two\s*people|facing\s*each\s*other|looking\s*at\s*each\s*other)/i.test(
      text,
    );
  const dialogueQuoteMatches = (beatProseSlice || '').match(/[“""][^“""]{6,}[”""]/g);
  const hasHeavyDialogue = (dialogueQuoteMatches?.length || 0) >= 2;
  return hasEnvironmentCues && !hasActiveTwoPersonExchange && !hasHeavyDialogue;
}

const VI_VISUAL_PHRASE_MAP: Array<[RegExp, string]> = [
  [/\bphòng\s*thu\s*âm\b/gi, 'recording studio'],
  [/\bphòng\s*thu\b/gi, 'recording studio'],
  [/\bbàn\s*mixer\b/gi, 'mixing console'],
  [/\bphòng\s*ngủ\b/gi, 'bedroom'],
  [/\bphòng\s*khách\b/gi, 'living room'],
  [/\bphòng\s*làm\s*việc\b/gi, 'study office'],
  [/\bvăn\s*phòng\b/gi, 'modern office'],
  [/\bcăn\s*hộ\b/gi, 'apartment'],
  [/\bhành\s*lang\b/gi, 'hallway'],
  [/\bquán\s*cà\s*phê\b/gi, 'cafe'],
  [/\bquán\s*bar\b/gi, 'dim cocktail bar'],
  [/\bđèn\s*bàn\b/gi, 'warm desk lamp'],
  [/\bđèn\s*ngủ\b/gi, 'warm bedside lamp'],
  [/\bđèn\s*neon\b/gi, 'neon lights'],
  [/\brâu\s*quai\s*nón\b/gi, 'natural contoured jawline chinstrap beard'],
  [/\brâu\s*có\s*viền\b/gi, 'natural contoured jawline beard'],
  [/\bria\s*mép\b/gi, 'neat trimmed mustache'],
  [/\brâu\s*cằm\b/gi, 'neat chin beard'],
  [/\brâu\s*lún\s*phún\b/gi, 'light natural stubble'],
  [/\brâu\s*ngắn\b/gi, 'short trimmed natural beard'],
  [/\btóc\s*gợn\s*sóng\s*nhẹ\b/gi, 'naturally slightly wavy hair'],
  [/\btóc\s*rủ\s*nhẹ\b/gi, 'naturally relaxed softly falling hair'],
  [/\btóc\s*tự\s*nhiên\b/gi, 'natural unstyled hair'],
  [/\btóc\s*đen\s*dài\b/gi, 'long black hair'],
  [/\btóc\s*đen\s*ngắn\b/gi, 'short black hair'],
  [/\btóc\s*đen\b/gi, 'black hair'],
  [/\btóc\s*nâu\b/gi, 'brown hair'],
  [/\btóc\s*vàng\b/gi, 'blonde hair'],
  [/\báo\s*sơ\s*mi\s*trắng\b/gi, 'white button-up shirt'],
  [/\báo\s*sơ\s*mi\s*đen\b/gi, 'black button-up shirt'],
  [/\báo\s*sơ\s*mi\b/gi, 'button-up shirt'],
  [/\báo\s*phông\b/gi, 't-shirt'],
  [/\báo\s*thun\b/gi, 't-shirt'],
  [/\báo\s*khoác\s*đen\b/gi, 'black jacket'],
  [/\báo\s*khoác\b/gi, 'jacket'],
  [/\báo\s*hoodie\b/gi, 'hoodie'],
  [/\bquần\s*jeans\b/gi, 'jeans'],
  [/\bquần\s*âu\b/gi, 'tailored trousers'],
  [/\bváy\s*đen\b/gi, 'black dress'],
  [/\bváy\s*trắng\b/gi, 'white dress'],
  [/\bđeo\s*kính\b/gi, 'wearing glasses'],
  [/\btai\s*nghe\b/gi, 'studio headphones'],
  [/\b(\d{1,2})\s*tuổi\b/gi, 'age $1'],
];

function translateCommonViVisualTerms(raw: string): string {
  let out = sanitizeVisualPromptFragment(raw);
  if (!out) return '';
  for (const [pattern, replacement] of VI_VISUAL_PHRASE_MAP) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function parseNumericAgeFromCue(rawAge?: string, fallbackNum?: number): number | undefined {
  if (typeof fallbackNum === 'number' && Number.isFinite(fallbackNum) && fallbackNum >= 5 && fallbackNum <= 110) {
    return Math.round(fallbackNum);
  }
  const clean = translateCommonViVisualTerms(rawAge || '');
  const m = /\b(\d{1,2})\b/.exec(clean);
  if (!m) return undefined;
  const num = Number(m[1]);
  if (!Number.isFinite(num) || num < 5 || num > 110) return undefined;
  return num;
}

function formatAccurateAgeCueEn(rawAge?: string, ageNumInput?: number): string {
  const num = parseNumericAgeFromCue(rawAge, ageNumInput);
  if (!num) {
    return translateCommonViVisualTerms(rawAge || '');
  }
  if (num <= 24) return `adult ${num}-year-old`;
  if (num <= 36) return `fresh ${num}-year-old`;
  if (num <= 41) return `${num}-year-old`;
  if (num <= 49) return `${num}-year-old (40s)`;
  return `${num}-year-old mature adult`;
}

function buildAgeNaturalSkinRealismCue(ageNum?: number): string {
  if (!ageNum) {
    return 'fresh natural skin texture with subtle pores';
  }
  if (ageNum <= 24) {
    return 'fresh natural skin texture with subtle pores';
  }
  if (ageNum <= 38) {
    return 'fresh youthful-looking natural skin texture with subtle pores and clean defined bone structure (not aged, no harsh wrinkles)';
  }
  if (ageNum <= 49) {
    return 'defined natural facial bone structure, realistic skin texture with subtle pores and light natural expression lines';
  }
  return 'mature aged facial bone structure, realistic skin texture with natural wrinkles and expression lines';
}

function resolveKnownDisplayAlias(canonicalName: string): {
  isKnownRealPerson: boolean;
  knownDisplayAlias?: string;
} {
  const celeb = lookupKnownCelebrityProfile(canonicalName);
  if (!celeb) return { isKnownRealPerson: false };
  const longerAlias = (celeb.aliases || []).find(
    (a) => a.trim().length > celeb.canonicalName.trim().length + 2,
  );
  const formattedAlias = longerAlias
    ? longerAlias
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : undefined;
  return {
    isKnownRealPerson: true,
    knownDisplayAlias: formattedAlias,
  };
}

/**
 * When a character is 30+, removes stale/contradictory de-aging phrases
 * (e.g. "youthful", "early 20s", "teen", "baby-faced") from cached identity locks
 * so real age (like 36yo born 1990) is never overridden by teen/20s smoothing.
 */
function stripContradictoryDeAgingForAdult(text?: string | null, ageNum?: number): string {
  const safeText = String(text ?? '');
  if (!safeText || !ageNum || ageNum < 30) return safeText;
  return safeText
    .replace(
      /\b(?:youthful|teen|teenage|baby[-\s]*faced?|boyish|girlish|early[\s-]*20s|mid[\s-]*20s|late[\s-]*teens?|young\s+(?:1[6-9]|2[0-5])[\s-]*year[\s-]*old|(?:1[6-9]|2[0-5])[\s-]*year[\s-]*old)\b/gi,
      ' ',
    )
    .replace(/\byoung\s+(?=(?:vietnamese|asian|east\s+asian|korean|japanese|chinese|male|female|man|woman)\b)/gi, '')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatCompactEnglishCharacterBrief(
  info: ResolvedImageCharacterIdentity,
  contextText: string,
  options?: {
    lockAvatarIdentity?: boolean;
    worldGenreHint?: string;
    collisionSalt?: number;
  },
): string {
  const lockAvatar = options?.lockAvatarIdentity !== false;
  const genderWord = inferCharacterGenderEn(info, contextText);
  const resolvedAgeNum = parseNumericAgeFromCue(info.age, info.ageNum);
  const ageCue = formatAccurateAgeCueEn(info.age, resolvedAgeNum);
  const skinAgeCue = buildAgeNaturalSkinRealismCue(resolvedAgeNum);
  const rawComposedIdentityLock = lockAvatar
    ? composeCharacterIdentityLockPrompt(
        info.identityLock,
        info.avatarVisualLock,
      )
    : '';
  const composedIdentityLock = stripContradictoryDeAgingForAdult(
    rawComposedIdentityLock,
    resolvedAgeNum,
  );
  const appearanceClean = info.appearance
    ? stripContradictoryDeAgingForAdult(
        translateVietnameseVisualToEnglish(
          translateCommonViVisualTerms(trimToCleanSentence(info.appearance, 260)),
        ),
        resolvedAgeNum,
      )
    : '';
  const outfitSource =
    info.fashionStyle?.trim() || info.identityLock?.signatureStyle?.trim() || '';
  const outfitClean = outfitSource
    ? translateVietnameseVisualToEnglish(
        translateCommonViVisualTerms(trimToCleanSentence(outfitSource, 160)),
      )
    : '';
  const tattooInfo = extractTattooAndBodyMarkingsEn(
    info.appearance,
    info.fashionStyle,
    info.signature,
  );

  const profileHair = extractExplicitHairProfileEn(
    info.appearance,
    info.fashionStyle,
    info.signature,
  );
  const knownMeta = resolveKnownDisplayAlias(info.canonicalName);

  if (composedIdentityLock) {
    // Always inject verified real age if missing or if cached lock did not state this exact numeric age
    const hasExactAgeAlready =
      resolvedAgeNum !== undefined
        ? new RegExp(`\\b${resolvedAgeNum}[\\s-]*year`, 'i').test(
            composedIdentityLock,
          )
        : /\b\d{2}[\s-]*year\b/i.test(composedIdentityLock);
    const extraAge = ageCue && !hasExactAgeAlready ? ageCue : '';
    const hasSkinTextureCue =
      /\b(?:pores|skin\s+texture|expression\s+lines|smile\s+lines|laugh\s+lines|wrinkles)\b/i.test(
        composedIdentityLock,
      );
    const rawLockEn = stripResidualVietnameseFromEnglishClause(
      translateVietnameseVisualToEnglish(composedIdentityLock),
      [info.canonicalName, knownMeta.knownDisplayAlias],
    );
    const hairSafeLockEn = profileHair.colorFamily
      ? stripConflictingHairColorsFromText(rawLockEn, profileHair.colorFamily).cleaned
      : rawLockEn;
    const ageSafeLockEn = stripOverAgingWordsFromText(
      hairSafeLockEn,
      resolvedAgeNum,
    ).cleaned;
    const isAncientHint = /(?:kiếm\s*hiệp|tiên\s*hiệp|tu\s*tiên|huyền\s*huyễn|cổ\s*đại|wuxia|xianxia|ancient)/i.test(
      options?.worldGenreHint || '',
    );
    const cleanedLockEn = stripUnauthorizedBodyMarksAndCultureDriftEn({
      prompt: ageSafeLockEn,
      authorizedText: [
        info.appearance,
        info.fashionStyle,
        info.signature,
        info.role,
      ]
        .filter(Boolean)
        .join(' '),
      isWuxiaOrXianxia: isAncientHint,
    });
    const lockMissingTattoos =
      tattooInfo.hasTattoos &&
      Boolean(tattooInfo.clauseEn) &&
      (!/\btattoo/i.test(cleanedLockEn) ||
        tattooInfo.locations.some((loc) => {
          const kw = loc.split(/[\s(]/)[0]?.toLowerCase() || '';
          return kw && !cleanedLockEn.toLowerCase().includes(kw);
        }));
    const shortOutfit = stripResidualVietnameseFromEnglishClause(
      outfitClean ? trimToCleanSentence(outfitClean, 120) : '',
    );
    const outfitAlreadyCovered =
      shortOutfit &&
      isRedundantIdentityFragment(shortOutfit, [composedIdentityLock]);
    const displayName = knownMeta.knownDisplayAlias
      ? `${info.canonicalName} (${knownMeta.knownDisplayAlias})`
      : info.canonicalName;
    const bits = [
      `${displayName}, a ${[extraAge, genderWord].filter(Boolean).join(' ')}`,
      profileHair.hasExplicitHair && profileHair.hairClauseEn
        ? `with ${profileHair.hairClauseEn}`
        : '',
      cleanedLockEn,
      lockMissingTattoos ? tattooInfo.clauseEn : '',
      !hasSkinTextureCue ? skinAgeCue : '',
      shortOutfit && !outfitAlreadyCovered ? `wearing ${shortOutfit}` : '',
    ].filter(Boolean);
    return bits.join(', ').replace(/[\s.;,]+$/g, '');
  }

  const structured = buildStructuredCharacterIdentityEn(
    {
      canonicalName: info.canonicalName,
      knownDisplayAlias: knownMeta.knownDisplayAlias,
      isKnownRealPerson: knownMeta.isKnownRealPerson,
      genderWord,
      ageCue,
      ageNum: resolvedAgeNum,
      skinAgeCue,
      role: info.role,
      appearance: appearanceClean || info.appearance,
      fashionStyle: outfitClean || outfitSource,
      signature: info.signature,
      identityLock: info.identityLock,
      avatarVisualLock: info.avatarVisualLock,
      worldGenreHint: options?.worldGenreHint,
      lockAvatarIdentity: lockAvatar,
    },
    options?.collisionSalt ?? 0,
  );
  return String(structured.combinedClause ?? '').replace(/[\s.;,]+$/g, '');
}

function promptAlreadyHasConcreteIdentity(prompt: string): boolean {
  const lower = String(prompt || '').toLowerCase();
  const hasHair = /\b(?:hair|hairstyle|bangs|undercut|ponytail|bob|wavy|curly|parted)\b/i.test(
    lower,
  );
  const hasFaceOrAge =
    /\b(?:\d{2}[\s-]*year|early\s*[23]0s|mid[\s-]*[23]0s|late[\s-]*[23]0s|jawline|eyes|eyebrows|cheekbones|face|pores)\b/i.test(
      lower,
    );
  return hasHair && hasFaceOrAge;
}

export function splitStoryProseIntoBeats(
  cleanProse: string,
): Required<StoryImageBeatPrompts> {
  const withoutChat = stripNonSceneChatBlocks(String(cleanProse || ''));
  const normalized = sanitizeVisualPromptFragment(withoutChat || cleanProse);
  if (!normalized) {
    return {
      opening: 'Opening establishing scene of the current turn.',
      middle: 'Mid-scene character action and interaction of the current turn.',
      ending: 'Closing cinematic moment at the end of the current turn.',
    };
  }

  const paragraphs = normalized
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 6);

  if (paragraphs.length >= 3) {
    const n = paragraphs.length;
    const firstEnd = Math.max(1, Math.floor(n / 3));
    const secondEnd = Math.max(firstEnd + 1, Math.floor((n * 2) / 3));
    const openRaw = paragraphs.slice(0, firstEnd).join('\n');
    const midRaw = paragraphs.slice(firstEnd, secondEnd).join('\n');
    const endRaw = paragraphs.slice(secondEnd).join('\n');
    return {
      opening: trimToCleanSentence(openRaw, 380),
      middle: trimToCleanSentence(midRaw, 420),
      ending: trimToCleanSentence(endRaw, 380),
    };
  }

  if (paragraphs.length === 2) {
    const p1 = paragraphs[0];
    const p2 = paragraphs[1];
    const p1Sentences = p1.split(/(?<=[.!?…])\s+/).filter(Boolean);
    const p2Sentences = p2.split(/(?<=[.!?…])\s+/).filter(Boolean);
    const midBridge = [
      p1Sentences[p1Sentences.length - 1] || p1,
      p2Sentences[0] || p2,
    ]
      .filter(Boolean)
      .join(' ');
    return {
      opening: trimToCleanSentence(p1, 380),
      middle: trimToCleanSentence(midBridge, 420),
      ending: trimToCleanSentence(p2, 380),
    };
  }

  // Single paragraph: split by sentences or word boundaries into 3 slices
  const sentences = normalized
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length >= 3) {
    const n = sentences.length;
    const firstEnd = Math.max(1, Math.floor(n / 3));
    const secondEnd = Math.max(firstEnd + 1, Math.floor((n * 2) / 3));
    return {
      opening: trimToCleanSentence(sentences.slice(0, firstEnd).join(' '), 380),
      middle: trimToCleanSentence(
        sentences.slice(firstEnd, secondEnd).join(' '),
        420,
      ),
      ending: trimToCleanSentence(sentences.slice(secondEnd).join(' '), 380),
    };
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 12) {
    const firstEnd = Math.max(4, Math.floor(words.length / 3));
    const secondEnd = Math.max(firstEnd + 4, Math.floor((words.length * 2) / 3));
    return {
      opening: trimToCleanSentence(words.slice(0, firstEnd).join(' '), 380),
      middle: trimToCleanSentence(
        words.slice(firstEnd, secondEnd).join(' '),
        420,
      ),
      ending: trimToCleanSentence(words.slice(secondEnd).join(' '), 380),
    };
  }

  const compact = trimToCleanSentence(normalized, 380);
  return {
    opening: compact,
    middle: compact,
    ending: compact,
  };
}

export function resolveStoryBeatPromptsForTurn(
  turn?: Turn,
): StoryImageBeatPrompts {
  if (!turn) return {};
  const stored = turn.storyImagePrompts;
  const extracted = extractStoryImageBeatPrompts(
    turn.rawAssistant || turn.assistant || '',
  );
  const opening = sanitizeVisualPromptFragment(
    stored?.opening || extracted?.opening || '',
  );
  const middle = sanitizeVisualPromptFragment(
    stored?.middle || extracted?.middle || '',
  );
  const ending = sanitizeVisualPromptFragment(
    stored?.ending || extracted?.ending || '',
  );
  return {
    ...(opening ? { opening } : {}),
    ...(middle ? { middle } : {}),
    ...(ending ? { ending } : {}),
  };
}

export function buildStoryImagePromptContext(options: {
  state: ArkState;
  turn?: Turn;
  storyImageConfig: StoryImageConfig;
  overrideStoryText?: string;
  position?: StoryImagePosition;
  aiBeatPrompt?: string;
}): StoryImagePromptContextResult {
  const {
    state,
    turn,
    storyImageConfig: rawStoryImageConfig,
    overrideStoryText,
    position,
    aiBeatPrompt,
  } = options;
  const storyImageConfig = (rawStoryImageConfig || {}) as StoryImageConfig;
  const activeComp = getStoryBoundCompanionFromState(state);
  const npcs = Array.isArray(activeComp?.npcs) ? activeComp.npcs : [];
  const portraits = Array.isArray(state?.portraitBank?.portraits)
    ? state.portraitBank.portraits
    : [];
  const charStates = Array.isArray(state?.memory?.characterStates)
    ? state.memory.characterStates
    : [];
  const safeTurns = Array.isArray(state?.turns) ? state.turns : [];

  const targetTurn =
    turn ||
    (safeTurns.length
      ? safeTurns[Math.min(state.currentPage ?? 0, safeTurns.length - 1)] ||
        safeTurns[safeTurns.length - 1]
      : undefined);

  const fullCleanAssistant = targetTurn
    ? stripStoryPlanningAndMeta(targetTurn.assistant || '')
    : '';
  const fullCleanUser = targetTurn
    ? stripStoryPlanningAndMeta(targetTurn.user || '')
    : '';
  const fullCleanTurn = fullCleanAssistant || fullCleanUser;
  const sanitizedFullTurn = sanitizeVisualPromptFragment(
    stripNonSceneChatBlocks(fullCleanTurn) || fullCleanTurn,
  );

  // Separate opening / middle / ending beats from the current turn FIRST
  const beatSlices = position
    ? splitStoryProseIntoBeats(fullCleanTurn)
    : null;
  const beatProseSlice = position
    ? sanitizeVisualPromptFragment(beatSlices?.[position] || '')
    : trimToCleanSentence(sanitizedFullTurn, 480);
  const beatDirective = position ? STORY_BEAT_DIRECTIVES[position] : null;
  const cleanAiBeatPrompt = sanitizeVisualPromptFragment(aiBeatPrompt || '');
  const isAiPromptCleanEnglish =
    Boolean(cleanAiBeatPrompt) &&
    cleanAiBeatPrompt.length >= 20 &&
    !containsVietnameseText(cleanAiBeatPrompt);

  const rawMcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    ''
  ).trim();
  const mcKeyForFilter = normalizeNameKey(rawMcName);
  const mcPresentInTurn = isMcPresentInTurn(
    fullCleanAssistant,
    fullCleanUser,
    rawMcName,
    activeComp?.mc?.pronoun,
  );
  const mcPresentInBeat = position
    ? isMcPresentInTurn(
        beatProseSlice || cleanAiBeatPrompt,
        '',
        rawMcName,
        activeComp?.mc?.pronoun,
      )
    : mcPresentInTurn;

  const turnPresentRaw = extractPresentCharactersFromScene(
    [fullCleanAssistant, fullCleanUser].filter(Boolean).join('\n'),
    state,
  );
  const turnPresentFiltered = mcPresentInTurn
    ? turnPresentRaw
    : turnPresentRaw.filter((c) => {
        const k = normalizeNameKey(c);
        return (
          !(mcKeyForFilter && k === mcKeyForFilter) &&
          k !== 'nhan vat chinh' &&
          k !== 'nvc'
        );
      });

  // Prioritize characters actually appearing in THIS specific beat slice (opening / middle / ending)
  const beatSourceForChars = [beatProseSlice, cleanAiBeatPrompt]
    .filter(Boolean)
    .join('\n');
  const beatPresentRaw =
    position && beatSourceForChars
      ? extractPresentCharactersFromScene(beatSourceForChars, state)
      : turnPresentRaw;
  const beatPresentFiltered = mcPresentInBeat
    ? beatPresentRaw
    : beatPresentRaw.filter((c) => {
        const k = normalizeNameKey(c);
        return (
          !(mcKeyForFilter && k === mcKeyForFilter) &&
          k !== 'nhan vat chinh' &&
          k !== 'nvc'
        );
      });

  const explicitPromptHeadcount =
    detectExplicitHeadcountInEnglishPrompt(cleanAiBeatPrompt);
  const envFocusedOpening =
    position === 'opening' &&
    isEnvironmentFocusedOpening(beatProseSlice, cleanAiBeatPrompt);
  const beatHasPersonPronoun =
    /\b(?:cô|anh|hắn|nàng|y|cậu|chị|ông|bà|tôi|ta|mình|họ|hai\s+người|cả\s+hai|she|he|they|him|her|man|woman|girl|boy)\b/i.test(
      beatSourceForChars,
    );

  const preferClearFaceSolo = storyImageConfig.preferClearFaceSolo !== false;
  const lockAvatarIdentity = storyImageConfig.lockAvatarIdentity !== false;

  // Strict headcount gating:
  // - When preferClearFaceSolo is enabled (default), avoid 2+ person frames that warp faces;
  //   opening favors empty scene (0) or 1 central clear-face figure, while middle/ending lock to 1 focused figure.
  let presentCharacters: string[];
  if (explicitPromptHeadcount === 0) {
    presentCharacters = [];
  } else if (position === 'opening') {
    if (envFocusedOpening) {
      presentCharacters =
        beatPresentFiltered.length > 0 ? beatPresentFiltered.slice(0, 1) : [];
    } else if (beatPresentFiltered.length > 0) {
      presentCharacters = beatPresentFiltered.slice(
        0,
        preferClearFaceSolo ? 1 : 2,
      );
    } else if (!beatHasPersonPronoun && !mcPresentInBeat) {
      presentCharacters = [];
    } else {
      presentCharacters = turnPresentFiltered.slice(0, 1);
    }
  } else if (preferClearFaceSolo) {
    presentCharacters =
      beatPresentFiltered.length > 0
        ? beatPresentFiltered.slice(0, 1)
        : turnPresentFiltered.slice(0, 1);
  } else {
    presentCharacters =
      beatPresentFiltered.length > 0
        ? beatPresentFiltered.slice(0, 3)
        : turnPresentFiltered.slice(0, 2);
  }

  if (
    explicitPromptHeadcount !== null &&
    explicitPromptHeadcount > 0 &&
    presentCharacters.length > explicitPromptHeadcount
  ) {
    presentCharacters = presentCharacters.slice(0, explicitPromptHeadcount);
  }

  const extraCustom = sanitizeVisualPromptFragment(
    storyImageConfig.customSubject || '',
  );
  const styleObj = resolveStoryImageStyle(
    storyImageConfig.stylePreset,
    storyImageConfig.customStyles,
  );

  // Build concise visual identities for ONLY the locked characters in this frame
  const onSceneIdentities: ResolvedImageCharacterIdentity[] = [];
  const seenOnSceneKeys = new Set<string>();
  const pushOnSceneIdentity = (rawName: string, matchedDisplay?: string) => {
    const info = resolveImageCharacterIdentity(rawName, state, matchedDisplay);
    const idKeys = buildExpandedCharacterIdentityKeys(info.canonicalName, [rawName]);
    if (!idKeys.size || hasAnyKeyOverlap(idKeys, seenOnSceneKeys)) return;
    for (const k of idKeys) seenOnSceneKeys.add(k);
    onSceneIdentities.push(info);
  };

  for (const name of presentCharacters) {
    pushOnSceneIdentity(name, name);
  }
  // Only scan secondary characters when headcount isn't locked to empty/solo clear-face mode
  const maxAllowedForBeat =
    preferClearFaceSolo && storyImageConfig.targetMode === 'scene'
      ? explicitPromptHeadcount === 0
        ? 0
        : position === 'opening' && envFocusedOpening && presentCharacters.length === 0
          ? 0
          : 1
      : explicitPromptHeadcount !== null
        ? explicitPromptHeadcount
        : position === 'opening'
          ? envFocusedOpening
            ? Math.min(1, presentCharacters.length)
            : 2
          : 3;
  if (beatSourceForChars && onSceneIdentities.length < maxAllowedForBeat) {
    const mentionedInBeat = detectSecondaryCharactersInSceneText(
      beatSourceForChars,
      presentCharacters,
      state,
    );
    for (const extraInfo of mentionedInBeat.resolved) {
      if (onSceneIdentities.length >= maxAllowedForBeat) break;
      pushOnSceneIdentity(extraInfo.canonicalName, extraInfo.matchedDisplay);
    }
  }

  const worldGenreHint = [
    state.world?.genre,
    state.world?.name,
    state.world?.setting,
    activeComp?.worldSetting,
  ]
    .filter(Boolean)
    .join(' ');
  const lockedIdentities = onSceneIdentities.slice(0, maxAllowedForBeat);
  const distinctGroup = buildDistinctCharacterGroupEn(
    lockedIdentities.map((info) => {
      const genderWord = inferCharacterGenderEn(
        info,
        beatSourceForChars || sanitizedFullTurn,
      );
      const resolvedAgeNum = parseNumericAgeFromCue(info.age, info.ageNum);
      return {
        canonicalName: info.canonicalName,
        genderWord,
        ageCue: formatAccurateAgeCueEn(info.age, resolvedAgeNum),
        ageNum: resolvedAgeNum,
        skinAgeCue: buildAgeNaturalSkinRealismCue(resolvedAgeNum),
        role: info.role,
        appearance: info.appearance,
        fashionStyle: info.fashionStyle,
        signature: info.signature,
        identityLock: info.identityLock,
        avatarVisualLock: info.avatarVisualLock,
        worldGenreHint,
        lockAvatarIdentity,
      };
    }),
  );
  const lockedCharacterBriefs = lockedIdentities.map((info, idx) =>
    info.identityLock || info.avatarVisualLock
      ? formatCompactEnglishCharacterBrief(
          info,
          beatSourceForChars || sanitizedFullTurn,
          { lockAvatarIdentity, worldGenreHint, collisionSalt: idx },
        )
      : distinctGroup.entries[idx]?.combinedClause ||
        formatCompactEnglishCharacterBrief(
          info,
          beatSourceForChars || sanitizedFullTurn,
          { lockAvatarIdentity, worldGenreHint, collisionSalt: idx },
        ),
  );
  const lockedCharacterGroupClause =
    lockedCharacterBriefs.length > 1
      ? `${lockedCharacterBriefs
          .map((brief, idx) => `Character ${idx + 1}: ${brief}`)
          .join('; ')}, with each person having unmistakably distinct facial bone structure, contrasting hairstyle, unique clothing, and individual aura`
      : lockedCharacterBriefs[0] || '';

  let headcountInfo = buildHeadcountLockDirective(
    lockedIdentities,
    beatSourceForChars || sanitizedFullTurn,
  );
  // Keep headcount lock & negative prompt aligned when the English beat prompt explicitly names 0/1/2 people
  const effectiveExplicitHeadcount =
    preferClearFaceSolo &&
    storyImageConfig.targetMode === 'scene' &&
    explicitPromptHeadcount !== null &&
    explicitPromptHeadcount > 1
      ? 1
      : explicitPromptHeadcount;

  if (
    effectiveExplicitHeadcount !== null &&
    effectiveExplicitHeadcount !== headcountInfo.personCount
  ) {
    const lowerPrompt = cleanAiBeatPrompt.toLowerCase();
    if (effectiveExplicitHeadcount === 0) {
      headcountInfo = {
        personCount: 0,
        lockPhrase: 'empty scene, no people, no humans',
        negativeExtra: buildHeadcountNegativeDirective(0),
      };
    } else if (effectiveExplicitHeadcount === 1) {
      const genderWord =
        /\b(?:woman|girl|female|lady)\b/i.test(lowerPrompt) &&
        !/\b(?:man|boy|male)\b/i.test(lowerPrompt)
          ? 'woman'
          : /\b(?:man|boy|male)\b/i.test(lowerPrompt) &&
              !/\b(?:woman|girl|female|lady)\b/i.test(lowerPrompt)
            ? 'man'
            : 'person';
      headcountInfo = {
        personCount: 1,
        lockPhrase: `single person only, 1 ${genderWord} alone, no extra people, no crowd`,
        negativeExtra: buildHeadcountNegativeDirective(1),
      };
    } else if (effectiveExplicitHeadcount === 2) {
      const pairLabel = /\b1\s+man\s+and\s+1\s+woman\b/i.test(lowerPrompt)
        ? '1 man and 1 woman'
        : /\b2\s+men\b|\btwo\s+men\b/i.test(lowerPrompt)
          ? '2 men'
          : /\b2\s+women\b|\btwo\s+women\b/i.test(lowerPrompt)
            ? '2 women'
            : '2 people';
      headcountInfo = {
        personCount: 2,
        lockPhrase: `two people only, ${pairLabel}, no extra people, no crowd`,
        negativeExtra: buildHeadcountNegativeDirective(2),
      };
    }
  }

  // Detect new characters (for custom template variables)
  const priorTurnsText = safeTurns
    .filter((t) => !targetTurn || t.id !== targetTurn.id)
    .slice(-12)
    .map((t) => `${t.user || ''} ${t.assistant || ''}`)
    .join('\n')
    .toLowerCase();
  const newCharacters = presentCharacters.filter((name) => {
    const key = normalizeNameKey(name);
    const portrait = portraits.find(
      (p) => normalizeNameKey(p.name || '') === key,
    );
    const hasPortraitImg = Boolean(portrait?.imageData?.trim());
    const seenBefore = priorTurnsText.includes(name.toLowerCase());
    return !hasPortraitImg || !seenBefore;
  });

  // Current location grounded to active turn (translated cleanly to English)
  const presentKeys = new Set(presentCharacters.map((c) => normalizeNameKey(c)));
  const rawStateLoc =
    charStates.find(
      (cs) => presentKeys.has(normalizeNameKey(cs.name || '')) && cs.location?.trim(),
    )?.location?.trim() ||
    charStates.find((cs) => cs.location?.trim())?.location?.trim() ||
    '';
  const activeStateLoc = stripResidualVietnameseFromEnglishClause(
    translateVietnameseVisualToEnglish(translateCommonViVisualTerms(rawStateLoc)),
    presentCharacters,
  );
  const rawFallbackWorldLoc = trimToCleanSentence(
    state.world?.name?.trim() ||
      activeComp?.sourceQuery?.trim() ||
      state.world?.setting?.trim() ||
      activeComp?.worldSetting?.trim() ||
      '',
    75,
  );
  const fallbackWorldLoc = stripResidualVietnameseFromEnglishClause(
    translateVietnameseVisualToEnglish(
      translateCommonViVisualTerms(rawFallbackWorldLoc),
    ),
    presentCharacters,
  );
  const currentLocation =
    activeStateLoc || fallbackWorldLoc || 'environment matching the current scene';

  // Scene-first lighting resolution: current beat/turn lighting ALWAYS overrides stale Story Clock
  const visualLightingCue = resolveSceneLightingCue({
    sceneText: [beatProseSlice, cleanAiBeatPrompt, sanitizedFullTurn]
      .filter(Boolean)
      .join('\n'),
    locationText: [
      activeStateLoc,
      rawStateLoc,
      state.world?.setting || '',
      activeComp?.worldSetting || '',
    ]
      .filter(Boolean)
      .join(' '),
    clock: state.memory?.storyClock
      ? normalizeStoryClock(state.memory.storyClock)
      : undefined,
    clockEnabled: Boolean(state.memory?.storyClock?.enabled),
  });

  // Clean concise English-translated excerpt for non-English fallback
  const compactBeatExcerpt = stripResidualVietnameseFromEnglishClause(
    translateVietnameseVisualToEnglish(
      translateCommonViVisualTerms(
        trimToCleanSentence(
          position === 'opening' && envFocusedOpening
            ? stripQuotedMediaAndDialogue(beatProseSlice || sanitizedFullTurn) ||
                beatProseSlice ||
                sanitizedFullTurn
            : beatProseSlice || sanitizedFullTurn,
          200,
        ),
      ),
    ),
    presentCharacters,
  );

  const parts: string[] = [];
  let subjectLabel = 'Cảnh truyện';

  if (storyImageConfig.targetMode === 'npc') {
    const selectedNpc =
      npcs.find((n) => n.id === storyImageConfig.selectedNpcId) || npcs[0];
    if (selectedNpc) {
      subjectLabel = `NPC: ${selectedNpc.name || 'NPC'}`;
      const selInfo = resolveImageCharacterIdentity(
        selectedNpc.name || 'NPC',
        state,
      );
      headcountInfo = buildHeadcountLockDirective(
        [selInfo],
        beatSourceForChars || sanitizedFullTurn,
      );
      parts.push(headcountInfo.lockPhrase);
      parts.push(
        formatCompactEnglishCharacterBrief(
          selInfo,
          beatSourceForChars || sanitizedFullTurn,
        ),
      );
    } else {
      subjectLabel = 'NPC trong cảnh';
      parts.push(headcountInfo.lockPhrase);
      if (lockedCharacterBriefs.length) {
        parts.push(lockedCharacterBriefs.join('; '));
      }
    }
    if (isAiPromptCleanEnglish) {
      parts.push(cleanAiBeatPrompt);
    } else if (compactBeatExcerpt) {
      parts.push(compactBeatExcerpt);
    }
    parts.push(`Setting: ${currentLocation}`);
    parts.push(`Lighting: ${visualLightingCue}`);
    if (extraCustom) parts.push(extraCustom);
  } else if (storyImageConfig.targetMode === 'mc') {
    const mc = activeComp?.mc;
    const mcName = mc?.name || state.player?.name || 'Protagonist';
    subjectLabel = `NV chính: ${mcName}`;
    const mcInfo = resolveImageCharacterIdentity(mcName, state);
    headcountInfo = buildHeadcountLockDirective(
      [mcInfo],
      beatSourceForChars || sanitizedFullTurn,
    );
    parts.push(headcountInfo.lockPhrase);
    parts.push(
      formatCompactEnglishCharacterBrief(
        mcInfo,
        beatSourceForChars || sanitizedFullTurn,
      ),
    );
    if (isAiPromptCleanEnglish) {
      parts.push(cleanAiBeatPrompt);
    } else if (compactBeatExcerpt) {
      parts.push(compactBeatExcerpt);
    }
    parts.push(`Setting: ${currentLocation}`);
    parts.push(`Lighting: ${visualLightingCue}`);
    if (extraCustom) parts.push(extraCustom);
  } else if (storyImageConfig.targetMode === 'custom') {
    subjectLabel = extraCustom
      ? `Tùy chọn: ${extraCustom.slice(0, 32)}${extraCustom.length > 32 ? '…' : ''}`
      : 'Tùy chọn';
    if (extraCustom) {
      parts.push(extraCustom);
      if (!hasLightingTermsInPrompt(extraCustom)) {
        parts.push(visualLightingCue);
      }
    } else {
      parts.push(headcountInfo.lockPhrase);
      if (lockedCharacterBriefs.length) {
        parts.push(lockedCharacterBriefs.join('; '));
      }
      if (isAiPromptCleanEnglish) {
        parts.push(cleanAiBeatPrompt);
      } else if (compactBeatExcerpt) {
        parts.push(compactBeatExcerpt);
      }
      parts.push(visualLightingCue);
    }
  } else {
    subjectLabel = 'Cảnh truyện';
    const clearFaceCueNeeded =
      preferClearFaceSolo && headcountInfo.personCount > 0;
    if (isAiPromptCleanEnglish) {
      // Fast clean path: storyteller already provided concise English visual prompt
      const promptAlreadyLocksHeadcount =
        /\b(?:no\s+extra\s+people|empty\s+scene,\s*no\s+people|no\s+people)\b/i.test(
          cleanAiBeatPrompt,
        );
      if (!promptAlreadyLocksHeadcount || preferClearFaceSolo) {
        parts.push(headcountInfo.lockPhrase);
      }
      // ALWAYS prioritize explicit per-character identity lock / real-person reference photo
      // right after headcount so scene descriptions never override or warp facial/beard/hair traits.
      const hasExplicitCharacterLock = lockedIdentities.some(
        (id) =>
          Boolean(id.referenceImageData?.trim()) ||
          hasAnyCharacterIdentityLock(id.identityLock) ||
          Boolean(id.avatarVisualLock?.trim()),
      );
      if (
        lockAvatarIdentity &&
        headcountInfo.personCount > 0 &&
        lockedCharacterBriefs.length > 0 &&
        (hasExplicitCharacterLock || !promptAlreadyHasConcreteIdentity(cleanAiBeatPrompt))
      ) {
        parts.push(`Character identity: ${lockedCharacterBriefs.join('; ')}`);
      }
      parts.push(cleanAiBeatPrompt);
      if (clearFaceCueNeeded) {
        parts.push(STORY_IMAGE_CLEAR_FACE_POSITIVE_DIRECTIVE);
      }
      if (!hasLightingTermsInPrompt(cleanAiBeatPrompt)) {
        parts.push(visualLightingCue);
      }
    } else {
      // Compact structured path (ready for fast English distillation in generateStoryImage or direct offline use)
      parts.push(headcountInfo.lockPhrase);
      if (clearFaceCueNeeded) {
        parts.push(STORY_IMAGE_CLEAR_FACE_POSITIVE_DIRECTIVE);
      } else if (beatDirective?.enCue) {
        parts.push(beatDirective.enCue);
      }
      if (headcountInfo.personCount > 0 && lockedCharacterBriefs.length) {
        parts.push(`Character identity: ${lockedCharacterBriefs.join('; ')}`);
      }
      if (cleanAiBeatPrompt) {
        parts.push(translateCommonViVisualTerms(cleanAiBeatPrompt));
      } else if (compactBeatExcerpt) {
        parts.push(compactBeatExcerpt);
      }
      if (currentLocation) {
        parts.push(`Location: ${currentLocation}`);
      }
      parts.push(`Lighting: ${visualLightingCue}`);
    }
    if (extraCustom) {
      parts.push(extraCustom);
    }
  }

  const effectiveHeadcountNegative =
    preferClearFaceSolo && headcountInfo.personCount > 0
      ? [headcountInfo.negativeExtra, STORY_IMAGE_CLEAR_FACE_NEGATIVE_DIRECTIVE]
          .filter(Boolean)
          .join(', ')
      : headcountInfo.negativeExtra;

  const resolvedStoryTextRaw =
    sanitizeVisualPromptFragment(overrideStoryText || '') ||
    (storyImageConfig.targetMode === 'custom' && extraCustom
      ? extraCustom
      : isAiPromptCleanEnglish
        ? cleanAiBeatPrompt
        : translateVietnameseVisualToEnglish(
            translateCommonViVisualTerms(
              cleanAiBeatPrompt || compactBeatExcerpt || sanitizedFullTurn,
            ),
          )) ||
    'Atmospheric scene matching the current story turn';
  const resolvedStoryText =
    stripResidualVietnameseFromEnglishClause(
      translateVietnameseVisualToEnglish(resolvedStoryTextRaw),
      presentCharacters,
    ) || 'expressive cinematic moment matching the current scene';

  const imgCount = Math.max(1, Math.min(4, Number(storyImageConfig.imageCount) || 1));
  const gridKey = storyImageConfig.imageGridMode || 'single';
  const genKey = storyImageConfig.imageGenerationMode || 'scene';
  const enStyleTokens = resolveEnglishStyleTokens(styleObj);
  const activeCameraAngle = resolveCameraAngle(storyImageConfig.cameraAngle);

  const variables: Record<string, string> = {
    '${story_text}': resolvedStoryText,
    '${onscene_characters_full}':
      headcountInfo.personCount > 0 && lockedCharacterGroupClause
        ? `${headcountInfo.lockPhrase}, ${lockedCharacterGroupClause}`
        : headcountInfo.lockPhrase,
    '${current_time}': visualLightingCue,
    '${current_location}': currentLocation,
    '${entry_decision_new_characters}': newCharacters.length
      ? newCharacters.join(', ')
      : 'None',
    '${image_count}': String(imgCount),
    '${image_grid_mode}':
      IMAGE_GRID_MODE_EN[gridKey] || IMAGE_GRID_MODE_EN.single,
    '${image_generation_mode}':
      IMAGE_GENERATION_MODE_EN[genKey] || IMAGE_GENERATION_MODE_EN.scene,
    '${image_style_name}': enStyleTokens.englishName,
    '${image_style_description}': enStyleTokens.englishDescription,
    '${image_style_prompt_guide}': enStyleTokens.englishGuide,
  };

  const beatSubjectLabel = position
    ? storyImageConfig.targetMode === 'scene'
      ? STORY_IMAGE_POSITION_META[position].label
      : `${STORY_IMAGE_POSITION_META[position].shortLabel} · ${subjectLabel}`
    : subjectLabel;

  // Build cohesive 4-part structured English prompt for non-custom-template mode
  const cohesiveDefaultPrompt = composeCohesiveEnglishImagePrompt({
    headcountLock: headcountInfo.lockPhrase,
    characterGroupText:
      headcountInfo.personCount > 0 ? lockedCharacterGroupClause : undefined,
    actionExpressionText: [
      isAiPromptCleanEnglish ? cleanAiBeatPrompt : resolvedStoryText,
      extraCustom && storyImageConfig.targetMode !== 'custom' ? extraCustom : '',
    ]
      .filter(Boolean)
      .join(', '),
    cameraFramingGuide: [
      preferClearFaceSolo && headcountInfo.personCount > 0
        ? STORY_IMAGE_CLEAR_FACE_POSITIVE_DIRECTIVE
        : beatDirective?.enCue || '',
      activeCameraAngle.promptGuide || '',
    ]
      .filter(Boolean)
      .join(', '),
    settingLocation: currentLocation,
    lightingAtmosphere: visualLightingCue,
    styleGuide: enStyleTokens.englishGuide,
    preserveNames: presentCharacters,
  });

  return {
    variables,
    subjectLabel: beatSubjectLabel,
    presentCharacters,
    newCharacters,
    defaultPartsPrompt:
      cohesiveDefaultPrompt ||
      parts.filter(Boolean).join(', ').trim() ||
      `${headcountInfo.lockPhrase}, ${visualLightingCue}`,
    personCount: headcountInfo.personCount,
    headcountLock: headcountInfo.lockPhrase,
    headcountNegative: effectiveHeadcountNegative,
    visualLightingCue,
    lockedCharacterBriefs,
    lockedIdentities,
    beatProseSlice,
    currentLocation,
    isAiPromptCleanEnglish,
  };
}

export function previewStoryImagePrompt(options: {
  state: ArkState;
  turn?: Turn;
  storyImageConfig: StoryImageConfig;
  draftTemplate?: string;
  overrideStoryText?: string;
}): {
  beforeInjection: string;
  afterInjection: string;
  finalEnglishPrompt: string;
  variables: Record<string, string>;
  subjectLabel: string;
} {
  const {
    state,
    turn,
    storyImageConfig: rawStoryImageConfig,
    draftTemplate,
    overrideStoryText,
  } = options;
  const storyImageConfig = (rawStoryImageConfig || {}) as StoryImageConfig;
  const ctx = buildStoryImagePromptContext({
    state,
    turn,
    storyImageConfig,
    overrideStoryText,
  });
  const activeStyle = resolveStoryImageStyle(
    storyImageConfig.stylePreset,
    storyImageConfig.customStyles,
  );
  const rawTemplate = String(
    draftTemplate !== undefined
      ? draftTemplate ?? ''
      : storyImageConfig.promptTemplate ?? '',
  ).trim();
  const beforeInjection = rawTemplate || DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE;
  const afterInjection = interpolateImagePromptTemplate(
    beforeInjection,
    ctx.variables,
    {
      style: activeStyle,
      cameraAngle: storyImageConfig.cameraAngle,
    },
  );
  const normalizedEnglishTemplate = interpolateImagePromptTemplate(
    beforeInjection,
    ctx.variables,
    {
      style: activeStyle,
      cameraAngle: storyImageConfig.cameraAngle,
      englishNormalize: true,
      preserveNames: ctx.presentCharacters,
    },
  );
  const finalEnglishPrompt = rawTemplate
    ? applyImageStyleVariables(
        normalizedEnglishTemplate,
        activeStyle,
        storyImageConfig.customStyles,
        storyImageConfig.cameraAngle,
      )
    : appendNoTextVisualConstraint(ctx.defaultPartsPrompt);
  return {
    beforeInjection,
    afterInjection,
    finalEnglishPrompt,
    variables: ctx.variables,
    subjectLabel: ctx.subjectLabel,
  };
}

export function buildStoryImagePrompt(options: {
  state: ArkState;
  turn?: Turn;
  storyImageConfig: StoryImageConfig;
  position?: StoryImagePosition;
  aiBeatPrompt?: string;
  existingBeatComparison?: ReferenceComparisonResult | null;
}): {
  prompt: string;
  subjectLabel: string;
  headcountNegative: string;
  personCount: number;
  headcountLock: string;
  visualLightingCue: string;
  hasCustomTemplate: boolean;
  context: StoryImagePromptContextResult;
  comparisonPatch: DerivedComparisonPromptPatch;
  comparisonSourceLabel?: string;
  comparisonMismatches?: string[];
} {
  const {
    state,
    turn,
    storyImageConfig: rawStoryImageConfig,
    position,
    aiBeatPrompt,
    existingBeatComparison,
  } = options;
  const storyImageConfig = (rawStoryImageConfig || {}) as StoryImageConfig;
  const ctx = buildStoryImagePromptContext({
    state,
    turn,
    storyImageConfig,
    position,
    aiBeatPrompt,
  });
  const styleObj = resolveStoryImageStyle(
    storyImageConfig.stylePreset,
    storyImageConfig.customStyles,
  );

  // Resolve verified reference comparison patch (beat's own comparison > on-scene portrait comparison)
  const beatFromTurn =
    !existingBeatComparison && turn && position
      ? getTurnStoryImages(turn).find((b) => b.position === position)
          ?.referenceComparison
      : existingBeatComparison;
  const cmpResolved =
    ctx.personCount > 0
      ? resolveStoryBeatComparisonSource(
          state,
          beatFromTurn,
          ctx.lockedIdentities,
        )
      : {};
  const comparisonPatch = deriveReferenceComparisonPromptPatch(
    cmpResolved.comparison,
    {
      globalEnabled: storyImageConfig.applyComparisonToPrompt !== false,
      knownAgeNum: cmpResolved.knownAgeNum,
      profileAppearance: cmpResolved.profileAppearance,
      profileFashionStyle: cmpResolved.profileFashionStyle,
      profileSignature: cmpResolved.profileSignature,
    },
  );
  const comparisonMismatches = cmpResolved.comparison?.mismatches;
  const withComparisonApplied = (rawBuiltPrompt: string): string =>
    appendNoTextVisualConstraint(
      sanitizeVisualPromptFragment(
        comparisonPatch.active
          ? enforceComparisonPatchOnPrompt(
              rawBuiltPrompt,
              comparisonPatch.patchText,
            )
          : rawBuiltPrompt,
      ),
    );

  // If user saved a genuine custom prompt template (not the legacy poisoned Chinese planner), render through it
  const rawCustomTemplate = String(storyImageConfig.promptTemplate ?? '').trim();
  const customTemplate = isLegacyPoisonedImagePromptTemplate(rawCustomTemplate)
    ? ''
    : rawCustomTemplate;
  if (customTemplate) {
    const rendered = interpolateImagePromptTemplate(
      customTemplate,
      ctx.variables,
      {
        style: styleObj,
        cameraAngle: storyImageConfig.cameraAngle,
        englishNormalize: true,
        preserveNames: ctx.presentCharacters,
      },
    );
    const styledRendered = applyImageStyleVariables(
      rendered,
      styleObj,
      storyImageConfig.customStyles,
      storyImageConfig.cameraAngle,
    );
    return {
      prompt: withComparisonApplied(styledRendered),
      subjectLabel: ctx.subjectLabel,
      headcountNegative: ctx.headcountNegative,
      personCount: ctx.personCount,
      headcountLock: ctx.headcountLock,
      visualLightingCue: ctx.visualLightingCue,
      hasCustomTemplate: true,
      context: ctx,
      comparisonPatch,
      comparisonSourceLabel: cmpResolved.sourceLabel,
      comparisonMismatches,
    };
  }

  // Otherwise use the cohesive 4-part English visual prompt with strict no-text & headcount enforcement
  let basePrompt = sanitizeVisualPromptFragment(ctx.defaultPartsPrompt);
  if (HAS_ANY_IMAGE_TEMPLATE_VAR_RE.test(basePrompt)) {
    basePrompt = interpolateImagePromptTemplate(basePrompt, ctx.variables, {
      style: styleObj,
      cameraAngle: storyImageConfig.cameraAngle,
      englishNormalize: true,
      preserveNames: ctx.presentCharacters,
    });
    return {
      prompt: withComparisonApplied(basePrompt),
      subjectLabel: ctx.subjectLabel,
      headcountNegative: ctx.headcountNegative,
      personCount: ctx.personCount,
      headcountLock: ctx.headcountLock,
      visualLightingCue: ctx.visualLightingCue,
      hasCustomTemplate: false,
      context: ctx,
      comparisonPatch,
      comparisonSourceLabel: cmpResolved.sourceLabel,
      comparisonMismatches,
    };
  }

  const finalPrompt = applyImageStyleVariables(
    basePrompt,
    styleObj,
    storyImageConfig.customStyles,
    storyImageConfig.cameraAngle,
  );
  return {
    prompt: withComparisonApplied(finalPrompt),
    subjectLabel: ctx.subjectLabel,
    headcountNegative: ctx.headcountNegative,
    personCount: ctx.personCount,
    headcountLock: ctx.headcountLock,
    visualLightingCue: ctx.visualLightingCue,
    hasCustomTemplate: false,
    context: ctx,
    comparisonPatch,
    comparisonSourceLabel: cmpResolved.sourceLabel,
    comparisonMismatches,
  };
}

export type VisualPromptCompilerTarget =
  | 'latent.moe'
  | 'seedream'
  | 'comfyui'
  | 'custom';

export function resolveVisualPromptCompilerTarget(
  provider?: AppConfig['imageProvider'],
): VisualPromptCompilerTarget {
  if (provider === 'latent') return 'latent.moe';
  if (provider === 'comfyui') return 'comfyui';
  if (provider === 'custom') return 'custom';
  return 'seedream';
}

export const STRICT_VISUAL_PROMPT_COMPILER_CORE_PROMPT = [
  'You are a strict visual prompt compiler for a 3D donghua / stylized 3D roleplay game engine (supporting wuxia, xianxia, and modern settings).',
  'Your task is to convert raw character/NPC profile data, currently equipped attire/gear, and scene context into a sharp, dynamic, high-craft English image generation prompt that preserves character identity while giving strong presence, pose, and lighting—never dull or generic.',
  '',
  'CORE RULES:',
  '1. STRICT ZERO-INVENTION GROUNDING: Ground every visual trait strictly in the provided character/NPC profile, equipped inventory/Phong Vat Chi gear, and scene context. NEVER invent `tattoo`, `tattoos`, `neck tattoo`, `scar`, `piercing`, weapons, or props unless explicitly stated in the profile or active scene injuries/gear.',
  '2. Preserve exact anatomical placement for distinctive marks ONLY when present in the profile (e.g., "scar across left cheek", "ink tattoo along right forearm", "jade pendant on chest"). Never move or swap sides.',
  '3. STORY-SYNCED ATTIRE (NO KIMONO/KATANA DRIFT): Never assign Japanese `kimono`, `yukata`, `katana`, or `samurai` gear to wuxia/xianxia characters unless explicitly stated in the profile/setting. Always prioritize currently equipped outfit/armor & weapon from the profile or inventory/Phong Vat Chi FIRST (sect martial robes, Taoist robes, light armor, Chinese hanfu robes, Chinese jian sword, dao saber, bamboo staff, jade flute, etc.), keeping short tags and detailed descriptions 100% synchronized.',
  '4. GENDER-SEPARATED VISUAL FIDELITY: For female wuxia/xianxia characters, favor graceful poised proportions and authentic Chinese hanfu/xianxia robes grounded in the profile. For male wuxia/xianxia characters, preserve distinctly masculine facial structure, defined jawline, straight brows, and martial stature—NEVER inject feminine/delicate/slender-waist/soft-curves body tags or unowned tattoos/scars.',
  '5. Translate personality and status into concrete visual presence: sharp gaze, confident or composed posture, clean jawline/brow structure, and dynamic framing so main characters and key figures look commanding and expressive rather than flat, obscured, or muddy.',
  '6. Style adaptation by setting & target engine:',
  '   - Default to high-craft 3D donghua / stylized 3D aesthetic (clean sculpted features, rich fabric/metal/skin textures, controlled rim & key lighting, crisp depth) across wuxia, xianxia, and modern scenes—avoiding muddy dark shadows that swallow the face or outfit.',
  '   - When target is "latent.moe": keep compact, well-structured comma-separated tags and visual phrases with clean syntax and zero contradictory style tags clashing (never mix flat 2D lineart/cel-shading with 3D donghua rendering). Put character appearance, outfit, and weapon FIRST before style tags.',
  '   - When target is another model: adapt phrasing naturally to that model while keeping the same strict trait grounding and strong visual composition.',
  '7. Maintain consistency across turns: keep fixed appearance traits (hair, eyes, real profile marks, signature/equipped outfit & gear) stable while updating pose, expression, camera angle, and lighting/background for the scene.',
  '',
  'OUTPUT STRUCTURE (single line, comma-separated English tags/phrases):',
  '[Subject, Framing & Style: e.g. 1boy, 3d donghua style, stylized 3d portrait, upper body]',
  '[Core Appearance & Fixed Marks: hair, eyes, skin tone, and ONLY real profile marks if present]',
  '[Expression, Pose & Presence: clear facial expression, confident/fitting posture, dynamic angle]',
  '[Outfit & Gear: synchronized story/equipped clothing cut, colors, fabric/material texture, real weapons/props]',
  '[Lighting & Environment: clear key/rim lighting keeping face & details readable, fitting background, high clarity]',
  '',
  'Do not include explanations, labels, markdown, quotes, Vietnamese, dates/times, text/watermarks, or notes outside the compiled prompt.',
].join('\n');

export function buildStrictVisualPromptCompilerSystemPrompt(options: {
  targetEngine: VisualPromptCompilerTarget;
  mode: 'portrait' | 'scene';
  worldSetting?: 'wuxia' | 'xianxia' | 'modern' | string;
  hasReferencePhotos?: boolean;
  hasComparisonFixes?: boolean;
}): string {
  const {
    targetEngine,
    mode,
    worldSetting,
    hasReferencePhotos,
    hasComparisonFixes,
  } = options;
  const parts: string[] = [STRICT_VISUAL_PROMPT_COMPILER_CORE_PROMPT];

  const settingNote = worldSetting
    ? ` ACTIVE WORLD SETTING: ${worldSetting} (reflect authentic architecture, attire materials, and lighting mood for this setting in high-craft 3D donghua / stylized 3D aesthetics; NEVER use kimono or katana in wuxia/xianxia unless explicitly in profile).`
    : '';

  parts.push(
    targetEngine === 'latent.moe'
      ? `ACTIVE TARGET ENGINE: latent.moe (${mode === 'portrait' ? 'solo 3D donghua / stylized 3D character portrait' : '3D donghua / stylized 3D scene illustration'}).${settingNote} Emit compact, well-structured comma-separated English tags and visual phrases with clear emphasis and zero clashing 2D flat/lineart tags. Start with accurate subject count, 3d donghua style, stylized 3d, and dynamic framing (e.g. 1boy, solo, 3d donghua style, stylized 3d portrait, upper body OR 1girl, solo, 3d donghua style, stylized 3d portrait, upper body OR no humans, 3d donghua style, stylized 3d scenery). Ensure clean sculpted facial features, rich fabric/metal/skin material texture, controlled key & rim lighting keeping face and outfit crisp and readable, and high clarity. NEVER add tattoos, scars, piercings, or unowned props not in the profile.`
      : `ACTIVE TARGET ENGINE: ${targetEngine} (${mode === 'portrait' ? '3D donghua / stylized 3D character portrait' : '3D donghua / stylized 3D scene illustration'}).${settingNote} Follow the exact 5-part single-line comma-separated structure with strict trait grounding, zero invented marks (no stray tattoos/scars/piercings), synchronized profile/equipped attire, strong character presence, rich material textures, and clear key/rim lighting with crisp depth.`,
  );

  if (hasReferencePhotos) {
    parts.push(
      'REFERENCE PHOTO CROSS-CHECK: Inspect the attached reference photo(s) first to verify exact facial structure, age maturity, hair color/style, eye shape, and visible marks/tattoos/accessories. Never copy the reference photo background into the scene, never invent marks not in the photo/profile, and preserve profile-locked hair color and exact anatomical locations.',
    );
  }

  if (hasComparisonFixes) {
    parts.push(
      'TARGETED COMPARISON CORRECTIONS: Apply every listed comparison fix explicitly while keeping all already-matched core appearance tags and fixed anatomical marks intact.',
    );
  }

  return parts.join('\n\n');
}

export function isWuxiaOrXianxiaWorldState(state?: ArkState): boolean {
  const activeComp = state ? getStoryBoundCompanionFromState(state) : undefined;
  const activeMemory =
    (activeComp?.id && state?.companionMemories?.[activeComp.id]) ||
    state?.memory;
  const cultKind = activeMemory?.cultivation?.enabled
    ? activeMemory.cultivation.systemKind
    : undefined;
  if (cultKind === 'wuxia' || cultKind === 'xianxia' || cultKind === 'xuanhuan') {
    return true;
  }
  const hint = [
    state?.world?.genre,
    state?.world?.name,
    state?.world?.setting,
    activeComp?.worldSetting,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/(?:hiện\s*đại|đô\s*thị|modern|urban|sci[\s-]*fi|cyber|học\s*đường|showbiz)/.test(hint)) {
    return false;
  }
  return /(?:kiếm\s*hiệp|kiem\s*hiep|wuxia|giang\s*hồ|võ\s*lâm|tiên\s*hiệp|tien\s*hiep|tu\s*tiên|huyền\s*huyễn|xianxia|xuanhuan|tu\s*chân|cổ\s*đại|cổ\s*trang|cung\s*đấu|ancient)/.test(
    hint,
  );
}

export function isXianxiaWorldState(state?: ArkState): boolean {
  const activeComp = state ? getStoryBoundCompanionFromState(state) : undefined;
  const activeMemory =
    (activeComp?.id && state?.companionMemories?.[activeComp.id]) ||
    state?.memory;
  const cultKind = activeMemory?.cultivation?.enabled
    ? activeMemory.cultivation.systemKind
    : undefined;
  if (cultKind === 'xianxia' || cultKind === 'xuanhuan') return true;
  const hint = [
    state?.world?.genre,
    state?.world?.name,
    state?.world?.setting,
    activeComp?.worldSetting,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /(?:tiên\s*hiệp|tien\s*hiep|tu\s*tiên|huyền\s*huyễn|xianxia|xuanhuan|tu\s*chân)/.test(
    hint,
  );
}

export function appendWuxiaXianxiaDonghuaPromptTags(
  rawPrompt: string,
  options?: {
    state?: ArkState;
    isWuxiaOrXianxia?: boolean;
    isSceneryOnly?: boolean;
    gender?: 'male' | 'female' | 'mixed' | 'neutral';
    provider?: ImageProvider;
  },
): string {
  let clean = String(rawPrompt || '').trim().replace(/,+\s*$/, '');
  if (!clean) return '';
  const enabled =
    typeof options?.isWuxiaOrXianxia === 'boolean'
      ? options.isWuxiaOrXianxia
      : isWuxiaOrXianxiaWorldState(options?.state);
  if (!enabled) return clean;

  const provider =
    options?.provider || options?.state?.config?.imageProvider || 'seedream';
  const isXianxia = isXianxiaWorldState(options?.state);
  const sceneryOnly =
    Boolean(options?.isSceneryOnly) ||
    /\b(?:no\s+humans|empty\s+scene|no\s+people)\b/i.test(clean);
  const resolvedGender = sceneryOnly
    ? 'neutral'
    : options?.gender || inferPromptGenderKind(clean);

  // Never allow feminine/slender-waist body tags on male-only or scenery-only prompts
  if (resolvedGender === 'male' || sceneryOnly) {
    clean = stripFeminineBodyTagsForMalePrompt(clean);
  }

  const lower = clean.toLowerCase();
  const hasExplicitAttire =
    /\b(?:robe|robes|hanfu|attire|armor|armour|coat|cloak|jacket|dress|gown|tunic|outfit|garment|vest|silk|brocade|shirt|pants|trousers|sash|skirt|daoist|taoist|martial\s+uniform|sect\s+uniform)\b/i.test(
      lower,
    );

  // Profile appearance, equipped attire, and Phong Vat Chi weapon ALWAYS remain at the front (`clean`).
  // Append gender-appropriate visual refinement ONLY after profile traits, then append the shared style & quality block.
  const genderTags: string[] = [];
  if (!sceneryOnly && resolvedGender === 'female') {
    if (!hasExplicitAttire) {
      genderTags.push(
        isXianxia
          ? 'flowing traditional Chinese xianxia hanfu robes'
          : 'traditional Chinese wuxia hanfu robes',
      );
    }
    genderTags.push(
      ...splitTopLevelPromptSegments(
        provider === 'seedream'
          ? WUXIA_XIANXIA_3D_DONGHUA_SEEDREAM_FEMALE_CUES
          : WUXIA_XIANXIA_3D_DONGHUA_FEMALE_REFINEMENT_TAGS,
      ),
    );
  } else if (!sceneryOnly && resolvedGender === 'male') {
    if (!hasExplicitAttire) {
      genderTags.push(
        isXianxia
          ? 'traditional Chinese xianxia martial robes'
          : 'traditional Chinese wuxia martial robes',
      );
    }
    genderTags.push(
      ...splitTopLevelPromptSegments(
        provider === 'seedream'
          ? WUXIA_XIANXIA_3D_DONGHUA_SEEDREAM_MALE_CUES
          : WUXIA_XIANXIA_3D_DONGHUA_MALE_REFINEMENT_TAGS,
      ),
    );
  }

  const sharedStyleBlock =
    provider === 'seedream'
      ? WUXIA_XIANXIA_3D_DONGHUA_SEEDREAM_CUES
      : WUXIA_XIANXIA_3D_DONGHUA_STYLE_BLOCK;

  const candidateSegments = [
    ...genderTags,
    ...(isXianxia && !/\bxianxia\b/i.test(lower) ? ['xianxia'] : []),
    ...splitTopLevelPromptSegments(sharedStyleBlock),
  ];

  const missing = candidateSegments.filter(
    (seg) => seg && !lower.includes(seg.toLowerCase()),
  );
  if (missing.length === 0) return clean;
  return `${clean}, ${missing.join(', ')}`;
}

export function resolveCharacterEquippedGearForVisualPrompt(
  state?: ArkState,
  characterName?: string,
  explicitIsMc?: boolean,
): {
  outfitTextVi: string;
  outfitTextEn: string;
  weaponTextVi: string;
  weaponTextEn: string;
  accessoryTextVi: string;
  accessoryTextEn: string;
  combinedRawVi: string;
  combinedCleanEn: string;
} {
  const empty = {
    outfitTextVi: '',
    outfitTextEn: '',
    weaponTextVi: '',
    weaponTextEn: '',
    accessoryTextVi: '',
    accessoryTextEn: '',
    combinedRawVi: '',
    combinedCleanEn: '',
  };
  if (!state) return empty;
  const activeComp = getStoryBoundCompanionFromState(state);
  const mcKeys = new Set(
    [state.player?.name, activeComp?.mc?.name]
      .map((n) => normalizeCharacterKey(n || ''))
      .filter(Boolean),
  );
  const charKey = normalizeCharacterKey(characterName || '');
  const isMc = Boolean(explicitIsMc || (charKey && mcKeys.has(charKey)));
  if (!isMc) return empty;

  const activeMemory =
    (activeComp?.id && state.companionMemories?.[activeComp.id]) ||
    state.memory;
  const cult = activeMemory?.cultivation;
  const inv = Array.isArray(cult?.inventory) ? cult.inventory : [];
  const eq = cult?.equipment || {};
  const findById = (id?: string) =>
    id ? inv.find((item) => item && item.id === id) : undefined;

  const armorItem =
    findById(eq.armor) ||
    inv.find((item) => item && item.category === 'outfit' && eq.armor === item.id);
  const weaponItem = findById(eq.weapon);
  const accessoryItems = [
    findById(eq.accessory),
    findById(eq.relic),
    findById(eq.soul_vessel),
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));

  const formatItemVi = (item?: { name: string; description?: string }): string => {
    if (!item?.name) return '';
    const desc = String(item.description || '').trim();
    return desc ? `${item.name} (${trimToCleanSentence(desc, 75)})` : item.name;
  };
  const translateGearEn = (raw: string, fallbackType: 'outfit' | 'weapon' | 'accessory'): string => {
    if (!raw.trim()) return '';
    const isAncient = isWuxiaOrXianxiaWorldState(state);
    const translated = sanitizeVisualPromptFragment(
      stripResidualVietnameseFromEnglishClause(
        translateVietnameseVisualToEnglish(translateCommonViVisualTerms(raw)),
        [],
      ),
    );
    if (translated.length >= 6) return translated;
    // Semantic visual fallback by Vietnamese martial/cultivation weapon/attire keywords
    const lower = raw.toLowerCase();
    if (fallbackType === 'outfit') {
      if (/đạo\s*bào/.test(lower)) return 'traditional Chinese Taoist robes';
      if (/nhuyễn\s*giáp|giáp\s*nhẹ/.test(lower))
        return 'lightweight Chinese martial leather and scale armor';
      if (/giáp|chiến\s*y|hộ\s*giáp/.test(lower))
        return 'ornate Chinese martial battle armor';
      if (/môn\s*phái|đệ\s*tử|y\s*phục/.test(lower))
        return 'traditional Chinese martial sect robes with woven sash';
      if (/trường\s*bào|hán\s*phục|cổ\s*trang|cẩm\s*bào/.test(lower))
        return 'flowing traditional Chinese hanfu robes';
      return isAncient
        ? 'traditional Chinese martial robes matching equipped attire'
        : 'profile-matched attire';
    }
    if (fallbackType === 'weapon') {
      if (/trọng\s*kiếm|huyền\s*thiết/.test(lower))
        return 'heavy dark-iron Chinese broadsword';
      if (/nhuyễn\s*kiếm/.test(lower)) return 'flexible Chinese belt jian sword';
      if (/kiếm/.test(lower)) return 'Chinese double-edged jian sword';
      if (/đoản\s*đao/.test(lower)) return 'Chinese short curved dao blade';
      if (/đao/.test(lower)) return 'Chinese curved dao saber';
      if (/bổng|côn|trượng/.test(lower)) return 'martial bamboo staff';
      if (/tiêu|sáo/.test(lower)) return 'carved jade flute';
      if (/thương|mâu|kích/.test(lower)) return 'Chinese martial spear';
      if (/quạt|phiến/.test(lower)) return 'ornate Chinese folding fan';
      if (/cung|nỏ/.test(lower)) return 'traditional recurve bow';
      return isAncient ? 'traditional Chinese martial weapon' : 'equipped weapon';
    }
    if (/ngọc\s*bội|ngọc/.test(lower)) return 'carved jade waist pendant';
    if (/hộ\s*tâm\s*kính/.test(lower)) return 'polished bronze chest guard';
    if (/lệnh\s*bài/.test(lower)) return 'engraved sect waist token';
    return '';
  };

  const outfitTextVi = formatItemVi(armorItem);
  const weaponTextVi = formatItemVi(weaponItem);
  const accessoryTextVi = accessoryItems
    .map((it) => formatItemVi(it))
    .filter(Boolean)
    .join(', ');

  const outfitTextEn = translateGearEn(outfitTextVi, 'outfit');
  const weaponTextEn = translateGearEn(weaponTextVi, 'weapon');
  const accessoryTextEn = accessoryItems
    .map((it) => translateGearEn(formatItemVi(it), 'accessory'))
    .filter(Boolean)
    .join(', ');

  const combinedRawVi = [outfitTextVi, weaponTextVi, accessoryTextVi]
    .filter(Boolean)
    .join(' | ');
  const combinedCleanEn = [
    outfitTextEn,
    weaponTextEn ? `carrying ${weaponTextEn}` : '',
    accessoryTextEn,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    outfitTextVi,
    outfitTextEn,
    weaponTextVi,
    weaponTextEn,
    accessoryTextVi,
    accessoryTextEn,
    combinedRawVi,
    combinedCleanEn,
  };
}

export function resolveCompilerWorldSettingLabel(state?: ArkState): string {
  const genre = String(state?.world?.genre || '').toLowerCase();
  const hint = `${genre} ${state?.world?.name || ''} ${state?.world?.setting || ''}`.toLowerCase();
  if (/(?:kiếm\s*hiệp|kiem\s*hiep|wuxia|giang\s*hồ|võ\s*lâm)/.test(hint)) {
    return 'wuxia (martial arts jianghu)';
  }
  if (/(?:tiên\s*hiệp|tien\s*hiep|tu\s*tiên|huyền\s*huyễn|xianxia|xuanhuan|tu\s*chân)/.test(hint)) {
    return 'xianxia (immortal cultivation fantasy)';
  }
  if (/(?:hiện\s*đại|đô\s*thị|modern|urban|sci[\s-]*fi|cyber|học\s*đường|showbiz)/.test(hint)) {
    return 'modern';
  }
  return state?.world?.genre || 'wuxia / stylized fantasy';
}

export function stripUnrequestedQualityBuzzwords(rawPrompt: string): string {
  const buzzwordRe =
    /^(?:masterpiece|best\s+quality|amazing\s+quality|very\s+aesthetic|absurdres|highres|ultra[\s-]*detailed|hyper[\s-]*detailed|extremely\s+detailed|8k(?:\s+uhd)?|4k(?:\s+uhd)?|award[\s-]*winning|cinematic\s+film\s+still|35mm\s+anamorphic\s+lens|shot\s+on\s+35mm|trending\s+on\s+artstation|clean\s+anime\s+lineart|2d\s+flat\s+color|flat\s+cel\s+shading)$/i;
  const segments = String(rawPrompt || '')
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter((s) => s && !buzzwordRe.test(s));
  return segments.join(', ');
}

export function mapAbstractTraitsToVisualCuesEn(rawText: string): string {
  const src = String(rawText || '').trim();
  if (!src) return '';
  const cues: string[] = [];
  const pushCue = (cue: string) => {
    if (!cues.includes(cue)) cues.push(cue);
  };
  if (/(?:bí\s*ẩn|mysterious|enigmatic|khó\s*đoán)/i.test(src)) {
    pushCue('sharp narrowed gaze, subtle smirk, composed commanding posture');
  }
  if (/(?:mưu\s*mô|nham\s*hiểm|tính\s*toán|xảo\s*quyệt|scheming|cunning)/i.test(src)) {
    pushCue('calculating narrowed eyes, slight knowing smirk, poised upright stance');
  }
  if (/(?:lạnh\s*lùng|băng\s*giá|lãnh\s*đạm|ít\s*nói|cold|stoic|aloof)/i.test(src)) {
    pushCue('stoic sharp gaze, defined brow, straight commanding posture');
  }
  if (/(?:trầm\s*ổn|khôn\s*ngoan|thâm\s*trầm|điềm\s*tĩnh|wise|calm|serene)/i.test(src)) {
    pushCue('calm steady gaze, clean brow structure, dignified composed bearing');
  }
  if (/(?:kiêu\s*ngạo|ngạo\s*mạn|cao\s*ngạo|arrogant|haughty|proud)/i.test(src)) {
    pushCue('raised chin, sharp half-lidded gaze, confident smirk, regal posture');
  }
  if (/(?:hung\s*dữ|tàn\s*nhẫn|sát\s*khí|nóng\s*nảy|fierce|ruthless|hostile)/i.test(src)) {
    pushCue('fierce furrowed brow, piercing glare, dynamic ready stance');
  }
  if (/(?:hiền\s*hòa|ôn\s*nhu|dịu\s*dàng|ấm\s*áp|gentle|warm|kind)/i.test(src)) {
    pushCue('expressive warm eyes, gentle confident smile, graceful poised shoulders');
  }
  if (/(?:tinh\s*nghịch|hoạt\s*bát|lém\s*lỉnh|playful|mischievous|cheerful)/i.test(src)) {
    pushCue('bright lively eyes, playful confident grin, dynamic angled posture');
  }
  if (/(?:u\s*sầu|buồn\s*bã|trầm\s*tư|melancholic|somber|wistful)/i.test(src)) {
    pushCue('deep pensive gaze, expressive quiet poise, slight three-quarter turn');
  }
  return cues.slice(0, 2).join(', ');
}

function buildCompactDanbooruHeadcountTag(
  context: StoryImagePromptContextResult,
): string {
  if (context.personCount <= 0) return 'no humans, scenery';
  const genders = context.lockedIdentities
    .slice(0, context.personCount)
    .map((id) => String(id.gender || '').toLowerCase());
  const boys = genders.filter((g) => /\b(?:man|male|boy|nam)\b/.test(g)).length;
  const girls = genders.filter((g) => /\b(?:woman|female|girl|nữ|nu)\b/.test(g)).length;
  if (context.personCount === 1) {
    if (girls === 1) return '1girl, solo';
    if (boys === 1) return '1boy, solo';
    if (/\b1\s+woman\b/i.test(context.headcountLock)) return '1girl, solo';
    if (/\b1\s+man\b/i.test(context.headcountLock)) return '1boy, solo';
    return '1person, solo';
  }
  const tags: string[] = [];
  if (boys === 1) tags.push('1boy');
  else if (boys > 1) tags.push(`${boys}boys`);
  if (girls === 1) tags.push('1girl');
  else if (girls > 1) tags.push(`${girls}girls`);
  if (tags.length > 0) return tags.join(', ');
  return `${context.personCount}people`;
}

/**
 * Compiles raw NPC profile data and current scene beat context into a single,
 * strict, comma-separated English visual prompt (Danbooru tag mode for latent.moe,
 * crisp grounded tag/phrase mode for external models). Fails gracefully to null on timeout/error.
 */
async function distillBeatPromptToConciseEnglish(options: {
  state: ArkState;
  position?: StoryImagePosition;
  context: StoryImagePromptContextResult;
  aiBeatPrompt?: string;
  referenceImageUrls?: string[];
  referenceCharacterLabels?: string[];
  comparisonPatch?: DerivedComparisonPromptPatch;
  comparisonMismatches?: string[];
  preferTagFormat?: boolean;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<string | null> {
  const {
    state,
    position,
    context,
    aiBeatPrompt,
    referenceImageUrls,
    referenceCharacterLabels,
    comparisonPatch,
    comparisonMismatches,
    preferTagFormat = false,
    signal,
    onLog,
  } = options;
  if (!state.config.proxyUrl?.trim()) return null;
  if (signal?.aborted) return null;

  const targetEngine: VisualPromptCompilerTarget = preferTagFormat
    ? 'latent.moe'
    : resolveVisualPromptCompilerTarget(state.config.imageProvider);
  const isLatentTarget = targetEngine === 'latent.moe';

  const refPhotos = (referenceImageUrls || [])
    .map((u) => String(u || '').trim())
    .filter(Boolean)
    .slice(0, 2);
  const hasRefPhotos = refPhotos.length > 0;

  const beatRole =
    position === 'opening'
      ? 'opening establishing shot (environment atmosphere; empty or at most 1 central figure as locked)'
      : position === 'middle'
        ? 'middle focal beat (exact expression, pose, action of locked character(s))'
        : position === 'ending'
          ? 'closing beat (closing framing, lingering expression or scene detail)'
          : 'single scene illustration';

  const hasActiveCmpFix = Boolean(
    comparisonPatch?.active && comparisonPatch.patchText,
  );

  const structuredNpcProfiles =
    context.personCount > 0 && context.lockedIdentities.length > 0
      ? context.lockedIdentities
          .slice(0, Math.max(1, context.personCount))
          .map((id) => {
            const eqGear = resolveCharacterEquippedGearForVisualPrompt(
              state,
              id.canonicalName,
            );
            const fields = [
              `name=${id.canonicalName}`,
              id.gender ? `gender=${id.gender}` : '',
              id.age ? `age=${id.age}` : '',
              id.role ? `role=${id.role}` : '',
              id.appearance ? `appearance=${id.appearance}` : '',
              id.identityLock?.hairstyle ? `hair=${id.identityLock.hairstyle}` : '',
              id.identityLock?.facialFeatures
                ? `face_marks=${id.identityLock.facialFeatures}`
                : '',
              id.identityLock?.fixedTags
                ? `fixed_marks=${id.identityLock.fixedTags}`
                : '',
              eqGear.outfitTextVi
                ? `equipped_outfit=${eqGear.outfitTextVi} (${eqGear.outfitTextEn})`
                : id.fashionStyle
                  ? `outfit=${id.fashionStyle}`
                  : '',
              !eqGear.outfitTextVi && id.identityLock?.signatureStyle
                ? `signature_outfit=${id.identityLock.signatureStyle}`
                : '',
              eqGear.weaponTextVi
                ? `equipped_weapon=${eqGear.weaponTextVi} (${eqGear.weaponTextEn})`
                : '',
              eqGear.accessoryTextVi
                ? `equipped_accessories=${eqGear.accessoryTextVi}`
                : '',
              id.signature ? `signature_props=${id.signature}` : '',
            ].filter(Boolean);
            return `- ${fields.join(' | ')}`;
          })
          .join('\n')
      : '';

  const danbooruHeadcount = buildCompactDanbooruHeadcountTag(context);

  const worldSettingLabel = resolveCompilerWorldSettingLabel(state);
  const isWuxiaOrXianxia = isWuxiaOrXianxiaWorldState(state);
  const authorizedSceneText = [
    ...context.lockedIdentities.flatMap((id) => {
      const eqGear = resolveCharacterEquippedGearForVisualPrompt(
        state,
        id.canonicalName,
      );
      return [
        id.appearance,
        id.fashionStyle,
        id.signature,
        id.role,
        eqGear.combinedRawVi,
        eqGear.combinedCleanEn,
      ];
    }),
    context.beatProseSlice,
    context.currentLocation,
  ]
    .filter(Boolean)
    .join(' ');

  const userPayload = [
    `TARGET ENGINE: ${targetEngine}`,
    `WORLD SETTING: ${worldSettingLabel}`,
    `SCENE BEAT: ${beatRole}`,
    isLatentTarget
      ? `LOCKED SUBJECT COUNT (MANDATORY): ${danbooruHeadcount} (${context.headcountLock})`
      : `LOCKED HEADCOUNT (MANDATORY): ${context.headcountLock}`,
    `LOCKED LIGHTING (MANDATORY — match exact time/space with clear key & rim lighting so face & details stay crisp and never muddy): ${context.visualLightingCue}`,
    `CURRENT LOCATION / SETTING: ${context.currentLocation}`,
    context.personCount > 0
      ? structuredNpcProfiles
        ? `RAW NPC / CHARACTER PROFILE & EQUIPPED GEAR DATA (GROUND EVERY TRAIT STRICTLY HERE — NEVER INVENT TATTOOS, SCARS, PIERCINGS, KIMONO, KATANA, OR UNOWNED WEAPONS; PRESERVE EXACT ANATOMICAL PLACEMENT & STRONG VISUAL PRESENCE):\n${structuredNpcProfiles}${context.lockedCharacterBriefs.length ? `\nIdentity anchors: ${context.lockedCharacterBriefs.join(' | ')}` : ''}`
        : context.lockedCharacterBriefs.length
          ? `LOCKED CHARACTER PROFILE: ${context.lockedCharacterBriefs.join(' | ')}`
          : 'Visible characters: NONE (no humans)'
      : 'Visible characters: NONE (empty scene, no humans)',
    hasRefPhotos
      ? `ATTACHED REFERENCE PHOTO(S) (${(referenceCharacterLabels || []).join(', ') || 'on-scene character'}): Verify facial likeness, age, hair, and visible marks from the photo(s); do NOT copy the photo background.`
      : '',
    hasActiveCmpFix
      ? `MANDATORY TARGETED CORRECTIONS (${comparisonPatch?.mode === 'light_refine' ? 'light polish only — keep matched traits intact' : 'fix previous mismatches without dropping fixed marks'}): ${comparisonPatch?.patchText}${comparisonMismatches?.length ? ` | Mismatches: ${comparisonMismatches.join('; ')}` : ''}`
      : '',
    aiBeatPrompt?.trim() ? `DRAFT BEAT BRIEF: ${aiBeatPrompt.trim()}` : '',
    context.beatProseSlice
      ? `CURRENT SCENE EXCERPT: ${trimToCleanSentence(context.beatProseSlice, 340)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callAiJsonOrTextDetailed(state, userPayload, {
    systemPrompt: buildStrictVisualPromptCompilerSystemPrompt({
      targetEngine,
      mode: 'scene',
      worldSetting: worldSettingLabel,
      hasReferencePhotos: hasRefPhotos,
      hasComparisonFixes: hasActiveCmpFix,
    }),
    ...(hasRefPhotos
      ? { imageDataUrls: refPhotos, requireVisionImages: true }
      : {}),
    taskSlot: 'referenceCheck',
    signal,
    timeoutMs: hasRefPhotos ? 20_000 : 12_000,
    maxTokens: 260,
    logPrefix: hasRefPhotos
      ? '[3D Visual Compiler · Vision]'
      : `[3D Visual Compiler · ${targetEngine}]`,
    onLog,
  });

  if (!res.ok || !res.text) {
    if (hasRefPhotos) {
      onLog?.(
        `[Đối chiếu ảnh mẫu · ${res.modelUsed || 'Vision'}] Không thể đối chiếu ảnh mẫu trước khi vẽ (${res.errorMessage || 'lỗi API'}) — tạm dùng prompt ghép chuẩn.`,
      );
    }
    return null;
  }
  if (hasRefPhotos) {
    onLog?.(
      `[Đối chiếu ảnh mẫu · ${res.modelUsed || 'Vision'}] Đã đối chiếu trực tiếp ${refPhotos.length} ảnh mẫu thật trước khi vẽ cảnh.`,
    );
  }
  let cleaned = sanitizeVisualPromptFragment(
    String(res.text ?? '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^(?:compiled\s*prompt|prompt|visual\s*prompt|image\s*prompt)\s*[:：\-]\s*/i, '')
      .replace(/\s*\n+\s*/g, ', ')
      .trim(),
  );
  if (isLatentTarget) {
    cleaned = stripUnrequestedQualityBuzzwords(cleaned);
  }
  cleaned = stripUnauthorizedBodyMarksAndCultureDriftEn({
    prompt: cleaned,
    authorizedText: authorizedSceneText,
    isWuxiaOrXianxia,
  });
  if (!cleaned || cleaned.length < 16 || containsVietnameseText(cleaned)) {
    return null;
  }

  const hasHeadcountAlready = isLatentTarget
    ? /\b(?:1boy|1girl|1person|1other|\d+boys|\d+girls|\d+people|solo|no\s+humans|empty\s+scene|no\s+people)\b/i.test(
        cleaned,
      )
    : /\b(?:no\s+extra\s+people|empty\s+scene,\s*no\s+people|no\s+people|1boy|1girl|no\s+humans)\b/i.test(
        cleaned,
      );
  const withHeadcount = hasHeadcountAlready
    ? cleaned
    : isLatentTarget
      ? `${danbooruHeadcount}, ${cleaned}`
      : `${context.headcountLock}, ${cleaned}`;
  const withStyleAnchor =
    isLatentTarget && !/\b(?:3d\s+donghua|stylized\s+3d|3d\s+render|3d\s+cg)\b/i.test(withHeadcount)
      ? `${withHeadcount}, 3d donghua style, stylized 3d`
      : withHeadcount;
  const withLighting = hasLightingTermsInPrompt(withStyleAnchor)
    ? withStyleAnchor
    : `${withStyleAnchor}, ${context.visualLightingCue}, clear key and rim lighting, high clarity`;
  const guardedCompiled = stripUnauthorizedBodyMarksAndCultureDriftEn({
    prompt: withLighting,
    authorizedText: authorizedSceneText,
    isWuxiaOrXianxia,
  });
  return hasActiveCmpFix && comparisonPatch
    ? enforceComparisonPatchOnPrompt(guardedCompiled, comparisonPatch.patchText)
    : guardedCompiled;
}

export async function generateStoryImage(options: {
  state: ArkState;
  turn?: Turn;
  storyImageConfig: StoryImageConfig;
  position?: StoryImagePosition;
  aiBeatPrompt?: string;
  existingBeatComparison?: ReferenceComparisonResult | null;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
  onCacheAvatarVisualLock?: (
    portraitId: string,
    visualLock: string,
    sourceSig: string,
    identityLock?: CharacterIdentityLock,
  ) => void;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  prompt: string;
  subjectLabel: string;
  position?: StoryImagePosition;
  appliedComparisonPatch?: string;
  error?: string;
  aborted?: boolean;
}> {
  const {
    state,
    turn,
    storyImageConfig: rawStoryImageConfig,
    position,
    aiBeatPrompt,
    existingBeatComparison,
    signal,
    onLog,
    onCacheAvatarVisualLock,
  } = options;
  const storyImageConfig = (rawStoryImageConfig || {}) as StoryImageConfig;
  let workingState = state;
  let built = buildStoryImagePrompt({
    state: workingState,
    turn,
    storyImageConfig,
    position,
    aiBeatPrompt,
    existingBeatComparison,
  });

  // Auto-extract & cache fixed visual identity from character's real-person reference photo (priority) or avatar image once per photo
  if (
    storyImageConfig.lockAvatarIdentity !== false &&
    built.personCount > 0 &&
    workingState?.config?.proxyUrl?.trim()
  ) {
    const updatedLocks = new Map<
      string,
      { lock: string; sig: string; identityLock?: CharacterIdentityLock }
    >();
    for (const idInfo of built.context.lockedIdentities.slice(0, 2)) {
      if (signal?.aborted) break;
      const anchorImg = idInfo.referenceImageData || idInfo.avatarImageData;
      if (!idInfo.portraitId || !anchorImg) continue;
      const curSig = computeAvatarSignature(anchorImg);
      const hasUsableLock = Boolean(
        composeCharacterIdentityLockPrompt(
          idInfo.identityLock,
          idInfo.avatarVisualLock,
        ),
      );
      if (hasUsableLock && idInfo.avatarLockSourceSig === curSig) {
        continue;
      }
      try {
        const knownAgeLabel = idInfo.ageNum
          ? idInfo.birthYear
            ? `${idInfo.ageNum} tuổi (sinh năm ${idInfo.birthYear})`
            : `${idInfo.ageNum} tuổi`
          : idInfo.age || undefined;
        const extracted = await extractCharacterIdentityLockFromImageWithAi({
          state: workingState,
          characterName: idInfo.canonicalName,
          imageData: anchorImg,
          isRealPhotoReference: Boolean(idInfo.referenceImageData),
          knownAgeLabel,
          knownAgeNum: idInfo.ageNum,
          existingProfileHints: [
            idInfo.gender,
            knownAgeLabel,
            idInfo.appearance,
            idInfo.fashionStyle,
          ]
            .filter(Boolean)
            .join(', '),
          signal,
          onLog,
        });
        if (extracted) {
          updatedLocks.set(idInfo.portraitId, {
            lock: extracted.visualLock,
            sig: curSig,
            identityLock: extracted.identityLock,
          });
          onCacheAvatarVisualLock?.(
            idInfo.portraitId,
            extracted.visualLock,
            curSig,
            extracted.identityLock,
          );
        }
      } catch {
        // Silently skip vision extraction if proxy lacks vision support
      }
    }
    if (signal?.aborted) {
      return {
        ok: false,
        prompt: built.prompt,
        subjectLabel: built.subjectLabel,
        position,
        aborted: true,
      };
    }
    if (updatedLocks.size > 0 && workingState.portraitBank?.portraits) {
      workingState = {
        ...workingState,
        portraitBank: {
          ...workingState.portraitBank,
          portraits: workingState.portraitBank.portraits.map((p) => {
            const hit = updatedLocks.get(p.id);
            if (!hit) return p;
            const mergedLock = mergeCharacterIdentityLock(
              p.identityLock,
              hit.identityLock,
              false,
            );
            return {
              ...p,
              identityLock: mergedLock,
              avatarVisualLock: hit.lock,
              avatarLockSourceSig: hit.sig,
            };
          }),
        },
      };
      built = buildStoryImagePrompt({
        state: workingState,
        turn,
        storyImageConfig,
        position,
        aiBeatPrompt,
        existingBeatComparison,
      });
    }
  }

  let prompt = built.prompt;
  const subjectLabel = built.subjectLabel;
  const activeComparisonPatch = built.comparisonPatch.active
    ? built.comparisonPatch.patchText
    : undefined;

  if (activeComparisonPatch) {
    onLog?.(
      `[Đối chiếu → Prompt Cảnh] Đang nạp chỉnh sửa từ ${built.comparisonSourceLabel || 'kết quả đối chiếu'}: ${activeComparisonPatch}`,
    );
  }

  // Collect real-person reference photo(s) for visible characters so AI Vision can cross-check
  // and write the exact prompt BEFORE drawing begins.
  const refTargets =
    storyImageConfig.lockAvatarIdentity !== false && built.personCount > 0
      ? built.context.lockedIdentities
          .filter((id) => Boolean(id.referenceImageData?.trim()))
          .slice(0, 2)
      : [];
  const referenceImageUrls = refTargets
    .map((id) => id.referenceImageData || '')
    .filter(Boolean);
  const referenceCharacterLabels = refTargets.map((id) => id.canonicalName);

  const isLatentStoryProvider = workingState.config.imageProvider === 'latent';
  const needsReferencePhotoCrossCheck = referenceImageUrls.length > 0;
  const needsVietnameseDistill =
    !built.context.isAiPromptCleanEnglish && containsVietnameseText(prompt);

  if (
    !built.hasCustomTemplate &&
    workingState.config.proxyUrl?.trim() &&
    (needsReferencePhotoCrossCheck ||
      needsVietnameseDistill ||
      isLatentStoryProvider)
  ) {
    try {
      const distilledEn = await distillBeatPromptToConciseEnglish({
        state: workingState,
        position,
        context: built.context,
        aiBeatPrompt,
        referenceImageUrls: needsReferencePhotoCrossCheck
          ? referenceImageUrls
          : undefined,
        referenceCharacterLabels: needsReferencePhotoCrossCheck
          ? referenceCharacterLabels
          : undefined,
        comparisonPatch: built.comparisonPatch,
        comparisonMismatches: built.comparisonMismatches,
        preferTagFormat: isLatentStoryProvider,
        signal,
        onLog,
      });
      if (signal?.aborted) {
        return { ok: false, prompt, subjectLabel, position, aborted: true };
      }
      if (distilledEn) {
        if (isLatentStoryProvider) {
          // Keep compact Danbooru-style compiled tags clean for latent.moe without injecting prose style paragraphs
          const latentCompiled = sanitizeVisualPromptFragment(
            stripUnrequestedQualityBuzzwords(
              activeComparisonPatch
                ? enforceComparisonPatchOnPrompt(
                    distilledEn,
                    activeComparisonPatch,
                  )
                : distilledEn,
            ),
          );
          prompt = /\bno\s+text\b/i.test(latentCompiled)
            ? latentCompiled
            : `${latentCompiled}, no text, no watermark`;
        } else {
          const styleObj = resolveStoryImageStyle(
            storyImageConfig.stylePreset,
            storyImageConfig.customStyles,
          );
          const styledDistilled = applyImageStyleVariables(
            distilledEn,
            styleObj,
            storyImageConfig.customStyles,
            storyImageConfig.cameraAngle,
          );
          // Anti-overwrite guard: never allow style/LLM distillation to drop comparison fixes!
          prompt = appendNoTextVisualConstraint(
            sanitizeVisualPromptFragment(
              activeComparisonPatch
                ? enforceComparisonPatchOnPrompt(
                    styledDistilled,
                    activeComparisonPatch,
                  )
                : styledDistilled,
            ),
          );
        }
      }
    } catch {
      // Fall back cleanly to the deterministic prompt (which already contains comparisonPatch)
    }
  }

  // Final grounding & anti-overwrite guard on story beat prompt before sending to image generator
  if (!built.hasCustomTemplate) {
    const storyAuthorizedText = [
      ...built.context.lockedIdentities.flatMap((id) => {
        const eqGear = resolveCharacterEquippedGearForVisualPrompt(
          workingState,
          id.canonicalName,
        );
        return [
          id.appearance,
          id.fashionStyle,
          id.signature,
          id.role,
          eqGear.combinedRawVi,
          eqGear.combinedCleanEn,
        ];
      }),
      built.context.beatProseSlice,
      built.context.currentLocation,
    ]
      .filter(Boolean)
      .join(' ');
    prompt = stripUnauthorizedBodyMarksAndCultureDriftEn({
      prompt,
      authorizedText: storyAuthorizedText,
      isWuxiaOrXianxia: isWuxiaOrXianxiaWorldState(workingState),
    });
  }
  if (activeComparisonPatch) {
    const guarded = sanitizeVisualPromptFragment(
      enforceComparisonPatchOnPrompt(prompt, activeComparisonPatch),
    );
    prompt = isLatentStoryProvider
      ? /\bno\s+text\b/i.test(guarded)
        ? guarded
        : `${guarded}, no text, no watermark`
      : appendNoTextVisualConstraint(guarded);
  }

  const sdSize =
    (
      storyImageConfig.size ||
      (state.config.imageProvider === 'latent'
        ? state.config.latentSize
        : '') ||
      state.config.seedreamSize ||
      ''
    ).trim() ||
    (state.config.imageProvider === 'latent'
      ? DEFAULT_LATENT_SIZE
      : '1024x1024');

  const posTag = position
    ? ` · ${STORY_IMAGE_POSITION_META[position].shortLabel}`
    : '';

  const isWuxiaOrXianxiaStory = isWuxiaOrXianxiaWorldState(state);
  const isSceneryOnlyStory = built.personCount <= 0;
  const storyGenders = (built.context?.lockedIdentities || [])
    .slice(0, Math.max(0, built.personCount))
    .map((id) => String(id.gender || '').toLowerCase());
  const storyHasMale = storyGenders.some((g) =>
    /\b(?:man|male|boy|nam)\b/.test(g),
  );
  const storyHasFemale = storyGenders.some((g) =>
    /\b(?:woman|female|girl|nữ|nu)\b/.test(g),
  );
  const storyPromptGender: 'male' | 'female' | 'mixed' | 'neutral' =
    isSceneryOnlyStory
      ? 'neutral'
      : storyHasMale && storyHasFemale
        ? 'mixed'
        : storyHasMale
          ? 'male'
          : storyHasFemale
            ? 'female'
            : inferPromptGenderKind(prompt);

  if (state.config.imageProvider === 'comfyui') {
    const comfyBase = (state.config.comfyuiUrl || '').trim();
    const activeWf =
      state.config.activeComfyuiWorkflowId &&
      Array.isArray(state.config.comfyuiWorkflows)
        ? state.config.comfyuiWorkflows.find(
            (wf) => wf.id === state.config.activeComfyuiWorkflowId,
          )
        : undefined;
    const comfyWorkflow = (
      state.config.comfyuiWorkflowJson ||
      activeWf?.workflowJson ||
      ''
    ).trim();
    const comfyNegativePrompt = mergeStoryImageNegativePrompt(
      state.config.comfyuiNegativePrompt || activeWf?.negativePrompt || '',
      built.headcountNegative,
    );
    const comfyNodeMapping =
      state.config.comfyuiNodeMapping &&
      Object.keys(state.config.comfyuiNodeMapping).length > 0
        ? state.config.comfyuiNodeMapping
        : activeWf?.nodeMapping;
    if (!comfyBase || !comfyWorkflow) {
      return {
        ok: false,
        prompt,
        subjectLabel,
        position,
        error:
          'Chưa cấu hình đầy đủ ComfyUI Base URL và Workflow API JSON trong tab Cấu hình.',
      };
    }

    const comfyFinalPrompt = appendWuxiaXianxiaDonghuaPromptTags(prompt, {
      state,
      isWuxiaOrXianxia: isWuxiaOrXianxiaStory,
      isSceneryOnly: isSceneryOnlyStory,
      gender: storyPromptGender,
      provider: 'comfyui',
    });
    onLog?.(
      `Đang sinh ảnh truyện [${subjectLabel}] qua ComfyUI${
        activeWf ? ` (${activeWf.name})` : ''
      }...`,
    );
    const comfyRes = await requestComfyUiImage({
      baseUrlRaw: comfyBase,
      workflowJson: comfyWorkflow,
      prompt: comfyFinalPrompt,
      negativePrompt: comfyNegativePrompt,
      size: sdSize,
      nodeMapping: comfyNodeMapping,
      signal,
      timeoutMs: COMFYUI_REQUEST_TIMEOUT_MS,
      logPrefix: `[ComfyUI · Ảnh truyện${posTag}]`,
      onLog,
    });

    if (comfyRes.aborted) {
      return {
        ok: false,
        prompt: comfyFinalPrompt,
        subjectLabel,
        position,
        aborted: true,
      };
    }
    if (!comfyRes.ok || !comfyRes.imageUrl) {
      return {
        ok: false,
        prompt: comfyFinalPrompt,
        subjectLabel,
        position,
        error:
          comfyRes.error ||
          'Không thể sinh ảnh từ ComfyUI. Hãy kiểm tra Base URL và Workflow API JSON trong Cấu hình.',
      };
    }

    onLog?.(`Sinh ảnh truyện [${subjectLabel}] qua ComfyUI thành công.`);
    return {
      ok: true,
      imageUrl: comfyRes.imageUrl,
      prompt: comfyFinalPrompt,
      subjectLabel,
      position,
      ...(activeComparisonPatch
        ? { appliedComparisonPatch: activeComparisonPatch }
        : {}),
    };
  }

  if (state.config.imageProvider === 'custom') {
    const customUrl = (state.config.customImageUrl || '').trim();
    if (!customUrl) {
      return {
        ok: false,
        prompt,
        subjectLabel,
        position,
        error:
          'Chưa cấu hình Custom Image Endpoint URL. Hãy vào tab Cấu hình để nhập Endpoint tạo ảnh.',
      };
    }
    const beatSafety = sanitizeImagePromptForApiSafety(prompt);
    const safeBeatPrompt = appendWuxiaXianxiaDonghuaPromptTags(
      beatSafety.prompt || prompt,
      {
        state,
        isWuxiaOrXianxia: isWuxiaOrXianxiaStory,
        isSceneryOnly: isSceneryOnlyStory,
        gender: storyPromptGender,
        provider: 'custom',
      },
    );
    if (beatSafety.changed) {
      onLog?.(
        `[Ảnh truyện · An toàn bộ lọc] Đã chuyển mềm từ dễ bị máy chủ ảnh chặn/treo (${beatSafety.neutralizedTerms.join(', ')}) sang từ editorial an toàn.`,
      );
    }
    const customModel = (state.config.customImageModel || '').trim();
    onLog?.(
      `Đang sinh ảnh truyện [${subjectLabel}] qua Custom Image API${
        customModel ? ` (${customModel})` : ''
      }...`,
    );
    const customRes = await requestCustomImage({
      endpointRaw: customUrl,
      apiKey: state.config.customImageApiKey || '',
      authHeader: state.config.customImageAuthHeader || 'Authorization',
      model: customModel,
      formatMode: state.config.customImageFormatMode || 'openai',
      jsonTemplate:
        state.config.customImageJsonTemplate || DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE,
      prompt: safeBeatPrompt,
      negativePrompt: mergeStoryImageNegativePrompt(
        state.config.customImageNegativePrompt || '',
        built.headcountNegative,
      ),
      size: sdSize,
      signal,
      timeoutMs: CUSTOM_IMAGE_REQUEST_TIMEOUT_MS,
      useServerProxy: state.config.customImageUseServerProxy !== false,
      logPrefix: `[Custom Image API · Ảnh truyện${posTag}]`,
      onLog,
    });

    if (customRes.aborted) {
      return {
        ok: false,
        prompt: safeBeatPrompt,
        subjectLabel,
        position,
        aborted: true,
      };
    }
    if (!customRes.ok || !customRes.imageUrl) {
      return {
        ok: false,
        prompt: safeBeatPrompt,
        subjectLabel,
        position,
        error:
          customRes.error ||
          'Không thể sinh ảnh từ Custom Image Endpoint. Hãy kiểm tra URL, API Key và Payload trong Cấu hình.',
      };
    }

    onLog?.(
      `Sinh ảnh truyện [${subjectLabel}] qua Custom Image API thành công từ ${
        customRes.usedUrl || customUrl
      }`,
    );
    return {
      ok: true,
      imageUrl: customRes.imageUrl,
      prompt: safeBeatPrompt,
      subjectLabel,
      position,
      ...(activeComparisonPatch
        ? { appliedComparisonPatch: activeComparisonPatch }
        : {}),
    };
  }

  if (state.config.imageProvider === 'latent') {
    const latentKey = (state.config.latentApiKey || '').trim();
    if (!latentKey) {
      return {
        ok: false,
        prompt,
        subjectLabel,
        position,
        error:
          'Chưa nhập Latent API Key (lat_sk_...). Hãy vào tab Cấu hình → Họa Đồ AI · Latent.moe để nhập Key.',
      };
    }
    const beatSafety = sanitizeImagePromptForApiSafety(prompt);
    const safeBeatPrompt = appendWuxiaXianxiaDonghuaPromptTags(
      beatSafety.prompt || prompt,
      {
        state,
        isWuxiaOrXianxia: isWuxiaOrXianxiaStory,
        isSceneryOnly: isSceneryOnlyStory,
        gender: storyPromptGender,
        provider: 'latent',
      },
    );
    const latentModel =
      (state.config.latentModel || '').trim() || DEFAULT_LATENT_MODEL;
    onLog?.(
      `Đang sinh ảnh truyện [${subjectLabel}] qua Họa Đồ AI · Latent.moe (${latentModel} · ${sdSize})...`,
    );
    const latentRes = await requestLatentImage({
      endpointRaw: state.config.latentUrl || DEFAULT_LATENT_ENDPOINT,
      apiKey: latentKey,
      model: latentModel,
      prompt: safeBeatPrompt,
      positivePrefix:
        state.config.latentPositivePrefix ?? DEFAULT_LATENT_POSITIVE_PREFIX,
      negativePrompt:
        state.config.latentNegativePrompt ?? DEFAULT_LATENT_NEGATIVE_PROMPT,
      extraNegativePrompt: built.headcountNegative,
      size: sdSize,
      steps: state.config.latentSteps,
      scale: state.config.latentScale,
      sampler: state.config.latentSampler,
      noiseSchedule: state.config.latentNoiseSchedule,
      ucPreset: state.config.latentUcPreset,
      qualityToggle: state.config.latentQualityToggle,
      signal,
      timeoutMs: LATENT_REQUEST_TIMEOUT_MS,
      useServerProxy: state.config.latentUseServerProxy === true,
      logPrefix: `[Latent.moe · Ảnh truyện${posTag}]`,
      onLog,
    });

    if (latentRes.aborted) {
      return {
        ok: false,
        prompt: safeBeatPrompt,
        subjectLabel,
        position,
        aborted: true,
      };
    }
    if (!latentRes.ok || !latentRes.imageUrl) {
      return {
        ok: false,
        prompt: safeBeatPrompt,
        subjectLabel,
        position,
        error:
          latentRes.error ||
          'Không thể sinh ảnh từ Latent.moe. Hãy kiểm tra Latent API Key, model và kết nối.',
      };
    }

    onLog?.(
      `Sinh ảnh truyện [${subjectLabel}] qua Latent.moe thành công${
        latentRes.entryName ? ` (${latentRes.entryName})` : ''
      }.`,
    );
    return {
      ok: true,
      imageUrl: latentRes.imageUrl,
      prompt: safeBeatPrompt,
      subjectLabel,
      position,
      ...(activeComparisonPatch
        ? { appliedComparisonPatch: activeComparisonPatch }
        : {}),
    };
  }

  const dedicatedSeedreamUrl = (state.config.seedreamUrl || '').trim();
  const endpointRaw = (
    dedicatedSeedreamUrl ||
    state.config.proxyUrl ||
    ''
  ).trim();
  const usingProxyFallback = !dedicatedSeedreamUrl && Boolean(endpointRaw);
  const apiKey = (
    state.config.seedreamApiKey ||
    state.config.proxyKey ||
    ''
  ).trim();
  const sdModel = (state.config.seedreamModel || '').trim() || 'seedream-5.0-pro';

  if (!endpointRaw) {
    return {
      ok: false,
      prompt,
      subjectLabel,
      position,
      error:
        'Chưa cấu hình Seedream 5 Pro Endpoint. Hãy vào tab Cấu hình để nhập Endpoint tạo ảnh.',
    };
  }

  const beatSafety = sanitizeImagePromptForApiSafety(prompt);
  const safeBeatPrompt = appendWuxiaXianxiaDonghuaPromptTags(
    beatSafety.prompt || prompt,
    {
      state,
      isWuxiaOrXianxia: isWuxiaOrXianxiaStory,
      isSceneryOnly: isSceneryOnlyStory,
      gender: storyPromptGender,
      provider: 'seedream',
    },
  );
  if (beatSafety.changed) {
    onLog?.(
      `[Ảnh truyện · An toàn bộ lọc] Đã chuyển mềm từ dễ bị máy chủ ảnh chặn/treo (${beatSafety.neutralizedTerms.join(', ')}) sang từ editorial an toàn.`,
    );
  }
  onLog?.(`Đang sinh ảnh truyện [${subjectLabel}] với model ${sdModel}...`);
  const reqRes = await requestSeedreamImage({
    endpointRaw,
    apiKey,
    model: sdModel,
    prompt: safeBeatPrompt,
    size: sdSize,
    signal,
    timeoutMs: SEEDREAM_REQUEST_TIMEOUT_MS,
    usingProxyFallback,
    useServerProxy: shouldUseServerProxy(state.config),
    onLog,
  });

  if (reqRes.aborted) {
    return { ok: false, prompt, subjectLabel, position, aborted: true };
  }
  if (!reqRes.ok || !reqRes.imageUrl) {
    return {
      ok: false,
      prompt,
      subjectLabel,
      position,
      error:
        reqRes.error ||
        'Không thể sinh ảnh từ Seedream 5 Pro. Hãy kiểm tra Endpoint và API Key trong Cấu hình.',
    };
  }

  onLog?.(
    `Sinh ảnh truyện [${subjectLabel}] thành công từ ${reqRes.usedUrl || endpointRaw}`,
  );
  return {
    ok: true,
    imageUrl: reqRes.imageUrl,
    prompt,
    subjectLabel,
    position,
    ...(activeComparisonPatch
      ? { appliedComparisonPatch: activeComparisonPatch }
      : {}),
  };
}

export interface DetectedPortraitCandidate {
  name: string;
  isMc: boolean;
  role: string;
  age?: string;
  birthday?: string;
  fashionStyle?: string;
  appearance: string;
  personality?: string;
  relationships?: string;
  signature?: string;
  npcId?: string;
  contextSnippet: string;
}

const SHARED_FAMILY_SURNAMES_FOR_SNIPPET = new Set([
  'nguyen',
  'tran',
  'le',
  'pham',
  'hoang',
  'huynh',
  'phan',
  'vu',
  'vo',
  'dang',
  'bui',
  'do',
  'ho',
  'ngo',
  'duong',
  'ly',
  'dinh',
  'trinh',
  'doan',
  'truong',
  'luong',
  'cao',
  'ta',
  'dao',
  'mai',
  'luu',
  'phung',
  'vuong',
  'nghiem',
  'trieu',
  'ton',
  'kim',
  'lee',
  'park',
  'choi',
  'jung',
  'jeong',
  'kang',
  'jang',
  'han',
  'yoo',
  'yu',
  'lim',
  'shin',
  'song',
  'cho',
  'seo',
  'kwon',
  'hwang',
  'ahn',
  'baek',
  'jenner',
  'kardashian',
  'hadid',
  'bieber',
  'swift',
  'smith',
  'johnson',
  'brown',
  'williams',
  'jones',
  'miller',
  'davis',
]);

export interface CharacterPoseProfileHints {
  role?: string;
  personality?: string;
  signature?: string;
  appearance?: string;
  isMc?: boolean;
  allowProfileFallback?: boolean;
}

export function extractCharacterContextSnippet(
  rawText: string,
  charName: string,
  alternateName?: string,
  maxLen = 180,
  profileHints?: CharacterPoseProfileHints,
): string {
  const trimmedInput = String(rawText || '').trim();
  if (trimmedInput && isSoloPoseExpressionSnippet(trimmedInput)) {
    return trimmedInput.slice(0, maxLen);
  }
  const baseClean = String(stripStoryPlanningAndMeta(trimmedInput) ?? '')
    .replace(/\r/g, '')
    .trim();
  if (!baseClean) return '';
  // Strictly strip simulated chat-group / messaging blocks so NPC snippets never describe 'nhóm chat'
  const cleanText = stripNonSceneChatBlocks(baseClean).trim();
  if (!cleanText) return '';

  const primaryClean = String(charName || '').trim();
  const altClean = String(alternateName || '').trim();
  if (!primaryClean && !altClean) return '';

  const fullTerms: string[] = [];
  const shortGivenTerms: string[] = [];
  const pushUnique = (arr: string[], raw: string) => {
    const k = normalizeCharacterKey(raw);
    if (k && k.length >= 2 && !arr.includes(k)) arr.push(k);
  };

  const addIdentityForName = (raw?: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return;
    const idObj = collectCharacterIdentityKeys(trimmed);
    for (const ak of idObj.aliasKeys) {
      if (ak.includes(' ')) {
        pushUnique(fullTerms, ak);
      } else if (
        ak.length >= 3 &&
        !SHARED_FAMILY_SURNAMES_FOR_SNIPPET.has(ak)
      ) {
        pushUnique(shortGivenTerms, ak);
      }
    }
    const celeb = lookupKnownCelebrityProfile(trimmed);
    if (celeb) {
      pushUnique(fullTerms, celeb.canonicalName);
      for (const a of celeb.aliases || []) {
        const ak = normalizeCharacterKey(a);
        if (ak.includes(' ')) pushUnique(fullTerms, ak);
        else if (ak.length >= 3 && !SHARED_FAMILY_SURNAMES_FOR_SNIPPET.has(ak)) {
          pushUnique(shortGivenTerms, ak);
        }
      }
    }
    const toks = normalizeCharacterKey(trimmed).split(/\s+/).filter(Boolean);
    if (toks.length >= 2) {
      // Vietnamese/Western given name is usually last token (or first token for Western celebrity like "Kendall Jenner")
      const lastTok = toks[toks.length - 1];
      if (lastTok.length >= 3 && !SHARED_FAMILY_SURNAMES_FOR_SNIPPET.has(lastTok)) {
        pushUnique(shortGivenTerms, lastTok);
      }
      const firstTok = toks[0];
      if (
        firstTok.length >= 4 &&
        !SHARED_FAMILY_SURNAMES_FOR_SNIPPET.has(firstTok)
      ) {
        pushUnique(shortGivenTerms, firstTok);
      }
    }
  };

  addIdentityForName(primaryClean);
  addIdentityForName(altClean);

  if (!fullTerms.length && !shortGivenTerms.length) {
    return '';
  }

  const segments = cleanText
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => String(s ?? '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 4);

  const testWordMatch = (segNorm: string, term: string): number => {
    const escaped = String(term ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).exec(segNorm);
    return m ? m.index : -1;
  };

  const scoreSegmentForChar = (seg: string): number => {
    const exactPrimary = primaryClean
      ? findExactProperNameInText(seg, primaryClean, {
          allowHonorificShortName: true,
        })
      : { count: 0, firstIndex: -1 };
    const exactAlt =
      altClean && altClean !== primaryClean
        ? findExactProperNameInText(seg, altClean, {
            allowHonorificShortName: true,
          })
        : { count: 0, firstIndex: -1 };

    const segNorm = normalizeCharacterKey(seg);
    let score = 0;
    let earliestIdx = 999999;

    if (exactPrimary.count > 0 || exactAlt.count > 0) {
      score += 12;
      if (exactPrimary.firstIndex >= 0) {
        earliestIdx = Math.min(earliestIdx, exactPrimary.firstIndex);
      }
      if (exactAlt.firstIndex >= 0) {
        earliestIdx = Math.min(earliestIdx, exactAlt.firstIndex);
      }
    }

    for (const term of fullTerms) {
      const idx = testWordMatch(segNorm, term);
      if (idx >= 0) {
        score = Math.max(score, 10);
        earliestIdx = Math.min(earliestIdx, idx);
      }
    }

    if (score === 0) {
      for (const term of shortGivenTerms) {
        const idx = testWordMatch(segNorm, term);
        if (idx >= 0) {
          // For single-token short given names, prefer capitalized proper-noun occurrence in original text
          const origEsc = String(term ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const hasCapOrHonorific =
            exactPrimary.count > 0 ||
            exactAlt.count > 0 ||
            new RegExp(`(?:^|[^\\p{L}])[\\p{Lu}]`, 'u').test(
              seg.slice(Math.max(0, idx - 1), idx + term.length + 2),
            ) ||
            new RegExp(`(?:^|[^a-z0-9])(?:anh|chi|co|cau|em|ong|ba|nang|han|ga)\\s+${origEsc}(?:$|[^a-z0-9])`, 'i').test(segNorm);
          if (hasCapOrHonorific) {
            score = Math.max(score, 6);
            earliestIdx = Math.min(earliestIdx, idx);
          }
        }
      }
    }

    if (score <= 0) return 0;

    // Prefer sentences where this character is the subject/speaker near the beginning of the sentence
    if (earliestIdx <= 24) score += 4;
    else if (earliestIdx <= 60) score += 2;

    // Slightly penalize lines that are purely quoted dialogue where someone else might only be mentioning this name
    if (/^[“"«—–-]/.test(seg) && earliestIdx > 16) {
      score -= 3;
    }

    return Math.max(1, score);
  };

  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < segments.length; i++) {
    const sc = scoreSegmentForChar(segments[i]);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  }

  // CRITICAL: Never fall back to unrelated opening prose of the turn — return '' if this character is not referenced!
  if (bestIdx < 0 || bestScore <= 0) {
    return '';
  }

  const cur = segments[bestIdx];
  const pieces: string[] = [];
  const curLooksLikeDialogue = /^[“"«—–-]/.test(cur);
  const prev = bestIdx > 0 ? segments[bestIdx - 1] : '';
  const next = bestIdx + 1 < segments.length ? segments[bestIdx + 1] : '';

  // Only include prev if cur is quoted dialogue and prev is a short speaker setup mentioning this character
  if (
    curLooksLikeDialogue &&
    prev &&
    prev.length <= 130 &&
    /[:：]$/.test(prev) &&
    scoreSegmentForChar(prev) > 0
  ) {
    pieces.push(prev);
  }
  pieces.push(cur);

  // Only include next if it directly continues THIS character's dialogue or also references THIS character
  const curSetsUpDialogue =
    cur.endsWith(':') ||
    cur.endsWith('：') ||
    /(?:nói|đáp|hỏi|cười|thì\s+thầm|nhắc|khẽ\s+nói|trêu|bảo|lên\s+tiếng)[,.]?\s*$/i.test(
      cur,
    );
  const nextContinuesSameChar =
    Boolean(next) &&
    ((curSetsUpDialogue && /^[“"«—–-]/.test(next)) ||
      scoreSegmentForChar(next) > 0);

  if (nextContinuesSameChar) {
    const joined = `${pieces.join(' ')} ${next}`;
    if (joined.length <= maxLen + 60) {
      pieces.push(next);
    }
  }

  const isolatedProse = pieces.join(' ');
  const soloPoseExpr = extractSoloPoseAndExpression(
    isolatedProse,
    primaryClean || altClean,
    {
      alternateName: altClean || undefined,
      role: profileHints?.role,
      personality: profileHints?.personality,
      signature: profileHints?.signature,
      appearance: profileHints?.appearance,
      isMc: profileHints?.isMc,
      allowProfileFallback: profileHints?.allowProfileFallback ?? false,
    },
  );
  if (!soloPoseExpr) return '';
  return soloPoseExpr.length <= maxLen
    ? soloPoseExpr
    : trimToCleanSentence(soloPoseExpr, maxLen);
}

/**
 * Finds the most recent valid, character-specific solo pose & expression across story turns
 * (checking preferredTurnIndex first, then scanning backwards through recent turns).
 * Returns '' if no turn directly mentions the character — never steals another character's scene.
 */
export function extractBestCharacterContextFromTurns(
  turns: Turn[],
  charName: string,
  preferredTurnIndex?: number,
  alternateName?: string,
  maxLen = 180,
  profileHints?: CharacterPoseProfileHints,
): string {
  if (!Array.isArray(turns) || !turns.length || !charName?.trim()) return '';
  const orderedIndices: number[] = [];
  if (
    typeof preferredTurnIndex === 'number' &&
    preferredTurnIndex >= 0 &&
    preferredTurnIndex < turns.length
  ) {
    orderedIndices.push(preferredTurnIndex);
  }
  const minIdx = Math.max(0, turns.length - 16);
  for (let i = turns.length - 1; i >= minIdx; i--) {
    if (!orderedIndices.includes(i)) orderedIndices.push(i);
  }

  for (const idx of orderedIndices) {
    const t = turns[idx];
    if (!t) continue;
    const prose = stripStoryPlanningAndMeta(t.assistant || t.user || '');
    if (!prose) continue;
    const hit = extractCharacterContextSnippet(
      prose,
      charName,
      alternateName,
      maxLen,
      { ...profileHints, allowProfileFallback: false },
    );
    if (hit && isSoloPoseExpressionSnippet(hit)) {
      return hit;
    }
  }
  return '';
}

export function detectCharactersInTurnForPortraits(
  turn: Turn | undefined,
  state: ArkState,
  options?: { strictNewNpcGate?: boolean },
): DetectedPortraitCandidate[] {
  if (!turn) return [];

  const strictNewNpcGate = options?.strictNewNpcGate !== false;

  // Strictly strip all thinking/planning/outline/meta noise before scanning
  const cleanAssistant = stripStoryPlanningAndMeta(turn.assistant || '');
  const cleanUser = stripStoryPlanningAndMeta(turn.user || '');
  const combinedClean = [cleanAssistant, cleanUser].filter(Boolean).join('\n');
  if (!combinedClean.trim()) return [];

  const activeComp = getStoryBoundCompanionFromState(state);
  const allowedKnownKeys = buildAllowedRosterKeys(activeComp, state.player?.name);
  const cultivationBlockedKeys = buildCultivationNonNpcKeys(
    state.memory?.cultivation,
  );
  const existingPortraits = (state.portraitBank?.portraits || []).filter(
    (p) => !isInvalidNpcPortrait(p, allowedKnownKeys, cultivationBlockedKeys),
  );
  const npcs = activeComp?.npcs || [];
  const mcName = (activeComp?.mc?.name || state.player?.name || '').trim();
  const mcKey = normalizeCharacterKey(mcName);
  const mcPresent = isMcPresentInTurn(
    cleanAssistant,
    cleanUser,
    mcName,
    activeComp?.mc?.pronoun,
  );

  // Scan primarily on actual story prose (cleanAssistant), falling back to cleanUser only if assistant is empty,
  // with simulated group-chat / messaging blocks stripped so chat-only members never auto-spawn as NPCs.
  const proseForDetection = cleanAssistant || cleanUser;
  const sceneOnlyProse = stripNonSceneChatBlocks(proseForDetection);
  if (!sceneOnlyProse.trim()) return [];

  const extractedNames = extractPresentCharactersFromScene(
    sceneOnlyProse,
    state,
  );

  // Build teasing/parody alias resolution map from full turn (user + assistant)
  const teasingPairsForTurn = extractTeasingNicknamePairsFromText(combinedClean);
  const teasingMapForTurn = new Map<string, string>();
  const standaloneTeasingForTurn = new Set<string>();
  for (const pair of teasingPairsForTurn) {
    const nk = normalizeCharacterKey(pair.nickname);
    if (!nk) continue;
    if (pair.canonical) {
      teasingMapForTurn.set(nk, pair.canonical);
    } else {
      standaloneTeasingForTurn.add(nk);
    }
  }
  const canonicalPoolForTurn = Array.from(
    new Set(
      [
        mcName,
        ...npcs.map((n) => n.name),
        ...existingPortraits.map((p) => p.name),
        ...findKnownCelebritiesInText(sceneOnlyProse).map((c) => c.displayName),
      ].filter(
        (n) =>
          Boolean(n) &&
          !isShortCodeOrBracketedJunkName(n) &&
          !isNonPersonCultivationOrWorldTerm(n, cultivationBlockedKeys),
      ),
    ),
  ).sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);

  const orderedNames: string[] = [];
  const seenIdentityKeys = new Set<string>();

  const pushName = (rawName: string) => {
    const rawTrim = String(rawName || '').trim();
    if (!rawTrim || isShortCodeOrBracketedJunkName(rawTrim)) return;
    const rawKey = normalizeCharacterKey(rawTrim);
    if (!rawKey) return;

    let resolvedInput = rawTrim;
    if (teasingMapForTurn.has(rawKey)) {
      resolvedInput = teasingMapForTurn.get(rawKey)!;
    } else if (standaloneTeasingForTurn.has(rawKey)) {
      return;
    } else {
      const variantMatch = findCanonicalVariantMatch(rawTrim, [
        ...canonicalPoolForTurn,
        ...orderedNames,
      ]);
      if (variantMatch) {
        resolvedInput = variantMatch;
      } else if (isPlayfulTeasingOrParodyName(rawTrim, allowedKnownKeys)) {
        return;
      }
    }

    if (
      isShortCodeOrBracketedJunkName(resolvedInput) ||
      isNonPersonCultivationOrWorldTerm(resolvedInput, cultivationBlockedKeys)
    ) {
      return;
    }

    const cleaned = sanitizeCharacterName(
      resolvedInput,
      allowedKnownKeys,
      cultivationBlockedKeys,
    );
    if (!cleaned) return;
    const key = normalizeCharacterKey(cleaned);
    if (!key || cleaned.length < 2) return;
    // Never include MC when MC is absent or unmentioned in the turn
    if (!mcPresent && ((mcKey && key === mcKey) || key === 'nhan vat chinh' || key === 'nvc')) {
      return;
    }
    if (isCharacterExplicitlyAbsent(sceneOnlyProse, cleaned, false)) return;

    const idObj = collectCharacterIdentityKeys(cleaned);
    if (areIdentityKeysShadowMatch(seenIdentityKeys, idObj.aliasKeys)) {
      return;
    }
    for (const ak of idObj.aliasKeys) {
      seenIdentityKeys.add(ak);
    }
    orderedNames.push(cleaned);
  };

  // Match valid existing portrait bank characters first ONLY if directly present in actual in-scene prose
  for (const p of existingPortraits) {
    if (p.isMc && !mcPresent) continue;
    const validName = p.isMc
      ? p.name.trim()
      : sanitizeCharacterName(
          p.name,
          allowedKnownKeys,
          cultivationBlockedKeys,
        );
    if (!validName) continue;
    const presence = analyzeCharacterDirectPresence(sceneOnlyProse, validName, {
      allowHonorificShortName: true,
    });
    if (presence.directCount > 0) {
      pushName(validName);
    }
  }

  // Then all valid names detected from clean scene prose
  for (const name of extractedNames) {
    pushName(name);
  }

  const knownResults: DetectedPortraitCandidate[] = [];
  const newCandidates: Array<{
    candidate: DetectedPortraitCandidate;
    mentionedByUser: boolean;
    engagementScore: number;
    normalizedRoleKey: string;
  }> = [];
  const emittedIdentityKeys = new Set<string>();
  const emittedSpecificRoleKeys = new Set<string>();

  const GENERIC_NON_SPECIFIC_ROLES = new Set([
    'npc',
    'npc trong truyen',
    'npc dong nhan',
    'nhan vat phu',
    'nhan vat chinh',
    'main',
    'mob',
  ]);

  for (const name of orderedNames) {
    const key = normalizeCharacterKey(name);
    const matchedPortrait = matchPortraitByName(name, existingPortraits);
    const matchedNpc = npcs.find((n) => {
      const nId = collectCharacterIdentityKeys(n.name, [n.role, n.signature]);
      return nId.aliasKeys.has(key);
    });
    const isMc =
      Boolean(matchedPortrait?.isMc) || (Boolean(mcKey) && key === mcKey);

    if (isMc && !mcPresent) continue;

    const variantOfCanonical = findCanonicalVariantMatch(name, [
      ...canonicalPoolForTurn,
      ...knownResults.map((r) => r.name),
    ]);

    const isKnownRosterOrPortrait = Boolean(
      isMc ||
        matchedPortrait ||
        matchedNpc ||
        allowedKnownKeys.has(key) ||
        Boolean(variantOfCanonical),
    );

    const resolvedName =
      matchedPortrait?.name ||
      matchedNpc?.name ||
      variantOfCanonical ||
      lookupKnownCelebrityProfile(name)?.canonicalName ||
      name;

    const resolvedId = collectCharacterIdentityKeys(resolvedName);
    let alreadyEmitted = false;
    for (const ak of resolvedId.aliasKeys) {
      if (emittedIdentityKeys.has(ak)) {
        alreadyEmitted = true;
        break;
      }
    }
    if (alreadyEmitted) continue;

    // Gate brand-new non-roster characters strictly so passing mentions / items / places / realms / unnamed fillers / teasing names never spawn as NPCs
    let newEngagement: ReturnType<typeof evaluateCharacterSceneEngagement> | null =
      null;
    if (!isKnownRosterOrPortrait) {
      if (
        isNonPersonCultivationOrWorldTerm(
          resolvedName,
          cultivationBlockedKeys,
        ) ||
        (!isExplicitCharacterDesignation(resolvedName) &&
          isGenericUnnamedFillerNpcName(resolvedName, allowedKnownKeys)) ||
        isPlayfulTeasingOrParodyName(resolvedName, allowedKnownKeys)
      ) {
        continue;
      }
      newEngagement = evaluateCharacterSceneEngagement(
        sceneOnlyProse,
        resolvedName,
        cleanUser,
        cultivationBlockedKeys,
      );
      if (strictNewNpcGate && !newEngagement.qualifiesAsNewNpc) {
        continue;
      }
    }

    const localResolved = resolveLocalVividNpcProfile({
      name: resolvedName,
      isMc,
      comp: activeComp,
      cleanStoryText: sceneOnlyProse,
      storyClock: state.memory?.storyClock,
    });
    const celeb = lookupKnownCelebrityProfile(resolvedName);

    const role =
      sanitizeNpcFieldText(
        'role',
        matchedPortrait?.role ||
          matchedNpc?.role ||
          localResolved.role ||
          celeb?.role,
      ) || (isMc ? 'Nhân vật chính' : 'NPC trong truyện');

    // Never auto-create brand-new Mob/background extras unless explicitly named by the player
    if (
      !isKnownRosterOrPortrait &&
      !newEngagement?.mentionedByUser &&
      resolvePortraitRoleTier({ role, isMc: false }).tier === 'mob'
    ) {
      continue;
    }

    // Respect manual edits & AI locks if already set; otherwise use resolved vivid profile
    const isLockedProfile = Boolean(matchedPortrait?.aiAutoEnrichLocked);
    const age =
      matchedPortrait?.profileManual || isLockedProfile
        ? matchedPortrait?.age
        : matchedPortrait?.age?.trim() || localResolved.age;
    const birthday =
      matchedPortrait?.profileManual || isLockedProfile
        ? matchedPortrait?.birthday
        : matchedPortrait?.birthday?.trim() || localResolved.birthday;
    const fashionStyle = sanitizeNpcFieldText(
      'fashionStyle',
      matchedPortrait?.profileManual || isLockedProfile
        ? matchedPortrait?.fashionStyle
        : matchedPortrait?.fashionStyle?.trim() || localResolved.fashionStyle,
    );
    const appearance = sanitizeNpcFieldText(
      'appearance',
      matchedPortrait?.appearanceManual || isLockedProfile
        ? matchedPortrait?.appearance
        : matchedPortrait?.appearance?.trim() || localResolved.appearance,
    );
    const personality = sanitizeNpcFieldText(
      'personality',
      matchedPortrait?.profileManual || isLockedProfile
        ? matchedPortrait?.personality
        : matchedPortrait?.personality?.trim() || localResolved.personality,
    );
    const relationships = sanitizeNpcFieldText(
      'relationships',
      matchedPortrait?.profileManual || isLockedProfile
        ? matchedPortrait?.relationships
        : matchedPortrait?.relationships?.trim() || localResolved.relationships,
    );
    const signature = sanitizeNpcFieldText(
      'signature',
      matchedPortrait?.profileManual || isLockedProfile
        ? matchedPortrait?.signature
        : matchedPortrait?.signature?.trim() || localResolved.signature,
    );

    if (
      !isMc &&
      (isChatOrNonPersonDescription(role) ||
        isChatOrNonPersonDescription(appearance))
    ) {
      continue;
    }

    for (const ak of resolvedId.aliasKeys) {
      emittedIdentityKeys.add(ak);
    }

    const roleKey = normalizeCharacterKey(role);
    const candidateObj: DetectedPortraitCandidate = {
      name: resolvedName,
      isMc,
      role,
      ...(age ? { age } : {}),
      ...(birthday ? { birthday } : {}),
      ...(fashionStyle ? { fashionStyle } : {}),
      appearance,
      ...(personality ? { personality } : {}),
      ...(relationships ? { relationships } : {}),
      ...(signature ? { signature } : {}),
      npcId: matchedPortrait?.npcId || matchedNpc?.id,
      contextSnippet: extractCharacterContextSnippet(
        sceneOnlyProse,
        name,
        resolvedName,
        180,
        {
          role,
          personality,
          signature,
          appearance,
          isMc,
          allowProfileFallback: true,
        },
      ),
    };

    if (isKnownRosterOrPortrait) {
      if (roleKey && !GENERIC_NON_SPECIFIC_ROLES.has(roleKey)) {
        emittedSpecificRoleKeys.add(roleKey);
      }
      knownResults.push(candidateObj);
    } else {
      newCandidates.push({
        candidate: candidateObj,
        mentionedByUser: Boolean(newEngagement?.mentionedByUser),
        engagementScore: newEngagement?.engagementScore ?? 0,
        normalizedRoleKey: roleKey,
      });
    }
  }

  // Rank brand-new non-roster candidates by engagement, block low-signal duplicate-role fillers,
  // and cap AI-invented unprompted new NPCs to at most 2 per turn so scenes stay focused.
  newCandidates.sort(
    (a, b) =>
      Number(b.mentionedByUser) - Number(a.mentionedByUser) ||
      b.engagementScore - a.engagementScore,
  );

  const MAX_NEW_UNPROMPTED_NPCS_PER_TURN = 2;
  const MAX_TOTAL_NEW_NPCS_PER_TURN = 3;
  let unpromptedAdded = 0;
  const acceptedNew: DetectedPortraitCandidate[] = [];

  for (const item of newCandidates) {
    if (acceptedNew.length >= MAX_TOTAL_NEW_NPCS_PER_TURN) break;

    const isDuplicateFillerRole =
      !item.mentionedByUser &&
      Boolean(item.normalizedRoleKey) &&
      !GENERIC_NON_SPECIFIC_ROLES.has(item.normalizedRoleKey) &&
      emittedSpecificRoleKeys.has(item.normalizedRoleKey) &&
      item.engagementScore < 8;
    if (isDuplicateFillerRole) continue;

    if (!item.mentionedByUser) {
      if (unpromptedAdded >= MAX_NEW_UNPROMPTED_NPCS_PER_TURN) continue;
      unpromptedAdded += 1;
    }

    if (
      item.normalizedRoleKey &&
      !GENERIC_NON_SPECIFIC_ROLES.has(item.normalizedRoleKey)
    ) {
      emittedSpecificRoleKeys.add(item.normalizedRoleKey);
    }
    acceptedNew.push(item.candidate);
  }

  return [...knownResults, ...acceptedNew];
}

export function buildCharacterPortraitPrompt(options: {
  character: Pick<
    CharacterPortrait,
    | 'name'
    | 'role'
    | 'age'
    | 'birthday'
    | 'fashionStyle'
    | 'appearance'
    | 'referenceImageData'
    | 'identityLock'
    | 'avatarVisualLock'
    | 'lastReferenceComparison'
    | 'personality'
    | 'signature'
    | 'currentLocation'
    | 'contextSnippet'
    | 'customPrompt'
    | 'useSceneContextInPortrait'
    | 'isMc'
  >;
  state: ArkState;
  sceneContext?: string;
  ignoreCustomPrompt?: boolean;
  useSceneContext?: boolean;
}): string {
  const { character, state, sceneContext, ignoreCustomPrompt, useSceneContext } =
    options;
  const safeChar = character || ({} as typeof character);
  const styleObj = resolveStoryImageStyle(
    state?.storyImage?.stylePreset,
    state?.storyImage?.customStyles,
  );
  const activeComp = state ? getStoryBoundCompanionFromState(state) : undefined;
  const worldGenreHint = [
    state?.world?.genre,
    state?.world?.name,
    state?.world?.setting,
    activeComp?.worldSetting,
  ]
    .filter(Boolean)
    .join(' ');
  const charNameStr = String(safeChar.name ?? '').trim();
  const primaryFallback = resolveImageCharacterIdentity(charNameStr, state);
  const mergedLock = mergeCharacterIdentityLock(
    safeChar.identityLock,
    primaryFallback.identityLock,
    false,
  );
  const resolvedPortraitAge = resolveEffectiveCharacterAge({
    age: String(safeChar.age ?? primaryFallback.age ?? ''),
    birthday: String(safeChar.birthday ?? ''),
    extraText: [
      safeChar.appearance,
      safeChar.role,
      safeChar.signature,
      primaryFallback.appearance,
    ]
      .filter(Boolean)
      .join(' '),
    clock: state?.memory?.storyClock,
  });
  const mergedIdentity: ResolvedImageCharacterIdentity = {
    ...primaryFallback,
    canonicalName: charNameStr || primaryFallback.canonicalName || 'Character',
    role: String(safeChar.role ?? primaryFallback.role ?? '').trim(),
    age: resolvedPortraitAge.ageLabel || primaryFallback.age,
    ageNum: resolvedPortraitAge.ageNum ?? primaryFallback.ageNum,
    birthYear: resolvedPortraitAge.birthYear ?? primaryFallback.birthYear,
    gender:
      String(mergedLock?.gender ?? primaryFallback.gender ?? '').trim() ||
      undefined,
    appearance: (
      String(safeChar.appearance ?? '').trim() ||
      String(primaryFallback.appearance ?? '').trim()
    ).trim(),
    referenceImageData:
      String(safeChar.referenceImageData ?? '').trim() ||
      String(primaryFallback.referenceImageData ?? '').trim() ||
      undefined,
    identityLock: mergedLock,
    avatarVisualLock: sanitizeVisualPromptFragment(
      String(safeChar.avatarVisualLock ?? primaryFallback.avatarVisualLock ?? ''),
    ),
    fashionStyle: (
      String(safeChar.fashionStyle ?? '').trim() ||
      String(primaryFallback.fashionStyle ?? '').trim()
    ).trim(),
    signature: (
      String(safeChar.signature ?? '').trim() ||
      String(primaryFallback.signature ?? '').trim()
    ).trim(),
  };

  const portraitComparisonPatch = deriveReferenceComparisonPromptPatch(
    safeChar.lastReferenceComparison,
    {
      globalEnabled: state?.storyImage?.applyComparisonToPrompt !== false,
      knownAgeNum: mergedIdentity.ageNum,
      profileGender: mergedIdentity.gender,
      profileAppearance: mergedIdentity.appearance,
      profileFashionStyle: mergedIdentity.fashionStyle,
      profileSignature: mergedIdentity.signature,
    },
  );

  // If the user explicitly edited and saved a custom prompt, preserve it verbatim
  // without auto-rewriting or mixing in story prose.
  const trimmedCustomPrompt = String(safeChar.customPrompt ?? '').trim();
  if (!ignoreCustomPrompt && trimmedCustomPrompt) {
    if (
      portraitComparisonPatch.active &&
      portraitComparisonPatch.patchText &&
      !trimmedCustomPrompt
        .toLowerCase()
        .includes(
          portraitComparisonPatch.patchText.toLowerCase().slice(0, 28),
        )
    ) {
      return `${trimmedCustomPrompt}, ${portraitComparisonPatch.patchText}`;
    }
    return trimmedCustomPrompt;
  }

  const allowSceneContext = Boolean(
    useSceneContext ?? safeChar.useSceneContextInPortrait,
  );
  const genderWord = inferCharacterGenderEn(
    mergedIdentity,
    allowSceneContext
      ? `${String(sceneContext ?? '')} ${String(safeChar.contextSnippet ?? '')}`
      : '',
  );
  const resolvedAgeNum = parseNumericAgeFromCue(
    mergedIdentity.age,
    mergedIdentity.ageNum,
  );
  const ageCue = formatAccurateAgeCueEn(mergedIdentity.age, resolvedAgeNum);
  const skinAgeCue = buildAgeNaturalSkinRealismCue(resolvedAgeNum);

  const knownPortraitMeta = resolveKnownDisplayAlias(mergedIdentity.canonicalName);

  const equippedGear = resolveCharacterEquippedGearForVisualPrompt(
    state,
    mergedIdentity.canonicalName,
    Boolean(safeChar.isMc),
  );
  const isWuxiaOrXianxiaWorld = isWuxiaOrXianxiaWorldState(state);
  const syncedFashionStyle =
    equippedGear.outfitTextVi || mergedIdentity.fashionStyle;
  const syncedSignatureProps = [
    equippedGear.weaponTextVi,
    equippedGear.accessoryTextVi,
    mergedIdentity.signature,
  ]
    .filter(Boolean)
    .join(', ');

  const authorizedPortraitText = [
    mergedIdentity.appearance,
    syncedFashionStyle,
    syncedSignatureProps,
    String(safeChar.personality ?? ''),
    mergedIdentity.role,
    allowSceneContext ? String(sceneContext || safeChar.contextSnippet || '') : '',
  ]
    .filter(Boolean)
    .join(' ');

  const structuredIdentity = buildStructuredCharacterIdentityEn({
    canonicalName: mergedIdentity.canonicalName,
    knownDisplayAlias: knownPortraitMeta.knownDisplayAlias,
    isKnownRealPerson: knownPortraitMeta.isKnownRealPerson,
    genderWord,
    ageCue,
    ageNum: resolvedAgeNum,
    skinAgeCue,
    role: mergedIdentity.role,
    appearance: mergedIdentity.appearance,
    fashionStyle: syncedFashionStyle,
    personality: String(safeChar.personality ?? ''),
    signature: syncedSignatureProps,
    identityLock: mergedIdentity.identityLock,
    avatarVisualLock: mergedIdentity.avatarVisualLock,
    worldGenreHint,
    lockAvatarIdentity: true,
  });

  // Strict separation: by default, derive solo portrait posture/expression strictly from
  // the fixed character profile (never from turn-tracked contextSnippet or current story page).
  // Only read transient story turn context if the user explicitly enabled useSceneContextInPortrait.
  const rawPoseSource = allowSceneContext
    ? String(sceneContext || safeChar.contextSnippet || '').trim()
    : '';
  const soloPoseExpression = rawPoseSource
    ? extractSoloPoseAndExpression(
        rawPoseSource,
        mergedIdentity.canonicalName,
        {
          alternateName: primaryFallback.canonicalName,
          role: mergedIdentity.role,
          personality: String(safeChar.personality ?? ''),
          signature: syncedSignatureProps,
          appearance: mergedIdentity.appearance,
          isMc: Boolean(safeChar.isMc),
          allowProfileFallback: false,
        },
      )
    : '';
  const translatedPoseFromSource = soloPoseExpression
    ? stripResidualVietnameseFromEnglishClause(
        translateVietnameseVisualToEnglish(
          translateCommonViVisualTerms(
            trimToCleanSentence(soloPoseExpression, 120),
          ),
        ),
        [mergedIdentity.canonicalName, knownPortraitMeta.knownDisplayAlias],
      )
    : '';
  const profileAuraPose = distillVisualAuraFromProfileTextEn(
    String(safeChar.personality ?? ''),
    syncedSignatureProps,
  );
  const translatedPose =
    translatedPoseFromSource ||
    (profileAuraPose
      ? `with a natural ${profileAuraPose} expression and relaxed poised shoulders facing the camera`
      : '');

  // Scan ONLY real character profile fields for tattoos — NEVER stale avatarVisualLock/identityLock!
  const tattooProfile = extractTattooAndBodyMarkingsEn(
    mergedIdentity.appearance,
    syncedFashionStyle,
    syncedSignatureProps,
  );

  // Strict 3D Donghua / Stylized 3D Visual Prompt Compiler deterministic tag-format path for latent.moe
  if (state?.config?.imageProvider === 'latent') {
    const subjectTag =
      genderWord === 'woman'
        ? '1girl'
        : genderWord === 'man'
          ? '1boy'
          : '1person';
    const framingTag =
      tattooProfile.hasTattoos && tattooProfile.needsOpenTorsoFraming
        ? '3d donghua style, stylized 3d portrait, cowboy shot, upper body'
        : state?.storyImage?.cameraAngle === 'close_up'
          ? '3d donghua style, stylized 3d portrait, close-up'
          : '3d donghua style, stylized 3d portrait, upper body';
    const preserveNames = [
      mergedIdentity.canonicalName,
      knownPortraitMeta.knownDisplayAlias || '',
    ].filter(Boolean);
    const toCleanEnTag = (raw: string): string => {
      if (!raw.trim()) return '';
      return sanitizeVisualPromptFragment(
        stripResidualVietnameseFromEnglishClause(
          translateVietnameseVisualToEnglish(
            translateCommonViVisualTerms(raw.trim()),
          ),
          preserveNames,
        ),
      );
    };

    const hairLock = extractExplicitHairProfileEn(
      mergedIdentity.appearance,
      syncedFashionStyle,
      syncedSignatureProps,
    );
    const cleanLockFace = stripUnauthorizedBodyMarksAndCultureDriftEn({
      prompt: mergedIdentity.identityLock?.facialFeatures || '',
      authorizedText: authorizedPortraitText,
      isWuxiaOrXianxia: isWuxiaOrXianxiaWorld,
    });
    const cleanLockTags = stripUnauthorizedBodyMarksAndCultureDriftEn({
      prompt: mergedIdentity.identityLock?.fixedTags || '',
      authorizedText: authorizedPortraitText,
      isWuxiaOrXianxia: isWuxiaOrXianxiaWorld,
    });
    const appearanceTag = toCleanEnTag(
      [
        resolvedAgeNum ? `${resolvedAgeNum}yo` : '',
        'clean sculpted features',
        hairLock.hairClauseEn || mergedIdentity.identityLock?.hairstyle || '',
        cleanLockFace || mergedIdentity.appearance,
        cleanLockTags,
        tattooProfile.hasTattoos ? tattooProfile.clauseEn : '',
      ]
        .filter(Boolean)
        .join(', '),
    );
    const concretePersonalityCues = mapAbstractTraitsToVisualCuesEn(
      `${safeChar.personality || ''} ${syncedSignatureProps || ''}`,
    );
    const expressionPoseTag =
      translatedPoseFromSource ||
      concretePersonalityCues ||
      (profileAuraPose
        ? `${profileAuraPose} expression, confident poised posture, dynamic three-quarter angle`
        : '') ||
      'sharp confident gaze, composed commanding posture, dynamic three-quarter angle';
    const outfitGearTag = toCleanEnTag(
      [
        equippedGear.outfitTextEn || syncedFashionStyle,
        equippedGear.weaponTextEn ? `carrying ${equippedGear.weaponTextEn}` : '',
        equippedGear.accessoryTextEn,
        !equippedGear.outfitTextEn && !syncedFashionStyle
          ? mergedIdentity.identityLock?.signatureStyle || ''
          : '',
        mergedIdentity.signature,
      ]
        .filter(Boolean)
        .join(', '),
    );
    const locationTag = toCleanEnTag(String(safeChar.currentLocation || ''));
    const settingLightingTag = [
      locationTag || 'atmospheric softly blurred background',
      'controlled key lighting, crisp rim light keeping face and outfit readable, rich fabric and material textures, crisp depth, high clarity',
    ]
      .filter(Boolean)
      .join(', ');

    const rawTagPrompt = [
      `${subjectTag}, solo, ${framingTag}, looking at viewer`,
      appearanceTag,
      expressionPoseTag,
      outfitGearTag,
      settingLightingTag,
      portraitComparisonPatch.active ? portraitComparisonPatch.patchText : '',
    ]
      .filter(Boolean)
      .join(', ');

    const cleanedLatent = sanitizeVisualPromptFragment(
      stripUnauthorizedBodyMarksAndCultureDriftEn({
        prompt: stripUnrequestedQualityBuzzwords(
          sanitizeImagePromptForApiSafety(
            reconcilePortraitContradictionsEn(rawTagPrompt),
          ).prompt,
        ),
        authorizedText: authorizedPortraitText,
        isWuxiaOrXianxia: isWuxiaOrXianxiaWorld,
      }),
    );
    const withDonghuaTags = appendWuxiaXianxiaDonghuaPromptTags(
      cleanedLatent,
      {
        state,
        isWuxiaOrXianxia: isWuxiaOrXianxiaWorld,
        isSceneryOnly: false,
        gender:
          genderWord === 'woman'
            ? 'female'
            : genderWord === 'man'
              ? 'male'
              : 'neutral',
        provider: 'latent',
      },
    );
    const finalLatent = /\bno\s+text\b/i.test(withDonghuaTags)
      ? withDonghuaTags
      : `${withDonghuaTags}, no text, no watermark`;
    return portraitComparisonPatch.active
      ? enforceComparisonPatchOnPrompt(
          finalLatent,
          portraitComparisonPatch.patchText,
        )
      : finalLatent;
  }

  const combinedOutfitText = `${syncedFashionStyle || ''} ${mergedIdentity.identityLock?.signatureStyle || ''} ${mergedIdentity.appearance || ''} ${soloPoseExpression}`;
  const explicitlyMentionsSuit =
    /\b(?:vest|com\s*lê|comple|suit|tuxedo|blazer|âu\s*phục)\b/i.test(
      combinedOutfitText,
    );
  const backdropCue = explicitlyMentionsSuit
    ? 'a clean softly blurred minimalist neutral backdrop tailored to their personal style'
    : 'a clean softly blurred atmospheric backdrop matching their world setting and personal vibe, wearing profile-accurate attire (no generic corporate suit, no movie-set staging)';

  // Use portrait-adapted style guide so movie-still / anamorphic / heavy cinema color-grading cues
  // NEVER overpower facial identity, real marks, hair, or attire.
  const portraitStyleGuide = resolvePortraitStyleGuideEn(styleObj);
  const rawAngleId = state?.storyImage?.cameraAngle;
  // For character portraits, avoid dramatic story-scene angles (dutch/low/high/wide/over-shoulder)
  // that distort or obscure the character; when chest/arm tattoos exist, favor chest-up/waist-up framing.
  const portraitAngleGuide =
    tattooProfile.hasTattoos && tattooProfile.needsOpenTorsoFraming
      ? genderWord === 'woman'
        ? `medium waist-up portrait framing with clear collar and sleeves so the tattoos across the ${tattooProfile.locations.join(', ')} are clearly visible`
        : `medium chest-up to waist-up portrait framing with natural open neckline and visible sleeves so the tattoos across the ${tattooProfile.locations.join(', ')} are clearly visible and unobstructed`
      : rawAngleId === 'close_up' || rawAngleId === 'medium_shot'
        ? resolveCameraAngle(rawAngleId).promptGuide || ''
        : 'clean eye-level waist-up or medium close-up portrait framing';

  const portraitLightingCue = tattooProfile.hasTattoos
    ? 'controlled key lighting and crisp rim light with true-to-life natural colors and clear visibility of facial features, ink details of declared tattoos, hair, and fabric textures (no muddy dark shadows)'
    : 'controlled key lighting and crisp rim light with true-to-life skin tone and clear visibility of facial features, hair, and outfit textures (no muddy dark shadows)';

  const cohesivePortrait = composeCohesiveEnglishImagePrompt({
    headcountLock: `Single person only, 1 ${genderWord} alone, no extra people, no crowd`,
    characterGroupText: structuredIdentity.combinedClause,
    actionExpressionText:
      translatedPose ||
      'with a sharp confident gaze, composed commanding posture, and dynamic three-quarter framing facing the camera',
    cameraFramingGuide: [
      STORY_IMAGE_CLEAR_FACE_POSITIVE_DIRECTIVE,
      portraitAngleGuide,
    ]
      .filter(Boolean)
      .join(', '),
    settingLocation: backdropCue,
    lightingAtmosphere: portraitLightingCue,
    styleGuide: portraitStyleGuide,
    extraConstraints: portraitComparisonPatch.active
      ? `Reference likeness priority: ${portraitComparisonPatch.patchText}`
      : undefined,
    preserveNames: [
      mergedIdentity.canonicalName,
      ...(knownPortraitMeta.knownDisplayAlias
        ? [knownPortraitMeta.knownDisplayAlias]
        : []),
    ],
  });

  const apiSafePortrait = stripUnauthorizedBodyMarksAndCultureDriftEn({
    prompt: sanitizeImagePromptForApiSafety(
      reconcilePortraitContradictionsEn(cohesivePortrait),
    ).prompt,
    authorizedText: authorizedPortraitText,
    isWuxiaOrXianxia: isWuxiaOrXianxiaWorld,
  });

  const finalPortraitPrompt = appendPortraitNoTextConstraint(
    appendWuxiaXianxiaDonghuaPromptTags(
      sanitizeVisualPromptFragment(apiSafePortrait),
      {
        state,
        isWuxiaOrXianxia: isWuxiaOrXianxiaWorld,
        isSceneryOnly: false,
        gender:
          genderWord === 'woman'
            ? 'female'
            : genderWord === 'man'
              ? 'male'
              : 'neutral',
        provider: state?.config?.imageProvider || 'seedream',
      },
    ),
  );
  return portraitComparisonPatch.active
    ? enforceComparisonPatchOnPrompt(
        finalPortraitPrompt,
        portraitComparisonPatch.patchText,
      )
    : finalPortraitPrompt;
}

export async function generateCharacterPortraitImage(options: {
  state: ArkState;
  character: Pick<
    CharacterPortrait,
    | 'name'
    | 'role'
    | 'age'
    | 'birthday'
    | 'fashionStyle'
    | 'appearance'
    | 'referenceImageData'
    | 'identityLock'
    | 'avatarVisualLock'
    | 'avatarLockSourceSig'
    | 'lastReferenceComparison'
    | 'imageData'
    | 'personality'
    | 'signature'
    | 'currentLocation'
    | 'contextSnippet'
    | 'customPrompt'
    | 'useSceneContextInPortrait'
    | 'isMc'
  > & { id?: string };
  sceneContext?: string;
  useSceneContext?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  onLog?: (line: string) => void;
  onProgress?: (progress: Omit<PortraitGenProgress, 'portraitId'>) => void;
  onCacheAvatarVisualLock?: (
    portraitId: string,
    visualLock: string,
    sourceSig: string,
    identityLock?: CharacterIdentityLock,
  ) => void;
}): Promise<{
  ok: boolean;
  imageUrl?: string;
  prompt: string;
  appliedComparisonPatch?: string;
  error?: string;
  aborted?: boolean;
  timedOut?: boolean;
  attemptsUsed?: number;
}> {
  const {
    state,
    character,
    sceneContext,
    useSceneContext,
    signal,
    timeoutMs,
    maxRetries = 0,
    onLog,
    onProgress,
    onCacheAvatarVisualLock,
  } = options;

  const isComfy = state.config.imageProvider === 'comfyui';
  const isCustomImage = state.config.imageProvider === 'custom';
  const isLatentImage = state.config.imageProvider === 'latent';
  const provider: PortraitGenProgress['provider'] = isComfy
    ? 'comfyui'
    : isCustomImage
      ? 'custom'
      : isLatentImage
        ? 'latent'
        : 'seedream';
  const effectiveTimeoutMs =
    timeoutMs ??
    (isComfy
      ? AVATAR_COMFYUI_TIMEOUT_MS
      : isCustomImage
        ? CUSTOM_IMAGE_REQUEST_TIMEOUT_MS
        : isLatentImage
          ? LATENT_REQUEST_TIMEOUT_MS
          : AVATAR_SEEDREAM_TIMEOUT_MS);
  const timeoutSec = Math.max(15, Math.round(effectiveTimeoutMs / 1000));
  // Strictly 1 image request per click (no automatic retry loop spawning 2-3 duplicate images)
  const maxAttempts = isComfy
    ? 1
    : Math.max(1, Math.min(2, 1 + Math.max(0, maxRetries)));
  const startedAt = Date.now();

  const emitProgress = (
    phase: PortraitGenProgress['phase'],
    label: string,
    attempt = 1,
    overrideTimeoutSec?: number,
    overrideStartedAt?: number,
  ) => {
    onProgress?.({
      phase,
      label,
      provider,
      attempt,
      maxAttempts,
      startedAt: overrideStartedAt ?? startedAt,
      timeoutSec: overrideTimeoutSec ?? timeoutSec,
    });
  };

  // Yield a macrotask immediately so mobile browsers paint the loading state without UI freeze
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (signal?.aborted) {
    return { ok: false, prompt: '', aborted: true };
  }

  let effectiveCharacter = character;
  const hasInitialCustomPrompt = Boolean(
    String(character.customPrompt ?? '').trim(),
  );
  const anchorImage = (
    character.referenceImageData?.trim() ||
    character.imageData?.trim() ||
    ''
  ).trim();
  const hasRealPhotoRef = Boolean(character.referenceImageData?.trim());

  emitProgress(
    'preparing',
    hasInitialCustomPrompt
      ? 'Đang chuẩn bị prompt chỉnh tay của bạn...'
      : 'Đang khóa đặc điểm nhận diện nhân vật...',
  );

  // Prioritize real-person reference photo > existing avatar image to extract & cache structured identity lock once.
  // Skip when the user provided a manual customPrompt so generation starts immediately without spending 15s on Vision.
  if (
    !hasInitialCustomPrompt &&
    state.storyImage?.lockAvatarIdentity !== false &&
    anchorImage &&
    state.config.proxyUrl?.trim()
  ) {
    const curSig = computeAvatarSignature(anchorImage);
    const hasUsableLock = Boolean(
      composeCharacterIdentityLockPrompt(
        character.identityLock,
        character.avatarVisualLock,
      ),
    );
    if (!hasUsableLock || character.avatarLockSourceSig !== curSig) {
      const visionBound = createTimedAbortSignal(signal, 15_000);
      try {
        emitProgress(
          'preparing',
          hasRealPhotoRef
            ? 'Đang trích khóa nhận diện từ ảnh mẫu...'
            : 'Đang trích khóa nhận diện gương mặt...',
        );
        const portraitResolvedAge = resolveEffectiveCharacterAge({
          age: character.age,
          birthday: character.birthday,
          extraText: [character.appearance, character.role, character.signature]
            .filter(Boolean)
            .join(' '),
          clock: state.memory?.storyClock,
        });
        const knownAgeLabel = portraitResolvedAge.ageNum
          ? portraitResolvedAge.birthYear
            ? `${portraitResolvedAge.ageNum} tuổi (sinh năm ${portraitResolvedAge.birthYear})`
            : `${portraitResolvedAge.ageNum} tuổi`
          : portraitResolvedAge.ageLabel || undefined;
        const extracted = await extractCharacterIdentityLockFromImageWithAi({
          state,
          characterName: character.name,
          imageData: anchorImage,
          isRealPhotoReference: hasRealPhotoRef,
          knownAgeLabel,
          knownAgeNum: portraitResolvedAge.ageNum,
          existingProfileHints: [
            character.identityLock?.gender,
            knownAgeLabel,
            character.appearance,
            character.fashionStyle,
          ]
            .filter(Boolean)
            .join(', '),
          signal: visionBound.signal,
          onLog,
        });
        if (extracted) {
          const mergedLock = mergeCharacterIdentityLock(
            character.identityLock,
            extracted.identityLock,
            false,
          );
          effectiveCharacter = {
            ...character,
            identityLock: mergedLock,
            avatarVisualLock: extracted.visualLock,
            avatarLockSourceSig: curSig,
          };
          if (character.id) {
            onCacheAvatarVisualLock?.(
              character.id,
              extracted.visualLock,
              curSig,
              extracted.identityLock,
            );
          }
        }
      } catch {
        // Proceed smoothly with deterministic profile-based identity
      } finally {
        visionBound.cleanup();
      }
    }
  }

  if (signal?.aborted) {
    return { ok: false, prompt: '', aborted: true };
  }

  const hasCustomPrompt = Boolean(
    String(effectiveCharacter.customPrompt ?? '').trim(),
  );
  emitProgress(
    'prompting',
    hasCustomPrompt
      ? 'Đang dùng nguyên bản prompt chỉnh tay của bạn...'
      : 'Đang tổng hợp prompt tiếng Anh liền mạch từ hồ sơ...',
  );

  let prompt = buildCharacterPortraitPrompt({
    character: effectiveCharacter,
    state,
    sceneContext,
    useSceneContext,
  });

  const portraitAgeForCmp = resolveEffectiveCharacterAge({
    age: effectiveCharacter.age,
    birthday: effectiveCharacter.birthday,
    extraText: [
      effectiveCharacter.appearance,
      effectiveCharacter.role,
      effectiveCharacter.signature,
    ]
      .filter(Boolean)
      .join(' '),
    clock: state.memory?.storyClock,
  });
  const portraitComparisonPatch = deriveReferenceComparisonPromptPatch(
    effectiveCharacter.lastReferenceComparison,
    {
      globalEnabled: state.storyImage?.applyComparisonToPrompt !== false,
      knownAgeNum: portraitAgeForCmp.ageNum,
      profileGender: effectiveCharacter.identityLock?.gender,
      profileAppearance: effectiveCharacter.appearance,
      profileFashionStyle: effectiveCharacter.fashionStyle,
      profileSignature: effectiveCharacter.signature,
    },
  );
  const activeComparisonPatch = portraitComparisonPatch.active
    ? portraitComparisonPatch.patchText
    : undefined;
  const cmpMismatches = effectiveCharacter.lastReferenceComparison?.mismatches;
  if (hasCustomPrompt) {
    onLog?.(
      `[Prompt tùy chỉnh NV] Giữ nguyên prompt chỉnh tay cho "${effectiveCharacter.name}" (không tự viết lại hay ghi đè).`,
    );
  }
  if (activeComparisonPatch) {
    onLog?.(
      `[Đối chiếu → Prompt NV] Đang nạp chỉnh sửa từ kết quả đối chiếu của "${effectiveCharacter.name}": ${activeComparisonPatch}`,
    );
  }

  const portraitEquippedGear = resolveCharacterEquippedGearForVisualPrompt(
    state,
    effectiveCharacter.name,
    Boolean(effectiveCharacter.isMc),
  );
  const portraitIsWuxiaOrXianxia = isWuxiaOrXianxiaWorldState(state);
  const portraitAuthorizedProfileText = [
    effectiveCharacter.appearance,
    portraitEquippedGear.outfitTextVi || effectiveCharacter.fashionStyle,
    effectiveCharacter.signature,
    portraitEquippedGear.combinedRawVi,
    portraitEquippedGear.combinedCleanEn,
    effectiveCharacter.personality,
    effectiveCharacter.role,
    (useSceneContext ?? effectiveCharacter.useSceneContextInPortrait)
      ? String(sceneContext || effectiveCharacter.contextSnippet || '')
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const profileHairLock = extractExplicitHairProfileEn(
    effectiveCharacter.appearance,
    effectiveCharacter.fashionStyle,
    effectiveCharacter.signature,
  );
  // Strictly detect tattoos ONLY from real character profile fields (never stale cached locks)
  const profileTattooLock = extractTattooAndBodyMarkingsEn(
    effectiveCharacter.appearance,
    effectiveCharacter.fashionStyle,
    effectiveCharacter.signature,
  );
  const enforcePortraitHairAndTattooLocks = (rawP: string): string => {
    let out = String(rawP ?? '').trim();
    if (profileHairLock.colorFamily) {
      out = stripConflictingHairColorsFromText(
        out,
        profileHairLock.colorFamily,
      ).cleaned;
      if (
        profileHairLock.hairClauseEn &&
        !out.toLowerCase().includes(profileHairLock.hairClauseEn.toLowerCase().slice(0, 14))
      ) {
        // Place hair lock prominently near the front right after subject lead if dropped
        const firstComma = out.indexOf(',');
        const hairInsertion = isLatentImage
          ? profileHairLock.hairClauseEn
          : `with ${profileHairLock.hairClauseEn}`;
        out =
          firstComma > 0
            ? `${out.slice(0, firstComma)}, ${hairInsertion}${out.slice(firstComma)}`
            : `${out}, ${hairInsertion}`;
      }
    }
    out = stripOverAgingWordsFromText(out, portraitAgeForCmp.ageNum).cleaned;
    if (profileTattooLock.hasTattoos && profileTattooLock.clauseEn) {
      const lower = out.toLowerCase();
      const missingAnyLoc = profileTattooLock.locations.some((loc) => {
        const kw = loc.split(/[\s(]/)[0]?.toLowerCase() || '';
        return kw && !lower.includes(kw);
      });
      if (!/\btattoo/i.test(lower) || missingAnyLoc) {
        out = `${out}, ${profileTattooLock.clauseEn}`;
      }
    }
    return stripUnauthorizedBodyMarksAndCultureDriftEn({
      prompt: out,
      authorizedText: portraitAuthorizedProfileText,
      isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
    });
  };

  // When user edited customPrompt manually, respect it 100% verbatim and skip AI rewriting!
  // Otherwise, compile through the Strict Visual Prompt Compiler when targeting latent.moe,
  // when a reference photo is attached, or when the draft prompt still contains Vietnamese.
  const portraitTargetEngine = resolveVisualPromptCompilerTarget(
    state.config.imageProvider,
  );
  const shouldCrossCheckPortraitPrompt =
    !hasCustomPrompt &&
    Boolean(state.config.proxyUrl?.trim()) &&
    !signal?.aborted &&
    (isLatentImage || hasRealPhotoRef || containsVietnameseText(prompt));

  if (shouldCrossCheckPortraitPrompt) {
    try {
      emitProgress(
        'prompting',
        hasRealPhotoRef
          ? 'Đang đối chiếu ảnh mẫu & biên dịch prompt 3D Donghua...'
          : isLatentImage
            ? 'Đang biên dịch prompt 3D Donghua chuẩn Latent.moe...'
            : 'Đang biên dịch prompt 3D tiếng Anh chuẩn hóa...',
      );
      const styleObj = resolveStoryImageStyle(
        state.storyImage?.stylePreset,
        state.storyImage?.customStyles,
      );
      const portraitStyleGuide = resolvePortraitStyleGuideEn(styleObj);
      const refUrl = effectiveCharacter.referenceImageData?.trim();
      const verifiedAgeNote = portraitAgeForCmp.ageNum
        ? `Age: ${portraitAgeForCmp.ageNum} years old${portraitAgeForCmp.birthYear ? ` (born ${portraitAgeForCmp.birthYear})` : ''}`
        : effectiveCharacter.age
          ? `Age: ${effectiveCharacter.age}`
          : '';
      const hairPreservationNote =
        profileHairLock.hasExplicitHair && profileHairLock.hairClauseEn
          ? `Fixed hair lock (must preserve exact color & style): ${profileHairLock.hairClauseEn}`
          : '';
      const tattooPreservationNote = profileTattooLock.hasTattoos
        ? `Fixed marks/tattoos with exact anatomical placement (never omit or swap sides): ${profileTattooLock.clauseEn}`
        : 'Body marks rule: NO tattoos, NO scars, NO piercings unless explicitly listed above.';
      const comparisonCorrectionNote = activeComparisonPatch
        ? `Mandatory targeted fixes (${portraitComparisonPatch.mode === 'light_refine' ? 'light polish only' : 'fix mismatches without dropping fixed marks'}): ${activeComparisonPatch}${cmpMismatches?.length ? ` | Mismatches: ${cmpMismatches.join('; ')}` : ''}`
        : '';
      const allowPortraitSceneCtx = Boolean(
        useSceneContext ?? effectiveCharacter.useSceneContextInPortrait,
      );
      const rawSceneSnippet = allowPortraitSceneCtx
        ? String(sceneContext || effectiveCharacter.contextSnippet || '').trim()
        : '';
      const portraitWorldSetting = resolveCompilerWorldSettingLabel(state);
      const cleanLockedFace = stripUnauthorizedBodyMarksAndCultureDriftEn({
        prompt: effectiveCharacter.identityLock?.facialFeatures || '',
        authorizedText: portraitAuthorizedProfileText,
        isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
      });
      const cleanLockedTags = stripUnauthorizedBodyMarksAndCultureDriftEn({
        prompt: effectiveCharacter.identityLock?.fixedTags || '',
        authorizedText: portraitAuthorizedProfileText,
        isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
      });
      const rawNpcProfilePayload = [
        `TARGET ENGINE: ${portraitTargetEngine}`,
        `WORLD SETTING: ${portraitWorldSetting}`,
        `MODE: solo_character_portrait${effectiveCharacter.isMc ? ' (MAIN CHARACTER — strong commanding presence & expressive sculpted detail)' : ''}`,
        `RAW CHARACTER / NPC PROFILE:`,
        `- Name: ${effectiveCharacter.name}`,
        effectiveCharacter.role ? `- Role / Status: ${effectiveCharacter.role}` : '',
        effectiveCharacter.identityLock?.gender
          ? `- Gender: ${effectiveCharacter.identityLock.gender}`
          : '',
        verifiedAgeNote ? `- ${verifiedAgeNote}` : '',
        effectiveCharacter.appearance
          ? `- Appearance: ${effectiveCharacter.appearance}`
          : '',
        effectiveCharacter.identityLock?.hairstyle
          ? `- Hairstyle lock: ${effectiveCharacter.identityLock.hairstyle}`
          : '',
        cleanLockedFace ? `- Facial features: ${cleanLockedFace}` : '',
        cleanLockedTags ? `- Fixed visual tags: ${cleanLockedTags}` : '',
        effectiveCharacter.personality
          ? `- Personality & status (translate into sharp gaze, confident/composed posture, and dynamic presence): ${effectiveCharacter.personality}`
          : '',
        portraitEquippedGear.outfitTextVi
          ? `- Currently equipped attire (PRIORITY): ${portraitEquippedGear.outfitTextVi}${portraitEquippedGear.outfitTextEn ? ` -> ${portraitEquippedGear.outfitTextEn}` : ''}`
          : effectiveCharacter.fashionStyle
            ? `- Outfit & material details: ${effectiveCharacter.fashionStyle}`
            : '',
        !portraitEquippedGear.outfitTextVi &&
        effectiveCharacter.identityLock?.signatureStyle
          ? `- Signature attire: ${effectiveCharacter.identityLock.signatureStyle}`
          : '',
        portraitEquippedGear.weaponTextVi
          ? `- Currently equipped weapon (PRIORITY): ${portraitEquippedGear.weaponTextVi}${portraitEquippedGear.weaponTextEn ? ` -> ${portraitEquippedGear.weaponTextEn}` : ''}`
          : '',
        portraitEquippedGear.accessoryTextVi
          ? `- Currently equipped accessories: ${portraitEquippedGear.accessoryTextVi}`
          : '',
        effectiveCharacter.signature
          ? `- Signature props / marks: ${effectiveCharacter.signature}`
          : '',
        effectiveCharacter.currentLocation
          ? `- Current location: ${effectiveCharacter.currentLocation}`
          : '',
        hairPreservationNote,
        tattooPreservationNote,
        comparisonCorrectionNote,
        rawSceneSnippet
          ? `CURRENT SCENE CONTEXT (update pose, expression, camera angle, and lighting/background; keep core appearance stable): ${trimToCleanSentence(rawSceneSnippet, 360)}`
          : `CURRENT SCENE CONTEXT: High-craft 3D donghua / stylized 3D character portrait matching setting (${effectiveCharacter.currentLocation || state.world?.name || portraitWorldSetting}) with clear key & rim lighting so face and outfit stay crisp and readable.`,
        `BASELINE DRAFT PROMPT (reference only — obey strict grounding and 5-part output structure): ${prompt}`,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await callAiJsonOrTextDetailed(state, rawNpcProfilePayload, {
        systemPrompt: buildStrictVisualPromptCompilerSystemPrompt({
          targetEngine: portraitTargetEngine,
          mode: 'portrait',
          worldSetting: portraitWorldSetting,
          hasReferencePhotos: Boolean(refUrl),
          hasComparisonFixes: Boolean(activeComparisonPatch),
        }),
        ...(refUrl ? { imageDataUrls: [refUrl], requireVisionImages: true } : {}),
        taskSlot: 'referenceCheck',
        signal,
        timeoutMs: refUrl ? 15_000 : 10_000,
        maxTokens: 280,
        logPrefix: refUrl
          ? '[3D Visual Compiler · Vision NV]'
          : `[3D Visual Compiler · ${portraitTargetEngine}]`,
        onLog,
      });
      if (res.ok && res.text) {
        let cleaned = sanitizeVisualPromptFragment(
          String(res.text ?? '')
            .replace(/^["'`]+|["'`]+$/g, '')
            .replace(/^(?:compiled\s*prompt|prompt|visual\s*prompt|image\s*prompt)\s*[:：\-]\s*/i, '')
            .replace(/\s*\n+\s*/g, ', ')
            .trim(),
        );
        if (isLatentImage) {
          cleaned = stripUnrequestedQualityBuzzwords(cleaned);
        }
        cleaned = stripUnauthorizedBodyMarksAndCultureDriftEn({
          prompt: cleaned,
          authorizedText: portraitAuthorizedProfileText,
          isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
        });
        if (cleaned.length >= 16 && !containsVietnameseText(cleaned)) {
          if (refUrl) {
            onLog?.(
              `[Đối chiếu ảnh mẫu NV · ${res.modelUsed || 'Vision'}] Đã đối chiếu ảnh mẫu thật của "${effectiveCharacter.name}" qua 3D Visual Prompt Compiler.`,
            );
          }
          if (isLatentImage) {
            const with3dStyle = /\b(?:3d\s+donghua|stylized\s+3d|3d\s+render|3d\s+cg)\b/i.test(
              cleaned,
            )
              ? cleaned
              : `${cleaned}, 3d donghua style, stylized 3d`;
            const withTraitsLocked = enforcePortraitHairAndTattooLocks(with3dStyle);
            const guardedLatent = sanitizeVisualPromptFragment(
              stripUnauthorizedBodyMarksAndCultureDriftEn({
                prompt: stripUnrequestedQualityBuzzwords(
                  activeComparisonPatch
                    ? enforceComparisonPatchOnPrompt(
                        withTraitsLocked,
                        activeComparisonPatch,
                      )
                    : withTraitsLocked,
                ),
                authorizedText: portraitAuthorizedProfileText,
                isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
              }),
            );
            const compiledGenderHint = [
              effectiveCharacter.identityLock?.gender,
              effectiveCharacter.isMc ? state.player?.pronoun : '',
              effectiveCharacter.isMc ? state.player?.role : '',
              effectiveCharacter.role,
              effectiveCharacter.appearance,
            ]
              .filter(Boolean)
              .join(' ');
            const compiledGender =
              inferPromptGenderKind(compiledGenderHint) !== 'neutral'
                ? inferPromptGenderKind(compiledGenderHint)
                : inferPromptGenderKind(guardedLatent);
            const withDonghuaLatent = appendWuxiaXianxiaDonghuaPromptTags(
              guardedLatent,
              {
                state,
                isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
                isSceneryOnly: false,
                gender: compiledGender,
                provider: 'latent',
              },
            );
            prompt = /\bno\s+text\b/i.test(withDonghuaLatent)
              ? withDonghuaLatent
              : `${withDonghuaLatent}, no text, no watermark`;
          } else {
            // Attach portrait-safe art medium guide for non-latent providers
            const withPortraitStyle = portraitStyleGuide
              ? `${cleaned}, ${portraitStyleGuide}`
              : cleaned;
            const withTraitsLocked = enforcePortraitHairAndTattooLocks(withPortraitStyle);
            const compiledGenderHint = [
              effectiveCharacter.identityLock?.gender,
              effectiveCharacter.isMc ? state.player?.pronoun : '',
              effectiveCharacter.isMc ? state.player?.role : '',
              effectiveCharacter.role,
              effectiveCharacter.appearance,
            ]
              .filter(Boolean)
              .join(' ');
            const compiledGender =
              inferPromptGenderKind(compiledGenderHint) !== 'neutral'
                ? inferPromptGenderKind(compiledGenderHint)
                : inferPromptGenderKind(withTraitsLocked);
            // Anti-overwrite guard: ensure compiler never drops comparison corrections, hair color, or real profile marks!
            prompt = appendPortraitNoTextConstraint(
              appendWuxiaXianxiaDonghuaPromptTags(
                sanitizeVisualPromptFragment(
                  stripUnauthorizedBodyMarksAndCultureDriftEn({
                    prompt: activeComparisonPatch
                      ? enforceComparisonPatchOnPrompt(
                          withTraitsLocked,
                          activeComparisonPatch,
                        )
                      : withTraitsLocked,
                    authorizedText: portraitAuthorizedProfileText,
                    isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
                  }),
                ),
                {
                  state,
                  isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
                  isSceneryOnly: false,
                  gender: compiledGender,
                  provider,
                },
              ),
            );
          }
        }
      } else if (refUrl) {
        onLog?.(
          `[Đối chiếu ảnh mẫu NV · ${res.modelUsed || 'Vision'}] Đối chiếu trước khi vẽ thất bại (${res.errorMessage || 'lỗi API'}) — tạm dùng prompt ghép chuẩn.`,
        );
      }
    } catch {
      // Keep deterministic prompt fallback
    }
  }

  if (signal?.aborted) {
    return { ok: false, prompt, aborted: true };
  }

  // Final anti-overwrite & grounding guard on AUTO portrait prompts only (never mutate user customPrompt!)
  if (!hasCustomPrompt) {
    prompt = enforcePortraitHairAndTattooLocks(prompt);
    if (activeComparisonPatch) {
      const guardedPortrait = sanitizeVisualPromptFragment(
        stripUnauthorizedBodyMarksAndCultureDriftEn({
          prompt: enforceComparisonPatchOnPrompt(prompt, activeComparisonPatch),
          authorizedText: portraitAuthorizedProfileText,
          isWuxiaOrXianxia: portraitIsWuxiaOrXianxia,
        }),
      );
      prompt = isLatentImage
        ? /\bno\s+text\b/i.test(guardedPortrait)
          ? guardedPortrait
          : `${guardedPortrait}, no text, no watermark`
        : appendPortraitNoTextConstraint(guardedPortrait);
    }
    const safetyCheck = sanitizeImagePromptForApiSafety(prompt);
    if (safetyCheck.changed) {
      prompt = safetyCheck.prompt;
      onLog?.(
        `[Ảnh NV · An toàn bộ lọc] Đã chuyển mềm cụm từ dễ bị máy chủ ảnh chặn/treo (${safetyCheck.neutralizedTerms.join(', ')}) sang từ thời trang editorial an toàn cho "${effectiveCharacter.name}".`,
      );
    }
  }

  const sdSize =
    (
      state.storyImage?.size ||
      (isLatentImage ? state.config.latentSize : '') ||
      state.config.seedreamSize ||
      ''
    ).trim() || (isLatentImage ? DEFAULT_LATENT_SIZE : '1024x1024');

  const isModerationOrSafetyError = (errText?: string): boolean => {
    const msg = String(errText || '').toLowerCase();
    return /(?:content[\s_-]*policy|safety|sensitive|nsfw|inappropriate|violat|prohibited|blocked|censor|moderat|flagged|policy|unsafe|refus|harmful|celebrity|public[\s_-]*figure|likeness|real[\s_-]*person|deepfake|portrait[\s_-]*right|copyright|trademark|audit|risk|illegal|100028|100029|40003)/i.test(
      msg,
    );
  };

  const isTransientRetryableError = (
    errText?: string,
    timedOut?: boolean,
  ): boolean => {
    if (timedOut) return true;
    if (isModerationOrSafetyError(errText)) return true;
    const msg = String(errText || '').toLowerCase();
    // Never retry permanent config, auth, or non-safety bad-request errors
    if (
      /(?:http\s*(?:400|401|403|404|422)|chưa\s*cấu\s*hình|không\s*hợp\s*lệ|từ\s*chối\s*workflow|mixed\s*content)/i.test(
        msg,
      )
    ) {
      return false;
    }
    return /(?:quá\s*thời\s*gian|timeout|failed\s*to\s*fetch|networkerror|http\s*(?:429|500|502|503|504)|load\s*failed|connection)/i.test(
      msg,
    );
  };

  const retryIdentityMeta = resolveImageCharacterIdentity(
    effectiveCharacter.name,
    state,
  );
  const retryKnownMeta = resolveKnownDisplayAlias(
    retryIdentityMeta.canonicalName || effectiveCharacter.name,
  );
  const retryResolvedGender = inferCharacterGenderEn(
    {
      ...retryIdentityMeta,
      gender:
        effectiveCharacter.identityLock?.gender || retryIdentityMeta.gender,
      appearance:
        effectiveCharacter.appearance || retryIdentityMeta.appearance,
      fashionStyle:
        effectiveCharacter.fashionStyle || retryIdentityMeta.fashionStyle,
      identityLock: effectiveCharacter.identityLock,
    },
    '',
  );

  const buildCompactSafeRetryPrompt = (): string => {
    const styleObjForRetry = resolveStoryImageStyle(
      state.storyImage?.stylePreset,
      state.storyImage?.customStyles,
    );
    const mergedAppearanceText =
      effectiveCharacter.identityLock?.facialFeatures ||
      effectiveCharacter.appearance ||
      retryIdentityMeta.appearance ||
      '';
    const mergedFashionText =
      effectiveCharacter.fashionStyle ||
      effectiveCharacter.identityLock?.signatureStyle ||
      retryIdentityMeta.fashionStyle ||
      '';
    const retryHairLock = extractExplicitHairProfileEn(
      mergedAppearanceText,
      mergedFashionText,
      effectiveCharacter.signature || retryIdentityMeta.signature,
    );
    const preservedNames = [
      effectiveCharacter.name,
      retryIdentityMeta.canonicalName,
      retryKnownMeta.knownDisplayAlias || '',
    ].filter(Boolean);
    const faceHints = stripResidualVietnameseFromEnglishClause(
      translateVietnameseVisualToEnglish(mergedAppearanceText),
      preservedNames,
    );
    const outfitHints = stripResidualVietnameseFromEnglishClause(
      translateVietnameseVisualToEnglish(mergedFashionText),
      preservedNames,
    );
    return buildSafeCompactPortraitPrompt({
      canonicalName: effectiveCharacter.name,
      genderWord: retryResolvedGender,
      ageNum: portraitAgeForCmp.ageNum,
      hairClauseEn:
        profileHairLock.hairClauseEn ||
        retryHairLock.hairClauseEn ||
        effectiveCharacter.identityLock?.hairstyle,
      faceSummaryEn: faceHints,
      outfitSummaryEn: outfitHints,
      styleGuideEn: resolvePortraitStyleGuideEn(styleObjForRetry),
    });
  };

  const finalizeAvatarImageUrl = async (rawImg: string): Promise<string> => {
    const trimmed = String(rawImg || '').trim();
    if (!trimmed.startsWith('data:image/')) return trimmed;
    const approxBytes = trimmed.length * 0.75;
    if (approxBytes <= 180 * 1024) return trimmed;
    try {
      emitProgress(
        'downloading',
        'Đang tối ưu dung lượng ảnh Avatar cho thiết bị...',
      );
      const compressed = await compressSampleImageForStorage(trimmed, {
        maxEdge: 1024,
        quality: 0.88,
      });
      return compressed.dataUrl || trimmed;
    } catch {
      return trimmed;
    }
  };

  if (isComfy) {
    const comfyBase = (state.config.comfyuiUrl || '').trim();
    const activeWf =
      state.config.activeComfyuiWorkflowId &&
      Array.isArray(state.config.comfyuiWorkflows)
        ? state.config.comfyuiWorkflows.find(
            (wf) => wf.id === state.config.activeComfyuiWorkflowId,
          )
        : undefined;
    const comfyWorkflow = (
      state.config.comfyuiWorkflowJson ||
      activeWf?.workflowJson ||
      ''
    ).trim();
    const portraitStyleId = String(state.storyImage?.stylePreset ?? '').toLowerCase();
    const antiMovieOverpowerNeg =
      !portraitStyleId ||
      portraitStyleId === 'live_action_cinema' ||
      portraitStyleId === 'cinema_still_vfx'
        ? ', cinematic movie still, anamorphic lens flare, heavy teal and orange color grading, dramatic movie set shadows'
        : '';
    const comfyNegativePrompt = mergeStoryImageNegativePrompt(
      state.config.comfyuiNegativePrompt || activeWf?.negativePrompt || '',
      `${buildHeadcountNegativeDirective(1)}, ${STORY_IMAGE_CLEAR_FACE_NEGATIVE_DIRECTIVE}${antiMovieOverpowerNeg}`,
    );
    const comfyNodeMapping =
      state.config.comfyuiNodeMapping &&
      Object.keys(state.config.comfyuiNodeMapping).length > 0
        ? state.config.comfyuiNodeMapping
        : activeWf?.nodeMapping;
    if (!comfyBase || !comfyWorkflow) {
      return {
        ok: false,
        prompt,
        error:
          'Chưa cấu hình đầy đủ ComfyUI Base URL và Workflow API JSON trong tab Cấu hình.',
      };
    }

    if (signal?.aborted) {
      return { ok: false, prompt, aborted: true, attemptsUsed: 1 };
    }

    // Single-shot ComfyUI execution: strictly 1 POST /prompt per click, NO automatic retry loop
    emitProgress(
      'generating',
      `Đang tạo ảnh qua ComfyUI${activeWf ? ` (${activeWf.name})` : ''}...`,
      1,
    );
    onLog?.(
      `[Ảnh NV · ComfyUI] Đang sinh 1 chân dung "${character.name}"${
        activeWf ? ` (${activeWf.name})` : ''
      } [timeout ${timeoutSec}s]...`,
    );
    const comfyRes = await requestComfyUiImage({
      baseUrlRaw: comfyBase,
      workflowJson: comfyWorkflow,
      prompt,
      negativePrompt: comfyNegativePrompt,
      size: sdSize,
      nodeMapping: comfyNodeMapping,
      signal,
      timeoutMs: effectiveTimeoutMs,
      logPrefix: '[Ảnh NV · ComfyUI]',
      onLog,
      onProgress: (label) => emitProgress('generating', label, 1),
    });

    if (comfyRes.aborted) {
      return { ok: false, prompt, aborted: true, attemptsUsed: 1 };
    }
    if (comfyRes.ok && comfyRes.imageUrl) {
      const finalImg = await finalizeAvatarImageUrl(comfyRes.imageUrl);
      onLog?.(
        `[Ảnh NV · ComfyUI] Đã tạo chân dung "${character.name}" thành công.`,
      );
      return {
        ok: true,
        imageUrl: finalImg,
        prompt,
        attemptsUsed: 1,
        ...(activeComparisonPatch
          ? { appliedComparisonPatch: activeComparisonPatch }
          : {}),
      };
    }

    const comfyError =
      comfyRes.error ||
      `Không thể sinh ảnh cho "${character.name}" qua ComfyUI.`;
    const comfyTimedOut = Boolean(comfyRes.timedOut);

    return {
      ok: false,
      prompt,
      timedOut: comfyTimedOut,
      attemptsUsed: 1,
      error: comfyTimedOut
        ? `ComfyUI quá thời gian chờ (${timeoutSec}s). Hãy kiểm tra máy chủ ComfyUI hoặc giảm steps/độ phân giải rồi thử lại.`
        : comfyError,
    };
  }

  if (isCustomImage) {
    const customUrl = (state.config.customImageUrl || '').trim();
    if (!customUrl) {
      return {
        ok: false,
        prompt,
        error:
          'Chưa cấu hình Custom Image Endpoint URL. Hãy vào tab Cấu hình để nhập Endpoint tạo ảnh.',
      };
    }

    const customModel = (state.config.customImageModel || '').trim();
    const portraitStyleId = String(state.storyImage?.stylePreset ?? '').toLowerCase();
    const antiMovieOverpowerNeg =
      !portraitStyleId ||
      portraitStyleId === 'live_action_cinema' ||
      portraitStyleId === 'cinema_still_vfx'
        ? ', cinematic movie still, anamorphic lens flare, heavy teal and orange color grading, dramatic movie set shadows'
        : '';
    const customNegativePrompt = mergeStoryImageNegativePrompt(
      state.config.customImageNegativePrompt || '',
      `${buildHeadcountNegativeDirective(1)}, ${STORY_IMAGE_CLEAR_FACE_NEGATIVE_DIRECTIVE}${antiMovieOverpowerNeg}`,
    );

    emitProgress(
      'generating',
      `Đang gọi Custom Image API${customModel ? ` (${customModel})` : ''}...`,
      1,
    );
    onLog?.(
      `[Ảnh NV · Custom Image API] Đang sinh chân dung "${character.name}" [timeout ${timeoutSec}s, ${prompt.length} ký tự]...`,
    );

    const customRes = await requestCustomImage({
      endpointRaw: customUrl,
      apiKey: state.config.customImageApiKey || '',
      authHeader: state.config.customImageAuthHeader || 'Authorization',
      model: customModel,
      formatMode: state.config.customImageFormatMode || 'openai',
      jsonTemplate:
        state.config.customImageJsonTemplate || DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE,
      prompt,
      negativePrompt: customNegativePrompt,
      size: sdSize,
      signal,
      timeoutMs: effectiveTimeoutMs,
      useServerProxy: state.config.customImageUseServerProxy !== false,
      logPrefix: '[Ảnh NV · Custom Image API]',
      onLog,
      onProgress: (label) => emitProgress('generating', label, 1),
    });

    if (customRes.aborted) {
      return { ok: false, prompt, aborted: true, attemptsUsed: 1 };
    }
    if (customRes.ok && customRes.imageUrl) {
      const finalImg = await finalizeAvatarImageUrl(customRes.imageUrl);
      onLog?.(
        `[Ảnh NV · Custom Image API] Đã tạo chân dung "${character.name}" thành công.`,
      );
      return {
        ok: true,
        imageUrl: finalImg,
        prompt,
        attemptsUsed: 1,
        ...(activeComparisonPatch
          ? { appliedComparisonPatch: activeComparisonPatch }
          : {}),
      };
    }

    return {
      ok: false,
      prompt,
      timedOut: Boolean(customRes.timedOut),
      attemptsUsed: 1,
      error: customRes.timedOut
        ? `Custom Image API quá thời gian chờ (${timeoutSec}s). Hãy kiểm tra Endpoint hoặc thử lại.`
        : customRes.error ||
          `Không thể sinh ảnh cho "${character.name}" từ Custom Image Endpoint.`,
    };
  }

  if (isLatentImage) {
    const latentKey = (state.config.latentApiKey || '').trim();
    if (!latentKey) {
      return {
        ok: false,
        prompt,
        error:
          'Chưa nhập Latent API Key (lat_sk_...). Hãy vào tab Cấu hình → Họa Đồ AI · Latent.moe để nhập Key.',
      };
    }

    const latentModel =
      (state.config.latentModel || '').trim() || DEFAULT_LATENT_MODEL;
    const portraitNegExtra = `${buildHeadcountNegativeDirective(1)}, ${STORY_IMAGE_CLEAR_FACE_NEGATIVE_DIRECTIVE}`;

    emitProgress(
      'generating',
      `Đang gọi Latent.moe (${latentModel})...`,
      1,
    );
    onLog?.(
      `[Ảnh NV · Latent.moe] Đang sinh chân dung "${character.name}" (${latentModel} · ${sdSize}, timeout ${timeoutSec}s)...`,
    );

    const latentRes = await requestLatentImage({
      endpointRaw: state.config.latentUrl || DEFAULT_LATENT_ENDPOINT,
      apiKey: latentKey,
      model: latentModel,
      prompt,
      positivePrefix:
        state.config.latentPositivePrefix ?? DEFAULT_LATENT_POSITIVE_PREFIX,
      negativePrompt:
        state.config.latentNegativePrompt ?? DEFAULT_LATENT_NEGATIVE_PROMPT,
      extraNegativePrompt: portraitNegExtra,
      size: sdSize,
      steps: state.config.latentSteps,
      scale: state.config.latentScale,
      sampler: state.config.latentSampler,
      noiseSchedule: state.config.latentNoiseSchedule,
      ucPreset: state.config.latentUcPreset,
      qualityToggle: state.config.latentQualityToggle,
      signal,
      timeoutMs: effectiveTimeoutMs,
      useServerProxy: state.config.latentUseServerProxy === true,
      logPrefix: '[Ảnh NV · Latent.moe]',
      onLog,
      onProgress: (label) => emitProgress('generating', label, 1),
    });

    if (latentRes.aborted) {
      return { ok: false, prompt, aborted: true, attemptsUsed: 1 };
    }
    if (latentRes.ok && latentRes.imageUrl) {
      const finalImg = await finalizeAvatarImageUrl(latentRes.imageUrl);
      onLog?.(
        `[Ảnh NV · Latent.moe] Đã tạo chân dung "${character.name}" thành công.`,
      );
      return {
        ok: true,
        imageUrl: finalImg,
        prompt,
        attemptsUsed: 1,
        ...(activeComparisonPatch
          ? { appliedComparisonPatch: activeComparisonPatch }
          : {}),
      };
    }

    return {
      ok: false,
      prompt,
      timedOut: Boolean(latentRes.timedOut),
      attemptsUsed: 1,
      error: latentRes.timedOut
        ? `Latent.moe quá thời gian chờ (${timeoutSec}s). Hãy thử lại sau.`
        : latentRes.error ||
          `Không thể sinh ảnh cho "${character.name}" từ Latent.moe.`,
    };
  }

  const dedicatedSeedreamUrl = (state.config.seedreamUrl || '').trim();
  const endpointRaw = (
    dedicatedSeedreamUrl ||
    state.config.proxyUrl ||
    ''
  ).trim();
  const usingProxyFallback = !dedicatedSeedreamUrl && Boolean(endpointRaw);
  const apiKey = (
    state.config.seedreamApiKey ||
    state.config.proxyKey ||
    ''
  ).trim();
  const sdModel = (state.config.seedreamModel || '').trim() || 'seedream-5.0-pro';

  if (!endpointRaw) {
    return {
      ok: false,
      prompt,
      error:
        'Chưa cấu hình Seedream 5 Pro Endpoint. Hãy vào tab Cấu hình để nhập Endpoint tạo ảnh.',
    };
  }

  let lastError = '';
  let lastTimedOut = false;
  let activePromptForAttempt = prompt;
  let lastAttemptTimeoutSec = timeoutSec;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      return { ok: false, prompt: activePromptForAttempt, aborted: true, attemptsUsed: attempt };
    }
    const attemptStartedAt = Date.now();
    const attemptTimeoutMs = Math.max(15_000, effectiveTimeoutMs);
    const attemptTimeoutSec = Math.max(15, Math.round(attemptTimeoutMs / 1000));
    lastAttemptTimeoutSec = attemptTimeoutSec;

    if (attempt > 1) {
      // Keep full character/celebrity name intact while condensing an overly long prompt on retry
      const compactPrompt = buildCompactSafeRetryPrompt();
      if (compactPrompt) {
        activePromptForAttempt = compactPrompt;
      }
      emitProgress(
        'retrying',
        `Lần ${attempt}/${maxAttempts}: thử lại với prompt chân dung cô đọng hơn...`,
        attempt,
        attemptTimeoutSec,
        attemptStartedAt,
      );
      onLog?.(
        `[Ảnh NV] Lần ${attempt - 1} bị ${lastTimedOut ? 'timeout' : 'lỗi'} — thử lại với prompt cô đọng (${activePromptForAttempt.length} ký tự) cho "${character.name}"...`,
      );
      const waited = await sleepWithAbortSignal(700, signal);
      if (!waited || signal?.aborted) {
        return { ok: false, prompt: activePromptForAttempt, aborted: true, attemptsUsed: attempt };
      }
    }

    emitProgress(
      'generating',
      attempt > 1
        ? `Đang vẽ lại qua Seedream (${sdModel})...`
        : `Đang gọi Seedream (${sdModel}) tạo chân dung...`,
      attempt,
      attemptTimeoutSec,
      attemptStartedAt,
    );
    onLog?.(
      `[Ảnh NV] Đang sinh chân dung "${character.name}" với ${sdModel} [lần ${attempt}/${maxAttempts}, timeout ${attemptTimeoutSec}s, ${activePromptForAttempt.length} ký tự]...`,
    );
    const reqRes = await requestSeedreamImage({
      endpointRaw,
      apiKey,
      model: sdModel,
      prompt: activePromptForAttempt,
      size: sdSize,
      signal,
      timeoutMs: attemptTimeoutMs,
      usingProxyFallback,
      useServerProxy: shouldUseServerProxy(state.config),
      logPrefix: '[Ảnh NV]',
      onLog,
      onProgress: (label) =>
        emitProgress(
          'generating',
          label,
          attempt,
          attemptTimeoutSec,
          attemptStartedAt,
        ),
    });

    if (reqRes.aborted) {
      return { ok: false, prompt: activePromptForAttempt, aborted: true, attemptsUsed: attempt };
    }
    if (reqRes.ok && reqRes.imageUrl) {
      const finalImg = await finalizeAvatarImageUrl(reqRes.imageUrl);
      onLog?.(
        `[Ảnh NV] Đã tạo chân dung "${character.name}" thành công.`,
      );
      return {
        ok: true,
        imageUrl: finalImg,
        prompt: activePromptForAttempt,
        attemptsUsed: attempt,
        ...(activeComparisonPatch
          ? { appliedComparisonPatch: activeComparisonPatch }
          : {}),
      };
    }

    lastError =
      reqRes.error ||
      `Không thể sinh ảnh cho "${character.name}". Hãy kiểm tra cấu hình Seedream 5 Pro.`;
    lastTimedOut = Boolean(reqRes.timedOut);

    if (
      attempt < maxAttempts &&
      isTransientRetryableError(lastError, lastTimedOut)
    ) {
      continue;
    }
    break;
  }

  return {
    ok: false,
    prompt: activePromptForAttempt,
    timedOut: lastTimedOut,
    attemptsUsed: maxAttempts,
    error: lastTimedOut
      ? `Seedream quá thời gian chờ (${lastAttemptTimeoutSec}s${maxAttempts > 1 ? ` · đã thử ${maxAttempts} lần` : ''}). Máy chủ ảnh hiện có thể đang chậm — hãy thử lại sau ít giây hoặc kiểm tra Nhật ký Proxy trong Cấu hình.`
      : lastError,
  };
}

export interface AppearanceEnrichmentTarget {
  id: string;
  name: string;
  isMc: boolean;
  role: string;
  currentAge?: string;
  currentBirthday?: string;
  currentFashionStyle?: string;
  currentAppearance?: string;
  currentPersonality?: string;
  currentRelationships?: string;
  currentSignature?: string;
  sceneContext?: string;
}

export interface VividNpcProfileEnrichment {
  role?: string;
  age?: string;
  birthday?: string;
  fashionStyle?: string;
  personality?: string;
  appearance?: string;
  relationships?: string;
  signature?: string;
  poseExpression?: string;
}

export async function enrichVividNpcProfilesWithAi(options: {
  state: ArkState;
  targets: AppearanceEnrichmentTarget[];
  cleanStoryText?: string;
  cleanUserText?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  results: Record<string, VividNpcProfileEnrichment>;
  error?: string;
}> {
  const {
    state,
    targets,
    cleanStoryText,
    cleanUserText,
    signal,
    timeoutMs,
    onLog,
  } = options;
  if (!targets.length) return { ok: true, results: {} };

  if (!(state.config?.proxyUrl || '').trim()) {
    return {
      ok: false,
      results: {},
      error: 'Chưa cấu hình Proxy API để làm sinh động hồ sơ nhân vật bằng AI.',
    };
  }

  const activeComp = getStoryBoundCompanionFromState(state);
  const allowedRosterForEnrich = buildAllowedRosterKeys(
    activeComp,
    state.player?.name,
  );
  const validTargets = targets.filter(
    (t) =>
      t.isMc ||
      !isInvalidNpcPortrait(
        {
          name: t.name,
          role: t.role,
          appearance: t.currentAppearance || '',
          personality: t.currentPersonality,
          contextSnippet: t.sceneContext,
          isMc: t.isMc,
        },
        allowedRosterForEnrich,
      ),
  );
  if (!validTargets.length) return { ok: true, results: {} };

  const limitedTargets = validTargets.slice(0, 10);

  const rawMcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    ''
  ).trim();
  const cleanExcerpt = cleanStoryText
    ? trimToCleanSentence(
        stripNonSceneChatBlocks(stripStoryPlanningAndMeta(cleanStoryText)),
        2000,
      )
    : '';
  const cleanUser = cleanUserText
    ? stripStoryPlanningAndMeta(cleanUserText)
    : '';
  const mcPresent = isMcPresentInTurn(
    cleanStoryText ? stripStoryPlanningAndMeta(cleanStoryText) : '',
    cleanUser,
    rawMcName,
    activeComp?.mc?.pronoun,
  );

  const storyClock = normalizeStoryClock(state.memory?.storyClock);
  const formattedClock = formatStoryClock(storyClock);

  const rosterContextLines = limitedTargets.map((t, idx) => {
    const bits = [
      `${idx + 1}. ${t.name} (${t.isMc ? 'Nhân vật chính' : t.role || 'NPC'})`,
    ];
    if (t.currentAge?.trim()) {
      bits.push(`Tuổi hiện có: ${t.currentAge.trim().slice(0, 40)}`);
    }
    if (t.currentBirthday?.trim()) {
      bits.push(`Ngày sinh hiện có: ${t.currentBirthday.trim().slice(0, 40)}`);
    }
    if (t.currentFashionStyle?.trim()) {
      bits.push(`Style ăn mặc hiện có: ${t.currentFashionStyle.trim().slice(0, 150)}`);
    }
    if (t.currentPersonality?.trim()) {
      bits.push(`Tính cách hiện có: ${t.currentPersonality.trim().slice(0, 140)}`);
    }
    if (t.currentAppearance?.trim()) {
      bits.push(`Ngoại hình hiện có: ${t.currentAppearance.trim().slice(0, 160)}`);
    }
    if (t.currentRelationships?.trim()) {
      bits.push(`Quan hệ hiện có: ${t.currentRelationships.trim().slice(0, 140)}`);
    }
    if (t.currentSignature?.trim()) {
      bits.push(`Điểm nhấn hiện có: ${t.currentSignature.trim().slice(0, 120)}`);
    }
    if (t.sceneContext?.trim()) {
      bits.push(
        `Dáng & biểu cảm hiện có: ${t.sceneContext.trim().slice(0, 180)}`,
      );
    }
    return bits.join(' — ');
  });

  const worldHint = activeComp?.worldSetting
    ? trimToCleanSentence(activeComp.worldSetting, 240)
    : state.world?.name || '';

  const prompt = [
    'Bạn là biên tập viên hồ sơ nhân vật cho truyện nhập vai tiếng Việt và trợ lý thiết kế chân dung Seedream 5 Pro.',
    'Hãy làm sinh động hồ sơ cho từng nhân vật CON NGƯỜI hợp lệ dưới đây bằng TIẾNG VIỆT tự nhiên, giàu cá tính, gọn gàng và cụ thể (không viết khuôn mẫu sáo rỗng).',
    '',
    'Với MỖI nhân vật hợp lệ, trả về đầy đủ 9 trường súc tích:',
    '- "role": Vai trò / Nghề nghiệp & vị thế cụ thể (ngắn gọn).',
    `- "age": Tuổi tác khớp với mốc thời gian truyện hiện tại (${formattedClock.dateStr}, năm ${storyClock.year}) và hồ sơ nguyên tác/đời thực (VD: "28 tuổi" hoặc "khoảng 25 tuổi").`,
    '- "birthday": Ngày sinh chuẩn theo nhân vật/người nổi tiếng (VD: "04/06/1998") hoặc ngày tháng năm sinh/mốc sinh hợp lý với bối cảnh truyện.',
    '- "fashionStyle": Style ăn mặc đặc trưng & trang phục phù hợp thực tế (bám sát nghề nghiệp, vòng xã giao, bối cảnh truyện và gu thẩm mỹ thật; mô tả rõ kiểu áo quần, chất liệu, phụ kiện để Seedream vẽ chuẩn).',
    '- "personality": Tính cách & khí chất đặc trưng (cách nói chuyện, thói quen/phản ứng khi gặp tình huống bất ngờ hoặc căng thẳng, 1–2 câu rõ nét).',
    '- "appearance": Ngoại hình (vóc dáng, chiều cao, kiểu tóc, màu da/mắt, nét mặt/thần thái đúng độ tuổi; giàu chi tiết thị giác cho Seedream, 1–2 câu).',
    '- "relationships": Mối quan hệ & thái độ thực tế với các nhân vật liên quan (thân thiết, dè chừng, nể trọng, trêu chọc, đồng minh...).',
    '- "signature": Điểm nhấn riêng / Câu cửa miệng / Thói quen hoặc chi tiết đáng nhớ từ diễn biến truyện.',
    '- "poseExpression": 1 câu ngắn gọn duy nhất mô tả DÁNG NGƯỜI (tư thế đứng/ngồi/thả lỏng/nghiêng người...) và BIỂU CẢM riêng lẻ của chính nhân vật đó để vẽ chân dung đơn (VD: "Dáng ngồi tựa lưng thả lỏng, một tay cầm ly cà phê; biểu cảm mỉm cười nhẹ, ánh mắt điềm tĩnh."). TUYỆT ĐỐI KHÔNG chứa câu thoại, tin nhắn, hay tên/hành động của người khác.',
    '',
    'NGUYÊN TẮC BẮT BUỘC:',
    '1. CHỈ lập hồ sơ cho nhân vật CON NGƯỜI / thực thể nhân vật có sự hiện diện hoặc tương tác trực tiếp trong mạch truyện. BỎ QUA (không đưa vào mảng items) bất kỳ mục nào là công ty/tổ chức (SM, YG, JYP, HYBE...), địa điểm (Quán cà phê...), màu sắc, tên bài hát/tác phẩm, kênh giao tiếp ("nhóm chat", tin nhắn...), hoặc nghệ danh tách rời không phải nhân vật hiện diện trực tiếp. TUYỆT ĐỐI KHÔNG BAO GIỜ mô tả "nhóm chat" hay kênh tin nhắn như một NPC.',
    '2. Nếu là người nổi tiếng hoặc nhân vật nguyên tác quen thuộc (VD: Central Cee, MGK, Zac Bia, Kendall Jenner, Kim Kardashian, Kris Jenner, Jennie Kim, Leonardo DiCaprio, Finneas O\'Connell, Charli XCX...), hãy dùng đúng ngày sinh thật, tính chính xác tuổi theo năm hiện tại của truyện, và lồng ghép chính xác ngoại hình, gu ăn mặc thật cùng khí chất đời thực.',
    '3. TUYỆT ĐỐI CHỐNG LỐI MÒN "ĐIỀM TĨNH / CÓ ĐỊA VỊ = MẶC VEST / COM LÊ": Không bao giờ tự mặc định nhân vật trầm ổn, điềm tĩnh hay giàu có là mặc vest/com lê công sở! Style ăn mặc PHẢI phản ánh đúng nghề nghiệp/vai trò (rapper, ca sĩ, nghệ sĩ, doanh nhân trẻ, người mẫu, vận động viên, người đời thường...), vòng xã giao (thời trang, âm nhạc, nightlife, đường phố, giới tinh hoa hiện đại...) và trang phục họ thực sự mặc trong truyện.',
    mcPresent
      ? `4. Nhân vật chính (${rawMcName || 'NV chính'}) có xuất hiện trong đoạn truyện này — chỉ đề cập tương tác với NV chính nếu thực sự có diễn ra.`
      : `4. TUYỆT ĐỐI KHÔNG ÉP NHÂN VẬT CHÍNH VÀO HỒ SƠ: Nhân vật chính${rawMcName ? ` (${rawMcName})` : ''} KHÔNG CÓ MẶT / KHÔNG ĐƯỢC NHẮC TỚI trong bối cảnh truyện hiện tại. Không bịa ra mối quan hệ hay tương tác giữa các NPC này với Nhân vật chính! Ở mục "relationships", hãy mô tả thái độ/quan hệ của họ với các NPC khác hoặc vòng kết nối riêng của họ trong bối cảnh truyện.`,
    '5. Không viết câu trống rỗng như "Chưa có mô tả".',
    '',
    `Mốc thời gian hiện tại trong truyện: ${formattedClock.fullLabel} (Năm ${storyClock.year}).`,
    worldHint ? `Bối cảnh thế giới: ${worldHint}` : '',
    cleanExcerpt ? `Diễn biến truyện thực tế gần đây:\n"""\n${cleanExcerpt}\n"""` : '',
    `Danh sách nhân vật cần làm sinh động hồ sơ:\n${rosterContextLines.join('\n')}`,
    '',
    'Trả về DUY NHẤT JSON hợp lệ theo mẫu (không kèm giải thích hay markdown):',
    '{"items":[{"name":"Tên nhân vật","role":"Vai trò / Nghề nghiệp & vị thế","age":"Tuổi tác đúng mốc truyện","birthday":"DD/MM/YYYY hoặc mốc sinh","fashionStyle":"Gu thời trang & trang phục thực tế đúng nghề nghiệp/bối cảnh","personality":"Tính cách & khí chất đặc trưng","appearance":"Ngoại hình đúng tuổi giàu chi tiết thị giác","relationships":"Mối quan hệ & thái độ thực tế","signature":"Điểm nhấn / Thói quen / Chi tiết đáng nhớ","poseExpression":"Dáng ...; biểu cảm ... (chỉ riêng nhân vật này, không hội thoại, không tên người khác)"}]}',
  ]
    .filter(Boolean)
    .join('\n');

  const npcModelInfo = resolveModelForTask(state.config, 'utility');
  onLog?.(
    `[Hồ sơ NPC · ${npcModelInfo.model}] Đang làm sinh động hồ sơ bằng AI cho ${limitedTargets.length} nhân vật...`,
  );

  try {
    const raw = await callAiJsonOrText(state, prompt, {
      maxTokens: 3200,
      signal,
      timeoutMs: timeoutMs ?? 35_000,
      taskSlot: 'utility',
      logPrefix: '[Hồ sơ NPC]',
      onLog,
    });
    if (!raw || !raw.trim()) {
      return {
        ok: false,
        results: {},
        error: 'AI không trả về dữ liệu hồ sơ nhân vật.',
      };
    }

    const stripped = String(raw ?? '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    const jsonSlice =
      firstBrace >= 0 && lastBrace > firstBrace
        ? stripped.slice(firstBrace, lastBrace + 1)
        : stripped;

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
    } catch {
      const repaired = repairTruncatedJson(jsonSlice);
      if (repaired) {
        parsed = JSON.parse(repaired) as Record<string, unknown>;
      }
    }

    const rawItems = Array.isArray(parsed?.items)
      ? parsed.items
      : Array.isArray(parsed?.appearances)
        ? parsed.appearances
        : Array.isArray(parsed)
          ? (parsed as unknown[])
          : [];

    const cleanField = (
      field:
        | 'role'
        | 'appearance'
        | 'personality'
        | 'fashionStyle'
        | 'relationships'
        | 'signature'
        | 'age'
        | 'birthday',
      val: unknown,
      maxLen: number,
    ): string => {
      const s = String(val || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!s || /^chưa\s+có/i.test(s) || /^không\s+rõ/i.test(s)) return '';
      if (field !== 'age' && field !== 'birthday') {
        const sanitized = sanitizeNpcFieldText(field, s);
        if (!sanitized) return '';
        return trimToCleanSentence(sanitized, maxLen);
      }
      return trimToCleanSentence(s, maxLen);
    };

    const results: Record<string, VividNpcProfileEnrichment> = {};
    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const rawName = String(rec.name || '').trim();
      if (!rawName) continue;
      const matchedTarget = limitedTargets.find(
        (t) => normalizeCharacterKey(t.name) === normalizeCharacterKey(rawName),
      );
      const validName = matchedTarget?.isMc
        ? matchedTarget.name
        : sanitizeCharacterName(rawName, allowedRosterForEnrich);
      if (!validName) continue;

      const role = cleanField('role', rec.role, 80);
      const birthday = cleanField('birthday', rec.birthday, 40);
      const rawAge = cleanField('age', rec.age, 40);
      const age = rawAge || computeAgeFromBirthday(birthday, storyClock);
      const fashionStyle = cleanField('fashionStyle', rec.fashionStyle, 240);
      const personality = cleanField('personality', rec.personality, 260);
      const appearance = cleanField('appearance', rec.appearance, 300);
      const relationships = cleanField('relationships', rec.relationships, 240);
      const signature = cleanField('signature', rec.signature, 220);
      const rawPoseExpr = String(rec.poseExpression || '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const poseExpression = rawPoseExpr
        ? isSoloPoseExpressionSnippet(rawPoseExpr)
          ? trimToCleanSentence(rawPoseExpr, 180)
          : extractSoloPoseAndExpression(rawPoseExpr, validName, {
              role,
              personality,
              signature,
              appearance,
              isMc: matchedTarget?.isMc,
              allowProfileFallback: true,
            })
        : '';

      if (
        isChatOrNonPersonDescription(String(rec.role || '')) ||
        isChatOrNonPersonDescription(String(rec.appearance || ''))
      ) {
        continue;
      }

      if (
        !appearance &&
        !personality &&
        !relationships &&
        !signature &&
        !age &&
        !birthday &&
        !fashionStyle &&
        !poseExpression
      ) {
        continue;
      }
      const key = normalizeCharacterKey(validName);
      if (key) {
        results[key] = {
          ...(role ? { role } : {}),
          ...(age ? { age } : {}),
          ...(birthday ? { birthday } : {}),
          ...(fashionStyle ? { fashionStyle } : {}),
          ...(personality ? { personality } : {}),
          ...(appearance ? { appearance } : {}),
          ...(relationships ? { relationships } : {}),
          ...(signature ? { signature } : {}),
          ...(poseExpression ? { poseExpression } : {}),
        };
      }
    }

    onLog?.(
      `[Hồ sơ NPC] Đã làm sinh động thành công ${Object.keys(results).length}/${limitedTargets.length} hồ sơ nhân vật.`,
    );
    return { ok: true, results };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onLog?.(`[Hồ sơ NPC] Lỗi tổng hợp AI: ${msg}`);
    return { ok: false, results: {}, error: msg };
  }
}

export async function enrichCharacterAppearancesWithAi(options: {
  state: ArkState;
  targets: AppearanceEnrichmentTarget[];
  cleanStoryText?: string;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  results: Record<string, { appearance: string; role?: string }>;
  error?: string;
}> {
  const res = await enrichVividNpcProfilesWithAi(options);
  const mapped: Record<string, { appearance: string; role?: string }> = {};
  for (const [k, v] of Object.entries(res.results)) {
    if (v.appearance) {
      mapped[k] = {
        appearance: v.appearance,
        ...(v.role ? { role: v.role } : {}),
      };
    }
  }
  return { ok: res.ok, results: mapped, error: res.error };
}

// Wikipedia & Fanfic Deep Lookup helpers
function normalizeSearchText(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreWikiHit(
  hit: { title?: string; snippet?: string },
  query: string,
): number {
  const rawTitle = String(hit?.title || '').toLowerCase().trim();
  const rawSnippet = String(hit?.snippet || '')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();
  const title = normalizeSearchText(rawTitle);
  const snippet = normalizeSearchText(rawSnippet);
  const cleanQ = normalizeSearchText(query);

  const qTokens = cleanQ
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (!cleanQ || !title || !qTokens.length) return -200;

  const genericTokens = new Set([
    'tien',
    'tu',
    'truyen',
    'tieu',
    'thuyet',
    'novel',
    'web',
    'book',
    'phim',
    'dong',
    'nhan',
    'the',
    'gioi',
    'dai',
    'chi',
    'ky',
    'luc',
  ]);

  const queryWantsPerson =
    /\b(dien vien|ca si|nhac si|rapper|hoa hau|nguoi mau|nhan vat lich su|nha van|tac gia|actor|singer|model|author)\b/i.test(
      cleanQ,
    );
  const queryWantsWork =
    /\b(tieu thuyet|truyen|tien hiep|huyen huyen|kiem hiep|anime|manga|manhua|phim|game|tro choi|novel|xianxia|wuxia)\b/i.test(
      cleanQ,
    );

  const nonGenericTokens = qTokens.filter((t) => !genericTokens.has(t));
  const keyTokens = nonGenericTokens.length ? nonGenericTokens : qTokens;

  let matchedKeyCount = 0;
  let score = 0;

  if (title === cleanQ) {
    score += 80;
  } else if (title.includes(cleanQ) && cleanQ.length >= 4) {
    score += 45;
  }

  for (const tok of qTokens) {
    if (title.includes(tok)) {
      score += genericTokens.has(tok) ? 4 : 18;
    } else if (snippet.includes(tok)) {
      score += genericTokens.has(tok) ? 1 : 4;
    }
  }

  for (const kTok of keyTokens) {
    if (title.includes(kTok) || snippet.includes(kTok)) {
      matchedKeyCount += 1;
    }
  }

  const requiredKeyMatches =
    keyTokens.length >= 2 ? Math.ceil(keyTokens.length * 0.6) : 1;
  if (matchedKeyCount < requiredKeyMatches) {
    return -150;
  }

  const titleHasKey = keyTokens.some((kTok) => title.includes(kTok));
  if (!titleHasKey && keyTokens.length >= 2) {
    score -= 50;
  }

  const personOrOffTopicRegex =
    /\b(ca si|nhac si|rapper|dien vien|hoa hau|nguoi mau|beauty queen|singer|actor|actress|model|album|bai hat|single|rap|kpop|vpop|bong da|cau thu|chinh tri|hoang de|nha su|thien su|phat hoang|tinh|huyen|xa|quoc gia|dan toc)\b/i;

  if (!queryWantsPerson && personOrOffTopicRegex.test(`${title} ${snippet}`)) {
    const hasExplicitWorkWordInTitle =
      /\b(tieu thuyet|truyen|tien hiep|huyen huyen|kiem hiep|phim|game|tro choi|novel|series|film)\b/i.test(
        title,
      );
    if (!hasExplicitWorkWordInTitle) {
      score -= 90;
    }
  }

  if (
    /\b(tieu thuyet|truyen|tien hiep|huyen huyen|kiem hiep|novel|web novel|xianxia|wuxia|anime|manga|manhua)\b/i.test(
      `${title} ${snippet}`,
    )
  ) {
    score += queryWantsWork ? 25 : 15;
  }

  return score;
}

export async function fetchWebSourcesForWork(query: string): Promise<string> {
  const cleanQuery = String(query || '').trim();
  const collected: string[] = [];
  const searchVariants = [cleanQuery];
  if (!/tiểu thuyết|truyện|tiên hiệp|huyền huyễn|kiếm hiệp/i.test(cleanQuery)) {
    searchVariants.push(`${cleanQuery} tiểu thuyết`);
  }

  const wikiDomains = ['vi.wikipedia.org', 'en.wikipedia.org'];
  for (const host of wikiDomains) {
    for (const qStr of searchVariants) {
      try {
        const sUrl = `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          qStr,
        )}&utf8=1&format=json&origin=*`;
        const sRes = await fetch(sUrl);
        if (!sRes.ok) continue;
        const sJson = await sRes.json();
        const rawHits = Array.isArray(sJson?.query?.search)
          ? sJson.query.search
          : [];
        const ranked = rawHits
          .map((h: { title?: string; snippet?: string }) => ({
            h,
            score: scoreWikiHit(h, cleanQuery),
          }))
          .filter((item: { score: number }) => item.score >= 22)
          .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
          .slice(0, 2);

        for (const item of ranked) {
          const h = item.h;
          if (!h?.title) continue;
          const marker = `[Nguồn Wikipedia (${host}) - ${h.title}]`;
          if (collected.some((c) => c.startsWith(marker))) continue;
          const sumUrl = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(
            h.title,
          )}`;
          const pRes = await fetch(sumUrl);
          if (pRes.ok) {
            const pJson = await pRes.json();
            if (pJson?.extract) {
              collected.push(`${marker}\n${pJson.extract}`);
            }
          }
        }
        if (collected.length >= 2) break;
      } catch {
        // Continue to next source
      }
    }
  }

  return collected.join('\n\n').trim();
}

export async function runTimedLookupWithProgress(
  state: ArkState,
  query: string,
  onProgress?: (elapsedSec: number, tick: number) => void,
): Promise<string> {
  const deadlineMs = 240000;
  const startTs = Date.now();
  let tick = 0;

  const progressTimer = setInterval(() => {
    tick += 1;
    const elapsedSec = Math.round((Date.now() - startTs) / 1000);
    onProgress?.(elapsedSec, tick);
  }, 2500);

  try {
    const wikiPromise = fetchWebSourcesForWork(query);
    const aiPromise = (state.config?.proxyUrl || '').trim()
      ? callAiJsonOrText(
          state,
          `Bạn là chuyên gia tra cứu & kiến trúc sư sáng tạo đồng nhân. Hãy tra cứu kỹ và trình bày chi tiết bằng tiếng Việt về tác phẩm / chủ đề: "${query}".\n` +
            'Chỉ tập trung đúng vào tác phẩm/chủ đề được hỏi (tuyệt đối không lôi người nổi tiếng, ca sĩ, diễn viên hay nhân vật lịch sử không liên quan).\n' +
            'Hãy nêu rõ:\n' +
            '1. Tổng quan tác phẩm gốc, tác giả, bối cảnh & các phe phái/xung đột cốt lõi\n' +
            '2. Hệ thống thiết lập, quy tắc sức mạnh, giới hạn & cái giá phải trả (kèm nguyên tắc giữ đúng tính cách nguyên tác In-Character & hậu quả nhân quả)\n' +
            '3. Các nhân vật chủ chốt: vai trò, tính cách cốt lõi, ĐỘNG CƠ RIÊNG, LẬP TRƯỜNG và ĐIỂM XUNG ĐỘT/MA SÁT TIỀM NĂNG (tránh nhân vật một chiều)\n' +
            '4. 1–2 ĐIỂM RẼ NHÁNH / BIẾN SỐ CÓ THỂ BẺ LÁI dựa trên các bước ngoặt lớn của nguyên tác và hiệu ứng dây chuyền có thể xảy ra.',
          {
            taskSlot: 'fanfic',
            logPrefix: '[Tra cứu ĐN]',
          },
        )
      : Promise.resolve(null);

    const raceWithTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);

    const [wikiText, aiText] = await Promise.all([
      raceWithTimeout(wikiPromise, Math.min(20000, deadlineMs)),
      raceWithTimeout(aiPromise, deadlineMs),
    ]);

    const parts: string[] = [];
    if (wikiText) parts.push(wikiText);
    if (aiText) parts.push(`[Nguồn phân tích AI chuyên sâu]\n${aiText}`);
    return parts.join('\n\n').trim();
  } finally {
    clearInterval(progressTimer);
  }
}

export interface AiGeneratedWorldSetup {
  worldName: string;
  genre: WorldGenreId;
  setting: string;
  rules: string;
  atmosphere: string;
  dramaLevel: DramaLevel;
  startClock: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    eraLabel: string;
  };
  mc: {
    name: string;
    pronoun: string;
    role: string;
    description: string;
    absentAtStart: boolean;
  };
  npcs: WorldSetupNpcDraft[];
  openingScenario: string;
}

const VALID_WORLD_GENRES = new Set<WorldGenreId>([
  'slice_of_life',
  'showbiz',
  'ancient',
  'xianxia',
  'xuanhuan',
  'apocalypse',
  'urban',
  'fantasy',
  'scifi',
]);

const VALID_DRAMA_LEVELS = new Set<DramaLevel>(['chill', 'balanced', 'intense']);

export const WORLD_SETUP_IDEA_MAX_CHARS = 12000;

export async function generateWorldSetupWithAi(options: {
  state: ArkState;
  idea: string;
  preferredGenre?: WorldGenreId;
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  data?: AiGeneratedWorldSetup;
  error?: string;
  modelUsed?: string;
}> {
  const { state, idea, preferredGenre, signal, onLog } = options;
  const cleanIdea = (idea || '').trim().slice(0, WORLD_SETUP_IDEA_MAX_CHARS);
  if (!cleanIdea) {
    return {
      ok: false,
      error: 'Hãy nhập ý tưởng hoặc mô tả thế giới trước khi bấm AI dựng thế giới.',
    };
  }
  if (!(state.config?.proxyUrl || '').trim()) {
    return {
      ok: false,
      error: 'Chưa cấu hình Proxy URL. Vào mục Cấu hình để thiết lập Proxy hoặc bấm "Điền mẫu".',
    };
  }

  const genreHintMap: Record<WorldGenreId, string> = {
    slice_of_life: 'Đời thường (slice_of_life)',
    showbiz: 'Giải trí & Showbiz (showbiz)',
    ancient: 'Cổ đại / Kiếm hiệp — giang hồ, môn phái, nội công, triều đình, cổ phong (ancient)',
    xianxia: 'Tiên Hiệp — tu tiên, cảnh giới, linh khí, tông môn, linh thú, đan dược/pháp bảo (xianxia)',
    xuanhuan: 'Huyền Huyễn — huyền khí/hồn lực/huyết mạch, gia tộc, bí cảnh, dị thú/thần thú, đa tầng (xuanhuan)',
    apocalypse: 'Mạt Thế — sinh tồn hậu tận thế, căn cứ/khu trú ẩn, khan hiếm tài nguyên, biến dị, phe phái (apocalypse)',
    urban: 'Hiện đại / Đô thị (urban)',
    fantasy: 'Kỳ ảo / Giả tưởng (fantasy)',
    scifi: 'Khoa học viễn tưởng (scifi)',
  };

  const isDetailedPrompt = cleanIdea.length >= 260;

  const systemPrompt =
    'Bạn là kiến trúc sư thế giới (Worldbuilder) bậc thầy cho game truyện nhập vai tiếng Việt. ' +
    'Khi người chơi nhập ý tưởng ngắn, hãy sáng tạo mở rộng thành thế giới sống động, có chiều sâu. ' +
    'Khi người chơi dán thiết lập thế giới CHI TIẾT (nhiều mốc/dòng thời gian, bản đồ địa lý, danh sách môn phái/thế lực, bảng cảnh giới/tôn hiệu, cơ chế chiến đấu, luật lệ vận hành hoặc xuất thân nhân vật chính), ' +
    'BẮT BUỘC PHẢI BẢO TOÀN ĐẦY ĐỦ MỌI CHI TIẾT QUAN TRỌNG vào các trường tương ứng (đặc biệt là "setting" và "rules"), tuyệt đối KHÔNG rút gọn qua loa thành tóm tắt chung chung và KHÔNG tự ý đổi xuất thân nhân vật chính trái với prompt. ' +
    'Chỉ trả về ĐÚNG MỘT đối tượng JSON hợp lệ bằng tiếng Việt, không viết lời giải thích hay markdown thừa bên ngoài JSON.';

  const isHanVietGenre =
    preferredGenre === 'xianxia' ||
    preferredGenre === 'xuanhuan' ||
    preferredGenre === 'ancient' ||
    /(?:tiên\s*hiệp|tu\s*tiên|huyền\s*huyễn|kiếm\s*hiệp|võ\s*hiệp|giang\s*hồ|cổ\s*đại|tông\s*môn|môn\s*phái|ma\s*đạo|cảnh\s*giới|linh\s*căn|nội\s*công)/i.test(
      cleanIdea,
    );

  const settingGuidance = isDetailedPrompt
    ? 'Bối cảnh chính đầy đủ & có cấu trúc rõ ràng (có thể xuống dòng bằng \\n): GIỮ TRỌN VẸN mọi dòng thời gian, niên đại, bản đồ địa lý, địa danh, các môn phái/thế lực/gia tộc và cục diện thế giới mà người chơi đã nêu, KHÔNG tự ý lược bỏ thành tóm tắt ngắn.'
    : 'Mô tả bối cảnh chính giàu hình ảnh, không gian, địa danh, thế lực và bối cảnh xã hội (4-7 câu chi tiết).';

  const rulesGuidance = isDetailedPrompt
    ? 'Luật lệ, hệ thống & quy tắc vận hành đầy đủ (có thể xuống dòng bằng \\n): BẢO TOÀN ĐẦY ĐỦ hệ thống cảnh giới/tôn hiệu, nội công/tu luyện, cơ chế chiến đấu, quy tắc môn phái, đời sống giang hồ/xã hội, ân oán/truy nã hoặc giới hạn sức mạnh mà người chơi đã cung cấp.'
    : 'Luật lệ, chuẩn mực vận hành thế giới (ngành nghề, lễ giáo, hệ thống cảnh giới/nội công, quy luật sinh tồn, ma pháp hoặc công nghệ - 3-6 câu rõ ràng).';

  const promptText =
    `=== Ý TƯỞNG / THIẾT LẬP THẾ GIỚI TỪ NGƯỜI CHƠI ===\n${cleanIdea}\n=== HẾT THIẾT LẬP ===\n` +
    (preferredGenre
      ? `Thể loại đang chọn gợi ý: ${genreHintMap[preferredGenre]} (nếu thiết lập trên rõ ràng thuộc thể loại khác thì chọn mã genre khớp nhất với thiết lập).\n`
      : '') +
    '\nHãy trả về JSON đúng cấu trúc sau:\n' +
    '{\n' +
    '  "worldName": "Tên thế giới / phiên chơi gợi cảm hứng, bám sát tên gọi trong thiết lập nếu có",\n' +
    '  "genre": "slice_of_life | showbiz | ancient | xianxia | xuanhuan | apocalypse | urban | fantasy | scifi",\n' +
    `  "setting": "${settingGuidance}",\n` +
    `  "rules": "${rulesGuidance}",\n` +
    '  "atmosphere": "Không khí, ánh sáng và tông màu chủ đạo (1-3 câu giàu sắc thái)",\n' +
    '  "dramaLevel": "chill | balanced | intense",\n' +
    '  "startClock": {\n' +
    '    "year": 2025,\n' +
    '    "month": 6,\n' +
    '    "day": 15,\n' +
    '    "hour": 20,\n' +
    '    "minute": 30,\n' +
    '    "eraLabel": "Để rỗng nếu là hiện đại/đời thường/showbiz; nếu là cổ đại/kiếm hiệp/tiên hiệp/huyền huyễn/mạt thế/kỳ ảo/viễn tưởng thì điền đúng niên đại, triều đại, kỷ nguyên hoặc mốc thời gian nêu trong prompt (VD: Gia Tĩnh năm thứ 18 · Giờ Mão | Thái Huyền Lịch năm 3420 | Ngày thứ 142 sau Đại Biến)"\n' +
    '  },\n' +
    '  "mc": {\n' +
    '    "name": "Tên nhân vật chính đúng theo thiết lập nếu người chơi có nêu; nếu chưa nêu thì đặt tên mới tự nhiên hợp bối cảnh",\n' +
    '    "pronoun": "tôi | anh | cô | ta | mình",\n' +
    '    "role": "Vai trò / xuất thân / môn phái / chức nghiệp ban đầu BÁM SÁT ĐÚNG gợi ý trong thiết lập (KHÔNG tự mặc định thành tán tu mang thân thế ẩn giấu)",\n' +
    '    "description": "Mô tả tính cách, ngoại hình, nền tảng tu luyện/võ học hoặc hoàn cảnh hiện tại khớp đúng với thiết lập (2-4 câu)",\n' +
    '    "absentAtStart": false\n' +
    '  },\n' +
    '  "npcs": [\n' +
    '    {\n' +
    '      "name": "Tên nhân vật riêng thật tự nhiên, mới mẻ, bám sát đúng thế giới người chơi nhập",\n' +
    '      "role": "Vai trò / môn phái / nghề nghiệp cụ thể trong thế giới này",\n' +
    '      "personality": "Tính cách, khẩu khí & lập trường riêng ngắn gọn",\n' +
    '      "appearance": "Ngoại hình & phục sức đặc trưng khớp bối cảnh",\n' +
    '      "initialLocation": "Địa danh cụ thể trong cảnh mở màn",\n' +
    '      "initialMood": "Tâm trạng ban đầu (1-3 từ)"\n' +
    '    }\n' +
    '  ],\n' +
    '  "openingScenario": "Tình huống mở màn giàu không khí, bám chặt địa danh, xuất thân nhân vật chính và xung đột thế giới (3-5 câu) sẵn sàng bắt đầu lượt truyện đầu tiên"\n' +
    '}\n\n' +
    'Yêu cầu bắt buộc:\n' +
    '1) GIỮ TRỌN CHI TIẾT: Nếu người chơi cung cấp nhiều dòng thời gian, bản đồ địa lý, danh sách môn phái/thế lực, bảng cảnh giới/tôn hiệu hoặc luật chơi chi tiết, PHẢI bảo toàn đầy đủ các mục đó vào "setting" và "rules" theo bố cục mạch lạc — KHÔNG rút gọn thành đoạn chung chung.\n' +
    '2) ĐÚNG XUẤT THÂN NHÂN VẬT CHÍNH: Nếu thiết lập có gợi ý xuất thân, môn phái, chức nghiệp hoặc bối cảnh của nhân vật chính thì điền đúng theo đó; TUYỆT ĐỐI KHÔNG tự ý áp khuôn sáo rập khuôn như "tán tu mang thân thế ẩn giấu" hay "kẻ mất trí nhớ mang huyết mạch bí ẩn" khi thiết lập không đề cập.\n' +
    '3) NPC KHỞI ĐẦU ĐA DẠNG & SÁT THẾ GIỚI: Tạo 3–4 NPC khởi đầu là nhân vật CON NGƯỜI độc lập có cá tính tương phản, thuộc đúng địa phương/môn phái/tổ chức của thế giới người chơi nhập (tuyệt đối KHÔNG đặt tên NPC là công ty/môn phái/tổ chức, địa điểm, màu sắc, bí kíp, công pháp, vật phẩm hay "nhóm chat"). TRÁNH tuyệt đối các tên sáo mòn lặp đi lặp lại như Liễu Như Yên, Lâm Thanh, Diệp Phàm, Tiêu Viêm.\n' +
    (isHanVietGenre
      ? `4) ${CULTIVATION_CHARACTER_NAMING_GUIDELINE}\n`
      : '4) Đặt tên MC và các NPC tự nhiên, dễ nhớ, đa dạng, không trùng tên hay lặp dày cùng một chữ lót/tên chính trong cùng lượt tạo.\n') +
    '5) Nếu thiết lập yêu cầu không có nhân vật chính hoặc chỉ quan sát dàn NPC, đặt "absentAtStart": true.\n' +
    '6) Mốc startClock phải có year/month/day/hour/minute hợp lệ (year 1..9999, month 1..12, day 1..28, hour 0..23, minute 0..59) và khớp mốc thời gian trong thiết lập.';

  const mainModel = (state.config?.model || '').trim() || DEFAULT_PROXY_MODEL;
  const maxTokens = isDetailedPrompt ? 8192 : 4096;
  const timeoutMs = isDetailedPrompt ? 120_000 : 75_000;

  try {
    // Route explicitly through the Main Story API (no utility/summary slot downgrade),
    // preserving full /v1 URL normalization, Server Proxy (/api/proxy), and Direct Fetch support.
    const aiRes = await callAiJsonOrTextDetailed(state, promptText, {
      systemPrompt,
      signal,
      onLog,
      maxTokens,
      timeoutMs,
      modelOverride: mainModel,
      logPrefix: '[Dựng TG · Main API]',
    });

    if (signal?.aborted || aiRes.errorKind === 'aborted') {
      return {
        ok: false,
        error: 'Đã hủy yêu cầu AI dựng thế giới.',
        modelUsed: aiRes.modelUsed,
      };
    }
    if (!aiRes.ok || !aiRes.text || !aiRes.text.trim()) {
      return {
        ok: false,
        error:
          aiRes.errorMessage ||
          'API chính văn không trả về nội dung. Kiểm tra lại cấu hình Proxy / Direct Fetch hoặc model.',
        modelUsed: aiRes.modelUsed,
      };
    }

    const parsed = parseAiJsonObject(aiRes.text);
    if (!parsed || typeof parsed !== 'object') {
      return {
        ok: false,
        error: `Model chính văn (${aiRes.modelUsed}) trả về định dạng chưa chuẩn JSON. Hãy thử bấm "AI dựng thế giới" lại.`,
        modelUsed: aiRes.modelUsed,
      };
    }

    const rawGenre = String(parsed.genre || preferredGenre || 'slice_of_life').trim() as WorldGenreId;
    const genre: WorldGenreId = VALID_WORLD_GENRES.has(rawGenre)
      ? rawGenre
      : preferredGenre || 'slice_of_life';

    const rawDrama = String(parsed.dramaLevel || 'balanced').trim() as DramaLevel;
    const dramaLevel: DramaLevel = VALID_DRAMA_LEVELS.has(rawDrama)
      ? rawDrama
      : 'balanced';

    const clk =
      parsed.startClock && typeof parsed.startClock === 'object'
        ? (parsed.startClock as Record<string, unknown>)
        : {};
    const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.trunc(n)));
    };
    const defaultYearByGenre: Record<WorldGenreId, number> = {
      slice_of_life: 2025,
      showbiz: 2025,
      ancient: 724,
      xianxia: 3420,
      xuanhuan: 2790,
      apocalypse: 2031,
      urban: 2025,
      fantasy: 1482,
      scifi: 2184,
    };
    const defaultYear = defaultYearByGenre[genre] ?? 2025;
    const year = clampInt(clk.year, 1, 9999, defaultYear);
    const month = clampInt(clk.month, 1, 12, 6);
    const day = clampInt(clk.day, 1, 28, 15);
    const hour = clampInt(clk.hour, 0, 23, 20);
    const minute = clampInt(clk.minute, 0, 59, 0);
    const eraLabel = typeof clk.eraLabel === 'string' ? clk.eraLabel.trim() : '';

    const mcRaw =
      parsed.mc && typeof parsed.mc === 'object'
        ? (parsed.mc as Record<string, unknown>)
        : {};

    const nowTs = Date.now();
    const rawNpcs = Array.isArray(parsed.npcs) ? parsed.npcs : [];
    const npcs: WorldSetupNpcDraft[] = rawNpcs
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx) => {
        const cleanName = sanitizeCharacterName(String(item.name || '')) || '';
        return {
          id: `setup_npc_${nowTs}_${idx}`,
          name: cleanName,
          role: sanitizeNpcFieldText('role', String(item.role || 'NPC').trim()) || 'NPC',
          personality: sanitizeNpcFieldText('personality', String(item.personality || '').trim()),
          appearance: sanitizeNpcFieldText('appearance', String(item.appearance || '').trim()),
          initialLocation: sanitizeNpcFieldText('location', String(item.initialLocation || '').trim()),
          initialMood: sanitizeNpcFieldText('mood', String(item.initialMood || '').trim()),
        };
      })
      .filter(
        (n) =>
          n.name.length >= 2 &&
          !isChatOrNonPersonDescription(n.role) &&
          !isChatOrNonPersonDescription(n.appearance),
      )
      .slice(0, 6);

    const firstIdeaLine =
      cleanIdea
        .split(/\r?\n/)
        .map((l) => l.replace(/^#+\s*/, '').trim())
        .find(Boolean)
        ?.slice(0, 56) || 'Thế giới mới';

    return {
      ok: true,
      modelUsed: aiRes.modelUsed,
      data: {
        worldName: String(parsed.worldName || firstIdeaLine).trim(),
        genre,
        setting: String(parsed.setting || '').trim(),
        rules: String(parsed.rules || '').trim(),
        atmosphere: String(parsed.atmosphere || '').trim(),
        dramaLevel,
        startClock: { year, month, day, hour, minute, eraLabel },
        mc: {
          name: String(mcRaw.name || '').trim(),
          pronoun: String(mcRaw.pronoun || '').trim(),
          role: String(mcRaw.role || '').trim(),
          description: String(mcRaw.description || '').trim(),
          absentAtStart: Boolean(mcRaw.absentAtStart),
        },
        npcs,
        openingScenario: String(parsed.openingScenario || '').trim(),
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Đã hủy yêu cầu AI dựng thế giới.' };
    }
    return {
      ok: false,
      error: `Lỗi khi gọi AI dựng thế giới: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

const GENERIC_CHARACTER_PLACEHOLDERS = new Set([
  'nhan vat',
  'nhan vat chinh',
  'nv chinh',
  'nvc',
  'mc',
  'npc',
  'nguoi choi',
  'player',
  'character',
  'protagonist',
  'doi phuong',
  'nguoi doi dien',
  'ai do',
  'vo danh',
  'chua ro',
  'user',
  'assistant',
  'system',
  'narrator',
  'nguoi ke chuyen',
  'ban',
  'khach moi',
  'moi nguoi',
  'dong nhan',
]);

const VALID_PERSONAL_PRONOUNS = new Set([
  'toi',
  'anh',
  'co',
  'em',
  'minh',
  'ta',
  'cau',
  'to',
  'chang',
  'nang',
  'han',
  'y',
  'co ay',
  'anh ay',
]);

export function isGenericCharacterPlaceholder(raw?: string): boolean {
  const key = normalizeCharacterKey(raw || '');
  if (!key || key.length < 2) return true;
  if (GENERIC_CHARACTER_PLACEHOLDERS.has(key)) return true;
  if (/^(?:nhan vat|nguoi choi|doi phuong|npc|mc)\b/.test(key)) return true;
  return false;
}

function resolveValidPersonalPronoun(raw?: string): string | null {
  const clean = (raw || '').trim();
  const key = normalizeCharacterKey(clean);
  if (!key || isGenericCharacterPlaceholder(clean)) return null;
  if (VALID_PERSONAL_PRONOUNS.has(key)) return clean;
  return null;
}

export interface ActiveSceneCharactersResult {
  presentNames: string[];
  actorName: string | null;
  targetName: string | null;
  secondaryTargetName: string | null;
  validPronoun: string | null;
  mcPresent: boolean;
}

function escapeNameRegex(s?: string | null): string {
  return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findNameOccurrenceInText(
  text: string,
  term: string,
): { lastIndex: number; count: number; matchedDisplay: string } {
  const clean = term.trim();
  if (!clean || clean.length < 2 || !text) {
    return { lastIndex: -1, count: 0, matchedDisplay: clean };
  }
  const isSingleWord = !/\s/.test(clean);
  const re = new RegExp(
    `(?<!\\p{L})${escapeNameRegex(clean)}(?!\\p{L})`,
    'giu',
  );
  let m: RegExpExecArray | null;
  let lastIndex = -1;
  let count = 0;
  let matchedDisplay = clean;
  while ((m = re.exec(text)) !== null) {
    if (isSingleWord && !/^[\p{Lu}]/u.test(m[0])) continue;
    count += 1;
    lastIndex = m.index;
    matchedDisplay = m[0].trim();
  }
  return { lastIndex, count, matchedDisplay };
}

const VIET_PROPER_SURNAME_SET = new Set([
  'nguyen',
  'tran',
  'le',
  'pham',
  'hoang',
  'huynh',
  'phan',
  'vu',
  'vo',
  'dang',
  'bui',
  'do',
  'ho',
  'ngo',
  'duong',
  'ly',
  'truong',
  'dinh',
  'lam',
  'dao',
  'doan',
  'vuong',
  'trinh',
  'cao',
  'thai',
  'luong',
  'ta',
  'mai',
  'chu',
  'la',
  'kieu',
  'phung',
  'bach',
  'han',
  'luc',
  'ton',
  'to',
  'mac',
]);

const NON_PERSON_PROPER_PHRASES = new Set([
  'beverly hills',
  'los angeles',
  'new york',
  'south korea',
  'viet nam',
  'ha noi',
  'sai gon',
  'saint laurent',
  'louis vuitton',
  'chrome hearts',
  'bottega veneta',
  'ralph lauren',
  'calvin klein',
  'tom ford',
  'van cleef',
  'rolls royce',
  'aston martin',
  'range rover',
  'mercedes benz',
  'chateau marmont',
  'soho house',
  'met gala',
  'fashion week',
  'paris fashion',
  'red carpet',
  'black pink',
  'the weeknd',
  'sunset boulevard',
  'rodeo drive',
  'hollywood hills',
  'santa monica',
  'malibu beach',
  'west hollywood',
  'central park',
  'times square',
  'gangnam gu',
  'cheongdam dong',
  'hannam dong',
]);

function extractInlineProperNamesFromProse(text: string): Array<{
  displayName: string;
  lastIndex: number;
  count: number;
  isVietPersonPattern: boolean;
}> {
  if (!text || text.length < 8) return [];
  const hits = new Map<
    string,
    {
      displayName: string;
      lastIndex: number;
      count: number;
      isVietPersonPattern: boolean;
    }
  >();
  // Match 2-3 capitalized words (Vietnamese / Western proper names)
  const multiWordRe =
    /(?<!\p{L})([\p{Lu}][\p{Ll}'’]{1,14}(?:\s+[\p{Lu}][\p{Ll}'’]{1,14}){1,2})(?!\p{L})/gu;
  const nonNameStartWords = new Set([
    'khong',
    'nhung',
    'trong',
    'giua',
    'duoi',
    'tren',
    'sau',
    'truoc',
    'khi',
    'luc',
    'ngay',
    'thang',
    'nam',
    'thu',
    'buoi',
    'dem',
    'sang',
    'trua',
    'chieu',
    'toi',
    'trang',
    'luot',
    'phong',
    'khach',
    'nha',
    'quan',
    'duong',
    'pho',
    'thanh',
    'bieu',
    'los',
    'new',
    'beverly',
    'hollywood',
    'london',
    'seoul',
    'paris',
    'tokyo',
    'saint',
    'louis',
    'chanel',
    'dior',
    'bottega',
    'gucci',
    'prada',
    'balenciaga',
    'hermes',
    'cartier',
    'tiffany',
    'vogue',
    'the',
    'mot',
    'hai',
    'ba',
    'roi',
    'van',
    'nhu',
    'hay',
    'neu',
    'mac',
    'chac',
    'co',
    'anh',
    'em',
    'nguoi',
    'tieng',
    'giong',
    'chateau',
    'hotel',
    'studio',
    'club',
    'bar',
    'villa',
    'penthouse',
    'sunset',
    'rodeo',
    'santa',
    'west',
    'east',
    'north',
    'south',
    'central',
    'grand',
    'royal',
    'golden',
    'silver',
    'white',
    'black',
    'red',
    'blue',
  ]);

  const sceneOnlyInput = stripQuotedMediaAndDialogue(
    stripNonSceneChatBlocks(text),
  );
  const textHasVietnamese = VIET_DIACRITIC_RE.test(sceneOnlyInput);
  const lines = sceneOnlyInput.split(/\r?\n/);
  let lineOffset = 0;

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    const curOffset = lineOffset;
    lineOffset += rawLine.length + 1;

    if (!trimmedLine || trimmedLine.length < 4) continue;
    // Skip markdown headings, standalone bold headings, bullet outlines, and English Title Case heading lines
    if (
      trimmedLine.startsWith('#') ||
      trimmedLine.startsWith('>') ||
      /^(?:\*\*|__)[^*\n]+(?:\*\*|__)\s*:?$/.test(trimmedLine) ||
      META_HEADER_LINE_RE.test(trimmedLine) ||
      COT_BOLD_OR_SECTION_HEADING_RE.test(trimmedLine) ||
      isEnglishTitleCaseHeadingLine(trimmedLine)
    ) {
      continue;
    }
    // In Vietnamese stories, ignore pure-English non-dialogue lines when discovering unknown inline names
    // (known Western celebrities & roster characters are already matched by Steps 1 & 2)
    if (
      textHasVietnamese &&
      !VIET_DIACRITIC_RE.test(trimmedLine) &&
      !/["“”«»]/.test(trimmedLine)
    ) {
      continue;
    }

    multiWordRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = multiWordRe.exec(rawLine)) !== null) {
      const rawCandidate = m[1].trim();
      const key = normalizeCharacterKey(rawCandidate);
      if (!key || isGenericCharacterPlaceholder(rawCandidate)) continue;
      if (NON_PERSON_PROPER_PHRASES.has(key)) continue;
      if (isEnglishHeadingOrMetaPhrase(rawCandidate)) continue;
      const keyParts = key.split(' ').filter(Boolean);
      const firstWord = keyParts[0] || '';
      if (nonNameStartWords.has(firstWord)) continue;
      const sanitized = sanitizeCharacterName(rawCandidate);
      if (
        !sanitized ||
        isGenericCharacterPlaceholder(sanitized) ||
        isEnglishHeadingOrMetaPhrase(sanitized)
      ) {
        continue;
      }
      const normSanitized = normalizeCharacterKey(sanitized);
      if (NON_PERSON_PROPER_PHRASES.has(normSanitized)) continue;
      const isVietPersonPattern =
        keyParts.length >= 2 &&
        keyParts.length <= 3 &&
        VIET_PROPER_SURNAME_SET.has(firstWord);
      const absIdx = curOffset + m.index;
      const prev = hits.get(normSanitized);
      if (prev) {
        prev.count += 1;
        prev.lastIndex = Math.max(prev.lastIndex, absIdx);
        prev.isVietPersonPattern =
          prev.isVietPersonPattern || isVietPersonPattern;
      } else {
        hits.set(normSanitized, {
          displayName: sanitized,
          lastIndex: absIdx,
          count: 1,
          isVietPersonPattern,
        });
      }
    }
  }

  return Array.from(hits.values()).filter((h) => h.count >= 1);
}

const LOCATION_STOP_WORDS = new Set([
  'tai',
  'trong',
  'ngoai',
  'ben',
  'gan',
  'canh',
  'khu',
  'noi',
  'cho',
  'cua',
  'phong',
  'nha',
  'tang',
  'goc',
  'the',
  'and',
  'with',
  'near',
]);

function extractLocationTokens(rawLoc?: string): string[] {
  const norm = normalizeCharacterKey(rawLoc || '');
  if (!norm) return [];
  return norm
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !LOCATION_STOP_WORDS.has(w));
}

function hasConflictingSceneLocation(
  candidateLoc: string | undefined,
  anchorLocations: string[],
): boolean {
  if (!candidateLoc || !anchorLocations.length) return false;
  const candTokens = extractLocationTokens(candidateLoc);
  if (!candTokens.length) return false;
  const candSet = new Set(candTokens);

  let comparedCount = 0;
  for (const anchor of anchorLocations) {
    const anchorTokens = extractLocationTokens(anchor);
    if (!anchorTokens.length) continue;
    comparedCount += 1;
    if (anchorTokens.some((t) => candSet.has(t))) {
      return false;
    }
  }
  return comparedCount > 0;
}

export function resolveActiveSceneCharacters(options: {
  currentUserText?: string;
  currentAiText?: string;
  recentTurns?: Turn[];
  mcName?: string;
  mcPronoun?: string;
  mcAbsentAtStart?: boolean;
  npcs?: CompanionNpc[];
  portraits?: CharacterPortrait[];
  characterStates?: CharacterStateSnapshot[];
  isolateUnconfirmedPortraits?: boolean;
}): ActiveSceneCharactersResult {
  const {
    currentUserText = '',
    currentAiText = '',
    recentTurns = [],
    mcName = '',
    mcPronoun = '',
    mcAbsentAtStart = false,
    npcs = [],
    portraits = [],
    characterStates = [],
    isolateUnconfirmedPortraits = false,
  } = options;

  const rawCleanUser = stripStoryPlanningAndMeta(currentUserText);
  const rawCleanAi = stripStoryPlanningAndMeta(currentAiText);
  // Strip simulated group-chat / messaging blocks & song lyrics so chat/lyric-only tokens never enter scene
  const cleanUser = stripNonSceneChatBlocks(rawCleanUser);
  const cleanAi = stripNonSceneChatBlocks(rawCleanAi);
  const currentCombined = `${cleanUser}\n${cleanAi}`.trim();
  const tailAi = cleanAi.slice(-1400);
  const recentSlice = recentTurns.slice(-2);
  const immediatePrevTurn = recentSlice.length
    ? recentSlice[recentSlice.length - 1]
    : null;
  const immediatePrevText = immediatePrevTurn
    ? stripNonSceneChatBlocks(
        [
          stripStoryPlanningAndMeta(immediatePrevTurn.user || ''),
          stripStoryPlanningAndMeta(immediatePrevTurn.assistant || ''),
        ]
          .filter(Boolean)
          .join('\n'),
      )
    : '';
  const recentText = recentSlice
    .map((t) =>
      stripNonSceneChatBlocks(
        [
          stripStoryPlanningAndMeta(t.user || ''),
          stripStoryPlanningAndMeta(t.assistant || ''),
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    )
    .filter(Boolean)
    .join('\n\n');

  const hasStoryContent =
    rawCleanUser.length > 0 ||
    rawCleanAi.length > 0 ||
    currentCombined.length > 0 ||
    recentText.length > 0;

  const realMcName = !isGenericCharacterPlaceholder(mcName)
    ? mcName.trim()
    : null;
  const mcKey = realMcName ? normalizeCharacterKey(realMcName) : '';
  const validPronoun = resolveValidPersonalPronoun(mcPronoun);

  // When isolateUnconfirmedPortraits is active (all story-generation callers), keep auto-scanned
  // Portrait Bank entries isolated so unverified/junk scans NEVER leak into story prompts.
  const eligiblePortraits = isolateUnconfirmedPortraits
    ? (portraits || []).filter((p) => !isPortraitAutoScannedUnconfirmed(p))
    : portraits || [];

  const allowedRosterKeys = buildAllowedRosterKeys(
    undefined,
    realMcName || undefined,
    [
      ...(npcs || []).map((n) => n.name),
      ...eligiblePortraits.filter((p) => !p.isMc).map((p) => p.name),
    ],
  );

  const resolveCanonicalGroupKey = (rawName: string): string => {
    const idObj = collectCharacterIdentityKeys(rawName);
    if (idObj.primaryKey) return idObj.primaryKey;
    const celeb = lookupKnownCelebrityProfile(rawName);
    if (celeb) return normalizeCharacterKey(celeb.canonicalName);
    return normalizeCharacterKey(rawName);
  };

  // Map known character locations from current save's characterStates for cross-location filtering
  const locationByGroupKey = new Map<string, string>();
  for (const s of characterStates || []) {
    if (!s.name?.trim() || !s.location?.trim()) continue;
    if (isInvalidNpcState(s, allowedRosterKeys)) continue;
    const gKey = resolveCanonicalGroupKey(s.name.trim());
    if (gKey && !locationByGroupKey.has(gKey)) {
      const cleanLoc = sanitizeNpcFieldText('location', s.location.trim());
      if (cleanLoc) locationByGroupKey.set(gKey, cleanLoc);
    }
  }

  interface CharEntry {
    canonicalKey: string;
    displayName: string;
    score: number;
    lastAiPos: number;
    inUser: boolean;
    firstUserPos: number;
    inCurrent: boolean;
    inImmediatePrev: boolean;
    inRecent: boolean;
    isMc: boolean;
    location?: string;
  }

  const entries = new Map<string, CharEntry>();

  const teasingPairsInScene = extractTeasingNicknamePairsFromText(
    [rawCleanUser, rawCleanAi].filter(Boolean).join('\n'),
  );
  const teasingMapInScene = new Map<string, string>();
  const standaloneTeasingInScene = new Set<string>();
  for (const pair of teasingPairsInScene) {
    const nk = normalizeCharacterKey(pair.nickname);
    if (!nk) continue;
    if (pair.canonical) {
      teasingMapInScene.set(nk, pair.canonical);
    } else {
      standaloneTeasingInScene.add(nk);
    }
  }

  const knownRosterCanonicalNames = Array.from(
    new Set(
      [
        realMcName || '',
        ...(npcs || []).map((n) => n.name),
        ...eligiblePortraits.map((p) => p.name),
        ...(characterStates || [])
          .filter((s) => !isInvalidNpcState(s, allowedRosterKeys))
          .map((s) => s.name),
        ...findKnownCelebritiesInText(currentCombined).map((c) => c.displayName),
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean),
    ),
  );

  const resolveTeasingOrVariantName = (
    rawDisplay: string,
    isMcFlag = false,
  ): string | null => {
    const rawTrim = rawDisplay.trim();
    if (!rawTrim) return null;
    if (isMcFlag) return rawTrim;
    const rawKey = normalizeCharacterKey(rawTrim);
    if (!rawKey) return null;
    if (teasingMapInScene.has(rawKey)) {
      return teasingMapInScene.get(rawKey)!;
    }
    if (standaloneTeasingInScene.has(rawKey)) {
      return null;
    }
    const existingDisplayNames = Array.from(entries.values()).map(
      (e) => e.displayName,
    );
    const variantTarget = findCanonicalVariantMatch(rawTrim, [
      ...knownRosterCanonicalNames,
      ...existingDisplayNames,
    ]);
    if (variantTarget) return variantTarget;
    if (isPlayfulTeasingOrParodyName(rawTrim, allowedRosterKeys)) {
      return null;
    }
    return rawTrim;
  };

  const upsertEntry = (
    rawDisplay: string,
    opts: {
      scoreDelta?: number;
      lastAiPos?: number;
      inUser?: boolean;
      firstUserPos?: number;
      inCurrent?: boolean;
      inImmediatePrev?: boolean;
      inRecent?: boolean;
      isMc?: boolean;
      preferDisplay?: boolean;
    },
  ) => {
    const resolvedInput = resolveTeasingOrVariantName(
      rawDisplay,
      Boolean(opts.isMc),
    );
    if (!resolvedInput) return;
    const rawTrim = resolvedInput.trim();
    const clean = opts.isMc
      ? rawTrim
      : sanitizeCharacterName(rawTrim, allowedRosterKeys) || '';
    if (
      !clean ||
      isGenericCharacterPlaceholder(clean) ||
      isEnglishHeadingOrMetaPhrase(clean)
    ) {
      return;
    }
    const groupKey = resolveCanonicalGroupKey(clean);
    if (!groupKey) return;

    // Merge short/full name variants & teasing/spelling variants
    let targetKey = groupKey;
    if (!entries.has(targetKey)) {
      for (const [existingKey, existingEntry] of entries.entries()) {
        if (
          existingKey.startsWith(`${groupKey} `) ||
          groupKey.startsWith(`${existingKey} `) ||
          existingKey.endsWith(` ${groupKey}`) ||
          groupKey.endsWith(` ${existingKey}`) ||
          isTeasingOrSpellingVariantOf(clean, existingEntry.displayName) ||
          isTeasingOrSpellingVariantOf(existingEntry.displayName, clean)
        ) {
          targetKey = existingKey;
          break;
        }
      }
    }

    const existing = entries.get(targetKey);
    const loc = locationByGroupKey.get(targetKey) || locationByGroupKey.get(groupKey);
    if (existing) {
      existing.score = Math.max(existing.score, opts.scoreDelta ?? 0);
      if (typeof opts.lastAiPos === 'number' && opts.lastAiPos > existing.lastAiPos) {
        existing.lastAiPos = opts.lastAiPos;
      }
      if (opts.inUser) existing.inUser = true;
      if (
        typeof opts.firstUserPos === 'number' &&
        opts.firstUserPos >= 0 &&
        (existing.firstUserPos < 0 || opts.firstUserPos < existing.firstUserPos)
      ) {
        existing.firstUserPos = opts.firstUserPos;
      }
      if (opts.inCurrent) existing.inCurrent = true;
      if (opts.inImmediatePrev) existing.inImmediatePrev = true;
      if (opts.inRecent) existing.inRecent = true;
      if (opts.isMc) existing.isMc = true;
      if (!existing.location && loc) existing.location = loc;
      if (
        opts.preferDisplay &&
        clean.length >= 2 &&
        !isPlayfulTeasingOrParodyName(clean, allowedRosterKeys)
      ) {
        existing.displayName = clean;
      }
    } else {
      entries.set(targetKey, {
        canonicalKey: targetKey,
        displayName: clean,
        score: opts.scoreDelta ?? 0,
        lastAiPos: opts.lastAiPos ?? -1,
        inUser: Boolean(opts.inUser),
        firstUserPos:
          typeof opts.firstUserPos === 'number' ? opts.firstUserPos : -1,
        inCurrent: Boolean(opts.inCurrent),
        inImmediatePrev: Boolean(opts.inImmediatePrev),
        inRecent: Boolean(opts.inRecent),
        isMc: Boolean(opts.isMc),
        location: loc,
      });
    }
  };

  // 1. Scan current save's roster names strictly against current & recent prose using diacritic-exact matching
  const rosterPool: Array<{ name: string; isMc: boolean; baseScore: number }> = [];
  const isCleanRosterName = (raw?: string, isMcFlag = false) => {
    const t = (raw || '').trim();
    if (!t || isGenericCharacterPlaceholder(t) || isEnglishHeadingOrMetaPhrase(t)) {
      return false;
    }
    if (isMcFlag) return true;
    return Boolean(sanitizeCharacterName(t, allowedRosterKeys));
  };
  if (realMcName && isCleanRosterName(realMcName, true) && !(mcAbsentAtStart && !hasStoryContent)) {
    rosterPool.push({ name: realMcName, isMc: true, baseScore: 35 });
  }
  for (const s of characterStates || []) {
    if (!isInvalidNpcState(s, allowedRosterKeys) && isCleanRosterName(s.name, Boolean(s.isMc))) {
      rosterPool.push({ name: s.name.trim(), isMc: Boolean(s.isMc), baseScore: 45 });
    }
  }
  for (const n of npcs || []) {
    if (isCleanRosterName(n.name, false)) {
      rosterPool.push({ name: n.name.trim(), isMc: false, baseScore: 30 });
    }
  }
  for (const p of eligiblePortraits) {
    if (!isInvalidNpcPortrait(p, allowedRosterKeys) && isCleanRosterName(p.name, Boolean(p.isMc))) {
      rosterPool.push({ name: p.name.trim(), isMc: Boolean(p.isMc), baseScore: 28 });
    }
  }

  // Track characters that appear ONLY as indirect/off-screen mentions in the current turn
  // (e.g. talked about in dialogue, thoughts, upcoming texts, calls, or remote plans)
  // so they are never pulled into the active scene or backfilled from earlier turns.
  const indirectOnlyInCurrent = new Set<string>();
  const isIndirectOnlyNow = (rawName: string): boolean => {
    const gk = resolveCanonicalGroupKey(rawName);
    if (!gk) return false;
    if (indirectOnlyInCurrent.has(gk)) return true;
    for (const ik of indirectOnlyInCurrent) {
      if (ik.startsWith(`${gk} `) || gk.startsWith(`${ik} `)) return true;
    }
    return false;
  };

  for (const item of rosterPool) {
    const isMcItem =
      item.isMc || (Boolean(mcKey) && normalizeCharacterKey(item.name) === mcKey);

    if (
      currentCombined &&
      isCharacterExplicitlyAbsent(currentCombined, item.name, isMcItem)
    ) {
      // Explicitly stated as absent / at another location in current scene -> exclude
      indirectOnlyInCurrent.add(resolveCanonicalGroupKey(item.name));
      continue;
    }

    const tailPres = analyzeCharacterDirectPresence(tailAi, item.name, {
      allowHonorificShortName: true,
    });
    const aiPres = analyzeCharacterDirectPresence(cleanAi, item.name, {
      allowHonorificShortName: true,
    });
    const userPres = analyzeCharacterDirectPresence(cleanUser, item.name, {
      allowHonorificShortName: true,
    });

    const totalCurrentDirect = aiPres.directCount + userPres.directCount;
    const totalCurrentIndirect = aiPres.indirectCount + userPres.indirectCount;

    if (totalCurrentDirect === 0 && totalCurrentIndirect > 0) {
      // Character was only mentioned indirectly (dialogue/thought/text/call/future plan) in this scene
      indirectOnlyInCurrent.add(resolveCanonicalGroupKey(item.name));
      continue;
    }

    const prevPres =
      totalCurrentDirect === 0 && immediatePrevText
        ? analyzeCharacterDirectPresence(immediatePrevText, item.name, {
            allowHonorificShortName: true,
          })
        : {
            directCount: 0,
            indirectCount: 0,
            firstDirectIndex: -1,
            lastDirectIndex: -1,
            matchedDisplay: item.name,
          };
    const recentPres =
      totalCurrentDirect === 0 && prevPres.directCount === 0 && recentText
        ? analyzeCharacterDirectPresence(recentText, item.name, {
            allowHonorificShortName: true,
          })
        : {
            directCount: 0,
            indirectCount: 0,
            firstDirectIndex: -1,
            lastDirectIndex: -1,
            matchedDisplay: item.name,
          };

    const inCurrent = totalCurrentDirect > 0;
    const inImmediatePrev = prevPres.directCount > 0;
    const inRecent = inImmediatePrev || recentPres.directCount > 0;

    // CRITICAL ISOLATION: When the story already has content, NEVER add roster entries
    // that were not directly present in the current turn or recent 1-2 turns.
    if (hasStoryContent && !inCurrent && !inRecent) {
      continue;
    }

    const matchedDisplay =
      aiPres.directCount > 0
        ? aiPres.matchedDisplay
        : userPres.directCount > 0
          ? userPres.matchedDisplay
          : prevPres.directCount > 0
            ? prevPres.matchedDisplay
            : recentPres.directCount > 0
              ? recentPres.matchedDisplay
              : item.name;

    const score =
      tailPres.directCount > 0
        ? 400 + tailPres.lastDirectIndex / 20 + Math.min(totalCurrentDirect * 10, 60)
        : totalCurrentDirect > 0
          ? 260 + aiPres.lastDirectIndex / 30 + Math.min(totalCurrentDirect * 10, 50)
          : inImmediatePrev
            ? 165 + Math.min(prevPres.directCount * 8, 30)
            : inRecent
              ? 135 + Math.min(recentPres.directCount * 8, 25)
              : item.baseScore;

    upsertEntry(matchedDisplay, {
      scoreDelta: score,
      lastAiPos: aiPres.lastDirectIndex,
      inUser: userPres.directCount > 0,
      firstUserPos: userPres.firstDirectIndex,
      inCurrent,
      inImmediatePrev,
      inRecent,
      isMc: isMcItem,
      preferDisplay: inCurrent,
    });
  }

  // 2. Detect known celebrities directly present in current & recent prose
  for (const hit of findKnownCelebritiesInText(currentCombined)) {
    if (isCharacterExplicitlyAbsent(currentCombined, hit.displayName)) {
      indirectOnlyInCurrent.add(resolveCanonicalGroupKey(hit.displayName));
      continue;
    }
    const tailPres = analyzeCharacterDirectPresence(tailAi, hit.displayName);
    const userPres = analyzeCharacterDirectPresence(cleanUser, hit.displayName);
    const aiPres = analyzeCharacterDirectPresence(cleanAi, hit.displayName);
    const totalDirect = aiPres.directCount + userPres.directCount;
    if (totalDirect === 0) {
      if (aiPres.indirectCount + userPres.indirectCount > 0) {
        indirectOnlyInCurrent.add(resolveCanonicalGroupKey(hit.displayName));
      }
      continue;
    }
    upsertEntry(hit.displayName, {
      scoreDelta:
        tailPres.directCount > 0
          ? 410 + tailPres.lastDirectIndex / 20 + Math.min(totalDirect * 10, 60)
          : 280 + Math.max(aiPres.lastDirectIndex, 0) / 30 + Math.min(totalDirect * 10, 50),
      lastAiPos: aiPres.lastDirectIndex,
      inUser: userPres.directCount > 0,
      firstUserPos: userPres.firstDirectIndex,
      inCurrent: true,
      preferDisplay: true,
    });
  }
  if (immediatePrevText) {
    for (const hit of findKnownCelebritiesInText(immediatePrevText)) {
      if (isIndirectOnlyNow(hit.displayName)) continue;
      if (
        currentCombined &&
        isCharacterExplicitlyAbsent(currentCombined, hit.displayName)
      ) {
        continue;
      }
      const prevPres = analyzeCharacterDirectPresence(
        immediatePrevText,
        hit.displayName,
      );
      if (prevPres.directCount === 0) continue;
      upsertEntry(hit.displayName, {
        scoreDelta: 170 + Math.min(prevPres.directCount * 8, 30),
        inImmediatePrev: true,
        inRecent: true,
      });
    }
  }
  if (recentText) {
    for (const hit of findKnownCelebritiesInText(recentText)) {
      if (isIndirectOnlyNow(hit.displayName)) continue;
      if (
        currentCombined &&
        isCharacterExplicitlyAbsent(currentCombined, hit.displayName)
      ) {
        continue;
      }
      const recPres = analyzeCharacterDirectPresence(recentText, hit.displayName);
      if (recPres.directCount === 0) continue;
      upsertEntry(hit.displayName, {
        scoreDelta: 140 + Math.min(recPres.directCount * 8, 25),
        inRecent: true,
      });
    }
  }

  // 3. Detect explicit speaker prefixes in current turn
  const knownKeys = new Set<string>(Array.from(entries.keys()));
  for (const line of currentCombined.split(/\r?\n/)) {
    const sp = extractSpeakerPrefixFromLine(line, knownKeys);
    if (!sp || isGenericCharacterPlaceholder(sp.displayName)) continue;
    if (isCharacterExplicitlyAbsent(currentCombined, sp.displayName)) continue;
    const aiPos = cleanAi.lastIndexOf(sp.displayName);
    const userPos = cleanUser.indexOf(sp.displayName);
    upsertEntry(sp.displayName, {
      scoreDelta: 380 + (aiPos >= 0 ? aiPos / 25 : 0),
      lastAiPos: aiPos,
      inUser: userPos >= 0,
      firstUserPos: userPos,
      inCurrent: true,
      preferDisplay: true,
    });
  }

  // 4. Detect multi-word proper names directly present in current turn prose
  for (const hit of extractInlineProperNamesFromProse(currentCombined)) {
    const resolvedHitName = resolveTeasingOrVariantName(hit.displayName, false);
    if (!resolvedHitName) continue;
    if (isCharacterExplicitlyAbsent(currentCombined, resolvedHitName)) {
      indirectOnlyInCurrent.add(resolveCanonicalGroupKey(resolvedHitName));
      continue;
    }
    const aiPres = analyzeCharacterDirectPresence(cleanAi, hit.displayName);
    const userPres = analyzeCharacterDirectPresence(cleanUser, hit.displayName);
    const tailPres = analyzeCharacterDirectPresence(tailAi, hit.displayName);
    const totalDirect = aiPres.directCount + userPres.directCount;
    if (totalDirect === 0) {
      if (aiPres.indirectCount + userPres.indirectCount > 0) {
        indirectOnlyInCurrent.add(resolveCanonicalGroupKey(resolvedHitName));
      }
      continue;
    }
    const resolvedGroupKey = resolveCanonicalGroupKey(resolvedHitName);
    const isAlreadyKnownEntity =
      entries.has(resolvedGroupKey) ||
      allowedRosterKeys.has(normalizeCharacterKey(resolvedHitName)) ||
      Boolean(lookupKnownCelebrityProfile(resolvedHitName));

    if (isAlreadyKnownEntity) {
      upsertEntry(resolvedHitName, {
        scoreDelta:
          tailPres.directCount > 0
            ? 390 + tailPres.lastDirectIndex / 20 + Math.min(totalDirect * 10, 50)
            : 250 + Math.max(aiPres.lastDirectIndex, 0) / 30 + Math.min(totalDirect * 8, 40),
        lastAiPos: aiPres.lastDirectIndex,
        inUser: userPres.directCount > 0,
        firstUserPos: userPres.firstDirectIndex,
        inCurrent: true,
      });
      continue;
    }

    // For brand-new multi-word proper names not on the roster, require real character engagement
    // (prevents stray capitalized phrases, song titles, or user-only mentions from becoming active NPCs)
    const engagement = evaluateCharacterSceneEngagement(
      cleanAi || currentCombined,
      resolvedHitName,
      cleanUser,
    );
    if (!engagement.qualifiesAsNewNpc) continue;

    if (
      totalDirect >= 2 ||
      (hit.isVietPersonPattern &&
        (tailPres.directCount > 0 || aiPres.directCount >= 1)) ||
      engagement.engagementScore >= 4
    ) {
      upsertEntry(resolvedHitName, {
        scoreDelta:
          tailPres.directCount > 0
            ? 390 + tailPres.lastDirectIndex / 20 + Math.min(totalDirect * 10, 50)
            : 250 + Math.max(aiPres.lastDirectIndex, 0) / 30 + Math.min(totalDirect * 8, 40),
        lastAiPos: aiPres.lastDirectIndex,
        inUser: userPres.directCount > 0,
        firstUserPos: userPres.firstDirectIndex,
        inCurrent: true,
      });
    }
  }

  // Also capture multi-word Vietnamese proper names directly present in the immediately preceding turn
  // (only if current page has no or 1 detected character)
  if (immediatePrevText) {
    for (const hit of extractInlineProperNamesFromProse(immediatePrevText)) {
      const resolvedPrevName = resolveTeasingOrVariantName(
        hit.displayName,
        false,
      );
      if (!resolvedPrevName) continue;
      if (isIndirectOnlyNow(resolvedPrevName)) continue;
      if (
        currentCombined &&
        isCharacterExplicitlyAbsent(currentCombined, resolvedPrevName)
      ) {
        continue;
      }
      const prevPres = analyzeCharacterDirectPresence(
        immediatePrevText,
        hit.displayName,
      );
      if (prevPres.directCount === 0) continue;
      const isKnownPrev =
        entries.has(resolveCanonicalGroupKey(resolvedPrevName)) ||
        allowedRosterKeys.has(normalizeCharacterKey(resolvedPrevName)) ||
        Boolean(lookupKnownCelebrityProfile(resolvedPrevName));
      if (
        !isKnownPrev &&
        !evaluateCharacterSceneEngagement(immediatePrevText, resolvedPrevName)
          .qualifiesAsNewNpc
      ) {
        continue;
      }
      if (prevPres.directCount >= 2 || hit.isVietPersonPattern) {
        upsertEntry(resolvedPrevName, {
          scoreDelta: 155 + Math.min(prevPres.directCount * 8, 25),
          inImmediatePrev: true,
          inRecent: true,
        });
      }
    }
  }

  const ranked = Array.from(entries.values()).sort(
    (a, b) =>
      Number(b.inCurrent) - Number(a.inCurrent) ||
      Number(b.inImmediatePrev) - Number(a.inImmediatePrev) ||
      Number(b.inRecent) - Number(a.inRecent) ||
      b.score - a.score ||
      b.lastAiPos - a.lastAiPos,
  );

  const presentInCurrent = ranked.filter((r) => r.inCurrent);
  const presentInRecent = ranked.filter(
    (r) => !r.inCurrent && r.inRecent && !isIndirectOnlyNow(r.displayName),
  );

  // Build strict activeList grounded ONLY in characters directly present in the current scene
  let activeList: CharEntry[] = [];
  if (presentInCurrent.length > 0) {
    const anchorLocations = presentInCurrent
      .map((r) => r.location || '')
      .filter(Boolean);
    activeList = [...presentInCurrent];
    // Only if a single character is named on the current page, optionally include
    // a companion from the immediately preceding turn if they share the same location
    if (activeList.length === 1) {
      const prevCompanion = presentInRecent.find(
        (r) =>
          r.inImmediatePrev &&
          !hasConflictingSceneLocation(r.location, anchorLocations),
      );
      if (prevCompanion) {
        activeList.push(prevCompanion);
      }
    }
  } else if (presentInRecent.length > 0) {
    activeList = [...presentInRecent];
  } else if (!hasStoryContent) {
    // Blank 0-turn session before Turn 1: use current save's starting roster
    activeList = [...ranked];
  } else {
    // Story content exists, yet no concrete character name was detected in current/recent turns:
    // strictly keep activeList empty so suggestions use natural pronouns/contextual phrasing
    // instead of injecting unrelated characters from another scene or save.
    activeList = [];
  }

  const presentNames = activeList.map((r) => r.displayName);

  const rawCombinedForMc = `${rawCleanUser}\n${rawCleanAi}`.trim();
  const mcPresent = rawCombinedForMc
    ? realMcName
      ? isMcPresentInTurn(rawCleanAi, rawCleanUser, realMcName, validPronoun || '')
      : Boolean(validPronoun) &&
        isMcPresentInTurn(rawCleanAi, rawCleanUser, '', validPronoun || '')
    : !mcAbsentAtStart;

  const mcGroupKey = realMcName ? resolveCanonicalGroupKey(realMcName) : '';
  const mcEntryInActive = mcGroupKey
    ? activeList.find((r) => r.canonicalKey === mcGroupKey)
    : undefined;

  let actorName: string | null = null;
  let targetName: string | null = null;
  let secondaryTargetName: string | null = null;

  if (realMcName && mcPresent && (mcEntryInActive || !hasStoryContent)) {
    // Only use MC's real name when MC is genuinely present in this scene/turn (or at 0-turn start)
    actorName = mcEntryInActive?.displayName || realMcName;
    const others = activeList.filter((r) => r.canonicalKey !== mcGroupKey);
    targetName = others[0]?.displayName || null;
    secondaryTargetName = others[1]?.displayName || null;
  } else if (mcPresent && validPronoun && !mcEntryInActive && activeList.length >= 1) {
    // Pure first-person POV where MC is present via pronoun without realMcName appearing in prose:
    // keep actorName null so natural pronoun is used instead of a potentially mismatched MC name.
    actorName = null;
    targetName = activeList[0].displayName;
    secondaryTargetName = activeList[1]?.displayName || null;
  } else if (activeList.length >= 2) {
    // Pair the two most prominent active characters in the current scene
    const topTwo = activeList.slice(0, 2);
    const userLed = [...topTwo]
      .filter((c) => c.inUser && c.firstUserPos >= 0)
      .sort((a, b) => a.firstUserPos - b.firstUserPos);
    if (userLed.length === 1) {
      actorName = userLed[0].displayName;
      targetName =
        topTwo.find((c) => c.canonicalKey !== userLed[0].canonicalKey)
          ?.displayName || null;
    } else {
      const byLastAi = [...topTwo].sort((a, b) => b.lastAiPos - a.lastAiPos);
      targetName = byLastAi[0].displayName;
      actorName = byLastAi[1].displayName;
    }
    secondaryTargetName = activeList[2]?.displayName || null;
  } else if (activeList.length === 1) {
    // Only 1 active character detected in the scene: never pull unrelated characters from elsewhere
    targetName = activeList[0].displayName;
    actorName = null;
  } else {
    // No concrete character detected: leave both null so contextual pronouns/phrasing are used
    actorName = null;
    targetName = null;
  }

  return {
    presentNames,
    actorName,
    targetName,
    secondaryTargetName,
    validPronoun,
    mcPresent,
  };
}

export type TurnSuggestionCategory =
  | 'continue'
  | 'tease'
  | 'probe'
  | 'move'
  | 'bold'
  | 'rest';

export interface TurnSuggestionItem {
  id: string;
  category: TurnSuggestionCategory;
  label: string;
  text: string;
  source: 'local' | 'ai';
}

export const TURN_SUGGESTION_CATEGORY_LABELS: Record<
  TurnSuggestionCategory,
  string
> = {
  continue: 'Tiếp nhịp',
  tease: 'Trêu ghẹo',
  probe: 'Dò xét',
  move: 'Đổi cảnh',
  bold: 'Táo bạo',
  rest: 'Đổi nhịp',
};

const VALID_SUGGESTION_CATEGORIES: TurnSuggestionCategory[] = [
  'continue',
  'tease',
  'probe',
  'move',
  'bold',
  'rest',
];

const SUGGESTION_CLICHE_RE =
  /(?:nhẹ\s+nhàng\s+mỉm\s+cười|khẽ\s+mỉm\s+cười|mỉm\s+cười\s+(?:thật\s+)?(?:dịu\s+dàng|hiền|ấm\s+áp)|cười\s+(?:thật\s+)?(?:dịu\s+dàng|hiền)|dịu\s+(?:dàng|giọng)\s+hỏi\s+thăm|đặt\s+(?:một\s+)?nụ\s+hôn\s+lên\s+(?:vầng\s+)?trán|vén\s+(?:mấy\s+)?(?:sợi|lọn)\s+tóc\s+mai|ánh\s+mắt\s+(?:thật\s+hiền|trìu\s+mến)|bằng\s+giọng\s+trầm\s+ấm)/i;

function extractTailExcerpt(text: string | undefined | null, maxLen: number): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const start = Math.max(0, clean.length - maxLen);
  const sliced = clean.slice(start);
  const firstSentenceBreak = sliced.search(/[.!?…]\s+/);
  if (firstSentenceBreak >= 0 && firstSentenceBreak < Math.floor(maxLen * 0.35)) {
    return sliced.slice(firstSentenceBreak + 2).trim();
  }
  const firstSpace = sliced.indexOf(' ');
  return (firstSpace >= 0 && firstSpace < 30 ? sliced.slice(firstSpace + 1) : sliced).trim();
}

function normalizeSuggestionCategory(
  raw: unknown,
  fallbackIndex: number,
): TurnSuggestionCategory {
  const key = String(raw || '')
    .trim()
    .toLowerCase();
  if (
    VALID_SUGGESTION_CATEGORIES.includes(key as TurnSuggestionCategory)
  ) {
    return key as TurnSuggestionCategory;
  }
  if (/tiep|tiếp|nhịp|nhip|thuận|thuan|scene|flow/.test(key)) return 'continue';
  if (/treu|trêu|ghẹo|gheo|lầy|lay|đùa|dua|hài|hai|flirt|banter|joke/.test(key)) return 'tease';
  if (/do|dò|xét|xet|hỏi|hoi|thăm|tham|ask|question|probe/.test(key)) return 'probe';
  if (/chuyen|chuyển|đổi cảnh|doi canh|di chuyển|không gian|vị trí|move|place|location/.test(key)) {
    return 'move';
  }
  if (/tao|táo|bạo|bao|biến số|bien so|bất ngờ|bat ngo|chen ngang|bold|action|surprise|twist/.test(key)) {
    return 'bold';
  }
  if (/nghi|nghỉ|buổi|buoi|đổi nhịp|doi nhip|thời gian|time|sleep|rest|skip/.test(key)) {
    return 'rest';
  }
  return VALID_SUGGESTION_CATEGORIES[
    fallbackIndex % VALID_SUGGESTION_CATEGORIES.length
  ];
}

function cleanSuggestionSentence(raw: string): string {
  let s = String(raw || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/^\s*(?:[-*•–—]+|\d+[.)\]])\s*/, '')
    .replace(/^["'“”«»`]+|["'“”«»`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 175) {
    s = trimToCleanSentence(s, 165);
  }
  return s;
}

function parseAiSuggestionsFromRaw(
  raw: string,
  existingKeys: Set<string>,
): TurnSuggestionItem[] {
  if (!raw || !raw.trim()) return [];
  let cleaned = String(raw)
    .replace(META_BLOCK_TAG_RE, '\n')
    .trim();

  // Drop any orphan closing </thinking> prefix produced when user prefill starts <thinking>
  let lastCloseEnd = -1;
  let closeMatch: RegExpExecArray | null;
  ORPHAN_CLOSE_THINKING_RE.lastIndex = 0;
  while ((closeMatch = ORPHAN_CLOSE_THINKING_RE.exec(cleaned)) !== null) {
    lastCloseEnd = closeMatch.index + closeMatch[0].length;
  }
  if (lastCloseEnd >= 0) {
    const afterClose = cleaned.slice(lastCloseEnd).trim();
    if (afterClose) cleaned = afterClose;
  }

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  const rawItems: Array<{ category?: unknown; text: string }> = [];

  // 1. Try JSON object {"suggestions": [...]}
  const objParsed = parseAiJsonObject(cleaned);
  if (objParsed) {
    const arr =
      (Array.isArray(objParsed.suggestions) && objParsed.suggestions) ||
      (Array.isArray(objParsed.items) && objParsed.items) ||
      (Array.isArray(objParsed.options) && objParsed.options) ||
      (Array.isArray(objParsed.choices) && objParsed.choices) ||
      (Array.isArray(objParsed.actions) && objParsed.actions) ||
      (Array.isArray(objParsed.prompts) && objParsed.prompts) ||
      (Array.isArray(objParsed.list) && objParsed.list) ||
      (Array.isArray(objParsed.results) && objParsed.results) ||
      (Array.isArray(objParsed.data) && objParsed.data) ||
      null;
    if (arr) {
      for (const entry of arr) {
        if (typeof entry === 'string') {
          rawItems.push({ text: entry });
        } else if (entry && typeof entry === 'object') {
          const rec = entry as Record<string, unknown>;
          const txt = String(
            rec.text ||
              rec.content ||
              rec.prompt ||
              rec.action ||
              rec.suggestion ||
              rec.dialogue ||
              rec.reply ||
              rec.message ||
              rec.value ||
              '',
          ).trim();
          if (txt) {
            rawItems.push({
              category: rec.category || rec.type || rec.tag || rec.label,
              text: txt,
            });
          }
        }
      }
    }
  }

  // 2. Try bare JSON array [...]
  if (!rawItems.length) {
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket >= 0) {
      const slice =
        lastBracket > firstBracket
          ? cleaned.slice(firstBracket, lastBracket + 1)
          : cleaned.slice(firstBracket);
      let arrParsed: unknown = null;
      try {
        arrParsed = JSON.parse(slice);
      } catch {
        try {
          arrParsed = JSON.parse(repairTruncatedJson(slice));
        } catch {
          arrParsed = null;
        }
      }
      if (Array.isArray(arrParsed)) {
        for (const entry of arrParsed) {
          if (typeof entry === 'string') {
            rawItems.push({ text: entry });
          } else if (entry && typeof entry === 'object') {
            const rec = entry as Record<string, unknown>;
            const txt = String(
              rec.text ||
                rec.content ||
                rec.prompt ||
                rec.action ||
                rec.suggestion ||
                rec.dialogue ||
                rec.reply ||
                rec.message ||
                rec.value ||
                '',
            ).trim();
            if (txt) {
              rawItems.push({
                category: rec.category || rec.type || rec.tag || rec.label,
                text: txt,
              });
            }
          }
        }
      }
    }
  }

  // 3. Fallback line-by-line extraction if model returned a numbered/bulleted list
  if (!rawItems.length) {
    const lines = cleaned
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 16 && !/^[{}\[\]]+$/.test(l));
    for (const line of lines) {
      if (CONTAINS_META_NOISE_RE.test(line)) continue;
      const labelled = /^(?:[-*•]|\d+[.)])\s*(?:\[([^\]]+)\]|([^:]{2,22}):)\s*(.+)$/.exec(
        line,
      );
      if (labelled) {
        rawItems.push({
          category: labelled[1] || labelled[2],
          text: labelled[3],
        });
      } else if (/^(?:[-*•]|\d+[.)])\s+(.+)$/.test(line)) {
        rawItems.push({ text: line });
      }
    }
  }

  const nowTs = Date.now();
  const seen = new Set<string>(existingKeys);
  const freshCandidates: Array<{
    category: TurnSuggestionCategory;
    text: string;
    isCliche: boolean;
  }> = [];

  for (let i = 0; i < rawItems.length; i++) {
    const cleanText = cleanSuggestionSentence(rawItems[i].text);
    if (!cleanText || cleanText.length < 10) continue;
    const key = normalizeCharacterKey(cleanText);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const category = normalizeSuggestionCategory(
      rawItems[i].category,
      freshCandidates.length,
    );
    freshCandidates.push({
      category,
      text: cleanText,
      isCliche: SUGGESTION_CLICHE_RE.test(cleanText),
    });
  }

  // Prefer crisp, non-cliché candidates if model returned more than 6 items.
  const orderedCandidates =
    freshCandidates.length > 6
      ? [
          ...freshCandidates.filter((c) => !c.isCliche),
          ...freshCandidates.filter((c) => c.isCliche),
        ]
      : freshCandidates;

  const results: TurnSuggestionItem[] = [];
  for (const item of orderedCandidates) {
    results.push({
      id: `ai_sug_${nowTs}_${results.length}_${Math.random().toString(36).slice(2, 6)}`,
      category: item.category,
      label: TURN_SUGGESTION_CATEGORY_LABELS[item.category],
      text: item.text,
      source: 'ai',
    });
    if (results.length >= 6) break;
  }

  return results;
}

interface ProxyExtractedPieces {
  content: string;
  reasoning: string;
  finishReason?: string;
  embeddedError?: string;
  usageSummary?: string;
}

interface FlexibleProxyResponse extends ProxyExtractedPieces {
  httpStatus: number;
  contentType: string;
  format: 'sse' | 'json' | 'ndjson' | 'text' | 'html' | 'empty';
  rawPreview: string;
}

function stringifyTextField(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        parts.push(item);
      } else if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const itemType = typeof rec.type === 'string' ? rec.type.toLowerCase() : '';
        if (rec.thought === true || itemType === 'thinking' || itemType === 'reasoning') {
          continue;
        }
        const piece =
          (typeof rec.text === 'string' && rec.text) ||
          (typeof rec.output_text === 'string' && rec.output_text) ||
          (typeof rec.content === 'string' && rec.content) ||
          (typeof rec.value === 'string' && rec.value) ||
          '';
        if (piece) parts.push(piece);
      }
    }
    return parts.join('');
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec.text === 'string') return rec.text;
    if (typeof rec.content === 'string') return rec.content;
    if (typeof rec.value === 'string') return rec.value;
  }
  return '';
}

function extractReasoningFromPartsArray(value: unknown): string {
  if (!Array.isArray(value)) return '';
  const parts: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const itemType = typeof rec.type === 'string' ? rec.type.toLowerCase() : '';
    if (rec.thought === true || itemType === 'thinking' || itemType === 'reasoning') {
      const piece =
        (typeof rec.thinking === 'string' && rec.thinking) ||
        (typeof rec.reasoning === 'string' && rec.reasoning) ||
        (typeof rec.text === 'string' && rec.text) ||
        (typeof rec.content === 'string' && rec.content) ||
        '';
      if (piece) parts.push(piece);
    }
  }
  return parts.join('');
}

function summarizeProxyUsage(json: Record<string, unknown>): string | undefined {
  const usage =
    (json.usage && typeof json.usage === 'object'
      ? (json.usage as Record<string, unknown>)
      : null) ||
    (json.usageMetadata && typeof json.usageMetadata === 'object'
      ? (json.usageMetadata as Record<string, unknown>)
      : null);
  if (!usage) return undefined;
  const parts: string[] = [];
  const promptTok = usage.prompt_tokens ?? usage.promptTokenCount;
  const compTok = usage.completion_tokens ?? usage.candidatesTokenCount;
  const details =
    usage.completion_tokens_details && typeof usage.completion_tokens_details === 'object'
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : null;
  const reasonTok =
    details?.reasoning_tokens ?? usage.thoughtsTokenCount ?? usage.reasoning_tokens;
  if (typeof promptTok === 'number') parts.push(`in:${promptTok}`);
  if (typeof compTok === 'number') parts.push(`out:${compTok}`);
  if (typeof reasonTok === 'number' && reasonTok > 0) parts.push(`think:${reasonTok}`);
  return parts.length ? parts.join('/') : undefined;
}

function extractPiecesFromProxyJson(json: unknown, depth = 0): ProxyExtractedPieces {
  if (typeof json === 'string') {
    return { content: json, reasoning: '' };
  }
  if (!json || typeof json !== 'object' || depth > 2) {
    return { content: '', reasoning: '' };
  }

  const obj = json as Record<string, unknown>;
  let content = '';
  let reasoning = '';
  let finishReason: string | undefined;
  let embeddedError: string | undefined;
  const usageSummary = summarizeProxyUsage(obj);

  if (obj.error) {
    if (typeof obj.error === 'string') {
      embeddedError = obj.error.slice(0, 160);
    } else if (typeof obj.error === 'object') {
      const errRec = obj.error as Record<string, unknown>;
      const msg =
        (typeof errRec.message === 'string' && errRec.message) ||
        (typeof errRec.detail === 'string' && errRec.detail) ||
        (typeof errRec.type === 'string' && errRec.type) ||
        JSON.stringify(errRec);
      embeddedError = msg.slice(0, 160);
    }
  }

  // 1. OpenAI-compatible choices[] (message, delta, text, content, reasoning_content)
  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    for (const rawChoice of obj.choices) {
      if (!rawChoice || typeof rawChoice !== 'object') continue;
      const choice = rawChoice as Record<string, unknown>;
      if (!finishReason) {
        const fr = choice.finish_reason ?? choice.finishReason;
        if (typeof fr === 'string' && fr.trim()) finishReason = fr.trim();
      }

      const msg =
        choice.message && typeof choice.message === 'object'
          ? (choice.message as Record<string, unknown>)
          : null;
      if (msg) {
        content += stringifyTextField(msg.content);
        reasoning += extractReasoningFromPartsArray(msg.content);
        const msgReason =
          msg.reasoning_content ?? msg.reasoning ?? msg.thought ?? msg.thinking;
        reasoning += stringifyTextField(msgReason);
        if (!content && Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            const fn =
              tc && typeof tc === 'object'
                ? ((tc as Record<string, unknown>).function as
                    | Record<string, unknown>
                    | undefined)
                : undefined;
            if (typeof fn?.arguments === 'string' && fn.arguments.trim()) {
              content += fn.arguments;
            }
          }
        }
        if (
          !content &&
          msg.function_call &&
          typeof msg.function_call === 'object' &&
          typeof (msg.function_call as Record<string, unknown>).arguments === 'string'
        ) {
          content += String(
            (msg.function_call as Record<string, unknown>).arguments,
          );
        }
      }

      const delta =
        choice.delta && typeof choice.delta === 'object'
          ? (choice.delta as Record<string, unknown>)
          : null;
      if (delta) {
        content += stringifyTextField(delta.content);
        reasoning += extractReasoningFromPartsArray(delta.content);
        const deltaReason =
          delta.reasoning_content ??
          delta.reasoning ??
          delta.thought ??
          delta.thinking;
        reasoning += stringifyTextField(deltaReason);
        if (!content && Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const fn =
              tc && typeof tc === 'object'
                ? ((tc as Record<string, unknown>).function as
                    | Record<string, unknown>
                    | undefined)
                : undefined;
            if (typeof fn?.arguments === 'string' && fn.arguments) {
              content += fn.arguments;
            }
          }
        }
      }

      if (!content && typeof choice.text === 'string') {
        content += choice.text;
      }
      if (!content && choice.content !== undefined) {
        content += stringifyTextField(choice.content);
      }
      if (!reasoning) {
        const choiceReason =
          choice.reasoning_content ?? choice.reasoning ?? choice.thought;
        reasoning += stringifyTextField(choiceReason);
      }
      if (content) break;
    }
  }

  // 2. Gemini native candidates[] (iterate ALL parts, separating thought parts)
  if (!content && Array.isArray(obj.candidates) && obj.candidates.length > 0) {
    for (const rawCand of obj.candidates) {
      if (!rawCand || typeof rawCand !== 'object') continue;
      const cand = rawCand as Record<string, unknown>;
      if (!finishReason) {
        const fr = cand.finishReason ?? cand.finish_reason;
        if (typeof fr === 'string' && fr.trim()) finishReason = fr.trim();
      }
      const candContent =
        cand.content && typeof cand.content === 'object'
          ? (cand.content as Record<string, unknown>)
          : null;
      const parts = candContent?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (!p || typeof p !== 'object') continue;
          const part = p as Record<string, unknown>;
          if (typeof part.text !== 'string' || !part.text) continue;
          if (part.thought === true) {
            reasoning += part.text;
          } else {
            content += part.text;
          }
        }
      }
      if (content) break;
    }
  }

  // 3. OpenAI Responses API (output_text / output[])
  if (!content && typeof obj.output_text === 'string') {
    content += obj.output_text;
  }
  if (!content && Array.isArray(obj.output)) {
    for (const item of obj.output) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      content += stringifyTextField(rec.content);
      reasoning += extractReasoningFromPartsArray(rec.content);
      if (typeof rec.text === 'string') content += rec.text;
    }
  }

  // 4. Generic / Anthropic / Ollama / wrapper fallbacks
  if (!content) {
    const topMsg =
      obj.message && typeof obj.message === 'object'
        ? (obj.message as Record<string, unknown>)
        : null;
    if (topMsg) {
      content += stringifyTextField(topMsg.content);
      reasoning += extractReasoningFromPartsArray(topMsg.content);
      if (!reasoning) {
        reasoning += stringifyTextField(
          topMsg.reasoning_content ?? topMsg.reasoning ?? topMsg.thought,
        );
      }
    }
  }
  if (!content && obj.delta !== undefined) {
    if (typeof obj.delta === 'string') {
      content += obj.delta;
    } else if (obj.delta && typeof obj.delta === 'object') {
      const d = obj.delta as Record<string, unknown>;
      content += stringifyTextField(d.content ?? d.text);
      if (!reasoning) {
        reasoning += stringifyTextField(
          d.reasoning_content ?? d.reasoning ?? d.thought,
        );
      }
    }
  }
  if (!content && obj.content !== undefined) {
    content += stringifyTextField(obj.content);
    reasoning += extractReasoningFromPartsArray(obj.content);
  }
  if (!content) {
    const direct =
      obj.text ?? obj.response ?? obj.result ?? obj.answer ?? obj.output;
    if (typeof direct === 'string') {
      content += direct;
    }
  }
  if (!reasoning) {
    const topReason =
      obj.reasoning_content ?? obj.reasoning ?? obj.thought ?? obj.thinking;
    reasoning += stringifyTextField(topReason);
  }
  if (!content && obj.data !== undefined) {
    if (typeof obj.data === 'string') {
      content += obj.data;
    } else if (obj.data && typeof obj.data === 'object') {
      const nested = extractPiecesFromProxyJson(obj.data, depth + 1);
      content += nested.content;
      if (!reasoning) reasoning += nested.reasoning;
      if (!finishReason) finishReason = nested.finishReason;
      if (!embeddedError) embeddedError = nested.embeddedError;
    }
  }

  return {
    content,
    reasoning,
    finishReason,
    embeddedError,
    usageSummary,
  };
}

function parseSseOrNdjsonPayload(rawText: string): ProxyExtractedPieces & {
  matchedChunks: number;
} {
  let content = '';
  let reasoning = '';
  let finishReason: string | undefined;
  let embeddedError: string | undefined;
  let usageSummary: string | undefined;
  let matchedChunks = 0;

  const lines = rawText.split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (
      trimmed.startsWith(':') ||
      /^event:/i.test(trimmed) ||
      /^id:/i.test(trimmed) ||
      /^retry:/i.test(trimmed)
    ) {
      continue;
    }
    const hasDataPrefix = /^data:/i.test(trimmed);
    const payload = hasDataPrefix ? trimmed.slice(5).trim() : trimmed;
    if (!payload || payload === '[DONE]' || payload === 'DONE') continue;

    try {
      const parsed = JSON.parse(payload);
      const pieces = extractPiecesFromProxyJson(parsed);
      matchedChunks++;
      if (pieces.content) content += pieces.content;
      if (pieces.reasoning) reasoning += pieces.reasoning;
      if (pieces.finishReason) finishReason = pieces.finishReason;
      if (pieces.embeddedError) embeddedError = pieces.embeddedError;
      if (pieces.usageSummary) usageSummary = pieces.usageSummary;
    } catch {
      if (hasDataPrefix && !payload.startsWith('{') && !payload.startsWith('[')) {
        matchedChunks++;
        content += payload;
      }
    }
  }

  return {
    content,
    reasoning,
    finishReason,
    embeddedError,
    usageSummary,
    matchedChunks,
  };
}

async function readFlexibleProxyResponse(
  res: Response,
): Promise<FlexibleProxyResponse> {
  const httpStatus = res.status;
  const contentType = (res.headers.get('content-type') || '').trim();
  const ctLower = contentType.toLowerCase();

  let rawText = '';
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        rawText += decoder.decode(value, { stream: true });
      }
    }
    rawText += decoder.decode();
  } else {
    rawText = await res.text();
  }

  const trimmed = rawText.trim();
  const rawPreview = trimmed
    ? trimmed.replace(/\s+/g, ' ').slice(0, 220)
    : '(trống)';

  if (!trimmed) {
    return {
      httpStatus,
      contentType,
      format: 'empty',
      content: '',
      reasoning: '',
      rawPreview,
    };
  }

  if (/^<(?:!doctype\s+html|html)\b/i.test(trimmed)) {
    return {
      httpStatus,
      contentType,
      format: 'html',
      content: '',
      reasoning: '',
      embeddedError: 'Proxy trả về trang HTML thay vì JSON/SSE',
      rawPreview,
    };
  }

  const looksLikeSse =
    ctLower.includes('text/event-stream') || /^\s*data:/m.test(trimmed);

  if (looksLikeSse) {
    const sse = parseSseOrNdjsonPayload(trimmed);
    if (sse.matchedChunks > 0 || sse.content || sse.reasoning) {
      return {
        httpStatus,
        contentType,
        format: 'sse',
        content: sse.content,
        reasoning: sse.reasoning,
        finishReason: sse.finishReason,
        embeddedError: sse.embeddedError,
        usageSummary: sse.usageSummary,
        rawPreview,
      };
    }
  }

  // Try standard JSON (covers application/json or proxies returning JSON even when stream=true)
  try {
    const parsed = JSON.parse(trimmed);
    const pieces = extractPiecesFromProxyJson(parsed);
    return {
      httpStatus,
      contentType,
      format: 'json',
      content: pieces.content,
      reasoning: pieces.reasoning,
      finishReason: pieces.finishReason,
      embeddedError: pieces.embeddedError,
      usageSummary: pieces.usageSummary,
      rawPreview,
    };
  } catch {
    // Fallback: try NDJSON (multiple JSON objects separated by newlines without data: prefix)
    if (trimmed.includes('\n') && trimmed.startsWith('{')) {
      const nd = parseSseOrNdjsonPayload(trimmed);
      if (nd.matchedChunks > 0) {
        return {
          httpStatus,
          contentType,
          format: 'ndjson',
          content: nd.content,
          reasoning: nd.reasoning,
          finishReason: nd.finishReason,
          embeddedError: nd.embeddedError,
          usageSummary: nd.usageSummary,
          rawPreview,
        };
      }
    }
  }

  // Final fallback: direct plain-text response
  return {
    httpStatus,
    contentType,
    format: 'text',
    content: trimmed,
    reasoning: '',
    rawPreview,
  };
}

function formatProxyDiagnostic(
  resp: FlexibleProxyResponse,
  extraPreview?: string,
): string {
  const parts: string[] = [`HTTP ${resp.httpStatus}`];
  if (resp.contentType) {
    parts.push(`ct=${resp.contentType.split(';')[0].trim()}`);
  }
  parts.push(`fmt=${resp.format}`);
  if (resp.finishReason) parts.push(`finish=${resp.finishReason}`);
  if (resp.usageSummary) parts.push(`tok=${resp.usageSummary}`);
  if (resp.embeddedError) parts.push(`err=${resp.embeddedError}`);
  const preview = (extraPreview || resp.rawPreview || '').trim();
  if (preview) {
    parts.push(`raw=${preview.slice(0, 180)}`);
  }
  return parts.join(' | ');
}

export async function generateTurnSuggestionsWithAi(options: {
  state: ArkState;
  turnIndex?: number;
  existingSuggestions?: string[];
  signal?: AbortSignal;
  onLog?: (line: string) => void;
}): Promise<{
  ok: boolean;
  suggestions?: TurnSuggestionItem[];
  error?: string;
  aborted?: boolean;
  modelUsed?: string;
  usedCustomSlot?: boolean;
}> {
  const { state, existingSuggestions = [], signal, onLog } = options;
  const baseUrl = (state.config?.proxyUrl || '').trim();
  const resolvedSuggestionModel = resolveModelForTask(
    state.config,
    'suggestions',
  );
  const model = resolvedSuggestionModel.model;
  const apiKey = (state.config?.proxyKey || '').trim();

  if (!baseUrl) {
    return {
      ok: false,
      modelUsed: model,
      usedCustomSlot: resolvedSuggestionModel.isCustomSlot,
      error:
        'Chưa cấu hình Proxy URL. Hãy vào mục Cấu hình để thiết lập Proxy trước khi bấm AI gợi ý.',
    };
  }

  const turns = state.turns || [];
  const latestIdx =
    turns.length > 0
      ? typeof options.turnIndex === 'number' &&
        options.turnIndex >= 0 &&
        options.turnIndex < turns.length
        ? options.turnIndex
        : turns.length - 1
      : -1;
  const latestTurn = latestIdx >= 0 ? turns[latestIdx] : null;
  const prevTurn = latestIdx > 0 ? turns[latestIdx - 1] : null;

  const cleanLatestUser = latestTurn
    ? stripStoryPlanningAndMeta(latestTurn.user || '')
    : '';
  const cleanLatestAi = latestTurn
    ? stripStoryPlanningAndMeta(latestTurn.assistant || '')
    : '';
  const cleanPrevAi = prevTurn
    ? stripStoryPlanningAndMeta(prevTurn.assistant || '')
    : '';

  const activeComp = getStoryBoundCompanionFromState(state);
  const rawMcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    ''
  ).trim();
  const rawMcPronoun = (
    activeComp?.mc?.pronoun ||
    state.player?.pronoun ||
    ''
  ).trim();
  const sceneChars = resolveActiveSceneCharacters({
    currentUserText: cleanLatestUser,
    currentAiText: cleanLatestAi,
    recentTurns: turns.slice(Math.max(0, latestIdx - 2), Math.max(0, latestIdx)),
    mcName: rawMcName,
    mcPronoun: rawMcPronoun,
    mcAbsentAtStart: Boolean(state.player?.absentAtStart),
    npcs: activeComp?.npcs || [],
    portraits: state.portraitBank?.portraits || [],
    characterStates: state.memory?.characterStates || [],
    isolateUnconfirmedPortraits: true,
  });
  const mcPresent = sceneChars.mcPresent;
  const mcPronoun = sceneChars.validPronoun || 'tôi';

  const storyClock = normalizeStoryClock(state.memory?.storyClock);
  const clockFmt = formatStoryClock(storyClock);

  const presentKeySet = new Set(
    sceneChars.presentNames.map((n) => {
      const celeb = lookupKnownCelebrityProfile(n);
      return normalizeCharacterKey(celeb ? celeb.canonicalName : n);
    }),
  );
  const matchesPresentScene = (name?: string): boolean => {
    const clean = (name || '').trim();
    if (!clean) return false;
    const celeb = lookupKnownCelebrityProfile(clean);
    const key = normalizeCharacterKey(celeb ? celeb.canonicalName : clean);
    if (!key) return false;
    if (presentKeySet.has(key)) return true;
    for (const pk of presentKeySet) {
      if (pk.startsWith(`${key} `) || key.startsWith(`${pk} `)) return true;
    }
    return false;
  };

  // When an active story scene exists, strictly restrict NPC/state metadata to characters present in the scene
  // so characters from other locations, storylines, or saves can never leak into AI suggestions.
  const hasActiveSceneText = Boolean(cleanLatestUser || cleanLatestAi);
  const filteredNpcs = hasActiveSceneText
    ? (activeComp?.npcs || []).filter((n) => matchesPresentScene(n.name))
    : activeComp?.npcs || [];

  const roleTargetNames = sceneChars.presentNames.length
    ? sceneChars.presentNames.slice(0, 8)
    : !hasActiveSceneText
      ? [
          ...(state.portraitBank?.portraits || [])
            .filter((p) => p.pinned || p.isMc)
            .map((p) => p.name),
          ...filteredNpcs.map((n) => n.name),
        ].slice(0, 8)
      : [];

  const resolvedSceneRoles = resolveSceneCharacterRoles({
    names: roleTargetNames,
    portraits: state.portraitBank?.portraits || [],
    npcs: filteredNpcs,
    mcName: rawMcName,
  });

  const roleTagLines = resolvedSceneRoles
    .map((r) => {
      const tag = r.detailLabel
        ? `[${r.tierLabel} · ${r.detailLabel}]`
        : `[${r.tierLabel}]`;
      const pinNote = r.pinned ? ' (Ghim ưu tiên)' : '';
      const relNote = r.relationships
        ? ` — Quan hệ: ${r.relationships.slice(0, 95)}`
        : '';
      return `- ${r.name} ${tag}${pinNote}${relNote}`;
    })
    .join('\n');

  const keyFocusNames = resolvedSceneRoles
    .filter((r) => r.tier === 'main' || r.pinned)
    .map((r) => r.name);
  const mobNames = resolvedSceneRoles
    .filter((r) => r.tier === 'mob')
    .map((r) => r.name);

  // Pull personality, signature quirks, agenda & friction of characters present in the scene
  // so suggestions reflect real character chemistry instead of generic polite templates.
  const personalityLines: string[] = [];
  const addedTraitKeys = new Set<string>();
  const pushTraitLine = (
    name: string,
    parts: Array<string | undefined | null>,
  ) => {
    const key = normalizeCharacterKey(name);
    if (!key || addedTraitKeys.has(key)) return;
    const cleanParts = parts
      .map((p) => (p || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (!cleanParts.length) return;
    addedTraitKeys.add(key);
    personalityLines.push(`- ${name}: ${cleanParts.join(' | ').slice(0, 180)}`);
  };

  if (mcPresent && rawMcName) {
    pushTraitLine(rawMcName, [
      activeComp?.mc?.personality
        ? `Tính cách: ${activeComp.mc.personality.slice(0, 90)}`
        : state.player?.description
          ? `Đặc điểm: ${state.player.description.slice(0, 90)}`
          : '',
    ]);
  }
  for (const npc of filteredNpcs.slice(0, 6)) {
    pushTraitLine(npc.name, [
      npc.personality ? `Tính cách: ${npc.personality.slice(0, 80)}` : '',
      npc.signature ? `Nét riêng: ${npc.signature.slice(0, 55)}` : '',
      npc.agenda ? `Động cơ: ${npc.agenda.slice(0, 65)}` : '',
      npc.friction ? `Điểm va chạm: ${npc.friction.slice(0, 65)}` : '',
    ]);
  }
  for (const portrait of state.portraitBank?.portraits || []) {
    if (hasActiveSceneText && !matchesPresentScene(portrait.name)) continue;
    pushTraitLine(portrait.name, [
      portrait.personality
        ? `Tính cách: ${portrait.personality.slice(0, 85)}`
        : '',
      portrait.signature ? `Nét riêng: ${portrait.signature.slice(0, 55)}` : '',
    ]);
    if (personalityLines.length >= 6) break;
  }

  const recentUserActions = turns
    .slice(Math.max(0, latestIdx - 2), Math.max(0, latestIdx + 1))
    .map((t) => stripStoryPlanningAndMeta(t.user || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(-3)
    .map((txt) => trimToCleanSentence(txt, 140));

  const filteredStates = hasActiveSceneText
    ? (state.memory?.characterStates || []).filter((s) =>
        matchesPresentScene(s.name),
      )
    : (state.memory?.characterStates || []).slice(0, 6);
  const stateLines = filteredStates
    .slice(0, 6)
    .map((s) => {
      const parts = [
        s.location ? `Vị trí: ${s.location}` : '',
        s.mood ? `Tâm trạng: ${s.mood}` : '',
        s.status ? `Trạng thái: ${s.status}` : '',
      ].filter(Boolean);
      return `- ${s.name}${s.isMc ? ' (NV chính)' : ''}${parts.length ? `: ${parts.join(' | ')}` : ''}`;
    })
    .join('\n');

  const suggestionLocationHints = [
    state.world?.name || '',
    ...filteredStates.map((s) => s.location || ''),
  ].filter(Boolean);
  const relevantLongTermMemoryBlock = buildLongTermMemoryContextBlock({
    memory: state.memory,
    activeCharacterNames: sceneChars.presentNames,
    sceneText: [cleanLatestUser, extractTailExcerpt(cleanLatestAi, 700)]
      .filter(Boolean)
      .join(' '),
    locationHints: suggestionLocationHints,
    currentTurnIndex: Math.max(0, latestIdx),
    maxEntries: 6,
    maxChars: 920,
    includeRollingSummary: true,
    compactMode: true,
  });

  const existingList = existingSuggestions
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  const systemPrompt =
    'Bạn là người mở hướng chơi (scene sparker) cho ứng dụng nhập vai tiếng Việt Ark Lite. ' +
    'Nhiệm vụ: dựa sát diễn biến lượt hiện tại, tính cách & động cơ nhân vật, tag vai trò Portrait Bank ([Main], [NPC], [Mob]), trí nhớ dài hạn liên quan và đồng hồ truyện để đưa ra ĐÚNG 6 gợi ý mở đường giàu "đất diễn", để người chơi thoải mái chọn theo mood chứ KHÔNG ép vào khuôn mẫu ngoan hiền, khách sáo hay sáo mòn. ' +
    'QUY TẮC CHỐNG SÁO MÒN & LẶP VĂN (BẮT BUỘC): ' +
    '1) TUYỆT ĐỐI CẤM dùng các cụm từ rập khuôn đã nhàm như: "nhẹ nhàng mỉm cười", "khẽ mỉm cười", "mỉm cười dịu dàng/hiền", "dịu dàng hỏi thăm", "dịu giọng", "đặt nụ hôn lên trán", "vén sợi tóc mai", "ánh mắt thật hiền/trìu mến", "bằng giọng trầm ấm". ' +
    '2) 6 gợi ý phải PHÂN HÓA SẮC THÁI RÕ RỆT (thoải mái đời thường, tinh nghịch/lầy lội/cà khịa nhẹ, sắc bén/đẩy căng thẳng, đổi gió/phá thế tĩnh, táo bạo/tạo biến số hoặc tình huống chen ngang, và hạ nhịp/chuyển giờ gọn). Không lặp cùng kiểu mở câu hoặc cùng một sắc thái ở nhiều thẻ. ' +
    '3) NGẮN GỌN, SẮC NÉT CHO MÀN HÌNH ĐIỆN THOẠI: mỗi gợi ý chỉ khoảng 8–18 từ, đi thẳng vào hành động cụ thể hoặc kèm một câu thoại tự nhiên, đời thường, có cá tính; không viết dài dòng lê thê. ' +
    '4) CHỈ gọi đúng tên nhân vật THỰC SỰ có mặt trong cảnh (hoặc dùng đại từ/cách gọi tự nhiên nếu cảnh không nêu tên riêng); không kéo nhân vật ở mạch truyện khác vào (trừ khi gợi ý dạng biến số là tin nhắn/cuộc gọi hợp logic) và không viết chung chung "Nhân vật"/"Người chơi". ' +
    '5) Giữ trọng tâm theo Portrait Bank: [Main] là tâm điểm tương tác đa chiều theo đúng tính cách & không khí cảnh; [NPC] khớp vai trò & quan hệ; [Mob] giữ thực tế, gọn gàng, không đẩy thành tâm điểm tình cảm khi đã có [Main]/[NPC]. ' +
    '6) Nếu có lời hứa, bí mật hay mốc quan hệ trong trí nhớ dài hạn dính trực tiếp tới cảnh, hãy cài khéo vào 1–2 gợi ý. ' +
    'Không suy luận dài dòng, không giải thích; xuất thẳng DUY NHẤT JSON hợp lệ theo mẫu {"suggestions":[{"category":"continue|tease|probe|move|bold|rest","text":"..."}]}.';

  const verifiedMcActor =
    !isGenericCharacterPlaceholder(rawMcName) &&
    (!hasActiveSceneText || matchesPresentScene(rawMcName))
      ? rawMcName
      : sceneChars.actorName || mcPronoun;

  const promptParts = [
    state.world?.name || activeComp?.name
      ? `Thế giới / Phiên truyện: ${state.world?.name || activeComp?.name}${state.world?.genreLabel ? ` (${state.world.genreLabel})` : ''}.`
      : '',
    state.world?.atmosphere ? `Không khí bối cảnh: ${state.world.atmosphere}.` : '',
    storyClock.enabled
      ? `Đồng hồ truyện hiện tại: ${clockFmt.fullLabel}.`
      : '',
    sceneChars.presentNames.length
      ? `Nhân vật đang có mặt trực tiếp trong cảnh: ${sceneChars.presentNames.slice(0, 6).join(', ')} (Chỉ gọi tên các nhân vật đang có mặt này).`
      : 'Lưu ý: Chưa phát hiện tên riêng cụ thể trong đoạn cảnh này; hãy bám sát văn bản lượt truyện và dùng đại từ/cách gọi tự nhiên.',
    mcPresent
      ? `Chủ thể lượt gọi: ${verifiedMcActor}.`
      : sceneChars.presentNames.length
        ? `Lưu ý: Nhân vật chính không xuất hiện trực tiếp trong cảnh này; hãy viết gợi ý gọi thẳng tên các nhân vật đang có mặt (${sceneChars.presentNames.slice(0, 4).join(', ')}).`
        : 'Lưu ý: Hãy bám đúng góc nhìn và bối cảnh của lượt truyện gần nhất bằng cách gọi tự nhiên.',
    roleTagLines
      ? [
          'Tag vai trò từ Portrait Bank:',
          roleTagLines,
          keyFocusNames.length && mobNames.length
            ? `-> Trọng tâm chính: ${keyFocusNames.join(', ')}; giữ tương tác gọn & thực tế với Mob (${mobNames.join(', ')}).`
            : mobNames.length && !keyFocusNames.length
              ? `-> Lưu ý: ${mobNames.join(', ')} là [Mob] (nhân vật nền), giữ tương tác thực tế, chừng mực.`
              : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '',
    personalityLines.length
      ? `Tính cách & động cơ nhân vật trong cảnh (viết đúng chất từng người, không gò về một giọng lịch sự chung chung):\n${personalityLines.join('\n')}`
      : '',
    stateLines ? `Trạng thái hiện tại:\n${stateLines}` : '',
    relevantLongTermMemoryBlock ? relevantLongTermMemoryBlock : '',
    recentUserActions.length
      ? `Lượt gọi gần đây của người chơi (tránh lặp lại cùng hành động/mô-típ cũ):\n${recentUserActions.map((u) => `- ${u}`).join('\n')}`
      : '',
    cleanPrevAi
      ? `Đoạn cuối lượt trước (tham khảo):\n${extractTailExcerpt(cleanPrevAi, 380)}`
      : '',
    latestTurn
      ? [
          `--- LƯỢT TRUYỆN ĐANG XEM (Trang ${latestIdx + 1}) ---`,
          cleanLatestUser
            ? `[Lượt gọi gần nhất]: ${trimToCleanSentence(cleanLatestUser, 380)}`
            : '',
          cleanLatestAi
            ? `[Diễn biến mới nhất]: ${extractTailExcerpt(cleanLatestAi, 2100)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : state.world?.openingScenario
        ? `Tình huống mở màn: ${state.world.openingScenario}`
        : 'Phiên truyện mới bắt đầu, chưa có lượt nào.',
    existingList.length
      ? `Các gợi ý đã hiện (PHẢI ĐỔI HẲN Ý TƯỞNG, SẮC THÁI & CÁCH MỞ CÂU, KHÔNG XÀO LẠI):\n${existingList.map((s) => `- ${s}`).join('\n')}`
      : '',
    '--- YÊU CẦU 6 HƯỚNG PHÂN HÓA RÕ RỆT ---',
    'Xuất NGAY ĐÚNG 6 gợi ý theo 6 sắc thái đối lập nhau (mỗi câu 8–18 từ, gọn gàng, có lực đẩy truyện, có thể kèm thoại ngắn tự nhiên):',
    '1. "continue" (Thuận nhịp): Bắt thẳng sóng của cảnh hiện tại — phản ứng đời thường, tự nhiên hoặc sắc sảo đúng tính cách, không khách sáo.',
    '2. "tease" (Trêu ghẹo / Lầy lội): Chọc quê, cà khịa nhẹ, đùa tỉnh bơ hoặc bẻ mood nghiêm túc thành vui nhộn để xem đối phương đỡ thế nào.',
    '3. "probe" (Dò xét / Đẩy nhịp): Bắt bẻ chi tiết hở, hỏi thẳng vào chỗ ngại/bí mật, hoặc khơi lại một lời hứa/động cơ để tăng kịch tính hoặc chiều sâu.',
    '4. "move" (Đổi cảnh / Đổi gió): Phá thế đứng/ngồi yên — cầm đồ vật quanh đó làm gì đó cụ thể, đổi không gian hoặc rủ chuyển sang hoạt động mới hợp cảnh.',
    '5. "bold" (Táo bạo / Tạo biến số): Một cú rẽ khó lường — nước đi liều/thẳng thắn bất ngờ, lật bài ngửa, HOẶC tạo tình huống chen ngang hợp bối cảnh (điện thoại rung tin nhắn lạ, tiếng gõ cửa, sự cố nhỏ...) để khuấy động mạch truyện.',
    '6. "rest" (Đổi nhịp / Lắng lại): Hạ nhịp tự nhiên, tạm kết cảnh hoặc nhảy gọn sang mốc giờ/buổi kế tiếp khớp đồng hồ truyện — đời thường, không sướt mướt.',
    'Định dạng JSON bắt buộc:\n{"suggestions":[{"category":"continue","text":"..."},{"category":"tease","text":"..."},{"category":"probe","text":"..."},{"category":"move","text":"..."},{"category":"bold","text":"..."},{"category":"rest","text":"..."}]}',
  ]
    .filter(Boolean)
    .join('\n\n');

  const isGemini = detectIsGeminiProtocol(state.config);

  const hasGeminiSafety = Boolean(isGemini || /gemini/i.test(model));
  const rawMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: promptParts },
  ];
  const cleanNormalizedMsgs = normalizeMessagesForRequest(
    state,
    rawMessages,
    false,
  );

  // Mirror executeModelTurn's stream mode first (so proxies that require SSE stream work on attempt 1),
  // then fall back to the alternate transport mode and compatible payload without extra fields.
  const preferStream = Boolean(state.streamEnabled);
  const attemptVariants: Array<{
    msgs: ChatMessage[];
    withSafety: boolean;
    useStream: boolean;
    label: string;
  }> = [];

  if (hasGeminiSafety) {
    attemptVariants.push({
      msgs: cleanNormalizedMsgs,
      withSafety: true,
      useStream: preferStream,
      label: preferStream ? 'stream chuẩn' : 'chuẩn',
    });
  }
  attemptVariants.push({
    msgs: cleanNormalizedMsgs,
    withSafety: false,
    useStream: preferStream,
    label: preferStream ? 'stream tương thích' : 'tương thích',
  });
  attemptVariants.push({
    msgs: cleanNormalizedMsgs,
    withSafety: false,
    useStream: !preferStream,
    label: !preferStream ? 'stream dự phòng' : 'JSON dự phòng',
  });

  const existingKeys = new Set(
    existingList.map((s) => normalizeCharacterKey(s)).filter(Boolean),
  );

  // Generous output token budget so thinking/reasoning models (Gemini 2.5/3, DeepSeek R1, etc.)
  // do not exhaust max_tokens inside reasoning_content and leave message.content empty.
  const targetMaxTokens = /gemini/i.test(model) ? 16384 : 8192;

  onLog?.(`[AI Gợi ý] Đang sinh 6 gợi ý lượt đi từ ${model}...`);
  let lastErr = '';

  const parseSuggestionsWithFallback = (rawCandidate: string): TurnSuggestionItem[] => {
    if (!rawCandidate.trim()) return [];
    let parsed = parseAiSuggestionsFromRaw(rawCandidate, existingKeys);
    if (parsed.length < 6 && existingKeys.size > 0) {
      const fallbackAll = parseAiSuggestionsFromRaw(rawCandidate, new Set());
      const seenBatch = new Set(
        parsed.map((item) => normalizeCharacterKey(item.text)),
      );
      for (const item of fallbackAll) {
        const key = normalizeCharacterKey(item.text);
        if (!key || seenBatch.has(key)) continue;
        seenBatch.add(key);
        parsed.push(item);
        if (parsed.length >= 6) break;
      }
    }
    return parsed;
  };

  for (const variant of attemptVariants) {
    const endpoints = buildEndpointCandidates(
      baseUrl,
      model,
      variant.useStream,
      isGemini,
    );
    for (const url of endpoints) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
          if (isGemini) {
            headers['x-goog-api-key'] = apiKey;
          }
        }

        const messages = variant.msgs;
        const sysPrompts = messages
          .filter((m) => m.role === 'system')
          .map((m) => (typeof m.content === 'string' ? m.content : ''))
          .filter(Boolean);
        const nonSys = messages.filter((m) => m.role !== 'system');

        const body = isGemini
          ? {
              ...(sysPrompts.length
                ? {
                    systemInstruction: {
                      parts: [{ text: sysPrompts.join('\n\n') }],
                    },
                  }
                : {}),
              contents: nonSys.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [
                  {
                    text:
                      typeof m.content === 'string'
                        ? m.content
                        : JSON.stringify(m.content),
                  },
                ],
              })),
              generationConfig: { maxOutputTokens: targetMaxTokens },
              ...(variant.withSafety
                ? {
                    safetySettings:
                      state.config.safetySettings || DEFAULT_SAFETY,
                  }
                : {}),
            }
          : {
              model,
              messages,
              max_tokens: targetMaxTokens,
              stream: variant.useStream,
              ...(variant.withSafety && /gemini/i.test(model)
                ? {
                    safetySettings:
                      state.config.safetySettings || DEFAULT_SAFETY,
                  }
                : {}),
            };

        const res = await fetchProxyTarget({
          url,
          method: 'POST',
          headers,
          body,
          signal,
          useServerProxy: shouldUseServerProxy(state.config),
        });

        if (!res.ok) {
          const errTxt = await res.text().catch(() => '');
          lastErr = `HTTP ${res.status} [${variant.label}] tại ${url}${
            errTxt ? `: ${errTxt.replace(/\s+/g, ' ').trim().slice(0, 220)}` : ''
          }`;
          onLog?.(`[AI Gợi ý] ${lastErr}`);
          continue;
        }

        const extracted = await readFlexibleProxyResponse(res);
        const primaryContent = extracted.content.trim();
        const fallbackReasoning = extracted.reasoning.trim();

        if (!primaryContent && !fallbackReasoning) {
          const diag = formatProxyDiagnostic(extracted);
          lastErr = `Phản hồi rỗng [${variant.label}] từ ${url} (${diag})`;
          onLog?.(`[AI Gợi ý] ${lastErr}`);
          continue;
        }

        let parsed = parseSuggestionsWithFallback(primaryContent);
        if (!parsed.length && fallbackReasoning) {
          parsed = parseSuggestionsWithFallback(fallbackReasoning);
        }
        if (!parsed.length && primaryContent && fallbackReasoning) {
          parsed = parseSuggestionsWithFallback(
            `${primaryContent}\n${fallbackReasoning}`,
          );
        }

        if (parsed.length > 0) {
          onLog?.(
            `[AI Gợi ý] Hoàn tất [${variant.label}/${extracted.format}]: nhận ${parsed.length} gợi ý từ ${model}${resolvedSuggestionModel.isCustomSlot ? ' (slot Gợi ý)' : ' (fallback model chính)'}.`,
          );
          return {
            ok: true,
            suggestions: parsed.slice(0, 6),
            modelUsed: model,
            usedCustomSlot: resolvedSuggestionModel.isCustomSlot,
          };
        }

        const sampleText = String(primaryContent || fallbackReasoning || '')
          .replace(/\s+/g, ' ')
          .slice(0, 140);
        const diag = formatProxyDiagnostic(extracted, sampleText);
        lastErr = `Không đọc được danh sách gợi ý [${variant.label}] từ ${url} (${diag})`;
        onLog?.(`[AI Gợi ý] ${lastErr}`);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return {
            ok: false,
            aborted: true,
            error: 'Đã hủy yêu cầu AI gợi ý.',
            modelUsed: model,
            usedCustomSlot: resolvedSuggestionModel.isCustomSlot,
          };
        }
        lastErr = `${err instanceof Error ? err.message : String(err)} (${url})`;
        onLog?.(`[AI Gợi ý] Lỗi: ${lastErr}`);
      }
    }
  }

  return {
    ok: false,
    modelUsed: model,
    usedCustomSlot: resolvedSuggestionModel.isCustomSlot,
    error:
      lastErr ||
      'Không thể gọi Proxy API để tạo gợi ý. Hãy kiểm tra lại Proxy URL, API Key và Model.',
  };
}

// ============================================================================
// CULTIVATION RANKING BOARDS — MAIN PROSE API (10 NPC / BOARD, INTEL UNLOCK, AUTO RERANK)
// ============================================================================

function parseJsonObjectFromMainProseRaw(
  raw: string,
): Record<string, unknown> | null {
  const cleaned = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned) return null;

  const tryParse = (candidate: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      if (Array.isArray(parsed)) {
        return { entries: parsed };
      }
    } catch {
      try {
        const repaired = repairTruncatedJson(candidate);
        const parsed = JSON.parse(repaired);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        if (Array.isArray(parsed)) {
          return { entries: parsed };
        }
      } catch {
        // ignore
      }
    }
    return null;
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = tryParse(cleaned.slice(firstBrace, lastBrace + 1));
    if (sliced) return sliced;
  }

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const sliced = tryParse(cleaned.slice(firstBracket, lastBracket + 1));
    if (sliced) return sliced;
  }

  if (firstBrace >= 0) {
    const fromBrace = tryParse(cleaned.slice(firstBrace));
    if (fromBrace) return fromBrace;
  }

  return null;
}

async function executeMainProseJsonRequest(params: {
  state: ArkState;
  systemPrompt: string;
  userPrompt: string;
  logTag: string;
  signal?: AbortSignal;
  onLog?: (msg: string) => void;
}): Promise<{
  ok: boolean;
  data?: Record<string, unknown>;
  modelUsed: string;
  aborted?: boolean;
  error?: string;
}> {
  const { state, systemPrompt, userPrompt, logTag, signal, onLog } = params;
  const baseUrl = (state.config?.proxyUrl || '').trim().replace(/\/+$/, '');
  const apiKey = (state.config?.proxyKey || '').trim();
  const model = (state.config?.model || '').trim();

  if (!baseUrl || !model) {
    return {
      ok: false,
      modelUsed: model,
      error:
        'Chưa cấu hình Proxy URL hoặc Model viết truyện chính trong mục Cấu hình API.',
    };
  }

  const isGemini = detectIsGeminiProtocol(state.config);
  const hasGeminiSafety = Boolean(isGemini || /gemini/i.test(model));
  const rawMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const cleanNormalizedMsgs = normalizeMessagesForRequest(
    state,
    rawMessages,
    false,
  );

  const preferStream = Boolean(state.streamEnabled);
  const attemptVariants: Array<{
    msgs: ChatMessage[];
    withSafety: boolean;
    useStream: boolean;
    label: string;
  }> = [];

  if (hasGeminiSafety) {
    attemptVariants.push({
      msgs: cleanNormalizedMsgs,
      withSafety: true,
      useStream: preferStream,
      label: preferStream ? 'stream chuẩn' : 'chuẩn',
    });
  }
  attemptVariants.push({
    msgs: cleanNormalizedMsgs,
    withSafety: false,
    useStream: preferStream,
    label: preferStream ? 'stream tương thích' : 'tương thích',
  });
  attemptVariants.push({
    msgs: cleanNormalizedMsgs,
    withSafety: false,
    useStream: !preferStream,
    label: !preferStream ? 'stream dự phòng' : 'JSON dự phòng',
  });

  const targetMaxTokens = /gemini/i.test(model) ? 16384 : 8192;
  let lastErr = '';

  for (const variant of attemptVariants) {
    const endpoints = buildEndpointCandidates(
      baseUrl,
      model,
      variant.useStream,
      isGemini,
    );
    for (const url of endpoints) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
          if (isGemini) {
            headers['x-goog-api-key'] = apiKey;
          }
        }

        const messages = variant.msgs;
        const sysPrompts = messages
          .filter((m) => m.role === 'system')
          .map((m) => (typeof m.content === 'string' ? m.content : ''))
          .filter(Boolean);
        const nonSys = messages.filter((m) => m.role !== 'system');

        const body = isGemini
          ? {
              ...(sysPrompts.length
                ? {
                    systemInstruction: {
                      parts: [{ text: sysPrompts.join('\n\n') }],
                    },
                  }
                : {}),
              contents: nonSys.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [
                  {
                    text:
                      typeof m.content === 'string'
                        ? m.content
                        : JSON.stringify(m.content),
                  },
                ],
              })),
              generationConfig: { maxOutputTokens: targetMaxTokens },
              ...(variant.withSafety
                ? {
                    safetySettings:
                      state.config.safetySettings || DEFAULT_SAFETY,
                  }
                : {}),
            }
          : {
              model,
              messages,
              max_tokens: targetMaxTokens,
              stream: variant.useStream,
              ...(variant.withSafety && /gemini/i.test(model)
                ? {
                    safetySettings:
                      state.config.safetySettings || DEFAULT_SAFETY,
                  }
                : {}),
            };

        const res = await fetchProxyTarget({
          url,
          method: 'POST',
          headers,
          body,
          signal,
          useServerProxy: shouldUseServerProxy(state.config),
        });

        if (!res.ok) {
          const errTxt = await res.text().catch(() => '');
          lastErr = `HTTP ${res.status} [${variant.label}] tại ${url}${
            errTxt ? `: ${errTxt.replace(/\s+/g, ' ').trim().slice(0, 220)}` : ''
          }`;
          onLog?.(`[${logTag}] ${lastErr}`);
          continue;
        }

        const extracted = await readFlexibleProxyResponse(res);
        const primaryContent = extracted.content.trim();
        const fallbackReasoning = extracted.reasoning.trim();

        if (!primaryContent && !fallbackReasoning) {
          const diag = formatProxyDiagnostic(extracted);
          lastErr = `Phản hồi rỗng [${variant.label}] từ ${url} (${diag})`;
          onLog?.(`[${logTag}] ${lastErr}`);
          continue;
        }

        let parsed = parseJsonObjectFromMainProseRaw(primaryContent);
        if (!parsed && fallbackReasoning) {
          parsed = parseJsonObjectFromMainProseRaw(fallbackReasoning);
        }
        if (!parsed && primaryContent && fallbackReasoning) {
          parsed = parseJsonObjectFromMainProseRaw(
            `${primaryContent}\n${fallbackReasoning}`,
          );
        }

        if (parsed) {
          onLog?.(`[${logTag}] Hoàn tất từ model chính ${model}.`);
          return { ok: true, data: parsed, modelUsed: model };
        }

        const sampleText = String(primaryContent || fallbackReasoning || '')
          .replace(/\s+/g, ' ')
          .slice(0, 140);
        const diag = formatProxyDiagnostic(extracted, sampleText);
        lastErr = `Không đọc được JSON hợp lệ [${variant.label}] (${diag})`;
        onLog?.(`[${logTag}] ${lastErr}`);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return {
            ok: false,
            aborted: true,
            modelUsed: model,
            error: 'Đã hủy yêu cầu bảng thứ hạng.',
          };
        }
        lastErr = `${err instanceof Error ? err.message : String(err)} (${url})`;
        onLog?.(`[${logTag}] Lỗi: ${lastErr}`);
      }
    }
  }

  return {
    ok: false,
    modelUsed: model,
    error:
      lastErr ||
      'Không thể gọi API viết truyện chính. Hãy kiểm tra lại Proxy URL, API Key và Model chính.',
  };
}

function buildRankingWorldBrief(state: ArkState): {
  worldSummary: string;
  storyNpcNames: string[];
  mcSummary: string;
  clockSummary: string;
  recentProse: string;
} {
  const activeComp = getStoryBoundCompanionFromState(state);
  const mcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    'Nhân vật chính'
  ).trim();
  const cult = state.memory?.cultivation;
  const cultMeta = cult ? CULTIVATION_SYSTEM_META[cult.systemKind] : null;
  const cultDisplay = cult ? getCultivationDisplayInfo(cult) : null;
  const clockFmt = state.memory?.storyClock
    ? formatStoryClock(normalizeStoryClock(state.memory.storyClock))
    : null;

  const storyNpcSet = new Set<string>();
  for (const n of activeComp?.npcs || []) {
    if (n?.name?.trim()) storyNpcSet.add(n.name.trim());
  }
  for (const st of state.memory?.characterStates || []) {
    if (!st.isMc && st.name?.trim()) storyNpcSet.add(st.name.trim());
  }

  const recentTurns = (state.turns || []).slice(-3);
  const recentProse = recentTurns
    .map((t, idx) => {
      const cleanAi = splitNarrativeAndMeta(t.assistant || '', false).mainText;
      return `Lượt gần nhất #${idx + 1}: ${cleanAi.slice(-700)}`;
    })
    .filter(Boolean)
    .join('\n');

  const worldSummary = [
    state.world?.name ? `Tên thế giới: ${state.world.name}` : '',
    cultMeta ? `Hệ thống tu luyện: ${cultMeta.label}` : '',
    state.world?.setting ? `Bối cảnh: ${state.world.setting.slice(0, 750)}` : '',
    state.world?.rules ? `Quy tắc thế giới: ${state.world.rules.slice(0, 450)}` : '',
    state.world?.openingScenario
      ? `Khởi điểm: ${state.world.openingScenario.slice(0, 320)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const mcSummary = [
    `Nhân vật chính: ${mcName}`,
    cultDisplay ? `Cảnh giới hiện tại: ${cultDisplay.fullLabel}` : '',
    cult?.combatPowerNote ? `Chiến lực thực chiến: ${cult.combatPowerNote}` : '',
    cult?.lastSeclusionSummary
      ? `Diễn biến bế quan gần nhất: ${cult.lastSeclusionSummary}`
      : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    worldSummary,
    storyNpcNames: Array.from(storyNpcSet).slice(0, 24),
    mcSummary,
    clockSummary: clockFmt ? clockFmt.fullLabel : 'Chưa rõ niên lịch',
    recentProse,
  };
}

function normalizeAiRankingItem(
  raw: Record<string, unknown>,
  board: CultivationRankingBoard,
  fallbackRank: number,
  options?: { defaultUnlocked?: boolean; clockLabel?: string; prevRankMap?: Map<string, number> },
): CultivationRankingEntry | null {
  const name = String(raw.name || raw.ten || '').trim();
  if (!name) return null;
  const rawRank = Number(raw.rank ?? raw.hang ?? fallbackRank);
  const rank = Number.isFinite(rawRank)
    ? Math.max(1, Math.min(MAX_RANKING_ENTRIES_PER_BOARD, Math.trunc(rawRank)))
    : Math.min(MAX_RANKING_ENTRIES_PER_BOARD, fallbackRank);

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(1, Math.min(10000, Math.round(n))) : fallback;
  };

  const prodigyRaw = str(raw.prodigyTier);
  const prodigyTier: ProdigyTier | undefined =
    board === 'thien_kieu'
      ? prodigyRaw === 'nghich_thien'
        ? 'nghich_thien'
        : 'tre_the_gia'
      : undefined;

  const isVeteran =
    typeof raw.isVeteran === 'boolean'
      ? raw.isVeteran
      : board !== 'thien_kieu';

  const baseScore = Math.max(100, (11 - rank) * 850);
  const prevRank = options?.prevRankMap?.get(name.toLowerCase());

  return {
    id:
      str(raw.id) ||
      `rank_${board}_${Date.now()}_${fallbackRank}_${Math.random().toString(36).slice(2, 6)}`,
    board,
    rank,
    name,
    realm: str(raw.realm || raw.canhGioi) || 'Thâm bất khả trắc',
    combatPower: str(raw.combatPower || raw.chienLuc) || 'Danh chấn một phương',
    faction: str(raw.faction || raw.theLuc) || 'Tán tu ẩn thế',
    stance: str(raw.stance || raw.thaiDo) || 'Trung lập',
    scopeLabel:
      str(raw.scopeLabel) ||
      (board === 'thien'
        ? 'Toàn giới'
        : board === 'dia'
          ? 'Đại vực / Đại tông môn'
          : board === 'nhan'
            ? 'Khu vực hiện tại'
            : 'Thế hệ trẻ'),
    ...(prodigyTier ? { prodigyTier } : {}),
    isVeteran,
    intelUnlocked:
      typeof raw.intelUnlocked === 'boolean'
        ? raw.intelUnlocked
        : Boolean(options?.defaultUnlocked),
    rumorSummary:
      str(raw.rumorSummary || raw.phongThanh) ||
      `Nghe đồn ${name} thuộc ${str(raw.faction) || 'một thế lực bí ẩn'}, nổi danh trên ${CULTIVATION_RANKING_BOARD_META[board].label}.`,
    origin: str(raw.origin || raw.xuatThan) || undefined,
    techniquesOrBloodline:
      str(raw.techniquesOrBloodline || raw.congPhap) || undefined,
    deeds: str(raw.deeds || raw.chienTich) || undefined,
    latestActivity: str(raw.latestActivity || raw.dongThai) || undefined,
    powerScore: num(raw.powerScore, baseScore),
    fameScore: num(raw.fameScore, Math.round(baseScore * 0.9)),
    ...(typeof prevRank === 'number' ? { previousRank: prevRank } : {}),
    ...(typeof raw.isMc === 'boolean' ? { isMc: raw.isMc } : {}),
    ...(options?.clockLabel ? { lastUpdatedClock: options.clockLabel } : {}),
    updatedAt: Date.now(),
  };
}

/**
 * Generates 10 world-level strong NPCs per ranking board using the MAIN prose API model.
 * Ranking NPCs are strictly isolated from current story-turn NPCs and start locked as rumors
 * until the player visits a city/info hub and clicks an NPC to unlock their full dossier.
 */
export async function generateCultivationRankingsWithAi(params: {
  state: ArkState;
  targetBoard: CultivationRankingBoard | 'all';
  signal?: AbortSignal;
  onProgress?: (label: string) => void;
  onLog?: (msg: string) => void;
}): Promise<{
  ok: boolean;
  entries?: CultivationRankingEntry[];
  boardsGenerated?: CultivationRankingBoard[];
  modelUsed?: string;
  aborted?: boolean;
  error?: string;
}> {
  const { state, targetBoard, signal, onProgress, onLog } = params;
  const cult = state.memory?.cultivation;
  if (!cult || !cult.enabled) {
    return { ok: false, error: 'Chưa bật hệ thống tu luyện cho thế giới này.' };
  }

  const boards: CultivationRankingBoard[] =
    targetBoard === 'all' ? [...CULTIVATION_RANKING_BOARD_ORDER] : [targetBoard];

  const brief = buildRankingWorldBrief(state);
  const systemMeta = CULTIVATION_SYSTEM_META[cult.systemKind];
  const realmLadder = systemMeta.realms
    .filter((_, idx) => idx % 4 === 0 || idx === systemMeta.realms.length - 1)
    .map((r) => r.majorRealm)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(' → ');

  const allGenerated: CultivationRankingEntry[] = [];
  const boardsGenerated: CultivationRankingBoard[] = [];
  const usedNamesAcrossBoards = new Set<string>(
    (cult.rankings || [])
      .filter((r) => !boards.includes(r.board))
      .map((r) => r.name.trim().toLowerCase()),
  );
  let lastModel = (state.config?.model || '').trim();

  for (let bIdx = 0; bIdx < boards.length; bIdx++) {
    const boardId = boards[bIdx];
    const bMeta = CULTIVATION_RANKING_BOARD_META[boardId];
    onProgress?.(
      `Đang tạo ${bMeta.label} (${bIdx + 1}/${boards.length}) bằng model chính...`,
    );

    const boardGuidance: Record<CultivationRankingBoard, string> = {
      thien:
        'Thiên Bảng gồm 10 cường giả tối cao, lão tổ, chưởng giáo đại tông, tán tiên hoặc tuyệt thế cao thủ đứng đỉnh toàn giới/thiên hạ (cảnh giới cao nhất phù hợp hệ thống).',
      dia:
        'Địa Bảng gồm 10 cao thủ đầu tàu đại vực, trưởng lão/hộ pháp đại tông môn, tộc trưởng cổ tộc hoặc cường giả tầng trung–thượng lưu danh chấn bốn phương.',
      nhan:
        'Nhân Bảng gồm 10 cao thủ danh tiếng tại khu vực/đại châu/giang hồ hiện tại (cảnh giới trung cấp–khá mạnh, sát tầng lớp hành tẩu giang hồ của MC nhưng vẫn là cao thủ độc lập).',
      thien_kieu:
        'Bảng Thiên Kiêu gồm 10 thiên tài trẻ tuổi nổi danh đương đại; chia rõ "nghich_thien" (Nghịch Thiên Thiên Kiêu vượt cấp chiến đấu/huyết mạch cổ xưa) và "tre_the_gia" (Thiên Kiêu Trẻ / Hậu Duệ Thế Gia / Thánh Tử Thánh Nữ).',
    };

    const systemPrompt = [
      'Bạn là Thiên Cơ Các Chủ & chuyên gia thiết kế thế giới Hán-Việt cho game Text RPG Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp tiếng Việt.',
      'QUY TẮC TUYỆT ĐỐI:',
      '1. Chỉ trả về MỘT JSON object hợp lệ duy nhất, KHÔNG kèm lời bình, KHÔNG markdown.',
      '2. Phải tạo ĐÚNG 10 nhân vật mạnh, phong thái đa dạng, KHÔNG trùng tên nhau và KHÔNG trùng các NPC đang xuất hiện trong lượt truyện hiện tại.',
      '3. Các nhân vật này là cao thủ/thiên kiêu tầm cỡ thế giới (tách biệt với NPC lượt truyện thường ngày).',
      '4. Mỗi nhân vật phải có "rumorSummary" (1 câu phong thanh giang hồ ngắn gọn để hiển thị trước khi MC tới thành thị mở khóa thông tin đầy đủ) VÀ đầy đủ hồ sơ chi tiết (origin, realm, combatPower, techniquesOrBloodline, deeds, latestActivity, powerScore, fameScore).',
      `5. ${CULTIVATION_CHARACTER_NAMING_GUIDELINE}`,
      ...(cult.systemKind === 'wuxia'
        ? [`6. ${WUXIA_NPC_RARITY_RANKING_RULE}`]
        : []),
    ].join('\n');

    const userPrompt = [
      brief.worldSummary,
      `Niên lịch hiện tại: ${brief.clockSummary}`,
      `Bậc cảnh giới chuẩn của hệ thống ${systemMeta.label}: ${realmLadder}`,
      brief.mcSummary,
      brief.storyNpcNames.length
        ? `Danh sách NPC lượt truyện hiện tại (TRÁNH TRÙNG LẶP — hãy tạo cường giả bảng thứ hạng riêng biệt): ${brief.storyNpcNames.join(', ')}`
        : '',
      usedNamesAcrossBoards.size > 0
        ? `Tên đã có ở bảng khác (KHÔNG trùng lại): ${Array.from(usedNamesAcrossBoards).slice(0, 30).join(', ')}`
        : '',
      `YÊU CẦU TẠO BẢNG: ${bMeta.label} (${boardId})`,
      boardGuidance[boardId],
      `Xuất ĐÚNG 10 mục hạng 1..10 theo JSON:\n{"board":"${boardId}","entries":[{"rank":1,"name":"...","faction":"...","scopeLabel":"${boardId === 'thien' ? 'Toàn giới' : boardId === 'dia' ? 'Đại vực / Đại tông môn' : boardId === 'nhan' ? 'Khu vực hiện tại' : 'Thế hệ trẻ'}","rumorSummary":"1 câu phong thanh giang hồ","realm":"...","combatPower":"...","stance":"Trung lập / Thân thiện / Thù địch / Ẩn thế","origin":"Xuất thân ngắn gọn","techniquesOrBloodline":"Công pháp / huyết mạch / thần binh trứ danh","deeds":"Chiến tích nổi bật","latestActivity":"Tin đồn / động thái gần nhất","powerScore":9500,"fameScore":9200,"isVeteran":${boardId !== 'thien_kieu'}${boardId === 'thien_kieu' ? ',"prodigyTier":"nghich_thien"' : ''}}]}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const res = await executeMainProseJsonRequest({
      state,
      systemPrompt,
      userPrompt,
      logTag: `Bảng XH · ${bMeta.shortLabel}`,
      signal,
      onLog,
    });

    if (!res.ok || !res.data) {
      if (res.aborted) {
        return { ok: false, aborted: true, error: res.error, modelUsed: res.modelUsed };
      }
      if (allGenerated.length === 0) {
        return { ok: false, error: res.error, modelUsed: res.modelUsed };
      }
      break;
    }

    lastModel = res.modelUsed;
    const rawList = Array.isArray(res.data.entries)
      ? res.data.entries
      : Array.isArray(res.data.rankings)
        ? res.data.rankings
        : [];

    const boardEntries: CultivationRankingEntry[] = [];
    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item || typeof item !== 'object') continue;
      const norm = normalizeAiRankingItem(
        item as Record<string, unknown>,
        boardId,
        i + 1,
        {
          defaultUnlocked: false,
          clockLabel: brief.clockSummary,
        },
      );
      if (!norm) continue;
      const key = norm.name.toLowerCase();
      if (usedNamesAcrossBoards.has(key)) continue;
      usedNamesAcrossBoards.add(key);
      boardEntries.push(norm);
      if (boardEntries.length >= MAX_RANKING_ENTRIES_PER_BOARD) break;
    }

    if (boardEntries.length > 0) {
      allGenerated.push(...enforceTopTenPerBoard(boardEntries));
      boardsGenerated.push(boardId);
    }
  }

  if (allGenerated.length === 0) {
    return {
      ok: false,
      modelUsed: lastModel,
      error: 'Model không trả về danh sách nhân vật hợp lệ cho bảng thứ hạng.',
    };
  }

  return {
    ok: true,
    entries: enforceTopTenPerBoard(allGenerated),
    boardsGenerated,
    modelUsed: lastModel,
  };
}

/**
 * Unlocks / refreshes the full dossier of a single ranking NPC using the MAIN prose API model
 * when the MC is at a city, tavern, market, sect, or information hub.
 */
export async function unlockRankingNpcIntelWithAi(params: {
  state: ArkState;
  entry: CultivationRankingEntry;
  locationHint: string;
  signal?: AbortSignal;
  onLog?: (msg: string) => void;
}): Promise<{
  ok: boolean;
  updatedEntry?: CultivationRankingEntry;
  modelUsed?: string;
  aborted?: boolean;
  error?: string;
}> {
  const { state, entry, locationHint, signal, onLog } = params;
  const cult = state.memory?.cultivation;
  if (!cult || !cult.enabled) {
    return { ok: false, error: 'Chưa bật hệ thống tu luyện.' };
  }

  const brief = buildRankingWorldBrief(state);
  const bMeta = CULTIVATION_RANKING_BOARD_META[entry.board];

  const systemPrompt = [
    'Bạn là mạng lưới tình báo giang hồ / Thiên Cơ Các chuyên cung cấp hồ sơ cường giả khi nhân vật chính nghe ngóng tin tức tại thành thị/tửu lầu/phường thị/tông môn.',
    'Chỉ trả về MỘT JSON object hợp lệ duy nhất, KHÔNG markdown, KHÔNG lời dẫn.',
    'Hồ sơ phải nhất quán tuyệt đối với thế giới, bậc cảnh giới và vị trí xếp hạng hiện có của nhân vật; giọng văn tiếng Việt súc tích, giàu khí chất.',
    ...(cult.systemKind === 'wuxia' ? [WUXIA_NPC_RARITY_RANKING_RULE] : []),
  ].join('\n');

  const userPrompt = [
    brief.worldSummary,
    `Niên lịch hiện tại: ${brief.clockSummary}`,
    `Địa điểm MC đang nghe ngóng tin tức: ${locationHint}`,
    brief.mcSummary,
    `Nhân vật cần mở/cập nhật hồ sơ đầy đủ trên ${bMeta.label} (Hạng #${entry.rank}):`,
    `- Tên: ${entry.name}`,
    `- Thế lực hiện ghi nhận: ${entry.faction || 'Chưa rõ'}`,
    `- Phong thanh cũ: ${entry.rumorSummary || 'Chưa có'}`,
    entry.realm ? `- Cảnh giới cũ: ${entry.realm}` : '',
    entry.combatPower ? `- Chiến lực cũ: ${entry.combatPower}` : '',
    entry.deeds ? `- Chiến tích cũ: ${entry.deeds}` : '',
    'Hãy trả về JSON hồ sơ đầy đủ đã mở khóa:\n{"realm":"Cảnh giới chính xác","combatPower":"Đánh giá chiến lực thực chiến và đặc điểm nguy hiểm","faction":"Tông môn / Gia tộc / Thế lực","stance":"Thái độ / Vị thế hiện tại","origin":"Xuất thân, lai lịch, sư thừa (1-2 câu)","techniquesOrBloodline":"Công pháp trấn phái, huyết mạch, thể chất hoặc thần binh/pháp bảo nổi tiếng (1-2 câu)","deeds":"1-2 chiến tích lẫy lừng làm nên danh tiếng trên bảng","latestActivity":"Tin đồn / hành tung gần nhất nghe được tại thành thị/tửu lầu (1-2 câu)","rumorSummary":"1 câu tóm tắt ngắn gọn danh tiếng","powerScore":8500,"fameScore":8300}',
  ]
    .filter(Boolean)
    .join('\n\n');

  const res = await executeMainProseJsonRequest({
    state,
    systemPrompt,
    userPrompt,
    logTag: `Mở tin · ${entry.name}`,
    signal,
    onLog,
  });

  if (!res.ok || !res.data) {
    return {
      ok: false,
      aborted: res.aborted,
      modelUsed: res.modelUsed,
      error: res.error,
    };
  }

  const d = res.data;
  const pick = (k: string, fallback?: string) => {
    const v = d[k];
    return typeof v === 'string' && v.trim() ? v.trim() : fallback;
  };
  const pickNum = (k: string, fallback?: number) => {
    const n = Number(d[k]);
    return Number.isFinite(n)
      ? Math.max(1, Math.min(10000, Math.round(n)))
      : fallback;
  };

  const updatedEntry: CultivationRankingEntry = {
    ...entry,
    realm: pick('realm', entry.realm) || entry.realm,
    combatPower: pick('combatPower', entry.combatPower) || entry.combatPower,
    faction: pick('faction', entry.faction) || entry.faction,
    stance: pick('stance', entry.stance) || entry.stance,
    origin: pick('origin', entry.origin),
    techniquesOrBloodline: pick(
      'techniquesOrBloodline',
      entry.techniquesOrBloodline,
    ),
    deeds: pick('deeds', entry.deeds),
    latestActivity: pick('latestActivity', entry.latestActivity),
    rumorSummary: pick('rumorSummary', entry.rumorSummary),
    powerScore: pickNum('powerScore', entry.powerScore),
    fameScore: pickNum('fameScore', entry.fameScore),
    intelUnlocked: true,
    lastUpdatedClock: brief.clockSummary,
    updatedAt: Date.now(),
  };

  return {
    ok: true,
    updatedEntry,
    modelUsed: res.modelUsed,
  };
}

/**
 * Automatically recalculates rank rises/drops on a board (or all populated boards)
 * based on realm/combat power AND fame/deeds using the MAIN prose API model.
 * Keeps strictly Top 10 per board (if a newcomer or MC breaks into Top 10, rank #10 drops off)
 * and records previousRank so the UI displays ▲ / ▼ / Mới deltas.
 */
export async function recalculateCultivationRankingsWithAi(params: {
  state: ArkState;
  targetBoard: CultivationRankingBoard | 'all';
  signal?: AbortSignal;
  onProgress?: (label: string) => void;
  onLog?: (msg: string) => void;
}): Promise<{
  ok: boolean;
  updatedRankings?: CultivationRankingEntry[];
  changeSummary?: string;
  modelUsed?: string;
  aborted?: boolean;
  error?: string;
}> {
  const { state, targetBoard, signal, onProgress, onLog } = params;
  const cult = state.memory?.cultivation;
  if (!cult || !cult.enabled) {
    return { ok: false, error: 'Chưa bật hệ thống tu luyện.' };
  }

  const existingAll = enforceTopTenPerBoard(cult.rankings || []);
  const boardsToProcess: CultivationRankingBoard[] =
    targetBoard === 'all'
      ? CULTIVATION_RANKING_BOARD_ORDER.filter((b) =>
          existingAll.some((e) => e.board === b),
        )
      : [targetBoard];

  if (boardsToProcess.length === 0) {
    return {
      ok: false,
      error: 'Chưa có dữ liệu bảng nào để tính biến động hạng. Hãy bấm "AI tạo bảng (10 NPC)" trước.',
    };
  }

  const brief = buildRankingWorldBrief(state);
  const activeComp = getStoryBoundCompanionFromState(state);
  const mcName = (
    activeComp?.mc?.name ||
    state.player?.name ||
    'Nhân vật chính'
  ).trim();

  const nextByBoard = new Map<CultivationRankingBoard, CultivationRankingEntry[]>();
  for (const b of CULTIVATION_RANKING_BOARD_ORDER) {
    nextByBoard.set(
      b,
      existingAll.filter((e) => e.board === b),
    );
  }

  const summaries: string[] = [];
  let lastModel = (state.config?.model || '').trim();

  for (let idx = 0; idx < boardsToProcess.length; idx++) {
    const boardId = boardsToProcess[idx];
    const currentEntries = nextByBoard.get(boardId) || [];
    if (currentEntries.length === 0) continue;

    const bMeta = CULTIVATION_RANKING_BOARD_META[boardId];
    onProgress?.(
      `Đang tính biến động ${bMeta.label} (${idx + 1}/${boardsToProcess.length})...`,
    );

    const prevMap = new Map<string, CultivationRankingEntry>();
    const prevRankMap = new Map<string, number>();
    for (const e of currentEntries) {
      const k = e.name.trim().toLowerCase();
      prevMap.set(k, e);
      prevRankMap.set(k, e.rank);
    }

    const systemPrompt = [
      'Bạn là Thiên Cơ Các chuyên cập nhật biến động tăng/giảm hạng cho Bảng Thứ Hạng (tối đa 10 người/bảng).',
      'Chỉ trả về MỘT JSON object hợp lệ duy nhất, KHÔNG markdown.',
      'Quy tắc cập nhật hạng:',
      '1. Xét đồng thời CẢ HAI tiêu chí: Cảnh giới/Chiến lực thực chiến (powerScore) VÀ Danh tiếng/Chiến tích gần đây (fameScore).',
      '2. Có thể có 1–3 biến động hợp lý (tăng hạng do đột phá/lập chiến công, tụt hạng do bại trận/ẩn cư, hoặc 1 nhân tố mới/nhân vật chính chen vào Top 10 đẩy hạng 10 cũ rớt bảng — chỉ đưa MC vào bảng nếu cảnh giới & chiến tích thực sự tương xứng với cấp bậc bảng đó).',
      '3. Giữ nguyên tên các cường giả cũ không rớt bảng, giữ tối đa ĐÚNG 10 người hạng 1..10.',
      '4. Nếu xuất hiện tân tinh/cường giả mới chen vào bảng: không cấm cứng họ hay chữ đệm quen thuộc nếu hợp thân phận/tông môn, nhưng không đặt trùng tên hay lặp dày chữ lót/tên chính với 9 người còn lại; giữ âm điệu Bằng – Trắc tự nhiên, có thần thái riêng.',
    ].join('\n');

    const currentListText = currentEntries
      .map(
        (e) =>
          `#${e.rank} ${e.name}${e.isMc ? ' [MC]' : ''} | Cảnh giới: ${e.realm} | Chiến lực: ${e.combatPower} | Thế lực: ${e.faction} | Điểm lực: ${e.powerScore ?? 5000} | Điểm danh: ${e.fameScore ?? 5000}${e.latestActivity ? ` | Gần nhất: ${e.latestActivity}` : ''}`,
      )
      .join('\n');

    const userPrompt = [
      brief.worldSummary,
      `Niên lịch hiện tại: ${brief.clockSummary}`,
      brief.mcSummary,
      brief.recentProse
        ? `Diễn biến truyện gần đây:\n${brief.recentProse}`
        : '',
      `DANH SÁCH HIỆN TẠI CỦA ${bMeta.label} (${boardId}):\n${currentListText}`,
      `Hãy tính toán lại Top 10 của ${bMeta.label} sau các biến động gần đây (nếu ${mcName} đủ thực lực & chiến tích xứng tầm ${bMeta.label} thì có thể đưa vào với "isMc":true; nếu chưa đủ tầm thì tuyệt đối không ép vào). Trả về JSON:\n{"summary":"1 câu ngắn gọn tóm tắt biến động nổi bật nhất của bảng","entries":[{"rank":1,"name":"...","realm":"...","combatPower":"...","faction":"...","stance":"...","rumorSummary":"...","latestActivity":"Lý do tăng/giảm/giữ hạng","powerScore":9500,"fameScore":9200,"isMc":false}]}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const res = await executeMainProseJsonRequest({
      state,
      systemPrompt,
      userPrompt,
      logTag: `Biến động · ${bMeta.shortLabel}`,
      signal,
      onLog,
    });

    if (!res.ok || !res.data) {
      if (res.aborted) {
        return { ok: false, aborted: true, error: res.error, modelUsed: res.modelUsed };
      }
      if (summaries.length === 0 && boardsToProcess.length === 1) {
        return { ok: false, error: res.error, modelUsed: res.modelUsed };
      }
      continue;
    }

    lastModel = res.modelUsed;
    const rawList = Array.isArray(res.data.entries) ? res.data.entries : [];
    const updatedBoardEntries: CultivationRankingEntry[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const raw = rawList[i];
      if (!raw || typeof raw !== 'object') continue;
      const rec = raw as Record<string, unknown>;
      const rawName = String(rec.name || '').trim();
      if (!rawName) continue;
      const existing = prevMap.get(rawName.toLowerCase());
      const isMcFlag =
        Boolean(rec.isMc) ||
        rawName.toLowerCase() === mcName.toLowerCase();

      const norm = normalizeAiRankingItem(rec, boardId, i + 1, {
        defaultUnlocked: existing ? existing.intelUnlocked : isMcFlag,
        clockLabel: brief.clockSummary,
        prevRankMap,
      });
      if (!norm) continue;

      updatedBoardEntries.push({
        ...(existing || {}),
        ...norm,
        id: existing?.id || norm.id,
        origin: norm.origin || existing?.origin,
        techniquesOrBloodline:
          norm.techniquesOrBloodline || existing?.techniquesOrBloodline,
        deeds: norm.deeds || existing?.deeds,
        intelUnlocked: isMcFlag
          ? true
          : existing?.intelUnlocked ?? norm.intelUnlocked,
        isMc: isMcFlag ? true : existing?.isMc,
        previousRank: existing ? existing.rank : undefined,
      });
      if (updatedBoardEntries.length >= MAX_RANKING_ENTRIES_PER_BOARD) break;
    }

    if (updatedBoardEntries.length > 0) {
      nextByBoard.set(boardId, enforceTopTenPerBoard(updatedBoardEntries));
      const sumText =
        typeof res.data.summary === 'string' && res.data.summary.trim()
          ? res.data.summary.trim()
          : `${bMeta.label} đã cập nhật biến động Top ${updatedBoardEntries.length}.`;
      summaries.push(`${bMeta.shortLabel}: ${sumText}`);
    }
  }

  const mergedAll: CultivationRankingEntry[] = [];
  for (const b of CULTIVATION_RANKING_BOARD_ORDER) {
    mergedAll.push(...(nextByBoard.get(b) || []));
  }

  return {
    ok: true,
    updatedRankings: enforceTopTenPerBoard(mergedAll),
    changeSummary:
      summaries.join(' | ') || 'Đã cập nhật biến động bảng thứ hạng.',
    modelUsed: lastModel,
  };
}

export interface SimulateTopNpcSparResult {
  ok: boolean;
  npcAName?: string;
  npcARank?: number;
  npcBName?: string;
  npcBRank?: number;
  board?: CultivationRankingBoard;
  boardLabel?: string;
  venue?: string;
  summary?: string;
  verdict?: string;
  modelUsed?: string;
  aborted?: boolean;
  error?: string;
}

/**
 * Pure read-only AI simulation of a sparring match between the top two non-MC NPCs
 * on the active ranking board. Never mutates `state`, MC stats, rankings, or story history.
 */
export async function simulateTopNpcSparWithAi(params: {
  state: ArkState;
  targetBoard: CultivationRankingBoard | 'all';
  npcA?: CultivationRankingEntry;
  npcB?: CultivationRankingEntry;
  signal?: AbortSignal;
  onProgress?: (msg: string) => void;
  onLog?: (msg: string) => void;
}): Promise<SimulateTopNpcSparResult> {
  const { state, targetBoard, signal, onProgress, onLog } = params;
  const cult = state.memory?.cultivation;
  if (!cult || !cult.enabled) {
    return { ok: false, error: 'Chưa bật hệ thống tu luyện.' };
  }

  let fighterA = params.npcA;
  let fighterB = params.npcB;
  let resolvedBoard: CultivationRankingBoard | undefined =
    fighterA?.board || (targetBoard !== 'all' ? targetBoard : undefined);

  if (!fighterA || !fighterB) {
    const allNpcs = enforceTopTenPerBoard(cult.rankings || []).filter(
      (entry) => !entry.isMc,
    );
    if (targetBoard !== 'all') {
      const onBoard = allNpcs
        .filter((e) => e.board === targetBoard)
        .sort((a, b) => a.rank - b.rank);
      fighterA = onBoard[0];
      fighterB = onBoard[1];
      resolvedBoard = targetBoard;
    } else {
      for (const b of CULTIVATION_RANKING_BOARD_ORDER) {
        const onBoard = allNpcs
          .filter((e) => e.board === b)
          .sort((a, b) => a.rank - b.rank);
        if (onBoard.length >= 2) {
          fighterA = onBoard[0];
          fighterB = onBoard[1];
          resolvedBoard = b;
          break;
        }
      }
      if (!fighterA || !fighterB) {
        const boardIdx = (b: CultivationRankingBoard) =>
          CULTIVATION_RANKING_BOARD_ORDER.indexOf(b);
        const sortedAll = allNpcs.slice().sort((a, b) => {
          const bd = boardIdx(a.board) - boardIdx(b.board);
          return bd !== 0 ? bd : a.rank - b.rank;
        });
        fighterA = sortedAll[0];
        fighterB = sortedAll[1];
        resolvedBoard = fighterA?.board;
      }
    }
  }

  if (!fighterA || !fighterB) {
    return {
      ok: false,
      error:
        'Cần ít nhất 2 NPC (không tính nhân vật chính) trên bảng thứ hạng để giả lập so kè.',
    };
  }

  const boardLabel =
    resolvedBoard && CULTIVATION_RANKING_BOARD_META[resolvedBoard]
      ? CULTIVATION_RANKING_BOARD_META[resolvedBoard].label
      : 'Bảng Thứ Hạng';

  onProgress?.(
    `Đang giả lập trận so kè: #${fighterA.rank} ${fighterA.name} vs #${fighterB.rank} ${fighterB.name}...`,
  );

  const brief = buildRankingWorldBrief(state);
  const genreToneInstruction =
    cult.systemKind === 'wuxia'
      ? 'Phong cách KIẾM HIỆP GIANG HỒ (hồn cốt Cửu Âm): khắc họa sắc nét bộ pháp, kiếm ý/đao ý/chưởng phong, nội lực thâm hậu và thế tương khắc Thực Chiêu – Hư Chiêu – Giá Chiêu.'
      : cult.systemKind === 'xuanhuan'
        ? 'Phong cách HUYỀN HUYỄN: khắc họa uy áp huyền khí, huyết mạch dị tượng, thần binh và khí thế chiến kỹ.'
        : 'Phong cách TIÊN HIỆP: khắc họa đạo vận, linh lực uy áp, phi kiếm/bản mệnh pháp bảo và thần thông biến hóa.';

  const formatFighter = (f: CultivationRankingEntry, tag: string) =>
    [
      `${tag}: ${f.name} (Hạng #${f.rank} · ${CULTIVATION_RANKING_BOARD_META[f.board]?.shortLabel || boardLabel})`,
      `Cảnh giới: ${f.realm || 'Chưa rõ'}`,
      `Chiến lực: ${f.combatPower || 'Thực lực tương xứng cảnh giới'}`,
      `Thế lực: ${f.faction || 'Tán tu / Ẩn thế'}`,
      f.techniquesOrBloodline
        ? `Công pháp / Tuyệt học: ${f.techniquesOrBloodline}`
        : '',
      f.rumorSummary ? `Phong thanh: ${f.rumorSummary}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

  const systemPrompt = [
    'Bạn là Thiên Cơ Các đang tái hiện một màn SO KÈ GIẢ LẬP ngắn giữa hai cao thủ top đầu trên Bảng Thứ Hạng.',
    'Chỉ trả về MỘT JSON object hợp lệ duy nhất, KHÔNG markdown, KHÔNG giải thích ngoài JSON.',
    genreToneInstruction,
    'QUY TẮC BẮT BUỘC:',
    '1. Đây là trận giao thủ mô phỏng ngoại truyện chỉ giữa ĐÚNG 2 NPC được nêu. TUYỆT ĐỐI KHÔNG nhắc tới Nhân vật chính (MC) và KHÔNG làm thay đổi mạch truyện hay thứ hạng hiện tại.',
    '2. Trọng tâm là PHONG THÁI CHIÊU THỨC, khí thế ra đòn, nhịp công thủ và sự tương khắc đặc trưng của từng người — viết súc tích, giàu hình ảnh võ học/tu luyện, dài khoảng 3–5 câu (90–160 từ tiếng Việt).',
    '3. Giữ văn phong cổ phong tự nhiên, tránh lặp từ hay liệt kê chỉ số máy móc.',
  ].join('\n');

  const userPrompt = [
    brief.worldSummary,
    `Bảng đấu: ${boardLabel}`,
    formatFighter(fighterA, 'Cao thủ A'),
    formatFighter(fighterB, 'Cao thủ B'),
    'Hãy giả lập màn so kè ngắn giữa hai vị cao thủ trên và trả về đúng định dạng JSON:\n{"venue":"Địa điểm / bối cảnh giao thủ ngắn 4-9 chữ","summary":"Đoạn mô tả ngắn 3-5 câu về phong thái chiêu thức, khí thế và cách giao chiêu của hai người","verdict":"1 câu ngắn gọn chốt thế cục (VD: Bất phân thắng bại / Người nào tạm chiếm thượng phong nửa chiêu và vì sao)"}',
  ]
    .filter(Boolean)
    .join('\n\n');

  const res = await executeMainProseJsonRequest({
    state,
    systemPrompt,
    userPrompt,
    logTag: `So kè · ${fighterA.name} vs ${fighterB.name}`,
    signal,
    onLog,
  });

  if (!res.ok || !res.data) {
    return {
      ok: false,
      aborted: res.aborted,
      error: res.error || 'Không thể giả lập trận so kè vào lúc này.',
      modelUsed: res.modelUsed,
    };
  }

  const cleanText = (v: unknown): string =>
    typeof v === 'string'
      ? stripStoryPlanningAndMeta(v).replace(/\s+/g, ' ').trim()
      : '';

  const summary =
    cleanText(res.data.summary) ||
    cleanText(res.data.description) ||
    cleanText(res.data.narration);

  if (!summary) {
    return {
      ok: false,
      error: 'AI không trả về nội dung mô tả trận so kè. Vui lòng thử lại.',
      modelUsed: res.modelUsed,
    };
  }

  const venue = cleanText(res.data.venue) || undefined;
  const verdict = cleanText(res.data.verdict) || undefined;

  return {
    ok: true,
    npcAName: fighterA.name,
    npcARank: fighterA.rank,
    npcBName: fighterB.name,
    npcBRank: fighterB.rank,
    board: resolvedBoard,
    boardLabel,
    venue,
    summary,
    verdict,
    modelUsed: res.modelUsed,
  };
}



