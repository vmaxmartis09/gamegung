import { create } from "zustand";
import { useBetRounds } from "@/lib/bet-rounds";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  GameType,
  BadgeDefinition,
  calculateElo,
  checkBadgesToUnlock,
  GAME_BADGES,
  calculateDailyBonus,
} from "./ranking-system";
import { syncProfileToSupabase, claimDailyLuaFromSupabase } from "./supabase-game";
import { realtimeBridge } from "./realtime-bridge";
import { dmChannelId } from "./chat";

export const AVATAR_PREFIX = "kokonut:";
const MAX_MESSAGES_PER_CHANNEL = 200;

function appendCapped<T>(list: T[] | undefined, item: T): T[] {
  return [...(list || []), item].slice(-MAX_MESSAGES_PER_CHANNEL);
}

export interface UserStats {
  wins: number;
  losses: number;
  draws: number;
  games: number;
}

export interface ChibiCharacter {
  classId: "samurai" | "werewolf" | "seer" | "cyberpunk" | "monarch";
  className: string;
  gender: "male" | "female" | "cyber";
  skinTone: string;
  faceExpression: string;
  hairStyle: string;
  hairColor: string;
  outfit: string;
  headwear: string;
  weapon: string;
  aura: string;
}

export const DEFAULT_CHIBI_CHARACTER: ChibiCharacter = {
  classId: "samurai",
  className: "Kỳ Thánh Kiếm Sĩ",
  gender: "cyber",
  skinTone: "cyber",
  faceExpression: "glowing_cyber",
  hairStyle: "spiky_cyber",
  hairColor: "#00f0ff",
  outfit: "mecha_striker",
  headwear: "cyber_kitsune",
  weapon: "laser_katana",
  aura: "cyan_matrix",
};

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  title: string;
  status: "online" | "in-game" | "busy" | "away";
  currentGame?: string;
  score: number; // Overall composite ELO
  lua: number; // Lúa currency (Wheat 🌾)
  eloChess: number;
  eloXiangqi: number;
  eloWerewolf: number;
  eloArcade: number;
  eloUno?: number;
  eloTyping?: number;
  eloCaro?: number;
  stats: {
    chess: UserStats;
    xiangqi: UserStats;
    werewolf: UserStats;
    arcade: UserStats;
    uno?: UserStats;
    typing?: UserStats;
    caro?: UserStats;
  };
  badges: string[]; // List of unlocked badge IDs
  equippedBadges: string[]; // Up to 3 showcase badges
  lastDailyClaim?: number;
  hasCreatedCharacter?: boolean;
  character?: ChibiCharacter;
}

export interface Friend {
  id: string;
  username: string;
  avatar: string;
  title: string;
  status: "online" | "in-game" | "busy" | "offline";
  currentGame?: string;
  unreadCount?: number;
  lua: number;
  eloChess: number;
  eloXiangqi: number;
  eloWerewolf: number;
  eloArcade?: number;
  eloUno?: number;
  equippedBadges: string[];
}

export interface ChatAttachment {
  name: string;
  url: string; // base64 data url or hosted url
  type: "image" | "file";
  size: string;
}

export interface BetChallenge {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  targetId?: string; // target friend or undefined for public
  channelId: string;
  gameType: GameType;
  stake: number; // Lúa amount
  title?: string; // free-text name of the bet
  status: "pending" | "accepted" | "in_game" | "completed" | "cancelled";
  opponentId?: string;
  opponentName?: string;
  opponentAvatar?: string;
  winnerId?: string;
  createdAt: number;
  /** Mã phòng 4 số để vào bằng /join. */
  code?: string;
  /** Lúc có người nhận kèo (giờ server); phòng chờ tự huỷ sau 9 phút. */
  acceptedAt?: number;
  /** Lúc hai bên vào ván. */
  startedAt?: number;
  cancelReason?: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  attachment?: ChatAttachment | null;
  betChallenge?: BetChallenge;
  /** Lời mời vào phòng (vd. phòng Ma Sói): thẻ có nút Vào phòng. */
  roomInvite?: { game: string; code: string };
  reactions?: Record<string, string[]>;
  timestamp: number;
}

export interface LuaTransaction {
  id: string;
  timestamp: number;
  amount: number; // + or -
  type:
    | "initial_grant"
    | "bet_escrow"
    | "bet_win"
    | "bet_draw"
    | "bet_refund"
    | "daily_bonus"
    | "relief"
    | "gift";
  description: string;
  balanceAfter: number;
}

