import type {
  AppConfig,
  ArkState,
  CharacterPortrait,
  ShowbizPhoneApiConfig,
  ShowbizPhoneComment,
  ShowbizPhoneContact,
  ShowbizPhoneGroup,
  ShowbizPhoneMessage,
  ShowbizPhonePost,
  ShowbizPhoneState,
} from '../types/ark';
import {
  callAiJsonOrTextDetailed,
  extractPresentCharactersFromScene,
  resolveModelForTask,
  stripStoryPlanningAndMeta,
} from './api';
import {
  areIdentityKeysShadowMatch,
  findKnownCelebritiesInText,
  isChatOrNonPersonDescription,
  isLyricOrExclamationJunkName,
  isNonPersonCultivationOrWorldTerm,
  isShortCodeOrBracketedJunkName,
  isShortenedTailOfFullNameKey,
  lookupKnownCelebrityProfile,
  normalizeCharacterKey,
  resolvePortraitRoleTier,
  sanitizeCharacterName,
} from './characterUtils';
import {
  createDefaultShowbizPhoneState,
  getStoryBoundCompanionFromState,
  sanitizeShowbizPhoneApiConfig,
} from './storage';

export interface ShowbizPhoneRuntimeSummary {
  effectiveProxyUrl: string;
  effectiveModel: string;
  effectiveProtocol: AppConfig['apiProtocol'];
  effectiveUseServerProxy: boolean;
  hasCustomEndpoint: boolean;
  hasCustomModel: boolean;
  hasCustomKey: boolean;
  isReady: boolean;
}

export interface ShowbizMcProfile {
  name: string;
  handle: string;
  role: string;
  pronoun: string;
  bio: string;
  avatarData?: string;
  sourceLabel: string;
  isGenericFallback: boolean;
}

export function resolveShowbizPhoneRuntimeSummary(
  config?: Partial<AppConfig> | null,
): ShowbizPhoneRuntimeSummary {
  const dedicated: ShowbizPhoneApiConfig = sanitizeShowbizPhoneApiConfig(
    config?.showbizPhoneConfig,
  );
  const mainUrl = (config?.proxyUrl || '').trim();
  const effectiveProxyUrl = (dedicated.proxyUrl || mainUrl).trim();
  const hasCustomEndpoint = Boolean(
    dedicated.proxyUrl && dedicated.proxyUrl !== mainUrl,
  );
  const resolvedSlot = resolveModelForTask(config, 'showbizPhone');
  const effectiveModel = (
    dedicated.model ||
    resolvedSlot.model ||
    ''
  ).trim();
  const hasCustomModel = Boolean(
    dedicated.model || (config?.taskModels?.showbizPhone || '').trim(),
  );
  const hasCustomKey = Boolean(dedicated.proxyKey);
  const effectiveProtocol: AppConfig['apiProtocol'] =
    dedicated.apiProtocol === 'openai' ||
    dedicated.apiProtocol === 'auto' ||
    dedicated.apiProtocol === 'gemini'
      ? dedicated.apiProtocol
      : config?.apiProtocol || 'openai';
  const effectiveUseServerProxy =
    typeof dedicated.useServerProxy === 'boolean'
      ? dedicated.useServerProxy
      : typeof config?.useServerProxy === 'boolean'
        ? config.useServerProxy
        : true;

  return {
    effectiveProxyUrl,
    effectiveModel,
    effectiveProtocol,
    effectiveUseServerProxy,
    hasCustomEndpoint,
    hasCustomModel,
    hasCustomKey,
    isReady: Boolean(effectiveProxyUrl),
  };
}

/**
 * Tạo bản sao nhẹ của ArkState với cấu hình AI đã được cô lập riêng cho Điện thoại Showbiz.
 * Hoàn toàn không chỉnh sửa `state.config` gốc hay ngữ cảnh màn Truyện chính.
 */
export function buildShowbizPhoneEffectiveState(state: ArkState): ArkState {
  const dedicated = sanitizeShowbizPhoneApiConfig(
    state.config?.showbizPhoneConfig,
  );
  const runtime = resolveShowbizPhoneRuntimeSummary(state.config);
  const effectiveKey = (dedicated.proxyKey || state.config?.proxyKey || '').trim();

  const effectiveConfig: AppConfig = {
    ...state.config,
    proxyUrl: runtime.effectiveProxyUrl,
    proxyKey: effectiveKey,
    model: runtime.effectiveModel || state.config.model,
    apiProtocol: runtime.effectiveProtocol,
    useServerProxy: runtime.effectiveUseServerProxy,
    taskModels: {
      ...(state.config.taskModels || {}),
      ...(runtime.effectiveModel ? { showbizPhone: runtime.effectiveModel } : {}),
    },
    showbizPhoneConfig: dedicated,
  };

  return {
    ...state,
    config: effectiveConfig,
  };
}

export function makeShowbizHandle(name: string, fallbackIdx = 1): string {
  const cleaned = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
  return `@${cleaned || `contact${fallbackIdx}`}`;
}

const GENERIC_MC_PLACEHOLDER_RE =
  /^(?:nhân\s*vật\s*chính|nv\s*chính|mc|main|player|người\s*chơi|tôi|bạn)$/i;

const EXPLICIT_PLAYER_MAIN_ROLE_RE =
  /(?:^|\s|\/|·|-|:)(?:main|nhân\s*vật\s*chính|nv\s*chính|mc)(?:\s|$|\/|·|-|:)/i;

const EXPLICIT_NON_MAIN_ROLE_RE =
  /(?:^|\s|\/|·|-|:)(?:npc|vai\s*phụ|nhân\s*vật\s*phụ|mob|quần\s*chúng|qua\s*đường|người\s*nền)(?:\s|$|\/|·|-|:)/i;

function isGenericMcPlaceholderName(rawName?: string | null): boolean {
  const clean = String(rawName || '').trim();
  return !clean || GENERIC_MC_PLACEHOLDER_RE.test(clean);
}

function isPortraitDemotedToNonMain(
  p: Pick<CharacterPortrait, 'role' | 'isMc'>,
): boolean {
  const role = String(p.role || '').trim();
  if (EXPLICIT_NON_MAIN_ROLE_RE.test(role)) return true;
  const tierInfo = resolvePortraitRoleTier(p);
  return tierInfo.tier === 'npc' || tierInfo.tier === 'mob';
}

function isPortraitExplicitPlayerMain(
  p: Pick<CharacterPortrait, 'role' | 'isMc'>,
): boolean {
  if (isPortraitDemotedToNonMain(p)) return false;
  return EXPLICIT_PLAYER_MAIN_ROLE_RE.test(String(p.role || '').trim());
}

function isContactNameMc(name: string, mcName: string): boolean {
  const key = normalizeCharacterKey(name);
  const mcKey = normalizeCharacterKey(mcName);
  if (!key || !mcKey) return false;
  return (
    key === mcKey ||
    areIdentityKeysShadowMatch(new Set([key]), new Set([mcKey]))
  );
}

function isNameMarkedNonMainInPortraits(
  rawName: string,
  portraits: CharacterPortrait[],
): boolean {
  const clean = String(rawName || '').trim();
  if (!clean || !portraits.length) return false;
  const matches = portraits.filter((p) => isContactNameMc(p.name, clean));
  if (!matches.length) return false;
  // Chỉ coi là non-main nếu tất cả thẻ trùng tên đều đang ở tier NPC/Mob
  return matches.every((p) => isPortraitDemotedToNonMain(p));
}

/**
 * Xác định CHÍNH XÁC duy nhất chủ điện thoại (nhân vật gắn thẻ "Main" / MC hiện tại của save).
 * Tuyệt đối không lấy NPC phụ hoặc thẻ đã hạ xuống NPC/Mob làm người sử dụng điện thoại.
 */
