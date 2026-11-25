import type {
  CultivationConstitutionState,
  CultivationProfile,
  CultivationSystemKind,
  FoundationProfile,
  InventoryItem,
  InventoryItemQuality,
  PhysiqueProfile,
  SpiritRootProfile,
} from '../types/ark';

export interface RealmVisualTheme {
  tier: InventoryItemQuality;
  tierLabel: string;
  cardClass: string;
  shimmerClass: string;
  titleClass: string;
  subStageClass: string;
  tierBadgeClass: string;
  stepperCurrentClass: string;
  stepperPassedClass: string;
  barVisual: {
    fillClass: string;
    percentTextClass: string;
    statusTextClass: string;
    trackGlowClass: string;
    isShimmer: boolean;
  };
  compactTextClass: string;
  compactIconClass: string;
  compactBadgeClass: string;
  hasSparkle: boolean;
}

export interface ConstitutionSectionLabels {
  sectionTitle: string;
  rootTitle: string;
  physiqueTitle: string;
  foundationTitle: string;
  rootPlaceholder: string;
  physiquePlaceholder: string;
  foundationPlaceholder: string;
}

export function getConstitutionLabels(
  systemKind: CultivationSystemKind,
): ConstitutionSectionLabels {
  if (systemKind === 'xuanhuan') {
    return {
      sectionTitle: 'Huyền mạch · Thể chất · Căn cơ',
      rootTitle: 'Huyền mạch / Linh căn',
      physiqueTitle: 'Thể chất · Huyết mạch',
      foundationTitle: 'Đạo cơ · Căn cơ',
      rootPlaceholder: 'VD: Huyền Viêm Đạo Mạch, Song Huyền Mạch...',
      physiquePlaceholder: 'VD: Phàm Thể, Chiến Huyết Linh Thể, Thái Cổ Thánh Thể...',
      foundationPlaceholder: 'VD: Căn cơ sơ thành, Đạo cơ hùng hậu...',
    };
  }
  if (systemKind === 'wuxia') {
    return {
      sectionTitle: 'Căn cốt · Thể chất · Căn cơ',
      rootTitle: 'Căn cốt tư chất',
      physiqueTitle: 'Thể chất gân cốt',
      foundationTitle: 'Nội công căn cơ',
      rootPlaceholder: 'VD: Căn cốt trung thượng, Kỳ tài võ học...',
      physiquePlaceholder: 'VD: Phàm thai gân cốt, Dịch Cân Đoán Cốt Thể...',
      foundationPlaceholder: 'VD: Kinh mạch sơ thông, Nội tức vững chắc...',
    };
  }
  return {
    sectionTitle: 'Linh căn · Thể chất · Căn cơ',
    rootTitle: 'Linh căn',
    physiqueTitle: 'Thể chất',
    foundationTitle: 'Căn cơ',
    rootPlaceholder: 'VD: Ngũ Hành Tạp Linh Căn, Song Linh Căn, Thiên Linh Căn...',
    physiquePlaceholder: 'VD: Phàm Thể, Tẩy Tủy Linh Thể, Tiên Thiên Đạo Thể...',
    foundationPlaceholder: 'VD: Căn cơ sơ thành, Đạo cơ vững chắc, Tiên cơ vô cấu...',
  };
}

/**
 * Resolves the visual tier (common -> immortal) of a cultivation realm so realm badges,
 * headers, steppers, and progress bars align cleanly with the item-quality visual language.
 */
export function resolveRealmQualityTier(
  profile: Pick<
    CultivationProfile,
    'systemKind' | 'realmIndex' | 'realmName' | 'majorRealm'
  >,
): InventoryItemQuality {
  const idx = Math.max(0, Math.trunc(profile.realmIndex || 0));
  const major = `${profile.majorRealm || ''} ${profile.realmName || ''}`.toLowerCase();

  if (profile.systemKind === 'xianxia') {
    if (
      /(?:chân\s*tiên|đại\s*la|kim\s*tiên|tiên\s*vương|tiên\s*đế|thần\s*đế|đạo\s*tổ|độ\s*kiếp|đại\s*thừa|hợp\s*thể)/i.test(
        major,
      ) ||
      idx >= 30
    ) {
      return 'immortal';
    }
    if (/(?:hóa\s*thần|luyện\s*hư)/i.test(major) || idx >= 22) {
      return 'legendary';
    }
    if (/(?:kim\s*đan|nguyên\s*anh)/i.test(major) || idx >= 14) {
      return 'epic';
    }
    if (/(?:trúc\s*cơ)/i.test(major) || idx >= 10) {
      return 'rare';
    }
    if (idx >= 3) {
      return 'uncommon';
    }
    return 'common';
  }

  if (profile.systemKind === 'xuanhuan') {
    if (/(?:huyền\s*thánh|huyền\s*đế|thần\s*đế|đế\s*cảnh)/i.test(major) || idx >= 12) {
      return 'immortal';
    }
    if (/(?:huyền\s*tông|huyền\s*tôn)/i.test(major) || idx >= 10) {
      return 'legendary';
    }
    if (/(?:huyền\s*linh|huyền\s*vương|huyền\s*hoàng)/i.test(major) || idx >= 7) {
      return 'epic';
    }
    if (/(?:huyền\s*sư)/i.test(major) || idx >= 4) {
      return 'rare';
    }
    if (/(?:ngưng\s*huyền)/i.test(major) || idx >= 1) {
      return 'uncommon';
    }
    return 'common';
  }

  // Wuxia (21 Cửu Âm internal-art strength tiers + legacy fallback)
  if (
    /(?:siêu\s*phàm\s*nhập\s*thánh|chấn\s*cổ\s*thước\s*kim|thiên\s*nhân\s*hợp\s*nhất|phá\s*toái\s*hư\s*không|võ\s*thánh)/i.test(
      major,
    ) ||
    idx >= 19
  ) {
    return 'immortal';
  }
  if (
    /(?:kinh\s*thiên\s*động\s*địa|kinh\s*thế\s*hãi\s*tục|cử\s*thế\s*vô\s*song|thần\s*công\s*cái\s*thế|đại\s*tông\s*sư|tuyệt\s*thế)/i.test(
      major,
    ) ||
    idx >= 15
  ) {
    return 'legendary';
  }
  if (
    /(?:nhất\s*đại\s*tôn\s*sư|sở\s*hướng\s*phí\s*mị|vô\s*dữ\s*luận\s*tỉ|đăng\s*phong\s*tạo\s*cực|ngạo\s*thị\s*quần\s*hùng|tiên\s*thiên|tông\s*sư)/i.test(
      major,
    ) ||
    idx >= 10
  ) {
    return 'epic';
  }
  if (
    /(?:xuất\s*thần\s*nhập\s*hóa|thần\s*hồ\s*kỳ\s*kỹ|kỳ\s*tài\s*xuất\s*chúng|lô\s*hỏa\s*thuần\s*thanh|dung\s*hội\s*quán\s*thông|hậu\s*thiên)/i.test(
      major,
    ) ||
    idx >= 5
  ) {
    return 'rare';
  }
  if (
    /(?:giá\s*khinh\s*tựu\s*thực|lược\s*hữu\s*tiểu\s*thành|sơ\s*khuy\s*môn\s*kinh|nhất\s*lưu)/i.test(
      major,
    ) ||
    idx >= 2
  ) {
    return 'uncommon';
  }
  return 'common';
}

