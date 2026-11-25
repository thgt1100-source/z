import type {
  CultivationProfile,
  CultivationSubStage,
  TechniqueTier,
  WuxiaElementPath,
  WuxiaInnerArtOrigin,
  WuxiaMartialState,
  WuxiaSanctuaryKind,
  WuxiaSectGrade,
} from '../types/ark';

export interface WuxiaNineYinTitle {
  index: number;
  minLayer: number;
  maxLayer: number;
  layerRangeLabel: string;
  title: string;
  meaningVi: string;
  subStage: CultivationSubStage;
  maxExp: number;
  isMajorMilestone: boolean;
}

/**
 * Bảng 21 tôn hiệu thực lực nội công chuẩn sắc thái Kiếm hiệp / võ học Cửu Âm
 * (kèm giải nghĩa thuần Việt ngắn gọn). CHỈ áp dụng cho thể loại Kiếm hiệp (wuxia).
 */
export const WUXIA_NINE_YIN_TITLES: readonly WuxiaNineYinTitle[] = [
  {
    index: 0,
    minLayer: 1,
    maxLayer: 5,
    layerRangeLabel: 'Tầng 1 – 5',
    title: 'Bất kham nhất kích',
    meaningVi: 'Mới nhập môn, chịu đòn yếu, đánh một đòn là đuối.',
    subStage: 'Sơ kỳ',
    maxExp: 100,
    isMajorMilestone: false,
  },
  {
    index: 1,
    minLayer: 6,
    maxLayer: 10,
    layerRangeLabel: 'Tầng 6 – 10',
    title: 'Sơ học xạ luyện',
    meaningVi: 'Bước đầu tập luyện, nắm nét cơ bản.',
    subStage: 'Sơ kỳ',
    maxExp: 140,
    isMajorMilestone: false,
  },
  {
    index: 2,
    minLayer: 11,
    maxLayer: 14,
    layerRangeLabel: 'Tầng 11 – 14',
    title: 'Sơ khuy môn kinh',
    meaningVi: 'Hé mở cửa võ học, bắt đầu hiểu quy củ.',
    subStage: 'Sơ kỳ',
    maxExp: 195,
    isMajorMilestone: false,
  },
  {
    index: 3,
    minLayer: 15,
    maxLayer: 17,
    layerRangeLabel: 'Tầng 15 – 17',
    title: 'Lược hữu tiểu thành',
    meaningVi: 'Có chút thành tựu bước đầu.',
    subStage: 'Trung kỳ',
    maxExp: 260,
    isMajorMilestone: false,
  },
  {
    index: 4,
    minLayer: 18,
    maxLayer: 19,
    layerRangeLabel: 'Tầng 18 – 19',
    title: 'Giá khinh tựu thực',
    meaningVi: 'Làm quen đường đi nước bước, tay nghề trơn tru hơn.',
    subStage: 'Trung kỳ',
    maxExp: 340,
    isMajorMilestone: false,
  },
  {
    index: 5,
    minLayer: 20,
    maxLayer: 22,
    layerRangeLabel: 'Tầng 20 – 22',
    title: 'Dung hội quán thông',
    meaningVi: 'Hòa hợp các ý, thông suốt mạch võ học.',
    subStage: 'Trung kỳ',
    maxExp: 440,
    isMajorMilestone: true,
  },
  {
    index: 6,
    minLayer: 23,
    maxLayer: 24,
    layerRangeLabel: 'Tầng 23 – 24',
    title: 'Lô hỏa thuần thanh',
    meaningVi: 'Luyện tới độ chín muồi, thuần thục vững vàng.',
    subStage: 'Trung kỳ',
    maxExp: 570,
    isMajorMilestone: false,
  },
  {
    index: 7,
    minLayer: 25,
    maxLayer: 26,
    layerRangeLabel: 'Tầng 25 – 26',
    title: 'Kỳ tài xuất chúng',
    meaningVi: 'Tài năng nổi bật hơn người thường.',
    subStage: 'Hậu kỳ',
    maxExp: 730,
    isMajorMilestone: false,
  },
  {
    index: 8,
    minLayer: 27,
    maxLayer: 28,
    layerRangeLabel: 'Tầng 27 – 28',
    title: 'Thần hồ kỳ kỹ',
    meaningVi: 'Kỹ xảo tinh diệu khó lường.',
    subStage: 'Hậu kỳ',
    maxExp: 920,
    isMajorMilestone: false,
  },
  {
    index: 9,
    minLayer: 29,
    maxLayer: 30,
    layerRangeLabel: 'Tầng 29 – 30',
    title: 'Xuất thần nhập hóa',
    meaningVi: 'Vận khí biến hóa tự nhiên, đạt tới cảnh giới tinh vi.',
    subStage: 'Hậu kỳ',
    maxExp: 1160,
    isMajorMilestone: true,
  },
  {
    index: 10,
    minLayer: 31,
    maxLayer: 31,
    layerRangeLabel: 'Tầng 31',
    title: 'Ngạo thị quần hùng',
    meaningVi: 'Đủ sức đứng trên quần hùng cùng lứa/cùng tầm.',
    subStage: 'Đỉnh phong',
    maxExp: 1450,
    isMajorMilestone: true,
  },
  {
    index: 11,
    minLayer: 32,
    maxLayer: 33,
    layerRangeLabel: 'Tầng 32 – 33',
    title: 'Đăng phong tạo cực',
    meaningVi: 'Chạm tới đỉnh cao của một chặng đường võ học.',
    subStage: 'Sơ kỳ',
    maxExp: 1800,
    isMajorMilestone: false,
  },
  {
    index: 12,
    minLayer: 34,
    maxLayer: 35,
    layerRangeLabel: 'Tầng 34 – 35',
    title: 'Vô dữ luận tỉ',
    meaningVi: 'Khó ai sánh kịp trong cùng bậc.',
    subStage: 'Trung kỳ',
    maxExp: 2250,
    isMajorMilestone: false,
  },
  {
    index: 13,
    minLayer: 36,
    maxLayer: 38,
    layerRangeLabel: 'Tầng 36 – 38',
    title: 'Sở hướng phí mị',
    meaningVi: 'Đi tới đâu uy thế áp đảo tới đó, tà mị khó bén mảng.',
    subStage: 'Hậu kỳ',
    maxExp: 2800,
    isMajorMilestone: false,
  },
  {
    index: 14,
    minLayer: 39,
    maxLayer: 43,
    layerRangeLabel: 'Tầng 39 – 43',
    title: 'Nhất đại tôn sư',
    meaningVi: 'Mở phái lập uy, danh vọng bậc tôn sư một phương.',
    subStage: 'Sơ kỳ',
    maxExp: 3550,
    isMajorMilestone: true,
  },
  {
    index: 15,
    minLayer: 44,
    maxLayer: 48,
    layerRangeLabel: 'Tầng 44 – 48',
    title: 'Thần công cái thế',
    meaningVi: 'Nội công trùm khắp võ lâm, uy lực lấn át đương thời.',
    subStage: 'Trung kỳ',
    maxExp: 4500,
    isMajorMilestone: false,
  },
  {
    index: 16,
    minLayer: 49,
    maxLayer: 53,
    layerRangeLabel: 'Tầng 49 – 53',
    title: 'Cử thế vô song',
    meaningVi: 'Một mình một cõi, ít ai bì kịp trên giang hồ.',
    subStage: 'Hậu kỳ',
    maxExp: 5750,
    isMajorMilestone: true,
  },
  {
    index: 17,
    minLayer: 54,
    maxLayer: 58,
    layerRangeLabel: 'Tầng 54 – 58',
    title: 'Kinh thế hãi tục',
    meaningVi: 'Uy lực khiến thiên hạ kinh sợ, vượt khỏi lẽ thường.',
    subStage: 'Đỉnh phong',
    maxExp: 7300,
    isMajorMilestone: false,
  },
  {
    index: 18,
    minLayer: 59,
    maxLayer: 61,
    layerRangeLabel: 'Tầng 59 – 61',
    title: 'Kinh thiên động địa',
    meaningVi: 'Khí thế chấn động đất trời, biến hóa khôn lường.',
    subStage: 'Sơ kỳ',
    maxExp: 9200,
    isMajorMilestone: true,
  },
  {
    index: 19,
    minLayer: 62,
    maxLayer: 64,
    layerRangeLabel: 'Tầng 62 – 64',
    title: 'Chấn cổ thước kim',
    meaningVi: 'Vang dội từ xưa tới nay, hiếm có trong kim cổ.',
    subStage: 'Hậu kỳ',
    maxExp: 11800,
    isMajorMilestone: true,
  },
  {
    index: 20,
    minLayer: 65,
    maxLayer: 86,
    layerRangeLabel: 'Tầng 65 – 66+',
    title: 'Siêu phàm nhập thánh',
    meaningVi: 'Vượt khỏi phàm trần võ học, chạm ngưỡng thần thánh.',
    subStage: 'Đỉnh phong',
    maxExp: 15500,
    isMajorMilestone: true,
  },
] as const;

