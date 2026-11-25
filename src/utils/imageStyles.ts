import {
  STORY_IMAGE_POSITIONS,
  type ArkState,
  type CharacterPortrait,
  type ImageCameraAngleId,
  type ImageCameraAnglePreset,
  type ImageGenerationMode,
  type ImageGridMode,
  type StoryClockState,
  type StoryImageConfig,
  type StoryImagePosition,
  type StoryImageStyle,
  type StoryImageStylePreset,
} from '../types/ark';
import {
  EMBEDDED_IMAGE_PROMPT_TEMPLATE,
  isLegacyPoisonedImagePromptTemplate,
  mergeEmbeddedCustomImageStyles,
  normalizeDeletedEmbeddedIds,
} from './embeddedPresets';
import {
  resolveEnglishStyleTokens,
  stripResidualVietnameseFromEnglishClause,
  translateVietnameseVisualToEnglish,
} from './imagePromptComposer';

export const IMAGE_STYLE_VARIABLES = [
  '${image_style_name}',
  '${image_style_description}',
  '${image_style_prompt_guide}',
] as const;

export type ImageStyleVariableToken = (typeof IMAGE_STYLE_VARIABLES)[number];

export const IMAGE_PROMPT_TEMPLATE_VARIABLES = [
  {
    token: '${story_text}',
    label: 'Nội dung truyện',
    group: 'context',
  },
  {
    token: '${onscene_characters_full}',
    label: 'NV có mặt (đầy đủ)',
    group: 'context',
  },
  {
    token: '${current_time}',
    label: 'Thời gian hiện tại',
    group: 'context',
  },
  {
    token: '${current_location}',
    label: 'Địa điểm hiện tại',
    group: 'context',
  },
  {
    token: '${entry_decision_new_characters}',
    label: 'NV mới xuất hiện',
    group: 'context',
  },
  {
    token: '${image_count}',
    label: 'Số lượng ảnh',
    group: 'mode',
  },
  {
    token: '${image_grid_mode}',
    label: 'Chế độ lưới khung',
    group: 'mode',
  },
  {
    token: '${image_generation_mode}',
    label: 'Chế độ sinh ảnh',
    group: 'mode',
  },
  {
    token: '${image_style_name}',
    label: 'Tên phong cách',
    group: 'style',
  },
  {
    token: '${image_style_description}',
    label: 'Mô tả phong cách',
    group: 'style',
  },
  {
    token: '${image_style_prompt_guide}',
    label: 'Chỉ dẫn chất liệu',
    group: 'style',
  },
] as const;

export type ImagePromptTemplateToken =
  (typeof IMAGE_PROMPT_TEMPLATE_VARIABLES)[number]['token'];

export const IMAGE_GRID_MODE_LABELS: Record<ImageGridMode, string> = {
  single: 'Ảnh đơn toàn khung (1 khung hình duy nhất)',
  grid_2: 'Lưới 2 khung liên tiếp (2-panel split)',
  grid_4: 'Lưới 4 khung kịch bản (2x2 storyboard grid)',
  character_sheet: 'Bảng nhiều góc nhìn (Multi-angle Character Sheet)',
};

export const IMAGE_GENERATION_MODE_LABELS: Record<ImageGenerationMode, string> =
  {
    scene: 'Minh họa cảnh truyện',
    portrait: 'Chân dung nhân vật',
    cinema_frame: 'Khung hình điện ảnh',
    illustration: 'Tranh minh họa nghệ thuật',
    custom: 'Tùy chỉnh tự do',
  };

export const IMAGE_CAMERA_ANGLES: ImageCameraAnglePreset[] = [
  {
    id: 'auto',
    label: 'Tự động theo cảnh',
    description: 'AI tự chọn bố cục góc máy phù hợp nhất với diễn biến hiện tại.',
    promptGuide: '',
  },
  {
    id: 'close_up',
    label: 'Cận cảnh (Close-up)',
    description:
      'Tập trung sát gương mặt, ánh mắt và biểu cảm tinh tế của nhân vật.',
    promptGuide:
      'intimate close-up framing, expressive facial focus, shallow depth of field, soft background bokeh',
  },
  {
    id: 'medium_shot',
    label: 'Trung cảnh (Medium Shot)',
    description:
      'Lấy từ thắt lưng trở lên, cân bằng giữa cử chỉ nhân vật và bối cảnh.',
    promptGuide:
      'balanced medium shot from waist up, natural body language and costume detail, cohesive foreground-background framing',
  },
  {
    id: 'wide_shot',
    label: 'Toàn cảnh (Wide Shot)',
    description:
      'Góc rộng thu trọn không gian, kiến trúc, thiên nhiên và tỷ lệ nhân vật.',
    promptGuide:
      'expansive wide establishing shot, grand environmental scale, atmospheric perspective, full-body character in context',
  },
  {
    id: 'low_angle',
    label: 'Góc thấp (Low Angle)',
    description:
      'Máy đặt thấp hất lên tạo cảm giác uy nghi, hùng vĩ hoặc áp đảo.',
    promptGuide:
      'dramatic low-angle hero camera looking upward, towering silhouettes, imposing cinematic presence',
  },
  {
    id: 'high_angle',
    label: 'Góc cao (High Angle)',
    description:
      'Nhìn từ trên cao xuống bao quát vị trí nhân vật và chiều sâu không gian.',
    promptGuide:
      'elevated high-angle aerial perspective looking down, spatial storytelling, sweeping depth',
  },
  {
    id: 'over_shoulder',
    label: 'Qua vai (Over-the-Shoulder)',
    description:
      'Khung hình đối thoại kịch tính đặt máy sau vai một nhân vật nhìn tới đối phương.',
    promptGuide:
      'cinematic over-the-shoulder shot, soft foreground shoulder frame, sharp focus on facing subject, narrative dialogue tension',
  },
  {
    id: 'dutch_angle',
    label: 'Góc nghiêng kịch tính (Dutch Angle)',
    description:
      'Đường chân trời nghiêng tạo cảm giác bất ổn, cao trào hoặc hành động mạnh.',
    promptGuide:
      'dynamic tilted Dutch angle composition, diagonal visual tension, high-stakes cinematic motion energy',
  },
];

