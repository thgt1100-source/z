export type ViewName =
  | 'lobby'
  | 'setup'
  | 'chat'
  | 'config'
  | 'companion'
  | 'preset'
  | 'context'
  | 'data';

export type WorldGenreId =
  | 'slice_of_life'
  | 'showbiz'
  | 'ancient'
  | 'xianxia'
  | 'xuanhuan'
  | 'apocalypse'
  | 'urban'
  | 'fantasy'
  | 'scifi';

export type DramaLevel = 'chill' | 'balanced' | 'intense';

export type WorldLaunchMode = 'ai_opening' | 'direct_chat';

export type ApiProtocol = 'openai' | 'auto' | 'gemini';
export type McSourceMode = 'custom' | 'canon';
export type McRoleType = 'transmigrator' | 'powerhouse' | 'custom';
export type DnSubTab = 'mc' | 'world' | 'npcs' | 'portraits' | 'relations';

export interface SafetySetting {
  category: string;
  threshold: string;
}

export type PresetGroupId =
  | 'style'
  | 'personal'
  | 'perspective'
  | 'intimacy'
  | 'appearance'
  | 'core';

export interface PresetModule {
  id: string;
  name: string;
  enabled: boolean;
  content: string;
  group?: PresetGroupId;
  isCustom?: boolean;
  isPersonalSlot?: boolean;
  isEmbeddedDefault?: boolean;
}

export type StoryImageTargetMode = 'scene' | 'npc' | 'mc' | 'custom';

export type BuiltInStoryImageStyle =
  | 'live_action_cinema'
  | 'neo_guofeng_impasto'
  | 'classic_impasto'
  | 'oil_painting'
  | 'anime_cg'
  | 'refined_realistic_cg'
  | 'rmji_high_cg'
  | 'cinema_still_ukiyoe'
  | 'cinema_still_vfx'
  | 'erliangjiu_manhua'
  | 'xianxia_exquisite'
  | 'xianxia_ink_wash'
  | '3d_ukiyoe'
  | 'xianxia_jade_flat'
  | 'character_sheet_multi'
  // Legacy IDs preserved for backward compatibility with older saves
  | 'cinematic'
  | 'anime'
  | 'watercolor'
  | 'realistic'
  | 'dark_fantasy'
  | 'custom';

export type StoryImageStyle = BuiltInStoryImageStyle | (string & {});

export type ImageCameraAngleId =
  | 'auto'
  | 'close_up'
  | 'medium_shot'
  | 'wide_shot'
  | 'low_angle'
  | 'high_angle'
  | 'over_shoulder'
  | 'dutch_angle';

export type ImageGridMode =
  | 'single'
  | 'grid_2'
  | 'grid_4'
  | 'character_sheet';

export type ImageGenerationMode =
  | 'scene'
  | 'portrait'
  | 'cinema_frame'
  | 'illustration'
  | 'custom';

export interface StoryImageStylePreset {
  id: StoryImageStyle;
  label: string;
  category: string;
  description: string;
  promptGuide: string;
  promptHint: string;
  isCustom?: boolean;
  isEmbeddedDefault?: boolean;
}

export interface ImageCameraAnglePreset {
  id: ImageCameraAngleId;
  label: string;
  description: string;
  promptGuide: string;
}

export type StoryImagePosition = 'opening' | 'middle' | 'ending';

export const STORY_IMAGE_POSITIONS: StoryImagePosition[] = [
  'opening',
  'middle',
  'ending',
];

export const STORY_IMAGE_POSITION_META: Record<
  StoryImagePosition,
  {
    label: string;
    shortLabel: string;
    badgeLabel: string;
    description: string;
    fileSlug: string;
  }
> = {
  opening: {
    label: 'Khung đầu · Mở cảnh',
    shortLabel: 'Khung đầu',
    badgeLabel: 'Mở cảnh',
    description: 'Khung cảnh, không gian, thời điểm và ánh sáng mở đầu lượt truyện.',
    fileSlug: 'khung_dau',
  },
  middle: {
    label: 'Khung giữa · Tương tác',
    shortLabel: 'Khung giữa',
    badgeLabel: 'Tương tác',
    description: 'Hành động, biểu cảm hoặc tương tác giữa các nhân vật theo diễn biến.',
    fileSlug: 'khung_giua',
  },
  ending: {
    label: 'Khung cuối · Kết mở',
    shortLabel: 'Khung cuối',
    badgeLabel: 'Kết mở',
    description: 'Khoảnh khắc kết mở, góc nhìn hoặc chi tiết gợi mở cho lựa chọn kế tiếp.',
    fileSlug: 'khung_cuoi',
  },
};

export type AiTaskSlotId =
  | 'suggestions'
  | 'referenceCheck'
  | 'fanfic'
  | 'utility';