export function getShowbizMcProfile(state: ArkState): ShowbizMcProfile {
  const portraits = state.portraitBank?.portraits || [];
  const storyComp = getStoryBoundCompanionFromState(state);
  const charStates = state.memory?.characterStates || [];
  const playerName = String(state.player?.name || '').trim();
  const hasConcretePlayerName = !isGenericMcPlaceholderName(playerName);

  const validNamedPortraits = portraits.filter(
    (p) => !isGenericMcPlaceholderName(p.name),
  );

  // Nhóm 1: Thẻ được gắn rõ nhãn "Main" / "Nhân vật chính" / "MC" và không bị hạ thành NPC/Mob
  const explicitMainPortraits = validNamedPortraits.filter((p) =>
    isPortraitExplicitPlayerMain(p),
  );

  // Nhóm 2: Thẻ có cờ isMc=true và KHÔNG bị hạ vai trò thành NPC/Mob
  const activeMcFlagPortraits = validNamedPortraits.filter(
    (p) => p.isMc && !isPortraitDemotedToNonMain(p),
  );

  // Nhóm 3: Thẻ có tier === 'main' (bao gồm Nam chính / Nữ chính) khi không có thẻ Main tường minh nào khác
  const tierMainPortraits = validNamedPortraits.filter(
    (p) => !isPortraitDemotedToNonMain(p) && resolvePortraitRoleTier(p).tier === 'main',
  );

  let chosenName = '';
  let chosenPortrait: CharacterPortrait | undefined;
  let sourceLabel = 'Thẻ Main';
  let isGenericFallback = false;

  // Ưu tiên 1: Thẻ Main tường minh khớp với tên player hoặc có cờ isMc
  if (explicitMainPortraits.length > 0) {
    chosenPortrait =
      (hasConcretePlayerName
        ? explicitMainPortraits.find((p) => isContactNameMc(p.name, playerName))
        : undefined) ||
      explicitMainPortraits.find((p) => p.isMc) ||
      explicitMainPortraits[0];
    chosenName = chosenPortrait.name.trim();
    sourceLabel = 'Thẻ Main';
  }

  // Ưu tiên 2: Thẻ có cờ isMc còn hiệu lực (không bị hạ xuống NPC/Mob)
  if (!chosenName && activeMcFlagPortraits.length > 0) {
    chosenPortrait =
      (hasConcretePlayerName
        ? activeMcFlagPortraits.find((p) => isContactNameMc(p.name, playerName))
        : undefined) || activeMcFlagPortraits[0];
    chosenName = chosenPortrait.name.trim();
    sourceLabel = 'Thẻ Main';
  }

  // Ưu tiên 3: Tên nhân vật chính thiết lập trong save hiện tại (state.player.name), miễn không bị gắn nhãn NPC/Mob
  if (
    !chosenName &&
    hasConcretePlayerName &&
    !isNameMarkedNonMainInPortraits(playerName, portraits)
  ) {
    chosenName = playerName;
    chosenPortrait = validNamedPortraits.find(
      (p) => !isPortraitDemotedToNonMain(p) && isContactNameMc(p.name, playerName),
    );
    sourceLabel = 'Hồ sơ MC của save';
  }

  // Ưu tiên 4: Trạng thái nhân vật có isMc=true trong memory của save hiện tại (không bị hạ xuống NPC/Mob)
  if (!chosenName) {
    const mcCharState = charStates.find(
      (cs) =>
        cs.isMc &&
        !isGenericMcPlaceholderName(cs.name) &&
        !isNameMarkedNonMainInPortraits(cs.name, portraits),
    );
    if (mcCharState) {
      chosenName = mcCharState.name.trim();
      chosenPortrait = validNamedPortraits.find(
        (p) => !isPortraitDemotedToNonMain(p) && isContactNameMc(p.name, chosenName),
      );
      sourceLabel = 'Trạng thái MC của save';
    }
  }

  // Ưu tiên 5: MC trong Đồng hành ĐANG GẮN trực tiếp với save (chỉ khi không bị đánh dấu NPC/Mob trong thư viện ảnh)
  if (
    !chosenName &&
    storyComp?.mc?.name &&
    !isGenericMcPlaceholderName(storyComp.mc.name) &&
    !isNameMarkedNonMainInPortraits(storyComp.mc.name, portraits)
  ) {
    chosenName = storyComp.mc.name.trim();
    chosenPortrait = validNamedPortraits.find(
      (p) => !isPortraitDemotedToNonMain(p) && isContactNameMc(p.name, chosenName),
    );
    sourceLabel = 'Đồng hành gắn save';
  }

  // Ưu tiên 6: Thẻ tier === 'main' còn lại trong thư viện ảnh của save
  if (!chosenName && tierMainPortraits.length > 0) {
    chosenPortrait = tierMainPortraits[0];
    chosenName = chosenPortrait.name.trim();
    sourceLabel = 'Thẻ Main';
  }

  // Fallback cuối cùng nếu save chưa đặt tên/thẻ main nào
  if (!chosenName) {
    chosenName = 'Nhân vật chính';
    sourceLabel = 'Chưa gắn thẻ Main';
    isGenericFallback = true;
  }

  // Chỉ lấy vai trò / tiểu sử / xưng hô từ nguồn KHỚP ĐÚNG với chosenName (tránh kéo nhầm hồ sơ NPC phụ hay MC cũ)
  const playerMatchesChosen =
    !isGenericFallback &&
    (!hasConcretePlayerName || isContactNameMc(playerName, chosenName));
  const compMcMatchesChosen = Boolean(
    !isGenericFallback &&
      storyComp?.mc?.name &&
      isContactNameMc(storyComp.mc.name, chosenName),
  );

  const rawRole = (
    chosenPortrait?.role ||
    (playerMatchesChosen ? state.player?.role : '') ||
    (compMcMatchesChosen ? storyComp?.mc?.originRole : '') ||
    'Nhân vật chính (Main)'
  ).trim();

  const pronoun = (
    (playerMatchesChosen ? state.player?.pronoun : '') ||
    (compMcMatchesChosen ? storyComp?.mc?.pronoun : '') ||
    ''
  ).trim();

  const bioParts = [
    chosenPortrait?.personality,
    chosenPortrait?.signature,
    chosenPortrait?.relationships,
    playerMatchesChosen ? state.player?.description : '',
    compMcMatchesChosen ? storyComp?.mc?.personality : '',
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  return {
    name: chosenName,
    handle: makeShowbizHandle(chosenName, 0),
    role: rawRole,
    pronoun,
    bio: Array.from(new Set(bioParts)).join(' · ').slice(0, 320),
    avatarData:
      chosenPortrait?.imageData || chosenPortrait?.referenceImageData || '',
    sourceLabel,
    isGenericFallback,
  };
}

const SHOWBIZ_DISALLOWED_PUNCT_RE = /[\[\](){}:;!?/\\=+<>|,~`•·…—–\n\r]/;

const SHOWBIZ_SINGLE_WORD_BLOCKLIST = new Set([
  'npc',
  'admin',
  'staff',
  'crew',
  'fan',
  'fans',
  'netizen',
  'anti',
  'antifan',
  'system',
  'main',
  'player',
  'user',
  'assistant',
  'manager',
  'director',
  'host',
  'guest',
  'stranger',
  'crowd',
  'everyone',
  'nobody',
  'someone',
  'unknown',
  'anonymous',
  'studio',
  'agency',
  'company',
  'group',
  'team',
  'club',
  'hotel',
  'bar',
  'cafe',
  'room',
  'hall',
  'stage',
  'street',
  'city',
  'khach',
  'nguoi',
  'dam',
  'nhom',
  'tong',
  'phong',
  'cong',
  'hang',
  'bao',
  'dai',
  'kenh',
  'nha',
  'pho',
  'duong',
  'quan',
  'tinh',
  'thanh',
  'sanh',
]);

const SHOWBIZ_NON_PERSON_LEAD_RE =
  /^(?:phòng|sảnh|khách\s+sạn|nhà\s+hàng|quán|công\s+ty|tập\s+đoàn|hãng|đài|kênh|báo|tạp\s+chí|sân\s+khấu|hội\s+trường|trường\s+quay|phim\s+trường|bệnh\s+viện|sân\s+bay|người|nhóm|đám|bộ|câu|lời|tin\s+nhắn|cuộc\s+gọi|những|các|một|mọi|cả|khi|nếu|vì|để|từ|trong|ngoài|trên|dưới|bên|giữa|sau|trước|đang|đã|sẽ|không|chưa|the|this|that|from|with|studio|hotel|agency|company|group|team|staff|crew|club|room|hall|stage|street|city)\b/i;

const SHOWBIZ_PHONE_MENTION_RE =
  /(?:lưu\s+số(?:\s+của)?|số\s+(?:điện\s+thoại|đt|máy)\s+của|nhắn\s+tin\s+(?:cho|từ|với)|tin\s+nhắn\s+(?:từ|của)|gọi\s+(?:điện\s+)?(?:cho|từ)|cuộc\s+gọi\s+(?:từ|của)|add\s+(?:số|zalo|ig|instagram|wechat|kakaotalk)\s+(?:của)?|sđt\s+(?:của)?)\s+([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ'-]{1,20}(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ'-]{1,20}){1,2})/g;

/**
 * Chuẩn hóa tên liên hệ Showbiz an toàn:
 * - Chặn mã viết tắt rác (VT, HS, NPC, VT [Vô Trần]), địa danh/núi sông (Hoành Đoạn Sơn), câu mô tả/cảnh vật.
 * - Giữ nguyên các tên 2+ từ và nghệ danh hợp lệ (VD: "Jennie Kim", "Kendall Jenner", "Đen Vâu", "G-Dragon", "Ninh Dương Lan Ngọc", "HIEUTHUHAI").
 */
export function normalizeShowbizContactName(
  rawName: string,
  allowedRosterKeys?: Set<string>,
): string | null {
  const trimmed = String(rawName || '')
    .replace(/^[\s"'“”‘’*`]+|[\s"'“”‘’*`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 42) return null;
  if (isShortCodeOrBracketedJunkName(trimmed)) return null;
  if (isNonPersonCultivationOrWorldTerm(trimmed)) return null;

  const knownCeleb = lookupKnownCelebrityProfile(trimmed);
  if (knownCeleb?.canonicalName) {
    return knownCeleb.canonicalName;
  }

  const sanitized = sanitizeCharacterName(trimmed, allowedRosterKeys);
  if (
    sanitized &&
    !isShortCodeOrBracketedJunkName(sanitized) &&
    !isNonPersonCultivationOrWorldTerm(sanitized) &&
    !isLyricOrExclamationJunkName(sanitized)
  ) {
    return sanitized;
  }

  // Fallback bảo vệ nghệ danh / tên 2–4 từ hợp lệ trong bối cảnh Showbiz
  if (SHOWBIZ_DISALLOWED_PUNCT_RE.test(trimmed)) return null;
  if (isLyricOrExclamationJunkName(trimmed)) return null;
  if (isChatOrNonPersonDescription(trimmed)) return null;
  if (!/\p{L}/u.test(trimmed)) return null;
  if (SHOWBIZ_NON_PERSON_LEAD_RE.test(trimmed)) return null;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;

  // Cần có ít nhất 1 chữ cái viết hoa để phân biệt tên riêng / nghệ danh với cụm mô tả thường
  if (!/[A-ZÀ-Ỹ]/.test(trimmed)) return null;

  const normKey = normalizeCharacterKey(trimmed);
  if (!normKey || normKey.length < 2) return null;

  if (words.length === 1) {
    if (trimmed.length < 3) return null;
    if (SHOWBIZ_SINGLE_WORD_BLOCKLIST.has(normKey)) return null;
    return trimmed;
  }

  return trimmed;
}

function isShortenedTailInKeySet(
  key: string,
  allKnownKeys: Set<string>,
): boolean {
  for (const fullKey of allKnownKeys) {
    if (fullKey !== key && isShortenedTailOfFullNameKey(key, fullKey)) {
      return true;
    }
  }
  return false;
}

function buildThreadCountByContactId(
  dmThreads?: Record<string, ShowbizPhoneMessage[]>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!dmThreads) return counts;
  for (const [id, msgs] of Object.entries(dmThreads)) {
    if (Array.isArray(msgs) && msgs.length > 0) {
      counts[id] = msgs.length;
    }
  }
  return counts;
}