export interface GameRoom {
  code: string;
  gameType: GameType;
  name: string;
  hostId: string;
  players: { id: string; name: string; avatar: string; role?: string; ready: boolean }[];
  maxPlayers: number;
  status: "waiting" | "playing" | "finished";
  createdAt: number;
  stake?: number;
}

export interface MatchSettlementResult {
  gameType: GameType;
  result: "win" | "loss" | "draw";
  playerEloChange: number;
  newPlayerElo: number;
  luaChange: number;
  newLuaBalance: number;
  newBadges: BadgeDefinition[];
}

interface AppState {
  // User Profile & Currency
  currentUser: UserProfile;
  setCurrentUser: (user: Partial<UserProfile>) => void;
  updateStatus: (status: UserProfile["status"], currentGame?: string) => void;
  claimDailyBonus: () => {
    success: boolean;
    amount: number;
    base?: number;
    bonus?: number;
    tierName?: string;
    message: string;
  };
  claimRelief: () => { success: boolean; amount: number; message: string };
  transactions: LuaTransaction[];

  // Badges & Rank
  equipBadge: (badgeId: string) => void;
  unequipBadge: (badgeId: string) => void;

  // Match Settlement
  settleMatchResult: (params: {
    gameType: GameType;
    opponentId?: string;
    opponentName?: string;
    opponentElo?: number;
    result: "win" | "loss" | "draw";
    stake?: number;
  }) => MatchSettlementResult;

  // Friends
  friends: Friend[];
  pendingRequests: { id: string; username: string; avatar: string; type: "incoming" | "outgoing" }[];
  addFriend: (username: string) => boolean;
  acceptFriendRequest: (id: string) => void;
  removeFriend: (id: string) => void;

  // Chat & Betting in Chat
  isChatOpen: boolean;
  isChatCollapsed: boolean;
  setChatCollapsed: (collapsed: boolean) => void;
  activeChannel: string; // 'lounge' | game id | dmChannelId(a, b)
  messages: Record<string, ChatMessage[]>;
  /** Who is on the other side of each DM thread (not persisted). */
  dmPeers: Record<string, { id: string; username: string; avatar: string }>;
  openDm: (peer: { id: string; username: string; avatar: string }) => void;
  unreadCounts: Record<string, number>;
  toggleChat: (open?: boolean) => void;
  setActiveChannel: (channelId: string) => void;
  sendMessage: (
    channelId: string,
    content: string,
    attachment?: ChatAttachment | null,
    betChallenge?: BetChallenge,
    roomInvite?: { game: string; code: string }
  ) => void;
  toggleReaction: (channelId: string, messageId: string, emoji: string) => void;
  applyReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void;
  applyBetUpdate: (challenge: BetChallenge) => void;
  markChannelRead: (channelId: string) => void;

  // Bet Challenges
  createBetChallenge: (
    channelId: string,
    gameType: GameType,
    stake: number,
    targetId?: string,
    title?: string
  ) => BetChallenge | null;
  acceptBetChallenge: (challengeId: string) => boolean;
  /** Người trong kèo đổi trạng thái: vào ván, xong ván, hoặc huỷ kèo bỏ dở (hoàn tiền cả hai bên). */
  markBetStatus: (challengeId: string, status: "in_game" | "completed" | "cancelled", extra?: Partial<BetChallenge>) => void;
  cancelBetChallenge: (challengeId: string) => boolean;

  // Audio / Sound
  soundEnabled: boolean;
  toggleSound: () => void;

  // Active Game Room
  activeRoom: GameRoom | null;
  setActiveRoom: (room: GameRoom | null) => void;

  // Account lifecycle
  adoptAccount: (accountId: string, profile: Partial<UserProfile>) => void;
  resetSession: () => void;
}

