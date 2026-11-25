import type {
  BreakthroughOutcomeRecord,
  CultivationProfile,
  InventoryItem,
  InventoryItemQuality,
} from '../types/ark';
import {
  applyConstitutionEffectFromItem,
  isCelestialRootElixirItem,
  normalizeConstitutionState,
} from './cultivationConstitution';
import {
  detectWuxiaSanctuaryFromScene,
  evaluateWuxiaSynergy,
  normalizeWuxiaState,
  WUXIA_SANCTUARY_META,
} from './wuxiaNineYin';

export type BreakthroughDifficultyKind =
  | 'none'
  | 'minor_bottleneck'
  | 'major_bottleneck'
  | 'tribulation'
  | 'max_realm';

export interface BreakthroughAssistOption {
  item: InventoryItem;
  bonusPercent: number;
  roleLabel: string;
}

export interface BreakthroughOddsFactor {
  id: string;
  label: string;
  delta: number;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export type BreakthroughRiskLevel = 'high' | 'moderate' | 'risky' | 'dangerous';

export interface BreakthroughOddsReport {
  bottleneckKind: BreakthroughDifficultyKind;
  targetRealmName: string;
  baseChance: number;
  finalChance: number;
  minChance: number;
  maxChance: number;
  riskLevel: BreakthroughRiskLevel;
  riskLabel: string;
  recommendation: string;
  factors: BreakthroughOddsFactor[];
  selectedAssist?: BreakthroughAssistOption;
  assistOptions: BreakthroughAssistOption[];
}

export interface BreakthroughStatsSnapshot {
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  spirit: number;
  maxSpirit: number;
  pillToxicity: number;
  breakthroughEase: number;
  activeBuffs: string[];
  hpName: string;
  energyName: string;
}

const QUALITY_ASSIST_SCALE: Record<InventoryItemQuality, number> = {
  common: 0.65,
  uncommon: 0.9,
  rare: 1.2,
  epic: 1.55,
  legendary: 1.9,
  immortal: 2.3,
};

const BREAKTHROUGH_PILL_RE =
  /(?:trúc\s*cơ|kết\s*kim|đột\s*phá|ngưng\s*anh|hóa\s*thần|hoàn\s*hồn|phá\s*cảnh|độ\s*kiếp|thiên\s*nguyên)/i;
const CLEANSE_OR_MERIDIAN_RE =
  /(?:tẩy\s*tủy|phạt\s*cốt|hộ\s*mạch|dưỡng\s*thần|ngọc\s*lộ|ngọc\s*tủy|thanh\s*liên|cố\s*bản|tụ\s*khí|tụ\s*linh|hồi\s*huyền|hồi\s*khí)/i;
const PROTECTIVE_ARRAY_RE =
  /(?:trận\s*bàn|trận\s*kỳ|trận\s*đồ|hộ\s*pháp|kim\s*cang|hộ\s*thể|tĩnh\s*tâm|tụ\s*linh\s*trận|hộ\s*trận|phù)/i;
const SPIRIT_STONE_ASSIST_RE =
  /(?:linh\s*thạch|huyền\s*tinh|nguyên\s*thạch|tinh\s*thạch)/i;

/**
 * Finds consumable / auxiliary items in the MC's bag that can assist a realm breakthrough.
 */
export function getBreakthroughAssistItems(
  profile: CultivationProfile,
): BreakthroughAssistOption[] {
  const results: BreakthroughAssistOption[] = [];

  for (const item of profile.inventory || []) {
    if (!item || item.quantity <= 0) continue;
    // Do not consume weapons directly during breakthrough
    if (item.category === 'weapon') continue;

    const text = `${item.name || ''} ${item.description || ''}`;
    const qMult = QUALITY_ASSIST_SCALE[item.quality] || 1;

    if (isCelestialRootElixirItem(item)) {
      results.push({
        item,
        bonusPercent: Math.min(24, Math.max(10, Math.round(10.5 * qMult))),
        roleLabel: 'Tiên linh dịch trợ căn',
      });
    } else if (BREAKTHROUGH_PILL_RE.test(text)) {
      results.push({
        item,
        bonusPercent: Math.min(24, Math.max(8, Math.round(11 * qMult))),
        roleLabel: 'Đan trợ đột phá',
      });
    } else if (CLEANSE_OR_MERIDIAN_RE.test(text) && item.category !== 'misc') {
      results.push({
        item,
        bonusPercent: Math.min(18, Math.max(5, Math.round(7.5 * qMult))),
        roleLabel: 'Đan hộ mạch · tụ linh',
      });
    } else if (PROTECTIVE_ARRAY_RE.test(text) && item.category === 'talisman') {
      results.push({
        item,
        bonusPercent: Math.min(16, Math.max(5, Math.round(7 * qMult))),
        roleLabel: 'Phù / Trận hộ pháp',
      });
    } else if (SPIRIT_STONE_ASSIST_RE.test(text)) {
      const stoneBase = /cực\s*phẩm/i.test(text)
        ? 14
        : /thượng\s*phẩm/i.test(text)
          ? 10
          : /trung\s*phẩm/i.test(text)
            ? 7
            : 4;
      results.push({
        item,
        bonusPercent: stoneBase,
        roleLabel: 'Linh khí phụ trợ',
      });
    }
  }

  return results.sort((a, b) => b.bonusPercent - a.bonusPercent);
}

const FAVORABLE_SCENE_RE =
  /(?:động\s*phủ|linh\s*mạch|tụ\s*linh\s*trận|hộ\s*pháp|bế\s*quan|mật\s*thất|yên\s*tĩnh|linh\s*tuyền|địa\s*lợi|cơ\s*duyên|ngộ\s*đạo|bồ\s*đề)/i;
const HOSTILE_SCENE_RE =
  /(?:truy\s*sát|đang\s*giao\s*chiến|bị\s*bao\s*vây|tâm\s*ma\s*quấy\s*nhiễu|trọng\s*thương|nội\s*thương\s*nặng|kinh\s*mạch\s*tổn\s*thương|độc\s*phát|bị\s*quấy\s*rầy)/i;

/**
 * Computes transparent, realistic breakthrough success odds from:
 * - Difficulty tier (minor / major / tribulation / max_realm)
 * - Linh căn · Thể chất · Căn cơ (purity, refinement, solidity, impurity)
 * - Current vitals (HP/Qi/Spirit, pillToxicity, prior backlash debuffs, overflow EXP)
 * - Already-active pill ease + optionally selected breakthrough assist item
 * - Current story scene conditions (favorable array/cave vs hostile disruption)
 *
 * High-grade roots/physiques provide a clear advantage, while major realms and tribulations
 * NEVER default to an automatic 100% guarantee (capped at 92% major / 88% tribulation / 95% minor).
 */
export function computeBreakthroughOddsReport(params: {
  profile: CultivationProfile;
  bottleneckKind: BreakthroughDifficultyKind;
  targetRealmName: string;
  stats: BreakthroughStatsSnapshot;
  overflowExp: number;
  maxOverflowExp: number;
  assistItemId?: string | null;
  sceneText?: string;
}): BreakthroughOddsReport {
  const {
    profile,
    bottleneckKind,
    targetRealmName,
    stats,
    overflowExp,
    maxOverflowExp,
    assistItemId,
    sceneText,
  } = params;

  const constitution = normalizeConstitutionState(
    profile.constitution,
    profile.systemKind,
    profile.realmIndex,
  );

  // 1. Base odds & realistic ceiling/floor by breakthrough difficulty
  let baseChance = 62;
  let minChance = 12;
  let maxChance = 95;
  if (bottleneckKind === 'major_bottleneck') {
    baseChance = 40;
    minChance = 8;
    maxChance = 92;
  } else if (bottleneckKind === 'tribulation') {
    baseChance = 28;
    minChance = 5;
    maxChance = 88;
  } else if (bottleneckKind === 'max_realm') {
    baseChance = 66;
    minChance = 15;
    maxChance = 95;
  }

  const factors: BreakthroughOddsFactor[] = [];

  const isWuxia = profile.systemKind === 'wuxia';

  // 2. Linh căn / Căn cốt (Spirit Root purity / Martial aptitude)
  const rootPurity = constitution.spiritRoot.purity;
  const rootDelta = Math.round((rootPurity - 45) * (isWuxia ? 0.2 : 0.28));
  factors.push({
    id: 'spirit_root',
    label: `${isWuxia ? 'Căn cốt' : 'Linh căn'} (${rootPurity}%)`,
    delta: rootDelta,
    detail: constitution.spiritRoot.name,
    tone: rootDelta > 0 ? 'positive' : rootDelta < 0 ? 'negative' : 'neutral',
  });

  // 3. Thể chất (Physique refinement — extra impactful on major/tribulation)
  const phyRef = constitution.physique.refinement;
  const phyScale = bottleneckKind === 'tribulation' ? 0.24 : isWuxia ? 0.14 : 0.18;
  const phyDelta = Math.round((phyRef - 35) * phyScale);
  factors.push({
    id: 'physique',
    label: `Thể chất (${phyRef}%)`,
    delta: phyDelta,
    detail: `${constitution.physique.name} · ${constitution.physique.stateLabel}`,
    tone: phyDelta > 0 ? 'positive' : phyDelta < 0 ? 'negative' : 'neutral',
  });

  // 4. Căn cơ & Tạp chất (Foundation solidity & impurity)
  const sol = constitution.foundation.solidity;
  const imp = constitution.foundation.impurity;
  const solDelta = Math.round((sol - 55) * 0.24);
  const impDelta =
    imp > 20
      ? -Math.round((imp - 20) * 0.28)
      : imp <= 10
        ? 4
        : 0;
  const fndDelta = solDelta + impDelta;
  factors.push({
    id: 'foundation',
    label: `${isWuxia ? 'Căn cơ nội công' : 'Căn cơ'} (${sol}% · tạp ${imp}%)`,
    delta: fndDelta,
    detail:
      imp > 35
        ? isWuxia
          ? 'Tạp khí tích tụ trong kinh mạch, dễ gây tẩu hỏa khi xung kích tầng mới'
          : 'Tạp chất còn nhiều, cần tẩy tủy/lọc căn để giảm nguy cơ phản phệ'
        : constitution.foundation.label,
    tone: fndDelta > 0 ? 'positive' : fndDelta < 0 ? 'negative' : 'neutral',
  });

  // 4b. Kiếm hiệp ONLY: Kinh mạch (Bát Mạch) & Tương hợp Dương Cương / Âm Nhu / Thái Cực & Phúc địa ngũ hành
  if (isWuxia) {
    const wuxiaSynergy = evaluateWuxiaSynergy(profile);
    factors.push({
      id: 'wuxia_meridians',
      label: wuxiaSynergy.meridianLabel,
      delta: wuxiaSynergy.meridianDelta,
      detail: wuxiaSynergy.meridianDetail,
      tone:
        wuxiaSynergy.meridianDelta > 0
          ? 'positive'
          : wuxiaSynergy.meridianDelta < 0
            ? 'negative'
            : 'neutral',
    });
    factors.push({
      id: 'wuxia_alignment',
      label: wuxiaSynergy.alignmentLabel,
      delta: wuxiaSynergy.breakthroughDelta,
      detail: wuxiaSynergy.alignmentDetail,
      tone: wuxiaSynergy.alignmentTone,
    });

    const ws = normalizeWuxiaState(profile.wuxiaState, profile.realmIndex);
    const sceneSanc = detectWuxiaSanctuaryFromScene(sceneText);
    const activeSanc =
      sceneSanc !== 'none' ? sceneSanc : ws.activeSanctuary || 'none';
    if (activeSanc !== 'none') {
      const sMeta = WUXIA_SANCTUARY_META[activeSanc];
      const matched = sMeta.favoredPaths.includes(ws.elementPath);
      factors.push({
        id: 'wuxia_sanctuary',
        label: matched ? `Hợp ${sMeta.shortLabel}` : sMeta.shortLabel,
        delta: matched ? 6 : 2,
        detail: sMeta.hint,
        tone: 'positive',
      });
    }
  }

  // 5. Trạng thái hiện tại: Đan độc, Khí huyết / Thần thức, Phản phệ cũ
  if (stats.pillToxicity >= 15) {
    const toxPenalty =
      stats.pillToxicity >= 70
        ? -16
        : stats.pillToxicity >= 45
          ? -9
          : stats.pillToxicity >= 25
            ? -5
            : -2;
    factors.push({
      id: 'pill_toxicity',
      label: `Đan độc (${stats.pillToxicity}%)`,
      delta: toxPenalty,
      detail:
        stats.pillToxicity >= 45
          ? 'Đan độc cản trở kinh mạch, dễ gây loạn khí khi xung kích'
          : 'Đan độc nhẹ tích tụ trong cơ thể',
      tone: 'negative',
    });
  }

  const hpPct = Math.round((stats.hp / Math.max(1, stats.maxHp)) * 100);
  const qiPct = Math.round((stats.qi / Math.max(1, stats.maxQi)) * 100);
  const spiritPct = Math.round((stats.spirit / Math.max(1, stats.maxSpirit)) * 100);
  const minVitalPct = Math.min(hpPct, spiritPct);

  if (minVitalPct < 65 || qiPct < 55) {
    const injuryPenalty =
      minVitalPct < 35
        ? -18
        : minVitalPct < 55
          ? -11
          : -6;
    factors.push({
      id: 'vitals_condition',
      label: 'Thể trạng suy hao',
      delta: injuryPenalty,
      detail: `Khí huyết ${hpPct}% · Linh lực ${qiPct}% · Thần thức ${spiritPct}%`,
      tone: 'negative',
    });
  } else if (hpPct >= 90 && qiPct >= 85 && spiritPct >= 85) {
    factors.push({
      id: 'vitals_peak',
      label: 'Trạng thái đỉnh phong',
      delta: 4,
      detail: 'Khí huyết, linh lực & thần thức đều sung mãn',
      tone: 'positive',
    });
  }

  const hasBacklashInjury = stats.activeBuffs.some((b) =>
    /(?:phản\s*phệ|tẩu\s*hỏa|tổn\s*thương\s*kinh\s*mạch|chấn\s*thương\s*kinh\s*mạch|thần\s*thức\s*dao\s*động|nội\s*thương)/i.test(
      b,
    ),
  );
  if (hasBacklashInjury) {
    factors.push({
      id: 'prior_backlash',
      label: isWuxia ? 'Nội thương / Dư chấn tẩu hỏa' : 'Dư chấn phản phệ',
      delta: -12,
      detail: isWuxia
        ? 'Kinh mạch còn tổn thương hoặc tẩu hỏa chưa dứt, rất dễ loạn khí khi đột phá nội công'
        : 'Kinh mạch/thần thức chưa hồi phục hoàn toàn sau lần thất bại trước',
      tone: 'negative',
    });
  }

  // 6. Tu vi dư tích tụ (Overflow EXP depth)
  if (overflowExp > 0 && maxOverflowExp > 0) {
    const ratio = Math.min(1, overflowExp / maxOverflowExp);
    const overflowDelta = Math.max(2, Math.round(ratio * 7));
    factors.push({
      id: 'overflow_depth',
      label: `Nội tình dư (+${overflowExp})`,
      delta: overflowDelta,
      detail: 'Tích lũy tu vi dày dặn giúp xung kích ổn định hơn',
      tone: 'positive',
    });
  }

  // 7. Dược lực trợ bình cảnh đã dùng trước đó
  if (stats.breakthroughEase > 0) {
    const easeDelta = Math.min(26, Math.max(3, Math.round(stats.breakthroughEase * 0.45)));
    factors.push({
      id: 'breakthrough_ease',
      label: `Dược lực trợ bình cảnh`,
      delta: easeDelta,
      detail: `Đang tích sẵn +${stats.breakthroughEase}% trợ lực từ đan dược/linh dịch`,
      tone: 'positive',
    });
  }

  // 8. Vật phẩm trợ lực chọn dùng kèm ngay lúc đột phá
  const assistOptions = getBreakthroughAssistItems(profile);
  const selectedAssist = assistItemId
    ? assistOptions.find((opt) => opt.item.id === assistItemId)
    : undefined;
  if (selectedAssist) {
    factors.push({
      id: 'assist_item',
      label: `Dùng ${selectedAssist.item.name}`,
      delta: selectedAssist.bonusPercent,
      detail: `${selectedAssist.roleLabel} (tiêu hao x1 khi xung kích)`,
      tone: 'positive',
    });
  }

  // 9. Diễn biến truyện & Địa lợi / Hộ pháp
  const cleanScene = (sceneText || '').trim();
  if (cleanScene.length >= 20) {
    const hostile = HOSTILE_SCENE_RE.test(cleanScene);
    const favorable = FAVORABLE_SCENE_RE.test(cleanScene);
    if (hostile) {
      factors.push({
        id: 'scene_hostile',
        label: 'Hoàn cảnh bất lợi',
        delta: -10,
        detail: 'Diễn biến hiện tại có nguy cơ giao chiến, thương thế hoặc bị quấy nhiễu',
        tone: 'negative',
      });
    } else if (favorable) {
      factors.push({
        id: 'scene_favorable',
        label: 'Địa lợi / Hộ pháp',
        delta: 5,
        detail: 'Đang ở nơi yên tĩnh, động phủ, linh mạch hoặc có hộ pháp hỗ trợ',
        tone: 'positive',
      });
    }
  }

  const totalDelta = factors.reduce((sum, f) => sum + f.delta, 0);
  const finalChance = Math.max(minChance, Math.min(maxChance, baseChance + totalDelta));

  let riskLevel: BreakthroughRiskLevel = 'moderate';
  let riskLabel = 'Khả quan · Có thể thử';
  let recommendation =
    'Tỷ lệ tương đối ổn; dùng thêm đan trợ đột phá hoặc linh thạch sẽ an toàn hơn.';

  if (finalChance >= 80) {
    riskLevel = 'high';
    riskLabel = 'Rất cao · Vững chắc';
    recommendation =
      bottleneckKind === 'tribulation'
        ? 'Chuẩn bị đã rất tốt, nhưng Thiên Kiếp vẫn luôn ẩn chứa biến số — hãy tập trung toàn lực.'
        : 'Nền tảng vững vàng, thời cơ chín muồi để xung kích phá bình cảnh.';
  } else if (finalChance >= 60) {
    riskLevel = 'moderate';
    riskLabel = 'Khả quan · Có thể thử';
    recommendation =
      'Khả năng thành công khá tốt; cân nhắc kèm đan trợ đột phá nếu muốn giảm rủi ro phản phệ.';
  } else if (finalChance >= 40) {
    riskLevel = 'risky';
    riskLabel = 'Mạo hiểm · Nên chuẩn bị thêm';
    recommendation =
      'Tỷ lệ còn bấp bênh — nên lọc đan độc, dùng đan trợ đột phá/tẩy tủy hoặc bồi thêm nội tình trước khi phá quan.';
  } else {
    riskLevel = 'dangerous';
    riskLabel = 'Nguy hiểm · Dễ phản phệ';
    recommendation =
      'Rất dễ thất bại và chịu phản phệ kinh mạch/thần thức! Khuyên nên trị thương, thanh lọc tạp chất và chuẩn bị thêm đan dược hộ pháp.';
  }

  return {
    bottleneckKind,
    targetRealmName,
    baseChance,
    finalChance,
    minChance,
    maxChance,
    riskLevel,
    riskLabel,
    recommendation,
    factors,
    selectedAssist,
    assistOptions,
  };
}

/**
 * Applies realistic, tiered consequences when a breakthrough attempt fails.
 * Never advances realmIndex/realmName; synchronizes vitals, EXP/overflow, constitution
 * impurity/solidity, active backlash debuffs, and story prompt for AI narration.
 */
export function applyBreakthroughFailureOutcome(params: {
  profile: CultivationProfile;
  odds: BreakthroughOddsReport;
  stats: BreakthroughStatsSnapshot;
  prevRealmName: string;
  roll?: number;
  assistItemUsed?: InventoryItem;
  source?: 'manual' | 'story';
}): {
  nextProfile: CultivationProfile;
  outcomeRecord: BreakthroughOutcomeRecord;
  severity: 'minor_setback' | 'meridian_backlash' | 'severe_backlash';
  headline: string;
} {
  const {
    profile,
    odds,
    stats,
    prevRealmName,
    roll,
    assistItemUsed,
    source = 'manual',
  } = params;

  const isTribulation = odds.bottleneckKind === 'tribulation';
  const isMajor = odds.bottleneckKind === 'major_bottleneck' || isTribulation;

  // Determine tiered severity
  let severity: 'minor_setback' | 'meridian_backlash' | 'severe_backlash' =
    'minor_setback';
  if (isTribulation || (isMajor && odds.finalChance < 38)) {
    severity = 'severe_backlash';
  } else if (isMajor || odds.finalChance < 45) {
    severity = 'meridian_backlash';
  }

  const maxExp = Math.max(10, Math.round(profile.maxExp || 100));
  const prevExp = Math.max(0, Math.round(profile.exp || 0));
  const prevOverflow = Math.max(0, Math.round(profile.overflowExp || 0));
  const prevConst = normalizeConstitutionState(
    profile.constitution,
    profile.systemKind,
    profile.realmIndex,
  );

  const consequences: string[] = [];
  let nextExp = prevExp;
  let nextOverflow = prevOverflow;
  let hpLoss = 0;
  let qiLoss = 0;
  let spiritLoss = 0;
  let toxAdd = 0;
  let nextEase = 0;
  let solLoss = 0;
  let impAdd = 0;
  let debuffLabel = '';

  if (severity === 'minor_setback') {
    const overflowLost = Math.round(prevOverflow * 0.5);
    const expDrop = Math.max(4, Math.round(maxExp * 0.06));
    nextOverflow = Math.max(0, prevOverflow - overflowLost);
    nextExp = Math.max(Math.round(maxExp * 0.72), prevExp - expDrop);
    qiLoss = Math.round(stats.maxQi * 0.28);
    spiritLoss = Math.round(stats.maxSpirit * 0.14);
    nextEase = Math.round(stats.breakthroughEase * 0.25);
    impAdd = 2;

    if (overflowLost > 0) consequences.push(`Tiêu hao ${overflowLost} tu vi dư`);
    consequences.push(`Tu vi dao động -${prevExp - nextExp} (cần ổn định lại)`);
    consequences.push(`${stats.energyName} hao tổn -${qiLoss}`);
  } else if (severity === 'meridian_backlash') {
    const overflowLost = Math.round(prevOverflow * 0.75);
    const expDrop = Math.max(8, Math.round(maxExp * 0.12));
    nextOverflow = Math.max(0, prevOverflow - overflowLost);
    nextExp = Math.max(Math.round(maxExp * 0.65), prevExp - expDrop);
    hpLoss = Math.round(stats.maxHp * 0.28);
    qiLoss = Math.round(stats.maxQi * 0.55);
    spiritLoss = Math.round(stats.maxSpirit * 0.3);
    toxAdd = 6;
    solLoss = 3;
    impAdd = 6;
    debuffLabel = 'Phản phệ kinh mạch (cần điều tức/trị thương)';

    if (overflowLost > 0) consequences.push(`Tiêu tán ${overflowLost} tu vi dư`);
    consequences.push(`Tu vi lùi -${prevExp - nextExp}`);
    consequences.push(`${stats.hpName} -${hpLoss} · Thần thức -${spiritLoss}`);
    consequences.push(`Kinh mạch phản phệ (căn cơ -${solLoss}%, tạp chất +${impAdd}%)`);
  } else {
    // severe_backlash
    const overflowLost = prevOverflow;
    const expDrop = Math.max(12, Math.round(maxExp * 0.18));
    nextOverflow = 0;
    nextExp = Math.max(Math.round(maxExp * 0.58), prevExp - expDrop);
    hpLoss = Math.round(stats.maxHp * 0.48);
    qiLoss = Math.round(stats.maxQi * 0.75);
    spiritLoss = Math.round(stats.maxSpirit * 0.48);
    toxAdd = 10;
    solLoss = 5;
    impAdd = 10;
    debuffLabel = isTribulation
      ? 'Chấn thương kinh mạch · Thần thức dao động (phản phệ thiên kiếp)'
      : 'Trọng thương kinh mạch · Khí hải chấn động (phản phệ đại cảnh giới)';

    if (overflowLost > 0) consequences.push(`Tán sạch ${overflowLost} tu vi dư`);
    consequences.push(`Tu vi suy giảm -${prevExp - nextExp}`);
    consequences.push(`${stats.hpName} -${hpLoss} · Thần thức -${spiritLoss}`);
    consequences.push(`Phản phệ nặng (căn cơ -${solLoss}%, tạp chất +${impAdd}%)`);
  }

  if (assistItemUsed) {
    consequences.unshift(`Đã tiêu hao 1 ${assistItemUsed.name}`);
  }

  const nextHp = Math.max(
    Math.max(10, Math.round(stats.maxHp * 0.1)),
    stats.hp - hpLoss,
  );
  const nextQi = Math.max(0, stats.qi - qiLoss);
  const nextSpirit = Math.max(
    Math.max(5, Math.round(stats.maxSpirit * 0.12)),
    stats.spirit - spiritLoss,
  );
  const nextTox = Math.min(100, stats.pillToxicity + toxAdd);
  const prevBuffs = Array.isArray(profile.vitals?.activeBuffs)
    ? profile.vitals!.activeBuffs
    : [];
  const cleanedBuffs = prevBuffs.filter(
    (b) => !/dược lực trợ đột phá/i.test(b),
  );
  const nextBuffs = debuffLabel
    ? [debuffLabel, ...cleanedBuffs.filter((b) => b !== debuffLabel)].slice(0, 4)
    : cleanedBuffs;

  const nextConstitution = {
    ...prevConst,
    foundation: {
      ...prevConst.foundation,
      solidity: Math.max(15, prevConst.foundation.solidity - solLoss),
      impurity: Math.min(100, prevConst.foundation.impurity + impAdd),
    },
    updatedAt: Date.now(),
  };

  const isWuxia = profile.systemKind === 'wuxia';
  const severityLabel =
    severity === 'severe_backlash'
      ? isWuxia
        ? 'Xung kích tầng nội công thất bại — Tẩu hỏa chấn thương kinh mạch'
        : isTribulation
          ? 'Độ kiếp thất bại — Phản phệ nặng'
          : 'Đột phá đại cảnh giới thất bại — Trọng thương phản phệ'
      : severity === 'meridian_backlash'
        ? isWuxia
          ? 'Đột phá nội công thất bại — Chấn thương kinh mạch · loạn chân khí'
          : 'Đột phá thất bại — Phản phệ kinh mạch'
        : isWuxia
          ? 'Xung kích nội công chưa thành — Hao khí lực, giữ nguyên tầng'
          : 'Xung kích chưa thành — Bình cảnh chưa vỡ';

  const sourcePrefix =
    source === 'story' ? 'Đồng bộ từ truyện' : `Tỷ lệ ${odds.finalChance}%`;
  const summary = `${severityLabel} (${sourcePrefix}, vẫn giữ ${prevRealmName}): ${consequences.slice(0, 3).join(' · ')}`;

  const assistClause = assistItemUsed
    ? ` dù đã dùng ${assistItemUsed.name}`
    : '';
  const storyPrompt = isWuxia
    ? severity === 'severe_backlash'
      ? `Ta gượng ép vận công xung kích tầng nội công hướng tới ${odds.targetRealmName}${assistClause} (xác suất ${odds.finalChance}%), nhưng chân khí nghịch lưu gây tẩu hỏa và chấn thương kinh mạch nặng, thổ huyết suy yếu (${consequences.slice(0, 3).join(', ')}).`
      : severity === 'meridian_backlash'
        ? `Ta vận chuyển nội lực xung kích bình cảnh hướng tới ${odds.targetRealmName}${assistClause} (xác suất ${odds.finalChance}%), nhưng đột phá nội công thất bại, kinh mạch bị phản chấn khiến khí huyết hao tổn (${consequences.slice(0, 3).join(', ')}).`
        : `Ta thử xung kích tầng nội công hướng tới ${odds.targetRealmName}${assistClause} (xác suất ${odds.finalChance}%), nhưng bình cảnh nội công vẫn chưa vỡ, đành thu khí điều tức sau khi hao tổn một phần chân khí (${consequences.slice(0, 2).join(', ')}).`
    : severity === 'severe_backlash'
      ? `Ta liều mình xung kích bình cảnh hướng tới ${odds.targetRealmName}${assistClause} (xác suất ${odds.finalChance}%), nhưng lực cản quá mạnh khiến đột phá thất bại và gặp phản phệ nặng: kinh mạch chấn thương, thần thức dao động, thổ huyết suy yếu (${consequences.slice(0, 3).join(', ')}).`
      : severity === 'meridian_backlash'
        ? `Ta vận công xung kích bình cảnh hướng tới ${odds.targetRealmName}${assistClause} (xác suất ${odds.finalChance}%), nhưng đột phá bất thành và chịu phản phệ kinh mạch: linh lực rối loạn, khí huyết hao tổn (${consequences.slice(0, 3).join(', ')}).`
        : `Ta thử xung kích bình cảnh hướng tới ${odds.targetRealmName}${assistClause} (xác suất ${odds.finalChance}%), nhưng bình cảnh chỉ rung chuyển chứ chưa thể phá vỡ, đành thu công điều tức vì tu vi dao động nhẹ (${consequences.slice(0, 2).join(', ')}).`;

  const outcomeRecord: BreakthroughOutcomeRecord = {
    outcome: 'failed',
    severity,
    chancePercent: odds.finalChance,
    ...(typeof roll === 'number' ? { roll } : {}),
    fromRealm: prevRealmName,
    targetRealm: odds.targetRealmName,
    ...(assistItemUsed ? { assistItemName: assistItemUsed.name } : {}),
    summary,
    consequences,
    storyPrompt,
    timestamp: Date.now(),
  };

  const nextProfile: CultivationProfile = {
    ...profile,
    exp: nextExp,
    overflowExp: nextOverflow,
    readyToBreakthrough: nextExp >= maxExp,
    vitals: {
      ...(profile.vitals || {}),
      hp: nextHp,
      qi: nextQi,
      spirit: nextSpirit,
      pillToxicity: nextTox,
      breakthroughEase: nextEase,
      activeBuffs: nextBuffs,
    },
    constitution: nextConstitution,
    lastGainSummary: summary,
    lastBreakthroughNote: summary,
    lastBreakthroughOutcome: outcomeRecord,
    lastUpdatedAt: Date.now(),
  };

  return {
    nextProfile,
    outcomeRecord,
    severity,
    headline: summary,
  };
}

/**
 * Helper used when a player selects an assist item right inside the breakthrough modal:
 * consumes 1 quantity and applies any underlying constitution cleansing if it's a celestial/cleansing elixir.
 */
export function consumeBreakthroughAssistItem(
  profile: CultivationProfile,
  assistItemId: string,
): { nextProfile: CultivationProfile; consumedItem?: InventoryItem } {
  const target = profile.inventory.find((i) => i.id === assistItemId);
  if (!target || target.quantity <= 0) {
    return { nextProfile: profile };
  }

  const nextInventory = profile.inventory
    .map((item) =>
      item.id === assistItemId
        ? { ...item, quantity: item.quantity - 1 }
        : item,
    )
    .filter((item) => item.quantity > 0);

  const constUpgrade = applyConstitutionEffectFromItem(profile, target);

  return {
    nextProfile: {
      ...profile,
      inventory: nextInventory,
      ...(constUpgrade.changed ? { constitution: constUpgrade.nextConstitution } : {}),
    },
    consumedItem: target,
  };
}
