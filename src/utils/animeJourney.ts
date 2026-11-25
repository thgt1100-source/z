import type {
  AnimeJourneyPack,
  CompanionNpc,
  CompanionProfile,
} from '../types/ark';
import { ensureInCharacterCausalityRule } from './companionPresets';
import { repairTruncatedJson } from './saveParser';

export const ANIME_JOURNEY_TIMEOUT_MS = 40_000;
export const MAX_SAVED_ANIME_JOURNEYS = 24;

export const POPULAR_ANIME_SUGGESTIONS: string[] = [
  'Frieren: Pháp Sư Tiễn Táng',
  'Jujutsu Kaisen',
  'Attack on Titan',
  'Naruto',
  'One Piece',
  'Kimetsu no Yaiba',
  'Chainsaw Man',
  'Re:Zero',
  'Bleach',
  'Hunter x Hunter',
];

export function normalizeAnimeKey(title: string): string {
  return String(title || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildAnimeJourneyPrompt(
  animeTitle: string,
  creativeHint?: string,
): string {
  const cleanTitle = animeTitle.trim();
  const shortHint = (creativeHint || '').trim().slice(0, 220);

  return (
    `Hãy dựng gói "Hành trình & Chơi lại" Đồng Nhân cho anime "${cleanTitle}".\n` +
    'CHỈ trả về ĐÚNG 1 đối tượng JSON hợp lệ bằng tiếng Việt (không giải thích ngoài JSON). YÊU CẦU NGẮN GỌN: mỗi trường chỉ 1–2 câu súc tích để phản hồi nhanh.\n' +
    '{\n' +
    `  "animeTitle": "${cleanTitle}",\n` +
    '  "canonMcName": "Tên nhân vật chính nguyên tác",\n' +
    '  "toneAndAtmosphere": "1-2 câu về văn phong, nhịp kể & không khí đặc trưng đúng chất bộ anime này",\n' +
    '  "worldSetting": "1-2 câu bối cảnh chính, phe phái & xung đột cốt lõi của bộ anime",\n' +
    '  "worldRules": "1-2 câu hệ thống sức mạnh/luật thế giới + quy tắc In-Character & cơ chế đánh đổi Được-Mất (chống NVC toàn năng vô lý)",\n' +
    '  "journeyMilestones": [\n' +
    '    "Chặng 1 — [Tên mốc mở đầu]: [Mục tiêu/biến cố ngắn gọn]",\n' +
    '    "Chặng 2 — [Tên mốc thử thách]: [Bước ngoặt & leo thang ngắn gọn]",\n' +
    '    "Chặng 3 — [Tên mốc bước ngoặt]: [Xung đột lớn & lựa chọn đánh đổi]",\n' +
    '    "Chặng 4 — [Tên mốc cao trào]: [Kết cục mở cho phép chơi lại hướng khác]"\n' +
    '  ],\n' +
    '  "divergencePoints": [\n' +
    '    "Điểm rẽ nhánh 1 (1 câu): [Mốc nguyên tác] -> [Biến số bẻ lái]",\n' +
    '    "Điểm rẽ nhánh 2 (1 câu): [Mốc nguyên tác] -> [Biến số bẻ lái]"\n' +
    '  ],\n' +
    '  "creativeDirection": "1-2 câu định hướng chơi lại theo hành trình, giữ In-Character và có cái giá rõ ràng",\n' +
    '  "npcs": [\n' +
    '    {"name":"Tên NPC quen thuộc","role":"Vai trò","personality":"1 câu","agenda":"Động cơ riêng (1 câu)","friction":"Điểm xung đột/ma sát với NVC (1 câu)","desc":"1 câu ngắn"}\n' +
    '  ]\n' +
    '}\n' +
    'Bắt buộc: đúng 3–4 mốc journeyMilestones có tiến triển rõ; 1–2 divergencePoints sát nguyên tác; 2–3 NPC đặc trưng có agenda & friction riêng (không tự động tin phục NVC).' +
    (shortHint ? `\nĐịnh hướng sáng tạo ưu tiên: ${shortHint}` : '')
  );
}

function cleanStringList(input: unknown, maxItems: number): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  if (typeof input === 'string' && input.trim()) {
    return input
      .split(/\r?\n+/)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  return [];
}

function cleanPackNpcs(input: unknown, seedTs: number): CompanionNpc[] {
  if (!Array.isArray(input)) return [];
  const out: CompanionNpc[] = [];
  for (let i = 0; i < input.length && out.length < 4; i++) {
    const raw = input[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') continue;
    const name = String(raw.name || '').trim();
    if (!name) continue;
    const role = String(raw.role || 'Nhân vật nguyên tác').trim();
    const personality = String(raw.personality || '').trim();
    const appearance = String(raw.appearance || '').trim();
    const relationships = String(raw.relationships || '').trim();
    const agenda = String(raw.agenda || '').trim();
    const friction = String(raw.friction || '').trim();
    const baseDesc = String(raw.desc || '').trim();
    const desc =
      baseDesc ||
      [personality, agenda ? `Động cơ: ${agenda}` : '']
        .filter(Boolean)
        .join(' | ');
    out.push({
      id: `anime_npc_${seedTs}_${i}`,
      name,
      role,
      desc,
      ...(personality ? { personality } : {}),
      ...(appearance ? { appearance } : {}),
      ...(relationships ? { relationships } : {}),
      ...(agenda ? { agenda } : {}),
      ...(friction ? { friction } : {}),
    });
  }
  return out;
}

export function ensureAntiOpTradeoffRule(
  worldRules: string,
  animeTitle: string,
): string {
  let rules = ensureInCharacterCausalityRule(worldRules, animeTitle);
  const hasTradeoff =
    /đánh đổi|cái giá|giới hạn|chống toàn năng|không toàn năng|trả giá/i.test(
      rules,
    );
  if (!hasTradeoff) {
    const addition =
      '- Quy tắc Đánh Đổi & Giới Hạn (Chống Toàn Năng): NVC không tự động thắng áp đảo hay được NPC tin phục vô điều kiện; mọi can thiệp lớn hoặc bứt phá sức mạnh đều phải trả giá bằng tài nguyên, thể lực, quan hệ hoặc dư chấn thế cục.';
    rules = rules ? `${rules}\n${addition}` : addition;
  }
  return rules;
}

export function parseAnimeJourneyResponse(
  rawText: string,
  fallbackTitle: string,
): AnimeJourneyPack | null {
  if (!rawText || !rawText.trim()) return null;

  let cleaned = String(rawText)
    .replace(/<(thinking|thought|reasoning|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .trim();

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fence && fence[1]) {
    cleaned = fence[1].trim();
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace < 0) return null;
  cleaned =
    lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned.slice(firstBrace);

  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    try {
      obj = JSON.parse(repairTruncatedJson(cleaned)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;

  const nowTs = Date.now();
  const nowIso = new Date(nowTs).toISOString();
  const animeTitle = String(obj.animeTitle || fallbackTitle || '').trim();
  if (!animeTitle) return null;

  const toneAndAtmosphere = String(
    obj.toneAndAtmosphere || obj.tone || obj.atmosphere || '',
  ).trim();
  const worldSetting = String(obj.worldSetting || '').trim();
  const rawRules = String(obj.worldRules || '').trim();
  const journeyMilestones = cleanStringList(
    obj.journeyMilestones || obj.milestones || obj.journey,
    4,
  );
  const divergencePoints = cleanStringList(obj.divergencePoints, 3);
  const creativeDirection = String(obj.creativeDirection || '').trim();
  const canonMcName = String(obj.canonMcName || '').trim();
  const npcs = cleanPackNpcs(obj.npcs, nowTs);

  // Require at least some real structured content so broken JSON doesn't silently pass
  if (
    !toneAndAtmosphere &&
    !worldSetting &&
    journeyMilestones.length === 0 &&
    npcs.length === 0
  ) {
    return null;
  }

  const finalMilestones =
    journeyMilestones.length >= 2
      ? journeyMilestones
      : [
          `Chặng 1 — Đặt chân vào thế giới ${animeTitle}: Xác lập thân phận, chạm mặt quy luật gốc và chọn phe/hướng đi đầu tiên.`,
          `Chặng 2 — Cọ xát & tích lũy: Đối đầu biến cố tuyến đầu, xây dựng mạng lưới đồng minh có điều kiện và đối mặt giới hạn bản thân.`,
          `Chặng 3 — Bẻ nhánh nhân quả: Can thiệp một sự kiện bước ngoặt của ${animeTitle}, chấp nhận cái giá và dư chấn dây chuyền.`,
          `Chặng 4 — Cao trào & kết mở: Định hình cục diện mới của riêng NVC, mở ra nhánh chơi lại theo lập trường khác.`,
        ];

  const finalDivergence =
    divergencePoints.length > 0
      ? divergencePoints
      : [
          `Biến cố mở màn của "${animeTitle}" diễn ra lệch nhịp do NVC xuất hiện sớm, khiến một manh mối hoặc cơ duyên đổi chủ.`,
          `Một thế lực hoặc nhân vật tuyến phụ thay đổi lập trường sớm hơn nguyên tác, buộc các phe chính phải tái bố trí kế hoạch.`,
        ];

  const finalRules = ensureAntiOpTradeoffRule(
    rawRules ||
      `Bám sát hệ thống sức mạnh, bối cảnh và giới hạn thực tế của "${animeTitle}".`,
    animeTitle,
  );

  return {
    id: `anime_pack_${nowTs}`,
    animeTitle,
    createdAt: nowIso,
    updatedAt: nowIso,
    toneAndAtmosphere:
      toneAndAtmosphere ||
      `Giữ đúng chất nhịp kể, hình ảnh và bầu không khí đặc trưng của "${animeTitle}", kết hợp cảm giác phiêu lưu có chiều sâu tâm lý.`,
    worldSetting:
      worldSetting ||
      `Thế giới nguyên tác "${animeTitle}" với các phe phái, quy luật sức mạnh và mâu thuẫn vận hành độc lập.`,
    worldRules: finalRules,
    journeyMilestones: finalMilestones,
    divergencePoints: finalDivergence,
    creativeDirection:
      creativeDirection ||
      `Theo sát 4 chặng hành trình của "${animeTitle}" nhưng để mỗi lựa chọn của NVC tạo hiệu ứng nhân quả thực sự, giữ NPC đúng tính cách nguyên tác và có đánh đổi rõ ràng.`,
    npcs:
      npcs.length > 0
        ? npcs
        : buildOfflineAnimeJourneyPack(animeTitle).npcs,
    ...(canonMcName ? { canonMcName } : {}),
  };
}

export function buildOfflineAnimeJourneyPack(
  animeTitle: string,
): AnimeJourneyPack {
  const cleanTitle = animeTitle.trim() || 'Thế giới Anime';
  const nowTs = Date.now();
  const nowIso = new Date(nowTs).toISOString();

  return {
    id: `anime_pack_${nowTs}`,
    animeTitle: cleanTitle,
    createdAt: nowIso,
    updatedAt: nowIso,
    toneAndAtmosphere: `Nhịp kể đậm chất anime "${cleanTitle}": xen kẽ giữa khoảnh khắc đời thường sắc nét và cao trào đối đầu giàu cảm xúc, ưu tiên góc nhìn trực diện.`,
    worldSetting: `Bối cảnh thế giới "${cleanTitle}" mở ra ngay trước bước ngoặt đầu tiên của nguyên tác, nơi các thế lực chính – phụ đều đang theo đuổi mục tiêu riêng.`,
    worldRules: ensureAntiOpTradeoffRule(
      `Tuân thủ hệ thống sức mạnh, phân cấp năng lực và luật ngầm của "${cleanTitle}".`,
      cleanTitle,
    ),
    journeyMilestones: [
      `Chặng 1 — Khởi hành trong "${cleanTitle}": NVC xác lập vị trí ban đầu, tiếp xúc quy luật thực tế và gây chú ý với một phe nhỏ.`,
      `Chặng 2 — Thử lửa & tích lũy: Tham gia sự kiện tuyến đầu, đối mặt giới hạn sức mạnh và lập liên minh tạm thời có điều kiện.`,
      `Chặng 3 — Bẻ nhánh bước ngoặt: Can thiệp vào một biến cố trọng tâm của "${cleanTitle}", chấp nhận cái giá đánh đổi và làn sóng phản ứng dây chuyền.`,
      `Chặng 4 — Định đoạt cục diện: Đối diện hệ quả cuối cùng từ các lựa chọn trước đó, tạo kết cục riêng hoặc mở đường chơi lại theo nhánh khác.`,
    ],
    divergencePoints: [
      `Sự kiện mở màn của "${cleanTitle}" bị dịch chuyển thời điểm do sự xuất hiện của NVC, khiến một cơ duyên hoặc bí mật lộ ra sớm hơn.`,
      `Một nhân vật trung lập/phụ nắm thông tin then chốt đổi lập trường sớm, kéo theo phản ứng bất ngờ từ phe đối địch.`,
    ],
    creativeDirection: `Chơi lại hành trình "${cleanTitle}" theo từng chặng rõ ràng: không ép bám kịch bản gốc máy móc, không toàn năng vô lý, mỗi lựa chọn đều tạo hệ quả lên đồng minh lẫn đối thủ.`,
    npcs: [
      {
        id: `anime_npc_${nowTs}_0`,
        name: `Nhân vật chủ chốt (${cleanTitle})`,
        role: 'Đồng hành có điều kiện / Nhân chứng tuyến chính',
        personality: 'Kiên định nguyên tắc cá nhân, không dễ mở lòng trước người mới.',
        agenda: `Hoàn thành mục tiêu cốt lõi trong mạch truyện "${cleanTitle}" và bảo vệ những gì mình coi trọng.`,
        friction:
          'Bất đồng phương pháp với NVC nếu thấy NVC mạo hiểm quá mức hoặc che giấu động cơ thật.',
        desc: `Đại diện tuyến nhân vật trọng tâm của "${cleanTitle}", hành động hoàn toàn In-Character.`,
      },
      {
        id: `anime_npc_${nowTs}_1`,
        name: `Kẻ giữ tin / Phe trung lập (${cleanTitle})`,
        role: 'Cộng sự thực dụng / Chuyên gia thông tin',
        personality: 'Tỉnh táo, thực tế, cân đo lợi ích trước khi ra tay.',
        agenda:
          'Tận dụng biến động cục diện để mở rộng ảnh hưởng và nắm thế chủ động thông tin.',
        friction:
          'Chỉ trao đổi ngang giá; sẵn sàng rút lui hoặc bán thông tin cho phe khác nếu NVC phá vỡ thỏa thuận.',
        desc: `Am hiểu góc khuất và luật ngầm của thế giới "${cleanTitle}".`,
      },
      {
        id: `anime_npc_${nowTs}_2`,
        name: `Đối trọng phe đối lập (${cleanTitle})`,
        role: 'Đối thủ / Biến số nguy hiểm',
        personality: 'Sắc sảo, quyết đoán, luôn điều chỉnh kế hoạch theo tình hình thực tế.',
        agenda:
          'Chiếm lợi thế tại các mốc bước ngoặt và áp đặt trật tự của phe mình.',
        friction:
          'Nhanh chóng nhận ra dấu vết can thiệp của NVC và chủ động giăng bẫy phản công.',
        desc: `Tạo áp lực thực thụ trong suốt 4 chặng hành trình của "${cleanTitle}".`,
      },
    ],
  };
}

export function applyAnimeJourneyPackToCompanion(
  cur: CompanionProfile,
  pack: AnimeJourneyPack,
): CompanionProfile {
  const cleanTitle = pack.animeTitle.trim();
  const tonePrefix = pack.toneAndAtmosphere.trim();
  const settingBody = pack.worldSetting.trim();

  // Keep worldSetting crisp & include tone/atmosphere if not already reflected
  const combinedSetting =
    tonePrefix && !settingBody.toLowerCase().includes(tonePrefix.slice(0, 24).toLowerCase())
      ? `${settingBody}\n\n[Văn phong & Không khí đặc trưng]: ${tonePrefix}`
      : settingBody || tonePrefix;

  const finalRules = ensureAntiOpTradeoffRule(pack.worldRules, cleanTitle);

  const nowTs = Date.now();
  const freshNpcs: CompanionNpc[] = (pack.npcs || []).map((n, idx) => ({
    ...n,
    id: `npc_${nowTs}_${idx}`,
  }));

  const currentName = (cur.name || '').trim();
  const shouldUpdateProfileName =
    !currentName ||
    /^đồng nhân mặc định$/i.test(currentName) ||
    /^đồng nhân\s*[—\-]/i.test(currentName) ||
    /hành trình đồng nhân$/i.test(currentName) ||
    (cur.sourceQuery?.trim() &&
      normalizeAnimeKey(cur.sourceQuery) !== normalizeAnimeKey(cleanTitle));

  return {
    ...cur,
    name: shouldUpdateProfileName
      ? `${cleanTitle} — Hành Trình Đồng Nhân`
      : currentName,
    role: cleanTitle || cur.role,
    sourceQuery: cleanTitle || cur.sourceQuery,
    animeTone: tonePrefix,
    worldSetting: combinedSetting,
    worldRules: finalRules,
    journeyMilestones: [...(pack.journeyMilestones || [])],
    divergencePoints: [...(pack.divergencePoints || [])],
    creativeDirection: pack.creativeDirection.trim(),
    mc: {
      ...cur.mc,
      ...(pack.canonMcName?.trim()
        ? { canonMcName: pack.canonMcName.trim() }
        : {}),
    },
    npcs: freshNpcs.length > 0 ? freshNpcs : cur.npcs,
    note: [cleanTitle, tonePrefix, settingBody]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 240),
  };
}

export function upsertAnimeJourneyHistory(
  history: AnimeJourneyPack[] | undefined,
  pack: AnimeJourneyPack,
): AnimeJourneyPack[] {
  const key = normalizeAnimeKey(pack.animeTitle);
  const existing = Array.isArray(history) ? history : [];
  const filtered = existing.filter(
    (item) => normalizeAnimeKey(item.animeTitle) !== key,
  );
  const prevMatch = existing.find(
    (item) => normalizeAnimeKey(item.animeTitle) === key,
  );
  const entry: AnimeJourneyPack = {
    ...pack,
    id: prevMatch?.id || pack.id,
    createdAt: prevMatch?.createdAt || pack.createdAt,
    updatedAt: new Date().toISOString(),
  };
  return [entry, ...filtered].slice(0, MAX_SAVED_ANIME_JOURNEYS);
}

export function normalizeAnimeJourneyHistory(raw: unknown): AnimeJourneyPack[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AnimeJourneyPack[] = [];
  for (let i = 0; i < raw.length && out.length < MAX_SAVED_ANIME_JOURNEYS; i++) {
    const item = raw[i] as Partial<AnimeJourneyPack> | null;
    if (!item || typeof item !== 'object') continue;
    const title = String(item.animeTitle || '').trim();
    if (!title) continue;
    const key = normalizeAnimeKey(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const nowIso = new Date().toISOString();
    out.push({
      id:
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : `anime_pack_${Date.now()}_${i}`,
      animeTitle: title,
      createdAt:
        typeof item.createdAt === 'string' && item.createdAt
          ? item.createdAt
          : nowIso,
      updatedAt:
        typeof item.updatedAt === 'string' && item.updatedAt
          ? item.updatedAt
          : nowIso,
      toneAndAtmosphere: String(item.toneAndAtmosphere || '').trim(),
      worldSetting: String(item.worldSetting || '').trim(),
      worldRules: String(item.worldRules || '').trim(),
      journeyMilestones: cleanStringList(item.journeyMilestones, 6),
      divergencePoints: cleanStringList(item.divergencePoints, 4),
      creativeDirection: String(item.creativeDirection || '').trim(),
      npcs: cleanPackNpcs(item.npcs, Date.now() + i),
      ...(typeof item.canonMcName === 'string' && item.canonMcName.trim()
        ? { canonMcName: item.canonMcName.trim() }
        : {}),
    });
  }
  return out;
}
