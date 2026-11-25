import type { StoryClockState, Turn } from '../types/ark';
import { splitNarrativeAndMeta } from './saveParser';

const DEFAULT_STORY_YEAR = 2025;
const DEFAULT_STORY_MONTH = 6;
const DEFAULT_STORY_DAY = 15;
const DEFAULT_STORY_HOUR = 20;
const DEFAULT_STORY_MINUTE = 0;

const VI_WEEKDAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
] as const;

const EN_MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const VI_NUMBER_WORDS: Record<string, number> = {
  một: 1,
  mot: 1,
  hai: 2,
  ba: 3,
  bốn: 4,
  bon: 4,
  tư: 4,
  năm: 5,
  nam: 5,
  sáu: 6,
  sau: 6,
  bảy: 7,
  bay: 7,
  tám: 8,
  tam: 8,
  chín: 9,
  chin: 9,
  mười: 10,
  muoi: 10,
  'mười hai': 12,
  'mười lăm': 15,
  'hai mươi': 20,
  'ba mươi': 30,
  'bốn lăm': 45,
  'bốn mươi lăm': 45,
  vài: 3,
  vai: 3,
  'một vài': 3,
  nửa: 0.5,
  nua: 0.5,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  few: 3,
  several: 4,
  half: 0.5,
};

export function isLeapYear(year: number): boolean {
  const y = Math.trunc(year);
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const m = Math.min(12, Math.max(1, Math.trunc(month)));
  if (m === 2) return isLeapYear(year) ? 29 : 28;
  if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
  return 31;
}

export function createDefaultStoryClock(
  overrides?: Partial<Pick<StoryClockState, 'enabled' | 'autoAdvance'>>,
): StoryClockState {
  // Never reads computer/browser wall-clock (new Date()) for story date/time
  return {
    enabled: overrides?.enabled ?? true,
    autoAdvance: overrides?.autoAdvance ?? true,
    initialized: false,
    year: DEFAULT_STORY_YEAR,
    month: DEFAULT_STORY_MONTH,
    day: DEFAULT_STORY_DAY,
    hour: DEFAULT_STORY_HOUR,
    minute: DEFAULT_STORY_MINUTE,
  };
}

export function normalizeStoryClock(raw: unknown): StoryClockState {
  const base = createDefaultStoryClock();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;

  const rawYear =
    typeof r.year === 'number' && Number.isFinite(r.year)
      ? Math.trunc(r.year)
      : base.year;
  const year = Math.min(9999, Math.max(1, rawYear));

  const rawMonth =
    typeof r.month === 'number' && Number.isFinite(r.month)
      ? Math.trunc(r.month)
      : base.month;
  const month = Math.min(12, Math.max(1, rawMonth));

  const maxDay = daysInMonth(year, month);
  const rawDay =
    typeof r.day === 'number' && Number.isFinite(r.day)
      ? Math.trunc(r.day)
      : base.day;
  const day = Math.min(maxDay, Math.max(1, rawDay));

  const rawHour =
    typeof r.hour === 'number' && Number.isFinite(r.hour)
      ? Math.trunc(r.hour)
      : base.hour;
  const hour = ((rawHour % 24) + 24) % 24;

  const rawMinute =
    typeof r.minute === 'number' && Number.isFinite(r.minute)
      ? Math.trunc(r.minute)
      : base.minute;
  const minute = ((rawMinute % 60) + 60) % 60;

  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : base.enabled,
    autoAdvance:
      typeof r.autoAdvance === 'boolean' ? r.autoAdvance : base.autoAdvance,
    initialized:
      typeof r.initialized === 'boolean' ? r.initialized : false,
    year,
    month,
    day,
    hour,
    minute,
    ...(typeof r.eraLabel === 'string' && r.eraLabel.trim()
      ? { eraLabel: r.eraLabel.trim() }
      : {}),
    ...(typeof r.lastDeltaMinutes === 'number' &&
    Number.isFinite(r.lastDeltaMinutes)
      ? { lastDeltaMinutes: Math.max(0, Math.round(r.lastDeltaMinutes)) }
      : {}),
    ...(typeof r.lastAdvanceReason === 'string' && r.lastAdvanceReason.trim()
      ? { lastAdvanceReason: r.lastAdvanceReason.trim() }
      : {}),
    ...(typeof r.lastTurnIndex === 'number' && Number.isFinite(r.lastTurnIndex)
      ? { lastTurnIndex: Math.trunc(r.lastTurnIndex) }
      : {}),
    ...(typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt)
      ? { updatedAt: r.updatedAt }
      : {}),
  };
}

export function getVietnameseWeekday(
  year: number,
  month: number,
  day: number,
): string {
  const safeYear = Math.min(9999, Math.max(1, Math.trunc(year)));
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month)));
  const safeDay = Math.min(
    daysInMonth(safeYear, safeMonth),
    Math.max(1, Math.trunc(day)),
  );
  const utcDate = new Date(Date.UTC(2000, safeMonth - 1, safeDay));
  utcDate.setUTCFullYear(safeYear);
  return VI_WEEKDAYS[utcDate.getUTCDay()] || 'Thứ Hai';
}

