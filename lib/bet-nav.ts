import type { BetChallenge } from "@/lib/store";
import { GAME_BY_ID, type GameId } from "@/components/art/game-art";

/** Game có phòng chờ kèo (?bet=…). */
const LOBBY_GAMES = new Set(["chess", "xiangqi", "caro", "flip", "typing"]);

export function betHref(b: Pick<BetChallenge, "id" | "gameType" | "stake">): string | null {
  if (!LOBBY_GAMES.has(b.gameType)) return null;
  const meta = GAME_BY_ID[b.gameType as GameId];
  return meta ? `${meta.href}?stake=${b.stake}&bet=${encodeURIComponent(b.id)}` : null;
}

/**
 * Đưa người chơi vào phòng chờ của kèo. Đang ở đúng trang game thì tải lại trang
 * (trang game chỉ đọc ?bet khi mở), đang ở đúng phòng rồi thì thôi.
 */
export function openBetLobby(b: Pick<BetChallenge, "id" | "gameType" | "stake">, push: (href: string) => void) {
  const href = betHref(b);
  if (!href || typeof window === "undefined") return;
  const path = href.split("?")[0];
  if (window.location.pathname === path) {
    if (new URLSearchParams(window.location.search).get("bet") === b.id) return;
    window.location.assign(href);
    return;
  }
  push(href);
}
