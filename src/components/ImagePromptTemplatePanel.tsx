import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileCode2,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Save,
  ZoomIn,
} from 'lucide-react';
import type {
  ArkState,
  ImageGenerationMode,
  ImageGridMode,
  StoryImageConfig,
  Turn,
} from '../types/ark';
import {
  DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE,
  IMAGE_GENERATION_MODE_LABELS,
  IMAGE_GRID_MODE_LABELS,
  IMAGE_PROMPT_TEMPLATE_VARIABLES,
  previewStoryImagePrompt,
} from '../utils/api';
import {
  collectAllAvailablePortraits,
  resolveCameraAngle,
  resolveEffectiveSampleImage,
  resolveStoryImageStyle,
} from '../utils/imageStyles';
import { ImageZoomModal, type ZoomImagePayload } from './ImageZoomModal';

interface ImagePromptTemplatePanelProps {
  appState: ArkState;
  currentTurn?: Turn;
  storyImageConfig: StoryImageConfig;
  onUpdateStoryImageConfig: (
    patch:
      | Partial<StoryImageConfig>
      | ((prev: StoryImageConfig) => Partial<StoryImageConfig>),
  ) => void;
  overrideStoryText?: string;
  onDownloadImage?: (imgSrc: string, filename: string) => void;
  onNotify?: (msg: string, type?: 'info' | 'err') => void;
  defaultOpen?: boolean;
}

