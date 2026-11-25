import type {
  DramaLevel,
  WorldGenreId,
  WorldSetupNpcDraft,
} from '../types/ark';

export interface WorldGenrePreset {
  id: WorldGenreId;
  label: string;
  shortDesc: string;
  usesEraLabel: boolean;
  timeHint: string;
  defaultClock: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    eraLabel: string;
  };
  defaultDramaLevel: DramaLevel;
  placeholders: {
    worldName: string;
    setting: string;
    rules: string;
    atmosphere: string;
    eraLabel: string;
    mcRole: string;
    mcDesc: string;
    openingScenario: string;
  };
  quickIdeas: string[];
  starterTemplate: {
    worldName: string;
    setting: string;
    rules: string;
    atmosphere: string;
    dramaLevel: DramaLevel;
    mc: {
      name: string;
      pronoun: string;
      role: string;
      description: string;
      absentAtStart: boolean;
    };
    npcs: Omit<WorldSetupNpcDraft, 'id'>[];
    openingScenario: string;
  };
}

export const DRAMA_LEVEL_OPTIONS: Array<{
  id: DramaLevel;
  label: string;
  hint: string;
}> = [
  {
    id: 'chill',
    label: 'Nhẹ nhàng',
    hint: 'Tập trung đời sống, đối thoại tự nhiên, ít xung đột gắt',
  },
  {
    id: 'balanced',
    label: 'Cân bằng',
    hint: 'Đan xen tương tác đời thường và các nút thắt cao trào hợp lý',
  },
  {
    id: 'intense',
    label: 'Kịch tính',
    hint: 'Nhịp dồn dập, nhiều bí mật, áp lực và lựa chọn đánh đổi',
  },
];

