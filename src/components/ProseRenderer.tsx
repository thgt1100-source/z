import React, { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Globe, Sparkles } from 'lucide-react';
import {
  extractSpeakerPrefixFromLine,
  normalizeCharacterKey,
} from '../utils/characterUtils';
import { findMatchRanges } from '../utils/search';
import { CharacterNameBadge } from './CharacterNameBadge';

interface ProseRendererProps {
  text: string;
  highlightQuery?: string;
  isStreaming?: boolean;
  emptyPlaceholder?: string;
  knownCharacterKeys?: Set<string>;
  mcNameKey?: string;
  onCharacterClick?: (characterName: string) => void;
  openingSlot?: React.ReactNode;
  middleSlot?: React.ReactNode;
  endingSlot?: React.ReactNode;
}

const RAW_META_OPEN_TAG_RE =
  /<(?:thinking|thought|reasoning|analysis|plan|outline|draft|scratchpad|cot|preset|meta|system)\b[^>]*>/gi;
const RAW_META_CLOSE_TAG_RE =
  /<\/(?:thinking|thought|reasoning|analysis|plan|outline|draft|scratchpad|cot|preset|meta|system)\s*>/gi;

function updateMetaBlockDepth(
  line: string,
  currentDepth: number,
): {
  insideMeta: boolean;
  nextDepth: number;
} {
  if (!line.includes('<')) {
    return { insideMeta: currentDepth > 0, nextDepth: currentDepth };
  }
  const opens = (line.match(RAW_META_OPEN_TAG_RE) || []).length;
  const closes = (line.match(RAW_META_CLOSE_TAG_RE) || []).length;
  const insideMeta = currentDepth > 0 || opens > 0;
  const nextDepth = Math.max(0, currentDepth + opens - closes);
  return { insideMeta, nextDepth };
}

function renderWithHighlights(
  text: string,
  query: string | undefined,
  baseClass: string,
  keyPrefix: string,
): React.ReactNode {
  if (!query || !query.trim()) {
    return <span className={baseClass}>{text}</span>;
  }
  const ranges = findMatchRanges(text, query);
  if (!ranges.length) {
    return <span className={baseClass}>{text}</span>;
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) {
      parts.push(
        <span key={`${keyPrefix}-t-${i}`} className={baseClass}>
          {text.slice(cursor, start)}
        </span>,
      );
    }
    parts.push(
      <mark
        key={`${keyPrefix}-m-${i}`}
        className="rounded bg-amber-400/25 px-0.5 text-amber-100"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) {
    parts.push(
      <span key={`${keyPrefix}-e`} className={baseClass}>
        {text.slice(cursor)}
      </span>,
    );
  }
  return parts;
}

/**
 * Renders inline Markdown (**bold**, *italic*) + quoted dialogue ("...", “...”, ‘...’).
 */
