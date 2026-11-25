import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  Eye,
  Filter,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  MapPin,
  Maximize2,
  Pin,
  Plus,
  RefreshCw,
  ScanFace,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Upload,
  User,
  Users,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  getImageProviderLabel,
  type AppConfig,
  type CharacterIdentityLock,
  type CharacterPortrait,
  type PortraitBankConfig,
  type PortraitGenProgress,
  type StoryClockState,
  type ViewName,
} from '../types/ark';
import {
  composeCharacterIdentityLockPrompt,
  computeAvatarSignature,
  deriveReferenceComparisonPromptPatch,
  hasAnyCharacterIdentityLock,
  resolveModelForTask,
} from '../utils/api';
import {
  buildOnlineCharacterKeySet,
  classifySuspiciousPortraitJunk,
  computeAgeFromBirthday,
  formatAgeBirthdayLabel,
  isCharacterOnlineInSet,
  lookupKnownCelebrityProfile,
  resolveEffectiveCharacterAge,
} from '../utils/characterUtils';
import {
  importExternalAvatarFromFile,
  importExternalAvatarFromUrl,
} from '../utils/avatarUpload';
import { compressSampleImageForStorage } from '../utils/imageStyles';
import {
  extractExplicitHairProfileEn,
  extractTattooAndBodyMarkingsEn,
} from '../utils/imagePromptComposer';
import { matchesQuery } from '../utils/search';
import { useActionConfirmFeedback } from '../utils/touchFeedback';
import { CharacterNameBadge } from './CharacterNameBadge';
import { resolvePortraitRoleBadge } from './ContextCharacterControlPanel';
import { ResolvedAvatarImage } from './ResolvedAvatarImage';

export interface BgPortraitStatus {
  active: boolean;
  text: string;
  isErr?: boolean;
}

interface PortraitBankPanelProps {
  portraitBank: PortraitBankConfig;
  appConfig?: AppConfig;
  activeCompanionName: string;
  storyClock?: StoryClockState;
  hasSeedreamConfigured: boolean;
  generatingPortraitIds: string[];
  portraitProgress?: Record<string, PortraitGenProgress>;
  portraitErrors?: Record<string, string>;
  enrichingAppearanceIds: string[];
  analyzingIdentityIds?: string[];
  verifyingReferenceIds?: string[];
  isEnrichingAppearances: boolean;
  bgPortraitStatus: BgPortraitStatus | null;
  onlineCharacterNames?: string[];
  currentPage?: number;
  turnCount?: number;
  compact?: boolean;
  onClose?: () => void;
  onNavigate: (view: ViewName) => void;
  onUpdatePortraitBank: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
  onSyncFromCompanion: () => void;
  onCleanJunkPortraits: () => void;
  onAutoFillAppearances: () => void;
  onRefreshPortraitAppearance: (portraitId: string, force?: boolean) => void;
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
  onScanCurrentPagePortraits?: (turnIndex: number) => void;
  onCancelBgPortraits: () => void;
  onDismissBgPortraitStatus?: () => void;
  onDownloadImage: (imgSrc: string, filename: string) => void;
  onOpenImagePicker?: (portraitId: string, portraitName: string) => void;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
}