export const STORY_IMAGE_STYLES: StoryImageStylePreset[] = [
  {
    id: 'live_action_cinema',
    label: 'Điện ảnh người thật',
    category: 'Điện ảnh',
    description:
      'Khung hình phim điện ảnh live-action chân thực như quay bằng ống kính anamorphic, ánh sáng tự nhiên có chiều sâu và chất da, trang phục thật.',
    promptGuide:
      'live-action cinematic film still, photorealistic human skin texture and natural pores, authentic fabric weave, 35mm anamorphic lens, shallow depth of field, naturalistic atmospheric lighting, subtle film grain, dramatic cinematic color grading, high dynamic range, no anime or cartoon look',
    promptHint: 'Phong cách điện ảnh người thật, ánh sáng phim 35mm chân thực',
  },
  {
    id: 'neo_guofeng_impasto',
    label: 'Bán hiện thực đắp màu điện ảnh Tân Quốc Phong',
    category: 'Hội họa',
    description:
      'Bán hiện thực kết hợp kỹ thuật đắp màu dày (impasto) giàu khối sáng tối với mỹ cảm Tân Quốc Phong hiện đại và bố cục điện ảnh.',
    promptGuide:
      'semi-realistic Neo-Guofeng cinematic impasto painting, expressive thick oil-like brushstrokes, sculptural volumetric light and shadow, refined East Asian facial features and modern-traditional costume aesthetics, rich jewel and ink-toned cinema palette, atmospheric haze, painterly depth with crisp focal rendering',
    promptHint: 'Bán hiện thực đắp màu điện ảnh Tân Quốc Phong',
  },
  {
    id: 'classic_impasto',
    label: 'Phong cách đắp màu cổ điển',
    category: 'Hội họa',
    description:
      'Tranh minh họa đắp màu truyền thống dày dặn, cọ vẽ có lực, sắc độ trầm ấm cổ điển và chuyển khối mượt mà giàu cảm xúc.',
    promptGuide:
      'classical impasto digital painting, rich layered pigment strokes, visible painterly brushwork, warm chiaroscuro studio lighting, timeless classical illustration composition, subtle canvas texture, soft atmospheric perspective, nuanced tonal harmony',
    promptHint: 'Phong cách đắp màu cổ điển giàu chất cọ',
  },
  {
    id: 'oil_painting',
    label: 'Phong cách sơn dầu',
    category: 'Hội họa',
    description:
      'Chất liệu sơn dầu trên toan vải mang hơi thở hội họa hàn lâm châu Âu, nổi bật ánh sáng tương phản, độ bóng sắc tố và vết cọ sống động.',
    promptGuide:
      'masterpiece classical oil painting on linen canvas, tactile oil paint strokes and glazing layers, Rembrandt-inspired dramatic lighting, deep rich shadows and luminous highlights, museum-grade fine art texture, authentic painterly edges and subtle craquelure',
    promptHint: 'Phong cách tranh sơn dầu cổ điển trên toan vải',
  },
  {
    id: 'anime_cg',
    label: 'Phong cách CG hoạt hình',
    category: 'CG / Anime',
    description:
      'Phong cách CG anime chất lượng cao với đường nét sắc sảo, màu sắc rực rỡ trong trẻo, hiệu ứng ánh sáng điện ảnh kiểu phim hoạt hình chiếu rạp.',
    promptGuide:
      'high-end theatrical anime CG illustration, crisp clean linework, luminous cel-and-soft shading blend, expressive anime eyes and flowing hair strands, radiant rim light, dramatic sky and particle glow, cinematic anime movie key visual quality',
    promptHint: 'Phong cách CG hoạt hình chiếu rạp sắc nét',
  },
  {
    id: 'refined_realistic_cg',
    label: 'CG hoạt hình chân thực, tinh gọn',
    category: 'CG / Anime',
    description:
      'Kết hợp tỷ lệ thanh thoát của hoạt hình với độ chân thực tinh gọn về ánh sáng, chất liệu và bố cục sạch sẽ, không rối chi tiết thừa.',
    promptGuide:
      'refined realistic anime CG rendering, sleek minimalist visual polish, believable subsurface scattering on skin, clean modern composition, crisp material separation for silk metal and glass, balanced cinematic lighting, uncluttered refined aesthetic',
    promptHint: 'CG hoạt hình chân thực, tinh gọn, sạch bố cục',
  },
  {
    id: 'rmji_high_cg',
    label: 'Phong cách CG cao cấp Phàm Nhân Tu Tiên',
    category: 'CG / 3D',
    description:
      'Phong cách 3D donghua cao cấp kiểu Phàm Nhân Tu Tiên: ngũ quan Á Đông chân thực, y phục tiên hiệp bay bổng, linh khí huyền ảo và ánh sáng sử thi.',
    promptGuide:
      'ultra-high-end Chinese 3D donghua CG style inspired by A Record of a Mortal’s Journey to Immortality (Phàm Nhân Tu Tiên), realistic East Asian 3D character sculpt, intricate embroidered xianxia robes and jade ornaments, physically based rendering with fine hair strands, swirling spiritual qi energy, misty mountain clouds, epic cinematic lighting, Unreal Engine 5 film quality',
    promptHint: 'Phong cách CG 3D cao cấp Phàm Nhân Tu Tiên',
  },
  {
    id: 'cinema_still_ukiyoe',
    label: 'Bản ảnh tĩnh điện ảnh đỉnh cao • Hiệu ứng Ukiyo-e',
    category: 'Điện ảnh',
    description:
      'Bố cục ảnh tĩnh điện ảnh đỉnh cao hòa quyện mỹ học tranh khắc gỗ Ukiyo-e: mảng sóng mây cách điệu, viền mực tinh tế và bảng màu khoáng sắc cổ.',
    promptGuide:
      'masterpiece cinematic film still fused with traditional Japanese Ukiyo-e woodblock print aesthetics, widescreen dramatic framing, stylized swirling clouds and water motifs, delicate ink outlines over rich mineral pigments (indigo, vermilion, ochre, gold leaf), subtle washi paper grain, poetic dramatic lighting',
    promptHint: 'Bản ảnh tĩnh điện ảnh đỉnh cao kết hợp hiệu ứng Ukiyo-e',
  },
  {
    id: 'cinema_still_vfx',
    label: 'Bản ảnh tĩnh điện ảnh đỉnh cao • Kỹ xảo chân thực',
    category: 'Điện ảnh',
    description:
      'Ảnh tĩnh bom tấn điện ảnh với kỹ xảo VFX siêu thực: ánh sáng thể tích, hạt lửa/linh lực, khói bụi vật lý chuẩn xác và tương phản kịch tính.',
    promptGuide:
      'blockbuster cinema still with photorealistic Hollywood-grade VFX, volumetric god rays, physically accurate sparks embers smoke and energy refraction, IMAX wide cinematic camera angle, ultra-sharp focal subject, realistic motion blur and lens optics, epic atmospheric scale',
    promptHint: 'Bản ảnh tĩnh điện ảnh đỉnh cao với kỹ xảo VFX chân thực',
  },
  {
    id: 'erliangjiu_manhua',
    label: 'Phong cách truyện tranh Nhị Lưỡng Tửu',
    category: 'Truyện tranh',
    description:
      'Nét vẽ manhua cổ phong đặc trưng kiểu Nhị Lưỡng Tửu: đường mực phóng khoáng sắc bén, tạo hình nhân vật tuấn mỹ lạnh lùng, ánh màu cổ trầm hút mắt.',
    promptGuide:
      'Chinese manhua art style inspired by Erliangjiu (Nhị Lưỡng Tửu), expressive sharp calligraphy ink lineart, charismatic angular character design with piercing gaze, moody antique ink-and-crimson color wash, dramatic flowing sleeves and hair motion, poetic wuxia-xianxia comic aesthetic',
    promptHint: 'Phong cách truyện tranh cổ phong Nhị Lưỡng Tửu',
  },
  {
    id: 'xianxia_exquisite',
    label: 'Minh họa tiên hiệp tinh xảo',
    category: 'Tiên hiệp',
    description:
      'Tranh minh họa tiên hiệp cầu kỳ đến từng hoa văn trâm ngọc, lụa mỏng xuyên sáng, kiếm khí và tiên cảnh mây mờ huyền mỹ.',
    promptGuide:
      'exquisite high-detail Chinese xianxia fantasy illustration, ornate flowing silk hanfu and celestial ribbons, finely crafted jade hairpins gold filigree and spirit sword details, ethereal glowing mist, luminous fairy-realm ambiance, painterly polished finish with jewel-like highlights',
    promptHint: 'Minh họa tiên hiệp tinh xảo, hoa văn cổ phong cầu kỳ',
  },
  {
    id: 'xianxia_ink_wash',
    label: 'Minh họa tiên hiệp thủy mặc vẽ tay tinh tế',
    category: 'Tiên hiệp',
    description:
      'Hội họa tiên hiệp thủy mặc vẽ tay trên giấy tuyên chỉ: nét bút lông thanh thoát, loang mực uyển chuyển, khoảng trống thi vị và điểm sắc thanh nhã.',
    promptGuide:
      'delicate hand-painted Chinese xianxia ink-wash (shuimo) illustration on Xuan rice paper, graceful gongbi-meets-xieyi brushwork, organic sumi ink bleeds and misty mountain silhouettes, restrained mineral watercolor accents of celadon teal vermilion and pale gold, poetic negative space, refined classical scroll aesthetic',
    promptHint: 'Minh họa tiên hiệp thủy mặc vẽ tay tinh tế',
  },
  {
    id: '3d_ukiyoe',
    label: 'Kết xuất 3D với hiệu ứng Ukiyo-e',
    category: 'CG / 3D',
    description:
      'Mô hình kết xuất 3D khối chiều sâu sống động phủ shader nghệ thuật Ukiyo-e: vân khắc gỗ, ánh sáng cách điệu và chất liệu chạm nổi độc đáo.',
    promptGuide:
      'stylized 3D octane-quality render with Ukiyo-e woodblock shader aesthetic, sculptural 3D depth and camera parallax paired with hand-carved woodgrain textures, stylized ink contours, layered mineral color planes, floating stylized clouds and waves, artistic NPR 3D craftsmanship',
    promptHint: 'Kết xuất 3D nghệ thuật với hiệu ứng khắc gỗ Ukiyo-e',
  },
  {
    id: 'xianxia_jade_flat',
    label: 'Tiên hiệp nét ngọc bản tô phẳng',
    category: 'Tiên hiệp',
    description:
      'Đường nét mảnh thanh như khắc ngọc kết hợp mảng màu phẳng tinh tế, tông thanh ngọc — trắng sứ — vàng nhạt nhẹ nhàng, trang nhã.',
    promptGuide:
      'xianxia jade-fine lineart flat-color illustration, ultra-clean delicate ink lines like carved jade, harmonious celadon jade ivory and muted gold flat color blocks, minimal soft gradient accents, crisp decorative silhouettes, serene refined oriental graphic elegance',
    promptHint: 'Tiên hiệp nét ngọc thanh mảnh bản tô phẳng tinh tế',
  },
  {
    id: 'character_sheet_multi',
    label: 'Bảng nhiều góc nhìn',
    category: 'Thiết kế NV',
    description:
      'Character Sheet chuyên nghiệp: bố cục nhiều góc nhìn trên cùng 1 khung hình (chính diện, góc nghiêng, 3/4, sau lưng & cận mặt) theo phong cách điện ảnh chân thực.',
    promptGuide:
      'professional photorealistic cinematic character sheet (multi-angle turnaround design sheet on a single clean studio frame): includes full-body front view, full-body side profile view, full-body three-quarter view, full-body back view, and high-detail close-up facial expression portrait arranged neatly in one cohesive composition; 100% consistent face, hairstyle, body proportions, costume details, and accessories across every angle; realistic cinema lighting, neutral dark studio backdrop, crisp sharp focus',
    promptHint:
      'Bảng nhiều góc nhìn (Character Sheet) trên 1 khung hình, phong cách điện ảnh chân thực',
  },
];

