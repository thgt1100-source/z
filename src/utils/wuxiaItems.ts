import type {
  CultivationProfile,
  EquipmentSlotId,
  InventoryItem,
  InventoryItemCategory,
  InventoryItemQuality,
} from '../types/ark';

export type WuxiaCatalogGroupId =
  | 'than_binh'
  | 'ngoai_trang'
  | 'linh_duoc'
  | 'bi_kip'
  | 'hanh_tau';

export interface WuxiaCatalogGroupMeta {
  id: WuxiaCatalogGroupId;
  label: string;
  shortLabel: string;
  hint: string;
}

export const WUXIA_CATALOG_GROUPS: readonly WuxiaCatalogGroupMeta[] = [
  {
    id: 'than_binh',
    label: 'Thần binh lợi khí',
    shortLabel: 'Thần binh',
    hint: 'Kiếm, đao, bổng, tiêu & ám khí danh chấn giang hồ',
  },
  {
    id: 'ngoai_trang',
    label: 'Ngoại trang & Y giáp',
    shortLabel: 'Ngoại trang',
    hint: 'Cổ trang tinh xảo, y phục tăng khí chất danh tiếng & hộ thân',
  },
  {
    id: 'linh_duoc',
    label: 'Linh dược võ lâm',
    shortLabel: 'Linh dược',
    hint: 'Kim sang dược, hoàn đan dưỡng khí, giải độc & tục mệnh cao',
  },
  {
    id: 'bi_kip',
    label: 'Bí kíp · Tàn quyển · Tín vật',
    shortLabel: 'Bí kíp · Tín vật',
    hint: 'Tàn quyển võ học, cầm phổ, ngọc bội & mật lệnh giang hồ',
  },
  {
    id: 'hanh_tau',
    label: 'Lộ phí, Bạc & Đồ hành tẩu',
    shortLabel: 'Lộ phí · Chế tác',
    hint: 'Bạc, ngân phiếu, hoàng kim, đồ hành tẩu & nguyên liệu rèn may',
  },
] as const;

export interface WuxiaCatalogItem {
  id: string;
  name: string;
  group: WuxiaCatalogGroupId;
  category: InventoryItemCategory;
  quality: InventoryItemQuality;
  defaultQuantity: number;
  description: string;
  equipSlot?: EquipmentSlotId;
  /** Optional NPC reaction / social prestige note when worn or carried visibly. */
  prestigeCue?: string;
}

