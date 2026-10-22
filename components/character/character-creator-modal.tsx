"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Dice5,
  ShieldCheck,
  Check,
  Sword,
  Crown,
  Shirt,
  Eye,
  User,
  Wand2,
  Zap,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAppStore, ChibiCharacter, DEFAULT_CHIBI_CHARACTER } from "@/lib/store";
import { ChibiAvatar, generateChibiSvgDataUri } from "./chibi-avatar";
import { syncProfileToSupabase } from "@/lib/supabase-game";
import { soundManager } from "@/lib/audio";
import { cn } from "@/lib/utils";

interface CharacterCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnboarding?: boolean;
}

const CLASSES: {
  id: ChibiCharacter["classId"];
  name: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: "samurai",
    name: "Kỳ Thánh Kiếm Sĩ",
    icon: "⚔️",
    desc: "Bậc thầy kiếm thuật & nước đi cờ vua chớp nhoáng",
  },
  {
    id: "werewolf",
    name: "Sói Già Hắc Ám",
    icon: "🐺",
    desc: "Chiến thần ẩn vai, thao túng tâm lý bàn ma sói",
  },
  {
    id: "seer",
    name: "Tiên Tri Hư Không",
    icon: "🔮",
    desc: "Thấu thị mọi mưu kế, kiểm soát thế cờ tướng",
  },
  {
    id: "cyberpunk",
    name: "Đặc Nhiệm Tác Chiến",
    icon: "⚡",
    desc: "Công nghệ tương lai, phản xạ thần tốc trong từng ván đấu",
  },
  {
    id: "monarch",
    name: "Chúa Tể Hoàng Gia",
    icon: "👑",
    desc: "Uy phong vương giả, đại kiện tướng bất khả chiến bại",
  },
];

const SKINS = [
  { id: "cyber", name: "Bạch Kim Cyber", color: "#e2e8f0" },
  { id: "fair", name: "Bạch Diện", color: "#fde2d4" },
  { id: "tan", name: "Bánh Mật", color: "#f59e0b" },
  { id: "dark", name: "Hắc Thần", color: "#603813" },
];

const FACES = [
  { id: "glowing_cyber", name: "Mắt Laser Cyber", desc: "Mắt quét HUD & sẹo má ngầu lòi" },
  { id: "oni_fury", name: "Mắt Đỏ Quỷ Oni", desc: "Mắt rực lửa & khẩu trang nanh quỷ" },
  { id: "smirk_scar", name: "Nhếch Mép Kiếm Sẹo", desc: "Sẹo kiếm bổ dọc & nụ cười tự tin" },
  { id: "cool_shades", name: "Kính Râm Ma Trận", desc: "Kính đen phong cách trùm ngầm" },
  { id: "shadow_void", name: "Mắt Hư Không", desc: "Bóng tối bao phủ & đồng tử sáng trắng" },
];

const HAIRSTYLES = [
  { id: "spiky_cyber", name: "Tóc Gai Anime", desc: "Phong cách Cloud Strife bùng nổ" },
  { id: "ninja_ponytail", name: "Đuôi Ngựa Samurai", desc: "Cột cao phong trần lãng khách" },
  { id: "wolf_wild", name: "Bờm Sói Hoang Dã", desc: "Gai góc cuồng loạn săn mồi" },
  { id: "undercut_slick", name: "Undercut Vuốt Ngược", desc: "Hiện đại lịch lãm công sở" },
  { id: "dreads_fade", name: "Bím Tóc Chiến Binh", desc: "Hạt kim loại đính tóc dũng mãnh" },
];

const HAIR_COLORS = [
  { id: "#00f0ff", name: "Xanh Neon", hex: "#00f0ff" },
  { id: "#ff0055", name: "Huyết Hồng", hex: "#ff0055" },
  { id: "#ffd700", name: "Kim Vàng", hex: "#ffd700" },
  { id: "#a855f7", name: "Tím Hư Không", hex: "#a855f7" },
  { id: "#f1f5f9", name: "Bạch Ngân", hex: "#f1f5f9" },
  { id: "#1e293b", name: "Hắc Thạch", hex: "#1e293b" },
];

