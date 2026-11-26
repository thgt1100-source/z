import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderCog,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import {
  isHapticSupported,
  triggerHapticFeedback,
  useActionConfirmFeedback,
} from '../utils/touchFeedback';
import {
  getImageProviderLabel,
  type AiTaskModelSlots,
  type AiTaskSlotId,
  type ApiProtocol,
  type AppConfig,
  type ArkState,
  type ComfyUiNodeMapping,
  type ComfyUiWorkflowPreset,
  type CustomImageFormatMode,
  type ImageProvider,
  type StoryImageConfig,
  type TawaPreset,
} from '../types/ark';
import {
  CHAT_IMAGE_MAX_DIMENSION_OPTIONS,
  CHAT_IMAGE_MAX_INPUT_MB_OPTIONS,
  CHAT_IMAGE_QUALITY_OPTIONS,
  clampChatImageMaxDimension,
  clampChatImageMaxInputMb,
  clampChatImageQuality,
} from '../utils/chatImageUpload';
import {
  AI_TASK_SLOT_META,
  AI_TASK_SLOT_ORDER,
  analyzeComfyUiWorkflowJson,
  applyImageStyleVariables,
  buildEndpointCandidates,
  buildModelListEndpointCandidates,
  buildSeedreamEndpoints,
  buildSeedreamModelEndpoints,
  COMFYUI_REQUEST_TIMEOUT_MS,
  createTimedAbortSignal,
  CUSTOM_IMAGE_REQUEST_TIMEOUT_MS,
  DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE,
  DEFAULT_PROXY_MODEL,
  detectIsGeminiProtocol,
  fetchProxyTarget,
  formatSeedreamFetchError,
  HAS_ANY_IMAGE_TEMPLATE_VAR_RE,
  LATENT_ASPECT_RATIOS,
  LATENT_DEFAULT_ENDPOINT,
  LATENT_HOADO_SAMPLE_PRESET,
  LATENT_KEYS_DASHBOARD_URL,
  LATENT_MODEL_PRESETS,
  LATENT_REQUEST_TIMEOUT_MS,
  LATENT_SAMPLER_OPTIONS,
  normalizeCustomImageEndpointUrl,
  normalizeLatentEndpointUrl,
  normalizeProxyBaseUrl,
  previewStoryImagePrompt,
  renderCustomImageJsonPayload,
  requestComfyUiImage,
  requestCustomImage,
  requestLatentImage,
  requestSeedreamImage,
  resolveModelForTask,
  resolveStoryImageStyle,
  SEEDREAM_REQUEST_TIMEOUT_MS,
  shouldUseServerProxy,
  testComfyUiConnection,
} from '../utils/api';
import {
  DEFAULT_LATENT_MODEL,
  DEFAULT_LATENT_NEGATIVE_PROMPT,
  DEFAULT_LATENT_NOISE_SCHEDULE,
  DEFAULT_LATENT_POSITIVE_PREFIX,
  DEFAULT_LATENT_SAMPLER,
  DEFAULT_LATENT_SCALE,
  DEFAULT_LATENT_SIZE,
  DEFAULT_LATENT_STEPS,
  DEFAULT_SAFETY,
} from '../utils/storage';
import {
  collectAllAvailablePortraits,
  mergeStoryImageNegativePrompt,
} from '../utils/imageStyles';
import {
  stripResidualVietnameseFromEnglishClause,
  translateVietnameseVisualToEnglish,
} from '../utils/imagePromptComposer';
import { ImagePromptTemplatePanel } from './ImagePromptTemplatePanel';
import { ImageStylePicker } from './ImageStylePicker';
import { ComfyWorkflowManagerModal } from './ComfyWorkflowManagerModal';

interface ConfigViewProps {
  appState: ArkState;
  config: AppConfig;
  storyImageConfig: StoryImageConfig;
  tawaPreset: TawaPreset;
  proxyLogs: string[];
  onAppendProxyLog: (line: string) => void;
  onSaveConfig: (payload: {
    config: AppConfig;
    prefill: string;
  }) => void;
  onUpdateStoryImageConfig: (
    patch:
      | Partial<StoryImageConfig>
      | ((prev: StoryImageConfig) => Partial<StoryImageConfig>),
  ) => void;
  onTogglePrefill: (currentPrefill: string) => void;
  onResetSafety: () => void;
  onNotify: (msg: string, type?: 'info' | 'err') => void;
  onDownloadImage: (imgSrc: string, filename: string) => void;
  onAttachSeedreamToChat: (imgUrl: string, caption: string) => void;
}

