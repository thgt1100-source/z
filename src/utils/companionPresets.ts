import type {
  CompanionCreativePresetId,
  CompanionProfile,
} from '../types/ark';

export interface CompanionCreativePreset {
  id: CompanionCreativePresetId;
  title: string;
  shortTag: string;
  summary: string;
  accent: 'sky' | 'violet' | 'amber' | 'rose';
  originRoleTemplate: string;
  canonMcRelationTemplate: string;
  creativeDirectionTemplate: string;
  worldRuleAddition: string;
}

export const COMPANION_CREATIVE_PRESETS: CompanionCreativePreset[] = [
  {
    id: 'domino_divergence',
    title: 'Rẽ Nhánh Domino',
    shortTag: 'Canon Divergence',
    summary:
      'Đặt điểm bẻ nhánh nhân quả, giảm rập khuôn nguyên tác, đẩy hiệu ứng dây chuyền khi can thiệp sự kiện lớn.',
    accent: 'sky',
    originRoleTemplate:
      'Người xuất hiện đúng mắt xích lệch nhịp trước một bước ngoặt quan trọng của nguyên tác; mang theo góc nhìn/biến số nhỏ nhưng đủ sức làm chệch hướng chuỗi sự kiện lớn.',
    canonMcRelationTemplate:
      'Không đi lại nguyên xi kịch bản cũ cùng nhân vật chính nguyên tác; hành động của NVC làm thay đổi thời điểm, cách thức hoặc cái giá của các cơ duyên và biến cố quanh NVC gốc.',
    creativeDirectionTemplate:
      '[Rẽ Nhánh Domino — Canon Divergence] Tuyệt đối không ép diễn biến quay về đường ray nguyên tác một cách gượng ép. Mỗi can thiệp lớn của NVC đều phải tạo hiệu ứng dây chuyền (Domino): phe phản diện tự điều chỉnh kế hoạch, đồng minh cũ thay đổi lựa chọn, và phát sinh biến cố mới nằm ngoài ký ức nguyên tác.',
    worldRuleAddition:
      '- Hiệu ứng Domino (Canon Divergence): Khi sự kiện gốc bị can thiệp, toàn bộ chuỗi nhân quả phía sau tự biến đổi tương ứng; các thế lực khác chủ động thích nghi thay vì đứng yên chờ kịch bản cũ.',
  },
  {
    id: 'storm_edge_observer',
    title: 'Góc Nhìn Rìa Bão',
    shortTag: 'Kẻ Đứng Ngoài / Quan Sát',
    summary:
      'Không mặc định theo phe chính diện từ đầu; nhìn ra điểm mù của thế giới gốc và xoay chuyển cục diện từ bên lề.',
    accent: 'violet',
    originRoleTemplate:
      'Kẻ đứng ở rìa cơn bão (người quan sát, kẻ trung lập, người làm nghề bên lề hoặc thành viên thế lực thứ ba); đứng ngoài hào quang tuyến chính nên nhìn rõ những điểm mù và cái giá ẩn sau cuộc chiến lớn.',
    canonMcRelationTemplate:
      'Không mặc định đứng cùng chiến tuyến hay làm bạn thân với NVC gốc ngay từ đầu; ban đầu chỉ quan sát, đánh giá hoặc giao cắt gián tiếp, chỉ can thiệp khi cục diện chạm đến lợi ích, nguyên tắc hoặc kế hoạch riêng.',
    creativeDirectionTemplate:
      '[Góc Nhìn Rìa Bão — Kẻ Đứng Ngoài] Khai thác chiều sâu của thế giới từ bên lề và các góc khuất mà tuyến chính bỏ qua. Phản ánh đa chiều lợi ích giữa các phe (phe chính diện không hoàn hảo tuyệt đối), ưu tiên đòn bẩy thông tin, vị thế và lựa chọn chiến lược thay vì lao thẳng vào vai anh hùng mặc định.',
    worldRuleAddition:
      '- Góc nhìn bên lề & điểm mù thế giới: Thế giới vận hành theo nhiều tầng lợi ích song song; phe chính diện cũng có giới hạn, thiên kiến và hệ quả ngoài ý muốn đối với người ngoài cuộc.',
  },
  {
    id: 'tradeoff_anti_op',
    title: 'Được - Mất & Ràng Buộc',
    shortTag: 'Chống Toàn Năng',
    summary:
      'Gắn cơ chế đánh đổi, giới hạn năng lực/nguồn lực và dư chấn nhân quả; tránh NVC quá bá đạo hay NPC tự động tin phục.',
    accent: 'amber',
    originRoleTemplate:
      'Sở hữu ưu thế, tri thức hoặc năng lực đặc thù nhưng bị trói buộc bởi điều kiện kích hoạt, giới hạn tài nguyên, nguy cơ phản phệ hoặc rủi ro lộ thân phận nếu lạm dụng.',
    canonMcRelationTemplate:
      'Không có đặc quyền được NVC gốc hay các cường giả/NPC tin tưởng vô điều kiện; mọi sự tin cậy, chia sẻ bí mật hay liên minh đều phải đổi bằng kiểm chứng thực tế và cái giá tương xứng.',
    creativeDirectionTemplate:
      '[Được - Mất & Ràng Buộc — Chống Toàn Năng] Mọi lựa chọn lớn đều có đánh đổi rõ ràng (được một lợi thế phải trả bằng tài nguyên, thời gian, tổn thương, hoặc tạo ra kẻ thù mới). Năng lực của NVC luôn có giới hạn và điểm mù; NPC giữ lý trí độc lập, có quyền hoài nghi, từ chối hoặc phản biện.',
    worldRuleAddition:
      '- Cơ chế Được - Mất & Chống Toàn Năng: Không ban thắng lợi miễn phí hay hào quang áp chế vô lý; mọi năng lực vượt chuẩn đều có giới hạn, cái giá và dư chấn nhân quả rõ rệt. NPC không tự động tin phục khi chưa đủ cơ sở.',
  },
  {
    id: 'canon_mc_friction',
    title: 'Va Chạm Lợi Ích',
    shortTag: 'Ma sát với NVC Gốc',
    summary:
      'Tạo độ ma sát, hiểu lầm hoặc hợp tác tạm thời vì mục tiêu chung với NVC gốc thay vì thân thiết mặc định.',
    accent: 'rose',
    originRoleTemplate:
      'Nhân vật có lộ trình, lý tưởng hoặc mục tiêu tài nguyên trực tiếp giao cắt với con đường của NVC nguyên tác; sẵn sàng cạnh tranh sòng phẳng hoặc đặt điều kiện khi hợp tác.',
    canonMcRelationTemplate:
      'Tồn tại độ ma sát, khác biệt lập trường hoặc hiểu lầm ban đầu với NVC nguyên tác. Hai bên có thể tranh đoạt cùng một cơ duyên/manh mối hoặc chỉ bắt tay tạm thời vì kẻ thù chung, nhưng luôn giữ ranh giới và toan tính riêng.',
    creativeDirectionTemplate:
      '[Va Chạm Lợi Ích Với NVC Gốc] Giữ vững bản sắc và mục tiêu riêng của cả NVC tự tạo lẫn NVC nguyên tác. Tạo lực đẩy kịch tính từ xung đột phương pháp, tranh chấp lợi ích hoặc liên minh mong manh; tuyệt đối không biến NVC gốc thành phụ tá dễ bảo hay thân thiết bất thường ngay lần đầu gặp.',
    worldRuleAddition:
      '- Xung đột lập trường & Liên minh có điều kiện: NVC gốc và các nhân vật chủ chốt có mục tiêu không trùng khít với người chơi; hợp tác chỉ bền khi có lợi ích chung hoặc trải qua thử thách thực sự.',
  },
];