function renderStyledRuns(
  segment: string,
  highlightQuery?: string,
  softenTrailing = false,
  baseTextClass = 'text-[#e8eff8]',
): React.ReactNode[] {
  const tokenRe =
    /("[^"\n]+"|“[^”\n]+”|‘[^’\n]+’|\*\*[^*\n]+\*\*|\*(?!\s)[^*\n]+?(?<!\s)\*)/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRe.exec(segment)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(
        <React.Fragment key={`a-${keyIdx}`}>
          {renderWithHighlights(
            segment.slice(lastIdx, match.index),
            highlightQuery,
            baseTextClass,
            `a-${keyIdx}`,
          )}
        </React.Fragment>,
      );
      keyIdx++;
    }
    const tok = match[0];
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      nodes.push(
        <React.Fragment key={`b-${keyIdx}`}>
          {renderWithHighlights(
            tok.slice(2, -2),
            highlightQuery,
            'font-semibold text-slate-100',
            `b-${keyIdx}`,
          )}
        </React.Fragment>,
      );
    } else if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      nodes.push(
        <React.Fragment key={`i-${keyIdx}`}>
          {renderWithHighlights(
            tok.slice(1, -1),
            highlightQuery,
            'italic text-sky-200/90',
            `i-${keyIdx}`,
          )}
        </React.Fragment>,
      );
    } else {
      nodes.push(
        <React.Fragment key={`d-${keyIdx}`}>
          {renderWithHighlights(
            tok,
            highlightQuery,
            'font-medium text-emerald-300',
            `d-${keyIdx}`,
          )}
        </React.Fragment>,
      );
    }
    keyIdx++;
    lastIdx = tokenRe.lastIndex;
  }

  if (lastIdx < segment.length) {
    const rest = segment.slice(lastIdx);
    if (softenTrailing && !highlightQuery && rest.length > 4) {
      const tipLen = Math.min(6, rest.length);
      const midLen = Math.min(8, Math.max(0, rest.length - tipLen));
      const softLen = Math.min(14, Math.max(0, rest.length - tipLen - midLen));
      const headEnd = rest.length - tipLen - midLen - softLen;
      const softEnd = headEnd + softLen;
      const midEnd = softEnd + midLen;

      if (headEnd > 0) {
        nodes.push(
          <span
            key={`r-${keyIdx}-head`}
            className={`${baseTextClass} transition-colors duration-500 ease-out`}
          >
            {rest.slice(0, headEnd)}
          </span>,
        );
      }
      if (softLen > 0) {
        nodes.push(
          <span
            key={`r-${keyIdx}-soft`}
            className="text-[#e8eff8]/80 transition-colors duration-500 ease-out"
          >
            {rest.slice(headEnd, softEnd)}
          </span>,
        );
      }
      if (midLen > 0) {
        nodes.push(
          <span
            key={`r-${keyIdx}-mid`}
            className="text-[#e8eff8]/65 transition-colors duration-500 ease-out"
          >
            {rest.slice(softEnd, midEnd)}
          </span>,
        );
      }
      nodes.push(
        <span
          key={`r-${keyIdx}-tip`}
          className="text-[#e8eff8]/45 transition-colors duration-500 ease-out"
        >
          {rest.slice(midEnd)}
        </span>,
      );
    } else {
      nodes.push(
        <React.Fragment key={`r-${keyIdx}`}>
          {renderWithHighlights(
            rest,
            highlightQuery,
            `${baseTextClass} transition-colors duration-500 ease-out`,
            `r-${keyIdx}`,
          )}
        </React.Fragment>,
      );
    }
  }

  return nodes;
}

type ProseBlock =
  | {
      kind: 'paragraph';
      text: string;
      initialMetaDepth: number;
    }
  | {
      kind: 'wave_mind';
      text: string;
      unclosed?: boolean;
    }
  | {
      kind: 'wave_parallel';
      text: string;
      unclosed?: boolean;
    };

/**
 * Extracts <wave_mind>...</wave_mind> inner-thought cards and <wave_parallel>...</wave_parallel>
 * off-stage parallel-world cards cleanly before paragraph splitting, keeping multi-paragraph
 * content grouped inside a single collapsible card.
 */
function parseProseBlocks(rawText: string): ProseBlock[] {
  const input = String(rawText || '').replace(/\r\n/g, '\n');
  if (!input.trim()) return [];

  const blocks: ProseBlock[] = [];
  let depth = 0;

  const pushProseChunk = (chunk: string) => {
    const rawParts = chunk
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of rawParts) {
      const initialMetaDepth = depth;
      const lines = part.split('\n');
      for (const ln of lines) {
        depth = updateMetaBlockDepth(ln, depth).nextDepth;
      }
      blocks.push({ kind: 'paragraph', text: part, initialMetaDepth });
    }
  };

  const specialTagRe =
    /<(wave_mind|wave_parallel)\b[^>]*>([\s\S]*?)(?:<\/\1\s*>|$)/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = specialTagRe.exec(input)) !== null) {
    if (match.index > cursor) {
      pushProseChunk(input.slice(cursor, match.index));
    }
    const tagName = match[1].toLowerCase() as 'wave_mind' | 'wave_parallel';
    const fullMatch = match[0];
    const inner = String(match[2] ?? '').trim();
    const closeRe = new RegExp(`<\\/${tagName}\\s*>$`, 'i');
    const unclosed = !closeRe.test(fullMatch);
    if (inner || unclosed) {
      blocks.push({
        kind: tagName,
        text: inner,
        unclosed,
      });
    }
    cursor = specialTagRe.lastIndex;
  }

  if (cursor < input.length) {
    pushProseChunk(input.slice(cursor));
  }

  return blocks;
}

function extractWaveMindNames(content: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const boldRe = /\*\*([^*\n]{1,42})\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = boldRe.exec(content)) !== null) {
    const clean = m[1].replace(/[:：]\s*$/, '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(clean);
  }
  return names.slice(0, 4);
}

interface WaveMindCardProps {
  content: string;
  unclosed?: boolean;
  highlightQuery?: string;
  isActiveStreaming?: boolean;
}