export function createDefaultUser(id: string): UserProfile {
  return {
    id,
    username: "Kỳ Thủ Văn Phòng",
    avatar: AVATAR_PREFIX + "ky thu van phong:0",
    title: "Đại Kiện Tướng Bàn Trà",
    status: "online",
    currentGame: undefined,
    score: 1200,
    lua: 1000,
    eloChess: 1200,
    eloXiangqi: 1200,
    eloWerewolf: 1200,
    eloArcade: 1200,
    eloUno: 1200,
    eloTyping: 1200,
    stats: {
      chess: { wins: 0, losses: 0, draws: 0, games: 0 },
      xiangqi: { wins: 0, losses: 0, draws: 0, games: 0 },
      werewolf: { wins: 0, losses: 0, draws: 0, games: 0 },
      arcade: { wins: 0, losses: 0, draws: 0, games: 0 },
      uno: { wins: 0, losses: 0, draws: 0, games: 0 },
      typing: { wins: 0, losses: 0, draws: 0, games: 0 },
    },
    badges: ["chess_novice", "xiangqi_novice", "werewolf_novice", "uno_novice"],
    equippedBadges: ["chess_novice"],
    lastDailyClaim: 0,
    hasCreatedCharacter: false,
    character: DEFAULT_CHIBI_CHARACTER,
  };
}

const DEFAULT_FRIENDS: Friend[] = [];