export interface AiTaskModelSlots {
  /** Model riêng cho nút AI gợi ý lượt đi */
  suggestions?: string;
  /** Model riêng (hỗ trợ Vision) cho Đối chiếu ảnh mẫu người thật & Khóa nhận diện */
  referenceCheck?: string;
  /** Model riêng cho AI Đồng nhân (Phân tích tác phẩm, Hành trình Anime, Tra cứu ĐN) */
  fanfic?: string;
  /** Model riêng cho các tác vụ AI phụ khác (Trí nhớ/Tóm tắt, Hồ sơ NPC, Dựng thế giới) */
  utility?: string;
}

export interface ReferenceComparisonResult {
  status: 'verified' | 'error';
  overallScore?: number;
  faceMatchScore?: number;
  ageAccuracyScore?: number;
  skinRealismScore?: number;
  hairBeardScore?: number;
  verdict?: 'match' | 'partial' | 'mismatch';
  summary?: string;
  matchedTraits?: string[];
  mismatches?: string[];
  suggestedPromptFix?: string;
  /** Structured concise English per-aspect correction directives extracted from the comparison. */
  correctionTags?: string[];
  /** Whether to inject this comparison's targeted fixes into the next image generation prompt (defaults to true). */
  applyToPrompt?: boolean;
  targetCharacterName?: string;
  modelUsed: string;
  usedCustomSlot?: boolean;
  elapsedMs: number;
  comparedAt: number;
  sourceSig?: string;
  errorMessage?: string;
}

export interface StoryImageItem {
  id: string;
  position: StoryImagePosition;
  imageData?: string;
  prompt: string;
  subject?: string;
  status?: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
  referenceComparison?: ReferenceComparisonResult;
  /** Exact targeted comparison adjustment fragment that was injected into this beat's generation prompt. */
  appliedComparisonPatch?: string;
}

export interface StoryImageBeatPrompts {
  opening?: string;
  middle?: string;
  ending?: string;
}

export interface StoryImageGenerationProgress {
  turnId: string;
  currentPosition: StoryImagePosition;
  currentIndex: number;
  total: number;
  positions: StoryImagePosition[];
}

export interface PortraitGenProgress {
  portraitId: string;
  phase: 'preparing' | 'prompting' | 'generating' | 'retrying' | 'downloading';
  label: string;
  provider: ImageProvider;
  attempt: number;
  maxAttempts: number;
  startedAt: number;
  timeoutSec: number;
}

export function getStoryImagePositionsForCount(
  maxImagesPerTurn?: number,
): StoryImagePosition[] {
  const n = Number(maxImagesPerTurn);
  if (n === 1) return ['opening'];
  if (n === 2) return ['opening', 'ending'];
  return ['opening', 'middle', 'ending'];
}

export function resolveEnabledStoryImagePositions(
  config?: Pick<
    StoryImageConfig,
    'enabledPositions' | 'maxImagesPerTurn'
  > | null,
): StoryImagePosition[] {
  if (Array.isArray(config?.enabledPositions) && config.enabledPositions.length > 0) {
    const allowed = new Set<StoryImagePosition>(config.enabledPositions);
    const ordered = STORY_IMAGE_POSITIONS.filter((pos) => allowed.has(pos));
    if (ordered.length > 0) return ordered;
  }
  return getStoryImagePositionsForCount(config?.maxImagesPerTurn);
}

export interface StoryImageConfig {
  enabled: boolean;
  autoGenerate: boolean;
  targetMode: StoryImageTargetMode;
  selectedNpcId: string;
  customSubject: string;
  stylePreset: StoryImageStyle;
  size: string;
  cameraAngle?: ImageCameraAngleId;
  customStyles?: StoryImageStylePreset[];
  /**
   * Maps `style:<styleId>` or `angle:<angleId>` to either:
   * - `portrait:<portraitId>` (zero-overhead reference into PortraitBank)
   * - compressed data URL thumbnail (<= 420px WebP/JPEG)
   */
  sampleImages?: Record<string, string>;
  promptTemplate?: string;
  imageCount?: number;
  /** Maximum beat-positioned images generated per story turn (1 = opening, 2 = opening+ending, 3 = opening+middle+ending). */
  maxImagesPerTurn?: 1 | 2 | 3;
  /** Explicit beat slots enabled for generation so users only generate frames they need. */
  enabledPositions?: StoryImagePosition[];
  /** Prefer solo clear-face portrait/medium framing over 2+ person or back-view/distant shots that warp faces. */
  preferClearFaceSolo?: boolean;
  /** Automatically pull & lock character identity (youthful age, face, hairstyle, build) from avatar/portrait profile. */
  lockAvatarIdentity?: boolean;
  /** Automatically apply verified reference-comparison fixes into portrait & story image prompts (defaults to true). */
  applyComparisonToPrompt?: boolean;
  imageGridMode?: ImageGridMode;
  imageGenerationMode?: ImageGenerationMode;
  deletedEmbeddedStyleIds?: string[];
}

