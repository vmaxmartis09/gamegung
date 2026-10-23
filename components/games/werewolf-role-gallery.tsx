"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ROLE_INFO, Role } from "@/lib/games/werewolf-engine";
import { ROLE_THEMES, RoleCardIllustration } from "./werewolf-card-art";
import { cn } from "@/lib/utils";

type Group = "all" | "wolves" | "village" | "expansion";

const PLAYABLE: Role[] = ["wolf", "wolf_cub", "white_wolf", "seer", "guard", "witch", "hunter", "cupid", "elder", "villager"];

/** Roles from the base game + expansions (New Moon, The Village, Characters, Character Plus) — not yet playable. */
const EXPANSION: { emoji: string; name: string; set: string; desc: string }[] = [
  { emoji: "👮", name: "Cảnh Sát Trưởng", set: "Cơ bản", desc: "Phiếu bầu được tính là 2 phiếu; có thể chuyển chức khi chết." },
  { emoji: "👧", name: "Cô Bé", set: "Cơ bản", desc: "Từ đêm thứ hai có thể nhìn lén để nhận biết Sói." },
  { emoji: "🧬", name: "Nửa Người Nửa Sói", set: "Cơ bản", desc: "Bị Sói cắn thì không chết mà hoá thành Sói." },
  { emoji: "🦹", name: "Ăn Trộm", set: "Cơ bản", desc: "Đêm đầu chọn một trong hai vai phụ; nếu có Sói buộc phải chọn Sói." },
  { emoji: "🤡", name: "Thằng Ngốc", set: "New Moon", desc: "Bị treo cổ thì lật bài, sống tiếp nhưng mất quyền bỏ phiếu." },
  { emoji: "🎭", name: "Người Thế Thân", set: "New Moon", desc: "Bị loại khi bỏ phiếu hoà; được chọn người bỏ phiếu sáng hôm sau." },
  { emoji: "🪈", name: "Người Thổi Sáo", set: "New Moon", desc: "Mỗi đêm thôi miên hai người; thắng khi mọi người sống đều bị thôi miên." },
  { emoji: "🔥", name: "Kẻ Đốt Nhà", set: "The Village", desc: "Đốt một nhà (1 lần); trúng nạn nhân của Sói thì Sói bên phải chết." },
  { emoji: "🐦‍⬛", name: "Con Quạ", set: "The Village", desc: "Mỗi đêm chỉ định một người, sáng hôm sau người đó bị 2 phiếu chống." },
  { emoji: "👭", name: "Hai Chị Em / Ba Anh Em", set: "Characters", desc: "Đêm đầu nhận biết nhau, cùng phe Dân." },
  { emoji: "😇", name: "Thiên Sứ", set: "Characters", desc: "Thắng ngay nếu bị Sói cắn đêm đầu hoặc bị treo sáng đầu." },
  { emoji: "⚖️", name: "Thẩm Phán Lắp Bắp", set: "Characters", desc: "Một lần được kích hoạt thêm một vòng bỏ phiếu treo cổ." },
  { emoji: "⚔️", name: "Hiệp Sĩ Kiếm Gỉ", set: "Characters", desc: "Bị Sói cắn thì chết, con Sói đó bị thương và chết sau một ngày đêm." },
  { emoji: "🦊", name: "Cáo", set: "Characters", desc: "Mỗi đêm chọn 3 người; có ít nhất 1 Sói thì giữ năng lực." },
  { emoji: "🐻", name: "Người Thuần Phục Gấu", set: "Characters", desc: "Được báo nếu một trong hai người bên cạnh là Sói." },
  { emoji: "🎪", name: "Diễn Viên", set: "Characters", desc: "Ba đêm đầu có thể đổi sang một trong 3 vai phụ." },
  { emoji: "🧒", name: "Đứa Trẻ Hoang Dã", set: "Characters", desc: "Chọn một hình mẫu; hình mẫu chết thì hoá Sói." },
  { emoji: "🐺👑", name: "Sói Lớn Xấu Xa", set: "Characters", desc: "Có thể sống lại một lần để ăn thêm một dân làng." },
  { emoji: "🐺🍼", name: "Người Cha Của Sói", set: "Characters", desc: "Một lần biến nạn nhân của Sói thành Sói." },
  { emoji: "🕯️", name: "Bà Đồng", set: "Characters", desc: "Năm lần gọi hồn để hỏi người chết một câu." },
  { emoji: "🌙", name: "Nguyệt Nữ", set: "Character Plus", desc: "Mỗi đêm vô hiệu hoá năng lực của một người." },
  { emoji: "🌀", name: "Thầy Thôi Miên", set: "Character Plus", desc: "Mê hoặc một người; thầy chết thì người đó chết thay." },
  { emoji: "💊", name: "Dược Sĩ", set: "Character Plus", desc: "Thuốc mê (câm + mất phiếu một ngày) và thuốc hồi phục." },
  { emoji: "🎎", name: "Người Múa Rối", set: "Character Plus", desc: "Một lần chỉ định Sói ăn thịt một người bất kỳ." },
  { emoji: "🗡️", name: "Sát Thủ", set: "Character Plus", desc: "Cứ hai đêm, đủ 4 phiếu chỉ vào mình thì được giết một người." },
  { emoji: "🏇", name: "Kị Sĩ", set: "Character Plus", desc: "Ban ngày kiểm tra một người: là Sói thì Sói chết, không thì Kị Sĩ chết." },
  { emoji: "🔮", name: "Người Gọi Hồn", set: "Character Plus", desc: "Mỗi đêm hỏi người chết gần nhất và nhận gợi ý không lời." },
  { emoji: "🔥🐺", name: "Sói Lửa", set: "Character Plus", desc: "Sau khi có Sói chết, chọn một người mất năng lực vĩnh viễn." },
  { emoji: "🐺🐺", name: "Anh Em Sói", set: "Character Plus", desc: "Sói Anh hoạt động; Sói Em thức dậy sau khi Sói Anh chết." },
  { emoji: "👤", name: "Ảnh Tử", set: "Character Plus", desc: "Đêm đầu chọn một người; người đó chết thì lấy vai của họ." },
  { emoji: "⚰️", name: "Kẻ Báo Thù", set: "Character Plus", desc: "Chọn phe; khi chết kéo theo một người thuộc phe đối lập." },
];