const INITIAL_TRANSACTIONS: LuaTransaction[] = [];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  lounge: [],
  chess: [],
  xiangqi: [],
  werewolf: [],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: createDefaultUser("user-" + Math.random().toString(36).substring(2, 8)),
      transactions: INITIAL_TRANSACTIONS,

      setCurrentUser: (userUpdates) =>
        set((state) => ({
          currentUser: { ...state.currentUser, ...userUpdates },
        })),

      updateStatus: (status, currentGame) =>
        set((state) => ({
          currentUser: { ...state.currentUser, status, currentGame },
        })),

      claimDailyBonus: () => {
        const user = get().currentUser;
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (user.lastDailyClaim && now - user.lastDailyClaim < oneDayMs) {
          const remainingHours = Math.ceil(
            (oneDayMs - (now - user.lastDailyClaim)) / (1000 * 60 * 60)
          );
          return {
            success: false,
            amount: 0,
            message: `Bạn đã nhận điểm danh hôm nay rồi. Quay lại sau ${remainingHours} giờ nữa nhé!`,
          };
        }

        // Tính toán thưởng Lúa: Mức cơ bản 500 🌾 + Thưởng theo ELO cao nhất
        const highestElo = Math.max(
          user.eloChess || 1200,
          user.eloXiangqi || 1200,
          user.eloWerewolf || 1000
        );
        const bonusCalc = calculateDailyBonus(highestElo);
        const grantAmount = bonusCalc.total; // 500 - 1500 🌾
        const newBalance = user.lua + grantAmount;

        const tx: LuaTransaction = {
          id: "tx-" + now,
          timestamp: now,
          amount: grantAmount,
          type: "daily_bonus",
          description: `Điểm danh hàng ngày: Cơ bản 500 🌾 + Thưởng ${bonusCalc.tierName} (+${grantAmount} 🌾)`,
          balanceAfter: newBalance,
        };

        const updatedUser = {
          ...user,
          lua: newBalance,
          lastDailyClaim: now,
        };

        set((state) => ({
          currentUser: updatedUser,
          transactions: [tx, ...state.transactions],
        }));

        // Đồng bộ lên Supabase (gọi trigger / RPC nếu đã cấu hình)
        try {
          claimDailyLuaFromSupabase(user.id).catch(() => {});
          syncProfileToSupabase(updatedUser).catch(() => {});
        } catch (e) {
          // ignore background sync errors
        }

        return {
          success: true,
          amount: grantAmount,
          base: bonusCalc.base,
          bonus: bonusCalc.bonus,
          tierName: bonusCalc.tierName,
          message: `Điểm danh thành công! Bạn nhận được +${grantAmount} Credit (500 gốc + thưởng bậc ${bonusCalc.tierName})!`,
        };
      },

      claimRelief: () => {
        const user = get().currentUser;
        if (user.lua >= 100) {
          return {
            success: false,
            amount: 0,
            message: "Bạn vẫn còn trên 100 Credit! Gói cứu trợ chỉ dành cho kỳ thủ dưới 100 Lúa.",
          };
        }

        const reliefAmount = 200;
        const now = Date.now();
        const newBalance = user.lua + reliefAmount;
        const tx: LuaTransaction = {
          id: "tx-relief-" + now,
          timestamp: now,
          amount: reliefAmount,
          type: "relief",
          description: "Cứu trợ khởi nghiệp văn phòng (+200 🌾)",
          balanceAfter: newBalance,
        };

        set((state) => ({
          currentUser: {
            ...state.currentUser,
            lua: newBalance,
          },
          transactions: [tx, ...state.transactions],
        }));

        return {
          success: true,
          amount: reliefAmount,
          message: `Đã nhận gói cứu trợ khẩn cấp +${reliefAmount} Credit! Chúc bạn lội ngược dòng!`,
        };
      },

      equipBadge: (badgeId: string) => {
        set((state) => {
          if (!state.currentUser.badges.includes(badgeId)) return state;
          if (state.currentUser.equippedBadges.includes(badgeId)) return state;
          // Max 3 badges equipped
          const newEquipped = [...state.currentUser.equippedBadges, badgeId].slice(-3);
          return {
            currentUser: {
              ...state.currentUser,
              equippedBadges: newEquipped,
            },
          };
        });
      },

      unequipBadge: (badgeId: string) => {
        set((state) => ({
          currentUser: {
            ...state.currentUser,
            equippedBadges: state.currentUser.equippedBadges.filter((b) => b !== badgeId),
          },
        }));
      },

      settleMatchResult: ({
        gameType,
        opponentName = "Đối thủ",
        opponentElo = 1200,
        result,
        stake = 0,
      }) => {
        const state = get();
        const user = state.currentUser;
        const now = Date.now();

        // 1. Calculate Elo
        const currentEloKey =
          gameType === "chess"
            ? "eloChess"
            : gameType === "xiangqi"
            ? "eloXiangqi"
            : gameType === "arcade"
            ? "eloArcade"
            : gameType === "uno"
            ? "eloUno"
            : gameType === "typing"
            ? "eloTyping"
            : gameType === "caro"
            ? "eloCaro"
            : "eloWerewolf";
        const currentElo = user[currentEloKey] || 1200;
        const statsObj: UserStats = user.stats[gameType] || { wins: 0, losses: 0, draws: 0, games: 0 };

        const score = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
        const eloCalc = calculateElo(currentElo, opponentElo, score, statsObj.games);
        const newGameElo = eloCalc.newPlayerElo;

        // 2. Update Stats
        const newWins = statsObj.wins + (result === "win" ? 1 : 0);
        const newLosses = statsObj.losses + (result === "loss" ? 1 : 0);
        const newDraws = statsObj.draws + (result === "draw" ? 1 : 0);
        const newGames = statsObj.games + 1;

        const updatedStats = {
          ...user.stats,
          [gameType]: {
            wins: newWins,
            losses: newLosses,
            draws: newDraws,
            games: newGames,
          },
        };

        // 3. Settle Lúa (Currency)
        let luaChange = 0;
        let txType: LuaTransaction["type"] = "bet_draw";
        let txDesc = `Hòa ván ${gameType.toUpperCase()}`;

        if (stake > 0) {
          if (result === "win") {
            luaChange = stake; // Net win amount
            txType = "bet_win";
            txDesc = `Thắng cược ${gameType.toUpperCase()} trước ${opponentName} (+${stake} 🌾)`;
          } else if (result === "loss") {
            luaChange = -Math.min(user.lua, stake); // Net loss
            txType = "bet_loss" as any;
            txDesc = `Thua cược ${gameType.toUpperCase()} trước ${opponentName} (-${stake} 🌾)`;
          } else {
            luaChange = 0; // Draw refunds
            txType = "bet_draw";
            txDesc = `Hòa cược ${gameType.toUpperCase()} trước ${opponentName} (Hoàn cược)`;
          }
        }

        const newLuaBalance = Math.max(0, user.lua + luaChange);

        const newTransactions = [...state.transactions];
        if (stake > 0 && luaChange !== 0) {
          newTransactions.unshift({
            id: "tx-settle-" + now,
            timestamp: now,
            amount: luaChange,
            type: txType,
            description: txDesc,
            balanceAfter: newLuaBalance,
          });
        }

        // 4. Check for newly unlocked badges
        const newlyUnlocked = checkBadgesToUnlock(
          gameType,
          newGameElo,
          newWins,
          user.badges
        );
        const newBadgesList = [
          ...user.badges,
          ...newlyUnlocked.map((b) => b.id),
        ];

        // Overall aggregate rating
        const newEloChess = gameType === "chess" ? newGameElo : user.eloChess;
        const newEloXiangqi = gameType === "xiangqi" ? newGameElo : user.eloXiangqi;
        const newEloWerewolf = gameType === "werewolf" ? newGameElo : user.eloWerewolf;
        const newEloArcade = gameType === "arcade" ? newGameElo : (user.eloArcade || 1200);
        const newEloUno = gameType === "uno" ? newGameElo : (user.eloUno || 1200);
        const newEloTyping = gameType === "typing" ? newGameElo : (user.eloTyping || 1200);
        const newOverallScore = Math.round(
          (newEloChess + newEloXiangqi + newEloWerewolf + newEloArcade + newEloUno + newEloTyping) / 6
        );

        set({
          currentUser: {
            ...user,
            [currentEloKey]: newGameElo,
            score: newOverallScore,
            lua: newLuaBalance,
            stats: updatedStats,
            badges: newBadgesList,
          },
          transactions: newTransactions,
        });

        return {
          gameType,
          result,
          playerEloChange: eloCalc.playerDelta,
          newPlayerElo: newGameElo,
          luaChange,
          newLuaBalance,
          newBadges: newlyUnlocked,
        };
      },

      friends: DEFAULT_FRIENDS,
      pendingRequests: [],
      addFriend: (username) => {
        const trimmed = username.trim();
        if (!trimmed) return false;
        const exists = get().friends.some(
          (f) => f.username.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) return false;

        const newFriend: Friend = {
          id: "f-" + Date.now(),
          username: trimmed,
          avatar: `${AVATAR_PREFIX}${trimmed.toLowerCase()}:0`,
          title: "Chiến Hữu Văn Phòng",
          status: "online",
          unreadCount: 0,
          lua: 1000,
          eloChess: 1200,
          eloXiangqi: 1200,
          eloWerewolf: 1200,
          equippedBadges: [],
        };

        set((state) => ({
          friends: [newFriend, ...state.friends],
        }));
        return true;
      },
      acceptFriendRequest: (id) => {
        const req = get().pendingRequests.find((r) => r.id === id);
        if (!req) return;
        const newFriend: Friend = {
          id: "f-" + Date.now(),
          username: req.username,
          avatar: req.avatar,
          title: "Đồng Nghiệp Thân Thiết",
          status: "online",
          unreadCount: 0,
          lua: 1000,
          eloChess: 1200,
          eloXiangqi: 1200,
          eloWerewolf: 1200,
          equippedBadges: [],
        };
        set((state) => ({
          pendingRequests: state.pendingRequests.filter((r) => r.id !== id),
          friends: [newFriend, ...state.friends],
        }));
      },
      removeFriend: (id) =>
        set((state) => ({
          friends: state.friends.filter((f) => f.id !== id),
        })),

      isChatOpen: true,
      isChatCollapsed: true,
      setChatCollapsed: (collapsed) => set({ isChatCollapsed: collapsed }),
      activeChannel: "lounge",
      messages: INITIAL_MESSAGES,
      dmPeers: {},
      openDm: (peer) => {
        const me = get().currentUser.id;
        const channelId = dmChannelId(me, peer.id);
        set((state) => ({
          dmPeers: { ...state.dmPeers, [channelId]: peer },
          activeChannel: channelId,
          isChatOpen: true,
          isChatCollapsed: false,
          unreadCounts: { ...state.unreadCounts, [channelId]: 0 },
        }));
      },
      unreadCounts: {},
      // Chat toggle
      toggleChat: (open) =>
        set((state) => ({
          isChatOpen: true,
          isChatCollapsed: typeof open === "boolean" ? !open : !state.isChatCollapsed,
        })),
      setActiveChannel: (channelId) => {
        set((state) => {
          const newUnreads = { ...state.unreadCounts, [channelId]: 0 };
          return {
            activeChannel: channelId,
            unreadCounts: newUnreads,
          };
        });
      },
      sendMessage: (channelId, content, attachment = null, betChallenge, roomInvite) => {
        const user = get().currentUser;
        if (!content.trim() && !attachment && !betChallenge && !roomInvite) return;

        const newMessage: ChatMessage = {
          id: "msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
          channelId,
          senderId: user.id,
          senderName: user.username,
          senderAvatar: user.avatar,
          content: content.trim(),
          attachment: attachment || null,
          betChallenge,
          ...(roomInvite ? { roomInvite } : {}),
          timestamp: Date.now(),
        };

        set((state) => ({
          messages: {
            ...state.messages,
            [channelId]: appendCapped(state.messages[channelId], newMessage),
          },
        }));
        realtimeBridge.sendChatMessage(newMessage);
      },
      toggleReaction: (channelId, messageId, emoji) => {
        get().applyReaction(channelId, messageId, emoji, get().currentUser.id);
        realtimeBridge.sendReaction(channelId, messageId, emoji);
      },
      applyBetUpdate: (challenge) => {
        const cur = get();
        const me = cur.currentUser;
        const existing = cur.messages[challenge.channelId]?.find((m) => m.betChallenge?.id === challenge.id)?.betChallenge;
        if (
          existing &&
          (existing.status === "accepted" || existing.status === "in_game") &&
          challenge.status === "cancelled" &&
          (existing.creatorId === me.id || existing.opponentId === me.id) &&
          // Đã chơi ít nhất một ván thì tiền tạm giữ đã được trả rồi.
          !useBetRounds.getState().rounds[existing.id]?.escrowBack
        ) {
          // Kèo bỏ dở bị huỷ: trả lại tiền cược đã tạm giữ của mình.
          const now = Date.now();
          const balanceAfter = me.lua + existing.stake;
          set((state) => ({
            currentUser: { ...state.currentUser, lua: balanceAfter },
            transactions: [
              { id: "tx-refund-" + now, timestamp: now, amount: existing.stake, type: "bet_refund", description: `Hoàn tiền cược: kèo bỏ dở đã tự huỷ (+${existing.stake} 🌾)`, balanceAfter },
              ...state.transactions,
            ],
          }));
        }
        if (existing && existing.status === "accepted" && challenge.status === "accepted" && existing.opponentId !== challenge.opponentId) {
          // Two people accepted at once: the creator's first acceptance stands.
          if (existing.creatorId === me.id) {
            realtimeBridge.sendBetUpdate(existing);
            return;
          }
          // I accepted too but lost the race: give the stake back, then show the winner.
          if (existing.opponentId === me.id) {
            const now = Date.now();
            const balanceAfter = me.lua + existing.stake;
            set((state) => ({
              currentUser: { ...state.currentUser, lua: balanceAfter },
              transactions: [
                { id: "tx-refund-" + now, timestamp: now, amount: existing.stake, type: "bet_refund", description: `Hoàn tiền cược: kèo đã có người nhận trước (+${existing.stake} 🌾)`, balanceAfter },
                ...state.transactions,
              ],
            }));
          }
        }
        set((state) => {
          const list = state.messages[challenge.channelId];
          if (!list || !list.some((m) => m.betChallenge?.id === challenge.id)) return state;
          return {
            messages: {
              ...state.messages,
              [challenge.channelId]: list.map((m) =>
                m.betChallenge?.id === challenge.id ? { ...m, betChallenge: challenge } : m
              ),
            },
          };
        });
      },
      applyReaction: (channelId, messageId, emoji, userId) => {
        set((state) => {
          const currentList = state.messages[channelId] || [];
          const updated = currentList.map((msg) => {
            if (msg.id !== messageId) return msg;
            const reactions = { ...(msg.reactions || {}) };
            const users = reactions[emoji] || [];
            if (users.includes(userId)) {
              reactions[emoji] = users.filter((u) => u !== userId);
              if (reactions[emoji].length === 0) {
                delete reactions[emoji];
              }
            } else {
              reactions[emoji] = [...users, userId];
            }
            return { ...msg, reactions };
          });
          return {
            messages: {
              ...state.messages,
              [channelId]: updated,
            },
          };
        });
      },
      markChannelRead: (channelId) =>
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [channelId]: 0,
          },
        })),

      // Bet Challenges
      createBetChallenge: (channelId, gameType, stake, targetId, title) => {
        const user = get().currentUser;
        if (stake < 10) return null;
        if (user.lua < stake) return null;

        const now = Date.now();
        const challengeId = "bet-" + now + "-" + Math.random().toString(36).substring(2, 6);
        const challenge: BetChallenge = {
          id: challengeId,
          creatorId: user.id,
          creatorName: user.username,
          creatorAvatar: user.avatar,
          targetId,
          channelId,
          gameType,
          stake,
          title: title?.trim().slice(0, 60) || undefined,
          status: "pending",
          createdAt: now,
          code: String(1000 + Math.floor(Math.random() * 9000)),
        };

        // Escrow deduction from creator
        const newBalance = user.lua - stake;
        const tx: LuaTransaction = {
          id: "tx-escrow-" + now,
          timestamp: now,
          amount: -stake,
          type: "bet_escrow",
          description: `Tạm giữ tiền cược thách đấu ${gameType.toUpperCase()} (-${stake} 🌾)`,
          balanceAfter: newBalance,
        };

        const gameLabels: Record<GameType, string> = {
          chess: "Cờ Vua ♟️",
          xiangqi: "Cờ Tướng 🀄",
          werewolf: "Ma Sói 🐺",
          arcade: "Arcade Đấu Trí ⚡",
          uno: "Bài UNO 🎴",
          typing: "Typing Battle ⌨️",
          caro: "Cờ Caro ❌",
        };

        const targetFriend = targetId
          ? get().friends.find((f) => f.id === targetId)
          : null;
        const titleSuffix = title?.trim() ? ` «${title.trim().slice(0, 60)}»` : "";
        const msgText = targetFriend
          ? `⚔️ Thách đấu @${targetFriend.username} ván ${gameLabels[gameType]} với mức cược ${stake} Credit!${titleSuffix}`
          : `⚔️ Mở kèo thách đấu ${gameLabels[gameType]} với mức cược ${stake} Credit!${titleSuffix} Ai nhận kèo?`;

        set((state) => {
          const currentList = state.messages[channelId] || [];
          const newMessage: ChatMessage = {
            id: "msg-" + now + "-" + Math.random().toString(36).substring(2, 6),
            channelId,
            senderId: user.id,
            senderName: user.username,
            senderAvatar: user.avatar,
            content: msgText,
            betChallenge: challenge,
            timestamp: now,
          };

          return {
            currentUser: {
              ...user,
              lua: newBalance,
            },
            transactions: [tx, ...state.transactions],
            messages: {
              ...state.messages,
              [channelId]: appendCapped(currentList, newMessage),
            },
          };
        });
        realtimeBridge.sendChatMessage(get().messages[channelId]?.find((m) => m.betChallenge?.id === challengeId) as ChatMessage);

        return challenge;
      },

      markBetStatus: (challengeId, status, extra) => {
        const state = get();
        const me = state.currentUser.id;
        for (const list of Object.values(state.messages)) {
          const b = list.find((m) => m.betChallenge?.id === challengeId)?.betChallenge;
          if (!b) continue;
          if (b.creatorId !== me && b.opponentId !== me) return;
          if (b.status === status || b.status === "completed" || b.status === "cancelled") return;
          const next: BetChallenge = { ...b, ...extra, status, ...(status === "in_game" && !b.startedAt ? { startedAt: Date.now() } : {}) };
          get().applyBetUpdate(next);
          realtimeBridge.sendBetUpdate(next);
          return;
        }
      },
      acceptBetChallenge: (challengeId: string) => {
        const state = get();
        const user = state.currentUser;

        // Find message containing this challenge
        let foundChannel = "";
        let foundMsg: ChatMessage | null = null;

        for (const [chId, msgList] of Object.entries(state.messages)) {
          const m = msgList.find((msg) => msg.betChallenge?.id === challengeId);
          if (m) {
            foundChannel = chId;
            foundMsg = m;
            break;
          }
        }

        if (!foundMsg || !foundMsg.betChallenge) return false;
        const ch = foundMsg.betChallenge;

        if (ch.status !== "pending") return false;
        if (ch.creatorId === user.id) return false; // cannot accept own challenge
        if (ch.targetId && ch.targetId !== user.id) return false; // private challenge for someone else
        if (user.lua < ch.stake) return false; // not enough Lúa

        const now = Date.now();
        // Escrow deduction from acceptor
        const newBalance = user.lua - ch.stake;
        const tx: LuaTransaction = {
          id: "tx-accept-" + now,
          timestamp: now,
          amount: -ch.stake,
          type: "bet_escrow",
          description: `Tạm giữ tiền cược nhận kèo ${ch.gameType.toUpperCase()} (-${ch.stake} 🌾)`,
          balanceAfter: newBalance,
        };

        const updatedChallenge: BetChallenge = {
          ...ch,
          status: "accepted",
          opponentId: user.id,
          opponentName: user.username,
          opponentAvatar: user.avatar,
          acceptedAt: now,
        };

        const updatedMessages = (state.messages[foundChannel] || []).map((m) => {
          if (m.betChallenge?.id === challengeId) {
            return {
              ...m,
              betChallenge: updatedChallenge,
            };
          }
          return m;
        });

        // Add a system notification in the channel
        const sysMsg: ChatMessage = {
          id: "msg-sys-" + now + "-" + Math.random().toString(36).substring(2, 6),
          channelId: foundChannel,
          senderId: "system",
          senderName: "Hệ Thống Trọng Tài ⚖️",
          senderAvatar: AVATAR_PREFIX + "trong tai:3",
          content: `🎯 ${user.username} đã chấp nhận kèo đấu ${ch.stake} Credit của ${ch.creatorName}! Tổng giải thưởng bàn cờ là ${ch.stake * 2} Credit! Cả hai hãy vào bàn chiến ngay!`,
          timestamp: now,
        };

        set({
          currentUser: {
            ...user,
            lua: newBalance,
          },
          transactions: [tx, ...state.transactions],
          messages: {
            ...state.messages,
            [foundChannel]: [...updatedMessages, sysMsg].slice(-MAX_MESSAGES_PER_CHANNEL),
          },
        });
        realtimeBridge.sendBetUpdate(updatedChallenge);
        realtimeBridge.sendChatMessage(sysMsg);

        return true;
      },

      cancelBetChallenge: (challengeId: string) => {
        const state = get();
        const user = state.currentUser;

        let foundChannel = "";
        let foundMsg: ChatMessage | null = null;

        for (const [chId, msgList] of Object.entries(state.messages)) {
          const m = msgList.find((msg) => msg.betChallenge?.id === challengeId);
          if (m) {
            foundChannel = chId;
            foundMsg = m;
            break;
          }
        }

        if (!foundMsg || !foundMsg.betChallenge) return false;
        const ch = foundMsg.betChallenge;
        if (ch.creatorId !== user.id || ch.status !== "pending") return false;

        const now = Date.now();
        // Refund escrow to creator
        const newBalance = user.lua + ch.stake;
        const tx: LuaTransaction = {
          id: "tx-refund-" + now,
          timestamp: now,
          amount: ch.stake,
          type: "bet_refund",
          description: `Hoàn tiền cược hủy thách đấu (+${ch.stake} 🌾)`,
          balanceAfter: newBalance,
        };

        const updatedChallenge: BetChallenge = {
          ...ch,
          status: "cancelled",
        };

        const updatedMessages: ChatMessage[] = (state.messages[foundChannel] || []).map((m) => {
          if (m.betChallenge?.id === challengeId) {
            return {
              ...m,
              betChallenge: updatedChallenge,
            };
          }
          return m;
        });

        set({
          currentUser: {
            ...user,
            lua: newBalance,
          },
          transactions: [tx, ...state.transactions],
          messages: {
            ...state.messages,
            [foundChannel]: updatedMessages,
          },
        });
        realtimeBridge.sendBetUpdate(updatedChallenge);

        return true;
      },

      soundEnabled: true,
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      activeRoom: null,
      setActiveRoom: (room) => set({ activeRoom: room }),

      adoptAccount: (accountId, profile) => {
        const local = get().currentUser;
        // Anonymous local progress ("user-xxxx") is carried into the account once;
        // a different real account on this browser starts from defaults.
        const sameAccount = local.id === accountId || local.id.startsWith("user-");
        const base = sameAccount ? { ...local, id: accountId } : createDefaultUser(accountId);
        set((state) => ({
          currentUser: { ...base, ...profile, id: accountId },
          transactions: sameAccount ? state.transactions : [],
          friends: sameAccount ? state.friends : [],
        }));
      },
      resetSession: () =>
        set({
          currentUser: createDefaultUser("user-" + Math.random().toString(36).substring(2, 8)),
          transactions: [],
          friends: [],
          messages: INITIAL_MESSAGES,
          unreadCounts: {},
          isChatOpen: true,
        }),
    }),
    {
      name: "office-games-storage-v5-real",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentUser: state.currentUser,
        friends: state.friends,
        transactions: state.transactions,
        soundEnabled: state.soundEnabled,
      }),
    }
  )
);
