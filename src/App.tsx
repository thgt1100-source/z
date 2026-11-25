/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Home,
  Layers,
  Save,
  Settings,
  Sliders,
  X,
} from 'lucide-react';
import {
  installGlobalTouchFeedback,
  setHapticFeedbackEnabled,
  useActionConfirmFeedback,
} from './utils/touchFeedback';
import { ChatView } from './components/ChatView';
import { CompanionView } from './components/CompanionView';
import { ConfigView } from './components/ConfigView';
import { ConfirmModal } from './components/ConfirmModal';
import { ContextView } from './components/ContextView';
import { DataView } from './components/DataView';
import { ImageSaveModal } from './components/ImageSaveModal';
import { LobbyView } from './components/LobbyView';
import type { BgPortraitStatus } from './components/PortraitBankPanel';
import { PresetView } from './components/PresetView';
import { WorldSetupView } from './components/WorldSetupView';
import {
  getImageProviderLabel,
  getTurnStoryImages,
  hasImageGeneratorConfigured,
  MAX_PENDING_CHAT_IMAGES,
  resolveEnabledStoryImagePositions,
  STORY_IMAGE_POSITION_META,
  STORY_IMAGE_POSITIONS,
  type AnimeJourneyPack,
  type AppConfig,
  type ArkState,
  type BannerMessage,
  type CharacterIdentityLock,
  type CharacterPortrait,
  type CharacterStateSnapshot,
  type CompanionProfile,
  type ContextConfig,
  type ImageProvider,
  type MemoryEntry,
  type MemoryManagerConfig,
  type PendingImage,
  type PlayerInfo,
  type PortraitBankConfig,
  type PortraitGenProgress,
  type ReferenceComparisonResult,
  type StoryClockState,
  type StoryImageConfig,
  type StoryImageGenerationProgress,
  type StoryImageItem,
  type StoryImagePosition,
  type Turn,
  type ViewName,
  WorldInfo,
  WorldSetupPayload,
} from './types/ark';
import {
  normalizeAnimeJourneyHistory,
  upsertAnimeJourneyHistory,
} from './utils/animeJourney';
import {
  AVATAR_COMFYUI_TIMEOUT_MS,
  AVATAR_SEEDREAM_TIMEOUT_MS,
  buildCharacterPortraitPrompt,
  computeAvatarSignature,
  CUSTOM_IMAGE_REQUEST_TIMEOUT_MS,
  detectCharactersInTurnForPortraits,
  enrichVividNpcProfilesWithAi,
  executeModelTurn,
  extractBestCharacterContextFromTurns,
  extractCharacterContextSnippet,
  extractCharacterIdentityLockFromImageWithAiDetailed,
  generateCharacterPortraitImage,
  generateStoryImage,
  generateTurnSuggestionsWithAi,
  isComfyUiBusy,
  LATENT_REQUEST_TIMEOUT_MS,
  mergeCharacterIdentityLock,
  normalizeCharacterKey,
  resolveStoryBeatPromptsForTurn,
  runAiMemorySync,
  runRollingSummaryUpdate,
  stripStoryPlanningAndMeta,
  verifyCharacterImageAgainstReferenceWithAi,
} from './utils/api';
import {
  buildAllowedRosterKeys,
  buildCultivationNonNpcKeys,
  cleanAndDeduplicateCharacterStates,
  cleanJunkCompanionNpcs,
  cleanJunkPortraitsFromBank,
  extractSoloPoseAndExpression,
  findExactProperNameInText,
  isInvalidNpcPortrait,
  isPlayfulTeasingOrParodyName,
  isPortraitAutoScannedUnconfirmed,
  isSoloPoseExpressionSnippet,
  matchPortraitByName,
  resolveEffectiveCharacterAge,
  resolveLocalVividNpcProfile,
  resolvePortraitRoleTier,
  sanitizeCharacterName,
  sanitizeLegacyContextSnippetForPortrait,
  stripNonSceneChatBlocks,
} from './utils/characterUtils';
import {
  compactLongTermMemory,
  extractLocalLongTermMemories,
  mergeMemoryEntries,
} from './utils/longTermMemory';
import {
  buildSuggestedEntitiesNote,
  detectEntitiesNoteMismatch,
  isGenericEntitiesNote,
  normalizeContextConfig,
  resolveContextForTransition,
} from './utils/contextNote';
import {
  extractStoryImageBeatPrompts,
  extractTurnsFromObject,
  getLeadingDraftEndOffset,
  parseSaveJsonSafe,
  sanitizeCompletedStoryResponse,
} from './utils/saveParser';
import {
  clearAutoSaveFromIndexedDb,
  createDefaultMemoryConfig,
  createDefaultModules,
  createDefaultPortraitBank,
  createInitialState,
  DEFAULT_PREFILL,
  DEFAULT_SAFETY,
  DEFAULT_STORY_IMAGE_CONFIG,
  detectStorageHealth,
  downloadImageSource,
  getActiveCompanionFromState,
  loadAutoSaveFromIndexedDb,
  loadBackupTrackingMeta,
  loadBackupTrackingMetaFromIndexedDb,
  loadPersistedStateWithMeta,
  LYRIC_PERFORMANCE_MODULE,
  LYRIC_PERFORMANCE_MODULE_ID,
  markBackupDownloaded,
  normalizeCompanionProfile,
  normalizeMemoryConfig,
  normalizePortraitBank,
  normalizeTawaPreset,
  persistState,
  requestPersistentStorage,
  resolvePersistableActiveView,
  saveAutoSaveToIndexedDb,
  STORAGE_KEY,
  syncPortraitBankWithCompanion,
  triggerDownloadJson,
  type AutoSaveStatus,
  type BackupTrackingMeta,
  type ImageSaveFallbackPayload,
  type StorageHealthInfo,
} from './utils/storage';
import {
  extractPersistableSampleImages,
  mergeUserSampleImages,
  normalizeStoryImageConfig,
} from './utils/imageStyles';
import {
  clearUserSamplesVault,
  loadUserSamplesFromVault,
  saveUserSamplesToVault,
} from './utils/sampleVault';
import {
  buildTurnMediaKey,
  collectReferencedMediaKeys,
  deleteMediaBlob,
  evictDistantMediaUrls,
  extractMediaKey,
  hydrateTurnsMediaForExport,
  isMediaRef,
  LAZY_UNLOAD_PAGE_RADIUS,
  offloadArchivedTurnsMediaToVault,
  offloadDistantTurnImagesToVault,
  prefetchNearbyTurnImages,
  pruneOrphanedMediaBlobs,
  QUICK_OPTIMIZE_PAGE_RADIUS,
  quickOptimizeMediaMemory,
  revokeAllMediaUrls,
  revokeMediaKey,
  storeBlobInMediaVault,
  storeDataUrlInMediaVault,
} from './utils/mediaMemoryManager';
import {
  applyClockDeltaToCultivation,
  createStarterCultivationProfile,
  detectAndSyncStoryBreakthrough,
  detectAndSyncStoryConstitutionEvents,
  detectCultivationSystemKind,
  getCultivationDisplayInfo,
  normalizeCultivationProfile,
} from './utils/cultivation';
import {
  advanceStoryClockFromTurn,
  clockToEpochMinutes,
  createDefaultStoryClock,
  formatStoryClock,
  inferStoryClockFromLegacyTurns,
  normalizeStoryClock,
  reconcileAiClockUpdate,
} from './utils/storyClock';
import {
  clampPageIndex,
  deleteTurnFromState,
  ensureUniqueTurnIds,
  reindexPreClockMapOnDelete,
  resolveActiveStoryCompanionKey,
} from './utils/turnSync';

const VIEW_LABELS: Record<ViewName, string> = {
  lobby: 'Sảnh chính · Sẵn sàng',
  setup: 'Khởi tạo · Dựng Thế giới & Phiên mới',
  chat: 'Truyện · 1 Lượt = 1 Trang',
  config: 'Cấu hình hệ thống · Proxy & Seedream 5 Pro',
  companion: 'Đồng nhân · Tạo Thế giới Đồng nhân',
  preset: 'P&P Preset · Tawa / Omega',
  context: 'Ngữ cảnh · Ký ức & Trạng thái AI',
  data: 'Dữ liệu · Slots & Tải Save',
};

const SYSTEM_CONFIG_VIEWS: ViewName[] = ['config', 'preset', 'context'];

const SYSTEM_QUICK_MENU_ITEMS: Array<{ id: ViewName; label: string }> = [
  { id: 'lobby', label: 'Sảnh chính' },
  { id: 'config', label: 'Cấu hình hệ thống' },
  { id: 'preset', label: 'P&P Preset' },
  { id: 'context', label: 'Ngữ cảnh' },
];

const SESSION_QUICK_MENU_ITEMS: Array<{ id: ViewName; label: string }> = [
  { id: 'lobby', label: 'Sảnh chính' },
  { id: 'setup', label: 'Khởi tạo thế giới' },
  { id: 'companion', label: 'Đồng nhân' },
  { id: 'context', label: 'Ngữ cảnh' },
  { id: 'preset', label: 'P&P Preset' },
  { id: 'config', label: 'Cấu hình hệ thống' },
  { id: 'data', label: 'Dữ liệu & Save' },
];