export const SAMPLE_REMOVED_SENTINEL = '__removed__';

/**
 * Bundled lightweight preview comparison images for all 15 built-in art styles.
 * Served as static app assets (0 bytes in localStorage) so Preview and fresh Web
 * loads always display authentic comparison samples out of the box.
 */
export const DEFAULT_STYLE_SAMPLE_IMAGES: Record<string, string> = {
  'style:live_action_cinema':
    '/src/assets/images/style_live_action_1795313761969.jpg',
  'style:neo_guofeng_impasto':
    '/src/assets/images/style_neo_guofeng_1795313761807.jpg',
  'style:classic_impasto':
    '/src/assets/images/style_classic_impasto_1795313762016.jpg',
  'style:oil_painting':
    '/src/assets/images/style_oil_painting_1795313761473.jpg',
  'style:anime_cg':
    '/src/assets/images/style_anime_cg_1795313762180.jpg',
  'style:refined_realistic_cg':
    '/src/assets/images/style_refined_cg_1795313760805.jpg',
  'style:rmji_high_cg':
    '/src/assets/images/style_rmji_cg_1795313761565.jpg',
  'style:cinema_still_ukiyoe':
    '/src/assets/images/style_cinema_ukiyoe_1795313759855.jpg',
  'style:cinema_still_vfx':
    '/src/assets/images/style_cinema_vfx_1795313762093.jpg',
  'style:erliangjiu_manhua':
    '/src/assets/images/style_manhua_ink_1795313761609.jpg',
  'style:xianxia_exquisite':
    '/src/assets/images/style_xianxia_fine_1795313760190.jpg',
  'style:xianxia_ink_wash':
    '/src/assets/images/style_xianxia_shuimo_1795313761888.jpg',
  'style:3d_ukiyoe':
    '/src/assets/images/style_3d_ukiyoe_1795313761771.jpg',
  'style:xianxia_jade_flat':
    '/src/assets/images/style_jade_flat_1795313761475.jpg',
  'style:character_sheet_multi':
    '/src/assets/images/style_char_sheet_1795313761803.jpg',
};

export const STORY_IMAGE_NO_TEXT_POSITIVE_DIRECTIVE =
  'clean borderless cinematic frame, no text, no subtitles, no timestamps, no UI overlays, no watermarks, no gibberish letters';

export const PORTRAIT_NO_TEXT_POSITIVE_DIRECTIVE =
  'clean borderless portrait frame, no text, no subtitles, no timestamps, no UI overlays, no watermarks, no gibberish letters';

export const STORY_IMAGE_NO_TEXT_NEGATIVE_DIRECTIVE =
  'text, typography, letters, words, subtitles, captions, timestamp, date, clock, numbers, UI, HUD, status window, interface, speech bubble, comic panel, split screen, collage, border, frame, watermark, signature, logo, label, title card, hanzi, kanji, chinese characters, gibberish text, blurry text, writing, calligraphy text overlay';

export const STORY_IMAGE_CLEAR_FACE_POSITIVE_DIRECTIVE =
  'clear sharp detailed facial features, natural realistic skin texture with subtle pores, authentic hair and facial detail, expressive eyes, front or three-quarter view facing camera, waist-up or medium close-up framing';

export const STORY_IMAGE_CLEAR_FACE_NEGATIVE_DIRECTIVE =
  'plastic skin, overly smooth skin, airbrushed skin, waxy skin, porcelain skin, beauty filter, retouched skin, glossy doll face, silicone skin, fake smooth face, baby-face de-aging, back view, turned away, facing away, rear view, distant tiny face, far away figure, deformed face, distorted face, melted face, blurry face, distorted eyes, asymmetrical eyes, bad facial anatomy, crowded scene, group shot';

export function buildHeadcountNegativeDirective(
  personCount: number | null | undefined,
): string {
  if (personCount === null || personCount === undefined || personCount < 0) {
    return '';
  }
  if (personCount === 0) {
    return 'people, person, human, man, woman, boy, girl, figure, silhouette, crowd, portrait, face, bystanders';
  }
  if (personCount === 1) {
    return 'multiple people, two people, three people, four people, couple, group, crowd, extra people, bystanders, background people, 2boys, 2girls, 1boy 1girl, duplicate person';
  }
  if (personCount === 2) {
    return 'three people, four people, five people, crowd, group, extra people, bystanders, background people, extra person, duplicate person';
  }
  return 'crowd, large group, extra bystanders, background crowd, duplicate faces';
}

export function mergeStoryImageNegativePrompt(
  userNegative?: string,
  extraNegative?: string,
): string {
  const parts = [
    String(userNegative || '').trim(),
    String(extraNegative || '').trim(),
    STORY_IMAGE_NO_TEXT_NEGATIVE_DIRECTIVE,
  ].filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const chunk of parts) {
    for (const rawTok of chunk.split(',')) {
      const tok = rawTok.trim();
      if (!tok) continue;
      const key = tok.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(tok);
    }
  }
  return deduped.join(', ');
}

const VIETNAMESE_DIACRITIC_RE =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

const VIETNAMESE_COMMON_WORD_RE =
  /\b(?:người|nhân\s+vật|không\s+gian|ánh\s+sáng|khung\s+cảnh|phòng|trang\s+phục|biểu\s+cảm|đang|trong|giữa|trước|sau|cùng|nhưng|của|với|một|những|chiếc|căn)\b/i;

export function containsVietnameseText(text: string): boolean {
  const clean = String(text || '').trim();
  if (!clean) return false;
  return (
    VIETNAMESE_DIACRITIC_RE.test(clean) || VIETNAMESE_COMMON_WORD_RE.test(clean)
  );
}

/**
 * Strips raw dates (e.g. 19/10/2025, 2025-10-19), clock strings (23:15),
 * turn/page/meta labels, and bracketed system annotations so image models
 * never render timestamps, UI panels, or garbled text onto the illustration.
 */
