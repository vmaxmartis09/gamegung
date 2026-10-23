"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { MessageCircle, Trophy, UserRound, Wallet, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { usePresenceStore } from "@/lib/presence";
import { useUiStore } from "@/lib/ui-store";
import { UserAvatar } from "@/components/ui/user-avatar";
import AccountMenu, { type ManualStatus } from "@/components/kokonut/account-menu";
import MessageStack, { type StackMessage } from "@/components/kokonut/message-stack";
import { Aurora } from "@/components/reactbits/aurora";
import { cn } from "@/lib/utils";

const DailyBackground = dynamic(
  () => import("@/components/layout/daily-background").then((m) => m.DailyBackground),
  {
    ssr: false,
    loading: () => <Aurora />,
  }
);

const ChatDrawer = dynamic(() => import("@/components/social/chat-drawer").then((m) => m.ChatDrawer), { ssr: false });
const GameRoomDock = dynamic(() => import("@/components/social/game-room-dock").then((m) => m.GameRoomDock), { ssr: false });
const WalletModal = dynamic(() => import("@/components/social/wallet-modal").then((m) => m.WalletModal), { ssr: false });
const RankingModal = dynamic(() => import("@/components/social/ranking-modal").then((m) => m.RankingModal), { ssr: false });
const ProfileModal = dynamic(() => import("@/components/social/profile-modal").then((m) => m.ProfileModal), { ssr: false });
const MatchmakingModal = dynamic(() => import("@/components/matchmaking/matchmaking-modal").then((m) => m.MatchmakingModal), { ssr: false });
const RulesModal = dynamic(() => import("@/components/games/rules-modal").then((m) => m.RulesModal), { ssr: false });

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const inGame = pathname.startsWith("/games");
  const gameId = pathname.match(/^\/games\/([^/]+)/)?.[1];
  // Khi khung chat mở, nội dung nhường chỗ (đẩy sang trái) thay vì bị chat đè lên.
  const chatShown = useAppStore((st) => st.isChatOpen && !st.isChatCollapsed);
  const chatPad = chatShown ? "sm:pr-[392px] xl:pr-[432px]" : "";
  // Freeze looping CSS animations while the tab is hidden.
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute("data-tab-hidden", document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <DailyBackground />
      {inGame ? (
        <main className={cn("relative z-10 flex h-dvh w-full flex-col overflow-hidden transition-[padding] duration-300 ease-out", chatPad)}>{children}</main>
      ) : (
        <main className={cn("relative z-10 pb-20 pt-4 transition-[padding] duration-300 ease-out sm:pt-6", chatPad)}>{children}</main>
      )}
      {gameId && (
        <Suspense fallback={null}>
          <RoomDockGate gameId={gameId} />
        </Suspense>
      )}
      <ChatBubble />
      <GlobalModals />
    </MotionConfig>
  );
}

/* ---------------------------------- Dock ---------------------------------- */

/** The game's open lobby room; hidden at an online match table, which has its own private room. */
function RoomDockGate({ gameId }: { gameId: string }) {
  const q = useSearchParams();
  if (q?.get("match") || q?.get("bet")) return null;
  return <GameRoomDock key={gameId} game={gameId} />;
}

/* ------------------------- Chat (always on, right) ------------------------- */

function ChatBubble() {
  return <ChatDrawer />;
}

/* ------------------------------ Global modals ------------------------------ */

function GlobalModals() {
  const modal = useUiStore((s) => s.modal);
  const close = useUiStore((s) => s.close);
  const matchmakingGame = useUiStore((s) => s.matchmakingGame);
  const rulesGame = useUiStore((s) => s.rulesGame);
  switch (modal) {
    case "wallet":
      return <WalletModal isOpen onClose={close} />;
    case "ranking":
      return <RankingModal isOpen onClose={close} />;
    case "profile":
      return <ProfileModal isOpen onClose={close} />;
    case "matchmaking":
      return <MatchmakingModal isOpen onClose={close} initialGame={matchmakingGame} />;
    case "rules":
      return <RulesModal isOpen onClose={close} gameType={rulesGame} />;
    default:
      return null;
  }
}