const SYSTEM_BOTTOM_NAV_ITEMS: Array<{
  id: ViewName;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'lobby', label: 'Sảnh', icon: Home },
  { id: 'config', label: 'Cấu hình', icon: Settings },
  { id: 'preset', label: 'Preset', icon: Sliders },
  { id: 'context', label: 'Ngữ cảnh', icon: Layers },
];

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTone: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function App() {
  const initialLoadRef = useRef<ReturnType<typeof loadPersistedStateWithMeta> | null>(
    null,
  );
  if (!initialLoadRef.current) {
    initialLoadRef.current = loadPersistedStateWithMeta();
  }
  const [state, setState] = useState<ArkState>(
    () => initialLoadRef.current!.state,
  );
  const stateRef = useRef<ArkState>(state);
  stateRef.current = state;

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>(() => ({
    lastSavedAt: initialLoadRef.current!.savedAt,
    lastReason: initialLoadRef.current!.reason || 'init',
    backend: initialLoadRef.current!.hadRawData ? 'ls' : 'none',
    turnCount: initialLoadRef.current!.state.turns.length,
    worldName: initialLoadRef.current!.state.world?.name || '',
    tiered: Boolean(initialLoadRef.current!.isTieredLocalCache),
  }));
  const [storageHealth, setStorageHealth] = useState<StorageHealthInfo | null>(
    null,
  );
  const [backupMeta, setBackupMeta] = useState<BackupTrackingMeta>(() =>
    loadBackupTrackingMeta(),
  );
  const [isQuickBackingUp, setIsQuickBackingUp] = useState(false);

  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const { isConfirmed, triggerConfirm } = useActionConfirmFeedback(1150);

  useEffect(() => {
    return installGlobalTouchFeedback();
  }, []);

  useEffect(() => {
    setHapticFeedbackEnabled(state.config.hapticFeedbackEnabled !== false);
  }, [state.config.hapticFeedbackEnabled]);
  const [imageSaveFallback, setImageSaveFallback] =
    useState<ImageSaveFallbackPayload | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [hasOpenedStory, setHasOpenedStory] = useState<boolean>(
    () => state.turns.length > 0 || state.activeView === 'chat',
  );
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const pendingImagesRef = useRef<PendingImage[]>(pendingImages);
  pendingImagesRef.current = pendingImages;
  const [imageCaption, setImageCaption] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState({ text: 'Sẵn sàng', isErr: false });
  const [streamingState, setStreamingState] = useState<{
    turnIndex: number;
    turnId: string;
    text: string;
  } | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatingImageTurnIdx, setGeneratingImageTurnIdx] = useState<
    number | null
  >(null);
  const [generatingImageTurnId, setGeneratingImageTurnId] = useState<
    string | null
  >(null);
  const [generatingImageProgress, setGeneratingImageProgress] =
    useState<StoryImageGenerationProgress | null>(null);
  const [generatingPortraitIds, setGeneratingPortraitIds] = useState<string[]>(
    [],
  );
  const [portraitErrors, setPortraitErrors] = useState<Record<string, string>>(
    {},
  );
  const [portraitProgress, setPortraitProgress] = useState<
    Record<string, PortraitGenProgress>
  >({});
  const [enrichingAppearanceIds, setEnrichingAppearanceIds] = useState<
    string[]
  >([]);
  const [analyzingIdentityIds, setAnalyzingIdentityIds] = useState<string[]>(
    [],
  );
  const [verifyingReferenceIds, setVerifyingReferenceIds] = useState<string[]>(
    [],
  );
  const [verifyingStoryBeatKey, setVerifyingStoryBeatKey] = useState<
    string | null
  >(null);
  const [isEnrichingAppearances, setIsEnrichingAppearances] = useState(false);
  const [enrichingNpcIds, setEnrichingNpcIds] = useState<string[]>([]);
  const [isEnrichingAllNpcs, setIsEnrichingAllNpcs] = useState(false);
  const [bgPortraitStatus, setBgPortraitStatus] =
    useState<BgPortraitStatus | null>(null);
  const [isSyncingMemory, setIsSyncingMemory] = useState(false);
  const [isSyncingStates, setIsSyncingStates] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [proxyLogs, setProxyLogs] = useState<string[]>([
    'Sẵn sàng kiểm tra proxy...',
  ]);
  const [navBottomOffset, setNavBottomOffset] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Xác nhận',
    cancelLabel: 'Hủy',
    confirmTone: 'primary',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const activeStoryCompanionIdRef = useRef<string | null>(
    state.activeStoryCompanionId ?? null,
  );
  const turnPreClockRef = useRef<Map<number, StoryClockState>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const imageAbortControllerRef = useRef<AbortController | null>(null);
  const suggestionAbortRef = useRef<AbortController | null>(null);
  const bgPortraitAbortRef = useRef<AbortController | null>(null);
  const singlePortraitAbortMapRef = useRef<Map<string, AbortController>>(
    new Map(),
  );
  const inFlightPortraitIdsRef = useRef<Set<string>>(new Set());
  const bgPortraitClearTimerRef = useRef<number | null>(null);
  const streamRafRef = useRef<number | null>(null);
  const streamDrainTimerRef = useRef<number | null>(null);
  const streamDrainResolveRef = useRef<(() => void) | null>(null);
  const streamLastTickRef = useRef<number>(0);
  const streamLastCommitRef = useRef<number>(0);
  const streamTargetRef = useRef<{
    turnIndex: number;
    turnId: string;
    text: string;
  } | null>(null);
  const streamDisplayedLenRef = useRef<number>(0);
  const streamCarryRef = useRef<number>(0);
  const streamFastDrainRef = useRef<boolean>(false);
  const streamAbortedRef = useRef<boolean>(false);
  const persistTimerRef = useRef<number | null>(null);
  const persistDirtyRef = useRef<boolean>(false);
  const lastPersistedFieldsRef = useRef<unknown[] | null>(null);
  const userMutatedBeforeRestoreRef = useRef<boolean>(false);
  const lastQuotaWarnRef = useRef<boolean>(false);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const saveFileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const lobbyBgInputRef = useRef<HTMLInputElement>(null);

  const flushPersistNow = useCallback(
    (overrideState?: ArkState, reason = 'auto') => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const target = overrideState || stateRef.current;
      const lsResult = persistState(target, { reason, skipIdb: true });
      persistDirtyRef.current = false;
      lastPersistedFieldsRef.current = [
        resolvePersistableActiveView(target),
        target.player,
        target.world,
        target.config,
        target.tawaPreset,
        target.context,
        target.turns,
        target.currentPage,
        target.slots,
        target.checkpoint,
        target.streamEnabled,
        target.hideBottomNav,
        target.lobbyBgDataUrl,
        target.storyImage,
        target.memory,
        target.portraitBank,
        target.companions,
        target.companionStories,
        target.companionMemories,
        target.companionPortraits,
        target.companionContexts,
        target.animeJourneyHistory,
        target.activeCompanionId,
        target.activeStoryCompanionId,
      ];

      if (lsResult.quotaFallback && !lastQuotaWarnRef.current) {
        lastQuotaWarnRef.current = true;
        void detectStorageHealth({
          hadLocalStorageData: lsResult.localStorageOk,
          hadIdbAutoSave: true,
          quotaWarning: true,
          tieredActive: Boolean(lsResult.tieredCache),
        }).then((health) => setStorageHealth(health));
      }

      setAutoSaveStatus((prev) => ({
        lastSavedAt: lsResult.savedAt,
        lastReason: reason,
        backend: lsResult.localStorageOk
          ? prev.backend === 'idb+ls' || prev.backend === 'idb'
            ? 'idb+ls'
            : 'ls'
          : prev.backend === 'idb+ls' || prev.backend === 'idb'
            ? 'idb'
            : 'none',
        turnCount: target.turns.length,
        worldName: target.world?.name || '',
        tiered: Boolean(lsResult.tieredCache || prev.tiered),
      }));

      void saveAutoSaveToIndexedDb(target, reason, lsResult.savedAt).then(
        (idbResult) => {
          if (idbResult.quotaError) {
            lastQuotaWarnRef.current = true;
            setBanner({
              text: 'Bộ nhớ trình duyệt gần đầy — dữ liệu đang chơi vẫn giữ an toàn. Hãy bấm "Tối ưu nhanh" hoặc tải Backup (.json) về máy.',
              type: 'err',
            });
            void detectStorageHealth({
              hadLocalStorageData: lsResult.localStorageOk,
              hadIdbAutoSave: idbResult.ok,
              quotaWarning: true,
              tieredActive: Boolean(idbResult.tiered || lsResult.tieredCache),
            }).then((health) => setStorageHealth(health));
          } else if (idbResult.quotaRecovered) {
            setBanner({
              text: 'Bộ nhớ trình duyệt vừa chạm ngưỡng — hệ thống đã tự dọn ảnh rác và lưu phiên an toàn.',
              type: 'info',
            });
          }

          setAutoSaveStatus((prev) => {
            if (prev.lastSavedAt && prev.lastSavedAt > idbResult.savedAt) {
              return prev;
            }
            const nextBackend =
              idbResult.ok && lsResult.localStorageOk
                ? 'idb+ls'
                : idbResult.ok
                  ? 'idb'
                  : lsResult.localStorageOk
                    ? 'ls'
                    : 'none';
            return {
              lastSavedAt: idbResult.savedAt,
              lastReason: reason,
              backend: nextBackend,
              turnCount: target.turns.length,
              worldName: target.world?.name || '',
              tiered: Boolean(idbResult.tiered || lsResult.tieredCache),
            };
          });
        },
      );
    },
    [],
  );

  // Mobile-friendly debounced persistence: skip serialization on transient UI-only switches
  // (showRawTags/showPostMeta) and debounce routine writes so page taps stay instant.
  useEffect(() => {
    const nextFields: unknown[] = [
      resolvePersistableActiveView(state),
      state.player,
      state.world,
      state.config,
      state.tawaPreset,
      state.context,
      state.turns,
      state.currentPage,
      state.slots,
      state.checkpoint,
      state.streamEnabled,
      state.hideBottomNav,
      state.lobbyBgDataUrl,
      state.storyImage,
      state.memory,
      state.portraitBank,
      state.companions,
      state.companionStories,
      state.companionMemories,
      state.companionPortraits,
      state.companionContexts,
      state.animeJourneyHistory,
      state.activeCompanionId,
      state.activeStoryCompanionId,
    ];
    const prevFields = lastPersistedFieldsRef.current;
    if (
      prevFields &&
      prevFields.length === nextFields.length &&
      prevFields.every((val, idx) => Object.is(val, nextFields[idx]))
    ) {
      return;
    }

    if (prevFields !== null) {
      userMutatedBeforeRestoreRef.current = true;
    }
    persistDirtyRef.current = true;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      flushPersistNow(stateRef.current, 'auto');
    }, 220);
  }, [state, flushPersistNow]);

  // Force-flush latest state immediately to IndexedDB + localStorage when mobile browser
  // hides tab, returns to home screen, blurs iframe, freezes, or reloads/unloads.
  useEffect(() => {
    const forceLifecycleFlush = (trigger: string, onlyIfDirty = false) => {
      const cur = stateRef.current;
      const isDirty =
        persistDirtyRef.current || persistTimerRef.current !== null;
      if (onlyIfDirty && !isDirty) return;
      const hasAnyData =
        cur.turns.length > 0 ||
        cur.slots.length > 0 ||
        Object.keys(cur.companionStories || {}).length > 0 ||
        cur.activeView !== 'lobby';
      if (isDirty || hasAnyData) {
        flushPersistNow(cur, trigger);
      }
    };
    const handlePageHide = () => forceLifecycleFlush('pagehide');
    const handleBeforeUnload = () => forceLifecycleFlush('beforeunload');
    const handleFreeze = () => forceLifecycleFlush('freeze');
    const handleWindowBlur = () => forceLifecycleFlush('window_blur', true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        forceLifecycleFlush('visibility_hidden');
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', handleFreeze);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('freeze', handleFreeze);
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [flushPersistNow]);

  // Hydrate any user-assigned Style (01–15) & Camera Angle (01–08) sample images
  // mirrored in IndexedDB (protects user uploads from localStorage quota limits)
  // without EVER overwriting newer user samples already in ARK_LITE_AI_STUDIO_V1.
  useEffect(() => {
    let cancelled = false;
    void loadUserSamplesFromVault().then((vaultSamples) => {
      if (cancelled) return;
      const curSamples = extractPersistableSampleImages(
        stateRef.current.storyImage?.sampleImages,
      );
      if (vaultSamples && Object.keys(vaultSamples).length > 0) {
        const merged = mergeUserSampleImages(curSamples, vaultSamples);
        const curKeys = Object.keys(curSamples);
        const mergedKeys = Object.keys(merged);
        const changed =
          mergedKeys.length !== curKeys.length ||
          mergedKeys.some((k) => merged[k] !== curSamples[k]);
        if (changed) {
          const prev = stateRef.current;
          const nextState: ArkState = {
            ...prev,
            storyImage: {
              ...prev.storyImage,
              sampleImages: merged,
            },
          };
          stateRef.current = nextState;
          setState(nextState);
          flushPersistNow(nextState);
        }
        // Keep IndexedDB synced with any newer entries from localStorage
        if (Object.keys(curSamples).length > 0) {
          void saveUserSamplesToVault(merged);
        }
      } else if (Object.keys(curSamples).length > 0) {
        // Seed IndexedDB mirror from existing ARK_LITE_AI_STUDIO_V1 user samples
        void saveUserSamplesToVault(curSamples);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [flushPersistNow]);

  // Close quick menu when clicking/tapping outside or pressing Escape
  useEffect(() => {
    if (!quickMenuOpen) return;
    const handlePointerDown = (ev: PointerEvent) => {
      if (
        quickMenuRef.current &&
        !quickMenuRef.current.contains(ev.target as Node)
      ) {
        setQuickMenuOpen(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setQuickMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [quickMenuOpen]);

  // Ensure quick menu never remains stuck open across view changes or confirmation modals
  useEffect(() => {
    setQuickMenuOpen(false);
  }, [state.activeView, confirmDialog.open]);

  // Keep bottom navigation synced with visualViewport on mobile keyboards/toolbars
  useEffect(() => {
    const syncViewport = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setNavBottomOffset(0);
        return;
      }
      const offset = Math.max(
        0,
        Math.round(window.innerHeight - (vv.height + vv.offsetTop)),
      );
      setNavBottomOffset(offset);
    };
    syncViewport();
    window.visualViewport?.addEventListener('resize', syncViewport, {
      passive: true,
    });
    window.visualViewport?.addEventListener('scroll', syncViewport, {
      passive: true,
    });
    window.addEventListener('resize', syncViewport, { passive: true });
    window.addEventListener('scroll', syncViewport, { passive: true });
    return () => {
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('scroll', syncViewport);
    };
  }, []);

  // Lazy Unload engine: revoke Object URLs & offload base64 images for pages > 10 away from currentPage
  useEffect(() => {
    const isLobbyActive = state.activeView === 'lobby';
    evictDistantMediaUrls(state.currentPage, LAZY_UNLOAD_PAGE_RADIUS, {
      keepLobbyBg: isLobbyActive,
    });

    if (state.activeView === 'chat') {
      prefetchNearbyTurnImages(state.turns, state.currentPage, 2);
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      // 1. Offload distant turn illustrations / attachments (> 10 pages from currentPage) into IndexedDB Blobs
      void offloadDistantTurnImagesToVault(
        stateRef.current.turns,
        stateRef.current.currentPage,
        LAZY_UNLOAD_PAGE_RADIUS,
      ).then(({ changed, turns: compactedTurns }) => {
        if (cancelled || !changed) return;
        const cur = stateRef.current;
        if (cur.turns.length !== compactedTurns.length) return;
        // Merge only still-matching turns by id so streaming/edited current turns are never overwritten
        const mergedTurns = cur.turns.map((t, idx) => {
          const compacted = compactedTurns[idx];
          if (!compacted || compacted.id !== t.id) return t;
          if (Math.abs(idx - cur.currentPage) <= LAZY_UNLOAD_PAGE_RADIUS) {
            return t;
          }
          if (
            compacted.storyImageData === t.storyImageData &&
            compacted.storyImages === t.storyImages &&
            compacted.imageData === t.imageData &&
            compacted.imageList === t.imageList
          ) {
            return t;
          }
          return {
            ...t,
            storyImageData: compacted.storyImageData,
            ...(compacted.storyImages
              ? { storyImages: compacted.storyImages }
              : {}),
            imageData: compacted.imageData,
            ...(compacted.imageList ? { imageList: compacted.imageList } : {}),
          };
        });
        const activeStoryKey = resolveActiveStoryCompanionKey(cur);
        const nextState: ArkState = {
          ...cur,
          turns: mergedTurns,
          companionStories: activeStoryKey
            ? { ...cur.companionStories, [activeStoryKey]: mergedTurns }
            : cur.companionStories,
        };
        stateRef.current = nextState;
        setState(nextState);
      });

      // 2. Offload inline lobby custom background into IndexedDB when outside Lobby so its Object URL can be unloaded
      const curLobbyBg = stateRef.current.lobbyBgDataUrl;
      if (!isLobbyActive && curLobbyBg && curLobbyBg.startsWith('data:image/')) {
        const bgKey = `lobby_bg:${Date.now()}`;
        void storeDataUrlInMediaVault(bgKey, curLobbyBg).then((ref) => {
          if (cancelled || !ref) return;
          revokeMediaKey('inline:lobby_bg:active');
          revokeMediaKey(bgKey);
          setState((prev) =>
            prev.lobbyBgDataUrl === curLobbyBg
              ? { ...prev, lobbyBgDataUrl: ref }
              : prev,
          );
        });
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state.currentPage, state.turns.length, state.activeView]);

  // Release all managed Object URLs on page unload
  useEffect(() => {
    const onUnload = () => revokeAllMediaUrls();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      revokeAllMediaUrls();
    };
  }, []);

  const showBanner = useCallback((text: string, type: 'info' | 'err' = 'info') => {
    setBanner(text ? { text, type } : null);
  }, []);

  // Startup Auto-Restore from IndexedDB (and saved Slots fallback) + Durable Storage Health Check
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await requestPersistentStorage();

      const [idbRecord, idbBackupMeta] = await Promise.all([
        loadAutoSaveFromIndexedDb(),
        loadBackupTrackingMetaFromIndexedDb(),
      ]);
      if (cancelled) return;

      if (idbBackupMeta) {
        setBackupMeta((prev) =>
          (idbBackupMeta.lastBackupAt || 0) > (prev.lastBackupAt || 0)
            ? idbBackupMeta
            : prev,
        );
      }

      const initMeta = initialLoadRef.current;
      const localState = stateRef.current;
      const localSavedAt = initMeta?.savedAt || 0;
      const localTurns = localState.turns.length;
      const localSlots = localState.slots.length;
      const localHasData =
        localTurns > 0 ||
        localSlots > 0 ||
        Object.keys(localState.companionStories || {}).length > 0;

      let effectiveState = localState;
      let restoredMessage = '';

      if (idbRecord && !userMutatedBeforeRestoreRef.current) {
        const idbHasData =
          idbRecord.turnCount > 0 ||
          idbRecord.slotCount > 0 ||
          Object.keys(idbRecord.state.companionStories || {}).length > 0 ||
          idbRecord.state.activeView !== 'lobby';
        const localIsSlimTieredCache = Boolean(initMeta?.isTieredLocalCache);
        const shouldRestoreFromIdb =
          localIsSlimTieredCache ||
          (!localHasData && idbHasData) ||
          (idbHasData &&
            (idbRecord.savedAt > localSavedAt ||
              idbRecord.turnCount > localTurns ||
              idbRecord.slotCount > localSlots));

        if (shouldRestoreFromIdb) {
          const restoredActiveView: ViewName =
            idbRecord.state.turns.length > 0 &&
            (idbRecord.state.activeView === 'chat' ||
              idbRecord.restoredChatView ||
              (!localHasData && idbRecord.state.activeView === 'lobby'))
              ? 'chat'
              : idbRecord.state.activeView;
          const restored: ArkState = {
            ...idbRecord.state,
            activeView: restoredActiveView,
            currentPage: clampPageIndex(
              idbRecord.state.currentPage,
              idbRecord.state.turns.length,
            ),
          };
          effectiveState = restored;
          activeStoryCompanionIdRef.current =
            restored.activeStoryCompanionId ?? null;
          stateRef.current = restored;
          setState(restored);
          if (restored.turns.length > 0) {
            setHasOpenedStory(true);
          }
          setAutoSaveStatus({
            lastSavedAt: idbRecord.savedAt,
            lastReason: idbRecord.reason || 'auto_restore_idb',
            backend: initMeta?.hadRawData ? 'idb+ls' : 'idb',
            turnCount: restored.turns.length,
            worldName: restored.world?.name || '',
            tiered: Boolean(idbRecord.isTiered || localIsSlimTieredCache),
          });
          if (!localIsSlimTieredCache) {
            flushPersistNow(restored, 'auto_restore_idb');
            restoredMessage =
              restored.activeView === 'chat' && restored.turns.length > 0
                ? `Đã tự động khôi phục phiên gần nhất (Trang ${restored.currentPage + 1}/${restored.turns.length}) từ IndexedDB.`
                : restored.turns.length > 0
                  ? `Đã tự động khôi phục phiên gần nhất (${restored.turns.length} lượt) từ IndexedDB.`
                  : `Đã tự động khôi phục dữ liệu gần nhất (${restored.slots.length} slot) từ IndexedDB.`;
          } else if (restored.activeView === 'chat' && restored.turns.length > 0) {
            restoredMessage = `Đã tự động khôi phục phiên đang đọc (Trang ${restored.currentPage + 1}/${restored.turns.length}) từ Auto-Save.`;
          } else if (restored.turns.length > 0) {
            restoredMessage = `Đã tự động nạp lại phiên gần nhất (${restored.turns.length} lượt) từ Auto-Save.`;
          }
        }
      }

      // Fallback Auto-Restore: if active session turns are empty on reload but saved Slots exist,
      // automatically hydrate the most recent Slot into the active session instead of an empty screen.
      if (
        !userMutatedBeforeRestoreRef.current &&
        effectiveState.turns.length === 0 &&
        effectiveState.slots.length > 0
      ) {
        const sortedSlots = [...effectiveState.slots].sort((a, b) => {
          const ta = a.savedAt ? Date.parse(a.savedAt) || 0 : 0;
          const tb = b.savedAt ? Date.parse(b.savedAt) || 0 : 0;
          return tb - ta;
        });
        const newestSlot = sortedSlots.find(
          (slot) => Array.isArray(slot.turns) && slot.turns.length > 0,
        );
        if (newestSlot) {
          const loadedTurns = ensureUniqueTurnIds(
            JSON.parse(JSON.stringify(newestSlot.turns || [])) as Turn[],
          );
          const nextPlayer: PlayerInfo = newestSlot.player
            ? { ...newestSlot.player }
            : effectiveState.player;
          const nextWorld: WorldInfo = newestSlot.world
            ? { ...newestSlot.world }
            : effectiveState.world;
          const nextMemory = newestSlot.memory
            ? normalizeMemoryConfig(newestSlot.memory)
            : effectiveState.memory;
          const activeComp = getActiveCompanionFromState(effectiveState);
          const nextPortraits = newestSlot.portraitBank
            ? normalizePortraitBank(newestSlot.portraitBank)
            : syncPortraitBankWithCompanion(
                effectiveState.portraitBank,
                activeComp,
                nextPlayer.name,
                nextMemory.storyClock,
              );
          const hydratedFromSlot: ArkState = {
            ...effectiveState,
            turns: loadedTurns,
            currentPage: Math.max(0, loadedTurns.length - 1),
            player: nextPlayer,
            world: nextWorld,
            memory: nextMemory,
            portraitBank: nextPortraits,
            context: newestSlot.context
              ? { ...effectiveState.context, ...newestSlot.context }
              : effectiveState.context,
            tawaPreset: newestSlot.tawaPreset
              ? normalizeTawaPreset(newestSlot.tawaPreset, effectiveState.tawaPreset)
              : effectiveState.tawaPreset,
            activeStoryCompanionId: null,
            activeView: 'chat',
          };
          effectiveState = hydratedFromSlot;
          activeStoryCompanionIdRef.current = null;
          stateRef.current = hydratedFromSlot;
          setState(hydratedFromSlot);
          setHasOpenedStory(true);
          flushPersistNow(hydratedFromSlot, 'auto_restore_slot');
          restoredMessage = `Đã tự động nạp lại Slot gần nhất "${newestSlot.name || 'Save'}" (${loadedTurns.length} lượt).`;
        }
      } else if (!restoredMessage && localHasData) {
        // Seed / sync IndexedDB auto-save mirror on startup when localStorage already has the session
        void saveAutoSaveToIndexedDb(effectiveState, 'startup_sync').then(
          (res) => {
            if (!cancelled && res.ok) {
              setAutoSaveStatus((prev) => ({
                ...prev,
                lastSavedAt: prev.lastSavedAt || res.savedAt,
                backend: prev.backend === 'ls' ? 'idb+ls' : prev.backend,
              }));
            }
          },
        );
        if (initMeta?.restoredChatView && effectiveState.turns.length > 0) {
          restoredMessage = `Đã tự động khôi phục phiên đang đọc (Trang ${effectiveState.currentPage + 1}/${effectiveState.turns.length}).`;
        }
      }

      if (restoredMessage && !cancelled) {
        showBanner(restoredMessage);
      }

      const health = await detectStorageHealth({
        hadLocalStorageData: Boolean(initMeta?.hadRawData),
        hadIdbAutoSave: Boolean(idbRecord),
        quotaWarning: lastQuotaWarnRef.current,
        tieredActive: Boolean(idbRecord?.isTiered || initMeta?.isTieredLocalCache),
      });
      if (!cancelled) {
        setStorageHealth(health);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [flushPersistNow, showBanner]);

  const closeImageSaveFallback = useCallback(() => {
    setImageSaveFallback((prev) => {
      if (prev?.ownsObjectUrl && prev.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  }, []);

  const handleDownloadImage = useCallback(
    (src: string, filename: string) => {
      void downloadImageSource(src, filename, showBanner, {
        onFallbackPreview: (payload) => {
          setImageSaveFallback((prev) => {
            if (prev?.ownsObjectUrl && prev.previewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(prev.previewUrl);
            }
            return payload;
          });
        },
      });
    },
    [showBanner],
  );

  const appendProxyLog = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setProxyLogs((prev) => [...prev, `[${ts}] ${line}`]);
  }, []);

  const prevActiveViewRef = useRef<ViewName>(state.activeView);
  useEffect(() => {
    if (state.activeView === 'chat' || state.turns.length > 0) {
      setHasOpenedStory(true);
    }
  }, [state.activeView, state.turns.length]);

  useEffect(() => {
    if (prevActiveViewRef.current !== state.activeView) {
      prevActiveViewRef.current = state.activeView;
      if (state.activeView !== 'chat') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  }, [state.activeView]);

  const goView = useCallback((viewName: ViewName) => {
    setQuickMenuOpen(false);
    if (stateRef.current.activeView !== viewName) {
      stateRef.current = { ...stateRef.current, activeView: viewName };
      persistDirtyRef.current = true;
    }
    setState((prev) =>
      prev.activeView === viewName ? prev : { ...prev, activeView: viewName },
    );
  }, []);

  // Sync active companion story whenever turns change while inside a companion story
  const updateTurnsWithCompanionSync = useCallback(
    (updater: (turns: Turn[]) => Turn[], nextPage?: number) => {
      setState((prev) => {
        const nextTurns = updater(prev.turns);
        const compKey = activeStoryCompanionIdRef.current;
        const nextCompanionStories = compKey
          ? { ...prev.companionStories, [compKey]: nextTurns }
          : prev.companionStories;
        return {
          ...prev,
          turns: nextTurns,
          currentPage:
            typeof nextPage === 'number'
              ? nextPage
              : Math.min(prev.currentPage, Math.max(0, nextTurns.length - 1)),
          companionStories: nextCompanionStories,
        };
      });
    },
    [],
  );

  const handleUpdateStoryImageConfig = useCallback(
    (
      patchOrUpdater:
        | Partial<StoryImageConfig>
        | ((prev: StoryImageConfig) => Partial<StoryImageConfig>),
    ) => {
      const prev = stateRef.current;
      const prevImg = prev.storyImage || DEFAULT_STORY_IMAGE_CONFIG;
      const patch =
        typeof patchOrUpdater === 'function'
          ? patchOrUpdater(prevImg)
          : patchOrUpdater;
      const nextSamples =
        'sampleImages' in patch
          ? extractPersistableSampleImages(patch.sampleImages)
          : prevImg.sampleImages;
      const nextState: ArkState = {
        ...prev,
        storyImage: {
          ...prevImg,
          ...patch,
          sampleImages: nextSamples,
        },
      };
      stateRef.current = nextState;
      setState(nextState);
      if (
        'enabled' in patch ||
        'autoGenerate' in patch ||
        'enabledPositions' in patch ||
        'maxImagesPerTurn' in patch ||
        'preferClearFaceSolo' in patch ||
        'lockAvatarIdentity' in patch ||
        'sampleImages' in patch ||
        'customStyles' in patch ||
        'promptTemplate' in patch ||
        'stylePreset' in patch ||
        'cameraAngle' in patch
      ) {
        flushPersistNow(nextState);
      }
      if ('sampleImages' in patch) {
        void saveUserSamplesToVault(nextSamples || {});
      }
    },
    [flushPersistNow],
  );

  const updateMemoryWithCompanionSync = useCallback(
    (updater: (prev: MemoryManagerConfig) => MemoryManagerConfig) => {
      setState((prev) => {
        const nextMem = updater(prev.memory || createDefaultMemoryConfig());
        const compKey = activeStoryCompanionIdRef.current;
        const nextCompMemories = compKey
          ? { ...(prev.companionMemories || {}), [compKey]: nextMem }
          : prev.companionMemories || {};
        return {
          ...prev,
          memory: nextMem,
          companionMemories: nextCompMemories,
        };
      });
    },
    [],
  );

  const handleRunMemorySync = useCallback(
    async (
      turnIndex: number,
      mode: 'memory' | 'state' | 'both',
      silent = false,
      stateOverride?: ArkState,
    ) => {
      const working = stateOverride || stateRef.current;
      if (mode === 'memory' || mode === 'both') setIsSyncingMemory(true);
      if (mode === 'state' || mode === 'both') setIsSyncingStates(true);

      let res: Awaited<ReturnType<typeof runAiMemorySync>>;
      try {
        res = await runAiMemorySync({
          state: working,
          turnIndex,
          mode,
          onLog: appendProxyLog,
        });
      } catch (err) {
        res = {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Lỗi không xác định khi đồng bộ ký ức / trạng thái.',
        };
      } finally {
        if (mode === 'memory' || mode === 'both') setIsSyncingMemory(false);
        if (mode === 'state' || mode === 'both') setIsSyncingStates(false);
      }

      if (!res.ok) {
        if (!silent) {
          showBanner(
            res.error || 'Không thể cập nhật ký ức / trạng thái từ AI.',
            'err',
          );
        }
        return {
          ok: false,
          addedMemories: 0,
          updatedStates: 0,
          error: res.error || 'Không thể cập nhật ký ức / trạng thái từ AI.',
        };
      }

      const normKey = (s: string) =>
        String(s || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();

      const nowTs = Date.now();
      const addedMems = res.memories || [];
      const updatedStates = res.states || [];
      const activeCompForMem = getActiveCompanionFromState(working);
      const knownNamesForMem = Array.from(
        new Set(
          [
            working.player?.name || '',
            activeCompForMem?.mc?.name || '',
            ...(activeCompForMem?.npcs || []).map((n) => n.name),
            ...(working.portraitBank?.portraits || [])
              .filter(
                (p) =>
                  !isPortraitAutoScannedUnconfirmed(p) &&
                  !isInvalidNpcPortrait(p),
              )
              .map((p) => p.name),
          ].filter(Boolean),
        ),
      );

      updateMemoryWithCompanionSync((prev) => {
        const nextEntries = addedMems.length
          ? mergeMemoryEntries(prev.entries || [], addedMems, knownNamesForMem)
          : [...(prev.entries || [])];

        let nextStates = [...(prev.characterStates || [])];
        if (updatedStates.length) {
          for (let i = 0; i < updatedStates.length; i++) {
            const st = updatedStates[i];
            const nameKey = normKey(st.name);
            const existingIdx = nextStates.findIndex(
              (s) =>
                (nameKey && normKey(s.name) === nameKey) ||
                (st.isMc && s.isMc),
            );
            if (existingIdx >= 0) {
              const cur = nextStates[existingIdx];
              nextStates[existingIdx] = {
                ...cur,
                name: st.name || cur.name,
                isMc: st.isMc || cur.isMc,
                location: st.location || cur.location,
                mood: st.mood || cur.mood,
                status: st.status || cur.status,
                lastTurnIndex: st.lastTurnIndex ?? cur.lastTurnIndex,
                updatedAt: nowTs + i,
              };
            } else {
              const newSnapshot: CharacterStateSnapshot = {
                id: `st_${nowTs}_${i}_${Math.random().toString(36).slice(2, 5)}`,
                name: st.name,
                isMc: st.isMc,
                location: st.location,
                mood: st.mood,
                status: st.status,
                lastTurnIndex: st.lastTurnIndex,
                updatedAt: nowTs + i,
              };
              nextStates = [...nextStates, newSnapshot];
            }
          }
        }
        nextStates = cleanAndDeduplicateCharacterStates(nextStates, {
          comp: activeCompForMem,
          fallbackMcName: working.player?.name,
          knownValidNames: knownNamesForMem,
        }).states;

        let nextClock = prev.storyClock;
        let nextCultivation = prev.cultivation;
        const preClock = turnPreClockRef.current.get(turnIndex);
        if (
          res.clockUpdate &&
          preClock &&
          prev.storyClock?.enabled &&
          prev.storyClock?.autoAdvance &&
          prev.storyClock?.lastTurnIndex === turnIndex &&
          prev.storyClock?.lastAdvanceReason !== 'Chỉnh tay'
        ) {
          const reconciled = reconcileAiClockUpdate(
            preClock,
            res.clockUpdate,
            turnIndex,
          );
          if (reconciled) {
            const extraDelta =
              clockToEpochMinutes(reconciled) -
              clockToEpochMinutes(prev.storyClock);
            nextClock = reconciled;
            if (extraDelta > 0 && prev.cultivation?.enabled) {
              const cultDelta = applyClockDeltaToCultivation(
                prev.cultivation,
                extraDelta,
                { reason: 'Đồng bộ thời gian AI' },
              );
              nextCultivation = cultDelta.nextProfile;
            }
          }
        }

        return compactLongTermMemory(
          {
            ...prev,
            entries: nextEntries,
            characterStates: nextStates,
            storyClock: nextClock,
            cultivation: nextCultivation,
          },
          knownNamesForMem,
        ).memory;
      });

      if (res.clockUpdate) {
        const preClock = turnPreClockRef.current.get(turnIndex);
        const curClock = stateRef.current.memory?.storyClock;
        if (
          preClock &&
          curClock?.enabled &&
          curClock?.autoAdvance &&
          curClock?.lastTurnIndex === turnIndex &&
          curClock?.lastAdvanceReason !== 'Chỉnh tay'
        ) {
          const reconciled = reconcileAiClockUpdate(
            preClock,
            res.clockUpdate,
            turnIndex,
          );
          if (reconciled) {
            const snap = formatStoryClock(reconciled).compactLabel;
            updateTurnsWithCompanionSync((turns) =>
              turns.map((t, i) =>
                i === turnIndex ? { ...t, storyClockSnapshot: snap } : t,
              ),
            );
          }
        }
      }

      if (!silent) {
        if (mode === 'memory') {
          showBanner(
            addedMems.length
              ? `Đã cập nhật ${addedMems.length} mục ký ức từ Trang ${turnIndex + 1}.`
              : `Trang ${turnIndex + 1} chưa có chi tiết mới cần ghi thêm vào sổ tay.`,
          );
        } else if (mode === 'state') {
          showBanner(
            updatedStates.length
              ? `Đã cập nhật trạng thái cho ${updatedStates.length} nhân vật tại Trang ${turnIndex + 1}.`
              : `Không tìm thấy thay đổi trạng thái nhân vật ở Trang ${turnIndex + 1}.`,
          );
        } else {
          showBanner(
            `Đã đồng bộ ${addedMems.length} ký ức & ${updatedStates.length} trạng thái nhân vật.`,
          );
        }
      }
      return {
        ok: true,
        addedMemories: addedMems.length,
        updatedStates: updatedStates.length,
      };
    },
    [
      appendProxyLog,
      showBanner,
      updateMemoryWithCompanionSync,
      updateTurnsWithCompanionSync,
    ],
  );

  const handleRunRollingSummary = useCallback(
    async (
      forceAllOlder = false,
      silent = false,
      stateOverride?: ArkState,
    ) => {
      const working = stateOverride || stateRef.current;
      setIsSummarizing(true);
      let res: Awaited<ReturnType<typeof runRollingSummaryUpdate>>;
      try {
        res = await runRollingSummaryUpdate({
          state: working,
          forceAllOlder,
          onLog: appendProxyLog,
        });
      } catch (err) {
        res = {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Lỗi không xác định khi tóm tắt mạch truyện.',
        };
      } finally {
        setIsSummarizing(false);
      }

      if (!res.ok) {
        if (!silent) {
          showBanner(
            res.error || 'Không thể tóm tắt các lượt cũ.',
            'err',
          );
        }
        return;
      }

      updateMemoryWithCompanionSync((prev) =>
        compactLongTermMemory({
          ...prev,
          rollingSummary: {
            content: res.content || prev.rollingSummary.content,
            summarizedUpToTurn:
              typeof res.summarizedUpToTurn === 'number'
                ? res.summarizedUpToTurn
                : prev.rollingSummary.summarizedUpToTurn,
            updatedAt: Date.now(),
          },
        }).memory,
      );

      if (!silent) {
        showBanner(
          `Đã cập nhật bản tóm tắt mạch truyện dài (Trang 1–${res.summarizedUpToTurn || 0}).`,
        );
      }
    },
    [appendProxyLog, showBanner, updateMemoryWithCompanionSync],
  );

  const handleCancelStoryImage = useCallback(() => {
    if (imageAbortControllerRef.current) {
      imageAbortControllerRef.current.abort();
      imageAbortControllerRef.current = null;
    }
    setIsGeneratingImage(false);
    setGeneratingImageTurnIdx(null);
    setGeneratingImageTurnId(null);
    setGeneratingImageProgress(null);
    updateTurnsWithCompanionSync((turns) =>
      turns.map((t) => {
        if (!Array.isArray(t.storyImages) || !t.storyImages.length) return t;
        const hasInFlight = t.storyImages.some(
          (item) => item.status === 'pending' || item.status === 'generating',
        );
        if (!hasInFlight) return t;
        const cleaned = t.storyImages
          .map((item) => {
            if (item.status === 'pending' || item.status === 'generating') {
              return item.imageData
                ? { ...item, status: 'done' as const, error: undefined }
                : null;
            }
            return item;
          })
          .filter((x): x is StoryImageItem => Boolean(x));
        return {
          ...t,
          storyImages: cleaned.length > 0 ? cleaned : undefined,
        };
      }),
    );
  }, [updateTurnsWithCompanionSync]);

  const handleCancelAiSuggestions = useCallback(() => {
    if (suggestionAbortRef.current) {
      suggestionAbortRef.current.abort();
      suggestionAbortRef.current = null;
    }
    setIsGeneratingSuggestions(false);
  }, []);

  const handleRequestAiSuggestions = useCallback(
    async (existingSuggestions: string[], turnIndex?: number) => {
      if (suggestionAbortRef.current) {
        suggestionAbortRef.current.abort();
      }
      const controller = new AbortController();
      suggestionAbortRef.current = controller;
      setIsGeneratingSuggestions(true);

      const curState = stateRef.current;
      const resolvedTurnIndex =
        typeof turnIndex === 'number' && Number.isFinite(turnIndex)
          ? turnIndex
          : curState.currentPage;
      try {
        return await generateTurnSuggestionsWithAi({
          state: curState,
          turnIndex: resolvedTurnIndex,
          existingSuggestions,
          signal: controller.signal,
          onLog: appendProxyLog,
        });
      } catch (err) {
        return {
          ok: false,
          aborted: controller.signal.aborted,
          error:
            err instanceof Error
              ? err.message
              : 'Không thể tạo gợi ý lượt mới từ AI.',
        };
      } finally {
        if (suggestionAbortRef.current === controller) {
          suggestionAbortRef.current = null;
          setIsGeneratingSuggestions(false);
        }
      }
    },
    [appendProxyLog],
  );

  const cacheAvatarVisualLock = useCallback(
    (
      portraitId: string,
      visualLock: string,
      sourceSig: string,
      identityLock?: CharacterIdentityLock,
    ) => {
      const cleanedLock = String(visualLock || '').trim();
      const cleanedSig = String(sourceSig || '').trim();
      if (!portraitId || (!cleanedLock && !identityLock)) return;
      setState((prev) => {
        const prevBank = prev.portraitBank || createDefaultPortraitBank();
        let changed = false;
        const nextPortraits = (prevBank.portraits || []).map((p) => {
          if (p.id !== portraitId) return p;
          const mergedLock = mergeCharacterIdentityLock(
            p.identityLock,
            identityLock,
            false,
          );
          const lockJsonSame =
            JSON.stringify(p.identityLock || null) ===
            JSON.stringify(mergedLock || null);
          if (
            p.avatarVisualLock === (cleanedLock || p.avatarVisualLock) &&
            p.avatarLockSourceSig === (cleanedSig || p.avatarLockSourceSig) &&
            lockJsonSame
          ) {
            return p;
          }
          changed = true;
          return {
            ...p,
            identityLock: mergedLock,
            avatarVisualLock: cleanedLock || p.avatarVisualLock,
            avatarLockSourceSig: cleanedSig || p.avatarLockSourceSig,
            updatedAt: Date.now(),
          };
        });
        if (!changed) return prev;
        const nextBank: PortraitBankConfig = {
          ...prevBank,
          portraits: nextPortraits,
        };
        const compKey =
          activeStoryCompanionIdRef.current || prev.activeCompanionId || '';
        const nextCompPortraits = compKey
          ? { ...(prev.companionPortraits || {}), [compKey]: nextBank }
          : prev.companionPortraits || {};
        const nextState: ArkState = {
          ...prev,
          portraitBank: nextBank,
          companionPortraits: nextCompPortraits,
        };
        stateRef.current = nextState;
        return nextState;
      });
    },
    [],
  );

  const handleAnalyzePortraitIdentity = useCallback(
    async (
      portraitId: string,
      options?: {
        overwrite?: boolean;
        imageDataOverride?: string;
        isRealPhoto?: boolean;
      },
    ) => {
      const curState = stateRef.current;
      const target = (curState.portraitBank?.portraits || []).find(
        (p) => p.id === portraitId,
      );
      if (!target) return;

      const sourceImg = (
        options?.imageDataOverride ||
        target.referenceImageData ||
        target.imageData ||
        ''
      ).trim();
      if (!sourceImg) {
        showBanner(
          `Nhân vật ${target.name} chưa có ảnh mẫu người thật hoặc ảnh avatar để AI đối chiếu.`,
          'err',
        );
        return;
      }
      if (!curState.config.proxyUrl?.trim()) {
        showBanner(
          'Chưa cấu hình Proxy API nên chưa thể chạy AI đối chiếu ảnh. Bạn vẫn có thể tự nhập khóa nhận diện thủ công.',
          'err',
        );
        return;
      }

      const isRealPhoto = Boolean(
        options?.isRealPhoto ?? Boolean(target.referenceImageData?.trim()),
      );
      setAnalyzingIdentityIds((prev) =>
        prev.includes(portraitId) ? prev : [...prev, portraitId],
      );
      try {
        const resolvedAge = resolveEffectiveCharacterAge({
          age: target.age,
          birthday: target.birthday,
          extraText: [target.appearance, target.role, target.signature]
            .filter(Boolean)
            .join(' '),
          clock: curState.memory?.storyClock,
        });
        const knownAgeLabel = resolvedAge.ageNum
          ? resolvedAge.birthYear
            ? `${resolvedAge.ageNum} tuổi (sinh năm ${resolvedAge.birthYear})`
            : `${resolvedAge.ageNum} tuổi`
          : resolvedAge.ageLabel || undefined;
        const extracted =
          await extractCharacterIdentityLockFromImageWithAiDetailed({
            state: curState,
            characterName: target.name,
            imageData: sourceImg,
            isRealPhotoReference: isRealPhoto,
            knownAgeLabel,
            knownAgeNum: resolvedAge.ageNum,
            existingProfileHints: [
              target.identityLock?.gender,
              knownAgeLabel,
              target.appearance,
              target.fashionStyle,
            ]
              .filter(Boolean)
              .join(', '),
            timeoutMs: 28_000,
            onLog: appendProxyLog,
          });

        if (!extracted.ok || !extracted.visualLock || !extracted.identityLock) {
          showBanner(
            `Không trích xuất được khóa nhận diện cho ${target.name} (model: ${extracted.modelUsed || 'chưa chọn'}): ${extracted.errorMessage || 'Proxy chưa trả về dữ liệu Vision hợp lệ.'}`,
            'err',
          );
          return;
        }

        const sig = computeAvatarSignature(sourceImg);
        const shouldOverwrite = options?.overwrite !== false;
        setState((prev) => {
          const prevBank = prev.portraitBank || createDefaultPortraitBank();
          const nextPortraits = (prevBank.portraits || []).map((p) => {
            if (p.id !== portraitId) return p;
            const nextIdentityLock = mergeCharacterIdentityLock(
              p.identityLock,
              extracted.identityLock,
              shouldOverwrite,
            );
            return {
              ...p,
              identityLock: nextIdentityLock,
              avatarVisualLock: extracted.visualLock || p.avatarVisualLock,
              avatarLockSourceSig: sig,
              updatedAt: Date.now(),
            };
          });
          const nextBank: PortraitBankConfig = {
            ...prevBank,
            portraits: nextPortraits,
          };
          const compKey =
            activeStoryCompanionIdRef.current || prev.activeCompanionId || '';
          const nextCompPortraits = compKey
            ? { ...(prev.companionPortraits || {}), [compKey]: nextBank }
            : prev.companionPortraits || {};
          const nextState: ArkState = {
            ...prev,
            portraitBank: nextBank,
            companionPortraits: nextCompPortraits,
          };
          stateRef.current = nextState;
          return nextState;
        });

        showBanner(
          `Đã phân tích Vision (${extracted.modelUsed}${extracted.usedCustomSlot ? ' · Slot riêng' : ''}) từ ${isRealPhoto ? 'ảnh mẫu người thật' : 'ảnh avatar'} và cập nhật khóa nhận diện cho ${target.name}.`,
        );
      } catch (err) {
        showBanner(
          `Không thể phân tích Vision cho ${target.name}: ${err instanceof Error ? err.message : 'Lỗi kết nối'}`,
          'err',
        );
      } finally {
        setAnalyzingIdentityIds((prev) => prev.filter((id) => id !== portraitId));
      }
    },
    [appendProxyLog, showBanner],
  );

  const handleVerifyPortraitAgainstReference = useCallback(
    async (
      portraitId: string,
      options?: {
        targetImageOverride?: string;
        silent?: boolean;
      },
    ) => {
      const curState = stateRef.current;
      const target = (curState.portraitBank?.portraits || []).find(
        (p) => p.id === portraitId,
      );
      if (!target) return;

      const refImg = String(target.referenceImageData || '').trim();
      const targetImg = String(
        options?.targetImageOverride || target.imageData || '',
      ).trim();

      setVerifyingReferenceIds((prev) =>
        prev.includes(portraitId) ? prev : [...prev, portraitId],
      );
      try {
        const resolvedAge = resolveEffectiveCharacterAge({
          age: target.age,
          birthday: target.birthday,
          extraText: [target.appearance, target.role, target.signature]
            .filter(Boolean)
            .join(' '),
          clock: curState.memory?.storyClock,
        });
        const knownAgeLabel = resolvedAge.ageNum
          ? resolvedAge.birthYear
            ? `${resolvedAge.ageNum} tuổi (sinh năm ${resolvedAge.birthYear})`
            : `${resolvedAge.ageNum} tuổi`
          : resolvedAge.ageLabel || undefined;

        const cmpResult = await verifyCharacterImageAgainstReferenceWithAi({
          state: curState,
          characterName: target.name,
          referenceImageData: refImg,
          targetImageData: targetImg,
          knownAgeLabel,
          knownAgeNum: resolvedAge.ageNum,
          identityLock: target.identityLock,
          profileHints: {
            appearance: target.appearance,
            fashionStyle: target.fashionStyle,
            signature: target.signature,
            personality: target.personality,
            gender: target.identityLock?.gender,
          },
          targetLabel: 'ảnh chân dung nhân vật',
          timeoutMs: 32_000,
          onLog: appendProxyLog,
        });

        setState((prev) => {
          const prevBank = prev.portraitBank || createDefaultPortraitBank();
          const nextPortraits = (prevBank.portraits || []).map((p) =>
            p.id === portraitId
              ? {
                  ...p,
                  lastReferenceComparison: cmpResult,
                  updatedAt: Date.now(),
                }
              : p,
          );
          const nextBank: PortraitBankConfig = {
            ...prevBank,
            portraits: nextPortraits,
          };
          const compKey =
            activeStoryCompanionIdRef.current || prev.activeCompanionId || '';
          const nextCompPortraits = compKey
            ? { ...(prev.companionPortraits || {}), [compKey]: nextBank }
            : prev.companionPortraits || {};
          const nextState: ArkState = {
            ...prev,
            portraitBank: nextBank,
            companionPortraits: nextCompPortraits,
          };
          stateRef.current = nextState;
          return nextState;
        });

        if (!options?.silent) {
          if (cmpResult.status === 'verified') {
            showBanner(
              `Đối chiếu API (${cmpResult.modelUsed}) cho ${target.name}: ${cmpResult.overallScore ?? 0}/100 (Mặt ${cmpResult.faceMatchScore ?? 0} · Tuổi ${cmpResult.ageAccuracyScore ?? 0} · Da ${cmpResult.skinRealismScore ?? 0}).`,
              cmpResult.verdict === 'mismatch' ? 'err' : 'info',
            );
          } else {
            showBanner(
              `Đối chiếu API thất bại cho ${target.name}: ${cmpResult.errorMessage || 'Không thể đối chiếu qua Vision API.'}`,
              'err',
            );
          }
        }
      } catch (err) {
        if (!options?.silent) {
          showBanner(
            `Lỗi khi gọi API đối chiếu ảnh cho ${target.name}: ${err instanceof Error ? err.message : 'Lỗi kết nối'}`,
            'err',
          );
        }
      } finally {
        setVerifyingReferenceIds((prev) =>
          prev.filter((id) => id !== portraitId),
        );
      }
    },
    [appendProxyLog, showBanner],
  );

  const handleVerifyStoryBeatImage = useCallback(
    async (turnIndex: number, position: StoryImagePosition) => {
      const curState = stateRef.current;
      const turn = curState.turns[turnIndex];
      if (!turn) return;
      const beats = getTurnStoryImages(turn);
      const beatItem = beats.find((b) => b.position === position);
      if (!beatItem || !beatItem.imageData?.trim()) {
        showBanner('Chưa có ảnh lượt truyện ở vị trí này để đối chiếu.', 'err');
        return;
      }

      const portraits = curState.portraitBank?.portraits || [];
      const portraitsWithRef = portraits.filter((p) =>
        Boolean((p.referenceImageData || '').trim()),
      );
      if (!portraitsWithRef.length) {
        showBanner(
          'Chưa có nhân vật nào gắn "Ảnh mẫu người thật" để đối chiếu API với ảnh cảnh này. Hãy vào Ảnh NV gắn ảnh mẫu trước.',
          'err',
        );
        return;
      }

      const beatSearchBlob = normalizeCharacterKey(
        `${beatItem.subject || ''} ${beatItem.prompt || ''}`,
      );
      const turnProseBlob = normalizeCharacterKey(
        `${turn.assistant || ''} ${turn.user || ''}`,
      );
      const matchedPortrait =
        portraitsWithRef.find((p) => {
          const key = normalizeCharacterKey(p.name);
          return key && beatSearchBlob.includes(key);
        }) ||
        portraitsWithRef.find((p) => {
          const key = normalizeCharacterKey(p.name);
          return key && turnProseBlob.includes(key);
        }) ||
        portraitsWithRef.find((p) => p.isMc) ||
        portraitsWithRef[0];

      const beatKey = `${turn.id}_${position}`;
      setVerifyingStoryBeatKey(beatKey);
      try {
        const resolvedAge = resolveEffectiveCharacterAge({
          age: matchedPortrait.age,
          birthday: matchedPortrait.birthday,
          extraText: [
            matchedPortrait.appearance,
            matchedPortrait.role,
            matchedPortrait.signature,
          ]
            .filter(Boolean)
            .join(' '),
          clock: curState.memory?.storyClock,
        });
        const knownAgeLabel = resolvedAge.ageNum
          ? resolvedAge.birthYear
            ? `${resolvedAge.ageNum} tuổi (sinh năm ${resolvedAge.birthYear})`
            : `${resolvedAge.ageNum} tuổi`
          : resolvedAge.ageLabel || undefined;

        const posLabel =
          STORY_IMAGE_POSITION_META[position]?.label || position;
        const cmpResult = await verifyCharacterImageAgainstReferenceWithAi({
          state: curState,
          characterName: matchedPortrait.name,
          referenceImageData: matchedPortrait.referenceImageData,
          targetImageData: beatItem.imageData,
          knownAgeLabel,
          knownAgeNum: resolvedAge.ageNum,
          identityLock: matchedPortrait.identityLock,
          profileHints: {
            appearance: matchedPortrait.appearance,
            fashionStyle: matchedPortrait.fashionStyle,
            signature: matchedPortrait.signature,
            personality: matchedPortrait.personality,
            gender: matchedPortrait.identityLock?.gender,
          },
          targetLabel: `ảnh cảnh "${posLabel}" (Trang ${turnIndex + 1})`,
          timeoutMs: 32_000,
          onLog: appendProxyLog,
        });

        updateTurnsWithCompanionSync((turns) =>
          turns.map((t, idx) => {
            if (idx !== turnIndex) return t;
            const curBeats = getTurnStoryImages(t);
            const updatedBeats: StoryImageItem[] = curBeats.map((b) =>
              b.position === position
                ? { ...b, referenceComparison: cmpResult }
                : b,
            );
            return {
              ...t,
              storyImages: updatedBeats,
            };
          }),
        );

        if (cmpResult.status === 'verified') {
          showBanner(
            `Đã đối chiếu ảnh "${posLabel}" với mẫu ${matchedPortrait.name} (${cmpResult.modelUsed}): ${cmpResult.overallScore ?? 0}/100.`,
            cmpResult.verdict === 'mismatch' ? 'err' : 'info',
          );
        } else {
          showBanner(
            `Đối chiếu ảnh "${posLabel}" thất bại: ${cmpResult.errorMessage || 'Vision API không phản hồi.'}`,
            'err',
          );
        }
      } catch (err) {
        showBanner(
          `Lỗi khi đối chiếu ảnh lượt truyện: ${err instanceof Error ? err.message : 'Lỗi kết nối'}`,
          'err',
        );
      } finally {
        setVerifyingStoryBeatKey((cur) => (cur === beatKey ? null : cur));
      }
    },
    [appendProxyLog, showBanner, updateTurnsWithCompanionSync],
  );

  const handleToggleStoryBeatApplyComparison = useCallback(
    (turnIndex: number, position: StoryImagePosition, enabled: boolean) => {
      updateTurnsWithCompanionSync((turns) =>
        turns.map((t, idx) => {
          if (idx !== turnIndex) return t;
          const curBeats = getTurnStoryImages(t);
          const updatedBeats: StoryImageItem[] = curBeats.map((b) =>
            b.position === position && b.referenceComparison
              ? {
                  ...b,
                  referenceComparison: {
                    ...b.referenceComparison,
                    applyToPrompt: enabled,
                  },
                }
              : b,
          );
          return {
            ...t,
            storyImages: updatedBeats,
          };
        }),
      );
    },
    [updateTurnsWithCompanionSync],
  );

  const handleGenerateStoryImage = useCallback(
    async (
      turnIndex: number,
      turnOverride?: Turn,
      singlePosition?: StoryImagePosition,
    ) => {
      const curState = stateRef.current;
      const isComfyStory = curState.config.imageProvider === 'comfyui';
      if (
        imageAbortControllerRef.current !== null ||
        (isComfyStory &&
          (inFlightPortraitIdsRef.current.size > 0 ||
            singlePortraitAbortMapRef.current.size > 0 ||
            bgPortraitAbortRef.current !== null ||
            isComfyUiBusy(curState.config.comfyuiUrl)))
      ) {
        showBanner(
          'Đang có yêu cầu vẽ ảnh đang chạy. Vui lòng chờ hoàn tất hoặc bấm Dừng trước khi tạo ảnh mới.',
        );
        return;
      }
      const targetTurn = turnOverride || curState.turns[turnIndex];
      if (!targetTurn) {
        showBanner('Chưa có lượt truyện để sinh ảnh minh họa.', 'err');
        return;
      }
      const targetTurnId = targetTurn.id;
      const positionsToRun: StoryImagePosition[] = singlePosition
        ? [singlePosition]
        : resolveEnabledStoryImagePositions(curState.storyImage);

      const beatPrompts = resolveStoryBeatPromptsForTurn(targetTurn);

      const controller = new AbortController();
      imageAbortControllerRef.current = controller;
      setIsGeneratingImage(true);
      setGeneratingImageTurnIdx(turnIndex);
      setGeneratingImageTurnId(targetTurnId);
      setGeneratingImageProgress({
        turnId: targetTurnId,
        currentPosition: positionsToRun[0],
        currentIndex: 1,
        total: positionsToRun.length,
        positions: positionsToRun,
      });

      const syncLegacyFields = (items: StoryImageItem[]) => {
        const primary =
          items.find((x) => x.position === 'opening' && x.imageData) ||
          items.find((x) => Boolean(x.imageData));
        return primary
          ? {
              storyImageData: primary.imageData,
              storyImagePrompt: primary.prompt,
              storyImageSubject: primary.subject,
            }
          : {
              storyImageData: undefined,
              storyImagePrompt: undefined,
              storyImageSubject: undefined,
            };
      };

      const mergeTurnBeatImages = (
        updater: (existingByPos: Map<StoryImagePosition, StoryImageItem>) => void,
      ) => {
        updateTurnsWithCompanionSync((turns) =>
          turns.map((t) => {
            if (t.id !== targetTurnId) return t;
            const currentItems = getTurnStoryImages(t);
            const byPos = new Map<StoryImagePosition, StoryImageItem>();
            for (const item of currentItems) {
              byPos.set(item.position, { ...item });
            }
            updater(byPos);
            const ordered = STORY_IMAGE_POSITIONS.map((p) => byPos.get(p)).filter(
              (x): x is StoryImageItem => Boolean(x),
            );
            return {
              ...t,
              storyImages: ordered.length > 0 ? ordered : undefined,
              ...syncLegacyFields(ordered),
            };
          }),
        );
      };

      // Snapshot any verified comparison results per beat BEFORE updating statuses to pending/generating
      // so redrawing NEVER strips or loses the comparison result before generateStoryImage reads it!
      const existingBeatComparisonByPos = new Map<
        StoryImagePosition,
        ReferenceComparisonResult
      >();
      for (const existingBeat of getTurnStoryImages(targetTurn)) {
        if (existingBeat.referenceComparison) {
          existingBeatComparisonByPos.set(
            existingBeat.position,
            existingBeat.referenceComparison,
          );
        }
      }

      // Mark queued beat slots as pending immediately (non-blocking — prose stays visible)
      mergeTurnBeatImages((byPos) => {
        for (const pos of positionsToRun) {
          const prev = byPos.get(pos);
          byPos.set(pos, {
            id: prev?.id || `${targetTurnId}_${pos}`,
            position: pos,
            ...(prev?.imageData ? { imageData: prev.imageData } : {}),
            ...(prev?.referenceComparison
              ? { referenceComparison: prev.referenceComparison }
              : {}),
            ...(prev?.appliedComparisonPatch
              ? { appliedComparisonPatch: prev.appliedComparisonPatch }
              : {}),
            prompt: prev?.prompt || beatPrompts[pos] || '',
            subject: prev?.subject || STORY_IMAGE_POSITION_META[pos].label,
            status: 'pending',
            error: undefined,
          });
        }
      });

      let successCount = 0;
      let appliedPatchCount = 0;
      let lastError = '';
      let lastSubjectLabel = '';

      try {
        for (let stepIdx = 0; stepIdx < positionsToRun.length; stepIdx += 1) {
          if (controller.signal.aborted) {
            break;
          }
          const pos = positionsToRun[stepIdx];
          const liveState = stateRef.current;
          const resolvedIdx = liveState.turns.findIndex(
            (t) => t.id === targetTurnId,
          );
          if (resolvedIdx === -1) {
            return;
          }

          setGeneratingImageProgress({
            turnId: targetTurnId,
            currentPosition: pos,
            currentIndex: stepIdx + 1,
            total: positionsToRun.length,
            positions: positionsToRun,
          });

          mergeTurnBeatImages((byPos) => {
            const prev = byPos.get(pos);
            byPos.set(pos, {
              id: prev?.id || `${targetTurnId}_${pos}`,
              position: pos,
              ...(prev?.imageData ? { imageData: prev.imageData } : {}),
              ...(prev?.referenceComparison
                ? { referenceComparison: prev.referenceComparison }
                : {}),
              ...(prev?.appliedComparisonPatch
                ? { appliedComparisonPatch: prev.appliedComparisonPatch }
                : {}),
              prompt: prev?.prompt || beatPrompts[pos] || '',
              subject: prev?.subject || STORY_IMAGE_POSITION_META[pos].label,
              status: 'generating',
              error: undefined,
            });
          });

          const turnForBeat = liveState.turns[resolvedIdx] || targetTurn;
          const liveBeatCmp =
            getTurnStoryImages(turnForBeat).find((b) => b.position === pos)
              ?.referenceComparison || existingBeatComparisonByPos.get(pos);
          const res = await generateStoryImage({
            state: liveState,
            turn: turnForBeat,
            storyImageConfig: liveState.storyImage,
            position: pos,
            aiBeatPrompt: beatPrompts[pos],
            existingBeatComparison: liveBeatCmp,
            signal: controller.signal,
            onLog: appendProxyLog,
            onCacheAvatarVisualLock: cacheAvatarVisualLock,
          });

          if (res.aborted || controller.signal.aborted) {
            if (imageAbortControllerRef.current === controller) {
              showBanner('Đã hủy yêu cầu sinh ảnh.');
            }
            return;
          }

          const postIdx = stateRef.current.turns.findIndex(
            (t) => t.id === targetTurnId,
          );
          if (postIdx === -1) {
            return;
          }

          if (!res.ok || !res.imageUrl) {
            lastError =
              res.error ||
              'Không thể sinh ảnh minh họa. Kiểm tra lại cấu hình ComfyUI / Seedream.';
            mergeTurnBeatImages((byPos) => {
              const prev = byPos.get(pos);
              byPos.set(pos, {
                id: prev?.id || `${targetTurnId}_${pos}`,
                position: pos,
                ...(prev?.imageData ? { imageData: prev.imageData } : {}),
                ...(prev?.referenceComparison
                  ? { referenceComparison: prev.referenceComparison }
                  : {}),
                ...(prev?.appliedComparisonPatch
                  ? { appliedComparisonPatch: prev.appliedComparisonPatch }
                  : {}),
                prompt: res.prompt || prev?.prompt || '',
                subject: res.subjectLabel || STORY_IMAGE_POSITION_META[pos].label,
                status: 'error',
                error: lastError,
              });
            });
            continue;
          }

          const oldTurn = stateRef.current.turns[postIdx];
          if (oldTurn) {
            const beatKey = buildTurnMediaKey('story', oldTurn, postIdx, pos);
            revokeMediaKey(beatKey);
            revokeMediaKey(`inline:${beatKey}`);
            const oldBeat = getTurnStoryImages(oldTurn).find(
              (b) => b.position === pos,
            );
            if (oldBeat?.imageData && isMediaRef(oldBeat.imageData)) {
              revokeMediaKey(extractMediaKey(oldBeat.imageData));
            }
            if (pos === 'opening') {
              const legacyKey = buildTurnMediaKey('story', oldTurn, postIdx);
              revokeMediaKey(legacyKey);
              revokeMediaKey(`inline:${legacyKey}`);
              if (oldTurn.storyImageData && isMediaRef(oldTurn.storyImageData)) {
                revokeMediaKey(extractMediaKey(oldTurn.storyImageData));
              }
            }
          }

          mergeTurnBeatImages((byPos) => {
            byPos.set(pos, {
              id: `${targetTurnId}_${pos}`,
              position: pos,
              imageData: res.imageUrl,
              prompt: res.prompt,
              subject: res.subjectLabel,
              status: 'done',
              error: undefined,
              ...(res.appliedComparisonPatch
                ? { appliedComparisonPatch: res.appliedComparisonPatch }
                : {}),
            });
          });
          successCount += 1;
          if (res.appliedComparisonPatch) {
            appliedPatchCount += 1;
          }
          lastSubjectLabel = res.subjectLabel;
        }

        if (controller.signal.aborted) {
          return;
        }

        const finalIdx = stateRef.current.turns.findIndex(
          (t) => t.id === targetTurnId,
        );
        const pageLabel = finalIdx >= 0 ? finalIdx + 1 : turnIndex + 1;
        const patchSuffix =
          appliedPatchCount > 0
            ? ' (đã nạp chỉnh sửa từ kết quả đối chiếu vào prompt)'
            : '';

        if (successCount === 0) {
          showBanner(
            lastError ||
              'Không thể sinh ảnh minh họa. Kiểm tra lại cấu hình tạo ảnh.',
            'err',
          );
        } else if (positionsToRun.length === 1) {
          showBanner(
            `Đã sinh ảnh cho Trang ${pageLabel} (${lastSubjectLabel || STORY_IMAGE_POSITION_META[positionsToRun[0]].label})${patchSuffix}.`,
          );
        } else if (successCount < positionsToRun.length) {
          showBanner(
            `Đã sinh ${successCount}/${positionsToRun.length} khung ảnh cho Trang ${pageLabel}${patchSuffix}. Bạn có thể bấm Thử lại trên khung bị lỗi.`,
          );
        } else {
          showBanner(
            `Đã sinh trọn bộ ${successCount} khung ảnh (Đầu · Giữa · Cuối) cho Trang ${pageLabel}${patchSuffix}.`,
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const msg =
            err instanceof Error
              ? err.message
              : String(err || 'Lỗi không xác định');
          appendProxyLog(`[Ảnh truyện] Lỗi bất ngờ: ${msg}`);
          showBanner(`Lỗi sinh ảnh minh họa: ${msg}`, 'err');
        }
      } finally {
        // Clear any leftover pending/generating statuses on abort or error
        mergeTurnBeatImages((byPos) => {
          for (const [pos, item] of byPos.entries()) {
            if (item.status === 'pending' || item.status === 'generating') {
              if (item.imageData) {
                byPos.set(pos, { ...item, status: 'done', error: undefined });
              } else {
                byPos.delete(pos);
              }
            }
          }
        });
        if (imageAbortControllerRef.current === controller) {
          imageAbortControllerRef.current = null;
          setIsGeneratingImage(false);
          setGeneratingImageTurnIdx(null);
          setGeneratingImageTurnId(null);
          setGeneratingImageProgress(null);
        }
      }
    },
    [
      appendProxyLog,
      cacheAvatarVisualLock,
      showBanner,
      updateTurnsWithCompanionSync,
    ],
  );

  const handleClearTurnStoryImage = useCallback(
    (turnIndex: number, position?: StoryImagePosition) => {
      const targetTurn = stateRef.current.turns[turnIndex];
      if (targetTurn) {
        const existingBeats = getTurnStoryImages(targetTurn);
        if (position) {
          const beatKey = buildTurnMediaKey(
            'story',
            targetTurn,
            turnIndex,
            position,
          );
          revokeMediaKey(`inline:${beatKey}`);
          const targetBeat = existingBeats.find((b) => b.position === position);
          if (targetBeat?.imageData && isMediaRef(targetBeat.imageData)) {
            void deleteMediaBlob(extractMediaKey(targetBeat.imageData));
          } else {
            revokeMediaKey(beatKey);
          }
          if (position === 'opening' && targetTurn.storyImageData) {
            const legacyKey = buildTurnMediaKey('story', targetTurn, turnIndex);
            revokeMediaKey(`inline:${legacyKey}`);
            if (
              isMediaRef(targetTurn.storyImageData) &&
              targetTurn.storyImageData !== targetBeat?.imageData
            ) {
              void deleteMediaBlob(extractMediaKey(targetTurn.storyImageData));
            } else {
              revokeMediaKey(legacyKey);
            }
          }
        } else {
          for (const beat of existingBeats) {
            const beatKey = buildTurnMediaKey(
              'story',
              targetTurn,
              turnIndex,
              beat.position,
            );
            revokeMediaKey(`inline:${beatKey}`);
            if (beat.imageData && isMediaRef(beat.imageData)) {
              void deleteMediaBlob(extractMediaKey(beat.imageData));
            } else {
              revokeMediaKey(beatKey);
            }
          }
          const key = buildTurnMediaKey('story', targetTurn, turnIndex);
          revokeMediaKey(`inline:${key}`);
          if (targetTurn.storyImageData && isMediaRef(targetTurn.storyImageData)) {
            void deleteMediaBlob(extractMediaKey(targetTurn.storyImageData));
          } else {
            revokeMediaKey(key);
          }
        }
      }
      updateTurnsWithCompanionSync((turns) =>
        turns.map((t, i) => {
          if (i !== turnIndex) return t;
          if (!position) {
            return {
              ...t,
              storyImageData: undefined,
              storyImagePrompt: undefined,
              storyImageSubject: undefined,
              storyImages: undefined,
            };
          }
          const remaining = getTurnStoryImages(t).filter(
            (b) => b.position !== position,
          );
          const primary =
            remaining.find((b) => b.position === 'opening' && b.imageData) ||
            remaining.find((b) => Boolean(b.imageData));
          return {
            ...t,
            storyImages: remaining.length > 0 ? remaining : undefined,
            storyImageData: primary?.imageData,
            storyImagePrompt: primary?.prompt,
            storyImageSubject: primary?.subject,
          };
        }),
      );
    },
    [updateTurnsWithCompanionSync],
  );

  const clearBgPortraitTimer = useCallback(() => {
    if (bgPortraitClearTimerRef.current !== null) {
      window.clearTimeout(bgPortraitClearTimerRef.current);
      bgPortraitClearTimerRef.current = null;
    }
  }, []);

  const updatePortraitBankWithCompanionSync = useCallback(
    (updater: (prev: PortraitBankConfig) => PortraitBankConfig) => {
      setState((prev) => {
        const prevBank = prev.portraitBank || createDefaultPortraitBank();
        const nextBank = updater(prevBank);
        const compKey =
          activeStoryCompanionIdRef.current || prev.activeCompanionId || '';
        const nextCompPortraits = compKey
          ? { ...(prev.companionPortraits || {}), [compKey]: nextBank }
          : prev.companionPortraits || {};

        // 2-way sync: mirror manual portrait profile edits back into matching active Companion NPCs
        let nextCompanions = prev.companions;
        if (compKey && Array.isArray(prev.companions) && prev.companions.length) {
          const prevById = new Map(
            (prevBank.portraits || []).map((p) => [p.id, p]),
          );
          const changedPortraits: Array<{
            prevPortrait?: CharacterPortrait;
            nextPortrait: CharacterPortrait;
          }> = [];
          for (const np of nextBank.portraits || []) {
            if (np.isMc) continue;
            const op = prevById.get(np.id);
            if (!op) continue;
            const roleChanged = (op.role || '') !== (np.role || '');
            const profileChanged =
              (op.name || '') !== (np.name || '') ||
              roleChanged ||
              (op.age || '') !== (np.age || '') ||
              (op.birthday || '') !== (np.birthday || '') ||
              (op.fashionStyle || '') !== (np.fashionStyle || '') ||
              (op.appearance || '') !== (np.appearance || '') ||
              (op.personality || '') !== (np.personality || '') ||
              (op.relationships || '') !== (np.relationships || '') ||
              (op.signature || '') !== (np.signature || '');
            if (
              roleChanged ||
              (profileChanged && (np.profileManual || np.appearanceManual))
            ) {
              changedPortraits.push({ prevPortrait: op, nextPortrait: np });
            }
          }

          if (changedPortraits.length > 0) {
            let compTouched = false;
            nextCompanions = prev.companions.map((comp) => {
              if (comp.id !== compKey) return comp;
              let npcsTouched = false;
              const updatedNpcs = (comp.npcs || []).map((npc) => {
                const npcKey = normalizeCharacterKey(npc.name);
                const match = changedPortraits.find(({ prevPortrait, nextPortrait }) => {
                  if (nextPortrait.npcId && npc.id === nextPortrait.npcId) return true;
                  if (prevPortrait?.npcId && npc.id === prevPortrait.npcId) return true;
                  const oldKey = prevPortrait
                    ? normalizeCharacterKey(prevPortrait.name)
                    : '';
                  const newKey = normalizeCharacterKey(nextPortrait.name);
                  return (
                    (Boolean(oldKey) && npcKey === oldKey) ||
                    (Boolean(newKey) && npcKey === newKey)
                  );
                });
                if (!match) return npc;
                const p = match.nextPortrait;
                npcsTouched = true;
                const nextDesc = [
                  p.appearance?.trim(),
                  p.fashionStyle?.trim() ? `Style: ${p.fashionStyle.trim()}` : '',
                  p.personality?.trim(),
                  p.relationships?.trim(),
                  p.signature?.trim(),
                ]
                  .filter(Boolean)
                  .join(' · ')
                  .slice(0, 260);
                return {
                  ...npc,
                  name: p.name.trim() || npc.name,
                  role: p.role.trim() || npc.role,
                  age: p.age?.trim() || undefined,
                  birthday: p.birthday?.trim() || undefined,
                  fashionStyle: p.fashionStyle?.trim() || undefined,
                  appearance: p.appearance.trim() || undefined,
                  personality: p.personality?.trim() || undefined,
                  relationships: p.relationships?.trim() || undefined,
                  signature: p.signature?.trim() || undefined,
                  desc: nextDesc || npc.desc,
                  profileManual: Boolean(p.profileManual || p.appearanceManual),
                };
              });
              if (!npcsTouched) return comp;
              compTouched = true;
              return { ...comp, npcs: updatedNpcs };
            });
            if (!compTouched) {
              nextCompanions = prev.companions;
            }
          }
        }

        return {
          ...prev,
          companions: nextCompanions,
          portraitBank: nextBank,
          companionPortraits: nextCompPortraits,
        };
      });
    },
    [],
  );

  const collectCleanStoryExcerpt = useCallback(
    (workingState: ArkState, preferredTurnIndex?: number): string => {
      const turns = workingState.turns || [];
      if (!turns.length) return '';
      const center =
        typeof preferredTurnIndex === 'number' &&
        preferredTurnIndex >= 0 &&
        preferredTurnIndex < turns.length
          ? preferredTurnIndex
          : Math.min(workingState.currentPage, turns.length - 1);
      const indices = Array.from(
        new Set(
          [center, center - 1, center - 2].filter(
            (i) => i >= 0 && i < turns.length,
          ),
        ),
      );
      return indices
        .map((i) => stripStoryPlanningAndMeta(turns[i]?.assistant || ''))
        .filter(Boolean)
        .join('\n\n');
    },
    [],
  );

  const collectCleanUserExcerpt = useCallback(
    (workingState: ArkState, preferredTurnIndex?: number): string => {
      const turns = workingState.turns || [];
      if (!turns.length) return '';
      const center =
        typeof preferredTurnIndex === 'number' &&
        preferredTurnIndex >= 0 &&
        preferredTurnIndex < turns.length
          ? preferredTurnIndex
          : Math.min(workingState.currentPage, turns.length - 1);
      const indices = Array.from(
        new Set(
          [center, center - 1].filter((i) => i >= 0 && i < turns.length),
        ),
      );
      return indices
        .map((i) => stripStoryPlanningAndMeta(turns[i]?.user || ''))
        .filter(Boolean)
        .join('\n');
    },
    [],
  );

  const syncVividUpdatesToCompanionNpcs = useCallback(
    (
      updatesByNameKey: Map<
        string,
        {
          role?: string;
          age?: string;
          birthday?: string;
          fashionStyle?: string;
          personality?: string;
          appearance?: string;
          relationships?: string;
          signature?: string;
        }
      >,
      forceManual: boolean,
    ) => {
      if (!updatesByNameKey.size) return;
      setState((prev) => {
        const activeId = prev.activeCompanionId;
        if (!activeId) return prev;
        let touched = false;
        const nextCompanions = prev.companions.map((comp) => {
          if (comp.id !== activeId) return comp;
          const nextNpcs = (comp.npcs || []).map((npc) => {
            const key = normalizeCharacterKey(npc.name);
            const hit = updatesByNameKey.get(key);
            if (!hit) return npc;
            if (npc.profileManual && !forceManual) return npc;
            const nextRole =
              !npc.role || npc.role === 'NPC' || npc.role === 'Nhân vật đồng nhân' || npc.role === 'Đồng nhân'
                ? hit.role || npc.role
                : npc.role;
            const nextAge = forceManual
              ? hit.age || npc.age
              : npc.age?.trim() || hit.age || undefined;
            const nextBirthday = forceManual
              ? hit.birthday || npc.birthday
              : npc.birthday?.trim() || hit.birthday || undefined;
            const nextFashion = forceManual
              ? hit.fashionStyle || npc.fashionStyle
              : npc.fashionStyle?.trim() || hit.fashionStyle || undefined;
            const nextPersonality = forceManual
              ? hit.personality || npc.personality
              : npc.personality?.trim() || hit.personality || undefined;
            const nextAppearance = forceManual
              ? hit.appearance || npc.appearance
              : npc.appearance?.trim() || hit.appearance || undefined;
            const nextRelationships = forceManual
              ? hit.relationships || npc.relationships
              : npc.relationships?.trim() || hit.relationships || undefined;
            const nextSignature = forceManual
              ? hit.signature || npc.signature
              : npc.signature?.trim() || hit.signature || undefined;
            const nextDesc =
              npc.desc?.trim() ||
              [
                nextAppearance,
                nextFashion ? `Style: ${nextFashion}` : '',
                nextPersonality,
                nextRelationships,
                nextSignature,
              ]
                .filter(Boolean)
                .join(' · ')
                .slice(0, 260);
            touched = true;
            return {
              ...npc,
              role: nextRole,
              desc: nextDesc,
              ...(nextAge ? { age: nextAge } : {}),
              ...(nextBirthday ? { birthday: nextBirthday } : {}),
              ...(nextFashion ? { fashionStyle: nextFashion } : {}),
              ...(nextPersonality ? { personality: nextPersonality } : {}),
              ...(nextAppearance ? { appearance: nextAppearance } : {}),
              ...(nextRelationships ? { relationships: nextRelationships } : {}),
              ...(nextSignature ? { signature: nextSignature } : {}),
              ...(forceManual ? { profileManual: false } : {}),
            };
          });
          return { ...comp, npcs: nextNpcs };
        });
        return touched ? { ...prev, companions: nextCompanions } : prev;
      });
    },
    [],
  );

  const enrichPortraitsAppearances = useCallback(
    async (options?: {
      portraitIds?: string[];
      forceManual?: boolean;
      silent?: boolean;
      turnIndex?: number;
      stateOverride?: ArkState;
      signal?: AbortSignal;
      timeoutMs?: number;
    }) => {
      const workingState = options?.stateOverride || stateRef.current;
      const forceManual = Boolean(options?.forceManual);
      const silent = Boolean(options?.silent);
      const activeComp = getActiveCompanionFromState(workingState);
      const cleanStoryText = collectCleanStoryExcerpt(
        workingState,
        options?.turnIndex,
      );
      const cleanUserText = collectCleanUserExcerpt(
        workingState,
        options?.turnIndex,
      );

      const allPortraits = workingState.portraitBank?.portraits || [];
      const targetList = options?.portraitIds?.length
        ? allPortraits.filter(
            (p) =>
              options.portraitIds!.includes(p.id) &&
              (forceManual || !p.aiAutoEnrichLocked),
          )
        : allPortraits.filter(
            (p) =>
              !p.aiAutoEnrichLocked &&
              (forceManual || !p.appearanceManual || !p.profileManual),
          );

      if (!targetList.length) {
        if (!silent) {
          showBanner(
            'Không có nhân vật nào cần làm sinh động hồ sơ (các mục đã sửa thủ công hoặc đang tạm khóa AI được giữ nguyên).',
          );
        }
        return;
      }

      const targetIds = targetList.map((p) => p.id);
      if (!options?.portraitIds?.length) setIsEnrichingAppearances(true);
      setEnrichingAppearanceIds((prev) =>
        Array.from(new Set([...prev, ...targetIds])),
      );

      try {
      // Step 1: Instant local 3-tier resolution (a) Companion -> (b) Story visual cues -> (c) Built-in vivid celebrity profiles
      const localUpdates = new Map<
        string,
        {
          role?: string;
          age?: string;
          birthday?: string;
          fashionStyle?: string;
          personality?: string;
          appearance: string;
          relationships?: string;
          signature?: string;
          source: 'companion' | 'story' | 'celebrity' | 'combined' | 'none';
        }
      >();
      // Audit & migrate 'Ngữ cảnh xuất hiện' -> concise solo pose & expression per character
      const auditedSnippetMap = new Map<string, string | undefined>();
      let snippetAuditChangedCount = 0;
      for (const p of targetList) {
        const rawSnip = (p.contextSnippet || '').trim();
        let nextSnip: string | undefined;
        if (rawSnip && isSoloPoseExpressionSnippet(rawSnip)) {
          nextSnip = rawSnip;
        } else {
          const fromTurns = extractBestCharacterContextFromTurns(
            workingState.turns || [],
            p.name,
            options?.turnIndex ?? workingState.currentPage,
            undefined,
            180,
            {
              role: p.role,
              personality: p.personality,
              signature: p.signature,
              appearance: p.appearance,
              isMc: p.isMc,
            },
          );
          nextSnip =
            fromTurns ||
            sanitizeLegacyContextSnippetForPortrait(p, [p.role, p.signature]);
        }
        auditedSnippetMap.set(p.id, nextSnip);
        if ((rawSnip || undefined) !== nextSnip) {
          snippetAuditChangedCount += 1;
        }
      }

      for (const p of targetList) {
        if (p.aiAutoEnrichLocked && !forceManual) continue;
        const allowApp = forceManual || !p.appearanceManual;
        const allowVivid = forceManual || !p.profileManual;
        if (!allowApp && !allowVivid) continue;
        const auditedSnip = auditedSnippetMap.get(p.id) || '';
        const effectiveStoryText =
          auditedSnip && !cleanStoryText.includes(auditedSnip)
            ? `${auditedSnip}\n${cleanStoryText}`.trim()
            : cleanStoryText;
        const resolved = resolveLocalVividNpcProfile({
          name: p.name,
          isMc: p.isMc,
          comp: activeComp,
          cleanStoryText: effectiveStoryText,
          storyClock: workingState.memory?.storyClock,
        });
        if (
          resolved.appearance ||
          resolved.personality ||
          resolved.relationships ||
          resolved.signature ||
          resolved.role ||
          resolved.age ||
          resolved.birthday ||
          resolved.fashionStyle
        ) {
          localUpdates.set(p.id, {
            role: resolved.role || undefined,
            age: resolved.age || undefined,
            birthday: resolved.birthday || undefined,
            fashionStyle: resolved.fashionStyle || undefined,
            personality: resolved.personality || undefined,
            appearance: resolved.appearance,
            relationships: resolved.relationships || undefined,
            signature: resolved.signature || undefined,
            source: resolved.source,
          });
        }
      }

      if (localUpdates.size > 0 || snippetAuditChangedCount > 0) {
        const compSyncMap = new Map<
          string,
          {
            role?: string;
            age?: string;
            birthday?: string;
            fashionStyle?: string;
            personality?: string;
            appearance?: string;
            relationships?: string;
            signature?: string;
          }
        >();
        updatePortraitBankWithCompanionSync((prev) => ({
          ...prev,
          portraits: (prev.portraits || []).map((p) => {
            const hasAuditedSnippet = auditedSnippetMap.has(p.id);
            const auditedSnip = hasAuditedSnippet
              ? auditedSnippetMap.get(p.id)
              : p.contextSnippet;
            const u = localUpdates.get(p.id);
            if (!u) {
              if (hasAuditedSnippet && auditedSnip !== p.contextSnippet) {
                return {
                  ...p,
                  contextSnippet: auditedSnip,
                  updatedAt: Date.now(),
                };
              }
              return p;
            }
            if (p.aiAutoEnrichLocked && !forceManual) {
              if (hasAuditedSnippet && auditedSnip !== p.contextSnippet) {
                return {
                  ...p,
                  contextSnippet: auditedSnip,
                };
              }
              return p;
            }
            const allowApp = forceManual || !p.appearanceManual;
            const allowVivid = forceManual || !p.profileManual;
            const nextAge = allowVivid
              ? forceManual
                ? u.age || p.age
                : p.age?.trim() || u.age
              : p.age;
            const nextBirthday = allowVivid
              ? forceManual
                ? u.birthday || p.birthday
                : p.birthday?.trim() || u.birthday
              : p.birthday;
            const nextFashion = allowVivid
              ? forceManual
                ? u.fashionStyle || p.fashionStyle
                : p.fashionStyle?.trim() || u.fashionStyle
              : p.fashionStyle;
            const nextAppearance = allowApp
              ? forceManual
                ? u.appearance || p.appearance
                : p.appearance?.trim()
                  ? u.source === 'story' || u.source === 'combined'
                    ? u.appearance
                    : p.appearance
                  : u.appearance || p.appearance
              : p.appearance;
            const nextPersonality = allowVivid
              ? forceManual
                ? u.personality || p.personality
                : p.personality?.trim() || u.personality
              : p.personality;
            const nextRelationships = allowVivid
              ? forceManual
                ? u.relationships || p.relationships
                : p.relationships?.trim() || u.relationships
              : p.relationships;
            const nextSignature = allowVivid
              ? forceManual
                ? u.signature || p.signature
                : p.signature?.trim() || u.signature
              : p.signature;
            if (!p.isMc) {
              compSyncMap.set(normalizeCharacterKey(p.name), {
                role: u.role,
                age: nextAge,
                birthday: nextBirthday,
                fashionStyle: nextFashion,
                personality: nextPersonality,
                appearance: nextAppearance,
                relationships: nextRelationships,
                signature: nextSignature,
              });
            }
            return {
              ...p,
              role: p.role || u.role || p.role,
              ...(nextAge ? { age: nextAge } : {}),
              ...(nextBirthday ? { birthday: nextBirthday } : {}),
              ...(nextFashion ? { fashionStyle: nextFashion } : {}),
              appearance: nextAppearance,
              ...(nextPersonality ? { personality: nextPersonality } : {}),
              ...(nextRelationships ? { relationships: nextRelationships } : {}),
              ...(nextSignature ? { signature: nextSignature } : {}),
              contextSnippet: auditedSnip,
              appearanceManual: forceManual ? false : p.appearanceManual,
              profileManual: forceManual ? false : p.profileManual,
              updatedAt: Date.now(),
            };
          }),
        }));
        if (compSyncMap.size > 0) {
          syncVividUpdatesToCompanionNpcs(compSyncMap, forceManual);
        }
      }

      // Step 2: AI Proxy enrichment (synthesizes all 8 vivid fields grounded in actual story + celebrity/character knowledge + story clock, never forcing MC when absent)
      const hasProxy = Boolean((workingState.config?.proxyUrl || '').trim());
      let aiUpdatedCount = 0;

      if (hasProxy) {
        const aiTargets = targetList
          .filter((p) => {
            if (p.aiAutoEnrichLocked && !forceManual) return false;
            const allowApp = forceManual || !p.appearanceManual;
            const allowVivid = forceManual || !p.profileManual;
            if (!allowApp && !allowVivid) return false;
            if (forceManual) return true;
            const missingAnyField =
              !p.age?.trim() ||
              !p.birthday?.trim() ||
              !p.fashionStyle?.trim() ||
              !p.appearance?.trim() ||
              !p.personality?.trim() ||
              !p.relationships?.trim() ||
              !p.signature?.trim();
            return (
              missingAnyField ||
              Boolean(cleanStoryText) ||
              Boolean(auditedSnippetMap.get(p.id))
            );
          })
          .map((p) => {
            const loc = localUpdates.get(p.id);
            return {
              id: p.id,
              name: p.name,
              isMc: p.isMc,
              role: p.role,
              currentAge: loc?.age || p.age || '',
              currentBirthday: loc?.birthday || p.birthday || '',
              currentFashionStyle: loc?.fashionStyle || p.fashionStyle || '',
              currentAppearance: loc?.appearance || p.appearance || '',
              currentPersonality: loc?.personality || p.personality || '',
              currentRelationships: loc?.relationships || p.relationships || '',
              currentSignature: loc?.signature || p.signature || '',
              sceneContext: auditedSnippetMap.get(p.id) || '',
            };
          });

        if (aiTargets.length > 0 && !options?.signal?.aborted) {
          const aiRes = await enrichVividNpcProfilesWithAi({
            state: workingState,
            targets: aiTargets,
            cleanStoryText,
            cleanUserText,
            signal: options?.signal,
            timeoutMs: options?.timeoutMs,
            onLog: appendProxyLog,
          });

          if (aiRes.ok && Object.keys(aiRes.results).length > 0) {
            const targetIdSet = new Set(aiTargets.map((t) => t.id));
            const compSyncMap = new Map<
              string,
              {
                role?: string;
                age?: string;
                birthday?: string;
                fashionStyle?: string;
                personality?: string;
                appearance?: string;
                relationships?: string;
                signature?: string;
              }
            >();

            updatePortraitBankWithCompanionSync((prev) => ({
              ...prev,
              portraits: (prev.portraits || []).map((p) => {
                if (!targetIdSet.has(p.id)) return p;
                if (p.aiAutoEnrichLocked && !forceManual) return p;
                const allowApp = forceManual || !p.appearanceManual;
                const allowVivid = forceManual || !p.profileManual;
                if (!allowApp && !allowVivid) return p;
                const hit = aiRes.results[normalizeCharacterKey(p.name)];
                if (!hit) return p;
                aiUpdatedCount += 1;
                const nextRole =
                  p.role &&
                  p.role !== 'NPC' &&
                  p.role !== 'NPC trong truyện' &&
                  p.role !== 'NPC đồng nhân'
                    ? p.role
                    : hit.role || p.role;
                const nextAge = allowVivid
                  ? hit.age || p.age
                  : p.age;
                const nextBirthday = allowVivid
                  ? hit.birthday || p.birthday
                  : p.birthday;
                const nextFashion = allowVivid
                  ? hit.fashionStyle || p.fashionStyle
                  : p.fashionStyle;
                const nextAppearance = allowApp
                  ? hit.appearance || p.appearance
                  : p.appearance;
                const nextPersonality = allowVivid
                  ? hit.personality || p.personality
                  : p.personality;
                const nextRelationships = allowVivid
                  ? hit.relationships || p.relationships
                  : p.relationships;
                const nextSignature = allowVivid
                  ? hit.signature || p.signature
                  : p.signature;
                if (!p.isMc) {
                  compSyncMap.set(normalizeCharacterKey(p.name), {
                    role: nextRole,
                    age: nextAge,
                    birthday: nextBirthday,
                    fashionStyle: nextFashion,
                    personality: nextPersonality,
                    appearance: nextAppearance,
                    relationships: nextRelationships,
                    signature: nextSignature,
                  });
                }
                const nextPoseSnippet = allowVivid
                  ? hit.poseExpression ||
                    sanitizeLegacyContextSnippetForPortrait(
                      {
                        ...p,
                        role: nextRole,
                        personality: nextPersonality,
                        appearance: nextAppearance,
                        signature: nextSignature,
                      },
                      [nextRole, nextSignature],
                    )
                  : p.contextSnippet;
                return {
                  ...p,
                  role: nextRole,
                  ...(nextAge ? { age: nextAge } : {}),
                  ...(nextBirthday ? { birthday: nextBirthday } : {}),
                  ...(nextFashion ? { fashionStyle: nextFashion } : {}),
                  appearance: nextAppearance,
                  ...(nextPersonality ? { personality: nextPersonality } : {}),
                  ...(nextRelationships
                    ? { relationships: nextRelationships }
                    : {}),
                  ...(nextSignature ? { signature: nextSignature } : {}),
                  contextSnippet: nextPoseSnippet || undefined,
                  appearanceManual: forceManual ? false : p.appearanceManual,
                  profileManual: forceManual ? false : p.profileManual,
                  updatedAt: Date.now(),
                };
              }),
            }));
            syncVividUpdatesToCompanionNpcs(compSyncMap, forceManual);
          }
        }
      }

      if (!silent) {
        const totalUpdated = Math.max(aiUpdatedCount, localUpdates.size);
        if (totalUpdated > 0) {
          showBanner(
            `Đã làm sinh động hồ sơ cho ${totalUpdated} nhân vật (giữ nguyên các phần bạn đã chỉnh thủ công).`,
          );
        } else if (!hasProxy) {
          showBanner(
            'Đã kiểm tra hồ sơ cục bộ. Cấu hình Proxy API để AI làm sinh động đầy đủ tuổi tác, style ăn mặc, tính cách và ngoại hình.',
          );
        } else {
          showBanner('Đã kiểm tra và cập nhật hồ sơ nhân vật.');
        }
      }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
        appendProxyLog(`[Hồ sơ NV] Lỗi làm sinh động hồ sơ: ${msg}`);
        if (!silent) {
          showBanner(`Lỗi làm sinh động hồ sơ nhân vật: ${msg}`, 'err');
        }
      } finally {
        if (!options?.portraitIds?.length) setIsEnrichingAppearances(false);
        setEnrichingAppearanceIds((prev) =>
          prev.filter((id) => !targetIds.includes(id)),
        );
      }
    },
    [
      appendProxyLog,
      collectCleanStoryExcerpt,
      collectCleanUserExcerpt,
      showBanner,
      syncVividUpdatesToCompanionNpcs,
      updatePortraitBankWithCompanionSync,
    ],
  );

  const enrichCompanionNpcs = useCallback(
    async (options?: { npcIds?: string[]; forceManual?: boolean }) => {
      const workingState = stateRef.current;
      const forceManual = Boolean(options?.forceManual);
      const activeComp = getActiveCompanionFromState(workingState);
      const allNpcs = activeComp?.npcs || [];
      if (!allNpcs.length) {
        showBanner('Chưa có NPC đồng nhân nào để làm sinh động.', 'err');
        return;
      }

      const targetList = options?.npcIds?.length
        ? allNpcs.filter((n) => options.npcIds!.includes(n.id))
        : allNpcs.filter(
            (n) =>
              forceManual ||
              !n.profileManual ||
              !n.age?.trim() ||
              !n.birthday?.trim() ||
              !n.fashionStyle?.trim() ||
              !n.personality?.trim() ||
              !n.appearance?.trim(),
          );

      if (!targetList.length) {
        showBanner(
          'Tất cả NPC đã có hồ sơ thủ công hoàn chỉnh. Bấm "Làm sinh động" trên từng NPC nếu muốn làm mới.',
        );
        return;
      }

      const targetIds = targetList.map((n) => n.id);
      if (!options?.npcIds?.length) setIsEnrichingAllNpcs(true);
      setEnrichingNpcIds((prev) => Array.from(new Set([...prev, ...targetIds])));

      try {
      const cleanStoryText = collectCleanStoryExcerpt(workingState);
      const cleanUserText = collectCleanUserExcerpt(workingState);

      // Step 1: Instant local vivid profile resolution
      const localMap = new Map<
        string,
        {
          role?: string;
          age?: string;
          birthday?: string;
          fashionStyle?: string;
          personality?: string;
          appearance?: string;
          relationships?: string;
          signature?: string;
        }
      >();
      for (const npc of targetList) {
        const resolved = resolveLocalVividNpcProfile({
          name: npc.name,
          isMc: false,
          comp: activeComp,
          cleanStoryText,
          storyClock: workingState.memory?.storyClock,
        });
        if (
          resolved.appearance ||
          resolved.personality ||
          resolved.relationships ||
          resolved.signature ||
          resolved.age ||
          resolved.birthday ||
          resolved.fashionStyle
        ) {
          localMap.set(normalizeCharacterKey(npc.name), {
            role: resolved.role || undefined,
            age: resolved.age || undefined,
            birthday: resolved.birthday || undefined,
            fashionStyle: resolved.fashionStyle || undefined,
            personality: resolved.personality || undefined,
            appearance: resolved.appearance || undefined,
            relationships: resolved.relationships || undefined,
            signature: resolved.signature || undefined,
          });
        }
      }
      if (localMap.size > 0) {
        syncVividUpdatesToCompanionNpcs(localMap, forceManual);
        updatePortraitBankWithCompanionSync((prev) => ({
          ...prev,
          portraits: (prev.portraits || []).map((p) => {
            if (p.isMc) return p;
            if (p.aiAutoEnrichLocked && !forceManual) return p;
            const hit = localMap.get(normalizeCharacterKey(p.name));
            if (!hit) return p;
            const allowApp = forceManual || !p.appearanceManual;
            const allowVivid = forceManual || !p.profileManual;
            return {
              ...p,
              role: p.role || hit.role || p.role,
              ...(allowVivid && (forceManual ? hit.age : !p.age?.trim() && hit.age)
                ? { age: hit.age }
                : {}),
              ...(allowVivid &&
              (forceManual ? hit.birthday : !p.birthday?.trim() && hit.birthday)
                ? { birthday: hit.birthday }
                : {}),
              ...(allowVivid &&
              (forceManual
                ? hit.fashionStyle
                : !p.fashionStyle?.trim() && hit.fashionStyle)
                ? { fashionStyle: hit.fashionStyle }
                : {}),
              appearance: allowApp
                ? forceManual
                  ? hit.appearance || p.appearance
                  : p.appearance || hit.appearance || ''
                : p.appearance,
              ...(allowVivid && hit.personality && (forceManual || !p.personality?.trim())
                ? { personality: hit.personality }
                : {}),
              ...(allowVivid && hit.relationships && (forceManual || !p.relationships?.trim())
                ? { relationships: hit.relationships }
                : {}),
              ...(allowVivid && hit.signature && (forceManual || !p.signature?.trim())
                ? { signature: hit.signature }
                : {}),
              updatedAt: Date.now(),
            };
          }),
        }));
      }

      // Step 2: AI enrichment via Proxy API
      const hasProxy = Boolean((workingState.config?.proxyUrl || '').trim());
      let aiUpdatedCount = 0;

      if (hasProxy) {
        const aiTargets = targetList.map((npc) => {
          const loc = localMap.get(normalizeCharacterKey(npc.name));
          return {
            id: npc.id,
            name: npc.name,
            isMc: false,
            role: npc.role || 'NPC',
            currentAge: npc.age || loc?.age || '',
            currentBirthday: npc.birthday || loc?.birthday || '',
            currentFashionStyle: npc.fashionStyle || loc?.fashionStyle || '',
            currentAppearance:
              npc.appearance || loc?.appearance || npc.desc || '',
            currentPersonality: npc.personality || loc?.personality || '',
            currentRelationships: npc.relationships || loc?.relationships || '',
            currentSignature: npc.signature || loc?.signature || '',
          };
        });

        const aiRes = await enrichVividNpcProfilesWithAi({
          state: workingState,
          targets: aiTargets,
          cleanStoryText,
          cleanUserText,
          onLog: appendProxyLog,
        });

        if (aiRes.ok && Object.keys(aiRes.results).length > 0) {
          const aiMap = new Map<
            string,
            {
              role?: string;
              age?: string;
              birthday?: string;
              fashionStyle?: string;
              personality?: string;
              appearance?: string;
              relationships?: string;
              signature?: string;
            }
          >();
          for (const [k, v] of Object.entries(aiRes.results)) {
            aiMap.set(k, v);
          }
          aiUpdatedCount = aiMap.size;
          syncVividUpdatesToCompanionNpcs(aiMap, forceManual);

          // Mirror vivid updates straight into Portrait Bank too (respecting manual edits unless forced)
          updatePortraitBankWithCompanionSync((prev) => ({
            ...prev,
            portraits: (prev.portraits || []).map((p) => {
              if (p.isMc) return p;
              if (p.aiAutoEnrichLocked && !forceManual) return p;
              const hit = aiMap.get(normalizeCharacterKey(p.name));
              if (!hit) return p;
              const allowApp = forceManual || !p.appearanceManual;
              const allowVivid = forceManual || !p.profileManual;
              return {
                ...p,
                role: p.role || hit.role || p.role,
                ...(allowVivid && hit.age ? { age: hit.age } : {}),
                ...(allowVivid && hit.birthday
                  ? { birthday: hit.birthday }
                  : {}),
                ...(allowVivid && hit.fashionStyle
                  ? { fashionStyle: hit.fashionStyle }
                  : {}),
                appearance: allowApp
                  ? hit.appearance || p.appearance
                  : p.appearance,
                ...(allowVivid && hit.personality
                  ? { personality: hit.personality }
                  : {}),
                ...(allowVivid && hit.relationships
                  ? { relationships: hit.relationships }
                  : {}),
                ...(allowVivid && hit.signature
                  ? { signature: hit.signature }
                  : {}),
                updatedAt: Date.now(),
              };
            }),
          }));
        }
      }

      const totalUpdated = Math.max(aiUpdatedCount, localMap.size);
      if (totalUpdated > 0) {
        showBanner(
          `Đã làm sinh động hồ sơ cho ${totalUpdated} NPC (đồng bộ cùng Thư viện Ảnh Nhân vật).`,
        );
      } else if (!hasProxy) {
        showBanner(
          'Chưa cấu hình Proxy API. Hãy cấu hình Proxy để AI tự làm sinh động hồ sơ NPC.',
          'err',
        );
      } else {
        showBanner('Đã kiểm tra hồ sơ NPC hiện tại.');
      }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
        appendProxyLog(`[Hồ sơ NPC] Lỗi làm sinh động NPC: ${msg}`);
        showBanner(`Lỗi làm sinh động hồ sơ NPC: ${msg}`, 'err');
      } finally {
        if (!options?.npcIds?.length) setIsEnrichingAllNpcs(false);
        setEnrichingNpcIds((prev) =>
          prev.filter((id) => !targetIds.includes(id)),
        );
      }
    },
    [
      appendProxyLog,
      collectCleanStoryExcerpt,
      collectCleanUserExcerpt,
      showBanner,
      syncVividUpdatesToCompanionNpcs,
      updatePortraitBankWithCompanionSync,
    ],
  );

  const handleCleanJunkPortraits = useCallback(() => {
    const curState = stateRef.current;
    const activeComp = getActiveCompanionFromState(curState);
    const cultivationBlockedKeys = buildCultivationNonNpcKeys(
      curState.memory?.cultivation,
    );
    const { bank: cleanedBank, removedNames: removedPortraitNames } =
      cleanJunkPortraitsFromBank(
        curState.portraitBank || createDefaultPortraitBank(),
        activeComp,
        curState.player?.name,
        cultivationBlockedKeys,
      );
    const { states: cleanedStates, removedNames: removedStateNames } =
      cleanAndDeduplicateCharacterStates(
        curState.memory?.characterStates || [],
        {
          comp: activeComp,
          fallbackMcName: curState.player?.name,
          knownValidNames: cleanedBank.portraits
            .filter((p) => !isPortraitAutoScannedUnconfirmed(p))
            .map((p) => p.name),
          extraBlockedKeys: cultivationBlockedKeys,
        },
      );

    // Also purge lyric/exclamation/teasing/non-person junk & duplicate variants from active Companion's NPC list
    const removedCompNpcNames: string[] = [];
    if (activeComp && Array.isArray(activeComp.npcs) && activeComp.npcs.length) {
      const cleanedCompNpcs = cleanJunkCompanionNpcs(activeComp.npcs).filter(
        (n) =>
          !isInvalidNpcPortrait(
            {
              name: n.name,
              role: n.role || '',
              appearance: n.appearance || n.desc || '',
              personality: n.personality,
              isMc: false,
            },
            undefined,
            cultivationBlockedKeys,
          ),
      );
      const keptIds = new Set(cleanedCompNpcs.map((n) => n.id));
      for (const n of activeComp.npcs) {
        if (!keptIds.has(n.id)) {
          removedCompNpcNames.push(n.name);
        }
      }
      if (removedCompNpcNames.length > 0) {
        setState((prev) => ({
          ...prev,
          companions: (prev.companions || []).map((c) =>
            c.id === activeComp.id ? { ...c, npcs: cleanedCompNpcs } : c,
          ),
        }));
      }
    }

    const prevPortraitMap = new Map(
      (curState.portraitBank?.portraits || []).map((p) => [
        p.id,
        (p.contextSnippet || '').trim(),
      ]),
    );
    let snippetMigratedCount = 0;
    for (const p of cleanedBank.portraits) {
      const prevSnip = prevPortraitMap.get(p.id) || '';
      const nextSnip = (p.contextSnippet || '').trim();
      if (prevSnip !== nextSnip) {
        snippetMigratedCount += 1;
      }
    }
    if (removedPortraitNames.length > 0 || snippetMigratedCount > 0) {
      updatePortraitBankWithCompanionSync(() => cleanedBank);
    }
    if (removedStateNames.length > 0) {
      updateMemoryWithCompanionSync((prev) => ({
        ...prev,
        characterStates: cleanedStates,
      }));
    }
    const allRemoved = Array.from(
      new Set([
        ...removedPortraitNames,
        ...removedStateNames,
        ...removedCompNpcNames,
      ]),
    );
    if (allRemoved.length > 0) {
      const preview = allRemoved.slice(0, 4).join(', ');
      showBanner(
        `Đã lọc bỏ & gộp trùng ${allRemoved.length} mục NPC rác (${preview}${
          allRemoved.length > 4 ? '...' : ''
        })${
          snippetMigratedCount > 0
            ? ` và chuẩn hóa dáng/biểu cảm cho ${snippetMigratedCount} hồ sơ`
            : ''
        }, giữ nguyên ${cleanedBank.portraits.length} nhân vật hợp lệ.`,
      );
    } else if (snippetMigratedCount > 0) {
      showBanner(
        `Đã chuẩn hóa lại dáng người & biểu cảm riêng lẻ cho ${snippetMigratedCount} hồ sơ nhân vật.`,
      );
    } else {
      showBanner(
        'Danh sách NPC & dáng/biểu cảm nhân vật đã sạch, không phát hiện mục rác hay lyric/câu thoại ngắn.',
      );
    }
  }, [
    showBanner,
    updateMemoryWithCompanionSync,
    updatePortraitBankWithCompanionSync,
  ]);

  const isSyncingTurnCharactersRef = useRef(false);

  const handleSyncPortraitsFromCompanion = useCallback(() => {
    if (isSyncingTurnCharactersRef.current) {
      showBanner('Đang đồng bộ nhân vật lượt này, vui lòng chờ giây lát...');
      return;
    }

    const curState = stateRef.current;
    const activeComp = getActiveCompanionFromState(curState);
    const turns = curState.turns || [];
    const safePage =
      turns.length > 0
        ? Math.min(Math.max(0, curState.currentPage), turns.length - 1)
        : -1;
    const currentTurn = safePage >= 0 ? turns[safePage] : undefined;
    const prevBank = curState.portraitBank || createDefaultPortraitBank();
    const prevCount = (prevBank.portraits || []).length;

    // 1. Clean junk names & sync roster from active Companion / player profile
    const cultivationBlockedKeys = buildCultivationNonNpcKeys(
      curState.memory?.cultivation,
    );
    const { bank: cleanedPrevBank, removedNames } = cleanJunkPortraitsFromBank(
      prevBank,
      activeComp,
      curState.player?.name,
      cultivationBlockedKeys,
    );
    const syncedFromCompBank = syncPortraitBankWithCompanion(
      cleanedPrevBank,
      activeComp,
      curState.player?.name,
      curState.memory?.storyClock,
    );
    const addedFromCompCount = Math.max(
      0,
      (syncedFromCompBank.portraits || []).length -
        (cleanedPrevBank.portraits || []).length,
    );

    // 2. Scan the CURRENT STORY TURN for appearing NPCs, updated posture/context & turn presence
    const mergedPortraits: CharacterPortrait[] = [
      ...(syncedFromCompBank.portraits || []),
    ];
    const detectedNames: string[] = [];
    const detectedPortraitIds: string[] = [];
    let addedFromTurnCount = 0;
    let updatedFromTurnCount = 0;

    if (
      currentTurn &&
      ((currentTurn.assistant || '').trim() || (currentTurn.user || '').trim())
    ) {
      const allowedKnownKeys = buildAllowedRosterKeys(
        activeComp,
        curState.player?.name,
      );
      const scanState: ArkState = {
        ...curState,
        portraitBank: syncedFromCompBank,
      };
      const cleanTurnProse = stripNonSceneChatBlocks(
        stripStoryPlanningAndMeta(
          currentTurn.assistant || currentTurn.user || '',
        ),
      );
      const rawDetected = detectCharactersInTurnForPortraits(
        currentTurn,
        scanState,
        { strictNewNpcGate: true },
      );

      const seenCandKeys = new Set<string>();
      const nowTs = Date.now();
      const MAX_NEW_TURN_NPCS = 3;

      for (let i = 0; i < rawDetected.length; i++) {
        const cand = rawDetected[i];
        const cleanName = cand.isMc
          ? String(cand.name || '').trim()
          : sanitizeCharacterName(
              cand.name,
              allowedKnownKeys,
              cultivationBlockedKeys,
            ) || '';
        if (!cleanName) continue;
        const candKey = normalizeCharacterKey(cleanName);
        if (!candKey || seenCandKeys.has(candKey)) continue;
        seenCandKeys.add(candKey);

        const rawSnippet = String(
          stripStoryPlanningAndMeta(cand.contextSnippet || '') ?? '',
        )
          .replace(/\s+/g, ' ')
          .trim();
        const soloFromCand =
          rawSnippet && isSoloPoseExpressionSnippet(rawSnippet)
            ? rawSnippet
            : '';
        const contextSnippet = (
          soloFromCand ||
          extractCharacterContextSnippet(
            cleanTurnProse,
            cleanName,
            cand.name,
            180,
            {
              role: cand.role,
              personality: cand.personality,
              signature: cand.signature,
              appearance: cand.appearance,
              isMc: cand.isMc,
              allowProfileFallback: true,
            },
          )
        ).slice(0, 180);

        const aliasMatched = !cand.isMc
          ? matchPortraitByName(
              cleanName,
              mergedPortraits.filter((p) => !p.isMc),
            )
          : undefined;
        const existingIdx = mergedPortraits.findIndex(
          (p) =>
            (cand.npcId && p.npcId === cand.npcId) ||
            normalizeCharacterKey(p.name) === candKey ||
            (aliasMatched && p.id === aliasMatched.id) ||
            (cand.isMc && p.isMc),
        );

        if (existingIdx >= 0) {
          const cur = mergedPortraits[existingIdx];
          const isLocked = Boolean(cur.aiAutoEnrichLocked);
          const cleanPrevSnip =
            cur.contextSnippet && isSoloPoseExpressionSnippet(cur.contextSnippet)
              ? cur.contextSnippet.slice(0, 180)
              : '';
          const nextSnippet = contextSnippet || cleanPrevSnip || undefined;
          const updatedEntry: CharacterPortrait = {
            ...cur,
            role: isLocked ? cur.role : cur.role || cand.role,
            appearance:
              cur.appearanceManual || isLocked
                ? cur.appearance
                : cur.appearance || cand.appearance,
            ...(cur.profileManual || isLocked
              ? {}
              : {
                  age: cur.age || cand.age || undefined,
                  birthday: cur.birthday || cand.birthday || undefined,
                  fashionStyle:
                    cur.fashionStyle || cand.fashionStyle || undefined,
                  personality: cur.personality || cand.personality || undefined,
                  relationships:
                    cur.relationships || cand.relationships || undefined,
                  signature: cur.signature || cand.signature || undefined,
                }),
            contextSnippet: nextSnippet,
            npcId: cur.npcId || cand.npcId,
            lastSeenTurnIndex: safePage,
            updatedAt: nowTs + i,
          };
          mergedPortraits[existingIdx] = updatedEntry;
          updatedFromTurnCount += 1;
          detectedNames.push(updatedEntry.name);
          detectedPortraitIds.push(updatedEntry.id);
        } else {
          if (addedFromTurnCount >= MAX_NEW_TURN_NPCS) {
            continue;
          }
          const newEntry: CharacterPortrait = {
            id: `port_turn_${nowTs}_${i}_${Math.random().toString(36).slice(2, 5)}`,
            name: cleanName,
            isMc: cand.isMc,
            role: cand.role,
            ...(cand.age ? { age: cand.age } : {}),
            ...(cand.birthday ? { birthday: cand.birthday } : {}),
            ...(cand.fashionStyle ? { fashionStyle: cand.fashionStyle } : {}),
            appearance: cand.appearance,
            ...(cand.personality ? { personality: cand.personality } : {}),
            ...(cand.relationships
              ? { relationships: cand.relationships }
              : {}),
            ...(cand.signature ? { signature: cand.signature } : {}),
            ...(contextSnippet ? { contextSnippet } : {}),
            appearanceManual: false,
            profileManual: false,
            npcId: cand.npcId,
            lastSeenTurnIndex: safePage,
            updatedAt: nowTs + i,
          };
          mergedPortraits.push(newEntry);
          addedFromTurnCount += 1;
          detectedNames.push(newEntry.name);
          detectedPortraitIds.push(newEntry.id);
        }
      }
    }

    // 3. Final junk safeguard & persist Portrait Bank (2-way synced with Companion)
    const { bank: finalBank } = cleanJunkPortraitsFromBank(
      {
        ...syncedFromCompBank,
        portraits: mergedPortraits,
      },
      activeComp,
      curState.player?.name,
      cultivationBlockedKeys,
    );

    updatePortraitBankWithCompanionSync(() => finalBank);

    // 4. Reflect turn presence into Character States ONLY for verified roster characters
    // (MC, Companion NPCs, already-tracked valid states, or pinned/manual/locked portraits).
    // Newly auto-scanned Portrait Bank items stay isolated in Portrait Bank and NEVER inject into story state!
    if (safePage >= 0) {
      const nowStateTs = Date.now();
      const verifiedDetectedByKey = new Map(
        finalBank.portraits
          .filter(
            (p) =>
              detectedPortraitIds.includes(p.id) &&
              !isPortraitAutoScannedUnconfirmed(p),
          )
          .map((p) => [normalizeCharacterKey(p.name), p]),
      );
      const knownValidNames = Array.from(
        new Set(
          [
            curState.player?.name || '',
            activeComp?.mc?.name || '',
            ...(activeComp?.npcs || []).map((n) => n.name),
            ...finalBank.portraits
              .filter((p) => !isPortraitAutoScannedUnconfirmed(p))
              .map((p) => p.name),
          ].filter(Boolean),
        ),
      );
      updateMemoryWithCompanionSync((prev) => {
        const nextStates = [...(prev.characterStates || [])];
        let idxOffset = 0;
        for (const [key, portrait] of verifiedDetectedByKey.entries()) {
          const existingIdx = nextStates.findIndex(
            (s) =>
              normalizeCharacterKey(s.name) === key ||
              (portrait.isMc && s.isMc),
          );
          if (existingIdx >= 0) {
            nextStates[existingIdx] = {
              ...nextStates[existingIdx],
              lastTurnIndex: safePage,
              updatedAt: nowStateTs + idxOffset,
            };
          } else {
            nextStates.push({
              id: `st_turn_${nowStateTs}_${idxOffset}_${Math.random().toString(36).slice(2, 5)}`,
              name: portrait.name,
              isMc: Boolean(portrait.isMc),
              location: '',
              mood: '',
              status: portrait.contextSnippet || 'Đang xuất hiện trong cảnh',
              lastTurnIndex: safePage,
              updatedAt: nowStateTs + idxOffset,
            });
          }
          idxOffset += 1;
        }
        const cleaned = cleanAndDeduplicateCharacterStates(nextStates, {
          comp: activeComp,
          fallbackMcName: curState.player?.name,
          knownValidNames,
        }).states;
        return {
          ...prev,
          characterStates: cleaned,
        };
      });
    }

    // Build clear, specific status message for immediate feedback
    const pageLabel = safePage >= 0 ? `Trang ${safePage + 1}` : '';
    const uniqueDetected = Array.from(new Set(detectedNames));
    const namesPreview = uniqueDetected.slice(0, 4).join(', ');
    const summaryParts: string[] = [];
    if (uniqueDetected.length > 0) {
      summaryParts.push(
        `nhận diện ${uniqueDetected.length} nhân vật (${namesPreview}${
          uniqueDetected.length > 4 ? '...' : ''
        })`,
      );
    }
    if (addedFromTurnCount > 0) {
      summaryParts.push(`thêm ${addedFromTurnCount} NPC mới từ lượt`);
    }
    if (addedFromCompCount > 0) {
      summaryParts.push(`kéo ${addedFromCompCount} hồ sơ Đồng nhân`);
    }
    if (updatedFromTurnCount > 0) {
      summaryParts.push(`cập nhật ${updatedFromTurnCount} hồ sơ`);
    }
    if (removedNames.length > 0) {
      summaryParts.push(`lọc ${removedNames.length} tên rác`);
    }

    const hasProxyConfigured = Boolean((curState.config?.proxyUrl || '').trim());
    const hasTurnProse = Boolean(
      currentTurn &&
        ((currentTurn.assistant || '').trim() ||
          (currentTurn.user || '').trim()),
    );

    if (!hasTurnProse) {
      showBanner(
        summaryParts.length > 0
          ? `Đã đồng bộ hồ sơ (${summaryParts.join(' · ')}) — chưa có lượt truyện để quét diễn biến.`
          : `Danh sách ${finalBank.portraits.length || prevCount} nhân vật đã đồng bộ sẵn với Đồng nhân (chưa có lượt truyện để quét).`,
      );
      window.setTimeout(() => {
        void enrichPortraitsAppearances({ silent: true });
      }, 60);
      return;
    }

    if (!hasProxyConfigured) {
      showBanner(
        summaryParts.length > 0
          ? `Đã đồng bộ ${pageLabel}: ${summaryParts.join(' · ')}. (Chưa cấu hình Proxy API nên chỉ cập nhật cục bộ.)`
          : `Đã quét ${pageLabel} (${finalBank.portraits.length} nhân vật hiện có). Chưa cấu hình Proxy API để AI phân tích trạng thái sâu.`,
      );
      window.setTimeout(() => {
        void enrichPortraitsAppearances({
          silent: true,
          turnIndex: safePage,
          portraitIds:
            detectedPortraitIds.length > 0 ? detectedPortraitIds : undefined,
        });
      }, 60);
      return;
    }

    // 5. Run turn-aware AI sync (Character States + Relationship/Profile Enrichment) with clear completion feedback
    showBanner(
      summaryParts.length > 0
        ? `Đã quét ${pageLabel}: ${summaryParts.join(' · ')}. Đang đồng bộ trạng thái & hồ sơ bằng AI...`
        : `Đang quét ngữ cảnh ${pageLabel} bằng AI để cập nhật trạng thái & mối quan hệ nhân vật...`,
    );

    const postSyncStateSnapshot: ArkState = {
      ...curState,
      portraitBank: finalBank,
    };

    isSyncingTurnCharactersRef.current = true;
    void (async () => {
      try {
        const stateRes = await handleRunMemorySync(
          safePage,
          'state',
          true,
          postSyncStateSnapshot,
        );
        await enrichPortraitsAppearances({
          silent: true,
          turnIndex: safePage,
          stateOverride: {
            ...stateRef.current,
            portraitBank: finalBank,
          },
          portraitIds:
            detectedPortraitIds.length > 0 ? detectedPortraitIds : undefined,
        });

        const updatedStatesCount = stateRes?.updatedStates || 0;
        if (stateRes?.ok) {
          const aiParts: string[] = [];
          if (updatedStatesCount > 0) {
            aiParts.push(
              `cập nhật trạng thái/vị trí/tâm trạng cho ${updatedStatesCount} nhân vật`,
            );
          }
          if (uniqueDetected.length > 0) {
            aiParts.push(
              `làm mới hồ sơ & ngữ cảnh cho ${uniqueDetected.length} nhân vật lượt này`,
            );
          }
          showBanner(
            aiParts.length > 0
              ? `Hoàn tất đồng bộ ${pageLabel}: ${aiParts.join(' · ')}.`
              : `Đã hoàn tất đồng bộ ${pageLabel} — hồ sơ & trạng thái nhân vật đã ở bản mới nhất.`,
          );
        } else {
          showBanner(
            summaryParts.length > 0
              ? `Đã đồng bộ cục bộ ${pageLabel} (${summaryParts.join(' · ')}), nhưng AI cập nhật trạng thái gặp lỗi: ${stateRes?.error || 'không phản hồi'}.`
              : `Đồng bộ AI cho ${pageLabel} gặp lỗi: ${stateRes?.error || 'không phản hồi'}.`,
            'err',
          );
        }
      } finally {
        isSyncingTurnCharactersRef.current = false;
      }
    })();
  }, [
    enrichPortraitsAppearances,
    handleRunMemorySync,
    showBanner,
    updateMemoryWithCompanionSync,
    updatePortraitBankWithCompanionSync,
  ]);

  const handleCancelBgPortraits = useCallback(() => {
    clearBgPortraitTimer();
    if (bgPortraitAbortRef.current) {
      bgPortraitAbortRef.current.abort();
      bgPortraitAbortRef.current = null;
    }
    if (singlePortraitAbortMapRef.current.size > 0) {
      for (const ctrl of singlePortraitAbortMapRef.current.values()) {
        ctrl.abort();
      }
      singlePortraitAbortMapRef.current.clear();
    }
    inFlightPortraitIdsRef.current.clear();
    setBgPortraitStatus(null);
    setGeneratingPortraitIds([]);
    setPortraitProgress({});
  }, [clearBgPortraitTimer]);

  const handleCancelSinglePortrait = useCallback(
    (portraitId: string) => {
      const existingCtrl = singlePortraitAbortMapRef.current.get(portraitId);
      if (existingCtrl) {
        existingCtrl.abort();
        singlePortraitAbortMapRef.current.delete(portraitId);
      } else if (bgPortraitAbortRef.current) {
        // Portrait is currently being generated inside background auto-portrait batch
        bgPortraitAbortRef.current.abort();
        bgPortraitAbortRef.current = null;
      }
      inFlightPortraitIdsRef.current.delete(portraitId);
      setGeneratingPortraitIds((prev) => prev.filter((id) => id !== portraitId));
      setPortraitProgress((prev) => {
        if (!(portraitId in prev)) return prev;
        const next = { ...prev };
        delete next[portraitId];
        return next;
      });
      setBgPortraitStatus((cur) => (cur && cur.active ? null : cur));
    },
    [],
  );

  const handlePreviewPortraitPrompt = useCallback(
    (
      portraitId: string,
      options?: { ignoreCustomPrompt?: boolean; includeSceneContext?: boolean },
    ): string => {
      const curState = stateRef.current;
      const target = (curState.portraitBank?.portraits || []).find(
        (p) => p.id === portraitId,
      );
      if (!target) return '';
      const useScene = Boolean(
        options?.includeSceneContext ?? target.useSceneContextInPortrait,
      );
      let effectiveSceneContext = '';
      if (useScene) {
        const currentTurn = curState.turns[curState.currentPage];
        const sceneHint = stripStoryPlanningAndMeta(
          currentTurn?.assistant || currentTurn?.user || '',
        );
        const profileHints = {
          role: target.role,
          personality: target.personality,
          signature: target.signature,
          appearance: target.appearance,
          isMc: target.isMc,
        };
        effectiveSceneContext =
          extractCharacterContextSnippet(
            sceneHint,
            target.name,
            undefined,
            180,
            profileHints,
          ) ||
          extractBestCharacterContextFromTurns(
            curState.turns || [],
            target.name,
            curState.currentPage,
            undefined,
            180,
            profileHints,
          ) ||
          '';
      }
      return buildCharacterPortraitPrompt({
        character: target,
        state: curState,
        sceneContext: effectiveSceneContext,
        ignoreCustomPrompt: Boolean(options?.ignoreCustomPrompt),
        useSceneContext: useScene,
      });
    },
    [],
  );

  const handleGenerateSinglePortrait = useCallback(
    async (portraitId: string) => {
      let curState = stateRef.current;
      let target = (curState.portraitBank?.portraits || []).find(
        (p) => p.id === portraitId,
      );
      if (!target) {
        showBanner('Không tìm thấy nhân vật cần vẽ ảnh trong thư viện.', 'err');
        return;
      }

      const isComfyProvider = curState.config.imageProvider === 'comfyui';
      const isCustomProvider = curState.config.imageProvider === 'custom';
      const isLatentProvider = curState.config.imageProvider === 'latent';
      const providerLabel = getImageProviderLabel(curState.config.imageProvider);
      const avatarTimeoutMs = isComfyProvider
        ? AVATAR_COMFYUI_TIMEOUT_MS
        : isCustomProvider
          ? CUSTOM_IMAGE_REQUEST_TIMEOUT_MS
          : isLatentProvider
            ? LATENT_REQUEST_TIMEOUT_MS
            : AVATAR_SEEDREAM_TIMEOUT_MS;
      const timeoutSec = Math.max(15, Math.round(avatarTimeoutMs / 1000));

      const hasImageEngine = hasImageGeneratorConfigured(curState.config);
      if (!hasImageEngine) {
        const msg = isComfyProvider
          ? 'Chưa cấu hình đầy đủ ComfyUI Base URL và Workflow API JSON trong tab Cấu hình.'
          : isCustomProvider
            ? 'Chưa cấu hình Custom Image Endpoint URL trong tab Cấu hình.'
            : isLatentProvider
              ? 'Chưa nhập Latent API Key (lat_sk_...) trong tab Cấu hình → Họa Đồ AI · Latent.moe.'
              : 'Chưa cấu hình Seedream 5 Pro Endpoint. Hãy vào tab Cấu hình để nhập Endpoint tạo ảnh.';
        setPortraitErrors((prev) => ({ ...prev, [portraitId]: msg }));
        setBgPortraitStatus({ active: false, text: msg, isErr: true });
        showBanner(msg, 'err');
        return;
      }

      // Strict synchronous in-flight guard: NEVER fire overlapping/duplicate requests for the same portrait
      if (
        inFlightPortraitIdsRef.current.has(portraitId) ||
        singlePortraitAbortMapRef.current.has(portraitId)
      ) {
        showBanner(
          `Ảnh cho "${target.name}" đang được tạo, vui lòng chờ xong hoặc bấm Hủy.`,
        );
        return;
      }

      // For ComfyUI (single-GPU queue), NEVER overlap a new prompt while another ComfyUI request is still running
      if (
        isComfyProvider &&
        (inFlightPortraitIdsRef.current.size > 0 ||
          singlePortraitAbortMapRef.current.size > 0 ||
          imageAbortControllerRef.current !== null ||
          bgPortraitAbortRef.current !== null ||
          isComfyUiBusy(curState.config.comfyuiUrl))
      ) {
        showBanner(
          'ComfyUI đang vẽ một ảnh khác. Vui lòng chờ hoàn tất hoặc bấm Hủy trước khi tạo ảnh mới.',
        );
        return;
      }

      // For Seedream, pause any background auto-portrait batch so manual generation gets full proxy priority
      if (!isComfyProvider && bgPortraitAbortRef.current) {
        appendProxyLog(
          '[Ảnh NV] Tạm dừng sinh ảnh ngầm để ưu tiên yêu cầu vẽ thủ công.',
        );
        bgPortraitAbortRef.current.abort();
        bgPortraitAbortRef.current = null;
      }

      const controller = new AbortController();
      inFlightPortraitIdsRef.current.add(portraitId);
      singlePortraitAbortMapRef.current.set(portraitId, controller);

      const startedAt = Date.now();
      const plannedMaxAttempts = 1;
      clearBgPortraitTimer();
      setPortraitErrors((prev) => {
        if (!(portraitId in prev)) return prev;
        const next = { ...prev };
        delete next[portraitId];
        return next;
      });
      setGeneratingPortraitIds((prev) =>
        prev.includes(portraitId) ? prev : [...prev, portraitId],
      );
      const imageProvider: ImageProvider = isComfyProvider
        ? 'comfyui'
        : isCustomProvider
          ? 'custom'
          : isLatentProvider
            ? 'latent'
            : 'seedream';
      setPortraitProgress((prev) => ({
        ...prev,
        [portraitId]: {
          portraitId,
          phase: 'preparing',
          label: `Đang khởi tạo yêu cầu ${providerLabel}...`,
          provider: imageProvider,
          attempt: 1,
          maxAttempts: plannedMaxAttempts,
          startedAt,
          timeoutSec,
        },
      }));
      setBgPortraitStatus({
        active: true,
        text: `Đang vẽ ảnh nhân vật (${providerLabel}): ${target.name}...`,
      });

      try {
        // Auto-resolve missing appearance before calling image engine (skip if user provided a manual customPrompt)
        if (
          !target.customPrompt?.trim() &&
          !target.appearance?.trim() &&
          !target.appearanceManual &&
          !target.aiAutoEnrichLocked
        ) {
          setPortraitProgress((prev) => ({
            ...prev,
            [portraitId]: {
              portraitId,
              phase: 'preparing',
              label: 'Đang bổ sung mô tả ngoại hình nhân vật...',
              provider: imageProvider,
              attempt: 1,
              maxAttempts: plannedMaxAttempts,
              startedAt,
              timeoutSec,
            },
          }));
          try {
            await enrichPortraitsAppearances({
              portraitIds: [portraitId],
              forceManual: false,
              silent: true,
              signal: controller.signal,
              timeoutMs: 12_000,
            });
          } catch (enrichErr) {
            appendProxyLog(
              `[Ảnh NV] Bỏ qua bước bổ sung ngoại hình cho "${target.name}": ${
                enrichErr instanceof Error ? enrichErr.message : String(enrichErr)
              }`,
            );
          }
          if (controller.signal.aborted) return;
          curState = stateRef.current;
          target =
            (curState.portraitBank?.portraits || []).find(
              (p) => p.id === portraitId,
            ) || target;
        }

        // Strictly separate transient story-turn descriptions from fixed character portrait profiles:
        // only read story turn context if the user explicitly opted in on this character card.
        const useSceneForPortrait = Boolean(target.useSceneContextInPortrait);
        let effectiveSceneContext = '';
        if (useSceneForPortrait) {
          const currentTurn = curState.turns[curState.currentPage];
          const sceneHint = stripStoryPlanningAndMeta(
            currentTurn?.assistant || currentTurn?.user || '',
          );
          const profileHints = {
            role: target.role,
            personality: target.personality,
            signature: target.signature,
            appearance: target.appearance,
            isMc: target.isMc,
          };
          effectiveSceneContext =
            extractCharacterContextSnippet(
              sceneHint,
              target.name,
              undefined,
              180,
              profileHints,
            ) ||
            extractBestCharacterContextFromTurns(
              curState.turns || [],
              target.name,
              curState.currentPage,
              undefined,
              180,
              profileHints,
            ) ||
            '';
        }

        const targetDisplayName = target.name;
        const res = await generateCharacterPortraitImage({
          state: curState,
          character: target,
          sceneContext: effectiveSceneContext,
          useSceneContext: useSceneForPortrait,
          signal: controller.signal,
          timeoutMs: avatarTimeoutMs,
          maxRetries: 0,
          onLog: appendProxyLog,
          onProgress: (prog) => {
            if (controller.signal.aborted) return;
            const progProviderLabel = getImageProviderLabel(prog.provider);
            setPortraitProgress((prev) => ({
              ...prev,
              [portraitId]: {
                ...prog,
                portraitId,
              },
            }));
            setBgPortraitStatus({
              active: true,
              text: `${targetDisplayName} (${progProviderLabel}): ${prog.label}`,
            });
          },
          onCacheAvatarVisualLock: cacheAvatarVisualLock,
        });

        if (res.aborted || controller.signal.aborted) {
          if (singlePortraitAbortMapRef.current.get(portraitId) === controller) {
            setBgPortraitStatus({
              active: false,
              text: `Đã dừng tạo ảnh cho "${target.name}".`,
              isErr: false,
            });
            bgPortraitClearTimerRef.current = window.setTimeout(() => {
              bgPortraitClearTimerRef.current = null;
              setBgPortraitStatus((cur) => (cur && !cur.active ? null : cur));
            }, 4000);
          }
          return;
        }

        if (!res.ok || !res.imageUrl) {
          const errMsg =
            res.error ||
            `Không thể tạo ảnh cho "${target.name}". Kiểm tra cấu hình ${providerLabel}.`;
          setPortraitErrors((prev) => ({ ...prev, [portraitId]: errMsg }));
          setBgPortraitStatus({
            active: false,
            text: `Lỗi vẽ "${target.name}": ${errMsg}`,
            isErr: true,
          });
          showBanner(errMsg, 'err');
          return;
        }

        setPortraitErrors((prev) => {
          if (!(portraitId in prev)) return prev;
          const next = { ...prev };
          delete next[portraitId];
          return next;
        });
        const targetKey = normalizeCharacterKey(targetDisplayName);
        updatePortraitBankWithCompanionSync((prev) => {
          const list = prev.portraits || [];
          const hasExactId = list.some((p) => p.id === portraitId);
          return {
            ...prev,
            portraits: list.map((p) => {
              const isMatch = hasExactId
                ? p.id === portraitId
                : Boolean(targetKey) && normalizeCharacterKey(p.name) === targetKey;
              return isMatch
                ? {
                    ...p,
                    imageData: res.imageUrl,
                    prompt: res.prompt,
                    lastAppliedComparisonPatch:
                      res.appliedComparisonPatch || undefined,
                    autoGenerated: false,
                    updatedAt: Date.now(),
                  }
                : p;
            }),
          };
        });
        setBgPortraitStatus({
          active: false,
          text: res.appliedComparisonPatch
            ? `Đã tạo ảnh nhân vật: ${target.name} (đã nạp chỉnh sửa đối chiếu vào prompt)`
            : `Đã tạo ảnh nhân vật: ${target.name}`,
          isErr: false,
        });
        bgPortraitClearTimerRef.current = window.setTimeout(() => {
          bgPortraitClearTimerRef.current = null;
          setBgPortraitStatus((cur) => (cur && !cur.active ? null : cur));
        }, 8000);
        showBanner(
          res.appliedComparisonPatch
            ? `Đã tạo ảnh nhân vật: ${target.name} (đã áp dụng chỉnh sửa đối chiếu vào prompt).`
            : `Đã tạo ảnh nhân vật: ${target.name}.`,
        );
        // If character has a real-person reference photo and Proxy API is configured,
        // automatically run real Vision API 2-image verification on the freshly drawn portrait.
        if (
          target.referenceImageData?.trim() &&
          curState.config.proxyUrl?.trim()
        ) {
          void handleVerifyPortraitAgainstReference(portraitId, {
            targetImageOverride: res.imageUrl,
            silent: false,
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const rawMsg =
            err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
          const errMsg = `Không thể tạo ảnh cho "${target.name}": ${rawMsg}`;
          appendProxyLog(`[Ảnh NV] ${errMsg}`);
          setPortraitErrors((prev) => ({ ...prev, [portraitId]: errMsg }));
          setBgPortraitStatus({
            active: false,
            text: errMsg,
            isErr: true,
          });
          showBanner(errMsg, 'err');
        }
      } finally {
        inFlightPortraitIdsRef.current.delete(portraitId);
        if (singlePortraitAbortMapRef.current.get(portraitId) === controller) {
          singlePortraitAbortMapRef.current.delete(portraitId);
          setGeneratingPortraitIds((prev) =>
            prev.filter((id) => id !== portraitId),
          );
          setPortraitProgress((prev) => {
            if (!(portraitId in prev)) return prev;
            const next = { ...prev };
            delete next[portraitId];
            return next;
          });
          if (
            singlePortraitAbortMapRef.current.size === 0 &&
            !bgPortraitAbortRef.current
          ) {
            setBgPortraitStatus((cur) => (cur && cur.active ? null : cur));
          }
        }
      }
    },
    [
      appendProxyLog,
      cacheAvatarVisualLock,
      clearBgPortraitTimer,
      enrichPortraitsAppearances,
      handleVerifyPortraitAgainstReference,
      showBanner,
      updatePortraitBankWithCompanionSync,
    ],
  );

  const mergePortraitContextSnippet = useCallback(
    (
      prevSnippet?: string,
      nextSnippet?: string,
      charName?: string,
      extraAliases?: Array<string | undefined>,
    ): string => {
      const normalizeSolo = (raw?: string): string => {
        const cleaned = String(stripStoryPlanningAndMeta(raw || '') ?? '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!cleaned) return '';
        if (isSoloPoseExpressionSnippet(cleaned)) {
          return cleaned.slice(0, 180);
        }
        if (!charName) return '';
        return extractSoloPoseAndExpression(cleaned, charName, {
          alternateName: extraAliases?.find((a) => Boolean(a && a.trim())),
          allowProfileFallback: false,
        }).slice(0, 180);
      };

      const cleanNext = normalizeSolo(nextSnippet);
      const cleanPrev = normalizeSolo(prevSnippet);
      return cleanNext || cleanPrev;
    },
    [],
  );

  const handleRunBackgroundAutoPortraits = useCallback(
    async (
      turnIndex: number,
      options?: { manual?: boolean; stateOverride?: ArkState },
    ) => {
      const manual = Boolean(options?.manual);
      const workingState = options?.stateOverride || stateRef.current;
      const activeComp = getActiveCompanionFromState(workingState);
      const targetTurn = workingState.turns[turnIndex];
      if (!targetTurn) {
        if (manual) {
          showBanner('Chưa có lượt truyện để quét nhân vật.', 'err');
        }
        return;
      }

      const allowedKnownKeys = buildAllowedRosterKeys(
        activeComp,
        workingState.player?.name,
      );
      const cultivationBlockedKeys = buildCultivationNonNpcKeys(
        workingState.memory?.cultivation,
      );

      // Clean any previously leaked junk entries first without deleting valid characters/images
      const { bank: cleanedBank, removedNames } = cleanJunkPortraitsFromBank(
        workingState.portraitBank || createDefaultPortraitBank(),
        activeComp,
        workingState.player?.name,
        cultivationBlockedKeys,
      );
      if (removedNames.length > 0) {
        updatePortraitBankWithCompanionSync(() => cleanedBank);
      }

      const cleanWorkingState: ArkState = {
        ...workingState,
        portraitBank: cleanedBank,
      };

      const cleanTurnProse = stripNonSceneChatBlocks(
        stripStoryPlanningAndMeta(
          targetTurn.assistant || targetTurn.user || '',
        ),
      );

      const rawDetected = detectCharactersInTurnForPortraits(
        targetTurn,
        cleanWorkingState,
        { strictNewNpcGate: true },
      );

      // Strictly filter out junk/malformed candidate names and attach a clean turn contextSnippet for every valid character
      const seenCandKeys = new Set<string>();
      const sanitizedDetected: Array<{
        cand: (typeof rawDetected)[number];
        cleanName: string;
        candKey: string;
        contextSnippet: string;
      }> = [];

      for (const cand of rawDetected) {
        const cleanName = cand.isMc
          ? String(cand.name || '').trim()
          : sanitizeCharacterName(
              cand.name,
              allowedKnownKeys,
              cultivationBlockedKeys,
            ) || '';
        if (!cleanName) continue;
        const candKey = normalizeCharacterKey(cleanName);
        if (!candKey || seenCandKeys.has(candKey)) continue;
        seenCandKeys.add(candKey);

        const rawSnippet = String(stripStoryPlanningAndMeta(cand.contextSnippet || '') ?? '')
          .replace(/\s+/g, ' ')
          .trim();
        const soloFromCand =
          rawSnippet && isSoloPoseExpressionSnippet(rawSnippet)
            ? rawSnippet
            : '';
        const contextSnippet = (
          soloFromCand ||
          extractCharacterContextSnippet(cleanTurnProse, cleanName, cand.name, 180, {
            role: cand.role,
            personality: cand.personality,
            signature: cand.signature,
            appearance: cand.appearance,
            isMc: cand.isMc,
            allowProfileFallback: true,
          })
        ).slice(0, 180);

        sanitizedDetected.push({
          cand,
          cleanName,
          candKey,
          contextSnippet,
        });
      }

      if (!sanitizedDetected.length) {
        if (manual) {
          showBanner(
            removedNames.length > 0
              ? `Đã lọc bỏ ${removedNames.length} mục tên rác. Không nhận diện được thêm nhân vật hợp lệ ở Trang ${turnIndex + 1}.`
              : `Không nhận diện được tên nhân vật cụ thể ở Trang ${turnIndex + 1}.`,
          );
        }
        return;
      }

      const nowTs = Date.now();
      const mergedPortraits: CharacterPortrait[] = [
        ...(cleanedBank.portraits || []),
      ];
      const rawMatchedQueue: Array<{
        portrait: CharacterPortrait;
        contextSnippet: string;
      }> = [];

      const MAX_NEW_AUTO_NPCS_PER_SCAN = 3;
      let newAutoAddedCount = 0;

      for (let i = 0; i < sanitizedDetected.length; i++) {
        const { cand, cleanName, candKey, contextSnippet } =
          sanitizedDetected[i];

        const aliasMatched = !cand.isMc
          ? matchPortraitByName(
              cleanName,
              mergedPortraits.filter((p) => !p.isMc),
            )
          : undefined;
        const existingIdx = mergedPortraits.findIndex(
          (p) =>
            (cand.npcId && p.npcId === cand.npcId) ||
            normalizeCharacterKey(p.name) === candKey ||
            (aliasMatched && p.id === aliasMatched.id) ||
            (cand.isMc && p.isMc),
        );

        let entry: CharacterPortrait;
        if (existingIdx >= 0) {
          const cur = mergedPortraits[existingIdx];
          const preferCleanOverCur =
            !cur.isMc &&
            Boolean(cleanName) &&
            !isPlayfulTeasingOrParodyName(cleanName, allowedKnownKeys) &&
            (isPlayfulTeasingOrParodyName(cur.name, allowedKnownKeys) ||
              !cur.name.trim());
          const targetCharName = cur.isMc
            ? cur.name
            : preferCleanOverCur
              ? cleanName
              : cur.name || cleanName;
          const nextSnippet = mergePortraitContextSnippet(
            cur.contextSnippet,
            contextSnippet,
            targetCharName,
            [cur.name, cand.name, cur.role, cur.signature],
          );
          const isLocked = Boolean(cur.aiAutoEnrichLocked);
          entry = {
            ...cur,
            name: targetCharName,
            role: isLocked ? cur.role : cur.role || cand.role,
            appearance:
              cur.appearanceManual || isLocked
                ? cur.appearance
                : cur.appearance || cand.appearance,
            ...(cur.profileManual || isLocked
              ? {}
              : {
                  age: cur.age || cand.age || undefined,
                  birthday: cur.birthday || cand.birthday || undefined,
                  fashionStyle:
                    cur.fashionStyle || cand.fashionStyle || undefined,
                  personality: cur.personality || cand.personality || undefined,
                  relationships:
                    cur.relationships || cand.relationships || undefined,
                  signature: cur.signature || cand.signature || undefined,
                }),
            contextSnippet: nextSnippet || undefined,
            npcId: cur.npcId || cand.npcId,
            lastSeenTurnIndex: turnIndex,
          };
          mergedPortraits[existingIdx] = entry;
        } else {
          if (newAutoAddedCount >= MAX_NEW_AUTO_NPCS_PER_SCAN) {
            continue;
          }
          // On automatic background scans, never auto-register brand-new Mob/background extras
          // unless the player explicitly mentioned them in their turn input.
          const isBrandNewMob =
            !cand.isMc &&
            resolvePortraitRoleTier({ role: cand.role, isMc: false }).tier ===
              'mob';
          const userMentionedNewMob =
            isBrandNewMob &&
            Boolean((targetTurn.user || '').trim()) &&
            findExactProperNameInText(
              stripStoryPlanningAndMeta(targetTurn.user || ''),
              cleanName,
              { allowHonorificShortName: true },
            ).count > 0;
          if (!manual && isBrandNewMob && !userMentionedNewMob) {
            continue;
          }
          entry = {
            id: `port_auto_${nowTs}_${i}_${Math.random().toString(36).slice(2, 5)}`,
            name: cleanName,
            isMc: cand.isMc,
            role: cand.role,
            ...(cand.age ? { age: cand.age } : {}),
            ...(cand.birthday ? { birthday: cand.birthday } : {}),
            ...(cand.fashionStyle ? { fashionStyle: cand.fashionStyle } : {}),
            appearance: cand.appearance,
            ...(cand.personality ? { personality: cand.personality } : {}),
            ...(cand.relationships
              ? { relationships: cand.relationships }
              : {}),
            ...(cand.signature ? { signature: cand.signature } : {}),
            ...(contextSnippet ? { contextSnippet } : {}),
            appearanceManual: false,
            profileManual: false,
            npcId: cand.npcId,
            lastSeenTurnIndex: turnIndex,
            updatedAt: nowTs + i,
          };
          mergedPortraits.push(entry);
          newAutoAddedCount += 1;
        }
        rawMatchedQueue.push({
          portrait: entry,
          contextSnippet: entry.contextSnippet || contextSnippet,
        });
      }

      // Final junk-name safeguard before persisting & enriching
      const { bank: updatedBankSnapshot } = cleanJunkPortraitsFromBank(
        {
          ...cleanedBank,
          portraits: mergedPortraits,
        },
        activeComp,
        workingState.player?.name,
        cultivationBlockedKeys,
      );

      const survivingById = new Map<string, CharacterPortrait>();
      const survivingByKey = new Map<string, CharacterPortrait>();
      for (const sp of updatedBankSnapshot.portraits) {
        survivingById.set(sp.id, sp);
        const k = normalizeCharacterKey(sp.name);
        if (k) survivingByKey.set(k, sp);
      }

      const matchedQueue = rawMatchedQueue
        .map((item) => {
          const validPortrait =
            survivingById.get(item.portrait.id) ||
            survivingByKey.get(normalizeCharacterKey(item.portrait.name));
          if (!validPortrait) return null;
          return {
            portrait: validPortrait,
            contextSnippet:
              item.contextSnippet || validPortrait.contextSnippet || '',
          };
        })
        .filter(
          (
            item,
          ): item is { portrait: CharacterPortrait; contextSnippet: string } =>
            item !== null,
        );

      if (!matchedQueue.length) {
        if (manual) {
          showBanner(
            `Không nhận diện được tên nhân vật hợp lệ ở Trang ${turnIndex + 1}.`,
          );
        }
        return;
      }

      // Persist newly discovered valid characters, contextSnippet, and lastSeenTurnIndex immediately
      updatePortraitBankWithCompanionSync((prev) => {
        const { bank: safePrev } = cleanJunkPortraitsFromBank(
          prev,
          activeComp,
          workingState.player?.name,
          cultivationBlockedKeys,
        );
        const nextList = [...(safePrev.portraits || [])];
        for (const item of matchedQueue) {
          const p = item.portrait;
          const pKey = normalizeCharacterKey(p.name);
          const aliasHit = !p.isMc
            ? matchPortraitByName(
                p.name,
                nextList.filter((x) => !x.isMc),
              )
            : undefined;
          const idx = nextList.findIndex(
            (x) =>
              x.id === p.id ||
              (p.npcId && x.npcId === p.npcId) ||
              normalizeCharacterKey(x.name) === pKey ||
              (aliasHit && x.id === aliasHit.id) ||
              (p.isMc && x.isMc),
          );
          if (idx >= 0) {
            const cur = nextList[idx];
            const targetCharName = cur.isMc ? cur.name : p.name || cur.name;
            const mergedSnippet = mergePortraitContextSnippet(
              cur.contextSnippet,
              item.contextSnippet || p.contextSnippet,
              targetCharName,
              [cur.name, p.name, cur.role, cur.signature],
            );
            const isLocked = Boolean(cur.aiAutoEnrichLocked);
            nextList[idx] = {
              ...cur,
              name: targetCharName,
              role: isLocked ? cur.role : cur.role || p.role,
              appearance:
                cur.appearanceManual || isLocked
                  ? cur.appearance
                  : cur.appearance || p.appearance,
              ...(cur.profileManual || isLocked
                ? {}
                : {
                    age: cur.age || p.age || undefined,
                    birthday: cur.birthday || p.birthday || undefined,
                    fashionStyle:
                      cur.fashionStyle || p.fashionStyle || undefined,
                    personality: cur.personality || p.personality || undefined,
                    relationships:
                      cur.relationships || p.relationships || undefined,
                    signature: cur.signature || p.signature || undefined,
                  }),
              contextSnippet: mergedSnippet || undefined,
              npcId: cur.npcId || p.npcId,
              lastSeenTurnIndex: turnIndex,
            };
          } else {
            nextList.push({
              ...p,
              ...(item.contextSnippet
                ? { contextSnippet: item.contextSnippet }
                : {}),
            });
          }
        }
        return cleanJunkPortraitsFromBank(
          { ...safePrev, portraits: nextList },
          activeComp,
          workingState.player?.name,
          cultivationBlockedKeys,
        ).bank;
      });

      clearBgPortraitTimer();
      if (bgPortraitAbortRef.current) {
        bgPortraitAbortRef.current.abort();
      }
      const controller = new AbortController();
      bgPortraitAbortRef.current = controller;

      const batchActiveIds = new Set<string>();
      try {
        // Enrich vivid profiles & appearances of detected non-manual, unlocked characters with AI before Seedream
        const idsToEnrich = matchedQueue
          .filter(
            (item) =>
              !item.portrait.aiAutoEnrichLocked &&
              (!item.portrait.appearanceManual || !item.portrait.profileManual),
          )
          .map((item) => item.portrait.id);
        if (idsToEnrich.length > 0 && !controller.signal.aborted) {
          if (manual) {
            setBgPortraitStatus({
              active: true,
              text: `Đang phân tích hồ sơ ${idsToEnrich.length} nhân vật ở Trang ${turnIndex + 1}...`,
            });
          }
          try {
            await enrichPortraitsAppearances({
              portraitIds: idsToEnrich,
              forceManual: false,
              silent: true,
              turnIndex,
              signal: controller.signal,
              timeoutMs: 25_000,
              stateOverride: {
                ...cleanWorkingState,
                portraitBank: updatedBankSnapshot,
              },
            });
          } catch (enrichErr) {
            appendProxyLog(
              `[Ảnh ngầm] Bỏ qua bước bổ sung hồ sơ: ${
                enrichErr instanceof Error ? enrichErr.message : String(enrichErr)
              }`,
            );
          }
        }

        if (controller.signal.aborted) {
          if (bgPortraitAbortRef.current === controller) {
            setBgPortraitStatus(null);
          }
          return;
        }

        const includeMc = Boolean(cleanedBank.includeMcAuto);
        const maxPerTurn = Math.max(
          1,
          Math.min(3, Number(cleanedBank.maxAutoPerTurn) || 2),
        );

        const missingTargets = matchedQueue
          .filter((item) => {
            if (item.portrait.imageData) return false;
            if (item.portrait.isMc && !includeMc) return false;
            return true;
          })
          .slice(0, maxPerTurn);

        if (!missingTargets.length) {
          if (bgPortraitAbortRef.current === controller) {
            setBgPortraitStatus(null);
          }
          if (manual) {
            showBanner(
              `Đã cập nhật mô tả ngoại hình — các nhân vật xuất hiện ở Trang ${turnIndex + 1} đều đã có ảnh.`,
            );
          }
          return;
        }

        const hasImageEngine = hasImageGeneratorConfigured(workingState.config);
        if (!hasImageEngine) {
          const msg =
            workingState.config.imageProvider === 'comfyui'
              ? 'Chưa cấu hình đầy đủ ComfyUI Base URL và Workflow API JSON trong tab Cấu hình để sinh ảnh nhân vật.'
              : workingState.config.imageProvider === 'custom'
                ? 'Chưa cấu hình Custom Image Endpoint URL trong tab Cấu hình để sinh ảnh nhân vật.'
                : workingState.config.imageProvider === 'latent'
                  ? 'Chưa nhập Latent API Key (lat_sk_...) trong tab Cấu hình để sinh ảnh nhân vật.'
                  : 'Chưa cấu hình Seedream 5 Pro Endpoint trong tab Cấu hình để sinh ảnh nhân vật.';
          if (manual) {
            showBanner(msg, 'err');
          }
          if (bgPortraitAbortRef.current === controller) {
            setBgPortraitStatus({
              active: false,
              text: msg,
              isErr: true,
            });
          }
          return;
        }

        const isBgComfy = workingState.config.imageProvider === 'comfyui';
        if (
          isBgComfy &&
          (inFlightPortraitIdsRef.current.size > 0 ||
            singlePortraitAbortMapRef.current.size > 0 ||
            imageAbortControllerRef.current !== null ||
            isComfyUiBusy(workingState.config.comfyuiUrl))
        ) {
          if (manual) {
            showBanner(
              'ComfyUI đang vẽ ảnh khác, vui lòng chờ xong rồi thử lại.',
            );
          }
          return;
        }

        const generatedNames: string[] = [];
        let lastError = '';

        for (let i = 0; i < missingTargets.length; i++) {
          if (controller.signal.aborted) break;
          const { portrait, contextSnippet } = missingTargets[i];

          // Re-check latest state so we use the newly enriched appearance & skip if already generated
          const latestEntry = (
            stateRef.current.portraitBank?.portraits || []
          ).find(
            (x) =>
              x.id === portrait.id ||
              normalizeCharacterKey(x.name) ===
                normalizeCharacterKey(portrait.name),
          );
          if (latestEntry?.imageData) continue;
          const targetId = latestEntry?.id || portrait.id;
          const targetChar = latestEntry || portrait;

          setBgPortraitStatus({
            active: true,
            text: `Đang sinh ảnh ngầm (${i + 1}/${missingTargets.length}): ${targetChar.name}...`,
          });
          batchActiveIds.add(targetId);
          setGeneratingPortraitIds((prev) =>
            prev.includes(targetId) ? prev : [...prev, targetId],
          );
          setPortraitErrors((prev) => {
            if (!(targetId in prev)) return prev;
            const next = { ...prev };
            delete next[targetId];
            return next;
          });

          try {
            const bgUseScene = Boolean(targetChar.useSceneContextInPortrait);
            const res = await generateCharacterPortraitImage({
              state: stateRef.current,
              character: targetChar,
              sceneContext: bgUseScene
                ? contextSnippet || targetChar.contextSnippet || ''
                : '',
              useSceneContext: bgUseScene,
              signal: controller.signal,
              maxRetries: 0,
              onLog: appendProxyLog,
              onCacheAvatarVisualLock: cacheAvatarVisualLock,
            });

            if (res.aborted || controller.signal.aborted) {
              if (bgPortraitAbortRef.current === controller) {
                setBgPortraitStatus(null);
              }
              return;
            }

            if (res.ok && res.imageUrl) {
              generatedNames.push(targetChar.name);
              updatePortraitBankWithCompanionSync((prev) => ({
                ...prev,
                portraits: prev.portraits.map((p) =>
                  p.id === targetId ||
                  normalizeCharacterKey(p.name) ===
                    normalizeCharacterKey(targetChar.name)
                    ? {
                        ...p,
                        imageData: res.imageUrl,
                        prompt: res.prompt,
                        autoGenerated: true,
                        lastSeenTurnIndex: turnIndex,
                        updatedAt: Date.now(),
                      }
                    : p,
                ),
              }));
            } else {
              const errMsg =
                res.error ||
                `Không thể sinh ảnh cho "${targetChar.name}". Kiểm tra cấu hình Seedream 5 Pro.`;
              lastError = errMsg;
              setPortraitErrors((prev) => ({ ...prev, [targetId]: errMsg }));
            }
          } finally {
            batchActiveIds.delete(targetId);
            if (!singlePortraitAbortMapRef.current.has(targetId)) {
              setGeneratingPortraitIds((prev) =>
                prev.filter((id) => id !== targetId),
              );
            }
          }
        }

        if (bgPortraitAbortRef.current === controller) {
          if (generatedNames.length > 0) {
            setBgPortraitStatus({
              active: false,
              text: `Đã tự sinh ảnh ngầm: ${generatedNames.join(', ')}`,
              isErr: false,
            });
            bgPortraitClearTimerRef.current = window.setTimeout(() => {
              bgPortraitClearTimerRef.current = null;
              setBgPortraitStatus((cur) => (cur && !cur.active ? null : cur));
            }, 12000);
          } else if (lastError) {
            setBgPortraitStatus({
              active: false,
              text: `Sinh ảnh ngầm lỗi: ${lastError}`,
              isErr: true,
            });
            if (manual) {
              showBanner(`Sinh ảnh nhân vật lỗi: ${lastError}`, 'err');
            }
          } else {
            setBgPortraitStatus(null);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const msg =
            err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
          appendProxyLog(`[Ảnh ngầm] Lỗi bất ngờ: ${msg}`);
          if (bgPortraitAbortRef.current === controller) {
            setBgPortraitStatus({
              active: false,
              text: `Sinh ảnh ngầm lỗi: ${msg}`,
              isErr: true,
            });
          }
          if (manual) {
            showBanner(`Sinh ảnh nhân vật lỗi: ${msg}`, 'err');
          }
        }
      } finally {
        if (batchActiveIds.size > 0) {
          const remaining = Array.from(batchActiveIds);
          setGeneratingPortraitIds((prev) =>
            prev.filter(
              (id) =>
                !remaining.includes(id) ||
                singlePortraitAbortMapRef.current.has(id),
            ),
          );
          batchActiveIds.clear();
        }
        if (bgPortraitAbortRef.current === controller) {
          bgPortraitAbortRef.current = null;
          setBgPortraitStatus((cur) => (cur && cur.active ? null : cur));
        }
      }
    },
    [
      appendProxyLog,
      cacheAvatarVisualLock,
      clearBgPortraitTimer,
      enrichPortraitsAppearances,
      mergePortraitContextSnippet,
      showBanner,
      updatePortraitBankWithCompanionSync,
    ],
  );

  const cancelScheduledStreamFrame = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    if (streamDrainTimerRef.current !== null) {
      window.clearTimeout(streamDrainTimerRef.current);
      streamDrainTimerRef.current = null;
    }
    if (streamDrainResolveRef.current) {
      const resolve = streamDrainResolveRef.current;
      streamDrainResolveRef.current = null;
      resolve();
    }
  }, []);

  useEffect(
    () => () => {
      cancelScheduledStreamFrame();
      clearBgPortraitTimer();
      imageAbortControllerRef.current?.abort();
      bgPortraitAbortRef.current?.abort();
      for (const ctrl of singlePortraitAbortMapRef.current.values()) {
        ctrl.abort();
      }
      singlePortraitAbortMapRef.current.clear();
    },
    [cancelScheduledStreamFrame, clearBgPortraitTimer],
  );

  // Model execution engine
  const runModelTurn = useCallback(
    async (turnIndex: number, snapshotState?: ArkState) => {
      if (isGenerating) return;
      const workingState = snapshotState || stateRef.current;
      const baseTurn = workingState.turns[turnIndex];
      if (!baseTurn) return;
      const targetTurnId = baseTurn.id;

      // Capture pre-turn clock so regenerating this turn recalculates from the exact pre-turn anchor
      const existingPreClock = turnPreClockRef.current.get(turnIndex);
      const preTurnClock = existingPreClock
        ? normalizeStoryClock(existingPreClock)
        : normalizeStoryClock(workingState.memory?.storyClock);
      turnPreClockRef.current.set(turnIndex, preTurnClock);

      cancelScheduledStreamFrame();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const startTs = Date.now();
      streamAbortedRef.current = false;
      streamLastTickRef.current = 0;
      streamLastCommitRef.current = 0;
      streamDisplayedLenRef.current = 0;
      streamCarryRef.current = 0;
      streamFastDrainRef.current = false;
      streamTargetRef.current = { turnIndex, turnId: targetTurnId, text: '' };
      setIsGenerating(true);
      setStreamingState({ turnIndex, turnId: targetTurnId, text: '' });
      setGenStatus({
        text: workingState.streamEnabled ? 'Đang stream...' : 'Đang gọi...',
        isErr: false,
      });

      // Clear target turn's assistant text before streaming (matched strictly by turnId)
      updateTurnsWithCompanionSync((turns) =>
        turns.map((t) =>
          t.id === targetTurnId
            ? { ...t, assistant: '', rawAssistant: undefined }
            : t,
        ),
      );

      const stepStreamPacer = (now: number) => {
        streamRafRef.current = null;
        if (streamAbortedRef.current) return;
        const target = streamTargetRef.current;
        if (!target) return;

        const total = target.text.length;
        const curLen = streamDisplayedLenRef.current;
        const backlog = total - curLen;

        if (backlog <= 0) {
          streamLastTickRef.current = 0;
          if (streamDrainResolveRef.current) {
            const resolve = streamDrainResolveRef.current;
            streamDrainResolveRef.current = null;
            if (streamDrainTimerRef.current !== null) {
              window.clearTimeout(streamDrainTimerRef.current);
              streamDrainTimerRef.current = null;
            }
            resolve();
          }
          return;
        }

        // Detect whether cursor is still inside leading thinking / draft / English outline before main story
        const draftEndOffset = getLeadingDraftEndOffset(target.text);
        const inLeadingDraft = curLen < draftEndOffset;

        // Faster frame cadence during thinking/draft/English outline; keep unhurried 34ms cadence for main story
        const minCommitIntervalMs = inLeadingDraft ? 16 : 34;
        if (
          streamLastCommitRef.current > 0 &&
          now - streamLastCommitRef.current < minCommitIntervalMs
        ) {
          streamRafRef.current = requestAnimationFrame(stepStreamPacer);
          return;
        }

        const prevTick = streamLastTickRef.current || now - minCommitIntervalMs;
        const dtMs = Math.min(72, Math.max(16, now - prevTick));
        streamLastTickRef.current = now;

        // Fast sweep through thinking/draft/outline; preserve unhurried, graceful pacing for main story
        const fastDrain = streamFastDrainRef.current;
        const charsPerSec = inLeadingDraft
          ? Math.min(2600, 900 + backlog * 4.5)
          : fastDrain
            ? Math.min(175, 62 + backlog * 0.55)
            : Math.min(135, 44 + backlog * 0.42);

        const rawAdvance = (charsPerSec * dtMs) / 1000 + streamCarryRef.current;
        const wholeChars = Math.floor(rawAdvance);
        streamCarryRef.current = rawAdvance - wholeChars;

        if (wholeChars > 0) {
          const maxStep = inLeadingDraft
            ? Math.max(18, Math.min(96, Math.ceil(backlog * 0.35)))
            : fastDrain
              ? Math.max(2, Math.min(6, Math.ceil(backlog * 0.055)))
              : Math.max(2, Math.min(5, Math.ceil(backlog * 0.045)));

          let nextLen = Math.min(total, curLen + Math.min(wholeChars, maxStep));

          // Stop cleanly right at the end of the draft/outline so main story always starts at gentle pace
          if (inLeadingDraft && draftEndOffset < total && nextLen > draftEndOffset) {
            nextLen = draftEndOffset;
            streamCarryRef.current = 0;
          }

          // Never split UTF-16 surrogate pairs
          if (nextLen < total) {
            const code = target.text.charCodeAt(nextLen - 1);
            if (code >= 0xd800 && code <= 0xdbff) {
              nextLen = Math.min(total, nextLen + 1);
            }
          }

          // Never flash half-open XML tags like `</thi` or `<sto`
          const revealedSlice = target.text.slice(curLen, nextLen);
          const lastLt = revealedSlice.lastIndexOf('<');
          const lastGt = revealedSlice.lastIndexOf('>');
          if (lastLt > lastGt) {
            const absLt = curLen + lastLt;
            const closeIdx = target.text.indexOf('>', absLt);
            if (closeIdx !== -1 && closeIdx - absLt <= 32) {
              nextLen = closeIdx + 1;
            } else if (absLt > curLen) {
              nextLen = absLt;
            }
          }

          if (nextLen > curLen) {
            streamDisplayedLenRef.current = nextLen;
            streamLastCommitRef.current = now;
            setStreamingState({
              turnIndex: target.turnIndex,
              turnId: target.turnId,
              text: target.text.slice(0, nextLen),
            });
          }
        }

        if (streamDisplayedLenRef.current < target.text.length) {
          streamRafRef.current = requestAnimationFrame(stepStreamPacer);
        } else if (streamDrainResolveRef.current) {
          const resolve = streamDrainResolveRef.current;
          streamDrainResolveRef.current = null;
          if (streamDrainTimerRef.current !== null) {
            window.clearTimeout(streamDrainTimerRef.current);
            streamDrainTimerRef.current = null;
          }
          resolve();
        }
      };

      const ensurePacerRunning = () => {
        if (streamAbortedRef.current || streamRafRef.current !== null) return;
        streamRafRef.current = requestAnimationFrame(stepStreamPacer);
      };

      const result = await executeModelTurn({
        state: workingState,
        turnIndex,
        signal: controller.signal,
        onChunk: (accumulated) => {
          if (streamAbortedRef.current) return;
          streamTargetRef.current = {
            turnIndex,
            turnId: targetTurnId,
            text: accumulated,
          };
          ensurePacerRunning();
        },
        onLog: appendProxyLog,
      });

      // If user already pressed Stop, handleStopGeneration has already cleaned up & saved partial text
      if (streamAbortedRef.current || result.aborted) {
        if (!streamAbortedRef.current) {
          const target = streamTargetRef.current;
          const visibleLen = streamDisplayedLenRef.current;
          const partialText = target
            ? visibleLen > 0
              ? target.text.slice(0, visibleLen)
              : target.text
            : '';
          cancelScheduledStreamFrame();
          streamTargetRef.current = null;
          streamDisplayedLenRef.current = 0;
          streamCarryRef.current = 0;
          streamFastDrainRef.current = false;
          abortControllerRef.current = null;
          setStreamingState(null);
          setIsGenerating(false);
          if (partialText) {
            const cleanPartial = sanitizeCompletedStoryResponse(partialText);
            updateTurnsWithCompanionSync((turns) =>
              turns.map((t) =>
                t.id === targetTurnId
                  ? {
                      ...t,
                      assistant: cleanPartial,
                      ...(partialText !== cleanPartial
                        ? { rawAssistant: partialText }
                        : {}),
                    }
                  : t,
              ),
            );
            window.setTimeout(() => {
              flushPersistNow(stateRef.current, 'turn_partial');
            }, 0);
          }
          setGenStatus({ text: 'Đã dừng', isErr: false });
        }
        return;
      }

      const elapsedMs = Math.max(1, Date.now() - startTs);
      const rawFinalText =
        result.rawText || streamTargetRef.current?.text || result.text || '';
      const finalText = result.ok
        ? sanitizeCompletedStoryResponse(result.text || rawFinalText)
        : result.text || rawFinalText;
      const drainSourceText =
        streamTargetRef.current?.text || rawFinalText || finalText;

      // Gracefully glide through the remaining buffered tail without teleporting
      const remainingTail = drainSourceText.length - streamDisplayedLenRef.current;
      if (
        workingState.streamEnabled &&
        result.ok &&
        drainSourceText &&
        remainingTail > 0 &&
        remainingTail <= 2400 &&
        !document.hidden
      ) {
        streamTargetRef.current = {
          turnIndex,
          turnId: targetTurnId,
          text: drainSourceText,
        };
        streamFastDrainRef.current = true;
        const maxDrainMs = Math.min(
          9000,
          Math.max(1200, Math.ceil((remainingTail / 60) * 1000) + 400),
        );
        await new Promise<void>((resolve) => {
          streamDrainResolveRef.current = resolve;
          streamDrainTimerRef.current = window.setTimeout(() => {
            streamDrainTimerRef.current = null;
            if (streamDrainResolveRef.current === resolve) {
              streamDrainResolveRef.current = null;
              resolve();
            }
          }, maxDrainMs);
          ensurePacerRunning();
        });
        if (streamAbortedRef.current) return;
      }

      cancelScheduledStreamFrame();
      streamTargetRef.current = null;
      streamDisplayedLenRef.current = 0;
      streamCarryRef.current = 0;
      streamFastDrainRef.current = false;
      abortControllerRef.current = null;
      setStreamingState(null);
      setIsGenerating(false);

      // Verify target turn still exists (protect against cross-page overwrite if deleted mid-flight)
      const latest = stateRef.current;
      const resolvedTurnIndex = latest.turns.findIndex(
        (t) => t.id === targetTurnId,
      );
      if (resolvedTurnIndex === -1) {
        setGenStatus({ text: 'Sẵn sàng', isErr: false });
        return;
      }

      // Deterministically advance Story Clock on every completed turn (independent of system wall-clock)
      const activeCompForClock = getActiveCompanionFromState(latest);
      const curClock = normalizeStoryClock(latest.memory?.storyClock);
      let nextStoryClock: StoryClockState = curClock;
      let nextCultivationAfterTurn = latest.memory?.cultivation;
      let turnClockSnapshot: string | undefined;

      const mcNameForBreakthrough =
        activeCompForClock?.mc?.name || latest.player?.name || '';
      const combinedSceneText = `${baseTurn.user || ''}\n${finalText}`;

      if (result.ok && finalText && curClock.enabled) {
        if (curClock.autoAdvance) {
          const clockBase =
            curClock.lastAdvanceReason === 'Chỉnh tay' &&
            curClock.lastTurnIndex !== resolvedTurnIndex
              ? curClock
              : preTurnClock;
          const stepped = advanceStoryClockFromTurn(clockBase, {
            userText: baseTurn.user || '',
            assistantText: finalText,
            turnIndex: resolvedTurnIndex,
            worldHint:
              activeCompForClock?.worldSetting || latest.world?.name || '',
          });
          nextStoryClock = stepped.nextClock;
          turnClockSnapshot = formatStoryClock(nextStoryClock).compactLabel;

          let breakthroughReadyNotice = false;
          let masteryProgressNotice: string[] = [];
          let bottleneckNotice: string[] = [];
          let storyBreakthroughBanner: string | undefined;

          if (latest.memory?.cultivation?.enabled) {
            let previewCult = latest.memory.cultivation;
            if (stepped.deltaMinutes > 0) {
              const previewCalc = applyClockDeltaToCultivation(
                previewCult,
                stepped.deltaMinutes,
                {
                  sceneText: combinedSceneText,
                  reason: stepped.reason,
                },
              );
              previewCult = previewCalc.nextProfile ?? previewCult;
              breakthroughReadyNotice = previewCalc.becameReadyToBreakthrough;
              masteryProgressNotice = previewCalc.masteryProgressNotes;
              bottleneckNotice = [
                ...previewCalc.lockedTechniques,
                ...previewCalc.lockedMoves,
              ];
            }
            let storyConstitutionBanner: string | undefined;
            const btPreview = detectAndSyncStoryBreakthrough(previewCult, {
              userText: baseTurn.user || '',
              assistantText: finalText,
              mcName: mcNameForBreakthrough,
            });
            if (btPreview.synced) {
              previewCult = btPreview.nextProfile;
              storyBreakthroughBanner = btPreview.bannerMessage;
            }
            const constPreview = detectAndSyncStoryConstitutionEvents(previewCult, {
              userText: baseTurn.user || '',
              assistantText: finalText,
              mcName: mcNameForBreakthrough,
            });
            if (constPreview.synced) {
              previewCult = constPreview.nextProfile;
              storyConstitutionBanner = constPreview.bannerMessage;
            }
            nextCultivationAfterTurn = previewCult;

            updateMemoryWithCompanionSync((prev) => {
              let cultUpdated = prev.cultivation;
              if (cultUpdated?.enabled) {
                if (stepped.deltaMinutes > 0) {
                  cultUpdated =
                    applyClockDeltaToCultivation(
                      cultUpdated,
                      stepped.deltaMinutes,
                      {
                        sceneText: combinedSceneText,
                        reason: stepped.reason,
                      },
                    ).nextProfile ?? cultUpdated;
                }
                const btSync = detectAndSyncStoryBreakthrough(cultUpdated, {
                  userText: baseTurn.user || '',
                  assistantText: finalText,
                  mcName: mcNameForBreakthrough,
                });
                if (btSync.synced) {
                  cultUpdated = btSync.nextProfile;
                }
                const constSync = detectAndSyncStoryConstitutionEvents(cultUpdated, {
                  userText: baseTurn.user || '',
                  assistantText: finalText,
                  mcName: mcNameForBreakthrough,
                });
                if (constSync.synced) {
                  cultUpdated = constSync.nextProfile;
                }
              }
              return {
                ...prev,
                storyClock: nextStoryClock,
                cultivation: cultUpdated,
              };
            });

            if (storyBreakthroughBanner) {
              showBanner(storyBreakthroughBanner);
            } else if (storyConstitutionBanner) {
              showBanner(storyConstitutionBanner);
            } else if (breakthroughReadyNotice) {
              showBanner(
                'Đã tích đủ tu vi/nội lực — Sẵn sàng đột phá cảnh giới trong Hồ sơ Tu luyện!',
              );
            } else if (masteryProgressNotice.length > 0) {
              showBanner(
                `Tiến độ tu luyện theo truyện: ${masteryProgressNotice.slice(0, 3).join(' · ')}.`,
              );
            } else if (bottleneckNotice.length > 0) {
              showBanner(
                `Chạm bình cảnh: ${bottleneckNotice.slice(0, 2).join(', ')} — mở Hồ sơ Tu luyện để xem hướng đột phá.`,
              );
            }
          } else {
            updateMemoryWithCompanionSync((prev) => ({
              ...prev,
              storyClock: nextStoryClock,
            }));
          }
        } else {
          turnClockSnapshot = formatStoryClock(curClock).compactLabel;
          // Even when Story Clock autoAdvance is paused, still sync confirmed story realm breakthroughs & constitution evolutions
          if (latest.memory?.cultivation?.enabled) {
            let previewCult = latest.memory.cultivation;
            const btPreview = detectAndSyncStoryBreakthrough(previewCult, {
              userText: baseTurn.user || '',
              assistantText: finalText,
              mcName: mcNameForBreakthrough,
            });
            if (btPreview.synced) {
              previewCult = btPreview.nextProfile;
            }
            const constPreview = detectAndSyncStoryConstitutionEvents(previewCult, {
              userText: baseTurn.user || '',
              assistantText: finalText,
              mcName: mcNameForBreakthrough,
            });
            if (constPreview.synced) {
              previewCult = constPreview.nextProfile;
            }
            if (btPreview.synced || constPreview.synced) {
              nextCultivationAfterTurn = previewCult;
              updateMemoryWithCompanionSync((prev) => {
                if (!prev.cultivation?.enabled) return prev;
                let cultUpdated = prev.cultivation;
                const btSync = detectAndSyncStoryBreakthrough(cultUpdated, {
                  userText: baseTurn.user || '',
                  assistantText: finalText,
                  mcName: mcNameForBreakthrough,
                });
                if (btSync.synced) cultUpdated = btSync.nextProfile;
                const constSync = detectAndSyncStoryConstitutionEvents(cultUpdated, {
                  userText: baseTurn.user || '',
                  assistantText: finalText,
                  mcName: mcNameForBreakthrough,
                });
                if (constSync.synced) cultUpdated = constSync.nextProfile;
                return { ...prev, cultivation: cultUpdated };
              });
              if (btPreview.synced && btPreview.bannerMessage) {
                showBanner(btPreview.bannerMessage);
              } else if (constPreview.synced && constPreview.bannerMessage) {
                showBanner(constPreview.bannerMessage);
              }
            }
          }
        }
      } else if (result.ok && finalText && latest.memory?.cultivation?.enabled) {
        // Even if Story Clock is disabled, honor explicit story-driven training, realm breakthroughs & constitution evolutions
        const combinedLower = combinedSceneText.toLowerCase();
        const practicedAnyNamed = latest.memory.cultivation.techniques.some(
          (t) =>
            (t.name.length >= 3 &&
              combinedLower.includes(t.name.toLowerCase())) ||
            Boolean(
              t.moves?.some(
                (mv) =>
                  mv.name.length >= 3 &&
                  combinedLower.includes(mv.name.toLowerCase()),
              ),
            ),
        );
        let previewCult = latest.memory.cultivation;
        let masteryNotes: string[] = [];
        if (practicedAnyNamed) {
          const previewCalc = applyClockDeltaToCultivation(previewCult, 30, {
            sceneText: combinedSceneText,
            reason: 'Tu luyện theo diễn biến cốt truyện',
            forceActiveTraining: true,
          });
          previewCult = previewCalc.nextProfile ?? previewCult;
          masteryNotes = previewCalc.masteryProgressNotes;
        }
        const btPreview = detectAndSyncStoryBreakthrough(previewCult, {
          userText: baseTurn.user || '',
          assistantText: finalText,
          mcName: mcNameForBreakthrough,
        });
        if (btPreview.synced) {
          previewCult = btPreview.nextProfile;
        }
        const constPreview = detectAndSyncStoryConstitutionEvents(previewCult, {
          userText: baseTurn.user || '',
          assistantText: finalText,
          mcName: mcNameForBreakthrough,
        });
        if (constPreview.synced) {
          previewCult = constPreview.nextProfile;
        }
        if (practicedAnyNamed || btPreview.synced || constPreview.synced) {
          nextCultivationAfterTurn = previewCult;
          updateMemoryWithCompanionSync((prev) => {
            if (!prev.cultivation?.enabled) return prev;
            let cultUpdated = practicedAnyNamed
              ? (applyClockDeltaToCultivation(prev.cultivation, 30, {
                  sceneText: combinedSceneText,
                  reason: 'Tu luyện theo diễn biến cốt truyện',
                  forceActiveTraining: true,
                }).nextProfile ?? prev.cultivation)
              : prev.cultivation;
            const btSync = detectAndSyncStoryBreakthrough(cultUpdated, {
              userText: baseTurn.user || '',
              assistantText: finalText,
              mcName: mcNameForBreakthrough,
            });
            if (btSync.synced) {
              cultUpdated = btSync.nextProfile;
            }
            const constSync = detectAndSyncStoryConstitutionEvents(cultUpdated, {
              userText: baseTurn.user || '',
              assistantText: finalText,
              mcName: mcNameForBreakthrough,
            });
            if (constSync.synced) {
              cultUpdated = constSync.nextProfile;
            }
            return {
              ...prev,
              cultivation: cultUpdated,
            };
          });
          if (btPreview.synced && btPreview.bannerMessage) {
            showBanner(btPreview.bannerMessage);
          } else if (constPreview.synced && constPreview.bannerMessage) {
            showBanner(constPreview.bannerMessage);
          } else if (masteryNotes.length > 0) {
            showBanner(
              `Tiến độ tu luyện theo truyện: ${masteryNotes.slice(0, 3).join(' · ')}.`,
            );
          }
        }
      }

      const extractedBeatPrompts = result.ok
        ? extractStoryImageBeatPrompts(rawFinalText || result.text || '')
        : null;

      const savedRawAssistant =
        rawFinalText && rawFinalText.trim() !== finalText.trim()
          ? rawFinalText
          : undefined;

      if (finalText) {
        updateTurnsWithCompanionSync((turns) =>
          turns.map((t) =>
            t.id === targetTurnId
              ? {
                  ...t,
                  assistant: finalText,
                  ...(savedRawAssistant
                    ? { rawAssistant: savedRawAssistant }
                    : { rawAssistant: undefined }),
                  ...(extractedBeatPrompts
                    ? { storyImagePrompts: extractedBeatPrompts }
                    : {}),
                  ...(result.ok ? { durationMs: elapsedMs } : {}),
                  ...(turnClockSnapshot
                    ? { storyClockSnapshot: turnClockSnapshot }
                    : {}),
                }
              : t,
          ),
        );
      }

      setGenStatus({
        text: result.statusLabel,
        isErr: !result.ok,
      });

      // Auto-generate sequential 3-beat story illustrations (non-blocking) when enabled & ComfyUI/Seedream is configured
      const updatedTurnsSnapshot = finalText
        ? latest.turns.map((t) =>
            t.id === targetTurnId
              ? {
                  ...t,
                  assistant: finalText,
                  ...(savedRawAssistant
                    ? { rawAssistant: savedRawAssistant }
                    : { rawAssistant: undefined }),
                  ...(extractedBeatPrompts
                    ? { storyImagePrompts: extractedBeatPrompts }
                    : {}),
                  ...(result.ok ? { durationMs: elapsedMs } : {}),
                  ...(turnClockSnapshot
                    ? { storyClockSnapshot: turnClockSnapshot }
                    : {}),
                }
              : t,
          )
        : latest.turns;
      const postTurnStateSnapshot: ArkState = {
        ...latest,
        memory: {
          ...(latest.memory || createDefaultMemoryConfig()),
          storyClock: nextStoryClock,
          cultivation: nextCultivationAfterTurn,
        },
        turns: updatedTurnsSnapshot,
      };
      // Immediately persist Auto-Save to IndexedDB + localStorage as soon as a turn completes
      flushPersistNow(postTurnStateSnapshot, 'turn_complete');

      if (
        result.ok &&
        finalText &&
        latest.storyImage?.enabled &&
        latest.storyImage?.autoGenerate &&
        hasImageGeneratorConfigured(latest.config)
      ) {
        void handleGenerateStoryImage(resolvedTurnIndex, {
          ...baseTurn,
          assistant: finalText,
          ...(savedRawAssistant ? { rawAssistant: savedRawAssistant } : {}),
          ...(extractedBeatPrompts
            ? { storyImagePrompts: extractedBeatPrompts }
            : {}),
        });
      }

      // Instant local Long-Term Memory capture (promises, secrets, relationship milestones, key plot events)
      // Works immediately & durably even offline; AI sync below upgrades matching entries when Proxy is configured.
      if (
        result.ok &&
        finalText &&
        latest.memory?.enabled &&
        latest.memory.autoMemory
      ) {
        const activeCompForLocalMem = getActiveCompanionFromState(latest);
        const knownCharNames = Array.from(
          new Set(
            [
              latest.player?.name || '',
              activeCompForLocalMem?.mc?.name || '',
              ...(activeCompForLocalMem?.npcs || []).map((n) => n.name),
              ...(latest.portraitBank?.portraits || []).map((p) => p.name),
            ].filter(Boolean),
          ),
        );
        const localExtracted = extractLocalLongTermMemories({
          userText: stripStoryPlanningAndMeta(baseTurn.user || ''),
          assistantText: stripStoryPlanningAndMeta(finalText),
          turnIndex: resolvedTurnIndex,
          knownCharacterNames: knownCharNames,
        });
        if (localExtracted.length > 0) {
          updateMemoryWithCompanionSync((prev) => {
            const merged = mergeMemoryEntries(
              prev.entries || [],
              localExtracted,
              knownCharNames,
            );
            return compactLongTermMemory(
              { ...prev, entries: merged },
              knownCharNames,
            ).memory;
          });
        }
      }

      // Auto AI Memory, State Tracker & Rolling Summary when enabled & Proxy API is configured
      if (
        result.ok &&
        finalText &&
        latest.memory?.enabled &&
        (latest.config.proxyUrl || '').trim()
      ) {
        const wantMem = Boolean(latest.memory.autoMemory);
        const wantState = Boolean(latest.memory.autoStateTracker);
        if (wantMem || wantState) {
          void handleRunMemorySync(
            resolvedTurnIndex,
            wantMem && wantState ? 'both' : wantMem ? 'memory' : 'state',
            true,
            postTurnStateSnapshot,
          );
        }

        if (latest.memory.autoRollingSummary) {
          const historyWin = Math.max(1, latest.context?.historyTurns || 12);
          const cutoff = Math.max(0, updatedTurnsSnapshot.length - historyWin);
          const alreadyUpTo =
            latest.memory.rollingSummary?.summarizedUpToTurn || 0;
          if (cutoff > alreadyUpTo) {
            void handleRunRollingSummary(false, true, postTurnStateSnapshot);
          }
        }
      }

      // Background auto-portrait generation for appearing characters/NPCs (non-blocking)
      if (
        result.ok &&
        finalText &&
        latest.portraitBank?.autoGenerateOnAppear
      ) {
        void handleRunBackgroundAutoPortraits(resolvedTurnIndex, {
          manual: false,
          stateOverride: postTurnStateSnapshot,
        });
      }
    },
    [
      appendProxyLog,
      cancelScheduledStreamFrame,
      handleGenerateStoryImage,
      handleRunBackgroundAutoPortraits,
      handleRunMemorySync,
      handleRunRollingSummary,
      isGenerating,
      updateMemoryWithCompanionSync,
      updateTurnsWithCompanionSync,
    ],
  );

  const handleStopGeneration = useCallback(
    (skipSavePartial = false) => {
      streamAbortedRef.current = true;
      const target = streamTargetRef.current;
      const visibleLen = streamDisplayedLenRef.current;
      cancelScheduledStreamFrame();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (!skipSavePartial && target && target.text) {
        const savedRaw =
          visibleLen > 0 ? target.text.slice(0, visibleLen) : target.text;
        if (savedRaw) {
          const cleanSaved = sanitizeCompletedStoryResponse(savedRaw);
          updateTurnsWithCompanionSync((turns) =>
            turns.map((t) =>
              t.id === target.turnId
                ? {
                    ...t,
                    assistant: cleanSaved,
                    ...(savedRaw !== cleanSaved ? { rawAssistant: savedRaw } : {}),
                  }
                : t,
            ),
          );
        }
      }
      streamTargetRef.current = null;
      streamDisplayedLenRef.current = 0;
      streamCarryRef.current = 0;
      streamFastDrainRef.current = false;
      setStreamingState(null);
      setIsGenerating(false);
      setGenStatus({ text: 'Đã dừng', isErr: false });
    },
    [cancelScheduledStreamFrame, updateTurnsWithCompanionSync],
  );

  const handleSendNewTurn = useCallback(
    (userText: string) => {
      if (isGenerating) return;
      const attachedList = pendingImages
        .map((img) => img.dataUrl)
        .filter(Boolean)
        .slice(0, MAX_PENDING_CHAT_IMAGES);
      const primaryImgUrl = attachedList[0] || '';
      const caption = imageCaption.trim();

      if (!userText && attachedList.length === 0) {
        showBanner('Hãy nhập nội dung lượt gọi hoặc chọn ảnh trước khi gửi.', 'err');
        return;
      }

      const nowTs = Date.now();
      const newTurn: Turn = {
        id: `turn_${nowTs}_${Math.random().toString(36).slice(2, 6)}`,
        user: userText,
        assistant: '',
        imageData: primaryImgUrl,
        ...(attachedList.length > 1 ? { imageList: attachedList } : {}),
        imageCaption: caption,
        createdAt: nowTs,
      };

      const prev = stateRef.current;
      const nextTurns = ensureUniqueTurnIds([...prev.turns, newTurn]);
      const nextIndex = nextTurns.length - 1;
      const compKey = activeStoryCompanionIdRef.current;
      const nextState: ArkState = {
        ...prev,
        turns: nextTurns,
        currentPage: nextIndex,
        companionStories: compKey
          ? { ...prev.companionStories, [compKey]: nextTurns }
          : prev.companionStories,
      };

      setState(nextState);
      pendingImagesRef.current = [];
      setPendingImages([]);
      setImageCaption('');
      void runModelTurn(nextIndex, nextState);
    },
    [imageCaption, isGenerating, pendingImages, runModelTurn, showBanner],
  );

  const handleRegenerateCurrent = useCallback(() => {
    if (isGenerating || !stateRef.current.turns.length) return;
    const safeIdx = clampPageIndex(
      stateRef.current.currentPage,
      stateRef.current.turns.length,
    );
    void runModelTurn(safeIdx);
  }, [isGenerating, runModelTurn]);

  const handleDeleteTurn = useCallback(
    (turnIndex: number) => {
      const cur = stateRef.current;
      if (turnIndex < 0 || turnIndex >= cur.turns.length) return;
      const targetTurn = cur.turns[turnIndex];
      const targetTurnId = targetTurn?.id || '';
      const pageNum = turnIndex + 1;

      setConfirmDialog({
        open: true,
        title: `Xóa Trang ${pageNum}?`,
        message: `Xóa hoàn toàn Trang ${pageNum} (cả lượt gọi, câu trả lời và ảnh minh họa của trang này), đồng thời đồng bộ lại số trang, ký ức và lịch sử truyện để tránh lệch trang.`,
        confirmLabel: `Xóa Trang ${pageNum}`,
        cancelLabel: 'Hủy',
        confirmTone: 'danger',
        onConfirm: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));

          // Stop any in-flight generation / image / portrait scan so no stale response writes to a shifted page
          if (streamTargetRef.current || abortControllerRef.current) {
            const deletingStreamingTurn =
              streamTargetRef.current?.turnId === targetTurnId ||
              streamTargetRef.current?.turnIndex === turnIndex;
            handleStopGeneration(deletingStreamingTurn);
          }
          if (imageAbortControllerRef.current) {
            handleCancelStoryImage();
          }
          if (bgPortraitAbortRef.current) {
            handleCancelBgPortraits();
          }

          const latest = stateRef.current;
          const exactIdx = targetTurnId
            ? latest.turns.findIndex((t) => t.id === targetTurnId)
            : turnIndex;
          if (exactIdx === -1) return;

          reindexPreClockMapOnDelete(turnPreClockRef.current, exactIdx);
          const { nextState, deletedTurn } = deleteTurnFromState(
            latest,
            exactIdx,
            activeStoryCompanionIdRef.current,
          );
          if (!deletedTurn) return;

          stateRef.current = nextState;
          setState(nextState);
          flushPersistNow(nextState);
          showBanner(
            nextState.turns.length > 0
              ? `Đã xóa Trang ${exactIdx + 1} và đồng bộ lại số trang (${nextState.turns.length} trang còn lại).`
              : `Đã xóa Trang ${exactIdx + 1}. Hiện chưa còn trang truyện nào.`,
          );
        },
        onCancel: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
        },
      });
    },
    [
      flushPersistNow,
      handleCancelBgPortraits,
      handleCancelStoryImage,
      handleStopGeneration,
      showBanner,
    ],
  );

  // Lobby & World Setup actions
  const handleOpenWorldSetup = useCallback(() => {
    goView('setup');
  }, [goView]);

  const handleStartBlankSession = useCallback(() => {
    handleStopGeneration();
    activeStoryCompanionIdRef.current = null;
    turnPreClockRef.current.clear();
    setState((prev) => {
      const activeComp = getActiveCompanionFromState(prev);
      const freshPortraits = syncPortraitBankWithCompanion(
        createDefaultPortraitBank({
          autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
          maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
          includeMcAuto: prev.portraitBank?.includeMcAuto,
        }),
        activeComp,
        prev.player.name,
      );
      return {
        ...prev,
        checkpoint: {
          savedAt: new Date().toISOString(),
          turns: JSON.parse(JSON.stringify(prev.turns)),
          player: { ...prev.player },
          world: { ...prev.world },
          memory: JSON.parse(
            JSON.stringify(prev.memory || createDefaultMemoryConfig()),
          ),
          portraitBank: JSON.parse(
            JSON.stringify(prev.portraitBank || createDefaultPortraitBank()),
          ),
          context: { ...prev.context },
          activeCompanionId: prev.activeCompanionId,
          tawaPreset: JSON.parse(JSON.stringify(prev.tawaPreset)),
        },
        turns: [],
        memory: createDefaultMemoryConfig({
          enabled: prev.memory?.enabled,
          autoMemory: prev.memory?.autoMemory,
          autoStateTracker: prev.memory?.autoStateTracker,
          autoRollingSummary: prev.memory?.autoRollingSummary,
          storyClock: createDefaultStoryClock({
            enabled: prev.memory?.storyClock?.enabled,
            autoAdvance: prev.memory?.storyClock?.autoAdvance,
          }),
        }),
        portraitBank: freshPortraits,
        activeStoryCompanionId: null,
        currentPage: 0,
        activeView: 'chat',
      };
    });
    showBanner(
      'Đã khởi tạo trang truyện trống (có thể Hoàn tác trong mục Dữ liệu nếu cần).',
    );
  }, [handleStopGeneration, showBanner]);

  const handleStartConfiguredWorld = useCallback(
    (payload: WorldSetupPayload) => {
      handleStopGeneration();
      turnPreClockRef.current.clear();

      const prev = stateRef.current;
      const nowTs = Date.now();
      const newProfileId = `world_${nowTs}`;

      const startClock: StoryClockState = normalizeStoryClock({
        enabled: true,
        autoAdvance: payload.startClock.autoAdvance,
        initialized: true,
        year: payload.startClock.year,
        month: payload.startClock.month,
        day: payload.startClock.day,
        hour: payload.startClock.hour,
        minute: payload.startClock.minute,
        eraLabel: payload.startClock.eraLabel || undefined,
        lastAdvanceReason: 'Mốc khởi đầu thế giới',
        updatedAt: nowTs,
      });
      const formattedStartClock = formatStoryClock(startClock);

      const nextPlayer: PlayerInfo = {
        name: payload.mc.name,
        pronoun: payload.mc.pronoun,
        role: payload.mc.role || undefined,
        description: payload.mc.description || undefined,
        absentAtStart: payload.mc.absentAtStart,
      };

      const nextWorld: WorldInfo = {
        name: payload.worldName,
        genre: payload.genre,
        genreLabel: payload.genreLabel,
        setting: payload.setting || undefined,
        rules: payload.rules || undefined,
        atmosphere: payload.atmosphere || undefined,
        dramaLevel: payload.dramaLevel,
        eraLabel: payload.startClock.eraLabel || undefined,
        openingScenario: payload.openingScenario || undefined,
      };

      // Build synchronized profile so NPCs, vivid profiles, blue name badges & Portrait Bank work seamlessly
      const syncedCompanion: CompanionProfile = {
        id: newProfileId,
        name: payload.worldName,
        role: payload.genreLabel,
        sourceQuery: payload.genreLabel,
        sourceContent: '',
        mc: {
          sourceMode: 'custom',
          name: payload.mc.absentAtStart ? '' : payload.mc.name,
          pronoun: payload.mc.absentAtStart ? '' : payload.mc.pronoun,
          roleType: 'custom',
          canonMcName: '',
          originRole: payload.mc.role,
          canonMcRelation: '',
          gender: '',
          age: '',
          personality: payload.mc.description,
          appearance: payload.mc.description,
        },
        worldSetting: payload.setting,
        worldRules: payload.rules,
        npcs: payload.npcs.map((n, idx) => ({
          id: n.id || `npc_${nowTs}_${idx}`,
          name: n.name,
          role: n.role || 'NPC',
          desc: [n.personality, n.appearance].filter(Boolean).join(' · '),
          personality: n.personality || undefined,
          appearance: n.appearance || undefined,
          currentLocation: n.initialLocation?.trim() || undefined,
          privateSecret: n.privateSecret?.trim() || undefined,
          profileManual: Boolean(
            n.personality ||
              n.appearance ||
              n.initialLocation?.trim() ||
              n.privateSecret?.trim(),
          ),
        })),
        canonCandidates: [],
        note: [
          payload.atmosphere ? `Không khí: ${payload.atmosphere}` : '',
          payload.mc.absentAtStart
            ? 'Nhân vật chính chưa có mặt từ đầu — tập trung vào dàn NPC và bối cảnh.'
            : '',
        ]
          .filter(Boolean)
          .join(' | '),
      };

      // Seed Lorebook entries
      const seededEntries: MemoryEntry[] = [
        {
          id: `mem_world_start_${nowTs}`,
          title: `Khởi điểm: ${payload.worldName}`,
          content: [
            `Mốc thời gian bắt đầu: ${formattedStartClock.fullLabel}.`,
            payload.setting || `Thể loại ${payload.genreLabel}.`,
          ]
            .filter(Boolean)
            .join(' '),
          category: 'timeline',
          pinned: true,
          updatedAt: nowTs,
        },
      ];
      if (payload.rules || payload.atmosphere) {
        seededEntries.push({
          id: `mem_world_rules_${nowTs}`,
          title: 'Luật lệ & Không khí thế giới',
          content: [
            payload.atmosphere ? `Không khí: ${payload.atmosphere}.` : '',
            payload.rules,
          ]
            .filter(Boolean)
            .join(' '),
          category: 'detail',
          pinned: true,
          updatedAt: nowTs + 1,
        });
      }

      // Seed initial Character States
      const seededStates: CharacterStateSnapshot[] = [];
      if (payload.syncPortraitsAndStates) {
        if (!payload.mc.absentAtStart && payload.mc.name) {
          seededStates.push({
            id: `st_mc_${nowTs}`,
            name: payload.mc.name,
            isMc: true,
            location: payload.mc.role || payload.worldName,
            mood: 'Bắt đầu hành trình',
            status: payload.mc.description || 'Vừa bước vào bối cảnh mở đầu',
            updatedAt: nowTs,
          });
        }
        payload.npcs.forEach((n, idx) => {
          seededStates.push({
            id: `st_npc_${nowTs}_${idx}`,
            name: n.name,
            isMc: false,
            location: n.initialLocation || payload.worldName,
            mood: n.initialMood || 'Ổn định',
            status: n.role || 'Có mặt trong bối cảnh khởi đầu',
            updatedAt: nowTs + idx + 1,
          });
        });
      }

      const detectedCultKind = detectCultivationSystemKind({
        genre: payload.genre,
        genreLabel: payload.genreLabel,
        worldName: payload.worldName,
        setting: payload.setting,
        rules: payload.rules,
        mcRole: payload.mc.role,
        mcDesc: payload.mc.description,
        openingScenario: payload.openingScenario,
        enableMartialSystem: payload.enableMartialSystem,
      });
      const initialCultivation = detectedCultKind
        ? createStarterCultivationProfile(detectedCultKind, {
            mcRole: payload.mc.role,
            mcDesc: payload.mc.description,
            worldName: payload.worldName,
          })
        : undefined;

      const nextMemory: MemoryManagerConfig = {
        ...createDefaultMemoryConfig({
          enabled: true,
          autoMemory: prev.memory?.autoMemory ?? false,
          autoStateTracker: prev.memory?.autoStateTracker ?? false,
          autoRollingSummary: prev.memory?.autoRollingSummary ?? false,
          storyClock: startClock,
          cultivation: initialCultivation,
        }),
        entries: seededEntries,
        characterStates: seededStates,
      };

      const freshPortraitBase = createDefaultPortraitBank({
        autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
        maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
        includeMcAuto: prev.portraitBank?.includeMcAuto,
      });
      const nextPortraitBank: PortraitBankConfig = payload.syncPortraitsAndStates
        ? syncPortraitBankWithCompanion(
            freshPortraitBase,
            syncedCompanion,
            payload.mc.absentAtStart ? '' : payload.mc.name,
          )
        : freshPortraitBase;

      const entitiesSummary = [
        `Thế giới: ${payload.worldName} (${payload.genreLabel}).`,
        payload.atmosphere ? `Không khí: ${payload.atmosphere}.` : '',
        payload.setting ? `Bối cảnh: ${payload.setting}` : '',
        payload.rules ? `Quy tắc: ${payload.rules}` : '',
        payload.mc.absentAtStart
          ? 'Nhân vật chính không có mặt từ đầu; tập trung vào dàn NPC và bối cảnh.'
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      const nextContext: ContextConfig = {
        ...prev.context,
        entitiesNote: entitiesSummary || prev.context.entitiesNote,
      };

      const checkpoint = {
        savedAt: new Date().toISOString(),
        turns: JSON.parse(JSON.stringify(prev.turns)),
        player: { ...prev.player },
        world: { ...prev.world },
        memory: JSON.parse(
          JSON.stringify(prev.memory || createDefaultMemoryConfig()),
        ),
        portraitBank: JSON.parse(
          JSON.stringify(prev.portraitBank || createDefaultPortraitBank()),
        ),
        context: { ...prev.context },
        activeCompanionId: prev.activeCompanionId,
        tawaPreset: JSON.parse(JSON.stringify(prev.tawaPreset)),
      };

      const wantAiOpening = payload.launchMode === 'ai_opening';
      let initialTurns: Turn[] = [];
      if (wantAiOpening) {
        const openingPrompt = payload.openingScenario
          ? payload.openingScenario
          : [
              `Bắt đầu cảnh mở màn cho thế giới "${payload.worldName}" (${payload.genreLabel}) tại mốc thời gian ${formattedStartClock.fullLabel}.`,
              payload.mc.absentAtStart
                ? 'Hãy mở màn bằng góc nhìn bối cảnh và dàn NPC khởi đầu (chưa có mặt nhân vật chính), không tự sinh thêm NPC ngẫu nhiên ngoài danh sách khi chưa cần.'
                : payload.mc.name
                  ? `Hãy dẫn nhập tự nhiên vào bối cảnh mở đầu, giữ trọng tâm vào nhân vật chính ${payload.mc.name}${payload.npcs.length ? ' và các nhân vật khởi đầu đã thiết lập' : ''}, không tự sinh tràn lan NPC nền ngẫu nhiên.`
                  : 'Hãy dẫn nhập giàu không khí vào khung cảnh mở đầu, giữ trọng tâm gọn gàng và không tự sinh tràn lan NPC nền ngẫu nhiên.',
            ].join(' ');
        initialTurns = [
          {
            id: `turn_${nowTs}`,
            user: openingPrompt,
            assistant: '',
            createdAt: nowTs,
            storyClockSnapshot: formattedStartClock.compactLabel,
          },
        ];
      }

      activeStoryCompanionIdRef.current = newProfileId;
      const nextState: ArkState = {
        ...prev,
        checkpoint,
        player: nextPlayer,
        world: nextWorld,
        context: nextContext,
        companions: [syncedCompanion, ...prev.companions],
        activeCompanionId: newProfileId,
        activeStoryCompanionId: newProfileId,
        companionStories: {
          ...prev.companionStories,
          [newProfileId]: initialTurns,
        },
        companionMemories: {
          ...(prev.companionMemories || {}),
          [newProfileId]: nextMemory,
        },
        companionPortraits: {
          ...(prev.companionPortraits || {}),
          [newProfileId]: nextPortraitBank,
        },
        companionContexts: {
          ...(prev.companionContexts || {}),
          [newProfileId]: nextContext,
        },
        memory: nextMemory,
        portraitBank: nextPortraitBank,
        turns: initialTurns,
        currentPage: 0,
        activeView: 'chat',
      };

      setState(nextState);
      pendingImagesRef.current = [];
      setPendingImages([]);
      setImageCaption('');

      if (wantAiOpening) {
        showBanner(
          `Đã khởi tạo "${payload.worldName}" (${formattedStartClock.compactLabel}) — đang gọi AI viết cảnh mở màn...`,
        );
        void runModelTurn(0, nextState);
      } else {
        showBanner(
          `Đã khởi tạo "${payload.worldName}" · Mốc ${formattedStartClock.compactLabel}${
            payload.npcs.length ? ` · ${payload.npcs.length} NPC` : ''
          } (đã lưu Checkpoint phiên cũ).`,
        );
      }
    },
    [handleStopGeneration, runModelTurn, showBanner],
  );

  const handlePickLobbyBg = useCallback(() => {
    if (stateRef.current.lobbyBgDataUrl) {
      setConfirmDialog({
        open: true,
        title: 'Ảnh nền sảnh chính',
        message:
          'Bạn muốn chọn một ảnh nền mới hay xóa ảnh nền hiện tại để quay về mặc định?',
        confirmLabel: 'Chọn ảnh mới',
        cancelLabel: 'Xóa ảnh nền',
        confirmTone: 'primary',
        onConfirm: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
          if (lobbyBgInputRef.current) {
            lobbyBgInputRef.current.value = '';
            lobbyBgInputRef.current.click();
          }
        },
        onCancel: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
          const oldBg = stateRef.current.lobbyBgDataUrl;
          revokeMediaKey('inline:lobby_bg:active');
          if (isMediaRef(oldBg)) {
            void deleteMediaBlob(extractMediaKey(oldBg));
          }
          setState((prev) => ({ ...prev, lobbyBgDataUrl: '' }));
          showBanner('Đã xóa ảnh nền sảnh về mặc định.');
        },
      });
      return;
    }
    if (lobbyBgInputRef.current) {
      lobbyBgInputRef.current.value = '';
      lobbyBgInputRef.current.click();
    }
  }, [showBanner]);

  const handleLobbyBgFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const oldBg = stateRef.current.lobbyBgDataUrl;
    const bgKey = `lobby_bg:${Date.now()}`;
    void storeBlobInMediaVault(bgKey, file).then((ref) => {
      if (ref) {
        revokeMediaKey('inline:lobby_bg:active');
        if (isMediaRef(oldBg)) {
          void deleteMediaBlob(extractMediaKey(oldBg));
        }
        setState((prev) => ({
          ...prev,
          lobbyBgDataUrl: ref,
        }));
        return;
      }
      // Fallback if IndexedDB is unavailable
      const reader = new FileReader();
      reader.onload = () => {
        revokeMediaKey('inline:lobby_bg:active');
        setState((prev) => ({
          ...prev,
          lobbyBgDataUrl: String(reader.result || ''),
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const appendPendingImages = useCallback(
    (
      incoming: PendingImage[],
      options?: { suggestedCaption?: string; notifyOnAdd?: boolean },
    ) => {
      const validIncoming = incoming
        .filter((item) => Boolean(item?.dataUrl))
        .map((item, idx) => ({
          ...item,
          id:
            item.id ||
            `pimg_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          name: item.name || `anh_${idx + 1}.png`,
        }));
      if (!validIncoming.length) return;

      const currentList = pendingImagesRef.current;
      const remaining = MAX_PENDING_CHAT_IMAGES - currentList.length;
      if (remaining <= 0) {
        showBanner(
          `Tối đa ${MAX_PENDING_CHAT_IMAGES} ảnh mỗi lượt. Hãy xóa bớt ảnh chờ trước khi thêm ảnh mới.`,
          'err',
        );
        return;
      }

      const accepted = validIncoming.slice(0, remaining);
      const overflowCount = validIncoming.length - accepted.length;
      const nextList = [...currentList, ...accepted].slice(
        0,
        MAX_PENDING_CHAT_IMAGES,
      );
      pendingImagesRef.current = nextList;
      setPendingImages(nextList);

      if (options?.suggestedCaption && !imageCaption.trim() && accepted.length > 0) {
        setImageCaption(options.suggestedCaption);
      }

      if (overflowCount > 0) {
        showBanner(
          `Chỉ được gửi tối đa ${MAX_PENDING_CHAT_IMAGES} ảnh mỗi lượt — đã giữ ${accepted.length} ảnh đầu và bỏ qua ${overflowCount} ảnh vượt giới hạn.`,
          'err',
        );
      } else if (options?.notifyOnAdd && accepted.length > 0) {
        showBanner(
          accepted.length === 1
            ? `Đã thêm ảnh "${accepted[0].name}" vào hàng chờ gửi (${nextList.length}/${MAX_PENDING_CHAT_IMAGES}).`
            : `Đã thêm ${accepted.length} ảnh vào hàng chờ gửi (${nextList.length}/${MAX_PENDING_CHAT_IMAGES}).`,
        );
      }
    },
    [imageCaption, showBanner],
  );

  const handleRemovePendingImage = useCallback((index: number) => {
    setPendingImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      pendingImagesRef.current = next;
      if (next.length === 0) {
        setImageCaption('');
      }
      return next;
    });
  }, []);

  const handleClearPendingImages = useCallback(() => {
    pendingImagesRef.current = [];
    setPendingImages([]);
    setImageCaption('');
  }, []);

  // Chat image picker (supports batch selection up to MAX_PENDING_CHAT_IMAGES)
  const handleChatImageFileChange = async (
    ev: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const rawFiles = Array.from(ev.target.files || []);
    ev.target.value = '';
    if (!rawFiles.length) return;

    const imageFiles = rawFiles.filter(
      (file) => !file.type || file.type.startsWith('image/'),
    );
    if (!imageFiles.length) {
      showBanner('Vui lòng chọn tệp hình ảnh hợp lệ.', 'err');
      return;
    }

    const remainingSlots =
      MAX_PENDING_CHAT_IMAGES - pendingImagesRef.current.length;
    if (remainingSlots <= 0) {
      showBanner(
        `Đã đạt tối đa ${MAX_PENDING_CHAT_IMAGES} ảnh mỗi lượt. Hãy xóa bớt ảnh trước khi chọn thêm.`,
        'err',
      );
      return;
    }

    const filesToRead = imageFiles.slice(0, remainingSlots);
    const skippedCount = imageFiles.length - filesToRead.length;

    const readFileAsPending = (
      file: File,
      idx: number,
    ): Promise<PendingImage | null> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          if (!dataUrl) {
            resolve(null);
            return;
          }
          resolve({
            id: `pimg_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            dataUrl,
            name: file.name || `anh_${idx + 1}.png`,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });

    const loaded = (
      await Promise.all(filesToRead.map((f, idx) => readFileAsPending(f, idx)))
    ).filter((item): item is PendingImage => Boolean(item));

    if (!loaded.length) {
      showBanner('Không thể đọc tệp ảnh đã chọn.', 'err');
      return;
    }

    setPendingImages((prev) => {
      const next = [...prev, ...loaded].slice(0, MAX_PENDING_CHAT_IMAGES);
      pendingImagesRef.current = next;
      return next;
    });

    if (skippedCount > 0) {
      showBanner(
        `Chỉ hỗ trợ tối đa ${MAX_PENDING_CHAT_IMAGES} ảnh mỗi lượt — đã thêm ${loaded.length} ảnh đầu và bỏ qua ${skippedCount} ảnh dư.`,
        'err',
      );
    }
  };

  // Save JSON import / slots / backups
  const applyImportedJsonText = useCallback(
    (rawText: string) => {
      if (!rawText) {
        showBanner('Chưa dán nội dung JSON.', 'err');
        return;
      }
      let parsedRes;
      try {
        parsedRes = parseSaveJsonSafe(rawText);
      } catch (e) {
        showBanner(
          `File JSON không hợp lệ: ${e instanceof Error ? e.message : String(e)}`,
          'err',
        );
        return;
      }

      const data = parsedRes.data;
      const savedState =
        data.savedState && typeof data.savedState === 'object'
          ? (data.savedState as Record<string, unknown>)
          : null;
      const root: Record<string, unknown> = savedState
        ? { ...data, ...savedState }
        : data;

      const extracted = ensureUniqueTurnIds(extractTurnsFromObject(data));
      activeStoryCompanionIdRef.current = null;
      turnPreClockRef.current.clear();
      const importedHasCustomContext = Boolean(
        root.context &&
          typeof root.context === 'object' &&
          typeof (root.context as Partial<ContextConfig>).entitiesNote ===
            'string' &&
          !isGenericEntitiesNote(
            (root.context as Partial<ContextConfig>).entitiesNote,
          ),
      );

      setState((prev) => {
        const nextPlayer: PlayerInfo =
          root.player && typeof root.player === 'object'
            ? {
                name: '',
                pronoun: '',
                ...(root.player as Partial<PlayerInfo>),
              }
            : prev.player;
        const nextWorld: WorldInfo =
          root.world && typeof root.world === 'object'
            ? {
                name: '',
                ...(root.world as Partial<WorldInfo>),
              }
            : prev.world;
        const nextConfig =
          root.config && typeof root.config === 'object'
            ? { ...prev.config, ...(root.config as Partial<AppConfig>) }
            : prev.config;
        const nextPreset =
          root.tawaPreset && typeof root.tawaPreset === 'object'
            ? normalizeTawaPreset(root.tawaPreset, prev.tawaPreset)
            : prev.tawaPreset;

        const rawImportedMemory = root.memory
          ? normalizeMemoryConfig(root.memory)
          : createDefaultMemoryConfig({
              enabled: prev.memory?.enabled,
              autoMemory: prev.memory?.autoMemory,
              autoStateTracker: prev.memory?.autoStateTracker,
              autoRollingSummary: prev.memory?.autoRollingSummary,
              storyClock: createDefaultStoryClock({
                enabled: prev.memory?.storyClock?.enabled,
                autoAdvance: prev.memory?.storyClock?.autoAdvance,
              }),
            });
        const importedHasClock = Boolean(
          root.memory &&
            typeof root.memory === 'object' &&
            (root.memory as Record<string, unknown>).storyClock &&
            rawImportedMemory.storyClock?.initialized,
        );
        const nextMemory: MemoryManagerConfig =
          !importedHasClock && extracted.length > 0
            ? {
                ...rawImportedMemory,
                storyClock: inferStoryClockFromLegacyTurns(
                  extracted,
                  nextWorld.name,
                  {
                    enabled: rawImportedMemory.storyClock?.enabled,
                    autoAdvance: rawImportedMemory.storyClock?.autoAdvance,
                  },
                ),
              }
            : rawImportedMemory;

        const activeComp = getActiveCompanionFromState(prev);
        const nextPortraitBank = root.portraitBank
          ? normalizePortraitBank(root.portraitBank)
          : syncPortraitBankWithCompanion(
              createDefaultPortraitBank({
                autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
                maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
                includeMcAuto: prev.portraitBank?.includeMcAuto,
              }),
              activeComp,
              nextPlayer.name,
            );

        const resolvedImportContext = resolveContextForTransition({
          currentContext: prev.context,
          incomingContext:
            root.context && typeof root.context === 'object'
              ? (root.context as Partial<ContextConfig>)
              : null,
          world: nextWorld,
          player: nextPlayer,
          companion: null,
          portraits: nextPortraitBank.portraits,
          memory: nextMemory,
          turns: extracted,
        });
        const nextContext = resolvedImportContext.context;

        const newSlot = {
          id: `slot_${Date.now()}`,
          name: `${nextPlayer.name ? `${nextPlayer.name} — ` : ''}${new Date().toLocaleTimeString(
            'vi-VN',
            { hour12: false },
          )}`,
          savedAt: new Date().toISOString(),
          turns: JSON.parse(JSON.stringify(extracted)),
          player: { ...nextPlayer },
          world: { ...nextWorld },
          memory: JSON.parse(JSON.stringify(nextMemory)),
          portraitBank: JSON.parse(JSON.stringify(nextPortraitBank)),
          context: { ...nextContext },
          tawaPreset: JSON.parse(JSON.stringify(nextPreset)),
        };

        const nextStoryImage: StoryImageConfig =
          root.storyImage && typeof root.storyImage === 'object'
            ? (() => {
                const importedImg = normalizeStoryImageConfig(
                  root.storyImage,
                  prev.storyImage || DEFAULT_STORY_IMAGE_CONFIG,
                );
                const mergedSamples = mergeUserSampleImages(
                  importedImg.sampleImages,
                  prev.storyImage?.sampleImages,
                );
                if (Object.keys(mergedSamples).length > 0) {
                  void saveUserSamplesToVault(mergedSamples);
                }
                return {
                  ...importedImg,
                  sampleImages: mergedSamples,
                };
              })()
            : prev.storyImage;

        const importedCompanionMemories: Record<string, MemoryManagerConfig> = {
          ...(prev.companionMemories || {}),
        };
        if (
          root.companionMemories &&
          typeof root.companionMemories === 'object'
        ) {
          for (const [cid, rawMem] of Object.entries(
            root.companionMemories as Record<string, unknown>,
          )) {
            if (!cid) continue;
            importedCompanionMemories[cid] = normalizeMemoryConfig(rawMem);
          }
        }

        const importedCompanionPortraits: Record<string, PortraitBankConfig> = {
          ...(prev.companionPortraits || {}),
        };
        if (
          root.companionPortraits &&
          typeof root.companionPortraits === 'object'
        ) {
          for (const [cid, rawBank] of Object.entries(
            root.companionPortraits as Record<string, unknown>,
          )) {
            if (!cid) continue;
            importedCompanionPortraits[cid] = normalizePortraitBank(rawBank);
          }
        }

        const importedCompanionContexts: Record<string, ContextConfig> = {
          ...(prev.companionContexts || {}),
        };
        if (
          root.companionContexts &&
          typeof root.companionContexts === 'object'
        ) {
          for (const [cid, rawCtx] of Object.entries(
            root.companionContexts as Record<string, unknown>,
          )) {
            if (!cid) continue;
            importedCompanionContexts[cid] = normalizeContextConfig(
              rawCtx,
              prev.context,
            );
          }
        }

        const importedCompanions: CompanionProfile[] = (() => {
          if (!Array.isArray(root.companions) || !root.companions.length) {
            return prev.companions;
          }
          const normalized = (root.companions as Partial<CompanionProfile>[]).map(
            (c) => normalizeCompanionProfile(c),
          );
          const importedIds = new Set(normalized.map((c) => c.id));
          const keptPrev = (prev.companions || []).filter(
            (c) => !importedIds.has(c.id),
          );
          return [...normalized, ...keptPrev];
        })();

        const importedCompanionStories: Record<string, Turn[]> = {
          ...(prev.companionStories || {}),
        };
        if (
          root.companionStories &&
          typeof root.companionStories === 'object'
        ) {
          for (const [cid, rawTurns] of Object.entries(
            root.companionStories as Record<string, unknown>,
          )) {
            if (!cid || !Array.isArray(rawTurns)) continue;
            importedCompanionStories[cid] = ensureUniqueTurnIds(
              rawTurns as Turn[],
            );
          }
        }

        const importedActiveCompanionId =
          typeof root.activeCompanionId === 'string' &&
          importedCompanions.some((c) => c.id === root.activeCompanionId)
            ? root.activeCompanionId
            : prev.activeCompanionId;

        const importedAnimeJourneyHistory: AnimeJourneyPack[] = (() => {
          const fromFile = normalizeAnimeJourneyHistory(
            root.animeJourneyHistory,
          );
          if (!fromFile.length) return prev.animeJourneyHistory || [];
          let merged = prev.animeJourneyHistory || [];
          for (let i = fromFile.length - 1; i >= 0; i--) {
            merged = upsertAnimeJourneyHistory(merged, fromFile[i]);
          }
          return merged;
        })();

        return {
          ...prev,
          checkpoint: {
            savedAt: new Date().toISOString(),
            turns: JSON.parse(JSON.stringify(prev.turns)),
            player: { ...prev.player },
            world: { ...prev.world },
            memory: JSON.parse(
              JSON.stringify(prev.memory || createDefaultMemoryConfig()),
            ),
            portraitBank: JSON.parse(
              JSON.stringify(prev.portraitBank || createDefaultPortraitBank()),
            ),
            context: { ...prev.context },
            activeCompanionId: prev.activeCompanionId,
            tawaPreset: JSON.parse(JSON.stringify(prev.tawaPreset)),
          },
          player: nextPlayer,
          world: nextWorld,
          config: nextConfig,
          tawaPreset: nextPreset,
          storyImage: nextStoryImage,
          context: nextContext,
          memory: nextMemory,
          companions: importedCompanions,
          activeCompanionId: importedActiveCompanionId,
          companionStories: importedCompanionStories,
          companionMemories: importedCompanionMemories,
          portraitBank: nextPortraitBank,
          companionPortraits: importedCompanionPortraits,
          companionContexts: importedCompanionContexts,
          animeJourneyHistory: importedAnimeJourneyHistory,
          turns: extracted,
          activeStoryCompanionId: null,
          currentPage: extracted.length ? extracted.length - 1 : 0,
          slots: [newSlot, ...prev.slots],
          activeView: 'chat',
        };
      });

      if (extracted.length > 0) {
        const contextHint = importedHasCustomContext
          ? ' · Đã khôi phục Ghi chú thực thể & thế giới từ file save.'
          : ' · Đã tự cập nhật Ghi chú thực thể & thế giới khớp với save.';
        showBanner(
          `Đã nhập thành công ${extracted.length} lượt truyện${
            parsedRes.repaired ? ' (đã tự khép phần đuôi JSON bị cắt dở)' : ''
          }.${contextHint}`,
        );
      } else {
        const keys = Object.keys(data || {}).join(', ');
        showBanner(
          `Đã nạp hồ sơ nhưng tìm thấy 0 lượt truyện (các khóa cấp cao: ${keys}).`,
          'err',
        );
      }
    },
    [showBanner],
  );

  const handleSaveFileChange = async (
    ev: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      applyImportedJsonText(txt);
    } catch {
      const fr = new FileReader();
      fr.onload = () => applyImportedJsonText(String(fr.result || ''));
      fr.readAsText(file, 'utf-8');
    } finally {
      ev.target.value = '';
    }
  };

  const triggerImportSave = useCallback(() => {
    if (saveFileInputRef.current) {
      saveFileInputRef.current.value = '';
      saveFileInputRef.current.click();
    }
  }, []);

  const handleSaveCurrentToSlot = useCallback(() => {
    const cur = stateRef.current;
    const baseMem = cur.memory || createDefaultMemoryConfig();
    const compactedMemory = compactLongTermMemory({
      ...baseMem,
      ...(baseMem.cultivation
        ? { cultivation: normalizeCultivationProfile(baseMem.cultivation) }
        : {}),
    }).memory;
    const cleanedSlotPortraits = cleanJunkPortraitsFromBank(
      cur.portraitBank || createDefaultPortraitBank(),
      getActiveCompanionFromState(cur),
      cur.player?.name,
      buildCultivationNonNpcKeys(compactedMemory.cultivation),
    ).bank;
    const slot = {
      id: `slot_${Date.now()}`,
      name: `${cur.player.name || 'Slot'} (${cur.turns.length} lượt)`,
      savedAt: new Date().toISOString(),
      turns: JSON.parse(JSON.stringify(cur.turns)),
      player: { ...cur.player },
      world: { ...cur.world },
      memory: JSON.parse(JSON.stringify(compactedMemory)),
      portraitBank: JSON.parse(JSON.stringify(cleanedSlotPortraits)),
      context: { ...cur.context },
      tawaPreset: JSON.parse(JSON.stringify(cur.tawaPreset)),
    };
    const nextState: ArkState = {
      ...cur,
      memory: compactedMemory,
      slots: [slot, ...cur.slots],
    };
    stateRef.current = nextState;
    setState(nextState);
    flushPersistNow(nextState, 'slot_save');
    triggerConfirm('save_slot');
    showBanner(`Đã lưu vào slot: ${slot.name} (đã đồng bộ Auto-Save).`);
  }, [flushPersistNow, showBanner, triggerConfirm]);

  const handleDownloadSave = useCallback(
    async (slotIdx?: number) => {
      const cur = stateRef.current;
      const target =
        typeof slotIdx === 'number' && cur.slots[slotIdx]
          ? cur.slots[slotIdx]
          : null;
      const rawTurns = target ? target.turns : cur.turns;
      const hydratedTurns = await hydrateTurnsMediaForExport(rawTurns);
      const rawMem = target?.memory || cur.memory || createDefaultMemoryConfig();
      const compactedMemory = compactLongTermMemory({
        ...rawMem,
        ...(rawMem.cultivation
          ? { cultivation: normalizeCultivationProfile(rawMem.cultivation) }
          : {}),
      }).memory;
      const exportPlayer = target ? target.player : cur.player;
      const exportWorld = target ? target.world : cur.world;
      const exportPortraits = cleanJunkPortraitsFromBank(
        target?.portraitBank || cur.portraitBank || createDefaultPortraitBank(),
        getActiveCompanionFromState(cur),
        exportPlayer?.name,
        buildCultivationNonNpcKeys(compactedMemory.cultivation),
      ).bank;
      const exportContext = target
        ? resolveContextForTransition({
            currentContext: cur.context,
            incomingContext: target.context || null,
            world: exportWorld,
            player: exportPlayer,
            companion: null,
            portraits: exportPortraits?.portraits,
            memory: compactedMemory,
            turns: hydratedTurns,
          }).context
        : cur.context;
      const payload = {
        player: exportPlayer,
        world: exportWorld,
        config: cur.config,
        tawaPreset: target?.tawaPreset || cur.tawaPreset,
        storyImage: cur.storyImage,
        context: exportContext,
        memory: compactedMemory,
        portraitBank: exportPortraits,
        turns: hydratedTurns,
        savedState: { turns: hydratedTurns },
      };
      const safeName = String(payload.player?.name || 'Ark_Lite').replace(
        /[^a-zA-Z0-9_\-À-ɏḀ-ỿ]+/g,
        '_',
      );
      triggerDownloadJson(`ARK_save_${safeName}.json`, payload);
      if (typeof slotIdx !== 'number') {
        const nextMeta = markBackupDownloaded(cur.turns.length);
        setBackupMeta(nextMeta);
      }
      showBanner('Đã tải file Save (.json) kèm trí nhớ dài hạn đã nén gọn.');
    },
    [showBanner],
  );

  const handleDownloadFullBackup = useCallback(async () => {
    setIsQuickBackingUp(true);
    try {
      const cur = stateRef.current;
      const hydratedTurns = await hydrateTurnsMediaForExport(cur.turns);
      const baseMem = cur.memory || createDefaultMemoryConfig();
      const compactedMemory = compactLongTermMemory({
        ...baseMem,
        ...(baseMem.cultivation
          ? { cultivation: normalizeCultivationProfile(baseMem.cultivation) }
          : {}),
      }).memory;
      const compactedCompanionMemories: Record<string, MemoryManagerConfig> = {};
      for (const [cid, mem] of Object.entries(cur.companionMemories || {})) {
        compactedCompanionMemories[cid] = compactLongTermMemory({
          ...mem,
          ...(mem.cultivation
            ? { cultivation: normalizeCultivationProfile(mem.cultivation) }
            : {}),
        }).memory;
      }
      const hydratedSlots = await Promise.all(
        (cur.slots || []).map(async (slot) => ({
          ...slot,
          ...(slot.memory
            ? {
                memory: compactLongTermMemory({
                  ...slot.memory,
                  ...(slot.memory.cultivation
                    ? {
                        cultivation: normalizeCultivationProfile(
                          slot.memory.cultivation,
                        ),
                      }
                    : {}),
                }).memory,
              }
            : {}),
          turns: await hydrateTurnsMediaForExport(slot.turns || []),
        })),
      );
      const hydratedCompanionStories: Record<string, Turn[]> = {};
      for (const [cid, storyTurns] of Object.entries(cur.companionStories || {})) {
        hydratedCompanionStories[cid] = await hydrateTurnsMediaForExport(
          storyTurns || [],
        );
      }
      const now = new Date();
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}-${pad2(now.getMinutes())}`;
      const safeWorld = String(cur.world?.name || cur.player?.name || 'ArkLite')
        .trim()
        .replace(/[^a-zA-Z0-9_\-À-ɏḀ-ỿ]+/g, '_')
        .slice(0, 32);
      triggerDownloadJson(`ARK_backup_${safeWorld || 'session'}_${stamp}.json`, {
        exportedAt: now.toISOString(),
        player: cur.player,
        world: cur.world,
        config: cur.config,
        tawaPreset: cur.tawaPreset,
        storyImage: cur.storyImage,
        context: cur.context,
        memory: compactedMemory,
        companionMemories: compactedCompanionMemories,
        portraitBank: cur.portraitBank,
        companionPortraits: cur.companionPortraits,
        companionContexts: cur.companionContexts || {},
        companions: cur.companions || [],
        activeCompanionId: cur.activeCompanionId,
        companionStories: hydratedCompanionStories,
        animeJourneyHistory: cur.animeJourneyHistory || [],
        turns: hydratedTurns,
        slots: hydratedSlots,
      });
      flushPersistNow(cur, 'manual_backup');
      const nextMeta = markBackupDownloaded(cur.turns.length);
      setBackupMeta(nextMeta);
      showBanner('Đã tải file Backup (.json) an toàn về máy!');
    } finally {
      setIsQuickBackingUp(false);
    }
  }, [flushPersistNow, showBanner]);

  const handleUndoCheckpoint = useCallback(() => {
    const cp = stateRef.current.checkpoint;
    if (!cp) {
      showBanner('Không có checkpoint để hoàn tác.', 'err');
      return;
    }
    activeStoryCompanionIdRef.current = null;
    turnPreClockRef.current.clear();
    const restoredTurns = ensureUniqueTurnIds(
      JSON.parse(JSON.stringify(cp.turns || [])) as Turn[],
    );
    setState((prev) => ({
      ...prev,
      turns: restoredTurns,
      player: cp.player ? { ...cp.player } : prev.player,
      world: cp.world ? { ...cp.world } : prev.world,
      context: cp.context ? { ...cp.context } : prev.context,
      activeCompanionId:
        cp.activeCompanionId &&
        prev.companions.some((c) => c.id === cp.activeCompanionId)
          ? cp.activeCompanionId
          : prev.activeCompanionId,
      activeStoryCompanionId: null,
      memory: cp.memory ? normalizeMemoryConfig(cp.memory) : prev.memory,
      portraitBank: cp.portraitBank
        ? normalizePortraitBank(cp.portraitBank)
        : prev.portraitBank,
      tawaPreset: cp.tawaPreset
        ? normalizeTawaPreset(cp.tawaPreset, prev.tawaPreset)
        : prev.tawaPreset,
      currentPage: Math.max(0, restoredTurns.length - 1),
    }));
    showBanner('Đã hoàn tác về checkpoint trước đó.');
  }, [showBanner]);

  const handleRequestResetClean = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: 'Reset sạch toàn bộ dữ liệu?',
      message:
        'Thao tác này sẽ xóa toàn bộ dữ liệu save, slot, checkpoint, truyện đồng nhân và cấu hình lưu trên trình duyệt để đưa về trạng thái trắng mặc định.',
      confirmLabel: 'Xóa sạch dữ liệu',
      cancelLabel: 'Hủy',
      confirmTone: 'danger',
      onConfirm: () => {
        setConfirmDialog((d) => ({ ...d, open: false }));
        handleStopGeneration(true);
        handleCancelStoryImage();
        handleCancelBgPortraits();
        if (persistTimerRef.current !== null) {
          window.clearTimeout(persistTimerRef.current);
          persistTimerRef.current = null;
        }
        persistDirtyRef.current = false;
        turnPreClockRef.current.clear();
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        void clearAutoSaveFromIndexedDb();
        void clearUserSamplesVault();
        activeStoryCompanionIdRef.current = null;
        pendingImagesRef.current = [];
        setPendingImages([]);
        setImageCaption('');
        setProxyLogs(['Sẵn sàng kiểm tra proxy...']);
        const fresh = createInitialState();
        stateRef.current = fresh;
        setState(fresh);
        const resetMeta = markBackupDownloaded(0);
        setBackupMeta(resetMeta);
        flushPersistNow(fresh, 'reset_clean');
        showBanner('Đã reset sạch toàn bộ dữ liệu về mặc định.');
      },
      onCancel: () => {
        setConfirmDialog((d) => ({ ...d, open: false }));
      },
    });
  }, [
    flushPersistNow,
    handleCancelBgPortraits,
    handleCancelStoryImage,
    handleStopGeneration,
    showBanner,
  ]);

  // Companion handlers
  const handleUpdateActiveCompanion = useCallback(
    (
      updater: (cur: CompanionProfile) => CompanionProfile,
      syncPlayerWorld = false,
    ) => {
      setState((prev) => {
        const current = getActiveCompanionFromState(prev);
        const updated = updater(current);
        const exists = prev.companions.some((c) => c.id === current.id);
        const nextCompanions = exists
          ? prev.companions.map((c) => (c.id === current.id ? updated : c))
          : [updated, ...prev.companions];

        const prevNpcById = new Map(
          (current.npcs || []).map((n) => [n.id, n]),
        );
        const changedNpcIds = new Set<string>();
        for (const n of updated.npcs || []) {
          if (!n.id) continue;
          const prevNpc = prevNpcById.get(n.id);
          if (
            !prevNpc ||
            (prevNpc.name || '') !== (n.name || '') ||
            (prevNpc.role || '') !== (n.role || '') ||
            (prevNpc.age || '') !== (n.age || '') ||
            (prevNpc.birthday || '') !== (n.birthday || '') ||
            (prevNpc.fashionStyle || '') !== (n.fashionStyle || '') ||
            (prevNpc.appearance || '') !== (n.appearance || '') ||
            (prevNpc.personality || '') !== (n.personality || '') ||
            (prevNpc.relationships || '') !== (n.relationships || '') ||
            (prevNpc.signature || '') !== (n.signature || '')
          ) {
            changedNpcIds.add(n.id);
          }
        }

        const syncedPortraits = syncPortraitBankWithCompanion(
          prev.portraitBank || createDefaultPortraitBank(),
          updated,
          updated.mc?.name || prev.player.name,
          prev.memory?.storyClock,
          changedNpcIds.size > 0 ? changedNpcIds : undefined,
        );

        const nextWorldForSync: WorldInfo = {
          ...prev.world,
          name: updated.name || prev.world.name,
          genreLabel: updated.role || prev.world.genreLabel,
          setting: updated.worldSetting || prev.world.setting,
          rules: updated.worldRules || prev.world.rules,
        };
        const nextPlayerForSync: PlayerInfo = {
          ...prev.player,
          name: updated.mc?.name || prev.player.name,
          pronoun: updated.mc?.pronoun || prev.player.pronoun,
          role: updated.mc?.originRole || prev.player.role,
        };
        const suggestedCompNote = buildSuggestedEntitiesNote({
          world: nextWorldForSync,
          player: nextPlayerForSync,
          companion: updated,
          portraits: syncedPortraits.portraits,
          memory: prev.memory,
        });
        const existingCompCtx = (prev.companionContexts || {})[updated.id];
        const shouldRefreshActiveContext =
          syncPlayerWorld &&
          Boolean(suggestedCompNote) &&
          (isGenericEntitiesNote(prev.context.entitiesNote) ||
            detectEntitiesNoteMismatch(
              prev.context.entitiesNote,
              suggestedCompNote,
              {
                world: nextWorldForSync,
                player: nextPlayerForSync,
                companion: updated,
                portraits: syncedPortraits.portraits,
              },
            ).isMismatched);
        const nextCompContext: ContextConfig =
          shouldRefreshActiveContext ||
          !existingCompCtx ||
          isGenericEntitiesNote(existingCompCtx.entitiesNote)
            ? {
                ...(existingCompCtx || prev.context),
                entitiesNote:
                  suggestedCompNote ||
                  existingCompCtx?.entitiesNote ||
                  prev.context.entitiesNote,
              }
            : existingCompCtx;

        return {
          ...prev,
          companions: nextCompanions,
          activeCompanionId: updated.id,
          portraitBank: syncedPortraits,
          companionPortraits: {
            ...(prev.companionPortraits || {}),
            [updated.id]: syncedPortraits,
          },
          companionContexts: {
            ...(prev.companionContexts || {}),
            [updated.id]: nextCompContext,
          },
          ...(syncPlayerWorld
            ? {
                player: nextPlayerForSync,
                world: nextWorldForSync,
                ...(shouldRefreshActiveContext
                  ? { context: nextCompContext }
                  : {}),
              }
            : {}),
        };
      });
    },
    [],
  );

  const handleCreateNewFanficProfile = useCallback(() => {
    const idx = (stateRef.current.companions?.length || 0) + 1;
    const next: CompanionProfile = {
      id: `comp_${Date.now()}`,
      name: `Thế giới đồng nhân ${idx}`,
      role: 'Đồng nhân / AU',
      sourceQuery: '',
      sourceContent: '',
      mc: {
        sourceMode: 'custom',
        name: stateRef.current.player.name || '',
        pronoun: stateRef.current.player.pronoun || '',
        roleType: 'transmigrator',
        canonMcName: '',
        originRole: '',
        canonMcRelation: '',
        gender: 'Nam',
        age: '20',
        personality: '',
        appearance: '',
      },
      worldSetting: '',
      worldRules: '',
      npcs: [],
      canonCandidates: [],
      note: '',
    };
    setState((prev) => {
      const prevCompKey = prev.activeCompanionId || '';
      const updatedMap = prevCompKey
        ? {
            ...(prev.companionPortraits || {}),
            [prevCompKey]: prev.portraitBank || createDefaultPortraitBank(),
          }
        : prev.companionPortraits || {};
      const nextBank = syncPortraitBankWithCompanion(
        createDefaultPortraitBank({
          autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
          maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
          includeMcAuto: prev.portraitBank?.includeMcAuto,
        }),
        next,
        next.mc?.name || prev.player.name,
      );
      return {
        ...prev,
        companions: [next, ...prev.companions],
        activeCompanionId: next.id,
        portraitBank: nextBank,
        companionPortraits: {
          ...updatedMap,
          [next.id]: nextBank,
        },
      };
    });
    showBanner(`Đã tạo hồ sơ Đồng nhân mới #${idx}`);
  }, [showBanner]);

  const handleDeleteFanficProfile = useCallback(
    (id: string) => {
      if (stateRef.current.companions.length <= 1) {
        showBanner('Cần giữ ít nhất 1 hồ sơ đồng nhân.', 'err');
        return;
      }
      setState((prev) => {
        const remaining = prev.companions.filter((c) => c.id !== id);
        const nextActiveId =
          prev.activeCompanionId === id
            ? remaining[0].id
            : prev.activeCompanionId;
        const nextCompPortraits = { ...(prev.companionPortraits || {}) };
        delete nextCompPortraits[id];
        const nextCompContexts = { ...(prev.companionContexts || {}) };
        delete nextCompContexts[id];
        const nextComp =
          remaining.find((c) => c.id === nextActiveId) || remaining[0];
        const nextBank =
          prev.activeCompanionId === id
            ? syncPortraitBankWithCompanion(
                nextCompPortraits[nextActiveId]
                  ? normalizePortraitBank(nextCompPortraits[nextActiveId])
                  : createDefaultPortraitBank({
                      autoGenerateOnAppear:
                        prev.portraitBank?.autoGenerateOnAppear,
                      maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
                      includeMcAuto: prev.portraitBank?.includeMcAuto,
                    }),
                nextComp,
                nextComp?.mc?.name || prev.player.name,
              )
            : prev.portraitBank;
        const nextContextForDelete =
          prev.activeStoryCompanionId === id
            ? resolveContextForTransition({
                currentContext: prev.context,
                incomingContext: nextCompContexts[nextActiveId] || null,
                world: {
                  name: nextComp?.name || prev.world.name,
                  genreLabel: nextComp?.role,
                  setting: nextComp?.worldSetting,
                  rules: nextComp?.worldRules,
                },
                player: {
                  name: nextComp?.mc?.name || prev.player.name,
                  pronoun: nextComp?.mc?.pronoun || prev.player.pronoun,
                  role: nextComp?.mc?.originRole,
                },
                companion: nextComp,
                portraits: nextBank.portraits,
              }).context
            : prev.context;
        return {
          ...prev,
          companions: remaining,
          activeCompanionId: nextActiveId,
          portraitBank: nextBank,
          companionPortraits: nextCompPortraits,
          companionContexts: nextCompContexts,
          context: nextContextForDelete,
        };
      });
    },
    [showBanner],
  );

  const handleImportFanficProfile = useCallback(
    (profile: CompanionProfile) => {
      setState((prev) => {
        const prevCompKey = prev.activeCompanionId || '';
        const updatedMap = prevCompKey
          ? {
              ...(prev.companionPortraits || {}),
              [prevCompKey]: prev.portraitBank || createDefaultPortraitBank(),
            }
          : prev.companionPortraits || {};
        const nextBank = syncPortraitBankWithCompanion(
          createDefaultPortraitBank({
            autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
            maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
            includeMcAuto: prev.portraitBank?.includeMcAuto,
          }),
          profile,
          profile.mc?.name || prev.player.name,
        );
        const importedCompContext = resolveContextForTransition({
          currentContext: prev.context,
          incomingContext: null,
          world: {
            name: profile.name,
            genreLabel: profile.role,
            setting: profile.worldSetting,
            rules: profile.worldRules,
          },
          player: {
            name: profile.mc?.name || '',
            pronoun: profile.mc?.pronoun || '',
            role: profile.mc?.originRole,
          },
          companion: profile,
          portraits: nextBank.portraits,
        }).context;
        return {
          ...prev,
          companions: [profile, ...prev.companions],
          activeCompanionId: profile.id,
          portraitBank: nextBank,
          companionPortraits: {
            ...updatedMap,
            [profile.id]: nextBank,
          },
          companionContexts: {
            ...(prev.companionContexts || {}),
            [profile.id]: importedCompContext,
          },
        };
      });
      showBanner(`Đã nạp hồ sơ Đồng nhân: ${profile.name}`);
    },
    [showBanner],
  );

  const handleSaveAnimeJourneyPack = useCallback((pack: AnimeJourneyPack) => {
    setState((prev) => ({
      ...prev,
      animeJourneyHistory: upsertAnimeJourneyHistory(
        prev.animeJourneyHistory,
        pack,
      ),
    }));
  }, []);

  const handleDeleteAnimeJourneyPack = useCallback((packId: string) => {
    setState((prev) => ({
      ...prev,
      animeJourneyHistory: (prev.animeJourneyHistory || []).filter(
        (item) => item.id !== packId,
      ),
    }));
  }, []);

  const handleEnterCompanionWorld = useCallback(() => {
    const curState = stateRef.current;
    const cur = getActiveCompanionFromState(curState);
    const compKey = cur.id || 'default';
    activeStoryCompanionIdRef.current = compKey;
    turnPreClockRef.current.clear();

    setState((prev) => {
      const checkpoint =
        prev.turns.length > 0
          ? {
              savedAt: new Date().toISOString(),
              turns: JSON.parse(JSON.stringify(prev.turns)),
              player: { ...prev.player },
              world: { ...prev.world },
              memory: JSON.parse(
                JSON.stringify(prev.memory || createDefaultMemoryConfig()),
              ),
              portraitBank: JSON.parse(
                JSON.stringify(
                  prev.portraitBank || createDefaultPortraitBank(),
                ),
              ),
              context: { ...prev.context },
              activeCompanionId: prev.activeCompanionId,
              tawaPreset: JSON.parse(JSON.stringify(prev.tawaPreset)),
            }
          : prev.checkpoint;

      const existingStories = prev.companionStories || {};
      const existingMemories = prev.companionMemories || {};
      const existingPortraits = prev.companionPortraits || {};
      const existingContexts = { ...(prev.companionContexts || {}) };
      if (prev.activeStoryCompanionId) {
        existingContexts[prev.activeStoryCompanionId] = { ...prev.context };
      }
      let storyTurns = existingStories[compKey];

      if (!Array.isArray(storyTurns)) {
        const mcName =
          cur.mc?.name || prev.player.name || 'Nhân vật chính';
        const mcPronoun =
          cur.mc?.pronoun || prev.player.pronoun || 'ta';
        const worldLabel = cur.name || 'Thế giới đồng nhân';
        const settingSummary = cur.worldSetting
          ? cur.worldSetting.trim().slice(0, 220)
          : 'Khung cảnh mở đầu của bản đồng nhân đang bắt đầu.';

        storyTurns = [
          {
            id: `dn_page_${compKey}_${Date.now()}`,
            user: `Bắt đầu hành trình tại ${worldLabel} với nhân vật chính ${mcName} (xưng hô: ${mcPronoun}).`,
            assistant:
              `Trang truyện riêng cho "${worldLabel}" đã được khởi tạo.\n\n` +
              `Nhân vật chính: ${mcName} (${mcPronoun}).\n` +
              `Bối cảnh: ${settingSummary}\n\n` +
              'Bạn có thể nhập lượt gọi đầu tiên ở ô bên dưới để bắt đầu diễn biến mới.',
          },
        ];
      }

      const clonedTurns = ensureUniqueTurnIds(
        JSON.parse(JSON.stringify(storyTurns)) as Turn[],
      );
      const baseCompMemory = existingMemories[compKey]
        ? normalizeMemoryConfig(existingMemories[compKey])
        : createDefaultMemoryConfig({
            enabled: prev.memory?.enabled,
            autoMemory: prev.memory?.autoMemory,
            autoStateTracker: prev.memory?.autoStateTracker,
            autoRollingSummary: prev.memory?.autoRollingSummary,
          });
      let compMemory = baseCompMemory;
      if (!compMemory.cultivation) {
        const compCultKind = detectCultivationSystemKind({
          worldName: cur.name,
          genreLabel: cur.role,
          setting: cur.worldSetting,
          rules: cur.worldRules,
          mcRole: cur.mc?.originRole,
          mcDesc: cur.mc?.appearance,
        });
        if (compCultKind) {
          compMemory = {
            ...compMemory,
            cultivation: createStarterCultivationProfile(compCultKind, {
              mcRole: cur.mc?.originRole,
              mcDesc: cur.mc?.appearance,
              worldName: cur.name,
            }),
          };
        }
      }
      const baseCompPortraits = existingPortraits[compKey]
        ? normalizePortraitBank(existingPortraits[compKey])
        : createDefaultPortraitBank({
            autoGenerateOnAppear: prev.portraitBank?.autoGenerateOnAppear,
            maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
            includeMcAuto: prev.portraitBank?.includeMcAuto,
          });
      const compPortraits = syncPortraitBankWithCompanion(
        baseCompPortraits,
        cur,
        cur.mc?.name || prev.player.name,
      );
      const nextCompPlayer: PlayerInfo = {
        name: cur.mc?.name || prev.player.name,
        pronoun: cur.mc?.pronoun || prev.player.pronoun,
        role: cur.mc?.originRole || undefined,
      };
      const nextCompWorld: WorldInfo = {
        name: cur.name || prev.world.name,
        genreLabel: cur.role || undefined,
        setting: cur.worldSetting || undefined,
        rules: cur.worldRules || undefined,
      };
      const nextCompContext = resolveContextForTransition({
        currentContext: prev.context,
        incomingContext: existingContexts[compKey] || null,
        world: nextCompWorld,
        player: nextCompPlayer,
        companion: cur,
        portraits: compPortraits.portraits,
        memory: compMemory,
        turns: clonedTurns,
      }).context;

      return {
        ...prev,
        checkpoint,
        player: nextCompPlayer,
        world: nextCompWorld,
        context: nextCompContext,
        activeStoryCompanionId: compKey,
        companionStories: {
          ...existingStories,
          [compKey]: clonedTurns,
        },
        companionMemories: {
          ...existingMemories,
          [compKey]: compMemory,
        },
        companionPortraits: {
          ...existingPortraits,
          [compKey]: compPortraits,
        },
        companionContexts: {
          ...existingContexts,
          [compKey]: nextCompContext,
        },
        memory: compMemory,
        portraitBank: compPortraits,
        turns: clonedTurns,
        currentPage: Math.max(0, clonedTurns.length - 1),
        activeView: 'chat',
      };
    });

    showBanner(
      `Đã mở trang truyện riêng cho Đồng nhân: ${
        cur.name || 'Đồng nhân'
      } & tự đồng bộ Ghi chú ngữ cảnh.`,
    );
  }, [showBanner]);

  const isLobby = state.activeView === 'lobby';
  const isSystemConfigView = SYSTEM_CONFIG_VIEWS.includes(state.activeView);
  const isChatView = state.activeView === 'chat';
  const isDataView = state.activeView === 'data';
  const canReturnToStory =
    !isChatView &&
    !isLobby &&
    (hasOpenedStory ||
      state.turns.length > 0 ||
      Boolean(state.activeStoryCompanionId));
  const currentStoryPageDisplay =
    state.turns.length > 0
      ? Math.min(Math.max(0, state.currentPage), state.turns.length - 1) + 1
      : 0;
  const baseQuickMenuItems = isSystemConfigView
    ? SYSTEM_QUICK_MENU_ITEMS
    : SESSION_QUICK_MENU_ITEMS;
  const activeQuickMenuItems = canReturnToStory
    ? [
        {
          id: 'chat' as ViewName,
          label:
            currentStoryPageDisplay > 0
              ? `Quay lại Truyện (Trang ${currentStoryPageDisplay})`
              : 'Quay lại Truyện',
        },
        ...baseQuickMenuItems,
      ]
    : baseQuickMenuItems;
  const effectiveBottomNavItems = canReturnToStory
    ? [
        { id: 'chat' as ViewName, label: 'Truyện', icon: BookOpen },
        ...SYSTEM_BOTTOM_NAV_ITEMS,
      ]
    : SYSTEM_BOTTOM_NAV_ITEMS;
  const isBottomNavHidden = !isSystemConfigView || state.hideBottomNav;
  const showFloatingRestoreNav = isSystemConfigView && state.hideBottomNav;

  return (
    <div className="relative min-h-[100dvh] bg-transparent text-[#ecf2f9]">
      {/* Fixed GPU-composited Oil-Painting Background Layer */}
      <div
        aria-hidden="true"
        className="app-bg-layer pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#0b1220]"
      >
        <img
          src="/assets/aistudio/b05853c8-40e5-45fc-acea-a3a925c12543-3_4b6e2be6.jpg"
          alt=""
          decoding="async"
          loading="eager"
          fetchPriority="high"
          className="h-full w-full object-cover object-center opacity-[0.82] brightness-[0.74] contrast-[0.95] saturate-[0.88]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1322]/66 via-[#0d1626]/60 to-[#09101d]/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_92%_68%_at_50%_36%,transparent_18%,rgba(8,14,26,0.46)_100%)]" />
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={saveFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleSaveFileChange}
      />
      <input
        ref={chatImageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleChatImageFileChange}
      />
      <input
        ref={lobbyBgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLobbyBgFileChange}
      />

      {isLobby ? (
        <div className="relative z-10">
          {banner && (
            <div className="mx-auto max-w-2xl px-4 pt-3.5 sm:px-6">
              <div
                className={`flex items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5 text-xs ring-1 ring-inset ${
                  banner.type === 'err'
                    ? 'bg-[#2a121b]/92 text-rose-100 ring-rose-400/35'
                    : 'bg-[#102236]/92 text-sky-100 ring-sky-400/35'
                }`}
              >
                <span className="leading-relaxed">{banner.text}</span>
                <button
                  type="button"
                  aria-label="Đóng thông báo"
                  onClick={() => setBanner(null)}
                  className="shrink-0 rounded-lg p-1 text-current/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          <LobbyView
            lobbyBgDataUrl={state.lobbyBgDataUrl}
            turnCount={state.turns.length}
            slotCount={state.slots.length}
            cultivationSummary={
              state.memory?.cultivation?.enabled
                ? getCultivationDisplayInfo(state.memory.cultivation).compactLabel
                : undefined
            }
            autoSaveStatus={autoSaveStatus}
            storageHealth={storageHealth}
            turnsSinceLastBackup={Math.max(
              0,
              state.turns.length -
                (state.turns.length >= backupMeta.lastBackupTurnCount
                  ? backupMeta.lastBackupTurnCount
                  : 0),
            )}
            lastBackupAt={backupMeta.lastBackupAt}
            isQuickBackingUp={isQuickBackingUp}
            onStartNewStory={handleOpenWorldSetup}
            onNavigate={goView}
            onPickBg={handlePickLobbyBg}
            onQuickBackup={() => void handleDownloadFullBackup()}
          />
        </div>
      ) : (
        <div
          className="relative z-10 mx-auto w-full max-w-4xl px-3.5 pt-3.5 sm:px-6"
          style={{
            paddingBottom: isBottomNavHidden
              ? '32px'
              : 'calc(var(--nav-h) + var(--safe-b) + 24px)',
          }}
        >
          {/* Topbar */}
          <header
            className={`${
              isChatView ? 'relative' : 'sticky top-2'
            } z-[80] mb-3.5 flex items-center justify-between gap-2.5 overflow-visible rounded-2xl bg-[#141e30]/94 px-3.5 py-2.5 ring-1 ring-white/[0.10] shadow-[0_12px_30px_-16px_rgba(2,8,23,0.75)]`}
          >
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => goView('lobby')}
                aria-label="Ark Lite — Về Sảnh chính"
                title={`Ark Lite — ${VIEW_LABELS[state.activeView]} (Về Sảnh chính)`}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-400/25 via-sky-500/15 to-indigo-500/25 ring-1 ring-inset ring-sky-300/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all hover:from-sky-400/35 hover:to-indigo-500/35 hover:ring-sky-300/50 active:scale-[0.97]"
              >
                <svg
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="block h-full w-full"
                >
                  <defs>
                    <linearGradient
                      id="arkLiteGlyphGrad"
                      x1="6"
                      y1="6"
                      x2="34"
                      y2="34"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="#e0f2fe" />
                      <stop offset="55%" stopColor="#7dd3fc" />
                      <stop offset="100%" stopColor="#a5b4fc" />
                    </linearGradient>
                    <linearGradient
                      id="arkLiteRuleGrad"
                      x1="8"
                      y1="26"
                      x2="32"
                      y2="26"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                      <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M20 5.5L22.2 8.2L20 10.2L17.8 8.2L20 5.5Z"
                    fill="url(#arkLiteGlyphGrad)"
                    fillOpacity="0.92"
                  />
                  <text
                    x="20"
                    y="22.8"
                    textAnchor="middle"
                    fill="url(#arkLiteGlyphGrad)"
                    fontSize="11.5"
                    fontWeight="800"
                    fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
                    letterSpacing="0.5"
                  >
                    ARK
                  </text>
                  <line
                    x1="8"
                    y1="26"
                    x2="32"
                    y2="26"
                    stroke="url(#arkLiteRuleGrad)"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                  <text
                    x="20"
                    y="33.8"
                    textAnchor="middle"
                    fill="#bae6fd"
                    fillOpacity="0.92"
                    fontSize="6.6"
                    fontWeight="700"
                    fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
                    letterSpacing="1.4"
                  >
                    LITE
                  </text>
                </svg>
              </button>
            </div>

            <div
              ref={quickMenuRef}
              className="relative z-[85] flex shrink-0 items-center gap-1.5"
            >
              {!isDataView && (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={quickMenuOpen}
                  onClick={() => setQuickMenuOpen((v) => !v)}
                  className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap ${
                    quickMenuOpen
                      ? 'bg-sky-500/18 text-sky-100 ring-sky-400/38'
                      : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                  }`}
                >
                  <span>Mục</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
                      quickMenuOpen ? 'rotate-180 text-sky-300' : ''
                    }`}
                  />
                </button>
              )}

              {isChatView ? (
                <button
                  type="button"
                  onClick={handleSaveCurrentToSlot}
                  title="Lưu nhanh phiên truyện hiện tại vào Slot"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 hover:text-emerald-100 active:scale-[0.98] whitespace-nowrap"
                >
                  {isConfirmed('save_slot') ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  ) : (
                    <Save className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  )}
                  <span>{isConfirmed('save_slot') ? '✓ Đã lưu' : 'Lưu Slot'}</span>
                </button>
              ) : (
                <>
                  {canReturnToStory && (
                    <button
                      type="button"
                      onClick={() => goView('chat')}
                      title="Quay lại thẳng trang truyện đang đọc (giữ nguyên trang và vị trí cuộn)"
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-sky-500/20 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/40 shadow-[0_6px_16px_-8px_rgba(14,165,233,0.55)] transition-all hover:bg-sky-500/28 hover:text-white active:scale-[0.98] whitespace-nowrap"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                      <span>Quay lại Truyện</span>
                      {currentStoryPageDisplay > 0 && (
                        <span className="hidden rounded-md bg-sky-400/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-200 tabular-nums sm:inline">
                          Tr. {currentStoryPageDisplay}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => goView('lobby')}
                    title="Về Sảnh chính"
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap sm:px-3"
                  >
                    <Home className="h-3.5 w-3.5 text-sky-300" />
                    <span className={canReturnToStory ? 'hidden sm:inline' : ''}>
                      Về Sảnh
                    </span>
                  </button>
                </>
              )}

              {quickMenuOpen && !isDataView && (
                <div
                  role="menu"
                  aria-label="Menu chuyển mục"
                  className="absolute right-0 top-[calc(100%+8px)] z-[90] flex min-w-[196px] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-2xl bg-[#182438]/98 p-1.5 ring-1 ring-white/[0.12] shadow-[0_24px_56px_-10px_rgba(2,6,23,0.9)] backdrop-blur-xl"
                >
                  {activeQuickMenuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => goView(item.id)}
                      className={`min-h-[38px] rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors whitespace-nowrap ${
                        state.activeView === item.id
                          ? 'bg-sky-400/18 text-sky-200'
                          : 'text-slate-200 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          {/* Global Banner */}
          {banner && (
            <div
              className={`mb-3.5 flex items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5 text-xs ring-1 ring-inset ${
                banner.type === 'err'
                  ? 'bg-[#2a121b]/92 text-rose-100 ring-rose-400/35'
                  : 'bg-[#102236]/92 text-sky-100 ring-sky-400/35'
              }`}
            >
              <span className="leading-relaxed">{banner.text}</span>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => setBanner(null)}
                className="shrink-0 rounded-lg p-1 text-current/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Active Screen */}
          <main>
            {state.activeView === 'setup' && (
              <WorldSetupView
                state={state}
                hasProxyConfigured={Boolean(
                  (state.config.proxyUrl || '').trim(),
                )}
                onStartConfiguredWorld={handleStartConfiguredWorld}
                onStartBlankSession={handleStartBlankSession}
                onNavigate={goView}
                onNotify={showBanner}
                onAppendProxyLog={appendProxyLog}
              />
            )}

            {state.activeView === 'chat' && (() => {
              const activeComp = getActiveCompanionFromState(state);
              return (
                <ChatView
                  appState={state}
                  turns={state.turns}
                  currentPage={state.currentPage}
                  streamEnabled={state.streamEnabled}
                  showRawTags={state.showRawTags}
                  showPostMeta={state.showPostMeta}
                  hideBottomNav={state.hideBottomNav}
                  lyricModeEnabled={state.tawaPreset.modules.some(
                    (m) =>
                      Boolean(m?.enabled) &&
                      (m.id === LYRIC_PERFORMANCE_MODULE_ID ||
                        /<lyric_4bar_performance>/i.test(m.content || '')),
                  )}
                  isGenerating={isGenerating}
                  genStatus={genStatus}
                  streamingTurnIndex={streamingState?.turnIndex ?? null}
                  streamingTurnId={streamingState?.turnId ?? null}
                  streamingText={streamingState?.text ?? ''}
                  pendingImages={pendingImages}
                  imageCaption={imageCaption}
                  storyImageConfig={state.storyImage}
                  memoryConfig={state.memory}
                  portraitBank={state.portraitBank}
                  generatingPortraitIds={generatingPortraitIds}
                  portraitProgress={portraitProgress}
                  portraitErrors={portraitErrors}
                  enrichingAppearanceIds={enrichingAppearanceIds}
                  analyzingIdentityIds={analyzingIdentityIds}
                  verifyingReferenceIds={verifyingReferenceIds}
                  verifyingStoryBeatKey={verifyingStoryBeatKey}
                  isEnrichingAppearances={isEnrichingAppearances}
                  bgPortraitStatus={bgPortraitStatus}
                  historyTurns={state.context.historyTurns || 12}
                  hasProxyConfigured={Boolean(
                    (state.config.proxyUrl || '').trim(),
                  )}
                  isSyncingMemory={isSyncingMemory}
                  isSyncingStates={isSyncingStates}
                  isSummarizing={isSummarizing}
                  npcs={activeComp?.npcs || []}
                  activeCompanionName={activeComp?.name || 'Đồng nhân'}
                  mcName={activeComp?.mc?.name || state.player.name || ''}
                  mcPronoun={activeComp?.mc?.pronoun || state.player.pronoun || 'tôi'}
                  mcAbsentAtStart={Boolean(state.player.absentAtStart)}
                  hasSeedreamConfigured={hasImageGeneratorConfigured(
                    state.config,
                  )}
                  isGeneratingImage={isGeneratingImage}
                  generatingImageTurnIdx={generatingImageTurnIdx}
                  generatingImageTurnId={generatingImageTurnId}
                  generatingImageProgress={generatingImageProgress}
                  isGeneratingSuggestions={isGeneratingSuggestions}
                  onRequestAiSuggestions={handleRequestAiSuggestions}
                  onCancelAiSuggestions={handleCancelAiSuggestions}
                  onImageCaptionChange={setImageCaption}
                  onNavigate={goView}
                  onPageChange={(page) => {
                    const prevSnapshot = stateRef.current;
                    const clamped = clampPageIndex(
                      page,
                      prevSnapshot.turns.length,
                    );
                    if (clamped === prevSnapshot.currentPage) return;
                    const nextSnapshot: ArkState = {
                      ...prevSnapshot,
                      currentPage: clamped,
                    };
                    stateRef.current = nextSnapshot;
                    persistDirtyRef.current = true;
                    setState((prev) => {
                      const safeClamped = clampPageIndex(
                        page,
                        prev.turns.length,
                      );
                      return safeClamped === prev.currentPage
                        ? prev
                        : { ...prev, currentPage: safeClamped };
                    });
                  }}
                  onToggleStream={() =>
                    setState((prev) => ({
                      ...prev,
                      streamEnabled: !prev.streamEnabled,
                    }))
                  }
                  onStopGeneration={() => handleStopGeneration(false)}
                  onRegenerateCurrent={handleRegenerateCurrent}
                  onToggleRawTags={() =>
                    setState((prev) => ({
                      ...prev,
                      showRawTags: !prev.showRawTags,
                    }))
                  }
                  onTogglePostMeta={() =>
                    setState((prev) => ({
                      ...prev,
                      showPostMeta: !prev.showPostMeta,
                    }))
                  }
                  onToggleBottomNav={() =>
                    setState((prev) => ({
                      ...prev,
                      hideBottomNav: !prev.hideBottomNav,
                    }))
                  }
                  onToggleLyricMode={() => {
                    const currentMod = state.tawaPreset.modules.find(
                      (m) =>
                        m.id === LYRIC_PERFORMANCE_MODULE_ID ||
                        /<lyric_4bar_performance>/i.test(m.content || ''),
                    );
                    const willEnable = !(currentMod?.enabled ?? false);
                    setState((prev) => {
                      const exists = prev.tawaPreset.modules.some(
                        (m) =>
                          m.id === LYRIC_PERFORMANCE_MODULE_ID ||
                          /<lyric_4bar_performance>/i.test(m.content || ''),
                      );
                      let nextModules = prev.tawaPreset.modules;
                      if (exists) {
                        nextModules = prev.tawaPreset.modules.map((m) =>
                          m.id === LYRIC_PERFORMANCE_MODULE_ID ||
                          /<lyric_4bar_performance>/i.test(m.content || '')
                            ? { ...m, enabled: willEnable }
                            : m,
                        );
                      } else {
                        nextModules = [...prev.tawaPreset.modules];
                        const insertIdx = nextModules.findIndex(
                          (m) =>
                            m.content.trim() === 'Chat History' ||
                            m.content.trim() === '</chathistory>',
                        );
                        const inserted = {
                          ...LYRIC_PERFORMANCE_MODULE,
                          enabled: willEnable,
                        };
                        if (insertIdx >= 0) {
                          nextModules.splice(insertIdx, 0, inserted);
                        } else {
                          nextModules.push(inserted);
                        }
                      }
                      return {
                        ...prev,
                        tawaPreset: {
                          ...prev.tawaPreset,
                          modules: nextModules,
                        },
                      };
                    });
                    showBanner(
                      willEnable
                        ? 'Đã bật mô-đun Lyric 4-Bar (giữ nguyên văn ca từ, NPC diễn theo từng nhịp 4 bar).'
                        : 'Đã tắt mô-đun Lyric 4-Bar.',
                    );
                  }}
                  onUpdateStoryImageConfig={handleUpdateStoryImageConfig}
                  onUpdateMemory={updateMemoryWithCompanionSync}
                  onUpdatePortraitBank={updatePortraitBankWithCompanionSync}
                  onSyncPortraitsFromCompanion={
                    handleSyncPortraitsFromCompanion
                  }
                  onCleanJunkPortraits={handleCleanJunkPortraits}
                  onAutoFillAppearances={() =>
                    void enrichPortraitsAppearances({
                      forceManual: false,
                      silent: false,
                    })
                  }
                  onRefreshPortraitAppearance={(portraitId, force) =>
                    void enrichPortraitsAppearances({
                      portraitIds: [portraitId],
                      forceManual: Boolean(force),
                      silent: !force,
                    })
                  }
                  onGeneratePortrait={(portraitId) =>
                    void handleGenerateSinglePortrait(portraitId)
                  }
                  onPreviewPortraitPrompt={handlePreviewPortraitPrompt}
                  onAnalyzePortraitIdentity={(portraitId, opts) =>
                    void handleAnalyzePortraitIdentity(portraitId, opts)
                  }
                  onVerifyPortraitAgainstReference={(portraitId) =>
                    void handleVerifyPortraitAgainstReference(portraitId)
                  }
                  onVerifyStoryBeatImage={(turnIdx, position) =>
                    void handleVerifyStoryBeatImage(turnIdx, position)
                  }
                  onToggleStoryBeatApplyComparison={
                    handleToggleStoryBeatApplyComparison
                  }
                  onCancelPortrait={handleCancelSinglePortrait}
                  onScanCurrentPagePortraits={(turnIdx) =>
                    void handleRunBackgroundAutoPortraits(turnIdx, {
                      manual: true,
                    })
                  }
                  onCancelBgPortraits={handleCancelBgPortraits}
                  onDismissBgPortraitStatus={() => setBgPortraitStatus(null)}
                  onExtractMemories={(turnIdx) =>
                    void handleRunMemorySync(turnIdx, 'memory')
                  }
                  onExtractStates={(turnIdx) =>
                    void handleRunMemorySync(turnIdx, 'state')
                  }
                  onRunRollingSummary={(forceAllOlder) =>
                    void handleRunRollingSummary(Boolean(forceAllOlder))
                  }
                  onGenerateStoryImage={(turnIdx, position) =>
                    void handleGenerateStoryImage(turnIdx, undefined, position)
                  }
                  onCancelStoryImage={handleCancelStoryImage}
                  onClearTurnStoryImage={handleClearTurnStoryImage}
                  onUpdateTurn={(idx, patch) => {
                    updateTurnsWithCompanionSync((turns) =>
                      turns.map((t, i) =>
                        i === idx
                          ? {
                              ...t,
                              ...patch,
                              ...(Object.prototype.hasOwnProperty.call(
                                patch,
                                'assistant',
                              )
                                ? { rawAssistant: undefined }
                                : {}),
                            }
                          : t,
                      ),
                    );
                    window.setTimeout(() => {
                      flushPersistNow(stateRef.current, 'edit_turn');
                    }, 0);
                  }}
                  onDeleteTurn={handleDeleteTurn}
                  onPickImage={() => {
                    if (pendingImages.length >= MAX_PENDING_CHAT_IMAGES) {
                      showBanner(
                        `Đã đạt tối đa ${MAX_PENDING_CHAT_IMAGES} ảnh mỗi lượt. Hãy xóa bớt ảnh trước khi chọn thêm.`,
                        'err',
                      );
                      return;
                    }
                    if (chatImageInputRef.current) {
                      chatImageInputRef.current.value = '';
                      chatImageInputRef.current.click();
                    }
                  }}
                  onSelectPendingImage={(img, suggestedCaption) => {
                    appendPendingImages([img], {
                      suggestedCaption,
                      notifyOnAdd: true,
                    });
                  }}
                  onRemovePendingImage={handleRemovePendingImage}
                  onClearPendingImages={handleClearPendingImages}
                  onSendTurn={handleSendNewTurn}
                  onDownloadImage={handleDownloadImage}
                  onNotify={showBanner}
                  turnsSinceLastBackup={Math.max(
                    0,
                    state.turns.length -
                      (state.turns.length >= backupMeta.lastBackupTurnCount
                        ? backupMeta.lastBackupTurnCount
                        : 0),
                  )}
                  showBackupReminder={false}
                  isQuickBackingUp={isQuickBackingUp}
                  onQuickBackup={() => void handleDownloadFullBackup()}
                  onDismissBackupReminder={undefined}
                />
              );
            })()}

            {state.activeView === 'config' && (
              <ConfigView
                appState={state}
                config={state.config}
                storyImageConfig={state.storyImage}
                tawaPreset={state.tawaPreset}
                proxyLogs={proxyLogs}
                onAppendProxyLog={appendProxyLog}
                onSaveConfig={({ config, prefill }) => {
                  setState((prev) => ({
                    ...prev,
                    config,
                    tawaPreset: { ...prev.tawaPreset, prefill },
                  }));
                  showBanner(
                    'Đã lưu Cấu hình hệ thống (Proxy API, Prefill, Safety Settings và Seedream 5 Pro).',
                  );
                }}
                onUpdateStoryImageConfig={handleUpdateStoryImageConfig}
                onTogglePrefill={(currentPrefill) => {
                  const nextEnabled = !stateRef.current.tawaPreset.prefillEnabled;
                  setState((prev) => ({
                    ...prev,
                    tawaPreset: {
                      ...prev.tawaPreset,
                      prefillEnabled: nextEnabled,
                      prefill: currentPrefill,
                    },
                  }));
                  showBanner(
                    nextEnabled
                      ? 'Đã BẬT gửi Prefill khi gọi AI.'
                      : 'Đã TẮT gửi Prefill khi gọi AI.',
                  );
                }}
                onResetSafety={() => {
                  setState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      safetySettings: DEFAULT_SAFETY.map((s) => ({ ...s })),
                    },
                  }));
                  showBanner('Đã khôi phục Safety Settings về BLOCK_NONE.');
                }}
                onNotify={showBanner}
                onDownloadImage={handleDownloadImage}
                onAttachSeedreamToChat={(imgUrl, caption) => {
                  appendPendingImages(
                    [
                      {
                        dataUrl: imgUrl,
                        name: `seedream_${Date.now()}.png`,
                      },
                    ],
                    {
                      suggestedCaption: caption,
                      notifyOnAdd: false,
                    },
                  );
                  if (pendingImages.length < MAX_PENDING_CHAT_IMAGES) {
                    showBanner(
                      'Đã gắn ảnh Seedream vào hàng chờ. Quay về Sảnh và bấm "Tiếp tục" để gửi kèm trong lượt truyện.',
                    );
                  }
                }}
              />
            )}

            {state.activeView === 'companion' && (
              <CompanionView
                state={state}
                generatingPortraitIds={generatingPortraitIds}
                portraitProgress={portraitProgress}
                portraitErrors={portraitErrors}
                enrichingAppearanceIds={enrichingAppearanceIds}
                analyzingIdentityIds={analyzingIdentityIds}
                verifyingReferenceIds={verifyingReferenceIds}
                isEnrichingAppearances={isEnrichingAppearances}
                enrichingNpcIds={enrichingNpcIds}
                isEnrichingAllNpcs={isEnrichingAllNpcs}
                bgPortraitStatus={bgPortraitStatus}
                animeJourneyHistory={state.animeJourneyHistory || []}
                onSaveAnimeJourneyPack={handleSaveAnimeJourneyPack}
                onDeleteAnimeJourneyPack={handleDeleteAnimeJourneyPack}
                onUpdateActiveCompanion={handleUpdateActiveCompanion}
                onUpdatePortraitBank={updatePortraitBankWithCompanionSync}
                onSyncPortraitsFromCompanion={handleSyncPortraitsFromCompanion}
                onCleanJunkPortraits={handleCleanJunkPortraits}
                onAutoFillAppearances={() =>
                  void enrichPortraitsAppearances({
                    forceManual: false,
                    silent: false,
                  })
                }
                onRefreshPortraitAppearance={(portraitId, force) =>
                  void enrichPortraitsAppearances({
                    portraitIds: [portraitId],
                    forceManual: Boolean(force),
                    silent: !force,
                  })
                }
                onEnrichNpcProfile={(npcId, force) =>
                  void enrichCompanionNpcs({
                    npcIds: [npcId],
                    forceManual: Boolean(force),
                  })
                }
                onEnrichAllNpcs={() =>
                  void enrichCompanionNpcs({ forceManual: false })
                }
                onGeneratePortrait={(portraitId) =>
                  void handleGenerateSinglePortrait(portraitId)
                }
                onPreviewPortraitPrompt={handlePreviewPortraitPrompt}
                onAnalyzePortraitIdentity={(portraitId, opts) =>
                  void handleAnalyzePortraitIdentity(portraitId, opts)
                }
                onVerifyPortraitAgainstReference={(portraitId) =>
                  void handleVerifyPortraitAgainstReference(portraitId)
                }
                onCancelPortrait={handleCancelSinglePortrait}
                onCancelBgPortraits={handleCancelBgPortraits}
                onDismissBgPortraitStatus={() => setBgPortraitStatus(null)}
                onDownloadImage={handleDownloadImage}
                onSelectCompanion={(id) =>
                  setState((prev) => {
                    const prevCompKey = prev.activeCompanionId || '';
                    const updatedMap = prevCompKey
                      ? {
                          ...(prev.companionPortraits || {}),
                          [prevCompKey]:
                            prev.portraitBank || createDefaultPortraitBank(),
                        }
                      : prev.companionPortraits || {};
                    const nextComp =
                      prev.companions.find((c) => c.id === id) ||
                      prev.companions[0];
                    const nextBase = updatedMap[id]
                      ? normalizePortraitBank(updatedMap[id])
                      : createDefaultPortraitBank({
                          autoGenerateOnAppear:
                            prev.portraitBank?.autoGenerateOnAppear,
                          maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
                          includeMcAuto: prev.portraitBank?.includeMcAuto,
                        });
                    const nextBank = syncPortraitBankWithCompanion(
                      nextBase,
                      nextComp,
                      nextComp?.mc?.name || prev.player.name,
                    );
                    const updatedContexts = {
                      ...(prev.companionContexts || {}),
                    };
                    if (
                      prevCompKey &&
                      prev.activeStoryCompanionId === prevCompKey
                    ) {
                      updatedContexts[prevCompKey] = { ...prev.context };
                    }
                    const nextCompContext =
                      prev.activeStoryCompanionId && nextComp
                        ? resolveContextForTransition({
                            currentContext: prev.context,
                            incomingContext: updatedContexts[id] || null,
                            world: {
                              name: nextComp.name,
                              genreLabel: nextComp.role,
                              setting: nextComp.worldSetting,
                              rules: nextComp.worldRules,
                            },
                            player: {
                              name: nextComp.mc?.name || prev.player.name,
                              pronoun:
                                nextComp.mc?.pronoun || prev.player.pronoun,
                              role: nextComp.mc?.originRole,
                            },
                            companion: nextComp,
                            portraits: nextBank.portraits,
                            memory: (prev.companionMemories || {})[id],
                            turns: (prev.companionStories || {})[id],
                          }).context
                        : prev.context;
                    return {
                      ...prev,
                      activeCompanionId: id,
                      portraitBank: nextBank,
                      companionPortraits: {
                        ...updatedMap,
                        [id]: nextBank,
                      },
                      companionContexts: prev.activeStoryCompanionId
                        ? { ...updatedContexts, [id]: nextCompContext }
                        : updatedContexts,
                      ...(prev.activeStoryCompanionId
                        ? { context: nextCompContext }
                        : {}),
                    };
                  })
                }
                onCreateNewProfile={handleCreateNewFanficProfile}
                onDeleteProfile={handleDeleteFanficProfile}
                onImportProfile={handleImportFanficProfile}
                onEnterCompanionWorld={handleEnterCompanionWorld}
                onNavigate={goView}
                onNotify={showBanner}
              />
            )}

            {state.activeView === 'preset' && (
              <PresetView
                tawaPreset={state.tawaPreset}
                storyImageConfig={state.storyImage}
                onUpdateStoryImageConfig={handleUpdateStoryImageConfig}
                onNotify={showBanner}
                onSavePreset={(modules, prefill, options) => {
                  const prev = stateRef.current;
                  const nextState: ArkState = {
                    ...prev,
                    tawaPreset: {
                      ...prev.tawaPreset,
                      modules,
                      prefill,
                      ...(typeof options?.exclusiveStyleMode === 'boolean'
                        ? { exclusiveStyleMode: options.exclusiveStyleMode }
                        : {}),
                      ...(typeof options?.prefillEnabled === 'boolean'
                        ? { prefillEnabled: options.prefillEnabled }
                        : {}),
                      ...(Array.isArray(options?.deletedEmbeddedIds)
                        ? { deletedEmbeddedIds: options.deletedEmbeddedIds }
                        : {}),
                    },
                  };
                  stateRef.current = nextState;
                  setState(nextState);
                  flushPersistNow(nextState);
                  if (!options?.silent) {
                    showBanner(
                      options?.message || 'Đã lưu chuỗi P&P Preset.',
                    );
                  }
                }}
                onResetDefault={() => {
                  const prev = stateRef.current;
                  const nextState: ArkState = {
                    ...prev,
                    tawaPreset: {
                      ...prev.tawaPreset,
                      modules: createDefaultModules(),
                      prefill: DEFAULT_PREFILL,
                      exclusiveStyleMode: true,
                      deletedEmbeddedIds: [],
                    },
                  };
                  stateRef.current = nextState;
                  setState(nextState);
                  flushPersistNow(nextState);
                  showBanner('Đã khôi phục P&P Preset mặc định.');
                }}
              />
            )}

            {state.activeView === 'context' && (
              <ContextView
                context={state.context}
                memory={state.memory}
                portraitBank={state.portraitBank}
                world={state.world}
                player={state.player}
                activeCompanion={
                  state.activeStoryCompanionId
                    ? state.companions.find(
                        (c) => c.id === state.activeStoryCompanionId,
                      ) || null
                    : null
                }
                turns={state.turns}
                worldGenre={state.world?.genre}
                turnCount={state.turns.length}
                currentPage={state.currentPage}
                hasProxyConfigured={Boolean(
                  (state.config.proxyUrl || '').trim(),
                )}
                isSyncingMemory={isSyncingMemory}
                isSyncingStates={isSyncingStates}
                isSummarizing={isSummarizing}
                onSaveContext={(next: ContextConfig) => {
                  setState((prev) => {
                    const activeKey = resolveActiveStoryCompanionKey(prev);
                    return {
                      ...prev,
                      context: next,
                      ...(activeKey
                        ? {
                            companionContexts: {
                              ...(prev.companionContexts || {}),
                              [activeKey]: { ...next },
                            },
                          }
                        : {}),
                    };
                  });
                  showBanner('Đã lưu cài đặt Ngữ cảnh.');
                }}
                onNavigate={goView}
                onUpdateMemory={updateMemoryWithCompanionSync}
                onUpdatePortraitBank={updatePortraitBankWithCompanionSync}
                onSyncPortraitsFromCompanion={handleSyncPortraitsFromCompanion}
                onExtractMemories={(turnIdx) =>
                  void handleRunMemorySync(turnIdx, 'memory')
                }
                onExtractStates={(turnIdx) =>
                  void handleRunMemorySync(turnIdx, 'state')
                }
                onRunRollingSummary={(forceAllOlder) =>
                  void handleRunRollingSummary(Boolean(forceAllOlder))
                }
              />
            )}

            {state.activeView === 'data' && (
              <DataView
                slots={state.slots}
                turns={state.turns}
                portraits={state.portraitBank.portraits || []}
                currentPage={state.currentPage}
                lobbyBgDataUrl={state.lobbyBgDataUrl}
                hasCheckpoint={Boolean(state.checkpoint)}
                autoSaveStatus={autoSaveStatus}
                storageHealth={storageHealth}
                turnsSinceLastBackup={Math.max(
                  0,
                  state.turns.length -
                    (state.turns.length >= backupMeta.lastBackupTurnCount
                      ? backupMeta.lastBackupTurnCount
                      : 0),
                )}
                lastBackupAt={backupMeta.lastBackupAt}
                isQuickBackingUp={isQuickBackingUp}
                onQuickBackup={() => void handleDownloadFullBackup()}
                onQuickOptimizeMemory={async () => {
                  const cur = stateRef.current;
                  const { revokedCount, freedBytes: revokedBytes } =
                    quickOptimizeMediaMemory(
                      cur.currentPage,
                      QUICK_OPTIMIZE_PAGE_RADIUS,
                    );

                  let offloadedImages = 0;
                  let offloadedBytes = 0;
                  let compactedMemoryEntries = 0;
                  let stateMutated = false;

                  // 1. Offload distant inline images in active turns
                  const { changed, turns: compactedTurns, offloadedCount } =
                    await offloadDistantTurnImagesToVault(
                      cur.turns,
                      cur.currentPage,
                      QUICK_OPTIMIZE_PAGE_RADIUS,
                    );

                  if (changed) {
                    offloadedImages += offloadedCount;
                    const latest = stateRef.current;
                    if (latest.turns.length === compactedTurns.length) {
                      const mergedTurns = latest.turns.map((t, idx) => {
                        const compacted = compactedTurns[idx];
                        if (!compacted || compacted.id !== t.id) return t;
                        if (
                          Math.abs(idx - latest.currentPage) <=
                          QUICK_OPTIMIZE_PAGE_RADIUS
                        ) {
                          return t;
                        }
                        if (
                          compacted.storyImageData === t.storyImageData &&
                          compacted.storyImages === t.storyImages &&
                          compacted.imageData === t.imageData &&
                          compacted.imageList === t.imageList
                        ) {
                          return t;
                        }
                        if (
                          t.storyImageData?.startsWith('data:image/') &&
                          compacted.storyImageData !== t.storyImageData
                        ) {
                          offloadedBytes += t.storyImageData.length;
                        }
                        if (
                          Array.isArray(t.storyImages) &&
                          t.storyImages.length > 0 &&
                          compacted.storyImages !== t.storyImages
                        ) {
                          t.storyImages.forEach((bItem, bIdx) => {
                            if (
                              bItem?.imageData?.startsWith('data:image/') &&
                              bItem.imageData !== t.storyImageData &&
                              compacted.storyImages?.[bIdx]?.imageData !==
                                bItem.imageData
                            ) {
                              offloadedBytes += bItem.imageData.length;
                            }
                          });
                        }
                        if (
                          Array.isArray(t.imageList) &&
                          t.imageList.length > 0 &&
                          compacted.imageList !== t.imageList
                        ) {
                          t.imageList.forEach((src, imgIdx) => {
                            if (
                              src?.startsWith('data:image/') &&
                              compacted.imageList?.[imgIdx] !== src
                            ) {
                              offloadedBytes += src.length;
                            }
                          });
                        } else if (
                          t.imageData?.startsWith('data:image/') &&
                          compacted.imageData !== t.imageData
                        ) {
                          offloadedBytes += t.imageData.length;
                        }
                        return {
                          ...t,
                          storyImageData: compacted.storyImageData,
                          ...(compacted.storyImages
                            ? { storyImages: compacted.storyImages }
                            : {}),
                          imageData: compacted.imageData,
                          ...(compacted.imageList
                            ? { imageList: compacted.imageList }
                            : {}),
                        };
                      });
                      const activeStoryKey =
                        resolveActiveStoryCompanionKey(latest);
                      const nextState: ArkState = {
                        ...latest,
                        turns: mergedTurns,
                        companionStories: activeStoryKey
                          ? {
                              ...latest.companionStories,
                              [activeStoryKey]: mergedTurns,
                            }
                          : latest.companionStories,
                      };
                      stateRef.current = nextState;
                      setState(nextState);
                      stateMutated = true;
                    }
                  }

                  // 2. Offload heavy inline base64 images inside saved Slots
                  const latestBeforeArchives = stateRef.current;
                  let slotsChanged = false;
                  const nextSlots = [...(latestBeforeArchives.slots || [])];
                  for (let sIdx = 0; sIdx < nextSlots.length; sIdx += 1) {
                    const slot = nextSlots[sIdx];
                    if (!slot?.turns?.length) continue;
                    const slotOffload = await offloadArchivedTurnsMediaToVault(
                      slot.turns,
                      `slot_${slot.id || sIdx}`,
                    );
                    if (slotOffload.changed) {
                      slotsChanged = true;
                      offloadedImages += slotOffload.offloadedCount;
                      offloadedBytes += slotOffload.offloadedBytes;
                      nextSlots[sIdx] = { ...slot, turns: slotOffload.turns };
                    }
                  }

                  // 3. Offload heavy inline base64 images inside inactive Companion Stories
                  const activeStoryKeyNow =
                    resolveActiveStoryCompanionKey(latestBeforeArchives);
                  let compStoriesChanged = false;
                  const nextCompStories: Record<string, Turn[]> = {
                    ...(latestBeforeArchives.companionStories || {}),
                  };
                  for (const [cid, storyTurns] of Object.entries(nextCompStories)) {
                    if (cid === activeStoryKeyNow || !storyTurns?.length) continue;
                    const compOffload = await offloadArchivedTurnsMediaToVault(
                      storyTurns,
                      `comp_${cid}`,
                    );
                    if (compOffload.changed) {
                      compStoriesChanged = true;
                      offloadedImages += compOffload.offloadedCount;
                      offloadedBytes += compOffload.offloadedBytes;
                      nextCompStories[cid] = compOffload.turns;
                    }
                  }

                  // 4. Compact long-term memory duplicates & oversized text entries
                  const memCompact = compactLongTermMemory(
                    latestBeforeArchives.memory || createDefaultMemoryConfig(),
                  );
                  const memoryChanged =
                    memCompact.removedDuplicates > 0 ||
                    memCompact.compactedCount > 0 ||
                    memCompact.prunedStates > 0;
                  if (memoryChanged) {
                    compactedMemoryEntries =
                      memCompact.removedDuplicates +
                      memCompact.compactedCount +
                      memCompact.prunedStates;
                    offloadedBytes += memCompact.savedBytes;
                  }

                  if (slotsChanged || compStoriesChanged || memoryChanged) {
                    const curLatest = stateRef.current;
                    const mergedArchiveState: ArkState = {
                      ...curLatest,
                      ...(slotsChanged ? { slots: nextSlots } : {}),
                      ...(compStoriesChanged
                        ? { companionStories: nextCompStories }
                        : {}),
                      ...(memoryChanged ? { memory: memCompact.memory } : {}),
                    };
                    stateRef.current = mergedArchiveState;
                    setState(mergedArchiveState);
                    stateMutated = true;
                  }

                  // 5. Offload inline lobby background data URL if present
                  const latestBg = stateRef.current.lobbyBgDataUrl;
                  if (latestBg && latestBg.startsWith('data:image/')) {
                    const bgKey = `lobby_bg:${Date.now()}`;
                    const ref = await storeDataUrlInMediaVault(bgKey, latestBg);
                    if (ref) {
                      revokeMediaKey('inline:lobby_bg:active');
                      revokeMediaKey(bgKey);
                      offloadedImages += 1;
                      offloadedBytes += latestBg.length;
                      const updatedBgState: ArkState = {
                        ...stateRef.current,
                        lobbyBgDataUrl: ref,
                      };
                      stateRef.current = updatedBgState;
                      setState(updatedBgState);
                      stateMutated = true;
                    }
                  }

                  // 6. Safely prune unreferenced orphan blobs from IndexedDB Media Vault
                  const liveKeys = collectReferencedMediaKeys(stateRef.current);
                  const { deletedCount: prunedOrphanBlobs, freedBytes: orphanBytes } =
                    await pruneOrphanedMediaBlobs(liveKeys);

                  if (stateMutated || prunedOrphanBlobs > 0) {
                    flushPersistNow(stateRef.current, 'quick_optimize');
                  }

                  const refreshedHealth = await detectStorageHealth({
                    hadLocalStorageData: true,
                    hadIdbAutoSave: true,
                    quotaWarning: false,
                    tieredActive: true,
                  });
                  lastQuotaWarnRef.current = refreshedHealth.quotaWarning;
                  setStorageHealth(refreshedHealth);

                  return {
                    revokedUrls: revokedCount,
                    offloadedImages,
                    freedBytes: revokedBytes + offloadedBytes + orphanBytes,
                    prunedOrphanBlobs,
                    compactedMemoryEntries,
                  };
                }}
                onTriggerImport={triggerImportSave}
                onImportJsonText={applyImportedJsonText}
                onSaveSlot={handleSaveCurrentToSlot}
                onDownloadSave={handleDownloadSave}
                onDownloadFullBackup={handleDownloadFullBackup}
                onUndoCheckpoint={handleUndoCheckpoint}
                onRequestResetClean={handleRequestResetClean}
                onLoadSlot={(idx) => {
                  const s = stateRef.current.slots[idx];
                  if (!s) return;
                  activeStoryCompanionIdRef.current = null;
                  turnPreClockRef.current.clear();
                  const loadedTurns = ensureUniqueTurnIds(
                    JSON.parse(JSON.stringify(s.turns || [])) as Turn[],
                  );
                  const slotHasCustomContext = Boolean(
                    s.context &&
                      typeof s.context.entitiesNote === 'string' &&
                      !isGenericEntitiesNote(s.context.entitiesNote),
                  );
                  setState((prev) => {
                    const nextPlayer: PlayerInfo = s.player
                      ? { ...s.player }
                      : prev.player;
                    const nextWorld: WorldInfo = s.world
                      ? { ...s.world }
                      : prev.world;
                    const nextMemory = s.memory
                      ? normalizeMemoryConfig(s.memory)
                      : createDefaultMemoryConfig({
                          enabled: prev.memory?.enabled,
                          autoMemory: prev.memory?.autoMemory,
                          autoStateTracker: prev.memory?.autoStateTracker,
                          autoRollingSummary: prev.memory?.autoRollingSummary,
                        });
                    const activeComp = getActiveCompanionFromState(prev);
                    const nextPortraits = s.portraitBank
                      ? normalizePortraitBank(s.portraitBank)
                      : syncPortraitBankWithCompanion(
                          createDefaultPortraitBank({
                            autoGenerateOnAppear:
                              prev.portraitBank?.autoGenerateOnAppear,
                            maxAutoPerTurn: prev.portraitBank?.maxAutoPerTurn,
                            includeMcAuto: prev.portraitBank?.includeMcAuto,
                          }),
                          activeComp,
                          nextPlayer.name,
                        );
                    const resolvedSlotContext = resolveContextForTransition({
                      currentContext: prev.context,
                      incomingContext: s.context || null,
                      world: nextWorld,
                      player: nextPlayer,
                      companion: null,
                      portraits: nextPortraits.portraits,
                      memory: nextMemory,
                      turns: loadedTurns,
                    });
                    return {
                      ...prev,
                      turns: loadedTurns,
                      activeStoryCompanionId: null,
                      player: nextPlayer,
                      world: nextWorld,
                      context: resolvedSlotContext.context,
                      memory: nextMemory,
                      portraitBank: nextPortraits,
                      tawaPreset: s.tawaPreset
                        ? normalizeTawaPreset(s.tawaPreset, prev.tawaPreset)
                        : prev.tawaPreset,
                      currentPage: Math.max(0, loadedTurns.length - 1),
                      activeView: 'chat',
                    };
                  });
                  showBanner(
                    `Đã nạp slot "${s.name || 'Save'}"${
                      slotHasCustomContext
                        ? ' · Đã khôi phục Ghi chú ngữ cảnh của slot.'
                        : ' · Đã tự cập nhật Ghi chú thực thể & thế giới khớp bối cảnh.'
                    }`,
                  );
                }}
                onCloneSlot={(idx) => {
                  setState((prev) => {
                    const s = prev.slots[idx];
                    if (!s) return prev;
                    const cloned = {
                      ...JSON.parse(JSON.stringify(s)),
                      id: `slot_${Date.now()}`,
                      name: `${s.name || 'Slot'} (Bản sao)`,
                      savedAt: new Date().toISOString(),
                    };
                    const nextSlots = [...prev.slots];
                    nextSlots.splice(idx + 1, 0, cloned);
                    return { ...prev, slots: nextSlots };
                  });
                }}
                onDeleteSlot={(idx) => {
                  const nextState: ArkState = {
                    ...stateRef.current,
                    slots: stateRef.current.slots.filter((_, i) => i !== idx),
                  };
                  stateRef.current = nextState;
                  setState(nextState);
                  flushPersistNow(nextState);
                }}
              />
            )}
          </main>
        </div>
      )}

      {/* Floating Restore Bottom Nav Button */}
      {showFloatingRestoreNav && (
        <button
          type="button"
          onClick={() =>
            setState((prev) => ({ ...prev, hideBottomNav: false }))
          }
          className="fixed right-3.5 z-40 min-h-[38px] rounded-xl bg-[#162236]/95 px-3.5 text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/35 shadow-[0_12px_28px_-8px_rgba(2,6,23,0.72)] transition-all hover:bg-[#1e2d46] active:scale-[0.98]"
          style={{ bottom: 'calc(14px + var(--safe-b))' }}
        >
          Hiện thanh mục
        </button>
      )}

      {/* Fixed Bottom Navigation (System Config Tabs Only) */}
      {!isBottomNavHidden && (
        <nav
          aria-label="Điều hướng cấu hình hệ thống"
          className={`fixed left-0 right-0 z-40 grid ${
            effectiveBottomNavItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
          } border-t border-white/[0.10] bg-[#101827]/95 px-1.5 pt-1.5 shadow-[0_-10px_30px_-14px_rgba(2,6,23,0.78)]`}
          style={{
            bottom: `${navBottomOffset}px`,
            height: 'calc(var(--nav-h) + var(--safe-b))',
            paddingBottom: 'var(--safe-b)',
          }}
        >
          {effectiveBottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = state.activeView === item.id;
            const isReturnStoryItem = item.id === 'chat';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goView(item.id)}
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold transition-all ${
                  active
                    ? 'bg-sky-400/14 text-sky-300'
                    : isReturnStoryItem
                      ? 'bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 hover:text-white'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active || isReturnStoryItem ? 'text-sky-300' : ''
                  }`}
                />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Cross-platform Mobile / Fallback Image Save Modal */}
      <ImageSaveModal
        payload={imageSaveFallback}
        onClose={closeImageSaveFallback}
        onNotify={showBanner}
      />

      {/* In-app Confirmation Modal */}
      <ConfirmModal
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        confirmTone={confirmDialog.confirmTone}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        onDismiss={() => setConfirmDialog((d) => ({ ...d, open: false }))}
      />
    </div>
  );
}
