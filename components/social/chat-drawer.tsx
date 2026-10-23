"use client";

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowLeft,
  Check,
  Coffee,
  Copy,
  Camera,
  Dices,
  Loader2,
  FileText,
  Gamepad2,
  Hash,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Send,
  Smile,
  LogOut,
  Swords,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAppStore, ChatMessage, ChatAttachment } from "@/lib/store";
import { usePresenceStore, sortPeers, OnlinePeer } from "@/lib/presence";
import { dmOtherId, isDmChannel, relativeTime } from "@/lib/chat";
import { GameIcon, GAME_BY_ID, GameId } from "@/components/art/game-art";
import { UserAvatar, STATUS_META, kokonutAvatar, avatarSeedFrom, KOKONUT_PREFIX } from "@/components/ui/user-avatar";
import { uploadAvatar, AVATAR_ACCEPT } from "@/lib/avatar-upload";
import { soundManager } from "@/lib/audio";
import { useUiStore } from "@/lib/ui-store";
import { useAuthStore } from "@/lib/auth";
import { getRankTier, RANK_TIERS } from "@/lib/ranking-system";
import { syncProfileToSupabase } from "@/lib/supabase-game";
import { cn } from "@/lib/utils";
import { InvitePanel } from "./invite-panel";
import { DmBubbles } from "./dm-bubbles";

const REACTIONS = ["🔥", "😂", "👏", "⚔️", "🌾"];
const QUICK_EMOJIS = ["☕", "♟️", "🐺", "⚔️", "🔥", "🏆", "🌾", "😂", "👏", "🎯", "⚡", "🎲", "😎", "💀", "🫡", "🤝"];
const GAME_URL: Record<string, string> = {
  chess: "/games/chess",
  xiangqi: "/games/xiangqi",
  werewolf: "/games/werewolf",
  uno: "/games/uno",
  arcade: "/games/arcade",
};
const GAME_LABEL: Record<string, string> = {
  chess: "Cờ Vua",
  xiangqi: "Cờ Tướng",
  werewolf: "Ma Sói",
  uno: "Deadline Rush",
  arcade: "Cyber Slash",
};

type Tab = "general" | "private" | "profile";

