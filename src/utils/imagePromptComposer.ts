import type {
  CharacterIdentityLock,
  ImageCameraAngleId,
  ImageGenerationMode,
  ImageGridMode,
  StoryImageStylePreset,
} from '../types/ark';

/**
 * ============================================================================
 * SEAMLESS ENGLISH IMAGE PROMPT COMPOSER & ANTI-SAME-FACE CHARACTER ENGINE
 * ============================================================================
 * Standardizes image prompts into one fluent, structured, natural English prompt:
 *   [1. Subject & Locked Character Identity: face, hairstyle, hair color, build, age, aura]
 *   + [2. Signature Outfit & Accessories]
 *   + [3. Action, Expression & Camera Framing]
 *   + [4. Setting, Atmosphere & Lighting in Selected Style]
 *
 * Guarantees:
 * - No raw broken Vietnamese fragments leaking into diffusion/Seedream/ComfyUI prompts.
 * - Distinct per-character visual fingerprints so characters never collapse into generic
 *   identical faces ("same-face syndrome") even when profiles are short or written in Vietnamese.
 * - Full backward compatibility with ${story_text}, ${image_style_name},
 *   ${image_style_description}, ${image_style_prompt_guide}, and all template tokens.
 */

const VIET_DIACRITIC_RE =
  /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

export const IMAGE_GRID_MODE_EN: Record<ImageGridMode, string> = {
  single: 'single full-frame composition',
  grid_2: 'two-panel sequential split composition',
  grid_4: '2x2 four-panel storyboard grid composition',
  character_sheet: 'multi-angle character reference turnaround sheet',
};

export const IMAGE_GENERATION_MODE_EN: Record<ImageGenerationMode, string> = {
  scene: 'narrative story scene illustration',
  portrait: 'character portrait study',
  cinema_frame: 'cinematic widescreen film still',
  illustration: 'fine art editorial illustration',
  custom: 'custom visual composition',
};

/**
 * Unicode-aware Vietnamese phrase matcher: JS `\b` fails on non-ASCII diacritics
 * (e.g. `áo`, `đôi`, `cổ`, `mở`, `ở`, `sẹo`), so we use `\p{L}\p{N}` boundaries.
 */