export const WUXIA_JIANGHU_LAYER_MILESTONES = [36, 49, 64, 75, 86] as const;

export const WUXIA_ORIGIN_META: Record<
  WuxiaInnerArtOrigin,
  { label: string; shortLabel: string; badgeClass: string; description: string }
> = {
  mon_phai: {
    label: 'Nội công Môn phái',
    shortLabel: 'Môn phái',
    badgeClass: 'bg-sky-500/18 text-sky-200 ring-sky-400/35',
    description:
      'Chia theo nhiều bộ từ Nhập môn → Trung cấp → Trấn phái. Mỗi bộ có trần tầng riêng; luyện chạm trần cần chuyển sang bộ cao hơn.',
  },
  giang_ho: {
    label: 'Nội công Giang hồ',
    shortLabel: 'Giang hồ',
    badgeClass: 'bg-emerald-500/18 text-emerald-200 ring-emerald-400/38',
    description:
      'Không ràng buộc một môn phái, cày cuốc dài hơi (mốc 49 – 64 tầng), khó luyện hơn nhưng trần thực lực rộng hơn nội công sơ/trung cấp.',
  },
  co_pho: {
    label: 'Cổ phổ · Kỳ công',
    shortLabel: 'Cổ phổ',
    badgeClass: 'bg-amber-500/20 text-amber-200 ring-amber-400/45',
    description:
      'Tuyệt học thượng cổ thất truyền (mốc 75 – 86 tầng), độ khó cực cao, cần cơ duyên và kiên trì nhiều năm mới chạm ngưỡng Siêu phàm nhập thánh.',
  },
};

export const WUXIA_SECT_GRADE_META: Record<
  WuxiaSectGrade,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    paceFactor: number;
    ceilingHint: string;
  }
> = {
  nhap_mon: {
    label: 'Nhập môn (Sơ cấp)',
    shortLabel: 'Nhập môn',
    badgeClass: 'bg-slate-500/20 text-slate-200 ring-slate-400/35',
    paceFactor: 1.0,
    ceilingHint: 'Trần Tầng 18 – 22 (tối đa Giá khinh tựu thực / Dung hội quán thông)',
  },
  trung_cap: {
    label: 'Trung cấp môn phái',
    shortLabel: 'Trung cấp',
    badgeClass: 'bg-sky-500/18 text-sky-200 ring-sky-400/35',
    paceFactor: 0.9,
    ceilingHint: 'Trần Tầng 31 – 36 (tối đa Ngạo thị quần hùng / Sở hướng phí mị)',
  },
  tran_phai: {
    label: 'Cao cấp / Trấn phái',
    shortLabel: 'Trấn phái',
    badgeClass: 'bg-fuchsia-500/18 text-fuchsia-200 ring-fuchsia-400/40',
    paceFactor: 0.78,
    ceilingHint: 'Trần Tầng 47 – 53 (tối đa Thần công cái thế / Cử thế vô song)',
  },
  giang_ho_ky_cong: {
    label: 'Giang hồ / Cổ phổ dài hơi',
    shortLabel: 'Giang hồ · Cổ phổ',
    badgeClass: 'bg-amber-500/18 text-amber-200 ring-amber-400/40',
    paceFactor: 0.72,
    ceilingHint: 'Mốc 49 / 64 / 75 / 86 tầng — mở trần tới Chấn cổ thước kim & Siêu phàm nhập thánh',
  },
};

export interface WuxiaElementPathMeta {
  id: WuxiaElementPath;
  label: string;
  shortLabel: string;
  badgeClass: string;
  description: string;
  weaponHint: string;
  preferredSanctuaries: readonly WuxiaSanctuaryKind[];
}

export const WUXIA_ELEMENT_PATH_META: Record<
  WuxiaElementPath,
  WuxiaElementPathMeta
> = {
  duong_cuong: {
    id: 'duong_cuong',
    label: 'Dương Cương',
    shortLabel: 'Dương Cương',
    badgeClass: 'bg-amber-500/18 text-amber-200 ring-amber-400/38',
    description:
      'Chân khí cương mãnh bùng phát, phá phòng mạnh; cần kinh mạch bền vững để tránh bạo khí.',
    weaponHint: 'Hợp Đao · Thương · Quyền · Chưởng cương lực',
    preferredSanctuaries: ['son', 'dong'],
  },
  am_nhu: {
    id: 'am_nhu',
    label: 'Âm Nhu',
    shortLabel: 'Âm Nhu',
    badgeClass: 'bg-cyan-500/18 text-cyan-200 ring-cyan-400/38',
    description:
      'Nội tức âm hàn linh xảo, biến chiêu khó lường, sát thương thấm sâu vào kinh mạch.',
    weaponHint: 'Hợp Kiếm · Chỉ pháp · Ám khí · Độc/Hàn công',
    preferredSanctuaries: ['thuy', 'tuyet', 'dong'],
  },
  thai_cuc: {
    id: 'thai_cuc',
    label: 'Thái Cực',
    shortLabel: 'Thái Cực',
    badgeClass: 'bg-violet-500/18 text-violet-200 ring-violet-400/38',
    description:
      'Âm dương tương tế, nội lực miên trường ổn định, giảm mạnh nguy cơ tẩu hỏa khi xung kích.',
    weaponHint: 'Hợp Kiếm · Chưởng · Ngũ hành · Nội công dung hòa',
    preferredSanctuaries: ['lam', 'son', 'thuy'],
  },
};

export interface WuxiaSanctuaryMeta {
  id: WuxiaSanctuaryKind;
  label: string;
  shortLabel: string;
  elementTag: string;
  favoredPaths: readonly WuxiaElementPath[];
  hint: string;
}

export const WUXIA_SANCTUARY_ORDER: readonly WuxiaSanctuaryKind[] = [
  'none',
  'thuy',
  'son',
  'lam',
  'tuyet',
  'dong',
] as const;

export const WUXIA_SANCTUARY_META: Record<
  WuxiaSanctuaryKind,
  WuxiaSanctuaryMeta
> = {
  none: {
    id: 'none',
    label: 'Thường địa (không phúc địa)',
    shortLabel: 'Thường địa',
    elementTag: 'Bình thường',
    favoredPaths: [],
    hint: 'Tu luyện thông thường tại khách điếm, đình viện hoặc hành tẩu.',
  },
  thuy: {
    id: 'thuy',
    label: 'Phúc địa Thủy (Hàn Đàm · Bích Thủy)',
    shortLabel: 'Thủy · Hàn Đàm',
    elementTag: 'Thủy',
    favoredPaths: ['am_nhu', 'thai_cuc'],
    hint: 'Hơi nước tụ khí thanh tĩnh, rất hợp nội công Âm Nhu & Thái Cực (+25% tích lũy/tháng).',
  },
  son: {
    id: 'son',
    label: 'Phúc địa Sơn (Danh Sơn · Tuyệt Đỉnh)',
    shortLabel: 'Sơn · Danh Sơn',
    elementTag: 'Sơn',
    favoredPaths: ['duong_cuong', 'thai_cuc'],
    hint: 'Sơn khí hùng hậu, ánh dương tràn đầy, rất hợp Dương Cương & Thái Cực (+25% tích lũy/tháng).',
  },
  lam: {
    id: 'lam',
    label: 'Phúc địa Lâm (Cổ Lâm · Trúc Hải)',
    shortLabel: 'Lâm · Trúc Hải',
    elementTag: 'Lâm',
    favoredPaths: ['thai_cuc', 'am_nhu'],
    hint: 'Sinh khí thanh u, điều hòa khí tức cực tốt cho Thái Cực & Âm Nhu (+25% tích lũy/tháng).',
  },
  tuyet: {
    id: 'tuyet',
    label: 'Phúc địa Tuyết (Tuyết Phong · Băng Cốc)',
    shortLabel: 'Tuyết · Băng Cốc',
    elementTag: 'Tuyết',
    favoredPaths: ['am_nhu'],
    hint: 'Hàn khí cực thịnh, đẩy mạnh Băng Tâm / Hàn Tiêu / Âm Nhu (+28% tích lũy/tháng).',
  },
  dong: {
    id: 'dong',
    label: 'Phúc địa Động (Thâm Động · Địa Huyệt)',
    shortLabel: 'Động · Địa Huyệt',
    elementTag: 'Động',
    favoredPaths: ['duong_cuong', 'am_nhu'],
    hint: 'Kín đáo tụ khí, bế quan tuyệt mật hợp cả Dương Cương lẫn Âm Nhu (+25% tích lũy/tháng).',
  },
};