export const VALID_CREATIVE_PRESET_IDS = new Set<CompanionCreativePresetId>(
  COMPANION_CREATIVE_PRESETS.map((p) => p.id),
);

export function getCreativePresetById(
  id: CompanionCreativePresetId,
): CompanionCreativePreset | undefined {
  return COMPANION_CREATIVE_PRESETS.find((p) => p.id === id);
}

const DEFAULT_ORIGIN_ROLE_BOILERPLATES = [
  'Người xuyên không vào thế giới nguyên tác, mang theo hiểu biết và con đường phát triển riêng.',
  'Đại năng / Cường giả đứng đầu một phương trong thế giới, am hiểu quy tắc và bí mật sâu xa.',
];

const DEFAULT_CANON_REL_BOILERPLATES = [
  'Nhân vật chính nguyên tác vẫn tồn tại song song trong thế giới; có thể gặp gỡ, đồng hành hoặc tạo biến số.',
  'Nhân vật chính nguyên tác vẫn hiện diện trong thế giới; nhân vật chính tự tạo có thể là tiền bối, đối thủ hoặc biến số lớn.',
];

function isDefaultOrEmptyText(text: string | undefined, defaults: string[]): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed) return true;
  return defaults.some((d) => d.trim() === trimmed);
}

export function hasCustomCompanionCreativeFields(cur: CompanionProfile): boolean {
  const hasOrigin = !isDefaultOrEmptyText(
    cur.mc?.originRole,
    DEFAULT_ORIGIN_ROLE_BOILERPLATES,
  );
  const hasRel = !isDefaultOrEmptyText(
    cur.mc?.canonMcRelation,
    DEFAULT_CANON_REL_BOILERPLATES,
  );
  const hasDir = Boolean((cur.creativeDirection || '').trim());
  return hasOrigin || hasRel || hasDir;
}

