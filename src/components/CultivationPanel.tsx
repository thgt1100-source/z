import { useEffect, useMemo, useRef, useState } from 'react';
import { useActionConfirmFeedback } from '../utils/touchFeedback';
import {
  ArrowUpCircle,
  Backpack,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Edit3,
  Eye,
  Flame,
  Hammer,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Unlock,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  CompactMasteryBar,
  getSkillMasteryBarClasses,
  resolveSkillMasteryBarStatus,
} from './CompactMasteryBar';
import type {
  CultivationProfile,
  CultivationRankingBoard,
  CultivationRankingEntry,
  CultivationSystemKind,
  CultivationTechnique,
  EquipmentMap,
  EquipmentSlotId,
  InventoryItem,
  InventoryItemCategory,
  InventoryItemQuality,
  ProdigyTier,
  StoryClockState,
  TechniqueCategory,
  TechniqueMove,
  TechniqueTier,
  WuxiaElementPath,
  WuxiaSanctuaryKind,
} from '../types/ark';
import {
  applyCultivationExpGain,
  attemptBreakthroughWithOdds,
  buildMoveTrainStoryPrompt,
  buildMoveUnlockStoryPrompt,
  buildTechniqueTrainStoryPrompt,
  buildTechniqueUnlockStoryPrompt,
  buyWuxiaShopItem,
  calculateBreakthroughOdds,
  checkCraftingRecipeAvailability,
  computeCharacterStats,
  computeWuxiaSilverBalance,
  consumeInventoryItem,
  craftWuxiaRecipe,
  CULTIVATION_RANKING_BOARD_META,
  CULTIVATION_RANKING_BOARD_ORDER,
  CULTIVATION_SCHEMA_VERSION,
  CULTIVATION_SUB_STAGES,
  CULTIVATION_SYSTEM_META,
  enforceTopTenPerBoard,
  EQUIPMENT_SLOT_ORDER,
  equipInventoryItem,
  evaluateWuxiaSynergy,
  findSpiritStoneInInventory,
  findWuxiaCatalogItemById,
  generateSuggestedMovesForTechnique,
  getBreakthroughBottleneckInfo,
  getConstitutionLabels,
  getCultivationDisplayInfo,
  getCultivationPaceDescription,
  getEquipmentBoardTitle,
  getEquipmentItemBonuses,
  getEquipmentSlotMeta,
  getEquipmentSlotOrder,
  getEquippedSlotForItem,
  getInventoryCategoryLabel,
  getInventoryCategoryOrder,
  getInventoryCategoryShortLabel,
  getInventoryQualityMeta,
  getItemEquipmentSlot,
  getMaxOverflowExp,
  getMoveLockStatus,
  getNextRealmStage,
  getQuickSeclusionPresets,
  getRealmVisualTheme,
  getTechniqueLockStatus,
  getWuxiaForgingSuggestion,
  getWuxiaInnerArtCeilingInfo,
  getWuxiaTitleByLayer,
  getWuxiaTitleReferenceRows,
  INVENTORY_QUALITY_META,
  INVENTORY_QUALITY_ORDER,
  isConstitutionEnhancingItem,
  isItemEquippable,
  isJunkInventoryItemName,
  MASTERY_LOCK_CONDITION_META,
  MAX_RANKING_ENTRIES_PER_BOARD,
  normalizeConstitutionState,
  normalizeWuxiaState,
  parseSubStageFromText,
  PRODIGY_TIER_META,
  resolveFoundationGrade,
  resolvePhysiqueGrade,
  resolveSpiritRootGrade,
  sanitizeInventoryItems,
  scanTurnForLootSuggestions,
  TECHNIQUE_TIER_META,
  trainMoveWithSpiritStone,
  trainTechniqueWithSpiritStone,
  unequipInventorySlot,
  unlockMoveBottleneck,
  unlockTechniqueBottleneck,
  WUXIA_CATALOG_GROUPS,
  WUXIA_CRAFTING_RECIPES,
  WUXIA_ELEMENT_PATH_META,
  WUXIA_ITEM_CATALOG,
  WUXIA_JIANGHU_INNER_ARTS,
  WUXIA_ORIGIN_META,
  WUXIA_SANCTUARY_META,
  WUXIA_SANCTUARY_ORDER,
  WUXIA_SECT_GRADE_META,
  WUXIA_SECT_INNER_ARTS,
  WUXIA_SHOP_LISTINGS,
  WUXIA_SHOP_VENUES,
  XIANXIA_ITEM_CATALOG,
  type LootSuggestion,
  type RankingIntelLocationStatus,
  type WuxiaCatalogGroupId,
  type WuxiaCatalogItem,
  type WuxiaCraftingDiscipline,
  type WuxiaJianghuInnerArt,
  type WuxiaShopVenueId,
  type XianxiaCatalogItem,
} from '../utils/cultivation';
import {
  addMinutesToClock,
  addMonthsToClock,
  addYearsToClock,
  clockToEpochMinutes,
  formatDeltaMinutesVi,
  formatStoryClock,
  normalizeStoryClock,
} from '../utils/storyClock';

export type CultivationSubTab =
  | 'realm'
  | 'techniques'
  | 'inventory'
  | 'rankings';

export interface QuickCultivateResult {
  expGained: number;
  leveledTechniques: string[];
  leveledMoves: string[];
  lockedTechniques?: string[];
  lockedMoves?: string[];
  becameReadyToBreakthrough: boolean;
  readyToBreakthrough: boolean;
  clockBeforeLabel: string;
  clockAfterLabel: string;
  canChiBefore?: string;
  canChiAfter?: string;
  deltaLabel: string;
  seclusionSummary?: string;
  isSeclusionJump?: boolean;
}

