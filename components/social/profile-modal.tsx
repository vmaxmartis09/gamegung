"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Award,
  Shield,
  Sparkles,
  User,
  RefreshCw,
  Trophy,
  Coins,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getRankTier, GAME_BADGES } from "@/lib/ranking-system";
import { CharacterCreatorModal } from "@/components/character/character-creator-modal";
import { ChibiAvatar } from "@/components/character/chibi-avatar";
import { TiltedCard } from "@/components/reactbits/tilted-card";
import { SpotlightCard } from "@/components/reactbits/spotlight-card";
import { CountUp } from "@/components/reactbits/count-up";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LUXURY_TITLES = [
  "Đại Kiện Tướng Bàn Trà",
  "Sói Già Phố Wall",
  "Kỳ Thánh IT",
  "Trưởng Phòng Chiến Thuật",
  "Bậc Thầy Bốc Phét",
  "Thợ Săn Bug & Sói",
  "Vua Cờ Nghỉ Trưa",
  "Chiến Thần Đàm Phán",
];

const AVATAR_SEEDS = [
  "LuxuryGamer",
  "Alex",
  "Minh",
  "Trang",
  "Tuan",
  "CyberKing",
  "Phantom",
  "Valkyrie",
  "Zenith",
  "Titan",
];

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { currentUser, setCurrentUser } = useAppStore();
  const [username, setUsername] = useState(currentUser.username);
  const [selectedTitle, setSelectedTitle] = useState(currentUser.title);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setCurrentUser({
      username: username.trim() || "Kỳ Thủ Văn Phòng",
      title: selectedTitle,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const chessTier = getRankTier(currentUser.eloChess);
  const xiangqiTier = getRankTier(currentUser.eloXiangqi);
  const werewolfTier = getRankTier(currentUser.eloWerewolf);
  const arcadeTier = getRankTier(currentUser.eloArcade ?? 1200);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            className="modal-shell max-w-lg"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="font-display text-base font-bold tracking-tight">Hồ sơ</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-5 space-y-5 no-scrollbar">
              {/* Identity card */}
              <TiltedCard maxTilt={3}>
                <SpotlightCard className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.015] p-4">
                  <div className="flex items-center gap-4">
                    <UserAvatar src={currentUser.avatar} name={currentUser.username} className="size-16" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-bold leading-tight">{currentUser.username}</p>
                      <p className="truncate text-xs text-accent">{currentUser.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="eyebrow text-[10px]">ELO tổng</p>
                      <p className="font-display text-xl font-bold tabular">
                        <CountUp value={currentUser.score} />
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
                    <span className="eyebrow text-[10px]">Số dư</span>
                    <span className="font-display text-lg font-bold tabular text-accent">
                      <CountUp value={currentUser.lua} /> <span className="text-sm">🌾</span>
                    </span>
                  </div>
                </SpotlightCard>
              </TiltedCard>

              {/* Game Ratings & Tiers Breakdown */}
              <div>
                <label className="eyebrow mb-2 block">Xếp hạng theo môn</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { icon: "♟️", name: "Cờ Vua", elo: currentUser.eloChess, tier: chessTier, st: currentUser.stats.chess },
                    { icon: "🀄", name: "Cờ Tướng", elo: currentUser.eloXiangqi, tier: xiangqiTier, st: currentUser.stats.xiangqi },
                    { icon: "🐺", name: "Ma Sói", elo: currentUser.eloWerewolf, tier: werewolfTier, st: currentUser.stats.werewolf },
                    { icon: "⚡", name: "Cyber Slash", elo: currentUser.eloArcade ?? 1200, tier: arcadeTier, st: currentUser.stats.arcade },
                  ].map((g) => (
                    <SpotlightCard key={g.name} className="panel-soft space-y-1 p-3 text-center">
                      <span className="block text-xl">{g.icon}</span>
                      <p className="text-[11px] font-semibold text-ink-100">{g.name}</p>
                      <p className="font-mono text-xs font-bold tabular text-ink-200">{g.elo} ELO</p>
                      <span className={cn("inline-block max-w-full truncate rounded-full border px-1.5 text-[9px] font-medium", g.tier.badgeBg, g.tier.borderColor, g.tier.color)}>
                        {g.tier.name.split(" ")[0]}
                      </span>
                      <p className="pt-1 font-mono text-[9px] text-ink-500">
                        {g.st?.wins ?? 0}T / {g.st?.losses ?? 0}B
                      </p>
                    </SpotlightCard>
                  ))}
                </div>
              </div>

              {/* Equipped Badges */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2 flex items-center justify-between">
                  <span>Huy Hiệu Đang Đeo ({currentUser.equippedBadges.length}/3)</span>
                  <span className="text-[10px] text-accent lowercase font-mono">
                    đã mở khóa {currentUser.badges.length} huy hiệu
                  </span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {currentUser.equippedBadges.length === 0 ? (
                    <p className="text-xs text-ink-500 italic">Chưa trang bị huy hiệu nào.</p>
                  ) : (
                    currentUser.equippedBadges.map((bId) => {
                      const b = GAME_BADGES.find((x) => x.id === bId);
                      if (!b) return null;
                      return (
                        <div
                          key={b.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-900 border border-ink-700 text-xs text-white"
                        >
                          <span className="text-base">{b.icon}</span>
                          <span className="font-semibold text-xs">{b.name}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Chibi Character & Equipment Showcase */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2.5 flex items-center justify-between">
                  <span>Nhân Vật Chibi & Ngoại Trang</span>
                  <span className="text-[10px] text-ink-300 font-mono">Chibi Badass System</span>
                </label>
                <div className="p-4 rounded-2xl bg-ink-900/60 border border-ink-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-16 h-16 rounded-2xl bg-ink-950 border border-ink-700 flex items-center justify-center overflow-hidden shadow-inner">
                      <ChibiAvatar character={currentUser.character} size={58} animate={false} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        Hệ Phái: {currentUser.character?.className || "Kỳ Thánh Kiếm Sĩ"}
                      </p>
                      <p className="text-[10px] text-ink-400 font-mono mt-0.5">
                        Phong cách Chibi ngầu lòi • Đồng bộ Supabase
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCreatorOpen(true)}
                    className="btn-ghost whitespace-nowrap px-4 py-2 text-xs"
                  >
                    🥋 Mở Tủ Đồ
                  </button>
                </div>
              </div>

              {/* Username Input */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2">
                  Biệt danh trong công ty
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: Tuấn Dev / Alex Lead / Linh HR..."
                  className="w-full bg-ink-900 border border-ink-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/60 transition-colors"
                />
              </div>

              {/* Title Selector */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-400 block mb-2">
                  Danh Hiệu Danh Dự
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LUXURY_TITLES.map((title) => {
                    const isSelected = selectedTitle === title;
                    return (
                      <button
                        key={title}
                        type="button"
                        onClick={() => setSelectedTitle(title)}
                        className={`px-3 py-2 text-xs rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? "border-accent/60 bg-accent/10 text-white font-medium"
                            : "border-ink-800 bg-ink-900/40 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                        }`}
                      >
                        <span className="truncate">{title}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-ink-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-ink-400 hover:text-white"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn-accent px-5 py-2.5 text-xs"
              >
                {saved ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Đã Lưu
                  </>
                ) : (
                  "Lưu Hồ Sơ"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Badass Chibi Character Creator & Wardrobe Modal */}
      <CharacterCreatorModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
      />
    </AnimatePresence>
  );
}

export default ProfileModal;
