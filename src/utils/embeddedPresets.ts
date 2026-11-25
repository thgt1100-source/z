import type {
  PresetGroupId,
  PresetModule,
  StoryImageConfig,
  StoryImageStylePreset,
  TawaPreset,
} from '../types/ark';

/**
 * ============================================================================
 * EMBEDDED DEFAULT USER PRESETS (ARK LITE — MOBILE EDITION)
 * ============================================================================
 * Các Preset do người dùng thêm bằng tay (Văn phong thể loại, Đồ riêng,
 * mô-đun tùy chỉnh, Kiểu phong cách vẽ ảnh tùy chỉnh, Mẫu Prompt sinh ảnh)
 * được nhúng trực tiếp tại đây để khi Remix sang tài khoản khác hoặc mở trên
 * trình duyệt mới hoàn toàn (chưa có `ARK_LITE_AI_STUDIO_V1`), ứng dụng sẽ
 * tự động nạp sẵn ngay từ lần mở đầu tiên.
 *
 * Nguyên tắc bảo toàn dữ liệu người dùng:
 * 1. Chỉ bổ sung những mục chưa có trong `ARK_LITE_AI_STUDIO_V1`, chống trùng lặp
 *    theo cả `id` lẫn cặp `(name, content)` đã chuẩn hóa.
 * 2. Không bao giờ ghi đè lên bản chỉnh sửa của người dùng.
 * 3. Nếu người dùng chủ động xóa một Preset nhúng mặc định, ID của nó được ghi
 *    vào `deletedEmbeddedIds` (hoặc `deletedEmbeddedStyleIds`) nên sẽ không tự
 *    mọc lại sau khi tải lại trang.
 * ============================================================================
 */

export interface EmbeddedPersonalSlotOverride {
  name?: string;
  content?: string;
  enabled?: boolean;
}

export interface EmbeddedBuiltinModuleOverride {
  name?: string;
  content?: string;
  enabled?: boolean;
}

export const EMBEDDED_CUSTOM_PRESET_MODULES: PresetModule[] = [];

export const EMBEDDED_PERSONAL_SLOT_OVERRIDES: Partial<
  Record<
    'm_personal_slot_1' | 'm_personal_slot_2' | 'm_personal_slot_3',
    EmbeddedPersonalSlotOverride
  >
> = {};

export const EMBEDDED_BUILTIN_MODULE_OVERRIDES: Record<
  string,
  EmbeddedBuiltinModuleOverride
> = {};

export const EMBEDDED_CUSTOM_IMAGE_STYLES: StoryImageStylePreset[] = [];

/**
 * Legacy Chinese LLM-planner template that accidentally leaked meta-instructions
 * ("任务：固定输出 4 个独立正文图片计划", "时间：${current_time}", hardcoded xianxia robes)
 * directly into ComfyUI / Seedream image prompts, causing garbled Chinese text blocks
 * and off-context outfits. Detected automatically so older saves self-heal.
 */
export function isLegacyPoisonedImagePromptTemplate(
  raw?: string | null,
): boolean {
  const txt = String(raw || '').trim();
  if (!txt) return false;
  return (
    /任务：固定输出\s*4\s*个独立正文图片计划/i.test(txt) ||
    /不要输出\s*col19/i.test(txt) ||
    /墨蓝束腰劲装\s*\+\s*银灰云纹披风/i.test(txt) ||
    (/在场角色完整外观资料/i.test(txt) && /扫描正文，按剧情顺序选取/i.test(txt))
  );
}

/**
 * Default embedded prompt template is intentionally empty so Ark Lite uses the
 * clean beat-aware visual builder (opening / middle / ending) with strict no-text
 * directives and exact scene/character grounding. Users can still write their own
 * custom template anytime in the Prompt Template panel.
 */
export const EMBEDDED_IMAGE_PROMPT_TEMPLATE = '';

export const EMBEDDED_PRESET_SETTINGS: {
  prefillEnabled?: boolean;
  prefill?: string;
  exclusiveStyleMode?: boolean;
} = {
  prefillEnabled: false,
  exclusiveStyleMode: true,
};