type PortraitFilter = 'all' | 'with_img' | 'missing_img' | 'junk';

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export function PortraitBankPanel({
  portraitBank,
  appConfig,
  activeCompanionName,
  storyClock,
  hasSeedreamConfigured,
  generatingPortraitIds,
  portraitProgress,
  portraitErrors,
  enrichingAppearanceIds,
  analyzingIdentityIds = [],
  verifyingReferenceIds = [],
  isEnrichingAppearances,
  bgPortraitStatus,
  onlineCharacterNames,
  currentPage = 0,
  turnCount = 0,
  compact = false,
  onClose,
  onNavigate,
  onUpdatePortraitBank,
  onSyncFromCompanion,
  onCleanJunkPortraits,
  onAutoFillAppearances,
  onRefreshPortraitAppearance,
  onGeneratePortrait,
  onPreviewPortraitPrompt,
  onAnalyzePortraitIdentity,
  onVerifyPortraitAgainstReference,
  onCancelPortrait,
  onScanCurrentPagePortraits,
  onCancelBgPortraits,
  onDismissBgPortraitStatus,
  onDownloadImage,
  onOpenImagePicker,
  onNotify,
}: PortraitBankPanelProps) {
  const isComfyProvider = appConfig?.imageProvider === 'comfyui';
  const isAnyComfyBusy = isComfyProvider && generatingPortraitIds.length > 0;
  const imageProviderLabel = getImageProviderLabel(appConfig?.imageProvider);
  const refCheckModelInfo = useMemo(
    () => resolveModelForTask(appConfig, 'referenceCheck'),
    [appConfig],
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PortraitFilter>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newBirthday, setNewBirthday] = useState('');
  const [newFashionStyle, setNewFashionStyle] = useState('');
  const [newAppearance, setNewAppearance] = useState('');
  const [newPersonality, setNewPersonality] = useState('');
  const [newRelationships, setNewRelationships] = useState('');
  const [newSignature, setNewSignature] = useState('');
  const [newCurrentLocation, setNewCurrentLocation] = useState('');
  const [newPrivateSecret, setNewPrivateSecret] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [editFashionStyle, setEditFashionStyle] = useState('');
  const [editAppearance, setEditAppearance] = useState('');
  const [editPersonality, setEditPersonality] = useState('');
  const [editRelationships, setEditRelationships] = useState('');
  const [editSignature, setEditSignature] = useState('');
  const [editCurrentLocation, setEditCurrentLocation] = useState('');
  const [editPrivateSecret, setEditPrivateSecret] = useState('');
  const [editLockGender, setEditLockGender] = useState('');
  const [editLockFacial, setEditLockFacial] = useState('');
  const [editLockHairstyle, setEditLockHairstyle] = useState('');
  const [editLockSignatureStyle, setEditLockSignatureStyle] = useState('');
  const [editLockFixedTags, setEditLockFixedTags] = useState('');
  const [editAvatarVisualLock, setEditAvatarVisualLock] = useState('');
  const [editReferenceImageData, setEditReferenceImageData] = useState<
    string | undefined
  >(undefined);
  const [uploadingRefId, setUploadingRefId] = useState<string | null>(null);
  const [refUploadError, setRefUploadError] = useState<string | null>(null);
  const refPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const refUploadTargetIdRef = useRef<string | null>(null);

  // Direct external Avatar upload (device file + URL paste)
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(
    null,
  );
  const { isConfirmed, triggerConfirm } = useActionConfirmFeedback(1150);
  const [avatarUploadFeedback, setAvatarUploadFeedback] = useState<
    Record<string, { type: 'ok' | 'warn' | 'err'; text: string }>
  >({});
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarUploadTargetIdRef = useRef<string | null>(null);

  const [urlEditorId, setUrlEditorId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlPreviewData, setUrlPreviewData] = useState<string | null>(null);
  const [urlPreviewWarning, setUrlPreviewWarning] = useState<string | null>(
    null,
  );
  const [urlPreviewError, setUrlPreviewError] = useState<string | null>(null);

  // Per-character English prompt preview & direct inline editing
  const [promptPreviewId, setPromptPreviewId] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPromptDraft, setEditingPromptDraft] = useState('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const copyPromptTimerRef = useRef<number | null>(null);
  const [expandedToolIds, setExpandedToolIds] = useState<string[]>([]);

  const saveCustomPromptForPortrait = (
    portraitId: string,
    rawPrompt: string,
    portraitName?: string,
  ) => {
    const cleaned = String(rawPrompt ?? '')
      .replace(/\s*\n+\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 2400);
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((item) =>
        item.id === portraitId
          ? {
              ...item,
              customPrompt: cleaned || undefined,
              updatedAt: Date.now(),
            }
          : item,
      ),
    }));
    setEditingPromptId(null);
    onNotify?.(
      cleaned
        ? `Đã lưu prompt chỉnh tay cho ${portraitName || 'nhân vật'}. Khi tạo ảnh sẽ dùng nguyên bản prompt này.`
        : `Đã xóa prompt chỉnh tay của ${portraitName || 'nhân vật'} — quay về prompt tự động từ hồ sơ.`,
      'info',
    );
  };

  const resetCustomPromptFromProfile = (
    portraitId: string,
    portraitName?: string,
    keepEditorOpen = false,
  ) => {
    const rebuilt = onPreviewPortraitPrompt
      ? String(
          onPreviewPortraitPrompt(portraitId, { ignoreCustomPrompt: true }) ??
            '',
        )
      : '';
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((item) =>
        item.id === portraitId
          ? {
              ...item,
              customPrompt: undefined,
              updatedAt: Date.now(),
            }
          : item,
      ),
    }));
    if (keepEditorOpen) {
      setEditingPromptDraft(rebuilt);
    } else {
      setEditingPromptId(null);
    }
    onNotify?.(
      `Đã dựng lại prompt chuẩn từ hồ sơ cố định cho ${portraitName || 'nhân vật'}.`,
      'info',
    );
  };

  // Live 1-second tick for generation elapsed time
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (generatingPortraitIds.length === 0) return;
    setNowTick(Date.now());
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [generatingPortraitIds.length]);

  useEffect(
    () => () => {
      if (copyPromptTimerRef.current !== null) {
        window.clearTimeout(copyPromptTimerRef.current);
      }
    },
    [],
  );

  const prevAnalyzingIdsRef = useRef<string[]>([]);
  const [expandedDetailIds, setExpandedDetailIds] = useState<string[]>([]);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  const lightbox = useMemo(
    () =>
      lightboxId
        ? (portraitBank.portraits || []).find((p) => p.id === lightboxId) ||
          null
        : null,
    [lightboxId, portraitBank.portraits],
  );

  useEffect(() => {
    setLightboxZoomed(false);
  }, [lightbox?.id, lightbox?.imageData]);

  // When AI Vision finishes analyzing the currently edited portrait, sync fresh fields into the form
  useEffect(() => {
    const prev = prevAnalyzingIdsRef.current;
    prevAnalyzingIdsRef.current = analyzingIdentityIds;
    if (!editingId) return;
    if (prev.includes(editingId) && !analyzingIdentityIds.includes(editingId)) {
      const updated = (portraitBank.portraits || []).find(
        (p) => p.id === editingId,
      );
      if (updated) {
        setEditLockGender(updated.identityLock?.gender || '');
        setEditLockFacial(updated.identityLock?.facialFeatures || '');
        setEditLockHairstyle(updated.identityLock?.hairstyle || '');
        setEditLockSignatureStyle(updated.identityLock?.signatureStyle || '');
        setEditLockFixedTags(updated.identityLock?.fixedTags || '');
        setEditAvatarVisualLock(updated.avatarVisualLock || '');
        setEditReferenceImageData(updated.referenceImageData);
      }
    }
  }, [analyzingIdentityIds, editingId, portraitBank.portraits]);

  useEffect(() => {
    if (!lightboxId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxId]);

  const toggleDetailExpand = (id: string) => {
    setExpandedDetailIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleToolsExpand = (id: string) => {
    setExpandedToolIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const portraits = portraitBank.portraits || [];
  const withImageCount = useMemo(
    () => portraits.filter((p) => Boolean(p.imageData)).length,
    [portraits],
  );

  const suspectedJunkMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof classifySuspiciousPortraitJunk>>();
    for (const p of portraits) {
      const reason = classifySuspiciousPortraitJunk(p, undefined, portraits);
      if (reason) {
        map.set(p.id, reason);
      }
    }
    return map;
  }, [portraits]);

  const suspectedJunkPortraits = useMemo(
    () => portraits.filter((p) => suspectedJunkMap.has(p.id)),
    [portraits, suspectedJunkMap],
  );

  // Auto-clean blatant non-person / cultivation / lyric junk entries when opening Portrait Bank
  // (preserves MC and all valid real characters without requiring manual deletion)
  const autoCleanSigRef = useRef<string>('');
  useEffect(() => {
    const hardJunk = portraits.filter((p) => {
      if (p.isMc) return false;
      const reason = suspectedJunkMap.get(p.id);
      return reason === 'non_person' || reason === 'lyric_slang';
    });
    if (!hardJunk.length) return;
    const sig = hardJunk
      .map((p) => p.id)
      .sort()
      .join('|');
    if (autoCleanSigRef.current === sig) return;
    autoCleanSigRef.current = sig;
    const junkIds = new Set(hardJunk.map((p) => p.id));
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).filter((p) => p.isMc || !junkIds.has(p.id)),
    }));
  }, [portraits, suspectedJunkMap, onUpdatePortraitBank]);

  const handleQuickDeleteSuspectedJunk = () => {
    if (!suspectedJunkPortraits.length) {
      onCleanJunkPortraits();
      triggerConfirm('clean_junk');
      onNotify?.('Đã rà soát — không phát hiện tên NPC rác mới.');
      return;
    }
    const junkIds = new Set(suspectedJunkPortraits.map((p) => p.id));
    const removedNames = suspectedJunkPortraits.map((p) => p.name);
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).filter((p) => !junkIds.has(p.id)),
    }));
    // Also trigger full junk cleanup across Character States & Companion roster
    onCleanJunkPortraits();
    triggerConfirm('clean_junk');
    if (filter === 'junk') {
      setFilter('all');
    }
    const preview = removedNames.slice(0, 4).join(', ');
    onNotify?.(
      `Đã xóa nhanh ${removedNames.length} mục NPC rác (${preview}${
        removedNames.length > 4 ? '...' : ''
      }) mà không ảnh hưởng tới nhân vật hợp lệ.`,
    );
  };

  const filteredPortraits = useMemo(() => {
    const sorted = [...portraits].sort((a, b) => {
      if (a.isMc !== b.isMc) return a.isMc ? -1 : 1;
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      const aHas = a.imageData ? 1 : 0;
      const bHas = b.imageData ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return sorted.filter((p) => {
      if (filter === 'with_img' && !p.imageData) return false;
      if (filter === 'missing_img' && p.imageData) return false;
      if (filter === 'junk' && !suspectedJunkMap.has(p.id)) return false;
      if (
        query.trim() &&
        !matchesQuery(
          `${p.name} ${p.role} ${p.age || ''} ${p.birthday || ''} ${p.fashionStyle || ''} ${p.appearance} ${p.personality || ''} ${p.relationships || ''} ${p.signature || ''} ${p.currentLocation || ''} ${p.privateSecret || ''} ${p.contextSnippet || ''}`,
          query,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [portraits, filter, query, suspectedJunkMap]);

  const onlineCharacterKeySet = useMemo(
    () => buildOnlineCharacterKeySet(onlineCharacterNames),
    [onlineCharacterNames],
  );

  const handleAddCharacter = () => {
    const name = newName.trim();
    if (!name) return;
    const nowTs = Date.now();
    const manualAge = newAge.trim();
    const manualBirth = newBirthday.trim();
    const manualFashion = newFashionStyle.trim();
    const manualApp = newAppearance.trim();
    const manualPers = newPersonality.trim();
    const manualRel = newRelationships.trim();
    const manualSig = newSignature.trim();
    const manualLocation = newCurrentLocation.trim();
    const manualSecret = newPrivateSecret.trim();
    const hasManualVivid = Boolean(
      manualAge ||
        manualBirth ||
        manualFashion ||
        manualPers ||
        manualRel ||
        manualSig ||
        manualLocation ||
        manualSecret,
    );
    const celeb = lookupKnownCelebrityProfile(name);
    const createdId = `port_custom_${nowTs}_${Math.random().toString(36).slice(2, 5)}`;
    const finalBirthday = manualBirth || celeb?.birthday || '';
    const finalAge =
      manualAge || computeAgeFromBirthday(finalBirthday, storyClock);
    const finalFashion = manualFashion || celeb?.fashionStyle || '';
    const finalPersonality = manualPers || celeb?.personality || '';
    const finalRelationships = manualRel || celeb?.relationships || '';
    const finalSignature = manualSig || celeb?.signature || '';
    const created: CharacterPortrait = {
      id: createdId,
      name: celeb?.canonicalName || name,
      role: newRole.trim() || celeb?.role || 'NPC',
      ...(finalAge ? { age: finalAge } : {}),
      ...(finalBirthday ? { birthday: finalBirthday } : {}),
      ...(finalFashion ? { fashionStyle: finalFashion } : {}),
      appearance: manualApp || celeb?.appearance || '',
      ...(finalPersonality ? { personality: finalPersonality } : {}),
      ...(finalRelationships ? { relationships: finalRelationships } : {}),
      ...(finalSignature ? { signature: finalSignature } : {}),
      ...(manualLocation ? { currentLocation: manualLocation } : {}),
      ...(manualSecret ? { privateSecret: manualSecret } : {}),
      appearanceManual: Boolean(manualApp),
      profileManual: hasManualVivid,
      isMc: false,
      updatedAt: nowTs,
    };
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: [created, ...(prev.portraits || [])],
    }));
    setNewName('');
    setNewRole('');
    setNewAge('');
    setNewBirthday('');
    setNewFashionStyle('');
    setNewAppearance('');
    setNewPersonality('');
    setNewRelationships('');
    setNewSignature('');
    setNewCurrentLocation('');
    setNewPrivateSecret('');
    setShowAddForm(false);
    if (!manualApp && !hasManualVivid) {
      window.setTimeout(() => {
        onRefreshPortraitAppearance(createdId, false);
      }, 40);
    }
  };

  const startEdit = (p: CharacterPortrait) => {
    setEditingId(p.id);
    setEditName(String(p.name ?? ''));
    setEditRole(String(p.role ?? ''));
    setEditAge(String(p.age ?? ''));
    setEditBirthday(String(p.birthday ?? ''));
    setEditFashionStyle(String(p.fashionStyle ?? ''));
    setEditAppearance(String(p.appearance ?? ''));
    setEditPersonality(String(p.personality ?? ''));
    setEditRelationships(String(p.relationships ?? ''));
    setEditSignature(String(p.signature ?? ''));
    setEditCurrentLocation(String(p.currentLocation ?? ''));
    setEditPrivateSecret(String(p.privateSecret ?? ''));
    setEditLockGender(String(p.identityLock?.gender ?? ''));
    setEditLockFacial(String(p.identityLock?.facialFeatures ?? ''));
    setEditLockHairstyle(String(p.identityLock?.hairstyle ?? ''));
    setEditLockSignatureStyle(String(p.identityLock?.signatureStyle ?? ''));
    setEditLockFixedTags(String(p.identityLock?.fixedTags ?? ''));
    setEditAvatarVisualLock(String(p.avatarVisualLock ?? ''));
    setEditReferenceImageData(p.referenceImageData);
    setRefUploadError(null);
  };

  const saveEdit = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const trimmedAge = editAge.trim();
    const trimmedBirth = editBirthday.trim();
    const trimmedFashion = editFashionStyle.trim();
    const trimmedApp = editAppearance.trim();
    const trimmedPers = editPersonality.trim();
    const trimmedRel = editRelationships.trim();
    const trimmedSig = editSignature.trim();
    const trimmedLocation = editCurrentLocation.trim();
    const trimmedSecret = editPrivateSecret.trim();
    const nextIdentityLockRaw: CharacterIdentityLock = {
      gender: editLockGender.trim() || undefined,
      facialFeatures: editLockFacial.trim() || undefined,
      hairstyle: editLockHairstyle.trim() || undefined,
      signatureStyle: editLockSignatureStyle.trim() || undefined,
      fixedTags: editLockFixedTags.trim() || undefined,
    };
    const nextIdentityLock = hasAnyCharacterIdentityLock(nextIdentityLockRaw)
      ? nextIdentityLockRaw
      : undefined;
    const manualVisualLock = editAvatarVisualLock.trim();
    const effectiveVisualLock =
      manualVisualLock ||
      (nextIdentityLock
        ? composeCharacterIdentityLockPrompt(nextIdentityLock, '')
        : '');

    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) => {
        if (p.id !== id) return p;
        const appearanceChanged = trimmedApp !== (p.appearance || '').trim();
        const avatarLockChanged =
          effectiveVisualLock !== (p.avatarVisualLock || '').trim() ||
          JSON.stringify(nextIdentityLock || null) !==
            JSON.stringify(p.identityLock || null);
        const vividChanged =
          trimmedAge !== (p.age || '').trim() ||
          trimmedBirth !== (p.birthday || '').trim() ||
          trimmedFashion !== (p.fashionStyle || '').trim() ||
          trimmedPers !== (p.personality || '').trim() ||
          trimmedRel !== (p.relationships || '').trim() ||
          trimmedSig !== (p.signature || '').trim() ||
          trimmedLocation !== (p.currentLocation || '').trim() ||
          trimmedSecret !== (p.privateSecret || '').trim();
        const hasAnyVivid = Boolean(
          trimmedAge ||
            trimmedBirth ||
            trimmedFashion ||
            trimmedPers ||
            trimmedRel ||
            trimmedSig ||
            trimmedLocation ||
            trimmedSecret,
        );
        const anchorImg = editReferenceImageData || p.imageData;
        const currentAnchorSig = anchorImg
          ? computeAvatarSignature(anchorImg)
          : '';
        return {
          ...p,
          name,
          role: editRole.trim(),
          age: trimmedAge || undefined,
          birthday: trimmedBirth || undefined,
          fashionStyle: trimmedFashion || undefined,
          appearance: trimmedApp,
          personality: trimmedPers || undefined,
          relationships: trimmedRel || undefined,
          signature: trimmedSig || undefined,
          currentLocation: trimmedLocation || undefined,
          privateSecret: trimmedSecret || undefined,
          referenceImageData: editReferenceImageData || undefined,
          identityLock: nextIdentityLock,
          avatarVisualLock: effectiveVisualLock || undefined,
          avatarLockSourceSig: effectiveVisualLock
            ? avatarLockChanged
              ? currentAnchorSig || p.avatarLockSourceSig
              : p.avatarLockSourceSig
            : undefined,
          appearanceManual: trimmedApp
            ? appearanceChanged
              ? true
              : Boolean(p.appearanceManual)
            : false,
          profileManual: hasAnyVivid
            ? vividChanged
              ? true
              : Boolean(p.profileManual)
            : false,
          updatedAt: Date.now(),
        };
      }),
    }));
    setEditingId(null);
  };

  const triggerReferencePhotoUpload = (portraitId: string) => {
    setRefUploadError(null);
    refUploadTargetIdRef.current = portraitId;
    if (refPhotoInputRef.current) {
      refPhotoInputRef.current.value = '';
      refPhotoInputRef.current.click();
    }
  };

  const handleRefPhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    const targetId = refUploadTargetIdRef.current;
    e.target.value = '';
    if (!file || !targetId) return;
    setUploadingRefId(targetId);
    setRefUploadError(null);
    try {
      const { dataUrl } = await compressSampleImageForStorage(file, {
        maxEdge: 768,
        quality: 0.82,
      });
      if (!dataUrl) throw new Error('Không thể nén ảnh mẫu.');
      onUpdatePortraitBank((prev) => ({
        ...prev,
        portraits: (prev.portraits || []).map((p) =>
          p.id === targetId
            ? {
                ...p,
                referenceImageData: dataUrl,
                avatarLockSourceSig: undefined,
                updatedAt: Date.now(),
              }
            : p,
        ),
      }));
      if (editingId === targetId) {
        setEditReferenceImageData(dataUrl);
      }
      if (onAnalyzePortraitIdentity) {
        onAnalyzePortraitIdentity(targetId, {
          overwrite: false,
          imageDataOverride: dataUrl,
          isRealPhoto: true,
        });
      }
    } catch (err) {
      setRefUploadError(
        err instanceof Error ? err.message : 'Không thể đọc ảnh mẫu người thật.',
      );
    } finally {
      setUploadingRefId(null);
      refUploadTargetIdRef.current = null;
    }
  };

  const handleClearReferencePhoto = (id: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === id
          ? {
              ...p,
              referenceImageData: undefined,
              avatarLockSourceSig: p.imageData
                ? computeAvatarSignature(p.imageData)
                : undefined,
              updatedAt: Date.now(),
            }
          : p,
      ),
    }));
    if (editingId === id) {
      setEditReferenceImageData(undefined);
    }
  };

  const handleClearImage = (id: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === id
          ? {
              ...p,
              imageData: undefined,
              prompt: undefined,
              autoGenerated: undefined,
              updatedAt: Date.now(),
            }
          : p,
      ),
    }));
  };

  const handleDeleteEntry = (id: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).filter((p) => p.id !== id),
    }));
  };

  const applyExternalAvatarToPortrait = (
    portraitId: string,
    imageData: string,
    sourceLabel: string,
  ) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((item) =>
        item.id === portraitId
          ? {
              ...item,
              imageData,
              prompt: sourceLabel,
              autoGenerated: false,
              avatarLockSourceSig: undefined,
              updatedAt: Date.now(),
            }
          : item,
      ),
    }));
  };

  const triggerDirectAvatarUpload = (portraitId: string) => {
    avatarUploadTargetIdRef.current = portraitId;
    setAvatarUploadFeedback((prev) => {
      if (!prev[portraitId]) return prev;
      const next = { ...prev };
      delete next[portraitId];
      return next;
    });
    avatarFileInputRef.current?.click();
  };

  const handleDirectAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetId = avatarUploadTargetIdRef.current;
    if (!file || !targetId) return;

    setUploadingAvatarId(targetId);
    try {
      const res = await importExternalAvatarFromFile(file);
      if (!res.ok || !res.imageData) {
        const errText =
          res.error || 'Không thể tải ảnh từ thiết bị làm Avatar.';
        setAvatarUploadFeedback((prev) => ({
          ...prev,
          [targetId]: { type: 'err', text: errText },
        }));
        onNotify?.(errText, 'err');
        return;
      }
      applyExternalAvatarToPortrait(
        targetId,
        res.imageData,
        `Ảnh tải từ thiết bị: ${file.name}`,
      );
      const okMsg =
        res.warning || res.note || `Đã gán Avatar từ tệp "${file.name}".`;
      setAvatarUploadFeedback((prev) => ({
        ...prev,
        [targetId]: { type: res.warning ? 'warn' : 'ok', text: okMsg },
      }));
      onNotify?.(okMsg, 'info');
    } finally {
      setUploadingAvatarId(null);
    }
  };

  const openUrlEditorFor = (portraitId: string) => {
    if (urlEditorId === portraitId) {
      setUrlEditorId(null);
      return;
    }
    setUrlEditorId(portraitId);
    setUrlDraft('');
    setUrlPreviewData(null);
    setUrlPreviewWarning(null);
    setUrlPreviewError(null);
  };

  const handleCheckUrlAvatar = async (portraitId: string, applyImmediately = false) => {
    const clean = urlDraft.trim();
    if (!clean) {
      setUrlPreviewError('Vui lòng dán đường dẫn URL ảnh hợp lệ.');
      return;
    }
    setUrlBusy(true);
    setUrlPreviewError(null);
    setUrlPreviewWarning(null);
    try {
      const res = await importExternalAvatarFromUrl(clean);
      if (!res.ok || !res.imageData) {
        setUrlPreviewData(null);
        const errMsg =
          res.error || 'Không thể tải ảnh từ URL này. Kiểm tra lại link hoặc CORS.';
        setUrlPreviewError(errMsg);
        return;
      }
      setUrlPreviewData(res.imageData);
      if (res.warning) setUrlPreviewWarning(res.warning);
      if (applyImmediately) {
        applyExternalAvatarToPortrait(
          portraitId,
          res.imageData,
          `Ảnh từ URL: ${clean.slice(0, 90)}`,
        );
        const msg = res.warning || res.note || 'Đã gán Avatar từ URL thành công.';
        setAvatarUploadFeedback((prev) => ({
          ...prev,
          [portraitId]: { type: res.warning ? 'warn' : 'ok', text: msg },
        }));
        onNotify?.(msg, 'info');
        setUrlEditorId(null);
        setUrlDraft('');
        setUrlPreviewData(null);
      }
    } finally {
      setUrlBusy(false);
    }
  };

  const handleCopyPromptText = async (portraitId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPromptId(portraitId);
      if (copyPromptTimerRef.current !== null) {
        window.clearTimeout(copyPromptTimerRef.current);
      }
      copyPromptTimerRef.current = window.setTimeout(() => {
        setCopiedPromptId((cur) => (cur === portraitId ? null : cur));
        copyPromptTimerRef.current = null;
      }, 1800);
    } catch {
      onNotify?.(
        'Trình duyệt chặn sao chép tự động — hãy chọn đoạn prompt để sao chép thủ công.',
        'err',
      );
    }
  };

  return (
    <div
      className={`space-y-3 rounded-2xl backdrop-blur-md ${
        compact
          ? 'bg-[#162135]/94 p-3.5 ring-1 ring-sky-400/22 shadow-[0_12px_32px_-16px_rgba(2,8,23,0.65)]'
          : 'bg-[#111b2c]/80 p-4 ring-1 ring-inset ring-white/[0.08]'
      }`}
    >
      <input
        ref={refPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleRefPhotoFileChange(e)}
      />
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleDirectAvatarFileChange(e)}
      />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/16 text-sky-300 ring-1 ring-inset ring-sky-400/28">
            <Users className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold tracking-tight text-slate-50 sm:text-sm">
              Thư viện Ảnh Nhân vật &amp; NPC
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
              <span className="truncate">{activeCompanionName || 'Phiên hiện tại'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {withImageCount}/{portraits.length} nhân vật có ảnh
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (suspectedJunkPortraits.length > 0) {
                handleQuickDeleteSuspectedJunk();
              } else {
                onCleanJunkPortraits();
                triggerConfirm('clean_junk');
              }
            }}
            title="Xóa nhanh các mục NPC rác dạng lyric nhạc, câu cảm thán, tên trêu đùa/chế tên hoặc tên phi nhân vật mà không xóa nhân vật hợp lệ"
            className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-amber-500/14 px-2.5 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-all hover:bg-amber-500/22 whitespace-nowrap"
          >
            {isConfirmed('clean_junk') ? (
              <Check className="h-3 w-3 text-emerald-300" />
            ) : (
              <Filter className="h-3 w-3" />
            )}
            <span>
              {isConfirmed('clean_junk')
                ? '✓ Đã lọc'
                : `Lọc tên rác${
                    suspectedJunkPortraits.length > 0
                      ? ` (${suspectedJunkPortraits.length})`
                      : ''
                  }`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSyncFromCompanion();
              triggerConfirm('sync_npcs');
            }}
            title="Quét nhân vật, dáng/biểu cảm, mối quan hệ và trạng thái từ lượt truyện hiện tại (kèm hồ sơ Đồng nhân)"
            className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
          >
            {isConfirmed('sync_npcs') ? (
              <Check className="h-3 w-3 text-emerald-300" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span>
              {isConfirmed('sync_npcs') ? '✓ Đã đồng bộ' : 'Đồng bộ NPC lượt này'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-emerald-500/14 px-2.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 whitespace-nowrap"
          >
            <Plus className="h-3 w-3" />
            <span>Thêm NV</span>
          </button>
          {onClose && (
            <button
              type="button"
              aria-label="Đóng thư viện ảnh nhân vật"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Auto-Generation Controls */}
      <div className="space-y-2.5 rounded-xl bg-[#111b2c]/85 p-3 ring-1 ring-inset ring-white/[0.07]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              onUpdatePortraitBank((prev) => ({
                ...prev,
                autoGenerateOnAppear: !prev.autoGenerateOnAppear,
              }))
            }
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all whitespace-nowrap ${
              portraitBank.autoGenerateOnAppear
                ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              Tự sinh ảnh NPC khi xuất hiện:{' '}
              {portraitBank.autoGenerateOnAppear ? 'Bật' : 'Tắt'}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 whitespace-nowrap">
              <span>Giới hạn/lượt:</span>
              <select
                aria-label="Giới hạn số ảnh NPC tự sinh mỗi lượt"
                value={String(portraitBank.maxAutoPerTurn || 1)}
                onChange={(e) => {
                  const val = Math.min(3, Math.max(1, Number(e.target.value) || 1));
                  onUpdatePortraitBank((prev) => ({
                    ...prev,
                    maxAutoPerTurn: val,
                  }));
                }}
                className="min-h-[30px] rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 text-xs font-semibold text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              >
                <option value="1">1 ảnh</option>
                <option value="2">2 ảnh</option>
                <option value="3">3 ảnh</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() =>
                onUpdatePortraitBank((prev) => ({
                  ...prev,
                  includeMcAuto: !prev.includeMcAuto,
                }))
              }
              className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                portraitBank.includeMcAuto
                  ? 'bg-sky-500/16 text-sky-100 ring-1 ring-inset ring-sky-400/30'
                  : 'bg-white/[0.055] text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:text-slate-200'
              }`}
            >
              Gồm NV chính: {portraitBank.includeMcAuto ? 'Có' : 'Không'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Chỉ quét nhân vật có thật trong cảnh (tự bỏ lyric nhạc, câu cảm
            thán/tiếng lóng ngắn, tên trêu đùa/chế tên) và cô lập trong Thư viện
            Ảnh — không tự chèn NPC mới quét vào mạch truyện đang chạy.
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {portraits.length > 0 && (
              <button
                type="button"
                disabled={isEnrichingAppearances}
                onClick={onAutoFillAppearances}
                className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-indigo-500/16 px-2.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/30 transition-all hover:bg-indigo-500/24 disabled:opacity-45 whitespace-nowrap"
              >
                {isEnrichingAppearances ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
                <span>
                  {isEnrichingAppearances
                    ? 'Đang làm sinh động...'
                    : 'Làm sinh động hồ sơ'}
                </span>
              </button>
            )}
            {onScanCurrentPagePortraits && turnCount > 0 && (
              <button
                type="button"
                disabled={bgPortraitStatus?.active}
                onClick={() => onScanCurrentPagePortraits(currentPage)}
                className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24 disabled:opacity-45 whitespace-nowrap"
              >
                <Sparkles className="h-3 w-3" />
                <span>Quét &amp; vẽ Trang {currentPage + 1}</span>
              </button>
            )}
          </div>
        </div>

        {appConfig && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0d1526]/85 px-2.5 py-1.5 text-[11px] ring-1 ring-inset ring-white/[0.06]">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="text-slate-400">API Đối chiếu Vision:</span>
              <span className="truncate font-mono text-[11px] font-semibold text-sky-200">
                {refCheckModelInfo.model}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  refCheckModelInfo.isCustomSlot
                    ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28'
                    : 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-white/[0.08]'
                }`}
              >
                {refCheckModelInfo.isCustomSlot
                  ? 'Slot riêng'
                  : 'Mặc định (Model chính)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('config')}
              className="shrink-0 text-[10px] font-semibold text-sky-300 hover:text-sky-200 hover:underline"
            >
              Đổi slot model
            </button>
          </div>
        )}

        {!hasSeedreamConfigured && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/[0.10] px-2.5 py-2 text-[11px] text-amber-200 ring-1 ring-inset ring-amber-400/28">
            <span>
              {isComfyProvider
                ? 'Chưa cấu hình đầy đủ ComfyUI Base URL hoặc Workflow API JSON (cần thiết để tạo ảnh chân dung).'
                : 'Chưa cấu hình Seedream 5 Pro Endpoint (cần thiết để tạo ảnh chân dung).'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('config')}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-amber-500/16 px-2 font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/32 hover:bg-amber-500/25 whitespace-nowrap"
            >
              <Settings className="h-3 w-3" />
              <span>Mở Cấu hình</span>
            </button>
          </div>
        )}

        {bgPortraitStatus && (
          <div
            className={`flex flex-wrap items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-[11px] leading-relaxed ring-1 ring-inset ${
              bgPortraitStatus.isErr
                ? 'bg-rose-500/[0.12] text-rose-200 ring-rose-400/32'
                : bgPortraitStatus.active
                  ? 'bg-sky-500/[0.10] text-sky-200 ring-sky-400/28'
                  : 'bg-emerald-500/[0.10] text-emerald-200 ring-emerald-400/28'
            }`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-1.5">
              {bgPortraitStatus.active && (
                <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
              )}
              <span className="break-words">{bgPortraitStatus.text}</span>
            </div>
            {bgPortraitStatus.active ? (
              <button
                type="button"
                onClick={onCancelBgPortraits}
                className="inline-flex min-h-[26px] shrink-0 items-center gap-1 rounded-lg bg-rose-500/16 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/25"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                <span>Dừng</span>
              </button>
            ) : (
              onDismissBgPortraitStatus && (
                <button
                  type="button"
                  aria-label="Đóng thông báo"
                  onClick={onDismissBgPortraitStatus}
                  className="shrink-0 rounded-md p-0.5 text-current/80 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Add Character Form */}
      {showAddForm && (
        <div className="space-y-2 rounded-xl bg-[#111b2c]/90 p-3.5 ring-1 ring-inset ring-emerald-400/28">
          <div className="text-xs font-semibold text-emerald-200">
            Thêm nhân vật / NPC vào thư viện ảnh
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên nhân vật / NPC (bắt buộc)..."
              className="min-h-[36px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Vai trò (VD: Đồng minh, Sư tỷ, Rapper UK...)"
              className="min-h-[36px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newAge}
              onChange={(e) => setNewAge(e.target.value)}
              placeholder="Tuổi tác (VD: 28 tuổi)..."
              className="min-h-[34px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <input
              type="text"
              value={newBirthday}
              onChange={(e) => setNewBirthday(e.target.value)}
              placeholder="Ngày sinh (VD: 04/06/1998)..."
              className="min-h-[34px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <textarea
            value={newFashionStyle}
            onChange={(e) => setNewFashionStyle(e.target.value)}
            rows={2}
            placeholder="Style ăn mặc theo nghề nghiệp & bối cảnh (VD: streetwear London, tracksuit/puffer, quiet luxury... để trống để tự nhận diện)..."
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
          <textarea
            value={newAppearance}
            onChange={(e) => setNewAppearance(e.target.value)}
            rows={2}
            placeholder="Ngoại hình (vóc dáng, kiểu tóc, nét mặt, thần thái... để trống để tự nhận diện)..."
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={newPersonality}
              onChange={(e) => setNewPersonality(e.target.value)}
              placeholder="Tính cách & khí chất (tùy chọn)..."
              className="min-h-[34px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            <input
              type="text"
              value={newRelationships}
              onChange={(e) => setNewRelationships(e.target.value)}
              placeholder="Quan hệ & thái độ (tùy chọn)..."
              className="min-h-[34px] rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <input
            type="text"
            value={newSignature}
            onChange={(e) => setNewSignature(e.target.value)}
            placeholder="Điểm nhấn / Thói quen / Câu cửa miệng (tùy chọn)..."
            className="min-h-[34px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={newCurrentLocation}
              onChange={(e) => setNewCurrentLocation(e.target.value)}
              placeholder="Vị trí hiện tại (VD: Tửu quán Thập Lý Pha)..."
              className="min-h-[34px] rounded-xl border border-cyan-400/20 bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/75 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
            />
            <input
              type="text"
              value={newPrivateSecret}
              onChange={(e) => setNewPrivateSecret(e.target.value)}
              placeholder="Bí mật riêng (chỉ NPC này biết, cấm tự lộ)..."
              className="min-h-[34px] rounded-xl border border-amber-400/20 bg-[#0e1625]/85 px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[32px] rounded-lg bg-white/[0.055] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!newName.trim()}
              onClick={handleAddCharacter}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-emerald-500/16 px-3 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24 disabled:opacity-45"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Lưu nhân vật</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      {portraits.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm nhân vật trong thư viện ảnh"
              placeholder="Tìm tên, vai trò, ngoại hình..."
              className="min-h-[34px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1 pl-8 pr-7 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            {query && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm nhân vật"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            className={`grid w-full ${
              suspectedJunkPortraits.length > 0 ? 'grid-cols-4' : 'grid-cols-3'
            } gap-1 rounded-xl bg-[#0e1625]/85 p-0.5 ring-1 ring-inset ring-white/[0.07] sm:flex sm:w-auto sm:items-center`}
          >
            {(
              [
                { id: 'all', label: `Tất cả (${portraits.length})` },
                { id: 'with_img', label: `Có ảnh (${withImageCount})` },
                {
                  id: 'missing_img',
                  label: `Chưa có (${portraits.length - withImageCount})`,
                },
                ...(suspectedJunkPortraits.length > 0
                  ? [
                      {
                        id: 'junk' as PortraitFilter,
                        label: `Nghi rác (${suspectedJunkPortraits.length})`,
                      },
                    ]
                  : []),
              ] as Array<{ id: PortraitFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[32px] rounded-lg px-2 text-center text-[11px] font-semibold transition-all whitespace-nowrap sm:px-2.5 ${
                  filter === tab.id
                    ? tab.id === 'junk'
                      ? 'bg-amber-500/22 text-amber-100 ring-1 ring-inset ring-amber-400/40'
                      : 'bg-sky-500/18 text-sky-100 ring-1 ring-inset ring-sky-400/30'
                    : tab.id === 'junk'
                      ? 'text-amber-300/90 hover:text-amber-200'
                      : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Alert Banner for Suspected Lyric / Short-Phrase Junk NPCs */}
      {suspectedJunkPortraits.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/[0.10] px-3 py-2 text-[11px] text-amber-100 ring-1 ring-inset ring-amber-400/30">
          <div className="min-w-0 flex-1 leading-snug">
            <span className="font-semibold text-amber-200">
              Phát hiện {suspectedJunkPortraits.length} mục nghi NPC rác (lyric / câu cảm thán / tên trêu đùa):{' '}
            </span>
            <span className="text-amber-100/90">
              {suspectedJunkPortraits
                .slice(0, 4)
                .map((p) => p.name)
                .join(', ')}
              {suspectedJunkPortraits.length > 4 ? '...' : ''}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter(filter === 'junk' ? 'all' : 'junk')}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-white/[0.08] px-2 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-300/25 hover:bg-white/[0.14]"
            >
              <span>{filter === 'junk' ? 'Xem tất cả' : 'Lọc xem'}</span>
            </button>
            <button
              type="button"
              onClick={handleQuickDeleteSuspectedJunk}
              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-rose-500/24 px-2.5 text-[11px] font-semibold text-rose-100 ring-1 ring-inset ring-rose-400/40 hover:bg-rose-500/35"
            >
              <Trash2 className="h-3 w-3" />
              <span>Xóa nhanh tất cả</span>
            </button>
          </div>
        </div>
      )}

      {/* Portrait Grid */}
      {!filteredPortraits.length ? (
        <div className="rounded-xl border border-dashed border-white/[0.10] bg-[#111b2c]/60 p-4 text-center text-xs text-slate-400">
          {portraits.length === 0
            ? 'Chưa có nhân vật nào trong thư viện. Bấm "Đồng bộ NPC lượt này" để quét nhân vật từ lượt truyện & Đồng nhân, hoặc bấm "Thêm NV".'
            : 'Không tìm thấy nhân vật nào khớp với bộ lọc hiện tại.'}
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${
            compact ? 'max-h-[420px] overflow-y-auto pr-0.5' : ''
          }`}
        >
          {filteredPortraits.map((p) => {
            const isBusy = generatingPortraitIds.includes(p.id);
            const activeProg = portraitProgress?.[p.id];
            const elapsedSec = activeProg
              ? Math.max(0, Math.floor((nowTick - activeProg.startedAt) / 1000))
              : 0;
            const isEnrichingOne = enrichingAppearanceIds.includes(p.id);
            const isAnalyzingIdentity = analyzingIdentityIds.includes(p.id);
            const isVerifyingReference = verifyingReferenceIds.includes(p.id);
            const isUploadingRef = uploadingRefId === p.id;
            const isUploadingAvatar = uploadingAvatarId === p.id;
            const isEditing = editingId === p.id;
            const currentPairSig =
              p.referenceImageData && p.imageData
                ? `${computeAvatarSignature(p.referenceImageData)}::${computeAvatarSignature(p.imageData)}`
                : '';
            const cmp = p.lastReferenceComparison;
            const isCmpStale = Boolean(
              cmp?.sourceSig &&
                currentPairSig &&
                cmp.sourceSig !== currentPairSig,
            );
            const ageBirthLabel = formatAgeBirthdayLabel(p.age, p.birthday);
            const hasStructuredLock = hasAnyCharacterIdentityLock(p.identityLock);
            const hasAnyIdentityLock = Boolean(
              hasStructuredLock ||
                p.avatarVisualLock?.trim() ||
                p.referenceImageData?.trim(),
            );
            const hasVividDetails = Boolean(
              p.age?.trim() ||
                p.birthday?.trim() ||
                p.fashionStyle?.trim() ||
                p.personality?.trim() ||
                p.relationships?.trim() ||
                p.signature?.trim() ||
                p.currentLocation?.trim() ||
                p.privateSecret?.trim() ||
                p.contextSnippet?.trim() ||
                hasAnyIdentityLock,
            );
            const isExpanded = expandedDetailIds.includes(p.id);
            const roleMeta = resolvePortraitRoleBadge(p);
            const isOnline = isCharacterOnlineInSet(onlineCharacterKeySet, p.name, [
              p.role,
              p.signature,
            ]);
            const avatarNotice = avatarUploadFeedback[p.id];
            const isUrlEditorOpen = urlEditorId === p.id;
            const isPromptPreviewOpen = promptPreviewId === p.id;
            const previewPromptText = (() => {
              if (!isPromptPreviewOpen || !onPreviewPortraitPrompt) return '';
              try {
                return String(onPreviewPortraitPrompt(p.id) ?? '');
              } catch {
                return '';
              }
            })();
            return (
              <div
                key={p.id}
                className={`flex flex-col overflow-hidden rounded-xl bg-[#111b2c]/85 ring-1 ring-inset transition-colors ${
                  isOnline
                    ? 'ring-emerald-400/35 shadow-[0_0_20px_-10px_rgba(52,211,153,0.45)]'
                    : 'ring-white/[0.08]'
                }`}
              >
                <div className="flex gap-3 p-2.5">
                  {/* Portrait Thumbnail */}
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#0c1422] ring-1 ring-white/[0.10]">
                    {p.imageData ? (
                      <button
                        type="button"
                        onClick={() => setLightboxId(p.id)}
                        aria-label={`Phóng to ảnh của ${p.name}`}
                        className="group relative block h-full w-full focus:outline-none"
                      >
                        <ResolvedAvatarImage
                          src={p.imageData}
                          alt={`Chân dung ${p.name}`}
                          keyHint={`portrait_${p.id}_${p.updatedAt || 0}`}
                          compactError
                          className="h-full w-full object-cover"
                        />
                        <span className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-[#0a101d]/75 p-0.5 text-slate-100 opacity-80 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                          <Maximize2 className="h-3 w-3" />
                        </span>
                      </button>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-[#1a2944] to-[#0f1729] text-slate-400">
                        {p.isMc ? (
                          <User className="h-4 w-4 text-sky-400/85" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-400/80" />
                        )}
                        <span className="text-[11px] font-bold tracking-wide text-slate-200">
                          {getInitials(p.name)}
                        </span>
                      </div>
                    )}

                    {p.referenceImageData && (
                      <span
                        title="Đã gắn ảnh mẫu người thật để AI đối chiếu trước khi vẽ"
                        className="pointer-events-none absolute left-1 top-1 inline-flex h-6 w-6 overflow-hidden rounded-md ring-1 ring-emerald-400/75 shadow-md"
                      >
                        <ResolvedAvatarImage
                          src={p.referenceImageData}
                          alt={`Ảnh mẫu ${p.name}`}
                          keyHint={`ref_${p.id}`}
                          compactError
                          className="h-full w-full object-cover"
                        />
                      </span>
                    )}

                    {(isBusy ||
                      isUploadingAvatar ||
                      isAnalyzingIdentity ||
                      isVerifyingReference) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#0c1422]/84 px-1 text-center text-[10px] font-semibold text-sky-200 backdrop-blur-[2px]">
                        <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                        <span className="leading-tight">
                          {isUploadingAvatar
                            ? 'Đang lưu'
                            : isBusy
                              ? `${elapsedSec}s`
                              : isVerifyingReference
                                ? 'So khớp'
                                : 'Trích khóa'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Character Info */}
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Tên nhân vật"
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-xs font-semibold text-slate-100 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <input
                          type="text"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          placeholder="Vai trò / Nghề nghiệp & vị thế"
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            value={editAge}
                            onChange={(e) => setEditAge(e.target.value)}
                            placeholder="Tuổi (VD: 28 tuổi)"
                            className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                          <input
                            type="text"
                            value={editBirthday}
                            onChange={(e) => setEditBirthday(e.target.value)}
                            placeholder="Ngày sinh (DD/MM/YYYY)"
                            className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                          />
                        </div>
                        <textarea
                          value={editFashionStyle}
                          onChange={(e) => setEditFashionStyle(e.target.value)}
                          rows={2}
                          placeholder="Style ăn mặc (đúng nghề nghiệp & bối cảnh, tránh rập khuôn vest)..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <textarea
                          value={editAppearance}
                          onChange={(e) => setEditAppearance(e.target.value)}
                          rows={2}
                          placeholder="Ngoại hình (vóc dáng, kiểu tóc, nét mặt, thần thái)..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <textarea
                          value={editPersonality}
                          onChange={(e) => setEditPersonality(e.target.value)}
                          rows={2}
                          placeholder="Tính cách & khí chất đặc trưng..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <textarea
                          value={editRelationships}
                          onChange={(e) => setEditRelationships(e.target.value)}
                          rows={2}
                          placeholder="Mối quan hệ & thái độ..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <input
                          type="text"
                          value={editSignature}
                          onChange={(e) => setEditSignature(e.target.value)}
                          placeholder="Điểm nhấn / Thói quen / Chi tiết ghi nhớ..."
                          className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                        <input
                          type="text"
                          value={editCurrentLocation}
                          onChange={(e) => setEditCurrentLocation(e.target.value)}
                          placeholder="Vị trí hiện tại (VD: Tửu quán Thập Lý Pha, Chuồng ngựa...)"
                          className="w-full rounded-lg border border-cyan-400/22 bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-cyan-400/75 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                        />
                        <textarea
                          value={editPrivateSecret}
                          onChange={(e) => setEditPrivateSecret(e.target.value)}
                          rows={2}
                          placeholder="Bí mật riêng (chỉ nhân vật này biết — cấm NPC khác đọc suy nghĩ/tự lộ)..."
                          className="w-full rounded-lg border border-amber-400/22 bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-200 transition-colors focus:border-amber-400/75 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                        />
                        <div className="space-y-1.5 rounded-xl border border-indigo-400/22 bg-indigo-950/25 p-2">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                              <ScanFace className="h-3 w-3 text-indigo-300" />
                              <span>Khóa nhận diện &amp; Ảnh mẫu người thật</span>
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                disabled={isUploadingRef}
                                onClick={() => triggerReferencePhotoUpload(p.id)}
                                className="inline-flex min-h-[22px] items-center gap-1 rounded-md bg-emerald-500/18 px-1.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/35 transition-colors hover:bg-emerald-500/28 disabled:opacity-50"
                              >
                                {isUploadingRef ? (
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                  <Upload className="h-2.5 w-2.5" />
                                )}
                                <span>
                                  {editReferenceImageData
                                    ? 'Đổi ảnh thật'
                                    : 'Tải ảnh thật'}
                                </span>
                              </button>
                              {editReferenceImageData && (
                                <button
                                  type="button"
                                  onClick={() => handleClearReferencePhoto(p.id)}
                                  className="inline-flex min-h-[22px] items-center rounded-md bg-rose-500/15 px-1.5 text-[10px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/25"
                                >
                                  Bỏ ảnh mẫu
                                </button>
                              )}
                              {onAnalyzePortraitIdentity &&
                                (editReferenceImageData || p.imageData) && (
                                  <button
                                    type="button"
                                    disabled={isAnalyzingIdentity}
                                    onClick={() =>
                                      onAnalyzePortraitIdentity(p.id, {
                                        overwrite: true,
                                        imageDataOverride:
                                          editReferenceImageData || p.imageData,
                                        isRealPhoto: Boolean(
                                          editReferenceImageData,
                                        ),
                                      })
                                    }
                                    className="inline-flex min-h-[22px] items-center gap-1 rounded-md bg-indigo-500/22 px-1.5 text-[10px] font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-400/40 transition-colors hover:bg-indigo-500/32 disabled:opacity-50"
                                  >
                                    {isAnalyzingIdentity ? (
                                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                    ) : (
                                      <ScanFace className="h-2.5 w-2.5" />
                                    )}
                                    <span>
                                      {isAnalyzingIdentity
                                        ? 'Đang đối chiếu...'
                                        : 'AI đối chiếu ảnh'}
                                    </span>
                                  </button>
                                )}
                            </div>
                          </div>

                          {editReferenceImageData && (
                            <div className="flex items-center gap-2 rounded-lg bg-[#0b1322]/85 p-1.5 ring-1 ring-emerald-400/25">
                              <img
                                src={editReferenceImageData}
                                alt={`Ảnh mẫu người thật ${p.name}`}
                                className="h-11 w-11 shrink-0 rounded-md object-cover ring-1 ring-white/15"
                              />
                              <p className="text-[10px] leading-snug text-emerald-100/90">
                                Ưu tiên ảnh mẫu người thật này để AI đối chiếu nét mặt và viết prompt chuẩn trước khi vẽ.
                              </p>
                            </div>
                          )}

                          {refUploadError && (
                            <p className="text-[10px] text-rose-300">
                              {refUploadError}
                            </p>
                          )}

                          <div className="flex items-center gap-1">
                            {(['Nam', 'Nữ'] as const).map((gOpt) => {
                              const active =
                                editLockGender.trim().toLowerCase() ===
                                  gOpt.toLowerCase() ||
                                (gOpt === 'Nam' &&
                                  /^male$/i.test(editLockGender.trim())) ||
                                (gOpt === 'Nữ' &&
                                  /^female$/i.test(editLockGender.trim()));
                              return (
                                <button
                                  key={gOpt}
                                  type="button"
                                  onClick={() => setEditLockGender(gOpt)}
                                  className={`min-h-[24px] shrink-0 rounded-md px-2 text-[10px] font-semibold ring-1 ring-inset transition-colors ${
                                    active
                                      ? 'bg-indigo-500/30 text-indigo-100 ring-indigo-300/60'
                                      : 'bg-[#0e1625]/85 text-slate-300 ring-white/[0.09] hover:text-white'
                                  }`}
                                >
                                  {gOpt}
                                </button>
                              );
                            })}
                            <input
                              type="text"
                              value={editLockGender}
                              onChange={(e) =>
                                setEditLockGender(e.target.value)
                              }
                              placeholder="Giới tính khóa (Nam / Nữ / male / female)"
                              className="min-w-0 flex-1 rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/75 focus:outline-none"
                            />
                          </div>

                          <input
                            type="text"
                            value={editLockFacial}
                            onChange={(e) => setEditLockFacial(e.target.value)}
                            placeholder="Đường nét khuôn mặt (VD: 36-year-old defined jawline, natural eyes & brows, real skin texture with subtle pores & light smile lines, contoured jawline beard)"
                            className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/75 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editLockHairstyle}
                            onChange={(e) =>
                              setEditLockHairstyle(e.target.value)
                            }
                            placeholder="Kiểu tóc cố định (VD: natural black hair, relaxed softly falling slightly wavy strands)"
                            className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/75 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editLockSignatureStyle}
                            onChange={(e) =>
                              setEditLockSignatureStyle(e.target.value)
                            }
                            placeholder="Phong cách đặc trưng (VD: grounded everyday vibe, casual streetwear, natural unpolished presence)"
                            className="w-full rounded-lg border border-white/[0.09] bg-[#0e1625]/85 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/75 focus:outline-none"
                          />
                          <textarea
                            value={editLockFixedTags}
                            onChange={(e) =>
                              setEditLockFixedTags(e.target.value)
                            }
                            rows={2}
                            placeholder="Tag cố định cô đọng 5–7 tag lõi (VD: 36-year-old Vietnamese man, natural skin texture with subtle pores, light smile lines, contoured chinstrap beard & trimmed mustache, slightly wavy natural black hair)"
                            className="w-full rounded-lg border border-indigo-400/30 bg-[#0e1625]/85 px-2 py-1 text-[11px] text-indigo-100 placeholder:text-slate-500 focus:border-indigo-400/75 focus:outline-none"
                          />
                          <textarea
                            value={editAvatarVisualLock}
                            onChange={(e) =>
                              setEditAvatarVisualLock(e.target.value)
                            }
                            rows={2}
                            placeholder="Tóm tắt khóa nhận diện tổng hợp (tự ghép từ các mục trên hoặc rút từ ảnh mẫu/avatar)"
                            className="w-full rounded-lg border border-white/[0.08] bg-[#0e1625]/70 px-2 py-1 text-[10px] text-indigo-200/90 placeholder:text-slate-500 focus:border-indigo-400/75 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => saveEdit(p.id)}
                            className="min-h-[26px] rounded-lg bg-emerald-500/16 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 transition-colors hover:bg-emerald-500/24"
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[26px] rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-1">
                              <CharacterNameBadge
                                name={p.name}
                                variant="list"
                                isMc={p.isMc}
                                isOnline={isOnline}
                                onClick={() =>
                                  p.imageData
                                    ? setLightboxId(p.id)
                                    : hasVividDetails
                                      ? toggleDetailExpand(p.id)
                                      : startEdit(p)
                                }
                                title={
                                  p.imageData
                                    ? `Xem ảnh chân dung ${p.name}`
                                    : `Xem hồ sơ ${p.name}`
                                }
                              />
                              {p.aiAutoEnrichLocked && (
                                <span
                                  title="Đang tạm khóa: chặn AI tự động làm sinh động"
                                  aria-label={`${p.name} đang tạm khóa AI`}
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-500/18 text-rose-300 ring-1 ring-inset ring-rose-400/35"
                                >
                                  <Lock className="h-3 w-3" />
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${roleMeta.badgeClass}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${roleMeta.dotClass}`}
                                />
                                <span>{roleMeta.tierLabel}</span>
                              </span>
                              {p.pinned && (
                                <span
                                  title="Đã ghim trong Ngữ cảnh"
                                  className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30"
                                >
                                  <Pin className="h-2.5 w-2.5" />
                                  <span>Ghim</span>
                                </span>
                              )}
                            </div>
                            {(roleMeta.detailLabel || ageBirthLabel) && (
                              <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                                {roleMeta.detailLabel && (
                                  <span className="truncate text-slate-300">
                                    {roleMeta.detailLabel}
                                  </span>
                                )}
                                {roleMeta.detailLabel && ageBirthLabel && (
                                  <span aria-hidden="true">·</span>
                                )}
                                {ageBirthLabel && (
                                  <span className="tabular-nums text-slate-300">
                                    {ageBirthLabel}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              disabled={isEnrichingOne}
                              title="Làm sinh động hồ sơ, tuổi tác & style ăn mặc từ diễn biến truyện và đặc trưng nhân vật"
                              aria-label={`Làm sinh động hồ sơ cho ${p.name}`}
                              onClick={() =>
                                onRefreshPortraitAppearance(p.id, true)
                              }
                              className="rounded-lg p-1 text-indigo-300/85 transition-colors hover:bg-indigo-500/16 hover:text-indigo-200 disabled:opacity-45"
                            >
                              {isEnrichingOne ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Wand2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              aria-label={`Sửa thông tin ${p.name}`}
                              onClick={() => startEdit(p)}
                              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-400">
                          {isEnrichingOne
                            ? 'Đang làm sinh động hồ sơ, tuổi tác & style...'
                            : p.appearance ||
                              'Chưa có mô tả ngoại hình (bấm đũa phép để làm sinh động hồ sơ hoặc sửa thủ công).'}
                        </p>
                        {(p.currentLocation?.trim() || p.privateSecret?.trim()) &&
                          !isEnrichingOne && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {p.currentLocation?.trim() && (
                                <span
                                  title={`Vị trí hiện tại: ${p.currentLocation}`}
                                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-cyan-500/12 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200 ring-1 ring-inset ring-cyan-400/25"
                                >
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{p.currentLocation}</span>
                                </span>
                              )}
                              {p.privateSecret?.trim() && (
                                <span
                                  title="Có bí mật riêng (được bảo mật khỏi NPC khác)"
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 ring-1 ring-inset ring-amber-400/25"
                                >
                                  <KeyRound className="h-2.5 w-2.5 shrink-0" />
                                  <span>Có bí mật riêng</span>
                                </span>
                              )}
                            </div>
                          )}
                        {hasAnyIdentityLock && !isEnrichingOne && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {p.referenceImageData && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/14 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/30">
                                <Camera className="h-2.5 w-2.5 shrink-0" />
                                <span>Ảnh mẫu thật</span>
                              </span>
                            )}
                            {(hasStructuredLock || p.avatarVisualLock?.trim()) && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/14 px-1.5 py-0.5 text-[10px] font-medium text-indigo-200 ring-1 ring-inset ring-indigo-400/28">
                                <Lock className="h-2.5 w-2.5 shrink-0" />
                                <span>
                                  {p.identityLock?.fixedTags?.trim()
                                    ? 'Khóa nhận diện + Tag'
                                    : 'Đã khóa nhận diện'}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                        {hasVividDetails && !isEnrichingOne && (
                          <button
                            type="button"
                            onClick={() => toggleDetailExpand(p.id)}
                            className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-indigo-300 transition-colors hover:text-indigo-200"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            <span>
                              {isExpanded
                                ? 'Thu gọn hồ sơ'
                                : 'Hồ sơ chi tiết'}
                            </span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expandable Vivid Profile Drawer */}
                {!isEditing && hasVividDetails && isExpanded && (
                  <div className="space-y-1.5 border-t border-white/[0.07] bg-[#0e1625]/70 px-3 py-2 text-[11px] leading-relaxed">
                    {ageBirthLabel && (
                      <div>
                        <span className="font-semibold text-cyan-300">
                          Tuổi tác &amp; ngày sinh:{' '}
                        </span>
                        <span className="tabular-nums text-slate-200">
                          {ageBirthLabel}
                        </span>
                      </div>
                    )}
                    {p.fashionStyle?.trim() && (
                      <div>
                        <span className="font-semibold text-violet-300">
                          Style ăn mặc:{' '}
                        </span>
                        <span className="text-slate-300">{p.fashionStyle}</span>
                      </div>
                    )}
                    {p.personality?.trim() && (
                      <div>
                        <span className="font-semibold text-sky-300">
                          Tính cách &amp; khí chất:{' '}
                        </span>
                        <span className="text-slate-300">{p.personality}</span>
                      </div>
                    )}
                    {p.relationships?.trim() && (
                      <div>
                        <span className="font-semibold text-emerald-300">
                          Quan hệ &amp; thái độ:{' '}
                        </span>
                        <span className="text-slate-300">
                          {p.relationships}
                        </span>
                      </div>
                    )}
                    {p.signature?.trim() && (
                      <div>
                        <span className="font-semibold text-amber-300">
                          Điểm nhấn:{' '}
                        </span>
                        <span className="text-slate-300">{p.signature}</span>
                      </div>
                    )}
                    {p.currentLocation?.trim() && (
                      <div>
                        <span className="font-semibold text-cyan-300">
                          Vị trí hiện tại:{' '}
                        </span>
                        <span className="text-slate-200">{p.currentLocation}</span>
                      </div>
                    )}
                    {p.privateSecret?.trim() && (
                      <div className="rounded-lg bg-amber-500/[0.07] px-2 py-1 ring-1 ring-amber-400/20">
                        <span className="font-semibold text-amber-300">
                          Bí mật riêng (Cách ly nhận thức):{' '}
                        </span>
                        <span className="text-amber-100/90">{p.privateSecret}</span>
                      </div>
                    )}
                    {p.contextSnippet?.trim() && (
                      <div>
                        <span className="font-semibold text-cyan-300">
                          Ghi nhận cảnh gần nhất:{' '}
                        </span>
                        <span className="text-slate-300">
                          {p.contextSnippet}
                        </span>
                      </div>
                    )}
                    {p.referenceImageData && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/[0.07] p-1.5 ring-1 ring-emerald-400/22">
                        <div className="flex min-w-0 items-center gap-2">
                          <img
                            src={p.referenceImageData}
                            alt={`Ảnh mẫu người thật ${p.name}`}
                            className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-emerald-300/40"
                          />
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold text-emerald-200">
                              Ảnh mẫu người thật (ưu tiên đối chiếu AI)
                            </div>
                            <div className="text-[10px] text-slate-400">
                              AI tự đối chiếu nét mặt trước khi vẽ ảnh cảnh &amp; chân dung
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleClearReferencePhoto(p.id)}
                          className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-1 text-[10px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/25"
                        >
                          Bỏ
                        </button>
                      </div>
                    )}
                    {hasStructuredLock && (
                      <div className="space-y-1 rounded-lg bg-indigo-500/[0.07] p-2 ring-1 ring-indigo-400/20">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                          Khóa nhận diện cố định
                        </div>
                        {p.identityLock?.gender?.trim() && (
                          <div>
                            <span className="font-semibold text-indigo-300">
                              Giới tính:{' '}
                            </span>
                            <span className="text-slate-200">
                              {p.identityLock.gender}
                            </span>
                          </div>
                        )}
                        {p.identityLock?.facialFeatures?.trim() && (
                          <div>
                            <span className="font-semibold text-indigo-300">
                              Khuôn mặt:{' '}
                            </span>
                            <span className="text-slate-200">
                              {p.identityLock.facialFeatures}
                            </span>
                          </div>
                        )}
                        {p.identityLock?.hairstyle?.trim() && (
                          <div>
                            <span className="font-semibold text-indigo-300">
                              Kiểu tóc:{' '}
                            </span>
                            <span className="text-slate-200">
                              {p.identityLock.hairstyle}
                            </span>
                          </div>
                        )}
                        {p.identityLock?.signatureStyle?.trim() && (
                          <div>
                            <span className="font-semibold text-indigo-300">
                              Phong cách:{' '}
                            </span>
                            <span className="text-slate-200">
                              {p.identityLock.signatureStyle}
                            </span>
                          </div>
                        )}
                        {p.identityLock?.fixedTags?.trim() && (
                          <div>
                            <span className="font-semibold text-indigo-300">
                              Tag cố định:{' '}
                            </span>
                            <span className="text-indigo-100/95">
                              {p.identityLock.fixedTags}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {!hasStructuredLock && p.avatarVisualLock?.trim() && (
                      <div>
                        <span className="font-semibold text-indigo-300">
                          Khóa nhận diện Avatar:{' '}
                        </span>
                        <span className="text-indigo-100/90">
                          {p.avatarVisualLock}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {cmp && (
                  <div
                    className={`border-t px-2.5 py-2 text-[11px] leading-relaxed ${
                      cmp.status === 'error'
                        ? 'border-rose-400/25 bg-rose-500/[0.08] text-rose-100'
                        : cmp.verdict === 'match'
                          ? 'border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-100'
                          : cmp.verdict === 'partial'
                            ? 'border-amber-400/25 bg-amber-500/[0.07] text-amber-100'
                            : 'border-rose-400/25 bg-rose-500/[0.08] text-rose-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        {cmp.status === 'error' ? (
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                        )}
                        <span>
                          {cmp.status === 'error'
                            ? 'Đối chiếu API thất bại'
                            : cmp.verdict === 'match'
                              ? `Khớp tốt (${cmp.overallScore}/100)`
                              : cmp.verdict === 'partial'
                                ? `Khớp một phần (${cmp.overallScore}/100)`
                                : `Lệch nét (${cmp.overallScore}/100)`}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-300/85">
                        {cmp.modelUsed} · {(cmp.elapsedMs / 1000).toFixed(1)}s
                        {isCmpStale ? ' · Ảnh đã đổi' : ''}
                      </span>
                    </div>

                    {cmp.status === 'error' ? (
                      <p className="mt-1 text-[10.5px] text-rose-200/90 break-words">
                        {cmp.errorMessage ||
                          'Không nhận được kết quả đối chiếu từ Vision API.'}
                      </p>
                    ) : (
                      <>
                        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] tabular-nums">
                          {typeof cmp.faceMatchScore === 'number' && (
                            <span className="rounded bg-[#0b1322]/75 px-1.5 py-0.5 text-slate-200 ring-1 ring-white/[0.08]">
                              Mặt: <strong>{cmp.faceMatchScore}</strong>
                            </span>
                          )}
                          {typeof cmp.ageAccuracyScore === 'number' && (
                            <span className="rounded bg-[#0b1322]/75 px-1.5 py-0.5 text-slate-200 ring-1 ring-white/[0.08]">
                              Tuổi: <strong>{cmp.ageAccuracyScore}</strong>
                            </span>
                          )}
                          {typeof cmp.skinRealismScore === 'number' && (
                            <span className="rounded bg-[#0b1322]/75 px-1.5 py-0.5 text-slate-200 ring-1 ring-white/[0.08]">
                              Da thật: <strong>{cmp.skinRealismScore}</strong>
                            </span>
                          )}
                          {typeof cmp.hairBeardScore === 'number' && (
                            <span className="rounded bg-[#0b1322]/75 px-1.5 py-0.5 text-slate-200 ring-1 ring-white/[0.08]">
                              Tóc/Râu: <strong>{cmp.hairBeardScore}</strong>
                            </span>
                          )}
                        </div>
                        {cmp.summary && (
                          <p className="mt-1 text-[10.5px] text-slate-200/95">
                            {cmp.summary}
                          </p>
                        )}
                        {cmp.mismatches && cmp.mismatches.length > 0 && (
                          <div className="mt-1 text-[10px] text-amber-200/95">
                            <span className="font-semibold">Điểm lệch: </span>
                            {cmp.mismatches.join(' · ')}
                          </div>
                        )}
                        {(() => {
                          const ageInfo = resolveEffectiveCharacterAge({
                            age: p.age,
                            birthday: p.birthday,
                            extraText: [p.appearance, p.role, p.signature]
                              .filter(Boolean)
                              .join(' '),
                            clock: storyClock,
                          });
                          const applyEnabled = cmp.applyToPrompt !== false;
                          const patchInfo = deriveReferenceComparisonPromptPatch(
                            cmp,
                            {
                              knownAgeNum: ageInfo.ageNum,
                              profileGender: p.identityLock?.gender,
                              profileAppearance: p.appearance,
                              profileFashionStyle: p.fashionStyle,
                              profileSignature: p.signature,
                            },
                          );
                          const handleMergeComparisonPatchIntoPrompt = () => {
                            if (!patchInfo.patchText) return;
                            const basePrompt =
                              p.customPrompt?.trim() ||
                              (onPreviewPortraitPrompt
                                ? String(
                                    onPreviewPortraitPrompt(p.id, {
                                      ignoreCustomPrompt: true,
                                    }) ?? '',
                                  )
                                : '');
                            const lowerBase = basePrompt.toLowerCase();
                            const patchHead = patchInfo.patchText
                              .toLowerCase()
                              .slice(0, 28);
                            const mergedPrompt =
                              basePrompt && !lowerBase.includes(patchHead)
                                ? `${basePrompt}, ${patchInfo.patchText}`
                                : basePrompt || patchInfo.patchText;
                            onUpdatePortraitBank((prev) => ({
                              ...prev,
                              portraits: (prev.portraits || []).map((item) =>
                                item.id === p.id
                                  ? {
                                      ...item,
                                      customPrompt: mergedPrompt.slice(0, 2400),
                                      updatedAt: Date.now(),
                                    }
                                  : item,
                              ),
                            }));
                            setPromptPreviewId(p.id);
                            setEditingPromptId(p.id);
                            setEditingPromptDraft(mergedPrompt.slice(0, 2400));
                            onNotify?.(
                              `Đã ghép chọn lọc chỉnh sửa đối chiếu vào prompt của ${p.name}. Bạn có thể xem lại hoặc sửa thêm trước khi tạo ảnh.`,
                              'info',
                            );
                          };
                          return (
                            <div className="mt-2 space-y-1.5 rounded-lg bg-[#0b1322]/80 p-2 ring-1 ring-inset ring-white/[0.08]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10.5px] font-semibold text-slate-100 select-none">
                                  <input
                                    type="checkbox"
                                    checked={applyEnabled}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      onUpdatePortraitBank((prev) => ({
                                        ...prev,
                                        portraits: (prev.portraits || []).map(
                                          (item) =>
                                            item.id === p.id &&
                                            item.lastReferenceComparison
                                              ? {
                                                  ...item,
                                                  lastReferenceComparison: {
                                                    ...item.lastReferenceComparison,
                                                    applyToPrompt: checked,
                                                  },
                                                }
                                              : item,
                                        ),
                                      }));
                                    }}
                                    className="h-3.5 w-3.5 rounded border-white/25 bg-[#0f1a2d] text-sky-400 focus:ring-sky-400/40"
                                  />
                                  <span>
                                    Áp dụng kết quả đối chiếu vào prompt
                                  </span>
                                </label>
                                {patchInfo.active && !isBusy && (
                                  <div className="flex flex-wrap items-center gap-1">
                                    {patchInfo.patchText && (
                                      <button
                                        type="button"
                                        onClick={
                                          handleMergeComparisonPatchIntoPrompt
                                        }
                                        className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-indigo-500/20 px-2 text-[10px] font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-400/35 transition-colors hover:bg-indigo-500/30"
                                      >
                                        <Edit3 className="h-2.5 w-2.5" />
                                        <span>Ghép vào Prompt</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={isBusy || isAnyComfyBusy}
                                      onClick={() => onGeneratePortrait(p.id)}
                                      className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-sky-500/20 px-2 text-[10px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/30 disabled:opacity-45"
                                    >
                                      <RefreshCw className="h-2.5 w-2.5" />
                                      <span>Vẽ lại theo chỉnh sửa</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                              {patchInfo.statusLabel && (
                                <p className="text-[10px] text-slate-300/90">
                                  {patchInfo.statusLabel}
                                </p>
                              )}
                              {patchInfo.filteredConflictNote && (
                                <p className="rounded-md bg-amber-500/[0.10] px-2 py-1 text-[10px] leading-snug text-amber-200 ring-1 ring-inset ring-amber-400/25">
                                  {patchInfo.filteredConflictNote}
                                </p>
                              )}
                              {patchInfo.active && patchInfo.patchText && (
                                <div className="rounded-md bg-sky-500/[0.08] px-2 py-1 font-mono text-[10px] leading-snug text-sky-100/95 ring-1 ring-inset ring-sky-400/25 break-words">
                                  <span className="font-sans font-semibold text-sky-300">
                                    Sẽ ghép vào prompt:{' '}
                                  </span>
                                  {patchInfo.patchText}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {p.lastAppliedComparisonPatch && (
                  <div className="border-t border-emerald-400/20 bg-emerald-500/[0.06] px-2.5 py-1.5 text-[10px] leading-snug text-emerald-100/95">
                    <span className="font-semibold text-emerald-300">
                      Đã nạp chỉnh sửa đối chiếu vào prompt lần vẽ gần nhất:{' '}
                    </span>
                    <span className="font-mono break-words">
                      {p.lastAppliedComparisonPatch}
                    </span>
                  </div>
                )}

                {/* Live Generation Progress Banner with Elapsed / Timeout & Cancel */}
                {isBusy && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-400/22 bg-sky-500/[0.10] px-2.5 py-2 text-[11px] text-sky-100">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-300" />
                        <span className="truncate">
                          {activeProg?.label ||
                            `Đang tạo ảnh qua ${imageProviderLabel}...`}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-sky-200/85 tabular-nums">
                        <span>
                          {getImageProviderLabel(
                            activeProg?.provider || appConfig?.imageProvider,
                          )}
                        </span>
                        <span>·</span>
                        <span>
                          {elapsedSec}s / {activeProg?.timeoutSec || (isComfyProvider ? 240 : appConfig?.imageProvider === 'custom' || appConfig?.imageProvider === 'latent' ? 180 : 120)}s
                        </span>
                        {activeProg && activeProg.maxAttempts > 1 && (
                          <>
                            <span>·</span>
                            <span>
                              Lần {activeProg.attempt}/{activeProg.maxAttempts}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {onCancelPortrait && (
                      <button
                        type="button"
                        onClick={() => onCancelPortrait(p.id)}
                        className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-rose-500/22 px-2.5 text-[11px] font-semibold text-rose-100 ring-1 ring-inset ring-rose-400/40 transition-colors hover:bg-rose-500/32"
                      >
                        <Square className="h-2.5 w-2.5 fill-current" />
                        <span>Hủy</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Direct Avatar Upload / URL Feedback Banner */}
                {avatarNotice && !isBusy && (
                  <div
                    className={`flex items-start justify-between gap-2 border-t px-2.5 py-1.5 text-[11px] leading-snug ${
                      avatarNotice.type === 'err'
                        ? 'border-rose-400/25 bg-rose-500/[0.12] text-rose-200'
                        : avatarNotice.type === 'warn'
                          ? 'border-amber-400/25 bg-amber-500/[0.10] text-amber-100'
                          : 'border-emerald-400/22 bg-emerald-500/[0.08] text-emerald-100'
                    }`}
                  >
                    <span className="break-words">{avatarNotice.text}</span>
                    <button
                      type="button"
                      aria-label="Đóng thông báo ảnh"
                      onClick={() =>
                        setAvatarUploadFeedback((prev) => {
                          const next = { ...prev };
                          delete next[p.id];
                          return next;
                        })
                      }
                      className="shrink-0 rounded p-0.5 text-current/80 hover:bg-white/10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Direct URL Paste Panel for NPC Avatar */}
                {isUrlEditorOpen && (
                  <div className="space-y-2 border-t border-amber-400/25 bg-[#0e1728] px-2.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-amber-200">
                        Dán URL ảnh ngoài làm Avatar ({p.name})
                      </span>
                      <button
                        type="button"
                        onClick={() => setUrlEditorId(null)}
                        className="rounded p-0.5 text-slate-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:flex-row">
                      <input
                        type="url"
                        inputMode="url"
                        value={urlDraft}
                        onChange={(e) => {
                          setUrlDraft(e.target.value);
                          setUrlPreviewError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleCheckUrlAvatar(p.id, false);
                          }
                        }}
                        placeholder="https://example.com/avatar.jpg"
                        className="min-h-[34px] flex-1 rounded-lg border border-white/[0.10] bg-[#0a111f] px-2.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-amber-400/75 focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={urlBusy || !urlDraft.trim()}
                          onClick={() => void handleCheckUrlAvatar(p.id, false)}
                          className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-lg bg-white/[0.07] px-2.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.10] hover:bg-white/[0.12] disabled:opacity-50 sm:flex-initial whitespace-nowrap"
                        >
                          {urlBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3 text-amber-300" />
                          )}
                          <span>Xem trước</span>
                        </button>
                        <button
                          type="button"
                          disabled={urlBusy || !urlDraft.trim()}
                          onClick={() => void handleCheckUrlAvatar(p.id, true)}
                          className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-lg bg-amber-500/22 px-2.5 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/35 hover:bg-amber-500/32 disabled:opacity-50 sm:flex-initial whitespace-nowrap"
                        >
                          <Check className="h-3 w-3" />
                          <span>Gán ngay</span>
                        </button>
                      </div>
                    </div>
                    {urlPreviewError && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-rose-500/12 px-2 py-1.5 text-[10.5px] text-rose-200 ring-1 ring-inset ring-rose-400/28">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                        <span>{urlPreviewError}</span>
                      </div>
                    )}
                    {urlPreviewWarning && (
                      <div className="rounded-lg bg-amber-500/12 px-2 py-1.5 text-[10.5px] text-amber-100 ring-1 ring-inset ring-amber-400/28">
                        {urlPreviewWarning}
                      </div>
                    )}
                    {urlPreviewData && (
                      <div className="flex items-center gap-2.5 rounded-lg bg-[#121e33] p-2 ring-1 ring-white/[0.08]">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#090f1c] ring-1 ring-amber-400/35">
                          <ResolvedAvatarImage
                            src={urlPreviewData}
                            alt={`Xem trước Avatar ${p.name}`}
                            keyHint={`url_preview_${p.id}`}
                            compactError
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-[11px] font-semibold text-emerald-200">
                            Ảnh tải thành công!
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              applyExternalAvatarToPortrait(
                                p.id,
                                urlPreviewData,
                                `Ảnh từ URL: ${urlDraft.trim().slice(0, 90)}`,
                              );
                              setAvatarUploadFeedback((prev) => ({
                                ...prev,
                                [p.id]: {
                                  type: urlPreviewWarning ? 'warn' : 'ok',
                                  text:
                                    urlPreviewWarning ||
                                    'Đã lưu Avatar từ URL thành công.',
                                },
                              }));
                              onNotify?.(
                                `Đã gán Avatar từ URL cho ${p.name}.`,
                                'info',
                              );
                              setUrlEditorId(null);
                              setUrlPreviewData(null);
                            }}
                            className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-emerald-500/22 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/32"
                          >
                            <Check className="h-3 w-3" />
                            <span>Áp dụng làm Avatar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expandable Cohesive English Prompt Preview & Direct Inline Editor */}
                {isPromptPreviewOpen && (() => {
                  const isEditingThisPrompt = editingPromptId === p.id;
                  const hasCustomSavedPrompt = Boolean(p.customPrompt?.trim());
                  const detectedHair = extractExplicitHairProfileEn(
                    p.appearance,
                    p.fashionStyle,
                    p.signature,
                  );
                  const detectedTattoo = extractTattooAndBodyMarkingsEn(
                    p.appearance,
                    p.fashionStyle,
                    p.signature,
                  );
                  const activePromptForDisplay = isEditingThisPrompt
                    ? editingPromptDraft
                    : previewPromptText;
                  return (
                    <div className="space-y-2 border-t border-indigo-400/22 bg-[#0d1526]/95 px-2.5 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10.5px] font-semibold text-indigo-200">
                            Prompt chân dung (Anh)
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ring-1 ring-inset ${
                              hasCustomSavedPrompt
                                ? 'bg-emerald-500/18 text-emerald-200 ring-emerald-400/35'
                                : 'bg-indigo-500/15 text-indigo-200 ring-indigo-400/30'
                            }`}
                          >
                            {hasCustomSavedPrompt
                              ? 'Bản chỉnh tay · giữ nguyên'
                              : 'Tự động từ hồ sơ'}
                          </span>
                          {detectedHair.hasExplicitHair &&
                            detectedHair.hairClauseEn && (
                              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30">
                                Tóc: {detectedHair.hairClauseEn}
                              </span>
                            )}
                          {detectedTattoo.hasTattoos && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30">
                              Khóa hình xăm
                              {detectedTattoo.locations.length > 0
                                ? `: ${detectedTattoo.locations.join(', ')}`
                                : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {!isEditingThisPrompt ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPromptId(p.id);
                                setEditingPromptDraft(previewPromptText);
                              }}
                              className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-indigo-500/22 px-2 text-[10px] font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-400/35 hover:bg-indigo-500/32"
                            >
                              <Edit3 className="h-2.5 w-2.5" />
                              <span>Sửa prompt</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingPromptId(null)}
                              className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-white/[0.07] px-2 text-[10px] font-semibold text-slate-200 hover:bg-white/[0.13]"
                            >
                              <span>Hủy sửa</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyPromptText(
                                p.id,
                                activePromptForDisplay,
                              )
                            }
                            className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-white/[0.07] px-2 text-[10px] font-semibold text-slate-200 hover:bg-white/[0.13]"
                          >
                            {copiedPromptId === p.id ? (
                              <Check className="h-2.5 w-2.5 text-emerald-300" />
                            ) : (
                              <Copy className="h-2.5 w-2.5" />
                            )}
                            <span>
                              {copiedPromptId === p.id ? 'Đã chép' : 'Sao chép'}
                            </span>
                          </button>
                          {hasCustomSavedPrompt && !isEditingThisPrompt && (
                            <button
                              type="button"
                              onClick={() =>
                                resetCustomPromptFromProfile(p.id, p.name, false)
                              }
                              title="Xóa bản chỉnh tay và dựng lại prompt sạch từ bảng hồ sơ cố định"
                              className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-amber-500/16 px-2 text-[10px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-500/26"
                            >
                              <RefreshCw className="h-2.5 w-2.5" />
                              <span>Dựng lại từ hồ sơ</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setPromptPreviewId(null);
                              if (editingPromptId === p.id) {
                                setEditingPromptId(null);
                              }
                            }}
                            className="rounded p-0.5 text-slate-400 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {isEditingThisPrompt ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={editingPromptDraft}
                            onChange={(e) =>
                              setEditingPromptDraft(e.target.value)
                            }
                            rows={4}
                            placeholder="Nhập hoặc chỉnh sửa trực tiếp prompt tiếng Anh cho ảnh chân dung..."
                            className="w-full rounded-lg border border-indigo-400/40 bg-[#090f1d] p-2 font-mono text-[10.5px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-indigo-300 focus:outline-none"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  saveCustomPromptForPortrait(
                                    p.id,
                                    editingPromptDraft,
                                    p.name,
                                  )
                                }
                                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-emerald-500/22 px-2.5 text-[10.5px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/32"
                              >
                                <Check className="h-3 w-3" />
                                <span>Lưu prompt</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || isAnyComfyBusy}
                                onClick={() => {
                                  if (isBusy || isAnyComfyBusy) return;
                                  saveCustomPromptForPortrait(
                                    p.id,
                                    editingPromptDraft,
                                    p.name,
                                  );
                                  window.setTimeout(
                                    () => onGeneratePortrait(p.id),
                                    0,
                                  );
                                }}
                                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/22 px-2.5 text-[10.5px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/32 disabled:opacity-45"
                              >
                                <Sparkles className="h-3 w-3" />
                                <span>Lưu &amp; Tạo ảnh</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                resetCustomPromptFromProfile(p.id, p.name, true)
                              }
                              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-amber-500/15 px-2 text-[10px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-500/25"
                            >
                              <RefreshCw className="h-2.5 w-2.5" />
                              <span>Dựng lại từ hồ sơ</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="max-h-40 overflow-y-auto rounded-lg bg-[#090f1d] p-2 font-mono text-[10px] leading-relaxed text-slate-200 ring-1 ring-white/[0.06] break-words">
                          {previewPromptText}
                        </p>
                      )}

                      <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-300/90 select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(p.useSceneContextInPortrait)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            onUpdatePortraitBank((prev) => ({
                              ...prev,
                              portraits: (prev.portraits || []).map((item) =>
                                item.id === p.id
                                  ? {
                                      ...item,
                                      useSceneContextInPortrait: checked,
                                      updatedAt: Date.now(),
                                    }
                                  : item,
                              ),
                            }));
                          }}
                          className="h-3 w-3 rounded border-white/25 bg-[#0f1a2d] text-indigo-400 focus:ring-indigo-400/40"
                        />
                        <span>
                          Dùng thêm ngữ cảnh trang truyện hiện tại (mặc định tắt
                          để giữ chân dung cố định theo hồ sơ)
                        </span>
                      </label>
                    </div>
                  );
                })()}

                {portraitErrors?.[p.id] && !isBusy && (
                  <div className="flex flex-wrap items-start justify-between gap-2 border-t border-rose-400/20 bg-rose-500/[0.10] px-2.5 py-2 text-[11px] leading-snug text-rose-200">
                    <span className="min-w-0 flex-1 break-words">
                      {portraitErrors[p.id]}
                    </span>
                    <button
                      type="button"
                      disabled={isBusy || isAnyComfyBusy}
                      onClick={() => onGeneratePortrait(p.id)}
                      className="inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 text-[11px] font-semibold text-rose-100 ring-1 ring-inset ring-rose-400/35 hover:bg-rose-500/30 disabled:opacity-45"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Thử lại</span>
                    </button>
                  </div>
                )}

                {/* Per-Character Action Bar (Compact 2-tier mobile layout) */}
                {(() => {
                  const isToolsOpen =
                    expandedToolIds.includes(p.id) ||
                    isUrlEditorOpen ||
                    isAnalyzingIdentity ||
                    isVerifyingReference;
                  return (
                    <div className="border-t border-white/[0.07] bg-[#0f1829]/90 px-2.5 py-2 space-y-1.5">
                      {/* Tier 1: Core daily actions */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy || isAnyComfyBusy}
                            onClick={() => onGeneratePortrait(p.id)}
                            className="inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24 disabled:opacity-45"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            <span>
                              {isBusy
                                ? 'Đang tạo...'
                                : isAnyComfyBusy
                                  ? 'ComfyUI bận'
                                  : p.imageData
                                    ? 'Tạo lại'
                                    : 'Tạo ảnh'}
                            </span>
                          </button>
                          {isBusy && onCancelPortrait && (
                            <button
                              type="button"
                              onClick={() => onCancelPortrait(p.id)}
                              className="inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-rose-500/18 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/35 transition-colors hover:bg-rose-500/28"
                            >
                              <Square className="h-2.5 w-2.5 fill-current" />
                              <span>Hủy</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isUploadingAvatar}
                            onClick={() => triggerDirectAvatarUpload(p.id)}
                            title="Tải ảnh trực tiếp từ thiết bị làm Avatar nhân vật"
                            className="inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-500/14 px-2 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/30 transition-colors hover:bg-emerald-500/24 disabled:opacity-45"
                          >
                            {isUploadingAvatar ? (
                              <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />
                            ) : (
                              <Upload className="h-3 w-3 text-emerald-300" />
                            )}
                            <span>Từ máy</span>
                          </button>
                          <button
                            type="button"
                            disabled={isUploadingRef}
                            onClick={() => triggerReferencePhotoUpload(p.id)}
                            title="Tải ảnh người thật làm mẫu đối chiếu để AI viết prompt giữ đúng khuôn mặt & kiểu tóc trước khi vẽ"
                            className={`inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors disabled:opacity-45 ${
                              p.referenceImageData
                                ? 'bg-emerald-500/16 text-emerald-100 ring-emerald-400/35 hover:bg-emerald-500/24'
                                : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                            }`}
                          >
                            {isUploadingRef ? (
                              <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />
                            ) : (
                              <Camera className="h-3 w-3 text-emerald-300" />
                            )}
                            <span>
                              {p.referenceImageData ? 'Đổi mẫu' : 'Ảnh mẫu'}
                            </span>
                          </button>
                          {onPreviewPortraitPrompt && (
                            <button
                              type="button"
                              onClick={() => {
                                setPromptPreviewId((cur) => {
                                  const next = cur === p.id ? null : p.id;
                                  if (next !== editingPromptId) {
                                    setEditingPromptId(null);
                                  }
                                  return next;
                                });
                              }}
                              title="Xem trước & chỉnh sửa trực tiếp prompt tiếng Anh của nhân vật"
                              className={`inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors ${
                                isPromptPreviewOpen
                                  ? 'bg-indigo-500/24 text-indigo-100 ring-indigo-400/40'
                                  : p.customPrompt?.trim()
                                    ? 'bg-emerald-500/14 text-emerald-100 ring-emerald-400/32 hover:bg-emerald-500/22'
                                    : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                              }`}
                            >
                              <Eye className="h-3 w-3 text-indigo-300" />
                              <span>
                                {p.customPrompt?.trim() ? 'Prompt*' : 'Prompt'}
                              </span>
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          aria-expanded={isToolsOpen}
                          onClick={() => toggleToolsExpand(p.id)}
                          className={`inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors ${
                            isToolsOpen
                              ? 'bg-slate-700/70 text-slate-100 ring-white/[0.16]'
                              : 'bg-white/[0.045] text-slate-300 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                          }`}
                        >
                          <span>Công cụ</span>
                          {isToolsOpen ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {/* Tier 2: Secondary & advanced portrait tools */}
                      {isToolsOpen && (
                        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-white/[0.06] pt-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openUrlEditorFor(p.id)}
                              title="Dán đường dẫn URL ảnh ngoài làm Avatar nhân vật"
                              className={`inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors ${
                                isUrlEditorOpen
                                  ? 'bg-amber-500/22 text-amber-100 ring-amber-400/40'
                                  : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
                              }`}
                            >
                              <Link2 className="h-3 w-3 text-amber-300" />
                              <span>URL ảnh</span>
                            </button>
                            {onOpenImagePicker && (
                              <button
                                type="button"
                                onClick={() => onOpenImagePicker(p.id, p.name)}
                                className="inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white"
                              >
                                <ImageIcon className="h-3 w-3 text-sky-300" />
                                <span>Thư viện</span>
                              </button>
                            )}
                            {onAnalyzePortraitIdentity &&
                              (p.referenceImageData || p.imageData) && (
                                <button
                                  type="button"
                                  disabled={isAnalyzingIdentity}
                                  onClick={() =>
                                    onAnalyzePortraitIdentity(p.id, {
                                      overwrite: true,
                                    })
                                  }
                                  title="Gọi Vision API phân tích ảnh mẫu người thật (hoặc avatar) để rút ra giới tính, nét mặt, tuổi thật, kiểu tóc và bộ tag cố định"
                                  className="inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-indigo-500/16 px-2 text-[11px] font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-400/32 transition-colors hover:bg-indigo-500/26 disabled:opacity-45"
                                >
                                  {isAnalyzingIdentity ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <ScanFace className="h-3 w-3" />
                                  )}
                                  <span>
                                    {isAnalyzingIdentity
                                      ? 'Đang trích...'
                                      : 'Trích khóa AI'}
                                  </span>
                                </button>
                              )}
                            {onVerifyPortraitAgainstReference &&
                              (p.referenceImageData || p.imageData) && (
                                <button
                                  type="button"
                                  disabled={isVerifyingReference}
                                  onClick={() =>
                                    onVerifyPortraitAgainstReference(p.id)
                                  }
                                  title="Gửi đồng thời Ảnh mẫu người thật + Ảnh chân dung hiện tại qua Vision API để đối chiếu độ sát mặt, tuổi tác và da tự nhiên"
                                  className={`inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors disabled:opacity-45 ${
                                    p.referenceImageData && p.imageData
                                      ? 'bg-emerald-500/18 text-emerald-100 ring-emerald-400/35 hover:bg-emerald-500/28'
                                      : 'bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.08] hover:text-slate-200'
                                  }`}
                                >
                                  {isVerifyingReference ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="h-3 w-3" />
                                  )}
                                  <span>
                                    {isVerifyingReference
                                      ? 'Đang so khớp...'
                                      : 'So khớp API'}
                                  </span>
                                </button>
                              )}
                          </div>

                          <div className="flex items-center gap-1">
                            {p.imageData && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onDownloadImage(
                                      p.imageData || '',
                                      `chan_dung_${p.name}.png`,
                                    )
                                  }
                                  className="inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white/[0.055] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>Tải</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearImage(p.id)}
                                  className="inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-amber-500/14 px-2 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-colors hover:bg-amber-500/22"
                                >
                                  <span>Xóa ảnh</span>
                                </button>
                              </>
                            )}
                            {!p.isMc && (
                              <button
                                type="button"
                                aria-label={`Xóa ${p.name} khỏi thư viện`}
                                onClick={() => handleDeleteEntry(p.id)}
                                className="inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-rose-500/14 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-colors hover:bg-rose-500/22"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Xóa NV</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Portrait Lightbox (portaled to document.body to avoid backdrop-blur/overflow clipping) */}
      {lightbox &&
        lightbox.imageData &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh chân dung ${lightbox.name}`}
            onClick={() => setLightboxId(null)}
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#050a14]/90 p-2 backdrop-blur-md sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#162135]/98 shadow-2xl ring-1 ring-white/[0.12]"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-3.5 py-2.5 sm:px-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-100 sm:text-sm">
                    {lightbox.name}
                    {lightbox.role ? ` · ${lightbox.role}` : ''}
                  </div>
                  {lightbox.appearance && (
                    <div className="truncate text-[11px] text-slate-400">
                      {lightbox.appearance}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLightboxZoomed((v) => !v)}
                    title={
                      lightboxZoomed ? 'Thu về vừa khung' : 'Phóng lớn thêm'
                    }
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.10] transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    {lightboxZoomed ? (
                      <ZoomOut className="h-3.5 w-3.5 text-sky-300" />
                    ) : (
                      <ZoomIn className="h-3.5 w-3.5 text-sky-300" />
                    )}
                    <span className="hidden sm:inline">
                      {lightboxZoomed ? 'Vừa khung' : 'Phóng lớn'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onDownloadImage(
                        lightbox.imageData || '',
                        `chan_dung_${lightbox.name}.png`,
                      )
                    }
                    className="inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-sky-500/16 px-2.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tải ảnh</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Đóng xem ảnh"
                    onClick={() => setLightboxId(null)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.10] transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 overflow-auto overscroll-contain bg-[#080e1a] p-2 sm:p-4">
                <ResolvedAvatarImage
                  src={lightbox.imageData}
                  alt={`Chân dung ${lightbox.name}`}
                  keyHint={`lightbox_${lightbox.id}_${lightbox.updatedAt || 0}`}
                  onClick={() => setLightboxZoomed((v) => !v)}
                  className={`m-auto block shrink-0 rounded-xl object-contain shadow-[0_16px_44px_-12px_rgba(0,0,0,0.85)] transition-all duration-200 select-auto [-webkit-touch-callout:default] ${
                    lightboxZoomed
                      ? 'h-auto max-h-none w-[160%] max-w-none cursor-zoom-out sm:w-[135%]'
                      : 'h-auto w-auto max-h-[70dvh] max-w-full cursor-zoom-in sm:max-h-[76dvh]'
                  }`}
                />
              </div>
              {(lightbox.age ||
                lightbox.birthday ||
                lightbox.fashionStyle ||
                lightbox.personality ||
                lightbox.relationships ||
                lightbox.signature ||
                lightbox.contextSnippet ||
                lightbox.prompt) && (
                <div className="max-h-[22dvh] shrink-0 space-y-1 overflow-y-auto border-t border-white/[0.08] bg-[#101829]/95 px-4 py-2.5 text-[11px] text-slate-400">
                  {formatAgeBirthdayLabel(lightbox.age, lightbox.birthday) && (
                    <div>
                      <span className="font-semibold text-cyan-300">
                        Tuổi tác &amp; ngày sinh:{' '}
                      </span>
                      <span className="tabular-nums text-slate-200">
                        {formatAgeBirthdayLabel(
                          lightbox.age,
                          lightbox.birthday,
                        )}
                      </span>
                    </div>
                  )}
                  {lightbox.fashionStyle && (
                    <div>
                      <span className="font-semibold text-violet-300">
                        Style ăn mặc:{' '}
                      </span>
                      <span className="text-slate-300">
                        {lightbox.fashionStyle}
                      </span>
                    </div>
                  )}
                  {lightbox.personality && (
                    <div>
                      <span className="font-semibold text-sky-300">
                        Tính cách:{' '}
                      </span>
                      <span className="text-slate-300">
                        {lightbox.personality}
                      </span>
                    </div>
                  )}
                  {lightbox.relationships && (
                    <div>
                      <span className="font-semibold text-emerald-300">
                        Quan hệ:{' '}
                      </span>
                      <span className="text-slate-300">
                        {lightbox.relationships}
                      </span>
                    </div>
                  )}
                  {lightbox.signature && (
                    <div>
                      <span className="font-semibold text-amber-300">
                        Điểm nhấn:{' '}
                      </span>
                      <span className="text-slate-300">
                        {lightbox.signature}
                      </span>
                    </div>
                  )}
                  {lightbox.contextSnippet && (
                    <div>
                      <span className="font-semibold text-cyan-300">
                        Dáng &amp; biểu cảm:{' '}
                      </span>
                      <span className="text-slate-300">
                        {lightbox.contextSnippet}
                      </span>
                    </div>
                  )}
                  {lightbox.prompt && (
                    <div className="pt-0.5 text-slate-500">
                      <span className="font-semibold text-slate-400">
                        Prompt:{' '}
                      </span>
                      <span className="line-clamp-2">{lightbox.prompt}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