export function sanitizeVisualPromptFragment(raw: string): string {
  let out = String(raw || '');
  if (!out.trim()) return '';

  // Remove XML/HTML tags and markdown headers/bold/code fences
  out = out
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*|__|~~/g, '');

  // Remove bracketed meta/timestamp/status tags like [19/10/2025 · 23:15], [Lượt 3], [Hệ thống: ...]
  out = out.replace(
    /\[\s*(?:ngày|thời\s*gian|đồng\s*hồ|lượt|trang|chương|khung\s*(?:đầu|giữa|cuối)|hệ\s*thống|ghi\s*chú|tóm\s*tắt|trạng\s*thái|địa\s*điểm|time|date|clock|turn|page|frame|system|status|meta|note)[^\]]*\]/gi,
    ' ',
  );
  out = out.replace(
    /\[\s*(?:[^\]\n]*\b(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}|(?:[01]?\d|2[0-3])\s*:\s*[0-5]\d)\b[^\]\n]*)\]/gi,
    ' ',
  );

  // Remove standalone Vietnamese/English date-time header lines
  out = out.replace(
    /^\s*(?:thời\s*gian(?:\s*hiện\s*tại)?|ngày\s*giờ|lượt\s*truyện|lượt|trang|chương|khung\s*(?:đầu|giữa|cuối)|bộ\s*đếm|status|timestamp|date|time)\s*[:：\-–—][^\n]*$/gim,
    '',
  );

  // Remove explicit numeric dates and clock times inline
  out = out
    .replace(
      /\b(?:thứ\s*(?:hai|ba|tư|năm|sáu|bảy|[2-7])|chủ\s*nhật)\s*,?\s*/gi,
      '',
    )
    .replace(
      /\bngày\s+\d{1,2}\s*(?:tháng\s+\d{1,2})?(?:\s*năm\s+\d{2,4})?\b/gi,
      '',
    )
    .replace(/\b\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{2,4}\b/g, '')
    .replace(/\b\d{4}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{1,2}\b/g, '')
    .replace(
      /\b(?:lúc\s+)?(?:[01]?\d|2[0-3])\s*(?::|h|giờ)\s*[0-5]\d(?:\s*(?::\s*[0-5]\d|phút|am|pm))?\b/gi,
      '',
    )
    .replace(/\b(?:lượt|trang)\s*#?\d+\b/gi, '');

  // Clean leftover punctuation/separators from stripped timestamps
  out = out
    .replace(/[|·•]{2,}/g, ' ')
    .replace(/\(\s*[,;:\-–—·|\s]*\)/g, '')
    .replace(/^\s*[,;:\-–—·|]+\s*/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

/**
 * Converts StoryClockState into a pure visual lighting & time-of-day cue
 * with ZERO numeric dates or clock digits so models never draw timestamps.
 */
export function clockToVisualLightingCue(
  clock?: Partial<StoryClockState> | null,
): string {
  if (!clock) return 'natural atmospheric lighting matching the scene';
  const rawHour = Number(clock.hour);
  const hour = Number.isFinite(rawHour)
    ? ((Math.floor(rawHour) % 24) + 24) % 24
    : -1;

  let timeCue = 'natural atmospheric lighting matching the scene';
  if (hour >= 5 && hour < 7) {
    timeCue = 'early dawn twilight with cool blue mist and soft rising horizon glow';
  } else if (hour >= 7 && hour < 11) {
    timeCue = 'crisp morning daylight with soft angled sunlight';
  } else if (hour >= 11 && hour < 15) {
    timeCue = 'bright midday natural daylight with clear shadows';
  } else if (hour >= 15 && hour < 17) {
    timeCue = 'warm late-afternoon sunlight with long golden shadows';
  } else if (hour >= 17 && hour < 19) {
    timeCue = 'golden-hour sunset and warm dusk twilight glow';
  } else if (hour >= 19 && hour < 22) {
    timeCue = 'evening nightfall with warm indoor lamps or street lighting against a dark sky';
  } else if (hour >= 22 || (hour >= 0 && hour < 5)) {
    timeCue = 'deep late-night atmosphere with dim moody ambient light, moonlight, or soft practical lamps';
  }

  return timeCue;
}

export function resolveSceneLightingCue(options: {
  sceneText?: string;
  locationText?: string;
  clock?: Partial<StoryClockState> | null;
  clockEnabled?: boolean;
}): string {
  const combined = `${options.sceneText || ''}\n${options.locationText || ''}`
    .toLowerCase()
    .trim();

  const hasRecordingStudio =
    /(?:phòng\s*thu|thu\s*âm|bàn\s*mixer|bàn\s*trộn|soundproof|recording\s*studio|music\s*studio|mixing\s*console|control\s*room|booth\s*thu|micro\s*thu)/i.test(
      combined,
    );
  const hasNightClubOrBar =
    /(?:quán\s*bar|quán\s*rượu|hộp\s*đêm|vũ\s*trường|nightclub|cocktail\s*bar|karaoke|sân\s*khấu\s*đêm|lounge|pub\b)/i.test(
      combined,
    );
  const hasIndoorSpace =
    hasRecordingStudio ||
    hasNightClubOrBar ||
    /(?:trong\s*phòng|căn\s*phòng|phòng\s*ngủ|phòng\s*khách|phòng\s*làm\s*việc|phòng\s*tập|văn\s*phòng|căn\s*hộ|chung\s*cư|khách\s*sạn|nhà\s*hàng|quán\s*cà\s*phê|hành\s*lang|tầng\s*hầm|ngôi\s*nhà|trong\s*nhà|bên\s*trong|bedroom|living\s*room|office|apartment|studio|hallway|interior|indoor|room|basement|cafe|restaurant|hotel)/i.test(
      combined,
    );
  const hasExplicitNight =
    /(?:nửa\s*đêm|đêm\s*khuya|ban\s*đêm|trong\s*đêm|đêm\s*nay|đêm\s*muộn|khuya\s*muộn|khuya|trời\s*tối|tối\s*muộn|tối\s*om|tối\s*mịt|bóng\s*tối|màn\s*đêm|ánh\s*trăng|dưới\s*trăng|trăng\s*sáng|bầu\s*trời\s*đêm|sao\s*trời|late[\s-]*night|midnight|nighttime|at\s*night|dark\s*night|moonlight|dark\s*room|dimly[\s-]*lit|pitch[\s-]*dark)/i.test(
      combined,
    );
  const hasEvening =
    /(?:buổi\s*tối|chập\s*tối|xẩm\s*tối|tối\s*nay|evening|nightfall)/i.test(
      combined,
    );
  const hasSunsetDusk =
    /(?:hoàng\s*hôn|chiều\s*tà|chạng\s*vạng|xế\s*chiều|nắng\s*chiều|chiều\s*muộn|sunset|dusk|twilight|golden\s*hour)/i.test(
      combined,
    );
  const hasDawn =
    /(?:bình\s*minh|rạng\s*đông|hừng\s*đông|sáng\s*sớm|nắng\s*sớm|tinh\s*mơ|dawn|sunrise|early\s*morning)/i.test(
      combined,
    );
  const hasExplicitDaylight =
    /(?:buổi\s*sáng|ban\s*ngày|giữa\s*trưa|trưa\s*nắng|nắng\s*gắt|nắng\s*mai|nắng\s*vàng|ánh\s*nắng|trời\s*nắng|trời\s*sáng|morning\s*sun|morning\s*light|daylight|bright\s*sunlight|midday|sunny\s*day|afternoon\s*sun)/i.test(
      combined,
    );
  const hasRainOrStorm =
    /(?:mưa\s*rào|mưa\s*phùn|cơn\s*mưa|trời\s*mưa|mưa\s*đêm|giông\s*bão|sấm\s*chớp|u\s*ám|sương\s*mù|rainy|raining|rainstorm|stormy|overcast|foggy|misty)/i.test(
      combined,
    );
  const hasNeon =
    /(?:đèn\s*neon|ánh\s*neon|biển\s*hiệu\s*sáng|neon\s*light|neon\s*glow|neon\s*sign)/i.test(
      combined,
    );
  const hasWarmLamp =
    /(?:đèn\s*bàn|đèn\s*ngủ|đèn\s*vàng|đèn\s*chùm|đèn\s*trần|ánh\s*đèn|bóng\s*đèn|đèn\s*lồng|desk\s*lamp|bedside\s*lamp|warm\s*lamp|table\s*lamp|tungsten|lantern)/i.test(
      combined,
    );
  const hasCandleOrFire =
    /(?:ánh\s*nến|ngọn\s*nến|nến\s*cháy|lò\s*sưởi|lửa\s*trại|đốm\s*lửa|candlelight|candle|fireplace|firelight|campfire)/i.test(
      combined,
    );

  // 1) Recording studio / dim control room takes strict priority over morning daylight
  if (hasRecordingStudio) {
    if (hasNeon) {
      return 'dim late-night recording studio lighting, subtle neon accent glow, console LED lights, moody shadows';
    }
    if (hasExplicitDaylight && !hasExplicitNight && !hasEvening) {
      return 'soft enclosed recording studio lighting, warm desk lamp and subtle console LED glow';
    }
    return 'dim late-night recording studio lighting, warm desk lamp glow, subtle mixing console LED lights, soft moody shadows';
  }

  // 2) Bar / club / neon interior
  if (hasNightClubOrBar) {
    return 'dim moody bar and club lighting, warm amber and subtle neon glow, deep atmospheric shadows';
  }

  // 3) Explicit night / late night / dark / evening
  if (hasExplicitNight || hasEvening) {
    if (hasCandleOrFire) {
      return 'dim night interior lit by warm flickering candlelight and deep soft shadows';
    }
    if (hasNeon) {
      return hasRainOrStorm
        ? 'moody rainy night lighting with neon reflections, wet sheen, and deep shadows'
        : 'moody night lighting with neon glow and cool-warm atmospheric contrast';
    }
    if (hasWarmLamp || hasIndoorSpace) {
      return 'dim late-night indoor lighting, warm desk lamp glow, soft ambient shadows';
    }
    if (hasRainOrStorm) {
      return 'dark rainy night atmosphere with cool wet reflections and dim ambient streetlights';
    }
    return 'deep night lighting with soft moonlight, dim ambient glow, and cool nocturnal shadows';
  }

  // 4) Candlelight / neon / dim warm lamp even without explicit "night" keyword
  if (hasCandleOrFire) {
    return 'warm flickering candlelight with soft golden highlights and deep shadows';
  }
  if (hasNeon) {
    return 'moody dim neon lighting with colorful ambient reflections and soft shadows';
  }
  if (hasWarmLamp && hasIndoorSpace && !hasExplicitDaylight) {
    return 'dim cozy indoor lighting, warm lamp glow, soft atmospheric shadows';
  }

  // 5) Sunset / dusk
  if (hasSunsetDusk) {
    return hasIndoorSpace
      ? 'warm late-evening sunset light through windows blended with soft indoor lamp glow'
      : 'warm golden-hour sunset and dusk twilight glow with long soft shadows';
  }

  // 6) Dawn
  if (hasDawn) {
    return 'soft early dawn twilight with cool mist and gentle rising light';
  }

  // 7) Rain / overcast
  if (hasRainOrStorm && !hasExplicitDaylight) {
    return 'overcast rainy atmospheric lighting with soft cool diffused shadows';
  }

  // 8) Explicit daylight in scene text
  if (hasExplicitDaylight) {
    return hasIndoorSpace
      ? 'soft natural daylight filtering through windows with gentle indoor shadows'
      : 'natural crisp daylight with soft directional sunlight';
  }

  // 9) Fallback to Story Clock ONLY if enabled and text had no conflicting indoor/dark cue
  if (options.clockEnabled && options.clock) {
    const rawHour = Number(options.clock.hour);
    const hour = Number.isFinite(rawHour)
      ? ((Math.floor(rawHour) % 24) + 24) % 24
      : -1;
    // Never inject bright outdoor morning sunlight into dark/windowless indoor rooms
    if (
      hasIndoorSpace &&
      hour >= 7 &&
      hour < 17 &&
      /(?:hầm|tối|studio|phòng\s*tập|rạp|khách\s*sạn|basement|dim|dark)/i.test(
        combined,
      )
    ) {
      return 'soft dim indoor practical lighting with moody ambient shadows';
    }
    return clockToVisualLightingCue(options.clock);
  }

  return hasIndoorSpace
    ? 'soft cinematic indoor lighting matching the room atmosphere'
    : 'natural atmospheric cinematic lighting matching the scene';
}

export function appendNoTextVisualConstraint(prompt: string): string {
  const clean = String(prompt || '').trim();
  if (!clean) return STORY_IMAGE_NO_TEXT_POSITIVE_DIRECTIVE;
  if (/no\s+text,\s*no\s+subtitles/i.test(clean)) {
    return clean;
  }
  return `${clean}, ${STORY_IMAGE_NO_TEXT_POSITIVE_DIRECTIVE}`;
}

export function appendPortraitNoTextConstraint(prompt: string): string {
  const clean = String(prompt || '').trim();
  if (!clean) return PORTRAIT_NO_TEXT_POSITIVE_DIRECTIVE;
  if (/no\s+text,\s*no\s+subtitles/i.test(clean)) {
    return clean;
  }
  return `${clean}, ${PORTRAIT_NO_TEXT_POSITIVE_DIRECTIVE}`;
}

export const DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE = `Featuring ${'${onscene_characters_full}'}. Captured ${'${story_text}'}. Set in ${'${current_location}'}, illuminated by ${'${current_time}'}, rendered in ${'${image_style_name}'}: ${'${image_style_prompt_guide}'}, ${STORY_IMAGE_NO_TEXT_POSITIVE_DIRECTIVE}`;

export const DEFAULT_IMAGE_STYLE_BLOCK_TEMPLATE = '${image_style_prompt_guide}';

const LEGACY_IMAGE_STYLE_MAP: Record<string, StoryImageStyle> = {
  cinematic: 'live_action_cinema',
  realistic: 'live_action_cinema',
  anime: 'anime_cg',
  watercolor: 'xianxia_ink_wash',
  dark_fantasy: 'rmji_high_cg',
  custom: 'live_action_cinema',
};

export function getAllImageStyles(
  customStyles?: StoryImageStylePreset[],
): StoryImageStylePreset[] {
  const validCustoms = Array.isArray(customStyles)
    ? customStyles.filter(
        (s) => s && typeof s.id === 'string' && s.id.trim() && s.label?.trim(),
      )
    : [];
  return [...STORY_IMAGE_STYLES, ...validCustoms];
}

export function normalizeCustomImageStyles(
  raw: unknown,
): StoryImageStylePreset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(STORY_IMAGE_STYLES.map((s) => s.id));
  const out: StoryImageStylePreset[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id || '').trim();
    const label = String(rec.label || '').trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const description = String(rec.description || '').trim();
    const promptGuide = String(
      rec.promptGuide || rec.promptHint || description || label,
    ).trim();
    out.push({
      id,
      label,
      category: String(rec.category || 'Tùy chỉnh').trim() || 'Tùy chỉnh',
      description:
        description || `Phong cách tùy chỉnh "${label}" do người dùng lưu.`,
      promptGuide,
      promptHint: String(rec.promptHint || promptGuide).trim(),
      isCustom: true,
    });
  }
  return out;
}