const WaveMindCard = memo(function WaveMindCard({
  content,
  unclosed = false,
  highlightQuery,
  isActiveStreaming = false,
}: WaveMindCardProps) {
  const [manualExpanded, setManualExpanded] = useState(false);

  const hasSearchMatch = useMemo(() => {
    if (!highlightQuery || !highlightQuery.trim()) return false;
    return findMatchRanges(content, highlightQuery).length > 0;
  }, [content, highlightQuery]);

  const isExpanded = manualExpanded || hasSearchMatch;

  const characterNames = useMemo(
    () => extractWaveMindNames(content),
    [content],
  );

  const entries = useMemo(
    () =>
      content
        .split(/\n{1,}/)
        .map((line) => line.trim())
        .filter(Boolean),
    [content],
  );

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-violet-400/20 bg-violet-950/25 shadow-sm">
      <button
        type="button"
        onClick={() => setManualExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3.5 py-2 text-left transition-colors hover:bg-violet-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          <span className="text-xs font-semibold tracking-wide text-violet-200 whitespace-nowrap">
            Tiếng lòng
          </span>
          {characterNames.length > 0 && (
            <span className="truncate text-xs text-violet-300/80">
              · {characterNames.join(', ')}
            </span>
          )}
          {unclosed && isActiveStreaming && (
            <span className="text-[11px] italic text-violet-300/70">
              (đang viết...)
            </span>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-violet-300/80">
          <span>{isExpanded ? 'Thu gọn' : 'Xem'}</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2 border-t border-violet-400/15 bg-[#0e1322]/55 px-3.5 py-2.5 text-[14px] leading-[1.7] text-slate-200">
          {entries.length > 0 ? (
            entries.map((entry, i) => (
              <p
                key={i}
                className="border-l-2 border-violet-400/35 pl-2.5 whitespace-pre-wrap break-words"
              >
                {renderStyledRuns(
                  entry,
                  highlightQuery,
                  false,
                  'text-violet-100/90',
                )}
              </p>
            ))
          ) : (
            <p className="text-xs italic text-violet-300/70">
              Đang tải nội tâm nhân vật...
            </p>
          )}
        </div>
      )}
    </div>
  );
});

const PARALLEL_HEADER_LINE_RE =
  /^(?:#{1,4}\s*)?\*\*([^*\n]{2,140})\*\*\s*[:：]?$/;

function extractParallelPreviewHeaders(content: string): string[] {
  const headers: string[] = [];
  const seen = new Set<string>();
  const lines = content.split(/\n+/).map((l) => l.trim());
  for (const line of lines) {
    const boldMatch = PARALLEL_HEADER_LINE_RE.exec(line);
    if (!boldMatch) continue;
    const raw = boldMatch[1].trim();
    if (!raw) continue;
    // Prefer the leading "Nhân vật｜Địa điểm" portion for compact mobile preview
    const segments = raw.split(/[｜|]/).map((s) => s.trim()).filter(Boolean);
    const label = segments.length >= 2 ? `${segments[0]} · ${segments[1]}` : raw;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    headers.push(label);
    if (headers.length >= 3) break;
  }
  return headers;
}

interface WaveParallelCardProps {
  content: string;
  unclosed?: boolean;
  highlightQuery?: string;
  isActiveStreaming?: boolean;
}

const WaveParallelCard = memo(function WaveParallelCard({
  content,
  unclosed = false,
  highlightQuery,
  isActiveStreaming = false,
}: WaveParallelCardProps) {
  const [manualExpanded, setManualExpanded] = useState(false);

  const hasSearchMatch = useMemo(() => {
    if (!highlightQuery || !highlightQuery.trim()) return false;
    return findMatchRanges(content, highlightQuery).length > 0;
  }, [content, highlightQuery]);

  const isExpanded = manualExpanded || hasSearchMatch;

  const previewHeaders = useMemo(
    () => extractParallelPreviewHeaders(content),
    [content],
  );

  const paragraphs = useMemo(
    () =>
      content
        .split(/\n{1,}/)
        .map((line) => line.trim())
        .filter(Boolean),
    [content],
  );

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-cyan-400/20 bg-cyan-950/20 shadow-sm">
      <button
        type="button"
        onClick={() => setManualExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Globe className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <span className="text-xs font-semibold tracking-wide text-cyan-200 whitespace-nowrap">
            Thế giới song song
          </span>
          {previewHeaders.length > 0 && (
            <span className="truncate text-xs text-cyan-300/80">
              · {previewHeaders.join(' / ')}
            </span>
          )}
          {unclosed && isActiveStreaming && (
            <span className="text-[11px] italic text-cyan-300/70 whitespace-nowrap">
              (đang viết...)
            </span>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-cyan-300/80">
          <span>{isExpanded ? 'Thu gọn' : 'Xem'}</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2.5 border-t border-cyan-400/15 bg-[#0c1421]/65 px-3.5 py-3 text-[14.5px] leading-[1.75] text-slate-200">
          {paragraphs.length > 0 ? (
            paragraphs.map((line, i) => {
              const headerMatch = PARALLEL_HEADER_LINE_RE.exec(line);
              if (headerMatch) {
                return (
                  <div
                    key={i}
                    className={`${
                      i > 0 ? 'mt-3 pt-2.5 border-t border-cyan-400/12' : ''
                    } flex items-center gap-1.5 text-[13px] font-semibold text-cyan-200`}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/80" />
                    <span>
                      {renderWithHighlights(
                        headerMatch[1].trim(),
                        highlightQuery,
                        'text-cyan-200',
                        `pw-h-${i}`,
                      )}
                    </span>
                  </div>
                );
              }
              return (
                <p
                  key={i}
                  className="whitespace-pre-wrap break-words text-slate-200/95"
                >
                  {renderStyledRuns(
                    line,
                    highlightQuery,
                    false,
                    'text-slate-200/95',
                  )}
                </p>
              );
            })
          ) : (
            <p className="text-xs italic text-cyan-300/70">
              Đang tải diễn biến ngoài sân khấu...
            </p>
          )}
        </div>
      )}
    </div>
  );
});

interface MemoParagraphProps {
  part: string;
  initialMetaDepth: number;
  idx: number;
  highlightQuery?: string;
  isActiveStreaming?: boolean;
  knownCharacterKeys?: Set<string>;
  mcNameKey?: string;
  onCharacterClick?: (characterName: string) => void;
}

const MemoParagraph = memo(function MemoParagraph({
  part,
  initialMetaDepth,
  idx,
  highlightQuery,
  isActiveStreaming = false,
  knownCharacterKeys,
  mcNameKey,
  onCharacterClick,
}: MemoParagraphProps) {
  const isThought =
    /^(\[\s*(suy nghĩ|nghĩ thầm|nội tâm)[^\]]*\]|\(\s*(suy nghĩ|nghĩ thầm|nội tâm)[^)]*\))/i.test(
      part,
    );

  // Standalone single-asterisk italic inner thought paragraph (*...*) from "Tiếng lòng Hòa vào chính văn"
  const isStandaloneItalicThought = useMemo(() => {
    const trimmed = part.trim();
    if (trimmed.length < 4) return false;
    if (!trimmed.startsWith('*') || !trimmed.endsWith('*')) return false;
    if (trimmed.startsWith('**') || trimmed.endsWith('**')) return false;
    const inner = trimmed.slice(1, -1);
    return !inner.includes('*');
  }, [part]);

  const lines = useMemo(() => part.split(/\r?\n/), [part]);

  const renderedContent = useMemo(() => {
    if (isThought) {
      return renderWithHighlights(
        part,
        highlightQuery,
        'italic text-sky-300',
        `th-${idx}`,
      );
    }

    if (isStandaloneItalicThought) {
      const inner = part.trim().slice(1, -1).trim();
      return renderWithHighlights(
        inner,
        highlightQuery,
        'italic text-sky-200/90',
        `it-${idx}`,
      );
    }

    let depth = initialMetaDepth;
    return lines.map((line, lineIdx) => {
      const isLastLine = lineIdx === lines.length - 1;
      const { insideMeta, nextDepth } = updateMetaBlockDepth(line, depth);
      depth = nextDepth;
      const soften = isActiveStreaming && isLastLine && !insideMeta;

      const speakerMatch = !insideMeta
        ? extractSpeakerPrefixFromLine(line, knownCharacterKeys)
        : null;

      return (
        <React.Fragment key={`ln-${idx}-${lineIdx}`}>
          {lineIdx > 0 && '\n'}
          {speakerMatch ? (
            <>
              {speakerMatch.leadingPrefix && (
                <span className="text-slate-400">
                  {speakerMatch.leadingPrefix}
                </span>
              )}
              <CharacterNameBadge
                name={speakerMatch.displayName}
                variant="prose"
                isMc={
                  Boolean(mcNameKey) &&
                  normalizeCharacterKey(speakerMatch.displayName) === mcNameKey
                }
                highlightQuery={highlightQuery}
                onClick={
                  onCharacterClick
                    ? () => onCharacterClick(speakerMatch.displayName)
                    : undefined
                }
                className="mr-1"
              />
              {speakerMatch.stageNote && (
                <span className="italic text-slate-400">
                  {speakerMatch.stageNote}
                </span>
              )}
              {speakerMatch.hasColon && (
                <span className="mr-1 text-slate-400">:</span>
              )}
              {speakerMatch.remainder &&
                renderStyledRuns(
                  speakerMatch.remainder,
                  highlightQuery,
                  soften,
                )}
            </>
          ) : (
            renderStyledRuns(line, highlightQuery, soften)
          )}
        </React.Fragment>
      );
    });
  }, [
    highlightQuery,
    idx,
    initialMetaDepth,
    isActiveStreaming,
    isStandaloneItalicThought,
    isThought,
    knownCharacterKeys,
    lines,
    mcNameKey,
    onCharacterClick,
    part,
  ]);

  return (
    <p
      className={`whitespace-pre-wrap break-words transition-opacity duration-700 ease-out ${
        isStandaloneItalicThought
          ? 'border-l-2 border-sky-400/30 pl-3 text-[15px]'
          : ''
      } ${isActiveStreaming ? 'stream-text-breathing' : 'opacity-100'}`}
    >
      {renderedContent}
      {isActiveStreaming && (
        <span
          aria-hidden="true"
          className="stream-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-sky-400 align-baseline"
        />
      )}
    </p>
  );
});

export const ProseRenderer = memo(function ProseRenderer({
  text,
  highlightQuery,
  isStreaming = false,
  emptyPlaceholder = '(Chưa có nội dung)',
  knownCharacterKeys,
  mcNameKey,
  onCharacterClick,
  openingSlot,
  middleSlot,
  endingSlot,
}: ProseRendererProps) {
  const blocks = useMemo<ProseBlock[]>(() => parseProseBlocks(text), [text]);

  // Compute paragraph boundary closest to 50% of main prose paragraphs (excluding collapsible mind/parallel cards)
  const middleInsertAfterIdx = useMemo(() => {
    const proseIndices: number[] = [];
    blocks.forEach((b, i) => {
      if (b.kind === 'paragraph') proseIndices.push(i);
    });
    if (proseIndices.length === 0) return 0;
    if (proseIndices.length <= 2) return proseIndices[0];
    const totalLen = proseIndices.reduce(
      (sum, idx) => sum + blocks[idx].text.length,
      0,
    );
    const halfLen = totalLen / 2;
    let acc = 0;
    let bestIdx = proseIndices[Math.max(0, Math.floor(proseIndices.length / 2) - 1)];
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let k = 0; k < proseIndices.length - 1; k += 1) {
      const idx = proseIndices[k];
      acc += blocks[idx].text.length;
      const diff = Math.abs(acc - halfLen);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    }
    return bestIdx;
  }, [blocks]);

  if (!blocks.length) {
    return (
      <div className="space-y-3.5">
        {openingSlot}
        <p
          className={`text-sm text-slate-400 transition-opacity duration-700 ease-out ${
            isStreaming ? 'stream-text-breathing' : 'opacity-100'
          }`}
        >
          {emptyPlaceholder}
          {isStreaming && (
            <span
              aria-hidden="true"
              className="stream-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-sky-400 align-baseline"
            />
          )}
        </p>
        {middleSlot}
        {endingSlot}
      </div>
    );
  }

  return (
    <div
      className={`space-y-3.5 text-[15.5px] leading-[1.8] tracking-[0.006em] transition-opacity duration-700 ease-out ${
        isStreaming ? 'opacity-[0.88]' : 'opacity-100'
      }`}
    >
      {openingSlot}
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>
          {block.kind === 'wave_mind' ? (
            <WaveMindCard
              content={block.text}
              unclosed={block.unclosed}
              highlightQuery={highlightQuery}
              isActiveStreaming={isStreaming && idx === blocks.length - 1}
            />
          ) : block.kind === 'wave_parallel' ? (
            <WaveParallelCard
              content={block.text}
              unclosed={block.unclosed}
              highlightQuery={highlightQuery}
              isActiveStreaming={isStreaming && idx === blocks.length - 1}
            />
          ) : (
            <MemoParagraph
              part={block.text}
              initialMetaDepth={block.initialMetaDepth}
              idx={idx}
              highlightQuery={highlightQuery}
              isActiveStreaming={isStreaming && idx === blocks.length - 1}
              knownCharacterKeys={knownCharacterKeys}
              mcNameKey={mcNameKey}
              onCharacterClick={onCharacterClick}
            />
          )}
          {middleSlot && idx === middleInsertAfterIdx && middleSlot}
        </React.Fragment>
      ))}
      {endingSlot}
    </div>
  );
});