export interface Turn {
  id: string;
  user: string;
  assistant: string;
  rawAssistant?: string;
  imageData?: string;
  imageList?: string[];
  imageCaption?: string;
  storyImageData?: string;
  storyImagePrompt?: string;
  storyImageSubject?: string;
  storyImages?: StoryImageItem[];
  storyImagePrompts?: StoryImageBeatPrompts;
  createdAt?: number;
  durationMs?: number;
  storyClockSnapshot?: string;
}

export function getTurnStoryImages(
  turn?: Pick<
    Turn,
    | 'id'
    | 'storyImages'
    | 'storyImageData'
    | 'storyImagePrompt'
    | 'storyImageSubject'
  > | null,
): StoryImageItem[] {
  if (!turn) return [];
  const validPos = new Set<StoryImagePosition>(STORY_IMAGE_POSITIONS);
  if (Array.isArray(turn.storyImages) && turn.storyImages.length > 0) {
    const byPos = new Map<StoryImagePosition, StoryImageItem>();
    for (const rawItem of turn.storyImages) {
      if (!rawItem || !validPos.has(rawItem.position)) continue;
      const imageData =
        typeof rawItem.imageData === 'string' && rawItem.imageData.trim()
          ? rawItem.imageData.trim()
          : undefined;
      const status =
        rawItem.status || (imageData ? 'done' : undefined);
      if (!imageData && !status) continue;
      byPos.set(rawItem.position, {
        id: rawItem.id || `${turn.id || 'turn'}_${rawItem.position}`,
        position: rawItem.position,
        ...(imageData ? { imageData } : {}),
        prompt: typeof rawItem.prompt === 'string' ? rawItem.prompt : '',
        ...(rawItem.subject ? { subject: rawItem.subject } : {}),
        ...(status ? { status } : {}),
        ...(rawItem.error ? { error: rawItem.error } : {}),
        ...(rawItem.referenceComparison
          ? { referenceComparison: rawItem.referenceComparison }
          : {}),
        ...(typeof rawItem.appliedComparisonPatch === 'string' &&
        rawItem.appliedComparisonPatch.trim()
          ? { appliedComparisonPatch: rawItem.appliedComparisonPatch.trim() }
          : {}),
      });
    }
    return STORY_IMAGE_POSITIONS.map((pos) => byPos.get(pos)).filter(
      (x): x is StoryImageItem => Boolean(x),
    );
  }
  const legacySrc =
    typeof turn.storyImageData === 'string' ? turn.storyImageData.trim() : '';
  if (!legacySrc) return [];
  return [
    {
      id: `${turn.id || 'turn'}_opening`,
      position: 'opening',
      imageData: legacySrc,
      prompt: turn.storyImagePrompt || '',
      subject: turn.storyImageSubject || STORY_IMAGE_POSITION_META.opening.label,
      status: 'done',
    },
  ];
}

export const MAX_PENDING_CHAT_IMAGES = 5;

export function getTurnAttachedImages(
  turn?: Pick<Turn, 'imageData' | 'imageList'> | null,
): string[] {
  if (!turn) return [];
  const rawList = Array.isArray(turn.imageList)
    ? turn.imageList
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim())
    : [];
  if (rawList.length > 0) {
    return rawList;
  }
  const single = typeof turn.imageData === 'string' ? turn.imageData.trim() : '';
  return single ? [single] : [];
}

export interface PlayerInfo {
  name: string;
  pronoun: string;
  role?: string;
  description?: string;
  absentAtStart?: boolean;
}

export interface WorldInfo {
  name: string;
  genre?: WorldGenreId;
  genreLabel?: string;
  setting?: string;
  rules?: string;
  atmosphere?: string;
  dramaLevel?: DramaLevel;
  eraLabel?: string;
  openingScenario?: string;
}

export interface WorldSetupNpcDraft {
  id: string;
  name: string;
  role: string;
  personality: string;
  appearance: string;
  initialLocation?: string;
  initialMood?: string;
  privateSecret?: string;
}

export interface WorldSetupPayload {
  worldName: string;
  genre: WorldGenreId;
  genreLabel: string;
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
    autoAdvance: boolean;
  };
  mc: {
    name: string;
    pronoun: string;
    role: string;
    description: string;
    absentAtStart: boolean;
  };
  npcs: WorldSetupNpcDraft[];
  syncPortraitsAndStates: boolean;
  openingScenario: string;
  launchMode: WorldLaunchMode;
  enableMartialSystem?: boolean;
}

export type MemoryEntryCategory =
  | 'event'
  | 'relationship'
  | 'promise'
  | 'timeline'
  | 'detail';

export type MemoryImportance = 1 | 2 | 3;

export type MemoryEntrySource = 'ai' | 'local' | 'manual' | 'compacted';

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  category: MemoryEntryCategory;
  turnIndex?: number;
  pinned: boolean;
  entities?: string[];
  importance?: MemoryImportance;
  keywords?: string[];
  source?: MemoryEntrySource;
  updatedAt: number;
}

