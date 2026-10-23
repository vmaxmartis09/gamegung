"use client";
import { UserAvatar } from "@/components/ui/user-avatar";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trophy,
  Award,
  Crown,
  Medal,
  Swords,
  Shield,
  Check,
  Lock,
  Sparkles,
  Flame,
  Users,
  Radio,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  GAME_BADGES,
  RANK_TIERS,
  getRankTier,
  GameType,
  BadgeDefinition,
} from "@/lib/ranking-system";
import { fetchLeaderboardFromSupabase, SupabaseLeaderboardItem } from "@/lib/supabase-game";
import { SpotlightCard } from "@/components/reactbits/spotlight-card";
import { cn } from "@/lib/utils";

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "lua" | "chess" | "xiangqi" | "werewolf" | "arcade" | "uno" | "badges";
}

export function RankingModal({
  isOpen,
  onClose,
  defaultTab = "lua",
}: RankingModalProps) {
  const { currentUser, friends, equipBadge, unequipBadge } = useAppStore();
  const [activeTab, setActiveTab] = useState<
    "lua" | "chess" | "xiangqi" | "werewolf" | "arcade" | "uno" | "badges"
  >(defaultTab);
  const [badgeFilter, setBadgeFilter] = useState<GameType | "all">("all");
  const [supabaseLeaderboard, setSupabaseLeaderboard] = useState<SupabaseLeaderboardItem[] | null>(null);

  // Fetch from Supabase when modal opens or tab changes
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "badges") return;
    fetchLeaderboardFromSupabase(activeTab).then((data) => {
      if (data && data.length > 0) {
        setSupabaseLeaderboard(data);
      }
    });
  }, [isOpen, activeTab]);

  // Combine currentUser and friends/supabase for ranking tables
  const effectivePlayers = React.useMemo(() => {
    if (supabaseLeaderboard && supabaseLeaderboard.length > 0) {
      const hasMe = supabaseLeaderboard.some((p) => p.id === currentUser.id);
      const list = supabaseLeaderboard.map((p) => ({
        ...p,
        isMe: p.id === currentUser.id,
      }));
      if (!hasMe) {
        list.push({
          id: currentUser.id,
          username: currentUser.username,
          avatar: currentUser.avatar,
          title: currentUser.title,
          isMe: true,
          lua: currentUser.lua,
          eloChess: currentUser.eloChess,
          eloXiangqi: currentUser.eloXiangqi,
          eloWerewolf: currentUser.eloWerewolf,
          eloArcade: currentUser.eloArcade ?? 1200,
          eloUno: currentUser.eloUno ?? 1200,
          score: currentUser.score,
          equippedBadges: currentUser.equippedBadges,
          stats: currentUser.stats,
        });
      }
      return list;
    }

    return [
      {
        id: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
        title: currentUser.title,
        isMe: true,
        lua: currentUser.lua,
        eloChess: currentUser.eloChess,
        eloXiangqi: currentUser.eloXiangqi,
        eloWerewolf: currentUser.eloWerewolf,
        eloArcade: currentUser.eloArcade ?? 1200,
        eloUno: currentUser.eloUno ?? 1200,
        score: currentUser.score,
        equippedBadges: currentUser.equippedBadges,
        stats: currentUser.stats,
      },
      ...friends.map((f) => ({
        id: f.id,
        username: f.username,
        avatar: f.avatar,
        title: f.title,
        isMe: false,
        lua: f.lua,
        eloChess: f.eloChess,
        eloXiangqi: f.eloXiangqi,
        eloWerewolf: f.eloWerewolf,
        eloArcade: f.eloArcade ?? 1200,
        eloUno: f.eloUno ?? 1200,
        score: Math.round((f.eloChess + f.eloXiangqi + f.eloWerewolf + (f.eloArcade ?? 1200) + (f.eloUno ?? 1200)) / 5),
        equippedBadges: f.equippedBadges || [],
        stats: {
          chess: { wins: Math.floor((f.eloChess - 1000) / 40), games: Math.floor((f.eloChess - 1000) / 20) },
          xiangqi: { wins: Math.floor((f.eloXiangqi - 1000) / 40), games: Math.floor((f.eloXiangqi - 1000) / 20) },
          werewolf: { wins: Math.floor((f.eloWerewolf - 1000) / 40), games: Math.floor((f.eloWerewolf - 1000) / 20) },
          arcade: { wins: Math.floor(((f.eloArcade ?? 1200) - 1000) / 40), games: Math.floor(((f.eloArcade ?? 1200) - 1000) / 20) },
        },
      })),
    ];
  }, [supabaseLeaderboard, currentUser, friends]);

  // Sorting helpers
  const sortedByLua = [...effectivePlayers].sort((a, b) => b.lua - a.lua);
  const sortedByChess = [...effectivePlayers].sort((a, b) => b.eloChess - a.eloChess);
  const sortedByXiangqi = [...effectivePlayers].sort((a, b) => b.eloXiangqi - a.eloXiangqi);
  const sortedByWerewolf = [...effectivePlayers].sort((a, b) => b.eloWerewolf - a.eloWerewolf);
  const sortedByArcade = [...effectivePlayers].sort((a, b) => (b.eloArcade || 1200) - (a.eloArcade || 1200));
  const sortedByUno = [...effectivePlayers].sort((a, b) => ((b as any).eloUno || 1200) - ((a as any).eloUno || 1200));

  const getRankMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  const filteredBadges =
    badgeFilter === "all"
      ? GAME_BADGES
      : GAME_BADGES.filter((b) => b.gameType === badgeFilter || b.gameType === "all");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            className="modal-shell max-w-3xl !p-0"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shadow-inner">
                  <Trophy className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold tracking-tight text-white flex items-center gap-2">
                    Bảng xếp hạng & huy hiệu
                  </h3>
                  <p className="text-xs font-mono text-ink-400">
                    Đấu trường công sở • Chuẩn ELO & Quỹ Lúa Văn Phòng
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-6 border-b border-ink-800/80 bg-ink-900/30 overflow-x-auto no-scrollbar">
              {[
                { id: "lua", label: "🌾 Top Lúa", desc: "Tài phú" },
                { id: "chess", label: "♟️ Cờ Vua", desc: "FIDE Elo" },
                { id: "xiangqi", label: "🀄 Cờ Tướng", desc: "Á Đông Elo" },
                { id: "werewolf", label: "🐺 Ma Sói", desc: "Tâm lý Elo" },
                { id: "uno", label: "🎴 Uno Battle", desc: "Party Elo" },
                { id: "badges", label: "🏅 Kho Huy Hiệu", desc: "Thành tựu" },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 py-3.5 px-4 text-xs font-semibold whitespace-nowrap border-b-2 transition-all",
                      isActive
                        ? "border-accent text-accent bg-accent/5"
                        : "border-transparent text-ink-400 hover:text-ink-200"
                    )}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
              {/* TAB 1: LÚA RANKING */}
              {activeTab === "lua" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <p className="text-xs font-mono text-ink-400">
                      Bảng xếp hạng tài sản Lúa 🌾 trong toàn công ty
                    </p>
                    <span className="text-xs font-mono text-accent">
                      Đơn vị: Lúa (🌾)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sortedByLua.map((player, idx) => (
                      <SpotlightCard
                        key={player.id}
                        className={cn(
                          "p-3.5 rounded-2xl border flex items-center justify-between transition-all",
                          player.isMe
                            ? "bg-accent/10 border-accent/40"
                            : "bg-white/[0.03] border-white/[0.07] hover:border-white/20",
                          idx === 0 && "bg-gradient-to-r from-accent/[0.14] to-transparent border-accent/30"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="w-8 text-center font-bold text-sm font-mono text-ink-300">
                            {getRankMedal(idx)}
                          </span>
                          <UserAvatar src={player.avatar} name={player.username} className="w-10 h-10 rounded-full border border-ink-700 bg-ink-950" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {player.username}
                              </span>
                              {player.isMe && (
                                <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-accent text-black">
                                  BẠN
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono text-ink-400">
                              {player.title}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-baseline justify-end gap-1 font-mono font-bold text-base text-accent">
                            <span>{player.lua.toLocaleString()}</span>
                            <span className="text-sm">🌾</span>
                          </div>
                          <span className="text-xs font-mono text-ink-500">
                            Hạng #{idx + 1}
                          </span>
                        </div>
                      </SpotlightCard>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2, 3, 4, 5, 6: GAME ELO RANKINGS */}
              {(activeTab === "chess" || activeTab === "xiangqi" || activeTab === "werewolf" || activeTab === "arcade" || activeTab === "uno") && (
                <div className="space-y-3">
                  {(() => {
                    const list =
                      activeTab === "chess"
                        ? sortedByChess
                        : activeTab === "xiangqi"
                        ? sortedByXiangqi
                        : activeTab === "werewolf"
                        ? sortedByWerewolf
                        : activeTab === "arcade"
                        ? sortedByArcade
                        : sortedByUno;

                    const eloKey =
                      activeTab === "chess"
                        ? "eloChess"
                        : activeTab === "xiangqi"
                        ? "eloXiangqi"
                        : activeTab === "werewolf"
                        ? "eloWerewolf"
                        : activeTab === "arcade"
                        ? "eloArcade"
                        : "eloUno";

                    const gameTitle =
                      activeTab === "chess"
                        ? "Cờ Vua Quốc Tế"
                        : activeTab === "xiangqi"
                        ? "Cờ Tướng Á Đông"
                        : activeTab === "werewolf"
                        ? "Ma Sói Văn Phòng"
                        : activeTab === "arcade"
                        ? "Chibi Cyber Slash"
                        : "Uno Battle Công Sở";

                    return (
                      <>
                        <div className="flex items-center justify-between pb-1">
                          <p className="text-xs font-mono text-ink-400">
                            Bảng vàng danh vọng môn {gameTitle} (Chuẩn ELO FIDE)
                          </p>
                          <span className="text-xs font-mono text-ink-300">
                            Tính điểm theo thuật toán Arpad Elo
                          </span>
                        </div>

                        <div className="space-y-2">
                          {list.map((player, idx) => {
                            const eloVal = (player as any)[eloKey] ?? 1200;
                            const tier = getRankTier(eloVal);

                            return (
                              <div
                                key={player.id}
                                className={cn(
                                  "p-3.5 rounded-2xl border flex items-center justify-between transition-all",
                                  player.isMe
                                    ? "bg-white/5 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.06)]"
                                    : "bg-ink-900/60 border-ink-800/80 hover:border-ink-700"
                                )}
                              >
                                <div className="flex items-center gap-3.5">
                                  <span className="w-8 text-center font-bold text-sm font-mono text-ink-300">
                                    {getRankMedal(idx)}
                                  </span>
                                  <div className="relative">
                                    <UserAvatar src={player.avatar} name={player.username} className="w-10 h-10 rounded-full border border-ink-700 bg-ink-950" />
                                    <span className="absolute -bottom-1 -right-1 text-xs">
                                      {tier.icon}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-white">
                                        {player.username}
                                      </span>
                                      {player.isMe && (
                                        <span className="px-1.5 py-0.2 rounded text-xs font-bold seg-active">
                                          BẠN
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span
                                        className={cn(
                                          "text-xs font-mono font-medium px-2 py-0.2 rounded-full border",
                                          tier.badgeBg,
                                          tier.borderColor,
                                          tier.color
                                        )}
                                      >
                                        {tier.name}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="font-mono font-black text-lg text-white">
                                    {eloVal}{" "}
                                    <span className="text-xs text-ink-400 font-normal">
                                      ELO
                                    </span>
                                  </div>
                                  <p className="text-xs font-mono text-ink-500">
                                    Hạng #{idx + 1} • {player.lua} 🌾
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* TAB 5: BADGES SHOWCASE */}
              {activeTab === "badges" && (
                <div className="space-y-4">
                  {/* Badge Filter Tabs */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-ink-800">
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "all", label: "Tất Cả" },
                        { id: "chess", label: "♟️ Cờ Vua" },
                        { id: "xiangqi", label: "🀄 Cờ Tướng" },
                        { id: "werewolf", label: "🐺 Ma Sói" },
                        { id: "uno", label: "🎴 Uno Battle" },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setBadgeFilter(f.id as any)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            badgeFilter === f.id
                              ? "seg-active font-semibold"
                              : "bg-ink-900 text-ink-400 hover:text-white"
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <span className="text-xs font-mono text-ink-400">
                      Đã mở khóa:{" "}
                      <span className="text-accent font-bold">
                        {currentUser.badges.length}
                      </span>{" "}
                      / {GAME_BADGES.length}
                    </span>
                  </div>

                  {/* Equipped Badges Bar */}
                  <div className="p-3.5 rounded-2xl bg-ink-900/80 border border-ink-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        Huy Hiệu Đang Đeo ({currentUser.equippedBadges.length}/3)
                      </p>
                      <p className="text-xs font-mono text-ink-400 mt-0.5">
                        Hiển thị bên cạnh tên bạn trong khung chat và hồ sơ
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentUser.equippedBadges.map((bId) => {
                        const b = GAME_BADGES.find((x) => x.id === bId);
                        if (!b) return null;
                        return (
                          <div
                            key={b.id}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-ink-800 border border-ink-700 text-xs text-white"
                          >
                            <span>{b.icon}</span>
                            <span className="font-medium text-xs">{b.name}</span>
                            <button
                              type="button"
                              onClick={() => unequipBadge(b.id)}
                              className="ml-1 text-ink-400 hover:text-rose-400"
                              title="Tháo huy hiệu"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Badges Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredBadges.map((badge) => {
                      const isUnlocked = currentUser.badges.includes(badge.id);
                      const isEquipped = currentUser.equippedBadges.includes(badge.id);

                      return (
                        <div
                          key={badge.id}
                          className={cn(
                            "relative p-3.5 rounded-2xl border transition-all flex flex-col justify-between",
                            isUnlocked
                              ? "bg-ink-900/70 border-ink-700 hover:border-ink-500"
                              : "bg-ink-950/60 border-ink-900 opacity-60"
                          )}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-2xl p-2 rounded-xl bg-ink-800/80 border border-ink-700/60 flex items-center justify-center">
                                {badge.icon}
                              </span>
                              {isUnlocked ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white/15 text-white border border-white/30">
                                  ĐÃ MỞ KHÓA
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-ink-900 text-ink-500 border border-ink-800">
                                  <Lock className="w-2.5 h-2.5" /> KHÓA
                                </span>
                              )}
                            </div>

                            <div>
                              <h5 className="text-xs font-bold text-white flex items-center gap-1">
                                {badge.name}
                              </h5>
                              <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">
                                {badge.description}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-ink-800/80 flex items-center justify-between text-xs font-mono">
                            <span className="text-ink-500 truncate max-w-[130px]">
                              {badge.conditionDescription}
                            </span>

                            {isUnlocked && (
                              <button
                                type="button"
                                onClick={() =>
                                  isEquipped ? unequipBadge(badge.id) : equipBadge(badge.id)
                                }
                                className={cn(
                                  "px-2 py-1 rounded-lg text-xs font-semibold transition-colors",
                                  isEquipped
                                    ? "bg-accent/20 text-accent border border-accent/40"
                                    : "seg-active hover:bg-ink-200"
                                )}
                              >
                                {isEquipped ? "Đang Đeo" : "Đeo"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-ink-800/80 bg-ink-900/60 flex items-center justify-between text-xs text-ink-400">
              <span className="font-mono">
                Số dư hiện tại:{" "}
                <span className="text-accent font-bold">
                  {currentUser.lua.toLocaleString()} 🌾 Lúa
                </span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl seg-active font-semibold text-xs hover:bg-ink-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default RankingModal;