export const WUXIA_ITEM_CATALOG: readonly WuxiaCatalogItem[] = [
  // =========================================================================
  // 1) THẦN BINH LỢI KHÍ (Vũ khí xịn & Ám khí)
  // =========================================================================
  {
    id: 'wx_wp_thiet_kiem_pho_thong',
    name: 'Thiết Kiếm Phổ Thông',
    group: 'than_binh',
    category: 'weapon',
    quality: 'common',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Kiếm sắt rèn thông thường bán tại tiệm rèn trấn nhỏ, lưỡi cứng nhưng hơi nặng, phù hợp người mới bước chân vào giang hồ.',
    prestigeCue: 'Binh khí phổ thông thường thấy của lính tuần hoặc đệ tử ngoại môn.',
  },
  {
    id: 'wx_wp_thanh_phong',
    name: 'Thanh Phong Trường Kiếm',
    group: 'than_binh',
    category: 'weapon',
    quality: 'uncommon',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Trường kiếm bách luyện cân bằng nhẹ tay, vỏ kiếm khắc vân mây xanh nhạt, phù hợp hiệp khách sơ nhập giang hồ.',
    prestigeCue: 'Binh khí rèn tốt, vừa mắt giới võ lâm phổ thông.',
  },
  {
    id: 'wx_wp_han_thiet_doan_dao',
    name: 'Hàn Thiết Đoản Đao',
    group: 'than_binh',
    category: 'weapon',
    quality: 'uncommon',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Đoản đao rèn từ hàn thiết trộn tinh cương, sống đao dày sắc bén, tiện giấu trong tay áo hoặc giao chiến cận thân.',
    prestigeCue: 'Đao khách tinh mắt sẽ chú ý ánh thép lạnh của lưỡi đao.',
  },
  {
    id: 'wx_wp_lanh_nguyet_bao_dao',
    name: 'Lãnh Nguyệt Bảo Đao',
    group: 'than_binh',
    category: 'weapon',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Bảo đao cong tựa trăng khuyết, ánh thép lạnh như sương thu; khi vung nhanh kéo theo một vệt ngân quang rét buốt.',
    prestigeCue: 'Danh đao Thượng phẩm, đủ khiến cao thủ tuần tra hay sơn tặc kiêng dè.',
  },
  {
    id: 'wx_wp_ngoc_tieu_bich_hai',
    name: 'Ngọc Tiêu Bích Hải',
    group: 'than_binh',
    category: 'weapon',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Ống tiêu ngọc bích dài một thước tám tấc, vừa thổi khúc dẫn sóng kình nội lực vừa làm đoản binh điểm huyệt cực hiểm.',
    prestigeCue: 'Phong thái nho nhã ẩn chứa sát cơ, khiến người trong giang hồ liên tưởng Đào Hoa Đảo hoặc Quân Tử Đường.',
  },
  {
    id: 'wx_wp_huyen_thiet_trong_kiem',
    name: 'Huyền Thiết Trọng Kiếm',
    group: 'than_binh',
    category: 'weapon',
    quality: 'epic',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Đại kiếm đúc từ huyền thiết đen kịt nặng hơn sáu mươi cân, không mũi nhọn nhưng trọng kiếm vô phong đại xảo bất công, chấn nát binh khí thường.',
    prestigeCue: 'Kiếm khách thấy thanh trọng kiếm đen sì nặng trịch sẽ chấn động vì nội lực và kình lực của người cầm.',
  },
  {
    id: 'wx_wp_kim_xa_kiem',
    name: 'Kim Xà Kiếm',
    group: 'than_binh',
    category: 'weapon',
    quality: 'epic',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Dị kiếm uốn lượn như rắn vàng, mũi kiếm chẻ đôi hình lưỡi rắn, chuyên khóa binh khí đối phương và đâm góc hiểm hóc.',
    prestigeCue: 'Hình dáng quái dị nổi danh Kim Xà Lang Quân — dễ khiến người giang hồ dè chừng hoặc dò xét lai lịch.',
  },
  {
    id: 'wx_wp_tu_vi_nhuyen_kiem',
    name: 'Tử Vi Nhuyễn Kiếm',
    group: 'than_binh',
    category: 'weapon',
    quality: 'epic',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Thanh nhuyễn kiếm ánh tím mảnh dẻ mềm dẻo có thể quấn quanh thắt lưng như đai ngọc, rút ra lập tức thẳng tắp như tia chớp.',
    prestigeCue: 'Bảo kiếm tinh xảo bậc nhất, thường chỉ truyền nhân thế gia hoặc cao thủ nổi danh mới sở hữu.',
  },
  {
    id: 'wx_wp_bao_vu_le_hoa_cham',
    name: 'Bạo Vũ Lê Hoa Châm',
    group: 'than_binh',
    category: 'weapon',
    quality: 'epic',
    defaultQuantity: 1,
    equipSlot: 'relic',
    description:
      'Ống cơ quan bạc tinh xảo chứa hai mươi bảy ngân châm rỗng thân, một lần phát ra rào rạt tựa mưa hoa lê xuyên thủng hộ thể.',
    prestigeCue: 'Ám khí trấn môn nổi danh khiến cao thủ chính tà đều phải giữ khoảng cách đề phòng.',
  },
  {
    id: 'wx_wp_da_cau_bong',
    name: 'Đả Cẩu Bổng (Trúc Ngọc)',
    group: 'than_binh',
    category: 'weapon',
    quality: 'legendary',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Bảo trượng xanh biếc như ngọc trúc, cứng hơn tinh cương mà nhẹ tựa cành liễu, tín vật chí tôn truyền đời của bang chủ Cái Bang.',
    prestigeCue: 'Thần vật chấn động võ lâm! Người trong giang hồ nhìn thấy lập tức nhận ra địa vị liên quan tới Cái Bang hoặc đại cơ duyên.',
  },
  {
    id: 'wx_wp_y_thien_kiem',
    name: 'Ỷ Thiên Kiếm',
    group: 'than_binh',
    category: 'weapon',
    quality: 'legendary',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Võ lâm chí tôn bảo kiếm rèn từ huyền thiết và tinh kim, hàn quang rợn người, chém sắt như chém bùn, ẩn giấu bí mật võ học cái thế.',
    prestigeCue: 'Tuyệt thế thần binh đứng đầu thiên hạ! Hễ lộ diện sẽ khiến quần hùng kinh hãi, nể trọng hoặc điên cuồng dòm ngó tranh đoạt.',
  },
  {
    id: 'wx_wp_do_long_dao',
    name: 'Đồ Long Đao',
    group: 'than_binh',
    category: 'weapon',
    quality: 'legendary',
    defaultQuantity: 1,
    equipSlot: 'weapon',
    description:
      'Võ lâm chí tôn bảo đao nặng trăm cân, sát khí lẫm liệt uy chấn bốn bể — "Võ lâm chí tôn, bảo đao Đồ Long, hiệu lệnh thiên hạ, mạc cảm bất tòng".',
    prestigeCue: 'Bảo đao truyền thuyết khiến cả chính đạo lẫn ma đạo sôi sục, kẻ yếu khiếp vía, kẻ tham lam rắp tâm đoạt bảo.',
  },
  {
    id: 'wx_wp_khong_tuoc_linh',
    name: 'Khổng Tước Linh',
    group: 'than_binh',
    category: 'weapon',
    quality: 'immortal',
    defaultQuantity: 1,
    equipSlot: 'relic',
    description:
      'Đệ nhất ám khí truyền thuyết đúc bằng hoàng kim khảm bảo thạch hình ống trụ, khi phát động rực rỡ như chim công xòe đuôi lấy mạng trong chớp mắt.',
    prestigeCue: 'Ám khí Tuyệt thế vô song — chỉ cần nhắc tên đã khiến tôn sư giang hồ biến sắc kinh kiêng.',
  },

  // =========================================================================
  // 2) NGOẠI TRANG & Y GIÁP LÀM ĐẸP (Y phục giang hồ)
  // =========================================================================
  {
    id: 'wx_out_thanh_sam',
    name: 'Thanh Sam Thư Sinh Bào',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'common',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Áo dài vải gai xanh nhạt may gọn gàng, sạch sẽ, không phô trương khi đi qua trấn nhỏ hay quán trà.',
    prestigeCue: 'Trang phục giản dị bình thường, ít gây chú ý hay lòng tham.',
  },
  {
    id: 'wx_out_da_hanh_y',
    name: 'Huyền Y Dạ Hành Y',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'uncommon',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Bộ trang phục đen tuyền bó gọn từ vải tơ tối màu không phản sáng, kèm hộ uyển da thuộc giúp ẩn thân ban đêm và tăng tốc độ di chuyển.',
    prestigeCue: 'Toát vẻ bí ẩn lạnh lùng của thích khách hoặc cao thủ hành động trong đêm.',
  },
  {
    id: 'wx_out_bach_y_hiep_khach',
    name: 'Bạch Y Thắng Tuyết Hiệp Khách Phục',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Trường bào trắng muốt như tuyết thêu chỉ bạc vân mây nơi vạt áo, cổ tay viền gấm thanh nhã, tôn bật khí chất hiệp khách tiêu sái bất phàm.',
    prestigeCue: 'Phong thái hào hoa xuất trần, đi tới tửu lầu hay trà quán dễ thu hút ánh nhìn ngưỡng mộ và nể trọng.',
  },
  {
    id: 'wx_out_tu_ha_dao_bao',
    name: 'Tử Hà Đạo Bào',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Đạo bào lụa tía thêu đồ án bát quái kim tuyến, chất vải thoáng nhẹ dẫn khí điều hòa kinh mạch và giảm chấn lực chưởng phong.',
    prestigeCue: 'Khí độ danh môn chính phái thanh cao, khiến đạo sĩ và khách giang hồ nể nang vài phần.',
  },
  {
    id: 'wx_out_tuyet_ho_cuu',
    name: 'Tuyết Hồ Cừu Áo Choàng',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Áo choàng cổ lông cáo tuyết trắng muốt phủ ngoài gấm lạnh, chống rét cắt da vùng biên ải và kháng hàn khí nhẹ.',
    prestigeCue: 'Vẻ ngoài quý phái sang trọng, nhìn qua liền biết xuất thân giàu sang hoặc danh gia vọng tộc.',
  },
  {
    id: 'wx_out_phi_ngu_phuc',
    name: 'Phi Ngư Phục Cẩm Y Vệ',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'epic',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Mãng bào thêu hình Phi Ngư kim tuyến sắc sảo trên nền gấm đỏ thẫm hoặc huyền thanh, thắt đai ngọc nạm đồng — uy nghi lẫm liệt của Cẩm Y Vệ.',
    prestigeCue: 'Uy áp triều đình cực mạnh! Dân thường và tiểu nhị cúi đầu kính sợ, giang hồ nhân sĩ dè chừng kiêng kỵ hoặc thù địch.',
  },
  {
    id: 'wx_out_luu_van_cam_bao',
    name: 'Lưu Vân Cẩm Bào',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'epic',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Cẩm bào dệt từ gấm Vân Cẩm kinh thành, họa tiết mây trôi óng ánh dưới nắng, lót tơ tằm dai chắc hộ thân trước đao kiếm thường.',
    prestigeCue: 'Vô cùng hoa lệ và đắt giá, đi đâu cũng được chưởng quỹ niềm nở tiếp đón nhưng dễ bị đạo tặc để mắt.',
  },
  {
    id: 'wx_out_lang_la_vu_y',
    name: 'Lăng La Vũ Y',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'epic',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Y phục dệt từ lụa Lăng La mỏng nhẹ như cánh ve, dải lụa bay bổng theo từng bước khinh công, ẩn chứa sợi tơ bền dẻo chống ám khí.',
    prestigeCue: 'Tiên phong đạo cốt, mỹ cảm tuyệt luân — tăng mạnh thiện cảm, khí chất và sự trầm trồ của người đối diện.',
  },
  {
    id: 'wx_out_nhuyen_vi_giap',
    name: 'Nhuyễn Vị Giáp (Giáp lông nhím)',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'legendary',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Nội giáp kỳ bảo đan từ gai nhím thép và tơ dai, mặc lót bên trong hoặc khoác ngoài đều được; đao kiếm khó đâm xuyên, kẻ đánh chưởng trực tiếp sẽ bị gai nhọn đâm ngược tay.',
    prestigeCue: 'Trấn bảo hộ thân truyền thuyết của Đào Hoa Đảo — cao thủ giao thủ chạm phải lập tức kinh hãi thất sắc.',
  },
  {
    id: 'wx_out_kim_ti_bao_giap',
    name: 'Kim Ti Bảo Giáp',
    group: 'ngoai_trang',
    category: 'outfit',
    quality: 'immortal',
    defaultQuantity: 1,
    equipSlot: 'armor',
    description:
      'Bảo giáp tối thượng dệt từ tơ Thiên Tằm trộn kim tuyến tinh luyện, nhẹ như giấy mà đao thương bất nhập, nước lửa khó xâm, tỏa kim quang ẩn hiện.',
    prestigeCue: 'Chí bảo hộ thân vô giá — kẻ nhìn thấu ánh kim tuyến đều thèm muốn tột độ hoặc kính phục gia thế hiển hách.',
  },

  // =========================================================================
  // 3) LINH DƯỢC VÕ LÂM (Đan dược giang hồ)
  // =========================================================================
  {
    id: 'wx_med_kim_sang_duoc',
    name: 'Kim Sang Dược',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'common',
    defaultQuantity: 4,
    description:
      'Thuốc bột cầm máu truyền thống của người hành tẩu giang hồ, rắc lên vết chém lập tức se miệng vết thương.',
  },
  {
    id: 'wx_med_tieu_hoan_dan',
    name: 'Tiểu Hoàn Đan',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'uncommon',
    defaultQuantity: 3,
    description:
      'Đan hoàn dưỡng khí trứ danh của Thiếu Lâm, uống vào lập tức bổ sung nội lực hao tổn và điều hòa hơi thở.',
  },
  {
    id: 'wx_med_bach_thao_giai_doc',
    name: 'Bách Thảo Giải Độc Đan',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'uncommon',
    defaultQuantity: 2,
    description:
      'Bào chế từ trăm vị thảo dược thanh nhiệt, hóa giải phần lớn chướng khí, độc trùng và dư độc tích tụ trong cơ thể.',
  },
  {
    id: 'wx_med_dai_hoan_dan',
    name: 'Đại Hoàn Đan',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'rare',
    defaultQuantity: 1,
    description:
      'Thánh dược hộ mạch trị nội thương bậc nhất võ lâm, tăng mạnh chân khí tích lũy và hỗ trợ xung kích bình cảnh nội công.',
  },
  {
    id: 'wx_med_cuu_hoa_ngoc_lo',
    name: 'Cửu Hoa Ngọc Lộ Hoàn',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'rare',
    defaultQuantity: 2,
    description:
      'Mật dược Đào Hoa Đảo ngưng tụ từ sương sớm chín loài hoa quý, hương thơm thanh khiết giúp an thần định tâm, hồi phục nhanh tinh thần và khí huyết.',
  },
  {
    id: 'wx_med_hac_ngoc_doan_tuc_cao',
    name: 'Hắc Ngọc Đoạn Tục Cao',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Thần cao đen bóng quý hiếm nối liền gân cốt đứt gãy, chữa khỏi trọng thương kinh mạch mà không để lại di chứng.',
  },
  {
    id: 'wx_med_thien_huong_doan_tuc_giao',
    name: 'Thiên Hương Đoạn Tục Giao',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Linh giao quý giá của Hằng Sơn / Thục Trung, bôi lên vết thương hiểm nghèo giúp da thịt tái sinh, giữ trọn sinh mệnh trước quỷ môn quan.',
  },
  {
    id: 'wx_med_tay_tuy_phat_cot_tan',
    name: 'Tẩy Tủy Phạt Cốt Tán',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Dược tán cổ phương giúp bài trừ tạp chất trong gân cốt, mở rộng kinh mạch và nâng cao căn cơ nội công rõ rệt.',
  },
  {
    id: 'wx_med_tuc_menh_bat_bao_hoan',
    name: 'Tục Mệnh Bát Bảo Hoàn',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'legendary',
    defaultQuantity: 1,
    description:
      'Kỳ dược luyện từ tám vị trân bảo thiên sơn, giữ lại một hơi tàn khi sắp tắt thở và thúc đẩy công lực tiến triển mạnh mẽ.',
  },
  {
    id: 'wx_med_bang_tam_tuyet_lien',
    name: 'Băng Tằm Tuyết Liên Đan',
    group: 'linh_duoc',
    category: 'consumable',
    quality: 'immortal',
    defaultQuantity: 1,
    description:
      'Tuyệt thế linh đan kết tinh từ tằm băng Thiên Sơn và tuyết liên nghìn năm, tẩy tủy thoát thai, bách độc bất xâm, tăng vọt nội lực thuần khiết.',
  },

  // =========================================================================
  // 4) BÍ KÍP, TÀN QUYỂN & TÍN VẬT GIANG HỒ
  // =========================================================================
  {
    id: 'wx_bk_bach_ngoc_boi',
    name: 'Bạch Ngọc Tĩnh Tâm Bội',
    group: 'bi_kip',
    category: 'talisman',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'accessory',
    description:
      'Miếng ngọc bội trắng muốt ấm tay, đeo bên hông giúp tâm thần bình ổn, tránh tẩu hỏa nhập ma khi luyện công.',
    prestigeCue: 'Ngọc tốt khắc chạm tinh xảo, biểu lộ người đeo có gia cảnh hoặc phẩm vị cao.',
  },
  {
    id: 'wx_bk_hac_thi_mat_lenh',
    name: 'Hắc Thị Mật Lệnh',
    group: 'bi_kip',
    category: 'talisman',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'accessory',
    description:
      'Thẻ đồng đen khắc ấn ký ngầm của chợ đen giang hồ, cho phép ra vào phòng đấu giá kín và mua tin tức mật.',
    prestigeCue: 'Người hiểu chuyện hắc đạo nhìn thấy mật lệnh sẽ kiêng nể quan hệ ngầm của chủ nhân.',
  },
  {
    id: 'wx_bk_lenh_bai_cam_y_ve',
    name: 'Lệnh bài Cẩm Y Vệ',
    group: 'bi_kip',
    category: 'talisman',
    quality: 'epic',
    defaultQuantity: 1,
    equipSlot: 'accessory',
    description:
      'Kim bài đặc quyền khắc chữ "Cẩm Y Vệ" kèm số hiệu quan hàm, điều động dịch trạm và tra xét án giang hồ.',
    prestigeCue: 'Hễ giơ lệnh bài ra, nha môn và quần hùng đều phải nhường ba phần kiêng sợ.',
  },
  {
    id: 'wx_bk_thu_chep_doc_co',
    name: 'Thủ chép Độc Cô Cửu Kiếm',
    group: 'bi_kip',
    category: 'talisman',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Bản chép tay yếu quyết kiếm ý "vô chiêu thắng hữu chiêu" phá đao, phá thương, phá chưởng; đọc tham ngộ tăng vọt ngộ tính và thuần thục võ học.',
  },
  {
    id: 'wx_bk_cam_pho_tieu_ngao',
    name: 'Cầm phổ Tiếu Ngạo Giang Hồ',
    group: 'bi_kip',
    category: 'talisman',
    quality: 'epic',
    defaultQuantity: 1,
    description:
      'Bản phổ cầm tiêu hợp tấu kết tinh tâm huyết hai bậc cao nhân chính tà, dùng để tĩnh tâm ngộ đạo và nâng cao ngộ tính võ học.',
  },
  {
    id: 'wx_bk_tan_quyen_cuu_am',
    name: 'Tàn quyển Cửu Âm Chân Kinh',
    group: 'bi_kip',
    category: 'talisman',
    quality: 'legendary',
    defaultQuantity: 1,
    description:
      'Cuốn da dê cổ chép tổng cương nội công và một phần tuyệt kỹ Cửu Âm; chỉ một tàn quyển cũng đủ khiến cả võ lâm tranh đoạt đổ máu.',
    prestigeCue: 'Nếu để lộ ra ngoài, toàn bộ cao thủ giang hồ sẽ chấn động tìm cách tranh cướp.',
  },
  {
    id: 'wx_bk_thanh_long_ngoc_boi',
    name: 'Thanh Long Ngự Khí Bội',
    group: 'bi_kip',
    category: 'talisman',
    quality: 'legendary',
    defaultQuantity: 1,
    equipSlot: 'accessory',
    description:
      'Tín vật ngọc cổ chạm rồng xanh, ẩn chứa vận khí tụ nội tức, giúp gia tăng ngộ tính và khí chất bậc tông sư.',
    prestigeCue: 'Cổ ngọc hiếm có khó tìm, thường là tín vật truyền thừa của thế gia trăm năm.',
  },
  {
    id: 'wx_bk_thien_son_co_pho',
    name: 'Thiên Sơn Chiết Mai Thủ Cổ Phổ',
    group: 'bi_kip',
    category: 'talisman',
    quality: 'immortal',
    defaultQuantity: 1,
    description:
      'Cổ phổ tuyệt thế bao hàm hàng trăm lộ biến hóa chưởng trảo cầm nã, tham ngộ sâu giúp lĩnh hội tinh túy võ công thiên hạ.',
  },

  // =========================================================================
  // 5) LỘ PHÍ, BẠC & ĐỒ HÀNH TẨU (Kèm nguyên liệu chế tác)
  // =========================================================================
  {
    id: 'wx_misc_bac_vun',
    name: 'Bạc vụn',
    group: 'hanh_tau',
    category: 'misc',
    quality: 'common',
    defaultQuantity: 30,
    description:
      'Tiền bạc lẻ (1 lượng/món) dùng trả cơm rượu ở khách điếm, mua thuốc thường và chi tiêu dọc đường.',
  },
  {
    id: 'wx_misc_ngan_phieu',
    name: 'Ngân phiếu trăm lượng',
    group: 'hanh_tau',
    category: 'misc',
    quality: 'rare',
    defaultQuantity: 2,
    description:
      'Ngân phiếu của Tứ Hải Tiền Trang trị giá 100 lượng bạc mỗi tờ, tiện mang theo khi mua sắm binh khí, cẩm bào hoặc đấu giá.',
  },
  {
    id: 'wx_misc_hoang_kim',
    name: 'Hoàng Kim',
    group: 'hanh_tau',
    quality: 'epic',
    category: 'misc',
    defaultQuantity: 3,
    description:
      'Thỏi vàng ròng (tương đương 20 lượng bạc/thỏi), dùng trong các giao dịch lớn tại hắc thị hoặc đấu giá bảo vật.',
  },
  {
    id: 'wx_misc_nu_nhi_hong',
    name: 'Trà danh sơn · Rượu Nữ Nhi Hồng',
    group: 'hanh_tau',
    category: 'consumable',
    quality: 'uncommon',
    defaultQuantity: 2,
    description:
      'Danh trà Long Tỉnh và rượu lâu năm ủ dưới đất; uống vào tỉnh táo tinh thần, ấm kinh mạch hoặc dùng làm lễ vật kết giao bằng hữu.',
  },
  {
    id: 'wx_misc_mat_na_dich_dung',
    name: 'Mặt nạ da người dịch dung',
    group: 'hanh_tau',
    category: 'misc',
    quality: 'rare',
    defaultQuantity: 1,
    equipSlot: 'relic',
    description:
      'Mặt nạ chế tác tinh vi mỏng như cánh ve, đeo vào có thể thay đổi dung mạo để ẩn thân, hành sự bí mật hoặc tránh bị nhận diện trang bị.',
    prestigeCue: 'Khi đeo mặt nạ dịch dung, NPC khó lòng nhìn thấu thân phận thật của nhân vật chính.',
  },
  {
    id: 'wx_misc_moc_cau_phi_trao',
    name: 'Móc câu phi trảo · Dây tơ tằm',
    group: 'hanh_tau',
    category: 'misc',
    quality: 'uncommon',
    defaultQuantity: 1,
    equipSlot: 'relic',
    description:
      'Bộ móc sắt ba chấu nối dây tơ tằm dẻo dai chịu lực nghìn cân, hỗ trợ leo thành quách, vượt vực sâu hoặc quấn đoạt binh khí.',
  },
  {
    id: 'wx_mat_tinh_cuong',
    name: 'Tinh Cương Khoáng Thạch',
    group: 'hanh_tau',
    category: 'material',
    quality: 'uncommon',
    defaultQuantity: 3,
    description:
      'Quặng tinh cương đen ánh bạc khai thác từ mỏ sắt cổ — khoáng thạch cơ bản để thợ rèn tôi luyện đao kiếm sơ và trung cấp.',
  },
  {
    id: 'wx_mat_han_thiet',
    name: 'Hàn Thiết Tinh Khoáng',
    group: 'hanh_tau',
    category: 'material',
    quality: 'rare',
    defaultQuantity: 2,
    description:
      'Quặng hàn thiết tinh luyện từ khe núi tuyết — khoáng thạch cốt lõi để thợ rèn đúc đao kiếm thượng phẩm và thần binh.',
  },
  {
    id: 'wx_mat_ngan_tinh_sa',
    name: 'Bạch Ngân Tinh Sa',
    group: 'hanh_tau',
    category: 'material',
    quality: 'rare',
    defaultQuantity: 2,
    description:
      'Cát khoáng bạch ngân tinh khiết pha thạch anh lạnh — dùng chế tác cơ quan ngân châm, ám khí tinh xảo và tôi lưỡi đao sáng như trăng.',
  },
  {
    id: 'wx_mat_xich_dong_tinh',
    name: 'Xích Đồng Hỏa Tinh Khoáng',
    group: 'hanh_tau',
    category: 'material',
    quality: 'epic',
    defaultQuantity: 2,
    description:
      'Khoáng thạch đồng đỏ ẩn hỏa văn khai thác gần địa mạch dung nham — tăng độ dẻo dai, chịu lực và sắc bén khi rèn dị kiếm, nhuyễn kiếm và bảo đao.',
  },
  {
    id: 'wx_mat_huyen_thiet',
    name: 'Huyền Thiết Thiên Vẫn',
    group: 'hanh_tau',
    category: 'material',
    quality: 'legendary',
    defaultQuantity: 1,
    description:
      'Thiên thạch huyền thiết đen kịt nặng nghìn cân rơi từ ngoại vực — khoáng thạch cực hiếm không thể thiếu khi rèn trọng kiếm và tuyệt thế thần binh.',
  },
  {
    id: 'wx_mat_kim_ti',
    name: 'Thiên Tằm Kim Ti',
    group: 'hanh_tau',
    category: 'material',
    quality: 'epic',
    defaultQuantity: 2,
    description:
      'Sợi tơ tằm vàng óng dai hơn thép mỏng — nguyên liệu quý để thợ may dệt cẩm bào thượng hạng, bảo giáp hộ thân và rút sợi nhuyễn kiếm.',
  },
  {
    id: 'wx_mat_linh_thao',
    name: 'Bách Niên Linh Thảo Võ Lâm',
    group: 'hanh_tau',
    category: 'herb',
    quality: 'uncommon',
    defaultQuantity: 3,
    description:
      'Thảo dược trăm năm hái trên danh sơn (nhân sâm, hà thủ ô, tuyết liên...), dùng để luyện đan dược võ lâm.',
  },
  {
    id: 'wx_mat_hoa_tam_bang_tinh',
    name: 'Hỏa Tằm Băng Tinh',
    group: 'hanh_tau',
    category: 'material',
    quality: 'legendary',
    defaultQuantity: 1,
    description:
      'Kỳ khoáng băng hỏa giao dung cực hiếm dùng làm phụ liệu tôi luyện thần binh tuyệt thế, dệt bảo giáp hoặc luyện kỳ đan.',
  },
] as const;

