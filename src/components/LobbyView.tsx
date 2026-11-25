import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Play,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ViewName } from '../types/ark';
import { useResolvedMediaUrl } from '../hooks/useResolvedMediaUrl';
import type { AutoSaveStatus, StorageHealthInfo } from '../utils/storage';

interface LobbyViewProps {
  lobbyBgDataUrl: string;
  turnCount: number;
  slotCount?: number;
  cultivationSummary?: string;
  autoSaveStatus?: AutoSaveStatus;
  storageHealth?: StorageHealthInfo | null;
  turnsSinceLastBackup?: number;
  lastBackupAt?: number | null;
  isQuickBackingUp?: boolean;
  onStartNewStory: () => void;
  onNavigate: (view: ViewName) => void;
  onPickBg: () => void;
  onQuickBackup?: () => void;
}

function formatShortTime(ts: number | null | undefined): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function LobbyView({
  lobbyBgDataUrl,
  turnCount,
  slotCount = 0,
  cultivationSummary,
  autoSaveStatus,
  storageHealth,
  turnsSinceLastBackup = 0,
  isQuickBackingUp = false,
  onStartNewStory,
  onNavigate,
  onPickBg,
  onQuickBackup,
}: LobbyViewProps) {
  const [dismissedStorageWarn, setDismissedStorageWarn] = useState(false);
  const { resolvedUrl: resolvedLobbyBg } = useResolvedMediaUrl(lobbyBgDataUrl, {
    keyHint: 'lobby_bg:active',
    pageIndex: null,
    kind: 'bg',
    enabled: Boolean(lobbyBgDataUrl),
  });
  const hasLobbyBg = Boolean(resolvedLobbyBg);
  const hasBackupableData = turnCount > 0 || slotCount > 0;
  const showStorageWarning =
    Boolean(storageHealth?.hasRestrictionWarning) && !dismissedStorageWarn;
  const savedTimeText = formatShortTime(autoSaveStatus?.lastSavedAt);

  return (
    <section className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center px-4 py-5 sm:px-6">
      <div
        className={`relative flex min-h-[calc(100dvh-2.5rem)] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-cover bg-center px-5 pb-9 pt-16 ring-1 ring-white/[0.10] shadow-[0_24px_64px_-20px_rgba(2,8,23,0.78)] ${
          hasLobbyBg ? 'bg-[#121c2d]/90' : 'bg-[#0f1829]/56'
        }`}
        style={
          hasLobbyBg
            ? { backgroundImage: `url("${resolvedLobbyBg.replace(/"/g, '\\"')}")` }
            : undefined
        }
      >
        {hasLobbyBg ? (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0f1726]/55 via-[#101828]/72 to-[#0e1524]/88"
            aria-hidden="true"
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0d1626]/38 via-[#0f1829]/54 to-[#0b1322]/74"
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          onClick={onPickBg}
          title="Chọn hoặc xóa ảnh nền sảnh"
          className="absolute left-4 top-4 z-10 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#10192a]/86 px-3.5 py-2 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.12] transition-all hover:bg-[#19263d]/94 hover:ring-sky-400/35 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
        >
          <ImageIcon className="h-4 w-4 text-sky-300" />
          <span>Ảnh nền</span>
        </button>

        {hasBackupableData && onQuickBackup && (
          <button
            type="button"
            disabled={isQuickBackingUp}
            onClick={onQuickBackup}
            title="Sao lưu nhanh toàn bộ phiên hiện tại ra file .json về máy"
            className={`absolute right-4 top-4 z-10 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.98] disabled:opacity-60 whitespace-nowrap ${
              turnsSinceLastBackup >= 5
                ? 'bg-amber-500/20 text-amber-100 ring-amber-400/45 hover:bg-amber-500/30'
                : 'bg-[#10192a]/86 text-emerald-200 ring-emerald-400/30 hover:bg-[#19263d]/94 hover:ring-emerald-400/45'
            }`}
          >
            {isQuickBackingUp ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Sao lưu</span>
            {turnsSinceLastBackup >= 5 && (
              <span className="rounded-md bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-100">
                +{turnsSinceLastBackup}
              </span>
            )}
          </button>
        )}

        {/* Subtle Storage / Iframe Restriction Warning Banner */}
        {showStorageWarning && storageHealth && (
          <div className="relative z-10 mb-5 w-full max-w-md rounded-2xl bg-amber-950/78 px-3.5 py-2.5 text-left ring-1 ring-inset ring-amber-400/32 backdrop-blur-md">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-semibold text-amber-100">
                  {storageHealth.warningTitle}
                </p>
                <p className="text-[11px] leading-relaxed text-amber-100/85">
                  {storageHealth.warningMessage}
                </p>
                {onQuickBackup && hasBackupableData && (
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={isQuickBackingUp}
                      onClick={onQuickBackup}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-amber-400/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-300/40 transition-colors hover:bg-amber-400/30 active:scale-[0.98] disabled:opacity-60"
                    >
                      {isQuickBackingUp ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      <span>Tải backup .json ngay</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label="Đóng cảnh báo lưu trữ"
                onClick={() => setDismissedStorageWarn(true)}
                className="shrink-0 rounded-lg p-1 text-amber-200/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="relative z-10 mb-8 text-center">
          <h1
            className="font-serif text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(2,8,23,0.65)] sm:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            Ark Lite
          </h1>
          <p className="mt-2.5 text-[11px] font-semibold tracking-[0.28em] text-sky-200/85 uppercase drop-shadow-[0_1px_6px_rgba(2,8,23,0.7)]">
            Mobile Edition
          </p>
          {hasBackupableData && savedTimeText && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0e1728]/80 px-2.5 py-1 text-[11px] text-emerald-200/90 ring-1 ring-inset ring-emerald-400/22">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span>Auto-Save {savedTimeText}</span>
            </div>
          )}
        </div>

        <div className="relative z-10 flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={onStartNewStory}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-sky-500 to-blue-600 px-5 py-3.5 text-sm font-semibold tracking-wide text-white shadow-[0_12px_28px_-8px_rgba(14,165,233,0.52)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-white text-white" />
            <span>Khởi tạo</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('companion')}
            className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#142034]/88 px-4 py-3.5 text-sm font-semibold tracking-wide text-slate-100 ring-1 ring-inset ring-white/[0.11] transition-all hover:bg-[#1c2b44]/94 hover:ring-sky-300/35 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
          >
            <FileText className="h-4 w-4 text-sky-300" />
            <span>Đồng nhân</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-2xl bg-[#142034]/88 px-3 py-3 text-center ring-1 ring-inset ring-white/[0.11] transition-all hover:bg-[#1c2b44]/94 hover:ring-sky-300/35 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Clock className="h-5 w-5 text-sky-300" />
              <span className="text-xs font-semibold tracking-wide text-slate-100 whitespace-nowrap">
                Tiếp tục
              </span>
              <span className="text-[11px] text-slate-300/90 tabular-nums">
                {turnCount} lượt
              </span>
              {cultivationSummary && (
                <span className="max-w-full truncate text-[10px] font-medium text-emerald-300/95">
                  {cultivationSummary}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('data')}
              className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#142034]/88 px-3 py-3.5 text-center ring-1 ring-inset ring-white/[0.11] transition-all hover:bg-[#1c2b44]/94 hover:ring-sky-300/35 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <FolderOpen className="h-5 w-5 text-teal-300" />
              <span className="text-xs font-semibold tracking-wide text-slate-100 whitespace-nowrap">
                Dữ liệu
              </span>
              <span className="text-[11px] text-slate-300/90 whitespace-nowrap">
                {slotCount > 0 ? `${slotCount} slot · JSON` : 'Save / Nhập JSON'}
              </span>
            </button>
          </div>

          {hasBackupableData && onQuickBackup && (
            <button
              type="button"
              disabled={isQuickBackingUp}
              onClick={onQuickBackup}
              className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold tracking-wide ring-1 ring-inset transition-all active:scale-[0.985] disabled:opacity-60 whitespace-nowrap ${
                turnsSinceLastBackup >= 5
                  ? 'bg-amber-500/18 text-amber-100 ring-amber-400/38 hover:bg-amber-500/26'
                  : 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30 hover:bg-emerald-500/22'
              }`}
            >
              {isQuickBackingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>
                {isQuickBackingUp
                  ? 'Đang đóng gói file backup...'
                  : 'Sao lưu nhanh 1 chạm (.json)'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('config')}
            className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#142034]/88 px-4 py-3.5 text-sm font-semibold tracking-wide text-slate-100 ring-1 ring-inset ring-white/[0.11] transition-all hover:bg-[#1c2b44]/94 hover:ring-sky-300/35 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
          >
            <Settings className="h-4 w-4 text-slate-300" />
            <span>Cấu hình hệ thống</span>
          </button>
        </div>
      </div>
    </section>
  );
}