const VI_THIEN_CAN = [
  'Giáp',
  'Ất',
  'Bính',
  'Đinh',
  'Mậu',
  'Kỷ',
  'Canh',
  'Tân',
  'Nhâm',
  'Quý',
] as const;

const VI_DIA_CHI = [
  'Tý',
  'Sửu',
  'Dần',
  'Mão',
  'Thìn',
  'Tỵ',
  'Ngọ',
  'Mùi',
  'Thân',
  'Dậu',
  'Tuất',
  'Hợi',
] as const;

export function getVietnameseCanChiYear(year: number): string {
  const safeYear = Math.trunc(Number.isFinite(year) ? year : DEFAULT_STORY_YEAR);
  const canIdx = (((safeYear + 6) % 10) + 10) % 10;
  const chiIdx = (((safeYear + 8) % 12) + 12) % 12;
  return `${VI_THIEN_CAN[canIdx]} ${VI_DIA_CHI[chiIdx]}`;
}

export function getVietnameseDayPeriod(hour: number): string {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h >= 4 && h <= 5) return 'Rạng sáng';
  if (h >= 6 && h <= 10) return 'Buổi sáng';
  if (h >= 11 && h <= 12) return 'Buổi trưa';
  if (h >= 13 && h <= 17) return 'Buổi chiều';
  if (h === 18) return 'Chập tối';
  if (h >= 19 && h <= 21) return 'Buổi tối';
  return 'Đêm khuya';
}

export function pad2(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, '0');
}

export function formatStoryClock(clock: StoryClockState): {
  weekday: string;
  period: string;
  dateStr: string;
  timeStr: string;
  canChiYear: string;
  eraLabel: string;
  compactLabel: string;
  fullLabel: string;
  shortDateTime: string;
  canChiDateTime: string;
} {
  const safe = normalizeStoryClock(clock);
  const weekday = getVietnameseWeekday(safe.year, safe.month, safe.day);
  const period = getVietnameseDayPeriod(safe.hour);
  const dateStr = `${pad2(safe.day)}/${pad2(safe.month)}/${String(safe.year).padStart(4, '0')}`;
  const timeStr = `${pad2(safe.hour)}:${pad2(safe.minute)}`;
  const canChiYear = getVietnameseCanChiYear(safe.year);
  const eraLabel = safe.eraLabel?.trim() || '';
  return {
    weekday,
    period,
    dateStr,
    timeStr,
    canChiYear,
    eraLabel,
    compactLabel: eraLabel
      ? `${eraLabel} · ${dateStr} · ${timeStr}`
      : `${weekday}, ${dateStr} · ${timeStr}`,
    fullLabel: eraLabel
      ? `${eraLabel} (Năm ${canChiYear} · ${weekday}, ngày ${dateStr} · ${timeStr} — ${period})`
      : `Năm ${canChiYear} · ${weekday}, ngày ${dateStr} · ${timeStr} (${period})`,
    shortDateTime: `${pad2(safe.day)}/${pad2(safe.month)}/${String(safe.year).padStart(4, '0')} · ${timeStr}`,
    canChiDateTime: `Năm ${canChiYear} (${dateStr} · ${timeStr})`,
  };
}

export function formatDeltaMinutesVi(deltaMinutes: number): string {
  const mins = Math.max(0, Math.round(deltaMinutes));
  if (mins <= 0) return '0 phút';
  if (mins < 60) return `+${mins} phút`;

  const totalDays = Math.floor(mins / (60 * 24));
  const remAfterDays = mins % (60 * 24);
  const hours = Math.floor(remAfterDays / 60);
  const remMins = remAfterDays % 60;

  if (totalDays >= 360) {
    const years = Math.floor(totalDays / 365);
    const remDaysAfterYear = totalDays - years * 365;
    const months = Math.floor(remDaysAfterYear / 30);
    const days = remDaysAfterYear - months * 30;
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} năm`);
    if (months > 0) parts.push(`${months} tháng`);
    if (days > 0 && years === 0) parts.push(`${days} ngày`);
    return `+${parts.join(' ')}`;
  }

  if (totalDays >= 28) {
    const months = Math.floor(totalDays / 30);
    const days = totalDays - months * 30;
    const parts: string[] = [];
    if (months > 0) parts.push(`${months} tháng`);
    if (days > 0) parts.push(`${days} ngày`);
    return `+${parts.join(' ')}`;
  }

  const parts: string[] = [];
  if (totalDays > 0) parts.push(`${totalDays} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (remMins > 0 && totalDays === 0) parts.push(`${remMins} phút`);
  return `+${parts.join(' ')}`;
}

/**
 * Pure Gregorian calendar addition by exact minutes.
 * Automatically rolls over hours, 23:59 -> 00:00 next day, months (28/29/30/31), and leap years.
 */