function viRe(pattern: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * Comprehensive Vietnamese -> English visual phrase lexicon ordered longest-first
 * so compound visual descriptors translate cleanly before single words.
 */
const VI_TO_EN_VISUAL_LEXICON: Array<[RegExp, string]> = [
  // Facial structure & features
  [viRe('khuôn\\s*mặt\\s*trái\\s*xoan'), 'refined oval face'],
  [/\bkhuôn\s*mặt\s*v-?line\b/gi, 'slender V-shaped jawline'],
  [/\bkhuôn\s*mặt\s*góc\s*cạnh\b/gi, 'chiseled angular jawline'],
  [/\bkhuôn\s*mặt\s*thanh\s*tú\b/gi, 'delicate refined facial features'],
  [/\bkhuôn\s*mặt\s*sắc\s*sảo\b/gi, 'sharp striking facial features'],
  [/\bkhuôn\s*mặt\s*tròn\b/gi, 'soft rounded face'],
  [/\bkhuôn\s*mặt\s*vuông\b/gi, 'strong square jawline'],
  [/\bkhuôn\s*mặt\s*điển\s*trai\b/gi, 'handsome sculpted features'],
  [/\bkhuôn\s*mặt\s*xinh\s*đẹp\b/gi, 'graceful expressive features'],
  [/\bđôi\s*mắt\s*phượng\b/gi, 'narrow upturned phoenix eyes'],
  [/\bđôi\s*mắt\s*hạnh\s*nhân\b/gi, 'almond-shaped eyes'],
  [/\bđôi\s*mắt\s*to\s*tròn\b/gi, 'large expressive round eyes'],
  [/\bđôi\s*mắt\s*sâu\s*thẳm\b/gi, 'deep-set intense eyes'],
  [/\bđôi\s*mắt\s*sắc\s*bén\b/gi, 'sharp piercing eyes'],
  [/\bđôi\s*mắt\s*sắc\s*lạnh\b/gi, 'cold piercing gaze'],
  [/\bđôi\s*mắt\s*đen\s*láy\b/gi, 'glossy jet-black eyes'],
  [/\bđôi\s*mắt\s*nâu\s*ấm\b/gi, 'warm chestnut-brown eyes'],
  [/\bđôi\s*mắt\s*một\s*mí\b/gi, 'distinctive monolid eyes'],
  [/\bđôi\s*mắt\s*hai\s*mí\b/gi, 'clear double-eyelid eyes'],
  [/\bmắt\s*phượng\b/gi, 'upturned phoenix eyes'],
  [/\bmắt\s*hạnh\b/gi, 'almond eyes'],
  [/\bmắt\s*sâu\b/gi, 'deep-set eyes'],
  [/\bánh\s*mắt\s*sắc\s*lạnh\b/gi, 'cool piercing gaze'],
  [/\bánh\s*mắt\s*trầm\s*tư\b/gi, 'thoughtful pensive gaze'],
  [/\bánh\s*mắt\s*ấm\s*áp\b/gi, 'warm gentle gaze'],
  [/\bánh\s*mắt\s*dịu\s*dàng\b/gi, 'soft affectionate gaze'],
  [/\bánh\s*mắt\s*kiên\s*định\b/gi, 'steady determined gaze'],
  [/\blông\s*mày\s*rậm\b/gi, 'thick defined eyebrows'],
  [/\blông\s*mày\s*kiếm\b/gi, 'straight sword-shaped eyebrows'],
  [/\blông\s*mày\s*lá\s*liễu\b/gi, 'slender arched eyebrows'],
  [/\bsống\s*mũi\s*cao\b/gi, 'high straight nose bridge'],
  [/\bmũi\s*cao\s*thẳng\b/gi, 'high straight nose'],
  [/\bđôi\s*môi\s*mỏng\b/gi, 'defined thin lips'],
  [/\bđôi\s*môi\s*đầy\s*đặn\b/gi, 'full natural lips'],
  // Tattoos, body art, scars & piercings (ordered longest-first so location & coverage stay intact)
  [/\bnhiều\s*hình\s*xăm\s*dày\s*đặc\s*phủ\s*kín\s*cổ\s*,\s*ngực\s*và\s*cánh\s*tay\b/gi, 'heavily covered in dense intricate dark tattoos across the neck, chest, and arms'],
  [/\bhình\s*xăm\s*dày\s*đặc\s*phủ\s*kín\s*cổ\s*,\s*ngực\s*và\s*cánh\s*tay\b/gi, 'dense intricate dark tattoos covering the neck, chest, and arms'],
  [/\bnhiều\s*hình\s*xăm\s*dày\s*đặc\s*phủ\s*kín\b/gi, 'heavily covered in dense intricate tattoos across'],
  [/\bhình\s*xăm\s*dày\s*đặc\s*phủ\s*kín\b/gi, 'dense intricate tattoos covering'],
  [/\bhình\s*xăm\s*phủ\s*kín\b/gi, 'dense tattoos fully covering'],
  [/\bhình\s*xăm\s*dày\s*đặc\b/gi, 'dense intricate tattoos'],
  [/\bnhiều\s*hình\s*xăm\s*ở\s*cổ\s*và\s*tay\b/gi, 'numerous visible tattoos across the neck and arms'],
  [/\bhình\s*xăm\s*nghệ\s*thuật\s*dọc\s*cánh\s*tay\s*phải\b/gi, 'detailed artistic sleeve tattoos running down the right arm'],
  [/\bhình\s*xăm\s*nghệ\s*thuật\s*dọc\s*cánh\s*tay\s*trái\b/gi, 'detailed artistic sleeve tattoos running down the left arm'],
  [/\bhình\s*xăm\s*nghệ\s*thuật\s*dọc\s*cánh\s*tay\b/gi, 'detailed artistic sleeve tattoos along the arm'],
  [/\bhình\s*xăm\s*kín\s*cánh\s*tay\b/gi, 'full-sleeve tattoos covering the arm'],
  [/\bhình\s*xăm\s*kín\s*tay\b/gi, 'full-sleeve arm tattoos'],
  [/\bhình\s*xăm\s*kín\s*cổ\b/gi, 'full neck and throat tattoos'],
  [/\bhình\s*xăm\s*kín\s*ngực\b/gi, 'dense chest tattoos'],
  [/\bhình\s*xăm\s*ở\s*cổ\b/gi, 'visible neck tattoos'],
  [/\bhình\s*xăm\s*ở\s*ngực\b/gi, 'visible chest tattoos'],
  [/\bhình\s*xăm\s*ở\s*vai\b/gi, 'visible shoulder tattoos'],
  [/\bhình\s*xăm\s*ở\s*cánh\s*tay\b/gi, 'visible arm tattoos'],
  [/\bhình\s*xăm\s*ở\s*cẳng\s*tay\b/gi, 'visible forearm tattoos'],
  [/\bhình\s*xăm\s*ở\s*tay\b/gi, 'visible arm and hand tattoos'],
  [/\bhình\s*xăm\s*ở\s*mặt\b/gi, 'visible face tattoos'],
  [/\bkhoe\s*hình\s*xăm\b/gi, 'openly showing the chest and neck tattoos'],
  [/\blộ\s*hình\s*xăm\b/gi, 'revealing visible tattoos'],
  [/\bnhiều\s*hình\s*xăm\b/gi, 'numerous visible tattoos'],
  [/\bhình\s*xăm\s*nghệ\s*thuật\b/gi, 'detailed artistic tattoos'],
  [/\bhình\s*xăm\b/gi, 'visible tattoos'],
  [/\bxăm\s*kín\s*cổ\b/gi, 'heavily tattooed neck'],
  [/\bxăm\s*kín\s*ngực\b/gi, 'heavily tattooed chest'],
  [/\bxăm\s*kín\s*tay\b/gi, 'full-sleeve arm tattoos'],
  [/\bxăm\s*kín\b/gi, 'heavily tattooed'],
  [/\bkhuyên\s*mũi\b/gi, 'subtle nose piercing'],
  [/\bkhuyên\s*môi\b/gi, 'lip piercing'],
  [/\bkhuyên\s*mày\b/gi, 'eyebrow piercing'],
  [/\bvết\s*sẹo\s*nhỏ\b/gi, 'faint distinctive scar'],
  [/\bvết\s*sẹo\b/gi, 'distinctive scar'],
  [/\bnốt\s*ruồi\s*lệ\b/gi, 'subtle tear-drop beauty mark beneath the eye'],
  [/\bnốt\s*ruồi\b/gi, 'subtle beauty mark'],
  [/\blàn\s*da\s*trắng\s*sáng\b/gi, 'fair natural skin with subtle pores'],
  [/\blàn\s*da\s*trắng\b/gi, 'fair natural skin'],
  [/\blàn\s*da\s*ngăm\b/gi, 'warm sun-kissed tan skin'],
  [/\bda\s*ngăm\s*khỏe\s*khoắn\b/gi, 'healthy warm bronze skin'],
  [/\bda\s*ngăm\b/gi, 'warm tan skin'],
  [/\bmá\s*lúm\s*đồng\s*tiền\b/gi, 'subtle cheek dimple'],
  [/\bgò\s*má\s*cao\b/gi, 'high defined cheekbones'],
  [/\bkẻ\s*mắt\s*đen\b/gi, 'bold black eyeliner'],
  [/\bmắt\s*nâu\s*sắc\s*sảo\b/gi, 'sharp expressive brown eyes'],
  [/\brâu\s*quai\s*nón\b/gi, 'natural contoured jawline chinstrap beard'],
  [/\brâu\s*có\s*viền\b/gi, 'natural contoured jawline beard'],
  [/\bria\s*mép\b/gi, 'neat trimmed mustache'],
  [/\brâu\s*cằm\s*mảnh\b/gi, 'neat thin chin beard'],
  [/\brâu\s*cằm\b/gi, 'neat chin beard'],
  [/\brâu\s*lún\s*phún\b/gi, 'light natural stubble'],
  [/\brâu\s*ngắn\b/gi, 'short trimmed natural beard'],
  [/\brâu\s*ria\s*gọn\s*gàng\b/gi, 'neatly trimmed stubble and mustache'],

  // Hairstyles & hair colors
  [/\btóc\s*bạch\s*kim\s*rối\s*nhẹ\b/gi, 'messy tousled platinum-blonde hair'],
  [/\btóc\s*bạch\s*kim\b/gi, 'platinum-blonde hair'],
  [/\btóc\s*đen\s*sóng\s*dài\s*xõa\s*tự\s*nhiên\b/gi, 'long natural wavy jet-black hair worn loose'],
  [/\btóc\s*đen\s*sóng\s*dài\b/gi, 'long wavy jet-black hair'],
  [/\btóc\s*đen\s*cắt\s*layer\s*rủ\s*nhẹ\b/gi, 'layered black hair falling softly around the face'],
  [/\btóc\s*đen\s*dài\s*ngang\s*lưng\b/gi, 'long waist-length jet-black hair'],
  [/\btóc\s*đen\s*dài\s*thẳng\b/gi, 'long straight jet-black hair'],
  [/\btóc\s*đen\s*dài\s*uốn\s*lọn\b/gi, 'long wavy jet-black hair with soft curls'],
  [/\btóc\s*đen\s*dài\b/gi, 'long black hair'],
  [/\btóc\s*đen\s*ngắn\s*gọn\s*gàng\b/gi, 'neat short cropped black hair'],
  [/\btóc\s*đen\s*ngắn\b/gi, 'short black hair'],
  [/\btóc\s*cắt\s*buzzcut\/fade\s*sát\b/gi, 'clean close-cropped buzzcut with sharp fade'],
  [/\btóc\s*cắt\s*buzzcut\b/gi, 'close-cropped buzzcut hair'],
  [/\btóc\s*nâu\s*xoăn\s*nhẹ\b/gi, 'lightly curly brown hair'],
  [/\btóc\s*dài\s*uốn\s*sóng\b/gi, 'long softly waved hair'],
  [/\btóc\s*dài\s*ngang\s*vai\b/gi, 'shoulder-length layered hair'],
  [/\btóc\s*ngang\s*vai\b/gi, 'shoulder-length hair'],
  [/\btóc\s*ngắn\s*cá\s*tính\b/gi, 'chic short layered bob haircut'],
  [/\btóc\s*buộc\s*đuôi\s*ngựa\s*cao\b/gi, 'hair tied in a sleek high ponytail'],
  [/\btóc\s*buộc\s*đuôi\s*ngựa\b/gi, 'hair tied in a ponytail'],
  [/\btóc\s*búi\s*cao\b/gi, 'hair styled in a high traditional topknot bun'],
  [/\btóc\s*búi\s*thấp\b/gi, 'hair gathered in a low loose bun'],
  [/\btóc\s*mái\s*bay\b/gi, 'soft curtain bangs framing the cheekbones'],
  [/\btóc\s*mái\s*thưa\b/gi, 'wispy airy bangs'],
  [/\btóc\s*rẽ\s*ngôi\s*lệch\b/gi, 'side-parted hair'],
  [/\btóc\s*rẽ\s*ngôi\s*giữa\b/gi, 'center-parted hair'],
  [/\btóc\s*vuốt\s*ngược\b/gi, 'slicked-back hair'],
  [/\btóc\s*gợn\s*sóng\s*nhẹ\b/gi, 'naturally slightly wavy hair'],
  [/\btóc\s*rủ\s*nhẹ\b/gi, 'relaxed softly falling hair'],
  [/\btóc\s*rối\s*nhẹ\b/gi, 'lightly tousled messy hair'],
  [/\btóc\s*tự\s*nhiên\b/gi, 'natural relaxed hair'],
  [/\btóc\s*trắng\s*dài\b/gi, 'long flowing silver-white hair'],
  [/\btóc\s*trắng\b/gi, 'silver-white hair'],
  [/\btóc\s*nâu\s*hạt\s*dẻ\b/gi, 'warm chestnut-brown hair'],
  [/\btóc\s*nâu\s*trầm\b/gi, 'deep dark-brown hair'],
  [/\btóc\s*nâu\b/gi, 'brown hair'],
  [/\btóc\s*đỏ\s*rượu\b/gi, 'deep burgundy-red hair'],
  [/\btóc\s*đỏ\b/gi, 'crimson-red hair'],
  [/\btóc\s*vàng\s*ánh\s*kim\b/gi, 'golden blonde hair'],
  [/\btóc\s*vàng\b/gi, 'blonde hair'],
  [/\btóc\s*đen\b/gi, 'black hair'],

  // Build, height & aura/temperament
  [/\brất\s*cao\s*và\s*gầy\b/gi, 'very tall and lean slender build'],
  [/\bvóc\s*dáng\s*cao\s*gầy\b/gi, 'tall lean slender build'],
  [/\bvóc\s*dáng\s*gầy\s*cao\b/gi, 'tall lean build'],
  [/\bcao\s*gầy\b/gi, 'tall lean build'],
  [/\bgầy\s*cao\b/gi, 'tall lean build'],
  [/\bvóc\s*dáng\s*săn\s*chắc\s*cân\s*đối\b/gi, 'lean well-proportioned athletic build'],
  [/\bdáng\s*người\s*cao\s*ráo\b/gi, 'tall well-proportioned build'],
  [/\bdáng\s*người\s*thanh\s*mảnh\b/gi, 'slender graceful build'],
  [/\bdáng\s*người\s*mảnh\s*mai\b/gi, 'slender graceful build'],
  [/\bdáng\s*người\s*săn\s*chắc\b/gi, 'lean athletic toned build'],
  [/\bdáng\s*người\s*vạm\s*vỡ\b/gi, 'broad-shouldered muscular build'],
  [/\bdáng\s*mảnh\s*khảnh\b/gi, 'lithe slender build'],
  [/\bcao\s*lớn\b/gi, 'tall broad-shouldered physique'],
  [/\bvai\s*rộng\b/gi, 'broad shoulders'],
  [/\bvóc\s*dáng\s*đồng\s*hồ\s*cát\b/gi, 'graceful well-proportioned silhouette'],
  [/\bđồng\s*hồ\s*cát\b/gi, 'graceful well-proportioned silhouette'],
  [/\bvóc\s*dáng\s*gợi\s*cảm\b/gi, 'graceful poised well-proportioned figure'],
  [/\bvóc\s*dáng\s*quyến\s*rũ\b/gi, 'poised attractive well-proportioned figure'],
  [/\bvóc\s*dáng\s*đầy\s*đặn\b/gi, 'graceful well-proportioned silhouette'],
  [/\bvóc\s*dáng\s*cân\s*đối\b/gi, 'well-proportioned balanced figure'],
  [/\bvóc\s*dáng\s*nhỏ\s*nhắn\b/gi, 'petite slender frame'],
  [/\bdáng\s*người\s*nhỏ\s*nhắn\b/gi, 'petite slender frame'],
  [/\bdáng\s*người\s*đầy\s*đặn\b/gi, 'graceful well-proportioned silhouette'],
  [/\bngực\s*đầy\s*,?\s*mông\s*tròn\b/gi, 'graceful well-proportioned silhouette'],
  [/\bngực\s*đầy(?:\s*đặn)?\b/gi, 'poised well-proportioned stature'],
  [/\bmông\s*tròn(?:\s*đầy)?\b/gi, 'balanced graceful posture'],
  [/\bvòng\s*một\s*đầy\s*đặn\b/gi, 'poised well-proportioned stature'],
  [/\bvòng\s*ba\s*đầy\s*đặn\b/gi, 'balanced graceful posture'],
  [/\beo\s*thon\s*gọn\b/gi, 'trim tailored waist'],
  [/\bvòng\s*eo\s*con\s*kiến\b/gi, 'slender defined waist'],
  [/\beo\s*thon\b/gi, 'slender waist'],
  [/\bchân\s*dài\s*thẳng\s*tắp\b/gi, 'tall poised stature'],
  [/\bchân\s*dài\b/gi, 'tall poised stature'],
  [/\bđường\s*cong\s*quyến\s*rũ\b/gi, 'graceful tailored silhouette'],
  [/\bkhoe\s*đường\s*cong\b/gi, 'tailored flattering silhouette'],
  [/\bkhoe\s*cong\b/gi, 'tailored flattering silhouette'],
  [/\btôn\s*đường\s*cong\b/gi, 'tailored flattering silhouette'],
  [/\btôn\s*dáng\b/gi, 'figure-flattering tailored'],
  [/\bôm\s*sát\s*cơ\s*thể\b/gi, 'tailored fitted'],
  [/\bôm\s*sát\s*thân\b/gi, 'tailored fitted'],
  [/\bôm\s*sát\b/gi, 'tailored fitted'],
  [/\bôm\s*body\b/gi, 'tailored fitted'],
  [/\bbó\s*sát\b/gi, 'tailored fitted'],
  [/\blàn\s*da\s*trắng\s*mịn\b/gi, 'fair clear natural skin'],
  [/\blàn\s*da\s*trắng\s*sáng\b/gi, 'bright fair natural skin'],
  [/\bda\s*trắng\s*hồng\b/gi, 'fair healthy rosy-toned skin'],
  [/\bda\s*trắng\b/gi, 'fair natural skin'],
  [/\blàn\s*da\s*ngăm\s*khỏe\s*khoắn\b/gi, 'healthy sun-kissed warm-bronze skin'],
  [/\bda\s*ngăm\b/gi, 'warm sun-kissed bronze skin'],
  [/\bda\s*mật\s*ong\b/gi, 'warm honey-toned skin'],
  [/\bgương\s*mặt\s*trái\s*xoan\b/gi, 'refined oval face'],
  [/\bgương\s*mặt\s*v-?line\b/gi, 'slender tapered V-line jawline'],
  [/\bsống\s*mũi\s*cao\s*thẳng\b/gi, 'high straight nose bridge'],
  [/\bmắt\s*mèo\s*sắc\s*sảo\b/gi, 'sharp upturned cat-like eyes'],
  [/\bmắt\s*mèo\b/gi, 'expressive upturned cat-like eyes'],
  [/\bmắt\s*hai\s*mí\s*to\s*tròn\b/gi, 'large expressive double-eyelid eyes'],
  [/\bmôi\s*căng\s*mọng\b/gi, 'full natural lips'],
  [/\bson\s*đỏ\s*quyến\s*rũ\b/gi, 'classic crimson lipstick'],
  [/\bson\s*đỏ\b/gi, 'red lipstick'],
  [/\bson\s*màu\s*nude\b/gi, 'soft rose-beige lipstick'],
  [/\bson\s*nude\b/gi, 'soft rose-beige lipstick'],
  [/\bson\s*bóng\s*nhẹ\b/gi, 'subtle natural lip gloss'],
  [/\bnốt\s*ruồi\s*duyên\b/gi, 'distinctive subtle beauty mark'],
  [/\bmá\s*lúm\s*đồng\s*tiền\b/gi, 'subtle cheek dimple'],
  [/\btàn\s*nhang\s*nhẹ\b/gi, 'delicate light freckles across the nose'],
  [/\bkhí\s*chất\s*lạnh\s*lùng\b/gi, 'aloof composed aura'],
  [/\bkhí\s*chất\s*dịu\s*dàng\b/gi, 'gentle warm aura'],
  [/\bkhí\s*chất\s*kiêu\s*sa\b/gi, 'poised aristocratic aura'],
  [/\bkhí\s*chất\s*sang\s*chảnh\b/gi, 'chic high-fashion glamorous aura'],
  [/\bkhí\s*chất\s*trầm\s*ổn\b/gi, 'grounded calm authoritative presence'],
  [/\bkhí\s*chất\s*uy\s*nghiêm\b/gi, 'commanding dignified presence'],
  [/\bkhí\s*chất\s*tinh\s*nghịch\b/gi, 'lively playful charm'],
  [/\bkhí\s*chất\s*phong\s*trần\b/gi, 'weathered rugged charisma'],
  [/\bkhí\s*chất\s*bí\s*ẩn\b/gi, 'enigmatic magnetic aura'],
  [/\bthần\s*thái\s*điềm\s*tĩnh\b/gi, 'calm self-assured demeanor'],
  [/\bthần\s*thái\s*sắc\s*sảo\b/gi, 'sharp perceptive demeanor'],
  [/\bthần\s*thái\s*tự\s*tin\b/gi, 'confident radiant demeanor'],
  [/\bsang\s*chảnh\b/gi, 'chic upscale glamorous'],
  [/\bquyến\s*rũ\s*chết\s*người\b/gi, 'striking magnetic charismatic'],
  [/\bquyến\s*rũ\b/gi, 'captivating charismatic'],
  [/\bgợi\s*cảm\b/gi, 'glamorous confident'],
  [/\bnóng\s*bỏng\b/gi, 'glamorous striking'],
  [/\bmê\s*hoặc\b/gi, 'magnetic captivating'],
  [/\bthanh\s*lịch\b/gi, 'refined elegant'],
  [/\bphong\s*cách\s*punk-?rock\b/gi, 'rebellious punk-rock aesthetic'],
  [/\bphong\s*cách\s*streetwear\b/gi, 'modern streetwear style'],
  [/\bnụ\s*cười\s*nhếch\s*mép\b/gi, 'signature confident smirk'],

  // Clothing & accessories (modern + rock/streetwear + traditional/xianxia + showbiz — editorial-safe fashion English)
  [/\bjumpsuit\s*thun\s*nude\s*(?:ôm\s*sát\s*)?thân\b/gi, 'tailored champagne-beige knit jumpsuit'],
  [/\bjumpsuit\s*thun\s*nude\b/gi, 'tailored champagne-beige knit jumpsuit'],
  [/\bjumpsuit\s*thun\s*ôm\s*sát\b/gi, 'tailored stretch knit jumpsuit'],
  [/\bjumpsuit\s*ôm\s*sát\b/gi, 'sleek tailored jumpsuit'],
  [/\bjumpsuit\s*thun\b/gi, 'tailored knit jumpsuit'],
  [/\bjumpsuit\s*màu\s*nude\b/gi, 'sleek warm champagne-beige jumpsuit'],
  [/\bjumpsuit\s*nude\b/gi, 'sleek warm champagne-beige jumpsuit'],
  [/\bjumpsuit\s*đen\b/gi, 'sleek black tailored jumpsuit'],
  [/\bbodysuit\s*ôm\s*sát\b/gi, 'fitted sleek knit top'],
  [/\bbodysuit\s*đen\b/gi, 'fitted black knit top'],
  [/\bbodysuit\s*nude\b/gi, 'fitted champagne-beige knit top'],
  [/\báo\s*crop\s*top\b/gi, 'stylish cropped knit top'],
  [/\báo\s*croptop\b/gi, 'stylish cropped knit top'],
  [/\báo\s*hai\s*dây\s*lụa\b/gi, 'sleeveless silk blouse'],
  [/\báo\s*hai\s*dây\b/gi, 'sleeveless tailored top'],
  [/\báo\s*trễ\s*vai\b/gi, 'chic off-shoulder blouse'],
  [/\báo\s*cúp\s*ngực\b/gi, 'structured tailored evening top'],
  [/\báo\s*corset\b/gi, 'structured tailored bodice top'],
  [/\bđầm\s*dạ\s*hội\b/gi, 'tailored evening gown'],
  [/\bđầm\s*ôm\s*body\b/gi, 'tailored fitted evening dress'],
  [/\bđầm\s*ôm\s*sát\b/gi, 'tailored fitted evening dress'],
  [/\bđầm\s*xẻ\s*tà\b/gi, 'elegant tailored evening dress'],
  [/\bđầm\s*hai\s*dây\b/gi, 'draped silk evening dress'],
  [/\bđầm\s*cúp\s*ngực\b/gi, 'tailored formal evening gown'],
  [/\bváy\s*ôm\s*body\b/gi, 'tailored fitted dress'],
  [/\bváy\s*ôm\s*sát\b/gi, 'tailored fitted dress'],
  [/\bváy\s*xẻ\s*tà\b/gi, 'elegant tailored dress'],
  [/\bváy\s*hai\s*dây\b/gi, 'draped silk dress'],
  [/\bxuyên\s*thấu\b/gi, 'delicate layered chiffon'],
  [/\bhở\s*lưng\b/gi, 'elegant evening tailoring'],
  [/\bhở\s*vai\b/gi, 'off-shoulder tailoring'],
  [/\bxẻ\s*ngực\b/gi, 'V-neck collar'],
  [/\báo\s*dài\s*trắng\b/gi, 'flowing white Vietnamese ao dai silk tunic'],
  [/\báo\s*dài\b/gi, 'tailored Vietnamese ao dai'],
  [/\bhán\s*phục\b/gi, 'layered traditional Chinese embroidered hanfu robes'],
  [/\by\s*phục\s*môn\s*phái\b/gi, 'traditional Chinese martial sect robes with woven sash'],
  [/\btrang\s*phục\s*môn\s*phái\b/gi, 'traditional Chinese martial sect robes'],
  [/\bđạo\s*bào\s*cổ\s*trang\b/gi, 'traditional Chinese Taoist cultivator robes'],
  [/\bđạo\s*bào\b/gi, 'traditional Chinese Taoist robes'],
  [/\btrường\s*bào\s*cổ\s*trang\b/gi, 'flowing traditional Chinese hanfu long robes'],
  [/\btrường\s*bào\s*màu\s*lam\s*nhạt\b/gi, 'pale blue flowing traditional Chinese long robes'],
  [/\btrường\s*bào\s*trắng\b/gi, 'flowing ivory-white traditional Chinese martial robes'],
  [/\btrường\s*bào\s*đen\b/gi, 'layered obsidian-black traditional Chinese long robes with subtle embroidery'],
  [/\btrường\s*bào\b/gi, 'flowing traditional Chinese hanfu robes'],
  [/\bcổ\s*trang\b/gi, 'traditional Chinese wuxia robes'],
  [/\bgiáp\s*nhẹ\b/gi, 'lightweight Chinese martial leather and bronze armor'],
  [/\bnhuyễn\s*giáp\b/gi, 'fitted flexible Chinese silk-and-scale inner armor'],
  [/\báo\s*giáp\b/gi, 'ornate Chinese martial battle armor'],
  [/\bhộ\s*tâm\s*kính\b/gi, 'polished bronze chest guard mirror'],
  [/\báo\s*khoác\s*da\s*đinh\s*tán\b/gi, 'studded black leather biker jacket'],
  [/\báo\s*khoác\s*da\s*đen\b/gi, 'matte black leather jacket'],
  [/\báo\s*khoác\s*da\b/gi, 'tailored leather jacket'],
  [/\báo\s*khoác\s*blazer\b/gi, 'structured tailored blazer'],
  [/\báo\s*khoác\s*măng\s*tô\b/gi, 'long wool trench coat'],
  [/\báo\s*khoác\s*puffer\b/gi, 'puffer jacket'],
  [/\báo\s*khoác\s*bomber\b/gi, 'relaxed bomber jacket'],
  [/\báo\s*khoác\s*đen\b/gi, 'black jacket'],
  [/\báo\s*khoác\s*bò\b/gi, 'denim jacket'],
  [/\báo\s*khoác\b/gi, 'jacket'],
  [/\bsơ\s*mi\s*họa\s*tiết\s*xẻ\s*sâu\b/gi, 'relaxed open-collar patterned shirt'],
  [/\bsơ\s*mi\s*mở\s*cổ\b/gi, 'open-collar button-up shirt'],
  [/\báo\s*tank\s*top\s*đen\b/gi, 'black sleeveless top'],
  [/\báo\s*tank\s*top\s*trắng\b/gi, 'white sleeveless top'],
  [/\báo\s*tank\s*top\b/gi, 'sleeveless top'],
  [/\báo\s*sơ\s*mi\s*trắng\b/gi, 'crisp white button-up shirt'],
  [/\báo\s*sơ\s*mi\s*đen\b/gi, 'black button-up shirt'],
  [/\báo\s*sơ\s*mi\b/gi, 'button-up shirt'],
  [/\báo\s*len\s*cổ\s*lọ\b/gi, 'fitted turtleneck knit sweater'],
  [/\báo\s*len\b/gi, 'textured knit sweater'],
  [/\báo\s*phông\s*đen\b/gi, 'relaxed black t-shirt'],
  [/\báo\s*phông\s*trắng\b/gi, 'relaxed white t-shirt'],
  [/\báo\s*phông\b/gi, 'casual t-shirt'],
  [/\báo\s*thun\s*ôm\b/gi, 'fitted knit t-shirt'],
  [/\báo\s*thun\b/gi, 'casual t-shirt'],
  [/\báo\s*hoodie\b/gi, 'oversized streetwear hoodie'],
  [/\bđồng\s*phục\s*học\s*sinh\b/gi, 'neat school uniform'],
  [/\bđồng\s*phục\b/gi, 'tailored uniform'],
  [/\bquần\s*da\/denim\s*rách\b/gi, 'distressed ripped leather and denim trousers'],
  [/\bquần\s*denim\s*rách\b/gi, 'distressed ripped jeans'],
  [/\bquần\s*da\b/gi, 'fitted leather pants'],
  [/\bquần\s*cargo\b/gi, 'cargo trousers'],
  [/\bquần\s*ống\s*rộng\b/gi, 'high-waisted wide-leg trousers'],
  [/\bquần\s*short\s*jeans\b/gi, 'denim shorts'],
  [/\bquần\s*short\b/gi, 'tailored shorts'],
  [/\bquần\s*jeans\b/gi, 'fitted denim jeans'],
  [/\bquần\s*âu\b/gi, 'tailored trousers'],
  [/\bváy\s*lụa\s*trắng\b/gi, 'flowing white silk dress'],
  [/\bváy\s*lụa\b/gi, 'draped silk dress'],
  [/\bváy\s*đen\b/gi, 'sleek black dress'],
  [/\bváy\s*trắng\b/gi, 'white dress'],
  [/\bváy\s*ngắn\b/gi, 'tailored short skirt'],
  [/\bchân\s*váy\s*ngắn\b/gi, 'tailored pleated skirt'],
  [/\bchân\s*váy\b/gi, 'pleated skirt'],
  [/\bgiày\s*cao\s*gót\b/gi, 'sleek stiletto high heels'],
  [/\bbốt\s*cao\s*cổ\b/gi, 'knee-high leather boots'],
  [/\bboots\s*cao\s*cổ\b/gi, 'knee-high leather boots'],
  [/\bvải\s*thun\s*co\s*giãn\b/gi, 'fitted stretch jersey fabric'],
  [/\bmàu\s*nude\b/gi, 'warm champagne-beige tone'],
  [/\bmàu\s*be\b/gi, 'warm beige tone'],
  [/\bmàu\s*kem\b/gi, 'soft cream ivory tone'],
  [/\bkính\s*râm\s*mắt\s*mèo\b/gi, 'black cat-eye sunglasses'],
  [/\bđeo\s*kính\s*gọng\s*mảnh\b/gi, 'wearing thin metal-rimmed glasses'],
  [/\bđeo\s*kính\s*râm\b/gi, 'wearing dark sunglasses'],
  [/\bkính\s*râm\s*đen\b/gi, 'dark sunglasses'],
  [/\bkính\s*râm\b/gi, 'sunglasses'],
  [/\bkính\s*mát\b/gi, 'stylish sunglasses'],
  [/\bđeo\s*kính\b/gi, 'wearing glasses'],
  [/\bmũ\s*beanie\b/gi, 'knit beanie hat'],
  [/\bkhuyên\s*tai\s*ngọc\s*trai\b/gi, 'delicate pearl drop earrings'],
  [/\bkhuyên\s*tai\s*tròn\b/gi, 'sleek hoop earrings'],
  [/\bkhuyên\s*tai\s*bạc\b/gi, 'minimalist silver earrings'],
  [/\bkhuyên\s*tai\b/gi, 'earrings'],
  [/\bvòng\s*cổ\s*dây\s*xích\s*bạc\b/gi, 'layered silver chain necklace'],
  [/\bvòng\s*cổ\s*xích\b/gi, 'layered silver chain necklaces'],
  [/\bvòng\s*cổ\s*bạc\b/gi, 'silver chain necklace'],
  [/\bvòng\s*cổ\b/gi, 'necklace'],
  [/\bdây\s*chuyền\s*bạc\b/gi, 'fine silver pendant necklace'],
  [/\bdây\s*chuyền\b/gi, 'pendant necklace'],
  [/\blắc\s*tay\b/gi, 'delicate wrist bracelet'],
  [/\bvòng\s*tay\b/gi, 'minimalist bracelet'],
  [/\bnhẫn\s*kim\s*loại\b/gi, 'chunky metal rings'],
  [/\bnhẫn\s*bạc\b/gi, 'multiple stacked silver rings'],
  [/\bnhẫn\b/gi, 'rings'],
  [/\bsơn\s*móng\s*tay\b/gi, 'manicured fingernails'],
  [/\bđồng\s*hồ\s*đeo\s*tay\b/gi, 'classic wristwatch'],
  [/\btai\s*nghe\b/gi, 'studio headphones'],
  [/\bmicro\s*cầm\s*tay\b/gi, 'handheld microphone'],
  [/\bquạt\s*xếp\b/gi, 'ornate Chinese folding fan'],
  [/\bđả\s*cẩu\s*bổng\b/gi, 'jade-green bamboo martial staff'],
  [/\btrúc\s*bổng\b/gi, 'bamboo martial staff'],
  [/\bngọc\s*tiêu\b/gi, 'carved jade flute'],
  [/\bđoản\s*đao\b/gi, 'Chinese short curved dao blade'],
  [/\bbảo\s*đao\b/gi, 'ornate Chinese broad curved dao saber'],
  [/\bđại\s*đao\b/gi, 'heavy Chinese curved dao saber'],
  [/\btrường\s*kiếm\b/gi, 'forged Chinese double-edged jian longsword'],
  [/\bbảo\s*kiếm\b/gi, 'ornate Chinese double-edged jian sword'],
  [/\bnhuyễn\s*kiếm\b/gi, 'flexible Chinese belt jian sword'],
  [/\btrọng\s*kiếm\b/gi, 'heavy dark-iron Chinese broadsword'],
  [/\bngọc\s*bội\b/gi, 'carved jade waist pendant'],

  // Actions & expressions
  [/\bmỉm\s*cười\s*nhẹ\b/gi, 'with a subtle understated smile'],
  [/\bcười\s*rạng\s*rỡ\b/gi, 'with a bright warm smile'],
  [/\bcười\s*nửa\s*miệng\b/gi, 'with a faint knowing smirk'],
  [/\bnhíu\s*mày\b/gi, 'with slightly furrowed brows'],
  [/\bquay\s*đầu\s*nhìn\s*lại\b/gi, 'glancing back over the shoulder'],
  [/\bnhìn\s*thẳng\b/gi, 'looking steadily forward'],
  [/\bkhoanh\s*tay\b/gi, 'standing with arms lightly crossed'],
  [/\bđứng\s*bên\s*cửa\s*sổ\b/gi, 'standing beside a window'],
  [/\bngồi\s*bên\s*cửa\s*sổ\b/gi, 'seated beside a window'],
  [/\bcầm\s*tách\s*cà\s*phê\b/gi, 'holding a warm coffee cup'],
  [/\bcầm\s*ly\s*rượu\b/gi, 'holding a crystal wine glass'],

  // Locations, settings & atmosphere
  [/\bphòng\s*thu\s*âm\b/gi, 'dimly lit modern recording studio'],
  [/\bphòng\s*thu\b/gi, 'modern recording studio'],
  [/\bbàn\s*mixer\b/gi, 'illuminated audio mixing console'],
  [/\bphòng\s*ngủ\b/gi, 'cozy modern bedroom'],
  [/\bphòng\s*khách\b/gi, 'modern living room'],
  [/\bphòng\s*làm\s*việc\b/gi, 'executive study office'],
  [/\bvăn\s*phòng\b/gi, 'contemporary office'],
  [/\bcăn\s*hộ\b/gi, 'city apartment'],
  [/\bhành\s*lang\b/gi, 'architectural hallway'],
  [/\bquán\s*cà\s*phê\b/gi, 'cozy sunlit cafe'],
  [/\bquán\s*bar\b/gi, 'moody dimly lit cocktail lounge'],
  [/\bsân\s*khấu\b/gi, 'illuminated concert stage'],
  [/\bhậu\s*trường\b/gi, 'backstage dressing room'],
  [/\bphố\s*đêm\b/gi, 'rain-slicked city street at night'],
  [/\bphố\s*cổ\b/gi, 'lantern-lit historic old street'],
  [/\brừng\s*trúc\b/gi, 'misty bamboo forest'],
  [/\bcung\s*điện\b/gi, 'grand imperial palace courtyard'],
  [/\btửu\s*lâu\b/gi, 'multi-story wooden tavern'],
  [/\bđỉnh\s*núi\b/gi, 'cloud-wreathed mountain peak'],
  [/\bbờ\s*biển\b/gi, 'scenic ocean shoreline'],
  [/\bmưa\s*đêm\b/gi, 'late-night rain with wet reflections'],
  [/\bđèn\s*bàn\b/gi, 'warm desk lamp'],
  [/\bđèn\s*ngủ\b/gi, 'warm bedside lamp'],
  [/\bđèn\s*neon\b/gi, 'colorful neon lights'],
  [/\bánh\s*nắng\s*chiều\b/gi, 'golden late-afternoon sunlight'],
  [/\bánh\s*trăng\b/gi, 'cool silver moonlight'],
  [/\b(\d{1,2})\s*tuổi\b/gi, '$1 years old'],
];

const COMPILED_VI_TO_EN_LEXICON: Array<[RegExp, string]> =
  VI_TO_EN_VISUAL_LEXICON.map(([rawPattern, replacement]) => {
    const unicodePattern = rawPattern.unicode
      ? rawPattern
      : new RegExp(
          rawPattern.source
            .replace(/^\\b/, '(?<![\\p{L}\\p{N}])')
            .replace(/\\b$/, '(?![\\p{L}\\p{N}])'),
          'giu',
        );
    return [unicodePattern, replacement];
  });

/**
 * Translates Vietnamese visual phrases into fluent English equivalents.
 */
export function translateVietnameseVisualToEnglish(raw?: string | null): string {
  let out = String(raw ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!out) return '';
  for (const [unicodePattern, replacement] of COMPILED_VI_TO_EN_LEXICON) {
    out = out.replace(unicodePattern, replacement);
  }
  return out
    .replace(/\s*\.\s*,/g, ',')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Common unaccented Vietnamese syllables that frequently leak as orphan residue
 * when raw Vietnamese prose has its accented neighbors stripped.
 */
const UNACCENTED_VI_RESIDUE_SET = new Set([
  'va', 'cua', 'voi', 'trong', 'tren', 'duoi', 'nhung', 'mot', 'nhu', 'khi',
  'rat', 'dang', 'da', 'se', 'la', 'thi', 'cung', 'hay', 'hoac', 'cho', 'tu',
  'den', 'tai', 'ben', 'ngoai', 'nam', 'ca', 'trai', 'trung', 'theo', 'tay',
  'phong', 'cao', 'sau', 'noi', 'nhieu', 'kieu', 'nguoi', 'toc',
  'ao', 'quan', 'vay', 'dam', 'deo', 'cam', 'co', 'nguc', 'vai', 'danh', 'qua',
  'giao', 'khoe', 'cong', 'thun', 'than', 'xinh', 'chan', 'eo', 'mong',
  'moi', 'giay', 'ngau', 'om', 'sat', 'bo', 'khoac', 'sac', 'lanh', 'diu',
  'ngot', 'cang', 'tron', 'trang', 'nau', 'vang', 'xanh', 'hong',
  'bac', 'tim', 'luon', 'thuong', 'nhe', 'day', 'dai', 'ngan', 'buong', 'xoan',
  'thang', 'nhon', 'mem', 'min', 'sang', 'toi', 'kheo', 'tinh', 'te', 'chuan',
  'chat', 'cach', 'gu', 'mac', 'dien', 'pho', 'khau', 'chiec', 'doi',
  'goc', 'canh', 'nhip', 'buoc', 'anh', 'nhin', 'cuoi', 'nghieng', 'tua',
  'khe', 'ho', 'xe', 'ta', 'lung', 'dui', 'bap', 'goi', 'got', 'phai', 'nen',
  'khong', 'ay', 'chi', 'em', 'minh', 'van', 'hoi', 'chut', 'cuc',
  'sieu', 'vua', 'xuyen', 'thich', 'dung', 'ngoi', 'lam', 'di', 've', 'ra',
  'vao', 'len', 'xuong', 'lai', 'gan', 'xa', 'truoc', 'giua', 'rong', 'thap',
  'nho', 'nang', 'thon', 'manh', 'gay', 'xam', 'kem',
  'mui', 'may', 'leo', 'ma', 'chua', 'roi', 'nua', 'hon', 'nhat', 'bi', 'duoc',
  'boi', 'quyen', 'ru', 'goi', 'thanh', 'lich', 'ky',
  'sao', 'ngam', 'khanh', 'ngay',
  'tiet', 'tiep', 'thai', 'he', 'diem', 'nhan', 'bieu', 'hien', 'pha',
]);

const DANGLING_EN_CONNECTOR_RE =
  /^(?:with|and|or|in|on|of|to|by|for|at|from|as|a|an|the|wearing|accented\s+by|featuring|showing)$/i;

/**
 * Removes untranslated Vietnamese words (both accented diacritics AND unaccented
 * Vietnamese residue like "danh, qua, giao, khoe cong, thun than") using clause-level
 * purity checks so broken fragments never leak into English portrait prompts.
 */
export function stripResidualVietnameseFromEnglishClause(
  text?: string | null,
  preserveNames: Array<string | undefined | null> = [],
): string {
  const clean = String(text ?? '').trim();
  if (!clean) return '';

  const safePreserve = Array.isArray(preserveNames) ? preserveNames : [];
  const preserveLower = new Set<string>();
  for (const name of safePreserve) {
    const trimmed = String(name ?? '').trim().toLowerCase();
    if (trimmed.length >= 2) {
      preserveLower.add(trimmed);
      for (const part of trimmed.split(/\s+/)) {
        if (part.length >= 2) preserveLower.add(part);
      }
    }
  }

  // Evaluate clause-by-clause (split on comma / semicolon / slash-bar)
  const rawClauses = clean.split(/([,;|\n]+)/);
  const keptClauses: string[] = [];

  for (let i = 0; i < rawClauses.length; i += 1) {
    const piece = rawClauses[i];
    if (!piece) continue;
    if (/^[,;|\n]+$/.test(piece)) {
      keptClauses.push(', ');
      continue;
    }

    const words = piece.split(/\s+/).filter(Boolean);
    if (!words.length) continue;

    let totalWords = 0;
    let droppedWords = 0;
    const cleanWords: string[] = [];

    for (const rawWord of words) {
      const strippedWord = rawWord.replace(
        /^[^a-zA-Z0-9\u00C0-\u1EF9'-]+|[^a-zA-Z0-9\u00C0-\u1EF9'-]+$/g,
        '',
      );
      if (!strippedWord) continue;
      totalWords += 1;
      const lower = strippedWord.toLowerCase();
      const isPreserved = preserveLower.has(lower);
      const hasDiacritic = VIET_DIACRITIC_RE.test(rawWord);

      if (isPreserved) {
        cleanWords.push(rawWord);
        continue;
      }
      if (hasDiacritic) {
        droppedWords += 1;
        continue;
      }
      // Drop known unaccented Vietnamese residue words (unless clearly English in an English clause)
      if (UNACCENTED_VI_RESIDUE_SET.has(lower)) {
        droppedWords += 1;
        continue;
      }
      // Drop bare 1-letter orphan letters (except "a")
      if (strippedWord.length === 1 && !/^[a0-9]$/i.test(strippedWord)) {
        droppedWords += 1;
        continue;
      }
      cleanWords.push(rawWord);
    }

    if (!cleanWords.length) continue;

    // Clause-purity check: if half or more of a short clause was Vietnamese residue,
    // the leftover 1-2 words are almost certainly mangled fragments -> drop cleanly!
    const keptRatio = cleanWords.length / Math.max(1, totalWords);
    const hasPreservedName = cleanWords.some((w) =>
      preserveLower.has(
        w
          .replace(/^[^a-zA-Z0-9\u00C0-\u1EF9'-]+|[^a-zA-Z0-9\u00C0-\u1EF9'-]+$/g, '')
          .toLowerCase(),
      ),
    );
    if (
      !hasPreservedName &&
      droppedWords > 0 &&
      keptRatio < 0.55 &&
      cleanWords.length <= 2
    ) {
      continue;
    }

    // Trim dangling leading/trailing English prepositions left behind after dropping Vietnamese nouns
    while (
      cleanWords.length > 0 &&
      DANGLING_EN_CONNECTOR_RE.test(
        cleanWords[cleanWords.length - 1].replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''),
      )
    ) {
      cleanWords.pop();
    }
    while (
      cleanWords.length > 0 &&
      /^(?:and|or|of|to|by|for|at|from)$/i.test(
        cleanWords[0].replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''),
      )
    ) {
      cleanWords.shift();
    }

    const joinedClause = cleanWords.join(' ').trim();
    if (
      !joinedClause ||
      DANGLING_EN_CONNECTOR_RE.test(joinedClause) ||
      joinedClause.length < 3
    ) {
      continue;
    }
    keptClauses.push(joinedClause);
  }

  return keptClauses
    .join('')
    .replace(/\(\s*[,;]*\s*\)/g, '')
    .replace(/\s*\.\s*,/g, ',')
    .replace(/\s*[,;]\s*(?:[,;]\s*)+/g, ', ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\b(?:wearing|with|accented\s+by)\s*(?=[,.;:]|$)/gi, '')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;.:-]+|[\s,;:-]+$/g, '')
    .trim();
}

/**
 * Distills clean, visual-only English demeanor/aura/expression cues from Vietnamese
 * or English personality / signature text so non-visual relationship or backstory prose
 * never leaks broken words into an image prompt.
 */
export function distillVisualAuraFromProfileTextEn(
  personality?: string | null,
  signature?: string | null,
): string {
  const combined = `${String(personality ?? '')} ${String(signature ?? '')}`.trim();
  if (!combined) return '';

  const cues: string[] = [];
  const add = (cue: string) => {
    if (!cues.includes(cue)) cues.push(cue);
  };

  if (/(?:sang\s*chảnh|kiêu\s*kỳ|kiêu\s*sa|quý\s*phái|thượng\s*lưu)/i.test(combined)) {
    add('poised glamorous high-fashion presence');
  }
  if (/(?:quyến\s*rũ|gợi\s*cảm|mị\s*lực|cuốn\s*hút|mê\s*hoặc)/i.test(combined)) {
    add('poised captivating charisma');
  }
  if (/(?:lạnh\s*lùng|xa\s*cách|ít\s*nói|kiêu\s*ngạo|sắc\s*lạnh)/i.test(combined)) {
    add('cool composed aloof gaze');
  } else if (/(?:dịu\s*dàng|ấm\s*áp|hiền\s*hòa|nhẹ\s*nhàng|tình\s*cảm)/i.test(combined)) {
    add('gentle warm serene demeanor');
  } else if (/(?:tinh\s*nghịch|hoạt\s*bát|năng\s*động|trẻ\s*trung|vui\s*tươi|ngọt\s*ngào)/i.test(combined)) {
    add('lively bright youthful charm');
  }
  if (/(?:sắc\s*sảo|thông\s*minh|tinh\s*anh|nhạy\s*bén|quyết\s*đoán|bản\s*lĩnh)/i.test(combined)) {
    add('sharp perceptive self-assured gaze');
  }
  if (/(?:tự\s*tin|phóng\s*khoáng|cá\s*tính|nổi\s*loạn|bụi\s*bặm|ngầu)/i.test(combined)) {
    add('bold self-assured charismatic presence');
  }
  if (/(?:bí\s*ẩn|trầm\s*tĩnh|điềm\s*đạm|trầm\s*ổn|chín\s*chắn)/i.test(combined)) {
    add('calm grounded magnetic presence');
  }
  if (/(?:thanh\s*lịch|tinh\s*tế|nhã\s*nhặn)/i.test(combined)) {
    add('refined elegant poise');
  }

  return cues.slice(0, 2).join(', ');
}

/**
 * Prevents contradictory build or expression descriptors within the same character prompt
 * (e.g., keeping declared curvy/athletic build without clashing frail/skinny pool fallback).
 */
export function reconcilePortraitContradictionsEn(text: string): string {
  let out = String(text ?? '').trim();
  if (!out) return '';
  // If character is explicitly well-proportioned/athletic, remove conflicting "frail/skinny/bony" fallbacks
  if (/\b(?:curvy|hourglass|voluptuous|full-figured|well-proportioned|athletic|muscular|broad-shouldered)\b/i.test(out)) {
    out = out.replace(/\b(?:frail|skinny|bony|gaunt)\b/gi, '');
  }
  // If character is explicitly cool/aloof/serious, avoid clashing "cheerful grin"
  if (/\b(?:aloof|cool\s+composed|stoic|serious|stern|cold\s+gaze)\b/i.test(out)) {
    out = out.replace(/\b(?:bright\s+cheerful\s+grin|wide\s+goofy\s+smile)\b/gi, 'composed understated expression');
  }
  return out
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
    .trim();
}

const API_SAFETY_FASHION_REPLACEMENTS: Array<[RegExp, string, string]> = [
  // Literal "nude" in fashion/lipstick ("nude jumpsuit", "nude-toned", "nude lipstick") is the #1 false-positive trigger on Seedream/image gateways
  [/\bform-fitting\s+nude\s+(?:stretch\s+)?jumpsuit\b/gi, 'tailored champagne-beige knit jumpsuit', 'nude jumpsuit'],
  [/\bsleek\s+nude-?toned\s+jumpsuit\b/gi, 'sleek champagne-beige jumpsuit', 'nude-toned jumpsuit'],
  [/\bfitted\s+nude-?toned\s+bodysuit\b/gi, 'fitted champagne-beige knit top', 'nude bodysuit'],
  [/\bsoft\s+nude-?toned\s+lipstick\b/gi, 'soft rose-beige lipstick', 'nude lipstick'],
  [/\bnude-?toned\b/gi, 'warm champagne-beige', 'nude-toned'],
  [/\bsoft\s+nude\s+tone\b/gi, 'warm champagne-beige tone', 'nude tone'],
  [/\bnude\b/gi, 'champagne-beige', 'nude'],
  // Garment / silhouette terms that frequently trip upstream moderation queues on female portraits
  [/\b(?:form-fitting|skin-tight|body-hugging)\s+bodycon\s+dress\b/gi, 'tailored fitted evening dress', 'bodycon dress'],
  [/\bbodycon\b/gi, 'tailored fitted', 'bodycon'],
  [/\bbodysuit\b/gi, 'fitted knit top', 'bodysuit'],
  [/\bstructured\s+corset\s+top\b/gi, 'structured tailored bodice top', 'corset'],
  [/\bcorset\b/gi, 'structured tailored bodice', 'corset'],
  [/\bspaghetti-strap\s+camisole\s+top\b/gi, 'sleeveless tailored silk top', 'spaghetti-strap camisole'],
  [/\bsilk\s+camisole\s+slip\s+top\b/gi, 'sleeveless silk blouse', 'camisole slip'],
  [/\bcamisole\b/gi, 'sleeveless blouse', 'camisole'],
  [/\bslip\s+dress\b/gi, 'draped silk evening dress', 'slip dress'],
  [/\bhigh-slit\b/gi, 'tailored evening', 'high-slit'],
  [/\blingerie\b/gi, 'silk loungewear', 'lingerie'],
  [/\bbikini\b/gi, 'summer resort wear', 'bikini'],
  [/\bunderwear\b/gi, 'casual loungewear', 'underwear'],
  [/\bsee-through\b/gi, 'delicate layered chiffon', 'see-through'],
  [/\bsheer\b/gi, 'delicate chiffon', 'sheer'],
  [/\b(?:deeply\s+)?unbuttoned\s+patterned\s+shirt\s+exposing\s+the\s+chest\b/gi, 'relaxed open-collar patterned shirt', 'exposing the chest'],
  [/\bexposing\s+(?:the\s+)?(?:chest|cleavage|back|shoulders|midriff|legs)\b/gi, 'with modern fashion styling', 'exposing'],
  [/\bcleavage\b/gi, 'refined neckline', 'cleavage'],
  [/\b(?:busty|voluptuous|curvaceous|curvy\s+hourglass|hourglass\s+curvy|pronounced\s+feminine\s+curves|accentuating\s+natural\s+curves)\b/gi, 'graceful well-proportioned silhouette', 'curves'],
  [/\b(?:curvy|hourglass|curves)\b/gi, 'graceful silhouette', 'curves'],
  [/\b(?:skin-tight|body-hugging|form-fitting)\b/gi, 'tailored fitted', 'form-fitting'],
  [/\b(?:sensual|seductive|provocative|sultry|erotic|sexy|alluring)\b/gi, 'poised glamorous', 'sensual/alluring'],
  [/\bintimate\s+bedroom\b/gi, 'cozy modern bedroom', 'intimate bedroom'],
  [/\bintimate\b/gi, 'warm', 'intimate'],
  [/\bbare\s+(?:skin|shoulders|back|legs|chest|midriff)\b/gi, 'styled editorial portrait', 'bare'],
  [/\brevealing\b/gi, 'modern tailored', 'revealing'],
  [/\bplunge\s+neckline\b/gi, 'V-neck collar', 'plunge neckline'],
  [/\blow-cut\b/gi, 'V-neck', 'low-cut'],
  [/\b(?:cut-out|cutout)\b/gi, 'modern asymmetric tailored', 'cut-out'],
  [/\b(?:crop\s*top|cropped\s+top)\b/gi, 'tailored short-sleeve top', 'crop top'],
  [/\b(?:micro[-\s]*skirt|mini[-\s]*skirt|miniskirt)\b/gi, 'tailored fashion skirt', 'mini skirt'],
  [/\blow-?rise\b/gi, 'tailored waist', 'low-rise'],
  [/\b(?:bralette|swimsuit|bikini\s+top)\b/gi, 'modern fashion top', 'bralette/swimsuit'],
  [/\b(?:strapless|off-?shoulder)\b/gi, 'classic tailored neckline', 'strapless/off-shoulder'],
  [/\bfishnet\b/gi, 'textured knit', 'fishnet'],
  [/\b(?:latex|glossy\s+leather)\b/gi, 'structured matte leather', 'latex/glossy leather'],
  [/\bblack\s+lace\s+dress\b/gi, 'tailored black embroidered evening dress', 'lace dress'],
  [/\blace\s+dress\b/gi, 'tailored embroidered evening dress', 'lace dress'],
  [/\b(?:skin-?tight|super-?tight|tight-?fitting)\b/gi, 'tailored fitted', 'tight-fitting'],
];

/**
 * Neutralizes fashion/figure English tokens that cause upstream image APIs (Seedream 5 Pro /
 * Volcengine / OpenAI-compatible gateways) to silently stall or time out in NSFW moderation filters
 * — especially on female portraits (e.g., "nude jumpsuit", "nude lipstick", "bodysuit", "corset",
 * "sensual", "curves", "bodycon", "crop top", "mini skirt") — while preserving the intended high-fashion editorial look.
 */
export function sanitizeImagePromptForApiSafety(rawPrompt?: string | null): {
  prompt: string;
  changed: boolean;
  neutralizedTerms: string[];
} {
  let out = String(rawPrompt ?? '').trim();
  if (!out) {
    return { prompt: '', changed: false, neutralizedTerms: [] };
  }
  const neutralizedTerms: string[] = [];
  for (const [re, replacement, label] of API_SAFETY_FASHION_REPLACEMENTS) {
    re.lastIndex = 0;
    if (re.test(out)) {
      re.lastIndex = 0;
      out = out.replace(re, replacement);
      if (!neutralizedTerms.includes(label)) {
        neutralizedTerms.push(label);
      }
    }
  }
  // Deduplicate exact repeated comma-separated clauses so prompts stay crisp and concise
  const seenClauses = new Set<string>();
  const dedupedClauses: string[] = [];
  for (const part of out.split(/\s*,\s*/)) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;
    const key = trimmedPart.toLowerCase();
    if (seenClauses.has(key)) continue;
    seenClauses.add(key);
    dedupedClauses.push(trimmedPart);
  }
  const cleaned = dedupedClauses
    .join(', ')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
    .trim();
  return {
    prompt: cleaned,
    changed: neutralizedTerms.length > 0,
    neutralizedTerms,
  };
}