export function getRealmVisualTheme(
  profile: Pick<
    CultivationProfile,
    'systemKind' | 'realmIndex' | 'realmName' | 'majorRealm' | 'reduceRealmEffects'
  >,
  options?: { reduceEffects?: boolean },
): RealmVisualTheme {
  const tier = resolveRealmQualityTier(profile);
  const reduceEffects = Boolean(
    options?.reduceEffects ?? profile.reduceRealmEffects,
  );

  switch (tier) {
    case 'immortal':
      return {
        tier,
        tierLabel:
          profile.systemKind === 'wuxia'
            ? 'Thiên Nhân · Lưu Quang'
            : 'Tiên Cảnh · Ngũ Sắc',
        cardClass:
          'bg-gradient-to-br from-rose-950/55 via-[#181533]/92 to-cyan-950/55 ring-rose-300/65 shadow-[0_0_26px_-6px_rgba(244,114,182,0.52),0_0_22px_-8px_rgba(56,189,248,0.42)]',
        shimmerClass: reduceEffects
          ? ''
          : 'item-card-shimmer item-shimmer-immortal',
        titleClass: reduceEffects
          ? 'bg-gradient-to-r from-amber-200 via-rose-200 to-cyan-200 bg-clip-text text-transparent'
          : 'item-text-immortal',
        subStageClass: 'text-cyan-200',
        tierBadgeClass:
          'bg-gradient-to-r from-rose-500/24 via-amber-400/22 to-cyan-400/24 text-rose-100 ring-rose-300/55',
        stepperCurrentClass:
          'bg-gradient-to-r from-rose-500/26 via-amber-400/22 to-cyan-400/24 text-white ring-rose-300/60 shadow-[0_0_12px_-4px_rgba(244,114,182,0.6)]',
        stepperPassedClass:
          'bg-cyan-500/14 text-cyan-200 ring-cyan-300/35',
        barVisual: {
          fillClass: reduceEffects
            ? 'bg-gradient-to-r from-amber-300 via-rose-300 to-cyan-300'
            : 'item-card-shimmer item-shimmer-immortal bg-gradient-to-r from-amber-300 via-rose-300 to-cyan-300 shadow-[0_0_14px_rgba(244,114,182,0.6)]',
          percentTextClass: reduceEffects
            ? 'text-rose-200'
            : 'item-text-immortal',
          statusTextClass: 'text-cyan-200',
          trackGlowClass:
            'ring-1 ring-inset ring-rose-300/45 shadow-[0_0_12px_-2px_rgba(244,114,182,0.42)]',
          isShimmer: !reduceEffects,
        },
        compactTextClass: reduceEffects
          ? 'bg-gradient-to-r from-amber-200 via-rose-200 to-cyan-200 bg-clip-text text-transparent'
          : 'item-text-immortal',
        compactIconClass: 'text-rose-300',
        compactBadgeClass:
          'bg-gradient-to-r from-rose-500/20 via-amber-400/16 to-cyan-400/20 text-rose-100 ring-rose-300/45',
        hasSparkle: !reduceEffects,
      };

    case 'legendary':
      return {
        tier,
        tierLabel:
          profile.systemKind === 'wuxia'
            ? 'Tuyệt Thế · Kim Quang'
            : 'Thiên Cảnh · Kim Quang',
        cardClass:
          'bg-gradient-to-br from-amber-950/58 via-[#211a10]/90 to-[#111728]/92 ring-amber-300/60 shadow-[0_0_24px_-7px_rgba(251,191,36,0.48)]',
        shimmerClass: reduceEffects
          ? ''
          : 'item-card-shimmer item-shimmer-legendary',
        titleClass:
          'bg-gradient-to-r from-amber-200 via-yellow-100 to-orange-200 bg-clip-text text-transparent',
        subStageClass: 'text-amber-300',
        tierBadgeClass:
          'bg-amber-400/20 text-amber-100 ring-amber-300/55',
        stepperCurrentClass:
          'bg-amber-400/24 text-amber-100 ring-amber-300/60 shadow-[0_0_10px_-3px_rgba(251,191,36,0.55)]',
        stepperPassedClass:
          'bg-amber-500/12 text-amber-200/90 ring-amber-400/28',
        barVisual: {
          fillClass: reduceEffects
            ? 'bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-200'
            : 'item-card-shimmer item-shimmer-legendary bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.5)]',
          percentTextClass: 'text-amber-200',
          statusTextClass: 'text-amber-300',
          trackGlowClass: 'ring-1 ring-inset ring-amber-300/40',
          isShimmer: !reduceEffects,
        },
        compactTextClass: 'text-amber-200',
        compactIconClass: 'text-amber-300',
        compactBadgeClass:
          'bg-amber-500/18 text-amber-200 ring-amber-300/42',
        hasSparkle: !reduceEffects,
      };

    case 'epic':
      return {
        tier,
        tierLabel:
          profile.systemKind === 'wuxia'
            ? 'Tông Sư · Tử Quang'
            : 'Cực Cảnh · Tử Quang',
        cardClass:
          'bg-gradient-to-br from-violet-950/54 via-[#1a1430]/90 to-[#11192d]/92 ring-fuchsia-400/48 shadow-[0_0_20px_-8px_rgba(217,70,239,0.44)]',
        shimmerClass: reduceEffects
          ? ''
          : 'item-card-shimmer item-shimmer-epic',
        titleClass:
          'bg-gradient-to-r from-fuchsia-200 via-purple-100 to-violet-200 bg-clip-text text-transparent',
        subStageClass: 'text-fuchsia-300',
        tierBadgeClass:
          'bg-fuchsia-500/18 text-fuchsia-200 ring-fuchsia-400/45',
        stepperCurrentClass:
          'bg-fuchsia-500/22 text-fuchsia-100 ring-fuchsia-400/50',
        stepperPassedClass:
          'bg-violet-500/14 text-violet-200/90 ring-violet-400/28',
        barVisual: {
          fillClass:
            'bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-300',
          percentTextClass: 'text-fuchsia-200',
          statusTextClass: 'text-purple-200',
          trackGlowClass: 'ring-1 ring-inset ring-fuchsia-400/32',
          isShimmer: false,
        },
        compactTextClass: 'text-fuchsia-200',
        compactIconClass: 'text-fuchsia-300',
        compactBadgeClass:
          'bg-fuchsia-500/16 text-fuchsia-200 ring-fuchsia-400/38',
        hasSparkle: false,
      };

    case 'rare':
      return {
        tier,
        tierLabel:
          profile.systemKind === 'wuxia'
            ? 'Hậu Thiên · Lam Quang'
            : 'Đạo Cơ · Lam Quang',
        cardClass:
          'bg-gradient-to-br from-sky-950/50 via-[#101c31]/90 to-[#0e1625]/92 ring-sky-400/42 shadow-[0_0_16px_-8px_rgba(56,189,248,0.38)]',
        shimmerClass: '',
        titleClass: 'text-sky-200',
        subStageClass: 'text-cyan-300',
        tierBadgeClass:
          'bg-sky-500/16 text-sky-200 ring-sky-400/38',
        stepperCurrentClass:
          'bg-sky-500/22 text-sky-100 ring-sky-400/48',
        stepperPassedClass:
          'bg-cyan-500/12 text-cyan-200/90 ring-cyan-400/26',
        barVisual: {
          fillClass:
            'bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-300',
          percentTextClass: 'text-sky-200',
          statusTextClass: 'text-cyan-200',
          trackGlowClass: 'ring-1 ring-inset ring-sky-400/28',
          isShimmer: false,
        },
        compactTextClass: 'text-sky-200',
        compactIconClass: 'text-sky-300',
        compactBadgeClass:
          'bg-sky-500/15 text-sky-200 ring-sky-400/34',
        hasSparkle: false,
      };

    case 'uncommon':
      return {
        tier,
        tierLabel:
          profile.systemKind === 'wuxia'
            ? 'Nhất Lưu · Bích Ngọc'
            : 'Linh Giai · Bích Ngọc',
        cardClass:
          'bg-gradient-to-br from-emerald-950/42 via-[#0f1c26]/88 to-[#0e1625]/92 ring-emerald-400/34',
        shimmerClass: '',
        titleClass: 'text-emerald-200',
        subStageClass: 'text-teal-300',
        tierBadgeClass:
          'bg-emerald-500/14 text-emerald-200 ring-emerald-400/32',
        stepperCurrentClass:
          'bg-emerald-500/20 text-emerald-100 ring-emerald-400/44',
        stepperPassedClass:
          'bg-teal-500/12 text-teal-200/90 ring-teal-400/25',
        barVisual: {
          fillClass:
            'bg-gradient-to-r from-emerald-500 to-teal-300',
          percentTextClass: 'text-emerald-200',
          statusTextClass: 'text-teal-200',
          trackGlowClass: 'ring-1 ring-inset ring-emerald-400/24',
          isShimmer: false,
        },
        compactTextClass: 'text-emerald-200',
        compactIconClass: 'text-emerald-300',
        compactBadgeClass:
          'bg-emerald-500/14 text-emerald-200 ring-emerald-400/30',
        hasSparkle: false,
      };

    default:
      return {
        tier: 'common',
        tierLabel:
          profile.systemKind === 'wuxia'
            ? 'Nhập Môn · Phàm Cảnh'
            : 'Nhập Môn · Tụ Khí',
        cardClass:
          'bg-gradient-to-br from-slate-800/45 via-[#101827]/88 to-[#0e1625]/92 ring-slate-400/28',
        shimmerClass: '',
        titleClass: 'text-slate-100',
        subStageClass: 'text-emerald-300/90',
        tierBadgeClass:
          'bg-slate-500/18 text-slate-200 ring-slate-400/30',
        stepperCurrentClass:
          'bg-slate-400/20 text-slate-100 ring-slate-300/40',
        stepperPassedClass:
          'bg-emerald-500/12 text-emerald-300/85 ring-emerald-400/22',
        barVisual: {
          fillClass:
            'bg-gradient-to-r from-slate-400 via-teal-400 to-emerald-400',
          percentTextClass: 'text-slate-200',
          statusTextClass: 'text-slate-300',
          trackGlowClass: '',
          isShimmer: false,
        },
        compactTextClass: 'text-slate-200',
        compactIconClass: 'text-emerald-300/90',
        compactBadgeClass:
          'bg-slate-500/16 text-slate-200 ring-slate-400/28',
        hasSparkle: false,
      };
  }
}