/**
 * Chuyển đổi an toàn `dmThreads` và `groups.memberIds` sau khi gộp/dọn danh bạ
 * để không bao giờ mất lịch sử nhắn tin khi gộp bản sao (VD: "Jennie" -> "Jennie Kim").
 */
export function remapShowbizPhoneContactIds(
  phone: ShowbizPhoneState,
  contacts: ShowbizPhoneContact[],
  mergedIdMap: Record<string, string>,
): ShowbizPhoneState {
  const validIds = new Set(contacts.map((c) => c.id));
  const resolveId = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    while (mergedIdMap[cur] && !seen.has(cur)) {
      seen.add(cur);
      cur = mergedIdMap[cur];
    }
    return cur;
  };

  const nextDmThreads: Record<string, ShowbizPhoneMessage[]> = {};
  for (const [rawId, rawMsgs] of Object.entries(phone.dmThreads || {})) {
    const targetId = resolveId(rawId);
    if (!validIds.has(targetId)) continue;
    const incoming = Array.isArray(rawMsgs) ? rawMsgs : [];
    const existing = nextDmThreads[targetId] || [];
    if (!existing.length) {
      nextDmThreads[targetId] = incoming;
    } else if (incoming.length) {
      const byMsgId = new Map<string, ShowbizPhoneMessage>();
      for (const m of [...existing, ...incoming]) {
        byMsgId.set(m.id, m);
      }
      nextDmThreads[targetId] = Array.from(byMsgId.values()).sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
      );
    }
  }

  const nextGroups = (phone.groups || []).map((g) => {
    const nextMembers = Array.from(
      new Set(
        (g.memberIds || [])
          .map((id) => resolveId(id))
          .filter((id) => validIds.has(id)),
      ),
    );
    return {
      ...g,
      memberIds: nextMembers,
    };
  });

  return {
    ...phone,
    contacts,
    dmThreads: nextDmThreads,
    groups: nextGroups,
  };
}

/**
 * Kiểm tra tên liên hệ có phải tên rác (mã viết tắt VT/HS/NPC, địa danh/núi sông,
 * cụm cảnh vật/chiêu thức, hoặc tên rút gọn đuôi của nhân vật đã có đủ họ tên) không.
 */
export function isJunkShowbizContactName(
  rawName: string,
  allKnownKeys: Set<string>,
  mcName?: string,
  allowedRosterKeys?: Set<string>,
): boolean {
  const trimmed = String(rawName || '').trim();
  if (!trimmed) return true;
  if (isShortCodeOrBracketedJunkName(trimmed)) return true;

  const cleaned = normalizeShowbizContactName(trimmed, allowedRosterKeys);
  if (!cleaned) return true;
  if (isShortCodeOrBracketedJunkName(cleaned)) return true;
  if (isNonPersonCultivationOrWorldTerm(cleaned)) return true;
  if (mcName && !isGenericMcPlaceholderName(mcName) && isContactNameMc(cleaned, mcName)) {
    return true;
  }

  const key = normalizeCharacterKey(cleaned);
  if (!key || key.length < 2) return true;
  if (isShortenedTailInKeySet(key, allKnownKeys)) return true;
  return false;
}

/**
 * Lọc tên rác thực sự và gộp các bản sao trùng danh tính trong danh bạ Điện thoại Showbiz.
 * Bảo toàn tên 2 từ / nghệ danh hợp lệ (VD: "Jennie Kim", "Đen Vâu", "G-Dragon") và trả về
 * `mergedIdMap` để chuyển tiếp lịch sử DM/nhóm mượt mà.
 */
export function cleanJunkShowbizContacts(
  contacts: ShowbizPhoneContact[],
  mcName?: string,
  options?: {
    allowedRosterKeys?: Set<string>;
    threadCountById?: Record<string, number>;
  },
): {
  contacts: ShowbizPhoneContact[];
  removedCount: number;
  removedNames: string[];
  mergedIdMap: Record<string, string>;
} {
  const list = Array.isArray(contacts) ? contacts : [];
  if (!list.length) {
    return { contacts: [], removedCount: 0, removedNames: [], mergedIdMap: {} };
  }

  const allowedRosterKeys = options?.allowedRosterKeys;
  const threadCountById = options?.threadCountById || {};

  // Bước 1: Thu thập trước toàn bộ khóa đầy đủ (2+ từ, không rác) để bắt tên rút gọn đuôi
  const fullNameKeys = new Set<string>();
  const mcClean =
    mcName && !isGenericMcPlaceholderName(mcName)
      ? normalizeShowbizContactName(mcName, allowedRosterKeys) || mcName.trim()
      : '';
  if (mcClean) {
    const mcKey = normalizeCharacterKey(mcClean);
    if (mcKey) fullNameKeys.add(mcKey);
  }
  for (const c of list) {
    if (isShortCodeOrBracketedJunkName(c.name)) continue;
    const clean = normalizeShowbizContactName(c.name, allowedRosterKeys);
    if (!clean || isNonPersonCultivationOrWorldTerm(clean)) continue;
    const key = normalizeCharacterKey(clean);
    if (key && key.split(' ').length >= 2) {
      fullNameKeys.add(key);
    }
  }

  // Sắp xếp ưu tiên tên đầy đủ dài hơn, có lịch sử DM, và liên hệ đã có avatar/hồ sơ trước
  const ordered = [...list].sort((a, b) => {
    const aw = normalizeCharacterKey(a.name).split(' ').length;
    const bw = normalizeCharacterKey(b.name).split(' ').length;
    if (aw !== bw) return bw - aw;
    const aMsgs = threadCountById[a.id] || 0;
    const bMsgs = threadCountById[b.id] || 0;
    if (aMsgs !== bMsgs) return bMsgs - aMsgs;
    const aRich = (a.avatarData ? 2 : 0) + (a.role ? 1 : 0) + (a.bio ? 1 : 0);
    const bRich = (b.avatarData ? 2 : 0) + (b.role ? 1 : 0) + (b.bio ? 1 : 0);
    return bRich - aRich;
  });

  const kept: ShowbizPhoneContact[] = [];
  const removedNames: string[] = [];
  const mergedIdMap: Record<string, string> = {};

  for (const item of ordered) {
    if (
      isJunkShowbizContactName(
        item.name,
        fullNameKeys,
        mcName,
        allowedRosterKeys,
      )
    ) {
      removedNames.push(item.name);
      continue;
    }
    const cleanName =
      normalizeShowbizContactName(item.name, allowedRosterKeys) ||
      item.name.trim();
    const key = normalizeCharacterKey(cleanName);
    const existingIdx = kept.findIndex((k) => {
      const kKey = normalizeCharacterKey(k.name);
      return (
        kKey === key ||
        areIdentityKeysShadowMatch(new Set([kKey]), new Set([key]))
      );
    });
    if (existingIdx >= 0) {
      const prev = kept[existingIdx];
      const prevKey = normalizeCharacterKey(prev.name);
      const prevWords = prevKey.split(' ').filter(Boolean).length;
      const itemWords = key.split(' ').filter(Boolean).length;
      const bestName = itemWords > prevWords ? cleanName : prev.name;
      const prevMsgs = threadCountById[prev.id] || 0;
      const itemMsgs = threadCountById[item.id] || 0;
      const keepItemId = itemMsgs > prevMsgs;
      const survivorId = keepItemId ? item.id : prev.id;
      const droppedId = keepItemId ? prev.id : item.id;
      mergedIdMap[droppedId] = survivorId;

      kept[existingIdx] = {
        ...prev,
        id: survivorId,
        name: bestName,
        handle:
          itemWords > prevWords
            ? makeShowbizHandle(bestName, existingIdx + 1)
            : prev.handle || item.handle || makeShowbizHandle(bestName, existingIdx + 1),
        role: prev.role || item.role || '',
        bio: prev.bio || item.bio || '',
        relation: prev.relation || item.relation || '',
        avatarData: prev.avatarData || item.avatarData || '',
        verified: Boolean(prev.verified || item.verified),
        lastActiveAt:
          Math.max(prev.lastActiveAt || 0, item.lastActiveAt || 0) || undefined,
      };
      removedNames.push(item.name);
      continue;
    }
    kept.push({
      ...item,
      name: cleanName,
      handle: item.handle?.trim() || makeShowbizHandle(cleanName, kept.length + 1),
    });
  }

  return {
    contacts: kept,
    removedCount: Math.max(0, list.length - kept.length),
    removedNames,
    mergedIdMap,
  };
}