/**
 * Builds a concise, studio portrait fallback prompt (<= 420 chars) preserving the
 * character's name and visual traits cleanly.
 */
export function buildSafeCompactPortraitPrompt(options: {
  canonicalName?: string;
  genderWord: 'man' | 'woman' | 'person';
  ageNum?: number;
  hairClauseEn?: string;
  faceSummaryEn?: string;
  outfitSummaryEn?: string;
  styleGuideEn?: string;
}): string {
  const safeGender =
    options.genderWord === 'man' || options.genderWord === 'woman'
      ? options.genderWord
      : 'person';
  const safeAge =
    typeof options.ageNum === 'number' && Number.isFinite(options.ageNum)
      ? `${Math.max(20, Math.round(options.ageNum))}-year-old`
      : 'adult';
  const rawName = String(options.canonicalName ?? '').trim();

  const cleanVisual = (raw?: string) => sanitizeImagePromptForApiSafety(raw).prompt;

  const hashIdx = hashCharacterKey(rawName || safeGender);
  const fallbackHair =
    safeGender === 'woman'
      ? FEMALE_HAIR_POOL[hashIdx % FEMALE_HAIR_POOL.length]
      : safeGender === 'man'
        ? MALE_HAIR_POOL[hashIdx % MALE_HAIR_POOL.length]
        : 'neat natural styled hair';
  const fallbackFace =
    safeGender === 'woman'
      ? FEMALE_FACE_POOL[(hashIdx >>> 2) % FEMALE_FACE_POOL.length]
      : safeGender === 'man'
        ? MALE_FACE_POOL[(hashIdx >>> 2) % MALE_FACE_POOL.length]
        : 'clear refined facial features and calm natural expression';

  const trimAtWord = (text: string, maxLen: number): string => {
    const clean = String(text ?? '').trim();
    if (clean.length <= maxLen) return clean.replace(/[,;:\s]+$/, '');
    const cut = clean.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    const safeCut = lastSpace >= Math.floor(maxLen * 0.55) ? cut.slice(0, lastSpace) : cut;
    return safeCut.replace(/[,;:\s]+$/, '').trim();
  };

  const cleanedFaceRaw = cleanVisual(options.faceSummaryEn);
  const cleanedHairRaw = cleanVisual(options.hairClauseEn);
  const faceAlreadyHasHair = /\b(?:hair|bob|ponytail|braids|curls|waves|pixie|buzzcut|bangs)\b/i.test(
    cleanedFaceRaw,
  );
  const hairPart = cleanedHairRaw || (faceAlreadyHasHair ? '' : fallbackHair);
  const facePart = trimAtWord(cleanedFaceRaw || fallbackFace, 95);
  const outfitPart = trimAtWord(cleanVisual(options.outfitSummaryEn), 65);
  const stylePart = trimAtWord(
    String(options.styleGuideEn ?? '')
      .split(',')
      .slice(0, 2)
      .join(', ')
      .trim() || 'natural editorial portrait photography, realistic skin texture',
    72,
  );

  const parts = [
    `Single person editorial headshot portrait of ${rawName ? `${rawName}, ` : ''}an adult ${safeAge} ${safeGender}`,
    hairPart ? `with ${hairPart}` : '',
    facePart || 'clear refined facial features and calm natural expression facing camera',
    outfitPart
      ? `wearing ${outfitPart}`
      : 'wearing clean modern tailored everyday attire',
    'medium close-up eye-level framing, softly blurred studio backdrop, balanced natural daylight',
    stylePart,
    'no text, no watermark',
  ].filter(Boolean);

  return sanitizeImagePromptForApiSafety(parts.join(', ')).prompt.trim();
}