export interface WuxiaJianghuInnerArt {
  id: string;
  name: string;
  origin: WuxiaInnerArtOrigin;
  grade: WuxiaSectGrade;
  sectName?: string;
  elementPath: WuxiaElementPath;
  maxLayer: number;
  tier: TechniqueTier;
  /** Hệ số nhịp luyện riêng: thấp hơn = cày cuốc dài hơi & khó hơn nhưng trần cao hơn */
  paceFactor: number;
  preferredSanctuaries: readonly WuxiaSanctuaryKind[];
  weaponSynergy: string;
  description: string;
}

/**
 * 15 bộ Nội công Môn phái phân hóa rõ ràng theo 3 bậc:
 * Nhập môn (trần 18–22) · Trung cấp (trần 31–36) · Cao cấp / Trấn phái (trần 47–53).
 * Luyện chạm trần bộ nào phải dừng ở mức đó, muốn tiến xa hơn phải đổi bộ cao hơn.
 */
export const WUXIA_SECT_INNER_ARTS: readonly WuxiaJianghuInnerArt[] = [
  // --- NHẬP MÔN (Trần 18–22) ---
  {
    id: 'sect_vodang_nhapmon',
    name: 'Võ Đang Nhập Môn Tâm Pháp',
    origin: 'mon_phai',
    grade: 'nhap_mon',
    sectName: 'Võ Đang',
    elementPath: 'thai_cuc',
    maxLayer: 18,
    tier: 'pham',
    paceFactor: 1.04,
    preferredSanctuaries: ['son', 'lam'],
    weaponSynergy: 'Trường kiếm · Chưởng căn bản',
    description:
      'Nội công sơ cấp cho đệ tử nhập môn Võ Đang, dưỡng khí vững nhưng trần chỉ tới Tầng 18 (Giá khinh tựu thực).',
  },
  {
    id: 'sect_hoason_coban',
    name: 'Hoa Sơn Cơ Bản Nội Công',
    origin: 'mon_phai',
    grade: 'nhap_mon',
    sectName: 'Hoa Sơn',
    elementPath: 'thai_cuc',
    maxLayer: 20,
    tier: 'pham',
    paceFactor: 1.02,
    preferredSanctuaries: ['son', 'lam'],
    weaponSynergy: 'Kiếm pháp nhập môn · Thân pháp',
    description:
      'Tâm pháp căn bản phái Hoa Sơn, dễ nhập thủ, chạm trần ở Tầng 20 (Dung hội quán thông) cần đổi lên Hỗn Nguyên / Tử Hà.',
  },
  {
    id: 'sect_thieulam_lahan',
    name: 'Thiếu Lâm La Hán Sơ Công',
    origin: 'mon_phai',
    grade: 'nhap_mon',
    sectName: 'Thiếu Lâm',
    elementPath: 'duong_cuong',
    maxLayer: 22,
    tier: 'linh',
    paceFactor: 1.0,
    preferredSanctuaries: ['son', 'dong'],
    weaponSynergy: 'Côn pháp · Quyền cước cương mãnh',
    description:
      'Nội công nhập môn Thiếu Lâm rèn gân cốt Dương Cương, chạm trần ở Tầng 22 (Dung hội quán thông).',
  },
  {
    id: 'sect_ngami_thanhtam',
    name: 'Nga Mi Thanh Tâm Quyết',
    origin: 'mon_phai',
    grade: 'nhap_mon',
    sectName: 'Nga Mi',
    elementPath: 'am_nhu',
    maxLayer: 20,
    tier: 'pham',
    paceFactor: 1.02,
    preferredSanctuaries: ['thuy', 'lam'],
    weaponSynergy: 'Đơn kiếm · Chưởng nhu hòa',
    description:
      'Nội công sơ cấp phái Nga Mi, điều tức thanh tĩnh, giới hạn tối đa Tầng 20 (Dung hội quán thông).',
  },
  {
    id: 'sect_duongmon_luchop',
    name: 'Đường Môn Lục Hợp Sơ Kinh',
    origin: 'mon_phai',
    grade: 'nhap_mon',
    sectName: 'Đường Môn',
    elementPath: 'am_nhu',
    maxLayer: 19,
    tier: 'pham',
    paceFactor: 1.03,
    preferredSanctuaries: ['dong', 'lam'],
    weaponSynergy: 'Ám khí · Phi đao · Thân pháp nhanh',
    description:
      'Nội công nhập môn Đường Môn bổ trợ thủ pháp ám khí, chạm trần tại Tầng 19 (Giá khinh tựu thực).',
  },

  // --- TRUNG CẤP MÔN PHÁI (Trần 31–36) ---
  {
    id: 'sect_caibang_tieudao',
    name: 'Cái Bang Tiêu Dao Du Nội Công',
    origin: 'mon_phai',
    grade: 'trung_cap',
    sectName: 'Cái Bang',
    elementPath: 'duong_cuong',
    maxLayer: 31,
    tier: 'linh',
    paceFactor: 0.92,
    preferredSanctuaries: ['son', 'dong'],
    weaponSynergy: 'Đả Cẩu Bổng · Quyền chưởng',
    description:
      'Nội công trung cấp đệ tử nòng cốt Cái Bang, đủ sức đứng đầu quần hùng cùng lứa (trần Tầng 31 · Ngạo thị quần hùng).',
  },
  {
    id: 'sect_vodang_luongnghi',
    name: 'Võ Đang Lưỡng Nghi Hộ Tâm Công',
    origin: 'mon_phai',
    grade: 'trung_cap',
    sectName: 'Võ Đang',
    elementPath: 'thai_cuc',
    maxLayer: 33,
    tier: 'huyen',
    paceFactor: 0.9,
    preferredSanctuaries: ['son', 'lam'],
    weaponSynergy: 'Lưỡng Nghi Kiếm · Thái Cực Chưởng',
    description:
      'Nội công trung cấp nội môn Võ Đang, nội tức dày dặn ổn định, trần Tầng 33 (Đăng phong tạo cực).',
  },
  {
    id: 'sect_ngami_bangtam',
    name: 'Nga Mi Băng Tâm Tịnh Khí Quyết',
    origin: 'mon_phai',
    grade: 'trung_cap',
    sectName: 'Nga Mi',
    elementPath: 'am_nhu',
    maxLayer: 33,
    tier: 'huyen',
    paceFactor: 0.9,
    preferredSanctuaries: ['thuy', 'tuyet'],
    weaponSynergy: 'Nga Mi Kiếm · Hàn chưởng',
    description:
      'Nội công trung cấp phái Nga Mi, nội lực Âm Nhu thanh lãnh, chạm trần tại Tầng 33 (Đăng phong tạo cực).',
  },
  {
    id: 'sect_hoason_honnguyen2',
    name: 'Hoa Sơn Hỗn Nguyên Nhị Trọng',
    origin: 'mon_phai',
    grade: 'trung_cap',
    sectName: 'Hoa Sơn',
    elementPath: 'thai_cuc',
    maxLayer: 35,
    tier: 'huyen',
    paceFactor: 0.88,
    preferredSanctuaries: ['son', 'lam'],
    weaponSynergy: 'Hoa Sơn Kiếm · Phá Ngọc Quyền',
    description:
      'Nội công trung cấp tinh anh Hoa Sơn, dung hợp nội ngoại công, trần Tầng 35 (Vô dữ luận tỉ).',
  },
  {
    id: 'sect_thieulam_kimcang',
    name: 'Thiếu Lâm Kim Cang Phục Ma Công',
    origin: 'mon_phai',
    grade: 'trung_cap',
    sectName: 'Thiếu Lâm',
    elementPath: 'duong_cuong',
    maxLayer: 36,
    tier: 'huyen',
    paceFactor: 0.87,
    preferredSanctuaries: ['son', 'dong'],
    weaponSynergy: 'Kim Cang Chưởng · Phục Ma Côn',
    description:
      'Nội công trung cao cấp hộ tự Thiếu Lâm, chân khí Dương Cương hộ thể áp đảo, trần Tầng 36 (Sở hướng phí mị).',
  },

  // --- CAO CẤP / TRẤN PHÁI (Trần 47–53) ---
  {
    id: 'sect_caibang_hanglong',
    name: 'Cái Bang Hàng Long Khí Quyết',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Cái Bang',
    elementPath: 'duong_cuong',
    maxLayer: 47,
    tier: 'dia',
    paceFactor: 0.8,
    preferredSanctuaries: ['son', 'dong'],
    weaponSynergy: 'Hàng Long Chưởng · Đả Cẩu Bổng',
    description:
      'Nội công trấn phái Cái Bang chí cương chí mãnh, trần Tầng 47 (Thần công cái thế).',
  },
  {
    id: 'sect_hoason_tuha_tranphai',
    name: 'Tử Hà Thần Công (Trấn phái Hoa Sơn)',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Hoa Sơn',
    elementPath: 'thai_cuc',
    maxLayer: 48,
    tier: 'dia',
    paceFactor: 0.79,
    preferredSanctuaries: ['son', 'lam'],
    weaponSynergy: 'Hoa Sơn Kiếm Tông · Khí Tông',
    description:
      'Tuyệt học trấn phái Hoa Sơn nuôi dưỡng tử khí chí thuần, chạm trần Tầng 48 (Thần công cái thế).',
  },
  {
    id: 'sect_ngami_cuuam_tranphai',
    name: 'Cửu Âm Nga Mi Trấn Phái Tâm Kinh',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Nga Mi',
    elementPath: 'am_nhu',
    maxLayer: 48,
    tier: 'dia',
    paceFactor: 0.79,
    preferredSanctuaries: ['thuy', 'tuyet'],
    weaponSynergy: 'Ỷ Thiên Kiếm · Bạch Cốt Trảo',
    description:
      'Nội công trấn phái tối thượng của Nga Mi, âm nhu linh diệu, chạm trần Tầng 48 (Thần công cái thế).',
  },
  {
    id: 'sect_vodang_thaicuc',
    name: 'Thái Cực Thần Công (Trấn phái Võ Đang)',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Võ Đang',
    elementPath: 'thai_cuc',
    maxLayer: 52,
    tier: 'thien',
    paceFactor: 0.76,
    preferredSanctuaries: ['son', 'lam', 'thuy'],
    weaponSynergy: 'Thái Cực Kiếm · Thái Cực Quyền',
    description:
      'Nội công trấn phái bậc nhất Võ Đang, lấy tĩnh chế động âm dương viên dung, trần Tầng 52 (Cử thế vô song).',
  },
  {
    id: 'sect_thieulam_dichcan',
    name: 'Dịch Cân Kinh (Trấn phái Thiếu Lâm)',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Thiếu Lâm',
    elementPath: 'duong_cuong',
    maxLayer: 53,
    tier: 'thien',
    paceFactor: 0.75,
    preferredSanctuaries: ['son', 'dong'],
    weaponSynergy: 'Thiếu Lâm Thất Thập Nhị Tuyệt Kỹ',
    description:
      'Phật môn chí bảo cải tạo gân cốt nội tức, đỉnh cao nội công môn phái trần Tầng 53 (Cử thế vô song).',
  },
  // --- BÁT ĐẠI MÔN PHÁI BỔ SUNG (Quân Tử Đường · Cẩm Y Vệ · Cực Lạc Cốc) ---
  {
    id: 'sect_quantuduong_tieudao',
    name: 'Quân Tử Đường Tiêu Dao Tâm Pháp',
    origin: 'mon_phai',
    grade: 'trung_cap',
    sectName: 'Quân Tử Đường',
    elementPath: 'am_nhu',
    maxLayer: 36,
    tier: 'huyen',
    paceFactor: 0.88,
    preferredSanctuaries: ['lam', 'thuy'],
    weaponSynergy: 'Tiêu · Kiếm · Cước pháp nho nhã',
    description:
      'Nội công trung cấp Quân Tử Đường lấy cầm kỳ thi họa dưỡng khí Âm Nhu, chạm trần Tầng 36 (Sở hướng phí mị).',
  },
  {
    id: 'sect_camyve_huyetsat',
    name: 'Cẩm Y Vệ Huyết Sát Đao Kinh',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Cẩm Y Vệ',
    elementPath: 'duong_cuong',
    maxLayer: 49,
    tier: 'dia',
    paceFactor: 0.78,
    preferredSanctuaries: ['dong', 'son'],
    weaponSynergy: 'Tú Xuân Đao · Ưng Trảo · Huyết Sát Đao Pháp',
    description:
      'Nội công trấn phái Cẩm Y Vệ sát khí lẫm liệt, chuyên truy nã bức cung và phá phòng cương mãnh, trần Tầng 49 (Cử thế vô song).',
  },
  {
    id: 'sect_cuclaccoc_thienma',
    name: 'Cực Lạc Cốc Song Tu Thiên Ma Công',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Cực Lạc Cốc',
    elementPath: 'am_nhu',
    maxLayer: 50,
    tier: 'dia',
    paceFactor: 0.78,
    preferredSanctuaries: ['dong', 'tuyet'],
    weaponSynergy: 'Song thích · Độc chưởng · Ma đao quỷ dị',
    description:
      'Nội công tà phái trấn cốc của Cực Lạc Cốc, âm độc quỷ biến khó lường, chạm trần Tầng 50 (Cử thế vô song).',
  },
  // --- THẾ LỰC GIANG HỒ & ẨN THẾ (Di Hoa Cung · Đào Hoa Đảo · Vô Căn Môn · Kim Châm Thẩm Gia) ---
  {
    id: 'sect_dihoacung_minhngoc',
    name: 'Di Hoa Cung Minh Ngọc Công',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Di Hoa Cung',
    elementPath: 'am_nhu',
    maxLayer: 53,
    tier: 'thien',
    paceFactor: 0.75,
    preferredSanctuaries: ['tuyet', 'thuy'],
    weaponSynergy: 'Di Hoa Tiếp Ngọc · Hàn chưởng · Song kiếm',
    description:
      'Tuyệt học ẩn thế Di Hoa Cung tụ hàn khí nội liễm, càng đánh càng bền sức, trần Tầng 53 (Cử thế vô song).',
  },
  {
    id: 'sect_daohoadao_bichhai',
    name: 'Đào Hoa Đảo Bích Hải Triều Sinh Khúc',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Đào Hoa Đảo',
    elementPath: 'thai_cuc',
    maxLayer: 51,
    tier: 'dia',
    paceFactor: 0.77,
    preferredSanctuaries: ['thuy', 'lam'],
    weaponSynergy: 'Ngọc Tiêu Kiếm Pháp · Đàn Chỉ Thần Công',
    description:
      'Nội công ẩn thế Đào Hoa Đảo mượn âm luật thủy triều điều khí Thái Cực, trần Tầng 51 (Cử thế vô song).',
  },
  {
    id: 'sect_vocanmon_tichta',
    name: 'Vô Căn Môn Tịch Tà Tâm Kinh',
    origin: 'mon_phai',
    grade: 'tran_phai',
    sectName: 'Vô Căn Môn',
    elementPath: 'am_nhu',
    maxLayer: 52,
    tier: 'thien',
    paceFactor: 0.77,
    preferredSanctuaries: ['dong', 'lam'],
    weaponSynergy: 'Tịch Tà Kiếm · Ngân châm · Thân pháp quỷ mị',
    description:
      'Nội công ẩn thế Vô Căn Môn đẩy cực hạn tốc độ xuất chiêu Âm Nhu, chạm trần Tầng 52 (Cử thế vô song).',
  },
  {
    id: 'sect_kimchamthamgia_dokiep',
    name: 'Kim Châm Thẩm Gia Độ Kiếp Quyết',
    origin: 'mon_phai',
    grade: 'trung_cap',
    sectName: 'Kim Châm Thẩm Gia',
    elementPath: 'thai_cuc',
    maxLayer: 38,
    tier: 'huyen',
    paceFactor: 0.87,
    preferredSanctuaries: ['lam', 'thuy'],
    weaponSynergy: 'Kim Châm y võ · Điểm huyệt · Trị thương cứu người',
    description:
      'Nội công thế gia Kim Châm Thẩm Gia vừa điểm huyệt khắc địch vừa hộ mạch cứu thương, trần Tầng 38 (Sở hướng phí mị).',
  },
] as const;

