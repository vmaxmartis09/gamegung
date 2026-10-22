/* Dữ liệu tĩnh của Typing Battle: từ vựng, vật phẩm, công thức hợp thể. */

/** P1 gõ nửa trái bàn phím, P2 nửa phải → từ vựng mỗi bên chỉ dùng chữ ở nửa phím của mình. */
export const LEFT_KEYS = "qwertasdfgzxcvb";
export const RIGHT_KEYS = "yuiophjklnm";

const RAW_LEFT = `water after great street state west test fast brave craft draft grade trade sweet tree free secret target wave race case cart card dart star stars grass dress fear bear beast feast east exact extra scare crab bread stage taxes zest crew gate vest waste vase save base bass cast fact tract trace brace grab stab tear wear swear sweat treat beat seat breeze freeze drag brag dwarf grave craze array brew crest bazaar secrets exceed access erase beware stew wet set get bed red zed fed bad bag tax wax sad`;
const RAW_RIGHT = `pump only hook milk look ink pool plum union uphill holy nylon jump minimum noon moon human lymph imply kiln pink link mill hill pull null onion opinion unhook phony pylon lumpy honk jolly mommy hippo uplink hymn lion million kilo mink pony puppy unholy phonon monopoly polyphony mini minion pinion lupin kimono mono poplin pinhole kook loon poll oink unhip linkup limp plump pun nun mum hum oil pin pop hop mop yum lily pill upon`;

const clean = (s: string, set: string) =>
  Array.from(new Set(s.split(/\s+/).filter((w) => w.length >= 3 && Array.from(w).every((c) => set.includes(c)))));

export const POOL: [string[], string[]] = [clean(RAW_LEFT, LEFT_KEYS), clean(RAW_RIGHT, RIGHT_KEYS)];

export type ItemType = "ammo" | "shield" | "reflect" | "wipe" | "steal" | "slow";
export type CardFrame = "monster" | "spell" | "trap" | "fusion";

export interface ItemDef {
  name: string;
  icon: string;
  col: string;
  /** trọng số xuất hiện */
  w: number;
  frame: CardFrame;
  stars: number;
  /** số từ trong đoạn text trên thẻ (thẻ hiếm = đoạn dài) */
  words: number;
  type: string;
  desc: string;
}

export const ITEMS: Record<ItemType, ItemDef> = {
  ammo: { name: "Đạn Tên Lửa", icon: "🚀", col: "#ffb020", w: 5, frame: "monster", stars: 1, words: 1, type: "Quái thú / Đạn", desc: "+3 tên lửa. Bấm bắn để phóng." },
  shield: { name: "Giáp Công Sở", icon: "🛡️", col: "#3aa0ff", w: 2, frame: "spell", stars: 2, words: 2, type: "Phép / Trang bị", desc: "+700 giáp hấp thụ sát thương." },
  reflect: { name: "Phản Dame", icon: "🔄", col: "#b878ff", w: 2, frame: "trap", stars: 3, words: 2, type: "Bẫy / Phản đòn", desc: "8 giây: tên lửa bị bắn ngược lại." },
  wipe: { name: "Xóa Chữ", icon: "🧹", col: "#ff5a5a", w: 2, frame: "trap", stars: 3, words: 2, type: "Bẫy / Phá hoại", desc: "Xóa chữ đang gõ, khóa đối thủ 2 giây." },
  steal: { name: "Hút Máu", icon: "🩸", col: "#40e880", w: 2, frame: "spell", stars: 3, words: 2, type: "Phép / Hồi phục", desc: "5 giây: sát thương gây ra hồi lại cho bạn." },
  slow: { name: "Làm Chậm", icon: "🐌", col: "#ffe040", w: 2, frame: "trap", stars: 2, words: 2, type: "Bẫy / Đình trệ", desc: "6 giây: đối thủ gõ chậm hẳn." },
};

export const ITEM_TYPES = Object.keys(ITEMS) as ItemType[];
export const ITEM_BAG: ItemType[] = ITEM_TYPES.flatMap((k) => Array<ItemType>(ITEMS[k].w).fill(k));

/** Thời gian thẻ hiệu ứng nằm trên tay chờ hợp thể trước khi tự kích hoạt. */
export const HAND_HOLD = 5;
export const HAND_MAX = 3;

export type FusionId = "mirror" | "seal" | "bloodarmor" | "thunder" | "venom";

export interface FusionDef {
  id: FusionId;
  name: string;
  icon: string;
  col: string;
  a: ItemType;
  b: ItemType;
  desc: string;
}

/** Gom 2 thẻ trên tay → kỹ năng đặc biệt (hợp thể kiểu Yu-Gi-Oh). */
export const FUSIONS: FusionDef[] = [
  { id: "mirror", name: "Gương Thần", icon: "🪞", col: "#9ad0ff", a: "shield", b: "reflect", desc: "+1000 giáp, phản dame 10 giây và đòn phản tăng 150%." },
  { id: "seal", name: "Phong Ấn", icon: "❄️", col: "#a0f0ff", a: "wipe", b: "slow", desc: "Đóng băng đối thủ 3 giây rồi làm chậm 8 giây." },
  { id: "bloodarmor", name: "Huyết Giáp", icon: "🩸🛡️", col: "#ff8a8a", a: "steal", b: "shield", desc: "+800 giáp và hút máu 8 giây." },
  { id: "thunder", name: "Lôi Đình", icon: "⚡", col: "#ffe86a", a: "reflect", b: "wipe", desc: "Phóng tên lửa sấm 900 sát thương và đóng băng 1.5 giây." },
  { id: "venom", name: "Độc Huyết", icon: "☠️", col: "#9dff7a", a: "steal", b: "slow", desc: "Hút 500 máu đối thủ, hút máu 8 giây, làm chậm 8 giây." },
];

export function findFusion(x: ItemType, y: ItemType): FusionDef | undefined {
  return FUSIONS.find((f) => (f.a === x && f.b === y) || (f.a === y && f.b === x));
}
