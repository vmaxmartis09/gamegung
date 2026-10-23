import { supabase, isSupabaseConfigured } from "./supabase";
import { UserProfile, GameRoom } from "./store";
import { GameType } from "./ranking-system";

export interface MatchRecord {
  gameType: GameType;
  playerId: string;
  playerName: string;
  opponentId?: string;
  opponentName?: string;
  opponentElo?: number;
  result: "win" | "loss" | "draw";
  stake: number;
  luaChange: number;
  eloChange: number;
  newElo: number;
}

export interface SupabaseLeaderboardItem {
  id: string;
  username: string;
  avatar: string;
  title: string;
  lua: number;
  eloChess: number;
  eloXiangqi: number;
  eloWerewolf: number;
  eloArcade?: number;
  eloUno?: number;
  score: number;
  equippedBadges: string[];
  stats: {
    chess: { wins: number; games: number };
    xiangqi: { wins: number; games: number };
    werewolf: { wins: number; games: number };
    arcade?: { wins: number; games: number };
    uno?: { wins: number; games: number };
  };
}

/**
 * Đồng bộ hồ sơ người dùng lên bảng `profiles` của Supabase
 */
// Columns the remote table turned out not to have; skipped on later syncs.
const missingProfileColumns = new Set<string>();
// Only real Supabase accounts (UUIDs) are ever written; local and dev ids stay local.
const isAccountId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function syncProfileToSupabase(user: UserProfile): Promise<boolean> {
  if (!isSupabaseConfigured || !isAccountId(user.id)) return false;

  const payload: Record<string, unknown> = {
    id: user.id,
    username: user.username,
    full_name: user.username,
    avatar: user.avatar,
    avatar_url: user.avatar,
    title: user.title,
    lua: user.lua,
    elo_chess: user.eloChess,
    elo_xiangqi: user.eloXiangqi,
    elo_werewolf: user.eloWerewolf,
    elo_arcade: user.eloArcade,
    elo_uno: user.eloUno ?? 1200,
    badges: user.badges,
    equipped_badges: user.equippedBadges,
    stats: user.stats,
    character: user.character || null,
    last_daily_claim: user.lastDailyClaim ? new Date(user.lastDailyClaim).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  missingProfileColumns.forEach((c) => delete payload[c]);

  try {
    // Drop unknown columns one at a time instead of losing the whole profile.
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (!error) return true;
      const col =
        error.message.match(/'([a-z_]+)' column/)?.[1] ?? error.message.match(/column "?([a-z_]+)"? .*does not exist/)?.[1];
      if (!col || !(col in payload) || col === "id") {
        console.warn("[Supabase] syncProfile error:", error.message);
        return false;
      }
      missingProfileColumns.add(col);
      delete payload[col];
    }
    return false;
  } catch (err) {
    console.warn("[Supabase] syncProfile caught:", err);
    return false;
  }
}

/** Load the stored profile for an account; null when not found or offline. */
export async function fetchProfileFromSupabase(id: string): Promise<Partial<UserProfile> | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, any>;
    const profile: Partial<UserProfile> = {};
    if (row.username || row.full_name) profile.username = row.username || row.full_name;
    if (row.avatar || row.avatar_url) profile.avatar = row.avatar || row.avatar_url;
    if (row.title) profile.title = row.title;
    if (row.lua != null) profile.lua = Number(row.lua);
    if (row.elo_chess != null) profile.eloChess = Number(row.elo_chess);
    if (row.elo_xiangqi != null) profile.eloXiangqi = Number(row.elo_xiangqi);
    if (row.elo_werewolf != null) profile.eloWerewolf = Number(row.elo_werewolf);
    if (row.elo_arcade != null) profile.eloArcade = Number(row.elo_arcade);
    if (row.elo_uno != null) profile.eloUno = Number(row.elo_uno);
    if (Array.isArray(row.badges) && row.badges.length) profile.badges = row.badges;
    if (Array.isArray(row.equipped_badges)) profile.equippedBadges = row.equipped_badges;
    if (row.stats && typeof row.stats === "object" && Object.keys(row.stats).length) profile.stats = row.stats;
    if (row.character && typeof row.character === "object" && Object.keys(row.character).length) {
      profile.character = row.character;
      profile.hasCreatedCharacter = true;
    }
    if (row.last_daily_claim) profile.lastDailyClaim = new Date(row.last_daily_claim).getTime();
    return profile;
  } catch {
    return null;
  }
}

/**
 * Tải bảng xếp hạng trực tiếp từ Supabase
 */