/**
 * Đồng bộ danh bạ Điện thoại Showbiz CHỈ từ save hiện tại đang mở
 * (thư viện ảnh save hiện tại, trạng thái NPC & ký ức trong memory save hiện tại,
 * Đồng hành thực sự gắn với save hiện tại nếu có, và các lượt truyện gần nhất của save hiện tại).
 * Tuyệt đối không đọc NPC từ các save/Đồng hành khác và không làm mất tên nhân vật hợp lệ như "Jennie Kim".
 */
export function syncShowbizContactsFromCurrentSave(
  state: ArkState,
  existingPhone?: ShowbizPhoneState | null,
): {
  nextPhone: ShowbizPhoneState;
  addedCount: number;
  removedJunkCount: number;
} {
  const basePhone = existingPhone || createDefaultShowbizPhoneState();
  const mcProfile = getShowbizMcProfile(state);
  const storyComp = getStoryBoundCompanionFromState(state);
  const now = Date.now();
  const threadCountById = buildThreadCountByContactId(basePhone.dmThreads);

  // Tập danh sách nhân vật đã xác nhận trong save hiện tại để sanitizeCharacterName không đánh rớt nghệ danh/tên ngoại
  const allowedRosterKeys = new Set<string>();
  const registerRosterName = (raw?: string | null) => {
    const clean = String(raw || '').trim();
    if (!clean || isShortCodeOrBracketedJunkName(clean)) return;
    if (isNonPersonCultivationOrWorldTerm(clean)) return;
    const key = normalizeCharacterKey(clean);
    if (key && key.length >= 2) {
      allowedRosterKeys.add(key);
    }
  };
  for (const p of state.portraitBank?.portraits || []) registerRosterName(p.name);
  for (const npc of storyComp?.npcs || []) registerRosterName(npc.name);
  for (const cs of state.memory?.characterStates || []) registerRosterName(cs.name);
  for (const c of basePhone.contacts || []) registerRosterName(c.name);

  const candidates: Array<{
    name: string;
    role?: string;
    bio?: string;
    relation?: string;
    avatarData?: string;
  }> = [];

  // 1. Từ thư viện ảnh nhân vật CỦA SAVE HIỆN TẠI (loại trừ đúng thẻ Main đang cầm điện thoại)
  for (const p of state.portraitBank?.portraits || []) {
    if (!mcProfile.isGenericFallback && isContactNameMc(p.name, mcProfile.name)) {
      continue;
    }
    if (mcProfile.isGenericFallback && p.isMc && !isPortraitDemotedToNonMain(p)) {
      continue;
    }
    candidates.push({
      name: p.name,
      role: p.role || '',
      bio: [p.personality, p.signature, p.appearance]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 220),
      relation: p.relationships || '',
      avatarData: p.imageData || p.referenceImageData || '',
    });
  }

  // 2. Từ danh sách NPC trong Đồng hành ĐANG GẮN với save hiện tại (nếu có)
  for (const npc of storyComp?.npcs || []) {
    if (!mcProfile.isGenericFallback && isContactNameMc(npc.name, mcProfile.name)) {
      continue;
    }
    candidates.push({
      name: npc.name,
      role: npc.role || '',
      bio: [npc.personality, npc.desc, npc.agenda]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 220),
      relation: npc.relationships || '',
    });
  }

  // 3. Từ memory.characterStates của save hiện tại
  for (const cs of state.memory?.characterStates || []) {
    if (!mcProfile.isGenericFallback && isContactNameMc(cs.name, mcProfile.name)) {
      continue;
    }
    if (mcProfile.isGenericFallback && cs.isMc) continue;
    candidates.push({
      name: cs.name,
      bio: [cs.status, cs.mood, cs.location]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 220),
    });
  }

  // 4. Từ memory.entries (entities) của save hiện tại
  for (const entry of (state.memory?.entries || []).slice(-40)) {
    for (const entity of entry.entities || []) {
      const cleanEntity = String(entity || '').trim();
      if (!cleanEntity) continue;
      if (!mcProfile.isGenericFallback && isContactNameMc(cleanEntity, mcProfile.name)) {
        continue;
      }
      candidates.push({ name: cleanEntity });
    }
  }

  // 5. Quét các lượt truyện gần nhất THUỘC SAVE HIỆN TẠI (cả cảnh truyện, nghệ sĩ nổi tiếng, lẫn nhắc nhắn tin/lưu SĐT)
  const recentTurns = (state.turns || []).slice(-30);
  if (recentTurns.length > 0) {
    const recentAssistantBlocks: string[] = [];
    const recentCombinedBlocks: string[] = [];
    for (const t of recentTurns) {
      const assistantClean = stripStoryPlanningAndMeta(t.assistant || '');
      const userClean = String(t.user || '').trim();
      if (assistantClean) {
        recentAssistantBlocks.push(assistantClean);
        // Quét từng lượt để không bị lượt mới khác cảnh đè mất nhân vật xuất hiện ở lượt trước
        const turnPresent = extractPresentCharactersFromScene(assistantClean, state).slice(0, 12);
        for (const name of turnPresent) {
          candidates.push({ name });
        }
      }
      const combined = [userClean, assistantClean].filter(Boolean).join('\n');
      if (combined) {
        recentCombinedBlocks.push(combined);
      }
    }

    const combinedText = recentCombinedBlocks.join('\n\n');
    if (combinedText.trim()) {
      // Nhận diện chuẩn nghệ sĩ / ngôi sao nổi tiếng (VD: "Jennie Kim", "Kendall Jenner", "Kim Kardashian")
      // kể cả khi họ xuất hiện qua tin nhắn điện thoại, gọi điện hoặc thoại người chơi
      const celebHits = findKnownCelebritiesInText(combinedText);
      for (const hit of celebHits) {
        const celebProfile = lookupKnownCelebrityProfile(hit.canonicalName);
        candidates.push({
          name: hit.canonicalName,
          role: celebProfile?.role || '',
        });
      }

      // Bắt thêm tên riêng 2–3 từ đi kèm ngữ cảnh lưu SĐT / nhắn tin / gọi điện
      SHOWBIZ_PHONE_MENTION_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SHOWBIZ_PHONE_MENTION_RE.exec(combinedText)) !== null) {
        const mentioned = (match[1] || '').trim();
        if (mentioned) {
          candidates.push({ name: mentioned });
        }
      }
    }

    const joinedAssistant = recentAssistantBlocks.slice(-10).join('\n\n');
    if (joinedAssistant.trim()) {
      const detected = extractPresentCharactersFromScene(joinedAssistant, state).slice(0, 16);
      for (const name of detected) {
        candidates.push({ name });
      }
    }
  }

  // Gom các khóa tên đầy đủ từ cả danh bạ cũ lẫn ứng viên mới để diệt tên rút gọn đuôi
  const allFullKeys = new Set<string>();
  const mcKey = normalizeCharacterKey(mcProfile.name);
  if (mcKey) allFullKeys.add(mcKey);
  for (const raw of [
    ...basePhone.contacts.map((c) => c.name),
    ...candidates.map((c) => c.name),
  ]) {
    if (isShortCodeOrBracketedJunkName(raw)) continue;
    const clean = normalizeShowbizContactName(raw, allowedRosterKeys);
    if (!clean || isNonPersonCultivationOrWorldTerm(clean)) continue;
    const key = normalizeCharacterKey(clean);
    if (key && key.split(' ').length >= 2) {
      allFullKeys.add(key);
    }
  }

  // Trước tiên lọc sạch rác khỏi danh bạ hiện có (bảo toàn nghệ danh & tên 2 từ hợp lệ)
  const cleanedExisting = cleanJunkShowbizContacts(
    basePhone.contacts,
    mcProfile.name,
    { allowedRosterKeys, threadCountById },
  );
  const merged: ShowbizPhoneContact[] = [...cleanedExisting.contacts];
  let addedCount = 0;

  for (const cand of candidates) {
    if (
      isJunkShowbizContactName(
        cand.name,
        allFullKeys,
        mcProfile.name,
        allowedRosterKeys,
      )
    ) {
      continue;
    }
    const cleanName =
      normalizeShowbizContactName(cand.name, allowedRosterKeys) ||
      cand.name.trim();
    const key = normalizeCharacterKey(cleanName);
    if (!key) continue;

    const matchIdx = merged.findIndex((c) => {
      const cKey = normalizeCharacterKey(c.name);
      return (
        cKey === key ||
        areIdentityKeysShadowMatch(new Set([cKey]), new Set([key]))
      );
    });

    if (matchIdx >= 0) {
      const prev = merged[matchIdx];
      const prevWords = normalizeCharacterKey(prev.name).split(' ').filter(Boolean).length;
      const candWords = key.split(' ').filter(Boolean).length;
      const upgradedName = candWords > prevWords ? cleanName : prev.name;
      merged[matchIdx] = {
        ...prev,
        name: upgradedName,
        handle:
          candWords > prevWords
            ? makeShowbizHandle(upgradedName, matchIdx + 1)
            : prev.handle,
        role: prev.role || cand.role || '',
        bio: prev.bio || cand.bio || '',
        relation: prev.relation || cand.relation || '',
        avatarData: prev.avatarData || cand.avatarData || '',
      };
    } else {
      merged.push({
        id: `sb_c_${key.replace(/\s+/g, '_')}_${now}_${merged.length}`,
        name: cleanName,
        handle: makeShowbizHandle(cleanName, merged.length + 1),
        role: cand.role || '',
        bio: cand.bio || '',
        relation: cand.relation || '',
        avatarData: cand.avatarData || '',
        source: 'save_npc',
        verified: Boolean(
          cand.role &&
            /ảnh đế|ảnh hậu|ca sĩ|diễn viên|đạo diễn|ngôi sao|idol|chủ tịch|quản lý|blackpink|model|siêu mẫu/i.test(
              cand.role,
            ),
        ),
        addedAt: now,
      });
      addedCount++;
    }
  }

  // Lọc lại một lượt cuối để bảo đảm nhất quán tuyệt đối
  const finalClean = cleanJunkShowbizContacts(merged, mcProfile.name, {
    allowedRosterKeys,
    threadCountById,
  });
  const combinedMergedIdMap: Record<string, string> = {
    ...cleanedExisting.mergedIdMap,
    ...finalClean.mergedIdMap,
  };
  const remappedPhone = remapShowbizPhoneContactIds(
    basePhone,
    finalClean.contacts,
    combinedMergedIdMap,
  );

  return {
    nextPhone: {
      ...remappedPhone,
      lastSyncedAt: now,
    },
    addedCount,
    removedJunkCount: cleanedExisting.removedCount + finalClean.removedCount,
  };
}

