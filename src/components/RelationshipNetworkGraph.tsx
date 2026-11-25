import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Check,
  ChevronDown,
  Crown,
  Eye,
  EyeOff,
  Flame,
  FolderPlus,
  Heart,
  Layers,
  Link2,
  Lock,
  Maximize2,
  Minimize2,
  Move,
  Network,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import type {
  CharacterPortrait,
  MemoryManagerConfig,
  PortraitBankConfig,
  RelationshipGroup,
  RelationshipGroupKind,
  RelationshipLayerKind,
  RelationshipTone,
} from '../types/ark';
import {
  isInvalidNpcPortrait,
  normalizeCharacterKey,
} from '../utils/characterUtils';
import {
  applyManualRelationshipEdgeToBank,
  buildRelationshipGraph,
  clampCoord,
  deleteCustomRelationshipGroupInBank,
  deleteRelationshipEdgeFromBank,
  extractPrimaryAutoGroupForPortrait,
  GROUP_COLOR_SWATCHES,
  GROUP_KIND_META,
  LAYER_META,
  PAD_BOTTOM,
  PAD_TOP,
  PAD_X,
  QUICK_RELATION_PRESETS,
  restoreDeletedEdgesInBank,
  SVG_HEIGHT,
  SVG_WIDTH,
  toggleMemberInCustomGroupInBank,
  TONE_META,
  upsertCustomRelationshipGroupInBank,
  type ClusterMode,
  type GraphCluster,
  type GraphEdge,
  type GraphNode,
  type LayerFilter,
  type ToneFilter,
} from '../utils/relationshipGraphEngine';
import {
  CharacterRoleLockPopover,
  resolvePortraitRoleBadge,
} from './ContextCharacterControlPanel';

export type QuickRelationFilter = 'all' | 'family' | 'friends' | 'rival';

interface RelationshipNetworkGraphProps {
  portraitBank: PortraitBankConfig;
  memory?: MemoryManagerConfig;
  quickFilter?: QuickRelationFilter;
  onQuickFilterChange?: (next: QuickRelationFilter) => void;
  onTogglePin: (portraitId: string) => void;
  onToggleAiLock: (portraitId: string) => void;
  onAssignRole?: (portraitId: string, nextRole: string) => void;
  onAddRelationshipTag?: (
    sourceId: string,
    targetName: string,
    relationLabel: string,
  ) => void;
  onAssignFactionTag?: (portraitId: string, factionName: string) => void;
  onUpdatePortraitBank?: (
    updater: (prev: PortraitBankConfig) => PortraitBankConfig,
  ) => void;
}

interface D3SimNode extends d3.SimulationNodeDatum {
  id: string;
  data: GraphNode;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3SimLink extends d3.SimulationLinkDatum<D3SimNode> {
  id: string;
  edge: GraphEdge;
  source: string | D3SimNode;
  target: string | D3SimNode;
}

interface HoverTooltipState {
  node: GraphNode;
  connectionCount: number;
}

const TIER_DESCRIPTION: Record<'main' | 'npc' | 'mob', string> = {
  main: 'Nhãn nhận diện Main (màu cam) — linh hoạt theo diễn biến',
  npc: 'Nhãn nhận diện NPC (màu xanh) — nhân vật tương tác trong truyện',
  mob: 'Nhãn nhận diện Mob (màu xám) — nhân vật nền / quần chúng',
};

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function computeCurvedEdgeGeometry(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  curveSign = 1,
) {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const curveAmt = Math.min(28, len * 0.095) * curveSign;
  const cxCtrl = mx - (dy / len) * curveAmt;
  const cyCtrl = my + (dx / len) * curveAmt;
  const labelX = 0.25 * sx + 0.5 * cxCtrl + 0.25 * tx;
  const labelY = 0.25 * sy + 0.5 * cyCtrl + 0.25 * ty;
  return {
    path: `M ${sx} ${sy} Q ${cxCtrl} ${cyCtrl} ${tx} ${ty}`,
    labelX,
    labelY,
  };
}

export function RelationshipNetworkGraph({
  portraitBank,
  memory,
  quickFilter,
  onQuickFilterChange,
  onTogglePin,
  onToggleAiLock,
  onAssignRole,
  onAddRelationshipTag,
  onAssignFactionTag,
  onUpdatePortraitBank,
}: RelationshipNetworkGraphProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [inspectorMenuOpen, setInspectorMenuOpen] = useState(false);
  const inspectorMenuRef = useRef<HTMLDivElement | null>(null);
  const [hoveredTooltip, setHoveredTooltip] =
    useState<HoverTooltipState | null>(null);

  // Filters & visual mode controls
  const [internalQuickFilter, setInternalQuickFilter] =
    useState<QuickRelationFilter>('all');
  const quickRelationFilter = quickFilter ?? internalQuickFilter;
  const setQuickRelationFilter = (next: QuickRelationFilter) => {
    setInternalQuickFilter(next);
    onQuickFilterChange?.(next);
  };
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [toneFilter, setToneFilter] = useState<ToneFilter>('all');
  const [clusterMode, setClusterMode] = useState<ClusterMode>('layered');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [collapsedClusterIds, setCollapsedClusterIds] = useState<string[]>([]);
  const [hideMob, setHideMob] = useState(false);
  const [showSceneLinks, setShowSceneLinks] = useState(false);
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);

