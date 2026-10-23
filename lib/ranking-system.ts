export type GameType = "chess" | "xiangqi" | "werewolf" | "arcade" | "uno" | "typing";

export type RankTierId =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master";

export interface RankTier {
  id: RankTierId;
  name: string;
  minElo: number;
  maxElo: number;
  color: string;
  badgeBg: string;
  borderColor: string;
  icon: string;
}

export const RANK_TIERS: RankTier[] = [
  {
    id: "bronze",
    name: "Tập Sự (Bronze)",
    minElo: 0,
    maxElo: 1199,
    color: "text-neutral-400",
    badgeBg: "bg-neutral-900/60",
    borderColor: "border-neutral-700/60",
    icon: "🥉",
  },
  {
    id: "silver",
    name: "Chiến Binh (Silver)",
    minElo: 1200,
    maxElo: 1399,
    color: "text-neutral-300",
    badgeBg: "bg-neutral-800/60",
    borderColor: "border-neutral-500/60",
    icon: "🥈",
  },
  {
    id: "gold",
    name: "Cao Thủ (Gold)",
    minElo: 1400,
    maxElo: 1599,
    color: "text-white font-medium",
    badgeBg: "bg-white/[0.08]",
    borderColor: "border-white/30",
    icon: "🥇",
  },
  {
    id: "platinum",
    name: "Tinh Anh (Platinum)",
    minElo: 1600,
    maxElo: 1799,
    color: "text-white font-semibold",
    badgeBg: "bg-white/[0.12]",
    borderColor: "border-white/40",
    icon: "💠",
  },
  {
    id: "diamond",
    name: "Kiện Tướng (Diamond)",
    minElo: 1800,
    maxElo: 1999,
    color: "text-white font-bold",
    badgeBg: "bg-white/[0.16]",
    borderColor: "border-white/60",
    icon: "💎",
  },
  {
    id: "master",
    name: "Đại Kiện Tướng (Grandmaster)",
    minElo: 2000,
    maxElo: 9999,
    color: "text-white font-extrabold tracking-wider",
    badgeBg: "bg-white/[0.22]",
    borderColor: "border-white/90",
    icon: "👑",
  },
];

export function getRankTier(elo: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (elo >= RANK_TIERS[i].minElo) {
      return RANK_TIERS[i];
    }
  }
  return RANK_TIERS[0];
}

export interface BadgeDefinition {
  id: string;
  gameType: GameType | "all";
  name: string;
  icon: string;
  tier: RankTierId;
  description: string;
  conditionDescription: string;
  minEloRequired?: number;
  minWinsRequired?: number;
}