export function isBundledSamplePath(val: string): boolean {
  return (
    val.startsWith('/src/assets/') ||
    val.startsWith('/assets/')
  );
}

/**
 * Normalizes a sampleImages map so it ONLY contains valid user-assigned entries
 * (uploaded data URLs, pasted HTTP(S) URLs, `portrait:<id>` links, or explicit
 * removal markers). Bundled fallback paths are NEVER stored as user entries so
 * they can never mask, overwrite, or replace real user-assigned images.
 */
export function normalizeSampleImagesMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k || '').trim();
    const val = typeof v === 'string' ? v.trim() : '';
    if (!key || !val) continue;
    if (isBundledSamplePath(val)) {
      // Never persist bundled fallback paths as user overrides
      continue;
    }
    if (
      val === SAMPLE_REMOVED_SENTINEL ||
      val.startsWith('portrait:') ||
      val.startsWith('data:image/') ||
      /^https?:\/\//i.test(val)
    ) {
      out[key] = val;
    }
  }
  return out;
}

export function isUserAssignedSampleValue(val?: string | null): boolean {
  const trimmed = String(val || '').trim();
  if (!trimmed || trimmed === SAMPLE_REMOVED_SENTINEL) return false;
  if (isBundledSamplePath(trimmed)) return false;
  return (
    trimmed.startsWith('portrait:') ||
    trimmed.startsWith('data:image/') ||
    /^https?:\/\//i.test(trimmed)
  );
}

/**
 * Safely merges two user sample maps where `primary` always takes priority.
 * Never allows empty or bundled fallback values to overwrite an existing user image.
 */
export function mergeUserSampleImages(
  primary?: Record<string, string>,
  secondary?: Record<string, string>,
): Record<string, string> {
  const cleanSecondary = normalizeSampleImagesMap(secondary);
  const cleanPrimary = normalizeSampleImagesMap(primary);
  const merged: Record<string, string> = { ...cleanSecondary };
  for (const [key, val] of Object.entries(cleanPrimary)) {
    merged[key] = val;
  }
  return merged;
}

/**
 * Backward-compatible alias that returns normalized user-only sample images.
 * Bundled defaults are strictly applied as read-only fallbacks inside
 * `resolveEffectiveSampleImage` ONLY when a slot has no user image.
 */
export function mergeSampleImagesWithDefaults(
  userSamples?: Record<string, string>,
): Record<string, string> {
  return normalizeSampleImagesMap(userSamples);
}

/**
 * Extracts only user-assigned sample images (plus explicit removals of bundled
 * fallbacks) for compact, zero-bloat persistence into `ARK_LITE_AI_STUDIO_V1`
 * and IndexedDB vault.
 */
export function extractPersistableSampleImages(
  sampleImages?: Record<string, string>,
): Record<string, string> {
  const cleaned = normalizeSampleImagesMap(sampleImages);
  const compact: Record<string, string> = {};
  for (const [key, val] of Object.entries(cleaned)) {
    const bundled = DEFAULT_STYLE_SAMPLE_IMAGES[key];
    if (!bundled && val === SAMPLE_REMOVED_SENTINEL) {
      continue;
    }
    compact[key] = val;
  }
  return compact;
}

/**
 * Collects all portraits across the active portrait bank AND every saved
 * companion portrait bank so `portrait:<id>` sample references never break
 * when switching worlds, companions, or tabs.
 */
