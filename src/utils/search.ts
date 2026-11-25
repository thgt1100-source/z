export function normalizeVietnamese(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const lowerHaystack = String(haystack || '').toLowerCase();
  const lowerQ = q.toLowerCase();
  if (lowerHaystack.includes(lowerQ)) return true;
  return normalizeVietnamese(haystack).includes(normalizeVietnamese(q));
}

export function findMatchRanges(
  text: string,
  query: string,
): Array<[number, number]> {
  const q = query.trim();
  if (!q || !text) return [];

  // Build accent-stripped string alongside index map back to original string indices
  const chars = Array.from(text);
  let normStr = '';
  const origIdxMap: number[] = [];
  let charOffset = 0;

  for (const ch of chars) {
    const folded = ch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
    for (let k = 0; k < folded.length; k++) {
      normStr += folded[k];
      origIdxMap.push(charOffset);
    }
    charOffset += ch.length;
  }
  origIdxMap.push(text.length);

  const normQ = normalizeVietnamese(q);
  if (!normQ) return [];

  const ranges: Array<[number, number]> = [];
  let searchFrom = 0;
  while (searchFrom <= normStr.length - normQ.length) {
    const found = normStr.indexOf(normQ, searchFrom);
    if (found === -1) break;
    const start = origIdxMap[found];
    const end = origIdxMap[found + normQ.length] ?? text.length;
    if (end > start) {
      ranges.push([start, end]);
    }
    searchFrom = found + normQ.length;
  }

  return ranges;
}

export function extractMatchSnippet(
  text: string,
  query: string,
  radius = 48,
): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const ranges = findMatchRanges(clean, query);
  if (!ranges.length) return clean.slice(0, radius * 2);

  const [start, end] = ranges[0];
  const sliceStart = Math.max(0, start - radius);
  const sliceEnd = Math.min(clean.length, end + radius);
  const prefix = sliceStart > 0 ? '…' : '';
  const suffix = sliceEnd < clean.length ? '…' : '';
  return `${prefix}${clean.slice(sliceStart, sliceEnd)}${suffix}`;
}