const TABS: { id: Group; label: string }[] = [
  { id: "all", label: "Đang chơi được" },
  { id: "wolves", label: "🐺 Phe Sói" },
  { id: "village", label: "🏘️ Phe Dân" },
  { id: "expansion", label: "📦 Mở rộng" },
];

export function WerewolfRoleGallery() {
  const [tab, setTab] = useState<Group>("all");
  const [open, setOpen] = useState<Role | null>(null);
  const roles = PLAYABLE.filter((r) => (tab === "all" ? true : tab === "wolves" ? ROLE_INFO[r].team === "wolves" : ROLE_INFO[r].team === "village"));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] p-1 text-xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn("rounded-lg px-3 py-1.5 font-bold transition-all", tab === t.id ? "bg-white text-black" : "text-white/60 hover:text-white")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab !== "expansion" ? (
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {roles.map((r, i) => {
              const th = ROLE_THEMES[r];
              const info = ROLE_INFO[r];
              const flipped = open === r;
              return (
                <motion.button
                  key={r}
                  type="button"
                  onClick={() => setOpen(flipped ? null : r)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -6, rotate: -0.6 }}
                  whileTap={{ scale: 0.97 }}
                  className={cn("group relative overflow-hidden rounded-2xl border text-left bg-gradient-to-b", th.bgGradient)}
                  style={{ borderColor: th.borderGlow, boxShadow: `0 0 22px ${th.glowColor}` }}
                >
                  <div className="relative aspect-[3/4] w-full">
                    <RoleCardIllustration role={r} className="h-full w-full" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black" style={{ color: th.accentColor }}>
                      {th.teamLabel}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-xl leading-none">{info.emoji}</p>
                      <p className="font-display text-base font-extrabold text-white">{info.name}</p>
                      <p className="text-[11px] italic" style={{ color: th.accentColor }}>{th.sub}</p>
                    </div>
                    <AnimatePresence>
                      {flipped && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col justify-center gap-2 bg-black/90 p-3 text-[11px] leading-snug text-white">
                          <p className="font-bold" style={{ color: th.accentColor }}>{info.name}</p>
                          <p>{info.desc}</p>
                          <p className="text-white/60">💡 {info.tip}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div key="exp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <p className="mb-3 text-xs text-ink-300">Các vai từ bản cơ bản và bản mở rộng (New Moon, The Village, Characters, Character Plus) — sẽ lần lượt được thêm vào game.</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {EXPANSION.map((e, i) => (
                <motion.div
                  key={e.name}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i, 12) * 0.02 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{e.emoji}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white/70">{e.set}</span>
                  </div>
                  <p className="mt-1 font-display text-sm font-extrabold text-white">{e.name}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-300">{e.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