/* ============================================================================
 * LINH CĂN · THỂ CHẤT · CĂN CƠ (SPIRIT ROOT · PHYSIQUE · FOUNDATION)
 * ============================================================================ */

function clampPercent(val: number, fallback = 50): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(0, Math.min(100, Math.round(val)));
}

export function resolveSpiritRootGrade(purity: number): InventoryItemQuality {
  const p = clampPercent(purity, 40);
  if (p >= 96) return 'immortal';
  if (p >= 87) return 'legendary';
  if (p >= 73) return 'epic';
  if (p >= 55) return 'rare';
  if (p >= 35) return 'uncommon';
  return 'common';
}

export function resolvePhysiqueGrade(refinement: number): InventoryItemQuality {
  const p = clampPercent(refinement, 30);
  if (p >= 95) return 'immortal';
  if (p >= 85) return 'legendary';
  if (p >= 70) return 'epic';
  if (p >= 52) return 'rare';
  if (p >= 34) return 'uncommon';
  return 'common';
}

export function resolveFoundationGrade(
  solidity: number,
  impurity: number,
): InventoryItemQuality {
  const score = clampPercent(solidity, 60) - clampPercent(impurity, 25) * 0.35;
  if (score >= 90) return 'immortal';
  if (score >= 78) return 'legendary';
  if (score >= 65) return 'epic';
  if (score >= 50) return 'rare';
  if (score >= 34) return 'uncommon';
  return 'common';
}

const AUTO_ROOT_TIERS_XIANXIA: Record<
  InventoryItemQuality,
  { name: string; affinity: string }
> = {
  common: {
    name: 'Ngũ Hành Tạp Linh Căn',
    affinity: 'Dẫn khí chậm, linh khí tán loạn — cần linh dịch hoặc đan tẩy tủy gột rửa',
  },
  uncommon: {
    name: 'Tứ Hành Linh Căn (Chân phẩm)',
    affinity: 'Tương thích linh khí mức ổn định, tu luyện tuần tự tiến bộ',
  },
  rare: {
    name: 'Tam Linh Căn Tinh Thuần',
    affinity: 'Hấp thu thiên địa linh khí rõ nét, tốc độ tu luyện khá nhanh',
  },
  epic: {
    name: 'Song Linh Căn Thượng Phẩm',
    affinity: 'Linh khí hội tụ mạnh mẽ, ít tạp niệm, thuận lợi xung kích đại cảnh giới',
  },
  legendary: {
    name: 'Thiên Linh Căn Thuần Tịnh',
    affinity: 'Tương thích linh khí cực cao, tự động dẫn khí nhập thể, gần như không bình cảnh nhỏ',
  },
  immortal: {
    name: 'Tiên Thiên Đạo Linh Căn',
    affinity: 'Cộng hưởng trực tiếp với tiên mạch đại đạo, hấp thu tinh hoa trời đất thần tốc',
  },
};

const AUTO_ROOT_TIERS_XUANHUAN: Record<
  InventoryItemQuality,
  { name: string; affinity: string }
> = {
  common: {
    name: 'Phàm Phẩm Huyền Mạch',
    affinity: 'Huyền mạch hẹp, dẫn nạp huyền khí còn chậm',
  },
  uncommon: {
    name: 'Thanh Linh Huyền Mạch',
    affinity: 'Huyền mạch thông suốt cơ bản, tụ khí ổn định',
  },
  rare: {
    name: 'Song Mạch Tinh Thuần',
    affinity: 'Dẫn nạp huyền khí nhanh, dễ cộng hưởng chiến kỹ',
  },
  epic: {
    name: 'Địa Giai Đạo Mạch',
    affinity: 'Huyền khí dồi dào thuần hậu, tốc độ phá cảnh vượt trội',
  },
  legendary: {
    name: 'Thiên Giai Hoàng Mạch',
    affinity: 'Huyền mạch hùng vĩ tự sinh linh áp, cực hợp đại đạo',
  },
  immortal: {
    name: 'Thái Cổ Đế Mạch',
    affinity: 'Chí tôn huyết mạch cộng hưởng thiên địa, nạp khí như hải nạp bách xuyên',
  },
};

const AUTO_ROOT_TIERS_WUXIA: Record<
  InventoryItemQuality,
  { name: string; affinity: string }
> = {
  common: {
    name: 'Căn Cốt Trung Bình',
    affinity: 'Kinh mạch phổ thông, cần kiên trì khổ luyện nội công',
  },
  uncommon: {
    name: 'Căn Cốt Khá Tốt',
    affinity: 'Tiếp thu tâm pháp ổn định, vận khí mượt mà',
  },
  rare: {
    name: 'Căn Cốt Thượng Giai',
    affinity: 'Lĩnh ngộ võ học nhanh, chân khí lưu chuyển thông suốt',
  },
  epic: {
    name: 'Kỳ Tài Võ Học',
    affinity: 'Kinh mạch rộng mở thiên bẩm, tu luyện nội ngoại công đều tiến nhanh',
  },
  legendary: {
    name: 'Tiên Thiên Võ Cốt',
    affinity: 'Tư chất hiếm gặp trăm năm, dễ chạm ngưỡng Tông Sư',
  },
  immortal: {
    name: 'Vô Thượng Đạo Cốt',
    affinity: 'Nhất niệm thông thiên địa, vạn pháp quy tông',
  },
};

const AUTO_PHYSIQUE_TIERS_XIANXIA: Record<
  InventoryItemQuality,
  { name: string; stateLabel: string; traits: string }