/**
 * Deterministic 32-bit FNV-1a hash used to assign stable, unique visual archetypes
 * per character name so different NPCs never get drawn with the exact same face/hair.
 */
function hashCharacterKey(input?: string | null): number {
  const str = String(input ?? 'character')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFromPool(pool: readonly string[], rawIndex: number): string {
  if (!pool.length) return '';
  const safeIdx = Number.isFinite(rawIndex)
    ? ((Math.floor(Math.abs(rawIndex)) % pool.length) + pool.length) % pool.length
    : 0;
  return String(pool[safeIdx] ?? pool[0] ?? '');
}

const FEMALE_FACE_POOL = [
  'refined oval face, expressive almond-shaped dark eyes, softly arched eyebrows, delicate nose bridge',
  'slender heart-shaped face, sharp upturned phoenix eyes, high defined cheekbones, poised natural lips',
  'softly contoured face, warm bright double-eyelid eyes, subtle cheek dimple, natural straight brows',
  'sculpted angular jawline, deep-set intense dark-brown eyes, defined straight eyebrows, calm expressive mouth',
  'graceful balanced oval features, wide attentive dark eyes, subtle beauty mark near the cheekbone, refined chin',
  'clean classic East Asian features, lively dark eyes with soft creases, neat tapered brows, composed expression',
];

const MALE_FACE_POOL = [
  'defined angular jawline, focused dark eyes, clean straight eyebrows, high nose bridge',
  'sculpted jawline, sharp observant eyes, neatly contoured brows, composed expression',
  'lean elongated face, calm expressive dark eyes, prominent cheekbones, sharp features',
  'balanced masculine facial structure, attentive eyes, natural eyebrows, subtle confident half-smile',
  'sharp chiseled cheekbones, intense gaze, strong nose bridge, resolute expression',
  'grounded everyday masculine face, expressive eyes, clean natural features, approachable demeanor',
];

const FEMALE_HAIR_POOL = [
  'long straight jet-black hair parted cleanly off-center',
  'shoulder-length layered chestnut-brown hair with soft wispy curtain bangs',
  'long dark-brown hair with loose natural waves cascading past the shoulders',
  'sleek dark hair gathered into a neat high ponytail with loose face-framing strands',
  'chic chin-length dark bob haircut tucked cleanly behind one ear',
  'long raven-black hair half-pinned back in a low graceful twist',
];

const MALE_HAIR_POOL = [
  'short textured jet-black hair with softly swept side fringe',
  'relaxed medium-length slightly wavy black hair falling naturally above the brow',
  'clean tapered dark-brown undercut with natural matte volume on top',
  'side-parted dark hair neatly layered around the temples',
  'shoulder-grazing dark hair loosely tied back at the nape',
  'short cropped dark hair with crisp natural hairline',
];

const BUILD_AURA_FEMALE_POOL = [
  'slender graceful posture, calm self-assured aura',
  'tall poised silhouette, sharp magnetic presence',
  'lithe athletic build, warm energetic aura',
  'delicate balanced frame, quiet thoughtful elegance',
];

const BUILD_AURA_MALE_POOL = [
  'tall lean athletic build, grounded composed presence',
  'broad-shouldered sturdy build, authoritative calm aura',
  'slender agile physique, sharp observant presence',
  'well-proportioned build, relaxed approachable charisma',
];

const OUTFIT_MODERN_FEMALE_POOL = [
  'minimalist cream knit top with tailored dark trousers and fine silver earrings',
  'crisp oversized white shirt layered over a dark camisole with a delicate pendant necklace',
  'structured charcoal blazer over a silk blouse with a sleek wristwatch',
  'soft olive-green draped cardigan with fitted denim jeans and minimalist hoop earrings',
];

const OUTFIT_MODERN_MALE_POOL = [
  'relaxed charcoal overshirt layered over a clean white crewneck tee and dark trousers',
  'matte black zip jacket over a fitted dark knit top with a classic steel wristwatch',
  'casual navy collared shirt with rolled sleeves and tailored chinos',
  'structured dark denim jacket over a heather-gray tee with minimal silver ring',
];

const OUTFIT_ANCIENT_FEMALE_POOL = [
  'layered ivory and pale-jade embroidered Chinese silk hanfu robes with woven waist sash',
  'flowing deep-teal traditional Chinese silk robes with silver cloud-motif trim and fabric belt',
  'refined crimson-accented dark traditional Chinese martial robes with crisp lapels',
  'graceful misty-blue layered Chinese classical hanfu robes with soft flowing sleeves',
];

const OUTFIT_ANCIENT_MALE_POOL = [
  'layered ink-black and slate-gray traditional Chinese martial robes with fitted leather bracers and woven sash',
  'flowing ivory-white traditional Chinese scholar hanfu robes with subtle woven trim',
  'structured deep-navy traditional Chinese wuxia robes with bronze-trimmed cloth sash',
  'grounded dark-brown traditional Chinese traveler martial tunic and layered robes with woven cord belt',
];

export interface StructuredCharacterPromptInput {
  canonicalName: string;
  knownDisplayAlias?: string;
  isKnownRealPerson?: boolean;
  genderWord: 'man' | 'woman' | 'person';
  ageCue?: string;
  ageNum?: number;
  skinAgeCue: string;
  role?: string;
  appearance?: string;
  fashionStyle?: string;
  personality?: string;
  signature?: string;
  identityLock?: CharacterIdentityLock;
  avatarVisualLock?: string;
  worldGenreHint?: string;
  lockAvatarIdentity?: boolean;
}

export type HairColorFamily =
  | 'platinum_blonde'
  | 'blonde'
  | 'black'
  | 'brown'
  | 'red'
  | 'white_silver'
  | 'dyed_vivid';

export interface ExplicitHairProfile {
  hasExplicitHair: boolean;
  colorFamily?: HairColorFamily;
  hairClauseEn: string;
}

/**
 * Extracts explicit hair color & hairstyle from Vietnamese or English profile text
 * so hair identity can be placed at the very front of the subject prompt and protected
 * against conflicting hair colors from stale reference comparisons or shadowy photos.
 */
export function extractExplicitHairProfileEn(
  ...sources: Array<string | undefined | null>
): ExplicitHairProfile {
  const raw = sources
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join(' ; ');
  if (!raw) {
    return { hasExplicitHair: false, hairClauseEn: '' };
  }

  const translated = translateVietnameseVisualToEnglish(raw);
  const scan = `${raw} ; ${translated}`;

  // Detect hair color family (ordered from most specific/vivid to common)
  let colorFamily: HairColorFamily | undefined;
  if (/(?:bạch\s*kim|platinum[\s-]*blonde?|bleached[\s-]*blonde?|icy[\s-]*blonde?)/iu.test(scan)) {
    colorFamily = 'platinum_blonde';
  } else if (/(?:tóc\s*hồng|tóc\s*xanh|tóc\s*tím|pink\s+hair|blue\s+hair|purple\s+hair|green\s+hair|neon\s+hair)/iu.test(scan)) {
    colorFamily = 'dyed_vivid';
  } else if (/(?:tóc\s*vàng|golden\s+blonde|blonde\s+hair|blond\s+hair)/iu.test(scan)) {
    colorFamily = 'blonde';
  } else if (/(?:tóc\s*đỏ|burgundy[\s-]*red\s+hair|crimson[\s-]*red\s+hair|ginger\s+hair|red\s+hair)/iu.test(scan)) {
    colorFamily = 'red';
  } else if (/(?:tóc\s*trắng|silver[\s-]*white\s+hair|white\s+hair|silver\s+hair)/iu.test(scan)) {
    colorFamily = 'white_silver';
  } else if (/(?:tóc\s*nâu|chestnut[\s-]*brown\s+hair|dark[\s-]*brown\s+hair|brown\s+hair|brunette)/iu.test(scan)) {
    colorFamily = 'brown';
  } else if (/(?:tóc\s*đen|jet[\s-]*black\s+hair|raven[\s-]*black\s+hair|black\s+hair)/iu.test(scan)) {
    colorFamily = 'black';
  }

  // Extract the richest English hair phrase already present after translation
  const enHairMatch =
    /\b(?:(?:messy|tousled|spiky|shaggy|long|short|shoulder-length|medium-length|layered|sleek|wavy|curly|lightly\s+curly|naturally\s+slightly\s+wavy|clean\s+close-cropped|close-cropped|side-parted|center-parted|slicked-back|chic\s+short\s+layered|waist-length|flowing|relaxed|softly\s+waved|neat\s+short\s+cropped|natural)\s+){0,4}(?:platinum-blonde|platinum\s+blonde|bleached\s+blonde|golden\s+blonde|blonde|jet-black|raven-black|black|chestnut-brown|dark-brown|brown|burgundy-red|crimson-red|red|silver-white|white|pink|blue|purple|dark)?\s*(?:hair|haircut|bob\s+haircut|buzzcut(?:\s+with\s+sharp\s+fade)?|ponytail|topknot\s+bun|bun)(?:\s+(?:worn\s+loose|falling\s+softly\s+around\s+the\s+face|with\s+soft\s+curls|with\s+sharp\s+fade|with\s+curtain\s+bangs))?/i.exec(
      translated,
    );

  let hairClauseEn = enHairMatch?.[0]
    ? enHairMatch[0].replace(/\s{2,}/g, ' ').trim()
    : '';

  // Ensure explicit color family is clearly preserved in hairClauseEn
  if (colorFamily === 'platinum_blonde' && !/platinum|blonde/i.test(hairClauseEn)) {
    hairClauseEn = hairClauseEn
      ? `platinum-blonde ${hairClauseEn}`
      : 'messy tousled platinum-blonde hair';
  } else if (colorFamily === 'blonde' && !/blonde/i.test(hairClauseEn)) {
    hairClauseEn = hairClauseEn ? `blonde ${hairClauseEn}` : 'blonde hair';
  } else if (colorFamily === 'red' && !/red|burgundy|crimson|ginger/i.test(hairClauseEn)) {
    hairClauseEn = hairClauseEn ? `red ${hairClauseEn}` : 'crimson-red hair';
  } else if (colorFamily === 'white_silver' && !/white|silver/i.test(hairClauseEn)) {
    hairClauseEn = hairClauseEn ? `silver-white ${hairClauseEn}` : 'silver-white hair';
  } else if (colorFamily === 'brown' && !/brown|chestnut|brunette/i.test(hairClauseEn)) {
    hairClauseEn = hairClauseEn ? `brown ${hairClauseEn}` : 'brown hair';
  } else if (colorFamily === 'black' && !/black|raven/i.test(hairClauseEn)) {
    hairClauseEn = hairClauseEn ? `black ${hairClauseEn}` : 'black hair';
  }

  return {
    hasExplicitHair: Boolean(hairClauseEn || colorFamily),
    colorFamily,
    hairClauseEn,
  };
}

/**
 * Strips hair-color phrases that directly contradict the character's explicit profile hair color
 * (e.g., strips "dark hair / black hair / brown hair" when the profile specifies platinum-blonde hair).
 */
export function stripConflictingHairColorsFromText(
  text?: string | null,
  expectedColorFamily?: HairColorFamily,
): { cleaned: string; removedConflict: boolean } {
  const orig = String(text ?? '').trim();
  if (!orig || !expectedColorFamily) {
    return { cleaned: orig, removedConflict: false };
  }

  const hairLeadMod =
    '(?:(?:very\\s+)?(?:short|long|medium-length|shoulder-length|cropped|neat|natural|messy|tousled|textured|wavy|curly|straight|layered|slicked-back|side-parted|center-parted|sleek|shaggy|spiky)\\s+){0,3}';
  const hairMidMod =
    '(?:(?:textured|wavy|curly|straight|short|long|layered|messy|tousled|cropped|spiky)\\s+){0,2}';

  const conflictMap: Record<HairColorFamily, RegExp[]> = {
    platinum_blonde: [
      new RegExp(
        `\\b${hairLeadMod}(?:jet[\\s-]*black|raven[\\s-]*black|black|dark[\\s-]*brown|chestnut[\\s-]*brown|medium[\\s-]*brown|light[\\s-]*brown|brown|dark|brunette|auburn|crimson|burgundy|ginger|red)\\s+${hairMidMod}hair(?:style|cut)?\\b`,
        'gi',
      ),
      /\b(?:dark|black|brown|brunette)\s+(?:hair\s+color|locks|strands|fringe|bangs)\b/gi,
      /\bbrunette\b/gi,
    ],
    blonde: [
      new RegExp(
        `\\b${hairLeadMod}(?:jet[\\s-]*black|raven[\\s-]*black|black|dark[\\s-]*brown|chestnut[\\s-]*brown|brown|dark|brunette|crimson|burgundy|red)\\s+${hairMidMod}hair(?:style|cut)?\\b`,
        'gi',
      ),
      /\bbrunette\b/gi,
    ],
    black: [
      new RegExp(
        `\\b${hairLeadMod}(?:platinum[\\s-]*blonde?|bleached[\\s-]*blonde?|golden[\\s-]*blonde?|blonde?|ginger|red|silver[\\s-]*white|white)\\s+${hairMidMod}hair(?:style|cut)?\\b`,
        'gi',
      ),
    ],
    brown: [
      new RegExp(
        `\\b${hairLeadMod}(?:platinum[\\s-]*blonde?|bleached[\\s-]*blonde?|jet[\\s-]*black|silver[\\s-]*white|white)\\s+${hairMidMod}hair(?:style|cut)?\\b`,
        'gi',
      ),
    ],
    red: [
      new RegExp(
        `\\b${hairLeadMod}(?:platinum[\\s-]*blonde?|blonde?|jet[\\s-]*black|black|dark[\\s-]*brown|brown|silver[\\s-]*white)\\s+${hairMidMod}hair(?:style|cut)?\\b`,
        'gi',
      ),
    ],
    white_silver: [
      new RegExp(
        `\\b${hairLeadMod}(?:jet[\\s-]*black|black|dark[\\s-]*brown|brown|dark|brunette|blonde?|red)\\s+${hairMidMod}hair(?:style|cut)?\\b`,
        'gi',
      ),
    ],
    dyed_vivid: [
      new RegExp(
        `\\b${hairLeadMod}(?:jet[\\s-]*black|black|dark[\\s-]*brown|brown|natural\\s+dark)\\s+${hairMidMod}hair(?:style|cut)?\\b`,
        'gi',
      ),
    ],
  };

  const patterns = conflictMap[expectedColorFamily] || [];
  let out = orig;
  let removedConflict = false;
  for (const re of patterns) {
    if (re.test(out)) {
      removedConflict = true;
      re.lastIndex = 0;
      out = out.replace(re, ' ');
    }
  }
  out = out
    .replace(/\b(?:with|and|or)\s*(?=[,.;]|$)/gi, '')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleaned: out, removedConflict };
}