export interface CharacterStateSnapshot {
  id: string;
  name: string;
  isMc: boolean;
  location: string;
  mood: string;
  status: string;
  lastTurnIndex?: number;
  updatedAt: number;
}

export interface RollingSummaryData {
  content: string;
  summarizedUpToTurn: number;
  updatedAt: number;
}

export interface StoryClockState {
  enabled: boolean;
  autoAdvance: boolean;
  initialized: boolean;
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  eraLabel?: string;
  lastDeltaMinutes?: number;
  lastAdvanceReason?: string;
  lastTurnIndex?: number;
  updatedAt?: number;
}

export type CultivationSystemKind = 'xianxia' | 'xuanhuan' | 'wuxia';

export type CultivationSubStage =
  | 'Sơ kỳ'
  | 'Trung kỳ'
  | 'Hậu kỳ'
  | 'Đỉnh phong';

export type TechniqueCategory = 'mental' | 'martial' | 'movement' | 'secret';

export type TechniqueTier =
  | 'pham'
  | 'linh'
  | 'huyen'
  | 'dia'
  | 'thien'
  | 'chiton';

export type MasteryLockConditionKind =
  | 'combat'
  | 'realm'
  | 'insight'
  | 'resource'
  | 'meridian';

export interface TechniqueMove {
  id: string;
  name: string;
  description?: string;
  level: number;
  maxLevel: number;
  mastery: number; // 0..100 (%)
  /** Milestone caps already broken at the current move level (e.g. [50], [50, 80]). */
  unlockedMilestones?: number[];
  /** Optional custom lock condition category for gameplay unlock cues. */
  lockConditionKind?: MasteryLockConditionKind;
  /** Optional custom reason shown when this move hits a bottleneck. */
  customLockReason?: string;
  /** Optional custom unlock requirement shown when this move is locked. */
  customUnlockCondition?: string;
  /** Optional minimum realmIndex required to break the 99% bottleneck of this move. */
  requiredRealmIndex?: number;
}

export interface CultivationTechnique {
  id: string;
  name: string;
  category: TechniqueCategory;
  tier: TechniqueTier;
  level: number;
  maxLevel: number;
  mastery: number; // 0..100 (%)
  isActiveTraining: boolean;
  description?: string;
  moves?: TechniqueMove[];
  /** Milestone caps already broken at the current technique layer (e.g. [50], [50, 80]). */
  unlockedMilestones?: number[];
  /** Optional custom lock condition category for gameplay unlock cues. */
  lockConditionKind?: MasteryLockConditionKind;
  /** Optional custom reason shown when this technique hits a bottleneck. */
  customLockReason?: string;
  /** Optional custom unlock requirement shown when this technique is locked. */
  customUnlockCondition?: string;
  /** Optional minimum realmIndex required to break the 99% layer bottleneck. */
  requiredRealmIndex?: number;
}

export type InventoryItemQuality =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'immortal';

export type InventoryItemCategory =
  | 'consumable'
  | 'weapon'
  | 'outfit'
  | 'herb'
  | 'talisman'
  | 'material'
  | 'misc';

export type EquipmentSlotId =
  | 'weapon'
  | 'armor'
  | 'accessory'
  | 'relic'
  | 'soul_vessel'
  | 'array_treasure';

export type EquipmentMap = Partial<Record<EquipmentSlotId, string>>;

export interface CharacterVitalsState {
  hp?: number;
  qi?: number;
  spirit?: number;
  /** Accumulated pill toxicity / medicinal residue (0..100). */
  pillToxicity?: number;
  /** Breakthrough bottleneck assistance / pressure reduction (0..100). */
  breakthroughEase?: number;
  /** Permanent bonuses gained from body-refining / spirit-nourishing pills & treasures. */
  bonusAtk?: number;
  bonusDef?: number;
  bonusAgi?: number;
  bonusInsight?: number;
  /** Character fame / reputation score. */
  fame?: number;
  /** Active temporary buffs from pills, talismans, or treasures. */
  activeBuffs?: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  quality: InventoryItemQuality;
  category: InventoryItemCategory;
  description?: string;
  /** Optional explicit equipment slot override; inferred automatically when omitted. */
  equipSlot?: EquipmentSlotId;
}

export type CultivationRankingBoard =
  | 'thien'
  | 'dia'
  | 'nhan'
  | 'thien_kieu';

export type ProdigyTier = 'nghich_thien' | 'tre_the_gia';

export interface CultivationRankingEntry {
  id: string;
  board: CultivationRankingBoard;
  rank: number;
  name: string;
  realm: string;
  combatPower: string;
  faction: string;
  stance: string;
  prodigyTier?: ProdigyTier;
  scopeLabel?: string;
  isVeteran?: boolean;
  intelUnlocked?: boolean;
  rumorSummary?: string;
  origin?: string;
  techniquesOrBloodline?: string;
  deeds?: string;
  latestActivity?: string;
  powerScore?: number;
  fameScore?: number;
  previousRank?: number;
  isMc?: boolean;
  lastUpdatedClock?: string;
  updatedAt?: number;
}

