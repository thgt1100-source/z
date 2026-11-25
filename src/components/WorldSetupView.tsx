import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Compass,
  Edit3,
  FilePlus2,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  ScrollText,
  Sparkles,
  Trash2,
  UserCheck,
  UserX,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import type {
  ArkState,
  DramaLevel,
  ViewName,
  WorldGenreId,
  WorldLaunchMode,
  WorldSetupNpcDraft,
  WorldSetupPayload,
} from '../types/ark';
import {
  generateWorldSetupWithAi,
  WORLD_SETUP_IDEA_MAX_CHARS,
} from '../utils/api';
import {
  daysInMonth,
  formatStoryClock,
  normalizeStoryClock,
} from '../utils/storyClock';
import {
  DRAMA_LEVEL_OPTIONS,
  getWorldGenrePreset,
  WORLD_GENRE_PRESETS,
} from '../utils/worldPresets';
import {
  CULTIVATION_SYSTEM_META,
  detectCultivationSystemKind,
} from '../utils/cultivation';
import { CharacterNameBadge } from './CharacterNameBadge';

type AccordionKey = 'clock' | 'rules' | 'mc' | 'npcs' | 'opening';

interface WorldSetupViewProps {
  state: ArkState;
  hasProxyConfigured: boolean;
  onStartConfiguredWorld: (payload: WorldSetupPayload) => void;
  onStartBlankSession: () => void;
  onNavigate: (view: ViewName) => void;
  onNotify: (msg: string, type?: 'info' | 'err') => void;
  onAppendProxyLog: (line: string) => void;
}

const TIME_PRESETS = [
  { label: 'Sáng', hour: 8, minute: 0 },
  { label: 'Trưa', hour: 12, minute: 0 },
  { label: 'Chiều', hour: 15, minute: 30 },
  { label: 'Tối', hour: 20, minute: 0 },
  { label: 'Đêm', hour: 23, minute: 0 },
];

