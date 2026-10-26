"use client";

import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useAuthStore } from "@/lib/auth";
import { Aurora as StillAurora } from "@/components/reactbits/aurora";
import { getGpuInfo } from "@/lib/motion";

type Loader = () => Promise<{ default: ComponentType<Record<string, unknown>> }>;

/** 36 hình nền từ reactbits.dev (components/backgrounds), mỗi lần tải trang / đăng nhập chọn ngẫu nhiên một cái. */
const BACKGROUNDS: [string, Loader][] = [
  ["Aurora", () => import("@/components/backgrounds/Aurora/Aurora") as unknown as ReturnType<Loader>],
  ["SoftAurora", () => import("@/components/backgrounds/SoftAurora/SoftAurora") as unknown as ReturnType<Loader>],
  ["Silk", () => import("@/components/backgrounds/Silk/Silk") as unknown as ReturnType<Loader>],
  ["DarkVeil", () => import("@/components/backgrounds/DarkVeil/DarkVeil") as unknown as ReturnType<Loader>],
  ["LightPillar", () => import("@/components/backgrounds/LightPillar/LightPillar") as unknown as ReturnType<Loader>],
  ["LightRays", () => import("@/components/backgrounds/LightRays/LightRays") as unknown as ReturnType<Loader>],
  ["SideRays", () => import("@/components/backgrounds/SideRays/SideRays") as unknown as ReturnType<Loader>],
  ["FloatingLines", () => import("@/components/backgrounds/FloatingLines/FloatingLines") as unknown as ReturnType<Loader>],
  ["LineWaves", () => import("@/components/backgrounds/LineWaves/LineWaves") as unknown as ReturnType<Loader>],
  ["ColorBends", () => import("@/components/backgrounds/ColorBends/ColorBends") as unknown as ReturnType<Loader>],
  ["PixelBlast", () => import("@/components/backgrounds/PixelBlast/PixelBlast") as unknown as ReturnType<Loader>],
  ["Plasma", () => import("@/components/backgrounds/Plasma/Plasma") as unknown as ReturnType<Loader>],
  ["PlasmaWave", () => import("@/components/backgrounds/PlasmaWave/PlasmaWave") as unknown as ReturnType<Loader>],
  ["Particles", () => import("@/components/backgrounds/Particles/Particles") as unknown as ReturnType<Loader>],
  ["GradientBlinds", () => import("@/components/backgrounds/GradientBlinds/GradientBlinds") as unknown as ReturnType<Loader>],
  ["Grainient", () => import("@/components/backgrounds/Grainient/Grainient") as unknown as ReturnType<Loader>],
  ["GridScan", () => import("@/components/backgrounds/GridScan/GridScan") as unknown as ReturnType<Loader>],
  ["Beams", () => import("@/components/backgrounds/Beams/Beams") as unknown as ReturnType<Loader>],
  ["PixelSnow", () => import("@/components/backgrounds/PixelSnow/PixelSnow") as unknown as ReturnType<Loader>],
  ["Lightning", () => import("@/components/backgrounds/Lightning/Lightning") as unknown as ReturnType<Loader>],
  ["PrismaticBurst", () => import("@/components/backgrounds/PrismaticBurst/PrismaticBurst") as unknown as ReturnType<Loader>],
  ["Galaxy", () => import("@/components/backgrounds/Galaxy/Galaxy") as unknown as ReturnType<Loader>],
  ["Dither", () => import("@/components/backgrounds/Dither/Dither") as unknown as ReturnType<Loader>],
  ["FaultyTerminal", () => import("@/components/backgrounds/FaultyTerminal/FaultyTerminal") as unknown as ReturnType<Loader>],
  ["RippleGrid", () => import("@/components/backgrounds/RippleGrid/RippleGrid") as unknown as ReturnType<Loader>],
  ["DotGrid", () => import("@/components/backgrounds/DotGrid/DotGrid") as unknown as ReturnType<Loader>],
  ["Threads", () => import("@/components/backgrounds/Threads/Threads") as unknown as ReturnType<Loader>],
  ["Iridescence", () => import("@/components/backgrounds/Iridescence/Iridescence") as unknown as ReturnType<Loader>],
  ["Waves", () => import("@/components/backgrounds/Waves/Waves") as unknown as ReturnType<Loader>],
  ["Orb", () => import("@/components/backgrounds/Orb/Orb") as unknown as ReturnType<Loader>],
  ["LetterGlitch", () => import("@/components/backgrounds/LetterGlitch/LetterGlitch") as unknown as ReturnType<Loader>],
  ["ShapeGrid", () => import("@/components/backgrounds/ShapeGrid/ShapeGrid") as unknown as ReturnType<Loader>],
  ["LiquidChrome", () => import("@/components/backgrounds/LiquidChrome/LiquidChrome") as unknown as ReturnType<Loader>],
  ["Balatro", () => import("@/components/backgrounds/Balatro/Balatro") as unknown as ReturnType<Loader>],
  ["Prism", () => import("@/components/backgrounds/Prism/Prism") as unknown as ReturnType<Loader>],
  ["LiquidEther", () => import("@/components/backgrounds/LiquidEther/LiquidEther") as unknown as ReturnType<Loader>],
];