export const WUXIA_EIGHT_GREAT_SECTS = [
  'Thiếu Lâm',
  'Võ Đang',
  'Nga Mi',
  'Cái Bang',
  'Đường Môn',
  'Quân Tử Đường',
  'Cẩm Y Vệ',
  'Cực Lạc Cốc',
] as const;

export const WUXIA_HIDDEN_FACTIONS = [
  'Di Hoa Cung',
  'Đào Hoa Đảo',
  'Vô Căn Môn',
  'Kim Châm Thẩm Gia',
  'Vô Môn Phái',
] as const;

/**
 * 15 bộ Nội công Giang hồ & Cổ phổ / Kỳ công tiêu biểu (không ràng buộc một môn phái,
 * hỗ trợ các mốc tầng cao 49 / 64 / 75 / 86 — cày cuốc dài hơi nhưng mở trần thực lực cực lớn).
 */
export const WUXIA_JIANGHU_INNER_ARTS: readonly WuxiaJianghuInnerArt[] = [
  {
    id: 'hon_nguyen_cong',
    name: 'Hỗn Nguyên Công',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'thai_cuc',
    maxLayer: 49,
    tier: 'huyen',
    paceFactor: 0.84,
    preferredSanctuaries: ['son', 'lam'],
    weaponSynergy: 'Kiếm · Chưởng · Nội ngoại kiêm tu',
    description:
      'Nội công giang hồ trung chính hòa bình, dễ luyện ít tẩu hỏa, mở trần tới Tầng 49 (Cử thế vô song).',
  },
  {
    id: 'ngu_hanh_tam_phap',
    name: 'Ngũ Hành Tâm Pháp',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'thai_cuc',
    maxLayer: 49,
    tier: 'huyen',
    paceFactor: 0.84,
    preferredSanctuaries: ['thuy', 'lam', 'son'],
    weaponSynergy: 'Kiếm · Đao · Chưởng đa hệ',
    description:
      'Vận chuyển ngũ khí tương sinh, hợp nhiều phúc địa ngũ hành, trần Tầng 49 (Cử thế vô song).',
  },
  {
    id: 'nghich_thien_ta_cong',
    name: 'Nghịch Thiên Tà Công',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'am_nhu',
    maxLayer: 49,
    tier: 'huyen',
    paceFactor: 0.88,
    preferredSanctuaries: ['dong', 'thuy'],
    weaponSynergy: 'Ám khí · Đao tà · Trảo pháp',
    description:
      'Tà công giang hồ tiến độ nhanh hơn đồng cấp nhưng dễ loạn khí nếu xung kích gấp, trần Tầng 49 (Cử thế vô song).',
  },
  {
    id: 'tu_ha_cong',
    name: 'Tử Hà Công',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'thai_cuc',
    maxLayer: 64,
    tier: 'dia',
    paceFactor: 0.74,
    preferredSanctuaries: ['son', 'lam'],
    weaponSynergy: 'Trường kiếm · Kiếm khí',
    description:
      'Bản giang hồ kỳ công nuôi dưỡng tử khí sâu thẳm, cày cuốc dài hơi mở trần Tầng 64 (Chấn cổ thước kim).',
  },
  {
    id: 'vo_vong_than_cong',
    name: 'Vô Vọng Thần Công',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'duong_cuong',
    maxLayer: 64,
    tier: 'dia',
    paceFactor: 0.74,
    preferredSanctuaries: ['son', 'dong'],
    weaponSynergy: 'Quyền · Chưởng · Trọng binh',
    description:
      'Nội công Dương Cương nổi danh giang hồ, bộc phát kình lực mạnh mẽ, mở trần Tầng 64 (Chấn cổ thước kim).',
  },
  {
    id: 'huyet_dao_kinh',
    name: 'Huyết Đao Kinh',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'duong_cuong',
    maxLayer: 64,
    tier: 'dia',
    paceFactor: 0.75,
    preferredSanctuaries: ['dong', 'son'],
    weaponSynergy: 'Đao pháp · Huyết sát',
    description:
      'Lấy sát ý thúc đẩy chân khí Dương Cương, cực hợp đao khách giang hồ, trần Tầng 64 (Chấn cổ thước kim).',
  },
  {
    id: 'doc_thiem_cong',
    name: 'Độc Thiềm Công',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'am_nhu',
    maxLayer: 64,
    tier: 'dia',
    paceFactor: 0.74,
    preferredSanctuaries: ['thuy', 'dong'],
    weaponSynergy: 'Chưởng độc · Ám khí · Cước pháp',
    description:
      'Âm độc nội công tích tụ hàn độc kình lực, kháng độc cao, mở trần Tầng 64 (Chấn cổ thước kim).',
  },
  {
    id: 'tuy_tien_quyet',
    name: 'Túy Tiên Quyết',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'thai_cuc',
    maxLayer: 64,
    tier: 'dia',
    paceFactor: 0.74,
    preferredSanctuaries: ['lam', 'thuy'],
    weaponSynergy: 'Túy quyền · Túy kiếm · Thân pháp',
    description:
      'Mượn ý say điều khí, thân pháp phiêu hốt khó đoán, mở trần Tầng 64 (Chấn cổ thước kim).',
  },
  {
    id: 'han_tieu_quyet',
    name: 'Hàn Tiêu Quyết',
    origin: 'giang_ho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'am_nhu',
    maxLayer: 64,
    tier: 'dia',
    paceFactor: 0.74,
    preferredSanctuaries: ['tuyet', 'thuy'],
    weaponSynergy: 'Kiếm hàn · Phi châm · Khinh công',
    description:
      'Hàn khí lạnh thấu xương, tăng uy lực chiêu thức Âm Nhu, mở trần Tầng 64 (Chấn cổ thước kim).',
  },
  {
    id: 'tan_duong_cong_quyet',
    name: 'Tàn Dương Công Quyết',
    origin: 'co_pho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'duong_cuong',
    maxLayer: 75,
    tier: 'thien',
    paceFactor: 0.65,
    preferredSanctuaries: ['son', 'dong'],
    weaponSynergy: 'Đao · Thương · Đại lực chưởng',
    description:
      'Cổ phổ Dương Cương bá đạo bậc nhất giang hồ (mốc 75 tầng), khổ luyện dài năm mở trần Siêu phàm nhập thánh.',
  },
  {
    id: 'bang_tam_quyet',
    name: 'Băng Tâm Quyết',
    origin: 'co_pho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'am_nhu',
    maxLayer: 75,
    tier: 'thien',
    paceFactor: 0.65,
    preferredSanctuaries: ['tuyet', 'thuy'],
    weaponSynergy: 'Song kiếm · Đơn kiếm · Hàn chưởng',
    description:
      'Cổ phổ Âm Nhu thanh lãnh sâu thẳm (mốc 75 tầng), kháng tâm ma/tẩu hỏa tốt, mở trần Siêu phàm nhập thánh.',
  },
  {
    id: 'hap_tinh_dai_phap',
    name: 'Hấp Tinh Đại Pháp',
    origin: 'co_pho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'am_nhu',
    maxLayer: 75,
    tier: 'thien',
    paceFactor: 0.68,
    preferredSanctuaries: ['dong', 'thuy'],
    weaponSynergy: 'Chưởng · Trảo · Hút nội lực',
    description:
      'Kỳ công chấn động võ lâm (mốc 75 tầng), dẫn hút chân khí mạnh nhưng cần lọc tạp khí kẻo phản phệ.',
  },
  {
    id: 'nhuoc_thuy_than_dien',
    name: 'Nhược Thủy Thần Điển',
    origin: 'co_pho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'am_nhu',
    maxLayer: 75,
    tier: 'thien',
    paceFactor: 0.65,
    preferredSanctuaries: ['thuy', 'tuyet'],
    weaponSynergy: 'Kiếm mềm · Phiến · Chưởng nhu',
    description:
      'Cổ phổ lấy nhu khắc cương (mốc 75 tầng), chân khí miên man bất tận, mở trần Siêu phàm nhập thánh.',
  },
  {
    id: 'quy_hoa_bao_dien',
    name: 'Quỳ Hoa Bảo Điển',
    origin: 'co_pho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'am_nhu',
    maxLayer: 86,
    tier: 'chiton',
    paceFactor: 0.58,
    preferredSanctuaries: ['lam', 'tuyet'],
    weaponSynergy: 'Kim châm · Tốc kiếm · Cực tốc thân pháp',
    description:
      'Tuyệt thế cổ phổ mốc 86 tầng, khổ luyện cực khó nhưng tốc độ xuất chiêu & trần thực lực đạt đỉnh thiên hạ.',
  },
  {
    id: 'hoi_minh_nhat_nguyet_giam',
    name: 'Hối Minh Nhật Nguyệt Giám',
    origin: 'co_pho',
    grade: 'giang_ho_ky_cong',
    elementPath: 'thai_cuc',
    maxLayer: 86,
    tier: 'chiton',
    paceFactor: 0.56,
    preferredSanctuaries: ['son', 'tuyet', 'dong'],
    weaponSynergy: 'Đao kiếm song tuyệt · Thái Cực toàn năng',
    description:
      'Chí tôn cổ phổ mốc 86 tầng, nhật nguyệt giao huy dung hòa âm dương, mở đỉnh tối thượng Siêu phàm nhập thánh.',
  },
] as const;