> = {
  common: {
    name: 'Phàm Thể',
    stateLabel: 'Chưa tẩy tủy',
    traits: 'Nhục thân phàm tục, gân cốt bình thường, cần tẩy tủy phạt cốt để mở rộng tiềm năng',
  },
  uncommon: {
    name: 'Tẩy Tủy Phàm Thể',
    stateLabel: 'Kinh cốt sơ thanh',
    traits: 'Đã bài trừ một phần tạp chất hậu thiên, khí huyết lưu thông vững hơn người thường',
  },
  rare: {
    name: 'Thanh Linh Chi Thể',
    stateLabel: 'Kinh cốt thanh thông',
    traits: 'Cơ thể nhẹ nhàng thân hòa linh khí, hồi phục khí huyết và chịu tải dược lực tốt',
  },
  epic: {
    name: 'Ngọc Cốt Linh Thể',
    stateLabel: 'Cốt tủy ánh ngọc',
    traits: 'Kinh mạch bền bỉ như ngọc, kháng đan độc tốt, chống chịu phản phệ khi đột phá cao',
  },
  legendary: {
    name: 'Tiên Thiên Đạo Thể',
    stateLabel: 'Đạo vận sơ hiển',
    traits: 'Nhục thân tự hòa đạo vận, tăng mạnh ngộ tính, phòng ngự và sức chịu đựng thiên kiếp',
  },
  immortal: {
    name: 'Hỗn Nguyên Tiên Thể',
    stateLabel: 'Bất cấu vô hạ',
    traits: 'Tiên cốt vô cấu, vạn độc bất xâm, tự dưỡng linh lực và chịu tải tiên khí cực hạn',
  },
};

const AUTO_PHYSIQUE_TIERS_XUANHUAN: Record<
  InventoryItemQuality,
  { name: string; stateLabel: string; traits: string }
> = {
  common: {
    name: 'Phàm Thai Nhục Thân',
    stateLabel: 'Chưa tôi luyện',
    traits: 'Thể phách bình thường, sức chịu đựng huyền khí còn hạn chế',
  },
  uncommon: {
    name: 'Đoán Cốt Chi Thể',
    stateLabel: 'Gân cốt sơ cường',
    traits: 'Gân cốt cứng cáp, chịu đựng tốt xung kích cận chiến',
  },
  rare: {
    name: 'Linh Huyết Chiến Thể',
    stateLabel: 'Huyết mạch sơ tỉnh',
    traits: 'Khí huyết bùng nổ mạnh, tốc độ hồi phục chiến thương nhanh',
  },
  epic: {
    name: 'Huyền Cương Đạo Thể',
    stateLabel: 'Nhục thân cường hãn',
    traits: 'Thân thể kiên cố như bảo khí, chịu tải huyền lực cao vượt bậc',
  },
  legendary: {
    name: 'Thái Cổ Thánh Thể',
    stateLabel: 'Thánh huyết thức tỉnh',
    traits: 'Huyết mạch thượng cổ bộc phát uy áp, lực chiến vượt cấp rõ rệt',
  },
  immortal: {
    name: 'Bất Diệt Thần Thể',
    stateLabel: 'Vĩnh hằng bất hoại',
    traits: 'Nhục thân bất diệt, giọt máu hóa sinh cơ, vô song dưới thiên kiếp',
  },
};

const AUTO_PHYSIQUE_TIERS_WUXIA: Record<
  InventoryItemQuality,
  { name: string; stateLabel: string; traits: string }
> = {
  common: {
    name: 'Phàm Thai Gân Cốt',
    stateLabel: 'Bình thường',
    traits: 'Thể lực phổ thông, cần rèn luyện quyền cước và nội tức lâu dài',
  },
  uncommon: {
    name: 'Cường Tráng Võ Thể',
    stateLabel: 'Gân cốt dẻo dai',
    traits: 'Sức bền tốt, ra chiêu ổn định ít hụt hơi',
  },
  rare: {
    name: 'Dịch Cân Đoán Cốt Thể',
    stateLabel: 'Đã thông kỳ kinh',
    traits: 'Kinh mạch dẻo dai, chịu đòn tốt và hồi phục nội thương nhanh',
  },
  epic: {
    name: 'Bách Mạch Câu Thông Thể',
    stateLabel: 'Bách mạch thông suốt',
    traits: 'Chân khí luân chuyển không trệ, kháng hàn độc và áp lực cao',
  },
  legendary: {
    name: 'Tiên Thiên Kim Cương Thể',
    stateLabel: 'Hộ thể sinh cương',
    traits: 'Nội kình hộ thân tự nhiên, gân cốt như tinh thiết',
  },
  immortal: {
    name: 'Phản Phác Quy Chân Thể',
    stateLabel: 'Thiên nhân tương hợp',
    traits: 'Thể phách hòa cùng tự nhiên, sinh lực miên man vô tận',
  },
};

const AUTO_FOUNDATION_TIERS: Record<
  InventoryItemQuality,
  { label: string; resilience: string }
> = {
  common: {
    label: 'Căn cơ còn mỏng',
    resilience: 'Kinh mạch còn nhiều tạp chất — dễ gặp phản phệ nếu cưỡng ép đột phá',
  },
  uncommon: {
    label: 'Căn cơ sơ thành',
    resilience: 'Đan điền ổn định mức cơ bản, đủ gánh các đợt đột phá tiểu cảnh giới',
  },
  rare: {
    label: 'Căn cơ vững chắc',
    resilience: 'Kinh mạch thông suốt, tạp chất ít, xung kích bình cảnh khá an toàn',
  },
  epic: {
    label: 'Đạo cơ hùng hậu',
    resilience: 'Đan điền rộng mở kiên cố, chịu tải dược lực và linh áp đại cảnh giới rất tốt',
  },
  legendary: {
    label: 'Vô Cấu Đạo Cơ',
    resilience: 'Kinh mạch tinh thuần hầu như không tạp chất, nền tảng lý tưởng để độ kiếp',
  },
  immortal: {
    label: 'Tiên Cơ Bất Hoại',
    resilience: 'Đạo cơ viên mãn cực hạn, chịu tải thiên kiếp và tiên linh khí không chút rạn nứt',
  },
};

const ALL_AUTO_ROOT_NAMES = new Set<string>([
  ...Object.values(AUTO_ROOT_TIERS_XIANXIA).map((x) => x.name.toLowerCase()),
  ...Object.values(AUTO_ROOT_TIERS_XUANHUAN).map((x) => x.name.toLowerCase()),
  ...Object.values(AUTO_ROOT_TIERS_WUXIA).map((x) => x.name.toLowerCase()),
]);

const ALL_AUTO_PHYSIQUE_NAMES = new Set<string>([
  ...Object.values(AUTO_PHYSIQUE_TIERS_XIANXIA).map((x) => x.name.toLowerCase()),
  ...Object.values(AUTO_PHYSIQUE_TIERS_XUANHUAN).map((x) => x.name.toLowerCase()),
  ...Object.values(AUTO_PHYSIQUE_TIERS_WUXIA).map((x) => x.name.toLowerCase()),
]);

const ALL_AUTO_FOUNDATION_LABELS = new Set<string>(
  Object.values(AUTO_FOUNDATION_TIERS).map((x) => x.label.toLowerCase()),
);

function getRootTierTable(systemKind: CultivationSystemKind) {
  if (systemKind === 'xuanhuan') return AUTO_ROOT_TIERS_XUANHUAN;
  if (systemKind === 'wuxia') return AUTO_ROOT_TIERS_WUXIA;
  return AUTO_ROOT_TIERS_XIANXIA;
}

function getPhysiqueTierTable(systemKind: CultivationSystemKind) {
  if (systemKind === 'xuanhuan') return AUTO_PHYSIQUE_TIERS_XUANHUAN;
  if (systemKind === 'wuxia') return AUTO_PHYSIQUE_TIERS_WUXIA;
  return AUTO_PHYSIQUE_TIERS_XIANXIA;
}

export interface ConstitutionInitHints {
  mcDesc?: string;
  mcRole?: string;
  worldSetting?: string;
}

