import {
  STORY_IMAGE_POSITIONS,
  type StoryImageBeatPrompts,
  type StoryImageItem,
  type StoryImagePosition,
  type Turn,
} from '../types/ark';

export function normalizeText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

export interface ParsedPresetStep {
  label: string;
  tag: string;
}

export interface ParsedStoryTurn {
  draftText: string;
  steps: ParsedPresetStep[];
  currentStepLabel: string;
  inDraftPhase: boolean;
  hasMainStory: boolean;
  mainText: string;
  metaText: string;
}

const POST_STORY_MARKERS: RegExp[] = [
  /\[KẾT THÚC PHẦN TRUYỆN\][\s\S]*$/i,
  /<incrementalSummary\b[^>]*>[\s\S]*$/i,
  /<tableEdit\b[^>]*>[\s\S]*$/i,
  /<summary\b[^>]*>[\s\S]*$/i,
  /<memory\b[^>]*>[\s\S]*$/i,
  /<world_state\b[^>]*>[\s\S]*$/i,
  /<state_update\b[^>]*>[\s\S]*$/i,
  /<finish\b[^>]*>[\s\S]*$/i,
  /^#0\s*Thông tin Hiện tại[\s\S]*$/im,
];

const DRAFT_TAG_NAMES =
  'thinking|thought|reasoning|analysis|plan|outline|draft|scratchpad|cot|preset|meta';

const PAIRED_DRAFT_TAG_RE = new RegExp(
  `<(${DRAFT_TAG_NAMES})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`,
  'gi',
);

const ORPHAN_CLOSE_DRAFT_RE = new RegExp(
  `<\\/(${DRAFT_TAG_NAMES})\\s*>`,
  'gi',
);

const ORPHAN_OPEN_DRAFT_RE = new RegExp(
  `<(${DRAFT_TAG_NAMES})\\b[^>]*>`,
  'i',
);

const STORY_WRAPPER_OPEN_RE =
  /<(story|narrative|content|response|main_story|prose)\b[^>]*>/i;

const STORY_WRAPPER_TAG_STRIP_RE =
  /<\/?(?:story|narrative|content|response|main_story|prose|chathistory)\b[^>]*>/gi;

const LEADING_PLAN_LINE_RE =
  /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#+\s*)?(?:\*\*|__)?\s*(?:\[(?:system|plan|stage|goal|check|scene|character|pacing|resource|boot|ooc)[^\]]*\]|(?:plan\s+for\s+(?:the\s+)?stage|word\s*count|words?\s+per\s+paragraph|target\s*word\s*count|system\s*boot|resource\s*loading|scene\s*plan|plot\s*plan|action\s*plan|writing\s*plan|goal|goals|stage\s*\d+|phase\s*\d+|pacing|tone|pov|checklist|constraints?|outline|drafting|mục\s*tiêu|số\s*từ|kế\s*hoạch|giai\s*đoạn\s*\d+)\b(?:\*\*|__)?(?:\s*[:\-–—.\]]|$|\s+\d))/i;

const VIET_PROSE_CHAR_RE =
  /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

const VIET_PROSE_FUNCTION_WORDS = new Set([
  'không', 'của', 'những', 'trong', 'được', 'một', 'người', 'với', 'nhưng',
  'rằng', 'đang', 'cũng', 'vẫn', 'này', 'kia', 'hắn', 'nàng', 'cô', 'anh',
  'tôi', 'ta', 'ngươi', 'chàng', 'chỉ', 'vào', 'ra', 'lên', 'xuống', 'trên',
  'dưới', 'giữa', 'như', 'khi', 'lúc', 'sau', 'trước', 'đã', 'sẽ', 'bằng',
  'từ', 'đến', 'về', 'lại', 'thì', 'mà', 'bởi', 'vì', 'nếu', 'tuy', 'rất',
  'quá', 'thật', 'khẽ', 'nhẹ', 'lặng', 'bước', 'nhìn', 'nói', 'cười', 'tiếng',
  'ánh', 'mắt', 'tay', 'gió', 'đêm', 'trời', 'lòng', 'hơi', 'thở', 'dừng',
  'đứng', 'ngồi', 'quay', 'nghe', 'thấy', 'biết', 'muốn', 'phải', 'còn',
  'đều', 'chưa', 'từng', 'cùng', 'theo', 'qua', 'nơi', 'bên', 'ngoài', 'cửa',
  'phòng', 'sân', 'đường', 'chiếc', 'mùi', 'sắc', 'giọng', 'khuôn', 'mặt',
  'đôi', 'bàn', 'chân', 'khoảng', 'chậm', 'rãi', 'bỗng', 'chợt', 'dần',
  'hơn', 'nhất', 'cả', 'mọi', 'mình', 'chính', 'ấy', 'đó', 'nào', 'gì',
  'sao', 'bao', 'nhiêu', 'lần', 'ngay', 'liền', 'vừa', 'mới', 'hay', 'hoặc',
  'vẫn', 'đây', 'đấy', 'kìa', 'thế', 'nên', 'cứ', 'chẳng', 'đừng', 'hãy',
  'nữa', 'rồi', 'xong', 'lấy', 'cho', 'để', 'làm', 'đi', 'về', 'tới',
]);