export interface SpiritRootProfile {
  /** Loại linh căn (VD: Ngũ Hành Tạp Linh Căn, Song Linh Căn, Thiên Linh Căn...). */
  name: string;
  /** Thuộc tính nguyên tố / mạch khí (VD: Kim · Mộc · Thủy · Hỏa · Thổ, Băng · Lôi...). */
  elements?: string;
  /** Phẩm chất linh căn (đồng bộ thang phẩm cấp common..immortal). */
  grade: InventoryItemQuality;
  /** Độ thuần khiết linh căn (0–100%). */
  purity: number;
  /** Độ tương thích & tốc độ dẫn khí. */
  affinityNote: string;
}

export interface PhysiqueProfile {
  /** Tên thể chất (VD: Phàm Thể, Tẩy Tủy Linh Thể, Tiên Thiên Đạo Thể...). */
  name: string;
  /** Phẩm chất thể chất (common..immortal). */
  grade: InventoryItemQuality;
  /** Mức độ tôi luyện / khai phá thể chất (0–100%). */
  refinement: number;
  /** Trạng thái hiện tại (VD: Chưa tẩy tủy, Kinh cốt thanh thông, Đang thức tỉnh...). */
  stateLabel: string;
  /** Đặc tính nổi bật của thể chất. */
  traits: string;
}

export interface FoundationProfile {
  /** Danh xưng mức độ căn cơ (VD: Căn cơ sơ thành, Đạo cơ vững chắc, Tiên cơ vô cấu...). */
  label: string;
  /** Phẩm chất nền tảng căn cơ (common..immortal). */
  grade: InventoryItemQuality;
  /** Độ vững chắc của kinh mạch / đan điền / đạo cơ (0–100%). */
  solidity: number;
  /** Tạp chất / uế khí còn tồn dư trong kinh mạch & đan điền (0–100%, càng thấp càng sạch). */
  impurity: number;
  /** Đánh giá nền tảng chịu tải khi xung kích bình cảnh / thiên kiếp. */
  resilienceNote: string;
}

export interface CultivationConstitutionState {
  spiritRoot: SpiritRootProfile;
  physique: PhysiqueProfile;
  foundation: FoundationProfile;
  /** Ghi chú biến đổi gần nhất từ đan dược / linh dịch / cơ duyên trong truyện. */
  lastEvolutionNote?: string;
  updatedAt?: number;
}

export interface BreakthroughOutcomeRecord {
  outcome: 'success' | 'failed';
  severity?: 'minor_setback' | 'meridian_backlash' | 'severe_backlash';
  chancePercent: number;
  roll?: number;
  fromRealm: string;
  targetRealm: string;
  assistItemName?: string;
  summary: string;
  consequences: string[];
  storyPrompt: string;
  timestamp: number;
}

export type WuxiaElementPath = 'duong_cuong' | 'am_nhu' | 'thai_cuc';

export type WuxiaSanctuaryKind =
  | 'none'
  | 'thuy'
  | 'son'
  | 'lam'
  | 'tuyet'
  | 'dong';

export type WuxiaInnerArtOrigin = 'mon_phai' | 'giang_ho' | 'co_pho';

export type WuxiaSectGrade =
  | 'nhap_mon'
  | 'trung_cap'
  | 'tran_phai'
  | 'giang_ho_ky_cong';

export interface WuxiaMartialState {
  /** Tầng nội công hiện tại (1..86), đồng bộ với bảng 21 tôn hiệu Cửu Âm. */
  innerLayer: number;
  /** Mốc tầng tối đa / trần tinh thâm riêng của bộ nội công đang tu (VD: 18–22 Nhập môn, 31–36 Trung cấp, 47–53 Trấn phái, 49/64/75/86 Giang hồ & Cổ phổ). */
  innerMaxLayer: number;
  /** Tên bộ nội công giang hồ / môn phái / cổ phổ đang vận chuyển chính. */
  activeInnerArtName: string;
  /** Nguồn gốc bộ nội công: môn phái / giang hồ / cổ phổ. */
  innerArtOrigin?: WuxiaInnerArtOrigin;
  /** Cấp bậc trần nội công (nhập môn / trung cấp / trấn phái / giang hồ kỳ công). */
  innerArtGrade?: WuxiaSectGrade;
  /** Tên môn phái (nếu là nội công môn phái). */
  sectName?: string;
  /** Lộ tuyến thuộc tính nội công: Dương Cương / Âm Nhu / Thái Cực. */
  elementPath: WuxiaElementPath;
  /** Số kinh mạch chính đã đả thông (0..8 — Bát Mạch Kỳ Kinh). */
  meridiansOpened: number;
  /** Phúc địa / Thánh địa ngũ hành đang bế quan (tùy chọn). */
  activeSanctuary?: WuxiaSanctuaryKind;
}