export const GAME_BADGES: BadgeDefinition[] = [
  // --- CHESS BADGES ---
  {
    id: "chess_novice",
    gameType: "chess",
    name: "Tập Sự Bàn Cờ",
    icon: "♟️",
    tier: "bronze",
    description: "Bước chân đầu tiên vào đấu trường 64 ô cờ vua quốc tế.",
    conditionDescription: "Tham gia thi đấu ván Cờ Vua đầu tiên",
    minEloRequired: 0,
  },
  {
    id: "chess_knight",
    gameType: "chess",
    name: "Mã Tiên Phong",
    icon: "♞",
    tier: "silver",
    description: "Nhảy qua chướng ngại, tung đòn đúp bất ngờ trên khắp bàn cờ.",
    conditionDescription: "Đạt mốc 1,200 ELO Cờ Vua",
    minEloRequired: 1200,
  },
  {
    id: "chess_bishop",
    gameType: "chess",
    name: "Tượng Xuyên Tâm",
    icon: "♝",
    tier: "gold",
    description: "Tay súng bắn tỉa đường chéo với tầm nhìn chiến thuật sắc bén.",
    conditionDescription: "Đạt mốc 1,400 ELO Cờ Vua",
    minEloRequired: 1400,
  },
  {
    id: "chess_rook",
    gameType: "chess",
    name: "Xe Thần Tốc",
    icon: "♜",
    tier: "platinum",
    description: "Thống trị các cột mở, công phá vững chãi như pháo đài thép.",
    conditionDescription: "Đạt mốc 1,600 ELO Cờ Vua",
    minEloRequired: 1600,
  },
  {
    id: "chess_queen",
    gameType: "chess",
    name: "Hậu Hoàng Gia",
    icon: "♛",
    tier: "diamond",
    description: "Sức mạnh áp đảo mọi góc cạnh, kiểm soát cục diện trận đấu.",
    conditionDescription: "Đạt mốc 1,800 ELO Cờ Vua",
    minEloRequired: 1800,
  },
  {
    id: "chess_grandmaster",
    gameType: "chess",
    name: "Đại Kiện Tướng FIDE",
    icon: "♔",
    tier: "master",
    description: "Đỉnh cao trí tuệ cờ vua văn phòng, biến hóa mọi nước cờ.",
    conditionDescription: "Đạt mốc 2,000 ELO Cờ Vua",
    minEloRequired: 2000,
  },
  {
    id: "chess_victor_5",
    gameType: "chess",
    name: "Chiến Binh 5 Sao Cờ Vua",
    icon: "⭐",
    tier: "silver",
    description: "Giành ít nhất 5 chiến thắng Cờ Vua vang dội.",
    conditionDescription: "Thắng 5 ván Cờ Vua",
    minWinsRequired: 5,
  },

  // --- XIANGQI BADGES ---
  {
    id: "xiangqi_novice",
    gameType: "xiangqi",
    name: "Tốt Nhập Trận",
    icon: "兵",
    tier: "bronze",
    description: "Tốt qua sông một đi không trở lại, dũng cảm tiến bước.",
    conditionDescription: "Bắt đầu hành trình Cờ Tướng",
    minEloRequired: 0,
  },
  {
    id: "xiangqi_cannon",
    gameType: "xiangqi",
    name: "Pháo Đầu Quán Quân",
    icon: "炮",
    tier: "silver",
    description: "Uy phong Pháo gióng thẳng trung lộ làm rung chuyển đối phương.",
    conditionDescription: "Đạt mốc 1,200 ELO Cờ Tướng",
    minEloRequired: 1200,
  },
  {
    id: "xiangqi_horse",
    gameType: "xiangqi",
    name: "Ngựa Phi Bàn Đột",
    icon: "傌",
    tier: "gold",
    description: "Mã hồi cung thoắt ẩn thoắt hiện, bước đi chữ Nhật ảo diệu.",
    conditionDescription: "Đạt mốc 1,400 ELO Cờ Tướng",
    minEloRequired: 1400,
  },
  {
    id: "xiangqi_chariot",
    gameType: "xiangqi",
    name: "Thiết Xa Vô Địch",
    icon: "俥",
    tier: "platinum",
    description: "Một Xe mười Tốt, quét sạch phòng tuyến Sở Hà Hán Giới.",
    conditionDescription: "Đạt mốc 1,600 ELO Cờ Tướng",
    minEloRequired: 1600,
  },
  {
    id: "xiangqi_marshal",
    gameType: "xiangqi",
    name: "Thống Soái Cửu Cung",
    icon: "帥",
    tier: "diamond",
    description: "Bậc thầy điều binh khiển tướng, bất động như núi.",
    conditionDescription: "Đạt mốc 1,800 ELO Cờ Tướng",
    minEloRequired: 1800,
  },
  {
    id: "xiangqi_king",
    gameType: "xiangqi",
    name: "Kỳ Vương Á Đông",
    icon: "👑",
    tier: "master",
    description: "Huyền thoại Cờ Tướng văn phòng, độc cô cầu bại.",
    conditionDescription: "Đạt mốc 2,000 ELO Cờ Tướng",
    minEloRequired: 2000,
  },
  {
    id: "xiangqi_victor_5",
    gameType: "xiangqi",
    name: "Danh Tướng 5 Trận",
    icon: "⚔️",
    tier: "silver",
    description: "Giành 5 chiến thắng thuyết phục trên sa trường Cờ Tướng.",
    conditionDescription: "Thắng 5 ván Cờ Tướng",
    minWinsRequired: 5,
  },

  // --- WEREWOLF BADGES ---
  {
    id: "werewolf_novice",
    gameType: "werewolf",
    name: "Dân Làng Tỉnh Táo",
    icon: "🌾",
    tier: "bronze",
    description: "Người dân chất phác, giữ vững niềm tin công lý trước bầy sói.",
    conditionDescription: "Tham gia ván Ma Sói đầu tiên",
    minEloRequired: 0,
  },
  {
    id: "werewolf_seer",
    gameType: "werewolf",
    name: "Tiên Tri Thấu Thị",
    icon: "🔮",
    tier: "silver",
    description: "Vén màn bóng tối mỗi đêm, nhìn thấu chân tướng từng vai diễn.",
    conditionDescription: "Đạt mốc 1,200 ELO Ma Sói",
    minEloRequired: 1200,
  },
  {
    id: "werewolf_hunter",
    gameType: "werewolf",
    name: "Thợ Săn Chuẩn Xác",
    icon: "🏹",
    tier: "gold",
    description: "Mũi tên định mệnh không bao giờ trượt mục tiêu sói ngầm.",
    conditionDescription: "Đạt mốc 1,400 ELO Ma Sói",
    minEloRequired: 1400,
  },
  {
    id: "werewolf_guard",
    gameType: "werewolf",
    name: "Hộ Vệ Bất Tử",
    icon: "🛡️",
    tier: "platinum",
    description: "Bảo vệ đồng đội an toàn tuyệt đối qua những đêm trăng máu.",
    conditionDescription: "Đạt mốc 1,600 ELO Ma Sói",
    minEloRequired: 1600,
  },
  {
    id: "werewolf_alpha",
    gameType: "werewolf",
    name: "Sói Đầu Đàn",
    icon: "🐺",
    tier: "diamond",
    description: "Lãnh tụ bầy sói, nghệ thuật ngụy trang và thao túng đỉnh cao.",
    conditionDescription: "Đạt mốc 1,800 ELO Ma Sói",
    minEloRequired: 1800,
  },
  {
    id: "werewolf_legend",
    gameType: "werewolf",
    name: "Ma Sói Huyền Thoại",
    icon: "🩸",
    tier: "master",
    description: "Bậc thầy tâm lý chiến, thao túng toàn bộ bàn đàm phán.",
    conditionDescription: "Đạt mốc 2,000 ELO Ma Sói",
    minEloRequired: 2000,
  },
  {
    id: "werewolf_victor_5",
    gameType: "werewolf",
    name: "Cao Thủ Sống Sót",
    icon: "🌕",
    tier: "silver",
    description: "Thắng 5 ván Ma Sói bất kể phe Dân hay Sói.",
    conditionDescription: "Thắng 5 ván Ma Sói",
    minWinsRequired: 5,
  },

  // --- ARCADE CYBER SLASH BADGES ---
  {
    id: "arcade_novice",
    gameType: "arcade",
    name: "Tân Thủ Phản Xạ",
    icon: "⚡",
    tier: "bronze",
    description: "Bước chân vào đấu trường Chibi Cyber Slash tốc độ cao.",
    conditionDescription: "Tham gia ván Cyber Slash đầu tiên",
    minEloRequired: 0,
  },
  {
    id: "arcade_slasher",
    gameType: "arcade",
    name: "Kiếm Khách Tốc Độ",
    icon: "🗡️",
    tier: "silver",
    description: "Chém rách mọi chướng ngại vật với tốc độ ánh sáng.",
    conditionDescription: "Đạt mốc 1,200 ELO Arcade",
    minEloRequired: 1200,
  },
  {
    id: "arcade_master",
    gameType: "arcade",
    name: "Bậc Thầy Chém Bug",
    icon: "👾",
    tier: "gold",
    description: "Tiêu diệt bầy Bug văn phòng và bảo vệ hệ thống tuyệt đối.",
    conditionDescription: "Đạt mốc 1,400 ELO Arcade",
    minEloRequired: 1400,
  },
  {
    id: "arcade_god",
    gameType: "arcade",
    name: "Chiến Thần Phản Xạ",
    icon: "👑",
    tier: "master",
    description: "Combo liên hoàn thần thánh, không một chướng ngại nào chạm được.",
    conditionDescription: "Đạt mốc 1,800 ELO Arcade",
    minEloRequired: 1800,
  },
  // --- UNO BATTLE BADGES ---
  {
    id: "uno_novice",
    gameType: "uno",
    name: "Tập Sự Uno",
    icon: "🎴",
    tier: "bronze",
    description: "Bước vào đại chiến Uno công sở náo nhiệt.",
    conditionDescription: "Tham gia thi đấu ván bài Uno đầu tiên",
    minEloRequired: 0,
  },
  {
    id: "uno_wild",
    gameType: "uno",
    name: "Bậc Thầy Đổi Màu",
    icon: "🌈",
    tier: "silver",
    description: "Biến hóa khôn lường với những lá bài Wild & Wild Draw 4 đảo chiều.",
    conditionDescription: "Đạt mốc 1,200 ELO Uno",
    minEloRequired: 1200,
  },
  {
    id: "uno_shouter",
    gameType: "uno",
    name: "Thần Tốc UNO!",
    icon: "⚡",
    tier: "gold",
    description: "Hô UNO chớp nhoáng, không đối thủ nào kịp bắt lỗi phạt.",
    conditionDescription: "Đạt mốc 1,400 ELO Uno",
    minEloRequired: 1400,
  },
  {
    id: "uno_master",
    gameType: "uno",
    name: "Đại Kiện Tướng Uno",
    icon: "👑",
    tier: "master",
    description: "Thống trị bàn bài 4 người, hạ gục mọi đối thủ sành sỏi.",
    conditionDescription: "Đạt mốc 1,800 ELO Uno",
    minEloRequired: 1800,
  },
];