/**
 * Strips over-aging terms (e.g. "mature", "wrinkles", "weathered", "expression lines",
 * "crow's feet", "middle-aged") for characters under ~42 so diffusion models do not
 * artificially age 20s-30s characters into looking 45-50+.
 * Preserves explicit negative clauses like "no harsh wrinkles" or "not over-aged".
 */
export function stripOverAgingWordsFromText(
  text?: string | null,
  ageNum?: number,
): { cleaned: string; removedAging: boolean } {
  const orig = String(text ?? '').trim();
  if (!orig || (typeof ageNum === 'number' && ageNum >= 42)) {
    return { cleaned: orig, removedAging: false };
  }

  // Protect explicit negative anti-aging clauses from being stripped
  const protectedTokens: string[] = [];
  let out = orig.replace(
    /\b(?:no|not|without|avoid|never)\s+(?:artificial\s+|heavy\s+|harsh\s+|over-?)?(?:aging|aged|wrinkles?|weathered(?:\s+look)?|expression\s+lines?|crow'?s\s*feet|over-?aging|over-?aged)(?:\s+or\s+(?:harsh\s+|weathered\s+|aged\s+)?(?:wrinkles?|look|lines?))?/gi,
    (match) => {
      const token = `__NOAGE_${protectedTokens.length}__`;
      protectedTokens.push(match);
      return token;
    },
  );

  const agingPatterns: RegExp[] = [
    /\b(?:with\s+)?(?:visible\s+|subtle\s+|light\s+|natural\s+|aged\s+|age-appropriate\s+|age-accurate\s+)?(?:smile\/eye\s+|eye\/smile\s+|forehead\s+|laugh\s+|smile\s+|crow'?s\s*feet\s+)?(?:expression\s+lines|wrinkles|fine\s+lines|laugh\s+lines|smile\s+lines|forehead\s+lines|crow'?s\s*feet)\b/gi,
    /\bmature\s+(?:mid-?30s\s+|late-?30s\s+)?(?:defined\s+)?facial\s+(?:maturity|bone\s+structure|structure|features|bones)\b/gi,
    /\bfacial\s+maturity\b/gi,
    /\bmature\s+(?:weathered\s+)?/gi,
    /\b(?:weathered|middle-?aged|elderly|aged|older-looking|tired-wise|worn\s+face)\b/gi,
    /\b(?:mid-30s|late\s+30s|late-30s|40s|50s|60s)\b/gi,
  ];
  let removedAging = false;
  for (const re of agingPatterns) {
    if (re.test(out)) {
      removedAging = true;
      re.lastIndex = 0;
      out = out.replace(re, ' ');
    }
  }

  // Restore protected negative clauses
  for (let i = 0; i < protectedTokens.length; i++) {
    out = out.replace(`__NOAGE_${i}__`, protectedTokens[i]);
  }

  out = out
    .replace(/\(\s*[,;]*\s*\)/g, '')
    .replace(/\b(?:with|and|or)\s*(?=[,.;)]|$)/gi, '')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { cleaned: out, removedAging };
}