/** Downscale images so they fit in a realtime broadcast (~200 KB). */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const max = 960;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    let q = 0.82;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > 260_000 && q > 0.4) {
      q -= 0.12;
      out = canvas.toDataURL("image/jpeg", q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ChatDrawer() {
  const { isChatOpen, isChatCollapsed, activeChannel, myId } = useAppStore(
    useShallow((s) => ({
      isChatOpen: s.isChatOpen,
      isChatCollapsed: s.isChatCollapsed,
      activeChannel: s.activeChannel,
      myId: s.currentUser.id,
    }))
  );
  const setActiveChannel = useAppStore((s) => s.setActiveChannel);
  const setChatCollapsed = useAppStore((s) => s.setChatCollapsed);
  const [tab, setTab] = useState<Tab>("general");
  const totalUnread = useAppStore((s) => Object.values(s.unreadCounts).reduce((a, v) => a + v, 0));

  // Only two chat areas: the general room and one-to-one threads.
  const inDm = isDmChannel(activeChannel);
  useEffect(() => {
    if (inDm) setTab("private");
    else if (activeChannel !== "lounge") setActiveChannel("lounge");
  }, [inDm, activeChannel, setActiveChannel]);

  const pick = (t: Tab) => {
    setTab(t);
    if (t === "general") setActiveChannel("lounge");
  };

  // Mark channel read while it is visible.
  const unreadHere = useAppStore((s) => s.unreadCounts[s.activeChannel] || 0);
  useEffect(() => {
    if (isChatOpen && unreadHere > 0 && (tab === "general" || (tab === "private" && inDm))) useAppStore.getState().markChannelRead(activeChannel);
  }, [isChatOpen, tab, inDm, unreadHere, activeChannel]);

  return (
    <>
    <DmBubbles />
    <AnimatePresence>
      {isChatOpen && isChatCollapsed && (
        <motion.button
          key="chat-fab"
          type="button"
          onClick={() => setChatCollapsed(false)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          aria-label={totalUnread > 0 ? `Mở chat, ${totalUnread} tin chưa đọc` : "Mở chat"}
          className="fixed bottom-4 right-4 z-50 grid size-14 place-items-center rounded-full border border-white/10 bg-ink-900/90 text-white shadow-lift backdrop-blur-xl transition-transform hover:scale-105 active:scale-95"
        >
          <MessageSquare className="size-6" />
          {totalUnread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-black">{totalUnread > 99 ? "99+" : totalUnread}</span>
          )}
        </motion.button>
      )}
      {isChatOpen && !isChatCollapsed && (
        <>
          <motion.aside
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            style={{ transformOrigin: "bottom right" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-2 bottom-16 top-auto z-50 h-[70vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:inset-x-auto sm:right-3 sm:top-2.5 sm:bottom-2.5 sm:h-[calc(100dvh-1.25rem)] sm:w-[380px] xl:w-[420px]"
            aria-label="Chat văn phòng"
          >
            <DrawerHeader tab={tab} setTab={pick} onCollapse={() => setChatCollapsed(true)} />

            {tab === "general" && (
              <>
                <MessageList channelId="lounge" myId={myId} />
                <Composer channelId="lounge" />
              </>
            )}
            {tab === "private" && inDm && (
              <>
                <ThreadBar channelId={activeChannel} onBack={() => setActiveChannel("lounge")} />
                <MessageList channelId={activeChannel} myId={myId} />
                <Composer channelId={activeChannel} />
              </>
            )}
            {tab === "private" && !inDm && <PrivateHome myId={myId} />}
            {tab === "profile" && <ProfilePanel />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

function DrawerHeader({ tab, setTab, onCollapse }: { tab: Tab; setTab: (t: Tab) => void; onCollapse: () => void }) {
  const me = useAppStore(
    useShallow((s) => ({
      username: s.currentUser.username,
      avatar: s.currentUser.avatar,
      title: s.currentUser.title,
      lua: s.currentUser.lua,
      score: s.currentUser.score ?? 1200,
    }))
  );
  const myStatus = usePresenceStore((s) => s.myStatus);
  const unread = useAppStore(
    useShallow((s) => ({
      general: s.unreadCounts["lounge"] || 0,
      dm: Object.entries(s.unreadCounts).reduce((a, [k, v]) => a + (isDmChannel(k) ? v : 0), 0),
    }))
  );
  const tabs: { id: Tab; label: string; icon: React.ReactElement; badge: number }[] = [
    { id: "general", label: "Chung", icon: <Hash className="size-3.5" />, badge: tab === "general" ? 0 : unread.general },
    { id: "private", label: "Riêng", icon: <MessageSquare className="size-3.5" />, badge: unread.dm },
    { id: "profile", label: "Chi tiết", icon: <UserRound className="size-3.5" />, badge: 0 },
  ];
  return (
    <div className="border-b border-white/[0.08] p-2.5 bg-black/70 backdrop-blur-xl">
      {/* Integrated Profile Top Strip */}
      <div className="mb-2 rounded-xl border border-white/[0.075] bg-white/[0.025] p-3">
        <div className="flex items-center gap-3">
          <UserAvatar src={me.avatar} name={me.username} status={myStatus} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-100">{me.username}</p>
            <p className="truncate text-xs text-ink-400">
              {me.title} · {me.score} ELO
            </p>
          </div>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Thu nhỏ chat"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Khu vực chat" className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.07] bg-black/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "text-white" : "text-neutral-400 hover:text-white"
            )}
          >
            {tab === t.id && (
              <motion.span
                layoutId="chat-tab-pill"
                transition={{ type: "spring", damping: 32, stiffness: 420 }}
                className="absolute inset-0 rounded-lg bg-white/10 border border-white/15"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {t.icon}
              {t.label}
              {t.badge > 0 && <span className="grid min-w-4 place-items-center rounded-full bg-white px-1 text-xs font-bold text-black">{t.badge}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreadBar({ channelId, onBack }: { channelId: string; onBack: () => void }) {
  const dmPeer = useAppStore((s) => s.dmPeers[channelId]);
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
      <button type="button" onClick={onBack} className="grid size-8 place-items-center rounded-xl bg-white/[0.05] text-ink-200 hover:bg-white/[0.1]" aria-label="Danh sách chat riêng">
        <ArrowLeft className="size-4" />
      </button>
      <DmTitle channelId={channelId} fallbackName={dmPeer?.username} fallbackAvatar={dmPeer?.avatar} />
    </div>
  );
}

function DmTitle({ channelId, fallbackName, fallbackAvatar }: { channelId: string; fallbackName?: string; fallbackAvatar?: string }) {
  const myId = useAppStore((s) => s.currentUser.id);
  const otherId = dmOtherId(channelId, myId);
  const peer = usePresenceStore((s) => s.peers[otherId]);
  const name = peer?.username ?? fallbackName ?? "Đồng nghiệp";
  const status = peer?.status ?? "offline";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar src={peer?.avatar ?? fallbackAvatar} name={name} status={status} className="size-8" dotClassName="size-2.5" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{name}</p>
        <p className={cn("text-xs", STATUS_META[status].text)}>
          {STATUS_META[status].label}
          {status === "in-game" && peer?.currentGame ? ` · ${peer.currentGame}` : ""}
        </p>
      </div>
    </div>
  );
}

function MessageList({ channelId, myId }: { channelId: string; myId: string }) {
  const messages = useAppStore((s) => s.messages[channelId]);
  const list = messages || EMPTY;
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // Stick to bottom only if the reader is already near it.
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
    if (nearBottom || list[list.length - 1]?.senderId === myId) endRef.current?.scrollIntoView({ block: "end" });
  }, [list, myId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [channelId]);

  return (
    <div className="relative min-h-0 flex-1">
    <div ref={boxRef} role="log" aria-live="polite" aria-label="Tin nhắn" className="h-full overflow-y-auto px-4 py-5">
      {list.length === 0 ? (
        <div className="grid h-full place-items-center text-center">
          <div>
            <MessageSquare className="mx-auto mb-3 size-8 text-ink-500" />
            <p className="text-sm font-semibold text-ink-100">Chưa có tin nhắn</p>
            <p className="mt-1 text-xs text-ink-400">Mở lời trước đi — hoặc bấm Mời chơi để rủ một ván.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {list.map((m, i) => {
            const prev = list[i - 1];
            const grouped = !!prev && prev.senderId === m.senderId && m.timestamp - prev.timestamp < 3 * 60 * 1000 && !m.betChallenge;
            return <MessageRow key={m.id} msg={m} isMe={m.senderId === myId} grouped={grouped} myId={myId} onPreview={setPreview} />;
          })}
        </div>
      )}
      <div ref={endRef} />
      {preview && (
        <button type="button" onClick={() => setPreview(null)} className="fixed inset-0 z-[60] grid cursor-zoom-out place-items-center bg-black/90 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Ảnh phóng to" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
        </button>
      )}
    </div>
    {/* Gradual fade at the scroll edges */}
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-ink-950/90 to-transparent" />
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-ink-950/90 to-transparent" />
    </div>
  );
}

const EMPTY: ChatMessage[] = [];

const MessageRow = memo(function MessageRow({
  msg,
  isMe,
  grouped,
  myId,
  onPreview,
}: {
  msg: ChatMessage;
  isMe: boolean;
  grouped: boolean;
  myId: string;
  onPreview: (url: string) => void;
}) {
  const toggleReaction = useAppStore((s) => s.toggleReaction);
  const [copied, setCopied] = useState(false);

  if (msg.senderId === "system") {
    return (
      <div className="my-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink-300">⚖️ Trọng tài</p>
        <p className="mt-1 text-xs text-ink-100">{msg.content}</p>
      </div>
    );
  }

  const reactions = msg.reactions ? Object.entries(msg.reactions) : [];
  const time = new Date(msg.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("group relative flex animate-fade-up gap-2.5", isMe && "flex-row-reverse", grouped ? "mt-0.5" : "mt-3.5")}>
      <div className="w-8 shrink-0">{!grouped && <UserAvatar src={msg.senderAvatar} name={msg.senderName} className="size-8" />}</div>
      <div className={cn("flex min-w-0 max-w-[82%] flex-col", isMe && "items-end")}>
        {!grouped && (
          <div className={cn("mb-1 flex items-baseline gap-2 text-xs", isMe && "flex-row-reverse")}>
            <span className="font-bold text-ink-100">{isMe ? "Bạn" : msg.senderName}</span>
            <span className="text-ink-500">{time}</span>
          </div>
        )}
        <div className="relative">
          {/* Hover toolbar */}
          <div
            className={cn(
              "pointer-events-none absolute -top-8 z-10 flex items-center gap-0.5 rounded-xl border border-white/10 bg-ink-850 p-1 opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100",
              isMe ? "right-0" : "left-0"
            )}
          >
            {REACTIONS.map((e) => (
              <button key={e} type="button" onClick={() => toggleReaction(msg.channelId, msg.id, e)} className="rounded-lg px-1 text-sm transition-transform hover:scale-125">
                {e}
              </button>
            ))}
            {msg.content && (
              <button
                type="button"
                title="Sao chép"
                onClick={() => {
                  navigator.clipboard?.writeText(msg.content).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="grid size-6 place-items-center rounded-lg text-ink-300 hover:text-white"
              >
                {copied ? <Check className="size-3 text-white" /> : <Copy className="size-3" />}
              </button>
            )}
          </div>

          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed break-words",
              isMe
                ? "rounded-tr-md border border-accent/25 bg-gradient-to-b from-accent/[0.18] to-accent/[0.08] text-ink-100"
                : "rounded-tl-md border border-white/[0.07] bg-white/[0.05] text-ink-100",
              grouped && (isMe ? "rounded-tr-2xl" : "rounded-tl-2xl")
            )}
          >
            {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
            {msg.betChallenge && <BetCard msg={msg} isMe={isMe} />}
            {msg.attachment && <Attachment att={msg.attachment} onPreview={onPreview} />}
          </div>
        </div>
        {reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", isMe && "justify-end")}>
            {reactions.map(([emoji, users]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => toggleReaction(msg.channelId, msg.id, emoji)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                  users.includes(myId) ? "border-accent/50 bg-accent/10 text-white" : "border-white/10 bg-white/[0.03] text-ink-300"
                )}
              >
                {emoji} {users.length}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function Attachment({ att, onPreview }: { att: ChatAttachment; onPreview: (url: string) => void }) {
  if (att.type === "image") {
    return (
      <button type="button" onClick={() => onPreview(att.url)} className="mt-2 block overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={att.url} alt={att.name} loading="lazy" className="max-h-56 w-full object-cover transition-transform hover:scale-[1.02]" />
      </button>
    );
  }
  return (
    <a href={att.url} download={att.name} className="mt-2 flex items-center gap-2 rounded-xl bg-black/20 p-2">
      <FileText className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{att.name}</span>
      <span className="text-xs opacity-70">{att.size}</span>
    </a>
  );
}

function BetCard({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  const bet = msg.betChallenge!;
  const lua = useAppStore((s) => s.currentUser.lua);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const accept = useAppStore((s) => s.acceptBetChallenge);
  const cancel = useAppStore((s) => s.cancelBetChallenge);
  const [err, setErr] = useState<string | null>(null);
  const game = (["chess", "xiangqi", "werewolf", "arcade", "uno"].includes(bet.gameType) ? bet.gameType : "chess") as GameId;

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-black/20 bg-ink-950 text-white">
      <div className="flex items-center gap-3 p-3">
        <GameIcon game={game} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold">Kèo {GAME_BY_ID[game].name}</p>
          <p className="truncate text-xs text-ink-400">bởi {bet.creatorName}</p>
        </div>
        <div className="text-right">
          <p className="num text-base font-medium text-white">{bet.stake} Credit</p>
          <p className="text-xs text-ink-400">Thưởng {bet.stake * 2}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-3 py-2">
        {bet.status === "pending" && (
          <>
            <span className="flex items-center gap-1.5 text-xs text-ink-300">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> Đang chờ người nhận
            </span>
            {isMe ? (
              <button type="button" onClick={() => cancel(bet.id)} className="btn-ghost px-2.5 py-1 text-xs">
                Huỷ kèo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (lua < bet.stake) return setErr(`Cần ${bet.stake} Credit, bạn có ${lua}.`);
                  if (accept(bet.id) && soundEnabled) soundManager.playCoin();
                }}
                className="btn-accent px-3 py-1 text-xs"
              >
                <Swords className="size-3" /> Nhận kèo
              </button>
            )}
          </>
        )}
        {bet.status === "accepted" && (
          <>
            <span className="flex items-center gap-1 text-xs text-white font-medium">
              <Check className="size-3 text-white" /> Đã chốt: {bet.creatorName} vs {bet.opponentName}
            </span>
            <Link href={`${GAME_URL[bet.gameType] ?? "/"}?stake=${bet.stake}`} className="btn-accent px-3 py-1 text-xs">
              Vào chơi
            </Link>
          </>
        )}
        {(bet.status === "cancelled" || bet.status === "completed") && (
          <span className="text-xs text-ink-500">{bet.status === "cancelled" ? "Kèo đã huỷ" : "Kèo đã kết thúc"}</span>
        )}
      </div>
      {err && <p className="px-3 pb-2 text-xs text-pop-red">{err}</p>}
    </div>
  );
}

function Composer({ channelId }: { channelId: string }) {
  const sendMessage = useAppStore((s) => s.sendMessage);
  const [invite, setInvite] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<ChatAttachment | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [channelId]);

  const send = () => {
    if (!text.trim() && !file) return;
    sendMessage(channelId, text, file);
    setText("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setFile(null);
    setEmoji(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    if (f.type.startsWith("image/")) {
      try {
        const url = await compressImage(f);
        setFile({ name: f.name, url, type: "image", size: `${Math.round((url.length * 0.75) / 1024)} KB` });
      } catch {
        setErr("Không đọc được ảnh này.");
      }
      return;
    }
    if (f.size > 200 * 1024) return setErr("Tệp tối đa 200 KB (ảnh sẽ được tự nén).");
    const reader = new FileReader();
    reader.onload = () => setFile({ name: f.name, url: reader.result as string, type: "file", size: `${Math.round(f.size / 1024)} KB` });
    reader.readAsDataURL(f);
  };

  const quick = (t: string) => sendMessage(channelId, t);

  return (
    <div className="relative border-t border-white/[0.06] bg-ink-950/80 px-3 pb-3 pt-2">
      <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
        <button type="button" aria-expanded={invite} onClick={() => setInvite((v) => !v)} className={cn("chip shrink-0 hover:text-white", invite && "border-accent/50 text-ink-100")}>
          <Swords className="size-3" /> Mời chơi
        </button>
        <button type="button" onClick={() => quick("☕ Nghỉ tay làm ván cờ không anh em?")} className="chip shrink-0 hover:text-white">
          <Coffee className="size-3" /> Rủ cafe
        </button>
        <button
          type="button"
          onClick={() => quick(`🎲 Lắc xúc xắc: ${["⚀ 1", "⚁ 2", "⚂ 3", "⚃ 4", "⚄ 5", "⚅ 6"][Math.floor(Math.random() * 6)]}`)}
          className="chip shrink-0 hover:text-white"
        >
          <Dices className="size-3" /> Xúc xắc
        </button>
        <button type="button" onClick={() => quick("gg wp 🫡")} className="chip shrink-0 hover:text-white">
          gg wp
        </button>
      </div>

      {invite && <InvitePanel channelId={channelId} onClose={() => setInvite(false)} />}

      {emoji && (
        <div className="mb-2 flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-ink-900 p-2">
          {QUICK_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => setText((t) => t + e)} className="grid size-8 place-items-center rounded-lg text-lg hover:bg-white/[0.06]">
              {e}
            </button>
          ))}
        </div>
      )}

      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-ink-900 p-2">
          {file.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.url} alt="" className="size-10 rounded-lg object-cover" />
          ) : (
            <FileText className="size-6 text-ink-300" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{file.name}</p>
            <p className="text-xs text-ink-400">{file.size}</p>
          </div>
          <button type="button" onClick={() => setFile(null)} className="grid size-7 place-items-center rounded-lg text-ink-400 hover:text-white" aria-label="Bỏ tệp">
            <X className="size-4" />
          </button>
        </div>
      )}
      {err && <p className="mb-2 text-xs text-pop-red">{err}</p>}

      <div className="flex items-end gap-1 rounded-2xl border border-white/10 bg-ink-850/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] duration-200 focus-within:border-accent/50 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
        <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.doc,.docx" onChange={onFile} />
        <button type="button" onClick={() => fileRef.current?.click()} aria-label="Đính kèm" className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-300 hover:bg-white/[0.06] hover:text-white">
          <ImageIcon className="size-4" />
        </button>
        <button type="button" onClick={() => setEmoji((v) => !v)} aria-label="Biểu cảm" className={cn("grid size-9 shrink-0 place-items-center rounded-xl hover:bg-white/[0.06]", emoji ? "text-accent" : "text-ink-300 hover:text-white")}>
          <Smile className="size-4" />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={800}
          onChange={(e) => {
            setText(e.target.value);
            // Auto-grow up to the max-h cap
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Nhắn gì đó… (Enter để gửi)"
          className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[13px] text-white outline-none placeholder:text-ink-500"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() && !file}
          aria-label="Gửi"
          className="btn-accent !size-9 !shrink-0 !rounded-xl !p-0 disabled:!opacity-30"
        >
          <Send className="size-4" />
        </button>
        {text.length > 640 && <span className="absolute -top-5 right-4 font-mono text-xs text-ink-400">{text.length}/800</span>}
      </div>
    </div>
  );
}

function PrivateHome({ myId }: { myId: string }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <DmList myId={myId} onOpen={() => {}} />
      <OnlineList onOpenDm={() => {}} />
    </div>
  );
}

function ProfilePanel() {
  const inGame = (usePathname() || "").startsWith("/games");
  const me = useAppStore((s) => s.currentUser);
  const claimDailyBonus = useAppStore((s) => s.claimDailyBonus);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const toggleSound = useAppStore((s) => s.toggleSound);
  const open = useUiStore((s) => s.open);
  const email = useAuthStore((s) => s.email);
  const signOut = useAuthStore((s) => s.signOut);
  const manual = usePresenceStore((s) => s.manualStatus);
  const setManual = usePresenceStore((s) => s.setManualStatus);
  const myStatus = usePresenceStore((s) => s.myStatus);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(me.username);
  const [editTitle, setEditTitle] = useState(me.title);
  const [editSeed, setEditSeed] = useState(() => avatarSeedFrom(me.avatar, me.username));
  // Ảnh tự tải lên (URL Supabase Storage); null = dùng avatar Kokonut theo seed.
  const isPhoto = (a?: string) => !!a && !a.startsWith(KOKONUT_PREFIX) && !a.includes("dicebear.com");
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => (isPhoto(me.avatar) ? me.avatar : null));
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setUploading(true);
    try {
      setPhotoUrl(await uploadAvatar(file, me.id));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Tải ảnh thất bại.");
    } finally {
      setUploading(false);
    }
  };
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const score = me.score ?? 1200;
  const lua = me.lua ?? 0;
  const tier = getRankTier(score);
  const next = RANK_TIERS[RANK_TIERS.findIndex((t) => t.id === tier.id) + 1];
  const pct = next ? Math.min(100, Math.max(0, ((score - tier.minElo) / (next.minElo - tier.minElo)) * 100)) : 100;
  const canClaim = !me.lastDailyClaim || Date.now() - me.lastDailyClaim > 24 * 3600 * 1000;

  const TITLES = [
    "Đại Kiện Tướng Bàn Trà",
    "Sói Già Phố Wall",
    "Kỳ Thánh IT",
    "Trưởng Phòng Chiến Thuật",
    "Bậc Thầy Bốc Phét",
    "Thợ Săn Bug & Sói",
    "Vua Cờ Nghỉ Trưa",
    "Chiến Thần Đàm Phán",
  ];

  const handleSaveProfile = () => {
    const newName = editName.trim() || me.username;
    const newAvatar = photoUrl ?? kokonutAvatar(editSeed);
    setCurrentUser({ username: newName, title: editTitle, avatar: newAvatar });
    syncProfileToSupabase({ ...me, username: newName, title: editTitle, avatar: newAvatar });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsEditing(false);
    }, 700);
  };

  const st = (k: "chess" | "xiangqi" | "werewolf" | "arcade" | "uno") => me.stats?.[k] ?? { wins: 0, losses: 0, draws: 0, games: 0 };
  const rows = [
    { label: "Cờ Vua", elo: me.eloChess ?? 1200, s: st("chess") },
    { label: "Cờ Tướng", elo: me.eloXiangqi ?? 1200, s: st("xiangqi") },
    { label: "Ma Sói", elo: me.eloWerewolf ?? 1200, s: st("werewolf") },
    { label: "Deadline Rush", elo: me.eloUno ?? 1200, s: st("uno") },
  ];
  const totalWins = rows.reduce((a, r) => a + r.s.wins, 0);
  const totalGames = rows.reduce((a, r) => a + r.s.games, 0);
  const statuses: { id: "auto" | "busy" | "away"; label: string }[] = [
    { id: "auto", label: "Tự động" },
    { id: "busy", label: "Bận" },
    { id: "away", label: "Away" },
  ];
  const card = "rounded-xl border border-white/[0.075] bg-white/[0.025]";
  const sectionTitle = "pb-2 text-xs font-medium uppercase tracking-[0.1em] text-ink-400";

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4 no-scrollbar">
      {isEditing ? (
        <form
          className={cn(card, "space-y-4 p-4")}
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveProfile();
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-100">Chỉnh sửa hồ sơ</h3>
            <button type="button" onClick={() => setIsEditing(false)} className="text-xs text-ink-300 hover:text-ink-100">
              Hủy
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading} title="Tải ảnh lên" className="group relative size-14 shrink-0 overflow-hidden rounded-full transition hover:scale-105 active:scale-95">
                <UserAvatar src={photoUrl ?? kokonutAvatar(editSeed)} name={editName} className="size-14" />
                <span className={cn("absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white transition-opacity", uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                </span>
              </button>
              <input ref={photoInput} type="file" accept={AVATAR_ACCEPT} onChange={onPickPhoto} className="hidden" />
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading} className="btn-ghost btn-sm">
                  <Camera className="size-3.5" /> Tải ảnh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoUrl(null);
                    setPhotoError(null);
                    setEditSeed(Math.random().toString(36).substring(2, 8) + ":0");
                  }}
                  className="btn-ghost btn-sm"
                >
                  <Dices className="size-3.5" /> Ngẫu nhiên
                </button>
              </div>
            </div>
            {photoError && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">{photoError}</p>}
          </div>

          <div>
            <label htmlFor="profile-name" className="label">
              Tên hiển thị
            </label>
            <input id="profile-name" type="text" value={editName} maxLength={24} onChange={(e) => setEditName(e.target.value)} className="field !py-2.5" />
          </div>

          <div>
            <label htmlFor="profile-title" className="label">
              Danh hiệu
            </label>
            <select id="profile-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="field !py-2.5">
              {TITLES.map((t) => (
                <option key={t} value={t} className="bg-ink-900 text-ink-100">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={savedSuccess} className="btn-accent w-full">
            {savedSuccess ? "Đã lưu" : "Lưu thay đổi"}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setIsEditing(true)} className="btn-ghost w-full">
          <Pencil className="size-3.5" /> Chỉnh sửa hồ sơ
        </button>
      )}

      {/* Credit and rank */}
      <section className={cn(card, "divide-y divide-white/[0.075]")}>
        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs text-ink-400">Credit</p>
            <p className="num mt-1 text-2xl font-medium leading-none text-ink-100">{lua.toLocaleString("vi-VN")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => open("wallet")} className="btn-ghost btn-sm">
              Ví
            </button>
            <button
              type="button"
              disabled={!canClaim}
              onClick={() => {
                const r = claimDailyBonus();
                setClaimMsg(r.success ? `+${r.amount.toLocaleString("vi-VN")} Credit` : r.message);
              }}
              className="btn-accent btn-sm"
            >
              {canClaim ? "Điểm danh" : "Đã nhận hôm nay"}
            </button>
          </div>
        </div>
        {claimMsg && (
          <p role="status" className="px-4 py-2.5 text-xs text-accent-300">
            {claimMsg}
          </p>
        )}
        <div className="p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-ink-100">{tier.name}</p>
            <p className="text-xs tabular text-ink-300">{score} ELO</p>
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs text-ink-400">
            <span>{next ? `Còn ${next.minElo - score} ELO để lên ${next.name}` : "Hạng cao nhất"}</span>
            <span className="shrink-0 tabular">
              {totalWins} thắng / {totalGames} trận
            </span>
          </div>
        </div>
      </section>

      {/* Per-game ratings */}
      <section>
        <h3 className={sectionTitle}>Xếp hạng theo game</h3>
        <div className={cn(card, "overflow-hidden")}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.075] text-ink-400">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Game
                </th>
                <th scope="col" className="px-1 py-2 text-right font-medium">
                  ELO
                </th>
                <th scope="col" className="px-1 py-2 text-right font-medium">
                  Thắng
                </th>
                <th scope="col" className="px-1 py-2 text-right font-medium">
                  Thua
                </th>
                <th scope="col" className="py-2 pl-1 pr-3 text-right font-medium">
                  Hòa
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="px-3 py-2 text-left font-medium text-ink-100">
                    {r.label}
                  </th>
                  <td className="px-1 py-2 text-right tabular text-ink-100">{r.elo}</td>
                  <td className="px-1 py-2 text-right tabular text-ink-300">{r.s.wins}</td>
                  <td className="px-1 py-2 text-right tabular text-ink-300">{r.s.losses}</td>
                  <td className="py-2 pl-1 pr-3 text-right tabular text-ink-300">{r.s.draws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Shortcuts */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Xếp hạng", icon: <Trophy className="size-3.5" />, to: "ranking" as const },
          { label: "Ghép trận", icon: <Swords className="size-3.5" />, to: "matchmaking" as const },
        ].map((b) => (
          <button key={b.to} type="button" onClick={() => open(b.to)} className="btn-ghost btn-sm">
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      {/* Presence */}
      <section>
        <h3 className={sectionTitle}>Trạng thái</h3>
        <div role="group" aria-label="Trạng thái làm việc" className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.075] bg-white/[0.025] p-1">
          {statuses.map((x) => {
            const active = (manual ?? "auto") === x.id;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={active}
                onClick={() => setManual(x.id === "auto" ? null : x.id)}
                className={cn("rounded-lg py-1.5 text-xs font-medium transition-colors", active ? "bg-white/10 text-ink-100" : "text-ink-400 hover:text-ink-100")}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Sound and sign out */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.075] pt-4">
        {!inGame ? (
          <button type="button" onClick={toggleSound} className="btn-ghost btn-sm">
            Âm thanh: {soundEnabled ? "Bật" : "Tắt"}
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => signOut()} className="btn-ghost btn-sm">
          <LogOut className="size-3.5" /> Đăng xuất
        </button>
      </div>
    </div>
  );
}

function DmList({ myId, onOpen }: { myId: string; onOpen: () => void }) {
  const { messages, dmPeers, unread } = useAppStore(useShallow((s) => ({ messages: s.messages, dmPeers: s.dmPeers, unread: s.unreadCounts })));
  const openDm = useAppStore((s) => s.openDm);
  const peers = usePresenceStore((s) => s.peers);

  const threads = useMemo(
    () =>
      Object.entries(messages)
        .filter(([id, list]) => isDmChannel(id) && list.length > 0)
        .map(([id, list]) => ({ id, last: list[list.length - 1] }))
        .sort((a, b) => b.last.timestamp - a.last.timestamp),
    [messages]
  );

  return (
    <div className="p-3 pb-0">
      {threads.length === 0 && (
        <div className="px-4 py-6 text-center">
          <MessageSquare className="mx-auto mb-2 size-8 text-ink-500" />
          <p className="text-sm font-semibold">Chưa có cuộc trò chuyện riêng</p>
          <p className="mt-1 text-xs text-ink-400">Chọn một đồng nghiệp bên dưới để nhắn riêng.</p>
        </div>
      )}
      {threads.map(({ id, last }) => {
        const otherId = dmOtherId(id, myId);
        const live = peers[otherId];
        const info = dmPeers[id] ?? { id: otherId, username: last.senderId === myId ? "Đồng nghiệp" : last.senderName, avatar: last.senderAvatar };
        const name = live?.username ?? info.username;
        const n = unread[id] || 0;
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              openDm({ id: otherId, username: name, avatar: live?.avatar ?? info.avatar });
              onOpen();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left hover:bg-white/[0.04]"
          >
            <UserAvatar src={live?.avatar ?? info.avatar} name={name} status={live?.status ?? "offline"} className="size-10" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-bold">{name}</p>
                <span className="shrink-0 text-xs text-ink-500">{relativeTime(last.timestamp)}</span>
              </div>
              <p className={cn("truncate text-xs", n ? "font-semibold text-white" : "text-ink-400")}>
                {last.senderId === myId ? "Bạn: " : ""}
                {last.content || "📎 Tệp đính kèm"}
              </p>
            </div>
            {n > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-black">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

function OnlineList({ onOpenDm }: { onOpenDm: () => void }) {
  const peers = usePresenceStore((s) => s.peers);
  const openDm = useAppStore((s) => s.openDm);
  const list = useMemo(() => sortPeers(Object.values(peers)), [peers]);
  const groups: { label: string; items: OnlinePeer[]; tone: string }[] = [
    { label: "Đang chơi", items: list.filter((p) => p.status === "in-game"), tone: "text-neutral-200" },
    { label: "Online", items: list.filter((p) => p.status === "online"), tone: "text-white" },
    { label: "Bận", items: list.filter((p) => p.status === "busy"), tone: "text-neutral-400" },
    { label: "Away", items: list.filter((p) => p.status === "away"), tone: "text-neutral-500" },
  ];
  return (
    <div className="p-3">
      {list.length > 0 && <p className="eyebrow px-2 pb-1.5 pt-1 text-xs text-ink-400">Đồng nghiệp</p>}
      {list.length === 0 && (
        <div className="px-4 py-10 text-center">
          <Users className="mx-auto mb-2 size-8 text-ink-500" />
          <p className="text-sm font-semibold">Chỉ có mình bạn</p>
          <p className="mt-1 text-xs text-ink-400">Gửi link cho đồng nghiệp — họ đăng nhập là thấy nhau ngay.</p>
        </div>
      )}
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <div key={g.label} className="mb-3">
              <p className={cn("eyebrow px-2 pb-1.5 text-xs", g.tone)}>
                {g.label} · {g.items.length}
              </p>
              {g.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    openDm({ id: p.id, username: p.username, avatar: p.avatar });
                    onOpenDm();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left hover:bg-white/[0.04]"
                >
                  <UserAvatar src={p.avatar} name={p.username} status={p.status} className={cn("size-10", p.status === "away" && "opacity-60")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.username}</p>
                    <p className="truncate text-xs text-ink-400">
                      {p.status === "in-game" && p.currentGame ? `🎮 ${p.currentGame}` : p.title}
                      {p.status === "away" && ` · vắng ${relativeTime(p.awaySince ?? p.lastSeen)}`}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-ink-400">{p.score}</span>
                </button>
              ))}
            </div>
          )
      )}
    </div>
  );
}

export default ChatDrawer;