export interface ShowbizPromptContextOptions {
  focusContacts?: ShowbizPhoneContact[];
  mode?: 'dm' | 'group' | 'social';
}

function textMentionsCharacterName(text: string, characterName: string): boolean {
  const cleanName = sanitizeCharacterName(characterName || '');
  if (!cleanName || !text) return false;
  const hay = normalizeCharacterKey(text);
  const needle = normalizeCharacterKey(cleanName);
  if (!hay || !needle) return false;
  if (hay.includes(needle)) return true;
  // Hỗ trợ tên tiếng Anh hoặc tên riêng 1 từ (VD: "Kendall", "Kim") khi ghép họ đầy đủ ("Kendall Jenner")
  const tokens = needle.split(' ').filter((t) => t.length >= 3);
  if (tokens.length >= 2) {
    const first = tokens[0];
    if (first.length >= 3 && new RegExp(`(?:^|\\s)${first}(?:\\s|$)`).test(hay)) {
      return true;
    }
  }
  return false;
}

function buildContactRealRelationBrief(
  state: ArkState,
  mc: ShowbizMcProfile,
  contact: ShowbizPhoneContact,
): string {
  const portraits = state.portraitBank?.portraits || [];
  const storyComp = getStoryBoundCompanionFromState(state);
  const charStates = state.memory?.characterStates || [];
  const memoryEntries = state.memory?.entries || [];

  const matchedPortrait = portraits.find((p) =>
    isContactNameMc(p.name, contact.name),
  );
  const mcPortrait = !mc.isGenericFallback
    ? portraits.find(
        (p) => !isPortraitDemotedToNonMain(p) && isContactNameMc(p.name, mc.name),
      )
    : undefined;
  const matchedCompNpc = (storyComp?.npcs || []).find((n) =>
    isContactNameMc(n.name, contact.name),
  );
  const matchedState = charStates.find((cs) =>
    isContactNameMc(cs.name, contact.name),
  );

  // Kiểm tra quan hệ thủ công giữa thẻ Main và thẻ NPC (nếu có trong Sơ đồ quan hệ)
  let manualEdgeNote = '';
  if (mcPortrait && matchedPortrait) {
    const overrides = state.portraitBank?.relationshipOverrides || [];
    const edge = overrides.find(
      (e) =>
        e.status === 'manual' &&
        ((e.sourceId === mcPortrait.id && e.targetId === matchedPortrait.id) ||
          (e.sourceId === matchedPortrait.id && e.targetId === mcPortrait.id)),
    );
    if (edge) {
      manualEdgeNote = [edge.label, edge.note].filter(Boolean).join(' — ');
    }
  }

  const relationParts = Array.from(
    new Set(
      [
        manualEdgeNote,
        contact.relation,
        matchedPortrait?.relationships,
        matchedCompNpc?.relationships,
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean),
    ),
  );

  const roleText = (
    contact.role ||
    matchedPortrait?.role ||
    matchedCompNpc?.role ||
    ''
  ).trim();

  const bioParts = Array.from(
    new Set(
      [
        contact.bio,
        matchedPortrait?.personality,
        matchedPortrait?.signature,
        matchedCompNpc?.personality,
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean),
    ),
  );

  const stateParts = [
    matchedState?.location || matchedPortrait?.currentLocation
      ? `vị trí: ${(matchedState?.location || matchedPortrait?.currentLocation || '').trim()}`
      : '',
    matchedState?.mood ? `tâm trạng: ${matchedState.mood.trim()}` : '',
    matchedState?.status ? `trạng thái: ${matchedState.status.trim()}` : '',
  ].filter(Boolean);

  // Lọc tối đa 3 ký ức thực sự nhắc tới NPC này
  const relevantMemories = memoryEntries
    .filter((m) => {
      const entityMatch = (m.entities || []).some((e) =>
        isContactNameMc(e, contact.name),
      );
      if (entityMatch) return true;
      const joined = `${m.title || ''} ${m.content || ''} ${(m.keywords || []).join(' ')}`;
      return textMentionsCharacterName(joined, contact.name);
    })
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    })
    .slice(0, 3)
    .map((m) => `${m.title ? `${m.title}: ` : ''}${m.content}`.trim().slice(0, 200));

  const lines = [
    `• ${contact.name}${roleText ? ` (${roleText})` : ''}:`,
    relationParts.length
      ? `  - Quan hệ thực tế với ${mc.name}: ${relationParts.join(' | ').slice(0, 280)}`
      : `  - Quan hệ thực tế với ${mc.name}: (chưa có ghi chú riêng ngoài diễn biến đã xảy ra giữa ${mc.name} và ${contact.name}; không tự gán quan hệ của NPC khác).`,
    bioParts.length
      ? `  - Tính cách / Hồ sơ: ${bioParts.join(' · ').slice(0, 260)}`
      : '',
    stateParts.length
      ? `  - Tình trạng hiện tại: ${stateParts.join(', ')}`
      : '',
    relevantMemories.length
      ? `  - Ký ức liên quan ${contact.name}:\n${relevantMemories.map((m) => `    * ${m}`).join('\n')}`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function collectBystanderNpcNames(
  state: ArkState,
  mc: ShowbizMcProfile,
  focusContacts: ShowbizPhoneContact[],
): string[] {
  const excludedNames = [mc.name, ...focusContacts.map((c) => c.name)].filter(
    Boolean,
  );
  const seenKeys = new Set<string>();
  const bystanders: string[] = [];

  const pushIfBystander = (rawName?: string) => {
    const clean = sanitizeCharacterName(rawName || '');
    if (!clean || isGenericMcPlaceholderName(clean)) return;
    if (isShortCodeOrBracketedJunkName(clean)) return;
    if (isNonPersonCultivationOrWorldTerm(clean)) return;
    if (excludedNames.some((ex) => isContactNameMc(clean, ex))) return;
    const key = normalizeCharacterKey(clean);
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    bystanders.push(clean);
  };

  for (const p of state.portraitBank?.portraits || []) {
    pushIfBystander(p.name);
  }
  for (const c of state.showbizPhone?.contacts || []) {
    pushIfBystander(c.name);
  }
  for (const cs of state.memory?.characterStates || []) {
    pushIfBystander(cs.name);
  }

  return bystanders.slice(0, 8);
}

export function buildCompactStoryContextForPhone(
  state: ArkState,
  options?: ShowbizPromptContextOptions,
): string {
  const storyComp = getStoryBoundCompanionFromState(state);
  const mc = getShowbizMcProfile(state);
  const focusContacts = options?.focusContacts || [];
  const mode = options?.mode || 'dm';

  const worldName = (
    storyComp?.name ||
    state.world?.name ||
    'Thế giới hiện tại'
  ).trim();
  const worldDesc = (
    storyComp?.worldSetting ||
    state.world?.setting ||
    state.world?.atmosphere ||
    ''
  )
    .trim()
    .slice(0, 280);

  const rolling = (state.memory?.rollingSummary?.content || '')
    .trim()
    .slice(0, 480);

  // Tách lọc lượt truyện liên quan tới NPC đang tương tác (tránh lượt truyện chỉ có NPC phụ khác làm nhiễu danh tính MC)
  const allRecentTurns = (state.turns || []).slice(-8);
  const focusTurns: string[] = [];
  if (focusContacts.length > 0) {
    for (let i = allRecentTurns.length - 1; i >= 0 && focusTurns.length < 2; i--) {
      const t = allRecentTurns[i];
      const cleanedAssistant = stripStoryPlanningAndMeta(t.assistant || '')
        .replace(/\s+/g, ' ')
        .trim();
      const combined = `${t.user || ''} ${cleanedAssistant}`;
      const mentionsFocus = focusContacts.some((fc) =>
        textMentionsCharacterName(combined, fc.name),
      );
      if (mentionsFocus && cleanedAssistant) {
        focusTurns.unshift(
          `[Diễn biến có nhắc tới đối phương]: ${cleanedAssistant.slice(0, 380)}`,
        );
      }
    }
  }

  const latestTurn = allRecentTurns[allRecentTurns.length - 1];
  const latestTurnSnippet = latestTurn
    ? stripStoryPlanningAndMeta(latestTurn.assistant || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 320)
    : '';

  const focusBriefBlock =
    focusContacts.length > 0
      ? focusContacts
          .slice(0, 6)
          .map((fc) => buildContactRealRelationBrief(state, mc, fc))
          .join('\n')
      : '';

  const bystanderNames = collectBystanderNpcNames(state, mc, focusContacts);

  const ownerLockLines = [
    `[KHÓA DANH TÍNH CHỦ ĐIỆN THOẠI — BẮT BUỘC TUYỆT ĐỐI]`,
    `- Chủ điện thoại / Người duy nhất đang cầm máy & gửi tin (THẺ MAIN): ${mc.name}${mc.pronoun ? ` (xưng hô: ${mc.pronoun})` : ''}${mc.role ? ` — ${mc.role}` : ''}`,
    mc.bio ? `- Hồ sơ chủ điện thoại (${mc.name}): ${mc.bio}` : '',
    `- QUY TẮC CỨNG: Mọi tin nhắn / bài đăng / bình luận từ phía người chơi trong Điện thoại Showbiz ĐỀU thuộc về "${mc.name}". TUYỆT ĐỐI KHÔNG lấy nhầm bất kỳ NPC phụ nào khác làm người nhắn tin, không gọi nhầm "${mc.name}" bằng tên người khác, và chỉ sử dụng đúng mối quan hệ thực tế giữa các nhân vật với "${mc.name}".`,
    bystanderNames.length > 0 && mode === 'dm'
      ? `- Lưu ý phân tách nhân vật: Các nhân vật khác trong save (${bystanderNames.join(', ')}) KHÔNG phải chủ điện thoại "${mc.name}" và KHÔNG tham gia đoạn nhắn tin riêng này; tuyệt đối không nhầm họ với "${mc.name}" và không tự bịa họ quen biết đối phương nếu hồ sơ/truyện không có.`
      : bystanderNames.length > 0
        ? `- Lưu ý phân tách nhân vật: Các NPC khác trong save (${bystanderNames.join(', ')}) là nhân vật độc lập, KHÔNG phải chủ điện thoại "${mc.name}".`
        : '',
  ].filter(Boolean);

  return [
    ownerLockLines.join('\n'),
    `\nBối cảnh thế giới: ${worldName}${worldDesc ? ` — ${worldDesc}` : ''}`,
    focusBriefBlock
      ? `\n[QUAN HỆ & NGỮ CẢNH THỰC TẾ CỦA ĐỐI PHƯƠNG VỚI ${mc.name}]:\n${focusBriefBlock}`
      : '',
    rolling
      ? `\nTóm tắt bối cảnh chung của save (chỉ tham khảo mạch truyện, KHÔNG thay đổi chủ điện thoại "${mc.name}"): ${rolling}`
      : '',
    focusTurns.length > 0
      ? `\nTình tiết gần đây liên quan trực tiếp:\n${focusTurns.join('\n')}`
      : latestTurnSnippet
        ? `\nBối cảnh thời điểm gần nhất trong save (chỉ tham khảo bối cảnh/thời điểm, KHÔNG đồng nhất nhân vật phụ trong đoạn này với chủ điện thoại "${mc.name}"):\n${latestTurnSnippet}`
        : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseJsonLoose<T>(raw: string): T | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const startObj = candidate.indexOf('{');
    const endObj = candidate.lastIndexOf('}');
    if (startObj >= 0 && endObj > startObj) {
      try {
        return JSON.parse(candidate.slice(startObj, endObj + 1)) as T;
      } catch {
        // continue
      }
    }
    const startArr = candidate.indexOf('[');
    const endArr = candidate.lastIndexOf(']');
    if (startArr >= 0 && endArr > startArr) {
      try {
        return JSON.parse(candidate.slice(startArr, endArr + 1)) as T;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export async function sendShowbizDmWithAi(
  state: ArkState,
  contact: ShowbizPhoneContact,
  history: ShowbizPhoneMessage[],
  userMessage: string,
): Promise<{ ok: boolean; reply?: string; modelUsed?: string; error?: string }> {
  const effectiveState = buildShowbizPhoneEffectiveState(state);
  const mc = getShowbizMcProfile(state);
  const storyContext = buildCompactStoryContextForPhone(state, {
    focusContacts: [contact],
    mode: 'dm',
  });

  const recentMsgs = history
    .slice(-14)
    .map((m) => `${m.isMc ? mc.name : contact.name}: ${m.text}`)
    .join('\n');

  const systemPrompt = [
    `Bạn đang nhập vai nhân vật "${contact.name}" nhắn tin riêng (DM) qua Điện thoại Showbiz với CHỦ ĐIỆN THOẠI DUY NHẤT là "${mc.name}" (nhân vật gắn thẻ Main của save hiện tại).`,
    'Quy tắc bắt buộc:',
    `- Người đang nhắn tin với bạn CHẮC CHẮN là "${mc.name}". Tuyệt đối KHÔNG gọi nhầm "${mc.name}" thành tên bất kỳ NPC phụ hay nhân vật nào khác trong save.`,
    `- Chỉ dùng đúng mối quan hệ, ký ức và ngữ cảnh thực tế giữa "${contact.name}" và "${mc.name}". Không gán nhầm quan hệ của nhân vật không liên quan vào cuộc trò chuyện này.`,
    '- Trả lời đúng tính cách, giọng điệu và bối cảnh của save này.',
    '- Viết tự nhiên như tin nhắn điện thoại thực tế (ngắn gọn 1–4 câu, có thể ngắt dòng tự nhiên, không viết văn trần thuật ngôi thứ ba, không dùng thẻ XML/meta).',
    '- Không tự bịa nhân vật lạ ngoài save.',
    '- Chỉ xuất đúng nội dung tin nhắn trả lời của nhân vật, không thêm tiền tố tên hay ngoặc kép thừa.',
  ].join('\n');

  const promptText = [
    storyContext,
    `\nThông tin nhanh cuộc trò chuyện riêng (DM):`,
    `- Chủ điện thoại / Người gửi (Thẻ Main): ${mc.name}${mc.role ? ` (${mc.role})` : ''}`,
    `- Đối phương trả lời (bạn nhập vai): ${contact.name}${contact.role ? ` (${contact.role})` : ''}`,
    recentMsgs ? `\nLịch sử tin nhắn gần đây giữa ${mc.name} và ${contact.name}:\n${recentMsgs}` : '',
    `\nTin nhắn mới từ ${mc.name} (chủ điện thoại): ${userMessage}`,
    `\nHãy viết tin nhắn trả lời ngay của ${contact.name} gửi lại cho ${mc.name}:`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callAiJsonOrTextDetailed(effectiveState, promptText, {
    systemPrompt,
    taskSlot: 'showbizPhone',
    timeoutMs: 42000,
    maxTokens: 480,
    logPrefix: '[ShowbizPhone:DM]',
  });

  if (!res.ok || !res.text) {
    return {
      ok: false,
      modelUsed: res.modelUsed,
      error: res.errorMessage || 'Không nhận được phản hồi DM từ AI.',
    };
  }

  const cleanedReply = stripStoryPlanningAndMeta(res.text)
    .replace(new RegExp(`^${contact.name}\\s*[:：-]\\s*`, 'i'), '')
    .trim();

  if (!cleanedReply) {
    return {
      ok: false,
      modelUsed: res.modelUsed,
      error: 'Phản hồi DM trả về rỗng.',
    };
  }

  return {
    ok: true,
    reply: cleanedReply,
    modelUsed: res.modelUsed,
  };
}

export async function sendShowbizGroupMessageWithAi(
  state: ArkState,
  group: ShowbizPhoneGroup,
  members: ShowbizPhoneContact[],
  userMessage?: string,
): Promise<{
  ok: boolean;
  replies?: Array<{ contactId: string; senderName: string; text: string }>;
  modelUsed?: string;
  error?: string;
}> {
  if (!members.length) {
    return {
      ok: false,
      error: 'Nhóm chưa có thành viên NPC nào. Hãy thêm thành viên trước.',
    };
  }

  const effectiveState = buildShowbizPhoneEffectiveState(state);
  const mc = getShowbizMcProfile(state);
  const storyContext = buildCompactStoryContextForPhone(state, {
    focusContacts: members,
    mode: 'group',
  });

  const memberBrief = members
    .map(
      (m) =>
        `- [id=${m.id}] ${m.name}${m.role ? ` (${m.role})` : ''}${m.relation ? ` · Quan hệ với ${mc.name}: ${m.relation}` : ''}${m.bio ? ` · ${m.bio}` : ''}`,
    )
    .join('\n');

  const recentMsgs = group.messages
    .slice(-16)
    .map((m) => `${m.isMc ? mc.name : m.senderName}: ${m.text}`)
    .join('\n');

  const systemPrompt = [
    `Bạn mô phỏng phòng Chat Nhóm "${group.name}" trên Điện thoại Showbiz của chủ điện thoại "${mc.name}" (thẻ Main duy nhất của save hiện tại).`,
    `Mọi tin nhắn từ phía người chơi trong nhóm ĐỀU do "${mc.name}" gửi. Tuyệt đối không gọi nhầm "${mc.name}" bằng tên NPC phụ khác và chỉ dùng đúng quan hệ thực tế của từng thành viên với "${mc.name}".`,
    'Hãy chọn 1 đến 3 thành viên phù hợp nhất trong danh sách thành viên để lần lượt trả lời đúng tính cách, có tương tác qua lại tự nhiên như nhóm chat đoàn phim/đồng nghiệp/bạn bè.',
    'Trả về DUY NHẤT JSON hợp lệ theo định dạng:',
    '{"replies":[{"memberId":"...","senderName":"...","text":"..."}]}',
    'Mỗi tin nhắn ngắn gọn 1–3 câu tiếng Việt tự nhiên, đúng tính cách, không dùng văn miêu tả ngôi thứ 3.',
  ].join('\n');

  const promptText = [
    storyContext,
    `\nTên nhóm: ${group.name}${group.topic ? ` · Chủ đề: ${group.topic}` : ''}`,
    `Chủ điện thoại (Thẻ Main) trong nhóm: ${mc.name}`,
    `Danh sách thành viên NPC trong nhóm:\n${memberBrief}`,
    recentMsgs ? `\nTin nhắn gần đây trong nhóm:\n${recentMsgs}` : '',
    userMessage?.trim()
      ? `\n${mc.name} (chủ điện thoại) vừa nhắn vào nhóm: "${userMessage.trim()}"`
      : `\nHãy để 2 thành viên chủ động nhắn tin trao đổi chuyện hậu trường / lịch trình / drama liên quan bối cảnh hiện tại và nhắc khéo tới ${mc.name}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callAiJsonOrTextDetailed(effectiveState, promptText, {
    systemPrompt,
    taskSlot: 'showbizPhone',
    timeoutMs: 45000,
    maxTokens: 780,
    logPrefix: '[ShowbizPhone:Group]',
  });

  if (!res.ok || !res.text) {
    return {
      ok: false,
      modelUsed: res.modelUsed,
      error: res.errorMessage || 'Không nhận được phản hồi chat nhóm từ AI.',
    };
  }

  const parsed = parseJsonLoose<{
    replies?: Array<{ memberId?: string; senderName?: string; text?: string }>;
  }>(res.text);

  const rawReplies = Array.isArray(parsed?.replies)
    ? parsed.replies
    : Array.isArray(parsed)
      ? (parsed as Array<{ memberId?: string; senderName?: string; text?: string }>)
      : [];

  const matchedReplies: Array<{
    contactId: string;
    senderName: string;
    text: string;
  }> = [];

  for (const item of rawReplies.slice(0, 3)) {
    const text = String(item?.text || '').trim();
    if (!text) continue;
    const byId = members.find((m) => m.id === item.memberId);
    const byName =
      byId ||
      members.find(
        (m) =>
          normalizeCharacterKey(m.name) ===
          normalizeCharacterKey(item.senderName || ''),
      ) ||
      members[matchedReplies.length % members.length];

    matchedReplies.push({
      contactId: byName.id,
      senderName: byName.name,
      text,
    });
  }

  if (!matchedReplies.length) {
    // Fallback an toàn nếu model trả văn bản thường thay vì JSON
    const fallbackText = stripStoryPlanningAndMeta(res.text).trim().slice(0, 400);
    if (!fallbackText) {
      return {
        ok: false,
        modelUsed: res.modelUsed,
        error: 'Phản hồi chat nhóm trả về rỗng.',
      };
    }
    matchedReplies.push({
      contactId: members[0].id,
      senderName: members[0].name,
      text: fallbackText,
    });
  }

  return {
    ok: true,
    replies: matchedReplies,
    modelUsed: res.modelUsed,
  };
}

export async function generateShowbizNpcPostsWithAi(
  state: ArkState,
  contacts: ShowbizPhoneContact[],
  existingPosts: ShowbizPhonePost[],
): Promise<{
  ok: boolean;
  posts?: ShowbizPhonePost[];
  modelUsed?: string;
  error?: string;
}> {
  if (!contacts.length) {
    return {
      ok: false,
      error: 'Chưa có NPC nào trong danh bạ save hiện tại để đăng bài MXH.',
    };
  }

  const effectiveState = buildShowbizPhoneEffectiveState(state);
  const mc = getShowbizMcProfile(state);
  const sampleContacts = contacts.slice(0, 10);
  const storyContext = buildCompactStoryContextForPhone(state, {
    focusContacts: sampleContacts.slice(0, 6),
    mode: 'social',
  });

  const contactLines = sampleContacts
    .map(
      (c) =>
        `- [id=${c.id}] ${c.name} (${c.handle})${c.role ? ` · ${c.role}` : ''}${c.relation ? ` · Quan hệ với ${mc.name}: ${c.relation}` : ''}${c.bio ? ` · ${c.bio}` : ''}`,
    )
    .join('\n');

  const recentPostSnippets = existingPosts
    .slice(0, 4)
    .map((p) => `- ${p.isMc ? mc.name : p.authorName}: ${p.content.slice(0, 100)}`)
    .join('\n');

  const systemPrompt = [
    `Bạn tạo bảng tin Mạng Xã Hội (MXH / Weibo / Instagram nội bộ giới giải trí) cho thế giới trong save truyện hiện tại của nhân vật chính (thẻ Main) "${mc.name}".`,
    `Lưu ý: Chủ tài khoản đang xem điện thoại là "${mc.name}". Tuyệt đối không nhầm lẫn NPC phụ với "${mc.name}" và chỉ nhắc quan hệ đúng sự thật trong save.`,
    'Tạo 2 bài đăng mới từ các NPC trong danh sách, sát bối cảnh, đời sống hậu trường, tâm trạng hoặc sự kiện gần nhất.',
    'Mỗi bài có thể kèm 1–2 bình luận ngắn từ NPC khác trong danh sách.',
    'Trả về DUY NHẤT JSON hợp lệ:',
    '{"posts":[{"authorId":"...","authorName":"...","content":"...","locationTag":"...","hashtags":["#..."],"likes":128,"comments":[{"authorId":"...","authorName":"...","text":"..."}]}]}',
  ].join('\n');

  const promptText = [
    storyContext,
    `\nDanh sách NPC trong save hiện tại:\n${contactLines}`,
    recentPostSnippets
      ? `\nCác bài đăng gần nhất (tránh lặp ý):\n${recentPostSnippets}`
      : '',
    '\nHãy tạo 2 bài đăng MXH mới thật tự nhiên bằng tiếng Việt.',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callAiJsonOrTextDetailed(effectiveState, promptText, {
    systemPrompt,
    taskSlot: 'showbizPhone',
    timeoutMs: 45000,
    maxTokens: 950,
    logPrefix: '[ShowbizPhone:Feed]',
  });

  if (!res.ok || !res.text) {
    return {
      ok: false,
      modelUsed: res.modelUsed,
      error: res.errorMessage || 'Không thể tải bài đăng mới từ AI.',
    };
  }

  const parsed = parseJsonLoose<{
    posts?: Array<{
      authorId?: string;
      authorName?: string;
      content?: string;
      locationTag?: string;
      hashtags?: string[];
      likes?: number;
      comments?: Array<{
        authorId?: string;
        authorName?: string;
        text?: string;
      }>;
    }>;
  }>(res.text);

  const rawPosts = Array.isArray(parsed?.posts) ? parsed.posts : [];
  const now = Date.now();
  const created: ShowbizPhonePost[] = [];

  for (let i = 0; i < rawPosts.length; i++) {
    const item = rawPosts[i];
    const content = String(item?.content || '').trim();
    if (!content) continue;
    const author =
      sampleContacts.find((c) => c.id === item.authorId) ||
      sampleContacts.find(
        (c) =>
          normalizeCharacterKey(c.name) ===
          normalizeCharacterKey(item.authorName || ''),
      ) ||
      sampleContacts[i % sampleContacts.length];

    const comments: ShowbizPhoneComment[] = [];
    for (let j = 0; j < (item.comments || []).length; j++) {
      const cm = item.comments![j];
      const text = String(cm?.text || '').trim();
      if (!text) continue;
      const cmAuthor =
        sampleContacts.find((c) => c.id === cm.authorId) ||
        sampleContacts.find(
          (c) =>
            normalizeCharacterKey(c.name) ===
            normalizeCharacterKey(cm.authorName || ''),
        );
      comments.push({
        id: `sb_cm_${now}_${i}_${j}`,
        authorId: cmAuthor?.id || `fan_${j}`,
        authorName: cmAuthor?.name || cm.authorName?.trim() || 'Cư dân mạng',
        authorHandle: cmAuthor?.handle || undefined,
        text,
        createdAt: now - (rawPosts.length - i) * 60000 + j * 10000,
      });
    }

    created.push({
      id: `sb_post_${now}_${i}`,
      authorId: author.id,
      authorName: author.name,
      authorHandle: author.handle,
      authorRole: author.role || '',
      authorAvatarData: author.avatarData || '',
      isMc: false,
      content,
      locationTag: String(item.locationTag || '').trim(),
      hashtags: Array.isArray(item.hashtags)
        ? item.hashtags
            .map((h) => String(h || '').trim())
            .filter(Boolean)
            .map((h) => (h.startsWith('#') ? h : `#${h}`))
            .slice(0, 5)
        : [],
      likes:
        typeof item.likes === 'number' && Number.isFinite(item.likes)
          ? Math.max(1, Math.round(item.likes))
          : 42 + i * 37,
      likedByMc: false,
      comments,
      createdAt: now - i * 90000,
    });
  }

  if (!created.length) {
    return {
      ok: false,
      modelUsed: res.modelUsed,
      error: 'AI không trả về dữ liệu bài đăng MXH hợp lệ.',
    };
  }

  return {
    ok: true,
    posts: created,
    modelUsed: res.modelUsed,
  };
}

export async function requestShowbizPostReactionsWithAi(
  state: ArkState,
  post: ShowbizPhonePost,
  contacts: ShowbizPhoneContact[],
  mcComment?: string,
): Promise<{
  ok: boolean;
  comments?: ShowbizPhoneComment[];
  likeDelta?: number;
  modelUsed?: string;
  error?: string;
}> {
  const effectiveState = buildShowbizPhoneEffectiveState(state);
  const mc = getShowbizMcProfile(state);
  const sampleContacts = contacts.slice(0, 10);
  const postAuthorContact = !post.isMc
    ? sampleContacts.find(
        (c) => c.id === post.authorId || isContactNameMc(c.name, post.authorName),
      )
    : undefined;
  const focusForContext = postAuthorContact
    ? [
        postAuthorContact,
        ...sampleContacts
          .filter((c) => c.id !== postAuthorContact.id)
          .slice(0, 4),
      ]
    : sampleContacts.slice(0, 6);

  const storyContext = buildCompactStoryContextForPhone(state, {
    focusContacts: focusForContext,
    mode: 'social',
  });

  const resolvedPostAuthorName = post.isMc ? mc.name : post.authorName;
  const resolvedPostAuthorHandle = post.isMc ? mc.handle : post.authorHandle;

  const contactLines = sampleContacts.length
    ? sampleContacts
        .map(
          (c) =>
            `- [id=${c.id}] ${c.name} (${c.handle})${c.role ? ` · ${c.role}` : ''}${c.relation ? ` · Quan hệ với ${mc.name}: ${c.relation}` : ''}`,
        )
        .join('\n')
    : '- (Chưa có danh bạ NPC, có thể tạo phản ứng từ người hâm mộ / đồng nghiệp hợp bối cảnh)';

  const existingCommentLines = (post.comments || [])
    .slice(-8)
    .map((c) => `- ${c.isMc ? mc.name : c.authorName}: ${c.text}`)
    .join('\n');

  const systemPrompt = [
    `Bạn mô phỏng phản ứng và bình luận trên Mạng Xã Hội trong Điện thoại Showbiz của chủ tài khoản "${mc.name}" (thẻ Main duy nhất của save hiện tại).`,
    `Mọi bài đăng hoặc bình luận của người chơi ĐỀU thuộc về "${mc.name}". Tuyệt đối không nhầm "${mc.name}" với NPC phụ khác và chỉ để những NPC thực sự có quan hệ/ngữ cảnh phù hợp với "${mc.name}" vào bình luận đúng mối quan hệ thực tế.`,
    'Ưu tiên các NPC trong danh sách save hiện tại bình luận đúng tính cách, giọng điệu, quan hệ (1–3 bình luận).',
    'Trả về DUY NHẤT JSON hợp lệ:',
    '{"likeDelta":15,"comments":[{"authorId":"...","authorName":"...","text":"..."}]}',
  ].join('\n');

  const promptText = [
    storyContext,
    `\nDanh sách NPC có thể tương tác:\n${contactLines}`,
    `\nBài đăng của ${resolvedPostAuthorName} (${resolvedPostAuthorHandle}):\n"${post.content}"`,
    existingCommentLines ? `\nBình luận hiện có:\n${existingCommentLines}` : '',
    mcComment?.trim()
      ? `\n${mc.name} (chủ điện thoại) vừa bình luận: "${mcComment.trim()}"\nHãy tạo 1–2 phản hồi tự nhiên trả lời bình luận này của ${mc.name}.`
      : `\n${post.isMc ? `${mc.name} (chủ điện thoại)` : resolvedPostAuthorName} vừa đăng bài viết này. Hãy tạo 2–3 bình luận phản ứng tự nhiên từ các NPC phù hợp và ước lượng số lượt thích mới (likeDelta).`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callAiJsonOrTextDetailed(effectiveState, promptText, {
    systemPrompt,
    taskSlot: 'showbizPhone',
    timeoutMs: 42000,
    maxTokens: 680,
    logPrefix: '[ShowbizPhone:React]',
  });

  if (!res.ok || !res.text) {
    return {
      ok: false,
      modelUsed: res.modelUsed,
      error: res.errorMessage || 'Không nhận được phản ứng MXH từ AI.',
    };
  }

  const parsed = parseJsonLoose<{
    likeDelta?: number;
    comments?: Array<{ authorId?: string; authorName?: string; text?: string }>;
  }>(res.text);

  const now = Date.now();
  const comments: ShowbizPhoneComment[] = [];
  for (let i = 0; i < (parsed?.comments || []).length; i++) {
    const cm = parsed!.comments![i];
    const text = String(cm?.text || '').trim();
    if (!text) continue;
    const matched =
      sampleContacts.find((c) => c.id === cm.authorId) ||
      sampleContacts.find(
        (c) =>
          normalizeCharacterKey(c.name) ===
          normalizeCharacterKey(cm.authorName || ''),
      );
    comments.push({
      id: `sb_cm_${now}_${i}`,
      authorId: matched?.id || `netizen_${now}_${i}`,
      authorName: matched?.name || cm.authorName?.trim() || 'Cư dân mạng',
      authorHandle: matched?.handle || undefined,
      text,
      createdAt: now + i * 1000,
    });
  }

  if (!comments.length) {
    const plain = stripStoryPlanningAndMeta(res.text).trim().slice(0, 260);
    if (plain) {
      const firstContact = sampleContacts[0];
      comments.push({
        id: `sb_cm_${now}_0`,
        authorId: firstContact?.id || 'netizen_0',
        authorName: firstContact?.name || 'Khán giả',
        authorHandle: firstContact?.handle,
        text: plain,
        createdAt: now,
      });
    }
  }

  const likeDelta =
    typeof parsed?.likeDelta === 'number' && Number.isFinite(parsed.likeDelta)
      ? Math.max(0, Math.min(9999, Math.round(parsed.likeDelta)))
      : 8;

  return {
    ok: true,
    comments,
    likeDelta,
    modelUsed: res.modelUsed,
  };
}

export async function testShowbizPhoneAiConnection(state: ArkState): Promise<{
  ok: boolean;
  modelUsed?: string;
  elapsedMs?: number;
  message: string;
}> {
  const effectiveState = buildShowbizPhoneEffectiveState(state);
  const runtime = resolveShowbizPhoneRuntimeSummary(state.config);
  if (!runtime.isReady) {
    return {
      ok: false,
      message:
        'Chưa có Endpoint Proxy nào (cả cấu hình riêng lẫn cấu hình chung đều đang trống).',
    };
  }
  const res = await callAiJsonOrTextDetailed(
    effectiveState,
    'Trả lời đúng 2 từ: "Sẵn sàng".',
    {
      taskSlot: 'showbizPhone',
      timeoutMs: 25000,
      maxTokens: 32,
      logPrefix: '[ShowbizPhone:Test]',
    },
  );
  if (!res.ok) {
    return {
      ok: false,
      modelUsed: res.modelUsed,
      elapsedMs: res.elapsedMs,
      message: res.errorMessage || 'Kết nối thất bại.',
    };
  }
  return {
    ok: true,
    modelUsed: res.modelUsed || runtime.effectiveModel,
    elapsedMs: res.elapsedMs,
    message: `Kết nối thành công (${res.modelUsed || runtime.effectiveModel}, ${res.elapsedMs}ms).`,
  };
}

/**
 * Định dạng bài đăng MXH + các phản ứng nổi bật thành hành động/ngữ cảnh gọn đẹp
 * để đưa sang màn Truyện chính mà không làm rác bố cục.
 */
export function formatShowbizPostForStoryBridge(
  post: ShowbizPhonePost,
  mcName?: string,
): string {
  const resolvedMc = mcName?.trim() || 'Tôi';
  const who = post.isMc
    ? resolvedMc
    : `${post.authorName}${post.authorRole ? ` (${post.authorRole})` : ''}`;
  const hashtags = (post.hashtags || []).join(' ');
  const topComments = (post.comments || [])
    .slice(-3)
    .map((c) => `  - ${c.isMc ? resolvedMc : c.authorName}: "${c.text}"`)
    .join('\n');

  const lines = [
    `[Từ Điện thoại Showbiz · MXH]`,
    post.isMc
      ? `Tôi (${resolvedMc}) vừa xem lại bài đăng mới trên mạng xã hội của mình (${post.likes} lượt thích): "${post.content}"${hashtags ? ` ${hashtags}` : ''}.`
      : `Tôi (${resolvedMc}) mở điện thoại xem bài đăng mới trên mạng xã hội của ${who} (${post.likes} lượt thích): "${post.content}"${hashtags ? ` ${hashtags}` : ''}.`,
    topComments ? `Một vài bình luận đáng chú ý bên dưới:\n${topComments}` : '',
    `Hãy tiếp nối diễn biến tự nhiên trong cảnh truyện hiện tại dựa trên phản ứng xung quanh bài đăng này.`,
  ].filter(Boolean);

  return lines.join('\n');
}