/**
 * Standard FIDE Elo calculation formula
 * @param playerElo Current Elo of the player
 * @param opponentElo Current Elo of the opponent
 * @param score 1 = Win, 0.5 = Draw, 0 = Loss
 * @param gamesPlayed Total number of games played (used to adjust K factor)
 */
export function calculateElo(
  playerElo: number,
  opponentElo: number,
  score: number,
  gamesPlayed: number = 25
): {
  playerDelta: number;
  opponentDelta: number;
  newPlayerElo: number;
  newOpponentElo: number;
  expectedScore: number;
} {
  // Determine K-factor dynamically
  let k = 24;
  if (gamesPlayed < 20 || playerElo < 1300) {
    k = 32; // Placement / novice rapid scaling
  } else if (playerElo >= 1800) {
    k = 16; // Master stability
  }

  // Expected score for player A against B
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  
  // Rating change
  const rawDelta = k * (score - expectedScore);
  const playerDelta = Math.round(rawDelta);
  const opponentDelta = -playerDelta;

  const newPlayerElo = Math.max(100, playerElo + playerDelta);
  const newOpponentElo = Math.max(100, opponentElo + opponentDelta);

  return {
    playerDelta,
    opponentDelta,
    newPlayerElo,
    newOpponentElo,
    expectedScore,
  };
}