export async function fetchLeaderboardFromSupabase(
  category: "chess" | "xiangqi" | "werewolf" | "arcade" | "uno" | "lua"
): Promise<SupabaseLeaderboardItem[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    let orderColumn = "elo_chess";
    if (category === "xiangqi") orderColumn = "elo_xiangqi";
    if (category === "werewolf") orderColumn = "elo_werewolf";
    if (category === "arcade") orderColumn = "elo_arcade";
    if (category === "uno") orderColumn = "elo_uno";
    if (category === "lua") orderColumn = "lua";

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order(orderColumn, { ascending: false })
      .limit(30);

    if (error || !data) {
      console.warn("[Supabase] fetchLeaderboard error:", error?.message);
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      username: row.username || "Kỳ thủ ẩn danh",
      avatar: row.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=Anon",
      title: row.title || "Kỳ Thủ Văn Phòng",
      lua: Number(row.lua || 0),
      eloChess: Number(row.elo_chess || 1200),
      eloXiangqi: Number(row.elo_xiangqi || 1200),
      eloWerewolf: Number(row.elo_werewolf || 1000),
      eloArcade: Number(row.elo_arcade || 1200),
      eloUno: Number(row.elo_uno || 1200),
      score: Math.round(
        (Number(row.elo_chess || 1200) +
          Number(row.elo_xiangqi || 1200) +
          Number(row.elo_werewolf || 1000) +
          Number(row.elo_arcade || 1200) +
          Number(row.elo_uno || 1200)) /
          5
      ),
      equippedBadges: Array.isArray(row.equipped_badges) ? row.equipped_badges : [],
      stats: {
        chess: row.stats?.chess || { wins: 0, games: 0 },
        xiangqi: row.stats?.xiangqi || { wins: 0, games: 0 },
        werewolf: row.stats?.werewolf || { wins: 0, games: 0 },
        arcade: row.stats?.arcade || { wins: 0, games: 0 },
        uno: row.stats?.uno || { wins: 0, games: 0 },
      },
    }));
  } catch (err) {
    console.warn("[Supabase] fetchLeaderboard caught:", err);
    return null;
  }
}

/**
 * Ghi nhận lịch sử trận đấu và tiền cược vào Supabase `match_history`
 */
