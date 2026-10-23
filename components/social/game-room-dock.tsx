"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Headphones, HeadphoneOff, Mic, MicOff, Send, Users } from "lucide-react";
import { useGameRoom } from "@/lib/game-room";
import { UserAvatar } from "@/components/ui/user-avatar";
import { GAME_BY_ID, type GameId } from "@/components/art/game-art";
import { cn } from "@/lib/utils";

/** Phòng chat + thoại realtime của từng game, nằm góc trái dưới trang game. */
export function GameRoomDock({ game }: { game: string }) {
  const room = useGameRoom(game);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const seen = useRef(0);
  const title = GAME_BY_ID[game as GameId]?.name ?? game;
  const talking = room.speaking.length > 0;
  const others = room.members.filter((m) => m.id !== room.me.id);

  // tin chưa đọc khi đang thu gọn
  useEffect(() => {
    if (open) {
      seen.current = room.messages.length;
      setUnread(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    } else setUnread(Math.max(0, room.messages.length - seen.current));
  }, [room.messages.length, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    room.send(draft);
    setDraft("");
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2">
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: "bottom left" }}
            className="flex h-[min(440px,70dvh)] w-[min(320px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-950/95 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            aria-label={`Phòng ${title}`}
          >
            {/* thành viên */}
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
              <span className="truncate text-sm font-bold text-white">{title}</span>
              <span className={cn("size-1.5 shrink-0 rounded-full", room.connected ? "bg-emerald-400" : "bg-neutral-600")} title={room.connected ? "Đã kết nối" : "Đang kết nối…"} />
              <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-300">
                <Users className="size-3.5" /> {room.members.length || 1}
              </span>
              <button type="button" onClick={() => setOpen(false)} title="Thu nhỏ" aria-label="Thu nhỏ" className="grid size-7 place-items-center rounded-lg text-ink-300 transition hover:bg-white/10 hover:text-white active:scale-95">
                <ChevronDown className="size-4" />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-white/[0.07] px-3 py-2 no-scrollbar">
              {room.members.length === 0 && <span className="text-[11px] text-ink-400">…</span>}
              {room.members.map((m) => {
                const isMe = m.id === room.me.id;
                const isTalking = room.speaking.includes(m.id);
                return (
                  <div key={m.id} className="relative shrink-0" title={`${m.name}${isMe ? " (bạn)" : ""}`}>
                    <span className={cn("block rounded-full p-[2px] transition-colors", isTalking ? "bg-lime-400 shadow-[0_0_12px_rgba(163,230,53,0.7)]" : "bg-white/10")}>
                      <UserAvatar src={m.avatar} name={m.name} className="size-9" />
                    </span>
                    <span className={cn("absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border border-ink-950", m.mic ? "bg-lime-400 text-black" : "bg-neutral-700 text-neutral-300")}>
                      {m.mic ? <Mic className="size-2.5" /> : <MicOff className="size-2.5" />}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* chat */}
            <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2.5 no-scrollbar">
              {room.messages.length === 0 && <p className="pt-8 text-center text-xs text-ink-500">💬</p>}
              {room.messages.map((m) => {
                const mine = m.from === room.me.id;
                return (
                  <div key={m.id} className={cn("flex items-end gap-1.5", mine && "flex-row-reverse")}>
                    <UserAvatar src={m.avatar} name={m.name} className="size-5" />
                    <div className={cn("max-w-[78%] rounded-xl px-2.5 py-1.5 text-[13px] leading-snug", mine ? "bg-white text-black" : "bg-white/[0.08] text-ink-100")}>
                      {!mine && <p className="text-[10px] font-bold text-ink-300">{m.name}</p>}
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {room.error && <p className="mx-3 mb-2 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-200">{room.error}</p>}

            {/* điều khiển */}
            <form onSubmit={submit} className="flex items-center gap-1.5 border-t border-white/[0.07] p-2">
              <button
                type="button"
                onClick={room.toggleMic}
                title={room.micOn ? "Tắt mic" : "Bật mic"}
                aria-label={room.micOn ? "Tắt mic" : "Bật mic"}
                aria-pressed={room.micOn}
                className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition hover:scale-105 active:scale-95", room.micOn ? "bg-lime-400 text-black shadow-[0_0_14px_rgba(163,230,53,0.6)]" : "bg-white/10 text-white hover:bg-white/20")}
              >
                {room.micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => room.setDeafened(!room.deafened)}
                title={room.deafened ? "Bật loa" : "Tắt loa"}
                aria-label={room.deafened ? "Bật loa" : "Tắt loa"}
                aria-pressed={room.deafened}
                className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition hover:scale-105 active:scale-95", room.deafened ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20")}
              >
                {room.deafened ? <HeadphoneOff className="size-4" /> : <Headphones className="size-4" />}
              </button>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} placeholder="…" className="min-w-0 flex-1 rounded-lg bg-white/[0.06] px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:bg-white/10" />
              <button type="submit" disabled={!draft.trim()} title="Gửi" aria-label="Gửi" className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-black transition hover:scale-105 active:scale-95 disabled:opacity-30">
                <Send className="size-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {/* nút thu gọn */}
      {!open && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setOpen(true)}
          title={`Phòng ${title}`}
          aria-label={`Mở phòng ${title}`}
          className={cn("relative flex h-11 items-center gap-2 rounded-full border bg-ink-900/90 pl-3 pr-3.5 text-white shadow-lg backdrop-blur-xl transition hover:scale-105 active:scale-95", talking ? "border-lime-400/70 shadow-[0_0_18px_rgba(163,230,53,0.45)]" : "border-white/10")}
        >
          {room.micOn ? <Mic className="size-4 text-lime-400" /> : <Headphones className="size-4" />}
          <span className="flex items-center gap-1 text-xs font-bold">
            <Users className="size-3.5" /> {others.length + 1}
          </span>
          {talking && (
            <span className="flex h-3.5 items-end gap-[2px]">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="w-[3px] rounded-full bg-lime-400" animate={{ height: ["30%", "100%", "50%"] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />
              ))}
            </span>
          )}
          {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-black">{unread > 9 ? "9+" : unread}</span>}
        </motion.button>
      )}
    </div>
  );
}