export interface CultivationProfile {
  schemaVersion?: number;
  enabled: boolean;
  systemKind: CultivationSystemKind;
  realmIndex: number;
  realmName: string;
  majorRealm?: string;
  subStage?: CultivationSubStage;
  minorTier?: number;
  energyLabel: string;
  exp: number;
  maxExp: number;
  overflowExp?: number;
  readyToBreakthrough: boolean;
  autoProgressByClock: boolean;
  quickTrainLocked?: boolean;
  bagName: string;
  combatPowerNote?: string;
  techniques: CultivationTechnique[];
  inventory: InventoryItem[];
  equipment?: EquipmentMap;
  vitals?: CharacterVitalsState;
  constitution?: CultivationConstitutionState;
  /** Trạng thái nội công giang hồ & tôn hiệu Cửu Âm (chỉ dùng cho Kiếm hiệp). */
  wuxiaState?: WuxiaMartialState;
  /** Giảm hiệu ứng lấp lánh / ánh sáng động cho cảnh giới trên máy cấu hình thấp hoặc thích giao diện dịu mắt. */
  reduceRealmEffects?: boolean;
  rankings?: CultivationRankingEntry[];
  lastGainSummary?: string;
  lastSeclusionSummary?: string;
  lastItemFeedback?: string;
  lastBreakthroughNote?: string;
  lastBreakthroughOutcome?: BreakthroughOutcomeRecord;
  lastUpdatedAt?: number;
}

export interface MemoryManagerConfig {
  enabled: boolean;
  autoMemory: boolean;
  autoStateTracker: boolean;
  autoRollingSummary: boolean;
  entries: MemoryEntry[];
  characterStates: CharacterStateSnapshot[];
  rollingSummary: RollingSummaryData;
  storyClock?: StoryClockState;
  cultivation?: CultivationProfile;
}

export interface CharacterIdentityLock {
  /** Locked gender label (e.g. "Nam", "Nữ", "male", "female"). */
  gender?: string;
  /** Fixed facial bone structure, eyes, eyebrows, nose, lips, jawline, skin tone. */
  facialFeatures?: string;
  /** Fixed hairstyle, parting, length, and hair color. */
  hairstyle?: string;
  /** Signature personal aesthetic, vibe, or recurring outfit/accessory motif. */
  signatureStyle?: string;
  /** Fixed image-generation identity tags (English comma-separated anchor tags). */
  fixedTags?: string;
}

export interface CharacterPortrait {
  id: string;
  name: string;
  role: string;
  age?: string;
  birthday?: string;
  fashionStyle?: string;
  appearance: string;
  /** Real-person or face reference photo uploaded by user; prioritized for AI Vision cross-check before drawing. */
  referenceImageData?: string;
  /** Structured per-character identity lock (gender, facial features, hairstyle, signature style, fixed tags). */
  identityLock?: CharacterIdentityLock;
  /** Concise locked English identity traits (age, face, hair, build) extracted from avatar/reference photo or manually locked. */
  avatarVisualLock?: string;
  /** Fingerprint of referenceImageData/imageData used to generate avatarVisualLock so each photo is analyzed at most once. */
  avatarLockSourceSig?: string;
  /** Last real Vision API verification result comparing referenceImageData vs generated imageData. */
  lastReferenceComparison?: ReferenceComparisonResult;
  /** Exact targeted comparison adjustment fragment injected into this portrait's most recent prompt. */
  lastAppliedComparisonPatch?: string;
  personality?: string;
  relationships?: string;
  signature?: string;
  /** Vị trí hiện tại của nhân vật/NPC để cách ly nhận thức theo phân cảnh */
  currentLocation?: string;
  /** Bí mật riêng chỉ nhân vật/NPC này biết hoặc đang che giấu */
  privateSecret?: string;
  appearanceManual?: boolean;
  profileManual?: boolean;
  pinned?: boolean;
  aiAutoEnrichLocked?: boolean;
  isMc: boolean;
  npcId?: string;
  imageData?: string;
  prompt?: string;
  /** User-edited English portrait prompt override preserved verbatim during generation */
  customPrompt?: string;
  /** Opt-in flag to pull current story-turn pose/context into portrait prompt (default false to keep portrait profile clean) */
  useSceneContextInPortrait?: boolean;
  contextSnippet?: string;
  lastSeenTurnIndex?: number;
  autoGenerated?: boolean;
  updatedAt: number;
}

export type RelationshipGroupKind = 'family' | 'close_circle' | 'faction';

export type RelationshipLayerKind =
  | 'family'
  | 'close_circle'
  | 'faction'
  | 'personal';

export type RelationshipTone =
  | 'family'
  | 'intimate'
  | 'ally'
  | 'rival'
  | 'mystery'
  | 'neutral';

export interface RelationshipGroup {
  id: string;
  name: string;
  kind: RelationshipGroupKind;
  color: string;
  memberIds: string[];
  note?: string;
  updatedAt: number;
}

