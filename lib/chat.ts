import type { GameId } from "@/components/art/game-art";

export interface ChannelMeta {
  id: string;
  name: string;
  icon: GameId | "lounge";
}

export const PUBLIC_CHANNELS: ChannelMeta[] = [
  { id: "lounge", name: "Sảnh chung", icon: "lounge" },
  { id: "chess", name: "Cờ Vua", icon: "chess" },
  { id: "xiangqi", name: "Cờ Tướng", icon: "xiangqi" },
  { id: "werewolf", name: "Ma Sói", icon: "werewolf" },
  { id: "uno", name: "Deadline Rush", icon: "uno" },
  { id: "arcade", name: "Cyber Slash", icon: "arcade" },
  { id: "typing", name: "Typing Battle", icon: "typing" },
];

/** Same id on both sides of a conversation. */
export function dmChannelId(a: string, b: string) {
  return `dm-${[a, b].sort().join("__")}`;
}

export function isDmChannel(id: string) {
  return id.startsWith("dm-");
}

export function dmIncludes(channelId: string, userId: string) {
  return isDmChannel(channelId) && channelId.slice(3).split("__").includes(userId);
}

export function dmOtherId(channelId: string, myId: string) {
  return channelId.slice(3).split("__").find((id) => id !== myId) ?? "";
}

/** Game route → chat channel, so the drawer opens on the table you are at. */
export function channelForPath(pathname: string | null) {
  const m = (pathname || "").match(/^\/games\/(chess|xiangqi|werewolf|uno|arcade|typing)/);
  return m ? m[1] : "lounge";
}

export function relativeTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ`;
  return `${Math.floor(h / 24)} ngày`;
}
