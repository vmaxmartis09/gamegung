"use client";

import React from "react";
import { Role } from "@/lib/games/werewolf-engine";
import { cn } from "@/lib/utils";

export interface RoleTheme {
  name: string;
  sub: string;
  team: "wolves" | "village";
  teamLabel: string;
  emoji: string;
  accentColor: string;
  glowColor: string;
  bgGradient: string;
  borderGlow: string;
  quote: string;
  actionHint: string;
}

export const ROLE_THEMES: Record<Role, RoleTheme> = {
  wolf: {
    name: "Ma Sói",
    sub: "Kẻ Thao Túng Bóng Đêm",
    team: "wolves",
    teamLabel: "Phe Sói",
    emoji: "🐺",
    accentColor: "#ef4444",
    glowColor: "rgba(239, 68, 68, 0.45)",
    bgGradient: "from-red-950/90 via-[#180a0a] to-[#0a0505]",
    borderGlow: "rgba(239, 68, 68, 0.6)",
    quote: "“Khi màn đêm buông xuống, bóng tối là đồng minh... Hãy chọn con mồi đầu tiên!”",
    actionHint: "Thức giấc mỗi đêm cùng đồng bọn để cắn 1 người. Ban ngày hãy trà trộn khéo léo.",
  },
  white_wolf: {
    name: "Sói Trắng",
    sub: "Kẻ Thống Trị Đơn Độc",
    team: "wolves",
    teamLabel: "Phe Sói (Độc Lập)",
    emoji: "🐺⚪",
    accentColor: "#f1f5f9",
    glowColor: "rgba(241, 245, 249, 0.45)",
    bgGradient: "from-slate-900/95 via-[#111827] to-[#030712]",
    borderGlow: "rgba(255, 255, 255, 0.8)",
    quote: "“Kẻ mạnh nhất không cần bầy đàn. Cả dân làng lẫn lũ sói yếu đuối đều là con mồi của ta!”",
    actionHint: "Mỗi đêm cắn cùng bầy sói. Cứ 2 đêm được cắn thêm 1 con sói khác để độc chiếm chiến thắng.",
  },
  wolf_cub: {
    name: "Sói Con",
    sub: "Mầm Mống Báo Thù",
    team: "wolves",
    teamLabel: "Phe Sói",
    emoji: "🐺🐾",
    accentColor: "#fb7185",
    glowColor: "rgba(251, 113, 133, 0.45)",
    bgGradient: "from-rose-950/90 via-[#1c080e] to-[#080205]",
    borderGlow: "rgba(251, 113, 133, 0.6)",
    quote: "“Đừng chọc giận bầy đàn của ta... Nếu ta ngã xuống, làng này sẽ chìm trong bể máu!”",
    actionHint: "Cùng bầy sói cắn người. Nếu Sói Con chết, đêm tiếp theo bầy sói được cắn 2 người trả thù.",
  },
  seer: {
    name: "Tiên Tri",
    sub: "Con Mắt Của Thần Linh",
    team: "village",
    teamLabel: "Phe Dân Làng",
    emoji: "🔮",
    accentColor: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.45)",
    bgGradient: "from-purple-950/90 via-[#130a21] to-[#06040d]",
    borderGlow: "rgba(168, 85, 247, 0.6)",
    quote: "“Sự thật ẩn sau mọi lời nói dối. Con mắt thứ ba sẽ nhìn thấu chân tướng loài sói.”",
    actionHint: "Mỗi đêm soi 1 người để biết họ là Sói hay Dân. Giữ bí mật thân phận tới thời khắc quyết định.",
  },
  guard: {
    name: "Bảo Vệ",
    sub: "Bức Tường Kiên Cố",
    team: "village",
    teamLabel: "Phe Dân Làng",
    emoji: "🛡️",
    accentColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.45)",
    bgGradient: "from-emerald-950/90 via-[#061811] to-[#030a07]",
    borderGlow: "rgba(16, 185, 129, 0.6)",
    quote: "“Lá chắn thép không bao giờ sụp đổ. Đêm nay, sinh mạng này nằm dưới sự bảo hộ của ta.”",
    actionHint: "Mỗi đêm chọn 1 người để che chở khỏi cú cắn của Sói. Không thể bảo vệ cùng 1 người 2 đêm liền.",
  },
  witch: {
    name: "Phù Thủy",
    sub: "Bậc Thầy Độc Dược",
    team: "village",
    teamLabel: "Phe Dân Làng",
    emoji: "🧪",
    accentColor: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.45)",
    bgGradient: "from-fuchsia-950/90 via-[#190924] to-[#08020d]",
    borderGlow: "rgba(192, 132, 252, 0.6)",
    quote: "“Một giọt cứu người hồi sinh, một giọt tiễn hồn về cõi chết. Cán cân sinh tử là do ta.”",
    actionHint: "Sở hữu 1 bình Cứu nạn nhân của Sói và 1 bình Độc giết 1 người bất kỳ. Mỗi bình dùng 1 lần duy nhất.",
  },
  hunter: {
    name: "Thợ Săn",
    sub: "Mũi Tên Phục Hận",
    team: "village",
    teamLabel: "Phe Dân Làng",
    emoji: "🏹",
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.45)",
    bgGradient: "from-amber-950/90 via-[#1c1205] to-[#0a0702]",
    borderGlow: "rgba(245, 158, 11, 0.6)",
    quote: "“Mũi tên bạc luôn sẵn sàng trên dây cung. Kẻ nào cướp đi mạng sống của ta sẽ phải trả giá!”",
    actionHint: "Khi chết đi (ngoại trừ trúng độc của Phù thủy), bạn có quyền bắn chết 1 người khác theo mình.",
  },
  cupid: {
    name: "Thần Tình Yêu",
    sub: "Mũi Tên Duyên Phận",
    team: "village",
    teamLabel: "Phe Dân Làng",
    emoji: "💘",
    accentColor: "#ec4899",
    glowColor: "rgba(236, 72, 153, 0.45)",
    bgGradient: "from-pink-950/90 via-[#210915] to-[#0d0308]",
    borderGlow: "rgba(244, 114, 182, 0.6)",
    quote: "“Duyên trời định đoạt, sinh tử có nhau. Một người ngã xuống, người kia sẽ chết theo!”",
    actionHint: "Đêm đầu tiên ghép đôi 2 người. Nếu 2 người thuộc 2 phe khác nhau, họ trở thành phe thứ 3.",
  },
  elder: {
    name: "Già Làng",
    sub: "Chỗ Dựa Cả Làng",
    team: "village",
    teamLabel: "Phe Dân Làng",
    emoji: "👴",
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.45)",
    bgGradient: "from-amber-950/90 via-[#1f1508] to-[#0c0803]",
    borderGlow: "rgba(251, 191, 36, 0.6)",
    quote: "“Kinh nghiệm đời người không dễ bị khuất phục! Nhưng hãy cẩn thận, đừng để ta chết oan.”",
    actionHint: "Có 2 mạng trước đòn cắn của Sói. Nếu bị dân làng treo cổ, toàn bộ dân làng mất hết chức năng.",
  },
  villager: {
    name: "Dân Làng",
    sub: "Ngọn Đuốc Lòng Dân",
    team: "village",
    teamLabel: "Phe Dân Làng",
    emoji: "🧑‍💼",
    accentColor: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.45)",
    bgGradient: "from-sky-950/90 via-[#071626] to-[#030912]",
    borderGlow: "rgba(56, 189, 248, 0.6)",
    quote: "“Dù không có phép thuật, trí tuệ và sự tỉnh táo của dân làng sẽ phơi bày lũ sói!”",
    actionHint: "Lắng nghe cẩn thận từng lời nói dối, suy luận hành vi bỏ phiếu để tìm ra kẻ thủ ác.",
  },
};

