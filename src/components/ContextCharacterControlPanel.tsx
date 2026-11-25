import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Edit3,
  List,
  Lock,
  Network,
  Pin,
  RefreshCw,
  Search,
  Sparkles,
  Unlock,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  CharacterPortrait,
  MemoryManagerConfig,
  PortraitBankConfig,
  WorldGenreId,
} from '../types/ark';
import {
  buildOnlineCharacterKeySet,
  isCharacterOnlineInSet,
  resolvePortraitRoleTier,
} from '../utils/characterUtils';
import { matchesQuery } from '../utils/search';
import { CharacterNameBadge } from './CharacterNameBadge';
import { RelationshipNetworkGraph } from './RelationshipNetworkGraph';
import { ResolvedAvatarImage } from './ResolvedAvatarImage';

export type ControlViewMode = 'list' | 'network';

interface ContextCharacterControlPanelProps {
  portraitBank: PortraitBankConfig;
  memory?: MemoryManagerConfig;
  worldGenre?: WorldGenreId;
  onlineCharacterNames?: string[];
  viewMode?: ControlViewMode;
  onViewModeChange?: (mode: ControlViewMode) => void;
  onUpdatePortraitBank: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
  onSyncFromCompanion: () => void;
}

type ControlFilter = 'all' | 'pinned' | 'locked' | 'main' | 'npc' | 'mob';
type RoleTier = 'main' | 'npc' | 'mob';

interface RoleBadgeMeta {
  tier: RoleTier;
  tierLabel: string;
  detailLabel: string;
  badgeClass: string;
  dotClass: string;
}

interface RolePresetGroup {
  label: string;
  roles: string[];
}

const TIER_ROLE_PRESETS: Array<{
  role: string;
  tier: RoleTier;
  activeClass: string;
  idleClass: string;
  dotClass: string;
}> = [
  {
    role: 'Main',
    tier: 'main',
    activeClass: 'bg-orange-500/22 text-orange-100 ring-orange-400/50',
    idleClass:
      'bg-orange-500/[0.07] text-orange-200/85 ring-orange-400/20 hover:bg-orange-500/16 hover:text-orange-100',
    dotClass: 'bg-orange-400',
  },
  {
    role: 'NPC',
    tier: 'npc',
    activeClass: 'bg-sky-500/22 text-sky-100 ring-sky-400/50',
    idleClass:
      'bg-sky-500/[0.07] text-sky-200/85 ring-sky-400/20 hover:bg-sky-500/16 hover:text-sky-100',
    dotClass: 'bg-sky-400',
  },
  {
    role: 'Mob',
    tier: 'mob',
    activeClass: 'bg-slate-500/28 text-slate-100 ring-slate-400/50',
    idleClass:
      'bg-slate-500/[0.09] text-slate-300 ring-slate-400/20 hover:bg-slate-500/20 hover:text-slate-100',
    dotClass: 'bg-slate-400',
  },
];

const CORE_ROLE_PRESETS = [
  'Main',
  'NPC',
  'Mob',
  'Đồng minh',
  'Người thương',
  'Bạn thân',
  'Đối thủ',
  'Phản diện',
  'Nhân vật bí ẩn',
  'Quần chúng',
];

const MODERN_ROLE_PRESETS = [
  'Nghệ sĩ / Ngôi sao',
  'Quản lý / Trợ lý',
  'Đối tác / Doanh nhân',
  'Bạn cùng phòng',
  'Người thân',
  'Truyền thông / Nhà báo',
];

const CLASSICAL_ROLE_PRESETS = [
  'Sư tôn / Trưởng lão',
  'Đồng môn',
  'Hộ vệ / Thủ hạ',
  'Hoàng tộc / Quyền quý',
  'Tán tu / Khách giang hồ',
  'Chưởng quỹ / Thương nhân',
];

const FANTASY_ROLE_PRESETS = [
  'Chỉ huy / Đội trưởng',
  'Đồng đội thám hiểm',
  'Pháp sư / Học giả',
  'Thương nhân / Môi giới',
  'Lính đánh thuê',
  'Người sống sót',
];