const ENGLISH_COT_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'onto', 'about',
  'must', 'will', 'would', 'should', 'could', 'need', 'needs', 'want', 'wants',
  'keep', 'keeping', 'avoid', 'ensure', 'ensuring', 'focus', 'focusing', 'make',
  'making', 'sure', 'here', 'there', 'start', 'begin', 'write', 'writing',
  'scene', 'story', 'world', 'core', 'character', 'characters', 'presence',
  'dialogue', 'setting', 'action', 'narrative', 'atmosphere', 'tone', 'pacing',
  'mood', 'emotion', 'emotional', 'detail', 'details', 'sensory', 'user',
  'prompt', 'response', 'draft', 'plan', 'planning', 'outline', 'outlining',
  'examining', 'prioritizing', 'defining', 'describing', 'analyzing',
  'analysing', 'establishing', 'developing', 'crafting', 'building', 'refining',
  'balancing', 'structuring', 'reviewing', 'checking', 'confirming', 'framing',
  'setting', 'exploring', 'considering', 'evaluating', 'determining',
  'identifying', 'selecting', 'weaving', 'shaping', 'preparing', 'addressing',
  'introducing', 'incorporating', 'maintaining', 'adjusting', 'aligning',
  'finalizing', 'transitioning', 'detailing', 'highlighting', 'portraying',
  'capturing', 'reflecting', 'integrating', 'grounding', 'expanding',
  'deepening', 'continuing', 'visualizing', 'staging', 'orchestrating',
  'formatting', 'navigating', 'handling', 'managing', 'tracking', 'mapping',
  'synthesizing', 'concluding', 'resolving', 'polishing', 'verifying',
  'validating', 'reconciling', 'applying', 'following', 'respecting',
  'initiating', 'executing', 'composing', 'generating', 'delivering',
  'completing', 'thinking', 'reasoning', 'understanding', 'interpreting',
  'deconstructing', 'assessing', 'summarizing', 'recalling', 'while', 'where',
  'when', 'which', 'their', 'her', 'his', 'she', 'he', 'they', 'them', 'its',
  'our', 'your', 'my', 'i', 'not', 'but', 'also', 'just', 'very', 'more',
  'most', 'some', 'such', 'through', 'between', 'without', 'before', 'after',
  'first', 'next', 'then', 'finally', 'now', 'so', 'because', 'since', 'being',
  'have', 'has', 'had', 'are', 'was', 'were', 'been', 'can', 'may', 'might',
  'how', 'what', 'why', 'who', 'vietnamese', 'prose', 'opening', 'context',
  'interaction', 'progression', 'continuity', 'directives', 'constraints',
  'requirements', 'guidelines', 'approach', 'strategy', 'perspective', 'flow',
  'tension', 'subtle', 'vivid', 'natural', 'paragraph', 'paragraphs', 'word',
  'words', 'count', 'length', 'stage', 'step', 'beat', 'goal', 'goals',
]);

const ENGLISH_COT_HEADING_VERB_RE =
  /^(?:examining|prioritizing|prioritising|defining|describing|analyzing|analysing|establishing|developing|crafting|building|structuring|planning|outlining|reviewing|checking|confirming|verifying|validating|framing|balancing|pacing|refining|introducing|incorporating|exploring|managing|navigating|handling|considering|evaluating|designing|writing|drafting|setting|mapping|tracking|focusing|maintaining|ensuring|assessing|determining|identifying|selecting|orchestrating|weaving|shaping|tuning|adjusting|aligning|synthesizing|synthesising|brainstorming|finalizing|finalising|wrapping|addressing|continuing|deepening|escalating|heightening|concluding|resolving|capturing|portraying|depicting|applying|following|respecting|adhering|preparing|initiating|executing|polishing|formatting|updating|reconciling|integrating|grounding|anchoring|elevating|amplifying|intensifying|layering|immersing|rendering|composing|generating|delivering|completing|finishing|transitioning|shifting|detailing|highlighting|reflecting|visualizing|visualising|staging|thinking|reasoning|understanding|interpreting|deconstructing|summarizing|summarising|recalling|opening|closing|checking|noting|deciding|choosing|creating|forming|guiding|steering|adapting|matching|blending|connecting|linking|bridging|clarifying|verifying)\b/i;