export function addMinutesToClock(
  clock: StoryClockState,
  deltaMinutes: number,
): StoryClockState {
  const safe = normalizeStoryClock(clock);
  let totalMin = Math.round(deltaMinutes);
  if (!Number.isFinite(totalMin) || totalMin === 0) return safe;

  let year = safe.year;
  let month = safe.month;
  let day = safe.day;
  let hour = safe.hour;
  let minute = safe.minute;

  const dayMinutes = hour * 60 + minute + totalMin;
  let dayCarry = Math.floor(dayMinutes / 1440);
  const remDayMinutes = ((dayMinutes % 1440) + 1440) % 1440;
  hour = Math.floor(remDayMinutes / 60);
  minute = remDayMinutes % 60;

  if (dayCarry > 0) {
    while (dayCarry > 0) {
      const dim = daysInMonth(year, month);
      const leftInMonth = dim - day;
      if (dayCarry <= leftInMonth) {
        day += dayCarry;
        dayCarry = 0;
      } else {
        dayCarry -= leftInMonth + 1;
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year = Math.min(9999, year + 1);
        }
      }
    }
  } else if (dayCarry < 0) {
    while (dayCarry < 0) {
      if (day + dayCarry >= 1) {
        day += dayCarry;
        dayCarry = 0;
      } else {
        dayCarry += day;
        month -= 1;
        if (month < 1) {
          month = 12;
          year = Math.max(1, year - 1);
        }
        day = daysInMonth(year, month);
      }
    }
  }

  return {
    ...safe,
    year,
    month,
    day,
    hour,
    minute,
  };
}

export function addDaysToClock(
  clock: StoryClockState,
  deltaDays: number,
  overrideTime?: { hour: number; minute: number },
): StoryClockState {
  const shifted = addMinutesToClock(clock, Math.trunc(deltaDays) * 1440);
  if (!overrideTime) return shifted;
  return normalizeStoryClock({
    ...shifted,
    hour: overrideTime.hour,
    minute: overrideTime.minute,
  });
}

export function addMonthsToClock(
  clock: StoryClockState,
  deltaMonths: number,
): StoryClockState {
  const safe = normalizeStoryClock(clock);
  const totalMonths = safe.year * 12 + (safe.month - 1) + Math.trunc(deltaMonths);
  const nextYear = Math.min(9999, Math.max(1, Math.floor(totalMonths / 12)));
  const nextMonth = ((totalMonths % 12) + 12) % 12 + 1;
  const maxDay = daysInMonth(nextYear, nextMonth);
  return {
    ...safe,
    year: nextYear,
    month: nextMonth,
    day: Math.min(safe.day, maxDay),
  };
}

export function addYearsToClock(
  clock: StoryClockState,
  deltaYears: number,
): StoryClockState {
  const safe = normalizeStoryClock(clock);
  const nextYear = Math.min(9999, Math.max(1, safe.year + Math.trunc(deltaYears)));
  const maxDay = daysInMonth(nextYear, safe.month);
  return {
    ...safe,
    year: nextYear,
    day: Math.min(safe.day, maxDay),
  };
}

export function clockToEpochMinutes(clock: StoryClockState): number {
  const safe = normalizeStoryClock(clock);
  const utcMs = Date.UTC(2000, safe.month - 1, safe.day, safe.hour, safe.minute);
  const d = new Date(utcMs);
  d.setUTCFullYear(safe.year);
  return Math.floor(d.getTime() / 60000);
}