/** High-impact pure SVG illustrations for character cards */
export function WerewolfArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <radialGradient id="art-ww-moon" cx="0.5" cy="0.45" r="0.5">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="40%" stopColor="#dc2626" />
          <stop offset="85%" stopColor="#7f1d1d" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#450a0a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="art-ww-claw" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Blood Moon */}
      <circle cx="160" cy="90" r="68" fill="url(#art-ww-moon)" opacity="0.9" />
      <circle cx="160" cy="90" r="50" fill="#991b1b" opacity="0.6" />
      {/* Fog mist silhouettes */}
      <path d="M0 180 Q80 160 160 175 T320 170 L320 220 L0 220 Z" fill="#0f0505" opacity="0.9" />
      <path d="M0 195 Q90 185 180 195 T320 190 L320 220 L0 220 Z" fill="#050202" />
      {/* Howling Alpha Wolf */}
      <path
        d="M168 185 Q174 150 188 135 Q196 118 190 102 L196 82 L190 64 L182 80 L174 78 Q160 70 148 62 L138 60 L140 68 Q148 76 158 84 Q166 96 164 112 Q156 132 158 160 L154 185 Z"
        fill="#1a0707"
        stroke="#ef4444"
        strokeWidth="1.5"
      />
      <circle cx="166" cy="77" r="3" fill="#fef08a" />
      {/* Dramatic Slash Claws */}
      <path d="M80 50 L110 110" stroke="url(#art-ww-claw)" strokeWidth="3" strokeLinecap="round" />
      <path d="M95 45 L125 105" stroke="url(#art-ww-claw)" strokeWidth="4" strokeLinecap="round" />
      <path d="M110 40 L140 100" stroke="url(#art-ww-claw)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SeerArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <radialGradient id="art-seer-orb" cx="0.5" cy="0.45" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#c084fc" />
          <stop offset="70%" stopColor="#7e22ce" />
          <stop offset="100%" stopColor="#3b0764" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Cosmic background rings */}
      <circle cx="160" cy="110" r="75" stroke="#c084fc" strokeWidth="1" strokeDasharray="4 6" opacity="0.4" />
      <circle cx="160" cy="110" r="95" stroke="#9333ea" strokeWidth="0.8" strokeDasharray="6 8" opacity="0.3" />
      {/* Crystal Orb */}
      <circle cx="160" cy="110" r="50" fill="url(#art-seer-orb)" />
      {/* Mystic Third Eye Inside Orb */}
      <path
        d="M136 110 Q160 88 184 110 Q160 132 136 110 Z"
        fill="#0d0417"
        stroke="#f3e8ff"
        strokeWidth="2"
      />
      <circle cx="160" cy="110" r="9" fill="#c084fc" />
      <circle cx="160" cy="110" r="4" fill="#ffffff" />
      {/* Arcane Star Sparks */}
      <path d="M160 30 L163 45 L178 48 L163 51 L160 66 L157 51 L142 48 L157 45 Z" fill="#e9d5ff" />
      <path d="M70 120 L72 130 L82 132 L72 134 L70 144 L68 134 L58 132 L68 130 Z" fill="#c084fc" opacity="0.7" />
      <path d="M250 100 L252 110 L262 112 L252 114 L250 124 L248 114 L238 112 L248 110 Z" fill="#c084fc" opacity="0.7" />
    </svg>
  );
}

