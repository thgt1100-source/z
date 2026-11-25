import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Download,
  FolderDown,
  FolderUp,
  Image as ImageIcon,
  Link2,
  Loader2,
  Palette,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  CharacterPortrait,
  ImageCameraAngleId,
  StoryImageConfig,
  StoryImageStyle,
} from '../types/ark';
import { isEmbeddedCustomImageStyleId } from '../utils/embeddedPresets';
import {
  buildCustomStylePreset,
  buildPortableSampleImagesBundle,
  compressSampleImageForStorage,
  DEFAULT_STYLE_SAMPLE_IMAGES,
  getAllImageStyles,
  getSampleImageKey,
  IMAGE_CAMERA_ANGLES,
  IMAGE_STYLE_VARIABLES,
  importSampleImageFromUrl,
  mergeUserSampleImages,
  parsePortableSampleImagesBundle,
  resolveCameraAngle,
  resolveEffectiveSampleImage,
  resolveStoryImageStyle,
  SAMPLE_REMOVED_SENTINEL,
  type ImageStyleVariableToken,
} from '../utils/imageStyles';
import { triggerDownloadJson } from '../utils/storage';
import { ImageZoomModal, type ZoomImagePayload } from './ImageZoomModal';

interface ImageStylePickerProps {
  storyImageConfig: StoryImageConfig;
  onUpdateStoryImageConfig: (
    patch:
      | Partial<StoryImageConfig>
      | ((prev: StoryImageConfig) => Partial<StoryImageConfig>),
  ) => void;
  portraits?: CharacterPortrait[];
  defaultExpanded?: boolean;
  onInsertVariable?: (token: ImageStyleVariableToken) => void;
  onDownloadImage?: (imgSrc: string, filename: string) => void;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
  compact?: boolean;
}

const VARIABLE_LABELS: Record<
  ImageStyleVariableToken,
  { short: string; hint: string }
> = {
  '${image_style_name}': {
    short: '${image_style_name}',
    hint: 'Tên phong cách',
  },
  '${image_style_description}': {
    short: '${image_style_description}',
    hint: 'Mô tả phong cách',
  },
  '${image_style_prompt_guide}': {
    short: '${image_style_prompt_guide}',
    hint: 'Chỉ dẫn chất liệu & kỹ thuật',
  },
};