  // Quick Add Link form inside Character Inspector
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkTone, setLinkTone] = useState<RelationshipTone>('ally');
  const [linkCustomLabel, setLinkCustomLabel] = useState('Đồng minh');
  const [factionDraft, setFactionDraft] = useState('');

  // Inline Edge Editor state (when user clicks an edge or hits Edit on a connection)
  const [editingEdge, setEditingEdge] = useState<{
    sourceId: string;
    targetId: string;
    tone: RelationshipTone;
    label: string;
    note: string;
  } | null>(null);

  // Custom Group / Family / Close Circle / Faction Manager Panel
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupKindDraft, setGroupKindDraft] =
    useState<RelationshipGroupKind>('family');
  const [groupColorDraft, setGroupColorDraft] = useState('#f59e0b');
  const [groupMemberDraft, setGroupMemberDraft] = useState<string[]>([]);

  useEffect(() => {
    setInspectorMenuOpen(false);
    setFactionDraft('');
  }, [selectedId]);

  useEffect(() => {
    if (!inspectorMenuOpen) return;
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const el = inspectorMenuRef.current;
      if (el && !el.contains(ev.target as Node)) {
        setInspectorMenuOpen(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setInspectorMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [inspectorMenuOpen]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<d3.Simulation<D3SimNode, D3SimLink> | null>(
    null,
  );
  const simNodesRef = useRef<D3SimNode[]>([]);
  const savedPositionsRef = useRef<
    Map<string, { x: number; y: number; fx?: number | null; fy?: number | null }>
  >(new Map());
  const isDraggingRef = useRef(false);

  const customGroups = useMemo(
    () => portraitBank.relationshipGroups || [],
    [portraitBank.relationshipGroups],
  );
  const edgeOverrides = useMemo(
    () => portraitBank.relationshipOverrides || [],
    [portraitBank.relationshipOverrides],
  );

  const rawPortraits = useMemo(
    () =>
      (portraitBank.portraits || []).filter((p) => !isInvalidNpcPortrait(p)),
    [portraitBank.portraits],
  );
  const filteredInputPortraits = useMemo(
    () =>
      hideMob
        ? rawPortraits.filter(
            (p) => resolvePortraitRoleBadge(p).tier !== 'mob',
          )
        : rawPortraits,
    [rawPortraits, hideMob],
  );

  const collapsedSet = useMemo(
    () => new Set(collapsedClusterIds),
    [collapsedClusterIds],
  );

  const {
    nodes,
    edges,
    clusters,
    allRawEdges,
    deletedOverrideCount,
    blockedContagionCount,
  } = useMemo(
    () =>
      buildRelationshipGraph({
        portraits: filteredInputPortraits,
        memoryEntries: memory?.entries || [],
        characterStates: memory?.characterStates || [],
        customGroups,
        edgeOverrides,
        clusterMode,
        includeSceneCoPresence: showSceneLinks,
        collapsedClusterIds: collapsedSet,
      }),
    [
      filteredInputPortraits,
      memory?.entries,
      memory?.characterStates,
      customGroups,
      edgeOverrides,
      clusterMode,
      showSceneLinks,
      collapsedSet,
    ],
  );

  const clusterById = useMemo(() => {
    const map = new Map<string, GraphCluster>();
    for (const c of clusters) map.set(c.id, c);
    return map;
  }, [clusters]);

  const effectiveClusterId =
    activeClusterId && clusterById.has(activeClusterId)
      ? activeClusterId
      : null;

  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const portraitById = useMemo(() => {
    const map = new Map<string, CharacterPortrait>();
    for (const p of rawPortraits) map.set(p.id, p);
    return map;
  }, [rawPortraits]);

  const existingFactionSuggestions = useMemo(() => {
    const out: string[] = [];
    for (const g of customGroups) {
      if (
        g.name &&
        !out.some(
          (ex) => normalizeCharacterKey(ex) === normalizeCharacterKey(g.name),
        )
      ) {
        out.push(g.name);
      }
    }
    for (const p of rawPortraits) {
      const f = extractPrimaryAutoGroupForPortrait(p)?.name;
      if (
        f &&
        !out.some(
          (ex) => normalizeCharacterKey(ex) === normalizeCharacterKey(f),
        )
      ) {
        out.push(f);
      }
    }
    return out;
  }, [rawPortraits, customGroups]);

  const toneSummary = useMemo(() => {
    let family = 0;
    let intimate = 0;
    let ally = 0;
    let rival = 0;
    let mystery = 0;
    let neutral = 0;
    for (const e of allRawEdges) {
      if (e.tone === 'family') family += 1;
      else if (e.tone === 'intimate') intimate += 1;
      else if (e.tone === 'ally') ally += 1;
      else if (e.tone === 'rival') rival += 1;
      else if (e.tone === 'mystery') mystery += 1;
      else neutral += 1;
    }
    return { family, intimate, ally, rival, mystery, neutral };
  }, [allRawEdges]);

  const quickCategoryCounts = useMemo(() => {
    let family = 0;
    let friends = 0;
    let rival = 0;
    for (const e of edges) {
      if (e.tone === 'family' || e.layer === 'family') family += 1;
      if (
        e.tone !== 'rival' &&
        (e.tone === 'ally' || e.layer === 'close_circle')
      ) {
        friends += 1;
      }
      if (e.tone === 'rival') rival += 1;
    }
    return { family, friends, rival, total: edges.length };
  }, [edges]);

  const matchesQuickRelationFilter = (e: GraphEdge) => {
    if (quickRelationFilter === 'family') {
      return e.tone === 'family' || e.layer === 'family';
    }
    if (quickRelationFilter === 'friends') {
      return (
        e.tone !== 'rival' &&
        (e.tone === 'ally' || e.layer === 'close_circle')
      );
    }
    if (quickRelationFilter === 'rival') {
      return e.tone === 'rival';
    }
    return true;
  };

  const visibleEdges = useMemo(() => {
    return edges.filter((e) => {
      if (!matchesQuickRelationFilter(e)) return false;
      if (layerFilter !== 'all' && e.layer !== layerFilter) return false;
      if (toneFilter !== 'all' && e.tone !== toneFilter) return false;
      return true;
    });
  }, [edges, quickRelationFilter, layerFilter, toneFilter]);

  const { displayedNodes, displayedEdges, displayedClusters } = useMemo(() => {
    if (quickRelationFilter === 'all') {
      return {
        displayedNodes: nodes,
        displayedEdges: visibleEdges,
        displayedClusters: clusters,
      };
    }

    const clusterMatches = (c: GraphCluster) => {
      if (quickRelationFilter === 'family') return c.kind === 'family';
      if (quickRelationFilter === 'friends') return c.kind === 'close_circle';
      if (quickRelationFilter === 'rival') return c.kind === 'faction';
      return true;
    };

    const allowedNodeIds = new Set<string>();
    for (const e of visibleEdges) {
      allowedNodeIds.add(e.sourceId);
      allowedNodeIds.add(e.targetId);
    }

    const matchingClusterIds = new Set<string>();
    for (const c of clusters) {
      if (clusterMatches(c)) {
        matchingClusterIds.add(c.id);
        for (const mId of c.memberIds) allowedNodeIds.add(mId);
      }
    }

    const nextNodes = nodes.filter(
      (n) =>
        allowedNodeIds.has(n.id) ||
        (n.clusterId && matchingClusterIds.has(n.clusterId)),
    );
    const nextNodeIdSet = new Set(nextNodes.map((n) => n.id));
    const nextEdges = visibleEdges.filter(
      (e) => nextNodeIdSet.has(e.sourceId) && nextNodeIdSet.has(e.targetId),
    );
    const nextClusters = clusters.filter(
      (c) =>
        matchingClusterIds.has(c.id) ||
        c.memberIds.some((mId) => nextNodeIdSet.has(mId)),
    );

    return {
      displayedNodes: nextNodes,
      displayedEdges: nextEdges,
      displayedClusters: nextClusters,
    };
  }, [nodes, visibleEdges, clusters, quickRelationFilter]);

  const visibleDegreeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of displayedEdges) {
      map.set(e.sourceId, (map.get(e.sourceId) || 0) + 1);
      map.set(e.targetId, (map.get(e.targetId) || 0) + 1);
    }
    return map;
  }, [displayedEdges]);

  const effectiveSelectedId =
    selectedId && nodeById.has(selectedId) ? selectedId : null;
  const selectedNode = effectiveSelectedId
    ? nodeById.get(effectiveSelectedId) || null
    : null;

  const selectedEdge = useMemo(
    () =>
      selectedEdgeId
        ? visibleEdges.find((e) => e.id === selectedEdgeId) || null
        : null,
    [selectedEdgeId, visibleEdges],
  );

  const connectedEdgesForSelected = useMemo(() => {
    if (!effectiveSelectedId) return [];
    if (selectedNode?.isClusterHub) {
      return visibleEdges.filter(
        (e) =>
          e.sourceId === effectiveSelectedId ||
          e.targetId === effectiveSelectedId,
      );
    }
    return allRawEdges.filter((e) => {
      if (
        e.sourceId !== effectiveSelectedId &&
        e.targetId !== effectiveSelectedId
      ) {
        return false;
      }
      if (!matchesQuickRelationFilter(e)) return false;
      if (layerFilter !== 'all' && e.layer !== layerFilter) return false;
      if (toneFilter !== 'all' && e.tone !== toneFilter) return false;
      return true;
    });
  }, [
    effectiveSelectedId,
    selectedNode?.isClusterHub,
    visibleEdges,
    allRawEdges,
    quickRelationFilter,
    layerFilter,
    toneFilter,
  ]);

  const mobCount = useMemo(
    () =>
      rawPortraits.filter((p) => resolvePortraitRoleBadge(p).tier === 'mob')
        .length,
    [rawPortraits],
  );

  const otherCandidatesForLink = useMemo(() => {
    if (!selectedNode || selectedNode.isClusterHub) return [];
    return rawPortraits.filter((p) => p.id !== selectedNode.portrait.id);
  }, [rawPortraits, selectedNode]);

  // Brief executive summary
  const networkBriefing = useMemo(() => {
    const individualNodes = nodes.filter((n) => !n.isClusterHub);
    const topHubs = [...individualNodes]
      .map((node) => {
        const deg = visibleDegreeMap.get(node.id) || 0;
        let positiveCount = 0;
        let tensionCount = 0;
        let familyCount = 0;
        for (const e of allRawEdges) {
          if (e.sourceId !== node.id && e.targetId !== node.id) continue;
          if (e.tone === 'family') familyCount += 1;
          else if (e.tone === 'intimate' || e.tone === 'ally')
            positiveCount += 1;
          else if (e.tone === 'rival') tensionCount += 1;
        }
        return {
          node,
          degree: deg,
          familyCount,
          positiveCount,
          tensionCount,
        };
      })
      .sort((a, b) => {
        if (b.degree !== a.degree) return b.degree - a.degree;
        const aMain = a.node.tier === 'main' ? 1 : 0;
        const bMain = b.node.tier === 'main' ? 1 : 0;
        if (bMain !== aMain) return bMain - aMain;
        return a.node.portrait.name.localeCompare(b.node.portrait.name, 'vi');
      })
      .slice(0, 4);

    const topClusters = clusters
      .map((c) => {
        const memberSet = new Set(c.memberIds);
        let internalLinks = 0;
        let externalTension = 0;
        for (const e of allRawEdges) {
          const sIn = memberSet.has(e.sourceId);
          const tIn = memberSet.has(e.targetId);
          if (sIn && tIn) internalLinks += 1;
          else if ((sIn || tIn) && e.tone === 'rival') externalTension += 1;
        }
        const memberNames = c.memberIds
          .map((id) => portraitById.get(id)?.name || '')
          .filter(Boolean);
        return {
          ...c,
          internalLinks,
          externalTension,
          memberNames,
        };
      })
      .slice(0, 5);

    const keyRelationships = allRawEdges
      .filter((e) => e.tone !== 'neutral')
      .map((edge) => {
        const sP = portraitById.get(edge.sourceId);
        const tP = portraitById.get(edge.targetId);
        if (!sP || !tP) return null;
        const score =
          (edge.isManual ? 40 : 0) +
          (edge.tone === 'rival'
            ? 35
            : edge.tone === 'family'
              ? 30
              : edge.tone === 'intimate'
                ? 28
                : 18);
        return { edge, sourceName: sP.name, targetName: tP.name, score };
      })
      .filter(
        (
          x,
        ): x is {
          edge: GraphEdge;
          sourceName: string;
          targetName: string;
          score: number;
        } => Boolean(x),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { topHubs, topClusters, keyRelationships };
  }, [nodes, allRawEdges, visibleDegreeMap, clusters, portraitById]);

  // Handlers
  const handleChangeClusterMode = (nextMode: ClusterMode) => {
    if (nextMode === clusterMode) return;
    savedPositionsRef.current.clear();
    setActiveClusterId(null);
    setCollapsedClusterIds([]);
    setClusterMode(nextMode);
  };

  const toggleClusterCollapse = (clusterId: string) => {
    savedPositionsRef.current.clear();
    setSelectedId(null);
    setSelectedEdgeId(null);
    setCollapsedClusterIds((prev) =>
      prev.includes(clusterId)
        ? prev.filter((id) => id !== clusterId)
        : [...prev, clusterId],
    );
  };

  const handleCollapseAllClusters = () => {
    const collapsible = clusters
      .filter((c) => c.memberIds.length >= 2)
      .map((c) => c.id);
    if (!collapsible.length) return;
    savedPositionsRef.current.clear();
    setSelectedId(null);
    setSelectedEdgeId(null);
    setCollapsedClusterIds(collapsible);
  };

  const handleExpandAllClusters = () => {
    if (!collapsedClusterIds.length) return;
    savedPositionsRef.current.clear();
    setCollapsedClusterIds([]);
  };

  const clusterGroupsByKind = useMemo(() => {
    const family = clusters.filter(
      (c) => c.kind === 'family' && c.memberIds.length >= 2,
    );
    const friends = clusters.filter(
      (c) => c.kind === 'close_circle' && c.memberIds.length >= 2,
    );
    const faction = clusters.filter(
      (c) => c.kind === 'faction' && c.memberIds.length >= 2,
    );
    const other = clusters.filter(
      (c) =>
        (c.kind === 'auto' || c.kind === 'role') && c.memberIds.length >= 2,
    );
    return { family, friends, faction, other };
  }, [clusters]);

  const handleToggleCollapseByKind = (
    kind: 'family' | 'close_circle' | 'faction' | 'other',
  ) => {
    const matchingIds = clusters
      .filter((c) => {
        if (c.memberIds.length < 2) return false;
        if (kind === 'other') return c.kind === 'auto' || c.kind === 'role';
        return c.kind === kind;
      })
      .map((c) => c.id);
    if (!matchingIds.length) return;
    savedPositionsRef.current.clear();
    setSelectedId(null);
    setSelectedEdgeId(null);
    setCollapsedClusterIds((prev) => {
      const allCollapsed = matchingIds.every((id) => prev.includes(id));
      if (allCollapsed) {
        return prev.filter((id) => !matchingIds.includes(id));
      }
      return Array.from(new Set([...prev, ...matchingIds]));
    });
  };

  const handleSelectQuickRelationFilter = (
    next: 'all' | 'family' | 'friends' | 'rival',
  ) => {
    setQuickRelationFilter(next);
    setLayerFilter('all');
    setToneFilter('all');
    setSelectedEdgeId(null);
    setEditingEdge(null);
  };

  const handleAssignFaction = () => {
    if (!selectedNode || selectedNode.isClusterHub || !onAssignFactionTag) return;
    const clean = factionDraft.trim();
    if (!clean) return;
    savedPositionsRef.current.delete(selectedNode.portrait.id);
    onAssignFactionTag(selectedNode.portrait.id, clean);
    setFactionDraft('');
  };

  const handleQuickAddLink = () => {
    if (!selectedNode || selectedNode.isClusterHub || !linkTargetId) return;
    const target = otherCandidatesForLink.find((p) => p.id === linkTargetId);
    if (!target) return;
    const label = linkCustomLabel.trim() || TONE_META[linkTone].shortLabel;
    if (onUpdatePortraitBank) {
      onUpdatePortraitBank((prev) =>
        applyManualRelationshipEdgeToBank(prev, {
          sourceId: selectedNode.portrait.id,
          targetId: target.id,
          tone: linkTone,
          label,
        }),
      );
    } else if (onAddRelationshipTag) {
      onAddRelationshipTag(selectedNode.portrait.id, target.name, label);
    }
    setLinkTargetId('');
  };

  const handleStartEditEdge = (edge: GraphEdge) => {
    if (edge.sourceKind === 'collapsed_summary') return;
    setEditingEdge({
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      tone: edge.tone,
      label: edge.label,
      note: edge.isManual ? edge.reason : '',
    });
    setSelectedEdgeId(edge.id);
  };

  const handleSaveEditedEdge = () => {
    if (!editingEdge || !onUpdatePortraitBank) return;
    onUpdatePortraitBank((prev) =>
      applyManualRelationshipEdgeToBank(prev, {
        sourceId: editingEdge.sourceId,
        targetId: editingEdge.targetId,
        tone: editingEdge.tone,
        label:
          editingEdge.label.trim() || TONE_META[editingEdge.tone].shortLabel,
        note: editingEdge.note,
      }),
    );
    setEditingEdge(null);
    setSelectedEdgeId(null);
  };

  const handleDeleteEdge = (sourceId: string, targetId: string) => {
    if (!onUpdatePortraitBank) return;
    onUpdatePortraitBank((prev) =>
      deleteRelationshipEdgeFromBank(prev, sourceId, targetId),
    );
    setEditingEdge(null);
    setSelectedEdgeId(null);
  };

  const handleRestoreDeletedEdges = () => {
    if (!onUpdatePortraitBank) return;
    onUpdatePortraitBank((prev) => restoreDeletedEdgesInBank(prev));
  };

  // Custom Group CRUD handlers
  const resetGroupForm = () => {
    setEditingGroupId(null);
    setGroupNameDraft('');
    setGroupKindDraft('family');
    setGroupColorDraft(GROUP_KIND_META.family.defaultColor);
    setGroupMemberDraft([]);
  };

  const handleStartEditGroup = (grp: RelationshipGroup) => {
    setShowGroupManager(true);
    setEditingGroupId(grp.id);
    setGroupNameDraft(grp.name);
    setGroupKindDraft(grp.kind);
    setGroupColorDraft(grp.color);
    setGroupMemberDraft([...grp.memberIds]);
  };

  const handleSaveGroup = () => {
    if (!onUpdatePortraitBank || !groupNameDraft.trim()) return;
    savedPositionsRef.current.clear();
    onUpdatePortraitBank((prev) =>
      upsertCustomRelationshipGroupInBank(prev, {
        id: editingGroupId || undefined,
        name: groupNameDraft.trim(),
        kind: groupKindDraft,
        color: groupColorDraft,
        memberIds: groupMemberDraft,
      }),
    );
    resetGroupForm();
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!onUpdatePortraitBank) return;
    savedPositionsRef.current.clear();
    onUpdatePortraitBank((prev) =>
      deleteCustomRelationshipGroupInBank(prev, groupId),
    );
    if (editingGroupId === groupId) resetGroupForm();
  };

  const handleToggleMemberInGroup = (groupId: string, portraitId: string) => {
    if (!onUpdatePortraitBank) return;
    savedPositionsRef.current.delete(portraitId);
    onUpdatePortraitBank((prev) =>
      toggleMemberInCustomGroupInBank(prev, groupId, portraitId),
    );
  };

  const handleResetLayout = () => {
    savedPositionsRef.current.clear();
    const sim = simulationRef.current;
    if (!sim) return;
    for (const n of simNodesRef.current) {
      n.fx = null;
      n.fy = null;
      n.x = n.data.initialX;
      n.y = n.data.initialY;
      n.vx = 0;
      n.vy = 0;
    }
    sim.alpha(0.9).restart();
  };

  // D3 Force Simulation + Drag-and-Drop + SVG Rendering Lifecycle
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    if (!displayedNodes.length) {
      simulationRef.current?.stop();
      simulationRef.current = null;
      simNodesRef.current = [];
      return;
    }

    const simNodes: D3SimNode[] = displayedNodes.map((n) => {
      const prev = savedPositionsRef.current.get(n.id);
      return {
        id: n.id,
        data: n,
        x: prev ? prev.x : n.initialX,
        y: prev ? prev.y : n.initialY,
        fx: prev ? prev.fx : undefined,
        fy: prev ? prev.fy : undefined,
      };
    });
    simNodesRef.current = simNodes;

    const simLinks: D3SimLink[] = displayedEdges.map((edge) => ({
      id: edge.id,
      edge,
      source: edge.sourceId,
      target: edge.targetId,
    }));

    const defs = svg.append('defs');
    defs
      .append('clipPath')
      .attr('id', 'd3-net-avatar-clip')
      .append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 22);

    const softGlowFilter = defs
      .append('filter')
      .attr('id', 'd3-link-soft-glow')
      .attr('x', '-35%')
      .attr('y', '-35%')
      .attr('width', '170%')
      .attr('height', '170%');
    softGlowFilter
      .append('feGaussianBlur')
      .attr('stdDeviation', '3.4')
      .attr('result', 'coloredBlur');
    const softGlowMerge = softGlowFilter.append('feMerge');
    softGlowMerge.append('feMergeNode').attr('in', 'coloredBlur');
    softGlowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const bgLayer = svg
      .append('g')
      .attr('class', 'd3-bg-layer')
      .style('pointer-events', 'none');
    if (clusterMode === 'none') {
      bgLayer
        .append('circle')
        .attr('cx', SVG_WIDTH / 2)
        .attr('cy', SVG_HEIGHT / 2)
        .attr('r', 125)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(148,163,184,0.08)')
        .attr('stroke-dasharray', '4 6');
      bgLayer
        .append('circle')
        .attr('cx', SVG_WIDTH / 2)
        .attr('cy', SVG_HEIGHT / 2)
        .attr('r', 225)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(148,163,184,0.06)')
        .attr('stroke-dasharray', '4 6');
    }

    // Expanded Cluster Enclosures Layer
    const expandedClusters =
      clusterMode !== 'none'
        ? displayedClusters.filter((c) => !c.collapsed)
        : [];
    const clusterLayer = svg.append('g').attr('class', 'd3-cluster-layer');
    const clusterGroups = clusterLayer
      .selectAll<SVGGElement, GraphCluster>('g.d3-cluster-group')
      .data(expandedClusters, (d) => d.id)
      .enter()
      .append('g')
      .attr('class', 'd3-cluster-group')
      .style('transition', 'opacity 180ms ease');

    clusterGroups
      .append('circle')
      .attr('class', 'd3-cluster-circle')
      .attr('cx', (d) => d.anchorX)
      .attr('cy', (d) => d.anchorY)
      .attr('r', 74)
      .attr('fill', (d) => d.fill)
      .attr('stroke', (d) => d.color)
      .attr('stroke-opacity', 0.42)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d) =>
        d.kind === 'family' ? null : d.kind === 'close_circle' ? '8 3' : '5 4',
      )
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        setSelectedId(null);
        setSelectedEdgeId(null);
        setActiveClusterId((cur) => (cur === d.id ? null : d.id));
      });

    const clusterLabelGroups = clusterGroups
      .append('g')
      .attr('class', 'd3-cluster-label')
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        setSelectedId(null);
        setSelectedEdgeId(null);
        setActiveClusterId((cur) => (cur === d.id ? null : d.id));
      });

    clusterLabelGroups.each(function (d) {
      const g = d3.select(this);
      const prefix =
        d.kind === 'family'
          ? 'Gia tộc · '
          : d.kind === 'close_circle'
            ? 'Nhóm thân · '
            : '';
      const rawLabel =
        prefix && !normalizeCharacterKey(d.label).startsWith(normalizeCharacterKey(prefix.replace(' · ', '')))
          ? `${prefix}${d.label}`
          : d.label;
      const shortName =
        rawLabel.length > 26 ? `${rawLabel.slice(0, 25)}…` : rawLabel;
      const textStr = `${shortName} (${d.memberIds.length})`;
      const pillW = Math.min(230, Math.max(96, textStr.length * 6.3 + 26));
      g.append('rect')
        .attr('class', 'd3-cluster-pill')
        .attr('x', -pillW / 2)
        .attr('y', -11)
        .attr('width', pillW)
        .attr('height', 22)
        .attr('rx', 11)
        .attr('fill', 'rgba(11, 18, 32, 0.94)')
        .attr('stroke', d.color)
        .attr('stroke-opacity', 0.68)
        .attr('stroke-width', 1.15);
      g.append('circle')
        .attr('cx', -pillW / 2 + 11)
        .attr('cy', 0)
        .attr('r', 3.2)
        .attr('fill', d.color);
      g.append('text')
        .attr('x', 5)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .attr('fill', '#e2e8f0')
        .text(textStr);
    });

    svg.on('click', (event: MouseEvent) => {
      if (event.target === svgEl) {
        setSelectedId(null);
        setSelectedEdgeId(null);
        setEditingEdge(null);
        setActiveClusterId(null);
      }
    });

    // Links Layer (hidden by default until hovering/clicking a character icon/name to avoid visual clutter)
    const linksLayer = svg.append('g').attr('class', 'd3-links-layer');
    const linkGroups = linksLayer
      .selectAll<SVGGElement, D3SimLink>('g.d3-link-group')
      .data(simLinks, (d) => d.id)
      .enter()
      .append('g')
      .attr('class', 'd3-link-group')
      .style('opacity', 0)
      .style('transition', 'opacity 220ms ease');

    // Invisible wide hit area so tapping/clicking an edge on mobile/desktop is effortless
    const linkHitPaths = linkGroups
      .append('path')
      .attr('class', 'd3-link-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 14)
      .style('cursor', (d) =>
        d.edge.sourceKind === 'collapsed_summary' ? 'default' : 'pointer',
      )
      .on('mouseenter', (_ev: MouseEvent, d) => {
        setHoveredEdgeId(d.edge.id);
      })
      .on('mouseleave', () => {
        setHoveredEdgeId(null);
      })
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        if (d.edge.sourceKind === 'collapsed_summary') return;
        setActiveClusterId(null);
        setSelectedEdgeId((cur) => (cur === d.edge.id ? null : d.edge.id));
        setEditingEdge(null);
      });

    // Soft luminous halo path underneath the main edge (shown with animate-pulse on hover/select)
    const linkGlowPaths = linkGroups
      .append('path')
      .attr('class', 'd3-link-glow')
      .attr('fill', 'none')
      .attr('stroke', (d) => TONE_META[d.edge.tone].stroke)
      .attr('stroke-width', (d) => TONE_META[d.edge.tone].strokeWidth + 6)
      .attr(
        'stroke-dasharray',
        (d) => d.edge.dashPattern || TONE_META[d.edge.tone].dashPattern || null,
      )
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 0)
      .attr('filter', 'url(#d3-link-soft-glow)')
      .style('display', 'none')
      .style('pointer-events', 'none');

    const linkPaths = linkGroups
      .append('path')
      .attr('class', 'd3-link-path')
      .attr('fill', 'none')
      .attr('stroke', (d) => TONE_META[d.edge.tone].stroke)
      .attr('stroke-width', (d) => TONE_META[d.edge.tone].strokeWidth)
      .attr(
        'stroke-dasharray',
        (d) => d.edge.dashPattern || TONE_META[d.edge.tone].dashPattern || null,
      )
      .attr('stroke-linecap', 'round')
      .style('transition', 'stroke-width 160ms ease')
      .style('pointer-events', 'none');

    const linkLabelGroups = linkGroups
      .append('g')
      .attr('class', 'd3-link-label')
      .style('pointer-events', 'none');

    linkLabelGroups.each(function (d) {
      const g = d3.select(this);
      const rawText = d.edge.label || '';
      if (!rawText) return;
      const displayLabel =
        rawText.length > 20 ? `${rawText.slice(0, 19)}…` : rawText;
      const boxW = Math.min(138, displayLabel.length * 6.5 + 18);
      g.append('rect')
        .attr('x', -boxW / 2)
        .attr('y', -9.5)
        .attr('width', boxW)
        .attr('height', 19)
        .attr('rx', 6)
        .attr('fill', 'rgba(11, 18, 32, 0.94)')
        .attr('stroke', TONE_META[d.edge.tone].stroke)
        .attr('stroke-opacity', 0.72)
        .attr('stroke-width', 1);
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 9.5)
        .attr('font-weight', 600)
        .attr('fill', '#f1f5f9')
        .text(displayLabel);
    });

    // Nodes Layer (Individual Characters + Collapsed Cluster Hub Nodes)
    const nodesLayer = svg.append('g').attr('class', 'd3-nodes-layer');
    const nodeGroups = nodesLayer
      .selectAll<SVGGElement, D3SimNode>('g.d3-node-group')
      .data(simNodes, (d) => d.id)
      .enter()
      .append('g')
      .attr('class', 'd3-node-group')
      .style('cursor', (d) => (d.data.isClusterHub ? 'pointer' : 'grab'))
      .style('transition', 'opacity 160ms ease');

    nodeGroups.each(function (d) {
      const g = d3.select(this);
      if (d.data.isClusterHub) {
        // Render handsome Collapsed Cluster Hub Node
        const hubColor = d.data.hubColor || '#38bdf8';
        const title =
          d.data.clusterLabel.length > 18
            ? `${d.data.clusterLabel.slice(0, 17)}…`
            : d.data.clusterLabel;
        const boxW = Math.max(122, title.length * 7.2 + 34);
        g.append('rect')
          .attr('class', 'd3-node-halo')
          .attr('x', -boxW / 2 - 4)
          .attr('y', -28)
          .attr('width', boxW + 8)
          .attr('height', 56)
          .attr('rx', 16)
          .attr('fill', 'none')
          .attr('stroke', hubColor)
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0);
        g.append('rect')
          .attr('class', 'd3-node-ring')
          .attr('x', -boxW / 2)
          .attr('y', -24)
          .attr('width', boxW)
          .attr('height', 48)
          .attr('rx', 13)
          .attr('fill', 'rgba(14, 24, 42, 0.96)')
          .attr('stroke', hubColor)
          .attr('stroke-width', 2.2)
          .attr('stroke-dasharray', d.data.hubKind === 'family' ? null : '5 3');
        g.append('text')
          .attr('y', -6)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', 11)
          .attr('font-weight', 700)
          .attr('fill', '#f8fafc')
          .style('pointer-events', 'none')
          .text(title);
        g.append('text')
          .attr('y', 11)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', 9.5)
          .attr('font-weight', 600)
          .attr('fill', hubColor)
          .style('pointer-events', 'none')
          .text(
            `${d.data.collapsedMemberCount || 0} thành viên · Bấm mở rộng`,
          );
        return;
      }

      // Standard Character Node
      const p = d.data.portrait;
      g.append('circle')
        .attr('class', 'd3-node-halo')
        .attr('r', 31)
        .attr('fill', 'none')
        .attr('stroke', d.data.ringColor)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0);

      g.append('circle')
        .attr('class', 'd3-node-ring')
        .attr('r', 24)
        .attr('fill', d.data.fillBg)
        .attr('stroke', d.data.ringColor)
        .attr('stroke-width', 2.3);

      if (p.imageData) {
        g.append('image')
          .attr('href', p.imageData)
          .attr('x', -22)
          .attr('y', -22)
          .attr('width', 44)
          .attr('height', 44)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('clip-path', 'url(#d3-net-avatar-clip)')
          .style('pointer-events', 'none');
      } else {
        g.append('text')
          .attr('y', 1)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', 12.5)
          .attr('font-weight', 700)
          .attr('fill', '#f1f5f9')
          .style('pointer-events', 'none')
          .text(getInitials(p.name));
      }

      if (p.pinned) {
        const pinG = g
          .append('g')
          .attr('transform', 'translate(-19, -19)')
          .style('pointer-events', 'none');
        pinG
          .append('circle')
          .attr('r', 7)
          .attr('fill', '#1c1917')
          .attr('stroke', '#fbbf24')
          .attr('stroke-width', 1.3);
        pinG.append('circle').attr('r', 2.6).attr('fill', '#fbbf24');
      }

      if (p.aiAutoEnrichLocked) {
        const lockG = g
          .append('g')
          .attr('transform', 'translate(19, -19)')
          .style('pointer-events', 'none');
        lockG
          .append('circle')
          .attr('r', 7.5)
          .attr('fill', '#1f1218')
          .attr('stroke', '#fb7185')
          .attr('stroke-width', 1.3);
        lockG
          .append('rect')
          .attr('x', -3.2)
          .attr('y', -0.5)
          .attr('width', 6.4)
          .attr('height', 4.8)
          .attr('rx', 1.2)
          .attr('fill', '#fda4af');
        lockG
          .append('path')
          .attr('d', 'M -2 -0.5 V -2.4 A 2 2 0 0 1 2 -2.4 V -0.5')
          .attr('fill', 'none')
          .attr('stroke', '#fda4af')
          .attr('stroke-width', 1.2);
      }

      const displayName =
        p.name.length > 15 ? `${p.name.slice(0, 14)}…` : p.name;
      const pillW = Math.max(72, displayName.length * 7.4 + 24);
      const nameG = g
        .append('g')
        .attr('transform', 'translate(0, 36)')
        .style('cursor', 'pointer');
      nameG
        .append('rect')
        .attr('class', 'd3-name-pill')
        .attr('x', -pillW / 2)
        .attr('y', -10)
        .attr('width', pillW)
        .attr('height', 20)
        .attr('rx', 6)
        .attr('fill', 'rgba(15, 23, 42, 0.92)')
        .attr('stroke', 'rgba(255,255,255,0.12)')
        .attr('stroke-width', 0.85);
      nameG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 10.5)
        .attr('font-weight', 600)
        .attr('fill', '#f8fafc')
        .style('pointer-events', 'none')
        .text(displayName);

      const roleSubText = d.data.detailLabel
        ? `${d.data.tierLabel} · ${
            d.data.detailLabel.length > 14
              ? `${d.data.detailLabel.slice(0, 13)}…`
              : d.data.detailLabel
          }`
        : d.data.tierLabel;
      g.append('text')
        .attr('y', 54)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9)
        .attr('font-weight', 700)
        .attr('fill', d.data.ringColor)
        .style('pointer-events', 'none')
        .text(roleSubText);
    });

    const positionHoverTooltip = (event: MouseEvent) => {
      const container = containerRef.current;
      const tip = tooltipRef.current;
      if (!container || !tip) return;
      const rect = container.getBoundingClientRect();
      const relX = clampCoord(
        event.clientX - rect.left,
        12,
        Math.max(12, rect.width - 12),
      );
      const relY = clampCoord(
        event.clientY - rect.top,
        12,
        Math.max(12, rect.height - 12),
      );
      const tipW = tip.offsetWidth || 245;
      const tipH = tip.offsetHeight || 132;
      const left =
        relX > rect.width * 0.56
          ? Math.max(10, relX - tipW - 14)
          : Math.min(Math.max(10, rect.width - tipW - 10), relX + 16);
      const top =
        relY > rect.height * 0.6
          ? Math.max(10, relY - tipH - 12)
          : Math.min(Math.max(10, rect.height - tipH - 10), relY + 14);
      tip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    };

    nodeGroups
      .on('mouseenter', function (event: MouseEvent, d) {
        if (isDraggingRef.current) return;
        d3.select(this).raise();
        setHoveredTooltip({
          node: d.data,
          connectionCount: visibleDegreeMap.get(d.id) || 0,
        });
        requestAnimationFrame(() => positionHoverTooltip(event));
      })
      .on('mousemove', function (event: MouseEvent) {
        if (isDraggingRef.current) return;
        positionHoverTooltip(event);
      })
      .on('mouseleave', () => {
        setHoveredTooltip(null);
      })
      .on('dblclick', (event: MouseEvent, d) => {
        event.stopPropagation();
        if (d.data.isClusterHub) {
          toggleClusterCollapse(d.data.clusterId);
          return;
        }
        d.fx = null;
        d.fy = null;
        savedPositionsRef.current.set(d.id, {
          x: d.x,
          y: d.y,
          fx: null,
          fy: null,
        });
        simulation.alpha(0.45).restart();
      });

    const isClustered = clusterMode !== 'none' && displayedClusters.length > 0;
    const simNodeById = new Map<string, D3SimNode>();
    for (const sn of simNodes) simNodeById.set(sn.id, sn);

    const simulation = d3
      .forceSimulation<D3SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<D3SimNode, D3SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => {
            if (l.edge.tone === 'rival') return 210;
            if (isClustered) {
              const sNode =
                typeof l.source === 'string'
                  ? simNodeById.get(l.source)
                  : l.source;
              const tNode =
                typeof l.target === 'string'
                  ? simNodeById.get(l.target)
                  : l.target;
              const sameCluster =
                sNode &&
                tNode &&
                sNode.data.clusterId &&
                sNode.data.clusterId === tNode.data.clusterId;
              return sameCluster ? 92 : 195;
            }
            return l.edge.tone === 'family' ? 115 : 155;
          })
          .strength((l) => {
            if (l.edge.tone === 'rival') return 0.08;
            if (isClustered) {
              const sNode =
                typeof l.source === 'string'
                  ? simNodeById.get(l.source)
                  : l.source;
              const tNode =
                typeof l.target === 'string'
                  ? simNodeById.get(l.target)
                  : l.target;
              const sameCluster =
                sNode &&
                tNode &&
                sNode.data.clusterId &&
                sNode.data.clusterId === tNode.data.clusterId;
              return sameCluster ? 0.5 : 0.09;
            }
            return l.edge.sourceKind === 'manual' ? 0.45 : 0.25;
          }),
      )
      .force(
        'charge',
        d3.forceManyBody<D3SimNode>().strength(isClustered ? -250 : -390),
      )
      .force(
        'collide',
        d3
          .forceCollide<D3SimNode>()
          .radius((d) => (d.data.isClusterHub ? 68 : isClustered ? 48 : 54))
          .strength(0.9),
      )
      .force(
        'x',
        d3
          .forceX<D3SimNode>((d) =>
            isClustered
              ? clusterById.get(d.data.clusterId)?.anchorX ?? SVG_WIDTH / 2
              : SVG_WIDTH / 2,
          )
          .strength(isClustered ? 0.34 : 0.065),
      )
      .force(
        'y',
        d3
          .forceY<D3SimNode>((d) =>
            isClustered
              ? clusterById.get(d.data.clusterId)?.anchorY ?? SVG_HEIGHT / 2
              : SVG_HEIGHT / 2,
          )
          .strength(isClustered ? 0.36 : 0.095),
      );

    if (!isClustered) {
      simulation.force('center', d3.forceCenter(SVG_WIDTH / 2, SVG_HEIGHT / 2));
    }

    simulationRef.current = simulation;

    let dragStartX = 0;
    let dragStartY = 0;
    let movedDuringDrag = false;

    const dragBehavior = d3
      .drag<SVGGElement, D3SimNode>()
      .on('start', function (event, d) {
        dragStartX = event.x;
        dragStartY = event.y;
        movedDuringDrag = false;
        isDraggingRef.current = true;
        setHoveredTooltip(null);
        d3.select(this).raise().style('cursor', 'grabbing');
        if (!event.active) simulation.alphaTarget(0.28).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function (event, d) {
        if (Math.hypot(event.x - dragStartX, event.y - dragStartY) > 4) {
          movedDuringDrag = true;
        }
        const nx = clampCoord(event.x, PAD_X, SVG_WIDTH - PAD_X);
        const ny = clampCoord(event.y, PAD_TOP, SVG_HEIGHT - PAD_BOTTOM);
        d.fx = nx;
        d.fy = ny;
        d.x = nx;
        d.y = ny;
      })
      .on('end', function (event, d) {
        isDraggingRef.current = false;
        d3.select(this).style('cursor', d.data.isClusterHub ? 'pointer' : 'grab');
        if (!event.active) simulation.alphaTarget(0);

        if (movedDuringDrag) {
          const nx = clampCoord(d.x, PAD_X, SVG_WIDTH - PAD_X);
          const ny = clampCoord(d.y, PAD_TOP, SVG_HEIGHT - PAD_BOTTOM);
          d.fx = nx;
          d.fy = ny;
          savedPositionsRef.current.set(d.id, {
            x: nx,
            y: ny,
            fx: nx,
            fy: ny,
          });
        } else {
          const prev = savedPositionsRef.current.get(d.id);
          d.fx = prev?.fx ?? null;
          d.fy = prev?.fy ?? null;
          if (d.data.isClusterHub) {
            toggleClusterCollapse(d.data.clusterId);
            return;
          }
          setActiveClusterId(null);
          setSelectedEdgeId(null);
          setEditingEdge(null);
          setSelectedId((cur) => (cur === d.id ? null : d.id));
        }
      });

    nodeGroups.call(dragBehavior);

    const updateClusterEnclosures = () => {
      if (!isClustered) return;
      clusterGroups.each(function (c) {
        const members = c.memberIds
          .map((id) => simNodeById.get(id))
          .filter((n): n is D3SimNode => Boolean(n));
        if (!members.length) return;
        let sumX = 0;
        let sumY = 0;
        for (const m of members) {
          sumX += m.x;
          sumY += m.y;
        }
        const meanX = sumX / members.length;
        const meanY = sumY / members.length;
        let maxDist = 0;
        for (const m of members) {
          const dist = Math.hypot(m.x - meanX, m.y - meanY);
          if (dist > maxDist) maxDist = dist;
        }
        const radius = Math.min(220, Math.max(68, maxDist + 58));
        const g = d3.select(this);
        g.select('circle.d3-cluster-circle')
          .attr('cx', meanX)
          .attr('cy', meanY)
          .attr('r', radius);
        const labelX = clampCoord(meanX, 108, SVG_WIDTH - 108);
        const labelY = clampCoord(meanY - radius, 18, SVG_HEIGHT - 24);
        g.select('g.d3-cluster-label').attr(
          'transform',
          `translate(${labelX}, ${labelY})`,
        );
      });
    };

    simulation.on('tick', () => {
      for (const n of simNodes) {
        n.x = clampCoord(n.x, PAD_X, SVG_WIDTH - PAD_X);
        n.y = clampCoord(n.y, PAD_TOP, SVG_HEIGHT - PAD_BOTTOM);
        savedPositionsRef.current.set(n.id, {
          x: n.x,
          y: n.y,
          fx: n.fx,
          fy: n.fy,
        });
      }

      updateClusterEnclosures();

      linkHitPaths.attr('d', (d) => {
        const s = d.source as D3SimNode;
        const t = d.target as D3SimNode;
        const curveSign = d.edge.tone === 'rival' ? -1 : 1;
        return computeCurvedEdgeGeometry(s.x, s.y, t.x, t.y, curveSign).path;
      });

      linkGlowPaths.attr('d', (d) => {
        const s = d.source as D3SimNode;
        const t = d.target as D3SimNode;
        const curveSign = d.edge.tone === 'rival' ? -1 : 1;
        return computeCurvedEdgeGeometry(s.x, s.y, t.x, t.y, curveSign).path;
      });

      linkPaths.attr('d', (d) => {
        const s = d.source as D3SimNode;
        const t = d.target as D3SimNode;
        const curveSign = d.edge.tone === 'rival' ? -1 : 1;
        return computeCurvedEdgeGeometry(s.x, s.y, t.x, t.y, curveSign).path;
      });

      linkLabelGroups.attr('transform', (d) => {
        const s = d.source as D3SimNode;
        const t = d.target as D3SimNode;
        const curveSign = d.edge.tone === 'rival' ? -1 : 1;
        const { labelX, labelY } = computeCurvedEdgeGeometry(
          s.x,
          s.y,
          t.x,
          t.y,
          curveSign,
        );
        return `translate(${labelX}, ${labelY})`;
      });

      nodeGroups.attr('transform', (d) => `translate(${d.x}, ${d.y})`);
    });

    simulation.tick(isClustered ? 48 : 26);
    updateClusterEnclosures();
    simulation.alpha(0.3).restart();

    return () => {
      simulation.stop();
      if (simulationRef.current === simulation) {
        simulationRef.current = null;
      }
    };
  }, [
    displayedNodes,
    displayedEdges,
    visibleDegreeMap,
    displayedClusters,
    clusterById,
    clusterMode,
  ]);

  // Visual focus & anti-overlap label visibility effect (never restarts physics)
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);

    const hoveredCharacterNodeId =
      hoveredTooltip?.node && !hoveredTooltip.node.isClusterHub
        ? hoveredTooltip.node.id
        : null;
    const activeFocusNodeId =
      hoveredTooltip?.node.id || effectiveSelectedId || null;
    const activeFocusEdgeId = hoveredCharacterNodeId
      ? null
      : selectedEdge?.id || hoveredEdgeId || null;
    const focusedEdgeObj = activeFocusEdgeId
      ? visibleEdges.find((e) => e.id === activeFocusEdgeId) || null
      : null;

    const focusedCluster =
      !activeFocusNodeId && !focusedEdgeObj && effectiveClusterId
        ? clusterById.get(effectiveClusterId) || null
        : null;
    const focusedClusterMemberSet = focusedCluster
      ? new Set(focusedCluster.memberIds)
      : null;

    const isPrimaryBondTone = (tone: RelationshipTone) =>
      tone === 'family' || tone === 'ally' || tone === 'intimate';

    // Direct neighbors strictly for the currently hovered character node
    const hoveredDirectNeighborSet = new Set<string>();
    if (hoveredCharacterNodeId) {
      for (const e of visibleEdges) {
        if (e.sourceId === hoveredCharacterNodeId) {
          hoveredDirectNeighborSet.add(e.targetId);
        } else if (e.targetId === hoveredCharacterNodeId) {
          hoveredDirectNeighborSet.add(e.sourceId);
        }
      }
    }

    const neighborSet = new Set<string>();
    const primaryBondNeighborSet = new Set<string>();
    if (focusedEdgeObj) {
      neighborSet.add(focusedEdgeObj.sourceId);
      neighborSet.add(focusedEdgeObj.targetId);
      if (isPrimaryBondTone(focusedEdgeObj.tone)) {
        primaryBondNeighborSet.add(focusedEdgeObj.sourceId);
        primaryBondNeighborSet.add(focusedEdgeObj.targetId);
      }
    } else if (activeFocusNodeId) {
      neighborSet.add(activeFocusNodeId);
      for (const e of visibleEdges) {
        if (
          e.sourceId === activeFocusNodeId ||
          e.targetId === activeFocusNodeId
        ) {
          neighborSet.add(e.sourceId);
          neighborSet.add(e.targetId);
          if (isPrimaryBondTone(e.tone)) {
            if (e.sourceId !== activeFocusNodeId) {
              primaryBondNeighborSet.add(e.sourceId);
            }
            if (e.targetId !== activeFocusNodeId) {
              primaryBondNeighborSet.add(e.targetId);
            }
          }
        }
      }
    }

    const quickFilterMatchingNodeSet = new Set<string>();
    if (quickRelationFilter !== 'all') {
      for (const e of visibleEdges) {
        quickFilterMatchingNodeSet.add(e.sourceId);
        quickFilterMatchingNodeSet.add(e.targetId);
      }
    }
    const clusterMatchesQuickFilter = (c: GraphCluster) => {
      if (quickRelationFilter === 'all') return true;
      if (quickRelationFilter === 'family') return c.kind === 'family';
      if (quickRelationFilter === 'friends') return c.kind === 'close_circle';
      if (quickRelationFilter === 'rival') return c.kind === 'faction';
      return true;
    };

    svg
      .selectAll<SVGGElement, GraphCluster>('g.d3-cluster-group')
      .style('opacity', (c) => {
        if (focusedCluster) return c.id === focusedCluster.id ? 1 : 0.2;
        if (focusedEdgeObj) return 0.35;
        if (activeFocusNodeId) {
          const focusNode = nodeById.get(activeFocusNodeId);
          return focusNode?.clusterId === c.id ? 0.96 : 0.28;
        }
        if (quickRelationFilter !== 'all') {
          return clusterMatchesQuickFilter(c) ? 1 : 0.22;
        }
        return 0.92;
      })
      .each(function (c) {
        const g = d3.select(this);
        const isHighlighted = Boolean(
          (focusedCluster && c.id === focusedCluster.id) ||
            (activeFocusNodeId &&
              nodeById.get(activeFocusNodeId)?.clusterId === c.id) ||
            (quickRelationFilter !== 'all' && clusterMatchesQuickFilter(c)),
        );
        g.select('circle.d3-cluster-circle')
          .attr('stroke-opacity', isHighlighted ? 0.82 : 0.4)
          .attr('stroke-width', isHighlighted ? 2.1 : 1.45);
      });

    const isQuickFiltered = quickRelationFilter !== 'all';

    svg
      .selectAll<SVGGElement, D3SimLink>('g.d3-link-group')
      .style('opacity', (d) => {
        if (focusedEdgeObj) {
          return d.edge.id === focusedEdgeObj.id
            ? 1
            : showAllEdges || isQuickFiltered
              ? 0.14
              : 0;
        }
        if (focusedClusterMemberSet) {
          const touchesCluster =
            focusedClusterMemberSet.has(d.edge.sourceId) ||
            focusedClusterMemberSet.has(d.edge.targetId);
          return touchesCluster
            ? 0.96
            : showAllEdges || isQuickFiltered
              ? 0.14
              : 0;
        }
        if (activeFocusNodeId) {
          const connected =
            d.edge.sourceId === activeFocusNodeId ||
            d.edge.targetId === activeFocusNodeId;
          return connected
            ? 1
            : showAllEdges || isQuickFiltered
              ? 0.14
              : 0;
        }
        if (isQuickFiltered) {
          return 0.92;
        }
        if (!showAllEdges) {
          return 0;
        }
        return d.edge.tone === 'neutral' ? 0.45 : 0.8;
      })
      .each(function (d) {
        const g = d3.select(this);
        const isDirectFocus = focusedEdgeObj
          ? d.edge.id === focusedEdgeObj.id
          : activeFocusNodeId
            ? d.edge.sourceId === activeFocusNodeId ||
              d.edge.targetId === activeFocusNodeId
            : false;
        const isClusterFocus = Boolean(
          focusedClusterMemberSet &&
            (focusedClusterMemberSet.has(d.edge.sourceId) ||
              focusedClusterMemberSet.has(d.edge.targetId)),
        );
        const isEdgeVisible =
          isDirectFocus || isClusterFocus || showAllEdges || isQuickFiltered;
        const isPrimaryBond = isPrimaryBondTone(d.edge.tone);
        const shouldHighlight = isDirectFocus || isClusterFocus;
        // Apply Tailwind animate-pulse ONLY on connections directly linking the hovered character node to its direct neighbors
        const isHoveredDirectNeighborEdge = Boolean(
          hoveredCharacterNodeId &&
            ((d.edge.sourceId === hoveredCharacterNodeId &&
              hoveredDirectNeighborSet.has(d.edge.targetId)) ||
              (d.edge.targetId === hoveredCharacterNodeId &&
                hoveredDirectNeighborSet.has(d.edge.sourceId))),
        );

        // Disable pointer events on hidden edges so invisible wires never intercept clicks/hovers
        g.select('path.d3-link-hit').style(
          'pointer-events',
          isEdgeVisible ? 'stroke' : 'none',
        );

        const baseWidth = TONE_META[d.edge.tone].strokeWidth;
        g.select('path.d3-link-glow')
          .style('display', shouldHighlight ? '' : 'none')
          .attr(
            'stroke-width',
            isPrimaryBond ? baseWidth + 6.5 : baseWidth + 4.8,
          )
          .attr(
            'stroke-opacity',
            shouldHighlight ? (isPrimaryBond ? 0.56 : 0.4) : 0,
          )
          .classed('animate-pulse', isHoveredDirectNeighborEdge);

        g.select('path.d3-link-path')
          .attr(
            'stroke-width',
            isDirectFocus
              ? baseWidth + (isPrimaryBond ? 1.35 : 1.0)
              : isClusterFocus || isQuickFiltered
                ? baseWidth + 0.55
                : baseWidth,
          )
          .attr(
            'filter',
            shouldHighlight ? 'url(#d3-link-soft-glow)' : null,
          )
          .classed('animate-pulse', isHoveredDirectNeighborEdge);

        g.select('g.d3-link-label rect')
          .attr('stroke-opacity', isDirectFocus ? 0.96 : 0.72)
          .attr('stroke-width', isDirectFocus ? 1.35 : 1);

        // ANTI-OVERLAP RULE: Only show edge text labels on direct focus (hover/select node or edge)
        // OR when both "Đang hiện mọi dây" (or quick filter) and "Đang hiện nhãn" are explicitly turned on
        const showLabel =
          Boolean(d.edge.label) &&
          (isDirectFocus ||
            ((showAllEdges || isQuickFiltered) &&
              showAllLabels &&
              !activeFocusNodeId &&
              !focusedEdgeObj &&
              !focusedClusterMemberSet));
        g.select('g.d3-link-label').style('display', showLabel ? '' : 'none');
        if (isDirectFocus) {
          g.raise();
        }
      });

    svg
      .selectAll<SVGGElement, D3SimNode>('g.d3-node-group')
      .style('opacity', (d) => {
        if (focusedEdgeObj) {
          return neighborSet.has(d.id) ? 1 : 0.22;
        }
        if (focusedClusterMemberSet) {
          return focusedClusterMemberSet.has(d.id) ||
            d.data.clusterId === focusedCluster?.id
            ? 1
            : 0.22;
        }
        if (activeFocusNodeId) {
          return neighborSet.has(d.id) ? 1 : 0.22;
        }
        if (
          quickRelationFilter !== 'all' &&
          quickFilterMatchingNodeSet.size > 0
        ) {
          const inMatchingCluster = Boolean(
            d.data.clusterId &&
              clusterById.get(d.data.clusterId) &&
              clusterMatchesQuickFilter(clusterById.get(d.data.clusterId)!),
          );
          return quickFilterMatchingNodeSet.has(d.id) || inMatchingCluster
            ? 1
            : 0.3;
        }
        return 1;
      })
      .each(function (d) {
        const g = d3.select(this);
        const isFocused = activeFocusNodeId === d.id;
        const isSelected = effectiveSelectedId === d.id;
        const isPrimaryNeighbor = primaryBondNeighborSet.has(d.id);
        const isHoveredDirectNeighbor = hoveredDirectNeighborSet.has(d.id);
        const isHoveredSelf = hoveredCharacterNodeId === d.id;
        g.select('.d3-node-halo')
          .attr(
            'stroke-opacity',
            isFocused
              ? 0.85
              : isHoveredDirectNeighbor || isPrimaryNeighbor
                ? 0.52
                : 0,
          )
          .attr(
            'stroke-width',
            isFocused
              ? 2.4
              : isHoveredDirectNeighbor || isPrimaryNeighbor
                ? 1.8
                : 2,
          )
          .classed('animate-pulse', isHoveredSelf || isHoveredDirectNeighbor);
        g.select('.d3-node-ring').attr(
          'stroke-width',
          isSelected
            ? 3.2
            : isFocused
              ? 2.8
              : isHoveredDirectNeighbor || isPrimaryNeighbor
                ? 2.6
                : 2.3,
        );
        g.select('rect.d3-name-pill')
          .attr(
            'stroke',
            isFocused || isHoveredDirectNeighbor || isPrimaryNeighbor
              ? d.data.ringColor
              : 'rgba(255,255,255,0.12)',
          )
          .attr(
            'stroke-width',
            isFocused
              ? 1.3
              : isHoveredDirectNeighbor || isPrimaryNeighbor
                ? 1.1
                : 0.85,
          );
      });
  }, [
    effectiveSelectedId,
    hoveredTooltip?.node.id,
    hoveredTooltip?.node.isClusterHub,
    selectedEdge?.id,
    hoveredEdgeId,
    effectiveClusterId,
    focusedClusterOrNull(effectiveClusterId, clusterById),
    clusterById,
    nodeById,
    visibleEdges,
    nodes,
    quickRelationFilter,
    showAllEdges,
    showAllLabels,
  ]);

  if (!rawPortraits.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.10] bg-[#111b2c]/60 px-4 py-8 text-center text-xs text-slate-400">
        Chưa có nhân vật nào trong Portrait Bank để vẽ mạng lưới quan hệ. Hãy
        bấm &ldquo;Đồng bộ NPC lượt này&rdquo; hoặc bắt đầu lượt truyện trước.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Quick Social Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-[#0e1625]/80 px-3 py-2 ring-1 ring-inset ring-amber-400/18">
          <div className="text-[10px] font-medium text-amber-300/85">
            Gia tộc / Huyết thống
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-amber-200">
            {toneSummary.family}
          </div>
        </div>
        <div className="rounded-xl bg-[#0e1625]/80 px-3 py-2 ring-1 ring-inset ring-emerald-400/18">
          <div className="text-[10px] font-medium text-emerald-300/85">
            Thân mật / Đồng minh
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-emerald-200">
            {toneSummary.intimate + toneSummary.ally}
          </div>
        </div>
        <div className="rounded-xl bg-[#0e1625]/80 px-3 py-2 ring-1 ring-inset ring-red-400/22">
          <div className="text-[10px] font-medium text-red-300/90">
            Đối đầu / Xung đột
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-red-200">
            {toneSummary.rival}
          </div>
        </div>
        <div className="rounded-xl bg-[#0e1625]/80 px-3 py-2 ring-1 ring-inset ring-sky-400/18">
          <div className="text-[10px] font-medium text-sky-300/85">
            Nhóm / Gia tộc ({clusters.length})
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-sky-100">
            {customGroups.length} tự tạo
          </div>
        </div>
      </div>

      {/* Conflict Contagion Protection Notice (only shown if firewall caught & blocked false intimate links) */}
      {blockedContagionCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/[0.09] px-3 py-1.5 text-[11px] text-amber-200/95 ring-1 ring-inset ring-amber-400/25">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>
            Đã tự động chặn{' '}
            <strong className="font-bold">{blockedContagionCount}</strong> đường
            nối &ldquo;thân mật / đồng minh&rdquo; sai logic giữa các bên đối đầu
            hoặc gia đình/nhóm của bên đối đầu.
          </span>
        </div>
      )}

      {/* Layer Filter & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Layer Filter */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#0e1625]/85 p-1 ring-1 ring-inset ring-white/[0.07]">
          {(
            [
              { id: 'all', label: 'Tất cả lớp' },
              { id: 'family', label: 'Gia tộc / Huyết thống' },
              { id: 'close_circle', label: 'Nhóm thân thiết' },
              { id: 'faction', label: 'Phe phái & Đối đầu' },
              { id: 'personal', label: 'Cá nhân' },
            ] as Array<{ id: LayerFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setQuickRelationFilter('all');
                setLayerFilter(tab.id);
              }}
              className={`min-h-[28px] rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                layerFilter === tab.id
                  ? tab.id === 'family'
                    ? 'bg-amber-500/20 text-amber-100 ring-1 ring-inset ring-amber-400/38'
                    : tab.id === 'close_circle'
                      ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-400/38'
                      : tab.id === 'faction'
                        ? 'bg-red-500/20 text-red-100 ring-1 ring-inset ring-red-400/38'
                        : 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Utility buttons: Group Manager, Scene links, Labels, Mob, Reset */}
        <div className="flex flex-wrap items-center gap-1.5">
          {onUpdatePortraitBank && (
            <button
              type="button"
              onClick={() => setShowGroupManager((v) => !v)}
              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                showGroupManager
                  ? 'bg-amber-500/20 text-amber-100 ring-amber-400/40'
                  : 'bg-sky-500/14 text-sky-200 ring-sky-400/30 hover:bg-sky-500/22'
              }`}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>Quản lý Gia tộc / Nhóm</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAllEdges((v) => !v)}
            title="Mặc định ẩn đường liên kết cho gọn mắt — chỉ hiện rõ khi đưa chuột hoặc nhấp vào icon/tên nhân vật"
            className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
              showAllEdges
                ? 'bg-sky-500/20 text-sky-100 ring-sky-400/40'
                : 'bg-white/[0.045] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09]'
            }`}
          >
            {showAllEdges ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            <span>{showAllEdges ? 'Đang hiện mọi dây' : 'Dây khi chọn'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAllLabels((v) => !v)}
            title="Mặc định chỉ hiện nhãn quan hệ khi chọn hoặc rê chuột vào nhân vật để tránh chồng chữ"
            className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
              showAllLabels
                ? 'bg-sky-500/20 text-sky-100 ring-sky-400/40'
                : 'bg-white/[0.045] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09]'
            }`}
          >
            <Tag className="h-3 w-3" />
            <span>{showAllLabels ? 'Đang hiện nhãn' : 'Nhãn khi chọn'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSceneLinks((v) => !v)}
            title="Bật/tắt đường chấm mờ nối các nhân vật chỉ đứng cùng cảnh (không phải quan hệ thật)"
            className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
              showSceneLinks
                ? 'bg-slate-500/25 text-slate-100 ring-slate-400/40'
                : 'bg-white/[0.045] text-slate-400 ring-white/[0.08] hover:bg-white/[0.09] hover:text-slate-200'
            }`}
          >
            <Network className="h-3 w-3" />
            <span>{showSceneLinks ? 'Đang hiện cùng cảnh' : 'Ẩn cùng cảnh'}</span>
          </button>

          {mobCount > 0 && (
            <button
              type="button"
              onClick={() => setHideMob((v) => !v)}
              className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors whitespace-nowrap ${
                hideMob
                  ? 'bg-slate-500/25 text-slate-100 ring-slate-400/40'
                  : 'bg-white/[0.045] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09]'
              }`}
            >
              {hideMob ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              <span>{hideMob ? `Hiện Mob (${mobCount})` : `Ẩn Mob`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetLayout}
            title="Thả các nút đã kéo và sắp xếp lại sơ đồ"
            className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-white/[0.045] px-2 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.09] hover:text-white whitespace-nowrap"
          >
            <RotateCcw className="h-3 w-3 text-sky-300" />
            <span>Sắp lại</span>
          </button>
        </div>
      </div>

      {/* Tone Sub-Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'all', label: `Tất cả dây (${edges.length})`, dot: 'bg-sky-400' },
              { id: 'family', label: `Gia tộc (${toneSummary.family})`, dot: 'bg-amber-400' },
              { id: 'intimate', label: `Thân mật (${toneSummary.intimate})`, dot: 'bg-pink-400' },
              { id: 'ally', label: `Đồng minh (${toneSummary.ally})`, dot: 'bg-emerald-400' },
              { id: 'rival', label: `Đối đầu (${toneSummary.rival})`, dot: 'bg-red-500' },
              { id: 'mystery', label: `Bí ẩn (${toneSummary.mystery})`, dot: 'bg-violet-400' },
            ] as Array<{ id: ToneFilter; label: string; dot: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setQuickRelationFilter('all');
                setToneFilter(item.id);
              }}
              className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition-all whitespace-nowrap ${
                toneFilter === item.id
                  ? 'bg-white/[0.12] text-white ring-1 ring-inset ring-white/[0.22]'
                  : 'bg-[#0e1625]/70 text-slate-400 ring-1 ring-inset ring-white/[0.06] hover:text-slate-200'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {deletedOverrideCount > 0 && onUpdatePortraitBank && (
          <button
            type="button"
            onClick={handleRestoreDeletedEdges}
            className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-white/[0.05] px-2 text-[10px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white whitespace-nowrap"
          >
            <Undo2 className="h-3 w-3 text-sky-300" />
            <span>Khôi phục {deletedOverrideCount} dây đã xóa</span>
          </button>
        )}
      </div>

      {/* Custom Group / Family / Close Circle / Faction Manager Panel */}
      {showGroupManager && onUpdatePortraitBank && (
        <div className="space-y-3 rounded-xl border border-amber-400/25 bg-[#0e1729]/95 p-3.5 shadow-[0_12px_28px_-14px_rgba(2,8,23,0.85)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-2">
            <div className="flex items-center gap-1.5">
              <FolderPlus className="h-4 w-4 text-amber-300" />
              <h3 className="text-xs font-bold text-slate-100">
                {editingGroupId
                  ? 'Chỉnh sửa Gia tộc / Nhóm'
                  : 'Tạo & Quản lý Gia tộc / Nhóm thân thiết / Phe phái'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowGroupManager(false);
                resetGroupForm();
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Group Editor Form */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                Tên gia tộc / nhóm / phe phái
              </label>
              <input
                type="text"
                value={groupNameDraft}
                onChange={(e) => setGroupNameDraft(e.target.value)}
                placeholder="VD: Gia tộc Kardashian, Hội bạn thân, Nhóm Low G..."
                className="min-h-[34px] w-full rounded-lg border border-white/[0.10] bg-[#0b1220] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/70 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                Phân tầng / Loại nhóm
              </label>
              <select
                value={groupKindDraft}
                onChange={(e) => {
                  const k = e.target.value as RelationshipGroupKind;
                  setGroupKindDraft(k);
                  if (!editingGroupId) {
                    setGroupColorDraft(GROUP_KIND_META[k].defaultColor);
                  }
                }}
                className="min-h-[34px] w-full rounded-lg border border-white/[0.10] bg-[#0b1220] px-2.5 text-xs text-slate-100 focus:border-amber-400/70 focus:outline-none"
              >
                <option value="family">Gia tộc / Huyết thống</option>
                <option value="close_circle">Nhóm thân thiết / Bạn thân</option>
                <option value="faction">Phe phái / Băng nhóm / Tổ chức</option>
              </select>
            </div>
          </div>

          {/* Color Swatch Picker */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-300">
              Màu nhóm:
            </span>
            {GROUP_COLOR_SWATCHES.map((sw) => {
              const selected =
                groupColorDraft.toLowerCase() === sw.hex.toLowerCase();
              return (
                <button
                  key={sw.hex}
                  type="button"
                  title={sw.name}
                  onClick={() => setGroupColorDraft(sw.hex)}
                  className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform ${
                    selected
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0e1729]'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                >
                  {selected && <Check className="h-3 w-3 text-slate-950" />}
                </button>
              );
            })}
          </div>

          {/* Member Multi-Select Chips */}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-slate-300">
              Chọn thành viên ({groupMemberDraft.length} đã chọn):
            </div>
            <div className="flex max-h-[120px] flex-wrap gap-1.5 overflow-y-auto rounded-lg bg-[#0b1220]/80 p-2 ring-1 ring-inset ring-white/[0.06]">
              {rawPortraits.map((p) => {
                const picked = groupMemberDraft.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setGroupMemberDraft((prev) =>
                        prev.includes(p.id)
                          ? prev.filter((id) => id !== p.id)
                          : [...prev, p.id],
                      )
                    }
                    className={`inline-flex min-h-[26px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors ${
                      picked
                        ? 'bg-sky-500/24 text-sky-100 ring-1 ring-inset ring-sky-400/45'
                        : 'bg-white/[0.04] text-slate-400 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.08] hover:text-slate-200'
                    }`}
                  >
                    {picked && <Check className="h-3 w-3 text-sky-300" />}
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!groupNameDraft.trim()}
              onClick={handleSaveGroup}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-amber-500/22 px-3 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40 transition-colors hover:bg-amber-500/32 disabled:opacity-45"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{editingGroupId ? 'Lưu nhóm' : 'Tạo nhóm mới'}</span>
            </button>
            {editingGroupId && (
              <button
                type="button"
                onClick={resetGroupForm}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
              >
                <span>Hủy sửa</span>
              </button>
            )}
          </div>

          {/* Existing Custom Groups List */}
          {customGroups.length > 0 && (
            <div className="space-y-1.5 border-t border-white/[0.07] pt-2.5">
              <div className="text-[11px] font-semibold text-slate-300">
                Các nhóm đã tạo ({customGroups.length}):
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {customGroups.map((g) => {
                  const memberNames = g.memberIds
                    .map((id) => portraitById.get(id)?.name)
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <div
                      key={g.id}
                      className="flex items-start justify-between gap-2 rounded-lg bg-[#0b1220]/85 px-2.5 py-2 ring-1 ring-inset ring-white/[0.07]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: g.color }}
                          />
                          <span className="truncate text-xs font-bold text-slate-100">
                            {g.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${GROUP_KIND_META[g.kind].badgeClass}`}
                          >
                            {GROUP_KIND_META[g.kind].shortLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-slate-400">
                          {memberNames || 'Chưa có thành viên'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="Chỉnh sửa nhóm"
                          onClick={() => handleStartEditGroup(g)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-sky-200"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          title="Xóa nhóm"
                          onClick={() => handleDeleteGroup(g.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/18 hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Filter by 'Gia tộc' / 'Bạn thân' / 'Đối đầu' + Category Collapse/Expand Toggles directly above the chart */}
      <div className="space-y-2 rounded-xl bg-[#0e1625]/88 p-2.5 ring-1 ring-inset ring-white/[0.08]">
        {/* Row 1: Fast Display Filter — Tất cả / Gia tộc / Bạn thân / Đối đầu */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300">
              <Network className="h-3.5 w-3.5 text-sky-400" />
              <span>Lọc hiển thị:</span>
            </span>
            {(
              [
                {
                  id: 'all',
                  label: 'Tất cả',
                  count: quickCategoryCounts.total,
                  dot: 'bg-sky-400',
                  activeClass:
                    'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/45 shadow-sm',
                },
                {
                  id: 'family',
                  label: 'Gia tộc',
                  count: quickCategoryCounts.family,
                  dot: 'bg-amber-400',
                  activeClass:
                    'bg-amber-500/22 text-amber-100 ring-1 ring-inset ring-amber-400/45 shadow-sm',
                },
                {
                  id: 'friends',
                  label: 'Bạn thân',
                  count: quickCategoryCounts.friends,
                  dot: 'bg-emerald-400',
                  activeClass:
                    'bg-emerald-500/22 text-emerald-100 ring-1 ring-inset ring-emerald-400/45 shadow-sm',
                },
                {
                  id: 'rival',
                  label: 'Đối đầu',
                  count: quickCategoryCounts.rival,
                  dot: 'bg-red-500',
                  activeClass:
                    'bg-red-500/22 text-red-100 ring-1 ring-inset ring-red-400/45 shadow-sm',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={quickRelationFilter === opt.id}
                onClick={() => handleSelectQuickRelationFilter(opt.id)}
                className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                  quickRelationFilter === opt.id
                    ? opt.activeClass
                    : 'bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.09] hover:text-white'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
                <span>{opt.label}</span>
                <span className="rounded bg-black/25 px-1 text-[10px] tabular-nums opacity-85">
                  {opt.count}
                </span>
              </button>
            ))}
          </div>

          {/* Cluster Layout Mode */}
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'layered', label: 'Phân tầng' },
                { id: 'role', label: 'Vai trò' },
                { id: 'none', label: 'Tự do' },
              ] as Array<{ id: ClusterMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleChangeClusterMode(mode.id)}
                className={`min-h-[26px] rounded-lg px-2 text-[10.5px] font-semibold transition-all whitespace-nowrap ${
                  clusterMode === mode.id
                    ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/38'
                    : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Quick Category Cluster Collapse / Expand Toggles */}
        {clusterMode !== 'none' && clusters.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-400">
                <Layers className="h-3 w-3 text-sky-400" />
                <span>Thu gọn / mở rộng cụm:</span>
              </span>
              {(
                [
                  {
                    kind: 'family' as const,
                    label: 'Gia tộc',
                    items: clusterGroupsByKind.family,
                    dot: 'bg-amber-400',
                    collapsedClass:
                      'bg-amber-500/20 text-amber-100 ring-amber-400/40',
                  },
                  {
                    kind: 'close_circle' as const,
                    label: 'Bạn thân',
                    items: clusterGroupsByKind.friends,
                    dot: 'bg-emerald-400',
                    collapsedClass:
                      'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40',
                  },
                  {
                    kind: 'faction' as const,
                    label: 'Đối đầu / Phe phái',
                    items: clusterGroupsByKind.faction,
                    dot: 'bg-red-400',
                    collapsedClass:
                      'bg-red-500/20 text-red-100 ring-red-400/40',
                  },
                  {
                    kind: 'other' as const,
                    label: 'Nhóm khác',
                    items: clusterGroupsByKind.other,
                    dot: 'bg-sky-400',
                    collapsedClass:
                      'bg-sky-500/20 text-sky-100 ring-sky-400/40',
                  },
                ]
              )
                .filter((grp) => grp.items.length > 0)
                .map((grp) => {
                  const allCollapsed = grp.items.every((c) =>
                    collapsedClusterIds.includes(c.id),
                  );
                  return (
                    <button
                      key={grp.kind}
                      type="button"
                      onClick={() => handleToggleCollapseByKind(grp.kind)}
                      title={
                        allCollapsed
                          ? `Mở rộng toàn bộ cụm ${grp.label}`
                          : `Thu gọn toàn bộ cụm ${grp.label}`
                      }
                      className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-lg px-2 text-[10.5px] font-semibold ring-1 ring-inset transition-all whitespace-nowrap ${
                        allCollapsed
                          ? grp.collapsedClass
                          : 'bg-white/[0.04] text-slate-300 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${grp.dot}`} />
                      {allCollapsed ? (
                        <Maximize2 className="h-2.5 w-2.5" />
                      ) : (
                        <Minimize2 className="h-2.5 w-2.5" />
                      )}
                      <span>
                        {allCollapsed ? 'Mở rộng' : 'Thu gọn'} {grp.label} (
                        {grp.items.length})
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCollapseAllClusters}
                className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-white/[0.045] px-2 text-[10px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10]"
              >
                <Minimize2 className="h-2.5 w-2.5" />
                <span>Thu gọn tất cả</span>
              </button>
              {collapsedClusterIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleExpandAllClusters}
                  className="inline-flex min-h-[24px] items-center gap-1 rounded-md bg-sky-500/18 px-2 text-[10px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28"
                >
                  <Maximize2 className="h-2.5 w-2.5" />
                  <span>Mở rộng tất cả</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Cluster Chips with Individual Collapse/Expand */}
      {clusterMode !== 'none' && displayedClusters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {displayedClusters.map((cluster) => {
            const isFocused = effectiveClusterId === cluster.id;
            const isCollapsed = Boolean(cluster.collapsed);
            return (
              <div
                key={cluster.id}
                className={`inline-flex min-h-[26px] items-center rounded-lg text-[11px] font-semibold transition-all ${
                  isFocused
                    ? `${cluster.pillClass}`
                    : isCollapsed
                      ? 'bg-slate-800/80 text-slate-300 ring-1 ring-inset ring-white/[0.14]'
                      : 'bg-[#0e1625]/75 text-slate-300 ring-1 ring-inset ring-white/[0.08]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isCollapsed) {
                      toggleClusterCollapse(cluster.id);
                      return;
                    }
                    setSelectedId(null);
                    setSelectedEdgeId(null);
                    setActiveClusterId((cur) =>
                      cur === cluster.id ? null : cluster.id,
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1 hover:text-white"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: cluster.color }}
                  />
                  <span className="max-w-[155px] truncate">{cluster.label}</span>
                  <span className="rounded bg-white/[0.08] px-1 text-[10px] tabular-nums opacity-85">
                    {cluster.memberIds.length}
                  </span>
                </button>
                {cluster.memberIds.length >= 2 && (
                  <button
                    type="button"
                    title={isCollapsed ? 'Mở rộng cụm này' : 'Thu gọn cụm này'}
                    onClick={() => toggleClusterCollapse(cluster.id)}
                    className="border-l border-white/[0.08] px-1.5 py-1 text-slate-400 hover:text-white"
                  >
                    {isCollapsed ? (
                      <Maximize2 className="h-3 w-3 text-sky-300" />
                    ) : (
                      <Minimize2 className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
          {effectiveClusterId && (
            <button
              type="button"
              onClick={() => setActiveClusterId(null)}
              className="inline-flex min-h-[26px] items-center gap-1 rounded-lg bg-white/[0.05] px-2 text-[10px] font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
            >
              <X className="h-3 w-3" />
              <span>Hiện tất cả</span>
            </button>
          )}
        </div>
      )}

      {/* Interactive D3 Force-Directed SVG Network */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.16),rgba(11,18,32,0.97)_72%)]"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label="Sơ đồ mạng lưới quan hệ phân tầng Gia tộc, Nhóm thân thiết và Phe phái"
          className="h-[370px] w-full touch-none select-none sm:h-[470px]"
        />

        {displayedNodes.length === 0 && quickRelationFilter !== 'all' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#0b1220]/75 px-4 text-center backdrop-blur-[2px]">
            <p className="text-xs font-semibold text-slate-200">
              Chưa có nhóm hoặc liên kết{' '}
              {quickRelationFilter === 'family'
                ? 'Gia tộc'
                : quickRelationFilter === 'friends'
                  ? 'Bạn thân'
                  : 'Đối đầu'}{' '}
              nào trên biểu đồ.
            </p>
            <p className="max-w-xs text-[11px] text-slate-400">
              Bạn có thể tạo nhóm trong mục Quản lý Gia tộc / Nhóm hoặc quay về
              chế độ xem tất cả nhân vật.
            </p>
            <button
              type="button"
              onClick={() => handleSelectQuickRelationFilter('all')}
              className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-sky-500/20 px-3 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-500/30"
            >
              <span>Hiển thị tất cả</span>
            </button>
          </div>
        )}

        {/* Hover Tooltip */}
        {hoveredTooltip && (
          <div
            ref={tooltipRef}
            role="tooltip"
            className="pointer-events-none absolute left-0 top-0 z-20 w-[248px] rounded-xl border border-white/[0.14] bg-[#0b1324]/95 p-3 shadow-[0_16px_36px_-10px_rgba(2,8,23,0.9)] backdrop-blur-md will-change-transform"
          >
            {hoveredTooltip.node.isClusterHub ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-50">
                    {hoveredTooltip.node.clusterLabel}
                  </span>
                  <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
                    {hoveredTooltip.node.collapsedMemberCount} người
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-300">
                  {(hoveredTooltip.node.collapsedMemberNames || []).join(', ')}
                </p>
                <p className="mt-1.5 text-[10px] text-sky-300">
                  Bấm vào khối nhóm để mở rộng thành viên.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-slate-50">
                        {hoveredTooltip.node.portrait.name}
                      </span>
                      {hoveredTooltip.node.portrait.aiAutoEnrichLocked && (
                        <Lock className="h-3 w-3 shrink-0 text-rose-300" />
                      )}
                      {hoveredTooltip.node.portrait.pinned && (
                        <Pin className="h-3 w-3 shrink-0 text-amber-300" />
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${hoveredTooltip.node.badgeClass}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${hoveredTooltip.node.dotClass}`}
                        />
                        <span>{hoveredTooltip.node.tierLabel}</span>
                      </span>
                      {hoveredTooltip.node.detailLabel && (
                        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08]">
                          {hoveredTooltip.node.detailLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-200 ring-1 ring-inset ring-sky-400/25">
                    {hoveredTooltip.connectionCount} nối
                  </span>
                </div>

                <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
                  {TIER_DESCRIPTION[hoveredTooltip.node.tier]}
                </p>

                {hoveredTooltip.node.clusterLabel && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-sky-200/90">
                    <Layers className="h-3 w-3 shrink-0 text-sky-400" />
                    <span className="truncate font-semibold">
                      Nhóm: {hoveredTooltip.node.clusterLabel}
                    </span>
                  </div>
                )}

                {hoveredTooltip.node.portrait.relationships?.trim() ? (
                  <p className="mt-1.5 line-clamp-2 border-t border-white/[0.07] pt-1.5 text-[11px] leading-snug text-slate-300">
                    <span className="font-semibold text-emerald-300">
                      Quan hệ:{' '}
                    </span>
                    {hoveredTooltip.node.portrait.relationships}
                  </p>
                ) : (
                  <p className="mt-1.5 border-t border-white/[0.07] pt-1.5 text-[10px] italic text-slate-500">
                    Bấm vào nhân vật để gắn quan hệ hoặc xếp nhóm.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 left-2.5 flex items-center gap-1.5 rounded-lg bg-[#0b1220]/84 px-2.5 py-1 text-[10px] text-slate-400 ring-1 ring-white/[0.06]">
          <Move className="h-3 w-3 text-sky-400" />
          <span>
            Đưa chuột hoặc nhấp vào icon/tên nhân vật để hiện rõ dây nối · Bấm
            vào dây đang hiện để sửa/xóa
          </span>
        </div>
      </div>

      {/* Distinct Stroke Pattern & Color Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-[#0e1625]/75 px-3 py-2 text-[11px] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
        <span className="inline-flex items-center gap-1 font-semibold text-slate-200">
          <Network className="h-3 w-3 text-sky-400" />
          Kiểu nét:
        </span>
        {(
          Object.entries(TONE_META) as Array<
            [RelationshipTone, (typeof TONE_META)[RelationshipTone]]
          >
        ).map(([toneKey, meta]) => (
          <span key={toneKey} className="inline-flex items-center gap-1.5">
            <svg width="24" height="8" className="shrink-0">
              <line
                x1="1"
                y1="4"
                x2="23"
                y2="4"
                stroke={meta.stroke}
                strokeWidth={Math.min(2.6, meta.strokeWidth)}
                strokeDasharray={meta.dashPattern || undefined}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-slate-300">{meta.label}</span>
          </span>
        ))}
      </div>

      {/* Direct Edge Inspector / Editor (when user clicks a wire on the canvas OR hits Edit on a connection) */}
      {(selectedEdge || editingEdge) && (
        <div className="rounded-xl border border-sky-400/30 bg-[#111c30]/95 p-3.5 shadow-[0_10px_28px_-14px_rgba(2,8,23,0.8)]">
          {(() => {
            const srcId = editingEdge?.sourceId || selectedEdge?.sourceId || '';
            const tgtId = editingEdge?.targetId || selectedEdge?.targetId || '';
            const srcName = portraitById.get(srcId)?.name || 'Nhân vật A';
            const tgtName = portraitById.get(tgtId)?.name || 'Nhân vật B';
            const curTone = editingEdge?.tone || selectedEdge?.tone || 'ally';
            const toneMeta = TONE_META[curTone];

            return (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-sky-400" />
                    <span className="text-xs font-bold text-slate-100">
                      {srcName} ↔ {tgtName}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${toneMeta.pillClass}`}
                    >
                      {editingEdge
                        ? editingEdge.label || toneMeta.shortLabel
                        : selectedEdge?.label}
                    </span>
                    {selectedEdge?.isManual && (
                      <span className="rounded bg-sky-500/18 px-1.5 py-0.5 text-[9.5px] font-semibold text-sky-200">
                        Người dùng xác nhận
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEdgeId(null);
                      setEditingEdge(null);
                    }}
                    className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.08] hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {!editingEdge && selectedEdge && (
                  <>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {selectedEdge.reason}
                    </p>
                    {onUpdatePortraitBank &&
                      selectedEdge.sourceKind !== 'collapsed_summary' && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditEdge(selectedEdge)}
                            className="inline-flex min-h-[28px] items-center gap-1.5 rounded-lg bg-sky-500/18 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Chỉnh sửa quan hệ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteEdge(
                                selectedEdge.sourceId,
                                selectedEdge.targetId,
                              )
                            }
                            className="inline-flex min-h-[28px] items-center gap-1.5 rounded-lg bg-red-500/18 px-2.5 text-[11px] font-semibold text-red-200 ring-1 ring-inset ring-red-400/35 hover:bg-red-500/28"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Xóa đường nối sai</span>
                          </button>
                        </div>
                      )}
                  </>
                )}

                {editingEdge && onUpdatePortraitBank && (
                  <div className="space-y-2.5 border-t border-white/[0.07] pt-2.5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10.5px] font-semibold text-slate-300">
                          Loại quan hệ
                        </label>
                        <select
                          value={editingEdge.tone}
                          onChange={(e) => {
                            const nextTone = e.target.value as RelationshipTone;
                            setEditingEdge((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    tone: nextTone,
                                    label: TONE_META[nextTone].shortLabel,
                                  }
                                : null,
                            );
                          }}
                          className="min-h-[32px] w-full rounded-lg border border-white/[0.10] bg-[#0b1220] px-2 text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none"
                        >
                          <option value="family">Gia tộc / Huyết thống</option>
                          <option value="intimate">Thân mật / Tình cảm</option>
                          <option value="ally">Đồng minh / Bạn thân</option>
                          <option value="rival">Đối đầu / Xung đột / Thù địch</option>
                          <option value="mystery">Bí ẩn / Khó đoán</option>
                          <option value="neutral">Trung lập / Xã giao</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10.5px] font-semibold text-slate-300">
                          Nhãn hiển thị trên dây
                        </label>
                        <input
                          type="text"
                          value={editingEdge.label}
                          onChange={(e) =>
                            setEditingEdge((prev) =>
                              prev ? { ...prev, label: e.target.value } : null,
                            )
                          }
                          placeholder="VD: Kẻ thù, Mẹ con, Đối thủ, Bạn thân..."
                          className="min-h-[32px] w-full rounded-lg border border-white/[0.10] bg-[#0b1220] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEditedEdge}
                        className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 text-[11px] font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/38 hover:bg-emerald-500/30"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Lưu thay đổi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteEdge(
                            editingEdge.sourceId,
                            editingEdge.targetId,
                          )
                        }
                        className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-red-500/18 px-2.5 text-[11px] font-semibold text-red-200 ring-1 ring-inset ring-red-400/35 hover:bg-red-500/28"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Xóa đường nối</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEdge(null)}
                        className="inline-flex min-h-[30px] items-center rounded-lg bg-white/[0.05] px-2.5 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.10]"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Selected Character Relationship Inspector */}
      {selectedNode && !selectedNode.isClusterHub ? (
        <div className="rounded-xl bg-[#111b2c]/92 p-3.5 ring-1 ring-inset ring-white/[0.10]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div
                ref={inspectorMenuRef}
                className="relative flex flex-wrap items-center gap-1.5"
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={inspectorMenuOpen}
                  title="Bấm để đổi nhanh vai trò (Main / NPC / Mob) hoặc bật/tắt Tạm khóa AI"
                  onClick={() => setInspectorMenuOpen((v) => !v)}
                  className={`-ml-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-sm font-bold text-slate-50 transition-colors ${
                    inspectorMenuOpen
                      ? 'bg-sky-500/16 ring-1 ring-inset ring-sky-400/35'
                      : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{selectedNode.portrait.name}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                      inspectorMenuOpen ? 'rotate-180 text-sky-300' : ''
                    }`}
                  />
                </button>
                {selectedNode.portrait.aiAutoEnrichLocked && (
                  <button
                    type="button"
                    onClick={() => onToggleAiLock(selectedNode.portrait.id)}
                    title="Đang tạm khóa AI: bấm để mở khóa"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/18 text-rose-300 ring-1 ring-inset ring-rose-400/35 hover:bg-rose-500/28"
                  >
                    <Lock className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectorMenuOpen((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${selectedNode.badgeClass}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${selectedNode.dotClass}`}
                  />
                  <span>{selectedNode.tierLabel}</span>
                </button>
                {selectedNode.detailLabel && (
                  <span className="text-xs text-slate-300">
                    · {selectedNode.detailLabel}
                  </span>
                )}

                {inspectorMenuOpen && (
                  <CharacterRoleLockPopover
                    characterName={selectedNode.portrait.name}
                    roleMeta={resolvePortraitRoleBadge(selectedNode.portrait)}
                    isLocked={Boolean(selectedNode.portrait.aiAutoEnrichLocked)}
                    onSelectRole={(role) =>
                      onAssignRole?.(selectedNode.portrait.id, role)
                    }
                    onToggleLock={() =>
                      onToggleAiLock(selectedNode.portrait.id)
                    }
                    onClose={() => setInspectorMenuOpen(false)}
                  />
                )}
              </div>
              {selectedNode.portrait.relationships?.trim() && (
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  <span className="font-semibold text-emerald-300">
                    Hồ sơ quan hệ:{' '}
                  </span>
                  {selectedNode.portrait.relationships}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onTogglePin(selectedNode.portrait.id)}
                className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors ${
                  selectedNode.portrait.pinned
                    ? 'bg-amber-500/18 text-amber-100 ring-amber-400/40'
                    : 'bg-white/[0.05] text-slate-300 ring-white/[0.08] hover:bg-white/[0.10]'
                }`}
              >
                <Pin className="h-3 w-3" />
                <span>{selectedNode.portrait.pinned ? 'Đã ghim' : 'Ghim'}</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleAiLock(selectedNode.portrait.id)}
                className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ring-1 ring-inset transition-colors ${
                  selectedNode.portrait.aiAutoEnrichLocked
                    ? 'bg-rose-500/18 text-rose-100 ring-rose-400/40'
                    : 'bg-white/[0.05] text-slate-300 ring-white/[0.08] hover:bg-white/[0.10]'
                }`}
              >
                {selectedNode.portrait.aiAutoEnrichLocked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Unlock className="h-3 w-3" />
                )}
                <span>
                  {selectedNode.portrait.aiAutoEnrichLocked
                    ? 'Đang khóa'
                    : 'Khóa AI'}
                </span>
              </button>
              <button
                type="button"
                aria-label="Đóng chi tiết nhân vật"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Direct Custom Group Membership Toggle Chips */}
          {onUpdatePortraitBank && customGroups.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] pt-2.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                <Users className="h-3 w-3 text-amber-300" />
                Gia tộc / Nhóm:
              </span>
              {customGroups.map((g) => {
                const isMember = g.memberIds.includes(selectedNode.portrait.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      handleToggleMemberInGroup(g.id, selectedNode.portrait.id)
                    }
                    className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition-colors ${
                      isMember
                        ? 'bg-white/[0.12] text-white ring-1 ring-inset ring-white/[0.26]'
                        : 'bg-white/[0.03] text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.08] hover:text-slate-200'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                    <span>{g.name}</span>
                    {isMember && <Check className="h-3 w-3 text-emerald-300" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Assign Faction Tag Fallback */}
          {onAssignFactionTag && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] pt-2.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                <Layers className="h-3 w-3 text-sky-400" />
                Gán nhanh phe/nhóm:
              </span>
              <input
                type="text"
                list="d3-faction-suggestions"
                value={factionDraft}
                onChange={(e) => setFactionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAssignFaction();
                  }
                }}
                placeholder={
                  selectedNode.clusterLabel
                    ? `Hiện tại: ${selectedNode.clusterLabel}`
                    : 'VD: Gia tộc..., Nhóm Low G...'
                }
                className="min-h-[28px] w-[175px] rounded-lg border border-white/[0.09] bg-[#0e1625] px-2.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none sm:w-[210px]"
              />
              <datalist id="d3-faction-suggestions">
                {existingFactionSuggestions.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <button
                type="button"
                disabled={!factionDraft.trim()}
                onClick={handleAssignFaction}
                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/18 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/26 disabled:opacity-45"
              >
                <span>Xếp nhóm</span>
              </button>
            </div>
          )}

          {/* Quick Add Verified Relationship Edge */}
          {(onUpdatePortraitBank || onAddRelationshipTag) &&
            otherCandidatesForLink.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] pt-2.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                  <Link2 className="h-3 w-3 text-sky-400" />
                  Nối quan hệ:
                </span>
                <select
                  aria-label="Chọn loại quan hệ"
                  value={linkCustomLabel}
                  onChange={(e) => {
                    const preset = QUICK_RELATION_PRESETS.find(
                      (pr) => pr.label === e.target.value,
                    );
                    setLinkCustomLabel(e.target.value);
                    if (preset) setLinkTone(preset.tone);
                  }}
                  className="min-h-[28px] rounded-lg border border-white/[0.09] bg-[#0e1625] px-2 text-[11px] text-slate-200 focus:border-sky-400/75 focus:outline-none"
                >
                  {QUICK_RELATION_PRESETS.map((pr) => (
                    <option key={pr.label} value={pr.label}>
                      {pr.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500">với</span>
                <select
                  aria-label="Chọn nhân vật liên kết"
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  className="min-h-[28px] max-w-[165px] rounded-lg border border-white/[0.09] bg-[#0e1625] px-2 text-[11px] text-slate-200 focus:border-sky-400/75 focus:outline-none"
                >
                  <option value="">Chọn nhân vật...</option>
                  {otherCandidatesForLink.map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!linkTargetId}
                  onClick={handleQuickAddLink}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-sky-500/18 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/26 disabled:opacity-45"
                >
                  <Plus className="h-3 w-3" />
                  <span>Thêm dây</span>
                </button>
              </div>
            )}

          {/* Connected Edges List with Direct Edit & Delete Actions */}
          <div className="mt-2.5 border-t border-white/[0.07] pt-2.5">
            <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-300">
              <Sparkles className="h-3 w-3 text-sky-400" />
              <span>
                Kết nối trực tiếp ({connectedEdgesForSelected.length})
              </span>
            </div>
            {!connectedEdgesForSelected.length ? (
              <p className="text-[11px] text-slate-400">
                Chưa có đường kết nối nào theo bộ lọc hiện tại. Dùng mục
                &ldquo;Nối quan hệ&rdquo; ở trên để tạo liên kết chính xác.
              </p>
            ) : (
              <div className="space-y-1.5">
                {connectedEdgesForSelected.map((edge) => {
                  const otherId =
                    edge.sourceId === selectedNode.portrait.id
                      ? edge.targetId
                      : edge.sourceId;
                  const otherPortrait = portraitById.get(otherId);
                  if (!otherPortrait) return null;
                  const meta = TONE_META[edge.tone];
                  const isPrimaryHighlight =
                    edge.tone === 'family' ||
                    edge.tone === 'ally' ||
                    edge.tone === 'intimate';
                  const glowRingClass =
                    edge.tone === 'family'
                      ? 'ring-amber-400/40 shadow-[0_0_14px_-4px_rgba(245,158,11,0.45)]'
                      : edge.tone === 'ally'
                        ? 'ring-emerald-400/40 shadow-[0_0_14px_-4px_rgba(16,185,129,0.42)]'
                        : edge.tone === 'intimate'
                          ? 'ring-pink-400/40 shadow-[0_0_14px_-4px_rgba(236,72,153,0.42)]'
                          : 'ring-white/[0.06]';
                  return (
                    <div
                      key={edge.id}
                      onMouseEnter={() => setHoveredEdgeId(edge.id)}
                      onMouseLeave={() =>
                        setHoveredEdgeId((cur) =>
                          cur === edge.id ? null : cur,
                        )
                      }
                      className={`flex items-start justify-between gap-2 rounded-lg bg-[#0e1625]/82 px-2.5 py-2 ring-1 ring-inset transition-all ${glowRingClass}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (nodeById.has(otherId)) setSelectedId(otherId);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isPrimaryHighlight && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full animate-pulse"
                              style={{ backgroundColor: meta.stroke }}
                            />
                          )}
                          <span className="text-xs font-semibold text-slate-100 hover:text-sky-200">
                            {otherPortrait.name}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.pillClass}`}
                          >
                            {edge.label}
                          </span>
                          <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] text-slate-400">
                            {LAYER_META[edge.layer].shortLabel}
                          </span>
                          {edge.isManual && (
                            <span className="rounded bg-sky-500/15 px-1 py-0.5 text-[9px] font-semibold text-sky-200">
                              Đã xác nhận
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                          {edge.reason}
                        </p>
                      </button>

                      {onUpdatePortraitBank &&
                        edge.sourceKind !== 'collapsed_summary' && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              title="Chỉnh sửa loại/nhãn đường nối này"
                              onClick={() => handleStartEditEdge(edge)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-sky-200"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Xóa đường nối sai này"
                              onClick={() =>
                                handleDeleteEdge(edge.sourceId, edge.targetId)
                              }
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/18 hover:text-red-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-[#111b2c]/65 px-3 py-2 text-[11px] text-slate-400 ring-1 ring-inset ring-white/[0.06]">
          Đang hiển thị{' '}
          <strong className="text-slate-200">{rawPortraits.length}</strong> nhân
          vật và{' '}
          <strong className="text-slate-200">{visibleEdges.length}</strong> dây
          quan hệ rõ ràng. Bấm vào nhân vật để xem/sửa dây trực tiếp, bấm thẳng
          vào dây để sửa/xóa, hoặc mở{' '}
          <strong className="text-amber-200">Quản lý Gia tộc / Nhóm</strong> để
          chia cụm tùy chỉnh.
        </div>
      )}

      {/* Compact Briefing Table */}
      {nodes.length > 0 && (
        <div className="rounded-xl bg-[#0e1625]/82 p-3.5 ring-1 ring-inset ring-white/[0.08]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <h3 className="text-xs font-bold tracking-tight text-slate-100">
                Tổng kết phân tầng &amp; quan hệ chủ chốt
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
              {toneSummary.family > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/14 px-2 py-0.5 text-amber-200 ring-1 ring-inset ring-amber-400/30 tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {toneSummary.family} gia tộc
                </span>
              )}
              {toneSummary.intimate + toneSummary.ally > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/14 px-2 py-0.5 text-emerald-200 ring-1 ring-inset ring-emerald-400/30 tabular-nums">
                  <Heart className="h-2.5 w-2.5 text-pink-400" />
                  {toneSummary.intimate + toneSummary.ally} thân/đồng minh
                </span>
              )}
              {toneSummary.rival > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-500/14 px-2 py-0.5 text-red-200 ring-1 ring-inset ring-red-400/30 tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {toneSummary.rival} đối đầu
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* Col 1: Top Hubs */}
            <div className="rounded-xl bg-[#131e31]/75 p-2.5 ring-1 ring-inset ring-white/[0.06]">
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  Trung tâm liên kết
                </span>
                <span className="text-[10px] text-slate-500">
                  Top {networkBriefing.topHubs.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {networkBriefing.topHubs.map((hub, idx) => (
                  <button
                    key={hub.node.id}
                    type="button"
                    onClick={() => {
                      setActiveClusterId(null);
                      setSelectedId(
                        effectiveSelectedId === hub.node.id
                          ? null
                          : hub.node.id,
                      );
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left ring-1 ring-inset transition-colors ${
                      effectiveSelectedId === hub.node.id
                        ? 'bg-sky-500/18 ring-sky-400/45'
                        : 'bg-[#0b1220]/70 ring-white/[0.05] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white/[0.06] text-[10px] font-bold text-slate-400 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-100">
                          {hub.node.portrait.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums">
                          {hub.familyCount > 0 && (
                            <span className="text-amber-300">
                              {hub.familyCount} gia tộc
                            </span>
                          )}
                          {hub.positiveCount > 0 && (
                            <span className="text-emerald-300">
                              +{hub.positiveCount} thân
                            </span>
                          )}
                          {hub.tensionCount > 0 && (
                            <span className="text-red-300">
                              {hub.tensionCount} đối đầu
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-sky-200 tabular-nums">
                      {hub.degree} nối
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Col 2: Clusters / Families / Factions */}
            <div className="rounded-xl bg-[#131e31]/75 p-2.5 ring-1 ring-inset ring-white/[0.06]">
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                  <Users className="h-3.5 w-3.5 text-sky-400" />
                  Gia tộc &amp; Cụm nhóm
                </span>
                <span className="text-[10px] text-slate-500">
                  {networkBriefing.topClusters.length} cụm
                </span>
              </div>
              <div className="space-y-1.5">
                {networkBriefing.topClusters.map((c) => {
                  const previewNames = c.memberNames.slice(0, 3).join(', ');
                  const moreCount = Math.max(0, c.memberNames.length - 3);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(null);
                        if (c.collapsed) {
                          toggleClusterCollapse(c.id);
                          return;
                        }
                        setActiveClusterId((cur) => (cur === c.id ? null : c.id));
                      }}
                      className={`flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left ring-1 ring-inset transition-colors ${
                        effectiveClusterId === c.id
                          ? 'bg-sky-500/18 ring-sky-400/45'
                          : 'bg-[#0b1220]/70 ring-white/[0.05] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="truncate text-xs font-semibold text-slate-100">
                            {c.label}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-slate-200 tabular-nums">
                          {c.memberIds.length} người
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                        <span className="truncate">
                          {previewNames}
                          {moreCount > 0 ? ` +${moreCount}` : ''}
                        </span>
                        {c.externalTension > 0 && (
                          <span className="shrink-0 text-red-300 tabular-nums">
                            {c.externalTension} đối đầu
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Col 3: Key Relationships */}
            <div className="rounded-xl bg-[#131e31]/75 p-2.5 ring-1 ring-inset ring-white/[0.06]">
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                  <Flame className="h-3.5 w-3.5 text-rose-400" />
                  Quan hệ nổi bật
                </span>
                <span className="text-[10px] text-slate-500 tabular-nums">
                  {networkBriefing.keyRelationships.length} dây chính
                </span>
              </div>
              {networkBriefing.keyRelationships.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Chưa có quan hệ nổi bật. Bấm vào nhân vật để nối dây Gia tộc /
                  Thân mật / Đối đầu rõ ràng.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {networkBriefing.keyRelationships.map(
                    ({ edge, sourceName, targetName }) => {
                      const toneMeta = TONE_META[edge.tone];
                      return (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => {
                            setActiveClusterId(null);
                            setSelectedEdgeId(edge.id);
                            setEditingEdge(null);
                          }}
                          className="flex w-full flex-col rounded-lg bg-[#0b1220]/70 px-2.5 py-1.5 text-left ring-1 ring-inset ring-white/[0.05] transition-colors hover:bg-white/[0.06]"
                        >
                          <div className="flex w-full items-center justify-between gap-1.5">
                            <div className="flex min-w-0 items-center gap-1 text-xs font-semibold text-slate-100">
                              <span className="truncate">{sourceName}</span>
                              <span className="shrink-0 text-[10px] text-slate-500">
                                ↔
                              </span>
                              <span className="truncate">{targetName}</span>
                            </div>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${toneMeta.pillClass}`}
                            >
                              {edge.label}
                            </span>
                          </div>
                          {edge.reason && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                              {edge.reason}
                            </p>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function focusedClusterOrNull(
  clusterId: string | null,
  clusterById: Map<string, GraphCluster>,
): string | null {
  return clusterId && clusterById.has(clusterId) ? clusterId : null;
}
