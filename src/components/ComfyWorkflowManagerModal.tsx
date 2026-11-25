import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  FileJson2,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  ComfyUiNodeMapping,
  ComfyUiWorkflowPreset,
} from '../types/ark';
import { analyzeComfyUiWorkflowJson } from '../utils/api';

interface ComfyWorkflowManagerModalProps {
  workflows: ComfyUiWorkflowPreset[];
  activeWorkflowId: string;
  initialDraftJson?: string;
  initialDraftNegativePrompt?: string;
  initialDraftNodeMapping?: ComfyUiNodeMapping;
  onApplyChanges: (payload: {
    workflows: ComfyUiWorkflowPreset[];
    activeWorkflowId: string;
  }) => void;
  onClose: () => void;
  onNotify: (msg: string, type?: 'info' | 'err') => void;
}

function cleanNodeMapping(mapping?: ComfyUiNodeMapping): ComfyUiNodeMapping {
  if (!mapping) return {};
  return {
    ...(mapping.positiveNodeId?.trim()
      ? { positiveNodeId: mapping.positiveNodeId.trim() }
      : {}),
    ...(mapping.negativeNodeId?.trim()
      ? { negativeNodeId: mapping.negativeNodeId.trim() }
      : {}),
    ...(mapping.seedNodeId?.trim()
      ? { seedNodeId: mapping.seedNodeId.trim() }
      : {}),
    ...(mapping.sizeNodeId?.trim()
      ? { sizeNodeId: mapping.sizeNodeId.trim() }
      : {}),
    ...(mapping.outputNodeId?.trim()
      ? { outputNodeId: mapping.outputNodeId.trim() }
      : {}),
  };
}