export function ImageStylePicker({
  storyImageConfig,
  onUpdateStoryImageConfig,
  portraits = [],
  defaultExpanded = false,
  onInsertVariable,
  onDownloadImage,
  onNotify,
  compact = false,
}: ImageStylePickerProps) {
  const [activeTab, setActiveTab] = useState<'style' | 'angle'>('style');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showVars, setShowVars] = useState(false);
  const [showPortraitPicker, setShowPortraitPicker] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [sampleUrlDraft, setSampleUrlDraft] = useState('');
  const [sampleUrlError, setSampleUrlError] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [sampleLoadError, setSampleLoadError] = useState(false);
  const [showCustomCreator, setShowCustomCreator] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [zoomImage, setZoomImage] = useState<ZoomImagePayload | null>(null);

  // Custom style creator form
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customGuide, setCustomGuide] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importPackInputRef = useRef<HTMLInputElement>(null);

  const customStyles = storyImageConfig.customStyles || [];
  const allStyles = getAllImageStyles(customStyles);
  const activeStyle = resolveStoryImageStyle(
    storyImageConfig.stylePreset,
    customStyles,
  );
  const activeStyleIndex = allStyles.findIndex((s) => s.id === activeStyle.id);

  const activeAngle = resolveCameraAngle(storyImageConfig.cameraAngle);
  const activeAngleIndex = IMAGE_CAMERA_ANGLES.findIndex(
    (a) => a.id === activeAngle.id,
  );

  const sampleImages = storyImageConfig.sampleImages || {};
  const activeSampleId =
    activeTab === 'style' ? activeStyle.id : activeAngle.id;
  const activeSampleKey = getSampleImageKey(activeTab, activeSampleId);
  const activeBundledDefault = DEFAULT_STYLE_SAMPLE_IMAGES[activeSampleKey];
  const activeSample = resolveEffectiveSampleImage(
    activeTab,
    activeSampleId,
    sampleImages,
    portraits,
  );
  const isActiveDefaultHidden =
    Boolean(activeBundledDefault) &&
    sampleImages[activeSampleKey] === SAMPLE_REMOVED_SENTINEL;
  const canRestoreDefaultSample =
    Boolean(activeBundledDefault) &&
    (Boolean(activeSample?.hasUserOverride) || isActiveDefaultHidden);

  useEffect(() => {
    setSampleLoadError(false);
    setSampleUrlError('');
    const currentRaw = sampleImages[activeSampleKey] || '';
    if (/^https?:\/\//i.test(currentRaw)) {
      setSampleUrlDraft(currentRaw);
    } else {
      setSampleUrlDraft('');
    }
  }, [activeSampleKey, sampleImages]);

  const portraitsWithImages = portraits.filter((p) =>
    Boolean(p.imageData?.trim()),
  );

  const handleVariableClick = async (token: ImageStyleVariableToken) => {
    if (onInsertVariable) {
      onInsertVariable(token);
      onNotify?.(`Đã chèn biến ${token} vào prompt.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      onNotify?.(`Đã sao chép biến ${token}.`);
    } catch {
      onNotify?.(`Biến mẫu: ${token}`);
    }
  };

  const handleSampleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotify?.('Vui lòng chọn tệp hình ảnh hợp lệ.', 'err');
      return;
    }
    const targetKey = activeSampleKey;
    const targetLabel =
      activeTab === 'style' ? activeStyle.label : activeAngle.label;
    setIsCompressing(true);
    try {
      const { dataUrl, approxKb } = await compressSampleImageForStorage(file);
      onUpdateStoryImageConfig((prev) => ({
        sampleImages: {
          ...(prev.sampleImages || {}),
          [targetKey]: dataUrl,
        },
      }));
      setShowPortraitPicker(false);
      setSampleLoadError(false);
      onNotify?.(
        `Đã lưu ảnh của bạn cho "${targetLabel}" (~${approxKb} KB) làm mặc định.`,
      );
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'Không thể xử lý ảnh so sánh mẫu.',
        'err',
      );
    } finally {
      setIsCompressing(false);
    }
  };

  const handlePickPortraitAsSample = (portrait: CharacterPortrait) => {
    const targetKey = activeSampleKey;
    onUpdateStoryImageConfig((prev) => ({
      sampleImages: {
        ...(prev.sampleImages || {}),
        [targetKey]: `portrait:${portrait.id}`,
      },
    }));
    setShowPortraitPicker(false);
    setShowUrlInput(false);
    setSampleLoadError(false);
    onNotify?.(
      `Đã gắn ảnh "${portrait.name}" làm ảnh mặc định của bạn (không tốn thêm dung lượng lưu trữ).`,
    );
  };

  const handleApplySampleUrl = async () => {
    const targetKey = activeSampleKey;
    setSampleUrlError('');
    setIsImportingUrl(true);
    try {
      const result = await importSampleImageFromUrl(sampleUrlDraft);
      if (!result.ok) {
        setSampleUrlError(result.error);
        onNotify?.(result.error, 'err');
        return;
      }
      onUpdateStoryImageConfig((prev) => ({
        sampleImages: {
          ...(prev.sampleImages || {}),
          [targetKey]: result.value,
        },
      }));
      setSampleLoadError(false);
      setShowUrlInput(false);
      setShowPortraitPicker(false);
      onNotify?.(result.note);
    } finally {
      setIsImportingUrl(false);
    }
  };

  const handlePasteSampleUrl = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip?.trim()) {
        setSampleUrlDraft(clip.trim());
        setSampleUrlError('');
      } else {
        onNotify?.('Clipboard hiện đang trống.', 'err');
      }
    } catch {
      onNotify?.('Hãy chạm giữ vào ô nhập để dán URL ảnh.', 'info');
    }
  };

  const handleRemoveSample = () => {
    if (!activeSample) return;
    const targetKey = activeSampleKey;
    const wasUserImage = activeSample.isUserImage;
    onUpdateStoryImageConfig((prev) => {
      const next = { ...(prev.sampleImages || {}) };
      if (wasUserImage) {
        // Removing the user's custom image clears their override; if a bundled fallback exists,
        // keep the slot clean (or user can tap again to hide fallback).
        delete next[targetKey];
      } else if (activeBundledDefault) {
        next[targetKey] = SAMPLE_REMOVED_SENTINEL;
      } else {
        delete next[targetKey];
      }
      return { sampleImages: next };
    });
    setSampleLoadError(false);
    setSampleUrlDraft('');
    onNotify?.(
      wasUserImage
        ? 'Đã gỡ ảnh riêng của mục đang chọn.'
        : 'Đã ẩn ảnh dự phòng của mục đang chọn.',
    );
  };

  const handleRestoreDefaultSample = () => {
    if (!activeBundledDefault) return;
    const targetKey = activeSampleKey;
    onUpdateStoryImageConfig((prev) => {
      const next = { ...(prev.sampleImages || {}) };
      delete next[targetKey];
      return { sampleImages: next };
    });
    setSampleLoadError(false);
    setSampleUrlDraft('');
    onNotify?.(`Đã khôi phục ảnh dự phòng cho "${activeStyle.label}".`);
  };

  const handleExportSamplePack = () => {
    const bundle = buildPortableSampleImagesBundle(storyImageConfig, portraits);
    const sampleCount = Object.keys(bundle.sampleImages).length;
    if (sampleCount === 0 && bundle.customStyles.length === 0) {
      onNotify?.(
        'Bạn chưa gán ảnh riêng nào cho 15 Phong cách hoặc 8 Góc máy để xuất.',
        'err',
      );
      return;
    }
    triggerDownloadJson(
      `ARK_anh_mau_phong_cach_goc_may_${Date.now()}.json`,
      bundle,
    );
    onNotify?.(
      `Đã xuất bộ ảnh mẫu của bạn (${sampleCount} ảnh phong cách/góc máy) — dùng để nạp sang tài khoản Remix khác.`,
    );
  };

  const handleImportSamplePack = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parsePortableSampleImagesBundle(text);
      if (!parsed.ok) {
        onNotify?.(parsed.error, 'err');
        return;
      }
      onUpdateStoryImageConfig((prev) => {
        const mergedSamples = mergeUserSampleImages(
          parsed.sampleImages,
          prev.sampleImages,
        );
        const existingIds = new Set((prev.customStyles || []).map((s) => s.id));
        const mergedCustoms = [
          ...(prev.customStyles || []),
          ...parsed.customStyles.filter((s) => !existingIds.has(s.id)),
        ];
        return {
          sampleImages: mergedSamples,
          customStyles: mergedCustoms,
        };
      });
      onNotify?.(
        `Đã nạp ${Object.keys(parsed.sampleImages).length} ảnh mẫu của bạn vào cấu hình mặc định.`,
      );
    } catch {
      onNotify?.('Không thể đọc tệp bộ ảnh mẫu đã chọn.', 'err');
    }
  };

  const handleSaveCustomStyle = () => {
    const trimmedName = customName.trim();
    if (!trimmedName) {
      onNotify?.('Hãy nhập tên cho kiểu phong cách tùy chỉnh.', 'err');
      return;
    }
    const created = buildCustomStylePreset({
      name: trimmedName,
      description: customDesc,
      promptGuide: customGuide,
      baseStyle: activeStyle,
    });
    onUpdateStoryImageConfig((prev) => ({
      customStyles: [...(prev.customStyles || []), created],
      stylePreset: created.id,
    }));
    setCustomName('');
    setCustomDesc('');
    setCustomGuide('');
    setShowCustomCreator(false);
    setActiveTab('style');
    setExpanded(true);
    onNotify?.(`Đã lưu kiểu tùy chỉnh "${created.label}" vào danh sách chọn nhanh.`);
  };

  const handleDeleteCustomStyle = (
    e: React.MouseEvent,
    styleId: StoryImageStyle,
    label: string,
  ) => {
    e.stopPropagation();
    onUpdateStoryImageConfig((prev) => {
      const targetStyle = (prev.customStyles || []).find(
        (s) => s.id === styleId,
      );
      const nextCustoms = (prev.customStyles || []).filter(
        (s) => s.id !== styleId,
      );
      const nextSamples = { ...(prev.sampleImages || {}) };
      delete nextSamples[getSampleImageKey('style', styleId)];
      const patch: Partial<StoryImageConfig> = {
        customStyles: nextCustoms,
        sampleImages: nextSamples,
      };
      if (
        targetStyle?.isEmbeddedDefault ||
        isEmbeddedCustomImageStyleId(styleId)
      ) {
        const prevDeleted = Array.isArray(prev.deletedEmbeddedStyleIds)
          ? prev.deletedEmbeddedStyleIds
          : [];
        if (!prevDeleted.includes(styleId)) {
          patch.deletedEmbeddedStyleIds = [...prevDeleted, styleId];
        }
      }
      if (prev.stylePreset === styleId) {
        patch.stylePreset = 'live_action_cinema';
      }
      return patch;
    });
    onNotify?.(`Đã xóa kiểu tùy chỉnh "${label}".`);
  };

  const insertTokenIntoCreator = (
    target: 'desc' | 'guide',
    token: ImageStyleVariableToken,
  ) => {
    if (target === 'desc') {
      setCustomDesc((prev) =>
        prev.trim() ? `${prev.trimEnd()} ${token}` : token,
      );
    } else {
      setCustomGuide((prev) =>
        prev.trim() ? `${prev.trimEnd()} ${token}` : token,
      );
    }
  };

  const activeTitle =
    activeTab === 'style' ? activeStyle.label : activeAngle.label;
  const activeDesc =
    activeTab === 'style' ? activeStyle.description : activeAngle.description;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0e1625]/75 p-3 space-y-2.5">
      {/* Hidden File Inputs for Sample Comparison Image & Portable Sample Pack */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSampleFileChange}
      />
      <input
        ref={importPackInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void handleImportSamplePack(e)}
      />

      {/* Mode Switcher: Phong cách vs Góc máy + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-[#162032] p-0.5 ring-1 ring-inset ring-white/[0.08]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('style');
              setShowPortraitPicker(false);
            }}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
              activeTab === 'style'
                ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Phong cách ({allStyles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('angle');
              setShowPortraitPicker(false);
            }}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
              activeTab === 'angle'
                ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Góc máy ({IMAGE_CAMERA_ANGLES.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeTab === 'style' && (
            <button
              type="button"
              onClick={() => setShowCustomCreator((v) => !v)}
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                showCustomCreator
                  ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/40'
                  : 'bg-emerald-500/12 text-emerald-200 ring-1 ring-inset ring-emerald-400/26 hover:bg-emerald-500/20'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Kiểu tùy chỉnh</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowVars((v) => !v)}
            className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-all whitespace-nowrap ${
              showVars
                ? 'bg-sky-500/18 text-sky-200 ring-1 ring-inset ring-sky-400/35'
                : 'bg-white/[0.05] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
            }`}
            title="Xem & chèn biến ${image_style_*}"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Biến</span>
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.10] transition-all hover:bg-white/[0.12] hover:text-white whitespace-nowrap"
          >
            <span>
              {expanded
                ? 'Thu gọn'
                : activeTab === 'style'
                  ? `Chọn (${allStyles.length})`
                  : `Chọn (${IMAGE_CAMERA_ANGLES.length})`}
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Active Selection + Comparison Sample Image Preview Slot */}
      <div className="flex flex-col gap-2.5 rounded-xl bg-[#131d2f]/90 p-2.5 ring-1 ring-inset ring-white/[0.07] sm:flex-row sm:items-start">
        {/* Sample Preview Thumbnail with Zoom Trigger */}
        <div className="relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-[#0b1220] sm:h-24 sm:w-28">
          {activeSample && !sampleLoadError ? (
            <>
              <img
                src={activeSample.src}
                alt={`Ảnh mẫu ${activeTitle}`}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setSampleLoadError(true)}
                onClick={() =>
                  setZoomImage({
                    src: activeSample.src,
                    title: activeTitle,
                    subtitle: activeSample.sourceLabel,
                    badgeText: activeSample.isUserImage
                      ? 'Ảnh của bạn'
                      : 'Ảnh dự phòng',
                    badgeTone: activeSample.isUserImage ? 'user' : 'fallback',
                    downloadFilename: `sample_${String(activeSampleKey ?? 'style').replace(/[^a-zA-Z0-9_-]+/g, '_')}.png`,
                  })
                }
                className="h-full w-full cursor-zoom-in object-cover"
              />
              <button
                type="button"
                aria-label={`Phóng to ảnh mẫu ${activeTitle}`}
                title="Phóng to ảnh"
                onClick={() =>
                  setZoomImage({
                    src: activeSample.src,
                    title: activeTitle,
                    subtitle: activeSample.sourceLabel,
                    badgeText: activeSample.isUserImage
                      ? 'Ảnh của bạn'
                      : 'Ảnh dự phòng',
                    badgeTone: activeSample.isUserImage ? 'user' : 'fallback',
                    downloadFilename: `sample_${String(activeSampleKey ?? 'style').replace(/[^a-zA-Z0-9_-]+/g, '_')}.png`,
                  })
                }
                className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#080f1d]/82 text-sky-200 ring-1 ring-inset ring-white/[0.18] backdrop-blur-sm transition-all hover:bg-sky-500/35 hover:text-white active:scale-95"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </>
          ) : activeSample && sampleLoadError ? (
            <div className="flex flex-col items-center justify-center px-2 text-center text-amber-300/90">
              <AlertTriangle className="h-4 w-4" />
              <span className="mt-1 text-[10px] leading-tight">
                Không tải được ảnh
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-2 text-center text-slate-500">
              <ImageIcon className="h-5 w-5 opacity-70" />
              <span className="mt-1 text-[10px] leading-tight">
                Chưa có ảnh mẫu
              </span>
            </div>
          )}
        </div>

        {/* Details & Sample Management Actions */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-sky-200">
              {activeTitle}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {activeTab === 'style'
                ? `#${activeStyleIndex >= 0 ? activeStyleIndex + 1 : 1}/${allStyles.length}`
                : `#${activeAngleIndex >= 0 ? activeAngleIndex + 1 : 1}/${IMAGE_CAMERA_ANGLES.length}`}
            </span>
            {activeSample && !sampleLoadError && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                  activeSample.isUserImage
                    ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/30'
                    : 'bg-sky-500/12 text-sky-300 ring-sky-400/24'
                }`}
              >
                {activeSample.isUserImage ? 'Ảnh của bạn' : 'Ảnh dự phòng'}
              </span>
            )}
            {activeTab === 'style' && activeAngle.id !== 'auto' && (
              <span className="text-[10px] text-amber-300/90">
                · Góc máy: {activeAngle.label}
              </span>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            {activeDesc}
          </p>
          {activeSample && (
            <p
              className={`text-[10px] ${
                sampleLoadError
                  ? 'text-amber-300'
                  : activeSample.isUserImage
                    ? 'text-emerald-300/95'
                    : 'text-slate-400'
              }`}
            >
              {sampleLoadError
                ? 'Không hiển thị được ảnh mẫu từ URL này — bấm "Xem / Lưu" để mở dự phòng hoặc đổi URL/tải từ máy.'
                : `Ảnh so sánh: ${activeSample.sourceLabel}`}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={isCompressing || isImportingUrl}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/14 px-2.5 text-[11px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/28 transition-all hover:bg-sky-500/24 disabled:opacity-50 whitespace-nowrap"
            >
              <Upload className="h-3 w-3" />
              <span>
                {isCompressing
                  ? 'Đang nén...'
                  : activeSample?.isUserImage
                    ? 'Đổi ảnh từ máy'
                    : 'Thêm ảnh từ máy'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUrlInput((v) => !v);
                setShowPortraitPicker(false);
                setSampleUrlError('');
              }}
              className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                showUrlInput
                  ? 'bg-cyan-500/22 text-cyan-100 ring-1 ring-inset ring-cyan-400/40'
                  : 'bg-cyan-500/12 text-cyan-200 ring-1 ring-inset ring-cyan-400/28 hover:bg-cyan-500/22'
              }`}
            >
              <Link2 className="h-3 w-3" />
              <span>Dán URL ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPortraitPicker((v) => !v);
                setShowUrlInput(false);
              }}
              className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                showPortraitPicker
                  ? 'bg-indigo-500/24 text-indigo-100 ring-1 ring-inset ring-indigo-400/40'
                  : 'bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/[0.10] hover:bg-white/[0.12]'
              }`}
            >
              <Users className="h-3 w-3" />
              <span>Chọn từ Ảnh NV/NPC ({portraitsWithImages.length})</span>
            </button>
            {activeSample && !sampleLoadError && (
              <button
                type="button"
                onClick={() =>
                  setZoomImage({
                    src: activeSample.src,
                    title: activeTitle,
                    subtitle: activeSample.sourceLabel,
                    badgeText: activeSample.isUserImage
                      ? 'Ảnh của bạn'
                      : 'Ảnh dự phòng',
                    badgeTone: activeSample.isUserImage ? 'user' : 'fallback',
                    downloadFilename: `sample_${String(activeSampleKey ?? 'style').replace(/[^a-zA-Z0-9_-]+/g, '_')}.png`,
                  })
                }
                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 transition-all hover:bg-sky-500/26 whitespace-nowrap"
                title="Phóng to xem rõ nét ảnh so sánh đang chọn"
              >
                <ZoomIn className="h-3 w-3" />
                <span>Phóng to</span>
              </button>
            )}
            {activeSample && onDownloadImage && (
              <button
                type="button"
                onClick={() => {
                  const safeSlug = String(activeSampleKey ?? 'style').replace(/[^a-zA-Z0-9_-]+/g, '_');
                  onDownloadImage(
                    activeSample.src,
                    `sample_${safeSlug}.png`,
                  );
                }}
                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.06] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.10] transition-all hover:bg-white/[0.12] whitespace-nowrap"
                title="Xem / Lưu ảnh mẫu (hỗ trợ dự phòng khi chặn CORS)"
              >
                <Download className="h-3 w-3" />
                <span>Xem / Lưu</span>
              </button>
            )}
            {canRestoreDefaultSample && isActiveDefaultHidden && (
              <button
                type="button"
                onClick={handleRestoreDefaultSample}
                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-amber-500/14 px-2 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/28 transition-all hover:bg-amber-500/24 whitespace-nowrap"
                title="Hiện lại ảnh dự phòng có sẵn khi chưa gán ảnh riêng"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Hiện dự phòng</span>
              </button>
            )}
            {activeSample && (
              <button
                type="button"
                onClick={handleRemoveSample}
                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-rose-500/12 px-2 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/25 transition-all hover:bg-rose-500/22 whitespace-nowrap"
              >
                <Trash2 className="h-3 w-3" />
                <span>
                  {activeSample.isUserImage ? 'Gỡ ảnh riêng' : 'Ẩn dự phòng'}
                </span>
              </button>
            )}
          </div>
          {/* Portable Sample Pack Sync (Carry all 15 Style & 8 Camera Angle user images across Remix / Devices) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
            <button
              type="button"
              onClick={handleExportSamplePack}
              className="inline-flex min-h-[26px] items-center gap-1 rounded-md bg-white/[0.045] px-2 text-[10px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
              title="Xuất toàn bộ ảnh mẫu bạn đã gán (15 Phong cách & 8 Góc máy) ra tệp JSON để mang sang tài khoản Remix khác"
            >
              <FolderDown className="h-3 w-3 text-sky-300" />
              <span>Xuất bộ ảnh mẫu</span>
            </button>
            <button
              type="button"
              onClick={() => importPackInputRef.current?.click()}
              className="inline-flex min-h-[26px] items-center gap-1 rounded-md bg-white/[0.045] px-2 text-[10px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
              title="Nạp tệp JSON bộ ảnh mẫu từ bản sao lưu / tài khoản trước (giữ nguyên các ảnh khác của bạn)"
            >
              <FolderUp className="h-3 w-3 text-emerald-300" />
              <span>Nạp bộ ảnh mẫu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inline Image URL Input Drawer for Comparison Sample */}
      {showUrlInput && (
        <div className="rounded-xl border border-cyan-400/25 bg-[#0f1b2e] p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-cyan-200">
              Nhập hoặc dán URL ảnh mẫu cho "{activeTitle}"
            </span>
            <button
              type="button"
              onClick={() => {
                setShowUrlInput(false);
                setSampleUrlError('');
              }}
              className="rounded-md p-1 text-slate-400 hover:bg-white/[0.08] hover:text-white"
              aria-label="Đóng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <input
              type="url"
              value={sampleUrlDraft}
              onChange={(e) => {
                setSampleUrlDraft(e.target.value);
                if (sampleUrlError) setSampleUrlError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isImportingUrl) {
                  e.preventDefault();
                  void handleApplySampleUrl();
                }
              }}
              placeholder="https://example.com/preview-style.jpg"
              className="min-w-0 flex-1 rounded-lg border border-white/[0.10] bg-[#09111f] px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/75 focus:outline-none"
            />
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={isImportingUrl}
                onClick={() => void handlePasteSampleUrl()}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.10] hover:bg-white/[0.12] disabled:opacity-50 whitespace-nowrap"
              >
                <Copy className="h-3 w-3" />
                <span>Dán</span>
              </button>
              <button
                type="button"
                disabled={isImportingUrl || !sampleUrlDraft.trim()}
                onClick={() => void handleApplySampleUrl()}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-gradient-to-b from-sky-500 to-blue-600 px-3 text-[11px] font-semibold text-white shadow-[0_6px_14px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 disabled:opacity-45 whitespace-nowrap"
              >
                {isImportingUrl ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>{isImportingUrl ? 'Đang tải...' : 'Áp dụng URL'}</span>
              </button>
            </div>
          </div>
          {sampleUrlError ? (
            <p className="text-[11px] text-rose-300">{sampleUrlError}</p>
          ) : (
            <p className="text-[10px] leading-relaxed text-slate-400">
              Hệ thống sẽ ưu tiên tải và nén nhẹ vào bộ nhớ ARK_LITE_AI_STUDIO_V1;
              nếu máy chủ ảnh chặn CORS sẽ tự động giữ URL hợp lệ để hiển thị và hỗ
              trợ xem/lưu dự phòng.
            </p>
          )}
        </div>
      )}

      {/* Inline Portrait Library Picker for Comparison Sample */}
      {showPortraitPicker && (
        <div className="rounded-xl border border-indigo-400/25 bg-[#101a2d] p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-indigo-200">
              Chọn ảnh từ Thư viện Ảnh NV/NPC làm ảnh mẫu cho "{activeTitle}"
            </span>
            <button
              type="button"
              onClick={() => setShowPortraitPicker(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-white/[0.08] hover:text-white"
              aria-label="Đóng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {portraitsWithImages.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Chưa có ảnh nào trong Thư viện Ảnh NV/NPC. Hãy tạo hoặc tải ảnh
              nhân vật trước, hoặc dùng nút "Thêm ảnh từ máy".
            </p>
          ) : (
            <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-4 md:grid-cols-5">
              {portraitsWithImages.map((p) => {
                const isSelectedRef =
                  sampleImages[activeSampleKey] === `portrait:${p.id}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePickPortraitAsSample(p)}
                    className={`group relative overflow-hidden rounded-lg bg-[#0b1220] text-left ring-1 transition-all ${
                      isSelectedRef
                        ? 'ring-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.45)]'
                        : 'ring-white/[0.09] hover:ring-sky-400/50'
                    }`}
                  >
                    <img
                      src={p.imageData}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="h-20 w-full object-cover"
                    />
                    <div className="truncate px-1.5 py-1 text-[10px] font-medium text-slate-200">
                      {p.name}
                    </div>
                    {isSelectedRef && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-400 text-[#09111f]">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save Custom Style Drawer */}
      {showCustomCreator && activeTab === 'style' && (
        <div className="rounded-xl border border-emerald-400/25 bg-[#101c2c] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-100">
                Tạo & lưu kiểu phong cách tùy chỉnh
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomCreator(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-white/[0.08] hover:text-white"
              aria-label="Đóng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-300">
              Tên phong cách tùy chỉnh *
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ví dụ: Điện ảnh Hong Kong 90s, Thủy mặc huyền huyễn ánh vàng..."
              className="w-full rounded-lg border border-white/[0.10] bg-[#0b1220] px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
              <label className="text-[11px] font-medium text-slate-300">
                Mô tả phong cách (tùy chọn — kế thừa từ "{activeStyle.label}" nếu để trống)
              </label>
              <button
                type="button"
                onClick={() =>
                  insertTokenIntoCreator('desc', '${image_style_description}')
                }
                className="rounded-md bg-sky-500/14 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/25 hover:bg-sky-500/24"
              >
                + {'${image_style_description}'}
              </button>
            </div>
            <textarea
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              rows={2}
              placeholder="Mô tả màu sắc, không khí, cảm giác tranh... Có thể bấm nút trên để kế thừa ${image_style_description}."
              className="w-full rounded-lg border border-white/[0.10] bg-[#0b1220] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
              <label className="text-[11px] font-medium text-slate-300">
                Chỉ dẫn prompt kỹ thuật (Prompt Guide)
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() =>
                    insertTokenIntoCreator(
                      'guide',
                      '${image_style_description}',
                    )
                  }
                  className="rounded-md bg-sky-500/14 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/25 hover:bg-sky-500/24"
                >
                  + {'${image_style_description}'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertTokenIntoCreator(
                      'guide',
                      '${image_style_prompt_guide}',
                    )
                  }
                  className="rounded-md bg-sky-500/14 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/25 hover:bg-sky-500/24"
                >
                  + {'${image_style_prompt_guide}'}
                </button>
              </div>
            </div>
            <textarea
              value={customGuide}
              onChange={(e) => setCustomGuide(e.target.value)}
              rows={2}
              placeholder="Ví dụ: ${image_style_prompt_guide}, neon Wong Kar-wai rain reflections, 35mm Kodak film..."
              className="w-full rounded-lg border border-white/[0.10] bg-[#0b1220] px-2.5 py-1.5 font-mono text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCustomCreator(false)}
              className="min-h-[34px] rounded-lg bg-white/[0.06] px-3 text-xs font-semibold text-slate-300 hover:bg-white/[0.12]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveCustomStyle}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-emerald-500/22 px-3 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/40 transition-all hover:bg-emerald-500/32 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Lưu dưới dạng kiểu tùy chỉnh</span>
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Prompt Style Variables Inspector */}
      {showVars && (
        <div className="rounded-xl border border-sky-400/20 bg-[#121d30]/90 p-2.5 space-y-2">
          <p className="text-[11px] leading-relaxed text-slate-300">
            Hệ thống tự động thay thế 3 biến phong cách khi sinh ảnh (nếu prompt
            chưa có biến, phong cách đang chọn vẫn tự động gắn vào prompt):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {IMAGE_STYLE_VARIABLES.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => handleVariableClick(token)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-sky-500/14 px-2 py-1 font-mono text-[10px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/28 transition-all hover:bg-sky-500/24 active:scale-[0.98]"
                title={
                  onInsertVariable
                    ? `Chèn ${token} (${VARIABLE_LABELS[token].hint})`
                    : `Sao chép ${token} (${VARIABLE_LABELS[token].hint})`
                }
              >
                {onInsertVariable ? (
                  <Plus className="h-3 w-3 shrink-0" />
                ) : (
                  <Copy className="h-3 w-3 shrink-0" />
                )}
                <span>{token}</span>
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-[#0b1220]/90 p-2 font-mono text-[10px] leading-relaxed text-slate-300 space-y-1">
            <div>
              <span className="text-sky-400">{'${image_style_name}'}: </span>
              <span>{activeStyle.label}</span>
            </div>
            <div>
              <span className="text-sky-400">
                {'${image_style_description}'}:{' '}
              </span>
              <span>{activeStyle.description}</span>
            </div>
            <div>
              <span className="text-sky-400">
                {'${image_style_prompt_guide}'}:{' '}
              </span>
              <span className="text-slate-400">{activeStyle.promptGuide}</span>
            </div>
          </div>
        </div>
      )}

      {/* Clickable Card Grid: Styles or Camera Angles */}
      {expanded && activeTab === 'style' && (
        <div
          className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${
            compact ? 'max-h-[320px]' : 'max-h-[380px] lg:grid-cols-3'
          } overflow-y-auto pr-0.5`}
        >
          {allStyles.map((style, idx) => {
            const isActive = style.id === activeStyle.id;
            const thumb = resolveEffectiveSampleImage(
              'style',
              style.id,
              sampleImages,
              portraits,
            );
            const numberedTitle = `${String(idx + 1).padStart(2, '0')}. ${style.label}`;
            return (
              <div
                key={style.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  onUpdateStoryImageConfig({ stylePreset: style.id })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onUpdateStoryImageConfig({ stylePreset: style.id });
                  }
                }}
                className={`group flex min-h-[78px] cursor-pointer items-stretch gap-2.5 rounded-xl p-2.5 text-left transition-all active:scale-[0.985] ${
                  isActive
                    ? 'bg-sky-500/16 ring-1 ring-inset ring-sky-400/55 shadow-[0_6px_18px_-8px_rgba(56,189,248,0.45)]'
                    : 'bg-[#162032]/85 ring-1 ring-inset ring-white/[0.07] hover:bg-[#1c2940] hover:ring-white/[0.16]'
                }`}
              >
                {thumb && (
                  <div className="relative h-16 w-14 shrink-0 self-center overflow-hidden rounded-lg ring-1 ring-white/[0.14]">
                    <img
                      src={thumb.src}
                      alt={style.label}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Phóng to ảnh mẫu ${numberedTitle}`}
                      title="Phóng to ảnh mẫu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomImage({
                          src: thumb.src,
                          title: numberedTitle,
                          subtitle: thumb.sourceLabel,
                          badgeText: thumb.isUserImage
                            ? 'Ảnh của bạn'
                            : 'Ảnh dự phòng',
                          badgeTone: thumb.isUserImage ? 'user' : 'fallback',
                          downloadFilename: `style_${style.id}.png`,
                        });
                      }}
                      className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#070e1c]/82 text-sky-200 ring-1 ring-inset ring-white/[0.20] backdrop-blur-sm transition-all hover:bg-sky-500/45 hover:text-white active:scale-95"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div className="flex w-full items-start justify-between gap-1.5">
                    <span
                      className={`text-xs font-semibold leading-snug ${
                        isActive ? 'text-sky-100' : 'text-slate-100'
                      }`}
                    >
                      <span className="mr-1 font-mono text-[10px] text-slate-400">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      {style.label}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {style.isCustom && (
                        <button
                          type="button"
                          onClick={(e) =>
                            handleDeleteCustomStyle(e, style.id, style.label)
                          }
                          title="Xóa kiểu tùy chỉnh"
                          className="rounded-md p-1 text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-200"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                      {isActive && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-400 text-[#09111f]">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                    {style.description}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-medium ${
                        style.isCustom
                          ? 'text-emerald-300'
                          : isActive
                            ? 'text-sky-300'
                            : 'text-slate-500'
                      }`}
                    >
                      {style.category}
                    </span>
                    {thumb && (
                      <span
                        className={`text-[10px] font-medium ${
                          thumb.isUserImage
                            ? 'text-emerald-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {thumb.isUserImage ? 'Ảnh của bạn' : 'Dự phòng'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && activeTab === 'angle' && (
        <div
          className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${
            compact ? 'max-h-[300px]' : 'max-h-[340px] lg:grid-cols-3'
          } overflow-y-auto pr-0.5`}
        >
          {IMAGE_CAMERA_ANGLES.map((angle, idx) => {
            const isActive = angle.id === activeAngle.id;
            const thumb = resolveEffectiveSampleImage(
              'angle',
              angle.id,
              sampleImages,
              portraits,
            );
            const numberedAngleTitle = `${String(idx + 1).padStart(2, '0')}. ${angle.label}`;
            return (
              <div
                key={angle.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  onUpdateStoryImageConfig({
                    cameraAngle: angle.id as ImageCameraAngleId,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onUpdateStoryImageConfig({
                      cameraAngle: angle.id as ImageCameraAngleId,
                    });
                  }
                }}
                className={`group flex min-h-[76px] cursor-pointer items-stretch gap-2.5 rounded-xl p-2.5 text-left transition-all active:scale-[0.985] ${
                  isActive
                    ? 'bg-sky-500/16 ring-1 ring-inset ring-sky-400/55 shadow-[0_6px_18px_-8px_rgba(56,189,248,0.45)]'
                    : 'bg-[#162032]/85 ring-1 ring-inset ring-white/[0.07] hover:bg-[#1c2940] hover:ring-white/[0.16]'
                }`}
              >
                {thumb && (
                  <div className="relative h-16 w-14 shrink-0 self-center overflow-hidden rounded-lg ring-1 ring-white/[0.14]">
                    <img
                      src={thumb.src}
                      alt={angle.label}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Phóng to ảnh mẫu ${numberedAngleTitle}`}
                      title="Phóng to ảnh mẫu góc máy"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomImage({
                          src: thumb.src,
                          title: numberedAngleTitle,
                          subtitle: thumb.sourceLabel,
                          badgeText: thumb.isUserImage
                            ? 'Ảnh của bạn'
                            : 'Ảnh dự phòng',
                          badgeTone: thumb.isUserImage ? 'user' : 'fallback',
                          downloadFilename: `angle_${angle.id}.png`,
                        });
                      }}
                      className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#070e1c]/82 text-sky-200 ring-1 ring-inset ring-white/[0.20] backdrop-blur-sm transition-all hover:bg-sky-500/45 hover:text-white active:scale-95"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div className="flex w-full items-start justify-between gap-2">
                    <span
                      className={`text-xs font-semibold leading-snug ${
                        isActive ? 'text-sky-100' : 'text-slate-100'
                      }`}
                    >
                      <span className="mr-1 font-mono text-[10px] text-slate-400">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      {angle.label}
                    </span>
                    {isActive && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-400 text-[#09111f]">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                    {angle.description}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-500">
                      Góc máy #{idx + 1}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        thumb?.isUserImage
                          ? 'text-emerald-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {thumb?.isUserImage ? 'Ảnh của bạn' : 'Chưa gán ảnh'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Zoom Lightbox for Style & Camera Angle Samples */}
      <ImageZoomModal
        image={zoomImage}
        onClose={() => setZoomImage(null)}
        onDownloadImage={onDownloadImage}
      />
    </div>
  );
}