export function collectAllAvailablePortraits(
  state?: Pick<ArkState, 'portraitBank' | 'companionPortraits'> | null,
): CharacterPortrait[] {
  if (!state) return [];
  const byId = new Map<string, CharacterPortrait>();
  const addList = (list?: CharacterPortrait[]) => {
    if (!Array.isArray(list)) return;
    for (const p of list) {
      if (!p || !p.id) continue;
      const existing = byId.get(p.id);
      if (!existing || (!existing.imageData?.trim() && p.imageData?.trim())) {
        byId.set(p.id, p);
      }
    }
  };
  addList(state.portraitBank?.portraits);
  if (state.companionPortraits && typeof state.companionPortraits === 'object') {
    for (const bank of Object.values(state.companionPortraits)) {
      addList(bank?.portraits);
    }
  }
  return Array.from(byId.values());
}

export interface PortableSampleImagesBundle {
  format: 'ark_lite_sample_images_v1';
  exportedAt: string;
  sampleImages: Record<string, string>;
  customStyles: StoryImageStylePreset[];
}

/**
 * Builds a portable JSON bundle of all user-assigned Style (01–15) & Camera Angle
 * (01–08) sample images + custom styles for transferring cleanly across Remix
 * accounts or devices. Resolves `portrait:<id>` entries into their actual image
 * data/URL so they still display on a brand-new Remixed account.
 */
export function buildPortableSampleImagesBundle(
  storyImage: StoryImageConfig | undefined,
  allPortraits?: CharacterPortrait[],
): PortableSampleImagesBundle {
  const rawSamples = extractPersistableSampleImages(storyImage?.sampleImages);
  const portable: Record<string, string> = {};
  for (const [key, val] of Object.entries(rawSamples)) {
    if (val === SAMPLE_REMOVED_SENTINEL) {
      portable[key] = val;
      continue;
    }
    if (val.startsWith('portrait:')) {
      const pid = val.slice('portrait:'.length).trim();
      const matched = (allPortraits || []).find((p) => p.id === pid);
      const img = (matched?.imageData || '').trim();
      if (img) {
        portable[key] = img;
      }
      continue;
    }
    portable[key] = val;
  }
  return {
    format: 'ark_lite_sample_images_v1',
    exportedAt: new Date().toISOString(),
    sampleImages: portable,
    customStyles: normalizeCustomImageStyles(storyImage?.customStyles),
  };
}

export function parsePortableSampleImagesBundle(
  rawText: string,
): {
  ok: true;
  sampleImages: Record<string, string>;
  customStyles: StoryImageStylePreset[];
} | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Tệp JSON không hợp lệ.' };
    }
    const rec = parsed as Record<string, unknown>;
    const storyImageNode =
      rec.storyImage && typeof rec.storyImage === 'object'
        ? (rec.storyImage as Record<string, unknown>)
        : rec;
    const sampleImages = normalizeSampleImagesMap(storyImageNode.sampleImages);
    const customStyles = normalizeCustomImageStyles(storyImageNode.customStyles);
    if (
      Object.keys(sampleImages).length === 0 &&
      customStyles.length === 0
    ) {
      return {
        ok: false,
        error:
          'Không tìm thấy ảnh mẫu phong cách/góc máy hoặc kiểu tùy chỉnh nào trong tệp JSON này.',
      };
    }
    return { ok: true, sampleImages, customStyles };
  } catch {
    return { ok: false, error: 'Không thể đọc tệp JSON bộ ảnh mẫu.' };
  }
}

export function normalizeCameraAngleId(raw: unknown): ImageCameraAngleId {
  const key = typeof raw === 'string' ? raw.trim() : '';
  const found = IMAGE_CAMERA_ANGLES.find((a) => a.id === key);
  return found ? found.id : 'auto';
}

export function resolveCameraAngle(
  angleId?: ImageCameraAngleId | string | null,
): ImageCameraAnglePreset {
  const normalized = normalizeCameraAngleId(angleId);
  return (
    IMAGE_CAMERA_ANGLES.find((a) => a.id === normalized) ||
    IMAGE_CAMERA_ANGLES[0]
  );
}

export function normalizeStoryImageStyleId(
  raw?: unknown,
  customStyles?: StoryImageStylePreset[],
): StoryImageStyle {
  const key = typeof raw === 'string' ? raw.trim() : '';
  if (!key) return STORY_IMAGE_STYLES[0].id;
  const all = getAllImageStyles(customStyles);
  const direct = all.find((s) => s.id === key);
  if (direct) return direct.id;
  const mapped = LEGACY_IMAGE_STYLE_MAP[key];
  if (mapped) return mapped;
  return STORY_IMAGE_STYLES[0].id;
}

export function resolveStoryImageStyle(
  styleOrId?: StoryImageStylePreset | StoryImageStyle | string | null,
  customStyles?: StoryImageStylePreset[],
): StoryImageStylePreset {
  const fallback = STORY_IMAGE_STYLES[0];
  if (styleOrId && typeof styleOrId === 'object') {
    const rawObj = styleOrId as Partial<StoryImageStylePreset>;
    const guide = String(
      rawObj.promptGuide ?? rawObj.promptHint ?? fallback.promptGuide ?? '',
    ).trim();
    return {
      ...fallback,
      ...rawObj,
      id: String(rawObj.id ?? fallback.id).trim() || fallback.id,
      label: String(rawObj.label ?? fallback.label).trim() || fallback.label,
      description:
        String(rawObj.description ?? fallback.description).trim() ||
        fallback.description,
      promptGuide: guide || fallback.promptGuide,
      promptHint: String(rawObj.promptHint ?? guide ?? fallback.promptHint).trim(),
    };
  }
  const all = getAllImageStyles(customStyles);
  const normalizedId = normalizeStoryImageStyleId(styleOrId, customStyles);
  return all.find((s) => s.id === normalizedId) || fallback;
}

export function getSampleImageKey(
  kind: 'style' | 'angle',
  id: string,
): string {
  return `${kind}:${id}`;
}

export interface ResolvedSampleImage {
  src: string;
  sourceLabel: string;
  isPortraitRef: boolean;
  isExternalUrl: boolean;
  isBundledDefault: boolean;
  isUserImage: boolean;
}

export function resolveSampleImageSrc(
  sampleValue: string | undefined,
  portraits?: CharacterPortrait[],
  fallbackBundledSrc?: string,
): ResolvedSampleImage | null {
  const rawVal = (sampleValue || '').trim();
  if (rawVal === SAMPLE_REMOVED_SENTINEL) {
    return null;
  }

  // 1. STRICT USER-FIRST PRIORITY: any user-uploaded image, pasted URL, or portrait ref
  // ALWAYS wins over bundled fallback images.
  if (rawVal && !isBundledSamplePath(rawVal)) {
    if (rawVal.startsWith('portrait:')) {
      const portraitId = rawVal.slice('portrait:'.length).trim();
      const matched = (portraits || []).find((p) => p.id === portraitId);
      const img = (matched?.imageData || '').trim();
      if (img) {
        return {
          src: img,
          sourceLabel: matched?.name
            ? `Ảnh của bạn · Thư viện NV: ${matched.name}`
            : 'Ảnh của bạn · Thư viện Ảnh NV/NPC',
          isPortraitRef: true,
          isExternalUrl: /^https?:\/\//i.test(img),
          isBundledDefault: false,
          isUserImage: true,
        };
      }
      // Portrait is no longer available in any bank -> only now fall back gracefully if available
    } else if (rawVal.startsWith('data:image/') || /^https?:\/\//i.test(rawVal)) {
      const isHttp = /^https?:\/\//i.test(rawVal);
      return {
        src: rawVal,
        sourceLabel: isHttp
          ? 'Ảnh của bạn · URL đã lưu'
          : 'Ảnh của bạn · Tải từ máy (đã lưu)',
        isPortraitRef: false,
        isExternalUrl: isHttp,
        isBundledDefault: false,
        isUserImage: true,
      };
    }
  }

  // 2. FALLBACK ONLY: used strictly when the slot is genuinely empty / unassigned by the user
  const fallback = (
    (isBundledSamplePath(rawVal) ? rawVal : '') ||
    (fallbackBundledSrc || '').trim()
  ).trim();
  if (!fallback) return null;

  return {
    src: fallback,
    sourceLabel: 'Ảnh dự phòng có sẵn (chưa gán ảnh riêng)',
    isPortraitRef: false,
    isExternalUrl: false,
    isBundledDefault: true,
    isUserImage: false,
  };
}

export function resolveEffectiveSampleImage(
  kind: 'style' | 'angle',
  id: string,
  sampleImages: Record<string, string> | undefined,
  portraits?: CharacterPortrait[],
): (ResolvedSampleImage & {
  sampleKey: string;
  hasBundledDefault: boolean;
  hasUserOverride: boolean;
}) | null {
  const sampleKey = getSampleImageKey(kind, id);
  const bundled = DEFAULT_STYLE_SAMPLE_IMAGES[sampleKey];
  const rawVal = sampleImages?.[sampleKey];
  const resolved = resolveSampleImageSrc(rawVal, portraits, bundled);
  if (!resolved) return null;
  const hasUserOverride = resolved.isUserImage;
  return {
    ...resolved,
    sampleKey,
    hasBundledDefault: Boolean(bundled),
    hasUserOverride,
  };
}

