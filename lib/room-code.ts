import { useAppStore, type BetChallenge } from "@/lib/store";
import { betHref, openBetLobby } from "@/lib/bet-nav";
import { currentRound, roomOf } from "@/lib/bet-rounds";
import { GAME_BY_ID, type GameId } from "@/components/art/game-art";
import { wwJoin } from "@/lib/werewolf-online";

/** Game có bàn trên server: người ngoài vào được để xem. */
const WATCHABLE = new Set(["chess", "xiangqi", "caro", "flip"]);

/** Mã phòng 4 số của một kèo (kèo cũ chưa có mã thì suy ra từ id). */
export function betCode(b: Pick<BetChallenge, "id" | "code">): string {
  if (b.code) return b.code;
  let h = 0;
  for (let i = 0; i < b.id.length; i++) h = (Math.imul(h, 31) + b.id.charCodeAt(i)) >>> 0;
  return String(1000 + (h % 9000));
}

export function newBetCode() {
  return String(1000 + Math.floor(Math.random() * 9000));
}

/** Kèo có mã này trong các kênh mình thấy được; ưu tiên kèo còn mở, mới nhất. */
function findBetByCode(code: string): BetChallenge | null {
  let best: BetChallenge | null = null;
  const rank = (b: BetChallenge) => (b.status === "cancelled" || b.status === "completed" ? 0 : 1);
  for (const list of Object.values(useAppStore.getState().messages)) {
    for (const m of list) {
      const b = m.betChallenge;
      if (!b || betCode(b) !== code) continue;
      if (!best || rank(b) > rank(best) || (rank(b) === rank(best) && b.createdAt > best.createdAt)) best = b;
    }
  }
  return best;
}

/** Tách mã từ "/join 3314", "join 3314" hoặc "3314". */
export function parseJoin(raw: string): string | null {
  const m = raw.trim().match(/^\/?(?:join\s+)?([a-z0-9]{3,8})$/i);
  return m ? m[1].toUpperCase() : null;
}

export const JOIN_ERROR_KEY = "oa-join-error";

/** Vào phòng không được: về trang chủ, ô nhập mã ở đó sẽ hiện lý do. */
export function failJoin(msg: string, push: (href: string) => void): string {
  try {
    sessionStorage.setItem(JOIN_ERROR_KEY, msg);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.location.pathname !== "/") push("/");
  return msg;
}

/** Trang game chỉ đọc mã trên URL lúc mở: cùng trang thì tải lại. */
function go(href: string, push: (href: string) => void) {
  if (typeof window !== "undefined" && window.location.pathname === href.split("?")[0]) window.location.assign(href);
  else push(href);
}

/**
 * Vào phòng theo mã, cho mọi game: phòng kèo (Cờ Vua, Cờ Tướng, Caro, Typing — có cược hoặc tự do)
 * thì nhận kèo / vào phòng chờ / xem trận; phòng Ma Sói thì ngồi vào ghế.
 * Không tìm thấy phòng nào thì báo lỗi và về trang chủ. Trả về lỗi, hoặc null khi đã vào.
 */
export async function joinByCode(raw: string, push: (href: string) => void): Promise<string | null> {
  const code = parseJoin(raw);
  if (!code) return failJoin("Gõ /join kèm mã phòng, ví dụ: /join 3314", push);
  const st = useAppStore.getState();
  const me = st.currentUser.id;
  const bet = findBetByCode(code);
  if (!bet) {
    const me = st.currentUser;
    const r = await wwJoin(code, me.username, me.avatar);
    if (!r.id) return failJoin(`Không tìm thấy phòng ${code}.`, push);
    go(`/games/werewolf?room=${encodeURIComponent(r.id)}`, push);
    return null;
  }
  const name = GAME_BY_ID[bet.gameType as GameId]?.name ?? "game";
  if (bet.status === "cancelled" || bet.status === "completed") return failJoin(`Phòng ${code} (${name}) đã đóng.`, push);
  if (!betHref(bet)) return failJoin(`${name} chưa có phòng chờ để vào bằng mã.`, push);
  const mine = bet.creatorId === me || bet.opponentId === me;
  if (mine && bet.status !== "pending") {
    openBetLobby(bet, push);
    return null;
  }
  if (bet.status === "pending") {
    if (bet.creatorId === me) return failJoin(`Phòng ${code} đang chờ người nhận kèo.`, push);
    if (bet.targetId && bet.targetId !== me) return failJoin(`Phòng ${code} là lời mời riêng cho người khác.`, push);
    if (st.currentUser.lua < bet.stake) return failJoin(`Cần ${bet.stake} Lúa để vào phòng ${code}.`, push);
    if (!st.acceptBetChallenge(bet.id)) return failJoin(`Không vào được phòng ${code}.`, push);
    openBetLobby(bet, push);
    return null;
  }
  // Phòng đã đủ hai người: xem trận nếu được.
  if (WATCHABLE.has(bet.gameType)) {
    const meta = GAME_BY_ID[bet.gameType as GameId];
    go(`${meta.href}?match=${encodeURIComponent(roomOf(bet.id, currentRound(bet.id)))}&watch=1`, push);
    return null;
  }
  return failJoin(`Phòng ${code} đã đủ người.`, push);
}