export function createDefaultConstitution(
  systemKind: CultivationSystemKind,
  realmIndex = 0,
  hints?: ConstitutionInitHints,
): CultivationConstitutionState {
  const rIdx = Math.max(0, Math.trunc(realmIndex || 0));
  const hintText = `${hints?.mcDesc || ''} ${hints?.mcRole || ''}`.trim();
  const hintLower = hintText.toLowerCase();

  // Base starting stats scale moderately with starting realm so mid/high-realm starts feel authentic,
  // while Luyện Khí / Nhập Môn leaves clear room to purify & evolve with elixirs and story milestones.
  let purity = Math.min(92, 40 + Math.round(rIdx * 1.45));
  let rootName = '';
  let rootElements =
    systemKind === 'xianxia'
      ? 'Kim · Mộc · Thủy · Hỏa · Thổ'
      : systemKind === 'xuanhuan'
        ? 'Huyền Hỏa · Phong Mạch'
        : 'Chân khí ôn hòa';

  if (/tiên\s*thiên\s*đạo\s*linh\s*căn|hỗn\s*độn\s*linh\s*căn/i.test(hintLower)) {
    purity = Math.max(purity, 96);
    rootName = /hỗn\s*độn/i.test(hintLower) ? 'Hỗn Độn Linh Căn' : 'Tiên Thiên Đạo Linh Căn';
    rootElements = 'Hỗn Nguyên · Vạn Pháp';
  } else if (/thiên\s*linh\s*căn|đơn\s*linh\s*căn/i.test(hintLower)) {
    purity = Math.max(purity, 88);
    rootName = /thiên\s*linh\s*căn/i.test(hintLower) ? 'Thiên Linh Căn' : 'Đơn Linh Căn Thuần Tịnh';
    rootElements = 'Thuần nhất đơn hệ';
  } else if (/biến\s*dị\s*linh\s*căn|(?:lôi|băng|phong|kiếm)\s*linh\s*căn/i.test(hintLower)) {
    purity = Math.max(purity, 78);
    const m = hintText.match(/(?:Lôi|Băng|Phong|Kiếm|Ám|Quang)\s*Linh\s*Căn/i);
    rootName = m ? m[0].trim() : 'Biến Dị Linh Căn';
    rootElements = m ? m[0].replace(/linh\s*căn/i, '').trim() : 'Biến dị đặc thù';
  } else if (/song\s*linh\s*căn/i.test(hintLower)) {
    purity = Math.max(purity, 74);
    rootName = 'Song Linh Căn';
    rootElements = 'Song hệ tương sinh';
  } else if (/tam\s*linh\s*căn/i.test(hintLower)) {
    purity = Math.max(purity, 58);
    rootName = 'Tam Linh Căn';
    rootElements = 'Mộc · Thủy · Hỏa';
  } else if (/tạp\s*linh\s*căn|ngũ\s*hành|phế\s*linh\s*căn/i.test(hintLower)) {
    purity = /phế/i.test(hintLower) ? 24 : 32;
    rootName = 'Ngũ Hành Tạp Linh Căn';
    rootElements = 'Kim · Mộc · Thủy · Hỏa · Thổ';
  }

  const rootGrade = resolveSpiritRootGrade(purity);
  const rootTable = getRootTierTable(systemKind);
  if (!rootName) {
    rootName = rootTable[rootGrade].name;
  }

  let refinement = Math.min(90, 28 + Math.round(rIdx * 1.55));
  let physiqueName = '';
  let physiqueTraits = '';
  if (/tiên\s*thể|thần\s*thể|hỗn\s*độn\s*thể/i.test(hintLower)) {
    refinement = Math.max(refinement, 95);
    const m = hintText.match(/[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){0,2}\s*(?:Tiên|Thần|Hỗn\s*Độn)\s*Thể/i);
    physiqueName = m ? m[0].trim() : 'Hỗn Nguyên Tiên Thể';
  } else if (/đạo\s*thể|thánh\s*thể|kiếm\s*thể/i.test(hintLower)) {
    refinement = Math.max(refinement, 82);
    const m = hintText.match(/[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){0,2}\s*(?:Đạo|Thánh|Kiếm)\s*Thể/i);
    physiqueName = m ? m[0].trim() : 'Tiên Thiên Đạo Thể';
  } else if (/linh\s*thể|huyết\s*mạch/i.test(hintLower)) {
    refinement = Math.max(refinement, 56);
    const m = hintText.match(/[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){0,2}\s*Linh\s*Thể/i);
    physiqueName = m ? m[0].trim() : 'Thanh Linh Chi Thể';
  }

  const physiqueGrade = resolvePhysiqueGrade(refinement);
  const physiqueTable = getPhysiqueTierTable(systemKind);
  if (!physiqueName) {
    physiqueName = physiqueTable[physiqueGrade].name;
  }
  physiqueTraits = physiqueTable[physiqueGrade].traits;

  const solidity = Math.min(92, 60 + Math.round(rIdx * 0.9));
  const impurity = Math.max(8, 30 - Math.round(rIdx * 0.65));
  const foundationGrade = resolveFoundationGrade(solidity, impurity);
  const foundationTier = AUTO_FOUNDATION_TIERS[foundationGrade];

  return {
    spiritRoot: {
      name: rootName,
      elements: rootElements,
      grade: rootGrade,
      purity,
      affinityNote: rootTable[rootGrade].affinity,
    },
    physique: {
      name: physiqueName,
      grade: physiqueGrade,
      refinement,
      stateLabel: physiqueTable[physiqueGrade].stateLabel,
      traits: physiqueTraits,
    },
    foundation: {
      label: foundationTier.label,
      grade: foundationGrade,
      solidity,
      impurity,
      resilienceNote: foundationTier.resilience,
    },
    updatedAt: Date.now(),
  };
}

const VALID_GRADES = new Set<InventoryItemQuality>([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'immortal',
]);