export function ConfigView({
  appState,
  config,
  storyImageConfig,
  tawaPreset,
  proxyLogs,
  onAppendProxyLog,
  onSaveConfig,
  onUpdateStoryImageConfig,
  onTogglePrefill,
  onResetSafety,
  onNotify,
  onDownloadImage,
  onAttachSeedreamToChat,
}: ConfigViewProps) {
  const [proxyUrl, setProxyUrl] = useState(config.proxyUrl || '');
  const [proxyKey, setProxyKey] = useState(config.proxyKey || '');
  const [showProxyKey, setShowProxyKey] = useState(false);
  const [model, setModel] = useState(config.model || '');
  const [taskModels, setTaskModels] = useState<AiTaskModelSlots>(
    config.taskModels || {},
  );
  const [apiProtocol, setApiProtocol] = useState<ApiProtocol>(
    config.apiProtocol || 'openai',
  );
  const [useServerProxy, setUseServerProxy] = useState<boolean>(
    shouldUseServerProxy(config),
  );
  const [hapticFeedbackEnabled, setHapticFeedbackEnabled] = useState<boolean>(
    config.hapticFeedbackEnabled !== false,
  );
  const [autoStoryBeatsEnabled, setAutoStoryBeatsEnabled] = useState<boolean>(
    config.autoStoryBeatsEnabled !== false,
  );
  const [chatImageMaxInputMb, setChatImageMaxInputMb] = useState<number>(() =>
    clampChatImageMaxInputMb(config.chatImageMaxInputMb),
  );
  const [chatImageMaxDimension, setChatImageMaxDimension] = useState<number>(
    () => clampChatImageMaxDimension(config.chatImageMaxDimension),
  );
  const [chatImageQuality, setChatImageQuality] = useState<number>(() =>
    clampChatImageQuality(config.chatImageQuality),
  );
  const [chatImageAutoClearAfterReply, setChatImageAutoClearAfterReply] =
    useState<boolean>(config.chatImageAutoClearAfterReply !== false);
  const [proxyQuickSwitchHint, setProxyQuickSwitchHint] = useState<
    'switch_direct' | 'switch_server_proxy' | null
  >(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);

  const [safeSex, setSafeSex] = useState(
    config.safetySettings?.[0]?.threshold || 'BLOCK_NONE',
  );
  const [safeHate, setSafeHate] = useState(
    config.safetySettings?.[1]?.threshold || 'BLOCK_NONE',
  );
  const [safeHarass, setSafeHarass] = useState(
    config.safetySettings?.[2]?.threshold || 'BLOCK_NONE',
  );
  const [safeDanger, setSafeDanger] = useState(
    config.safetySettings?.[3]?.threshold || 'BLOCK_NONE',
  );

  const [prefill, setPrefill] = useState(tawaPreset.prefill || '');

  const [imageProvider, setImageProvider] = useState<ImageProvider>(
    config.imageProvider === 'comfyui'
      ? 'comfyui'
      : config.imageProvider === 'custom'
        ? 'custom'
        : config.imageProvider === 'latent'
          ? 'latent'
          : 'seedream',
  );
  const [seedreamUrl, setSeedreamUrl] = useState(config.seedreamUrl || '');
  const [seedreamApiKey, setSeedreamApiKey] = useState(
    config.seedreamApiKey || '',
  );
  const [showSeedreamKey, setShowSeedreamKey] = useState(false);
  const [seedreamModel, setSeedreamModel] = useState(
    config.seedreamModel || 'seedream-5.0-pro',
  );
  const [seedreamSize, setSeedreamSize] = useState(
    config.seedreamSize || '1024x1024',
  );
  const [seedreamPrompt, setSeedreamPrompt] = useState(
    config.seedreamPrompt || '',
  );
  const [customImageUrl, setCustomImageUrl] = useState(
    config.customImageUrl || '',
  );
  const [customImageApiKey, setCustomImageApiKey] = useState(
    config.customImageApiKey || '',
  );
  const [showCustomImageKey, setShowCustomImageKey] = useState(false);
  const [customImageAuthHeader, setCustomImageAuthHeader] = useState(
    config.customImageAuthHeader || 'Authorization',
  );
  const [customImageModel, setCustomImageModel] = useState(
    config.customImageModel || '',
  );
  const [customImageFormatMode, setCustomImageFormatMode] =
    useState<CustomImageFormatMode>(
      config.customImageFormatMode === 'custom_json' ? 'custom_json' : 'openai',
    );
  const [customImageJsonTemplate, setCustomImageJsonTemplate] = useState(
    config.customImageJsonTemplate || DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE,
  );
  const [customImageNegativePrompt, setCustomImageNegativePrompt] = useState(
    config.customImageNegativePrompt || '',
  );
  const [customImageUseServerProxy, setCustomImageUseServerProxy] = useState(
    config.customImageUseServerProxy !== false,
  );
  const [customImageTestFeedback, setCustomImageTestFeedback] = useState<{
    ok: boolean;
    title: string;
    detail?: string;
    suggestDirectFetch?: boolean;
    suggestServerProxy?: boolean;
  } | null>(null);
  const [latentUrl, setLatentUrl] = useState(() =>
    normalizeLatentEndpointUrl(config.latentUrl || LATENT_DEFAULT_ENDPOINT),
  );
  const [latentApiKey, setLatentApiKey] = useState(config.latentApiKey || '');
  const [showLatentKey, setShowLatentKey] = useState(false);
  const [latentModel, setLatentModel] = useState(
    config.latentModel || DEFAULT_LATENT_MODEL,
  );
  const [latentSize, setLatentSize] = useState(
    config.latentSize || DEFAULT_LATENT_SIZE,
  );
  const [latentPositivePrefix, setLatentPositivePrefix] = useState(
    config.latentPositivePrefix ?? DEFAULT_LATENT_POSITIVE_PREFIX,
  );
  const [latentNegativePrompt, setLatentNegativePrompt] = useState(
    config.latentNegativePrompt ?? DEFAULT_LATENT_NEGATIVE_PROMPT,
  );
  const [latentSteps, setLatentSteps] = useState(
    config.latentSteps ?? DEFAULT_LATENT_STEPS,
  );
  const [latentScale, setLatentScale] = useState(
    config.latentScale ?? DEFAULT_LATENT_SCALE,
  );
  const [latentSampler, setLatentSampler] = useState(
    config.latentSampler || DEFAULT_LATENT_SAMPLER,
  );
  const [latentNoiseSchedule, setLatentNoiseSchedule] = useState(
    config.latentNoiseSchedule || DEFAULT_LATENT_NOISE_SCHEDULE,
  );
  const [latentUcPreset, setLatentUcPreset] = useState(
    config.latentUcPreset ?? 0,
  );
  const [latentQualityToggle, setLatentQualityToggle] = useState(
    config.latentQualityToggle !== false,
  );
  const [latentUseServerProxy, setLatentUseServerProxy] = useState(
    config.latentUseServerProxy === true,
  );
  const [latentAdvancedOpen, setLatentAdvancedOpen] = useState(false);
  const [latentTestFeedback, setLatentTestFeedback] = useState<{
    ok: boolean;
    title: string;
    detail?: string;
    suggestDirectFetch?: boolean;
    suggestServerProxy?: boolean;
  } | null>(null);
  const [comfyuiUrl, setComfyuiUrl] = useState(config.comfyuiUrl || '');
  const [comfyuiWorkflowJson, setComfyuiWorkflowJson] = useState(
    config.comfyuiWorkflowJson || '',
  );
  const [comfyuiNegativePrompt, setComfyuiNegativePrompt] = useState(
    config.comfyuiNegativePrompt || '',
  );
  const [comfyuiNodeMapping, setComfyuiNodeMapping] =
    useState<ComfyUiNodeMapping>(config.comfyuiNodeMapping || {});
  const [comfyuiWorkflows, setComfyuiWorkflows] = useState<
    ComfyUiWorkflowPreset[]
  >(Array.isArray(config.comfyuiWorkflows) ? config.comfyuiWorkflows : []);
  const [activeComfyuiWorkflowId, setActiveComfyuiWorkflowId] = useState(
    config.activeComfyuiWorkflowId || '',
  );
  const [showComfyWorkflowModal, setShowComfyWorkflowModal] = useState(false);
  const [showInlineComfyEditor, setShowInlineComfyEditor] = useState(
    () => !(Array.isArray(config.comfyuiWorkflows) && config.comfyuiWorkflows.length > 0),
  );
  const comfyWorkflowFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageGenAbortRef = useRef<AbortController | null>(null);
  const probeAbortRef = useRef<AbortController | null>(null);
  const [discoveredSeedreamModels, setDiscoveredSeedreamModels] = useState<
    string[]
  >([]);
  const [seedreamLogs, setSeedreamLogs] = useState<string[]>([
    'Sẵn sàng tạo ảnh (Latent.moe / Seedream 5 Pro / ComfyUI / Custom Image API)...',
  ]);
  const [seedreamResult, setSeedreamResult] = useState<{
    url: string;
    info: string;
  } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const asyncActionLockRef = useRef(false);
  const { isConfirmed, triggerConfirm } = useActionConfirmFeedback(1150);

  useEffect(() => {
    setProxyUrl(config.proxyUrl || '');
    setProxyKey(config.proxyKey || '');
    setModel(config.model || '');
    setTaskModels(config.taskModels || {});
    setApiProtocol(config.apiProtocol || 'openai');
    setUseServerProxy(shouldUseServerProxy(config));
    setHapticFeedbackEnabled(config.hapticFeedbackEnabled !== false);
    setAutoStoryBeatsEnabled(config.autoStoryBeatsEnabled !== false);
    setChatImageMaxInputMb(clampChatImageMaxInputMb(config.chatImageMaxInputMb));
    setChatImageMaxDimension(
      clampChatImageMaxDimension(config.chatImageMaxDimension),
    );
    setChatImageQuality(clampChatImageQuality(config.chatImageQuality));
    setChatImageAutoClearAfterReply(
      config.chatImageAutoClearAfterReply !== false,
    );
    setImageProvider(
      config.imageProvider === 'comfyui'
        ? 'comfyui'
        : config.imageProvider === 'custom'
          ? 'custom'
          : config.imageProvider === 'latent'
            ? 'latent'
            : 'seedream',
    );
    setSeedreamUrl(config.seedreamUrl || '');
    setSeedreamApiKey(config.seedreamApiKey || '');
    setSeedreamModel(config.seedreamModel || 'seedream-5.0-pro');
    setSeedreamSize(config.seedreamSize || '1024x1024');
    setSeedreamPrompt(config.seedreamPrompt || '');
    setCustomImageUrl(config.customImageUrl || '');
    setCustomImageApiKey(config.customImageApiKey || '');
    setCustomImageAuthHeader(config.customImageAuthHeader || 'Authorization');
    setCustomImageModel(config.customImageModel || '');
    setCustomImageFormatMode(
      config.customImageFormatMode === 'custom_json' ? 'custom_json' : 'openai',
    );
    setCustomImageJsonTemplate(
      config.customImageJsonTemplate || DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE,
    );
    setCustomImageNegativePrompt(config.customImageNegativePrompt || '');
    setCustomImageUseServerProxy(config.customImageUseServerProxy !== false);
    setLatentUrl(
      normalizeLatentEndpointUrl(config.latentUrl || LATENT_DEFAULT_ENDPOINT),
    );
    setLatentApiKey(config.latentApiKey || '');
    setLatentModel(config.latentModel || DEFAULT_LATENT_MODEL);
    setLatentSize(config.latentSize || DEFAULT_LATENT_SIZE);
    setLatentPositivePrefix(
      config.latentPositivePrefix ?? DEFAULT_LATENT_POSITIVE_PREFIX,
    );
    setLatentNegativePrompt(
      config.latentNegativePrompt ?? DEFAULT_LATENT_NEGATIVE_PROMPT,
    );
    setLatentSteps(config.latentSteps ?? DEFAULT_LATENT_STEPS);
    setLatentScale(config.latentScale ?? DEFAULT_LATENT_SCALE);
    setLatentSampler(config.latentSampler || DEFAULT_LATENT_SAMPLER);
    setLatentNoiseSchedule(
      config.latentNoiseSchedule || DEFAULT_LATENT_NOISE_SCHEDULE,
    );
    setLatentUcPreset(config.latentUcPreset ?? 0);
    setLatentQualityToggle(config.latentQualityToggle !== false);
    setLatentUseServerProxy(config.latentUseServerProxy === true);
    setComfyuiUrl(config.comfyuiUrl || '');
    setComfyuiWorkflowJson(config.comfyuiWorkflowJson || '');
    setComfyuiNegativePrompt(config.comfyuiNegativePrompt || '');
    setComfyuiNodeMapping(config.comfyuiNodeMapping || {});
    setComfyuiWorkflows(
      Array.isArray(config.comfyuiWorkflows) ? config.comfyuiWorkflows : [],
    );
    setActiveComfyuiWorkflowId(config.activeComfyuiWorkflowId || '');
    const s = config.safetySettings || DEFAULT_SAFETY;
    setSafeSex(s[0]?.threshold || 'BLOCK_NONE');
    setSafeHate(s[1]?.threshold || 'BLOCK_NONE');
    setSafeHarass(s[2]?.threshold || 'BLOCK_NONE');
    setSafeDanger(s[3]?.threshold || 'BLOCK_NONE');
    setPrefill(tawaPreset.prefill || '');
  }, [config, tawaPreset.prefill]);

  useEffect(
    () => () => {
      imageGenAbortRef.current?.abort();
      imageGenAbortRef.current = null;
      probeAbortRef.current?.abort();
      probeAbortRef.current = null;
    },
    [],
  );

  const comfyWorkflowAnalysis = useMemo(
    () =>
      comfyuiWorkflowJson.trim()
        ? analyzeComfyUiWorkflowJson(comfyuiWorkflowJson)
        : null,
    [comfyuiWorkflowJson],
  );

  const appendSeedreamLog = (line: string) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setSeedreamLogs((prev) => [...prev, `[${ts}] ${line}`]);
  };

  const activeComfyWorkflow = useMemo(
    () =>
      comfyuiWorkflows.find((wf) => wf.id === activeComfyuiWorkflowId) || null,
    [activeComfyuiWorkflowId, comfyuiWorkflows],
  );

  const customJsonValidation = useMemo(() => {
    if (customImageFormatMode !== 'custom_json') return null;
    return renderCustomImageJsonPayload(customImageJsonTemplate, {
      prompt: 'sample prompt',
      negativePrompt: customImageNegativePrompt || 'lowres, blurry',
      model: customImageModel.trim(),
      size: seedreamSize.trim() || '1024x1024',
      width: 832,
      height: 1216,
      seed: 123456,
    });
  }, [
    customImageFormatMode,
    customImageJsonTemplate,
    customImageNegativePrompt,
    customImageModel,
    seedreamSize,
  ]);

  const normalizedCustomEndpointPreview = useMemo(
    () => normalizeCustomImageEndpointUrl(customImageUrl),
    [customImageUrl],
  );

  const buildCurrentPayload = (overrides?: {
    useServerProxy?: boolean;
    hapticFeedbackEnabled?: boolean;
    autoStoryBeatsEnabled?: boolean;
    chatImageMaxInputMb?: number;
    chatImageMaxDimension?: number;
    chatImageQuality?: number;
    chatImageAutoClearAfterReply?: boolean;
    imageProvider?: ImageProvider;
    customImageUseServerProxy?: boolean;
    customImageFormatMode?: CustomImageFormatMode;
    seedreamSize?: string;
    latentUrl?: string;
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
    taskModels?: AiTaskModelSlots;
    comfyuiWorkflows?: ComfyUiWorkflowPreset[];
    activeComfyuiWorkflowId?: string;
    comfyuiWorkflowJson?: string;
    comfyuiNegativePrompt?: string;
    comfyuiNodeMapping?: ComfyUiNodeMapping;
  }) => {
    const effectiveMappingSource =
      overrides?.comfyuiNodeMapping ?? comfyuiNodeMapping;
    const cleanMapping: ComfyUiNodeMapping = {
      ...(effectiveMappingSource.positiveNodeId?.trim()
        ? { positiveNodeId: effectiveMappingSource.positiveNodeId.trim() }
        : {}),
      ...(effectiveMappingSource.negativeNodeId?.trim()
        ? { negativeNodeId: effectiveMappingSource.negativeNodeId.trim() }
        : {}),
      ...(effectiveMappingSource.seedNodeId?.trim()
        ? { seedNodeId: effectiveMappingSource.seedNodeId.trim() }
        : {}),
      ...(effectiveMappingSource.sizeNodeId?.trim()
        ? { sizeNodeId: effectiveMappingSource.sizeNodeId.trim() }
        : {}),
      ...(effectiveMappingSource.outputNodeId?.trim()
        ? { outputNodeId: effectiveMappingSource.outputNodeId.trim() }
        : {}),
    };
    const nextWorkflowJson =
      overrides?.comfyuiWorkflowJson ?? comfyuiWorkflowJson;
    const nextNegativePrompt =
      overrides?.comfyuiNegativePrompt ?? comfyuiNegativePrompt;
    const nextActiveId =
      overrides?.activeComfyuiWorkflowId ?? activeComfyuiWorkflowId;
    let nextWorkflows = overrides?.comfyuiWorkflows ?? comfyuiWorkflows;

    // Keep the currently selected saved workflow in sync when edited inline
    if (
      !overrides?.comfyuiWorkflows &&
      nextActiveId &&
      nextWorkflows.some((wf) => wf.id === nextActiveId)
    ) {
      nextWorkflows = nextWorkflows.map((wf) =>
        wf.id === nextActiveId
          ? {
              ...wf,
              workflowJson: nextWorkflowJson,
              negativePrompt: nextNegativePrompt,
              nodeMapping: cleanMapping,
              updatedAt: Date.now(),
            }
          : wf,
      );
    }

    const effectiveTaskModels = overrides?.taskModels ?? taskModels;
    const cleanTaskModels: AiTaskModelSlots = {};
    for (const slotId of AI_TASK_SLOT_ORDER) {
      const val = (effectiveTaskModels[slotId] || '').trim();
      if (val) cleanTaskModels[slotId] = val;
    }

    return {
      config: {
        proxyUrl: normalizeProxyBaseUrl(proxyUrl),
        proxyKey: proxyKey.trim(),
        model: model.trim(),
        taskModels: cleanTaskModels,
        showbizPhoneConfig: config.showbizPhoneConfig,
        apiProtocol,
        useServerProxy: overrides?.useServerProxy ?? useServerProxy,
        hapticFeedbackEnabled:
          overrides?.hapticFeedbackEnabled ?? hapticFeedbackEnabled,
        autoStoryBeatsEnabled:
          overrides?.autoStoryBeatsEnabled ?? autoStoryBeatsEnabled,
        chatImageMaxInputMb: clampChatImageMaxInputMb(
          overrides?.chatImageMaxInputMb ?? chatImageMaxInputMb,
        ),
        chatImageMaxDimension: clampChatImageMaxDimension(
          overrides?.chatImageMaxDimension ?? chatImageMaxDimension,
        ),
        chatImageQuality: clampChatImageQuality(
          overrides?.chatImageQuality ?? chatImageQuality,
        ),
        chatImageAutoClearAfterReply:
          overrides?.chatImageAutoClearAfterReply ??
          chatImageAutoClearAfterReply,
        imageProvider: overrides?.imageProvider ?? imageProvider,
        seedreamUrl: seedreamUrl.trim(),
        seedreamApiKey: seedreamApiKey.trim(),
        seedreamModel: seedreamModel.trim() || 'seedream-5.0-pro',
        seedreamSize:
          (overrides?.seedreamSize ?? seedreamSize).trim() || '1024x1024',
        seedreamPrompt,
        customImageUrl: normalizeCustomImageEndpointUrl(customImageUrl),
        customImageApiKey: customImageApiKey.trim(),
        customImageAuthHeader:
          customImageAuthHeader.trim() || 'Authorization',
        customImageModel: customImageModel.trim(),
        customImageFormatMode:
          overrides?.customImageFormatMode ?? customImageFormatMode,
        customImageJsonTemplate,
        customImageNegativePrompt,
        customImageUseServerProxy:
          overrides?.customImageUseServerProxy ?? customImageUseServerProxy,
        latentUrl: normalizeLatentEndpointUrl(overrides?.latentUrl ?? latentUrl),
        latentApiKey: latentApiKey.trim(),
        latentModel:
          (overrides?.latentModel ?? latentModel).trim() || DEFAULT_LATENT_MODEL,
        latentSize:
          (overrides?.latentSize ?? latentSize).trim() || DEFAULT_LATENT_SIZE,
        latentPositivePrefix:
          overrides?.latentPositivePrefix ?? latentPositivePrefix,
        latentNegativePrompt:
          overrides?.latentNegativePrompt ?? latentNegativePrompt,
        latentSteps: overrides?.latentSteps ?? latentSteps,
        latentScale: overrides?.latentScale ?? latentScale,
        latentSampler: overrides?.latentSampler ?? latentSampler,
        latentNoiseSchedule:
          overrides?.latentNoiseSchedule ?? latentNoiseSchedule,
        latentUcPreset: overrides?.latentUcPreset ?? latentUcPreset,
        latentQualityToggle:
          overrides?.latentQualityToggle ?? latentQualityToggle,
        latentUseServerProxy:
          overrides?.latentUseServerProxy ?? latentUseServerProxy,
        comfyuiUrl: comfyuiUrl.trim(),
        comfyuiWorkflowJson: nextWorkflowJson,
        comfyuiNegativePrompt: nextNegativePrompt,
        comfyuiNodeMapping: cleanMapping,
        comfyuiWorkflows: nextWorkflows,
        activeComfyuiWorkflowId: nextActiveId,
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: safeSex.trim() || 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: safeHate.trim() || 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: safeHarass.trim() || 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: safeDanger.trim() || 'BLOCK_NONE',
          },
        ],
      },
      prefill,
    };
  };

  const handleSave = (confirmKey = 'save_config') => {
    onSaveConfig(buildCurrentPayload());
    triggerConfirm(confirmKey);
  };

  const handleSelectSavedComfyWorkflow = (workflowId: string) => {
    if (!workflowId) {
      setActiveComfyuiWorkflowId('');
      onSaveConfig(buildCurrentPayload({ activeComfyuiWorkflowId: '' }));
      return;
    }
    const target = comfyuiWorkflows.find((wf) => wf.id === workflowId);
    if (!target) return;
    const nextMapping = target.nodeMapping || {};
    const nextNeg = target.negativePrompt || '';
    setActiveComfyuiWorkflowId(target.id);
    setComfyuiWorkflowJson(target.workflowJson);
    setComfyuiNegativePrompt(nextNeg);
    setComfyuiNodeMapping(nextMapping);
    onSaveConfig(
      buildCurrentPayload({
        activeComfyuiWorkflowId: target.id,
        comfyuiWorkflowJson: target.workflowJson,
        comfyuiNegativePrompt: nextNeg,
        comfyuiNodeMapping: nextMapping,
      }),
    );
    appendSeedreamLog(`[ComfyUI] Đã chọn workflow "${target.name}".`);
    onNotify(`Đã chuyển nhanh sang Workflow "${target.name}".`);
  };

  const handleApplyWorkflowLibrary = ({
    workflows: nextWorkflows,
    activeWorkflowId: nextActiveId,
  }: {
    workflows: ComfyUiWorkflowPreset[];
    activeWorkflowId: string;
  }) => {
    const activeItem = nextWorkflows.find((wf) => wf.id === nextActiveId);
    const nextJson = activeItem
      ? activeItem.workflowJson
      : nextWorkflows.length === 0
        ? ''
        : comfyuiWorkflowJson;
    const nextNeg = activeItem
      ? activeItem.negativePrompt || ''
      : nextWorkflows.length === 0
        ? ''
        : comfyuiNegativePrompt;
    const nextMapping = activeItem
      ? activeItem.nodeMapping || {}
      : nextWorkflows.length === 0
        ? {}
        : comfyuiNodeMapping;

    setComfyuiWorkflows(nextWorkflows);
    setActiveComfyuiWorkflowId(nextActiveId);
    setComfyuiWorkflowJson(nextJson);
    setComfyuiNegativePrompt(nextNeg);
    setComfyuiNodeMapping(nextMapping);

    onSaveConfig(
      buildCurrentPayload({
        comfyuiWorkflows: nextWorkflows,
        activeComfyuiWorkflowId: nextActiveId,
        comfyuiWorkflowJson: nextJson,
        comfyuiNegativePrompt: nextNeg,
        comfyuiNodeMapping: nextMapping,
      }),
    );
  };

  const handleQuickSaveInlineWorkflow = () => {
    if (!comfyuiWorkflowJson.trim()) {
      onNotify('Chưa có nội dung Workflow API JSON để lưu.', 'err');
      return;
    }
    const check = analyzeComfyUiWorkflowJson(comfyuiWorkflowJson);
    if (!check.ok) {
      onNotify(
        check.error || 'Workflow JSON chưa đúng chuẩn ComfyUI Export (API).',
        'err',
      );
      return;
    }
    const newPreset: ComfyUiWorkflowPreset = {
      id: `comfy_wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Workflow #${comfyuiWorkflows.length + 1}`,
      workflowJson: comfyuiWorkflowJson,
      negativePrompt: comfyuiNegativePrompt,
      nodeMapping: comfyuiNodeMapping,
      updatedAt: Date.now(),
    };
    handleApplyWorkflowLibrary({
      workflows: [newPreset, ...comfyuiWorkflows],
      activeWorkflowId: newPreset.id,
    });
    setShowComfyWorkflowModal(true);
    onNotify(`Đã lưu "${newPreset.name}" vào thư viện — bạn có thể đặt tên ngay.`);
  };

  const handleComfyWorkflowFileChange = (
    ev: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setComfyuiWorkflowJson(text);
      const check = analyzeComfyUiWorkflowJson(text);
      if (check.ok) {
        appendSeedreamLog(
          `[ComfyUI] Đã nạp "${file.name}" (${check.nodeSummaries.length} node; pos:#${
            check.detected.positiveNodeId || '?'
          }, neg:#${check.detected.negativeNodeId || '?'}, seed:#${
            check.detected.seedNodeId || '?'
          }, size:#${check.detected.sizeNodeId || '?'}, out:#${
            check.detected.outputNodeId || '?'
          }).`,
        );
        onNotify(
          `Đã nạp Workflow ComfyUI "${file.name}" (${check.nodeSummaries.length} node).`,
        );
      } else {
        appendSeedreamLog(`[ComfyUI] Cảnh báo file "${file.name}": ${check.error}`);
        onNotify(check.error || 'Workflow JSON chưa đúng chuẩn API.', 'err');
      }
    };
    reader.onerror = () => {
      onNotify('Không thể đọc tệp Workflow JSON.', 'err');
    };
    reader.readAsText(file);
  };

  const handleStopImageAction = () => {
    if (imageGenAbortRef.current) {
      imageGenAbortRef.current.abort();
      imageGenAbortRef.current = null;
      asyncActionLockRef.current = false;
      setBusyAction(null);
      appendSeedreamLog('Đã dừng yêu cầu tạo ảnh.');
    }
  };

  const PROBE_TIMEOUT_MS = 20_000;

  const startNewProbeController = () => {
    probeAbortRef.current?.abort();
    const ctrl = new AbortController();
    probeAbortRef.current = ctrl;
    return ctrl;
  };

  const buildProxyAuthHeaders = (
    key: string,
    includeJsonContentType = false,
    isGemini = false,
  ): Record<string, string> => {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/event-stream',
    };
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
      if (isGemini) {
        headers['x-goog-api-key'] = key;
      }
    }
    return headers;
  };

  const handleDiscoverModels = async (overrideUseServerProxy?: boolean) => {
    if (asyncActionLockRef.current) return;
    const current = buildCurrentPayload(
      overrideUseServerProxy !== undefined
        ? { useServerProxy: overrideUseServerProxy }
        : undefined,
    );
    const base = current.config.proxyUrl;
    const key = current.config.proxyKey;
    const viaServer = shouldUseServerProxy(current.config);
    if (!base) {
      onAppendProxyLog('Chưa có Proxy URL.');
      return;
    }
    const isGemini = detectIsGeminiProtocol(current.config);
    const candidates = buildModelListEndpointCandidates(base, isGemini);
    if (!candidates.length) {
      onAppendProxyLog('Proxy Base URL không hợp lệ.');
      return;
    }
    asyncActionLockRef.current = true;
    setProxyQuickSwitchHint(null);
    const probeCtrl = startNewProbeController();
    setBusyAction('discoverProxy');
    let saw403 = false;
    let sawDirectNetworkErr = false;
    try {
      for (const url of candidates) {
        const timed = createTimedAbortSignal(probeCtrl.signal, PROBE_TIMEOUT_MS);
        try {
          const res = await fetchProxyTarget({
            url,
            method: 'GET',
            headers: buildProxyAuthHeaders(key, false, isGemini),
            signal: timed.signal,
            useServerProxy: viaServer,
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            if (res.status === 403) saw403 = true;
            onAppendProxyLog(
              `Models HTTP ${res.status} tại ${url}${
                errTxt ? `: ${errTxt.replace(/\s+/g, ' ').trim().slice(0, 180)}` : ''
              }`,
            );
            continue;
          }
          const json = await res.json();
          const list = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.models)
              ? json.models
              : [];
          const names: string[] = Array.from(
            new Set(
              list
                .map((x: { id?: string; name?: string }) =>
                  String(x?.id ?? x?.name ?? '')
                    .trim()
                    .replace(/^models\//, ''),
                )
                .filter(Boolean),
            ),
          );
          setDiscoveredModels(names);
          setProxyQuickSwitchHint(null);
          if (names.length > 0) {
            onAppendProxyLog(`Tải được ${names.length} model từ ${url}`);
          } else {
            onAppendProxyLog(
              `Endpoint ${url} trả về danh sách rỗng. Bạn vẫn có thể nhập tên model thủ công và bấm Test Proxy.`,
            );
          }
          return;
        } catch (e) {
          if (probeCtrl.signal.aborted) return;
          if (!viaServer && !timed.didTimeout()) {
            sawDirectNetworkErr = true;
          }
          const msg = timed.didTimeout()
            ? `Quá thời gian chờ (${Math.round(PROBE_TIMEOUT_MS / 1000)}s)`
            : e instanceof Error
              ? e.message
              : String(e);
          onAppendProxyLog(`Lỗi tải model tại ${url}: ${msg}`);
        } finally {
          timed.cleanup();
        }
      }
      if (saw403 && viaServer) {
        setProxyQuickSwitchHint('switch_direct');
        onAppendProxyLog(
          'Gợi ý (HTTP 403): Server đích có thể đang chặn IP/WAF của Server Proxy. Hãy thử tắt "Đi qua Server Proxy (/api/proxy)" để chuyển sang gọi trực tiếp từ trình duyệt (Direct Fetch), hoặc kiểm tra lại API Key.',
        );
      } else if (sawDirectNetworkErr && !viaServer) {
        setProxyQuickSwitchHint('switch_server_proxy');
        onAppendProxyLog(
          'Gợi ý (Lỗi mạng/CORS): Trình duyệt đang chặn gọi trực tiếp tới domain này. Hãy bật lại "Đi qua Server Proxy (/api/proxy)".',
        );
      } else {
        onAppendProxyLog(
          'Endpoint /models không khả dụng. Bạn vẫn có thể nhập tên model thủ công vào ô Model và bấm "Test Proxy".',
        );
      }
    } finally {
      asyncActionLockRef.current = false;
      if (probeAbortRef.current === probeCtrl) {
        probeAbortRef.current = null;
        setBusyAction(null);
      }
    }
  };

  const handleTestProxy = async (overrideUseServerProxy?: boolean) => {
    if (asyncActionLockRef.current) return;
    asyncActionLockRef.current = true;
    const current = buildCurrentPayload(
      overrideUseServerProxy !== undefined
        ? { useServerProxy: overrideUseServerProxy }
        : undefined,
    );
    onSaveConfig(current);
    const viaServer = shouldUseServerProxy(current.config);
    const testModel = current.config.model || DEFAULT_PROXY_MODEL;
    onAppendProxyLog(
      `Đang kiểm tra kết nối proxy (${viaServer ? 'Server Proxy /api/proxy' : 'Direct Fetch trình duyệt'} · model=${testModel})...`,
    );
    setProxyQuickSwitchHint(null);
    const probeCtrl = startNewProbeController();
    setBusyAction('testProxy');
    let saw403 = false;
    let sawDirectNetworkErr = false;
    try {
      const isGemini = detectIsGeminiProtocol(current.config);
      const candidates = buildEndpointCandidates(
        current.config.proxyUrl,
        testModel,
        false,
        isGemini,
      );
      if (!candidates.length) {
        onAppendProxyLog('Chưa nhập Proxy Base URL.');
        return;
      }
      const headers = buildProxyAuthHeaders(
        current.config.proxyKey,
        true,
        isGemini,
      );
      const testBody = isGemini
        ? { contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }
        : {
            model: testModel,
            messages: [{ role: 'user', content: 'ping' }],
            stream: false,
          };
      for (const url of candidates) {
        const timed = createTimedAbortSignal(probeCtrl.signal, PROBE_TIMEOUT_MS);
        try {
          const res = await fetchProxyTarget({
            url,
            method: 'POST',
            headers,
            body: testBody,
            signal: timed.signal,
            useServerProxy: viaServer,
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            if (res.status === 403) saw403 = true;
            onAppendProxyLog(
              `Kiểm tra ${url} -> HTTP ${res.status}${
                errTxt ? `: ${errTxt.replace(/\s+/g, ' ').trim().slice(0, 180)}` : ''
              }`,
            );
          } else {
            setProxyQuickSwitchHint(null);
            onAppendProxyLog(`Kiểm tra ${url} -> HTTP ${res.status} (OK)`);
            return;
          }
        } catch (e) {
          if (probeCtrl.signal.aborted) return;
          if (!viaServer && !timed.didTimeout()) {
            sawDirectNetworkErr = true;
          }
          const msg = timed.didTimeout()
            ? `Quá thời gian chờ (${Math.round(PROBE_TIMEOUT_MS / 1000)}s)`
            : e instanceof Error
              ? e.message
              : String(e);
          onAppendProxyLog(`Lỗi ${url}: ${msg}`);
        } finally {
          timed.cleanup();
        }
      }
      if (saw403 && viaServer) {
        setProxyQuickSwitchHint('switch_direct');
        onAppendProxyLog(
          'Gợi ý (HTTP 403 Forbidden): Reverse proxy / WAF của server đích đang chặn IP của Server Proxy. Hãy tắt công tắc "Đi qua Server Proxy (/api/proxy)" để chuyển sang Direct Fetch từ trình duyệt, hoặc dùng endpoint hỗ trợ sẵn CORS như Google AI Studio (https://generativelanguage.googleapis.com/v1beta/openai).',
        );
      } else if (sawDirectNetworkErr && !viaServer) {
        setProxyQuickSwitchHint('switch_server_proxy');
        onAppendProxyLog(
          'Gợi ý (CORS / Mạng): Trình duyệt đã chặn gọi trực tiếp (Direct Fetch). Hãy bật lại "Đi qua Server Proxy (/api/proxy)".',
        );
      }
    } finally {
      asyncActionLockRef.current = false;
      if (probeAbortRef.current === probeCtrl) {
        probeAbortRef.current = null;
        setBusyAction(null);
      }
    }
  };

  const handleTestTaskSlot = async (slotId: AiTaskSlotId) => {
    if (asyncActionLockRef.current) return;
    asyncActionLockRef.current = true;
    const current = buildCurrentPayload();
    onSaveConfig(current);
    const meta = AI_TASK_SLOT_META[slotId];
    const resolved = resolveModelForTask(current.config, slotId);
    const viaServer = shouldUseServerProxy(current.config);
    onAppendProxyLog(
      `[Slot ${meta.shortLabel}] Đang kiểm tra model "${resolved.model}"${resolved.isCustomSlot ? ' (model riêng)' : ' (fallback model chính)'}...`,
    );
    const probeCtrl = startNewProbeController();
    setBusyAction(`testSlot_${slotId}`);
    try {
      const isGemini = detectIsGeminiProtocol(current.config);
      const candidates = buildEndpointCandidates(
        current.config.proxyUrl,
        resolved.model,
        false,
        isGemini,
      );
      if (!candidates.length) {
        onAppendProxyLog(
          `[Slot ${meta.shortLabel}] Chưa nhập Proxy Base URL.`,
        );
        onNotify('Hãy nhập Proxy Base URL trước khi test slot model.', 'err');
        return;
      }
      const headers = buildProxyAuthHeaders(
        current.config.proxyKey,
        true,
        isGemini,
      );
      const testBody = isGemini
        ? { contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }
        : {
            model: resolved.model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 16,
            stream: false,
          };
      for (const url of candidates) {
        const timed = createTimedAbortSignal(probeCtrl.signal, PROBE_TIMEOUT_MS);
        try {
          const res = await fetchProxyTarget({
            url,
            method: 'POST',
            headers,
            body: testBody,
            signal: timed.signal,
            useServerProxy: viaServer,
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            if (res.status === 403 && viaServer) {
              setProxyQuickSwitchHint('switch_direct');
            }
            onAppendProxyLog(
              `[Slot ${meta.shortLabel} · ${resolved.model}] HTTP ${res.status}${
                errTxt ? `: ${errTxt.replace(/\s+/g, ' ').trim().slice(0, 180)}` : ''
              }`,
            );
            if (res.status !== 404 && res.status !== 405) {
              onNotify(
                `Slot ${meta.shortLabel} (${resolved.model}) lỗi HTTP ${res.status}. Xem log Proxy.`,
                'err',
              );
              return;
            }
          } else {
            onAppendProxyLog(
              `[Slot ${meta.shortLabel} · ${resolved.model}] HTTP ${res.status} (OK)`,
            );
            onNotify(
              `Slot ${meta.shortLabel} (${resolved.model}) kết nối thành công!`,
            );
            return;
          }
        } catch (e) {
          if (probeCtrl.signal.aborted) return;
          const msg = timed.didTimeout()
            ? `Quá thời gian chờ (${Math.round(PROBE_TIMEOUT_MS / 1000)}s)`
            : e instanceof Error
              ? e.message
              : String(e);
          onAppendProxyLog(
            `[Slot ${meta.shortLabel} · ${resolved.model}] Lỗi: ${msg}`,
          );
        } finally {
          timed.cleanup();
        }
      }
      onNotify(
        `Không thể kết nối Slot ${meta.shortLabel} (${resolved.model}). Xem log Proxy.`,
        'err',
      );
    } finally {
      asyncActionLockRef.current = false;
      if (probeAbortRef.current === probeCtrl) {
        probeAbortRef.current = null;
        setBusyAction(null);
      }
    }
  };

  const handleDiscoverSeedreamModels = async () => {
    if (asyncActionLockRef.current) return;
    const current = buildCurrentPayload();
    onSaveConfig(current);
    const endpointRaw = (
      current.config.seedreamUrl ||
      current.config.proxyUrl ||
      ''
    ).trim();
    const apiKey = (
      current.config.seedreamApiKey ||
      current.config.proxyKey ||
      ''
    ).trim();
    if (!endpointRaw) {
      appendSeedreamLog(
        'Lỗi: Chưa nhập Seedream 5 Pro Endpoint (hoặc Proxy URL).',
      );
      onNotify(
        'Hãy nhập Seedream 5 Pro Endpoint trước khi tải model.',
        'err',
      );
      return;
    }
    asyncActionLockRef.current = true;
    const candidates = buildSeedreamModelEndpoints(endpointRaw);
    appendSeedreamLog('Đang tải danh sách model ảnh...');
    const probeCtrl = startNewProbeController();
    setBusyAction('discoverSeedream');
    try {
      for (const url of candidates) {
        const timed = createTimedAbortSignal(probeCtrl.signal, PROBE_TIMEOUT_MS);
        try {
          const headers: Record<string, string> = {};
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['x-api-key'] = apiKey;
          }
          const res = await fetchProxyTarget({
            url,
            method: 'GET',
            headers,
            signal: timed.signal,
            useServerProxy: shouldUseServerProxy(current.config),
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            appendSeedreamLog(
              `Lỗi tải model HTTP ${res.status} tại ${url}${
                errTxt ? `: ${errTxt.slice(0, 180)}` : ''
              }`,
            );
            continue;
          }
          const json = await res.json();
          const list = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.models)
              ? json.models
              : [];
          const names: string[] = list
            .map((x: { id?: string; name?: string }) =>
              String(x?.id ?? x?.name ?? '').replace(/^models\//, ''),
            )
            .filter(Boolean);
          setDiscoveredSeedreamModels(names);
          appendSeedreamLog(`Tải được ${names.length} model từ ${url}`);
          return;
        } catch (e) {
          if (probeCtrl.signal.aborted) return;
          const msg = timed.didTimeout()
            ? `Quá thời gian chờ (${Math.round(PROBE_TIMEOUT_MS / 1000)}s)`
            : e instanceof Error
              ? e.message
              : String(e);
          appendSeedreamLog(`Lỗi tải model tại ${url}: ${msg}`);
        } finally {
          timed.cleanup();
        }
      }
      onNotify(
        'Không tải được danh sách model Seedream. Xem chi tiết lỗi tại ô log.',
        'err',
      );
    } finally {
      asyncActionLockRef.current = false;
      if (probeAbortRef.current === probeCtrl) {
        probeAbortRef.current = null;
        setBusyAction(null);
      }
    }
  };

  const runCustomImageRequestFromStudio = async (options: {
    isTest: boolean;
    overrideUseServerProxy?: boolean;
  }) => {
    const { isTest, overrideUseServerProxy } = options;
    const current = buildCurrentPayload(
      overrideUseServerProxy !== undefined
        ? { customImageUseServerProxy: overrideUseServerProxy }
        : undefined,
    );
    onSaveConfig(current);

    const endpointRaw = (current.config.customImageUrl || '').trim();
    const viaServer = current.config.customImageUseServerProxy !== false;
    const customModel = (current.config.customImageModel || '').trim();
    const formatMode = current.config.customImageFormatMode || 'openai';
    const sdSize = current.config.seedreamSize || '1024x1024';
    const activeStyle = resolveStoryImageStyle(
      storyImageConfig.stylePreset,
      storyImageConfig.customStyles,
    );
    const promptToSend = isTest
      ? 'minimalist glowing crystal sphere on soft neutral background, clean studio lighting'
      : resolvedEnglishStudioPrompt;

    if (!endpointRaw) {
      const msg = 'Chưa nhập Image Endpoint URL (ví dụ https://latent.moe/v1/images/generations).';
      setCustomImageTestFeedback({ ok: false, title: 'Thiếu Image Endpoint URL', detail: msg });
      appendSeedreamLog(`[Custom Image API] ${msg}`);
      onNotify(msg, 'err');
      return;
    }

    setCustomImageTestFeedback(null);
    const ctrl = new AbortController();
    imageGenAbortRef.current?.abort();
    imageGenAbortRef.current = ctrl;
    setBusyAction(isTest ? 'testSeedream' : 'genSeedream');

    try {
      const reqRes = await requestCustomImage({
        endpointRaw,
        apiKey: current.config.customImageApiKey || '',
        authHeader: current.config.customImageAuthHeader || 'Authorization',
        model: customModel,
        formatMode,
        jsonTemplate:
          current.config.customImageJsonTemplate ||
          DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE,
        prompt: promptToSend,
        negativePrompt: mergeStoryImageNegativePrompt(
          current.config.customImageNegativePrompt || '',
        ),
        size: sdSize,
        signal: ctrl.signal,
        timeoutMs: isTest ? 90_000 : CUSTOM_IMAGE_REQUEST_TIMEOUT_MS,
        useServerProxy: viaServer,
        logPrefix: isTest ? '[Test Tạo Ảnh · Custom API]' : '[Custom Image API]',
        onLog: appendSeedreamLog,
      });

      if (reqRes.aborted) {
        onNotify(isTest ? 'Đã dừng Test Tạo Ảnh.' : 'Đã dừng tạo ảnh.');
        return;
      }

      if (reqRes.ok && reqRes.imageUrl) {
        setSeedreamResult({
          url: reqRes.imageUrl,
          info: `${isTest ? '[Test] ' : ''}Custom Image API${
            customModel ? ` · Model: ${customModel}` : ''
          } · Kích thước: ${sdSize}${isTest ? '' : ` · Phong cách: ${activeStyle.label}`}`,
        });
        setCustomImageTestFeedback({
          ok: true,
          title: `Kết nối & tạo ảnh thành công (HTTP ${reqRes.statusCode || 200})`,
          detail: `Endpoint: ${reqRes.usedUrl || endpointRaw} · Đã hiển thị ảnh xem trước bên dưới.`,
        });
        onNotify(
          isTest
            ? 'Test Tạo Ảnh thành công! Ảnh đã hiển thị bên dưới.'
            : 'Đã tạo ảnh từ Custom Image API thành công!',
        );
        return;
      }

      const errMsg =
        reqRes.error ||
        'Không thể tạo ảnh từ Custom Image Endpoint. Kiểm tra Endpoint URL, API Key và Payload.';
      const suggestDirect = viaServer && reqRes.statusCode === 403;
      const suggestProxy =
        !viaServer &&
        /CORS|Failed to fetch|NetworkError|Load failed/i.test(errMsg);
      setCustomImageTestFeedback({
        ok: false,
        title: reqRes.statusCode
          ? `Lỗi kết nối HTTP ${reqRes.statusCode}`
          : 'Kết nối thất bại',
        detail:
          reqRes.responsePreview && !errMsg.includes(reqRes.responsePreview)
            ? `${errMsg}\nPhản hồi server: ${reqRes.responsePreview}`
            : errMsg,
        suggestDirectFetch: suggestDirect,
        suggestServerProxy: suggestProxy,
      });
      onNotify(errMsg, 'err');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
      setCustomImageTestFeedback({
        ok: false,
        title: 'Lỗi ngoại lệ khi gọi Endpoint',
        detail: msg,
      });
      appendSeedreamLog(`[Custom Image API] Lỗi: ${msg}`);
      onNotify(`Lỗi Custom Image API: ${msg}`, 'err');
    } finally {
      if (imageGenAbortRef.current === ctrl) {
        imageGenAbortRef.current = null;
      }
      setBusyAction(null);
    }
  };

  const runLatentImageRequestFromStudio = async (options: {
    isTest: boolean;
    overrideUseServerProxy?: boolean;
  }) => {
    const { isTest, overrideUseServerProxy } = options;
    const current = buildCurrentPayload(
      overrideUseServerProxy !== undefined
        ? { latentUseServerProxy: overrideUseServerProxy }
        : undefined,
    );
    onSaveConfig(current);

    const apiKey = (current.config.latentApiKey || '').trim();
    const endpointRaw = normalizeLatentEndpointUrl(
      (current.config.latentUrl || '').trim() || LATENT_DEFAULT_ENDPOINT,
    );
    const viaServer = current.config.latentUseServerProxy === true;
    const chosenModel =
      (current.config.latentModel || '').trim() || DEFAULT_LATENT_MODEL;
    const chosenSize =
      (current.config.latentSize || '').trim() || DEFAULT_LATENT_SIZE;
    const activeStyle = resolveStoryImageStyle(
      storyImageConfig.stylePreset,
      storyImageConfig.customStyles,
    );
    const promptToSend = isTest
      ? '1girl, solo, upper body, wuxia swordswoman, flowing white silk Chinese hanfu robes, holding Chinese jian sword, misty bamboo forest, expressive calm gaze'
      : resolvedEnglishStudioPrompt;

    if (!apiKey) {
      const msg =
        'Chưa nhập Latent API Key (lat_sk_...). Hãy bấm "Lấy Key Latent.moe" để tạo key và dán vào ô bên trên.';
      setLatentTestFeedback({
        ok: false,
        title: 'Thiếu Latent API Key',
        detail: msg,
      });
      appendSeedreamLog(`[Họa Đồ AI · Latent.moe] ${msg}`);
      onNotify(msg, 'err');
      return;
    }

    setLatentTestFeedback(null);
    const ctrl = new AbortController();
    imageGenAbortRef.current?.abort();
    imageGenAbortRef.current = ctrl;
    setBusyAction(isTest ? 'testSeedream' : 'genSeedream');

    try {
      const reqRes = await requestLatentImage({
        endpointRaw,
        apiKey,
        model: chosenModel,
        prompt: promptToSend,
        positivePrefix: current.config.latentPositivePrefix ?? '',
        negativePrompt: current.config.latentNegativePrompt ?? '',
        size: chosenSize,
        steps: current.config.latentSteps,
        scale: current.config.latentScale,
        sampler: current.config.latentSampler,
        noiseSchedule: current.config.latentNoiseSchedule,
        ucPreset: current.config.latentUcPreset,
        qualityToggle: current.config.latentQualityToggle,
        signal: ctrl.signal,
        timeoutMs: isTest ? 120_000 : LATENT_REQUEST_TIMEOUT_MS,
        useServerProxy: viaServer,
        logPrefix: isTest
          ? '[Test · Họa Đồ AI Latent.moe]'
          : '[Họa Đồ AI · Latent.moe]',
        onLog: appendSeedreamLog,
      });

      if (reqRes.aborted) {
        onNotify(isTest ? 'Đã dừng Test Latent.moe.' : 'Đã dừng tạo ảnh.');
        return;
      }

      if (reqRes.ok && reqRes.imageUrl) {
        setSeedreamResult({
          url: reqRes.imageUrl,
          info: `${isTest ? '[Test] ' : ''}Latent.moe · Model: ${chosenModel} · Kích thước: ${chosenSize}${
            isTest ? '' : ` · Phong cách: ${activeStyle.label}`
          }`,
        });
        setLatentTestFeedback({
          ok: true,
          title: `Kết nối & nhận ảnh thành công (HTTP ${reqRes.statusCode || 200})`,
          detail: `Endpoint: ${reqRes.usedUrl || endpointRaw}\nModel: ${chosenModel} · Tệp ảnh: ${
            reqRes.entryName || 'image_0.png'
          } · Ảnh xem trước đã hiển thị bên dưới.`,
        });
        onNotify(
          isTest
            ? 'Test Họa Đồ AI · Latent.moe thành công!'
            : 'Đã vẽ ảnh bằng Latent.moe thành công!',
        );
        return;
      }

      const errMsg =
        reqRes.error ||
        `Không thể tạo ảnh từ Latent.moe (${reqRes.usedUrl || endpointRaw}). Hãy kiểm tra Latent API Key, model và số dư.`;
      const suggestDirect = viaServer && reqRes.statusCode === 403;
      const suggestProxy =
        !viaServer &&
        /CORS|Failed to fetch|NetworkError|Load failed/i.test(errMsg);
      const urlLine = reqRes.usedUrl && !errMsg.includes(reqRes.usedUrl)
        ? `URL đã gọi: ${reqRes.usedUrl}\n`
        : '';
      setLatentTestFeedback({
        ok: false,
        title: reqRes.statusCode
          ? `Lỗi Latent.moe (HTTP ${reqRes.statusCode})`
          : 'Kết nối Latent.moe thất bại',
        detail:
          reqRes.responsePreview && !errMsg.includes(reqRes.responsePreview)
            ? `${urlLine}${errMsg}\nPhản hồi server: ${reqRes.responsePreview}`
            : `${urlLine}${errMsg}`,
        suggestDirectFetch: suggestDirect,
        suggestServerProxy: suggestProxy,
      });
      onNotify(errMsg, 'err');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
      setLatentTestFeedback({
        ok: false,
        title: 'Lỗi ngoại lệ khi gọi Latent.moe',
        detail: msg,
      });
      appendSeedreamLog(`[Họa Đồ AI · Latent.moe] Lỗi: ${msg}`);
      onNotify(`Lỗi Latent.moe: ${msg}`, 'err');
    } finally {
      if (imageGenAbortRef.current === ctrl) {
        imageGenAbortRef.current = null;
      }
      setBusyAction(null);
    }
  };

  const handleApplyLatentSamplePreset = () => {
    setLatentPositivePrefix(LATENT_HOADO_SAMPLE_PRESET.positivePrefix);
    setLatentNegativePrompt(LATENT_HOADO_SAMPLE_PRESET.negativePrompt);
    setLatentSteps(LATENT_HOADO_SAMPLE_PRESET.steps);
    setLatentScale(LATENT_HOADO_SAMPLE_PRESET.scale);
    setLatentSampler(LATENT_HOADO_SAMPLE_PRESET.sampler);
    setLatentNoiseSchedule(LATENT_HOADO_SAMPLE_PRESET.noiseSchedule);
    setLatentUcPreset(LATENT_HOADO_SAMPLE_PRESET.ucPreset);
    setLatentQualityToggle(LATENT_HOADO_SAMPLE_PRESET.qualityToggle);
    onSaveConfig(
      buildCurrentPayload({
        latentPositivePrefix: LATENT_HOADO_SAMPLE_PRESET.positivePrefix,
        latentNegativePrompt: LATENT_HOADO_SAMPLE_PRESET.negativePrompt,
        latentSteps: LATENT_HOADO_SAMPLE_PRESET.steps,
        latentScale: LATENT_HOADO_SAMPLE_PRESET.scale,
        latentSampler: LATENT_HOADO_SAMPLE_PRESET.sampler,
        latentNoiseSchedule: LATENT_HOADO_SAMPLE_PRESET.noiseSchedule,
        latentUcPreset: LATENT_HOADO_SAMPLE_PRESET.ucPreset,
        latentQualityToggle: LATENT_HOADO_SAMPLE_PRESET.qualityToggle,
      }),
    );
    onNotify('Đã nạp Preset Mẫu (Họa Ảnh Đồ Xịn) cho Latent.moe!');
  };

  const handleSelectLatentAspectRatio = (ratioValue: string) => {
    setLatentSize(ratioValue);
    setSeedreamSize(ratioValue);
    onUpdateStoryImageConfig({ size: '' });
    onSaveConfig(
      buildCurrentPayload({
        latentSize: ratioValue,
        seedreamSize: ratioValue,
      }),
    );
    onNotify(
      `Đã đặt tỉ lệ mặc định ${ratioValue} px cho cả Minh họa chính văn & Ảnh NV/NPC.`,
    );
  };

  const handleTestSeedream = async () => {
    if (asyncActionLockRef.current) return;
    asyncActionLockRef.current = true;
    try {
      const current = buildCurrentPayload();
      onSaveConfig(current);

      if (current.config.imageProvider === 'latent') {
        await runLatentImageRequestFromStudio({ isTest: true });
        return;
      }

      if (current.config.imageProvider === 'custom') {
        await runCustomImageRequestFromStudio({ isTest: true });
        return;
      }

    if (current.config.imageProvider === 'comfyui') {
      const comfyBase = (current.config.comfyuiUrl || '').trim();
      if (!comfyBase) {
        appendSeedreamLog('Lỗi: Chưa nhập ComfyUI Base URL để kiểm tra.');
        onNotify('Hãy nhập ComfyUI Base URL trước khi bấm Kiểm tra.', 'err');
        return;
      }
      const ctrl = new AbortController();
      imageGenAbortRef.current?.abort();
      imageGenAbortRef.current = ctrl;
      setBusyAction('testSeedream');
      try {
        const res = await testComfyUiConnection({
          baseUrlRaw: comfyBase,
          workflowJson: current.config.comfyuiWorkflowJson || '',
          signal: ctrl.signal,
          onLog: appendSeedreamLog,
        });
        onNotify(res.message, res.ok ? 'info' : 'err');
      } finally {
        if (imageGenAbortRef.current === ctrl) {
          imageGenAbortRef.current = null;
        }
        setBusyAction(null);
      }
      return;
    }

    const endpointRaw = current.config.seedreamUrl;
    const apiKey = (
      current.config.seedreamApiKey ||
      current.config.proxyKey ||
      ''
    ).trim();
    const sdModel = current.config.seedreamModel;
    const sdSize = current.config.seedreamSize || '1024x1024';

    if (!endpointRaw) {
      appendSeedreamLog('Lỗi: Chưa nhập Seedream 5 Pro Endpoint để kiểm tra.');
      onNotify(
        'Hãy nhập Seedream 5 Pro Endpoint trước khi bấm Kiểm tra.',
        'err',
      );
      return;
    }

    const endpoints = buildSeedreamEndpoints(endpointRaw);
    appendSeedreamLog(`Đang kiểm tra kết nối Seedream 5 Pro (${sdModel})...`);
    const ctrl = new AbortController();
    imageGenAbortRef.current?.abort();
    imageGenAbortRef.current = ctrl;
    setBusyAction('testSeedream');
    try {
      let lastErr = '';
      for (const url of endpoints) {
        const timed = createTimedAbortSignal(ctrl.signal, 90_000);
        const startedAt = Date.now();
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['x-api-key'] = apiKey;
          }
          appendSeedreamLog(
            `POST ${url} (model=${sdModel}, size=${sdSize})...`,
          );
          const res = await fetchProxyTarget({
            url,
            method: 'POST',
            headers,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: timed.signal,
            useServerProxy: shouldUseServerProxy(current.config),
            body: {
              model: sdModel,
              prompt: 'test connection, simple minimal cube on neutral background',
              size: sdSize,
              n: 1,
            },
          });
          const elapsedSec = Math.max(
            1,
            Math.round((Date.now() - startedAt) / 1000),
          );
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            lastErr = `Lỗi kiểm tra HTTP ${res.status} tại ${url} (${elapsedSec}s)${
              errTxt ? `: ${errTxt.slice(0, 200)}` : ''
            }`;
            appendSeedreamLog(lastErr);
            if (res.status === 401 || res.status === 403 || res.status === 429) {
              break;
            }
            continue;
          }
          appendSeedreamLog(
            `Kiểm tra thành công (HTTP ${res.status}, ${elapsedSec}s) tại ${url}`,
          );
          onNotify('Kết nối Seedream 5 Pro thành công!');
          return;
        } catch (err) {
          if (ctrl.signal.aborted) {
            return;
          }
          if (timed.didTimeout()) {
            const elapsedSec = Math.max(
              1,
              Math.round((Date.now() - startedAt) / 1000),
            );
            lastErr = `Quá thời gian chờ (${elapsedSec}s) khi kiểm tra ${url}.`;
            appendSeedreamLog(lastErr);
            continue;
          }
          lastErr = formatSeedreamFetchError(url, err);
          appendSeedreamLog(lastErr);
        } finally {
          timed.cleanup();
        }
      }
      onNotify(
        lastErr ||
          'Kiểm tra Seedream thất bại. Xem log lỗi chi tiết bên dưới.',
        'err',
      );
      } finally {
        if (imageGenAbortRef.current === ctrl) {
          imageGenAbortRef.current = null;
        }
        setBusyAction(null);
      }
    } finally {
      asyncActionLockRef.current = false;
    }
  };

  const pickBestModelFromList = (
    patterns: RegExp[],
    fallback: string,
  ): string => {
    for (const re of patterns) {
      const hit = discoveredModels.find((m) => re.test(m));
      if (hit) return hit;
    }
    return fallback;
  };

  const DEFAULT_QUOTA_SAVER_MODEL = 'gemini-3.5-flash-lite';
  const DEFAULT_HIGH_QUALITY_MODEL = 'gemini-3.8';

  const applyBulkTaskSlots = (
    nextSlots: AiTaskModelSlots,
    toastLabel: string,
  ) => {
    setTaskModels(nextSlots);
    onSaveConfig(buildCurrentPayload({ taskModels: nextSlots }));
    onNotify(toastLabel, 'info');
  };

  const applySingleModelToAllTaskSlots = (
    targetModel: string,
    toastLabel: string,
  ) => {
    const next: AiTaskModelSlots = {};
    for (const slotId of AI_TASK_SLOT_ORDER) {
      next[slotId] = targetModel;
    }
    applyBulkTaskSlots(next, toastLabel);
  };

  const handleApplyMainModelToAllSlots = () => {
    const mainModel = model.trim();
    if (!mainModel) {
      onNotify(
        'Chưa nhập Model chính ở mục Cấu hình Proxy để áp dụng cho các slot phụ.',
        'err',
      );
      return;
    }
    applySingleModelToAllTaskSlots(
      mainModel,
      `Đã áp dụng Model chính (${mainModel}) cho cả ${AI_TASK_SLOT_ORDER.length} slot AI phụ.`,
    );
  };

  const handleApplyFlashQuotaPreset = () => {
    const flashLiteModel = pickBestModelFromList(
      [/^gemini-3\.5-flash-lite$/i, /gemini-3\.5-flash-lite/i],
      DEFAULT_QUOTA_SAVER_MODEL,
    );
    applySingleModelToAllTaskSlots(
      flashLiteModel,
      `Đã áp dụng Preset tiết kiệm quota (${flashLiteModel}) cho toàn bộ ${AI_TASK_SLOT_ORDER.length} slot AI phụ.`,
    );
  };

  const handleApplyHighQualityPreset = () => {
    const highQualityModel = pickBestModelFromList(
      [/^gemini-3\.8$/i, /pg-gemini-3\.8-flash/i, /gemini-3\.8/i],
      DEFAULT_HIGH_QUALITY_MODEL,
    );
    applySingleModelToAllTaskSlots(
      highQualityModel,
      `Đã áp dụng Preset chất lượng cao (${highQualityModel}) cho toàn bộ ${AI_TASK_SLOT_ORDER.length} slot AI phụ.`,
    );
  };

  const resolvedEnglishStudioPrompt = useMemo(() => {
    const activeStyle = resolveStoryImageStyle(
      storyImageConfig?.stylePreset,
      storyImageConfig?.customStyles,
    );
    const trimmed = String(seedreamPrompt ?? '').trim();
    try {
      if (trimmed && HAS_ANY_IMAGE_TEMPLATE_VAR_RE.test(trimmed)) {
        return previewStoryImagePrompt({
          state: appState,
          storyImageConfig,
          draftTemplate: trimmed,
        }).finalEnglishPrompt;
      }
      if (!trimmed && storyImageConfig?.promptTemplate?.trim()) {
        return previewStoryImagePrompt({
          state: appState,
          storyImageConfig,
          draftTemplate: storyImageConfig.promptTemplate,
        }).finalEnglishPrompt;
      }
    } catch {
      // Fall back cleanly to direct English composition
    }
    const rawPrompt =
      trimmed ||
      'Atmospheric scene and characters in the story world, cinematic lighting, rich crisp visual details';
    const englishBody =
      stripResidualVietnameseFromEnglishClause(
        translateVietnameseVisualToEnglish(rawPrompt),
      ) ||
      'Atmospheric cinematic narrative scene matching the selected visual style';
    return applyImageStyleVariables(
      englishBody,
      activeStyle,
      storyImageConfig?.customStyles,
      storyImageConfig?.cameraAngle,
    );
  }, [appState, seedreamPrompt, storyImageConfig]);

  const handleCopyStudioEnglishPrompt = async () => {
    try {
      await navigator.clipboard.writeText(resolvedEnglishStudioPrompt);
      triggerConfirm('copy_studio_prompt');
      onNotify('Đã sao chép Prompt tiếng Anh cuối cùng.');
    } catch {
      onNotify('Không thể sao chép tự động trên trình duyệt này.', 'err');
    }
  };

  const handleGenerateSeedream = async () => {
    if (asyncActionLockRef.current) return;
    asyncActionLockRef.current = true;
    try {
      const current = buildCurrentPayload();
      onSaveConfig(current);
      const sdSize = current.config.seedreamSize || '1024x1024';
      const activeStyle = resolveStoryImageStyle(
        storyImageConfig.stylePreset,
        storyImageConfig.customStyles,
      );
      const prompt = resolvedEnglishStudioPrompt;

      if (current.config.imageProvider === 'latent') {
        await runLatentImageRequestFromStudio({ isTest: false });
        return;
      }

      if (current.config.imageProvider === 'custom') {
        await runCustomImageRequestFromStudio({ isTest: false });
        return;
      }

    if (current.config.imageProvider === 'comfyui') {
      const comfyBase = (current.config.comfyuiUrl || '').trim();
      const comfyWorkflow = (current.config.comfyuiWorkflowJson || '').trim();
      if (!comfyBase || !comfyWorkflow) {
        const msg =
          'Hãy nhập đầy đủ ComfyUI Base URL và Workflow API JSON trước khi tạo ảnh.';
        appendSeedreamLog(`[ComfyUI] ${msg}`);
        onNotify(msg, 'err');
        return;
      }

      if (imageGenAbortRef.current) {
        onNotify(
          'ComfyUI đang vẽ ảnh thử trước đó, vui lòng chờ xong hoặc bấm Dừng.',
        );
        return;
      }
      const ctrl = new AbortController();
      imageGenAbortRef.current = ctrl;
      appendSeedreamLog(
        `[ComfyUI] Đang gửi workflow · Kích thước: ${sdSize} · Phong cách: ${activeStyle.label}...`,
      );
      setBusyAction('genSeedream');
      try {
        const comfyRes = await requestComfyUiImage({
          baseUrlRaw: comfyBase,
          workflowJson: comfyWorkflow,
          prompt,
          negativePrompt: mergeStoryImageNegativePrompt(
            current.config.comfyuiNegativePrompt || '',
          ),
          size: sdSize,
          nodeMapping: current.config.comfyuiNodeMapping,
          signal: ctrl.signal,
          timeoutMs: COMFYUI_REQUEST_TIMEOUT_MS,
          logPrefix: '[ComfyUI]',
          onLog: appendSeedreamLog,
        });

        if (comfyRes.aborted) {
          onNotify('Đã dừng tạo ảnh ComfyUI.');
          return;
        }
        if (comfyRes.ok && comfyRes.imageUrl) {
          setSeedreamResult({
            url: comfyRes.imageUrl,
            info: `ComfyUI Workflow · Kích thước: ${sdSize} · Phong cách: ${activeStyle.label}`,
          });
          onNotify('Đã tạo ảnh bằng ComfyUI thành công!');
          return;
        }
        onNotify(
          comfyRes.error ||
            'Không thể tạo ảnh từ ComfyUI. Xem log chi tiết bên dưới.',
          'err',
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
        appendSeedreamLog(`[ComfyUI] Lỗi tạo ảnh: ${msg}`);
        onNotify(`Lỗi tạo ảnh ComfyUI: ${msg}`, 'err');
      } finally {
        if (imageGenAbortRef.current === ctrl) {
          imageGenAbortRef.current = null;
        }
        setBusyAction(null);
      }
      return;
    }

    const endpointRaw = current.config.seedreamUrl;
    const apiKey = (
      current.config.seedreamApiKey ||
      current.config.proxyKey ||
      ''
    ).trim();
    const sdModel = current.config.seedreamModel;

    if (!endpointRaw) {
      appendSeedreamLog('Chưa nhập Seedream 5 Pro Endpoint.');
      onNotify(
        'Hãy nhập Seedream 5 Pro Endpoint trước khi tạo ảnh.',
        'err',
      );
      return;
    }

    const ctrl = new AbortController();
    imageGenAbortRef.current?.abort();
    imageGenAbortRef.current = ctrl;
    appendSeedreamLog(
      `Đang gửi yêu cầu tạo ảnh với model ${sdModel} · Phong cách: ${activeStyle.label}...`,
    );
    setBusyAction('genSeedream');
    try {
      const reqRes = await requestSeedreamImage({
        endpointRaw,
        apiKey,
        model: sdModel,
        prompt,
        size: sdSize,
        signal: ctrl.signal,
        timeoutMs: SEEDREAM_REQUEST_TIMEOUT_MS,
        useServerProxy: shouldUseServerProxy(current.config),
        onLog: appendSeedreamLog,
      });

      if (reqRes.aborted) {
        onNotify('Đã dừng tạo ảnh.');
        return;
      }

      if (reqRes.ok && reqRes.imageUrl) {
        setSeedreamResult({
          url: reqRes.imageUrl,
          info: `Model: ${sdModel} · Kích thước: ${sdSize} · Phong cách: ${activeStyle.label}`,
        });
        appendSeedreamLog(`Tạo ảnh thành công từ ${reqRes.usedUrl || endpointRaw}`);
        return;
      }

      onNotify(
        reqRes.error ||
          'Không thể tạo ảnh từ Seedream 5 Pro. Kiểm tra Endpoint, API Key và log bên dưới.',
        'err',
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
      appendSeedreamLog(`Lỗi tạo ảnh Seedream: ${msg}`);
      onNotify(`Lỗi tạo ảnh Seedream: ${msg}`, 'err');
      } finally {
        if (imageGenAbortRef.current === ctrl) {
          imageGenAbortRef.current = null;
        }
        setBusyAction(null);
      }
    } finally {
      asyncActionLockRef.current = false;
    }
  };

  return (
    <section className="space-y-4">
      {/* System Configuration Header */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Cấu hình hệ thống
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Thiết lập kết nối Proxy API, Safety Settings, Prefill khởi động,
              Seedream 5 Pro và thư viện Workflow ComfyUI.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowComfyWorkflowModal(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.09] transition-all hover:bg-white/[0.11] active:scale-[0.985] whitespace-nowrap shrink-0 tabular-nums"
            >
              <FolderCog className="h-3.5 w-3.5 text-emerald-300" />
              <span>
                Thư viện Workflow
                {comfyuiWorkflows.length > 0
                  ? ` (${comfyuiWorkflows.length})`
                  : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSave('save_config')}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] whitespace-nowrap shrink-0"
            >
              {isConfirmed('save_config') ? (
                <Check className="h-3.5 w-3.5 text-emerald-200" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>
                {isConfirmed('save_config') ? '✓ Đã lưu' : 'Lưu Cấu hình'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Tactile Haptic Toggle */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0e1625]/70 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/25">
              <Smartphone className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-100">
                  Rung phản hồi khi chạm nút (Haptic Feedback)
                </span>
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                    hapticFeedbackEnabled
                      ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30'
                      : 'bg-slate-500/15 text-slate-300 ring-white/[0.12]'
                  }`}
                >
                  {hapticFeedbackEnabled ? 'Đang bật' : 'Đã tắt'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                {isHapticSupported()
                  ? 'Rung nhẹ (10ms) khi chạm các nút thao tác trên điện thoại, kết hợp hiệu ứng lún nút và gợn sáng tức thì.'
                  : 'Trình duyệt hoặc thiết bị hiện tại không hỗ trợ API rung (navigator.vibrate); hiệu ứng lún nút và gợn sáng vẫn hoạt động bình thường.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hapticFeedbackEnabled}
            aria-label="Rung phản hồi khi chạm nút"
            onClick={() => {
              const next = !hapticFeedbackEnabled;
              setHapticFeedbackEnabled(next);
              if (next) {
                triggerHapticFeedback(10);
              }
              onSaveConfig(buildCurrentPayload({ hapticFeedbackEnabled: next }));
              onNotify(
                next
                  ? 'Đã bật rung phản hồi nhẹ khi chạm nút.'
                  : 'Đã tắt rung phản hồi khi chạm nút.',
              );
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/40 ${
              hapticFeedbackEnabled
                ? 'bg-sky-500 ring-1 ring-inset ring-sky-300/40'
                : 'bg-slate-700/90 ring-1 ring-inset ring-white/[0.12]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                hapticFeedbackEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Auto Story Beats / Pacing Toggle */}
        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0e1625]/70 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/25">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-100">
                  Nhịp biến cố tự động (Story Beats)
                </span>
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                    autoStoryBeatsEnabled
                      ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30'
                      : 'bg-slate-500/15 text-slate-300 ring-white/[0.12]'
                  }`}
                >
                  {autoStoryBeatsEnabled ? 'Đang bật' : 'Đã tắt'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                Khi trò chuyện 2–3 lượt liên tiếp chưa có biến cố mới, tự chèn nhịp đẩy truyện ngay trong lượt gọi chính (không tốn thêm API call) để NPC chủ động hành động hoặc xuất hiện manh mối.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoStoryBeatsEnabled}
            aria-label="Nhịp biến cố tự động (Story Beats)"
            onClick={() => {
              const next = !autoStoryBeatsEnabled;
              setAutoStoryBeatsEnabled(next);
              onSaveConfig(buildCurrentPayload({ autoStoryBeatsEnabled: next }));
              onNotify(
                next
                  ? 'Đã bật Nhịp biến cố tự động (Story Beats).'
                  : 'Đã tắt Nhịp biến cố tự động (Story Beats).',
              );
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${
              autoStoryBeatsEnabled
                ? 'bg-amber-500 ring-1 ring-inset ring-amber-300/40'
                : 'bg-slate-700/90 ring-1 ring-inset ring-white/[0.12]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                autoStoryBeatsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Proxy API */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Proxy API (ggchan / OpenAI / Gemini)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Tự chuẩn hóa endpoint &amp; thử fallback nhiều đường dẫn.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleDiscoverModels()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  busyAction === 'discoverProxy' ? 'animate-spin' : ''
                }`}
              />
              <span>
                {busyAction === 'discoverProxy' ? 'Đang tải...' : 'Tải Model'}
              </span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleTestProxy()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
            >
              {busyAction === 'testProxy' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>
                {busyAction === 'testProxy' ? 'Đang test...' : 'Test Proxy'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Proxy Base URL / Endpoint
            </label>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://domain.com/v1 hoặc https://generativelanguage.googleapis.com/v1beta/openai"
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              API Key / Token
            </label>
            <div className="relative">
              <input
                type={showProxyKey ? 'text' : 'password'}
                value={proxyKey}
                onChange={(e) => setProxyKey(e.target.value)}
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-2 pl-3 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              <button
                type="button"
                aria-label={showProxyKey ? 'Ẩn API Key' : 'Hiện API Key'}
                onClick={() => setShowProxyKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
              >
                {showProxyKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="VD: gemini-2.5-flash, gemini-2.5-pro, gpt-4o..."
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Danh sách model phát hiện
            </label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setModel(e.target.value);
              }}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            >
              <option value="">
                {discoveredModels.length
                  ? `-- Chọn model (${discoveredModels.length}) --`
                  : '-- Chọn model --'}
              </option>
              {discoveredModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-300">
            Chuẩn giao thức API
          </label>
          <select
            value={apiProtocol}
            onChange={(e) => setApiProtocol(e.target.value as ApiProtocol)}
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          >
            <option value="openai">
              OpenAI Compatible (/v1/chat/completions — khuyên dùng cho ggchan &amp; proxy)
            </option>
            <option value="auto">Tự động nhận diện theo URL</option>
            <option value="gemini">Google Gemini Native (:generateContent)</option>
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0e1625]/75 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-100">
                Đi qua Server Proxy (/api/proxy)
              </span>
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                  useServerProxy
                    ? 'bg-sky-500/15 text-sky-200 ring-sky-400/30'
                    : 'bg-amber-500/15 text-amber-200 ring-amber-400/30'
                }`}
              >
                {useServerProxy ? 'Server Proxy' : 'Direct Fetch trình duyệt'}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
              Bật để tránh lỗi CORS với các proxy bên ngoài (hỗ trợ streaming SSE). Tắt để gọi trực tiếp từ trình duyệt khi dùng endpoint mở sẵn CORS (như Google AI Studio <span className="font-mono text-slate-300">.../v1beta/openai</span>) hoặc khi server đích chặn IP của Server Proxy bằng lỗi HTTP 403.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useServerProxy}
            aria-label="Đi qua Server Proxy (/api/proxy)"
            onClick={() => {
              const next = !useServerProxy;
              setUseServerProxy(next);
              setProxyQuickSwitchHint(null);
              onSaveConfig(buildCurrentPayload({ useServerProxy: next }));
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/40 ${
              useServerProxy
                ? 'bg-sky-500 ring-1 ring-inset ring-sky-300/40'
                : 'bg-slate-700/90 ring-1 ring-inset ring-white/[0.12]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                useServerProxy ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {proxyQuickSwitchHint === 'switch_direct' && useServerProxy && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <span className="min-w-0 flex-1 text-[11.5px] leading-snug">
              Server đích trả về <span className="font-mono font-semibold">HTTP 403</span> qua Server Proxy. Thử chuyển sang gọi trực tiếp từ trình duyệt (Direct Fetch)?
            </span>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => {
                setUseServerProxy(false);
                setProxyQuickSwitchHint(null);
                void handleTestProxy(false);
              }}
              className="inline-flex min-h-[30px] shrink-0 items-center rounded-lg bg-amber-400/20 px-2.5 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-300/35 transition-colors hover:bg-amber-400/30 disabled:opacity-45"
            >
              Chuyển Direct Fetch &amp; Test lại
            </button>
          </div>
        )}

        {proxyQuickSwitchHint === 'switch_server_proxy' && !useServerProxy && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
            <span className="min-w-0 flex-1 text-[11.5px] leading-snug">
              Direct Fetch bị trình duyệt chặn (CORS/Mạng). Thử bật lại Server Proxy (<span className="font-mono">/api/proxy</span>)?
            </span>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => {
                setUseServerProxy(true);
                setProxyQuickSwitchHint(null);
                void handleTestProxy(true);
              }}
              className="inline-flex min-h-[30px] shrink-0 items-center rounded-lg bg-sky-400/20 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-300/35 transition-colors hover:bg-sky-400/30 disabled:opacity-45"
            >
              Bật Server Proxy &amp; Test lại
            </button>
          </div>
        )}

        <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#0e1625]/75 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-100">
                  Gửi kèm ảnh trong màn Truyện (Nén &amp; Nhẹ máy)
                </span>
                <span className="inline-flex items-center rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-200 ring-1 ring-inset ring-sky-400/30">
                  ≤{chatImageMaxInputMb} MB ·{' '}
                  {chatImageMaxDimension > 0
                    ? `${chatImageMaxDimension}px`
                    : 'Giữ gốc'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                Tự động chuẩn hóa &amp; nén ảnh chụp màn hình lớn trước khi gửi qua proxy/mạng di động, và tự xóa dữ liệu ảnh tạm sau khi AI phản hồi xong để nhẹ RAM.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={chatImageAutoClearAfterReply}
              aria-label="Tự động xóa ảnh sau khi AI trả lời"
              onClick={() => {
                const next = !chatImageAutoClearAfterReply;
                setChatImageAutoClearAfterReply(next);
                onSaveConfig(
                  buildCurrentPayload({ chatImageAutoClearAfterReply: next }),
                );
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/40 ${
                chatImageAutoClearAfterReply
                  ? 'bg-sky-500 ring-1 ring-inset ring-sky-300/40'
                  : 'bg-slate-700/90 ring-1 ring-inset ring-white/[0.12]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  chatImageAutoClearAfterReply ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="mt-2 text-[11px] font-medium text-sky-200/85">
            {chatImageAutoClearAfterReply
              ? 'Đang bật: Tự xóa dữ liệu ảnh đính kèm sau khi AI phản hồi xong (giữ nguyên chữ & chú thích).'
              : 'Đang tắt: Giữ lại ảnh đính kèm trên lượt truyện (vẫn có nút Xóa ảnh tạm thủ công).'}
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                Giới hạn tệp đầu vào
              </span>
              <select
                value={chatImageMaxInputMb}
                onChange={(e) => {
                  const val = clampChatImageMaxInputMb(Number(e.target.value));
                  setChatImageMaxInputMb(val);
                  onSaveConfig(
                    buildCurrentPayload({ chatImageMaxInputMb: val }),
                  );
                }}
                className="w-full rounded-lg border border-white/[0.10] bg-[#0b1322] px-2.5 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
              >
                {CHAT_IMAGE_MAX_INPUT_MB_OPTIONS.map((mb) => (
                  <option key={mb} value={mb}>
                    Tối đa {mb} MB / ảnh
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                Resize tự động trước khi gửi
              </span>
              <select
                value={chatImageMaxDimension}
                onChange={(e) => {
                  const val = clampChatImageMaxDimension(Number(e.target.value));
                  setChatImageMaxDimension(val);
                  onSaveConfig(
                    buildCurrentPayload({ chatImageMaxDimension: val }),
                  );
                }}
                className="w-full rounded-lg border border-white/[0.10] bg-[#0b1322] px-2.5 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
              >
                {CHAT_IMAGE_MAX_DIMENSION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                Chất lượng nén JPEG
              </span>
              <select
                value={chatImageQuality}
                onChange={(e) => {
                  const val = clampChatImageQuality(Number(e.target.value));
                  setChatImageQuality(val);
                  onSaveConfig(buildCurrentPayload({ chatImageQuality: val }));
                }}
                className="w-full rounded-lg border border-white/[0.10] bg-[#0b1322] px-2.5 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
              >
                {CHAT_IMAGE_QUALITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3.5 max-h-44 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0c1422]/90 p-3 font-mono text-xs whitespace-pre-wrap break-words text-slate-300">
          {proxyLogs.join('\n')}
        </div>
      </div>

      {/* Dedicated Model Slots for Auxiliary AI Tasks */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Slot Model riêng cho Tác vụ AI phụ
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Tách model riêng cho Gợi ý, Đối chiếu Ảnh mẫu (Vision), AI Đồng nhân và Tác vụ phụ để tối ưu chất lượng &amp; tiết kiệm quota luồng chính. Để trống sẽ tự fallback về Model chính (
              <span className="font-mono text-sky-300">
                {model.trim() || 'Chưa đặt Model chính'}
              </span>
              ).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {AI_TASK_SLOT_ORDER.some((id) => Boolean(taskModels[id]?.trim())) && (
              <button
                type="button"
                onClick={() =>
                  applyBulkTaskSlots(
                    {},
                    `Đã đặt lại toàn bộ ${AI_TASK_SLOT_ORDER.length} slot AI phụ về mặc định theo Model chính.`,
                  )
                }
                className="min-h-[34px] rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
              >
                Đặt lại mặc định
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave('save_slots')}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 whitespace-nowrap"
            >
              {isConfirmed('save_slots') ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>
                {isConfirmed('save_slots') ? '✓ Đã lưu' : 'Lưu Slot Model'}
              </span>
            </button>
          </div>
        </div>

        {/* Bulk Quick-Apply Presets for All Auxiliary Slots */}
        <div className="mb-3.5 rounded-xl border border-white/[0.07] bg-[#0e1625]/70 p-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">
              Cấu hình nhanh hàng loạt (tự lưu ngay):
            </span>
            <span>Vẫn có thể chỉnh tay từng slot bên dưới</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleApplyMainModelToAllSlots}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 transition-all hover:bg-sky-500/25 active:scale-[0.99]"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sky-300" />
              <span className="truncate">Áp dụng Model chính cho tất cả</span>
            </button>
            <button
              type="button"
              onClick={handleApplyFlashQuotaPreset}
              title={`Gán nhanh ${DEFAULT_QUOTA_SAVER_MODEL} cho toàn bộ ${AI_TASK_SLOT_ORDER.length} slot AI phụ`}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/32 transition-all hover:bg-emerald-500/25 active:scale-[0.99]"
            >
              <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="truncate">
                Preset tiết kiệm quota (Flash Lite)
              </span>
            </button>
            <button
              type="button"
              onClick={handleApplyHighQualityPreset}
              title={`Gán nhanh ${DEFAULT_HIGH_QUALITY_MODEL} cho toàn bộ ${AI_TASK_SLOT_ORDER.length} slot AI phụ`}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-violet-500/16 px-3 py-1.5 text-xs font-semibold text-violet-100 ring-1 ring-inset ring-violet-400/34 transition-all hover:bg-violet-500/26 active:scale-[0.99]"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-300" />
              <span className="truncate">
                Preset chất lượng cao (3.8)
              </span>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-400">
            <span>
              Mặc định:{' '}
              <span className="font-mono text-emerald-300/90">
                {DEFAULT_QUOTA_SAVER_MODEL}
              </span>
              {' / '}
              <span className="font-mono text-violet-300/90">
                {DEFAULT_HIGH_QUALITY_MODEL}
              </span>
              {' · Nếu proxy dùng mã riêng có thể sửa trực tiếp hoặc đổi nhanh:'}
            </span>
            <button
              type="button"
              onClick={() =>
                applySingleModelToAllTaskSlots(
                  'pg-gemini-3.8-flash',
                  `Đã áp dụng nhanh mã proxy pg-gemini-3.8-flash cho toàn bộ ${AI_TASK_SLOT_ORDER.length} slot AI phụ.`,
                )
              }
              className="inline-flex min-h-[26px] items-center rounded-lg bg-white/[0.05] px-2 font-mono text-[10.5px] font-semibold text-violet-200 ring-1 ring-inset ring-violet-400/25 transition-colors hover:bg-violet-500/20 hover:text-white whitespace-nowrap"
            >
              Dùng pg-gemini-3.8-flash
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {AI_TASK_SLOT_ORDER.map((slotId) => {
            const meta = AI_TASK_SLOT_META[slotId];
            const rawVal = taskModels[slotId] || '';
            const trimmedVal = rawVal.trim();
            const fallbackMain = model.trim() || 'Model chính';
            const isTestingThis = busyAction === `testSlot_${slotId}`;
            return (
              <div
                key={slotId}
                className="space-y-2 rounded-xl border border-white/[0.08] bg-[#0e1625]/75 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold text-slate-100">
                    {meta.label}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                      trimmedVal
                        ? 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/30'
                        : 'bg-slate-500/15 text-slate-300 ring-white/[0.10]'
                    }`}
                  >
                    {trimmedVal
                      ? `Riêng: ${trimmedVal}`
                      : `Mặc định → ${fallbackMain}`}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {meta.description}
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={rawVal}
                    onChange={(e) =>
                      setTaskModels((prev) => ({
                        ...prev,
                        [slotId]: e.target.value,
                      }))
                    }
                    placeholder={meta.placeholder}
                    className="min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-[#0a1220] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                  {trimmedVal && (
                    <button
                      type="button"
                      title="Xóa để dùng lại model chính mặc định"
                      onClick={() =>
                        setTaskModels((prev) => {
                          const next = { ...prev };
                          delete next[slotId];
                          return next;
                        })
                      }
                      className="min-h-[32px] shrink-0 rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11] hover:text-white"
                    >
                      Mặc định
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleTestTaskSlot(slotId)}
                    className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg bg-emerald-500/14 px-2.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 disabled:opacity-45"
                  >
                    {isTestingThis ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    <span>{isTestingThis ? 'Đang thử...' : 'Test'}</span>
                  </button>
                </div>
                {discoveredModels.length > 0 && (
                  <select
                    value=""
                    aria-label={`Chọn nhanh model cho ${meta.shortLabel}`}
                    onChange={(e) => {
                      if (e.target.value) {
                        setTaskModels((prev) => ({
                          ...prev,
                          [slotId]: e.target.value,
                        }));
                      }
                    }}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0a1220] px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400/75 focus:outline-none"
                  >
                    <option value="">
                      -- Chọn từ {discoveredModels.length} model đã tải --
                    </option>
                    {discoveredModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Settings */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Safety Settings
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Thiết lập ngưỡng an toàn cho payload Gemini/proxy.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetSafety}
            className="min-h-[36px] rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
          >
            Khôi phục BLOCK_NONE
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-slate-400">
              HARM_CATEGORY_SEXUALLY_EXPLICIT
            </label>
            <input
              type="text"
              value={safeSex}
              onChange={(e) => setSafeSex(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-slate-400">
              HARM_CATEGORY_HATE_SPEECH
            </label>
            <input
              type="text"
              value={safeHate}
              onChange={(e) => setSafeHate(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-slate-400">
              HARM_CATEGORY_HARASSMENT
            </label>
            <input
              type="text"
              value={safeHarass}
              onChange={(e) => setSafeHarass(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-slate-400">
              HARM_CATEGORY_DANGEROUS_CONTENT
            </label>
            <input
              type="text"
              value={safeDanger}
              onChange={(e) => setSafeDanger(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
        </div>
      </div>

      {/* Prefill */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Prefill khởi động (Assistant)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Bật/tắt gửi kèm nội dung mồi Assistant khi gọi AI (mặc định Tắt để
              tránh lỗi 400 trên proxy không hỗ trợ prefill).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTogglePrefill(prefill)}
            className={`min-h-[36px] rounded-xl px-3 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              tawaPreset.prefillEnabled
                ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
            }`}
          >
            Prefill: {tawaPreset.prefillEnabled ? 'Bật' : 'Tắt'}
          </button>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">
            Nội dung Prefill khởi động
          </label>
          <textarea
            value={prefill}
            onChange={(e) => setPrefill(e.target.value)}
            rows={2}
            placeholder="<thinking>1. [SYSTEM BOOT & RESOURCE LOADING]"
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>
      </div>

      {/* Image Generation Engine: Seedream 5 Pro / ComfyUI Workflow API / Custom Image API */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 space-y-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-50">
                Hệ thống tạo ảnh ({getImageProviderLabel(imageProvider)})
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {imageProvider === 'comfyui'
                  ? 'Gửi Workflow API JSON qua POST /prompt, theo dõi /history/{prompt_id} và lấy ảnh từ /view cho ảnh truyện & chân dung NPC.'
                  : imageProvider === 'custom'
                    ? 'Kết nối Endpoint tạo ảnh bên ngoài (OpenAI Images hoặc Custom JSON Payload) qua Server Proxy /api/proxy.'
                    : imageProvider === 'latent'
                      ? 'Họa Đồ AI chuẩn giao thức NovelAI / ComfyUI Anima qua Latent.moe, tự động giải nén ZIP qua Server Proxy /api/proxy.'
                      : 'Cấu hình endpoint, API Key riêng (nếu cần), model và trả ảnh trực tiếp.'}
              </p>
            </div>
            <div className="inline-flex flex-wrap rounded-xl bg-[#0e1625]/90 p-1 ring-1 ring-inset ring-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setImageProvider('latent');
                  onSaveConfig(buildCurrentPayload({ imageProvider: 'latent' }));
                }}
                className={`min-h-[32px] rounded-lg px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                  imageProvider === 'latent'
                    ? 'bg-amber-500/22 text-amber-100 ring-1 ring-inset ring-amber-400/45'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Họa Đồ · Latent.moe
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageProvider('seedream');
                  onSaveConfig(buildCurrentPayload({ imageProvider: 'seedream' }));
                }}
                className={`min-h-[32px] rounded-lg px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                  imageProvider === 'seedream'
                    ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Seedream 5 Pro
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageProvider('comfyui');
                  onSaveConfig(buildCurrentPayload({ imageProvider: 'comfyui' }));
                }}
                className={`min-h-[32px] rounded-lg px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                  imageProvider === 'comfyui'
                    ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ComfyUI API
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageProvider('custom');
                  onSaveConfig(buildCurrentPayload({ imageProvider: 'custom' }));
                }}
                className={`min-h-[32px] rounded-lg px-3 text-xs font-semibold transition-all whitespace-nowrap ${
                  imageProvider === 'custom'
                    ? 'bg-violet-500/22 text-violet-100 ring-1 ring-inset ring-violet-400/45'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Custom Image API
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {imageProvider === 'seedream' && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleDiscoverSeedreamModels}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    busyAction === 'discoverSeedream' ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {busyAction === 'discoverSeedream'
                    ? 'Đang tải...'
                    : 'Tải Model'}
                </span>
              </button>
            )}
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleTestSeedream}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
            >
              {busyAction === 'testSeedream' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>
                {busyAction === 'testSeedream'
                  ? 'Đang test...'
                  : imageProvider === 'custom' || imageProvider === 'latent'
                    ? 'Test Tạo Ảnh'
                    : 'Kiểm tra'}
              </span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleGenerateSeedream}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] disabled:opacity-45 whitespace-nowrap"
            >
              {busyAction === 'genSeedream' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              <span>{busyAction === 'genSeedream' ? 'Đang tạo...' : 'Tạo ảnh'}</span>
            </button>
            {(busyAction === 'genSeedream' || busyAction === 'testSeedream') && (
              <button
                type="button"
                onClick={handleStopImageAction}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-rose-500/18 px-3 text-xs font-semibold text-rose-100 ring-1 ring-inset ring-rose-400/35 transition-all hover:bg-rose-500/28 whitespace-nowrap"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Dừng</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave('save_image')}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
            >
              {isConfirmed('save_image') ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>✓ Đã lưu</span>
                </>
              ) : (
                <span>Lưu</span>
              )}
            </button>
          </div>
        </div>

        {imageProvider === 'latent' ? (
          <div className="space-y-3.5">
            {/* Quick Key Banner + API Key */}
            <div className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.09] via-[#0e1625]/90 to-[#0e1625]/95 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-300" />
                  <div>
                    <div className="text-xs font-bold text-amber-100">
                      Họa Đồ AI · Latent.moe (NovelAI / Anima)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Lấy Bearer Token (<code className="font-mono text-amber-200">lat_sk_...</code>) và tự động giải nén ZIP trả về.
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <a
                    href={LATENT_KEYS_DASHBOARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-amber-500/20 px-2.5 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40 transition-colors hover:bg-amber-500/30 whitespace-nowrap"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Lấy Key Latent.moe</span>
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          LATENT_KEYS_DASHBOARD_URL,
                        );
                        triggerConfirm('copy_latent_link');
                        onNotify(
                          `Đã chép link lấy key: ${LATENT_KEYS_DASHBOARD_URL}`,
                        );
                      } catch {
                        onNotify('Không thể sao chép tự động.', 'err');
                      }
                    }}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.12] whitespace-nowrap"
                  >
                    {isConfirmed('copy_latent_link') ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isConfirmed('copy_latent_link')
                        ? '✓ Đã chép'
                        : 'Chép link'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Latent API Key (Bearer Token)
                  </label>
                  <div className="relative">
                    <input
                      type={showLatentKey ? 'text' : 'password'}
                      value={latentApiKey}
                      onChange={(e) => {
                        setLatentApiKey(e.target.value);
                        setLatentTestFeedback(null);
                      }}
                      placeholder="lat_sk_..."
                      className="w-full rounded-xl border border-white/[0.09] bg-[#0a111d]/90 py-2 pl-3 pr-10 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                    />
                    <button
                      type="button"
                      aria-label={
                        showLatentKey ? 'Ẩn Latent Key' : 'Hiện Latent Key'
                      }
                      onClick={() => setShowLatentKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
                    >
                      {showLatentKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-300">
                    <span>Endpoint URL</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLatentUrl(LATENT_DEFAULT_ENDPOINT);
                          onSaveConfig(
                            buildCurrentPayload({
                              latentUrl: LATENT_DEFAULT_ENDPOINT,
                            }),
                          );
                        }}
                        className={`text-[10.5px] font-semibold ${
                          latentUrl.trim() === LATENT_DEFAULT_ENDPOINT
                            ? 'text-amber-300 underline'
                            : 'text-slate-400 hover:text-amber-200'
                        }`}
                      >
                        NovelAI Sync
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nativeUrl = 'https://latent.moe/api/generate';
                          setLatentUrl(nativeUrl);
                          onSaveConfig(
                            buildCurrentPayload({ latentUrl: nativeUrl }),
                          );
                        }}
                        className={`text-[10.5px] font-semibold ${
                          latentUrl.trim() === 'https://latent.moe/api/generate'
                            ? 'text-amber-300 underline'
                            : 'text-slate-400 hover:text-amber-200'
                        }`}
                      >
                        Native Async
                      </button>
                    </div>
                  </label>
                  <input
                    type="text"
                    value={latentUrl}
                    onChange={(e) => {
                      setLatentUrl(e.target.value);
                      setLatentTestFeedback(null);
                    }}
                    onBlur={() => {
                      const norm = normalizeLatentEndpointUrl(latentUrl);
                      if (norm && norm !== latentUrl) setLatentUrl(norm);
                    }}
                    placeholder={LATENT_DEFAULT_ENDPOINT}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0a111d]/90 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
              </div>
            </div>

            {/* Model Selection + Sample Preset Button */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0e1625]/75 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-200">
                  Chọn Model / Preset Họa Đồ
                </label>
                <button
                  type="button"
                  onClick={handleApplyLatentSamplePreset}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-amber-500/18 px-2.5 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/38 transition-colors hover:bg-amber-500/28 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>Nạp Preset Mẫu (Họa Ảnh Đồ Xịn)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LATENT_MODEL_PRESETS.map((m) => {
                  const selected =
                    latentModel.trim().toLowerCase() === m.id.toLowerCase();
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setLatentModel(m.id);
                        onSaveConfig(buildCurrentPayload({ latentModel: m.id }));
                      }}
                      className={`flex flex-col items-start rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-all ${
                        selected
                          ? 'bg-amber-500/16 text-amber-50 ring-amber-400/48'
                          : 'bg-[#09101c]/80 text-slate-300 ring-white/[0.07] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="text-xs font-semibold">{m.label}</span>
                      <span className="mt-0.5 text-[11px] text-slate-400">
                        {m.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Hoặc nhập tên Model tùy chỉnh
                </label>
                <input
                  type="text"
                  value={latentModel}
                  onChange={(e) => setLatentModel(e.target.value)}
                  placeholder="nai-diffusion-4-5-full"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#09101c] px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                />
              </div>
            </div>

            {/* 3 Default Aspect Ratios */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0e1625]/75 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Tỉ lệ khung hình mặc định (Minh họa chính văn &amp; Ảnh NV/NPC)
                </span>
                <span className="rounded-md bg-amber-500/14 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30">
                  {latentSize} px
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {LATENT_ASPECT_RATIOS.map((ratio) => {
                  const active = latentSize.trim() === ratio.value;
                  return (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => handleSelectLatentAspectRatio(ratio.value)}
                      className={`flex flex-col items-start rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition-all ${
                        active
                          ? 'bg-amber-500/18 text-amber-50 ring-amber-400/50 shadow-[0_6px_16px_-8px_rgba(245,158,11,0.45)]'
                          : 'bg-[#09101c]/80 text-slate-300 ring-white/[0.07] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="text-xs font-bold">{ratio.label}</span>
                      <span className="mt-0.5 text-[11px] leading-snug text-slate-400">
                        {ratio.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality Tags + Negative Prompt */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Tag Chất lượng / Họa Đồ (gắn đầu Prompt)
                </label>
                <textarea
                  value={latentPositivePrefix}
                  onChange={(e) => setLatentPositivePrefix(e.target.value)}
                  rows={3}
                  placeholder="masterpiece, best quality, very aesthetic, ultra-detailed..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Negative Prompt (Khử nhiễu / Lỗi tay mặt)
                </label>
                <textarea
                  value={latentNegativePrompt}
                  onChange={(e) => setLatentNegativePrompt(e.target.value)}
                  rows={3}
                  placeholder="lowres, bad anatomy, bad hands, worst quality..."
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                />
              </div>
            </div>

            {/* Advanced NovelAI Parameters */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0e1625]/70">
              <button
                type="button"
                onClick={() => setLatentAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-white/[0.03]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-300" />
                  <span>
                    Tham số NovelAI nâng cao (Steps {latentSteps} · Scale{' '}
                    {latentScale} · {latentSampler})
                  </span>
                </span>
                {latentAdvancedOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {latentAdvancedOpen && (
                <div className="grid grid-cols-2 gap-2.5 border-t border-white/[0.07] p-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Steps (1–50)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={latentSteps}
                      onChange={(e) =>
                        setLatentSteps(
                          Math.max(
                            1,
                            Math.min(50, Number(e.target.value) || DEFAULT_LATENT_STEPS),
                          ),
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.09] bg-[#09101c] px-2.5 py-1.5 text-xs text-slate-100 focus:border-amber-400/70 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      CFG Scale (1–20)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={0.5}
                      value={latentScale}
                      onChange={(e) =>
                        setLatentScale(
                          Math.max(1, Math.min(20, Number(e.target.value) || 5.5)),
                        )
                      }
                      className="w-full rounded-lg border border-white/[0.09] bg-[#09101c] px-2.5 py-1.5 text-xs text-slate-100 focus:border-amber-400/70 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Sampler
                    </label>
                    <select
                      value={latentSampler}
                      onChange={(e) => setLatentSampler(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.09] bg-[#09101c] px-2 py-1.5 text-xs text-slate-100 focus:border-amber-400/70 focus:outline-none"
                    >
                      {LATENT_SAMPLER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Noise Schedule
                    </label>
                    <select
                      value={latentNoiseSchedule}
                      onChange={(e) => setLatentNoiseSchedule(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.09] bg-[#09101c] px-2 py-1.5 text-xs text-slate-100 focus:border-amber-400/70 focus:outline-none"
                    >
                      <option value="native">native (Khuyên dùng)</option>
                      <option value="karras">karras</option>
                      <option value="exponential">exponential</option>
                      <option value="polyexponential">polyexponential</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center gap-4 pt-1 sm:col-span-4">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={latentQualityToggle}
                        onChange={(e) => setLatentQualityToggle(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-[#09101c] accent-amber-400"
                      />
                      <span>qualityToggle</span>
                    </label>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span>ucPreset:</span>
                      <select
                        value={latentUcPreset}
                        onChange={(e) =>
                          setLatentUcPreset(Number(e.target.value) || 0)
                        }
                        className="rounded-lg border border-white/[0.09] bg-[#09101c] px-2 py-1 text-xs text-slate-100"
                      >
                        <option value={0}>0 (Heavy)</option>
                        <option value={1}>1 (Light)</option>
                        <option value={2}>2 (Furry Focus)</option>
                        <option value={3}>3 (Human Focus)</option>
                        <option value={4}>4 (None)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dedicated Direct Fetch vs Server Proxy (/api/proxy) Switch for Latent.moe */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0e1625]/75 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-100">
                    Đi qua Server Proxy (/api/proxy) (Tùy chọn)
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                      latentUseServerProxy
                        ? 'bg-sky-500/15 text-sky-200 ring-sky-400/30'
                        : 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30'
                    }`}
                  >
                    {latentUseServerProxy ? 'Server Proxy' : 'Direct Fetch (Mặc định)'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                  Mặc định gọi trực tiếp (Direct Fetch) vì Latent.moe hỗ trợ <code className="font-mono text-slate-300">CORS *</code>. Chỉ bật <code className="font-mono text-slate-300">/api/proxy</code> nếu mạng của bạn bị chặn kết nối trực tiếp; hệ thống tự động giải nén <code className="font-mono text-slate-300">.zip</code> và dự phòng <code className="font-mono text-slate-300">/api/generate</code>.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={latentUseServerProxy}
                aria-label="Latent.moe đi qua Server Proxy (/api/proxy)"
                onClick={() => {
                  const next = !latentUseServerProxy;
                  setLatentUseServerProxy(next);
                  setLatentTestFeedback(null);
                  onSaveConfig(
                    buildCurrentPayload({ latentUseServerProxy: next }),
                  );
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${
                  latentUseServerProxy
                    ? 'bg-amber-500 ring-1 ring-inset ring-amber-300/40'
                    : 'bg-slate-700/90 ring-1 ring-inset ring-white/[0.12]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    latentUseServerProxy ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Inline Test Result for Latent.moe */}
            {latentTestFeedback && (
              <div
                className={`rounded-xl px-3 py-2.5 text-xs ring-1 ring-inset ${
                  latentTestFeedback.ok
                    ? 'bg-emerald-500/12 text-emerald-100 ring-emerald-400/30'
                    : 'bg-rose-500/12 text-rose-100 ring-rose-400/32'
                }`}
              >
                <div className="flex items-start gap-2">
                  {latentTestFeedback.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-semibold">
                      {latentTestFeedback.title}
                    </div>
                    {latentTestFeedback.detail && (
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed opacity-90">
                        {latentTestFeedback.detail}
                      </pre>
                    )}
                    {(latentTestFeedback.suggestDirectFetch ||
                      latentTestFeedback.suggestServerProxy) && (
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => {
                            const nextProxy = Boolean(
                              latentTestFeedback.suggestServerProxy,
                            );
                            setLatentUseServerProxy(nextProxy);
                            void runLatentImageRequestFromStudio({
                              isTest: true,
                              overrideUseServerProxy: nextProxy,
                            });
                          }}
                          className="inline-flex min-h-[28px] items-center rounded-lg bg-white/[0.10] px-2.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/[0.18] hover:bg-white/[0.16]"
                        >
                          {latentTestFeedback.suggestDirectFetch
                            ? 'Thử chuyển Direct Fetch & Test lại'
                            : 'Bật Server Proxy (/api/proxy) & Test lại'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : imageProvider === 'seedream' ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Seedream 5 Pro Endpoint
                </label>
                <input
                  type="text"
                  value={seedreamUrl}
                  onChange={(e) => setSeedreamUrl(e.target.value)}
                  placeholder="https://.../v1/images/generations"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  API Key Seedream (để trống nếu dùng chung Proxy Key)
                </label>
                <div className="relative">
                  <input
                    type={showSeedreamKey ? 'text' : 'password'}
                    value={seedreamApiKey}
                    onChange={(e) => setSeedreamApiKey(e.target.value)}
                    placeholder="Nhập API Key riêng cho Seedream..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-2 pl-3 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                  <button
                    type="button"
                    aria-label={showSeedreamKey ? 'Ẩn key' : 'Hiện key'}
                    onClick={() => setShowSeedreamKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
                  >
                    {showSeedreamKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Model ảnh
                </label>
                <input
                  type="text"
                  value={seedreamModel}
                  onChange={(e) => setSeedreamModel(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Danh sách model ảnh phát hiện
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setSeedreamModel(e.target.value);
                  }}
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                >
                  <option value="">
                    {discoveredSeedreamModels.length
                      ? `-- Chọn model ảnh (${discoveredSeedreamModels.length}) --`
                      : '-- Chọn model ảnh --'}
                  </option>
                  {discoveredSeedreamModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : imageProvider === 'custom' ? (
          <div className="space-y-3">
            {/* Endpoint URL + Model */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Image Endpoint URL
                </label>
                <input
                  type="text"
                  value={customImageUrl}
                  onChange={(e) => {
                    setCustomImageUrl(e.target.value);
                    setCustomImageTestFeedback(null);
                  }}
                  onBlur={() => {
                    const norm = normalizeCustomImageEndpointUrl(customImageUrl);
                    if (norm && norm !== customImageUrl) {
                      setCustomImageUrl(norm);
                    }
                  }}
                  placeholder="https://latent.moe/v1/images/generations"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/75 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
                />
                {customImageUrl.trim() &&
                  normalizedCustomEndpointPreview &&
                  normalizedCustomEndpointPreview !== customImageUrl.trim() && (
                    <p className="mt-1 truncate font-mono text-[10.5px] text-violet-300">
                      Chuẩn hóa: {normalizedCustomEndpointPreview}
                    </p>
                  )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Tên Model (tùy chọn)
                </label>
                <input
                  type="text"
                  value={customImageModel}
                  onChange={(e) => setCustomImageModel(e.target.value)}
                  placeholder="Để trống nếu endpoint dùng model mặc định"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/75 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
                />
              </div>
            </div>

            {/* Optional API Key + Auth Header selector */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  API Key (tùy chọn — để trống cho endpoint free)
                </label>
                <div className="relative">
                  <input
                    type={showCustomImageKey ? 'text' : 'password'}
                    value={customImageApiKey}
                    onChange={(e) => setCustomImageApiKey(e.target.value)}
                    placeholder="Để trống nếu không cần API Key..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-2 pl-3 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/75 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
                  />
                  <button
                    type="button"
                    aria-label={showCustomImageKey ? 'Ẩn API Key' : 'Hiện API Key'}
                    onClick={() => setShowCustomImageKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
                  >
                    {showCustomImageKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Header gửi API Key
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={
                      customImageAuthHeader.toLowerCase() === 'authorization'
                        ? 'Authorization'
                        : customImageAuthHeader.toLowerCase() === 'x-api-key'
                          ? 'x-api-key'
                          : '__custom__'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Authorization' || val === 'x-api-key') {
                        setCustomImageAuthHeader(val);
                      } else if (
                        customImageAuthHeader.toLowerCase() === 'authorization' ||
                        customImageAuthHeader.toLowerCase() === 'x-api-key'
                      ) {
                        setCustomImageAuthHeader('api-key');
                      }
                    }}
                    aria-label="Chọn kiểu Header API Key"
                    className="w-1/2 rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-2 text-xs text-slate-100 focus:border-violet-400/75 focus:outline-none"
                  >
                    <option value="Authorization">Authorization (Bearer)</option>
                    <option value="x-api-key">x-api-key</option>
                    <option value="__custom__">Header tùy chỉnh</option>
                  </select>
                  <input
                    type="text"
                    value={customImageAuthHeader}
                    onChange={(e) => setCustomImageAuthHeader(e.target.value)}
                    placeholder="Authorization hoặc x-api-key"
                    aria-label="Tên Header Auth"
                    className="w-1/2 rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-400/75 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Request/Response Format Mode */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0e1625]/70 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Chế độ định dạng Request / Response
                </span>
                <div className="inline-flex rounded-lg bg-[#09101c] p-0.5 ring-1 ring-inset ring-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomImageFormatMode('openai');
                      onSaveConfig(
                        buildCurrentPayload({ customImageFormatMode: 'openai' }),
                      );
                    }}
                    className={`min-h-[28px] rounded-md px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      customImageFormatMode === 'openai'
                        ? 'bg-violet-500/24 text-violet-100 ring-1 ring-inset ring-violet-400/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Chuẩn OpenAI Images
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomImageFormatMode('custom_json');
                      onSaveConfig(
                        buildCurrentPayload({
                          customImageFormatMode: 'custom_json',
                        }),
                      );
                    }}
                    className={`min-h-[28px] rounded-md px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      customImageFormatMode === 'custom_json'
                        ? 'bg-violet-500/24 text-violet-100 ring-1 ring-inset ring-violet-400/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Custom JSON Payload
                  </button>
                </div>
              </div>

              {customImageFormatMode === 'openai' ? (
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Gửi payload chuẩn{' '}
                  <code className="font-mono text-slate-300">
                    {'{ model?, prompt, n: 1, size }'}
                  </code>{' '}
                  tới <code className="font-mono text-slate-300">/v1/images/generations</code> hoặc endpoint trực tiếp, tự động đọc{' '}
                  <code className="font-mono text-slate-300">data[0].url</code>,{' '}
                  <code className="font-mono text-slate-300">data[0].b64_json</code>,{' '}
                  <code className="font-mono text-slate-300">image</code>,{' '}
                  <code className="font-mono text-slate-300">images[0]</code> hoặc ảnh nhị phân.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        '{{prompt}}',
                        '{{negative_prompt}}',
                        '{{width}}',
                        '{{height}}',
                        '{{model}}',
                        '{{size}}',
                        '{{seed}}',
                      ].map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() =>
                            setCustomImageJsonTemplate((prev) =>
                              prev.includes(tok) ? prev : `${prev}\n// ${tok}`,
                            )
                          }
                          title={`Biến hỗ trợ: ${tok}`}
                          className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-violet-200 ring-1 ring-inset ring-white/[0.08] hover:bg-violet-500/20"
                        >
                          {tok}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomImageJsonTemplate(DEFAULT_CUSTOM_IMAGE_JSON_TEMPLATE)
                      }
                      className="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                    >
                      Khôi phục mẫu JSON
                    </button>
                  </div>
                  <textarea
                    value={customImageJsonTemplate}
                    onChange={(e) => setCustomImageJsonTemplate(e.target.value)}
                    rows={5}
                    spellCheck={false}
                    className="w-full rounded-xl border border-white/[0.09] bg-[#09101c] px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-400/75 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
                  />
                  {customJsonValidation && !customJsonValidation.ok && (
                    <p className="text-[11px] text-rose-300">
                      {customJsonValidation.error}
                    </p>
                  )}
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Negative Prompt cho {'{{negative_prompt}}'} (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={customImageNegativePrompt}
                      onChange={(e) =>
                        setCustomImageNegativePrompt(e.target.value)
                      }
                      placeholder="bad anatomy, blurry, watermark, text, low quality..."
                      className="w-full rounded-xl border border-white/[0.09] bg-[#09101c] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-400/75 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dedicated Server Proxy (/api/proxy) Switch for Custom Image Endpoint */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0e1625]/75 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-100">
                    Đi qua Server Proxy (/api/proxy)
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                      customImageUseServerProxy
                        ? 'bg-sky-500/15 text-sky-200 ring-sky-400/30'
                        : 'bg-amber-500/15 text-amber-200 ring-amber-400/30'
                    }`}
                  >
                    {customImageUseServerProxy
                      ? 'Server Proxy'
                      : 'Direct Fetch trình duyệt'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                  Mặc định bật để đi qua route <span className="font-mono text-slate-300">/api/proxy</span> tránh lỗi trình duyệt chặn CORS và tải/lưu ảnh mượt trên mobile &amp; PC. Tắt nếu muốn gọi trực tiếp (Direct Fetch).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={customImageUseServerProxy}
                aria-label="Custom Image Endpoint đi qua Server Proxy (/api/proxy)"
                onClick={() => {
                  const next = !customImageUseServerProxy;
                  setCustomImageUseServerProxy(next);
                  setCustomImageTestFeedback(null);
                  onSaveConfig(
                    buildCurrentPayload({ customImageUseServerProxy: next }),
                  );
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400/40 ${
                  customImageUseServerProxy
                    ? 'bg-violet-500 ring-1 ring-inset ring-violet-300/40'
                    : 'bg-slate-700/90 ring-1 ring-inset ring-white/[0.12]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    customImageUseServerProxy ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Inline Test Result & Detailed Error Feedback */}
            {customImageTestFeedback && (
              <div
                className={`rounded-xl px-3 py-2.5 text-xs ring-1 ring-inset ${
                  customImageTestFeedback.ok
                    ? 'bg-emerald-500/12 text-emerald-100 ring-emerald-400/30'
                    : 'bg-rose-500/12 text-rose-100 ring-rose-400/32'
                }`}
              >
                <div className="flex items-start gap-2">
                  {customImageTestFeedback.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-semibold">
                      {customImageTestFeedback.title}
                    </div>
                    {customImageTestFeedback.detail && (
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed opacity-90">
                        {customImageTestFeedback.detail}
                      </pre>
                    )}
                    {(customImageTestFeedback.suggestDirectFetch ||
                      customImageTestFeedback.suggestServerProxy) && (
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => {
                            const nextProxy = Boolean(
                              customImageTestFeedback.suggestServerProxy,
                            );
                            setCustomImageUseServerProxy(nextProxy);
                            void runCustomImageRequestFromStudio({
                              isTest: true,
                              overrideUseServerProxy: nextProxy,
                            });
                          }}
                          className="inline-flex min-h-[28px] items-center rounded-lg bg-white/[0.10] px-2.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/[0.18] hover:bg-white/[0.16]"
                        >
                          {customImageTestFeedback.suggestDirectFetch
                            ? 'Thử chuyển Direct Fetch & Test lại'
                            : 'Bật Server Proxy (/api/proxy) & Test lại'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                ComfyUI Base URL
              </label>
              <input
                type="text"
                value={comfyuiUrl}
                onChange={(e) => setComfyuiUrl(e.target.value)}
                placeholder="http://127.0.0.1:8188 hoặc https://your-comfy-tunnel.example.com"
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/75 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Khởi chạy ComfyUI với{' '}
                <code className="text-slate-300">--enable-cors-header</code> (và
                dùng tunnel HTTPS nếu truy cập Ark Lite qua HTTPS).
              </p>
            </div>

            {/* Quick Workflow Selector & Library trigger */}
            <div className="border-t border-white/[0.07] pt-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-200">
                  Workflow API đang chọn
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowComfyWorkflowModal(true)}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-emerald-500/16 px-2.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/32 transition-colors hover:bg-emerald-500/24 whitespace-nowrap tabular-nums"
                  >
                    <FolderCog className="h-3.5 w-3.5" />
                    <span>
                      Quản lý Workflow
                      {comfyuiWorkflows.length > 0
                        ? ` (${comfyuiWorkflows.length})`
                        : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInlineComfyEditor((v) => !v)}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] whitespace-nowrap"
                  >
                    {showInlineComfyEditor ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        <span>Thu gọn JSON</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        <span>Sửa nhanh JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {comfyuiWorkflows.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                    <select
                      value={activeComfyuiWorkflowId}
                      onChange={(e) =>
                        handleSelectSavedComfyWorkflow(e.target.value)
                      }
                      aria-label="Chọn nhanh Workflow ComfyUI đã lưu"
                      className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/90 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/75 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    >
                      {!activeComfyuiWorkflowId && (
                        <option value="">
                          -- Đang dùng JSON nhập tay (chưa gắn thư viện) --
                        </option>
                      )}
                      {comfyuiWorkflows.map((wf) => (
                        <option key={wf.id} value={wf.id}>
                          {wf.name}
                          {wf.notes ? ` — ${wf.notes}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 1-tap quick switch bar */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {comfyuiWorkflows.map((wf) => {
                      const isActive = wf.id === activeComfyuiWorkflowId;
                      return (
                        <button
                          key={wf.id}
                          type="button"
                          onClick={() => handleSelectSavedComfyWorkflow(wf.id)}
                          className={`min-h-[32px] max-w-[220px] truncate rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/40'
                              : 'bg-white/[0.045] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                          }`}
                          title={wf.notes ? `${wf.name} — ${wf.notes}` : wf.name}
                        >
                          {wf.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    Chưa có workflow nào trong thư viện. Bạn có thể mở{' '}
                    <strong className="font-medium text-slate-200">
                      Quản lý Workflow
                    </strong>{' '}
                    để đặt tên &amp; lưu nhiều workflow, hoặc dán nhanh JSON bên dưới.
                  </span>
                </div>
              )}

              {/* Active workflow concise mapping readout */}
              {comfyWorkflowAnalysis && (
                <div
                  className={`text-xs ${
                    comfyWorkflowAnalysis.ok
                      ? 'text-slate-300'
                      : 'text-rose-300'
                  }`}
                >
                  {comfyWorkflowAnalysis.ok ? (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] tabular-nums">
                      <span className="font-medium text-emerald-300">
                        {activeComfyWorkflow
                          ? activeComfyWorkflow.name
                          : 'JSON hiện tại'}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="text-slate-400">
                        {comfyWorkflowAnalysis.nodeSummaries.length} node
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span>
                        Prompt (+):{' '}
                        <code className="font-mono text-slate-100">
                          {comfyuiNodeMapping.positiveNodeId?.trim() ||
                            comfyWorkflowAnalysis.detected.positiveNodeId ||
                            'chưa thấy'}
                        </code>
                      </span>
                      <span>
                        Prompt (-):{' '}
                        <code className="font-mono text-slate-100">
                          {comfyuiNodeMapping.negativeNodeId?.trim() ||
                            comfyWorkflowAnalysis.detected.negativeNodeId ||
                            'không có'}
                        </code>
                      </span>
                      <span>
                        Seed:{' '}
                        <code className="font-mono text-slate-100">
                          {comfyuiNodeMapping.seedNodeId?.trim() ||
                            comfyWorkflowAnalysis.detected.seedNodeId ||
                            'không có'}
                        </code>
                      </span>
                      <span>
                        Size:{' '}
                        <code className="font-mono text-slate-100">
                          {comfyuiNodeMapping.sizeNodeId?.trim() ||
                            comfyWorkflowAnalysis.detected.sizeNodeId ||
                            'không có'}
                        </code>
                      </span>
                      <span>
                        Ảnh ra:{' '}
                        <code className="font-mono text-slate-100">
                          {comfyuiNodeMapping.outputNodeId?.trim() ||
                            comfyWorkflowAnalysis.detected.outputNodeId ||
                            'tự động'}
                        </code>
                      </span>
                    </div>
                  ) : (
                    <span>{comfyWorkflowAnalysis.error}</span>
                  )}
                </div>
              )}
            </div>

            {showInlineComfyEditor && (
              <div className="space-y-3 border-t border-white/[0.07] pt-3.5">
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-medium text-slate-300">
                      Workflow API JSON (xuất từ ComfyUI → Export (API))
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        ref={comfyWorkflowFileInputRef}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={handleComfyWorkflowFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => comfyWorkflowFileInputRef.current?.click()}
                        className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.11] whitespace-nowrap"
                      >
                        <Upload className="h-3.5 w-3.5 text-emerald-300" />
                        <span>Tải file .json</span>
                      </button>
                      {comfyuiWorkflowJson.trim() && !activeComfyuiWorkflowId && (
                        <button
                          type="button"
                          onClick={handleQuickSaveInlineWorkflow}
                          className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-emerald-500/16 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 transition-colors hover:bg-emerald-500/24 whitespace-nowrap"
                        >
                          <Save className="h-3 w-3" />
                          <span>Lưu vào thư viện</span>
                        </button>
                      )}
                      {comfyuiWorkflowJson.trim() && (
                        <button
                          type="button"
                          onClick={() => setComfyuiWorkflowJson('')}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-rose-500/14 px-2.5 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/25 transition-colors hover:bg-rose-500/24 whitespace-nowrap"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Xóa JSON</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={comfyuiWorkflowJson}
                    onChange={(e) => setComfyuiWorkflowJson(e.target.value)}
                    rows={6}
                    spellCheck={false}
                    placeholder='{"3": {"class_type": "KSampler", "inputs": {...}}, "6": {"class_type": "CLIPTextEncode", "inputs": {"text": ""}}, ...}'
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0b1220]/90 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/75 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Negative Prompt mặc định cho ComfyUI (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={comfyuiNegativePrompt}
                    onChange={(e) => setComfyuiNegativePrompt(e.target.value)}
                    placeholder="bad anatomy, extra fingers, blurry, watermark, text, low quality..."
                    className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/75 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>

                <div className="border-t border-white/[0.07] pt-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      Chỉ định ID Node thủ công (tùy chọn — để trống sẽ tự ánh xạ)
                    </span>
                    {(comfyuiNodeMapping.positiveNodeId ||
                      comfyuiNodeMapping.negativeNodeId ||
                      comfyuiNodeMapping.seedNodeId ||
                      comfyuiNodeMapping.sizeNodeId ||
                      comfyuiNodeMapping.outputNodeId) && (
                      <button
                        type="button"
                        onClick={() => setComfyuiNodeMapping({})}
                        className="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                      >
                        Đặt lại tự động
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">
                        Node Prompt (+)
                      </label>
                      <input
                        type="text"
                        value={comfyuiNodeMapping.positiveNodeId || ''}
                        onChange={(e) =>
                          setComfyuiNodeMapping((prev) => ({
                            ...prev,
                            positiveNodeId: e.target.value,
                          }))
                        }
                        placeholder={
                          comfyWorkflowAnalysis?.ok &&
                          comfyWorkflowAnalysis.detected.positiveNodeId
                            ? `Tự động: ${comfyWorkflowAnalysis.detected.positiveNodeId}`
                            : 'vd: 6'
                        }
                        className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">
                        Node Prompt (-)
                      </label>
                      <input
                        type="text"
                        value={comfyuiNodeMapping.negativeNodeId || ''}
                        onChange={(e) =>
                          setComfyuiNodeMapping((prev) => ({
                            ...prev,
                            negativeNodeId: e.target.value,
                          }))
                        }
                        placeholder={
                          comfyWorkflowAnalysis?.ok &&
                          comfyWorkflowAnalysis.detected.negativeNodeId
                            ? `Tự động: ${comfyWorkflowAnalysis.detected.negativeNodeId}`
                            : 'vd: 7'
                        }
                        className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">
                        Node Seed
                      </label>
                      <input
                        type="text"
                        value={comfyuiNodeMapping.seedNodeId || ''}
                        onChange={(e) =>
                          setComfyuiNodeMapping((prev) => ({
                            ...prev,
                            seedNodeId: e.target.value,
                          }))
                        }
                        placeholder={
                          comfyWorkflowAnalysis?.ok &&
                          comfyWorkflowAnalysis.detected.seedNodeId
                            ? `Tự động: ${comfyWorkflowAnalysis.detected.seedNodeId}`
                            : 'vd: 3'
                        }
                        className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">
                        Node Size (W/H)
                      </label>
                      <input
                        type="text"
                        value={comfyuiNodeMapping.sizeNodeId || ''}
                        onChange={(e) =>
                          setComfyuiNodeMapping((prev) => ({
                            ...prev,
                            sizeNodeId: e.target.value,
                          }))
                        }
                        placeholder={
                          comfyWorkflowAnalysis?.ok &&
                          comfyWorkflowAnalysis.detected.sizeNodeId
                            ? `Tự động: ${comfyWorkflowAnalysis.detected.sizeNodeId}`
                            : 'vd: 5'
                        }
                        className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-[11px] text-slate-400">
                        Node Ảnh ra
                      </label>
                      <input
                        type="text"
                        value={comfyuiNodeMapping.outputNodeId || ''}
                        onChange={(e) =>
                          setComfyuiNodeMapping((prev) => ({
                            ...prev,
                            outputNodeId: e.target.value,
                          }))
                        }
                        placeholder={
                          comfyWorkflowAnalysis?.ok &&
                          comfyWorkflowAnalysis.detected.outputNodeId
                            ? `Tự động: ${comfyWorkflowAnalysis.detected.outputNodeId}`
                            : 'vd: 9'
                        }
                        className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Hỗ trợ tự nhận diện theo kết nối KSampler / CLIPTextEncode /
                    EmptyLatentImage / SaveImage, hoặc chèn trực tiếp{' '}
                    <code className="text-slate-300">{'{{prompt}}'}</code> /{' '}
                    <code className="text-slate-300">{'{{negative_prompt}}'}</code>{' '}
                    vào workflow.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-300">
            Kích thước / Tỷ lệ ảnh{' '}
            {imageProvider === 'latent' ? '(đang dùng cho Latent.moe)' : ''}
          </label>
          <input
            type="text"
            value={imageProvider === 'latent' ? latentSize : seedreamSize}
            onChange={(e) => {
              const nextVal = e.target.value;
              if (imageProvider === 'latent') {
                setLatentSize(nextVal);
              }
              setSeedreamSize(nextVal);
            }}
            placeholder={
              imageProvider === 'latent'
                ? '920x1536, 1536x920 hoặc 1024x1024'
                : '1024x1024 hoặc 896x1152'
            }
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>

        <div className="mt-3">
          <ImageStylePicker
            storyImageConfig={storyImageConfig}
            onUpdateStoryImageConfig={onUpdateStoryImageConfig}
            portraits={collectAllAvailablePortraits(appState)}
            defaultExpanded
            onInsertVariable={(token) =>
              setSeedreamPrompt((prev) =>
                prev.trim() ? `${prev.trimEnd()} ${token}` : token,
              )
            }
            onDownloadImage={onDownloadImage}
            onNotify={onNotify}
          />
        </div>

        <div className="mt-3">
          <ImagePromptTemplatePanel
            appState={appState}
            storyImageConfig={storyImageConfig}
            onUpdateStoryImageConfig={onUpdateStoryImageConfig}
            overrideStoryText={seedreamPrompt.trim() || undefined}
            onDownloadImage={onDownloadImage}
            onNotify={onNotify}
          />
        </div>

        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            Prompt tạo ảnh ({getImageProviderLabel(imageProvider)}) — hỗ trợ biến ${'{story_text}'}, ${'{image_style_name}'}, ${'{image_style_description}'}, ${'{image_style_prompt_guide}'}
          </label>
          <textarea
            value={seedreamPrompt}
            onChange={(e) => setSeedreamPrompt(e.target.value)}
            rows={3}
            placeholder="Mô tả cảnh vật, nhân vật... (có thể chèn biến ${story_text}, ${image_style_name}, ${image_style_description}, ${image_style_prompt_guide} hoặc để trống để dùng Mẫu Prompt sinh ảnh đã lưu)"
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />

          {/* Live Final English Prompt Preview before generating */}
          <div className="rounded-xl border border-indigo-400/22 bg-[#0b1322]/90 p-2.5">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-200">
                <Eye className="h-3.5 w-3.5 text-indigo-300" />
                <span>Xem trước Prompt tiếng Anh liền mạch sẽ gửi đi</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-400">
                  {resolvedEnglishStudioPrompt.length} ký tự
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyStudioEnglishPrompt()}
                  className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-white/[0.06] px-2 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.12] whitespace-nowrap"
                >
                  {isConfirmed('copy_studio_prompt') ? (
                    <Check className="h-3 w-3 text-emerald-300" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>
                    {isConfirmed('copy_studio_prompt') ? '✓ Đã chép' : 'Chép'}
                  </span>
                </button>
              </div>
            </div>
            <p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[#070d18] p-2 font-mono text-[11px] leading-relaxed text-slate-200 ring-1 ring-inset ring-white/[0.06]">
              {resolvedEnglishStudioPrompt}
            </p>
          </div>
        </div>

        {seedreamResult && (
          <div className="mt-3.5 flex flex-col items-stretch rounded-xl bg-[#111b2c]/85 p-3.5 ring-1 ring-inset ring-white/[0.08]">
            <img
              src={seedreamResult.url}
              alt="Ảnh tạo ra"
              referrerPolicy="no-referrer"
              className="mx-auto max-h-80 w-full max-w-sm rounded-xl ring-1 ring-white/[0.10] object-contain"
            />
            <p className="mt-2.5 text-center text-xs text-slate-400">
              {seedreamResult.info}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const rawTag =
                    imageProvider === 'comfyui'
                      ? activeComfyWorkflow?.name || 'comfyui'
                      : imageProvider === 'custom'
                        ? customImageModel || 'custom_image'
                        : imageProvider === 'latent'
                          ? latentModel || 'latent_moe'
                          : seedreamModel || 'seedream';
                  const tag = String(rawTag ?? '').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'image';
                  onDownloadImage(
                    seedreamResult.url,
                    `${tag}_${Date.now()}.png`,
                  );
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải ảnh về máy</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAttachSeedreamToChat(
                    seedreamResult.url,
                    seedreamPrompt.trim().slice(0, 120),
                  )
                }
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                <span>Gắn vào hàng chờ ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => setSeedreamResult(null)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa ảnh trả về</span>
              </button>
            </div>
          </div>
        )}

        <div className="mt-3.5 max-h-32 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0c1422]/90 p-3 font-mono text-xs whitespace-pre-wrap break-words text-slate-300">
          {seedreamLogs.join('\n')}
        </div>
      </div>

      {showComfyWorkflowModal && (
        <ComfyWorkflowManagerModal
          workflows={comfyuiWorkflows}
          activeWorkflowId={activeComfyuiWorkflowId}
          initialDraftJson={comfyuiWorkflowJson}
          initialDraftNegativePrompt={comfyuiNegativePrompt}
          initialDraftNodeMapping={comfyuiNodeMapping}
          onApplyChanges={handleApplyWorkflowLibrary}
          onClose={() => setShowComfyWorkflowModal(false)}
          onNotify={onNotify}
        />
      )}
    </section>
  );
}