export const WUXIA_ALL_INNER_ARTS: readonly WuxiaJianghuInnerArt[] = [
  ...WUXIA_SECT_INNER_ARTS,
  ...WUXIA_JIANGHU_INNER_ARTS,
];

export function getWuxiaTitleByLayer(layer: number): WuxiaNineYinTitle {
  const safe = Math.max(1, Math.min(86, Math.round(layer || 1)));
  for (const tier of WUXIA_NINE_YIN_TITLES) {
    if (safe >= tier.minLayer && safe <= tier.maxLayer) {
      return tier;
    }
  }
  return WUXIA_NINE_YIN_TITLES[WUXIA_NINE_YIN_TITLES.length - 1];
}

export function getWuxiaTitleByRealmIndex(realmIndex: number): WuxiaNineYinTitle {
  const safeIdx = Math.max(
    0,
    Math.min(WUXIA_NINE_YIN_TITLES.length - 1, Math.round(realmIndex || 0)),
  );
  return WUXIA_NINE_YIN_TITLES[safeIdx] || WUXIA_NINE_YIN_TITLES[0];
}

export function findWuxiaInnerArtByName(
  name?: string | null,
): WuxiaJianghuInnerArt | undefined {
  const clean = (name || '').trim().toLowerCase();
  if (!clean) return undefined;
  const exact = WUXIA_ALL_INNER_ARTS.find(
    (art) => art.name.toLowerCase() === clean,
  );
  if (exact) return exact;
  return WUXIA_ALL_INNER_ARTS.find((art) =>
    clean.includes(art.name.toLowerCase()),
  );
}

