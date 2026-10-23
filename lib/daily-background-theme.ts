/**
 * Daily User Background Theme Generator
 *
 * Computes a unique, deterministic Interference Ribbons theme for each logged-in user
 * that changes automatically every day.
 */

export interface DailyBackgroundConfig {
  seed: string;
  dateKey: string;
  themeName: string;
  themeTag: string;
  colors: [string, string];
  wires: number;
  lineWidth: number;
  ribbonWidth: number;
  amplitude: number;
  waveLength: number;
  angle: number;
  twist: number;
  curl: number;
  depth: number;
  stripes: number;
  colorFlow: number;
  glow: number;
  intensity: number;
  speed: number;
  spin: number;
  description: string;
}

// Curated luxury neon & cyber color pairs specifically tested for deep dark surfaces (#060606)
const PALETTES: Array<{ name: string; tag: string; colors: [string, string]; description: string }> = [
  {
    name: "Cực Quang Tím Hồng",
    tag: "Mystic Aurora",
    colors: ["#7928CA", "#FF0080"],
    description: "Sắc tím vũ trụ hòa quyện ánh hồng neon tràn ngập ma lực.",
  },
  {
    name: "Sóng Lôi Điện Cyber",
    tag: "Electric Neon",
    colors: ["#00F0FF", "#7000FF"],
    description: "Dải xung điện cyan và tím thẫm băng qua không gian số.",
  },
  {
    name: "Lam Ngọc & Bạc Hà",
    tag: "Cyan Mint",
    colors: ["#00F5D4", "#00BBF9"],
    description: "Làn gió ngọc bích tươi mát mang năng lượng hồi sinh tươi mới.",
  },
  {
    name: "Ngân Hà Hồng Ngọc",
    tag: "Ruby Nebula",
    colors: ["#FF0A54", "#FF758F"],
    description: "Dải lụa nhung hồng ruby rực rỡ và quyến rũ.",
  },
  {
    name: "Bão Mặt Trời",
    tag: "Solar Flare",
    colors: ["#FF5400", "#FFBD00"],
    description: "Năng lượng hoàng kim và lửa cam thiêu đốt nhiệt huyết chiến đấu.",
  },
  {
    name: "Bạch Kim Vô Cực",
    tag: "Infinite Titanium",
    colors: ["#FFFFFF", "#94A3B8"],
    description: "Tối giản thượng lưu, tinh khiết như ánh trăng trên đỉnh núi tuyết.",
  },
  {
    name: "Ma Trận Ngọc Lục Bảo",
    tag: "Emerald Matrix",
    colors: ["#10B981", "#06B6D4"],
    description: "Lục bảo huyền bí kết hợp lam sâu thăm thẳm.",
  },
  {
    name: "Tử Đinh Hương Huyền Ảo",
    tag: "Lilac Velvet",
    colors: ["#8B5CF6", "#EC4899"],
    description: "Dải ruy băng nhung tím mộng mơ cuốn lấy tâm trí.",
  },
  {
    name: "Biển Sâu Dạ Quang",
    tag: "Abyss Glow",
    colors: ["#2563EB", "#38BDF8"],
    description: "Ánh sáng sinh học phát ra từ rãnh đại dương ngàn mét.",
  },
  {
    name: "Hổ Phách Hoàng Gia",
    tag: "Royal Amber",
    colors: ["#D97706", "#F59E0B"],
    description: "Sắc hổ phách quyền quý mang lại may mắn và thịnh vượng.",
  },
  {
    name: "Hoa Anh Đào Bóng Đêm",
    tag: "Midnight Sakura",
    colors: ["#F43F5E", "#A855F7"],
    description: "Cánh hoa đào bay lượn giữa bầu trời đêm lấp lánh sao.",
  },
  {
    name: "Lăng Kính Pha Lê",
    tag: "Prism Crystal",
    colors: ["#38BDF8", "#F472B6"],
    description: "Ánh sáng khúc xạ tán sắc qua viên kim cương đa diện.",
  },
];

/** FNV-1a 32-bit hash */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Format date as YYYY-MM-DD */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Computes deterministic daily background theme for a specific user.
 * @param userId User's id or guest id
 * @param date Target date (defaults to today)
 */
export function getDailyThemeForUser(
  userId: string | null | undefined,
  date: Date = new Date()
): DailyBackgroundConfig {
  const effectiveUserId = (userId && userId.trim()) || "guest-wanderer";
  const dateKey = getLocalDateKey(date);
  const seedString = `${effectiveUserId}@${dateKey}`;
  const seedHash = hashString(seedString);
  const rand = mulberry32(seedHash);

  // Pick palette
  const paletteIndex = Math.floor(rand() * PALETTES.length);
  const palette = PALETTES[paletteIndex];

  // Procedural geometry variations
  const wires = Math.round(54 + rand() * 38); // 54 - 92 strands
  const lineWidth = +(1.4 + rand() * 0.5).toFixed(2); // 1.4 - 1.9 px
  const ribbonWidth = +(0.21 + rand() * 0.08).toFixed(2); // 0.21 - 0.29
  const amplitude = +(0.5 + rand() * 0.22).toFixed(2); // 0.5 - 0.72
  const waveLength = +(0.85 + rand() * 0.35).toFixed(2); // 0.85 - 1.2
  // Angle: mostly elegant diagonal (either 32 to 58 deg or -32 to -58 deg)
  const angleSign = rand() > 0.35 ? 1 : -1;
  const angle = Math.round(angleSign * (32 + rand() * 26));
  const twist = +(1.3 + rand() * 1.1).toFixed(2); // 1.3 - 2.4 turns
  const curl = +(0.18 + rand() * 0.16).toFixed(2); // 0.18 - 0.34
  const depth = +(0.62 + rand() * 0.15).toFixed(2); // 0.62 - 0.77
  const stripes = +(1.8 + rand() * 1.4).toFixed(2); // 1.8 - 3.2
  const colorFlow = +(0.03 + rand() * 0.03).toFixed(3);
  const glow = +(0.42 + rand() * 0.2).toFixed(2);
  const intensity = +(0.95 + rand() * 0.25).toFixed(2);
  const speed = +(0.6 + rand() * 0.25).toFixed(2);
  const spin = +(0.28 + rand() * 0.16).toFixed(2);

  return {
    seed: seedString,
    dateKey,
    themeName: palette.name,
    themeTag: palette.tag,
    colors: palette.colors,
    wires,
    lineWidth,
    ribbonWidth,
    amplitude,
    waveLength,
    angle,
    twist,
    curl,
    depth,
    stripes,
    colorFlow,
    glow,
    intensity,
    speed,
    spin,
    description: palette.description,
  };
}
