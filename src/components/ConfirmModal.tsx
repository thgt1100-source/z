import { useEffect } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmTone = 'primary',
  onConfirm,
  onCancel,
  onDismiss,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#090f1b]/72 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[#172235]/96 p-6 ring-1 ring-white/[0.10] shadow-[0_24px_60px_-16px_rgba(2,6,23,0.82)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-modal-title"
          className="text-base font-bold tracking-tight text-slate-50"
        >
          {title}
        </h3>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-300/95">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[42px] rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] transition-all hover:bg-white/[0.11] hover:text-white active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[42px] rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap shrink-0 ${
              confirmTone === 'danger'
                ? 'bg-rose-500/20 text-rose-100 ring-1 ring-inset ring-rose-400/35 hover:bg-rose-500/30'
                : 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-[0_8px_20px_-6px_rgba(14,165,233,0.45)] hover:from-sky-400 hover:to-blue-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