const OUTFITS = [
  { id: "mecha_striker", name: "Giáp Cơ Khí Siêu Cấp", icon: "🛡️", desc: "Lò phản ứng hồ quang ngực & giáp vai titan" },
  { id: "cyber_trench", name: "Măng-tô Cyberpunk", icon: "🧥", desc: "Cổ áo led neon dựng cao & dây đai chiến thuật" },
  { id: "assassin_cowl", name: "Áo Choàng Sát Thủ", icon: "🥷", desc: "Cổ áo gai rách & ngọc tím huyền bí" },
  { id: "ronin_haori", name: "Kimono Lãng Khách", icon: "👘", desc: "Họa tiết rồng lửa & viền đỏ sa trường" },
  { id: "tactical_vest", name: "Vest SWAT Đặc Nhiệm", icon: "🦺", desc: "Hệ thống Molle gài trang bị quân nhu" },
  { id: "royal_robe", name: "Cẩm Bào Hoàng Kim", icon: "👑", desc: "Viền lông chồn tuyết quý tộc đại kiện tướng" },
];

const HEADWEAR = [
  { id: "cyber_kitsune", name: "Mặt Nạ Cáo Kitsune", icon: "🦊", desc: "Mặt nạ cáo điện tử viền led đỏ bên thái dương" },
  { id: "oni_horns", name: "Sừng Quỷ Oni", icon: "👹", desc: "Cặp sừng rực lửa địa ngục uốn cong kiêu hãnh" },
  { id: "ronin_kasa", name: "Nón Rơm Ronin", icon: "👒", desc: "Nón lá tre phong trần kiếm khách giang hồ" },
  { id: "holo_visor", name: "Kính Ngắm Hologram", icon: "🥽", desc: "Kính quét HUD phân tích nước đi đối thủ" },
  { id: "demon_crown", name: "Vương Miện Hắc Ám", icon: "👑", desc: "Gai sắt đen đính bảo ngọc thạch anh tím" },
  { id: "none", name: "Không Đội Mũ", icon: "✨", desc: "Khoe trọn kiểu tóc phong cách" },
];

const WEAPONS = [
  { id: "laser_katana", name: "Kiếm Laser Murasama", icon: "🗡️", desc: "Thanh katana ánh sáng cắt ngọt mọi phòng tuyến" },
  { id: "dragon_scepter", name: "Vương Trượng Rồng Đen", icon: "🪄", desc: "Đầu rồng ngậm viên ngọc năng lượng cờ vua" },
  { id: "werewolf_claws", name: "Vuốt Sói Bạc Huyết Nguyệt", icon: "🐾", desc: "Bộ vuốt rèn từ bạc tinh khiết xé toạc bóng đêm" },
  { id: "plasma_pistols", name: "Cặp Súng Lục Plasma", icon: "🔫", desc: "Súng năng lượng xung kích công nghệ cao" },
  { id: "mythic_cards", name: "Bộ Bài UNO Thần Thoại", icon: "🃏", desc: "Ba lá bài ma thuật bay lơ lửng quanh lòng bàn tay" },
];

const AURAS = [
  { id: "cyan_matrix", name: "Lưới Điện Matrix", icon: "⚡", desc: "Vòng tròn vi mạch neon xanh chuyển động" },
  { id: "crimson_flame", name: "Huyết Hỏa Cuồng Nộ", icon: "🔥", desc: "Ngọn lửa chiến ý đỏ rực bốc cao ngùn ngụt" },
  { id: "void_storm", name: "Bão Tố Hư Không", icon: "🌪️", desc: "Lốc xoáy tím ma mị bao bọc kỳ thủ" },
  { id: "golden_radiance", name: "Kim Quang Kiện Tướng", icon: "✨", desc: "Hào quang mặt trời vàng óng của người chiến thắng" },
  { id: "none", name: "Tinh Giản", icon: "⚪", desc: "Không hiển thị linh khí" },
];