export interface StructuredCharacterPromptOutput {
  name: string;
  genderWord: 'man' | 'woman' | 'person';
  subjectIdentity: string;
  outfitAccessories: string;
  combinedClause: string;
  usedHashIndex: number;
}

function isAncientOrFantasyWorld(hint?: string | null): boolean {
  return /(?:tiên\s*hiệp|tu\s*tiên|huyền\s*huyễn|cổ\s*đại|kiếm\s*hiệp|võ\s*hiệp|cung\s*đấu|xianxia|xuanhuan|wuxia|ancient|palace|sect|cultivat|hanfu|robe|sword)/i.test(
    String(hint ?? ''),
  );
}

export interface ExtractedTattooProfile {
  hasTattoos: boolean;
  clauseEn: string;
  locations: string[];
  needsOpenTorsoFraming: boolean;
  density: 'heavy' | 'prominent' | 'subtle';
}

/**
 * Extracts explicit tattoo mentions, coverage/density, and anatomical locations
 * (neck, throat, chest, shoulders, arms/sleeves, forearms, hands, face) from
 * Vietnamese or English profile text so tattoos are NEVER stripped or truncated.
 */
function stripNegatedBodyMarkMentions(raw: string): string {
  return String(raw || '')
    .replace(
      /(?:không\s*(?:hề\s*)?(?:có\s*)?|chưa\s*(?:từng\s*)?(?:có\s*)?|miễn\s*|không\s*đeo\s*|no\s+|without\s+|free\s+of\s+|zero\s+)(?:bất\s*kỳ\s*)?(?:hình\s*xăm|xăm\s*mình|xăm\s*kín|vết\s*sẹo|sẹo|khuyên\s*(?:mũi|môi|mày|tai)|tattoos?|tattooed|body\s*ink|scars?|scarred|piercings?)/giu,
      ' ',
    )
    .replace(/\btattoo[-\s]*free\b/gi, ' ');
}

export function extractTattooAndBodyMarkingsEn(
  ...sources: Array<string | undefined | null>
): ExtractedTattooProfile {
  const combined = stripNegatedBodyMarkMentions(
    sources
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join(' . '),
  );

  if (
    !combined ||
    !/(?:hình\s*xăm|xăm\s*kín|xăm\s*mình|xăm\s*đầy|xăm\s*ở|xăm\s*trên|xăm\s*dọc|\btattoo\b|\btattoos\b|\btattooed\b|\bbody\s*ink\b|full[-\s]*sleeve\s*ink)/i.test(
      combined,
    )
  ) {
    return {
      hasTattoos: false,
      clauseEn: '',
      locations: [],
      needsOpenTorsoFraming: false,
      density: 'subtle',
    };
  }

  // Isolate local windows around each tattoo mention so unrelated words earlier in the sentence
  // (like "gương mặt điển trai nhiều hình xăm ở cổ và tay") don't produce false face-tattoo locations.
  const tattooWindows: string[] = [];
  const tattooAnchorRe =
    /(?:hình\s*xăm|xăm\s*kín|xăm\s*mình|xăm\s*đầy|xăm\s*ở|xăm\s*trên|xăm\s*dọc|tattooed|tattoos?|inked|full[-\s]*sleeve)/giu;
  let m: RegExpExecArray | null;
  while ((m = tattooAnchorRe.exec(combined)) !== null) {
    const start = Math.max(0, m.index - 22);
    const end = Math.min(combined.length, m.index + m[0].length + 72);
    // Stop window at sentence-ending punctuation after the match
    const afterSlice = combined.slice(m.index, end).split(/[.!?\n;]/)[0] || '';
    const beforeSlice = combined.slice(start, m.index).split(/[.!?\n;,]/).pop() || '';
    tattooWindows.push(`${beforeSlice}${afterSlice}`);
  }
  const scan = tattooWindows.join(' ; ') || combined;

  const isHeavy =
    /(?:dày\s*đặc|phủ\s*kín|xăm\s*kín|kín\s*(?:cổ|ngực|tay|cánh\s*tay|người|lưng)|toàn\s*thân|heavily\s*tattoo|dense\s*(?:intricate\s*)?tattoo|full[-\s]*sleeve|covered\s*in\s*(?:dense\s*)?tattoo|blackout\s*tattoo)/i.test(
      scan,
    );
  const isProminent =
    isHeavy ||
    /(?:nhiều\s*hình\s*xăm|nổi\s*bật|nghệ\s*thuật|dọc\s*cánh\s*tay|numerous\s*(?:visible\s*)?tattoo|prominent\s*tattoo|extensive\s*tattoo|multiple\s*tattoo)/i.test(
      scan,
    );

  const locations: string[] = [];
  const addLoc = (label: string) => {
    if (!locations.includes(label)) locations.push(label);
  };

  const hasWord = (expr: string): boolean =>
    new RegExp(`(?<![\\p{L}\\p{N}])(?:${expr})(?![\\p{L}\\p{N}])`, 'iu').test(scan);

  if (
    /(?:(?:hình\s*xăm|xăm)[^.;,\n]{0,28}(?:ở|trên|dưới|quanh)\s*(?:mặt|gò\s*má|trán|mắt|thái\s*dương)|(?:\b(?:face|facial|cheek|temple|teardrop|under-?eye)\s+tattoos?\b)|(?:\btattoos?\s+(?:on|across|under)\s+(?:the\s+)?(?:face|cheek|temple|eye)\b))/iu.test(
      scan,
    )
  ) {
    addLoc('face');
  }
  if (hasWord('cổ|yết\\s*hầu|gáy|neck|throat')) {
    addLoc('neck and throat');
  }
  if (hasWord('ngực|xương\\s*quai\\s*xanh|chest|collarbone|torso')) {
    addLoc('chest and collarbones');
  }
  if (hasWord('vai|shoulder|shoulders')) {
    addLoc('shoulders');
  }
  if (hasWord('cánh\\s*tay\\s*phải|right\\s*arm')) {
    addLoc('right arm (full sleeve)');
  } else if (hasWord('cánh\\s*tay\\s*trái|left\\s*arm')) {
    addLoc('left arm (full sleeve)');
  } else if (hasWord('cánh\\s*tay|kín\\s*tay|và\\s*tay|arms?|sleeves?')) {
    addLoc('arms');
  }
  if (hasWord('cẳng\\s*tay|forearms?')) {
    addLoc('forearms');
  }
  if (hasWord('bàn\\s*tay|mu\\s*bàn\\s*tay|ngón\\s*tay|cổ\\s*tay|hands?|knuckles?|fingers?|wrists?')) {
    addLoc('hands and wrists');
  }
  if (hasWord('lưng|back')) {
    addLoc('back');
  }

  const formatLocList = (items: string[]): string => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  };

  const locPhrase = formatLocList(locations);
  const densityPrefix = isHeavy
    ? 'heavily covered in dense, intricate dark tattoos'
    : isProminent
      ? 'prominent, clearly visible detailed tattoos'
      : 'distinctive clearly visible tattoos';

  const clauseEn = locPhrase
    ? `${densityPrefix} clearly visible across the ${locPhrase}`
    : `${densityPrefix} clearly visible on exposed skin`;

  const needsOpenTorsoFraming = locations.some((l) =>
    /(?:chest|collarbone|shoulder|arm|forearm|neck|throat)/i.test(l),
  );

  return {
    hasTattoos: true,
    clauseEn,
    locations,
    needsOpenTorsoFraming,
    density: isHeavy ? 'heavy' : isProminent ? 'prominent' : 'subtle',
  };
}

/**
 * Strictly enforces grounding against the character's authorized profile / equipped gear / scene text:
 * - Removes any stray/hallucinated `tattoo`, `neck tattoo`, `scar`, or `piercing` tags when NOT present
 *   in the authorized character profile or active scene injuries.
 * - Prevents Japanese culture drift (`kimono`, `yukata`, `katana`, `samurai`) in wuxia/xianxia contexts
 *   unless explicitly requested in the profile or scene.
 */
