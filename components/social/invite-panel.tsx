"use client";

import { useState } from "react";
import { Swords } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { dmOtherId, isDmChannel } from "@/lib/chat";
import type { GameType } from "@/lib/ranking-system";
import { GameIcon, GAME_BY_ID, type GameId } from "@/components/art/game-art";
import { cn } from "@/lib/utils";

const INVITE_GAMES: GameId[] = ["chess", "xiangqi", "werewolf", "uno"];
const PRESET_STAKES = [50, 100, 200, 500];

/**
 * Inline invite composer shown above the chat input. Sending it posts a bet card into the
 * conversation (see BetCard in chat-drawer), so the whole flow stays inside the chat.
 */
export function InvitePanel({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const lua = useAppStore((s) => s.currentUser.lua);
  const myId = useAppStore((s) => s.currentUser.id);
  const friends = useAppStore((s) => s.friends);
  const dmPeers = useAppStore((s) => s.dmPeers);
  const createBetChallenge = useAppStore((s) => s.createBetChallenge);

  const inDm = isDmChannel(channelId);
  const dmTarget = inDm ? dmPeers[channelId] : undefined;
  const [game, setGame] = useState<GameId>("chess");
  const [stake, setStake] = useState(100);
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stake < 10) return setError("Mức cược tối thiểu là 10 Credit.");
    if (stake > lua) return setError(`Số dư chỉ có ${lua.toLocaleString("vi-VN")} Credit.`);
    const target = inDm ? dmOtherId(channelId, myId) : targetId || undefined;
    if (createBetChallenge(channelId, game as GameType, stake, target, title)) onClose();
    else setError("Không thể tạo lời mời. Hãy kiểm tra lại số dư.");
  };

  return (
    <form onSubmit={submit} aria-label="Mời chơi" className="mb-2 space-y-3 rounded-xl border border-white/[0.075] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-100">Mời chơi</h3>
        <button type="button" onClick={onClose} className="text-xs text-ink-300 hover:text-ink-100">
          Hủy
        </button>
      </div>

      <div role="radiogroup" aria-label="Trò chơi" className="grid grid-cols-4 gap-1.5">
        {INVITE_GAMES.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={game === id}
            onClick={() => setGame(id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors",
              game === id ? "border-accent/60 bg-accent-soft text-ink-100" : "border-white/[0.075] text-ink-300 hover:border-white/20 hover:text-ink-100"
            )}
          >
            <GameIcon game={id} className="size-7" />
            <span className="max-w-full truncate">{GAME_BY_ID[id].short}</span>
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="invite-title" className="label">
          Tiêu đề kèo (tuỳ chọn)
        </label>
        <input
          id="invite-title"
          type="text"
          maxLength={60}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field !py-2"
          placeholder="VD: Kèo trà sữa chiều nay"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="invite-stake" className="label !mb-0">
            Mức cược
          </label>
          <span className="text-xs tabular text-ink-400">Số dư {lua.toLocaleString("vi-VN")} Credit</span>
        </div>
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          {PRESET_STAKES.map((amt) => (
            <button
              key={amt}
              type="button"
              aria-pressed={stake === amt}
              onClick={() => {
                setStake(amt);
                setError(null);
              }}
              className={cn(
                "rounded-lg border py-1.5 text-xs font-medium tabular transition-colors",
                stake === amt ? "border-accent/60 bg-accent-soft text-ink-100" : "border-white/[0.075] text-ink-300 hover:border-white/20 hover:text-ink-100"
              )}
            >
              {amt}
            </button>
          ))}
        </div>
        <input
          id="invite-stake"
          type="number"
          min={10}
          max={lua}
          value={stake || ""}
          onChange={(e) => {
            setStake(parseInt(e.target.value) || 0);
            setError(null);
          }}
          className="field !py-2 tabular"
          placeholder="Mức cược tùy chỉnh"
        />
      </div>

      {inDm ? (
        <p className="text-xs text-ink-300">
          Gửi riêng cho <span className="font-medium text-ink-100">{dmTarget?.username ?? "người này"}</span>
        </p>
      ) : (
        friends.length > 0 && (
          <div>
            <label htmlFor="invite-target" className="label">
              Gửi tới
            </label>
            <select id="invite-target" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="field !py-2">
              <option value="">Kênh chung (ai cũng nhận được)</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id} className="bg-ink-900">
                  Riêng: {f.username}
                </option>
              ))}
            </select>
          </div>
        )
      )}

      <p className="text-xs text-ink-400">Hệ thống tạm giữ {stake || 0} Credit, hoàn lại đủ nếu hủy kèo.</p>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={stake <= 0 || stake > lua} className="btn-accent w-full">
        <Swords className="size-4" /> Gửi lời mời
      </button>
    </form>
  );
}
