"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, ShieldAlert, Vote } from "lucide-react";
import { playCardWhoosh, playRouletteTick } from "@/lib/audio";

export interface RotatingCardItem {
  id: string;
  name: string;
  avatar: string;
  isAlive: boolean;
  isSelf: boolean;
  badge?: string;
  gradient?: string;
  imageUrl?: string;
}

interface RotatingCardsProps {
  items: RotatingCardItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
}

export function RotatingCards({
  items,
  selectedId,
  onSelect,
  title = "Chọn mục tiêu biểu quyết",
  subtitle = "Xoay vòng 3D và chạm để chọn người bạn nghi ngờ nhất",
  confirmLabel = "Xác nhận phiếu bầu",
  onConfirm,
}: RotatingCardsProps) {
  // Only rotate through alive candidates (excluding self if voting on others)
  const selectableItems = items.filter((item) => item.isAlive && !item.isSelf);
  const total = selectableItems.length;

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentAngleRef = useRef(0);

  const angleStep = total > 0 ? 360 / total : 0;
  const radius = Math.max(220, Math.min(380, total * 35));

  // Sync active item when selectedId changes externally
  useEffect(() => {
    if (selectedId) {
      const idx = selectableItems.findIndex((it) => it.id === selectedId);
      if (idx !== -1 && idx !== activeIndex) {
        goToIndex(idx);
      }
    }
  }, [selectedId]);

  const goToIndex = useCallback(
    (index: number) => {
      const normalized = (index + total) % total;
      setActiveIndex(normalized);
      const targetAngle = -normalized * angleStep;
      setRotationAngle(targetAngle);
      currentAngleRef.current = targetAngle;
      try {
        playRouletteTick();
      } catch {}
    },
    [total, angleStep]
  );

  const handlePrev = () => {
    if (total === 0) return;
    goToIndex(activeIndex - 1);
  };

  const handleNext = () => {
    if (total === 0) return;
    goToIndex(activeIndex + 1);
  };

  // Pointer drag handling for 3D rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || total === 0) return;
    const deltaX = e.clientX - startXRef.current;
    const sensitivity = 0.35;
    const newAngle = currentAngleRef.current + deltaX * sensitivity;
    setRotationAngle(newAngle);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    // Snap to nearest card
    if (angleStep > 0) {
      const nearestIndex = Math.round(-rotationAngle / angleStep);
      const normalized = ((nearestIndex % total) + total) % total;
      goToIndex(normalized);
    }
  };

  if (selectableItems.length === 0) {
    return (
      <div className="text-center py-8 text-white/50 text-sm">
        Không có mục tiêu nào khả dụng để bỏ phiếu.
      </div>
    );
  }

  const currentSelected = selectableItems[activeIndex];

  return (
    <div className="relative w-full max-w-xl mx-auto flex flex-col items-center select-none py-2">
      {/* Header */}
      <div className="text-center mb-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold uppercase tracking-wider mb-1">
          <Vote className="w-3.5 h-3.5 text-red-400 animate-pulse" />
          {title}
        </div>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      {/* 3D Stage Carousel */}
      <div
        className="relative w-full h-[320px] flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
        style={{ perspective: 1000 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Subtle glowing ring under the cards */}
        <div
          className="absolute w-[280px] h-[70px] rounded-[50%] bg-red-500/10 blur-xl pointer-events-none transform -translate-y-12"
          style={{ transform: "rotateX(70deg) translateZ(-60px)" }}
        />

        <div
          className="relative w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${rotationAngle}deg)`,
          }}
        >
          {selectableItems.map((item, idx) => {
            const cardAngle = idx * angleStep;
            const isCur = idx === activeIndex;
            const isTarget = item.id === selectedId;

            return (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  goToIndex(idx);
                  onSelect(item.id);
                }}
                className={`absolute w-36 h-52 rounded-2xl p-3 flex flex-col items-center justify-between transition-all duration-300 cursor-pointer ${
                  isCur
                    ? "ring-2 ring-red-400 shadow-[0_0_30px_rgba(239,68,68,0.45)] scale-105 z-20"
                    : "opacity-60 hover:opacity-90 scale-95 z-10"
                } ${
                  isTarget
                    ? "bg-gradient-to-b from-red-950/90 via-slate-900/95 to-black/95 border-2 border-red-500"
                    : "bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-black/95 border border-slate-700/60"
                } backdrop-blur-md`}
                style={{
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${cardAngle}deg) translateZ(${radius}px)`,
                }}
              >
                {/* Status tag */}
                <div className="w-full flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-400">#{idx + 1}</span>
                  {isTarget ? (
                    <span className="flex items-center gap-1 text-red-400 font-bold bg-red-500/20 px-2 py-0.5 rounded-full text-[10px]">
                      <Check className="w-3 h-3" /> Đã chọn
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px]">Chạm để chọn</span>
                  )}
                </div>

                {/* Avatar / Artwork */}
                <div className="relative my-auto flex flex-col items-center">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-white/10 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-3xl shadow-inner">
                    {item.avatar}
                  </div>
                  <span className="mt-2 text-sm font-bold text-white text-center line-clamp-1 max-w-[120px]">
                    {item.name}
                  </span>
                  {item.badge && (
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Action CTA */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToIndex(idx);
                    onSelect(item.id);
                  }}
                  className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isTarget
                      ? "bg-red-600 text-white shadow-md shadow-red-900/40"
                      : "bg-white/10 hover:bg-white/20 text-slate-200"
                  }`}
                >
                  {isTarget ? "Đã chọn bầu" : "Bầu người này"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center gap-4 mt-1 z-30">
        <button
          type="button"
          onClick={handlePrev}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          aria-label="Previous card"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center min-w-[160px]">
          <span className="text-xs text-slate-400">
            Ứng viên ({activeIndex + 1}/{total}):
          </span>
          <div className="text-sm font-bold text-white">
            {currentSelected?.name || "---"}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          aria-label="Next card"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Confirm Button */}
      {onConfirm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 w-full px-6 flex justify-center"
        >
          <button
            type="button"
            disabled={!selectedId}
            onClick={onConfirm}
            className={`w-full max-w-xs py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              selectedId
                ? "bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-red-500/25 hover:scale-[1.02] active:scale-[0.98]"
                : "bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-700/40"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {confirmLabel}
          </button>
        </motion.div>
      )}
    </div>
  );
}