export function resolvePortraitRoleBadge(
  p: Pick<CharacterPortrait, 'role' | 'isMc'>,
): RoleBadgeMeta {
  const { tier, tierLabel, detailLabel } = resolvePortraitRoleTier(p);

  if (tier === 'main') {
    return {
      tier: 'main',
      tierLabel,
      detailLabel,
      badgeClass:
        'bg-orange-500/18 text-orange-200 ring-1 ring-inset ring-orange-400/40',
      dotClass: 'bg-orange-400',
    };
  }

  if (tier === 'mob') {
    return {
      tier: 'mob',
      tierLabel,
      detailLabel,
      badgeClass:
        'bg-slate-500/20 text-slate-300 ring-1 ring-inset ring-slate-400/35',
      dotClass: 'bg-slate-400',
    };
  }

  return {
    tier: 'npc',
    tierLabel,
    detailLabel,
    badgeClass:
      'bg-sky-500/18 text-sky-200 ring-1 ring-inset ring-sky-400/40',
    dotClass: 'bg-sky-400',
  };
}

export function CharacterRoleLockPopover({
  characterName,
  roleMeta,
  isLocked,
  onSelectRole,
  onToggleLock,
  onClose,
}: {
  characterName: string;
  roleMeta: RoleBadgeMeta;
  isLocked: boolean;
  onSelectRole: (role: 'Main' | 'NPC' | 'Mob') => void;
  onToggleLock: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="menu"
      aria-label={`Tùy chọn vai trò và khóa AI cho ${characterName}`}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-[calc(100%+6px)] z-50 w-[264px] max-w-[calc(100vw-3rem)] rounded-xl border border-white/[0.13] bg-[#0d1628] p-2.5 shadow-[0_20px_44px_-12px_rgba(2,6,23,0.95)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/[0.07] pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-bold text-slate-100">
            {characterName}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${roleMeta.badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${roleMeta.dotClass}`} />
            <span>{roleMeta.tierLabel}</span>
          </span>
        </div>
        <button
          type="button"
          aria-label="Đóng menu nhân vật"
          onClick={onClose}
          className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick Role Tier Switcher: Main (orange), NPC (blue), Mob (gray) */}
      <div className="mb-2">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Gán nhanh vai trò
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {TIER_ROLE_PRESETS.map((preset) => {
            const active = roleMeta.tier === preset.tier;
            return (
              <button
                key={preset.role}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() =>
                  onSelectRole(preset.role as 'Main' | 'NPC' | 'Mob')
                }
                className={`inline-flex min-h-[30px] items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-all ${
                  active ? preset.activeClass : preset.idleClass
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${preset.dotClass}`} />
                <span>{preset.role}</span>
                {active && <Check className="h-3 w-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Auto-Enrich Lock Toggle */}
      <div className="border-t border-white/[0.07] pt-2">
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={isLocked}
          onClick={onToggleLock}
          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left ring-1 ring-inset transition-colors ${
            isLocked
              ? 'bg-rose-500/16 text-rose-100 ring-rose-400/40 hover:bg-rose-500/24'
              : 'bg-white/[0.04] text-slate-200 ring-white/[0.08] hover:bg-white/[0.09]'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            {isLocked ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-rose-300" />
            ) : (
              <Unlock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <div className="min-w-0">
              <div className="text-[11px] font-semibold leading-tight">
                Tạm khóa hồ sơ AI
              </div>
              <div className="mt-0.5 text-[10px] leading-snug text-slate-400">
                {isLocked
                  ? 'Đang chặn AI tự sửa hồ sơ'
                  : 'AI có thể tự làm sinh động'}
              </div>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              isLocked
                ? 'bg-rose-500/28 text-rose-100'
                : 'bg-white/[0.07] text-slate-300'
            }`}
          >
            {isLocked ? 'Bật' : 'Tắt'}
          </span>
        </button>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function getSecondaryQuickRolesForGenre(genre?: WorldGenreId): string[] {
  if (genre === 'xianxia' || genre === 'xuanhuan' || genre === 'ancient') {
    return [
      'Đồng minh',
      'Người thương',
      'Đồng môn',
      'Sư tôn / Trưởng lão',
      'Đối thủ',
      'Phản diện',
      'Quần chúng',
    ];
  }
  if (genre === 'fantasy' || genre === 'apocalypse' || genre === 'scifi') {
    return [
      'Đồng minh',
      'Đồng đội thám hiểm',
      'Chỉ huy / Đội trưởng',
      'Đối thủ',
      'Phản diện',
      'Quần chúng',
    ];
  }
  if (genre === 'showbiz') {
    return [
      'Người thương',
      'Bạn thân',
      'Nghệ sĩ / Ngôi sao',
      'Quản lý / Trợ lý',
      'Đối thủ',
      'Quần chúng',
    ];
  }
  return [
    'Đồng minh',
    'Người thương',
    'Bạn thân',
    'Đối thủ',
    'Phản diện',
    'Quần chúng',
  ];
}

function getGroupedRolePresets(genre?: WorldGenreId): RolePresetGroup[] {
  const isClassical =
    genre === 'xianxia' || genre === 'xuanhuan' || genre === 'ancient';
  const isFantasy =
    genre === 'fantasy' || genre === 'apocalypse' || genre === 'scifi';

  const groups: RolePresetGroup[] = [
    { label: 'Phân loại & vị thế cốt truyện', roles: CORE_ROLE_PRESETS },
  ];
  if (isClassical) {
    groups.push({ label: 'Cổ đại / Tiên hiệp', roles: CLASSICAL_ROLE_PRESETS });
    groups.push({ label: 'Hiện đại / Giải trí', roles: MODERN_ROLE_PRESETS });
    groups.push({ label: 'Kỳ ảo / Sinh tồn', roles: FANTASY_ROLE_PRESETS });
  } else if (isFantasy) {
    groups.push({ label: 'Kỳ ảo / Sinh tồn', roles: FANTASY_ROLE_PRESETS });
    groups.push({ label: 'Hiện đại / Giải trí', roles: MODERN_ROLE_PRESETS });
    groups.push({ label: 'Cổ đại / Tiên hiệp', roles: CLASSICAL_ROLE_PRESETS });
  } else {
    groups.push({ label: 'Hiện đại / Giải trí', roles: MODERN_ROLE_PRESETS });
    groups.push({ label: 'Cổ đại / Tiên hiệp', roles: CLASSICAL_ROLE_PRESETS });
    groups.push({ label: 'Kỳ ảo / Sinh tồn', roles: FANTASY_ROLE_PRESETS });
  }
  return groups;
}

export function ContextCharacterControlPanel({
  portraitBank,
  memory,
  worldGenre,
  onlineCharacterNames,
  viewMode: controlledViewMode,
  onViewModeChange,
  onUpdatePortraitBank,
  onSyncFromCompanion,
}: ContextCharacterControlPanelProps) {
  const [internalViewMode, setInternalViewMode] =
    useState<ControlViewMode>('list');
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (next: ControlViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(next);
    } else {
      setInternalViewMode(next);
    }
  };
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ControlFilter>('all');
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const [customRoleDraft, setCustomRoleDraft] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openMenuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handlePointerDown = (ev: MouseEvent | TouchEvent) => {
      const el = openMenuContainerRef.current;
      if (el && !el.contains(ev.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, {
      passive: true,
    });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  const portraits = portraitBank.portraits || [];

  const counts = useMemo(() => {
    let pinned = 0;
    let locked = 0;
    let main = 0;
    let npc = 0;
    let mob = 0;
    for (const p of portraits) {
      if (p.pinned) pinned += 1;
      if (p.aiAutoEnrichLocked) locked += 1;
      const tier = resolvePortraitRoleBadge(p).tier;
      if (tier === 'main') main += 1;
      else if (tier === 'mob') mob += 1;
      else npc += 1;
    }
    return { pinned, locked, main, npc, mob };
  }, [portraits]);

  const secondaryQuickRoles = useMemo(
    () => getSecondaryQuickRolesForGenre(worldGenre),
    [worldGenre],
  );
  const roleGroups = useMemo(
    () => getGroupedRolePresets(worldGenre),
    [worldGenre],
  );

  const filteredPortraits = useMemo(() => {
    const sorted = [...portraits].sort((a, b) => {
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      const aSeen =
        typeof a.lastSeenTurnIndex === 'number' ? a.lastSeenTurnIndex : -1;
      const bSeen =
        typeof b.lastSeenTurnIndex === 'number' ? b.lastSeenTurnIndex : -1;
      if (aSeen !== bSeen) return bSeen - aSeen;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    return sorted.filter((p) => {
      const tier = resolvePortraitRoleBadge(p).tier;
      if (filter === 'pinned' && !p.pinned) return false;
      if (filter === 'locked' && !p.aiAutoEnrichLocked) return false;
      if (filter === 'main' && tier !== 'main') return false;
      if (filter === 'npc' && tier !== 'npc') return false;
      if (filter === 'mob' && tier !== 'mob') return false;
      if (
        query.trim() &&
        !matchesQuery(
          `${p.name} ${p.role || ''} ${tier} ${p.contextSnippet || ''} ${p.appearance || ''} ${p.personality || ''}`,
          query,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [portraits, filter, query]);

  const onlineCharacterKeySet = useMemo(
    () => buildOnlineCharacterKeySet(onlineCharacterNames),
    [onlineCharacterNames],
  );

  const togglePin = (portraitId: string) => {
    onUpdatePortraitBank((prev) => ({
      ...prev,
      portraits: (prev.portraits || []).map((p) =>
        p.id === portraitId
          ? { ...p, pinned: !p.pinned, updatedAt: Date.now() }
          : p,
      ),
    }));
  };

  const toggleAiLock = (portraitId: string) => {
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

  const assignRole = (portraitId: string, nextRole: string) => {
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

  const openCustomRoleEditor = (p: CharacterPortrait) => {
    setCustomRoleId(p.id);
    setCustomRoleDraft(p.role || '');
  };

  const saveCustomRole = (portraitId: string) => {
    const cleaned = customRoleDraft.trim();
    if (cleaned) {
      assignRole(portraitId, cleaned);
    }
    setCustomRoleId(null);
    setCustomRoleDraft('');
  };

  const addRelationshipTag = (
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

  const assignFactionTag = (portraitId: string, factionName: string) => {
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

  return (
    <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-sky-400" />
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Điều khiển Nhân vật (Portrait Bank)
            </h2>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Ghim để giữ tham chiếu khi chuyển cảnh, tạm khóa để chặn AI tự làm
            sinh động, hoặc gán nhanh nhãn vai trò trực quan. Nhãn màu chỉ hỗ
            trợ nhận diện và kiểm soát dữ liệu theo từng ván chơi — không áp
            giáp cốt truyện hay ưu tiên cứng cho bất kỳ nhân vật nào.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* View Mode Switcher: Danh sách nhân vật / Sơ đồ mạng lưới quan hệ */}
          <div
            role="tablist"
            aria-label="Chế độ xem nhân vật"
            className="inline-flex items-center gap-0.5 rounded-xl bg-[#0e1625]/90 p-1 ring-1 ring-inset ring-white/[0.08]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all whitespace-nowrap ${
                viewMode === 'list'
                  ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Danh sách nhân vật</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'network'}
              onClick={() => setViewMode('network')}
              className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all whitespace-nowrap ${
                viewMode === 'network'
                  ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>Sơ đồ mạng lưới quan hệ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onSyncFromCompanion}
            title="Quét nhân vật, mối quan hệ và trạng thái từ lượt truyện hiện tại (kèm hồ sơ Đồng nhân)"
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5 text-sky-300" />
            <span>Đồng bộ NPC lượt này</span>
          </button>
        </div>
      </div>

      {/* Compact Color Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-xl bg-[#0e1625]/70 px-3 py-2 text-[11px] text-slate-400 ring-1 ring-inset ring-white/[0.06]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          <span className="font-medium text-orange-200">Main</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="font-medium text-sky-200">NPC</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span className="font-medium text-slate-300">Mob</span>
        </span>
        <span className="inline-flex items-center gap-1 text-rose-300/90">
          <Lock className="h-3 w-3" />
          <span>Tạm khóa AI tự làm sinh động</span>
        </span>
      </div>

      {viewMode === 'network' ? (
        <RelationshipNetworkGraph
          portraitBank={portraitBank}
          memory={memory}
          onTogglePin={togglePin}
          onToggleAiLock={toggleAiLock}
          onAssignRole={assignRole}
          onAddRelationshipTag={addRelationshipTag}
          onAssignFactionTag={assignFactionTag}
          onUpdatePortraitBank={onUpdatePortraitBank}
        />
      ) : (
        <>
          {/* Search & Filter Row */}
      {portraits.length > 0 && (
        <div className="mb-3.5 flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm nhân vật trong bảng điều khiển ngữ cảnh"
              placeholder="Tìm tên nhân vật, vai trò (Main/NPC/Mob), ngữ cảnh..."
              className="min-h-[36px] w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-1.5 pl-8 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
            {query && (
              <button
                type="button"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#0e1625]/85 p-1 ring-1 ring-inset ring-white/[0.07]">
            {(
              [
                { id: 'all', label: `Tất cả (${portraits.length})` },
                { id: 'main', label: `Main (${counts.main})` },
                { id: 'npc', label: `NPC (${counts.npc})` },
                { id: 'mob', label: `Mob (${counts.mob})` },
                { id: 'pinned', label: `Đã ghim (${counts.pinned})` },
                { id: 'locked', label: `Khóa AI (${counts.locked})` },
              ] as Array<{ id: ControlFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[28px] rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                  filter === tab.id
                    ? tab.id === 'main'
                      ? 'bg-orange-500/20 text-orange-100 ring-1 ring-inset ring-orange-400/40'
                      : tab.id === 'npc'
                        ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/40'
                        : tab.id === 'mob'
                          ? 'bg-slate-500/25 text-slate-100 ring-1 ring-inset ring-slate-400/40'
                          : tab.id === 'pinned'
                            ? 'bg-amber-500/18 text-amber-100 ring-1 ring-inset ring-amber-400/35'
                            : tab.id === 'locked'
                              ? 'bg-rose-500/18 text-rose-100 ring-1 ring-inset ring-rose-400/35'
                              : 'bg-sky-500/18 text-sky-100 ring-1 ring-inset ring-sky-400/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Character Cards */}
      {!filteredPortraits.length ? (
        <div className="rounded-xl border border-dashed border-white/[0.10] bg-[#111b2c]/60 px-4 py-5 text-center text-xs text-slate-400">
          {portraits.length === 0
            ? 'Chưa có nhân vật nào trong Portrait Bank. Hãy bấm "Đồng bộ NPC lượt này" hoặc tạo lượt truyện để hệ thống tự quét nhân vật.'
            : 'Không có nhân vật nào khớp với bộ lọc hoặc từ khóa tìm kiếm.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredPortraits.map((p) => {
            const isPinned = Boolean(p.pinned);
            const isLocked = Boolean(p.aiAutoEnrichLocked);
            const isEditingRole = customRoleId === p.id;
            const roleMeta = resolvePortraitRoleBadge(p);
            const currentRoleNorm = (p.role || '').trim().toLowerCase();
            const previewText =
              p.contextSnippet?.trim() ||
              p.personality?.trim() ||
              p.appearance?.trim() ||
              '';

            const isMenuOpen = openMenuId === p.id;
            const isOnline = isCharacterOnlineInSet(onlineCharacterKeySet, p.name, [
              p.role,
              p.signature,
            ]);

            return (
              <div
                key={p.id}
                className={`relative rounded-xl bg-[#111b2c]/85 p-3 ring-1 ring-inset transition-colors ${
                  isMenuOpen ? 'z-30' : 'z-0'
                } ${
                  isOnline
                    ? 'ring-emerald-400/35 shadow-[0_0_20px_-10px_rgba(52,211,153,0.42)]'
                    : isPinned
                      ? 'ring-amber-400/30 bg-[#141f31]/92'
                      : isLocked
                        ? 'ring-rose-400/25'
                        : 'ring-white/[0.08]'
                }`}
              >
                {/* Top Row: Identity + Clickable Quick Role/Lock Menu + Role Tag + Lock Icon + Controls */}
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#0c1422] ring-1 ring-white/[0.10]">
                      {p.imageData ? (
                        <ResolvedAvatarImage
                          src={p.imageData}
                          alt={`Ảnh ${p.name}`}
                          keyHint={p.id}
                          className="h-full w-full object-cover"
                          compactError
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#1a2944] to-[#0f1729] text-[11px] font-bold text-slate-200">
                          {roleMeta.tier === 'main' ? (
                            <User className="h-4 w-4 text-orange-300" />
                          ) : (
                            getInitials(p.name)
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        ref={isMenuOpen ? openMenuContainerRef : null}
                        className="relative flex flex-wrap items-center gap-1.5"
                      >
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          title="Bấm để đổi nhanh vai trò (Main / NPC / Mob) hoặc bật/tắt Tạm khóa AI"
                          onClick={() =>
                            setOpenMenuId((cur) => (cur === p.id ? null : p.id))
                          }
                          className={`group inline-flex max-w-full items-center gap-1 rounded-lg px-1 py-0.5 -ml-1 text-left transition-colors ${
                            isMenuOpen
                              ? 'bg-sky-500/15 ring-1 ring-inset ring-sky-400/35'
                              : 'hover:bg-white/[0.06]'
                          }`}
                        >
                          <CharacterNameBadge
                            name={p.name}
                            variant="list"
                            isMc={p.isMc}
                            isOnline={isOnline}
                          />
                          <ChevronDown
                            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-150 group-hover:text-sky-300 ${
                              isMenuOpen ? 'rotate-180 text-sky-300' : ''
                            }`}
                          />
                        </button>

                        {/* Small lock icon right next to the character name when temporarily locked */}
                        {isLocked && (
                          <button
                            type="button"
                            onClick={() => toggleAiLock(p.id)}
                            title="Đang tạm khóa: bấm để mở khóa AI tự làm sinh động hồ sơ"
                            aria-label={`${p.name} đang tạm khóa AI`}
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-500/18 text-rose-300 ring-1 ring-inset ring-rose-400/35 transition-colors hover:bg-rose-500/28"
                          >
                            <Lock className="h-3 w-3" />
                          </button>
                        )}

                        {/* Color-coded Role Tag (Orange: Main, Blue: NPC, Gray: Mob) — also opens mini menu */}
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId((cur) => (cur === p.id ? null : p.id))
                          }
                          title="Bấm để gán nhanh vai trò Main / NPC / Mob"
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide transition-opacity hover:opacity-90 ${roleMeta.badgeClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${roleMeta.dotClass}`}
                          />
                          <span>{roleMeta.tierLabel}</span>
                        </button>

                        {isPinned && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30">
                            <Pin className="h-2.5 w-2.5" />
                            <span>Ghim</span>
                          </span>
                        )}

                        {isMenuOpen && (
                          <CharacterRoleLockPopover
                            characterName={p.name}
                            roleMeta={roleMeta}
                            isLocked={isLocked}
                            onSelectRole={(role) => assignRole(p.id, role)}
                            onToggleLock={() => toggleAiLock(p.id)}
                            onClose={() => setOpenMenuId(null)}
                          />
                        )}
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                        {roleMeta.detailLabel ? (
                          <span className="truncate text-slate-300">
                            {roleMeta.detailLabel}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Nhãn vai trò: {roleMeta.tierLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Toggle Buttons */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePin(p.id)}
                      aria-pressed={isPinned}
                      title={
                        isPinned
                          ? 'Bỏ ghim nhân vật khỏi tham chiếu ngữ cảnh'
                          : 'Ghim nhân vật vào tham chiếu ngữ cảnh khi chuyển cảnh'
                      }
                      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-all whitespace-nowrap ${
                        isPinned
                          ? 'bg-amber-500/18 text-amber-100 ring-amber-400/40 hover:bg-amber-500/26'
                          : 'bg-white/[0.045] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                      <span>{isPinned ? 'Đã ghim' : 'Ghim'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAiLock(p.id)}
                      aria-pressed={isLocked}
                      title={
                        isLocked
                          ? 'Mở khóa để cho phép AI tự làm sinh động hồ sơ'
                          : 'Tạm khóa: chặn AI tự động làm sinh động hoặc ghi đè hồ sơ nhân vật này'
                      }
                      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-all whitespace-nowrap ${
                        isLocked
                          ? 'bg-rose-500/18 text-rose-100 ring-rose-400/40 hover:bg-rose-500/26'
                          : 'bg-white/[0.045] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                      }`}
                    >
                      {isLocked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                      <span>{isLocked ? 'Đang khóa AI' : 'Tạm khóa'}</span>
                    </button>
                  </div>
                </div>

                {/* Brief Context / Nuance Snippet */}
                {previewText && (
                  <p className="mt-2 line-clamp-1 text-[11px] text-slate-400">
                    {p.contextSnippet?.trim() ? (
                      <span className="text-slate-300">
                        Dáng &amp; biểu cảm: {p.contextSnippet.trim()}
                      </span>
                    ) : (
                      previewText
                    )}
                  </p>
                )}

                {/* Quick Role Assignment Bar */}
                <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <Sparkles className="h-3 w-3 text-sky-400/80" />
                      Gán vai trò:
                    </span>

                    {/* Primary color-coded tier buttons: Main (orange), NPC (blue), Mob (gray) */}
                    {TIER_ROLE_PRESETS.map((preset) => {
                      const isActiveTier =
                        roleMeta.tier === preset.tier && !roleMeta.detailLabel;
                      return (
                        <button
                          key={preset.role}
                          type="button"
                          onClick={() => assignRole(p.id, preset.role)}
                          className={`inline-flex min-h-[26px] items-center gap-1 rounded-md px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                            isActiveTier ? preset.activeClass : preset.idleClass
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${preset.dotClass}`}
                          />
                          <span>{preset.role}</span>
                        </button>
                      );
                    })}

                    <span
                      aria-hidden="true"
                      className="mx-0.5 h-3.5 w-px bg-white/[0.09]"
                    />

                    {/* Secondary contextual quick roles */}
                    {secondaryQuickRoles.map((roleLabel) => {
                      const active =
                        currentRoleNorm === roleLabel.toLowerCase();
                      return (
                        <button
                          key={roleLabel}
                          type="button"
                          onClick={() => assignRole(p.id, roleLabel)}
                          className={`min-h-[26px] rounded-md px-2 text-[11px] font-medium ring-1 ring-inset transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-sky-500/20 text-sky-100 ring-sky-400/40'
                              : 'bg-[#0e1625]/85 text-slate-300 ring-white/[0.07] hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          {roleLabel}
                        </button>
                      );
                    })}

                    <select
                      aria-label={`Chọn vai trò định sẵn khác cho ${p.name}`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          assignRole(p.id, e.target.value);
                        }
                      }}
                      className="min-h-[26px] rounded-md border border-white/[0.09] bg-[#0e1625]/90 px-2 text-[11px] text-slate-300 focus:border-sky-400/75 focus:outline-none"
                    >
                      <option value="">+ Vai trò khác...</option>
                      {roleGroups.map((grp) => (
                        <optgroup key={grp.label} label={grp.label}>
                          {grp.roles.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {!isEditingRole && (
                      <button
                        type="button"
                        onClick={() => openCustomRoleEditor(p)}
                        title="Nhập vai trò tùy chỉnh"
                        className="inline-flex min-h-[26px] items-center gap-1 rounded-md bg-white/[0.04] px-2 text-[11px] font-medium text-slate-400 ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.09] hover:text-slate-100"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Tùy chỉnh</span>
                      </button>
                    )}
                  </div>

                  {isEditingRole && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customRoleDraft}
                        onChange={(e) => setCustomRoleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveCustomRole(p.id);
                          } else if (e.key === 'Escape') {
                            setCustomRoleId(null);
                          }
                        }}
                        placeholder="Nhập vai trò riêng (VD: Main · Chủ tiệm, Mob qua đường, Đối thủ...)"
                        className="min-h-[30px] flex-1 rounded-lg border border-sky-400/45 bg-[#0e1625] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveCustomRole(p.id)}
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-emerald-500/18 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/26"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Lưu</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomRoleId(null)}
                        className="inline-flex min-h-[30px] items-center rounded-lg bg-white/[0.05] px-2 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}