export function GuardArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <linearGradient id="art-guard-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
      </defs>
      {/* Protective aura ring */}
      <circle cx="160" cy="110" r="78" stroke="#10b981" strokeWidth="2" strokeDasharray="8 6" opacity="0.5" />
      {/* Radiant Knight Shield */}
      <path
        d="M115 55 L205 55 Q205 130 160 175 Q115 130 115 55 Z"
        fill="url(#art-guard-shield)"
        stroke="#6ee7b7"
        strokeWidth="3"
      />
      {/* Inner heraldic emblem */}
      <path
        d="M130 70 L190 70 Q190 125 160 155 Q130 125 130 70 Z"
        fill="#022c22"
        stroke="#a7f3d0"
        strokeWidth="1.5"
      />
      {/* Golden Cross / Star */}
      <path d="M156 80 H164 V140 H156 Z" fill="#6ee7b7" />
      <path d="M136 100 H184 V108 H136 Z" fill="#6ee7b7" />
      <circle cx="160" cy="104" r="6" fill="#ffffff" />
    </svg>
  );
}

export function WitchArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <radialGradient id="art-witch-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#e879f9" />
          <stop offset="60%" stopColor="#a855f7" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Cauldron Glow */}
      <circle cx="160" cy="140" r="70" fill="url(#art-witch-glow)" opacity="0.7" />
      {/* Potion Vial 1: Healing Elixir (Green) */}
      <g transform="translate(110, 65)">
        <path d="M18 0 H26 V12 L36 34 Q38 42 22 42 Q6 42 8 34 L18 12 Z" fill="#10b981" opacity="0.85" stroke="#6ee7b7" strokeWidth="2" />
        <rect x="19" y="-4" width="6" height="5" rx="1.5" fill="#a7f3d0" />
      </g>
      {/* Potion Vial 2: Deadly Poison (Purple) */}
      <g transform="translate(170, 55)">
        <path d="M18 0 H26 V12 L38 38 Q40 48 22 48 Q4 48 6 38 L18 12 Z" fill="#a855f7" opacity="0.9" stroke="#e9d5ff" strokeWidth="2" />
        <rect x="19" y="-4" width="6" height="5" rx="1.5" fill="#d8b4fe" />
      </g>
      {/* Bubbling Magic Vapors */}
      <circle cx="150" cy="50" r="5" fill="#f0abfc" opacity="0.7" />
      <circle cx="165" cy="35" r="8" fill="#d8b4fe" opacity="0.8" />
      <circle cx="140" cy="30" r="6" fill="#6ee7b7" opacity="0.7" />
      <circle cx="180" cy="40" r="4" fill="#a7f3d0" opacity="0.6" />
    </svg>
  );
}