function createWorkflowId(): string {
  return `comfy_wf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatShortTimestamp(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

function deriveNameFromFilename(filename: string): string {
  return String(filename ?? '')
    .replace(/\.json$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ComfyWorkflowManagerModal({
  workflows,
  activeWorkflowId,
  initialDraftJson = '',
  initialDraftNegativePrompt = '',
  initialDraftNodeMapping,
  onApplyChanges,
  onClose,
  onNotify,
}: ComfyWorkflowManagerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const initialSelected = useMemo(() => {
    if (activeWorkflowId && workflows.some((w) => w.id === activeWorkflowId)) {
      return activeWorkflowId;
    }
    return workflows[0]?.id || '__new__';
  }, [activeWorkflowId, workflows]);

  const [selectedId, setSelectedId] = useState<string>(initialSelected);

  const selectedWorkflow = useMemo(
    () =>
      selectedId === '__new__'
        ? null
        : workflows.find((w) => w.id === selectedId) || null,
    [selectedId, workflows],
  );

  const [draftName, setDraftName] = useState<string>(() => {
    if (selectedWorkflow) return selectedWorkflow.name;
    return initialDraftJson.trim() ? 'Workflow hiện tại' : 'Workflow mới';
  });
  const [draftNotes, setDraftNotes] = useState<string>(
    () => selectedWorkflow?.notes || '',
  );
  const [draftJson, setDraftJson] = useState<string>(() =>
    selectedWorkflow ? selectedWorkflow.workflowJson : initialDraftJson,
  );
  const [draftNegativePrompt, setDraftNegativePrompt] = useState<string>(() =>
    selectedWorkflow
      ? selectedWorkflow.negativePrompt || ''
      : initialDraftNegativePrompt,
  );
  const [draftNodeMapping, setDraftNodeMapping] = useState<ComfyUiNodeMapping>(
    () =>
      selectedWorkflow
        ? cleanNodeMapping(selectedWorkflow.nodeMapping)
        : cleanNodeMapping(initialDraftNodeMapping),
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const importNewFileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceJsonFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const loadWorkflowIntoEditor = (wf: ComfyUiWorkflowPreset) => {
    setSelectedId(wf.id);
    setDraftName(wf.name);
    setDraftNotes(wf.notes || '');
    setDraftJson(wf.workflowJson || '');
    setDraftNegativePrompt(wf.negativePrompt || '');
    setDraftNodeMapping(cleanNodeMapping(wf.nodeMapping));
    setConfirmDeleteId(null);
  };

  const startNewWorkflowDraft = (seed?: {
    name?: string;
    json?: string;
    negativePrompt?: string;
    nodeMapping?: ComfyUiNodeMapping;
    notes?: string;
  }) => {
    setSelectedId('__new__');
    setDraftName(seed?.name || `Workflow #${workflows.length + 1}`);
    setDraftNotes(seed?.notes || '');
    setDraftJson(seed?.json || '');
    setDraftNegativePrompt(seed?.negativePrompt || '');
    setDraftNodeMapping(cleanNodeMapping(seed?.nodeMapping));
    setConfirmDeleteId(null);
  };

  const filteredWorkflows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter(
      (wf) =>
        wf.name.toLowerCase().includes(q) ||
        (wf.notes || '').toLowerCase().includes(q),
    );
  }, [searchQuery, workflows]);

  const workflowMetaById = useMemo(() => {
    const map = new Map<
      string,
      { ok: boolean; nodeCount: number; error?: string }
    >();
    for (const wf of workflows) {
      if (!wf.workflowJson.trim()) {
        map.set(wf.id, { ok: false, nodeCount: 0, error: 'Chưa có JSON' });
        continue;
      }
      const res = analyzeComfyUiWorkflowJson(wf.workflowJson);
      map.set(wf.id, {
        ok: res.ok,
        nodeCount: res.nodeSummaries.length,
        error: res.error,
      });
    }
    return map;
  }, [workflows]);

  const draftAnalysis = useMemo(
    () =>
      draftJson.trim() ? analyzeComfyUiWorkflowJson(draftJson) : null,
    [draftJson],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (selectedId === '__new__') {
      return Boolean(
        draftName.trim() ||
          draftJson.trim() ||
          draftNegativePrompt.trim() ||
          draftNotes.trim(),
      );
    }
    if (!selectedWorkflow) return false;
    const savedMap = cleanNodeMapping(selectedWorkflow.nodeMapping);
    const curMap = cleanNodeMapping(draftNodeMapping);
    return (
      draftName.trim() !== selectedWorkflow.name.trim() ||
      draftNotes.trim() !== (selectedWorkflow.notes || '').trim() ||
      draftJson !== selectedWorkflow.workflowJson ||
      draftNegativePrompt !== (selectedWorkflow.negativePrompt || '') ||
      JSON.stringify(curMap) !== JSON.stringify(savedMap)
    );
  }, [
    draftJson,
    draftName,
    draftNegativePrompt,
    draftNodeMapping,
    draftNotes,
    selectedId,
    selectedWorkflow,
  ]);

  const activeWorkflow = useMemo(
    () => workflows.find((w) => w.id === activeWorkflowId) || null,
    [activeWorkflowId, workflows],
  );

  const handleSaveCurrent = (activateAfterSave: boolean) => {
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      onNotify('Hãy nhập tên cho Workflow trước khi lưu.', 'err');
      return;
    }
    if (!draftJson.trim()) {
      onNotify('Hãy dán hoặc tải file Workflow API JSON trước khi lưu.', 'err');
      return;
    }

    const check = analyzeComfyUiWorkflowJson(draftJson);
    if (!check.ok) {
      onNotify(
        check.error || 'Workflow JSON chưa đúng định dạng Export (API).',
        'err',
      );
      return;
    }

    const cleanedMapping = cleanNodeMapping(draftNodeMapping);
    const now = Date.now();

    if (selectedId === '__new__' || !selectedWorkflow) {
      const newPreset: ComfyUiWorkflowPreset = {
        id: createWorkflowId(),
        name: trimmedName,
        workflowJson: draftJson,
        negativePrompt: draftNegativePrompt,
        nodeMapping: cleanedMapping,
        ...(draftNotes.trim() ? { notes: draftNotes.trim() } : {}),
        updatedAt: now,
      };
      const nextList = [newPreset, ...workflows];
      const nextActiveId =
        activateAfterSave || !activeWorkflowId
          ? newPreset.id
          : activeWorkflowId;
      onApplyChanges({
        workflows: nextList,
        activeWorkflowId: nextActiveId,
      });
      setSelectedId(newPreset.id);
      onNotify(
        nextActiveId === newPreset.id
          ? `Đã lưu và chọn dùng Workflow "${trimmedName}".`
          : `Đã lưu Workflow "${trimmedName}".`,
      );
      return;
    }

    const updatedPreset: ComfyUiWorkflowPreset = {
      ...selectedWorkflow,
      name: trimmedName,
      workflowJson: draftJson,
      negativePrompt: draftNegativePrompt,
      nodeMapping: cleanedMapping,
      notes: draftNotes.trim() || undefined,
      updatedAt: now,
    };
    const nextList = workflows.map((wf) =>
      wf.id === selectedWorkflow.id ? updatedPreset : wf,
    );
    const nextActiveId = activateAfterSave
      ? updatedPreset.id
      : activeWorkflowId;

    onApplyChanges({
      workflows: nextList,
      activeWorkflowId: nextActiveId,
    });
    onNotify(
      activateAfterSave
        ? `Đã cập nhật và chọn dùng Workflow "${trimmedName}".`
        : `Đã lưu thay đổi cho Workflow "${trimmedName}".`,
    );
  };

  const handleActivateById = (wf: ComfyUiWorkflowPreset) => {
    const check = analyzeComfyUiWorkflowJson(wf.workflowJson);
    if (!check.ok) {
      onNotify(
        `Workflow "${wf.name}" có lỗi JSON: ${check.error || 'không hợp lệ'}.`,
        'err',
      );
      loadWorkflowIntoEditor(wf);
      return;
    }
    onApplyChanges({
      workflows,
      activeWorkflowId: wf.id,
    });
    loadWorkflowIntoEditor(wf);
    onNotify(`Đã chuyển sang Workflow "${wf.name}".`);
  };

  const handleDuplicateSelected = () => {
    if (!selectedWorkflow) return;
    const copyPreset: ComfyUiWorkflowPreset = {
      ...selectedWorkflow,
      id: createWorkflowId(),
      name: `${selectedWorkflow.name} (Bản sao)`,
      nodeMapping: cleanNodeMapping(selectedWorkflow.nodeMapping),
      updatedAt: Date.now(),
    };
    const nextList = [copyPreset, ...workflows];
    onApplyChanges({
      workflows: nextList,
      activeWorkflowId,
    });
    loadWorkflowIntoEditor(copyPreset);
    onNotify(`Đã nhân bản thành "${copyPreset.name}".`);
  };

  const handleDeleteWorkflow = (targetId: string) => {
    const target = workflows.find((w) => w.id === targetId);
    if (!target) return;
    const nextList = workflows.filter((w) => w.id !== targetId);
    const nextActiveId =
      activeWorkflowId === targetId ? nextList[0]?.id || '' : activeWorkflowId;
    onApplyChanges({
      workflows: nextList,
      activeWorkflowId: nextActiveId,
    });
    setConfirmDeleteId(null);

    if (selectedId === targetId) {
      if (nextList.length > 0) {
        const nextPick =
          nextList.find((w) => w.id === nextActiveId) || nextList[0];
        loadWorkflowIntoEditor(nextPick);
      } else {
        startNewWorkflowDraft({ name: 'Workflow mặc định', json: '' });
      }
    }
    onNotify(`Đã xóa Workflow "${target.name}".`);
  };

  const handleImportNewFromFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const check = analyzeComfyUiWorkflowJson(text);
      const suggestedName =
        deriveNameFromFilename(file.name) || `Workflow #${workflows.length + 1}`;
      if (!check.ok) {
        startNewWorkflowDraft({ name: suggestedName, json: text });
        onNotify(
          check.error ||
            `File "${file.name}" chưa đúng chuẩn Export (API) của ComfyUI.`,
          'err',
        );
        return;
      }
      const newPreset: ComfyUiWorkflowPreset = {
        id: createWorkflowId(),
        name: suggestedName,
        workflowJson: text,
        negativePrompt: '',
        nodeMapping: {},
        updatedAt: Date.now(),
      };
      const nextList = [newPreset, ...workflows];
      onApplyChanges({
        workflows: nextList,
        activeWorkflowId: newPreset.id,
      });
      loadWorkflowIntoEditor(newPreset);
      onNotify(
        `Đã nhập và chọn dùng "${suggestedName}" (${check.nodeSummaries.length} node).`,
      );
    };
    reader.onerror = () => {
      onNotify('Không thể đọc file Workflow JSON.', 'err');
    };
    reader.readAsText(file);
  };

  const handleReplaceEditorJsonFromFile = (
    ev: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setDraftJson(text);
      if (
        selectedId === '__new__' &&
        (!draftName.trim() || /^Workflow(\s+mới|\s+#\d+)?$/i.test(draftName.trim()))
      ) {
        const derived = deriveNameFromFilename(file.name);
        if (derived) setDraftName(derived);
      }
      const check = analyzeComfyUiWorkflowJson(text);
      if (check.ok) {
        onNotify(
          `Đã nạp JSON từ "${file.name}" (${check.nodeSummaries.length} node). Bấm Lưu để ghi lại.`,
        );
      } else {
        onNotify(
          check.error || 'File JSON chưa đúng chuẩn ComfyUI Export (API).',
          'err',
        );
      }
    };
    reader.onerror = () => {
      onNotify('Không thể đọc file Workflow JSON.', 'err');
    };
    reader.readAsText(file);
  };

  const handleFormatDraftJson = () => {
    if (!draftJson.trim()) return;
    try {
      const parsed = JSON.parse(draftJson);
      setDraftJson(JSON.stringify(parsed, null, 2));
      onNotify('Đã định dạng lại JSON gọn gàng.');
    } catch {
      onNotify('Không thể định dạng vì JSON đang có lỗi cú pháp.', 'err');
    }
  };

  const handleExportCurrentJson = () => {
    if (!draftJson.trim()) {
      onNotify('Chưa có nội dung JSON để xuất.', 'err');
      return;
    }
    const safeFile =
      (draftName.trim() || 'comfyui_workflow')
        .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'comfyui_workflow';
    const blob = new Blob([draftJson], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFile}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify(`Đã xuất tệp ${safeFile}.json`);
  };

  const hasCustomMapping = Boolean(
    draftNodeMapping.positiveNodeId ||
      draftNodeMapping.negativeNodeId ||
      draftNodeMapping.seedNodeId ||
      draftNodeMapping.sizeNodeId ||
      draftNodeMapping.outputNodeId,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comfy-wf-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-[#111b2d] shadow-[0_24px_64px_-16px_rgba(2,6,23,0.9)]">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2
              id="comfy-wf-modal-title"
              className="text-base font-bold tracking-tight text-slate-50"
            >
              Thư viện Workflow ComfyUI
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
              <span className="tabular-nums">
                {workflows.length} workflow đã lưu
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">
                Đang dùng:{' '}
                <strong className="font-medium text-emerald-300">
                  {activeWorkflow ? activeWorkflow.name : 'Chưa chọn'}
                </strong>
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={importNewFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportNewFromFile}
            />
            <button
              type="button"
              onClick={() => importNewFileInputRef.current?.click()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.11] hover:text-white whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-300" />
              <span>Nhập .json</span>
            </button>
            <button
              type="button"
              onClick={() => startNewWorkflowDraft()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/18 px-3 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/35 transition-colors hover:bg-emerald-500/26 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tạo mới</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trình quản lý Workflow"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-slate-300 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] hover:text-white shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Workspace body: Left list + Right editor */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[280px_1fr]">
          {/* Sidebar list */}
          <aside className="flex max-h-[34dvh] flex-col border-b border-white/[0.08] bg-[#0d1525]/70 md:max-h-none md:border-b-0 md:border-r">
            {workflows.length > 2 && (
              <div className="border-b border-white/[0.07] p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên workflow..."
                    className="w-full rounded-lg border border-white/[0.09] bg-[#0b1220] py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
              {selectedId === '__new__' && (
                <div className="bg-emerald-500/10 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-emerald-100">
                      {draftName.trim() || 'Workflow mới'}
                    </span>
                    <span className="text-[11px] text-emerald-300 shrink-0">
                      Đang tạo mới
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Chưa lưu vào danh sách
                  </p>
                </div>
              )}

              {filteredWorkflows.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <FileJson2 className="mx-auto h-7 w-7 text-slate-500" />
                  <p className="mt-2 text-xs font-medium text-slate-300">
                    {workflows.length === 0
                      ? 'Chưa có workflow nào được lưu'
                      : 'Không tìm thấy workflow phù hợp'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {workflows.length === 0
                      ? 'Nhập tệp Export (API) .json từ ComfyUI hoặc tạo mới ở khung bên cạnh.'
                      : 'Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm.'}
                  </p>
                </div>
              ) : (
                filteredWorkflows.map((wf) => {
                  const isSelected = selectedId === wf.id;
                  const isActive = activeWorkflowId === wf.id;
                  const meta = workflowMetaById.get(wf.id);
                  return (
                    <div
                      key={wf.id}
                      onClick={() => loadWorkflowIntoEditor(wf)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          loadWorkflowIntoEditor(wf);
                        }
                      }}
                      className={`group cursor-pointer px-3.5 py-3 transition-colors ${
                        isSelected
                          ? 'bg-white/[0.07]'
                          : 'hover:bg-white/[0.035]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-slate-100">
                            {wf.name}
                          </div>
                          {wf.notes && (
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">
                              {wf.notes}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-400 tabular-nums">
                            {isActive && (
                              <>
                                <span className="font-medium text-emerald-300">
                                  Đang dùng
                                </span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span
                              className={
                                meta?.ok ? 'text-slate-400' : 'text-rose-300'
                              }
                            >
                              {meta?.ok
                                ? `${meta.nodeCount} node`
                                : 'JSON lỗi'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatShortTimestamp(wf.updatedAt)}</span>
                          </div>
                        </div>

                        {!isActive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateById(wf);
                            }}
                            title={`Chọn dùng "${wf.name}"`}
                            className="min-h-[28px] rounded-lg bg-white/[0.06] px-2 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-emerald-500/20 hover:text-emerald-100 hover:ring-emerald-400/35 whitespace-nowrap shrink-0"
                          >
                            Dùng
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right editor panel */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              {/* Name & Notes */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Tên Workflow
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="vd: Flux Dev Chân dung, SDXL Anime nhanh..."
                    className="w-full rounded-xl border border-white/[0.10] bg-[#0b1220] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/75 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Ghi chú ngắn (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder="vd: 20 bước, chuyên vẽ chân dung NPC..."
                    className="w-full rounded-xl border border-white/[0.10] bg-[#0b1220] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/75 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>
              </div>

              {/* Editor action strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-y border-white/[0.07] py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    ref={replaceJsonFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleReplaceEditorJsonFromFile}
                  />
                  <button
                    type="button"
                    onClick={() => replaceJsonFileInputRef.current?.click()}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] whitespace-nowrap"
                  >
                    <Upload className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Nạp file .json</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFormatDraftJson}
                    disabled={!draftJson.trim()}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] disabled:opacity-40 whitespace-nowrap"
                  >
                    <Code2 className="h-3.5 w-3.5 text-sky-300" />
                    <span>Định dạng</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCurrentJson}
                    disabled={!draftJson.trim()}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] disabled:opacity-40 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-300" />
                    <span>Xuất .json</span>
                  </button>
                  {selectedWorkflow && (
                    <button
                      type="button"
                      onClick={handleDuplicateSelected}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-white/[0.055] px-2.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.10] whitespace-nowrap"
                    >
                      <Copy className="h-3.5 w-3.5 text-slate-300" />
                      <span>Nhân bản</span>
                    </button>
                  )}
                </div>

                {selectedWorkflow && (
                  <div className="flex items-center gap-1.5">
                    {confirmDeleteId === selectedWorkflow.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDeleteWorkflow(selectedWorkflow.id)}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-rose-500/22 px-2.5 text-xs font-semibold text-rose-100 ring-1 ring-inset ring-rose-400/40 transition-colors hover:bg-rose-500/32 whitespace-nowrap"
                        >
                          Xác nhận xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="inline-flex min-h-[32px] items-center rounded-lg bg-white/[0.05] px-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.10] whitespace-nowrap"
                        >
                          Hủy
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selectedWorkflow.id)}
                        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-rose-500/12 px-2.5 text-xs font-medium text-rose-200 ring-1 ring-inset ring-rose-400/25 transition-colors hover:bg-rose-500/22 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Workflow API JSON textarea */}
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-medium text-slate-300">
                    Workflow API JSON (ComfyUI → Export (API))
                  </label>
                  {draftAnalysis && (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        draftAnalysis.ok ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {draftAnalysis.ok
                        ? `Hợp lệ · ${draftAnalysis.nodeSummaries.length} node`
                        : 'Chưa hợp lệ'}
                    </span>
                  )}
                </div>
                <textarea
                  value={draftJson}
                  onChange={(e) => setDraftJson(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  placeholder='{"3": {"class_type": "KSampler", "inputs": {...}}, "6": {"class_type": "CLIPTextEncode", "inputs": {"text": ""}}, ...}'
                  className="w-full rounded-xl border border-white/[0.10] bg-[#0a101d] px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/75 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />

                {draftAnalysis && (
                  <div
                    className={`mt-2 text-xs ${
                      draftAnalysis.ok ? 'text-slate-300' : 'text-rose-300'
                    }`}
                  >
                    {draftAnalysis.ok ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums">
                        <span className="text-slate-400">Ánh xạ hiện tại:</span>
                        <span>
                          Prompt (+):{' '}
                          <code className="font-mono text-emerald-200">
                            {draftNodeMapping.positiveNodeId?.trim() ||
                              draftAnalysis.detected.positiveNodeId ||
                              'chưa thấy'}
                          </code>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span>
                          Prompt (-):{' '}
                          <code className="font-mono text-slate-100">
                            {draftNodeMapping.negativeNodeId?.trim() ||
                              draftAnalysis.detected.negativeNodeId ||
                              'không có'}
                          </code>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span>
                          Seed:{' '}
                          <code className="font-mono text-slate-100">
                            {draftNodeMapping.seedNodeId?.trim() ||
                              draftAnalysis.detected.seedNodeId ||
                              'không có'}
                          </code>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span>
                          Size:{' '}
                          <code className="font-mono text-slate-100">
                            {draftNodeMapping.sizeNodeId?.trim() ||
                              draftAnalysis.detected.sizeNodeId ||
                              'không có'}
                          </code>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span>
                          Ảnh ra:{' '}
                          <code className="font-mono text-slate-100">
                            {draftNodeMapping.outputNodeId?.trim() ||
                              draftAnalysis.detected.outputNodeId ||
                              'tự động'}
                          </code>
                        </span>
                      </div>
                    ) : (
                      <p>{draftAnalysis.error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Per-workflow Negative Prompt */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Negative Prompt riêng cho workflow này (tùy chọn)
                </label>
                <input
                  type="text"
                  value={draftNegativePrompt}
                  onChange={(e) => setDraftNegativePrompt(e.target.value)}
                  placeholder="bad anatomy, extra fingers, blurry, watermark, text, low quality..."
                  className="w-full rounded-xl border border-white/[0.10] bg-[#0b1220] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/75 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              {/* Manual Node ID overrides */}
              <div className="border-t border-white/[0.07] pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Chỉ định Node ID thủ công (để trống để tự nhận diện)
                  </span>
                  {hasCustomMapping && (
                    <button
                      type="button"
                      onClick={() => setDraftNodeMapping({})}
                      className="text-xs font-medium text-sky-300 hover:text-sky-200"
                    >
                      Đặt lại tự động
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Prompt (+)
                    </label>
                    <input
                      type="text"
                      value={draftNodeMapping.positiveNodeId || ''}
                      onChange={(e) =>
                        setDraftNodeMapping((prev) => ({
                          ...prev,
                          positiveNodeId: e.target.value,
                        }))
                      }
                      placeholder={
                        draftAnalysis?.ok &&
                        draftAnalysis.detected.positiveNodeId
                          ? `Tự động: ${draftAnalysis.detected.positiveNodeId}`
                          : 'vd: 6'
                      }
                      className="w-full rounded-lg border border-white/[0.09] bg-[#0a101d] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Prompt (-)
                    </label>
                    <input
                      type="text"
                      value={draftNodeMapping.negativeNodeId || ''}
                      onChange={(e) =>
                        setDraftNodeMapping((prev) => ({
                          ...prev,
                          negativeNodeId: e.target.value,
                        }))
                      }
                      placeholder={
                        draftAnalysis?.ok &&
                        draftAnalysis.detected.negativeNodeId
                          ? `Tự động: ${draftAnalysis.detected.negativeNodeId}`
                          : 'vd: 7'
                      }
                      className="w-full rounded-lg border border-white/[0.09] bg-[#0a101d] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Seed
                    </label>
                    <input
                      type="text"
                      value={draftNodeMapping.seedNodeId || ''}
                      onChange={(e) =>
                        setDraftNodeMapping((prev) => ({
                          ...prev,
                          seedNodeId: e.target.value,
                        }))
                      }
                      placeholder={
                        draftAnalysis?.ok && draftAnalysis.detected.seedNodeId
                          ? `Tự động: ${draftAnalysis.detected.seedNodeId}`
                          : 'vd: 3'
                      }
                      className="w-full rounded-lg border border-white/[0.09] bg-[#0a101d] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Size (W/H)
                    </label>
                    <input
                      type="text"
                      value={draftNodeMapping.sizeNodeId || ''}
                      onChange={(e) =>
                        setDraftNodeMapping((prev) => ({
                          ...prev,
                          sizeNodeId: e.target.value,
                        }))
                      }
                      placeholder={
                        draftAnalysis?.ok && draftAnalysis.detected.sizeNodeId
                          ? `Tự động: ${draftAnalysis.detected.sizeNodeId}`
                          : 'vd: 5'
                      }
                      className="w-full rounded-lg border border-white/[0.09] bg-[#0a101d] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-[11px] text-slate-400">
                      Ảnh đầu ra
                    </label>
                    <input
                      type="text"
                      value={draftNodeMapping.outputNodeId || ''}
                      onChange={(e) =>
                        setDraftNodeMapping((prev) => ({
                          ...prev,
                          outputNodeId: e.target.value,
                        }))
                      }
                      placeholder={
                        draftAnalysis?.ok && draftAnalysis.detected.outputNodeId
                          ? `Tự động: ${draftAnalysis.detected.outputNodeId}`
                          : 'vd: 9'
                      }
                      className="w-full rounded-lg border border-white/[0.09] bg-[#0a101d] px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/[0.08] bg-[#0d1525]/80 px-4 py-3 sm:px-5">
              <div className="text-xs text-slate-400">
                {selectedId === '__new__' ? (
                  <span>Đang soạn workflow mới</span>
                ) : hasUnsavedChanges ? (
                  <span className="text-amber-300">Có thay đổi chưa lưu</span>
                ) : selectedWorkflow &&
                  selectedWorkflow.id === activeWorkflowId ? (
                  <span className="text-emerald-300">
                    Đang được sử dụng làm workflow mặc định
                  </span>
                ) : (
                  <span>Đã đồng bộ</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveCurrent(false)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.10] transition-colors hover:bg-white/[0.12] whitespace-nowrap"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {selectedId === '__new__' ? 'Lưu vào thư viện' : 'Lưu thay đổi'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCurrent(true)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-teal-600 px-4 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(16,185,129,0.45)] transition-all hover:from-emerald-400 hover:to-teal-500 active:scale-[0.985] whitespace-nowrap"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu &amp; Chọn dùng</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