/** Backward-compatible alias */
export const findJianghuInnerArtByName = findWuxiaInnerArtByName;

/**
 * Backward-compatibility mapper for older Wuxia saves that stored legacy realm names
 * (Tam Lưu / Nhị Lưu / Nhất Lưu / Hậu Thiên / Tiên Thiên / Tông Sư / Đại Tông Sư / Tuyệt Thế / Thiên Nhân Hợp Nhất)
 * into the 21-tier Cửu Âm strength title scale.
 */
export function mapLegacyWuxiaRealmToIndex(
  realmName?: string,
  legacyIndex?: number,
): number | null {
  const raw = (realmName || '').trim().toLowerCase();
  if (raw) {
    const exactNineYin = WUXIA_NINE_YIN_TITLES.findIndex((t) =>
      raw.includes(t.title.toLowerCase()),
    );
    if (exactNineYin >= 0) return exactNineYin;

    const layerMatch = raw.match(/tầng\s*(\d{1,2})/i);
    if (layerMatch) {
      const layerNum = parseInt(layerMatch[1], 10);
      if (Number.isFinite(layerNum) && layerNum >= 1) {
        return getWuxiaTitleByLayer(layerNum).index;
      }
    }

    if (/thiên\s*nhân\s*hợp\s*nhất|phá\s*toái/i.test(raw)) return 20;
    if (/tuyệt\s*thế/i.test(raw)) return 17;
    if (/đại\s*tông\s*sư/i.test(raw)) return 15;
    if (/tông\s*sư/i.test(raw)) return 14;
    if (/tiên\s*thiên.*(?:hậu|đỉnh)/i.test(raw)) return 12;
    if (/tiên\s*thiên/i.test(raw)) return 10;
    if (/hậu\s*thiên.*(?:viên\s*mãn|đỉnh|hậu)/i.test(raw)) return 8;
    if (/hậu\s*thiên.*trung/i.test(raw)) return 6;
    if (/hậu\s*thiên/i.test(raw)) return 5;
    if (/nhất\s*lưu/i.test(raw)) return 3;
    if (/nhị\s*lưu/i.test(raw)) return 1;
    if (/tam\s*lưu|nhập\s*môn/i.test(raw)) return 0;
  }
  if (typeof legacyIndex === 'number' && Number.isFinite(legacyIndex)) {
    return Math.max(
      0,
      Math.min(WUXIA_NINE_YIN_TITLES.length - 1, Math.round(legacyIndex)),
    );
  }
  return null;
}

export function createDefaultWuxiaState(realmIndex = 0): WuxiaMartialState {
  const tier = getWuxiaTitleByRealmIndex(realmIndex);
  // Pick a sensible starter inner art matching the character's starting layer
  let starter: WuxiaJianghuInnerArt = WUXIA_SECT_INNER_ARTS[1]; // Hoa Sơn Cơ Bản Nội Công (Nhập môn · trần 20T)
  if (tier.minLayer > 53) {
    starter = WUXIA_JIANGHU_INNER_ARTS[10]; // Băng Tâm Quyết / Cổ phổ 75T
    if (tier.minLayer > 75) {
      starter = WUXIA_JIANGHU_INNER_ARTS[14]; // Hối Minh Nhật Nguyệt Giám (86T)
    }
  } else if (tier.minLayer > 35) {
    starter = WUXIA_SECT_INNER_ARTS[13]; // Thái Cực Thần Công Trấn phái (52T)
  } else if (tier.minLayer > 20) {
    starter = WUXIA_SECT_INNER_ARTS[8]; // Hoa Sơn Hỗn Nguyên Nhị Trọng (Trung cấp · 35T)
  }

  return {
    innerLayer: Math.min(starter.maxLayer, tier.minLayer),
    innerMaxLayer: starter.maxLayer,
    activeInnerArtName: starter.name,
    innerArtOrigin: starter.origin,
    innerArtGrade: starter.grade,
    ...(starter.sectName ? { sectName: starter.sectName } : {}),
    elementPath: starter.elementPath,
    meridiansOpened: Math.min(8, Math.max(1, Math.floor(tier.index / 3) + 1)),
    activeSanctuary: 'none',
  };
}

export function normalizeWuxiaState(
  raw: unknown,
  realmIndex = 0,
): WuxiaMartialState {
  const fallback = createDefaultWuxiaState(realmIndex);
  const tier = getWuxiaTitleByRealmIndex(realmIndex);
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }
  const r = raw as Partial<WuxiaMartialState>;
  const activeInnerArtName =
    typeof r.activeInnerArtName === 'string' && r.activeInnerArtName.trim()
      ? r.activeInnerArtName.trim()
      : fallback.activeInnerArtName;
  const matchedCatalog = findWuxiaInnerArtByName(activeInnerArtName);

  const validPath: WuxiaElementPath =
    r.elementPath === 'duong_cuong' ||
    r.elementPath === 'am_nhu' ||
    r.elementPath === 'thai_cuc'
      ? r.elementPath
      : matchedCatalog?.elementPath || fallback.elementPath;

  const validSanctuary: WuxiaSanctuaryKind =
    r.activeSanctuary && WUXIA_SANCTUARY_ORDER.includes(r.activeSanctuary)
      ? r.activeSanctuary
      : 'none';

  const innerArtOrigin: WuxiaInnerArtOrigin =
    r.innerArtOrigin === 'mon_phai' ||
    r.innerArtOrigin === 'giang_ho' ||
    r.innerArtOrigin === 'co_pho'
      ? r.innerArtOrigin
      : matchedCatalog?.origin || 'giang_ho';

  const rawMax = Number(r.innerMaxLayer);
  const innerMaxLayer =
    Number.isFinite(rawMax) && rawMax >= 12 && rawMax <= 86
      ? Math.round(rawMax)
      : matchedCatalog?.maxLayer || fallback.innerMaxLayer;

  const innerArtGrade: WuxiaSectGrade =
    r.innerArtGrade === 'nhap_mon' ||
    r.innerArtGrade === 'trung_cap' ||
    r.innerArtGrade === 'tran_phai' ||
    r.innerArtGrade === 'giang_ho_ky_cong'
      ? r.innerArtGrade
      : matchedCatalog?.grade ||
        (innerArtOrigin === 'mon_phai'
          ? innerMaxLayer <= 22
            ? 'nhap_mon'
            : innerMaxLayer <= 38
              ? 'trung_cap'
              : 'tran_phai'
          : 'giang_ho_ky_cong');

  const sectName =
    typeof r.sectName === 'string' && r.sectName.trim()
      ? r.sectName.trim()
      : matchedCatalog?.sectName;

  const rawLayer = Number(r.innerLayer);
  let innerLayer =
    Number.isFinite(rawLayer) && rawLayer >= 1
      ? Math.max(1, Math.min(86, Math.round(rawLayer)))
      : tier.minLayer;

  // Strictly respect the active manual's ceiling so a low-tier sect manual never silently inflates beyond its cap
  innerLayer = Math.min(innerMaxLayer, innerLayer);

  const rawMeridians = Number(r.meridiansOpened);
  const meridiansOpened = Number.isFinite(rawMeridians)
    ? Math.max(0, Math.min(8, Math.round(rawMeridians)))
    : fallback.meridiansOpened;

  return {
    innerLayer,
    innerMaxLayer,
    activeInnerArtName,
    innerArtOrigin,
    innerArtGrade,
    ...(sectName ? { sectName } : {}),
    elementPath: validPath,
    meridiansOpened,
    activeSanctuary: validSanctuary,
  };
}

export interface WuxiaInnerArtCeilingInfo {
  activeArtName: string;
  origin: WuxiaInnerArtOrigin;
  originLabel: string;
  grade: WuxiaSectGrade;
  gradeLabel: string;
  sectName?: string;
  currentLayer: number;
  maxLayer: number;
  currentTitle: WuxiaNineYinTitle;
  maxAchievableTitle: WuxiaNineYinTitle;
  nextTitle?: WuxiaNineYinTitle;
  /** True when the active manual CANNOT break through to the next strength tier */
  isAtArtCeiling: boolean;
  /** True when currently practicing a sect manual with a lower cap than upper Jianghu manuals */
  isSectCapped: boolean;
  ceilingMessage: string;
  paceFactor: number;
}

/**
 * Evaluates the exact ceiling of the character's currently active Wuxia internal art.
 * Prevents low/mid-tier Sect manuals from endlessly advancing past their own layer cap
 * and keeps strength titles strictly aligned with the manual's ceiling.
 */