export function WorldSetupView({
  state,
  hasProxyConfigured,
  onStartConfiguredWorld,
  onStartBlankSession,
  onNavigate,
  onNotify,
  onAppendProxyLog,
}: WorldSetupViewProps) {
  const initialGenre: WorldGenreId = state.world?.genre || 'slice_of_life';
  const initialPreset = getWorldGenrePreset(initialGenre);

  // Quick AI idea state (supports full detailed world prompts up to 12,000 chars)
  const [ideaInput, setIdeaInput] = useState('');
  const [ideaExpanded, setIdeaExpanded] = useState(false);
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);
  const [aiStatusNote, setAiStatusNote] = useState<{
    text: string;
    isErr?: boolean;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generatingWorldLockRef = useRef(false);

  // Core world fields
  const [genre, setGenre] = useState<WorldGenreId>(initialGenre);
  const [enableMartialSystem, setEnableMartialSystem] = useState(false);
  const [worldName, setWorldName] = useState('');
  const [setting, setSetting] = useState('');

  // Clock fields
  const [clockYear, setClockYear] = useState(initialPreset.defaultClock.year);
  const [clockMonth, setClockMonth] = useState(initialPreset.defaultClock.month);
  const [clockDay, setClockDay] = useState(initialPreset.defaultClock.day);
  const [clockHour, setClockHour] = useState(initialPreset.defaultClock.hour);
  const [clockMinute, setClockMinute] = useState(
    initialPreset.defaultClock.minute,
  );
  const [eraLabel, setEraLabel] = useState(initialPreset.defaultClock.eraLabel);
  const [clockAutoAdvance, setClockAutoAdvance] = useState(true);
  const [clockTouched, setClockTouched] = useState(false);

  // Rules & atmosphere fields
  const [dramaLevel, setDramaLevel] = useState<DramaLevel>(
    initialPreset.defaultDramaLevel,
  );
  const [atmosphere, setAtmosphere] = useState('');
  const [rules, setRules] = useState('');

  // MC fields
  const [mcAbsentAtStart, setMcAbsentAtStart] = useState(false);
  const [mcName, setMcName] = useState(state.player?.name || '');
  const [mcPronoun, setMcPronoun] = useState(state.player?.pronoun || '');
  const [mcRole, setMcRole] = useState('');
  const [mcDescription, setMcDescription] = useState('');

  // Starting NPCs
  const [npcs, setNpcs] = useState<WorldSetupNpcDraft[]>([]);
  const [syncPortraitsAndStates, setSyncPortraitsAndStates] = useState(true);
  const [npcComposerOpen, setNpcComposerOpen] = useState(false);
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null);
  const [npcNameDraft, setNpcNameDraft] = useState('');
  const [npcRoleDraft, setNpcRoleDraft] = useState('');
  const [npcPersonalityDraft, setNpcPersonalityDraft] = useState('');
  const [npcAppearanceDraft, setNpcAppearanceDraft] = useState('');
  const [npcLocationDraft, setNpcLocationDraft] = useState('');
  const [npcMoodDraft, setNpcMoodDraft] = useState('');
  const [npcSecretDraft, setNpcSecretDraft] = useState('');

  // Opening scenario & launch mode
  const [openingScenario, setOpeningScenario] = useState('');
  const [launchMode, setLaunchMode] = useState<WorldLaunchMode>(
    hasProxyConfigured ? 'ai_opening' : 'direct_chat',
  );

  // Accordion open state (keep compact on mobile; user expands what they need)
  const [openSections, setOpenSections] = useState<Record<AccordionKey, boolean>>(
    {
      clock: false,
      rules: false,
      mc: false,
      npcs: false,
      opening: true,
    },
  );

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const currentPreset = useMemo(() => getWorldGenrePreset(genre), [genre]);

  const previewClock = useMemo(() => {
    const normalized = normalizeStoryClock({
      enabled: true,
      autoAdvance: clockAutoAdvance,
      initialized: true,
      year: clockYear,
      month: clockMonth,
      day: clockDay,
      hour: clockHour,
      minute: clockMinute,
      eraLabel,
    });
    return formatStoryClock(normalized);
  }, [
    clockAutoAdvance,
    clockDay,
    clockHour,
    clockMinute,
    clockMonth,
    clockYear,
    eraLabel,
  ]);

  const toggleSection = (key: AccordionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectGenre = (nextGenre: WorldGenreId) => {
    setGenre(nextGenre);
    if (nextGenre !== 'ancient') {
      setEnableMartialSystem(false);
    }
    const preset = getWorldGenrePreset(nextGenre);
    if (!clockTouched) {
      setClockYear(preset.defaultClock.year);
      setClockMonth(preset.defaultClock.month);
      setClockDay(preset.defaultClock.day);
      setClockHour(preset.defaultClock.hour);
      setClockMinute(preset.defaultClock.minute);
      setEraLabel(preset.defaultClock.eraLabel);
    }
    if (!rules.trim() && !atmosphere.trim()) {
      setDramaLevel(preset.defaultDramaLevel);
    }
  };

  const updateClockNumber = (
    field: 'day' | 'month' | 'year' | 'hour' | 'minute',
    rawVal: string,
  ) => {
    const parsed = parseInt(rawVal, 10);
    if (Number.isNaN(parsed)) return;
    setClockTouched(true);
    let y = clockYear;
    let mo = clockMonth;
    let d = clockDay;
    let h = clockHour;
    let min = clockMinute;
    if (field === 'year') y = Math.min(9999, Math.max(1, parsed));
    if (field === 'month') mo = Math.min(12, Math.max(1, parsed));
    if (field === 'day') d = parsed;
    if (field === 'hour') h = Math.min(23, Math.max(0, parsed));
    if (field === 'minute') min = Math.min(59, Math.max(0, parsed));
    const maxD = daysInMonth(y, mo);
    d = Math.min(maxD, Math.max(1, d));
    setClockYear(y);
    setClockMonth(mo);
    setClockDay(d);
    setClockHour(h);
    setClockMinute(min);
  };

  const handleApplyStarterTemplate = () => {
    const tpl = currentPreset.starterTemplate;
    setWorldName(tpl.worldName);
    setSetting(tpl.setting);
    setRules(tpl.rules);
    setAtmosphere(tpl.atmosphere);
    setDramaLevel(tpl.dramaLevel);
    setClockYear(currentPreset.defaultClock.year);
    setClockMonth(currentPreset.defaultClock.month);
    setClockDay(currentPreset.defaultClock.day);
    setClockHour(currentPreset.defaultClock.hour);
    setClockMinute(currentPreset.defaultClock.minute);
    setEraLabel(currentPreset.defaultClock.eraLabel);
    setClockTouched(true);
    setMcName(tpl.mc.name);
    setMcPronoun(tpl.mc.pronoun);
    setMcRole(tpl.mc.role);
    setMcDescription(tpl.mc.description);
    setMcAbsentAtStart(tpl.mc.absentAtStart);
    const nowTs = Date.now();
    setNpcs(
      tpl.npcs.map((n, i) => ({
        ...n,
        id: `tpl_npc_${nowTs}_${i}`,
      })),
    );
    setOpeningScenario(tpl.openingScenario);
    setOpenSections((prev) => ({ ...prev, npcs: true, opening: true }));
    setAiStatusNote({
      text: `Đã điền mẫu gợi ý cho thể loại ${currentPreset.label}. Bạn có thể chỉnh sửa lại trước khi bắt đầu.`,
    });
  };

  const handleAiGenerateWorld = async (overrideIdea?: string) => {
    if (generatingWorldLockRef.current) return;
    const query = (overrideIdea ?? ideaInput).trim();
    if (!query) {
      setAiStatusNote({
        text: 'Hãy nhập ý tưởng ngắn (ví dụ: "tiệc hậu trường showbiz LA", "quán trọ nhỏ thời cổ đại").',
        isErr: true,
      });
      return;
    }

    generatingWorldLockRef.current = true;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGeneratingWorld(true);
    setAiStatusNote(null);

    try {
      const res = await generateWorldSetupWithAi({
        state,
        idea: query,
        preferredGenre: genre,
        signal: controller.signal,
        onLog: onAppendProxyLog,
      });

      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      if (!res.ok || !res.data) {
        setAiStatusNote({
          text: res.error || 'Không thể dựng thế giới bằng AI lúc này.',
          isErr: true,
        });
        return;
      }

      const d = res.data;
      setGenre(d.genre);
      setWorldName(d.worldName);
      setSetting(d.setting);
      setRules(d.rules);
      setAtmosphere(d.atmosphere);
      setDramaLevel(d.dramaLevel);
      setClockYear(d.startClock.year);
      setClockMonth(d.startClock.month);
      setClockDay(d.startClock.day);
      setClockHour(d.startClock.hour);
      setClockMinute(d.startClock.minute);
      setEraLabel(d.startClock.eraLabel);
      setClockTouched(true);
      setMcName(d.mc.name);
      setMcPronoun(d.mc.pronoun);
      setMcRole(d.mc.role);
      setMcDescription(d.mc.description);
      setMcAbsentAtStart(d.mc.absentAtStart);
      setNpcs(d.npcs);
      setOpeningScenario(d.openingScenario);
      setOpenSections((prev) => ({
        ...prev,
        clock: Boolean(d.startClock.eraLabel),
        rules: Boolean(d.rules || d.atmosphere),
        mc: Boolean(d.mc.name || d.mc.role || d.mc.description),
        npcs: d.npcs.length > 0,
        opening: true,
      }));

      const matchedGenre = getWorldGenrePreset(d.genre);
      setAiStatusNote({
        text: `AI đã dựng xong "${d.worldName}" (${matchedGenre.label}) với ${d.npcs.length} NPC khởi đầu. Kiểm tra hoặc chỉnh sửa bên dưới rồi bấm "Bắt đầu truyện".`,
      });
    } finally {
      generatingWorldLockRef.current = false;
      setIsGeneratingWorld(false);
    }
  };

  const handleCancelAiGenerate = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    generatingWorldLockRef.current = false;
    setIsGeneratingWorld(false);
    setAiStatusNote({ text: 'Đã dừng yêu cầu AI dựng thế giới.' });
  };

  const resetNpcDraft = () => {
    setEditingNpcId(null);
    setNpcNameDraft('');
    setNpcRoleDraft('');
    setNpcPersonalityDraft('');
    setNpcAppearanceDraft('');
    setNpcLocationDraft('');
    setNpcMoodDraft('');
    setNpcSecretDraft('');
  };

  const handleSaveNpcDraft = () => {
    const cleanName = npcNameDraft.trim();
    if (!cleanName) {
      onNotify('Hãy nhập tên nhân vật / NPC.', 'err');
      return;
    }
    const entry: WorldSetupNpcDraft = {
      id: editingNpcId || `setup_npc_${Date.now()}`,
      name: cleanName,
      role: npcRoleDraft.trim() || 'NPC',
      personality: npcPersonalityDraft.trim(),
      appearance: npcAppearanceDraft.trim(),
      initialLocation: npcLocationDraft.trim(),
      initialMood: npcMoodDraft.trim(),
      ...(npcSecretDraft.trim()
        ? { privateSecret: npcSecretDraft.trim() }
        : {}),
    };
    if (editingNpcId) {
      setNpcs((prev) => prev.map((n) => (n.id === editingNpcId ? entry : n)));
    } else {
      setNpcs((prev) => [...prev, entry]);
    }
    resetNpcDraft();
    setNpcComposerOpen(false);
  };

  const handleEditNpc = (npc: WorldSetupNpcDraft) => {
    setEditingNpcId(npc.id);
    setNpcNameDraft(npc.name);
    setNpcRoleDraft(npc.role);
    setNpcPersonalityDraft(npc.personality);
    setNpcAppearanceDraft(npc.appearance);
    setNpcLocationDraft(npc.initialLocation || '');
    setNpcMoodDraft(npc.initialMood || '');
    setNpcSecretDraft(npc.privateSecret || '');
    setNpcComposerOpen(true);
  };

  const handleRemoveNpc = (id: string) => {
    setNpcs((prev) => prev.filter((n) => n.id !== id));
    if (editingNpcId === id) {
      resetNpcDraft();
      setNpcComposerOpen(false);
    }
  };

  const handleResetForm = () => {
    const preset = getWorldGenrePreset(genre);
    setIdeaInput('');
    setWorldName('');
    setSetting('');
    setRules('');
    setAtmosphere('');
    setDramaLevel(preset.defaultDramaLevel);
    setClockYear(preset.defaultClock.year);
    setClockMonth(preset.defaultClock.month);
    setClockDay(preset.defaultClock.day);
    setClockHour(preset.defaultClock.hour);
    setClockMinute(preset.defaultClock.minute);
    setEraLabel(preset.defaultClock.eraLabel);
    setClockTouched(false);
    setMcAbsentAtStart(false);
    setMcName('');
    setMcPronoun('');
    setMcRole('');
    setMcDescription('');
    setNpcs([]);
    resetNpcDraft();
    setNpcComposerOpen(false);
    setOpeningScenario('');
    setAiStatusNote(null);
  };

  const handleSubmitWorld = () => {
    const cleanWorldName =
      worldName.trim() ||
      ideaInput.trim().slice(0, 48) ||
      `Thế giới ${currentPreset.label}`;

    const payload: WorldSetupPayload = {
      worldName: cleanWorldName,
      genre,
      genreLabel: currentPreset.label,
      setting: setting.trim(),
      rules: rules.trim(),
      atmosphere: atmosphere.trim(),
      dramaLevel,
      startClock: {
        year: clockYear,
        month: clockMonth,
        day: clockDay,
        hour: clockHour,
        minute: clockMinute,
        eraLabel: eraLabel.trim(),
        autoAdvance: clockAutoAdvance,
      },
      mc: {
        name: mcName.trim(),
        pronoun: mcPronoun.trim(),
        role: mcRole.trim(),
        description: mcDescription.trim(),
        absentAtStart: mcAbsentAtStart,
      },
      npcs,
      syncPortraitsAndStates,
      openingScenario: openingScenario.trim(),
      launchMode,
      ...(genre === 'ancient' && enableMartialSystem
        ? { enableMartialSystem: true }
        : {}),
    };

    onStartConfiguredWorld(payload);
  };

  const detectedCultivationKind = useMemo(
    () =>
      detectCultivationSystemKind({
        genre,
        genreLabel: currentPreset.label,
        worldName,
        setting,
        rules,
        mcRole,
        mcDesc: mcDescription,
        openingScenario,
        enableMartialSystem: genre === 'ancient' ? enableMartialSystem : false,
      }),
    [
      currentPreset.label,
      enableMartialSystem,
      genre,
      mcDescription,
      mcRole,
      openingScenario,
      rules,
      setting,
      worldName,
    ],
  );

  const dramaSummaryLabel =
    DRAMA_LEVEL_OPTIONS.find((d) => d.id === dramaLevel)?.label || 'Cân bằng';

  const mcSummaryText = mcAbsentAtStart
    ? 'Không có mặt từ đầu · Tập trung dàn NPC'
    : mcName.trim()
      ? `${mcName.trim()}${mcRole.trim() ? ` · ${mcRole.trim()}` : ''}`
      : 'Để trống (AI tự linh hoạt)';

  const npcSummaryText =
    npcs.length > 0
      ? `${npcs.length} nhân vật${syncPortraitsAndStates ? ' · Đồng bộ Ảnh & Trạng thái' : ''}`
      : 'Chưa thêm · AI tự giới thiệu theo diễn biến';

  const openingSummaryText =
    launchMode === 'ai_opening'
      ? openingScenario.trim()
        ? 'AI viết mở màn từ tình huống đã nhập'
        : 'AI tự viết cảnh mở màn từ bối cảnh'
      : 'Vào thẳng trang truyện (tự nhập lượt đầu)';

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('lobby')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4 text-slate-300" />
            <span>Sảnh</span>
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-50 sm:text-lg">
              Khởi tạo thế giới mới
            </h1>
            <p className="text-xs text-slate-400">
              Dựng bối cảnh, mốc thời gian, nhân vật và tình huống mở màn
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartBlankSession}
          title="Mở ngay trang truyện trống mà không điền biểu mẫu"
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
        >
          <FilePlus2 className="h-3.5 w-3.5 text-sky-300" />
          <span>Vào trang trống</span>
        </button>
      </div>

      {/* Block 1: AI Worldbuilder (Short idea or Full detailed world prompt up to 12,000 chars) */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 shrink-0 text-sky-300" />
            <h2 className="text-sm font-bold text-slate-50">
              AI dựng nhanh từ ý tưởng / thiết lập chi tiết
            </h2>
          </div>
          {!hasProxyConfigured && (
            <button
              type="button"
              onClick={() => onNavigate('config')}
              className="text-xs font-semibold text-amber-300 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-200 whitespace-nowrap"
            >
              Chưa cài Proxy
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="relative">
            <textarea
              value={ideaInput}
              maxLength={WORLD_SETUP_IDEA_MAX_CHARS}
              rows={ideaExpanded ? 11 : 4}
              onChange={(e) =>
                setIdeaInput(e.target.value.slice(0, WORLD_SETUP_IDEA_MAX_CHARS))
              }
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isGeneratingWorld) {
                  e.preventDefault();
                  void handleAiGenerateWorld();
                }
              }}
              placeholder='Nhập ý tưởng ngắn hoặc dán trọn bộ thiết lập thế giới (nhiều dòng thời gian, bản đồ địa lý, môn phái, cảnh giới, luật chơi, xuất thân MC...). Kéo góc dưới để giãn khung.'
              className={`w-full resize-y rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20 ${
                ideaExpanded ? 'min-h-[240px]' : 'min-h-[108px]'
              }`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`tabular-nums font-medium ${
                  ideaInput.length >= WORLD_SETUP_IDEA_MAX_CHARS - 200
                    ? 'text-amber-300'
                    : 'text-slate-400'
                }`}
              >
                {ideaInput.length.toLocaleString('vi-VN')} /{' '}
                {WORLD_SETUP_IDEA_MAX_CHARS.toLocaleString('vi-VN')} ký tự
              </span>
              <button
                type="button"
                onClick={() => setIdeaExpanded((v) => !v)}
                className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-white/[0.05] px-2 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.1] hover:text-white"
              >
                {ideaExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    <span>Thu gọn khung</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    <span>Mở rộng khung</span>
                  </>
                )}
              </button>
              {ideaInput.length > 0 && !isGeneratingWorld && (
                <button
                  type="button"
                  onClick={() => setIdeaInput('')}
                  className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-white/[0.04] px-2 text-[11px] text-slate-400 hover:bg-white/[0.09] hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                  <span>Xóa</span>
                </button>
              )}
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              {isGeneratingWorld ? (
                <button
                  type="button"
                  onClick={handleCancelAiGenerate}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500/16 px-4 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/32 transition-all hover:bg-rose-500/24 sm:flex-none whitespace-nowrap"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang dựng · Hủy</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAiGenerateWorld()}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-[0_8px_20px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] sm:flex-none whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 text-sky-100" />
                  <span>AI dựng thế giới</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleApplyStarterTemplate}
                disabled={isGeneratingWorld}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-white/[0.055] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
              >
                Điền mẫu
              </button>
            </div>
          </div>
        </div>

        {/* Clickable quick idea suggestions */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-0.5">Gợi ý:</span>
          {currentPreset.quickIdeas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setIdeaInput(idea)}
              className="rounded-lg bg-white/[0.045] px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-sky-500/14 hover:text-sky-100 hover:ring-sky-400/30"
            >
              {idea}
            </button>
          ))}
        </div>

        {aiStatusNote && (
          <div
            className={`mt-3 flex items-start justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs ring-1 ring-inset ${
              aiStatusNote.isErr
                ? 'bg-rose-500/12 text-rose-100 ring-rose-400/30'
                : 'bg-emerald-500/12 text-emerald-100 ring-emerald-400/28'
            }`}
          >
            <span className="leading-relaxed">{aiStatusNote.text}</span>
            <button
              type="button"
              onClick={() => setAiStatusNote(null)}
              aria-label="Đóng thông báo"
              className="shrink-0 rounded-lg p-0.5 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Block 2: Core World Information (always visible) */}
      <div className="space-y-4 rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-50">
              <Compass className="h-4 w-4 text-sky-300" />
              <span>Kiểu thế giới / Thể loại</span>
            </label>
            <span className="text-[11px] text-slate-400">
              {currentPreset.shortDesc}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {WORLD_GENRE_PRESETS.map((item) => {
              const active = item.id === genre;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectGenre(item.id)}
                  className={`flex min-h-[56px] flex-col items-start justify-center rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-all active:scale-[0.985] ${
                    active
                      ? 'bg-sky-500/18 text-sky-50 ring-sky-400/50 shadow-[0_6px_16px_-8px_rgba(14,165,233,0.45)]'
                      : 'bg-white/[0.04] text-slate-200 ring-white/[0.07] hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="text-xs font-semibold leading-snug">
                    {item.label}
                  </span>
                  <span
                    className={`mt-0.5 line-clamp-1 text-[11px] ${
                      active ? 'text-sky-200/90' : 'text-slate-400'
                    }`}
                  >
                    {item.shortDesc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Automatic Cultivation / Martial Arts notice ONLY for Tiên Hiệp, Huyền Huyễn, or Cổ đại (Kiếm Hiệp) */}
          {(detectedCultivationKind || genre === 'ancient') && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0e1625]/75 px-3.5 py-2.5 text-xs ring-1 ring-inset ring-white/[0.07]">
              <div className="min-w-0">
                {detectedCultivationKind ? (
                  <>
                    <div className="font-semibold text-amber-200">
                      Tự khởi tạo Hồ sơ{' '}
                      {CULTIVATION_SYSTEM_META[detectedCultivationKind].label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Gồm Cảnh giới,{' '}
                      {
                        CULTIVATION_SYSTEM_META[detectedCultivationKind]
                          .techniqueSectionLabel
                      }{' '}
                      &amp;{' '}
                      {CULTIVATION_SYSTEM_META[detectedCultivationKind].bagName}{' '}
                      tự tăng theo đồng hồ truyện.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-slate-200">
                      Bối cảnh Cổ đại — Tùy chọn Võ học Kiếm Hiệp
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Bật nếu muốn tự tạo Cảnh giới nội công, Kiếm pháp &amp;
                      Hành trang giang hồ.
                    </div>
                  </>
                )}
              </div>

              {genre === 'ancient' && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={
                    enableMartialSystem || detectedCultivationKind === 'wuxia'
                  }
                  onClick={() => setEnableMartialSystem((v) => !v)}
                  className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap shrink-0 ${
                    enableMartialSystem || detectedCultivationKind === 'wuxia'
                      ? 'bg-amber-500/16 text-amber-100 ring-amber-400/35'
                      : 'bg-white/[0.05] text-slate-300 ring-white/[0.09] hover:bg-white/[0.09]'
                  }`}
                >
                  <span>
                    Kiếm Hiệp:{' '}
                    {enableMartialSystem || detectedCultivationKind === 'wuxia'
                      ? 'Bật'
                      : 'Tắt'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-white/[0.07] pt-4">
          <div>
            <label
              htmlFor="world-setup-name"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              Tên thế giới / Tên phiên chơi
            </label>
            <input
              id="world-setup-name"
              type="text"
              value={worldName}
              onChange={(e) => setWorldName(e.target.value)}
              placeholder={currentPreset.placeholders.worldName}
              className="min-h-[44px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>

          <div>
            <label
              htmlFor="world-setup-setting"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              Bối cảnh chính
            </label>
            <textarea
              id="world-setup-setting"
              rows={setting.length > 350 ? 6 : 3}
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
              placeholder={currentPreset.placeholders.setting}
              className="w-full resize-y rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
        </div>
      </div>

      {/* Block 3: Collapsible Detailed Accordions (single clean surface, hairline dividers) */}
      <div className="divide-y divide-white/[0.07] overflow-hidden rounded-2xl bg-[#162032]/88 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        {/* Accordion 1: Starting Timeline & Clock */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('clock')}
            aria-expanded={openSections.clock}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.035]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-50">
                  Mốc thời gian khởi đầu
                </div>
                <div className="truncate text-xs text-slate-400 tabular-nums">
                  {previewClock.eraLabel
                    ? `${previewClock.eraLabel} · ${previewClock.timeStr}`
                    : `${previewClock.timeStr} · ${previewClock.weekday}, ${previewClock.dateStr} · ${previewClock.period}`}
                </div>
              </div>
            </div>
            {openSections.clock ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            )}
          </button>

          {openSections.clock && (
            <div className="space-y-3 border-t border-white/[0.06] bg-[#111b2c]/70 px-4 py-4">
              <p className="text-xs text-slate-400">{currentPreset.timeHint}</p>

              {/* Era / Ancient / Custom Calendar Label */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {currentPreset.usesEraLabel
                    ? 'Niên đại / Lịch bối cảnh / Giờ canh'
                    : 'Nhãn mốc thời điểm (tùy chọn)'}
                </label>
                <input
                  type="text"
                  value={eraLabel}
                  onChange={(e) => {
                    setEraLabel(e.target.value);
                    setClockTouched(true);
                  }}
                  placeholder={currentPreset.placeholders.eraLabel}
                  className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </div>

              {/* Numeric Calendar & Time inputs */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Ngày
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={clockDay}
                    onChange={(e) => updateClockNumber('day', e.target.value)}
                    className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Tháng
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={clockMonth}
                    onChange={(e) => updateClockNumber('month', e.target.value)}
                    className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Năm
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={clockYear}
                    onChange={(e) => updateClockNumber('year', e.target.value)}
                    className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Giờ (0–23)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={clockHour}
                    onChange={(e) => updateClockNumber('hour', e.target.value)}
                    className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Phút
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={clockMinute}
                    onChange={(e) =>
                      updateClockNumber('minute', e.target.value)
                    }
                    className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
              </div>

              {/* Quick time-of-day buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {TIME_PRESETS.map((tp) => {
                  const active =
                    clockHour === tp.hour && clockMinute === tp.minute;
                  return (
                    <button
                      key={tp.label}
                      type="button"
                      onClick={() => {
                        setClockHour(tp.hour);
                        setClockMinute(tp.minute);
                        setClockTouched(true);
                      }}
                      className={`min-h-[34px] rounded-xl px-2.5 text-xs font-medium tabular-nums ring-1 ring-inset transition-colors ${
                        active
                          ? 'bg-amber-500/18 text-amber-200 ring-amber-400/38'
                          : 'bg-white/[0.045] text-slate-300 ring-white/[0.07] hover:bg-white/[0.09]'
                      }`}
                    >
                      {tp.label} {String(tp.hour).padStart(2, '0')}:
                      {String(tp.minute).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>

              <label className="flex min-h-[38px] cursor-pointer items-center gap-2.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={clockAutoAdvance}
                  onChange={(e) => setClockAutoAdvance(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-[#0e1625] accent-amber-400"
                />
                <span>
                  Tự động cộng thời gian trôi liên tục sau mỗi lượt truyện (đồng
                  bộ cùng Đồng hồ truyện)
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Accordion 2: World Rules & Atmosphere */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('rules')}
            aria-expanded={openSections.rules}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.035]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <ScrollText className="h-4 w-4 shrink-0 text-sky-300" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-50">
                  Luật lệ &amp; Không khí thế giới
                </div>
                <div className="truncate text-xs text-slate-400">
                  Kịch tính: {dramaSummaryLabel}
                  {atmosphere.trim() ? ` · ${atmosphere.trim()}` : ''}
                </div>
              </div>
            </div>
            {openSections.rules ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            )}
          </button>

          {openSections.rules && (
            <div className="space-y-3 border-t border-white/[0.06] bg-[#111b2c]/70 px-4 py-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Mức độ kịch tính &amp; nhịp kể
                </label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#0e1625]/85 p-1 ring-1 ring-inset ring-white/[0.06]">
                  {DRAMA_LEVEL_OPTIONS.map((opt) => {
                    const active = dramaLevel === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDramaLevel(opt.id)}
                        className={`min-h-[38px] rounded-lg px-2 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                          active
                            ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {
                    DRAMA_LEVEL_OPTIONS.find((d) => d.id === dramaLevel)?.hint
                  }
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Không khí &amp; tông màu chủ đạo
                </label>
                <input
                  type="text"
                  value={atmosphere}
                  onChange={(e) => setAtmosphere(e.target.value)}
                  placeholder={currentPreset.placeholders.atmosphere}
                  className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Luật lệ, chuẩn mực &amp; giới hạn thế giới
                </label>
                <textarea
                  rows={rules.length > 350 ? 6 : 3}
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  placeholder={currentPreset.placeholders.rules}
                  className="w-full resize-y rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Accordion 3: Main Character */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('mc')}
            aria-expanded={openSections.mc}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.035]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {mcAbsentAtStart ? (
                <UserX className="h-4 w-4 shrink-0 text-amber-300" />
              ) : (
                <UserCheck className="h-4 w-4 shrink-0 text-blue-300" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-50">
                  Nhân vật chính
                </div>
                <div className="truncate text-xs text-slate-400">
                  {mcSummaryText}
                </div>
              </div>
            </div>
            {openSections.mc ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            )}
          </button>

          {openSections.mc && (
            <div className="space-y-3 border-t border-white/[0.06] bg-[#111b2c]/70 px-4 py-4">
              {/* Absent at start toggle */}
              <label
                className={`flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl px-3.5 py-2.5 ring-1 ring-inset transition-colors ${
                  mcAbsentAtStart
                    ? 'bg-amber-500/12 text-amber-100 ring-amber-400/35'
                    : 'bg-white/[0.04] text-slate-200 ring-white/[0.07] hover:bg-white/[0.07]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={mcAbsentAtStart}
                  onChange={(e) => setMcAbsentAtStart(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-[#0e1625] accent-amber-400"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold">
                    Không có mặt / Không tham gia ngay từ đầu
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    Bật nếu bạn muốn tập trung vào dàn NPC và bối cảnh trước — AI
                    sẽ không tự ý đưa nhân vật chính vào cảnh cho đến khi bạn chủ
                    động xuất hiện.
                  </div>
                </div>
              </label>

              <div
                className={`space-y-3 transition-opacity ${
                  mcAbsentAtStart ? 'opacity-60' : 'opacity-100'
                }`}
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">
                      Tên nhân vật chính
                    </label>
                    <input
                      type="text"
                      value={mcName}
                      onChange={(e) => setMcName(e.target.value)}
                      placeholder="Để trống nếu muốn AI tự chọn"
                      className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">
                      Xưng hô
                    </label>
                    <input
                      type="text"
                      value={mcPronoun}
                      onChange={(e) => setMcPronoun(e.target.value)}
                      placeholder="VD: tôi, anh, cô, ta..."
                      className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Vai trò / Vị trí ban đầu
                  </label>
                  <input
                    type="text"
                    value={mcRole}
                    onChange={(e) => setMcRole(e.target.value)}
                    placeholder={currentPreset.placeholders.mcRole}
                    className="min-h-[40px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Mô tả ngắn (ngoại hình &amp; tính cách)
                  </label>
                  <textarea
                    rows={2}
                    value={mcDescription}
                    onChange={(e) => setMcDescription(e.target.value)}
                    placeholder={currentPreset.placeholders.mcDesc}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 4: Starting NPC Cast */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('npcs')}
            aria-expanded={openSections.npcs}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.035]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Users className="h-4 w-4 shrink-0 text-emerald-300" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-50">
                  Dàn nhân vật / NPC khởi đầu
                </div>
                <div className="truncate text-xs text-slate-400">
                  {npcSummaryText}
                </div>
              </div>
            </div>
            {openSections.npcs ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            )}
          </button>

          {openSections.npcs && (
            <div className="space-y-3 border-t border-white/[0.06] bg-[#111b2c]/70 px-4 py-4">
              {/* NPC list */}
              {npcs.length > 0 ? (
                <div className="divide-y divide-white/[0.07] rounded-xl bg-[#162032]/90 ring-1 ring-inset ring-white/[0.07]">
                  {npcs.map((npc) => (
                    <div
                      key={npc.id}
                      className="flex items-start justify-between gap-2.5 px-3.5 py-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CharacterNameBadge name={npc.name} variant="list" />
                          {npc.role && (
                            <span className="text-xs text-slate-400">
                              {npc.role}
                            </span>
                          )}
                        </div>
                        {npc.personality && (
                          <p className="text-xs leading-relaxed text-slate-200">
                            <span className="text-slate-400">Tính cách: </span>
                            {npc.personality}
                          </p>
                        )}
                        {npc.appearance && (
                          <p className="text-xs leading-relaxed text-slate-200">
                            <span className="text-slate-400">Ngoại hình: </span>
                            {npc.appearance}
                          </p>
                        )}
                        {(npc.initialLocation || npc.initialMood || npc.privateSecret) && (
                          <p className="text-[11px] text-slate-400">
                            {[
                              npc.initialLocation
                                ? `Vị trí hiện tại: ${npc.initialLocation}`
                                : '',
                              npc.initialMood
                                ? `Tâm trạng: ${npc.initialMood}`
                                : '',
                              npc.privateSecret
                                ? `Bí mật riêng: ${npc.privateSecret}`
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditNpc(npc)}
                          aria-label={`Sửa ${npc.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-sky-300"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveNpc(npc.id)}
                          aria-label={`Xóa ${npc.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-500/16 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Chưa có NPC khởi đầu. Bạn có thể thêm nhanh bên dưới hoặc dùng
                  nút &quot;AI dựng thế giới&quot; ở trên.
                </p>
              )}

              {/* Quick Add / Edit NPC Composer */}
              {npcComposerOpen ? (
                <div className="space-y-2.5 rounded-xl bg-[#162032]/90 p-3.5 ring-1 ring-inset ring-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-200">
                      {editingNpcId ? 'Chỉnh sửa NPC' : 'Thêm NPC khởi đầu'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        resetNpcDraft();
                        setNpcComposerOpen(false);
                      }}
                      className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.08] hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={npcNameDraft}
                      onChange={(e) => setNpcNameDraft(e.target.value)}
                      placeholder="Tên nhân vật *"
                      className="min-h-[38px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                    <input
                      type="text"
                      value={npcRoleDraft}
                      onChange={(e) => setNpcRoleDraft(e.target.value)}
                      placeholder="Vai trò / Nghề nghiệp"
                      className="min-h-[38px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                  </div>
                  <input
                    type="text"
                    value={npcPersonalityDraft}
                    onChange={(e) => setNpcPersonalityDraft(e.target.value)}
                    placeholder="Tính cách & khí chất ngắn gọn"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                  <input
                    type="text"
                    value={npcAppearanceDraft}
                    onChange={(e) => setNpcAppearanceDraft(e.target.value)}
                    placeholder="Ngoại hình & trang phục (dùng để tạo ảnh chân dung)"
                    className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={npcLocationDraft}
                      onChange={(e) => setNpcLocationDraft(e.target.value)}
                      placeholder="Vị trí hiện tại (VD: Tửu quán Thập Lý Pha)"
                      className="min-h-[38px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                    <input
                      type="text"
                      value={npcMoodDraft}
                      onChange={(e) => setNpcMoodDraft(e.target.value)}
                      placeholder="Tâm trạng ban đầu (tùy chọn)"
                      className="min-h-[38px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                  </div>
                  <input
                    type="text"
                    value={npcSecretDraft}
                    onChange={(e) => setNpcSecretDraft(e.target.value)}
                    placeholder="Bí mật riêng của NPC (chỉ mình họ biết, cấm NPC khác tự đoán)..."
                    className="min-h-[38px] w-full rounded-xl border border-amber-400/20 bg-[#0e1625]/85 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        resetNpcDraft();
                        setNpcComposerOpen(false);
                      }}
                      className="min-h-[36px] rounded-xl bg-white/[0.055] px-3 text-xs font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNpcDraft}
                      className="min-h-[36px] rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white hover:from-sky-400 hover:to-blue-500"
                    >
                      {editingNpcId ? 'Cập nhật' : 'Lưu NPC'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    resetNpcDraft();
                    setNpcComposerOpen(true);
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5 text-sky-300" />
                  <span>Thêm NPC khởi đầu</span>
                </button>
              )}

              <label className="flex min-h-[38px] cursor-pointer items-center gap-2.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={syncPortraitsAndStates}
                  onChange={(e) => setSyncPortraitsAndStates(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-[#0e1625] accent-emerald-400"
                />
                <span>
                  Đồng bộ ngay sang Hồ sơ nhân vật, Trạng thái &amp; Thư viện Ảnh
                  NV
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Accordion 5: Opening Scenario & Launch Mode */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('opening')}
            aria-expanded={openSections.opening}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.035]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <BookOpen className="h-4 w-4 shrink-0 text-violet-300" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-50">
                  Tình huống mở đầu &amp; Lượt gọi đầu tiên
                </div>
                <div className="truncate text-xs text-slate-400">
                  {openingSummaryText}
                </div>
              </div>
            </div>
            {openSections.opening ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            )}
          </button>

          {openSections.opening && (
            <div className="space-y-3 border-t border-white/[0.06] bg-[#111b2c]/70 px-4 py-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Tình huống mở màn / Lượt gọi đầu tiên (tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={openingScenario}
                  onChange={(e) => setOpeningScenario(e.target.value)}
                  placeholder={currentPreset.placeholders.openingScenario}
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Cách mở màn khi bấm &quot;Bắt đầu truyện&quot;
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setLaunchMode('ai_opening')}
                    className={`flex min-h-[54px] flex-col items-start justify-center rounded-xl px-3.5 py-2.5 text-left ring-1 ring-inset transition-all ${
                      launchMode === 'ai_opening'
                        ? 'bg-sky-500/18 text-sky-50 ring-sky-400/45'
                        : 'bg-white/[0.04] text-slate-300 ring-white/[0.07] hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="text-xs font-semibold">
                      AI tự viết cảnh mở màn
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-400">
                      Tạo ngay Trang 1 và gọi AI dẫn nhập bối cảnh
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLaunchMode('direct_chat')}
                    className={`flex min-h-[54px] flex-col items-start justify-center rounded-xl px-3.5 py-2.5 text-left ring-1 ring-inset transition-all ${
                      launchMode === 'direct_chat'
                        ? 'bg-sky-500/18 text-sky-50 ring-sky-400/45'
                        : 'bg-white/[0.04] text-slate-300 ring-white/[0.07] hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="text-xs font-semibold">
                      Vào thẳng trang truyện
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-400">
                      Lưu đầy đủ thế giới &amp; chờ bạn tự nhập lượt đầu
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="space-y-2.5 pb-2 pt-1">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleSubmitWorld}
            disabled={isGeneratingWorld}
            className="inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-sky-500 to-blue-600 px-5 text-sm font-bold text-white shadow-[0_12px_28px_-8px_rgba(14,165,233,0.52)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-white text-white" />
            <span>Bắt đầu truyện</span>
          </button>

          <button
            type="button"
            onClick={handleResetForm}
            disabled={isGeneratingWorld}
            className="inline-flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl bg-white/[0.055] px-4 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.985] disabled:opacity-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Đặt lại biểu mẫu</span>
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Phiên truyện cũ sẽ tự động lưu vào Checkpoint — bạn luôn có thể Hoàn
          tác trong mục Dữ liệu.
        </p>
      </div>
    </section>
  );
}
