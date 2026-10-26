"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Megaphone, MessageCircle, Send, UserCheck, UserPlus } from "lucide-react";
import { useAppStore, type ChatMessage } from "@/lib/store";
import { dmChannelId } from "@/lib/chat";
import { JOIN_ERROR_KEY, joinByCode } from "@/lib/room-code";
import { GAME_BY_ID, GameIcon, type GameId } from "@/components/art/game-art";
import { useInviteCandidates, type InvitePerson } from "@/components/games/shared";
import { UserAvatar } from "@/components/ui/user-avatar";
import { addFriend, searchUsers, type FoundUser } from "@/lib/friends";
import { cn } from "@/lib/utils";

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
        <button type="button" onClick={() => void joinByCode(inv.code, router.push).then(setErr)} className="btn-accent flex shrink-0 items-center gap-1 px-3 py-1 text-[11px]">
          <LogIn className="size-3" /> Vào phòng
        </button>
      </div>
      {err && <p className="px-3 pb-2 text-[11px] text-pop-red">{err}</p>}
    </div>
  );
}

/** Gõ giống mã phòng: "/join …", toàn số, hoặc chữ in hoa + số (mã Ma Sói). Còn lại là tìm bạn theo tên. */
function looksLikeCode(t: string) {
  const v = t.trim();
  return /^\/join/i.test(v) || /^\d{3,8}$/.test(v) || /^[A-Z0-9]{4,8}$/.test(v);
}

/** Ô ở trang chủ: nhập mã phòng để vào (/join 3314), hoặc gõ tên để tìm và kết bạn ngay. */
export function JoinRoomBox({ className }: { className?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<FoundUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const friends = useAppStore((s) => s.friends);
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

  // Tìm bạn theo tên khi gõ (không phải mã phòng).
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || q.startsWith("/")) return setFound([]);
    let alive = true;
    const t = setTimeout(() => void searchUsers(q).then((r) => alive && setFound(r)), 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text]);

  const isFriendId = (id: string) => friends.some((f) => f.id === id);

  return (
    <form
      className={cn("relative", className)}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!looksLikeCode(text)) {
          if (!found.length) setErr("Không tìm thấy mã phòng hay người nào khớp.");
          return;
        }
        const r = await joinByCode(text, router.push);
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
          placeholder="Mã phòng (/join 3314) hoặc tên để tìm bạn"
          aria-label="Vào phòng bằng mã hoặc tìm bạn"
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white placeholder:text-ink-500 focus:outline-none"
        />
        <button type="submit" className="btn-accent px-2.5 py-1 text-xs">
          Vào
        </button>
      </div>
      {err && <p className="mt-1 text-center text-[11px] text-pop-red">{err}</p>}
      {found.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-ink-950/95 p-1 shadow-2xl backdrop-blur-xl" aria-label="Kết quả tìm bạn">
          {found.map((u) => {
            const already = isFriendId(u.id);
            return (
              <li key={u.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.05]">
                <UserAvatar src={u.avatar} name={u.username} className="size-7" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{u.username}</span>
                <button
                  type="button"
                  title="Nhắn riêng"
                  onClick={() => {
                    const st = useAppStore.getState();
                    st.openDm({ id: u.id, username: u.username, avatar: u.avatar });
                    st.toggleChat(true);
                  }}
                  className="btn-ghost flex items-center gap-1 px-2 py-1 text-[11px]"
                >
                  <MessageCircle className="size-3.5" /> Nhắn
                </button>
                {already ? (
                  <span className="flex items-center gap-1 px-2 text-[11px] text-success">
                    <UserCheck className="size-3.5" /> Bạn bè
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy === u.id}
                    onClick={async () => {
                      setBusy(u.id);
                      const e = await addFriend(u);
                      setBusy(null);
                      if (e) setErr(e);
                    }}
                    className="btn-accent flex items-center gap-1 px-2 py-1 text-[11px] disabled:opacity-50"
                  >
                    <UserPlus className="size-3.5" /> Kết bạn
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
