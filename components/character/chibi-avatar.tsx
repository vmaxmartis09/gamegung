"use client";

import React from "react";
import { ChibiCharacter } from "@/lib/store";

interface ChibiAvatarProps {
  character?: Partial<ChibiCharacter>;
  size?: number;
  className?: string;
  animate?: boolean;
}

export function ChibiAvatar({
  character,
  size = 120,
  className = "",
  animate = true,
}: ChibiAvatarProps) {
  const c: ChibiCharacter = {
    classId: character?.classId || "samurai",
    className: character?.className || "Kỳ Thánh Kiếm Sĩ",
    gender: character?.gender || "cyber",
    skinTone: character?.skinTone || "cyber",
    faceExpression: character?.faceExpression || "glowing_cyber",
    hairStyle: character?.hairStyle || "spiky_cyber",
    hairColor: character?.hairColor || "#00f0ff",
    outfit: character?.outfit || "mecha_striker",
    headwear: character?.headwear || "cyber_kitsune",
    weapon: character?.weapon || "laser_katana",
    aura: character?.aura || "cyan_matrix",
  };

  // Skin tone hex
  let skinHex = "#e2e8f0";
  let skinShadow = "#94a3b8";
  if (c.skinTone === "fair") {
    skinHex = "#fde2d4";
    skinShadow = "#fca5a5";
  } else if (c.skinTone === "tan") {
    skinHex = "#f59e0b";
    skinShadow = "#b45309";
  } else if (c.skinTone === "dark") {
    skinHex = "#603813";
    skinShadow = "#3b1d08";
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animate ? "transition-transform hover:scale-105 duration-300" : ""} ${className}`}
    >
      <defs>
        {/* Glow Filters */}
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="heavy-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Aura Gradients */}
        <radialGradient id="matrix-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#0284c7" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="flame-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff0055" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#ea580c" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="void-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#4c1d95" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gold-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#d97706" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* Katana Laser Gradient */}
        <linearGradient id="laser-katana" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="flame-blade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#ff0055" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>

      {/* ======================================================== */}
      {/* 1. AURA LAYER */}
      {/* ======================================================== */}
      {c.aura === "cyan_matrix" && (
        <g filter="url(#neon-glow)">
          <circle cx="100" cy="100" r="90" fill="url(#matrix-grad)" />
          <circle cx="100" cy="100" r="78" stroke="#00f0ff" strokeWidth="1" strokeDasharray="4 6" opacity="0.6" />
          <circle cx="100" cy="100" r="85" stroke="#38bdf8" strokeWidth="0.75" strokeDasharray="12 16" opacity="0.4" />
          {/* Cyber matrix digital crosshair */}
          <line x1="100" y1="5" x2="100" y2="25" stroke="#00f0ff" strokeWidth="1.5" opacity="0.8" />
          <line x1="100" y1="175" x2="100" y2="195" stroke="#00f0ff" strokeWidth="1.5" opacity="0.8" />
          <line x1="5" y1="100" x2="25" y2="100" stroke="#00f0ff" strokeWidth="1.5" opacity="0.8" />
          <line x1="175" y1="100" x2="195" y2="100" stroke="#00f0ff" strokeWidth="1.5" opacity="0.8" />
        </g>
      )}

      {c.aura === "crimson_flame" && (
        <g filter="url(#heavy-glow)">
          <circle cx="100" cy="100" r="90" fill="url(#flame-grad)" />
          {/* Rising flame tongues */}
          <path d="M40 180 Q30 110 55 90 Q40 130 65 170 Z" fill="#ff0055" opacity="0.6" />
          <path d="M160 180 Q170 110 145 90 Q160 130 135 170 Z" fill="#ff0055" opacity="0.6" />
          <path d="M100 20 Q120 50 110 80 Q95 50 100 20 Z" fill="#ea580c" opacity="0.7" />
        </g>
      )}

      {c.aura === "void_storm" && (
        <g filter="url(#neon-glow)">
          <circle cx="100" cy="100" r="90" fill="url(#void-grad)" />
          <circle cx="100" cy="100" r="82" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="16 10" opacity="0.7" />
          <path d="M70 15 Q100 5 130 15 Q100 35 70 15 Z" fill="#c084fc" opacity="0.5" />
          <path d="M70 185 Q100 195 130 185 Q100 165 70 185 Z" fill="#c084fc" opacity="0.5" />
        </g>
      )}

      {c.aura === "golden_radiance" && (
        <g filter="url(#neon-glow)">
          <circle cx="100" cy="100" r="90" fill="url(#gold-grad)" />
          <circle cx="100" cy="100" r="75" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2 6" opacity="0.8" />
          {/* Sunburst points */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => (
            <line
              key={idx}
              x1="100"
              y1="100"
              x2={100 + 82 * Math.cos((angle * Math.PI) / 180)}
              y2={100 + 82 * Math.sin((angle * Math.PI) / 180)}
              stroke="#fef08a"
              strokeWidth="1.5"
              strokeDasharray="6 80"
              opacity="0.8"
            />
          ))}
        </g>
      )}

      {/* ======================================================== */}
      {/* 2. BODY & LEGS (BADASS CHIBI PROPORTIONS) */}
      {/* ======================================================== */}
      <g id="body-base">
        {/* Legs / Boots */}
        <rect x="76" y="145" width="18" height="28" rx="8" fill="#171717" stroke="#404040" strokeWidth="1.5" />
        <rect x="106" y="145" width="18" height="28" rx="8" fill="#171717" stroke="#404040" strokeWidth="1.5" />
        {/* Boot neon plates */}
        <path d="M78 162 H92" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <path d="M108 162 H122" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

        {/* Torso Base */}
        <path d="M70 115 L130 115 L124 150 L76 150 Z" fill="#1f2937" stroke="#111827" strokeWidth="2" />
      </g>

      {/* ======================================================== */}
      {/* 3. OUTFIT / COSTUME */}
      {/* ======================================================== */}
      {c.outfit === "mecha_striker" && (
        <g id="outfit-mecha">
          {/* Mecha chestplate */}
          <path d="M72 114 L128 114 L120 148 L80 148 Z" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Arc Reactor Core */}
          <polygon points="100,124 107,135 93,135" fill="#00f0ff" filter="url(#neon-glow)" />
          {/* Shoulder Armor Plates */}
          <rect x="56" y="112" width="18" height="16" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
          <rect x="126" y="112" width="18" height="16" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Neon energy lines */}
          <line x1="84" y1="120" x2="84" y2="142" stroke="#00f0ff" strokeWidth="1.5" opacity="0.8" />
          <line x1="116" y1="120" x2="116" y2="142" stroke="#00f0ff" strokeWidth="1.5" opacity="0.8" />
        </g>
      )}

      {c.outfit === "cyber_trench" && (
        <g id="outfit-trench">
          {/* Longcoat flapping */}
          <path d="M66 116 L134 116 L140 162 L122 152 L100 155 L78 152 L60 162 Z" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
          {/* High neon collar */}
          <path d="M68 108 L78 126 L122 126 L132 108 Z" fill="#27272a" stroke="#00f0ff" strokeWidth="1.5" />
          <line x1="78" y1="128" x2="78" y2="152" stroke="#00f0ff" strokeWidth="1.5" />
          <line x1="122" y1="128" x2="122" y2="152" stroke="#00f0ff" strokeWidth="1.5" />
          {/* Tactical Belt */}
          <rect x="74" y="140" width="52" height="6" rx="2" fill="#3f3f46" />
          <rect x="96" y="139" width="8" height="8" rx="1" fill="#f59e0b" />
        </g>
      )}

      {c.outfit === "assassin_cowl" && (
        <g id="outfit-assassin">
          {/* Dark serrated robe */}
          <path d="M65 116 L135 116 L132 165 L118 155 L100 165 L82 155 L68 165 Z" fill="#09090b" stroke="#3b0764" strokeWidth="1.5" />
          {/* Shoulder mantle */}
          <path d="M58 114 Q100 128 142 114 L138 126 Q100 138 62 126 Z" fill="#1e1b4b" stroke="#6366f1" strokeWidth="1.5" />
          <circle cx="100" cy="122" r="4" fill="#a855f7" filter="url(#neon-glow)" />
        </g>
      )}

      {c.outfit === "ronin_haori" && (
        <g id="outfit-ronin">
          {/* Flowing Kimono / Haori */}
          <path d="M62 115 L138 115 L136 158 L120 152 L100 154 L80 152 L64 158 Z" fill="#450a0a" stroke="#991b1b" strokeWidth="1.5" />
          {/* Crossed collar lapels */}
          <path d="M78 115 L100 138 L122 115" stroke="#fef2f2" strokeWidth="3" fill="none" />
          <path d="M82 115 L100 134 L118 115" stroke="#b91c1c" strokeWidth="2" fill="none" />
          {/* Dragon/Cloud print */}
          <circle cx="100" cy="144" r="5" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
        </g>
      )}

      {c.outfit === "tactical_vest" && (
        <g id="outfit-tactical">
          <path d="M72 115 L128 115 L124 148 L76 148 Z" fill="#1c1917" stroke="#44403c" strokeWidth="2" />
          {/* Molle webbing */}
          <line x1="80" y1="124" x2="120" y2="124" stroke="#78716c" strokeWidth="2" strokeDasharray="4 2" />
          <line x1="80" y1="132" x2="120" y2="132" stroke="#78716c" strokeWidth="2" strokeDasharray="4 2" />
          <line x1="80" y1="140" x2="120" y2="140" stroke="#78716c" strokeWidth="2" strokeDasharray="4 2" />
        </g>
      )}

      {c.outfit === "royal_robe" && (
        <g id="outfit-royal">
          <path d="M64 115 L136 115 L140 162 L120 150 L100 154 L80 150 L60 162 Z" fill="#312e81" stroke="#4338ca" strokeWidth="1.5" />
          {/* Ermine fur trim */}
          <rect x="68" y="114" width="64" height="8" rx="4" fill="#f8fafc" stroke="#cbd5e1" />
          <circle cx="78" cy="118" r="1.5" fill="#0f172a" />
          <circle cx="90" cy="118" r="1.5" fill="#0f172a" />
          <circle cx="102" cy="118" r="1.5" fill="#0f172a" />
          <circle cx="114" cy="118" r="1.5" fill="#0f172a" />
          <circle cx="124" cy="118" r="1.5" fill="#0f172a" />
        </g>
      )}

      {/* ======================================================== */}
      {/* 4. CHIBI HEAD & FACE */}
      {/* ======================================================== */}
      <g id="chibi-head">
        {/* Neck */}
        <rect x="92" y="105" width="16" height="14" rx="4" fill={skinShadow} />

        {/* Big Badass Chibi Head */}
        <rect x="60" y="45" width="80" height="66" rx="28" fill={skinHex} stroke={skinShadow} strokeWidth="1.5" />

        {/* Ears */}
        <circle cx="58" cy="80" r="7" fill={skinHex} stroke={skinShadow} strokeWidth="1" />
        <circle cx="142" cy="80" r="7" fill={skinHex} stroke={skinShadow} strokeWidth="1" />
        {/* Cyber Ear Studs */}
        <circle cx="56" cy="82" r="1.5" fill="#00f0ff" />
        <circle cx="144" cy="82" r="1.5" fill="#00f0ff" />

        {/* Eyes & Face Expressions */}
        {c.faceExpression === "glowing_cyber" && (
          <g id="face-cyber">
            {/* Cyber Visor Right Eye / Left Eye */}
            <circle cx="82" cy="78" r="6" fill="#0f172a" />
            <circle cx="82" cy="78" r="3" fill="#00f0ff" filter="url(#neon-glow)" />

            <circle cx="118" cy="78" r="6" fill="#0f172a" />
            <circle cx="118" cy="78" r="3.5" fill="#ff0055" filter="url(#neon-glow)" />
            {/* Cyber scanning reticle lines */}
            <path d="M112 78 H124" stroke="#ff0055" strokeWidth="0.8" opacity="0.8" />
            <path d="M118 72 V84" stroke="#ff0055" strokeWidth="0.8" opacity="0.8" />

            {/* Fierce Eyebrows */}
            <path d="M74 70 L92 74" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            <path d="M126 70 L108 74" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />

            {/* Battle scar on right cheek */}
            <path d="M78 86 L86 96" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M76 90 L84 89" stroke="#b91c1c" strokeWidth="1" />

            {/* Determined mouth */}
            <path d="M94 94 Q100 96 106 94" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {c.faceExpression === "oni_fury" && (
          <g id="face-oni">
            {/* Blood red fierce eyes */}
            <polygon points="76,74 92,79 78,82" fill="#ef4444" filter="url(#neon-glow)" />
            <polygon points="124,74 108,79 122,82" fill="#ef4444" filter="url(#neon-glow)" />
            {/* Oni half-mask on mouth with sharp fangs */}
            <path d="M84 90 Q100 98 116 90 L114 104 Q100 110 86 104 Z" fill="#18181b" stroke="#ef4444" strokeWidth="1.5" />
            <polygon points="92,94 96,100 94,94" fill="#ffffff" />
            <polygon points="108,94 104,100 106,94" fill="#ffffff" />
          </g>
        )}

        {c.faceExpression === "smirk_scar" && (
          <g id="face-smirk">
            {/* Sharp Anime Eyes */}
            <path d="M74 76 Q84 72 92 78" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="84" cy="80" r="3" fill="#f59e0b" />

            <path d="M126 76 Q116 72 108 78" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="116" cy="80" r="3" fill="#f59e0b" />

            {/* Vertical eye scar */}
            <line x1="84" y1="66" x2="84" y2="88" stroke="#991b1b" strokeWidth="1.5" />

            {/* Confident smirking mouth */}
            <path d="M96 95 Q104 98 110 91" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        )}

        {c.faceExpression === "cool_shades" && (
          <g id="face-shades">
            {/* Badass Black Sunglasses */}
            <polygon points="70,72 96,72 92,86 74,86" fill="#09090b" stroke="#27272a" strokeWidth="1.5" />
            <polygon points="104,72 130,72 126,86 108,86" fill="#09090b" stroke="#27272a" strokeWidth="1.5" />
            <line x1="96" y1="74" x2="104" y2="74" stroke="#27272a" strokeWidth="2" />
            {/* White neon reflection */}
            <line x1="74" y1="75" x2="88" y2="75" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
            <line x1="108" y1="75" x2="122" y2="75" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
            {/* Smirk */}
            <path d="M95 94 H105" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {c.faceExpression === "shadow_void" && (
          <g id="face-void">
            {/* Deep shadow across upper face */}
            <path d="M60 45 H140 V82 Q100 90 60 82 Z" fill="#09090b" opacity="0.85" />
            {/* Pure white piercing glow dots */}
            <circle cx="82" cy="76" r="3.5" fill="#ffffff" filter="url(#neon-glow)" />
            <circle cx="118" cy="76" r="3.5" fill="#ffffff" filter="url(#neon-glow)" />
            <path d="M96 95 Q100 98 104 95" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>
        )}
      </g>

      {/* ======================================================== */}
      {/* 5. HAIRSTYLE */}
      {/* ======================================================== */}
      <g id="hair-layer">
        {c.hairStyle === "spiky_cyber" && (
          <g id="hair-spiky">
            {/* Wild anime spikes on top */}
            <path
              d="M56 60 L45 35 L65 42 L72 20 L86 38 L100 15 L114 38 L128 20 L135 42 L155 35 L144 60 L140 75 Q100 50 60 75 Z"
              fill={c.hairColor}
              stroke="#0f172a"
              strokeWidth="2"
            />
            {/* Hair bangs framing face */}
            <polygon points="62,60 75,76 74,62" fill={c.hairColor} />
            <polygon points="138,60 125,76 126,62" fill={c.hairColor} />
            <polygon points="94,48 100,68 106,48" fill={c.hairColor} />
          </g>
        )}

        {c.hairStyle === "ninja_ponytail" && (
          <g id="hair-ponytail">
            {/* High tied ponytail flying behind */}
            <path d="M120 30 Q160 10 175 40 Q150 45 125 35 Z" fill={c.hairColor} stroke="#0f172a" strokeWidth="1.5" />
            <circle cx="120" cy="32" r="4" fill="#ef4444" />
            {/* Front sleek hair */}
            <path d="M58 64 Q64 36 100 36 Q136 36 142 64 Q100 48 58 64 Z" fill={c.hairColor} stroke="#0f172a" strokeWidth="2" />
            {/* Long sideburns */}
            <path d="M60 62 L66 90 L70 64" fill={c.hairColor} />
            <path d="M140 62 L134 90 L130 64" fill={c.hairColor} />
          </g>
        )}

        {c.hairStyle === "wolf_wild" && (
          <g id="hair-wolf">
            {/* Jagged wolf locks */}
            <path
              d="M52 65 L40 48 L56 46 L48 26 L68 34 L82 18 L100 30 L118 18 L132 34 L152 26 L144 46 L160 48 L148 65 Q100 45 52 65 Z"
              fill={c.hairColor}
              stroke="#0f172a"
              strokeWidth="2"
            />
            <path d="M54 62 L48 85 L64 70" fill={c.hairColor} stroke="#0f172a" strokeWidth="1" />
            <path d="M146 62 L152 85 L136 70" fill={c.hairColor} stroke="#0f172a" strokeWidth="1" />
          </g>
        )}

        {c.hairStyle === "undercut_slick" && (
          <g id="hair-undercut">
            {/* Dark faded sides */}
            <rect x="58" y="52" width="10" height="25" rx="3" fill="#18181b" />
            <rect x="132" y="52" width="10" height="25" rx="3" fill="#18181b" />
            {/* Brushed-back top */}
            <path d="M64 52 Q100 24 136 52 Q100 42 64 52 Z" fill={c.hairColor} stroke="#0f172a" strokeWidth="2" />
          </g>
        )}

        {c.hairStyle === "dreads_fade" && (
          <g id="hair-dreads">
            {/* Tactical braided locks */}
            {[62, 74, 86, 100, 114, 126, 138].map((x, i) => (
              <g key={i}>
                <rect x={x - 4} y="32" width="7" height={i % 2 === 0 ? 32 : 26} rx="3" fill={c.hairColor} stroke="#0f172a" strokeWidth="1" />
                <circle cx={x - 0.5} cy="55" r="2" fill="#fbbf24" />
              </g>
            ))}
          </g>
        )}
      </g>

      {/* ======================================================== */}
      {/* 6. HEADWEAR / MASKS */}
      {/* ======================================================== */}
      {c.headwear === "cyber_kitsune" && (
        <g id="gear-kitsune" filter="url(#neon-glow)">
          {/* Half-face Kitsune Mask tilted on right temple */}
          <polygon points="126,38 142,16 144,36" fill="#ffffff" stroke="#ef4444" strokeWidth="1.5" />
          <polygon points="144,36 156,20 152,44" fill="#ffffff" stroke="#ef4444" strokeWidth="1.5" />
          <path d="M125 36 Q145 30 155 46 Q140 60 125 48 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
          {/* Red eye marking */}
          <path d="M132 44 Q142 40 148 46" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="140" cy="43" r="1.5" fill="#00f0ff" />
        </g>
      )}

      {c.headwear === "oni_horns" && (
        <g id="gear-oni-horns" filter="url(#heavy-glow)">
          {/* Curved demon horns */}
          <path d="M68 45 Q50 25 45 8 Q65 18 76 42 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.5" />
          <path d="M132 45 Q150 25 155 8 Q135 18 124 42 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.5" />
          {/* Glowing tips */}
          <circle cx="45" cy="8" r="2.5" fill="#fef08a" />
          <circle cx="155" cy="8" r="2.5" fill="#fef08a" />
        </g>
      )}

      {c.headwear === "ronin_kasa" && (
        <g id="gear-kasa">
          {/* Straw battle kasa hat */}
          <polygon points="100,18 42,54 158,54" fill="#78350f" stroke="#451a03" strokeWidth="2" />
          <line x1="100" y1="18" x2="60" y2="54" stroke="#92400e" strokeWidth="1" />
          <line x1="100" y1="18" x2="80" y2="54" stroke="#92400e" strokeWidth="1" />
          <line x1="100" y1="18" x2="100" y2="54" stroke="#92400e" strokeWidth="1" />
          <line x1="100" y1="18" x2="120" y2="54" stroke="#92400e" strokeWidth="1" />
          <line x1="100" y1="18" x2="140" y2="54" stroke="#92400e" strokeWidth="1" />
        </g>
      )}

      {c.headwear === "holo_visor" && (
        <g id="gear-visor" filter="url(#neon-glow)">
          {/* Cyan holographic scanner band */}
          <path d="M58 70 L142 70 L138 84 L62 84 Z" fill="#00f0ff" fillOpacity="0.4" stroke="#00f0ff" strokeWidth="1.5" />
          <line x1="65" y1="77" x2="135" y2="77" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="6 3" />
        </g>
      )}

      {c.headwear === "demon_crown" && (
        <g id="gear-crown" filter="url(#neon-glow)">
          {/* Spiked dark iron crown */}
          <polygon points="68,48 76,28 86,40 100,20 114,40 124,28 132,48" fill="#18181b" stroke="#a855f7" strokeWidth="2" />
          <polygon points="96,24 100,16 104,24 100,32" fill="#c084fc" />
        </g>
      )}

      {/* ======================================================== */}
      {/* 7. WEAPON / HANDHELD (ACTION STANCE) */}
      {/* ======================================================== */}
      {c.weapon === "laser_katana" && (
        <g id="weapon-katana" filter="url(#heavy-glow)">
          {/* Katana hilt */}
          <rect x="140" y="118" width="8" height="24" rx="2" fill="#18181b" stroke="#71717a" strokeWidth="1" transform="rotate(-30 140 118)" />
          {/* Tsuba guard */}
          <ellipse cx="145" cy="118" rx="8" ry="3" fill="#fbbf24" transform="rotate(-30 145 118)" />
          {/* Glowing laser blade */}
          <polygon points="144,115 178,25 186,22 152,112" fill="url(#laser-katana)" />
        </g>
      )}

      {c.weapon === "dragon_scepter" && (
        <g id="weapon-scepter" filter="url(#neon-glow)">
          {/* Staff pole */}
          <rect x="146" y="55" width="6" height="110" rx="3" fill="#451a03" stroke="#fbbf24" strokeWidth="1" />
          {/* Dragon / King Chess Head */}
          <circle cx="149" cy="48" r="14" fill="#18181b" stroke="#fbbf24" strokeWidth="2" />
          {/* Floating energy chess orb */}
          <circle cx="149" cy="48" r="6" fill="#fbbf24" filter="url(#heavy-glow)" />
          <path d="M149 32 L149 38 M146 35 L152 35" stroke="#fbbf24" strokeWidth="2" />
        </g>
      )}

      {c.weapon === "werewolf_claws" && (
        <g id="weapon-claws" filter="url(#neon-glow)">
          {/* Triple silver claw blades on right hand */}
          <path d="M136 128 Q155 120 168 108" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
          <path d="M138 134 Q160 128 174 118" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M136 140 Q155 138 168 132" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
          {/* Blood tips */}
          <circle cx="168" cy="108" r="2" fill="#ef4444" />
          <circle cx="174" cy="118" r="2" fill="#ef4444" />
          <circle cx="168" cy="132" r="2" fill="#ef4444" />
        </g>
      )}

      {c.weapon === "plasma_pistols" && (
        <g id="weapon-blaster" filter="url(#neon-glow)">
          {/* Futuristic dual blasters */}
          <rect x="135" y="122" width="22" height="10" rx="3" fill="#18181b" stroke="#00f0ff" strokeWidth="1.5" />
          <rect x="132" y="128" width="8" height="12" rx="2" fill="#27272a" />
          {/* Muzzle energy tip */}
          <circle cx="158" cy="127" r="3" fill="#00f0ff" />
        </g>
      )}

      {c.weapon === "mythic_cards" && (
        <g id="weapon-cards" filter="url(#neon-glow)">
          {/* Floating glowing cards */}
          <rect x="136" y="105" width="14" height="20" rx="2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" transform="rotate(-15 136 105)" />
          <rect x="146" y="95" width="14" height="20" rx="2" fill="#00f0ff" stroke="#ffffff" strokeWidth="1.2" transform="rotate(10 146 95)" />
          <rect x="156" y="110" width="14" height="20" rx="2" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.2" transform="rotate(30 156 110)" />
        </g>
      )}
    </svg>
  );
}

/**
 * Helper to export the Chibi Character as an SVG Data URI
 * for saving to Supabase profiles.avatar_url or image tags
 */
export function generateChibiSvgDataUri(character: ChibiCharacter): string {
  // A clean self-contained SVG for external image display
  const svgString = `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" rx="40" fill="#0a0a0a"/>
    <circle cx="100" cy="100" r="75" fill="#171717" stroke="#333" stroke-width="2"/>
    <circle cx="100" cy="100" r="70" fill="${character.aura === 'crimson_flame' ? '#ff005522' : character.aura === 'golden_radiance' ? '#fbbf2422' : '#00f0ff22'}"/>
    <!-- Head -->
    <rect x="65" y="55" width="70" height="60" rx="24" fill="${character.skinTone === 'fair' ? '#fde2d4' : character.skinTone === 'tan' ? '#f59e0b' : character.skinTone === 'dark' ? '#603813' : '#e2e8f0'}"/>
    <!-- Hair -->
    <path d="M60 68 L50 45 L68 52 L76 30 L90 48 L100 25 L110 48 L124 30 L132 52 L150 45 L140 68 Z" fill="${character.hairColor}"/>
    <!-- Eyes -->
    <circle cx="85" cy="85" r="5" fill="#00f0ff"/>
    <circle cx="115" cy="85" r="5" fill="#ff0055"/>
    <!-- Torso & Armor -->
    <path d="M72 120 L128 120 L122 160 L78 160 Z" fill="#1e293b" stroke="#00f0ff" stroke-width="2"/>
    <polygon points="100,130 106,140 94,140" fill="#00f0ff"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}
