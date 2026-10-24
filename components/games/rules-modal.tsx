"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { GameType } from "@/lib/ranking-system";
import { GameIcon, GAME_BY_ID } from "@/components/art/game-art";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: GameType;
}

const RULES: Record<GameType, { standard: string; items: { t: string; d: string }[]; keys?: string[] }> = {
  chess: {
    standard: "Luật FIDE",
    items: [
      { t: "Kết thúc", d: "Chiếu hết thắng. Hoà khi hết nước (pat), lặp thế 3 lần, 50 nước không ăn/không đi tốt, hoặc không đủ lực chiếu hết." },
      { t: "Nước đặc biệt", d: "Nhập thành, bắt tốt qua đường, phong cấp (chọn Hậu/Xe/Tượng/Mã)." },
      { t: "Đồng hồ", d: "Hết giờ là thua — trừ khi đối thủ không còn đủ quân để chiếu hết (hoà). Có chế độ cộng giờ mỗi nước." },
      { t: "Xếp hạng / Tập luyện", d: "Ván xếp hạng tính ELO & Lúa, không gợi ý, không đi lại. Ván tập có 3 gợi ý, 3 lần đi lại, thanh đánh giá." },
    ],
    keys: ["← → xem lại nước", "F xoay bàn", "Kéo-thả hoặc bấm để đi"],
  },
  caro: {
    standard: "Gomoku 15x15",
    items: [
      { t: "Cách chơi", d: "Hai bên lần lượt đặt ✕ và ◯ lên giao điểm bàn 15x15, ✕ đi trước." },
      { t: "Thắng", d: "Người đầu tiên tạo được 5 quân liền nhau theo hàng ngang, dọc hoặc chéo là thắng. Kín bàn là hòa." },
      { t: "Chế độ", d: "Đấu AI (Dễ/Vừa/Khó) hoặc 2 người trên cùng máy. Có nút Đi lại." },
    ],
  },
  xiangqi: {
    standard: "Luật WXF",
    items: [
      { t: "Quân cờ", d: "Tướng/Sĩ ở cửu cung, Tượng không qua sông và bị cản mắt, Mã bị cản chân, Pháo ăn phải có ngòi, Tốt qua sông được đi ngang." },
      { t: "Lộ mặt tướng", d: "Hai Tướng không được đối mặt trên cùng cột mà không có quân chắn." },
      { t: "Thắng thua", d: "Chiếu bí hoặc làm đối phương hết nước đi (bị vây) đều thắng." },
      { t: "Chiếu dai & hoà", d: "Lặp thế 3 lần: bên chiếu liên tục bị xử thua, nếu không thì hoà. 60 nước không ăn quân → hoà." },
    ],
    keys: ["Ký hiệu: P2-5 (bình), M8.7 (tiến), X1/2 (thoái)"],
  },
  werewolf: {
    standard: "6 vai cổ điển",
    items: [
      { t: "Đêm", d: "Bảo Vệ che 1 người (không 2 đêm liền 1 người) → Sói chọn mồi → Tiên Tri soi 1 người → Phù Thủy cứu/đầu độc (mỗi bình 1 lần)." },
      { t: "Ngày", d: "Thảo luận 60 giây rồi bỏ phiếu. Đa số mới bị treo; hoà phiếu thì không ai chết." },
      { t: "Thợ Săn", d: "Khi chết (trừ trúng độc) được bắn chết 1 người." },
      { t: "Thắng", d: "Dân thắng khi diệt hết Sói. Sói thắng khi số Sói ≥ số người còn lại." },
    ],
    keys: ["Chat: nhắc tên + “sói/nghi” để buộc tội", "“tôi là tiên tri” để nhận vai"],
  },
  arcade: {
    standard: "Arcade",
    items: [
      { t: "Mục tiêu", d: "Chém bug rơi xuống, đừng để Deadline chạm đáy. Đạt điểm mục tiêu của độ khó để thắng ván xếp hạng." },
      { t: "Combo", d: "Chém liên tiếp tăng hệ số tới x5. Để lọt bug hoặc bị trúng sẽ mất combo." },
      { t: "Vật phẩm", d: "Cà phê làm chậm thời gian, Khiên chặn 1 đòn, Tia sét mở rộng vùng chém." },
      { t: "Boss", d: "Mỗi 5 cấp xuất hiện Boss DEADLINE nhiều máu, bắn bug con." },
    ],
    keys: ["Chuột/chạm: di chuyển + bấm để chém", "A/D hoặc ←/→, Space chém, Shift lướt", "P/Esc tạm dừng"],
  },
  uno: {
    standard: "Họ Mau-Mau / Switch",
    items: [
      { t: "Đánh bài", d: "Đánh lá cùng phòng ban hoặc cùng số/chức năng. Có thể đánh nhiều lá cùng số một lúc." },
      { t: "Lá chức năng", d: "Đẩy việc +2, Nghỉ phép (người kế mất lượt), Đổi ca (đảo chiều), Chuyển phòng (chọn phòng ban), Sếp giao +4." },
      { t: "Chồng phạt", d: "Đang bị +2 có thể đánh +2/+4 để đẩy tiếp; +4 chồng được lên mọi lá phạt. Không đỡ được thì nhận hết." },
      { t: "CHỐT!", d: "Còn 1 lá phải hô CHỐT. Quên mà bị bắt lỗi trước lượt kế tiếp thì rút 2 lá." },
    ],
    keys: ["Bấm lá để chọn, bấm thêm lá cùng số để đánh đôi", "Bấm đúp để đánh ngay"],
  },
  typing: {
    standard: "Gõ phím đối kháng",
    items: [
      { t: "Chế độ 1 · Đọ tên lửa", d: "Gõ đúng từ hiện trên ô rồi bấm bắn để phóng tên lửa. Từ càng dài sát thương càng lớn, bắn liên tiếp được combo. Hết 5000 máu là thua." },
      { t: "Chế độ 2 · Tranh vật phẩm", d: "Giữa không gian có vật phẩm lơ lửng, mỗi cái có 2 từ (xanh cho P1, hồng cho P2). Ai gõ xong từ của mình trước sẽ nhận được: Đạn, Giáp, Phản dame, Xóa chữ, Hút máu 5s, Làm chậm." },
      { t: "Chế độ 3 · Đua tốc độ", d: "Mỗi bên gõ một đoạn văn dài bằng nhau, ai gõ xong trước thắng." },
      { t: "Bàn phím chia đôi", d: "P1 dùng nửa trái, P2 dùng nửa phải, từ vựng mỗi bên chỉ gồm chữ ở nửa phím của mình nên hai người gõ cùng lúc trên một bàn phím." },
    ],
    keys: ["P1: Q W E R T / A S D F G / Z X C V B, Space bắn", "P2: Y U I O P / H J K L / N M, Enter bắn", "Esc: về màn thiết lập"],
  },
};

export function RulesModal({ isOpen, onClose, gameType }: RulesModalProps) {
  const data = RULES[gameType] ?? RULES.chess;
  const meta = GAME_BY_ID[gameType];

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Luật ${meta.name}`}
            className="panel w-full max-w-lg max-h-[92dvh] no-scrollbar overflow-y-auto space-y-4 p-6"
          >
            <div className="flex items-center gap-3">
              <GameIcon game={gameType} className="size-11" />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-xl font-extrabold">{meta.name}</h3>
                <p className="text-xs text-ink-400">{data.standard}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Đóng" className="grid size-9 place-items-center rounded-xl text-ink-300 hover:bg-white/[0.06] hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <ol className="space-y-2">
              {data.items.map((it, i) => (
                <li key={it.t} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white text-xs font-black text-black">{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold">{it.t}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-300">{it.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            {data.keys && (
              <div className="flex flex-wrap gap-1.5">
                {data.keys.map((k) => (
                  <span key={k} className="chip">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default RulesModal;
