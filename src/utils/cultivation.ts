import type {
  BreakthroughOutcomeRecord,
  CharacterStateSnapshot,
  CharacterVitalsState,
  CultivationProfile,
  CultivationRankingBoard,
  CultivationRankingEntry,
  CultivationSubStage,
  CultivationSystemKind,
  CultivationTechnique,
  EquipmentMap,
  EquipmentSlotId,
  InventoryItem,
  InventoryItemCategory,
  InventoryItemQuality,
  MasteryLockConditionKind,
  ProdigyTier,
  TechniqueCategory,
  TechniqueMove,
  TechniqueTier,
  WorldGenreId,
} from '../types/ark';
import { formatDeltaMinutesVi } from './storyClock';
import {
  applyConstitutionEffectFromItem,
  createDefaultConstitution,
  detectAndSyncStoryConstitutionEvents,
  getConstitutionLabels,
  getRealmVisualTheme,
  isCelestialRootElixirItem,
  isConstitutionEnhancingItem,
  normalizeConstitutionState,
  resolveFoundationGrade,
  resolvePhysiqueGrade,
  resolveRealmQualityTier,
  resolveSpiritRootGrade,
  type ConstitutionInitHints,
  type ConstitutionSectionLabels,
  type ConstitutionUpgradeResult,
  type RealmVisualTheme,
  type StoryConstitutionSyncResult,
} from './cultivationConstitution';
import {
  applyBreakthroughFailureOutcome,
  computeBreakthroughOddsReport,
  consumeBreakthroughAssistItem,
  getBreakthroughAssistItems,
  type BreakthroughAssistOption,
  type BreakthroughDifficultyKind,
  type BreakthroughOddsFactor,
  type BreakthroughOddsReport,
  type BreakthroughRiskLevel,
} from './cultivationBreakthrough';
import {
  computeWuxiaTrainingMultiplier,
  createDefaultWuxiaState,
  detectWuxiaSanctuaryFromScene,
  evaluateWuxiaSynergy,
  findJianghuInnerArtByName,
  findWuxiaInnerArtByName,
  getWuxiaInnerArtCeilingInfo,
  getWuxiaTitleByLayer,
  getWuxiaTitleByRealmIndex,
  getWuxiaTitleReferenceRows,
  mapLegacyWuxiaRealmToIndex,
  normalizeWuxiaState,
  WUXIA_ALL_INNER_ARTS,
  WUXIA_ELEMENT_PATH_META,
  WUXIA_JIANGHU_INNER_ARTS,
  WUXIA_JIANGHU_LAYER_MILESTONES,
  WUXIA_NINE_YIN_AI_RULE_NOTE,
  WUXIA_NINE_YIN_TITLES,
  WUXIA_ORIGIN_META,
  WUXIA_SANCTUARY_META,
  WUXIA_SANCTUARY_ORDER,
  WUXIA_SECT_GRADE_META,
  WUXIA_SECT_INNER_ARTS,
  type WuxiaElementPathMeta,
  type WuxiaInnerArtCeilingInfo,
  type WuxiaJianghuInnerArt,
  type WuxiaNineYinTitle,
  type WuxiaSanctuaryMeta,
  type WuxiaTitleReferenceRow,
} from './wuxiaNineYin';
import {
  buildWuxiaGearAndNpcPromptSection,
  buyWuxiaShopItem,
  checkCraftingRecipeAvailability,
  computeWuxiaSilverBalance,
  craftWuxiaRecipe,
  findWuxiaCatalogItemById,
  findWuxiaCatalogItemByName,
  getItemSilverValuePerUnit,
  getWuxiaForgingSuggestion,
  spendWuxiaSilver,
  WUXIA_CATALOG_GROUPS,
  WUXIA_CRAFTING_RECIPES,
  WUXIA_ITEM_CATALOG,
  WUXIA_NPC_RARITY_RANKING_RULE,
  WUXIA_SHOP_LISTINGS,
  WUXIA_SHOP_VENUES,
  type WuxiaCatalogGroupId,
  type WuxiaCatalogGroupMeta,
  type WuxiaCatalogItem,
  type WuxiaCraftingDiscipline,
  type WuxiaCraftingIngredientReq,
  type WuxiaCraftingRecipe,
  type WuxiaForgingSuggestion,
  type WuxiaShopListing,
  type WuxiaShopVenueId,
  type WuxiaShopVenueMeta,
  type WuxiaSilverWallet,
} from './wuxiaItems';

export {
  applyBreakthroughFailureOutcome,
  applyConstitutionEffectFromItem,
  buildWuxiaGearAndNpcPromptSection,
  buyWuxiaShopItem,
  checkCraftingRecipeAvailability,
  computeBreakthroughOddsReport,
  computeWuxiaSilverBalance,
  computeWuxiaTrainingMultiplier,
  consumeBreakthroughAssistItem,
  craftWuxiaRecipe,
  createDefaultConstitution,
  createDefaultWuxiaState,
  detectAndSyncStoryConstitutionEvents,
  detectWuxiaSanctuaryFromScene,
  evaluateWuxiaSynergy,
  findJianghuInnerArtByName,
  findWuxiaCatalogItemById,
  findWuxiaCatalogItemByName,
  findWuxiaInnerArtByName,
  getBreakthroughAssistItems,
  getConstitutionLabels,
  getItemSilverValuePerUnit,
  getRealmVisualTheme,
  getWuxiaForgingSuggestion,
  getWuxiaInnerArtCeilingInfo,
  getWuxiaTitleByLayer,
  getWuxiaTitleByRealmIndex,
  getWuxiaTitleReferenceRows,
  isCelestialRootElixirItem,
  isConstitutionEnhancingItem,
  mapLegacyWuxiaRealmToIndex,
  normalizeConstitutionState,
  normalizeWuxiaState,
  resolveFoundationGrade,
  resolvePhysiqueGrade,
  resolveRealmQualityTier,
  resolveSpiritRootGrade,
  spendWuxiaSilver,
  WUXIA_ALL_INNER_ARTS,
  WUXIA_CATALOG_GROUPS,
  WUXIA_CRAFTING_RECIPES,
  WUXIA_ELEMENT_PATH_META,
  WUXIA_ITEM_CATALOG,
  WUXIA_JIANGHU_INNER_ARTS,
  WUXIA_JIANGHU_LAYER_MILESTONES,
  WUXIA_NINE_YIN_AI_RULE_NOTE,
  WUXIA_NINE_YIN_TITLES,
  WUXIA_NPC_RARITY_RANKING_RULE,
  WUXIA_ORIGIN_META,
  WUXIA_SANCTUARY_META,
  WUXIA_SANCTUARY_ORDER,
  WUXIA_SECT_GRADE_META,
  WUXIA_SECT_INNER_ARTS,
  WUXIA_SHOP_LISTINGS,
  WUXIA_SHOP_VENUES,
  type BreakthroughAssistOption,
  type BreakthroughDifficultyKind,
  type BreakthroughOddsFactor,
  type BreakthroughOddsReport,
  type BreakthroughRiskLevel,
  type ConstitutionInitHints,
  type ConstitutionSectionLabels,
  type ConstitutionUpgradeResult,
  type RealmVisualTheme,
  type StoryConstitutionSyncResult,
  type WuxiaCatalogGroupId,
  type WuxiaCatalogGroupMeta,
  type WuxiaCatalogItem,
  type WuxiaCraftingDiscipline,
  type WuxiaCraftingIngredientReq,
  type WuxiaCraftingRecipe,
  type WuxiaElementPathMeta,
  type WuxiaForgingSuggestion,
  type WuxiaInnerArtCeilingInfo,
  type WuxiaJianghuInnerArt,
  type WuxiaNineYinTitle,
  type WuxiaSanctuaryMeta,
  type WuxiaShopListing,
  type WuxiaShopVenueId,
  type WuxiaShopVenueMeta,
  type WuxiaSilverWallet,
  type WuxiaTitleReferenceRow,
};

export const CULTIVATION_SCHEMA_VERSION = 2;
export const MAX_RANKING_ENTRIES_PER_BOARD = 10;

/**
 * Shared Hán-Việt character naming principles for Xianxia / Xuanhuan / Wuxia
 * (Main, NPC, Thiên kiêu, cường giả): natural, varied, rhythmic, and free of rigid word bans.
 */
export const CULTIVATION_CHARACTER_NAMING_GUIDELINE = [
  'Nguyên tắc đặt tên nhân vật Hán-Việt (Main, NPC, Thiên kiêu, cường giả):',
  '- KHÔNG cấm cứng tên, họ hay chữ đệm: Không áp đặt danh sách cấm chữ gây gượng gạo; các chữ quen thuộc vẫn dùng thoải mái khi hợp tính cách, tông môn, thân phận hoặc bối cảnh thế giới.',
  '- Đa dạng & tránh lặp liên tiếp: Trong cùng một lượt sinh hoặc cùng một nhóm nhân vật/NPC/Thiên kiêu, không đặt trùng tên và tránh lặp cùng một chữ lót/tên chính quá dày đặc; phối hợp hài hòa giữa tên quen tai dễ nhớ với các tên mang sắc thái cổ phong, địa phương, huyết mạch hoặc danh xưng riêng để mỗi người có dấu ấn riêng.',
  '- Âm điệu & phù hợp thể loại: Tên dễ đọc, dễ nhớ, có nhịp điệu thanh Bằng – thanh Trắc tự nhiên và khớp thân phận (đệ tử tông môn, tán tu, thế gia, ma đạo, giang hồ khách...).',
].join('\n');

export const CULTIVATION_SUB_STAGES: readonly CultivationSubStage[] = [
  'Sơ kỳ',
  'Trung kỳ',
  'Hậu kỳ',
  'Đỉnh phong',
] as const;

export const OVERFLOW_EXP_CAP_RATIO = 0.5;
export const SINGLE_EVENT_EXP_CAP_RATIO = 1.0;
export const MINOR_BREAKTHROUGH_CARRY_RATE = 1.0;
export const MINOR_BREAKTHROUGH_CARRY_MAX_RATIO = 0.45;
export const MAJOR_BREAKTHROUGH_CARRY_RATE = 0.75;
export const MAJOR_BREAKTHROUGH_CARRY_MAX_RATIO = 0.3;

export interface QuickSeclusionPreset {
  id: string;
  label: string;
  months?: number;
  years?: number;
  hint: string;
}

export function getQuickSeclusionPresets(
  systemKind: CultivationSystemKind,
): QuickSeclusionPreset[] {
  if (systemKind === 'wuxia') {
    return [
      { id: 'wuxia_1m', label: '+1 tháng', months: 1, hint: 'Bế quan ngắn rèn nội lực' },
      { id: 'wuxia_3m', label: '+3 tháng', months: 3, hint: 'Một quý khổ luyện tâm pháp' },
      { id: 'wuxia_6m', label: '+6 tháng', months: 6, hint: 'Nửa năm tọa quan ổn định căn cơ' },
      { id: 'wuxia_1y', label: '+1 năm', years: 1, hint: 'Một năm chuyên tu bế quan' },
    ];
  }
  if (systemKind === 'xuanhuan') {
    return [
      { id: 'xh_1y', label: '+1 năm', years: 1, hint: 'Một năm khổ tu huyền khí' },
      { id: 'xh_3y', label: '+3 năm', years: 3, hint: 'Ba năm bế quan luyện thể & huyết mạch' },
      { id: 'xh_5y', label: '+5 năm', years: 5, hint: 'Năm năm tích lũy xung kích bình cảnh' },
      { id: 'xh_10y', label: '+10 năm', years: 10, hint: 'Mười năm đại bế quan tích tụ căn cơ' },
    ];
  }
  return [
    { id: 'xx_1y', label: '+1 năm', years: 1, hint: 'Một năm đả tọa hấp thu linh khí' },
    { id: 'xx_3y', label: '+3 năm', years: 3, hint: 'Ba năm tĩnh tu củng cố đạo cơ' },
    { id: 'xx_5y', label: '+5 năm', years: 5, hint: 'Năm năm bế quan dài hạn' },
    { id: 'xx_10y', label: '+10 năm', years: 10, hint: 'Mười năm đại bế quan tầm đạo' },
  ];
}

export function getCultivationPaceDescription(
  systemKind: CultivationSystemKind,
): string {
  if (systemKind === 'wuxia') {
    return 'Kiếm hiệp tính tiến độ theo Tháng (tu ngắn vài giờ chỉ tăng tượng trưng).';
  }
  if (systemKind === 'xuanhuan') {
    return 'Huyền huyễn tích lũy theo Tháng/Năm (cơ duyên/đan dược hỗ trợ thêm nhưng vẫn bị khóa bình cảnh).';
  }
  return 'Tiên hiệp tính tiến độ theo Năm (tu luyện vài giờ chỉ tích tụ rất nhỏ, không thể nhảy cấp).';
}

export interface BreakthroughBottleneckInfo {
  isBlocked: boolean;
  kind: 'none' | 'minor_bottleneck' | 'major_bottleneck' | 'tribulation' | 'max_realm';
  title: string;
  description: string;
  actionLabel: string;
  nextRealmName?: string;
}

export function getBreakthroughBottleneckInfo(
  profile: CultivationProfile,
): BreakthroughBottleneckInfo {
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  const safeIdx = Math.max(0, Math.min(realms.length - 1, profile.realmIndex));
  const currentStage = realms[safeIdx] || realms[0];
  const isFull =
    Boolean(profile.readyToBreakthrough) ||
    profile.exp >= Math.max(10, profile.maxExp);

  if (!isFull) {
    return {
      isBlocked: false,
      kind: 'none',
      title: 'Đang tích lũy tu vi',
      description: 'Cần tiếp tục tích lũy tới 100% trước khi chạm bình cảnh.',
      actionLabel: 'Chưa đủ tu vi',
    };
  }

  if (profile.systemKind === 'wuxia') {
    const ceiling = getWuxiaInnerArtCeilingInfo(profile);
    if (ceiling.isAtArtCeiling) {
      return {
        isBlocked: true,
        kind: 'max_realm',
        title: `Chạm trần bộ nội công: ${ceiling.activeArtName} (Tầng ${ceiling.maxLayer})`,
        description: ceiling.ceilingMessage,
        actionLabel: 'Đã chạm trần bộ nội công',
        nextRealmName: `${ceiling.maxAchievableTitle.title} (Tầng ${ceiling.maxLayer})`,
      };
    }
  }

  const nextStage = safeIdx + 1 < realms.length ? realms[safeIdx + 1] : null;
  if (!nextStage) {
    return {
      isBlocked: true,
      kind: 'max_realm',
      title: 'Đỉnh phong tuyệt đỉnh — Chờ củng cố',
      description:
        'Tu vi đã chạm cực hạn cảnh giới cao nhất. Xác nhận để củng cố căn cơ đỉnh phong.',
      actionLabel: 'Xác nhận củng cố đỉnh phong',
      nextRealmName: profile.realmName,
    };
  }

  const currentMajor = profile.majorRealm || currentStage.majorRealm;
  const isMajor =
    profile.systemKind === 'wuxia'
      ? Boolean(getWuxiaTitleByRealmIndex(safeIdx + 1).isMajorMilestone)
      : nextStage.majorRealm !== currentMajor;

  if (profile.systemKind === 'wuxia') {
    const nextTier = getWuxiaTitleByRealmIndex(safeIdx + 1);
    return {
      isBlocked: true,
      kind: isMajor ? 'major_bottleneck' : 'minor_bottleneck',
      title: isMajor
        ? `Bình Cảnh Nội Công Đại Mốc → ${nextTier.title} (${nextTier.layerRangeLabel})`
        : `Bình Cảnh Tầng Nội Công → ${nextTier.title} (${nextTier.layerRangeLabel})`,
      description: isMajor
        ? `Nội lực đã tích đầy ngưỡng đột phá lớn (${nextTier.meaningVi}). Kiểm tra độ tương hợp kinh mạch, lộ tuyến nội công và đan dược trước khi xung kích để tránh tẩu hỏa.`
        : `Nội lực đã đầy chốt chặn tầng hiện tại — xác nhận xung kích lên ${nextTier.title} (${nextTier.layerRangeLabel}) hoặc đưa sự kiện đột phá vào truyện.`,
      actionLabel: `Xung kích ${nextTier.title}`,
      nextRealmName: `${nextTier.title} (Tầng ${nextTier.minLayer})`,
    };
  }

  if (isMajor) {
    const needsTribulation =
      profile.systemKind === 'xianxia' && safeIdx >= 13;
    if (needsTribulation) {
      return {
        isBlocked: true,
        kind: 'tribulation',
        title: `Thiên Kiếp & Bình Cảnh Đại Cảnh Giới → ${nextStage.name}`,
        description:
          'Tu vi đã đầy và bị khóa tại chốt chặn đại cảnh giới. Cần chủ động chuẩn bị hộ pháp, đan dược hoặc dẫn lôi độ kiếp rồi mới xác nhận đột phá.',
        actionLabel: `Xác nhận độ kiếp lên ${nextStage.name}`,
        nextRealmName: nextStage.name,
      };
    }
    return {
      isBlocked: true,
      kind: 'major_bottleneck',
      title: `Bình Cảnh Đại Cảnh Giới → ${nextStage.name}`,
      description:
        'Hệ thống đã khóa nhảy cảnh giới tự động. Hãy xác nhận phá quan hoặc đưa sự kiện đột phá vào lượt truyện để xử lý bình cảnh.',
      actionLabel: `Xác nhận đột phá lên ${nextStage.name}`,
      nextRealmName: nextStage.name,
    };
  }

  return {
    isBlocked: true,
    kind: 'minor_bottleneck',
    title: `Bình Cảnh Tiểu Cảnh Giới → ${nextStage.name}`,
    description:
      'Thanh tu vi đã đầy và tạm khóa tại chốt chặn bình cảnh — không tự động thăng cấp. Bạn có thể chủ động xác nhận đột phá từng bước.',
    actionLabel: `Xác nhận lên ${nextStage.name}`,
    nextRealmName: nextStage.name,
  };
}

export function enforceTopTenPerBoard(
  rankings: CultivationRankingEntry[],
): CultivationRankingEntry[] {
  if (!Array.isArray(rankings) || rankings.length === 0) return [];
  const result: CultivationRankingEntry[] = [];

  for (const boardId of CULTIVATION_RANKING_BOARD_ORDER) {
    const seenNames = new Set<string>();
    const boardItems = rankings
      .filter((entry) => entry && entry.board === boardId && entry.name.trim())
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        const scoreA = (a.powerScore || 0) * 0.65 + (a.fameScore || 0) * 0.35;
        const scoreB = (b.powerScore || 0) * 0.65 + (b.fameScore || 0) * 0.35;
        return scoreB - scoreA;
      })
      .filter((entry) => {
        const key = entry.name.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!key || seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      })
      .slice(0, MAX_RANKING_ENTRIES_PER_BOARD)
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
      }));
    result.push(...boardItems);
  }

  return result;
}

export interface RankingIntelLocationStatus {
  canUnlockIntel: boolean;
  matchedPlace?: string;
  reason: string;
}

const INFO_HUB_PLACE_REGEX =
  /(?:thành|đô thành|kinh thành|hoàng thành|tiên thành|linh thành|cổ thành|vương thành|huyện thành|thị trấn|trấn|phường thị|khu chợ|chợ|tửu lầu|tửu quán|trà lâu|quán trà|khách điếm|quán trọ|truyền tống trận|thương hội|đấu giá|bảo các|vạn bảo lâu|thiên cơ các|bách hiểu lâu|tình báo|tông môn|nội môn|ngoại môn|đại điện|tàng kinh các|tông đường|học viện|phủ đệ|gia tộc|quảng trường|dịch trạm|bến cảng|cảng|bảng cáo thị|thương hành|tụ bảo)/i;

const SECLUSION_WILD_REGEX =
  /(?:động phủ|mật thất|bế quan|hoang sơn|thâm sơn|rừng sâu|bí cảnh|hang động|hoang mạc|sa mạc|núi hoang|cấm địa|đầm lầy|biển sâu|vực sâu|tuyệt cốc|sơn cốc hoang)/i;

export function detectRankingIntelLocation(params: {
  characterStates?: CharacterStateSnapshot[];
  mcName?: string;
  recentTurnText?: string;
  worldSetting?: string;
}): RankingIntelLocationStatus {
  const states = params.characterStates || [];
  const mcKey = (params.mcName || '').trim().toLowerCase();
  const mcState =
    states.find((s) => s.isMc) ||
    (mcKey
      ? states.find((s) => s.name.trim().toLowerCase() === mcKey)
      : undefined);

  const mcLocation = (mcState?.location || '').trim();
  const tailScene = (params.recentTurnText || '').slice(-1400);

  if (mcLocation) {
    const locHubMatch = mcLocation.match(INFO_HUB_PLACE_REGEX);
    if (locHubMatch) {
      return {
        canUnlockIntel: true,
        matchedPlace: mcLocation,
        reason: `Đang ở ${mcLocation} — có thể nghe ngóng và mở hồ sơ đầy đủ của nhân vật trên bảng.`,
      };
    }
    if (SECLUSION_WILD_REGEX.test(mcLocation)) {
      return {
        canUnlockIntel: false,
        matchedPlace: mcLocation,
        reason: `Đang ở ${mcLocation} (khu vực bế quan/hoang dã) — chỉ nghe được phong thanh. Hãy tới thành thị, phường thị, tửu lầu, thương hội, truyền tống trận hoặc tông môn để mở tin chi tiết.`,
      };
    }
  }

  const sceneHubMatch = tailScene.match(INFO_HUB_PLACE_REGEX);
  if (sceneHubMatch) {
    const placeLabel = mcLocation || sceneHubMatch[0];
    return {
      canUnlockIntel: true,
      matchedPlace: placeLabel,
      reason: `Bối cảnh gần nhất có nhắc tới ${placeLabel} — có thể dò hỏi và mở thông tin đầy đủ.`,
    };
  }

  return {
    canUnlockIntel: false,
    matchedPlace: mcLocation || undefined,
    reason: mcLocation
      ? `Vị trí hiện tại (${mcLocation}) chưa phải trung tâm tin tức — chỉ xem được tin đồn/phong thanh. Hãy di chuyển tới thành thị, tửu lầu, phường thị, truyền tống trận hoặc tông môn để mở khóa đầy đủ.`
      : 'Chưa ghi nhận đang ở thành thị hay nơi tụ tập tin tức — hiện chỉ có phong thanh sơ lược. Hãy tới thành thị, tửu lầu, thương hội hoặc tông môn để dò la chi tiết.',
  };
}

export interface RealmStage {
  name: string;
  majorRealm: string;
  subStage: CultivationSubStage;
  minorTier?: number;
  maxExp: number;
}

/**
 * Legacy v1 Xianxia realm list (15 entries) preserved solely for lossless
 * index-to-stage migration when importing old saves lacking realmName/majorRealm/subStage.
 */
const LEGACY_XIANXIA_V1_REALMS: readonly string[] = [
  'Luyện Khí Tầng 1',
  'Luyện Khí Tầng 2',
  'Luyện Khí Tầng 4',
  'Luyện Khí Tầng 7',
  'Luyện Khí Đại Viên Mãn',
  'Trúc Cơ Sơ Kỳ',
  'Trúc Cơ Trung Kỳ',
  'Trúc Cơ Hậu Kỳ',
  'Kim Đan Sơ Kỳ',
  'Kim Đan Hậu Kỳ',
  'Nguyên Anh Sơ Kỳ',
  'Nguyên Anh Đại Viên Mãn',
  'Hóa Thần Kỳ',
  'Đại Thừa Kỳ',
  'Độ Kiếp Kỳ',
];

function buildFourSubStageRealms(
  majorRealm: string,
  expTable: [number, number, number, number],
): RealmStage[] {
  return [
    {
      name: `${majorRealm} Sơ kỳ`,
      majorRealm,
      subStage: 'Sơ kỳ',
      maxExp: expTable[0],
    },
    {
      name: `${majorRealm} Trung kỳ`,
      majorRealm,
      subStage: 'Trung kỳ',
      maxExp: expTable[1],
    },
    {
      name: `${majorRealm} Hậu kỳ`,
      majorRealm,
      subStage: 'Hậu kỳ',
      maxExp: expTable[2],
    },
    {
      name: `${majorRealm} Đỉnh phong`,
      majorRealm,
      subStage: 'Đỉnh phong',
      maxExp: expTable[3],
    },
  ];
}

const XIANXIA_CANONICAL_REALMS: RealmStage[] = [
  // Luyện Khí: đầy đủ Tầng 1–9 (1–3 Sơ kỳ, 4–6 Trung kỳ, 7–9 Hậu kỳ) + Đỉnh phong
  {
    name: 'Luyện Khí Tầng 1 (Sơ kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Sơ kỳ',
    minorTier: 1,
    maxExp: 100,
  },
  {
    name: 'Luyện Khí Tầng 2 (Sơ kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Sơ kỳ',
    minorTier: 2,
    maxExp: 120,
  },
  {
    name: 'Luyện Khí Tầng 3 (Sơ kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Sơ kỳ',
    minorTier: 3,
    maxExp: 150,
  },
  {
    name: 'Luyện Khí Tầng 4 (Trung kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Trung kỳ',
    minorTier: 4,
    maxExp: 190,
  },
  {
    name: 'Luyện Khí Tầng 5 (Trung kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Trung kỳ',
    minorTier: 5,
    maxExp: 235,
  },
  {
    name: 'Luyện Khí Tầng 6 (Trung kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Trung kỳ',
    minorTier: 6,
    maxExp: 285,
  },
  {
    name: 'Luyện Khí Tầng 7 (Hậu kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Hậu kỳ',
    minorTier: 7,
    maxExp: 345,
  },
  {
    name: 'Luyện Khí Tầng 8 (Hậu kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Hậu kỳ',
    minorTier: 8,
    maxExp: 415,
  },
  {
    name: 'Luyện Khí Tầng 9 (Hậu kỳ)',
    majorRealm: 'Luyện Khí',
    subStage: 'Hậu kỳ',
    minorTier: 9,
    maxExp: 500,
  },
  {
    name: 'Luyện Khí Đỉnh phong',
    majorRealm: 'Luyện Khí',
    subStage: 'Đỉnh phong',
    maxExp: 600,
  },
  // Mọi đại cảnh giới từ Trúc Cơ trở lên đều có đủ 4 giai đoạn: Sơ kỳ → Trung kỳ → Hậu kỳ → Đỉnh phong
  ...buildFourSubStageRealms('Trúc Cơ', [800, 1050, 1350, 1750]),
  ...buildFourSubStageRealms('Kim Đan', [2300, 3000, 3900, 5000]),
  ...buildFourSubStageRealms('Nguyên Anh', [6500, 8400, 10800, 13800]),
  ...buildFourSubStageRealms('Hóa Thần', [17500, 22000, 27500, 34500]),
  ...buildFourSubStageRealms('Luyện Hư', [43000, 53500, 66500, 82500]),
  ...buildFourSubStageRealms('Hợp Thể', [102000, 126000, 155000, 190000]),
  ...buildFourSubStageRealms('Đại Thừa', [235000, 290000, 355000, 435000]),
  ...buildFourSubStageRealms('Độ Kiếp', [535000, 655000, 800000, 980000]),
  ...buildFourSubStageRealms('Chân Tiên', [1200000, 1480000, 1820000, 2250000]),
];

export const CULTIVATION_SYSTEM_META: Record<
  CultivationSystemKind,
  {
    label: string;
    shortLabel: string;
    energyLabel: string;
    bagName: string;
    techniqueSectionLabel: string;
    categoryLabels: Record<TechniqueCategory, string>;
    realms: RealmStage[];
  }
> = {
  xianxia: {
    label: 'Tiên Hiệp',
    shortLabel: 'Tu Tiên',
    energyLabel: 'Tu vi / Linh lực',
    bagName: 'Túi trữ vật',
    techniqueSectionLabel: 'Công pháp & Pháp thuật',
    categoryLabels: {
      mental: 'Tâm pháp / Công pháp',
      martial: 'Kiếm quyết / Pháp thuật',
      movement: 'Thân pháp / Độn thuật',
      secret: 'Bí thuật',
    },
    realms: XIANXIA_CANONICAL_REALMS,
  },
  xuanhuan: {
    label: 'Huyền Huyễn',
    shortLabel: 'Huyền Khí',
    energyLabel: 'Huyền khí / Hồn lực',
    bagName: 'Nhẫn không gian',
    techniqueSectionLabel: 'Huyền công & Chiến kỹ',
    categoryLabels: {
      mental: 'Huyền công / Tâm pháp',
      martial: 'Chiến kỹ / Võ kỹ',
      movement: 'Thân pháp',
      secret: 'Huyết mạch / Bí kỹ',
    },
    realms: [
      { name: 'Luyện Thể Cảnh', majorRealm: 'Luyện Thể', subStage: 'Sơ kỳ', maxExp: 100 },
      { name: 'Ngưng Huyền Nhất Trọng', majorRealm: 'Ngưng Huyền', subStage: 'Sơ kỳ', minorTier: 1, maxExp: 130 },
      { name: 'Ngưng Huyền Ngũ Trọng', majorRealm: 'Ngưng Huyền', subStage: 'Trung kỳ', minorTier: 5, maxExp: 210 },
      { name: 'Ngưng Huyền Cửu Trọng', majorRealm: 'Ngưng Huyền', subStage: 'Đỉnh phong', minorTier: 9, maxExp: 340 },
      { name: 'Huyền Sư Sơ Kỳ', majorRealm: 'Huyền Sư', subStage: 'Sơ kỳ', maxExp: 550 },
      { name: 'Huyền Sư Đỉnh Phong', majorRealm: 'Huyền Sư', subStage: 'Đỉnh phong', maxExp: 850 },
      { name: 'Đại Huyền Sư', majorRealm: 'Đại Huyền Sư', subStage: 'Sơ kỳ', maxExp: 1300 },
      { name: 'Huyền Linh Cảnh', majorRealm: 'Huyền Linh', subStage: 'Sơ kỳ', maxExp: 1950 },
      { name: 'Huyền Vương Cảnh', majorRealm: 'Huyền Vương', subStage: 'Sơ kỳ', maxExp: 2900 },
      { name: 'Huyền Hoàng Cảnh', majorRealm: 'Huyền Hoàng', subStage: 'Sơ kỳ', maxExp: 4300 },
      { name: 'Huyền Tông Cảnh', majorRealm: 'Huyền Tông', subStage: 'Sơ kỳ', maxExp: 6400 },
      { name: 'Huyền Tôn Cảnh', majorRealm: 'Huyền Tôn', subStage: 'Sơ kỳ', maxExp: 9500 },
      { name: 'Huyền Thánh Cảnh', majorRealm: 'Huyền Thánh', subStage: 'Sơ kỳ', maxExp: 14500 },
      { name: 'Huyền Đế Cảnh', majorRealm: 'Huyền Đế', subStage: 'Đỉnh phong', maxExp: 22000 },
    ],
  },
  wuxia: {
    label: 'Kiếm Hiệp',
    shortLabel: 'Võ Học',
    energyLabel: 'Nội lực / Chân khí',
    bagName: 'Hành trang giang hồ',
    techniqueSectionLabel: 'Nội công & Võ công',
    categoryLabels: {
      mental: 'Nội công tâm pháp',
      martial: 'Kiếm pháp / Võ công',
      movement: 'Khinh công / Thân pháp',
      secret: 'Tuyệt học / Ám khí',
    },
    realms: WUXIA_NINE_YIN_TITLES.map((t) => ({
      name: `${t.title} (${t.layerRangeLabel})`,
      majorRealm: t.title,
      subStage: t.subStage,
      minorTier: t.minLayer,
      maxExp: t.maxExp,
    })),
  },
};

export const TECHNIQUE_TIER_META: Record<
  TechniqueTier,
  { label: string; textClass: string; speedMultiplier: number }
> = {
  pham: { label: 'Phàm giai', textClass: 'text-slate-300', speedMultiplier: 1.0 },
  linh: { label: 'Linh giai', textClass: 'text-emerald-300', speedMultiplier: 1.15 },
  huyen: { label: 'Huyền giai', textClass: 'text-sky-300', speedMultiplier: 1.3 },
  dia: { label: 'Địa giai', textClass: 'text-violet-300', speedMultiplier: 1.48 },
  thien: { label: 'Thiên giai', textClass: 'text-amber-300', speedMultiplier: 1.68 },
  chiton: { label: 'Chí tôn', textClass: 'text-rose-300', speedMultiplier: 1.9 },
};

export interface InventoryQualityMeta {
  label: string;
  shortLabel: string;
  tierAlias: string;
  rankOrder: number;
  textClass: string;
  nameClass: string;
  cardClass: string;
  shimmerClass: string;
  accentDotClass: string;
  hasSparkle: boolean;
}

export const INVENTORY_QUALITY_ORDER: readonly InventoryItemQuality[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'immortal',
] as const;

export const INVENTORY_QUALITY_META: Record<
  InventoryItemQuality,
  InventoryQualityMeta
> = {
  common: {
    label: 'Phàm phẩm (Hạ phẩm)',
    shortLabel: 'Phàm phẩm',
    tierAlias: 'Hạ phẩm',
    rankOrder: 1,
    textClass: 'text-slate-400',
    nameClass: 'text-slate-200',
    cardClass:
      'bg-[#101827]/85 ring-1 ring-inset ring-slate-400/20',
    shimmerClass: '',
    accentDotClass: 'text-slate-400',
    hasSparkle: false,
  },
  uncommon: {
    label: 'Hoàng phẩm (Trung phẩm)',
    shortLabel: 'Hoàng phẩm',
    tierAlias: 'Trung phẩm',
    rankOrder: 2,
    textClass: 'text-emerald-300',
    nameClass: 'text-emerald-200',
    cardClass:
      'bg-gradient-to-br from-emerald-950/38 via-[#0f1a28]/90 to-[#0d1524]/95 ring-1 ring-inset ring-emerald-400/32',
    shimmerClass: '',
    accentDotClass: 'text-emerald-300',
    hasSparkle: false,
  },
  rare: {
    label: 'Huyền phẩm (Thượng phẩm)',
    shortLabel: 'Huyền phẩm',
    tierAlias: 'Thượng phẩm',
    rankOrder: 3,
    textClass: 'text-sky-300',
    nameClass: 'text-sky-200',
    cardClass:
      'bg-gradient-to-br from-sky-950/48 via-[#0f1b2e]/92 to-cyan-950/28 ring-1 ring-inset ring-sky-400/44 shadow-[0_0_16px_-10px_rgba(56,189,248,0.45)]',
    shimmerClass: '',
    accentDotClass: 'text-sky-300',
    hasSparkle: false,
  },
  epic: {
    label: 'Cực phẩm (Địa phẩm)',
    shortLabel: 'Cực phẩm',
    tierAlias: 'Địa phẩm',
    rankOrder: 4,
    textClass: 'text-fuchsia-300',
    nameClass: 'text-fuchsia-200',
    cardClass:
      'bg-gradient-to-br from-violet-950/55 via-[#18122b]/92 to-fuchsia-950/40 ring-1 ring-inset ring-fuchsia-400/52 shadow-[0_0_22px_-9px_rgba(217,70,239,0.52)]',
    shimmerClass: 'item-card-shimmer item-shimmer-epic',
    accentDotClass: 'text-fuchsia-300',
    hasSparkle: true,
  },
  legendary: {
    label: 'Thiên phẩm',
    shortLabel: 'Thiên phẩm',
    tierAlias: 'Thiên giai',
    rankOrder: 5,
    textClass: 'text-amber-300',
    nameClass:
      'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent',
    cardClass:
      'bg-gradient-to-br from-amber-950/58 via-[#1d1711]/92 to-yellow-950/32 ring-1 ring-inset ring-amber-300/62 shadow-[0_0_24px_-7px_rgba(251,191,36,0.56)]',
    shimmerClass: 'item-card-shimmer item-shimmer-legendary',
    accentDotClass: 'text-amber-300',
    hasSparkle: true,
  },
  immortal: {
    label: 'Tiên phẩm',
    shortLabel: 'Tiên phẩm',
    tierAlias: 'Tiên giai · Lưu quang',
    rankOrder: 6,
    textClass: 'text-rose-200',
    nameClass: 'item-text-immortal',
    cardClass:
      'bg-gradient-to-br from-cyan-950/50 via-[#1a142a]/92 to-rose-950/48 ring-1 ring-inset ring-rose-200/65 shadow-[0_0_28px_-6px_rgba(244,114,182,0.45),0_0_18px_-4px_rgba(56,189,248,0.4)]',
    shimmerClass: 'item-card-shimmer item-shimmer-immortal',
    accentDotClass: 'text-rose-200',
    hasSparkle: true,
  },
};

export function getInventoryQualityMeta(
  quality: InventoryItemQuality,
  systemKind: CultivationSystemKind = 'xianxia',
): InventoryQualityMeta {
  const base =
    INVENTORY_QUALITY_META[quality] || INVENTORY_QUALITY_META.common;
  if (systemKind === 'wuxia' && quality === 'immortal') {
    return {
      ...base,
      label: 'Tuyệt thế (Thần phẩm)',
      shortLabel: 'Tuyệt thế',
      tierAlias: 'Tuyệt thế · Lưu quang',
    };
  }
  return base;
}

export const INVENTORY_CATEGORY_ORDER: readonly InventoryItemCategory[] = [
  'consumable',
  'weapon',
  'outfit',
  'herb',
  'talisman',
  'material',
  'misc',
] as const;

export const INVENTORY_CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  consumable: 'Đan dược',
  weapon: 'Pháp bảo / Khí đạo',
  outfit: 'Ngoại trang & Y giáp',
  herb: 'Thiên tài địa bảo · Linh thảo · Khoáng thạch',
  talisman: 'Phù lục · Trận bàn · Ngọc giản',
  material: 'Linh thạch & Tài nguyên tu luyện',
  misc: 'Vật phẩm khác',
};

export const INVENTORY_CATEGORY_SHORT_LABELS: Record<
  InventoryItemCategory,
  string
> = {
  consumable: 'Đan dược',
  weapon: 'Pháp bảo',
  outfit: 'Ngoại trang',
  herb: 'Linh thảo / Khoáng',
  talisman: 'Phù lục / Ngọc giản',
  material: 'Linh thạch',
  misc: 'Khác',
};

const WUXIA_CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  weapon: 'Thần binh lợi khí (Vũ khí)',
  outfit: 'Ngoại trang & Y giáp làm đẹp',
  consumable: 'Linh dược võ lâm',
  talisman: 'Bí kíp · Tàn quyển · Tín vật giang hồ',
  herb: 'Khoáng thạch · Kim ti · Thảo dược chế tác',
  material: 'Nguyên liệu giang hồ',
  misc: 'Lộ phí, Bạc & Đồ hành tẩu',
};

const WUXIA_CATEGORY_SHORT_LABELS: Record<InventoryItemCategory, string> = {
  weapon: 'Thần binh',
  outfit: 'Ngoại trang',
  consumable: 'Linh dược',
  talisman: 'Bí kíp · Tín vật',
  herb: 'Nguyên liệu',
  material: 'Tài nguyên',
  misc: 'Bạc · Hành tẩu',
};

export function getInventoryCategoryOrder(
  systemKind: CultivationSystemKind = 'xianxia',
  forForm = false,
): readonly InventoryItemCategory[] {
  if (systemKind === 'wuxia') {
    return forForm
      ? ['weapon', 'outfit', 'consumable', 'talisman', 'herb', 'misc']
      : ['weapon', 'outfit', 'consumable', 'talisman', 'herb', 'material', 'misc'];
  }
  return forForm
    ? ['consumable', 'weapon', 'outfit', 'herb', 'talisman', 'material', 'misc']
    : INVENTORY_CATEGORY_ORDER;
}

export function getInventoryCategoryLabel(
  category: InventoryItemCategory,
  systemKind: CultivationSystemKind = 'xianxia',
): string {
  if (systemKind === 'wuxia') {
    return WUXIA_CATEGORY_LABELS[category] || 'Vật phẩm giang hồ';
  }
  if (category === 'outfit') {
    return 'Pháp y & Y giáp';
  }
  return INVENTORY_CATEGORY_LABELS[category] || 'Vật phẩm';
}

export function getInventoryCategoryShortLabel(
  category: InventoryItemCategory,
  systemKind: CultivationSystemKind = 'xianxia',
): string {
  if (systemKind === 'wuxia') {
    return WUXIA_CATEGORY_SHORT_LABELS[category] || 'Khác';
  }
  if (category === 'outfit') {
    return 'Pháp y / Giáp';
  }
  return INVENTORY_CATEGORY_SHORT_LABELS[category] || 'Khác';
}

export interface XianxiaCatalogItem {
  id: string;
  name: string;
  category: InventoryItemCategory;
  quality: InventoryItemQuality;
  defaultQuantity: number;
  description: string;
  equipSlot?: EquipmentSlotId;
}

export const XIANXIA_ITEM_CATALOG: readonly XianxiaCatalogItem[] = [
  // 1. Đan dược (consumable)
  {
    id: 'cat_dan_tu_khi',
    name: 'Tụ Khí Đan',
    category: 'consumable',
    quality: 'uncommon',
    defaultQuantity: 3,
    description:
      'Đan dược tụ linh nhập môn, giúp dẫn thiên địa linh khí vào đan điền nhanh và êm dịu hơn.',
  },
  {
    id: 'cat_dan_ho_mach',
    name: 'Hộ Mạch Linh Đan',
    category: 'consumable',
    quality: 'rare',
    defaultQuantity: 2,
    description:
      'Ôn dưỡng và gia cố kinh mạch, ngăn chân khí bạo động hay phản phệ khi xung kích bình cảnh.',
  },
  {
    id: 'cat_dan_tay_tuy',
    name: 'Tẩy Tủy Phạt Cốt Đan',
    category: 'consumable',
    quality: 'rare',
    defaultQuantity: 1,
    description:
      'Gột rửa tạp chất trong cân cốt, khai thông linh mạch ẩn tàng và tăng độ tinh thuần linh lực.',
  },
  {
    id: 'cat_dan_truc_co',
    name: 'Trúc Cơ Đan',
    category: 'consumable',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Linh đan cực phẩm giúp ngưng tụ đạo cơ vững chắc, nâng mạnh tỷ lệ đột phá bình cảnh Trúc Cơ.',
  },
  {
    id: 'cat_dan_duong_than',
    name: 'Dưỡng Thần Ngọc Lộ Đan',
    category: 'consumable',
    quality: 'epic',
    defaultQuantity: 2,
    description:
      'Tẩm bổ thần thức, hóa giải tâm ma nhiễu loạn và phục hồi nhanh tổn thương thức hải.',
  },
  {
    id: 'cat_dan_ket_kim',
    name: 'Thiên Nguyên Kết Kim Đan',
    category: 'consumable',
    quality: 'legendary',
    defaultQuantity: 1,
    description:
      'Kỳ đan Thiên phẩm tỏa đan hương nghìn trượng, trợ lực ngưng tụ kim đan tròn đầy không tì vết.',
  },
  {
    id: 'cat_dan_cuu_chuyen',
    name: 'Cửu Chuyển Hoàn Hồn Tiên Đan',
    category: 'consumable',
    quality: 'immortal',
    defaultQuantity: 1,
    description:
      'Tiên đan cửu chuyển mang đan vân ngũ sắc, cải tử hoàn sinh và tái tạo đạo cơ đã rạn nứt.',
  },

  // 2. Pháp bảo / Khí đạo (weapon)
  {
    id: 'cat_wp_thanh_cuong',
    name: 'Thanh Cương Linh Kiếm',
    category: 'weapon',
    quality: 'common',
    defaultQuantity: 1,
    description:
      'Linh kiếm sơ giai rèn từ thanh cương tinh luyện, dẫn truyền linh khí ổn định cho đệ tử ngoại môn.',
  },
  {
    id: 'cat_wp_co_dong_kinh',
    name: 'Cổ Đồng Kính (Pháp khí tàn tổn)',
    category: 'weapon',
    quality: 'uncommon',
    defaultQuantity: 1,
    description:
      'Pháp khí cổ xưa sứt mẻ góc viền nhưng vẫn ẩn chứa cấm chế phản quang, chờ cơ duyên tu bổ.',
  },
  {
    id: 'cat_wp_huyen_bang_kiem',
    name: 'Huyền Băng Phi Kiếm',
    category: 'weapon',
    quality: 'rare',
    defaultQuantity: 1,
    description:
      'Phi kiếm thượng phẩm ngưng sương hàn quanh mũi kiếm, ngự kiếm phi hành nhanh như điện xẹt.',
  },
  {
    id: 'cat_wp_ho_tam_giap',
    name: 'Huyền Quy Hộ Thân Giáp',
    category: 'weapon',
    quality: 'rare',
    defaultQuantity: 1,
    description:
      'Bảo giáp khắc linh văn quy giáp, tự động kích hoạt quang thuẫn giảm mạnh chấn lực pháp thuật.',
  },
  {
    id: 'cat_wp_thanh_lien_dinh',
    name: 'Thanh Liên Dược Đỉnh',
    category: 'weapon',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Đan lô cực phẩm chạm khắc cửu cánh thanh liên, tụ địa hỏa ổn định và nâng cao phẩm chất đan thành.',
  },
  {
    id: 'cat_wp_bang_tam_tram',
    name: 'Băng Tâm Ngọc Bội',
    category: 'weapon',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Ngọc bội hộ thần phát ra thanh lương đạo vận, chống huyễn thuật mê hoặc và trấn tĩnh đạo tâm.',
  },
  {
    id: 'cat_wp_dinh_hon_dang',
    name: 'Định Hồn Thanh Đăng',
    category: 'weapon',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'soul_vessel',
    description:
      'Hồn khí dưỡng thần thắp ánh thanh hỏa dịu nhẹ trong thức hải, giữ thần hồn vững vàng và ngăn tâm ma quấy nhiễu.',
  },
  {
    id: 'cat_wp_cuu_tieu_dao_an',
    name: 'Cửu Tiêu Nguyên Thần Ấn',
    category: 'weapon',
    quality: 'legendary',
    defaultQuantity: 1,
    equipSlot: 'soul_vessel',
    description:
      'Bản mệnh hồn ấn khắc đạo văn thượng cổ, khuếch đại thần thức tầm xa và gia tốc lĩnh ngộ công pháp.',
  },
  {
    id: 'cat_wp_phien_thien_an',
    name: 'Thái Ất Phiên Thiên Ấn',
    category: 'weapon',
    quality: 'legendary',
    defaultQuantity: 1,
    equipSlot: 'array_treasure',
    description:
      'Trấn tông pháp bảo Thiên phẩm, tế xuất hóa thành kim sơn áp đỉnh, phá tan trận pháp hộ sơn.',
  },
  {
    id: 'cat_wp_tru_tien_kiem',
    name: 'Thanh Bình Tiên Kiếm (Tàn phiến)',
    category: 'weapon',
    quality: 'immortal',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Tiên khí lưu quang ẩn chứa kiếm ý thái cổ, mỗi lần xuất vỏ khiến thiên địa linh khí rung chuyển.',
  },

  // 3. Thiên tài địa bảo / Linh thảo / Khoáng thạch (herb)
  {
    id: 'cat_herb_ngung_lo',
    name: 'Ngưng Lộ Linh Thảo (50 năm)',
    category: 'herb',
    quality: 'common',
    defaultQuantity: 3,
    description:
      'Linh thảo sơ cấp ngưng giọt sương linh mỗi bình minh, dùng làm dược dẫn cho nhiều đan phương.',
  },
  {
    id: 'cat_herb_tu_linh_chi',
    name: 'Bách Niên Tử Linh Chi',
    category: 'herb',
    quality: 'uncommon',
    defaultQuantity: 2,
    description:
      'Linh chi trăm năm ánh tím dịu, dồi dào linh khí mộc hệ, giúp bồi bổ khí huyết và điều hòa đan điền.',
  },
  {
    id: 'cat_herb_han_thiet',
    name: 'Thiên Hàn Huyền Thiết',
    category: 'herb',
    quality: 'rare',
    defaultQuantity: 2,
    description:
      'Khoáng thạch hàn tính khai thác dưới đáy hàn đàm, thượng phẩm luyện chế phi kiếm và bảo giáp.',
  },
  {
    id: 'cat_herb_bang_tam_lien',
    name: 'Thiên Niên Băng Tâm Liên',
    category: 'herb',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Linh liên nghìn năm nở trên đỉnh tuyết, thanh trừ hỏa độc trong kinh mạch và trợ ngộ băng đạo.',
  },
  {
    id: 'cat_herb_tam_re_co_thu',
    name: 'Tâm Rễ Linh Mộc Cổ Thụ',
    category: 'herb',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Phần tinh hoa lõi rễ của linh thụ nghìn năm, chất chứa sinh cơ mộc linh tinh thuần cực hiếm.',
  },
  {
    id: 'cat_herb_bach_ngoc_tuy',
    name: 'Vạn Niên Bạch Ngọc Tủy',
    category: 'herb',
    quality: 'legendary',
    defaultQuantity: 1,
    description:
      'Ngọc tủy kết tinh vạn năm giữa lòng đại linh mạch, phục dụng trực tiếp tăng mạnh tu vi và căn cốt.',
  },
  {
    id: 'cat_herb_hon_don_lien_tu',
    name: 'Hỗn Độn Thanh Liên Tử',
    category: 'herb',
    quality: 'immortal',
    defaultQuantity: 1,
    description:
      'Hạt sen tiên phẩm mang khí tức hồng mông sơ khai, một hạt đủ khiến phàm thể thoát thai hoán cốt.',
  },

  // 4. Phù lục / Trận bàn / Đan phương & Ngọc giản (talisman)
  {
    id: 'cat_tal_hoi_xuan',
    name: 'Hồi Xuân Phù',
    category: 'talisman',
    quality: 'common',
    defaultQuantity: 3,
    description:
      'Phù lục trị thương nhanh cho ngoại thương và giảm mệt mỏi sau khi vận công.',
  },
  {
    id: 'cat_tal_tho_don',
    name: 'Thổ Độn Phù',
    category: 'talisman',
    quality: 'uncommon',
    defaultQuantity: 2,
    description:
      'Xé bùa kích phát lập tức độn thổ thoát thân hàng trăm trượng trong tình thế hiểm nghèo.',
  },
  {
    id: 'cat_tal_kim_cang',
    name: 'Kim Cang Hộ Thể Phù',
    category: 'talisman',
    quality: 'rare',
    defaultQuantity: 2,
    description:
      'Hóa thành lồng sáng kim cang bao bọc toàn thân, đỡ trọn đòn công kích uy lực mạnh.',
  },
  {
    id: 'cat_tal_tu_linh_tran',
    name: 'Tứ Tượng Tụ Linh Trận Bàn',
    category: 'talisman',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Trận bàn kèm bốn lá trận kỳ, bày tại động phủ giúp kéo tụ thiên địa linh khí dày đặc gấp bội.',
  },
  {
    id: 'cat_tal_co_dan_phuong',
    name: 'Ngọc Giản Cổ Đan Phương',
    category: 'talisman',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Ngọc giản truyền thừa ghi chép đan phương thất truyền cùng khẩu quyết khống hỏa luyện đan.',
  },
  {
    id: 'cat_tal_kiem_y_gian',
    name: 'Thái Cổ Kiếm Ý Ngọc Giản',
    category: 'talisman',
    quality: 'legendary',
    defaultQuantity: 1,
    description:
      'Phong ấn một đạo kiếm ý Thiên phẩm của đại năng thượng cổ, tham ngộ giúp phá bình cảnh kiếm đạo.',
  },
  {
    id: 'cat_tal_tinh_dau_tran',
    name: 'Chu Thiên Tinh Đấu Tiên Trận Đồ',
    category: 'talisman',
    quality: 'immortal',
    defaultQuantity: 1,
    description:
      'Tiên trận đồ dẫn động tinh quang cửu thiên, công thủ toàn diện, tỏa lưu quang ngũ sắc.',
  },

  // 5. Linh thạch & Tài nguyên tu luyện (material)
  {
    id: 'cat_mat_linh_thach_vun',
    name: 'Linh Thạch Vụn',
    category: 'material',
    quality: 'common',
    defaultQuantity: 20,
    description:
      'Mảnh vỡ linh thạch còn sót linh khí mỏng, thường dùng thanh toán vặt ở phường thị.',
  },
  {
    id: 'cat_mat_ha_pham_lt',
    name: 'Hạ phẩm Linh thạch',
    category: 'material',
    quality: 'uncommon',
    defaultQuantity: 12,
    description:
      'Linh thạch thông dụng của tu chân giới, hấp thu trực tiếp để bổ sung linh lực và phụ trợ tu luyện.',
  },
  {
    id: 'cat_mat_trung_pham_lt',
    name: 'Trung phẩm Linh thạch',
    category: 'material',
    quality: 'rare',
    defaultQuantity: 5,
    description:
      'Tinh thể lam quang ẩn chứa linh khí thuần khiết gấp mười lần hạ phẩm, hỗ trợ luyện công rất tốt.',
  },
  {
    id: 'cat_mat_thuong_pham_lt',
    name: 'Thượng phẩm Linh thạch',
    category: 'material',
    quality: 'epic',
    defaultQuantity: 2,
    description:
      'Linh thạch cực hiếm ánh tím hồng rực rỡ, linh khí đậm đặc giúp phá bình cảnh công pháp nhanh chóng.',
  },
  {
    id: 'cat_mat_cuc_pham_lt',
    name: 'Cực phẩm Linh thạch',
    category: 'material',
    quality: 'legendary',
    defaultQuantity: 1,
    description:
      'Linh thạch Thiên phẩm tỏa kim quang chói lọi, chuyên dùng kích hoạt đại trận và xung kích đại cảnh giới.',
  },
  {
    id: 'cat_mat_tien_linh_dich',
    name: 'Cửu Thiên Tiên Linh Dịch',
    category: 'material',
    quality: 'immortal',
    defaultQuantity: 1,
    description:
      'Tinh hoa tiên linh dịch ngưng tụ từ tiên mạch, một giọt tỏa ngũ sắc lưu quang, tẩy rửa linh căn cực mạnh.',
  },
];

const JUNK_INVENTORY_EXACT_NAMES = new Set<string>([
  'gốc',
  'mốc gốc',
  'bản gốc',
  'gốc rễ',
  'nguồn gốc',
  'cội nguồn',
  'gốc cây',
  'gốc cổ thụ',
  'vật phẩm',
  'vật phẩm khác',
  'đồ vật',
  'thứ',
  'món',
  'món đồ',
  'tầng',
  'cảnh',
  'cảnh giới',
  'cấp',
  'bậc',
  'phẩm',
  'ngưỡng',
  'bình cảnh',
  'khí',
  'linh khí',
  'chân khí',
  'huyền khí',
  'tu vi',
  'tin tức',
  'manh mối',
  'câu trả lời',
  'ánh mắt',
  'nụ cười',
  'sự chú ý',
  'cảm giác',
  'hơi thở',
  'lời nói',
  'thời gian',
  'cơ hội',
  'kinh nghiệm',
  'bài học',
  'địa điểm',
  'vị trí',
  'kết quả',
  'nguyên nhân',
  'lý do',
  'bí mật',
  'câu chuyện',
  'dấu vết',
  'hình ảnh',
  'âm thanh',
  'mùi hương',
  'phong thanh',
  'lợi thế',
  'ưu thế',
  'niềm tin',
  'lòng tin',
  'sự tôn trọng',
  'danh tiếng',
  'thanh danh',
  'vẻ mặt',
  'biểu cảm',
  'tín hiệu',
  'nhận thức',
  'suy nghĩ',
  'ý định',
  'kế hoạch',
  'lời khuyên',
  'sự giúp đỡ',
  'cơn gió',
  'mặt đất',
  'bầu trời',
  'ánh sáng',
  'bóng tối',
  'mảnh',
  'viên',
  'khối',
  'nhánh',
  'cành',
  'đóa',
  'lá',
]);

/**
 * Returns true if a string is a junk/context noise word (e.g. "Gốc", "mốc gốc", "tầng", "cảnh")
 * that must never be stored in inventory or suggested as loot.
 */
export function isJunkInventoryItemName(rawName: string): boolean {
  const cleaned = (rawName || '')
    .replace(/^[.,;:!?\-–—'"“”‘’()[\]\s]+|[.,;:!?\-–—'"“”‘’()[\]\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 56) return true;
  const lower = cleaned.toLowerCase();
  if (JUNK_INVENTORY_EXACT_NAMES.has(lower)) return true;
  if (
    /^(?:mốc|bản|nguồn|cội|đoạn|phần|chút|ít|một|hai|ba|vài|cả|toàn)\s+gốc$/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (/^(?:tầng|cảnh|cấp|bậc|mốc|đoạn|lượt|ngày|tháng|năm|giờ)\s*\d*$/i.test(lower)) {
    return true;
  }
  if (/^\d+$/.test(lower)) return true;
  return false;
}

export function sanitizeInventoryItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => item && !isJunkInventoryItemName(item.name));
}

export const CULTIVATION_RANKING_BOARD_ORDER: readonly CultivationRankingBoard[] =
  ['thien', 'dia', 'nhan', 'thien_kieu'] as const;

export const CULTIVATION_RANKING_BOARD_META: Record<
  CultivationRankingBoard,
  {
    label: string;
    shortLabel: string;
    subtitle: string;
    badgeClass: string;
    accentTextClass: string;
  }
> = {
  thien: {
    label: 'Thiên Bảng',
    shortLabel: 'Thiên',
    subtitle:
      'Cường giả đứng đầu toàn giới / thượng giới, tầng cảnh giới tối cao hoặc chạm ngưỡng chí tôn.',
    badgeClass: 'bg-amber-500/18 text-amber-200 ring-amber-400/40',
    accentTextClass: 'text-amber-300',
  },
  dia: {
    label: 'Địa Bảng',
    shortLabel: 'Địa',
    subtitle:
      'Cao thủ đứng đầu đại vực, tông môn lớn, cổ tộc hoặc dải cảnh giới trung – thượng lưu chi phối cục diện.',
    badgeClass: 'bg-violet-500/18 text-violet-200 ring-violet-400/40',
    accentTextClass: 'text-violet-300',
  },
  nhan: {
    label: 'Nhân Bảng',
    shortLabel: 'Nhân',
    subtitle:
      'Cao thủ địa phương, thế hệ trưởng thành hoặc nhân vật nổi bật trực tiếp trong mạch truyện (có thể phân theo cảnh giới).',
    badgeClass: 'bg-sky-500/18 text-sky-200 ring-sky-400/40',
    accentTextClass: 'text-sky-300',
  },
  thien_kieu: {
    label: 'Bảng Thiên Kiêu',
    shortLabel: 'Thiên Kiêu',
    subtitle:
      'Nhân tài trẻ tuổi có thiên phú dị bẩm, thể chất/huyết mạch hiếm, ngộ tính cao hoặc khả năng vượt cấp khiêu chiến.',
    badgeClass: 'bg-emerald-500/18 text-emerald-200 ring-emerald-400/40',
    accentTextClass: 'text-emerald-300',
  },
};

export const PRODIGY_TIER_META: Record<
  ProdigyTier,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
  }
> = {
  nghich_thien: {
    label: 'Nghịch Thiên Thiên Kiêu',
    shortLabel: 'Nghịch Thiên',
    description:
      'Có thể vượt đại cảnh giới chiến đấu, mang thể chất/đồng tử/huyết mạch hiếm hoặc bước trên con đường phong thần/chứng đạo.',
    badgeClass: 'bg-rose-500/18 text-rose-200 ring-rose-400/40',
  },
  tre_the_gia: {
    label: 'Thiên Kiêu Trẻ / Hậu Duệ Thế Gia',
    shortLabel: 'Trẻ / Thế Gia',
    description:
      'Hạt giống sáng giá của tông môn, gia tộc hoặc thế lực đang lên, đột phá nhanh nhưng còn biến số trưởng thành.',
    badgeClass: 'bg-teal-500/18 text-teal-200 ring-teal-400/40',
  },
};

const VALID_RANKING_BOARDS = new Set<CultivationRankingBoard>([
  'thien',
  'dia',
  'nhan',
  'thien_kieu',
]);

const VALID_PRODIGY_TIERS = new Set<ProdigyTier>([
  'nghich_thien',
  'tre_the_gia',
]);

const NON_CULTIVATION_GENRES = new Set<WorldGenreId>([
  'slice_of_life',
  'showbiz',
  'urban',
  'apocalypse',
  'scifi',
  'fantasy',
]);

/**
 * Determines whether a world/character belongs to Tiên Hiệp, Huyền Huyễn, or Kiếm Hiệp.
 * Returns null for Modern / Slice of Life / Showbiz / Urban / Sci-Fi / Apocalypse / plain Fantasy
 * so those genres retain their lightweight UI untouched.
 */
export function detectCultivationSystemKind(input: {
  genre?: WorldGenreId;
  genreLabel?: string;
  worldName?: string;
  setting?: string;
  rules?: string;
  mcRole?: string;
  mcDesc?: string;
  openingScenario?: string;
  enableMartialSystem?: boolean;
}): CultivationSystemKind | null {
  if (input.genre === 'xianxia') return 'xianxia';
  if (input.genre === 'xuanhuan') return 'xuanhuan';
  if (input.enableMartialSystem) return 'wuxia';
  if (input.genre && NON_CULTIVATION_GENRES.has(input.genre)) {
    return null;
  }

  const combined = [
    input.genreLabel,
    input.worldName,
    input.setting,
    input.rules,
    input.mcRole,
    input.mcDesc,
    input.openingScenario,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!combined) return null;

  if (
    /\b(?:tiên hiệp|tien hiep|tu tiên|tu tien|tu chân|tu chan|luyện khí|trúc cơ|kim đan|nguyên anh|linh thạch|linh khí|tông môn|túi trữ vật)\b/i.test(
      combined,
    )
  ) {
    return 'xianxia';
  }
  if (
    /\b(?:huyền huyễn|huyen huyen|huyền khí|huyen khi|huyết mạch|huyet mach|chiến hồn|chien hon|hồn lực|dị thú thượng cổ|đấu khí|vũ hồn)\b/i.test(
      combined,
    )
  ) {
    return 'xuanhuan';
  }
  if (
    /\b(?:kiếm hiệp|kiem hiep|võ hiệp|vo hiep|võ lâm|vo lam|giang hồ|giang ho|nội công|noi cong|kiếm pháp|kiem phap|chân khí|chan khi|khinh công|khinh cong|tông sư|hậu thiên|tiên thiên|kiếm khách|du hiệp|minh chủ)\b/i.test(
      combined,
    )
  ) {
    return 'wuxia';
  }

  return null;
}

export function getMaxOverflowExp(maxExp: number): number {
  const safeMax = Math.max(10, Math.round(maxExp || 100));
  return Math.max(1, Math.round(safeMax * OVERFLOW_EXP_CAP_RATIO));
}

export function parseSubStageFromText(text: string): CultivationSubStage | null {
  const lower = (text || '').toLowerCase();
  if (!lower) return null;
  if (/(?:đỉnh\s*phong|dinh\s*phong|đại\s*viên\s*mãn|dai\s*vien\s*man|viên\s*mãn|vien\s*man|cực\s*đỉnh|tầng\s*10)/i.test(lower)) {
    return 'Đỉnh phong';
  }
  if (/(?:hậu\s*kỳ|hau\s*ky)/i.test(lower)) {
    return 'Hậu kỳ';
  }
  if (/(?:trung\s*kỳ|trung\s*ky)/i.test(lower)) {
    return 'Trung kỳ';
  }
  if (/(?:sơ\s*kỳ|so\s*ky)/i.test(lower)) {
    return 'Sơ kỳ';
  }
  return null;
}

function parseMinorTierFromText(text: string): number | null {
  const m = /(?:tầng|tang|trọng|trong)\s*(\d{1,2})\b/i.exec(text || '');
  if (m) {
    const num = parseInt(m[1], 10);
    if (Number.isFinite(num) && num >= 1 && num <= 12) return num;
  }
  const lower = (text || '').toLowerCase();
  const viWords: Array<[RegExp, number]> = [
    [/(?:tầng|trọng)\s*(?:một|nhất)\b/i, 1],
    [/(?:tầng|trọng)\s*(?:hai|nhị)\b/i, 2],
    [/(?:tầng|trọng)\s*(?:ba|tam)\b/i, 3],
    [/(?:tầng|trọng)\s*(?:bốn|tứ)\b/i, 4],
    [/(?:tầng|trọng)\s*(?:năm|ngũ)\b/i, 5],
    [/(?:tầng|trọng)\s*(?:sáu|lục)\b/i, 6],
    [/(?:tầng|trọng)\s*(?:bảy|thất)\b/i, 7],
    [/(?:tầng|trọng)\s*(?:tám|bát)\b/i, 8],
    [/(?:tầng|trọng)\s*(?:chín|cửu)\b/i, 9],
  ];
  for (const [re, val] of viWords) {
    if (re.test(lower)) return val;
  }
  return null;
}

function findCanonicalStageIndexByName(
  kind: CultivationSystemKind,
  rawName: string,
  explicitMajor?: string,
  explicitSubStage?: CultivationSubStage | null,
  explicitMinorTier?: number | null,
): number {
  const realms = CULTIVATION_SYSTEM_META[kind].realms;
  const normalizedName = (rawName || '').trim().toLowerCase();
  const normalizedMajor = (explicitMajor || '').trim().toLowerCase();

  // 1. Exact full stage name match (case-insensitive)
  if (normalizedName) {
    for (let i = 0; i < realms.length; i++) {
      if (realms[i].name.toLowerCase() === normalizedName) return i;
    }
    // Strip parenthetical sub-stage suffix like "Luyện Khí Tầng 4 (Trung kỳ)" -> "Luyện Khí Tầng 4"
    for (let i = 0; i < realms.length; i++) {
      const bare = realms[i].name.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim();
      if (bare === normalizedName) return i;
    }
  }

  // 2. Resolve Major Realm + explicit/parsed SubStage & MinorTier
  const detectedSubStage =
    explicitSubStage || parseSubStageFromText(normalizedName);
  const detectedTier =
    typeof explicitMinorTier === 'number' && Number.isFinite(explicitMinorTier)
      ? Math.trunc(explicitMinorTier)
      : parseMinorTierFromText(normalizedName);

  // Match major realm name (longest first to avoid partial collisions)
  const uniqueMajors = Array.from(
    new Set(realms.map((r) => r.majorRealm)),
  ).sort((a, b) => b.length - a.length);

  let matchedMajor: string | null = null;
  for (const major of uniqueMajors) {
    const mLower = major.toLowerCase();
    if (normalizedMajor && normalizedMajor === mLower) {
      matchedMajor = major;
      break;
    }
  }
  if (!matchedMajor) {
    const combinedTarget = `${normalizedMajor} ${normalizedName}`.trim();
    for (const major of uniqueMajors) {
      if (combinedTarget.includes(major.toLowerCase())) {
        matchedMajor = major;
        break;
      }
    }
  }

  if (matchedMajor) {
    // 2a. Match exact minorTier inside this majorRealm (e.g. Luyện Khí Tầng 1..9)
    if (detectedTier !== null) {
      if (detectedTier >= 10) {
        const peakIdx = realms.findIndex(
          (r) => r.majorRealm === matchedMajor && r.subStage === 'Đỉnh phong',
        );
        if (peakIdx >= 0) return peakIdx;
      }
      const tierIdx = realms.findIndex(
        (r) => r.majorRealm === matchedMajor && r.minorTier === detectedTier,
      );
      if (tierIdx >= 0) return tierIdx;
    }

    // 2b. Match majorRealm + subStage (picking the first stage of that subStage, e.g. Tầng 4 for Luyện Khí Trung kỳ)
    if (detectedSubStage) {
      const subIdx = realms.findIndex(
        (r) => r.majorRealm === matchedMajor && r.subStage === detectedSubStage,
      );
      if (subIdx >= 0) return subIdx;
    }

    // 2c. Bare majorRealm mention (e.g., "Hóa Thần Kỳ", "Trúc Cơ") -> ALWAYS default to earliest stage (Sơ kỳ / Tầng 1)
    const firstOfMajor = realms.findIndex((r) => r.majorRealm === matchedMajor);
    if (firstOfMajor >= 0) return firstOfMajor;
  }

  return -1;
}

function inferStartingRealmIndex(
  kind: CultivationSystemKind,
  hintText: string,
): number {
  const text = (hintText || '').toLowerCase();
  const realms = CULTIVATION_SYSTEM_META[kind].realms;

  // Pass 1: exact canonical stage match (e.g. "Trúc Cơ Trung kỳ", "Luyện Khí Tầng 5")
  for (let i = realms.length - 1; i >= 0; i--) {
    const rName = realms[i].name.toLowerCase();
    const bareName = rName.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (text.includes(rName) || (bareName.length >= 6 && text.includes(bareName))) {
      return i;
    }
  }

  // Pass 2: explicit major realm + subStage/tier mention; bare major realm ALWAYS starts at Sơ kỳ (earliest stage)
  const matchedByParts = findCanonicalStageIndexByName(kind, text);
  if (matchedByParts >= 0) {
    return matchedByParts;
  }

  if (/\b(?:đại năng|cường giả|trưởng lão|tông chủ|đại tông sư|tuyệt thế)\b/i.test(text)) {
    if (kind === 'xianxia') {
      // Kim Đan Sơ kỳ (never skip into higher/lumped peaks)
      const kimDanStart = realms.findIndex(
        (r) => r.majorRealm === 'Kim Đan' && r.subStage === 'Sơ kỳ',
      );
      return kimDanStart >= 0 ? kimDanStart : Math.min(realms.length - 4, 14);
    }
    return Math.min(realms.length - 3, Math.max(5, Math.floor(realms.length * 0.55)));
  }
  if (/\b(?:nội môn|cao thủ|thiên kiêu|hộ pháp|chân truyền)\b/i.test(text)) {
    if (kind === 'xianxia') {
      // Luyện Khí Tầng 4 (Trung kỳ)
      return Math.min(realms.length - 1, 3);
    }
    return Math.min(realms.length - 1, 3);
  }
  // Authentic starter stage (index 1: Luyện Khí Tầng 2 (Sơ kỳ) / Ngưng Huyền Nhất Trọng / Nhị Lưu Võ Giả)
  return 1;
}

export const MASTERY_LOCK_MILESTONES = [99] as const;

export const MASTERY_LOCK_CONDITION_META: Record<
  MasteryLockConditionKind,
  { label: string; shortLabel: string }
> = {
  combat: {
    label: 'Thực chiến / Giao thủ thực tế',
    shortLabel: 'Thực chiến',
  },
  realm: {
    label: 'Đạt cảnh giới / Tu vi tối thiểu',
    shortLabel: 'Cảnh giới',
  },
  insight: {
    label: 'Ngộ tính / Cảm ngộ & Bế quan dài hạn',
    shortLabel: 'Cảm ngộ',
  },
  resource: {
    label: 'Đan dược / Bí kíp / Cao thủ chỉ điểm',
    shortLabel: 'Tài nguyên / Chỉ điểm',
  },
  meridian: {
    label: 'Dẫn khí / Khai thông kinh mạch',
    shortLabel: 'Dẫn khí / Kinh mạch',
  },
};

export interface MasteryLockStatus {
  /** Whether mastery is currently halted at a lock/bottleneck milestone. */
  isLocked: boolean;
  /** Whether the technique/move has reached absolute maximum (maxLevel & 100%). */
  isMaxed: boolean;
  /** Active/next lock ceiling (50, 80, or 99), or 100 if fully unlocked/maxed. */
  nextLockCap: number;
  /** Current mastery stage label (e.g. 'Tiểu Thành · Thành thục biến chiêu'). */
  stageLabel: string;
  /** Short badge label for the current stage. */
  stageShortLabel: string;
  /** Full milestone label for the active/upcoming lock. */
  milestoneLabel: string;
  /** Compact milestone tag (e.g. 'Tiểu Thành', 'Đại Thành', 'Viên Mãn'). */
  milestoneShortLabel: string;
  /** Gameplay condition category. */
  conditionKind: MasteryLockConditionKind;
  /** Human-readable reason why progress is locked at this milestone. */
  reason: string;
  /** Concrete gameplay condition required to unlock/break the bottleneck. */
  unlockCondition: string;
  /** Optional minimum realmIndex required for this lock (mainly at 99% layer/level ascension). */
  requiredRealmIndex?: number;
  /** Display name of requiredRealmIndex if applicable. */
  requiredRealmName?: string;
  /** Whether the player's current realm meets requiredRealmIndex. */
  realmMet: boolean;
  /** Whether current story turn text shows narrative cues matching this condition. */
  sceneMatched: boolean;
  /** Matching inventory item (pill/manual/talisman) that can assist breaking this lock. */
  assistItem?: InventoryItem;
  /** Normalized milestones already unlocked at the current level. */
  effectiveUnlockedMilestones: number[];
  /** True if breaking this lock advances level + 1 (or completes 100% at maxLevel). */
  breaksIntoNextLevel: boolean;
}

export function getMoveMasteryStageLabel(
  mastery: number,
  level: number,
  maxLevel: number,
): { full: string; short: string } {
  if (level >= maxLevel && mastery >= 100) {
    return { full: 'Đăng Phong Tạo Cực', short: 'Tạo Cực' };
  }
  if (mastery >= 99) {
    return { full: 'Viên Mãn · Chạm ngưỡng thăng cấp', short: 'Viên Mãn' };
  }
  if (mastery >= 80) {
    return { full: 'Đại Thành · Thực chiến khắc chế', short: 'Đại Thành' };
  }
  if (mastery >= 50) {
    return { full: 'Tiểu Thành · Thành thục biến chiêu', short: 'Tiểu Thành' };
  }
  if (mastery >= 25) {
    return { full: 'Nhập Môn · Nắm khung chiêu', short: 'Nhập Môn' };
  }
  return { full: 'Sơ Khởi · Tập khung chiêu', short: 'Sơ Khởi' };
}

export function getTechniqueMasteryStageLabel(
  mastery: number,
  level: number,
  maxLevel: number,
): { full: string; short: string } {
  if (level >= maxLevel && mastery >= 100) {
    return { full: 'Công Pháp Đại Viên Mãn', short: 'Đại Viên Mãn' };
  }
  if (mastery >= 99) {
    return { full: 'Đỉnh Phong Tầng · Chờ phá bình cảnh', short: 'Đỉnh Phong' };
  }
  if (mastery >= 80) {
    return { full: 'Đại Thành Tầng', short: 'Đại Thành' };
  }
  if (mastery >= 50) {
    return { full: 'Tiểu Thành Tầng', short: 'Tiểu Thành' };
  }
  return { full: 'Sơ Nhập Tầng', short: 'Sơ Nhập' };
}

function resolveEffectiveUnlockedMilestones(
  mastery: number,
  unlockedMilestones: number[] | undefined,
): number[] {
  if (Array.isArray(unlockedMilestones)) {
    return Array.from(
      new Set(
        unlockedMilestones.filter(
          (m): m is number =>
            typeof m === 'number' &&
            (MASTERY_LOCK_MILESTONES as readonly number[]).includes(m),
        ),
      ),
    ).sort((a, b) => a - b);
  }
  // Backward compatibility for legacy saves without unlockedMilestones:
  // Treat thresholds strictly below current mastery as already cleared so existing progress never regresses,
  // while immediately enforcing the next upcoming lock (or locking now if sitting right on 50/80/99).
  return (MASTERY_LOCK_MILESTONES as readonly number[]).filter(
    (m) => m < mastery,
  );
}

function getNextLockCapFor(
  mastery: number,
  level: number,
  maxLevel: number,
  unlockedMilestones: number[] | undefined,
): {
  isMaxed: boolean;
  nextLockCap: number;
  effectiveUnlocked: number[];
} {
  if (level >= maxLevel && mastery >= 100) {
    return {
      isMaxed: true,
      nextLockCap: 100,
      effectiveUnlocked: [...MASTERY_LOCK_MILESTONES],
    };
  }
  const effectiveUnlocked = resolveEffectiveUnlockedMilestones(
    mastery,
    unlockedMilestones,
  );
  const nextMilestone = (MASTERY_LOCK_MILESTONES as readonly number[]).find(
    (m) => !effectiveUnlocked.includes(m),
  );
  return {
    isMaxed: false,
    nextLockCap: nextMilestone ?? 99,
    effectiveUnlocked,
  };
}

export function computeRequiredRealmIndexForTechnique(
  tech: CultivationTechnique,
  profile: CultivationProfile,
): number | undefined {
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  if (typeof tech.requiredRealmIndex === 'number' && Number.isFinite(tech.requiredRealmIndex)) {
    return Math.max(0, Math.min(realms.length - 1, Math.trunc(tech.requiredRealmIndex)));
  }
  const tierOffsetMap: Record<TechniqueTier, number> = {
    pham: 0,
    linh: 1,
    huyen: 2,
    dia: 4,
    thien: 6,
    chiton: 8,
  };
  const tierOffset = tierOffsetMap[tech.tier] ?? 0;
  const stepPerLevel = profile.systemKind === 'wuxia' ? 1 : 2;
  const raw = tierOffset + Math.max(0, tech.level - 1) * stepPerLevel - 1;
  if (raw <= 0) return undefined;
  return Math.min(realms.length - 1, raw);
}

export function computeRequiredRealmIndexForMove(
  move: TechniqueMove,
  parentTech: CultivationTechnique,
  profile: CultivationProfile,
): number | undefined {
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  if (typeof move.requiredRealmIndex === 'number' && Number.isFinite(move.requiredRealmIndex)) {
    return Math.max(0, Math.min(realms.length - 1, Math.trunc(move.requiredRealmIndex)));
  }
  // Early move levels (Cấp 1 -> 2, Cấp 2 -> 3) focus on combat/variation mastery rather than hard realm wall.
  // Higher move levels (Cấp 3+) require corresponding cultivation/martial foundation.
  if (move.level < 3) return undefined;
  const tierBonus =
    parentTech.tier === 'thien' || parentTech.tier === 'chiton'
      ? 2
      : parentTech.tier === 'dia' || parentTech.tier === 'huyen'
        ? 1
        : 0;
  const step = profile.systemKind === 'wuxia' ? 1 : 2;
  const raw = (move.level - 2) * step + tierBonus;
  return Math.min(realms.length - 1, Math.max(1, raw));
}

function detectSceneMatchForLock(
  kind: MasteryLockConditionKind,
  sceneText: string | undefined,
  entityName: string,
): boolean {
  const text = (sceneText || '').toLowerCase();
  if (!text) return false;
  const nameHit =
    entityName.trim().length >= 3 && text.includes(entityName.trim().toLowerCase());
  switch (kind) {
    case 'combat':
      return (
        /(?:giao thủ|thực chiến|tỷ thí|chiến đấu|đấu pháp|xuất chiêu|khắc chế|đối thủ|sát chiêu|quyết đấu|liều mạng|sinh tử)/i.test(
          text,
        ) ||
        (nameHit && /(?:đánh|chém|đâm|né|đỡ|phản kích|gạt|tung)/i.test(text))
      );
    case 'meridian':
      return /(?:dẫn khí|kinh mạch|chu thiên|đả tọa|điều tức|bế quan|vận công|khí hải|đan điền|thông mạch)/i.test(
        text,
      );
    case 'insight':
      return /(?:cảm ngộ|ngộ ra|ngộ đạo|đốn ngộ|tâm đắc|bế quan|biến cố|nghiền ngẫm|chỉ điểm|điểm hóa|khai ngộ)/i.test(
        text,
      );
    case 'resource':
      return /(?:đan dược|linh đan|ngộ đạo|bí kíp|ngọc giản|chỉ điểm|sư phụ|trưởng lão|cao thủ|truyền thụ|dược dịch)/i.test(
        text,
      );
    case 'realm':
      return /(?:đột phá|phá cảnh|phá bình cảnh|bế quan|độ kiếp|cảnh giới)/i.test(
        text,
      );
  }
}

function findAssistInventoryItem(
  profile: CultivationProfile,
  kind: MasteryLockConditionKind,
): InventoryItem | undefined {
  if (!profile.inventory || profile.inventory.length === 0) return undefined;
  const pattern =
    kind === 'meridian'
      ? /(?:tụ khí|hồi khí|thông mạch|tẩy tủy|đan|hoàn|linh thạch|linh dịch)/i
      : kind === 'insight' || kind === 'resource'
        ? /(?:ngộ đạo|bí kíp|ngọc giản|tâm pháp|kiếm phổ|đan|linh quả|trà|linh thạch)/i
        : /(?:ngộ đạo|bí kíp|ngọc giản|tụ khí|hồi khí|đan|linh thạch)/i;
  return profile.inventory.find(
    (item) =>
      item.quantity > 0 &&
      (item.category === 'consumable' ||
        item.category === 'talisman' ||
        item.category === 'material') &&
      pattern.test(`${item.name} ${item.description || ''}`),
  );
}

/**
 * Evaluates the current lock/bottleneck state of a parent technique (Công pháp).
 */
export function getTechniqueLockStatus(
  tech: CultivationTechnique,
  profile: CultivationProfile,
  options?: { sceneText?: string },
): MasteryLockStatus {
  const stage = getTechniqueMasteryStageLabel(
    tech.mastery,
    tech.level,
    tech.maxLevel,
  );
  const { isMaxed, nextLockCap, effectiveUnlocked } = getNextLockCapFor(
    tech.mastery,
    tech.level,
    tech.maxLevel,
    tech.unlockedMilestones,
  );
  const isLocked = !isMaxed && tech.mastery >= nextLockCap;
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  const nextLayerNum = Math.min(tech.maxLevel, tech.level + 1);
  const isLayerAscension = nextLockCap === 99;
  const requiredRealmIndex = isLayerAscension
    ? computeRequiredRealmIndexForTechnique(tech, profile)
    : undefined;
  const requiredRealmName =
    typeof requiredRealmIndex === 'number'
      ? realms[requiredRealmIndex]?.name
      : undefined;
  const realmMet =
    typeof requiredRealmIndex !== 'number' ||
    profile.realmIndex >= requiredRealmIndex;

  let conditionKind: MasteryLockConditionKind = tech.lockConditionKind || 'insight';
  let milestoneLabel = '';
  let milestoneShortLabel = '';
  let reason = '';
  let unlockCondition = '';

  if (isMaxed) {
    milestoneLabel = 'Đại Viên Mãn';
    milestoneShortLabel = 'Đại Viên Mãn';
    reason = 'Công pháp đã tu luyện tới tầng tối đa và đạt cảnh giới Đại Viên Mãn.';
    unlockCondition = 'Không còn bình cảnh.';
  } else {
    milestoneLabel =
      tech.level < tech.maxLevel
        ? `Bình cảnh thăng Tầng ${nextLayerNum}`
        : `Bình cảnh Đại Viên Mãn`;
    milestoneShortLabel = 'Bình cảnh';
    conditionKind =
      tech.lockConditionKind ||
      (typeof requiredRealmIndex === 'number'
        ? 'realm'
        : tech.category === 'mental'
          ? 'meridian'
          : tech.category === 'martial' || tech.category === 'movement'
            ? 'combat'
            : 'insight');
    reason =
      tech.level < tech.maxLevel
        ? `"${tech.name}" đã chạm ngưỡng đỉnh Tầng ${tech.level} (${tech.mastery}%), chưa thể tự đột phá lên Tầng ${nextLayerNum}.`
        : `"${tech.name}" đã chạm ngưỡng tầng cuối, cần một lần đại ngộ hoặc cơ duyên để đạt Đại Viên Mãn.`;
    const realmClause = requiredRealmName
      ? `Đạt tối thiểu cảnh giới ${requiredRealmName}; `
      : '';
    unlockCondition = `${realmClause}diễn biến cốt truyện (thực chiến / cảm ngộ / bế quan / chỉ điểm cao thủ) hoặc dùng Linh thạch, đan dược trợ lực phá bình cảnh.`;
  }

  if (tech.customLockReason?.trim()) {
    reason = tech.customLockReason.trim();
  }
  if (tech.customUnlockCondition?.trim()) {
    unlockCondition = tech.customUnlockCondition.trim();
  }

  const sceneMatched = detectSceneMatchForLock(
    conditionKind,
    options?.sceneText,
    tech.name,
  );
  const assistItem = isLocked ? findAssistInventoryItem(profile, conditionKind) : undefined;

  return {
    isLocked,
    isMaxed,
    nextLockCap,
    stageLabel: stage.full,
    stageShortLabel: stage.short,
    milestoneLabel,
    milestoneShortLabel,
    conditionKind,
    reason,
    unlockCondition,
    ...(typeof requiredRealmIndex === 'number' ? { requiredRealmIndex } : {}),
    ...(requiredRealmName ? { requiredRealmName } : {}),
    realmMet,
    sceneMatched,
    ...(assistItem ? { assistItem } : {}),
    effectiveUnlockedMilestones: effectiveUnlocked,
    breaksIntoNextLevel: isLayerAscension,
  };
}

/**
 * Evaluates the current lock/bottleneck state of an individual Move (Chiêu thức),
 * strictly decoupled from its parent technique's layer progress.
 */
export function getMoveLockStatus(
  move: TechniqueMove,
  parentTech: CultivationTechnique,
  profile: CultivationProfile,
  options?: { sceneText?: string },
): MasteryLockStatus {
  const stage = getMoveMasteryStageLabel(
    move.mastery,
    move.level,
    move.maxLevel,
  );
  const { isMaxed, nextLockCap, effectiveUnlocked } = getNextLockCapFor(
    move.mastery,
    move.level,
    move.maxLevel,
    move.unlockedMilestones,
  );
  const isLocked = !isMaxed && move.mastery >= nextLockCap;
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  const nextLvNum = Math.min(move.maxLevel, move.level + 1);
  const isLevelAscension = nextLockCap === 99;
  const requiredRealmIndex = isLevelAscension
    ? computeRequiredRealmIndexForMove(move, parentTech, profile)
    : undefined;
  const requiredRealmName =
    typeof requiredRealmIndex === 'number'
      ? realms[requiredRealmIndex]?.name
      : undefined;
  const realmMet =
    typeof requiredRealmIndex !== 'number' ||
    profile.realmIndex >= requiredRealmIndex;

  let conditionKind: MasteryLockConditionKind = move.lockConditionKind || 'combat';
  let milestoneLabel = '';
  let milestoneShortLabel = '';
  let reason = '';
  let unlockCondition = '';

  if (isMaxed) {
    milestoneLabel = 'Đăng Phong Tạo Cực';
    milestoneShortLabel = 'Tạo Cực';
    reason = `Chiêu thức "${move.name}" đã đạt cảnh giới tối đa.`;
    unlockCondition = 'Không còn bình cảnh.';
  } else {
    milestoneLabel =
      move.level < move.maxLevel
        ? `Bình cảnh thăng Cấp ${nextLvNum}`
        : `Bình cảnh Tạo Cực`;
    milestoneShortLabel = 'Bình cảnh';
    conditionKind =
      move.lockConditionKind ||
      (parentTech.category === 'mental' ? 'insight' : 'combat');
    reason =
      move.level < move.maxLevel
        ? `Chiêu thức "${move.name}" đã chạm ngưỡng Viên Mãn Cấp ${move.level} (${move.mastery}%), chưa thể tự đột phá lên Cấp ${nextLvNum}.`
        : `Chiêu thức "${move.name}" chạm đỉnh cấp cuối, cần thực chiến khắc chế hoặc đại ngộ trong cốt truyện để đạt Tạo Cực.`;
    const realmClause = requiredRealmName
      ? `Đạt cảnh giới tối thiểu ${requiredRealmName}; `
      : '';
    unlockCondition =
      parentTech.category === 'mental'
        ? `${realmClause}cảm ngộ qua cốt truyện (đả tọa / bế quan / khai thông kinh mạch) hoặc dùng Linh thạch, đan dược trợ lực.`
        : `${realmClause}thực chiến giao thủ bằng "${move.name}", cảm ngộ biến chiêu qua cốt truyện hoặc dùng Linh thạch / cao thủ chỉ điểm.`;
  }

  if (move.customLockReason?.trim()) {
    reason = move.customLockReason.trim();
  }
  if (move.customUnlockCondition?.trim()) {
    unlockCondition = move.customUnlockCondition.trim();
  }

  const sceneMatched = detectSceneMatchForLock(
    conditionKind,
    options?.sceneText,
    move.name,
  );
  const assistItem = isLocked ? findAssistInventoryItem(profile, conditionKind) : undefined;

  return {
    isLocked,
    isMaxed,
    nextLockCap,
    stageLabel: stage.full,
    stageShortLabel: stage.short,
    milestoneLabel,
    milestoneShortLabel,
    conditionKind,
    reason,
    unlockCondition,
    ...(typeof requiredRealmIndex === 'number' ? { requiredRealmIndex } : {}),
    ...(requiredRealmName ? { requiredRealmName } : {}),
    realmMet,
    sceneMatched,
    ...(assistItem ? { assistItem } : {}),
    effectiveUnlockedMilestones: effectiveUnlocked,
    breaksIntoNextLevel: isLevelAscension,
  };
}

/**
 * Strictly applies a mastery delta to a parent technique without ever bypassing
 * its active lock/bottleneck ceiling or touching child moves.
 */
export function applyTechniqueMasteryDelta(
  tech: CultivationTechnique,
  delta: number,
  profile: CultivationProfile,
  options?: { sceneText?: string },
): {
  nextTech: CultivationTechnique;
  appliedDelta: number;
  blockedByLock: boolean;
  hitNewLock: boolean;
  lockStatus: MasteryLockStatus;
} {
  const beforeStatus = getTechniqueLockStatus(tech, profile, options);
  if (delta <= 0 || beforeStatus.isMaxed || beforeStatus.isLocked) {
    return {
      nextTech: tech,
      appliedDelta: 0,
      blockedByLock: beforeStatus.isLocked,
      hitNewLock: false,
      lockStatus: beforeStatus,
    };
  }

  const cap = beforeStatus.nextLockCap;
  const targetMastery = Math.min(cap, Math.max(0, tech.mastery + Math.round(delta)));
  const appliedDelta = Math.max(0, targetMastery - tech.mastery);
  const nextTech: CultivationTechnique = {
    ...tech,
    mastery: targetMastery,
    unlockedMilestones: beforeStatus.effectiveUnlockedMilestones,
  };
  const afterStatus = getTechniqueLockStatus(nextTech, profile, options);

  return {
    nextTech,
    appliedDelta,
    blockedByLock: false,
    hitNewLock: !beforeStatus.isLocked && afterStatus.isLocked,
    lockStatus: afterStatus,
  };
}

/**
 * Strictly applies a mastery delta to an individual move without ever bypassing
 * its active lock/bottleneck ceiling or coupling to parent technique progress.
 */
export function applyMoveMasteryDelta(
  move: TechniqueMove,
  parentTech: CultivationTechnique,
  delta: number,
  profile: CultivationProfile,
  options?: { sceneText?: string },
): {
  nextMove: TechniqueMove;
  appliedDelta: number;
  blockedByLock: boolean;
  hitNewLock: boolean;
  lockStatus: MasteryLockStatus;
} {
  const beforeStatus = getMoveLockStatus(move, parentTech, profile, options);
  if (delta <= 0 || beforeStatus.isMaxed || beforeStatus.isLocked) {
    return {
      nextMove: move,
      appliedDelta: 0,
      blockedByLock: beforeStatus.isLocked,
      hitNewLock: false,
      lockStatus: beforeStatus,
    };
  }

  const cap = beforeStatus.nextLockCap;
  const targetMastery = Math.min(cap, Math.max(0, move.mastery + Math.round(delta)));
  const appliedDelta = Math.max(0, targetMastery - move.mastery);
  const nextMove: TechniqueMove = {
    ...move,
    mastery: targetMastery,
    unlockedMilestones: beforeStatus.effectiveUnlockedMilestones,
  };
  const afterStatus = getMoveLockStatus(nextMove, parentTech, profile, options);

  return {
    nextMove,
    appliedDelta,
    blockedByLock: false,
    hitNewLock: !beforeStatus.isLocked && afterStatus.isLocked,
    lockStatus: afterStatus,
  };
}

/**
 * Explicitly unlocks a parent technique's active bottleneck milestone (or advances +1 layer at 99%).
 * Strictly enforces requiredRealmIndex when applicable, and optionally consumes an assisting item.
 */
export function unlockTechniqueBottleneck(
  tech: CultivationTechnique,
  profile: CultivationProfile,
  options?: { consumeItemId?: string },
): {
  ok: boolean;
  error?: string;
  nextTech: CultivationTechnique;
  nextInventory: InventoryItem[];
  leveledUp: boolean;
  completedMax: boolean;
  consumedItemName?: string;
  summary: string;
} {
  const status = getTechniqueLockStatus(tech, profile);
  if (!status.isLocked) {
    return {
      ok: false,
      error: `"${tech.name}" hiện chưa chạm mốc khóa bình cảnh (mốc kế tiếp: ${status.nextLockCap}%).`,
      nextTech: tech,
      nextInventory: profile.inventory,
      leveledUp: false,
      completedMax: false,
      summary: '',
    };
  }
  if (!status.realmMet) {
    return {
      ok: false,
      error: `Chưa đủ cảnh giới tối thiểu (${status.requiredRealmName || 'cao hơn'}) để phá bình cảnh "${tech.name}".`,
      nextTech: tech,
      nextInventory: profile.inventory,
      leveledUp: false,
      completedMax: false,
      summary: '',
    };
  }

  let nextInventory = profile.inventory;
  let consumedItemName: string | undefined;
  if (options?.consumeItemId) {
    const found = profile.inventory.find(
      (item) => item.id === options.consumeItemId && item.quantity > 0,
    );
    if (found) {
      consumedItemName = found.name;
      nextInventory = profile.inventory
        .map((item) =>
          item.id === found.id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0);
    }
  }

  const assistTag = consumedItemName ? ` (nhờ dùng ${consumedItemName})` : '';

  if (status.nextLockCap === 99) {
    if (tech.level < tech.maxLevel) {
      const nextLevel = tech.level + 1;
      const nextTech: CultivationTechnique = {
        ...tech,
        level: nextLevel,
        mastery: 0,
        unlockedMilestones: [],
      };
      return {
        ok: true,
        nextTech,
        nextInventory,
        leveledUp: true,
        completedMax: false,
        consumedItemName,
        summary: `Phá bình cảnh thành công${assistTag}: "${tech.name}" thăng lên Tầng ${nextLevel}!`,
      };
    }
    const nextTech: CultivationTechnique = {
      ...tech,
      mastery: 100,
      unlockedMilestones: [...MASTERY_LOCK_MILESTONES],
    };
    return {
      ok: true,
      nextTech,
      nextInventory,
      leveledUp: false,
      completedMax: true,
      consumedItemName,
      summary: `Đại ngộ thành công${assistTag}: "${tech.name}" đạt Đại Viên Mãn!`,
    };
  }

  const nextUnlocked = Array.from(
    new Set([...status.effectiveUnlockedMilestones, status.nextLockCap]),
  ).sort((a, b) => a - b);
  const nextTech: CultivationTechnique = {
    ...tech,
    mastery: Math.min(99, Math.max(tech.mastery, status.nextLockCap) + 1),
    unlockedMilestones: nextUnlocked,
  };
  return {
    ok: true,
    nextTech,
    nextInventory,
    leveledUp: false,
    completedMax: false,
    consumedItemName,
    summary: `Đã phá khóa ${status.nextLockCap}% của "${tech.name}"${assistTag} — có thể tiếp tục tu luyện Tầng ${tech.level}.`,
  };
}

/**
 * Explicitly unlocks an individual move's active bottleneck milestone (or advances +1 level at 99%).
 */
export function unlockMoveBottleneck(
  move: TechniqueMove,
  parentTech: CultivationTechnique,
  profile: CultivationProfile,
  options?: { consumeItemId?: string },
): {
  ok: boolean;
  error?: string;
  nextMove: TechniqueMove;
  nextInventory: InventoryItem[];
  leveledUp: boolean;
  completedMax: boolean;
  consumedItemName?: string;
  summary: string;
} {
  const status = getMoveLockStatus(move, parentTech, profile);
  if (!status.isLocked) {
    return {
      ok: false,
      error: `Chiêu "${move.name}" hiện chưa chạm mốc khóa (mốc kế tiếp: ${status.nextLockCap}%).`,
      nextMove: move,
      nextInventory: profile.inventory,
      leveledUp: false,
      completedMax: false,
      summary: '',
    };
  }
  if (!status.realmMet) {
    return {
      ok: false,
      error: `Chưa đủ cảnh giới tối thiểu (${status.requiredRealmName || 'cao hơn'}) để phá bình cảnh chiêu "${move.name}".`,
      nextMove: move,
      nextInventory: profile.inventory,
      leveledUp: false,
      completedMax: false,
      summary: '',
    };
  }

  let nextInventory = profile.inventory;
  let consumedItemName: string | undefined;
  if (options?.consumeItemId) {
    const found = profile.inventory.find(
      (item) => item.id === options.consumeItemId && item.quantity > 0,
    );
    if (found) {
      consumedItemName = found.name;
      nextInventory = profile.inventory
        .map((item) =>
          item.id === found.id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0);
    }
  }

  const assistTag = consumedItemName ? ` (nhờ dùng ${consumedItemName})` : '';

  if (status.nextLockCap === 99) {
    if (move.level < move.maxLevel) {
      const nextLevel = move.level + 1;
      const nextMove: TechniqueMove = {
        ...move,
        level: nextLevel,
        mastery: 0,
        unlockedMilestones: [],
      };
      return {
        ok: true,
        nextMove,
        nextInventory,
        leveledUp: true,
        completedMax: false,
        consumedItemName,
        summary: `Phá bình cảnh chiêu thức thành công${assistTag}: "${move.name}" thăng lên Cấp ${nextLevel}!`,
      };
    }
    const nextMove: TechniqueMove = {
      ...move,
      mastery: 100,
      unlockedMilestones: [...MASTERY_LOCK_MILESTONES],
    };
    return {
      ok: true,
      nextMove,
      nextInventory,
      leveledUp: false,
      completedMax: true,
      consumedItemName,
      summary: `Chiêu thức "${move.name}" đã đạt Đăng Phong Tạo Cực${assistTag}!`,
    };
  }

  const nextUnlocked = Array.from(
    new Set([...status.effectiveUnlockedMilestones, status.nextLockCap]),
  ).sort((a, b) => a - b);
  const nextMove: TechniqueMove = {
    ...move,
    mastery: Math.min(99, Math.max(move.mastery, status.nextLockCap) + 1),
    unlockedMilestones: nextUnlocked,
  };
  return {
    ok: true,
    nextMove,
    nextInventory,
    leveledUp: false,
    completedMax: false,
    consumedItemName,
    summary: `Đã mở khóa ${status.nextLockCap}% cho chiêu "${move.name}"${assistTag} — tiến vào giai đoạn mới!`,
  };
}

const SPIRIT_STONE_QUALITY_ORDER: InventoryItemQuality[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'immortal',
];

/**
 * Finds the most appropriate spirit stone (Linh thạch / Huyền tinh / Tiên linh dịch) in the player's bag,
 * prioritizing lower-grade stones first (e.g. Hạ phẩm Linh thạch) so rare stones aren't burned first.
 */
export function findSpiritStoneInInventory(
  profile: CultivationProfile,
): InventoryItem | undefined {
  if (!profile.inventory || profile.inventory.length === 0) return undefined;
  const candidates = profile.inventory.filter(
    (item) =>
      item.quantity > 0 &&
      /(?:linh\s*thạch|huyền\s*tinh|nguyên\s*thạch|tinh\s*thạch|tiên\s*linh\s*dịch)/i.test(
        item.name,
      ),
  );
  if (candidates.length === 0) return undefined;
  return candidates.sort((a, b) => {
    const aIdx = SPIRIT_STONE_QUALITY_ORDER.indexOf(a.quality);
    const bIdx = SPIRIT_STONE_QUALITY_ORDER.indexOf(b.quality);
    return (aIdx === -1 ? 9 : aIdx) - (bIdx === -1 ? 9 : bIdx);
  })[0];
}

export function getSpiritStoneMasteryBoost(item: InventoryItem): number {
  const lower = item.name.toLowerCase();
  if (/tiên\s*linh\s*dịch|tiên\s*phẩm|tiên\s*thạch/i.test(lower)) return 30;
  if (/cực\s*phẩm|thiên\s*phẩm/i.test(lower)) return 22;
  if (/thượng\s*phẩm/i.test(lower)) return 16;
  if (/trung\s*phẩm/i.test(lower)) return 12;
  if (/hạ\s*phẩm/i.test(lower)) return 8;
  switch (item.quality) {
    case 'immortal':
      return 30;
    case 'legendary':
      return 22;
    case 'epic':
      return 16;
    case 'rare':
      return 12;
    case 'uncommon':
      return 8;
    default:
      return 6;
  }
}

/**
 * Consumes 1 Spirit Stone to assist training a technique (or break its 99% bottleneck if realm allows).
 */
export function trainTechniqueWithSpiritStone(
  tech: CultivationTechnique,
  profile: CultivationProfile,
  itemId?: string,
): {
  ok: boolean;
  error?: string;
  nextTech: CultivationTechnique;
  nextInventory: InventoryItem[];
  stoneName: string;
  remainingQty: number;
  appliedDelta: number;
  hitBottleneck: boolean;
  leveledUp: boolean;
  summary: string;
} {
  const stone = itemId
    ? profile.inventory.find((i) => i.id === itemId && i.quantity > 0)
    : findSpiritStoneInInventory(profile);
  if (!stone) {
    return {
      ok: false,
      error: 'Trong túi không còn Linh thạch để phụ trợ tu luyện.',
      nextTech: tech,
      nextInventory: profile.inventory,
      stoneName: '',
      remainingQty: 0,
      appliedDelta: 0,
      hitBottleneck: false,
      leveledUp: false,
      summary: '',
    };
  }

  const status = getTechniqueLockStatus(tech, profile);
  if (status.isMaxed) {
    return {
      ok: false,
      error: `"${tech.name}" đã đạt Đại Viên Mãn, không cần tiêu hao thêm ${stone.name}.`,
      nextTech: tech,
      nextInventory: profile.inventory,
      stoneName: stone.name,
      remainingQty: stone.quantity,
      appliedDelta: 0,
      hitBottleneck: false,
      leveledUp: false,
      summary: '',
    };
  }

  // If currently sitting at the 99% bottleneck, use the spirit stone to break through!
  if (status.isLocked) {
    const unlockRes = unlockTechniqueBottleneck(tech, profile, {
      consumeItemId: stone.id,
    });
    if (!unlockRes.ok) {
      return {
        ok: false,
        error: unlockRes.error,
        nextTech: tech,
        nextInventory: profile.inventory,
        stoneName: stone.name,
        remainingQty: stone.quantity,
        appliedDelta: 0,
        hitBottleneck: true,
        leveledUp: false,
        summary: '',
      };
    }
    const remainingQty =
      unlockRes.nextInventory.find((i) => i.id === stone.id)?.quantity ?? 0;
    return {
      ok: true,
      nextTech: unlockRes.nextTech,
      nextInventory: unlockRes.nextInventory,
      stoneName: stone.name,
      remainingQty,
      appliedDelta: 0,
      hitBottleneck: false,
      leveledUp: unlockRes.leveledUp,
      summary: `${unlockRes.summary} (còn ${remainingQty} ${stone.name})`,
    };
  }

  const boost = getSpiritStoneMasteryBoost(stone);
  const res = applyTechniqueMasteryDelta(tech, boost, profile);
  const nextInventory = profile.inventory
    .map((item) =>
      item.id === stone.id ? { ...item, quantity: item.quantity - 1 } : item,
    )
    .filter((item) => item.quantity > 0);
  const remainingQty =
    nextInventory.find((i) => i.id === stone.id)?.quantity ?? 0;

  return {
    ok: true,
    nextTech: res.nextTech,
    nextInventory,
    stoneName: stone.name,
    remainingQty,
    appliedDelta: res.appliedDelta,
    hitBottleneck: res.hitNewLock,
    leveledUp: false,
    summary: res.hitNewLock
      ? `Dùng 1 ${stone.name} (còn ${remainingQty}): "${tech.name}" +${res.appliedDelta}% — đã chạm bình cảnh 99%!`
      : `Dùng 1 ${stone.name} (còn ${remainingQty}): "${tech.name}" tinh tiến +${res.appliedDelta}% (hiện ${res.nextTech.mastery}%).`,
  };
}

/**
 * Consumes 1 Spirit Stone to assist training an individual move (or break its 99% bottleneck if realm allows).
 */
export function trainMoveWithSpiritStone(
  move: TechniqueMove,
  parentTech: CultivationTechnique,
  profile: CultivationProfile,
  itemId?: string,
): {
  ok: boolean;
  error?: string;
  nextMove: TechniqueMove;
  nextInventory: InventoryItem[];
  stoneName: string;
  remainingQty: number;
  appliedDelta: number;
  hitBottleneck: boolean;
  leveledUp: boolean;
  summary: string;
} {
  const stone = itemId
    ? profile.inventory.find((i) => i.id === itemId && i.quantity > 0)
    : findSpiritStoneInInventory(profile);
  if (!stone) {
    return {
      ok: false,
      error: 'Trong túi không còn Linh thạch để phụ trợ luyện chiêu.',
      nextMove: move,
      nextInventory: profile.inventory,
      stoneName: '',
      remainingQty: 0,
      appliedDelta: 0,
      hitBottleneck: false,
      leveledUp: false,
      summary: '',
    };
  }

  const status = getMoveLockStatus(move, parentTech, profile);
  if (status.isMaxed) {
    return {
      ok: false,
      error: `Chiêu "${move.name}" đã đạt Đăng Phong Tạo Cực.`,
      nextMove: move,
      nextInventory: profile.inventory,
      stoneName: stone.name,
      remainingQty: stone.quantity,
      appliedDelta: 0,
      hitBottleneck: false,
      leveledUp: false,
      summary: '',
    };
  }

  if (status.isLocked) {
    const unlockRes = unlockMoveBottleneck(move, parentTech, profile, {
      consumeItemId: stone.id,
    });
    if (!unlockRes.ok) {
      return {
        ok: false,
        error: unlockRes.error,
        nextMove: move,
        nextInventory: profile.inventory,
        stoneName: stone.name,
        remainingQty: stone.quantity,
        appliedDelta: 0,
        hitBottleneck: true,
        leveledUp: false,
        summary: '',
      };
    }
    const remainingQty =
      unlockRes.nextInventory.find((i) => i.id === stone.id)?.quantity ?? 0;
    return {
      ok: true,
      nextMove: unlockRes.nextMove,
      nextInventory: unlockRes.nextInventory,
      stoneName: stone.name,
      remainingQty,
      appliedDelta: 0,
      hitBottleneck: false,
      leveledUp: unlockRes.leveledUp,
      summary: `${unlockRes.summary} (còn ${remainingQty} ${stone.name})`,
    };
  }

  const boost = getSpiritStoneMasteryBoost(stone) + 2;
  const res = applyMoveMasteryDelta(move, parentTech, boost, profile);
  const nextInventory = profile.inventory
    .map((item) =>
      item.id === stone.id ? { ...item, quantity: item.quantity - 1 } : item,
    )
    .filter((item) => item.quantity > 0);
  const remainingQty =
    nextInventory.find((i) => i.id === stone.id)?.quantity ?? 0;

  return {
    ok: true,
    nextMove: res.nextMove,
    nextInventory,
    stoneName: stone.name,
    remainingQty,
    appliedDelta: res.appliedDelta,
    hitBottleneck: res.hitNewLock,
    leveledUp: false,
    summary: res.hitNewLock
      ? `Dùng 1 ${stone.name} (còn ${remainingQty}): chiêu "${move.name}" +${res.appliedDelta}% — đã chạm bình cảnh 99%!`
      : `Dùng 1 ${stone.name} (còn ${remainingQty}): chiêu "${move.name}" tinh tiến +${res.appliedDelta}% (hiện ${res.nextMove.mastery}%).`,
  };
}

/**
 * Builds a natural, story-ready training action prompt for a Technique (Công pháp)
 * to prefill in the chat composer without auto-sending.
 */
export function buildTechniqueTrainStoryPrompt(
  tech: CultivationTechnique,
  status: MasteryLockStatus,
  options?: { spiritStoneName?: string },
): string {
  const stoneClause = options?.spiritStoneName
    ? `, đồng thời nắm lấy 1 khối ${options.spiritStoneName} để hấp thu linh khí phụ trợ`
    : '';

  if (status.isLocked) {
    const nextLayer = Math.min(tech.maxLevel, tech.level + 1);
    const goal =
      tech.level < tech.maxLevel
        ? `xung kích bình cảnh "${tech.name}" từ Tầng ${tech.level} lên Tầng ${nextLayer}`
        : `cảm ngộ bình cảnh Đại Viên Mãn của "${tech.name}"`;
    return `Ta tập trung tâm thần để ${goal}${stoneClause}. Hiện tại công pháp đang vướng bình cảnh (${status.unlockCondition}). Hãy diễn tả quá trình vận công, cảm ngộ hoặc cơ duyên thực tế xem ta có phá được bình cảnh này không.`;
  }

  const nextLayer = Math.min(tech.maxLevel, tech.level + 1);
  if (tech.category === 'mental') {
    return `Ta ngồi xếp bằng tĩnh tâm đả tọa, chuyên chú vận chuyển "${tech.name}" (Tầng ${tech.level} · ${status.stageShortLabel}, ${tech.mastery}%)${stoneClause}, dẫn khí tuần hoàn kinh mạch nhằm củng cố căn cơ và tiến gần hơn tới ngưỡng Tầng ${nextLayer}.`;
  }
  if (tech.category === 'movement') {
    return `Ta tìm khoảng địa hình phù hợp để tập trung diễn luyện "${tech.name}" (Tầng ${tech.level} · ${status.stageShortLabel}, ${tech.mastery}%)${stoneClause}, rèn tốc độ chuyển thân, bước né và độ linh hoạt khi ứng biến.`;
  }
  if (tech.category === 'secret') {
    return `Ta tĩnh tâm nghiền ngẫm yếu quyết của bí thuật "${tech.name}" (Tầng ${tech.level} · ${status.stageShortLabel}, ${tech.mastery}%)${stoneClause}, điều hòa khí tức và thử vận hành từng nhịp nhằm nâng độ thuần thục.`;
  }
  return `Ta dành thời gian tập trung diễn luyện "${tech.name}" (Tầng ${tech.level} · ${status.stageShortLabel}, ${tech.mastery}%)${stoneClause}, chuốt lại nhịp phát kình, đường chiêu và sự nhuần nhuyễn hướng tới Tầng ${nextLayer}.`;
}

/**
 * Builds a natural, story-ready training action prompt for an individual Move (Chiêu thức)
 * to prefill in the chat composer without auto-sending.
 */
export function buildMoveTrainStoryPrompt(
  move: TechniqueMove,
  parentTech: CultivationTechnique,
  status: MasteryLockStatus,
  options?: { spiritStoneName?: string },
): string {
  const stoneClause = options?.spiritStoneName
    ? ` kết hợp hấp thu 1 khối ${options.spiritStoneName} trợ lực`
    : '';

  if (status.isLocked) {
    const nextLv = Math.min(move.maxLevel, move.level + 1);
    const goal =
      move.level < move.maxLevel
        ? `phá bình cảnh chiêu thức "${move.name}" (thuộc ${parentTech.name}) từ Cấp ${move.level} lên Cấp ${nextLv}`
        : `đưa chiêu thức "${move.name}" (thuộc ${parentTech.name}) chạm ngưỡng Đăng Phong Tạo Cực`;
    return `Ta tập trung rèn giũa để ${goal}${stoneClause}. Hiện chiêu thức đang chạm bình cảnh (${status.unlockCondition}). Hãy triển khai tình huống thực chiến, luyện chiêu dưới áp lực hoặc khoảnh khắc cảm ngộ để kiểm chứng sự đột phá.`;
  }

  const goalHint =
    move.mastery < 50
      ? 'nắm chắc khung chiêu và nhịp ra đòn'
      : move.mastery < 80
        ? 'rèn độ biến hóa và sự nhuần nhuyễn của biến chiêu'
        : `mài giũa uy lực thực chiến tiến sát ngưỡng Cấp ${Math.min(move.maxLevel, move.level + 1)}`;

  if (parentTech.category === 'mental') {
    return `Ta tĩnh tâm vận hành pháp môn "${move.name}" thuộc "${parentTech.name}" (Cấp ${move.level} · ${status.stageShortLabel}, ${move.mastery}%)${stoneClause}, chú trọng điều hòa kinh mạch để ${goalHint}.`;
  }
  return `Ta chuyên tâm rèn luyện chiêu thức "${move.name}" thuộc "${parentTech.name}" (Cấp ${move.level} · ${status.stageShortLabel}, ${move.mastery}%)${stoneClause}, tập trung ${goalHint}.`;
}

export function buildTechniqueUnlockStoryPrompt(
  tech: CultivationTechnique,
  status: MasteryLockStatus,
): string {
  return buildTechniqueTrainStoryPrompt(tech, { ...status, isLocked: true });
}

export function buildMoveUnlockStoryPrompt(
  move: TechniqueMove,
  parentTech: CultivationTechnique,
  status: MasteryLockStatus,
): string {
  return buildMoveTrainStoryPrompt(move, parentTech, {
    ...status,
    isLocked: true,
  });
}

/**
 * Legacy-compatible single-move mastery helper — strictly clamps at the move's 99%
 * bottleneck so no caller can bypass move bottlenecks without breaking through.
 */
export function bumpMoveMastery(
  move: TechniqueMove,
  delta: number,
): { nextMove: TechniqueMove; leveledUp: boolean; hitLockCap?: number } {
  if (delta <= 0) return { nextMove: move, leveledUp: false };
  const { isMaxed, nextLockCap, effectiveUnlocked } = getNextLockCapFor(
    move.mastery,
    move.level,
    move.maxLevel,
    move.unlockedMilestones,
  );
  if (isMaxed || move.mastery >= nextLockCap) {
    return {
      nextMove: move,
      leveledUp: false,
      ...(isMaxed ? {} : { hitLockCap: nextLockCap }),
    };
  }
  const nextMastery = Math.min(nextLockCap, Math.max(0, move.mastery + Math.round(delta)));
  return {
    nextMove: {
      ...move,
      mastery: nextMastery,
      unlockedMilestones: effectiveUnlocked,
    },
    leveledUp: false,
    ...(nextMastery >= nextLockCap ? { hitLockCap: nextLockCap } : {}),
  };
}

/**
 * Generates 4–5 authentic starter moves (chiêu thức) tailored to a technique's name,
 * category, and genre (Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp).
 */
export function generateSuggestedMovesForTechnique(params: {
  name: string;
  category: TechniqueCategory;
  systemKind: CultivationSystemKind;
  baseSeed?: number;
}): TechniqueMove[] {
  const { name, category, systemKind } = params;
  const seed = params.baseSeed ?? Date.now();
  const lower = (name || '').toLowerCase();

  type MoveTemplate = { name: string; description: string; mastery: number };
  let templates: MoveTemplate[];

  if (category === 'movement') {
    if (systemKind === 'xianxia') {
      templates = [
        {
          name: 'Lăng Không Tức Bộ',
          description: 'Dồn linh khí dưới huyệt Dũng Tuyền, lướt ngang ba trượng né chiêu trong chớp mắt.',
          mastery: 32,
        },
        {
          name: 'Thanh Ảnh Phân Thân',
          description: 'Di chuyển đổi hướng gấp lưu lại tàn ảnh đánh lạc hướng tầm mắt đối thủ.',
          mastery: 22,
        },
        {
          name: 'Đạp Phong Thượng Vân',
          description: 'Mượn luồng linh phong bật cao lên không trung, chiếm ưu thế tầm nhìn.',
          mastery: 16,
        },
        {
          name: 'Súc Địa Tiểu Độn',
          description: 'Thu ngắn khoảng cách áp sát hoặc thoát khỏi vòng vây pháp trận trong một nhịp thở.',
          mastery: 10,
        },
      ];
    } else if (systemKind === 'xuanhuan') {
      templates = [
        {
          name: 'Tật Ảnh Đột Kích',
          description: 'Bộc phát huyền khí ở chân lao thẳng cự ly ngắn, tạo lợi thế ra đòn trước.',
          mastery: 34,
        },
        {
          name: 'Ảo Ảnh Chiết Bộ',
          description: 'Đổi góc di chuyển đột ngột theo hình chữ chi, tránh né công kích diện rộng.',
          mastery: 24,
        },
        {
          name: 'Quỷ Mị Nhiễu Hậu',
          description: 'Lượn vòng ra sau điểm mù đối thủ trong hỗn chiến để mở góc phản kích.',
          mastery: 16,
        },
        {
          name: 'Huyền Phong Toàn Thoái',
          description: 'Mượn phản lực va chạm bật lùi an toàn, giữ thăng bằng và khoảng cách.',
          mastery: 12,
        },
      ];
    } else {
      templates = [
        {
          name: 'Khinh Yên Điểm Thủy',
          description: 'Nhấc chân nhẹ tựa khói sương, lướt qua mặt đất trơn hoặc mặt nước không để lại dấu.',
          mastery: 36,
        },
        {
          name: 'Yến Tử Xuyên Liêm',
          description: 'Nghiêng thân luồn lách gọn qua khe hẹp và lưới đao kiếm đang khép lại.',
          mastery: 26,
        },
        {
          name: 'Đạp Tuyết Vô Thanh',
          description: 'Điều tức giấu tiếng bước chân, áp sát hoặc rút lui trong đêm tối không gây động tĩnh.',
          mastery: 18,
        },
        {
          name: 'Thê Vân Túng Nguyệt',
          description: 'Mượn lực mũi chân bật nối hai nhịp trên không vượt tường cao mái ngói.',
          mastery: 12,
        },
      ];
    }
  } else if (category === 'mental') {
    if (systemKind === 'xianxia') {
      templates = [
        {
          name: 'Dẫn Khí Quy Điền',
          description: 'Hấp thu thiên địa linh khí qua cửu khiếu, lắng lọc tạp chất rồi quy tụ về đan điền.',
          mastery: 38,
        },
        {
          name: 'Tiểu Chu Thiên Tuần Hoàn',
          description: 'Vận chuyển linh lực một vòng kinh mạch chính, ổn định tâm thần và hồi phục tiêu hao.',
          mastery: 28,
        },
        {
          name: 'Linh Quang Hộ Thể',
          description: 'Ngưng tụ lớp linh lực mỏng quanh thân giảm nhẹ lực chấn động và tà khí xâm nhập.',
          mastery: 20,
        },
        {
          name: 'Ngưng Thần Tụ Linh',
          description: 'Thu liễm khí tức, tập trung thần thức để đẩy nhanh hiệu suất bế quan đột phá.',
          mastery: 14,
        },
      ];
    } else if (systemKind === 'xuanhuan') {
      templates = [
        {
          name: 'Huyền Khí Thôn Nạp',
          description: 'Hút huyền khí thiên địa và năng lượng tinh thạch vào kinh mạch, tôi luyện khí hải.',
          mastery: 35,
        },
        {
          name: 'Nhiệt Huyết Phần Kinh',
          description: 'Kích phát huyền khí lưu chuyển tốc độ cao, tạm thời tăng cường sức mạnh cơ bắp.',
          mastery: 24,
        },
        {
          name: 'Huyền Cương Hộ Giáp',
          description: 'Kết thành tầng huyền cương ngoài da chống đỡ trảm kích và xung kích cận chiến.',
          mastery: 18,
        },
        {
          name: 'Quy Nguyên Điều Tức',
          description: 'Bình ổn khí huyết loạn động sau giao chiến, hồi phục nhanh thể lực và huyền khí.',
          mastery: 12,
        },
      ];
    } else {
      templates = [
        {
          name: 'Điều Tức Quy Nguyên',
          description: 'Hít thở chậm sâu dẫn chân khí quy về đan điền, hồi phục nội lực và xua tan mệt mỏi.',
          mastery: 40,
        },
        {
          name: 'Hộ Tâm Chân Khí',
          description: 'Vận nội kình bảo vệ tâm mạch và lục phủ ngũ tạng trước chưởng lực đối phương.',
          mastery: 28,
        },
        {
          name: 'Khí Quán Bách Mạch',
          description: 'Đưa nội lực chạy dọc hai tay và binh khí, gia tăng độ sắc bén và lực đạo chiêu thức.',
          mastery: 20,
        },
        {
          name: 'Tĩnh Tâm Minh Cảnh',
          description: 'Giữ tâm trí trong sáng như mặt gương, nhìn rõ sơ hở và nhịp thở của đối thủ.',
          mastery: 14,
        },
      ];
    }
  } else if (category === 'secret') {
    templates = [
      {
        name: 'Bí Ẩn Liễm Tức',
        description: 'Ẩn giấu dao động tu vi/khí tức, khiến kẻ cùng cảnh giới khó lòng dò xét.',
        mastery: 30,
      },
      {
        name: 'Nhiên Khí Bộc Phát',
        description: 'Đốt cháy một phần chân khí để bùng nổ tốc độ và uy lực trong khoảnh khắc quyết định.',
        mastery: 22,
      },
      {
        name: 'Thần Niệm Trấn Nhiếp',
        description: 'Phóng thích uy áp tinh thần làm chững lại nhịp ra đòn của đối thủ yếu tâm cảnh hơn.',
        mastery: 16,
      },
      {
        name: 'Nghịch Chuyển Khí Huyết',
        description: 'Ép thông kinh mạch bị phong bế hoặc hóa giải một phần độc tính, thương thế cấp bách.',
        mastery: 10,
      },
    ];
  } else {
    // Martial / Pháp thuật — tailor by weapon/element keywords in name
    if (/kiếm|kiem|sword/i.test(lower)) {
      templates =
        systemKind === 'wuxia'
          ? [
              {
                name: 'Thanh Phong Phất Liễu',
                description: 'Vẩy cổ tay đưa mũi kiếm gạt nhẹ ngang tầm ngực, hóa giải thế công rồi chuyển thủ thành công.',
                mastery: 36,
              },
              {
                name: 'Tật Phong Xuyên Tâm',
                description: 'Bước chéo dồn kình đâm thẳng tốc độ cao vào sơ hở trước ngực đối thủ.',
                mastery: 28,
              },
              {
                name: 'Tùng Phong Trảm Nguyệt',
                description: 'Chém chếch từ vai phải xuống tạo vòng cung sắc gọn, ép đối phương phải lùi bước.',
                mastery: 22,
              },
              {
                name: 'Hồi Phong Lạc Nhạn',
                description: 'Xoay thân thu kiếm rồi phản kích hai nhịp liên hoàn khi đối thủ áp sát.',
                mastery: 15,
              },
              {
                name: 'Vạn Phong Quy Nhất',
                description: 'Tuyệt chiêu hội tụ toàn bộ nội lực vào một đường kiếm thẳng, uy lực sắc bén nhất bộ.',
                mastery: 8,
              },
            ]
          : [
              {
                name: 'Thanh Phong Dẫn Kiếm',
                description: 'Mượn linh phong gia tốc đường kiếm đầu, mũi kiếm nhẹ nhưng kình gió sắc lạnh.',
                mastery: 34,
              },
              {
                name: 'Lưu Vân Phân Quang',
                description: 'Vung kiếm hóa thành ba đạo kiếm ảnh liên hoàn bao phủ góc né của đối thủ.',
                mastery: 26,
              },
              {
                name: 'Tật Phong Trảm Lãng',
                description: 'Ngưng tụ linh khí thành kiếm khí hình trăng khuyết phóng ra tầm trung.',
                mastery: 18,
              },
              {
                name: 'Toàn Phong Kiếm Thuẫn',
                description: 'Quay kiếm vẽ vòng tròn tạo luồng gió xoáy đánh bật ám khí và pháp thuật nhỏ.',
                mastery: 14,
              },
              {
                name: 'Ngự Phong Phá Vân',
                description: 'Dồn toàn lực ngự kiếm lao thẳng từ trên cao xuống, xuyên phá phòng ngự đối phương.',
                mastery: 8,
              },
            ];
    } else if (/đao|dao|trảm|tram/i.test(lower)) {
      templates = [
        {
          name: 'Hoành Đao Đoạn Thủy',
          description: 'Quét ngang thân đao nặng nề, dùng thế cương mãnh đẩy lùi binh khí đối thủ.',
          mastery: 34,
        },
        {
          name: 'Liệt Phong Phách Sơn',
          description: 'Bật bước chém bổ từ trên cao xuống với khí kình xé gió áp đảo.',
          mastery: 26,
        },
        {
          name: 'Hồi Mã Phản Trảm',
          description: 'Giả vờ thu thế rồi xoay hông chém ngược bất ngờ vào sườn kẻ truy kích.',
          mastery: 18,
        },
        {
          name: 'Cuồng Phong Liên Trảm',
          description: 'Xuất ba đao nối tiếp không ngừng nghỉ, đao sau nặng và nhanh hơn đao trước.',
          mastery: 14,
        },
        {
          name: 'Đoạn Không Nhất Trảm',
          description: 'Tụ toàn bộ khí lực vào sống đao tung một nhát chém dứt khoát phá tan phòng tuyến.',
          mastery: 8,
        },
      ];
    } else if (/quyền|quyen|chưởng|chuong|chỉ|chi|trảo|trao/i.test(lower)) {
      templates = [
        {
          name: 'Khai Sơn Chính Chưởng',
          description: 'Đẩy thẳng lòng bàn tay kèm ám kình trầm ổn, đánh văng đối thủ cận chiến.',
          mastery: 35,
        },
        {
          name: 'Liên Hoàn Phá Phong',
          description: 'Ra quyền chưởng hai tay liên tiếp tạo áp lực dày đặc khiến địch khó trở tay.',
          mastery: 26,
        },
        {
          name: 'Tá Lực Đả Lực',
          description: 'Thuận theo hướng kình của đối thủ xoay cổ tay hóa giải rồi phản chấn ngược lại.',
          mastery: 18,
        },
        {
          name: 'Toái Thạch Chấn Kình',
          description: 'Dồn lực từ eo và vai phát kình cự ly gần, xuyên qua lớp hộ thể thông thường.',
          mastery: 12,
        },
        {
          name: 'Kinh Lôi Nhất Kích',
          description: 'Chiêu thức áp trục dồn trọn chân khí vào một đòn dứt điểm đầy uy thế.',
          mastery: 8,
        },
      ];
    } else if (/thương|thuong|côn|con|kích|kich/i.test(lower)) {
      templates = [
        {
          name: 'Độc Long Xuất Hải',
          description: 'Đâm thẳng mũi thương như giao long lao tới, tốc độ nhanh và tầm đánh xa.',
          mastery: 34,
        },
        {
          name: 'Hoành Tảo Thiên Quân',
          description: 'Vung ngang thân binh khí quét rộng nửa vòng tròn, đẩy lùi nhiều kẻ áp sát.',
          mastery: 26,
        },
        {
          name: 'Hồi Toàn Phá Thế',
          description: 'Xoay cán đánh chệch đòn bổ từ trên xuống rồi trượt mũi đâm phản công.',
          mastery: 18,
        },
        {
          name: 'Bạo Vũ Lê Hoa',
          description: 'Rung cổ tay đâm liên tiếp tạo màn hoa thương che kín tầm nhìn đối phương.',
          mastery: 12,
        },
        {
          name: 'Phá Giáp Xuyên Vân',
          description: 'Xoắn kình dọc thân binh khí đâm một kích toàn lực xuyên phá giáp trụ.',
          mastery: 8,
        },
      ];
    } else if (/hỏa|hoa|viêm|viem|lôi|loi|băng|bang|hàn|han|phù|trận/i.test(lower)) {
      templates = [
        {
          name: 'Ngưng Nguyên Sơ Kích',
          description: 'Tụ linh lực nguyên tố thành mũi xung kích phóng nhanh ở cự ly trung bình.',
          mastery: 34,
        },
        {
          name: 'Nguyên Tố Liên Hoàn',
          description: 'Phát liên tiếp ba đạo pháp quyết khống chế góc di chuyển của mục tiêu.',
          mastery: 24,
        },
        {
          name: 'Hộ Nguyên Kết Giới',
          description: 'Dựng màn chắn năng lượng trước mặt triệt tiêu một phần sát thương pháp thuật.',
          mastery: 18,
        },
        {
          name: 'Bạo Tán Chấn Ba',
          description: 'Kích nổ luồng năng lượng xung quanh thân đẩy lùi kẻ địch đang áp sát.',
          mastery: 12,
        },
        {
          name: 'Thiên Địa Phần Nguyên',
          description: 'Tụ lực toàn thân giáng xuống đòn nguyên tố cực mạnh mang uy áp áp đảo.',
          mastery: 6,
        },
      ];
    } else {
      templates = [
        {
          name: 'Khởi Thủ Thám Lộ',
          description: 'Chiêu mở đầu gọn gàng thăm dò phản ứng và khoảng cách của đối phương.',
          mastery: 34,
        },
        {
          name: 'Liên Kích Phá Phòng',
          description: 'Hai nhịp tiến công nối tiếp sắc bén nhằm phá vỡ thế thủ cân bằng.',
          mastery: 26,
        },
        {
          name: 'Hóa Kình Phản Chế',
          description: 'Nương theo lực đánh tới để gạt lệch rồi tung đòn phản kích chớp nhoáng.',
          mastery: 18,
        },
        {
          name: 'Tụ Khí Trọng Kích',
          description: 'Dồn chân khí vào một đòn đánh nặng tay gây chấn động mạnh lên mục tiêu.',
          mastery: 12,
        },
        {
          name: 'Tuyệt Thức Quy Nhất',
          description: 'Chiêu cuối hội tụ tinh hoa toàn bộ bí kíp, tung ra trong thời khắc định đoạt.',
          mastery: 8,
        },
      ];
    }
  }

  return templates.map((tpl, idx) => ({
    id: `mv_${seed}_${idx + 1}_${Math.random().toString(36).slice(2, 5)}`,
    name: tpl.name,
    description: tpl.description,
    level: 1,
    maxLevel: 5,
    mastery: tpl.mastery,
  }));
}

export function createStarterCultivationProfile(
  kind: CultivationSystemKind,
  hints?: {
    mcRole?: string;
    mcDesc?: string;
    worldName?: string;
  },
): CultivationProfile {
  const meta = CULTIVATION_SYSTEM_META[kind];
  const hintText = [hints?.mcRole, hints?.mcDesc, hints?.worldName]
    .filter(Boolean)
    .join(' ');
  const realmIndex = inferStartingRealmIndex(kind, hintText);
  const stage = meta.realms[realmIndex] || meta.realms[0];
  const initialExp = Math.round(stage.maxExp * 0.22);
  const now = Date.now();

  if (kind === 'xianxia') {
    return {
      schemaVersion: CULTIVATION_SCHEMA_VERSION,
      enabled: true,
      systemKind: 'xianxia',
      realmIndex,
      realmName: stage.name,
      majorRealm: stage.majorRealm,
      subStage: stage.subStage,
      ...(typeof stage.minorTier === 'number'
        ? { minorTier: stage.minorTier }
        : {}),
      energyLabel: meta.energyLabel,
      exp: initialExp,
      maxExp: stage.maxExp,
      overflowExp: 0,
      readyToBreakthrough: false,
      autoProgressByClock: true,
      bagName: meta.bagName,
      techniques: [
        {
          id: `tech_${now}_1`,
          name: 'Thanh Vân Dẫn Khí Quyết',
          category: 'mental',
          tier: 'linh',
          level: 2,
          maxLevel: 9,
          mastery: 35,
          isActiveTraining: true,
          description: 'Tâm pháp dẫn linh khí nhập thể, ôn hòa ổn định, tăng tốc độ tích tụ tu vi.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Thanh Vân Dẫn Khí Quyết',
            category: 'mental',
            systemKind: 'xianxia',
            baseSeed: now + 10,
          }),
        },
        {
          id: `tech_${now}_2`,
          name: 'Ngự Phong Kiếm Quyết',
          category: 'martial',
          tier: 'pham',
          level: 1,
          maxLevel: 9,
          mastery: 22,
          isActiveTraining: false,
          description: 'Kiếm quyết cơ bản của tông môn, xuất kiếm nhanh nhẹ theo luồng linh phong.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Ngự Phong Kiếm Quyết',
            category: 'martial',
            systemKind: 'xianxia',
            baseSeed: now + 20,
          }),
        },
        {
          id: `tech_${now}_3`,
          name: 'Linh Bộ Thân Pháp',
          category: 'movement',
          tier: 'pham',
          level: 1,
          maxLevel: 6,
          mastery: 18,
          isActiveTraining: false,
          description: 'Vận linh khí dưới lòng bàn chân để né tránh và di chuyển nhanh gọn.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Linh Bộ Thân Pháp',
            category: 'movement',
            systemKind: 'xianxia',
            baseSeed: now + 30,
          }),
        },
      ],
      inventory: [
        {
          id: `inv_${now}_1`,
          name: 'Hạ phẩm Linh thạch',
          quantity: 12,
          quality: 'uncommon',
          category: 'material',
          description:
            'Linh thạch giao dịch phổ biến tại phường thị, có thể hấp thu trực tiếp để phụ trợ tu luyện.',
        },
        {
          id: `inv_${now}_2`,
          name: 'Tụ Khí Đan',
          quantity: 3,
          quality: 'uncommon',
          category: 'consumable',
          description:
            'Đan dược nhập môn giúp hội tụ thiên địa linh khí, bồi bổ linh lực ổn định.',
        },
        {
          id: `inv_${now}_3`,
          name: 'Thanh Cương Linh Kiếm',
          quantity: 1,
          quality: 'common',
          category: 'weapon',
          description:
            'Phi kiếm pháp khí sơ giai rèn từ thanh cương, dẫn truyền linh khí ổn định.',
        },
        {
          id: `inv_${now}_4`,
          name: 'Bách Niên Tử Linh Chi',
          quantity: 1,
          quality: 'uncommon',
          category: 'herb',
          description:
            'Linh chi trăm năm ánh tím dịu, bồi bổ khí huyết và làm dược liệu luyện đan.',
        },
        {
          id: `inv_${now}_5`,
          name: 'Hồi Xuân Phù',
          quantity: 2,
          quality: 'common',
          category: 'talisman',
          description:
            'Phù lục trị thương nhanh cho vết thương ngoài da và hao tổn thể lực.',
        },
      ],
      constitution: createDefaultConstitution('xianxia', realmIndex),
      lastUpdatedAt: now,
    };
  }

  if (kind === 'xuanhuan') {
    return {
      schemaVersion: CULTIVATION_SCHEMA_VERSION,
      enabled: true,
      systemKind: 'xuanhuan',
      realmIndex,
      realmName: stage.name,
      majorRealm: stage.majorRealm,
      subStage: stage.subStage,
      ...(typeof stage.minorTier === 'number'
        ? { minorTier: stage.minorTier }
        : {}),
      energyLabel: meta.energyLabel,
      exp: initialExp,
      maxExp: stage.maxExp,
      overflowExp: 0,
      readyToBreakthrough: false,
      autoProgressByClock: true,
      bagName: meta.bagName,
      techniques: [
        {
          id: `tech_${now}_1`,
          name: 'Huyền Viêm Quyết',
          category: 'mental',
          tier: 'linh',
          level: 1,
          maxLevel: 9,
          mastery: 30,
          isActiveTraining: true,
          description: 'Huyền công tôi luyện huyền khí thuần hậu mang hơi ấm liệt diễm.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Huyền Viêm Quyết',
            category: 'mental',
            systemKind: 'xuanhuan',
            baseSeed: now + 40,
          }),
        },
        {
          id: `tech_${now}_2`,
          name: 'Liệt Phong Trảm',
          category: 'martial',
          tier: 'pham',
          level: 1,
          maxLevel: 9,
          mastery: 25,
          isActiveTraining: false,
          description: 'Chiến kỹ dồn huyền khí vào lưỡi binh khí tung ra trảm kích xé gió.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Liệt Phong Trảm',
            category: 'martial',
            systemKind: 'xuanhuan',
            baseSeed: now + 50,
          }),
        },
        {
          id: `tech_${now}_3`,
          name: 'Tật Ảnh Bộ',
          category: 'movement',
          tier: 'pham',
          level: 1,
          maxLevel: 6,
          mastery: 20,
          isActiveTraining: false,
          description: 'Thân pháp bộc phát cự ly ngắn, phù hợp áp sát hoặc rút lui trong hỗn chiến.',
          moves: generateSuggestedMovesForTechnique({
            name: 'Tật Ảnh Bộ',
            category: 'movement',
            systemKind: 'xuanhuan',
            baseSeed: now + 60,
          }),
        },
      ],
      inventory: [
        {
          id: `inv_${now}_1`,
          name: 'Huyền Tinh cấp 1',
          quantity: 8,
          quality: 'uncommon',
          category: 'material',
          description: 'Tinh thể tích tụ huyền khí, dùng trao đổi hoặc hấp thu trực tiếp.',
        },
        {
          id: `inv_${now}_2`,
          name: 'Hồi Huyền Đan',
          quantity: 3,
          quality: 'uncommon',
          category: 'consumable',
          description: 'Đan dược hồi phục nhanh huyền khí và ổn định kinh mạch sau chiến đấu.',
        },
        {
          id: `inv_${now}_3`,
          name: 'Hắc Thiết Chiến Đao',
          quantity: 1,
          quality: 'common',
          category: 'weapon',
          description: 'Chiến đao rèn từ hắc thiết tinh luyện, dẫn truyền huyền khí tốt.',
        },
        {
          id: `inv_${now}_4`,
          name: 'Tinh Hạch Dị Thú (Sơ cấp)',
          quantity: 1,
          quality: 'uncommon',
          category: 'material',
          description: 'Tinh hạch lấy từ dị thú ngoại vi, chứa năng lượng huyết mạch thô.',
        },
      ],
      constitution: createDefaultConstitution('xuanhuan', realmIndex),
      lastUpdatedAt: now,
    };
  }

  // Wuxia (Kiếm Hiệp)
  return {
    schemaVersion: CULTIVATION_SCHEMA_VERSION,
    enabled: true,
    systemKind: 'wuxia',
    realmIndex,
    realmName: stage.name,
    majorRealm: stage.majorRealm,
    subStage: stage.subStage,
    ...(typeof stage.minorTier === 'number'
      ? { minorTier: stage.minorTier }
      : {}),
    energyLabel: meta.energyLabel,
    exp: initialExp,
    maxExp: stage.maxExp,
    overflowExp: 0,
    readyToBreakthrough: false,
    autoProgressByClock: true,
    bagName: meta.bagName,
    techniques: [
      {
        id: `tech_${now}_1`,
        name: 'Hoa Sơn Cơ Bản Nội Công',
        category: 'mental',
        tier: 'pham',
        level: 1,
        maxLevel: 20,
        mastery: 32,
        isActiveTraining: true,
        description:
          'Nội công Môn phái · Nhập môn (trần Tầng 20 · Dung hội quán thông), dễ nhập thủ dưỡng khí vững nhưng chạm trần phải chuyển bộ cao hơn.',
        moves: generateSuggestedMovesForTechnique({
          name: 'Hoa Sơn Cơ Bản Nội Công',
          category: 'mental',
          systemKind: 'wuxia',
          baseSeed: now + 70,
        }),
      },
      {
        id: `tech_${now}_2`,
        name: 'Thanh Phong Thập Tam Kiếm',
        category: 'martial',
        tier: 'pham',
        level: 2,
        maxLevel: 9,
        mastery: 30,
        isActiveTraining: false,
        description: 'Mười ba thức kiếm pháp linh hoạt, chiêu thức liền mạch như gió thoảng.',
        moves: generateSuggestedMovesForTechnique({
          name: 'Thanh Phong Thập Tam Kiếm',
          category: 'martial',
          systemKind: 'wuxia',
          baseSeed: now + 80,
        }),
      },
      {
        id: `tech_${now}_3`,
        name: 'Đạp Tuyết Vô Ngân',
        category: 'movement',
        tier: 'pham',
        level: 1,
        maxLevel: 7,
        mastery: 22,
        isActiveTraining: false,
        description: 'Khinh công nhẹ nhàng, mượn lực mũi chân vượt mái ngói và địa hình hiểm.',
        moves: generateSuggestedMovesForTechnique({
          name: 'Đạp Tuyết Vô Ngân',
          category: 'movement',
          systemKind: 'wuxia',
          baseSeed: now + 90,
        }),
      },
    ],
    inventory: [
      {
        id: `inv_${now}_1`,
        name: 'Bạc vụn',
        quantity: 30,
        quality: 'common',
        category: 'misc',
        description:
          'Tiền bạc lẻ (1 lượng/món) dùng trả cơm rượu ở khách điếm, mua thuốc thường và chi tiêu dọc đường.',
      },
      {
        id: `inv_${now}_2`,
        name: 'Kim Sang Dược',
        quantity: 3,
        quality: 'common',
        category: 'consumable',
        description:
          'Thuốc bột cầm máu truyền thống của người hành tẩu giang hồ, rắc lên vết chém lập tức se miệng vết thương.',
      },
      {
        id: `inv_${now}_3`,
        name: 'Thanh Phong Trường Kiếm',
        quantity: 1,
        quality: 'uncommon',
        category: 'weapon',
        equipSlot: 'weapon',
        description:
          'Trường kiếm bách luyện cân bằng nhẹ tay, vỏ kiếm khắc vân mây xanh nhạt, phù hợp hiệp khách sơ nhập giang hồ.',
      },
      {
        id: `inv_${now}_4`,
        name: 'Tiểu Hoàn Đan',
        quantity: 2,
        quality: 'uncommon',
        category: 'consumable',
        description:
          'Đan hoàn dưỡng khí trứ danh của võ lâm, uống vào bổ sung nội lực hao tổn và điều hòa hơi thở.',
      },
      {
        id: `inv_${now}_5`,
        name: 'Thanh Sam Thư Sinh Bào',
        quantity: 1,
        quality: 'common',
        category: 'outfit',
        equipSlot: 'armor',
        description:
          'Áo dài vải gai xanh nhạt may gọn gàng, sạch sẽ, không phô trương khi đi qua trấn nhỏ hay quán trà.',
      },
    ],
    equipment: {
      weapon: `inv_${now}_3`,
      armor: `inv_${now}_5`,
    },
    constitution: createDefaultConstitution('wuxia', realmIndex),
    wuxiaState: createDefaultWuxiaState(realmIndex),
    lastUpdatedAt: now,
  };
}

const VALID_SYSTEM_KINDS = new Set<CultivationSystemKind>([
  'xianxia',
  'xuanhuan',
  'wuxia',
]);
const VALID_TECH_CATEGORIES = new Set<TechniqueCategory>([
  'mental',
  'martial',
  'movement',
  'secret',
]);
const VALID_TECH_TIERS = new Set<TechniqueTier>([
  'pham',
  'linh',
  'huyen',
  'dia',
  'thien',
  'chiton',
]);
const VALID_INV_QUALITIES = new Set<InventoryItemQuality>([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'immortal',
]);
const VALID_INV_CATEGORIES = new Set<InventoryItemCategory>([
  'consumable',
  'weapon',
  'outfit',
  'herb',
  'talisman',
  'material',
  'misc',
]);
const VALID_EQUIPMENT_SLOTS = new Set<EquipmentSlotId>([
  'weapon',
  'armor',
  'accessory',
  'relic',
  'soul_vessel',
  'array_treasure',
]);
const VALID_LOCK_CONDITION_KINDS = new Set<MasteryLockConditionKind>([
  'combat',
  'realm',
  'insight',
  'resource',
  'meridian',
]);

const VALID_SUB_STAGES = new Set<CultivationSubStage>(CULTIVATION_SUB_STAGES);

function extractCustomMajorRealm(realmName: string, fallbackMajor: string): string {
  const cleaned = (realmName || '')
    .replace(/\([^)]*\)/g, '')
    .replace(
      /\s*(?:sơ\s*kỳ|trung\s*kỳ|hậu\s*kỳ|đỉnh\s*phong|đại\s*viên\s*mãn|viên\s*mãn|tầng\s*\d+|trọng\s*\d+|kỳ)\s*$/i,
      '',
    )
    .trim();
  return cleaned || fallbackMajor;
}

/**
 * Safely migrates legacy v1 or incomplete cultivation realm records onto the canonical
 * v2 stage ladder (with complete Sơ kỳ / Trung kỳ / Hậu kỳ / Đỉnh phong sub-stages).
 */
export function migrateLegacyCultivationRealm(
  systemKind: CultivationSystemKind,
  raw: Record<string, unknown>,
): {
  realmIndex: number;
  realmName: string;
  majorRealm: string;
  subStage: CultivationSubStage;
  minorTier?: number;
  maxExp: number;
  migratedFromLegacy: boolean;
} {
  const meta = CULTIVATION_SYSTEM_META[systemKind];
  const realms = meta.realms;
  const rawSchemaVersion =
    typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)
      ? Math.trunc(raw.schemaVersion)
      : 1;
  const isLegacyV1 = rawSchemaVersion < CULTIVATION_SCHEMA_VERSION;

  const rawRealmName =
    typeof raw.realmName === 'string' ? raw.realmName.trim() : '';
  const rawMajorRealm =
    typeof raw.majorRealm === 'string' ? raw.majorRealm.trim() : '';
  const rawSubStage: CultivationSubStage | null = VALID_SUB_STAGES.has(
    raw.subStage as CultivationSubStage,
  )
    ? (raw.subStage as CultivationSubStage)
    : parseSubStageFromText(
        typeof raw.subStage === 'string' ? raw.subStage : rawRealmName,
      );
  const rawMinorTier =
    typeof raw.minorTier === 'number' && Number.isFinite(raw.minorTier)
      ? Math.max(
          1,
          Math.min(systemKind === 'wuxia' ? 86 : 12, Math.trunc(raw.minorTier)),
        )
      : parseMinorTierFromText(rawRealmName);
  const rawIndex =
    typeof raw.realmIndex === 'number' && Number.isFinite(raw.realmIndex)
      ? Math.trunc(raw.realmIndex)
      : null;

  let resolvedIdx = -1;
  let matchedCanonical = false;

  // 1. Try matching by explicit structured majorRealm + subStage/minorTier or realmName
  if (rawMajorRealm || rawRealmName) {
    const idx = findCanonicalStageIndexByName(
      systemKind,
      rawRealmName,
      rawMajorRealm,
      rawSubStage,
      rawMinorTier,
    );
    if (idx >= 0) {
      resolvedIdx = idx;
      matchedCanonical = true;
    }
  }

  // 1b. Backward-compatible migration for legacy Wuxia saves (Tam Lưu / Hậu Thiên / Tiên Thiên / Tông Sư -> 21 Cửu Âm tiers)
  if (resolvedIdx < 0 && systemKind === 'wuxia') {
    const mappedWuxia = mapLegacyWuxiaRealmToIndex(
      rawRealmName || rawMajorRealm,
      rawIndex ?? undefined,
    );
    if (mappedWuxia !== null) {
      resolvedIdx = mappedWuxia;
      matchedCanonical = true;
    }
  }

  // 2. If legacy v1 Xianxia save had no matchable realmName (e.g. only realmIndex 0..14),
  //    translate through the exact legacy 15-entry index table first!
  if (
    resolvedIdx < 0 &&
    systemKind === 'xianxia' &&
    isLegacyV1 &&
    rawIndex !== null &&
    rawIndex >= 0 &&
    rawIndex < LEGACY_XIANXIA_V1_REALMS.length
  ) {
    const legacyName = LEGACY_XIANXIA_V1_REALMS[rawIndex];
    const mappedIdx = findCanonicalStageIndexByName('xianxia', legacyName);
    if (mappedIdx >= 0) {
      resolvedIdx = mappedIdx;
      matchedCanonical = true;
    }
  }

  // 3. Fallback to clamped realmIndex on canonical ladder
  if (resolvedIdx < 0) {
    resolvedIdx =
      rawIndex !== null
        ? Math.max(0, Math.min(realms.length - 1, rawIndex))
        : 0;
  }

  const canonicalStage = realms[resolvedIdx] || realms[0];
  const preserveCustomName =
    Boolean(rawRealmName) &&
    !matchedCanonical &&
    rawRealmName.toLowerCase() !== canonicalStage.name.toLowerCase();

  const resolvedRealmName = preserveCustomName
    ? rawRealmName
    : canonicalStage.name;
  const resolvedMajorRealm = preserveCustomName
    ? rawMajorRealm || extractCustomMajorRealm(rawRealmName, canonicalStage.majorRealm)
    : canonicalStage.majorRealm;
  const resolvedSubStage: CultivationSubStage = preserveCustomName
    ? rawSubStage || canonicalStage.subStage
    : canonicalStage.subStage;
  const resolvedMinorTier = preserveCustomName
    ? rawMinorTier ?? undefined
    : canonicalStage.minorTier;

  const rawMaxExp =
    typeof raw.maxExp === 'number' && Number.isFinite(raw.maxExp) && raw.maxExp >= 10
      ? Math.round(raw.maxExp)
      : null;

  // When upgrading a legacy v1 Xianxia save onto the new canonical ladder, align maxExp
  // to the canonical stage threshold; for v2 or custom-named realms, respect valid saved maxExp.
  const resolvedMaxExp =
    isLegacyV1 && systemKind === 'xianxia' && matchedCanonical
      ? canonicalStage.maxExp
      : rawMaxExp || canonicalStage.maxExp;

  return {
    realmIndex: resolvedIdx,
    realmName: resolvedRealmName,
    majorRealm: resolvedMajorRealm,
    subStage: resolvedSubStage,
    ...(typeof resolvedMinorTier === 'number'
      ? { minorTier: resolvedMinorTier }
      : {}),
    maxExp: resolvedMaxExp,
    migratedFromLegacy: isLegacyV1 && systemKind === 'xianxia' && matchedCanonical,
  };
}

export function normalizeCultivationProfile(
  raw: unknown,
): CultivationProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const systemKind: CultivationSystemKind = VALID_SYSTEM_KINDS.has(
    r.systemKind as CultivationSystemKind,
  )
    ? (r.systemKind as CultivationSystemKind)
    : 'xianxia';
  const meta = CULTIVATION_SYSTEM_META[systemKind];

  const migrated = migrateLegacyCultivationRealm(systemKind, r);
  const maxExp = migrated.maxExp;
  const maxOverflow = getMaxOverflowExp(maxExp);

  const rawOldMaxExp =
    typeof r.maxExp === 'number' && Number.isFinite(r.maxExp) && r.maxExp > 0
      ? Math.round(r.maxExp)
      : maxExp;
  const rawExp =
    typeof r.exp === 'number' && Number.isFinite(r.exp) && r.exp >= 0
      ? Math.round(r.exp)
      : 0;
  const rawOverflow =
    typeof r.overflowExp === 'number' &&
    Number.isFinite(r.overflowExp) &&
    r.overflowExp >= 0
      ? Math.round(r.overflowExp)
      : 0;

  let exp = rawExp;
  let overflowExp = rawOverflow;

  // Preserve exact completion percentage & breakthrough readiness when migrating legacy v1 maxExp
  if (migrated.migratedFromLegacy && rawOldMaxExp > 0 && rawOldMaxExp !== maxExp) {
    const legacyTotalRatio = (rawExp + rawOverflow) / rawOldMaxExp;
    if (legacyTotalRatio >= 1) {
      exp = maxExp;
      overflowExp = Math.min(
        maxOverflow,
        Math.max(0, Math.round((legacyTotalRatio - 1) * maxExp)),
      );
    } else {
      exp = Math.max(0, Math.min(maxExp - 1, Math.round(legacyTotalRatio * maxExp)));
      overflowExp = 0;
    }
  } else {
    // Strictly enforce anti-overflow invariant: 0 <= exp <= maxExp, excess goes to bounded overflowExp
    if (exp > maxExp) {
      overflowExp = Math.min(maxOverflow, overflowExp + (exp - maxExp));
      exp = maxExp;
    } else {
      exp = Math.max(0, exp);
      overflowExp = exp >= maxExp ? Math.min(maxOverflow, overflowExp) : 0;
    }
  }

  const readyToBreakthrough = exp >= maxExp;

  const techniques: CultivationTechnique[] = Array.isArray(r.techniques)
    ? r.techniques
        .filter((t) => t && typeof t === 'object')
        .map((t, idx) => {
          const item = t as Record<string, unknown>;
          const maxLevel =
            typeof item.maxLevel === 'number' &&
            Number.isFinite(item.maxLevel) &&
            item.maxLevel >= 1
              ? Math.min(99, Math.trunc(item.maxLevel))
              : 9;
          const level =
            typeof item.level === 'number' && Number.isFinite(item.level)
              ? Math.max(1, Math.min(maxLevel, Math.trunc(item.level)))
              : 1;
          const mastery =
            typeof item.mastery === 'number' && Number.isFinite(item.mastery)
              ? Math.max(0, Math.min(100, Math.round(item.mastery)))
              : 0;
          const moves: TechniqueMove[] | undefined = Array.isArray(item.moves)
            ? item.moves
                .filter((mv) => mv && typeof mv === 'object')
                .map((mv, mvIdx) => {
                  const mRec = mv as Record<string, unknown>;
                  const mvMaxLv =
                    typeof mRec.maxLevel === 'number' &&
                    Number.isFinite(mRec.maxLevel) &&
                    mRec.maxLevel >= 1
                      ? Math.min(20, Math.trunc(mRec.maxLevel))
                      : 5;
                  const mvLv =
                    typeof mRec.level === 'number' && Number.isFinite(mRec.level)
                      ? Math.max(1, Math.min(mvMaxLv, Math.trunc(mRec.level)))
                      : 1;
                  const mvMastery =
                    typeof mRec.mastery === 'number' &&
                    Number.isFinite(mRec.mastery)
                      ? Math.max(0, Math.min(100, Math.round(mRec.mastery)))
                      : 0;
                  const mvUnlocked = Array.isArray(mRec.unlockedMilestones)
                    ? Array.from(
                        new Set(
                          mRec.unlockedMilestones.filter(
                            (x): x is number =>
                              typeof x === 'number' &&
                              (MASTERY_LOCK_MILESTONES as readonly number[]).includes(x),
                          ),
                        ),
                      ).sort((a, b) => a - b)
                    : undefined;
                  return {
                    id:
                      typeof mRec.id === 'string' && mRec.id
                        ? mRec.id
                        : `mv_${Date.now()}_${idx}_${mvIdx}`,
                    name: String(mRec.name || '').trim(),
                    level: mvLv,
                    maxLevel: mvMaxLv,
                    mastery: mvMastery,
                    ...(typeof mRec.description === 'string' &&
                    mRec.description.trim()
                      ? { description: mRec.description.trim() }
                      : {}),
                    ...(mvUnlocked ? { unlockedMilestones: mvUnlocked } : {}),
                    ...(VALID_LOCK_CONDITION_KINDS.has(
                      mRec.lockConditionKind as MasteryLockConditionKind,
                    )
                      ? {
                          lockConditionKind:
                            mRec.lockConditionKind as MasteryLockConditionKind,
                        }
                      : {}),
                    ...(typeof mRec.customLockReason === 'string' &&
                    mRec.customLockReason.trim()
                      ? { customLockReason: mRec.customLockReason.trim() }
                      : {}),
                    ...(typeof mRec.customUnlockCondition === 'string' &&
                    mRec.customUnlockCondition.trim()
                      ? {
                          customUnlockCondition:
                            mRec.customUnlockCondition.trim(),
                        }
                      : {}),
                    ...(typeof mRec.requiredRealmIndex === 'number' &&
                    Number.isFinite(mRec.requiredRealmIndex)
                      ? {
                          requiredRealmIndex: Math.max(
                            0,
                            Math.trunc(mRec.requiredRealmIndex),
                          ),
                        }
                      : {}),
                  };
                })
                .filter((mv) => mv.name)
            : undefined;
          const techUnlocked = Array.isArray(item.unlockedMilestones)
            ? Array.from(
                new Set(
                  item.unlockedMilestones.filter(
                    (x): x is number =>
                      typeof x === 'number' &&
                      (MASTERY_LOCK_MILESTONES as readonly number[]).includes(x),
                  ),
                ),
              ).sort((a, b) => a - b)
            : undefined;
          return {
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `tech_${Date.now()}_${idx}`,
            name: String(item.name || 'Công pháp').trim(),
            category: VALID_TECH_CATEGORIES.has(
              item.category as TechniqueCategory,
            )
              ? (item.category as TechniqueCategory)
              : 'martial',
            tier: VALID_TECH_TIERS.has(item.tier as TechniqueTier)
              ? (item.tier as TechniqueTier)
              : 'pham',
            level,
            maxLevel,
            mastery,
            isActiveTraining: Boolean(item.isActiveTraining),
            ...(typeof item.description === 'string' && item.description.trim()
              ? { description: item.description.trim() }
              : {}),
            ...(moves && moves.length > 0 ? { moves } : {}),
            ...(techUnlocked ? { unlockedMilestones: techUnlocked } : {}),
            ...(VALID_LOCK_CONDITION_KINDS.has(
              item.lockConditionKind as MasteryLockConditionKind,
            )
              ? {
                  lockConditionKind:
                    item.lockConditionKind as MasteryLockConditionKind,
                }
              : {}),
            ...(typeof item.customLockReason === 'string' &&
            item.customLockReason.trim()
              ? { customLockReason: item.customLockReason.trim() }
              : {}),
            ...(typeof item.customUnlockCondition === 'string' &&
            item.customUnlockCondition.trim()
              ? {
                  customUnlockCondition: item.customUnlockCondition.trim(),
                }
              : {}),
            ...(typeof item.requiredRealmIndex === 'number' &&
            Number.isFinite(item.requiredRealmIndex)
              ? {
                  requiredRealmIndex: Math.max(
                    0,
                    Math.trunc(item.requiredRealmIndex),
                  ),
                }
              : {}),
          };
        })
        .filter((t) => t.name)
    : [];

  const inventory: InventoryItem[] = Array.isArray(r.inventory)
    ? r.inventory
        .filter((i) => i && typeof i === 'object')
        .map((i, idx) => {
          const item = i as Record<string, unknown>;
          return {
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `inv_${Date.now()}_${idx}`,
            name: String(item.name || '').trim(),
            quantity:
              typeof item.quantity === 'number' &&
              Number.isFinite(item.quantity)
                ? Math.max(1, Math.trunc(item.quantity))
                : 1,
            quality: VALID_INV_QUALITIES.has(
              item.quality as InventoryItemQuality,
            )
              ? (item.quality as InventoryItemQuality)
              : 'common',
            category: VALID_INV_CATEGORIES.has(
              item.category as InventoryItemCategory,
            )
              ? (item.category as InventoryItemCategory)
              : 'misc',
            ...(typeof item.description === 'string' && item.description.trim()
              ? { description: item.description.trim() }
              : {}),
            ...(VALID_EQUIPMENT_SLOTS.has(item.equipSlot as EquipmentSlotId)
              ? { equipSlot: item.equipSlot as EquipmentSlotId }
              : {}),
          };
        })
        .filter((i) => i.name && !isJunkInventoryItemName(i.name))
    : [];

  const invIds = new Set(inventory.map((i) => i.id));
  const rawEquipment =
    r.equipment && typeof r.equipment === 'object'
      ? (r.equipment as Record<string, unknown>)
      : null;
  const equipment: EquipmentMap = {};
  if (rawEquipment) {
    for (const slot of EQUIPMENT_SLOT_ORDER) {
      const boundId = rawEquipment[slot];
      if (typeof boundId === 'string' && invIds.has(boundId)) {
        equipment[slot] = boundId;
      }
    }
  }

  const rawVitals =
    r.vitals && typeof r.vitals === 'object'
      ? (r.vitals as Record<string, unknown>)
      : null;
  const vitals: CharacterVitalsState | undefined = rawVitals
    ? {
        ...(typeof rawVitals.hp === 'number' && Number.isFinite(rawVitals.hp)
          ? { hp: Math.max(0, Math.round(rawVitals.hp)) }
          : {}),
        ...(typeof rawVitals.qi === 'number' && Number.isFinite(rawVitals.qi)
          ? { qi: Math.max(0, Math.round(rawVitals.qi)) }
          : {}),
        ...(typeof rawVitals.spirit === 'number' &&
        Number.isFinite(rawVitals.spirit)
          ? { spirit: Math.max(0, Math.round(rawVitals.spirit)) }
          : {}),
        ...(typeof rawVitals.pillToxicity === 'number' &&
        Number.isFinite(rawVitals.pillToxicity)
          ? {
              pillToxicity: Math.max(
                0,
                Math.min(100, Math.round(rawVitals.pillToxicity)),
              ),
            }
          : {}),
        ...(typeof rawVitals.breakthroughEase === 'number' &&
        Number.isFinite(rawVitals.breakthroughEase)
          ? {
              breakthroughEase: Math.max(
                0,
                Math.min(100, Math.round(rawVitals.breakthroughEase)),
              ),
            }
          : {}),
        ...(typeof rawVitals.bonusAtk === 'number' &&
        Number.isFinite(rawVitals.bonusAtk)
          ? { bonusAtk: Math.max(0, Math.round(rawVitals.bonusAtk)) }
          : {}),
        ...(typeof rawVitals.bonusDef === 'number' &&
        Number.isFinite(rawVitals.bonusDef)
          ? { bonusDef: Math.max(0, Math.round(rawVitals.bonusDef)) }
          : {}),
        ...(typeof rawVitals.bonusAgi === 'number' &&
        Number.isFinite(rawVitals.bonusAgi)
          ? { bonusAgi: Math.max(0, Math.round(rawVitals.bonusAgi)) }
          : {}),
        ...(typeof rawVitals.bonusInsight === 'number' &&
        Number.isFinite(rawVitals.bonusInsight)
          ? { bonusInsight: Math.max(0, Math.round(rawVitals.bonusInsight)) }
          : {}),
        ...(typeof rawVitals.fame === 'number' &&
        Number.isFinite(rawVitals.fame)
          ? { fame: Math.max(0, Math.round(rawVitals.fame)) }
          : {}),
        ...(Array.isArray(rawVitals.activeBuffs)
          ? {
              activeBuffs: rawVitals.activeBuffs
                .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
                .map((b) => b.trim())
                .slice(0, 6),
            }
          : {}),
      }
    : undefined;

  const rawRankings: CultivationRankingEntry[] = Array.isArray(r.rankings)
    ? r.rankings
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry, idx) => {
          const item = entry as Record<string, unknown>;
          const board: CultivationRankingBoard = VALID_RANKING_BOARDS.has(
            item.board as CultivationRankingBoard,
          )
            ? (item.board as CultivationRankingBoard)
            : 'nhan';
          const rank =
            typeof item.rank === 'number' && Number.isFinite(item.rank)
              ? Math.max(1, Math.min(MAX_RANKING_ENTRIES_PER_BOARD, Math.trunc(item.rank)))
              : Math.min(MAX_RANKING_ENTRIES_PER_BOARD, idx + 1);
          const prodigyTier =
            board === 'thien_kieu' &&
            VALID_PRODIGY_TIERS.has(item.prodigyTier as ProdigyTier)
              ? (item.prodigyTier as ProdigyTier)
              : board === 'thien_kieu'
                ? 'tre_the_gia'
                : undefined;
          const scopeLabel =
            typeof item.scopeLabel === 'string' && item.scopeLabel.trim()
              ? item.scopeLabel.trim()
              : undefined;
          const isVeteran =
            typeof item.isVeteran === 'boolean'
              ? item.isVeteran
              : board !== 'thien_kieu'
                ? undefined
                : false;
          const intelUnlocked =
            typeof item.intelUnlocked === 'boolean'
              ? item.intelUnlocked
              : true;
          const optStr = (v: unknown) =>
            typeof v === 'string' && v.trim() ? v.trim() : undefined;
          const optNum = (v: unknown) =>
            typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined;
          return {
            id:
              typeof item.id === 'string' && item.id
                ? item.id
                : `rank_${Date.now()}_${idx}`,
            board,
            rank,
            name: String(item.name || '').trim(),
            realm: String(item.realm || '').trim(),
            combatPower: String(item.combatPower || '').trim(),
            faction: String(item.faction || '').trim(),
            stance: String(item.stance || '').trim(),
            intelUnlocked,
            ...(prodigyTier ? { prodigyTier } : {}),
            ...(scopeLabel ? { scopeLabel } : {}),
            ...(typeof isVeteran === 'boolean' ? { isVeteran } : {}),
            ...(optStr(item.rumorSummary)
              ? { rumorSummary: optStr(item.rumorSummary) }
              : {}),
            ...(optStr(item.origin) ? { origin: optStr(item.origin) } : {}),
            ...(optStr(item.techniquesOrBloodline)
              ? { techniquesOrBloodline: optStr(item.techniquesOrBloodline) }
              : {}),
            ...(optStr(item.deeds) ? { deeds: optStr(item.deeds) } : {}),
            ...(optStr(item.latestActivity)
              ? { latestActivity: optStr(item.latestActivity) }
              : {}),
            ...(optNum(item.powerScore) !== undefined
              ? { powerScore: optNum(item.powerScore) }
              : {}),
            ...(optNum(item.fameScore) !== undefined
              ? { fameScore: optNum(item.fameScore) }
              : {}),
            ...(optNum(item.previousRank) !== undefined
              ? { previousRank: optNum(item.previousRank) }
              : {}),
            ...(typeof item.isMc === 'boolean' ? { isMc: item.isMc } : {}),
            ...(optStr(item.lastUpdatedClock)
              ? { lastUpdatedClock: optStr(item.lastUpdatedClock) }
              : {}),
            ...(typeof item.updatedAt === 'number' &&
            Number.isFinite(item.updatedAt)
              ? { updatedAt: item.updatedAt }
              : {}),
          };
        })
        .filter((entry) => entry.name)
    : [];

  const rankings = enforceTopTenPerBoard(rawRankings);

  const combatPowerNote =
    typeof r.combatPowerNote === 'string' && r.combatPowerNote.trim()
      ? r.combatPowerNote.trim()
      : undefined;

  return {
    schemaVersion: CULTIVATION_SCHEMA_VERSION,
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    systemKind,
    realmIndex: migrated.realmIndex,
    realmName: migrated.realmName,
    majorRealm: migrated.majorRealm,
    subStage: migrated.subStage,
    ...(typeof migrated.minorTier === 'number'
      ? { minorTier: migrated.minorTier }
      : {}),
    energyLabel:
      typeof r.energyLabel === 'string' && r.energyLabel.trim()
        ? r.energyLabel.trim()
        : meta.energyLabel,
    exp,
    maxExp,
    overflowExp,
    readyToBreakthrough,
    autoProgressByClock:
      typeof r.autoProgressByClock === 'boolean' ? r.autoProgressByClock : true,
    quickTrainLocked:
      typeof r.quickTrainLocked === 'boolean' ? r.quickTrainLocked : true,
    bagName:
      typeof r.bagName === 'string' && r.bagName.trim()
        ? r.bagName.trim()
        : meta.bagName,
    ...(combatPowerNote ? { combatPowerNote } : {}),
    techniques,
    inventory,
    ...(Object.keys(equipment).length > 0 ? { equipment } : {}),
    ...(vitals && Object.keys(vitals).length > 0 ? { vitals } : {}),
    constitution: normalizeConstitutionState(
      r.constitution,
      systemKind,
      migrated.realmIndex,
    ),
    ...(systemKind === 'wuxia'
      ? {
          wuxiaState: normalizeWuxiaState(r.wuxiaState, migrated.realmIndex),
        }
      : {}),
    ...(typeof r.reduceRealmEffects === 'boolean'
      ? { reduceRealmEffects: r.reduceRealmEffects }
      : {}),
    ...(rankings.length > 0 ? { rankings } : {}),
    ...(typeof r.lastGainSummary === 'string' && r.lastGainSummary.trim()
      ? { lastGainSummary: r.lastGainSummary.trim() }
      : {}),
    ...(typeof r.lastSeclusionSummary === 'string' &&
    r.lastSeclusionSummary.trim()
      ? { lastSeclusionSummary: r.lastSeclusionSummary.trim() }
      : {}),
    ...(typeof r.lastItemFeedback === 'string' &&
    r.lastItemFeedback.trim()
      ? { lastItemFeedback: r.lastItemFeedback.trim() }
      : {}),
    ...(typeof r.lastBreakthroughNote === 'string' &&
    r.lastBreakthroughNote.trim()
      ? { lastBreakthroughNote: r.lastBreakthroughNote.trim() }
      : {}),
    ...(r.lastBreakthroughOutcome &&
    typeof r.lastBreakthroughOutcome === 'object' &&
    ((r.lastBreakthroughOutcome as Partial<BreakthroughOutcomeRecord>).outcome ===
      'success' ||
      (r.lastBreakthroughOutcome as Partial<BreakthroughOutcomeRecord>).outcome ===
        'failed') &&
    typeof (r.lastBreakthroughOutcome as Partial<BreakthroughOutcomeRecord>).summary ===
      'string'
      ? {
          lastBreakthroughOutcome: {
            outcome: (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
              .outcome,
            ...(typeof (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
              .severity === 'string'
              ? {
                  severity: (
                    r.lastBreakthroughOutcome as BreakthroughOutcomeRecord
                  ).severity,
                }
              : {}),
            chancePercent: Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  Number(
                    (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                      .chancePercent,
                  ) || 0,
                ),
              ),
            ),
            ...(typeof (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
              .roll === 'number' &&
            Number.isFinite(
              (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord).roll,
            )
              ? {
                  roll: Math.round(
                    (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                      .roll!,
                  ),
                }
              : {}),
            fromRealm: String(
              (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                .fromRealm || migrated.realmName,
            ).trim(),
            targetRealm: String(
              (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                .targetRealm || migrated.realmName,
            ).trim(),
            ...(typeof (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
              .assistItemName === 'string' &&
            (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
              .assistItemName!.trim()
              ? {
                  assistItemName: (
                    r.lastBreakthroughOutcome as BreakthroughOutcomeRecord
                  ).assistItemName!.trim(),
                }
              : {}),
            summary: String(
              (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord).summary,
            ).trim(),
            consequences: Array.isArray(
              (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                .consequences,
            )
              ? (
                  r.lastBreakthroughOutcome as BreakthroughOutcomeRecord
                ).consequences
                  .map((c) => String(c || '').trim())
                  .filter(Boolean)
                  .slice(0, 6)
              : [],
            storyPrompt: String(
              (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                .storyPrompt || '',
            ).trim(),
            timestamp:
              typeof (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                .timestamp === 'number' &&
              Number.isFinite(
                (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                  .timestamp,
              )
                ? (r.lastBreakthroughOutcome as BreakthroughOutcomeRecord)
                    .timestamp
                : Date.now(),
          },
        }
      : {}),
    ...(typeof r.lastUpdatedAt === 'number' && Number.isFinite(r.lastUpdatedAt)
      ? { lastUpdatedAt: r.lastUpdatedAt }
      : {}),
  };
}

export interface CultivationDisplayInfo {
  majorRealm: string;
  subStage: CultivationSubStage;
  minorTier?: number;
  fullLabel: string;
  compactLabel: string;
  subStageIndex: number; // 0..3 corresponding to Sơ/Trung/Hậu/Đỉnh phong
  isMaxStage: boolean;
  overflowExp: number;
  maxOverflowExp: number;
}

/**
 * Returns unified display labels reflecting BOTH Major Realm (Đại cảnh giới)
 * and Sub-Stage (Sơ kỳ / Trung kỳ / Hậu kỳ / Đỉnh phong) for Lobby, Save Slots,
 * Chat header, CultivationPanel, and AI prompt context.
 */
export function getCultivationDisplayInfo(
  profile: CultivationProfile,
): CultivationDisplayInfo {
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  const safeIdx = Math.max(0, Math.min(realms.length - 1, profile.realmIndex));
  const stage = realms[safeIdx] || realms[0];

  const majorRealm =
    profile.majorRealm?.trim() ||
    extractCustomMajorRealm(profile.realmName, stage.majorRealm);
  const subStage: CultivationSubStage = VALID_SUB_STAGES.has(
    profile.subStage as CultivationSubStage,
  )
    ? (profile.subStage as CultivationSubStage)
    : parseSubStageFromText(profile.realmName) || stage.subStage;
  const minorTier =
    typeof profile.minorTier === 'number' && Number.isFinite(profile.minorTier)
      ? profile.minorTier
      : stage.minorTier;

  const isCanonicalName =
    profile.realmName.trim().toLowerCase() === stage.name.toLowerCase();

  let fullLabel: string;
  if (!isCanonicalName && profile.realmName.trim()) {
    const hasSubInName = Boolean(parseSubStageFromText(profile.realmName));
    fullLabel = hasSubInName
      ? profile.realmName.trim()
      : `${profile.realmName.trim()} · ${subStage}`;
  } else if (typeof minorTier === 'number') {
    fullLabel = `${majorRealm} Tầng ${minorTier} (${subStage})`;
  } else {
    fullLabel = `${majorRealm} ${subStage}`;
  }

  const compactLabel =
    typeof minorTier === 'number'
      ? `${majorRealm} T${minorTier} · ${subStage}`
      : `${majorRealm} · ${subStage}`;

  const subStageIndex = Math.max(0, CULTIVATION_SUB_STAGES.indexOf(subStage));
  const maxOverflowExp = getMaxOverflowExp(profile.maxExp);
  const overflowExp =
    profile.exp >= profile.maxExp
      ? Math.max(0, Math.min(maxOverflowExp, Math.round(profile.overflowExp || 0)))
      : 0;

  // Wuxia (Kiếm hiệp): display authentic Cửu Âm internal-art layer & strength title
  if (profile.systemKind === 'wuxia') {
    const ws = normalizeWuxiaState(profile.wuxiaState, safeIdx);
    const tier = getWuxiaTitleByLayer(ws.innerLayer);
    return {
      majorRealm: tier.title,
      subStage: tier.subStage,
      minorTier: ws.innerLayer,
      fullLabel: `${tier.title} (Tầng ${ws.innerLayer})`,
      compactLabel: `Tầng ${ws.innerLayer} · ${tier.title}`,
      subStageIndex: Math.max(0, CULTIVATION_SUB_STAGES.indexOf(tier.subStage)),
      isMaxStage: safeIdx >= realms.length - 1 && ws.innerLayer >= ws.innerMaxLayer,
      overflowExp,
      maxOverflowExp,
    };
  }

  return {
    majorRealm,
    subStage,
    ...(typeof minorTier === 'number' ? { minorTier } : {}),
    fullLabel,
    compactLabel,
    subStageIndex,
    isMaxStage: safeIdx >= realms.length - 1,
    overflowExp,
    maxOverflowExp,
  };
}

export function getNextRealmStage(profile: CultivationProfile): RealmStage | null {
  if (profile.systemKind === 'wuxia') {
    const ceiling = getWuxiaInnerArtCeilingInfo(profile);
    if (ceiling.isAtArtCeiling) return null;
  }
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  if (profile.realmIndex + 1 < realms.length) {
    return realms[profile.realmIndex + 1];
  }
  return null;
}

export interface CultivationExpGainResult {
  nextProfile: CultivationProfile;
  requestedDelta: number;
  appliedExp: number;
  appliedOverflow: number;
  totalEffectiveGain: number;
  hitCap: boolean;
  becameReadyToBreakthrough: boolean;
}

/**
 * Single centralized EXP mutator with STRICT anti-realm-skipping guarantees:
 * - NEVER modifies realmIndex / majorRealm / subStage / minorTier / realmName.
 * - Caps any single EXP event at 100% of current stage maxExp.
 * - Clamps `exp` strictly to [0, maxExp].
 * - Routes surplus above maxExp into bounded `overflowExp` (<= 50% of maxExp)
 *   waiting for explicit 1-step breakthrough.
 */
export function applyCultivationExpGain(
  profile: CultivationProfile,
  rawDelta: number,
  options?: {
    sourceLabel?: string;
    allowUnlimitedSingleEvent?: boolean;
  },
): CultivationExpGainResult {
  const maxExp = Math.max(10, Math.round(profile.maxExp || 100));
  const maxOverflow = getMaxOverflowExp(maxExp);
  const currentExp = Math.max(0, Math.min(maxExp, Math.round(profile.exp || 0)));
  const currentOverflow =
    currentExp >= maxExp
      ? Math.max(0, Math.min(maxOverflow, Math.round(profile.overflowExp || 0)))
      : 0;
  const wasReady = currentExp >= maxExp;

  const requestedDelta = Number.isFinite(rawDelta) ? Math.round(rawDelta) : 0;

  // Handle manual subtraction cleanly
  if (requestedDelta < 0) {
    let toRemove = Math.abs(requestedDelta);
    const removedFromOverflow = Math.min(currentOverflow, toRemove);
    const nextOverflow = currentOverflow - removedFromOverflow;
    toRemove -= removedFromOverflow;
    const removedFromExp = Math.min(currentExp, toRemove);
    const nextExp = Math.max(0, currentExp - removedFromExp);
    const finalOverflow = nextExp >= maxExp ? nextOverflow : 0;
    const nextReady = nextExp >= maxExp;
    return {
      nextProfile: {
        ...profile,
        schemaVersion: CULTIVATION_SCHEMA_VERSION,
        exp: nextExp,
        maxExp,
        overflowExp: finalOverflow,
        readyToBreakthrough: nextReady,
        ...(options?.sourceLabel
          ? {
              lastGainSummary: `${requestedDelta} ${profile.energyLabel.split('/')[0].trim()} (${options.sourceLabel})`,
            }
          : {}),
        lastUpdatedAt: Date.now(),
      },
      requestedDelta,
      appliedExp: -removedFromExp,
      appliedOverflow: -removedFromOverflow,
      totalEffectiveGain: -(removedFromExp + removedFromOverflow),
      hitCap: false,
      becameReadyToBreakthrough: false,
    };
  }

  if (requestedDelta === 0) {
    return {
      nextProfile: {
        ...profile,
        schemaVersion: CULTIVATION_SCHEMA_VERSION,
        exp: currentExp,
        maxExp,
        overflowExp: currentOverflow,
        readyToBreakthrough: wasReady,
      },
      requestedDelta: 0,
      appliedExp: 0,
      appliedOverflow: 0,
      totalEffectiveGain: 0,
      hitCap: currentExp >= maxExp && currentOverflow >= maxOverflow,
      becameReadyToBreakthrough: false,
    };
  }

  const singleEventCap = options?.allowUnlimitedSingleEvent
    ? requestedDelta
    : Math.max(1, Math.round(maxExp * SINGLE_EVENT_EXP_CAP_RATIO));
  const boundedGain = Math.min(singleEventCap, requestedDelta);

  const roomInStage = Math.max(0, maxExp - currentExp);
  const appliedExp = Math.min(roomInStage, boundedGain);
  const nextExp = currentExp + appliedExp; // Strictly <= maxExp

  const leftover = boundedGain - appliedExp;
  const overflowRoom =
    nextExp >= maxExp ? Math.max(0, maxOverflow - currentOverflow) : 0;
  const appliedOverflow = Math.min(overflowRoom, leftover);
  const nextOverflow =
    nextExp >= maxExp ? currentOverflow + appliedOverflow : 0;

  const totalEffectiveGain = appliedExp + appliedOverflow;
  const nextReady = nextExp >= maxExp;
  const becameReadyToBreakthrough = !wasReady && nextReady;
  const hitCap =
    nextExp >= maxExp &&
    (nextOverflow >= maxOverflow || boundedGain > totalEffectiveGain || appliedOverflow > 0);

  let lastGainSummary = profile.lastGainSummary;
  if (options?.sourceLabel) {
    const energyShort = profile.energyLabel.split('/')[0].trim();
    if (totalEffectiveGain <= 0 && nextExp >= maxExp) {
      lastGainSummary = `Tu vi đã chạm đỉnh giai đoạn (dư tối đa +${nextOverflow}) — cần đột phá để tiến lên (${options.sourceLabel})`;
    } else if (appliedOverflow > 0) {
      lastGainSummary = `+${appliedExp} ${energyShort}, dồn +${appliedOverflow} dư chờ đột phá (${options.sourceLabel})`;
    } else {
      lastGainSummary = `+${appliedExp} ${energyShort} (${options.sourceLabel})`;
    }
  }

  return {
    nextProfile: {
      ...profile,
      schemaVersion: CULTIVATION_SCHEMA_VERSION,
      exp: nextExp,
      maxExp,
      overflowExp: nextOverflow,
      readyToBreakthrough: nextReady,
      ...(lastGainSummary ? { lastGainSummary } : {}),
      lastUpdatedAt: Date.now(),
    },
    requestedDelta,
    appliedExp,
    appliedOverflow,
    totalEffectiveGain,
    hitCap,
    becameReadyToBreakthrough,
  };
}

/**
 * Returns realistic baseline active-seclusion days required to fill 100% of the current sub-stage
 * by genre and realm index:
 * - Kiếm hiệp (wuxia): measured in MONTHS (1.5 -> 30 months).
 * - Tiên hiệp (xianxia): measured in YEARS (Luyện Khí ~0.35–1.8y, Trúc Cơ ~3.5–7y, Kim Đan ~8–16y, Nguyên Anh+ ~20–220y).
 * - Huyền huyễn (xuanhuan): measured in MONTHS/YEARS (early 3–10 months, mid 1–4 years, high 5–60 years).
 */
export function getExpectedActiveSeclusionDaysForStage(
  profile: CultivationProfile,
): number {
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  const idx = Math.max(0, Math.min(realms.length - 1, profile.realmIndex));

  if (profile.systemKind === 'wuxia') {
    const months = 1.5 + Math.pow(idx / 3.2, 1.38) * 1.4;
    return Math.max(45, Math.min(30 * 36, Math.round(months * 30)));
  }

  if (profile.systemKind === 'xuanhuan') {
    const days = 90 * Math.pow(1.21, idx);
    return Math.max(90, Math.min(365 * 80, Math.round(days)));
  }

  // Xianxia: strictly year-scale progression
  if (idx <= 9) {
    const years = 0.35 + idx * 0.16;
    return Math.max(120, Math.round(years * 365));
  }
  const aboveTrucCo = idx - 10;
  const years = 3.5 * Math.pow(1.24, aboveTrucCo);
  return Math.max(365 * 3, Math.min(365 * 220, Math.round(years * 365)));
}

/**
 * Automatically advances Realm EXP & Technique Mastery when Story Clock moves forward.
 * Enforces genre-authentic time pacing (Wuxia = months, Xianxia = years, Xuanhuan = months/years),
 * keeps short sessions (e.g. 8 hours) to tiny/symbolic gains, and NEVER skips realms/stages.
 */
export function applyClockDeltaToCultivation(
  profile: CultivationProfile | undefined,
  deltaMinutes: number,
  options?: {
    sceneText?: string;
    reason?: string;
    forceActiveTraining?: boolean;
    isSeclusionJump?: boolean;
    periodLabel?: string;
    clockRangeLabel?: string;
  },
): {
  nextProfile: CultivationProfile | undefined;
  expGained: number;
  overflowAdded: number;
  hitCap: boolean;
  leveledTechniques: string[];
  leveledMoves: string[];
  lockedTechniques: string[];
  lockedMoves: string[];
  masteryProgressNotes: string[];
  becameReadyToBreakthrough: boolean;
  seclusionSummary?: string;
} {
  if (
    !profile ||
    !profile.enabled ||
    (!options?.forceActiveTraining && !profile.autoProgressByClock) ||
    !Number.isFinite(deltaMinutes) ||
    deltaMinutes <= 0
  ) {
    return {
      nextProfile: profile,
      expGained: 0,
      overflowAdded: 0,
      hitCap: false,
      leveledTechniques: [],
      leveledMoves: [],
      lockedTechniques: [],
      lockedMoves: [],
      masteryProgressNotes: [],
      becameReadyToBreakthrough: false,
    };
  }

  const mins = Math.max(1, Math.round(deltaMinutes));
  const sceneLower = (options?.sceneText || '').toLowerCase();

  // Detect active cultivation / martial training / combat / major fortuitous cues
  const isMeditating =
    Boolean(options?.forceActiveTraining) ||
    /(?:tu luyện|bế quan|đả tọa|vận công|hấp thu linh khí|tụ khí|thiền định|điều tức|luyện khí|luyện công|ngồi thiền)/i.test(
      sceneLower,
    );
  const isPracticingCombat =
    Boolean(options?.forceActiveTraining) ||
    /(?:luyện kiếm|luyện võ|diễn võ|giao thủ|tỷ thí|chiến đấu|xuất chiêu|đấu pháp|đánh nhau|chém|đâm|né tránh|khinh công|thân pháp)/i.test(
      sceneLower,
    );
  const hasMajorCatalyst =
    !options?.isSeclusionJump &&
    /(?:đan dược|linh đan|thánh đan|huyết mạch|cơ duyên|kỳ ngộ|thiên tài địa bảo|linh tuyền|tẩy tủy|trúc cơ đan|long huyết|phượng huyết)/i.test(
      sceneLower,
    );

  // Active mental/primary technique multiplier (gently bounded so tier accelerates without breaking scale)
  const activeTechniques = profile.techniques.filter((t) => t.isActiveTraining);
  const bestActiveTierMult = activeTechniques.reduce((best, t) => {
    const rawMult = TECHNIQUE_TIER_META[t.tier]?.speedMultiplier || 1;
    // Compress speedMultiplier slightly for long-horizon balance (1.0 .. 1.65)
    const balancedMult = 1 + (rawMult - 1) * 0.65;
    return Math.max(best, balancedMult);
  }, 1.0);

  const rawDays = mins / 1440;
  const expectedStageDays = getExpectedActiveSeclusionDaysForStage(profile);

  // Activity factor: dedicated seclusion = 1.0, in-turn meditation = 0.75, combat = 0.45, passive daily life = 0.14
  const activityFactor = options?.isSeclusionJump
    ? 1.0
    : options?.forceActiveTraining
      ? 0.85
      : isMeditating
        ? 0.72
        : isPracticingCombat
          ? 0.42
          : 0.14;

  const catalystMult = hasMajorCatalyst
    ? profile.systemKind === 'xuanhuan'
      ? 1.45
      : 1.25
    : 1.0;

  const wuxiaTraining =
    profile.systemKind === 'wuxia'
      ? computeWuxiaTrainingMultiplier(profile, options?.sceneText)
      : { multiplier: 1.0 };

  const stageProgressRatio =
    (rawDays / expectedStageDays) *
    activityFactor *
    bestActiveTierMult *
    catalystMult *
    wuxiaTraining.multiplier;

  let rawExpGain = stageProgressRatio * profile.maxExp;

  // Hard ceiling for short sessions (<= 24 hours without explicit major catalyst) so 8 hours NEVER spikes the bar
  if (mins <= 1440 && !hasMajorCatalyst) {
    const shortRatioCap =
      profile.systemKind === 'wuxia'
        ? 0.025
        : profile.systemKind === 'xuanhuan'
          ? 0.015
          : 0.008;
    const maxShortExp = Math.max(
      profile.systemKind === 'xianxia' ? 2 : 3,
      Math.round(profile.maxExp * shortRatioCap),
    );
    rawExpGain = Math.min(rawExpGain, maxShortExp);
  }

  // Minimum symbolic progress for dedicated training >= 30 mins (1..2 EXP), or passive turns >= 60 mins
  const minSymbolic =
    options?.forceActiveTraining && mins >= 30
      ? 1
      : isMeditating && mins >= 45
        ? 1
        : mins >= 180
          ? 1
          : 0;

  const cappedClockExp = Math.max(
    minSymbolic,
    Math.min(Math.round(profile.maxExp), Math.round(rawExpGain)),
  );

  // Route strictly through centralized anti-skip EXP gain helper (NEVER auto-advances realmIndex)
  const expCalc = applyCultivationExpGain(profile, cappedClockExp);
  const expGained = expCalc.totalEffectiveGain;
  const overflowAdded = expCalc.appliedOverflow;
  const becameReadyToBreakthrough = expCalc.becameReadyToBreakthrough;

  const leveledTechniques: string[] = [];
  const leveledMoves: string[] = [];
  const lockedTechniques: string[] = [];
  const lockedMoves: string[] = [];
  const masteryHighlights: string[] = [];
  const masteryProgressNotes: string[] = [];

  // Narrative quality cues from the actual story turn so training in chat updates mastery authentically
  const hasStoryInsightCue =
    !options?.isSeclusionJump &&
    /(?:cảm ngộ|ngộ ra|đốn ngộ|thông suốt|thuần thục hơn|nhuần nhuyễn|tinh tiến|tiến bộ rõ|lĩnh ngộ|được chỉ điểm|điểm hóa|linh thạch|đan dược|đột phá)/i.test(
      sceneLower,
    );
  const hasStoryInterruptionCue =
    !options?.isSeclusionJump &&
    /(?:tẩu hỏa|gián đoạn|bị cắt ngang|thất bại|phản phệ|khí tức hỗn loạn|chưa thể tập trung|bị thương nặng)/i.test(
      sceneLower,
    );
  const storyOutcomeMult = hasStoryInterruptionCue
    ? 0.45
    : hasStoryInsightCue
      ? 1.45
      : 1.0;

  // Fallback: if no technique is marked isActiveTraining, passively grow the first mental technique (or first technique)
  const fallbackActiveId =
    activeTechniques.length === 0
      ? (
          profile.techniques.find((t) => t.category === 'mental') ||
          profile.techniques[0]
        )?.id
      : undefined;

  // Story-grounded mastery pacing:
  // - Passive/unmentioned short sessions: gentle +1..2%
  // - Explicitly practiced technique/move in story chat: natural +3..8% depending on time & narrative insight
  // - Multi-month (Kiếm hiệp) / Multi-year (Tiên hiệp / Huyền huyễn): steady meaningful gain, stopping cleanly at 99% bottleneck
  const masteryUnitDays =
    profile.systemKind === 'wuxia'
      ? 45
      : profile.systemKind === 'xuanhuan'
        ? 180
        : 360;
  const normalizedMasteryUnits =
    rawDays <= 1
      ? rawDays * 0.45
      : 0.45 + Math.pow(rawDays / masteryUnitDays, 0.72) * 18;

  const moveUnitDays =
    profile.systemKind === 'wuxia'
      ? 30
      : profile.systemKind === 'xuanhuan'
        ? 90
        : 180;
  const normalizedMoveUnits =
    rawDays <= 1
      ? rawDays * 0.55
      : 0.55 + Math.pow(rawDays / moveUnitDays, 0.7) * 16;

  const nextTechniques = profile.techniques.map((tech) => {
    const nameLower = tech.name.toLowerCase();
    const mentionedInScene =
      nameLower.length >= 3 && sceneLower.includes(nameLower);
    const isPrimary = tech.isActiveTraining || tech.id === fallbackActiveId;
    const categoryBoost =
      (isMeditating && tech.category === 'mental') ||
      (isPracticingCombat &&
        (tech.category === 'martial' || tech.category === 'movement')) ||
      mentionedInScene;

    // 1) Independent Child Move Progression (decoupled from parent technique, stops cleanly at 99% bottleneck)
    let nextMoves = tech.moves;
    if (tech.moves && tech.moves.length > 0) {
      let movesChanged = false;
      const evaluatedMoves = tech.moves.map((mv, mvIdx) => {
        const mvMentioned =
          mv.name.length >= 3 && sceneLower.includes(mv.name.toLowerCase());
        const movePracticed =
          mvMentioned ||
          (isPrimary && (isPracticingCombat || isMeditating || options?.isSeclusionJump)) ||
          (categoryBoost && (isPracticingCombat || rawDays >= 7));
        if (!movePracticed) return mv;

        const positionWeight = mvIdx === 0 ? 1.1 : mvIdx === 1 ? 0.95 : 0.75;
        let mvRawGain = 0;
        if (mvMentioned) {
          // Focused practice of this exact move in the story turn!
          const storyMoveBase = Math.max(4, normalizedMoveUnits * 2.1);
          mvRawGain += storyMoveBase * storyOutcomeMult;
        } else if (isPrimary) {
          mvRawGain += normalizedMoveUnits * (options?.isSeclusionJump ? 1.05 : 0.7) * positionWeight;
        } else if (categoryBoost) {
          mvRawGain += normalizedMoveUnits * 0.5 * positionWeight;
        }

        const mvMaxCap = options?.isSeclusionJump
          ? 38
          : mins <= 480
            ? mvMentioned
              ? hasStoryInsightCue
                ? 10
                : 7
              : 2
            : mins <= 1440
              ? mvMentioned
                ? hasStoryInsightCue
                  ? 12
                  : 9
                : 3
              : 26;

        const mvDelta = Math.max(
          mvMentioned ? 1 : isPrimary && mins >= 180 ? 1 : 0,
          Math.min(mvMaxCap, Math.round(mvRawGain)),
        );
        if (mvDelta <= 0) return mv;

        const mvRes = applyMoveMasteryDelta(mv, tech, mvDelta, profile, {
          sceneText: options?.sceneText,
        });
        if (mvRes.hitNewLock || (mvRes.blockedByLock && (mvMentioned || options?.isSeclusionJump))) {
          const tag = `${mv.name} (Bình cảnh 99%)`;
          if (!lockedMoves.includes(tag) && lockedMoves.length < 4) {
            lockedMoves.push(tag);
          }
        }
        if (mvRes.appliedDelta > 0) {
          if (mvMentioned && masteryProgressNotes.length < 4) {
            masteryProgressNotes.push(
              `${mv.name} +${mvRes.appliedDelta}%${mvRes.hitNewLock ? ' (chạm bình cảnh)' : ''}`,
            );
          }
          movesChanged = true;
          return mvRes.nextMove;
        }
        if (mvRes.nextMove !== mv) {
          movesChanged = true;
          return mvRes.nextMove;
        }
        return mv;
      });
      if (movesChanged) {
        nextMoves = evaluatedMoves;
      }
    }

    // 2) Independent Parent Technique Progression (stops cleanly at 99% bottleneck)
    if (!isPrimary && !categoryBoost && rawDays < 7) {
      return nextMoves !== tech.moves ? { ...tech, moves: nextMoves } : tech;
    }

    let gainBase = 0;
    if (isPrimary) {
      gainBase += normalizedMasteryUnits * (options?.isSeclusionJump ? 1.35 : isMeditating ? 1.1 : 0.75);
    }
    if (mentionedInScene) {
      const storyTechBase = Math.max(3.5, normalizedMasteryUnits * 1.85);
      gainBase += storyTechBase * storyOutcomeMult;
    } else if (categoryBoost) {
      gainBase += normalizedMasteryUnits * 0.5;
    } else if (rawDays >= 7) {
      gainBase += normalizedMasteryUnits * 0.22;
    }

    const maxTechCap = options?.isSeclusionJump
      ? 45
      : mins <= 480
        ? mentionedInScene
          ? hasStoryInsightCue
            ? 8
            : 6
          : 2
        : mins <= 1440
          ? mentionedInScene
            ? hasStoryInsightCue
              ? 10
              : 7
            : 3
          : 28;

    const techDelta = Math.max(
      mentionedInScene ? 1 : isPrimary && mins >= 90 ? 1 : 0,
      Math.min(maxTechCap, Math.round(gainBase)),
    );

    if (techDelta <= 0) {
      return nextMoves !== tech.moves ? { ...tech, moves: nextMoves } : tech;
    }

    const techRes = applyTechniqueMasteryDelta(tech, techDelta, profile, {
      sceneText: options?.sceneText,
    });

    if (techRes.hitNewLock || (techRes.blockedByLock && (isPrimary || mentionedInScene))) {
      const lockTag = `${tech.name} (Bình cảnh 99%)`;
      if (!lockedTechniques.includes(lockTag)) {
        lockedTechniques.push(lockTag);
      }
    }

    if (techRes.appliedDelta > 0) {
      const note = `${tech.name} +${techRes.appliedDelta}%${techRes.hitNewLock ? ' (chạm bình cảnh)' : ''}`;
      if (masteryHighlights.length < 2) {
        masteryHighlights.push(note);
      }
      if (mentionedInScene && masteryProgressNotes.length < 4) {
        masteryProgressNotes.push(note);
      }
    }

    return {
      ...techRes.nextTech,
      ...(nextMoves ? { moves: nextMoves } : {}),
    };
  });

  const energyShort = profile.energyLabel.split('/')[0].trim();
  const summaryParts: string[] = [];
  if (expCalc.appliedExp > 0 && expCalc.appliedOverflow > 0) {
    summaryParts.push(
      `+${expCalc.appliedExp} ${energyShort} (dồn +${expCalc.appliedOverflow} dư chờ đột phá)`,
    );
  } else if (expCalc.appliedExp > 0) {
    summaryParts.push(`+${expCalc.appliedExp} ${energyShort}`);
  } else if (expCalc.appliedOverflow > 0) {
    summaryParts.push(`+${expCalc.appliedOverflow} ${energyShort} dư chờ đột phá`);
  } else if (expCalc.nextProfile.readyToBreakthrough) {
    summaryParts.push('Tu vi đã chạm bình cảnh — chờ chủ động đột phá');
  }

  if (masteryHighlights.length > 0) {
    summaryParts.push(masteryHighlights.join(' · '));
  }
  if (lockedTechniques.length > 0) {
    summaryParts.push(`Công pháp chạm bình cảnh: ${lockedTechniques.slice(0, 2).join(', ')}`);
  }
  if (lockedMoves.length > 0) {
    summaryParts.push(`Chiêu thức chạm bình cảnh: ${lockedMoves.slice(0, 2).join(', ')}`);
  }
  if (becameReadyToBreakthrough) {
    summaryParts.push('Chạm bình cảnh — chờ xác nhận đột phá!');
  }
  const timeTag = options?.periodLabel || formatDeltaMinutesVi(mins);
  const lastGainSummary =
    summaryParts.length > 0
      ? `${summaryParts.join(' · ')} (${timeTag})`
      : profile.lastGainSummary;

  let updatedProfile: CultivationProfile = {
    ...expCalc.nextProfile,
    techniques: nextTechniques,
    lastGainSummary,
    lastUpdatedAt: Date.now(),
  };

  let seclusionSummary: string | undefined;
  if (options?.isSeclusionJump || rawDays >= 28) {
    const primaryTechNames = (
      activeTechniques.length > 0
        ? activeTechniques
        : nextTechniques.slice(0, 1)
    )
      .slice(0, 2)
      .map((t) => t.name);
    const techClause = primaryTechNames.length
      ? `chuyên tâm vận chuyển ${primaryTechNames.join(' & ')}`
      : 'tĩnh tâm điều tức, củng cố căn cơ';
    const gainClause =
      expGained > 0
        ? `tích lũy thêm +${expGained} ${energyShort} (${updatedProfile.exp}/${updatedProfile.maxExp})`
        : 'căn cơ đã bão hòa tại ngưỡng bình cảnh hiện tại';
    const lockClauseParts: string[] = [];
    if (lockedTechniques.length > 0) {
      lockClauseParts.push(`công pháp chạm bình cảnh (${lockedTechniques.slice(0, 2).join(', ')})`);
    }
    if (lockedMoves.length > 0) {
      lockClauseParts.push(`chiêu thức chạm bình cảnh (${lockedMoves.slice(0, 2).join(', ')})`);
    }
    const techLevelClause =
      lockClauseParts.length > 0
        ? `, ${lockClauseParts.join('; ')} — cần cốt truyện/cảnh giới hoặc Linh thạch trợ lực để đột phá tiếp`
        : masteryHighlights.length > 0
          ? `, thuần thục công pháp tiến triển vững chắc (${masteryHighlights.join(', ')})`
          : '';
    const bottleneck = getBreakthroughBottleneckInfo(updatedProfile);
    const gateClause = bottleneck.isBlocked
      ? ` Đã chạm chốt chặn ${bottleneck.kind === 'tribulation' ? 'Thiên Kiếp / Đại Cảnh Giới' : 'bình cảnh'} — hệ thống tạm khóa nhảy cấp, chờ chủ động xử lý đột phá${bottleneck.nextRealmName ? ` lên ${bottleneck.nextRealmName}` : ''}.`
      : ' Đạo cơ vững vàng, khí tức lắng đọng, không có dấu hiệu phù phiếm.';
    const clockPrefix = options?.clockRangeLabel
      ? ` (${options.clockRangeLabel})`
      : '';
    seclusionSummary = `Bế quan ${timeTag}${clockPrefix}: ${techClause}, ${gainClause}${techLevelClause}.${gateClause}`;
    updatedProfile.lastSeclusionSummary = seclusionSummary;
  }

  // Natural vitals recovery & pill toxicity decay as time passes
  if (deltaMinutes >= 30) {
    const curStats = computeCharacterStats(updatedProfile);
    const hoursPassed = deltaMinutes / 60;
    const recoverRatio = Math.min(1, hoursPassed * 0.14);
    const toxDecay = Math.min(
      curStats.pillToxicity,
      Math.max(1, Math.round(hoursPassed * 2.5)),
    );
    updatedProfile = {
      ...updatedProfile,
      vitals: {
        ...(updatedProfile.vitals || {}),
        hp: Math.min(
          curStats.maxHp,
          Math.round(curStats.hp + curStats.maxHp * recoverRatio),
        ),
        qi: Math.min(
          curStats.maxQi,
          Math.round(curStats.qi + curStats.maxQi * recoverRatio),
        ),
        spirit: Math.min(
          curStats.maxSpirit,
          Math.round(curStats.spirit + curStats.maxSpirit * recoverRatio),
        ),
        pillToxicity: Math.max(0, curStats.pillToxicity - toxDecay),
      },
    };
  }

  return {
    nextProfile: updatedProfile,
    expGained,
    overflowAdded,
    hitCap: expCalc.hitCap,
    leveledTechniques,
    leveledMoves,
    lockedTechniques,
    lockedMoves,
    masteryProgressNotes,
    becameReadyToBreakthrough,
    ...(seclusionSummary ? { seclusionSummary } : {}),
  };
}

/**
 * Performs a STRICT single-step breakthrough (+1 stage index only).
 * - Refuses breakthrough if exp < maxExp.
 * - Advances exactly 1 step: Sơ kỳ -> Trung kỳ -> Hậu kỳ -> Đỉnh phong -> Next Major Realm (Sơ kỳ).
 * - Carries over a strictly capped fraction of overflowExp (< nextStage.maxExp),
 *   resets overflowExp = 0, and guarantees readyToBreakthrough = false afterwards
 *   so chain-skipping multiple stages is mathematically impossible.
 */
export function performBreakthrough(
  profile: CultivationProfile,
  options?: {
    source?: 'manual' | 'story';
    chancePercent?: number;
    roll?: number;
    assistItemName?: string;
  },
): {
  nextProfile: CultivationProfile;
  prevRealmName: string;
  nextRealmName: string;
  isMaxRealm: boolean;
  isMajorBreakthrough: boolean;
  succeeded: boolean;
  carriedExp: number;
  statGainsSummary: string;
  outcomeRecord?: BreakthroughOutcomeRecord;
} {
  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  const safeCurrentIdx = Math.max(0, Math.min(realms.length - 1, profile.realmIndex));
  const currentStage = realms[safeCurrentIdx] || realms[0];
  const prevDisplay = getCultivationDisplayInfo(profile);
  const prevRealmName = prevDisplay.fullLabel || profile.realmName;
  const maxExp = Math.max(10, Math.round(profile.maxExp || currentStage.maxExp));
  const currentExp = Math.max(0, Math.round(profile.exp || 0));

  // Precondition guard: must reach 100% of current stage maxExp
  if (currentExp < maxExp) {
    return {
      nextProfile: {
        ...profile,
        readyToBreakthrough: false,
      },
      prevRealmName,
      nextRealmName: profile.realmName,
      isMaxRealm: safeCurrentIdx >= realms.length - 1,
      isMajorBreakthrough: false,
      succeeded: false,
      carriedExp: 0,
      statGainsSummary: '',
    };
  }

  // Wuxia-only hard ceiling guard: NEVER advance past the active internal art's maxLayer!
  if (profile.systemKind === 'wuxia') {
    const ceiling = getWuxiaInnerArtCeilingInfo(profile);
    if (ceiling.isAtArtCeiling) {
      return {
        nextProfile: {
          ...profile,
          lastGainSummary: `Đã chạm trần bộ nội công ${ceiling.activeArtName} (Tầng ${ceiling.maxLayer}) — cần đổi sang bộ nội công bậc cao hơn!`,
          lastUpdatedAt: Date.now(),
        },
        prevRealmName,
        nextRealmName: prevRealmName,
        isMaxRealm: true,
        isMajorBreakthrough: false,
        succeeded: false,
        carriedExp: 0,
        statGainsSummary: '',
      };
    }
  }

  // Strictly +1 step only — NEVER skip intermediate sub-stages or major realms
  const nextIndex = Math.min(realms.length - 1, safeCurrentIdx + 1);
  const isMaxRealm = nextIndex === safeCurrentIdx;
  const maxOverflow = getMaxOverflowExp(maxExp);
  const rawLegacySurplus = Math.max(0, currentExp - maxExp);
  const storedOverflow = Math.max(0, Math.round(profile.overflowExp || 0));
  const totalOverflow = Math.min(maxOverflow, storedOverflow + rawLegacySurplus);
  const sourcePrefix =
    options?.source === 'story' ? 'Đồng bộ đột phá từ truyện' : 'Đột phá thành công';
  const oddsTag =
    typeof options?.chancePercent === 'number'
      ? ` (tỷ lệ ${options.chancePercent}%)`
      : '';
  const assistTag = options?.assistItemName
    ? ` · trợ lực: ${options.assistItemName}`
    : '';
  const cleanedActiveBuffs = (profile.vitals?.activeBuffs || []).filter(
    (b) =>
      !/(?:phản\s*phệ|tẩu\s*hỏa|tổn\s*thương\s*kinh\s*mạch|chấn\s*thương\s*kinh\s*mạch|trọng\s*thương\s*kinh\s*mạch|dược\s*lực\s*trợ\s*đột\s*phá)/i.test(
        b,
      ),
  );

  if (isMaxRealm) {
    const nextMaxExp = Math.round(maxExp * 1.5);
    const carriedExp = Math.min(
      Math.max(0, nextMaxExp - 1),
      Math.min(
        Math.floor(nextMaxExp * 0.3),
        Math.round(totalOverflow * 0.75),
      ),
    );
    let nextWuxiaState = profile.wuxiaState;
    let maxRealmLabel = prevRealmName;
    if (profile.systemKind === 'wuxia') {
      const ws = normalizeWuxiaState(profile.wuxiaState, safeCurrentIdx);
      const nextMilestone =
        ws.innerLayer < 66 ? 66 : ws.innerLayer < 75 ? 75 : 86;
      const nextLayer = Math.min(ws.innerMaxLayer, nextMilestone);
      nextWuxiaState = { ...ws, innerLayer: nextLayer };
      const tier = getWuxiaTitleByLayer(nextLayer);
      maxRealmLabel = `${tier.title} (Tầng ${nextLayer})`;
    }
    const note = `${sourcePrefix}${oddsTag}: Củng cố đỉnh phong ${maxRealmLabel}${assistTag}${
      carriedExp > 0 ? ` · giữ +${carriedExp} tu vi dư` : ''
    }`;
    const outcomeRecord: BreakthroughOutcomeRecord = {
      outcome: 'success',
      chancePercent:
        typeof options?.chancePercent === 'number' ? options.chancePercent : 100,
      ...(typeof options?.roll === 'number' ? { roll: options.roll } : {}),
      fromRealm: prevRealmName,
      targetRealm: maxRealmLabel,
      ...(options?.assistItemName ? { assistItemName: options.assistItemName } : {}),
      summary: note,
      consequences: carriedExp > 0 ? [`Giữ +${carriedExp} tu vi dư`] : ['Nội công đỉnh phong thêm cô đọng'],
      storyPrompt:
        profile.systemKind === 'wuxia'
          ? `Ta vận chuyển nội công củng cố cảnh giới ${maxRealmLabel}${options?.assistItemName ? ` nhờ ${options.assistItemName}` : ''} thành công, chân khí càng thêm thuần hậu siêu phàm.`
          : `Ta vận công củng cố cảnh giới đỉnh phong ${prevRealmName}${options?.assistItemName ? ` nhờ ${options.assistItemName}` : ''} thành công, đạo cơ càng thêm vững chắc.`,
      timestamp: Date.now(),
    };
    return {
      nextProfile: {
        ...profile,
        schemaVersion: CULTIVATION_SCHEMA_VERSION,
        realmIndex: safeCurrentIdx,
        majorRealm: profile.majorRealm || currentStage.majorRealm,
        subStage: profile.subStage || currentStage.subStage,
        ...(profile.systemKind === 'wuxia' && nextWuxiaState
          ? {
              minorTier: nextWuxiaState.innerLayer,
              wuxiaState: nextWuxiaState,
            }
          : {}),
        exp: carriedExp,
        maxExp: nextMaxExp,
        overflowExp: 0,
        readyToBreakthrough: false,
        vitals: {
          ...(profile.vitals || {}),
          breakthroughEase: 0,
          activeBuffs: cleanedActiveBuffs,
        },
        lastGainSummary: `${note}!`,
        lastBreakthroughNote: note,
        lastBreakthroughOutcome: outcomeRecord,
        lastUpdatedAt: Date.now(),
      },
      prevRealmName,
      nextRealmName: maxRealmLabel,
      isMaxRealm: true,
      isMajorBreakthrough: false,
      succeeded: true,
      carriedExp,
      statGainsSummary: '',
      outcomeRecord,
    };
  }

  const nextStage = realms[nextIndex];
  const currentMajor = profile.majorRealm || currentStage.majorRealm;
  const wuxiaNextTier =
    profile.systemKind === 'wuxia'
      ? getWuxiaTitleByRealmIndex(nextIndex)
      : null;
  const isMajorBreakthrough = wuxiaNextTier
    ? wuxiaNextTier.isMajorMilestone
    : nextStage.majorRealm !== currentMajor;

  const carryRate = isMajorBreakthrough
    ? MAJOR_BREAKTHROUGH_CARRY_RATE
    : MINOR_BREAKTHROUGH_CARRY_RATE;
  const carryMaxRatio = isMajorBreakthrough
    ? MAJOR_BREAKTHROUGH_CARRY_MAX_RATIO
    : MINOR_BREAKTHROUGH_CARRY_MAX_RATIO;

  // Preserve overflow EXP fairly while strictly capping below nextStage.maxExp so double-skipping is impossible
  const carriedExp = Math.max(
    0,
    Math.min(
      Math.max(0, nextStage.maxExp - 1),
      Math.min(
        Math.floor(nextStage.maxExp * carryMaxRatio),
        Math.round(totalOverflow * carryRate),
      ),
    ),
  );

  const prevStats = computeCharacterStats(profile);
  const prevTox = Math.max(0, Math.round(profile.vitals?.pillToxicity || 0));
  const nextWuxiaState =
    profile.systemKind === 'wuxia' && wuxiaNextTier
      ? (() => {
          const prevWs = normalizeWuxiaState(profile.wuxiaState, safeCurrentIdx);
          return {
            ...prevWs,
            innerLayer: Math.min(prevWs.innerMaxLayer, wuxiaNextTier.minLayer),
          };
        })()
      : undefined;

  const nextProfileBase: CultivationProfile = {
    ...profile,
    schemaVersion: CULTIVATION_SCHEMA_VERSION,
    realmIndex: nextIndex,
    realmName: nextStage.name,
    majorRealm: nextStage.majorRealm,
    subStage: nextStage.subStage,
    minorTier: nextWuxiaState ? nextWuxiaState.innerLayer : nextStage.minorTier,
    ...(nextWuxiaState ? { wuxiaState: nextWuxiaState } : {}),
    exp: carriedExp,
    maxExp: nextStage.maxExp,
    overflowExp: 0,
    readyToBreakthrough: false,
    vitals: {
      ...(profile.vitals || {}),
      pillToxicity: Math.max(0, prevTox - (isMajorBreakthrough ? 50 : 28)),
      breakthroughEase: 0,
      activeBuffs: cleanedActiveBuffs,
    },
    lastUpdatedAt: Date.now(),
  };
  const nextStats = computeCharacterStats(nextProfileBase);
  nextProfileBase.vitals = {
    ...(nextProfileBase.vitals || {}),
    hp: nextStats.maxHp,
    qi: nextStats.maxQi,
    spirit: nextStats.maxSpirit,
  };

  const statDeltas: string[] = [];
  const dHp = nextStats.maxHp - prevStats.maxHp;
  const dQi = nextStats.maxQi - prevStats.maxQi;
  const dAtk = nextStats.atk - prevStats.atk;
  const dDef = nextStats.def - prevStats.def;
  const dAgi = nextStats.agi - prevStats.agi;
  if (dHp > 0) statDeltas.push(`${nextStats.hpName} +${dHp}`);
  if (dQi > 0) statDeltas.push(`${nextStats.energyName} +${dQi}`);
  if (dAtk > 0) statDeltas.push(`Công +${dAtk}`);
  if (dDef > 0) statDeltas.push(`Thủ +${dDef}`);
  if (dAgi > 0) statDeltas.push(`Thân pháp +${dAgi}`);
  const statGainsSummary = statDeltas.join(' · ');

  const displayNextName = wuxiaNextTier
    ? `${wuxiaNextTier.title} (Tầng ${wuxiaNextTier.minLayer})`
    : nextStage.name;
  const breakthroughKindLabel = wuxiaNextTier
    ? 'Đột phá tầng nội công lên'
    : isMajorBreakthrough
      ? 'Đột phá đại cảnh giới thành công lên'
      : 'Đột phá tiểu cảnh giới lên';
  const carryPart = carriedExp > 0 ? ` · giữ +${carriedExp} tu vi dư` : '';
  const statsPart = statGainsSummary ? ` · ${statGainsSummary}` : '';
  const wuxiaMeaningPart = wuxiaNextTier ? ` — ${wuxiaNextTier.meaningVi}` : '';
  const syncNote = `${sourcePrefix}${oddsTag}: ${prevRealmName} → ${displayNextName}${wuxiaMeaningPart}${assistTag}${carryPart}${statsPart}`;

  const successConsequences: string[] = [
    `Thăng cấp: ${prevRealmName} → ${displayNextName}`,
    ...(wuxiaNextTier ? [wuxiaNextTier.meaningVi] : []),
    ...(options?.assistItemName ? [`Đã dùng 1 ${options.assistItemName}`] : []),
    ...(carriedExp > 0 ? [`Chuyển hóa +${carriedExp} tu vi dư`] : []),
    ...(statGainsSummary ? [statGainsSummary] : []),
    profile.systemKind === 'wuxia'
      ? 'Chân khí thông suốt, khí huyết sung mãn'
      : 'Khí huyết, linh lực & thần thức hồi phục sung mãn',
  ];
  const outcomeRecord: BreakthroughOutcomeRecord = {
    outcome: 'success',
    chancePercent:
      typeof options?.chancePercent === 'number' ? options.chancePercent : 100,
    ...(typeof options?.roll === 'number' ? { roll: options.roll } : {}),
    fromRealm: prevRealmName,
    targetRealm: displayNextName,
    ...(options?.assistItemName ? { assistItemName: options.assistItemName } : {}),
    summary: syncNote,
    consequences: successConsequences,
    storyPrompt: wuxiaNextTier && nextWuxiaState
      ? `Ta vận chuyển ${nextWuxiaState.activeInnerArtName} thành công phá vỡ bình cảnh${options?.assistItemName ? ` nhờ ${options.assistItemName}` : ''}, đột phá lên Tầng ${wuxiaNextTier.minLayer} — ${wuxiaNextTier.title} (${wuxiaNextTier.meaningVi}). Nội lực hùng hậu thông suốt toàn thân!`
      : `Ta thành công phá vỡ bình cảnh${options?.assistItemName ? ` nhờ ${options.assistItemName}` : ''}, chính thức đột phá từ ${prevRealmName} bước vào ${nextStage.name}! Khí tức tăng vọt, linh lực toàn thân dồi dào sung mãn.`,
    timestamp: Date.now(),
  };

  nextProfileBase.lastGainSummary = `${breakthroughKindLabel} ${displayNextName}${
    carriedExp > 0 ? ` (chuyển hóa +${carriedExp} tu vi dư)` : ''
  }!`;
  nextProfileBase.lastBreakthroughNote = syncNote;
  nextProfileBase.lastBreakthroughOutcome = outcomeRecord;

  return {
    nextProfile: nextProfileBase,
    prevRealmName,
    nextRealmName: displayNextName,
    isMaxRealm: false,
    isMajorBreakthrough,
    succeeded: true,
    carriedExp,
    statGainsSummary,
    outcomeRecord,
  };
}

/**
 * High-level wrapper computing transparent breakthrough success odds (%)
 * using Linh căn · Thể chất · Căn cơ, bottleneck tier, current vitals/toxicity,
 * overflow EXP, selected assist item, and current scene text.
 */
export function calculateBreakthroughOdds(
  profile: CultivationProfile,
  options?: {
    assistItemId?: string | null;
    sceneText?: string;
  },
): BreakthroughOddsReport {
  const bottleneck = getBreakthroughBottleneckInfo(profile);
  const display = getCultivationDisplayInfo(profile);
  const stats = computeCharacterStats(profile);
  const nextStage = getNextRealmStage(profile);
  return computeBreakthroughOddsReport({
    profile,
    bottleneckKind: bottleneck.kind,
    targetRealmName: nextStage?.name || display.fullLabel || profile.realmName,
    stats: {
      hp: stats.hp,
      maxHp: stats.maxHp,
      qi: stats.qi,
      maxQi: stats.maxQi,
      spirit: stats.spirit,
      maxSpirit: stats.maxSpirit,
      pillToxicity: stats.pillToxicity,
      breakthroughEase: stats.breakthroughEase,
      activeBuffs: stats.activeBuffs,
      hpName: stats.hpName,
      energyName: stats.energyName,
    },
    overflowExp: display.overflowExp,
    maxOverflowExp: display.maxOverflowExp,
    assistItemId: options?.assistItemId,
    sceneText: options?.sceneText,
  });
}

export interface BreakthroughAttemptResult {
  attempted: boolean;
  succeeded: boolean;
  severity?: 'minor_setback' | 'meridian_backlash' | 'severe_backlash';
  odds: BreakthroughOddsReport;
  roll: number;
  nextProfile: CultivationProfile;
  prevRealmName: string;
  nextRealmName: string;
  carriedExp: number;
  isMajorBreakthrough: boolean;
  isMaxRealm: boolean;
  statGainsSummary: string;
  headline: string;
  storyPrompt: string;
  outcomeRecord?: BreakthroughOutcomeRecord;
  consumedAssistItemName?: string;
}

/**
 * Executes a manual breakthrough attempt with dynamic probability roll (1..100).
 * - On success: advances +1 realm step via performBreakthrough, clears backlash debuffs, records outcome.
 * - On failure: keeps current realm intact, applies tiered setback/meridian backlash/severe backlash,
 *   consumes any chosen assist item, and records outcome + story prompt for narration sync.
 */
export function attemptBreakthroughWithOdds(
  profile: CultivationProfile,
  options?: {
    assistItemId?: string | null;
    sceneText?: string;
    forcedRoll?: number;
  },
): BreakthroughAttemptResult {
  const prevDisplay = getCultivationDisplayInfo(profile);
  const prevRealmName = prevDisplay.fullLabel || profile.realmName;
  const odds = calculateBreakthroughOdds(profile, {
    assistItemId: options?.assistItemId,
    sceneText: options?.sceneText,
  });

  const maxExp = Math.max(10, Math.round(profile.maxExp || 100));
  const currentExp = Math.max(0, Math.round(profile.exp || 0));
  if (currentExp < maxExp) {
    return {
      attempted: false,
      succeeded: false,
      odds,
      roll: 0,
      nextProfile: {
        ...profile,
        readyToBreakthrough: false,
      },
      prevRealmName,
      nextRealmName: profile.realmName,
      carriedExp: 0,
      isMajorBreakthrough: false,
      isMaxRealm: odds.bottleneckKind === 'max_realm',
      statGainsSummary: '',
      headline: 'Chưa tích đủ 100% tu vi của giai đoạn hiện tại để đột phá.',
      storyPrompt: '',
    };
  }

  if (profile.systemKind === 'wuxia') {
    const ceiling = getWuxiaInnerArtCeilingInfo(profile);
    if (ceiling.isAtArtCeiling) {
      return {
        attempted: false,
        succeeded: false,
        odds,
        roll: 0,
        nextProfile: profile,
        prevRealmName,
        nextRealmName: prevRealmName,
        carriedExp: 0,
        isMajorBreakthrough: false,
        isMaxRealm: true,
        statGainsSummary: '',
        headline: ceiling.ceilingMessage,
        storyPrompt: '',
      };
    }
  }

  let workingProfile = profile;
  let consumedAssistItem: InventoryItem | undefined;
  if (options?.assistItemId) {
    const consumed = consumeBreakthroughAssistItem(
      workingProfile,
      options.assistItemId,
    );
    workingProfile = consumed.nextProfile;
    consumedAssistItem = consumed.consumedItem;
  }

  const rawRoll =
    typeof options?.forcedRoll === 'number' && Number.isFinite(options.forcedRoll)
      ? Math.max(1, Math.min(100, Math.round(options.forcedRoll)))
      : Math.floor(Math.random() * 100) + 1;

  if (rawRoll <= odds.finalChance) {
    const bt = performBreakthrough(workingProfile, {
      source: 'manual',
      chancePercent: odds.finalChance,
      roll: rawRoll,
      assistItemName: consumedAssistItem?.name,
    });
    const carryNote =
      bt.carriedExp > 0 ? ` · giữ +${bt.carriedExp} tu vi dư` : '';
    const statsNote = bt.statGainsSummary ? ` · ${bt.statGainsSummary}` : '';
    const headline = bt.isMaxRealm
      ? `Củng cố đỉnh phong thành công (${odds.finalChance}%): ${bt.nextRealmName}${carryNote}.`
      : bt.isMajorBreakthrough
        ? `Đột phá đại cảnh giới thành công (${odds.finalChance}%): ${bt.prevRealmName} → ${bt.nextRealmName}${carryNote}${statsNote}!`
        : `Đột phá thành công (${odds.finalChance}%): ${bt.prevRealmName} → ${bt.nextRealmName}${carryNote}${statsNote}!`;
    return {
      attempted: true,
      succeeded: true,
      odds,
      roll: rawRoll,
      nextProfile: bt.nextProfile,
      prevRealmName: bt.prevRealmName,
      nextRealmName: bt.nextRealmName,
      carriedExp: bt.carriedExp,
      isMajorBreakthrough: bt.isMajorBreakthrough,
      isMaxRealm: bt.isMaxRealm,
      statGainsSummary: bt.statGainsSummary,
      headline,
      storyPrompt: bt.outcomeRecord?.storyPrompt || '',
      outcomeRecord: bt.outcomeRecord,
      ...(consumedAssistItem ? { consumedAssistItemName: consumedAssistItem.name } : {}),
    };
  }

  const statsAfterAssist = computeCharacterStats(workingProfile);
  const failed = applyBreakthroughFailureOutcome({
    profile: workingProfile,
    odds,
    stats: {
      hp: statsAfterAssist.hp,
      maxHp: statsAfterAssist.maxHp,
      qi: statsAfterAssist.qi,
      maxQi: statsAfterAssist.maxQi,
      spirit: statsAfterAssist.spirit,
      maxSpirit: statsAfterAssist.maxSpirit,
      pillToxicity: statsAfterAssist.pillToxicity,
      breakthroughEase: statsAfterAssist.breakthroughEase,
      activeBuffs: statsAfterAssist.activeBuffs,
      hpName: statsAfterAssist.hpName,
      energyName: statsAfterAssist.energyName,
    },
    prevRealmName,
    roll: rawRoll,
    assistItemUsed: consumedAssistItem,
    source: 'manual',
  });

  return {
    attempted: true,
    succeeded: false,
    severity: failed.severity,
    odds,
    roll: rawRoll,
    nextProfile: failed.nextProfile,
    prevRealmName,
    nextRealmName: prevRealmName,
    carriedExp: 0,
    isMajorBreakthrough:
      odds.bottleneckKind === 'major_bottleneck' ||
      odds.bottleneckKind === 'tribulation',
    isMaxRealm: odds.bottleneckKind === 'max_realm',
    statGainsSummary: '',
    headline: failed.headline,
    storyPrompt: failed.outcomeRecord.storyPrompt,
    outcomeRecord: failed.outcomeRecord,
    ...(consumedAssistItem ? { consumedAssistItemName: consumedAssistItem.name } : {}),
  };
}

// ---------------------------------------------------------------------------
// STORY-DRIVEN BREAKTHROUGH SYNC (SAFE, DETERMINISTIC, +1 STEP MAX)
// ---------------------------------------------------------------------------

export interface StoryBreakthroughSyncResult {
  synced: boolean;
  reason:
    | 'synced'
    | 'failed_synced'
    | 'disabled'
    | 'not_eligible'
    | 'max_realm'
    | 'no_breakthrough_signal'
    | 'attempt_or_failed'
    | 'technique_only'
    | 'other_character';
  nextProfile: CultivationProfile;
  prevRealmName: string;
  nextRealmName: string;
  carriedExp: number;
  isMajorBreakthrough: boolean;
  statGainsSummary: string;
  bannerMessage?: string;
}

const VI_TIER_WORD_MAP: Record<number, string[]> = {
  1: ['1', 'một', 'nhất', 'đệ nhất'],
  2: ['2', 'hai', 'nhị', 'đệ nhị'],
  3: ['3', 'ba', 'tam', 'đệ tam'],
  4: ['4', 'bốn', 'tứ', 'đệ tứ'],
  5: ['5', 'năm', 'ngũ', 'đệ ngũ'],
  6: ['6', 'sáu', 'lục', 'đệ lục'],
  7: ['7', 'bảy', 'thất', 'đệ thất'],
  8: ['8', 'tám', 'bát', 'đệ bát'],
  9: ['9', 'chín', 'cửu', 'đệ cửu'],
  10: ['10', 'mười', 'thập', 'đệ thập'],
};

function escapeRegExpSafe(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildNextStageMatchers(
  currentStage: RealmStage,
  nextStage: RealmStage,
): { exactPatterns: RegExp[]; shortPatterns: RegExp[] } {
  const exactPatterns: RegExp[] = [];
  const shortPatterns: RegExp[] = [];

  const nextNameClean = nextStage.name
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (nextNameClean.length >= 3) {
    exactPatterns.push(new RegExp(escapeRegExpSafe(nextNameClean), 'i'));
  }

  const nextMajorLower = nextStage.majorRealm.trim().toLowerCase();
  const curMajorLower = currentStage.majorRealm.trim().toLowerCase();
  const nextSubLower = nextStage.subStage.trim().toLowerCase();
  const isMajorTransition = nextMajorLower !== curMajorLower;

  if (typeof nextStage.minorTier === 'number') {
    const words = VI_TIER_WORD_MAP[nextStage.minorTier] || [
      String(nextStage.minorTier),
    ];
    const numGroup = words.map(escapeRegExpSafe).join('|');
    // e.g. "luyện khí tầng 5", "luyện khí kỳ tầng năm", "luyện khí ngũ tầng", "ngưng huyền ngũ trọng"
    exactPatterns.push(
      new RegExp(
        `${escapeRegExpSafe(nextMajorLower)}(?:\\s+kỳ|\\s+cảnh)?\\s*(?:tầng|trọng|tinh|cấp)\\s*(?:thứ\\s*)?(?:${numGroup})(?![0-9a-zà-ỹ])`,
        'i',
      ),
    );
    exactPatterns.push(
      new RegExp(
        `${escapeRegExpSafe(nextMajorLower)}(?:\\s+kỳ|\\s+cảnh)?\\s*(?:${numGroup})\\s*(?:tầng|trọng|tinh)`,
        'i',
      ),
    );
    exactPatterns.push(
      new RegExp(
        `(?:tầng|trọng|tinh)\\s*(?:thứ\\s*)?(?:${numGroup})\\s+(?:của\\s+)?${escapeRegExpSafe(nextMajorLower)}`,
        'i',
      ),
    );
    // Short tier mention (valid when sentence clearly discusses realm/tu vi/bình cảnh)
    shortPatterns.push(
      new RegExp(
        `(?:tầng|trọng)\\s*(?:thứ\\s*)?(?:${numGroup})(?![0-9a-zà-ỹ])`,
        'i',
      ),
    );
    shortPatterns.push(
      new RegExp(`(?:${numGroup})\\s*(?:tầng|trọng)(?![0-9a-zà-ỹ])`, 'i'),
    );
  } else {
    // Sub-stage or major realm without minorTier
    exactPatterns.push(
      new RegExp(
        `${escapeRegExpSafe(nextMajorLower)}(?:\\s+kỳ|\\s+cảnh)?\\s+${escapeRegExpSafe(nextSubLower)}`,
        'i',
      ),
    );
    if (nextSubLower === 'đỉnh phong') {
      exactPatterns.push(
        new RegExp(
          `${escapeRegExpSafe(nextMajorLower)}(?:\\s+kỳ|\\s+cảnh)?\\s+(?:đỉnh\\s+phong|đại\\s+viên\\s+mãn|viên\\s+mãn)`,
          'i',
        ),
      );
      shortPatterns.push(/(?:đỉnh\s+phong|đại\s+viên\s+mãn)/i);
    } else if (!isMajorTransition) {
      shortPatterns.push(new RegExp(escapeRegExpSafe(nextSubLower), 'i'));
    }
    if (isMajorTransition && nextMajorLower.length >= 3) {
      exactPatterns.push(
        new RegExp(
          `(?:cảnh\\s+giới|bước\\s+vào|tiến\\s+vào|đột\\s+phá(?:\\s+lên)?|thăng\\s+lên|đạt\\s+tới|đạt\\s+đến|chính\\s+thức|thành\\s+công|ổn\\s+định\\s+ở)[^.!?\n]{0,28}${escapeRegExpSafe(nextMajorLower)}`,
          'i',
        ),
      );
      if (nextMajorLower === 'trúc cơ') {
        exactPatterns.push(/(?:trúc\s+cơ\s+thành\s+công|thành\s+công\s+trúc\s+cơ|ngưng\s+tụ\s+đạo\s+cơ\s+thành\s+công)/i);
      } else if (nextMajorLower === 'kim đan') {
        exactPatterns.push(/(?:kết\s+đan\s+thành\s+công|ngưng\s+tụ\s+kim\s+đan\s+thành\s+công|thành\s+công\s+kết\s+đan)/i);
      } else if (nextMajorLower === 'nguyên anh') {
        exactPatterns.push(/(?:ngưng\s+anh\s+thành\s+công|ngưng\s+kết\s+nguyên\s+anh\s+thành\s+công|thành\s+công\s+kết\s+anh)/i);
      }
    }
  }

  return { exactPatterns, shortPatterns };
}

/**
 * Inspects a completed story turn (user action + assistant narration) and, ONLY when
 * the protagonist is eligible and the narrative unambiguously confirms a completed realm
 * breakthrough (not an attempt, preparation, failure, technique-only level-up, or NPC event),
 * advances the realm by strictly +1 step via `performBreakthrough`, preserving overflow EXP
 * and recalculating stats & bottleneck state.
 */
export function detectAndSyncStoryBreakthrough(
  profile: CultivationProfile | undefined,
  params: {
    userText?: string;
    assistantText?: string;
    mcName?: string;
  },
): StoryBreakthroughSyncResult {
  const emptyResult = (
    reason: StoryBreakthroughSyncResult['reason'],
    prof: CultivationProfile,
  ): StoryBreakthroughSyncResult => ({
    synced: false,
    reason,
    nextProfile: prof,
    prevRealmName: getCultivationDisplayInfo(prof).fullLabel || prof.realmName,
    nextRealmName: prof.realmName,
    carriedExp: 0,
    isMajorBreakthrough: false,
    statGainsSummary: '',
  });

  if (!profile || !profile.enabled) {
    return emptyResult('disabled', profile as CultivationProfile);
  }

  const assistantText = (params.assistantText || '').trim();
  const userText = (params.userText || '').trim();
  if (!assistantText) {
    return emptyResult('no_breakthrough_signal', profile);
  }

  const realms = CULTIVATION_SYSTEM_META[profile.systemKind].realms;
  const safeIdx = Math.max(0, Math.min(realms.length - 1, profile.realmIndex));
  const currentStage = realms[safeIdx] || realms[0];
  const nextStage = getNextRealmStage(profile);
  if (!nextStage) {
    return emptyResult('max_realm', profile);
  }

  const maxExp = Math.max(10, Math.round(profile.maxExp || currentStage.maxExp));
  const currentExp = Math.max(0, Math.round(profile.exp || 0));
  const isReady = Boolean(profile.readyToBreakthrough) || currentExp >= maxExp;
  const isNearFull = !isReady && currentExp >= Math.round(maxExp * 0.88);

  if (!isReady && !isNearFull) {
    return emptyResult('not_eligible', profile);
  }

  const { exactPatterns, shortPatterns } = buildNextStageMatchers(
    currentStage,
    nextStage,
  );
  const techniqueNamesLower = profile.techniques
    .map((t) => t.name.trim().toLowerCase())
    .filter((n) => n.length >= 3);

  const userLower = userText.toLowerCase();
  const userMentionsTechniqueOnly =
    techniqueNamesLower.some((tn) => userLower.includes(tn)) &&
    !/(?:cảnh\s+giới|tu\s+vi|bình\s+cảnh|đại\s+cảnh\s+giới|tiểu\s+cảnh\s+giới|độ\s+kiếp)/i.test(
      userLower,
    ) &&
    !exactPatterns.some((re) => re.test(userLower));

  const userHadBreakthroughIntent =
    !userMentionsTechniqueOnly &&
    (/(?:đột\s+phá|xung\s+kích|phá\s+quan|phá\s+bình\s+cảnh|độ\s+kiếp|xung\s+phá|tiến\s+giai|lên\s+tầng|lên\s+cảnh\s+giới|bước\s+vào\s+(?:tầng|cảnh\s+giới))/i.test(
      userLower,
    ) ||
      exactPatterns.some((re) => re.test(userLower)));

  // Split assistant narration into sentences / clauses in chronological order
  const rawSentences = assistantText
    .split(/(?<=[.!?…\n])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  const failurePattern =
    /(?:(?:đột\s+phá|xung\s+kích|phá\s+quan|độ\s+kiếp|tiến\s+giai)[^.!?\n]{0,24}(?:thất\s+bại|bất\s+thành|không\s+thành|chưa\s+thành|bị\s+gián\s+đoạn|bị\s+cắt\s+ngang|bị\s+phá\s+ngang|dừng\s+giữa\s+chừng)|(?:không\s+thể|chưa\s+thể|chưa\s+đủ\s+để|không\s+đủ\s+để|chưa\s+vượt\s+qua(?:\s+được)?)\s+(?:đột\s+phá|xung\s+kích|phá\s+vỡ|vượt\s+qua|bước\s+vào|tiến\s+vào|chạm\s+tới)|(?:bình\s+cảnh|rào\s+cản)[^.!?\n]{0,25}(?:vẫn\s+chưa|chưa\s+vỡ|chưa\s+hề\s+vỡ|vẫn\s+vững|chỉ\s+mới\s+lung\s+lay|vẫn\s+án\s+ngữ)|(?:vẫn\s+(?:kẹt|mắc\s+kẹt|dừng\s+lại|giậm\s+chân)\s+(?:ở|tại)|còn\s+thiếu\s+(?:một\s+bước|chút\s+hỏa\s+hầu|linh\s+khí)|tẩu\s+hỏa\s+nhập\s+ma|bị\s+phản\s+phệ|đành\s+dừng\s+lại))/i;

  const hypotheticalOrPrepOnlyPattern =
    /(?:(?:sẽ|có\s+thể|muốn|định|dự\s+định|chuẩn\s+bị|sắp|đang\s+thử|bắt\s+đầu\s+thử|cố\s+gắng|nhằm|để\s+có\s+thể|hướng\s+tới|mục\s+tiêu|còn\s+cách)\s+(?:đột\s+phá|xung\s+kích|bước\s+vào|tiến\s+vào|đạt\s+tới|lên))/i;

  const attainmentVerbPattern =
    /(?:đột\s+phá|tiến\s+vào|bước\s+vào|bước\s+sang|bước\s+lên|đạt\s+tới|đạt\s+đến|chính\s+thức|thăng\s+lên|tiến\s+giai|thành\s+công|ổn\s+định\s+ở|vững\s+vàng\s+ở|đã\s+lên|vượt\s+lên|lên\s+tới|thành\s+tựu|kết\s+thành|ngưng\s+tụ\s+thành\s+công|đã\s+là)/i;

  const strongCompletionPattern =
    /(?:(?:đột\s+phá|xung\s+kích|phá\s+quan|độ\s+kiếp|tiến\s+giai)\s+thành\s+công|thành\s+công\s+(?:đột\s+phá|xung\s+kích|phá\s+quan|độ\s+kiếp|tiến\s+giai|phá\s+vỡ\s+bình\s+cảnh|bước\s+vào|tiến\s+vào)|(?:bình\s+cảnh|rào\s+cản|chốt\s+chặn|bức\s+tường\s+vô\s+hình)[^.!?\n]{0,40}(?:vỡ\s+tan|tan\s+vỡ|sụp\s+đổ|bị\s+phá\s+vỡ|hoàn\s+toàn\s+vỡ|được\s+phá\s+bỏ|vỡ\s+vụn)|(?:phá\s+vỡ|xuyên\s+thủng|đánh\s+tan|phá\s+tan)[^.!?\n]{0,35}(?:bình\s+cảnh|rào\s+cản|chốt\s+chặn)[^.!?\n]{0,45}(?:thành\s+công|chính\s+thức|bước\s+vào|tiến\s+vào|cảnh\s+giới\s+mới|tầng\s+mới|vững\s+vàng|bùng\s+nổ)|(?:chính\s+thức|cuối\s+cùng\s+cũng|rốt\s+cuộc\s+cũng)\s+(?:đột\s+phá|tiến\s+giai|bước\s+vào\s+cảnh\s+giới\s+mới|tiến\s+lên\s+(?:tầng|cảnh\s+giới)\s+mới|vượt\s+qua\s+bình\s+cảnh))/i;

  const realmContextPattern =
    /(?:cảnh\s+giới|tu\s+vi|đại\s+cảnh\s+giới|tiểu\s+cảnh\s+giới|bình\s+cảnh|đan\s+điền|khí\s+hải|linh\s+lực|nội\s+lực|chân\s+khí|huyền\s+khí|đạo\s+cơ|kim\s+đan|nguyên\s+anh|thiên\s+kiếp|luyện\s+khí|trúc\s+cơ)/i;

  const techniqueKeywordPattern =
    /(?:công\s+pháp|kiếm\s+quyết|kiếm\s+pháp|tâm\s+pháp|chiêu\s+thức|thân\s+pháp|võ\s+kỹ|chiến\s+kỹ|bí\s+thuật|đao\s+pháp)/i;

  const mcNameLower = (params.mcName || '').trim().toLowerCase();
  const mcPronounPattern =
    /(?:^|[\s,.;:("'])(?:ta|ngươi|bạn|bản\s+thân|trong\s+người|đan\s+điền|kinh\s+mạch|khí\s+hải|toàn\s+thân|cơ\s+thể)(?=$|[\s,.;:)"'])/i;
  const thirdPartyLeadPattern =
    /^(?:hắn|y|nàng|cô\s+ta|anh\s+ta|lão\s+giả|sư\s+phụ|sư\s+huynh|sư\s+tỷ|sư\s+đệ|sư\s+muội|trưởng\s+lão|tông\s+chủ|đối\s+phương|kẻ\s+địch|địch\s+nhân)\b/i;

  let lastSuccessIdx = -1;
  let lastFailureIdx = -1;
  let sawAnyBreakthroughDiscussion = false;
  let sawTechniqueOnlySignal = false;
  let sawOtherCharacterOnly = false;
  let matchedExplicitNextStage = false;
  let matchedStrongMcAttribution = false;

  for (let i = 0; i < rawSentences.length; i++) {
    const sentence = rawSentences[i];
    const lower = sentence.toLowerCase();

    if (
      /(?:đột\s+phá|bình\s+cảnh|xung\s+kích|phá\s+quan|độ\s+kiếp|tiến\s+giai)/i.test(
        lower,
      )
    ) {
      sawAnyBreakthroughDiscussion = true;
    }

    // Check failure / still-stuck sentences
    if (failurePattern.test(lower)) {
      // Allow a sentence that explicitly contrasts failure earlier and success later ("tưởng chừng thất bại, nhưng cuối cùng bình cảnh vỡ tan, chính thức bước vào...")
      const pivotMatch = lower.split(/(?:nhưng|song|bỗng|cuối\s+cùng|rốt\s+cuộc)/i);
      const tailClause =
        pivotMatch.length > 1 ? pivotMatch[pivotMatch.length - 1] : '';
      if (!tailClause || failurePattern.test(tailClause)) {
        lastFailureIdx = i;
        continue;
      }
    }

    // Distinguish technique-only breakthrough from realm breakthrough
    const mentionsTechName = techniqueNamesLower.some((tn) => lower.includes(tn));
    const mentionsTechWord = techniqueKeywordPattern.test(lower);
    const matchesExactNext = exactPatterns.some((re) => re.test(lower));
    const matchesShortNext =
      !matchesExactNext &&
      realmContextPattern.test(lower) &&
      shortPatterns.some((re) => re.test(lower));

    if (
      (mentionsTechName || mentionsTechWord) &&
      !matchesExactNext &&
      !/(?:cảnh\s+giới|tu\s+vi|đại\s+cảnh\s+giới|tiểu\s+cảnh\s+giới)/i.test(lower)
    ) {
      if (strongCompletionPattern.test(lower)) {
        sawTechniqueOnlySignal = true;
      }
      continue;
    }

    // Check if the confirming clause is merely preparatory / hypothetical (e.g. "chuẩn bị đột phá lên Luyện Khí Tầng 5")
    // If there's a pivot ("nhưng", "cuối cùng", "rốt cuộc", "chính thức"), inspect the concluding clause too
    const clauses = lower
      .split(/(?:,\s*(?:cuối\s+cùng|rốt\s+cuộc|chính\s+thức|và\s+đã)|;\s*)/i)
      .map((c) => c.trim())
      .filter(Boolean);
    const activeClause = clauses[clauses.length - 1] || lower;

    const hasExplicitNextAttainment =
      (matchesExactNext || matchesShortNext) &&
      attainmentVerbPattern.test(lower) &&
      !hypotheticalOrPrepOnlyPattern.test(activeClause);

    const hasStrongCompletion =
      strongCompletionPattern.test(lower) &&
      (realmContextPattern.test(lower) ||
        userHadBreakthroughIntent ||
        matchesExactNext ||
        matchesShortNext);

    if (!hasExplicitNextAttainment && !hasStrongCompletion) {
      continue;
    }

    // Check protagonist vs third-party attribution
    const mentionsMcName = mcNameLower.length >= 2 && lower.includes(mcNameLower);
    const hasMcCue =
      mentionsMcName || mcPronounPattern.test(lower) || userHadBreakthroughIntent;
    const looksThirdParty =
      thirdPartyLeadPattern.test(lower) && !mentionsMcName && !mcPronounPattern.test(lower);

    if (looksThirdParty && !userHadBreakthroughIntent) {
      sawOtherCharacterOnly = true;
      continue;
    }

    lastSuccessIdx = i;
    if (matchesExactNext || matchesShortNext) {
      matchedExplicitNextStage = true;
    }
    if (hasMcCue) {
      matchedStrongMcAttribution = true;
    }
  }

  const explicitBacklashOrFailureInStory =
    /(?:(?:đột\s+phá|xung\s+kích|phá\s+quan|độ\s+kiếp)[^.!?\n]{0,28}(?:thất\s+bại|bất\s+thành|không\s+thành)|phản\s+phệ|tẩu\s+hỏa\s+nhập\s+ma|thổ\s+huyết[^.!?\n]{0,30}(?:bình\s+cảnh|đột\s+phá|kinh\s+mạch|khí\s+hải)|kinh\s+mạch\s+(?:tổn|chấn)\s+thương)/i.test(
      assistantText,
    );

  const recentManualFailureAlreadyRecorded =
    profile.lastBreakthroughOutcome?.outcome === 'failed' &&
    Date.now() - profile.lastBreakthroughOutcome.timestamp < 90_000;

  if (lastSuccessIdx === -1 || lastFailureIdx >= lastSuccessIdx) {
    // If MC was ready, explicitly attempted breakthrough in story, and narration confirms failure/backlash,
    // synchronize the setback/backlash into vitals, EXP, and profile (without advancing realm).
    if (
      isReady &&
      userHadBreakthroughIntent &&
      lastFailureIdx >= 0 &&
      explicitBacklashOrFailureInStory &&
      !recentManualFailureAlreadyRecorded
    ) {
      const storyOdds = calculateBreakthroughOdds(profile, {
        sceneText: `${userText}\n${assistantText}`,
      });
      const storyStats = computeCharacterStats(profile);
      const prevName =
        getCultivationDisplayInfo(profile).fullLabel || profile.realmName;
      const failedSync = applyBreakthroughFailureOutcome({
        profile,
        odds: storyOdds,
        stats: {
          hp: storyStats.hp,
          maxHp: storyStats.maxHp,
          qi: storyStats.qi,
          maxQi: storyStats.maxQi,
          spirit: storyStats.spirit,
          maxSpirit: storyStats.maxSpirit,
          pillToxicity: storyStats.pillToxicity,
          breakthroughEase: storyStats.breakthroughEase,
          activeBuffs: storyStats.activeBuffs,
          hpName: storyStats.hpName,
          energyName: storyStats.energyName,
        },
        prevRealmName: prevName,
        source: 'story',
      });
      return {
        synced: true,
        reason: 'failed_synced',
        nextProfile: failedSync.nextProfile,
        prevRealmName: prevName,
        nextRealmName: prevName,
        carriedExp: 0,
        isMajorBreakthrough:
          storyOdds.bottleneckKind === 'major_bottleneck' ||
          storyOdds.bottleneckKind === 'tribulation',
        statGainsSummary: '',
        bannerMessage: failedSync.headline,
      };
    }

    if (lastSuccessIdx === -1) {
      if (sawTechniqueOnlySignal) return emptyResult('technique_only', profile);
      if (sawOtherCharacterOnly) return emptyResult('other_character', profile);
      return emptyResult(
        sawAnyBreakthroughDiscussion ? 'attempt_or_failed' : 'no_breakthrough_signal',
        profile,
      );
    }
    // Chronological safety guard: failure appeared AFTER last success mention
    return emptyResult('attempt_or_failed', profile);
  }

  // If near-full (88–99%) rather than strictly 100%, require explicit next-realm confirmation + MC attribution/intent
  let eligibleProfile = profile;
  if (!isReady) {
    if (!matchedExplicitNextStage || !matchedStrongMcAttribution) {
      return emptyResult('not_eligible', profile);
    }
    eligibleProfile = {
      ...profile,
      exp: maxExp,
      readyToBreakthrough: true,
    };
  }

  const bt = performBreakthrough(eligibleProfile, { source: 'story' });
  if (!bt.succeeded) {
    return emptyResult('not_eligible', profile);
  }

  const carryText = bt.carriedExp > 0 ? ` · giữ +${bt.carriedExp} tu vi dư` : '';
  const statsText = bt.statGainsSummary ? ` · ${bt.statGainsSummary}` : '';
  const bannerMessage = `Đột phá đồng bộ từ truyện: ${bt.prevRealmName} → ${bt.nextRealmName}${carryText}${statsText}.`;

  return {
    synced: true,
    reason: 'synced',
    nextProfile: bt.nextProfile,
    prevRealmName: bt.prevRealmName,
    nextRealmName: bt.nextRealmName,
    carriedExp: bt.carriedExp,
    isMajorBreakthrough: bt.isMajorBreakthrough,
    statGainsSummary: bt.statGainsSummary,
    bannerMessage,
  };
}

// ---------------------------------------------------------------------------
// EQUIPMENT SLOTS, MAIN CHARACTER STATS & CONSUMABLE EFFECTS ENGINE
// ---------------------------------------------------------------------------

export interface EquipmentSlotMeta {
  label: string;
  shortLabel: string;
  groupHint: string;
  emptyHint: string;
}

export const EQUIPMENT_SLOT_ORDER: readonly EquipmentSlotId[] = [
  'weapon',
  'armor',
  'accessory',
  'relic',
  'soul_vessel',
  'array_treasure',
] as const;

export const EQUIPMENT_SLOT_ORDER_BY_SYSTEM: Record<
  CultivationSystemKind,
  readonly EquipmentSlotId[]
> = {
  xianxia: [
    'weapon',
    'armor',
    'accessory',
    'relic',
    'soul_vessel',
    'array_treasure',
  ],
  xuanhuan: [
    'weapon',
    'armor',
    'accessory',
    'relic',
    'soul_vessel',
    'array_treasure',
  ],
  wuxia: ['weapon', 'armor', 'accessory', 'relic'],
};

export const EQUIPMENT_SLOT_META_BY_SYSTEM: Record<
  CultivationSystemKind,
  Record<EquipmentSlotId, EquipmentSlotMeta>
> = {
  xianxia: {
    weapon: {
      label: 'Bản mệnh pháp bảo / Phi kiếm',
      shortLabel: 'Bản mệnh / Phi kiếm',
      groupHint: 'Công phạt · Ngự kiếm',
      emptyHint: 'Chưa gắn phi kiếm hoặc pháp bảo bản mệnh',
    },
    armor: {
      label: 'Đạo bào / Linh giáp',
      shortLabel: 'Đạo bào / Linh giáp',
      groupHint: 'Hộ thể · Kháng pháp',
      emptyHint: 'Chưa khoác đạo bào, pháp y hoặc linh giáp',
    },
    accessory: {
      label: 'Thần hồn / Ngọc bội / Phù ấn',
      shortLabel: 'Ngọc bội / Phù ấn',
      groupHint: 'Hộ thần · Ngộ đạo',
      emptyHint: 'Chưa đeo ngọc bội, trâm ngọc hoặc phù ấn',
    },
    relic: {
      label: 'Trận bàn / Đỉnh / Bảo vật',
      shortLabel: 'Trận bàn / Đỉnh',
      groupHint: 'Tụ linh · Luyện đan',
      emptyHint: 'Chưa mang trận bàn, dược đỉnh hoặc bảo vật',
    },
    soul_vessel: {
      label: 'Bản mệnh / Hồn khí dưỡng thần',
      shortLabel: 'Bản mệnh / Hồn khí',
      groupHint: 'Thức hải · Nguyên thần',
      emptyHint: 'Chưa ôn dưỡng hồn đăng, hồn châu hoặc đạo ấn',
    },
    array_treasure: {
      label: 'Pháp bảo phụ / Trận đồ',
      shortLabel: 'Pháp bảo / Trận đồ',
      groupHint: 'Trấn áp · Bố trận',
      emptyHint: 'Chưa tế luyện ấn bảo, cổ kính hoặc tiên trận đồ',
    },
  },
  xuanhuan: {
    weapon: {
      label: 'Bản mệnh thần binh / Khí đạo',
      shortLabel: 'Thần binh / Khí đạo',
      groupHint: 'Chiến phạt · Khí đạo',
      emptyHint: 'Chưa trang bị thần binh, chiến đao hoặc khí đạo',
    },
    armor: {
      label: 'Chiến giáp / Hộ thân chi bảo',
      shortLabel: 'Chiến giáp / Hộ bảo',
      groupHint: 'Hộ thân · Ngự lực',
      emptyHint: 'Chưa khoác chiến giáp hoặc hộ thân chi bảo',
    },
    accessory: {
      label: 'Hồn hải / Đạo ấn / Linh vật',
      shortLabel: 'Hồn hải / Đạo ấn',
      groupHint: 'Thức hải · Lĩnh ngộ',
      emptyHint: 'Chưa đeo đạo ấn, linh vật hoặc ngọc hộ hồn',
    },
    relic: {
      label: 'Trận đồ / Luyện khí lô / Chí bảo',
      shortLabel: 'Trận đồ / Khí lô',
      groupHint: 'Luyện khí · Tụ huyền',
      emptyHint: 'Chưa gắn luyện khí lô, trận đồ hoặc chí bảo',
    },
    soul_vessel: {
      label: 'Bản mệnh hồn khí / Huyết ấn',
      shortLabel: 'Bản mệnh / Hồn khí',
      groupHint: 'Bản mệnh · Hồn lực',
      emptyHint: 'Chưa tế luyện hồn khí bản mệnh hoặc huyết ấn',
    },
    array_treasure: {
      label: 'Chí bảo phụ / Trận đồ cổ khí',
      shortLabel: 'Pháp bảo / Trận đồ',
      groupHint: 'Trấn giới · Cổ trận',
      emptyHint: 'Chưa gắn chí bảo phụ, bảo tháp hoặc cổ trận đồ',
    },
  },
  wuxia: {
    weapon: {
      label: 'Binh khí chủ lực',
      shortLabel: 'Binh khí',
      groupHint: 'Đao kiếm · Công kích',
      emptyHint: 'Chưa đeo kiếm, đao hoặc binh khí tùy thân',
    },
    armor: {
      label: 'Y giáp / Nội giáp hộ thân',
      shortLabel: 'Y giáp',
      groupHint: 'Hộ thân · Kháng chưởng',
      emptyHint: 'Chưa mặc nhuyễn giáp hoặc y phục phòng thân',
    },
    accessory: {
      label: 'Ngọc bội / Tín vật môn phái',
      shortLabel: 'Ngọc bội / Tín vật',
      groupHint: 'Tĩnh tâm · Tín vật',
      emptyHint: 'Chưa đeo ngọc bội, lệnh bài hoặc tín vật',
    },
    relic: {
      label: 'Ám khí / Độc dược / Trận cơ',
      shortLabel: 'Ám khí / Trận cơ',
      groupHint: 'Cơ quan · Phòng thân',
      emptyHint: 'Chưa mang ám khí, túi độc hoặc trận cơ phòng thân',
    },
    soul_vessel: {
      label: 'Hồn khí / Bảo vật tâm pháp',
      shortLabel: 'Hồn khí / Bảo vật',
      groupHint: 'Tâm thần · Hộ niệm',
      emptyHint: 'Chưa mang bảo vật dưỡng thần',
    },
    array_treasure: {
      label: 'Pháp bảo / Trận đồ cổ khí',
      shortLabel: 'Pháp bảo / Trận đồ',
      groupHint: 'Trận cơ · Kỳ bảo',
      emptyHint: 'Chưa mang trận đồ hoặc kỳ bảo phụ trợ',
    },
  },
};

/** Default slot metadata (Tiên hiệp) preserved for backward compatibility. */
export const EQUIPMENT_SLOT_META: Record<EquipmentSlotId, EquipmentSlotMeta> =
  EQUIPMENT_SLOT_META_BY_SYSTEM.xianxia;

/**
 * Returns the active equipment slots for a given genre, preserving any extra slot
 * that already holds an equipped item (e.g. after switching systemKind).
 */
export function getEquipmentSlotOrder(
  systemKind: CultivationSystemKind = 'xianxia',
  equipment?: EquipmentMap,
): EquipmentSlotId[] {
  const base = EQUIPMENT_SLOT_ORDER_BY_SYSTEM[systemKind] || EQUIPMENT_SLOT_ORDER_BY_SYSTEM.xianxia;
  const result: EquipmentSlotId[] = [...base];
  if (equipment) {
    for (const slot of EQUIPMENT_SLOT_ORDER) {
      if (equipment[slot] && !result.includes(slot)) {
        result.push(slot);
      }
    }
  }
  return result;
}

export function getEquipmentSlotMeta(
  slot: EquipmentSlotId,
  systemKind: CultivationSystemKind = 'xianxia',
): EquipmentSlotMeta {
  const table =
    EQUIPMENT_SLOT_META_BY_SYSTEM[systemKind] ||
    EQUIPMENT_SLOT_META_BY_SYSTEM.xianxia;
  return table[slot] || EQUIPMENT_SLOT_META_BY_SYSTEM.xianxia[slot];
}

export function getEquipmentBoardTitle(systemKind: CultivationSystemKind): {
  title: string;
  subtitle: string;
  bagButtonLabel: string;
} {
  if (systemKind === 'wuxia') {
    return {
      title: 'Trang bị giang hồ đang đeo',
      subtitle: 'Kiếm hiệp · Binh khí & hộ thân',
      bagButtonLabel: 'Đổi đồ trong túi →',
    };
  }
  if (systemKind === 'xuanhuan') {
    return {
      title: 'Thần binh & Trang bị đang đeo',
      subtitle: 'Huyền huyễn · Khí đạo, hồn khí & chí bảo',
      bagButtonLabel: 'Đổi bảo vật →',
    };
  }
  return {
    title: 'Pháp bảo & Trang bị đang đeo',
    subtitle: 'Tiên hiệp · Bản mệnh, đạo bào & trận bảo',
    bagButtonLabel: 'Đổi pháp bảo →',
  };
}

/**
 * Determines which equipment slot an item belongs to, or null if the item is
 * a consumable / material / herb / single-use talisman (not wearable/equippable).
 */
export function getItemEquipmentSlot(
  item: Pick<InventoryItem, 'name' | 'category' | 'description' | 'equipSlot'>,
  systemKind: CultivationSystemKind = 'xianxia',
): EquipmentSlotId | null {
  const hasExtendedSlots = systemKind === 'xianxia' || systemKind === 'xuanhuan';

  if (item.equipSlot && VALID_EQUIPMENT_SLOTS.has(item.equipSlot)) {
    if (!hasExtendedSlots) {
      if (item.equipSlot === 'soul_vessel') return 'accessory';
      if (item.equipSlot === 'array_treasure') return 'relic';
    }
    return item.equipSlot;
  }
  const text = `${item.name} ${item.description || ''}`.toLowerCase();

  // Outfits & martial armor always belong to the 'armor' slot
  if (item.category === 'outfit') {
    return 'armor';
  }

  // Pills, herbs, and spirit stones are strictly consumable/resources, never worn as gear
  if (
    item.category === 'consumable' ||
    item.category === 'herb' ||
    item.category === 'material'
  ) {
    return null;
  }

  const soulVesselRegex =
    /(?:hồn\s*khí|hồn\s*đăng|định\s*hồn|trấn\s*hồn|hồn\s*châu|hồn\s*ấn|nguyên\s*thần\s*ấn|đạo\s*ấn|huyết\s*ấn|tụ\s*hồn|bản\s*mệnh\s*châu|linh\s*châu)/i;
  const arrayTreasureRegex =
    /(?:phiên\s*thiên\s*ấn|bảo\s*ấn|pháp\s*ấn|trận\s*đồ|tiên\s*trận|cổ\s*trận|cổ\s*đồng\s*kính|linh\s*kính|bảo\s*tháp|cổ\s*tháp|trấn\s*tháp|chuông|linh\s*chung|càn\s*khôn|hồ\s*lô|pháp\s*bảo\s*phụ)/i;
  const accessoryRegex =
    /(?:ngọc\s*bội|hộ\s*tâm\s*bội|tĩnh\s*tâm\s*bội|ngự\s*khí\s*bội|trâm|nhẫn|vòng|khuyên|bội\b|chuỗi\s*hạt|hộ\s*phù\s*ngọc|phù\s*ấn|tín\s*vật|lệnh\s*bài|mật\s*lệnh)/i;
  const armorRegex =
    /(?:giáp|pháp\s*y|chiến\s*y|đạo\s*bào|áo\b|thuẫn|khôi|hộ\s*uyển|hộ\s*giáp|hộ\s*thân\s*chi\s*bảo|hiệp\s*khách\s*phục|dạ\s*hành\s*y|phi\s*ngư\s*phục|cẩm\s*bào|vũ\s*y|áo\s*choàng|hồ\s*cừu|thư\s*sinh\s*bào|trường\s*bào|y\s*phục)/i;
  const relicRegex =
    /(?:đỉnh|đan\s*lô|lô\s*luyện|luyện\s*khí\s*lô|dược\s*đỉnh|đai|trận\s*bàn|trận\s*kỳ|ám\s*khí|trận\s*cơ|túi\s*độc|kính|hồ\s*lô|tháp|chuông|lê\s*hoa\s*châm|khổng\s*tước\s*linh|mặt\s*nạ(?:\s*da\s*người)?|phi\s*trảo|dây\s*tơ\s*tằm)/i;

  if (item.category === 'weapon') {
    const nameLower = item.name.toLowerCase();
    // Prioritize explicit item type from name before falling back to description
    if (hasExtendedSlots && soulVesselRegex.test(nameLower)) {
      return 'soul_vessel';
    }
    if (hasExtendedSlots && arrayTreasureRegex.test(nameLower)) {
      return 'array_treasure';
    }
    if (accessoryRegex.test(nameLower)) {
      return 'accessory';
    }
    if (armorRegex.test(nameLower)) {
      return 'armor';
    }
    if (relicRegex.test(nameLower)) {
      return 'relic';
    }
    // Check full description if name itself wasn't specialized (e.g. swords stay weapon first!)
    if (
      /(?:kiếm|đao|thương|kích|cung|phủ|bút|tiêu|sáo|quạt|trượng|bổng|thần\s*binh|phi\s*kiếm)/i.test(
        nameLower,
      )
    ) {
      return 'weapon';
    }
    if (hasExtendedSlots && soulVesselRegex.test(text)) {
      return 'soul_vessel';
    }
    if (hasExtendedSlots && arrayTreasureRegex.test(text)) {
      return 'array_treasure';
    }
    if (accessoryRegex.test(text)) {
      return 'accessory';
    }
    if (armorRegex.test(text)) {
      return 'armor';
    }
    if (relicRegex.test(text)) {
      return 'relic';
    }
    return 'weapon';
  }

  if (item.category === 'talisman') {
    // Manuals & scrolls (tàn quyển, thủ chép, cầm phổ, cổ phổ, ngọc giản, bí kíp) are studied via "Dùng",
    // whereas jade pendants, command badges, arrays, and formation relics are equippable.
    if (
      /(?:tàn\s*quyển|thủ\s*chép|cầm\s*phổ|cổ\s*phổ|bí\s*kíp|ngọc\s*giản|đan\s*phương)/i.test(
        item.name.toLowerCase(),
      )
    ) {
      return null;
    }
    if (hasExtendedSlots && /(?:trận\s*đồ|tiên\s*trận|cổ\s*trận)/i.test(text)) {
      return 'array_treasure';
    }
    if (/(?:ngọc\s*bội|bội\b|lệnh\s*bài|mật\s*lệnh|tín\s*vật)/i.test(text)) {
      return 'accessory';
    }
    if (/(?:trận\s*bàn|trận\s*đồ|trận\s*kỳ|đai|trận\s*cơ)/i.test(text)) {
      return 'relic';
    }
    return null;
  }

  // Misc fallback: only treat explicitly named gear as equippable
  if (hasExtendedSlots && soulVesselRegex.test(text)) return 'soul_vessel';
  if (hasExtendedSlots && arrayTreasureRegex.test(text)) return 'array_treasure';
  if (armorRegex.test(text)) return 'armor';
  if (accessoryRegex.test(text)) return 'accessory';
  if (relicRegex.test(text)) return 'relic';
  if (/(?:linh\s*kiếm|phi\s*kiếm|trường\s*kiếm|chiến\s*đao|thần\s*binh|pháp\s*bảo|binh\s*khí)/i.test(text)) {
    return 'weapon';
  }
  return null;
}

export function isItemEquippable(
  item: Pick<InventoryItem, 'name' | 'category' | 'description' | 'equipSlot'>,
  systemKind: CultivationSystemKind = 'xianxia',
): boolean {
  return getItemEquipmentSlot(item, systemKind) !== null;
}

export interface EquipmentStatBonuses {
  atk: number;
  def: number;
  agi: number;
  maxHp: number;
  maxQi: number;
  maxSpirit: number;
  insight: number;
  fame: number;
  summary: string;
}

export function getEquipmentItemBonuses(
  item: Pick<InventoryItem, 'name' | 'category' | 'quality' | 'description' | 'equipSlot'>,
  slotOverride?: EquipmentSlotId,
  systemKind: CultivationSystemKind = 'xianxia',
): EquipmentStatBonuses {
  const slot = slotOverride || getItemEquipmentSlot(item, systemKind);
  if (!slot) {
    return {
      atk: 0,
      def: 0,
      agi: 0,
      maxHp: 0,
      maxQi: 0,
      maxSpirit: 0,
      insight: 0,
      fame: 0,
      summary: '',
    };
  }

  const multByQuality: Record<InventoryItemQuality, number> = {
    common: 1,
    uncommon: 1.8,
    rare: 3.1,
    epic: 5.2,
    legendary: 8.5,
    immortal: 13.5,
  };
  const m = multByQuality[item.quality] || 1;
  const text = `${item.name} ${item.description || ''}`.toLowerCase();

  let atk = 0;
  let def = 0;
  let agi = 0;
  let maxHp = 0;
  let maxQi = 0;
  let maxSpirit = 0;
  let insight = 0;
  let fame = 0;

  if (slot === 'weapon') {
    atk = Math.round(14 * m);
    maxQi = Math.round(12 * m);
    agi = /phi\s*kiếm|phong|nhanh|tiên|nhuyễn\s*kiếm|tiêu/i.test(text)
      ? Math.round(4 * m)
      : Math.round(2 * m);
    maxSpirit = /ấn|tiên|cổ|thần\s*binh|ỷ\s*thiên|đồ\s*long/i.test(text)
      ? Math.round(8 * m)
      : 0;
    if (/ỷ\s*thiên|đồ\s*long|đả\s*cẩu\s*bổng|huyền\s*thiết/i.test(text)) {
      fame = Math.round(9 * m);
    } else if (item.quality !== 'common') {
      fame = Math.round(4 * m);
    }
  } else if (slot === 'armor') {
    def = Math.round(15 * m);
    maxHp = Math.round(45 * m);
    maxQi = Math.round(8 * m);
    const isAgileGarb = /dạ\s*hành|lăng\s*la|vũ\s*y|bạch\s*y\s*thắng\s*tuyết|hiệp\s*khách/i.test(
      text,
    );
    if (isAgileGarb) {
      agi = Math.round(3.5 * m);
    }
    const isLuxuryOutfit =
      item.category === 'outfit' ||
      /(?:phi\s*ngư|cẩm\s*bào|vũ\s*y|bạch\s*y\s*thắng\s*tuyết|hiệp\s*khách|hồ\s*cừu|đạo\s*bào|kim\s*ti|nhuyễn\s*vị)/i.test(
        text,
      );
    if (isLuxuryOutfit) {
      if (item.quality === 'common') {
        fame = 2;
      } else if (/phi\s*ngư|lưu\s*vân|lăng\s*la|bạch\s*y\s*thắng\s*tuyết|kim\s*ti/i.test(text)) {
        fame = Math.round(9 * m);
      } else {
        fame = Math.round(6 * m);
      }
    } else if (item.quality !== 'common') {
      fame = Math.round(3 * m);
    }
  } else if (slot === 'accessory') {
    maxSpirit = Math.round(18 * m);
    insight = Math.max(1, Math.round(2.5 * m));
    def = Math.round(5 * m);
    agi = Math.round(4 * m);
    fame =
      /lệnh\s*bài|mật\s*lệnh|thanh\s*long|cẩm\s*y\s*vệ/i.test(text)
        ? Math.round(8 * m)
        : item.quality !== 'common'
          ? Math.round(5 * m)
          : 1;
  } else if (slot === 'soul_vessel') {
    maxSpirit = Math.round(24 * m);
    insight = Math.max(2, Math.round(3.2 * m));
    maxQi = Math.round(16 * m);
    atk = Math.round(6 * m);
    fame = item.quality !== 'common' ? Math.round(4 * m) : 0;
  } else if (slot === 'array_treasure') {
    atk = Math.round(11 * m);
    def = Math.round(11 * m);
    maxQi = Math.round(18 * m);
    maxSpirit = Math.round(10 * m);
    insight = /trận|ấn|kính|tháp/i.test(text) ? Math.max(1, Math.round(1.8 * m)) : 0;
    fame = item.quality !== 'common' ? Math.round(4 * m) : 0;
  } else {
    // relic (đỉnh, trận bàn, khí lô, ám khí / trận cơ / đồ hành tẩu)
    const isDisguise = /mặt\s*nạ|dịch\s*dung/i.test(text);
    def = Math.round(9 * m);
    maxQi = Math.round(22 * m);
    maxSpirit = Math.round(12 * m);
    atk = /ấn|trận\s*đồ|kính|ám\s*khí|lê\s*hoa\s*châm|khổng\s*tước\s*linh/i.test(text)
      ? Math.round(10 * m)
      : Math.round(3 * m);
    agi = isDisguise || /phi\s*trảo|dây\s*tơ\s*tằm/i.test(text) ? Math.round(5 * m) : 0;
    insight = /đỉnh|đan\s*lô|khí\s*lô|trận/i.test(text) ? Math.max(1, Math.round(2 * m)) : 0;
    fame = isDisguise
      ? 0
      : /khổng\s*tước\s*linh|lê\s*hoa\s*châm/i.test(text)
        ? Math.round(8 * m)
        : item.quality !== 'common'
          ? Math.round(3 * m)
          : 0;
  }

  const qiLabel =
    systemKind === 'wuxia'
      ? 'Nội lực'
      : systemKind === 'xuanhuan'
        ? 'Huyền lực'
        : 'Linh lực';
  const spiritLabel = systemKind === 'wuxia' ? 'Tinh thần' : 'Thần thức';

  const parts: string[] = [];
  if (atk > 0) parts.push(`+${atk} Công`);
  if (def > 0) parts.push(`+${def} Thủ`);
  if (agi > 0) parts.push(`+${agi} Thân pháp`);
  if (maxHp > 0) parts.push(`+${maxHp} Khí huyết`);
  if (maxQi > 0) parts.push(`+${maxQi} ${qiLabel}`);
  if (maxSpirit > 0) parts.push(`+${maxSpirit} ${spiritLabel}`);
  if (insight > 0) parts.push(`+${insight} Ngộ tính`);
  if (fame > 0) parts.push(`+${fame} Danh tiếng`);

  return {
    atk,
    def,
    agi,
    maxHp,
    maxQi,
    maxSpirit,
    insight,
    fame,
    summary: parts.join(' · '),
  };
}

export function getEquippedSlotForItem(
  profile: CultivationProfile,
  itemId: string,
): EquipmentSlotId | null {
  const eq = profile.equipment;
  if (!eq) return null;
  for (const slot of EQUIPMENT_SLOT_ORDER) {
    if (eq[slot] === itemId) return slot;
  }
  return null;
}

export interface CharacterComputedStats {
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  spirit: number;
  maxSpirit: number;
  atk: number;
  equipAtk: number;
  def: number;
  equipDef: number;
  agi: number;
  equipAgi: number;
  insight: number;
  equipInsight: number;
  fame: number;
  equipFame: number;
  spiritStoneTotal: number;
  currencyLabel: string;
  pillToxicity: number;
  breakthroughEase: number;
  activeBuffs: string[];
  equippedCount: number;
  energyName: string;
  hpName: string;
}

/**
 * Dynamically computes all Main Character stats from Realm, Techniques, Equipped Gear,
 * Permanent Pill/Treasure Bonuses, Inventory Currency, and Ranking Fame.
 */
export function computeCharacterStats(
  profile: CultivationProfile,
): CharacterComputedStats {
  const rIdx = Math.max(0, profile.realmIndex || 0);
  const scale = 1 + rIdx * 0.42 + Math.pow(rIdx, 1.32) * 0.16;

  // Base attributes from realm
  const baseMaxHp = Math.round(120 * scale);
  const baseMaxQi = Math.round(100 * scale);
  const baseMaxSpirit = Math.round(60 * (1 + rIdx * 0.36 + Math.pow(rIdx, 1.2) * 0.12));
  const baseAtk = Math.round(24 * scale);
  const baseDef = Math.round(18 * scale);
  const baseAgi = Math.round(20 * (1 + rIdx * 0.3));
  const baseInsight = Math.round(16 + rIdx * 2.2);

  // Contributions from practiced techniques
  let techAtk = 0;
  let techDef = 0;
  let techAgi = 0;
  let techQi = 0;
  let techSpirit = 0;
  let techInsight = 0;
  for (const t of profile.techniques || []) {
    const tierMult = TECHNIQUE_TIER_META[t.tier]?.speedMultiplier || 1;
    const lvScore = (t.level + (t.mastery || 0) / 100) * tierMult;
    if (t.category === 'mental') {
      techQi += Math.round(lvScore * 12);
      techSpirit += Math.round(lvScore * 5);
      techInsight += Math.round(lvScore * 0.9);
      techDef += Math.round(lvScore * 2.5);
    } else if (t.category === 'martial') {
      techAtk += Math.round(lvScore * 6.5);
    } else if (t.category === 'movement') {
      techAgi += Math.round(lvScore * 6);
      techDef += Math.round(lvScore * 2);
    } else {
      techAtk += Math.round(lvScore * 4.5);
      techSpirit += Math.round(lvScore * 6);
      techInsight += Math.round(lvScore * 1.1);
    }
  }

  // Contributions from equipped gear
  let equipAtk = 0;
  let equipDef = 0;
  let equipAgi = 0;
  let equipHp = 0;
  let equipQi = 0;
  let equipSpirit = 0;
  let equipInsight = 0;
  let equipFame = 0;
  let equippedCount = 0;

  const eq = profile.equipment || {};
  for (const slot of EQUIPMENT_SLOT_ORDER) {
    const boundId = eq[slot];
    if (!boundId) continue;
    const found = profile.inventory.find((i) => i.id === boundId);
    if (!found) continue;
    equippedCount += 1;
    const bonus = getEquipmentItemBonuses(found, slot, profile.systemKind);
    equipAtk += bonus.atk;
    equipDef += bonus.def;
    equipAgi += bonus.agi;
    equipHp += bonus.maxHp;
    equipQi += bonus.maxQi;
    equipSpirit += bonus.maxSpirit;
    equipInsight += bonus.insight;
    equipFame += bonus.fame;
  }

  // Subtle, authentic stat synergy from Linh căn · Thể chất · Căn cơ
  const cState = profile.constitution;
  const rootQiBonus = cState
    ? Math.max(0, Math.round((cState.spiritRoot.purity - 40) * 0.75 * (1 + rIdx * 0.08)))
    : 0;
  const rootInsightBonus = cState
    ? Math.max(0, Math.round((cState.spiritRoot.purity - 45) * 0.14))
    : 0;
  const phyHpBonus = cState
    ? Math.max(0, Math.round((cState.physique.refinement - 28) * 1.15 * (1 + rIdx * 0.08)))
    : 0;
  const phyDefBonus = cState
    ? Math.max(0, Math.round((cState.physique.refinement - 32) * 0.18))
    : 0;
  const fndSpiritBonus = cState
    ? Math.max(0, Math.round((cState.foundation.solidity - 55) * 0.5))
    : 0;

  const v = profile.vitals || {};
  const maxHp = Math.max(50, baseMaxHp + equipHp + phyHpBonus);
  const maxQi = Math.max(40, baseMaxQi + techQi + equipQi + rootQiBonus);
  const maxSpirit = Math.max(30, baseMaxSpirit + techSpirit + equipSpirit + fndSpiritBonus);

  const hp =
    typeof v.hp === 'number' && Number.isFinite(v.hp)
      ? Math.max(0, Math.min(maxHp, Math.round(v.hp)))
      : maxHp;
  const qi =
    typeof v.qi === 'number' && Number.isFinite(v.qi)
      ? Math.max(0, Math.min(maxQi, Math.round(v.qi)))
      : maxQi;
  const spirit =
    typeof v.spirit === 'number' && Number.isFinite(v.spirit)
      ? Math.max(0, Math.min(maxSpirit, Math.round(v.spirit)))
      : maxSpirit;

  const atk = baseAtk + techAtk + equipAtk + (v.bonusAtk || 0);
  const def = baseDef + techDef + equipDef + phyDefBonus + (v.bonusDef || 0);
  const agi = baseAgi + techAgi + equipAgi + (v.bonusAgi || 0);
  const insight =
    baseInsight + techInsight + equipInsight + rootInsightBonus + (v.bonusInsight || 0);

  // Fame from vitals + ranking board + equipped prestige gear
  const mcRankEntry = (profile.rankings || []).find((e) => e.isMc);
  const rankingFame = mcRankEntry?.fameScore || (mcRankEntry ? Math.max(30, (11 - mcRankEntry.rank) * 18) : 0);
  const fame = Math.max(0, (v.fame || 0) + rankingFame + equipFame + rIdx * 8);

  // Count spirit stones / currency
  let spiritStoneTotal = 0;
  let currencyLabel =
    profile.systemKind === 'wuxia'
      ? 'Ngân lượng (lượng bạc)'
      : profile.systemKind === 'xuanhuan'
        ? 'Huyền Tinh'
        : 'Linh thạch';

  if (profile.systemKind === 'wuxia') {
    spiritStoneTotal = computeWuxiaSilverBalance(profile.inventory).totalTaels;
  } else {
    for (const item of profile.inventory) {
      const lower = item.name.toLowerCase();
      if (/(?:linh\s*thạch|huyền\s*tinh|nguyên\s*thạch|bạc|vàng)/i.test(lower)) {
        let weight = 1;
        if (/cực\s*phẩm/i.test(lower)) weight = 1000;
        else if (/thượng\s*phẩm/i.test(lower)) weight = 100;
        else if (/trung\s*phẩm/i.test(lower)) weight = 10;
        else if (/vụn/i.test(lower)) weight = 0.2;
        spiritStoneTotal += Math.max(1, Math.round(item.quantity * weight));
      }
    }
  }

  return {
    hp,
    maxHp,
    qi,
    maxQi,
    spirit,
    maxSpirit,
    atk,
    equipAtk,
    def,
    equipDef,
    agi,
    equipAgi,
    insight,
    equipInsight,
    fame,
    equipFame,
    spiritStoneTotal,
    currencyLabel,
    pillToxicity: Math.max(0, Math.min(100, Math.round(v.pillToxicity || 0))),
    breakthroughEase: Math.max(0, Math.min(100, Math.round(v.breakthroughEase || 0))),
    activeBuffs: Array.isArray(v.activeBuffs) ? v.activeBuffs : [],
    equippedCount,
    energyName:
      profile.systemKind === 'wuxia'
        ? 'Nội lực / Chân khí'
        : profile.systemKind === 'xuanhuan'
          ? 'Huyền lực'
          : 'Linh lực',
    hpName: profile.systemKind === 'wuxia' ? 'Sinh lực / Khí huyết' : 'Khí huyết / Sinh lực',
  };
}

export interface EquipActionResult {
  ok: boolean;
  error?: string;
  nextProfile: CultivationProfile;
  slot?: EquipmentSlotId;
  itemName: string;
  replacedItemName?: string;
  effectLines: string[];
  headline: string;
  storyPrompt: string;
}

export function equipInventoryItem(
  profile: CultivationProfile,
  itemId: string,
  targetSlot?: EquipmentSlotId,
): EquipActionResult {
  const target = profile.inventory.find((i) => i.id === itemId);
  if (!target) {
    return {
      ok: false,
      error: 'Không tìm thấy vật phẩm trong túi đồ.',
      nextProfile: profile,
      itemName: '',
      effectLines: [],
      headline: '',
      storyPrompt: '',
    };
  }
  const slot =
    targetSlot && VALID_EQUIPMENT_SLOTS.has(targetSlot)
      ? targetSlot
      : getItemEquipmentSlot(target, profile.systemKind);
  if (!slot) {
    return {
      ok: false,
      error: `"${target.name}" là vật phẩm tiêu hao/tài nguyên, không thể trang bị lên người.`,
      nextProfile: profile,
      itemName: target.name,
      effectLines: [],
      headline: '',
      storyPrompt: '',
    };
  }

  const prevSlotItemId = profile.equipment?.[slot];
  if (prevSlotItemId === target.id) {
    return {
      ok: false,
      error: `"${target.name}" hiện đã được trang bị sẵn.`,
      nextProfile: profile,
      slot,
      itemName: target.name,
      effectLines: [],
      headline: '',
      storyPrompt: '',
    };
  }

  const replacedItem = prevSlotItemId
    ? profile.inventory.find((i) => i.id === prevSlotItemId)
    : undefined;

  const beforeStats = computeCharacterStats(profile);
  const nextEquipment: EquipmentMap = {
    ...(profile.equipment || {}),
  };
  // Ensure the same item isn't bound to two different slots at once
  for (const s of EQUIPMENT_SLOT_ORDER) {
    if (nextEquipment[s] === target.id) {
      delete nextEquipment[s];
    }
  }
  nextEquipment[slot] = target.id;

  const draftNext: CultivationProfile = {
    ...profile,
    equipment: nextEquipment,
    lastUpdatedAt: Date.now(),
  };
  const afterStats = computeCharacterStats(draftNext);

  const effectLines: string[] = [];
  const pushDelta = (label: string, delta: number) => {
    if (delta !== 0) {
      effectLines.push(`${label} ${delta > 0 ? '+' : ''}${delta}`);
    }
  };
  pushDelta('Công kích', afterStats.atk - beforeStats.atk);
  pushDelta('Phòng thủ', afterStats.def - beforeStats.def);
  pushDelta('Thân pháp', afterStats.agi - beforeStats.agi);
  pushDelta('Khí huyết tối đa', afterStats.maxHp - beforeStats.maxHp);
  pushDelta(`${afterStats.energyName} tối đa`, afterStats.maxQi - beforeStats.maxQi);
  pushDelta(
    profile.systemKind === 'wuxia' ? 'Tinh thần tối đa' : 'Thần thức tối đa',
    afterStats.maxSpirit - beforeStats.maxSpirit,
  );
  pushDelta('Ngộ tính', afterStats.insight - beforeStats.insight);
  pushDelta('Danh tiếng', afterStats.fame - beforeStats.fame);

  const slotLabel = getEquipmentSlotMeta(slot, profile.systemKind).shortLabel;
  const qLabel = getInventoryQualityMeta(
    target.quality,
    profile.systemKind,
  ).shortLabel;
  const headline = replacedItem
    ? `Đã trang bị "${target.name}" (${qLabel}) vào ô ${slotLabel} (thay cho "${replacedItem.name}")`
    : `Đã trang bị "${target.name}" (${qLabel}) vào ô ${slotLabel}`;

  draftNext.lastItemFeedback = `${headline}${effectLines.length ? ` · ${effectLines.join(', ')}` : ''}.`;

  const actionVerb =
    slot === 'armor'
      ? profile.systemKind === 'wuxia'
        ? 'chỉnh lại y phục, khoác lên người'
        : 'khoác lên người'
      : slot === 'accessory'
        ? 'đeo lên thân'
        : slot === 'soul_vessel'
          ? 'tế luyện và đưa vào thức hải ôn dưỡng'
          : slot === 'array_treasure'
            ? 'khai mở cấm chế và tế luyện bên mình'
            : slot === 'relic'
              ? profile.systemKind === 'wuxia'
                ? 'giắt vào người'
                : 'mang theo bên mình và kích hoạt khí tức của'
              : profile.systemKind === 'wuxia'
                ? 'lấy ra và đeo bên mình'
                : 'lấy ra tế luyện bản mệnh và trang bị';
  const storyPrompt =
    profile.systemKind === 'wuxia'
      ? `Ta mở ${profile.bagName.toLowerCase()}, ${actionVerb} "${target.name}" (${qLabel})${
          replacedItem ? ` thay cho "${replacedItem.name}"` : ''
        }, để lộ khí chất và trang bị ra bên ngoài.`
      : `Ta mở ${profile.bagName.toLowerCase()}, ${actionVerb} "${target.name}" (${qLabel})${
          replacedItem ? ` thay cho "${replacedItem.name}"` : ''
        }, cảm nhận luồng khí tức dung hòa cùng thân thể.`;

  return {
    ok: true,
    nextProfile: draftNext,
    slot,
    itemName: target.name,
    replacedItemName: replacedItem?.name,
    effectLines,
    headline,
    storyPrompt,
  };
}

export function unequipInventorySlot(
  profile: CultivationProfile,
  slot: EquipmentSlotId,
): EquipActionResult {
  const slotLabel = getEquipmentSlotMeta(slot, profile.systemKind).shortLabel;
  const boundId = profile.equipment?.[slot];
  if (!boundId) {
    return {
      ok: false,
      error: `Ô ${slotLabel} hiện đang trống.`,
      nextProfile: profile,
      slot,
      itemName: '',
      effectLines: [],
      headline: '',
      storyPrompt: '',
    };
  }
  const target = profile.inventory.find((i) => i.id === boundId);
  const beforeStats = computeCharacterStats(profile);
  const nextEquipment: EquipmentMap = { ...(profile.equipment || {}) };
  delete nextEquipment[slot];

  const draftNext: CultivationProfile = {
    ...profile,
    equipment: Object.keys(nextEquipment).length > 0 ? nextEquipment : undefined,
    lastUpdatedAt: Date.now(),
  };
  const afterStats = computeCharacterStats(draftNext);

  const effectLines: string[] = [];
  const pushDelta = (label: string, delta: number) => {
    if (delta !== 0) {
      effectLines.push(`${label} ${delta > 0 ? '+' : ''}${delta}`);
    }
  };
  pushDelta('Công kích', afterStats.atk - beforeStats.atk);
  pushDelta('Phòng thủ', afterStats.def - beforeStats.def);
  pushDelta('Thân pháp', afterStats.agi - beforeStats.agi);
  pushDelta('Khí huyết tối đa', afterStats.maxHp - beforeStats.maxHp);
  pushDelta(`${afterStats.energyName} tối đa`, afterStats.maxQi - beforeStats.maxQi);
  pushDelta(
    profile.systemKind === 'wuxia' ? 'Tinh thần tối đa' : 'Thần thức tối đa',
    afterStats.maxSpirit - beforeStats.maxSpirit,
  );
  pushDelta('Ngộ tính', afterStats.insight - beforeStats.insight);
  pushDelta('Danh tiếng', afterStats.fame - beforeStats.fame);

  const itemName = target?.name || 'Trang bị';
  const headline = `Đã tháo "${itemName}" khỏi ô ${slotLabel} và cất lại vào ${profile.bagName}`;
  draftNext.lastItemFeedback = `${headline}${effectLines.length ? ` (${effectLines.join(', ')})` : ''}.`;

  const storyPrompt =
    slot === 'soul_vessel'
      ? `Ta thu hồi "${itemName}" từ thức hải, cẩn thận cất lại vào ${profile.bagName.toLowerCase()}.`
      : `Ta tháo "${itemName}" đang mang trên người, cẩn thận cất kín lại vào ${profile.bagName.toLowerCase()}.`;

  return {
    ok: true,
    nextProfile: draftNext,
    slot,
    itemName,
    effectLines,
    headline,
    storyPrompt,
  };
}

export interface ConsumeItemResult {
  nextProfile: CultivationProfile;
  itemName: string;
  remainingQty: number;
  expBonus: number;
  overflowAdded: number;
  hitCap: boolean;
  effectLines: string[];
  constitutionChanges?: string[];
  headline: string;
  storyPrompt: string;
  toxicityWarning?: string;
  blockedEquippable?: boolean;
}

export function consumeInventoryItem(
  profile: CultivationProfile,
  itemId: string,
): ConsumeItemResult {
  const target = profile.inventory.find((i) => i.id === itemId);
  if (!target) {
    return {
      nextProfile: profile,
      itemName: '',
      remainingQty: 0,
      expBonus: 0,
      overflowAdded: 0,
      hitCap: false,
      effectLines: [],
      headline: '',
      storyPrompt: '',
    };
  }

  // Never destroy equippable gear through consume!
  if (isItemEquippable(target, profile.systemKind)) {
    return {
      nextProfile: profile,
      itemName: target.name,
      remainingQty: target.quantity,
      expBonus: 0,
      overflowAdded: 0,
      hitCap: false,
      effectLines: [],
      headline: `"${target.name}" là trang bị — hãy bấm Trang bị / Tháo thay vì tiêu hao.`,
      storyPrompt: '',
      blockedEquippable: true,
    };
  }

  const remainingQty = Math.max(0, target.quantity - 1);
  const nextInventory = profile.inventory
    .map((item) =>
      item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item,
    )
    .filter((item) => item.quantity > 0);

  const statsBefore = computeCharacterStats(profile);
  const prevVitals: CharacterVitalsState = { ...(profile.vitals || {}) };
  const lower = `${target.name} ${target.description || ''}`.toLowerCase();

  const qualityTierScore: Record<InventoryItemQuality, number> = {
    common: 1,
    uncommon: 1.6,
    rare: 2.5,
    epic: 3.8,
    legendary: 5.5,
    immortal: 8.0,
  };
  const qScore = qualityTierScore[target.quality] || 1.2;

  const qualityExpMult: Record<InventoryItemQuality, number> = {
    common: 0.12,
    uncommon: 0.22,
    rare: 0.36,
    epic: 0.55,
    legendary: 0.8,
    immortal: 1.15,
  };
  const baseExpMult = qualityExpMult[target.quality] || 0.18;

  // Classify consumable effect archetype
  const isCelestialElixir = isCelestialRootElixirItem(target);
  const isBreakthroughPill =
    !isCelestialElixir &&
    /(?:trúc\s*cơ|kết\s*kim|đột\s*phá|ngưng\s*anh|hóa\s*thần|hoàn\s*hồn|đại\s*hoàn\s*đan|tục\s*mệnh\s*bát\s*bảo)/i.test(
      lower,
    );
  const isCleansePill =
    !isCelestialElixir &&
    /(?:tẩy\s*tủy|phạt\s*cốt|ngọc\s*tủy|thanh\s*liên\s*tử|giải\s*độc|thanh\s*lọc|hoán\s*cốt|dịch\s*cân|băng\s*tằm\s*tuyết\s*liên)/i.test(
      lower,
    );
  const isSpiritPill =
    !isCelestialElixir &&
    /(?:dưỡng\s*thần|ngọc\s*lộ|thần\s*thức|thanh\s*tâm|băng\s*tâm|tâm\s*ma|an\s*thần|cửu\s*hoa|trà\s*danh\s*sơn|nữ\s*nhi\s*hồng)/i.test(
      lower,
    );
  const isMeridianHeal =
    !isCelestialElixir &&
    /(?:hộ\s*mạch|kinh\s*mạch|hồi\s*xuân|kim\s*sang|trị\s*thương|khí\s*huyết|hồi\s*huyết|sinh\s*cơ|tâm\s*rễ|linh\s*chi|đoạn\s*tục\s*cao|đoạn\s*tục\s*giao|tiểu\s*hoàn\s*đan)/i.test(
      lower,
    );
  const isTalismanBuff =
    target.category === 'talisman' && /(?:phù|bùa|độn|hộ\s*thể|kim\s*cang)/i.test(lower);
  const isKnowledgeSlip =
    target.category === 'talisman' &&
    /(?:ngọc\s*giản|đan\s*phương|bí\s*kíp|tâm\s*pháp|kiếm\s*phổ|kiếm\s*ý|tàn\s*quyển|thủ\s*chép|cầm\s*phổ|cổ\s*phổ|cửu\s*âm\s*chân\s*kinh|độc\s*cô\s*cửu\s*kiếm)/i.test(
      lower,
    );
  const isSpiritStone =
    !isCelestialElixir &&
    /(?:linh\s*thạch|huyền\s*tinh|nguyên\s*thạch|tinh\s*thạch)/i.test(lower);
  const isPill = /(?:đan|hoàn|tán|cao|giao)/i.test(lower) && target.category === 'consumable';

  const effectLines: string[] = [];
  let rawPillExp = 0;
  let hpGain = 0;
  let qiGain = 0;
  let spiritGain = 0;
  let toxDelta = 0;
  let easeGain = 0;
  let addAtk = 0;
  let addDef = 0;
  let addAgi = 0;
  let addInsight = 0;
  let buffToAdd = '';
  let techMasteryNote = '';
  let nextTechniques = profile.techniques;
  let toxicityWarning: string | undefined;

  // Apply concrete Linh căn · Thể chất · Căn cơ cleansing / upgrade from this item
  const constUpgrade = applyConstitutionEffectFromItem(profile, target);

  // Pill toxicity dampens repeated pill EXP efficiency if player spams pills
  const highToxicity =
    isPill && !isCleansePill && !isCelestialElixir && statsBefore.pillToxicity >= 70;
  const toxicityEfficiency = highToxicity
    ? 0.62
    : statsBefore.pillToxicity >= 45 && isPill && !isCleansePill && !isCelestialElixir
      ? 0.85
      : 1.0;

  if (isCelestialElixir) {
    // e.g. Cửu Thiên Tiên Linh Dịch — supreme spirit-root/physique/foundation purification + rich pure energy
    rawPillExp = Math.max(25, Math.round(profile.maxExp * baseExpMult * 0.95));
    hpGain = Math.round(statsBefore.maxHp * 0.9);
    qiGain = Math.round(statsBefore.maxQi * 1.0);
    spiritGain = Math.round(statsBefore.maxSpirit * 0.8);
    toxDelta = -Math.max(25, constUpgrade.extraToxicityCleanse);
    easeGain = Math.max(16, constUpgrade.extraBreakthroughEase);
    addAtk = Math.max(3, Math.round(2.5 * qScore));
    addDef = Math.max(3, Math.round(2.8 * qScore));
    addAgi = Math.max(2, Math.round(2.0 * qScore));
    addInsight = Math.max(3, Math.round(2.6 * qScore));
    buffToAdd = `Tiên linh gột rửa (${target.name})`;
  } else if (isBreakthroughPill) {
    rawPillExp = Math.max(20, Math.round(profile.maxExp * baseExpMult * 1.1 * toxicityEfficiency));
    hpGain = Math.round(statsBefore.maxHp * 0.55);
    qiGain = Math.round(statsBefore.maxQi * 0.85);
    spiritGain = Math.round(statsBefore.maxSpirit * 0.45);
    easeGain = Math.min(65, Math.round(18 + qScore * 6));
    toxDelta = target.quality === 'immortal' ? 4 : 16;
    buffToAdd = `Dược lực trợ đột phá (${target.name})`;
  } else if (isCleansePill) {
    rawPillExp = Math.max(15, Math.round(profile.maxExp * baseExpMult * 0.75));
    hpGain = Math.round(statsBefore.maxHp * 0.6);
    qiGain = Math.round(statsBefore.maxQi * 0.5);
    toxDelta = -Math.round(28 + qScore * 5);
    easeGain = Math.max(8, constUpgrade.extraBreakthroughEase);
    addAtk = Math.max(2, Math.round(2.5 * qScore));
    addDef = Math.max(2, Math.round(2.5 * qScore));
    addAgi = Math.max(1, Math.round(2 * qScore));
    addInsight = Math.max(1, Math.round(1.5 * qScore));
    buffToAdd = 'Kinh mạch thanh thông';
  } else if (isSpiritPill) {
    rawPillExp = Math.max(12, Math.round(profile.maxExp * baseExpMult * 0.65 * toxicityEfficiency));
    spiritGain = Math.round(statsBefore.maxSpirit * 0.9);
    qiGain = Math.round(statsBefore.maxQi * 0.35);
    toxDelta = isPill ? 8 : -12;
    addInsight = Math.max(2, Math.round(2.2 * qScore));
    easeGain = Math.round(10 + qScore * 3);
    buffToAdd = profile.systemKind === 'wuxia' ? 'Tâm thần an định' : 'Đạo tâm thanh minh';
  } else if (isMeridianHeal) {
    rawPillExp = Math.max(10, Math.round(profile.maxExp * baseExpMult * 0.55 * toxicityEfficiency));
    hpGain = Math.round(statsBefore.maxHp * 0.75);
    qiGain = Math.round(statsBefore.maxQi * 0.45);
    toxDelta = isPill ? 5 : -10;
    easeGain = Math.round(12 + qScore * 2.5);
    buffToAdd = 'Hộ mạch ổn định';
  } else if (isKnowledgeSlip) {
    rawPillExp = Math.max(14, Math.round(profile.maxExp * baseExpMult * 0.5));
    addInsight = Math.max(3, Math.round(3 * qScore));
    spiritGain = Math.round(statsBefore.maxSpirit * 0.3);
    // Boost active technique mastery cleanly (respecting 99% bottleneck!)
    const activeTech =
      profile.techniques.find((t) => t.isActiveTraining) || profile.techniques[0];
    if (activeTech && activeTech.mastery < 99) {
      const gainPct = Math.min(99 - activeTech.mastery, Math.max(6, Math.round(4 + qScore * 2)));
      if (gainPct > 0) {
        nextTechniques = profile.techniques.map((t) =>
          t.id === activeTech.id ? { ...t, mastery: t.mastery + gainPct } : t,
        );
        techMasteryNote = `Lĩnh ngộ "${activeTech.name}" +${gainPct}% thuần thục`;
      }
    }
  } else if (isTalismanBuff) {
    qiGain = Math.round(statsBefore.maxQi * 0.25);
    hpGain = /hồi\s*xuân/i.test(lower) ? Math.round(statsBefore.maxHp * 0.5) : 0;
    buffToAdd = /độn/i.test(lower)
      ? 'Thổ Độn kích hoạt (+Thân pháp thoát thân)'
      : /kim\s*cang|hộ\s*thể/i.test(lower)
        ? 'Kim Cang Hộ Thuẫn (+Phòng thủ)'
        : `Phù lực: ${target.name}`;
  } else if (isSpiritStone) {
    rawPillExp = Math.max(14, Math.round(profile.maxExp * baseExpMult * 0.85));
    qiGain = Math.round(statsBefore.maxQi * 0.7);
    spiritGain = Math.round(statsBefore.maxSpirit * 0.25);
    toxDelta = 0; // Pure spirit energy, zero pill toxicity!
  } else {
    // Generic cultivation pill / herb / consumable — always gives clear tangible effect
    rawPillExp = Math.max(12, Math.round(profile.maxExp * baseExpMult * 0.85 * toxicityEfficiency));
    qiGain = Math.round(statsBefore.maxQi * 0.45);
    hpGain = Math.round(statsBefore.maxHp * 0.25);
    toxDelta = isPill ? 12 : 0;
  }

  const expCalc =
    rawPillExp > 0
      ? applyCultivationExpGain(profile, rawPillExp, {
          sourceLabel: `dùng ${target.name}`,
        })
      : null;

  const baseNext = expCalc ? expCalc.nextProfile : profile;
  const energyShort = profile.energyLabel.split('/')[0].trim();

  // Surface Linh căn · Thể chất · Căn cơ upgrades first so the player sees tangible cleansing immediately
  if (constUpgrade.changed && constUpgrade.changeLines.length > 0) {
    effectLines.push(...constUpgrade.changeLines);
  }

  if (expCalc && rawPillExp > 0) {
    if (expCalc.totalEffectiveGain <= 0 && baseNext.readyToBreakthrough) {
      effectLines.push(`${energyShort} đã chạm ngưỡng tối đa (chờ đột phá)`);
    } else if (expCalc.appliedOverflow > 0) {
      effectLines.push(
        `+${expCalc.appliedExp} ${energyShort} (+${expCalc.appliedOverflow} dồn dư chờ đột phá)`,
      );
    } else {
      effectLines.push(`+${expCalc.appliedExp} ${energyShort}`);
    }
  }

  // Recompute max caps with updated constitution so restored HP/Qi/Spirit reflects upgraded roots/physique
  const statsWithConst = computeCharacterStats({
    ...baseNext,
    constitution: constUpgrade.nextConstitution,
  });

  const nextHp = Math.min(statsWithConst.maxHp, statsBefore.hp + hpGain);
  const nextQi = Math.min(statsWithConst.maxQi, statsBefore.qi + qiGain);
  const nextSpirit = Math.min(statsWithConst.maxSpirit, statsBefore.spirit + spiritGain);
  const nextTox = Math.max(0, Math.min(100, statsBefore.pillToxicity + toxDelta));
  const nextEase = Math.max(0, Math.min(100, statsBefore.breakthroughEase + easeGain));

  if (hpGain > 0) {
    const actual = nextHp - statsBefore.hp;
    effectLines.push(
      actual > 0
        ? `Khí huyết +${actual} (${nextHp}/${statsWithConst.maxHp})`
        : `Khí huyết sung mãn (${nextHp}/${statsWithConst.maxHp})`,
    );
  }
  if (qiGain > 0) {
    const actual = nextQi - statsBefore.qi;
    effectLines.push(
      actual > 0
        ? `${statsBefore.energyName} +${actual} (${nextQi}/${statsWithConst.maxQi})`
        : `${statsBefore.energyName} dồi dào (${nextQi}/${statsWithConst.maxQi})`,
    );
  }
  if (spiritGain > 0) {
    const actual = nextSpirit - statsBefore.spirit;
    const spiritName = profile.systemKind === 'wuxia' ? 'Tinh thần' : 'Thần thức';
    effectLines.push(
      actual > 0
        ? `${spiritName} +${actual} (${nextSpirit}/${statsWithConst.maxSpirit})`
        : `${spiritName} thanh minh (${nextSpirit}/${statsWithConst.maxSpirit})`,
    );
  }
  if (easeGain > 0) {
    effectLines.push(`Giảm áp lực bình cảnh +${easeGain}% (hiện ${nextEase}%)`);
  }
  if (addAtk > 0) effectLines.push(`Công kích vĩnh viễn +${addAtk}`);
  if (addDef > 0) effectLines.push(`Phòng thủ vĩnh viễn +${addDef}`);
  if (addAgi > 0) effectLines.push(`Thân pháp vĩnh viễn +${addAgi}`);
  if (addInsight > 0) effectLines.push(`Ngộ tính vĩnh viễn +${addInsight}`);
  if (techMasteryNote) effectLines.push(techMasteryNote);
  if (buffToAdd) effectLines.push(`Trạng thái: ${buffToAdd}`);
  if (toxDelta < 0 && statsBefore.pillToxicity > 0) {
    effectLines.push(`Thanh lọc đan độc ${toxDelta}% (còn ${nextTox}%)`);
  } else if (toxDelta > 0) {
    effectLines.push(`Đan độc +${toxDelta}% (${nextTox}%)`);
  }

  if (highToxicity) {
    toxicityWarning =
      profile.systemKind === 'wuxia'
        ? `Dược độc tích tụ đang cao (${nextTox}%) khiến hiệu quả thuốc giảm — nên vận công điều tức hoặc dùng Bách Thảo Giải Độc Đan / thuốc tẩy tủy.`
        : `Đan độc đang cao (${nextTox}%) khiến hiệu suất hấp thu đan dược giảm — nên vận công điều tức hoặc dùng đan tẩy tủy.`;
  }

  const prevBuffs = Array.isArray(prevVitals.activeBuffs) ? prevVitals.activeBuffs : [];
  const nextBuffs = buffToAdd
    ? [buffToAdd, ...prevBuffs.filter((b) => b !== buffToAdd)].slice(0, 4)
    : prevBuffs;

  const nextVitals: CharacterVitalsState = {
    ...prevVitals,
    hp: nextHp,
    qi: nextQi,
    spirit: nextSpirit,
    pillToxicity: nextTox,
    breakthroughEase: nextEase,
    bonusAtk: (prevVitals.bonusAtk || 0) + addAtk,
    bonusDef: (prevVitals.bonusDef || 0) + addDef,
    bonusAgi: (prevVitals.bonusAgi || 0) + addAgi,
    bonusInsight: (prevVitals.bonusInsight || 0) + addInsight,
    activeBuffs: nextBuffs,
  };

  const remTag = remainingQty > 0 ? `còn x${remainingQty}` : 'đã dùng hết';
  const headline = `Đã dùng 1 ${target.name} (${remTag}): ${effectLines.slice(0, 3).join(' · ')}`;

  const qLabel = getInventoryQualityMeta(
    target.quality,
    profile.systemKind,
  ).shortLabel;
  const storyActionVerb = isCelestialElixir
    ? 'uống từng giọt, vận chuyển tâm pháp dẫn linh dịch chảy khắp kinh mạch để gột rửa linh căn, tẩy tủy thể chất và củng cố căn cơ từ'
    : isKnowledgeSlip
      ? profile.systemKind === 'wuxia'
        ? 'mở ra nghiền ngẫm từng chữ, tham ngộ yếu quyết võ học trong'
        : 'lấy ra và dùng thần thức tham ngộ'
      : isTalismanBuff
        ? 'lấy ra và rót linh lực kích phát'
        : isSpiritStone
          ? 'nắm trong lòng bàn tay, vận công hấp thu linh khí tinh thuần từ'
          : profile.systemKind === 'wuxia' && /cao|giao|kim\s*sang/i.test(lower)
            ? 'lấy ra thoa lên vết thương và vận công điều tức cùng'
            : 'lấy ra và trực tiếp phục dụng';

  const storyPrompt = `Ta lấy "${target.name}" (${qLabel}) từ ${profile.bagName.toLowerCase()}, ${storyActionVerb} nó để luyện hóa dược lực (${effectLines.slice(0, 3).join(', ')}).`;

  return {
    nextProfile: {
      ...baseNext,
      techniques: nextTechniques,
      inventory: nextInventory,
      vitals: nextVitals,
      constitution: constUpgrade.nextConstitution,
      lastGainSummary: headline,
      lastItemFeedback: `${headline}${toxicityWarning ? ` — ${toxicityWarning}` : ''}`,
      lastUpdatedAt: Date.now(),
    },
    itemName: target.name,
    remainingQty,
    expBonus: expCalc ? expCalc.totalEffectiveGain : 0,
    overflowAdded: expCalc ? expCalc.appliedOverflow : 0,
    hitCap: expCalc ? expCalc.hitCap : false,
    effectLines,
    ...(constUpgrade.changed && constUpgrade.changeLines.length > 0
      ? { constitutionChanges: constUpgrade.changeLines }
      : {}),
    headline,
    storyPrompt,
    ...(toxicityWarning ? { toxicityWarning } : {}),
  };
}

export interface LootSuggestion {
  name: string;
  quantity: number;
  category: InventoryItemCategory;
  quality: InventoryItemQuality;
  description: string;
  equipSlot?: EquipmentSlotId;
}

const CONCRETE_CULTIVATION_ITEM_RE =
  /(?:đan|hoàn|tán|cao|giao|dược|linh\s*quả|linh\s*dịch|tiên\s*dịch|kiếm|đao|thương|cung|chùy|trượng|bổng|tiêu|đỉnh|lô|giáp|trâm|ngọc\s*bội|bội|ấn|pháp\s*bảo|pháp\s*khí|linh\s*khí|tiên\s*khí|thần\s*khí|thần\s*binh|binh\s*khí|hiệp\s*khách\s*phục|dạ\s*hành\s*y|phi\s*ngư\s*phục|cẩm\s*bào|vũ\s*y|áo\s*choàng|hồ\s*cừu|đạo\s*bào|thư\s*sinh\s*bào|lê\s*hoa\s*châm|khổng\s*tước\s*linh|mặt\s*nạ|phi\s*trảo|linh\s*thạch|tiên\s*thạch|huyền\s*tinh|tinh\s*hạch|tinh\s*thạch|hàn\s*thiết|huyền\s*thiết|kim\s*ti|tơ\s*tằm|hỏa\s*tằm|băng\s*tinh|ngọc\s*tủy|khoáng|linh\s*thảo|linh\s*chi|(?:linh|tuyết|huyết|tâm|băng|hỏa|thanh|kim|hồng)\s*liên|liên\s*tử|nhân\s*sâm|hà\s*thủ\s*ô|tâm\s*rễ|linh\s*mộc|phù|bùa|trận\s*bàn|trận\s*kỳ|trận\s*đồ|đan\s*phương|ngọc\s*giản|bí\s*kíp|tàn\s*quyển|thủ\s*chép|cầm\s*phổ|cổ\s*phổ|tâm\s*pháp|kiếm\s*phổ|lệnh\s*bài|mật\s*lệnh|túi\s*trữ\s*vật|nhẫn\s*trữ\s*vật|ngân\s*phiếu|hoàng\s*kim|bạc|vàng|nữ\s*nhi\s*hồng)/i;

/**
 * Lightweight zero-API scanner to detect concrete cultivation loot / items acquired in the current story turn
 * so the player can add them to their bag in 1 tap. Strictly filters out context noise like "Gốc", "tầng", "cảnh".
 */
export function scanTurnForLootSuggestions(
  turnText: string,
  profile: CultivationProfile,
): LootSuggestion[] {
  const text = (turnText || '').trim();
  if (!text) return [];

  const existingNames = new Set(
    profile.inventory.map((i) => i.name.trim().toLowerCase()),
  );
  const results: LootSuggestion[] = [];
  const seen = new Set<string>();

  const lootRe =
    /(?:nhặt được|thu được|nhận được|lấy được|tặng cho|trao cho|ban cho|rơi ra|mua được|đấu giá được|rèn được|may được|tìm thấy|cất vào túi)\s+(?:(?:một|hai|ba|bốn|năm|vài|\d+)\s+)?(?:(?:viên|thanh|cây|gốc|nhánh|đóa|bông|cành|khóm|bụi|cuốn|quyển|lá|bình|lọ|vò|hũ|giọt|khối|mảnh|miếng|tấm|tờ|túi|chiếc|hộp|gói|bộ|pho|đôi|cặp|lượng|thỏi)\s+)?([\p{L}0-9][\p{L}0-9\s-]{2,36}?)(?=[.,;:!?\n]|$|\s+(?:và|cùng|rồi|vào|từ|của|này|đó|kia|để|lên|xuống|trong|trên|dưới|ở|bị|được|đang|đã|rất|khá)(?=\s|[.,;:!?\n]|$))/giu;

  let m: RegExpExecArray | null;
  while ((m = lootRe.exec(text)) !== null) {
    const rawName = (m[1] || '')
      .replace(/^(?:một|hai|ba|bốn|năm|vài|chút|ít|gốc|mốc|bản)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!rawName || rawName.length < 3 || rawName.length > 38) continue;
    if (isJunkInventoryItemName(rawName)) continue;

    const lower = rawName.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    // Reject bare single-word generic fragments and require concrete item vocabulary
    if (
      words.length < 2 &&
      !/^(?:bạc|vàng|hoàng\s*kim|linh\s*thạch)$/i.test(lower)
    ) {
      continue;
    }
    if (!CONCRETE_CULTIVATION_ITEM_RE.test(lower)) {
      continue;
    }
    if (seen.has(lower)) continue;
    seen.add(lower);

    const wuxiaMatch =
      profile.systemKind === 'wuxia'
        ? findWuxiaCatalogItemByName(rawName)
        : undefined;

    let category: InventoryItemCategory = wuxiaMatch?.category || 'misc';
    let quality: InventoryItemQuality = wuxiaMatch?.quality || 'common';
    let equipSlot: EquipmentSlotId | undefined = wuxiaMatch?.equipSlot;

    if (!wuxiaMatch) {
      if (
        /(?:hiệp\s*khách\s*phục|dạ\s*hành\s*y|phi\s*ngư\s*phục|cẩm\s*bào|vũ\s*y|áo\s*choàng|hồ\s*cừu|đạo\s*bào|thư\s*sinh\s*bào|nhuyễn\s*vị\s*giáp|bảo\s*giáp)/i.test(
          lower,
        )
      ) {
        category = 'outfit';
        quality = 'rare';
        equipSlot = 'armor';
      } else if (
        /(?:đan|hoàn|tán|cao|giao|dược|thuốc|linh\s*quả|tiên\s*quả|trà|rượu|nữ\s*nhi\s*hồng)/i.test(
          lower,
        )
      ) {
        category = 'consumable';
        quality = 'uncommon';
      } else if (
        /(?:kiếm|đao|thương|cung|chùy|trượng|bổng|tiêu|đỉnh|lô|giáp|trâm|ngọc\s*bội|ấn|pháp\s*bảo|pháp\s*khí|linh\s*khí|tiên\s*khí|thần\s*khí|thần\s*binh|binh\s*khí|phi\s*đao|lê\s*hoa\s*châm|khổng\s*tước\s*linh)/i.test(
          lower,
        )
      ) {
        category = 'weapon';
        quality = 'uncommon';
      } else if (
        /(?:linh\s*thảo|dược\s*thảo|linh\s*chi|(?:linh|tuyết|huyết|tâm|băng|hỏa|thanh|kim|hồng)\s*liên|liên\s*tử|nhân\s*sâm|hà\s*thủ\s*ô|tâm\s*rễ|linh\s*mộc|hàn\s*thiết|huyền\s*thiết|kim\s*ti|tơ\s*tằm|hỏa\s*tằm|băng\s*tinh|ngọc\s*tủy|khoáng|tinh\s*thạch)/i.test(
          lower,
        )
      ) {
        category = 'herb';
        quality = 'uncommon';
      } else if (
        /(?:phù|bùa|trận\s*bàn|trận\s*kỳ|trận\s*đồ|đan\s*phương|ngọc\s*giản|bí\s*kíp|tàn\s*quyển|thủ\s*chép|cầm\s*phổ|cổ\s*phổ|công\s*pháp|tâm\s*pháp|kiếm\s*phổ|lệnh\s*bài|mật\s*lệnh)/i.test(
          lower,
        )
      ) {
        category = 'talisman';
        quality = 'rare';
      } else if (
        /(?:linh\s*thạch|tiên\s*thạch|linh\s*dịch|tiên\s*dịch|huyền\s*tinh|tinh\s*hạch|nguyên\s*thạch)/i.test(
          lower,
        )
      ) {
        category = 'material';
        quality = 'uncommon';
      } else if (/(?:ngân\s*phiếu|hoàng\s*kim)/i.test(lower)) {
        category = 'misc';
        quality = /hoàng\s*kim/i.test(lower) ? 'epic' : 'rare';
      }

      if (
        /tiên\s*phẩm|tuyệt\s*thế|khổng\s*tước\s*linh|kim\s*ti\s*bảo\s*giáp|băng\s*tằm\s*tuyết\s*liên|tiên\s*đan|tiên\s*kiếm|tiên\s*khí|tiên\s*bảo|tiên\s*trận|tiên\s*linh\s*dịch|hỗn\s*độn|thái\s*cổ|hồng\s*mông|cửu\s*chuyển/i.test(
          lower,
        )
      ) {
        quality = 'immortal';
      } else if (
        /thiên\s*phẩm|thiên\s*giai|thiên\s*bảo|đế\s*phẩm|ỷ\s*thiên|đồ\s*long|đả\s*cẩu\s*bổng|nhuyễn\s*vị\s*giáp|cửu\s*âm\s*chân\s*kinh|tục\s*mệnh\s*bát\s*bảo|hỏa\s*tằm\s*băng\s*tinh|vạn\s*năm|vạn\s*niên|cực\s*phẩm\s*linh\s*thạch|thái\s*ất/i.test(
          lower,
        )
      ) {
        quality = 'legendary';
      } else if (
        /cực\s*phẩm|địa\s*phẩm|địa\s*giai|phi\s*ngư\s*phục|lưu\s*vân\s*cẩm\s*bào|lăng\s*la\s*vũ\s*y|huyền\s*thiết\s*trọng\s*kiếm|kim\s*xà\s*kiếm|tử\s*vi\s*nhuyễn\s*kiếm|lê\s*hoa\s*châm|hắc\s*ngọc\s*đoạn\s*tục|thiên\s*hương\s*đoạn\s*tục|độc\s*cô\s*cửu\s*kiếm|tiếu\s*ngạo\s*giang\s*hồ|kim\s*ti|hoàng\s*kim|thượng\s*phẩm\s*linh\s*thạch|nghìn\s*năm|ngàn\s*năm|thiên\s*niên|trúc\s*cơ\s*đan|dưỡng\s*thần/i.test(
          lower,
        )
      ) {
        quality = 'epic';
      } else if (
        /huyền\s*phẩm|thượng\s*phẩm|bạch\s*y\s*thắng\s*tuyết|tử\s*hà\s*đạo\s*bào|tuyết\s*hồ\s*cừu|lãnh\s*nguyệt|ngọc\s*tiêu|đại\s*hoàn\s*đan|cửu\s*hoa\s*ngọc\s*lộ|ngân\s*phiếu|mật\s*lệnh|ngọc\s*bội|trung\s*phẩm\s*linh\s*thạch|hộ\s*mạch|tẩy\s*tủy|hàn\s*thiết/i.test(
          lower,
        )
      ) {
        quality = 'rare';
      } else if (
        /hoàng\s*phẩm|trung\s*phẩm|tiểu\s*hoàn\s*đan|dạ\s*hành\s*y|thanh\s*phong|giải\s*độc|nữ\s*nhi\s*hồng|phi\s*trảo|bách\s*niên|hạ\s*phẩm\s*linh\s*thạch/i.test(
          lower,
        )
      ) {
        quality = 'uncommon';
      } else if (/phàm\s*phẩm|hạ\s*phẩm|vụn|kim\s*sang|thanh\s*sam/i.test(lower)) {
        quality = 'common';
      }
    }

    const titleCased = wuxiaMatch
      ? wuxiaMatch.name
      : rawName.charAt(0).toLocaleUpperCase('vi-VN') + rawName.slice(1);
    results.push({
      name: titleCased,
      quantity: 1,
      category,
      quality,
      ...(equipSlot ? { equipSlot } : {}),
      description: existingNames.has(titleCased.toLowerCase())
        ? 'Cộng thêm số lượng vào vật phẩm đã có trong túi.'
        : wuxiaMatch?.description ||
          'Nhặt/thu được từ diễn biến trang truyện hiện tại.',
    });
    if (results.length >= 4) break;
  }

  return results;
}

/**
 * Formats the character's Cultivation / Martial Arts Profile, Techniques, and Inventory
 * for clean system-context injection into Proxy API calls (only for Tiên Hiệp / Huyền Huyễn / Kiếm Hiệp).
 */
export function formatCultivationContextBlock(
  profile: CultivationProfile | undefined,
  mcName?: string,
): string {
  if (!profile || !profile.enabled) return '';

  const meta = CULTIVATION_SYSTEM_META[profile.systemKind];
  const display = getCultivationDisplayInfo(profile);
  const nextRealm = getNextRealmStage(profile);
  const expPct = Math.min(
    100,
    Math.round((profile.exp / Math.max(1, profile.maxExp)) * 100),
  );
  const headerName = mcName?.trim()
    ? `NHÂN VẬT CHÍNH (${mcName.trim()})`
    : 'NHÂN VẬT CHÍNH';

  const overflowText =
    display.overflowExp > 0
      ? ` · Dư chờ đột phá: +${display.overflowExp}/${display.maxOverflowExp}`
      : '';

  const lines: string[] = [
    `[HỒ SƠ ${meta.label.toUpperCase()} — THỰC LỰC, CÔNG PHÁP & ${profile.bagName.toUpperCase()} CỦA ${headerName}]`,
    `- Hệ thống: ${meta.label} | Đại cảnh giới: ${display.majorRealm} | Giai đoạn: ${display.subStage}${
      typeof display.minorTier === 'number' ? ` (Tầng ${display.minorTier})` : ''
    } | Hiển thị: ${display.fullLabel}`,
    `- ${profile.energyLabel}: ${profile.exp}/${profile.maxExp} (${expPct}%)${overflowText}${
      profile.readyToBreakthrough
        ? ` [SẴN SÀNG ĐỘT PHÁ TỪNG BƯỚC${nextRealm ? ` → ${nextRealm.name}` : ''}]`
        : nextRealm
          ? ` | Bước kế tiếp duy nhất: ${nextRealm.name}`
          : ''
    }`,
  ];

  if (profile.combatPowerNote?.trim()) {
    lines.push(
      `- Chiến lực thực chiến (tách bạch cảnh giới thực tế): ${profile.combatPowerNote.trim()}`,
    );
  }

  if (profile.systemKind === 'wuxia') {
    const ws = normalizeWuxiaState(profile.wuxiaState, profile.realmIndex);
    const wTier = getWuxiaTitleByLayer(ws.innerLayer);
    const ceiling = getWuxiaInnerArtCeilingInfo(profile);
    const pMeta = WUXIA_ELEMENT_PATH_META[ws.elementPath];
    const sMeta = WUXIA_SANCTUARY_META[ws.activeSanctuary || 'none'];
    const syn = evaluateWuxiaSynergy(profile);
    lines.push(
      `- Tôn hiệu thực lực Kiếm hiệp (Cửu Âm): Tầng ${ws.innerLayer}/${ws.innerMaxLayer} — ${wTier.title} (${wTier.layerRangeLabel}) — Giải nghĩa: ${wTier.meaningVi}`,
    );
    lines.push(
      `- Bộ nội công đang vận: ${ws.activeInnerArtName} [${ceiling.originLabel} · ${ceiling.gradeLabel}${
        ceiling.sectName ? ` · Phái ${ceiling.sectName}` : ''
      }] · Trần bộ này: Tầng ${ws.innerMaxLayer} (${ceiling.maxAchievableTitle.title}) · Lộ tuyến: ${pMeta.label} · Kinh mạch: ${ws.meridiansOpened}/8 · Tương hợp: ${syn.alignmentLabel}${
        ws.activeSanctuary && ws.activeSanctuary !== 'none'
          ? ` · Phúc địa bế quan: ${sMeta.label}`
          : ''
      }${
        ceiling.isAtArtCeiling
          ? ' · [ĐÃ CHẠM TRẦN BỘ NỘI CÔNG — không thể đột phá tiếp bằng bộ này, cần chuyển sang bộ nội công bậc cao hơn hoặc cơ duyên võ học]'
          : ''
      }`,
    );
  }

  if (profile.readyToBreakthrough || profile.exp >= profile.maxExp) {
    const btOdds = calculateBreakthroughOdds(profile);
    const keyFactors = btOdds.factors
      .filter((f) => f.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 4)
      .map((f) => `${f.label} ${f.delta > 0 ? `+${f.delta}%` : `${f.delta}%`}`)
      .join(', ');
    lines.push(
      `- Xác suất đột phá dự kiến (${btOdds.targetRealmName}): ${btOdds.finalChance}% (${btOdds.riskLabel} · trần tối đa ${btOdds.maxChance}%)${keyFactors ? ` | Yếu tố chính: ${keyFactors}` : ''}`,
    );
  }
  if (profile.lastBreakthroughOutcome) {
    const lbo = profile.lastBreakthroughOutcome;
    lines.push(
      `- Kết quả đột phá gần nhất (${lbo.outcome === 'failed' ? 'THẤT BẠI / PHẢN PHỆ' : 'THÀNH CÔNG'}): ${lbo.summary}`,
    );
  }

  const constitution = normalizeConstitutionState(
    profile.constitution,
    profile.systemKind,
    profile.realmIndex,
  );
  const cLabels = getConstitutionLabels(profile.systemKind);
  const rootGradeLabel = getInventoryQualityMeta(
    constitution.spiritRoot.grade,
    profile.systemKind,
  ).shortLabel;
  const phyGradeLabel = getInventoryQualityMeta(
    constitution.physique.grade,
    profile.systemKind,
  ).shortLabel;
  const fndGradeLabel = getInventoryQualityMeta(
    constitution.foundation.grade,
    profile.systemKind,
  ).shortLabel;
  lines.push(`- ${cLabels.sectionTitle}:`);
  lines.push(
    `  · ${cLabels.rootTitle}: ${constitution.spiritRoot.name} (${rootGradeLabel} · Thuần khiết ${constitution.spiritRoot.purity}%${
      constitution.spiritRoot.elements ? ` · Thuộc tính: ${constitution.spiritRoot.elements}` : ''
    }) — ${constitution.spiritRoot.affinityNote}`,
  );
  lines.push(
    `  · ${cLabels.physiqueTitle}: ${constitution.physique.name} (${phyGradeLabel} · Tôi luyện ${constitution.physique.refinement}% · Trạng thái: ${constitution.physique.stateLabel}) — ${constitution.physique.traits}`,
  );
  lines.push(
    `  · ${cLabels.foundationTitle}: ${constitution.foundation.label} (${fndGradeLabel} · Vững chắc ${constitution.foundation.solidity}% · Tạp chất tồn dư ${constitution.foundation.impurity}%) — ${constitution.foundation.resilienceNote}`,
  );
  if (constitution.lastEvolutionNote?.trim()) {
    lines.push(`  · Biến đổi tư chất gần nhất: ${constitution.lastEvolutionNote.trim()}`);
  }

  if (profile.techniques.length > 0) {
    lines.push(`- ${meta.techniqueSectionLabel}:`);
    for (const t of profile.techniques.slice(0, 12)) {
      const catLabel = meta.categoryLabels[t.category] || 'Võ học';
      const tierLabel = TECHNIQUE_TIER_META[t.tier]?.label || 'Phàm giai';
      const activeTag = t.isActiveTraining ? ' [Đang chuyên tu]' : '';
      const tLock = getTechniqueLockStatus(t, profile);
      const tLockTag = tLock.isLocked
        ? ` [CHẠM BÌNH CẢNH ${tLock.milestoneLabel} — Cần: ${tLock.unlockCondition}]`
        : ` [${tLock.stageShortLabel}]`;
      const descPart = t.description ? ` — ${t.description}` : '';
      lines.push(
        `  · ${t.name} (${catLabel} · ${tierLabel} · Tầng ${t.level}/${t.maxLevel} · Thuần thục ${t.mastery}%)${activeTag}${tLockTag}${descPart}`,
      );
      if (t.moves && t.moves.length > 0) {
        const moveText = t.moves
          .slice(0, 6)
          .map((mv) => {
            const mvLock = getMoveLockStatus(mv, t, profile);
            const mvTag = mvLock.isLocked
              ? ` · CHẠM BÌNH CẢNH (Cần: ${mvLock.unlockCondition})`
              : ` · ${mvLock.stageShortLabel}`;
            return `${mv.name} (Cấp ${mv.level}/${mv.maxLevel} · ${mv.mastery}%${mvTag}${mv.description ? ` — ${mv.description}` : ''})`;
          })
          .join('; ');
        lines.push(`    + Chiêu thức: ${moveText}`);
      }
    }
  } else {
    lines.push(`- ${meta.techniqueSectionLabel}: Chưa ghi nhận công pháp cụ thể.`);
  }

  const computedStats = computeCharacterStats(profile);
  const spiritStatLabel = profile.systemKind === 'wuxia' ? 'Tinh thần' : 'Thần thức';
  lines.push(
    `- Chỉ số cốt lõi: ${computedStats.hpName} ${computedStats.hp}/${computedStats.maxHp} | ${computedStats.energyName} ${computedStats.qi}/${computedStats.maxQi} | ${spiritStatLabel} ${computedStats.spirit}/${computedStats.maxSpirit} | Công kích ${computedStats.atk} | Phòng thủ ${computedStats.def} | Thân pháp ${computedStats.agi} | Ngộ tính ${computedStats.insight} | Danh tiếng ${computedStats.fame}${
      computedStats.pillToxicity > 0 ? ` | Đan độc ${computedStats.pillToxicity}%` : ''
    }${
      computedStats.breakthroughEase > 0
        ? ` | Trợ lực phá bình cảnh +${computedStats.breakthroughEase}%`
        : ''
    }`,
  );
  if (computedStats.activeBuffs.length > 0) {
    lines.push(`- Trạng thái / Dược lực đang hiệu lực: ${computedStats.activeBuffs.join('; ')}`);
  }

  const activeEquipSlots = getEquipmentSlotOrder(
    profile.systemKind,
    profile.equipment,
  );
  const equippedLines: string[] = [];
  for (const slot of activeEquipSlots) {
    const boundId = profile.equipment?.[slot];
    if (!boundId) continue;
    const item = profile.inventory.find((i) => i.id === boundId);
    if (!item) continue;
    const slotLabel = getEquipmentSlotMeta(slot, profile.systemKind).shortLabel;
    const qLabel = getInventoryQualityMeta(
      item.quality,
      profile.systemKind,
    ).shortLabel;
    const b = getEquipmentItemBonuses(item, slot, profile.systemKind);
    equippedLines.push(
      `  · [${slotLabel}] ${item.name} (${qLabel}${b.summary ? ` · ${b.summary}` : ''})`,
    );
  }
  if (equippedLines.length > 0) {
    const boardHeading = getEquipmentBoardTitle(profile.systemKind).title;
    lines.push(`- ${boardHeading}:`);
    lines.push(...equippedLines);
  }

  if (profile.systemKind === 'wuxia') {
    lines.push(...buildWuxiaGearAndNpcPromptSection(profile, mcName));
  }

  if (profile.inventory.length > 0) {
    lines.push(`- ${profile.bagName}:`);
    for (const item of profile.inventory.slice(0, 18)) {
      const qLabel = getInventoryQualityMeta(
        item.quality,
        profile.systemKind,
      ).label;
      const eqSlot = getEquippedSlotForItem(profile, item.id);
      const eqTag = eqSlot
        ? ` [Đang trang bị: ${getEquipmentSlotMeta(eqSlot, profile.systemKind).shortLabel}]`
        : '';
      const descPart = item.description ? ` — ${item.description}` : '';
      lines.push(`  · ${item.name} x${item.quantity} (${qLabel})${eqTag}${descPart}`);
    }
  } else {
    lines.push(`- ${profile.bagName}: Đang trống.`);
  }
  if (profile.lastItemFeedback?.trim()) {
    lines.push(`- Tác động vật phẩm gần nhất: ${profile.lastItemFeedback.trim()}`);
  }

  if (profile.rankings && profile.rankings.length > 0) {
    lines.push(
      '- BẢNG XẾP HẠNG THIÊN – ĐỊA – NHÂN & BẢNG THIÊN KIÊU (LORE THẾ GIỚI — TÁCH BIỆT HOÀN TOÀN KHỎI NPC LƯỢT TRUYỆN HIỆN TẠI, KHÔNG TỰ Ý KÉO VÀO CẢNH TRỪ KHI MC ĐI GẶP):',
    );
    for (const boardId of CULTIVATION_RANKING_BOARD_ORDER) {
      const entries = profile.rankings
        .filter((e) => e.board === boardId)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, MAX_RANKING_ENTRIES_PER_BOARD);
      if (entries.length === 0) continue;
      const bMeta = CULTIVATION_RANKING_BOARD_META[boardId];
      lines.push(`  * ${bMeta.label} (${entries.length}/${MAX_RANKING_ENTRIES_PER_BOARD}):`);
      for (const entry of entries) {
        const tierTag =
          boardId === 'thien_kieu' && entry.prodigyTier
            ? ` [${PRODIGY_TIER_META[entry.prodigyTier].label}]`
            : entry.isVeteran
              ? ' [Cường giả lâu năm]'
              : '';
        const scopeTag = entry.scopeLabel ? ` (${entry.scopeLabel})` : '';
        const mcTag = entry.isMc ? ' [NHÂN VẬT CHÍNH]' : '';
        if (entry.intelUnlocked === false && !entry.isMc) {
          lines.push(
            `    #${entry.rank} ${entry.name}${tierTag}${scopeTag} [Chưa mở tin đầy đủ — chỉ phong thanh] | Thế lực: ${entry.faction || 'Chưa rõ'} | Phong thanh: ${entry.rumorSummary || 'Danh chấn giang hồ, thực lực thâm bất khả trắc'}`,
          );
        } else {
          lines.push(
            `    #${entry.rank} ${entry.name}${mcTag}${tierTag}${scopeTag} | Cảnh giới: ${entry.realm || 'Chưa rõ'} | Chiến lực/Đặc điểm: ${entry.combatPower || 'Chưa rõ'} | Thế lực: ${entry.faction || 'Tán tu'} | Vị thế/Thái độ: ${entry.stance || 'Trung lập'}${entry.latestActivity ? ` | Động thái: ${entry.latestActivity}` : ''}`,
          );
        }
      }
    }
  }

  lines.push(
    [
      'Quy tắc hệ thống tu luyện, chiến lực & bảng xếp hạng bắt buộc:',
      '1) Nhịp độ tu luyện thực tế, xác suất đột phá & đồng bộ từng bước: Kiếm hiệp tính tiến độ theo Tháng; Tiên hiệp tính tiến độ theo Năm; Huyền huyễn tính theo Tháng/Năm (chỉ tăng nhanh hơn khi có cơ duyên/huyết mạch/đan dược lớn ghi rõ). Tu luyện ngắn vài giờ chỉ là tích tụ nhỏ/tượng trưng, TUYỆT ĐỐI KHÔNG nhảy vượt nhiều bậc. Khi MC đột phá cảnh giới (nhất là đại cảnh giới/thiên kiếp), bám sát xác suất đột phá dự kiến, nền tảng Linh căn · Thể chất · Căn cơ, đan dược trợ lực và thể trạng (không tự mặc định 100% chắc thắng nếu xác suất thấp, đan độc cao hoặc đang trọng thương); nếu đột phá thành công hãy nêu rõ tên bậc kế tiếp vừa đạt được, còn nếu thất bại/phản phệ hãy miêu tả rõ tổn hao linh lực, chấn thương kinh mạch hoặc thần thức dao động đúng với trạng thái hồ sơ.',
      '2) Phân biệt rõ Cảnh giới thực tế và Chiến lực thực chiến: Mọi khả năng vượt cấp chiến đấu PHẢI có cơ sở rõ ràng (công pháp nghịch thiên, thể chất/đồng tử/huyết mạch đặc biệt, pháp bảo, trận pháp, bí thuật đốt thọ nguyên/tinh huyết...) và phải trả cái giá tương xứng.',
      '3) Tách bạch NPC Bảng thứ hạng với NPC lượt truyện hiện tại: Các cường giả/thiên kiêu trên Thiên – Địa – Nhân – Thiên Kiêu bảng (tối đa 10 người/bảng) là thế lực nền của thiên hạ. TUYỆT ĐỐI KHÔNG tự ý kéo họ xuất hiện trong lượt truyện hiện tại trừ khi MC di chuyển tới gặp, dự đại hội hoặc gọi tới. Với nhân vật chưa mở tin đầy đủ, MC chỉ nghe phong thanh khi chưa tới thành thị/tửu lầu/phường thị/thương hội/tông môn.',
      '4) Cập nhật logic & KHÔNG làm loãng mạch truyện: Chỉ đề cập biến động bảng thứ hạng khi có nguyên nhân rõ ràng (đột phá, bại trận, lộ chiến lực, tân tinh quật khởi) hoặc khi người chơi chủ động dò hỏi ở thành thị/trung tâm tin tức.',
      '5) Diễn biến luyện Công pháp & Chiêu thức bám cốt truyện: Độ thuần thục của công pháp và từng chiêu thức tăng tự nhiên qua thực hành trong truyện, thời gian trôi qua và hấp thu Linh thạch/đan dược. Chỉ khi chạm bình cảnh (99%) trước lúc thăng Tầng/Cấp mới bị chặn — khi đó MC cần thực chiến, cảm ngộ, đủ cảnh giới hoặc cơ duyên/Linh thạch mới đột phá tiếp được.',
      '6) Đặt tên nhân vật mới tự nhiên & đa dạng: Khi xuất hiện NPC, Thiên kiêu hay cường giả mới, KHÔNG cấm cứng bất kỳ họ hay chữ đệm quen thuộc nào nếu hợp tính cách/tông môn/bối cảnh; nhưng trong cùng cảnh hoặc cùng nhóm nhân vật tránh đặt trùng tên hay lặp dày đặc cùng một chữ lót/tên chính. Phối hợp hài hòa tên quen tai dễ nhớ với tên cổ phong/địa phương/huyết mạch/danh xưng riêng, giữ nhịp Bằng – Trắc tự nhiên khớp thân phận (tông môn, tán tu, thế gia, ma đạo, giang hồ khách...).',
      ...(profile.systemKind === 'wuxia'
        ? [
            `7) ${WUXIA_NINE_YIN_AI_RULE_NOTE}`,
            `8) ${WUXIA_NPC_RARITY_RANKING_RULE}`,
          ]
        : []),
    ].join('\n'),
  );

  return lines.join('\n');
}