export function getWuxiaInnerArtCeilingInfo(
  profile: CultivationProfile,
): WuxiaInnerArtCeilingInfo {
  const ws = normalizeWuxiaState(profile.wuxiaState, profile.realmIndex);
  const matched = findWuxiaInnerArtByName(ws.activeInnerArtName);
  const origin = ws.innerArtOrigin || matched?.origin || 'giang_ho';
  const grade = ws.innerArtGrade || matched?.grade || 'giang_ho_ky_cong';
  const currentTitle = getWuxiaTitleByLayer(ws.innerLayer);
  const maxAchievableTitle = getWuxiaTitleByLayer(ws.innerMaxLayer);
  const nextTitle =
    currentTitle.index + 1 < WUXIA_NINE_YIN_TITLES.length
      ? WUXIA_NINE_YIN_TITLES[currentTitle.index + 1]
      : undefined;

  const isAtArtCeiling =
    ws.innerLayer >= ws.innerMaxLayer ||
    Boolean(nextTitle && nextTitle.minLayer > ws.innerMaxLayer);

  const originLabel = WUXIA_ORIGIN_META[origin].label;
  const gradeLabel = WUXIA_SECT_GRADE_META[grade].label;
  const paceFactor =
    matched?.paceFactor ?? WUXIA_SECT_GRADE_META[grade].paceFactor;

  const ceilingMessage = isAtArtCeiling
    ? origin === 'mon_phai'
      ? `Bộ nội công môn phái "${ws.activeInnerArtName}" (${gradeLabel}) đã chạm trần Tầng ${ws.innerMaxLayer} — ngang mốc "${maxAchievableTitle.title}". Cần đổi sang bộ nội công bậc cao hơn (Trung cấp / Trấn phái / Nội công giang hồ / Cổ phổ) hoặc bước ngoặt võ học để tiến xa hơn.`
      : `Bộ "${ws.activeInnerArtName}" (${originLabel}) đã chạm trần tối đa Tầng ${ws.innerMaxLayer} — ngang mốc "${maxAchievableTitle.title}". Hãy chuyển sang bộ Cổ phổ / Kỳ công mốc tầng cao hơn nếu muốn mở rộng giới hạn.`
    : `Bộ "${ws.activeInnerArtName}" (${originLabel} · ${gradeLabel}) có trần Tầng ${ws.innerMaxLayer}, tối đa đạt tới mốc "${maxAchievableTitle.title}" (${maxAchievableTitle.layerRangeLabel}).`;

  return {
    activeArtName: ws.activeInnerArtName,
    origin,
    originLabel,
    grade,
    gradeLabel,
    ...(ws.sectName ? { sectName: ws.sectName } : {}),
    currentLayer: ws.innerLayer,
    maxLayer: ws.innerMaxLayer,
    currentTitle,
    maxAchievableTitle,
    nextTitle,
    isAtArtCeiling,
    isSectCapped: origin === 'mon_phai' && ws.innerMaxLayer < 65,
    ceilingMessage,
    paceFactor,
  };
}

export interface WuxiaTitleReferenceRow {
  tier: WuxiaNineYinTitle;
  status: 'achieved' | 'current' | 'reachable' | 'above_ceiling';
  statusLabel: string;
  requirementNote: string;
}

/**
 * Generates the complete 21-tier strength title cross-reference table against
 * the character's currently active internal art & its ceiling.
 */
export function getWuxiaTitleReferenceRows(
  profile: CultivationProfile,
): WuxiaTitleReferenceRow[] {
  const ceiling = getWuxiaInnerArtCeilingInfo(profile);
  return WUXIA_NINE_YIN_TITLES.map((tier) => {
    if (tier.index === ceiling.currentTitle.index) {
      return {
        tier,
        status: 'current',
        statusLabel: ceiling.isAtArtCeiling
          ? `Đang đạt · Chạm trần T${ceiling.maxLayer}`
          : `Đang đạt (T${ceiling.currentLayer}/${ceiling.maxLayer})`,
        requirementNote: `Đạt ${tier.layerRangeLabel} nội công`,
      };
    }
    if (tier.index < ceiling.currentTitle.index) {
      return {
        tier,
        status: 'achieved',
        statusLabel: 'Đã vượt qua',
        requirementNote: `Đã vượt ${tier.layerRangeLabel}`,
      };
    }
    if (tier.minLayer <= ceiling.maxLayer) {
      return {
        tier,
        status: 'reachable',
        statusLabel: 'Trong tầm bộ hiện tại',
        requirementNote: `Cần luyện tới Tầng ${tier.minLayer}/${ceiling.maxLayer}`,
      };
    }
    const neededOriginHint =
      tier.minLayer >= 65
        ? 'Cần Cổ phổ / Kỳ công (75 – 86T)'
        : tier.minLayer >= 54
          ? 'Cần Nội công giang hồ / Cổ phổ (64 – 86T)'
          : tier.minLayer >= 39
            ? 'Cần Trấn phái hoặc Giang hồ (≥ 47T)'
            : 'Cần bộ Trung cấp trở lên';
    return {
      tier,
      status: 'above_ceiling',
      statusLabel: `Vượt trần (T${ceiling.maxLayer})`,
      requirementNote: `${neededOriginHint} · đạt Tầng ${tier.minLayer}+`,
    };
  });
}

/**
 * Infers a Wuxia Phúc địa / Thánh địa ngũ hành from story scene text when present.
 */
export function detectWuxiaSanctuaryFromScene(
  sceneText?: string,
): WuxiaSanctuaryKind {
  const lower = (sceneText || '').toLowerCase();
  if (!lower) return 'none';
  if (/(?:tuyết\s*phong|băng\s*cốc|đỉnh\s*tuyết|băng\s*động|phúc\s*địa\s*tuyết)/i.test(lower)) {
    return 'tuyet';
  }
  if (/(?:hàn\s*đàm|bích\s*thủy|linh\s*tuyền|thác\s*nước|phúc\s*địa\s*thủy)/i.test(lower)) {
    return 'thuy';
  }
  if (/(?:danh\s*sơn|tuyệt\s*đỉnh|vân\s*đỉnh|sơn\s*phong|phúc\s*địa\s*sơn)/i.test(lower)) {
    return 'son';
  }
  if (/(?:cổ\s*lâm|trúc\s*hải|rừng\s*trúc|tùng\s*lâm|phúc\s*địa\s*lâm)/i.test(lower)) {
    return 'lam';
  }
  if (/(?:thâm\s*động|địa\s*huyệt|bí\s*động|thạch\s*thất|mật\s*động|phúc\s*địa\s*động)/i.test(lower)) {
    return 'dong';
  }
  return 'none';
}

/**
 * Computes Wuxia monthly training speed multiplier from:
 * - Active inner art's inherent pace difficulty (Sect Intro faster vs 75T/86T Cổ phổ slower & deeper)
 * - Phúc địa / Thánh địa ngũ hành matching Dương Cương / Âm Nhu / Thái Cực
 * - Opened meridians (Bát Mạch Kỳ Kinh)
 * - Fortuitous encounters / master guidance cues in story scene
 */
export function computeWuxiaTrainingMultiplier(
  profile: CultivationProfile,
  sceneText?: string,
): { multiplier: number; bonusLabel?: string } {
  if (profile.systemKind !== 'wuxia') return { multiplier: 1.0 };
  const ws = normalizeWuxiaState(profile.wuxiaState, profile.realmIndex);
  const ceiling = getWuxiaInnerArtCeilingInfo(profile);
  const sceneSanctuary = detectWuxiaSanctuaryFromScene(sceneText);
  const effectiveSanctuary: WuxiaSanctuaryKind =
    sceneSanctuary !== 'none'
      ? sceneSanctuary
      : ws.activeSanctuary || 'none';

  let mult = ceiling.paceFactor;
  const reasons: string[] = [];

  if (effectiveSanctuary !== 'none') {
    const sMeta = WUXIA_SANCTUARY_META[effectiveSanctuary];
    const isMatched = sMeta.favoredPaths.includes(ws.elementPath);
    if (isMatched) {
      mult *= effectiveSanctuary === 'tuyet' ? 1.28 : 1.25;
      reasons.push(`Hợp ${sMeta.shortLabel}`);
    } else {
      mult *= 1.1;
      reasons.push(sMeta.shortLabel);
    }
  }

  // Meridians opened gently accelerate monthly Qi accumulation (+2.5% per meridian above 2, max +16%)
  if (ws.meridiansOpened >= 3) {
    mult *= 1 + Math.min(0.16, (ws.meridiansOpened - 2) * 0.025);
  }

  const lower = (sceneText || '').toLowerCase();
  if (
    /(?:đả\s*thông\s*kinh\s*mạch|thông\s*mạch|cao\s*nhân\s*chỉ\s*điểm|được\s*chỉ\s*điểm|truyền\s*công|bí\s*tịch\s*thất\s*truyền|thánh\s*địa|phúc\s*địa)/i.test(
      lower,
    )
  ) {
    mult *= 1.22;
    reasons.push('Cơ duyên / chỉ điểm');
  }

  return {
    multiplier: Math.max(0.45, Math.min(1.65, Number(mult.toFixed(2)))),
    ...(reasons.length > 0 ? { bonusLabel: reasons.join(' · ') } : {}),
  };
}

