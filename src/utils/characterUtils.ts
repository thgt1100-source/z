import type {
  CharacterPortrait,
  CharacterStateSnapshot,
  CompanionNpc,
  CompanionProfile,
  CultivationProfile,
  PortraitBankConfig,
  StoryClockState,
} from '../types/ark';

export function normalizeCharacterKey(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeAgeFromBirthday(
  birthday?: string,
  clock?: StoryClockState,
): string {
  const raw = String(birthday || '').trim();
  if (!raw) return '';

  let birthYear = 0;
  let birthMonth = 0;
  let birthDay = 0;

  const dmy = raw.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/);
  const ymd = !dmy
    ? raw.match(/(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/)
    : null;

  if (dmy) {
    birthDay = Number(dmy[1]);
    birthMonth = Number(dmy[2]);
    birthYear = Number(dmy[3]);
  } else if (ymd) {
    birthYear = Number(ymd[1]);
    birthMonth = Number(ymd[2]);
    birthDay = Number(ymd[3]);
  } else {
    const yearOnly = raw.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearOnly) {
      birthYear = Number(yearOnly[1]);
    }
  }

  if (!birthYear || birthYear < 1850 || birthYear > 2200) return '';

  const now = new Date();
  const hasClockYear =
    typeof clock?.year === 'number' &&
    Number.isFinite(clock.year) &&
    clock.year >= 1900 &&
    clock.year <= 2500;
  const refYear = hasClockYear ? Math.floor(clock!.year) : now.getFullYear();
  const refMonth =
    hasClockYear && typeof clock?.month === 'number' && clock.month >= 1 && clock.month <= 12
      ? Math.floor(clock.month)
      : now.getMonth() + 1;
  const refDay =
    hasClockYear && typeof clock?.day === 'number' && clock.day >= 1 && clock.day <= 31
      ? Math.floor(clock.day)
      : now.getDate();

  let age = refYear - birthYear;
  if (birthMonth >= 1 && birthMonth <= 12) {
    if (refMonth < birthMonth || (refMonth === birthMonth && birthDay >= 1 && refDay < birthDay)) {
      age -= 1;
    }
  }
  if (age < 1 || age > 140) return '';
  return `${age} tuổi`;
}

export function resolveEffectiveCharacterAge(options: {
  age?: string;
  birthday?: string;
  extraText?: string;
  clock?: StoryClockState;
}): {
  ageNum?: number;
  ageLabel: string;
  birthYear?: number;
} {
  const rawAge = String(options.age || '').trim();
  const rawBirth = String(options.birthday || '').trim();
  const extraText = String(options.extraText || '').trim();

  const extractBirthYearFromText = (txt: string): number | undefined => {
    if (!txt) return undefined;
    const explicit = txt.match(
      /(?:sinh\s*năm|sn|born(?:\s+in)?|năm\s*sinh)\s*[:.\-]?\s*(19\d{2}|20\d{2})\b/i,
    );
    if (explicit) {
      const y = Number(explicit[1]);
      if (y >= 1900 && y <= 2030) return y;
    }
    return undefined;
  };

  const extractNumericAge = (txt: string): number | undefined => {
    if (!txt) return undefined;
    const direct = txt.match(/^\s*(\d{1,2})\s*(?:tuổi|t|yo|y\.?o\.?|years?\s*old)?\s*$/i);
    if (direct) {
      const n = Number(direct[1]);
      if (n >= 5 && n <= 110) return n;
    }
    const tagged = txt.match(/\b(\d{1,2})\s*(?:tuổi|years?\s*old|[\s-]*year[\s-]*old)\b/i);
    if (tagged) {
      const n = Number(tagged[1]);
      if (n >= 5 && n <= 110) return n;
    }
    return undefined;
  };

  // 1. Prefer exact calculation from explicit birthday (e.g. 1990 or 12/05/1990 -> 36 tuổi)
  const birthYearDirect = rawBirth.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
  const fromBirthday = rawBirth
    ? computeAgeFromBirthday(rawBirth, options.clock)
    : '';
  const fromBirthdayNum = extractNumericAge(fromBirthday);

  // 2. Check if the age field itself holds a 4-digit birth year (e.g. "1990" or "sinh năm 1990")
  const ageFieldBirthYear = rawAge.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
  const fromAgeFieldYear = ageFieldBirthYear
    ? computeAgeFromBirthday(ageFieldBirthYear, options.clock)
    : '';
  const fromAgeFieldYearNum = extractNumericAge(fromAgeFieldYear);

  // 3. Explicit numeric age in age field (e.g. "36 tuổi" or "36")
  const explicitAgeNum = !ageFieldBirthYear ? extractNumericAge(rawAge) : undefined;

  // 4. Fallback: birth year or explicit age mentioned in profile text (e.g. "sinh năm 1990")
  const extraBirthYear = extractBirthYearFromText(extraText);
  const fromExtraBirthYear = extraBirthYear
    ? computeAgeFromBirthday(String(extraBirthYear), options.clock)
    : '';
  const fromExtraBirthYearNum = extractNumericAge(fromExtraBirthYear);
  const extraAgeNum = extractNumericAge(extraText);

  if (fromBirthdayNum) {
    return {
      ageNum: fromBirthdayNum,
      ageLabel: `${fromBirthdayNum} tuổi`,
      birthYear: birthYearDirect ? Number(birthYearDirect) : undefined,
    };
  }
  if (fromAgeFieldYearNum) {
    return {
      ageNum: fromAgeFieldYearNum,
      ageLabel: `${fromAgeFieldYearNum} tuổi`,
      birthYear: ageFieldBirthYear ? Number(ageFieldBirthYear) : undefined,
    };
  }
  if (explicitAgeNum) {
    return {
      ageNum: explicitAgeNum,
      ageLabel: `${explicitAgeNum} tuổi`,
      birthYear: extraBirthYear,
    };
  }
  if (fromExtraBirthYearNum) {
    return {
      ageNum: fromExtraBirthYearNum,
      ageLabel: `${fromExtraBirthYearNum} tuổi`,
      birthYear: extraBirthYear,
    };
  }
  if (extraAgeNum) {
    return {
      ageNum: extraAgeNum,
      ageLabel: `${extraAgeNum} tuổi`,
    };
  }
  return {
    ageLabel: rawAge,
  };
}

export function formatAgeBirthdayLabel(age?: string, birthday?: string): string {
  const cleanAge = String(age || '').trim();
  const cleanBirth = String(birthday || '').trim();
  const formattedAge =
    cleanAge && /^\d+$/.test(cleanAge) ? `${cleanAge} tuổi` : cleanAge;
  if (formattedAge && cleanBirth) return `${formattedAge} · Sinh ${cleanBirth}`;
  if (formattedAge) return formattedAge;
  if (cleanBirth) return `Sinh ${cleanBirth}`;
  return '';
}

export interface KnownCelebrityProfile {
  canonicalName: string;
  aliases?: string[];
  role: string;
  birthday?: string;
  fashionStyle?: string;
  appearance: string;
  personality?: string;
  relationships?: string;
  signature?: string;
}

const KNOWN_CELEBRITY_LIST: KnownCelebrityProfile[] = [
  {
    canonicalName: 'Central Cee',
    aliases: ['cench', 'oakley'],
    role: 'Rapper UK',
    birthday: '04/06/1998',
    fashionStyle:
      'Streetwear London hiện đại (Syna World/Trapstar): tracksuit, áo khoác puffer hoặc hoodie rộng, tanktop trắng bên trong, quần cargo, phối dây chuyền bạc, nhẫn và đồng hồ sang trọng.',
    appearance:
      'Nam rapper gốc Anh lai châu Á, vóc dáng gầy cao, tóc cắt buzzcut/fade sát gọn gàng, khuôn mặt sắc nét có râu cằm mảnh, ánh mắt điềm tĩnh.',
    personality:
      'Điềm tĩnh, kín tiếng và thực tế kiểu London; nói chuyện ngắn gọn, giọng Anh trầm rõ nhịp, hiếm khi tỏ ra phấn khích quá mức kể cả giữa bữa tiệc đông người.',
    relationships:
      'Gần gũi với ê-kíp từ London, giữ khoảng cách lịch sự nhưng tinh ý quan sát giới nghệ sĩ và người nổi tiếng tại Los Angeles.',
    signature:
      'Thói quen xoay nhẹ nhẫn/đồng hồ trên tay và hay quan sát cả căn phòng từ góc khuất với nụ cười nửa miệng.',
  },
  {
    canonicalName: 'MGK',
    aliases: ['machine gun kelly', 'colson baker'],
    role: 'Ca sĩ / Rapper',
    birthday: '22/04/1990',
    fashionStyle:
      'Punk-rock / Glam-rock nổi loạn: áo khoác da đinh tán, áo tanktop hoặc sơ mi họa tiết xẻ sâu khoe hình xăm, quần da/denim rách phối dày đặc nhẫn bạc, vòng cổ xích và sơn móng tay.',
    appearance:
      'Nam nghệ sĩ Mỹ rất cao và gầy, tóc bạch kim rối nhẹ phong cách punk-rock, nhiều hình xăm dày đặc phủ kín cổ, ngực và cánh tay.',
    personality:
      'Phóng khoáng, bốc đồng và giàu năng lượng nổi loạn; nói chuyện trực tính, hay pha trò bất ngờ và dễ bị cuốn theo bầu không khí tiệc tùng.',
    relationships:
      'Dễ bắt chuyện với giới nhạc sĩ, rapper và các gương mặt nổi loạn trong làng giải trí Hollywood, chuộng kiểu tương tác tự nhiên không màu mè.',
    signature:
      'Nụ cười nhếch mép đặc trưng, hay gõ nhịp theo tiếng nhạc bằng những ngón tay đeo đầy nhẫn bạc.',
  },
  {
    canonicalName: 'Zac Bia',
    role: 'DJ / Doanh nhân giải trí',
    birthday: '09/06/1996',
    fashionStyle:
      'Streetwear LA cao cấp kết hợp nightlife casual: áo khoác bomber/denim dáng rộng, áo thun vintage hoặc sơ mi mở cổ, quần suông, kính râm gọng nhỏ và trang sức vàng tối giản.',
    appearance:
      'Nam DJ kiêm doanh nhân trẻ tại Los Angeles, tóc nâu xoăn nhẹ rẽ tự nhiên, râu ria gọn gàng, thần thái tiệc tùng thoải mái.',
    personality:
      'Khéo léo, hòa đồng và cực kỳ nhạy với bầu không khí đám đông; luôn giữ thái độ nhẹ nhàng, kiểm soát nhịp tiệc và kết nối mọi người một cách tự nhiên.',
    relationships:
      'Mắt xích quen mặt trong giới tiệc tùng Beverly Hills và Hollywood, quen biết rộng từ siêu mẫu, rapper đến các nhà sản xuất âm nhạc.',
    signature:
      'Thường đứng gần bàn nhạc hoặc góc quầy bar, luôn biết cách hạ nhiệt căng thẳng chỉ bằng một câu đùa đúng lúc hoặc đổi bản nhạc.',
  },
  {
    canonicalName: 'Kendall Jenner',
    aliases: ['kendall'],
    role: 'Siêu mẫu',
    birthday: '03/11/1995',
    fashionStyle:
      'Quiet luxury tối giản sang trọng kiểu The Row / Bottega Veneta: áo khoác dáng dài hoặc sơ mi tối giản, quần ống suông thanh lịch, đầm lụa slip dress ôm dáng tinh tế và phụ kiện nhỏ gọn.',
    appearance:
      'Siêu mẫu Mỹ vóc dáng cao mảnh mai, tóc nâu đen dài thẳng mượt rẽ ngôi giữa, gương mặt góc cạnh thanh tú, trang điểm tự nhiên tông nude.',
    personality:
      'Điềm đạm, hơi trầm và giữ khoảng cách thanh lịch hơn so với phần còn lại của gia đình; ăn nói gãy gọn, chuộng không gian riêng tư và tinh tế khi đánh giá người đối diện.',
    relationships:
      'Thân thiết với hội bạn siêu mẫu và giới thời trang Los Angeles; hòa nhã với chị em nhà Kardashian-Jenner nhưng vẫn giữ nét độc lập riêng.',
    signature:
      'Ánh nhìn thẳng điềm tĩnh, hay cầm ly rượu tequila hoặc tựa nhẹ bên lan can quan sát hơn là phô trương giữa đám đông.',
  },
  {
    canonicalName: 'Kim Kardashian',
    aliases: ['kim'],
    role: 'Ngôi sao truyền hình / Doanh nhân',
    birthday: '21/10/1980',
    fashionStyle:
      'High-fashion ôm dáng tôn đường cong: đầm bodycon cắt xẻ sắc sảo, bodysuit trung tính cao cấp kiểu Balenciaga/SKIMS, áo khoác lông hoặc kính râm bản lớn nổi bật.',
    appearance:
      'Phụ nữ vóc dáng đồng hồ cát quyến rũ, tóc đen dài bóng mượt (hoặc uốn sóng nhẹ), trang điểm sắc sảo nhấn mắt khói và môi tông nude, thần thái tự tin quyền lực.',
    personality:
      'Sắc sảo, điềm tĩnh và luôn ý thức rõ sức hút lẫn hình ảnh trước đám đông; nói chuyện mềm mỏng nhưng đầy chủ đích, giữ đầu óc tỉnh táo ngay cả khi đối mặt tình huống bất ngờ.',
    relationships:
      'Trung tâm kết nối của gia tộc Kardashian-Jenner, lịch thiệp với giới giải trí hạng A và rất tinh ý đọc vị động cơ người khác.',
    signature:
      'Luôn giữ dáng đứng hoàn hảo trong mọi góc nhìn, giọng nói chậm rãi nhẹ nhàng nhưng đủ sức dẫn dắt cả cuộc trò chuyện.',
  },
  {
    canonicalName: 'Kris Jenner',
    role: 'Quản lý / Doanh nhân',
    birthday: '05/11/1955',
    fashionStyle:
      'Power-dressing sang trọng quyền lực: blazer hoặc suit nữ may đo cao cấp tông đen-trắng, áo cổ lọ lụa, kính râm mắt mèo và trang sức kim cương nổi bật.',
    appearance:
      'Phụ nữ trung niên sắc sảo sang trọng, mái tóc pixie đen cắt ngắn đặc trưng, trang điểm chỉn chu nổi bật đôi mắt kẻ đậm, phong thái quyền lực.',
    personality:
      'Quyết đoán, sắc bén và nhạy bén với cơ hội; ăn nói duyên dáng nhưng có uy, luôn nắm nhịp câu chuyện và xoay chuyển tình huống căng thẳng rất nhanh.',
    relationships:
      'Người cầm trịch gia tộc Kardashian-Jenner, giao thiệp rộng khắp giới doanh nhân, truyền thông và nghệ sĩ hàng đầu Hollywood.',
    signature:
      'Nụ cười ngoại giao hoàn hảo đi kèm ánh mắt tính toán nhanh nhạy và chiếc điện thoại hầu như không rời tay.',
  },
  {
    canonicalName: 'Kylie Jenner',
    aliases: ['kylie'],
    role: 'Doanh nhân / Ngôi sao mạng xã hội',
    birthday: '10/08/1997',
    fashionStyle:
      'Quyến rũ hiện đại pha nét tiểu thư tối giản: đầm cắt xẻ ôm dáng, corset thiết kế, đồ da bóng cao cấp hoặc váy lụa cổ điển tinh tế kèm túi xách mini xa xỉ.',
    appearance:
      'Nữ doanh nhân trẻ vóc dáng quyến rũ, tóc đen dài gợn sóng, đôi môi đầy đặn và lối trang điểm sắc nét cuốn hút.',
    personality:
      'Bề ngoài lạnh lùng quyến rũ nhưng thực tế khá kín đáo và chọn lọc người trò chuyện; giọng nói nhỏ nhẹ, phản ứng chừng mực khi gặp người lạ.',
    relationships:
      'Gắn bó chặt với gia đình và nhóm bạn thân quen thuộc, thường xuất hiện cùng Kendall hoặc các gương mặt trẻ nổi bật của Hollywood.',
    signature:
      'Phong thái sang chảnh khó đoán, chỉ thực sự thả lỏng khi trò chuyện với người trong vòng thân cận.',
  },
  {
    canonicalName: 'Khloé Kardashian',
    aliases: ['khloe kardashian'],
    role: 'Ngôi sao truyền hình / Doanh nhân',
    birthday: '27/06/1984',
    fashionStyle:
      'Glam gợi cảm nổi bật: đầm dự tiệc ôm sát tôn dáng, jumpsuit lấp lánh hoặc denim ôm kết hợp áo khoác dáng dài, bốt cao gót và trang sức ánh kim bản lớn.',
    appearance:
      'Phụ nữ cao ráo vóc dáng săn chắc quyến rũ, tóc vàng mật ong dài uốn sóng, trang điểm sắc sảo nổi bật.',
    personality:
      'Thẳng thắn, hài hước và giàu năng lượng bảo vệ người thân; ăn nói bộc trực, dễ phá vỡ bầu không khí gượng gạo bằng câu đùa sắc sảo.',
    relationships:
      'Hết lòng vì gia đình và bạn bè thân thiết, sẵn sàng lên tiếng nếu thấy ai đó cư xử thiếu tôn trọng.',
    signature:
      'Tiếng cười phóng khoáng và những nhận xét thẳng băng không vòng vo.',
  },
  {
    canonicalName: 'Kourtney Kardashian',
    aliases: ['kourtney'],
    role: 'Ngôi sao truyền hình / Doanh nhân',
    birthday: '18/04/1979',
    fashionStyle:
      'Rock-chic pha cổ điển toàn tông đen: áo khoác da oversized, áo thun ban nhạc vintage, đầm ren đen ôm sát, bốt đế dày và kính râm gọng mảnh.',
    appearance:
      'Phụ nữ vóc dáng nhỏ nhắn thanh mảnh, tóc bob đen ngắn cá tính, gương mặt sắc nét.',
    personality:
      'Lạnh lùng kiểu tưng tửng, thích đặt ranh giới rõ ràng và không ngại nói thẳng điều mình nghĩ với giọng điệu bình thản.',
    relationships:
      'Ưu tiên không gian riêng và lối sống cá nhân, hay có những màn đối đáp sắc lạnh nhưng tự nhiên với các chị em.',
    signature:
      'Biểu cảm bình thản gần như không đổi trước mọi drama, kèm những câu đáp ngắn gọn đầy châm biếm nhẹ.',
  },
  {
    canonicalName: 'Jennie Kim',
    aliases: ['jennie', 'kim jennie', 'jennie ruby jane'],
    role: 'Ca sĩ / Biểu tượng thời trang',
    birthday: '16/01/1996',
    fashionStyle:
      'High-fashion tiểu thư hiện đại pha streetwear cá tính (Chanel / Jacquemus): áo tweed ngắn, croptop phối quần ống rộng cạp trễ, đầm ngắn thanh lịch cùng kính râm và vòng cổ ngọc trai.',
    appearance:
      'Nữ ca sĩ Hàn Quốc vóc dáng mảnh mai cân đối, tóc đen dài mượt (hoặc nâu đen trầm), đường nét gương mặt thanh tú, đôi mắt mèo sắc sảo đặc trưng, má bầu nhẹ dễ thương pha nét sang chảnh.',
    personality:
      'Vừa toát lên khí chất tiểu thư lạnh lùng tự tin, vừa có nét mềm mại hóm hỉnh khi thân quen; nói chuyện tinh tế, giọng nhẹ nhàng nhưng rất có chủ kiến và bản lĩnh trước áp lực.',
    relationships:
      'Được giới thời trang và âm nhạc quốc tế quý mến; hòa nhã với các nghệ sĩ ở Hollywood và giữ vòng bạn bè thân thiết chọn lọc.',
    signature:
      'Ánh mắt mèo hơi nheo lại khi quan sát điều thú vị và cách chuyển từ vẻ lạnh lùng sang nụ cười ấm áp chỉ trong một giây.',
  },
  {
    canonicalName: 'Rosé',
    aliases: ['rose', 'park chaeyoung', 'roseanne park'],
    role: 'Ca sĩ',
    birthday: '11/02/1997',
    fashionStyle:
      'Tối giản sang lạnh kiểu Saint Laurent: đầm đen ngắn tinh tế, áo khoác da hoặc áo len dệt kim dáng rộng phối quần cạp cao, trang sức vàng mảnh thanh thoát.',
    appearance:
      'Nữ ca sĩ vóc dáng cao thanh mảnh, mái tóc vàng bạch kim dài mượt đặc trưng, gương mặt thanh thoát khí chất mơ màng.',
    personality:
      'Nhạy cảm, tinh tế và lịch thiệp; ăn nói chân thành, giọng nói mềm pha nét phóng khoáng kiểu Úc, dễ đồng cảm với nghệ thuật và cảm xúc chân thật.',
    relationships:
      'Gần gũi với các nghệ sĩ âm nhạc và giới thời trang cao cấp, luôn giữ phong thái chân thành và tôn trọng người đối diện.',
    signature:
      'Thói quen vuốt nhẹ lọn tóc vàng khi suy nghĩ và ánh mắt sáng lên khi nhắc đến âm nhạc.',
  },
  {
    canonicalName: 'Lisa',
    aliases: ['lalisa', 'lalisa manobal'],
    role: 'Ca sĩ / Vũ công',
    birthday: '27/03/1997',
    fashionStyle:
      'Luxury streetwear cá tính sắc sảo (Louis Vuitton / Celine): áo khoác da dáng ngắn, croptop phối quần cargo hoặc chân váy da ngắn, bốt hầm hố và trang sức kim loại nổi bật.',
    appearance:
      'Nữ ca sĩ vóc dáng cao mảnh tỷ lệ chuẩn, đôi mắt to sắc sảo, tóc dài có mái bằng đặc trưng, thần thái tự tin cá tính.',
    personality:
      'Tươi sáng, hoạt bát và tràn đầy tự tin; dễ tạo thiện cảm bằng sự cởi mở nhưng lập tức sắc sảo, bản lĩnh khi bước vào tâm điểm chú ý.',
    relationships:
      'Hòa đồng với giới nghệ sĩ toàn cầu, mang lại năng lượng sôi nổi cho mọi cuộc tụ họp.',
    signature:
      'Nụ cười rạng rỡ tự nhiên đi kèm phong thái dứt khoát như bước ra từ sàn diễn.',
  },
  {
    canonicalName: 'Jisoo',
    aliases: ['kim jisoo'],
    role: 'Ca sĩ / Diễn viên',
    birthday: '03/01/1995',
    fashionStyle:
      'Tiểu thư thanh lịch cổ điển kiểu Dior: đầm chữ A mềm mại, áo cardigan hoặc áo sơ mi lụa phối chân váy xếp ly, túi xách cổ điển và trang sức mảnh tinh xảo.',
    appearance:
      'Nữ ca sĩ kiêm diễn viên Hàn Quốc nét đẹp cổ điển thanh lịch, tóc đen dài thẳng dịu dàng, nụ cười ngọt ngào.',
    personality:
      'Điềm đạm, vững vàng và hài hước duyên dáng kiểu tinh quái nhẹ; giữ bình tĩnh rất tốt trước tình huống bất ngờ.',
    relationships:
      'Chu đáo và dễ mến với bạn bè, luôn là điểm tựa điềm tĩnh trong nhóm.',
    signature:
      'Giọng nói trầm ấm dễ nhận ra và những câu đùa nhẹ nhàng làm dịu bầu không khí.',
  },
  {
    canonicalName: 'Leonardo DiCaprio',
    aliases: ['leo dicaprio'],
    role: 'Diễn viên Hollywood',
    birthday: '11/11/1974',
    fashionStyle:
      'Casual kín đáo kiểu Hollywood đời thường: áo khoác bomber hoặc jacket tối màu, áo thun trơn/polo tối giản, quần jeans tối màu, sneaker sạch và mũ lưỡi trai đen kéo thấp.',
    appearance:
      'Nam tài tử Hollywood trung niên, tóc nâu vàng chải gọn hoặc đội mũ lưỡi trai kín đáo, râu dê cắt tỉa gọn, ánh mắt sâu sắc điềm tĩnh.',
    personality:
      'Kín tiếng, từng trải và cực kỳ chuộng sự riêng tư; quan sát sắc bén, nói chuyện chậm rãi có trọng lượng và hiếm khi để lộ cảm xúc thật giữa chốn đông người.',
    relationships:
      'Có uy thế tự nhiên giữa giới điện ảnh và tiệc tùng Hollywood, chỉ trò chuyện sâu với nhóm bạn lâu năm hoặc những người cùng đẳng cấp.',
    signature:
      'Thói quen chọn góc khuất ánh đèn, kéo nhẹ vành mũ hoặc cầm ly đồ uống lắng nghe nhiều hơn nói.',
  },
  {
    canonicalName: "Finneas O'Connell",
    aliases: ['finneas'],
    role: 'Nhạc sĩ / Nhà sản xuất âm nhạc',
    birthday: '30/07/1997',
    fashionStyle:
      'Indie smart-casual thư sinh kiểu Los Angeles: áo sơ mi mở cổ họa tiết nhẹ hoặc áo len dệt kim, áo khoác da lộn/jacket dáng thoải mái phối quần ống suông và giày loafers hoặc bốt cổ thấp.',
    appearance:
      'Nam nhạc sĩ Mỹ vóc dáng cao thư sinh, tóc nâu đỏ/nâu sáng rẽ nhẹ tự nhiên, gương mặt sáng sủa điềm đạm.',
    personality:
      'Thông minh, lịch thiệp và có chiều sâu nghệ sĩ; nói chuyện mạch lạc pha chút hóm hỉnh trí thức, lắng nghe tinh tế và hiếm khi mất bình tĩnh.',
    relationships:
      'Được giới nhạc sĩ và ca sĩ nể trọng vì tài năng sản xuất âm nhạc, thân thiết với Billie Eilish và nhóm nghệ sĩ indie/pop tại Los Angeles.',
    signature:
      'Cách trò chuyện điềm đạm, hay chú ý đến chi tiết âm thanh hoặc giai điệu đang vang lên xung quanh.',
  },
  {
    canonicalName: 'Charli XCX',
    aliases: ['charli'],
    role: 'Ca sĩ nhạc Pop',
    birthday: '02/08/1992',
    fashionStyle:
      'Clubwear / Y2K tiệc tùng nổi loạn: áo khoác da ngắn, áo cut-out hoặc slip dress táo bạo, chân váy siêu ngắn, bốt da cao cổ và kính râm đen góc cạnh.',
    appearance:
      'Nữ ca sĩ Anh cá tính nổi loạn, mái tóc đen dài dày đánh rối tự nhiên, trang điểm mắt khói sắc nét, hay đeo kính râm đen.',
    personality:
      'Táo bạo, bộc trực và tràn đầy năng lượng tiệc tùng; ăn nói sắc sảo pha chút ngông nghênh duyên dáng, ghét sự giả tạo và luôn khuấy động bầu không khí.',
    relationships:
      'Trung tâm của những bữa tiệc đêm sành điệu, thân quen với giới DJ, nhạc sĩ điện tử và các biểu tượng pop phá cách.',
    signature:
      'Đeo kính râm đen ngay cả trong ánh đèn tiệc mờ ảo và hay nâng ly kéo mọi người vào nhịp nhạc.',
  },
  {
    canonicalName: 'Billie Eilish',
    aliases: ['billie'],
    role: 'Ca sĩ',
    birthday: '18/12/2001',
    fashionStyle:
      'Streetwear oversized đậm chất cá nhân: áo jersey hoặc sơ mi rộng nhiều lớp, quần baggy/short lửng rộng, giày sneaker hầm hố, mũ beanie và nhiều tầng vòng cổ/nhẫn bạc.',
    appearance:
      'Nữ ca sĩ Mỹ gương mặt góc cạnh với đôi mắt xanh lạnh đặc trưng, tóc tối màu hoặc nhuộm highlight nổi bật.',
    personality:
      'Chân thật, sắc sảo và có phần nổi loạn trầm lắng; ăn nói tự nhiên pha hài hước khô kiểu gen Z, không thích kiểu xã giao giả lả.',
    relationships:
      'Cực kỳ gắn bó với anh trai Finneas và vòng bạn bè nghệ sĩ thân cận; thẳng thắn nhưng ấm áp với người hợp tần số.',
    signature:
      'Ánh mắt nhìn nghiêng đặc trưng và điệu cười khẽ khi bắt gặp tình huống oái oăm.',
  },
  {
    canonicalName: 'Bella Hadid',
    role: 'Siêu mẫu',
    birthday: '09/10/1996',
    fashionStyle:
      'Vintage thập niên 90 pha haute couture sắc lạnh: áo khoác da cổ điển, áo tanktop hoặc đầm lụa cắt chéo ôm dáng, kính râm mắt nhỏ gọng kim loại và túi xách cổ điển.',
    appearance:
      'Siêu mẫu vóc dáng cao thanh mảnh, gương mặt sắc sảo xương gò má cao, mắt xanh lục quyến rũ, tóc nâu sẫm buộc gọn hoặc xõa thẳng.',
    personality:
      'Bên ngoài lạnh lùng bí ẩn kiểu sàn diễn nhưng khi mở lòng lại chân thành và sâu sắc; tinh ý quan sát cảm xúc người khác.',
    relationships:
      'Thân với hội siêu mẫu như Kendall và chị gái Gigi, được giới thời trang kính nể vì phong thái chuyên nghiệp.',
    signature:
      'Ánh mắt xanh sắc lạnh hút hồn và gu phối đồ cổ điển hiếm khi đụng hàng.',
  },
  {
    canonicalName: 'Gigi Hadid',
    role: 'Siêu mẫu',
    birthday: '23/04/1995',
    fashionStyle:
      'Thanh lịch hiện đại pha phóng khoáng California: áo len cashmere mềm, sơ mi dáng rộng phối denim chuẩn dáng hoặc đầm dạ hội bay bổng tôn vóc dáng khỏe khoắn.',
    appearance:
      'Siêu mẫu vóc dáng cao ráo khỏe khoắn, mái tóc vàng óng dài gợn sóng, gương mặt rạng rỡ đôi mắt xanh sáng.',
    personality:
      'Ấm áp, cởi mở và chín chắn; giao tiếp tự nhiên, dễ làm người đối diện thoải mái nhưng vẫn giữ sự tinh tế của ngôi sao hàng đầu.',
    relationships:
      'Gắn bó sâu sắc với Bella và hội bạn thời trang, khéo léo dung hòa nhiều nhóm bạn khác nhau.',
    signature:
      'Nụ cười rạng rỡ tự nhiên và phong thái phóng khoáng không chút kênh kiệu.',
  },
  {
    canonicalName: 'Hailey Bieber',
    aliases: ['hailey baldwin'],
    role: 'Người mẫu / Doanh nhân',
    birthday: '22/11/1996',
    fashionStyle:
      'Clean-girl hiện đại pha streetwear thanh lịch: áo khoác da dáng rộng hoặc trench coat, áo tanktop trắng/đầm đen tối giản, kính râm đen mảnh và hoa tai vàng bản tròn.',
    appearance:
      'Người mẫu Mỹ vóc dáng thon gọn, làn da căng bóng đặc trưng, tóc nâu hạt dẻ cắt bob hoặc búi gọn sau gáy.',
    personality:
      'Điềm tĩnh, chỉn chu và có gu thẩm mỹ rõ ràng; nói chuyện chừng mực, kiểm soát biểu cảm tốt trước ánh nhìn soi xét.',
    relationships:
      'Thân thiết với Kendall Jenner và vòng bạn thời trang Los Angeles, luôn giữ vẻ điềm đạm bên cạnh Justin.',
    signature:
      'Phong cách sạch sẽ sang trọng tối giản và ánh mắt quan sát tinh tế.',
  },
  {
    canonicalName: 'Justin Bieber',
    role: 'Ca sĩ',
    birthday: '01/03/1994',
    fashionStyle:
      'Streetwear phóng khoáng bất cần: hoodie hoặc áo khoác da dáng cực rộng, áo tanktop trắng, quần baggy thụng, mũ beanie hoặc mũ lưỡi trai đội ngược và giày sneaker cổ điển.',
    appearance:
      'Nam ca sĩ Canada gương mặt điển trai nhiều hình xăm ở cổ và tay, tóc cắt ngắn hoặc đội mũ beanie.',
    personality:
      'Phóng khoáng, nhạy cảm và chuộng sự thoải mái tự nhiên; dễ gần khi ở cạnh người thân quen nhưng kín đáo trước đám đông ồn ào.',
    relationships:
      'Gắn bó với Hailey và nhóm bạn nghệ sĩ thân thiết tại Los Angeles.',
    signature:
      'Cách ăn mặc bất cần nhưng cuốn hút và thói quen khẽ ngân nga theo nhịp nhạc nền.',
  },
  {
    canonicalName: 'Travis Scott',
    role: 'Rapper / Nhà sản xuất',
    birthday: '30/04/1991',
    fashionStyle:
      'Hip-hop streetwear tông đất / vintage hiếm: áo khoác workwear hoặc bomber cũ bụi, áo thun graphic, quần cargo túi hộp, giày sneaker giới hạn và trang sức kim cương.',
    appearance:
      'Nam rapper Mỹ vóc dáng săn chắc, mái tóc tết box braids đặc trưng, thần thái cool ngầu.',
    personality:
      'Trầm ngâm nhưng bùng nổ sáng tạo; nói ít, chuộng không khí âm nhạc sôi động và giữ phong thái ngầu lạnh.',
    relationships:
      'Có sức ảnh hưởng lớn trong giới hip-hop và thời trang đường phố, quen mặt tại các bữa tiệc nghệ sĩ hạng A.',
    signature:
      'Ánh mắt cúi thấp đầy bí ẩn và phong cách phối đồ streetwear hiếm có.',
  },
  {
    canonicalName: 'A$AP Rocky',
    aliases: ['asap rocky'],
    role: 'Rapper / Biểu tượng thời trang',
    birthday: '03/10/1988',
    fashionStyle:
      'High-fashion streetwear phá cách chuẩn sàn diễn Paris: áo khoác thiết kế độc bản (Bottega/Dior/AWGE), sơ mi hoặc knitwear layer tinh tế, quần ống rộng, khăn lụa/kính râm và nhiều nhẫn ngọc trai-kim cương.',
    appearance:
      'Nam rapper Mỹ gương mặt góc cạnh điển trai, mái tóc tết braids gọn gàng, nụ cười tự tin.',
    personality:
      'Lịch lãm, tự tin và có khiếu hài hước duyên dáng; nói chuyện lôi cuốn với phong thái nghệ sĩ New York phóng khoáng.',
    relationships:
      'Được giới thời trang và hip-hop ngưỡng mộ, giao tiếp cực kỳ mượt mà ở các buổi tiệc xa hoa.',
    signature:
      'Nụ cười sáng bừng đầy tự tin và bộ trang phục luôn như vừa bước xuống từ sàn diễn Paris.',
  },
  {
    canonicalName: 'Rihanna',
    role: 'Ca sĩ / Doanh nhân',
    birthday: '20/02/1988',
    fashionStyle:
      'Táo bạo sang trọng khí chất nữ hoàng: áo khoác lông hoặc áo khoác da oversized phối đầm lụa xẻ cao, layer dây chuyền kim cương nhiều tầng và kính râm thời thượng.',
    appearance:
      'Nữ ca sĩ quyến rũ thần thái nữ hoàng, đôi mắt xanh lục sắc sảo, làn da nâu khỏe khoắn, kiểu tóc thay đổi linh hoạt thời thượng.',
    personality:
      'Quyền lực, phóng khoáng và cực kỳ bản lĩnh; nói chuyện sắc bén pha chút dí dỏm tự nhiên, không bao giờ bị áp đảo bởi bất kỳ ai.',
    relationships:
      'Tâm điểm được cả giới âm nhạc lẫn thời trang nể trọng, tự nhiên dẫn dắt mọi không gian cô xuất hiện.',
    signature:
      'Thần thái ung dung cầm ly rượu vang và ánh nhìn tự tin làm chủ cả căn phòng.',
  },
  {
    canonicalName: 'Drake',
    role: 'Rapper / Ca sĩ',
    birthday: '24/10/1986',
    fashionStyle:
      'Luxury streetwear Bắc Mỹ (NOCTA / Chrome Hearts): áo khoác bomber hoặc jacket hàng hiệu dáng rộng, áo thun/hoodie chất dày, quần suông, đồng hồ xa xỉ và dây chuyền kim cương nổi bật.',
    appearance:
      'Nam rapper Canada vóc dáng vạm vỡ, râu quai nón cắt tỉa sắc nét, tóc ngắn hoặc tết gọn.',
    personality:
      'Hoạt ngôn, khéo léo và giàu cảm xúc; biết cách pha trò lẫn tạo không khí thân mật nhưng vẫn giữ cái tôi lớn của ngôi sao hàng đầu.',
    relationships:
      'Quan hệ rộng khắp giới âm nhạc, thể thao và giải trí Bắc Mỹ.',
    signature:
      'Cách nâng ly chúc mừng đầy hào phóng và những câu thoại nửa đùa nửa thật đầy ẩn ý.',
  },
  {
    canonicalName: 'The Weeknd',
    aliases: ['abel tesfaye'],
    role: 'Ca sĩ',
    birthday: '16/02/1990',
    fashionStyle:
      'Tối màu bí ẩn kiểu điện ảnh đêm khuya: áo khoác da đen hoặc bomber/trench tối màu, áo cổ lọ hoặc thun đen trơn, quần đen gọn, găng tay da hoặc kính râm gọng mảnh.',
    appearance:
      'Nam ca sĩ gốc Ethiopia-Canada, râu quai nón gọn gàng, tóc xoăn ngắn đen, ánh mắt trầm tư.',
    personality:
      'Trầm lắng, bí ẩn và kín tiếng; nói chuyện nhỏ nhẹ điềm đạm, mang sức hút trầm u buồn kiểu điện ảnh đêm khuya.',
    relationships:
      'Giữ vòng bạn bè nghệ sĩ chọn lọc tại Los Angeles và Hollywood.',
    signature:
      'Ánh mắt trầm tư dưới ánh đèn neon và phong thái đứng tách nhẹ khỏi sự ồn ào.',
  },
  {
    canonicalName: 'Playboi Carti',
    aliases: ['carti'],
    role: 'Rapper',
    birthday: '13/09/1995',
    fashionStyle:
      'Avant-garde gothic toàn màu đen (Rick Owens / Balenciaga): áo khoác da hầm hố độn vai, áo tanktop đen hoặc lưới, quần da/cargo đen rộng, bốt đế khủng và phụ kiện bạc sắc cạnh.',
    appearance:
      'Nam rapper Mỹ dáng cao gầy, tóc dreadlocks, thần thái lạnh lùng bí ẩn.',
    personality:
      'Kín tiếng, lập dị có chủ đích và khó nắm bắt; ít nói nhưng luôn gây chú ý mạnh bằng khí chất nổi loạn.',
    relationships:
      'Xuất hiện như bóng ma giữa các bữa tiệc đêm cùng nhóm cộng sự thân cận.',
    signature:
      'Cả cây đồ đen sắc lạnh và kiểu xuất hiện rồi biến mất bất ngờ.',
  },
  {
    canonicalName: 'SZA',
    role: 'Ca sĩ R&B',
    birthday: '08/11/1989',
    fashionStyle:
      'Phóng khoáng gợi cảm pha streetwear Y2K: áo jersey rộng hoặc corset tôn dáng, quần cargo/denim cạp trễ hoặc đầm ôm mềm mại kèm phụ kiện vàng và móng tay dài nghệ thuật.',
    appearance:
      'Nữ ca sĩ R&B vóc dáng quyến rũ, mái tóc xoăn dày bồng bềnh đặc trưng, gương mặt sắc nét đầy cảm xúc.',
    personality:
      'Nhạy cảm, chân thành và giàu chiều sâu cảm xúc; trò chuyện cởi mở pha chút hài hước tự trào dễ mến.',
    relationships:
      'Được nhiều nghệ sĩ yêu quý vì sự thật thà và năng lượng ấm áp.',
    signature:
      'Ánh mắt giàu biểu cảm và mái tóc xoăn bồng bềnh nổi bật giữa đám đông.',
  },
  {
    canonicalName: 'Bad Bunny',
    aliases: ['benito'],
    role: 'Ca sĩ / Rapper',
    birthday: '10/03/1994',
    fashionStyle:
      'Streetwear sáng tạo rực rỡ pha high-fashion: áo sơ mi họa tiết phóng khoáng hoặc áo khoác da nổi bật, quần ống rộng, mũ độc lạ, kính râm thiết kế cá tính và nhiều vòng cổ.',
    appearance:
      'Nam nghệ sĩ Puerto Rico cao ráo, râu ria gọn gàng, hay đeo kính râm kiểu lạ.',
    personality:
      'Phóng khoáng, tự tin và cuốn hút theo kiểu điềm nhiên; nói chuyện thoải mái, không bị ràng buộc bởi khuôn mẫu.',
    relationships:
      'Gần gũi với cộng đồng nghệ sĩ Latin và giới thời trang, giải trí Hollywood.',
    signature:
      'Kính râm thiết kế độc lạ và phong thái ung dung cực kỳ tự nhiên.',
  },
  {
    canonicalName: 'Timothée Chalamet',
    aliases: ['timothee chalamet', 'timothee', 'timmy', 'lil timmy', 'chalamet'],
    role: 'Diễn viên',
    birthday: '27/12/1995',
    fashionStyle:
      'Nghệ sĩ trẻ phóng khoáng pha thiết kế phá cách (Haider Ackermann / Chrome Hearts): áo sơ mi lụa mở cổ, áo khoác bomber hoặc jacket da dáng gọn, quần ống đứng, bốt Chelsea và dây chuyền mảnh.',
    appearance:
      'Nam diễn viên trẻ dáng cao gầy thư sinh, mái tóc nâu xoăn bồng bềnh đặc trưng, đường nét gương mặt góc cạnh lãng tử.',
    personality:
      'Lanh lợi, hóm hỉnh và mang nét nghệ sĩ lãng tử; nói chuyện nhanh nhẹn, lịch thiệp và dễ tạo không khí thân thiện.',
    relationships:
      'Hòa nhập tự nhiên giữa giới điện ảnh lẫn thời trang cao cấp.',
    signature:
      'Thói quen vuốt ngược mái tóc xoăn rối nhẹ cùng nụ cười nghiêng đầy duyên.',
  },
  {
    canonicalName: 'Zendaya',
    role: 'Diễn viên / Ca sĩ',
    birthday: '01/09/1996',
    fashionStyle:
      'Thời trang cao cấp sắc sảo đầy biến hóa: đầm cut-out cấu trúc tinh xảo hoặc set đồ lụa/linen tối giản hiện đại tôn vóc dáng cao thanh thoát, trang sức Bvlgari nổi bật.',
    appearance:
      'Nữ diễn viên vóc dáng cao thanh mảnh, làn da nâu mật ong, tóc nâu uốn sóng hoặc búi sang trọng, thần thái sắc sảo cuốn hút.',
    personality:
      'Thông minh, chín chắn và tinh tế; giữ phong thái điềm đạm, ăn nói khéo léo đầy duyên dáng trong mọi tình huống.',
    relationships:
      'Được cả giới điện ảnh và thời trang quý mến, giữ đời tư kín đáo nhưng luôn thân thiện đúng mực.',
    signature:
      'Dáng vẻ thanh thoát đầy khí chất và ánh nhìn điềm tĩnh sắc sảo.',
  },
  {
    canonicalName: 'Dua Lipa',
    role: 'Ca sĩ',
    birthday: '22/08/1995',
    fashionStyle:
      'Tiệc tùng gợi cảm hiện đại pha disco sang trọng (Versace / YSL): đầm lụa hoặc đầm lưới ánh kim tôn dáng, áo khoác da dáng dài, bốt cao gót và trang sức bản to.',
    appearance:
      'Nữ ca sĩ Anh cao ráo quyến rũ, tóc dài đen mượt hoặc ánh đỏ trầm, hàng lông mày đậm sắc nét.',
    personality:
      'Tự tin, sắc sảo và tràn đầy sức sống; ăn nói trôi chảy, giọng Anh trầm quyến rũ, luôn thoải mái làm chủ bầu không khí.',
    relationships:
      'Thân thiện và rộng rãi quan hệ trong giới âm nhạc lẫn thời trang châu Âu và Mỹ.',
    signature:
      'Ánh mắt sâu quyến rũ và thần thái sang chảnh đầy nhịp điệu.',
  },
  {
    canonicalName: 'Sabrina Carpenter',
    role: 'Ca sĩ',
    birthday: '11/05/1999',
    fashionStyle:
      'Nữ tính cổ điển pha quyến rũ tinh nghịch: đầm babydoll hoặc corset ngắn tông pastel/đen, tất lưới hoặc giày cao gót đế độn và trang sức nhỏ lấp lánh.',
    appearance:
      'Nữ ca sĩ vóc dáng nhỏ nhắn ngọt ngào, mái tóc vàng óng uốn lọn bồng bềnh có mái bay đặc trưng, má hồng nổi bật.',
    personality:
      'Lanh lợi, sắc sảo và cực kỳ có duyên pha trò; vẻ ngoài ngọt ngào nhưng câu thoại luôn sắc bén, tinh nghịch.',
    relationships:
      'Dễ bắt nhịp với giới nghệ sĩ trẻ Hollywood bằng sự duyên dáng và tự tin.',
    signature:
      'Cái nháy mắt tinh nghịch và những câu đối đáp ngắn gọn đầy hài hước.',
  },
  {
    canonicalName: 'Sydney Sweeney',
    role: 'Diễn viên',
    birthday: '12/09/1997',
    fashionStyle:
      'Hollywood gợi cảm hiện đại (Miu Miu): đầm lụa ôm sát hoặc đầm cổ khoét thanh lịch, set áo khoác ngắn phối chân váy tôn vóc dáng và trang sức sáng nhẹ.',
    appearance:
      'Nữ diễn viên Mỹ tóc vàng dài bồng bềnh, đôi mắt xanh to cuốn hút, vóc dáng gợi cảm.',
    personality:
      'Thẳng thắn, chăm chỉ và điềm tĩnh hơn vẻ ngoài ngọt ngào; biết cách giữ bình tĩnh và kiểm soát cuộc trò chuyện.',
    relationships:
      'Thân thiện với đồng nghiệp Hollywood, khéo léo giữ cân bằng giữa công việc và tiệc tùng.',
    signature:
      'Ánh mắt mơ màng cổ điển ẩn sau sự sắc sảo thực tế.',
  },
  {
    canonicalName: 'Lana Del Rey',
    role: 'Ca sĩ',
    birthday: '21/06/1985',
    fashionStyle:
      'Vintage Mỹ thập niên 60 lãng mạn: đầm lụa hoặc ren dáng dài hoài cổ, áo khoác da lộn tua rua hoặc cardigan nhẹ phối dây chuyền mảnh và nơ cài tóc cổ điển.',
    appearance:
      'Nữ ca sĩ Mỹ nét đẹp hoài cổ thập niên 60, mái tóc nâu dài uốn lọn cổ điển, kẻ mắt sắc nét và thần thái mơ màng.',
    personality:
      'Trầm lắng, lãng mạn và đầy chất thơ; nói chuyện chậm rãi dịu dàng, toát lên khí chất hoài cổ khó lẫn.',
    relationships:
      'Được nhiều nghệ sĩ trẻ ngưỡng mộ, thích những cuộc trò chuyện sâu sắc yên tĩnh hơn tiệc ồn ào.',
    signature:
      'Giọng nói mơ màng êm ái và ánh nhìn như bước ra từ phim nhựa Hollywood xưa.',
  },
  {
    canonicalName: 'Taylor Swift',
    role: 'Ca sĩ / Nhạc sĩ',
    birthday: '13/12/1989',
    fashionStyle:
      'Thanh lịch hiện đại pha hơi hướng cổ điển New York: áo khoác dáng dài hoặc đầm ôm tối giản sang trọng, áo len cổ lọ phối chân váy ngắn, bốt da cao và trang sức vàng thanh nhã.',
    appearance:
      'Nữ ca sĩ Mỹ vóc dáng cao ráo, mái tóc vàng dài kèm mái bằng đặc trưng, mắt kẻ cánh sắc nét và son môi đỏ cổ điển.',
    personality:
      'Sắc sảo, ấm áp và cực kỳ tinh tế trong giao tiếp; luôn chú ý đến từng chi tiết nhỏ và phản ứng nhanh nhạy.',
    relationships:
      'Quan hệ rộng khắp làng âm nhạc, luôn thể hiện sự hào phóng và tinh thần đồng đội với bạn bè thân.',
    signature:
      'Bờ môi đỏ cổ điển và ánh mắt quan sát nhanh như đang ghi nhớ từng câu chuyện để viết nhạc.',
  },
  {
    canonicalName: 'Ariana Grande',
    role: 'Ca sĩ / Diễn viên',
    birthday: '26/06/1993',
    fashionStyle:
      'Nữ tính tinh tế pha cổ điển ngọt ngào: đầm chữ A hoặc đầm lụa tông trung tính-pastel, áo cardigan ngắn phối chân váy gọn gàng và trang sức ngọc trai-kim cương mảnh.',
    appearance:
      'Nữ ca sĩ vóc dáng nhỏ nhắn thanh mảnh, mái tóc dài buộc cao đặc trưng, trang điểm mắt mèo sắc sảo ngọt ngào.',
    personality:
      'Dịu dàng, tinh tế nhưng rất kiên định về nghệ thuật; ăn nói nhẹ nhàng pha nét hóm hỉnh.',
    relationships:
      'Thân thiết với nhóm cộng sự lâu năm và các nghệ sĩ cùng gu âm nhạc.',
    signature:
      'Giọng nói ngọt nhẹ và biểu cảm mềm mại thanh lịch.',
  },
  {
    canonicalName: 'Selena Gomez',
    role: 'Ca sĩ / Diễn viên',
    birthday: '22/07/1992',
    fashionStyle:
      'Thanh lịch quyến rũ kiểu Hollywood hiện đại: đầm đen cổ điển tôn dáng, áo khoác dạ mềm phối quần âu cạp cao và hoa tai tròn ánh vàng tinh tế.',
    appearance:
      'Nữ nghệ sĩ Mỹ gương mặt bầu bĩnh duyên dáng, đôi mắt nâu ấm áp, tóc nâu đen dài uốn nhẹ.',
    personality:
      'Chân thành, điềm đạm và ấm áp; ăn nói thẳng thắn nhẹ nhàng, biết cách lắng nghe người đối diện.',
    relationships:
      'Trân trọng những mối quan hệ bền lâu và không khí gần gũi chân thật.',
    signature:
      'Nụ cười ấm áp dễ tạo thiện cảm và giọng nói trầm nhẹ đặc trưng.',
  },
  {
    canonicalName: 'G-Dragon',
    aliases: ['kwon jiyong', 'gd'],
    role: 'Ca sĩ / Biểu tượng thời trang',
    birthday: '18/08/1988',
    fashionStyle:
      'Avant-garde phi giới tính phá cách (Chanel / PEACEMINUSONE): áo khoác tweed hoặc cardigan cài ghim hoa cúc, khăn choàng lụa, quần ống rộng, mũ nồi/beanie và nhiều lớp nhẫn vòng nghệ thuật.',
    appearance:
      'Nam nghệ sĩ Hàn Quốc dáng thanh mảnh, thần thái nghệ sĩ nổi loạn, kiểu tóc thời thượng.',
    personality:
      'Ngẫu hứng, sắc sảo và mang khí chất nghệ sĩ khó trộn lẫn; khiêm tốn lịch thiệp khi trò chuyện nhưng toát ra sức hút áp đảo không cần cố gắng.',
    relationships:
      'Biểu tượng được giới thời trang và nghệ sĩ toàn cầu nể trọng.',
    signature:
      'Cử chỉ ngẫu hứng đầy nghệ sĩ và gu phối phụ kiện độc nhất vô nhị.',
  },
  {
    canonicalName: 'Kanye West',
    aliases: ['ye'],
    role: 'Rapper / Nhà thiết kế',
    birthday: '08/06/1977',
    fashionStyle:
      'Tối giản oversized tông màu trầm / đơn sắc (Yeezy): áo hoodie phom hộp cực rộng, áo khoác kỹ thuật tối màu, quần thụng và bốt hầm hố không họa tiết.',
    appearance:
      'Nam nghệ sĩ Mỹ vóc dáng chắc khỏe, đầu cạo gọn, râu quai nón ngắn, thần thái nghiêm nghị.',
    personality:
      'Cực đoan theo chủ nghĩa hoàn hảo, bộc trực và đầy tự tin; nói thẳng những ý tưởng táo bạo không theo lối mòn.',
    relationships:
      'Gây ảnh hưởng mạnh mẽ nhưng cũng nhiều tranh cãi trong giới âm nhạc và thời trang.',
    signature:
      'Ánh nhìn nghiêm nghị không cười và những tuyên ngôn bất ngờ.',
  },
  {
    canonicalName: 'Troye Sivan',
    role: 'Ca sĩ / Diễn viên',
    birthday: '05/06/1995',
    fashionStyle:
      'Tối giản hiện đại giàu chất nghệ sĩ (Prada / Miu Miu): áo tanktop hoặc sơ mi dáng rộng hờ hững, áo khoác da dáng ngắn, quần ống đứng và phụ kiện bạc mảnh.',
    appearance:
      'Nam ca sĩ dáng mảnh thư sinh, tóc nâu xoăn nhẹ tự nhiên, gương mặt thanh tú đôi mắt xanh sáng.',
    personality:
      'Duyên dáng, tinh tế và phóng khoáng; trò chuyện tự nhiên đầy hóm hỉnh, dễ hòa nhịp với giới sáng tạo trẻ.',
    relationships:
      'Thân thiết với nhóm nghệ sĩ pop/club như Charli XCX và giới thời trang quốc tế.',
    signature:
      'Nụ cười thư sinh tinh nghịch và phong thái nhẹ nhàng đầy chất nghệ.',
  },
  {
    canonicalName: 'Jang Wonyoung',
    aliases: ['wonyoung'],
    role: 'Ca sĩ / Người mẫu Hàn Quốc',
    birthday: '31/08/2004',
    fashionStyle:
      'Tiểu thư thanh lịch hiện đại kiểu Miu Miu: đầm chữ A ngắn, cardigan mỏng phối chân váy xếp ly, băng đô hoặc nơ tóc tinh tế và túi xách mini nữ tính.',
    appearance:
      'Nữ ca sĩ Hàn Quốc vóc dáng cao mảnh mai nổi bật, mái tóc đen dài uốn sóng nhẹ bồng bềnh, đường nét gương mặt búp bê thanh tú, đôi mắt to long lanh và nụ cười rạng rỡ.',
    personality:
      'Tự tin, chuyên nghiệp và giữ hình ảnh chỉn chu trước đám đông; ăn nói nhẹ nhàng khéo léo pha nét tươi sáng tự nhiên.',
    relationships:
      'Gương mặt trẻ nổi bật của giới idol và thời trang cao cấp Hàn Quốc.',
    signature:
      'Thần thái công chúa hiện đại, biểu cảm ánh mắt cuốn hút và phong thái tự tin chuẩn sân khấu.',
  },
  {
    canonicalName: 'Karina',
    aliases: ['yu jimin'],
    role: 'Ca sĩ Hàn Quốc',
    birthday: '11/04/2000',
    fashionStyle:
      'High-fashion sắc lạnh pha streetwear hiện đại (Prada): áo khoác da dáng gọn, đầm đen tối giản ôm dáng hoặc áo croptop phối quần ống rộng và phụ kiện bạc thanh mảnh.',
    appearance:
      'Nữ ca sĩ Hàn Quốc vóc dáng cao mảnh cân đối, tóc đen dài thẳng mượt (hoặc gợn sóng nhẹ), gương mặt nhỏ thanh tú tỷ lệ sắc nét như đồ họa, đôi mắt sắc lạnh và thần thái sang trọng.',
    personality:
      'Bên ngoài có khí chất lạnh lùng sắc sảo nhưng thực tế gần gũi, tinh tế và chu đáo với người xung quanh.',
    relationships:
      'Thân thiện với đồng nghiệp cùng ngành và được giới thời trang cao cấp chú ý.',
    signature:
      'Ánh mắt sắc nét cuốn hút và khí chất sang lạnh nổi bật ngay cả khi ăn mặc tối giản.',
  },
  {
    canonicalName: 'IU',
    aliases: ['lee jieun', 'lee ji-eun'],
    role: 'Ca sĩ / Diễn viên Hàn Quốc',
    birthday: '16/05/1993',
    fashionStyle:
      'Thanh lịch dịu dàng cổ điển pha hiện đại (Gucci): đầm midi mềm mại, áo sơ mi lụa hoặc cardigan dáng gọn, trang sức tinh tế tối giản.',
    appearance:
      'Nữ ca sĩ kiêm diễn viên Hàn Quốc vóc dáng nhỏ nhắn thanh thoát, làn da trắng sáng, tóc đen hoặc nâu trầm dài dịu dàng, đôi mắt to trong trẻo và nụ cười hiền ấm áp.',
    personality:
      'Điềm đạm, chân thành và giàu chiều sâu nghệ sĩ; nói chuyện nhẹ nhàng, tinh tế và luôn biết cách khiến người đối diện thấy dễ chịu.',
    relationships:
      'Được đông đảo nghệ sĩ lẫn khán giả Hàn Quốc kính trọng nhờ tài năng và nhân cách ấm áp.',
    signature:
      'Ánh mắt trong trẻo ấm áp và giọng nói nhỏ nhẹ đầy cảm xúc.',
  },
  {
    canonicalName: 'Jungkook',
    aliases: ['jeon jungkook'],
    role: 'Ca sĩ Hàn Quốc',
    birthday: '01/09/1997',
    fashionStyle:
      'Streetwear tối màu phóng khoáng (Calvin Klein / Balenciaga): áo khoác bomber hoặc denim oversized, áo thun trơn, quần ống rộng, bốt đế dày và khuyên tai bạc cá tính.',
    appearance:
      'Nam ca sĩ Hàn Quốc vóc dáng săn chắc cân đối, tóc đen cắt layer rủ nhẹ tự nhiên, đôi mắt tròn sáng sắc nét, gương mặt điển trai trẻ trung cùng hình xăm nghệ thuật dọc cánh tay phải.',
    personality:
      'Chân thành, năng động và cầu toàn trong âm nhạc; nói chuyện tự nhiên, lịch sự nhưng có nét hài hước gần gũi.',
    relationships:
      'Gần gũi với bạn bè đồng nghiệp trong giới âm nhạc Hàn Quốc và quốc tế.',
    signature:
      'Ánh mắt sáng chân thành, phong cách all-black phóng khoáng và khí chất ngôi sao sân khấu.',
  },
  {
    canonicalName: 'Kim Taehyung',
    aliases: ['taehyung'],
    role: 'Ca sĩ / Nghệ sĩ Hàn Quốc',
    birthday: '30/12/1995',
    fashionStyle:
      'Cổ điển lãng tử pha high-fashion Paris (Celine): áo khoác dạ hoặc blazer dáng rộng, sơ mi lụa mở cổ, quần âu ống suông, khăn choàng mảnh và trang sức vàng cổ điển.',
    appearance:
      'Nam ca sĩ Hàn Quốc gương mặt điển trai góc cạnh sắc nét, sống mũi cao, đôi mắt sâu trầm lãng tử, mái tóc đen hoặc nâu trầm uốn sóng nhẹ bồng bềnh.',
    personality:
      'Trầm ấm, nghệ sĩ và có nét duyên dáng khó đoán; giọng nói trầm đặc trưng, cư xử lịch lãm nhưng tự nhiên.',
    relationships:
      'Có mối quan hệ rộng với giới nghệ sĩ, diễn viên và thời trang cao cấp quốc tế.',
    signature:
      'Ánh mắt sâu trầm đầy chất điện ảnh và phong thái lãng tử cổ điển.',
  },
  {
    canonicalName: 'Jacob Elordi',
    aliases: ['elordi'],
    role: 'Diễn viên',
    birthday: '26/06/1997',
    fashionStyle:
      'Retro Hollywood pha casual tối giản kiểu Úc: áo khoác da cổ điển hoặc blazer dáng rộng, áo thun trắng/sơ mi mở cổ, quần jeans ống đứng, kính râm cổ điển và túi Bottega Veneta.',
    appearance:
      'Nam diễn viên Úc cực kỳ cao ráo, vóc dáng vạm vỡ thanh thoát, mái tóc nâu sẫm hơi rối tự nhiên, đường nét gương mặt góc cạnh điển trai kiểu điện ảnh cổ điển.',
    personality:
      'Điềm đạm, hơi trầm và mang nét lãng tử pha chút lạnh lùng điện ảnh; nói chuyện giọng Úc trầm ấm, tự nhiên không màu mè.',
    relationships:
      'Quen biết rộng trong giới điện ảnh Hollywood và giới thời trang cao cấp, giữ thái độ lịch thiệp nhưng kín đáo.',
    signature:
      'Chiều cao nổi bật giữa đám đông cùng ánh nhìn trầm tĩnh hơi nghiêng đầu đầy chất điện ảnh.',
  },
];

const CELEBRITY_LOOKUP_MAP = new Map<string, KnownCelebrityProfile>();
for (const celeb of KNOWN_CELEBRITY_LIST) {
  CELEBRITY_LOOKUP_MAP.set(normalizeCharacterKey(celeb.canonicalName), celeb);
  for (const alias of celeb.aliases || []) {
    CELEBRITY_LOOKUP_MAP.set(normalizeCharacterKey(alias), celeb);
  }
}

export function lookupKnownCelebrityProfile(
  name: string,
): KnownCelebrityProfile | null {
  const key = normalizeCharacterKey(name);
  if (!key) return null;
  return CELEBRITY_LOOKUP_MAP.get(key) || null;
}

function escapeRegExpChars(s?: string | null): string {
  return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findKnownCelebritiesInText(
  text: string,
): Array<{
  displayName: string;
  canonicalName: string;
  lastIndex: number;
  count: number;
}> {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  const hits: Array<{
    displayName: string;
    canonicalName: string;
    lastIndex: number;
    count: number;
  }> = [];

  for (const celeb of KNOWN_CELEBRITY_LIST) {
    const terms = [celeb.canonicalName, ...(celeb.aliases || [])]
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    let bestLast = -1;
    let totalCount = 0;
    let preferredDisplay = celeb.canonicalName;
    let preferredCount = 0;

    for (const term of terms) {
      const isSingleWord = !/\s/.test(term);
      const escaped = escapeRegExpChars(term);
      const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
      let m: RegExpExecArray | null;
      let termCount = 0;
      let lastMatchedText = '';
      while ((m = re.exec(raw)) !== null) {
        if (isSingleWord && !/^[\p{Lu}]/u.test(m[0])) continue;
        termCount += 1;
        totalCount += 1;
        if (m.index > bestLast) {
          bestLast = m.index;
          lastMatchedText = m[0];
        }
      }
      if (termCount > preferredCount && lastMatchedText) {
        preferredCount = termCount;
        preferredDisplay = lastMatchedText.trim();
      }
    }

    if (totalCount > 0 && bestLast >= 0) {
      hits.push({
        displayName: preferredDisplay,
        canonicalName: celeb.canonicalName,
        lastIndex: bestLast,
        count: totalCount,
      });
    }
  }

  hits.sort((a, b) => b.lastIndex - a.lastIndex || b.count - a.count);
  return hits;
}

const CONTRACTION_RE =
  /\b(?:i'm|i've|i'll|i'd|it's|he's|she's|they're|they've|they'll|they'd|we're|we've|we'll|we'd|you're|you've|you'll|you'd|that's|there's|here's|what's|who's|where's|when's|why's|how's|let's|don't|doesn't|didn't|can't|won't|wouldn't|couldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|ain't|mustn't)\b/i;

const JUNK_EXACT_PHRASES = new Set([
  'setting',
  'the setting',
  'defining the setting',
  'guest list',
  'the guest list',
  'expanding the guest list',
  'narrative flow',
  'the narrative flow',
  'crafting the narrative flow',
  'analyzing the aftermath',
  'analysing the aftermath',
  'aftermath',
  'the aftermath',
  'scene',
  'the scene',
  'stage',
  'plan',
  'the plan',
  'plan for',
  'plan for stage',
  'goal',
  'goals',
  'the goal',
  'word count',
  'words per paragraph',
  'the room',
  'room',
  'party',
  'the party',
  'after party',
  'after-party',
  'vip',
  'vip room',
  'vip lounge',
  'vip area',
  'vip section',
  'club',
  'the club',
  'nightclub',
  'rooftop bar',
  'system boot',
  'resource loading',
  'dialogue',
  'narration',
  'narrator',
  'pacing',
  'tone',
  'atmosphere',
  'transition',
  'character',
  'characters',
  'character check',
  'character voice',
  'self check',
  'continuity check',
  'thought process',
  'thinking',
  'thought',
  'reasoning',
  'analysis',
  'outline',
  'draft',
  'drafting',
  'summary',
  'status',
  'checklist',
  'constraints',
  'instructions',
  'execution',
  'review',
  'verification',
  'ooc',
  'pov',
  'npc',
  'mc',
  'protagonist',
  'los angeles',
  'new york',
  'new york city',
  'beverly hills',
  'hollywood hills',
  'hollywood',
  'west hollywood',
  'las vegas',
  'san francisco',
  'miami',
  'london',
  'paris',
  'seoul',
  'tokyo',
  'hong kong',
  'south korea',
  'united states',
  'united kingdom',
  'viet nam',
  'sai gon',
  'ha noi',
  'da nang',
  'thuong hai',
  'bac kinh',
  'rolls royce',
  'louis vuitton',
  'chrome hearts',
  'saint laurent',
  'bottega veneta',
  'ralph lauren',
  'dom perignon',
  'audemars piguet',
  'patek philippe',
  'richard mille',
  'mercedes benz',
  'aston martin',
  'range rover',
  'balenciaga',
  'chanel',
  'dior',
  'gucci',
  'prada',
  'hermes',
  'versace',
  'cartier',
  'rolex',
  'met gala',
  'fashion week',
  'grammy',
  'grammys',
  'coachella',
  'cannes',
  'sunset boulevard',
  'rodeo drive',
  'mulholland drive',
  'chateau marmont',
  'delilah',
  'nobu',
  'catch',
  'penthouse',
  'mansion',
  'villa',
  'living room',
  'dance floor',
  'bar counter',
  'main hall',
  'private suite',
  'private room',
  'main stage',
  'backstage',
  'red carpet',
  'press conference',
  'social media',
  'instagram',
  'tiktok',
  'twitter',
  'youtube',
  'spotify',
  'paparazzi',
  'security',
  'bodyguard',
  'bartender',
  'waiter',
  'manager',
  'assistant',
  'producer',
  'director',
  // Entertainment labels, companies, agencies, media, music groups
  'sm',
  'sm entertainment',
  'sm town',
  'smtown',
  'yg',
  'yg entertainment',
  'jyp',
  'jyp entertainment',
  'hybe',
  'hybe labels',
  'ador',
  'bighit',
  'big hit',
  'big hit music',
  'starship',
  'starship entertainment',
  'cube',
  'cube entertainment',
  'pledis',
  'pledis entertainment',
  'source music',
  'belift',
  'belift lab',
  'wakeone',
  'fnc',
  'fnc entertainment',
  'kq',
  'kq entertainment',
  'rbw',
  'wm entertainment',
  'ist entertainment',
  'kakao',
  'kakao entertainment',
  'kakaotalk',
  'kakao talk',
  'naver',
  'cj enm',
  'mnet',
  'dispatch',
  'billboard',
  'universal music',
  'sony music',
  'warner music',
  'interscope',
  'republic records',
  'atlantic records',
  'def jam',
  'roc nation',
  'columbia records',
  'space speakers',
  'spacespeakers',
  'rap nha lam',
  'g family',
  'blackpink',
  'black pink',
  'newjeans',
  'new jeans',
  'aespa',
  'ive',
  'le sserafim',
  'lesserafim',
  'twice',
  'red velvet',
  'stray kids',
  'seventeen',
  'enhypen',
  'itzy',
  'nmixx',
  'babymonster',
  'baby monster',
  'illit',
  'riize',
  'zerobaseone',
  'bts',
  'exo',
  'nct',
  'nct 127',
  'nct dream',
  'wayv',
  'got7',
  'monsta x',
  'ateez',
  'txt',
  'bigbang',
  'big bang',
  '2ne1',
  'girls generation',
  'snsd',
  'shinee',
  'super junior',
  'boynextdoor',
  'kiss of life',
  'katseye',
  'apple',
  'apple music',
  'google',
  'meta',
  'netflix',
  'disney',
  'soundcloud',
  'melon',
  'vogue',
  'elle',
  'forbes',
  // Communication channels, chat groups, apps, tools, concepts
  'nhom chat',
  'group chat',
  'khung chat',
  'phong chat',
  'doan chat',
  'kenh chat',
  'nhom nhan tin',
  'nhom tin nhan',
  'cuoc tro chuyen',
  'hoi thoai',
  'tin nhan',
  'tin nhan nhom',
  'hop thu',
  'thong bao',
  'dien thoai',
  'man hinh',
  'man hinh dien thoai',
  'ung dung',
  'mang xa hoi',
  'dien dan',
  'binh luan',
  'bai dang',
  'bai viet',
  'livestream',
  'video call',
  'voice call',
  'cuoc goi',
  'zalo',
  'messenger',
  'facebook',
  'wechat',
  'whatsapp',
  'telegram',
  'discord',
  'threads',
  'viber',
  'imessage',
  'facetime',
  'gmail',
  'email',
  'weverse',
  'bubble',
  'lysn',
  'fromm',
  'vlive',
  'v live',
  'weibo',
  'douyin',
  'xiaohongshu',
  'bilibili',
  'reddit',
  'theqoo',
  'pann',
  'instiz',
  'netizen',
  'cu dan mang',
  'cong dong mang',
  'he thong',
  'nhiem vu',
  'ban tin',
  'tin tuc',
  'bao chi',
  'truyen thong',
  'tin don',
  'scandal',
  'drama',
  'khan gia',
  'nguoi ham mo',
  'fandom',
  'antifan',
  'dam dong',
  'quan chung',
  // Vietnamese & international locations / venues
  'quan ca phe',
  'quan cafe',
  'quan coffee',
  'ca phe',
  'cafe',
  'coffee',
  'coffee shop',
  'tiem ca phe',
  'tiem banh',
  'tiem tra',
  'tiem tra sua',
  'tiem sach',
  'tiem hoa',
  'tiem toc',
  'quan an',
  'quan bar',
  'quan pub',
  'quan nuoc',
  'quan ruou',
  'nha hang',
  'khach san',
  'nha nghi',
  'khu nghi duong',
  'phong khach',
  'phong ngu',
  'phong tam',
  'phong bep',
  'phong thu',
  'phong thu am',
  'phong tap',
  'phong hop',
  'phong cho',
  'phong trang diem',
  'hau truong',
  'san khau',
  'khan dai',
  'hoi truong',
  'van phong',
  'can ho',
  'chung cu',
  'biet thu',
  'toa nha',
  'cao oc',
  'cong vien',
  'quang truong',
  'benh vien',
  'phong kham',
  'truong hoc',
  'dai hoc',
  'hoc vien',
  'ky tuc xa',
  'san bay',
  'nha ga',
  'ben xe',
  'tram xe',
  'ga tau',
  'bai bien',
  'bo bien',
  'hon dao',
  'khu pho',
  'khu do thi',
  'trung tam',
  'trung tam thuong mai',
  'sieu thi',
  'cua hang',
  'thu vien',
  'bao tang',
  'rap phim',
  'rap chieu phim',
  'san van dong',
  'nha thi dau',
  'nha hat',
  'nha tho',
  'san thuong',
  'ban cong',
  'hanh lang',
  'bai do xe',
  'gangnam',
  'hongdae',
  'itaewon',
  'myeongdong',
  'apgujeong',
  'cheongdam',
  'hannam',
  'seongsu',
  'busan',
  'jeju',
  'incheon',
  'han quoc',
  'nhat ban',
  'trung quoc',
  'tp hcm',
  'tphcm',
  'ho chi minh',
  'saigon',
  'hanoi',
  'nha trang',
  'da lat',
  'can tho',
  'hai phong',
  'vung tau',
  'phu quoc',
  // Colors (Vietnamese & English)
  'mau do',
  'mau xanh',
  'mau vang',
  'mau den',
  'mau trang',
  'mau hong',
  'mau tim',
  'mau xam',
  'mau nau',
  'mau cam',
  'mau bac',
  'mau be',
  'mau kem',
  'do tuoi',
  'do tham',
  'do do',
  'do ruou',
  'do gach',
  'do cam',
  'xanh lam',
  'xanh duong',
  'xanh luc',
  'xanh la',
  'xanh la cay',
  'xanh ngoc',
  'xanh reu',
  'xanh den',
  'xanh bien',
  'xanh da troi',
  'xanh mint',
  'xanh pastel',
  'vang kim',
  'vang chanh',
  'vang nhat',
  'vang dam',
  'vang dong',
  'vang nghe',
  'den tuyen',
  'den nham',
  'den bong',
  'trang tinh',
  'trang nga',
  'trang sua',
  'trang muot',
  'hong phan',
  'hong nhat',
  'hong dam',
  'hong dao',
  'hong canh sen',
  'tim than',
  'tim nhat',
  'tim pastel',
  'xam khoi',
  'xam tro',
  'xam bac',
  'xam xanh',
  'nau tram',
  'nau dat',
  'nau hat de',
  'nau tay',
  'cam dat',
  'cam chay',
  'bach kim',
  'dark blue',
  'light blue',
  'navy blue',
  'sky blue',
  'baby blue',
  'hot pink',
  'baby pink',
  'pastel pink',
  'off white',
  'pearl white',
  'jet black',
  'matte black',
  'rose gold',
  'blood red',
  'crimson red',
  'forest green',
  'olive green',
  'mint green',
  // Songs, albums, creative works
  'bai hat',
  'ca khuc',
  'ban nhac',
  'dia don',
  'mini album',
  'full album',
  'music video',
  'playlist',
  'bo phim',
  'tac pham',
  'cuon sach',
  'tieu thuyet',
  'chuong trinh',
  'world tour',
  'fan meeting',
  'fanmeeting',
  'tracklist',
  'mixtape',
  'freestyle',
]);

const JUNK_SINGLE_WORDS = new Set([
  'setting',
  'guest',
  'guests',
  'list',
  'scene',
  'stage',
  'plan',
  'planning',
  'goal',
  'goals',
  'word',
  'words',
  'count',
  'paragraph',
  'paragraphs',
  'room',
  'party',
  'vip',
  'club',
  'bar',
  'lounge',
  'penthouse',
  'mansion',
  'villa',
  'hotel',
  'suite',
  'balcony',
  'terrace',
  'hallway',
  'kitchen',
  'bedroom',
  'bathroom',
  'floor',
  'table',
  'sofa',
  'couch',
  'door',
  'window',
  'night',
  'evening',
  'morning',
  'midnight',
  'moment',
  'silence',
  'music',
  'drink',
  'drinks',
  'wine',
  'champagne',
  'cocktail',
  'vape',
  'smoke',
  'narrative',
  'flow',
  'aftermath',
  'dialogue',
  'narration',
  'pacing',
  'tone',
  'atmosphere',
  'transition',
  'outline',
  'draft',
  'thinking',
  'thought',
  'reasoning',
  'analysis',
  'summary',
  'status',
  'system',
  'boot',
  'resource',
  'loading',
  'section',
  'chapter',
  'page',
  'turn',
  'beat',
  'beats',
  'step',
  'phase',
  'part',
  'note',
  'notes',
  'rule',
  'rules',
  'check',
  'checklist',
  'constraint',
  'constraints',
  'defining',
  'expanding',
  'crafting',
  'analyzing',
  'analysing',
  'establishing',
  'developing',
  'building',
  'checking',
  'reviewing',
  'introducing',
  'focusing',
  'maintaining',
  'ensuring',
  'highlighting',
  'exploring',
  'managing',
  'considering',
  'evaluating',
  'determining',
  'the',
  'and',
  'but',
  'for',
  'with',
  'from',
  'into',
  'onto',
  'over',
  'under',
  'about',
  'this',
  'that',
  'these',
  'those',
  'here',
  'there',
  'where',
  'when',
  'while',
  'then',
  'now',
  'just',
  'only',
  'even',
  'still',
  'also',
  'very',
  'more',
  'most',
  'some',
  'many',
  'much',
  'each',
  'every',
  'both',
  'all',
  'any',
  'none',
  'one',
  'two',
  'three',
  'first',
  'second',
  'third',
  'next',
  'last',
  'final',
  'finally',
  'after',
  'before',
  'during',
  'however',
  'although',
  'because',
  'since',
  'until',
  'unless',
  'maybe',
  'perhaps',
  'suddenly',
  'slowly',
  'quickly',
  'quietly',
  'softly',
  'gently',
  'clearly',
  'actually',
  'really',
  'simply',
  'meanwhile',
  'instead',
  'he',
  'she',
  'it',
  'we',
  'they',
  'you',
  'him',
  'her',
  'them',
  'his',
  'our',
  'their',
  'your',
  'my',
  'me',
  'us',
  'who',
  'whom',
  'whose',
  'which',
  'what',
]);

const JUNK_TOKEN_CONTAINMENT = new Set([
  'setting',
  'guest',
  'list',
  'scene',
  'stage',
  'plan',
  'planning',
  'goal',
  'goals',
  'word',
  'words',
  'count',
  'paragraph',
  'paragraphs',
  'narrative',
  'flow',
  'aftermath',
  'defining',
  'expanding',
  'crafting',
  'analyzing',
  'analysing',
  'establishing',
  'developing',
  'checking',
  'reviewing',
  'confirming',
  'verifying',
  'validating',
  'refining',
  'structuring',
  'outlining',
  'framing',
  'balancing',
  'introducing',
  'incorporating',
  'exploring',
  'managing',
  'navigating',
  'handling',
  'considering',
  'evaluating',
  'designing',
  'writing',
  'mapping',
  'tracking',
  'focusing',
  'maintaining',
  'ensuring',
  'assessing',
  'determining',
  'identifying',
  'selecting',
  'orchestrating',
  'weaving',
  'shaping',
  'tuning',
  'adjusting',
  'aligning',
  'synthesizing',
  'brainstorming',
  'finalizing',
  'wrapping',
  'addressing',
  'continuing',
  'deepening',
  'escalating',
  'heightening',
  'concluding',
  'resolving',
  'capturing',
  'portraying',
  'depicting',
  'applying',
  'following',
  'respecting',
  'adhering',
  'preparing',
  'initiating',
  'executing',
  'polishing',
  'formatting',
  'updating',
  'reconciling',
  'integrating',
  'grounding',
  'anchoring',
  'elevating',
  'amplifying',
  'intensifying',
  'layering',
  'immersing',
  'rendering',
  'composing',
  'generating',
  'delivering',
  'completing',
  'finishing',
  'transitioning',
  'shifting',
  'building',
  'creating',
  'observing',
  'noting',
  'recalling',
  'directive',
  'directives',
  'temporal',
  'continuity',
  'intimate',
  'progression',
  'sensory',
  'detail',
  'details',
  'perspective',
  'perspectives',
  'dynamics',
  'dynamic',
  'consistency',
  'instruction',
  'instructions',
  'guideline',
  'guidelines',
  'objective',
  'objectives',
  'element',
  'elements',
  'structure',
  'transition',
  'transitions',
  'resolution',
  'interaction',
  'interactions',
  'emotional',
  'physical',
  'sensual',
  'context',
  'timeline',
  'chronology',
  'character',
  'characters',
  'response',
  'responses',
  'description',
  'descriptions',
  'tone',
  'voice',
  'beats',
  'plot',
  'summary',
  'notes',
  'overview',
  'approach',
  'strategy',
  'focus',
  'theme',
  'mood',
  'tension',
  'chemistry',
  'momentum',
  'rhythm',
  'nuance',
  'nuances',
  'subtext',
  'imagery',
  'language',
  'register',
  'draft',
  'review',
  'check',
  'update',
  'state',
  'memory',
  'history',
  'profile',
  'location',
  'clock',
  'prompt',
  'input',
  'output',
  'format',
  'section',
  'phase',
  'step',
  'protocol',
  'logic',
  'analysis',
  'thought',
  'system',
  'boot',
  'resource',
  'loading',
  'thinking',
  'reasoning',
  'outline',
  'drafting',
  'checklist',
  'constraint',
  'constraints',
  'pacing',
  'dialogue',
  'monologue',
  'narration',
  'room',
  'party',
  'club',
  'lounge',
  'vip',
  'penthouse',
  'mansion',
  'balcony',
  'terrace',
  'hallway',
  'bathroom',
  'bedroom',
  'kitchen',
  'floor',
  'boulevard',
  'avenue',
  'street',
  'hotel',
  'suite',
  'restaurant',
]);

const SAFE_ING_SURNAMES = new Set([
  'sterling',
  'fleming',
  'browning',
  'channing',
  'harding',
  'manning',
  'fielding',
  'spalding',
  'golding',
  'irving',
  'henning',
  'jennings',
  'cummings',
  'darling',
  'redding',
  'welling',
  'billing',
  'keeling',
  'kelling',
  'ewing',
  'king',
  'ling',
  'ming',
  'ning',
  'ping',
  'qing',
  'sing',
  'ting',
  'wing',
  'xing',
  'ying',
  'zing',
]);

const ENGLISH_CONNECTOR_WORDS = new Set([
  'the',
  'and',
  'or',
  'of',
  'for',
  'with',
  'from',
  'into',
  'onto',
  'about',
  'through',
  'between',
  'without',
  'against',
  'toward',
  'towards',
  'under',
  'over',
  'after',
  'before',
  'during',
  'by',
  'to',
  'in',
  'on',
  'at',
  'as',
]);

const VIET_DIACRITIC_CHAR_RE =
  /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

const ENGLISH_ABSTRACT_HEADING_SUFFIX_RE =
  /(?:tions?|sions?|ments?|ities|ity|ness|ances?|ences?|ives|ories|ory|ology|isms?|izing|ising|ating|ifying|icals?|tials?|urals?)$/i;

/**
 * Returns true if the given string looks like an English CoT/thinking section heading,
 * editorial planning phrase, or non-person abstract Title Case phrase
 * (e.g. "Confirming Directives", "Checking Temporal Continuity",
 * "Planning the Intimate Progression", "Refining Sensory Details and Perspective").
 */
export function isEnglishHeadingOrMetaPhrase(raw: string): boolean {
  const cleaned = String(raw || '')
    .replace(/[*_`~#<>]+/g, '')
    .replace(/^[\s"'“”‘’(\[.,!?;:–—-]+|[\s"'“”‘’.,!?;:)\[\]–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 2) return false;

  // Known celebrities are always real people
  if (lookupKnownCelebrityProfile(cleaned)) return false;

  // Vietnamese phrases with diacritics are handled separately (not English CoT headings)
  if (VIET_DIACRITIC_CHAR_RE.test(cleaned)) return false;

  const key = normalizeCharacterKey(cleaned);
  if (!key) return false;
  const tokens = key.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;

  // Any explicit CoT / editorial / meta token disqualifies the phrase
  if (tokens.some((tok) => JUNK_TOKEN_CONTAINMENT.has(tok))) {
    return true;
  }

  // English gerund (-ing) verb in leading position or inside multi-word phrase
  for (const tok of tokens) {
    if (
      tok.length >= 6 &&
      tok.endsWith('ing') &&
      !SAFE_ING_SURNAMES.has(tok)
    ) {
      return true;
    }
  }

  // Multi-word pure-ASCII checks
  if (tokens.length >= 2) {
    // Real person names do not contain English connectors like "the", "and", "for", "with"
    if (tokens.some((tok) => ENGLISH_CONNECTOR_WORDS.has(tok))) {
      return true;
    }
    // Abstract editorial / nominal suffixes (e.g. Directives, Continuity, Progression, Perspective, Sensory)
    if (
      tokens.some(
        (tok) => tok.length >= 6 && ENGLISH_ABSTRACT_HEADING_SUFFIX_RE.test(tok),
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if an entire line is an English Title Case / Markdown CoT heading
 * (such as "**Confirming Directives**", "Checking Temporal Continuity",
 * "Planning the Intimate Progression", "Refining Sensory Details and Perspective").
 */
export function isEnglishTitleCaseHeadingLine(rawLine: string): boolean {
  const trimmed = String(rawLine || '').trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 120) return false;
  if (VIET_DIACRITIC_CHAR_RE.test(trimmed)) return false;

  const isMarkdownWrapped =
    /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#+\s+.+|(?:\*\*|__)[^*\n]{3,100}(?:\*\*|__)\s*:?)$/.test(
      trimmed,
    );

  const stripped = trimmed
    .replace(/^(?:[-*+•>]\s*|\d+[.)]\s*|#+\s*)+/, '')
    .replace(/^(?:\*\*|__)+|(?:\*\*|__)+$/g, '')
    .replace(/:$/, '')
    .trim();

  if (!stripped || lookupKnownCelebrityProfile(stripped)) return false;

  // Ignore dialogue lines or full sentences ending with period/question/exclamation
  if (/["“”«»]/.test(stripped) || /[.!?…]$/.test(stripped)) {
    return false;
  }

  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 12) return false;

  // Every token should be ASCII letters/hyphens/apostrophes/ampersand
  if (!words.every((w) => /^[A-Za-z][A-Za-z'’&-]*$/.test(w))) {
    return false;
  }

  if (isEnglishHeadingOrMetaPhrase(stripped)) {
    return true;
  }

  // Standalone bold/hash heading in pure English with Title Case words
  const contentWords = words.filter(
    (w) => !ENGLISH_CONNECTOR_WORDS.has(w.toLowerCase()),
  );
  if (!contentWords.length) return false;
  const capitalizedRatio =
    contentWords.filter((w) => /^[A-Z]/.test(w)).length / contentWords.length;

  if (isMarkdownWrapped && capitalizedRatio >= 0.7 && contentWords.length >= 2) {
    return true;
  }

  return false;
}

const LEADING_ENGLISH_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'by',
  'as',
  'if',
  'or',
  'and',
  'but',
  'so',
  'yet',
  'now',
  'just',
  'here',
  'there',
  'then',
  'when',
  'where',
  'while',
  'after',
  'before',
  'during',
  'into',
  'onto',
  'over',
  'under',
  'about',
  'around',
  'through',
  'between',
  'without',
  'within',
  'behind',
  'beside',
  'inside',
  'outside',
  'across',
  'against',
  'toward',
  'towards',
  'from',
  'with',
  'near',
  'next',
  'he',
  'she',
  'it',
  'we',
  'they',
  'you',
  'i',
]);

// Strict non-person filters: companies/orgs, locations, colors, songs/works, chat channels, detached stage names
const STRICT_NON_PERSON_SINGLE_KEYS = new Set([
  // Companies / labels / apps / media / groups
  'sm',
  'yg',
  'jyp',
  'hybe',
  'ador',
  'bighit',
  'starship',
  'cube',
  'pledis',
  'wakeone',
  'fnc',
  'rbw',
  'kakao',
  'kakaotalk',
  'naver',
  'mnet',
  'dispatch',
  'billboard',
  'apple',
  'google',
  'meta',
  'netflix',
  'disney',
  'spotify',
  'youtube',
  'soundcloud',
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'threads',
  'zalo',
  'messenger',
  'wechat',
  'whatsapp',
  'telegram',
  'discord',
  'viber',
  'imessage',
  'facetime',
  'weverse',
  'bubble',
  'lysn',
  'fromm',
  'weibo',
  'douyin',
  'reddit',
  'netizen',
  'fandom',
  'antifan',
  'blackpink',
  'newjeans',
  'aespa',
  'ive',
  'lesserafim',
  'twice',
  'seventeen',
  'enhypen',
  'itzy',
  'nmixx',
  'babymonster',
  'illit',
  'riize',
  'zerobaseone',
  'bts',
  'exo',
  'nct',
  'wayv',
  'got7',
  'ateez',
  'txt',
  'bigbang',
  'snsd',
  'shinee',
  // Communication / tools / concepts
  'chat',
  'inbox',
  'dm',
  'sms',
  'email',
  'gmail',
  'livestream',
  'story',
  'stories',
  'reel',
  'reels',
  'clip',
  'video',
  'photo',
  'selfie',
  'post',
  'comment',
  'feed',
  'hashtag',
  'trending',
  'scandal',
  'drama',
  'rumor',
  'playlist',
  'album',
  'single',
  'track',
  'remix',
  'cover',
  'teaser',
  'trailer',
  'concert',
  'tour',
  'showcase',
  'comeback',
  'debut',
  'podcast',
  'episode',
  'season',
  'movie',
  'film',
  'song',
  'lyric',
  'lyrics',
  'melody',
  'beat',
  'soundtrack',
  'ost',
  'mv',
  // Locations / venues
  'cafe',
  'coffee',
  'bistro',
  'bakery',
  'pub',
  'mall',
  'plaza',
  'tower',
  'building',
  'park',
  'garden',
  'beach',
  'island',
  'airport',
  'station',
  'hospital',
  'clinic',
  'school',
  'university',
  'college',
  'academy',
  'campus',
  'office',
  'apartment',
  'condo',
  'dorm',
  'dormitory',
  'studio',
  'backstage',
  'lobby',
  'corridor',
  'rooftop',
  'basement',
  'garage',
  'district',
  'ward',
  'city',
  'town',
  'village',
  'seoul',
  'busan',
  'jeju',
  'incheon',
  'gangnam',
  'hongdae',
  'itaewon',
  'myeongdong',
  'tokyo',
  'osaka',
  'kyoto',
  'paris',
  'london',
  'beijing',
  'shanghai',
  'taipei',
  'bangkok',
  'singapore',
  'saigon',
  'hanoi',
  // Colors (English)
  'red',
  'blue',
  'green',
  'yellow',
  'black',
  'white',
  'pink',
  'purple',
  'violet',
  'orange',
  'brown',
  'gray',
  'grey',
  'silver',
  'gold',
  'golden',
  'crimson',
  'scarlet',
  'ivory',
  'beige',
  'cream',
  'navy',
  'cyan',
  'teal',
  'turquoise',
  'indigo',
  'magenta',
  'maroon',
  'olive',
  'khaki',
  'coral',
  'peach',
  'lavender',
  'lilac',
  'mint',
  'pastel',
  'neon',
  'amber',
  'emerald',
  'sapphire',
  'burgundy',
  'charcoal',
  'cobalt',
  // Generic roles / unnamed jobs
  'barista',
  'cashier',
  'receptionist',
  'driver',
  'guard',
  'staff',
  'crew',
  'team',
  'group',
  'band',
  'label',
  'agency',
  'company',
  'entertainment',
  'records',
  'media',
  'press',
  'crowd',
  'audience',
  'fan',
  'fans',
  'singer',
  'rapper',
  'idol',
  'actor',
  'actress',
  'model',
]);

// Vietnamese single-word colors & non-person concepts (diacritic-preserving to avoid hitting valid names like "Đô" or "Đỗ")
const STRICT_VI_SINGLE_COLOR_OR_NON_PERSON_RE =
  /^(?:đỏ|xanh|vàng|đen|trắng|tím|xám|nâu|cam|bạc|be|kem|ngà|rêu|chàm|màu|quán|tiệm|phòng|nhà|tòa|công|khu|quận|phường|phố|ngõ|hẻm|đường|sảnh|tầng|nhóm|hội|đội|hãng|bài|nhạc|phim|sách|truyện|tin|chat|mạng|loa|mic|máy|ảnh|xe|ly|cốc|bàn|ghế|cửa|đèn|mưa|nắng|gió|mây|trời|biển|núi|rừng|hoa|cây|cỏ|đêm|ngày|sáng|trưa|chiều|tối|khuya|hồng)$/iu;

// Phrases starting with Vietnamese location / organization / work / color / chat markers (diacritic-aware!)
const STRICT_VI_NON_PERSON_PREFIX_RE =
  /^(?:nhóm\s+chat|group\s+chat|khung\s+chat|phòng\s+chat|đoạn\s+chat|kênh\s+chat|tin\s+nhắn|hộp\s+thư|thông\s+báo|điện\s+thoại|màn\s+hình|ứng\s+dụng|mạng\s+xã\s+hội|diễn\s+đàn|bình\s+luận|bài\s+đăng|bài\s+viết|cuộc\s+gọi|công\s+ty|tập\s+đoàn|tổ\s+chức|nhãn\s+hàng|thương\s+hiệu|hãng\s+(?:đĩa|thu\s+âm|phim|nhạc|thời\s+trang|xe|giải\s+trí)|nhóm\s+(?:nhạc|bạn|kín|chung|riêng|thực\s+tập|idols?)|ban\s+(?:nhạc|tổ\s+chức|giám\s+khảo|quản\s+lý)|câu\s+lạc\s+bộ|clb\s+|hội\s+(?:nhóm|đồng|bạn|người)|đội\s+(?:ngũ|nhóm|hình)|ê[- ]?kíp|bộ\s+phận|phòng\s+ban|trụ\s+sở|chi\s+nhánh|đài\s+truyền\s+hình|tòa\s+soạn|tạp\s+chí|quán\s+|tiệm\s+|cà\s+phê\s+|phòng\s+|nhà\s+(?:hàng|nghỉ|ga|hát|thờ|riêng|tắm|bếp|vệ\s+sinh|xe|sách|thi\s+đấu|máy|xưởng|trọ|cửa|vệ)|khách\s+sạn|khu\s+(?:vực|phố|đô\s+thị|nghỉ\s+dưỡng|chợ|công\s+nghiệp|trung\s+tâm|vui\s+chơi|vip)|tòa\s+(?:nhà|tháp)|cao\s+ốc|căn\s+hộ|chung\s+cư|biệt\s+thự|văn\s+phòng|công\s+viên|quảng\s+trường|bệnh\s+viện|phòng\s+khám|trường\s+(?:học|đại\s+học|cấp|trung\s+học|tiểu\s+học|mầm\s+non)|đại\s+học|học\s+viện|ký\s+túc\s+xá|sân\s+(?:bay|khấu|vận\s+động|thượng|chơi|tập|sau|trước)|bến\s+(?:xe|tàu|cảng)|trạm\s+|ga\s+(?:tàu|xe|metro)|bãi\s+(?:biển|đỗ\s+xe|cát)|bờ\s+biển|hòn\s+đảo|trung\s+tâm|siêu\s+thị|cửa\s+hàng|thư\s+viện|bảo\s+tàng|rạp\s+|quận\s+|phường\s+|xã\s+|huyện\s+|tỉnh\s+|thành\s+phố|phố\s+|ngõ\s+|hẻm\s+|đại\s+lộ|tầng\s+|sảnh\s+|hành\s+lang|ban\s+công|hậu\s+trường|khán\s+đài|hội\s+trường|đường\s+(?:phố|lớn|nhỏ|cao\s+tốc|mòn|quốc\s+lộ|nguyễn|lê|trần|hai\s+bà|đồng\s+khởi|nam\s+kỳ|võ\s+văn|điện\s+biên|cách\s+mạng|hùng\s+vương|trường\s+chinh|phạm\s+văn|hoàng\s+hoa|lý\s+thường|tôn\s+đức)|màu\s+|sắc\s+(?:đỏ|xanh|vàng|đen|trắng|hồng|tím|xám|nâu|cam|bạc)|tông\s+(?:màu|đỏ|xanh|vàng|đen|trắng|hồng|tím|xám|nâu|cam|lạnh|ấm|trầm|sáng)|bài\s+(?:hát|nhạc|rap|thơ|báo|viết|đăng|tập|thi)|ca\s+khúc|bản\s+(?:nhạc|tin|thu|demo|phối|remix|cover)|đĩa\s+(?:đơn|nhạc|than)|album\s+|playlist\s+|mv\s+|bộ\s+(?:phim|sưu\s+tập|truyện|đồ|ảnh)|phim\s+|tác\s+phẩm|cuốn\s+(?:sách|tiểu\s+thuyết|truyện|tạp\s+chí)|tiểu\s+thuyết|chương\s+trình|buổi\s+(?:diễn|tập|họp|tiệc|hẹn|phỏng\s+vấn|chụp|ghi\s+hình|biểu\s+diễn|lễ)|lễ\s+(?:trao\s+giải|hội|cưới|khai\s+mạc|ra\s+mắt)|giải\s+thưởng|sự\s+kiện|chiến\s+dịch|nhân\s+viên|phục\s+vụ|bảo\s+vệ|tài\s+xế|lễ\s+tân|thu\s+ngân|pha\s+chế|quản\s+lý|trợ\s+lý|phóng\s+viên|nhà\s+báo|cư\s+dân\s+mạng|người\s+(?:hâm\s+mộ|qua\s+đường|lạ|nền|phục\s+vụ|bảo\s+vệ|quản\s+lý|dẫn\s+chương\s+trình))\b/iu;

// Generic unnamed filler / background NPC descriptors (without a real personal name).
// Used to stop auto-extraction from registering transient extras like "Anh bảo vệ", "Cô lễ tân", "Người đàn ông lạ", "Tiểu nhị", "Waiter", etc.
const STRICT_VI_UNNAMED_FILLER_ROLE_RE =
  /^(?:(?:một|hai|ba|vài|mấy|những|các|nhóm|đám|bọn|tốp|vị|anh|chị|cô|cậu|chú|bác|ông|bà|em|gã|tên|kẻ|người|đứa|tay|thằng|con|nữ|nam)\s+){0,2}(?:nhân\s+viên(?:\s+(?:lễ\s+tân|phục\s+vụ|bán\s+hàng|thu\s+ngân|pha\s+chế|bảo\s+vệ|hậu\s+trường|kỹ\s+thuật|trường\s+quay|an\s+ninh|vệ\s+sinh|giao\s+hàng|văn\s+phòng|quán|tiệm|khách\s+sạn))?|phục\s+vụ(?:\s+bàn)?|bồi\s+bàn|bảo\s+vệ|vệ\s+sĩ|an\s+ninh|tài\s+xế(?:\s+(?:taxi|xe\s+ôm|công\s+nghệ|riêng))?|lái\s+xe|lễ\s+tân|thu\s+ngân|pha\s+chế|barista|tiếp\s+tân|bán\s+hàng|chủ\s+(?:quán|tiệm|nhà\s+hàng|khách\s+sạn|sạp|xe)|quản\s+lý(?:\s+(?:quán|tiệm|nhà\s+hàng|khách\s+sạn|tầng|khu\s+vực))?|trợ\s+lý(?:\s+(?:trường\s+quay|hậu\s+trường|đạo\s+diễn|sản\s+xuất))?|kỹ\s+thuật\s+viên|chuyên\s+viên(?:\s+(?:trang\s+điểm|âm\s+thanh|ánh\s+sáng))?|thợ\s+(?:trang\s+điểm|làm\s+tóc|chụp\s+ảnh|quay\s+phim|sửa\s+xe|mộc|rèn)|quay\s+phim|nhiếp\s+ảnh\s+gia|phóng\s+viên|nhà\s+báo|bác\s+sĩ(?:\s+trực)?|y\s+tá(?:\s+trực)?|dược\s+sĩ|cảnh\s+sát(?:\s+giao\s+thông)?|công\s+an|lính\s+(?:canh|gác|đánh\s+thuê|lác|tuần)|thị\s+vệ|hộ\s+vệ|quân\s+lính|tiểu\s+nhị|chưởng\s+quỹ|nha\s+hoàn|cung\s+nữ|thái\s+giám|đệ\s+tử(?:\s+(?:ngoại\s+môn|nội\s+môn|gác\s+cổng|tuần\s+tra))?|khách\s+(?:hàng|qua\s+đường|mời|trọ|lạ|uống\s+nước|du\s+lịch|vãng\s+lai)|người\s+(?:lạ(?:\s+mặt)?|qua\s+đường|nền|xem|hâm\s+mộ|đưa\s+thư|giao\s+hàng|bán\s+hàng|đàn\s+ông(?:\s+(?:lạ|trung\s+niên|áo\s+\S+|cao\s+lớn|đội\s+\S+))?|phụ\s+nữ(?:\s+(?:lạ|trung\s+niên|áo\s+\S+))?)|đàn\s+ông(?:\s+(?:lạ(?:\s+mặt)?|trung\s+niên|áo\s+\S+))?|phụ\s+nữ(?:\s+(?:lạ(?:\s+mặt)?|trung\s+niên|áo\s+\S+))?|cô\s+gái(?:\s+(?:lạ(?:\s+mặt)?|tóc\s+\S+|áo\s+\S+|trẻ))?|chàng\s+trai(?:\s+(?:lạ(?:\s+mặt)?|tóc\s+\S+|áo\s+\S+|trẻ))?|thanh\s+niên(?:\s+(?:lạ(?:\s+mặt)?|tóc\s+\S+|áo\s+\S+))?|thiếu\s+niên(?:\s+lạ)?|thiếu\s+nữ(?:\s+lạ)?|ông\s+lão|bà\s+lão|lạ\s+mặt|quần\s+chúng|khán\s+giả|cư\s+dân\s+mạng|bóng\s+người|giọng\s+nói(?:\s+lạ)?|waiter|waitress|bartender|receptionist|cashier|security(?:\s+guard)?|guard|driver|taxi\s+driver|delivery(?:\s+man|\s+person)?|stranger|passerby|bystander|crowd|staff(?:\s+member)?|crew(?:\s+member)?|assistant|manager|director|producer|stylist|makeup\s+artist|photographer|reporter|journalist|doctor|nurse|officer|police(?:\s+officer)?|soldier|servant|maid|customer|guest)$/iu;

export function isGenericUnnamedFillerNpcName(
  rawName: string,
  allowedKnownKeys?: Set<string>,
): boolean {
  const cleaned = String(rawName || '')
    .replace(/[*_`~#<>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return true;
  const key = normalizeCharacterKey(cleaned);
  if (!key) return true;
  if (allowedKnownKeys && allowedKnownKeys.has(key)) return false;
  if (lookupKnownCelebrityProfile(cleaned)) return false;
  return STRICT_VI_UNNAMED_FILLER_ROLE_RE.test(cleaned);
}

// Explicit real character designations (person head + distinguishing modifier, e.g. "Lão nhân nón lá", "Chưởng quỹ tiệm đan", "Hộ vệ áo đen", "Trưởng lão Huyền Thanh", "Sư tỷ Thanh Hà")
const EXPLICIT_CHARACTER_HEAD_RE =
  /^(?:lão\s+nhân|ông\s+lão|bà\s+lão|lão\s+giả|lão\s+tổ|lão\s+ma|lão\s+đạo|chưởng\s+quỹ|chủ\s+tiệm|chủ\s+quán|chủ\s+sạp|hộ\s+vệ|thị\s+vệ|ám\s+vệ|trưởng\s+lão|đại\s+trưởng\s+lão|nhị\s+trưởng\s+lão|tam\s+trưởng\s+lão|chưởng\s+môn|tông\s+chủ|môn\s+chủ|cung\s+chủ|các\s+chủ|lâu\s+chủ|điện\s+chủ|phong\s+chủ|đảo\s+chủ|thành\s+chủ|trang\s+chủ|bang\s+chủ|giáo\s+chủ|cốc\s+chủ|động\s+chủ|sư\s+tôn|sư\s+phụ|sư\s+huynh|sư\s+tỷ|sư\s+muội|sư\s+đệ|sư\s+thúc|sư\s+bá|đại\s+sư\s+huynh|đại\s+sư\s+tỷ|đạo\s+hữu|đạo\s+trưởng|tiền\s+bối|cao\s+nhân|kiếm\s+khách|đao\s+khách|đạo\s+sĩ|đan\s+sư|luyện\s+đan\s+sư|luyện\s+khí\s+sư|trận\s+pháp\s+sư|phù\s+sư|nữ\s+tu|nam\s+tu|tán\s+tu|ma\s+tu|yêu\s+tu|kiếm\s+tu|tiên\s+tử|thánh\s+nữ|thánh\s+tử|công\s+tử|tiểu\s+thư|thiếu\s+chủ|thiếu\s+gia|đại\s+hiệp|nữ\s+hiệp|hắc\s+y\s+nhân|bạch\s+y\s+nhân|hắc\s+bào\s+nhân|thanh\s+y\s+nhân|hồng\s+y\s+nhân|tiểu\s+đạo\s+đồng|đạo\s+đồng|dược\s+đồng|kiếm\s+đồng|thương\s+nhân|hành\s+thương)\s+([\p{L}][\p{L}\s-]{1,28})$/iu;

const EXPLICIT_CHARACTER_SUFFIX_TITLE_RE =
  /^([\p{L}][\p{L}\s-]{1,20})\s+(?:chân\s+nhân|đạo\s+trưởng|đạo\s+nhân|trưởng\s+lão|chưởng\s+môn|chưởng\s+quỹ|tiền\s+bối|đạo\s+hữu|sư\s+tôn|sư\s+phụ|sư\s+huynh|sư\s+tỷ|sư\s+muội|sư\s+đệ|tiên\s+tử|công\s+tử|tiểu\s+thư|thiếu\s+chủ|tông\s+chủ|cung\s+chủ|lão\s+tổ|lão\s+quái|lão\s+nhân|đại\s+hiệp|nữ\s+hiệp)$/iu;

export function isExplicitCharacterDesignation(rawName: string): boolean {
  const cleaned = String(rawName || '')
    .replace(/[*_`~#<>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 4 || cleaned.length > 42) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (STRICT_VI_NON_NAME_TOKEN_RE.test(cleaned)) return false;
  if (STRICT_NON_PERSON_SUBSTRING_RE.test(normalizeCharacterKey(cleaned))) {
    return false;
  }
  if (EXPLICIT_CHARACTER_HEAD_RE.test(cleaned)) {
    return true;
  }
  const suffixMatch = cleaned.match(EXPLICIT_CHARACTER_SUFFIX_TITLE_RE);
  if (suffixMatch && suffixMatch[1]) {
    const prefixNorm = normalizeCharacterKey(suffixMatch[1]);
    if (
      prefixNorm &&
      !XIANXIA_NON_PERSON_EXACT_KEYS.has(prefixNorm) &&
      !XIANXIA_REALM_OR_STAGE_RE.test(suffixMatch[1])
    ) {
      return true;
    }
  }
  return false;
}

// Comprehensive Xianxia / Xuanhuan / Wuxia non-person exact phrases (realms, places, items, pills, talismans, techniques)
const XIANXIA_NON_PERSON_EXACT_KEYS = new Set([
  // Realms, stages, cultivation concepts
  'luyen khi',
  'luyen khi ky',
  'luyen khi tang',
  'truc co',
  'truc co ky',
  'truc co tang',
  'kim dan',
  'kim dan ky',
  'kim dan tang',
  'nguyen anh',
  'nguyen anh ky',
  'hoa than',
  'hoa than ky',
  'luyen hu',
  'luyen hu ky',
  'hop the',
  'hop the ky',
  'dai thua',
  'dai thua ky',
  'do kiep',
  'do kiep ky',
  'chan tien',
  'kim tien',
  'thai at',
  'thai at chan tien',
  'dai la',
  'dai la kim tien',
  'huyen tien',
  'tan tien',
  'tien de',
  'tien ton',
  'vo de',
  'vo ton',
  'vo thanh',
  'vo vuong',
  'vo hoang',
  'vo tong',
  'dau khi',
  'dau gia',
  'dau su',
  'dai dau su',
  'dau linh',
  'dau vuong',
  'dau hoang',
  'dau tong',
  'dau ton',
  'dau thanh',
  'dau de',
  'so ky',
  'trung ky',
  'hau ky',
  'dinh phong',
  'vien man',
  'ban bo',
  'tieu thanh',
  'dai thanh',
  'nhap mon',
  'canh gioi',
  'tieu canh gioi',
  'dai canh gioi',
  'binh canh',
  'tu vi',
  'linh luc',
  'chan khi',
  'noi luc',
  'huyen luc',
  'linh khi',
  'than thuc',
  'nguyen than',
  'dan dien',
  'kinh mach',
  'thuc hai',
  'khi hai',
  'linh can',
  'dao co',
  'dao tam',
  'tam ma',
  'thien kiep',
  'loi kiep',
  'dot pha',
  'be quan',
  'tu luyen',
  'tho nap',
  'van cong',
  'dan khi',
  // User-reported & frequent Xianxia/Wuxia junk terms (locations, markets, items, pills, talismans, techniques, nature)
  'linh son',
  'linh dan',
  'thanh van',
  'thanh van phuong thi',
  'thanh van tong',
  'thanh van son',
  'thanh van mon',
  'phuong thi',
  'thanh suong',
  'bach bao',
  'bach bao cac',
  'bach bao lau',
  'bach bao duong',
  'thanh binh',
  'thanh binh tien kiem',
  'tien kiem',
  'thanh tung',
  'ngung than',
  'ngung than tu linh',
  'tu linh',
  'tinh am',
  'tinh am phu',
  'linh thach',
  'ha pham',
  'trung pham',
  'thuong pham',
  'cuc pham',
  'thien pham',
  'tien pham',
  'linh pham',
  'huyen pham',
  'dia pham',
  'hoang pham',
  'linh thao',
  'dan duoc',
  'phap bao',
  'phap khi',
  'linh kiem',
  'phi kiem',
  'ngoc gian',
  'ngoc boi',
  'tui tru vat',
  'nhan tru vat',
  'phu luc',
  'tran ban',
  'tran do',
  'dan lo',
  'duoc dinh',
  'hon khi',
  'ban menh',
  'cong phap',
  'tam phap',
  'chieu thuc',
  'kiem quyet',
  'than phap',
  'bi thuat',
  'than thong',
  'dong phu',
  'bi canh',
  'tong mon',
  'son mon',
  'tuu lau',
  'khach diem',
  'tiem dan',
  'dan cac',
  'bao cac',
  'tang kinh cac',
  'linh dien',
  'dai dien',
  'co thanh',
  'thuong hoi',
  'hac thi',
  'duoc vien',
  'linh mach',
  'linh tuyen',
  'han dam',
  'thien dia',
  'giang ho',
  'tu chan gioi',
  'vo lam',
  'trung nguyen',
  'thanh van dan khi quyet',
  'ngu phong kiem quyet',
  'linh bo than phap',
  'thien tai dia bao',
  'ho giap',
  'dao bao',
  'linh giap',
  'ngoc lo',
  'han bang',
  'han ngoc',
  'kiem y',
  'dao y',
  // Kiếm hiệp — 21 tôn hiệu thực lực nội công Cửu Âm (KHÔNG BAO GIỜ là NPC)
  'bat kham nhat kich',
  'so hoc xa luyen',
  'so khuy mon kinh',
  'luoc huu tieu thanh',
  'gia khinh tuu thuc',
  'dung hoi quan thong',
  'lo hoa thuan thanh',
  'ky tai xuat chung',
  'than ho ky ky',
  'xuat than nhap hoa',
  'ngao thi quan hung',
  'dang phong tao cuc',
  'vo du luan ti',
  'so huong phi mi',
  'nhat dai ton su',
  'than cong cai the',
  'cu the vo song',
  'kinh the hai tuc',
  'kinh thien dong dia',
  'chan co thuoc kim',
  'sieu pham nhap thanh',
  // Kiếm hiệp — Nội công giang hồ, tâm pháp, lộ tuyến, kinh mạch & phúc địa
  'noi cong giang ho',
  'hon nguyen cong',
  'tu ha cong',
  'nghich thien ta cong',
  'vo vong than cong',
  'tan duong cong quyet',
  'ngu hanh tam phap',
  'huyet dao kinh',
  'doc thiem cong',
  'bang tam quyet',
  'quy hoa bao dien',
  'hap tinh dai phap',
  'nhuoc thuy than dien',
  'tuy tien quyet',
  'han tieu quyet',
  'hoi minh nhat nguyet giam',
  'cuu am chan kinh',
  'cuu duong than cong',
  'tay tuy kinh',
  // Kiếm hiệp — Nội công môn phái (Nhập môn · Trung cấp · Trấn phái) & Cổ phổ
  'noi cong mon phai',
  'co pho',
  'tran phai',
  'nhap mon tam phap',
  'vo dang nhap mon tam phap',
  'hoa son co ban noi cong',
  'thieu lam la han so cong',
  'nga mi thanh tam quyet',
  'duong mon luc hop so kinh',
  'cai bang tieu dao du noi cong',
  'vo dang luong nghi ho tam cong',
  'nga mi bang tam tinh khi quyet',
  'hoa son hon nguyen nhi trong',
  'thieu lam kim cang phuc ma cong',
  'cai bang hang long khi quyet',
  'tu ha than cong',
  'cuu am nga mi tran phai tam kinh',
  'thai cuc than cong',
  'dich can kinh',
  'quan tu duong',
  'cam y ve',
  'cuc lac coc',
  'di hoa cung',
  'dao hoa dao',
  'vo can mon',
  'kim cham tham gia',
  'vo mon phai',
  'bat dai mon phai',
  'quan tu duong tieu dao tam phap',
  'cam y ve huyet sat dao kinh',
  'cuc lac coc song tu thien ma cong',
  'di hoa cung minh ngoc cong',
  'minh ngoc cong',
  'dao hoa dao bich hai trieu sinh khuc',
  'bich hai trieu sinh khuc',
  'vo can mon tich ta tam kinh',
  'tich ta tam kinh',
  'kim cham tham gia do kiep quyet',
  'thuc chieu',
  'hu chieu',
  'gia chieu',
  'doat thu',
  'thai cuc quyen',
  'da cau bong phap',
  'thai thanh noi cong',
  'thai thanh noi cong tam phap',
  'thanh phong thap tam kiem',
  'thanh phong truong kiem',
  'dap tuyet vo ngan',
  'duong cuong',
  'am nhu',
  'thai cuc',
  'bat mach ky kinh',
  'ky kinh bat mach',
  'tau hoa nhap ma',
  'kim sang duoc',
  'hoi khi hoan',
  'phuc dia',
  'thanh dia',
  'truc hai',
  'bang coc',
  'tuyet phong',
  'danh son',
  'dia huyet',
  'tham dong',
  'bich thuy',
  'co lam',
]);

// Diacritic-aware cultivation realms, stages, tiers, and internal energy concepts
const XIANXIA_REALM_OR_STAGE_RE =
  /(?:^|\s)(?:luyện\s+khí|trúc\s+cơ|kim\s+đan|nguyên\s+anh|hóa\s+thần|luyện\s+hư|hợp\s+thể|đại\s+thừa|độ\s+kiếp|chân\s+tiên|kim\s+tiên|thái\s+ất|đại\s+la|huyền\s+tiên|đấu\s+khí|đấu\s+sư|đấu\s+linh|đấu\s+vương|đấu\s+hoàng|đấu\s+tông|đấu\s+tôn|đấu\s+thánh|đấu\s+đế|hậu\s+thiên|tiên\s+thiên|bất\s+kham\s+nhất\s+kích|sơ\s+học\s+xạ\s+luyện|sơ\s+khuy\s+môn\s+kinh|lược\s+hữu\s+tiểu\s+thành|giá\s+khinh\s+tựu\s+thực|dung\s+hội\s+quán\s+thông|lô\s+hỏa\s+thuần\s+thanh|kỳ\s+tài\s+xuất\s+chúng|thần\s+hồ\s+kỳ\s+kỹ|xuất\s+thần\s+nhập\s+hóa|ngạo\s+thị\s+quần\s+hùng|đăng\s+phong\s+tạo\s+cực|vô\s+dữ\s+luận\s+tỉ|sở\s+hướng\s+phí\s+mị|nhất\s+đại\s+tôn\s+sư|thần\s+công\s+cái\s+thế|cử\s+thế\s+vô\s+song|kinh\s+thế\s+hãi\s+tục|kinh\s+thiên\s+động\s+địa|chấn\s+cổ\s+thước\s+kim|siêu\s+phàm\s+nhập\s+thánh|cảnh\s+giới|tiểu\s+cảnh\s+giới|đại\s+cảnh\s+giới|bình\s+cảnh|đan\s+điền|kinh\s+mạch|kỳ\s+kinh|bát\s+mạch|thức\s+hải|khí\s+hải|linh\s+căn|linh\s+lực|chân\s+khí|linh\s+khí|nội\s+lực|nội\s+công|huyền\s+lực|thần\s+thức|nguyên\s+thần|tâm\s+ma|tẩu\s+hỏa|thiên\s+kiếp|lôi\s+kiếp|đạo\s+cơ|đạo\s+tâm|tu\s+vi|sơ\s+kỳ|trung\s+kỳ|hậu\s+kỳ|mạt\s+kỳ|đỉnh\s+phong|viên\s+mãn|tiểu\s+thành|đại\s+thành|nhập\s+môn|bán\s+bộ|nhất\s+(?:giai|tầng|trọng|phẩm)|nhị\s+(?:giai|tầng|trọng|phẩm)|tam\s+(?:giai|tầng|trọng|phẩm)|tứ\s+(?:giai|tầng|trọng|phẩm)|ngũ\s+(?:giai|tầng|trọng|phẩm)|lục\s+(?:giai|tầng|trọng|phẩm)|thất\s+(?:giai|tầng|trọng|phẩm)|bát\s+(?:giai|tầng|trọng|phẩm)|cửu\s+(?:giai|tầng|trọng|phẩm)|hạ\s+phẩm|trung\s+phẩm|thượng\s+phẩm|cực\s+phẩm|thiên\s+phẩm|tiên\s+phẩm|địa\s+phẩm|huyền\s+phẩm|hoàng\s+phẩm|linh\s+phẩm)(?:\s|$)/iu;

const XIANXIA_REALM_TRAILING_SUFFIX_RE =
  /(?:^|\s)(?:tầng|cảnh|trọng|giai|phẩm)$/iu;

// Unconditional item / weapon / talisman / treasure / technique trailing suffixes (NEVER a human given name)
const XIANXIA_ITEM_OR_TECHNIQUE_SUFFIX_RE =
  /(?:^|\s)(?:kiếm|đao|thương|kích|phủ|trượng|côn|bổng|roi|châm|ám\s+khí|phù|bùa|phù\s+lục|phù\s+ấn|đạo\s+ấn|pháp\s+ấn|dược|hoàn|tán|cao|thạch|thảo|quả|tủy|dịch|giáp|bào|đỉnh|lô|trận|trận\s+bàn|trận\s+đồ|trận\s+kỳ|trận\s+pháp|pháp\s+bảo|pháp\s+khí|linh\s+khí|tiên\s+khí|thần\s+binh|chí\s+bảo|bảo\s+vật|hồn\s+khí|ngọc\s+giản|ngọc\s+bội|ngọc\s+phù|trữ\s+vật|hồ\s+lô|bảo\s+tháp|cổ\s+kính|hồn\s+đăng|linh\s+tửu|linh\s+trà|quyết|công\s+pháp|tâm\s+pháp|thân\s+pháp|kiếm\s+pháp|đao\s+pháp|chưởng\s+pháp|quyền\s+pháp|bộ\s+pháp|chỉ\s+pháp|khinh\s+công|nội\s+công|thần\s+công|tà\s+công|đại\s+pháp|bảo\s+điển|thần\s+điển|nhật\s+nguyệt\s+giám|chân\s+kinh|bí\s+thuật|đạo\s+thuật|pháp\s+thuật|thần\s+thông|chiêu\s+thức|tuyệt\s+học|bí\s+tịch|chưởng|quyền|trảo|cước|kình|tụ\s+linh|dẫn\s+khí|ngưng\s+thần|thổ\s+nạp|vận\s+công|tẩy\s+tủy|dưỡng\s+thần|hộ\s+mạch|tĩnh\s+âm)$/iu;

// Unconditional location / sect / market / building trailing suffixes (NEVER a human given name)
const XIANXIA_LOCATION_OR_SECT_SUFFIX_RE =
  /(?:^|\s)(?:phường\s+thị|tửu\s+lầu|khách\s+điếm|động\s+phủ|bí\s+cảnh|linh\s+mạch|tông\s+môn|sơn\s+môn|tiệm\s+đan|đan\s+các|bảo\s+các|tàng\s+kinh\s+các|linh\s+điện|đại\s+điện|thương\s+hội|cổ\s+thành|hắc\s+thị|dược\s+viên|sơn\s+cốc|hàn\s+đàm|linh\s+tuyền|phúc\s+địa|động\s+thiên|tùng\s+lâm|thâm\s+uyên|yêu\s+sơn|linh\s+sơn|tiên\s+sơn|thánh\s+địa|cấm\s+địa|di\s+tích|cổ\s+mộ|phường|tông|môn|phái|bang|giáo|các|lầu|điện|viện|phủ|cung|đàn|trại|động|cốc|trấn|thôn|đảo|đầm|uyên|vực|giới|trì|núi|rừng|suối|thác|hang|chợ|tiệm|quán)$/iu;

// Poetic / elemental / numerical / cultivation first words that are NOT personal surnames
const XIANXIA_POETIC_NON_SURNAME_FIRST_RE =
  /^(?:linh|thanh|bách|vạn|thiên|địa|huyền|thái|cửu|thất|ngũ|tứ|tam|nhị|nhất|hắc|xích|tử|huyết|băng|hỏa|lôi|ngân|ngọc|cổ|tiên|thần|ma|yêu|tĩnh|ngưng|tụ|dẫn|ngự|trảm|phá|hộ|tẩy|dưỡng|bổ|hồi|phi|luyện|trúc|hóa|hợp|độ|thương|cực|vô|bất|tuyệt|độc|khai|chân|nguyên|bát|thập)$/iu;

// Second/trailing world-concept words that when combined with a poetic non-surname prefix form an item/place/technique/nature term
const XIANXIA_WORLD_CONCEPT_END_RE =
  /^(?:sơn|lâm|tùng|trúc|mai|lan|cúc|sương|tuyết|vân|phong|vũ|lôi|điện|hỏa|băng|thủy|mộc|thổ|kim|ngọc|bảo|đan|kiếm|đao|phù|trận|tháp|các|lầu|tông|môn|đạo|pháp|quyết|công|kinh|khí|lực|hồn|thần|linh|mạch|đàm|tuyền|hải|giang|hà|cốc|động|phủ|thành|trấn|thị|phường|bình|âm|quang|ảnh|châu|liên|hoa|thảo|quả|thạch|tủy|dịch|lộ|giáp|bào|đỉnh|lô|ấn|kính|đăng|cầm|sáo|tiêu|cảnh|giới|vực|tầng|kỳ|giai|trọng|phẩm|ý|tâm|mộc|tuyền|nguyệt)$/iu;

const XIANXIA_WORLD_CONCEPT_ANY_TOKEN_RE =
  /(?:^|\s)(?:kiếm|đao|phù|bùa|đan|dược|lôi|băng|hỏa|trận|tông|môn|các|lầu|điện|phủ|sơn|hải|thiên|địa|linh|khí|thần|quyết|công|pháp|kinh|chưởng|quyền|chỉ|trảo|ý|vực|cảnh|tầng|thạch|thảo|liên|bảo|ngọc|mạch|tủy|giáp|bào|đỉnh|lô|tháp|ấn|phường|thị|tùng|sương|tụ|ngưng|dẫn|ngự|tẩy|dưỡng|tĩnh|luyện|trúc|hóa|độ)(?:\s|$)/iu;

/**
 * Extracts normalized keys from the player's own cultivation profile (realms, techniques, moves,
 * inventory items, equipped gear) so none of them can ever be misidentified as NPCs.
 */
export function buildCultivationNonNpcKeys(
  cultivation?: CultivationProfile | null,
): Set<string> {
  const blocked = new Set<string>();
  if (!cultivation) return blocked;

  const addPhrase = (raw?: string | null, addSubChunks = false) => {
    const clean = String(raw || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[\[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;
    const key = normalizeCharacterKey(clean);
    if (!key || key.length < 2) return;
    blocked.add(key);

    if (addSubChunks) {
      const words = key.split(/\s+/).filter(Boolean);
      // Add 2-word and 3-word contiguous chunks that do NOT begin with a real surname
      if (words.length >= 3) {
        for (let len = 2; len <= Math.min(3, words.length - 1); len++) {
          for (let i = 0; i <= words.length - len; i++) {
            const chunk = words.slice(i, i + len).join(' ');
            const firstTok = words[i];
            if (chunk.length >= 4 && !ALL_PERSON_SURNAME_KEYS.has(firstTok)) {
              blocked.add(chunk);
            }
          }
        }
      }
    }
  };

  addPhrase(cultivation.realmName, true);
  addPhrase(cultivation.majorRealm, true);
  addPhrase(cultivation.energyLabel, false);
  addPhrase(cultivation.bagName, true);
  if (cultivation.wuxiaState?.activeInnerArtName) {
    addPhrase(cultivation.wuxiaState.activeInnerArtName, true);
  }

  for (const tech of cultivation.techniques || []) {
    addPhrase(tech.name, true);
    for (const mv of tech.moves || []) {
      addPhrase(mv.name, true);
    }
  }
  for (const item of cultivation.inventory || []) {
    addPhrase(item.name, true);
  }
  if (cultivation.equipment) {
    for (const slotVal of Object.values(cultivation.equipment)) {
      if (slotVal && typeof slotVal === 'object') {
        const rec = slotVal as unknown as Record<string, unknown>;
        if (typeof rec.name === 'string') addPhrase(rec.name, true);
        if (typeof rec.itemName === 'string') addPhrase(rec.itemName, true);
      }
    }
  }

  return blocked;
}

export function hasPersonSurnameStart(rawName: string): boolean {
  const clean = String(rawName || '').trim();
  if (!clean) return false;
  const firstTok = normalizeCharacterKey(clean).split(/\s+/)[0] || '';
  return Boolean(firstTok && ALL_PERSON_SURNAME_KEYS.has(firstTok));
}

/**
 * Returns true if the candidate string is a Xianxia / Xuanhuan / Wuxia non-person concept:
 * cultivation realm/stage, location/sect/market/nature term, weapon/pill/talisman/item,
 * technique/move, or poetic 2-4 word non-surname prose phrase (e.g. "Linh Sơn", "Linh Đan",
 * "Thanh Vân Phường Thị", "Thanh Sương", "Bách Bảo", "Luyện Khí", "Luyện Khí Tầng",
 * "Thanh Bình Tiên Kiếm", "Luyện Khí Kỳ", "Thanh Tùng", "Ngưng Thần Tụ Linh", "Tĩnh Âm Phù").
 */
export function isNonPersonCultivationOrWorldTerm(
  rawName: string,
  extraBlockedKeys?: Set<string>,
): boolean {
  const cleaned = String(rawName || '')
    .replace(/[*_`~#<>]+/g, '')
    .replace(/^[\s"'“”‘’(\[.,!?;:–—-]+|[\s"'“”‘’.,!?;:)\[\]–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return true;

  const key = normalizeCharacterKey(cleaned);
  if (!key) return true;

  // Dynamic cross-check against MC's own realms, techniques, moves, and inventory items
  if (extraBlockedKeys && extraBlockedKeys.has(key)) {
    return true;
  }

  // Explicit human character designations (e.g. "Lão nhân nón lá", "Chưởng quỹ tiệm đan", "Hộ vệ áo đen", "Sư tỷ Thanh Hà") are people, NOT objects/places
  if (isExplicitCharacterDesignation(cleaned)) {
    return false;
  }

  if (XIANXIA_NON_PERSON_EXACT_KEYS.has(key)) {
    return true;
  }

  // Cultivation realms, stages, meridians, and tier labels
  if (
    XIANXIA_REALM_OR_STAGE_RE.test(cleaned) ||
    XIANXIA_REALM_TRAILING_SUFFIX_RE.test(cleaned)
  ) {
    return true;
  }

  // Trailing item / weapon / talisman / technique / location / sect suffixes
  if (
    XIANXIA_ITEM_OR_TECHNIQUE_SUFFIX_RE.test(cleaned) ||
    XIANXIA_LOCATION_OR_SECT_SUFFIX_RE.test(cleaned)
  ) {
    return true;
  }

  const rawWords = cleaned.split(/\s+/).filter(Boolean);
  const tokens = key.split(/\s+/).filter(Boolean);

  // Pills ending in "Đan" (e.g. "Linh Đan", "Tụ Linh Đan", "Trúc Cơ Đan", "Hồi Xuân Đan")
  // Preserve 3+ word personal names starting with a real surname (e.g. "Trần Linh Đan"),
  // while rejecting poetic/cultivation prefixes like "Tụ", "Trúc", "Hồi", "Tẩy", "Bổ", "Ngưng"
  if (
    rawWords.length >= 2 &&
    /^đan$/iu.test(rawWords[rawWords.length - 1] || '')
  ) {
    const startsWithPoeticCultivationPrefix =
      XIANXIA_POETIC_NON_SURNAME_FIRST_RE.test(rawWords[0] || '');
    const startsWithRealSurname =
      rawWords.length >= 3 &&
      !startsWithPoeticCultivationPrefix &&
      ALL_PERSON_SURNAME_KEYS.has(tokens[0] || '');
    if (!startsWithRealSurname) {
      return true;
    }
  }

  // Trailing "Kỳ" after non-surname / realm-like prefix (e.g. "Luyện Khí Kỳ", "Trúc Cơ Kỳ", "Linh Kỳ")
  // Preserves surnamed names like "Lục Tuyết Kỳ"
  if (
    rawWords.length >= 2 &&
    /^kỳ$/iu.test(rawWords[rawWords.length - 1] || '') &&
    !ALL_PERSON_SURNAME_KEYS.has(tokens[0] || '')
  ) {
    return true;
  }

  // Poetic / elemental / cultivation non-surname 2-word phrases (e.g. "Linh Sơn", "Thanh Sương", "Bách Bảo", "Thanh Tùng", "Thanh Vân")
  if (
    rawWords.length === 2 &&
    XIANXIA_POETIC_NON_SURNAME_FIRST_RE.test(rawWords[0] || '') &&
    XIANXIA_WORLD_CONCEPT_END_RE.test(rawWords[1] || '')
  ) {
    return true;
  }

  // 3-to-4 word non-surname cultivation / poetic phrases containing world/item/technique terms
  // (e.g. "Ngưng Thần Tụ Linh", "Vạn Kiếm Quy Tông", "Cửu Thiên Huyền Lôi", "Thanh Bình Tiên Kiếm")
  if (
    rawWords.length >= 3 &&
    !ALL_PERSON_SURNAME_KEYS.has(tokens[0] || '') &&
    XIANXIA_POETIC_NON_SURNAME_FIRST_RE.test(rawWords[0] || '') &&
    XIANXIA_WORLD_CONCEPT_ANY_TOKEN_RE.test(cleaned)
  ) {
    return true;
  }

  // Single-word cultivation/world terms that are never standalone NPC names
  if (
    rawWords.length === 1 &&
    /^(?:kiếm|đao|phù|bùa|đan|dược|thạch|thảo|trận|tông|phường|tầng|cảnh|quyết|pháp|giáp|bào|đỉnh|lô|tùng|sương|linh|thiên|địa|huyền|thái|bách|vạn)$/iu.test(
      rawWords[0] || '',
    )
  ) {
    return true;
  }

  return false;
}

// Substring patterns that NEVER belong inside a real person's name
const STRICT_NON_PERSON_SUBSTRING_RE =
  /\b(?:nhom\s+chat|group\s+chat|khung\s+chat|phong\s+chat|doan\s+chat|kenh\s+chat|tin\s+nhan|mang\s+xa\s+hoi|dien\s+dan|cong\s+ty|tap\s+doan|to\s+chuc|entertainment|records|label|labels|agency|company|corporation|studios?|productions?|quan\s+ca\s+phe|quan\s+cafe|tiem\s+ca\s+phe|coffee\s+shop|nha\s+hang|khach\s+san|benh\s+vien|san\s+bay|cong\s+vien|truong\s+hoc|dai\s+hoc|bai\s+hat|ca\s+khuc|ban\s+nhac|playlist|music\s+video|livestream|kakaotalk|messenger|instagram|facebook|tiktok|telegram|discord|whatsapp|weverse|soundcloud|spotify|youtube|netflix|sm\s+town|smtown)\b/i;

// English org/venue/media tokens that disqualify multi-word candidates
const STRICT_NON_PERSON_CONTAINMENT_TOKENS = new Set([
  'entertainment',
  'records',
  'label',
  'labels',
  'agency',
  'company',
  'corp',
  'corporation',
  'inc',
  'ltd',
  'llc',
  'studio',
  'studios',
  'media',
  'production',
  'productions',
  'foundation',
  'institute',
  'association',
  'organization',
  'committee',
  'council',
  'department',
  'ministry',
  'federation',
  'cafe',
  'coffee',
  'bistro',
  'bakery',
  'restaurant',
  'hotel',
  'motel',
  'resort',
  'mall',
  'plaza',
  'tower',
  'building',
  'airport',
  'station',
  'hospital',
  'clinic',
  'university',
  'college',
  'academy',
  'campus',
  'office',
  'apartment',
  'condo',
  'dormitory',
  'rooftop',
  'basement',
  'garage',
  'playlist',
  'album',
  'soundtrack',
  'livestream',
  'podcast',
  'concert',
  'showcase',
  'fanmeeting',
  'chat',
  'messenger',
  'kakaotalk',
  'instagram',
  'tiktok',
  'facebook',
  'telegram',
  'discord',
  'whatsapp',
  'youtube',
  'spotify',
  'netflix',
  'weverse',
]);

// Vietnamese compass directions & geographic orientation / district phrases that are NEVER person names
const STRICT_VI_COMPASS_OR_GEO_EXACT_RE =
  /^(?:tây\s+nam|đông\s+nam|tây\s+bắc|đông\s+bắc|chính\s+đông|chính\s+tây|chính\s+nam|chính\s+bắc|bắc\s+nam|nam\s+bắc|đông\s+tây|tây\s+đông|đông\s+nam\s+á|đông\s+á|tây\s+á|nam\s+á|bắc\s+á|tây\s+âu|đông\s+âu|bắc\s+âu|nam\s+âu|bắc\s+mỹ|nam\s+mỹ|châu\s+á|châu\s+âu|châu\s+mỹ|châu\s+phi|châu\s+đại\s+dương|miền\s+bắc|miền\s+trung|miền\s+nam|bắc\s+bộ|trung\s+bộ|nam\s+bộ|tây\s+nguyên|phương\s+đông|phương\s+tây|bắc\s+cực|nam\s+cực|phía\s+(?:đông|tây|nam|bắc|trước|sau|trái|phải|trên|dưới|ngoài|trong|kia|này|ấy)|hướng\s+(?:đông|tây|nam|bắc|đông\s+bắc|đông\s+nam|tây\s+bắc|tây\s+nam)|sài\s+gòn|hà\s+nội|đà\s+nẵng|đà\s+lạt|nha\s+trang|phú\s+quốc|vũng\s+tàu|hải\s+phòng|cần\s+thơ|thảo\s+điền|phú\s+mỹ\s+hưng|hoàn\s+kiếm|tây\s+hồ|cầu\s+giấy|ba\s+đình|gangnam|hongdae|itaewon|myeongdong|apgujeong|cheongdam|hannam|seongsu|busan|incheon|jeju|shibuya|shinjuku|ginza|harajuku|osaka|kyoto|thượng\s+hải|quảng\s+châu|thâm\s+quyến|hàng\s+châu|thành\s+đô|trùng\s+khánh|nam\s+kinh|tây\s+an|tự\s+nhiên|đột\s+nhiên|bỗng\s+nhiên|bất\s+ngờ|hiển\s+nhiên|dĩ\s+nhiên|ngẫu\s+nhiên|tất\s+nhiên|thật\s+ra|thực\s+ra|vốn\s+dĩ|dường\s+như|hình\s+như|có\s+vẻ|gần\s+như|hầu\s+như|đôi\s+khi|thỉnh\s+thoảng|hôm\s+nay|hôm\s+qua|ngày\s+mai|bây\s+giờ|hiện\s+giờ|mới\s+đây|gần\s+đây|vừa\s+rồi|một\s+chút|một\s+lát|một\s+hồi|một\s+lúc|cả\s+hai|cả\s+ba|cả\s+đám|cả\s+nhóm|cả\s+phòng|mọi\s+người|ai\s+đó|ai\s+nấy|không\s+ai|chẳng\s+ai|ức\s+chế|ấm\s+ức|bức\s+bối|tức\s+tối|bực\s+bội|uất\s+ức|hậm\s+hực|cô\s+ấy|anh\s+ấy|cậu\s+ấy|chị\s+ấy|em\s+ấy|ông\s+ấy|bà\s+ấy|người\s+ấy|hắn\s+ấy|nàng\s+ấy|bọn\s+ấy|đứa\s+ấy|kẻ\s+ấy|anh\s+ta|cô\s+ta|hắn\s+ta|ông\s+ta|bà\s+ta|chúng\s+ta|chúng\s+tôi|chúng\s+mình|bọn\s+họ|bọn\s+mình|tụi\s+mình|tụi\s+nó|đám\s+đó|đám\s+này)$/iu;

// Vietnamese demonstratives, function words, pronouns, emotional/time junk tokens (diacritic-exact)
// that NEVER appear as a standalone word inside a real person's name (catches "Ức Ấy", "Lúc Ấy", "Sau Đó", "Ngu Nè", etc.)
const STRICT_VI_NON_NAME_TOKEN_RE =
  /(?:^|\s)(?:ấy|ức|này|nọ|kia|đó|đây|đấy|nhỉ|nhé|nha|nhở|nhá|nè|ơi|hả|hử|hở|hông|hem|kìa|kì|hen|há|hén|nghen|chứ|thôi|quá|lắm|hơi|rất|đang|đã|sẽ|vẫn|chưa|không|chẳng|đừng|hãy|cũng|đều|phải|được|bị|muốn|biết|thấy|nghe|nhìn|cười|khóc|giận|buồn|tức|bực|uất|mệt|đau|lúc|khi|hồi|chuyện|việc|điều|cái|chiếc|những|các|mọi|mỗi|từng|phía|hướng|miền|vùng|chỗ|bên|góc|nơi|bỗng|chợt|vốn|dường|tưởng|ngỡ|suýt|mãi|luôn|ngay|vừa|xong|hết|suốt|khắp|quanh|cạnh|trước|sau|trong|ngoài|giữa|trên|dưới|tại|bởi|vì|nếu|tuy|dù|nhưng|mà|thì|là|của|với|cùng|cho|đến|bọn|tụi|đứa|kẻ|hắn|gã|nàng|người|đám|lũ|thằng|hôm|tuần|tháng|giây|phút|giờ|buổi|bữa|dạo|đêm|trưa|chiều|tối|khuya|sao|thế|vậy|gì|đâu|nào|bức|bối|ấm|ngờ|đột|rồi|nữa|vào|lên|xuống)(?:\s|$)/iu;

// Vietnamese slang, playful insults, profanity, exclamations & short lyric hooks (diacritic-preserving so real names like Ngọc/Nguyên/Nghĩa are never hit)
const STRICT_VI_SLANG_OR_EXCLAMATION_RE =
  /(?:^|\s)(?:ngu|ngốc|đần|dốt|điên|khùng|dở|xàm|nhảm|chết|tiệt|khốn|kiếp|rác|bẩn|tởm|ghê|vãi|vkl|vcl|vl|đcm|đm|đéo|đếch|cút|câm|đồ|mày|tao|tau|ủa|ôi|ối|ái|eo|chà|trời|hừ|hứ|hơ|à|ừ|ờ|haha|hihi|huhu|kaka|hehe|hôhô|toang|xỉu|lụm|quẩy|cháy|xịn|phê|sướng|đỉnh|chửi|đùa|cười)(?:\s|$)/iu;

// English rap ad-libs, lyric hooks, slang & short exclamations that should NEVER become NPC names
const STRICT_EN_LYRIC_SLANG_TOKENS = new Set([
  'yeah', 'yea', 'yay', 'yo', 'hey', 'hi', 'hello', 'oh', 'ah', 'uh', 'ooh', 'aah',
  'woah', 'whoa', 'wow', 'wtf', 'omg', 'lmao', 'lmfao', 'lol', 'bruh', 'bro', 'dude',
  'bitch', 'fuck', 'shit', 'damn', 'hell', 'ass', 'skrrt', 'ayy', 'ayyy', 'nah',
  'nope', 'yep', 'yup', 'shh', 'hmm', 'huh', 'ugh', 'oops', 'ouch', 'bye', 'cya',
  'haha', 'hehe', 'hoho', 'baby', 'babe', 'shawty', 'homie', 'gang', 'yuh', 'aye',
  'ok', 'okay', 'oke', 'okey', 'dm', 'dcm', 'vl', 'vcl', 'vkl',
]);

// Vietnamese song-title / sentence-like words (diacritic-aware) that appear in titles like "Chạy Ngay Đi", "Nơi Này Có Anh", "Chúng Ta Của Hiện Tại"
const SONG_OR_PHRASE_FUNCTION_WORDS_RE =
  /(?:^|\s)(?:của|trong|ngoài|giữa|trên|dưới|với|cho|này|kia|ấy|ức|đây|đó|đấy|nè|nhé|nha|nhỉ|nhở|hả|kìa|ơi|không|chưa|đừng|hãy|nếu|khi|lúc|nhưng|rồi|vẫn|đang|đã|sẽ|có|chạy|ngay|đi|về|một|hai|ba|những|các|chúng|ta|tôi|em|mình|họ|ai|gì|đâu|sao|thế|vậy|hiện|tại|ngày|đêm|mưa|nắng|nơi|quán|tiệm|phòng|màu|nhóm)(?:\s|$)/iu;

/**
 * Returns true if a candidate NPC name is actually a song lyric snippet, short exclamation,
 * playful insult, slang expression, or repetitive chant (e.g. "Ngu Nè", "Trời Ơi", "Yeah Yeah", "Đồ Ngốc").
 */
export function isLyricOrExclamationJunkName(
  rawName: string,
  allowedKnownKeys?: Set<string>,
): boolean {
  const cleaned = String(rawName || '')
    .replace(/[*_`~#<>♪♫🎵🎶🎤]+/g, '')
    .replace(/^[\s"'“”‘’(\[.,!?;:–—-]+|[\s"'“”‘’.,!?;:)\[\]–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return true;
  if (/[♪♫🎵🎶🎤]/.test(String(rawName || ''))) return true;
  if (lookupKnownCelebrityProfile(cleaned)) return false;

  const key = normalizeCharacterKey(cleaned);
  if (!key) return true;

  // Hard reject Vietnamese slang / exclamations / sentence-ending particles (even if leaked into old saves)
  if (STRICT_VI_SLANG_OR_EXCLAMATION_RE.test(cleaned)) {
    return true;
  }

  // Reject ending Vietnamese exclamation particles on multi-word short phrases (e.g. "... Nè", "... Nha", "... Ơi", "... Đi", "... Thôi")
  const rawWords = cleaned.split(/\s+/).filter(Boolean);
  if (rawWords.length >= 2) {
    const lastRaw = rawWords[rawWords.length - 1] || '';
    if (
      /^(?:nè|nha|nhé|nhỉ|nhở|nhá|ơi|à|ừ|ờ|hả|hử|hở|kìa|đấy|đó|nào|chứ|thôi|luôn|đi|lên|xuống|vậy|sao|gì|đâu|quá|lắm|ghê|vãi|hen|há|hén|nghen)$/iu.test(
        lastRaw,
      )
    ) {
      return true;
    }
    const firstRaw = rawWords[0] || '';
    if (
      /^(?:đồ|thứ|con|thằng|bọn|tụi|ôi|ối|ủa|ơ|hả|ê|này|trời|chết|vãi|im|cút|biến|đừng|hãy|quẩy|cháy)$/iu.test(
        firstRaw,
      )
    ) {
      return true;
    }
  }

  // Reject identical repeated-word lyric chants (e.g. "Yeah Yeah", "Na Na", "Đi Đi", "Lên Lên")
  const normTokens = key.split(/\s+/).filter(Boolean);
  if (
    normTokens.length >= 2 &&
    normTokens.every((t) => t === normTokens[0]) &&
    !(allowedKnownKeys && allowedKnownKeys.has(key))
  ) {
    return true;
  }

  // Reject English rap ad-libs / exclamations / slang phrases (ASCII-only so accented Vietnamese names stay untouched)
  const hasViDiacritics = /[\u00C0-\u024F\u1E00-\u1EFF]/.test(cleaned);
  if (!hasViDiacritics && normTokens.length > 0) {
    if (
      normTokens.every((t) => STRICT_EN_LYRIC_SLANG_TOKENS.has(t)) ||
      (normTokens.length <= 3 &&
        normTokens.some((t) => STRICT_EN_LYRIC_SLANG_TOKENS.has(t)) &&
        !(allowedKnownKeys && allowedKnownKeys.has(key)))
    ) {
      return true;
    }
  }

  return false;
}

// Teasing / parody / meme prefixes & suffixes that users commonly attach when joking or nicknaming someone
const TEASING_PREFIX_TOKENS = new Set([
  'lil',
  'little',
  'big',
  'yung',
  'young',
  'mini',
  'baby',
  'fake',
  'phake',
  'bootleg',
  'temu',
  'wish',
  'evil',
  'dark',
  'super',
  'mega',
  'ultra',
  'lord',
  'sir',
  'king',
  'queen',
  'boss',
  'chief',
  'bro',
  'homie',
  'daddy',
  'mommy',
  'mama',
  'papa',
  'thanh',
  'trum',
  'vua',
  'chua',
  'sieu',
  'be',
  'lao',
]);

const TEASING_MULTI_WORD_PREFIX_RE =
  /^(?:ông\s+hoàng|bà\s+hoàng|nữ\s+hoàng|ông\s+nội|bà\s+nội|đại\s+ca|sư\s+phụ|bố\s+già|chị\s+đại|anh\s+hai|pha\s+ke|bản\s+lỗi|phiên\s+bản|dollar\s+store|wish\s+dot\s+com|con\s+nhà)\s+/iu;

const TEASING_OR_MEME_SUFFIX_TOKENS = new Set([
  'deep',
  'meme',
  'troll',
  'clown',
  'fake',
  'phake',
  'flop',
  'simp',
  'cringe',
  'delulu',
  'skibidi',
  'sigma',
  'rizz',
  'gyatt',
  'noob',
  'bot',
  'npc',
  'pro',
  'max',
  'plus',
  'vip',
  'bro',
  'boy',
  'boi',
  'dawg',
  'dog',
  'ngao',
  'lay',
  'bua',
  'mom',
  'luon',
  'phen',
  'sen',
  'he',
  'nhay',
  'treu',
  'che',
  'dua',
  'ngo',
  'beo',
  'lun',
  'map',
  'sun',
  'hoi',
  'khung',
  'dien',
  'ga',
  'ngoc',
]);

const STRICT_VI_TEASING_OR_MEME_RE =
  /(?:^|\s)(?:pha\s+ke|vô\s+tri|xà\s+lơ|trẻ\s+trâu|ảo\s+ma|bá\s+đạo|dở\s+hơi|ngáo\s+đá|ngáo|lầy|bựa|mõm|lươn|phèn|sến|hề|nhây|troll|meme|clown|cringe|delulu|skibidi|sigma|rizz|gyatt|noob|phake|elordeep)(?:\s|$)/iu;

const PARODY_ENGLISH_SUFFIX_RE =
  /(?:deep|inator|zilla|dawg|boyz|ster|tard|lord|master|king|queen|bro|boi)$/i;

const VIET_COMMON_SURNAME_SET = new Set([
  'nguyen',
  'tran',
  'le',
  'pham',
  'hoang',
  'huynh',
  'phan',
  'vu',
  'vo',
  'dang',
  'bui',
  'do',
  'ho',
  'ngo',
  'duong',
  'ly',
  'truong',
  'dinh',
  'lam',
  'dao',
  'doan',
  'vuong',
  'trinh',
  'cao',
  'thai',
  'luong',
  'ta',
  'mai',
  'chu',
  'la',
  'kieu',
  'phung',
  'bach',
  'han',
  'luc',
  'co',
  'ton',
  'to',
  'mac',
]);

function computeLevenshteinDistance(a: string, b: string): number {
  const s = a || '';
  const t = b || '';
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const sc = s.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

function commonPrefixLength(a: string, b: string): number {
  const lim = Math.min(a.length, b.length);
  let i = 0;
  while (i < lim && a.charCodeAt(i) === b.charCodeAt(i)) i += 1;
  return i;
}

function stripEnglishDiminutiveEnding(token: string): string {
  const t = token.toLowerCase();
  if (t.length < 4) return t;
  // Handle doubled-consonant diminutives like "timmy" -> "tim", "jenny" -> "jen", "kenny" -> "ken", "benny" -> "ben"
  const doubled = t.match(/^([a-z]{3,})([bcdfghjklmnpqrstvwxz])\2(?:y|ie|ey)$/i);
  if (doubled && doubled[1].length >= 2) {
    return `${doubled[1]}${doubled[2]}`;
  }
  const simple = t.replace(/(?:ie|ey|sy|zy|my|ny|ee|er|y|o)$/i, '');
  return simple.length >= 3 ? simple : t;
}

function areTokensPunOrDiminutiveSimilar(candTok: string, canonTok: string): boolean {
  const a = candTok.toLowerCase();
  const b = canonTok.toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;

  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);
  const pref = commonPrefixLength(a, b);

  // Strong shared prefix (e.g. "elordeep" vs "elordi" -> pref=5 "elord"; "swifty" vs "swift" -> pref=5)
  if (pref >= 4 && pref / minLen >= 0.65) {
    return true;
  }

  // Diminutive stem match (e.g. "timmy" -> "tim" matches "timothee"; "kendy" -> "kend" matches "kendall"; "leo" matches "leonardo")
  const stemA = stripEnglishDiminutiveEnding(a);
  const stemB = stripEnglishDiminutiveEnding(b);
  if (
    stemA.length >= 3 &&
    (b.startsWith(stemA) || (stemB.length >= 3 && stemA === stemB))
  ) {
    return true;
  }
  if (a.length >= 3 && a.length <= 5 && b.length >= a.length + 2 && b.startsWith(a)) {
    return true;
  }

  // Edit distance similarity for puns/typos (e.g. "elordeep" vs "elordi", "chalameme" vs "chalamet")
  if (minLen >= 5) {
    const dist = computeLevenshteinDistance(a, b);
    const sim = 1 - dist / maxLen;
    if (pref >= 3 && (dist <= 3 || sim >= 0.58)) {
      return true;
    }
    if (dist <= 2 && sim >= 0.72) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if a candidate NPC name looks like a playful teasing nickname, meme/parody pun,
 * or joke modifier (e.g. "Lil Timmy", "Jacob Elordeep", "Thánh Lầy", "Fake Drake", "Khang Ngáo")
 * rather than a genuine character name. Known roster entries & real celebrities are exempted.
 */
export function isPlayfulTeasingOrParodyName(
  rawName: string,
  allowedKnownKeys?: Set<string>,
): boolean {
  const cleaned = String(rawName || '')
    .replace(/[*_`~#<>]+/g, '')
    .replace(/^[\s"'“”‘’(\[.,!?;:–—-]+|[\s"'“”‘’.,!?;:)\[\]–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return false;
  const key = normalizeCharacterKey(cleaned);
  if (!key) return false;

  if (allowedKnownKeys && allowedKnownKeys.has(key)) return false;
  if (isExplicitCharacterDesignation(cleaned)) return false;
  const celebProfile = lookupKnownCelebrityProfile(cleaned);
  if (
    celebProfile &&
    normalizeCharacterKey(celebProfile.canonicalName) === key
  ) {
    return false;
  }

  if (STRICT_VI_TEASING_OR_MEME_RE.test(cleaned)) {
    return true;
  }
  if (TEASING_MULTI_WORD_PREFIX_RE.test(cleaned)) {
    return true;
  }

  const tokens = key.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const firstTok = tokens[0];
    const lastTok = tokens[tokens.length - 1];
    // Reject teasing/meme prefixes like "Lil Timmy", "Big Leo", "Fake Kim", "Thánh X", "Trùm X", "Bé X"
    // (Guard: "be" in Vietnamese shouldn't hit valid names unless lowercase-normalized "be" with diacritic "bé" or English "baby")
    if (
      TEASING_PREFIX_TOKENS.has(firstTok) &&
      (firstTok !== 'be' || /^bé\s+/iu.test(cleaned)) &&
      (firstTok !== 'lao' || /^lão\s+/iu.test(cleaned)) &&
      (firstTok !== 'thanh' || /^thánh\s+/iu.test(cleaned)) &&
      (firstTok !== 'trum' || /^trùm\s+/iu.test(cleaned)) &&
      (firstTok !== 'chua' || /^chúa\s+/iu.test(cleaned)) &&
      (firstTok !== 'sieu' || /^siêu\s+/iu.test(cleaned))
    ) {
      return true;
    }

    // Reject teasing/meme trailing tokens like "Khang Ngáo", "Jacob Deep", "Minh Mõm", "Tuấn Béo"
    if (
      TEASING_OR_MEME_SUFFIX_TOKENS.has(lastTok) &&
      (lastTok !== 'he' || /\shề$/iu.test(cleaned)) &&
      (lastTok !== 'che' || /\schế$/iu.test(cleaned)) &&
      (lastTok !== 'dua' || /\sđùa$/iu.test(cleaned)) &&
      (lastTok !== 'treu' || /\strêu$/iu.test(cleaned)) &&
      (lastTok !== 'mom' || /\smõm$/iu.test(cleaned)) &&
      (lastTok !== 'ngo' || /\sngơ$/iu.test(cleaned)) &&
      (lastTok !== 'ga' || /\sgà$/iu.test(cleaned)) &&
      (lastTok !== 'hoi' || /\shói$/iu.test(cleaned)) &&
      (lastTok !== 'sun' || /\ssún$/iu.test(cleaned)) &&
      (lastTok !== 'beo' || /\sbéo$/iu.test(cleaned)) &&
      (lastTok !== 'map' || /\smập$/iu.test(cleaned)) &&
      (lastTok !== 'lun' || /\slùn$/iu.test(cleaned)) &&
      (lastTok !== 'sen' || /\ssến$/iu.test(cleaned)) &&
      (lastTok !== 'phen' || /\sphèn$/iu.test(cleaned)) &&
      (lastTok !== 'luon' || /\slươn$/iu.test(cleaned)) &&
      (lastTok !== 'nhay' || /\snhây$/iu.test(cleaned)) &&
      (lastTok !== 'lay' || /\slầy$/iu.test(cleaned)) &&
      (lastTok !== 'bua' || /\sbựa$/iu.test(cleaned)) &&
      (lastTok !== 'ngao' || /\sngáo$/iu.test(cleaned))
    ) {
      return true;
    }

    // Reject English parody/pun surname endings like "Jacob Elordeep", "Timmy Chalamaster", "Kardashinator"
    const hasViDiacritics = /[\u00C0-\u024F\u1E00-\u1EFF]/.test(cleaned);
    if (
      !hasViDiacritics &&
      lastTok.length >= 6 &&
      PARODY_ENGLISH_SUFFIX_RE.test(lastTok)
    ) {
      return true;
    }
  } else if (tokens.length === 1) {
    const only = tokens[0];
    if (TEASING_OR_MEME_SUFFIX_TOKENS.has(only) && only.length >= 4) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether `candidateName` is a playful teasing name, spelling pun, diminutive, or nickname
 * variant of `canonicalName` (e.g. "Jacob Elordeep" -> "Jacob Elordi", "Lil Timmy" -> "Timothée Chalamet",
 * "Cench" -> "Central Cee", "Khang Ngáo" -> "Nguyễn Minh Khang").
 */
export function isTeasingOrSpellingVariantOf(
  candidateName: string,
  canonicalName: string,
): boolean {
  const candClean = String(candidateName || '').trim();
  const canonClean = String(canonicalName || '').trim();
  if (!candClean || !canonClean) return false;

  const candKey = normalizeCharacterKey(candClean);
  const canonKey = normalizeCharacterKey(canonClean);
  if (!candKey || !canonKey) return false;
  if (candKey === canonKey) return true;

  // Check celebrity / builtin alias identity first
  const candCeleb = lookupKnownCelebrityProfile(candClean);
  const canonCeleb = lookupKnownCelebrityProfile(canonClean);
  if (candCeleb && canonCeleb && candCeleb.canonicalName === canonCeleb.canonicalName) {
    return true;
  }

  const candTokens = candKey.split(/\s+/).filter(Boolean);
  const canonTokens = canonKey.split(/\s+/).filter(Boolean);
  if (!candTokens.length || !canonTokens.length) return false;

  // Strip teasing/nickname prefix or suffix from candidate to reveal core name
  const strippedCandTokens = [...candTokens];
  let strippedAnyTeasing = false;
  if (
    strippedCandTokens.length >= 2 &&
    TEASING_PREFIX_TOKENS.has(strippedCandTokens[0])
  ) {
    strippedCandTokens.shift();
    strippedAnyTeasing = true;
  }
  if (
    strippedCandTokens.length >= 2 &&
    TEASING_OR_MEME_SUFFIX_TOKENS.has(
      strippedCandTokens[strippedCandTokens.length - 1],
    )
  ) {
    strippedCandTokens.pop();
    strippedAnyTeasing = true;
  }

  // Case 1: Teasing prefix/suffix + core/diminutive match (e.g. "Lil Timmy" -> "Timothée Chalamet", "Khang Ngáo" -> "Nguyễn Minh Khang")
  if (strippedAnyTeasing && strippedCandTokens.length >= 1) {
    const coreStr = strippedCandTokens.join(' ');
    if (
      coreStr === canonKey ||
      canonTokens.some((ct) => ct.length >= 3 && strippedCandTokens.includes(ct)) ||
      strippedCandTokens.every((st) =>
        canonTokens.some((ct) => areTokensPunOrDiminutiveSimilar(st, ct)),
      )
    ) {
      return true;
    }
  }

  // Case 2: Multi-word candidate vs multi-word canonical with shared first/given name + punned/mutated other token
  // e.g. "Jacob Elordeep" vs "Jacob Elordi", "Kendall Jennerd" vs "Kendall Jenner", "Nguyễn Minh Khùng" vs "Nguyễn Minh Khang"
  if (candTokens.length >= 2 && canonTokens.length >= 2) {
    const firstSame = candTokens[0] === canonTokens[0] && candTokens[0].length >= 3;
    const lastCand = candTokens[candTokens.length - 1];
    const lastCanon = canonTokens[canonTokens.length - 1];

    if (firstSame && !VIET_COMMON_SURNAME_SET.has(candTokens[0])) {
      if (areTokensPunOrDiminutiveSimilar(lastCand, lastCanon)) {
        return true;
      }
      // Same distinctive first name + teasing/parody last token (e.g. "Jacob Elordeep", "Taylor Swifty")
      if (
        PARODY_ENGLISH_SUFFIX_RE.test(lastCand) &&
        commonPrefixLength(lastCand, lastCanon) >= 3
      ) {
        return true;
      }
    }

    // Vietnamese 3-word name with same surname + middle name and punned given name (or vice versa)
    if (
      candTokens.length === 3 &&
      canonTokens.length === 3 &&
      candTokens[0] === canonTokens[0] &&
      candTokens[1] === canonTokens[1] &&
      (areTokensPunOrDiminutiveSimilar(lastCand, lastCanon) ||
        TEASING_OR_MEME_SUFFIX_TOKENS.has(lastCand))
    ) {
      return true;
    }

    // Shared distinctive surname (non-Viet common) + diminutive/punned first name (e.g. "Timmy Chalamet" -> "Timothée Chalamet")
    if (
      lastCand === lastCanon &&
      lastCand.length >= 4 &&
      !VIET_COMMON_SURNAME_SET.has(lastCand) &&
      areTokensPunOrDiminutiveSimilar(candTokens[0], canonTokens[0])
    ) {
      return true;
    }
  }

  // Case 3: Single-word diminutive or pun of a known multi-word character (e.g. "Timmy" -> "Timothée Chalamet", "Elordeep" -> "Jacob Elordi")
  if (candTokens.length === 1 && candTokens[0].length >= 4) {
    const single = candTokens[0];
    const isVietCanon =
      canonTokens.length >= 2 && VIET_COMMON_SURNAME_SET.has(canonTokens[0]);
    const targetTokens = isVietCanon
      ? [canonTokens[canonTokens.length - 1]]
      : canonTokens;
    for (const ct of targetTokens) {
      if (ct.length < 4) continue;
      if (areTokensPunOrDiminutiveSimilar(single, ct)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Finds the best matching canonical character name from `canonicalPool` if `candidateName`
 * is a teasing nickname, pun, diminutive, or alias variant of an existing character.
 */
export function findCanonicalVariantMatch(
  candidateName: string,
  canonicalPool: Iterable<string>,
): string | null {
  const cleanCand = String(candidateName || '').trim();
  if (!cleanCand || cleanCand.length < 2) return null;
  const candKey = normalizeCharacterKey(cleanCand);
  if (!candKey) return null;

  const candId = collectCharacterIdentityKeys(cleanCand);
  let bestMatch: string | null = null;
  let bestScore = -1;

  for (const rawCanon of canonicalPool) {
    const canon = String(rawCanon || '').trim();
    if (!canon) continue;
    const canonKey = normalizeCharacterKey(canon);
    if (!canonKey || canonKey === candKey) continue;
    // Never map a clean name onto a teasing/parody name
    if (isPlayfulTeasingOrParodyName(canon)) continue;

    const canonId = collectCharacterIdentityKeys(canon);
    const isShadow = areIdentityKeysShadowMatch(candId.aliasKeys, canonId.aliasKeys);
    const isVariant = isShadow || isTeasingOrSpellingVariantOf(cleanCand, canon);
    if (!isVariant) continue;

    const score =
      (isShadow ? 20 : 10) +
      (lookupKnownCelebrityProfile(canon) ? 8 : 0) +
      (canon.includes(' ') ? 5 : 0) +
      Math.min(5, canon.length / 4);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = canon;
    }
  }

  return bestMatch;
}

/**
 * Extracts explicit teasing / joking nickname assignments from prose or user input
 * (e.g. `gọi trêu Jacob Elordi là "Jacob Elordeep"`, `chế tên Timothée thành Lil Timmy`, `gọi đùa là "Cench"`).
 */
export function extractTeasingNicknamePairsFromText(
  text: string,
): Array<{ canonical?: string; nickname: string }> {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  const results: Array<{ canonical?: string; nickname: string }> = [];
  const seen = new Set<string>();

  const push = (nicknameRaw?: string | null, canonicalRaw?: string | null) => {
    const nick = String(nicknameRaw ?? '')
      .replace(/^[\s"'“”‘’«»()\[\]]+|[\s"'“”‘’«»()\[\].,!?;:]+$/g, '')
      .trim();
    if (!nick || nick.length < 2 || nick.length > 36) return;
    const canon = canonicalRaw
      ? String(canonicalRaw)
          .replace(/^[\s"'“”‘’«»()\[\]]+|[\s"'“”‘’«»()\[\].,!?;:]+$/g, '')
          .trim()
      : undefined;
    const nk = normalizeCharacterKey(nick);
    const ck = canon ? normalizeCharacterKey(canon) : '';
    if (!nk || (ck && ck === nk)) return;
    const sig = `${ck}::${nk}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    results.push({ ...(canon ? { canonical: canon } : {}), nickname: nick });
  };

  // Pattern 1: "gọi trêu / gọi đùa / trêu / chế tên / đặt biệt danh [Canonical] là/thành [Nickname]"
  const pairedRe =
    /(?:gọi\s+trêu|gọi\s+đùa|gọi\s+chế|gọi\s+tắt|trêu(?:\s+chọc)?|chế\s+tên|đổi\s+tên|đặt\s+biệt\s+danh(?:\s+cho)?|hay\s+gọi|cứ\s+gọi)\s+(?:(?:anh|chị|cô|cậu|ông|bà|em|hắn|nàng|tên|gã)\s+)?([\p{Lu}][\p{L}'’-]{1,18}(?:\s+[\p{Lu}][\p{L}'’-]{1,18}){0,3})\s+(?:là|thành|bằng(?:\s+tên)?|kiểu)\s+["“«']?([\p{Lu}][\p{L}\p{N}'’-]{1,20}(?:\s+[\p{Lu}\p{L}][\p{L}\p{N}'’-]{1,20}){0,2})["”»']?/gu;
  let m: RegExpExecArray | null;
  while ((m = pairedRe.exec(raw)) !== null) {
    push(m[2], m[1]);
  }

  // Pattern 2: "gọi (anh/cô/hắn/cậu/nó/tên đó/người ta) là/thành [Quoted/Capitalized Nickname]" or "biệt danh [Nickname]"
  const standaloneRe =
    /(?:gọi\s+(?:trêu|đùa|chế|tắt)\s+(?:(?:anh|chị|cô|cậu|ông|bà|em|hắn|nàng|nó|y|họ|tên\s+(?:đó|này|kia)|người\s+(?:đó|này|kia))\s+)?(?:là|thành)|(?:trêu|đùa|chế)\s+(?:gọi|là|thành)|(?:đặt\s+)?biệt\s+danh(?:\s+(?:trêu|đùa|mới))?\s*(?:là|:)?)\s*["“«']?([\p{Lu}][\p{L}\p{N}'’-]{1,20}(?:\s+[\p{Lu}\p{L}][\p{L}\p{N}'’-]{1,20}){0,2})["”»']?/gu;
  while ((m = standaloneRe.exec(raw)) !== null) {
    push(m[1], undefined);
  }

  return results;
}

// Pattern for detached stage-name / rapper-tag tokens like "Low G", "Big T", "Lil K", "MC K", "DJ X"
const DETACHED_STAGE_NAME_PATTERN_RE =
  /^(?:(?:low|big|lil|young|yung|kid|mc|dj|mr|ms|dr|king|queen|ice|bad|mad|hot|old|new|raw|real|rich|baby|sad|dark|black|white|red|blue|pink|gold|silver)\s+[A-Za-z0-9]{1,3}|[A-Za-z]{2,10}\s+[A-Z0-9]|(?:[A-Z]\s+){1,2}[A-Z])$/i;

// Pure uppercase acronyms like "SM", "YG", "JYP", "HYBE", "MV", "CEO", "VTV"
const PURE_ACRONYM_RE = /^[A-Z0-9&]{2,6}$/;

// Known detached stage names / artist aliases that should NOT auto-spawn as independent NPCs unless explicitly in roster
const KNOWN_DETACHED_STAGE_ALIAS_KEYS = new Set([
  'low g',
  'mck',
  'rpt mck',
  'tlinh',
  'obito',
  'wxrdie',
  'wrxdie',
  'binz',
  'justatee',
  'rhymastic',
  'soobin',
  'karik',
  'suboi',
  'bray',
  'b ray',
  'den vau',
  'hieuthuhai',
  'hurrykng',
  'negav',
  'manbo',
  'andree',
  'andree right hand',
  'sol7',
  '16 typh',
  'dế choắt',
  'de choat',
  'gducky',
  'gd',
  'g dragon',
  'rm',
  'suga',
  'v',
  'iu',
  'cl',
  'bi rain',
  'psy',
  'zico',
  'jay park',
  'dean',
  'crush',
  'loco',
  'gray',
  'dprian',
  'dpr ian',
  'dpr live',
]);

// Known real-name <-> stage-name canonical pairs so they merge instead of duplicating if one is in the active roster
const BUILTIN_ALIAS_GROUPS: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'Nguyễn Hoàng Long', aliases: ['low g'] },
  { canonical: 'Jang Wonyoung', aliases: ['wonyoung', 'jang won young', 'won young'] },
  { canonical: 'An Yujin', aliases: ['yujin', 'ahn yujin', 'an yu jin'] },
  { canonical: 'Yoo Jimin', aliases: ['karina', 'yu jimin'] },
  { canonical: 'Kim Minjeong', aliases: ['winter', 'kim min jeong'] },
  { canonical: 'Ning Yizhuo', aliases: ['ningning'] },
  { canonical: 'Uchinaga Aeri', aliases: ['giselle'] },
  { canonical: 'Kim Jisoo', aliases: ['jisoo'] },
  { canonical: 'Park Chaeyoung', aliases: ['rose', 'rosé', 'chaeyoung'] },
  { canonical: 'Lalisa Manobal', aliases: ['lisa', 'lalisa'] },
  { canonical: 'Kim Taeyeon', aliases: ['taeyeon'] },
  { canonical: 'Bae Joohyun', aliases: ['irene'] },
  { canonical: 'Kang Seulgi', aliases: ['seulgi'] },
  { canonical: 'Son Seungwan', aliases: ['wendy'] },
  { canonical: 'Park Sooyoung', aliases: ['joy'] },
  { canonical: 'Kim Yerim', aliases: ['yeri'] },
  { canonical: 'Minji', aliases: ['kim minji', 'kim min ji'] },
  { canonical: 'Hanni', aliases: ['pham ngoc han', 'hanni pham'] },
  { canonical: 'Danielle', aliases: ['danielle marsh', 'mo jihye'] },
  { canonical: 'Haerin', aliases: ['kang haerin'] },
  { canonical: 'Hyein', aliases: ['lee hyein'] },
  { canonical: 'Sakura', aliases: ['miyawaki sakura'] },
  { canonical: 'Kim Chaewon', aliases: ['chaewon'] },
  { canonical: 'Huh Yunjin', aliases: ['yunjin'] },
  { canonical: 'Kazuha', aliases: ['nakamura kazuha'] },
  { canonical: 'Hong Eunchae', aliases: ['eunchae'] },
  { canonical: 'Nghiêm Vũ Hoàng Long', aliases: ['mck', 'rpt mck', 'nger'] },
  { canonical: 'Nguyễn Thảo Linh', aliases: ['tlinh'] },
  { canonical: 'Trần Minh Hiếu', aliases: ['hieuthuhai'] },
  { canonical: 'Lê Nguyễn Trung Đan', aliases: ['binz'] },
  { canonical: 'Nguyễn Đức Cường', aliases: ['den vau', 'đen vâu'] },
  { canonical: 'Nguyễn Thanh Tùng', aliases: ['son tung', 'son tung m tp', 'son tung mtp', 'm tp'] },
];

const BUILTIN_ALIAS_TO_CANONICAL_KEY = new Map<string, string>();
for (const grp of BUILTIN_ALIAS_GROUPS) {
  const canonKey = normalizeCharacterKey(grp.canonical);
  if (!canonKey) continue;
  BUILTIN_ALIAS_TO_CANONICAL_KEY.set(canonKey, canonKey);
  for (const a of grp.aliases) {
    const ak = normalizeCharacterKey(a);
    if (ak) BUILTIN_ALIAS_TO_CANONICAL_KEY.set(ak, canonKey);
  }
}

/**
 * Strips parenthetical alias tags from a character name while returning any extracted aliases.
 * Example: "Nguyễn Hoàng Long (Low G)" -> { baseName: "Nguyễn Hoàng Long", aliases: ["Low G"] }
 */
export function splitNameAndParentheticalAliases(rawName: string): {
  baseName: string;
  aliases: string[];
} {
  const raw = String(rawName || '').trim();
  const aliases: string[] = [];
  const baseName = raw
    .replace(/\s*\(([^()]{1,36})\)\s*/g, (_m, inner: string) => {
      const cleanedInner = String(inner || '')
        .replace(/^(?:nghệ\s+danh|biệt\s+danh|tên\s+thật|tên\s+khác|aka|a\.k\.a\.?|hay\s+gọi\s+là)\s*[:\-]?\s*/iu, '')
        .trim();
      if (cleanedInner && cleanedInner.length >= 2) {
        aliases.push(cleanedInner);
      }
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { baseName: baseName || raw, aliases };
}

/**
 * Returns true if the given string describes a non-person entity (chat group, messaging app,
 * organization, venue/location, color, song/work) rather than a human character.
 */
export function isChatOrNonPersonDescription(rawText?: string): boolean {
  const raw = String(rawText || '').trim();
  if (!raw) return false;
  const norm = normalizeCharacterKey(raw);
  if (!norm) return false;

  if (
    /^(?:nhom\s+chat|group\s+chat|khung\s+chat|phong\s+chat|kenh\s+chat|kenh\s+nhan\s+tin|tin\s+nhan|tin\s+nhan\s+nhom|ung\s+dung\s+nhan\s+tin|mang\s+xa\s+hoi|dien\s+dan|cong\s+ty(?:\s+giai\s+tri)?|tap\s+doan|to\s+chuc|nhan\s+hang|thuong\s+hieu|dia\s+diem|dia\s+danh|quan\s+ca\s+phe|quan\s+cafe|nha\s+hang|khach\s+san|bai\s+hat|ca\s+khuc|ban\s+nhac|tac\s+pham|mau\s+sac|tong\s+mau|nhom\s+nhac|he\s+thong|thong\s+bao|canh\s+gioi|canh\s+gioi\s+tu\s+luyen|cong\s+phap|chieu\s+thuc|tam\s+phap|phap\s+bao|phap\s+khi|linh\s+khi|dan\s+duoc|linh\s+dan|phu\s+luc|bua\s+chu|vat\s+pham|vat\s+pham\s+tu\s+tien|linh\s+thach|linh\s+thao|phuong\s+thi|tong\s+mon|dong\s+phu|bi\s+canh|tran\s+phap)$/i.test(
      norm,
    )
  ) {
    return true;
  }

  // Explicit description phrasing treating the entry itself as a chat group / app / place / company / song / cultivation item/realm/technique
  if (
    /(?:^|(?:la|thuoc\s+loai|day\s+la)\s+)(?:mot\s+)?(?:loai\s+|mon\s+|thanh\s+|vien\s+|la\s+|tam\s+|bo\s+|cuon\s+|khu\s+)?(?:nhom\s+chat|group\s+chat|khung\s+chat|phong\s+chat|kenh\s+chat|kenh\s+nhan\s+tin|cuoc\s+tro\s+chuyen\s+nhom|ung\s+dung\s+nhan\s+tin|cong\s+ty\s+giai\s+tri|hang\s+giai\s+tri|tap\s+doan\s+giai\s+tri|dia\s+diem(?:\s+hen)?|dia\s+danh|quan\s+ca\s+phe|bai\s+hat\s+cua|ca\s+khuc\s+cua|tong\s+mau|mau\s+sac|canh\s+gioi(?:\s+tu\s+luyen)?|cong\s+phap|chieu\s+thuc|tam\s+phap|phap\s+bao|phap\s+khi|linh\s+kiem|phi\s+kiem|tien\s+kiem|dan\s+duoc|linh\s+dan|phu\s+luc|bua\s+chu|vat\s+pham(?:\s+tu\s+tien)?|linh\s+thach|linh\s+thao|phuong\s+thi|tong\s+mon|dong\s+phu|bi\s+canh|ngon\s+nui|khu\s+rung|cay\s+co\s+thu)\b/i.test(
      norm,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Sanitizes an NPC profile/state text field so 'nhóm chat' or non-person labels are never assigned as an NPC description.
 */
export function sanitizeNpcFieldText(
  field: 'role' | 'appearance' | 'personality' | 'location' | 'status' | 'mood' | 'relationships' | 'signature' | 'fashionStyle',
  rawValue?: string,
): string {
  const val = String(rawValue || '').replace(/\s+/g, ' ').trim();
  if (!val) return '';

  const norm = normalizeCharacterKey(val);
  if (!norm) return '';

  if (field === 'location') {
    // Physical venues like "Quán cà phê", "Nhà hàng", "Phòng thu" are valid locations for a human NPC;
    // only reject chat-group / messaging-screen pseudo-locations.
    if (
      /^(?:trong\s+|o\s+|tai\s+)?(?:nhom\s+chat|group\s+chat|khung\s+chat|phong\s+chat|kenh\s+chat|tin\s+nhan(?:\s+nhom)?|dien\s+thoai|man\s+hinh(?:\s+dien\s+thoai)?|zalo|kakaotalk|messenger|instagram|tiktok)\b/i.test(
        norm,
      )
    ) {
      return '';
    }
    return val;
  }

  if (isChatOrNonPersonDescription(val)) return '';

  if (
    (field === 'role' || field === 'appearance' || field === 'personality' || field === 'fashionStyle') &&
    /\b(?:nhom\s+chat|group\s+chat|khung\s+chat|phong\s+chat|kenh\s+nhan\s+tin|man\s+hinh\s+tin\s+nhan)\b/i.test(
      norm,
    )
  ) {
    return '';
  }

  return val;
}

export function sanitizeCharacterName(
  rawName: string,
  allowedKnownKeys?: Set<string>,
  extraBlockedKeys?: Set<string>,
): string | null {
  let name = String(rawName || '')
    .replace(/[*_`~#<>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Handle parenthetical aliases like "Nguyễn Hoàng Long (Low G)" BEFORE stripping outer punctuation/brackets
  if (name.includes('(') && name.includes(')')) {
    const { baseName } = splitNameAndParentheticalAliases(name);
    if (baseName && baseName !== name && !/[()\[\]{}]/.test(baseName)) {
      name = baseName;
    }
  }

  name = name
    .replace(/^[\s"'“”‘’(\[.,!?;:–—-]+|[\s"'“”‘’.,!?;:)\[\]–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.length < 2 || name.length > 42) return null;

  // Reject anything containing internal line breaks, brackets, slashes, or sentence punctuation
  if (/[\r\n()\[\]{};:!?/\\|@#$%^&*+=~]/.test(name)) {
    // Allow explicit "$" only for stage names like A$AP Rocky or known roster entries
    const keyTry = normalizeCharacterKey(name);
    const isDollarStage = /^[A-Z]\$[A-Z]{2,}(?:\s+[A-Z][\p{Ll}]+)?$/u.test(name);
    if (!isDollarStage && !(allowedKnownKeys && allowedKnownKeys.has(keyTry))) {
      return null;
    }
  }

  // Reject contractions anywhere in the candidate
  if (CONTRACTION_RE.test(name.replace(/[’`]/g, "'"))) {
    return null;
  }

  // Reject internal period unless it's a clean single-letter initial like "J. Cole" or "A.J."
  if (name.includes('.')) {
    const validInitialsOnly = name
      .split(/\s+/)
      .every(
        (tok) =>
          !tok.includes('.') ||
          /^[A-Z]\.(?:[A-Z]\.)?$/.test(tok) ||
          /^(?:Jr|Sr|St|Mr|Ms|Dr)\.$/i.test(tok),
      );
    if (!validInitialsOnly) return null;
  }

  // Strip English possessive suffix 's / ’s at the end (e.g. "Kendall Jenner's" -> "Kendall Jenner")
  name = name.replace(/(?:'s|’s)$/i, '').trim();
  if (!name || name.length < 2) return null;

  const key = normalizeCharacterKey(name);
  if (!key) return null;

  const isExplicitDesignation = isExplicitCharacterDesignation(name);

  // Hard reject blatantly non-person entities (including Xianxia realms/places/items/pills/talismans/techniques),
  // lyrics, slang & short exclamations even before whitelist
  // (protects against dirty companion rosters & legacy saves containing items like "Linh Đan", "Luyện Khí", "Ngu Nè")
  if (
    JUNK_EXACT_PHRASES.has(key) ||
    STRICT_NON_PERSON_SUBSTRING_RE.test(key) ||
    (!isExplicitDesignation && STRICT_VI_NON_PERSON_PREFIX_RE.test(name)) ||
    STRICT_VI_COMPASS_OR_GEO_EXACT_RE.test(name) ||
    STRICT_VI_NON_NAME_TOKEN_RE.test(name) ||
    isLyricOrExclamationJunkName(name) ||
    isChatOrNonPersonDescription(name) ||
    isNonPersonCultivationOrWorldTerm(name, extraBlockedKeys)
  ) {
    return null;
  }

  // Explicit whitelist: known roster names or known celebrities pass after hard non-person guard
  if (allowedKnownKeys && allowedKnownKeys.has(key)) {
    return name;
  }
  const celeb = lookupKnownCelebrityProfile(name);
  if (celeb) {
    return celeb.canonicalName;
  }

  // Reject pure numbers or strings with digits (except known stage names already matched)
  if (/^\d+$/.test(name) || /\d/.test(name)) return null;

  // Reject unknown pure all-caps acronyms (e.g. "SM", "YG", "JYP", "HYBE", "CEO", "MV", "OST", "CLB")
  if (PURE_ACRONYM_RE.test(name)) return null;

  // Reject detached stage names / rapper tags & playful teasing/parody names unless explicitly in allowedKnownKeys
  if (
    KNOWN_DETACHED_STAGE_ALIAS_KEYS.has(key) ||
    DETACHED_STAGE_NAME_PATTERN_RE.test(name) ||
    isPlayfulTeasingOrParodyName(name, allowedKnownKeys)
  ) {
    return null;
  }

  const tokens = key.split(/\s+/).filter(Boolean);
  const maxTokens = isExplicitDesignation ? 5 : 4;
  if (tokens.length === 0 || tokens.length > maxTokens) return null;

  // Single-word checks (colors, venues, apps, brands, common Vietnamese non-name nouns)
  if (tokens.length === 1) {
    if (
      JUNK_SINGLE_WORDS.has(tokens[0]) ||
      JUNK_TOKEN_CONTAINMENT.has(tokens[0]) ||
      STRICT_NON_PERSON_SINGLE_KEYS.has(tokens[0]) ||
      STRICT_VI_SINGLE_COLOR_OR_NON_PERSON_RE.test(name)
    ) {
      return null;
    }
  }

  // Multi-word color phrases (e.g. "Đỏ thẫm", "Xanh lam", "Hồng phấn", "Vàng kim", "Trắng tinh", "Đen tuyền")
  if (tokens.length >= 2) {
    const rawWords = name.split(/\s+/).filter(Boolean);
    const firstRaw = rawWords[0] || '';
    const firstKey = tokens[0];
    // Reject if starts with Vietnamese color word and is NOT a known Vietnamese surname (e.g. "Hoàng", "Bạch", "Hồng" with real second given name)
    if (
      /^(?:màu|sắc|tông|đỏ|xanh|vàng|đen|trắng|tím|xám|nâu|cam|bạc)$/iu.test(
        firstRaw,
      )
    ) {
      return null;
    }
    if (
      /^(?:hồng)$/iu.test(firstRaw) &&
      /^(?:phấn|nhạt|đậm|đào|cánh|sen|tươi|thẫm|pastel|neon|đất|san|hô|lựu)$/iu.test(
        rawWords[1] || '',
      )
    ) {
      return null;
    }
    // Reject English color + modifier phrases (e.g. "Navy Blue", "Pastel Pink", "Matte Black")
    if (
      tokens.every(
        (t) =>
          STRICT_NON_PERSON_SINGLE_KEYS.has(t) ||
          /^(?:dark|light|deep|bright|pale|soft|warm|cool|matte|glossy|metallic|neon|pastel|dusty|burnt|off|jet|sky|sea|baby|hot|blood|pearl|rose|ash|smoke)$/i.test(
            t,
          ),
      )
    ) {
      return null;
    }
    // Reject trailing single capital letter (e.g. "Low G", "Big T", "Plan A", "Studio B")
    if (/^[A-Z]$/.test(rawWords[rawWords.length - 1] || '')) {
      return null;
    }
    // Reject Vietnamese sentence-like song titles / phrases containing function words or verbs (e.g. "Chạy Ngay Đi", "Nơi Này Có Anh")
    // Exempt explicit character designations like "Chưởng quỹ tiệm đan"
    if (
      !isExplicitDesignation &&
      !ALL_PERSON_SURNAME_KEYS.has(firstKey) &&
      SONG_OR_PHRASE_FUNCTION_WORDS_RE.test(name)
    ) {
      return null;
    }
  }

  // Reject leading English stop-words/articles/pronouns (only for ASCII-only names so Vietnamese names like "An Nhiên", "Mỹ Tâm", "Tô Khải" are not falsely blocked)
  const hasViDiacritics = /[\u00C0-\u024F\u1E00-\u1EFF]/.test(name);
  if (!hasViDiacritics && LEADING_ENGLISH_STOP_WORDS.has(tokens[0])) {
    return null;
  }

  // Reject trailing standalone pronoun or contraction remnant
  const lastTok = tokens[tokens.length - 1];
  if (
    lastTok === 'i' ||
    lastTok === 'it' ||
    lastTok === 'he' ||
    lastTok === 'she' ||
    lastTok === 'we' ||
    lastTok === 'they' ||
    lastTok === 'you' ||
    lastTok === 'im' ||
    lastTok === 'ive' ||
    lastTok === 'its' ||
    lastTok === 'hes' ||
    lastTok === 'shes'
  ) {
    return null;
  }

  // Reject if ANY token is a clear meta/planning/scene/location/org/channel word or English CoT heading phrase
  if (
    tokens.some(
      (tok) =>
        (!isExplicitDesignation && JUNK_TOKEN_CONTAINMENT.has(tok)) ||
        STRICT_NON_PERSON_CONTAINMENT_TOKENS.has(tok),
    ) ||
    isEnglishHeadingOrMetaPhrase(name)
  ) {
    return null;
  }

  // Reject if name has internal apostrophe other than Irish/Scottish/French/Italian surname particles
  if (name.includes("'") || name.includes('’')) {
    const cleanApos = name.replace(/’/g, "'");
    const validApostrophe = cleanApos
      .split(/\s+/)
      .every(
        (tok) =>
          !tok.includes("'") ||
          /^(?:O|D|L|Mc)'[A-Z][\p{Ll}]+$/u.test(tok),
      );
    if (!validApostrophe) return null;
  }

  return name;
}

export function isJunkCharacterName(
  rawName: string,
  allowedKnownKeys?: Set<string>,
): boolean {
  return sanitizeCharacterName(rawName, allowedKnownKeys) === null;
}

/**
 * Extracts explicit real-name <-> stage-name/nickname alias pairs declared in text or profile fields
 * (e.g. "Nguyễn Hoàng Long (Low G)", "Hoàng Long — nghệ danh Low G", "tên thật là Nguyễn Hoàng Long").
 */
export function extractInlineAliasPairsFromText(
  text: string,
): Array<{ primary: string; alias: string }> {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  const pairs: Array<{ primary: string; alias: string }> = [];
  const seen = new Set<string>();

  const pushPair = (a?: string | null, b?: string | null) => {
    const cleanA = String(a ?? '').replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').trim();
    const cleanB = String(b ?? '').replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').trim();
    const kA = normalizeCharacterKey(cleanA);
    const kB = normalizeCharacterKey(cleanB);
    if (!kA || !kB || kA === kB || kA.length < 2 || kB.length < 2) return;
    const sig = `${kA}::${kB}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    pairs.push({ primary: cleanA, alias: cleanB });
  };

  // Pattern 1: "Name (Alias)" or "Name (nghệ danh Alias)"
  const parenRe =
    /([\p{Lu}][\p{Ll}'’]{1,16}(?:\s+[\p{Lu}][\p{Ll}'’]{1,16}){1,3})\s*\(\s*(?:(?:nghệ\s+danh|biệt\s+danh|tên\s+khác|aka|a\.k\.a\.?)\s*[:\-]?\s*)?(["“]?[\p{L}][\p{L}\p{N}'’\-\s]{1,22}["”]?)\s*\)/gu;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(raw)) !== null) {
    pushPair(m[1], m[2]);
  }

  // Pattern 2: "Name — nghệ danh/biệt danh/hay còn gọi là Alias"
  const inlineAliasRe =
    /([\p{Lu}][\p{Ll}'’]{1,16}(?:\s+[\p{Lu}][\p{Ll}'’]{1,16}){1,3})\s*(?:[,—–-]\s*|\s+)(?:có\s+)?(?:nghệ\s+danh|biệt\s+danh|hay\s+còn\s+gọi\s+là|thường\s+gọi\s+là|aka|a\.k\.a\.?)\s*(?:là\s*)?["“]?([\p{Lu}][\p{L}\p{N}'’-]{1,18}(?:\s+[\p{Lu}][\p{L}\p{N}'’-]{0,14})?)["”]?/gu;
  while ((m = inlineAliasRe.exec(raw)) !== null) {
    pushPair(m[1], m[2]);
  }

  return pairs;
}

/**
 * Resolves all identity keys for a character (canonical key, base name key, celebrity key,
 * builtin real-name/stage-name key, and any aliases declared in parentheticals or profile text).
 */
export function collectCharacterIdentityKeys(
  rawName: string,
  extraFields?: Array<string | undefined>,
): { primaryKey: string; aliasKeys: Set<string> } {
  const { baseName, aliases } = splitNameAndParentheticalAliases(rawName);
  const celeb = lookupKnownCelebrityProfile(baseName) || lookupKnownCelebrityProfile(rawName);
  const baseKey = normalizeCharacterKey(celeb ? celeb.canonicalName : baseName);
  const builtinCanon =
    BUILTIN_ALIAS_TO_CANONICAL_KEY.get(baseKey) ||
    BUILTIN_ALIAS_TO_CANONICAL_KEY.get(normalizeCharacterKey(rawName));

  const primaryKey = builtinCanon || baseKey;
  const aliasKeys = new Set<string>();
  if (primaryKey) aliasKeys.add(primaryKey);
  if (baseKey) aliasKeys.add(baseKey);
  const rawKey = normalizeCharacterKey(rawName);
  if (rawKey) aliasKeys.add(rawKey);

  if (celeb) {
    aliasKeys.add(normalizeCharacterKey(celeb.canonicalName));
    for (const a of celeb.aliases || []) {
      const ak = normalizeCharacterKey(a);
      if (ak && ak.length >= 2) aliasKeys.add(ak);
    }
  }
  for (const a of aliases) {
    const ak = normalizeCharacterKey(a);
    if (ak && ak.length >= 2) aliasKeys.add(ak);
  }

  // Extract inline alias mentions from role/signature/personality/context
  const combinedExtra = (extraFields || []).filter(Boolean).join(' ; ');
  if (combinedExtra) {
    const aliasMentionRe =
      /(?:nghệ\s+danh|biệt\s+danh|tên\s+thật|tên\s+gọi\s+khác|aka|a\.k\.a\.?)\s*(?:là|:)?\s*["“]?([\p{Lu}][\p{L}\p{N}'’-]{1,18}(?:\s+[\p{Lu}][\p{L}\p{N}'’-]{0,16}){0,2})["”]?/gu;
    let m: RegExpExecArray | null;
    while ((m = aliasMentionRe.exec(combinedExtra)) !== null) {
      const ak = normalizeCharacterKey(m[1]);
      if (ak && ak.length >= 2) {
        aliasKeys.add(ak);
        const mapped = BUILTIN_ALIAS_TO_CANONICAL_KEY.get(ak);
        if (mapped) aliasKeys.add(mapped);
      }
    }
  }

  return { primaryKey, aliasKeys };
}

function areIdentityKeysShadowMatch(aKeys: Set<string>, bKeys: Set<string>): boolean {
  for (const ak of aKeys) {
    if (bKeys.has(ak)) return true;
  }
  // Check single-word / short given-name shadow of a fuller multi-word name (e.g. "Wonyoung" <-> "Jang Wonyoung", "Jennie" <-> "Jennie Kim")
  for (const ak of aKeys) {
    if (ak.length < 4) continue;
    for (const bk of bKeys) {
      if (bk.length < 4) continue;
      const aHasSpace = ak.includes(' ');
      const bHasSpace = bk.includes(' ');
      if (aHasSpace !== bHasSpace) {
        const full = aHasSpace ? ak : bk;
        const short = aHasSpace ? bk : ak;
        if (full.startsWith(`${short} `) || full.endsWith(` ${short}`)) {
          return true;
        }
      }
      if (
        isTeasingOrSpellingVariantOf(ak, bk) ||
        isTeasingOrSpellingVariantOf(bk, ak)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether a portrait entry is actually a non-person junk item (company, venue,
 * color, song, chat group, or described as a chat group).
 */
export function isInvalidNpcPortrait(
  p: Pick<
    CharacterPortrait,
    | 'name'
    | 'role'
    | 'appearance'
    | 'personality'
    | 'contextSnippet'
    | 'isMc'
    | 'pinned'
    | 'aiAutoEnrichLocked'
    | 'profileManual'
    | 'appearanceManual'
  >,
  allowedKnownKeys?: Set<string>,
  extraBlockedKeys?: Set<string>,
): boolean {
  if (p.isMc) return false;
  const rawName = String(p.name || '').trim();
  if (!rawName) return true;

  // Even pinned/roster entries cannot be blatantly non-person junk like 'nhóm chat', 'SM', 'Quán cà phê', 'Luyện Khí', 'Linh Đan', 'Thanh Bình Tiên Kiếm'
  if (isNonPersonCultivationOrWorldTerm(rawName, extraBlockedKeys)) {
    return true;
  }
  const sanitized = sanitizeCharacterName(
    rawName,
    allowedKnownKeys,
    extraBlockedKeys,
  );
  if (!sanitized) return true;

  // Reject unnamed generic filler descriptors (e.g. "Anh bảo vệ", "Cô lễ tân", "Người đàn ông lạ")
  // ONLY for non-pinned, unlocked, non-manual entries so user-managed profiles stay 100% safe.
  const isUserProtected = Boolean(
    p.pinned || p.aiAutoEnrichLocked || p.profileManual || p.appearanceManual,
  );
  if (
    !isUserProtected &&
    !isExplicitCharacterDesignation(sanitized) &&
    isGenericUnnamedFillerNpcName(sanitized, allowedKnownKeys)
  ) {
    return true;
  }

  // Reject if role or appearance explicitly describes a chat group / organization / venue / song / cultivation item or place
  if (
    isChatOrNonPersonDescription(p.role) ||
    isChatOrNonPersonDescription(p.appearance) ||
    isChatOrNonPersonDescription(p.personality)
  ) {
    return true;
  }

  return false;
}

/**
 * Returns true if a PortraitBank entry was auto-scanned from prose (port_auto_* / port_turn_*)
 * and has NOT been explicitly confirmed/pinned/locked/linked to a Companion NPC by the user.
 * Used to keep Portrait Bank scanning isolated so unverified/junk entries NEVER leak into the running story.
 */
export function isPortraitAutoScannedUnconfirmed(
  p?: Pick<
    CharacterPortrait,
    'id' | 'isMc' | 'pinned' | 'aiAutoEnrichLocked' | 'profileManual' | 'appearanceManual' | 'npcId'
  > | null,
): boolean {
  if (!p || p.isMc) return false;
  if (p.pinned || p.aiAutoEnrichLocked || p.profileManual || p.appearanceManual || p.npcId) {
    return false;
  }
  const id = String(p.id || '').trim();
  return id.startsWith('port_auto_') || id.startsWith('port_turn_');
}

export type SuspiciousPortraitJunkReason =
  | 'lyric_slang'
  | 'teasing_alias'
  | 'non_person'
  | 'filler'
  | null;

/**
 * Classifies whether a portrait entry is junk (lyric/exclamation/slang, teasing/parody nickname,
 * non-person, or generic filler) so the Portrait Bank UI can surface quick-filter & 1-tap cleanup
 * without touching valid characters.
 */
export function classifySuspiciousPortraitJunk(
  p: Pick<
    CharacterPortrait,
    | 'id'
    | 'name'
    | 'role'
    | 'appearance'
    | 'personality'
    | 'contextSnippet'
    | 'isMc'
    | 'pinned'
    | 'aiAutoEnrichLocked'
    | 'profileManual'
    | 'appearanceManual'
    | 'npcId'
  > &
    Partial<Pick<CharacterPortrait, 'imageData'>>,
  allowedKnownKeys?: Set<string>,
  allPortraits?: Array<Pick<CharacterPortrait, 'id' | 'name' | 'isMc'>>,
  extraBlockedKeys?: Set<string>,
): SuspiciousPortraitJunkReason {
  if (p.isMc) return null;
  const rawName = String(p.name || '').trim();
  if (!rawName) return 'non_person';
  if (isNonPersonCultivationOrWorldTerm(rawName, extraBlockedKeys)) {
    return 'non_person';
  }
  if (isLyricOrExclamationJunkName(rawName, allowedKnownKeys)) {
    return 'lyric_slang';
  }
  const isUserProtected = Boolean(
    p.pinned || p.aiAutoEnrichLocked || p.profileManual || p.appearanceManual,
  );
  if (
    !isUserProtected &&
    isPlayfulTeasingOrParodyName(rawName, allowedKnownKeys)
  ) {
    return 'teasing_alias';
  }
  if (!isUserProtected && allPortraits && allPortraits.length > 1) {
    const otherNames = allPortraits
      .filter((o) => o.id !== p.id && !o.isMc && o.name?.trim())
      .map((o) => o.name.trim());
    const canonicalHit = findCanonicalVariantMatch(rawName, otherNames);
    if (canonicalHit) {
      const candKey = normalizeCharacterKey(rawName);
      const canonKey = normalizeCharacterKey(canonicalHit);
      const candIsCeleb = Boolean(lookupKnownCelebrityProfile(rawName));
      const canonIsCeleb = Boolean(lookupKnownCelebrityProfile(canonicalHit));
      const candLooksMoreAlias =
        isPlayfulTeasingOrParodyName(rawName) ||
        (!candIsCeleb && canonIsCeleb) ||
        (!candKey.includes(' ') && canonKey.includes(' ')) ||
        isPortraitAutoScannedUnconfirmed(p);
      if (candLooksMoreAlias) {
        return 'teasing_alias';
      }
    }
  }
  if (
    !isUserProtected &&
    !isExplicitCharacterDesignation(rawName) &&
    isGenericUnnamedFillerNpcName(rawName, allowedKnownKeys)
  ) {
    return 'filler';
  }
  if (isInvalidNpcPortrait(p, allowedKnownKeys, extraBlockedKeys)) {
    return 'non_person';
  }
  // Extra heuristic for unconfirmed auto-scanned entries whose context/role hints they came from a lyric/song/short quote
  if (isPortraitAutoScannedUnconfirmed(p)) {
    const tokens = rawName.split(/\s+/).filter(Boolean);
    const key = normalizeCharacterKey(rawName);
    const hasLyricRoleOrSnippet =
      /(?:lời\s+bài\s+hát|lyric|điệp\s+khúc|câu\s+hát|câu\s+rap|bài\s+hát|ca\s+khúc|4-?bar|beat\s+drop|♪|♫|🎵|🎶)/iu.test(
        `${p.role || ''} ${p.contextSnippet || ''}`,
      );
    if (
      hasLyricRoleOrSnippet &&
      !(allowedKnownKeys && allowedKnownKeys.has(key)) &&
      !lookupKnownCelebrityProfile(rawName)
    ) {
      return 'lyric_slang';
    }
    if (
      tokens.length === 1 &&
      rawName.length <= 4 &&
      !(allowedKnownKeys && allowedKnownKeys.has(key)) &&
      !lookupKnownCelebrityProfile(rawName) &&
      !p.imageData
    ) {
      return 'lyric_slang';
    }
  }
  return null;
}

/**
 * Checks whether a CharacterStateSnapshot is actually a non-person junk item.
 */
export function isInvalidNpcState(
  s: Pick<CharacterStateSnapshot, 'name' | 'location' | 'mood' | 'status' | 'isMc'>,
  allowedKnownKeys?: Set<string>,
  extraBlockedKeys?: Set<string>,
): boolean {
  if (s.isMc) return false;
  const rawName = String(s.name || '').trim();
  if (!rawName) return true;
  if (isNonPersonCultivationOrWorldTerm(rawName, extraBlockedKeys)) {
    return true;
  }
  const sanitized = sanitizeCharacterName(
    rawName,
    allowedKnownKeys,
    extraBlockedKeys,
  );
  if (!sanitized) return true;

  if (
    isChatOrNonPersonDescription(s.status) ||
    isChatOrNonPersonDescription(s.mood)
  ) {
    return true;
  }

  // If a non-roster state's ONLY location is a chat group/phone screen and status is chat-only, drop it
  const locNorm = normalizeCharacterKey(s.location || '');
  const statusNorm = normalizeCharacterKey(s.status || '');
  const isRoster = Boolean(
    allowedKnownKeys && allowedKnownKeys.has(normalizeCharacterKey(sanitized)),
  );
  if (!isRoster && isGenericUnnamedFillerNpcName(sanitized, allowedKnownKeys)) {
    return true;
  }
  if (
    !isRoster &&
    /^(?:trong\s+|o\s+|tai\s+)?(?:nhom\s+chat|group\s+chat|khung\s+chat|tin\s+nhan|man\s+hinh\s+dien\s+thoai|kakaotalk|zalo|messenger)$/i.test(
      locNorm,
    ) &&
    (!statusNorm ||
      /(?:nhan\s+tin|nhom\s+chat|group\s+chat|tra\s+loi\s+tin|gui\s+tin|seen|tha\s+icon|binh\s+luan|dang\s+story|chi\s+duoc\s+nhac)/i.test(
        statusNorm,
      ))
  ) {
    return true;
  }

  return false;
}

export function buildAllowedRosterKeys(
  comp?: CompanionProfile,
  fallbackMcName?: string,
  extraValidNames?: string[],
): Set<string> {
  const keys = new Set<string>();
  const add = (s?: string) => {
    const raw = String(s || '').trim();
    if (!raw) return;
    const { baseName } = splitNameAndParentheticalAliases(raw);
    const k = normalizeCharacterKey(baseName);
    if (!k || k.length < 2) return;
    // Never whitelist blatant non-person or lyric/exclamation junk even if it leaked into a legacy companion profile
    if (
      JUNK_EXACT_PHRASES.has(k) ||
      STRICT_NON_PERSON_SUBSTRING_RE.test(k) ||
      STRICT_VI_NON_PERSON_PREFIX_RE.test(baseName) ||
      STRICT_VI_COMPASS_OR_GEO_EXACT_RE.test(baseName) ||
      STRICT_VI_NON_NAME_TOKEN_RE.test(baseName) ||
      isLyricOrExclamationJunkName(baseName) ||
      isPlayfulTeasingOrParodyName(baseName) ||
      isChatOrNonPersonDescription(baseName)
    ) {
      return;
    }
    keys.add(k);
  };
  add(comp?.mc?.name);
  add(comp?.mc?.canonMcName);
  add(fallbackMcName);
  for (const n of comp?.npcs || []) add(n.name);
  for (const c of comp?.canonCandidates || []) add(c.name);
  for (const extra of extraValidNames || []) add(extra);
  return keys;
}

const SOLO_POSE_PREFIX_RE = /^(?:dáng|tư\s+thế|biểu\s+cảm)\s+/iu;
const LEGACY_DIALOGUE_OR_CHAT_RE =
  /[“”"«»]|(?:^|\s)(?:nhóm\s+chat|tin\s+nhắn|nhắn\s+tin|gửi\s+tin|gọi\s+điện|đáp\s*:|nói\s*:|hỏi\s*:|cười\s+nói\s*:|thì\s+thầm\s*:)/iu;

const POSE_PRIMARY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /ngồi\s+(?:tựa|dựa)\s+lưng/iu, label: 'ngồi tựa lưng thả lỏng' },
  { re: /ngồi\s+(?:vắt|bắt)\s+chéo\s+chân/iu, label: 'ngồi bắt chéo chân thoải mái' },
  { re: /ngồi\s+nghiêng\s+người|nhoài\s+người|rướn\s+người/iu, label: 'ngồi hơi nghiêng người về trước' },
  { re: /ngồi\s+khoanh\s+tay/iu, label: 'ngồi khoanh tay điềm tĩnh' },
  { re: /ngồi\s+chống\s+cằm/iu, label: 'ngồi chống cằm suy tư' },
  { re: /ngồi\s+(?:bên|cạnh|sát)\s+cửa\s+sổ/iu, label: 'ngồi thả lỏng bên khung cửa' },
  { re: /ngồi\s+(?:trên\s+)?(?:sofa|ghế\s+bành|ghế\s+dài)/iu, label: 'ngồi tựa thoải mái trên sofa' },
  { re: /ngồi\s+thẳng\s+lưng|ngồi\s+ngay\s+ngắn/iu, label: 'ngồi thẳng lưng chỉnh tề' },
  { re: /(?:đứng\s+)?khoanh\s+tay/iu, label: 'đứng khoanh tay điềm tĩnh' },
  { re: /(?:đứng\s+)?(?:tựa|dựa)\s+(?:vào\s+)?(?:tường|cột|khung\s+cửa|cửa|lan\s+can|bàn|quầy)/iu, label: 'đứng tựa nhẹ thả lỏng' },
  { re: /đút\s+(?:hai\s+|một\s+)?tay\s+(?:vào\s+)?túi/iu, label: 'đứng thả lỏng, tay đút túi' },
  { re: /đứng\s+nghiêng\s+người|quay\s+nửa\s+người/iu, label: 'đứng hơi nghiêng người tự nhiên' },
  { re: /đứng\s+thẳng|sải\s+bước|bước\s+đi\s+khoan\s+thai/iu, label: 'đứng thẳng tự nhiên, vai thả lỏng' },
  { re: /ngồi\s+xuống|đang\s+ngồi|vẫn\s+ngồi|ngồi\s+bên|ngồi\s+ở|ngồi\s+trong/iu, label: 'ngồi thả lỏng tự nhiên' },
  { re: /đứng\s+dậy|đang\s+đứng|vẫn\s+đứng|đứng\s+bên|đứng\s+ở|đứng\s+trong|bước\s+vào|bước\s+ra/iu, label: 'đứng thả lỏng tự nhiên' },
  { re: /(?:tựa|dựa)\s+người|ngả\s+người|ngả\s+lưng/iu, label: 'tựa lưng thả lỏng' },
  { re: /nghiêng\s+người|hơi\s+cúi\s+người|khẽ\s+cúi/iu, label: 'hơi nghiêng người lắng nghe' },
  { re: /quay\s+(?:đầu|người)\s+(?:nhìn|lại)|ngoái\s+(?:đầu|lại)/iu, label: 'quay nửa người ngoái nhìn tự nhiên' },
];

const POSE_DETAIL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /nghiêng\s+đầu/iu, label: 'khẽ nghiêng đầu' },
  { re: /chống\s+cằm|tựa\s+cằm/iu, label: 'một tay chống cằm' },
  { re: /(?:cầm|nâng|nhấp|đặt)\s+(?:ly|tách|cốc)\s+(?:cà\s+phê|coffee|matcha|trà|latte)/iu, label: 'một tay cầm ly nước' },
  { re: /(?:cầm|nâng|xoay|nhấp)\s+(?:ly\s+)?(?:rượu|vang|champagne|cocktail|whisky)/iu, label: 'một tay cầm ly rượu' },
  { re: /(?:cầm|nâng)\s+(?:ly|cốc|tách)/iu, label: 'một tay cầm ly' },
  { re: /cầm\s+(?:micro|mic)\b/iu, label: 'tay cầm micro' },
  { re: /(?:ôm|cầm|chỉnh|gảy)\s+(?:đàn|guitar)/iu, label: 'tay giữ đàn guitar' },
  { re: /đeo\s+tai\s+nghe|tai\s+nghe/iu, label: 'đeo tai nghe' },
  { re: /(?:vén|vuốt|hất)\s+(?:lọn\s+)?tóc/iu, label: 'một tay khẽ vuốt tóc' },
  { re: /đan\s+(?:nhẹ\s+)?(?:hai\s+)?(?:bàn\s+)?tay|chắp\s+tay/iu, label: 'hai tay đan nhẹ' },
  { re: /chống\s+(?:hai\s+|một\s+)?tay\s+(?:lên|xuống)\s+bàn/iu, label: 'tay chống nhẹ lên bàn' },
  { re: /vẫy\s+tay|giơ\s+tay\s+chào/iu, label: 'một tay khẽ vẫy chào' },
  { re: /cầm\s+(?:điện\s+thoại|smartphone|iphone)|lướt\s+điện\s+thoại/iu, label: 'một tay cầm điện thoại' },
  { re: /khẽ\s+gật\s+đầu|gật\s+nhẹ/iu, label: 'khẽ gật đầu' },
];

const EXPRESSION_PRIMARY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /cười\s+nửa\s+miệng|nhếch\s+(?:nhẹ\s+)?(?:khóe\s+)?(?:môi|miệng)/iu, label: 'cười nửa miệng sắc sảo' },
  { re: /cười\s+(?:tươi|rạng\s+rỡ|bật\s+cười|khúc\s+khích|sảng\s+khoái)/iu, label: 'cười tươi rạng rỡ' },
  { re: /cười\s+(?:trêu|tinh\s+nghịch|hóm\s+hỉnh|lém\s+lỉnh)/iu, label: 'nụ cười tinh nghịch' },
  { re: /cười\s+(?:ấm\s+áp|hiền|dịu\s+dàng)/iu, label: 'mỉm cười ấm áp' },
  { re: /mỉm\s+cười|cười\s+(?:nhẹ|khẽ|mỉm|một\s+tiếng)|khóe\s+môi\s+(?:khẽ\s+)?cong/iu, label: 'mỉm cười nhẹ tự nhiên' },
  { re: /nhướng\s+(?:nhẹ\s+)?(?:một\s+bên\s+)?mày|nhướn\s+mày/iu, label: 'nhướng mày tò mò' },
  { re: /(?:khẽ\s+)?cau\s+mày|nhíu\s+(?:nhẹ\s+)?mày/iu, label: 'khẽ nhíu mày suy tư' },
  { re: /ngạc\s+nhiên|mở\s+to\s+mắt|sững\s+(?:người|lại)/iu, label: 'hơi ngạc nhiên' },
  { re: /lạnh\s+lùng|lạnh\s+nhạt|băng\s+giá|xa\s+cách/iu, label: 'nét mặt lạnh lùng điềm đạm' },
  { re: /thản\s+nhiên|điềm\s+tĩnh|điềm\s+đạm|bình\s+thản|ung\s+dung/iu, label: 'vẻ mặt thản nhiên điềm tĩnh' },
  { re: /nghiêm\s+túc|tập\s+trung|chăm\s+chú|trầm\s+ngâm|suy\s+tư/iu, label: 'vẻ mặt tập trung trầm tĩnh' },
  { re: /ngại\s+ngùng|ửng\s+đỏ|bối\s+rối|e\s+thẹn/iu, label: 'nét mặt hơi ngại ngùng' },
  { re: /dịu\s+dàng|nhẹ\s+nhàng|ôn\s+hòa|thư\s+thái/iu, label: 'nét mặt dịu dàng thư thái' },
  { re: /tự\s+tin|kiêu\s+kỳ|kiêu\s+hãnh|phóng\s+khoáng|cuốn\s+hút/iu, label: 'thần thái tự tin cuốn hút' },
  { re: /khó\s+chịu|bực|gắt|cáu|lườm/iu, label: 'nét mặt hơi sắc lạnh' },
  { re: /trầm\s+lắng|buồn|thẫn\s+thờ|xa\s+xăm/iu, label: 'nét mặt trầm lắng' },
];

const EXPRESSION_GAZE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /ánh\s+mắt\s+(?:sắc|sắc\s+bén|sắc\s+lạnh|sắc\s+sảo)|đôi\s+mắt\s+sắc/iu, label: 'ánh mắt sắc sảo' },
  { re: /ánh\s+mắt\s+(?:ấm\s+áp|dịu\s+dàng|trìu\s+mến)|nhìn\s+dịu\s+dàng/iu, label: 'ánh mắt ấm áp' },
  { re: /ánh\s+mắt\s+(?:trầm\s+tĩnh|điềm\s+tĩnh|bình\s+tĩnh|sâu\s+lắng)/iu, label: 'ánh mắt trầm tĩnh' },
  { re: /ánh\s+mắt\s+(?:lấp\s+lánh|sáng\s+rỡ|hào\s+hứng|tươi\s+sáng)/iu, label: 'ánh mắt sáng hào hứng' },
  { re: /ánh\s+mắt\s+(?:tò\s+mò|chăm\s+chú|dò\s+xét|tập\s+trung)|nhìn\s+chăm\s+chú/iu, label: 'ánh nhìn chăm chú' },
  { re: /nheo\s+(?:nhẹ\s+)?mắt|híp\s+mắt/iu, label: 'ánh mắt hơi nheo lại' },
  { re: /nhìn\s+(?:lên|sang|thẳng)|ngước\s+(?:lên|mắt)/iu, label: 'ánh nhìn thẳng tự nhiên' },
];

/**
 * Returns true if the text is already a concise solo pose & expression summary
 * (e.g. "Dáng ngồi tựa lưng thả lỏng; biểu cảm mỉm cười nhẹ, ánh mắt điềm tĩnh.")
 * with no dialogue quotes, chat-group references, or multi-person narration.
 */
export function isSoloPoseExpressionSnippet(snippet?: string): boolean {
  const raw = String(snippet || '').replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 12 || raw.length > 195) return false;
  if (/[\r\n]/.test(String(snippet || ''))) return false;
  if (LEGACY_DIALOGUE_OR_CHAT_RE.test(raw)) return false;
  if (isChatOrNonPersonDescription(raw)) return false;
  return SOLO_POSE_PREFIX_RE.test(raw);
}

/**
 * Extracts concise physical posture (pose) and facial expression signals from clean
 * non-dialogue narrative text belonging to a single character.
 */
export function extractPoseAndExpressionSignals(text: string): {
  pose: string;
  expression: string;
} {
  // Strip all quoted speech and dialogue lines so spoken words never leak into pose/expression
  const noQuotes = String(text || '')
    .replace(/“[^”]*”/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/«[^»]*»/g, ' ')
    .replace(/‘[^’]*’/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!noQuotes) return { pose: '', expression: '' };

  let primaryPose = '';
  for (const item of POSE_PRIMARY_PATTERNS) {
    if (item.re.test(noQuotes)) {
      primaryPose = item.label;
      break;
    }
  }

  let detailPose = '';
  for (const item of POSE_DETAIL_PATTERNS) {
    if (item.re.test(noQuotes)) {
      const candidate = item.label;
      if (
        !primaryPose ||
        (!primaryPose.includes(candidate) &&
          !(candidate.includes('chống cằm') && primaryPose.includes('chống cằm')))
      ) {
        detailPose = candidate;
      }
      break;
    }
  }

  const pose =
    primaryPose && detailPose
      ? `${primaryPose}, ${detailPose}`
      : primaryPose || detailPose;

  let primaryExpr = '';
  for (const item of EXPRESSION_PRIMARY_PATTERNS) {
    if (item.re.test(noQuotes)) {
      primaryExpr = item.label;
      break;
    }
  }

  let gazeExpr = '';
  for (const item of EXPRESSION_GAZE_PATTERNS) {
    if (item.re.test(noQuotes)) {
      const candidate = item.label;
      if (!primaryExpr || !primaryExpr.includes(candidate)) {
        gazeExpr = candidate;
      }
      break;
    }
  }

  const expression =
    primaryExpr && gazeExpr
      ? `${primaryExpr}, ${gazeExpr}`
      : primaryExpr || gazeExpr;

  return { pose, expression };
}

/**
 * Derives a grounded, individual pose & expression from a character's own profile fields
 * (personality, signature, role, appearance) when no explicit scene posture cues exist.
 */
export function deriveFallbackPoseAndExpression(profile: {
  role?: string;
  personality?: string;
  signature?: string;
  appearance?: string;
  isMc?: boolean;
}): string {
  const combined = [
    profile.personality || '',
    profile.signature || '',
    profile.appearance || '',
    profile.role || '',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!combined) return '';

  const fromProfile = extractPoseAndExpressionSignals(combined);
  let pose = fromProfile.pose;
  let expr = fromProfile.expression;

  const norm = normalizeCharacterKey(combined);
  if (!pose) {
    if (/sieu\s+mau|nguoi\s+mau|model|thoi\s+trang|dien\s+vien/.test(norm)) {
      pose = 'đứng thẳng tự tin, hơi nghiêng vai tự nhiên';
    } else if (/ca\s+si|idol|rapper|nhac\s+si|nghe\s+si|dj/.test(norm)) {
      pose = 'đứng thả lỏng hơi nghiêng người, phong thái tự nhiên';
    } else if (/doanh\s+nhan|giam\s+doc|quan\s+ly|chu\s+tich|ceo|lanh\s+dao/.test(norm)) {
      pose = 'đứng thẳng điềm tĩnh, vai thả lỏng';
    } else if (/lanh\s+lung|tram\s+tinh|it\s+noi|kin\s+dao|noi\s+tam/.test(norm)) {
      pose = 'đứng thẳng gọn gàng, tư thế điềm tĩnh';
    } else if (/nang\s+dong|hai\s+huoc|treu|hoa\s+dong|than\s+thien|vui\s+ve/.test(norm)) {
      pose = 'đứng thả lỏng hơi nghiêng đầu tự nhiên';
    } else {
      pose = 'đứng thả lỏng tự nhiên';
    }
  }

  if (!expr) {
    if (/lanh\s+lung|xa\s+cach|kiem\s+che|it\s+noi|kin\s+dao/.test(norm)) {
      expr = 'vẻ mặt điềm tĩnh, ánh mắt trầm lắng';
    } else if (/sac\s+sao|thang\s+tinh|chanh\s+sa|quyen\s+luc|ban\s+linh|tu\s+tin/.test(norm)) {
      expr = 'thần thái sắc sảo, ánh mắt tự tin';
    } else if (/am\s+ap|diu\s+dang|than\s+thien|hoa\s+dong|chan\s+thanh/.test(norm)) {
      expr = 'mỉm cười nhẹ ấm áp, ánh mắt dịu dàng';
    } else if (/hai\s+huoc|treu|tinh\s+nghich|phong\s+khoang|noi\s+loan/.test(norm)) {
      expr = 'nụ cười nhẹ phóng khoáng, ánh mắt lanh lợi';
    } else {
      expr = 'biểu cảm điềm đạm, ánh mắt tự nhiên';
    }
  }

  const exprPart = /^(?:biểu\s+cảm|vẻ\s+mặt|nét\s+mặt|thần\s+thái|ánh\s+mắt|ánh\s+nhìn)/iu.test(
    expr,
  )
    ? expr
    : `biểu cảm ${expr}`;
  const formatted = `Dáng ${pose}; ${exprPart}.`;
  return formatted.length <= 180 ? formatted : `${formatted.slice(0, 177).trim()}...`;
}

/**
 * Isolates ONLY the clauses belonging to the target character from raw prose/snippet
 * (stripping chat blocks, dialogue quotes, and clauses introducing other people) and
 * distills them into a concise solo pose & expression string.
 */
export function extractSoloPoseAndExpression(
  rawText: string,
  charName: string,
  options?: {
    alternateName?: string;
    role?: string;
    personality?: string;
    signature?: string;
    appearance?: string;
    isMc?: boolean;
    allowProfileFallback?: boolean;
  },
): string {
  const rawPreservingLines = String(rawText || '').replace(/\r/g, '').trim();
  if (rawPreservingLines && isSoloPoseExpressionSnippet(rawPreservingLines)) {
    return rawPreservingLines.replace(/\s+/g, ' ').trim();
  }

  const cleanName = String(charName || '').trim();
  const altName = String(options?.alternateName || '').trim();

  if (rawPreservingLines && cleanName) {
    // Strip simulated chat blocks BEFORE flattening newlines so single-line chat headers don't eat prose lines
    const sceneOnly = stripNonSceneChatBlocks(rawPreservingLines)
      .replace(/“[^”]*”/g, ' ')
      .replace(/"[^"]*"/g, ' ')
      .replace(/«[^»]*»/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (sceneOnly.length >= 4) {
      // Split into sentences and keep only sentences referencing this character
      const sentences = sceneOnly
        .split(/(?<=[.!?…])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 4);

      const matchedClauses: string[] = [];
      for (const sent of sentences) {
        const matchesSentence =
          isContextSnippetRelevantToCharacter(sent, cleanName, [
            altName || undefined,
          ]);
        if (!matchesSentence) continue;

        // Split compound sentences on transition boundaries to drop clauses belonging to other people
        const subClauses = sent
          .split(/(?:[;—–]|\s+(?:trong\s+khi|còn\s+|ở\s+góc|bên\s+cạnh\s+đó|phía\s+đối\s+diện)\s+)/iu)
          .map((c) => c.trim())
          .filter(Boolean);

        if (subClauses.length <= 1) {
          matchedClauses.push(sent);
        } else {
          for (const clause of subClauses) {
            if (
              isContextSnippetRelevantToCharacter(clause, cleanName, [
                altName || undefined,
              ])
            ) {
              matchedClauses.push(clause);
            }
          }
        }
      }

      if (matchedClauses.length > 0) {
        const charActionText = matchedClauses.join('. ');
        const signals = extractPoseAndExpressionSignals(charActionText);
        if (signals.pose || signals.expression) {
          const profileHint = options
            ? extractPoseAndExpressionSignals(
                `${options.personality || ''} ${options.signature || ''}`,
              )
            : { pose: '', expression: '' };
          const finalPose = signals.pose || profileHint.pose || 'thả lỏng tự nhiên';
          const finalExpr =
            signals.expression || profileHint.expression || 'biểu cảm tự nhiên, điềm tĩnh';
          const exprClause = /^(?:biểu\s+cảm|vẻ\s+mặt|nét\s+mặt|thần\s+thái|ánh\s+mắt|ánh\s+nhìn)/iu.test(
            finalExpr,
          )
            ? finalExpr
            : `biểu cảm ${finalExpr}`;
          const summary = `Dáng ${finalPose}; ${exprClause}.`;
          return summary.length <= 180
            ? summary
            : `${summary.slice(0, 177).trim()}...`;
        }
      }
    }
  }

  if (options?.allowProfileFallback) {
    return deriveFallbackPoseAndExpression(options);
  }

  return '';
}

/**
 * Verifies that a stored or extracted 'Ngữ cảnh xuất hiện' / 'Dáng & biểu cảm' (contextSnippet)
 * is either already a clean solo pose & expression summary OR genuinely references the given
 * character (by full name, known celebrity alias, inline alias, or distinctive given name).
 */
export function isContextSnippetRelevantToCharacter(
  snippet: string | undefined,
  charName: string,
  extraAliases?: Array<string | undefined>,
): boolean {
  const rawPreservingLines = String(snippet || '').replace(/\r/g, '').trim();
  const raw = rawPreservingLines.replace(/\s+/g, ' ').trim();
  const cleanName = String(charName || '').trim();
  if (!raw || raw.length < 4 || !cleanName) return false;

  // Clean solo pose & expression summaries intentionally omit names and are always character-safe
  if (isSoloPoseExpressionSnippet(raw)) return true;

  const sceneOnly = stripNonSceneChatBlocks(rawPreservingLines)
    .replace(/\s+/g, ' ')
    .trim();
  if (!sceneOnly || sceneOnly.length < 4) return false;
  if (isChatOrNonPersonDescription(sceneOnly)) return false;

  // 1) Exact / honorific-aware proper name check (diacritic & boundary safe)
  const exactHit = findExactProperNameInText(sceneOnly, cleanName, {
    allowHonorificShortName: true,
  });
  if (exactHit.count > 0) return true;

  // 2) Check all resolved identity keys & celebrity aliases
  const idObj = collectCharacterIdentityKeys(cleanName, extraAliases);
  const celeb = lookupKnownCelebrityProfile(cleanName);
  const candidateTerms = new Set<string>();
  for (const k of idObj.aliasKeys) {
    if (k.length >= 3) candidateTerms.add(k);
  }
  if (celeb) {
    candidateTerms.add(normalizeCharacterKey(celeb.canonicalName));
    for (const a of celeb.aliases || []) {
      const ak = normalizeCharacterKey(a);
      if (ak.length >= 3) candidateTerms.add(ak);
    }
  }
  for (const extra of extraAliases || []) {
    const ek = normalizeCharacterKey(extra || '');
    if (ek.length >= 3) candidateTerms.add(ek);
  }

  // Also allow distinctive multi-word tail/head tokens (>= 3 chars, excluding common Vietnamese surnames alone)
  const baseNorm = normalizeCharacterKey(splitNameAndParentheticalAliases(cleanName).baseName);
  const baseTokens = baseNorm.split(/\s+/).filter(Boolean);
  if (baseTokens.length >= 2) {
    const lastTok = baseTokens[baseTokens.length - 1];
    if (lastTok.length >= 3 && !VIET_SURNAME_KEYS.has(lastTok)) {
      candidateTerms.add(lastTok);
    }
    const firstTok = baseTokens[0];
    if (firstTok.length >= 4 && !VIET_SURNAME_KEYS.has(firstTok)) {
      candidateTerms.add(firstTok);
    }
  }

  const snippetNorm = normalizeCharacterKey(sceneOnly);
  for (const term of candidateTerms) {
    if (!term || term.length < 3) continue;
    const escaped = escapeRegExpChars(term);
    if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(snippetNorm)) {
      return true;
    }
  }

  return false;
}

/**
 * Automatically migrates/cleans a portrait's stored contextSnippet into a concise solo
 * pose & expression string. Old long multi-character or dialogue excerpts are distilled
 * down to this character's own posture & expression (or replaced with a profile-grounded
 * solo pose/expression if the old snippet was misassigned from another character).
 */
export function sanitizeLegacyContextSnippetForPortrait(
  portrait: Pick<
    CharacterPortrait,
    | 'name'
    | 'role'
    | 'personality'
    | 'signature'
    | 'appearance'
    | 'contextSnippet'
    | 'isMc'
  >,
  extraAliases?: Array<string | undefined>,
): string | undefined {
  const raw = String(portrait.contextSnippet || '').replace(/\r/g, '').trim();
  if (!raw) return undefined;
  if (isSoloPoseExpressionSnippet(raw)) return raw.replace(/\s+/g, ' ').trim();

  const isRelevant = isContextSnippetRelevantToCharacter(
    raw,
    portrait.name,
    extraAliases,
  );
  if (isRelevant) {
    const converted = extractSoloPoseAndExpression(raw, portrait.name, {
      alternateName: extraAliases?.find((a) => Boolean(a && a.trim())),
      role: portrait.role,
      personality: portrait.personality,
      signature: portrait.signature,
      appearance: portrait.appearance,
      isMc: portrait.isMc,
      allowProfileFallback: true,
    });
    return converted || undefined;
  }

  // Legacy snippet belonged to another character or chat group -> discard it and fall back only to this character's own profile cues
  const fallback = deriveFallbackPoseAndExpression(portrait);
  return fallback || undefined;
}

function mergeTwoPortraits(
  target: CharacterPortrait,
  incoming: CharacterPortrait,
): CharacterPortrait {
  const targetParody = isPlayfulTeasingOrParodyName(target.name);
  const incomingParody = isPlayfulTeasingOrParodyName(incoming.name);
  const targetCeleb = Boolean(lookupKnownCelebrityProfile(target.name));
  const incomingCeleb = Boolean(lookupKnownCelebrityProfile(incoming.name));
  const preferIncomingName =
    !target.isMc &&
    !incomingParody &&
    (targetParody ||
      (!targetCeleb && incomingCeleb) ||
      (incoming.name.trim().includes(' ') && !target.name.trim().includes(' ')));
  const pickText = (a?: string, b?: string) => {
    const ca = String(a || '').trim();
    const cb = String(b || '').trim();
    if (ca && cb) return ca.length >= cb.length ? ca : cb;
    return ca || cb || undefined;
  };
  const nextRole =
    target.role &&
    !/^(?:npc|npc trong truyện|npc đồng nhân)$/i.test(target.role.trim())
      ? target.role
      : incoming.role || target.role;

  const mergedName = preferIncomingName ? incoming.name : target.name;
  const mergedAliases = [
    target.name,
    incoming.name,
    target.role,
    incoming.role,
    target.signature,
    incoming.signature,
  ];
  const validTargetSnippet = sanitizeLegacyContextSnippetForPortrait(
    { ...target, name: mergedName },
    mergedAliases,
  );
  const validIncomingSnippet = sanitizeLegacyContextSnippetForPortrait(
    { ...incoming, name: mergedName },
    mergedAliases,
  );

  return {
    ...target,
    name: mergedName,
    isMc: target.isMc || incoming.isMc,
    pinned: Boolean(target.pinned || incoming.pinned),
    aiAutoEnrichLocked: Boolean(
      target.aiAutoEnrichLocked || incoming.aiAutoEnrichLocked,
    ),
    appearanceManual: Boolean(
      target.appearanceManual || incoming.appearanceManual,
    ),
    profileManual: Boolean(target.profileManual || incoming.profileManual),
    role: sanitizeNpcFieldText('role', nextRole) || 'NPC trong truyện',
    age: target.age || incoming.age,
    birthday: target.birthday || incoming.birthday,
    fashionStyle:
      sanitizeNpcFieldText(
        'fashionStyle',
        pickText(target.fashionStyle, incoming.fashionStyle),
      ) || undefined,
    appearance:
      sanitizeNpcFieldText(
        'appearance',
        pickText(target.appearance, incoming.appearance),
      ) || '',
    personality:
      sanitizeNpcFieldText(
        'personality',
        pickText(target.personality, incoming.personality),
      ) || undefined,
    relationships:
      sanitizeNpcFieldText(
        'relationships',
        pickText(target.relationships, incoming.relationships),
      ) || undefined,
    signature:
      sanitizeNpcFieldText(
        'signature',
        pickText(target.signature, incoming.signature),
      ) || undefined,
    contextSnippet: pickText(validTargetSnippet, validIncomingSnippet),
    imageData: target.imageData || incoming.imageData,
    referenceImageData: target.referenceImageData || incoming.referenceImageData,
    identityLock: (() => {
      const a = target.identityLock;
      const b = incoming.identityLock;
      if (!a && !b) return undefined;
      const merged = {
        gender: pickText(a?.gender, b?.gender),
        facialFeatures: pickText(a?.facialFeatures, b?.facialFeatures),
        hairstyle: pickText(a?.hairstyle, b?.hairstyle),
        signatureStyle: pickText(a?.signatureStyle, b?.signatureStyle),
        fixedTags: pickText(a?.fixedTags, b?.fixedTags),
      };
      return Object.values(merged).some(Boolean) ? merged : undefined;
    })(),
    avatarVisualLock: pickText(
      target.avatarVisualLock,
      incoming.avatarVisualLock,
    ),
    avatarLockSourceSig:
      target.avatarLockSourceSig || incoming.avatarLockSourceSig,
    prompt: target.prompt || incoming.prompt,
    npcId: target.npcId || incoming.npcId,
    lastSeenTurnIndex:
      typeof target.lastSeenTurnIndex === 'number' &&
      typeof incoming.lastSeenTurnIndex === 'number'
        ? Math.max(target.lastSeenTurnIndex, incoming.lastSeenTurnIndex)
        : target.lastSeenTurnIndex ?? incoming.lastSeenTurnIndex,
    updatedAt: Math.max(target.updatedAt || 0, incoming.updatedAt || 0),
  };
}

export function cleanJunkPortraitsFromBank(
  bank: PortraitBankConfig,
  comp?: CompanionProfile,
  fallbackMcName?: string,
  extraBlockedKeys?: Set<string>,
): { bank: PortraitBankConfig; removedNames: string[] } {
  const allowedKeys = buildAllowedRosterKeys(comp, fallbackMcName);
  const removedNames: string[] = [];
  const kept: Array<{
    portrait: CharacterPortrait;
    identity: { primaryKey: string; aliasKeys: Set<string> };
  }> = [];

  for (const rawPortrait of bank.portraits || []) {
    if (!rawPortrait || !rawPortrait.name?.trim()) continue;

    if (rawPortrait.isMc) {
      const cleanedMcRole = sanitizeNpcFieldText('role', rawPortrait.role) || 'Nhân vật chính';
      const cleanedMcAppearance = sanitizeNpcFieldText('appearance', rawPortrait.appearance);
      const cleanedMcPersonality =
        sanitizeNpcFieldText('personality', rawPortrait.personality) || undefined;
      const validMcSnippet = sanitizeLegacyContextSnippetForPortrait(
        {
          ...rawPortrait,
          role: cleanedMcRole,
          appearance: cleanedMcAppearance,
          personality: cleanedMcPersonality,
        },
        [rawPortrait.role, rawPortrait.signature],
      );
      const sanitizedMc: CharacterPortrait = {
        ...rawPortrait,
        role: cleanedMcRole,
        appearance: cleanedMcAppearance,
        personality: cleanedMcPersonality,
        contextSnippet: validMcSnippet,
      };
      const idObj = collectCharacterIdentityKeys(sanitizedMc.name, [
        sanitizedMc.role,
        sanitizedMc.signature,
      ]);
      const existingMcIdx = kept.findIndex((k) => k.portrait.isMc);
      if (existingMcIdx >= 0) {
        kept[existingMcIdx].portrait = mergeTwoPortraits(
          kept[existingMcIdx].portrait,
          sanitizedMc,
        );
        for (const ak of idObj.aliasKeys) {
          kept[existingMcIdx].identity.aliasKeys.add(ak);
        }
        removedNames.push(rawPortrait.name);
      } else {
        kept.push({ portrait: sanitizedMc, identity: idObj });
      }
      continue;
    }

    if (isInvalidNpcPortrait(rawPortrait, allowedKeys, extraBlockedKeys)) {
      removedNames.push(rawPortrait.name);
      continue;
    }

    const sanitizedName = sanitizeCharacterName(
      rawPortrait.name,
      allowedKeys,
      extraBlockedKeys,
    );
    if (!sanitizedName) {
      removedNames.push(rawPortrait.name);
      continue;
    }

    const cleanedRole = sanitizeNpcFieldText('role', rawPortrait.role);
    const cleanedAppearance = sanitizeNpcFieldText(
      'appearance',
      rawPortrait.appearance,
    );
    const cleanedPersonality = sanitizeNpcFieldText(
      'personality',
      rawPortrait.personality,
    );
    const cleanedFashion = sanitizeNpcFieldText(
      'fashionStyle',
      rawPortrait.fashionStyle,
    );
    const cleanedRelationships = sanitizeNpcFieldText(
      'relationships',
      rawPortrait.relationships,
    );
    const cleanedSignature = sanitizeNpcFieldText(
      'signature',
      rawPortrait.signature,
    );
    const cleanedContextSnippet = sanitizeLegacyContextSnippetForPortrait(
      {
        name: sanitizedName,
        role: cleanedRole || 'NPC trong truyện',
        appearance: cleanedAppearance,
        personality: cleanedPersonality || undefined,
        signature: cleanedSignature || undefined,
        contextSnippet: rawPortrait.contextSnippet,
        isMc: false,
      },
      [rawPortrait.name, cleanedRole, cleanedSignature],
    );

    const normalizedPortrait: CharacterPortrait = {
      ...rawPortrait,
      name: sanitizedName,
      role: cleanedRole || 'NPC trong truyện',
      appearance: cleanedAppearance,
      ...(cleanedFashion ? { fashionStyle: cleanedFashion } : { fashionStyle: undefined }),
      ...(cleanedPersonality ? { personality: cleanedPersonality } : { personality: undefined }),
      ...(cleanedRelationships ? { relationships: cleanedRelationships } : { relationships: undefined }),
      ...(cleanedSignature ? { signature: cleanedSignature } : { signature: undefined }),
      contextSnippet: cleanedContextSnippet,
    };

    const identity = collectCharacterIdentityKeys(rawPortrait.name, [
      sanitizedName,
      rawPortrait.role,
      rawPortrait.signature,
      rawPortrait.personality,
    ]);

    const dupIdx = kept.findIndex(
      (k) =>
        (normalizedPortrait.npcId &&
          k.portrait.npcId === normalizedPortrait.npcId) ||
        areIdentityKeysShadowMatch(k.identity.aliasKeys, identity.aliasKeys),
    );

    if (dupIdx >= 0) {
      kept[dupIdx].portrait = mergeTwoPortraits(
        kept[dupIdx].portrait,
        normalizedPortrait,
      );
      for (const ak of identity.aliasKeys) {
        kept[dupIdx].identity.aliasKeys.add(ak);
      }
      removedNames.push(rawPortrait.name);
      continue;
    }

    kept.push({ portrait: normalizedPortrait, identity });
  }

  return {
    bank: {
      ...bank,
      portraits: kept.map((k) => k.portrait),
    },
    removedNames,
  };
}

/**
 * Cleans invalid non-person junk entries (companies, venues, colors, songs, 'nhóm chat',
 * detached stage names) and merges real-name/alias duplicates inside memory.characterStates.
 */
export function cleanAndDeduplicateCharacterStates(
  states: CharacterStateSnapshot[],
  options?: {
    comp?: CompanionProfile;
    fallbackMcName?: string;
    knownValidNames?: string[];
    extraBlockedKeys?: Set<string>;
  },
): { states: CharacterStateSnapshot[]; removedNames: string[] } {
  const allowedKeys = buildAllowedRosterKeys(
    options?.comp,
    options?.fallbackMcName,
    options?.knownValidNames,
  );
  const extraBlockedKeys = options?.extraBlockedKeys;
  const removedNames: string[] = [];
  const kept: Array<{
    state: CharacterStateSnapshot;
    identity: { primaryKey: string; aliasKeys: Set<string> };
  }> = [];

  for (const rawState of states || []) {
    if (!rawState || !rawState.name?.trim()) continue;

    if (rawState.isMc) {
      const cleanedMc: CharacterStateSnapshot = {
        ...rawState,
        name: rawState.name.trim(),
        location: sanitizeNpcFieldText('location', rawState.location),
        mood: sanitizeNpcFieldText('mood', rawState.mood),
        status: sanitizeNpcFieldText('status', rawState.status),
      };
      const idObj = collectCharacterIdentityKeys(cleanedMc.name);
      const existingMcIdx = kept.findIndex((k) => k.state.isMc);
      if (existingMcIdx >= 0) {
        const cur = kept[existingMcIdx].state;
        const incomingNewer =
          (cleanedMc.updatedAt || 0) >= (cur.updatedAt || 0);
        kept[existingMcIdx].state = {
          ...cur,
          name: incomingNewer ? cleanedMc.name || cur.name : cur.name || cleanedMc.name,
          location: incomingNewer
            ? cleanedMc.location || cur.location
            : cur.location || cleanedMc.location,
          mood: incomingNewer
            ? cleanedMc.mood || cur.mood
            : cur.mood || cleanedMc.mood,
          status: incomingNewer
            ? cleanedMc.status || cur.status
            : cur.status || cleanedMc.status,
          lastTurnIndex:
            typeof cur.lastTurnIndex === 'number' &&
            typeof cleanedMc.lastTurnIndex === 'number'
              ? Math.max(cur.lastTurnIndex, cleanedMc.lastTurnIndex)
              : cleanedMc.lastTurnIndex ?? cur.lastTurnIndex,
          updatedAt: Math.max(cur.updatedAt || 0, cleanedMc.updatedAt || 0),
        };
        removedNames.push(rawState.name);
      } else {
        kept.push({ state: cleanedMc, identity: idObj });
      }
      continue;
    }

    if (isInvalidNpcState(rawState, allowedKeys, extraBlockedKeys)) {
      removedNames.push(rawState.name);
      continue;
    }

    const sanitizedName = sanitizeCharacterName(
      rawState.name,
      allowedKeys,
      extraBlockedKeys,
    );
    if (!sanitizedName) {
      removedNames.push(rawState.name);
      continue;
    }

    const cleanedState: CharacterStateSnapshot = {
      ...rawState,
      name: sanitizedName,
      location: sanitizeNpcFieldText('location', rawState.location),
      mood: sanitizeNpcFieldText('mood', rawState.mood),
      status: sanitizeNpcFieldText('status', rawState.status),
    };

    const identity = collectCharacterIdentityKeys(rawState.name, [
      sanitizedName,
      rawState.status,
    ]);

    const dupIdx = kept.findIndex((k) =>
      areIdentityKeysShadowMatch(k.identity.aliasKeys, identity.aliasKeys),
    );

    if (dupIdx >= 0) {
      const cur = kept[dupIdx].state;
      const incomingNewer =
        (cleanedState.updatedAt || 0) >= (cur.updatedAt || 0);
      const curParody = isPlayfulTeasingOrParodyName(cur.name);
      const incParody = isPlayfulTeasingOrParodyName(cleanedState.name);
      const preferIncomingName =
        !cur.isMc &&
        !incParody &&
        (curParody ||
          (!lookupKnownCelebrityProfile(cur.name) &&
            Boolean(lookupKnownCelebrityProfile(cleanedState.name))) ||
          (cleanedState.name.includes(' ') && !cur.name.includes(' ')));
      kept[dupIdx].state = {
        ...cur,
        name: preferIncomingName ? cleanedState.name : cur.name,
        location: incomingNewer
          ? cleanedState.location || cur.location
          : cur.location || cleanedState.location,
        mood: incomingNewer
          ? cleanedState.mood || cur.mood
          : cur.mood || cleanedState.mood,
        status: incomingNewer
          ? cleanedState.status || cur.status
          : cur.status || cleanedState.status,
        lastTurnIndex:
          typeof cur.lastTurnIndex === 'number' &&
          typeof cleanedState.lastTurnIndex === 'number'
            ? Math.max(cur.lastTurnIndex, cleanedState.lastTurnIndex)
            : cleanedState.lastTurnIndex ?? cur.lastTurnIndex,
        updatedAt: Math.max(cur.updatedAt || 0, cleanedState.updatedAt || 0),
      };
      for (const ak of identity.aliasKeys) {
        kept[dupIdx].identity.aliasKeys.add(ak);
      }
      removedNames.push(rawState.name);
      continue;
    }

    kept.push({ state: cleanedState, identity });
  }

  return {
    states: kept.map((k) => k.state),
    removedNames,
  };
}

/**
 * Cleans invalid non-person entries and duplicates from a CompanionProfile's NPC array
 * while preserving legitimate user-defined NPCs.
 */
export function cleanJunkCompanionNpcs(npcs: CompanionNpc[]): CompanionNpc[] {
  const kept: Array<{
    npc: CompanionNpc;
    identity: { primaryKey: string; aliasKeys: Set<string> };
  }> = [];

  for (const npc of npcs || []) {
    if (!npc || !npc.name?.trim()) continue;
    const { baseName } = splitNameAndParentheticalAliases(npc.name);
    const key = normalizeCharacterKey(baseName);
    if (
      !key ||
      JUNK_EXACT_PHRASES.has(key) ||
      STRICT_NON_PERSON_SUBSTRING_RE.test(key) ||
      STRICT_VI_NON_PERSON_PREFIX_RE.test(baseName) ||
      STRICT_VI_COMPASS_OR_GEO_EXACT_RE.test(baseName) ||
      STRICT_VI_NON_NAME_TOKEN_RE.test(baseName) ||
      isLyricOrExclamationJunkName(baseName) ||
      isPlayfulTeasingOrParodyName(baseName) ||
      isChatOrNonPersonDescription(baseName) ||
      isChatOrNonPersonDescription(npc.role) ||
      isChatOrNonPersonDescription(npc.desc) ||
      isChatOrNonPersonDescription(npc.appearance)
    ) {
      continue;
    }

    const identity = collectCharacterIdentityKeys(npc.name, [
      npc.role,
      npc.signature,
    ]);
    const dupIdx = kept.findIndex(
      (k) =>
        areIdentityKeysShadowMatch(k.identity.aliasKeys, identity.aliasKeys) ||
        isTeasingOrSpellingVariantOf(npc.name, k.npc.name) ||
        isTeasingOrSpellingVariantOf(k.npc.name, npc.name),
    );
    if (dupIdx >= 0) continue;

    kept.push({
      npc: {
        ...npc,
        role: sanitizeNpcFieldText('role', npc.role) || npc.role,
        appearance:
          sanitizeNpcFieldText('appearance', npc.appearance) || undefined,
      },
      identity,
    });
  }

  return kept.map((k) => k.npc);
}

const VISUAL_APPEARANCE_CUE_RE =
  /(?:\b(?:mặc|khoác|diện|đeo|mang|cầm|ngậm|hút|tóc|mái\s*tóc|đôi\s*mắt|ánh\s*mắt|khuôn\s*mặt|gương\s*mặt|làn\s*da|nước\s*da|dáng\s*người|vóc\s*dáng|thân\s*hình|chiều\s*cao|áo|quần|váy|đầm|vest|suit|blazer|jacket|hoodie|vải\s*lanh|linen|lụa|nhung|da\s*bóng|da\s*đen|denim|jeans|thể\s*thao|tracksuit|dự\s*tiệc|giày|bốt|boots|sneaker|kính|mắt\s*kính|dây\s*chuyền|vòng\s*cổ|nhẫn|khuyên\s*tai|đồng\s*hồ|túi\s*xách|mũ|nón|son\s*môi|trang\s*điểm|hình\s*xăm|tattoo|râu|thần\s*thái|khí\s*chất|phong\s*cách|thuốc\s*lá\s*điện\s*tử|vape|điếu\s*thuốc|ly\s*rượu|rượu\s*vang|vệt\s*rượu|dính\s*vệt|màu\s*(?:đen|trắng|xám|đỏ|vàng|bạc|xanh|nâu|hồng|tím|be|kem)|xám\s*than|bạch\s*kim|lạnh\s*lùng|gợi\s*cảm|sang\s*trọng|bụi\s*bặm|thanh\s*lịch|phóng\s*khoáng)\b)/i;

function trimClean(text: string | undefined | null, maxLen: number): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen);
  const lastBreak = Math.max(
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf(', '),
    sliced.lastIndexOf('; '),
  );
  if (lastBreak >= Math.floor(maxLen * 0.55)) {
    return sliced.slice(0, lastBreak).trim();
  }
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.7)
    ? sliced.slice(0, lastSpace)
    : sliced
  ).trim();
}

export function extractVisualCuesForCharacter(
  cleanStoryText: string,
  charName: string,
): string {
  const text = String(cleanStoryText || '').trim();
  const fullKey = normalizeCharacterKey(charName);
  if (!text || !fullKey) return '';

  // Also check first token for multi-word names (e.g. "Jennie" for "Jennie Kim", "Kendall" for "Kendall Jenner")
  const tokens = fullKey.split(/\s+/).filter(Boolean);
  const primaryAlias =
    tokens.length >= 2 && tokens[0].length >= 4 ? tokens[0] : '';

  const sentences = text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  const collected: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const sNorm = normalizeCharacterKey(s);
    const mentions =
      sNorm.includes(fullKey) ||
      (primaryAlias !== '' &&
        new RegExp(`(?:^|[^a-z0-9])${String(primaryAlias ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`).test(
          sNorm,
        ));

    if (!mentions) continue;

    if (VISUAL_APPEARANCE_CUE_RE.test(s)) {
      collected.push(s);
    } else if (i + 1 < sentences.length) {
      // Check immediately following sentence if it describes appearance/clothing of this character
      const nextS = sentences[i + 1];
      if (VISUAL_APPEARANCE_CUE_RE.test(nextS)) {
        collected.push(nextS);
      }
    }
    if (collected.length >= 2) break;
  }

  if (!collected.length) return '';
  return trimClean(collected.join(' '), 220);
}

const ABSENCE_CUE_RE =
  /(?:khong\s+co\s+mat|vang\s+mat|vang\s+bong|khong\s+o\s+(?:my|day|tai|bua\s+tiec|phong|canh|hien\s+truong|do|los\s+angeles|beverly|hollywood|bua\s+tiec)|khong\s+tham\s+du|khong\s+xuat\s+hien|chua\s+(?:toi|den|xuat\s+hien|co\s+mat|ve)|o\s+cach\s+xa|o\s+nua\s+vong\s+trai\s+dat|khong\s+di\s+cung|ngoai\s+canh|khong\s+lien\s+quan\s+den|bo\s+qua\s+nvc|khong\s+co\s+nvc|khong\s+co\s+nhan\s+vat\s+chinh|khong\s+dua\s+nvc|dang\s+o\s+(?:viet\s+nam|ha\s+noi|sai\s+gon|tp\s*hcm|han\s+quoc|seoul|nhat\s+ban|tokyo|london|paris|noi\s+khac|thanh\s+pho\s+khac|nha\s+rieng|que)|o\s+(?:thanh\s+pho\s+khac|noi\s+khac|ben\s+kia)|da\s+roi\s+(?:di|khoi)|vua\s+roi\s+(?:di|khoi)|chi\s+(?:nhac\s+den|nhac\s+toi|goi\s+dien|nhan\s+tin)|qua\s+(?:dien\s+thoai|tin\s+nhan|man\s+hinh)|not\s+present|absent|not\s+in\s+the\s+us|not\s+in\s+america|not\s+at\s+the\s+party|off-?screen|without\s+(?:the\s+)?mc)/i;

const GENERIC_MC_ABSENCE_RE =
  /(?:\b(?:nvc|mc|nhan\s+vat\s+chinh)\b[^.!?\n]{0,65}(?:khong\s+co\s+mat|vang\s+mat|vang\s+bong|khong\s+o\s+(?:my|day|tai|do|canh|bua\s+tiec)|khong\s+tham\s+du|khong\s+xuat\s+hien|chua\s+(?:toi|den)|ngoai\s+canh|not\s+present|absent|not\s+in\s+the\s+us|off-?screen)|(?:khong\s+co\s+mat|vang\s+mat|khong\s+co|bo\s+qua|khong\s+xuat\s+hien|without)\s+(?:cua\s+)?(?:nvc|mc|nhan\s+vat\s+chinh)\b)/i;

const VIET_SURNAME_KEYS = new Set([
  'nguyen',
  'tran',
  'le',
  'pham',
  'hoang',
  'huynh',
  'phan',
  'vu',
  'vo',
  'dang',
  'bui',
  'do',
  'ho',
  'ngo',
  'duong',
  'ly',
  'truong',
  'dinh',
  'lam',
  'dao',
  'doan',
  'vuong',
  'trinh',
  'cao',
  'thai',
  'luong',
  'ta',
  'mai',
  'chu',
  'la',
  'kieu',
  'phung',
  'bach',
  'han',
  'luc',
  'co',
  'ton',
  'to',
  'mac',
]);

// Extended Vietnamese + Sino-Vietnamese / Xianxia / Wuxia personal surnames
const ALL_PERSON_SURNAME_KEYS = new Set([
  ...VIET_SURNAME_KEYS,
  'lieu',
  'tieu',
  'diep',
  'so',
  'tan',
  'tham',
  'giang',
  'lang',
  'lanh',
  'mo',
  'luu',
  'trieu',
  'nguy',
  'tong',
  'hua',
  'ninh',
  'yen',
  'quy',
  'tu',
  'thich',
  'van',
  'phong',
  'hoa',
  'ha',
  'tiet',
  'khong',
  'nghiem',
  'nguyet',
  'manh',
  'thach',
  'khuc',
  'uong',
  'du',
  'cu',
  'au',
  'thuong',
  'dong',
  'nam',
  'tay',
  'bac',
  'gia',
  'nap',
  'lac',
  'lo',
  'tri',
  'quan',
  'khuong',
  'nham',
  'nhiep',
  'cam',
  'khau',
  'trien',
  'chuc',
  'vien',
  'ung',
  'pho',
  'phuong',
  'duyen',
  'bich',
  'kim',
  'trung',
  'quach',
  'an',
  'dieu',
  'hong',
  'khanh',
  'minh',
  'quang',
]);

const VIET_HONORIFIC_BEFORE_RE =
  /(?:^|[\s,.;:!?("“«—-])(?:anh|chị|cô|em|chú|bác|ông|bà|cậu|nàng|chàng|tiểu\s+thư|công\s+tử|thiếu\s+gia|thiếu\s+chủ|ngài|bạn|bé|lão|thầy|sư\s+tỷ|sư\s+huynh|sư\s+muội|sư\s+đệ|sư\s+phụ|sư\s+tôn|sư\s+thúc|sư\s+bá|trưởng\s+lão|đạo\s+hữu|đạo\s+trưởng|tiền\s+bối|chưởng\s+quỹ|chưởng\s+môn|tông\s+chủ|lão\s+nhân|tiên\s+tử|đại\s+hiệp|nữ\s+hiệp)\s+$/iu;

function escapeRegExp(str?: string | null): string {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sentenceMentionsKey(sentenceNorm: string, key: string): boolean {
  if (!key || key.length < 2) return false;
  if (key.includes(' ')) return sentenceNorm.includes(key);
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(key)}(?:$|[^a-z0-9])`).test(
    sentenceNorm,
  );
}

/**
 * Removes quoted dialogue so narrative POV checks (e.g. first-person "tôi bước/nói")
 * do not false-trigger on dialogue spoken by other characters in a third-person scene.
 */
export function stripQuotedDialogue(text: string): string {
  return String(text || '')
    .replace(/“[^”\n]{1,600}”/g, ' ')
    .replace(/"[^"\n]{1,600}"/g, ' ')
    .replace(/«[^»\n]{1,600}»/g, ' ');
}

/**
 * Matches a character name in Vietnamese/Western prose while preserving Vietnamese diacritics
 * and requiring proper capitalization for single-word terms.
 * Prevents catastrophic false positives such as matching "Hoàng Long" against "lòng" / "lông" / "lồng".
 */
export function findExactProperNameInText(
  text: string,
  charName: string,
  options?: { allowHonorificShortName?: boolean },
): {
  count: number;
  firstIndex: number;
  lastIndex: number;
  matchedDisplay: string;
} {
  const rawText = String(text || '');
  const cleanName = String(charName || '').trim();
  if (!rawText || !cleanName || cleanName.length < 2) {
    return { count: 0, firstIndex: -1, lastIndex: -1, matchedDisplay: cleanName };
  }

  const terms: Array<{
    term: string;
    requireCapital: boolean;
    requireHonorificOrColon: boolean;
  }> = [];
  const seenTerms = new Set<string>();

  const pushTerm = (
    term: string,
    requireCapital: boolean,
    requireHonorificOrColon: boolean,
  ) => {
    const t = term.trim();
    if (!t || t.length < 2) return;
    const k = t.toLowerCase();
    if (seenTerms.has(k)) return;
    seenTerms.add(k);
    terms.push({ term: t, requireCapital, requireHonorificOrColon });
  };

  const parts = cleanName.split(/\s+/).filter(Boolean);
  const isMultiWord = parts.length >= 2;
  // Full name: diacritic-exact; single-word names must start with uppercase letter
  pushTerm(cleanName, !isMultiWord, false);

  // Known celebrity aliases (exact spelling, uppercase-initial required for single-word aliases)
  const celeb = lookupKnownCelebrityProfile(cleanName);
  if (celeb) {
    pushTerm(celeb.canonicalName, !/\s/.test(celeb.canonicalName), false);
    for (const alias of celeb.aliases || []) {
      const a = alias.trim();
      if (a.length >= 3) {
        pushTerm(a, !/\s/.test(a), false);
      }
    }
  }

  if (isMultiWord) {
    const firstKey = normalizeCharacterKey(parts[0]);
    const lastPart = parts[parts.length - 1];
    // For Western multi-word names (e.g. "Kendall Jenner"), allow capitalized first name if >= 4 chars
    if (parts[0].length >= 4 && !VIET_SURNAME_KEYS.has(firstKey)) {
      pushTerm(parts[0], true, false);
    }
    // For Vietnamese multi-word names, only match the short given name when preceded by an honorific
    // (e.g. "anh Thiện", "cô Linh") or followed by speaker colon ("Thiện:"), preserving exact diacritics.
    if (
      options?.allowHonorificShortName &&
      VIET_SURNAME_KEYS.has(firstKey) &&
      lastPart.length >= 3
    ) {
      pushTerm(lastPart, true, true);
    }
  }

  let totalCount = 0;
  let firstIndex = -1;
  let lastIndex = -1;
  let matchedDisplay = cleanName;
  let bestDisplayScore = -1;

  for (const spec of terms) {
    const escaped = escapeRegExp(spec.term);
    const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
    let m: RegExpExecArray | null;
    let termCount = 0;
    let termLastMatch = '';

    while ((m = re.exec(rawText)) !== null) {
      const matched = m[0];
      if (spec.requireCapital && !/^[\p{Lu}]/u.test(matched)) continue;

      if (spec.requireHonorificOrColon) {
        const beforeSlice = rawText.slice(Math.max(0, m.index - 24), m.index);
        const afterSlice = rawText.slice(
          m.index + matched.length,
          m.index + matched.length + 6,
        );
        const hasHonorific = VIET_HONORIFIC_BEFORE_RE.test(beforeSlice);
        const isSpeakerColon = /^\s*:\s*/.test(afterSlice);
        if (!hasHonorific && !isSpeakerColon) continue;
      }

      termCount += 1;
      totalCount += 1;
      if (firstIndex < 0 || m.index < firstIndex) firstIndex = m.index;
      if (m.index > lastIndex) lastIndex = m.index;
      termLastMatch = matched.trim();
    }

    if (termCount > 0 && termLastMatch) {
      // Prefer full name display over short alias when both match
      const displayScore =
        termCount + (spec.term.includes(' ') ? 10 : 0) - (spec.requireHonorificOrColon ? 5 : 0);
      if (displayScore > bestDisplayScore) {
        bestDisplayScore = displayScore;
        matchedDisplay = spec.requireHonorificOrColon ? cleanName : termLastMatch;
      }
    }
  }

  return { count: totalCount, firstIndex, lastIndex, matchedDisplay };
}

interface ExactNameMatchSpan {
  start: number;
  end: number;
  matched: string;
  requireHonorificOrColon: boolean;
  displayName: string;
}

const CHAT_BLOCK_HEADER_RE =
  /^(?:[📱💬📩🔔📲💻🖥️\s>*#_\-\[「『【]*)(?:nhóm\s+chat|group\s+chat|khung\s+chat|phòng\s+chat|tin\s+nhắn(?:\s+nhóm|\s+mới|\s+từ)?|hộp\s+thư|thông\s+báo(?:\s+mới|\s+tin\s+nhắn)?|kakaotalk|kakao\s+talk|zalo|messenger|imessage|instagram\s*(?:dm|live|story)?|wechat|whatsapp|telegram|discord|weverse|bubble|diễn\s+đàn|bình\s+luận|mục\s+bình\s+luận|bài\s+đăng|màn\s+hình\s+điện\s+thoại(?:\s+hiển\s+thị|\s+sáng\s+lên)?)\b/iu;

const SINGLE_CHAT_OR_NOTIFICATION_LINE_RE =
  /^(?:[📱💬📩🔔📲]|(?:\[|\*\*)?(?:nhóm\s+chat|group\s+chat|tin\s+nhắn|thông\s+báo|bình\s+luận|comment|reply|dm|inbox|kakaotalk|zalo|messenger|instagram|tiktok|weverse|bubble)(?:\]|\*\*)?\s*[:\-–—]|@[A-Za-z0-9._]{2,24}\s*:)/iu;

const CHAT_MESSAGE_MEMBER_LINE_RE =
  /^(?:>\s*|[-•*+]\s*)?(?:\[[^\]]{1,36}\]|\*\*[^*\n]{1,36}\*\*|[\p{L}@][\p{L}\p{N}_.\s'’-]{0,28})(?:\s*\(\d{1,2}:\d{2}\)|\s*\[\d{1,2}:\d{2}\])?\s*[:：]\s*.+/u;

const CHAT_TIMESTAMP_OR_META_LINE_RE =
  /^(?:>\s*)?(?:\d{1,2}:\d{2}(?:\s*(?:AM|PM))?|đã\s+xem|seen(?:\s+by)?|typing|đang\s+nhập|thành\s+viên|\d+\s+(?:người|thành\s+viên|lượt\s+thích|bình\s+luận)|❤️|👍|😂|🔥|\[ảnh\]|\[sticker\]|\[hình\s+ảnh\]|\[video\])/iu;

const CHAT_BLOCK_END_FENCE_RE = /^(?:---|===|___|\*\*\*|```|\]|】|』|」)\s*$/;

const LYRIC_SECTION_HEADER_RE =
  /^(?:\*{0,2}\s*)?(?:\[\s*(?:verse(?:\s*\d+)?|chorus|pre-?chorus|post-?chorus|hook|pre-?hook|bridge|outro|intro|drop|beat\s*drop|4[\s-]*bars?|bar\s*\d+(?:\s*[-–]\s*\d+)?|rap(?:\s*\d+)?|flow|melody|refrain|ad-?libs?|instrumental|điệp\s+khúc|lời\s+bài\s+hát|lyric(?:s)?|phần\s+(?:hát|rap)|nhịp\s+4[\s-]*bar)\s*\]|(?:lời\s+bài\s+hát|lyric(?:s)?|điệp\s+khúc|câu\s+hát|câu\s+rap|đoạn\s+(?:hát|rap|nhạc|hook|verse|chorus|drop)|beat(?:\s+drop)?|drop|4[\s-]*bars?|nhạc|bài\s+hát|tên\s+(?:bài\s+hát|ca\s+khúc)|ca\s+khúc|bản\s+(?:nhạc|rap|hit)|track|song|now\s+playing|đang\s+phát|bật\s+(?:nhạc|bài|beat)|mở\s+(?:nhạc|bài|beat)|phát\s+(?:nhạc|bài)|rap|hát|flow)\s*:)(?:\s*\*{0,2})?\s*$/iu;

const LYRIC_LINE_START_PREFIX_RE =
  /^(?:\*{0,2}\s*)?(?:lời\s+bài\s+hát|lyric(?:s)?|điệp\s+khúc|câu\s+hát|câu\s+rap|beat(?:\s+drop)?|drop|4[\s-]*bars?|tên\s+(?:bài\s+hát|ca\s+khúc)|bài\s+hát|ca\s+khúc|track(?:\s+nhạc)?|song|now\s+playing|đang\s+phát|playlist)\s*[:—–-]\s*.+/iu;

const LYRIC_INLINE_CUE_RE =
  /(?:♪|♫|🎵|🎶|🎤|🎧|(?:lời\s+bài\s+hát|ca\s+từ|điệp\s+khúc|câu\s+hát|câu\s+rap|đoạn\s+(?:hát|rap|hook|verse|chorus|bridge|drop|nhạc)|ngân\s+nga|ngâm\s+nga|cất\s+giọng(?:\s+hát)?|hát\s+(?:vang|theo|nhẩm|khẽ|lên|tiếp|câu|đoạn|bài)|lẩm\s+nhẩm\s+hát|rap\s+(?:theo|tiếp|câu|đoạn|một\s+đoạn|bài|trên\s+beat)|thả\s+(?:4[\s-]*bars?|bar|verse|hook|rap|lyric|beat)|nhịp\s+4[\s-]*bars?|4[\s-]*bars?|beat\s+drop|drop\s+beat|vào\s+beat|lên\s+beat|theo\s+beat|trên\s+nền\s+beat|bật\s+(?:nhạc|bài|beat|ca\s+khúc|track)|mở\s+(?:nhạc|bài|beat|ca\s+khúc|track)|nghe\s+(?:nhạc|bài|ca\s+khúc|track|rap)|phát\s+(?:nhạc|bài|ca\s+khúc|track)|loa\s+phát(?:\s+lên)?|nhạc\s+(?:vang\s+lên|nổi\s+lên|đang\s+phát)|giai\s+điệu\s+vang\s+lên|tên\s+(?:bài\s+hát|ca\s+khúc)|ca\s+khúc|bài\s+hát|bản\s+(?:nhạc|rap|hit)|track\s+nhạc|playlist|spotify|soundcloud|karaoke)\b)/iu;

const MUSIC_OR_LYRIC_CLAUSE_RE =
  /(?:\bloi\s+bai\s+hat\b|\bca\s+tu\b|\blyrics?\b|\bdiep\s+khuc\b|\bcau\s+hat\b|\bcau\s+rap\b|\bdoan\s+(?:hat|rap|hook|verse|chorus|bridge|drop|nhac)\b|\bbai\s+hat\b|\bca\s+khuc\b|\bban\s+(?:nhac|rap|hit)\b|\bngan\s+nga\b|\bngam\s+nga\b|\bhat\s+(?:vang|theo|nham|khe|len|tiep|cau|doan|bai)\b|\brap\s+(?:theo|tiep|cau|doan|bai)\b|\bcat\s+giong(?:\s+hat)?\b|\bgiai\s+dieu\b|\bbeat(?:\s+(?:nhac|drop))?\b|\bdrop\s+beat\b|\b4[\s-]*bars?\b|\btha\s+(?:4[\s-]*bars?|bar|verse|hook|rap|lyric|beat)\b|\bbat\s+(?:nhac|bai|beat)\b|\bmo\s+(?:nhac|bai|beat)\b|\bnghe\s+(?:nhac|bai|ca\s+khuc|rap)\b|\bphat\s+(?:nhac|bai)\b|\bloa\s+phat\b|\bvang\s+len\s+tu\s+loa\b|\bnhac\s+(?:vang|noi)\s+len\b|\btrack\s+nhac\b|\bplaylist\b|\bspotify\b|\bsoundcloud\b|\bkaraoke\b|\bhook\b|\bchorus\b|\bverse\b)/i;

/**
 * Strips song lyrics, musical note lines, verse/chorus/4-bar/beat/drop stanzas, inline song titles,
 * and quoted lyric hooks so words inside music/lyrics (e.g. "Ngu Nè!", "Chạy Ngay Đi")
 * are NEVER scanned as NPCs.
 */
export function stripSongLyricBlocks(text: string): string {
  const raw = String(text || '')
    .replace(/<(?:lyric|lyrics|song|music)\b[^>]*>[\s\S]*?<\/(?:lyric|lyrics|song|music)>/gi, '\n')
    .replace(/```(?:lyric|lyrics|song|music|rap)[\s\S]*?```/gi, '\n');
  if (!raw.trim()) return raw;

  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let inLyricBlock = false;
  let blankStreak = 0;

  // Pre-detect consecutive slash-delimited rap/lyric bar runs (e.g. 2+ lines containing " / " or "//")
  const isSlashBarLine = (s: string): boolean =>
    s.length <= 180 && (/\s\/\/?\s/.test(s) || (s.match(/\s\/\s/g) || []).length >= 1);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (inLyricBlock) {
        blankStreak += 1;
        // Peek ahead: if next non-empty line is another lyric tag / musical note / slash bar, stay in lyric mode
        const nextTrim = (lines[i + 1] || '').trim();
        if (
          blankStreak >= 2 ||
          (nextTrim &&
            !LYRIC_SECTION_HEADER_RE.test(nextTrim) &&
            !/[♪♫🎵🎶🎤]/.test(nextTrim) &&
            !isSlashBarLine(nextTrim))
        ) {
          inLyricBlock = false;
          blankStreak = 0;
        }
      }
      out.push('');
      continue;
    }

    blankStreak = 0;

    // Musical note symbols anywhere on a short/medium line -> lyric line
    if (/[♪♫🎵🎶🎤]/.test(trimmed)) {
      if (trimmed.length <= 240) {
        inLyricBlock = true;
        out.push('');
        continue;
      }
      const strippedInline = line
        .replace(/[♪♫🎵🎶🎤][^♪♫🎵🎶🎤\n]{1,240}[♪♫🎵🎶🎤]/g, ' ')
        .replace(/[♪♫🎵🎶🎤]\s*["“«][^"”»\n]{1,220}["”»]/g, ' ');
      out.push(strippedInline);
      continue;
    }

    if (LYRIC_SECTION_HEADER_RE.test(trimmed)) {
      inLyricBlock = true;
      out.push('');
      continue;
    }

    // Explicit labeled lyric/song/beat/4-bar line (e.g. "Bài hát: Ngu Nè", "4-bar: ...", "Lyric: ...")
    if (LYRIC_LINE_START_PREFIX_RE.test(trimmed)) {
      if (trimmed.length <= 220) {
        inLyricBlock = true;
        out.push('');
        continue;
      }
    }

    if (inLyricBlock) {
      if (CHAT_BLOCK_END_FENCE_RE.test(trimmed)) {
        inLyricBlock = false;
        out.push('');
        continue;
      }
      const isShortLyricLine =
        trimmed.length <= 145 &&
        (/^[*_>—–-]/.test(trimmed) ||
          /^["“«][^"”»\n]{1,135}["”»]$/.test(trimmed) ||
          /\s\/\/?\s/.test(trimmed) ||
          trimmed.split(/\s+/).length <= 16);
      if (isShortLyricLine) {
        out.push('');
        continue;
      }
      inLyricBlock = false;
    }

    // Slash-separated lyric lines: 2+ slashes on one line OR 2+ consecutive lines with slash bar dividers
    const prevTrim = i > 0 ? lines[i - 1].trim() : '';
    const nextTrim = i + 1 < lines.length ? lines[i + 1].trim() : '';
    if (
      (trimmed.length <= 180 && (trimmed.match(/\s\/\/?\s/g) || []).length >= 2) ||
      (isSlashBarLine(trimmed) &&
        (isSlashBarLine(prevTrim) ||
          isSlashBarLine(nextTrim) ||
          LYRIC_INLINE_CUE_RE.test(trimmed)))
    ) {
      inLyricBlock = true;
      out.push('');
      continue;
    }

    // Narrative or user prompt introducing music/lyrics/song titles/beat/4-bar:
    // strip quoted lyrics, italic lyrics, and song titles right after music nouns/verbs while keeping real actors intact
    if (LYRIC_INLINE_CUE_RE.test(trimmed)) {
      const strippedQuotedLyrics = line
        .replace(
          /((?:hát|rap|ngân\s+nga|ngâm\s+nga|điệp\s+khúc|lời\s+bài\s+hát|ca\s+từ|câu\s+hát|câu\s+rap|đoạn\s+(?:hát|rap|hook|verse|chorus|drop)|bài\s+hát|ca\s+khúc|tên\s+(?:bài\s+hát|ca\s+khúc)|bản\s+(?:nhạc|rap|hit)|track(?:\s+nhạc)?|bật\s+(?:nhạc|bài|beat)|mở\s+(?:nhạc|bài|beat)|nghe\s+(?:nhạc|bài|ca\s+khúc)|phát\s+(?:nhạc|bài)|thả\s+(?:4[\s-]*bars?|bar|verse|hook|rap|lyric|beat)|loa\s+phát|vang\s+lên)[^"\n“«'‘]{0,48})["“«'‘][^"”»'’\n]{1,280}["”»'’]/giu,
          '$1 ',
        )
        .replace(
          /\b(?:bài\s+hát|ca\s+khúc|tên\s+bài(?:\s+hát)?|tên\s+ca\s+khúc|track(?:\s+nhạc)?|bản\s+(?:nhạc|rap|hit)|bật\s+bài|mở\s+bài|nghe\s+bài|phát\s+bài|hát\s+bài|rap\s+bài|cover\s+bài)\s+(?:tên\s+)?(?:là\s+)?(?:[\p{Lu}][\p{L}\p{N}'’-]{1,20}(?:\s+[\p{Lu}\p{L}][\p{L}\p{N}'’-]{1,20}){0,5})/giu,
          ' ',
        )
        .replace(/\*[^*\n]{2,180}\*/g, ' ');

      // If this line introduces a multi-line stanza (ends with :, —, or mentions 4-bar/lyric/beat/drop followed by short lines)
      const nextLooksLikeStanza =
        Boolean(nextTrim) &&
        nextTrim.length <= 130 &&
        nextTrim.split(/\s+/).length <= 15 &&
        (/:\s*$/.test(trimmed) ||
          /(?:4[\s-]*bars?|lyric|lời\s+bài\s+hát|điệp\s+khúc|thả\s+(?:bar|rap|verse|hook|beat)|beat\s+drop|drop\s+beat|vào\s+beat|câu\s+rap|câu\s+hát|đoạn\s+(?:rap|hát))/iu.test(
            trimmed,
          ));
      if (/:\s*$/.test(trimmed) || nextLooksLikeStanza) {
        inLyricBlock = true;
      }
      out.push(strippedQuotedLyrics);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * Strips simulated group-chat logs, phone message UI blocks, notification lines,
 * social media comment threads, and song lyric blocks so characters appearing ONLY inside
 * chat messages or song lyrics (e.g. "[Nhóm chat] Wonyoung: ...", "♪ Ngu Nè ♪")
 * are never extracted as physically present NPCs.
 */
export function stripNonSceneChatBlocks(text: string): string {
  const raw = stripSongLyricBlocks(String(text || ''));
  if (!raw.trim()) return raw;

  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let inChatBlock = false;
  let blankStreakInChat = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (inChatBlock) {
        blankStreakInChat += 1;
        // Peek ahead: if next non-empty line is NOT a chat message line, exit chat block
        const nextLine = (lines[i + 1] || '').trim();
        if (
          blankStreakInChat >= 2 ||
          (nextLine &&
            !CHAT_MESSAGE_MEMBER_LINE_RE.test(nextLine) &&
            !CHAT_TIMESTAMP_OR_META_LINE_RE.test(nextLine) &&
            !SINGLE_CHAT_OR_NOTIFICATION_LINE_RE.test(nextLine) &&
            !nextLine.startsWith('>'))
        ) {
          inChatBlock = false;
          blankStreakInChat = 0;
        }
      }
      out.push('');
      continue;
    }

    blankStreakInChat = 0;

    if (CHAT_BLOCK_HEADER_RE.test(trimmed)) {
      inChatBlock = true;
      out.push('');
      continue;
    }

    if (inChatBlock) {
      if (CHAT_BLOCK_END_FENCE_RE.test(trimmed)) {
        inChatBlock = false;
        out.push('');
        continue;
      }
      if (
        CHAT_MESSAGE_MEMBER_LINE_RE.test(trimmed) ||
        CHAT_TIMESTAMP_OR_META_LINE_RE.test(trimmed) ||
        SINGLE_CHAT_OR_NOTIFICATION_LINE_RE.test(trimmed) ||
        trimmed.startsWith('>') ||
        trimmed.startsWith('💬') ||
        trimmed.startsWith('📱') ||
        /^["“«].{1,160}["”»]$/.test(trimmed)
      ) {
        out.push('');
        continue;
      }
      // Normal long narrative prose exits the chat block
      inChatBlock = false;
    }

    if (SINGLE_CHAT_OR_NOTIFICATION_LINE_RE.test(trimmed)) {
      out.push('');
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * Strips quoted song/album/movie/work titles and quoted dialogue for strict new-NPC discovery,
 * preventing song titles ("Chạy Ngay Đi") and passing dialogue mentions ("Wonyoung ở SM")
 * from spawning false-positive NPCs.
 */
export function stripQuotedMediaAndDialogue(text: string): string {
  return String(text || '')
    .replace(/“[^”\n]{1,600}”/g, ' ')
    .replace(/"[^"\n]{1,600}"/g, ' ')
    .replace(/«[^»\n]{1,600}»/g, ' ')
    .replace(/‘[^’\n]{1,120}’/g, ' ');
}

const INDIRECT_MENTION_BEFORE_RE =
  /(?:(?:nhan\s+tin|nhan\s+lai|nhan|gui\s+tin(?:\s+nhan)?|tra\s+loi(?:\s+tin(?:\s+nhan)?)?|rep(?:\s+tin(?:\s+nhan)?)?|dm|inbox|text|imessage|chat|lien\s+lac|lien\s+he|bao\s+tin|bao(?:\s+truoc)?|goi\s+dien(?:\s+thoai)?|goi\s+lai|goi\s+video|goi|facetime|call|bam\s+so(?:\s+cua)?|nhac\s+may\s+goi|bat\s+may(?:\s+cua)?)\s+(?:cho|voi|toi|den|sang|lai\s+cho|cung|cua|trong\s+nhom(?:\s+chat)?|vao\s+nhom(?:\s+chat)?)?(?:\s+(?:co|anh|chi|em|be|nang|cau|ban))?|(?:tin\s+nhan|nhom\s+chat|group\s+chat|khung\s+chat|cuoc\s+goi(?:\s+nho)?|thong\s+bao|dong\s+tin|man\s+hinh(?:\s+dien\s+thoai)?(?:\s+hien(?:\s+ten)?)?|hien\s+ten|ten\s+cua|giong(?:\s+noi|\s+hat|\s+rap)?(?:\s+qua\s+loa|\s+kieu)?(?:\s+cua)?|story|bai\s+dang|binh\s+luan|anh\s+chup|buc\s+anh|hinh\s+anh|poster|video|clip|tin\s+don|bai\s+bao|lich\s+trinh|cuoc\s+hen|lich\s+hen|nhac|bai\s+hat|bai|ca\s+khuc|ban\s+nhac|beat|rap|mv|album|playlist|bo\s+phim|phim|show|tai\s+khoan|nick|fan)\s+(?:cua|tu|ve|ghi|la|voi|gui\s+den|kieu|co)?|(?:bat\s+nhac|mo\s+nhac|nghe\s+nhac|nghe\s+bai|hat\s+bai|cover\s+bai|phat\s+nhac|phat\s+bai|chon\s+nhac|de\s+nhac|playlist\s+co|trong\s+nhom\s+chat|vao\s+nhom\s+chat|tren\s+nhom\s+chat|nghe\s+danh|biet\s+danh|hay\s+con\s+goi\s+la|thuong\s+goi\s+la|aka|ga\s+nha|thuc\s+tap\s+sinh(?:\s+cua)?|thuoc\s+cong\s+ty|cua\s+cong\s+ty)\s*(?:cua|la|nhu|kieu)?|(?:nhac\s+(?:den|toi|ve|ten)|nhac\s+nho\s+ve|noi\s+(?:ve|den|toi|xau|chuyen\s+ve)|ke\s+(?:ve|chuyen(?:\s+cua)?)|ban\s+(?:ve|chuyen\s+cua)|hoi\s+(?:ve|tham(?:\s+ve)?|lieu)|tu\s+hoi(?:\s+lieu)?|khong\s+biet(?:\s+lieu)?|nghe\s+(?:noi|bao|don)|nghi\s+(?:den|toi|ve|rang|xem)|suy\s+nghi\s+ve|thoang\s+nghi(?:\s+(?:den|toi|ve))?|nho\s+(?:den|toi|ve|lai)|thoang\s+nho(?:\s+(?:den|toi))?|mo\s+(?:ve|thay)|hinh\s+bong(?:\s+cua)?|giong\s+(?:nhu|voi)?|nhu(?:\s+kieu)?|kieu|khac\s+voi|so\s+sanh\s+voi|ghen(?:\s+ti|\s+tuong)?\s+voi|lo(?:\s+lang)?\s+(?:cho|rang)|so\s+rang|keo|chuyen\s+(?:cua|giua)|phia(?:\s+cua)?|ben\s+phia|nha\s+cua|phong\s+cua|xe\s+cua|bua\s+tiec\s+cua)|(?:lat\s+nua|chut\s+nua|ti\s+nua|mot\s+lat\s+nua|sau\s+nay|sau\s+do|toi\s+nay|chieu\s+nay|trua\s+nay|ngay\s+mai|sang\s+mai|hom\s+sau|tuan\s+sau|luc\s+khac|khi\s+nao|bao\s+gio|se|dinh|tinh|chuan\s+bi|sap|phai|can|quen|chua\s+kip)\s+(?:se\s+|moi\s+|di\s+|qua\s+|sang\s+|len\s+|ve\s+)?(?:nhan(?:\s+tin)?|goi(?:\s+dien)?|gap(?:\s+lai)?|hen(?:\s+gap)?|tim|qua\s+cho|den\s+cho|ghe\s+cho|ve\s+voi|di\s+cung)\s*(?:cho|voi|toi|den)?|(?:hen(?:\s+gap)?|qua\s+don|di\s+don|bao\s+lai\s+cho)\s+(?:voi|cho)?)\s*$/i;

const INDIRECT_MENTION_AFTER_RE =
  /^(?:dang\s+o\s+(?:noi\s+khac|nha(?:\s+rieng)?|ben\s+kia|thanh\s+pho\s+khac|seoul|paris|new\s+york|london|malibu|calabasas|studio|san\s+bay|khach\s+san\s+khac|tren\s+may\s+bay)|khong\s+co\s+mat|vang\s+mat|khong\s+o\s+day|chua\s+(?:toi|den|ve|tra\s+loi|nhan|goi|xuat\s+hien)|da\s+(?:ve\s+nha|roi\s+di|roi\s+khoi|bay|di\s+roi|ngu\s+o\s+nha|xem\s+tin\s+nhan)|vua\s+(?:nhan\s+(?:tin\s+)?(?:toi|den|sang|trong\s+nhom|vao\s+nhom|cho\s+(?:anh|em|co|toi|minh))|goi\s+(?:dien\s+)?(?:toi|den|cho\s+(?:anh|em|co|toi|minh))|gui\s+(?:tin(?:\s+nhan)?|anh|sticker|icon|link)\s+(?:toi|den|sang|trong\s+nhom|vao\s+nhom)|rep\s+(?:trong\s+nhom|tin\s+nhan)|roi\s+di|ve\s+nha|dang\s+story|dang\s+bai)|(?:nhan|gui|rep|tra\s+loi|tha\s+icon|tha\s+react|tag\s+ten|nhan\s+tin)\s+(?:trong\s+nhom|vao\s+nhom|tren\s+nhom|vao\s+group|trong\s+group|qua\s+dien\s+thoai|qua\s+tin\s+nhan|len\s+nhom)|se\s+(?:den|toi|qua|goi|nhan|gap)\s+(?:sau|vao|toi|mai|lat|chieu|sang)|qua\s+(?:dien\s+thoai|tin\s+nhan|loa|man\s+hinh|facetime|nhom\s+chat)|o\s+dau\s+day\s+ben\s+kia|dau\s+day\s+ben\s+kia|vang\s+len\s+(?:tu\s+loa|trong\s+quan|qua\s+tai\s+nghe)|tren\s+(?:man\s+hinh|mang|instagram|tiktok|tivi|youtube|spotify)|chac\s+dang|co\s+le\s+dang)/i;

const PHONE_CALL_CONTEXT_RE =
  /(?:qua\s+dien\s+thoai|nghe\s+may|dau\s+day\s+ben\s+kia|loa\s+ngoai|goi\s+dien|facetime|man\s+hinh\s+dien\s+thoai|tin\s+nhan|nhan\s+tin|nhom\s+chat|group\s+chat|khung\s+chat|kakaotalk|zalo|messenger)/i;

const CHAT_OR_MEDIA_REMOTE_CONTEXT_RE =
  /(?:\bnhom\s+chat\b|\bgroup\s+chat\b|\bkhung\s+chat\b|\btin\s+nhan(?:\s+nhom)?\b|\bman\s+hinh\s+dien\s+thoai\b|\bthong\s+bao\s+tin\s+nhan\b|\bkakaotalk\b|\bzalo\b|\bmessenger\b|\bimessage\b|\binstagram\b|\btiktok\b|\bweverse\b|\bplaylist\b|\bspotify\b|\byoutube\b|\bvang\s+len\s+tu\s+loa\b|\bnghe\s+nhac\b|\bbat\s+nhac\b|\bmo\s+nhac\b|\bphat\s+nhac\b)/i;

const PHYSICAL_COPRESENCE_ACTION_RE =
  /(?:\bbuoc\s+(?:vao|toi|den|lai|ra)|ngoi\s+(?:xuong|canh|ben|doi\s+dien|truoc\s+mat)|dung\s+(?:day|canh|ben|truoc\s+mat|tua)|quay\s+(?:sang|lai|mat)|nhin\s+(?:thang|sang|ve\s+phia)|cam\s+(?:tay|ly|coc|tach)|vo\s+vai|dat\s+(?:ly|coc|tach|tay)|dua\s+(?:cho|tay)|keo\s+ghe|cuoi\s+(?:nhe|khe|nhin)|nghieng\s+dau|ghe\s+sat|tien\s+lai|xuat\s+hien\s+truoc\s+mat|mo\s+cua\s+buoc\s+vao)/i;

function collectExactProperNameSpans(
  text: string,
  charName: string,
  options?: { allowHonorificShortName?: boolean },
): ExactNameMatchSpan[] {
  const rawText = String(text || '');
  const cleanName = String(charName || '').trim();
  if (!rawText || !cleanName || cleanName.length < 2) return [];

  const terms: Array<{
    term: string;
    requireCapital: boolean;
    requireHonorificOrColon: boolean;
  }> = [];
  const seenTerms = new Set<string>();

  const pushTerm = (
    term: string,
    requireCapital: boolean,
    requireHonorificOrColon: boolean,
  ) => {
    const t = term.trim();
    if (!t || t.length < 2) return;
    const k = t.toLowerCase();
    if (seenTerms.has(k)) return;
    seenTerms.add(k);
    terms.push({ term: t, requireCapital, requireHonorificOrColon });
  };

  const parts = cleanName.split(/\s+/).filter(Boolean);
  const isMultiWord = parts.length >= 2;
  pushTerm(cleanName, !isMultiWord, false);

  const celeb = lookupKnownCelebrityProfile(cleanName);
  if (celeb) {
    pushTerm(celeb.canonicalName, !/\s/.test(celeb.canonicalName), false);
    for (const alias of celeb.aliases || []) {
      const a = alias.trim();
      if (a.length >= 3) {
        pushTerm(a, !/\s/.test(a), false);
      }
    }
  }

  if (isMultiWord) {
    const firstKey = normalizeCharacterKey(parts[0]);
    const lastPart = parts[parts.length - 1];
    if (parts[0].length >= 4 && !VIET_SURNAME_KEYS.has(firstKey)) {
      pushTerm(parts[0], true, false);
    }
    if (
      options?.allowHonorificShortName &&
      VIET_SURNAME_KEYS.has(firstKey) &&
      lastPart.length >= 3
    ) {
      pushTerm(lastPart, true, true);
    }
  }

  const rawSpans: ExactNameMatchSpan[] = [];
  for (const spec of terms) {
    const escaped = escapeRegExp(spec.term);
    const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const matched = m[0];
      if (spec.requireCapital && !/^[\p{Lu}]/u.test(matched)) continue;
      if (spec.requireHonorificOrColon) {
        const beforeSlice = rawText.slice(Math.max(0, m.index - 24), m.index);
        const afterSlice = rawText.slice(
          m.index + matched.length,
          m.index + matched.length + 6,
        );
        const hasHonorific = VIET_HONORIFIC_BEFORE_RE.test(beforeSlice);
        const isSpeakerColon = /^\s*:\s*/.test(afterSlice);
        if (!hasHonorific && !isSpeakerColon) continue;
      }
      rawSpans.push({
        start: m.index,
        end: m.index + matched.length,
        matched,
        requireHonorificOrColon: spec.requireHonorificOrColon,
        displayName: spec.requireHonorificOrColon ? cleanName : matched.trim(),
      });
    }
  }

  if (rawSpans.length <= 1) return rawSpans;

  // Deduplicate overlapping spans (prefer longer full-name span over shorter alias at same position)
  rawSpans.sort((a, b) => a.start - b.start || b.end - a.end);
  const deduped: ExactNameMatchSpan[] = [];
  for (const sp of rawSpans) {
    const prev = deduped[deduped.length - 1];
    if (prev && sp.start < prev.end) continue;
    deduped.push(sp);
  }
  return deduped;
}

function findQuotedRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const quoteRe = /“[^”\n]{1,800}”|"[^"\n]{1,800}"|«[^»\n]{1,800}»/g;
  let m: RegExpExecArray | null;
  while ((m = quoteRe.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

export interface CharacterDirectPresenceAnalysis {
  directCount: number;
  indirectCount: number;
  firstDirectIndex: number;
  lastDirectIndex: number;
  matchedDisplay: string;
}

/**
 * Distinguishes direct physical presence in the scene from indirect/off-screen mentions
 * (characters only named inside dialogue about them, thoughts, upcoming texts, phone calls,
 * notifications, or references to another location).
 */
export function analyzeCharacterDirectPresence(
  text: string,
  charName: string,
  options?: { allowHonorificShortName?: boolean },
): CharacterDirectPresenceAnalysis {
  const rawText = stripNonSceneChatBlocks(String(text || ''));
  const cleanName = String(charName || '').trim();
  const empty: CharacterDirectPresenceAnalysis = {
    directCount: 0,
    indirectCount: 0,
    firstDirectIndex: -1,
    lastDirectIndex: -1,
    matchedDisplay: cleanName,
  };
  if (!rawText || !cleanName || cleanName.length < 2) return empty;

  const spans = collectExactProperNameSpans(rawText, cleanName, options);
  if (!spans.length) return empty;

  const quotedRanges = findQuotedRanges(rawText);

  let directCount = 0;
  let indirectCount = 0;
  let firstDirectIndex = -1;
  let lastDirectIndex = -1;
  let matchedDisplay = cleanName;
  let bestDisplayScore = -1;

  for (const sp of spans) {
    const containingQuote = quotedRanges.find(
      (q) => sp.start >= q.start && sp.end <= q.end,
    );

    const lineStart = Math.max(0, rawText.lastIndexOf('\n', sp.start - 1) + 1);
    const nextNl = rawText.indexOf('\n', sp.end);
    const lineEnd = nextNl >= 0 ? nextNl : rawText.length;
    const lineText = rawText.slice(lineStart, lineEnd);

    let beforeRaw = containingQuote
      ? rawText.slice(containingQuote.start + 1, sp.start)
      : rawText.slice(Math.max(lineStart, sp.start - 95), sp.start);
    let afterRaw = containingQuote
      ? rawText.slice(sp.end, containingQuote.end - 1)
      : rawText.slice(sp.end, Math.min(lineEnd, sp.end + 95));

    // Trim beforeRaw/afterRaw to the closest clause boundary so earlier/later unrelated clauses don't bleed in
    const lastClauseSep = Math.max(
      beforeRaw.lastIndexOf('.'),
      beforeRaw.lastIndexOf('!'),
      beforeRaw.lastIndexOf('?'),
      beforeRaw.lastIndexOf(';'),
      beforeRaw.lastIndexOf('…'),
      containingQuote ? -1 : beforeRaw.lastIndexOf('”'),
      containingQuote ? -1 : beforeRaw.lastIndexOf('"'),
      containingQuote ? -1 : beforeRaw.lastIndexOf('»'),
    );
    if (lastClauseSep >= 0) {
      beforeRaw = beforeRaw.slice(lastClauseSep + 1);
    }

    const nextClauseMatch = /[.!?;…]/.exec(afterRaw);
    if (nextClauseMatch) {
      afterRaw = afterRaw.slice(0, nextClauseMatch.index);
    }

    const beforeNorm = normalizeCharacterKey(beforeRaw);
    const afterNorm = normalizeCharacterKey(afterRaw);
    const clauseNorm = normalizeCharacterKey(
      `${beforeRaw} ${sp.matched} ${afterRaw}`,
    );
    const lineNorm = normalizeCharacterKey(lineText);

    const isRemoteChatOrMediaClause =
      (CHAT_OR_MEDIA_REMOTE_CONTEXT_RE.test(clauseNorm) ||
        MUSIC_OR_LYRIC_CLAUSE_RE.test(clauseNorm)) &&
      !PHYSICAL_COPRESENCE_ACTION_RE.test(clauseNorm);

    const isIndirectClause =
      INDIRECT_MENTION_BEFORE_RE.test(beforeNorm) ||
      INDIRECT_MENTION_AFTER_RE.test(afterNorm) ||
      ABSENCE_CUE_RE.test(clauseNorm) ||
      isRemoteChatOrMediaClause;

    let isDirect = false;
    if (containingQuote) {
      if (!isIndirectClause && !isLyricOrExclamationJunkName(cleanName)) {
        const isPhoneContext = PHONE_CALL_CONTEXT_RE.test(lineNorm);
        const isLyricLineContext = MUSIC_OR_LYRIC_CLAUSE_RE.test(lineNorm);
        const beforeTrim = beforeRaw.trim();
        const afterTrim = afterRaw.trim();
        const isLeadingVocative =
          /^(?:(?:này|ơi|ê|em|anh|chị|cô|bé|babe|baby|à|ừ|nào)\s+)+$/iu.test(
            beforeTrim,
          ) && /^[,!?…]/.test(afterTrim);
        const isTrailingVocative =
          /,\s*(?:(?:em|anh|chị|cô|bé|babe|baby)\s+)?$/iu.test(beforeTrim) &&
          /^[!?….]*$/.test(afterTrim);
        if ((isLeadingVocative || isTrailingVocative) && !isPhoneContext && !isLyricLineContext) {
          isDirect = true;
        }
      }
    } else if (!isIndirectClause) {
      isDirect = true;
    }

    if (isDirect) {
      directCount += 1;
      if (firstDirectIndex < 0 || sp.start < firstDirectIndex) {
        firstDirectIndex = sp.start;
      }
      if (sp.start > lastDirectIndex) {
        lastDirectIndex = sp.start;
      }
      const displayScore =
        (sp.displayName.includes(' ') ? 10 : 0) -
        (sp.requireHonorificOrColon ? 5 : 0);
      if (displayScore >= bestDisplayScore) {
        bestDisplayScore = displayScore;
        matchedDisplay = sp.displayName;
      }
    } else {
      indirectCount += 1;
    }
  }

  return {
    directCount,
    indirectCount,
    firstDirectIndex,
    lastDirectIndex,
    matchedDisplay,
  };
}

export interface CharacterSceneEngagementResult {
  mentionedByUser: boolean;
  directCount: number;
  hasDialogueOrInteraction: boolean;
  hasRoleIntroduction: boolean;
  isPassiveBackgroundOnly: boolean;
  qualifiesAsNewNpc: boolean;
  engagementScore: number;
}

const ACTIVE_INTERACTION_CLAUSE_RE =
  /\b(?:noi|dap|hoi|cuoi|mim\s+cuoi|cuoi\s+lanh|hu\s+lanh|thi\s+tham|khe\s+noi|len\s+tieng|mo\s+loi|ngat\s+loi|tra\s+loi|bao|ke|giai\s+thich|nhac|goi|quat|het|quay\s+sang|quay\s+dau|nguoc\s+mat|nguoc\s+nhin|nhin\s+(?:thang|cham|ve\s+phia|sang)|buoc\s+(?:toi|lai|den|ra)|tien\s+(?:lai|toi)|dua\s+(?:cho|tay)|trao\s+(?:cho|tay)|nam\s+(?:tay|lay)|cham\s+(?:vao|len)|vo\s+vai|cam\s+(?:lay|tren\s+tay)|nhiu\s+may|cau\s+may|gat\s+dau|khe\s+gat|lac\s+dau|keo\s+tay|chan\s+(?:lai|truoc)|doi\s+mat|ngoi\s+(?:xuong|doi\s+dien|canh)|dung\s+day|nang\s+ly|tro\s+chuyen|ban\s+bac|tranh\s+luan|phan\s+ung|bat\s+cuoi|tho\s+dai|siet|om|hon|chap\s+tay|hanh\s+le|vay\s+tay|phat\s+tay|truyen\s+am|cat\s+giong|buong\s+loi|dap\s+loi|nheo\s+mat|dung\s+buoc|rut\s+kiem|tung\s+chuong)\b/i;

// Human subject speech/action verbs appearing directly AFTER a candidate name within the same sentence
export const SUBJECT_ACTIVE_VERB_AFTER_RE =
  /^(?:[^.!?;:\n]{0,36})?\b(?:noi|dap|dap\s+loi|hoi|cuoi|khe\s+cuoi|mim\s+cuoi|cuoi\s+lanh|cuoi\s+nhat|hu\s+lanh|thi\s+tham|khe\s+noi|len\s+tieng|mo\s+loi|ngat\s+loi|tra\s+loi|bao|giai\s+thich|nhac|goi|quat|het|quay\s+sang|quay\s+dau|nguoc\s+mat|nguoc\s+nhin|nhin\s+(?:thang|cham|ve\s+phia|sang)|buoc\s+(?:toi|lai|den|ra)|tien\s+(?:lai|toi)|dua\s+(?:cho|tay)|trao\s+(?:cho|tay)|nam\s+(?:tay|lay)|vo\s+vai|nhiu\s+may|cau\s+may|gat\s+dau|khe\s+gat|lac\s+dau|chan\s+(?:lai|truoc)|ngoi\s+(?:xuong|doi\s+dien|canh)|dung\s+day|tho\s+dai|chap\s+tay|hanh\s+le|vay\s+tay|phat\s+tay|truyen\s+am|cat\s+giong|buong\s+loi|nheo\s+mat|dung\s+buoc|rut\s+kiem|tung\s+chuong|vuot\s+rau|khoanh\s+tay|khe\s+nhech|gio\s+tay|chi\s+tay|nghieng\s+dau|bat\s+cuoi)\b/i;

// Person-directed interaction verb immediately BEFORE a candidate name (e.g. "nhìn sang Liễu Như Yên", "chào Mạc Thiên Hành")
export const INTERACT_WITH_PERSON_BEFORE_RE =
  /\b(?:nhin\s+sang|quay\s+sang|nhin\s+ve\s+phia|hoi|goi|chao|hanh\s+le\s+voi|noi\s+voi|bao|dap\s+loi|tro\s+chuyen\s+voi|doi\s+dien\s+voi|cung\s+voi|bat\s+chuyen\s+voi|tiep\s+don|chi\s+ve\s+phia)\s*(?:vi|nang|chang|ga|lao|su\s+ty|su\s+huynh|truong\s+lao|dao\s+huu|tien\s+boi|cong\s+tu|tieu\s+thu)?\s*$/i;

// Immediate pre-context proving the candidate is an item, weapon, pill, talisman, technique, realm, or location — NOT a human actor!
export const NON_ACTOR_PRE_CONTEXT_RE =
  /\b(?:cam(?:\s+lay)?|rut(?:\s+ra)?|lay(?:\s+ra)?|moc(?:\s+ra)?|te(?:\s+ra)?|vung(?:\s+len)?|deo(?:\s+tren)?|mac(?:\s+tren)?|nuot(?:\s+vao)?|uong(?:\s+vao)?|phuc\s+dung|su\s+dung|dung\s+(?:mot|hai|ba|vien|la|tam|thanh)?|bop\s+nat|kich\s+hoat|dan(?:\s+len)?|van\s+chuyen|tu\s+luyen|luyen(?:\s+tap)?|thi\s+trien|thoi\s+dong|dot\s+pha(?:\s+len|\s+toi|\s+den)?|dat(?:\s+toi|\s+den)?|buoc\s+vao|tien\s+vao|di\s+vao|roi\s+khoi|ra\s+khoi|quay\s+ve|tro\s+ve|den\s+noi|toi\s+noi|o\s+tai|tai\s+khu|trong\s+khu|tren\s+dinh|duoi\s+chan|duoi\s+goc|duoi\s+tan|mua(?:\s+duoc)?|ban(?:\s+ra)?|luyen\s+che|che\s+tao|cat\s+vao|bo\s+vao|thu\s+vao|mang\s+theo|nam\s+giu|so\s+huu|canh\s+gioi|tu\s+vi|cong\s+phap|chieu\s+thuc|tam\s+phap|than\s+phap|kiem\s+quyet|phap\s+bao|phap\s+khi|linh\s+khi|dan\s+duoc|linh\s+dan|phu\s+luc|bua\s+chu|linh\s+thach|linh\s+thao|dia\s+danh|khu\s+vuc|phuong\s+thi|tong\s+mon|dong\s+phu|bi\s+canh|cay|rung|ngon\s+nui|dinh\s+nui)\s*(?:mot|hai|ba|chiec|cay|vien|la|tam|thanh|bo|cuon|quyen|mon|loai|tang|bac|khu|vung|noi|cua)?\s*$/i;

const ROLE_INTRODUCTION_CLAUSE_RE =
  /\b(?:tu\s+gioi\s+thieu|tu\s+xung|tai\s+ha\s+la|lao\s+phu\s+la|ban\s+toa\s+la|ten\s+la|duoc\s+gioi\s+thieu|la\s+(?:quan\s+ly|tro\s+ly|doi\s+tac|dai\s+dien|truong\s+nhom|nguoi\s+phu\s+trach|ban\s+than|dong\s+doi|dong\s+mon|su\s+huynh|su\s+ty|su\s+muoi|su\s+de|su\s+ton|su\s+phu|truong\s+lao|chuong\s+mon|chuong\s+quy|ho\s+ve|chu\s+tiem|dan\s+su|kiem\s+khach|tan\s+tu|tien\s+tu|thieu\s+chu|dao\s+huu|tien\s+boi|dao\s+dien|nha\s+san\s+xuat|khach\s+moi|ca\s+si|rapper|dien\s+vien|nghe\s+si|giam\s+doc|chu\s+tich|doi\s+thu|ke\s+thu|nguoi\s+yeu|vo|chong|anh\s+trai|em\s+gai|chi\s+gai|em\s+trai))\b/i;

const PASSIVE_BACKGROUND_CLAUSE_RE =
  /\b(?:di\s+ngang\s+qua|luot\s+qua|o\s+phia\s+xa|tu\s+dang\s+xa|trong\s+dam\s+dong|giua\s+dam\s+dong|bung\s+(?:do|nuoc|tra|ca\s+phe)|rot\s+(?:nuoc|tra|ruou)|don\s+ban|quet\s+the|mo\s+cua\s+xe|dung\s+gac|dung\s+truc|o\s+quay|phia\s+sau\s+hau\s+truong)\b/i;

/**
 * Evaluates whether a newly encountered (non-roster) character genuinely interacted
 * or holds a meaningful role in the current scene, preventing passive background
 * mentions, items, realms, locations, techniques, or one-off extras from polluting
 * Portrait Bank / Character States.
 */
export function evaluateCharacterSceneEngagement(
  sceneText: string,
  charName: string,
  userText?: string,
  extraBlockedKeys?: Set<string>,
): CharacterSceneEngagementResult {
  const cleanName = String(charName || '').trim();
  const sceneOnly = stripNonSceneChatBlocks(String(sceneText || ''));
  const cleanUser = stripNonSceneChatBlocks(String(userText || ''));

  const empty: CharacterSceneEngagementResult = {
    mentionedByUser: false,
    directCount: 0,
    hasDialogueOrInteraction: false,
    hasRoleIntroduction: false,
    isPassiveBackgroundOnly: false,
    qualifiesAsNewNpc: false,
    engagementScore: 0,
  };
  if (
    !cleanName ||
    cleanName.length < 2 ||
    isNonPersonCultivationOrWorldTerm(cleanName, extraBlockedKeys) ||
    isLyricOrExclamationJunkName(cleanName) ||
    isPlayfulTeasingOrParodyName(cleanName) ||
    (!isExplicitCharacterDesignation(cleanName) &&
      isGenericUnnamedFillerNpcName(cleanName))
  ) {
    return empty;
  }

  // Reject names explicitly declared as teasing/joking nicknames in the turn or user input
  const candKey = normalizeCharacterKey(cleanName);
  const teasingPairs = extractTeasingNicknamePairsFromText(
    [String(sceneText || ''), String(userText || '')].filter(Boolean).join('\n'),
  );
  if (
    teasingPairs.some((pair) => normalizeCharacterKey(pair.nickname) === candKey)
  ) {
    return empty;
  }

  const unquotedCleanUser = stripQuotedMediaAndDialogue(cleanUser);
  const mentionedByUser =
    Boolean(unquotedCleanUser.trim()) &&
    findExactProperNameInText(unquotedCleanUser, cleanName, {
      allowHonorificShortName: true,
    }).count > 0;

  // If no AI scene prose exists yet, NEVER auto-spawn a brand-new NPC from a bare user mention alone;
  // require concrete character action/role context in the non-lyric user prose.
  if (!sceneOnly.trim()) {
    if (!mentionedByUser) return empty;
    const userNorm = normalizeCharacterKey(unquotedCleanUser);
    const hasUserActionOrRole =
      ACTIVE_INTERACTION_CLAUSE_RE.test(userNorm) ||
      ROLE_INTRODUCTION_CLAUSE_RE.test(userNorm);
    const userHasMusicCue = MUSIC_OR_LYRIC_CLAUSE_RE.test(userNorm);
    const qualifiesFromUserOnly =
      hasUserActionOrRole && !userHasMusicCue && !isPlayfulTeasingOrParodyName(cleanName);
    return {
      ...empty,
      mentionedByUser,
      hasDialogueOrInteraction: hasUserActionOrRole && !userHasMusicCue,
      qualifiesAsNewNpc: qualifiesFromUserOnly,
      engagementScore: qualifiesFromUserOnly ? 8 : 0,
    };
  }

  const presence = analyzeCharacterDirectPresence(sceneOnly, cleanName, {
    allowHonorificShortName: true,
  });

  // Require direct in-scene presence; a word appearing ONLY in user input (e.g. joke nickname, song title,
  // passing remark) without real presence in the story scene must NEVER spawn a new NPC.
  if (presence.directCount === 0) {
    return {
      ...empty,
      mentionedByUser,
    };
  }

  const spans = collectExactProperNameSpans(sceneOnly, cleanName, {
    allowHonorificShortName: true,
  });
  const quotedRanges = findQuotedRanges(sceneOnly);
  const isExplicitDesig = isExplicitCharacterDesignation(cleanName);

  let dialogueOrInteractionHits = 0;
  let roleIntroHits = 0;
  let passiveHits = 0;
  let speakerColonHits = 0;
  let narrativeOutsideQuoteHits = 0;
  let personalPronounOrHonorificHits = 0;
  let objectOrPlaceContextHits = 0;

  for (const sp of spans) {
    const lineStart = Math.max(0, sceneOnly.lastIndexOf('\n', sp.start - 1) + 1);
    const nextNl = sceneOnly.indexOf('\n', sp.end);
    const lineEnd = nextNl >= 0 ? nextNl : sceneOnly.length;

    const containingQuote = quotedRanges.find(
      (q) => sp.start >= q.start && sp.end <= q.end,
    );
    const beforeSlice = sceneOnly.slice(Math.max(lineStart, sp.start - 60), sp.start);
    const afterSlice = sceneOnly.slice(sp.end, Math.min(lineEnd, sp.end + 90));
    const beforeSentencePart = beforeSlice.split(/[.!?;\n]/).pop() || '';
    const afterSentencePart = afterSlice.split(/[.!?;\n]/)[0] || '';
    const beforeClauseNorm = normalizeCharacterKey(beforeSentencePart);
    const afterClauseNorm = normalizeCharacterKey(afterSentencePart);
    const clauseNorm = normalizeCharacterKey(
      `${beforeSentencePart} ${sp.matched} ${afterSentencePart}`,
    );

    if (
      MUSIC_OR_LYRIC_CLAUSE_RE.test(clauseNorm) &&
      !PHYSICAL_COPRESENCE_ACTION_RE.test(clauseNorm)
    ) {
      continue;
    }

    // Detect if the immediate pre-context treats this phrase as an item/place/realm/technique (NOT an active person)
    const isPassiveObjectOrPlaceMention =
      !isExplicitDesig &&
      NON_ACTOR_PRE_CONTEXT_RE.test(beforeClauseNorm.slice(-42));
    if (isPassiveObjectOrPlaceMention) {
      objectOrPlaceContextHits += 1;
      passiveHits += 1;
      continue;
    }

    // Direct speaker prefix: "Name: \"...\"" or "Name <action> nói: \"...\"" within the same sentence
    const isSpeakerLine =
      !containingQuote &&
      /^\s*(?::\s*[“"«]|[^.!?;\n]{0,75}\b(?:nói|đáp|hỏi|cười|thì\s+thầm|khẽ\s+nói|nhắc|bảo|lên\s+tiếng|ngắt\s+lời|gọi|kêu|trả\s+lời|giải\s+thích|cất\s+giọng|buông\s+lời|quát|hừ\s+lạnh|truyền\s+âm)[^:\n]{0,24}:\s*[“"«])/iu.test(
        afterSlice,
      );

    if (!containingQuote) {
      narrativeOutsideQuoteHits += 1;
      if (VIET_HONORIFIC_BEFORE_RE.test(beforeSlice) || isExplicitDesig) {
        personalPronounOrHonorificHits += 1;
      }
    }

    if (isSpeakerLine) {
      speakerColonHits += 1;
      dialogueOrInteractionHits += 1;
    } else if (containingQuote) {
      // Only count explicit personal addressing vocative ("Này Minh,", "Sư tỷ Liễu Như Yên,") — NEVER bare quoted exclamations
      const isStrictVocative =
        /(?:^|,\s*)(?:(?:này|ơi|ê|em|anh|chị|cô|cậu|bác|chú|sư\s+tỷ|sư\s+huynh|sư\s+muội|sư\s+đệ|đạo\s+hữu|tiền\s+bối|trưởng\s+lão|chưởng\s+quỹ|công\s+tử|tiểu\s+thư)\s+)+$/iu.test(
          beforeSlice.trim(),
        ) && /^[,!?…]/.test(afterSlice.trim());
      if (isStrictVocative) {
        dialogueOrInteractionHits += 1;
        personalPronounOrHonorificHits += 1;
      }
    } else if (
      SUBJECT_ACTIVE_VERB_AFTER_RE.test(afterClauseNorm) ||
      INTERACT_WITH_PERSON_BEFORE_RE.test(beforeClauseNorm)
    ) {
      dialogueOrInteractionHits += 1;
    } else if (PASSIVE_BACKGROUND_CLAUSE_RE.test(clauseNorm)) {
      passiveHits += 1;
    }

    if (ROLE_INTRODUCTION_CLAUSE_RE.test(clauseNorm)) {
      roleIntroHits += 1;
    }
  }

  // If every outside-quote hit was a passive object/place/technique mention, disqualify immediately
  if (
    objectOrPlaceContextHits > 0 &&
    narrativeOutsideQuoteHits === 0 &&
    speakerColonHits === 0
  ) {
    return {
      ...empty,
      mentionedByUser,
      directCount: presence.directCount,
      isPassiveBackgroundOnly: true,
    };
  }

  const hasDialogueOrInteraction = dialogueOrInteractionHits > 0;
  const hasRoleIntroduction = roleIntroHits > 0;
  const hasPersonalAddressing = personalPronounOrHonorificHits > 0;
  const isPassiveBackgroundOnly =
    !hasDialogueOrInteraction &&
    !hasRoleIntroduction &&
    (passiveHits > 0 || presence.directCount <= 1);

  // Require real narrative/speaker presence outside quoted speech so stray lyric/dialogue/item/place words never spawn NPCs
  const hasRealSceneAnchor =
    speakerColonHits >= 1 || narrativeOutsideQuoteHits >= 1;

  const hasPersonNameCue =
    isExplicitDesig ||
    hasPersonSurnameStart(cleanName) ||
    hasPersonalAddressing ||
    Boolean(lookupKnownCelebrityProfile(cleanName));

  const qualifiesAsNewNpc =
    (speakerColonHits >= 1 && presence.directCount >= 1) ||
    (hasRealSceneAnchor &&
      hasDialogueOrInteraction &&
      (hasPersonNameCue || presence.directCount >= 2 || hasRoleIntroduction)) ||
    (hasRealSceneAnchor &&
      hasPersonNameCue &&
      hasRoleIntroduction &&
      !isPassiveBackgroundOnly);

  const engagementScore =
    (mentionedByUser && hasRealSceneAnchor && hasDialogueOrInteraction ? 6 : 0) +
    speakerColonHits * 6 +
    dialogueOrInteractionHits * 4 +
    roleIntroHits * 4 +
    personalPronounOrHonorificHits * 2 +
    (hasPersonNameCue ? 2 : 0) +
    Math.min(4, presence.directCount) -
    objectOrPlaceContextHits * 5 -
    (isPassiveBackgroundOnly ? 6 : 0);

  return {
    mentionedByUser,
    directCount: presence.directCount,
    hasDialogueOrInteraction,
    hasRoleIntroduction,
    isPassiveBackgroundOnly,
    qualifiesAsNewNpc,
    engagementScore,
  };
}

/**
 * Checks whether a character is explicitly stated as absent / not at the scene
 * in the given clean text (without active presence in another sentence).
 */
export function isCharacterExplicitlyAbsent(
  cleanText: string,
  charName: string,
  checkGenericMc = false,
): boolean {
  const raw = String(cleanText || '').trim();
  if (!raw) return false;

  const rawSentences = raw
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (checkGenericMc) {
    const fullNorm = normalizeCharacterKey(raw);
    if (GENERIC_MC_ABSENCE_RE.test(fullNorm)) {
      return true;
    }
  }

  const cleanChar = String(charName || '').trim();
  if (!cleanChar || cleanChar.length < 2) return false;

  let absenceHits = 0;
  let activeHits = 0;

  for (const rawS of rawSentences) {
    const exactHit = findExactProperNameInText(rawS, cleanChar, {
      allowHonorificShortName: true,
    });
    if (exactHit.count === 0) continue;
    const normS = normalizeCharacterKey(rawS);
    if (ABSENCE_CUE_RE.test(normS)) {
      absenceHits += 1;
    } else {
      activeHits += 1;
    }
  }

  return absenceHits > 0 && activeHits === 0;
}

/**
 * Determines whether the Main Character (MC/NVC) is genuinely present in a turn.
 * Returns false if user or story explicitly states MC is absent (e.g. not in the scene / another location),
 * OR if MC has a defined name that is never mentioned in the story prose (and prose is not unquoted 1st-person POV).
 */
export function isMcPresentInTurn(
  cleanAi: string,
  cleanUser: string,
  mcName: string,
  mcPronoun?: string,
): boolean {
  const aiText = String(cleanAi || '').trim();
  const userText = String(cleanUser || '').trim();
  const combined = [userText, aiText].filter(Boolean).join('\n');
  if (!combined) return false;

  // 1. Explicit absence statement in user prompt or story prose immediately marks MC as absent
  if (
    isCharacterExplicitlyAbsent(userText, mcName, true) ||
    isCharacterExplicitlyAbsent(aiText, mcName, true)
  ) {
    return false;
  }

  const mcKey = normalizeCharacterKey(mcName);
  const pronounKey = normalizeCharacterKey(mcPronoun || '');
  const unquotedAiNorm = normalizeCharacterKey(stripQuotedDialogue(aiText));

  const hasFirstPersonNarration =
    Boolean(aiText) &&
    /\btoi\s+(?:buoc|noi|nhin|cuoi|cam|quay|ngoi|dung|di|hoi|dap|tho\s+dai|nhiu\s+may|im\s+lang|khong\s+ngo|khe|lang\s+le|dua\s+mat)\b/.test(
      unquotedAiNorm,
    );

  // 2. If MC has a specific name, require diacritic-exact match in prose (never strip diacritics on short names)
  if (mcKey && mcKey !== 'nhan vat chinh' && mcKey !== 'mc' && mcKey !== 'nvc') {
    const exactInAi = findExactProperNameInText(aiText, mcName, {
      allowHonorificShortName: true,
    });
    if (exactInAi.count > 0) return true;

    if (
      pronounKey.length >= 3 &&
      !/^(?:toi|anh|em|co|cau|han|ga|ta|minh|nhan\s+vat|nguoi\s+choi|mc|npc|nvc)$/.test(
        pronounKey,
      ) &&
      sentenceMentionsKey(unquotedAiNorm, pronounKey)
    ) {
      return true;
    }

    // Not mentioned in AI prose -> only treat as present if AI prose is empty and user explicitly mentioned MC
    if (!aiText && findExactProperNameInText(userText, mcName).count > 0) {
      return true;
    }

    // Unquoted first-person narration ("tôi bước", "tôi nhìn" outside dialogue quotes)
    if (hasFirstPersonNarration) {
      return true;
    }

    return false;
  }

  // 3. When MC has no custom name yet, only treat MC as present if unquoted 1st-person POV or explicit MC mention exists
  if (
    /\b(?:nhan\s+vat\s+chinh|nvc)\b/.test(unquotedAiNorm) ||
    hasFirstPersonNarration
  ) {
    return true;
  }
  return false;
}

export interface VividNpcProfileResult {
  role: string;
  age: string;
  birthday: string;
  fashionStyle: string;
  personality: string;
  appearance: string;
  relationships: string;
  signature: string;
  source: 'companion' | 'story' | 'celebrity' | 'combined' | 'none';
}

export function resolveLocalVividNpcProfile(options: {
  name: string;
  isMc: boolean;
  comp?: CompanionProfile;
  cleanStoryText?: string;
  storyClock?: StoryClockState;
}): VividNpcProfileResult {
  const { name, isMc, comp, cleanStoryText, storyClock } = options;
  const key = normalizeCharacterKey(name);

  let role = '';
  let age = '';
  let birthday = '';
  let fashionStyle = '';
  let personality = '';
  let appearance = '';
  let relationships = '';
  let signature = '';
  let fromCompanion = false;

  if (isMc && comp?.mc) {
    role = comp.mc.originRole?.trim() || 'Nhân vật chính';
    age = comp.mc.age?.trim()
      ? /^\d+$/.test(comp.mc.age.trim())
        ? `${comp.mc.age.trim()} tuổi`
        : comp.mc.age.trim()
      : '';
    personality = comp.mc.personality?.trim() || '';
    appearance = [
      comp.mc.gender || '',
      age,
      comp.mc.appearance?.trim() || '',
    ]
      .filter(Boolean)
      .join(', ');
    relationships = comp.mc.canonMcRelation?.trim() || '';
    fromCompanion = Boolean(appearance || personality || age);
  } else if (comp) {
    const matchedNpc = (comp.npcs || []).find(
      (n) => normalizeCharacterKey(n.name) === key,
    );
    if (matchedNpc) {
      role = matchedNpc.role?.trim() || '';
      age = matchedNpc.age?.trim() || '';
      birthday = matchedNpc.birthday?.trim() || '';
      fashionStyle = matchedNpc.fashionStyle?.trim() || '';
      personality = matchedNpc.personality?.trim() || '';
      appearance = (matchedNpc.appearance || matchedNpc.desc || '').trim();
      relationships = matchedNpc.relationships?.trim() || '';
      signature = matchedNpc.signature?.trim() || '';
      fromCompanion = Boolean(
        appearance ||
          personality ||
          relationships ||
          signature ||
          age ||
          birthday ||
          fashionStyle,
      );
    }
    if (!appearance) {
      const matchedCanon = (comp.canonCandidates || []).find(
        (c) => normalizeCharacterKey(c.name) === key,
      );
      if (matchedCanon) {
        if (!role) role = matchedCanon.role?.trim() || '';
        if (!age && matchedCanon.age?.trim()) {
          age = /^\d+$/.test(matchedCanon.age.trim())
            ? `${matchedCanon.age.trim()} tuổi`
            : matchedCanon.age.trim();
        }
        if (!personality) personality = matchedCanon.personality?.trim() || '';
        appearance = [
          matchedCanon.gender || '',
          matchedCanon.age ? `${matchedCanon.age} tuổi` : '',
          matchedCanon.appearance?.trim() || '',
        ]
          .filter(Boolean)
          .join(', ');
        fromCompanion = fromCompanion || Boolean(appearance || personality || age);
      }
    }
  }

  const storyCue = cleanStoryText
    ? extractVisualCuesForCharacter(cleanStoryText, name)
    : '';
  const celeb = lookupKnownCelebrityProfile(name);

  if (!role && celeb?.role) role = celeb.role;
  if (!birthday && celeb?.birthday) birthday = celeb.birthday;
  if (!age && birthday) age = computeAgeFromBirthday(birthday, storyClock);
  if (!fashionStyle && celeb?.fashionStyle) fashionStyle = celeb.fashionStyle;
  if (!personality && celeb?.personality) personality = celeb.personality;
  if (!relationships && celeb?.relationships) relationships = celeb.relationships;
  if (!signature && celeb?.signature) signature = celeb.signature;

  const cleanAge = trimClean(age, 40);
  const cleanBirthday = trimClean(birthday, 40);
  const cleanFashion = trimClean(fashionStyle, 240);

  if (fromCompanion && appearance) {
    return {
      role,
      age: cleanAge,
      birthday: cleanBirthday,
      fashionStyle: cleanFashion,
      personality: trimClean(personality, 240),
      appearance: trimClean(appearance, 280),
      relationships: trimClean(relationships, 220),
      signature: trimClean(signature, 200),
      source: 'companion',
    };
  }

  if (storyCue && celeb) {
    return {
      role,
      age: cleanAge,
      birthday: cleanBirthday,
      fashionStyle: cleanFashion,
      personality: trimClean(personality, 240),
      appearance: trimClean(
        `Trong cảnh: ${storyCue} — Đặc trưng: ${celeb.appearance}`,
        280,
      ),
      relationships: trimClean(relationships, 220),
      signature: trimClean(signature, 200),
      source: 'combined',
    };
  }

  if (storyCue) {
    return {
      role,
      age: cleanAge,
      birthday: cleanBirthday,
      fashionStyle: cleanFashion,
      personality: trimClean(personality, 240),
      appearance: storyCue,
      relationships: trimClean(relationships, 220),
      signature: trimClean(signature, 200),
      source: 'story',
    };
  }

  if (celeb) {
    return {
      role,
      age: cleanAge,
      birthday: cleanBirthday,
      fashionStyle: cleanFashion,
      personality: trimClean(personality, 240),
      appearance: celeb.appearance,
      relationships: trimClean(relationships, 220),
      signature: trimClean(signature, 200),
      source: 'celebrity',
    };
  }

  return {
    role,
    age: cleanAge,
    birthday: cleanBirthday,
    fashionStyle: cleanFashion,
    personality: trimClean(personality, 240),
    appearance: trimClean(appearance, 280),
    relationships: trimClean(relationships, 220),
    signature: trimClean(signature, 200),
    source: fromCompanion ? 'companion' : 'none',
  };
}

export function resolveLocalCharacterAppearance(options: {
  name: string;
  isMc: boolean;
  comp?: CompanionProfile;
  cleanStoryText?: string;
  storyClock?: StoryClockState;
}): {
  appearance: string;
  roleSuggestion?: string;
  source: 'companion' | 'story' | 'celebrity' | 'combined' | 'none';
} {
  const vivid = resolveLocalVividNpcProfile(options);
  return {
    appearance: vivid.appearance,
    roleSuggestion: vivid.role || undefined,
    source: vivid.source,
  };
}

export interface SpeakerLineMatch {
  leadingPrefix: string;
  displayName: string;
  canonicalName: string;
  stageNote: string;
  hasColon: boolean;
  remainder: string;
}

const NON_SPEAKER_LABEL_KEYS = new Set([
  // Vietnamese structural / narrative / meta labels
  'boi canh',
  'thoi gian',
  'dia diem',
  'vi tri',
  'tam trang',
  'trang thai',
  'ghi chu',
  'luu y',
  'tom tat',
  'chu thich',
  'muc tieu',
  'goi y',
  'he thong',
  'thong bao',
  'canh bao',
  'hau ky',
  'thong ke',
  'suy nghi',
  'nghi tham',
  'noi tam',
  'loi thoai',
  'hanh dong',
  'tinh cach',
  'ngoai hinh',
  'quan he',
  'diem nhan',
  'vai tro',
  'moc thoi gian',
  'ket qua',
  'dien bien',
  'luot goi',
  'luot tra loi',
  'nhiem vu',
  'ky nang',
  'vat pham',
  'trang bi',
  'nhap vai',
  'chuong',
  'phan',
  'canh',
  'trang',
  'ngay',
  'thang',
  'nam',
  'gio',
  'phut',
  'buoi',
  'thoi tiet',
  'khong khi',
  'am thanh',
  'anh sang',
  'trang phuc',
  'phu kien',
  'danh sach',
  'chi tiet',
  'su kien',
  'ngu canh',
  'quy tac',
  'the gioi',
  'nhan vat',
  'nhan vat chinh',
  'nguoi ke chuyen',
  'dan y',
  'ke hoach',
  'phan tich',
  'tong ket',
  'nhom chat',
  'group chat',
  'khung chat',
  'phong chat',
  'tin nhan',
  'tin nhan nhom',
  'hop thu',
  'binh luan',
  'bai dang',
  'quan ca phe',
  'cong ty',
  'tap doan',
  'bai hat',
  'ca khuc',
  'mau sac',
  'sm',
  'yg',
  'jyp',
  'hybe',
  // English planning / thinking / meta labels
  'defining the setting',
  'expanding the guest list',
  'crafting the narrative flow',
  'analyzing the aftermath',
  'analysing the aftermath',
  'narrative flow',
  'guest list',
  'word count',
  'character states',
  'character list',
  'scene setup',
  'scene summary',
  'plot summary',
  'story beats',
  'pacing notes',
  'tone check',
  'continuity check',
  'system boot',
  'resource loading',
  'final check',
  'next steps',
  'action plan',
  'scene',
  'setting',
  'goal',
  'goals',
  'plan',
  'planning',
  'stage',
  'step',
  'phase',
  'note',
  'notes',
  'status',
  'location',
  'time',
  'date',
  'mood',
  'summary',
  'outfit',
  'action',
  'dialogue',
  'context',
  'rules',
  'prompt',
  'output',
  'result',
  'narrative',
  'narrator',
  'system',
  'chapter',
  'part',
  'pov',
  'tone',
  'pacing',
  'aftermath',
  'checklist',
  'outline',
  'draft',
  'thinking',
  'thought',
  'reasoning',
  'analysis',
  'weather',
  'atmosphere',
  'transition',
]);

const NON_SPEAKER_PREFIX_RE =
  /^(?:defining|expanding|crafting|analyzing|analysing|establishing|developing|building|checking|reviewing|introducing|focusing|maintaining|ensuring|highlighting|exploring|managing|considering|evaluating|determining|plan for|stage|step|phase|chapter|part|scene|beat|section|word count|chuong|phan|canh|trang|buoc|giai doan|muc|luu y|ghi chu|thong ke|tom tat|boi canh|thoi gian|dia diem|trang thai)\b/i;

const VI_COMMON_NON_NAME_SINGLE = new Set([
  'sau',
  'khi',
  'nhung',
  'roi',
  'tuy',
  'neu',
  'trong',
  'ngoai',
  'giua',
  'truoc',
  'tren',
  'duoi',
  'dem',
  'sang',
  'chieu',
  'toi',
  'trua',
  'ngay',
  'thang',
  'nam',
  'phong',
  'nha',
  'xe',
  'cua',
  'duong',
  'tieng',
  'anh',
  'co',
  'chi',
  'em',
  'ong',
  'ba',
  'han',
  'nang',
  'cau',
  'to',
  'minh',
  'ta',
  'nguoi',
  'ho',
  'chung',
  'khong',
  'mot',
  'hai',
  'vua',
  'dang',
  'da',
  'se',
  'con',
  'cung',
  'van',
  'lai',
  'rat',
  'qua',
  'hon',
  'that',
  'chi',
  'chinh',
  'ngay',
  'hom',
  'nay',
  'mai',
  'luc',
  'vai',
  'nhieu',
  'may',
  'bao',
  'nao',
  'gi',
  'ai',
  'dau',
  'sao',
  'the',
  'vay',
  'nen',
  'vi',
  'do',
  'boi',
  'du',
  'mac',
  'hoac',
  'hay',
  'ma',
  'va',
  'voi',
  'cho',
  'tu',
  'den',
  've',
  'tai',
  'o',
  'theo',
  'len',
  'xuong',
  'ra',
  'vao',
  'di',
  'thay',
  'nghe',
  'noi',
  'hoi',
  'dap',
  'cuoi',
  'nhin',
  'buoc',
  'dung',
  'ngoi',
  'cam',
  'dua',
  'mo',
  'dong',
  'goi',
  'nhan',
  'nghi',
  'cam',
  'biet',
  'muon',
  'can',
  'phai',
  'la',
  'bi',
  'duoc',
  'lam',
  'de',
  'het',
  'xong',
  'ro',
  'khe',
  'nhe',
  'cham',
  'nhanh',
  'lanh',
  'am',
  'bong',
  'chot',
  'dot',
  'nhac',
  'den',
  'ruou',
  'ly',
  'ban',
  'ghe',
  'san',
  'tuong',
  'kinh',
  'mat',
  'moi',
  'tay',
  'vai',
  'toc',
  'giong',
  'hoi',
  'nhip',
  'tim',
  'mui',
  'mau',
  'ao',
  'quan',
  'vay',
  'dam',
  'giay',
  'tui',
  'nhan',
  'dien',
  'thoai',
  'tin',
  'cuoc',
  'bua',
  'lan',
  'chuyen',
  'gio',
  'phut',
  'giay',
  'canh',
  'tiec',
  'pho',
  'quan',
  'khu',
  'noi',
  'cho',
  'goc',
  'phia',
  'ben',
  'canh',
  'dau',
  'cuoi',
  'toan',
  'ca',
  'moi',
  'rieng',
  'chung',
  'khac',
  'cung',
  'dung',
  'sai',
  'tot',
  'te',
  'dep',
  'xau',
  'moi',
  'cu',
  'lon',
  'nho',
  'cao',
  'thap',
  'dai',
  'ngan',
  'sau',
]);

const LOWERCASE_NAME_PARTICLES = new Set([
  'van',
  'von',
  'de',
  'da',
  'di',
  'del',
  'della',
  'la',
  'le',
  'du',
  'al',
  'el',
  'bin',
  'binti',
]);

/**
 * Detects a valid character speaker prefix at the start of a story line
 * (e.g. `Central Cee: "..."`, `**Kendall Jenner**: "..."`, `[Jennie Kim]: ...`, `MGK (cười khẽ): ...`)
 * while strictly rejecting English thinking/planning headers and non-character labels.
 */
export function extractSpeakerPrefixFromLine(
  line: string,
  knownCharacterKeys?: Set<string>,
): SpeakerLineMatch | null {
  if (!line || line.length < 3) return null;
  const trimmedStart = line.trimStart();
  if (!trimmedStart) return null;

  // Never badge raw XML tags, markdown headings, numbered outline items, or timestamps
  if (
    trimmedStart.startsWith('<') ||
    trimmedStart.startsWith('#') ||
    /^\d+[.)]\s/.test(trimmedStart) ||
    /^\d{1,2}:\d{2}\b/.test(trimmedStart)
  ) {
    return null;
  }

  let leadingPrefix = '';
  let rawName = '';
  let stageNote = '';
  let remainder = '';
  let hasColon = true;

  // Pattern 1: Bold speaker with colon — `**Name**: ...`, `**Name:** ...`, `**Name** (action): ...`
  const boldColonRe =
    /^([—–-]\s+)?\*\*([^*\n]{2,40}?)(?:\s*(\([^)\n]{1,34}\)))?\s*:\*\*\s*(.*)$|^([—–-]\s+)?\*\*([^*\n]{2,40}?)\*\*(\s*\([^)\n]{1,34}\))?\s*:\s*(.*)$/;
  const mBoldColon = boldColonRe.exec(trimmedStart);

  // Pattern 2: Bracketed speaker with colon — `[Name]: ...` or `[Name] (action): ...`
  const bracketColonRe =
    /^([—–-]\s+)?\[([^\]\n]{2,40}?)\](\s*\([^)\n]{1,34}\))?\s*:\s*(.*)$/;
  const mBracket = !mBoldColon ? bracketColonRe.exec(trimmedStart) : null;

  // Pattern 3: Plain speaker with colon — `Name: ...` or `Name (action): ...` or `— Name: ...`
  const plainColonRe =
    /^([—–-]\s+)?([^\n:()[\]{}<>*"]{2,38}?)(\s*\([^)\n]{1,34}\))?\s*:\s+(.*)$/;
  const mPlain =
    !mBoldColon && !mBracket ? plainColonRe.exec(trimmedStart) : null;

  // Pattern 4: Bold speaker followed by em-dash & dialogue/action — `**Name** — "..."`
  const boldDashRe = /^([—–-]\s+)?\*\*([^*\n]{2,36}?)\*\*\s+[—–]\s+(.*)$/;
  const mBoldDash =
    !mBoldColon && !mBracket && !mPlain
      ? boldDashRe.exec(trimmedStart)
      : null;

  if (mBoldColon) {
    if (mBoldColon[2] !== undefined) {
      leadingPrefix = mBoldColon[1] || '';
      rawName = mBoldColon[2].trim();
      stageNote = mBoldColon[3] ? ` ${mBoldColon[3].trim()}` : '';
      remainder = mBoldColon[4] || '';
    } else {
      leadingPrefix = mBoldColon[5] || '';
      rawName = (mBoldColon[6] || '').trim();
      stageNote = mBoldColon[7] || '';
      remainder = mBoldColon[8] || '';
    }
  } else if (mBracket) {
    leadingPrefix = mBracket[1] || '';
    rawName = mBracket[2].trim();
    stageNote = mBracket[3] || '';
    remainder = mBracket[4] || '';
  } else if (mPlain) {
    leadingPrefix = mPlain[1] || '';
    rawName = mPlain[2].trim();
    stageNote = mPlain[3] || '';
    remainder = mPlain[4] || '';
  } else if (mBoldDash) {
    leadingPrefix = mBoldDash[1] || '';
    rawName = mBoldDash[2].trim();
    stageNote = '';
    hasColon = false;
    remainder = `— ${mBoldDash[3] || ''}`;
  } else {
    return null;
  }

  // Must not be a URL scheme (http://) or empty remainder on plain text
  if (!rawName || /^https?$/i.test(rawName) || remainder.startsWith('//')) {
    return null;
  }

  // Clean stray outer punctuation while preserving author spelling
  const displayName = String(rawName ?? '')
    .replace(/[*_`~<>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!displayName || displayName.length < 2 || displayName.length > 36) {
    return null;
  }

  const key = normalizeCharacterKey(displayName);
  if (!key) return null;

  // Hard reject structural/meta/thinking labels and English CoT headings regardless of capitalization
  if (
    NON_SPEAKER_LABEL_KEYS.has(key) ||
    NON_SPEAKER_PREFIX_RE.test(key) ||
    isEnglishHeadingOrMetaPhrase(displayName)
  ) {
    return null;
  }

  const sanitized = sanitizeCharacterName(displayName, knownCharacterKeys);
  if (!sanitized) return null;

  const isKnownWhitelisted = Boolean(
    (knownCharacterKeys && knownCharacterKeys.has(key)) ||
      lookupKnownCelebrityProfile(displayName),
  );

  if (!isKnownWhitelisted) {
    const words = displayName.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return null;

    // Require proper capitalization for non-whitelisted names (e.g. "Trần Thiện", "Minh Anh", "Alex")
    const validCaps = words.every((w, idx) => {
      const lower = w.toLowerCase();
      if (idx > 0 && idx < words.length - 1 && LOWERCASE_NAME_PARTICLES.has(lower)) {
        return true;
      }
      return /^[\p{Lu}]/u.test(w);
    });
    if (!validCaps) return null;

    // Reject single-word unknown candidates that are common Vietnamese/English non-name words
    if (words.length === 1) {
      if (VI_COMMON_NON_NAME_SINGLE.has(key)) return null;
      // Single-word unknown name must be at least 2 letters and only letters/apostrophe/hyphen
      if (!/^[\p{L}][\p{L}'’-]{1,18}$/u.test(displayName)) return null;
    }
  }

  return {
    leadingPrefix,
    displayName,
    canonicalName: sanitized,
    stageNote,
    hasColon,
    remainder,
  };
}

export type PortraitRoleTier = 'main' | 'npc' | 'mob';

export interface PortraitRoleTierInfo {
  tier: PortraitRoleTier;
  tierLabel: 'Main' | 'NPC' | 'Mob';
  detailLabel: string;
}

const PORTRAIT_MOB_ROLE_RE =
  /(?:^|\s)(?:mob|quần\s*chúng|qua\s*đường|vai\s*phụ|nhân\s*vật\s*nền|người\s*nền|vô\s*danh|tạp\s*nham|lính\s*lác)(?:\s|$|\/|·|-)/i;

const PORTRAIT_MAIN_ROLE_RE =
  /(?:^|\s)(?:main|nhân\s*vật\s*chính|nv\s*chính|nam\s*chính|nữ\s*chính)(?:\s|$|\/|·|-)/i;

const PORTRAIT_EXPLICIT_NPC_ROLE_RE =
  /^(?:npc(?:\s+trong\s+truyện|\s+đồng\s+nhân)?)$/i;

const PORTRAIT_BARE_TIER_RE =
  /^(?:main|nhân\s*vật\s*chính|nv\s*chính|npc|npc\s+trong\s+truyện|npc\s+đồng\s+nhân|mob)$/i;

export function resolvePortraitRoleTier(
  p: Pick<CharacterPortrait, 'role' | 'isMc'>,
): PortraitRoleTierInfo {
  const rawRole = (p.role || '').trim();
  const isMobRole = PORTRAIT_MOB_ROLE_RE.test(rawRole);
  const isMainRole = PORTRAIT_MAIN_ROLE_RE.test(rawRole);
  const isExplicitNpc = PORTRAIT_EXPLICIT_NPC_ROLE_RE.test(rawRole);

  let tier: PortraitRoleTier;
  if (isMobRole) {
    tier = 'mob';
  } else if (isMainRole) {
    tier = 'main';
  } else if (isExplicitNpc) {
    tier = 'npc';
  } else if (p.isMc) {
    tier = 'main';
  } else {
    tier = 'npc';
  }

  const detailLabel = !rawRole || PORTRAIT_BARE_TIER_RE.test(rawRole) ? '' : rawRole;
  const tierLabel: 'Main' | 'NPC' | 'Mob' =
    tier === 'main' ? 'Main' : tier === 'mob' ? 'Mob' : 'NPC';

  return {
    tier,
    tierLabel,
    detailLabel,
  };
}

export function matchPortraitByName(
  name: string,
  portraits?: CharacterPortrait[],
): CharacterPortrait | undefined {
  const clean = (name || '').trim();
  if (!clean || !portraits || portraits.length === 0) return undefined;

  const targetIdentity = collectCharacterIdentityKeys(clean);
  if (targetIdentity.aliasKeys.size === 0) return undefined;

  // 1. Exact key or canonical alias match (including celebrity + real-name/stage-name aliases)
  for (const p of portraits) {
    const pName = (p.name || '').trim();
    if (!pName) continue;
    const pIdentity = collectCharacterIdentityKeys(pName, [
      p.role,
      p.signature,
      p.personality,
    ]);
    for (const k of targetIdentity.aliasKeys) {
      if (pIdentity.aliasKeys.has(k)) return p;
    }
  }

  // 2. Shadow word-boundary match (e.g. "Jennie" <-> "Jennie Kim", "Wonyoung" <-> "Jang Wonyoung")
  for (const p of portraits) {
    const pName = (p.name || '').trim();
    if (!pName) continue;
    const pIdentity = collectCharacterIdentityKeys(pName, [
      p.role,
      p.signature,
    ]);
    if (areIdentityKeysShadowMatch(targetIdentity.aliasKeys, pIdentity.aliasKeys)) {
      return p;
    }
  }

  return undefined;
}

export interface ResolvedSceneCharacterRole {
  name: string;
  tier: PortraitRoleTier;
  tierLabel: 'Main' | 'NPC' | 'Mob';
  detailLabel: string;
  pinned: boolean;
  locked: boolean;
  relationships: string;
  isMc: boolean;
  portrait?: CharacterPortrait;
}

export function resolveSceneCharacterRoles(params: {
  names: string[];
  portraits?: CharacterPortrait[];
  npcs?: Array<{ name: string; role?: string }>;
  mcName?: string;
}): ResolvedSceneCharacterRole[] {
  const { names, portraits = [], npcs = [], mcName = '' } = params;
  const mcKey = normalizeCharacterKey(mcName);
  const allowedRoster = new Set<string>();
  if (mcKey) allowedRoster.add(mcKey);
  for (const n of npcs) {
    const k = normalizeCharacterKey(n.name);
    if (k) allowedRoster.add(k);
  }
  const seenIdentitySets: Set<string>[] = [];
  const results: ResolvedSceneCharacterRole[] = [];

  for (const rawName of names) {
    const name = (rawName || '').trim();
    if (!name) continue;
    const portrait = matchPortraitByName(name, portraits);
    const isMcName =
      Boolean(portrait?.isMc) ||
      Boolean(mcKey && normalizeCharacterKey(name) === mcKey);
    const sanitized = isMcName ? name : sanitizeCharacterName(name, allowedRoster);
    if (!sanitized) continue;

    const identity = collectCharacterIdentityKeys(sanitized, [
      portrait?.name,
      portrait?.role,
      portrait?.signature,
    ]);
    if (
      seenIdentitySets.some((prev) =>
        areIdentityKeysShadowMatch(prev, identity.aliasKeys),
      )
    ) {
      continue;
    }
    seenIdentitySets.push(identity.aliasKeys);

    const key = normalizeCharacterKey(sanitized);
    const matchedNpc = npcs.find((n) => {
      const nId = collectCharacterIdentityKeys(n.name, [n.role]);
      return areIdentityKeysShadowMatch(identity.aliasKeys, nId.aliasKeys);
    });
    const isMcMatch = Boolean(
      portrait?.isMc ||
        (mcKey &&
          (key === mcKey ||
            (mcKey.length >= 3 &&
              key.length >= 3 &&
              (mcKey.startsWith(`${key} `) || key.startsWith(`${mcKey} `))))),
    );

    const tierInfo = portrait
      ? resolvePortraitRoleTier(portrait)
      : resolvePortraitRoleTier({
          role: matchedNpc?.role || '',
          isMc: isMcMatch,
        });

    const fallbackDetail =
      tierInfo.detailLabel ||
      (matchedNpc?.role && !PORTRAIT_BARE_TIER_RE.test(matchedNpc.role.trim())
        ? sanitizeNpcFieldText('role', matchedNpc.role.trim())
        : '');

    results.push({
      name: portrait?.name || sanitized,
      tier: tierInfo.tier,
      tierLabel: tierInfo.tierLabel,
      detailLabel: sanitizeNpcFieldText('role', fallbackDetail),
      pinned: Boolean(portrait?.pinned),
      locked: Boolean(portrait?.aiAutoEnrichLocked),
      relationships: (portrait?.relationships || '').trim(),
      isMc: isMcMatch,
      portrait,
    });
  }

  return results;
}

/**
 * Builds a normalized set of identity keys (including canonical & celebrity aliases)
 * for characters currently present/conversing in the active scene.
 */
export function buildOnlineCharacterKeySet(names?: string[]): Set<string> {
  const keys = new Set<string>();
  if (!names?.length) return keys;
  for (const name of names) {
    const clean = String(name || '').trim();
    if (!clean) continue;
    const { primaryKey, aliasKeys } = collectCharacterIdentityKeys(clean);
    if (primaryKey) keys.add(primaryKey);
    for (const k of aliasKeys) {
      if (k) keys.add(k);
    }
  }
  return keys;
}

/**
 * Checks whether a character/NPC is currently online (present/conversing in the active scene).
 */
export function isCharacterOnlineInSet(
  onlineKeys: Set<string>,
  rawName: string,
  extraFields?: Array<string | undefined>,
): boolean {
  if (!onlineKeys.size || !String(rawName || '').trim()) return false;
  const { primaryKey, aliasKeys } = collectCharacterIdentityKeys(
    rawName,
    extraFields,
  );
  if (primaryKey && onlineKeys.has(primaryKey)) return true;
  for (const k of aliasKeys) {
    if (k && onlineKeys.has(k)) return true;
  }
  return false;
}
