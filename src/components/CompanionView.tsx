import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Download,
  Edit3,
  Flag,
  Flame,
  GitBranch,
  Globe,
  History,
  KeyRound,
  Loader2,
  MapPin,
  Network,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  hasImageGeneratorConfigured,
  type AnimeJourneyPack,
  type ArkState,
  type CanonCandidate,
  type CompanionCreativePresetId,
  type CompanionProfile,
  type DnSubTab,
  type McRoleType,
  type McSourceMode,
  type PortraitBankConfig,
  type PortraitGenProgress,
  type ViewName,
} from '../types/ark';
import { useActionConfirmFeedback } from '../utils/touchFeedback';
import {
  ANIME_JOURNEY_TIMEOUT_MS,
  POPULAR_ANIME_SUGGESTIONS,
  applyAnimeJourneyPackToCompanion,
  buildAnimeJourneyPrompt,
  buildOfflineAnimeJourneyPack,
  normalizeAnimeKey,
  parseAnimeJourneyResponse,
} from '../utils/animeJourney';
import {
  callAiJsonOrTextDetailed,
  resolveActiveSceneCharacters,
  resolveModelForTask,
  runTimedLookupWithProgress,
} from '../utils/api';
import {
  buildOnlineCharacterKeySet,
  computeAgeFromBirthday,
  formatAgeBirthdayLabel,
  isCharacterOnlineInSet,
  lookupKnownCelebrityProfile,
} from '../utils/characterUtils';
import {
  COMPANION_CREATIVE_PRESETS,
  VALID_CREATIVE_PRESET_IDS,
  applyCreativePresetToCompanion,
  ensureInCharacterCausalityRule,
  getCreativePresetById,
  hasCustomCompanionCreativeFields,
} from '../utils/companionPresets';
import { buildRelationshipGraph } from '../utils/relationshipGraphEngine';
import { splitNarrativeAndMeta } from '../utils/saveParser';
import { matchesQuery } from '../utils/search';
import { getShowbizMcProfile } from '../utils/showbizPhone';
import { getActiveCompanionFromState, triggerDownloadJson } from '../utils/storage';
import { CharacterNameBadge } from './CharacterNameBadge';
import {
  ImagePickerModal,
  type ImagePickerTarget,
} from './ImagePickerModal';
import {
  PortraitBankPanel,
  type BgPortraitStatus,
} from './PortraitBankPanel';
import {
  RelationshipNetworkGraph,
  type QuickRelationFilter,
} from './RelationshipNetworkGraph';

interface CompanionViewProps {
  state: ArkState;
  generatingPortraitIds: string[];
  portraitProgress?: Record<string, PortraitGenProgress>;
  portraitErrors?: Record<string, string>;
  enrichingAppearanceIds: string[];
  analyzingIdentityIds?: string[];
  verifyingReferenceIds?: string[];
  isEnrichingAppearances: boolean;
  enrichingNpcIds: string[];
  isEnrichingAllNpcs: boolean;
  bgPortraitStatus: BgPortraitStatus | null;
  animeJourneyHistory: AnimeJourneyPack[];
  onSaveAnimeJourneyPack: (pack: AnimeJourneyPack) => void;
  onDeleteAnimeJourneyPack: (packId: string) => void;
  onUpdateActiveCompanion: (
    updater: (cur: CompanionProfile) => CompanionProfile,
    syncPlayerWorld?: boolean,
  ) => void;
  onUpdatePortraitBank: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
  onSyncPortraitsFromCompanion: () => void;
  onCleanJunkPortraits: () => void;
  onAutoFillAppearances: () => void;
  onRefreshPortraitAppearance: (portraitId: string, force?: boolean) => void;
  onEnrichNpcProfile: (npcId: string, force?: boolean) => void;
  onEnrichAllNpcs: () => void;
  onGeneratePortrait: (portraitId: string) => void;
  onPreviewPortraitPrompt?: (
    portraitId: string,
    options?: { ignoreCustomPrompt?: boolean; includeSceneContext?: boolean },
  ) => string;
  onAnalyzePortraitIdentity?: (
    portraitId: string,
    options?: {
      overwrite?: boolean;
      imageDataOverride?: string;
      isRealPhoto?: boolean;
    },
  ) => void;
  onVerifyPortraitAgainstReference?: (portraitId: string) => void;
  onCancelPortrait?: (portraitId: string) => void;
  onCancelBgPortraits: () => void;
  onDismissBgPortraitStatus?: () => void;
  onDownloadImage: (imgSrc: string, filename: string) => void;
  onSelectCompanion: (id: string) => void;
  onCreateNewProfile: () => void;
  onDeleteProfile: (id: string) => void;
  onImportProfile: (profile: CompanionProfile) => void;
  onEnterCompanionWorld: () => void;
  onNavigate: (view: ViewName) => void;
  onNotify: (msg: string, type?: 'info' | 'err') => void;
}