function stripThinkingForTimeScan(raw: string): string {
  const safeRaw = String(raw ?? '');
  if (!safeRaw) return '';
  let text = String(splitNarrativeAndMeta(safeRaw, false).mainText ?? '');
  if (!text.trim()) {
    text = safeRaw
      .replace(
        /<(?:thinking|thought|reasoning|analysis|plan|outline|draft|scratchpad|cot|preset|system|meta)\b[^>]*>[\s\S]*?<\/(?:thinking|thought|reasoning|analysis|plan|outline|draft|scratchpad|cot|preset|system|meta)\s*>/gi,
        ' ',
      )
      .replace(/<\/?[a-zA-Z][\w-]*[^>]*>/g, ' ');
  }
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function parseNumericToken(token: string): number | null {
  const cleaned = String(token ?? '').trim().toLowerCase().replace(',', '.');
  if (!cleaned) return null;
  const direct = Number(cleaned);
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (cleaned in VI_NUMBER_WORDS) return VI_NUMBER_WORDS[cleaned];
  return null;
}

export interface ExtractedDateTime {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
}

/**
 * Extracts explicit calendar dates and/or clock times from clean story text.
 * Supports Vietnamese & English formats (e.g., "ngày 14 tháng 8 năm 2025", "14/08/2025", "August 14, 2025", "22:30", "10 giờ 15 tối", "1 giờ rưỡi sáng").
 */
export function extractExplicitDateTimeFromText(
  cleanText: string,
  preferLastTime = false,
): ExtractedDateTime | null {
  if (!cleanText || !cleanText.trim()) return null;
  const text = cleanText;
  const out: ExtractedDateTime = {};

  // 1. Explicit full Vietnamese date: "ngày 14 tháng 8 năm 2025" or "ngày 14/08/2025"
  const viFullDate =
    /(?:ngày|ngay)\s*(\d{1,2})\s*(?:tháng|thang|\/|-)\s*(\d{1,2})(?:\s*(?:năm|nam|\/|-)\s*(\d{4}))?/gi;
  let m: RegExpExecArray | null;
  let lastDateMatch: { day: number; month: number; year?: number } | null = null;
  while ((m = viFullDate.exec(text)) !== null) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = m[3] ? Number(m[3]) : undefined;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && (!y || (y >= 1000 && y <= 2999))) {
      lastDateMatch = { day: d, month: mo, year: y };
      if (!preferLastTime) break;
    }
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  if (!lastDateMatch) {
    const slashDate = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g;
    while ((m = slashDate.exec(text)) !== null) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const y = Number(m[3]);
      if (y >= 1000 && y <= 2999) {
        if (b >= 1 && b <= 12 && a >= 1 && a <= 31) {
          lastDateMatch = { day: a, month: b, year: y };
          if (!preferLastTime) break;
        } else if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
          lastDateMatch = { day: b, month: a, year: y };
          if (!preferLastTime) break;
        }
      }
    }
  }

  // 3. ISO YYYY-MM-DD
  if (!lastDateMatch) {
    const isoDate = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
    while ((m = isoDate.exec(text)) !== null) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (y >= 1000 && y <= 2999 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        lastDateMatch = { day: d, month: mo, year: y };
        if (!preferLastTime) break;
      }
    }
  }

  // 4. English Month DD, YYYY
  if (!lastDateMatch) {
    const enDate =
      /\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;
    while ((m = enDate.exec(text)) !== null) {
      const mo = EN_MONTH_MAP[m[1].toLowerCase()];
      const d = Number(m[2]);
      const y = m[3] ? Number(m[3]) : undefined;
      if (mo && d >= 1 && d <= 31 && (!y || (y >= 1000 && y <= 2999))) {
        lastDateMatch = { day: d, month: mo, year: y };
        if (!preferLastTime) break;
      }
    }
  }

  if (lastDateMatch) {
    out.day = lastDateMatch.day;
    out.month = lastDateMatch.month;
    if (lastDateMatch.year) out.year = lastDateMatch.year;
  } else {
    // Month + Year only (e.g. "tháng 8 năm 2025")
    const moYear = /(?:tháng|thang)\s*(\d{1,2})\s*(?:năm|nam)\s*(\d{4})/i.exec(text);
    if (moYear) {
      const mo = Number(moYear[1]);
      const y = Number(moYear[2]);
      if (mo >= 1 && mo <= 12 && y >= 1000 && y <= 2999) {
        out.month = mo;
        out.year = y;
      }
    } else {
      const yearOnly = /\b(?:năm|year)\s+(\d{4})\b/i.exec(text);
      if (yearOnly) {
        const y = Number(yearOnly[1]);
        if (y >= 1000 && y <= 2999) out.year = y;
      }
    }
  }

  // 5. Explicit clock times: "22:30", "10:15 PM", "9 giờ 20 phút tối", "1 giờ rưỡi sáng", "10h30 tối"
  const foundTimes: Array<{ hour: number; minute: number }> = [];

  const colonTime =
    /\b([01]?\d|2[0-3]):([0-5]\d)\s*(AM|PM|a\.m\.|p\.m\.|sáng|trưa|chiều|tối|đêm|khuya|rạng sáng)?\b/gi;
  while ((m = colonTime.exec(text)) !== null) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const mer = (m[3] || '').toLowerCase();
    if (mer === 'pm' || mer === 'p.m.' || mer === 'chiều' || mer === 'tối' || mer === 'đêm') {
      if (h >= 1 && h <= 11) h += 12;
    } else if (mer === 'am' || mer === 'a.m.' || mer === 'sáng' || mer === 'rạng sáng' || mer === 'khuya') {
      if (h === 12) h = 0;
    }
    foundTimes.push({ hour: h, minute: min });
  }

  const viTime =
    /\b(\d{1,2})\s*(?:giờ|gio|h)\s*(?:(rưỡi|ruoi)|(\d{1,2})\s*(?:phút|phut|p)?)?\s*(rạng sáng|sáng|trưa|chiều|tối|đêm|khuya)?\b/gi;
  while ((m = viTime.exec(text)) !== null) {
    // Avoid matching duration phrases like "2 giờ sau" / "3 giờ trôi qua"
    const afterSlice = text.slice(m.index + m[0].length, m.index + m[0].length + 14);
    if (/^\s*(?:sau|trôi qua|nữa|liền|đồng hồ|liên tục)/i.test(afterSlice)) {
      continue;
    }
    let h = Number(m[1]);
    if (h < 0 || h > 23) continue;
    const min = m[2] ? 30 : m[3] ? Number(m[3]) : 0;
    if (min < 0 || min > 59) continue;
    const period = (m[4] || '').toLowerCase();
    if (period === 'chiều' || period === 'tối') {
      if (h >= 1 && h <= 11) h += 12;
    } else if (period === 'đêm') {
      if (h >= 7 && h <= 11) h += 12;
      else if (h === 12) h = 0;
    } else if (period === 'trưa') {
      if (h >= 1 && h <= 2) h += 12;
    } else if (period === 'sáng' || period === 'rạng sáng' || period === 'khuya') {
      if (h === 12) h = 0;
    } else if (!m[2] && !m[3] && !period) {
      // Bare "2 giờ" without minutes or period is too ambiguous (often a duration)
      continue;
    }
    foundTimes.push({ hour: h, minute: min });
  }

  if (foundTimes.length > 0) {
    const chosen = preferLastTime
      ? foundTimes[foundTimes.length - 1]
      : foundTimes[0];
    out.hour = chosen.hour;
    out.minute = chosen.minute;
  }

  if (
    out.year === undefined &&
    out.month === undefined &&
    out.day === undefined &&
    out.hour === undefined &&
    out.minute === undefined
  ) {
    return null;
  }
  return out;
}