const YANG_KEYWORDS_RE =
  /(?:dương|cương|huyết\s*đao|tàn\s*dương|vô\s*vọng|hàng\s*long|đại\s*lực|liệt\s*hỏa|trọng\s*đao|đại\s*đao|trường\s*thương|côn|bổng|quyền|dịch\s*cân|la\s*hán|kim\s*cang)/i;
const YIN_KEYWORDS_RE =
  /(?:âm|nhu|băng\s*tâm|hàn\s*tiêu|quỳ\s*hoa|nhược\s*thủy|độc\s*thiềm|hấp\s*tinh|nghịch\s*thiên|tịch\s*tà|ngọc\s*nữ|ám\s*khí|kim\s*châm|phi\s*đao|độc|lục\s*hợp|thanh\s*tâm)/i;
const TAIJI_KEYWORDS_RE =
  /(?:thái\s*cực|hỗn\s*nguyên|tử\s*hà|ngũ\s*hành|túy\s*tiên|hối\s*minh|nhật\s*nguyệt|thái\s*thanh|thanh\s*phong|vô\s*cực|lưỡng\s*nghi|hoa\s*sơn|võ\s*đang)/i;

/**
 * Evaluates Dương Cương / Âm Nhu / Thái Cực harmony across active internal art,
 * practiced martial arts, equipped gear, and opened meridians (Bát Mạch Kỳ Kinh).
 */
export function evaluateWuxiaSynergy(profile: CultivationProfile): {
  breakthroughDelta: number;
  meridianDelta: number;
  alignmentTone: 'positive' | 'negative' | 'neutral';
  alignmentLabel: string;
  alignmentDetail: string;
  meridianLabel: string;
  meridianDetail: string;
} {
  const ws = normalizeWuxiaState(profile.wuxiaState, profile.realmIndex);
  const pathMeta = WUXIA_ELEMENT_PATH_META[ws.elementPath];

  const techText = (profile.techniques || [])
    .map((t) => `${t.name} ${t.description || ''}`)
    .join(' ');
  const equippedIds = Object.values(profile.equipment || {}).filter(Boolean);
  const equipText = (profile.inventory || [])
    .filter((i) => equippedIds.includes(i.id))
    .map((i) => `${i.name} ${i.description || ''}`)
    .join(' ');
  const combined = `${ws.activeInnerArtName} ${techText} ${equipText}`;

  const hasYang = YANG_KEYWORDS_RE.test(combined);
  const hasYin = YIN_KEYWORDS_RE.test(combined);
  const hasTaiji = TAIJI_KEYWORDS_RE.test(combined);

  let breakthroughDelta = 0;
  let alignmentTone: 'positive' | 'negative' | 'neutral' = 'neutral';
  let alignmentLabel = `Lộ tuyến ${pathMeta.shortLabel}`;
  let alignmentDetail = `${ws.activeInnerArtName} · ${pathMeta.weaponHint}`;

  if (ws.elementPath === 'thai_cuc') {
    breakthroughDelta = hasTaiji ? 7 : 4;
    alignmentTone = 'positive';
    alignmentLabel = 'Thái Cực dung hòa';
    alignmentDetail =
      'Nội tức âm dương tương tế, tương thích tốt với võ công & binh khí, giảm mạnh rủi ro tẩu hỏa';
  } else if (ws.elementPath === 'duong_cuong') {
    if (hasYin && !hasYang && !hasTaiji) {
      breakthroughDelta = -7;
      alignmentTone = 'negative';
      alignmentLabel = 'Xung khắc Dương Cương – Âm Nhu';
      alignmentDetail =
        'Nội công Dương Cương đang dùng kèm bộ võ công thiên Âm Nhu, dễ gây nghịch khí khi xung kích';
    } else if (hasYang) {
      breakthroughDelta = 6;
      alignmentTone = 'positive';
      alignmentLabel = 'Dương Cương tương hợp';
      alignmentDetail =
        'Nội công, bộ võ học và binh khí đồng thuận Dương Cương, xung kích bình cảnh thêm uy lực';
    } else {
      breakthroughDelta = 2;
      alignmentTone = 'positive';
      alignmentLabel = 'Dương Cương ổn định';
      alignmentDetail = pathMeta.weaponHint;
    }
  } else {
    if (hasYang && !hasYin && !hasTaiji) {
      breakthroughDelta = -7;
      alignmentTone = 'negative';
      alignmentLabel = 'Xung khắc Âm Nhu – Dương Cương';
      alignmentDetail =
        'Nội công Âm Nhu đang phối cùng võ công thiên Dương Cương, chân khí khó hòa hợp khi đột phá';
    } else if (hasYin) {
      breakthroughDelta = 6;
      alignmentTone = 'positive';
      alignmentLabel = 'Âm Nhu tương hợp';
      alignmentDetail =
        'Nội công, bộ võ công và binh khí đồng điệu Âm Nhu, khí tức tinh tế dễ xuyên bình cảnh';
    } else {
      breakthroughDelta = 2;
      alignmentTone = 'positive';
      alignmentLabel = 'Âm Nhu ổn định';
      alignmentDetail = pathMeta.weaponHint;
    }
  }

  const m = ws.meridiansOpened;
  const meridianDelta =
    m >= 7 ? 10 : m >= 5 ? 7 : m >= 3 ? 4 : m >= 1 ? 1 : -4;
  const meridianLabel = `Kinh mạch (${m}/8 mạch)`;
  const meridianDetail =
    m >= 6
      ? 'Kỳ kinh bát mạch khai thông rộng mở, chân khí lưu chuyển thông suốt khi đột phá'
      : m >= 3
        ? 'Đã đả thông một số kinh mạch chính, hỗ trợ dẫn khí vượt bình cảnh'
        : 'Kinh mạch khai mở còn ít — nên đả thông thêm kỳ kinh để nâng tỷ lệ đột phá';

  return {
    breakthroughDelta,
    meridianDelta,
    alignmentTone,
    alignmentLabel,
    alignmentDetail,
    meridianLabel,
    meridianDetail,
  };
}

/**
 * Formatted concise reference summary of all 21 Cửu Âm titles, Sect-tier ceilings,
 * and Jianghu / Ancient manual rules for Kiếm hiệp AI context injection.
 */
export const WUXIA_NINE_YIN_AI_RULE_NOTE =
  'Quy chuẩn Kiếm hiệp Thế giới mở (Cửu Âm Chân Kinh): (a) KHÔNG dùng Level hay thanh EXP máy móc trong lời kể — nhân vật trưởng thành qua rèn giũa Nội Công, lĩnh ngộ Chiêu Thức, đả thông Kinh Mạch, tích lũy Danh Vọng và dệt Mối Quan Hệ Giang Hồ. (b) Phân hóa Nội công & 21 Tôn hiệu Cửu Âm: Nội công Môn phái chia rõ Nhập môn (trần T18–22), Trung cấp (trần T31–38) và Trấn phái (trần T47–53) — chạm trần bộ nào phải dừng ở mức đó và đổi bộ cao hơn mới tiến tiếp; Nội công Giang hồ & Cổ phổ (49/64/75/86 tầng) cày cuốc dài hơi mới chạm ngưỡng Chấn cổ thước kim & Siêu phàm nhập thánh; TUYỆT ĐỐI không gán tôn hiệu vượt trần bộ nội công đang luyện. (c) Tam giác khắc chế thực chiến: Thực Chiêu (xuất chiêu trực diện) phá Hư Chiêu (phá thủ/nhử đòn) → Hư Chiêu phá Giá Chiêu (vận kình đỡ đòn/phản kích) → Giá Chiêu chặn Thực Chiêu — khi giao đấu luôn tả rõ thế chiêu, nhịp thở, góc ra đòn và sự tương khắc này. (d) Hệ phái giang hồ chuẩn: Bát Đại Môn Phái (Thiếu Lâm, Võ Đang, Nga Mi, Cái Bang, Đường Môn, Quân Tử Đường, Cẩm Y Vệ, Cực Lạc Cốc), Thế Lực Ẩn Thế (Di Hoa Cung, Đào Hoa Đảo, Vô Căn Môn, Kim Châm Thẩm Gia) hoặc Vô Môn Phái. (e) Đời sống giang hồ sống động: lồng ghép tự nhiên các biến cố Đoạt Thư (cướp tàn quyển bí kíp tại Tàng Kinh Các/mật thất/đoàn hộ tống, thủ vệ sơn môn hoặc ngư ông đắc lợi) và Bắt Giữ / Giải Cứu — Ân Oán Truy Nã (Tà đạo bắt giữ ép cung/chuộc/bán tăng Sát khí & bị truy nã; Chính đạo chặn đường giải cứu tăng Chính khí & Danh vọng).';