export function stripUnauthorizedBodyMarksAndCultureDriftEn(options: {
  prompt: string;
  authorizedText: string;
  isWuxiaOrXianxia?: boolean;
}): string {
  let out = String(options.prompt || '').trim();
  if (!out) return '';

  const auth = stripNegatedBodyMarkMentions(options.authorizedText || '');

  const allowTattoo =
    /(?:hình\s*xăm|xăm\s*kín|xăm\s*mình|xăm\s*đầy|xăm\s*ở|xăm\s*trên|xăm\s*dọc|\btattoos?\b|\btattooed\b|\bbody\s*ink\b|full[-\s]*sleeve\s*ink)/i.test(
      auth,
    );
  const allowScar =
    /(?:vết\s*sẹo|vết\s*thương\s*cũ|sẹo\s*(?:dài|nhỏ|ở|trên|ngang|chéo|mặt|má|mắt|trán|tay|ngực|lưng|cổ)|có\s*sẹo|\bscars?\b|\bscarred\b)/iu.test(
      auth,
    );
  const allowPiercing =
    /(?:khuyên\s*(?:mũi|môi|mày|lưỡi)|xỏ\s*khuyên|\bpiercings?\b|\bpierced\b|\bnose\s*ring\b|\blip\s*ring\b|\beyebrow\s*ring\b)/iu.test(
      auth,
    );

  // Split by comma clauses first so we can cleanly drop whole unauthorized mark tags without leaving broken fragments
  let segments = out
    .split(/\s*,\s*/)
    .map((seg) => seg.trim())
    .filter(Boolean);

  if (!allowTattoo) {
    segments = segments
      .map((seg) => {
        if (/\b(?:no|without)\s+tattoos?\b/i.test(seg)) return seg;
        if (
          /^(?:heavily\s+covered\s+in\s+|prominent\s+|distinctive\s+|dense\s+|intricate\s+|detailed\s+|visible\s+|numerous\s+|full[-\s]*sleeve\s+|openly\s+showing\s+|revealing\s+|with\s+)?(?:dark\s+|ink\s+|black\s+|artistic\s+|neck\s+|throat\s+|chest\s+|arm\s+|forearm\s+|hand\s+|shoulder\s+|face\s+|facial\s+|back\s+|body\s+|sleeve\s+)*(?:tattoos?|tattooed|body\s+ink)(?:\b.*)?$/i.test(
            seg,
          )
        ) {
          return '';
        }
        return seg
          .replace(
            /\b(?:heavily\s+covered\s+in\s+|with\s+|showing\s+|revealing\s+)?(?:dense\s+|intricate\s+|detailed\s+|visible\s+|prominent\s+|distinctive\s+|numerous\s+|dark\s+|ink\s+|artistic\s+|full[-\s]*sleeve\s+|neck\s+|throat\s+|chest\s+|arm\s+|forearm\s+|hand\s+|shoulder\s+|face\s+|facial\s+|back\s+|body\s+|sleeve\s+)*(?:tattoos?|tattooed|body\s+ink)(?:\s+(?:across|along|on|over|covering)\s+(?:the\s+)?(?:left\s+|right\s+)?(?:neck|throat|chest|collarbones?|shoulders?|arms?|forearms?|hands?|wrists?|face|cheek|back|exposed\s+skin)(?:\s*(?:,|and)\s*(?:the\s+)?(?:left\s+|right\s+)?(?:neck|throat|chest|collarbones?|shoulders?|arms?|forearms?|hands?|wrists?|face|cheek|back))*)?/gi,
            '',
          )
          .replace(/\b(?:ink\s+details\s+of\s+all\s+tattoos)\b/gi, '');
      })
      .filter((s) => s.trim().length > 0);
  }

  if (!allowScar) {
    segments = segments
      .map((seg) => {
        if (/\b(?:no|without)\s+scars?\b/i.test(seg)) return seg;
        if (
          /^(?:with\s+|a\s+)?(?:faint\s+|small\s+|thin\s+|long\s+|old\s+|battle\s+|distinctive\s+|prominent\s+|visible\s+|facial\s+|cheek\s+|forehead\s+|eye\s+|chin\s+|lip\s+|chest\s+|arm\s+)*(?:scars?|scarred)(?:\s+(?:across|on|over|along|under|near|above)\s+[\w\s-]+)?$/i.test(
            seg,
          )
        ) {
          return '';
        }
        return seg.replace(
          /\b(?:with\s+(?:a\s+)?)?(?:faint\s+|small\s+|thin\s+|long\s+|old\s+|battle\s+|distinctive\s+|prominent\s+|visible\s+|facial\s+|cheek\s+|forehead\s+|eye\s+)*(?:scars?|scarred)(?:\s+(?:across|on|over|along|under|near|above)\s+(?:the\s+)?(?:left\s+|right\s+)?(?:cheek|face|eye|brow|eyebrow|forehead|chin|lip|nose|neck|chest|arm|forearm|shoulder|hand))?/gi,
          '',
        );
      })
      .filter((s) => s.trim().length > 0);
  }

  if (!allowPiercing) {
    segments = segments
      .map((seg) => {
        if (/\b(?:no|without)\s+piercings?\b/i.test(seg)) return seg;
        if (
          /^(?:with\s+)?(?:subtle\s+|small\s+|silver\s+|metal\s+|nose\s+|lip\s+|eyebrow\s+|facial\s+)*(?:piercings?|nose\s+ring|lip\s+ring|eyebrow\s+ring)$/i.test(
            seg,
          )
        ) {
          return '';
        }
        return seg.replace(
          /\b(?:subtle\s+|small\s+|silver\s+|metal\s+|nose\s+|lip\s+|eyebrow\s+|facial\s+)*(?:piercings?|nose\s+ring|lip\s+ring|eyebrow\s+ring)\b/gi,
          '',
        );
      })
      .filter((s) => s.trim().length > 0);
  }

  if (options.isWuxiaOrXianxia) {
    const allowJapaneseAttire =
      /(?:kimono|yukata|hakama|haori|hòa\s*phục|nhật\s*bản|japanese|đông\s*doanh)/iu.test(
        auth,
      );
    const allowJapaneseWeapon =
      /(?:katana|wakizashi|tanto|odachi|samurai|võ\s*sĩ\s*đạo|nhật\s*đao|đông\s*doanh)/iu.test(
        auth,
      );
    const hasAuthorizedWeapon =
      /(?:kiếm|đao|bổng|thương|kích|tiêu|cung|ám\s*khí|binh\s*khí|thần\s*binh|vũ\s*khí|pháp\s*bảo|phi\s*kiếm|sword|jian|saber|blade|spear|staff|halberd|bow|dagger|weapon|fan)/iu.test(
        auth,
      );
    const hasChineseGarmentAlready = segments.some((s) =>
      /\b(?:hanfu|martial\s+robes?|taoist\s+robes?|wuxia\s+robes?|sect\s+robes?|armor|traditional\s+chinese)\b/i.test(
        s,
      ),
    );

    segments = segments
      .map((seg) => {
        let next = seg;
        if (!allowJapaneseAttire) {
          if (/\b(?:kimono|yukata|hakama|haori|japanese\s+robes?)\b/i.test(next)) {
            next = hasChineseGarmentAlready
              ? next.replace(
                  /\b(?:traditional\s+|silk\s+|ornate\s+|flowing\s+|dark\s+|white\s+|black\s+|red\s+|blue\s+)?(?:kimono|yukata|hakama|haori|japanese\s+robes?)\b/gi,
                  '',
                )
              : next.replace(
                  /\b(?:kimono|yukata|hakama|haori|japanese\s+robes?)\b/gi,
                  'traditional Chinese hanfu robes',
                );
          }
          next = next.replace(/\bobi\s+sash\b/gi, 'woven silk waist sash');
        }
        if (!allowJapaneseWeapon) {
          if (/\b(?:katana|wakizashi|odachi|samurai\s+sword)\b/i.test(next)) {
            next = hasAuthorizedWeapon
              ? next.replace(
                  /\b(?:katana|wakizashi|odachi|samurai\s+sword)\b/gi,
                  'Chinese jian sword',
                )
              : next.replace(
                  /\b(?:holding\s+(?:a\s+)?)?(?:sheathed\s+|unsheathed\s+|drawn\s+)?(?:katana|wakizashi|odachi|samurai\s+sword)\b/gi,
                  '',
                );
          }
          next = next.replace(/\bsamurai\b/gi, 'wuxia martial artist');
        }
        return next.trim();
      })
      .filter((s) => s.length > 0);
  }

  out = segments
    .join(', ')
    .replace(/\b(?:with|and|or|wearing|accented\s+by)\s*(?=[,.;]|$)/gi, '')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;.-]+|[\s,;.-]+$/g, '')
    .trim();

  return out;
}

/**
 * Builds a structured, anti-same-face English identity + outfit block for a single character.
 * Places the highest-signal identity traits FIRST:
 *   [Name / Real-Person Likeness] -> [Explicit Hair Color & Hairstyle] -> [Facial Features / Authentic Likeness]
 *   -> [Build & Youthful/Personal Vibe] -> [Tattoos & Distinctive Body Markings] -> [Outfit & Accessories]
 * Protects explicit profile hair color & youthful appearance from conflicting stale locks.
 */
export function buildStructuredCharacterIdentityEn(
  input?: Partial<StructuredCharacterPromptInput> | null,
  collisionAvoidanceSalt = 0,
): StructuredCharacterPromptOutput {
  const safeInput = input || {};
  const canonicalName = String(safeInput.canonicalName ?? '').trim();
  const knownDisplayAlias = String(safeInput.knownDisplayAlias ?? '').trim();
  const isKnownRealPerson = Boolean(safeInput.isKnownRealPerson);
  const genderWord: 'man' | 'woman' | 'person' =
    safeInput.genderWord === 'man' || safeInput.genderWord === 'woman'
      ? safeInput.genderWord
      : 'person';
  const roleStr = String(safeInput.role ?? '').trim();
  const appearanceStr = String(safeInput.appearance ?? '').trim();
  const fashionStyleStr = String(safeInput.fashionStyle ?? '').trim();
  const personalityStr = String(safeInput.personality ?? '').trim();
  const signatureStr = String(safeInput.signature ?? '').trim();
  const ageCueStr = String(safeInput.ageCue ?? '').trim();
  const ageNum =
    typeof safeInput.ageNum === 'number' && Number.isFinite(safeInput.ageNum)
      ? safeInput.ageNum
      : undefined;
  const skinAgeCueStr = String(safeInput.skinAgeCue ?? '').trim();
  const worldGenreHintStr = String(safeInput.worldGenreHint ?? '').trim();
  const avatarVisualLockStr = String(safeInput.avatarVisualLock ?? '').trim();

  const h = hashCharacterKey(`${canonicalName}::${roleStr}::${genderWord}`);
  const safeSalt = Number.isFinite(collisionAvoidanceSalt)
    ? Math.max(0, Math.floor(collisionAvoidanceSalt))
    : 0;
  const idx = (h + safeSalt) >>> 0;
  const isFemale = genderWord === 'woman';
  const isAncient = isAncientOrFantasyWorld(
    `${worldGenreHintStr} ${roleStr} ${appearanceStr} ${fashionStyleStr}`,
  );

  // Extract explicit hair color/style from profile FIRST so stale locks can never override it
  const profileHair = extractExplicitHairProfileEn(
    appearanceStr,
    fashionStyleStr,
    signatureStr,
  );

  // 1) Translate & clean explicit user/Vision-locked traits (filtering conflicting hair colors & over-aging!)
  const sanitizeLockPiece = (rawPiece: string): string => {
    const tr = translateVietnameseVisualToEnglish(rawPiece);
    const hairSafe = profileHair.colorFamily
      ? stripConflictingHairColorsFromText(tr, profileHair.colorFamily).cleaned
      : tr;
    return stripOverAgingWordsFromText(hairSafe, ageNum).cleaned;
  };

  const lockParts: string[] = [];
  const lk = safeInput.identityLock;
  if (safeInput.lockAvatarIdentity !== false) {
    const fixedTags = String(lk?.fixedTags ?? '').trim();
    const facialFeatures = String(lk?.facialFeatures ?? '').trim();
    const hairstyle = String(lk?.hairstyle ?? '').trim();
    // If profile explicitly names hair color/style, let profileHair lead and keep lock hairstyle only if compatible
    if (hairstyle) {
      const cleanedHairLock = sanitizeLockPiece(hairstyle);
      if (cleanedHairLock) lockParts.push(cleanedHairLock);
    }
    if (facialFeatures) {
      const cleanedFaceLock = sanitizeLockPiece(facialFeatures);
      if (cleanedFaceLock) lockParts.push(cleanedFaceLock);
    }
    if (fixedTags) {
      const cleanedFixed = sanitizeLockPiece(fixedTags);
      if (cleanedFixed) lockParts.push(cleanedFixed);
    }
    if (!lockParts.length && avatarVisualLockStr) {
      const cleanedAvatarLock = sanitizeLockPiece(avatarVisualLockStr);
      if (cleanedAvatarLock) lockParts.push(cleanedAvatarLock);
    }
  }

  const preserveList = [canonicalName, knownDisplayAlias].filter(Boolean);
  const translatedAppearance = stripResidualVietnameseFromEnglishClause(
    translateVietnameseVisualToEnglish(appearanceStr),
    preserveList,
  );
  // Distill clean visual demeanor/aura from personality instead of leaking non-visual Vietnamese prose
  const distilledAura = distillVisualAuraFromProfileTextEn(
    personalityStr,
    signatureStr,
  );
  const translatedPersonality =
    distilledAura ||
    (!VIET_DIACRITIC_RE.test(personalityStr)
      ? stripResidualVietnameseFromEnglishClause(personalityStr, preserveList)
      : '');
  // Extract visual-only traits from signature (accessories, marks, style), avoiding social/backstory fragments
  const rawTranslatedSignature = stripResidualVietnameseFromEnglishClause(
    translateVietnameseVisualToEnglish(signatureStr),
    preserveList,
  );
  const translatedSignature =
    rawTranslatedSignature &&
    /\b(?:tattoo|scar|piercing|earring|necklace|ring|bracelet|glasses|sunglasses|watch|hat|beanie|cap|mole|beauty\s*mark|dimple|freckles|hair|eyes|lips|smile|smirk|lipstick|boots|heels|jacket|dress|jumpsuit|suit|shirt|coat|scarf|fan|sword|jade|aura|gaze|poise|charm|charisma|presence|curves|waist|skin)\b/i.test(
      rawTranslatedSignature,
    )
      ? rawTranslatedSignature
      : '';
  const translatedOutfit = stripResidualVietnameseFromEnglishClause(
    translateVietnameseVisualToEnglish(
      fashionStyleStr || String(lk?.signatureStyle ?? '').trim(),
    ),
    preserveList,
  );

  const mergedTraitText = [
    profileHair.hairClauseEn,
    ...lockParts,
    translatedAppearance,
    translatedPersonality,
    translatedSignature,
  ]
    .filter(Boolean)
    .join(', ');

  const hasFaceDetail =
    /\b(?:face|jawline|jaw|cheekbones|eyes|eyebrows|brows|nose|lips|beard|mustache|stubble|dimple|scar|beauty\s*mark|likeness)\b/i.test(
      mergedTraitText,
    );
  const hasHairDetail =
    profileHair.hasExplicitHair ||
    /\b(?:hair|hairstyle|bangs|ponytail|bun|topknot|bob|undercut|wavy|curly|parted|fringe|cropped|braid|buzzcut)\b/i.test(
      mergedTraitText,
    );
  const hasBuildOrAura =
    /\b(?:build|physique|frame|posture|shoulders|slender|athletic|tall|lean|aura|presence|demeanor|charisma|elegance|punk-rock|aesthetic)\b/i.test(
      mergedTraitText,
    );
  const hasSkinDetail =
    /\b(?:pores|skin\s+texture|expression\s+lines|smile\s+lines|laugh\s+lines|wrinkles)\b/i.test(
      mergedTraitText,
    );
  const hasOutfitDetail =
    Boolean(translatedOutfit) ||
    /\b(?:wearing|shirt|jacket|coat|dress|robe|robes|hanfu|ao\s*dai|hoodie|sweater|t-shirt|tank\s*top|jeans|trousers|skirt|uniform|armor|suit|blazer|cardigan|tunic|gown)\b/i.test(
      mergedTraitText,
    );

  // Fill any missing visual dimensions with deterministic unique traits ONLY for unnamed/fictional NPCs
  // IMPORTANT: Always use unsigned right shift (>>>) and pickFromPool so bit-31 hashes NEVER produce negative indices!
  const facePool = isFemale ? FEMALE_FACE_POOL : MALE_FACE_POOL;
  const hairPool = isFemale ? FEMALE_HAIR_POOL : MALE_HAIR_POOL;
  const auraPool = isFemale ? BUILD_AURA_FEMALE_POOL : BUILD_AURA_MALE_POOL;
  const outfitPool = isAncient
    ? isFemale
      ? OUTFIT_ANCIENT_FEMALE_POOL
      : OUTFIT_ANCIENT_MALE_POOL
    : isFemale
      ? OUTFIT_MODERN_FEMALE_POOL
      : OUTFIT_MODERN_MALE_POOL;

  const subjectChunks: string[] = [];

  // 1) HIGHEST PRIORITY LEAD: Name (+ real-person alias if known) + youthful/accurate age + gender
  const displayName =
    canonicalName &&
    knownDisplayAlias &&
    knownDisplayAlias.toLowerCase() !== canonicalName.toLowerCase()
      ? `${canonicalName} (${knownDisplayAlias})`
      : canonicalName;
  const ageGenderHeader = [ageCueStr, genderWord].filter(Boolean).join(' ');
  const subjectLead = displayName
    ? isKnownRealPerson
      ? `${displayName}, authentic recognizable likeness of ${displayName}, a ${ageGenderHeader || 'distinct individual'}`
      : `${displayName}, a ${ageGenderHeader || 'distinct individual'}`
    : `a ${ageGenderHeader || 'distinct individual'}`;
  subjectChunks.push(subjectLead);

  // 2) IMMEDIATELY FRONT-LOAD HAIR COLOR & HAIRSTYLE (first high-weight visual tokens!)
  if (profileHair.hasExplicitHair && profileHair.hairClauseEn) {
    subjectChunks.push(`with ${profileHair.hairClauseEn}`);
  }

  // 3) DISTINCTIVE FACIAL FEATURES / LOCKED IDENTITY
  const cleanedLockStr = stripResidualVietnameseFromEnglishClause(
    lockParts.filter(Boolean).join(', '),
    preserveList,
  );
  if (cleanedLockStr) {
    subjectChunks.push(cleanedLockStr);
  }

  // 4) PROFILE APPEARANCE (clean, without duplicating hair phrase if already front-loaded)
  if (
    translatedAppearance &&
    (!cleanedLockStr || translatedAppearance.length > 16)
  ) {
    if (
      !cleanedLockStr ||
      !cleanedLockStr
        .toLowerCase()
        .includes(translatedAppearance.toLowerCase().slice(0, 24))
    ) {
      let dedupedAppearance = translatedAppearance;
      if (profileHair.hairClauseEn) {
        const escapedHair = profileHair.hairClauseEn.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        dedupedAppearance = dedupedAppearance
          .replace(new RegExp(escapedHair, 'gi'), '')
          .replace(/\s*,\s*(?:,\s*)+/g, ', ')
          .replace(/^[,;\s]+|[,;\s]+$/g, '')
          .trim();
      }
      if (dedupedAppearance) {
        subjectChunks.push(dedupedAppearance);
      }
    }
  }

  // 5) HIGH-PRIORITY TATTOO & BODY-MARKING ANCHOR — ONLY from real profile text (never stale locks!)
  const tattooProfile = extractTattooAndBodyMarkingsEn(
    appearanceStr,
    fashionStyleStr,
    signatureStr,
  );
  if (tattooProfile.hasTattoos && tattooProfile.clauseEn) {
    const existingSoFar = subjectChunks.join(' ').toLowerCase();
    const missingAnyLocation = tattooProfile.locations.some((loc) => {
      const keyWord = loc.split(/[\s(]/)[0]?.toLowerCase() || '';
      return keyWord && !existingSoFar.includes(keyWord);
    });
    if (!/\btattoo/i.test(existingSoFar) || missingAnyLocation) {
      subjectChunks.push(tattooProfile.clauseEn);
    }
  }

  // 6) FALLBACK FACIAL TRAITS — NEVER overwrite a known real celebrity's face with random pool eyes/jaw!
  if (!hasFaceDetail) {
    if (isKnownRealPerson) {
      subjectChunks.push(
        'faithful true-to-life facial features, youthful energetic expression, natural eye color and distinctive bone structure',
      );
    } else {
      subjectChunks.push(pickFromPool(facePool, idx));
    }
  }
  if (!hasHairDetail) {
    subjectChunks.push(pickFromPool(hairPool, idx >>> 2));
  }
  if (!hasBuildOrAura) {
    const pickedAura = pickFromPool(auraPool, idx >>> 4);
    const aura = translatedPersonality
      ? `${pickedAura} (${translatedPersonality})`
      : pickedAura;
    if (aura) subjectChunks.push(aura);
  }
  if (!hasSkinDetail && skinAgeCueStr) {
    const safeSkinCue = stripOverAgingWordsFromText(skinAgeCueStr, ageNum).cleaned;
    if (safeSkinCue) {
      subjectChunks.push(safeSkinCue);
    }
  }

  let outfitAccessories = '';
  if (translatedOutfit) {
    outfitAccessories = `wearing ${translatedOutfit}`;
  } else if (!hasOutfitDetail) {
    const pickedOutfit = pickFromPool(outfitPool, idx >>> 3);
    if (pickedOutfit) {
      outfitAccessories = `wearing ${pickedOutfit}`;
    }
  }
  if (
    translatedSignature &&
    !subjectChunks
      .join(' ')
      .toLowerCase()
      .includes(translatedSignature.toLowerCase().slice(0, 18)) &&
    !outfitAccessories
      .toLowerCase()
      .includes(translatedSignature.toLowerCase().slice(0, 18))
  ) {
    outfitAccessories = outfitAccessories
      ? `${outfitAccessories}, accented by ${translatedSignature}`
      : `distinctive detail: ${translatedSignature}`;
  }

  const authorizedIdentitySource = [
    appearanceStr,
    fashionStyleStr,
    signatureStr,
    personalityStr,
    roleStr,
  ]
    .filter(Boolean)
    .join(' ');

  const subjectIdentity = stripUnauthorizedBodyMarksAndCultureDriftEn({
    prompt: reconcilePortraitContradictionsEn(
      subjectChunks
        .map((s) => String(s ?? '').replace(/^[,;\s]+|[,;\s]+$/g, ''))
        .filter(Boolean)
        .join(', '),
    ),
    authorizedText: authorizedIdentitySource,
    isWuxiaOrXianxia: isAncient,
  });

  const combinedClause = stripUnauthorizedBodyMarksAndCultureDriftEn({
    prompt: reconcilePortraitContradictionsEn(
      [subjectIdentity, outfitAccessories].filter(Boolean).join(', '),
    ),
    authorizedText: authorizedIdentitySource,
    isWuxiaOrXianxia: isAncient,
  });

  return {
    name: canonicalName,
    genderWord,
    subjectIdentity,
    outfitAccessories,
    combinedClause,
    usedHashIndex: idx % facePool.length,
  };
}

/**
 * Ensures multiple characters in the same scene have guaranteed distinct face/hair/outfit
 * archetypes and adds explicit anti-same-face differentiation phrasing.
 */
export function buildDistinctCharacterGroupEn(
  inputs?: Array<Partial<StructuredCharacterPromptInput> | null | undefined> | null,
): {
  entries: StructuredCharacterPromptOutput[];
  groupParagraph: string;
} {
  const safeInputs = Array.isArray(inputs) ? inputs : [];
  const usedBuckets = new Set<number>();
  const entries: StructuredCharacterPromptOutput[] = [];

  for (const item of safeInputs) {
    if (!item) continue;
    let salt = 0;
    let built = buildStructuredCharacterIdentityEn(item, salt);
    while (usedBuckets.has(built.usedHashIndex) && salt < 6) {
      salt += 1;
      built = buildStructuredCharacterIdentityEn(item, salt);
    }
    usedBuckets.add(built.usedHashIndex);
    entries.push(built);
  }

  if (entries.length === 0) {
    return { entries: [], groupParagraph: '' };
  }

  if (entries.length === 1) {
    return {
      entries,
      groupParagraph: entries[0].combinedClause,
    };
  }

  const labeled = entries.map(
    (entry, idx) => `Character ${idx + 1} (${entry.combinedClause})`,
  );
  const groupParagraph = `${labeled.join('; ')}, with each individual having unmistakably distinct facial bone structure, contrasting hairstyle, unique clothing, and separate personal aura`;

  return { entries, groupParagraph };
}

/**
 * Produces an English-safe style description/name from a StoryImageStylePreset so
 * templates using `${image_style_name}` or `${image_style_description}` never inject
 * raw Vietnamese into the final English prompt.
 */
export function resolveEnglishStyleTokens(
  style?: Partial<StoryImageStylePreset> | null,
): {
  englishName: string;
  englishDescription: string;
  englishGuide: string;
} {
  const safeStyle = style || {};
  const englishGuide = String(
    safeStyle.promptGuide ?? safeStyle.promptHint ?? '',
  ).trim();
  const rawName = String(safeStyle.label ?? '').trim();
  const rawDesc = String(safeStyle.description ?? '').trim();

  // If style label/description are already pure English, keep them; otherwise distill cleanly from promptGuide
  const guideHead = englishGuide
    .split(',')
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);

  const englishName =
    rawName && !VIET_DIACRITIC_RE.test(rawName)
      ? rawName
      : guideHead[0] || 'cinematic visual style';

  const englishDescription =
    rawDesc && !VIET_DIACRITIC_RE.test(rawDesc)
      ? rawDesc
      : guideHead.slice(0, 4).join(', ') || englishGuide || englishName;

  return {
    englishName,
    englishDescription,
    englishGuide: englishGuide || englishDescription,
  };
}