export function normalizeConstitutionState(
  raw: unknown,
  systemKind: CultivationSystemKind,
  realmIndex = 0,
  hints?: ConstitutionInitHints,
): CultivationConstitutionState {
  const fallback = createDefaultConstitution(systemKind, realmIndex, hints);
  if (!raw || typeof raw !== 'object') return fallback;
  const rec = raw as Record<string, unknown>;

  const rawRoot =
    rec.spiritRoot && typeof rec.spiritRoot === 'object'
      ? (rec.spiritRoot as Record<string, unknown>)
      : {};
  const purity = clampPercent(
    typeof rawRoot.purity === 'number' ? rawRoot.purity : fallback.spiritRoot.purity,
    fallback.spiritRoot.purity,
  );
  const rootGrade: InventoryItemQuality = VALID_GRADES.has(
    rawRoot.grade as InventoryItemQuality,
  )
    ? (rawRoot.grade as InventoryItemQuality)
    : resolveSpiritRootGrade(purity);
  const spiritRoot: SpiritRootProfile = {
    name:
      typeof rawRoot.name === 'string' && rawRoot.name.trim()
        ? rawRoot.name.trim()
        : fallback.spiritRoot.name,
    ...(typeof rawRoot.elements === 'string' && rawRoot.elements.trim()
      ? { elements: rawRoot.elements.trim() }
      : fallback.spiritRoot.elements
        ? { elements: fallback.spiritRoot.elements }
        : {}),
    grade: rootGrade,
    purity,
    affinityNote:
      typeof rawRoot.affinityNote === 'string' && rawRoot.affinityNote.trim()
        ? rawRoot.affinityNote.trim()
        : fallback.spiritRoot.affinityNote,
  };

  const rawPhy =
    rec.physique && typeof rec.physique === 'object'
      ? (rec.physique as Record<string, unknown>)
      : {};
  const refinement = clampPercent(
    typeof rawPhy.refinement === 'number'
      ? rawPhy.refinement
      : fallback.physique.refinement,
    fallback.physique.refinement,
  );
  const phyGrade: InventoryItemQuality = VALID_GRADES.has(
    rawPhy.grade as InventoryItemQuality,
  )
    ? (rawPhy.grade as InventoryItemQuality)
    : resolvePhysiqueGrade(refinement);
  const physique: PhysiqueProfile = {
    name:
      typeof rawPhy.name === 'string' && rawPhy.name.trim()
        ? rawPhy.name.trim()
        : fallback.physique.name,
    grade: phyGrade,
    refinement,
    stateLabel:
      typeof rawPhy.stateLabel === 'string' && rawPhy.stateLabel.trim()
        ? rawPhy.stateLabel.trim()
        : fallback.physique.stateLabel,
    traits:
      typeof rawPhy.traits === 'string' && rawPhy.traits.trim()
        ? rawPhy.traits.trim()
        : fallback.physique.traits,
  };

  const rawFnd =
    rec.foundation && typeof rec.foundation === 'object'
      ? (rec.foundation as Record<string, unknown>)
      : {};
  const solidity = clampPercent(
    typeof rawFnd.solidity === 'number'
      ? rawFnd.solidity
      : fallback.foundation.solidity,
    fallback.foundation.solidity,
  );
  const impurity = clampPercent(
    typeof rawFnd.impurity === 'number'
      ? rawFnd.impurity
      : fallback.foundation.impurity,
    fallback.foundation.impurity,
  );
  const fndGrade: InventoryItemQuality = VALID_GRADES.has(
    rawFnd.grade as InventoryItemQuality,
  )
    ? (rawFnd.grade as InventoryItemQuality)
    : resolveFoundationGrade(solidity, impurity);
  const foundation: FoundationProfile = {
    label:
      typeof rawFnd.label === 'string' && rawFnd.label.trim()
        ? rawFnd.label.trim()
        : fallback.foundation.label,
    grade: fndGrade,
    solidity,
    impurity,
    resilienceNote:
      typeof rawFnd.resilienceNote === 'string' && rawFnd.resilienceNote.trim()
        ? rawFnd.resilienceNote.trim()
        : fallback.foundation.resilienceNote,
  };

  return {
    spiritRoot,
    physique,
    foundation,
    ...(typeof rec.lastEvolutionNote === 'string' && rec.lastEvolutionNote.trim()
      ? { lastEvolutionNote: rec.lastEvolutionNote.trim() }
      : {}),
    ...(typeof rec.updatedAt === 'number' && Number.isFinite(rec.updatedAt)
      ? { updatedAt: rec.updatedAt }
      : {}),
  };
}

/* ============================================================================
 * ITEM & STORY-EVENT CONSTITUTION UPGRADE ENGINE
 * ============================================================================ */

const QUALITY_RANK: Record<InventoryItemQuality, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  immortal: 5,
};

const CELESTIAL_ROOT_ELIXIR_RE =
  /(?:tiên\s*linh\s*dịch|cửu\s*thiên\s*tiên|tẩy\s*căn|tịnh\s*căn|linh\s*căn\s*dịch|tạo\s*hóa\s*(?:lộ|dịch|đan)|thánh\s*tủy|long\s*tủy|phượng\s*huyết|tiên\s*tủy|linh\s*dịch)/i;

const MARROW_CLEANSE_RE =
  /(?:tẩy\s*tủy|phạt\s*cốt|dịch\s*cân|tẩy\s*mạch|thanh\s*liên\s*tử|ngọc\s*tủy|hoán\s*cốt|đoán\s*cốt|thanh\s*lọc\s*(?:kinh\s*mạch|linh\s*căn|tạp\s*chất)|bồ\s*đề\s*quả|băng\s*tằm\s*tuyết\s*liên)/i;

const FOUNDATION_ENHANCE_RE =
  /(?:trúc\s*cơ|hộ\s*mạch|cố\s*bản|bồi\s*nguyên|đạo\s*cơ|tụ\s*nguyên|kết\s*kim\s*đan|nguyên\s*anh|hoàn\s*hồn|dưỡng\s*thần|tử\s*linh\s*chi|tuyết\s*liên|nhân\s*sâm|hà\s*thủ\s*ô|tục\s*mệnh\s*bát\s*bảo)/i;

export function isCelestialRootElixirItem(item: Pick<InventoryItem, 'name' | 'description'>): boolean {
  const text = `${item.name || ''} ${item.description || ''}`;
  return CELESTIAL_ROOT_ELIXIR_RE.test(text);
}

export function isConstitutionEnhancingItem(
  item: Pick<InventoryItem, 'name' | 'description' | 'category' | 'quality'>,
): boolean {
  if (item.category === 'weapon' || item.category === 'outfit') {
    return false;
  }
  const text = `${item.name || ''} ${item.description || ''}`;
  return (
    CELESTIAL_ROOT_ELIXIR_RE.test(text) ||
    MARROW_CLEANSE_RE.test(text) ||
    FOUNDATION_ENHANCE_RE.test(text)
  );
}

export interface ConstitutionUpgradeDelta {
  purityDelta: number;
  refinementDelta: number;
  solidityDelta: number;
  impurityDelta: number; // negative = cleaner
}

export interface ConstitutionUpgradeResult {
  changed: boolean;
  nextConstitution: CultivationConstitutionState;
  changeLines: string[];
  evolutionSummary?: string;
  extraToxicityCleanse: number;
  extraBreakthroughEase: number;
  isCelestialElixir: boolean;
}