const ENGLISH_COT_SIGNAL_STRONG_RE =
  /(?:\b(?:I['’]m|I['’]ve|I['’]ll|I['’]d|I\s+(?:need|want|will|should|must|have|am|plan|intend|decided|aim|think|notice|see|can)\b|Let['’]s\b|My\s+(?:goal|plan|focus|aim|approach)\b|The\s+(?:user|prompt|scene|story|narrative|world|core|setting|goal|plan|tone|pacing|atmosphere|opening|character|characters|dialogue)\b|the\s+user['’]s\b|Now\s+(?:I['’]ll|I['’]m|let['’]s|for\s+the)\b|Make\s+sure\b|Focus\s+on\b|Keep\s+the\b|Ensure\s+the\b|Avoid\s+|Maintain\s+the\b|in\s+Vietnamese\b|Vietnamese\s+(?:prose|dialogue|narrative|story)\b|word\s*count\b|narrative\s+flow\b|sensory\s+details?\b|pacing\b|continuity\b|directives?\b|constraints?\b|point\s+of\s+view\b|\bPOV\b))/i;

function tokenizeLowerWords(text: string): string[] {
  const matches = String(text || '')
    .toLowerCase()
    .match(/[\p{L}]+(?:['’][\p{L}]+)?/gu);
  return matches || [];
}

export function countVietnameseProseWords(text: string): number {
  const words = tokenizeLowerWords(text);
  let count = 0;
  for (const w of words) {
    if (VIET_PROSE_FUNCTION_WORDS.has(w)) count += 1;
  }
  return count;
}

export function countEnglishCoTWords(text: string): number {
  const words = tokenizeLowerWords(text);
  let count = 0;
  for (const raw of words) {
    const base = raw.replace(/['’](?:s|m|ll|ve|d|re|t)$/i, '');
    if (ENGLISH_COT_WORDS.has(raw) || ENGLISH_COT_WORDS.has(base)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Detects standalone English thinking/CoT section headings such as:
 * "**Examining the World**", "**Prioritizing the Core**",
 * "**Defining Uyển Nhi's Presence**", "**Describing the Scene**",
 * "### Crafting the Opening", etc.
 * Works accurately even when Vietnamese proper names (like "Uyển Nhi") appear inside the heading.
 */
export function isEnglishThinkingHeadingLine(rawLine: string): boolean {
  const line = String(rawLine || '').trim();
  if (!line || line.length > 125) return false;
  // Never treat dialogue lines as CoT headings
  if (/[“”"«»]/.test(line) || /^—\s+/.test(line)) return false;

  const isMarkdownBold =
    /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:\*\*|__)[^*_\n]{3,108}(?:\*\*|__)\s*:?\s*$/.test(
      line,
    );
  const isMarkdownHeading = /^(?:#{1,4}\s+)\S/.test(line);

  const stripped = line
    .replace(/^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#{1,4}\s*)?/, '')
    .replace(/^(\*\*|__)\s*/, '')
    .replace(/\s*(\*\*|__)\s*:?\s*$/, '')
    .replace(/:$/, '')
    .trim();

  if (!stripped || stripped.length < 3 || stripped.length > 105) return false;
  // Narrative sentences ending with period/exclamation/question/ellipsis are not headings
  if (/[.!?…]$/.test(stripped)) return false;

  const vietProseCount = countVietnameseProseWords(stripped);
  if (vietProseCount >= 2) return false;

  const engCount = countEnglishCoTWords(stripped);
  if (ENGLISH_COT_HEADING_VERB_RE.test(stripped) && vietProseCount === 0) {
    return true;
  }

  if ((isMarkdownBold || isMarkdownHeading) && vietProseCount === 0) {
    if (engCount >= 2) return true;
    // e.g. "**Core Directives**", "**Scene Focus**", "**Tone & Pacing**"
    if (engCount >= 1 && /^[A-Z][A-Za-z'’&-]+(?:\s+[^\s]{1,28}){1,9}$/.test(stripped)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects whether a line or paragraph is English reasoning/CoT prose
 * (even when it mentions Vietnamese character or place names like "Uyển Nhi").
 */
export function isEnglishThinkingBlock(
  text: string,
  hasLaterVietnameseStory: boolean,
): boolean {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;

  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() || '';
  const vietProseCount = countVietnameseProseWords(trimmed);
  const engCount = countEnglishCoTWords(trimmed);

  // Protect genuine Vietnamese prose & dialogue
  if (vietProseCount >= 3 && vietProseCount >= engCount) return false;
  if (vietProseCount >= 2 && /[“”"]/.test(trimmed) && engCount < vietProseCount * 2) {
    return false;
  }

  if (isEnglishThinkingHeadingLine(firstLine)) {
    const rest = trimmed.slice(firstLine.length).trim();
    if (!rest) return true;
    const restViet = countVietnameseProseWords(rest);
    const restEng = countEnglishCoTWords(rest);
    if (restViet === 0 && restEng >= 1) return true;
    if (restEng >= 4 && restEng >= restViet * 3) return true;
  }

  if (vietProseCount === 0) {
    if (ENGLISH_COT_SIGNAL_STRONG_RE.test(trimmed)) return true;
    if (hasLaterVietnameseStory && engCount >= 3) return true;
    if (
      /^(?:[-*+•>]\s*|\d+[.)]\s*|[A-Za-z][A-Za-z0-9\s/&-]{1,36}:\s+)/.test(
        firstLine,
      ) &&
      engCount >= 2
    ) {
      return true;
    }
  }

  // English CoT paragraph that mentions Vietnamese proper names or 1 short Vietnamese word
  if (
    engCount >= 5 &&
    engCount >= Math.max(3, vietProseCount * 3) &&
    (hasLaterVietnameseStory || ENGLISH_COT_SIGNAL_STRONG_RE.test(trimmed))
  ) {
    return true;
  }

  return false;
}

function hasVietnameseNarrativeProse(text: string): boolean {
  const lines = String(text || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (isEnglishThinkingHeadingLine(trimmed)) continue;
    if (LEADING_PLAN_LINE_RE.test(trimmed)) continue;
    const vietCount = countVietnameseProseWords(trimmed);
    const engCount = countEnglishCoTWords(trimmed);
    if (vietCount >= 3 && vietCount > engCount) return true;
    if (
      VIET_PROSE_CHAR_RE.test(trimmed) &&
      vietCount >= 2 &&
      engCount <= 1 &&
      trimmed.length >= 16
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Scans leading unwrapped English thinking/CoT/planning lines (including
 * **Examining the World**, **Defining Uyển Nhi's Presence**, **Describing the Scene**,
 * and English reasoning explanations) and returns the exact character offset
 * where the clean story begins.
 */
function findLeadingEnglishCoTEndOffset(
  text: string,
  allowTrailingHold = false,
): number {
  if (!text) return 0;
  const hasVietLater = hasVietnameseNarrativeProse(text);
  const lineRe = /[^\r\n]*(?:\r?\n|$)/g;
  let offset = 0;
  let matchedAnyCoT = false;
  let sawHeadingOrPlan = false;
  let m: RegExpExecArray | null;

  while ((m = lineRe.exec(text)) !== null) {
    const chunk = m[0];
    if (!chunk) break;
    const trimmed = chunk.trim();

    if (!trimmed || /^[-*_]{3,}$/.test(trimmed)) {
      if (matchedAnyCoT) {
        offset += chunk.length;
        continue;
      }
      offset += chunk.length;
      continue;
    }

    const vietCount = countVietnameseProseWords(trimmed);
    const engCount = countEnglishCoTWords(trimmed);

    // Stop immediately as soon as a genuine Vietnamese narrative/dialogue line starts
    if (
      vietCount >= 3 &&
      vietCount > engCount &&
      !isEnglishThinkingHeadingLine(trimmed) &&
      !LEADING_PLAN_LINE_RE.test(trimmed)
    ) {
      break;
    }
    if (
      VIET_PROSE_CHAR_RE.test(trimmed) &&
      vietCount >= 2 &&
      engCount <= 1 &&
      !isEnglishThinkingHeadingLine(trimmed) &&
      !LEADING_PLAN_LINE_RE.test(trimmed)
    ) {
      break;
    }

    const isHeading = isEnglishThinkingHeadingLine(trimmed);
    const isPlan = LEADING_PLAN_LINE_RE.test(trimmed);
    const isStrongCoT =
      vietCount <= 1 &&
      (ENGLISH_COT_SIGNAL_STRONG_RE.test(trimmed) ||
        (engCount >= 5 && engCount >= vietCount * 3));
    const isContinuationEnglish =
      (sawHeadingOrPlan || hasVietLater) &&
      vietCount <= 1 &&
      (engCount >= 2 ||
        (!VIET_PROSE_CHAR_RE.test(trimmed) &&
          /^(?:[-*+•>]\s*|\d+[.)]\s*|[A-Za-z][A-Za-z0-9\s/&-]{1,36}:\s+)/.test(
            trimmed,
          )));
    const isPartialHeadingWhileStreaming =
      allowTrailingHold &&
      !hasVietLater &&
      offset === 0 &&
      trimmed.length < 72 &&
      /^(?:\*\*|__|#{1,4}\s|\[|\d+[.)]\s*(?:\[|\*\*|__))/.test(trimmed) &&
      vietCount === 0;

    if (
      isHeading ||
      isPlan ||
      isStrongCoT ||
      isContinuationEnglish ||
      isPartialHeadingWhileStreaming
    ) {
      matchedAnyCoT = true;
      if (isHeading || isPlan || isStrongCoT) sawHeadingOrPlan = true;
      offset += chunk.length;
      continue;
    }

    break;
  }

  // Only commit the cut if we actually detected CoT/planning lines (and either
  // Vietnamese story follows, or we saw explicit CoT headings/signals, or streaming hold).
  if (!matchedAnyCoT) return 0;
  if (!hasVietLater && !sawHeadingOrPlan && !allowTrailingHold) return 0;
  return offset;
}

function extractPresetSteps(draftText: string, primaryTag: string): ParsedPresetStep[] {
  const steps: ParsedPresetStep[] = [];
  const seen = new Set<string>();
  const addStep = (rawLabel: string, tag: string) => {
    const clean = rawLabel
      .replace(/[*_`#]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 72);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    steps.push({ label: clean, tag });
  };

  const lines = String(draftText || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Bracketed preset headings like: 1. [SYSTEM BOOT & RESOURCE LOADING]
    const bracketMatch = /^(?:\d+[.)]\s*)?\[([^\]]{3,64})\]/.exec(line);
    if (bracketMatch) {
      addStep(bracketMatch[1], 'preset');
      continue;
    }

    // English bold thinking headings like: **Examining the World**, **Defining Uyển Nhi's Presence**
    if (isEnglishThinkingHeadingLine(line)) {
      addStep(line, primaryTag || 'thinking');
      continue;
    }

    // Markdown or numbered stage/plan headings like: Plan for Stage 1: ... / Stage 2 - ... / Goal: ...
    const stageMatch =
      /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#+\s*)?(?:\*\*|__)?\s*((?:plan\s+for\s+(?:the\s+)?stage\s*\w*|stage\s*\d+|phase\s*\d+|giai\s*đoạn\s*\d+|goal|mục\s*tiêu|word\s*count|scene\s*plan|kế\s*hoạch|drafting|character\s*check|continuity\s*check)(?:\s*[:\-–—]\s*[^.\n]{1,42})?)/i.exec(
        line,
      );
    if (stageMatch) {
      addStep(stageMatch[1], primaryTag || 'plan');
    }
  }

  if (!steps.length && draftText.trim()) {
    const fallbackByTag: Record<string, string> = {
      thinking: 'Đang suy nghĩ & lập dàn ý',
      thought: 'Đang phân tích mạch truyện',
      plan: 'Đang lập kế hoạch phân cảnh',
      outline: 'Đang phác thảo dàn ý',
      draft: 'Đang viết bản nháp',
      preset: 'Đang xử lý thẻ preset',
      reasoning: 'Đang suy luận diễn biến',
    };
    addStep(
      fallbackByTag[primaryTag.toLowerCase()] || 'Đang xử lý preset & nháp',
      primaryTag || 'thinking',
    );
  }

  return steps.slice(-8);
}

export function parseStoryTurnStream(
  raw: string,
  showRawTags: boolean,
  isStreaming = false,
): ParsedStoryTurn {
  const text = String(raw || '');
  let cutIndex = -1;
  for (const re of POST_STORY_MARKERS) {
    const m = re.exec(text);
    if (m && (cutIndex === -1 || m.index < cutIndex)) {
      cutIndex = m.index;
    }
  }

  const bodyPart = cutIndex >= 0 ? text.slice(0, cutIndex) : text;
  const metaPart = cutIndex >= 0 ? text.slice(cutIndex).trim() : '';

  const draftSegments: string[] = [];
  let primaryTag = 'thinking';
  let working = bodyPart;
  let hasOpenDraft = false;

  // 1. Collect paired <thinking>...</thinking>, <plan>...</plan>, <draft>...</draft>, etc.
  PAIRED_DRAFT_TAG_RE.lastIndex = 0;
  working = working.replace(PAIRED_DRAFT_TAG_RE, (_full, tag: string, inner: string) => {
    primaryTag = tag || primaryTag;
    if (inner && inner.trim()) {
      draftSegments.push(inner.trim());
    }
    return '\n';
  });

  // 2. Handle orphan closing </thinking> (common when Prefill starts with <thinking>...)
  let lastCloseIdx = -1;
  let lastCloseLen = 0;
  let closeMatch: RegExpExecArray | null;
  ORPHAN_CLOSE_DRAFT_RE.lastIndex = 0;
  while ((closeMatch = ORPHAN_CLOSE_DRAFT_RE.exec(working)) !== null) {
    primaryTag = closeMatch[1] || primaryTag;
    lastCloseIdx = closeMatch.index;
    lastCloseLen = closeMatch[0].length;
  }
  if (lastCloseIdx >= 0) {
    const beforeClose = working.slice(0, lastCloseIdx).trim();
    if (beforeClose) {
      draftSegments.push(beforeClose);
    }
    working = working.slice(lastCloseIdx + lastCloseLen);
  }

  // 3. Handle explicit <story> / <narrative> / <content> wrapper if model switched directly into it
  const storyOpenMatch = STORY_WRAPPER_OPEN_RE.exec(working);
  if (storyOpenMatch) {
    const beforeStory = working.slice(0, storyOpenMatch.index).trim();
    if (beforeStory) {
      const cleanedBefore = beforeStory.replace(ORPHAN_OPEN_DRAFT_RE, '').trim();
      if (cleanedBefore) {
        draftSegments.push(cleanedBefore);
      }
    }
    working = working.slice(storyOpenMatch.index + storyOpenMatch[0].length);
  }

  // 4. Handle still-open <thinking> / <plan> / <draft> while streaming
  const openMatch = ORPHAN_OPEN_DRAFT_RE.exec(working);
  if (openMatch) {
    primaryTag = openMatch[1] || primaryTag;
    const beforeOpen = working.slice(0, openMatch.index).trim();
    const afterOpen = working.slice(openMatch.index + openMatch[0].length);

    // Check if the model forgot to close </thinking> and already transitioned into Vietnamese prose
    const paras = afterOpen.split(/\n{2,}/);
    const storyStartParaIdx = paras.findIndex(
      (p) =>
        p.trim().length > 24 &&
        VIET_PROSE_CHAR_RE.test(p) &&
        !LEADING_PLAN_LINE_RE.test(p.trim()),
    );

    if (storyStartParaIdx >= 0) {
      const draftPart = paras.slice(0, storyStartParaIdx).join('\n\n').trim();
      if (draftPart) draftSegments.push(draftPart);
      const storyPart = paras.slice(storyStartParaIdx).join('\n\n').trim();
      working = [beforeOpen, storyPart].filter(Boolean).join('\n\n');
    } else {
      hasOpenDraft = true;
      if (afterOpen.trim()) {
        draftSegments.push(afterOpen.trim());
      }
      working = beforeOpen;
    }
  }

  // 5. Handle unwrapped leading preset/plan/English thinking paragraphs (e.g., **Examining the World**, **Defining Uyển Nhi's Presence**, etc.)
  if (!hasOpenDraft && working.trim()) {
    const cotEndOffset = findLeadingEnglishCoTEndOffset(working, isStreaming);
    if (cotEndOffset > 0) {
      const leadingDraft = working.slice(0, cotEndOffset).trim();
      if (leadingDraft) {
        draftSegments.push(leadingDraft);
        primaryTag = 'thinking';
      }
      working = working.slice(cotEndOffset);
      if (!working.trim()) {
        hasOpenDraft = true;
      }
    }
  }

  let sanitizedWorking = working
    .replace(STORY_WRAPPER_TAG_STRIP_RE, '')
    .replace(/<story_image_prompts\b[^>]*>[\s\S]*?(?:<\/story_image_prompts>|$)/gi, '')
    .replace(/<image_prompts\b[^>]*>[\s\S]*?(?:<\/image_prompts>|$)/gi, '')
    .replace(/<state_update\b[^>]*>[\s\S]*?(?:<\/state_update>|$)/gi, '')
    .replace(/<finish\b[^>]*>[\s\S]*?(?:<\/finish>|$)/gi, '');

  // While streaming with raw tags hidden, hold back an incomplete trailing `<tag...` fragment
  if (isStreaming && !showRawTags) {
    sanitizedWorking = sanitizedWorking.replace(/<\/?[a-zA-Z_][a-zA-Z0-9_\s="-]{0,28}$/, '');
  }

  const cleanedStory = normalizeText(sanitizedWorking);

  const draftText = draftSegments.join('\n\n').trim();
  const steps = extractPresetSteps(draftText, primaryTag);
  const currentStepLabel =
    steps[steps.length - 1]?.label ||
    (hasOpenDraft ? 'Đang xử lý preset & suy nghĩ...' : '');

  const hasMainStory = cleanedStory.length > 0;
  const inDraftPhase =
    !hasMainStory && (hasOpenDraft || draftText.length > 0);

  if (showRawTags) {
    return {
      draftText,
      steps,
      currentStepLabel,
      inDraftPhase,
      hasMainStory: bodyPart.trim().length > 0,
      mainText: normalizeText(bodyPart),
      metaText: metaPart,
    };
  }

  return {
    draftText,
    steps,
    currentStepLabel,
    inDraftPhase,
    hasMainStory,
    mainText: cleanedStory,
    metaText: metaPart,
  };
}

export function splitNarrativeAndMeta(
  raw: string,
  showRawTags: boolean,
): { mainText: string; metaText: string } {
  const parsed = parseStoryTurnStream(raw, showRawTags);
  if (parsed.mainText) {
    return { mainText: parsed.mainText, metaText: parsed.metaText };
  }
  const fallback = normalizeText(String(raw || ''));
  return {
    mainText: parsed.inDraftPhase && !showRawTags ? '' : fallback,
    metaText: parsed.metaText,
  };
}

const PARTIAL_LEADING_DRAFT_START_RE =
  /^\s*(?:<(?:t|th|thi|thin|think|thinki|thinkin|thinking|tho|thou|thoug|though|thought|r|re|rea|reas|reaso|reason|reasoni|reasonin|reasoning|a|an|ana|anal|analy|analys|analysi|analysis|p|pl|pla|plan|pr|pre|pres|prese|preset|o|ou|out|outl|outli|outlin|outline|d|dr|dra|draf|draft|s|sc|scr|scra|scrat|scratc|scratch|c|co|cot|m|me|met|meta)\b|\*\*|__|#{1,4}\s|\[|\d+[.)]\s*(?:\[|\*\*|__))/i;

const LEADING_BOLD_OR_META_LINE_RE =
  /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#{1,4}\s+\S|(?:\*\*|__)[^*_\n]{2,96}(?:\*\*|__)|---+$|={3,}$|(?:kiểm\s+tra\s+nhanh|vị\s+trí\s+quan\s+sát|từ\s+ngữ\s+trực\s+diện|vật\s+lý\s+cơ\s+thể|ngũ\s+quan\s*&\s*thể\s+thái|trang\s+phục\s*&\s*trang\s+điểm)\s*[:(])/i;

const ENGLISH_OUTLINE_SIGNAL_RE =
  /\b(?:thinking|thought\s+process|analysis|analyze|analyzing|outline|drafting|plan|planning|scene\s+(?:setup|plan|goal|check)|word\s*count|target\s+length|pov|point\s+of\s+view|character\s+(?:state|check|profile|reaction)|continuity|constraint|constraints|checklist|body\s+physics|posture|appearance|grooming|intimacy|direct\s+terms|narrative\s+(?:person|goal|voice|arc)|user(?:'s)?\s+(?:action|input|prompt|message)|next\s+beat|pacing|tone|system\s+boot|resource\s+loading|step\s*\d+|stage\s*\d+|phase\s*\d+|response\s+plan|key\s+points?)\b/i;

const ENGLISH_PROSE_WORDS_RE =
  /\b(?:the|and|for|with|that|this|from|into|must|will|should|keep|avoid|ensure|focus|need|needs|here|start|begin|write|writing|scene|story|character|characters|dialogue|setting|action|hands?|body|eyes?)\b/gi;

/**
 * Returns the character offset in `raw` where the leading thinking / draft /
 * English outline section ends and the main narrative begins.
 * While the model is still streaming draft/thinking/English outline content
 * (and main story prose has not yet started), this returns `scanText.length`.
 */
export function getLeadingDraftEndOffset(raw: string): number {
  const text = String(raw || '');
  if (!text) return 0;

  let cutIndex = -1;
  for (const re of POST_STORY_MARKERS) {
    const m = re.exec(text);
    if (m && (cutIndex === -1 || m.index < cutIndex)) {
      cutIndex = m.index;
    }
  }
  const scanText = cutIndex >= 0 ? text.slice(0, cutIndex) : text;
  if (!scanText) return 0;

  let cursor = 0;

  // 1. Advance past any closing draft tags (</thinking>, </plan>, </draft>, orphan </thinking>, etc.)
  ORPHAN_CLOSE_DRAFT_RE.lastIndex = 0;
  let closeMatch: RegExpExecArray | null;
  while ((closeMatch = ORPHAN_CLOSE_DRAFT_RE.exec(scanText)) !== null) {
    cursor = Math.max(cursor, closeMatch.index + closeMatch[0].length);
  }

  // 2. Advance past explicit <story> / <narrative> / <content> wrapper if present
  const storyMatch = STORY_WRAPPER_OPEN_RE.exec(scanText.slice(cursor));
  if (storyMatch) {
    cursor += storyMatch.index + storyMatch[0].length;
  }

  // 3. Handle still-open <thinking> / <plan> / <draft> block while streaming
  const openMatch = ORPHAN_OPEN_DRAFT_RE.exec(scanText.slice(cursor));
  if (openMatch) {
    const beforeOpen = scanText.slice(cursor, cursor + openMatch.index).trim();
    const beforeHasVietStory =
      beforeOpen.length > 24 &&
      VIET_PROSE_CHAR_RE.test(beforeOpen) &&
      !LEADING_PLAN_LINE_RE.test(beforeOpen.split(/\r?\n/)[0]?.trim() || '') &&
      !LEADING_BOLD_OR_META_LINE_RE.test(
        beforeOpen.split(/\r?\n/)[0]?.trim() || '',
      );

    if (!beforeHasVietStory) {
      const afterOpenStart = cursor + openMatch.index + openMatch[0].length;
      const afterOpen = scanText.slice(afterOpenStart);
      const sepRe = /\r?\n\s*\r?\n/g;
      let pStart = 0;
      let sepMatch: RegExpExecArray | null;
      while (true) {
        sepMatch = sepRe.exec(afterOpen);
        const pEnd = sepMatch ? sepMatch.index : afterOpen.length;
        const para = afterOpen.slice(pStart, pEnd);
        const trimmed = para.trim();
        const firstLine = trimmed.split(/\r?\n/)[0]?.trim() || '';
        if (
          trimmed.length > 24 &&
          VIET_PROSE_CHAR_RE.test(trimmed) &&
          !LEADING_PLAN_LINE_RE.test(firstLine) &&
          !LEADING_BOLD_OR_META_LINE_RE.test(firstLine)
        ) {
          const leadingWs = para.length - para.trimStart().length;
          return afterOpenStart + pStart + leadingWs;
        }
        if (!sepMatch) break;
        pStart = sepMatch.index + sepMatch[0].length;
      }
      return scanText.length;
    }
  }

  // 4. Advance past any leading whitespace immediately following a closing tag
  if (cursor > 0) {
    while (cursor < scanText.length && /\s/.test(scanText[cursor])) {
      cursor++;
    }
  }

  // 5. Scan leading unwrapped draft / markdown **...** / English outline & CoT blocks (including those mentioning Vietnamese names)
  const remainder = scanText.slice(cursor);
  if (!remainder) return cursor;

  const fastCoTOffset = findLeadingEnglishCoTEndOffset(remainder, true);
  if (fastCoTOffset > 0) {
    cursor += fastCoTOffset;
    return cursor;
  }

  const hasLaterVietProse = hasVietnameseNarrativeProse(remainder);
  const sepRe = /\r?\n\s*\r?\n/g;
  let relStart = 0;
  let sepMatch: RegExpExecArray | null;

  while (true) {
    sepMatch = sepRe.exec(remainder);
    const relEnd = sepMatch ? sepMatch.index : remainder.length;
    const nextRelStart = sepMatch
      ? sepMatch.index + sepMatch[0].length
      : remainder.length;

    const para = remainder.slice(relStart, relEnd);
    const trimmed = para.trim();
    if (!trimmed) {
      cursor += nextRelStart - relStart;
      if (!sepMatch) break;
      relStart = nextRelStart;
      continue;
    }

    const firstLine = trimmed.split(/\r?\n/)[0]?.trim() || '';
    const isPlanOrHeading =
      LEADING_PLAN_LINE_RE.test(firstLine) ||
      LEADING_BOLD_OR_META_LINE_RE.test(firstLine) ||
      isEnglishThinkingHeadingLine(firstLine);
    const isPartialStart =
      relStart === 0 &&
      trimmed.length < 48 &&
      PARTIAL_LEADING_DRAFT_START_RE.test(trimmed);
    const isEnglishCoT = isEnglishThinkingBlock(trimmed, hasLaterVietProse);
    const isAsciiOnly = !VIET_PROSE_CHAR_RE.test(trimmed);
    const englishWordHits = isAsciiOnly
      ? (trimmed.match(ENGLISH_PROSE_WORDS_RE) || []).length
      : 0;
    const isEnglishOutline =
      isEnglishCoT ||
      (isAsciiOnly &&
        (ENGLISH_OUTLINE_SIGNAL_RE.test(trimmed) ||
          (hasLaterVietProse && englishWordHits >= 2) ||
          (/^(?:[-*+•>]\s*|\d+[.)]\s*|[A-Za-z][A-Za-z0-9\s/&-]{1,36}:\s+)/.test(
            firstLine,
          ) &&
            englishWordHits >= 1)));

    if (isPlanOrHeading || isPartialStart || isEnglishOutline) {
      cursor += nextRelStart - relStart;
      if (!sepMatch) break;
      relStart = nextRelStart;
      continue;
    }

    break;
  }

  return cursor;
}

/**
 * Cleans a completed AI story response by stripping leading <thinking>/<reasoning>
 * tags and leading unwrapped English CoT/draft blocks (e.g. **Examining the World**,
 * **Prioritizing the Core**, **Defining Uyển Nhi's Presence**, **Describing the Scene**)
 * while keeping the Vietnamese story prose (and optional post-story metadata markers) intact.
 */
export function extractStoryImageBeatPrompts(
  raw: string,
): StoryImageBeatPrompts | null {
  const source = String(raw || '');
  if (!source.trim()) return null;

  const cleanVal = (v: string | undefined): string | undefined => {
    const cleaned = String(v || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[\s*(?:ngày|thời\s*gian|lượt|trang|khung|cảnh|hệ\s*thống|time|date|turn|frame)[^\]]*\]/gi, ' ')
      .replace(/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g, ' ')
      .replace(/\b\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}\b/g, ' ')
      .replace(/\b(?:[01]?\d|2[0-3])\s*:\s*[0-5]\d(?:\s*:\s*[0-5]\d)?\b/g, ' ')
      .replace(/^["'`\s\-–—•*]+/, '')
      .replace(/["'`\s]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length >= 6 ? cleaned : undefined;
  };

  const blockMatch =
    /<story_image_prompts\b[^>]*>([\s\S]*?)(?:<\/story_image_prompts>|$)/i.exec(
      source,
    ) ||
    /<image_prompts\b[^>]*>([\s\S]*?)(?:<\/image_prompts>|$)/i.exec(source);

  const inner = blockMatch ? blockMatch[1].trim() : '';

  const readSubTag = (haystack: string, names: string[]): string | undefined => {
    const joined = names.join('|');
    const pairedRe = new RegExp(
      `<(?:${joined})\\b[^>]*>([\\s\\S]*?)<\\/(?:${joined})\\s*>`,
      'i',
    );
    const paired = pairedRe.exec(haystack);
    if (paired?.[1]) return cleanVal(paired[1]);
    return undefined;
  };

  let opening = inner
    ? readSubTag(inner, ['opening', 'start', 'head', 'open', 'frame1', 'frame_1', 'khung_dau'])
    : readSubTag(source, ['opening_image_prompt', 'image_prompt_opening']);
  let middle = inner
    ? readSubTag(inner, ['middle', 'mid', 'center', 'interaction', 'frame2', 'frame_2', 'khung_giua'])
    : readSubTag(source, ['middle_image_prompt', 'image_prompt_middle']);
  let ending = inner
    ? readSubTag(inner, ['ending', 'end', 'tail', 'closing', 'close', 'frame3', 'frame_3', 'khung_cuoi'])
    : readSubTag(source, ['ending_image_prompt', 'image_prompt_ending']);

  if (inner && !opening && !middle && !ending) {
    // Try JSON payload inside <story_image_prompts>
    const jsonMatch = /\{[\s\S]*\}/.exec(inner);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        opening = cleanVal(
          String(parsed.opening ?? parsed.start ?? parsed.frame1 ?? ''),
        );
        middle = cleanVal(
          String(parsed.middle ?? parsed.mid ?? parsed.frame2 ?? ''),
        );
        ending = cleanVal(
          String(parsed.ending ?? parsed.end ?? parsed.frame3 ?? ''),
        );
      } catch {
        // Ignore malformed JSON and fall through to line parser
      }
    }
  }

  if (inner && !opening && !middle && !ending) {
    const lines = inner
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const mOpen =
        /^(?:[-*•]\s*)?(?:1[.)]\s*)?(?:\*\*)?(?:opening|khung\s*đầu|mở\s*cảnh|frame\s*1)(?:\*\*)?\s*[:\-–—]\s*(.+)$/i.exec(
          line,
        );
      if (mOpen && !opening) {
        opening = cleanVal(mOpen[1]);
        continue;
      }
      const mMid =
        /^(?:[-*•]\s*)?(?:2[.)]\s*)?(?:\*\*)?(?:middle|khung\s*giữa|tương\s*tác|frame\s*2)(?:\*\*)?\s*[:\-–—]\s*(.+)$/i.exec(
          line,
        );
      if (mMid && !middle) {
        middle = cleanVal(mMid[1]);
        continue;
      }
      const mEnd =
        /^(?:[-*•]\s*)?(?:3[.)]\s*)?(?:\*\*)?(?:ending|khung\s*cuối|kết\s*mở|frame\s*3)(?:\*\*)?\s*[:\-–—]\s*(.+)$/i.exec(
          line,
        );
      if (mEnd && !ending) {
        ending = cleanVal(mEnd[1]);
      }
    }
  }

  if (!opening && !middle && !ending) return null;
  return {
    ...(opening ? { opening } : {}),
    ...(middle ? { middle } : {}),
    ...(ending ? { ending } : {}),
  };
}

export function sanitizeCompletedStoryResponse(raw: string): string {
  const original = String(raw || '').trim();
  if (!original) return '';

  const parsed = parseStoryTurnStream(original, false, false);
  const cleanMain = parsed.mainText.trim();
  if (!cleanMain) {
    return original;
  }
  if (parsed.metaText) {
    return `${cleanMain}\n\n${parsed.metaText}`.trim();
  }
  return cleanMain;
}

export function repairTruncatedJson(rawText: string): string {
  let s = String(rawText || '');
  if (!s.trim()) return s;
  let inStr = false;
  let esc = false;
  const stack: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === '\\') {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
    } else {
      if (ch === '"') {
        inStr = true;
      } else if (ch === '{') {
        stack.push('}');
      } else if (ch === '[') {
        stack.push(']');
      } else if (ch === '}' || ch === ']') {
        if (stack.length && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }
  if (inStr) s += '"';
  s = s.replace(/,\s*$/, '');
  while (stack.length) {
    s += stack.pop();
  }
  return s;
}

export function parseSaveJsonSafe(rawText: string): {
  data: Record<string, unknown>;
  repaired: boolean;
  warning?: string;
} {
  try {
    return { data: JSON.parse(rawText), repaired: false };
  } catch (firstErr) {
    try {
      const fixed = repairTruncatedJson(rawText);
      const data = JSON.parse(fixed);
      return {
        data,
        repaired: true,
        warning: firstErr instanceof Error ? firstErr.message : String(firstErr),
      };
    } catch {
      throw firstErr;
    }
  }
}

function extractItemText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  const obj = item as Record<string, unknown>;

  if (Array.isArray(obj.swipes) && obj.swipes.length) {
    const swipeId = typeof obj.swipeId === 'number' ? obj.swipeId : undefined;
    const currentSwipe =
      typeof obj.currentSwipe === 'number' ? obj.currentSwipe : undefined;
    const idx =
      swipeId !== undefined && obj.swipes[swipeId] != null
        ? swipeId
        : currentSwipe !== undefined && obj.swipes[currentSwipe] != null
          ? currentSwipe
          : obj.swipes.length - 1;
    const chosen = obj.swipes[idx] ?? obj.swipes[0];
    if (typeof chosen === 'string') return chosen;
    if (chosen && typeof chosen === 'object') {
      const c = chosen as Record<string, unknown>;
      return String(c.text ?? c.content ?? c.value ?? '');
    }
  }

  if (typeof obj.text === 'string') return obj.text;
  if (typeof obj.content === 'string') return obj.content;
  if (typeof obj.value === 'string') return obj.value;
  if (typeof obj.message === 'string') return obj.message;
  if (Array.isArray(obj.content)) {
    return obj.content
      .map((c) =>
        typeof c === 'string'
          ? c
          : String((c as Record<string, unknown>)?.text || ''),
      )
      .join('');
  }
  if (Array.isArray(obj.parts)) {
    return obj.parts
      .map((p) =>
        typeof p === 'string'
          ? p
          : String((p as Record<string, unknown>)?.text || ''),
      )
      .join('');
  }
  return '';
}

export function convertArrayToTurns(arr: unknown[]): Turn[] {
  const out: Turn[] = [];
  let pendingUser = '';

  for (const item of arr) {
    if (!item) continue;
    if (typeof item === 'string') {
      out.push({ id: `t_${out.length}`, user: '', assistant: item });
      continue;
    }
    const obj = item as Record<string, unknown>;
    if (
      'user' in obj ||
      'assistant' in obj ||
      'prompt' in obj ||
      'response' in obj
    ) {
      const rawTs = obj.createdAt ?? obj.timestamp ?? obj.savedAt;
      const parsedCreatedAt =
        typeof rawTs === 'number' && Number.isFinite(rawTs)
          ? rawTs
          : typeof rawTs === 'string' && rawTs
            ? Date.parse(rawTs)
            : NaN;
      const parsedDuration =
        typeof obj.durationMs === 'number' &&
        Number.isFinite(obj.durationMs) &&
        obj.durationMs > 0
          ? obj.durationMs
          : undefined;
      const parsedImageList = Array.isArray(obj.imageList)
        ? obj.imageList
            .filter(
              (item): item is string =>
                typeof item === 'string' && item.trim().length > 0,
            )
            .map((item) => item.trim())
        : [];
      const primaryImageData =
        typeof obj.imageData === 'string' && obj.imageData.trim()
          ? obj.imageData
          : parsedImageList[0] || '';
      const validStoryPosSet = new Set<StoryImagePosition>(STORY_IMAGE_POSITIONS);
      const parsedStoryImages: StoryImageItem[] = Array.isArray(obj.storyImages)
        ? obj.storyImages
            .filter(
              (entry): entry is Record<string, unknown> =>
                Boolean(entry) &&
                typeof entry === 'object' &&
                validStoryPosSet.has(
                  (entry as Record<string, unknown>)
                    .position as StoryImagePosition,
                ),
            )
            .map((entry) => {
              const pos = entry.position as StoryImagePosition;
              const imgData =
                typeof entry.imageData === 'string' && entry.imageData.trim()
                  ? entry.imageData.trim()
                  : undefined;
              return {
                id:
                  typeof entry.id === 'string' && entry.id.trim()
                    ? entry.id.trim()
                    : `${typeof obj.id === 'string' && obj.id ? obj.id : `t_${out.length}`}_${pos}`,
                position: pos,
                ...(imgData ? { imageData: imgData } : {}),
                prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
                ...(typeof entry.subject === 'string' && entry.subject
                  ? { subject: entry.subject }
                  : {}),
                status: imgData ? ('done' as const) : ('error' as const),
                ...(typeof entry.error === 'string' && !imgData
                  ? { error: entry.error }
                  : {}),
              };
            })
            .filter((entry) => Boolean(entry.imageData))
        : [];
      const rawBeatPrompts =
        obj.storyImagePrompts && typeof obj.storyImagePrompts === 'object'
          ? (obj.storyImagePrompts as Record<string, unknown>)
          : null;
      const parsedBeatPrompts: StoryImageBeatPrompts | undefined =
        rawBeatPrompts
          ? {
              ...(typeof rawBeatPrompts.opening === 'string' &&
              rawBeatPrompts.opening.trim()
                ? { opening: rawBeatPrompts.opening.trim() }
                : {}),
              ...(typeof rawBeatPrompts.middle === 'string' &&
              rawBeatPrompts.middle.trim()
                ? { middle: rawBeatPrompts.middle.trim() }
                : {}),
              ...(typeof rawBeatPrompts.ending === 'string' &&
              rawBeatPrompts.ending.trim()
                ? { ending: rawBeatPrompts.ending.trim() }
                : {}),
            }
          : undefined;
      const hasBeatPrompts =
        parsedBeatPrompts && Object.keys(parsedBeatPrompts).length > 0;
      out.push({
        id: typeof obj.id === 'string' && obj.id ? obj.id : `t_${out.length}`,
        user: String(obj.user ?? obj.prompt ?? ''),
        assistant: String(obj.assistant ?? obj.response ?? extractItemText(obj)),
        imageData: primaryImageData,
        ...(parsedImageList.length > 1 ? { imageList: parsedImageList } : {}),
        imageCaption:
          typeof obj.imageCaption === 'string' ? obj.imageCaption : '',
        ...(typeof obj.storyImageData === 'string' && obj.storyImageData
          ? { storyImageData: obj.storyImageData }
          : {}),
        ...(typeof obj.storyImagePrompt === 'string' && obj.storyImagePrompt
          ? { storyImagePrompt: obj.storyImagePrompt }
          : {}),
        ...(typeof obj.storyImageSubject === 'string' && obj.storyImageSubject
          ? { storyImageSubject: obj.storyImageSubject }
          : {}),
        ...(parsedStoryImages.length > 0
          ? { storyImages: parsedStoryImages }
          : {}),
        ...(hasBeatPrompts ? { storyImagePrompts: parsedBeatPrompts } : {}),
        ...(Number.isFinite(parsedCreatedAt) && parsedCreatedAt > 0
          ? { createdAt: parsedCreatedAt }
          : {}),
        ...(parsedDuration ? { durationMs: parsedDuration } : {}),
      });
      continue;
    }

    const role = String(
      obj.role || obj.sender || (obj.is_user ? 'user' : '') || '',
    ).toLowerCase();
    const text = extractItemText(obj);
    if (!text && !role) continue;

    if (role === 'user' || role === 'player' || role === 'human') {
      if (pendingUser) {
        out.push({ id: `t_${out.length}`, user: pendingUser, assistant: '' });
      }
      pendingUser = text;
    } else if (
      role === 'assistant' ||
      role === 'model' ||
      role === 'ai' ||
      role === 'narrator' ||
      role === 'char'
    ) {
      out.push({ id: `t_${out.length}`, user: pendingUser, assistant: text });
      pendingUser = '';
    } else if (text) {
      if (pendingUser) {
        out.push({ id: `t_${out.length}`, user: pendingUser, assistant: text });
        pendingUser = '';
      } else {
        out.push({ id: `t_${out.length}`, user: '', assistant: text });
      }
    }
  }
  if (pendingUser) {
    out.push({ id: `t_${out.length}`, user: pendingUser, assistant: '' });
  }
  return out;
}

export function extractTurnsFromObject(obj: unknown): Turn[] {
  if (!obj || typeof obj !== 'object') return [];
  const rec = obj as Record<string, unknown>;
  const savedState = rec.savedState as Record<string, unknown> | undefined;
  const dataObj = rec.data as Record<string, unknown> | undefined;
  const stateObj = rec.state as Record<string, unknown> | undefined;

  const candidates = [
    rec.turns,
    rec.chatTurns,
    rec.storyTurns,
    rec.messages,
    rec.chatHistory,
    rec.history,
    rec.chapters,
    rec.pages,
    rec.logs,
    rec.entries,
    savedState?.turns,
    savedState?.messages,
    savedState?.chatHistory,
    savedState?.history,
    dataObj?.turns,
    dataObj?.messages,
    dataObj?.history,
    stateObj?.turns,
    stateObj?.history,
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) {
      const turns = convertArrayToTurns(arr);
      if (turns.length) return turns;
    }
  }

  for (const k of Object.keys(rec)) {
    if (
      k === 'config' ||
      k === 'tawaPreset' ||
      k === 'safetySettings' ||
      k === 'slots'
    ) {
      continue;
    }
    const v = rec[k];
    if (v && typeof v === 'object') {
      const found = extractTurnsFromObject(v);
      if (found.length) return found;
    }
  }
  return [];
}