export const WORLD_GENRE_PRESETS: WorldGenrePreset[] = [
  {
    id: 'slice_of_life',
    label: 'Đời thường',
    shortDesc: 'Gần gũi, ấm áp, nhịp sống hằng ngày',
    usesEraLabel: false,
    timeHint: 'Gợi ý mốc ngày/giờ cụ thể (buổi sáng, chiều mưa, cuối tuần...)',
    defaultClock: {
      year: 2025,
      month: 9,
      day: 14,
      hour: 16,
      minute: 30,
      eraLabel: '',
    },
    defaultDramaLevel: 'chill',
    placeholders: {
      worldName: 'VD: Tiệm cà phê góc phố chiều thu',
      setting:
        'VD: Một khu phố nhỏ yên tĩnh với tiệm cà phê gỗ, hiệu sách cũ và những vị khách quen ghé qua mỗi chiều...',
      rules:
        'VD: Không yếu tố siêu nhiên; cảm xúc và quan hệ phát triển tự nhiên qua trò chuyện, thói quen và những chuyện vụn vặt hằng ngày.',
      atmosphere: 'VD: Ấm áp, chậm rãi, thoảng chút hoài niệm chiều mưa',
      eraLabel: 'VD: Mùa thu · Tuần lễ nghỉ lễ (tùy chọn)',
      mcRole: 'VD: Chủ tiệm cà phê / Khách quen mới chuyển đến khu phố',
      mcDesc:
        'VD: Tính tình điềm đạm, thích lắng nghe, thường mặc áo sơ mi vải lanh đơn giản.',
      openingScenario:
        'VD: Cơn mưa bất chợt đổ xuống lúc 16:30 khiến vài vị khách quen lẫn một người lạ tấp vào hiên quán tránh mưa...',
    },
    quickIdeas: [
      'Cuộc sống đời thường yên bình bên tiệm cà phê nhỏ',
      'Khu chung cư cũ ngày cuối tuần của nhóm bạn trẻ',
      'Chuyến nghỉ dưỡng cuối thu ở Đà Lạt',
    ],
    starterTemplate: {
      worldName: 'Góc Phố Mưa Nhẹ',
      setting:
        'Một con hẻm nhỏ rợp bóng cây nằm cạnh bờ hồ, nổi bật với tiệm cà phê gỗ hai tầng, tiệm hoa tươi đối diện và hiệu sách cũ của ông chủ khó tính nhưng tốt bụng.',
      rules:
        'Bối cảnh thực tế hoàn toàn, không siêu năng lực. Nhịp truyện chậm rãi, tôn trọng tâm lý đời thực, các mối quan hệ ấm dần lên qua từng buổi trò chuyện và những sự việc nhỏ thường ngày.',
      atmosphere: 'Ấm áp, bình yên, giàu chi tiết ánh sáng, âm thanh và mùi cà phê rang',
      dramaLevel: 'chill',
      mc: {
        name: 'Minh Khôi',
        pronoun: 'tôi',
        role: 'Kiến trúc sư tự do vừa dọn về thuê căn gác nhỏ gần hồ',
        description:
          '26 tuổi, dáng cao gầy, hay đeo kính gọng mảnh, thích ghi chép phác thảo ở góc bàn cạnh cửa sổ.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Thảo Vy',
          role: 'Chủ tiệm cà phê kiêm thợ pha chế',
          personality: 'Dịu dàng, tinh ý, nhớ rõ khẩu vị của từng khách quen nhưng hay giấu nỗi mệt riêng.',
          appearance: 'Tóc bob ngang vai kẹp nơ vải, tạp dề nâu đậm phủ ngoài áo len mỏng màu kem.',
          initialLocation: 'Quầy pha chế tiệm cà phê',
          initialMood: 'Thư thái',
        },
        {
          name: 'Gia Huy',
          role: 'Nhiếp ảnh gia tự do ở cùng khu phố',
          personality: 'Hoạt bát, hay trêu chọc, lúc nào cũng mang theo máy ảnh phim cổ.',
          appearance: 'Áo khoác denim bạc màu, tóc hơi rối, nụ cười dễ gần.',
          initialLocation: 'Bàn gỗ gần cửa ra vào',
          initialMood: 'Hào hứng',
        },
      ],
      openingScenario:
        'Trời đổ cơn mưa rào bất chợt lúc 16:30 chiều Chủ Nhật. Mùi đất ẩm quyện hương cà phê rang lan khắp tầng trệt khi chuông gió ngoài cửa vang lên.',
    },
  },
  {
    id: 'showbiz',
    label: 'Giải trí & Showbiz',
    shortDesc: 'Hậu trường, ánh đèn, tiệc VIP & truyền thông',
    usesEraLabel: false,
    timeHint: 'Gợi ý ngày/giờ sự kiện cụ thể (đêm tiệc, thảm đỏ, after-party...)',
    defaultClock: {
      year: 2025,
      month: 6,
      day: 15,
      hour: 21,
      minute: 30,
      eraLabel: '',
    },
    defaultDramaLevel: 'balanced',
    placeholders: {
      worldName: 'VD: Đêm After-Party Beverly Hills',
      setting:
        'VD: Biệt thự kính nhìn xuống ánh đèn Los Angeles nơi giới ca sĩ, người mẫu, nhà sản xuất và khách mời VIP tụ hội sau đêm trao giải...',
      rules:
        'VD: Quy định không quay lén trong phòng VIP, paparazzo chực chờ ngoài cổng; danh tiếng, hợp đồng thương hiệu và tin đồn truyền thông luôn chi phối cách mọi người ứng xử.',
      atmosphere: 'VD: Hào nhoáng, lơi lỏng nhưng ngầm đầy toan tính và sức hút',
      eraLabel: 'VD: Đêm Gala / Tuần lễ Thời trang (tùy chọn)',
      mcRole: 'VD: Nhà thiết kế / Nhà sản xuất âm nhạc / Khách mời kín tiếng',
      mcDesc:
        'VD: Phong thái điềm tĩnh, gu ăn mặc tối giản sắc sảo, không chạy theo ống kính.',
      openingScenario:
        'VD: Đồng hồ điểm 21:30, nhạc house trầm ấm vang lên ngoài hồ bơi khi những khách mời nổi tiếng bắt đầu rẽ vào khu lounge kín...',
    },
    quickIdeas: [
      'Tiệc hậu trường showbiz LA sau đêm trao giải',
      'Tuần lễ thời trang Paris và những cuộc gặp kín',
      'Phòng thu đêm khuya của dàn nghệ sĩ nổi tiếng',
    ],
    starterTemplate: {
      worldName: 'Đêm Hậu Trường Hollywood Hills',
      setting:
        'Một biệt thự hiện đại trên đồi Beverly Hills với hồ bơi vô cực và phòng lounge cách âm, nơi tổ chức tiệc after-party kín chỉ dành cho danh sách khách mời hạng A sau lễ trao giải âm nhạc.',
      rules:
        'Bảo vệ kiểm soát nghiêm ngặt từ cổng, hạn chế chụp ảnh bên trong phòng VIP. Mọi mối quan hệ vừa thân mật vừa chịu áp lực dư luận, truyền thông và thương hiệu.',
      atmosphere: 'Hào nhoáng, phóng khoáng, đậm chất điện ảnh đêm LA',
      dramaLevel: 'balanced',
      mc: {
        name: '',
        pronoun: '',
        role: 'Khách mời đặc biệt / Nhà sáng lập thương hiệu thiết kế',
        description: 'Phong thái tự tin, kín tiếng trước truyền thông, ăn mặc tinh tế.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Kendall Jenner',
          role: 'Siêu mẫu & doanh nhân',
          personality: 'Điềm tĩnh, hơi giữ khoảng cách ban đầu nhưng sắc sảo và thoải mái khi đúng tần số.',
          appearance: 'Vóc dáng cao thanh mảnh, đầm lụa đen ôm dáng hở lưng tinh tế, tóc suôn rẽ ngôi giữa.',
          initialLocation: 'Sân hiên nhìn ra hồ bơi',
          initialMood: 'Thư giãn',
        },
        {
          name: 'Zac Bia',
          role: 'DJ & chủ trì tiệc đêm LA',
          personality: 'Lanh lợi, kết nối cực khéo, luôn nắm rõ ai đang có mặt trong phòng.',
          appearance: 'Áo khoác da tối màu, kính râm gọng mảnh cài cổ áo, đồng hồ kim loại nổi bật.',
          initialLocation: 'Bàn DJ cạnh quầy bar',
          initialMood: 'Sôi nổi',
        },
        {
          name: 'Jennie Kim',
          role: 'Ngôi sao âm nhạc & biểu tượng thời trang',
          personality: 'Cuốn hút, thông minh, vừa tinh nghịch vừa sang trọng, dễ tạo tâm điểm.',
          appearance: 'Váy ngắn thiết kế đen tối giản phối trang sức bạc tinh xảo, mái tóc uốn sóng mềm.',
          initialLocation: 'Khu sofa lounge VIP',
          initialMood: 'Vui vẻ',
        },
      ],
      openingScenario:
        '21:30 tối Chủ Nhật, ánh đèn Los Angeles trải dài phía dưới ban công kính. Tiếng nhạc trầm dịu xuống khi nhóm khách mời VIP vừa bước vào khu lounge riêng, ly champagne lạnh vẫn còn đọng sương.',
    },
  },
  {
    id: 'ancient',
    label: 'Cổ đại',
    shortDesc: 'Triều đình, giang hồ, quán trọ & lịch cổ',
    usesEraLabel: true,
    timeHint: 'Gợi ý nhập Niên đại / Can chi / Giờ canh kèm ngày tháng lịch để đồng hồ trôi đều',
    defaultClock: {
      year: 724,
      month: 4,
      day: 5,
      hour: 18,
      minute: 30,
      eraLabel: 'Năm Khai Nguyên thứ 12 · Tiết Thanh Minh · Giờ Dậu',
    },
    defaultDramaLevel: 'balanced',
    placeholders: {
      worldName: 'VD: Khách điếm Bên Sông — Trường An',
      setting:
        'VD: Một tửu điếm gỗ hai tầng nằm cạnh bến đò cổ ngoài thành, nơi thương nhân, du hiệp và mật thám triều đình dừng chân mỗi khi sương xuống...',
      rules:
        'VD: Tôn ti lễ giáo rõ ràng; thư tín dùng bồ câu hoặc dịch trạm, di chuyển bằng ngựa/thuyền; võ công hoặc mưu lược đều có giới hạn và cái giá.',
      atmosphere: 'VD: Cổ phong trầm mặc, ánh đèn lồng đỏ, gió sông se lạnh',
      eraLabel: 'VD: Năm Cảnh Long thứ 3 · Tháng Ba âm lịch · Giờ Tuất',
      mcRole: 'VD: Chưởng quỹ khách điếm / Thư sinh lên kinh / Du hiệp ẩn danh',
      mcDesc:
        'VD: Trường bào màu thanh lam gọn gàng, cử chỉ khoan thai nhưng ánh mắt luôn dò xét từng góc quán.',
      openingScenario:
        'VD: Mưa phùn tiết Thanh Minh rơi lất phất vào giờ Dậu, một cỗ xe ngựa phủ màn lụa đen bất ngờ dừng trước hiên khách điếm...',
    },
    quickIdeas: [
      'Quán trọ nhỏ bên bến sông thời cổ đại đêm mưa',
      'Sóng ngầm chốn thâm cung trước đêm yến tiệc',
      'Kỳ đại hội võ lâm nơi cổ trấn biên ải',
    ],
    starterTemplate: {
      worldName: 'Khách Điếm Độ Giang',
      setting:
        'Một khách điếm gỗ hai tầng lợp ngói xanh nằm sát bến đò cổ ngoại ô kinh thành. Ban ngày đón thương khách qua sông, về đêm lại trở thành nơi giao nhau của du hiệp, quan lại vi hành và những tin tức ngầm.',
      rules:
        'Tuân thủ lễ nghi, cấp bậc và luật lệ cổ đại. Tin tức truyền bằng dịch trạm hoặc mật thư; không có công nghệ hiện đại. Mọi hành động lộ thân phận đều kéo theo hệ quả từ nha môn hoặc phe phái.',
      atmosphere: 'Cổ phong sâu lắng, ánh đèn lồng hắt bóng trên mặt nước, pha chút huyền bí giang hồ',
      dramaLevel: 'balanced',
      mc: {
        name: 'Thẩm Thanh',
        pronoun: 'ta',
        role: 'Chưởng quỹ trẻ tuổi của Khách Điếm Độ Giang',
        description:
          'Khoác trường bào màu lam trầm, tay luôn cầm bàn tính gỗ lê, nói năng nhã nhặn nhưng nhìn người cực chuẩn.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Lục Chiêu',
          role: 'Kiếm khách hành tẩu giang hồ',
          personality: 'Ít lời, cảnh giác cao, trọng chữ tín nhưng không thích xen vào chuyện triều đình.',
          appearance: 'Áo tơi sẫm màu đọng nước mưa, trường kiếm bọc vải thô đặt ngang gối, ánh mắt sắc lạnh.',
          initialLocation: 'Bàn góc gần cầu thang gỗ',
          initialMood: 'Cảnh giác',
        },
        {
          name: 'Tô Uyển Nhi',
          role: 'Tiểu thư thương hội lớn giả trang nam tử',
          personality: 'Thông minh, lanh lợi, quen xoay sở nhưng vẫn lộ nét quý khí khó giấu.',
          appearance: 'Áo gấm trắng thêu trúc nhạt, quạt xếp ngà voi, giọng nói thanh nhẹ.',
          initialLocation: 'Gian trà lầu hai nhìn xuống bến sông',
          initialMood: 'Suy tư',
        },
      ],
      openingScenario:
        'Giờ Dậu tiết Thanh Minh, gió sông thổi tạt từng hạt mưa lạnh vào dãy đèn lồng trước cổng Khách Điếm Độ Giang. Tiếng vó ngựa gấp gáp chợt vang lên từ con đường lát đá ngoài bến đò.',
    },
  },
  {
    id: 'xianxia',
    label: 'Tiên Hiệp',
    shortDesc: 'Tu tiên, cảnh giới, linh khí, tông môn & pháp bảo',
    usesEraLabel: true,
    timeHint:
      'Gợi ý niên hiệu tu chân giới / tiết khí / giờ canh linh triều kèm lịch liên tục',
    defaultClock: {
      year: 3420,
      month: 3,
      day: 18,
      hour: 5,
      minute: 30,
      eraLabel: 'Thái Huyền Lịch năm 3420 · Tiết Xuân Phân · Giờ Mão',
    },
    defaultDramaLevel: 'balanced',
    placeholders: {
      worldName: 'VD: Thanh Vân Sơn Môn — Linh Mạch Cửu Châu',
      setting:
        'VD: Ngọn tiên sơn quanh năm mây phủ tọa lạc trên cổ linh mạch, quy tụ các đệ tử tu hành, lò luyện đan, linh thú và phường thị tu chân dưới chân núi...',
      rules:
        'VD: Tu hành phân cảnh giới (Luyện Khí, Trúc Cơ, Kim Đan, Nguyên Anh...); linh khí, đan dược, pháp bảo đều hữu hạn; mọi hành vi kết nhân quả đều chịu thiên đạo và tông quy ràng buộc.',
      atmosphere:
        'VD: Tiên khí phiêu diêu, sương sớm linh sơn hòa cùng trầm mặc tu đạo',
      eraLabel: 'VD: Thái Huyền Lịch năm 3420 · Giờ Mão · Kỳ Linh Triều',
      mcRole:
        'VD: Đệ tử ngoại môn mới nhập sơn / Luyện đan đồng tử / Tán tu tầm đạo',
      mcDesc:
        'VD: Đạo bào vải thô màu thanh xám, tâm tính trầm tĩnh kiên định, bên hông đeo túi trữ vật cũ và ngọc giản nhập môn.',
      openingScenario:
        'VD: Giờ Mão sáng sớm, tiếng chuông khai khóa trên đỉnh Thanh Vân ngân dài qua biển mây khi linh triều đầu xuân bắt đầu tràn xuống linh điền ngoại môn...',
    },
    quickIdeas: [
      'Đệ tử ngoại môn ở tông môn tu tiên linh khí đang suy tàn',
      'Phường thị tu chân dưới chân linh sơn trước kỳ đấu giá đan dược',
      'Đêm mở bí cảnh trăm năm của Chính Đạo Tông Môn',
    ],
    starterTemplate: {
      worldName: 'Thanh Vân Sơn Môn',
      setting:
        'Một tông môn tu tiên bậc trung ẩn mình trên dãy núi bảy đỉnh mây phủ. Trên đỉnh chính là điện truyền công, Đan Đường và Linh Thú Viên; dưới chân núi là phường thị nhỏ nơi đệ tử ngoại môn và tán tu trao đổi linh thảo, phù lục và pháp bảo.',
      rules:
        'Tu luyện tuân theo cảnh giới rõ ràng (Luyện Khí → Trúc Cơ → Kim Đan → Nguyên Anh), không vượt cấp vô lý. Đan dược, linh thạch và pháp bảo phải đánh đổi bằng công huân hoặc cơ duyên; hành sự trái đạo dễ vướng tâm ma và nhân quả thiên đạo.',
      atmosphere:
        'Tiên phong đạo cốt, sương mây lững lờ, xen lẫn cạnh tranh thầm lặng nơi tiên đồ',
      dramaLevel: 'balanced',
      mc: {
        name: 'Lâm Hiên',
        pronoun: 'ta',
        role: 'Đệ tử ngoại môn canh giữ linh điền Thanh Vân Tông',
        description:
          'Thanh niên 19 tuổi mặc đạo bào xám nhạt sạch sẽ, tính điềm đạm thận trọng, tư chất tầm trung nhưng cực kỳ nhạy cảm với biến động linh khí.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Thẩm Thanh Dao',
          role: 'Nội môn sư tỷ thuộc Đan Đường',
          personality:
            'Ngoài lạnh trong ấm, nghiêm khắc chuyện tông quy nhưng sẵn sàng chỉ điểm người có tâm tu hành.',
          appearance:
            'Bạch y viền lam nhạt, tóc đen cài trâm ngọc thanh, bên hông treo hồ lô đựng linh đan tỏa hương dược thảo thoang thoảng.',
          initialLocation: 'Đường đá dẫn lên Đan Đường',
          initialMood: 'Điềm tĩnh',
        },
        {
          name: 'Tống Trường Phong',
          role: 'Tán tu thường lui tới phường thị chân núi',
          personality:
            'Khôn khéo, ăn nói phóng khoáng, rành đủ mọi tin đồn bí cảnh và giá cả pháp bảo.',
          appearance:
            'Áo bào xanh sẫm hơi bạc vai, cầm quạt xếp khắc phù văn cũ, ánh mắt lanh lợi.',
          initialLocation: 'Trà quán phường thị chân núi',
          initialMood: 'Hứng thú',
        },
      ],
      openingScenario:
        'Giờ Mão tiết Xuân Phân, sương sớm còn đọng trắng xóa trên những luống linh thảo ngoại môn. Tiếng chuông triệu tập từ đỉnh chính chợt vang ba hồi dài khác thường, báo hiệu một đợt thí luyện và phân phát linh thạch mới sắp bắt đầu.',
    },
  },
  {
    id: 'xuanhuan',
    label: 'Huyền Huyễn',
    shortDesc: 'Huyền khí, huyết mạch, gia tộc, bí cảnh & dị thú',
    usesEraLabel: true,
    timeHint:
      'Gợi ý kỷ nguyên lục địa / năm đại hội gia tộc hoặc lịch đa tầng kèm đồng hồ liên tục',
    defaultClock: {
      year: 2790,
      month: 8,
      day: 12,
      hour: 14,
      minute: 0,
      eraLabel: 'Kỷ nguyên Thương Khung năm 2790 · Tháng Thu Liệt · Giờ Mùi',
    },
    defaultDramaLevel: 'intense',
    placeholders: {
      worldName: 'VD: Lục Địa Thương Khung — Thành Cổ Huyền Viêm',
      setting:
        'VD: Vùng biên cảnh rộng lớn nơi các đại gia tộc huyết mạch, học viện chiến hồn và sơn mạch dị thú thượng cổ cùng tồn tại trên thế giới nhiều tầng vị diện...',
      rules:
        'VD: Sức mạnh dựa trên Huyền Khí, Hồn Lực và phẩm cấp Huyết Mạch; bí cảnh cổ ẩn chứa cơ duyên lẫn hiểm họa từ dị thú/thần thú; tôn trọng quy tắc đấu trường và danh dự gia tộc.',
      atmosphere:
        'VD: Hùng tráng, rực lửa chiến ý, giàu màu sắc thần bí cổ đại',
      eraLabel: 'VD: Kỷ nguyên Thương Khung năm 2790 · Ngày Khai Mở Bí Cảnh',
      mcRole:
        'VD: Thiếu niên mang huyết mạch ngủ quên / Học viên Chiến Hồn Điện / Lữ khách phá cảnh',
      mcDesc:
        'VD: Chiến bào đen viền đỏ gọn gàng, ánh mắt sắc bén kiên nghị, quanh cổ tay ẩn hiện ấn ký huyền văn mờ nhạt.',
      openingScenario:
        'VD: Đúng giờ Mùi trên quảng trường đá cổ, cột tinh thạch trắc nghiệm huyết mạch bỗng rung chuyển mạnh khi bầu trời phía tây xuất hiện vết nứt bí cảnh...',
    },
    quickIdeas: [
      'Đại hội giác tỉnh huyết mạch tại thành cổ gia tộc',
      'Đoàn thám hiểm tiến vào bí cảnh dị thú thượng cổ',
      'Thế giới đa tầng nơi chiến hồn sư tranh đoạt di sản thần thú',
    ],
    starterTemplate: {
      worldName: 'Thành Cổ Huyền Viêm',
      setting:
        'Một đại thành xây bằng đá hắc diệu nằm giáp ranh dãy núi Vạn Thú thuộc tầng trung lục địa Thương Khung. Nơi đây quy tụ ba đại gia tộc huyết mạch, phân viện Chiến Hồn và những thương đoàn săn tìm tinh hạch dị thú.',
      rules:
        'Thực lực đo bằng tu vi Huyền Khí, Hồn Lực và độ thuần khiết Huyết Mạch. Thức tỉnh huyết mạch hoặc khế ước dị thú đều có rủi ro phản phệ; các bí cảnh cổ chỉ mở theo chu kỳ và luôn tiềm ẩn tranh đoạt sinh tử giữa các thế lực.',
      atmosphere:
        'Hào hùng, sắc nét, không khí sôi sục trước biến cố lớn của đại lục',
      dramaLevel: 'intense',
      mc: {
        name: 'Tiêu Dạ',
        pronoun: 'ta',
        role: 'Hậu duệ chi nhánh gia tộc vừa bước vào lễ thức tỉnh huyết mạch',
        description:
          'Thiếu niên 18 tuổi mặc kình trang màu mực gọn gàng, trầm lặng nhưng bướng bỉnh, trong người ẩn giấu một tia cổ huyết chưa từng thức tỉnh.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Mộ Dung Tuyết',
          role: 'Thiên kiêu trẻ tuổi của Mộ Dung Thế Gia',
          personality:
            'Kiêu ngạo, thẳng thắn, trọng thực lực nhưng không khinh thường người yếu hơn nếu họ có khí phách.',
          appearance:
            'Trường bào trắng thêu vân băng bạc, mái tóc dài buộc cao, bên hông đeo trường thương tinh kim lạnh buốt.',
          initialLocation: 'Khán đài phía bắc quảng trường Huyền Viêm',
          initialMood: 'Tập trung',
        },
        {
          name: 'Lôi Chấn',
          role: 'Đội trưởng đoàn săn dị thú Liệt Phong',
          personality:
            'Sảng khoái, lão luyện chiến trường, từng vào sinh ra tử nơi dãy núi Vạn Thú.',
          appearance:
            'Thân hình cao lớn vạm vỡ, giáp da sẫm màu có vết móng thú, vác đại đao bản rộng sau lưng.',
          initialLocation: 'Cổng thành hướng núi Vạn Thú',
          initialMood: 'Cảnh giác',
        },
      ],
      openingScenario:
        '14:00 giờ Mùi trên quảng trường Huyền Viêm, hàng trăm đệ tử trẻ đang tụ tập quanh trụ đá trắc nghiệm huyết mạch. Phía chân trời dãy núi Vạn Thú chợt bùng lên một cột quang trụ đỏ thẫm — dấu hiệu một tòa bí cảnh thượng cổ vừa phá phong ấn.',
    },
  },
  {
    id: 'apocalypse',
    label: 'Mạt Thế',
    shortDesc: 'Sinh tồn hậu tận thế, căn cứ, tài nguyên & biến dị',
    usesEraLabel: true,
    timeHint:
      'Gợi ý Ngày thứ mấy sau tận thế kèm ngày giờ cụ thể để đồng hồ theo dõi nhịp ngày đêm sinh tồn',
    defaultClock: {
      year: 2031,
      month: 11,
      day: 3,
      hour: 17,
      minute: 20,
      eraLabel: 'Ngày thứ 142 sau Đại Biến · Trước giờ giới nghiêm',
    },
    defaultDramaLevel: 'intense',
    placeholders: {
      worldName: 'VD: Khu Trú Ẩn Ga Ngầm Số 4',
      setting:
        'VD: Thành phố đổ nát sau đợt dịch biến dị và bão bụi, nơi những người sống sót co cụm trong các căn cứ tự quản, ngày đi tìm vật tư còn đêm khóa chặt cửa hầm...',
      rules:
        'VD: Nước sạch, lương thực, thuốc kháng sinh và nhiên liệu cực kỳ khan hiếm; sinh vật biến dị nhạy âm thanh và hung hãn hơn sau hoàng hôn; mọi vết thương hay xung đột giữa các phe phái đều có thể trả giá bằng mạng sống.',
      atmosphere:
        'VD: Ngột ngạt, hoang tàn, ánh hoàng hôn xám tro đầy căng thẳng sinh tồn',
      eraLabel: 'VD: Ngày thứ 142 sau Đại Biến · Mùa Đông Tro Bụi',
      mcRole:
        'VD: Trinh sát tìm vật tư / Kỹ sư sửa điện căn cứ / Người sống sót đơn độc mới tới',
      mcDesc:
        'VD: Áo khoác chống gió sờn rách, balo dã chiến gọn nhẹ, luôn giữ bình tĩnh và kiểm tra lối thoát trước khi bước vào phòng kín.',
      openingScenario:
        'VD: 17:20 chiều, còi báo sắp đến giờ giới nghiêm vang lên rè rè trên tường rào khu trú ẩn khi đội tiếp tế ngoài phố vẫn chưa quay về...',
    },
    quickIdeas: [
      'Khu trú ẩn cũ trước giờ giới nghiêm đêm sương đỏ',
      'Chuyến thu gom vật tư trong trung tâm thương mại bỏ hoang',
      'Căn cứ sinh tồn tranh giành nguồn nước sạch năm thứ 3 tận thế',
    ],
    starterTemplate: {
      worldName: 'Trạm Trú Ẩn Vành Đai 4',
      setting:
        'Một nhà kho công nghiệp kiên cố cải tạo thành khu trú ẩn cho khoảng hai trăm người sống sót ở rìa thành phố đổ nát. Bên ngoài bức tường thép là những con phố phủ bụi, xe cộ bỏ hoang và các khu vực bị sinh vật biến dị chiếm giữ.',
      rules:
        'Tài nguyên sống (nước lọc, đồ hộp, thuốc men, đạn dược và pin) vô cùng khan hiếm, dùng làm đơn vị trao đổi chính. Sau 18:30 tối tuyệt đối giới nghiêm vì thể biến dị hoạt động cực mạnh trong bóng tối; không ai được tự ý mở cổng khi chưa kiểm dịch.',
      atmosphere:
        'Hoang tàn, thực tế, căng thẳng nhưng vẫn le lói tình người giữa tận thế',
      dramaLevel: 'intense',
      mc: {
        name: 'Trần Kiên',
        pronoun: 'tôi',
        role: 'Trinh sát thu gom vật tư kiêm thợ sửa máy phát điện',
        description:
          '27 tuổi, áo khoác kaki sẫm nhiều túi, mang găng tay cụt ngón và đèn pin gài vai, ít nói nhưng phản xạ nhanh và giữ lời hứa.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Bác sĩ Minh Thư',
          role: 'Bác sĩ phụ trách phòng y tế & kiểm dịch căn cứ',
          personality:
            'Kiên quyết, mệt mỏi nhưng không bỏ mặc bệnh nhân, luôn cảnh giác với các dấu hiệu lây nhiễm.',
          appearance:
            'Áo khoác xanh rêu khoác ngoài áo thun cũ, tóc buộc đuôi ngựa vội, đeo túi cứu thương bên hông.',
          initialLocation: 'Trạm kiểm dịch cổng chính',
          initialMood: 'Lo lắng',
        },
        {
          name: 'Hoàng Vũ',
          role: 'Phó đội trưởng đội tuần tra vũ trang',
          personality:
            'Thực dụng, cứng rắn, đặt an toàn căn cứ lên trên cảm tính nhưng tôn trọng người làm được việc.',
          appearance:
            'Áo giáp tự chế ghép mảnh bảo hộ, vết sẹo mảnh bên thái dương, luôn đeo bộ đàm trên vai.',
          initialLocation: 'Chòi canh cổng thép phía Đông',
          initialMood: 'Căng thẳng',
        },
      ],
      openingScenario:
        '17:20 chiều Ngày thứ 142 sau Đại Biến, mặt trời đỏ đục sắp khuất sau những tòa chung cư đổ nghiêng. Bộ đàm trên chòi canh bất ngờ rè lên tín hiệu cầu cứu ngắt quãng từ đội tìm thuốc cách căn cứ chưa đầy hai cây số.',
    },
  },
  {
    id: 'urban',
    label: 'Hiện đại / Đô thị',
    shortDesc: 'Thương trường, phố đêm, công sở & bí ẩn',
    usesEraLabel: false,
    timeHint: 'Gợi ý ngày/giờ cụ thể theo nhịp sống thành phố hiện đại',
    defaultClock: {
      year: 2025,
      month: 10,
      day: 18,
      hour: 19,
      minute: 45,
      eraLabel: '',
    },
    defaultDramaLevel: 'balanced',
    placeholders: {
      worldName: 'VD: Tầng 48 Khu Tài Chính',
      setting:
        'VD: Trung tâm đô thị không ngủ với những tòa tháp kính, quán bar jazz tầng thượng và những thương vụ thâu tóm ngầm...',
      rules:
        'VD: Thực tế hiện đại, pháp luật và quyền lực tài chính đan xen; thông tin nội bộ và mạng lưới quan hệ quyết định thắng bại.',
      atmosphere: 'VD: Sắc nét, hiện đại, ánh đèn neon hắt trên cửa kính mưa',
      eraLabel: 'VD: Quý IV · Tuần chốt thương vụ (tùy chọn)',
      mcRole: 'VD: Cố vấn chiến lược / Phóng viên điều tra / Điều hành trẻ',
      mcDesc:
        'VD: Vest tối màu cắt may gọn gàng, nói chuyện ngắn gọn đúng trọng tâm, luôn giữ bình tĩnh dưới áp lực.',
      openingScenario:
        'VD: Đèn thành phố lên sáng rực lúc 19:45, một tập hồ sơ mật không đề tên người gửi bất ngờ xuất hiện trên bàn làm việc...',
    },
    quickIdeas: [
      'Thương vụ thâu tóm ngầm tại tầng 48 khu tài chính',
      'Quán bar jazz ẩn mình giữa trung tâm thành phố đêm mưa',
      'Nhóm điều tra tư nhân lần theo vụ mất tích kỳ lạ',
    ],
    starterTemplate: {
      worldName: 'Ánh Đèn Tầng 48',
      setting:
        'Khu trung tâm tài chính sầm uất về đêm, nơi các tập đoàn công nghệ, quỹ đầu tư và quán lounge bí mật trên sân thượng là điểm hẹn của những cuộc đàm phán triệu đô.',
      rules:
        'Hoàn toàn thực tế hiện đại. Mọi quyết định chịu ràng buộc bởi hợp đồng, truyền thông, luật pháp và lợi ích giữa các phe cổ đông.',
      atmosphere: 'Hiện đại, sắc sảo, căng nhẹ nhưng tinh tế',
      dramaLevel: 'balanced',
      mc: {
        name: 'Hoàng Nam',
        pronoun: 'tôi',
        role: 'Cố vấn chiến lược độc lập',
        description:
          '29 tuổi, sơ mi tối màu không cà vạt, phong thái điềm đạm, giỏi đọc vị đối phương qua chi tiết nhỏ.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Lan Anh',
          role: 'Giám đốc pháp chế tập đoàn',
          personality: 'Sắc bén, nguyên tắc, khó tin người nhưng cực kỳ sòng phẳng.',
          appearance: 'Blazer đen dáng dài, tóc búi thấp gọn gàng, ánh mắt thẳng thắn.',
          initialLocation: 'Phòng họp kính tầng 48',
          initialMood: 'Tập trung',
        },
        {
          name: 'Đức Minh',
          role: 'Chủ quán jazz lounge kiêm người nắm tin giới đầu tư',
          personality: 'Trầm ổn, hài hước kín đáo, luôn biết ai vừa gặp ai tối nay.',
          appearance: 'Gile xám đậm, tay áo xắn gọn, phong thái ung dung.',
          initialLocation: 'Quầy rượu tầng thượng',
          initialMood: 'Thư thái',
        },
      ],
      openingScenario:
        '19:45 tối Thứ Bảy, mưa lất phất trượt dài trên mặt kính tầng 48. Màn hình điện thoại sáng lên với một tin nhắn hẹn gặp gấp trong phòng lounge riêng sau 15 phút nữa.',
    },
  },
  {
    id: 'fantasy',
    label: 'Kỳ ảo / Giả tưởng',
    shortDesc: 'Ma pháp, học viện, lục địa & dị giới',
    usesEraLabel: true,
    timeHint: 'Gợi ý kỷ nguyên / năm giả tưởng kèm ngày giờ để theo dõi liên tục',
    defaultClock: {
      year: 1482,
      month: 9,
      day: 1,
      hour: 9,
      minute: 0,
      eraLabel: 'Kỷ nguyên Tinh Hải · Năm 1482 · Mùa Thu Khai Giảng',
    },
    defaultDramaLevel: 'intense',
    placeholders: {
      worldName: 'VD: Học Viện Ma Pháp Tháp Bạc',
      setting:
        'VD: Thành phố cảng xây quanh ngọn tháp tinh thể cổ, nơi các học giả, pháp sư và thợ săn di tích cùng tồn tại giữa làn sương ma lực...',
      rules:
        'VD: Ma pháp tuân theo nguyên lý cân bằng và tiêu hao tinh thần lực; cổ vật cấm bị Hội Đồng Tháp giám sát chặt.',
      atmosphere: 'VD: Kỳ vĩ, huyền ảo, pha chút bí ẩn cổ xưa',
      eraLabel: 'VD: Kỷ nguyên Nhật Thực · Năm 309 · Tuần Trăng Non',
      mcRole: 'VD: Học viên năm nhất mang ấn ký lạ / Thợ chế tạo cổ khí',
      mcDesc:
        'VD: Áo choàng vải dạ xanh đậm cài trâm đồng, đôi mắt phản chiếu ánh sáng mờ khi cảm ứng ma lực.',
      openingScenario:
        'VD: Tiếng chuông đồng trên đỉnh Tháp Bạc ngân vang lúc 09:00 sáng, báo hiệu cánh cổng học viện mở ra đón lứa học viên mới...',
    },
    quickIdeas: [
      'Học viện ma pháp mùa khai giảng đầy bí ẩn',
      'Thành phố cảng cổ nơi phép thuật đang dần suy tàn',
      'Hiệp hội thợ săn di tích dưới lòng lục địa bay',
    ],
    starterTemplate: {
      worldName: 'Thành Phố Tháp Bạc',
      setting:
        'Một đô thị xây trên vách đá ven biển xoay quanh Tháp Bạc cổ đại — trung tâm nghiên cứu ma pháp, chế tạo cổ khí và giao thương giữa các vương quốc trên lục địa.',
      rules:
        'Mọi phép thuật đều cần ma lực và vật dẫn; lạm dụng sẽ gây phản phệ tinh thần. Các di tích cổ thuộc quyền quản lý nghiêm ngặt của Hội Đồng Tháp.',
      atmosphere: 'Huyền ảo, hùng vĩ, ánh nắng biển hòa cùng bụi tinh thể phát sáng',
      dramaLevel: 'balanced',
      mc: {
        name: 'Aiden',
        pronoun: 'tôi',
        role: 'Học giả trẻ chuyên phục chế cổ khí',
        description:
          'Áo khoác dài màu xanh đá, đeo túi da đựng đá dẫn ma lực, điềm tĩnh và tò mò trước mọi bí mật cổ đại.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Seraphina',
          role: 'Trợ giảng phân viện Tinh Chiêm',
          personality: 'Kiêu hãnh nhưng tận tâm, nói chuyện chuẩn mực và có trực giác rất mạnh.',
          appearance: 'Áo choàng trắng viền chỉ bạc, tóc bạch kim dài tết nửa đầu, cầm quyền trượng tinh thể nhỏ.',
          initialLocation: 'Sảnh vòm tinh đồ',
          initialMood: 'Nghiêm túc',
        },
        {
          name: 'Kaelen',
          role: 'Thợ săn di tích tự do',
          personality: 'Phóng khoáng, liều lĩnh có tính toán, biết mọi lối tắt trong khu chợ đêm.',
          appearance: 'Áo da nâu sờn vai, găng tay khảm phù văn mờ, nụ cười nửa miệng.',
          initialLocation: 'Quảng trường Cổng Biển',
          initialMood: 'Tò mò',
        },
      ],
      openingScenario:
        'Đúng 09:00 sáng ngày đầu thu, tiếng chuông pha lê từ đỉnh Tháp Bạc ngân vang khắp bến cảng. Trong xưởng phục chế nhỏ, một mảnh cổ khí tưởng đã tắt lịm hàng trăm năm bỗng phát ra nhịp sáng yếu ớt.',
    },
  },
  {
    id: 'scifi',
    label: 'Khoa học viễn tưởng',
    shortDesc: 'Không gian, trạm quỹ đạo, AI & tương lai',
    usesEraLabel: true,
    timeHint: 'Gợi ý năm tương lai & chu kỳ trạm đồng bộ với đồng hồ 24h',
    defaultClock: {
      year: 2184,
      month: 11,
      day: 7,
      hour: 22,
      minute: 15,
      eraLabel: 'Chu kỳ Quỹ Đạo 2184 · Ca Đêm Trạm Helios-9',
    },
    defaultDramaLevel: 'intense',
    placeholders: {
      worldName: 'VD: Trạm Quỹ Đạo Helios-9',
      setting:
        'VD: Trạm trung chuyển ngoài quỹ đạo sao Hỏa nơi các phi hành đoàn, kỹ sư mạng và đại diện tập đoàn hành tinh dừng chân...',
      rules:
        'VD: Tài nguyên oxy, năng lượng và tín hiệu liên lạc về Trái Đất có độ trễ thực tế; AI quản trị trạm tuân thủ giao thức an toàn nghiêm ngặt.',
      atmosphere: 'VD: Lạnh sắc nét, tĩnh lặng ngoài không gian, ánh đèn bảng điều khiển dịu',
      eraLabel: 'VD: Năm Thuộc Địa 2184 · Ca trực 03',
      mcRole: 'VD: Kỹ sư bảo trì hệ thống / Điều phối viên phi hành đoàn',
      mcDesc:
        'VD: Bộ đồ bay kỹ thuật xám đậm, đeo vòng cảm biến cổ tay, quen xử lý sự cố trong im lặng.',
      openingScenario:
        'VD: 22:15 giờ chuẩn trạm, đèn hành lang chuyển sang chế độ ca đêm thì cảm biến khoang cập bến C báo một tàu không đăng ký đang tiếp cận...',
    },
    quickIdeas: [
      'Trạm quỹ đạo cận sao Hỏa trong ca trực đêm',
      'Thành phố ngầm dưới lớp băng năm 2190',
      'Con tàu thám hiểm thức giấc giữa tinh vân lạ',
    ],
    starterTemplate: {
      worldName: 'Trạm Quỹ Đạo Helios-9',
      setting:
        'Trạm trung chuyển quỹ đạo xoay quanh sao Hỏa, gồm khu dân cư vòng ngoài, bến tàu hàng hóa và phòng thí nghiệm tín hiệu sâu vũ trụ.',
      rules:
        'Công nghệ gần-tương lai hợp lý: liên lạc về Trái Đất có độ trễ hàng chục phút, mọi khoang đều phụ thuộc hệ thống lọc khí và kiểm soát áp suất.',
      atmosphere: 'Tĩnh lặng, điện ảnh khoa học viễn tưởng, ánh sáng xanh lạnh tương phản cửa sổ sao',
      dramaLevel: 'intense',
      mc: {
        name: 'Linh Vũ',
        pronoun: 'tôi',
        role: 'Kỹ sư điều phối khoang cập bến',
        description:
          '28 tuổi, mặc áo khoác kỹ thuật xanh đen có phù hiệu trạm, đầu óc tỉnh táo và phản xạ nhanh.',
        absentAtStart: false,
      },
      npcs: [
        {
          name: 'Marcus Vance',
          role: 'Cơ trưởng tàu vận tải đường dài',
          personality: 'Lão luyện, nói thẳng, ít tin các tập đoàn trung tâm nhưng rất bảo vệ thủy thủ đoàn.',
          appearance: 'Râu quai nón cắt gọn, áo phi hành sờn vai, ánh mắt điềm tĩnh.',
          initialLocation: 'Khoang cập bến C',
          initialMood: 'Cảnh giác',
        },
        {
          name: 'Dr. Elena Sato',
          role: 'Chuyên gia giải mã tín hiệu ngoài quỹ đạo',
          personality: 'Tỉ mỉ, đam mê khoa học, đôi khi quên cả giờ giấc khi thấy dữ liệu bất thường.',
          appearance: 'Kính hiển thị dữ liệu trong suốt, tóc đen buộc cao, áo blouse xám nhạt.',
          initialLocation: 'Phòng quan sát tầng 4',
          initialMood: 'Căng thẳng',
        },
      ],
      openingScenario:
        '22:15 giờ chuẩn trạm Helios-9. Khi ánh đèn hành lang vừa hạ xuống tông xanh đêm, màn hình radar khoang C bỗng phát tín hiệu yêu cầu hạ cánh khẩn từ một con tàu không có trong lịch bay.',
    },
  },
];

export function getWorldGenrePreset(id: WorldGenreId): WorldGenrePreset {
  return (
    WORLD_GENRE_PRESETS.find((g) => g.id === id) || WORLD_GENRE_PRESETS[0]
  );
}