function mergeDistinctText(existing: string | undefined, addition: string): string {
  const cur = (existing || '').trim();
  const add = addition.trim();
  if (!add) return cur;
  if (!cur) return add;
  if (cur.includes(add)) return cur;
  // Also avoid duplicating by checking first 48 chars signature
  const sig = add.slice(0, Math.min(48, add.length));
  if (sig.length >= 24 && cur.includes(sig)) return cur;
  return `${cur}\n${add}`;
}

export function buildInCharacterCausalityRule(workTitle?: string): string {
  const label = (workTitle || '').trim();
  return (
    `- Giữ đúng tính cách nguyên tác (In-Character) & Hậu quả nhân quả${
      label ? ` (${label})` : ''
    }: Mọi nhân vật nguyên tác phải giữ đúng cốt lõi tính cách, tư duy, giới hạn hiểu biết và lập trường vốn có (không OOC, không tự động tin phục vô lý). Mọi can thiệp lớn vào sự kiện hoặc thế lực đều sinh ra hệ quả nhân quả thực tế và lan tỏa theo thời gian.`
  );
}

export function ensureInCharacterCausalityRule(
  worldRules: string | undefined,
  workTitle?: string,
): string {
  const cur = (worldRules || '').trim();
  const alreadyHasInChar =
    /in-character|đúng tính cách nguyên tác|không ooc/i.test(cur) &&
    /nhân quả|hậu quả|hệ quả/i.test(cur);
  if (alreadyHasInChar) return cur;
  const ruleLine = buildInCharacterCausalityRule(workTitle);
  return cur ? `${cur}\n${ruleLine}` : ruleLine;
}

export function applyCreativePresetToCompanion(
  cur: CompanionProfile,
  presetId: CompanionCreativePresetId,
  mode: 'merge' | 'replace',
): CompanionProfile {
  const preset = getCreativePresetById(presetId);
  if (!preset) return cur;

  const prevIds = Array.isArray(cur.creativePresetIds)
    ? cur.creativePresetIds.filter((id) => VALID_CREATIVE_PRESET_IDS.has(id))
    : [];
  const nextIds: CompanionCreativePresetId[] =
    mode === 'replace'
      ? [presetId]
      : prevIds.includes(presetId)
        ? prevIds
        : [...prevIds, presetId];

  const baseOrigin = isDefaultOrEmptyText(
    cur.mc?.originRole,
    DEFAULT_ORIGIN_ROLE_BOILERPLATES,
  )
    ? ''
    : cur.mc?.originRole || '';
  const baseRel = isDefaultOrEmptyText(
    cur.mc?.canonMcRelation,
    DEFAULT_CANON_REL_BOILERPLATES,
  )
    ? ''
    : cur.mc?.canonMcRelation || '';

  const nextOriginRole =
    mode === 'replace'
      ? preset.originRoleTemplate
      : mergeDistinctText(baseOrigin, preset.originRoleTemplate);

  const nextCanonRelation =
    mode === 'replace'
      ? preset.canonMcRelationTemplate
      : mergeDistinctText(baseRel, preset.canonMcRelationTemplate);

  const nextCreativeDirection =
    mode === 'replace'
      ? preset.creativeDirectionTemplate
      : mergeDistinctText(cur.creativeDirection, preset.creativeDirectionTemplate);

  const nextWorldRules = mergeDistinctText(
    cur.worldRules,
    preset.worldRuleAddition,
  );

  return {
    ...cur,
    creativePresetIds: nextIds,
    creativeDirection: nextCreativeDirection,
    worldRules: nextWorldRules,
    mc: {
      ...cur.mc,
      originRole: nextOriginRole,
      canonMcRelation: nextCanonRelation,
    },
  };
}