export interface RelationshipEdgeOverride {
  id: string;
  sourceId: string;
  targetId: string;
  status: 'manual' | 'deleted';
  tone?: RelationshipTone;
  layer?: RelationshipLayerKind;
  label?: string;
  note?: string;
  updatedAt: number;
}

export interface PortraitBankConfig {
  autoGenerateOnAppear: boolean;
  maxAutoPerTurn: number;
  includeMcAuto: boolean;
  portraits: CharacterPortrait[];
  relationshipGroups?: RelationshipGroup[];
  relationshipOverrides?: RelationshipEdgeOverride[];
}

export interface SaveSlot {
  id: string;
  name: string;
  savedAt: string;
  turns: Turn[];
  player: PlayerInfo;
  world: WorldInfo;
  memory?: MemoryManagerConfig;
  portraitBank?: PortraitBankConfig;
  context?: ContextConfig;
  tawaPreset?: TawaPreset;
}

export interface Checkpoint {
  savedAt: string;
  turns: Turn[];
  player: PlayerInfo;
  world: WorldInfo;
  memory?: MemoryManagerConfig;
  portraitBank?: PortraitBankConfig;
  context?: ContextConfig;
  activeCompanionId?: string;
  tawaPreset?: TawaPreset;
}

export type CompanionCreativePresetId =
  | 'domino_divergence'
  | 'storm_edge_observer'
  | 'tradeoff_anti_op'
  | 'canon_mc_friction';

export interface CompanionNpc {
  id: string;
  name: string;
  role: string;
  age?: string;
  birthday?: string;
  fashionStyle?: string;
  desc: string;
  personality?: string;
  appearance?: string;
  relationships?: string;
  signature?: string;
  /** Động cơ riêng & lập trường độc lập của NPC */
  agenda?: string;
  /** Điểm xung đột / ma sát tiềm năng với NVC hoặc các phe khác */
  friction?: string;
  /** Vị trí hiện tại của NPC (vị_trí_hiện_tại) */
  currentLocation?: string;
  /** Bí mật riêng của NPC (bí_mật_riêng) */
  privateSecret?: string;
  profileManual?: boolean;
}

export interface CanonCandidate {
  name: string;
  pronoun: string;
  gender: string;
  age: string;
  personality: string;
  appearance: string;
  role: string;
}

export interface CompanionMC {
  sourceMode?: McSourceMode;
  name: string;
  pronoun: string;
  roleType?: McRoleType;
  canonMcName?: string;
  originRole?: string;
  canonMcRelation?: string;
  gender: string;
  age: string;
  personality: string;
  appearance: string;
}

export interface AnimeJourneyPack {
  id: string;
  animeTitle: string;
  createdAt: string;
  updatedAt: string;
  toneAndAtmosphere: string;
  worldSetting: string;
  worldRules: string;
  journeyMilestones: string[];
  divergencePoints: string[];
  creativeDirection: string;
  npcs: CompanionNpc[];
  canonMcName?: string;
}

export interface CompanionProfile {
  id: string;
  name: string;
  role: string;
  sourceQuery: string;
  sourceContent: string;
  mc: CompanionMC;
  worldSetting: string;
  worldRules: string;
  /** Văn phong & không khí đặc trưng của bộ anime / nguyên tác */
  animeTone?: string;
  /** 3–4 mốc chặng hành trình theo mạch thế giới để chơi đi lại có tiến triển rõ ràng */
  journeyMilestones?: string[];
  /** Các preset sáng tạo đồng nhân đang được áp dụng */
  creativePresetIds?: CompanionCreativePresetId[];
  /** Định hướng sáng tạo Đồng nhân đưa vào ngữ cảnh & quy tắc kể truyện */
  creativeDirection?: string;
  /** 1–2+ Điểm rẽ nhánh / Biến số có thể bẻ lái dựa trên nguyên tác */
  divergencePoints?: string[];
  npcs: CompanionNpc[];
  canonCandidates?: CanonCandidate[];
  note: string;
}

export type ImageProvider = 'seedream' | 'comfyui' | 'custom' | 'latent';

export type CustomImageFormatMode = 'openai' | 'custom_json';

export function getImageProviderLabel(provider?: ImageProvider | null): string {
  if (provider === 'comfyui') return 'ComfyUI API';
  if (provider === 'custom') return 'Custom Image API';
  if (provider === 'latent') return 'Latent.moe (Họa Đồ AI)';
  return 'Seedream 5 Pro';
}

export interface ComfyUiNodeMapping {
  positiveNodeId?: string;
  negativeNodeId?: string;
  seedNodeId?: string;
  sizeNodeId?: string;
  outputNodeId?: string;
}

export interface ComfyUiWorkflowPreset {
  id: string;
  name: string;
  workflowJson: string;
  negativePrompt?: string;
  nodeMapping?: ComfyUiNodeMapping;
  notes?: string;
  updatedAt: number;
}