// ---------------------------------------------------------------------------
// SILVER / TAELS WALLET & TRANSACTION HELPERS
// ---------------------------------------------------------------------------

export interface WuxiaSilverWallet {
  totalTaels: number;
  silverPieces: number;
  goldBars: number;
  banknotes: number;
  breakdownLabel: string;
}

export function getItemSilverValuePerUnit(name: string): number {
  const lower = (name || '').trim().toLowerCase();
  if (/ngân\s*phiếu.*trăm\s*lượng|ngân\s*phiếu\s*100/i.test(lower)) return 100;
  if (/ngân\s*phiếu/i.test(lower)) return 50;
  if (/hoàng\s*kim|vàng\s*ròng|vàng\s*thỏi|kim\s*nguyên\s*bảo/i.test(lower)) {
    return 20;
  }
  if (/vàng/i.test(lower)) return 10;
  if (/bạc\s*vụn|bạc\s*lẻ|lượng\s*bạc|bạc\s*nén|^bạc$/i.test(lower)) return 1;
  return 0;
}

export function computeWuxiaSilverBalance(
  inventory: readonly InventoryItem[],
): WuxiaSilverWallet {
  let silverPieces = 0;
  let goldBars = 0;
  let banknotes = 0;
  let totalTaels = 0;

  for (const item of inventory) {
    const qty = Math.max(0, Math.round(item.quantity || 0));
    if (qty <= 0) continue;
    const val = getItemSilverValuePerUnit(item.name);
    if (val <= 0) continue;
    totalTaels += qty * val;
    const lower = item.name.toLowerCase();
    if (/ngân\s*phiếu/i.test(lower)) {
      banknotes += qty;
    } else if (/hoàng\s*kim|vàng/i.test(lower)) {
      goldBars += qty;
    } else {
      silverPieces += qty;
    }
  }

  const parts: string[] = [];
  if (silverPieces > 0) parts.push(`${silverPieces} Bạc`);
  if (goldBars > 0) parts.push(`${goldBars} Hoàng Kim`);
  if (banknotes > 0) parts.push(`${banknotes} Ngân phiếu`);

  return {
    totalTaels,
    silverPieces,
    goldBars,
    banknotes,
    breakdownLabel:
      parts.length > 0 ? `${totalTaels} lượng (${parts.join(' · ')})` : '0 lượng bạc',
  };
}