/**
 * Adapts a style preset specifically for Character Portraits so the user's chosen
 * visual medium (realistic photo, painting, anime CG, manhua, ink wash, 3D, etc.)
 * is respected WITHOUT heavy cinema/movie-set artifacts ("cinematic film still",
 * "35mm anamorphic lens", "dramatic cinematic color grading", "movie set", "VFX",
 * "widescreen") overpowering facial identity, tattoos, scars, hair, or accessories.
 */
export function resolvePortraitStyleGuideEn(
  style?: Partial<StoryImageStylePreset> | null,
): string {
  const safeStyle = style || {};
  const styleId = String(safeStyle.id ?? '').trim().toLowerCase();
  const tokens = resolveEnglishStyleTokens(safeStyle);

  // Realistic / live-action styles: use clean, authentic natural portrait photography
  // instead of movie-still / anamorphic / heavy cinema color-grading cues.
  if (
    styleId === 'live_action_cinema' ||
    styleId === 'cinema_still_vfx' ||
    !styleId
  ) {
    return 'natural authentic editorial portrait photography, crisp photorealistic human skin texture with subtle pores, true-to-life natural colors, clean sharp focus on facial features, hair, and clothing details, realistic fabric weave, no heavy cinematic color grading, no anamorphic lens distortion, no movie-set effects, no anime or cartoon look';
  }

  // For other art styles (painting, anime CG, manhua, ink wash, 3D, ukiyo-e, custom),
  // preserve the core art medium while stripping overpowering cinema/film-set phrasing.
  let adapted = String(tokens.englishGuide ?? '');
  const cinemaStripPatterns: Array<[RegExp, string]> = [
    [/\blive-?action\s+cinematic\s+film\s+still\b/gi, 'natural photorealistic portrait'],
    [/\bmasterpiece\s+cinematic\s+film\s+still\b/gi, 'refined portrait illustration'],
    [/\bblockbuster\s+cinema\s+still\b/gi, 'detailed portrait'],
    [/\bcinematic\s+film\s+still\b/gi, 'detailed portrait'],
    [/\bcinema\s+still\b/gi, 'detailed portrait'],
    [/\b35mm\s+anamorphic\s+lens\b/gi, 'natural 50mm portrait lens'],
    [/\banamorphic\s+lens\b/gi, 'natural portrait lens'],
    [/\bdramatic\s+cinematic\s+color\s+grading\b/gi, 'clean balanced natural color palette'],
    [/\bcinematic\s+color\s+grading\b/gi, 'clean balanced color palette'],
    [/\bmovie\s+set\b/gi, 'clean uncluttered backdrop'],
    [/\bfilm\s+set\b/gi, 'clean uncluttered backdrop'],
    [/\bIMAX\s+wide\s+cinematic\s+camera\s+angle\b/gi, 'clear front-facing portrait framing'],
    [/\bwidescreen\s+dramatic\s+framing\b/gi, 'balanced portrait framing'],
    [/\bhollywood-?grade\s+VFX\b/gi, 'crisp fine detail'],
    [/\bvolumetric\s+god\s+rays\b/gi, ''],
    [/\bepic\s+atmospheric\s+scale\b/gi, ''],
    [/\brealistic\s+motion\s+blur\s+and\s+lens\s+optics\b/gi, 'crisp sharp subject focus'],
    [/\bcinematic\s+anime\s+movie\s+key\s+visual\s+quality\b/gi, 'high-detail stylized character portrait'],
    [/\bepic\s+cinematic\s+lighting\b/gi, 'clean balanced portrait lighting'],
    [/\bdramatic\s+cinematic\s+lighting\b/gi, 'clean balanced portrait lighting'],
    [/\bcinematic\s+lighting\b/gi, 'balanced portrait lighting'],
    [/\brealistic\s+cinema\s+lighting\b/gi, 'clean neutral studio lighting'],
    [/\brich\s+jewel\s+and\s+ink-toned\s+cinema\s+palette\b/gi, 'refined natural tonal palette'],
    [/\bcinematic\b/gi, 'refined'],
  ];

  for (const [re, rep] of cinemaStripPatterns) {
    adapted = adapted.replace(re, rep);
  }

  adapted = adapted
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/^[,;\s]+|[,;\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return (
    adapted ||
    'natural authentic portrait style with crisp focus on character identity, hair, and clothing details'
  );
}

/**
 * Composes one cohesive, fluent, natural English prompt following the 4-part structure:
 *   [Subject & Fixed Character Identity] + [Signature Outfit & Accessories]
 *   + [Action, Expression & Camera Framing] + [Setting, Atmosphere & Lighting in Selected Style]
 */
export function composeCohesiveEnglishImagePrompt(options?: {
  headcountLock?: string;
  characterGroupText?: string;
  actionExpressionText?: string;
  cameraFramingGuide?: string;
  settingLocation?: string;
  lightingAtmosphere?: string;
  styleGuide?: string;
  extraConstraints?: string;
  cameraAngle?: ImageCameraAngleId;
  preserveNames?: string[];
} | null): string {
  const safeOptions = options || {};
  const {
    headcountLock,
    characterGroupText,
    actionExpressionText,
    cameraFramingGuide,
    settingLocation,
    lightingAtmosphere,
    styleGuide,
    extraConstraints,
    preserveNames = [],
  } = safeOptions;

  const cleanClause = (raw?: string | null): string => {
    const str = String(raw ?? '');
    if (!str.trim()) return '';
    const translated = translateVietnameseVisualToEnglish(str);
    const stripped = stripResidualVietnameseFromEnglishClause(
      translated,
      preserveNames,
    );
    return String(stripped ?? '')
      .replace(/^[,;.\s]+|[,;.\s]+$/g, '')
      .trim();
  };

  const sentences: string[] = [];

  // Part 1 & 2: Subject, Locked Identity & Signature Outfit/Accessories
  const head = cleanClause(headcountLock);
  const chars = cleanClause(characterGroupText);
  if (head && chars) {
    sentences.push(`${head}, featuring ${chars}`);
  } else if (chars) {
    sentences.push(`Featuring ${chars}`);
  } else if (head) {
    sentences.push(head);
  }

  // Part 3: Action, Expression & Camera Framing
  const action = cleanClause(actionExpressionText);
  const framing = cleanClause(cameraFramingGuide);
  if (action && framing) {
    sentences.push(`Captured ${action}, framed with ${framing}`);
  } else if (action) {
    sentences.push(`Captured ${action}`);
  } else if (framing) {
    sentences.push(`Framed with ${framing}`);
  }

  // Part 4: Setting, Atmosphere, Lighting & Selected Art Style
  const loc = cleanClause(settingLocation);
  const light = cleanClause(lightingAtmosphere);
  const style = cleanClause(styleGuide);
  const envParts: string[] = [];
  if (loc) envParts.push(`set in ${loc}`);
  if (light) envParts.push(`illuminated by ${light}`);
  if (style) envParts.push(`rendered in ${style}`);
  if (envParts.length) {
    const envSentence = envParts.join(', ');
    sentences.push(
      envSentence.charAt(0).toUpperCase() + envSentence.slice(1),
    );
  }

  const extra = cleanClause(extraConstraints);
  if (extra) {
    sentences.push(extra);
  }

  return sentences
    .filter(Boolean)
    .join('. ')
    .replace(/\s*\.\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