export function CharacterCreatorModal({
  isOpen,
  onClose,
  isOnboarding = false,
}: CharacterCreatorModalProps) {
  const { currentUser, setCurrentUser, soundEnabled } = useAppStore();

  const [activeTab, setActiveTab] = useState<
    "identity" | "face" | "outfit" | "headwear" | "weapon" | "aura"
  >("identity");

  const [charName, setCharName] = useState(currentUser.username || "Kỳ Thủ Cyber");
  const [charTitle, setCharTitle] = useState(currentUser.title || "Đại Kiện Tướng Bàn Trà");
  const [character, setCharacter] = useState<ChibiCharacter>(
    currentUser.character || DEFAULT_CHIBI_CHARACTER
  );
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Randomize cool character
  const handleRandomize = () => {
    const randomClass = CLASSES[Math.floor(Math.random() * CLASSES.length)];
    const randomSkin = SKINS[Math.floor(Math.random() * SKINS.length)].id;
    const randomFace = FACES[Math.floor(Math.random() * FACES.length)].id;
    const randomHair = HAIRSTYLES[Math.floor(Math.random() * HAIRSTYLES.length)].id;
    const randomColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].hex;
    const randomOutfit = OUTFITS[Math.floor(Math.random() * OUTFITS.length)].id;
    const randomHead = HEADWEAR[Math.floor(Math.random() * HEADWEAR.length)].id;
    const randomWeapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)].id;
    const randomAura = AURAS[Math.floor(Math.random() * AURAS.length)].id;

    setCharacter({
      classId: randomClass.id,
      className: randomClass.name,
      gender: "cyber",
      skinTone: randomSkin,
      faceExpression: randomFace,
      hairStyle: randomHair,
      hairColor: randomColor,
      outfit: randomOutfit,
      headwear: randomHead,
      weapon: randomWeapon,
      aura: randomAura,
    });

    if (soundEnabled) soundManager.playTurn();
  };

  // Calculate dynamic combat power for fun
  const combatPower =
    1200 +
    (character.outfit !== "tactical_vest" ? 150 : 80) +
    (character.weapon === "laser_katana" ? 220 : 180) +
    (character.aura !== "none" ? 140 : 0);

  const handleSave = async () => {
    setSaving(true);

    // The Kokonut avatar chosen at sign-up stays the profile picture;
    // the chibi is the in-game character only.
    const updatedUser = {
      ...currentUser,
      username: charName.trim() || currentUser.username,
      title: charTitle,
      hasCreatedCharacter: true,
      character: character,
    };

    // Update local Zustand store
    setCurrentUser(updatedUser);

    // Sync to Supabase
    try {
      await syncProfileToSupabase(updatedUser);
    } catch (e) {
      console.warn("Supabase profile sync warning:", e);
    }

    if (soundEnabled) soundManager.playVictory();
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });

    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isOnboarding ? undefined : onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl"
          />

          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            className="relative z-10 w-full max-w-5xl bg-ink-950 border border-ink-800 rounded-3xl shadow-2xl text-white overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Top Glowing Gradient Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-cyan-400 to-rose-500 shadow-[0_0_20px_#00f0ff]" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-800/80 bg-ink-900/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl seg-active font-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                  <Wand2 className="w-5 h-5 fill-black stroke-black" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-wider uppercase flex items-center gap-2">
                    <span>{isOnboarding ? "KHỞI TẠO NHÂN VẬT CHIBI" : "TỦ ĐỒ & NGOẠI TRANG KỲ THỦ"}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                      Chibi Badass Edition
                    </span>
                  </h3>
                  <p className="text-[11px] text-ink-400 font-mono">
                    Tùy chỉnh diện mạo, trang phục & vũ khí độc quyền • Tự động lưu Supabase
                  </p>
                </div>
              </div>

              {!isOnboarding && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
              {/* LEFT PANE: 3D/LIVE CHIBI AVATAR PREVIEW (col-span-5) */}
              <div className="lg:col-span-5 p-6 bg-gradient-to-b from-ink-900/50 to-ink-950 border-b lg:border-b-0 lg:border-r border-ink-800/80 flex flex-col items-center justify-between">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ink-400">
                    Xem Trước Nhân Vật
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ink-800/80 border border-ink-700 text-xs font-bold text-amber-300">
                    <Zap className="w-3.5 h-3.5 fill-amber-300" />
                    <span>{combatPower} CP</span>
                  </div>
                </div>

                {/* Live Animated Chibi Avatar */}
                <div className="relative my-auto flex flex-col items-center justify-center py-2">
                  <div className="relative p-6 rounded-3xl bg-ink-900/40 border border-ink-800 shadow-inner flex items-center justify-center">
                    <ChibiAvatar character={character} size={220} animate={true} />
                  </div>

                  {/* Character Nameplate */}
                  <div className="mt-4 text-center">
                    <p className="text-base font-black text-white tracking-wide truncate max-w-[240px]">
                      {charName || "Kỳ Thủ Vô Danh"}
                    </p>
                    <p className="text-xs font-mono text-cyan-300 mt-0.5">{charTitle}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-mono px-3 py-1 rounded-full bg-ink-800 text-ink-300 border border-ink-700">
                      Hệ Phái: {character.className}
                    </span>
                  </div>
                </div>

                {/* Randomize Action */}
                <button
                  type="button"
                  onClick={handleRandomize}
                  className="w-full py-2.5 rounded-2xl bg-ink-900 hover:bg-ink-800 border border-ink-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 hover:border-ink-500 shadow-sm"
                >
                  <Dice5 className="w-4 h-4 text-amber-400" />
                  <span>🎲 Ngẫu Nhiên Phong Cách Ngầu Lòi</span>
                </button>
              </div>

              {/* RIGHT PANE: CUSTOMIZATION TABS (col-span-7) */}
              <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-ink-950">
                {/* Horizontal Category Nav */}
                <div className="flex items-center gap-1.5 px-6 pt-4 pb-2 border-b border-ink-800/80 overflow-x-auto no-scrollbar">
                  {[
                    { id: "identity", label: "Hệ Phái", icon: "🏷️" },
                    { id: "face", label: "Mặt & Tóc", icon: "💇" },
                    { id: "outfit", label: "Trang Phục", icon: "🥋" },
                    { id: "headwear", label: "Mũ & Phụ Kiện", icon: "👑" },
                    { id: "weapon", label: "Thần Binh", icon: "⚔️" },
                    { id: "aura", label: "Hào Quang", icon: "✨" },
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                          isActive
                            ? "seg-active shadow-md"
                            : "text-ink-400 hover:text-white hover:bg-ink-900"
                        )}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable Customization Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  {/* TAB 1: IDENTITY & CLASS */}
                  {activeTab === "identity" && (
                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2">
                          Biệt Danh Kỳ Thủ
                        </label>
                        <input
                          type="text"
                          value={charName}
                          onChange={(e) => setCharName(e.target.value)}
                          placeholder="Nhập tên nhân vật của bạn..."
                          className="w-full px-4 py-2.5 rounded-xl bg-ink-900 border border-ink-800 text-white font-medium text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2">
                          Chọn Hệ Phái Chiến Đấu (Class)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {CLASSES.map((cls) => {
                            const isSelected = character.classId === cls.id;
                            return (
                              <button
                                key={cls.id}
                                type="button"
                                onClick={() =>
                                  setCharacter((prev) => ({
                                    ...prev,
                                    classId: cls.id,
                                    className: cls.name,
                                  }))
                                }
                                className={cn(
                                  "p-3 rounded-2xl border text-left transition-all flex items-start gap-3",
                                  isSelected
                                    ? "bg-white/10 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                                    : "bg-ink-900/60 border-ink-800 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                                )}
                              >
                                <span className="text-2xl">{cls.icon}</span>
                                <div>
                                  <p className="text-xs font-bold text-white">{cls.name}</p>
                                  <p className="text-[10px] text-ink-400 mt-0.5 leading-snug">
                                    {cls.desc}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: FACE & HAIR */}
                  {activeTab === "face" && (
                    <div className="space-y-5">
                      {/* Skin Tone */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2.5">
                          Tông Da Chibi
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {SKINS.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setCharacter((prev) => ({ ...prev, skinTone: s.id }))}
                              className={cn(
                                "py-2 px-3 rounded-xl border text-xs font-medium transition-all flex items-center gap-2",
                                character.skinTone === s.id
                                  ? "border-cyan-400 bg-ink-800 text-white"
                                  : "border-ink-800 bg-ink-900 text-ink-400"
                              )}
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/40"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="truncate">{s.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Face Expression */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2.5">
                          Ánh Mắt & Thần Thái
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {FACES.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() =>
                                setCharacter((prev) => ({ ...prev, faceExpression: f.id }))
                              }
                              className={cn(
                                "p-2.5 rounded-xl border text-left transition-all",
                                character.faceExpression === f.id
                                  ? "border-cyan-400 bg-cyan-950/20 text-white"
                                  : "border-ink-800 bg-ink-900/60 text-ink-400 hover:text-white"
                              )}
                            >
                              <p className="text-xs font-bold">{f.name}</p>
                              <p className="text-[10px] text-ink-500 mt-0.5">{f.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Hair Style */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2.5">
                          Kiểu Tóc
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {HAIRSTYLES.map((h) => (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => setCharacter((prev) => ({ ...prev, hairStyle: h.id }))}
                              className={cn(
                                "p-2.5 rounded-xl border text-left transition-all",
                                character.hairStyle === h.id
                                  ? "border-cyan-400 bg-cyan-950/20 text-white"
                                  : "border-ink-800 bg-ink-900/60 text-ink-400 hover:text-white"
                              )}
                            >
                              <p className="text-xs font-bold">{h.name}</p>
                              <p className="text-[10px] text-ink-500 mt-0.5">{h.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Hair Color */}
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2.5">
                          Màu Tóc Neon
                        </label>
                        <div className="flex items-center gap-3">
                          {HAIR_COLORS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setCharacter((prev) => ({ ...prev, hairColor: c.hex }))}
                              className={cn(
                                "w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center",
                                character.hairColor === c.hex
                                  ? "border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                                  : "border-ink-700"
                              )}
                              style={{ backgroundColor: c.hex }}
                            >
                              {character.hairColor === c.hex && (
                                <Check className="w-4 h-4 text-black stroke-[3]" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: OUTFIT */}
                  {activeTab === "outfit" && (
                    <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block">
                        Chọn Bộ Trang Phục / Áo Giáp
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {OUTFITS.map((out) => {
                          const isSelected = character.outfit === out.id;
                          return (
                            <button
                              key={out.id}
                              type="button"
                              onClick={() => setCharacter((prev) => ({ ...prev, outfit: out.id }))}
                              className={cn(
                                "p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3",
                                isSelected
                                  ? "bg-white/10 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                                  : "bg-ink-900/60 border-ink-800 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                              )}
                            >
                              <span className="text-2xl">{out.icon}</span>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-white">{out.name}</p>
                                <p className="text-[10px] text-ink-400 mt-0.5 leading-snug">
                                  {out.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: HEADWEAR */}
                  {activeTab === "headwear" && (
                    <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block">
                        Chọn Mũ & Phụ Kiện Đầu
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {HEADWEAR.map((head) => {
                          const isSelected = character.headwear === head.id;
                          return (
                            <button
                              key={head.id}
                              type="button"
                              onClick={() =>
                                setCharacter((prev) => ({ ...prev, headwear: head.id }))
                              }
                              className={cn(
                                "p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3",
                                isSelected
                                  ? "bg-white/10 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                                  : "bg-ink-900/60 border-ink-800 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                              )}
                            >
                              <span className="text-2xl">{head.icon}</span>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-white">{head.name}</p>
                                <p className="text-[10px] text-ink-400 mt-0.5 leading-snug">
                                  {head.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: WEAPONS */}
                  {activeTab === "weapon" && (
                    <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block">
                        Chọn Thần Binh Trang Bị
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {WEAPONS.map((wep) => {
                          const isSelected = character.weapon === wep.id;
                          return (
                            <button
                              key={wep.id}
                              type="button"
                              onClick={() =>
                                setCharacter((prev) => ({ ...prev, weapon: wep.id }))
                              }
                              className={cn(
                                "p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3",
                                isSelected
                                  ? "bg-white/10 border-amber-400 text-white shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                                  : "bg-ink-900/60 border-ink-800 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                              )}
                            >
                              <span className="text-2xl">{wep.icon}</span>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-white">{wep.name}</p>
                                <p className="text-[10px] text-ink-400 mt-0.5 leading-snug">
                                  {wep.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 6: AURAS */}
                  {activeTab === "aura" && (
                    <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block">
                        Chọn Hào Quang & Linh Khí Bao Quanh
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {AURAS.map((au) => {
                          const isSelected = character.aura === au.id;
                          return (
                            <button
                              key={au.id}
                              type="button"
                              onClick={() => setCharacter((prev) => ({ ...prev, aura: au.id }))}
                              className={cn(
                                "p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3",
                                isSelected
                                  ? "bg-white/10 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                                  : "bg-ink-900/60 border-ink-800 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                              )}
                            >
                              <span className="text-2xl">{au.icon}</span>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-white">{au.name}</p>
                                <p className="text-[10px] text-ink-400 mt-0.5 leading-snug">
                                  {au.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="p-4 px-6 border-t border-ink-800/80 bg-ink-900/60 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-ink-400">
                    Tất cả ngoại trang đều mở khóa miễn phí cho kỳ thủ!
                  </span>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="py-3 px-6 rounded-2xl seg-active font-extrabold text-xs uppercase tracking-wider hover:bg-ink-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 flex items-center gap-2"
                  >
                    {saving ? (
                      <span>Đang lưu Supabase...</span>
                    ) : savedSuccess ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Đã Lưu Thành Công!</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 fill-black" />
                        <span>Xác Nhận & Lưu Vào Supabase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
