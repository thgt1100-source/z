import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FolderDown,
  FolderUp,
  PackageCheck,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type {
  PresetGroupId,
  PresetModule,
  StoryImageConfig,
  TawaPreset,
} from '../types/ark';
import {
  buildUserPresetExportBundle,
  isEmbeddedCustomPresetId,
  mergeImportedPresetBundle,
  parseUserPresetImportBundle,
} from '../utils/embeddedPresets';
import {
  AGE_ANCHOR_PRESETS,
  createBaseBuiltinModules,
  DEFAULT_PREFILL,
  detectAgeAnchorMode,
  detectMindPresentationMode,
  detectNarrativePovMode,
  MIND_PRESENTATION_PRESETS,
  NARRATIVE_POV_PRESETS,
  type AgeAnchorMode,
  type MindPresentationMode,
  type NarrativePovMode,
} from '../utils/storage';

interface PresetViewProps {
  tawaPreset: TawaPreset;
  storyImageConfig?: StoryImageConfig;
  onUpdateStoryImageConfig?: (
    patchOrUpdater:
      | Partial<StoryImageConfig>
      | ((prev: StoryImageConfig) => Partial<StoryImageConfig>),
  ) => void;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
  onSavePreset: (
    modules: PresetModule[],
    prefill: string,
    options?: {
      silent?: boolean;
      message?: string;
      exclusiveStyleMode?: boolean;
      deletedEmbeddedIds?: string[];
      prefillEnabled?: boolean;
    },
  ) => void;
  onResetDefault: () => void;
}

type FilterTabId = 'all' | PresetGroupId;

interface PresetGroupMeta {
  id: PresetGroupId;
  label: string;
  shortLabel: string;
  description: string;
}

const PRESET_GROUPS: PresetGroupMeta[] = [
  {
    id: 'style',
    label: 'Văn phong thể loại',
    shortLabel: 'Văn phong',
    description:
      'Văn phong chuyên biệt theo bối cảnh: Hiện đại, Tiên hiệp, Võ hiệp, Tận thế và Cổ trang.',
  },
  {
    id: 'personal',
    label: 'Đồ riêng (Cá nhân)',
    shortLabel: 'Đồ riêng',
    description:
      'Slot cá nhân để tự đặt tên, viết chỉ dẫn riêng và bật/tắt độc lập kèm văn phong.',
  },
  {
    id: 'perspective',
    label: 'Góc nhìn & Xưng hô',
    shortLabel: 'Góc nhìn',
    description: 'Kiểm soát ngôi kể, điểm quan sát và xưng hô nhất quán.',
  },
  {
    id: 'intimacy',
    label: 'Thân mật & Vật lý cơ thể',
    shortLabel: 'Thân mật & Vật lý',
    description:
      'Nhịp tiếp xúc, ngôn từ trực diện, phong cách thân mật và vật lý tư thế.',
  },
  {
    id: 'appearance',
    label: 'Ngoại hình & Trang phục',
    shortLabel: 'Ngoại hình',
    description:
      'Miêu tả ngũ quan, dáng vóc, trang phục và lớp trang điểm nhân vật nữ.',
  },
  {
    id: 'core',
    label: 'Cốt lõi & Khác',
    shortLabel: 'Cốt lõi & Khác',
    description:
      'Động cơ mở rộng diễn biến, lịch sử hội thoại và mô-đun tùy chỉnh.',
  },
];

const BUILTIN_PROTECTED_IDS = new Set([
  'm1',
  'm2',
  'm3',
  'm4',
  'm_style_modern',
  'm_style_xianxia',
  'm_style_wuxia',
  'm_style_apocalypse',
  'm_style_ancient',
  'm_style_nsfw_sensual',
  'm_style_nsfw_asmr',
  'm_style_custom_author',
  'm_personal_slot_1',
  'm_personal_slot_2',
  'm_personal_slot_3',
  'm_grounded_intimacy',
  'm_narrative_person',
  'm_mind_presentation',
  'm_direct_terms',
  'm_wild_conquest_intimacy',
  'm_grooming_and_dress',
  'm_appearance_and_posture',
  'm_varied_portrait',
  'm_age_anchor',
  'm_body_focus_stockings',
  'm_body_focus_chest',
  'm_body_focus_hip',
  'm_body_focus_legs',
  'm_body_focus_feet',
  'm_body_physics',
  'm_lyric_4bar_performance',
  'm_world_narrator_principles',
  'm_wave_license',
  'm_wave_commitment',
  'm_character_motivation',
  'm_realistic_consequences',
  'm_information_boundary',
  'm_parallel_world',
  'm_modern_dialogue_style',
  'm_cultivation_hierarchy_rankings',
]);

function isPersonalSlotModule(mod: PresetModule): boolean {
  if (mod.isPersonalSlot) return true;
  return /^m_personal_slot_\d+$/i.test(mod.id || '');
}

function isCustomDeletableModule(mod: PresetModule): boolean {
  if (isPersonalSlotModule(mod)) return false;
  if (mod.isCustom) return true;
  if ((mod.id || '').startsWith('m_custom_')) return true;
  const trimmed = (mod.content || '').trim();
  if (trimmed === 'Chat History' || trimmed === '</chathistory>') return false;
  return Boolean(mod.id && !BUILTIN_PROTECTED_IDS.has(mod.id));
}

function classifyPresetGroup(mod: PresetModule): PresetGroupId {
  if (
    mod.group === 'style' ||
    mod.group === 'personal' ||
    mod.group === 'perspective' ||
    mod.group === 'intimacy' ||
    mod.group === 'appearance' ||
    mod.group === 'core'
  ) {
    return mod.group;
  }

  const id = (mod.id || '').toLowerCase();
  const name = (mod.name || '').toLowerCase();
  const content = (mod.content || '').toLowerCase();

  if (
    id.startsWith('m_style_') ||
    /<genre_style_[a-z0-9_]+>/i.test(content) ||
    /^văn phong\s*:/i.test(name)
  ) {
    return 'style';
  }

  if (isPersonalSlotModule(mod) || /^đồ riêng\b/i.test(name)) {
    return 'personal';
  }

  if (
    id === 'm1' ||
    id === 'm_narrative_person' ||
    id === 'm_mind_presentation' ||
    /narrative\s*person|ngôi thứ|góc nhìn thượng đế|tiếng lòng|nhập vai\s*&\s*xưng hô/i.test(
      name,
    ) ||
    /<(narrative_person|mind_presentation)>/i.test(content)
  ) {
    return 'perspective';
  }

  if (
    id === 'm_grounded_intimacy' ||
    id === 'm_direct_terms' ||
    id === 'm_wild_conquest_intimacy' ||
    id === 'm_body_physics' ||
    /grounded\s*intimacy|direct\s*terms|từ ngữ trực diện|chinh phục hoang dã|thân mật|body\s*physics|vật lý cơ thể/i.test(
      name,
    ) ||
    /<(grounded_intimacy|direct_terms|intimacy_tone|body_physics)>/i.test(
      content,
    )
  ) {
    return 'intimacy';
  }

  if (
    id === 'm_grooming_and_dress' ||
    id === 'm_appearance_and_posture' ||
    id === 'm_varied_portrait' ||
    id === 'm_age_anchor' ||
    id.startsWith('m_body_focus_') ||
    /trang phục\s*&\s*trang điểm|appearance\s*&\s*posture|ngũ quan|miêu tả không dán nhãn|varied\s*portrait|neo tuổi tác|trọng tâm\s*:|ái vật tất chân|chiêm ngưỡng/i.test(
      name,
    ) ||
    /<(grooming_and_dress|appearance_and_posture|varied_portrait|age_anchor|body_focus)>/i.test(
      content,
    )
  ) {
    return 'appearance';
  }

  return 'core';
}