const VALID_PRESET_GROUPS = new Set<PresetGroupId>([
  'style',
  'personal',
  'perspective',
  'intimacy',
  'appearance',
  'core',
]);

function normalizeTextKey(val?: string): string {
  return String(val || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getModuleSignature(mod: Pick<PresetModule, 'name' | 'content'>): string {
  return `${normalizeTextKey(mod.name)}::${normalizeTextKey(mod.content)}`;
}

export function isEmbeddedCustomPresetId(id?: string): boolean {
  if (!id) return false;
  return EMBEDDED_CUSTOM_PRESET_MODULES.some((m) => m.id === id);
}

export function isEmbeddedCustomImageStyleId(id?: string): boolean {
  if (!id) return false;
  return EMBEDDED_CUSTOM_IMAGE_STYLES.some((s) => s.id === id);
}

export function normalizeDeletedEmbeddedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = typeof item === 'string' ? item.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function applyEmbeddedPersonalSlotOverrides(
  slots: PresetModule[],
): PresetModule[] {
  return slots.map((slot) => {
    const key = slot.id as
      | 'm_personal_slot_1'
      | 'm_personal_slot_2'
      | 'm_personal_slot_3';
    const override = EMBEDDED_PERSONAL_SLOT_OVERRIDES[key];
    if (!override) return { ...slot };
    return {
      ...slot,
      name:
        typeof override.name === 'string' && override.name.trim()
          ? override.name
          : slot.name,
      content:
        typeof override.content === 'string' ? override.content : slot.content,
      enabled:
        typeof override.enabled === 'boolean'
          ? override.enabled
          : slot.enabled,
    };
  });
}

export function applyEmbeddedBuiltinOverridesToDefaults(
  modules: PresetModule[],
): PresetModule[] {
  return modules.map((mod) => {
    const override = EMBEDDED_BUILTIN_MODULE_OVERRIDES[mod.id];
    if (!override) return { ...mod };
    return {
      ...mod,
      name:
        typeof override.name === 'string' && override.name.trim()
          ? override.name
          : mod.name,
      content:
        typeof override.content === 'string' ? override.content : mod.content,
      enabled:
        typeof override.enabled === 'boolean' ? override.enabled : mod.enabled,
    };
  });
}

export function getEmbeddedCustomPresetModules(): PresetModule[] {
  return EMBEDDED_CUSTOM_PRESET_MODULES.map((m) => ({
    ...m,
    isCustom: true,
    isEmbeddedDefault: true,
  }));
}

/**
 * Merges `EMBEDDED_CUSTOM_PRESET_MODULES` into an existing module list while:
 * - skipping any module explicitly deleted by the user (`deletedEmbeddedIds`)
 * - deduplicating by both `id` and normalized `(name + content)`
 * - preserving all user edits and ordering
 * - pre-filling empty personal slots ONLY if they are still completely untouched
 */
export function mergeEmbeddedPresetsIntoModules(
  modules: PresetModule[],
  options?: {
    deletedEmbeddedIds?: string[];
    defaultPersonalSlots?: PresetModule[];
  },
): PresetModule[] {
  const deletedSet = new Set(
    normalizeDeletedEmbeddedIds(options?.deletedEmbeddedIds),
  );
  const result = modules.map((m) => {
    // Fill untouched personal slot from EMBEDDED_PERSONAL_SLOT_OVERRIDES only when
    // the user's slot is still empty & still using its default name
    const slotKey = m.id as
      | 'm_personal_slot_1'
      | 'm_personal_slot_2'
      | 'm_personal_slot_3';
    const slotOverride = EMBEDDED_PERSONAL_SLOT_OVERRIDES[slotKey];
    if (
      slotOverride &&
      !deletedSet.has(m.id) &&
      !(m.content || '').trim() &&
      typeof slotOverride.content === 'string' &&
      slotOverride.content.trim()
    ) {
      const defaultSlot = options?.defaultPersonalSlots?.find(
        (s) => s.id === m.id,
      );
      const isDefaultName = !defaultSlot || m.name === defaultSlot.name;
      if (isDefaultName) {
        return {
          ...m,
          name:
            typeof slotOverride.name === 'string' && slotOverride.name.trim()
              ? slotOverride.name
              : m.name,
          content: slotOverride.content,
          enabled:
            typeof slotOverride.enabled === 'boolean'
              ? slotOverride.enabled
              : m.enabled,
        };
      }
    }
    return m;
  });

  if (!EMBEDDED_CUSTOM_PRESET_MODULES.length) {
    return result;
  }

  const existingIds = new Set(result.map((m) => m.id));
  const existingSignatures = new Set(
    result
      .filter((m) => (m.content || '').trim())
      .map((m) => getModuleSignature(m)),
  );

  const insertBeforeHistory = (mod: PresetModule) => {
    const insertIdx = result.findIndex(
      (m) =>
        m.content.trim() === 'Chat History' ||
        m.content.trim() === '</chathistory>',
    );
    if (insertIdx >= 0) {
      result.splice(insertIdx, 0, mod);
    } else {
      result.push(mod);
    }
  };

  for (const embedded of EMBEDDED_CUSTOM_PRESET_MODULES) {
    if (!embedded?.id || deletedSet.has(embedded.id)) continue;
    const sig = getModuleSignature(embedded);
    if (existingIds.has(embedded.id) || existingSignatures.has(sig)) {
      continue;
    }
    insertBeforeHistory({
      ...embedded,
      isCustom: true,
      isEmbeddedDefault: true,
    });
    existingIds.add(embedded.id);
    existingSignatures.add(sig);
  }

  return result;
}

export function mergeEmbeddedCustomImageStyles(
  userCustomStyles: StoryImageStylePreset[],
  deletedEmbeddedStyleIds?: string[],
): StoryImageStylePreset[] {
  const deletedSet = new Set(
    normalizeDeletedEmbeddedIds(deletedEmbeddedStyleIds),
  );
  const out = [...userCustomStyles];
  if (!EMBEDDED_CUSTOM_IMAGE_STYLES.length) return out;

  const seenIds = new Set(out.map((s) => s.id));
  const seenLabels = new Set(out.map((s) => normalizeTextKey(s.label)));

  for (const embedded of EMBEDDED_CUSTOM_IMAGE_STYLES) {
    if (!embedded?.id || deletedSet.has(embedded.id)) continue;
    const normLabel = normalizeTextKey(embedded.label);
    if (seenIds.has(embedded.id) || (normLabel && seenLabels.has(normLabel))) {
      continue;
    }
    out.push({
      ...embedded,
      isCustom: true,
      isEmbeddedDefault: true,
    });
    seenIds.add(embedded.id);
    if (normLabel) seenLabels.add(normLabel);
  }
  return out;
}

export interface UserPresetExportBundle {
  format: 'ark_lite_user_presets_v1';
  exportedAt: string;
  customModules: PresetModule[];
  personalSlots: Array<{
    id: string;
    name: string;
    content: string;
    enabled: boolean;
  }>;
  modifiedBuiltins: Array<{
    id: string;
    name: string;
    content: string;
    enabled: boolean;
    group?: PresetGroupId;
  }>;
  presetSettings: {
    prefillEnabled: boolean;
    prefill?: string;
    exclusiveStyleMode: boolean;
  };
  customImageStyles: StoryImageStylePreset[];
  imagePromptTemplate: string;
}

export interface UserPresetExportSummary {
  customStyleCount: number;
  customPersonalCount: number;
  customOtherCount: number;
  filledPersonalSlotCount: number;
  modifiedBuiltinCount: number;
  customImageStyleCount: number;
  hasCustomPromptTemplate: boolean;
  totalCapturedItems: number;
}

const BUILTIN_STATIC_IDS = new Set([
  'm1',
  'm2',
  'm3',
  'm4',
  'm_style_modern',
  'm_style_xianxia',
  'm_style_wuxia',
  'm_style_apocalypse',
  'm_style_ancient',
  'm_personal_slot_1',
  'm_personal_slot_2',
  'm_personal_slot_3',
  'm_grounded_intimacy',
  'm_narrative_person',
  'm_direct_terms',
  'm_wild_conquest_intimacy',
  'm_grooming_and_dress',
  'm_appearance_and_posture',
  'm_body_physics',
]);

function inferModuleGroup(mod: PresetModule): PresetGroupId {
  if (mod.group && VALID_PRESET_GROUPS.has(mod.group)) return mod.group;
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
  if (
    mod.isPersonalSlot ||
    /^m_personal_slot_\d+$/i.test(id) ||
    /^đồ riêng\b/i.test(name)
  ) {
    return 'personal';
  }
  return 'core';
}

export function buildUserPresetExportBundle(
  tawaPreset: TawaPreset,
  storyImage: StoryImageConfig | undefined,
  defaultModules: PresetModule[],
  defaultPrefill: string,
): {
  bundle: UserPresetExportBundle;
  summary: UserPresetExportSummary;
} {
  const defaultById = new Map(defaultModules.map((m) => [m.id, m]));
  const modules = Array.isArray(tawaPreset?.modules) ? tawaPreset.modules : [];

  const customModules: PresetModule[] = [];
  const personalSlots: UserPresetExportBundle['personalSlots'] = [];
  const modifiedBuiltins: UserPresetExportBundle['modifiedBuiltins'] = [];

  for (const mod of modules) {
    if (!mod || typeof mod !== 'object') continue;
    const isPersonalBuiltIn =
      mod.isPersonalSlot || /^m_personal_slot_\d+$/i.test(mod.id || '');
    if (isPersonalBuiltIn) {
      const def = defaultById.get(mod.id);
      const hasContent = Boolean((mod.content || '').trim());
      const renamed = Boolean(def && mod.name.trim() !== def.name.trim());
      if (hasContent || renamed || mod.enabled) {
        personalSlots.push({
          id: mod.id,
          name: mod.name,
          content: mod.content,
          enabled: Boolean(mod.enabled),
        });
      }
      continue;
    }

    const isCustomMod =
      Boolean(mod.isCustom) ||
      (mod.id || '').startsWith('m_custom_') ||
      !BUILTIN_STATIC_IDS.has(mod.id);

    if (isCustomMod) {
      const trimmedContent = (mod.content || '').trim();
      if (trimmedContent === 'Chat History' || trimmedContent === '</chathistory>') {
        continue;
      }
      customModules.push({
        id: mod.id,
        name: mod.name,
        enabled: Boolean(mod.enabled),
        content: mod.content,
        group: inferModuleGroup(mod),
        isCustom: true,
      });
      continue;
    }

    const def = defaultById.get(mod.id);
    if (def) {
      const contentChanged =
        (mod.content || '').replace(/\r\n/g, '\n').trim() !==
        (def.content || '').replace(/\r\n/g, '\n').trim();
      const nameChanged = (mod.name || '').trim() !== (def.name || '').trim();
      if (contentChanged || nameChanged) {
        modifiedBuiltins.push({
          id: mod.id,
          name: mod.name,
          content: mod.content,
          enabled: Boolean(mod.enabled),
          ...(mod.group ? { group: mod.group } : {}),
        });
      }
    }
  }

  const customImageStyles: StoryImageStylePreset[] = Array.isArray(
    storyImage?.customStyles,
  )
    ? storyImage.customStyles
        .filter((s) => s && s.id && s.label)
        .map((s) => ({
          id: s.id,
          label: s.label,
          category: s.category || 'Tùy chỉnh',
          description: s.description || '',
          promptGuide: s.promptGuide || s.promptHint || '',
          promptHint: s.promptHint || s.promptGuide || '',
          isCustom: true,
        }))
    : [];

  const imagePromptTemplate = (storyImage?.promptTemplate || '').trim();
  const customPrefill =
    (tawaPreset?.prefill || '').trim() &&
    (tawaPreset?.prefill || '').trim() !== defaultPrefill.trim()
      ? tawaPreset.prefill
      : undefined;

  const bundle: UserPresetExportBundle = {
    format: 'ark_lite_user_presets_v1',
    exportedAt: new Date().toISOString(),
    customModules,
    personalSlots,
    modifiedBuiltins,
    presetSettings: {
      prefillEnabled: Boolean(tawaPreset?.prefillEnabled),
      ...(customPrefill ? { prefill: customPrefill } : {}),
      exclusiveStyleMode: tawaPreset?.exclusiveStyleMode ?? true,
    },
    customImageStyles,
    imagePromptTemplate,
  };

  const customStyleCount = customModules.filter(
    (m) => inferModuleGroup(m) === 'style',
  ).length;
  const customPersonalCount = customModules.filter(
    (m) => inferModuleGroup(m) === 'personal',
  ).length;
  const customOtherCount =
    customModules.length - customStyleCount - customPersonalCount;
  const filledPersonalSlotCount = personalSlots.length;
  const modifiedBuiltinCount = modifiedBuiltins.length;
  const customImageStyleCount = customImageStyles.length;
  const hasCustomPromptTemplate = Boolean(imagePromptTemplate);

  const totalCapturedItems =
    customModules.length +
    filledPersonalSlotCount +
    modifiedBuiltinCount +
    customImageStyleCount +
    (hasCustomPromptTemplate ? 1 : 0);

  return {
    bundle,
    summary: {
      customStyleCount,
      customPersonalCount,
      customOtherCount,
      filledPersonalSlotCount,
      modifiedBuiltinCount,
      customImageStyleCount,
      hasCustomPromptTemplate,
      totalCapturedItems,
    },
  };
}

export type ParsePresetBundleResult =
  | {
      ok: true;
      bundle: UserPresetExportBundle;
      sourceKind: 'preset_pack' | 'ark_backup';
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Parses either a dedicated `ark_lite_user_presets_v1` JSON file OR a full
 * Ark Lite backup/save JSON containing `tawaPreset` / `storyImage`.
 */
export function parseUserPresetImportBundle(
  rawText: string,
  defaultModules: PresetModule[],
  defaultPrefill: string,
): ParsePresetBundleResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: 'Tệp không phải định dạng JSON hợp lệ.',
    };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Dữ liệu Preset JSON không hợp lệ.' };
  }
  const rec = parsed as Record<string, unknown>;

  // Case 1: Dedicated ark_lite_user_presets_v1 bundle
  if (rec.format === 'ark_lite_user_presets_v1') {
    const customModules: PresetModule[] = Array.isArray(rec.customModules)
      ? rec.customModules
          .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
          .map((m, idx) => {
            const rawGroup = String(m.group || '');
            const group = VALID_PRESET_GROUPS.has(rawGroup as PresetGroupId)
              ? (rawGroup as PresetGroupId)
              : undefined;
            return {
              id:
                typeof m.id === 'string' && m.id.trim()
                  ? m.id.trim()
                  : `m_custom_imp_${Date.now()}_${idx}`,
              name: String(m.name || `Preset tùy chỉnh ${idx + 1}`).trim(),
              enabled: Boolean(m.enabled),
              content: String(m.content || ''),
              ...(group ? { group } : {}),
              isCustom: true,
            };
          })
          .filter((m) => m.name && m.content.trim())
      : [];

    const personalSlots: UserPresetExportBundle['personalSlots'] = Array.isArray(
      rec.personalSlots,
    )
      ? rec.personalSlots
          .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
          .map((s) => ({
            id: String(s.id || '').trim(),
            name: String(s.name || '').trim(),
            content: String(s.content || ''),
            enabled: Boolean(s.enabled),
          }))
          .filter((s) => /^m_personal_slot_\d+$/i.test(s.id))
      : [];

    const modifiedBuiltins: UserPresetExportBundle['modifiedBuiltins'] = Array.isArray(
      rec.modifiedBuiltins,
    )
      ? rec.modifiedBuiltins
          .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
          .map((m) => {
            const rawGroup = String(m.group || '');
            const group = VALID_PRESET_GROUPS.has(rawGroup as PresetGroupId)
              ? (rawGroup as PresetGroupId)
              : undefined;
            return {
              id: String(m.id || '').trim(),
              name: String(m.name || '').trim(),
              content: String(m.content || ''),
              enabled: Boolean(m.enabled),
              ...(group ? { group } : {}),
            };
          })
          .filter((m) => m.id && m.name)
      : [];

    const customImageStyles: StoryImageStylePreset[] = Array.isArray(
      rec.customImageStyles,
    )
      ? rec.customImageStyles
          .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
          .map((s, idx) => {
            const label = String(s.label || '').trim();
            const promptGuide = String(
              s.promptGuide || s.promptHint || s.description || label,
            ).trim();
            return {
              id:
                typeof s.id === 'string' && s.id.trim()
                  ? s.id.trim()
                  : `custom_style_imp_${Date.now()}_${idx}`,
              label,
              category: String(s.category || 'Tùy chỉnh').trim() || 'Tùy chỉnh',
              description: String(s.description || '').trim(),
              promptGuide,
              promptHint: String(s.promptHint || promptGuide).trim(),
              isCustom: true,
            };
          })
          .filter((s) => s.id && s.label)
      : [];

    const rawSettings =
      rec.presetSettings && typeof rec.presetSettings === 'object'
        ? (rec.presetSettings as Record<string, unknown>)
        : {};

    return {
      ok: true,
      sourceKind: 'preset_pack',
      bundle: {
        format: 'ark_lite_user_presets_v1',
        exportedAt:
          typeof rec.exportedAt === 'string'
            ? rec.exportedAt
            : new Date().toISOString(),
        customModules,
        personalSlots,
        modifiedBuiltins,
        presetSettings: {
          prefillEnabled: Boolean(rawSettings.prefillEnabled),
          ...(typeof rawSettings.prefill === 'string' && rawSettings.prefill.trim()
            ? { prefill: rawSettings.prefill }
            : {}),
          exclusiveStyleMode:
            typeof rawSettings.exclusiveStyleMode === 'boolean'
              ? rawSettings.exclusiveStyleMode
              : true,
        },
        customImageStyles,
        imagePromptTemplate:
          typeof rec.imagePromptTemplate === 'string'
            ? rec.imagePromptTemplate.trim()
            : '',
      },
    };
  }

  // Case 2: Full Ark Lite save/backup JSON (has `tawaPreset` or `state.tawaPreset`)
  const root =
    rec.state && typeof rec.state === 'object'
      ? (rec.state as Record<string, unknown>)
      : rec;

  if (root.tawaPreset && typeof root.tawaPreset === 'object') {
    const { bundle } = buildUserPresetExportBundle(
      root.tawaPreset as TawaPreset,
      root.storyImage as StoryImageConfig | undefined,
      defaultModules,
      defaultPrefill,
    );
    return {
      ok: true,
      sourceKind: 'ark_backup',
      bundle,
    };
  }

  return {
    ok: false,
    error:
      'Không tìm thấy dữ liệu Preset trong tệp JSON này. Hãy dùng tệp xuất từ nút "Xuất bộ Preset (.json)" hoặc tệp sao lưu Ark Lite.',
  };
}