/**
 * Evaluates which badges should be unlocked given user's current game rating and stats
 */
export function checkBadgesToUnlock(
  gameType: GameType,
  currentElo: number,
  totalWins: number,
  alreadyUnlockedIds: string[]
): BadgeDefinition[] {
  const eligibleBadges = GAME_BADGES.filter(
    (b) => b.gameType === gameType || b.gameType === "all"
  );

  const newlyUnlocked: BadgeDefinition[] = [];

  for (const badge of eligibleBadges) {
    if (alreadyUnlockedIds.includes(badge.id)) continue;

    let qualifies = true;
    if (badge.minEloRequired !== undefined && currentElo < badge.minEloRequired) {
      qualifies = false;
    }
    if (badge.minWinsRequired !== undefined && totalWins < badge.minWinsRequired) {
      qualifies = false;
    }

    if (qualifies) {
      newlyUnlocked.push(badge);
    }
  }

  return newlyUnlocked;
}

/**
 * Cấu hình phần thưởng điểm danh hàng ngày dựa trên ELO người chơi:
 * - Cơ bản: 500 Lúa 🌾
 * - ELO càng cao, nhận thêm thưởng bậc danh giá càng nhiều (lên đến 1,500 Lúa/ngày)
 */
export interface DailyBonusCalculation {
  base: number;
  bonus: number;
  total: number;
  tierName: string;
  icon: string;
  minElo: number;
  nextTierName?: string;
  nextTierMinElo?: number;
  eloNeededForNextTier?: number;
}

export const DAILY_BONUS_TIERS = [
  { minElo: 0, maxElo: 1199, name: "Tập Sự (Bronze)", base: 500, bonus: 0, total: 500, icon: "🥉" },
  { minElo: 1200, maxElo: 1399, name: "Chiến Binh (Silver)", base: 500, bonus: 100, total: 600, icon: "🥈" },
  { minElo: 1400, maxElo: 1599, name: "Cao Thủ (Gold)", base: 500, bonus: 250, total: 750, icon: "🥇" },
  { minElo: 1600, maxElo: 1799, name: "Tinh Anh (Platinum)", base: 500, bonus: 400, total: 900, icon: "💠" },
  { minElo: 1800, maxElo: 1999, name: "Kiện Tướng (Diamond)", base: 500, bonus: 600, total: 1100, icon: "💎" },
  { minElo: 2000, maxElo: 9999, name: "Đại Kiện Tướng (Master)", base: 500, bonus: 1000, total: 1500, icon: "👑" },
];

export function calculateDailyBonus(elo: number): DailyBonusCalculation {
  let matchedTier = DAILY_BONUS_TIERS[0];
  let nextTier = DAILY_BONUS_TIERS[1];

  for (let i = DAILY_BONUS_TIERS.length - 1; i >= 0; i--) {
    if (elo >= DAILY_BONUS_TIERS[i].minElo) {
      matchedTier = DAILY_BONUS_TIERS[i];
      nextTier = DAILY_BONUS_TIERS[i + 1];
      break;
    }
  }

  return {
    base: matchedTier.base,
    bonus: matchedTier.bonus,
    total: matchedTier.total,
    tierName: matchedTier.name,
    icon: matchedTier.icon,
    minElo: matchedTier.minElo,
    nextTierName: nextTier?.name,
    nextTierMinElo: nextTier?.minElo,
    eloNeededForNextTier: nextTier ? Math.max(0, nextTier.minElo - elo) : undefined,
  };
}
