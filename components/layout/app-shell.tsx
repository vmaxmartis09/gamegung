"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { MessageCircle, Trophy, UserRound, Wallet, Wand2, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { usePresenceStore } from "@/lib/presence";
import { useUiStore } from "@/lib/ui-store";
import { UserAvatar } from "@/components/ui/user-avatar";
import AccountMenu, { type ManualStatus } from "@/components/kokonut/account-menu";
import MessageStack, { type StackMessage } from "@/components/kokonut/message-stack";
import { Aurora } from "@/components/reactbits/aurora";
import { cn } from "@/lib/utils";

const ChatDrawer = dynamic(() => import("@/components/social/chat-drawer").then((m) => m.ChatDrawer), { ssr: false });
const WalletModal = dynamic(() => import("@/components/social/wallet-modal").then((m) => m.WalletModal), { ssr: false });
const RankingModal = dynamic(() => import("@/components/social/ranking-modal").then((m) => m.RankingModal), { ssr: false });
const ProfileModal = dynamic(() => import("@/components/social/profile-modal").then((m) => m.ProfileModal), { ssr: false });
const MatchmakingModal = dynamic(() => import("@/components/matchmaking/matchmaking-modal").then((m) => m.MatchmakingModal), { ssr: false });
const CharacterCreatorModal = dynamic(() => import("@/components/character/character-creator-modal").then((m) => m.CharacterCreatorModal), { ssr: false });
const RulesModal = dynamic(() => import("@/components/games/rules-modal").then((m) => m.RulesModal), { ssr: false });

export function AppShell({ children }: { children: React.ReactNode }) {
  // Freeze looping CSS animations while the tab is hidden.
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute("data-tab-hidden", document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return (
    <>
      <Aurora />
      <main className="relative z-10 pb-32 pt-5 sm:pt-6 lg:pr-[512px]">{children}</main>
      <ChatBubble />
      <GlobalModals />
    </>
  );
}

/* ---------------------------------- Dock ---------------------------------- */

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
    case "creator":
      return <CharacterCreatorModal isOpen onClose={close} />;
    case "rules":
      return <RulesModal isOpen onClose={close} gameType={rulesGame} />;
    default:
      return null;
  }
}