function upsertCanonNpcAndCandidate(
  cur: CompanionProfile,
  canonObj: Record<string, unknown>,
): CompanionProfile {
  const canonName = String(canonObj.name || '').trim();
  if (!canonName) return cur;

  const descParts = [
    canonObj.personality
      ? `Tính cách: ${String(canonObj.personality).trim()}`
      : '',
    canonObj.appearance
      ? `Ngoại hình: ${String(canonObj.appearance).trim()}`
      : '',
    canonObj.gender ? `Giới tính: ${String(canonObj.gender).trim()}` : '',
    canonObj.age ? `Tuổi: ${String(canonObj.age).trim()}` : '',
  ].filter(Boolean);

  const npcs = [...(cur.npcs || [])];
  const existingIdx = npcs.findIndex(
    (n) => (n.name || '').trim().toLowerCase() === canonName.toLowerCase(),
  );
  const npcEntry = {
    id:
      existingIdx >= 0
        ? npcs[existingIdx].id
        : `npc_canon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: canonName,
    role:
      existingIdx >= 0 && npcs[existingIdx].role
        ? npcs[existingIdx].role
        : 'Nhân vật chính nguyên tác',
    desc:
      descParts.join(' | ') ||
      (existingIdx >= 0
        ? npcs[existingIdx].desc
        : 'Nhân vật từ tác phẩm nguyên tác.'),
  };
  if (existingIdx >= 0) {
    npcs[existingIdx] = { ...npcs[existingIdx], ...npcEntry };
  } else {
    npcs.unshift(npcEntry);
  }

  const canonCandidates: CanonCandidate[] = [...(cur.canonCandidates || [])];
  const candItem: CanonCandidate = {
    name: canonName,
    pronoun: String(canonObj.pronoun || '').trim(),
    gender: String(canonObj.gender || 'Nam').trim(),
    age: String(canonObj.age || '').trim(),
    personality: String(canonObj.personality || '').trim(),
    appearance: String(canonObj.appearance || '').trim(),
    role: 'Nhân vật nguyên tác',
  };
  const candIdx = canonCandidates.findIndex(
    (c) => (c.name || '').trim().toLowerCase() === canonName.toLowerCase(),
  );
  if (candIdx >= 0) canonCandidates[candIdx] = candItem;
  else canonCandidates.unshift(candItem);

  return {
    ...cur,
    npcs,
    canonCandidates,
    mc: {
      ...cur.mc,
      canonMcName: cur.mc?.canonMcName || canonName,
    },
  };
}

function parseStructuredFanficFromText(
  rawText: string,
  cur: CompanionProfile,
): { ok: boolean; updated: CompanionProfile } {
  const cleanJsonStr = String(rawText ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ok: false, updated: cur };
  try {
    const obj = JSON.parse(jsonMatch[0]);
    let next: CompanionProfile = { ...cur };
    const workLabel = String(
      obj.worldTitle || next.sourceQuery || next.name || '',
    ).trim();
    if (obj.worldTitle && !next.name) next.name = String(obj.worldTitle);
    if (obj.mc && typeof obj.mc === 'object') {
      next = upsertCanonNpcAndCandidate(next, obj.mc);
    }
    if (obj.worldSetting) next.worldSetting = String(obj.worldSetting);
    if (obj.worldRules) {
      next.worldRules = ensureInCharacterCausalityRule(
        String(obj.worldRules),
        workLabel,
      );
    } else {
      next.worldRules = ensureInCharacterCausalityRule(
        next.worldRules,
        workLabel,
      );
    }

    if (Array.isArray(obj.divergencePoints) && obj.divergencePoints.length) {
      const cleanedPoints = obj.divergencePoints
        .map((item: unknown) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 4);
      if (cleanedPoints.length) {
        next.divergencePoints = cleanedPoints;
      }
    } else if (
      typeof obj.divergencePoints === 'string' &&
      obj.divergencePoints.trim()
    ) {
      const splitPoints = obj.divergencePoints
        .split(/\r?\n+/)
        .map((line: string) => String(line ?? '').replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 4);
      if (splitPoints.length) {
        next.divergencePoints = splitPoints;
      }
    }

    if (
      typeof obj.creativeDirection === 'string' &&
      obj.creativeDirection.trim() &&
      !(next.creativeDirection || '').trim()
    ) {
      next.creativeDirection = obj.creativeDirection.trim();
    }

    if (Array.isArray(obj.npcs) && obj.npcs.length) {
      const canonSet = new Set(
        (next.canonCandidates || []).map((c) =>
          (c.name || '').trim().toLowerCase(),
        ),
      );
      const parsedNpcs = obj.npcs.map(
        (
          n: {
            name?: string;
            role?: string;
            desc?: string;
            personality?: string;
            appearance?: string;
            relationships?: string;
            signature?: string;
            agenda?: string;
            friction?: string;
          },
          i: number,
        ) => {
          const agendaText = n.agenda ? String(n.agenda).trim() : '';
          const frictionText = n.friction ? String(n.friction).trim() : '';
          const baseDesc = String(n.desc || n.appearance || '').trim();
          const enrichedDesc = [
            baseDesc,
            agendaText && !baseDesc.includes(agendaText)
              ? `Động cơ: ${agendaText}`
              : '',
            frictionText && !baseDesc.includes(frictionText)
              ? `Ma sát: ${frictionText}`
              : '',
          ]
            .filter(Boolean)
            .join(' | ');
          return {
            id: `npc_${Date.now()}_${i}`,
            name: String(n.name || `NPC ${i + 1}`),
            role: String(n.role || 'Đồng nhân'),
            desc: enrichedDesc || baseDesc,
            ...(n.personality
              ? { personality: String(n.personality).trim() }
              : {}),
            ...(n.appearance
              ? { appearance: String(n.appearance).trim() }
              : {}),
            ...(n.relationships
              ? { relationships: String(n.relationships).trim() }
              : {}),
            ...(agendaText ? { agenda: agendaText } : {}),
            ...(frictionText ? { friction: frictionText } : {}),
            ...(n.signature ? { signature: String(n.signature).trim() } : {}),
          };
        },
      );
      const existingCanon = (next.npcs || []).filter((n) =>
        canonSet.has((n.name || '').trim().toLowerCase()),
      );
      const merged = [...existingCanon];
      for (const pn of parsedNpcs) {
        const idx = merged.findIndex(
          (m) =>
            (m.name || '').trim().toLowerCase() ===
            (pn.name || '').trim().toLowerCase(),
        );
        if (idx >= 0) {
          merged[idx] = {
            ...merged[idx],
            ...(pn.agenda ? { agenda: pn.agenda } : {}),
            ...(pn.friction ? { friction: pn.friction } : {}),
            ...(pn.relationships && !merged[idx].relationships
              ? { relationships: pn.relationships }
              : {}),
          };
        } else {
          merged.push(pn);
        }
      }
      next.npcs = merged;
    }
    return { ok: true, updated: next };
  } catch {
    return { ok: false, updated: cur };
  }
}

export function CompanionView({
  state,
  generatingPortraitIds,
  portraitProgress,
  portraitErrors,
  enrichingAppearanceIds,
  analyzingIdentityIds,
  verifyingReferenceIds,
  isEnrichingAppearances,
  enrichingNpcIds,
  isEnrichingAllNpcs,
  bgPortraitStatus,
  animeJourneyHistory,
  onSaveAnimeJourneyPack,
  onDeleteAnimeJourneyPack,
  onUpdateActiveCompanion,
  onUpdatePortraitBank,
  onSyncPortraitsFromCompanion,
  onCleanJunkPortraits,
  onAutoFillAppearances,
  onRefreshPortraitAppearance,
  onEnrichNpcProfile,
  onEnrichAllNpcs,
  onGeneratePortrait,
  onPreviewPortraitPrompt,
  onAnalyzePortraitIdentity,
  onVerifyPortraitAgainstReference,
  onCancelPortrait,
  onCancelBgPortraits,
  onDismissBgPortraitStatus,
  onDownloadImage,
  onSelectCompanion,
  onCreateNewProfile,
  onDeleteProfile,
  onImportProfile,
  onEnterCompanionWorld,
  onNavigate,
  onNotify,
}: CompanionViewProps) {
  const cur = getActiveCompanionFromState(state);
  const onlineCharacterNames = useMemo(() => {
    const list = state.turns || [];
    if (!list.length) return [];
    const safeIdx = Math.min(Math.max(0, state.currentPage), list.length - 1);
    const activeTurn = list[safeIdx];
    if (!activeTurn) return [];
    const rawAi = activeTurn.assistant || '';
    const cleanAi = splitNarrativeAndMeta(rawAi, false).mainText || rawAi;
    const cleanUser = activeTurn.user || '';
    if (!cleanAi.trim() && !cleanUser.trim()) return [];
    return resolveActiveSceneCharacters({
      currentUserText: cleanUser,
      currentAiText: cleanAi,
      recentTurns: [],
      mcName: state.player?.name || cur.mc?.name || '',
      mcPronoun: cur.mc?.pronoun || '',
      mcAbsentAtStart: Boolean(state.player?.absentAtStart),
      npcs: cur.npcs || [],
      portraits: state.portraitBank?.portraits || [],
      characterStates: state.memory?.characterStates || [],
    }).presentNames;
  }, [
    state.turns,
    state.currentPage,
    state.player,
    state.portraitBank,
    state.memory,
    cur,
  ]);
  const onlineCharacterKeySet = useMemo(
    () => buildOnlineCharacterKeySet(onlineCharacterNames),
    [onlineCharacterNames],
  );
  const [subTab, setSubTab] = useState<DnSubTab>('mc');
  const [relationQuickFilter, setRelationQuickFilter] =
    useState<QuickRelationFilter>('all');
  const { isConfirmed, triggerConfirm } = useActionConfirmFeedback(1150);

  const handleTogglePortraitPin = (portraitId: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === portraitId
          ? { ...p, pinned: !p.pinned, updatedAt: Date.now() }
          : p,
      ),
    }));
  };

  const handleTogglePortraitAiLock = (portraitId: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === portraitId
          ? {
              ...p,
              aiAutoEnrichLocked: !p.aiAutoEnrichLocked,
              updatedAt: Date.now(),
            }
          : p,
      ),
    }));
  };

  const relationQuickCounts = useMemo(() => {
    if (subTab !== 'relations') {
      return { all: 0, family: 0, friends: 0, rival: 0 };
    }
    const graph = buildRelationshipGraph({
      portraits: state.portraitBank.portraits || [],
      memoryEntries: state.memory?.entries || [],
      characterStates: state.memory?.characterStates || [],
      customGroups: state.portraitBank.relationshipGroups || [],
      edgeOverrides: state.portraitBank.relationshipOverrides || [],
      clusterMode: 'faction',
      includeSceneCoPresence: false,
    });
    let family = 0;
    let friends = 0;
    let rival = 0;
    for (const edge of graph.edges) {
      if (edge.tone === 'family') family += 1;
      else if (edge.tone === 'ally' || edge.tone === 'intimate') friends += 1;
      else if (edge.tone === 'rival') rival += 1;
    }
    return {
      all: graph.edges.length,
      family,
      friends,
      rival,
    };
  }, [subTab, state.portraitBank, state.memory]);

  const handleAssignPortraitRole = (portraitId: string, nextRole: string) => {
    const cleaned = nextRole.trim();
    if (!cleaned) return;
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === portraitId
          ? { ...p, role: cleaned, updatedAt: Date.now() }
          : p,
      ),
    }));
  };

  const handleAddPortraitRelationshipTag = (
    sourceId: string,
    targetName: string,
    relationLabel: string,
  ) => {
    const cleanTarget = targetName.trim();
    const cleanRel = relationLabel.trim();
    if (!cleanTarget || !cleanRel) return;
    const newClause = `${cleanRel} với ${cleanTarget}`;
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) => {
        if (p.id !== sourceId) return p;
        const existing = (p.relationships || '').trim();
        const nextRelationships = existing
          ? existing.toLowerCase().includes(newClause.toLowerCase())
            ? existing
            : `${existing.replace(/[;.\s]+$/, '')}; ${newClause}`
          : newClause;
        return {
          ...p,
          relationships: nextRelationships,
          updatedAt: Date.now(),
        };
      }),
    }));
  };

  const handleAssignPortraitFactionTag = (
    portraitId: string,
    factionName: string,
  ) => {
    const cleanFaction = String(factionName ?? '')
      .replace(/[\[\]]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanFaction) return;
    const tag = `[Phe: ${cleanFaction}]`;
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) => {
        if (p.id !== portraitId) return p;
        const existing = (p.relationships || '').trim();
        const stripped = existing
          .replace(
            /\[\s*(?:phe(?:\s*phái)?|tổ\s*chức|nhóm|tông\s*môn|gia\s*tộc|công\s*hội|bang|đội)\s*[:=]\s*[^\]]+\]\s*[;,.·•]?\s*/giu,
            '',
          )
          .trim();
        const nextRelationships = stripped ? `${tag}; ${stripped}` : tag;
        return {
          ...p,
          relationships: nextRelationships,
          updatedAt: Date.now(),
        };
      }),
    }));
  };
  const [statusLogs, setStatusLogs] = useState<string[]>([
    'Sẵn sàng tra cứu nguồn trên mạng hoặc phân tích tác phẩm gốc...',
  ]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeElapsedSec, setAnalyzeElapsedSec] = useState(0);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);

  // Quick Anime Journey & Replay Pack state
  const [isBuildingAnimeJourney, setIsBuildingAnimeJourney] = useState(false);
  const [animeJourneyElapsedSec, setAnimeJourneyElapsedSec] = useState(0);
  const [animeJourneyError, setAnimeJourneyError] = useState<string | null>(
    null,
  );
  const [showAnimeSuggestions, setShowAnimeSuggestions] = useState(false);
  const animeJourneyAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      analyzeAbortRef.current?.abort();
      analyzeAbortRef.current = null;
      animeJourneyAbortRef.current?.abort();
      animeJourneyAbortRef.current = null;
    };
  }, []);

  // Creative Preset Studio state
  const [presetsExpanded, setPresetsExpanded] = useState(true);
  const [pendingPresetId, setPendingPresetId] =
    useState<CompanionCreativePresetId | null>(null);
  const [newDivergenceDraft, setNewDivergenceDraft] = useState('');
  const [newMilestoneDraft, setNewMilestoneDraft] = useState('');

  // Add NPC draft inputs
  const [npcName, setNpcName] = useState('');
  const [npcRole, setNpcRole] = useState('');
  const [npcAge, setNpcAge] = useState('');
  const [npcBirthday, setNpcBirthday] = useState('');
  const [npcFashionStyle, setNpcFashionStyle] = useState('');
  const [npcPersonality, setNpcPersonality] = useState('');
  const [npcAppearance, setNpcAppearance] = useState('');
  const [npcRelationships, setNpcRelationships] = useState('');
  const [npcAgenda, setNpcAgenda] = useState('');
  const [npcFriction, setNpcFriction] = useState('');
  const [npcCurrentLocation, setNpcCurrentLocation] = useState('');
  const [npcPrivateSecret, setNpcPrivateSecret] = useState('');
  const [npcSignature, setNpcSignature] = useState('');
  const [npcSearch, setNpcSearch] = useState('');
  const [companionSearch, setCompanionSearch] = useState('');

  // Inline NPC editor state
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null);
  const [editNpcName, setEditNpcName] = useState('');
  const [editNpcRole, setEditNpcRole] = useState('');
  const [editNpcAge, setEditNpcAge] = useState('');
  const [editNpcBirthday, setEditNpcBirthday] = useState('');
  const [editNpcFashionStyle, setEditNpcFashionStyle] = useState('');
  const [editNpcPersonality, setEditNpcPersonality] = useState('');
  const [editNpcAppearance, setEditNpcAppearance] = useState('');
  const [editNpcRelationships, setEditNpcRelationships] = useState('');
  const [editNpcAgenda, setEditNpcAgenda] = useState('');
  const [editNpcFriction, setEditNpcFriction] = useState('');
  const [editNpcCurrentLocation, setEditNpcCurrentLocation] = useState('');
  const [editNpcPrivateSecret, setEditNpcPrivateSecret] = useState('');
  const [editNpcSignature, setEditNpcSignature] = useState('');
  const [editNpcDesc, setEditNpcDesc] = useState('');
  const [imagePickerTarget, setImagePickerTarget] =
    useState<ImagePickerTarget | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);

  const filteredNpcs = useMemo(() => {
    const list = (cur.npcs || []).map((npc, originalIdx) => ({
      npc,
      originalIdx,
    }));
    if (!npcSearch.trim()) return list;
    return list.filter(({ npc }) =>
      matchesQuery(
        `${npc.name} ${npc.role} ${npc.age || ''} ${npc.birthday || ''} ${npc.fashionStyle || ''} ${npc.desc} ${npc.personality || ''} ${npc.appearance || ''} ${npc.relationships || ''} ${npc.agenda || ''} ${npc.friction || ''} ${npc.currentLocation || ''} ${npc.privateSecret || ''} ${npc.signature || ''}`,
        npcSearch,
      ),
    );
  }, [cur.npcs, npcSearch]);

  const filteredCompanions = useMemo(() => {
    if (!companionSearch.trim()) return state.companions;
    return state.companions.filter((c) => {
      const npcNames = (c.npcs || []).map((n) => n.name).join(' ');
      return matchesQuery(
        `${c.name} ${c.sourceQuery} ${c.role} ${c.mc?.name || ''} ${c.worldSetting} ${c.worldRules} ${c.creativeDirection || ''} ${(c.divergencePoints || []).join(' ')} ${c.note} ${npcNames}`,
        companionSearch,
      );
    });
  }, [state.companions, companionSearch]);

  const appendLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setStatusLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  };

  const hasSourceData = Boolean(cur.sourceContent?.trim());

  // Build canon candidate dropdown options
  const canonPool: Array<{ name: string; label: string }> = [];
  const seenCanon = new Set<string>();
  (cur.canonCandidates || []).forEach((c) => {
    const key = (c.name || '').trim().toLowerCase();
    if (key && !seenCanon.has(key)) {
      seenCanon.add(key);
      canonPool.push({ name: c.name, label: `${c.name} (Nguyên tác)` });
    }
  });
  (cur.npcs || []).forEach((n) => {
    const key = (n.name || '').trim().toLowerCase();
    if (key && !seenCanon.has(key)) {
      seenCanon.add(key);
      canonPool.push({
        name: n.name,
        label: `${n.name}${n.role ? ` — ${n.role}` : ''}`,
      });
    }
  });

  const handleLookupOriginalWork = async (overrideQuery?: string) => {
    const query = (
      overrideQuery ??
      (cur.sourceQuery || cur.name || '')
    ).trim();
    if (!query) {
      onNotify(
        'Hãy nhập Tên tác phẩm gốc / Từ khóa để AI lấy nguồn trên mạng.',
        'err',
      );
      return null;
    }

    setIsLookingUp(true);
    appendLog(
      `Bắt đầu tra cứu chuyên sâu (chế độ đối chiếu & lọc nhiễu chặt) cho: "${query}"...`,
    );

    try {
      let webText = await runTimedLookupWithProgress(
        state,
        query,
        (elapsedSec, tick) => {
          if (tick % 2 === 0) {
            appendLog(
              `Đang đối chiếu & kiểm tra nguồn cho "${query}" (${elapsedSec}s)...`,
            );
          }
        },
      );

      if (!webText) {
        webText =
          `Tác phẩm / Chủ đề: ${query}\n` +
          `- Bối cảnh: Thế giới mở rộng dựa trên nguyên tác "${query}", bám sát thiết lập gốc và lọc bỏ các kết quả lệch chủ đề.\n` +
          '- Quy tắc (In-Character & Hậu quả nhân quả): Các nhân vật giữ bản sắc, lập trường và giới hạn hiểu biết cốt lõi của nguyên tác (không OOC); mọi can thiệp lớn đều tạo phản ứng dây chuyền lên bối cảnh và các phe phái liên quan.\n' +
          '- Điểm rẽ nhánh / Biến số có thể bẻ lái:\n' +
          `  1. Bước ngoặt khởi đầu của "${query}" xảy ra sớm hơn hoặc bị người ngoài cuộc can thiệp, khiến cơ duyên/manh mối ban đầu đổi chủ.\n` +
          `  2. Một phe trung lập hoặc nhân vật phụ nắm giữ bí mật quan trọng thay đổi lập trường sớm, kéo theo phản ứng dây chuyền từ thế lực đối lập.\n` +
          '- Nhân vật tiêu biểu: Mỗi NPC có động cơ riêng, lập trường riêng và điểm ma sát tiềm năng thay vì đồng thuận tuyệt đối.';
        appendLog(
          `Chưa tìm thấy bài khớp chuẩn cao từ nguồn mở hoặc chưa cấu hình Proxy AI; đã tạo khung tư liệu sạch kèm điểm rẽ nhánh & quy tắc In-Character cho "${query}" — bạn có thể dán thêm nội dung truyện gốc vào ô phía trên rồi bấm PHÂN TÍCH TÁC PHẨM.`,
        );
      } else {
        appendLog(`Đã hoàn tất tra cứu & lọc nguồn cho "${query}".`);
      }

      const mergedContent = cur.sourceContent?.trim()
        ? `${cur.sourceContent.trim()}\n\n${webText}`
        : webText;

      onUpdateActiveCompanion((c) => ({
        ...c,
        sourceContent: mergedContent,
      }));
      onNotify(`Đã lấy nguồn tác phẩm gốc (đã lọc nhiễu) cho: ${query}`);
      return mergedContent;
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleCancelAnalyze = () => {
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
  };

  const handleAnalyzeSourceWork = async (
    overrideSourceContent?: string,
  ): Promise<boolean> => {
    if (isAnalyzing) return false;

    const ANALYZE_TIMEOUT_MS = 45_000;
    const ANALYZE_SOURCE_MAX_CHARS = 2000;

    const sourceText = (
      overrideSourceContent ?? (cur.sourceContent || '')
    ).trim();
    const query = (cur.sourceQuery || cur.name || 'Thế giới đồng nhân').trim();
    if (!sourceText && !query) {
      onNotify(
        'Hãy nhập tên tác phẩm hoặc dán nội dung tác phẩm gốc trước khi phân tích.',
        'err',
      );
      return false;
    }

    // Cancel any leftover request just in case
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    const startTs = Date.now();
    let timedOutLocally = false;

    setAnalyzeError(null);
    setAnalyzeElapsedSec(0);
    setIsAnalyzing(true);

    const trimmedSource = (sourceText || query).slice(0, ANALYZE_SOURCE_MAX_CHARS);
    const wasTruncated = sourceText.length > ANALYZE_SOURCE_MAX_CHARS;

    appendLog(
      `Bắt đầu phân tích tác phẩm (tối đa ${Math.round(ANALYZE_TIMEOUT_MS / 1000)}s${
        wasTruncated
          ? `, lấy ${ANALYZE_SOURCE_MAX_CHARS} ký tự đầu để phản hồi nhanh`
          : ''
      })...`,
    );

    const elapsedTimer = window.setInterval(() => {
      setAnalyzeElapsedSec(Math.max(1, Math.round((Date.now() - startTs) / 1000)));
    }, 1000);

    const hardTimeoutId = window.setTimeout(() => {
      timedOutLocally = true;
      controller.abort();
    }, ANALYZE_TIMEOUT_MS);

    try {
      const activePresetNotes = (cur.creativePresetIds || [])
        .map((id) => getCreativePresetById(id))
        .filter(Boolean)
        .map((p) => `${p!.title}: ${p!.shortTag}`)
        .join('; ');
      const shortDirection = [
        activePresetNotes,
        (cur.creativeDirection || '').trim().slice(0, 220),
      ]
        .filter(Boolean)
        .join(' | ');

      const aiPrompt =
        'Phân tích tác phẩm Đồng Nhân và trả về CHỈ 1 JSON hợp lệ (không giải thích ngoài JSON). YÊU CẦU NGẮN GỌN: mỗi trường chỉ 1–2 câu súc tích.\n' +
        '{\n' +
        '  "worldTitle": "Tên ngắn",\n' +
        '  "mc": {"name":"NVC gốc","pronoun":"xưng hô","gender":"Nam/Nữ","age":"tuổi","personality":"1 câu","appearance":"1 câu"},\n' +
        '  "worldSetting": "1-2 câu về bối cảnh & xung đột chính",\n' +
        '  "worldRules": "1-2 câu luật thế giới + bắt buộc ghi quy tắc Giữ đúng tính cách nguyên tác (In-Character) & Hậu quả nhân quả",\n' +
        '  "divergencePoints": ["Điểm rẽ nhánh 1 (1 câu ngắn)", "Điểm rẽ nhánh 2 (1 câu ngắn)"],\n' +
        '  "creativeDirection": "1-2 câu định hướng đồng nhân tránh rập khuôn & chống toàn năng",\n' +
        '  "npcs": [{"name":"...","role":"...","personality":"1 câu","appearance":"1 câu","relationships":"1 câu","agenda":"Động cơ riêng (1 câu)","friction":"Điểm xung đột/ma sát (1 câu)","desc":"1 câu"}]\n' +
        '}\n' +
        'Lưu ý: 1–2 điểm rẽ nhánh rõ ràng; 3–4 NPC tiêu biểu đều có agenda & friction riêng; mỗi mục chỉ 1–2 câu ngắn để phản hồi nhanh.\n' +
        (shortDirection ? `Định hướng ưu tiên: ${shortDirection}\n` : '') +
        `Tác phẩm: ${query}\n` +
        `Tư liệu gốc (tối đa ${ANALYZE_SOURCE_MAX_CHARS} ký tự đầu):\n${trimmedSource}`;

      const aiRes = await callAiJsonOrTextDetailed(state, aiPrompt, {
        systemPrompt:
          'Chỉ trả về đúng 1 JSON hợp lệ bằng tiếng Việt, thật ngắn gọn (mỗi mục 1-2 câu), không viết thêm lời dẫn hay suy luận dài.',
        signal: controller.signal,
        timeoutMs: ANALYZE_TIMEOUT_MS,
        maxTokens: 1600,
        taskSlot: 'fanfic',
        logPrefix: '[Phân tích]',
        onLog: (line) => appendLog(line),
      });

      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - startTs) / 1000),
      );

      // Offline fallback ONLY when Proxy AI is not configured
      if (!aiRes.ok && aiRes.errorKind === 'no_proxy') {
        onUpdateActiveCompanion((latest) => {
          const withLatestSource = overrideSourceContent
            ? { ...latest, sourceContent: overrideSourceContent }
            : latest;
          const titleBase =
            withLatestSource.sourceQuery ||
            withLatestSource.name ||
            'Đồng Nhân';
          let fallback = upsertCanonNpcAndCandidate(withLatestSource, {
            name: `Nhân vật chính nguyên tác (${titleBase})`,
            pronoun: '',
            gender: 'Nam',
            age: '',
            personality:
              'Kiên định với lý tưởng nguyên tác, cảnh giác trước người lạ và không dễ tin phục nếu chưa qua kiểm chứng.',
            appearance: '',
          });

          fallback = {
            ...fallback,
            npcs: fallback.npcs.map((n, idx) =>
              idx === 0
                ? {
                    ...n,
                    agenda:
                      n.agenda ||
                      `Theo đuổi mục tiêu cốt lõi của "${titleBase}" và bảo vệ người/giá trị mình coi trọng.`,
                    friction:
                      n.friction ||
                      'Dễ bất đồng phương pháp, nghi ngờ động cơ hoặc cạnh tranh trực tiếp tài nguyên/cơ duyên với NVC tự tạo.',
                  }
                : n,
            ),
          };

          const defaultDivergencePoints = [
            `Bước ngoặt khởi đầu của "${titleBase}" bị xê dịch sớm do sự xuất hiện của NVC, khiến cơ duyên/manh mối đổi chủ và tạo hiệu ứng Domino.`,
            `Một thế lực thứ ba hoặc nhân vật tuyến phụ hành động sớm hơn nguyên tác, buộc các phe chính phải thay đổi kế hoạch.`,
          ];

          const baseRules =
            fallback.worldRules ||
            `1. Bám sát logic, hệ thống sức mạnh và giới hạn thực tế của "${titleBase}".\n` +
              '2. Mọi năng lực, lựa chọn và can thiệp đều có cái giá và dư chấn nhân quả rõ ràng.';

          fallback = {
            ...fallback,
            worldSetting:
              fallback.worldSetting ||
              `Thế giới đồng nhân xây dựng từ "${titleBase}". ${
                trimmedSource
                  ? trimmedSource.slice(0, 320)
                  : 'Bối cảnh mở đầu với nhiều phe phái và lợi ích đan xen.'
              }`,
            worldRules: ensureInCharacterCausalityRule(baseRules, titleBase),
            divergencePoints:
              fallback.divergencePoints && fallback.divergencePoints.length > 0
                ? fallback.divergencePoints
                : defaultDivergencePoints,
            npcs:
              fallback.npcs.length >= 2
                ? fallback.npcs
                : [
                    ...fallback.npcs,
                    {
                      id: `npc_${Date.now()}_1`,
                      name: 'Nhân vật chủ chốt phe đồng minh / trung lập',
                      role: 'Cộng sự có điều kiện / Kẻ giữ tin',
                      personality:
                        'Thực tế, khôn ngoan, ưu tiên lợi ích phe mình hơn lời hứa suông.',
                      agenda: `Tận dụng biến động trong "${titleBase}" để mở rộng ảnh hưởng và giữ thế chủ động thông tin.`,
                      friction:
                        'Chỉ hợp tác khi có lợi ích song phương rõ ràng; sẵn sàng rút lui nếu NVC quá mạo hiểm.',
                      desc: `Am hiểu góc khuất của "${titleBase}", hành động theo nguyên tắc riêng.`,
                    },
                    {
                      id: `npc_${Date.now()}_2`,
                      name: 'Đối thủ / Biến số phe đối lập',
                      role: 'Thử thách / Đối trọng',
                      personality:
                        'Quyết đoán, biết thích nghi trước biến cố mới thay vì đi theo kịch bản cũ.',
                      agenda:
                        'Thay đổi trật tự hiện tại hoặc chiếm lợi thế tại các điểm rẽ nhánh quan trọng.',
                      friction:
                        'Chủ động điều tra và phản công nếu nhận thấy NVC làm lệch kế hoạch của mình.',
                      desc: 'Đại diện cho mâu thuẫn và phản ứng thích nghi của thế lực đối lập.',
                    },
                  ],
          };
          return fallback;
        }, true);

        appendLog(
          `Chưa cấu hình Proxy AI (sau ${elapsedSec}s): đã điền nhanh khung mẫu cục bộ gồm 2 điểm rẽ nhánh, quy tắc In-Character & NPC có động cơ/ma sát riêng.`,
        );
        onNotify(
          'Chưa cấu hình Proxy AI — đã tạo khung mẫu Đồng Nhân cục bộ. Bạn có thể cấu hình Proxy để AI phân tích sâu hơn.',
        );
        return true;
      }

      // Handle timeout, cancel, network or proxy failure explicitly
      if (!aiRes.ok || !aiRes.text) {
        const isTimeout = timedOutLocally || aiRes.errorKind === 'timeout';
        const isCancelled = !isTimeout && aiRes.errorKind === 'aborted';
        const reason = isTimeout
          ? `Quá thời gian chờ (${Math.round(ANALYZE_TIMEOUT_MS / 1000)}s) — proxy hoặc model phản hồi quá chậm.`
          : isCancelled
            ? 'Đã dừng phân tích theo yêu cầu.'
            : aiRes.errorMessage || 'Không nhận được phản hồi từ Proxy AI.';
        const fullMsg = `Phân tích tác phẩm thất bại sau ${elapsedSec}s: ${reason}`;
        setAnalyzeError(fullMsg);
        appendLog(fullMsg);
        onNotify(fullMsg, isCancelled ? 'info' : 'err');
        return false;
      }

      const baseForPreview = overrideSourceContent
        ? { ...cur, sourceContent: overrideSourceContent }
        : cur;
      const previewParsed = parseStructuredFanficFromText(
        aiRes.text,
        baseForPreview,
      );

      if (!previewParsed.ok) {
        const parseErr = `Phân tích tác phẩm thất bại sau ${elapsedSec}s: AI trả về dữ liệu không đúng cấu trúc JSON hợp lệ (hãy thử bấm lại hoặc rút ngắn nội dung gốc).`;
        setAnalyzeError(parseErr);
        appendLog(parseErr);
        onNotify(parseErr, 'err');
        return false;
      }

      const parsedPtsCount = previewParsed.updated.divergencePoints?.length || 0;
      const parsedNpcsCount = previewParsed.updated.npcs.length;

      onUpdateActiveCompanion((latest) => {
        const withLatestSource = overrideSourceContent
          ? { ...latest, sourceContent: overrideSourceContent }
          : latest;
        const applied = parseStructuredFanficFromText(
          aiRes.text!,
          withLatestSource,
        );
        return applied.ok ? applied.updated : withLatestSource;
      }, true);

      appendLog(
        `AI đã phân tích xong sau ${elapsedSec}s (${parsedPtsCount} điểm rẽ nhánh, ${parsedNpcsCount} NPC có động cơ/ma sát riêng, đã bật quy tắc In-Character & Nhân quả).`,
      );
      onNotify(
        `Đã phân tích xong sau ${elapsedSec}s: ${parsedPtsCount} điểm rẽ nhánh, ${parsedNpcsCount} NPC & quy tắc In-Character.`,
      );
      return true;
    } catch (err) {
      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - startTs) / 1000),
      );
      const isTimeout = timedOutLocally;
      const errDetail = isTimeout
        ? `Quá thời gian chờ (${Math.round(ANALYZE_TIMEOUT_MS / 1000)}s).`
        : err instanceof Error
          ? err.message
          : String(err);
      const fullMsg = `Phân tích tác phẩm bị gián đoạn sau ${elapsedSec}s: ${errDetail}`;
      setAnalyzeError(fullMsg);
      appendLog(fullMsg);
      onNotify(fullMsg, 'err');
      return false;
    } finally {
      window.clearTimeout(hardTimeoutId);
      window.clearInterval(elapsedTimer);
      if (analyzeAbortRef.current === controller) {
        analyzeAbortRef.current = null;
      }
      setIsAnalyzing(false);
      setAnalyzeElapsedSec(0);
    }
  };

  const handleQuickGenerate = async () => {
    let queryToUse = cur.sourceQuery || cur.name;
    if (!queryToUse) {
      queryToUse = 'Thế giới Đồng Nhân Giả Tưởng';
      onUpdateActiveCompanion((c) => ({
        ...c,
        sourceQuery: 'Thế giới Đồng Nhân Giả Tưởng',
        name: 'Đồng Nhân — Khởi Tạo Nhanh',
      }));
    }
    let nextContent = cur.sourceContent;
    if (!nextContent?.trim()) {
      const fetched = await handleLookupOriginalWork(queryToUse);
      if (fetched) nextContent = fetched;
    }
    const ok = await handleAnalyzeSourceWork(nextContent);
    if (ok) {
      onNotify(
        'AI Khởi tạo nhanh đã hoàn tất hồ sơ Đồng nhân kèm điểm rẽ nhánh, NPC & quy tắc In-Character.',
      );
    }
  };

  const handleCancelAnimeJourney = () => {
    if (animeJourneyAbortRef.current) {
      animeJourneyAbortRef.current.abort();
    }
  };

  const handleApplySavedAnimePack = (pack: AnimeJourneyPack) => {
    setAnimeJourneyError(null);
    onUpdateActiveCompanion(
      (latest) => applyAnimeJourneyPackToCompanion(latest, pack),
      true,
    );
    onSaveAnimeJourneyPack(pack);
    appendLog(
      `Đã nạp lại gói Hành trình Anime "${pack.animeTitle}" (${pack.journeyMilestones.length} chặng, ${pack.divergencePoints.length} điểm rẽ nhánh, ${pack.npcs.length} NPC) để chơi tiếp / chơi lại ngay.`,
    );
    onNotify(
      `Đã nạp nhanh gói "${pack.animeTitle}" (${pack.journeyMilestones.length} chặng, ${pack.npcs.length} NPC) — sẵn sàng chơi ngay!`,
    );
  };

  const handleBuildAnimeJourney = async (overrideTitle?: string) => {
    if (isBuildingAnimeJourney || isAnalyzing || isLookingUp) return;

    const animeTitle = (
      overrideTitle ??
      cur.sourceQuery ??
      cur.name ??
      ''
    ).trim();
    if (!animeTitle || /^đồng nhân mặc định$/i.test(animeTitle)) {
      onNotify(
        'Hãy nhập tên một bộ anime vào ô "Tên tác phẩm gốc" hoặc chọn nhanh từ danh sách gợi ý.',
        'err',
      );
      return;
    }

    if (animeJourneyAbortRef.current) {
      animeJourneyAbortRef.current.abort();
    }
    const controller = new AbortController();
    animeJourneyAbortRef.current = controller;

    const startTs = Date.now();
    let timedOutLocally = false;

    setAnimeJourneyError(null);
    setAnimeJourneyElapsedSec(0);
    setIsBuildingAnimeJourney(true);

    appendLog(
      `Bắt đầu dựng nhanh gói Hành trình & Chơi lại cho anime "${animeTitle}" (tối đa ${Math.round(
        ANIME_JOURNEY_TIMEOUT_MS / 1000,
      )}s)...`,
    );

    const elapsedTimer = window.setInterval(() => {
      setAnimeJourneyElapsedSec(
        Math.max(1, Math.round((Date.now() - startTs) / 1000)),
      );
    }, 1000);

    const hardTimeoutId = window.setTimeout(() => {
      timedOutLocally = true;
      controller.abort();
    }, ANIME_JOURNEY_TIMEOUT_MS);

    try {
      const presetHint = (cur.creativePresetIds || [])
        .map((id) => getCreativePresetById(id)?.title)
        .filter(Boolean)
        .join(', ');
      const prompt = buildAnimeJourneyPrompt(
        animeTitle,
        [presetHint, cur.creativeDirection].filter(Boolean).join(' | '),
      );

      const aiRes = await callAiJsonOrTextDetailed(state, prompt, {
        systemPrompt:
          'Bạn là kiến trúc sư Đồng Nhân anime. Chỉ trả về 1 JSON hợp lệ bằng tiếng Việt, mỗi mục 1–2 câu súc tích để phản hồi nhanh.',
        signal: controller.signal,
        timeoutMs: ANIME_JOURNEY_TIMEOUT_MS,
        maxTokens: 1500,
        taskSlot: 'fanfic',
        logPrefix: '[Hành trình Anime]',
        onLog: (line) => appendLog(line),
      });

      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - startTs) / 1000),
      );

      if (!aiRes.ok && aiRes.errorKind === 'no_proxy') {
        const offlinePack = buildOfflineAnimeJourneyPack(animeTitle);
        onUpdateActiveCompanion(
          (latest) => applyAnimeJourneyPackToCompanion(latest, offlinePack),
          true,
        );
        onSaveAnimeJourneyPack(offlinePack);
        appendLog(
          `Chưa cấu hình Proxy AI (sau ${elapsedSec}s): đã tạo khung Hành trình Anime cục bộ cho "${animeTitle}" (${offlinePack.journeyMilestones.length} chặng, ${offlinePack.npcs.length} NPC) và lưu vào lịch sử chọn lại nhanh.`,
        );
        onNotify(
          `Đã dựng khung Hành trình cục bộ cho "${animeTitle}" và lưu vào lịch sử chọn lại nhanh.`,
        );
        return;
      }

      if (!aiRes.ok || !aiRes.text) {
        const isTimeout = timedOutLocally || aiRes.errorKind === 'timeout';
        const isCancelled = !isTimeout && aiRes.errorKind === 'aborted';
        const reason = isTimeout
          ? `Quá thời gian chờ (${Math.round(
              ANIME_JOURNEY_TIMEOUT_MS / 1000,
            )}s) — proxy hoặc model phản hồi quá chậm.`
          : isCancelled
            ? 'Đã dừng dựng Hành trình Anime theo yêu cầu.'
            : aiRes.errorMessage || 'Không nhận được phản hồi từ Proxy AI.';
        const fullMsg = `Dựng Hành trình Anime thất bại sau ${elapsedSec}s: ${reason}`;
        setAnimeJourneyError(fullMsg);
        appendLog(fullMsg);
        onNotify(fullMsg, isCancelled ? 'info' : 'err');
        return;
      }

      const pack = parseAnimeJourneyResponse(aiRes.text, animeTitle);
      if (!pack) {
        const parseErr = `Dựng Hành trình Anime thất bại sau ${elapsedSec}s: AI trả về JSON chưa đúng cấu trúc (hãy bấm thử lại).`;
        setAnimeJourneyError(parseErr);
        appendLog(parseErr);
        onNotify(parseErr, 'err');
        return;
      }

      onUpdateActiveCompanion(
        (latest) => applyAnimeJourneyPackToCompanion(latest, pack),
        true,
      );
      onSaveAnimeJourneyPack(pack);
      setSubTab('world');

      appendLog(
        `Đã dựng xong gói Hành trình Anime "${pack.animeTitle}" sau ${elapsedSec}s (${pack.journeyMilestones.length} chặng, ${pack.divergencePoints.length} điểm rẽ nhánh, ${pack.npcs.length} NPC) và lưu vào lịch sử chọn lại nhanh.`,
      );
      onNotify(
        `Đã dựng Hành trình "${pack.animeTitle}" sau ${elapsedSec}s (${pack.journeyMilestones.length} chặng · ${pack.npcs.length} NPC) & lưu lịch sử!`,
      );
    } catch (err) {
      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - startTs) / 1000),
      );
      const errDetail = timedOutLocally
        ? `Quá thời gian chờ (${Math.round(ANIME_JOURNEY_TIMEOUT_MS / 1000)}s).`
        : err instanceof Error
          ? err.message
          : String(err);
      const fullMsg = `Dựng Hành trình Anime bị gián đoạn sau ${elapsedSec}s: ${errDetail}`;
      setAnimeJourneyError(fullMsg);
      appendLog(fullMsg);
      onNotify(fullMsg, 'err');
    } finally {
      window.clearTimeout(hardTimeoutId);
      window.clearInterval(elapsedTimer);
      if (animeJourneyAbortRef.current === controller) {
        animeJourneyAbortRef.current = null;
      }
      setIsBuildingAnimeJourney(false);
      setAnimeJourneyElapsedSec(0);
    }
  };

  const handleClickCreativePreset = (presetId: CompanionCreativePresetId) => {
    const preset = getCreativePresetById(presetId);
    if (!preset) return;
    if (hasCustomCompanionCreativeFields(cur)) {
      setPendingPresetId(presetId);
      return;
    }
    onUpdateActiveCompanion(
      (c) => applyCreativePresetToCompanion(c, presetId, 'replace'),
      true,
    );
    setPendingPresetId(null);
    onNotify(`Đã áp dụng Preset "${preset.title}" vào hồ sơ Đồng nhân.`);
  };

  const handleConfirmPresetMode = (mode: 'merge' | 'replace') => {
    if (!pendingPresetId) return;
    const preset = getCreativePresetById(pendingPresetId);
    onUpdateActiveCompanion(
      (c) => applyCreativePresetToCompanion(c, pendingPresetId, mode),
      true,
    );
    setPendingPresetId(null);
    if (preset) {
      onNotify(
        mode === 'merge'
          ? `Đã gộp Preset "${preset.title}" vào nội dung hiện có (giữ nguyên phần bạn đã nhập).`
          : `Đã áp dụng mẫu Preset "${preset.title}" cho hồ sơ Đồng nhân.`,
      );
    }
  };

  const handleRemovePresetBadge = (presetId: CompanionCreativePresetId) => {
    onUpdateActiveCompanion((c) => ({
      ...c,
      creativePresetIds: (c.creativePresetIds || []).filter(
        (id) => id !== presetId,
      ),
    }));
  };

  const handleRoleTypeChange = (roleType: McRoleType) => {
    onUpdateActiveCompanion((c) => {
      let originRole = c.mc.originRole || '';
      let canonMcRelation = c.mc.canonMcRelation || '';
      if (roleType === 'transmigrator') {
        if (!originRole.trim()) {
          originRole =
            'Người xuyên không vào thế giới nguyên tác, mang theo hiểu biết và con đường phát triển riêng.';
        }
        if (!canonMcRelation.trim()) {
          canonMcRelation =
            'Nhân vật chính nguyên tác vẫn tồn tại song song trong thế giới; có thể gặp gỡ, đồng hành hoặc tạo biến số.';
        }
      } else if (roleType === 'powerhouse') {
        if (!originRole.trim()) {
          originRole =
            'Đại năng / Cường giả đứng đầu một phương trong thế giới, am hiểu quy tắc và bí mật sâu xa.';
        }
        if (!canonMcRelation.trim()) {
          canonMcRelation =
            'Nhân vật chính nguyên tác vẫn hiện diện trong thế giới; nhân vật chính tự tạo có thể là tiền bối, đối thủ hoặc biến số lớn.';
        }
      }
      return {
        ...c,
        mc: { ...c.mc, roleType, originRole, canonMcRelation },
      };
    });
  };

  const handlePickCanonAsMc = (selectedName: string) => {
    if (!selectedName) return;
    const fromCand = (cur.canonCandidates || []).find(
      (c) => c.name === selectedName,
    );
    const fromNpc = (cur.npcs || []).find((n) => n.name === selectedName);
    const src =
      fromCand ||
      (fromNpc
        ? {
            name: fromNpc.name,
            pronoun: cur.mc?.pronoun || 'ta',
            gender: cur.mc?.gender || 'Nam',
            age: cur.mc?.age || '',
            personality: fromNpc.desc || '',
            appearance: cur.mc?.appearance || '',
            role: fromNpc.role || 'Nhân vật nguyên tác',
          }
        : null);
    if (!src) return;

    onUpdateActiveCompanion((c) => ({
      ...c,
      mc: {
        ...c.mc,
        sourceMode: 'canon',
        roleType: 'custom',
        name: src.name,
        pronoun: src.pronoun || c.mc.pronoun || 'ta',
        gender: src.gender || c.mc.gender || 'Nam',
        age: src.age || c.mc.age || '',
        personality: src.personality || c.mc.personality || '',
        appearance: src.appearance || c.mc.appearance || '',
        originRole:
          c.mc.originRole ||
          `Chọn trực tiếp từ nguyên tác: ${src.name}${
            src.role ? ` (${src.role})` : ''
          }`,
      },
    }));
    onNotify(`Đã chọn nhân vật nguyên tác làm nhân vật chính: ${src.name}`);
  };

  const handleAddNpc = () => {
    const name = npcName.trim();
    const celeb = lookupKnownCelebrityProfile(name);
    const role = npcRole.trim() || celeb?.role || 'Nhân vật đồng nhân';
    const birthday = npcBirthday.trim() || celeb?.birthday || '';
    const age =
      npcAge.trim() ||
      computeAgeFromBirthday(birthday, state.memory?.storyClock);
    const fashionStyle = npcFashionStyle.trim() || celeb?.fashionStyle || '';
    const personality = npcPersonality.trim() || celeb?.personality || '';
    const appearance = npcAppearance.trim() || celeb?.appearance || '';
    const relationships = npcRelationships.trim() || celeb?.relationships || '';
    const agenda = npcAgenda.trim();
    const friction = npcFriction.trim();
    const currentLocation = npcCurrentLocation.trim();
    const privateSecret = npcPrivateSecret.trim();
    const signature = npcSignature.trim() || celeb?.signature || '';
    const hasManualInput = Boolean(
      npcAge.trim() ||
        npcBirthday.trim() ||
        npcFashionStyle.trim() ||
        npcPersonality.trim() ||
        npcAppearance.trim() ||
        npcRelationships.trim() ||
        agenda ||
        friction ||
        currentLocation ||
        privateSecret ||
        npcSignature.trim(),
    );
    const summaryDesc = [
      appearance,
      fashionStyle ? `Style: ${fashionStyle}` : '',
      personality,
      relationships,
      agenda ? `Động cơ: ${agenda}` : '',
      friction ? `Ma sát: ${friction}` : '',
      currentLocation ? `Vị trí: ${currentLocation}` : '',
      signature,
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 260);
    if (!name && !summaryDesc) {
      onNotify('Hãy nhập tên hoặc mô tả NPC đồng nhân.', 'err');
      return;
    }
    const createdId = `npc_${Date.now()}`;
    onUpdateActiveCompanion((c) => ({
      ...c,
      npcs: [
        {
          id: createdId,
          name: celeb?.canonicalName || name || `NPC ${(c.npcs?.length || 0) + 1}`,
          role,
          ...(age ? { age } : {}),
          ...(birthday ? { birthday } : {}),
          ...(fashionStyle ? { fashionStyle } : {}),
          desc: summaryDesc,
          ...(personality ? { personality } : {}),
          ...(appearance ? { appearance } : {}),
          ...(relationships ? { relationships } : {}),
          ...(agenda ? { agenda } : {}),
          ...(friction ? { friction } : {}),
          ...(currentLocation ? { currentLocation } : {}),
          ...(privateSecret ? { privateSecret } : {}),
          ...(signature ? { signature } : {}),
          profileManual: hasManualInput,
        },
        ...(c.npcs || []),
      ],
    }));
    setNpcName('');
    setNpcRole('');
    setNpcAge('');
    setNpcBirthday('');
    setNpcFashionStyle('');
    setNpcPersonality('');
    setNpcAppearance('');
    setNpcRelationships('');
    setNpcAgenda('');
    setNpcFriction('');
    setNpcCurrentLocation('');
    setNpcPrivateSecret('');
    setNpcSignature('');
    onNotify(`Đã thêm NPC đồng nhân: ${celeb?.canonicalName || name || 'NPC mới'}`);
  };

  const startEditNpc = (npc: CompanionProfile['npcs'][number]) => {
    setEditingNpcId(npc.id);
    setEditNpcName(npc.name || '');
    setEditNpcRole(npc.role || '');
    setEditNpcAge(npc.age || '');
    setEditNpcBirthday(npc.birthday || '');
    setEditNpcFashionStyle(npc.fashionStyle || '');
    setEditNpcPersonality(npc.personality || '');
    setEditNpcAppearance(npc.appearance || '');
    setEditNpcRelationships(npc.relationships || '');
    setEditNpcAgenda(npc.agenda || '');
    setEditNpcFriction(npc.friction || '');
    setEditNpcCurrentLocation(npc.currentLocation || '');
    setEditNpcPrivateSecret(npc.privateSecret || '');
    setEditNpcSignature(npc.signature || '');
    setEditNpcDesc(npc.desc || '');
  };

  const saveEditNpc = (npcId: string) => {
    const cleanName = editNpcName.trim();
    if (!cleanName) {
      onNotify('Tên NPC không được để trống.', 'err');
      return;
    }
    const cleanRole = editNpcRole.trim() || 'Nhân vật đồng nhân';
    const cleanAge = editNpcAge.trim();
    const cleanBirth = editNpcBirthday.trim();
    const cleanFashion = editNpcFashionStyle.trim();
    const cleanPers = editNpcPersonality.trim();
    const cleanApp = editNpcAppearance.trim();
    const cleanRel = editNpcRelationships.trim();
    const cleanAgenda = editNpcAgenda.trim();
    const cleanFriction = editNpcFriction.trim();
    const cleanLocation = editNpcCurrentLocation.trim();
    const cleanSecret = editNpcPrivateSecret.trim();
    const cleanSig = editNpcSignature.trim();
    const fallbackDesc =
      [
        cleanApp,
        cleanFashion ? `Style: ${cleanFashion}` : '',
        cleanPers,
        cleanRel,
        cleanAgenda ? `Động cơ: ${cleanAgenda}` : '',
        cleanFriction ? `Ma sát: ${cleanFriction}` : '',
        cleanLocation ? `Vị trí: ${cleanLocation}` : '',
        cleanSig,
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 260) || editNpcDesc.trim();
    const hasAnyVivid = Boolean(
      cleanAge ||
        cleanBirth ||
        cleanFashion ||
        cleanPers ||
        cleanApp ||
        cleanRel ||
        cleanAgenda ||
        cleanFriction ||
        cleanLocation ||
        cleanSecret ||
        cleanSig,
    );

    onUpdateActiveCompanion((c) => ({
      ...c,
      npcs: (c.npcs || []).map((n) =>
        n.id === npcId
          ? {
              ...n,
              name: cleanName,
              role: cleanRole,
              age: cleanAge || undefined,
              birthday: cleanBirth || undefined,
              fashionStyle: cleanFashion || undefined,
              desc: fallbackDesc,
              personality: cleanPers || undefined,
              appearance: cleanApp || undefined,
              relationships: cleanRel || undefined,
              agenda: cleanAgenda || undefined,
              friction: cleanFriction || undefined,
              currentLocation: cleanLocation || undefined,
              privateSecret: cleanSecret || undefined,
              signature: cleanSig || undefined,
              profileManual: hasAnyVivid,
            }
          : n,
      ),
    }));
    setEditingNpcId(null);
    onNotify(`Đã cập nhật hồ sơ NPC: ${cleanName}`);
  };

  const handleExportFanfic = () => {
    const safeName = String(cur?.name || 'Dong_Nhan').replace(
      /[^a-zA-Z0-9_\-À-ɏḀ-ỿ]+/g,
      '_',
    );
    triggerDownloadJson(`ARK_DongNhan_${safeName}.json`, cur);
    onNotify(`Đã xuất file Đồng nhân (.json): ${cur.name || 'Đồng nhân'}`);
  };

  const handleImportFanficFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Cấu trúc JSON không hợp lệ');
      }
      const imported: CompanionProfile = {
        id: `comp_${Date.now()}`,
        name: String(parsed.name || 'Đồng nhân nhập từ file'),
        role: String(parsed.role || parsed.sourceQuery || 'Đồng nhân / AU'),
        sourceQuery: String(parsed.sourceQuery || ''),
        sourceContent: String(parsed.sourceContent || ''),
        mc: {
          sourceMode: parsed.mc?.sourceMode === 'canon' ? 'canon' : 'custom',
          name: String(parsed.mc?.name || ''),
          pronoun: String(parsed.mc?.pronoun || ''),
          roleType: parsed.mc?.roleType || 'transmigrator',
          canonMcName: String(parsed.mc?.canonMcName || ''),
          originRole: String(parsed.mc?.originRole || ''),
          canonMcRelation: String(parsed.mc?.canonMcRelation || ''),
          gender: String(parsed.mc?.gender || ''),
          age: String(parsed.mc?.age || ''),
          personality: String(parsed.mc?.personality || ''),
          appearance: String(parsed.mc?.appearance || ''),
        },
        worldSetting: String(parsed.worldSetting || ''),
        worldRules: String(parsed.worldRules || ''),
        animeTone:
          typeof parsed.animeTone === 'string' ? parsed.animeTone : '',
        journeyMilestones: Array.isArray(parsed.journeyMilestones)
          ? parsed.journeyMilestones
              .map((m: unknown) => String(m || '').trim())
              .filter(Boolean)
          : [],
        creativePresetIds: Array.isArray(parsed.creativePresetIds)
          ? parsed.creativePresetIds.filter((id: unknown): id is CompanionCreativePresetId =>
              typeof id === 'string' &&
              VALID_CREATIVE_PRESET_IDS.has(id as CompanionCreativePresetId),
            )
          : [],
        creativeDirection:
          typeof parsed.creativeDirection === 'string'
            ? parsed.creativeDirection
            : '',
        divergencePoints: Array.isArray(parsed.divergencePoints)
          ? parsed.divergencePoints
              .map((p: unknown) => String(p || '').trim())
              .filter(Boolean)
          : [],
        npcs: Array.isArray(parsed.npcs) ? parsed.npcs : [],
        canonCandidates: Array.isArray(parsed.canonCandidates)
          ? parsed.canonCandidates
          : [],
        note: String(parsed.note || ''),
      };
      onImportProfile(imported);
    } catch (err) {
      onNotify(
        `Không thể nạp file Đồng nhân: ${
          err instanceof Error ? err.message : String(err)
        }`,
        'err',
      );
    } finally {
      e.target.value = '';
    }
  };

  return (
    <section className="space-y-4">
      <input
        ref={importFileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFanficFile}
      />

      {/* Source Research & Analysis Card */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              aria-label="Quay về sảnh"
              onClick={() => onNavigate('lobby')}
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.055] text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-50">
                Đồng Nhân
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Tra cứu tác phẩm gốc trên mạng, phân tích thế giới, quy tắc,
                nhân vật chính &amp; NPC.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isLookingUp || isAnalyzing || isBuildingAnimeJourney}
            onClick={() => handleLookupOriginalWork()}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>
              {isLookingUp ? 'Đang tra cứu...' : 'AI Tra Tác Phẩm Gốc'}
            </span>
          </button>
        </div>

        {(() => {
          const fanficSlot = resolveModelForTask(state.config, 'fanfic');
          return (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0e1625]/75 px-3 py-2 text-[11px] ring-1 ring-inset ring-white/[0.07]">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-slate-300">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                <span className="font-semibold text-slate-200">
                  Slot AI Đồng nhân:
                </span>
                <code className="truncate rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10.5px] text-violet-200">
                  {fanficSlot.model || 'Chưa chọn model'}
                </code>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    fanficSlot.isCustomSlot
                      ? 'bg-violet-500/18 text-violet-200 ring-1 ring-inset ring-violet-400/30'
                      : 'bg-white/[0.05] text-slate-400 ring-1 ring-inset ring-white/[0.08]'
                  }`}
                >
                  {fanficSlot.isCustomSlot ? 'Slot riêng' : 'Mặc định (Model chính)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('config')}
                className="shrink-0 rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-semibold text-sky-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-sky-500/18"
              >
                Đổi slot model
              </button>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Tên tác phẩm gốc / Từ khóa tra mạng
            </label>
            <input
              type="text"
              value={cur.sourceQuery || ''}
              onChange={(e) =>
                onUpdateActiveCompanion((c) => ({
                  ...c,
                  sourceQuery: e.target.value,
                  role: e.target.value || 'Đồng nhân / AU',
                }))
              }
              placeholder="Ví dụ: Frieren, Jujutsu Kaisen, Naruto, One Piece..."
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Tên bản Đồng Nhân / AU
            </label>
            <input
              type="text"
              value={cur.name || ''}
              onChange={(e) =>
                onUpdateActiveCompanion((c) => ({
                  ...c,
                  name: e.target.value,
                }))
              }
              placeholder="Ví dụ: Hogwarts Hiện Đại, AU Giang Hồ..."
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
        </div>

        {/* Quick Anime Journey & Replay Pack Studio */}
        {(() => {
          const typedKey = normalizeAnimeKey(cur.sourceQuery || '');
          const matchedSavedPack = typedKey
            ? animeJourneyHistory.find(
                (p) => normalizeAnimeKey(p.animeTitle) === typedKey,
              )
            : undefined;
          return (
            <div className="mt-3 rounded-xl bg-[#0e1625]/90 p-3 ring-1 ring-inset ring-violet-400/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                  <span className="text-xs font-bold text-slate-100">
                    Gói Hành Trình &amp; Chơi Lại Anime
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnimeSuggestions((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-200/90 hover:text-violet-100"
                >
                  <span>
                    {showAnimeSuggestions ? 'Ẩn gợi ý anime' : 'Gợi ý nhanh'}
                  </span>
                  {showAnimeSuggestions ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Nhập tên bất kỳ bộ anime nào ở ô phía trên rồi bấm dựng: sinh nhanh
                văn phong, 3–4 chặng hành trình, điểm rẽ nhánh, luật chống toàn
                năng &amp; 2–3 NPC có ma sát riêng.
              </p>

              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    isBuildingAnimeJourney || isAnalyzing || isLookingUp
                  }
                  onClick={() => handleBuildAnimeJourney()}
                  className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-violet-500 to-indigo-600 px-3.5 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(124,58,237,0.45)] transition-all hover:from-violet-400 hover:to-indigo-500 active:scale-[0.985] disabled:opacity-45 whitespace-nowrap"
                >
                  {isBuildingAnimeJourney ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>
                        Đang dựng hành trình...
                        {animeJourneyElapsedSec > 0
                          ? ` (${animeJourneyElapsedSec}s)`
                          : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Dựng Hành Trình Anime Nhanh</span>
                    </>
                  )}
                </button>
                {isBuildingAnimeJourney && (
                  <button
                    type="button"
                    onClick={handleCancelAnimeJourney}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl bg-rose-500/18 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/35 transition-all hover:bg-rose-500/28 active:scale-[0.98] whitespace-nowrap"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Dừng</span>
                  </button>
                )}
                {!isBuildingAnimeJourney && matchedSavedPack && (
                  <button
                    type="button"
                    onClick={() => handleApplySavedAnimePack(matchedSavedPack)}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500/16 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/30 transition-all hover:bg-emerald-500/24 active:scale-[0.98] whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Chơi lại bản đã lưu</span>
                  </button>
                )}
              </div>

              {showAnimeSuggestions && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {POPULAR_ANIME_SUGGESTIONS.map((title) => {
                    const isSelected =
                      normalizeAnimeKey(cur.sourceQuery || '') ===
                      normalizeAnimeKey(title);
                    const hasSaved = animeJourneyHistory.some(
                      (p) =>
                        normalizeAnimeKey(p.animeTitle) ===
                        normalizeAnimeKey(title),
                    );
                    return (
                      <button
                        key={title}
                        type="button"
                        disabled={isBuildingAnimeJourney}
                        onClick={() => {
                          onUpdateActiveCompanion((c) => ({
                            ...c,
                            sourceQuery: title,
                            role: title,
                          }));
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-45 ${
                          isSelected
                            ? 'bg-violet-500/25 text-violet-100 ring-1 ring-inset ring-violet-400/50'
                            : 'bg-white/[0.045] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                        }`}
                      >
                        {title}
                        {hasSaved ? ' · Đã lưu' : ''}
                      </button>
                    );
                  })}
                </div>
              )}

              {animeJourneyError && (
                <div className="mt-2.5 flex items-start justify-between gap-2 rounded-xl bg-rose-500/12 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/30">
                  <div className="flex min-w-0 items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                    <span className="break-words leading-relaxed">
                      {animeJourneyError}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnimeJourneyError(null)}
                    aria-label="Đóng lỗi dựng hành trình anime"
                    className="shrink-0 rounded-md p-0.5 text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {animeJourneyHistory.length > 0 && (
                <div className="mt-3 border-t border-white/[0.06] pt-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                      <History className="h-3 w-3 text-sky-300" />
                      <span>Đã dựng — Chọn lại 1 chạm</span>
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {animeJourneyHistory.length} bộ
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {animeJourneyHistory.map((pack) => {
                      const isCurrent =
                        normalizeAnimeKey(cur.sourceQuery || '') ===
                        normalizeAnimeKey(pack.animeTitle);
                      return (
                        <div
                          key={pack.id}
                          className={`inline-flex max-w-full items-center gap-1 rounded-lg pl-2.5 pr-1 py-1 text-[11px] ring-1 ring-inset transition-colors ${
                            isCurrent
                              ? 'bg-sky-500/18 text-sky-100 ring-sky-400/40'
                              : 'bg-[#152035]/90 text-slate-200 ring-white/[0.08] hover:bg-[#1a2842]'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={isBuildingAnimeJourney}
                            onClick={() => handleApplySavedAnimePack(pack)}
                            className="flex min-w-0 items-center gap-1.5 text-left disabled:opacity-45"
                            title={`Áp dụng ngay gói Hành trình ${pack.animeTitle} (${pack.journeyMilestones.length} chặng, ${pack.npcs.length} NPC)`}
                          >
                            <span className="truncate max-w-[165px] font-semibold">
                              {pack.animeTitle}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                              {pack.journeyMilestones.length}c·{pack.npcs.length}
                              npc
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Xóa gói ${pack.animeTitle}`}
                            onClick={() => onDeleteAnimeJourneyPack(pack.id)}
                            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-300">
              Nội dung tác phẩm gốc
            </label>
            <span
              className={`text-xs font-medium ${
                isLookingUp
                  ? 'text-sky-300'
                  : hasSourceData
                    ? 'text-emerald-300'
                    : 'text-slate-400'
              }`}
            >
              {isLookingUp
                ? 'Đang tra chuyên sâu...'
                : hasSourceData
                  ? 'Đã có tư liệu'
                  : 'Chưa tra cứu'}
            </span>
          </div>
          <textarea
            value={cur.sourceContent || ''}
            onChange={(e) =>
              onUpdateActiveCompanion((c) => ({
                ...c,
                sourceContent: e.target.value,
              }))
            }
            rows={4}
            placeholder="Dán nội dung truyện, tóm tắt cốt truyện hoặc kết quả AI tra tác phẩm gốc trên mạng vào đây..."
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isAnalyzing || isLookingUp || isBuildingAnimeJourney}
            onClick={() => handleAnalyzeSourceWork()}
            className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] disabled:opacity-45 whitespace-nowrap"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  Đang phân tích...
                  {analyzeElapsedSec > 0 ? ` (${analyzeElapsedSec}s)` : ''}
                </span>
              </>
            ) : (
              <span>Phân tích tác phẩm</span>
            )}
          </button>
          {isAnalyzing && (
            <button
              type="button"
              onClick={handleCancelAnalyze}
              className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl bg-rose-500/18 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/35 transition-all hover:bg-rose-500/28 active:scale-[0.98] whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" />
              <span>Dừng</span>
            </button>
          )}
          <button
            type="button"
            disabled={isLookingUp || isAnalyzing || isBuildingAnimeJourney}
            onClick={() => handleLookupOriginalWork()}
            className="min-h-[38px] rounded-xl bg-white/[0.055] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
          >
            Lấy nguồn trên mạng
          </button>
        </div>

        {analyzeError && (
          <div className="mt-3 flex items-start justify-between gap-2 rounded-xl bg-rose-500/12 px-3 py-2.5 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/30">
            <div className="flex min-w-0 items-start gap-2">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
              <span className="break-words leading-relaxed">{analyzeError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAnalyzeError(null)}
              aria-label="Đóng thông báo lỗi"
              className="shrink-0 rounded-md p-0.5 text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="mt-3.5 max-h-28 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0c1422]/90 p-3 font-mono text-xs whitespace-pre-wrap break-words text-slate-300">
          {statusLogs.join('\n')}
        </div>
      </div>

      {/* Sub-tabs Studio Card */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        {/* Preset Sáng Tạo Đồng Nhân — 1-Tap Mobile-First Quick Strip */}
        <div className="mb-4 rounded-xl bg-[#0e1625]/85 p-3 ring-1 ring-inset ring-white/[0.07]">
          <button
            type="button"
            onClick={() => setPresetsExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-sky-300" />
              <span className="text-xs font-bold text-slate-100">
                Preset Sáng Tạo Đồng Nhân
              </span>
              {(cur.creativePresetIds?.length || 0) > 0 && (
                <span className="rounded-md bg-sky-500/18 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30">
                  {cur.creativePresetIds!.length} đang áp dụng
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <span>{presetsExpanded ? 'Thu gọn' : 'Mở chọn'}</span>
              {presetsExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </span>
          </button>

          {presetsExpanded && (
            <div className="mt-2.5 space-y-2.5">
              <p className="text-[11px] leading-relaxed text-slate-400">
                Chạm 1 mẫu để điền/gộp nhanh vào Thân phận NVC, Mối liên hệ với
                NVC gốc &amp; Định hướng sáng tạo (vẫn sửa tự do sau khi áp
                dụng).
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {COMPANION_CREATIVE_PRESETS.map((preset) => {
                  const isActive = (cur.creativePresetIds || []).includes(
                    preset.id,
                  );
                  const isPending = pendingPresetId === preset.id;
                  const PresetIcon =
                    preset.id === 'domino_divergence'
                      ? GitBranch
                      : preset.id === 'storm_edge_observer'
                        ? Compass
                        : preset.id === 'tradeoff_anti_op'
                          ? Scale
                          : Flame;
                  const accentClass =
                    preset.accent === 'sky'
                      ? 'text-sky-300'
                      : preset.accent === 'violet'
                        ? 'text-violet-300'
                        : preset.accent === 'amber'
                          ? 'text-amber-300'
                          : 'text-rose-300';
                  const activeRingClass =
                    preset.accent === 'sky'
                      ? 'bg-sky-500/14 ring-sky-400/40'
                      : preset.accent === 'violet'
                        ? 'bg-violet-500/14 ring-violet-400/40'
                        : preset.accent === 'amber'
                          ? 'bg-amber-500/14 ring-amber-400/40'
                          : 'bg-rose-500/14 ring-rose-400/40';

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleClickCreativePreset(preset.id)}
                      className={`group flex flex-col items-start rounded-xl p-2.5 text-left ring-1 ring-inset transition-all active:scale-[0.985] ${
                        isPending
                          ? 'bg-amber-500/14 ring-amber-400/50'
                          : isActive
                            ? activeRingClass
                            : 'bg-[#141f33]/85 ring-white/[0.08] hover:bg-[#1a2840] hover:ring-white/[0.16]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-100">
                          <PresetIcon
                            className={`h-3.5 w-3.5 shrink-0 ${accentClass}`}
                          />
                          <span>{preset.title}</span>
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-white/[0.05] text-slate-400'
                          }`}
                        >
                          {isActive ? 'Đã chọn' : preset.shortTag}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-300/85">
                        {preset.summary}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Active preset chips (allow quick removal of badge) */}
              {(cur.creativePresetIds?.length || 0) > 0 && !pendingPresetId && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-medium text-slate-400">
                    Đang gắn:
                  </span>
                  {cur.creativePresetIds!.map((id) => {
                    const p = getCreativePresetById(id);
                    if (!p) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-500/12 px-2 py-0.5 text-[11px] font-medium text-sky-200 ring-1 ring-inset ring-sky-400/25"
                      >
                        <span>{p.title}</span>
                        <button
                          type="button"
                          aria-label={`Bỏ nhãn preset ${p.title}`}
                          onClick={() => handleRemovePresetBadge(id)}
                          className="rounded p-0.5 text-sky-200/75 hover:bg-white/10 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Non-destructive Merge vs Replace confirmation strip when fields already have user content */}
              {pendingPresetId && (() => {
                const chosen = getCreativePresetById(pendingPresetId);
                if (!chosen) return null;
                return (
                  <div className="rounded-xl bg-amber-950/60 p-2.5 ring-1 ring-inset ring-amber-400/35">
                    <p className="text-[11px] leading-relaxed text-amber-100">
                      Hồ sơ hiện đã có nội dung tự nhập ở Thân phận / Liên hệ
                      NVC gốc / Định hướng. Bạn muốn áp dụng{' '}
                      <strong className="font-semibold text-white">
                        {chosen.title}
                      </strong>{' '}
                      theo cách nào?
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleConfirmPresetMode('merge')}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/40 transition-colors hover:bg-emerald-500/30 active:scale-[0.98]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Gộp thêm vào ô hiện có</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmPresetMode('replace')}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-amber-500/18 px-3 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/35 transition-colors hover:bg-amber-500/28 active:scale-[0.98]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Thay thế bằng mẫu này</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingPresetId(null)}
                        className="min-h-[34px] rounded-xl bg-white/[0.06] px-2.5 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.12] hover:text-white"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div
          className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-[#0e1625]/85 p-1 ring-1 ring-inset ring-white/[0.07] sm:grid-cols-5"
          role="tablist"
        >
          {(
            [
              { id: 'mc', label: 'Nhân vật chính' },
              { id: 'world', label: 'Thế giới & Quy tắc' },
              { id: 'npcs', label: `NPC (${cur.npcs?.length || 0})` },
              {
                id: 'portraits',
                label: `Ảnh NV (${(state.portraitBank?.portraits || []).filter((p) => Boolean(p.imageData)).length}/${state.portraitBank?.portraits?.length || 0})`,
              },
              {
                id: 'relations',
                label: 'Mạng lưới QH',
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={subTab === t.id}
              onClick={() => setSubTab(t.id)}
              className={`min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-all whitespace-nowrap truncate ${
                subTab === t.id
                  ? 'bg-sky-500/18 text-sky-100 ring-1 ring-inset ring-sky-400/35 shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: MC */}
        {subTab === 'mc' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Nguồn nhân vật chính
                </label>
                <select
                  value={cur.mc?.sourceMode === 'canon' ? 'canon' : 'custom'}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: {
                        ...c.mc,
                        sourceMode: e.target.value as McSourceMode,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                >
                  <option value="custom">
                    NVC tự tạo (giữ nguyên khi phân tích)
                  </option>
                  <option value="canon">Chọn nhân vật trong nguyên tác</option>
                </select>
              </div>

              {cur.mc?.sourceMode === 'canon' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Chọn nhân vật từ nguyên tác
                  </label>
                  <select
                    value=""
                    onChange={(e) => handlePickCanonAsMc(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  >
                    <option value="">-- Chọn nhân vật nguyên tác / NPC --</option>
                    {canonPool.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Tên nhân vật chính
                </label>
                <input
                  type="text"
                  value={cur.mc?.name || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, name: e.target.value },
                    }))
                  }
                  placeholder="Để trống nếu muốn AI tự đặt tên nhân vật..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Xưng hô
                </label>
                <input
                  type="text"
                  value={cur.mc?.pronoun || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, pronoun: e.target.value },
                    }))
                  }
                  placeholder="Để trống nếu muốn AI tự quyết định xưng hô..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Dạng vai trò nhân vật chính
                </label>
                <select
                  value={cur.mc?.roleType || 'transmigrator'}
                  onChange={(e) =>
                    handleRoleTypeChange(e.target.value as McRoleType)
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                >
                  <option value="transmigrator">
                    Người xuyên không / Chuyển sinh
                  </option>
                  <option value="powerhouse">
                    Đại năng / Cường giả thế giới
                  </option>
                  <option value="custom">Tự tạo nhân vật chính</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Nhân vật chính nguyên tác (vẫn có trong truyện)
                </label>
                <input
                  type="text"
                  value={cur.mc?.canonMcName || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, canonMcName: e.target.value },
                    }))
                  }
                  placeholder="VD: Hàn Lập, Harry Potter, Tôn Ngộ Không..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Thân phận xuyên không / Đại năng / Lai lịch
              </label>
              <textarea
                value={cur.mc?.originRole || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    mc: { ...c.mc, originRole: e.target.value },
                  }))
                }
                rows={2}
                placeholder="Mô tả thân phận xuyên không, cơ duyên, hoặc cảnh giới/lai lịch đại năng..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Mối liên hệ với nhân vật chính nguyên tác
              </label>
              <textarea
                value={cur.mc?.canonMcRelation || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    mc: { ...c.mc, canonMcRelation: e.target.value },
                  }))
                }
                rows={2}
                placeholder="Ví dụ: Nhân vật chính nguyên tác vẫn tồn tại song song; hai bên đồng hành, gặp gỡ hoặc tạo biến số..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Giới tính
                </label>
                <input
                  type="text"
                  value={cur.mc?.gender || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, gender: e.target.value },
                    }))
                  }
                  placeholder="Nam / Nữ / Khác..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Tuổi
                </label>
                <input
                  type="text"
                  value={cur.mc?.age || ''}
                  onChange={(e) =>
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      mc: { ...c.mc, age: e.target.value },
                    }))
                  }
                  placeholder="VD: 20"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Tính cách
              </label>
              <textarea
                value={cur.mc?.personality || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    mc: { ...c.mc, personality: e.target.value },
                  }))
                }
                rows={3}
                placeholder="Mô tả tính cách nhân vật..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Ngoại hình
              </label>
              <textarea
                value={cur.mc?.appearance || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    mc: { ...c.mc, appearance: e.target.value },
                  }))
                }
                rows={3}
                placeholder="Mô tả ngoại hình nhân vật..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>
        )}

        {/* TAB 2: WORLD & RULES */}
        {subTab === 'world' && (
          <div className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Bối cảnh &amp; Không gian thế giới
              </label>
              <textarea
                value={cur.worldSetting || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    worldSetting: e.target.value,
                    note: [e.target.value, c.worldRules]
                      .filter(Boolean)
                      .join(' | ')
                      .slice(0, 240),
                  }))
                }
                rows={4}
                placeholder="Thời đại, địa điểm, phe phái, bối cảnh lịch sử hoặc giả tưởng..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Quy tắc thế giới &amp; Hệ thống sức mạnh / Luật lệ
                </label>
                {!(
                  /in-character|đúng tính cách nguyên tác|không ooc/i.test(
                    cur.worldRules || '',
                  ) && /nhân quả|hậu quả|hệ quả/i.test(cur.worldRules || '')
                ) && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateActiveCompanion((c) => ({
                        ...c,
                        worldRules: ensureInCharacterCausalityRule(
                          c.worldRules,
                          c.sourceQuery || c.name,
                        ),
                      }));
                      onNotify(
                        'Đã chèn quy tắc Giữ đúng tính cách nguyên tác (In-Character) & Hậu quả nhân quả.',
                      );
                    }}
                    className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/14 px-2 py-0.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    <span>+ In-Character &amp; Nhân quả</span>
                  </button>
                )}
              </div>
              <textarea
                value={cur.worldRules || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    worldRules: e.target.value,
                    note: [c.worldSetting, e.target.value]
                      .filter(Boolean)
                      .join(' | ')
                      .slice(0, 240),
                  }))
                }
                rows={4}
                placeholder="Quy tắc vận hành thế giới, giới hạn năng lực, cấm kỵ, giữ đúng tính cách nguyên tác (In-Character) & hậu quả nhân quả..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-violet-200">
                Văn phong &amp; Không khí đặc trưng (Anime / Nguyên tác)
              </label>
              <textarea
                value={cur.animeTone || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    animeTone: e.target.value,
                  }))
                }
                rows={2}
                placeholder="VD: Nhịp kể hoài niệm sâu lắng kiểu Frieren, hoặc kịch tính u tối dồn dập kiểu Jujutsu Kaisen..."
                className="w-full rounded-xl border border-violet-400/20 bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/75 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
              />
            </div>

            {/* 3–4 Mốc chặng hành trình để chơi đi lại có tiến triển rõ ràng */}
            <div className="rounded-xl bg-[#0e1625]/75 p-3 ring-1 ring-inset ring-emerald-400/15">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-xs font-semibold text-slate-100">
                    Mốc chặng hành trình (Chơi lại theo tiến triển)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {cur.journeyMilestones?.length || 0} chặng
                </span>
              </div>

              {(cur.journeyMilestones?.length || 0) > 0 ? (
                <div className="space-y-2">
                  {cur.journeyMilestones!.map((milestone, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-xl bg-[#141f33]/85 p-2 ring-1 ring-inset ring-white/[0.07]"
                    >
                      <span className="mt-1.5 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-md bg-emerald-500/20 px-1 text-[10px] font-bold text-emerald-200 tabular-nums">
                        {idx + 1}
                      </span>
                      <textarea
                        value={milestone}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateActiveCompanion((c) => ({
                            ...c,
                            journeyMilestones: (c.journeyMilestones || []).map(
                              (item, i) => (i === idx ? val : item),
                            ),
                          }));
                        }}
                        rows={2}
                        className="w-full rounded-lg border border-white/[0.07] bg-[#0c1422]/90 px-2.5 py-1.5 text-xs leading-relaxed text-slate-100 focus:border-emerald-400/70 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`Xóa mốc chặng ${idx + 1}`}
                        onClick={() =>
                          onUpdateActiveCompanion((c) => ({
                            ...c,
                            journeyMilestones: (
                              c.journeyMilestones || []
                            ).filter((_, i) => i !== idx),
                          }))
                        }
                        className="mt-1 shrink-0 rounded-lg p-1.5 text-rose-300/80 hover:bg-rose-500/15 hover:text-rose-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Chưa có mốc chặng hành trình. Bấm &quot;Dựng Hành Trình Anime
                  Nhanh&quot; phía trên để tự tạo 3–4 chặng theo bộ anime bạn
                  nhập, hoặc tự thêm bên dưới.
                </p>
              )}

              <div className="mt-2.5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={newMilestoneDraft}
                  onChange={(e) => setNewMilestoneDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMilestoneDraft.trim()) {
                      e.preventDefault();
                      const trimmed = newMilestoneDraft.trim();
                      onUpdateActiveCompanion((c) => ({
                        ...c,
                        journeyMilestones: [
                          ...(c.journeyMilestones || []),
                          trimmed,
                        ],
                      }));
                      setNewMilestoneDraft('');
                    }
                  }}
                  placeholder="Thêm mốc chặng mới (VD: Chặng 1 — Vào học viện, chọn phe)..."
                  className="w-full rounded-lg border border-white/[0.08] bg-[#0c1422]/90 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!newMilestoneDraft.trim()}
                  onClick={() => {
                    const trimmed = newMilestoneDraft.trim();
                    if (!trimmed) return;
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      journeyMilestones: [
                        ...(c.journeyMilestones || []),
                        trimmed,
                      ],
                    }));
                    setNewMilestoneDraft('');
                  }}
                  className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/30 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-sky-200">
                Định hướng sáng tạo Đồng nhân (đưa vào ngữ cảnh &amp; chỉ đạo AI)
              </label>
              <textarea
                value={cur.creativeDirection || ''}
                onChange={(e) =>
                  onUpdateActiveCompanion((c) => ({
                    ...c,
                    creativeDirection: e.target.value,
                  }))
                }
                rows={3}
                placeholder="Bấm một Preset Sáng Tạo Đồng Nhân ở phía trên hoặc tự nhập chỉ đạo: hiệu ứng Domino, góc nhìn bên lề, cơ chế đánh đổi Được-Mất, độ ma sát với NVC gốc..."
                className="w-full rounded-xl border border-sky-400/20 bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            {/* 1–2+ Điểm rẽ nhánh / Biến số có thể bẻ lái */}
            <div className="rounded-xl bg-[#0e1625]/75 p-3 ring-1 ring-inset ring-white/[0.07]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-violet-300" />
                  <span className="text-xs font-semibold text-slate-100">
                    Điểm rẽ nhánh / Biến số có thể bẻ lái
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {cur.divergencePoints?.length || 0} biến số
                </span>
              </div>

              {(cur.divergencePoints?.length || 0) > 0 ? (
                <div className="space-y-2">
                  {cur.divergencePoints!.map((point, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-xl bg-[#141f33]/85 p-2 ring-1 ring-inset ring-white/[0.07]"
                    >
                      <span className="mt-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-500/20 text-[10px] font-bold text-violet-200 tabular-nums">
                        {idx + 1}
                      </span>
                      <textarea
                        value={point}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateActiveCompanion((c) => ({
                            ...c,
                            divergencePoints: (c.divergencePoints || []).map(
                              (item, i) => (i === idx ? val : item),
                            ),
                          }));
                        }}
                        rows={2}
                        className="w-full rounded-lg border border-white/[0.07] bg-[#0c1422]/90 px-2.5 py-1.5 text-xs leading-relaxed text-slate-100 focus:border-violet-400/70 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`Xóa điểm rẽ nhánh ${idx + 1}`}
                        onClick={() =>
                          onUpdateActiveCompanion((c) => ({
                            ...c,
                            divergencePoints: (c.divergencePoints || []).filter(
                              (_, i) => i !== idx,
                            ),
                          }))
                        }
                        className="mt-1 shrink-0 rounded-lg p-1.5 text-rose-300/80 hover:bg-rose-500/15 hover:text-rose-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Chưa có điểm rẽ nhánh nào. Bấm &quot;Phân tích tác phẩm&quot;
                  hoặc &quot;AI Khởi tạo Nhanh&quot; để AI tự sinh 1–2 biến số
                  bẻ lái theo nguyên tác, hoặc tự thêm bên dưới.
                </p>
              )}

              <div className="mt-2.5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={newDivergenceDraft}
                  onChange={(e) => setNewDivergenceDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDivergenceDraft.trim()) {
                      e.preventDefault();
                      const trimmed = newDivergenceDraft.trim();
                      onUpdateActiveCompanion((c) => ({
                        ...c,
                        divergencePoints: [
                          ...(c.divergencePoints || []),
                          trimmed,
                        ],
                      }));
                      setNewDivergenceDraft('');
                    }
                  }}
                  placeholder="Thêm điểm rẽ nhánh mới (VD: Sự kiện X xảy ra sớm hơn...)"
                  className="min-h-[36px] flex-1 rounded-xl border border-white/[0.09] bg-[#0c1422]/90 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-400/70 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!newDivergenceDraft.trim()}
                  onClick={() => {
                    const trimmed = newDivergenceDraft.trim();
                    if (!trimmed) return;
                    onUpdateActiveCompanion((c) => ({
                      ...c,
                      divergencePoints: [
                        ...(c.divergencePoints || []),
                        trimmed,
                      ],
                    }));
                    setNewDivergenceDraft('');
                  }}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl bg-violet-500/18 px-3 text-xs font-semibold text-violet-100 ring-1 ring-inset ring-violet-400/35 transition-colors hover:bg-violet-500/28 disabled:opacity-40 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NPCs */}
        {subTab === 'npcs' && (
          <div className="space-y-3">
            <div className="space-y-2.5 rounded-xl bg-[#111b2c]/85 p-3.5 ring-1 ring-inset ring-white/[0.07]">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Tên NPC / Nhân vật đồng nhân
                  </label>
                  <input
                    type="text"
                    value={npcName}
                    onChange={(e) => setNpcName(e.target.value)}
                    placeholder="Ví dụ: Jennie Kim, Kendall Jenner, Central Cee..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Vai trò / Nghề nghiệp &amp; vị thế
                  </label>
                  <input
                    type="text"
                    value={npcRole}
                    onChange={(e) => setNpcRole(e.target.value)}
                    placeholder="Siêu mẫu, rapper UK, DJ Hollywood, sư phụ..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Tuổi tác
                  </label>
                  <input
                    type="text"
                    value={npcAge}
                    onChange={(e) => setNpcAge(e.target.value)}
                    placeholder="VD: 28 tuổi (tự tính theo mốc truyện nếu để trống)"
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Ngày sinh
                  </label>
                  <input
                    type="text"
                    value={npcBirthday}
                    onChange={(e) => setNpcBirthday(e.target.value)}
                    placeholder="VD: 04/06/1998 hoặc 16/01/1996"
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Style ăn mặc
                </label>
                <textarea
                  value={npcFashionStyle}
                  onChange={(e) => setNpcFashionStyle(e.target.value)}
                  rows={2}
                  placeholder="Gu ăn mặc đúng nghề nghiệp & bối cảnh (VD: streetwear London, tracksuit/puffer/hoodie, quiet luxury, đồ thiết kế cá tính... tránh rập khuôn vest)"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Tính cách &amp; khí chất đặc trưng
                  </label>
                  <textarea
                    value={npcPersonality}
                    onChange={(e) => setNpcPersonality(e.target.value)}
                    rows={2}
                    placeholder="Cách nói chuyện, thói quen, phản ứng khi gặp tình huống bất ngờ/căng thẳng..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Ngoại hình
                  </label>
                  <textarea
                    value={npcAppearance}
                    onChange={(e) => setNpcAppearance(e.target.value)}
                    rows={2}
                    placeholder="Vóc dáng, kiểu tóc, nét mặt, thần thái đúng độ tuổi..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Mối quan hệ &amp; thái độ
                  </label>
                  <input
                    type="text"
                    value={npcRelationships}
                    onChange={(e) => setNpcRelationships(e.target.value)}
                    placeholder="Thân thiết, dè chừng, nể trọng, đồng minh..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Điểm nhấn / Câu cửa miệng / Chi tiết ghi nhớ
                  </label>
                  <input
                    type="text"
                    value={npcSignature}
                    onChange={(e) => setNpcSignature(e.target.value)}
                    placeholder="Thói quen nhỏ, câu nói đặc trưng, chi tiết đáng nhớ..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Động cơ &amp; lập trường riêng
                  </label>
                  <input
                    type="text"
                    value={npcAgenda}
                    onChange={(e) => setNpcAgenda(e.target.value)}
                    placeholder="Mục tiêu thật sự, phe phái hoặc nguyên tắc riêng của NPC..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Điểm xung đột / ma sát tiềm năng
                  </label>
                  <input
                    type="text"
                    value={npcFriction}
                    onChange={(e) => setNpcFriction(e.target.value)}
                    placeholder="Điều dễ khiến NPC nghi ngờ, bất đồng hoặc va chạm lợi ích..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-cyan-200">
                    Vị trí hiện tại (Cách ly cảnh)
                  </label>
                  <input
                    type="text"
                    value={npcCurrentLocation}
                    onChange={(e) => setNpcCurrentLocation(e.target.value)}
                    placeholder="VD: Tửu quán Thập Lý Pha, Chuồng ngựa, Hoa Sơn..."
                    className="w-full rounded-xl border border-cyan-400/20 bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/75 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-amber-200">
                    Bí mật riêng (Cấm NPC khác tự biết)
                  </label>
                  <input
                    type="text"
                    value={npcPrivateSecret}
                    onChange={(e) => setNpcPrivateSecret(e.target.value)}
                    placeholder="Điều chỉ riêng NPC này biết hoặc đang che giấu..."
                    className="w-full rounded-xl border border-amber-400/20 bg-[#0e1625]/85 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleAddNpc}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm NPC</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateActiveCompanion((c) => c, true);
                    triggerConfirm('save_companion');
                    onNotify(`Đã lưu hồ sơ Đồng nhân: ${cur.name}`);
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 active:scale-[0.98] whitespace-nowrap"
                >
                  {isConfirmed('save_companion') ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isConfirmed('save_companion')
                      ? '✓ Đã lưu'
                      : 'Lưu hồ sơ Đồng nhân'}
                  </span>
                </button>
                {(cur.npcs || []).length > 0 && (
                  <button
                    type="button"
                    disabled={isEnrichingAllNpcs}
                    onClick={onEnrichAllNpcs}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-indigo-500/16 px-3 text-xs font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/30 transition-all hover:bg-indigo-500/24 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
                  >
                    {isEnrichingAllNpcs ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isEnrichingAllNpcs
                        ? 'Đang làm sinh động...'
                        : 'Làm sinh động tất cả NPC'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {(cur.npcs || []).length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={npcSearch}
                      onChange={(e) => setNpcSearch(e.target.value)}
                      aria-label="Tìm kiếm NPC đồng nhân"
                      placeholder="Tìm NPC theo tên, vai trò, tính cách, ngoại hình..."
                      className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />
                    {npcSearch && (
                      <button
                        type="button"
                        aria-label="Xóa tìm kiếm NPC"
                        onClick={() => setNpcSearch('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {npcSearch.trim() && (
                    <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {filteredNpcs.length} / {cur.npcs.length}
                    </span>
                  )}
                </div>
              )}

              {!(cur.npcs || []).length ? (
                <p className="rounded-xl bg-[#111b2c]/70 p-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                  Chưa có NPC đồng nhân nào. Bạn có thể bấm &quot;Thêm NPC&quot;
                  hoặc dùng AI Phân tích / AI Khởi tạo nhanh.
                </p>
              ) : !filteredNpcs.length ? (
                <p className="rounded-xl bg-[#111b2c]/70 p-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                  Không tìm thấy NPC nào khớp với &quot;{npcSearch.trim()}&quot;.
                </p>
              ) : (
                filteredNpcs.map(({ npc, originalIdx }) => {
                  const isEditingThis = editingNpcId === npc.id;
                  const isEnrichingThis = enrichingNpcIds.includes(npc.id);
                  const ageBirthLabel = formatAgeBirthdayLabel(
                    npc.age,
                    npc.birthday,
                  );
                  const hasStructured = Boolean(
                    npc.fashionStyle?.trim() ||
                      npc.personality?.trim() ||
                      npc.appearance?.trim() ||
                      npc.relationships?.trim() ||
                      npc.agenda?.trim() ||
                      npc.friction?.trim() ||
                      npc.currentLocation?.trim() ||
                      npc.privateSecret?.trim() ||
                      npc.signature?.trim(),
                  );
                  return (
                    <div
                      key={npc.id || originalIdx}
                      className="rounded-xl bg-[#111b2c]/85 p-3.5 ring-1 ring-inset ring-white/[0.07]"
                    >
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={editNpcName}
                              onChange={(e) => setEditNpcName(e.target.value)}
                              placeholder="Tên NPC"
                              className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs font-semibold text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                            <input
                              type="text"
                              value={editNpcRole}
                              onChange={(e) => setEditNpcRole(e.target.value)}
                              placeholder="Vai trò / Nghề nghiệp & vị thế"
                              className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editNpcAge}
                              onChange={(e) => setEditNpcAge(e.target.value)}
                              placeholder="Tuổi (VD: 28 tuổi)"
                              className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                            <input
                              type="text"
                              value={editNpcBirthday}
                              onChange={(e) =>
                                setEditNpcBirthday(e.target.value)
                              }
                              placeholder="Ngày sinh (VD: 04/06/1998)"
                              className="rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                          </div>
                          <textarea
                            value={editNpcFashionStyle}
                            onChange={(e) =>
                              setEditNpcFashionStyle(e.target.value)
                            }
                            rows={2}
                            placeholder="Style ăn mặc theo nghề nghiệp & bối cảnh (tránh rập khuôn vest)..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <textarea
                            value={editNpcPersonality}
                            onChange={(e) =>
                              setEditNpcPersonality(e.target.value)
                            }
                            rows={2}
                            placeholder="Tính cách & khí chất đặc trưng..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <textarea
                            value={editNpcAppearance}
                            onChange={(e) =>
                              setEditNpcAppearance(e.target.value)
                            }
                            rows={2}
                            placeholder="Ngoại hình (vóc dáng, kiểu tóc, nét mặt, thần thái)..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <textarea
                            value={editNpcRelationships}
                            onChange={(e) =>
                              setEditNpcRelationships(e.target.value)
                            }
                            rows={2}
                            placeholder="Mối quan hệ & thái độ..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={editNpcAgenda}
                              onChange={(e) => setEditNpcAgenda(e.target.value)}
                              placeholder="Động cơ & lập trường riêng..."
                              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                            <input
                              type="text"
                              value={editNpcFriction}
                              onChange={(e) =>
                                setEditNpcFriction(e.target.value)
                              }
                              placeholder="Điểm xung đột / ma sát tiềm năng..."
                              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={editNpcCurrentLocation}
                              onChange={(e) =>
                                setEditNpcCurrentLocation(e.target.value)
                              }
                              placeholder="Vị trí hiện tại (VD: Tửu quán Thập Lý Pha...)"
                              className="w-full rounded-xl border border-cyan-400/22 bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400/75 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                            />
                            <input
                              type="text"
                              value={editNpcPrivateSecret}
                              onChange={(e) =>
                                setEditNpcPrivateSecret(e.target.value)
                              }
                              placeholder="Bí mật riêng (chỉ NPC này biết)..."
                              className="w-full rounded-xl border border-amber-400/22 bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                            />
                          </div>
                          <input
                            type="text"
                            value={editNpcSignature}
                            onChange={(e) =>
                              setEditNpcSignature(e.target.value)
                            }
                            placeholder="Điểm nhấn / Câu cửa miệng / Chi tiết ghi nhớ..."
                            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => saveEditNpc(npc.id)}
                              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/16 px-2.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Lưu thay đổi</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNpcId(null)}
                              className="min-h-[30px] rounded-lg bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
                              <CharacterNameBadge
                                name={npc.name || `NPC ${originalIdx + 1}`}
                                variant="list"
                                isOnline={isCharacterOnlineInSet(
                                  onlineCharacterKeySet,
                                  npc.name || '',
                                  [npc.role, npc.signature],
                                )}
                              />
                              <span className="text-xs text-slate-400">
                                · {npc.role || 'Đồng nhân'}
                              </span>
                              {ageBirthLabel && (
                                <span className="text-xs tabular-nums text-cyan-200/90">
                                  · {ageBirthLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                disabled={isEnrichingThis}
                                onClick={() => onEnrichNpcProfile(npc.id, true)}
                                title="Làm sinh động hồ sơ, tuổi tác & style ăn mặc của NPC này bằng AI"
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-indigo-500/15 px-2.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/28 transition-all hover:bg-indigo-500/24 disabled:opacity-45 whitespace-nowrap"
                              >
                                {isEnrichingThis ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Wand2 className="h-3 w-3" />
                                )}
                                <span>
                                  {isEnrichingThis
                                    ? 'Đang làm...'
                                    : 'Làm sinh động'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditNpc(npc)}
                                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Sửa</span>
                              </button>
                              <button
                                type="button"
                                aria-label={`Xóa NPC ${npc.name}`}
                                onClick={() =>
                                  onUpdateActiveCompanion((c) => ({
                                    ...c,
                                    npcs: c.npcs.filter(
                                      (_, i) => i !== originalIdx,
                                    ),
                                  }))
                                }
                                className="inline-flex min-h-[30px] items-center justify-center rounded-lg bg-rose-500/14 px-2 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {hasStructured ? (
                            <div className="mt-2.5 space-y-1.5 text-xs leading-relaxed">
                              {npc.fashionStyle?.trim() && (
                                <div>
                                  <span className="font-semibold text-violet-300">
                                    Style ăn mặc:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.fashionStyle}
                                  </span>
                                </div>
                              )}
                              {npc.personality?.trim() && (
                                <div>
                                  <span className="font-semibold text-sky-300">
                                    Tính cách &amp; khí chất:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.personality}
                                  </span>
                                </div>
                              )}
                              {npc.appearance?.trim() && (
                                <div>
                                  <span className="font-semibold text-indigo-300">
                                    Ngoại hình:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.appearance}
                                  </span>
                                </div>
                              )}
                              {npc.relationships?.trim() && (
                                <div>
                                  <span className="font-semibold text-emerald-300">
                                    Quan hệ &amp; thái độ:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.relationships}
                                  </span>
                                </div>
                              )}
                              {npc.agenda?.trim() && (
                                <div>
                                  <span className="font-semibold text-cyan-300">
                                    Động cơ &amp; lập trường:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.agenda}
                                  </span>
                                </div>
                              )}
                              {npc.friction?.trim() && (
                                <div>
                                  <span className="font-semibold text-rose-300">
                                    Xung đột / ma sát tiềm năng:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.friction}
                                  </span>
                                </div>
                              )}
                              {npc.currentLocation?.trim() && (
                                <div className="flex items-start gap-1.5">
                                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                                  <div>
                                    <span className="font-semibold text-cyan-300">
                                      Vị trí hiện tại:{' '}
                                    </span>
                                    <span className="text-slate-200">
                                      {npc.currentLocation}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {npc.privateSecret?.trim() && (
                                <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/[0.07] px-2 py-1 ring-1 ring-amber-400/20">
                                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                                  <div>
                                    <span className="font-semibold text-amber-300">
                                      Bí mật riêng:{' '}
                                    </span>
                                    <span className="text-amber-100/90">
                                      {npc.privateSecret}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {npc.signature?.trim() && (
                                <div>
                                  <span className="font-semibold text-amber-300">
                                    Điểm nhấn:{' '}
                                  </span>
                                  <span className="text-slate-300">
                                    {npc.signature}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            npc.desc && (
                              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                                {npc.desc}
                              </p>
                            )
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CHARACTER / NPC PORTRAIT BANK */}
        {subTab === 'portraits' && (
          <PortraitBankPanel
            portraitBank={state.portraitBank}
            appConfig={state.config}
            activeCompanionName={cur.name || 'Đồng nhân'}
            activeMainName={getShowbizMcProfile(state).name}
            storyClock={state.memory?.storyClock}
            hasSeedreamConfigured={hasImageGeneratorConfigured(state.config)}
            generatingPortraitIds={generatingPortraitIds}
            portraitProgress={portraitProgress}
            portraitErrors={portraitErrors}
            enrichingAppearanceIds={enrichingAppearanceIds}
            analyzingIdentityIds={analyzingIdentityIds}
            verifyingReferenceIds={verifyingReferenceIds}
            isEnrichingAppearances={isEnrichingAppearances}
            bgPortraitStatus={bgPortraitStatus}
            onlineCharacterNames={onlineCharacterNames}
            onNavigate={onNavigate}
            onUpdatePortraitBank={onUpdatePortraitBank}
            onSyncFromCompanion={onSyncPortraitsFromCompanion}
            onCleanJunkPortraits={onCleanJunkPortraits}
            onAutoFillAppearances={onAutoFillAppearances}
            onRefreshPortraitAppearance={onRefreshPortraitAppearance}
            onGeneratePortrait={onGeneratePortrait}
            onPreviewPortraitPrompt={onPreviewPortraitPrompt}
            onAnalyzePortraitIdentity={onAnalyzePortraitIdentity}
            onVerifyPortraitAgainstReference={onVerifyPortraitAgainstReference}
            onCancelPortrait={onCancelPortrait}
            onCancelBgPortraits={onCancelBgPortraits}
            onDismissBgPortraitStatus={onDismissBgPortraitStatus}
            onDownloadImage={onDownloadImage}
            onNotify={onNotify}
            onOpenImagePicker={(portraitId, portraitName) =>
              setImagePickerTarget({
                mode: 'character',
                portraitId,
                portraitName,
              })
            }
          />
        )}

        {/* TAB 5: RELATIONSHIP NETWORK GRAPH */}
        {subTab === 'relations' && (
          <div className="space-y-3">
            <div className="space-y-2.5 rounded-xl bg-[#111b2c]/80 px-3.5 py-2.5 ring-1 ring-inset ring-white/[0.07]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Network className="h-4 w-4 text-sky-400" />
                    <h3 className="text-xs font-bold text-slate-100">
                      Mạng lưới Quan hệ Nhân vật ({cur.name || 'Đồng nhân'})
                    </h3>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Chọn bộ lọc bên dưới để chỉ hiển thị đúng nhóm quan hệ cụ
                    thể trên biểu đồ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSyncPortraitsFromCompanion}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 transition-colors hover:bg-sky-500/24 whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Đồng bộ NPC → Sơ đồ</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2">
                <span className="text-[11px] font-semibold text-slate-300">
                  Lọc nhanh kết nối:
                </span>
                {(
                  [
                    {
                      id: 'all',
                      label: 'Tất cả',
                      count: relationQuickCounts.all,
                      dot: 'bg-sky-400',
                      activeClass:
                        'bg-sky-500/22 text-sky-100 ring-sky-400/45',
                    },
                    {
                      id: 'family',
                      label: 'Gia tộc',
                      count: relationQuickCounts.family,
                      dot: 'bg-amber-400',
                      activeClass:
                        'bg-amber-500/22 text-amber-100 ring-amber-400/45',
                    },
                    {
                      id: 'friends',
                      label: 'Bạn thân',
                      count: relationQuickCounts.friends,
                      dot: 'bg-emerald-400',
                      activeClass:
                        'bg-emerald-500/22 text-emerald-100 ring-emerald-400/45',
                    },
                    {
                      id: 'rival',
                      label: 'Đối đầu',
                      count: relationQuickCounts.rival,
                      dot: 'bg-red-500',
                      activeClass:
                        'bg-red-500/22 text-red-100 ring-red-400/45',
                    },
                  ] as const
                ).map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    aria-pressed={relationQuickFilter === btn.id}
                    onClick={() =>
                      setRelationQuickFilter((prev) =>
                        btn.id !== 'all' && prev === btn.id ? 'all' : btn.id,
                      )
                    }
                    className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-all whitespace-nowrap tabular-nums ${
                      relationQuickFilter === btn.id
                        ? btn.activeClass
                        : 'bg-white/[0.04] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${btn.dot}`} />
                    <span>{btn.label}</span>
                    <span className="text-[10px] opacity-80">({btn.count})</span>
                  </button>
                ))}
                {relationQuickFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setRelationQuickFilter('all')}
                    className="ml-auto inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-white/[0.04] px-2 text-[10px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.1] hover:text-white"
                  >
                    <X className="h-3 w-3" />
                    <span>Hiện toàn bộ</span>
                  </button>
                )}
              </div>
              {relationQuickFilter !== 'all' && (
                <div className="text-[10px] text-slate-400">
                  Đang chỉ hiển thị các kết nối thuộc nhóm{' '}
                  <span className="font-semibold text-slate-200">
                    {relationQuickFilter === 'family'
                      ? 'Gia tộc'
                      : relationQuickFilter === 'friends'
                        ? 'Bạn thân'
                        : 'Đối đầu'}
                  </span>
                  . Bấm lại nút đang chọn hoặc &ldquo;Tất cả&rdquo; để quay về toàn bộ mạng lưới.
                </div>
              )}
            </div>

            <RelationshipNetworkGraph
              portraitBank={state.portraitBank}
              memory={state.memory}
              quickFilter={relationQuickFilter}
              onQuickFilterChange={setRelationQuickFilter}
              onTogglePin={handleTogglePortraitPin}
              onToggleAiLock={handleTogglePortraitAiLock}
              onAssignRole={handleAssignPortraitRole}
              onAddRelationshipTag={handleAddPortraitRelationshipTag}
              onAssignFactionTag={handleAssignPortraitFactionTag}
              onUpdatePortraitBank={onUpdatePortraitBank}
            />
          </div>
        )}

        {/* 3-Button Dock Bar */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3.5">
          <button
            type="button"
            disabled={isLookingUp || isAnalyzing}
            onClick={handleQuickGenerate}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl bg-sky-500/16 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 active:scale-[0.985] disabled:opacity-45"
          >
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI Khởi tạo
            </span>
            <span className="text-[10px] font-medium text-sky-200/80">Nhanh</span>
          </button>

          <button
            type="button"
            onClick={handleExportFanfic}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl bg-white/[0.055] px-2 py-2 text-center text-[11px] font-bold tracking-wide text-slate-100 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] active:scale-[0.985]"
          >
            <span className="inline-flex items-center gap-1">
              <Download className="h-3 w-3" />
              File ĐN
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              Xuất JSON
            </span>
          </button>

          <button
            type="button"
            onClick={onEnterCompanionWorld}
            className="flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-b from-emerald-500 to-teal-600 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-white shadow-[0_8px_18px_-6px_rgba(16,185,129,0.45)] transition-all hover:from-emerald-400 hover:to-teal-500 active:scale-[0.985]"
          >
            <span>Áp dụng &amp;</span>
            <span className="text-[10px] font-medium text-emerald-50/90">
              Vào truyện
            </span>
          </button>
        </div>
      </div>

      {/* Saved Fanfic Profiles List */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-50">
              Danh sách Thế giới Đồng nhân đã lưu
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Chọn nhanh, nạp file ĐN (.json) hoặc tạo thêm hồ sơ đồng nhân khác.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Nạp file ĐN</span>
            </button>
            <button
              type="button"
              onClick={onCreateNewProfile}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Hồ sơ mới</span>
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={companionSearch}
              onChange={(e) => setCompanionSearch(e.target.value)}
              aria-label="Tìm nhanh hồ sơ đồng nhân"
              placeholder="Tìm nhanh thế giới đồng nhân, tác phẩm gốc, NVC, NPC..."
              className="min-h-[38px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1.5 pl-8.5 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            {companionSearch && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm hồ sơ đồng nhân"
                onClick={() => setCompanionSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {companionSearch.trim() && (
            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
              {filteredCompanions.length} / {state.companions.length}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {!filteredCompanions.length ? (
            <p className="rounded-xl bg-[#111b2c]/70 p-4 text-center text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06]">
              Không tìm thấy hồ sơ đồng nhân nào khớp với &quot;
              {companionSearch.trim()}&quot;.
            </p>
          ) : (
            filteredCompanions.map((c, idx) => {
              const isAct = c.id === state.activeCompanionId;
              const npcCount = c.npcs?.length || 0;
              const metaLine = [
                c.mc?.name ? `NV chính: ${c.mc.name}` : '',
                npcCount ? `${npcCount} NPC` : '',
                c.worldSetting || c.note || '',
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={c.id}
                  className={`rounded-xl p-3.5 ring-1 ring-inset transition-colors ${
                    isAct
                      ? 'bg-sky-500/[0.09] ring-sky-400/35'
                      : 'bg-[#111b2c]/85 ring-white/[0.07]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-50">
                      {c.name || `Đồng nhân ${idx + 1}`}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        isAct ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                    >
                      {isAct
                        ? 'Đang chọn'
                        : c.sourceQuery || c.role || 'Đồng nhân'}
                    </span>
                  </div>
                  {metaLine && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {metaLine}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectCompanion(c.id)}
                      className={`min-h-[34px] rounded-xl px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                        isAct
                          ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28'
                          : 'bg-sky-500/16 text-sky-100 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/24'
                      }`}
                    >
                      {isAct ? 'Đang dùng' : 'Chọn dùng'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProfile(c.id)}
                      className="min-h-[34px] rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22 whitespace-nowrap"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lightweight On-Demand Image Picker Modal */}
      {imagePickerTarget && (
        <ImagePickerModal
          target={imagePickerTarget}
          portraits={state.portraitBank?.portraits || []}
          turns={state.turns || []}
          currentPage={state.currentPage}
          onClose={() => setImagePickerTarget(null)}
          onAssignToCharacter={(portraitId, src) => {
            const targetChar = (state.portraitBank?.portraits || []).find(
              (p) => p.id === portraitId,
            );
            onUpdatePortraitBank((prev) => ({
              ...prev,
              portraits: (prev.portraits || []).map((p) =>
                p.id === portraitId
                  ? {
                      ...p,
                      imageData: src,
                      autoGenerated: false,
                      avatarLockSourceSig: undefined,
                      updatedAt: Date.now(),
                    }
                  : p,
              ),
            }));
            onNotify(
              `Đã gán ảnh chân dung cho ${targetChar?.name || 'nhân vật'}.`,
            );
          }}
        />
      )}
    </section>
  );
}