export interface AppConfig {
  proxyUrl: string;
  proxyKey: string;
  model: string;
  /** Optional dedicated model overrides per auxiliary AI task; falls back to main `model` when empty. */
  taskModels?: AiTaskModelSlots;
  apiProtocol: ApiProtocol;
  /** Route external Proxy API requests through /api/proxy on the backend to avoid browser CORS errors (defaults to true). */
  useServerProxy?: boolean;
  imageProvider?: ImageProvider;
  seedreamUrl: string;
  seedreamApiKey?: string;
  seedreamModel: string;
  seedreamSize?: string;
  seedreamPrompt?: string;
  comfyuiUrl?: string;
  comfyuiWorkflowJson?: string;
  comfyuiNegativePrompt?: string;
  comfyuiNodeMapping?: ComfyUiNodeMapping;
  comfyuiWorkflows?: ComfyUiWorkflowPreset[];
  activeComfyuiWorkflowId?: string;
  customImageUrl?: string;
  customImageApiKey?: string;
  customImageAuthHeader?: string;
  customImageModel?: string;
  customImageFormatMode?: CustomImageFormatMode;
  customImageJsonTemplate?: string;
  customImageNegativePrompt?: string;
  customImageUseServerProxy?: boolean;
  latentUrl?: string;
  latentApiKey?: string;
  latentModel?: string;
  latentSize?: string;
  latentPositivePrefix?: string;
  latentNegativePrompt?: string;
  latentSteps?: number;
  latentScale?: number;
  latentSampler?: string;
  latentNoiseSchedule?: string;
  latentUcPreset?: number;
  latentQualityToggle?: boolean;
  latentUseServerProxy?: boolean;
  /** Kích hoạt rung phản hồi nhẹ (10ms) khi chạm các nút thao tác trên thiết bị hỗ trợ */
  hapticFeedbackEnabled?: boolean;
  /** Tự động chèn nhịp biến cố nhẹ (Story Beats) khi người chơi trò chuyện 2–3 lượt liên tiếp chưa có sự kiện mới */
  autoStoryBeatsEnabled?: boolean;
  safetySettings: SafetySetting[];
}

export function hasImageGeneratorConfigured(
  config?: Partial<AppConfig> | null,
): boolean {
  if (!config) return false;
  if (config.imageProvider === 'comfyui') {
    const activeWf =
      config.activeComfyuiWorkflowId && Array.isArray(config.comfyuiWorkflows)
        ? config.comfyuiWorkflows.find(
            (wf) => wf.id === config.activeComfyuiWorkflowId,
          )
        : undefined;
    const workflowJson = (
      config.comfyuiWorkflowJson ||
      activeWf?.workflowJson ||
      ''
    ).trim();
    return Boolean((config.comfyuiUrl || '').trim() && workflowJson);
  }
  if (config.imageProvider === 'custom') {
    return Boolean((config.customImageUrl || '').trim());
  }
  if (config.imageProvider === 'latent') {
    return Boolean(
      (config.latentApiKey || '').trim() &&
        (
          config.latentUrl ||
          'https://latent.moe/api/novelai/ai/generate-image'
        ).trim(),
    );
  }
  return Boolean((config.seedreamUrl || config.proxyUrl || '').trim());
}

export interface TawaPreset {
  modules: PresetModule[];
  prefillEnabled: boolean;
  prefill: string;
  exclusiveStyleMode?: boolean;
  deletedEmbeddedIds?: string[];
}

export interface ContextConfig {
  historyTurns: number;
  targetLength: string;
  entitiesNote: string;
}

export interface ArkState {
  activeView: ViewName;
  currentPage: number;
  streamEnabled: boolean;
  showRawTags: boolean;
  showPostMeta: boolean;
  hideBottomNav: boolean;
  lobbyBgDataUrl: string;
  storyImage: StoryImageConfig;
  memory: MemoryManagerConfig;
  portraitBank: PortraitBankConfig;
  player: PlayerInfo;
  world: WorldInfo;
  config: AppConfig;
  tawaPreset: TawaPreset;
  context: ContextConfig;
  turns: Turn[];
  slots: SaveSlot[];
  companions: CompanionProfile[];
  companionStories: Record<string, Turn[]>;
  companionMemories: Record<string, MemoryManagerConfig>;
  companionPortraits: Record<string, PortraitBankConfig>;
  companionContexts: Record<string, ContextConfig>;
  activeCompanionId: string;
  activeStoryCompanionId?: string | null;
  /** Lịch sử các gói Hành trình Anime đã dựng để chọn lại / chơi lại 1 chạm */
  animeJourneyHistory?: AnimeJourneyPack[];
  checkpoint: Checkpoint | null;
}

export interface PendingImage {
  id?: string;
  dataUrl: string;
  name: string;
}

export interface BannerMessage {
  text: string;
  type: 'info' | 'err';
}
