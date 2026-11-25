import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Hand,
  Share2,
  X,
} from 'lucide-react';
import {
  canShareImageFile,
  shareImageFile,
  type ImageSaveFallbackPayload,
} from '../utils/storage';

interface ImageSaveModalProps {
  payload: ImageSaveFallbackPayload | null;
  onClose: () => void;
  onNotify: (msg: string, type?: 'info' | 'err') => void;
}

export function ImageSaveModal({
  payload,
  onClose,
  onNotify,
}: ImageSaveModalProps) {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsErr, setStatusIsErr] = useState(false);

  useEffect(() => {
    setStatusMsg(null);
    setStatusIsErr(false);
  }, [payload?.previewUrl]);

  useEffect(() => {
    if (!payload) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [payload, onClose]);

  if (!payload || typeof document === 'undefined') return null;

  const canWebShare = canShareImageFile(payload.file);
  const openTabHref = /^https?:\/\//i.test(payload.originalSrc)
    ? payload.originalSrc
    : payload.previewUrl;

  const handleShareClick = async () => {
    if (!payload.file) return;
    const outcome = await shareImageFile(payload.file, payload.filename);
    if (outcome === 'shared') {
      const msg = 'Đã mở bảng chia sẻ — chọn "Lưu hình ảnh" để lưu vào máy.';
      setStatusIsErr(false);
      setStatusMsg(msg);
      onNotify(msg);
    } else if (outcome === 'cancelled') {
      setStatusIsErr(false);
      setStatusMsg('Đã đóng bảng chia sẻ. Bạn vẫn có thể chạm giữ ảnh để lưu.');
    } else {
      const msg =
        'Trình duyệt chặn bảng chia sẻ trong khung hiện tại — hãy chạm giữ trực tiếp vào ảnh để lưu hoặc bấm "Mở tab mới".';
      setStatusIsErr(true);
      setStatusMsg(msg);
      onNotify(msg, 'err');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-[#060b14]/88 p-3 backdrop-blur-md sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Lưu ảnh về thiết bị"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#141f31] ring-1 ring-white/[0.12] shadow-[0_28px_72px_-12px_rgba(2,6,23,0.92)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-100">
              Lưu ảnh về thiết bị
            </h3>
            <p className="truncate text-[11px] text-slate-400">
              {payload.filename}
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng khung lưu ảnh"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Large Touch-Friendly Image Preview (native long-press enabled) */}
        <div className="flex min-h-0 flex-1 overflow-auto overscroll-contain bg-[#0b1220] p-3">
          <img
            src={payload.previewUrl}
            alt={payload.filename}
            className="m-auto block h-auto w-auto max-h-[54dvh] max-w-full shrink-0 rounded-xl object-contain shadow-[0_14px_36px_-10px_rgba(0,0,0,0.75)] select-auto [-webkit-touch-callout:default]"
          />
        </div>

        {/* Instruction & Action Bar */}
        <div className="shrink-0 space-y-3 border-t border-white/[0.08] bg-[#162235] px-4 py-3.5">
          <div className="flex items-start gap-2 rounded-xl bg-sky-500/[0.10] px-3 py-2.5 text-xs leading-relaxed text-sky-100 ring-1 ring-inset ring-sky-400/22">
            <Hand className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <span>{payload.hint}</span>
          </div>

          {statusMsg && (
            <div
              className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed ring-1 ring-inset ${
                statusIsErr
                  ? 'bg-amber-500/12 text-amber-100 ring-amber-400/28'
                  : 'bg-emerald-500/12 text-emerald-100 ring-emerald-400/28'
              }`}
            >
              <CheckCircle2
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                  statusIsErr ? 'text-amber-300' : 'text-emerald-300'
                }`}
              />
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {canWebShare && (
              <button
                type="button"
                onClick={() => void handleShareClick()}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_8px_20px_-6px_rgba(14,165,233,0.5)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.98] whitespace-nowrap"
              >
                <Share2 className="h-4 w-4 shrink-0" />
                <span>Chia sẻ / Lưu ảnh</span>
              </button>
            )}

            <a
              href={payload.previewUrl}
              download={payload.filename}
              onClick={() => {
                const msg = `Đã kích hoạt tải ảnh (${payload.filename}). Nếu chưa thấy tải xuống, hãy chạm giữ vào ảnh để lưu.`;
                setStatusIsErr(false);
                setStatusMsg(msg);
                onNotify(msg);
              }}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] whitespace-nowrap ${
                canWebShare
                  ? 'bg-white/[0.07] text-slate-100 ring-white/[0.12] hover:bg-white/[0.13]'
                  : 'bg-gradient-to-b from-sky-500 to-blue-600 text-white ring-sky-400/30 hover:from-sky-400 hover:to-blue-500'
              }`}
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>Tải file</span>
            </a>

            <a
              href={openTabHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                const msg =
                  'Đã mở ảnh ở tab mới — chạm giữ ảnh để lưu vào thư viện.';
                setStatusIsErr(false);
                setStatusMsg(msg);
                onNotify(msg);
              }}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] px-3.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.12] transition-all hover:bg-white/[0.13] hover:text-white active:scale-[0.98] whitespace-nowrap"
            >
              <ExternalLink className="h-4 w-4 shrink-0 text-sky-300" />
              <span>Mở tab mới</span>
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
