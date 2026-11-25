import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';

export interface ZoomImagePayload {
  src: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeTone?: 'user' | 'fallback';
  downloadFilename?: string;
}

interface ImageZoomModalProps {
  image: ZoomImagePayload | null;
  onClose: () => void;
  onDownloadImage?: (imgSrc: string, filename: string) => void;
}

export function ImageZoomModal({
  image,
  onClose,
  onDownloadImage,
}: ImageZoomModalProps) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setZoomed(false);
  }, [image?.src]);

  useEffect(() => {
    if (!image) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [image, onClose]);

  if (!image || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Phóng to ảnh: ${image.title}`}
      onClick={onClose}
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#050a14]/92 p-2.5 backdrop-blur-md sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#131d2f] ring-1 ring-white/[0.14] shadow-[0_28px_72px_-12px_rgba(2,6,23,0.95)]"
      >
        {/* Top Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] bg-[#162235] px-3.5 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-xs font-bold text-slate-100 sm:text-sm">
                {image.title}
              </h3>
              {image.badgeText && (
                <span
                  className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                    image.badgeTone === 'user'
                      ? 'bg-emerald-500/16 text-emerald-200 ring-emerald-400/32'
                      : 'bg-sky-500/14 text-sky-200 ring-sky-400/28'
                  }`}
                >
                  {image.badgeText}
                </span>
              )}
            </div>
            {image.subtitle && (
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {image.subtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoomed((v) => !v)}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-white/[0.07] px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.10] transition-colors hover:bg-white/[0.14] hover:text-white active:scale-[0.97]"
              title={zoomed ? 'Thu về vừa khung' : 'Phóng lớn 1.75x'}
            >
              {zoomed ? (
                <ZoomOut className="h-4 w-4 text-sky-300" />
              ) : (
                <ZoomIn className="h-4 w-4 text-sky-300" />
              )}
              <span className="hidden sm:inline">
                {zoomed ? 'Vừa khung' : 'Phóng 1.75x'}
              </span>
            </button>
            {onDownloadImage && (
              <button
                type="button"
                onClick={() =>
                  onDownloadImage(
                    image.src,
                    image.downloadFilename || 'anh_mau_phong_cach.png',
                  )
                }
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-sky-500/18 px-2.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 transition-colors hover:bg-sky-500/28 active:scale-[0.97]"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Lưu ảnh</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Đóng xem ảnh phóng to"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/16 text-rose-100 ring-1 ring-inset ring-rose-400/35 transition-colors hover:bg-rose-500/28 active:scale-[0.95]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Full-Clarity Image Viewport (m-auto avoids flexbox overflow clipping when zoomed) */}
        <div className="flex min-h-0 flex-1 overflow-auto overscroll-contain bg-[#080e1a] p-2.5 sm:p-4">
          <img
            src={image.src}
            alt={image.title}
            referrerPolicy="no-referrer"
            onClick={() => setZoomed((v) => !v)}
            className={`m-auto block shrink-0 rounded-xl object-contain shadow-[0_16px_44px_-12px_rgba(0,0,0,0.85)] transition-all duration-200 select-auto [-webkit-touch-callout:default] ${
              zoomed
                ? 'h-auto max-h-none w-[160%] max-w-none cursor-zoom-out sm:w-[135%]'
                : 'h-auto w-auto max-h-[76dvh] max-w-full cursor-zoom-in sm:max-h-[80dvh]'
            }`}
          />
        </div>

        {/* Easy-to-Tap Mobile Footer Close Bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.08] bg-[#162235] px-3.5 py-2.5 sm:px-4">
          <span className="text-[11px] text-slate-400">
            Chạm vào ảnh để {zoomed ? 'thu vừa khung' : 'phóng lớn thêm'} · Chạm ra ngoài để đóng
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.10] px-4 text-xs font-semibold text-white ring-1 ring-inset ring-white/[0.14] transition-colors hover:bg-white/[0.18] active:scale-[0.97]"
          >
            <X className="h-4 w-4" />
            <span>Đóng</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