export function spendWuxiaSilver(
  inventory: readonly InventoryItem[],
  costTaels: number,
): { ok: boolean; nextInventory: InventoryItem[]; spentLabel: string; error?: string } {
  const cost = Math.max(0, Math.round(costTaels));
  if (cost === 0) {
    return { ok: true, nextInventory: [...inventory], spentLabel: '0 lượng bạc' };
  }
  const wallet = computeWuxiaSilverBalance(inventory);
  if (wallet.totalTaels < cost) {
    return {
      ok: false,
      nextInventory: [...inventory],
      spentLabel: '',
      error: `Không đủ ngân lượng (cần ${cost} lượng bạc, hiện có ${wallet.totalTaels} lượng).`,
    };
  }

  // Sort currency items smallest denomination first so we spend Bạc vụn -> Hoàng Kim -> Ngân phiếu
  const cloned = inventory.map((item) => ({ ...item }));
  const currencyIndices = cloned
    .map((item, idx) => ({ idx, val: getItemSilverValuePerUnit(item.name) }))
    .filter((x) => x.val > 0)
    .sort((a, b) => a.val - b.val);

  let remaining = cost;
  for (const entry of currencyIndices) {
    if (remaining <= 0) break;
    const item = cloned[entry.idx];
    if (!item || item.quantity <= 0) continue;
    const unitVal = entry.val;
    const maxCover = item.quantity * unitVal;
    if (maxCover <= remaining) {
      remaining -= maxCover;
      item.quantity = 0;
    } else {
      const unitsUsed = Math.ceil(remaining / unitVal);
      const paid = unitsUsed * unitVal;
      item.quantity -= unitsUsed;
      const change = paid - remaining;
      remaining = 0;
      if (change > 0) {
        const silverIdx = cloned.findIndex(
          (i) =>
            i.quantity >= 0 &&
            /bạc\s*vụn|lượng\s*bạc|^bạc$/i.test(i.name.trim().toLowerCase()),
        );
        if (silverIdx >= 0) {
          cloned[silverIdx].quantity += change;
        } else {
          cloned.push({
            id: `inv_silver_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: 'Bạc vụn',
            quantity: change,
            quality: 'common',
            category: 'misc',
            description:
              'Tiền bạc lẻ (1 lượng/món) dùng trả cơm rượu ở khách điếm, mua thuốc thường và chi tiêu dọc đường.',
          });
        }
      }
    }
  }

  return {
    ok: true,
    nextInventory: cloned.filter((i) => i.quantity > 0),
    spentLabel: `${cost} lượng bạc`,
  };
}

// ---------------------------------------------------------------------------
// WUXIA TRADING / AUCTION HOUSE & CRAFTING SYSTEM
// ---------------------------------------------------------------------------

export type WuxiaShopVenueId =
  | 'binh_khi_pho'
  | 'cam_trang'
  | 'duoc_diem'
  | 'hac_thi';

export interface WuxiaShopVenueMeta {
  id: WuxiaShopVenueId;
  label: string;
  shortLabel: string;
  hint: string;
}

export const WUXIA_SHOP_VENUES: readonly WuxiaShopVenueMeta[] = [
  {
    id: 'binh_khi_pho',
    label: 'Binh Khí Phổ',
    shortLabel: 'Binh khí phổ',
    hint: 'Mua đao, kiếm, tiêu & ám khí tại các lò rèn danh tiếng',
  },
  {
    id: 'cam_trang',
    label: 'Cẩm Trang · Tiệm May',
    shortLabel: 'Tiệm may · Cẩm trang',
    hint: 'Mua cổ trang tinh xảo, áo choàng & y phục hộ thân',
  },
  {
    id: 'duoc_diem',
    label: 'Dược Điếm Võ Lâm',
    shortLabel: 'Dược điếm',
    hint: 'Mua thuốc cầm máu, hoàn đan dưỡng khí & giải độc đan',
  },
  {
    id: 'hac_thi',
    label: 'Hắc Thị · Đấu Giá Thành Thị',
    shortLabel: 'Hắc thị · Đấu giá',
    hint: 'Đấu giá bảo giáp, tàn quyển, mật lệnh & kỳ trân quý hiếm',
  },
] as const;

export interface WuxiaShopListing {
  id: string;
  venue: WuxiaShopVenueId;
  catalogItemId: string;
  priceTaels: number;
  quantity: number;
  isAuction?: boolean;
  venueNote: string;
}

export const WUXIA_SHOP_LISTINGS: readonly WuxiaShopListing[] = [
  // Binh Khí Phổ
  {
    id: 'shop_thanh_phong',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_wp_thanh_phong',
    priceTaels: 25,
    quantity: 1,
    venueNote: 'Binh khí phổ thành thị · Giá niêm yết',
  },
  {
    id: 'shop_han_thiet_doan_dao',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_wp_han_thiet_doan_dao',
    priceTaels: 30,
    quantity: 1,
    venueNote: 'Binh khí phổ · Hàng thợ rèn lão luyện',
  },
  {
    id: 'shop_lanh_nguyet_dao',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_wp_lanh_nguyet_bao_dao',
    priceTaels: 120,
    quantity: 1,
    venueNote: 'Danh đao trưng bày tại nhị lâu Binh Khí Phổ',
  },
  {
    id: 'shop_ngoc_tieu',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_wp_ngoc_tieu_bich_hai',
    priceTaels: 135,
    quantity: 1,
    venueNote: 'Đoản binh nhã khí chế tác thủ công',
  },
  {
    id: 'shop_phi_trao',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_misc_moc_cau_phi_trao',
    priceTaels: 20,
    quantity: 1,
    venueNote: 'Đồ hành tẩu thiết yếu bán kèm tại tiệm rèn',
  },
  {
    id: 'shop_tinh_cuong_khoang',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_mat_tinh_cuong',
    priceTaels: 18,
    quantity: 1,
    venueNote: 'Khoáng thạch cơ bản rèn binh khí Phàm/Hạ phẩm',
  },
  {
    id: 'shop_han_thiet_khoang',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_mat_han_thiet',
    priceTaels: 70,
    quantity: 1,
    venueNote: 'Khoáng thạch rèn binh khí Thượng/Cực phẩm',
  },
  {
    id: 'shop_ngan_tinh_sa',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_mat_ngan_tinh_sa',
    priceTaels: 65,
    quantity: 1,
    venueNote: 'Khoáng sa bạch ngân chế ám khí & bảo đao',
  },
  {
    id: 'shop_xich_dong_tinh',
    venue: 'binh_khi_pho',
    catalogItemId: 'wx_mat_xich_dong_tinh',
    priceTaels: 125,
    quantity: 1,
    venueNote: 'Khoáng thạch Cực phẩm rèn dị kiếm & thần binh',
  },

  // Cẩm Trang · Tiệm May
  {
    id: 'shop_thanh_sam',
    venue: 'cam_trang',
    catalogItemId: 'wx_out_thanh_sam',
    priceTaels: 8,
    quantity: 1,
    venueNote: 'Tiệm may bình dân · Mặc nhẹ gọn',
  },
  {
    id: 'shop_da_hanh_y',
    venue: 'cam_trang',
    catalogItemId: 'wx_out_da_hanh_y',
    priceTaels: 28,
    quantity: 1,
    venueNote: 'Cẩm trang · Đặt may kín cho khách giang hồ',
  },
  {
    id: 'shop_bach_y_hiep_khach',
    venue: 'cam_trang',
    catalogItemId: 'wx_out_bach_y_hiep_khach',
    priceTaels: 110,
    quantity: 1,
    venueNote: 'Cẩm trang danh tiếng · Vải lụa thêu ngân tuyến',
  },
  {
    id: 'shop_tu_ha_dao_bao',
    venue: 'cam_trang',
    catalogItemId: 'wx_out_tu_ha_dao_bao',
    priceTaels: 115,
    quantity: 1,
    venueNote: 'Y phục đạo gia tinh xảo · Ôn hòa kinh mạch',
  },
  {
    id: 'shop_tuyet_ho_cuu',
    venue: 'cam_trang',
    catalogItemId: 'wx_out_tuyet_ho_cuu',
    priceTaels: 145,
    quantity: 1,
    venueNote: 'Cẩm trang Bắc Cương · Lông cáo tuyết thật',
  },
  {
    id: 'shop_luu_van_cam_bao',
    venue: 'cam_trang',
    catalogItemId: 'wx_out_luu_van_cam_bao',
    priceTaels: 280,
    quantity: 1,
    venueNote: 'Hàng gấm Vân Cẩm kinh thành · Số lượng cực ít',
  },
  {
    id: 'shop_lang_la_vu_y',
    venue: 'cam_trang',
    catalogItemId: 'wx_out_lang_la_vu_y',
    priceTaels: 290,
    quantity: 1,
    venueNote: 'Tơ lụa Lăng La thêu tay · Tôn dáng xuất trần',
  },
  {
    id: 'shop_kim_ti_mat',
    venue: 'cam_trang',
    catalogItemId: 'wx_mat_kim_ti',
    priceTaels: 150,
    quantity: 1,
    venueNote: 'Nguyên liệu quý dệt y giáp Cực phẩm',
  },

  // Dược Điếm Võ Lâm
  {
    id: 'shop_kim_sang',
    venue: 'duoc_diem',
    catalogItemId: 'wx_med_kim_sang_duoc',
    priceTaels: 6,
    quantity: 2,
    venueNote: 'Dược điếm phổ thông · Mua 2 gói',
  },
  {
    id: 'shop_tieu_hoan',
    venue: 'duoc_diem',
    catalogItemId: 'wx_med_tieu_hoan_dan',
    priceTaels: 22,
    quantity: 1,
    venueNote: 'Dược điếm lớn · Hàng chính tông',
  },
  {
    id: 'shop_giai_doc',
    venue: 'duoc_diem',
    catalogItemId: 'wx_med_bach_thao_giai_doc',
    priceTaels: 26,
    quantity: 1,
    venueNote: 'Thuốc phòng thân khi vào rừng độc/miếu hoang',
  },
  {
    id: 'shop_dai_hoan',
    venue: 'duoc_diem',
    catalogItemId: 'wx_med_dai_hoan_dan',
    priceTaels: 95,
    quantity: 1,
    venueNote: 'Trân dược trấn điếm · Rất khó mua số lượng lớn',
  },
  {
    id: 'shop_cuu_hoa_ngoc_lo',
    venue: 'duoc_diem',
    catalogItemId: 'wx_med_cuu_hoa_ngoc_lo',
    priceTaels: 105,
    quantity: 1,
    venueNote: 'Dược phẩm dưỡng thần hiếm có',
  },
  {
    id: 'shop_linh_thao',
    venue: 'duoc_diem',
    catalogItemId: 'wx_mat_linh_thao',
    priceTaels: 24,
    quantity: 1,
    venueNote: 'Thảo dược luyện đan dược võ lâm',
  },

  // Hắc Thị · Đấu Giá Thành Thị
  {
    id: 'shop_hac_thi_mat_lenh',
    venue: 'hac_thi',
    catalogItemId: 'wx_bk_hac_thi_mat_lenh',
    priceTaels: 130,
    quantity: 1,
    isAuction: true,
    venueNote: 'Đấu giá kín · Mở đường vào tầng trong Hắc Thị',
  },
  {
    id: 'shop_mat_na_dich_dung',
    venue: 'hac_thi',
    catalogItemId: 'wx_misc_mat_na_dich_dung',
    priceTaels: 160,
    quantity: 1,
    isAuction: true,
    venueNote: 'Hàng hiếm Hắc Thị · Đấu giá khởi điểm',
  },
  {
    id: 'shop_tu_vi_nhuyen_kiem',
    venue: 'hac_thi',
    catalogItemId: 'wx_wp_tu_vi_nhuyen_kiem',
    priceTaels: 360,
    quantity: 1,
    isAuction: true,
    venueNote: 'Phiên đấu giá bảo kiếm Cực phẩm',
  },
  {
    id: 'shop_tay_tuy_tan',
    venue: 'hac_thi',
    catalogItemId: 'wx_med_tay_tuy_phat_cot_tan',
    priceTaels: 320,
    quantity: 1,
    isAuction: true,
    venueNote: 'Đấu giá mật phương gột rửa cân cốt',
  },
  {
    id: 'shop_nhuyen_vi_giap',
    venue: 'hac_thi',
    catalogItemId: 'wx_out_nhuyen_vi_giap',
    priceTaels: 680,
    quantity: 1,
    isAuction: true,
    venueNote: 'Áp trục đấu giá · Bảo giáp truyền kỳ Thiên phẩm',
  },
  {
    id: 'shop_huyen_thiet_thien_van',
    venue: 'hac_thi',
    catalogItemId: 'wx_mat_huyen_thiet',
    priceTaels: 240,
    quantity: 1,
    isAuction: true,
    venueNote: 'Đấu giá khoáng thạch Thiên phẩm · Rèn Tuyệt thế thần binh',
  },
  {
    id: 'shop_tan_quyen_cuu_am',
    venue: 'hac_thi',
    catalogItemId: 'wx_bk_tan_quyen_cuu_am',
    priceTaels: 850,
    quantity: 1,
    isAuction: true,
    venueNote: 'Bảo vật áp trục đấu giá · Cả giang hồ tranh giành',
  },
] as const;

export type WuxiaCraftingDiscipline = 'ren_duc' | 'may_mac' | 'luyen_dan';

export interface WuxiaCraftingIngredientReq {
  keywordRegex: RegExp;
  label: string;
  quantity: number;
  catalogItemId?: string;
  isOre?: boolean;
}

export interface WuxiaCraftingRecipe {
  id: string;
  discipline: WuxiaCraftingDiscipline;
  disciplineLabel: string;
  outputCatalogId: string;
  outputQuantity: number;
  silverCost: number;
  ingredients: readonly WuxiaCraftingIngredientReq[];
  upgradeFromCatalogIds?: readonly string[];
  craftHint: string;
}

export const WUXIA_CRAFTING_RECIPES: readonly WuxiaCraftingRecipe[] = [
  {
    id: 'craft_thiet_kiem_pho_thong',
    discipline: 'ren_duc',
    disciplineLabel: 'Thợ rèn · Đúc kiếm sơ cấp',
    outputCatalogId: 'wx_wp_thiet_kiem_pho_thong',
    outputQuantity: 1,
    silverCost: 6,
    ingredients: [
      {
        keywordRegex: /tinh\s*cương|quặng\s*sắt/i,
        label: 'Tinh Cương Khoáng Thạch',
        quantity: 1,
        catalogItemId: 'wx_mat_tinh_cuong',
        isOre: true,
      },
    ],
    craftHint: 'Rèn lưỡi kiếm sắt từ 1 Tinh Cương Khoáng Thạch + 6 lượng bạc.',
  },
  {
    id: 'craft_thanh_phong_kiem',
    discipline: 'ren_duc',
    disciplineLabel: 'Thợ rèn · Đúc binh khí',
    outputCatalogId: 'wx_wp_thanh_phong',
    outputQuantity: 1,
    silverCost: 15,
    upgradeFromCatalogIds: ['wx_wp_thiet_kiem_pho_thong'],
    ingredients: [
      {
        keywordRegex: /tinh\s*cương/i,
        label: 'Tinh Cương Khoáng Thạch',
        quantity: 2,
        catalogItemId: 'wx_mat_tinh_cuong',
        isOre: true,
      },
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
    ],
    craftHint:
      'Tinh luyện phôi kiếm bằng 2 Tinh Cương Khoáng Thạch + 1 Hàn Thiết Tinh Khoáng + 15 lượng bạc.',
  },
  {
    id: 'craft_han_thiet_doan_dao',
    discipline: 'ren_duc',
    disciplineLabel: 'Thợ rèn · Đúc đoản đao',
    outputCatalogId: 'wx_wp_han_thiet_doan_dao',
    outputQuantity: 1,
    silverCost: 18,
    ingredients: [
      {
        keywordRegex: /tinh\s*cương/i,
        label: 'Tinh Cương Khoáng Thạch',
        quantity: 1,
        catalogItemId: 'wx_mat_tinh_cuong',
        isOre: true,
      },
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
    ],
    craftHint:
      'Rèn từ 1 Tinh Cương Khoáng Thạch + 1 Hàn Thiết Tinh Khoáng + 18 lượng bạc công thợ.',
  },
  {
    id: 'craft_lanh_nguyet_dao',
    discipline: 'ren_duc',
    disciplineLabel: 'Thợ rèn · Đúc bảo đao',
    outputCatalogId: 'wx_wp_lanh_nguyet_bao_dao',
    outputQuantity: 1,
    silverCost: 25,
    upgradeFromCatalogIds: ['wx_wp_han_thiet_doan_dao'],
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 2,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /bạch\s*ngân|ngân\s*tinh\s*sa/i,
        label: 'Bạch Ngân Tinh Sa',
        quantity: 1,
        catalogItemId: 'wx_mat_ngan_tinh_sa',
        isOre: true,
      },
    ],
    craftHint:
      'Rèn từ 2 Hàn Thiết Tinh Khoáng + 1 Bạch Ngân Tinh Sa + 25 lượng bạc (nâng cấp từ Hàn Thiết Đoản Đao).',
  },
  {
    id: 'craft_ngoc_tieu_bich_hai',
    discipline: 'ren_duc',
    disciplineLabel: 'Chế tác · Đoản binh nhã khí',
    outputCatalogId: 'wx_wp_ngoc_tieu_bich_hai',
    outputQuantity: 1,
    silverCost: 35,
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /bạch\s*ngân|ngân\s*tinh\s*sa/i,
        label: 'Bạch Ngân Tinh Sa',
        quantity: 1,
        catalogItemId: 'wx_mat_ngan_tinh_sa',
        isOre: true,
      },
      {
        keywordRegex: /linh\s*thảo|thảo\s*dược|nhân\s*sâm/i,
        label: 'Bách Niên Linh Thảo Võ Lâm',
        quantity: 1,
        catalogItemId: 'wx_mat_linh_thao',
        isOre: false,
      },
    ],
    craftHint:
      'Gia cố lõi ngọc tiêu với 1 Hàn Thiết + 1 Bạch Ngân Tinh Sa + 1 Bách Niên Linh Thảo + 35 lượng bạc.',
  },
  {
    id: 'craft_huyen_thiet_kiem',
    discipline: 'ren_duc',
    disciplineLabel: 'Thợ rèn · Đúc thần binh',
    outputCatalogId: 'wx_wp_huyen_thiet_trong_kiem',
    outputQuantity: 1,
    silverCost: 60,
    upgradeFromCatalogIds: ['wx_wp_thanh_phong'],
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 2,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /huyền\s*thiết|thiên\s*vẫn/i,
        label: 'Huyền Thiết Thiên Vẫn',
        quantity: 1,
        catalogItemId: 'wx_mat_huyen_thiet',
        isOre: true,
      },
    ],
    craftHint:
      'Tinh luyện từ 2 Hàn Thiết Tinh Khoáng + 1 Huyền Thiết Thiên Vẫn + 60 lượng bạc (nâng cấp từ Thanh Phong Trường Kiếm).',
  },
  {
    id: 'craft_kim_xa_kiem',
    discipline: 'ren_duc',
    disciplineLabel: 'Thợ rèn · Đúc dị kiếm',
    outputCatalogId: 'wx_wp_kim_xa_kiem',
    outputQuantity: 1,
    silverCost: 75,
    upgradeFromCatalogIds: ['wx_wp_thanh_phong'],
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /xích\s*đồng|hỏa\s*tinh\s*khoáng/i,
        label: 'Xích Đồng Hỏa Tinh Khoáng',
        quantity: 2,
        catalogItemId: 'wx_mat_xich_dong_tinh',
        isOre: true,
      },
      {
        keywordRegex: /kim\s*ti|tơ\s*vàng/i,
        label: 'Thiên Tằm Kim Ti',
        quantity: 1,
        catalogItemId: 'wx_mat_kim_ti',
        isOre: false,
      },
    ],
    craftHint:
      'Kết hợp 1 Hàn Thiết + 2 Xích Đồng Hỏa Tinh Khoáng + 1 Thiên Tằm Kim Ti + 75 lượng bạc.',
  },
  {
    id: 'craft_tu_vi_nhuyen_kiem',
    discipline: 'ren_duc',
    disciplineLabel: 'Thợ rèn · Đúc nhuyễn kiếm',
    outputCatalogId: 'wx_wp_tu_vi_nhuyen_kiem',
    outputQuantity: 1,
    silverCost: 90,
    upgradeFromCatalogIds: ['wx_wp_thanh_phong', 'wx_wp_ngoc_tieu_bich_hai'],
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /xích\s*đồng|hỏa\s*tinh\s*khoáng/i,
        label: 'Xích Đồng Hỏa Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_xich_dong_tinh',
        isOre: true,
      },
      {
        keywordRegex: /kim\s*ti|tơ\s*tằm/i,
        label: 'Thiên Tằm Kim Ti',
        quantity: 2,
        catalogItemId: 'wx_mat_kim_ti',
        isOre: false,
      },
    ],
    craftHint:
      'Rút sợi thép dẻo: 1 Hàn Thiết + 1 Xích Đồng Hỏa Tinh Khoáng + 2 Thiên Tằm Kim Ti + 90 lượng bạc.',
  },
  {
    id: 'craft_bao_vu_le_hoa_cham',
    discipline: 'ren_duc',
    disciplineLabel: 'Cơ quan · Chế tác ám khí',
    outputCatalogId: 'wx_wp_bao_vu_le_hoa_cham',
    outputQuantity: 1,
    silverCost: 85,
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /bạch\s*ngân|ngân\s*tinh\s*sa/i,
        label: 'Bạch Ngân Tinh Sa',
        quantity: 2,
        catalogItemId: 'wx_mat_ngan_tinh_sa',
        isOre: true,
      },
      {
        keywordRegex: /kim\s*ti|tơ\s*tằm/i,
        label: 'Thiên Tằm Kim Ti',
        quantity: 1,
        catalogItemId: 'wx_mat_kim_ti',
        isOre: false,
      },
    ],
    craftHint:
      'Chế cơ quan lò xo: 1 Hàn Thiết + 2 Bạch Ngân Tinh Sa + 1 Thiên Tằm Kim Ti + 85 lượng bạc.',
  },
  {
    id: 'craft_da_cau_bong',
    discipline: 'ren_duc',
    disciplineLabel: 'Thợ rèn · Trấn bảo Cái Bang',
    outputCatalogId: 'wx_wp_da_cau_bong',
    outputQuantity: 1,
    silverCost: 120,
    upgradeFromCatalogIds: ['wx_wp_ngoc_tieu_bich_hai'],
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /xích\s*đồng|hỏa\s*tinh\s*khoáng/i,
        label: 'Xích Đồng Hỏa Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_xich_dong_tinh',
        isOre: true,
      },
      {
        keywordRegex: /hỏa\s*tằm|băng\s*tinh/i,
        label: 'Hỏa Tằm Băng Tinh',
        quantity: 1,
        catalogItemId: 'wx_mat_hoa_tam_bang_tinh',
        isOre: true,
      },
    ],
    craftHint:
      'Tôi luyện ngọc trúc: 1 Hàn Thiết + 1 Xích Đồng Hỏa Tinh Khoáng + 1 Hỏa Tằm Băng Tinh + 120 lượng bạc.',
  },
  {
    id: 'craft_y_thien_kiem',
    discipline: 'ren_duc',
    disciplineLabel: 'Danh sư · Rèn tuyệt thế thần kiếm',
    outputCatalogId: 'wx_wp_y_thien_kiem',
    outputQuantity: 1,
    silverCost: 180,
    upgradeFromCatalogIds: ['wx_wp_huyen_thiet_trong_kiem', 'wx_wp_tu_vi_nhuyen_kiem'],
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 2,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /huyền\s*thiết|thiên\s*vẫn/i,
        label: 'Huyền Thiết Thiên Vẫn',
        quantity: 2,
        catalogItemId: 'wx_mat_huyen_thiet',
        isOre: true,
      },
      {
        keywordRegex: /hỏa\s*tằm|băng\s*tinh/i,
        label: 'Hỏa Tằm Băng Tinh',
        quantity: 1,
        catalogItemId: 'wx_mat_hoa_tam_bang_tinh',
        isOre: true,
      },
    ],
    craftHint:
      'Thần binh chí tôn: 2 Hàn Thiết + 2 Huyền Thiết Thiên Vẫn + 1 Hỏa Tằm Băng Tinh + 180 lượng bạc.',
  },
  {
    id: 'craft_do_long_dao',
    discipline: 'ren_duc',
    disciplineLabel: 'Danh sư · Rèn tuyệt thế bảo đao',
    outputCatalogId: 'wx_wp_do_long_dao',
    outputQuantity: 1,
    silverCost: 180,
    upgradeFromCatalogIds: ['wx_wp_lanh_nguyet_bao_dao'],
    ingredients: [
      {
        keywordRegex: /hàn\s*thiết/i,
        label: 'Hàn Thiết Tinh Khoáng',
        quantity: 2,
        catalogItemId: 'wx_mat_han_thiet',
        isOre: true,
      },
      {
        keywordRegex: /huyền\s*thiết|thiên\s*vẫn/i,
        label: 'Huyền Thiết Thiên Vẫn',
        quantity: 2,
        catalogItemId: 'wx_mat_huyen_thiet',
        isOre: true,
      },
      {
        keywordRegex: /xích\s*đồng|hỏa\s*tinh\s*khoáng/i,
        label: 'Xích Đồng Hỏa Tinh Khoáng',
        quantity: 1,
        catalogItemId: 'wx_mat_xich_dong_tinh',
        isOre: true,
      },
      {
        keywordRegex: /hỏa\s*tằm|băng\s*tinh/i,
        label: 'Hỏa Tằm Băng Tinh',
        quantity: 1,
        catalogItemId: 'wx_mat_hoa_tam_bang_tinh',
        isOre: true,
      },
    ],
    craftHint:
      'Bảo đao hiệu lệnh thiên hạ: 2 Hàn Thiết + 2 Huyền Thiết Thiên Vẫn + 1 Xích Đồng Hỏa Tinh + 1 Hỏa Tằm Băng Tinh + 180 lượng bạc.',
  },
  {
    id: 'craft_khong_tuoc_linh',
    discipline: 'ren_duc',
    disciplineLabel: 'Cơ quan · Đệ nhất ám khí',
    outputCatalogId: 'wx_wp_khong_tuoc_linh',
    outputQuantity: 1,
    silverCost: 240,
    upgradeFromCatalogIds: ['wx_wp_bao_vu_le_hoa_cham'],
    ingredients: [
      {
        keywordRegex: /bạch\s*ngân|ngân\s*tinh\s*sa/i,
        label: 'Bạch Ngân Tinh Sa',
        quantity: 2,
        catalogItemId: 'wx_mat_ngan_tinh_sa',
        isOre: true,
      },
      {
        keywordRegex: /xích\s*đồng|hỏa\s*tinh\s*khoáng/i,
        label: 'Xích Đồng Hỏa Tinh Khoáng',
        quantity: 2,
        catalogItemId: 'wx_mat_xich_dong_tinh',
        isOre: true,
      },
      {
        keywordRegex: /hỏa\s*tằm|băng\s*tinh/i,
        label: 'Hỏa Tằm Băng Tinh',
        quantity: 2,
        catalogItemId: 'wx_mat_hoa_tam_bang_tinh',
        isOre: true,
      },
      {
        keywordRegex: /kim\s*ti|tơ\s*tằm/i,
        label: 'Thiên Tằm Kim Ti',
        quantity: 1,
        catalogItemId: 'wx_mat_kim_ti',
        isOre: false,
      },
    ],
    craftHint:
      'Kỳ khí tuyệt thế: 2 Bạch Ngân Tinh Sa + 2 Xích Đồng Hỏa Tinh + 2 Hỏa Tằm Băng Tinh + 1 Thiên Tằm Kim Ti + 240 lượng bạc.',
  },
  {
    id: 'craft_luu_van_cam_bao',
    discipline: 'may_mac',
    disciplineLabel: 'May mặc · Dệt cẩm bào',
    outputCatalogId: 'wx_out_luu_van_cam_bao',
    outputQuantity: 1,
    silverCost: 45,
    ingredients: [
      {
        keywordRegex: /kim\s*ti|tơ\s*tằm/i,
        label: 'Thiên Tằm Kim Ti',
        quantity: 1,
        catalogItemId: 'wx_mat_kim_ti',
      },
    ],
    craftHint: 'Dệt từ 1 Thiên Tằm Kim Ti + 45 lượng bạc công thợ may.',
  },
  {
    id: 'craft_kim_ti_bao_giap',
    discipline: 'may_mac',
    disciplineLabel: 'May mặc · Dệt bảo giáp',
    outputCatalogId: 'wx_out_kim_ti_bao_giap',
    outputQuantity: 1,
    silverCost: 150,
    upgradeFromCatalogIds: ['wx_out_nhuyen_vi_giap'],
    ingredients: [
      {
        keywordRegex: /kim\s*ti|tơ\s*tằm/i,
        label: 'Thiên Tằm Kim Ti',
        quantity: 2,
        catalogItemId: 'wx_mat_kim_ti',
      },
      {
        keywordRegex: /hỏa\s*tằm|băng\s*tinh/i,
        label: 'Hỏa Tằm Băng Tinh',
        quantity: 1,
        catalogItemId: 'wx_mat_hoa_tam_bang_tinh',
        isOre: true,
      },
    ],
    craftHint: 'Kỳ giáp tuyệt thế: 2 Thiên Tằm Kim Ti + 1 Hỏa Tằm Băng Tinh + 150 lượng bạc.',
  },
  {
    id: 'craft_tieu_hoan_dan',
    discipline: 'luyen_dan',
    disciplineLabel: 'Luyện đan · Bào chế',
    outputCatalogId: 'wx_med_tieu_hoan_dan',
    outputQuantity: 2,
    silverCost: 5,
    ingredients: [
      {
        keywordRegex: /linh\s*thảo|thảo\s*dược|nhân\s*sâm/i,
        label: 'Bách Niên Linh Thảo Võ Lâm',
        quantity: 1,
        catalogItemId: 'wx_mat_linh_thao',
      },
    ],
    craftHint: 'Bào chế từ 1 Bách Niên Linh Thảo + 5 lượng bạc phụ liệu (ra 2 viên).',
  },
  {
    id: 'craft_dai_hoan_dan',
    discipline: 'luyen_dan',
    disciplineLabel: 'Luyện đan · Thánh dược',
    outputCatalogId: 'wx_med_dai_hoan_dan',
    outputQuantity: 1,
    silverCost: 25,
    ingredients: [
      {
        keywordRegex: /linh\s*thảo|thảo\s*dược|nhân\s*sâm/i,
        label: 'Bách Niên Linh Thảo Võ Lâm',
        quantity: 2,
        catalogItemId: 'wx_mat_linh_thao',
      },
    ],
    craftHint: 'Tinh luyện từ 2 Bách Niên Linh Thảo + 25 lượng bạc.',
  },
  {
    id: 'craft_tay_tuy_tan',
    discipline: 'luyen_dan',
    disciplineLabel: 'Luyện đan · Tẩy tủy',
    outputCatalogId: 'wx_med_tay_tuy_phat_cot_tan',
    outputQuantity: 1,
    silverCost: 60,
    ingredients: [
      {
        keywordRegex: /linh\s*thảo|thảo\s*dược|nhân\s*sâm/i,
        label: 'Bách Niên Linh Thảo Võ Lâm',
        quantity: 2,
        catalogItemId: 'wx_mat_linh_thao',
      },
      {
        keywordRegex: /hỏa\s*tằm|băng\s*tinh/i,
        label: 'Hỏa Tằm Băng Tinh',
        quantity: 1,
        catalogItemId: 'wx_mat_hoa_tam_bang_tinh',
        isOre: true,
      },
    ],
    craftHint: 'Dược tán tẩy tủy: 2 Linh Thảo + 1 Hỏa Tằm Băng Tinh + 60 lượng bạc.',
  },
] as const;

export interface WuxiaForgingMaterialStatus {
  label: string;
  have: number;
  need: number;
  missing: number;
  catalogItemId?: string;
  isOre: boolean;
  quality?: InventoryItemQuality;
  description?: string;
}

export interface WuxiaForgingSuggestion {
  recipe: WuxiaCraftingRecipe;
  materials: WuxiaForgingMaterialStatus[];
  silverHave: number;
  silverCost: number;
  silverMissing: number;
  upgradeBases: Array<{ id: string; name: string; owned: boolean }>;
  missingLines: string[];
  missingMaterialCount: number;
  canCraft: boolean;
}

export function getWuxiaForgingSuggestion(
  catalogItemId: string,
  inventory: readonly InventoryItem[],
): WuxiaForgingSuggestion | null {
  const recipe = WUXIA_CRAFTING_RECIPES.find(
    (r) => r.outputCatalogId === catalogItemId,
  );
  if (!recipe) return null;

  const avail = checkCraftingRecipeAvailability(inventory, recipe);
  const materials: WuxiaForgingMaterialStatus[] = avail.matchedMaterials.map(
    (m, idx) => {
      const req = recipe.ingredients[idx];
      const catItem = req?.catalogItemId
        ? findWuxiaCatalogItemById(req.catalogItemId)
        : undefined;
      return {
        ...m,
        missing: Math.max(0, m.need - m.have),
        catalogItemId: req?.catalogItemId,
        isOre: Boolean(req?.isOre),
        quality: catItem?.quality,
        description: catItem?.description,
      };
    },
  );
  const silverMissing = Math.max(0, recipe.silverCost - avail.silverHave);

  const upgradeBases = (recipe.upgradeFromCatalogIds || [])
    .map((baseId) => findWuxiaCatalogItemById(baseId))
    .filter((base): base is WuxiaCatalogItem => Boolean(base))
    .map((base) => ({
      id: base.id,
      name: base.name,
      owned: inventory.some(
        (inv) =>
          inv.quantity > 0 &&
          inv.name.trim().toLowerCase() === base.name.trim().toLowerCase(),
      ),
    }));

  const missingLines: string[] = [];
  for (const m of materials) {
    if (m.missing > 0) {
      missingLines.push(`${m.missing} ${m.label}`);
    }
  }
  if (silverMissing > 0) {
    missingLines.push(`${silverMissing} lượng bạc`);
  }

  return {
    recipe,
    materials,
    silverHave: avail.silverHave,
    silverCost: recipe.silverCost,
    silverMissing,
    upgradeBases,
    missingLines,
    missingMaterialCount: materials.filter((m) => m.missing > 0).length,
    canCraft: avail.canCraft,
  };
}

export function getWuxiaForgingSuggestionByName(
  itemName: string,
  inventory: readonly InventoryItem[],
): WuxiaForgingSuggestion | null {
  const matched = findWuxiaCatalogItemByName(itemName);
  if (!matched) return null;
  return getWuxiaForgingSuggestion(matched.id, inventory);
}

export function findWuxiaCatalogItemById(
  id: string,
): WuxiaCatalogItem | undefined {
  return WUXIA_ITEM_CATALOG.find((item) => item.id === id);
}

export function findWuxiaCatalogItemByName(
  name?: string | null,
): WuxiaCatalogItem | undefined {
  const clean = (name || '').trim().toLowerCase();
  if (!clean) return undefined;
  return (
    WUXIA_ITEM_CATALOG.find((i) => i.name.toLowerCase() === clean) ||
    WUXIA_ITEM_CATALOG.find(
      (i) =>
        clean.includes(i.name.toLowerCase()) ||
        i.name.toLowerCase().includes(clean),
    )
  );
}

export function addOrMergeInventoryItem(
  inventory: readonly InventoryItem[],
  entry: Omit<InventoryItem, 'id'> & { id?: string },
): InventoryItem[] {
  const cleanName = entry.name.trim();
  const existingIdx = inventory.findIndex(
    (i) => i.name.trim().toLowerCase() === cleanName.toLowerCase(),
  );
  if (existingIdx >= 0) {
    return inventory.map((i, idx) =>
      idx === existingIdx
        ? {
            ...i,
            quantity: i.quantity + Math.max(1, entry.quantity),
            quality: entry.quality,
            category: entry.category,
            ...(entry.description ? { description: entry.description } : {}),
            ...(entry.equipSlot ? { equipSlot: entry.equipSlot } : {}),
          }
        : i,
    );
  }
  return [
    ...inventory,
    {
      id:
        entry.id ||
        `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      quantity: Math.max(1, entry.quantity),
      quality: entry.quality,
      category: entry.category,
      ...(entry.description ? { description: entry.description } : {}),
      ...(entry.equipSlot ? { equipSlot: entry.equipSlot } : {}),
    },
  ];
}

export function buyWuxiaShopItem(
  profile: CultivationProfile,
  listingId: string,
): {
  ok: boolean;
  nextProfile: CultivationProfile;
  message: string;
  storyPrompt?: string;
} {
  const listing = WUXIA_SHOP_LISTINGS.find((l) => l.id === listingId);
  const catalogItem = listing ? findWuxiaCatalogItemById(listing.catalogItemId) : undefined;
  if (!listing || !catalogItem) {
    return {
      ok: false,
      nextProfile: profile,
      message: 'Không tìm thấy mặt hàng này trong thương điếm.',
    };
  }

  const spend = spendWuxiaSilver(profile.inventory, listing.priceTaels);
  if (!spend.ok) {
    return {
      ok: false,
      nextProfile: profile,
      message: spend.error || 'Không đủ ngân lượng để giao dịch.',
    };
  }

  const nextInventory = addOrMergeInventoryItem(spend.nextInventory, {
    name: catalogItem.name,
    quantity: listing.quantity,
    quality: catalogItem.quality,
    category: catalogItem.category,
    description: catalogItem.description,
    ...(catalogItem.equipSlot ? { equipSlot: catalogItem.equipSlot } : {}),
  });

  const venueMeta = WUXIA_SHOP_VENUES.find((v) => v.id === listing.venue);
  const verb = listing.isAuction ? 'đấu giá thành công' : 'mua được';
  const message = `Đã ${verb} "${catalogItem.name}" x${listing.quantity} tại ${venueMeta?.shortLabel || 'thành thị'} (chi ${spend.spentLabel}).`;
  const storyPrompt = listing.isAuction
    ? `Tại phiên đấu giá ở ${venueMeta?.label || 'Hắc Thị'}, ta bỏ ra ${spend.spentLabel} cạnh tranh và thu về "${catalogItem.name}", cẩn thận kiểm tra rồi cất giữ.`
    : `Ta ghé qua ${venueMeta?.label || 'cửa tiệm'} trong thành, trả ${spend.spentLabel} để mua "${catalogItem.name}" x${listing.quantity} cất vào hành trang.`;

  return {
    ok: true,
    nextProfile: {
      ...profile,
      inventory: nextInventory,
      lastItemFeedback: message,
      lastUpdatedAt: Date.now(),
    },
    message,
    storyPrompt,
  };
}

export function checkCraftingRecipeAvailability(
  inventory: readonly InventoryItem[],
  recipe: WuxiaCraftingRecipe,
): {
  canCraft: boolean;
  missingReasons: string[];
  matchedMaterials: Array<{ label: string; have: number; need: number }>;
  silverHave: number;
} {
  const wallet = computeWuxiaSilverBalance(inventory);
  const missingReasons: string[] = [];
  const matchedMaterials: Array<{ label: string; have: number; need: number }> = [];

  for (const ing of recipe.ingredients) {
    const have = inventory
      .filter((item) => ing.keywordRegex.test(item.name))
      .reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    matchedMaterials.push({
      label: ing.label,
      have,
      need: ing.quantity,
    });
    if (have < ing.quantity) {
      missingReasons.push(`Thiếu ${ing.label} (${have}/${ing.quantity})`);
    }
  }

  if (wallet.totalTaels < recipe.silverCost) {
    missingReasons.push(
      `Thiếu bạc (${wallet.totalTaels}/${recipe.silverCost} lượng)`,
    );
  }

  return {
    canCraft: missingReasons.length === 0,
    missingReasons,
    matchedMaterials,
    silverHave: wallet.totalTaels,
  };
}

export function craftWuxiaRecipe(
  profile: CultivationProfile,
  recipeId: string,
): {
  ok: boolean;
  nextProfile: CultivationProfile;
  message: string;
  storyPrompt?: string;
} {
  const recipe = WUXIA_CRAFTING_RECIPES.find((r) => r.id === recipeId);
  const outputItem = recipe ? findWuxiaCatalogItemById(recipe.outputCatalogId) : undefined;
  if (!recipe || !outputItem) {
    return {
      ok: false,
      nextProfile: profile,
      message: 'Không tìm thấy công thức chế tác.',
    };
  }

  const check = checkCraftingRecipeAvailability(profile.inventory, recipe);
  if (!check.canCraft) {
    return {
      ok: false,
      nextProfile: profile,
      message: `Chưa thể chế tác "${outputItem.name}": ${check.missingReasons.join(', ')}.`,
    };
  }

  const spend = spendWuxiaSilver(profile.inventory, recipe.silverCost);
  if (!spend.ok) {
    return {
      ok: false,
      nextProfile: profile,
      message: spend.error || 'Không đủ ngân lượng trả công chế tác.',
    };
  }

  // Deduct required ingredients cleanly
  const cloned = spend.nextInventory.map((item) => ({ ...item }));
  for (const ing of recipe.ingredients) {
    let need = ing.quantity;
    for (const item of cloned) {
      if (need <= 0) break;
      if (!ing.keywordRegex.test(item.name) || item.quantity <= 0) continue;
      const take = Math.min(item.quantity, need);
      item.quantity -= take;
      need -= take;
    }
  }

  const afterConsume = cloned.filter((i) => i.quantity > 0);
  const nextInventory = addOrMergeInventoryItem(afterConsume, {
    name: outputItem.name,
    quantity: recipe.outputQuantity,
    quality: outputItem.quality,
    category: outputItem.category,
    description: outputItem.description,
    ...(outputItem.equipSlot ? { equipSlot: outputItem.equipSlot } : {}),
  });

  const actionVerb =
    recipe.discipline === 'ren_duc'
      ? 'rèn đúc thành công'
      : recipe.discipline === 'may_mac'
        ? 'may dệt thành công'
        : 'luyện chế thành công';
  const message = `Đã ${actionVerb} "${outputItem.name}" x${recipe.outputQuantity} (${recipe.disciplineLabel}).`;
  const storyPrompt =
    recipe.discipline === 'ren_duc'
      ? `Ta mang nguyên liệu cùng ${recipe.silverCost} lượng bạc tới lò rèn danh tiếng, rèn đúc thành công "${outputItem.name}" ánh hàn quang rực rỡ.`
      : recipe.discipline === 'may_mac'
        ? `Ta giao tơ tằm kim ti cùng ${recipe.silverCost} lượng bạc cho sư phụ tiệm may, dệt thành bộ "${outputItem.name}" tinh xảo tuyệt luân.`
        : `Ta mở lò luyện dược bằng linh thảo thu thập được, điều hỏa hầu chuẩn xác và luyện thành "${outputItem.name}" x${recipe.outputQuantity} tỏa dược hương thanh khiết.`;

  return {
    ok: true,
    nextProfile: {
      ...profile,
      inventory: nextInventory,
      lastItemFeedback: message,
      lastUpdatedAt: Date.now(),
    },
    message,
    storyPrompt,
  };
}

// ---------------------------------------------------------------------------
// AI PROMPT BUILDERS: MC ATTIRE / WEAPON VISIBILITY & STRICT NPC RARITY
// ---------------------------------------------------------------------------

export const WUXIA_NPC_RARITY_RANKING_RULE =
  'PHÂN TẦNG ĐỘ HIẾM TRANG BỊ NPC (CỰC NGHIÊM NGẶT): Tuyệt đối KHÔNG gán đại trà thần binh hay bảo giáp cho mọi NPC. Phần lớn võ nhân phổ thông vẫn dùng binh khí sắt/thép thường và y phục môn phái giản dị; CHỈ RẤT HIẾM các đại cao thủ hàng đầu, chưởng môn/trưởng lão đại phái, truyền nhân thế gia hiển hách hoặc chỉ huy Cẩm Y Vệ mới sở hữu thần binh danh tiếng (Ỷ Thiên, Đồ Long, Huyền Thiết...) hoặc bảo giáp trân quý.';

export function buildWuxiaGearAndNpcPromptSection(
  profile: CultivationProfile,
  mcName?: string,
): string[] {
  const findEquipped = (slot: EquipmentSlotId): InventoryItem | undefined => {
    const id = profile.equipment?.[slot];
    if (!id) return undefined;
    return profile.inventory.find((i) => i.id === id);
  };

  const weapon = findEquipped('weapon');
  const armor = findEquipped('armor');
  const accessory = findEquipped('accessory');
  const relic = findEquipped('relic');

  const qualityLabelVi = (q: InventoryItemQuality): string => {
    switch (q) {
      case 'immortal':
        return 'Tuyệt thế (Thần phẩm)';
      case 'legendary':
        return 'Thiên phẩm (Thần binh/Chí bảo)';
      case 'epic':
        return 'Cực phẩm (Địa phẩm)';
      case 'rare':
        return 'Huyền phẩm (Thượng phẩm)';
      case 'uncommon':
        return 'Hoàng phẩm (Trung phẩm)';
      default:
        return 'Phàm phẩm (Hạ phẩm)';
    }
  };

  const describeEquipped = (
    item: InventoryItem | undefined,
    emptyText: string,
  ): string => {
    if (!item) return emptyText;
    const catMeta = findWuxiaCatalogItemByName(item.name);
    const cue = catMeta?.prestigeCue ? ` — Ấn tượng giang hồ: ${catMeta.prestigeCue}` : '';
    const desc = item.description ? ` (${item.description})` : '';
    return `${item.name} [${qualityLabelVi(item.quality)}]${desc}${cue}`;
  };

  const hasHighPrestigeOutfit =
    armor &&
    (armor.quality === 'rare' ||
      armor.quality === 'epic' ||
      armor.quality === 'legendary' ||
      armor.quality === 'immortal');
  const hasHighPrestigeWeapon =
    weapon &&
    (weapon.quality === 'epic' ||
      weapon.quality === 'legendary' ||
      weapon.quality === 'immortal');
  const hasNotableRelic =
    relic &&
    (relic.quality === 'epic' ||
      relic.quality === 'legendary' ||
      relic.quality === 'immortal');
  const isDisguised = Boolean(
    relic && /mặt\s*nạ|dịch\s*dung/i.test(`${relic.name} ${relic.description || ''}`),
  );

  const wallet = computeWuxiaSilverBalance(profile.inventory);
  const craftMats = profile.inventory
    .filter((i) =>
      /(?:hàn\s*thiết|huyền\s*thiết|kim\s*ti|tơ\s*tằm|linh\s*thảo|hỏa\s*tằm|băng\s*tinh|khoáng)/i.test(
        i.name,
      ),
    )
    .map((i) => `${i.name} x${i.quantity}`);

  const subject = mcName?.trim() || 'Nhân vật chính';
  const lines: string[] = [
    `[NGOẠI TRANG, BINH KHÍ & KHÍ CHẤT HIỆN TẠI CỦA ${subject.toUpperCase()} — NPC PHẢI NHÌN THẤY & PHẢN ỨNG]`,
    `- Y phục / Y giáp đang mặc: ${describeEquipped(armor, 'Y phục giản dị phổ thông (chưa trang bị ngoại trang đặc biệt)')}`,
    `- Binh khí đang mang: ${describeEquipped(weapon, 'Tay không (chưa đeo binh khí ra ngoài)')}`,
    `- Ngọc bội / Tín vật đang đeo: ${describeEquipped(accessory, 'Không đeo tín vật hay ngọc bội lộ rõ')}`,
    `- Ám khí / Vật mang theo người: ${describeEquipped(relic, 'Không gắn ám khí hay cơ quan đặc biệt')}`,
    `- Ngân lượng & Vật liệu chế tác sẵn có: ${wallet.breakdownLabel}${craftMats.length ? ` | Nguyên liệu rèn/may/đan: ${craftMats.join(', ')}` : ''}`,
  ];

  const reactionHints: string[] = [];
  if (isDisguised) {
    reactionHints.push(
      `${subject} đang dùng "${relic?.name}" che giấu dung mạo thật — trừ cao thủ cực tinh tường hoặc có manh mối riêng, NPC chỉ nhận xét qua trang phục và khí chất bề ngoài.`,
    );
  }
  if (hasHighPrestigeOutfit) {
    reactionHints.push(
      `Vì đang mặc "${armor!.name}" (${qualityLabelVi(armor!.quality)}), các NPC khi gặp mặt PHẢI chú ý tới chất vải, hoa văn và khí chất toát ra (trầm trồ trước vẻ tiêu sái/hoa lệ, nể trọng gia thế/quan uy, hoặc chưởng quỹ/tiểu nhị tiếp đón ân cần hơn, trong khi đạo tặc/kẻ xấu có thể đánh giá thực lực hoặc nảy lòng tham).`,
    );
  }
  if (hasHighPrestigeWeapon || hasNotableRelic) {
    const noted = [weapon, relic]
      .filter((x): x is InventoryItem =>
        Boolean(
          x &&
            (x.quality === 'epic' ||
              x.quality === 'legendary' ||
              x.quality === 'immortal'),
        ),
      )
      .map((x) => `"${x.name}"`)
      .join(' & ');
    reactionHints.push(
      `Vì đang mang bảo vật danh tiếng (${noted}), cao thủ võ lâm và kẻ hiểu chuyện giang hồ xung quanh PHẢI có phản ứng chân thực (nhận ra lai lịch binh khí, ánh mắt kiêng dè/thán phục, dò xét thực lực chủ nhân, hoặc kẻ tà ác/tham lam nảy sinh ý đồ dòm ngó, thăm dò, tranh đoạt).`,
    );
  }
  if (!hasHighPrestigeOutfit && !hasHighPrestigeWeapon && !hasNotableRelic) {
    reactionHints.push(
      'Hiện trang phục và binh khí bên ngoài ở mức bình thường/giản dị (đồ quý nếu có đang cất kín trong hành trang) — NPC xung quanh nhìn nhận như khách giang hồ bình thường, không vô cớ kinh hô hay nhận nhầm bảo vật chưa lấy ra.',
    );
  }

  lines.push(`- Chỉ dẫn phản ứng NPC tại hiện trường: ${reactionHints.join(' ')}`);
  lines.push(
    '- QUY TẮC PHÂN TẦNG ĐỘ HIẾM TRANG BỊ NPC (CỰC NGHIÊM NGẶT):',
    '  * Tuyệt đối KHÔNG phát đại trà thần binh hay ngoại trang quý cho mọi NPC. Phần lớn NPC thường (90%+: tiểu nhị, dân thường, tiêu sư thường, đệ tử phổ thông, sơn tặc, lính tuần tra) CHỈ mặc vải thô/y phục môn phái bình thường và dùng binh khí sắt/thép/gỗ hạng Phàm phẩm hoặc Hoàng phẩm.',
    '  * CHỈ RẤT HIẾM các đại cao thủ trên Bảng Xếp Hạng, chưởng môn/trưởng lão đại phái, truyền nhân thế gia lớn, chỉ huy Cẩm Y Vệ hoặc nhân vật kỳ ngộ đặc biệt mới thực sự sở hữu Thần binh (Cực phẩm / Thiên phẩm / Tuyệt thế), Bảo giáp hay ngoại trang trân quý. Chiến lợi phẩm thu được sau giao thủ phải tương xứng đúng đẳng cấp đối thủ đó.',
    '- CON ĐƯỜNG KIẾM ĐỒ GIANG HỒ TRONG TRUYỆN:',
    '  * Hỗ trợ tự nhiên cả 3 hướng: (1) Dùng Bạc/Ngân phiếu/Hoàng Kim mua y phục ở tiệm may/cẩm trang, mua binh khí ở binh khí phổ, mua thuốc ở dược điếm hoặc đấu giá ở hắc thị; (2) Dùng Hàn Thiết, Kim Ti, Linh Thảo để tự chế tác hoặc nhờ danh sư rèn binh khí, may ngoại trang, luyện đan; (3) Nhận qua nhiệm vụ môn phái, kỳ ngộ, giao dịch hoặc đoạt từ cao thủ thực sự giữ bảo vật.',
  );

  return lines;
}