const pickIndex = (avoid = -1) => {
  let i = Math.floor(Math.random() * BACKGROUNDS.length);
  if (i === avoid) i = (i + 1) % BACKGROUNDS.length;
  return i;
};

const INTERACTIVE = "button,a,input,select,textarea,label,summary,[role=button],[role=tab],[contenteditable=true]";
const FORWARD = ["pointermove", "mousemove", "pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;

/**
 * Nội dung trang nằm đè lên hình nền nên hình nền không tự nhận chuột: chuyển tiếp các sự kiện chuột
 * (di chuột luôn; bấm khi không trúng nút / ô nhập) xuống canvas và các khung bọc của nó.
 */
function useForwardPointer(rootRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    const onEvent = (e: Event) => {
      const me = e as MouseEvent;
      const target = e.target as Element | null;
      if (!e.isTrusted || (target && root.contains(target))) return;
      if (!e.type.endsWith("move") && target?.closest(INTERACTIVE)) return;
      const chain: Element[] = [];
      for (let el: Element | null = root.querySelector("canvas") ?? root.firstElementChild; el && el !== root; el = el.parentElement) chain.push(el);
      const init: PointerEventInit = {
        clientX: me.clientX,
        clientY: me.clientY,
        screenX: me.screenX,
        screenY: me.screenY,
        button: me.button,
        buttons: me.buttons,
        bubbles: false,
        cancelable: true,
        pointerId: (e as PointerEvent).pointerId ?? 1,
        pointerType: (e as PointerEvent).pointerType ?? "mouse",
        isPrimary: true,
      };
      for (const el of chain) el.dispatchEvent(e.type.startsWith("pointer") ? new PointerEvent(e.type, init) : new MouseEvent(e.type, init));
    };
    FORWARD.forEach((t) => window.addEventListener(t, onEvent, { passive: true }));
    return () => FORWARD.forEach((t) => window.removeEventListener(t, onEvent));
  }, [rootRef, enabled]);
}

/**
 * `inGame` dùng nền tĩnh: shader chạy toàn màn hình sau một ván đang chơi sẽ giành GPU của game.
 * Máy không có WebGL phần cứng cũng dùng nền nhẹ.
 */
export function DailyBackground({ inGame = false }: { inGame?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => pickIndex());
  const [hardware] = useState(() => getGpuInfo().hardware);
  const authStatus = useAuthStore((s) => s.status);

  // Mỗi lần đăng nhập mới: đổi hình nền khác.
  const prevAuth = useRef(authStatus);
  useEffect(() => {
    if (authStatus === "authed" && prevAuth.current !== "authed") setIndex((i) => pickIndex(i));
    prevAuth.current = authStatus;
  }, [authStatus]);

  const Bg = useMemo(() => lazy(BACKGROUNDS[index][1]), [index]);
  const animated = !inGame && hardware;
  useForwardPointer(rootRef, animated);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#060606]">
      {animated ? (
        <div ref={rootRef} className="absolute inset-0" data-bg={BACKGROUNDS[index][0]}>
          <Suspense fallback={null}>
            <Bg />
          </Suspense>
        </div>
      ) : (
        <StillAurora still={inGame} />
      )}
      {/* Phủ tối + viền tối: hình nền nào (kể cả nền sáng) chữ vẫn dễ đọc */}
      <div className="pointer-events-none absolute inset-0 bg-[#060606]/55" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_35%,rgba(6,6,6,0.85)_95%)]" />
    </div>
  );
}