export function validateImageSampleUrl(
  rawUrl: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Hãy nhập hoặc dán đường dẫn URL hình ảnh.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: 'URL không hợp lệ. Hãy nhập đường dẫn bắt đầu bằng https:// hoặc http://.',
    };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      error: 'Chỉ hỗ trợ đường dẫn hình ảnh https:// hoặc http://.',
    };
  }
  return { ok: true, url: parsed.toString() };
}

export function verifyBrowserCanLoadImageUrl(
  url: string,
  timeoutMs = 10000,
): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => finish((img.naturalWidth || img.width || 0) > 0);
    img.onerror = () => finish(false);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    img.src = url;
  });
}

export type ImportSampleImageUrlResult =
  | {
      ok: true;
      value: string;
      mode: 'compressed' | 'url-fallback';
      approxKb?: number;
      note: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Imports a comparison sample image from an external HTTP(S) URL.
 * 1) Attempts CORS fetch + local Canvas compression so the image is cached
 *    stably and compactly inside ARK_LITE_AI_STUDIO_V1.
 * 2) If the remote server blocks CORS, verifies the browser can still display
 *    the image directly and saves the validated URL cleanly as fallback.
 */
export async function importSampleImageFromUrl(
  rawUrl: string,
): Promise<ImportSampleImageUrlResult> {
  const check = validateImageSampleUrl(rawUrl);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }
  const url = check.url;

  // Step 1: Try CORS fetch + compress into compact local thumbnail
  if (typeof fetch === 'function') {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId =
      controller && typeof setTimeout !== 'undefined'
        ? setTimeout(() => controller.abort(), 9000)
        : null;
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller?.signal,
      });
      if (res.ok) {
        const blob = await res.blob();
        const looksLikeImage =
          !blob.type ||
          blob.type.startsWith('image/') ||
          blob.type === 'application/octet-stream';
        if (looksLikeImage && blob.size > 0) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh.'));
            reader.readAsDataURL(blob);
          });
          if (dataUrl.startsWith('data:')) {
            const compressed = await compressSampleImageForStorage(dataUrl);
            return {
              ok: true,
              value: compressed.dataUrl,
              mode: 'compressed',
              approxKb: compressed.approxKb,
              note: `Đã tải & nén ảnh mẫu từ URL (~${compressed.approxKb} KB) vào bộ nhớ.`,
            };
          }
        }
      }
    } catch {
      // Likely CORS-blocked or network timeout; fall through to direct image load check
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  // Step 2: Verify the URL renders directly as a valid image (handles CORS-blocked hosts)
  const canRender = await verifyBrowserCanLoadImageUrl(url, 10000);
  if (canRender) {
    return {
      ok: true,
      value: url,
      mode: 'url-fallback',
      note: 'Máy chủ ảnh hạn chế CORS nên không nén cục bộ — đã lưu trực tiếp URL ảnh để hiển thị ổn định.',
    };
  }

  return {
    ok: false,
    error:
      'Không thể tải hình ảnh từ URL này. Hãy kiểm tra lại đường dẫn ảnh trực tiếp (.jpg, .png, .webp...) hoặc tải ảnh từ thiết bị.',
  };
}

/**
 * Compresses an uploaded image file or data URL into a crisp, zoom-friendly
 * WebP/JPEG (max 768px edge, target <= 115 KB) so user sample images look sharp
 * when enlarged in the lightbox while staying lean for ARK_LITE_AI_STUDIO_V1
 * and IndexedDB vault persistence.
 */