function applyConstitutionDeltas(
  current: CultivationConstitutionState,
  delta: ConstitutionUpgradeDelta,
  systemKind: CultivationSystemKind,
  sourceLabel: string,
): {
  changed: boolean;
  nextConstitution: CultivationConstitutionState;
  changeLines: string[];
  evolutionSummary?: string;
} {
  const labels = getConstitutionLabels(systemKind);
  const rootTable = getRootTierTable(systemKind);
  const physiqueTable = getPhysiqueTierTable(systemKind);

  const prevRoot = current.spiritRoot;
  const prevPhy = current.physique;
  const prevFnd = current.foundation;

  // Apply gentle diminishing return only above 90% so top tiers still move meaningfully
  const scaleGain = (cur: number, raw: number) => {
    if (raw <= 0) return 0;
    if (cur >= 92) return Math.max(1, Math.round(raw * 0.45));
    if (cur >= 80) return Math.max(2, Math.round(raw * 0.75));
    return raw;
  };

  const actualPurityGain = scaleGain(prevRoot.purity, delta.purityDelta);
  const nextPurity = clampPercent(prevRoot.purity + actualPurityGain, prevRoot.purity);
  const computedRootGrade = resolveSpiritRootGrade(nextPurity);
  const nextRootGrade =
    QUALITY_RANK[computedRootGrade] > QUALITY_RANK[prevRoot.grade]
      ? computedRootGrade
      : prevRoot.grade;

  const isAutoRootName = ALL_AUTO_ROOT_NAMES.has(prevRoot.name.toLowerCase());
  const rootUpgradedTier = QUALITY_RANK[nextRootGrade] > QUALITY_RANK[prevRoot.grade];
  const nextRootName =
    rootUpgradedTier && isAutoRootName
      ? rootTable[nextRootGrade].name
      : prevRoot.name;
  const nextRootAffinity =
    rootUpgradedTier || nextPurity - prevRoot.purity >= 6
      ? rootTable[nextRootGrade].affinity
      : prevRoot.affinityNote;

  const actualRefGain = scaleGain(prevPhy.refinement, delta.refinementDelta);
  const nextRefinement = clampPercent(
    prevPhy.refinement + actualRefGain,
    prevPhy.refinement,
  );
  const computedPhyGrade = resolvePhysiqueGrade(nextRefinement);
  const nextPhyGrade =
    QUALITY_RANK[computedPhyGrade] > QUALITY_RANK[prevPhy.grade]
      ? computedPhyGrade
      : prevPhy.grade;
  const isAutoPhyName = ALL_AUTO_PHYSIQUE_NAMES.has(prevPhy.name.toLowerCase());
  const phyUpgradedTier = QUALITY_RANK[nextPhyGrade] > QUALITY_RANK[prevPhy.grade];
  const nextPhyName =
    phyUpgradedTier && isAutoPhyName
      ? physiqueTable[nextPhyGrade].name
      : prevPhy.name;
  const nextPhyState =
    phyUpgradedTier || actualRefGain >= 6
      ? physiqueTable[nextPhyGrade].stateLabel
      : prevPhy.stateLabel;
  const nextPhyTraits =
    phyUpgradedTier
      ? physiqueTable[nextPhyGrade].traits
      : prevPhy.traits;

  const actualSolGain = scaleGain(prevFnd.solidity, delta.solidityDelta);
  const nextSolidity = clampPercent(
    prevFnd.solidity + actualSolGain,
    prevFnd.solidity,
  );
  const nextImpurity = clampPercent(
    prevFnd.impurity + delta.impurityDelta,
    prevFnd.impurity,
  );
  const computedFndGrade = resolveFoundationGrade(nextSolidity, nextImpurity);
  const nextFndGrade =
    QUALITY_RANK[computedFndGrade] > QUALITY_RANK[prevFnd.grade]
      ? computedFndGrade
      : prevFnd.grade;
  const isAutoFndLabel = ALL_AUTO_FOUNDATION_LABELS.has(
    prevFnd.label.toLowerCase(),
  );
  const fndUpgradedTier = QUALITY_RANK[nextFndGrade] > QUALITY_RANK[prevFnd.grade];
  const nextFndLabel =
    fndUpgradedTier && isAutoFndLabel
      ? AUTO_FOUNDATION_TIERS[nextFndGrade].label
      : prevFnd.label;
  const nextFndResilience =
    fndUpgradedTier || nextSolidity - prevFnd.solidity >= 5 || prevFnd.impurity - nextImpurity >= 8
      ? AUTO_FOUNDATION_TIERS[nextFndGrade].resilience
      : prevFnd.resilienceNote;

  const changeLines: string[] = [];

  if (nextPurity > prevRoot.purity || rootUpgradedTier) {
    if (nextRootName !== prevRoot.name) {
      changeLines.push(
        `${labels.rootTitle} lột xác: ${prevRoot.name} → ${nextRootName} (thuần khiết ${prevRoot.purity}% → ${nextPurity}%)`,
      );
    } else {
      changeLines.push(
        `${labels.rootTitle} tinh lọc +${nextPurity - prevRoot.purity}% (${prevRoot.purity}% → ${nextPurity}%)`,
      );
    }
  }

  if (nextRefinement > prevPhy.refinement || phyUpgradedTier) {
    if (nextPhyName !== prevPhy.name) {
      changeLines.push(
        `${labels.physiqueTitle} tiến hóa: ${prevPhy.name} → ${nextPhyName} (${prevPhy.refinement}% → ${nextRefinement}%)`,
      );
    } else {
      changeLines.push(
        `${labels.physiqueTitle} tôi luyện +${nextRefinement - prevPhy.refinement}% (${prevPhy.refinement}% → ${nextRefinement}%)`,
      );
    }
  }

  const impDropped = prevFnd.impurity - nextImpurity;
  if (nextSolidity > prevFnd.solidity || impDropped > 0 || fndUpgradedTier) {
    const parts: string[] = [];
    if (nextSolidity > prevFnd.solidity) {
      parts.push(`vững chắc ${prevFnd.solidity}% → ${nextSolidity}%`);
    }
    if (impDropped > 0) {
      parts.push(`tạp chất -${impDropped}% (còn ${nextImpurity}%)`);
    }
    const tierPart =
      nextFndLabel !== prevFnd.label ? ` [${prevFnd.label} → ${nextFndLabel}]` : '';
    changeLines.push(`${labels.foundationTitle}${tierPart}: ${parts.join(', ')}`);
  }

  if (changeLines.length === 0) {
    return {
      changed: false,
      nextConstitution: current,
      changeLines: [],
    };
  }

  const evolutionSummary = `${sourceLabel}: ${changeLines.join(' · ')}`;

  return {
    changed: true,
    nextConstitution: {
      spiritRoot: {
        ...prevRoot,
        name: nextRootName,
        grade: nextRootGrade,
        purity: nextPurity,
        affinityNote: nextRootAffinity,
      },
      physique: {
        ...prevPhy,
        name: nextPhyName,
        grade: nextPhyGrade,
        refinement: nextRefinement,
        stateLabel: nextPhyState,
        traits: nextPhyTraits,
      },
      foundation: {
        ...prevFnd,
        label: nextFndLabel,
        grade: nextFndGrade,
        solidity: nextSolidity,
        impurity: nextImpurity,
        resilienceNote: nextFndResilience,
      },
      lastEvolutionNote: evolutionSummary,
      updatedAt: Date.now(),
    },
    changeLines,
    evolutionSummary,
  };
}

/**
 * Applies concrete Linh căn · Thể chất · Căn cơ purification & upgrades when consuming
 * cleansing elixirs, marrow-washing pills, foundation pills, or high-grade herbs.
 */
export function applyConstitutionEffectFromItem(
  profile: CultivationProfile,
  item: InventoryItem,
): ConstitutionUpgradeResult {
  const current = normalizeConstitutionState(
    profile.constitution,
    profile.systemKind,
    profile.realmIndex,
  );
  const text = `${item.name || ''} ${item.description || ''}`;
  const qMult: Record<InventoryItemQuality, number> = {
    common: 0.6,
    uncommon: 0.85,
    rare: 1.15,
    epic: 1.5,
    legendary: 1.9,
    immortal: 2.4,
  };
  const mult = qMult[item.quality] || 1;

  const isCelestialElixir = CELESTIAL_ROOT_ELIXIR_RE.test(text);
  const isMarrowCleanse = MARROW_CLEANSE_RE.test(text);
  const isFoundationItem = FOUNDATION_ENHANCE_RE.test(text);

  let delta: ConstitutionUpgradeDelta = {
    purityDelta: 0,
    refinementDelta: 0,
    solidityDelta: 0,
    impurityDelta: 0,
  };
  let extraToxicityCleanse = 0;
  let extraBreakthroughEase = 0;

  if (isCelestialElixir) {
    // e.g. Cửu Thiên Tiên Linh Dịch (immortal) -> strong purification across all 3 pillars
    delta = {
      purityDelta: Math.max(10, Math.round(9.5 * mult)),
      refinementDelta: Math.max(8, Math.round(7.5 * mult)),
      solidityDelta: Math.max(8, Math.round(7.5 * mult)),
      impurityDelta: -Math.max(14, Math.round(11 * mult)),
    };
    extraToxicityCleanse = Math.round(14 * mult);
    extraBreakthroughEase = Math.min(28, Math.round(8 * mult));
  } else if (isMarrowCleanse) {
    // e.g. Tẩy Tủy Phạt Cốt Đan, Ngọc Tủy, Thanh Liên Tử
    delta = {
      purityDelta: Math.max(5, Math.round(6.5 * mult)),
      refinementDelta: Math.max(8, Math.round(9.5 * mult)),
      solidityDelta: Math.max(7, Math.round(8 * mult)),
      impurityDelta: -Math.max(12, Math.round(12 * mult)),
    };
    extraToxicityCleanse = Math.round(12 * mult);
    extraBreakthroughEase = Math.min(20, Math.round(6 * mult));
  } else if (isFoundationItem) {
    // e.g. Trúc Cơ Đan, Hộ Mạch Linh Đan, Kết Kim Đan, Hoàn Hồn Đan, Bách Niên Tử Linh Chi
    const highGradeBonus = QUALITY_RANK[item.quality] >= 3 ? Math.round(3.5 * mult) : 0;
    delta = {
      purityDelta: highGradeBonus,
      refinementDelta: /tử\s*linh\s*chi|tuyết\s*liên|nhân\s*sâm|hoàn\s*hồn/i.test(text)
        ? Math.max(3, Math.round(4.5 * mult))
        : Math.round(2 * mult),
      solidityDelta: Math.max(4, Math.round(6 * mult)),
      impurityDelta: -Math.max(4, Math.round(5.5 * mult)),
    };
    extraBreakthroughEase = Math.min(12, Math.round(3 * mult));
  } else if (item.category === 'herb' && QUALITY_RANK[item.quality] >= 1) {
    delta = {
      purityDelta: QUALITY_RANK[item.quality] >= 3 ? Math.round(3 * mult) : 0,
      refinementDelta: Math.max(2, Math.round(3 * mult)),
      solidityDelta: Math.max(2, Math.round(3.5 * mult)),
      impurityDelta: -Math.max(3, Math.round(4 * mult)),
    };
  } else {
    return {
      changed: false,
      nextConstitution: current,
      changeLines: [],
      extraToxicityCleanse: 0,
      extraBreakthroughEase: 0,
      isCelestialElixir: false,
    };
  }

  const applied = applyConstitutionDeltas(
    current,
    delta,
    profile.systemKind,
    `Luyện hóa ${item.name}`,
  );

  return {
    ...applied,
    extraToxicityCleanse,
    extraBreakthroughEase,
    isCelestialElixir,
  };
}