interface CultivationPanelProps {
  profile: CultivationProfile;
  mcName?: string;
  storyClock?: StoryClockState;
  currentTurnText?: string;
  initialTab?: CultivationSubTab;
  initialSeclusionOpen?: boolean;
  intelLocationStatus?: RankingIntelLocationStatus;
  mainModelName?: string;
  onUpdateProfile: (
    updater: (prev: CultivationProfile) => CultivationProfile,
  ) => void;
  onQuickCultivate?: (
    durationMinutes: number,
    label: string,
    options?: {
      months?: number;
      years?: number;
      isSeclusionJump?: boolean;
    },
  ) => QuickCultivateResult | null;
  onInsertStoryPrompt?: (promptText: string) => void;
  onGenerateRankings?: (
    targetBoard: CultivationRankingBoard | 'all',
    onProgress?: (msg: string) => void,
  ) => Promise<{
    ok: boolean;
    error?: string;
    count?: number;
    boardsCount?: number;
  }>;
  onUnlockRankingIntel?: (
    entry: CultivationRankingEntry,
    locationHint: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onRecalculateRankings?: (
    targetBoard: CultivationRankingBoard | 'all',
    onProgress?: (msg: string) => void,
  ) => Promise<{ ok: boolean; error?: string; changeSummary?: string }>;
  onSimulateRankingSpar?: (
    targetBoard: CultivationRankingBoard | 'all',
    npcA: CultivationRankingEntry,
    npcB: CultivationRankingEntry,
    onProgress?: (msg: string) => void,
  ) => Promise<{
    ok: boolean;
    error?: string;
    npcAName?: string;
    npcARank?: number;
    npcBName?: string;
    npcBRank?: number;
    boardLabel?: string;
    venue?: string;
    summary?: string;
    verdict?: string;
  }>;
  onOpenClock?: () => void;
  onClose?: () => void;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
}

const TIER_ORDER: TechniqueTier[] = [
  'pham',
  'linh',
  'huyen',
  'dia',
  'thien',
  'chiton',
];

const QUALITY_ORDER: readonly InventoryItemQuality[] = INVENTORY_QUALITY_ORDER;

export function CultivationPanel({
  profile,
  mcName,
  storyClock,
  currentTurnText = '',
  initialTab = 'realm',
  initialSeclusionOpen = false,
  intelLocationStatus,
  mainModelName,
  onUpdateProfile,
  onQuickCultivate,
  onInsertStoryPrompt,
  onGenerateRankings,
  onUnlockRankingIntel,
  onRecalculateRankings,
  onSimulateRankingSpar,
  onOpenClock,
  onClose,
  onNotify,
}: CultivationPanelProps) {
  const [activeTab, setActiveTab] = useState<CultivationSubTab>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Quick Seclusion Lock (Khóa tu luyện nhanh) & short Quick Cultivation state
  const [seclusionOpen, setSeclusionOpen] = useState(initialSeclusionOpen);
  useEffect(() => {
    if (initialSeclusionOpen) {
      setActiveTab('realm');
      setSeclusionOpen(true);
    }
  }, [initialSeclusionOpen]);
  const [customSeclusionAmount, setCustomSeclusionAmount] = useState('2');
  const [quickTrainOpen, setQuickTrainOpen] = useState(!initialSeclusionOpen);
  const [customTrainHours, setCustomTrainHours] = useState('2');
  const [lastQuickResult, setLastQuickResult] =
    useState<QuickCultivateResult | null>(null);
  const [breakthroughConfirmOpen, setBreakthroughConfirmOpen] = useState(false);
  const [selectedBreakthroughAssistId, setSelectedBreakthroughAssistId] =
    useState('');
  const [wuxiaTitleTableOpen, setWuxiaTitleTableOpen] = useState(false);
  const [wuxiaInnerArtCatalogOpen, setWuxiaInnerArtCatalogOpen] =
    useState(false);
  const [wuxiaCatalogTab, setWuxiaCatalogTab] = useState<'mon_phai' | 'giang_ho'>(
    'mon_phai',
  );

  // Realm quick-edit state
  const [editingRealm, setEditingRealm] = useState(false);
  const [draftSystemKind, setDraftSystemKind] = useState<CultivationSystemKind>(
    profile.systemKind,
  );
  const [draftRealmIndex, setDraftRealmIndex] = useState(profile.realmIndex);
  const [draftRealmName, setDraftRealmName] = useState(profile.realmName);
  const [draftExp, setDraftExp] = useState(String(profile.exp));
  const [draftMaxExp, setDraftMaxExp] = useState(String(profile.maxExp));
  const [draftBagName, setDraftBagName] = useState(profile.bagName);
  const [draftCombatPowerNote, setDraftCombatPowerNote] = useState(
    profile.combatPowerNote || '',
  );

  // Thiên – Địa – Nhân & Bảng Thiên Kiêu state
  const [rankingBoardFilter, setRankingBoardFilter] = useState<
    'all' | CultivationRankingBoard
  >('all');
  const [rankingFormOpen, setRankingFormOpen] = useState(false);
  const [editingRankingId, setEditingRankingId] = useState<string | null>(null);
  const [rankBoard, setRankBoard] = useState<CultivationRankingBoard>('nhan');
  const [rankPosition, setRankPosition] = useState('1');
  const [rankName, setRankName] = useState('');
  const [rankRealm, setRankRealm] = useState('');
  const [rankCombatPower, setRankCombatPower] = useState('');
  const [rankFaction, setRankFaction] = useState('');
  const [rankStance, setRankStance] = useState('');
  const [rankScopeLabel, setRankScopeLabel] = useState('');
  const [rankProdigyTier, setRankProdigyTier] =
    useState<ProdigyTier>('nghich_thien');
  const [rankIsVeteran, setRankIsVeteran] = useState(false);
  const [expandedRankingId, setExpandedRankingId] = useState<string | null>(
    null,
  );
  const [rankingAiBusy, setRankingAiBusy] = useState<
    null | 'generate' | 'recalc' | 'spar'
  >(null);
  const rankingBusyRef = useRef(false);
  const unlockBusyRef = useRef(false);
  const { isConfirmed, triggerConfirm } = useActionConfirmFeedback(1100);
  const [rankingAiProgress, setRankingAiProgress] = useState('');
  const [unlockingRankingId, setUnlockingRankingId] = useState<string | null>(
    null,
  );
  const [lastRankingChangeSummary, setLastRankingChangeSummary] = useState('');
  const [sparResult, setSparResult] = useState<{
    npcAName: string;
    npcARank: number;
    npcBName: string;
    npcBRank: number;
    boardLabel: string;
    venue?: string;
    summary: string;
    verdict?: string;
  } | null>(null);

  // Technique composer / editor
  const [techFormOpen, setTechFormOpen] = useState(false);
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [techName, setTechName] = useState('');
  const [techCategory, setTechCategory] =
    useState<TechniqueCategory>('martial');
  const [techTier, setTechTier] = useState<TechniqueTier>('linh');
  const [techLevel, setTechLevel] = useState('1');
  const [techMaxLevel, setTechMaxLevel] = useState('9');
  const [techMastery, setTechMastery] = useState('10');
  const [techActiveTraining, setTechActiveTraining] = useState(false);
  const [techAutoGenerateMoves, setTechAutoGenerateMoves] = useState(true);
  const [techDesc, setTechDesc] = useState('');
  const [techUnlockCond, setTechUnlockCond] = useState('');

  // Moves (Chiêu thức) expand + add/edit state
  const [focusedTechId, setFocusedTechId] = useState<string | null>(null);
  const [expandedMovesTechIds, setExpandedMovesTechIds] = useState<
    Record<string, boolean>
  >({});
  const [moveFormTechId, setMoveFormTechId] = useState<string | null>(null);
  const [editingMoveId, setEditingMoveId] = useState<string | null>(null);
  const [moveName, setMoveName] = useState('');
  const [moveDesc, setMoveDesc] = useState('');
  const [moveLevel, setMoveLevel] = useState('1');
  const [moveMaxLevel, setMoveMaxLevel] = useState('5');
  const [moveMastery, setMoveMastery] = useState('20');
  const [moveUnlockCond, setMoveUnlockCond] = useState('');

  // Inventory composer / editor & genre catalog / shop-craft drawer
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemQuality, setItemQuality] =
    useState<InventoryItemQuality>('uncommon');
  const [itemCategory, setItemCategory] =
    useState<InventoryItemCategory>('consumable');
  const [itemDesc, setItemDesc] = useState('');
  const [itemEquipSlot, setItemEquipSlot] = useState<'' | EquipmentSlotId>('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<
    'all' | InventoryItemCategory
  >('all');
  const [inventoryWeaponQualityFilter, setInventoryWeaponQualityFilter] =
    useState<'all' | InventoryItemQuality>('all');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState<
    'all' | InventoryItemCategory
  >('all');
  const [wuxiaCatalogGroup, setWuxiaCatalogGroup] = useState<
    'all' | WuxiaCatalogGroupId
  >('all');
  const [wuxiaCatalogOwnedOnly, setWuxiaCatalogOwnedOnly] = useState(false);
  const [selectedWuxiaDetailItemId, setSelectedWuxiaDetailItemId] = useState<
    string | null
  >(null);
  const [catalogQuality, setCatalogQuality] = useState<
    'all' | InventoryItemQuality
  >('all');
  const [shopCraftOpen, setShopCraftOpen] = useState(false);
  const [shopCraftMode, setShopCraftMode] = useState<'shop' | 'craft'>('shop');
  const [shopVenueFilter, setShopVenueFilter] = useState<
    'all' | WuxiaShopVenueId
  >('all');
  const [craftDisciplineFilter, setCraftDisciplineFilter] = useState<
    'all' | WuxiaCraftingDiscipline
  >('all');
  const [lastItemAction, setLastItemAction] = useState<{
    kind: 'consume' | 'equip' | 'unequip' | 'shop' | 'craft';
    itemName: string;
    headline: string;
    effectLines: string[];
    constitutionChanges?: string[];
    storyPrompt: string;
    remainingLabel?: string;
    toxicityWarning?: string;
  } | null>(null);

  // Linh căn · Thể chất · Căn cơ inline editor state
  const [editingConstitution, setEditingConstitution] = useState(false);
  const [draftRootName, setDraftRootName] = useState('');
  const [draftRootElements, setDraftRootElements] = useState('');
  const [draftRootPurity, setDraftRootPurity] = useState('40');
  const [draftRootAffinity, setDraftRootAffinity] = useState('');
  const [draftPhyName, setDraftPhyName] = useState('');
  const [draftPhyRefinement, setDraftPhyRefinement] = useState('30');
  const [draftPhyState, setDraftPhyState] = useState('');
  const [draftPhyTraits, setDraftPhyTraits] = useState('');
  const [draftFndLabel, setDraftFndLabel] = useState('');
  const [draftFndSolidity, setDraftFndSolidity] = useState('60');
  const [draftFndImpurity, setDraftFndImpurity] = useState('28');
  const [draftFndResilience, setDraftFndResilience] = useState('');

  const isWuxia = profile.systemKind === 'wuxia';
  const charStats = useMemo(() => computeCharacterStats(profile), [profile]);
  const wuxiaWallet = useMemo(
    () => (isWuxia ? computeWuxiaSilverBalance(profile.inventory) : null),
    [isWuxia, profile.inventory],
  );
  const categoryOrderForSystem = useMemo(
    () => getInventoryCategoryOrder(profile.systemKind, false),
    [profile.systemKind],
  );
  const formCategoryOrderForSystem = useMemo(
    () => getInventoryCategoryOrder(profile.systemKind, true),
    [profile.systemKind],
  );
  const realmTheme = useMemo(() => getRealmVisualTheme(profile), [profile]);
  const constitution = useMemo(
    () =>
      normalizeConstitutionState(
        profile.constitution,
        profile.systemKind,
        profile.realmIndex,
      ),
    [profile.constitution, profile.systemKind, profile.realmIndex],
  );
  const constitutionLabels = useMemo(
    () => getConstitutionLabels(profile.systemKind),
    [profile.systemKind],
  );
  const wuxiaState = useMemo(
    () =>
      profile.systemKind === 'wuxia'
        ? normalizeWuxiaState(profile.wuxiaState, profile.realmIndex)
        : null,
    [profile.systemKind, profile.wuxiaState, profile.realmIndex],
  );
  const wuxiaTitleInfo = useMemo(
    () => (wuxiaState ? getWuxiaTitleByLayer(wuxiaState.innerLayer) : null),
    [wuxiaState],
  );
  const wuxiaCeiling = useMemo(
    () =>
      profile.systemKind === 'wuxia'
        ? getWuxiaInnerArtCeilingInfo(profile)
        : null,
    [profile],
  );
  const wuxiaRefRows = useMemo(
    () =>
      profile.systemKind === 'wuxia' ? getWuxiaTitleReferenceRows(profile) : [],
    [profile],
  );
  const wuxiaSynergy = useMemo(
    () =>
      profile.systemKind === 'wuxia' ? evaluateWuxiaSynergy(profile) : null,
    [profile],
  );
  const cleansingBagItems = useMemo(
    () => profile.inventory.filter((item) => isConstitutionEnhancingItem(item)),
    [profile.inventory],
  );

  // Auto-clean any legacy junk items (such as "Gốc") if still lingering in active memory
  useEffect(() => {
    const hasJunk = profile.inventory.some((item) =>
      isJunkInventoryItemName(item.name),
    );
    if (hasJunk) {
      onUpdateProfile((prev) => ({
        ...prev,
        inventory: sanitizeInventoryItems(prev.inventory),
        lastUpdatedAt: Date.now(),
      }));
    }
  }, [profile.inventory, onUpdateProfile]);

  const meta = CULTIVATION_SYSTEM_META[profile.systemKind];
  const displayInfo = getCultivationDisplayInfo(profile);
  const nextRealm = getNextRealmStage(profile);
  const bottleneckInfo = getBreakthroughBottleneckInfo(profile);
  const seclusionPresets = useMemo(
    () => getQuickSeclusionPresets(profile.systemKind),
    [profile.systemKind],
  );
  const paceDescription = getCultivationPaceDescription(profile.systemKind);
  const expPct = Math.min(
    100,
    Math.round((profile.exp / Math.max(1, profile.maxExp)) * 100),
  );
  const canBreakthrough = profile.exp >= profile.maxExp;

  const breakthroughOdds = useMemo(
    () =>
      canBreakthrough
        ? calculateBreakthroughOdds(profile, {
            assistItemId: selectedBreakthroughAssistId || null,
            sceneText: currentTurnText,
          })
        : null,
    [canBreakthrough, profile, selectedBreakthroughAssistId, currentTurnText],
  );

  useEffect(() => {
    if (!canBreakthrough) {
      setBreakthroughConfirmOpen(false);
      setSelectedBreakthroughAssistId('');
    }
  }, [canBreakthrough]);

  useEffect(() => {
    if (
      selectedBreakthroughAssistId &&
      !profile.inventory.some(
        (i) => i.id === selectedBreakthroughAssistId && i.quantity > 0,
      )
    ) {
      setSelectedBreakthroughAssistId('');
    }
  }, [profile.inventory, selectedBreakthroughAssistId]);

  const normalizedClock = useMemo(
    () => (storyClock ? normalizeStoryClock(storyClock) : null),
    [storyClock],
  );
  const formattedClock = useMemo(
    () => (normalizedClock ? formatStoryClock(normalizedClock) : null),
    [normalizedClock],
  );
  const activeTrainingNames = useMemo(() => {
    const active = profile.techniques
      .filter((t) => t.isActiveTraining)
      .map((t) => t.name);
    if (active.length > 0) return active;
    const fallback =
      profile.techniques.find((t) => t.category === 'mental') ||
      profile.techniques[0];
    return fallback ? [`${fallback.name} (mặc định)`] : [];
  }, [profile.techniques]);

  const lootSuggestions = useMemo(
    () => scanTurnForLootSuggestions(currentTurnText, profile),
    [currentTurnText, profile],
  );

  const openRealmEditor = () => {
    setDraftSystemKind(profile.systemKind);
    setDraftRealmIndex(profile.realmIndex);
    setDraftRealmName(profile.realmName);
    setDraftExp(String(profile.exp));
    setDraftMaxExp(String(profile.maxExp));
    setDraftBagName(profile.bagName);
    setDraftCombatPowerNote(profile.combatPowerNote || '');
    setEditingRealm(true);
  };

  const handleSaveRealmEdit = () => {
    const nextMeta = CULTIVATION_SYSTEM_META[draftSystemKind];
    const safeIdx = Math.max(
      0,
      Math.min(nextMeta.realms.length - 1, draftRealmIndex),
    );
    const canonicalStage = nextMeta.realms[safeIdx] || nextMeta.realms[0];
    const parsedMax = Math.max(
      10,
      parseInt(draftMaxExp, 10) || canonicalStage.maxExp || 120,
    );
    const rawTypedExp = Math.max(0, parseInt(draftExp, 10) || 0);
    const clampedExp = Math.min(parsedMax, rawTypedExp);
    const maxOverflow = getMaxOverflowExp(parsedMax);
    const overflowExp =
      rawTypedExp > parsedMax
        ? Math.min(maxOverflow, rawTypedExp - parsedMax)
        : 0;
    const cleanRealmName =
      draftRealmName.trim() || canonicalStage.name || profile.realmName;
    const cleanBagName = draftBagName.trim() || nextMeta.bagName;
    const cleanCombatPower = draftCombatPowerNote.trim();
    const isCustomName =
      cleanRealmName.toLowerCase() !== canonicalStage.name.toLowerCase();
    const resolvedSubStage = isCustomName
      ? parseSubStageFromText(cleanRealmName) || canonicalStage.subStage
      : canonicalStage.subStage;

    onUpdateProfile((prev) => ({
      ...prev,
      schemaVersion: CULTIVATION_SCHEMA_VERSION,
      systemKind: draftSystemKind,
      realmIndex: safeIdx,
      realmName: cleanRealmName,
      majorRealm: canonicalStage.majorRealm,
      subStage: resolvedSubStage,
      ...(typeof canonicalStage.minorTier === 'number'
        ? { minorTier: canonicalStage.minorTier }
        : { minorTier: undefined }),
      ...(draftSystemKind === 'wuxia'
        ? {
            wuxiaState: {
              ...normalizeWuxiaState(prev.wuxiaState, safeIdx),
              innerLayer: canonicalStage.minorTier || 1,
            },
          }
        : {}),
      energyLabel: nextMeta.energyLabel,
      exp: clampedExp,
      maxExp: parsedMax,
      overflowExp,
      readyToBreakthrough: clampedExp >= parsedMax,
      bagName: cleanBagName,
      ...(cleanCombatPower
        ? { combatPowerNote: cleanCombatPower }
        : { combatPowerNote: undefined }),
      lastUpdatedAt: Date.now(),
    }));
    setEditingRealm(false);
    onNotify?.('Đã cập nhật cảnh giới và chỉ số tu luyện.');
  };

  const handleSelectWuxiaInnerArt = (art: WuxiaJianghuInnerArt) => {
    if (profile.systemKind !== 'wuxia') return;
    onUpdateProfile((prev) => {
      const ws = normalizeWuxiaState(prev.wuxiaState, prev.realmIndex);
      const nextLayer = Math.min(art.maxLayer, Math.max(1, ws.innerLayer));
      const clampedTier = getWuxiaTitleByLayer(nextLayer);
      const wuxiaRealms = CULTIVATION_SYSTEM_META.wuxia.realms;
      const syncedStage = wuxiaRealms[clampedTier.index] || wuxiaRealms[0];
      const originMeta = WUXIA_ORIGIN_META[art.origin];
      const gradeMeta = WUXIA_SECT_GRADE_META[art.grade];
      const alreadyHasTech = prev.techniques.some(
        (t) => t.name.trim().toLowerCase() === art.name.toLowerCase(),
      );
      const nextTechniques = alreadyHasTech
        ? prev.techniques.map((t) =>
            t.category === 'mental'
              ? {
                  ...t,
                  maxLevel: art.maxLayer,
                  level: Math.min(art.maxLayer, Math.max(1, t.level)),
                  isActiveTraining:
                    t.name.trim().toLowerCase() === art.name.toLowerCase(),
                }
              : t,
          )
        : [
            {
              id: `tech_wuxia_${Date.now()}`,
              name: art.name,
              category: 'mental' as const,
              tier: art.tier,
              level: nextLayer,
              maxLevel: art.maxLayer,
              mastery: 15,
              isActiveTraining: true,
              description: `${originMeta.shortLabel} · ${gradeMeta.shortLabel} · ${WUXIA_ELEMENT_PATH_META[art.elementPath].label} (trần ${art.maxLayer} tầng) — ${art.description}`,
              moves: generateSuggestedMovesForTechnique({
                name: art.name,
                category: 'mental',
                systemKind: 'wuxia',
                baseSeed: Date.now(),
              }),
            },
            ...prev.techniques.map((t) =>
              t.category === 'mental' ? { ...t, isActiveTraining: false } : t,
            ),
          ];
      return {
        ...prev,
        realmIndex: clampedTier.index,
        realmName: syncedStage.name,
        majorRealm: syncedStage.majorRealm,
        subStage: syncedStage.subStage,
        minorTier: nextLayer,
        maxExp: syncedStage.maxExp,
        exp: Math.min(syncedStage.maxExp, prev.exp),
        readyToBreakthrough: prev.exp >= syncedStage.maxExp,
        wuxiaState: {
          ...ws,
          activeInnerArtName: art.name,
          innerArtOrigin: art.origin,
          innerArtGrade: art.grade,
          ...(art.sectName ? { sectName: art.sectName } : { sectName: undefined }),
          elementPath: art.elementPath,
          innerLayer: nextLayer,
          innerMaxLayer: art.maxLayer,
        },
        techniques: nextTechniques,
        lastUpdatedAt: Date.now(),
      };
    });
    setWuxiaInnerArtCatalogOpen(false);
    const maxTitle = getWuxiaTitleByLayer(art.maxLayer);
    onNotify?.(
      `Đã chuyển sang ${art.name} (${WUXIA_ORIGIN_META[art.origin].shortLabel} · trần Tầng ${art.maxLayer} — ${maxTitle.title}).`,
    );
  };

  const handleBreakthrough = () => {
    const res = attemptBreakthroughWithOdds(profile, {
      assistItemId: selectedBreakthroughAssistId || null,
      sceneText: currentTurnText,
    });
    if (!res.attempted) {
      onNotify?.(res.headline, 'err');
      return;
    }
    onUpdateProfile(() => res.nextProfile);
    setBreakthroughConfirmOpen(false);
    setSelectedBreakthroughAssistId('');
    onNotify?.(res.headline, res.succeeded ? 'info' : 'err');
  };

  const handleQuickAddExp = (amount: number) => {
    const preview = applyCultivationExpGain(profile, amount, {
      sourceLabel: 'cập nhật thủ công',
    });
    onUpdateProfile((prev) =>
      applyCultivationExpGain(prev, amount, {
        sourceLabel: 'cập nhật thủ công',
      }).nextProfile,
    );
    if (
      preview.hitCap &&
      preview.appliedExp === 0 &&
      preview.appliedOverflow === 0
    ) {
      onNotify?.(
        'Tu vi đã chạm chốt chặn bình cảnh — hãy chủ động xác nhận đột phá từng bước trước.',
      );
    }
  };

  const handleRunQuickCultivate = (
    hours: number,
    customLabel?: string,
    confirmKey?: string,
  ) => {
    if (!Number.isFinite(hours) || hours <= 0) {
      onNotify?.('Vui lòng nhập số giờ tu luyện hợp lệ (lớn hơn 0).', 'err');
      return;
    }
    const clampedHours = Math.min(240, Math.max(0.5, hours));
    const deltaMinutes = Math.round(clampedHours * 60);
    const label = customLabel || formatDeltaMinutesVi(deltaMinutes).replace(/^\+/, '');
    if (onQuickCultivate) {
      const res = onQuickCultivate(deltaMinutes, label, {
        isSeclusionJump: false,
      });
      if (res) {
        setLastQuickResult(res);
      }
      if (confirmKey) {
        triggerConfirm(confirmKey);
      }
    }
  };

  const handleRunSeclusionJump = (params: {
    months?: number;
    years?: number;
    label: string;
    confirmKey?: string;
  }) => {
    if (!onQuickCultivate) return;
    if (canBreakthrough) {
      onNotify?.(
        'Tu vi đã chạm bình cảnh và bị khóa chống nhảy cấp. Hãy xác nhận đột phá hoặc xử lý bình cảnh/thiên kiếp trước khi bế quan tiếp!',
      );
      setBreakthroughConfirmOpen(true);
      return;
    }
    const baseClock = normalizeStoryClock(storyClock);
    const targetClock = params.years
      ? addYearsToClock(baseClock, params.years)
      : addMonthsToClock(baseClock, params.months || 1);
    const deltaMinutes = Math.max(
      1440,
      clockToEpochMinutes(targetClock) - clockToEpochMinutes(baseClock),
    );
    const res = onQuickCultivate(deltaMinutes, params.label, {
      months: params.months,
      years: params.years,
      isSeclusionJump: true,
    });
    if (res) {
      setLastQuickResult(res);
    }
    if (params.confirmKey) {
      triggerConfirm(params.confirmKey);
    }
  };

  const handleRunCustomSeclusion = () => {
    const raw = parseInt(customSeclusionAmount, 10);
    if (!Number.isFinite(raw) || raw < 1) {
      onNotify?.('Vui lòng nhập mốc thời gian bế quan hợp lệ (>= 1).', 'err');
      return;
    }
    if (profile.systemKind === 'wuxia') {
      const months = Math.min(120, Math.max(1, raw));
      handleRunSeclusionJump({
        months,
        label: `+${months} tháng`,
        confirmKey: 'secl:custom',
      });
    } else {
      const years = Math.min(100, Math.max(1, raw));
      handleRunSeclusionJump({
        years,
        label: `+${years} năm`,
        confirmKey: 'secl:custom',
      });
    }
  };

  const openNewTechniqueForm = () => {
    setEditingTechId(null);
    setTechName('');
    setTechCategory('martial');
    setTechTier('linh');
    setTechLevel('1');
    setTechMaxLevel('9');
    setTechMastery('10');
    setTechActiveTraining(false);
    setTechAutoGenerateMoves(true);
    setTechDesc('');
    setTechUnlockCond('');
    setTechFormOpen(true);
  };

  const openEditTechniqueForm = (tech: CultivationTechnique) => {
    setEditingTechId(tech.id);
    setTechName(tech.name);
    setTechCategory(tech.category);
    setTechTier(tech.tier);
    setTechLevel(String(tech.level));
    setTechMaxLevel(String(tech.maxLevel));
    setTechMastery(String(tech.mastery));
    setTechActiveTraining(tech.isActiveTraining);
    setTechAutoGenerateMoves(false);
    setTechDesc(tech.description || '');
    setTechUnlockCond(tech.customUnlockCondition || '');
    setTechFormOpen(true);
  };

  const handleSaveTechnique = () => {
    const cleanName = techName.trim();
    if (!cleanName) {
      onNotify?.('Vui lòng nhập tên công pháp / võ công.', 'err');
      return;
    }
    const maxLv = Math.max(1, Math.min(99, parseInt(techMaxLevel, 10) || 9));
    const lv = Math.max(1, Math.min(maxLv, parseInt(techLevel, 10) || 1));
    const mastery = Math.max(0, Math.min(100, parseInt(techMastery, 10) || 0));

    const existingTech = editingTechId
      ? profile.techniques.find((t) => t.id === editingTechId)
      : undefined;
    const generatedMoves =
      !editingTechId && techAutoGenerateMoves
        ? generateSuggestedMovesForTechnique({
            name: cleanName,
            category: techCategory,
            systemKind: profile.systemKind,
          })
        : undefined;
    const movesToKeep = editingTechId ? existingTech?.moves : generatedMoves;
    const newId =
      editingTechId ||
      `tech_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    const preservedMilestones =
      existingTech && existingTech.level === lv
        ? existingTech.unlockedMilestones
        : undefined;

    const entry: CultivationTechnique = {
      id: newId,
      name: cleanName,
      category: techCategory,
      tier: techTier,
      level: lv,
      maxLevel: maxLv,
      mastery,
      isActiveTraining: techActiveTraining,
      ...(techDesc.trim() ? { description: techDesc.trim() } : {}),
      ...(movesToKeep && movesToKeep.length > 0 ? { moves: movesToKeep } : {}),
      ...(preservedMilestones ? { unlockedMilestones: preservedMilestones } : {}),
      ...(existingTech?.lockConditionKind
        ? { lockConditionKind: existingTech.lockConditionKind }
        : {}),
      ...(existingTech?.customLockReason
        ? { customLockReason: existingTech.customLockReason }
        : {}),
      ...(techUnlockCond.trim()
        ? { customUnlockCondition: techUnlockCond.trim() }
        : {}),
      ...(typeof existingTech?.requiredRealmIndex === 'number'
        ? { requiredRealmIndex: existingTech.requiredRealmIndex }
        : {}),
    };

    onUpdateProfile((prev) => ({
      ...prev,
      techniques: editingTechId
        ? prev.techniques.map((t) => (t.id === editingTechId ? entry : t))
        : [...prev.techniques, entry],
      lastUpdatedAt: Date.now(),
    }));
    if (!editingTechId && generatedMoves && generatedMoves.length > 0) {
      setExpandedMovesTechIds((prev) => ({ ...prev, [newId]: true }));
    }
    setTechFormOpen(false);
    setEditingTechId(null);
    onNotify?.(
      editingTechId
        ? `Đã cập nhật "${cleanName}".`
        : generatedMoves?.length
          ? `Đã thêm "${cleanName}" kèm ${generatedMoves.length} chiêu thức gợi ý.`
          : `Đã thêm công pháp "${cleanName}".`,
    );
  };

  const handleTrainTechniqueInStory = (tech: CultivationTechnique) => {
    const status = getTechniqueLockStatus(tech, profile, {
      sceneText: currentTurnText,
    });
    if (status.isMaxed) {
      onNotify?.(`"${tech.name}" đã đạt Đại Viên Mãn.`);
      return;
    }
    if (!onInsertStoryPrompt) {
      onNotify?.('Chưa kết nối khung nhập truyện để điền hành động tu luyện.', 'err');
      return;
    }
    const promptText = buildTechniqueTrainStoryPrompt(tech, status);
    onInsertStoryPrompt(promptText);
    onNotify?.(
      `Đã điền hành động tu luyện "${tech.name}" vào ô chat — bạn có thể chỉnh thêm rồi bấm Gửi.`,
    );
    onClose?.();
  };

  const handleUseSpiritStoneOnTechnique = (techId: string) => {
    const currentTech = profile.techniques.find((t) => t.id === techId);
    if (!currentTech) return;

    const preview = trainTechniqueWithSpiritStone(currentTech, profile);
    if (!preview.ok) {
      onNotify?.(
        preview.error || `Không thể dùng Linh thạch cho "${currentTech.name}".`,
        'err',
      );
      return;
    }

    onUpdateProfile((prev) => {
      const target = prev.techniques.find((t) => t.id === techId);
      if (!target) return prev;
      const res = trainTechniqueWithSpiritStone(target, prev);
      if (!res.ok) return prev;
      return {
        ...prev,
        techniques: prev.techniques.map((t) =>
          t.id === techId ? res.nextTech : t,
        ),
        inventory: res.nextInventory,
        lastGainSummary: res.summary,
        lastUpdatedAt: Date.now(),
      };
    });

    triggerConfirm(`stone_tech:${techId}`);
    onNotify?.(preview.summary);
  };

  const handleUnlockTechniqueBottleneck = (
    techId: string,
    consumeItemId?: string,
  ) => {
    const currentTech = profile.techniques.find((t) => t.id === techId);
    if (!currentTech) return;

    const check = unlockTechniqueBottleneck(currentTech, profile, {
      consumeItemId,
    });
    if (!check.ok) {
      onNotify?.(
        check.error || `Không thể mở khóa bình cảnh cho "${currentTech.name}".`,
        'err',
      );
      return;
    }

    onUpdateProfile((prev) => {
      const target = prev.techniques.find((t) => t.id === techId);
      if (!target) return prev;
      const res = unlockTechniqueBottleneck(target, prev, { consumeItemId });
      if (!res.ok) return prev;
      return {
        ...prev,
        techniques: prev.techniques.map((t) =>
          t.id === techId ? res.nextTech : t,
        ),
        inventory: res.nextInventory,
        lastGainSummary: res.summary,
        lastUpdatedAt: Date.now(),
      };
    });

    onNotify?.(check.summary);
  };

  const handleToggleTechniqueTraining = (techId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) =>
        t.id === techId ? { ...t, isActiveTraining: !t.isActiveTraining } : t,
      ),
      lastUpdatedAt: Date.now(),
    }));
  };

  const handleDeleteTechnique = (techId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.filter((t) => t.id !== techId),
      lastUpdatedAt: Date.now(),
    }));
  };

  const toggleMovesExpand = (techId: string) => {
    setExpandedMovesTechIds((prev) => ({ ...prev, [techId]: !prev[techId] }));
  };

  const openNewMoveForm = (techId: string) => {
    setExpandedMovesTechIds((prev) => ({ ...prev, [techId]: true }));
    setMoveFormTechId(techId);
    setEditingMoveId(null);
    setMoveName('');
    setMoveDesc('');
    setMoveLevel('1');
    setMoveMaxLevel('5');
    setMoveMastery('20');
    setMoveUnlockCond('');
  };

  const openEditMoveForm = (techId: string, move: TechniqueMove) => {
    setExpandedMovesTechIds((prev) => ({ ...prev, [techId]: true }));
    setMoveFormTechId(techId);
    setEditingMoveId(move.id);
    setMoveName(move.name);
    setMoveDesc(move.description || '');
    setMoveLevel(String(move.level));
    setMoveMaxLevel(String(move.maxLevel));
    setMoveMastery(String(move.mastery));
    setMoveUnlockCond(move.customUnlockCondition || '');
  };

  const handleSaveMove = (techId: string) => {
    const cleanName = moveName.trim();
    if (!cleanName) {
      onNotify?.('Vui lòng nhập tên chiêu thức.', 'err');
      return;
    }
    const maxLv = Math.max(1, Math.min(20, parseInt(moveMaxLevel, 10) || 5));
    const lv = Math.max(1, Math.min(maxLv, parseInt(moveLevel, 10) || 1));
    const mastery = Math.max(0, Math.min(100, parseInt(moveMastery, 10) || 0));

    const parentTech = profile.techniques.find((t) => t.id === techId);
    const existingMove = editingMoveId
      ? parentTech?.moves?.find((m) => m.id === editingMoveId)
      : undefined;
    const preservedMilestones =
      existingMove && existingMove.level === lv
        ? existingMove.unlockedMilestones
        : undefined;

    const entry: TechniqueMove = {
      id:
        editingMoveId ||
        `mv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      level: lv,
      maxLevel: maxLv,
      mastery,
      ...(moveDesc.trim() ? { description: moveDesc.trim() } : {}),
      ...(preservedMilestones ? { unlockedMilestones: preservedMilestones } : {}),
      ...(existingMove?.lockConditionKind
        ? { lockConditionKind: existingMove.lockConditionKind }
        : {}),
      ...(existingMove?.customLockReason
        ? { customLockReason: existingMove.customLockReason }
        : {}),
      ...(moveUnlockCond.trim()
        ? { customUnlockCondition: moveUnlockCond.trim() }
        : {}),
      ...(typeof existingMove?.requiredRealmIndex === 'number'
        ? { requiredRealmIndex: existingMove.requiredRealmIndex }
        : {}),
    };

    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) => {
        if (t.id !== techId) return t;
        const curMoves = t.moves || [];
        return {
          ...t,
          moves: editingMoveId
            ? curMoves.map((m) => (m.id === editingMoveId ? entry : m))
            : [...curMoves, entry],
        };
      }),
      lastUpdatedAt: Date.now(),
    }));

    setMoveFormTechId(null);
    setEditingMoveId(null);
    onNotify?.(
      editingMoveId
        ? `Đã cập nhật chiêu thức "${cleanName}".`
        : `Đã thêm chiêu thức "${cleanName}".`,
    );
  };

  const handleGenerateMovesForTech = (tech: CultivationTechnique) => {
    const generated = generateSuggestedMovesForTechnique({
      name: tech.name,
      category: tech.category,
      systemKind: profile.systemKind,
    });
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) => {
        if (t.id !== tech.id) return t;
        const existing = t.moves || [];
        const existingLower = new Set(existing.map((m) => m.name.toLowerCase()));
        const uniqueNew = generated.filter(
          (m) => !existingLower.has(m.name.toLowerCase()),
        );
        return {
          ...t,
          moves: existing.length > 0 ? [...existing, ...uniqueNew] : generated,
        };
      }),
      lastUpdatedAt: Date.now(),
    }));
    setExpandedMovesTechIds((prev) => ({ ...prev, [tech.id]: true }));
    onNotify?.(`Đã tạo gợi ý ${generated.length} chiêu thức cho "${tech.name}".`);
  };

  const handleTrainMoveInStory = (
    tech: CultivationTechnique,
    move: TechniqueMove,
  ) => {
    const status = getMoveLockStatus(move, tech, profile, {
      sceneText: currentTurnText,
    });
    if (status.isMaxed) {
      onNotify?.(`Chiêu "${move.name}" đã đạt Đăng Phong Tạo Cực.`);
      return;
    }
    if (!onInsertStoryPrompt) {
      onNotify?.('Chưa kết nối khung nhập truyện để điền hành động luyện chiêu.', 'err');
      return;
    }
    const promptText = buildMoveTrainStoryPrompt(move, tech, status);
    onInsertStoryPrompt(promptText);
    onNotify?.(
      `Đã điền hành động luyện chiêu "${move.name}" vào ô chat — bạn có thể chỉnh thêm rồi bấm Gửi.`,
    );
    onClose?.();
  };

  const handleUseSpiritStoneOnMove = (techId: string, moveId: string) => {
    const parentTech = profile.techniques.find((t) => t.id === techId);
    const currentMove = parentTech?.moves?.find((m) => m.id === moveId);
    if (!parentTech || !currentMove) return;

    const preview = trainMoveWithSpiritStone(currentMove, parentTech, profile);
    if (!preview.ok) {
      onNotify?.(
        preview.error || `Không thể dùng Linh thạch cho chiêu "${currentMove.name}".`,
        'err',
      );
      return;
    }

    onUpdateProfile((prev) => {
      const targetTech = prev.techniques.find((t) => t.id === techId);
      const targetMove = targetTech?.moves?.find((m) => m.id === moveId);
      if (!targetTech || !targetMove) return prev;
      const res = trainMoveWithSpiritStone(targetMove, targetTech, prev);
      if (!res.ok) return prev;
      return {
        ...prev,
        techniques: prev.techniques.map((t) =>
          t.id === techId && t.moves
            ? {
                ...t,
                moves: t.moves.map((m) =>
                  m.id === moveId ? res.nextMove : m,
                ),
              }
            : t,
        ),
        inventory: res.nextInventory,
        lastGainSummary: res.summary,
        lastUpdatedAt: Date.now(),
      };
    });

    triggerConfirm(`stone_move:${techId}:${moveId}`);
    onNotify?.(preview.summary);
  };

  const handleUnlockMoveBottleneck = (
    techId: string,
    moveId: string,
    consumeItemId?: string,
  ) => {
    const parentTech = profile.techniques.find((t) => t.id === techId);
    const currentMove = parentTech?.moves?.find((m) => m.id === moveId);
    if (!parentTech || !currentMove) return;

    const check = unlockMoveBottleneck(currentMove, parentTech, profile, {
      consumeItemId,
    });
    if (!check.ok) {
      onNotify?.(
        check.error || `Không thể mở khóa cho chiêu "${currentMove.name}".`,
        'err',
      );
      return;
    }

    onUpdateProfile((prev) => {
      const targetTech = prev.techniques.find((t) => t.id === techId);
      const targetMove = targetTech?.moves?.find((m) => m.id === moveId);
      if (!targetTech || !targetMove) return prev;
      const res = unlockMoveBottleneck(targetMove, targetTech, prev, {
        consumeItemId,
      });
      if (!res.ok) return prev;
      return {
        ...prev,
        techniques: prev.techniques.map((t) =>
          t.id === techId && t.moves
            ? {
                ...t,
                moves: t.moves.map((m) =>
                  m.id === moveId ? res.nextMove : m,
                ),
              }
            : t,
        ),
        inventory: res.nextInventory,
        lastGainSummary: res.summary,
        lastUpdatedAt: Date.now(),
      };
    });

    onNotify?.(check.summary);
  };

  const handleDeleteMove = (techId: string, moveId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      techniques: prev.techniques.map((t) => {
        if (t.id !== techId || !t.moves) return t;
        return {
          ...t,
          moves: t.moves.filter((m) => m.id !== moveId),
        };
      }),
      lastUpdatedAt: Date.now(),
    }));
  };

  const openNewItemForm = () => {
    setEditingItemId(null);
    setItemName('');
    setItemQty('1');
    setItemQuality('uncommon');
    setItemCategory('consumable');
    setItemDesc('');
    setItemEquipSlot('');
    setItemFormOpen(true);
  };

  const openEditItemForm = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemQty(String(item.quantity));
    setItemQuality(item.quality);
    setItemCategory(item.category);
    setItemDesc(item.description || '');
    setItemEquipSlot(item.equipSlot || '');
    setItemFormOpen(true);
  };

  const handleSaveItem = () => {
    const cleanName = itemName.trim();
    if (!cleanName) {
      onNotify?.('Vui lòng nhập tên vật phẩm.', 'err');
      return;
    }
    if (isJunkInventoryItemName(cleanName)) {
      onNotify?.(
        `Tên "${cleanName}" là từ ngữ cảnh chung chung, không thể lưu thành vật phẩm.`,
        'err',
      );
      return;
    }
    const qty = Math.max(1, parseInt(itemQty, 10) || 1);
    const canPickSlot =
      itemCategory === 'weapon' ||
      itemCategory === 'outfit' ||
      itemCategory === 'talisman' ||
      itemCategory === 'misc';
    const resolvedEquipSlot =
      itemCategory === 'outfit' && !itemEquipSlot
        ? ('armor' as EquipmentSlotId)
        : itemEquipSlot;
    const entry: InventoryItem = {
      id: editingItemId || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      quantity: qty,
      quality: itemQuality,
      category: itemCategory,
      ...(itemDesc.trim() ? { description: itemDesc.trim() } : {}),
      ...(canPickSlot && resolvedEquipSlot ? { equipSlot: resolvedEquipSlot } : {}),
    };

    onUpdateProfile((prev) => {
      if (editingItemId) {
        return {
          ...prev,
          inventory: prev.inventory.map((i) =>
            i.id === editingItemId ? entry : i,
          ),
          lastUpdatedAt: Date.now(),
        };
      }
      // Merge quantity if same name exists
      const existingIdx = prev.inventory.findIndex(
        (i) => i.name.trim().toLowerCase() === cleanName.toLowerCase(),
      );
      if (existingIdx >= 0) {
        return {
          ...prev,
          inventory: prev.inventory.map((i, idx) =>
            idx === existingIdx
              ? {
                  ...i,
                  quantity: i.quantity + qty,
                  quality: entry.quality,
                  category: entry.category,
                  ...(entry.description ? { description: entry.description } : {}),
                  ...(entry.equipSlot ? { equipSlot: entry.equipSlot } : {}),
                }
              : i,
          ),
          lastUpdatedAt: Date.now(),
        };
      }
      return {
        ...prev,
        inventory: [...prev.inventory, entry],
        lastUpdatedAt: Date.now(),
      };
    });

    setItemFormOpen(false);
    setEditingItemId(null);
    onNotify?.(
      editingItemId
        ? `Đã cập nhật vật phẩm "${cleanName}".`
        : `Đã thêm "${cleanName}" vào ${profile.bagName}.`,
    );
  };

  const handleAddCatalogItem = (sample: XianxiaCatalogItem) => {
    onUpdateProfile((prev) => {
      const existingIdx = prev.inventory.findIndex(
        (i) => i.name.trim().toLowerCase() === sample.name.trim().toLowerCase(),
      );
      if (existingIdx >= 0) {
        return {
          ...prev,
          inventory: prev.inventory.map((i, idx) =>
            idx === existingIdx
              ? {
                  ...i,
                  quantity: i.quantity + sample.defaultQuantity,
                  quality: sample.quality,
                  category: sample.category,
                  description: sample.description,
                  ...(sample.equipSlot ? { equipSlot: sample.equipSlot } : {}),
                }
              : i,
          ),
          lastUpdatedAt: Date.now(),
        };
      }
      return {
        ...prev,
        inventory: [
          ...prev.inventory,
          {
            id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: sample.name,
            quantity: sample.defaultQuantity,
            quality: sample.quality,
            category: sample.category,
            description: sample.description,
            ...(sample.equipSlot ? { equipSlot: sample.equipSlot } : {}),
          },
        ],
        lastUpdatedAt: Date.now(),
      };
    });
    const qLabel = getInventoryQualityMeta(
      sample.quality,
      profile.systemKind,
    ).shortLabel;
    onNotify?.(
      `Đã thêm "${sample.name}" (${qLabel}) x${sample.defaultQuantity} vào ${profile.bagName}.`,
    );
  };

  const handleAddWuxiaCatalogItem = (sample: WuxiaCatalogItem) => {
    onUpdateProfile((prev) => {
      const existingIdx = prev.inventory.findIndex(
        (i) => i.name.trim().toLowerCase() === sample.name.trim().toLowerCase(),
      );
      if (existingIdx >= 0) {
        return {
          ...prev,
          inventory: prev.inventory.map((i, idx) =>
            idx === existingIdx
              ? {
                  ...i,
                  quantity: i.quantity + sample.defaultQuantity,
                  quality: sample.quality,
                  category: sample.category,
                  description: sample.description,
                  ...(sample.equipSlot ? { equipSlot: sample.equipSlot } : {}),
                }
              : i,
          ),
          lastUpdatedAt: Date.now(),
        };
      }
      return {
        ...prev,
        inventory: [
          ...prev.inventory,
          {
            id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: sample.name,
            quantity: sample.defaultQuantity,
            quality: sample.quality,
            category: sample.category,
            description: sample.description,
            ...(sample.equipSlot ? { equipSlot: sample.equipSlot } : {}),
          },
        ],
        lastUpdatedAt: Date.now(),
      };
    });
    const qLabel = getInventoryQualityMeta(sample.quality, 'wuxia').shortLabel;
    onNotify?.(
      `Đã thêm "${sample.name}" (${qLabel}) x${sample.defaultQuantity} vào ${profile.bagName}.`,
    );
  };

  const handleBuyWuxiaListing = (listingId: string, pushToStory = false) => {
    const res = buyWuxiaShopItem(profile, listingId);
    if (!res.ok) {
      onNotify?.(res.message, 'err');
      return;
    }
    onUpdateProfile(() => res.nextProfile);
    setLastItemAction({
      kind: 'shop',
      itemName: 'Giao dịch giang hồ',
      headline: res.message,
      effectLines: [],
      storyPrompt: res.storyPrompt || '',
    });
    onNotify?.(res.message);
    if (pushToStory && onInsertStoryPrompt && res.storyPrompt) {
      onInsertStoryPrompt(res.storyPrompt);
      onClose?.();
    }
  };

  const handleCraftWuxiaRecipe = (recipeId: string, pushToStory = false) => {
    const res = craftWuxiaRecipe(profile, recipeId);
    if (!res.ok) {
      onNotify?.(res.message, 'err');
      return;
    }
    onUpdateProfile(() => res.nextProfile);
    setLastItemAction({
      kind: 'craft',
      itemName: 'Chế tác võ lâm',
      headline: res.message,
      effectLines: [],
      storyPrompt: res.storyPrompt || '',
    });
    onNotify?.(res.message);
    if (pushToStory && onInsertStoryPrompt && res.storyPrompt) {
      onInsertStoryPrompt(res.storyPrompt);
      onClose?.();
    }
  };

  const handlePickLootSuggestion = (loot: LootSuggestion) => {
    if (isJunkInventoryItemName(loot.name)) return;
    onUpdateProfile((prev) => {
      const existingIdx = prev.inventory.findIndex(
        (i) => i.name.trim().toLowerCase() === loot.name.trim().toLowerCase(),
      );
      if (existingIdx >= 0) {
        return {
          ...prev,
          inventory: prev.inventory.map((i, idx) =>
            idx === existingIdx ? { ...i, quantity: i.quantity + loot.quantity } : i,
          ),
          lastUpdatedAt: Date.now(),
        };
      }
      return {
        ...prev,
        inventory: [
          ...prev.inventory,
          {
            id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: loot.name,
            quantity: loot.quantity,
            quality: loot.quality,
            category: loot.category,
            description: loot.description,
          },
        ],
        lastUpdatedAt: Date.now(),
      };
    });
    onNotify?.(`Đã nhặt "${loot.name}" vào ${profile.bagName}.`);
  };

  const handleSendItemActionToStory = (
    promptText: string,
    label: string,
  ) => {
    if (!onInsertStoryPrompt || !promptText.trim()) return;
    onInsertStoryPrompt(promptText);
    onNotify?.(
      `Đã đưa diễn biến "${label}" vào khung chat — bạn có thể chỉnh thêm rồi bấm Gửi.`,
    );
    onClose?.();
  };

  const openConstitutionEditor = () => {
    setDraftRootName(constitution.spiritRoot.name);
    setDraftRootElements(constitution.spiritRoot.elements || '');
    setDraftRootPurity(String(constitution.spiritRoot.purity));
    setDraftRootAffinity(constitution.spiritRoot.affinityNote);
    setDraftPhyName(constitution.physique.name);
    setDraftPhyRefinement(String(constitution.physique.refinement));
    setDraftPhyState(constitution.physique.stateLabel);
    setDraftPhyTraits(constitution.physique.traits);
    setDraftFndLabel(constitution.foundation.label);
    setDraftFndSolidity(String(constitution.foundation.solidity));
    setDraftFndImpurity(String(constitution.foundation.impurity));
    setDraftFndResilience(constitution.foundation.resilienceNote);
    setEditingConstitution(true);
  };

  const handleSaveConstitutionEdit = () => {
    const purity = Math.max(0, Math.min(100, Math.round(Number(draftRootPurity) || 0)));
    const refinement = Math.max(0, Math.min(100, Math.round(Number(draftPhyRefinement) || 0)));
    const solidity = Math.max(0, Math.min(100, Math.round(Number(draftFndSolidity) || 0)));
    const impurity = Math.max(0, Math.min(100, Math.round(Number(draftFndImpurity) || 0)));

    onUpdateProfile((prev) => ({
      ...prev,
      constitution: {
        spiritRoot: {
          name: draftRootName.trim() || constitution.spiritRoot.name,
          ...(draftRootElements.trim() ? { elements: draftRootElements.trim() } : {}),
          grade: resolveSpiritRootGrade(purity),
          purity,
          affinityNote:
            draftRootAffinity.trim() || constitution.spiritRoot.affinityNote,
        },
        physique: {
          name: draftPhyName.trim() || constitution.physique.name,
          grade: resolvePhysiqueGrade(refinement),
          refinement,
          stateLabel: draftPhyState.trim() || constitution.physique.stateLabel,
          traits: draftPhyTraits.trim() || constitution.physique.traits,
        },
        foundation: {
          label: draftFndLabel.trim() || constitution.foundation.label,
          grade: resolveFoundationGrade(solidity, impurity),
          solidity,
          impurity,
          resilienceNote:
            draftFndResilience.trim() || constitution.foundation.resilienceNote,
        },
        lastEvolutionNote: prev.constitution?.lastEvolutionNote,
        updatedAt: Date.now(),
      },
      lastUpdatedAt: Date.now(),
    }));
    setEditingConstitution(false);
    onNotify?.(`Đã cập nhật ${constitutionLabels.sectionTitle}.`);
  };

  const handleUseItem = (itemId: string, pushToStory = false) => {
    const res = consumeInventoryItem(profile, itemId);
    if (!res.itemName) return;
    if (res.blockedEquippable) {
      onNotify?.(res.headline, 'err');
      return;
    }
    onUpdateProfile(() => res.nextProfile);
    setLastItemAction({
      kind: 'consume',
      itemName: res.itemName,
      headline: res.headline,
      effectLines: res.effectLines,
      constitutionChanges: res.constitutionChanges,
      storyPrompt: res.storyPrompt,
      remainingLabel:
        res.remainingQty > 0 ? `Còn x${res.remainingQty}` : 'Đã dùng hết',
      toxicityWarning: res.toxicityWarning,
    });
    triggerConfirm(`use:${itemId}`);
    onNotify?.(res.headline);

    if (pushToStory && onInsertStoryPrompt && res.storyPrompt) {
      onInsertStoryPrompt(res.storyPrompt);
      onClose?.();
    }
  };

  const handleEquipItem = (itemId: string) => {
    const res = equipInventoryItem(profile, itemId);
    if (!res.ok) {
      onNotify?.(res.error || 'Không thể trang bị vật phẩm này.', 'err');
      return;
    }
    onUpdateProfile(() => res.nextProfile);
    setLastItemAction({
      kind: 'equip',
      itemName: res.itemName,
      headline: res.headline,
      effectLines: res.effectLines,
      storyPrompt: res.storyPrompt,
      remainingLabel: res.slot
        ? `Đang trang bị · ${getEquipmentSlotMeta(res.slot, profile.systemKind).shortLabel}`
        : 'Đang trang bị',
    });
    triggerConfirm(`equip:${itemId}`);
    onNotify?.(res.headline);
  };

  const handleUnequipSlot = (slot: EquipmentSlotId, itemId?: string) => {
    const res = unequipInventorySlot(profile, slot);
    if (!res.ok) {
      onNotify?.(res.error || 'Ô trang bị hiện đang trống.', 'err');
      return;
    }
    onUpdateProfile(() => res.nextProfile);
    setLastItemAction({
      kind: 'unequip',
      itemName: res.itemName,
      headline: res.headline,
      effectLines: res.effectLines,
      storyPrompt: res.storyPrompt,
      remainingLabel: `Đã trả về ${profile.bagName}`,
    });
    if (itemId) {
      triggerConfirm(`equip:${itemId}`);
    }
    onNotify?.(res.headline);
  };

  const stripEquipmentByItemId = (
    eq: EquipmentMap | undefined,
    removedId: string,
  ): EquipmentMap | undefined => {
    if (!eq) return undefined;
    const next: EquipmentMap = { ...eq };
    let changed = false;
    for (const slot of EQUIPMENT_SLOT_ORDER) {
      if (next[slot] === removedId) {
        delete next[slot];
        changed = true;
      }
    }
    if (!changed) return eq;
    return Object.keys(next).length > 0 ? next : undefined;
  };

  const handleAdjustItemQty = (itemId: string, delta: number) => {
    onUpdateProfile((prev) => {
      const nextInv = prev.inventory
        .map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0);
      const stillExists = nextInv.some((i) => i.id === itemId);
      return {
        ...prev,
        inventory: nextInv,
        equipment: stillExists
          ? prev.equipment
          : stripEquipmentByItemId(prev.equipment, itemId),
        lastUpdatedAt: Date.now(),
      };
    });
  };

  const handleDeleteItem = (itemId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      inventory: prev.inventory.filter((i) => i.id !== itemId),
      equipment: stripEquipmentByItemId(prev.equipment, itemId),
      lastUpdatedAt: Date.now(),
    }));
  };

  const renderEquipmentBoard = (compact = false) => {
    const activeSlots = getEquipmentSlotOrder(
      profile.systemKind,
      profile.equipment,
    );
    const boardMeta = getEquipmentBoardTitle(profile.systemKind);
    const gridColsClass =
      activeSlots.length > 4
        ? 'grid grid-cols-2 gap-2 sm:grid-cols-3'
        : 'grid grid-cols-2 gap-2';

    return (
      <div className="space-y-2 rounded-xl bg-[#0e1625]/78 p-3 ring-1 ring-inset ring-white/[0.08]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="truncate text-xs font-semibold text-slate-100 tabular-nums">
                {boardMeta.title} ({charStats.equippedCount}/{activeSlots.length})
              </span>
            </div>
            {!compact && (
              <div className="mt-0.5 text-[10px] text-slate-400">
                {boardMeta.subtitle}
              </div>
            )}
          </div>
          {!compact && (
            <button
              type="button"
              onClick={() => {
                setInventoryCategoryFilter('weapon');
                setActiveTab('inventory');
              }}
              className="shrink-0 text-[11px] font-semibold text-sky-300 hover:text-sky-200 whitespace-nowrap"
            >
              {boardMeta.bagButtonLabel}
            </button>
          )}
        </div>

        <div className={gridColsClass}>
          {activeSlots.map((slot) => {
            const slotMeta = getEquipmentSlotMeta(slot, profile.systemKind);
            const boundId = profile.equipment?.[slot];
            const equippedItem = boundId
              ? profile.inventory.find((i) => i.id === boundId)
              : undefined;

            if (!equippedItem) {
              return (
                <button
                  key={slot}
                  type="button"
                  title={slotMeta.emptyHint}
                  onClick={() => {
                    if (slot === 'armor' && profile.systemKind === 'wuxia') {
                      const hasOutfit = profile.inventory.some(
                        (i) => i.category === 'outfit',
                      );
                      setInventoryCategoryFilter(hasOutfit ? 'outfit' : 'all');
                    } else {
                      setInventoryCategoryFilter(
                        slot === 'relic' || slot === 'array_treasure'
                          ? 'all'
                          : 'weapon',
                      );
                    }
                    setActiveTab('inventory');
                  }}
                  className="flex min-h-[70px] flex-col items-start justify-between gap-1 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-2.5 text-left transition-colors hover:border-sky-400/35 hover:bg-white/[0.04]"
                >
                  <div className="w-full min-w-0">
                    <div className="truncate text-[10px] font-semibold text-slate-300">
                      {slotMeta.shortLabel}
                    </div>
                    <div className="truncate text-[9px] text-slate-500">
                      {slotMeta.groupHint}
                    </div>
                  </div>
                  <span className="text-[10px] leading-snug text-slate-500">
                    Trống · Chạm để chọn
                  </span>
                </button>
              );
            }

            const eqQ =
              INVENTORY_QUALITY_META[equippedItem.quality] ||
              INVENTORY_QUALITY_META.common;
            const bonus = getEquipmentItemBonuses(
              equippedItem,
              slot,
              profile.systemKind,
            );

            return (
              <div
                key={slot}
                className={`flex min-h-[70px] flex-col justify-between gap-1 rounded-xl p-2.5 ${eqQ.cardClass} ${eqQ.shimmerClass}`}
              >
                <div className="relative z-10 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="truncate text-[10px] font-semibold text-slate-300/90"
                      title={slotMeta.label}
                    >
                      {slotMeta.shortLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnequipSlot(slot)}
                      className="shrink-0 rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-inset ring-white/15 hover:bg-rose-500/25 hover:text-rose-100 whitespace-nowrap"
                    >
                      Tháo
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {eqQ.hasSparkle && (
                      <Sparkles
                        className={`h-3 w-3 shrink-0 item-twinkle-star ${eqQ.accentDotClass}`}
                      />
                    )}
                    <span
                      className={`truncate text-xs font-bold leading-snug ${eqQ.nameClass}`}
                      title={equippedItem.name}
                    >
                      {equippedItem.name}
                    </span>
                  </div>
                  {bonus.summary && (
                    <div className="mt-0.5 truncate text-[10px] text-emerald-200/90 tabular-nums">
                      {bonus.summary}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const rankingsList = useMemo(
    () => profile.rankings || [],
    [profile.rankings],
  );

  const rankingCountsByBoard = useMemo(() => {
    const counts: Record<'all' | CultivationRankingBoard, number> = {
      all: rankingsList.length,
      thien: 0,
      dia: 0,
      nhan: 0,
      thien_kieu: 0,
    };
    for (const r of rankingsList) {
      counts[r.board] = (counts[r.board] || 0) + 1;
    }
    return counts;
  }, [rankingsList]);

  const visibleRankings = useMemo(() => {
    const boardIdx = (b: CultivationRankingBoard) =>
      CULTIVATION_RANKING_BOARD_ORDER.indexOf(b);
    return rankingsList
      .filter((r) =>
        rankingBoardFilter === 'all' ? true : r.board === rankingBoardFilter,
      )
      .slice()
      .sort((a, b) => {
        const bd = boardIdx(a.board) - boardIdx(b.board);
        if (bd !== 0) return bd;
        return a.rank - b.rank;
      });
  }, [rankingsList, rankingBoardFilter]);

  const topSparPair = useMemo(() => {
    const nonMc = rankingsList.filter((r) => !r.isMc);
    if (rankingBoardFilter !== 'all') {
      const onBoard = nonMc
        .filter((r) => r.board === rankingBoardFilter)
        .slice()
        .sort((a, b) => a.rank - b.rank);
      if (onBoard.length >= 2) {
        return {
          npcA: onBoard[0],
          npcB: onBoard[1],
          boardLabel: CULTIVATION_RANKING_BOARD_META[rankingBoardFilter].label,
        };
      }
      return null;
    }

    for (const b of CULTIVATION_RANKING_BOARD_ORDER) {
      const onBoard = nonMc
        .filter((r) => r.board === b)
        .slice()
        .sort((a, b) => a.rank - b.rank);
      if (onBoard.length >= 2) {
        return {
          npcA: onBoard[0],
          npcB: onBoard[1],
          boardLabel: CULTIVATION_RANKING_BOARD_META[b].label,
        };
      }
    }

    const boardIdx = (b: CultivationRankingBoard) =>
      CULTIVATION_RANKING_BOARD_ORDER.indexOf(b);
    const sortedAll = nonMc.slice().sort((a, b) => {
      const bd = boardIdx(a.board) - boardIdx(b.board);
      return bd !== 0 ? bd : a.rank - b.rank;
    });
    if (sortedAll.length >= 2) {
      return {
        npcA: sortedAll[0],
        npcB: sortedAll[1],
        boardLabel:
          CULTIVATION_RANKING_BOARD_META[sortedAll[0].board]?.label ||
          'Bảng Thứ Hạng',
      };
    }
    return null;
  }, [rankingsList, rankingBoardFilter]);

  const openNewRankingForm = (presetBoard?: CultivationRankingBoard) => {
    const targetBoard =
      presetBoard ||
      (rankingBoardFilter !== 'all' ? rankingBoardFilter : 'nhan');
    const existingOnBoard = rankingsList.filter((r) => r.board === targetBoard);
    const nextRank =
      existingOnBoard.length > 0
        ? Math.max(...existingOnBoard.map((r) => r.rank)) + 1
        : 1;
    setEditingRankingId(null);
    setRankBoard(targetBoard);
    setRankPosition(String(nextRank));
    setRankName('');
    setRankRealm('');
    setRankCombatPower('');
    setRankFaction('');
    setRankStance('');
    setRankScopeLabel(
      targetBoard === 'thien'
        ? 'Toàn giới'
        : targetBoard === 'dia'
          ? 'Đại vực / Đại tông môn'
          : targetBoard === 'nhan'
            ? 'Mạch truyện hiện tại'
            : 'Thế hệ trẻ',
    );
    setRankProdigyTier('nghich_thien');
    setRankIsVeteran(targetBoard === 'thien' || targetBoard === 'dia');
    setRankingFormOpen(true);
  };

  const openEditRankingForm = (entry: CultivationRankingEntry) => {
    setEditingRankingId(entry.id);
    setRankBoard(entry.board);
    setRankPosition(String(entry.rank));
    setRankName(entry.name);
    setRankRealm(entry.realm);
    setRankCombatPower(entry.combatPower);
    setRankFaction(entry.faction);
    setRankStance(entry.stance);
    setRankScopeLabel(entry.scopeLabel || '');
    setRankProdigyTier(entry.prodigyTier || 'tre_the_gia');
    setRankIsVeteran(Boolean(entry.isVeteran));
    setRankingFormOpen(true);
  };

  const handleSaveRanking = () => {
    const cleanName = rankName.trim();
    if (!cleanName) {
      onNotify?.('Vui lòng nhập tên nhân vật xếp hạng.', 'err');
      return;
    }
    const parsedRank = Math.max(
      1,
      Math.min(MAX_RANKING_ENTRIES_PER_BOARD, parseInt(rankPosition, 10) || 1),
    );
    const entry: CultivationRankingEntry = {
      id:
        editingRankingId ||
        `rank_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      board: rankBoard,
      rank: parsedRank,
      name: cleanName,
      realm: rankRealm.trim() || 'Chưa rõ cảnh giới',
      combatPower: rankCombatPower.trim() || 'Thực lực tương xứng cảnh giới',
      faction: rankFaction.trim() || 'Tán tu / Chưa rõ',
      stance: rankStance.trim() || 'Trung lập',
      intelUnlocked: true,
      ...(rankBoard === 'thien_kieu'
        ? { prodigyTier: rankProdigyTier, isVeteran: false }
        : { isVeteran: rankIsVeteran }),
      ...(rankScopeLabel.trim() ? { scopeLabel: rankScopeLabel.trim() } : {}),
      updatedAt: Date.now(),
    };

    onUpdateProfile((prev) => {
      const cur = prev.rankings || [];
      const nextRaw = editingRankingId
        ? cur.map((r) => (r.id === editingRankingId ? { ...r, ...entry } : r))
        : [...cur, entry];
      return {
        ...prev,
        rankings: enforceTopTenPerBoard(nextRaw),
        lastUpdatedAt: Date.now(),
      };
    });

    setRankingFormOpen(false);
    setEditingRankingId(null);
    onNotify?.(
      editingRankingId
        ? `Đã cập nhật thứ hạng của "${cleanName}".`
        : `Đã ghi nhận "${cleanName}" vào ${CULTIVATION_RANKING_BOARD_META[rankBoard].label} (Top ${MAX_RANKING_ENTRIES_PER_BOARD}).`,
    );
  };

  const handleAdjustRankPosition = (entryId: string, delta: number) => {
    onUpdateProfile((prev) => {
      const cur = prev.rankings || [];
      const target = cur.find((r) => r.id === entryId);
      if (!target) return prev;
      const nextRank = Math.max(
        1,
        Math.min(MAX_RANKING_ENTRIES_PER_BOARD, target.rank + delta),
      );
      return {
        ...prev,
        rankings: cur.map((r) =>
          r.id === entryId
            ? {
                ...r,
                previousRank: r.rank,
                rank: nextRank,
                updatedAt: Date.now(),
              }
            : r,
        ),
        lastUpdatedAt: Date.now(),
      };
    });
  };

  const handleDeleteRanking = (entryId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      rankings: (prev.rankings || []).filter((r) => r.id !== entryId),
      lastUpdatedAt: Date.now(),
    }));
  };

  const handleTriggerGenerateRankings = async (
    target: CultivationRankingBoard | 'all',
  ) => {
    if (!onGenerateRankings || rankingAiBusy || rankingBusyRef.current) return;
    rankingBusyRef.current = true;
    setRankingAiBusy('generate');
    setRankingAiProgress(
      target === 'all'
        ? 'Đang gọi API viết truyện chính tạo 4 bảng (10 NPC/bảng)...'
        : `Đang gọi API viết truyện chính tạo ${CULTIVATION_RANKING_BOARD_META[target].label} (10 NPC)...`,
    );
    try {
      const res = await onGenerateRankings(target, (msg) =>
        setRankingAiProgress(msg),
      );
      if (!res.ok) {
        onNotify?.(res.error || 'Không tạo được bảng thứ hạng.', 'err');
      } else {
        onNotify?.(
          `Đã tạo xong ${res.count || 10} cao thủ/thiên kiêu bằng model chính (đang ở chế độ phong thanh — tới thành thị để mở hồ sơ đầy đủ).`,
        );
      }
    } finally {
      rankingBusyRef.current = false;
      setRankingAiBusy(null);
      setRankingAiProgress('');
    }
  };

  const handleTriggerRecalculateRankings = async (
    target: CultivationRankingBoard | 'all',
  ) => {
    if (!onRecalculateRankings || rankingAiBusy || rankingBusyRef.current) return;
    rankingBusyRef.current = true;
    setRankingAiBusy('recalc');
    setRankingAiProgress(
      'Đang gọi API viết truyện chính tính biến động tăng/giảm hạng...',
    );
    try {
      const res = await onRecalculateRankings(target, (msg) =>
        setRankingAiProgress(msg),
      );
      if (!res.ok) {
        onNotify?.(res.error || 'Không tính được biến động bảng thứ hạng.', 'err');
      } else {
        if (res.changeSummary) {
          setLastRankingChangeSummary(res.changeSummary);
        }
        onNotify?.(
          res.changeSummary || 'Đã cập nhật biến động tăng/giảm hạng Top 10.',
        );
      }
    } finally {
      rankingBusyRef.current = false;
      setRankingAiBusy(null);
      setRankingAiProgress('');
    }
  };

  const handleTriggerRankingSpar = async () => {
    if (!onSimulateRankingSpar || rankingAiBusy || rankingBusyRef.current) return;
    if (!topSparPair) {
      onNotify?.(
        'Cần ít nhất 2 NPC (không tính nhân vật chính) trên bảng để tự động so kè.',
        'err',
      );
      return;
    }
    rankingBusyRef.current = true;
    setRankingAiBusy('spar');
    setRankingAiProgress(
      `Đang giả lập trận so kè #${topSparPair.npcA.rank} ${topSparPair.npcA.name} vs #${topSparPair.npcB.rank} ${topSparPair.npcB.name}...`,
    );
    try {
      const res = await onSimulateRankingSpar(
        rankingBoardFilter,
        topSparPair.npcA,
        topSparPair.npcB,
        (msg) => setRankingAiProgress(msg),
      );
      if (!res.ok || !res.summary) {
        onNotify?.(res.error || 'Không giả lập được trận so kè.', 'err');
      } else {
        setSparResult({
          npcAName: res.npcAName || topSparPair.npcA.name,
          npcARank: res.npcARank ?? topSparPair.npcA.rank,
          npcBName: res.npcBName || topSparPair.npcB.name,
          npcBRank: res.npcBRank ?? topSparPair.npcB.rank,
          boardLabel: res.boardLabel || topSparPair.boardLabel,
          venue: res.venue,
          summary: res.summary,
          verdict: res.verdict,
        });
      }
    } finally {
      rankingBusyRef.current = false;
      setRankingAiBusy(null);
      setRankingAiProgress('');
    }
  };

  const handleTriggerUnlockIntel = async (entry: CultivationRankingEntry) => {
    if (!onUnlockRankingIntel || unlockingRankingId || unlockBusyRef.current) return;
    if (!intelLocationStatus?.canUnlockIntel) {
      onNotify?.(
        intelLocationStatus?.reason ||
          'Chưa ở thành thị hoặc nơi tụ tập tin tức — hiện chỉ nghe được phong thanh.',
        'err',
      );
      return;
    }
    unlockBusyRef.current = true;
    setUnlockingRankingId(entry.id);
    try {
      const res = await onUnlockRankingIntel(
        entry,
        intelLocationStatus.matchedPlace || 'Thành thị / Tửu lầu',
      );
      if (!res.ok) {
        onNotify?.(res.error || `Không mở được tin của ${entry.name}.`, 'err');
      } else {
        setExpandedRankingId(entry.id);
        onNotify?.(
          `Đã nghe ngóng & mở hồ sơ đầy đủ của ${entry.name} tại ${intelLocationStatus.matchedPlace || 'nơi có tin tức'}.`,
        );
      }
    } finally {
      unlockBusyRef.current = false;
      setUnlockingRankingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 shrink-0 text-amber-300" />
            <h3 className="truncate text-sm font-bold text-slate-50">
              Hồ sơ {meta.label}
              {mcName ? ` · ${mcName}` : ''}
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
            {displayInfo.fullLabel} · {profile.exp}/{profile.maxExp}
            {displayInfo.overflowExp > 0
              ? ` (+${displayInfo.overflowExp} dư)`
              : ''}{' '}
            {profile.energyLabel.split('/')[0].trim()} ·{' '}
            {profile.techniques.length} công pháp · {profile.inventory.length}{' '}
            vật phẩm
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {onQuickCultivate && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('realm');
                setSeclusionOpen((v) => (activeTab === 'realm' ? !v : true));
              }}
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                seclusionOpen && activeTab === 'realm'
                  ? 'bg-amber-500/24 text-amber-100 ring-amber-400/45'
                  : 'bg-amber-500/12 text-amber-200 ring-amber-400/30 hover:bg-amber-500/20'
              }`}
            >
              <Lock className="h-3.5 w-3.5 text-amber-300" />
              <span>Khóa tu nhanh</span>
            </button>
          )}
          {onQuickCultivate && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('realm');
                setQuickTrainOpen((v) => (activeTab === 'realm' ? !v : true));
              }}
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                quickTrainOpen && activeTab === 'realm'
                  ? 'bg-emerald-500/22 text-emerald-100 ring-emerald-400/40'
                  : 'bg-emerald-500/12 text-emerald-200 ring-emerald-400/28 hover:bg-emerald-500/20'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-emerald-300" />
              <span>Tu luyện nhanh</span>
            </button>
          )}
          {onOpenClock && (
            <button
              type="button"
              onClick={onOpenClock}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] whitespace-nowrap"
            >
              <Clock className="h-3.5 w-3.5 text-amber-300" />
              <span>Đồng hồ</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              aria-label="Đóng hồ sơ tu luyện"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Sub-Tabs */}
      <div
        role="tablist"
        aria-label="Mục hồ sơ tu luyện"
        className="grid grid-cols-4 gap-1 rounded-xl bg-[#0e1625]/85 p-1 ring-1 ring-inset ring-white/[0.07]"
      >
        {(
          [
            { id: 'realm', label: 'Cảnh giới', icon: Flame },
            {
              id: 'techniques',
              label: `Công pháp (${profile.techniques.length})`,
              icon: BookOpen,
            },
            {
              id: 'inventory',
              label: `Túi đồ (${profile.inventory.length})`,
              icon: Backpack,
            },
            {
              id: 'rankings',
              label: `Bảng XH (${rankingsList.length})`,
              icon: Trophy,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap tabular-nums ${
                active
                  ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: REALM & EXP */}
      {activeTab === 'realm' && (
        <div className="space-y-3">
          <div
            className={`relative rounded-xl p-3.5 ring-1 ring-inset space-y-3 transition-all ${realmTheme.cardClass} ${realmTheme.shimmerClass}`}
          >
            {realmTheme.hasSparkle && (
              <>
                <Sparkles
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-amber-200/80 item-twinkle-star"
                />
                <Sparkles
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-2.5 right-3 h-3 w-3 text-cyan-200/70 item-twinkle-star"
                />
              </>
            )}

            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-300/85">
                  <span>Đại cảnh giới · {meta.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${realmTheme.tierBadgeClass}`}
                  >
                    {realmTheme.tierLabel}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className={`text-base font-bold tracking-tight ${realmTheme.titleClass}`}
                  >
                    {displayInfo.majorRealm}
                  </span>
                  <span className={`text-xs font-semibold ${realmTheme.subStageClass}`}>
                    {profile.systemKind === 'wuxia' && wuxiaState
                      ? `Tầng ${wuxiaState.innerLayer}/${wuxiaState.innerMaxLayer}`
                      : typeof displayInfo.minorTier === 'number'
                        ? `Tầng ${displayInfo.minorTier} · ${displayInfo.subStage}`
                        : displayInfo.subStage}
                  </span>
                </div>
                {profile.systemKind === 'wuxia' && wuxiaTitleInfo && (
                  <p className="mt-1 text-[11px] leading-snug text-slate-300/90">
                    <span className="font-semibold text-amber-200/95">
                      {wuxiaTitleInfo.layerRangeLabel}:
                    </span>{' '}
                    {wuxiaTitleInfo.meaningVi}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProfile((prev) => ({
                      ...prev,
                      reduceRealmEffects: !prev.reduceRealmEffects,
                    }))
                  }
                  title="Chuyển chế độ hiệu ứng cảnh giới (Bật / Nhẹ cho mắt)"
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/[0.05] px-2 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.11] whitespace-nowrap"
                >
                  <Sparkles className="h-3 w-3 text-amber-300/90" />
                  <span>{profile.reduceRealmEffects ? 'Hiệu ứng: Nhẹ' : 'Hiệu ứng'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editingRealm ? setEditingRealm(false) : openRealmEditor()
                  }
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.1] hover:bg-white/[0.12] whitespace-nowrap"
                >
                  <Edit3 className="h-3.5 w-3.5 text-sky-300" />
                  <span>{editingRealm ? 'Đóng sửa' : 'Chỉnh sửa'}</span>
                </button>
              </div>
            </div>

            {/* Wuxia-only: Multi-Tier Sect vs Jianghu/Cổ phổ Catalog & 21-Title Cross-Reference */}
            {profile.systemKind === 'wuxia' &&
              wuxiaState &&
              wuxiaTitleInfo &&
              wuxiaCeiling &&
              wuxiaSynergy && (
                <div className="space-y-2 rounded-xl bg-black/25 p-2.5 ring-1 ring-inset ring-white/[0.08]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-semibold text-slate-100">
                        {wuxiaState.activeInnerArtName}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          WUXIA_ORIGIN_META[wuxiaCeiling.origin].badgeClass
                        }`}
                      >
                        {WUXIA_ORIGIN_META[wuxiaCeiling.origin].shortLabel}
                        {wuxiaCeiling.origin === 'mon_phai'
                          ? ` · ${WUXIA_SECT_GRADE_META[wuxiaCeiling.grade].shortLabel}`
                          : ''}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          WUXIA_ELEMENT_PATH_META[wuxiaState.elementPath].badgeClass
                        }`}
                      >
                        {WUXIA_ELEMENT_PATH_META[wuxiaState.elementPath].label}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                          wuxiaCeiling.isAtArtCeiling
                            ? 'bg-amber-500/20 text-amber-200 ring-1 ring-inset ring-amber-400/35'
                            : 'bg-white/[0.06] text-slate-300'
                        }`}
                      >
                        Trần T{wuxiaCeiling.maxLayer} · {wuxiaCeiling.maxAchievableTitle.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setWuxiaCatalogTab(
                            wuxiaCeiling.origin === 'mon_phai' &&
                              wuxiaCeiling.grade !== 'tran_phai'
                              ? 'mon_phai'
                              : 'giang_ho',
                          );
                          setWuxiaInnerArtCatalogOpen((v) => !v);
                        }}
                        className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-sky-500/15 px-2 text-[10.5px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/25 whitespace-nowrap"
                      >
                        <BookOpen className="h-3 w-3" />
                        <span>Kho nội công</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWuxiaTitleTableOpen((v) => !v)}
                        className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-amber-500/14 px-2 text-[10.5px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-500/24 whitespace-nowrap"
                      >
                        <span>Bảng quy chiếu 21 mốc</span>
                        {wuxiaTitleTableOpen ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Active Manual Ceiling Warning (when manual hits its cap) */}
                  {wuxiaCeiling.isAtArtCeiling && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-500/12 px-2.5 py-2 text-[10.5px] text-amber-100 ring-1 ring-inset ring-amber-400/35">
                      <div className="min-w-0 flex-1 leading-relaxed">
                        <span className="font-semibold text-amber-200">
                          Đã chạm trần bộ nội công (Tầng {wuxiaCeiling.maxLayer}):{' '}
                        </span>
                        {wuxiaCeiling.ceilingMessage}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setWuxiaCatalogTab(
                            wuxiaCeiling.origin === 'mon_phai' &&
                              wuxiaCeiling.grade !== 'tran_phai'
                              ? 'mon_phai'
                              : 'giang_ho',
                          );
                          setWuxiaInnerArtCatalogOpen(true);
                        }}
                        className="inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-lg bg-amber-500/25 px-2.5 text-[10.5px] font-semibold text-amber-50 ring-1 ring-inset ring-amber-300/45 hover:bg-amber-500/35 whitespace-nowrap"
                      >
                        <BookOpen className="h-3 w-3" />
                        <span>Đổi bộ cao hơn</span>
                      </button>
                    </div>
                  )}

                  {/* Element Path + Meridian Stepper + Phúc địa Ngũ hành */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Lộ tuyến nội công · {wuxiaSynergy.alignmentLabel}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(['duong_cuong', 'am_nhu', 'thai_cuc'] as WuxiaElementPath[]).map(
                          (pathId) => {
                            const pMeta = WUXIA_ELEMENT_PATH_META[pathId];
                            const active = wuxiaState.elementPath === pathId;
                            return (
                              <button
                                key={pathId}
                                type="button"
                                onClick={() =>
                                  onUpdateProfile((prev) => ({
                                    ...prev,
                                    wuxiaState: {
                                      ...normalizeWuxiaState(
                                        prev.wuxiaState,
                                        prev.realmIndex,
                                      ),
                                      elementPath: pathId,
                                    },
                                    lastUpdatedAt: Date.now(),
                                  }))
                                }
                                className={`min-h-[26px] rounded-lg px-2 text-[10.5px] font-semibold transition-colors ring-1 ring-inset ${
                                  active
                                    ? pMeta.badgeClass
                                    : 'bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:text-slate-200'
                                }`}
                              >
                                {pMeta.shortLabel}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        <span>Kinh mạch đã đả thông</span>
                        <span className="text-emerald-300 tabular-nums">
                          {wuxiaState.meridiansOpened}/8 mạch
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Giảm số kinh mạch"
                          onClick={() =>
                            onUpdateProfile((prev) => {
                              const ws = normalizeWuxiaState(
                                prev.wuxiaState,
                                prev.realmIndex,
                              );
                              return {
                                ...prev,
                                wuxiaState: {
                                  ...ws,
                                  meridiansOpened: Math.max(0, ws.meridiansOpened - 1),
                                },
                                lastUpdatedAt: Date.now(),
                              };
                            })
                          }
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <div className="grid flex-1 grid-cols-8 gap-1">
                          {Array.from({ length: 8 }).map((_, idx) => (
                            <div
                              key={idx}
                              className={`h-1.5 rounded-full ${
                                idx < wuxiaState.meridiansOpened
                                  ? 'bg-emerald-400'
                                  : 'bg-white/[0.1]'
                              }`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          aria-label="Đả thông thêm kinh mạch"
                          onClick={() =>
                            onUpdateProfile((prev) => {
                              const ws = normalizeWuxiaState(
                                prev.wuxiaState,
                                prev.realmIndex,
                              );
                              return {
                                ...prev,
                                wuxiaState: {
                                  ...ws,
                                  meridiansOpened: Math.min(8, ws.meridiansOpened + 1),
                                },
                                lastUpdatedAt: Date.now(),
                              };
                            })
                          }
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Phúc địa / Thánh địa ngũ hành selector */}
                  <div className="space-y-1 pt-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Phúc địa / Thánh địa bế quan (tăng tốc tích lũy theo tháng)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {WUXIA_SANCTUARY_ORDER.map((sancId) => {
                        const sMeta = WUXIA_SANCTUARY_META[sancId];
                        const active = (wuxiaState.activeSanctuary || 'none') === sancId;
                        const isFavored =
                          sancId !== 'none' &&
                          sMeta.favoredPaths.includes(wuxiaState.elementPath);
                        return (
                          <button
                            key={sancId}
                            type="button"
                            title={sMeta.hint}
                            onClick={() =>
                              onUpdateProfile((prev) => ({
                                ...prev,
                                wuxiaState: {
                                  ...normalizeWuxiaState(
                                    prev.wuxiaState,
                                    prev.realmIndex,
                                  ),
                                  activeSanctuary: sancId as WuxiaSanctuaryKind,
                                },
                                lastUpdatedAt: Date.now(),
                              }))
                            }
                            className={`min-h-[26px] rounded-lg px-2 text-[10px] font-medium transition-colors ring-1 ring-inset ${
                              active
                                ? isFavored
                                  ? 'bg-emerald-500/22 text-emerald-100 ring-emerald-400/45'
                                  : 'bg-white/15 text-white ring-white/30'
                                : 'bg-white/[0.04] text-slate-300 ring-white/[0.07] hover:bg-white/[0.09]'
                            }`}
                          >
                            {sMeta.shortLabel}
                            {isFavored ? ' ★' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wuxia-only: Hành Tẩu Giang Hồ & Tam giác Thực–Hư–Giá quick triggers */}
                  {onInsertStoryPrompt && (
                    <div className="space-y-1 pt-0.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Hành tẩu giang hồ · Tam giác Thực – Hư – Giá
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[
                          {
                            id: 'tri_combat',
                            label: 'Thực · Hư · Giá',
                            tone: 'bg-violet-500/14 text-violet-200 ring-violet-400/30 hover:bg-violet-500/24',
                            prompt: `Ta vận chuyển ${wuxiaState.activeInnerArtName} (Tầng ${wuxiaState.innerLayer} — ${wuxiaTitleInfo.title}), chủ động luận võ thực chiến theo tam giác khắc chế Thực Chiêu – Hư Chiêu – Giá Chiêu, quan sát nhịp thở và sơ hở thế thủ của đối thủ để ra đòn.`,
                          },
                          {
                            id: 'doat_thu',
                            label: 'Đoạt Thư (Cướp bí kíp)',
                            tone: 'bg-amber-500/14 text-amber-200 ring-amber-400/30 hover:bg-amber-500/24',
                            prompt: `Ta dò la tin tức Đoạt Thư, tìm cơ hội lẻn vào Tàng Kinh Các / mật thất hoặc mai phục đoàn hộ tống môn phái để đoạt tàn quyển bí kíp võ học (hoặc rình làm ngư ông đắc lợi).`,
                          },
                          {
                            id: 'thu_ve',
                            label: 'Thủ vệ / Chặn đoạt thư',
                            tone: 'bg-sky-500/14 text-sky-200 ring-sky-400/30 hover:bg-sky-500/24',
                            prompt: `Ta ở lại tuần tra thủ vệ sơn môn và canh giữ đường rút lui, sẵn sàng chặn đánh kẻ đột nhập đoạt thư để giữ gìn bí kíp và lập công danh vọng.`,
                          },
                          {
                            id: 'chinh_ta',
                            label: 'Giải cứu / Bắt giữ',
                            tone: 'bg-rose-500/14 text-rose-200 ring-rose-400/30 hover:bg-rose-500/24',
                            prompt: `Ta dò xét dấu vết hành tung khả nghi quanh vùng — nếu gặp kẻ buôn người hay tà phái bắt cóc thì chặn đường giải cứu tăng Chính khí và Danh vọng, còn gặp mật thám địch phái thì cân nhắc chế phục bắt giữ ép hỏi tin tức.`,
                          },
                        ].map((act) => (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => {
                              onInsertStoryPrompt(act.prompt);
                              onClose?.();
                            }}
                            className={`inline-flex min-h-[26px] items-center gap-1 rounded-lg px-2 text-[10px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${act.tone}`}
                          >
                            <Send className="h-2.5 w-2.5 shrink-0" />
                            <span>{act.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2-Tab Inner-Art Catalog: Bát Đại & Ẩn Thế vs Giang hồ & Cổ phổ */}
                  {wuxiaInnerArtCatalogOpen && (
                    <div className="space-y-2 border-t border-white/[0.08] pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-inset ring-white/[0.08]">
                          <button
                            type="button"
                            onClick={() => setWuxiaCatalogTab('mon_phai')}
                            className={`rounded-md px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                              wuxiaCatalogTab === 'mon_phai'
                                ? 'bg-sky-500/25 text-sky-100'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Bát Đại & Ẩn Thế ({WUXIA_SECT_INNER_ARTS.length} bộ)
                          </button>
                          <button
                            type="button"
                            onClick={() => setWuxiaCatalogTab('giang_ho')}
                            className={`rounded-md px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                              wuxiaCatalogTab === 'giang_ho'
                                ? 'bg-amber-500/25 text-amber-100'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Giang hồ & Cổ phổ ({WUXIA_JIANGHU_INNER_ARTS.length} bộ · 49–86T)
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {wuxiaCatalogTab === 'mon_phai'
                            ? 'Mỗi bộ môn phái có trần riêng — chạm trần phải đổi bộ cao hơn'
                            : 'Cày cuốc dài hơi, độ khó cao nhưng mở trần tới đỉnh võ học'}
                        </span>
                      </div>

                      <div className="grid max-h-60 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                        {(wuxiaCatalogTab === 'mon_phai'
                          ? WUXIA_SECT_INNER_ARTS
                          : WUXIA_JIANGHU_INNER_ARTS
                        ).map((art) => {
                          const isSelected =
                            wuxiaState.activeInnerArtName.toLowerCase() ===
                            art.name.toLowerCase();
                          const pMeta = WUXIA_ELEMENT_PATH_META[art.elementPath];
                          const oMeta = WUXIA_ORIGIN_META[art.origin];
                          const gMeta = WUXIA_SECT_GRADE_META[art.grade];
                          const maxTitle = getWuxiaTitleByLayer(art.maxLayer);
                          return (
                            <button
                              key={art.id}
                              type="button"
                              onClick={() => handleSelectWuxiaInnerArt(art)}
                              className={`rounded-lg p-2 text-left transition-colors ring-1 ring-inset ${
                                isSelected
                                  ? 'bg-sky-500/18 ring-sky-400/45'
                                  : 'bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.08]'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="text-[11px] font-semibold text-slate-100">
                                  {art.name}
                                </span>
                                <span
                                  className={`rounded px-1 py-0.5 text-[9.5px] font-semibold ring-1 ring-inset ${pMeta.badgeClass}`}
                                >
                                  {pMeta.shortLabel} · trần {art.maxLayer}T
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <span
                                  className={`rounded px-1 py-0.5 text-[9.5px] font-semibold ring-1 ring-inset ${
                                    art.origin === 'mon_phai'
                                      ? gMeta.badgeClass
                                      : oMeta.badgeClass
                                  }`}
                                >
                                  {art.origin === 'mon_phai'
                                    ? `${art.sectName || 'Môn phái'} · ${gMeta.shortLabel}`
                                    : oMeta.shortLabel}
                                </span>
                                <span className="text-[9.5px] font-medium text-amber-200/90">
                                  Tối đa: {maxTitle.title}
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] leading-snug text-slate-400">
                                {art.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 21-Tier Strength Title Cross-Reference Table (against active manual's ceiling) */}
                  {wuxiaTitleTableOpen && (
                    <div className="space-y-1.5 border-t border-white/[0.08] pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="text-[10.5px] font-semibold text-amber-200">
                          Bảng Quy Chiếu 21 Tôn Hiệu Thực Lực (theo trần bộ đang vận)
                        </div>
                        <div className="text-[10px] text-slate-300 tabular-nums">
                          {wuxiaCeiling.activeArtName} · T{wuxiaCeiling.currentLayer}/
                          {wuxiaCeiling.maxLayer} ({wuxiaCeiling.maxAchievableTitle.title})
                        </div>
                      </div>
                      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                        {wuxiaRefRows.map((row) => {
                          const rowClass =
                            row.status === 'current'
                              ? 'bg-amber-500/18 text-amber-100 ring-1 ring-inset ring-amber-400/45'
                              : row.status === 'achieved'
                                ? 'bg-emerald-500/[0.08] text-slate-200 ring-1 ring-inset ring-emerald-400/20'
                                : row.status === 'reachable'
                                  ? 'bg-white/[0.035] text-slate-200 ring-1 ring-inset ring-white/[0.06]'
                                  : 'bg-black/25 text-slate-500 ring-1 ring-inset ring-white/[0.04]';
                          const badgeClass =
                            row.status === 'current'
                              ? 'bg-amber-500/25 text-amber-100 ring-amber-300/45'
                              : row.status === 'achieved'
                                ? 'bg-emerald-500/18 text-emerald-200 ring-emerald-400/30'
                                : row.status === 'reachable'
                                  ? 'bg-sky-500/16 text-sky-200 ring-sky-400/30'
                                  : 'bg-white/[0.05] text-slate-400 ring-white/[0.08]';
                          return (
                            <div
                              key={row.tier.index}
                              className={`space-y-0.5 rounded-lg px-2 py-1.5 text-[10.5px] ${rowClass}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="font-semibold">
                                  <span
                                    className={`tabular-nums ${
                                      row.status === 'above_ceiling'
                                        ? 'text-slate-500'
                                        : 'text-amber-300/95'
                                    }`}
                                  >
                                    {row.tier.layerRangeLabel}
                                  </span>{' '}
                                  — {row.tier.title}
                                </div>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ring-1 ring-inset tabular-nums ${badgeClass}`}
                                >
                                  {row.statusLabel}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[10px]">
                                <span
                                  className={
                                    row.status === 'above_ceiling'
                                      ? 'text-slate-500'
                                      : 'text-slate-300/85'
                                  }
                                >
                                  {row.tier.meaningVi}
                                </span>
                                <span
                                  className={
                                    row.status === 'above_ceiling'
                                      ? 'font-medium text-amber-300/75'
                                      : 'text-slate-400'
                                  }
                                >
                                  {row.requirementNote}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* 4-Stage Sub-Realm Stepper (Xianxia / Xuanhuan) */}
            {profile.systemKind !== 'wuxia' && (
              <div className="grid grid-cols-4 gap-1">
                {CULTIVATION_SUB_STAGES.map((stageLabel, stageIdx) => {
                  const isCurrent = stageIdx === displayInfo.subStageIndex;
                  const isPassed = stageIdx < displayInfo.subStageIndex;
                  return (
                    <div
                      key={stageLabel}
                      className={`rounded-lg px-2 py-1 text-center text-[10px] font-semibold ring-1 ring-inset transition-colors ${
                        isCurrent
                          ? realmTheme.stepperCurrentClass
                          : isPassed
                            ? realmTheme.stepperPassedClass
                            : 'bg-white/[0.03] text-slate-500 ring-white/[0.06]'
                      }`}
                    >
                      {stageLabel}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Combat Power vs Actual Realm separation display */}
            {profile.combatPowerNote?.trim() && (
              <div className="rounded-xl bg-rose-500/[0.07] px-3 py-2 ring-1 ring-inset ring-rose-400/25">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-200/90">
                  Chiến lực thực chiến (tách bạch cảnh giới thực tế)
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-200">
                  {profile.combatPowerNote}
                </p>
              </div>
            )}

            {/* Cultivation Layer Compact Progress Bar (synced with Realm tier visual palette) */}
            <CompactMasteryBar
              label={profile.energyLabel}
              sublabel={`${profile.exp.toLocaleString('vi-VN')} / ${profile.maxExp.toLocaleString('vi-VN')}`}
              percent={expPct}
              status={canBreakthrough ? 'bottleneck' : 'active'}
              customVisual={canBreakthrough ? undefined : realmTheme.barVisual}
              statusLabel={
                profile.systemKind === 'wuxia' && wuxiaCeiling?.isAtArtCeiling
                  ? `Chạm trần T${wuxiaCeiling.maxLayer}`
                  : canBreakthrough
                    ? bottleneckInfo.kind === 'tribulation'
                      ? 'Chạm Thiên Kiếp'
                      : 'Chạm bình cảnh'
                    : nextRealm
                      ? `Hướng tới ${nextRealm.name}`
                      : 'Đỉnh phong'
              }
              showMilestones
              footerNote={
                displayInfo.overflowExp > 0
                  ? `Dư chờ đột phá: +${displayInfo.overflowExp.toLocaleString('vi-VN')} / ${displayInfo.maxOverflowExp.toLocaleString('vi-VN')}`
                  : undefined
              }
            />

            {/* Breakthrough Outcome Notice (Success or Failed / Backlash) */}
            {(profile.lastBreakthroughOutcome || profile.lastBreakthroughNote) && (() => {
              const outcome = profile.lastBreakthroughOutcome;
              const isFailed = outcome?.outcome === 'failed';
              const summaryText =
                outcome?.summary || profile.lastBreakthroughNote || '';
              if (!summaryText) return null;
              return (
                <div
                  className={`space-y-1.5 rounded-xl px-3 py-2 text-[11px] ring-1 ring-inset ${
                    isFailed
                      ? 'bg-rose-500/[0.11] text-rose-100 ring-rose-400/35'
                      : 'bg-emerald-500/[0.08] text-emerald-100 ring-emerald-400/28'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-1.5">
                      {isFailed ? (
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                      ) : (
                        <ArrowUpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      )}
                      <div className="min-w-0 space-y-1">
                        <div className="leading-relaxed tabular-nums">
                          {summaryText}
                        </div>
                        {outcome && outcome.consequences.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {outcome.consequences.slice(0, 4).map((line, idx) => (
                              <span
                                key={idx}
                                className={`rounded px-1.5 py-0.5 text-[10px] leading-tight ${
                                  isFailed
                                    ? 'bg-rose-500/18 text-rose-100/95'
                                    : 'bg-emerald-500/15 text-emerald-100/95'
                                }`}
                              >
                                {line}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Ẩn thông báo đột phá gần nhất"
                      onClick={() =>
                        onUpdateProfile((prev) => {
                          const next = { ...prev };
                          delete next.lastBreakthroughNote;
                          delete next.lastBreakthroughOutcome;
                          return next;
                        })
                      }
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                        isFailed
                          ? 'text-rose-200/75 hover:bg-rose-400/15 hover:text-rose-100'
                          : 'text-emerald-200/75 hover:bg-emerald-400/15 hover:text-emerald-100'
                      }`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {onInsertStoryPrompt && outcome?.storyPrompt && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onInsertStoryPrompt(outcome.storyPrompt);
                          onClose?.();
                        }}
                        className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2.5 text-[10.5px] font-semibold ring-1 ring-inset whitespace-nowrap ${
                          isFailed
                            ? 'bg-rose-500/20 text-rose-100 ring-rose-300/35 hover:bg-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-100 ring-emerald-300/35 hover:bg-emerald-500/30'
                        }`}
                      >
                        <Send className="h-3 w-3" />
                        <span>Đưa kết quả vào truyện</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Breakthrough Gatekeeper Callout (Chốt chặn bình cảnh / thiên kiếp / trần bộ nội công) */}
            {canBreakthrough &&
              profile.systemKind === 'wuxia' &&
              wuxiaCeiling?.isAtArtCeiling && (
                <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-amber-500/12 px-3 py-2.5 ring-1 ring-inset ring-amber-400/38">
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold text-amber-200">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>{bottleneckInfo.title}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-amber-100/85">
                      {bottleneckInfo.description}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWuxiaCatalogTab(
                        wuxiaCeiling.origin === 'mon_phai' &&
                          wuxiaCeiling.grade !== 'tran_phai'
                          ? 'mon_phai'
                          : 'giang_ho',
                      );
                      setWuxiaInnerArtCatalogOpen(true);
                    }}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 px-3 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(245,158,11,0.55)] hover:from-amber-400 hover:to-orange-500 whitespace-nowrap"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Đổi bộ nội công cao hơn</span>
                  </button>
                </div>
              )}

            {canBreakthrough &&
              breakthroughOdds &&
              !(profile.systemKind === 'wuxia' && wuxiaCeiling?.isAtArtCeiling) && (() => {
              const riskToneClass =
                breakthroughOdds.riskLevel === 'high'
                  ? 'bg-emerald-500/18 text-emerald-200 ring-emerald-400/35'
                  : breakthroughOdds.riskLevel === 'moderate'
                    ? 'bg-amber-500/18 text-amber-200 ring-amber-400/35'
                    : breakthroughOdds.riskLevel === 'risky'
                      ? 'bg-orange-500/20 text-orange-200 ring-orange-400/40'
                      : 'bg-rose-500/22 text-rose-200 ring-rose-400/45';
              const gaugeFillClass =
                breakthroughOdds.riskLevel === 'high'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-300'
                  : breakthroughOdds.riskLevel === 'moderate'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                    : breakthroughOdds.riskLevel === 'risky'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                      : 'bg-gradient-to-r from-rose-600 to-orange-400';

              return (
                <div
                  className={`space-y-2.5 rounded-xl px-3 py-2.5 ring-1 ring-inset ${
                    bottleneckInfo.kind === 'tribulation'
                      ? 'bg-rose-500/12 ring-rose-400/38'
                      : 'bg-amber-500/12 ring-amber-400/35'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 text-xs">
                      <div
                        className={`flex flex-wrap items-center gap-1.5 font-semibold ${
                          bottleneckInfo.kind === 'tribulation'
                            ? 'text-rose-200'
                            : 'text-amber-200'
                        }`}
                      >
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        <span>{bottleneckInfo.title}</span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ring-1 ring-inset ${riskToneClass}`}
                        >
                          Dự kiến {breakthroughOdds.finalChance}% ·{' '}
                          {breakthroughOdds.riskLabel.split(' · ')[0]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] leading-relaxed text-amber-100/85">
                        {bottleneckInfo.description}
                      </div>
                    </div>
                    {!breakthroughConfirmOpen && (
                      <button
                        type="button"
                        onClick={() => setBreakthroughConfirmOpen(true)}
                        className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition-all active:scale-[0.985] whitespace-nowrap ${
                          bottleneckInfo.kind === 'tribulation'
                            ? 'bg-gradient-to-b from-rose-500 to-amber-600 shadow-[0_6px_16px_-6px_rgba(244,63,94,0.55)] hover:from-rose-400 hover:to-amber-500'
                            : 'bg-gradient-to-b from-amber-500 to-orange-600 shadow-[0_6px_16px_-6px_rgba(245,158,11,0.55)] hover:from-amber-400 hover:to-orange-500'
                        }`}
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                        <span>Xử lý đột phá</span>
                      </button>
                    )}
                  </div>

                  {breakthroughConfirmOpen && (
                    <div className="space-y-2.5 border-t border-white/[0.08] pt-2.5">
                      {/* Dynamic Odds Gauge & Factors */}
                      <div className="space-y-2 rounded-lg bg-black/25 p-2.5 ring-1 ring-inset ring-white/[0.07]">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="text-[11px] font-medium text-slate-200">
                            Tỷ lệ thành công dự kiến →{' '}
                            <span className="font-semibold text-amber-200">
                              {breakthroughOdds.targetRealmName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-bold text-white tabular-nums">
                              {breakthroughOdds.finalChance}%
                            </span>
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              (trần {breakthroughOdds.maxChance}%)
                            </span>
                          </div>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${gaugeFillClass}`}
                            style={{ width: `${breakthroughOdds.finalChance}%` }}
                          />
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300 tabular-nums">
                            Cơ bản {breakthroughOdds.baseChance}%
                          </span>
                          {breakthroughOdds.factors.map((f) => (
                            <span
                              key={f.id}
                              title={f.detail}
                              className={`rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                                f.tone === 'positive'
                                  ? 'bg-emerald-500/15 text-emerald-200'
                                  : f.tone === 'negative'
                                    ? 'bg-rose-500/18 text-rose-200'
                                    : 'bg-white/[0.05] text-slate-300'
                              }`}
                            >
                              {f.label}{' '}
                              {f.delta > 0
                                ? `+${f.delta}%`
                                : f.delta < 0
                                  ? `${f.delta}%`
                                  : '0%'}
                            </span>
                          ))}
                        </div>

                        <div className="text-[10.5px] leading-relaxed text-slate-300/90">
                          {breakthroughOdds.recommendation}
                        </div>
                      </div>

                      {/* Optional Assist Item Selector */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[10.5px] font-medium text-slate-300">
                          <span>Vật phẩm trợ lực khi xung kích (tùy chọn)</span>
                          {breakthroughOdds.selectedAssist && (
                            <span className="text-emerald-300 tabular-nums">
                              +{breakthroughOdds.selectedAssist.bonusPercent}% · tiêu hao x1
                            </span>
                          )}
                        </div>
                        {breakthroughOdds.assistOptions.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedBreakthroughAssistId('')}
                              className={`min-h-[28px] rounded-lg px-2 py-1 text-[10.5px] font-medium transition-colors ${
                                !selectedBreakthroughAssistId
                                  ? 'bg-white/15 text-white ring-1 ring-inset ring-white/30'
                                  : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                              }`}
                            >
                              Không dùng thêm
                            </button>
                            {breakthroughOdds.assistOptions.slice(0, 6).map((opt) => {
                              const active =
                                selectedBreakthroughAssistId === opt.item.id;
                              return (
                                <button
                                  key={opt.item.id}
                                  type="button"
                                  title={`${opt.roleLabel} (+${opt.bonusPercent}%)`}
                                  onClick={() =>
                                    setSelectedBreakthroughAssistId(
                                      active ? '' : opt.item.id,
                                    )
                                  }
                                  className={`min-h-[28px] rounded-lg px-2 py-1 text-[10.5px] font-medium transition-colors tabular-nums ${
                                    active
                                      ? 'bg-emerald-500/25 text-emerald-100 ring-1 ring-inset ring-emerald-400/50'
                                      : 'bg-white/[0.05] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.1]'
                                  }`}
                                >
                                  {opt.item.name} (+{opt.bonusPercent}% · x
                                  {opt.item.quantity})
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[10.5px] text-slate-400">
                            Chưa có đan trợ đột phá, tẩy tủy, linh thạch hay phù hộ pháp trong{' '}
                            {profile.bagName}.
                          </div>
                        )}
                      </div>

                      {/* Confirmation Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <div className="text-[10.5px] text-slate-300">
                          {breakthroughOdds.finalChance < 55
                            ? 'Rủi ro phản phệ cao — cân nhắc kỹ!'
                            : 'Xác nhận xung kích (+1 bậc duy nhất)?'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {onInsertStoryPrompt && (
                            <button
                              type="button"
                              onClick={() => {
                                const assistPhrase = breakthroughOdds.selectedAssist
                                  ? ` cùng ${breakthroughOdds.selectedAssist.item.name}`
                                  : '';
                                const promptText =
                                  bottleneckInfo.kind === 'tribulation'
                                    ? `Ta tĩnh tâm chuẩn bị hộ pháp${assistPhrase}, xác suất dự kiến khoảng ${breakthroughOdds.finalChance}%, chính thức dẫn động Thiên Kiếp xung kích đại cảnh giới ${bottleneckInfo.nextRealmName || ''}.`
                                    : `Tu vi đã chạm bình cảnh ${displayInfo.fullLabel}, ta chuẩn bị${assistPhrase} (xác suất dự kiến ${breakthroughOdds.finalChance}%) để bế quan xung kích đột phá lên ${bottleneckInfo.nextRealmName || 'bậc kế tiếp'}.`;
                                onInsertStoryPrompt(promptText);
                                onClose?.();
                              }}
                              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-sky-500/18 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28 whitespace-nowrap"
                            >
                              <Send className="h-3 w-3" />
                              <span>Đưa vào lượt truyện</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setBreakthroughConfirmOpen(false)}
                            className="min-h-[32px] rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12]"
                          >
                            Chưa phá
                          </button>
                          <button
                            type="button"
                            onClick={handleBreakthrough}
                            className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-3 text-[11px] font-semibold text-white whitespace-nowrap tabular-nums ${
                              bottleneckInfo.kind === 'tribulation'
                                ? 'bg-gradient-to-b from-rose-500 to-amber-600 hover:from-rose-400 hover:to-amber-500'
                                : 'bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>
                              {bottleneckInfo.actionLabel} (
                              {breakthroughOdds.finalChance}%)
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Quick-Cultivation Lock Panel (Khóa tu luyện nhanh — nhảy mốc Tháng/Năm & khóa nhảy cấp) */}
            {onQuickCultivate && (
              <div className="space-y-2.5 rounded-xl bg-amber-500/[0.06] p-3 ring-1 ring-inset ring-amber-400/25">
                <button
                  type="button"
                  onClick={() => setSeclusionOpen((v) => !v)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <span className="text-xs font-semibold text-amber-100">
                      Khóa tu luyện nhanh (Bế quan{' '}
                      {profile.systemKind === 'wuxia' ? 'theo Tháng' : 'theo Năm'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {formattedClock && (
                      <span className="text-[11px] text-amber-200/90 tabular-nums">
                        Năm {formattedClock.canChiYear} · {formattedClock.dateStr}
                      </span>
                    )}
                    {seclusionOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {seclusionOpen && (
                  <>
                    <div className="space-y-1 text-[11px] leading-relaxed text-slate-300">
                      <div>{paceDescription}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-amber-200/90">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-semibold ring-1 ring-inset ring-amber-400/30">
                          <Lock className="h-3 w-3" />
                          Chốt khóa chống nhảy cảnh giới: Đang bật
                        </span>
                        <span>
                          Đồng bộ năm/tháng/ngày/giờ/Can Chi &amp; sinh tóm tắt quá trình bế quan.
                        </span>
                      </div>
                    </div>

                    {canBreakthrough ? (
                      <div className="rounded-lg bg-amber-500/[0.08] px-2.5 py-2 ring-1 ring-inset ring-amber-400/28">
                        <CompactMasteryBar
                          size="sm"
                          label={displayInfo.fullLabel}
                          percent={100}
                          status="bottleneck"
                          statusLabel="Khóa bình cảnh"
                          action={
                            <button
                              type="button"
                              onClick={() => setBreakthroughConfirmOpen(true)}
                              className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-amber-500/22 px-2 text-[10px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40 hover:bg-amber-500/32 whitespace-nowrap"
                            >
                              <ArrowUpCircle className="h-3 w-3" />
                              <span>Đột phá</span>
                            </button>
                          }
                        />
                      </div>
                    ) : (
                      <>
                        {/* Genre-specific Seclusion Presets */}
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {seclusionPresets.map((preset) => {
                            const previewTarget = normalizedClock
                              ? formatStoryClock(
                                  preset.years
                                    ? addYearsToClock(normalizedClock, preset.years)
                                    : addMonthsToClock(
                                        normalizedClock,
                                        preset.months || 1,
                                      ),
                                )
                              : null;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() =>
                                  handleRunSeclusionJump({
                                    months: preset.months,
                                    years: preset.years,
                                    label: preset.label,
                                    confirmKey: `secl:${preset.id}`,
                                  })
                                }
                                className="flex min-h-[48px] flex-col items-center justify-center rounded-xl bg-[#141c2c]/95 px-2 py-1.5 text-center ring-1 ring-inset ring-amber-400/28 transition-all hover:bg-amber-500/18 active:scale-[0.98]"
                              >
                                <span className="text-xs font-bold text-amber-100 tabular-nums">
                                  {isConfirmed(`secl:${preset.id}`)
                                    ? '✓ Đã xong'
                                    : preset.label}
                                </span>
                                <span className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                                  {previewTarget
                                    ? `→ ${previewTarget.canChiYear} (${previewTarget.dateStr})`
                                    : preset.hint}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Months / Years Seclusion Input */}
                        <div className="flex items-center gap-2">
                          <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/[0.09] bg-[#162032] px-2.5">
                            <span className="shrink-0 text-[11px] text-slate-400">
                              Bế quan tùy chỉnh:
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={profile.systemKind === 'wuxia' ? 120 : 100}
                              step={1}
                              value={customSeclusionAmount}
                              onChange={(e) =>
                                setCustomSeclusionAmount(e.target.value)
                              }
                              aria-label="Mốc thời gian bế quan tùy chỉnh"
                              className="min-h-[36px] w-full bg-transparent text-xs font-semibold text-slate-100 tabular-nums focus:outline-none"
                            />
                            <span className="shrink-0 text-[11px] text-slate-400">
                              {profile.systemKind === 'wuxia' ? 'tháng' : 'năm'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleRunCustomSeclusion}
                            className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(245,158,11,0.5)] transition-all hover:from-amber-400 hover:to-orange-500 active:scale-[0.985] whitespace-nowrap"
                          >
                            {isConfirmed('secl:custom') ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {isConfirmed('secl:custom') ? '✓ Đã xong' : 'Bế quan'}
                            </span>
                          </button>
                        </div>
                      </>
                    )}

                    {(lastQuickResult?.seclusionSummary ||
                      profile.lastSeclusionSummary) && (
                      <div className="space-y-2 rounded-lg bg-[#0c1524]/90 px-2.5 py-2 text-[11px] ring-1 ring-inset ring-amber-400/20">
                        <div className="leading-relaxed text-slate-200">
                          {lastQuickResult?.seclusionSummary ||
                            profile.lastSeclusionSummary}
                        </div>
                        {onInsertStoryPrompt && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const summaryText =
                                  lastQuickResult?.seclusionSummary ||
                                  profile.lastSeclusionSummary ||
                                  '';
                                if (summaryText) {
                                  onInsertStoryPrompt(
                                    `[Xuất quan sau thời gian bế quan] ${summaryText} Ta mở mắt thu công, cảm nhận biến hóa quanh mình và bước ra ngoài xem tình hình thế cục hiện tại.`,
                                  );
                                  onClose?.();
                                }
                              }}
                              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/18 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 hover:bg-sky-500/28 whitespace-nowrap"
                            >
                              <Send className="h-3 w-3" />
                              <span>Đưa diễn biến bế quan vào lượt truyện</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Quick Cultivation Mode (Tu luyện ngắn theo giờ — chỉ cộng lượng nhỏ/tượng trưng) */}
            {onQuickCultivate && (
              <div className="space-y-2.5 rounded-xl bg-emerald-500/[0.06] p-3 ring-1 ring-inset ring-emerald-400/22">
                <button
                  type="button"
                  onClick={() => setQuickTrainOpen((v) => !v)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    <span className="text-xs font-semibold text-emerald-100">
                      Tu luyện ngắn (Theo giờ · Tượng trưng)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {formattedClock && (
                      <span className="text-[11px] text-amber-200/90 tabular-nums">
                        {formattedClock.shortDateTime}
                      </span>
                    )}
                    {quickTrainOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {quickTrainOpen && (
                  <>
                    <div className="text-[11px] leading-relaxed text-slate-300">
                      Chuyên tu:{' '}
                      <span className="font-medium text-slate-100">
                        {activeTrainingNames.length > 0
                          ? activeTrainingNames.join(', ')
                          : 'Tự tăng tu vi cơ bản'}
                      </span>
                      {' · '}Tu ngắn vài giờ chỉ cộng lượng{' '}
                      {profile.energyLabel.split('/')[0].trim()} nhỏ/tượng trưng
                      và ôn luyện chiêu thức (muốn nhảy mốc lớn hãy dùng{' '}
                      <span className="font-semibold text-amber-200">
                        Khóa tu nhanh
                      </span>
                      ).
                    </div>

                    {/* Quick Duration Presets */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { hours: 1, label: '1 giờ', sub: '+60 phút' },
                          { hours: 4, label: '4 giờ', sub: '1 buổi' },
                          { hours: 8, label: '8 giờ', sub: '1 đêm' },
                        ] as const
                      ).map((preset) => {
                        const previewClock = normalizedClock
                          ? formatStoryClock(
                              addMinutesToClock(
                                normalizedClock,
                                preset.hours * 60,
                              ),
                            ).timeStr
                          : null;
                        return (
                          <button
                            key={preset.hours}
                            type="button"
                            onClick={() =>
                              handleRunQuickCultivate(
                                preset.hours,
                                preset.hours === 8
                                  ? '8 giờ (1 đêm)'
                                  : preset.label,
                                `quick:${preset.hours}`,
                              )
                            }
                            className="flex min-h-[44px] flex-col items-center justify-center rounded-xl bg-[#111c2e]/90 px-2 py-1.5 text-center ring-1 ring-inset ring-emerald-400/24 transition-all hover:bg-emerald-500/18 active:scale-[0.98]"
                          >
                            <span className="text-xs font-semibold text-emerald-100 tabular-nums">
                              {isConfirmed(`quick:${preset.hours}`)
                                ? '✓ Đã xong'
                                : preset.label}
                            </span>
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              {previewClock ? `→ ${previewClock}` : preset.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Hours Input */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/[0.09] bg-[#162032] px-2.5">
                        <span className="shrink-0 text-[11px] text-slate-400">
                          Tùy chỉnh:
                        </span>
                        <input
                          type="number"
                          min={0.5}
                          max={240}
                          step={0.5}
                          value={customTrainHours}
                          onChange={(e) => setCustomTrainHours(e.target.value)}
                          aria-label="Số giờ tu luyện tùy chỉnh"
                          className="min-h-[36px] w-full bg-transparent text-xs font-semibold text-slate-100 tabular-nums focus:outline-none"
                        />
                        <span className="shrink-0 text-[11px] text-slate-400">
                          giờ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleRunQuickCultivate(
                            parseFloat(customTrainHours),
                            undefined,
                            'quick:custom',
                          )
                        }
                        className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-teal-600 px-3.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)] transition-all hover:from-emerald-400 hover:to-teal-500 active:scale-[0.985] whitespace-nowrap"
                      >
                        {isConfirmed('quick:custom') ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isConfirmed('quick:custom') ? '✓ Đã xong' : 'Tu luyện'}
                        </span>
                      </button>
                    </div>

                    {/* Visual progress snapshot after Quick Cultivation (replaces text-based mastery alerts) */}
                    {lastQuickResult && (
                      <div className="space-y-2 rounded-lg bg-[#0c1524]/90 px-2.5 py-2 ring-1 ring-inset ring-white/[0.07]">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] tabular-nums">
                          <span className="font-semibold text-emerald-200">
                            +{lastQuickResult.expGained}{' '}
                            {profile.energyLabel.split('/')[0].trim()} ·{' '}
                            {lastQuickResult.deltaLabel}
                          </span>
                          <span className="text-amber-200/90">
                            {lastQuickResult.canChiBefore
                              ? `${lastQuickResult.canChiBefore} → ${lastQuickResult.canChiAfter}`
                              : `${lastQuickResult.clockBeforeLabel} → ${lastQuickResult.clockAfterLabel}`}
                          </span>
                        </div>
                        <CompactMasteryBar
                          size="sm"
                          label={displayInfo.fullLabel}
                          percent={expPct}
                          status={
                            lastQuickResult.readyToBreakthrough || canBreakthrough
                              ? 'bottleneck'
                              : 'active'
                          }
                          statusLabel={
                            lastQuickResult.readyToBreakthrough || canBreakthrough
                              ? 'Chạm bình cảnh'
                              : undefined
                          }
                        />
                        {profile.techniques
                          .filter(
                            (t) =>
                              t.isActiveTraining ||
                              lastQuickResult.lockedTechniques?.includes(t.name) ||
                              lastQuickResult.leveledTechniques.includes(t.name),
                          )
                          .slice(0, 3)
                          .map((t) => {
                            const tLock = getTechniqueLockStatus(t, profile, {
                              sceneText: currentTurnText,
                            });
                            const tBarStatus = resolveSkillMasteryBarStatus(
                              t.mastery,
                              {
                                isMaxed: tLock.isMaxed,
                                isLocked: tLock.isLocked,
                                isActive: t.isActiveTraining,
                                stageShortLabel: tLock.stageShortLabel,
                              },
                            );
                            return (
                              <CompactMasteryBar
                                key={t.id}
                                size="sm"
                                label={t.name}
                                sublabel={`Tầng ${t.level}/${t.maxLevel}`}
                                percent={t.mastery}
                                status={tBarStatus}
                                statusLabel={
                                  tLock.isLocked
                                    ? 'Viên mãn · Bình cảnh'
                                    : tLock.stageShortLabel
                                }
                              />
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Compact Technique Mastery Overview (replaces text-based lastGainSummary alert) */}
            {profile.techniques.length > 0 && (
              <div className="space-y-2 border-t border-white/[0.06] pt-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-300">
                    Tiến độ công pháp ({profile.techniques.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('techniques')}
                    className="text-[11px] font-medium text-sky-300 hover:text-sky-200 whitespace-nowrap"
                  >
                    Chi tiết →
                  </button>
                </div>
                <div className="space-y-2">
                  {profile.techniques.slice(0, 4).map((tech) => {
                    const tLock = getTechniqueLockStatus(tech, profile, {
                      sceneText: currentTurnText,
                    });
                    const tBarStatus = resolveSkillMasteryBarStatus(
                      tech.mastery,
                      {
                        isMaxed: tLock.isMaxed,
                        isLocked: tLock.isLocked,
                        isActive: tech.isActiveTraining,
                        stageShortLabel: tLock.stageShortLabel,
                      },
                    );
                    return (
                      <CompactMasteryBar
                        key={tech.id}
                        size="sm"
                        label={tech.name}
                        sublabel={`Tầng ${tech.level}/${tech.maxLevel}`}
                        percent={tech.mastery}
                        status={tBarStatus}
                        statusLabel={
                          tLock.isLocked
                            ? 'Viên mãn · Bình cảnh'
                            : tLock.isMaxed
                              ? 'Viên mãn'
                              : tLock.stageShortLabel
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick EXP & Auto-Clock Switch */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={profile.autoProgressByClock}
                onClick={() =>
                  onUpdateProfile((prev) => ({
                    ...prev,
                    autoProgressByClock: !prev.autoProgressByClock,
                  }))
                }
                className={`inline-flex min-h-[34px] items-center gap-2 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                  profile.autoProgressByClock
                    ? 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/30 hover:bg-emerald-500/22'
                    : 'bg-white/[0.045] text-slate-400 ring-white/[0.08] hover:text-slate-200'
                }`}
              >
                <span>Tự tăng theo đồng hồ: {profile.autoProgressByClock ? 'Bật' : 'Tắt'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickAddExp(15)}
                  className="min-h-[34px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] tabular-nums whitespace-nowrap"
                >
                  +15 EXP
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddExp(50)}
                  className="min-h-[34px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] tabular-nums whitespace-nowrap"
                >
                  +50 EXP
                </button>
              </div>
            </div>

            {/* Inline Manual Realm Editor */}
            {editingRealm && (
              <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      Hệ thống thể loại
                    </span>
                    <select
                      value={draftSystemKind}
                      onChange={(e) => {
                        const nextKind = e.target.value as CultivationSystemKind;
                        const nextM = CULTIVATION_SYSTEM_META[nextKind];
                        const safeI = Math.min(
                          draftRealmIndex,
                          nextM.realms.length - 1,
                        );
                        setDraftSystemKind(nextKind);
                        setDraftRealmIndex(safeI);
                        setDraftRealmName(nextM.realms[safeI].name);
                        setDraftMaxExp(String(nextM.realms[safeI].maxExp));
                        setDraftBagName(nextM.bagName);
                      }}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                    >
                      <option value="xianxia">Tiên Hiệp (Tu Tiên)</option>
                      <option value="xuanhuan">Huyền Huyễn (Huyền Khí)</option>
                      <option value="wuxia">Kiếm Hiệp (Võ Học)</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      Chọn mốc cảnh giới chuẩn
                    </span>
                    <select
                      value={draftRealmIndex}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value, 10) || 0;
                        const st =
                          CULTIVATION_SYSTEM_META[draftSystemKind].realms[idx];
                        setDraftRealmIndex(idx);
                        if (st) {
                          setDraftRealmName(st.name);
                          setDraftMaxExp(String(st.maxExp));
                        }
                      }}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                    >
                      {CULTIVATION_SYSTEM_META[draftSystemKind].realms.map(
                        (r, i) => (
                          <option key={r.name} value={i}>
                            {i + 1}. {r.name} (mốc {r.maxExp})
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="space-y-1 sm:col-span-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      Tên cảnh giới hiển thị
                    </span>
                    <input
                      type="text"
                      value={draftRealmName}
                      onChange={(e) => setDraftRealmName(e.target.value)}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      EXP hiện tại
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={draftExp}
                      onChange={(e) => setDraftExp(e.target.value)}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-slate-300">
                      Mốc đột phá
                    </span>
                    <input
                      type="number"
                      min={10}
                      value={draftMaxExp}
                      onChange={(e) => setDraftMaxExp(e.target.value)}
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Tên túi đồ / hành trang
                  </span>
                  <input
                    type="text"
                    value={draftBagName}
                    onChange={(e) => setDraftBagName(e.target.value)}
                    placeholder="VD: Túi trữ vật, Nhẫn không gian, Hành trang giang hồ..."
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Chiến lực thực chiến &amp; cơ sở vượt cấp (tùy chọn)
                  </span>
                  <textarea
                    rows={2}
                    value={draftCombatPowerNote}
                    onChange={(e) => setDraftCombatPowerNote(e.target.value)}
                    placeholder="VD: Ngang Trúc Cơ Trung kỳ nhờ Kiếm Tâm thông minh + bí thuật đốt tinh huyết (cái giá: suy kiệt 3 ngày)."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRealm(false)}
                    className="min-h-[34px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRealmEdit}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/30"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Lưu cảnh giới</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* LINH CĂN · THỂ CHẤT · CĂN CƠ (Spirit Root · Physique · Foundation) */}
          {(() => {
            const rootMeta = getInventoryQualityMeta(
              constitution.spiritRoot.grade,
              profile.systemKind,
            );
            const phyMeta = getInventoryQualityMeta(
              constitution.physique.grade,
              profile.systemKind,
            );
            const fndMeta = getInventoryQualityMeta(
              constitution.foundation.grade,
              profile.systemKind,
            );
            const impurityLevel = constitution.foundation.impurity;
            const impurityTone =
              impurityLevel <= 15
                ? 'text-emerald-300'
                : impurityLevel <= 35
                  ? 'text-sky-300'
                  : impurityLevel <= 55
                    ? 'text-amber-300'
                    : 'text-rose-300';

            return (
              <div className="space-y-3 rounded-xl bg-[#0e1625]/80 p-3.5 ring-1 ring-inset ring-white/[0.08]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                      <span>{constitutionLabels.sectionTitle}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Đồng bộ trực tiếp với đan tẩy tủy, tiên linh dịch, diễn biến truyện &amp; ngữ cảnh AI
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {cleansingBagItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('inventory')}
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-cyan-500/15 px-2.5 text-[11px] font-semibold text-cyan-200 ring-1 ring-inset ring-cyan-400/32 hover:bg-cyan-500/24 whitespace-nowrap"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Dùng linh dịch/đan ({cleansingBagItems.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        editingConstitution
                          ? setEditingConstitution(false)
                          : openConstitutionEditor()
                      }
                      className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] whitespace-nowrap"
                    >
                      <Edit3 className="h-3 w-3 text-sky-300" />
                      <span>{editingConstitution ? 'Đóng' : 'Sửa'}</span>
                    </button>
                  </div>
                </div>

                {/* Recent Evolution / Cleansing Notice */}
                {constitution.lastEvolutionNote && (
                  <div className="flex items-start justify-between gap-2 rounded-lg bg-cyan-500/[0.09] px-2.5 py-2 text-[11px] text-cyan-100 ring-1 ring-inset ring-cyan-400/28">
                    <div className="flex min-w-0 items-start gap-1.5">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                      <span className="leading-relaxed">
                        {constitution.lastEvolutionNote}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Ẩn ghi nhận biến đổi tư chất"
                      onClick={() =>
                        onUpdateProfile((prev) => {
                          if (!prev.constitution) return prev;
                          const nextConst = { ...prev.constitution };
                          delete nextConst.lastEvolutionNote;
                          return { ...prev, constitution: nextConst };
                        })
                      }
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-cyan-200/75 hover:bg-cyan-400/15 hover:text-cyan-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* 3 Structured Pillars: Linh căn · Thể chất · Căn cơ */}
                <div className="space-y-2">
                  {/* 1. Linh căn */}
                  <div className="space-y-1.5 rounded-xl bg-[#0a111f]/78 p-2.5 ring-1 ring-inset ring-white/[0.07]">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {constitutionLabels.rootTitle}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            constitution.spiritRoot.grade === 'immortal' &&
                            !profile.reduceRealmEffects
                              ? 'item-text-immortal'
                              : rootMeta.nameClass
                          }`}
                        >
                          {constitution.spiritRoot.name}
                        </span>
                        <span
                          className={`rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-white/[0.1] ${rootMeta.textClass}`}
                        >
                          {rootMeta.shortLabel}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold tabular-nums text-cyan-200">
                        Thuần khiết {constitution.spiritRoot.purity}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          constitution.spiritRoot.grade === 'immortal'
                            ? 'bg-gradient-to-r from-amber-300 via-rose-300 to-cyan-300'
                            : constitution.spiritRoot.grade === 'legendary'
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-200'
                              : constitution.spiritRoot.grade === 'epic'
                                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-300'
                                : constitution.spiritRoot.grade === 'rare'
                                  ? 'bg-gradient-to-r from-sky-500 to-cyan-300'
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-300'
                        }`}
                        style={{ width: `${constitution.spiritRoot.purity}%` }}
                      />
                    </div>
                    <div className="text-[11px] leading-relaxed text-slate-300/90">
                      {constitution.spiritRoot.elements && (
                        <span className="font-medium text-slate-200">
                          {constitution.spiritRoot.elements} ·{' '}
                        </span>
                      )}
                      <span>{constitution.spiritRoot.affinityNote}</span>
                    </div>
                  </div>

                  {/* 2. Thể chất */}
                  <div className="space-y-1.5 rounded-xl bg-[#0a111f]/78 p-2.5 ring-1 ring-inset ring-white/[0.07]">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {constitutionLabels.physiqueTitle}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            constitution.physique.grade === 'immortal' &&
                            !profile.reduceRealmEffects
                              ? 'item-text-immortal'
                              : phyMeta.nameClass
                          }`}
                        >
                          {constitution.physique.name}
                        </span>
                        <span
                          className={`rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-white/[0.1] ${phyMeta.textClass}`}
                        >
                          {phyMeta.shortLabel}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold tabular-nums text-amber-200">
                        Tôi luyện {constitution.physique.refinement}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-200 transition-all duration-300"
                        style={{ width: `${constitution.physique.refinement}%` }}
                      />
                    </div>
                    <div className="text-[11px] leading-relaxed text-slate-300/90">
                      <span className="font-semibold text-emerald-200">
                        {constitution.physique.stateLabel}
                      </span>
                      {' · '}
                      <span>{constitution.physique.traits}</span>
                    </div>
                  </div>

                  {/* 3. Căn cơ */}
                  <div className="space-y-1.5 rounded-xl bg-[#0a111f]/78 p-2.5 ring-1 ring-inset ring-white/[0.07]">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {constitutionLabels.foundationTitle}
                        </span>
                        <span className={`text-xs font-bold ${fndMeta.nameClass}`}>
                          {constitution.foundation.label}
                        </span>
                        <span
                          className={`rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-white/[0.1] ${fndMeta.textClass}`}
                        >
                          {fndMeta.shortLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-bold tabular-nums">
                        <span className="text-emerald-200">
                          Vững {constitution.foundation.solidity}%
                        </span>
                        <span className={impurityTone}>
                          Tạp chất {impurityLevel}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300 transition-all duration-300"
                        style={{ width: `${constitution.foundation.solidity}%` }}
                      />
                    </div>
                    <div className="text-[11px] leading-relaxed text-slate-300/90">
                      {constitution.foundation.resilienceNote}
                    </div>
                  </div>
                </div>

                {/* Inline Constitution Manual Editor */}
                {editingConstitution && (
                  <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="space-y-1 sm:col-span-2">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Tên {constitutionLabels.rootTitle}
                        </span>
                        <input
                          type="text"
                          value={draftRootName}
                          onChange={(e) => setDraftRootName(e.target.value)}
                          placeholder={constitutionLabels.rootPlaceholder}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Thuần khiết (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draftRootPurity}
                          onChange={(e) => setDraftRootPurity(e.target.value)}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Thuộc tính nguyên tố
                        </span>
                        <input
                          type="text"
                          value={draftRootElements}
                          onChange={(e) => setDraftRootElements(e.target.value)}
                          placeholder="VD: Mộc · Thủy, Băng · Lôi..."
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Độ tương thích linh khí
                        </span>
                        <input
                          type="text"
                          value={draftRootAffinity}
                          onChange={(e) => setDraftRootAffinity(e.target.value)}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="space-y-1 sm:col-span-2">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Tên {constitutionLabels.physiqueTitle}
                        </span>
                        <input
                          type="text"
                          value={draftPhyName}
                          onChange={(e) => setDraftPhyName(e.target.value)}
                          placeholder={constitutionLabels.physiquePlaceholder}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Tôi luyện (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draftPhyRefinement}
                          onChange={(e) => setDraftPhyRefinement(e.target.value)}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Trạng thái thể chất
                        </span>
                        <input
                          type="text"
                          value={draftPhyState}
                          onChange={(e) => setDraftPhyState(e.target.value)}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Đặc tính nổi bật
                        </span>
                        <input
                          type="text"
                          value={draftPhyTraits}
                          onChange={(e) => setDraftPhyTraits(e.target.value)}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Mức {constitutionLabels.foundationTitle}
                        </span>
                        <input
                          type="text"
                          value={draftFndLabel}
                          onChange={(e) => setDraftFndLabel(e.target.value)}
                          placeholder={constitutionLabels.foundationPlaceholder}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Độ vững chắc (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draftFndSolidity}
                          onChange={(e) => setDraftFndSolidity(e.target.value)}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-medium text-slate-300">
                          Tạp chất (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draftFndImpurity}
                          onChange={(e) => setDraftFndImpurity(e.target.value)}
                          className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                        />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="block text-[11px] font-medium text-slate-300">
                        Nền tảng chịu tải khi đột phá
                      </span>
                      <input
                        type="text"
                        value={draftFndResilience}
                        onChange={(e) => setDraftFndResilience(e.target.value)}
                        className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                      />
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingConstitution(false)}
                        className="min-h-[34px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11]"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveConstitutionEdit}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-cyan-500/20 px-3 text-xs font-semibold text-cyan-100 ring-1 ring-inset ring-cyan-400/35 hover:bg-cyan-500/30"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Lưu tư chất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* MAIN CHARACTER STATS BOARD (Bảng Chỉ Số Nhân Vật Chính) */}
          <div className="space-y-3 rounded-xl bg-[#0e1625]/78 p-3.5 ring-1 ring-inset ring-white/[0.08]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100">
                  Chỉ số Nhân vật chính{mcName ? ` · ${mcName}` : ''}
                </div>
                <div className="text-[11px] text-slate-400">
                  Tự động đồng bộ từ cảnh giới, công pháp, trang bị &amp; đan dược
                </div>
              </div>
              <div className="text-[11px] font-semibold text-amber-200/95 tabular-nums">
                {charStats.currencyLabel}: {charStats.spiritStoneTotal}
              </div>
            </div>

            {/* Primary Vital Resource Bars */}
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  label: charStats.hpName,
                  cur: charStats.hp,
                  max: charStats.maxHp,
                  barClass: 'bg-gradient-to-r from-rose-500 to-emerald-400',
                  valClass: 'text-emerald-200',
                },
                {
                  label: charStats.energyName,
                  cur: charStats.qi,
                  max: charStats.maxQi,
                  barClass: 'bg-gradient-to-r from-sky-500 to-cyan-300',
                  valClass: 'text-sky-200',
                },
                {
                  label: 'Thần thức',
                  cur: charStats.spirit,
                  max: charStats.maxSpirit,
                  barClass: 'bg-gradient-to-r from-violet-500 to-fuchsia-400',
                  valClass: 'text-violet-200',
                },
              ].map((bar) => {
                const pct = Math.min(
                  100,
                  Math.round((bar.cur / Math.max(1, bar.max)) * 100),
                );
                return (
                  <div
                    key={bar.label}
                    className="space-y-1 rounded-lg bg-[#0a111f]/75 px-2.5 py-2 ring-1 ring-inset ring-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="text-slate-400 truncate">{bar.label}</span>
                      <span className={`font-bold tabular-nums ${bar.valClass}`}>
                        {bar.cur}/{bar.max}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${bar.barClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 6-Attribute Combat & Cultivation Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: 'Công kích',
                  value: charStats.atk,
                  bonus: charStats.equipAtk,
                  valueClass: 'text-amber-200',
                },
                {
                  label: 'Phòng thủ',
                  value: charStats.def,
                  bonus: charStats.equipDef,
                  valueClass: 'text-sky-200',
                },
                {
                  label: 'Thân pháp',
                  value: charStats.agi,
                  bonus: charStats.equipAgi,
                  valueClass: 'text-emerald-200',
                },
                {
                  label: 'Ngộ tính',
                  value: charStats.insight,
                  bonus: charStats.equipInsight,
                  valueClass: 'text-violet-200',
                },
                {
                  label: 'Danh tiếng',
                  value: charStats.fame,
                  bonus: charStats.equipFame,
                  valueClass: 'text-rose-200',
                },
                {
                  label: 'Đang đeo',
                  value: `${charStats.equippedCount}/${getEquipmentSlotOrder(profile.systemKind, profile.equipment).length}`,
                  bonus: 0,
                  valueClass: 'text-slate-100',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg bg-[#0a111f]/70 px-2.5 py-2 ring-1 ring-inset ring-white/[0.06]"
                >
                  <div className="text-[10px] text-slate-400">{stat.label}</div>
                  <div className="mt-0.5 flex items-baseline gap-1 tabular-nums">
                    <span className={`text-sm font-bold ${stat.valueClass}`}>
                      {stat.value}
                    </span>
                    {stat.bonus > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-300">
                        (+{stat.bonus})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pill Toxicity, Breakthrough Ease & Active Buffs */}
            {(charStats.pillToxicity > 0 ||
              charStats.breakthroughEase > 0 ||
              charStats.activeBuffs.length > 0) && (
              <div className="space-y-1 border-t border-white/[0.06] pt-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {charStats.breakthroughEase > 0 && (
                    <span className="font-semibold text-emerald-300 tabular-nums">
                      Trợ lực bình cảnh: +{charStats.breakthroughEase}%
                    </span>
                  )}
                  {charStats.pillToxicity > 0 && (
                    <span
                      className={`font-semibold tabular-nums ${
                        charStats.pillToxicity >= 70
                          ? 'text-rose-300'
                          : charStats.pillToxicity >= 45
                            ? 'text-amber-300'
                            : 'text-slate-300'
                      }`}
                    >
                      Đan độc tích tụ: {charStats.pillToxicity}%
                      {charStats.pillToxicity >= 70
                        ? ' (cao — giảm hiệu quả đan dược)'
                        : ''}
                    </span>
                  )}
                </div>
                {charStats.activeBuffs.length > 0 && (
                  <div className="text-slate-300/90">
                    Dược lực / Trạng thái:{' '}
                    <span className="text-sky-200">
                      {charStats.activeBuffs.join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EQUIPMENT BOARD (4 Ô Trang Bị) */}
          {renderEquipmentBoard(false)}
        </div>
      )}

      {/* TAB 2: TECHNIQUES / MARTIAL ARTS */}
      {activeTab === 'techniques' && (() => {
        const spiritStone = findSpiritStoneInInventory(profile);
        const techEntries = profile.techniques.map((t) => ({
          tech: t,
          lock: getTechniqueLockStatus(t, profile, {
            sceneText: currentTurnText,
          }),
        }));
        const bottleneckTechCount = techEntries.filter(
          (e) => e.lock.isLocked,
        ).length;
        const bottleneckMoveCount = profile.techniques.reduce(
          (acc, t) =>
            acc +
            (t.moves || []).filter(
              (mv) =>
                getMoveLockStatus(mv, t, profile, {
                  sceneText: currentTurnText,
                }).isLocked,
            ).length,
          0,
        );
        const avgTechMastery =
          profile.techniques.length > 0
            ? Math.round(
                profile.techniques.reduce(
                  (sum, t) => sum + Math.max(0, Math.min(100, t.mastery || 0)),
                  0,
                ) / profile.techniques.length,
              )
            : 0;
        const focusedEntry =
          techEntries.find((e) => e.tech.id === focusedTechId) ||
          techEntries.find((e) => e.lock.isLocked) ||
          techEntries.find((e) => e.tech.isActiveTraining) ||
          techEntries[0] ||
          null;
        const focusedPct = focusedEntry
          ? Math.max(0, Math.min(100, Math.round(focusedEntry.tech.mastery || 0)))
          : 0;
        const focusedRemaining = focusedEntry
          ? Math.max(0, 99 - focusedPct)
          : 0;

        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300">
                {meta.techniqueSectionLabel}
                {spiritStone ? (
                  <span className="text-slate-400 tabular-nums">
                    {' '}
                    · {spiritStone.name} x{spiritStone.quantity}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={openNewTechniqueForm}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/18 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm công pháp</span>
              </button>
            </div>

            {/* Visual Breakthrough Progress Bar right above skills (replaces text-only notification) */}
            {focusedEntry && (() => {
              const focusedBarStatus = resolveSkillMasteryBarStatus(
                focusedPct,
                {
                  isMaxed: focusedEntry.lock.isMaxed,
                  isLocked: focusedEntry.lock.isLocked,
                  isActive: focusedEntry.tech.isActiveTraining,
                  stageShortLabel: focusedEntry.lock.stageShortLabel,
                },
              );
              const focusedVisual = getSkillMasteryBarClasses(focusedBarStatus);
              const focusedContainerAccent =
                focusedBarStatus === 'vien_man'
                  ? 'bg-amber-400/[0.06] ring-amber-300/35'
                  : focusedBarStatus === 'dai_thanh'
                    ? 'bg-purple-500/[0.07] ring-purple-400/30'
                    : focusedBarStatus === 'tieu_thanh'
                      ? 'bg-amber-500/[0.07] ring-amber-400/30'
                      : 'bg-[#0e1625]/85 ring-white/[0.08]';

              return (
              <div
                aria-label="Tiến độ đột phá kỹ năng"
                className={`space-y-2.5 rounded-xl p-3 ring-1 ring-inset ${focusedContainerAccent}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        Tiến độ đột phá · {focusedEntry.tech.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${focusedVisual.statusTextClass}`}
                      >
                        {focusedVisual.isShimmer && (
                          <Sparkles
                            aria-hidden="true"
                            className="h-3 w-3 text-amber-200 item-twinkle-star"
                          />
                        )}
                        <span>
                          {focusedEntry.lock.isMaxed
                            ? 'Đại Viên Mãn'
                            : focusedEntry.lock.isLocked
                              ? 'Viên mãn · Bình cảnh'
                              : focusedEntry.lock.stageShortLabel}
                        </span>
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                      Tầng {focusedEntry.tech.level}/{focusedEntry.tech.maxLevel}
                      {' · '}
                      {focusedEntry.lock.isMaxed
                        ? 'Đã tu luyện viên mãn'
                        : focusedEntry.lock.isLocked
                          ? focusedEntry.tech.level < focusedEntry.tech.maxLevel
                            ? `Đủ ngưỡng đột phá Tầng ${focusedEntry.tech.level + 1}`
                            : 'Đủ ngưỡng đạt Đại Viên Mãn'
                          : `Còn ${focusedRemaining}% tới mốc đột phá ${
                              focusedEntry.tech.level < focusedEntry.tech.maxLevel
                                ? `Tầng ${focusedEntry.tech.level + 1}`
                                : 'Viên Mãn'
                            }`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div
                      className={`text-lg font-bold leading-none ${focusedVisual.percentTextClass}`}
                    >
                      {focusedPct}%
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      thuần thục
                    </div>
                  </div>
                </div>

                {/* Main Breakthrough Progress Track with Milestone Ticks */}
                <div className="space-y-1">
                  <div
                    role="progressbar"
                    aria-valuenow={focusedPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Tiến độ thuần thục ${focusedEntry.tech.name}: ${focusedPct}%`}
                    className={`relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08] ${focusedVisual.trackGlowClass}`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${focusedVisual.fillClass}`}
                      style={{ width: `${focusedPct}%` }}
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-1/4 w-px bg-[#0b1220]/65"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[#0b1220]/65"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-[80%] w-px bg-[#0b1220]/65"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] tabular-nums text-slate-500">
                    <span className={focusedPct >= 0 ? 'text-slate-300' : ''}>
                      0% Sơ nhập
                    </span>
                    <span className={focusedPct >= 50 ? 'text-amber-300 font-medium' : ''}>
                      50% Tiểu thành
                    </span>
                    <span className={focusedPct >= 80 ? 'text-purple-300 font-medium' : ''}>
                      80% Đại thành
                    </span>
                    <span className={focusedPct >= 99 ? 'item-text-immortal font-semibold' : ''}>
                      99% Viên mãn
                    </span>
                  </div>
                </div>

                {/* Quick Multi-Skill Visual Strip */}
                {techEntries.length > 1 && (
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5 sm:grid-cols-3">
                    {techEntries.map(({ tech: t, lock: tLock }) => {
                      const pct = Math.max(0, Math.min(100, Math.round(t.mastery || 0)));
                      const selected = focusedEntry.tech.id === t.id;
                      const stripStatus = resolveSkillMasteryBarStatus(pct, {
                        isMaxed: tLock.isMaxed,
                        isLocked: tLock.isLocked,
                        isActive: t.isActiveTraining,
                        stageShortLabel: tLock.stageShortLabel,
                      });
                      const stripVisual = getSkillMasteryBarClasses(stripStatus);
                      const selectedRingClass =
                        stripStatus === 'vien_man'
                          ? 'bg-amber-400/14 ring-amber-300/50'
                          : stripStatus === 'dai_thanh'
                            ? 'bg-purple-500/16 ring-purple-400/45'
                            : stripStatus === 'tieu_thanh'
                              ? 'bg-amber-500/16 ring-amber-400/45'
                              : 'bg-sky-500/16 ring-sky-400/40';
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFocusedTechId(t.id)}
                          className={`rounded-lg px-2 py-1.5 text-left transition-colors ring-1 ring-inset ${
                            selected
                              ? selectedRingClass
                              : 'bg-white/[0.03] ring-white/[0.06] hover:bg-white/[0.07]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
                            <span className="truncate font-medium text-slate-200">
                              {t.name}
                            </span>
                            <span
                              className={`shrink-0 font-semibold ${stripVisual.percentTextClass}`}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                            <div
                              className={`h-full rounded-full ${stripVisual.fillClass}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Concise Footer Summary + Direct Breakthrough Action if Bottlenecked */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2 text-[11px] tabular-nums text-slate-400">
                  <span>
                    Trung bình {avgTechMastery}% · {profile.techniques.length} công pháp
                    {bottleneckTechCount > 0 || bottleneckMoveCount > 0
                      ? ` · Sẵn sàng đột phá: ${[
                          bottleneckTechCount > 0
                            ? `${bottleneckTechCount} công pháp`
                            : '',
                          bottleneckMoveCount > 0
                            ? `${bottleneckMoveCount} chiêu`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(', ')}`
                      : ''}
                  </span>
                  {focusedEntry.lock.isLocked && (
                    <button
                      type="button"
                      disabled={!focusedEntry.lock.realmMet}
                      onClick={() =>
                        handleUnlockTechniqueBottleneck(focusedEntry.tech.id)
                      }
                      className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap ${
                        focusedEntry.lock.realmMet
                          ? 'bg-amber-500/22 text-amber-100 ring-amber-400/40 hover:bg-amber-500/32'
                          : 'cursor-not-allowed bg-white/[0.04] text-slate-500 ring-white/[0.07]'
                      }`}
                    >
                      <Unlock className="h-3 w-3" />
                      <span>
                        {focusedEntry.tech.level < focusedEntry.tech.maxLevel
                          ? `Đột phá Tầng ${focusedEntry.tech.level + 1}`
                          : 'Đạt Viên Mãn'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              );
            })()}

            {techFormOpen && (
              <div className="space-y-2.5 rounded-xl bg-[#0e1625]/85 p-3 ring-1 ring-inset ring-sky-400/30">
                <div className="text-xs font-semibold text-sky-200">
                  {editingTechId ? 'Sửa công pháp / võ công' : 'Thêm công pháp mới'}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={techName}
                    onChange={(e) => setTechName(e.target.value)}
                    placeholder="Tên công pháp / kiếm pháp / tâm pháp..."
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                  />
                  <select
                    value={techCategory}
                    onChange={(e) =>
                      setTechCategory(e.target.value as TechniqueCategory)
                    }
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                  >
                    {(
                      Object.keys(meta.categoryLabels) as TechniqueCategory[]
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {meta.categoryLabels[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <select
                    value={techTier}
                    onChange={(e) => setTechTier(e.target.value as TechniqueTier)}
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                  >
                    {TIER_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {TECHNIQUE_TIER_META[t].label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={techLevel}
                    onChange={(e) => setTechLevel(e.target.value)}
                    placeholder="Tầng"
                    aria-label="Tầng hiện tại"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={techMaxLevel}
                    onChange={(e) => setTechMaxLevel(e.target.value)}
                    placeholder="Tối đa"
                    aria-label="Tầng tối đa"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={techMastery}
                    onChange={(e) => setTechMastery(e.target.value)}
                    placeholder="% Thuần thục"
                    aria-label="Độ thuần thục phần trăm"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={techDesc}
                  onChange={(e) => setTechDesc(e.target.value)}
                  placeholder="Mô tả ngắn hiệu quả / đặc điểm (tùy chọn)..."
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                />
                <input
                  type="text"
                  value={techUnlockCond}
                  onChange={(e) => setTechUnlockCond(e.target.value)}
                  placeholder="Điều kiện đột phá bình cảnh tùy chỉnh (để trống sẽ tự sinh theo loại công pháp)..."
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTechActiveTraining((v) => !v)}
                      className={`min-h-[34px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset ${
                        techActiveTraining
                          ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/35'
                          : 'bg-white/[0.05] text-slate-400 ring-white/[0.08]'
                      }`}
                    >
                      Đang chuyên tu: {techActiveTraining ? 'Có' : 'Không'}
                    </button>
                    {!editingTechId && (
                      <button
                        type="button"
                        onClick={() => setTechAutoGenerateMoves((v) => !v)}
                        className={`min-h-[34px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset ${
                          techAutoGenerateMoves
                            ? 'bg-sky-500/16 text-sky-200 ring-sky-400/35'
                            : 'bg-white/[0.05] text-slate-400 ring-white/[0.08]'
                        }`}
                      >
                        Tự sinh 4–5 chiêu: {techAutoGenerateMoves ? 'Bật' : 'Tắt'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTechFormOpen(false);
                        setEditingTechId(null);
                      }}
                      className="min-h-[34px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08]"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTechnique}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/30"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Lưu</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {profile.techniques.length === 0 ? (
              <div className="rounded-xl bg-[#0e1625]/60 px-3.5 py-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                Chưa có công pháp hoặc võ công nào. Bấm &quot;Thêm công pháp&quot;
                để bổ sung.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl bg-[#0e1625]/70 ring-1 ring-inset ring-white/[0.07]">
                {profile.techniques.map((tech) => {
                  const tierInfo =
                    TECHNIQUE_TIER_META[tech.tier] || TECHNIQUE_TIER_META.pham;
                  const catLabel =
                    meta.categoryLabels[tech.category] || 'Công pháp';
                  const moves = tech.moves || [];
                  const movesExpanded = Boolean(expandedMovesTechIds[tech.id]);
                  const techLock = getTechniqueLockStatus(tech, profile, {
                    sceneText: currentTurnText,
                  });
                  const moveBottleneckInTech = moves.filter(
                    (mv) =>
                      getMoveLockStatus(mv, tech, profile, {
                        sceneText: currentTurnText,
                      }).isLocked,
                  ).length;
                  const condMeta =
                    MASTERY_LOCK_CONDITION_META[techLock.conditionKind];

                  return (
                    <div key={tech.id} className="space-y-2 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-slate-100">
                              {tech.name}
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${tierInfo.textClass}`}
                            >
                              · {tierInfo.label}
                            </span>
                            {(() => {
                              const techBarStatus = resolveSkillMasteryBarStatus(
                                tech.mastery,
                                {
                                  isMaxed: techLock.isMaxed,
                                  isLocked: techLock.isLocked,
                                  isActive: tech.isActiveTraining,
                                  stageShortLabel: techLock.stageShortLabel,
                                },
                              );
                              const techBarVisual =
                                getSkillMasteryBarClasses(techBarStatus);
                              return (
                                <span
                                  className={`text-[11px] font-semibold ${techBarVisual.statusTextClass}`}
                                >
                                  ·{' '}
                                  {techLock.isLocked
                                    ? 'Viên mãn · Bình cảnh'
                                    : techLock.stageShortLabel}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                            {catLabel} · Tầng {tech.level}/{tech.maxLevel} ·{' '}
                            {moves.length} chiêu thức
                          </div>
                          {tech.description && (
                            <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                              {tech.description}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditTechniqueForm(tech)}
                            aria-label={`Sửa ${tech.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 hover:bg-white/[0.11] hover:text-white"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTechnique(tech.id)}
                            aria-label={`Xóa ${tech.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Reusable Compact Technique Mastery Progress Bar */}
                      <CompactMasteryBar
                        size="md"
                        label={
                          techLock.isMaxed
                            ? 'Đã đạt Đại Viên Mãn'
                            : tech.level < tech.maxLevel
                              ? `Tiến độ đột phá Tầng ${tech.level + 1}`
                              : 'Tiến độ Đại Viên Mãn'
                        }
                        percent={tech.mastery}
                        status={resolveSkillMasteryBarStatus(tech.mastery, {
                          isMaxed: techLock.isMaxed,
                          isLocked: techLock.isLocked,
                          isActive: tech.isActiveTraining,
                          stageShortLabel: techLock.stageShortLabel,
                        })}
                        statusLabel={
                          techLock.isLocked
                            ? condMeta.shortLabel
                            : techLock.stageShortLabel
                        }
                        showMilestones
                        footerNote={
                          techLock.isLocked
                            ? !techLock.realmMet && techLock.requiredRealmName
                              ? `Cần tối thiểu ${techLock.requiredRealmName} (hiện tại: ${displayInfo.fullLabel})`
                              : techLock.unlockCondition
                            : undefined
                        }
                      />

                      {/* Compact Breakthrough Actions (when at 99% bottleneck) */}
                      {techLock.isLocked && (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-amber-500/[0.07] px-2.5 py-2 ring-1 ring-inset ring-amber-400/25">
                            <button
                              type="button"
                              disabled={!techLock.realmMet}
                              onClick={() =>
                                handleUnlockTechniqueBottleneck(tech.id)
                              }
                              className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                                techLock.realmMet
                                  ? 'bg-amber-500/22 text-amber-100 ring-amber-400/40 hover:bg-amber-500/32'
                                  : 'cursor-not-allowed bg-white/[0.04] text-slate-500 ring-white/[0.07]'
                              }`}
                            >
                              <Unlock className="h-3 w-3" />
                              <span>
                                {tech.level < tech.maxLevel
                                  ? `Đột phá lên Tầng ${tech.level + 1}`
                                  : 'Đạt Đại Viên Mãn'}
                              </span>
                            </button>
                            {techLock.realmMet && techLock.assistItem && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUnlockTechniqueBottleneck(
                                    tech.id,
                                    techLock.assistItem?.id,
                                  )
                                }
                                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-emerald-500/18 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/28 whitespace-nowrap"
                              >
                                <Sparkles className="h-3 w-3" />
                                <span>Dùng {techLock.assistItem.name}</span>
                              </button>
                            )}
                            {onInsertStoryPrompt && (
                              <button
                                type="button"
                                onClick={() => {
                                  onInsertStoryPrompt(
                                    buildTechniqueUnlockStoryPrompt(
                                      tech,
                                      techLock,
                                    ),
                                  );
                                  onNotify?.(
                                    `Đã điền hành động xung kích bình cảnh "${tech.name}" vào ô chat.`,
                                  );
                                  onClose?.();
                                }}
                                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 hover:bg-sky-500/26 whitespace-nowrap"
                              >
                                <Send className="h-3 w-3" />
                                <span>Tu luyện phá bình cảnh</span>
                              </button>
                            )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleTechniqueTraining(tech.id)}
                            className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                              tech.isActiveTraining
                                ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/32 hover:bg-emerald-500/24'
                                : 'bg-white/[0.045] text-slate-400 ring-white/[0.08] hover:text-slate-200'
                            }`}
                          >
                            {tech.isActiveTraining
                              ? 'Đang chuyên tu'
                              : 'Đặt làm chuyên tu'}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleMovesExpand(tech.id)}
                            className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap tabular-nums ${
                              movesExpanded
                                ? 'bg-indigo-500/18 text-indigo-100 ring-indigo-400/35'
                                : 'bg-white/[0.045] text-slate-300 ring-white/[0.08] hover:bg-white/[0.10]'
                            }`}
                          >
                            <Swords className="h-3 w-3 text-indigo-300" />
                            <span>Chiêu thức ({moves.length})</span>
                            {moveBottleneckInTech > 0 && (
                              <span className="rounded bg-amber-500/22 px-1 text-[10px] font-semibold text-amber-200">
                                {moveBottleneckInTech} bình cảnh
                              </span>
                            )}
                            {movesExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        {!techLock.isMaxed && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {spiritStone && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUseSpiritStoneOnTechnique(tech.id)
                                }
                                title={`Dùng 1 ${spiritStone.name} (còn ${spiritStone.quantity}) để hỗ trợ tu luyện "${tech.name}"`}
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/14 px-2.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24 whitespace-nowrap"
                              >
                                {isConfirmed(`stone_tech:${tech.id}`) ? (
                                  <Check className="h-3 w-3 text-emerald-300" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                <span>
                                  {isConfirmed(`stone_tech:${tech.id}`)
                                    ? '✓ Đã dùng'
                                    : 'Dùng Linh thạch'}
                                </span>
                              </button>
                            )}
                            {onInsertStoryPrompt && (
                              <button
                                type="button"
                                onClick={() => handleTrainTechniqueInStory(tech)}
                                title={`Điền hành động tu luyện "${tech.name}" vào khung chat cốt truyện`}
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/18 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28 whitespace-nowrap"
                              >
                                <Send className="h-3 w-3" />
                                <span>Tu luyện</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Collapsible Moves (Chiêu thức) List */}
                      {movesExpanded && (
                        <div className="mt-1 space-y-2 rounded-xl bg-[#131e31]/85 p-2.5 ring-1 ring-inset ring-indigo-400/18">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[11px] font-semibold text-indigo-200">
                              Chiêu thức trong bí kíp ({moves.length})
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleGenerateMovesForTech(tech)}
                                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-indigo-500/16 px-2 text-[11px] font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-400/30 hover:bg-indigo-500/24 whitespace-nowrap"
                              >
                                <Wand2 className="h-3 w-3" />
                                <span>Gợi ý 4–5 chiêu</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openNewMoveForm(tech.id)}
                                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/16 px-2 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24 whitespace-nowrap"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Thêm chiêu</span>
                              </button>
                            </div>
                          </div>

                          {/* Visual Breakthrough Progress Summary right above the moves list */}
                          {moves.length > 0 && (() => {
                            const avgMoveMastery = Math.round(
                              moves.reduce(
                                (sum, m) => sum + Math.max(0, Math.min(100, m.mastery || 0)),
                                0,
                              ) / moves.length,
                            );
                            const avgMoveStatus = resolveSkillMasteryBarStatus(
                              avgMoveMastery,
                              { isLocked: moveBottleneckInTech > 0 },
                            );
                            return (
                              <div className="rounded-lg bg-[#0d1626]/75 px-2.5 py-2 ring-1 ring-inset ring-white/[0.06]">
                                <CompactMasteryBar
                                  size="sm"
                                  label="Thuần thục chiêu thức trung bình"
                                  percent={avgMoveMastery}
                                  status={avgMoveStatus}
                                  statusLabel={
                                    moveBottleneckInTech > 0
                                      ? `${moveBottleneckInTech} chiêu chạm ngưỡng`
                                      : undefined
                                  }
                                />
                              </div>
                            );
                          })()}

                          {/* Add / Edit Move Form */}
                          {moveFormTechId === tech.id && (
                            <div className="space-y-2 rounded-lg bg-[#0d1626] p-2.5 ring-1 ring-inset ring-sky-400/28">
                              <div className="text-[11px] font-semibold text-sky-200">
                                {editingMoveId
                                  ? 'Sửa chiêu thức'
                                  : 'Thêm chiêu thức mới'}
                              </div>
                              <input
                                type="text"
                                value={moveName}
                                onChange={(e) => setMoveName(e.target.value)}
                                placeholder="Tên chiêu thức (VD: Thanh Phong Phất Liễu)..."
                                className="min-h-[36px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={moveDesc}
                                onChange={(e) => setMoveDesc(e.target.value)}
                                placeholder="Hiệu ứng / động tác ngắn (tùy chọn)..."
                                className="min-h-[36px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={moveUnlockCond}
                                onChange={(e) => setMoveUnlockCond(e.target.value)}
                                placeholder="Điều kiện đột phá chiêu tùy chỉnh (để trống sẽ tự sinh)..."
                                className="min-h-[36px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                              />
                              <div className="grid grid-cols-3 gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={moveLevel}
                                  onChange={(e) => setMoveLevel(e.target.value)}
                                  placeholder="Cấp"
                                  aria-label="Cấp chiêu thức"
                                  className="min-h-[34px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={moveMaxLevel}
                                  onChange={(e) => setMoveMaxLevel(e.target.value)}
                                  placeholder="Cấp tối đa"
                                  aria-label="Cấp tối đa chiêu thức"
                                  className="min-h-[34px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={moveMastery}
                                  onChange={(e) => setMoveMastery(e.target.value)}
                                  placeholder="% Thuần thục"
                                  aria-label="Phần trăm thuần thục chiêu thức"
                                  className="min-h-[34px] w-full rounded-lg border border-white/[0.09] bg-[#162032] px-2 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                                />
                              </div>
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMoveFormTechId(null);
                                    setEditingMoveId(null);
                                  }}
                                  className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08]"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveMove(tech.id)}
                                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/20 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/30"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Lưu chiêu</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {moves.length === 0 ? (
                            <div className="rounded-lg bg-[#0d1626]/70 px-3 py-2.5 text-center text-[11px] text-slate-400">
                              Chưa có chiêu thức nào. Bấm &quot;Gợi ý 4–5 chiêu&quot;
                              hoặc &quot;Thêm chiêu&quot; để khởi tạo.
                            </div>
                          ) : (
                            <div className="divide-y divide-white/[0.05] overflow-hidden rounded-lg bg-[#0d1626]/80 ring-1 ring-inset ring-white/[0.06]">
                              {moves.map((mv, mvIdx) => {
                                const mvLock = getMoveLockStatus(
                                  mv,
                                  tech,
                                  profile,
                                  { sceneText: currentTurnText },
                                );
                                const mvCondMeta =
                                  MASTERY_LOCK_CONDITION_META[
                                    mvLock.conditionKind
                                  ];
                                const mvBarStatus =
                                  resolveSkillMasteryBarStatus(mv.mastery, {
                                    isMaxed: mvLock.isMaxed,
                                    isLocked: mvLock.isLocked,
                                    stageShortLabel: mvLock.stageShortLabel,
                                  });
                                const mvBarVisual =
                                  getSkillMasteryBarClasses(mvBarStatus);
                                return (
                                  <div
                                    key={mv.id}
                                    className="space-y-1.5 px-2.5 py-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                          <span className="text-xs font-semibold text-slate-100">
                                            {mvIdx + 1}. {mv.name}
                                          </span>
                                          <span className="text-[11px] font-medium text-indigo-300 tabular-nums">
                                            Cấp {mv.level}/{mv.maxLevel}
                                          </span>
                                          <span
                                            className={`text-[10px] font-semibold ${mvBarVisual.statusTextClass}`}
                                          >
                                            ·{' '}
                                            {mvLock.isLocked
                                              ? 'Viên mãn · Bình cảnh'
                                              : mvLock.stageShortLabel}
                                          </span>
                                        </div>
                                        {mv.description && (
                                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                                            {mv.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1">
                                        {!mvLock.isMaxed && spiritStone && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUseSpiritStoneOnMove(
                                                tech.id,
                                                mv.id,
                                              )
                                            }
                                            title={`Dùng 1 ${spiritStone.name} (còn ${spiritStone.quantity}) hỗ trợ luyện chiêu "${mv.name}"`}
                                            className="inline-flex min-h-[26px] items-center gap-0.5 rounded-md bg-emerald-500/14 px-1.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24 whitespace-nowrap"
                                          >
                                            {isConfirmed(
                                              `stone_move:${tech.id}:${mv.id}`,
                                            ) ? (
                                              <Check className="h-2.5 w-2.5 text-emerald-300" />
                                            ) : (
                                              <Sparkles className="h-2.5 w-2.5" />
                                            )}
                                            <span>
                                              {isConfirmed(
                                                `stone_move:${tech.id}:${mv.id}`,
                                              )
                                                ? '✓ Đã dùng'
                                                : 'Linh thạch'}
                                            </span>
                                          </button>
                                        )}
                                        {!mvLock.isMaxed &&
                                          onInsertStoryPrompt && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleTrainMoveInStory(tech, mv)
                                              }
                                              title={`Điền hành động luyện chiêu "${mv.name}" vào khung chat cốt truyện`}
                                              className="inline-flex min-h-[26px] items-center gap-0.5 rounded-md bg-sky-500/18 px-2 text-[10px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28 whitespace-nowrap"
                                            >
                                              <Send className="h-2.5 w-2.5" />
                                              <span>Tu luyện</span>
                                            </button>
                                          )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openEditMoveForm(tech.id, mv)
                                          }
                                          aria-label={`Sửa chiêu ${mv.name}`}
                                          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.05] text-slate-300 hover:bg-white/[0.11] hover:text-white"
                                        >
                                          <Edit3 className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteMove(tech.id, mv.id)
                                          }
                                          aria-label={`Xóa chiêu ${mv.name}`}
                                          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Reusable Compact Move Mastery Bar */}
                                    <CompactMasteryBar
                                      size="sm"
                                      label={
                                        mvLock.isMaxed
                                          ? 'Đạt Tạo Cực'
                                          : mv.level < mv.maxLevel
                                            ? `Tiến độ đột phá Cấp ${mv.level + 1}`
                                            : 'Tiến độ Tạo Cực'
                                      }
                                      percent={mv.mastery}
                                      status={mvBarStatus}
                                      statusLabel={
                                        mvLock.isLocked
                                          ? mvCondMeta.shortLabel
                                          : mvLock.stageShortLabel
                                      }
                                      footerNote={
                                        mvLock.isLocked
                                          ? !mvLock.realmMet &&
                                            mvLock.requiredRealmName
                                            ? `Cần tối thiểu ${mvLock.requiredRealmName}`
                                            : mvLock.unlockCondition
                                          : undefined
                                      }
                                    />

                                    {/* Compact Move Breakthrough Action Row (when at 99% bottleneck) */}
                                    {mvLock.isLocked && (
                                      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-amber-500/[0.07] px-2 py-1.5 ring-1 ring-inset ring-amber-400/25">
                                          <button
                                            type="button"
                                            disabled={!mvLock.realmMet}
                                            onClick={() =>
                                              handleUnlockMoveBottleneck(
                                                tech.id,
                                                mv.id,
                                              )
                                            }
                                            className={`inline-flex min-h-[24px] items-center gap-1 rounded-md px-2 text-[10px] font-semibold ring-1 ring-inset whitespace-nowrap ${
                                              mvLock.realmMet
                                                ? 'bg-amber-500/22 text-amber-100 ring-amber-400/40 hover:bg-amber-500/32'
                                                : 'cursor-not-allowed bg-white/[0.04] text-slate-500 ring-white/[0.07]'
                                            }`}
                                          >
                                            <Unlock className="h-2.5 w-2.5" />
                                            <span>
                                              {mv.level < mv.maxLevel
                                                ? `Đột phá lên Cấp ${mv.level + 1}`
                                                : 'Đạt Tạo Cực'}
                                            </span>
                                          </button>
                                          {mvLock.realmMet &&
                                            mvLock.assistItem && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleUnlockMoveBottleneck(
                                                    tech.id,
                                                    mv.id,
                                                    mvLock.assistItem?.id,
                                                  )
                                                }
                                                className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-emerald-500/18 px-2 text-[10px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/28 whitespace-nowrap"
                                              >
                                                <Sparkles className="h-2.5 w-2.5" />
                                                <span>
                                                  Dùng {mvLock.assistItem.name}
                                                </span>
                                              </button>
                                            )}
                                          {onInsertStoryPrompt && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                onInsertStoryPrompt(
                                                  buildMoveUnlockStoryPrompt(
                                                    mv,
                                                    tech,
                                                    mvLock,
                                                  ),
                                                );
                                                onNotify?.(
                                                  `Đã điền hành động đột phá chiêu "${mv.name}" vào ô chat.`,
                                                );
                                                onClose?.();
                                              }}
                                              className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-sky-500/16 px-2 text-[10px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 hover:bg-sky-500/26 whitespace-nowrap"
                                            >
                                              <Send className="h-2.5 w-2.5" />
                                              <span>Vào truyện đột phá</span>
                                            </button>
                                          )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 3: INVENTORY / BAG */}
      {activeTab === 'inventory' && (() => {
        const cleanInventory = sanitizeInventoryItems(profile.inventory);
        const sortedInventory = [...cleanInventory].sort((a, b) => {
          const rankDiff =
            (INVENTORY_QUALITY_META[b.quality]?.rankOrder || 0) -
            (INVENTORY_QUALITY_META[a.quality]?.rankOrder || 0);
          if (rankDiff !== 0) return rankDiff;
          return a.name.localeCompare(b.name, 'vi');
        });
        const ownedNameQtyMap = new Map<string, number>();
        for (const inv of cleanInventory) {
          if (inv.quantity <= 0) continue;
          const key = inv.name.trim().toLowerCase();
          ownedNameQtyMap.set(key, (ownedNameQtyMap.get(key) || 0) + inv.quantity);
        }
        const ownedWeapons = sortedInventory.filter(
          (i) => i.category === 'weapon',
        );

        const filteredInventory = sortedInventory.filter((i) => {
          if (
            inventoryCategoryFilter !== 'all' &&
            i.category !== inventoryCategoryFilter
          ) {
            return false;
          }
          if (
            isWuxia &&
            inventoryCategoryFilter === 'weapon' &&
            inventoryWeaponQualityFilter !== 'all' &&
            i.quality !== inventoryWeaponQualityFilter
          ) {
            return false;
          }
          return true;
        });

        const filteredXianxiaCatalog = XIANXIA_ITEM_CATALOG.filter((sample) => {
          if (
            catalogCategory !== 'all' &&
            sample.category !== catalogCategory
          ) {
            return false;
          }
          if (catalogQuality !== 'all' && sample.quality !== catalogQuality) {
            return false;
          }
          return true;
        });

        const filteredWuxiaCatalog = WUXIA_ITEM_CATALOG.filter((sample) => {
          if (
            wuxiaCatalogGroup !== 'all' &&
            sample.group !== wuxiaCatalogGroup
          ) {
            return false;
          }
          if (catalogQuality !== 'all' && sample.quality !== catalogQuality) {
            return false;
          }
          if (
            wuxiaCatalogOwnedOnly &&
            !(ownedNameQtyMap.get(sample.name.trim().toLowerCase()) || 0)
          ) {
            return false;
          }
          return true;
        });

        const filteredShopListings = WUXIA_SHOP_LISTINGS.filter((listing) =>
          shopVenueFilter === 'all' ? true : listing.venue === shopVenueFilter,
        );

        const filteredCraftRecipes = WUXIA_CRAFTING_RECIPES.filter((recipe) =>
          craftDisciplineFilter === 'all'
            ? true
            : recipe.discipline === craftDisciplineFilter,
        );

        return (
          <div className="space-y-3">
            {/* Header & Primary Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100">
                  {profile.bagName} ({cleanInventory.length})
                </div>
                <div className="text-[11px] text-slate-400">
                  {isWuxia
                    ? 'Linh dược bấm Dùng · Thần binh, Ngoại trang & Tín vật bấm Trang bị'
                    : 'Đan dược / Tiêu hao bấm Dùng · Pháp bảo / Giáp bấm Trang bị'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCatalogOpen((prev) => !prev)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    catalogOpen
                      ? 'bg-amber-500/24 text-amber-100 ring-1 ring-inset ring-amber-300/50'
                      : 'bg-amber-500/12 text-amber-200 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-500/20'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    {isWuxia
                      ? catalogOpen
                        ? 'Đóng Phong Vật Chí'
                        : 'Phong Vật Chí'
                      : catalogOpen
                        ? 'Đóng kho mẫu'
                        : 'Kho mẫu Tu tiên'}
                  </span>
                </button>
                {isWuxia && (
                  <button
                    type="button"
                    onClick={() => setShopCraftOpen((prev) => !prev)}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      shopCraftOpen
                        ? 'bg-emerald-500/24 text-emerald-100 ring-1 ring-inset ring-emerald-300/50'
                        : 'bg-emerald-500/12 text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>
                      {shopCraftOpen ? 'Đóng Thương điếm' : 'Thương điếm · Rèn'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openNewItemForm}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-sky-500/18 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm vật phẩm</span>
                </button>
              </div>
            </div>

            {/* Wuxia Silver Wallet Summary Bar */}
            {isWuxia && wuxiaWallet && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0e1625]/75 px-3 py-2 ring-1 ring-inset ring-amber-400/20">
                <div className="flex items-center gap-2 text-[11px]">
                  <Coins className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <span className="text-slate-300">Ngân lượng:</span>
                  <span className="font-bold text-amber-200 tabular-nums">
                    {wuxiaWallet.breakdownLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShopCraftMode('shop');
                      setShopCraftOpen(true);
                    }}
                    className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-amber-500/15 px-2 text-[10.5px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-500/25 whitespace-nowrap"
                  >
                    <ShoppingBag className="h-3 w-3" />
                    <span>Mua · Đấu giá</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShopCraftMode('craft');
                      setShopCraftOpen(true);
                    }}
                    className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-emerald-500/15 px-2 text-[10.5px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/25 whitespace-nowrap"
                  >
                    <Hammer className="h-3 w-3" />
                    <span>Rèn · May · Đan</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live Item Action Result Feedback Banner */}
            {lastItemAction && (
              <div className="space-y-2 rounded-xl bg-emerald-500/[0.09] p-3 ring-1 ring-inset ring-emerald-400/35">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-emerald-100">
                      <span>{lastItemAction.headline}</span>
                      {lastItemAction.remainingLabel && (
                        <span className="text-[11px] font-medium text-amber-200/95">
                          · {lastItemAction.remainingLabel}
                        </span>
                      )}
                    </div>
                    {lastItemAction.constitutionChanges &&
                      lastItemAction.constitutionChanges.length > 0 && (
                        <div className="space-y-0.5 rounded-lg bg-cyan-500/[0.11] px-2.5 py-1.5 text-[11px] text-cyan-100 ring-1 ring-inset ring-cyan-400/30">
                          <div className="flex items-center gap-1 font-semibold text-cyan-200">
                            <Sparkles className="h-3 w-3 shrink-0" />
                            <span>Biến đổi {constitutionLabels.sectionTitle}:</span>
                          </div>
                          {lastItemAction.constitutionChanges.map((line, idx) => (
                            <div key={idx} className="leading-relaxed">
                              · {line}
                            </div>
                          ))}
                        </div>
                      )}
                    {lastItemAction.effectLines.length > 0 && (
                      <div className="text-[11px] leading-relaxed text-slate-200/92">
                        {lastItemAction.effectLines.join(' · ')}
                      </div>
                    )}
                    {lastItemAction.toxicityWarning && (
                      <div className="text-[11px] text-amber-200">
                        {lastItemAction.toxicityWarning}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng thông báo kết quả"
                    onClick={() => setLastItemAction(null)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-300 hover:bg-white/[0.14] hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {onInsertStoryPrompt && lastItemAction.storyPrompt && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleSendItemActionToStory(
                          lastItemAction.storyPrompt,
                          lastItemAction.itemName,
                        )
                      }
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-sky-500/22 px-3 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-500/32 whitespace-nowrap"
                    >
                      <Send className="h-3 w-3" />
                      <span>Đưa diễn biến vào truyện</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('realm')}
                      className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.1] hover:bg-white/[0.12] whitespace-nowrap"
                    >
                      <span>
                        {lastItemAction.constitutionChanges?.length
                          ? 'Xem Căn cốt · Tư chất'
                          : 'Xem bảng chỉ số'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Compact Equipment Board right inside Bag tab */}
            {renderEquipmentBoard(true)}

            {/* Detected loot suggestions from current story page */}
            {lootSuggestions.length > 0 && (
              <div className="space-y-2 rounded-xl bg-emerald-500/[0.07] p-3 ring-1 ring-inset ring-emerald-400/25">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Phát hiện vật phẩm ở trang hiện tại — chạm để nhặt</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lootSuggestions.map((loot) => {
                    const lq = getInventoryQualityMeta(
                      loot.quality,
                      profile.systemKind,
                    );
                    return (
                      <button
                        key={loot.name}
                        type="button"
                        onClick={() => handlePickLootSuggestion(loot)}
                        className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-transform active:scale-[0.98] ${lq.cardClass} ${lq.shimmerClass}`}
                      >
                        <Plus className="relative z-10 h-3 w-3 text-slate-200" />
                        <span className={`relative z-10 ${lq.nameClass}`}>
                          {loot.name}
                        </span>
                        <span className={`relative z-10 text-[10px] ${lq.textClass}`}>
                          · {lq.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collapsible Catalog Drawer: "Kho đồ Phong Vật Chí" (Kiếm hiệp) OR "Kho mẫu Tu tiên" (Tiên hiệp/Huyền huyễn) */}
            {catalogOpen && (
              <div className="space-y-3 rounded-xl bg-[#0b1322]/90 p-3 ring-1 ring-inset ring-amber-400/28">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-amber-200">
                      {isWuxia
                        ? `Kho đồ Phong Vật Chí — Giang Hồ (${filteredWuxiaCatalog.length})`
                        : `Kho mẫu Vật phẩm Tu tiên (${filteredXianxiaCatalog.length})`}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {isWuxia
                        ? `Thần binh, Ngoại trang, Linh dược, Bí kíp/Tín vật & Đồ hành tẩu — chạm để thêm vào ${profile.bagName}`
                        : `Chạm để thêm nhanh vào ${profile.bagName} hoặc lọc theo nhóm & phẩm cấp`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCatalogOpen(false)}
                    aria-label="Đóng kho đồ"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 hover:bg-white/[0.12] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Quality Tier Filter & Rarity Palette Strip */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCatalogQuality('all')}
                    className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      catalogQuality === 'all'
                        ? 'bg-white/15 text-white ring-1 ring-inset ring-white/30'
                        : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Mọi phẩm cấp
                  </button>
                  {QUALITY_ORDER.map((q) => {
                    const qMeta = getInventoryQualityMeta(q, profile.systemKind);
                    const active = catalogQuality === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setCatalogQuality(active ? 'all' : q)}
                        className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                          active
                            ? `${qMeta.cardClass} ${qMeta.shimmerClass}`
                            : 'bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.07]'
                        }`}
                      >
                        {qMeta.hasSparkle && (
                          <Sparkles
                            className={`relative z-10 h-3 w-3 ${qMeta.textClass}`}
                          />
                        )}
                        <span
                          className={`relative z-10 ${
                            q === 'immortal' && active
                              ? 'item-text-immortal'
                              : qMeta.textClass
                          }`}
                        >
                          {qMeta.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Group / Category Filter Bar */}
                {isWuxia ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWuxiaCatalogGroup('all')}
                      className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        wuxiaCatalogGroup === 'all'
                          ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                          : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Tất cả 5 nhóm
                    </button>
                    {WUXIA_CATALOG_GROUPS.map((grp) => (
                      <button
                        key={grp.id}
                        type="button"
                        title={grp.hint}
                        onClick={() =>
                          setWuxiaCatalogGroup(
                            wuxiaCatalogGroup === grp.id ? 'all' : grp.id,
                          )
                        }
                        className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                          wuxiaCatalogGroup === grp.id
                            ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                            : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {grp.id === 'than_binh' ? 'Thần binh lợi khí' : grp.shortLabel}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setWuxiaCatalogOwnedOnly((v) => !v)}
                      className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        wuxiaCatalogOwnedOnly
                          ? 'bg-emerald-500/22 text-emerald-100 ring-1 ring-inset ring-emerald-400/45'
                          : 'bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:text-white'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                      <span>Đã sở hữu</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCatalogCategory('all')}
                      className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        catalogCategory === 'all'
                          ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                          : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Tất cả nhóm
                    </button>
                    {(
                      ['consumable', 'weapon', 'herb', 'talisman', 'material'] as const
                    ).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setCatalogCategory(
                            catalogCategory === cat ? 'all' : cat,
                          )
                        }
                        className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                          catalogCategory === cat
                            ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                            : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {getInventoryCategoryShortLabel(cat, profile.systemKind)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Catalog Items Grid */}
                {isWuxia ? (
                  filteredWuxiaCatalog.length === 0 ? (
                    <div className="rounded-xl bg-[#0e1625]/65 px-3 py-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.07]">
                      {wuxiaCatalogOwnedOnly
                        ? 'Chưa sở hữu món nào khớp bộ lọc nhóm / phẩm cấp này trong hành trang.'
                        : 'Không có vật phẩm nào khớp bộ lọc đã chọn.'}
                    </div>
                  ) : (
                    <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
                      {filteredWuxiaCatalog.map((sample) => {
                        const sq = getInventoryQualityMeta(sample.quality, 'wuxia');
                        const sampleSlot = sample.equipSlot
                          ? getEquipmentSlotMeta(sample.equipSlot, 'wuxia').shortLabel
                          : null;
                        const ownedQty =
                          ownedNameQtyMap.get(sample.name.trim().toLowerCase()) || 0;
                        const forging = getWuxiaForgingSuggestion(
                          sample.id,
                          cleanInventory,
                        );
                        return (
                          <div
                            key={sample.id}
                            className={`flex flex-col justify-between gap-2 rounded-xl p-2.5 ${sq.cardClass} ${sq.shimmerClass}`}
                          >
                            <div className="relative z-10 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {sq.hasSparkle && (
                                      <Sparkles
                                        className={`h-3.5 w-3.5 shrink-0 item-twinkle-star ${sq.accentDotClass}`}
                                      />
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedWuxiaDetailItemId(sample.id)
                                      }
                                      className={`text-left text-xs font-bold leading-snug underline-offset-2 hover:underline ${sq.nameClass}`}
                                    >
                                      {sample.name}
                                    </button>
                                    {ownedQty > 0 && (
                                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/35 tabular-nums">
                                        Đã có x{ownedQty}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px]">
                                    <span className={`font-semibold ${sq.textClass}`}>
                                      {sq.label}
                                    </span>
                                    <span aria-hidden="true" className="text-slate-500">
                                      ·
                                    </span>
                                    <span className="text-slate-400">
                                      {getInventoryCategoryShortLabel(
                                        sample.category,
                                        'wuxia',
                                      )}
                                    </span>
                                    {sampleSlot && (
                                      <>
                                        <span aria-hidden="true" className="text-slate-500">
                                          ·
                                        </span>
                                        <span className="text-sky-300/90">
                                          Ô {sampleSlot}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedWuxiaDetailItemId(sample.id)
                                    }
                                    className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-amber-500/14 px-2 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/35 hover:bg-amber-500/24 active:scale-[0.97] whitespace-nowrap"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span>Chi tiết</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddWuxiaCatalogItem(sample)}
                                    className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-white/[0.09] px-2.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.15] hover:bg-white/[0.18] active:scale-[0.97] whitespace-nowrap"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>+{sample.defaultQuantity}</span>
                                  </button>
                                </div>
                              </div>
                              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300/90">
                                {sample.description}
                              </p>
                              {sample.prestigeCue && (
                                <p className="mt-1 text-[10.5px] leading-snug text-amber-200/85">
                                  Phản ứng NPC: {sample.prestigeCue}
                                </p>
                              )}

                              {/* Section Nguyên liệu rèn đúc (khoáng thạch cần nâng cấp & nổi bật món thiếu trong túi đồ) */}
                              {forging && (
                                <div className="mt-2 space-y-1.5 rounded-lg bg-[#09111e]/90 p-2 ring-1 ring-inset ring-amber-400/22">
                                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-200">
                                      <Hammer className="h-3 w-3 shrink-0 text-amber-300" />
                                      <span>
                                        {sample.group === 'than_binh'
                                          ? 'Nguyên liệu rèn đúc'
                                          : 'Nguyên liệu chế tác'}
                                      </span>
                                      {forging.missingMaterialCount > 0 && (
                                        <span className="rounded bg-rose-500/22 px-1.5 py-0.2 text-[9.5px] font-bold text-rose-100 ring-1 ring-inset ring-rose-400/45 tabular-nums">
                                          Thiếu {forging.missingMaterialCount} món
                                        </span>
                                      )}
                                    </span>
                                    {forging.canCraft ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCraftWuxiaRecipe(
                                            forging.recipe.id,
                                            false,
                                          )
                                        }
                                        className="inline-flex min-h-[24px] items-center gap-1 rounded bg-emerald-500/22 px-2 text-[10px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/40 hover:bg-emerald-500/32 whitespace-nowrap"
                                      >
                                        <Hammer className="h-2.5 w-2.5" />
                                        <span>Rèn ngay</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedWuxiaDetailItemId(sample.id)
                                        }
                                        className="text-[10px] font-semibold text-amber-300/90 hover:text-amber-200 underline underline-offset-2"
                                      >
                                        Xem khoáng thạch
                                      </button>
                                    )}
                                  </div>

                                  {forging.upgradeBases.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-300">
                                      <span className="text-slate-400">Phôi nâng cấp:</span>
                                      {forging.upgradeBases.map((base) => (
                                        <span
                                          key={base.id}
                                          className={`rounded px-1.5 py-0.5 ring-1 ring-inset ${
                                            base.owned
                                              ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30'
                                              : 'bg-rose-500/14 text-rose-100 ring-rose-400/40'
                                          }`}
                                        >
                                          {base.name} {base.owned ? '✓' : '(thiếu)'}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex flex-wrap gap-1 text-[10px]">
                                    {forging.materials.map((m) => (
                                      <span
                                        key={m.label}
                                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ring-1 ring-inset tabular-nums ${
                                          m.missing === 0
                                            ? 'bg-emerald-500/12 text-emerald-200 ring-emerald-400/30'
                                            : 'bg-rose-500/20 font-semibold text-rose-100 ring-rose-400/55 shadow-[0_0_8px_rgba(244,63,94,0.18)]'
                                        }`}
                                      >
                                        <span>
                                          {m.label} ({m.have}/{m.need})
                                        </span>
                                        {m.missing > 0 ? (
                                          <span className="rounded bg-rose-500/35 px-1 text-[9px] font-bold text-white">
                                            Thiếu {m.missing}
                                          </span>
                                        ) : (
                                          <span className="text-emerald-300">✓</span>
                                        )}
                                      </span>
                                    ))}
                                    <span
                                      className={`rounded px-1.5 py-0.5 ring-1 ring-inset tabular-nums ${
                                        forging.silverMissing === 0
                                          ? 'bg-emerald-500/12 text-emerald-200 ring-emerald-400/30'
                                          : 'bg-amber-500/18 font-semibold text-amber-100 ring-amber-400/45'
                                      }`}
                                    >
                                      Bạc ({forging.silverHave}/{forging.silverCost} lượng)
                                      {forging.silverMissing > 0
                                        ? ` · Thiếu ${forging.silverMissing}`
                                        : ' ✓'}
                                    </span>
                                  </div>

                                  {forging.missingLines.length > 0 ? (
                                    <div className="rounded bg-rose-500/10 px-2 py-1 text-[10.5px] leading-snug text-rose-100 ring-1 ring-inset ring-rose-400/30">
                                      <span className="font-semibold text-rose-200">
                                        Đang thiếu trong túi:
                                      </span>{' '}
                                      {forging.missingLines.join(', ')}
                                    </div>
                                  ) : (
                                    <div className="text-[10.5px] font-medium text-emerald-300">
                                      Đủ khoáng thạch &amp; ngân lượng — có thể rèn đúc ngay!
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="grid max-h-[320px] gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
                    {filteredXianxiaCatalog.map((sample) => {
                      const sq = getInventoryQualityMeta(
                        sample.quality,
                        profile.systemKind,
                      );
                      return (
                        <div
                          key={sample.id}
                          className={`flex flex-col justify-between gap-2 rounded-xl p-2.5 ${sq.cardClass} ${sq.shimmerClass}`}
                        >
                          <div className="relative z-10 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {sq.hasSparkle && (
                                    <Sparkles
                                      className={`h-3.5 w-3.5 shrink-0 item-twinkle-star ${sq.accentDotClass}`}
                                    />
                                  )}
                                  <span
                                    className={`text-xs font-bold leading-snug ${sq.nameClass}`}
                                  >
                                    {sample.name}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px]">
                                  <span className={`font-semibold ${sq.textClass}`}>
                                    {sq.label}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-500">
                                    ·
                                  </span>
                                  <span className="text-slate-400">
                                    {getInventoryCategoryShortLabel(
                                      sample.category,
                                      profile.systemKind,
                                    )}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddCatalogItem(sample)}
                                className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-white/[0.09] px-2.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.15] hover:bg-white/[0.18] active:scale-[0.97] whitespace-nowrap"
                              >
                                <Plus className="h-3 w-3" />
                                <span>+{sample.defaultQuantity}</span>
                              </button>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300/90">
                              {sample.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Wuxia Trading / Auction & Crafting Drawer */}
            {isWuxia && shopCraftOpen && wuxiaWallet && (
              <div className="space-y-3 rounded-xl bg-[#0b1322]/92 p-3 ring-1 ring-inset ring-emerald-400/28">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-emerald-200">
                      Thương điếm Giang hồ · Đấu giá &amp; Rèn chế
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Ngân lượng hiện có:{' '}
                      <span className="font-semibold text-amber-200">
                        {wuxiaWallet.breakdownLabel}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShopCraftOpen(false)}
                    aria-label="Đóng thương điếm"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 hover:bg-white/[0.12] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Mode Switch: Shop vs Craft */}
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-inset ring-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => setShopCraftMode('shop')}
                    className={`inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      shopCraftMode === 'shop'
                        ? 'bg-amber-500/20 text-amber-100 ring-1 ring-inset ring-amber-400/35'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Mua bán &amp; Đấu giá</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShopCraftMode('craft')}
                    className={`inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      shopCraftMode === 'craft'
                        ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/35'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Hammer className="h-3.5 w-3.5" />
                    <span>Rèn đúc · May · Luyện đan</span>
                  </button>
                </div>

                {shopCraftMode === 'shop' ? (
                  <>
                    {/* Venue Filter Tabs */}
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShopVenueFilter('all')}
                        className={`min-h-[28px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                          shopVenueFilter === 'all'
                            ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                            : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Tất cả cửa tiệm
                      </button>
                      {WUXIA_SHOP_VENUES.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          title={v.hint}
                          onClick={() =>
                            setShopVenueFilter(
                              shopVenueFilter === v.id ? 'all' : v.id,
                            )
                          }
                          className={`min-h-[28px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                            shopVenueFilter === v.id
                              ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                              : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {v.shortLabel}
                        </button>
                      ))}
                    </div>

                    {/* Shop Listings Grid */}
                    <div className="grid max-h-[340px] gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
                      {filteredShopListings.map((listing) => {
                        const catalogItem = findWuxiaCatalogItemById(
                          listing.catalogItemId,
                        );
                        if (!catalogItem) return null;
                        const sq = getInventoryQualityMeta(
                          catalogItem.quality,
                          'wuxia',
                        );
                        const canAfford =
                          wuxiaWallet.totalTaels >= listing.priceTaels;
                        return (
                          <div
                            key={listing.id}
                            className={`flex flex-col justify-between gap-2 rounded-xl p-2.5 ${sq.cardClass} ${sq.shimmerClass}`}
                          >
                            <div className="relative z-10 min-w-0 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    {sq.hasSparkle && (
                                      <Sparkles
                                        className={`h-3 w-3 shrink-0 item-twinkle-star ${sq.accentDotClass}`}
                                      />
                                    )}
                                    <span
                                      className={`text-xs font-bold leading-snug ${sq.nameClass}`}
                                    >
                                      {catalogItem.name}
                                    </span>
                                    {listing.quantity > 1 && (
                                      <span className="text-[10.5px] font-bold text-amber-200">
                                        x{listing.quantity}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-[10px] text-slate-400">
                                    {listing.venueNote}
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-md bg-black/35 px-2 py-0.5 text-[11px] font-bold text-amber-200 ring-1 ring-inset ring-amber-400/30 tabular-nums">
                                  {listing.priceTaels} lượng
                                </span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-slate-300/90">
                                {catalogItem.description}
                              </p>
                            </div>
                            <div className="relative z-10 flex flex-wrap items-center gap-1.5 pt-1">
                              <button
                                type="button"
                                disabled={!canAfford}
                                onClick={() =>
                                  handleBuyWuxiaListing(listing.id, false)
                                }
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/35 hover:bg-amber-500/30 disabled:opacity-45 whitespace-nowrap"
                              >
                                <ShoppingBag className="h-3 w-3" />
                                <span>
                                  {listing.isAuction ? 'Đấu giá' : 'Mua'} (-
                                  {listing.priceTaels} lượng)
                                </span>
                              </button>
                              {onInsertStoryPrompt && (
                                <button
                                  type="button"
                                  disabled={!canAfford}
                                  onClick={() =>
                                    handleBuyWuxiaListing(listing.id, true)
                                  }
                                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/18 px-2 text-[10.5px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 hover:bg-sky-500/28 disabled:opacity-45 whitespace-nowrap"
                                >
                                  <Send className="h-3 w-3" />
                                  <span>Mua &amp; Kể truyện</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Discipline Filter Tabs */}
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          { id: 'all', label: 'Tất cả nghề' },
                          { id: 'ren_duc', label: 'Thợ rèn (Binh khí)' },
                          { id: 'may_mac', label: 'May mặc (Ngoại trang)' },
                          { id: 'luyen_dan', label: 'Luyện đan (Linh dược)' },
                        ] as const
                      ).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setCraftDisciplineFilter(d.id)}
                          className={`min-h-[28px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                            craftDisciplineFilter === d.id
                              ? 'bg-emerald-500/22 text-emerald-100 ring-1 ring-inset ring-emerald-400/40'
                              : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    {/* Crafting Recipes Grid */}
                    <div className="grid max-h-[340px] gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2">
                      {filteredCraftRecipes.map((recipe) => {
                        const outputItem = findWuxiaCatalogItemById(
                          recipe.outputCatalogId,
                        );
                        if (!outputItem) return null;
                        const sq = getInventoryQualityMeta(
                          outputItem.quality,
                          'wuxia',
                        );
                        const avail = checkCraftingRecipeAvailability(
                          profile.inventory,
                          recipe,
                        );
                        return (
                          <div
                            key={recipe.id}
                            className={`flex flex-col justify-between gap-2 rounded-xl p-2.5 ${sq.cardClass} ${sq.shimmerClass}`}
                          >
                            <div className="relative z-10 min-w-0 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    {sq.hasSparkle && (
                                      <Sparkles
                                        className={`h-3 w-3 shrink-0 item-twinkle-star ${sq.accentDotClass}`}
                                      />
                                    )}
                                    <span
                                      className={`text-xs font-bold leading-snug ${sq.nameClass}`}
                                    >
                                      {outputItem.name}
                                    </span>
                                    {recipe.outputQuantity > 1 && (
                                      <span className="text-[10.5px] font-bold text-amber-200">
                                        x{recipe.outputQuantity}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-[10px] text-slate-400">
                                    {recipe.disciplineLabel} · {sq.shortLabel}
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-md bg-black/35 px-2 py-0.5 text-[10.5px] font-bold text-amber-200 ring-1 ring-inset ring-amber-400/28 tabular-nums">
                                  {recipe.silverCost} lượng
                                </span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-slate-300/90">
                                {recipe.craftHint}
                              </p>
                              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] tabular-nums">
                                {avail.matchedMaterials.map((mat) => (
                                  <span
                                    key={mat.label}
                                    className={
                                      mat.have >= mat.need
                                        ? 'text-emerald-300'
                                        : 'text-rose-300'
                                    }
                                  >
                                    {mat.label}: {mat.have}/{mat.need}
                                  </span>
                                ))}
                                <span
                                  className={
                                    avail.silverHave >= recipe.silverCost
                                      ? 'text-emerald-300'
                                      : 'text-rose-300'
                                  }
                                >
                                  Bạc: {avail.silverHave}/{recipe.silverCost}
                                </span>
                              </div>
                            </div>
                            <div className="relative z-10 flex flex-wrap items-center gap-1.5 pt-1">
                              <button
                                type="button"
                                disabled={!avail.canCraft}
                                onClick={() =>
                                  handleCraftWuxiaRecipe(recipe.id, false)
                                }
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/30 disabled:opacity-45 whitespace-nowrap"
                              >
                                <Hammer className="h-3 w-3" />
                                <span>Chế tác</span>
                              </button>
                              {onInsertStoryPrompt && (
                                <button
                                  type="button"
                                  disabled={!avail.canCraft}
                                  onClick={() =>
                                    handleCraftWuxiaRecipe(recipe.id, true)
                                  }
                                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/18 px-2 text-[10.5px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 hover:bg-sky-500/28 disabled:opacity-45 whitespace-nowrap"
                                >
                                  <Send className="h-3 w-3" />
                                  <span>Chế &amp; Kể truyện</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Add / Edit Item Form */}
            {itemFormOpen && (
              <div className="space-y-2.5 rounded-xl bg-[#0e1625]/90 p-3 ring-1 ring-inset ring-sky-400/30">
                <div className="text-xs font-semibold text-sky-200">
                  {editingItemId
                    ? 'Chỉnh sửa vật phẩm'
                    : `Thêm vào ${profile.bagName}`}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder={
                      isWuxia
                        ? 'Tên vật phẩm (VD: Lãnh Nguyệt Bảo Đao, Lưu Vân Cẩm Bào, Bạc vụn...)'
                        : 'Tên vật phẩm (VD: Trúc Cơ Đan, Linh thạch...)'
                    }
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none sm:col-span-2"
                  />
                  <input
                    type="number"
                    min={1}
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    placeholder="Số lượng"
                    aria-label="Số lượng"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-sky-400/75 focus:outline-none"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={itemQuality}
                    onChange={(e) =>
                      setItemQuality(e.target.value as InventoryItemQuality)
                    }
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                  >
                    {QUALITY_ORDER.map((q) => (
                      <option key={q} value={q}>
                        {getInventoryQualityMeta(q, profile.systemKind).label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={itemCategory}
                    onChange={(e) =>
                      setItemCategory(e.target.value as InventoryItemCategory)
                    }
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                  >
                    {formCategoryOrderForSystem.map((c) => (
                      <option key={c} value={c}>
                        {getInventoryCategoryLabel(c, profile.systemKind)}
                      </option>
                    ))}
                  </select>
                </div>
                {(itemCategory === 'weapon' ||
                  itemCategory === 'outfit' ||
                  itemCategory === 'talisman' ||
                  itemCategory === 'misc') && (
                  <select
                    value={itemEquipSlot}
                    onChange={(e) =>
                      setItemEquipSlot(
                        e.target.value as '' | EquipmentSlotId,
                      )
                    }
                    aria-label="Ô trang bị"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                  >
                    <option value="">Ô trang bị: Tự động nhận diện</option>
                    {getEquipmentSlotOrder(
                      profile.systemKind,
                      profile.equipment,
                    ).map((slot) => (
                      <option key={slot} value={slot}>
                        Ô: {getEquipmentSlotMeta(slot, profile.systemKind).label}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Công dụng / mô tả ngắn (tùy chọn)..."
                  className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setItemFormOpen(false);
                      setEditingItemId(null);
                    }}
                    className="min-h-[34px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveItem}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/30"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Lưu vật phẩm</span>
                  </button>
                </div>
              </div>
            )}

            {/* Inventory Category Filter Tabs */}
            {cleanInventory.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setInventoryCategoryFilter('all');
                      setInventoryWeaponQualityFilter('all');
                    }}
                    className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      inventoryCategoryFilter === 'all'
                        ? 'bg-white/14 text-white ring-1 ring-inset ring-white/25'
                        : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tất cả ({cleanInventory.length})
                  </button>
                  {categoryOrderForSystem.map((cat) => {
                    const count = cleanInventory.filter(
                      (i) => i.category === cat,
                    ).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setInventoryCategoryFilter(cat);
                          if (cat !== 'weapon') {
                            setInventoryWeaponQualityFilter('all');
                          }
                        }}
                        className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                          inventoryCategoryFilter === cat
                            ? 'bg-white/14 text-white ring-1 ring-inset ring-white/25'
                            : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {isWuxia && cat === 'weapon'
                          ? 'Thần binh lợi khí'
                          : getInventoryCategoryShortLabel(cat, profile.systemKind)}{' '}
                        ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Wuxia Owned Weapon Tier Filter (Phàm phẩm -> Thần binh / Tuyệt thế) */}
                {isWuxia &&
                  inventoryCategoryFilter === 'weapon' &&
                  ownedWeapons.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#0b1322]/75 px-2.5 py-2 ring-1 ring-inset ring-amber-400/20">
                      <span className="text-[10.5px] font-semibold text-amber-200/90 whitespace-nowrap">
                        Cấp Thần binh:
                      </span>
                      <button
                        type="button"
                        onClick={() => setInventoryWeaponQualityFilter('all')}
                        className={`min-h-[28px] rounded-lg px-2 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          inventoryWeaponQualityFilter === 'all'
                            ? 'bg-white/15 text-white ring-1 ring-inset ring-white/30'
                            : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Tất cả ({ownedWeapons.length})
                      </button>
                      {QUALITY_ORDER.map((q) => {
                        const tierCount = ownedWeapons.filter(
                          (w) => w.quality === q,
                        ).length;
                        const qMeta = getInventoryQualityMeta(q, 'wuxia');
                        const active = inventoryWeaponQualityFilter === q;
                        return (
                          <button
                            key={q}
                            type="button"
                            disabled={tierCount === 0}
                            onClick={() =>
                              setInventoryWeaponQualityFilter(active ? 'all' : q)
                            }
                            className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-all whitespace-nowrap disabled:opacity-35 ${
                              active
                                ? `${qMeta.cardClass} ${qMeta.shimmerClass}`
                                : 'bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.07]'
                            }`}
                          >
                            <span
                              className={`relative z-10 ${
                                q === 'immortal' && active
                                  ? 'item-text-immortal'
                                  : qMeta.textClass
                              }`}
                            >
                              {qMeta.shortLabel} ({tierCount})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}

            {/* Inventory Cards List */}
            {filteredInventory.length === 0 ? (
              <div className="rounded-xl bg-[#0e1625]/60 px-3.5 py-5 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                {cleanInventory.length === 0
                  ? isWuxia
                    ? `${profile.bagName} đang trống. Mở "Phong Vật Chí", "Thương điếm · Rèn" hoặc bấm "Thêm vật phẩm" để bổ sung.`
                    : `${profile.bagName} đang trống. Mở "Kho mẫu Tu tiên" hoặc bấm "Thêm vật phẩm" để bổ sung.`
                  : 'Không có vật phẩm nào trong nhóm đã lọc.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInventory.map((item) => {
                  const qInfo = getInventoryQualityMeta(
                    item.quality,
                    profile.systemKind,
                  );
                  const equipSlot = getItemEquipmentSlot(
                    item,
                    profile.systemKind,
                  );
                  const equippable = equipSlot !== null;
                  const wornSlot = getEquippedSlotForItem(profile, item.id);
                  const isEquipped = wornSlot !== null;
                  const equipBonus = equippable
                    ? getEquipmentItemBonuses(
                        item,
                        wornSlot || equipSlot || undefined,
                        profile.systemKind,
                      )
                    : null;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl px-3.5 py-3 transition-shadow ${qInfo.cardClass} ${qInfo.shimmerClass}`}
                    >
                      <div className="relative z-10 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {qInfo.hasSparkle && (
                                <Sparkles
                                  className={`h-3.5 w-3.5 shrink-0 item-twinkle-star ${qInfo.accentDotClass}`}
                                />
                              )}
                              <span
                                className={`text-sm font-bold tracking-tight ${qInfo.nameClass}`}
                              >
                                {item.name}
                              </span>
                              <span className="text-xs font-bold text-amber-200/95 tabular-nums">
                                x{item.quantity}
                              </span>
                              {isEquipped && wornSlot && (
                                <span className="text-[11px] font-semibold text-emerald-300">
                                  · Đang trang bị (
                                  {
                                    getEquipmentSlotMeta(
                                      wornSlot,
                                      profile.systemKind,
                                    ).shortLabel
                                  }
                                  )
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px]">
                              <span className={`font-semibold ${qInfo.textClass}`}>
                                {qInfo.label}
                              </span>
                              <span aria-hidden="true" className="text-slate-500">
                                ·
                              </span>
                              <span className="text-slate-400">
                                {getInventoryCategoryLabel(
                                  item.category,
                                  profile.systemKind,
                                )}
                              </span>
                              {equippable && equipSlot && (
                                <>
                                  <span aria-hidden="true" className="text-slate-500">
                                    ·
                                  </span>
                                  <span className="text-sky-300/90">
                                    Ô{' '}
                                    {
                                      getEquipmentSlotMeta(
                                        equipSlot,
                                        profile.systemKind,
                                      ).shortLabel
                                    }
                                  </span>
                                </>
                              )}
                            </div>
                            {equipBonus?.summary && (
                              <div className="mt-1 text-[11px] font-medium text-emerald-200/95 tabular-nums">
                                Chỉ số khi đeo: {equipBonus.summary}
                              </div>
                            )}
                            {item.description && (
                              <p className="mt-1 text-xs leading-relaxed text-slate-200/88">
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditItemForm(item)}
                              aria-label={`Sửa ${item.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-300 hover:bg-white/[0.14] hover:text-white"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              aria-label={`Xóa ${item.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/12 text-rose-300 hover:bg-rose-500/24"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {equippable ? (
                              isEquipped && wornSlot ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUnequipSlot(wornSlot, item.id)
                                  }
                                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-rose-500/18 px-3 text-[11px] font-semibold text-rose-100 ring-1 ring-inset ring-rose-400/38 hover:bg-rose-500/28 whitespace-nowrap"
                                >
                                  {isConfirmed(`equip:${item.id}`) ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                                  ) : (
                                    <Shield className="h-3.5 w-3.5" />
                                  )}
                                  <span>
                                    {isConfirmed(`equip:${item.id}`)
                                      ? '✓ Đã đeo'
                                      : 'Tháo đồ'}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleEquipItem(item.id)}
                                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/40 hover:bg-emerald-500/30 whitespace-nowrap"
                                >
                                  {isConfirmed(`equip:${item.id}`) ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                                  ) : (
                                    <Shield className="h-3.5 w-3.5" />
                                  )}
                                  <span>
                                    {isConfirmed(`equip:${item.id}`)
                                      ? '✓ Đã tháo'
                                      : 'Trang bị'}
                                  </span>
                                </button>
                              )
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUseItem(item.id, false)}
                                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-amber-500/18 px-3 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/35 hover:bg-amber-500/28 whitespace-nowrap"
                                >
                                  {isConfirmed(`use:${item.id}`) && (
                                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                                  )}
                                  <span>
                                    {isConfirmed(`use:${item.id}`)
                                      ? '✓ Đã dùng'
                                      : 'Dùng (-1)'}
                                  </span>
                                </button>
                                {onInsertStoryPrompt && (
                                  <button
                                    type="button"
                                    onClick={() => handleUseItem(item.id, true)}
                                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 hover:bg-sky-500/26 whitespace-nowrap"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>Dùng &amp; Kể truyện</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Giảm số lượng ${item.name}`}
                              onClick={() => handleAdjustItemQty(item.id, -1)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.14]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Tăng số lượng ${item.name}`}
                              onClick={() => handleAdjustItemQty(item.id, 1)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.14]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 4: THIÊN – ĐỊA – NHÂN & BẢNG THIÊN KIÊU */}
      {activeTab === 'rankings' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-100">
                Bảng Thiên – Địa – Nhân &amp; Bảng Thiên Kiêu (Top {MAX_RANKING_ENTRIES_PER_BOARD}/bảng)
              </div>
              <p className="text-[11px] text-slate-400">
                Tách biệt hoàn toàn khỏi NPC lượt truyện hiện tại.{' '}
                {mainModelName ? (
                  <span className="text-sky-300/90">
                    API chính: {mainModelName}
                  </span>
                ) : (
                  'Dùng trực tiếp API viết truyện chính.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openNewRankingForm()}
              className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.12] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm tay</span>
            </button>
          </div>

          {/* City / Info-Hub Intel Status Banner */}
          {intelLocationStatus && (
            <div
              className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed ring-1 ring-inset ${
                intelLocationStatus.canUnlockIntel
                  ? 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/28'
                  : 'bg-amber-500/[0.08] text-amber-100/90 ring-amber-400/25'
              }`}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">{intelLocationStatus.reason}</div>
            </div>
          )}

          {/* Main Prose API Actions: Generate 10 NPCs + Auto Recalculate Up/Down Ranks + Auto Top-2 NPC Spar */}
          {(onGenerateRankings ||
            onRecalculateRankings ||
            onSimulateRankingSpar) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {onGenerateRankings && (
                <button
                  type="button"
                  disabled={Boolean(rankingAiBusy)}
                  onClick={() =>
                    handleTriggerGenerateRankings(rankingBoardFilter)
                  }
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-amber-500/18 px-3 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/38 transition-colors hover:bg-amber-500/28 disabled:opacity-55 whitespace-nowrap"
                >
                  {rankingAiBusy === 'generate' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {rankingAiBusy === 'generate'
                      ? 'Đang tạo bảng...'
                      : rankingBoardFilter === 'all'
                        ? 'AI tạo cả 4 bảng (10 NPC/bảng)'
                        : `AI tạo ${CULTIVATION_RANKING_BOARD_META[rankingBoardFilter].shortLabel} (10 NPC)`}
                  </span>
                </button>
              )}

              {onRecalculateRankings && rankingsList.length > 0 && (
                <button
                  type="button"
                  disabled={Boolean(rankingAiBusy)}
                  onClick={() =>
                    handleTriggerRecalculateRankings(rankingBoardFilter)
                  }
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-sky-500/16 px-3 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/26 disabled:opacity-55 whitespace-nowrap"
                >
                  {rankingAiBusy === 'recalc' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {rankingAiBusy === 'recalc'
                      ? 'Đang cập nhật...'
                      : 'Cập nhật biến động hạng'}
                  </span>
                </button>
              )}

              {onSimulateRankingSpar && rankingsList.length > 0 && (
                <button
                  type="button"
                  disabled={Boolean(rankingAiBusy) || !topSparPair}
                  title={
                    topSparPair
                      ? `Giả lập so tài #${topSparPair.npcA.rank} ${topSparPair.npcA.name} vs #${topSparPair.npcB.rank} ${topSparPair.npcB.name} (không ảnh hưởng nhân vật chính)`
                      : 'Cần ít nhất 2 NPC không phải nhân vật chính trên bảng hiện tại'
                  }
                  onClick={handleTriggerRankingSpar}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-rose-500/16 px-3 text-[11px] font-semibold text-rose-100 ring-1 ring-inset ring-rose-400/38 transition-colors hover:bg-rose-500/26 disabled:opacity-55 whitespace-nowrap"
                >
                  {rankingAiBusy === 'spar' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Swords className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {rankingAiBusy === 'spar' ? 'Đang so kè...' : 'Tự động so kè'}
                  </span>
                </button>
              )}
            </div>
          )}

          {rankingAiProgress && (
            <div className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-3 py-2 text-[11px] text-sky-100 ring-1 ring-inset ring-sky-400/25">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-300" />
              <span>{rankingAiProgress}</span>
            </div>
          )}

          {lastRankingChangeSummary && !rankingAiProgress && (
            <div className="rounded-lg bg-indigo-500/10 px-3 py-2 text-[11px] leading-relaxed text-indigo-100 ring-1 ring-inset ring-indigo-400/25">
              <span className="font-semibold text-indigo-200">
                Biến động gần nhất:{' '}
              </span>
              {lastRankingChangeSummary}
            </div>
          )}

          {sparResult && !rankingAiProgress && (
            <div className="space-y-2 rounded-xl bg-rose-950/35 p-3 ring-1 ring-inset ring-rose-400/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Swords className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                  <span className="font-semibold text-rose-100">
                    So kè giả lập · {sparResult.boardLabel}
                  </span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">
                    Không ảnh hưởng MC
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={Boolean(rankingAiBusy) || !topSparPair}
                    onClick={handleTriggerRankingSpar}
                    className="inline-flex min-h-[26px] items-center gap-1 rounded-md bg-rose-500/15 px-2 text-[10.5px] font-medium text-rose-200 ring-1 ring-inset ring-rose-400/30 transition-colors hover:bg-rose-500/25 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>So kè lại</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSparResult(null)}
                    aria-label="Đóng kết quả so kè"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
                <span className="font-semibold text-amber-200">
                  #{sparResult.npcARank} {sparResult.npcAName}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/90">
                  vs
                </span>
                <span className="font-semibold text-sky-200">
                  #{sparResult.npcBRank} {sparResult.npcBName}
                </span>
                {sparResult.venue && (
                  <span className="text-[10.5px] text-slate-400">
                    · {sparResult.venue}
                  </span>
                )}
              </div>

              <p className="text-[12px] leading-relaxed text-slate-100/95">
                {sparResult.summary}
              </p>

              {sparResult.verdict && (
                <div className="border-t border-rose-400/15 pt-1.5 text-[11px] text-rose-200/90">
                  <span className="font-semibold text-rose-100">Thế cục: </span>
                  {sparResult.verdict}
                </div>
              )}
            </div>
          )}

          {/* Board Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: 'all',
                  label: 'Tất cả',
                  activeClass: 'bg-sky-500/20 text-sky-100 ring-sky-400/40',
                },
                {
                  id: 'thien',
                  label: 'Thiên Bảng',
                  activeClass: 'bg-amber-500/20 text-amber-100 ring-amber-400/40',
                },
                {
                  id: 'dia',
                  label: 'Địa Bảng',
                  activeClass:
                    'bg-violet-500/20 text-violet-100 ring-violet-400/40',
                },
                {
                  id: 'nhan',
                  label: 'Nhân Bảng',
                  activeClass: 'bg-sky-500/20 text-sky-100 ring-sky-400/40',
                },
                {
                  id: 'thien_kieu',
                  label: 'Thiên Kiêu',
                  activeClass:
                    'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40',
                },
              ] as const
            ).map((btn) => {
              const active = rankingBoardFilter === btn.id;
              const countText =
                btn.id === 'all'
                  ? `${rankingCountsByBoard.all}/${MAX_RANKING_ENTRIES_PER_BOARD * 4}`
                  : `${rankingCountsByBoard[btn.id]}/${MAX_RANKING_ENTRIES_PER_BOARD}`;
              return (
                <button
                  key={btn.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRankingBoardFilter(btn.id)}
                  className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap tabular-nums ${
                    active
                      ? btn.activeClass
                      : 'bg-white/[0.04] text-slate-400 ring-white/[0.07] hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
                >
                  <span>{btn.label}</span>
                  <span className="text-[10px] opacity-80">({countText})</span>
                </button>
              );
            })}
          </div>

          {rankingBoardFilter !== 'all' && (
            <div className="rounded-lg bg-[#0e1625]/70 px-3 py-2 text-[11px] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
              <span
                className={`font-semibold ${CULTIVATION_RANKING_BOARD_META[rankingBoardFilter].accentTextClass}`}
              >
                {CULTIVATION_RANKING_BOARD_META[rankingBoardFilter].label}:
              </span>{' '}
              {CULTIVATION_RANKING_BOARD_META[rankingBoardFilter].subtitle}
            </div>
          )}

          {/* Add / Edit Ranking Entry Form */}
          {rankingFormOpen && (
            <div className="space-y-2.5 rounded-xl bg-[#0e1625]/85 p-3 ring-1 ring-inset ring-amber-400/30">
              <div className="text-xs font-semibold text-amber-200">
                {editingRankingId
                  ? 'Cập nhật thứ hạng cường giả / thiên kiêu'
                  : `Ghi nhận thứ hạng mới vào Top ${MAX_RANKING_ENTRIES_PER_BOARD}`}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Thuộc bảng
                  </span>
                  <select
                    value={rankBoard}
                    onChange={(e) => {
                      const nextB = e.target.value as CultivationRankingBoard;
                      setRankBoard(nextB);
                      if (nextB === 'thien_kieu') {
                        setRankIsVeteran(false);
                      }
                    }}
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 focus:border-amber-400/75 focus:outline-none"
                  >
                    {CULTIVATION_RANKING_BOARD_ORDER.map((bId) => (
                      <option key={bId} value={bId}>
                        {CULTIVATION_RANKING_BOARD_META[bId].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Thứ hạng (#1–#{MAX_RANKING_ENTRIES_PER_BOARD})
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_RANKING_ENTRIES_PER_BOARD}
                    value={rankPosition}
                    onChange={(e) => setRankPosition(e.target.value)}
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Phạm vi / Mốc bảng
                  </span>
                  <input
                    type="text"
                    value={rankScopeLabel}
                    onChange={(e) => setRankScopeLabel(e.target.value)}
                    placeholder="VD: Toàn giới, Top Trúc Cơ, Đông Vực..."
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Tên nhân vật
                  </span>
                  <input
                    type="text"
                    value={rankName}
                    onChange={(e) => setRankName(e.target.value)}
                    placeholder="VD: Kiếm Tôn Lý Thanh Huyền"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Cảnh giới hiện tại (thực tế)
                  </span>
                  <input
                    type="text"
                    value={rankRealm}
                    onChange={(e) => setRankRealm(e.target.value)}
                    placeholder="VD: Nguyên Anh Hậu kỳ, Trúc Cơ Đỉnh phong..."
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                  />
                </label>
              </div>

              {rankBoard === 'thien_kieu' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    ['nghich_thien', 'tre_the_gia'] as const
                  ).map((tierKey) => {
                    const tMeta = PRODIGY_TIER_META[tierKey];
                    const active = rankProdigyTier === tierKey;
                    return (
                      <button
                        key={tierKey}
                        type="button"
                        onClick={() => setRankProdigyTier(tierKey)}
                        className={`rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors ${
                          active
                            ? tMeta.badgeClass
                            : 'bg-white/[0.03] text-slate-400 ring-white/[0.07] hover:bg-white/[0.07]'
                        }`}
                      >
                        <div className="text-[11px] font-bold">
                          {tMeta.label}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-snug opacity-85">
                          {tMeta.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-slate-200 ring-1 ring-inset ring-white/[0.07]">
                  <input
                    type="checkbox"
                    checked={rankIsVeteran}
                    onChange={(e) => setRankIsVeteran(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-amber-400"
                  />
                  <span>
                    Đánh dấu <strong>Cường giả lâu năm</strong> (kinh nghiệm
                    dày, công pháp vững, đạo tâm sâu)
                  </span>
                </label>
              )}

              <label className="block space-y-1">
                <span className="block text-[11px] font-medium text-slate-300">
                  Chiến lực ước lượng / Đặc điểm nổi bật (công pháp, thể chất,
                  pháp bảo, cái giá vượt cấp)
                </span>
                <textarea
                  rows={2}
                  value={rankCombatPower}
                  onChange={(e) => setRankCombatPower(e.target.value)}
                  placeholder="VD: Có thể nghịch chiến Kim Đan Sơ kỳ nhờ Hỗn Độn Kiếm Thể; nếu kích hoạt bí thuật đốt tinh huyết sẽ trọng thương 7 ngày."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Tông môn / Gia tộc / Nhóm trực thuộc
                  </span>
                  <input
                    type="text"
                    value={rankFaction}
                    onChange={(e) => setRankFaction(e.target.value)}
                    placeholder="VD: Thái Huyền Kiếm Tông / Cổ tộc Lâm gia"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-300">
                    Vị thế / Thái độ hiện tại
                  </span>
                  <input
                    type="text"
                    value={rankStance}
                    onChange={(e) => setRankStance(e.target.value)}
                    placeholder="VD: Bế quan trăm năm — trung lập / Đối địch với MC"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#162032] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRankingFormOpen(false);
                    setEditingRankingId(null);
                  }}
                  className="min-h-[34px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveRanking}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-amber-500/22 px-3 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40 hover:bg-amber-500/32"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{editingRankingId ? 'Lưu thay đổi' : 'Ghi vào bảng'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Ranking Entries List */}
          {visibleRankings.length === 0 ? (
            <div className="rounded-xl bg-[#0e1625]/60 px-4 py-6 text-center ring-1 ring-inset ring-white/[0.06]">
              <Trophy className="mx-auto h-6 w-6 text-amber-300/60" />
              <div className="mt-2 text-xs font-semibold text-slate-200">
                Chưa có nhân vật nào trong{' '}
                {rankingBoardFilter === 'all'
                  ? 'Bảng Thiên – Địa – Nhân & Bảng Thiên Kiêu'
                  : CULTIVATION_RANKING_BOARD_META[rankingBoardFilter].label}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Bấm <strong>AI tạo bảng (10 NPC)</strong> để model viết truyện chính sinh danh sách cường giả riêng biệt (tách khỏi NPC lượt truyện), hoặc thêm thủ công.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {onGenerateRankings && (
                  <button
                    type="button"
                    disabled={Boolean(rankingAiBusy)}
                    onClick={() =>
                      handleTriggerGenerateRankings(rankingBoardFilter)
                    }
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/38 hover:bg-amber-500/30 disabled:opacity-55"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      {rankingBoardFilter === 'all'
                        ? 'AI tạo 4 bảng (10 NPC/bảng)'
                        : `AI tạo 10 NPC ${CULTIVATION_RANKING_BOARD_META[rankingBoardFilter].shortLabel}`}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openNewRankingForm()}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/[0.06] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.12]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm thủ công</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleRankings.map((entry) => {
                const bMeta = CULTIVATION_RANKING_BOARD_META[entry.board];
                const pMeta =
                  entry.board === 'thien_kieu' && entry.prodigyTier
                    ? PRODIGY_TIER_META[entry.prodigyTier]
                    : null;
                const isUnlocked = entry.intelUnlocked !== false || entry.isMc;
                const isExpanded = expandedRankingId === entry.id;
                const isUnlockingThis = unlockingRankingId === entry.id;
                const rankDelta =
                  typeof entry.previousRank === 'number'
                    ? entry.previousRank - entry.rank
                    : null;

                return (
                  <div
                    key={entry.id}
                    className={`space-y-2 rounded-xl p-3 ring-1 ring-inset transition-colors ${
                      entry.isMc
                        ? 'bg-emerald-500/[0.09] ring-emerald-400/35'
                        : 'bg-[#0e1625]/80 ring-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRankingId((prev) =>
                            prev === entry.id ? null : entry.id,
                          )
                        }
                        className="min-w-0 flex-1 space-y-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset tabular-nums ${bMeta.badgeClass}`}
                          >
                            {bMeta.shortLabel} #{entry.rank}
                          </span>
                          {rankDelta !== null && rankDelta !== 0 && (
                            <span
                              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 ring-inset ${
                                rankDelta > 0
                                  ? 'bg-emerald-500/18 text-emerald-200 ring-emerald-400/35'
                                  : 'bg-rose-500/18 text-rose-200 ring-rose-400/35'
                              }`}
                            >
                              {rankDelta > 0 ? `▲ +${rankDelta}` : `▼ ${rankDelta}`}
                            </span>
                          )}
                          <span className="text-sm font-bold text-slate-50">
                            {entry.name}
                          </span>
                          {entry.isMc && (
                            <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100 ring-1 ring-inset ring-emerald-400/40">
                              Nhân vật chính
                            </span>
                          )}
                          {pMeta && (
                            <span
                              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${pMeta.badgeClass}`}
                            >
                              {pMeta.shortLabel}
                            </span>
                          )}
                          {entry.board !== 'thien_kieu' && entry.isVeteran && (
                            <span className="inline-flex items-center rounded-md bg-slate-500/18 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-400/30">
                              Cường giả lâu năm
                            </span>
                          )}
                          {isUnlocked ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-500/14 px-1.5 py-0.5 text-[10px] font-medium text-sky-200 ring-1 ring-inset ring-sky-400/25">
                              <Eye className="h-2.5 w-2.5" />
                              Đã mở tin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/14 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 ring-1 ring-inset ring-amber-400/25">
                              <Lock className="h-2.5 w-2.5" />
                              Phong thanh
                            </span>
                          )}
                        </div>

                        {!isUnlocked ? (
                          <div className="space-y-1 pt-0.5">
                            <div className="text-[11px] text-slate-300">
                              <span className="text-slate-400">Thế lực: </span>
                              <span className="font-medium text-sky-200">
                                {entry.faction || 'Chưa rõ'}
                              </span>
                              {entry.scopeLabel && (
                                <span className="text-slate-400">
                                  {' '}
                                  · {entry.scopeLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] italic leading-relaxed text-amber-100/85">
                              “{entry.rumorSummary || 'Chỉ mới nghe phong thanh danh hiệu trên bảng, chưa rõ cảnh giới và thực lực thực sự.'}”
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Bấm vào thẻ để xem chi tiết / nghe ngóng mở hồ sơ
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1 pt-0.5">
                            <div className="grid gap-1 text-[11px] sm:grid-cols-2">
                              <div className="text-slate-300">
                                <span className="text-slate-400">Cảnh giới: </span>
                                <span className="font-semibold text-amber-200">
                                  {entry.realm}
                                </span>
                              </div>
                              <div className="text-slate-300">
                                <span className="text-slate-400">Thế lực: </span>
                                <span className="font-medium text-sky-200">
                                  {entry.faction}
                                </span>
                              </div>
                            </div>
                            <div className="text-[11px] leading-relaxed text-slate-200">
                              <span className="text-slate-400">
                                Chiến lực / Đặc điểm:{' '}
                              </span>
                              {entry.combatPower}
                            </div>
                            <div className="text-[11px] text-slate-300">
                              <span className="text-slate-400">
                                Vị thế / Thái độ:{' '}
                              </span>
                              <span className="text-emerald-200/90">
                                {entry.stance}
                              </span>
                            </div>
                          </div>
                        )}
                      </button>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditRankingForm(entry)}
                            aria-label={`Sửa ${entry.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] text-slate-300 hover:bg-white/[0.11] hover:text-white"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRanking(entry.id)}
                            aria-label={`Xóa ${entry.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Thăng hạng (số hạng nhỏ hơn)"
                            aria-label={`Thăng hạng ${entry.name}`}
                            onClick={() => handleAdjustRankPosition(entry.id, -1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.05] text-emerald-300 ring-1 ring-inset ring-white/[0.08] hover:bg-emerald-500/18"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Hạ hạng (số hạng lớn hơn)"
                            aria-label={`Hạ hạng ${entry.name}`}
                            onClick={() => handleAdjustRankPosition(entry.id, 1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.05] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12]"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Dossier / Intel Unlock Area */}
                    {isExpanded && (
                      <div className="space-y-2 border-t border-white/[0.07] pt-2.5 text-[11px]">
                        {!isUnlocked ? (
                          <div className="space-y-2 rounded-lg bg-amber-500/[0.06] p-2.5 ring-1 ring-inset ring-amber-400/20">
                            <div className="text-slate-300 leading-relaxed">
                              Hồ sơ chi tiết (xuất thân, cảnh giới chính xác, công pháp/huyết mạch, chiến tích, hành tung gần nhất) hiện đang khóa ở mức phong thanh.
                            </div>
                            {onUnlockRankingIntel && (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] text-slate-400">
                                  {intelLocationStatus?.canUnlockIntel
                                    ? `Có thể dò hỏi tại: ${intelLocationStatus.matchedPlace}`
                                    : 'Cần ở thành thị, tửu lầu, phường thị, truyền tống trận hoặc tông môn'}
                                </span>
                                <button
                                  type="button"
                                  disabled={
                                    isUnlockingThis ||
                                    Boolean(rankingAiBusy)
                                  }
                                  onClick={() => handleTriggerUnlockIntel(entry)}
                                  className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                                    intelLocationStatus?.canUnlockIntel
                                      ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40 hover:bg-emerald-500/30'
                                      : 'bg-white/[0.05] text-slate-400 ring-white/[0.08] hover:bg-white/[0.09]'
                                  }`}
                                >
                                  {isUnlockingThis ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : intelLocationStatus?.canUnlockIntel ? (
                                    <Eye className="h-3.5 w-3.5" />
                                  ) : (
                                    <Lock className="h-3.5 w-3.5" />
                                  )}
                                  <span>
                                    {isUnlockingThis
                                      ? 'Đang dò la tin tức...'
                                      : 'Nghe ngóng mở hồ sơ đầy đủ'}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 rounded-lg bg-[#0b1322]/90 p-2.5 ring-1 ring-inset ring-white/[0.06]">
                            {entry.origin && (
                              <div className="text-slate-200 leading-relaxed">
                                <span className="font-semibold text-slate-400">
                                  Xuất thân:{' '}
                                </span>
                                {entry.origin}
                              </div>
                            )}
                            {entry.techniquesOrBloodline && (
                              <div className="text-slate-200 leading-relaxed">
                                <span className="font-semibold text-slate-400">
                                  Công pháp / Huyết mạch / Pháp bảo:{' '}
                                </span>
                                {entry.techniquesOrBloodline}
                              </div>
                            )}
                            {entry.deeds && (
                              <div className="text-slate-200 leading-relaxed">
                                <span className="font-semibold text-slate-400">
                                  Chiến tích nổi bật:{' '}
                                </span>
                                {entry.deeds}
                              </div>
                            )}
                            {entry.latestActivity && (
                              <div className="text-amber-100/90 leading-relaxed">
                                <span className="font-semibold text-amber-300/90">
                                  Động thái / Tin đồn gần nhất:{' '}
                                </span>
                                {entry.latestActivity}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-400 tabular-nums">
                              <div>
                                {typeof entry.powerScore === 'number' &&
                                  `Điểm thực lực: ${entry.powerScore}`}
                                {typeof entry.powerScore === 'number' &&
                                  typeof entry.fameScore === 'number' &&
                                  ' · '}
                                {typeof entry.fameScore === 'number' &&
                                  `Điểm danh vọng: ${entry.fameScore}`}
                                {entry.lastUpdatedClock &&
                                  ` · Cập nhật: ${entry.lastUpdatedClock}`}
                              </div>
                              {onUnlockRankingIntel &&
                                intelLocationStatus?.canUnlockIntel &&
                                !entry.isMc && (
                                  <button
                                    type="button"
                                    disabled={isUnlockingThis || Boolean(rankingAiBusy)}
                                    onClick={() => handleTriggerUnlockIntel(entry)}
                                    className="inline-flex min-h-[26px] items-center gap-1 rounded-md bg-sky-500/15 px-2 text-[10px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/25 whitespace-nowrap"
                                  >
                                    {isUnlockingThis ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-3 w-3" />
                                    )}
                                    <span>
                                      {isUnlockingThis
                                        ? 'Đang dò la...'
                                        : 'Nghe ngóng tin mới'}
                                    </span>
                                  </button>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bảng thông tin chi tiết vật phẩm Phong Vật Chí (Đặc biệt nổi bật section Nguyên liệu rèn đúc cho Thần binh) */}
      {selectedWuxiaDetailItemId &&
        (() => {
          const detailItem = findWuxiaCatalogItemById(selectedWuxiaDetailItemId);
          if (!detailItem) return null;
          const dq = getInventoryQualityMeta(detailItem.quality, 'wuxia');
          const detailSlot = detailItem.equipSlot
            ? getEquipmentSlotMeta(detailItem.equipSlot, 'wuxia')
            : null;
          const modalInventory = (profile.inventory || []).filter(
            (inv) => inv.quantity > 0,
          );
          const detailOwnedQty = modalInventory
            .filter(
              (inv) =>
                inv.name.trim().toLowerCase() ===
                detailItem.name.trim().toLowerCase(),
            )
            .reduce((sum, inv) => sum + inv.quantity, 0);
          const detailBonus = detailItem.equipSlot
            ? getEquipmentItemBonuses(
                {
                  name: detailItem.name,
                  quality: detailItem.quality,
                  category: detailItem.category,
                  description: detailItem.description,
                  equipSlot: detailItem.equipSlot,
                },
                detailItem.equipSlot,
                'wuxia',
              )
            : null;
          const detailForging = getWuxiaForgingSuggestion(
            detailItem.id,
            modalInventory,
          );

          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Thông tin chi tiết ${detailItem.name}`}
              className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-2 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setSelectedWuxiaDetailItemId(null)}
            >
              <div
                className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#0b1322] p-4 shadow-2xl ring-1 ring-inset ring-amber-400/35"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dq.hasSparkle && (
                        <Sparkles
                          className={`h-4 w-4 shrink-0 item-twinkle-star ${dq.accentDotClass}`}
                        />
                      )}
                      <h3
                        className={`text-base font-bold leading-snug ${dq.nameClass}`}
                      >
                        {detailItem.name}
                      </h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold ring-1 ring-inset ${dq.cardClass} ${dq.textClass}`}
                      >
                        {dq.label}
                      </span>
                      <span className="text-slate-400">
                        {getInventoryCategoryLabel(detailItem.category, 'wuxia')}
                      </span>
                      {detailSlot && (
                        <span className="text-sky-300">
                          · Ô {detailSlot.label}
                        </span>
                      )}
                      {detailOwnedQty > 0 ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/40 tabular-nums">
                          Đang có x{detailOwnedQty} trong túi
                        </span>
                      ) : (
                        <span className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 ring-1 ring-inset ring-white/10">
                          Chưa sở hữu
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWuxiaDetailItemId(null)}
                    aria-label="Đóng chi tiết vật phẩm"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-300 hover:bg-white/[0.14] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Item Description & Stats */}
                <div className="mt-3 space-y-2.5">
                  <p className="text-xs leading-relaxed text-slate-200/95">
                    {detailItem.description}
                  </p>
                  {detailBonus?.summary && (
                    <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[11.5px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/25 tabular-nums">
                      Chỉ số khi trang bị: {detailBonus.summary}
                    </div>
                  )}
                  {detailItem.prestigeCue && (
                    <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/90 ring-1 ring-inset ring-amber-400/25">
                      <span className="font-semibold text-amber-300">
                        Phản ứng giang hồ / NPC:{' '}
                      </span>
                      {detailItem.prestigeCue}
                    </div>
                  )}

                  {/* Section Nguyên liệu rèn đúc */}
                  {detailForging && (
                    <div className="space-y-2.5 rounded-xl bg-[#070e1a] p-3 ring-1 ring-inset ring-amber-400/30">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Hammer className="h-4 w-4 text-amber-300" />
                          <span className="text-xs font-bold uppercase tracking-wide text-amber-200">
                            Nguyên liệu rèn đúc
                          </span>
                        </div>
                        <span className="text-[10.5px] text-slate-400">
                          {detailForging.recipe.disciplineLabel}
                        </span>
                      </div>

                      <p className="text-[11px] leading-snug text-slate-300">
                        Danh sách khoáng thạch và phụ liệu cần thiết để rèn đúc / nâng cấp{' '}
                        <span className="font-semibold text-white">
                          {detailItem.name}
                        </span>
                        :
                      </p>

                      {detailForging.upgradeBases.length > 0 && (
                        <div className="space-y-1 rounded-lg bg-white/[0.03] p-2 ring-1 ring-inset ring-white/[0.07]">
                          <div className="text-[10.5px] font-semibold text-slate-300">
                            Phôi binh khí nâng cấp tham khảo
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {detailForging.upgradeBases.map((base) => (
                              <span
                                key={base.id}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${
                                  base.owned
                                    ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/35'
                                    : 'bg-rose-500/15 text-rose-100 ring-rose-400/40'
                                }`}
                              >
                                <span>{base.name}</span>
                                <span className="font-bold">
                                  {base.owned ? '✓ Đã có' : '· Chưa có'}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mineral Ores & Materials Checklist */}
                      <div className="space-y-1.5">
                        {detailForging.materials.map((m) => {
                          const isMissing = m.missing > 0;
                          const oreMeta = m.quality
                            ? getInventoryQualityMeta(m.quality, 'wuxia')
                            : null;
                          const catalogOre = m.catalogItemId
                            ? findWuxiaCatalogItemById(m.catalogItemId)
                            : undefined;
                          return (
                            <div
                              key={m.label}
                              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ring-1 ring-inset transition-colors ${
                                isMissing
                                  ? 'bg-rose-500/15 ring-rose-400/50 shadow-[0_0_12px_rgba(244,63,94,0.16)]'
                                  : 'bg-emerald-500/10 ring-emerald-400/30'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`text-xs font-bold ${
                                      isMissing
                                        ? 'text-rose-100'
                                        : oreMeta?.nameClass || 'text-emerald-100'
                                    }`}
                                  >
                                    {m.label}
                                  </span>
                                  {m.isOre && (
                                    <span className="rounded bg-white/[0.08] px-1.5 py-0.2 text-[9.5px] font-medium text-sky-200">
                                      Khoáng thạch
                                    </span>
                                  )}
                                  {oreMeta && (
                                    <span
                                      className={`text-[10px] font-semibold ${oreMeta.textClass}`}
                                    >
                                      {oreMeta.shortLabel}
                                    </span>
                                  )}
                                </div>
                                {m.description && (
                                  <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                                    {m.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <span
                                  className={`text-[11px] font-bold tabular-nums ${
                                    isMissing
                                      ? 'text-rose-200'
                                      : 'text-emerald-200'
                                  }`}
                                >
                                  Túi đồ: {m.have}/{m.need}
                                </span>
                                <div className="flex items-center gap-1">
                                  {isMissing ? (
                                    <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-inset ring-rose-300/60 tabular-nums">
                                      Thiếu {m.missing}
                                    </span>
                                  ) : (
                                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/40">
                                      Đủ ✓
                                    </span>
                                  )}
                                  {isMissing && catalogOre && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAddWuxiaCatalogItem({
                                          ...catalogOre,
                                          defaultQuantity: m.missing,
                                        })
                                      }
                                      title={`Thêm nhanh ${m.missing} ${catalogOre.name} vào túi`}
                                      className="inline-flex min-h-[22px] items-center gap-0.5 rounded bg-white/[0.1] px-1.5 text-[10px] font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.18] hover:bg-white/[0.2]"
                                    >
                                      <Plus className="h-2.5 w-2.5" />
                                      <span>{m.missing}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Silver cost row */}
                        <div
                          className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ring-1 ring-inset ${
                            detailForging.silverMissing > 0
                              ? 'bg-amber-500/14 ring-amber-400/45'
                              : 'bg-emerald-500/10 ring-emerald-400/30'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-100">
                            <Coins className="h-3.5 w-3.5 text-amber-300" />
                            <span>Công rèn ngân lượng</span>
                          </div>
                          <div className="flex items-center gap-1.5 tabular-nums">
                            <span className="text-[11px] font-bold text-amber-100">
                              {detailForging.silverHave}/{detailForging.silverCost}{' '}
                              lượng
                            </span>
                            {detailForging.silverMissing > 0 ? (
                              <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-50 ring-1 ring-inset ring-amber-300/60">
                                Thiếu {detailForging.silverMissing} lượng
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/40">
                                Đủ ✓
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Missing Summary Callout */}
                      {detailForging.missingLines.length > 0 ? (
                        <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-[11px] leading-relaxed text-rose-100 ring-1 ring-inset ring-rose-400/45">
                          <span className="font-bold text-rose-200">
                            Còn thiếu trong túi đồ để rèn / nâng cấp:{' '}
                          </span>
                          {detailForging.missingLines.join(' · ')}
                        </div>
                      ) : (
                        <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/40">
                          Đã đủ toàn bộ khoáng thạch và ngân lượng — có thể rèn đúc ngay!
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Action Footer */}
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] pt-3">
                  {detailForging && (
                    <>
                      <button
                        type="button"
                        disabled={!detailForging.canCraft}
                        onClick={() =>
                          handleCraftWuxiaRecipe(detailForging.recipe.id, false)
                        }
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                          detailForging.canCraft
                            ? 'bg-emerald-500/25 text-emerald-100 ring-1 ring-inset ring-emerald-400/50 hover:bg-emerald-500/35'
                            : 'cursor-not-allowed bg-white/[0.04] text-slate-500 ring-1 ring-inset ring-white/[0.07]'
                        }`}
                      >
                        <Hammer className="h-3.5 w-3.5" />
                        <span>
                          {detailForging.canCraft
                            ? 'Rèn đúc ngay'
                            : 'Chưa đủ khoáng thạch'}
                        </span>
                      </button>
                      {detailForging.canCraft && onInsertStoryPrompt && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCraftWuxiaRecipe(detailForging.recipe.id, true);
                            setSelectedWuxiaDetailItemId(null);
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-500/30 whitespace-nowrap"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Rèn &amp; Kể truyện</span>
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddWuxiaCatalogItem(detailItem)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/45 hover:bg-amber-500/30 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm vào túi (+{detailItem.defaultQuantity})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWuxiaDetailItemId(null)}
                    className="inline-flex min-h-[36px] items-center rounded-lg bg-white/[0.06] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.12] hover:bg-white/[0.14]"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