export async function compressSampleImageForStorage(
  source: File | string,
  options?: { maxEdge?: number; quality?: number },
): Promise<{ dataUrl: string; approxKb: number }> {
  const maxEdge = options?.maxEdge ?? 768;
  const quality = options?.quality ?? 0.82;

  const rawDataUrl =
    typeof source === 'string'
      ? source
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
          reader.readAsDataURL(source);
        });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return {
      dataUrl: rawDataUrl,
      approxKb: Math.max(1, Math.round((rawDataUrl.length * 0.75) / 1024)),
    };
  }

  return await new Promise<{ dataUrl: string; approxKb: number }>(
    (resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const origW = img.naturalWidth || img.width || maxEdge;
          const origH = img.naturalHeight || img.height || maxEdge;
          const scale = Math.min(1, maxEdge / Math.max(origW, origH));
          const targetW = Math.max(1, Math.round(origW * scale));
          const targetH = Math.max(1, Math.round(origH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              dataUrl: rawDataUrl,
              approxKb: Math.max(
                1,
                Math.round((rawDataUrl.length * 0.75) / 1024),
              ),
            });
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          let out = '';
          try {
            const webp = canvas.toDataURL('image/webp', quality);
            if (webp.startsWith('data:image/webp')) {
              out = webp;
            }
          } catch {
            out = '';
          }
          if (!out) {
            out = canvas.toDataURL('image/jpeg', quality);
          }
          // Keep user samples sharp for fullscreen zoom while respecting storage budget (target <= 115 KB)
          if (out.length * 0.75 > 115 * 1024) {
            const mime = out.startsWith('data:image/webp')
              ? 'image/webp'
              : 'image/jpeg';
            const tighter = canvas.toDataURL(mime, 0.7);
            if (tighter.length < out.length) out = tighter;
          }
          if (out.length * 0.75 > 145 * 1024) {
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = Math.max(1, Math.round(targetW * 0.78));
            smallCanvas.height = Math.max(1, Math.round(targetH * 0.78));
            const sctx = smallCanvas.getContext('2d');
            if (sctx) {
              sctx.imageSmoothingEnabled = true;
              sctx.imageSmoothingQuality = 'high';
              sctx.drawImage(
                canvas,
                0,
                0,
                smallCanvas.width,
                smallCanvas.height,
              );
              const mime = out.startsWith('data:image/webp')
                ? 'image/webp'
                : 'image/jpeg';
              const compact = smallCanvas.toDataURL(mime, 0.68);
              if (compact.length < out.length) out = compact;
            }
          }
          resolve({
            dataUrl: out,
            approxKb: Math.max(1, Math.round((out.length * 0.75) / 1024)),
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () =>
        reject(new Error('Không thể giải mã tệp ảnh đã chọn.'));
      img.src = rawDataUrl;
    },
  );
}

export function buildCustomStylePreset(options: {
  name: string;
  description?: string;
  promptGuide?: string;
  baseStyle?: StoryImageStylePreset;
}): StoryImageStylePreset {
  const base = resolveStoryImageStyle(options?.baseStyle);
  const cleanName = String(options?.name ?? '').trim() || 'Phong cách tùy chỉnh';
  const baseLabel = String(base.label ?? '');
  const baseDesc = String(base.description ?? '');
  const baseGuide = String(base.promptGuide ?? base.promptHint ?? '');
  const resolveInline = (raw?: string | null) =>
    String(raw ?? '')
      .split('${image_style_name}')
      .join(baseLabel)
      .split('${image_style_description}')
      .join(baseDesc)
      .split('${image_style_prompt_guide}')
      .join(baseGuide)
      .trim();

  const resolvedDesc = resolveInline(options?.description) || baseDesc;
  const resolvedGuide =
    resolveInline(options?.promptGuide) ||
    `${baseGuide}, custom aesthetic emphasis: ${cleanName}`;

  const slug = cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

  return {
    id: `custom_style_${slug || 'preset'}_${Date.now().toString(36)}`,
    label: cleanName,
    category: 'Tùy chỉnh',
    description: resolvedDesc,
    promptGuide: resolvedGuide,
    promptHint: resolvedGuide,
    isCustom: true,
  };
}

const HAS_STYLE_VAR_RE =
  /\$\{(?:image_style_name|image_style_description|image_style_prompt_guide)\}/;

export const HAS_ANY_IMAGE_TEMPLATE_VAR_RE =
  /\$\{(?:story_text|onscene_characters_full|current_time|current_location|entry_decision_new_characters|image_count|image_grid_mode|image_generation_mode|image_style_name|image_style_description|image_style_prompt_guide)\}/;

/**
 * Interpolates `${image_style_name}`, `${image_style_description}`, and
 * `${image_style_prompt_guide}` into an image prompt template.
 * If the template doesn't explicitly reference any of those placeholders,
 * automatically appends the resolved style block so every generated image
 * consistently reflects the chosen art style.
 */
export function applyImageStyleVariables(
  promptTemplate: string,
  styleOrId?: StoryImageStylePreset | StoryImageStyle | string | null,
  customStyles?: StoryImageStylePreset[],
  cameraAngleId?: ImageCameraAngleId | string | null,
): string {
  const style = resolveStoryImageStyle(styleOrId, customStyles);
  const angle = resolveCameraAngle(cameraAngleId);
  const raw = String(promptTemplate ?? '').trim();
  const enStyle = resolveEnglishStyleTokens(style);

  const replaceTokens = (text?: string | null) =>
    String(text ?? '')
      .split('${image_style_name}')
      .join(String(enStyle.englishName ?? ''))
      .split('${image_style_description}')
      .join(String(enStyle.englishDescription ?? ''))
      .split('${image_style_prompt_guide}')
      .join(String(enStyle.englishGuide ?? ''));

  const angleGuide = String(angle?.promptGuide ?? '').trim();
  const angleSuffix = angleGuide ? `, ${angleGuide}` : '';

  if (!raw) {
    return appendNoTextVisualConstraint(
      `${replaceTokens(DEFAULT_IMAGE_STYLE_BLOCK_TEMPLATE)}${angleSuffix}`.trim(),
    );
  }

  if (HAS_STYLE_VAR_RE.test(raw)) {
    return appendNoTextVisualConstraint(
      `${replaceTokens(raw).trim()}${angleSuffix}`.trim(),
    );
  }

  const resolvedBlock = replaceTokens(DEFAULT_IMAGE_STYLE_BLOCK_TEMPLATE).trim();
  const baseWithStyle = resolvedBlock ? `${raw}, ${resolvedBlock}` : raw;
  return appendNoTextVisualConstraint(`${baseWithStyle}${angleSuffix}`.trim());
}

export function interpolateImagePromptTemplate(
  template: string,
  variables?: Record<string, string | undefined | null> | null,
  options?: {
    style?: StoryImageStylePreset;
    cameraAngle?: ImageCameraAngleId;
    englishNormalize?: boolean;
    preserveNames?: string[];
  },
): string {
  let out = String(template ?? '').trim();
  if (!out || isLegacyPoisonedImagePromptTemplate(out)) {
    out = DEFAULT_STORY_IMAGE_PROMPT_TEMPLATE;
  }

  if (variables && typeof variables === 'object') {
    for (const [token, value] of Object.entries(variables)) {
      if (!token) continue;
      out = out.split(token).join(String(value ?? ''));
    }
  }

  // Strip accidental raw dates/clock numbers and clean blank lines
  out = sanitizeVisualPromptFragment(out);

  if (options?.englishNormalize) {
    const flattened = String(out ?? '')
      .split(/\n+/)
      .map((line) => String(line ?? '').replace(/^[•\-*]\s*/, '').trim())
      .filter(Boolean)
      .join('. ');
    const translated = translateVietnameseVisualToEnglish(flattened);
    const cleaned = stripResidualVietnameseFromEnglishClause(
      translated,
      Array.isArray(options.preserveNames) ? options.preserveNames : [],
    );
    if (cleaned.length >= 24) {
      out = String(cleaned ?? '')
        .replace(/\.\s*\./g, '.')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
  }

  // Append camera angle directive if user chose a specific angle
  const angle = resolveCameraAngle(options?.cameraAngle);
  const angleGuide = String(angle?.promptGuide ?? '').trim();
  if (angleGuide && !out.includes(angleGuide)) {
    out = `${out}, ${angleGuide}`;
  }

  return appendNoTextVisualConstraint(out);
}

export function normalizeStoryImageConfig(
  raw: unknown,
  fallback: StoryImageConfig,
): StoryImageConfig {
  const fallbackDeleted = normalizeDeletedEmbeddedIds(
    fallback.deletedEmbeddedStyleIds,
  );
  if (!raw || typeof raw !== 'object') {
    return {
      ...fallback,
      customStyles: mergeEmbeddedCustomImageStyles(
        normalizeCustomImageStyles(fallback.customStyles),
        fallbackDeleted,
      ),
      sampleImages: normalizeSampleImagesMap(fallback.sampleImages),
      promptTemplate:
        typeof fallback.promptTemplate === 'string'
          ? fallback.promptTemplate
          : EMBEDDED_IMAGE_PROMPT_TEMPLATE,
      deletedEmbeddedStyleIds: fallbackDeleted,
    };
  }
  const rec = raw as Record<string, unknown>;
  const deletedEmbeddedStyleIds = Array.isArray(rec.deletedEmbeddedStyleIds)
    ? normalizeDeletedEmbeddedIds(rec.deletedEmbeddedStyleIds)
    : fallbackDeleted;
  const customStyles = mergeEmbeddedCustomImageStyles(
    normalizeCustomImageStyles(rec.customStyles),
    deletedEmbeddedStyleIds,
  );
  const sampleImages = normalizeSampleImagesMap(rec.sampleImages);
  const cameraAngle = normalizeCameraAngleId(rec.cameraAngle);
  const rawCount = Number(rec.imageCount);
  const imageCount =
    Number.isFinite(rawCount) && rawCount >= 1 && rawCount <= 4
      ? Math.floor(rawCount)
      : 1;
  const rawMaxPerTurn = Number(rec.maxImagesPerTurn);
  const maxImagesPerTurn: 1 | 2 | 3 =
    rawMaxPerTurn === 1 || rawMaxPerTurn === 2 || rawMaxPerTurn === 3
      ? rawMaxPerTurn
      : fallback.maxImagesPerTurn === 1 ||
          fallback.maxImagesPerTurn === 2 ||
          fallback.maxImagesPerTurn === 3
        ? fallback.maxImagesPerTurn
        : 3;
  const validGridModes: ImageGridMode[] = [
    'single',
    'grid_2',
    'grid_4',
    'character_sheet',
  ];
  const imageGridMode = validGridModes.includes(
    rec.imageGridMode as ImageGridMode,
  )
    ? (rec.imageGridMode as ImageGridMode)
    : 'single';
  const validGenModes: ImageGenerationMode[] = [
    'scene',
    'portrait',
    'cinema_frame',
    'illustration',
    'custom',
  ];
  const imageGenerationMode = validGenModes.includes(
    rec.imageGenerationMode as ImageGenerationMode,
  )
    ? (rec.imageGenerationMode as ImageGenerationMode)
    : 'scene';

  const rawTemplate =
    typeof rec.promptTemplate === 'string'
      ? rec.promptTemplate
      : typeof fallback.promptTemplate === 'string'
        ? fallback.promptTemplate
        : EMBEDDED_IMAGE_PROMPT_TEMPLATE;
  const safeTemplate = isLegacyPoisonedImagePromptTemplate(rawTemplate)
    ? ''
    : rawTemplate;

  const validPosSet = new Set<StoryImagePosition>(STORY_IMAGE_POSITIONS);
  const rawEnabledPos = Array.isArray(rec.enabledPositions)
    ? STORY_IMAGE_POSITIONS.filter((pos) =>
        (rec.enabledPositions as unknown[]).includes(pos),
      )
    : Array.isArray(fallback.enabledPositions)
      ? STORY_IMAGE_POSITIONS.filter((pos) =>
          fallback.enabledPositions?.includes(pos) && validPosSet.has(pos),
        )
      : [];
  const enabledPositions: StoryImagePosition[] =
    rawEnabledPos.length > 0
      ? rawEnabledPos
      : maxImagesPerTurn === 1
        ? ['opening']
        : maxImagesPerTurn === 2
          ? ['opening', 'ending']
          : ['opening', 'middle', 'ending'];
  const syncedMaxPerTurn: 1 | 2 | 3 =
    enabledPositions.length === 1
      ? 1
      : enabledPositions.length === 2
        ? 2
        : 3;
  const preferClearFaceSolo =
    typeof rec.preferClearFaceSolo === 'boolean'
      ? rec.preferClearFaceSolo
      : fallback.preferClearFaceSolo ?? true;
  const lockAvatarIdentity =
    typeof rec.lockAvatarIdentity === 'boolean'
      ? rec.lockAvatarIdentity
      : fallback.lockAvatarIdentity ?? true;

  return {
    ...fallback,
    ...(rec as Partial<StoryImageConfig>),
    stylePreset: normalizeStoryImageStyleId(rec.stylePreset, customStyles),
    cameraAngle,
    customStyles,
    sampleImages,
    promptTemplate: safeTemplate,
    imageCount,
    maxImagesPerTurn: syncedMaxPerTurn,
    enabledPositions,
    preferClearFaceSolo,
    lockAvatarIdentity,
    imageGridMode,
    imageGenerationMode,
    deletedEmbeddedStyleIds,
  };
}