export function HunterArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <linearGradient id="art-hunter-bow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* Crosshair Target Rings */}
      <circle cx="160" cy="110" r="65" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.4" />
      <circle cx="160" cy="110" r="35" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" />
      <line x1="160" y1="35" x2="160" y2="185" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
      <line x1="85" y1="110" x2="235" y2="110" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
      {/* Enchanted Silver Arrow */}
      <line x1="90" y1="110" x2="220" y2="110" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" />
      <path d="M220 110 L205 100 L208 110 L205 120 Z" fill="#fef3c7" />
      {/* Bow Arc */}
      <path d="M120 40 Q170 110 120 180" stroke="url(#art-hunter-bow)" strokeWidth="4" strokeLinecap="round" />
      <line x1="120" y1="40" x2="120" y2="180" stroke="#fde68a" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
    </svg>
  );
}

export function VillagerArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <radialGradient id="art-vill-sun" cx="0.5" cy="0.6" r="0.6">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#0284c7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#082f49" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Dawn Lantern Glow */}
      <circle cx="160" cy="100" r="70" fill="url(#art-vill-sun)" />
      {/* Village Houses Silhouette */}
      <path d="M50 180 L80 145 L110 180 Z" fill="#082f49" />
      <path d="M100 180 L140 135 L180 180 Z" fill="#0c4a6e" />
      <path d="M170 180 L200 140 L230 180 Z" fill="#082f49" />
      <rect x="0" y="178" width="320" height="42" fill="#031d2e" />
      {/* Glowing Torch / Lantern */}
      <g transform="translate(150, 75)">
        <rect x="6" y="22" width="8" height="28" rx="2" fill="#b45309" />
        <path d="M10 2 Q18 12 10 22 Q2 12 10 2 Z" fill="#fef08a" stroke="#e0f2fe" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