export interface StoryConstitutionSyncResult {
  synced: boolean;
  nextProfile: CultivationProfile;
  changeLines: string[];
  bannerMessage?: string;
}

const STORY_NEGATED_CLEANSE_RE =
  /(?:chưa\s*thể|không\s*thể|thất\s*bại|bị\s*gián\s*đoạn|chưa\s*dám|chưa\s*kịp|dự\s*định|tính\s*đến\s*chuyện)\s+(?:tẩy\s*tủy|gột\s*rửa|tinh\s*lọc|củng\s*cố|thức\s*tỉnh)/i;

const STORY_ROOT_PURIFY_RE =
  /(?:(?:gột\s*rửa|tẩy\s*rửa|tinh\s*lọc|lột\s*xác|thăng\s*hoa|khai\s*mở)\s+(?:lại\s+)?(?:linh\s*căn|huyền\s*mạch|căn\s*cốt)|linh\s*căn\s+(?:trở\s*nên\s*)?(?:thuần\s*khiết|tinh\s*thuần|trong\s*sáng|lột\s*xác|biến\s*đổi|thăng\s*phẩm)|tiên\s*linh\s*dịch\s+(?:chảy\s*khắp|dung\s*nhập|gột\s*rửa|thấm\s*vào))/i;

const STORY_PHYSIQUE_REFINE_RE =
  /(?:tẩy\s*tủy\s*phạt\s*cốt|dịch\s*cân\s*phạt\s*tủy|bài\s*trừ\s*(?:hắc\s*cấu|tạp\s*chất\s*trong\s*xương)|(?:thức\s*tỉnh|khai\s*mở|lột\s*xác|cải\s*tạo|rèn\s*luyện)\s+(?:thể\s*chất|đạo\s*thể|linh\s*thể|thánh\s*thể|huyết\s*mạch|nhục\s*thân)|thiên\s*kiếp\s+(?:rèn\s*thân|tôi\s*luyện\s*nhục\s*thân))/i;

const STORY_FOUNDATION_STRENGTHEN_RE =
  /(?:(?:củng\s*cố|đúc\s*lại|kiện\s*toàn|mở\s*rộng|thanh\s*lọc)\s+(?:lại\s+)?(?:căn\s*cơ|đạo\s*cơ|kinh\s*mạch|đan\s*điền)|bài\s*trừ\s*(?:đan\s*độc|tạp\s*chất)|căn\s*cơ\s+(?:vững\s*chắc|kiên\s*cố|hùng\s*hậu)\s*hơn)/i;

/**
 * Syncs clear story-driven cleansing, marrow-washing, physique awakening, or foundation
 * tempering events from the narrative turn into the MC's Linh căn · Thể chất · Căn cơ.
 */
export function detectAndSyncStoryConstitutionEvents(
  profile: CultivationProfile,
  opts: {
    userText?: string;
    assistantText?: string;
    mcName?: string;
  },
): StoryConstitutionSyncResult {
  if (!profile.enabled) {
    return { synced: false, nextProfile: profile, changeLines: [] };
  }

  const narrative = (opts.assistantText || '').trim();
  const combined = `${opts.userText || ''}\n${narrative}`.trim();
  if (narrative.length < 40 || STORY_NEGATED_CLEANSE_RE.test(narrative)) {
    return { synced: false, nextProfile: profile, changeLines: [] };
  }

  const hitRoot = STORY_ROOT_PURIFY_RE.test(narrative);
  const hitPhysique = STORY_PHYSIQUE_REFINE_RE.test(narrative);
  const hitFoundation = STORY_FOUNDATION_STRENGTHEN_RE.test(narrative);

  if (!hitRoot && !hitPhysique && !hitFoundation) {
    return { synced: false, nextProfile: profile, changeLines: [] };
  }

  // Avoid double-triggering if the player ALREADY clicked "Dùng" on a cleansing item right before sending the turn
  // (e.g., user prompt starts with "Ta lấy ... từ túi trữ vật, ... luyện hóa dược lực" and constitution was just updated < 2 mins ago)
  const current = normalizeConstitutionState(
    profile.constitution,
    profile.systemKind,
    profile.realmIndex,
  );
  const justUpdatedFromBag =
    typeof current.updatedAt === 'number' &&
    Date.now() - current.updatedAt < 90_000 &&
    /từ\s+túi\s+trữ\s+vật|luyện\s*hóa\s*dược\s*lực/i.test(opts.userText || '');

  if (justUpdatedFromBag) {
    return { synced: false, nextProfile: profile, changeLines: [] };
  }

  const isMajorFortune =
    /(?:tiên\s*linh\s*dịch|thiên\s*kiếp|thánh\s*tủy|tạo\s*hóa|lột\s*xác\s*hoàn\s*toàn|thức\s*tỉnh\s*(?:đạo\s*thể|thánh\s*thể|huyết\s*mạch))/i.test(
      combined,
    );

  const delta: ConstitutionUpgradeDelta = {
    purityDelta: hitRoot ? (isMajorFortune ? 9 : 5) : 0,
    refinementDelta: hitPhysique ? (isMajorFortune ? 9 : 5) : 0,
    solidityDelta: hitFoundation ? (isMajorFortune ? 8 : 5) : hitPhysique || hitRoot ? 3 : 0,
    impurityDelta:
      hitFoundation || hitPhysique || hitRoot ? (isMajorFortune ? -12 : -7) : 0,
  };

  const applied = applyConstitutionDeltas(
    current,
    delta,
    profile.systemKind,
    'Cơ duyên trong truyện',
  );

  if (!applied.changed) {
    return { synced: false, nextProfile: profile, changeLines: [] };
  }

  const nextVitals = profile.vitals
    ? {
        ...profile.vitals,
        pillToxicity: Math.max(
          0,
          Math.round((profile.vitals.pillToxicity || 0) - (isMajorFortune ? 12 : 6)),
        ),
      }
    : profile.vitals;

  const nextProfile: CultivationProfile = {
    ...profile,
    constitution: applied.nextConstitution,
    ...(nextVitals ? { vitals: nextVitals } : {}),
    lastUpdatedAt: Date.now(),
  };

  return {
    synced: true,
    nextProfile,
    changeLines: applied.changeLines,
    bannerMessage: `Cập nhật tư chất theo diễn biến truyện: ${applied.changeLines.slice(0, 2).join(' · ')}.`,
  };
}