interface ExplicitSkipResult {
  nextClock: StoryClockState;
  deltaMinutes: number;
  reason: string;
}

function detectExplicitTimeSkip(
  baseClock: StoryClockState,
  userText: string,
  storyText: string,
): ExplicitSkipResult | null {
  const sources = [
    { text: userText, label: 'lượt gọi' },
    { text: storyText, label: 'diễn biến' },
  ];

  const numPattern =
    '(\\d+(?:[.,]\\d+)?|một vài|mười lăm|mười hai|hai mươi|ba mươi|bốn mươi lăm|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|vài|nửa|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|few|several|half)';

  for (const src of sources) {
    const t = src.text;
    if (!t) continue;

    // 1. Years skip
    const yearRe = new RegExp(
      `\\b${numPattern}\\s+(?:năm|years?)\\s+(?:sau|trôi qua|nữa|kế tiếp|later)\\b`,
      'i',
    );
    const ym = yearRe.exec(t);
    if (ym) {
      const val = parseNumericToken(ym[1]);
      if (val && val > 0 && val <= 100) {
        const nextClock =
          val < 1
            ? addMonthsToClock(baseClock, Math.round(val * 12))
            : addYearsToClock(baseClock, Math.round(val));
        const delta = Math.max(
          1,
          clockToEpochMinutes(nextClock) - clockToEpochMinutes(baseClock),
        );
        return {
          nextClock,
          deltaMinutes: delta,
          reason: `Bước nhảy thời gian (${ym[0].trim()})`,
        };
      }
    }

    // 2. Months skip
    const monthRe = new RegExp(
      `\\b${numPattern}\\s+(?:tháng|months?)\\s+(?:sau|trôi qua|nữa|kế tiếp|later)\\b`,
      'i',
    );
    const mom = monthRe.exec(t);
    if (mom) {
      const val = parseNumericToken(mom[1]);
      if (val && val > 0 && val <= 120) {
        const nextClock =
          val < 1
            ? addDaysToClock(baseClock, Math.round(val * 30))
            : addMonthsToClock(baseClock, Math.round(val));
        const delta = Math.max(
          1,
          clockToEpochMinutes(nextClock) - clockToEpochMinutes(baseClock),
        );
        return {
          nextClock,
          deltaMinutes: delta,
          reason: `Bước nhảy thời gian (${mom[0].trim()})`,
        };
      }
    }

    // 3. Weeks skip
    const weekRe = new RegExp(
      `\\b${numPattern}\\s+(?:tuần|weeks?)\\s+(?:sau|trôi qua|nữa|kế tiếp|later)\\b`,
      'i',
    );
    const wm = weekRe.exec(t);
    if (wm) {
      const val = parseNumericToken(wm[1]);
      if (val && val > 0 && val <= 52) {
        const days = Math.max(1, Math.round(val * 7));
        const nextClock = addDaysToClock(baseClock, days);
        return {
          nextClock,
          deltaMinutes: days * 1440,
          reason: `Bước nhảy thời gian (${wm[0].trim()})`,
        };
      }
    }

    // 4. Days skip ("3 ngày sau", "2 hôm sau", "2 days later")
    const dayRe = new RegExp(
      `\\b${numPattern}\\s+(?:ngày|hôm|days?)\\s+(?:sau|trôi qua|nữa|kế tiếp|later)\\b`,
      'i',
    );
    const dm = dayRe.exec(t);
    if (dm) {
      const val = parseNumericToken(dm[1]);
      if (val && val > 0 && val <= 365) {
        const days = Math.max(1, Math.round(val));
        const nextClock = addDaysToClock(baseClock, days);
        return {
          nextClock,
          deltaMinutes: days * 1440,
          reason: `Bước nhảy thời gian (${dm[0].trim()})`,
        };
      }
    }

    // 5. Next day / overnight skip ("sáng hôm sau", "ngày hôm sau", "ngủ qua đêm", "the next morning")
    const nextDayRe =
      /\b(?:(rạng sáng|sáng|trưa|chiều|tối|đêm)\s+)?(?:hôm sau|ngày hôm sau|hôm kế tiếp|ngày kế tiếp|the next (?:morning|afternoon|evening|night|day)|next morning|next day|following morning)\b|\b(?:ngủ qua đêm|qua một đêm|ngủ đến sáng|tỉnh dậy vào sáng hôm sau)\b/i;
    const ndm = nextDayRe.exec(t);
    if (ndm) {
      const periodHint = (ndm[1] || ndm[0]).toLowerCase();
      let targetHour = 8;
      let targetMinute = 0;
      if (/rạng sáng/.test(periodHint)) {
        targetHour = 5;
        targetMinute = 30;
      } else if (/sáng|morning/.test(periodHint)) {
        targetHour = 8;
        targetMinute = 0;
      } else if (/trưa/.test(periodHint)) {
        targetHour = 12;
        targetMinute = 0;
      } else if (/chiều|afternoon/.test(periodHint)) {
        targetHour = 14;
        targetMinute = 30;
      } else if (/tối|evening/.test(periodHint)) {
        targetHour = 19;
        targetMinute = 30;
      } else if (/đêm|night/.test(periodHint)) {
        targetHour = 22;
        targetMinute = 0;
      }
      // If it's already very early morning (00:00–04:59) and story says "ngủ đến sáng", stay on same calendar day at 08:00
      const sameDayMorning =
        /ngủ đến sáng|ngủ qua đêm|qua một đêm/i.test(ndm[0]) &&
        baseClock.hour >= 0 &&
        baseClock.hour <= 4;
      const nextClock = sameDayMorning
        ? normalizeStoryClock({
            ...baseClock,
            hour: targetHour,
            minute: targetMinute,
          })
        : addDaysToClock(baseClock, 1, {
            hour: targetHour,
            minute: targetMinute,
          });
      const delta = Math.max(
        60,
        clockToEpochMinutes(nextClock) - clockToEpochMinutes(baseClock),
      );
      return {
        nextClock,
        deltaMinutes: delta,
        reason: `Chuyển sang ${ndm[0].trim()}`,
      };
    }

    // 6. Hours skip ("2 tiếng sau", "nửa tiếng sau", "1 giờ rưỡi sau")
    const hourRe = new RegExp(
      `\\b${numPattern}\\s+(?:tiếng|giờ|hours?)\\s*(rưỡi|ruoi)?\\s*(?:sau|trôi qua|nữa|later)\\b`,
      'i',
    );
    const hm = hourRe.exec(t);
    if (hm) {
      const baseVal = parseNumericToken(hm[1]);
      if (baseVal && baseVal > 0 && baseVal <= 48) {
        const hours = baseVal + (hm[2] ? 0.5 : 0);
        const mins = Math.max(15, Math.round(hours * 60));
        return {
          nextClock: addMinutesToClock(baseClock, mins),
          deltaMinutes: mins,
          reason: `Trôi qua ${hm[0].trim()}`,
        };
      }
    }

    // 7. Minutes skip ("15 phút sau", "20 minutes later")
    const minRe = new RegExp(
      `\\b${numPattern}\\s+(?:phút|minutes?|mins?)\\s+(?:sau|trôi qua|nữa|later)\\b`,
      'i',
    );
    const mm = minRe.exec(t);
    if (mm) {
      const val = parseNumericToken(mm[1]);
      if (val && val > 0 && val <= 360) {
        const mins = Math.max(2, Math.round(val));
        return {
          nextClock: addMinutesToClock(baseClock, mins),
          deltaMinutes: mins,
          reason: `Trôi qua ${mm[0].trim()}`,
        };
      }
    }
  }

  return null;
}