function getPresetSummary(mod: PresetModule): string {
  const id = (mod.id || '').toLowerCase();
  const name = (mod.name || '').toLowerCase();
  const content = (mod.content || '').trim();

  if (id === 'm_style_modern' || /<genre_style_modern>/i.test(content)) {
    return 'Tự nhiên, đời thường, sắc nét theo bối cảnh đô thị hiện đại, nhịp kể linh hoạt.';
  }
  if (id === 'm_style_xianxia' || /<genre_style_xianxia>/i.test(content)) {
    return 'Huyền ảo, linh khí/cảnh giới/tu luyện, ngôn từ cổ điển trang nhã mà cuốn hút.';
  }
  if (
    id === 'm_cultivation_hierarchy_rankings' ||
    /<cultivation_hierarchy_rankings>/i.test(content)
  ) {
    return 'Hệ thống cảnh giới tu tiên chuẩn xác, tách bạch cảnh giới vs chiến lực thực chiến, Bảng Thiên–Địa–Nhân & Bảng Thiên Kiêu.';
  }
  if (id === 'm_style_wuxia' || /<genre_style_wuxia>/i.test(content)) {
    return 'Giang hồ, chiêu thức/khí kình, ân oán nghĩa khí, tiết tấu dứt khoát đậm chất võ lâm.';
  }
  if (
    id === 'm_style_apocalypse' ||
    /<genre_style_apocalypse>/i.test(content)
  ) {
    return 'Sinh tồn khốc liệt, căng thẳng, chú trọng khan hiếm tài nguyên và hiểm họa thực tế.';
  }
  if (id === 'm_style_ancient' || /<genre_style_ancient>/i.test(content)) {
    return 'Cung đình/xưa cũ, lễ nghi, phục sức, không gian và xưng hô cổ trang chuẩn mực.';
  }
  if (id === 'm_style_nsfw_sensual') {
    return 'Nồng diễm diễm tình: giác quan dày đặc, phân tách rõ kho từ nữ/giả gái và nam giới, tránh lạm dụng số 3.';
  }
  if (id === 'm_style_nsfw_asmr') {
    return 'Cực hạn giác quan · Đắm chìm bên tai: nhấn âm thanh/nhịp thở đúng đoạn tương tác sát tai, giữ thoại thường tự nhiên.';
  }
  if (id === 'm_style_custom_author') {
    return 'Ô văn phong tự định — mở để dán trực tiếp bút pháp riêng của bạn và bật thay cho các văn phong khác.';
  }
  if (isPersonalSlotModule(mod)) {
    const cleaned = String(content ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned
      ? cleaned.slice(0, 88)
      : 'Chưa nhập nội dung — chạm để đặt tên và viết chỉ dẫn văn phong cá nhân.';
  }

  if (id === 'm1' || /nhập vai\s*&\s*xưng hô/i.test(name)) {
    return 'Kể chuyện tiếng Việt mạch lạc, tự nhiên và giữ nhất quán xưng hô.';
  }
  if (id === 'm2' || /tawa\s*\/\s*omega/i.test(name)) {
    return 'Mở rộng diễn biến, lời thoại, biểu cảm và nhịp cảnh giàu chi tiết.';
  }
  if (
    id === 'm_grounded_intimacy' ||
    /<grounded_intimacy>/i.test(content)
  ) {
    return 'Phản ứng tiếp xúc đúng ngữ cảnh & quan hệ, chống động dục tùy tiện.';
  }
  if (
    id === 'm_narrative_person' ||
    /<narrative_person>/i.test(content)
  ) {
    const povMode = detectNarrativePovMode(mod);
    if (povMode) {
      return NARRATIVE_POV_PRESETS[povMode].summary;
    }
    return 'Kiểm soát ngôi kể (Thượng Đế / Ngôi 2 "bạn" / Ngôi 3 / Ngôi 1 "tôi") và chuyển góc nhìn mượt.';
  }
  if (
    id === 'm_mind_presentation' ||
    /<mind_presentation>/i.test(content)
  ) {
    const mindMode = detectMindPresentationMode(mod);
    if (mindMode) {
      return MIND_PRESENTATION_PRESETS[mindMode].summary;
    }
    return 'Hiển thị tiếng lòng nhân vật (Làm đẹp <wave_mind> thu gọn hoặc Hòa vào chính văn in nghiêng).';
  }
  if (id === 'm_direct_terms' || /<direct_terms>/i.test(content)) {
    return 'Dùng từ ngữ trực diện đúng bối cảnh, tránh ẩn dụ vòng vo.';
  }
  if (
    id === 'm_wild_conquest_intimacy' ||
    /<intimacy_tone>/i.test(content)
  ) {
    return 'Phong cách thân mật bất đối xứng, giữ kháng cự và hàng rào cứng cho User.';
  }
  if (
    id === 'm_grooming_and_dress' ||
    /<grooming_and_dress>/i.test(content)
  ) {
    return 'Trang phục, trang điểm và sự chỉn chu của nhân vật nữ hợp hoàn cảnh.';
  }
  if (
    id === 'm_appearance_and_posture' ||
    /<appearance_and_posture>/i.test(content)
  ) {
    return 'Miêu tả ngũ quan & thể thái nhân vật nữ gắn với động tác, thần thái.';
  }
  if (id === 'm_varied_portrait' || /<varied_portrait>/i.test(content)) {
    return 'Tránh dán nhãn/báo lặp thông số cơ thể và thói quen cũ; tả vóc dáng gián tiếp qua hành động, thoại & biểu cảm gọn.';
  }
  if (id === 'm_age_anchor' || /<age_anchor>/i.test(content)) {
    const ageMode = detectAgeAnchorMode(mod);
    if (ageMode) {
      return AGE_ANCHOR_PRESETS[ageMode].summary;
    }
    return 'Neo hình mạo & chất cảm cơ thể nữ (Thông thường / Thiếu nữ / Thục nữ 30+).';
  }
  if (id === 'm_body_focus_stockings') {
    return 'Trọng tâm tất chân & lớp bao bọc đôi chân (nữ), hòa vào động tác và thái độ nhân vật.';
  }
  if (id === 'm_body_focus_chest') {
    return 'Trọng tâm miêu tả vòng ngực nữ gắn với động tác, bối cảnh và chừng mực, không chiếm kín cả đoạn.';
  }
  if (id === 'm_body_focus_hip') {
    return 'Trọng tâm miêu tả vòng mông nữ theo cử động, trang phục và tương tác hiện trường.';
  }
  if (id === 'm_body_focus_legs') {
    return 'Trọng tâm miêu tả đôi chân nữ gắn với tư thế, chất cảm và hồi đáp của nhân vật.';
  }
  if (id === 'm_body_focus_feet') {
    return 'Trọng tâm miêu tả bàn chân nữ nối liền với tư thế toàn thân và thái độ nhân vật.';
  }
  if (id === 'm_body_physics' || /<body_physics>/i.test(content)) {
    return 'Sắp xếp tay chân, trọng lượng, chiều cao và chuyển tiếp tư thế hợp vật lý.';
  }
  if (
    id === 'm_lyric_4bar_performance' ||
    /<lyric_4bar_performance>/i.test(content)
  ) {
    return 'Tiếp nhận lyric theo từng nhịp 4 bar, giữ nguyên văn 100% ca từ (không cắt/sửa/che lọc), chỉ diễn phản ứng NPC.';
  }
  if (
    id === 'm_world_narrator_principles' ||
    /<world_narrator_principles>/i.test(content)
  ) {
    return 'Nguyên tắc 70/30, nhân vật độc lập không gồng/lặp, sương mù thông tin, kết lượt tự nhiên không hỏi ý kiến.';
  }
  if (id === 'm_wave_license' || /<wave_license>/i.test(content)) {
    return 'Thước đo viết trọn vẹn hành động, giác quan & đối thoại, không cắt cảnh mờ dần hay chèn miễn trừ trách nhiệm.';
  }
  if (id === 'm_wave_commitment' || /<wave_commitment>/i.test(content)) {
    return 'Cam kết nhập vai tác giả Sóng Trào: giữ nhân quả chân thật, tránh lặp cảnh cũ và viết trọn trải nghiệm.';
  }
  if (
    id === 'm_character_motivation' ||
    /<character_motivation>/i.test(content)
  ) {
    return 'Động cơ & phản ứng riêng theo trải nghiệm từng nhân vật, giữ quyền tự chủ quyết định then chốt của User.';
  }
  if (
    id === 'm_realistic_consequences' ||
    /<realistic_consequences>/i.test(content)
  ) {
    return 'Hậu quả đời thường khi vô duyên/thiếu chừng mực, cấm bịa màn lật kèo ảo tưởng hay bẻ gãy quan hệ gượng gạo.';
  }
  if (
    id === 'm_information_boundary' ||
    /<information_boundary>/i.test(content)
  ) {
    return 'Tách biệt góc nhìn người đọc với nhận thức nhân vật: cấm linh cảm/nghi ngờ vô cớ và tuân thủ giới hạn khi bị giam giữ/cách ly.';
  }
  if (id === 'm_parallel_world' || /<parallel_world>/i.test(content)) {
    return 'Xuất bảng "Thế giới song song" (<wave_parallel>) thu gọn ở cuối lượt cho diễn biến ngoài sân khấu đồng thời gian.';
  }
  if (
    id === 'm_modern_dialogue_style' ||
    /<modern_dialogue_style>/i.test(content)
  ) {
    return 'Văn phong đối thoại giới trẻ hiện đại (15–25% trend), sắc thái nghệ sĩ/idol, phân tách chat nhóm vs thoại trực tiếp và an toàn NPC.';
  }
  if (content === 'Chat History') {
    return 'Điểm chèn lịch sử hội thoại các lượt gần nhất vào chuỗi gửi Proxy.';
  }
  if (content === '</chathistory>') {
    return 'Đóng khung lịch sử hội thoại trước lượt nhập mới của người chơi.';
  }

  const singleLine = String(content ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return singleLine ? singleLine.slice(0, 88) : 'Mô-đun tùy chỉnh.';
}

export function PresetView({
  tawaPreset,
  storyImageConfig,
  onUpdateStoryImageConfig,
  onNotify,
  onSavePreset,
  onResetDefault,
}: PresetViewProps) {
  const [modules, setModules] = useState<PresetModule[]>(
    Array.isArray(tawaPreset?.modules) ? tawaPreset.modules : [],
  );
  const [prefill, setPrefill] = useState(tawaPreset?.prefill || '');
  const [exclusiveStyleMode, setExclusiveStyleMode] = useState<boolean>(
    tawaPreset?.exclusiveStyleMode ?? true,
  );
  const [activeTab, setActiveTab] = useState<FilterTabId>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<PresetGroupId, boolean>
  >({
    style: false,
    personal: false,
    perspective: false,
    intimacy: false,
    appearance: false,
    core: false,
  });
  const [prefillOpen, setPrefillOpen] = useState(false);

  // Remix Preset Sync & Embed Panel State
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [copiedBundleJson, setCopiedBundleJson] = useState('');
  const [justCopied, setJustCopied] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pasteImportText, setPasteImportText] = useState('');
  const presetFileInputRef = useRef<HTMLInputElement>(null);

  // Create New Preset Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftGroup, setDraftGroup] = useState<PresetGroupId>('personal');
  const [draftContent, setDraftContent] = useState('');
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftError, setDraftError] = useState('');
  const draftNameInputRef = useRef<HTMLInputElement>(null);

  const baseBuiltinModules = useMemo(() => createBaseBuiltinModules(), []);

  const exportSnapshot = useMemo(
    () =>
      buildUserPresetExportBundle(
        {
          ...tawaPreset,
          modules,
          prefill,
          exclusiveStyleMode,
        },
        storyImageConfig,
        baseBuiltinModules,
        DEFAULT_PREFILL,
      ),
    [
      tawaPreset,
      modules,
      prefill,
      exclusiveStyleMode,
      storyImageConfig,
      baseBuiltinModules,
    ],
  );

  useEffect(() => {
    setModules(Array.isArray(tawaPreset?.modules) ? tawaPreset.modules : []);
    setPrefill(tawaPreset?.prefill || '');
    setExclusiveStyleMode(tawaPreset?.exclusiveStyleMode ?? true);
  }, [tawaPreset]);

  useEffect(
    () => () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!createModalOpen) return;
    const timer = window.setTimeout(() => {
      draftNameInputRef.current?.focus();
    }, 50);
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setCreateModalOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [createModalOpen]);

  const hasUnsavedEdits = useMemo(() => {
    const savedModules = Array.isArray(tawaPreset?.modules)
      ? tawaPreset.modules
      : [];
    if ((prefill || '') !== (tawaPreset?.prefill || '')) return true;
    if (exclusiveStyleMode !== (tawaPreset?.exclusiveStyleMode ?? true)) {
      return true;
    }
    if (modules.length !== savedModules.length) return true;
    for (let i = 0; i < modules.length; i++) {
      const a = modules[i];
      const b = savedModules[i];
      if (
        !b ||
        a.id !== b.id ||
        a.name !== b.name ||
        a.content !== b.content ||
        a.enabled !== b.enabled ||
        a.group !== b.group
      ) {
        return true;
      }
    }
    return false;
  }, [modules, prefill, exclusiveStyleMode, tawaPreset]);

  const enabledCount = useMemo(
    () => modules.filter((m) => m.enabled).length,
    [modules],
  );

  const groupedEntries = useMemo(() => {
    const map: Record<
      PresetGroupId,
      Array<{ mod: PresetModule; globalIdx: number }>
    > = {
      style: [],
      personal: [],
      perspective: [],
      intimacy: [],
      appearance: [],
      core: [],
    };
    modules.forEach((mod, globalIdx) => {
      const group = classifyPresetGroup(mod);
      map[group].push({ mod, globalIdx });
    });
    return map;
  }, [modules]);

  const activeStyleEntries = useMemo(
    () => groupedEntries.style.filter((entry) => entry.mod.enabled),
    [groupedEntries],
  );

  const visibleGroups = useMemo(() => {
    if (activeTab === 'all') {
      return PRESET_GROUPS.filter((g) => groupedEntries[g.id].length > 0);
    }
    return PRESET_GROUPS.filter(
      (g) => g.id === activeTab && groupedEntries[g.id].length > 0,
    );
  }, [activeTab, groupedEntries]);

  const openCreateModal = (presetGroup?: PresetGroupId) => {
    setDraftName('');
    setDraftGroup(
      presetGroup || (activeTab === 'all' ? 'personal' : activeTab),
    );
    setDraftContent('');
    setDraftEnabled(true);
    setDraftError('');
    setCreateModalOpen(true);
  };

  const handleCreatePreset = () => {
    const cleanName = draftName.trim();
    const cleanContent = draftContent.trim();
    if (!cleanName) {
      setDraftError('Vui lòng nhập tên mô-đun Preset.');
      draftNameInputRef.current?.focus();
      return;
    }
    if (!cleanContent) {
      setDraftError('Vui lòng nhập nội dung chỉ dẫn cho mô-đun Preset.');
      return;
    }

    const newMod: PresetModule = {
      id: `m_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      enabled: draftEnabled,
      content: cleanContent,
      group: draftGroup,
      isCustom: true,
    };

    const nextModules = modules.map((m) =>
      draftEnabled &&
      draftGroup === 'style' &&
      exclusiveStyleMode &&
      classifyPresetGroup(m) === 'style'
        ? { ...m, enabled: false }
        : m,
    );
    const insertIdx = nextModules.findIndex(
      (m) =>
        m.content.trim() === 'Chat History' ||
        m.content.trim() === '</chathistory>',
    );
    if (insertIdx >= 0) {
      nextModules.splice(insertIdx, 0, newMod);
    } else {
      nextModules.push(newMod);
    }

    setModules(nextModules);
    setCollapsedGroups((prev) => ({ ...prev, [draftGroup]: false }));
    if (activeTab !== 'all' && activeTab !== draftGroup) {
      setActiveTab(draftGroup);
    }
    setCreateModalOpen(false);
    setDraftError('');
    onSavePreset(nextModules, prefill, {
      message: `Đã thêm Preset "${cleanName}".`,
      exclusiveStyleMode,
    });
  };

  const applyQuickPresetImmediate = (
    globalIdx: number,
    spec: {
      moduleName: string;
      content: string;
      group: PresetGroupId;
      message: string;
    },
  ) => {
    const nextModules = modules.map((m, idx) =>
      idx === globalIdx
        ? {
            ...m,
            name: spec.moduleName,
            content: spec.content,
            enabled: true,
            group: spec.group,
          }
        : m,
    );
    setModules(nextModules);
    onSavePreset(nextModules, prefill, {
      message: spec.message,
      exclusiveStyleMode,
    });
  };

  const handleToggleExclusiveStyleMode = () => {
    const nextExclusive = !exclusiveStyleMode;
    let nextModules = modules;
    let keptStyleName = '';
    let disabledOthersCount = 0;

    if (nextExclusive) {
      let keptFirst = false;
      nextModules = modules.map((m) => {
        if (classifyPresetGroup(m) !== 'style' || !m.enabled) return m;
        if (!keptFirst) {
          keptFirst = true;
          keptStyleName = m.name || 'thể loại đầu tiên';
          return m;
        }
        disabledOthersCount += 1;
        return { ...m, enabled: false };
      });
    }

    setExclusiveStyleMode(nextExclusive);
    setModules(nextModules);
    onSavePreset(nextModules, prefill, {
      exclusiveStyleMode: nextExclusive,
      message: nextExclusive
        ? disabledOthersCount > 0
          ? `Đã bật chế độ chọn 1 văn phong (giữ "${keptStyleName}", tắt ${disabledOthersCount} thể loại còn lại).`
          : 'Đã bật chế độ chỉ chọn 1 văn phong thể loại để tránh xung đột.'
        : 'Đã cho phép bật đồng thời nhiều văn phong thể loại.',
    });
  };

  const toggleModuleImmediate = (globalIdx: number) => {
    const target = modules[globalIdx];
    if (!target) return;
    const willEnable = !target.enabled;
    const targetGroup = classifyPresetGroup(target);
    const shouldEnforceExclusiveStyle =
      willEnable && targetGroup === 'style' && exclusiveStyleMode;

    const nextModules = modules.map((m, i) => {
      if (i === globalIdx) return { ...m, enabled: willEnable };
      if (shouldEnforceExclusiveStyle && classifyPresetGroup(m) === 'style') {
        return { ...m, enabled: false };
      }
      return m;
    });

    if (
      willEnable &&
      isPersonalSlotModule(target) &&
      !(target.content || '').trim()
    ) {
      const rowKey = target.id || `mod_${globalIdx}`;
      setExpandedIds((prev) => ({ ...prev, [rowKey]: true }));
    }

    setModules(nextModules);
    onSavePreset(nextModules, prefill, { silent: true, exclusiveStyleMode });
  };

  const moveModuleImmediate = (globalIdx: number, dir: -1 | 1) => {
    const target = globalIdx + dir;
    if (target < 0 || target >= modules.length) return;
    const nextModules = [...modules];
    const tmp = nextModules[target];
    nextModules[target] = nextModules[globalIdx];
    nextModules[globalIdx] = tmp;
    setModules(nextModules);
    onSavePreset(nextModules, prefill, { silent: true, exclusiveStyleMode });
  };

  const updateModuleField = (
    globalIdx: number,
    patch: Partial<Pick<PresetModule, 'name' | 'content' | 'group'>>,
  ) => {
    setModules((prev) =>
      prev.map((m, i) => (i === globalIdx ? { ...m, ...patch } : m)),
    );
  };

  const clearPersonalSlotContent = (globalIdx: number) => {
    const target = modules[globalIdx];
    if (!target || !isPersonalSlotModule(target)) return;
    const nextModules = modules.map((m, i) =>
      i === globalIdx ? { ...m, content: '', enabled: false } : m,
    );
    setModules(nextModules);
    onSavePreset(nextModules, prefill, {
      message: `Đã xóa trắng nội dung "${target.name || 'Đồ riêng'}".`,
      exclusiveStyleMode,
    });
  };

  const updateModuleGroupImmediate = (
    globalIdx: number,
    nextGroup: PresetGroupId,
  ) => {
    const nextModules = modules.map((m, i) =>
      i === globalIdx ? { ...m, group: nextGroup } : m,
    );
    setModules(nextModules);
    setCollapsedGroups((prev) => ({ ...prev, [nextGroup]: false }));
    onSavePreset(nextModules, prefill, { silent: true, exclusiveStyleMode });
  };

  const handleDeleteCustomModule = (globalIdx: number) => {
    const target = modules[globalIdx];
    if (!target || !isCustomDeletableModule(target)) return;
    const nextModules = modules.filter((_, i) => i !== globalIdx);
    const prevDeleted = Array.isArray(tawaPreset.deletedEmbeddedIds)
      ? tawaPreset.deletedEmbeddedIds
      : [];
    const nextDeleted =
      (target.isEmbeddedDefault || isEmbeddedCustomPresetId(target.id)) &&
      !prevDeleted.includes(target.id)
        ? [...prevDeleted, target.id]
        : prevDeleted;

    setModules(nextModules);
    setConfirmDeleteId(null);
    onSavePreset(nextModules, prefill, {
      message: `Đã xóa Preset "${target.name || 'tùy chỉnh'}".`,
      exclusiveStyleMode,
      deletedEmbeddedIds: nextDeleted,
    });
  };

  const handleCopyPresetBundleForEmbed = async () => {
    const jsonText = JSON.stringify(exportSnapshot.bundle, null, 2);
    setCopiedBundleJson(jsonText);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonText);
        setJustCopied(true);
        if (copyResetTimerRef.current !== null) {
          window.clearTimeout(copyResetTimerRef.current);
        }
        copyResetTimerRef.current = window.setTimeout(() => {
          setJustCopied(false);
          copyResetTimerRef.current = null;
        }, 2400);
        onNotify?.(
          exportSnapshot.summary.totalCapturedItems > 0
            ? `Đã sao chép ${exportSnapshot.summary.totalCapturedItems} mục Preset tùy chỉnh — dán vào khung chat để nhúng mặc định cho bản Remix.`
            : 'Đã sao chép gói cấu hình Preset hiện tại.',
        );
        return;
      }
    } catch {
      // Fallback to inline textarea below
    }
    onNotify?.(
      'Đã tạo mã Preset JSON ở ô bên dưới — chạm vào ô để chọn tất cả và sao chép.',
    );
  };

  const handleExportPresetBundleFile = () => {
    const jsonText = JSON.stringify(exportSnapshot.bundle, null, 2);
    const blob = new Blob([jsonText], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `ARK_presets_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    onNotify?.(
      `Đã xuất tệp bộ Preset (${exportSnapshot.summary.totalCapturedItems} mục tùy chỉnh).`,
    );
  };

  const applyImportedPresetJsonText = (rawText: string) => {
    const parsed = parseUserPresetImportBundle(
      rawText,
      baseBuiltinModules,
      DEFAULT_PREFILL,
    );
    if (!parsed.ok) {
      onNotify?.(parsed.error, 'err');
      return false;
    }

    const merged = mergeImportedPresetBundle(
      modules,
      storyImageConfig,
      parsed.bundle,
    );

    const importedIds = new Set(parsed.bundle.customModules.map((m) => m.id));
    const prevDeleted = Array.isArray(tawaPreset.deletedEmbeddedIds)
      ? tawaPreset.deletedEmbeddedIds
      : [];
    const nextDeleted = prevDeleted.filter((id) => !importedIds.has(id));

    const nextPrefill = parsed.bundle.presetSettings.prefill || prefill;
    const nextExclusive =
      typeof parsed.bundle.presetSettings.exclusiveStyleMode === 'boolean'
        ? parsed.bundle.presetSettings.exclusiveStyleMode
        : exclusiveStyleMode;

    setModules(merged.nextModules);
    setPrefill(nextPrefill);
    setExclusiveStyleMode(nextExclusive);

    const details: string[] = [];
    if (merged.addedCustomCount > 0) {
      details.push(`+${merged.addedCustomCount} Preset tùy chỉnh`);
    }
    if (merged.updatedPersonalCount > 0) {
      details.push(`${merged.updatedPersonalCount} Đồ riêng`);
    }
    if (merged.updatedBuiltinCount > 0) {
      details.push(`${merged.updatedBuiltinCount} mô-đun chỉnh sửa`);
    }
    if (merged.addedImageStyleCount > 0) {
      details.push(`+${merged.addedImageStyleCount} kiểu vẽ ảnh`);
    }
    if (merged.updatedPromptTemplate) {
      details.push('mẫu Prompt sinh ảnh');
    }

    onSavePreset(merged.nextModules, nextPrefill, {
      exclusiveStyleMode: nextExclusive,
      deletedEmbeddedIds: nextDeleted,
      prefillEnabled: parsed.bundle.presetSettings.prefillEnabled,
      message:
        details.length > 0
          ? `Đã nạp bộ Preset: ${details.join(', ')}.`
          : 'Tất cả Preset trong gói đã có sẵn trên phiên này (không bị trùng lặp).',
    });

    if (merged.nextStoryImagePatch && onUpdateStoryImageConfig) {
      onUpdateStoryImageConfig((prev) => {
        const importedStyleIds = new Set(
          parsed.bundle.customImageStyles.map((s) => s.id),
        );
        const nextDeletedStyles = (prev.deletedEmbeddedStyleIds || []).filter(
          (id) => !importedStyleIds.has(id),
        );
        return {
          ...merged.nextStoryImagePatch,
          deletedEmbeddedStyleIds: nextDeletedStyles,
        };
      });
    }

    return true;
  };

  const handleImportPresetFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      applyImportedPresetJsonText(text);
    };
    reader.onerror = () => {
      onNotify?.('Không thể đọc tệp JSON đã chọn.', 'err');
    };
    reader.readAsText(file, 'utf-8');
  };

  const toggleExpandModule = (key: string) => {
    setConfirmDeleteId(null);
    setExpandedIds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleGroupCollapse = (groupId: PresetGroupId) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <section className="space-y-4">
      {/* Header & Category Filter Bar */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              P&amp;P Preset
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 tabular-nums">
              <span>
                Đang bật{' '}
                <strong className="font-semibold text-slate-200">
                  {enabledCount}/{modules.length}
                </strong>{' '}
                mô-đun
              </span>
              <span aria-hidden="true">·</span>
              <span>Bật/tắt áp dụng &amp; tự lưu ngay cho Proxy</span>
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center shrink-0">
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-sky-500/18 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/38 transition-all hover:bg-sky-500/26 active:scale-[0.985] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Thêm Preset</span>
            </button>
            <button
              type="button"
              onClick={() => setSyncPanelOpen((v) => !v)}
              aria-expanded={syncPanelOpen}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                syncPanelOpen
                  ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/40'
                  : 'bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] hover:text-white'
              }`}
            >
              <PackageCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Đồng bộ Remix</span>
              {exportSnapshot.summary.totalCapturedItems > 0 && (
                <span className="ml-0.5 text-[11px] text-emerald-300 tabular-nums">
                  ({exportSnapshot.summary.totalCapturedItems})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onResetDefault}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] hover:text-white whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>Mặc định</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onSavePreset(modules, prefill, { exclusiveStyleMode })
              }
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-all active:scale-[0.985] whitespace-nowrap shrink-0 ${
                hasUnsavedEdits
                  ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.5)] hover:from-sky-400 hover:to-blue-500'
                  : 'bg-white/[0.08] text-slate-100 ring-1 ring-inset ring-white/[0.1] hover:bg-white/[0.13]'
              }`}
            >
              <Save className="h-3.5 w-3.5 shrink-0" />
              <span>{hasUnsavedEdits ? 'Lưu thay đổi' : 'Lưu Preset'}</span>
            </button>
          </div>
        </div>

        {/* Remix Preset Sync, Export/Import & Embed Helper Panel */}
        {syncPanelOpen && (
          <div className="mt-3.5 rounded-xl bg-[#0e1726]/90 p-3.5 ring-1 ring-emerald-400/22 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-emerald-200">
                  Đồng bộ &amp; Nhúng Preset tự thêm cho bản Remix
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Gom toàn bộ Preset bạn tự viết (Văn phong, Đồ riêng, mô-đun tùy chỉnh, kiểu vẽ ảnh &amp; mẫu Prompt sinh ảnh) để chuyển nhanh sang tài khoản Remix mới hoặc sao chép dán vào khung chat để nhúng cứng vào mã nguồn mặc định.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSyncPanelOpen(false)}
                aria-label="Đóng bảng đồng bộ Remix"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.08] hover:text-slate-100 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300 tabular-nums">
              <span>
                Văn phong tự thêm:{' '}
                <strong className="text-sky-200">
                  {exportSnapshot.summary.customStyleCount}
                </strong>
              </span>
              <span>
                Đồ riêng đã ghi:{' '}
                <strong className="text-emerald-200">
                  {exportSnapshot.summary.filledPersonalSlotCount +
                    exportSnapshot.summary.customPersonalCount}
                </strong>
              </span>
              <span>
                Mô-đun khác:{' '}
                <strong className="text-slate-100">
                  {exportSnapshot.summary.customOtherCount +
                    exportSnapshot.summary.modifiedBuiltinCount}
                </strong>
              </span>
              <span>
                Kiểu vẽ ảnh tùy chỉnh:{' '}
                <strong className="text-amber-200">
                  {exportSnapshot.summary.customImageStyleCount}
                </strong>
              </span>
              {exportSnapshot.summary.hasCustomPromptTemplate && (
                <span className="text-emerald-300 font-medium">
                  · Có mẫu Prompt sinh ảnh riêng
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyPresetBundleForEmbed()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500/22 px-3.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/40 transition-colors hover:bg-emerald-500/30 whitespace-nowrap"
              >
                {justCopied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>
                  {justCopied
                    ? 'Đã sao chép mã Preset'
                    : 'Sao chép mã Preset (nhúng mặc định)'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleExportPresetBundleFile}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-sky-500/18 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/26 whitespace-nowrap"
              >
                <FolderDown className="h-3.5 w-3.5" />
                <span>Xuất bộ Preset (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => presetFileInputRef.current?.click()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.1] transition-colors hover:bg-white/[0.12] whitespace-nowrap"
              >
                <FolderUp className="h-3.5 w-3.5" />
                <span>Nạp bộ Preset (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => setPasteImportOpen((v) => !v)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 text-xs font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.09] whitespace-nowrap"
              >
                <span>{pasteImportOpen ? 'Ẩn ô dán JSON' : 'Dán JSON nạp nhanh'}</span>
              </button>
              <input
                ref={presetFileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportPresetFile}
                className="hidden"
              />
            </div>

            {copiedBundleJson && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-emerald-200/90">
                    Mã Preset JSON (dán vào khung chat AI Studio để nhúng cố định vào mặc định):
                  </span>
                  <button
                    type="button"
                    onClick={() => setCopiedBundleJson('')}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Ẩn
                  </button>
                </div>
                <textarea
                  readOnly
                  value={copiedBundleJson}
                  onFocus={(e) => e.currentTarget.select()}
                  rows={5}
                  className="w-full rounded-xl bg-[#09101d] p-2.5 font-mono text-[11px] text-slate-200 ring-1 ring-white/[0.09] focus:outline-none focus:ring-emerald-400/45"
                />
              </div>
            )}

            {pasteImportOpen && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={pasteImportText}
                  onChange={(e) => setPasteImportText(e.target.value)}
                  placeholder="Dán nội dung tệp ARK_presets_*.json hoặc mã Preset JSON vào đây..."
                  rows={4}
                  className="w-full rounded-xl bg-[#09101d] p-2.5 font-mono text-[11px] text-slate-100 placeholder:text-slate-500 ring-1 ring-white/[0.1] focus:outline-none focus:ring-sky-400/45"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPasteImportText('');
                      setPasteImportOpen(false);
                    }}
                    className="min-h-[34px] rounded-lg bg-white/[0.06] px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.1]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!pasteImportText.trim()) {
                        onNotify?.('Hãy dán mã Preset JSON trước khi nạp.', 'err');
                        return;
                      }
                      if (applyImportedPresetJsonText(pasteImportText)) {
                        setPasteImportText('');
                        setPasteImportOpen(false);
                      }
                    }}
                    className="min-h-[34px] rounded-lg bg-sky-500/25 px-3.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-500/35"
                  >
                    Nạp ngay (giữ Preset cũ)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Interactive Category Tabs */}
        <div
          role="tablist"
          aria-label="Lọc nhóm P&P Preset"
          className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={`min-h-[38px] rounded-xl px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              activeTab === 'all'
                ? 'bg-sky-500/20 text-sky-200 ring-1 ring-inset ring-sky-400/35'
                : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
            }`}
          >
            Tất cả ({modules.length})
          </button>
          {PRESET_GROUPS.map((group) => {
            const list = groupedEntries[group.id];
            if (!list.length) return null;
            const activeInGroup = list.filter((x) => x.mod.enabled).length;
            const isSelected = activeTab === group.id;
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(group.id)}
                className={`min-h-[38px] rounded-xl px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  isSelected
                    ? 'bg-sky-500/20 text-sky-200 ring-1 ring-inset ring-sky-400/35'
                    : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                }`}
              >
                {group.shortLabel} ({activeInGroup}/{list.length})
              </button>
            );
          })}
        </div>
      </div>

      {/* Categorized Compact Preset Groups */}
      <div className="space-y-3.5">
        {visibleGroups.map((group) => {
          const items = groupedEntries[group.id];
          const groupEnabled = items.filter((x) => x.mod.enabled).length;
          const isGroupCollapsed =
            activeTab === 'all' && Boolean(collapsedGroups[group.id]);

          return (
            <div
              key={group.id}
              className="rounded-2xl bg-[#162032]/84 ring-1 ring-white/[0.08] shadow-[0_10px_28px_-18px_rgba(2,8,23,0.65)] overflow-hidden"
            >
              {/* Group Header */}
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'all') toggleGroupCollapse(group.id);
                }}
                aria-expanded={!isGroupCollapsed}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${
                  activeTab === 'all'
                    ? 'hover:bg-white/[0.03] cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h3 className="text-sm font-bold tracking-tight text-slate-100">
                      {group.label}
                    </h3>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {groupEnabled}/{items.length} đang bật
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400/90">
                    {group.description}
                  </p>
                </div>
                {activeTab === 'all' && (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 shrink-0">
                    {isGroupCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </span>
                )}
              </button>

              {/* Sub-bar for Genre Style anti-conflict toggle */}
              {!isGroupCollapsed && group.id === 'style' && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-[#10192a]/70 px-4 py-2.5">
                  <div className="min-w-0 text-xs">
                    {activeStyleEntries.length === 0 ? (
                      <span className="text-slate-400">
                        Chưa bật văn phong thể loại nào
                      </span>
                    ) : activeStyleEntries.length === 1 ? (
                      <span className="text-sky-200 font-medium">
                        Đang áp dụng:{' '}
                        <strong className="font-semibold text-sky-100">
                          {String(activeStyleEntries[0]?.mod?.name ?? '').replace(
                            /^Văn phong:\s*/i,
                            '',
                          )}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-amber-300 font-medium">
                        Đang bật {activeStyleEntries.length} thể loại cùng lúc
                        (lưu ý tránh xung đột văn phong)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={exclusiveStyleMode}
                    aria-label="Chỉ bật 1 văn phong thể loại để tránh xung đột"
                    onClick={handleToggleExclusiveStyleMode}
                    className={`inline-flex min-h-[34px] items-center gap-2 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap shrink-0 ${
                      exclusiveStyleMode
                        ? 'bg-sky-500/15 text-sky-200 ring-sky-400/35 hover:bg-sky-500/22'
                        : 'bg-white/[0.045] text-slate-400 ring-white/[0.09] hover:bg-white/[0.08] hover:text-slate-200'
                    }`}
                  >
                    <span>Chỉ bật 1 thể loại</span>
                    <span
                      aria-hidden="true"
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                        exclusiveStyleMode
                          ? 'bg-sky-500/85'
                          : 'bg-slate-600/80'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                          exclusiveStyleMode
                            ? 'translate-x-[14px]'
                            : 'translate-x-[2px]'
                        }`}
                      />
                    </span>
                  </button>
                </div>
              )}

              {/* Sub-bar for Đồ riêng personal slots */}
              {!isGroupCollapsed && group.id === 'personal' && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-[#10192a]/70 px-4 py-2.5">
                  <span className="text-xs text-slate-400">
                    Bật kèm văn phong thể loại mà không bị xung đột; chạm slot để đổi tên &amp; viết chỉ dẫn.
                  </span>
                  <button
                    type="button"
                    onClick={() => openCreateModal('personal')}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-sky-500/15 px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/25 whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Thêm slot</span>
                  </button>
                </div>
              )}

              {/* Preset Rows inside Group */}
              {!isGroupCollapsed && (
                <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                  {items.map(({ mod, globalIdx }) => {
                    const rowKey = mod.id || `mod_${globalIdx}`;
                    const isExpanded = Boolean(expandedIds[rowKey]);
                    const isDeletable = isCustomDeletableModule(mod);
                    const isPersonalSlot = isPersonalSlotModule(mod);
                    const isContentEmpty = !(mod.content || '').trim();
                    const summary = getPresetSummary(mod);
                    const currentGroup = classifyPresetGroup(mod);

                    return (
                      <div
                        key={rowKey}
                        className={`px-4 py-3 transition-colors ${
                          mod.enabled ? 'bg-transparent' : 'bg-[#0f1726]/45'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Clickable title + metadata to expand/collapse editor */}
                          <button
                            type="button"
                            onClick={() => toggleExpandModule(rowKey)}
                            aria-expanded={isExpanded}
                            className="min-w-0 flex-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-semibold leading-snug truncate ${
                                  mod.enabled
                                    ? 'text-slate-100'
                                    : 'text-slate-400'
                                }`}
                              >
                                {mod.name || `Mô-đun ${globalIdx + 1}`}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-400 truncate tabular-nums">
                              #{globalIdx + 1}
                              {isPersonalSlot
                                ? isContentEmpty
                                  ? mod.enabled
                                    ? ' · Đồ riêng (trống — chưa tiêm Proxy)'
                                    : ' · Đồ riêng (trống)'
                                  : ' · Đồ riêng'
                                : isDeletable
                                  ? ' · Tùy chỉnh'
                                  : ''}{' '}
                              · {summary}
                            </p>
                          </button>

                          {/* Right Controls: Independent Toggle Switch + Expand Editor */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={mod.enabled}
                              aria-label={`${mod.enabled ? 'Tắt' : 'Bật'} ${mod.name || 'mô-đun'}`}
                              onClick={() => toggleModuleImmediate(globalIdx)}
                              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
                                mod.enabled
                                  ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/35 hover:bg-emerald-500/22'
                                  : 'bg-white/[0.045] text-slate-400 ring-white/[0.09] hover:bg-white/[0.08] hover:text-slate-200'
                              }`}
                            >
                              <span>{mod.enabled ? 'Bật' : 'Tắt'}</span>
                              <span
                                aria-hidden="true"
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  mod.enabled
                                    ? 'bg-emerald-500/80'
                                    : 'bg-slate-600/80'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                                    mod.enabled
                                      ? 'translate-x-[18px]'
                                      : 'translate-x-[3px]'
                                  }`}
                                />
                              </span>
                            </button>

                            <button
                              type="button"
                              aria-label={
                                isExpanded
                                  ? 'Thu gọn nội dung'
                                  : 'Mở sửa nội dung và thứ tự'
                              }
                              aria-expanded={isExpanded}
                              onClick={() => toggleExpandModule(rowKey)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.045] text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.1] hover:text-white shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Quick 1-tap mode switchers (POV, Mind Presentation, Age Anchor) */}
                        {(() => {
                          const quickSwitcher =
                            mod.id === 'm_narrative_person' ||
                            /<narrative_person>/i.test(mod.content || '')
                              ? {
                                  label: 'Đổi nhanh góc nhìn:',
                                  activeCls:
                                    'bg-sky-500/20 text-sky-200 ring-sky-400/45',
                                  activeKey: detectNarrativePovMode(mod),
                                  options: (
                                    [
                                      'omniscient',
                                      'second',
                                      'third',
                                      'first',
                                    ] as NarrativePovMode[]
                                  ).map((mode) => ({
                                    key: mode,
                                    shortLabel:
                                      NARRATIVE_POV_PRESETS[mode].shortLabel,
                                    onSelect: () => {
                                      const p = NARRATIVE_POV_PRESETS[mode];
                                      applyQuickPresetImmediate(globalIdx, {
                                        moduleName: p.moduleName,
                                        content: p.content,
                                        group: 'perspective',
                                        message: `Đã chuyển ngôi kể sang ${p.label}.`,
                                      });
                                    },
                                  })),
                                }
                              : mod.id === 'm_mind_presentation' ||
                                  /<mind_presentation>/i.test(mod.content || '')
                                ? {
                                    label: 'Kiểu tiếng lòng:',
                                    activeCls:
                                      'bg-violet-500/20 text-violet-200 ring-violet-400/45',
                                    activeKey: detectMindPresentationMode(mod),
                                    options: (
                                      [
                                        'decorated',
                                        'inline',
                                      ] as MindPresentationMode[]
                                    ).map((mode) => ({
                                      key: mode,
                                      shortLabel:
                                        MIND_PRESENTATION_PRESETS[mode]
                                          .shortLabel,
                                      onSelect: () => {
                                        const p =
                                          MIND_PRESENTATION_PRESETS[mode];
                                        applyQuickPresetImmediate(globalIdx, {
                                          moduleName: p.moduleName,
                                          content: p.content,
                                          group: 'perspective',
                                          message: `Đã chuyển chế độ tiếng lòng sang ${p.label}.`,
                                        });
                                      },
                                    })),
                                  }
                                : mod.id === 'm_age_anchor' ||
                                    /<age_anchor>/i.test(mod.content || '')
                                  ? {
                                      label: 'Neo tuổi tác (Nữ):',
                                      activeCls:
                                        'bg-rose-500/20 text-rose-200 ring-rose-400/45',
                                      activeKey: detectAgeAnchorMode(mod),
                                      options: (
                                        [
                                          'regular',
                                          'young_adult',
                                          'mature',
                                        ] as AgeAnchorMode[]
                                      ).map((mode) => ({
                                        key: mode,
                                        shortLabel:
                                          AGE_ANCHOR_PRESETS[mode].shortLabel,
                                        onSelect: () => {
                                          const p = AGE_ANCHOR_PRESETS[mode];
                                          applyQuickPresetImmediate(globalIdx, {
                                            moduleName: p.moduleName,
                                            content: p.content,
                                            group: 'appearance',
                                            message: `Đã chuyển neo tuổi tác sang ${p.label}.`,
                                          });
                                        },
                                      })),
                                    }
                                  : null;

                          if (!quickSwitcher) return null;
                          return (
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-medium text-slate-400 mr-1">
                                {quickSwitcher.label}
                              </span>
                              {quickSwitcher.options.map((opt) => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={opt.onSelect}
                                  className={`inline-flex min-h-[34px] items-center rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                                    quickSwitcher.activeKey === opt.key
                                      ? quickSwitcher.activeCls
                                      : 'bg-white/[0.04] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                                  }`}
                                >
                                  {opt.shortLabel}
                                </button>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Collapsible Inline Editor & Order Controls */}
                        {isExpanded && (
                          <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs text-slate-400 tabular-nums">
                                Thứ tự tiêm Proxy: #{globalIdx + 1} /{' '}
                                {modules.length}
                                {' · '}
                                {mod.enabled ? 'Đang kích hoạt' : 'Đang tạm tắt'}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  aria-label="Đưa lên trong chuỗi Proxy"
                                  disabled={globalIdx === 0}
                                  onClick={() =>
                                    moveModuleImmediate(globalIdx, -1)
                                  }
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] disabled:opacity-35 whitespace-nowrap"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                  <span>Lên</span>
                                </button>
                                <button
                                  type="button"
                                  aria-label="Đưa xuống trong chuỗi Proxy"
                                  disabled={globalIdx === modules.length - 1}
                                  onClick={() =>
                                    moveModuleImmediate(globalIdx, 1)
                                  }
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] disabled:opacity-35 whitespace-nowrap"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                  <span>Xuống</span>
                                </button>
                                {isPersonalSlot && !isContentEmpty && (
                                  <button
                                    type="button"
                                    aria-label="Xóa trắng nội dung slot cá nhân"
                                    onClick={() =>
                                      clearPersonalSlotContent(globalIdx)
                                    }
                                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] hover:text-white whitespace-nowrap"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Xóa trắng</span>
                                  </button>
                                )}
                                {isDeletable &&
                                  (confirmDeleteId === rowKey ? (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteCustomModule(globalIdx)
                                        }
                                        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-rose-500/22 px-2.5 text-xs font-semibold text-rose-100 ring-1 ring-inset ring-rose-400/40 transition-colors hover:bg-rose-500/32 whitespace-nowrap"
                                      >
                                        <span>Xác nhận xóa</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="inline-flex min-h-[36px] items-center rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.1] whitespace-nowrap"
                                      >
                                        Hủy
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      aria-label="Xóa mô-đun tùy chỉnh"
                                      onClick={() => setConfirmDeleteId(rowKey)}
                                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-rose-500/12 px-2.5 text-xs font-medium text-rose-200 ring-1 ring-inset ring-rose-400/25 transition-colors hover:bg-rose-500/22 whitespace-nowrap"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>Xóa</span>
                                    </button>
                                  ))}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSavePreset(modules, prefill, {
                                      exclusiveStyleMode,
                                    })
                                  }
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-sky-500/20 px-3 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/30 whitespace-nowrap"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                  <span>Lưu</span>
                                </button>
                              </div>
                            </div>

                            {isPersonalSlot && (
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-300">
                                  Tên slot cá nhân
                                </label>
                                <input
                                  type="text"
                                  value={mod.name || ''}
                                  onChange={(e) =>
                                    updateModuleField(globalIdx, {
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder="Ví dụ: Đồ riêng — Gu tả tâm lý sắc lạnh..."
                                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/90 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                                />
                              </div>
                            )}

                            {isDeletable && (
                              <div className="grid gap-2.5 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-300">
                                    Tên mô-đun
                                  </label>
                                  <input
                                    type="text"
                                    value={mod.name || ''}
                                    onChange={(e) =>
                                      updateModuleField(globalIdx, {
                                        name: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/90 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-300">
                                    Nhóm phân loại
                                  </label>
                                  <select
                                    value={currentGroup}
                                    onChange={(e) =>
                                      updateModuleGroupImmediate(
                                        globalIdx,
                                        e.target.value as PresetGroupId,
                                      )
                                    }
                                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/90 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                                  >
                                    {PRESET_GROUPS.map((g) => (
                                      <option key={g.id} value={g.id}>
                                        {g.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            <textarea
                              value={mod.content || ''}
                              onChange={(e) =>
                                updateModuleField(globalIdx, {
                                  content: e.target.value,
                                })
                              }
                              placeholder={
                                isPersonalSlot
                                  ? 'Nhập chỉ dẫn văn phong, gu miêu tả, cách xưng hô hoặc quy tắc riêng của bạn. Khi bật slot này, nội dung sẽ tự động tiêm vào Proxy cùng các Preset đang bật...'
                                  : 'Nhập nội dung chỉ dẫn của mô-đun Preset...'
                              }
                              rows={(mod.content || '').length > 500 ? 7 : 4}
                              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/90 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Collapsible Prefill Section */}
      <div className="rounded-2xl bg-[#162032]/84 ring-1 ring-white/[0.08] overflow-hidden">
        <button
          type="button"
          onClick={() => setPrefillOpen((prev) => !prev)}
          aria-expanded={prefillOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight text-slate-100">
              Prefill khởi động (Assistant)
            </h3>
            <p className="mt-0.5 text-xs text-slate-400 truncate">
              {tawaPreset.prefillEnabled
                ? 'Đang bật trong Cấu hình'
                : 'Đang tắt'}{' '}
              · {prefill || 'Trống'}
            </p>
          </div>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 shrink-0">
            {prefillOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>

        {prefillOpen && (
          <div className="space-y-2.5 border-t border-white/[0.06] px-4 py-3.5">
            <textarea
              value={prefill}
              onChange={(e) => setPrefill(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/90 px-3.5 py-2.5 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  onSavePreset(modules, prefill, { exclusiveStyleMode })
                }
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-sky-500/20 px-3.5 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/30 whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Lưu Prefill</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create New Preset Modal */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tạo mô-đun Preset mới"
          onClick={() => setCreateModalOpen(false)}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-[#070c16]/78 sm:items-center sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#162135]/98 ring-1 ring-white/[0.12] shadow-[0_24px_60px_-14px_rgba(2,6,23,0.9)] sm:rounded-3xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold tracking-tight text-slate-50">
                  Thêm mô-đun Preset mới
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Chèn trước Chat History và tự lưu vào ARK_LITE_AI_STUDIO_V1.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng khung tạo Preset"
                onClick={() => setCreateModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-slate-300 transition-colors hover:bg-white/[0.12] hover:text-white shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label
                  htmlFor="new-preset-name"
                  className="mb-1.5 block text-xs font-semibold text-slate-200"
                >
                  Tên mô-đun
                </label>
                <input
                  id="new-preset-name"
                  ref={draftNameInputRef}
                  type="text"
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    if (draftError) setDraftError('');
                  }}
                  placeholder="Ví dụ: Nhịp đối thoại tự nhiên, Quy tắc chiến đấu..."
                  className="w-full rounded-xl border border-white/[0.10] bg-[#0e1625]/92 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-slate-200">
                  Nhóm phân loại
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_GROUPS.map((group) => {
                    const selected = draftGroup === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setDraftGroup(group.id)}
                        className={`min-h-[40px] rounded-xl px-3 py-2 text-left text-xs font-semibold ring-1 ring-inset transition-colors ${
                          selected
                            ? 'bg-sky-500/20 text-sky-100 ring-sky-400/45'
                            : 'bg-white/[0.04] text-slate-300 ring-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        {group.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-preset-content"
                  className="mb-1.5 block text-xs font-semibold text-slate-200"
                >
                  Nội dung Preset
                </label>
                <textarea
                  id="new-preset-content"
                  value={draftContent}
                  onChange={(e) => {
                    setDraftContent(e.target.value);
                    if (draftError) setDraftError('');
                  }}
                  rows={6}
                  placeholder="Nhập chỉ dẫn hệ thống sẽ tiêm vào ngữ cảnh Proxy khi mô-đun này được bật..."
                  className="w-full rounded-xl border border-white/[0.10] bg-[#0e1625]/92 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#10192a]/85 px-3.5 py-3 ring-1 ring-inset ring-white/[0.07]">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100">
                    Kích hoạt ngay khi tạo
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {draftEnabled
                      ? 'Sẽ tiêm vào ngữ cảnh Proxy ngay lập tức.'
                      : 'Lưu ở trạng thái tắt, bật lại bất cứ lúc nào.'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draftEnabled}
                  aria-label="Kích hoạt ngay khi tạo Preset"
                  onClick={() => setDraftEnabled((v) => !v)}
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition-colors whitespace-nowrap shrink-0 ${
                    draftEnabled
                      ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/35'
                      : 'bg-white/[0.05] text-slate-400 ring-white/[0.09]'
                  }`}
                >
                  <span>{draftEnabled ? 'Bật' : 'Tắt'}</span>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      draftEnabled ? 'bg-emerald-500/80' : 'bg-slate-600/80'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                        draftEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </span>
                </button>
              </div>

              {draftError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-rose-300"
                >
                  {draftError}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="inline-flex min-h-[40px] items-center rounded-xl bg-white/[0.055] px-4 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreatePreset}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.48)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Lưu Preset mới</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