/** Gothic Ancient Card Back Illustration */
export function CardBackArt({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full h-full rounded-[24px] overflow-hidden border-2 border-white/15 bg-gradient-to-b from-[#1c1917] via-[#0c0a09] to-[#040303] flex flex-col items-center justify-center p-6 select-none",
        className
      )}
    >
      {/* Gothic Filigree Borders */}
      <div className="absolute inset-2 rounded-[20px] border border-amber-500/25 pointer-events-none" />
      <div className="absolute inset-3.5 rounded-[16px] border border-white/5 pointer-events-none" />
      {/* Corner Ornaments */}
      <div className="absolute top-4 left-4 size-4 border-t-2 border-l-2 border-amber-500/50" />
      <div className="absolute top-4 right-4 size-4 border-t-2 border-r-2 border-amber-500/50" />
      <div className="absolute bottom-4 left-4 size-4 border-b-2 border-l-2 border-amber-500/50" />
      <div className="absolute bottom-4 right-4 size-4 border-b-2 border-r-2 border-amber-500/50" />

      {/* Central Gothic Werewolf Wax Seal */}
      <div className="relative size-24 sm:size-28 rounded-full border-[3px] border-amber-600/60 bg-gradient-to-br from-red-950 via-red-900 to-black shadow-[0_0_35px_rgba(220,38,38,0.4)] grid place-items-center">
        <div className="absolute inset-1 rounded-full border border-amber-400/30" />
        <span className="text-4xl sm:text-5xl filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">🐺</span>
      </div>

      <div className="mt-5 text-center">
        <p className="font-mono text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase text-amber-300/80">
          MA SÓI · BẢN MỆNH
        </p>
        <p className="mt-1 text-xs text-ink-400 font-medium">Bí mật tuyệt đối</p>
      </div>
    </div>
  );
}

export function WhiteWolfArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <radialGradient id="art-ww-silvermoon" cx="0.5" cy="0.45" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#cbd5e1" />
          <stop offset="85%" stopColor="#64748b" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="90" r="68" fill="url(#art-ww-silvermoon)" opacity="0.9" />
      {/* Pure White Alpha Wolf */}
      <path
        d="M168 185 Q174 150 188 135 Q196 118 190 102 L196 82 L190 64 L182 80 L174 78 Q160 70 148 62 L138 60 L140 68 Q148 76 158 84 Q166 96 164 112 Q156 132 158 160 L154 185 Z"
        fill="#f8fafc"
        stroke="#94a3b8"
        strokeWidth="1.5"
      />
      <circle cx="166" cy="77" r="3" fill="#38bdf8" />
      {/* Ice Crystal & Frost Slashes */}
      <path d="M80 50 L110 110" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
      <path d="M95 45 L125 105" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" />
      <path d="M110 40 L140 100" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function WolfCubArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <radialGradient id="art-cub-moon" cx="0.5" cy="0.45" r="0.5">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="50%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#881337" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="95" r="58" fill="url(#art-cub-moon)" opacity="0.8" />
      {/* Small agile pup howling */}
      <path
        d="M165 175 Q170 148 180 136 Q187 122 182 108 L187 92 L182 76 L175 90 L168 88 Q156 81 146 74 L138 72 L140 78 Q146 85 154 92 Q160 102 158 116 Q151 132 153 155 L150 175 Z"
        fill="#4c0519"
        stroke="#fb7185"
        strokeWidth="2"
      />
      <circle cx="164" cy="85" r="2.5" fill="#fef08a" />
      {/* Little Paw prints */}
      <circle cx="90" cy="140" r="6" fill="#f43f5e" opacity="0.7" />
      <circle cx="82" cy="130" r="3" fill="#f43f5e" opacity="0.7" />
      <circle cx="90" cy="126" r="3" fill="#f43f5e" opacity="0.7" />
      <circle cx="98" cy="130" r="3" fill="#f43f5e" opacity="0.7" />
    </svg>
  );
}