export function mergeImportedPresetBundle(
  currentModules: PresetModule[],
  currentStoryImage: StoryImageConfig | undefined,
  bundle: UserPresetExportBundle,
): {
  nextModules: PresetModule[];
  addedCustomCount: number;
  updatedPersonalCount: number;
  updatedBuiltinCount: number;
  nextStoryImagePatch: Partial<StoryImageConfig> | null;
  addedImageStyleCount: number;
  updatedPromptTemplate: boolean;
} {
  let nextModules = [...currentModules];
  let addedCustomCount = 0;
  let updatedPersonalCount = 0;
  let updatedBuiltinCount = 0;

  // 1. Update personal slots (m_personal_slot_1..3) when imported slot has content/name
  for (const slot of bundle.personalSlots) {
    const idx = nextModules.findIndex((m) => m.id === slot.id);
    if (idx >= 0) {
      const existing = nextModules[idx];
      const changed =
        existing.name !== slot.name ||
        existing.content !== slot.content ||
        existing.enabled !== slot.enabled;
      if (changed) {
        nextModules[idx] = {
          ...existing,
          name: slot.name || existing.name,
          content: slot.content,
          enabled: slot.enabled,
        };
        updatedPersonalCount += 1;
      }
    }
  }

  // 2. Apply modified builtins if present
  for (const mod of bundle.modifiedBuiltins) {
    const idx = nextModules.findIndex((m) => m.id === mod.id);
    if (idx >= 0) {
      const existing = nextModules[idx];
      const changed =
        existing.name !== mod.name || existing.content !== mod.content;
      if (changed) {
        nextModules[idx] = {
          ...existing,
          name: mod.name || existing.name,
          content: mod.content,
          enabled: mod.enabled,
        };
        updatedBuiltinCount += 1;
      }
    }
  }

  // 3. Merge custom modules with deduplication (by id or normalized name+content)
  const existingIds = new Set(nextModules.map((m) => m.id));
  const existingSignatures = new Set(
    nextModules
      .filter((m) => (m.content || '').trim())
      .map((m) => getModuleSignature(m)),
  );

  for (const custom of bundle.customModules) {
    const sig = getModuleSignature(custom);
    if (existingIds.has(custom.id) || existingSignatures.has(sig)) {
      continue;
    }
    const insertIdx = nextModules.findIndex(
      (m) =>
        m.content.trim() === 'Chat History' ||
        m.content.trim() === '</chathistory>',
    );
    const toInsert: PresetModule = {
      ...custom,
      isCustom: true,
    };
    if (insertIdx >= 0) {
      nextModules.splice(insertIdx, 0, toInsert);
    } else {
      nextModules.push(toInsert);
    }
    existingIds.add(toInsert.id);
    existingSignatures.add(sig);
    addedCustomCount += 1;
  }

  // 4. Merge custom image styles & image prompt template
  let nextStoryImagePatch: Partial<StoryImageConfig> | null = null;
  let addedImageStyleCount = 0;
  let updatedPromptTemplate = false;

  if (currentStoryImage) {
    const existingStyles = Array.isArray(currentStoryImage.customStyles)
      ? [...currentStoryImage.customStyles]
      : [];
    const seenStyleIds = new Set(existingStyles.map((s) => s.id));
    const seenStyleLabels = new Set(
      existingStyles.map((s) => normalizeTextKey(s.label)),
    );

    for (const style of bundle.customImageStyles) {
      const normLabel = normalizeTextKey(style.label);
      if (seenStyleIds.has(style.id) || (normLabel && seenStyleLabels.has(normLabel))) {
        continue;
      }
      existingStyles.push({ ...style, isCustom: true });
      seenStyleIds.add(style.id);
      if (normLabel) seenStyleLabels.add(normLabel);
      addedImageStyleCount += 1;
    }

    const patch: Partial<StoryImageConfig> = {};
    if (addedImageStyleCount > 0) {
      patch.customStyles = existingStyles;
    }
    if (
      bundle.imagePromptTemplate &&
      !isLegacyPoisonedImagePromptTemplate(bundle.imagePromptTemplate) &&
      bundle.imagePromptTemplate !== (currentStoryImage.promptTemplate || '').trim()
    ) {
      patch.promptTemplate = bundle.imagePromptTemplate;
      updatedPromptTemplate = true;
    }
    if (Object.keys(patch).length > 0) {
      nextStoryImagePatch = patch;
    }
  }

  return {
    nextModules,
    addedCustomCount,
    updatedPersonalCount,
    updatedBuiltinCount,
    nextStoryImagePatch,
    addedImageStyleCount,
    updatedPromptTemplate,
  };
}