export async function recordMatchToSupabase(record: MatchRecord): Promise<boolean> {
  if (!isSupabaseConfigured || !isAccountId(record.playerId)) return false;

  try {
    const payload = {
      game_type: record.gameType,
      player_id: record.playerId,
      player_name: record.playerName,
      opponent_id: record.opponentId || null,
      opponent_name: record.opponentName || "AI Bot",
      opponent_elo: record.opponentElo || 1200,
      result: record.result,
      stake: record.stake,
      lua_change: record.luaChange,
      elo_change: record.eloChange,
      new_elo: record.newElo,
    };

    const { error } = await supabase.from("match_history").insert([payload]);
    if (error) {
      console.warn("[Supabase] recordMatch error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Supabase] recordMatch caught:", err);
    return false;
  }
}

export interface MatchmakingOpponent {
  id: string;
  username: string;
  avatar: string;
  title: string;
  elo: number;
  isBot: boolean;
  stake: number;
  roomCode: string;
}

const OFFICE_BOT_POOL = [
  {
    name: "Alex Dev (AI Bot)",
    title: "Đại Kiện Tướng Bàn Trà",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Alex",
    eloOffset: 20,
  },
  {
    name: "Minh Marketing (AI)",
    title: "Sói Già Phố Wall",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Minh",
    eloOffset: -15,
  },
  {
    name: "Trang Lead Design",
    title: "Bậc Thầy Bốc Phét",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Trang",
    eloOffset: 10,
  },
  {
    name: "Tuấn Cloud DevOps",
    title: "Kỳ Thánh IT",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Tuan",
    eloOffset: -30,
  },
  {
    name: "Linh HR Chiến Thần",
    title: "Chiến Thần Đàm Phán",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Linh",
    eloOffset: 25,
  },
];

/**
 * Trình ghép trận Realtime qua Supabase Broadcast Channel.
 * Tự động ghép 2 người thật nếu cùng online tìm trận, hoặc ghép AI đồng trình sau timeout 6s.
 */
export function startRealtimeMatchmaking({
  gameType,
  stake,
  user,
  onOpponentFound,
}: {
  gameType: GameType;
  stake: number;
  user: UserProfile;
  onOpponentFound: (opponent: MatchmakingOpponent) => void;
}): () => void {
  const channelName = `matchmaking_${gameType}_${stake}`;
  let isMatched = false;
  let botFallbackTimer: NodeJS.Timeout | null = null;

  // Lấy ELO hiện tại của user theo game
  const userElo =
    gameType === "chess"
      ? user.eloChess
      : gameType === "xiangqi"
      ? user.eloXiangqi
      : gameType === "werewolf"
      ? user.eloWerewolf
      : (user.eloArcade ?? 1200);

  // Fallback sang AI sau 6 giây nếu không có người chơi thật
  botFallbackTimer = setTimeout(() => {
    if (isMatched) return;
    isMatched = true;

    const randomBot = OFFICE_BOT_POOL[Math.floor(Math.random() * OFFICE_BOT_POOL.length)];
    const botElo = Math.max(800, userElo + randomBot.eloOffset);
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    onOpponentFound({
      id: "bot-" + Date.now(),
      username: randomBot.name,
      avatar: randomBot.avatar,
      title: randomBot.title,
      elo: botElo,
      isBot: true,
      stake,
      roomCode,
    });
  }, 6500);

  // Nếu Supabase có kết nối, thử ghép người chơi thật
  let channel: any = null;
  if (isSupabaseConfigured) {
    try {
      channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "search_match" }, (payload: any) => {
          if (isMatched) return;
          const otherPlayer = payload.payload;
          if (!otherPlayer || otherPlayer.id === user.id) return;

          // Ghép thành công 2 người chơi thật!
          isMatched = true;
          if (botFallbackTimer) clearTimeout(botFallbackTimer);

          const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

          // Phản hồi cho người chơi kia
          channel.send({
            type: "broadcast",
            event: "match_ready",
            payload: {
              hostId: user.id,
              guestId: otherPlayer.id,
              roomCode,
              opponent: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                title: user.title,
                elo: userElo,
              },
            },
          });

          onOpponentFound({
            id: otherPlayer.id,
            username: otherPlayer.username,
            avatar: otherPlayer.avatar,
            title: otherPlayer.title,
            elo: otherPlayer.elo,
            isBot: false,
            stake,
            roomCode,
          });
        })
        .on("broadcast", { event: "match_ready" }, (payload: any) => {
          if (isMatched) return;
          const data = payload.payload;
          if (data.guestId === user.id) {
            isMatched = true;
            if (botFallbackTimer) clearTimeout(botFallbackTimer);

            onOpponentFound({
              id: data.opponent.id,
              username: data.opponent.username,
              avatar: data.opponent.avatar,
              title: data.opponent.title,
              elo: data.opponent.elo,
              isBot: false,
              stake,
              roomCode: data.roomCode,
            });
          }
        })
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED" && !isMatched) {
            // Phát sóng tìm trận
            channel.send({
              type: "broadcast",
              event: "search_match",
              payload: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                title: user.title,
                elo: userElo,
                stake,
              },
            });
          }
        });
    } catch (e) {
      console.warn("[Matchmaking] Realtime channel setup failed:", e);
    }
  }

  // Cleanup function khi hủy hoặc đóng modal
  return () => {
    isMatched = true;
    if (botFallbackTimer) clearTimeout(botFallbackTimer);
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        // ignore
      }
    }
  };
}

/**
 * Gọi Stored Procedure / Trigger RPC trên Supabase để nhận 500+ Lúa theo ELO
 */
export async function claimDailyLuaFromSupabase(userId: string): Promise<{
  success: boolean;
  amount: number;
  newBalance?: number;
  tierName?: string;
  message: string;
} | null> {
  if (!isSupabaseConfigured || !isAccountId(userId)) return null;

  try {
    const { data, error } = await supabase.rpc("claim_daily_lua", {
      p_user_id: userId,
    });

    if (error) {
      console.warn("[Supabase] claim_daily_lua RPC error:", error.message);
      return null;
    }

    if (data && typeof data === "object") {
      return {
        success: Boolean(data.success),
        amount: Number(data.amount || 0),
        newBalance: data.new_balance ? Number(data.new_balance) : undefined,
        tierName: data.tier_name,
        message: data.message || "Điểm danh hoàn tất!",
      };
    }
    return null;
  } catch (err) {
    console.warn("[Supabase] claim_daily_lua exception:", err);
    return null;
  }
}

/** Shrink to 256px JPEG and upload to the public "avatars" bucket; returns the public URL. */
export async function uploadAvatarImage(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("File không phải ảnh.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Ảnh quá lớn (tối đa 10MB).");
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Không xử lý được ảnh.");
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) {
    throw new Error(/bucket not found/i.test(error.message) ? 'Chưa tạo bucket "avatars" trên Supabase (chạy db/setup.sql).' : error.message);
  }
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