export function CupidArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <radialGradient id="art-cupid-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="60%" stopColor="#db2777" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#831843" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="110" r="70" fill="url(#art-cupid-glow)" />
      {/* Golden Love Bow */}
      <path d="M120 40 Q170 110 120 180" stroke="#f472b6" strokeWidth="4" strokeLinecap="round" />
      {/* Double Heart Arrow */}
      <line x1="85" y1="110" x2="235" y2="110" stroke="#fbcfe8" strokeWidth="3" strokeLinecap="round" />
      {/* Heart Arrowhead */}
      <path
        d="M235 110 Q245 98 255 105 Q265 110 255 115 Q245 122 235 110 Z"
        fill="#ec4899"
      />
      {/* Angel Wings */}
      <path d="M140 100 Q110 60 70 80 Q100 110 130 110 Z" fill="#fdf2f8" opacity="0.75" />
      <path d="M140 120 Q110 160 70 140 Q100 110 130 110 Z" fill="#fdf2f8" opacity="0.75" />
    </svg>
  );
}

export function ElderArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={cn("w-full h-full", className)} fill="none">
      <defs>
        <radialGradient id="art-elder-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#d97706" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="100" r="72" fill="url(#art-elder-glow)" />
      {/* 2 Shield / Life Crests */}
      <g transform="translate(110, 60)">
        <path d="M0 0 L24 0 Q24 24 12 34 Q0 24 0 0 Z" fill="#f59e0b" stroke="#fef3c7" strokeWidth="1.5" />
        <text x="7" y="22" fill="#78350f" fontSize="14" fontWeight="bold">I</text>
      </g>
      <g transform="translate(186, 60)">
        <path d="M0 0 L24 0 Q24 24 12 34 Q0 24 0 0 Z" fill="#f59e0b" stroke="#fef3c7" strokeWidth="1.5" />
        <text x="5" y="22" fill="#78350f" fontSize="14" fontWeight="bold">II</text>
      </g>
      {/* Wise Village Staff */}
      <line x1="160" y1="40" x2="160" y2="185" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
      <circle cx="160" cy="40" r="14" fill="#fbbf24" stroke="#fef3c7" strokeWidth="2" />
      <circle cx="160" cy="40" r="6" fill="#ffffff" />
    </svg>
  );
}

export const ROLE_CARD_IMAGES: Partial<Record<Role, string>> = {
  wolf: "/images/werewolf_roles/role_card_01.png",
  seer: "/images/werewolf_roles/role_card_02.png",
  hunter: "/images/werewolf_roles/role_card_04.png",
  guard: "/images/werewolf_roles/role_card_06.png",
  witch: "/images/werewolf_roles/role_card_08.png",
  cupid: "/images/werewolf_roles/role_card_10.png",
  white_wolf: "/images/werewolf_roles/role_card_19.png",
  wolf_cub: "/images/werewolf_roles/role_card_23.png",
  elder: "/images/werewolf_roles/role_card_24.png",
  villager: "/images/werewolf_roles/role_card_22.png",
};

export function RoleCardIllustration({
  role,
  className,
  preferImage = true,
}: {
  role: Role;
  className?: string;
  preferImage?: boolean;
}) {
  const [imgError, setImgError] = React.useState(false);
  const imgUrl = ROLE_CARD_IMAGES[role];

  if (preferImage && imgUrl && !imgError) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl shadow-inner group", className)}>
        <img
          src={imgUrl}
          alt={role}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      </div>
    );
  }

  switch (role) {
    case "wolf":
      return <WerewolfArt className={className} />;
    case "white_wolf":
      return <WhiteWolfArt className={className} />;
    case "wolf_cub":
      return <WolfCubArt className={className} />;
    case "cupid":
      return <CupidArt className={className} />;
    case "elder":
      return <ElderArt className={className} />;
    case "seer":
      return <SeerArt className={className} />;
    case "guard":
      return <GuardArt className={className} />;
    case "witch":
      return <WitchArt className={className} />;
    case "hunter":
      return <HunterArt className={className} />;
    case "villager":
      return <VillagerArt className={className} />;
    default:
      return <WerewolfArt className={className} />;
  }
}