export function ImagePromptTemplatePanel({
  appState,
  currentTurn,
  storyImageConfig,
  onUpdateStoryImageConfig,
  overrideStoryText,
  onDownloadImage,
  onNotify,
  defaultOpen = false,
}: ImagePromptTemplatePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [previewMode, setPreviewMode] = useState<'english' | 'after' | 'before'>('english');
  const [zoomImage, setZoomImage] = useState<ZoomImagePayload | null>(null);
  const [draftTemplate, setDraftTemplate] = useState(
    storyImageConfig.promptTemplate?.trim() ||
      DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = storyImageConfig.promptTemplate?.trim() || '';
    setDraftTemplate(saved || DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE);
  }, [storyImageConfig.promptTemplate]);

  const isCustomSaved = Boolean(storyImageConfig.promptTemplate?.trim());
  const hasUnsavedChanges =
    draftTemplate.trim() !==
    (
      storyImageConfig.promptTemplate?.trim() ||
      DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE
    ).trim();

  const allPortraits = useMemo(
    () => collectAllAvailablePortraits(appState),
    [appState.portraitBank, appState.companionPortraits],
  );

  const activeStyle = useMemo(
    () =>
      resolveStoryImageStyle(
        storyImageConfig.stylePreset,
        storyImageConfig.customStyles,
      ),
    [storyImageConfig.stylePreset, storyImageConfig.customStyles],
  );
  const activeAngle = useMemo(
    () => resolveCameraAngle(storyImageConfig.cameraAngle),
    [storyImageConfig.cameraAngle],
  );
  const activeStyleSample = useMemo(
    () =>
      resolveEffectiveSampleImage(
        'style',
        activeStyle.id,
        storyImageConfig.sampleImages,
        allPortraits,
      ),
    [activeStyle.id, storyImageConfig.sampleImages, allPortraits],
  );
  const activeAngleSample = useMemo(
    () =>
      resolveEffectiveSampleImage(
        'angle',
        activeAngle.id,
        storyImageConfig.sampleImages,
        allPortraits,
      ),
    [activeAngle.id, storyImageConfig.sampleImages, allPortraits],
  );
  const [thumbFailed, setThumbFailed] = useState(false);
  const [angleThumbFailed, setAngleThumbFailed] = useState(false);

  useEffect(() => {
    setThumbFailed(false);
  }, [activeStyleSample?.src]);

  useEffect(() => {
    setAngleThumbFailed(false);
  }, [activeAngleSample?.src]);

  const preview = useMemo(
    () =>
      previewStoryImagePrompt({
        state: appState,
        turn: currentTurn,
        storyImageConfig,
        draftTemplate,
        overrideStoryText,
      }),
    [appState, currentTurn, storyImageConfig, draftTemplate, overrideStoryText],
  );

  const handleInsertToken = (token: string) => {
    const el = textareaRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next =
        draftTemplate.slice(0, start) + token + draftTemplate.slice(end);
      setDraftTemplate(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setDraftTemplate((prev) =>
        prev.trim() ? `${prev.trimEnd()} ${token}` : token,
      );
    }
  };

  const handleSaveTemplate = () => {
    const cleaned = draftTemplate.trim();
    if (!cleaned) {
      onUpdateStoryImageConfig({ promptTemplate: '' });
      setDraftTemplate(DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE);
      onNotify?.('Đã khôi phục mẫu prompt sinh ảnh mặc định.');
      return;
    }
    const isSameAsDefault =
      cleaned === DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE.trim();
    onUpdateStoryImageConfig({
      promptTemplate: isSameAsDefault ? '' : cleaned,
    });
    onNotify?.('Đã lưu mẫu prompt sinh ảnh vào cấu hình.');
  };

  const handleResetTemplate = () => {
    setDraftTemplate(DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE);
    onUpdateStoryImageConfig({ promptTemplate: '' });
    onNotify?.('Đã khôi phục mẫu prompt sinh ảnh mặc định.');
  };

  const activePreviewText =
    previewMode === 'english'
      ? preview.finalEnglishPrompt
      : previewMode === 'before'
        ? preview.beforeInjection
        : preview.afterInjection;

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(activePreviewText);
      onNotify?.(
        previewMode === 'english'
          ? 'Đã sao chép Prompt tiếng Anh cuối cùng.'
          : previewMode === 'before'
            ? 'Đã sao chép prompt Trước khi tiêm.'
            : 'Đã sao chép prompt Sau khi tiêm.',
      );
    } catch {
      onNotify?.('Không thể sao chép tự động trên trình duyệt này.', 'err');
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0e1625]/75">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {activeStyleSample && !thumbFailed ? (
            <img
              src={activeStyleSample.src}
              alt={`Ảnh mẫu ${activeStyle.label}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
              className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/[0.12]"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0b1220] text-slate-500 ring-1 ring-white/[0.08]">
              <ImageIcon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <FileCode2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span className="text-xs font-semibold text-slate-100">
                Mẫu Prompt sinh ảnh & Xem trước
              </span>
              {isCustomSaved && (
                <span className="text-[10px] font-semibold text-emerald-300">
                  (Đã tùy chỉnh)
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              Đang tiêm: <span className="text-sky-200">{activeStyle.label}</span>
              {activeAngle.id !== 'auto' ? ` · ${activeAngle.label}` : ''}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08]">
          <span>{open ? 'Thu gọn' : 'Mở mẫu'}</span>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[0.07] p-3">
          {/* Active Style & Camera Angle Sample Reference Strip (Always user-first + zoomable) */}
          <div className="flex flex-col gap-2 rounded-xl bg-[#131d2f]/85 p-2.5 ring-1 ring-inset ring-white/[0.07] sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="relative flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0b1220] ring-1 ring-white/[0.12]">
                {activeStyleSample && !thumbFailed ? (
                  <>
                    <img
                      src={activeStyleSample.src}
                      alt={`Ảnh mẫu ${activeStyle.label}`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setThumbFailed(true)}
                      onClick={() =>
                        setZoomImage({
                          src: activeStyleSample.src,
                          title: `Phong cách: ${activeStyle.label}`,
                          subtitle: activeStyleSample.sourceLabel,
                          badgeText: activeStyleSample.isUserImage
                            ? 'Ảnh của bạn'
                            : 'Ảnh dự phòng',
                          badgeTone: activeStyleSample.isUserImage
                            ? 'user'
                            : 'fallback',
                          downloadFilename: `style_${activeStyle.id}.png`,
                        })
                      }
                      className="h-full w-full cursor-zoom-in object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Phóng to ảnh mẫu phong cách ${activeStyle.label}`}
                      title="Phóng to ảnh mẫu phong cách"
                      onClick={() =>
                        setZoomImage({
                          src: activeStyleSample.src,
                          title: `Phong cách: ${activeStyle.label}`,
                          subtitle: activeStyleSample.sourceLabel,
                          badgeText: activeStyleSample.isUserImage
                            ? 'Ảnh của bạn'
                            : 'Ảnh dự phòng',
                          badgeTone: activeStyleSample.isUserImage
                            ? 'user'
                            : 'fallback',
                          downloadFilename: `style_${activeStyle.id}.png`,
                        })
                      }
                      className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#070e1c]/82 text-sky-200 ring-1 ring-inset ring-white/[0.20] backdrop-blur-sm hover:bg-sky-500/45 hover:text-white"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="h-4 w-4 text-slate-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="truncate font-semibold text-sky-200">
                    {activeStyle.label}
                  </span>
                  {activeAngle.id !== 'auto' && (
                    <span className="text-[10px] text-amber-300/90">
                      · {activeAngle.label}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                  {activeStyle.description}
                </p>
                <p
                  className={`mt-0.5 text-[10px] ${
                    activeStyleSample?.isUserImage
                      ? 'text-emerald-300/95'
                      : 'text-slate-400'
                  }`}
                >
                  {activeStyleSample
                    ? activeStyleSample.sourceLabel
                    : 'Chưa gắn ảnh mẫu cho phong cách này'}
                </p>
              </div>
            </div>

            {activeAngleSample && !angleThumbFailed && (
              <div className="flex shrink-0 items-center gap-2 rounded-lg bg-[#0d1626] p-1.5 ring-1 ring-inset ring-white/[0.08]">
                <div className="relative h-11 w-12 shrink-0 overflow-hidden rounded-md bg-[#080f1d] ring-1 ring-white/[0.12]">
                  <img
                    src={activeAngleSample.src}
                    alt={`Ảnh mẫu góc máy ${activeAngle.label}`}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setAngleThumbFailed(true)}
                    onClick={() =>
                      setZoomImage({
                        src: activeAngleSample.src,
                        title: `Góc máy: ${activeAngle.label}`,
                        subtitle: activeAngleSample.sourceLabel,
                        badgeText: activeAngleSample.isUserImage
                          ? 'Ảnh của bạn'
                          : 'Ảnh dự phòng',
                        badgeTone: activeAngleSample.isUserImage
                          ? 'user'
                          : 'fallback',
                        downloadFilename: `angle_${activeAngle.id}.png`,
                      })
                    }
                    className="h-full w-full cursor-zoom-in object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Phóng to ảnh mẫu góc máy ${activeAngle.label}`}
                    title="Phóng to ảnh góc máy"
                    onClick={() =>
                      setZoomImage({
                        src: activeAngleSample.src,
                        title: `Góc máy: ${activeAngle.label}`,
                        subtitle: activeAngleSample.sourceLabel,
                        badgeText: activeAngleSample.isUserImage
                          ? 'Ảnh của bạn'
                          : 'Ảnh dự phòng',
                        badgeTone: activeAngleSample.isUserImage
                          ? 'user'
                          : 'fallback',
                        downloadFilename: `angle_${activeAngle.id}.png`,
                      })
                    }
                    className="absolute bottom-0.5 right-0.5 inline-flex h-5 w-5 items-center justify-center rounded bg-[#070e1c]/82 text-sky-200 ring-1 ring-inset ring-white/[0.20] hover:bg-sky-500/45 hover:text-white"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </button>
                </div>
                <div className="min-w-0 max-w-[130px]">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-200">
                    <Camera className="h-3 w-3 shrink-0" />
                    <span className="truncate">{activeAngle.label}</span>
                  </div>
                  <p className="truncate text-[10px] text-emerald-300/90">
                    Ảnh của bạn
                  </p>
                </div>
              </div>
            )}
          </div>
          {/* Quick Mode / Grid / Image Count Selectors */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-400">
                Chế độ sinh ({'${image_generation_mode}'})
              </label>
              <select
                value={storyImageConfig.imageGenerationMode || 'scene'}
                onChange={(e) =>
                  onUpdateStoryImageConfig({
                    imageGenerationMode: e.target.value as ImageGenerationMode,
                  })
                }
                className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
              >
                {(
                  Object.keys(
                    IMAGE_GENERATION_MODE_LABELS,
                  ) as ImageGenerationMode[]
                ).map((mode) => (
                  <option key={mode} value={mode}>
                    {IMAGE_GENERATION_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-400">
                Bố cục lưới ({'${image_grid_mode}'})
              </label>
              <select
                value={storyImageConfig.imageGridMode || 'single'}
                onChange={(e) =>
                  onUpdateStoryImageConfig({
                    imageGridMode: e.target.value as ImageGridMode,
                  })
                }
                className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
              >
                {(Object.keys(IMAGE_GRID_MODE_LABELS) as ImageGridMode[]).map(
                  (grid) => (
                    <option key={grid} value={grid}>
                      {IMAGE_GRID_MODE_LABELS[grid]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-400">
                Số lượng ảnh ({'${image_count}'})
              </label>
              <select
                value={String(storyImageConfig.imageCount || 1)}
                onChange={(e) =>
                  onUpdateStoryImageConfig({
                    imageCount: Number(e.target.value) || 1,
                  })
                }
                className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
              >
                <option value="1">1 ảnh</option>
                <option value="2">2 ảnh</option>
                <option value="4">4 ảnh</option>
              </select>
            </div>
          </div>

          {/* 1-Tap Variable Insertion Strip */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-400">
              Chèn nhanh biến ngữ cảnh & phong cách vào mẫu:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {IMAGE_PROMPT_TEMPLATE_VARIABLES.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => handleInsertToken(item.token)}
                  title={`Chèn ${item.token} (${item.label})`}
                  className={`inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition-all active:scale-[0.98] ${
                    item.group === 'style'
                      ? 'bg-sky-500/14 text-sky-200 ring-1 ring-inset ring-sky-400/28 hover:bg-sky-500/24'
                      : item.group === 'mode'
                        ? 'bg-amber-500/12 text-amber-200 ring-1 ring-inset ring-amber-400/26 hover:bg-amber-500/22'
                        : 'bg-emerald-500/12 text-emerald-200 ring-1 ring-inset ring-emerald-400/26 hover:bg-emerald-500/22'
                  }`}
                >
                  <Plus className="h-2.5 w-2.5 shrink-0" />
                  <span>{item.token}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Template Editor */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-300">
                Nội dung mẫu Prompt sinh ảnh
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.055] px-2.5 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.11] hover:text-white whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Khôi phục mặc định</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                    hasUnsavedChanges
                      ? 'bg-sky-500 text-white shadow-[0_4px_12px_-4px_rgba(14,165,233,0.55)] hover:bg-sky-400'
                      : 'bg-emerald-500/16 text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/24'
                  }`}
                >
                  <Save className="h-3 w-3" />
                  <span>{hasUnsavedChanges ? 'Lưu mẫu *' : 'Lưu mẫu'}</span>
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={draftTemplate}
              onChange={(e) => setDraftTemplate(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0b1220] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>

          {/* Live Prompt Preview: Trước khi tiêm / Sau khi tiêm */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0b1220]/95 p-2.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-[11px] font-semibold text-slate-200">
                  Xem trước Prompt
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex flex-wrap rounded-lg bg-[#162032] p-0.5 ring-1 ring-inset ring-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('english')}
                    className={`min-h-[28px] rounded-md px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                      previewMode === 'english'
                        ? 'bg-emerald-500/22 text-emerald-100 ring-1 ring-inset ring-emerald-400/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Prompt Anh cuối cùng
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('after')}
                    className={`min-h-[28px] rounded-md px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                      previewMode === 'after'
                        ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/38'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sau khi tiêm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('before')}
                    className={`min-h-[28px] rounded-md px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                      previewMode === 'before'
                        ? 'bg-amber-500/22 text-amber-100 ring-1 ring-inset ring-amber-400/38'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Mẫu biến gốc
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-white/[0.06] px-2 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.12] hover:text-white"
                  title="Sao chép nội dung xem trước"
                >
                  <Copy className="h-3 w-3" />
                  <span>Chép</span>
                </button>
              </div>
            </div>

            {/* Visual Sample Reference inside Before/After Injection Preview with Zoom Buttons */}
            {((activeStyleSample && !thumbFailed) ||
              (activeAngleSample && !angleThumbFailed)) && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#10192a]/90 p-2 ring-1 ring-inset ring-white/[0.06]">
                {activeStyleSample && !thumbFailed && (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <img
                      src={activeStyleSample.src}
                      alt={`Ảnh đối chiếu ${activeStyle.label}`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onClick={() =>
                        setZoomImage({
                          src: activeStyleSample.src,
                          title: `Phong cách: ${activeStyle.label}`,
                          subtitle: activeStyleSample.sourceLabel,
                          badgeText: activeStyleSample.isUserImage
                            ? 'Ảnh của bạn'
                            : 'Ảnh dự phòng',
                          badgeTone: activeStyleSample.isUserImage
                            ? 'user'
                            : 'fallback',
                          downloadFilename: `style_${activeStyle.id}.png`,
                        })
                      }
                      className="h-11 w-14 shrink-0 cursor-zoom-in rounded-md object-cover ring-1 ring-white/[0.14]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-sky-200">
                        {activeStyle.label}
                      </p>
                      <p
                        className={`truncate text-[10px] ${
                          activeStyleSample.isUserImage
                            ? 'text-emerald-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {activeStyleSample.isUserImage
                          ? 'Ảnh của bạn'
                          : 'Ảnh dự phòng'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomImage({
                          src: activeStyleSample.src,
                          title: `Phong cách: ${activeStyle.label}`,
                          subtitle: activeStyleSample.sourceLabel,
                          badgeText: activeStyleSample.isUserImage
                            ? 'Ảnh của bạn'
                            : 'Ảnh dự phòng',
                          badgeTone: activeStyleSample.isUserImage
                            ? 'user'
                            : 'fallback',
                          downloadFilename: `style_${activeStyle.id}.png`,
                        })
                      }
                      className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-sky-500/16 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/32 hover:bg-sky-500/26 whitespace-nowrap"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                      <span>Phóng to</span>
                    </button>
                  </div>
                )}

                {activeAngleSample && !angleThumbFailed && (
                  <div className="flex min-w-0 flex-1 items-center gap-2 border-t border-white/[0.06] pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
                    <img
                      src={activeAngleSample.src}
                      alt={`Ảnh góc máy ${activeAngle.label}`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onClick={() =>
                        setZoomImage({
                          src: activeAngleSample.src,
                          title: `Góc máy: ${activeAngle.label}`,
                          subtitle: activeAngleSample.sourceLabel,
                          badgeText: activeAngleSample.isUserImage
                            ? 'Ảnh của bạn'
                            : 'Ảnh dự phòng',
                          badgeTone: activeAngleSample.isUserImage
                            ? 'user'
                            : 'fallback',
                          downloadFilename: `angle_${activeAngle.id}.png`,
                        })
                      }
                      className="h-11 w-14 shrink-0 cursor-zoom-in rounded-md object-cover ring-1 ring-white/[0.14]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-amber-200">
                        {activeAngle.label}
                      </p>
                      <p className="truncate text-[10px] text-emerald-300">
                        Ảnh của bạn
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomImage({
                          src: activeAngleSample.src,
                          title: `Góc máy: ${activeAngle.label}`,
                          subtitle: activeAngleSample.sourceLabel,
                          badgeText: activeAngleSample.isUserImage
                            ? 'Ảnh của bạn'
                            : 'Ảnh dự phòng',
                          badgeTone: activeAngleSample.isUserImage
                            ? 'user'
                            : 'fallback',
                          downloadFilename: `angle_${activeAngle.id}.png`,
                        })
                      }
                      className="inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-lg bg-amber-500/16 px-2.5 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/32 hover:bg-amber-500/26 whitespace-nowrap"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                      <span>Phóng to</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[#070d18] p-2.5 font-mono text-[11px] leading-relaxed text-slate-200 ring-1 ring-inset ring-white/[0.05]">
              {activePreviewText}
            </pre>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>
                {previewMode === 'english'
                  ? 'Prompt tiếng Anh liền mạch cuối cùng (Chủ thể & khóa mặt riêng + Trang phục + Hành động/Góc máy + Bối cảnh/Ánh sáng/Phong cách) sẽ gửi tới máy chủ tạo ảnh.'
                  : previewMode === 'before'
                    ? 'Hiển thị mẫu gốc với các biến ${...} chưa thay thế.'
                    : 'Hiển thị mẫu sau khi tiêm biến ngữ cảnh, nhân vật, thời gian, địa điểm & phong cách.'}
              </span>
              <span className="font-mono">
                {activePreviewText.length} ký tự
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Lightbox for Prompt Preview Style & Camera Angle Samples */}
      <ImageZoomModal
        image={zoomImage}
        onClose={() => setZoomImage(null)}
        onDownloadImage={onDownloadImage}
      />
    </div>
  );
}
