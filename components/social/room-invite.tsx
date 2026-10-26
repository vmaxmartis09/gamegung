"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Megaphone, Send } from "lucide-react";
import { useAppStore, type ChatMessage } from "@/lib/store";
import { dmChannelId } from "@/lib/chat";
import { JOIN_ERROR_KEY, joinByCode } from "@/lib/room-code";
import { GAME_BY_ID, GameIcon, type GameId } from "@/components/art/game-art";
import { useInviteCandidates, type InvitePerson } from "@/components/games/shared";

/** Gửi lời mời vào phòng: riêng cho một người (chat riêng) hoặc vào kênh chung. */
export function sendRoomInvite(game: GameId, code: string, target: InvitePerson | null) {
  const st = useAppStore.getState();
  let channel = "lounge";
  if (target) {
    channel = dmChannelId(st.currentUser.id, target.id);
    st.openDm({ id: target.id, username: target.username, avatar: target.avatar });
  }
  const name = GAME_BY_ID[game]?.name ?? "game";
  st.sendMessage(channel, `Mời vào phòng ${name} · mã ${code} (gõ /join ${code})`, null, undefined, { game, code });
  const after = useAppStore.getState();
  after.setActiveChannel(channel);
  after.toggleChat(true);
}

/** Hai nút mời: chọn một người để mời riêng, hoặc mời cả kênh chung. */
export function RoomInviteButtons({ game, code }: { game: GameId; code: string }) {
  const people = useInviteCandidates();
  const [to, setTo] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const target = people.find((p) => p.id === to) ?? null;
  const flash = (msg: string) => {
    setSent(msg);
    setTimeout(() => setSent(null), 2000);
  };
  return (
    <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="label">Mời người chơi</p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Mời riêng"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 focus:border-white/40 focus:outline-none"
        >
          <option value="">Chọn người để mời riêng…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.online ? "● " : ""}
              {p.username}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!target}
          onClick={() => {
            if (!target) return;
            sendRoomInvite(game, code, target);
            flash(`Đã mời ${target.username}`);
            setTo("");
          }}
          className="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          <Send className="size-3.5" /> Mời bạn
        </button>
        <button
          type="button"
          onClick={() => {
            sendRoomInvite(game, code, null);
            flash("Đã mời kênh chung");
          }}
          className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Megaphone className="size-3.5" /> Mời kênh chung
        </button>
      </div>
      {sent && <p className="text-[11px] text-success">{sent}</p>}
    </div>
  );
}

/** Thẻ lời mời vào phòng trong chat. */
export function RoomInviteCard({ msg }: { msg: ChatMessage }) {
  const inv = msg.roomInvite!;
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const meta = GAME_BY_ID[inv.game as GameId];
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-black/20 bg-ink-950 text-white">
      <div className="flex items-center gap-3 p-3">
        {meta && <GameIcon game={inv.game as GameId} className="size-10" />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-extrabold">Phòng {meta?.name ?? inv.game}</p>
          <p className="font-mono text-[11px] tracking-widest text-ink-400">Mã {inv.code}</p>
        </div>
        <button type="button" onClick={() => setErr(joinByCode(inv.code, router.push))} className="btn-accent flex shrink-0 items-center gap-1 px-3 py-1 text-[11px]">
          <LogIn className="size-3" /> Vào phòng
        </button>
      </div>
      {err && <p className="px-3 pb-2 text-[11px] text-pop-red">{err}</p>}
    </div>
  );
}

/** Ô "/join mã" ở trang chủ. */
export function JoinRoomBox({ className }: { className?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  // Vào phòng thất bại ở trang khác rồi được đưa về đây: hiện lý do.
  useEffect(() => {
    try {
      const m = sessionStorage.getItem(JOIN_ERROR_KEY);
      if (m) {
        sessionStorage.removeItem(JOIN_ERROR_KEY);
        setErr(m);
      }
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const r = joinByCode(text, router.push);
        try {
          sessionStorage.removeItem(JOIN_ERROR_KEY);
        } catch {
          /* ignore */
        }
        setErr(r);
        if (!r) setText("");
      }}
    >
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2 focus-within:border-white/30">
        <LogIn className="size-4 shrink-0 text-ink-400" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErr(null);
          }}
          placeholder="/join 3314"
          aria-label="Vào phòng bằng mã"
          className="w-36 min-w-0 bg-transparent font-mono text-sm text-white placeholder:text-ink-500 focus:outline-none"
        />
        <button type="submit" className="btn-accent px-2.5 py-1 text-xs">
          Vào
        </button>
      </div>
      {err && <p className="mt-1 text-[11px] text-pop-red">{err}</p>}
    </form>
  );
}