/**
 * Estimates natural elapsed minutes for continuous gameplay turns (dialogue, phone calls, actions, movements)
 * so time progresses smoothly instead of freezing or jumping erratically.
 */
function estimateContinuousSceneMinutes(
  userText: string,
  storyText: string,
): { minutes: number; reason: string } {
  const combined = `${userText}\n${storyText}`.trim();
  const words = combined ? combined.split(/\s+/).filter(Boolean).length : 0;

  // Count dialogue exchanges (quoted spans & em-dash dialogue lines)
  const quoteMatches = storyText.match(/["“«][^"”»]{4,}["”»]/g) || [];
  const dashLines = storyText.match(/(?:^|\n)\s*[—–-]\s+[^\n]{4,}/g) || [];
  const dialogueCount = quoteMatches.length + dashLines.length;

  // Base continuous dialogue / narration pacing
  // ~130 words of rich prose ≈ 1 minute, plus ~0.75 minute per spoken exchange
  let minutes = Math.max(
    3,
    Math.min(18, Math.round(words / 135) + Math.round(dialogueCount * 0.75) + 2),
  );

  const activities: string[] = [];
  const lower = combined.toLowerCase();

  // Check natural scene activities
  if (
    /(?:gọi điện|cuộc gọi|bắt máy|nghe máy|facetime|call|điện thoại reo|nói chuyện điện thoại)/i.test(
      lower,
    )
  ) {
    minutes += Math.min(10, 4 + Math.round(dialogueCount * 0.4));
    activities.push('gọi điện');
  }
  if (
    /(?:lái xe|lên xe|ngồi xe|taxi|uber|di chuyển tới|đến nhà|về nhà|tới quán|tới câu lạc bộ|đến biệt thự|ra sân bay|rời khỏi)/i.test(
      lower,
    )
  ) {
    minutes += 14;
    activities.push('di chuyển');
  }
  if (
    /(?:ăn tối|ăn trưa|ăn sáng|dùng bữa|uống rượu|nhâm nhi|pha trà|cà phê|bữa tiệc|tiệc tùng|quán bar|khiêu vũ)/i.test(
      lower,
    )
  ) {
    minutes += 12;
    activities.push('ăn uống / tiệc');
  }
  if (
    /(?:tắm rửa|vào phòng tắm|thay đồ|thay trang phục|trang điểm|chỉnh trang|chuẩn bị xong)/i.test(
      lower,
    )
  ) {
    minutes += 10;
    activities.push('chuẩn bị');
  }
  if (
    /(?:một lát sau|một lúc sau|ít phút sau|lát sau|chốc lát sau|a while later|moments later)/i.test(
      lower,
    )
  ) {
    minutes += 8;
  }

  // Keep continuous unskipped scene turns realistic (3 to 45 minutes)
  const clamped = Math.max(3, Math.min(45, Math.round(minutes)));

  let reason = 'Diễn biến liên tục';
  if (activities.length > 0) {
    reason =
      dialogueCount >= 3
        ? `Đối thoại & ${activities.slice(0, 2).join(', ')}`
        : `Hành động (${activities.slice(0, 2).join(', ')})`;
  } else if (dialogueCount >= 6) {
    reason = 'Trò chuyện kéo dài';
  } else if (dialogueCount >= 2) {
    reason = 'Đối thoại liên tục';
  } else if (words >= 800) {
    reason = 'Cảnh diễn biến chi tiết';
  }

  return { minutes: clamped, reason };
}

export function advanceStoryClockFromTurn(
  prevClockInput: StoryClockState | undefined,
  options: {
    userText: string;
    assistantText: string;
    turnIndex: number;
    worldHint?: string;
  },
): {
  nextClock: StoryClockState;
  deltaMinutes: number;
  reason: string;
} {
  let baseClock = normalizeStoryClock(prevClockInput);
  const cleanUser = stripThinkingForTimeScan(options.userText || '');
  const cleanAi = stripThinkingForTimeScan(options.assistantText || '');
  const cleanWorld = (options.worldHint || '').trim();

  // 1. If clock has never been initialized yet, scan world setting + turn text for an explicit anchor date/time
  if (!baseClock.initialized) {
    const anchorFromTurn =
      extractExplicitDateTimeFromText(`${cleanUser}\n${cleanAi}`, false) ||
      extractExplicitDateTimeFromText(cleanWorld, false);
    if (anchorFromTurn) {
      baseClock = normalizeStoryClock({
        ...baseClock,
        initialized: true,
        year: anchorFromTurn.year ?? baseClock.year,
        month: anchorFromTurn.month ?? baseClock.month,
        day: anchorFromTurn.day ?? baseClock.day,
        hour: anchorFromTurn.hour ?? baseClock.hour,
        minute: anchorFromTurn.minute ?? baseClock.minute,
      });
    } else {
      baseClock = {
        ...baseClock,
        initialized: true,
      };
    }
  }

  // 2. Check explicit time skip ("2 tiếng sau", "sáng hôm sau", "3 ngày sau", etc.)
  const explicitSkip = detectExplicitTimeSkip(baseClock, cleanUser, cleanAi);
  if (explicitSkip) {
    const nextClock: StoryClockState = {
      ...explicitSkip.nextClock,
      initialized: true,
      lastDeltaMinutes: explicitSkip.deltaMinutes,
      lastAdvanceReason: explicitSkip.reason,
      lastTurnIndex: options.turnIndex,
      updatedAt: Date.now(),
    };
    return {
      nextClock,
      deltaMinutes: explicitSkip.deltaMinutes,
      reason: explicitSkip.reason,
    };
  }

  // 3. Check if the turn explicitly mentions a newer clock time near the end of the scene (e.g. "00:35", "1 giờ 15 sáng")
  const explicitEnd = extractExplicitDateTimeFromText(
    `${cleanUser}\n${cleanAi}`,
    true,
  );
  if (explicitEnd && explicitEnd.hour !== undefined) {
    const targetH = explicitEnd.hour;
    const targetM = explicitEnd.minute ?? 0;

    // If an explicit calendar date was also stated and is >= current date, move to it cleanly
    if (explicitEnd.day !== undefined && explicitEnd.month !== undefined) {
      const candidate = normalizeStoryClock({
        ...baseClock,
        initialized: true,
        year: explicitEnd.year ?? baseClock.year,
        month: explicitEnd.month,
        day: explicitEnd.day,
        hour: targetH,
        minute: targetM,
      });
      const diff =
        clockToEpochMinutes(candidate) - clockToEpochMinutes(baseClock);
      if (diff >= 1 && diff <= 60 * 24 * 365 * 5) {
        const nextClock: StoryClockState = {
          ...candidate,
          lastDeltaMinutes: diff,
          lastAdvanceReason: `Đồng bộ theo mốc trong truyện (${pad2(targetH)}:${pad2(targetM)})`,
          lastTurnIndex: options.turnIndex,
          updatedAt: Date.now(),
        };
        return {
          nextClock,
          deltaMinutes: diff,
          reason: nextClock.lastAdvanceReason || 'Đồng bộ theo mốc truyện',
        };
      }
    }

    // Compare time-of-day forward (supports natural midnight rollover like 23:40 -> 00:25 = +45p)
    const curDayMins = baseClock.hour * 60 + baseClock.minute;
    const targetDayMins = targetH * 60 + targetM;
    let forwardDiff = targetDayMins - curDayMins;
    if (forwardDiff < 0) {
      forwardDiff += 1440;
    }
    // Accept natural forward alignment up to 12 hours ahead
    if (forwardDiff >= 1 && forwardDiff <= 12 * 60) {
      const nextClock: StoryClockState = {
        ...addMinutesToClock(baseClock, forwardDiff),
        initialized: true,
        lastDeltaMinutes: forwardDiff,
        lastAdvanceReason: `Theo mốc giờ trong cảnh (${pad2(targetH)}:${pad2(targetM)})`,
        lastTurnIndex: options.turnIndex,
        updatedAt: Date.now(),
      };
      return {
        nextClock,
        deltaMinutes: forwardDiff,
        reason: nextClock.lastAdvanceReason || 'Theo mốc giờ trong cảnh',
      };
    }
  }

  // 4. Continuous scene / dialogue / action progression (never frozen, never absurd jump)
  const continuous = estimateContinuousSceneMinutes(cleanUser, cleanAi);
  const nextClock: StoryClockState = {
    ...addMinutesToClock(baseClock, continuous.minutes),
    initialized: true,
    lastDeltaMinutes: continuous.minutes,
    lastAdvanceReason: continuous.reason,
    lastTurnIndex: options.turnIndex,
    updatedAt: Date.now(),
  };
  return {
    nextClock,
    deltaMinutes: continuous.minutes,
    reason: continuous.reason,
  };
}

/**
 * Reconciles an optional AI-reported elapsed duration or explicit clock time against the pre-turn clock
 * so AI Memory/State Sync can refine timing without ever double-counting or moving backwards.
 */
export function reconcileAiClockUpdate(
  preTurnClock: StoryClockState,
  aiUpdate: {
    elapsedMinutes?: number;
    explicitTime?: string;
    note?: string;
  },
  turnIndex: number,
): StoryClockState | null {
  const base = normalizeStoryClock(preTurnClock);

  if (typeof aiUpdate.explicitTime === 'string' && aiUpdate.explicitTime.trim()) {
    const tm = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(aiUpdate.explicitTime.trim());
    if (tm) {
      const h = Number(tm[1]);
      const m = Number(tm[2]);
      const curDayMins = base.hour * 60 + base.minute;
      const targetDayMins = h * 60 + m;
      let diff = targetDayMins - curDayMins;
      if (diff < 0) diff += 1440;
      if (diff >= 1 && diff <= 14 * 60) {
        return {
          ...addMinutesToClock(base, diff),
          initialized: true,
          lastDeltaMinutes: diff,
          lastAdvanceReason:
            aiUpdate.note?.trim() || `AI xác nhận mốc ${pad2(h)}:${pad2(m)}`,
          lastTurnIndex: turnIndex,
          updatedAt: Date.now(),
        };
      }
    }
  }

  if (
    typeof aiUpdate.elapsedMinutes === 'number' &&
    Number.isFinite(aiUpdate.elapsedMinutes) &&
    aiUpdate.elapsedMinutes >= 1 &&
    aiUpdate.elapsedMinutes <= 60 * 24 * 365
  ) {
    const mins = Math.round(aiUpdate.elapsedMinutes);
    return {
      ...addMinutesToClock(base, mins),
      initialized: true,
      lastDeltaMinutes: mins,
      lastAdvanceReason:
        aiUpdate.note?.trim() || `AI ước lượng trôi ${formatDeltaMinutesVi(mins)}`,
      lastTurnIndex: turnIndex,
      updatedAt: Date.now(),
    };
  }

  return null;
}

/**
 * Best-effort initialization for legacy imported saves that lack a saved storyClock.
 * Scans existing turns chronologically for explicit dates/times (never uses system clock).
 */
export function inferStoryClockFromLegacyTurns(
  turns: Turn[],
  worldHint?: string,
  baseOverrides?: Partial<Pick<StoryClockState, 'enabled' | 'autoAdvance'>>,
): StoryClockState {
  let clock = createDefaultStoryClock(baseOverrides);
  if (!Array.isArray(turns) || turns.length === 0) return clock;

  // Scan up to the last 20 turns so import stays instantaneous
  const startIdx = Math.max(0, turns.length - 20);
  for (let i = startIdx; i < turns.length; i++) {
    const t = turns[i];
    if (!t) continue;
    const step = advanceStoryClockFromTurn(clock, {
      userText: t.user || '',
      assistantText: t.assistant || '',
      turnIndex: i,
      worldHint: i === startIdx ? worldHint : undefined,
    });
    clock = step.nextClock;
  }
  return clock;
}
