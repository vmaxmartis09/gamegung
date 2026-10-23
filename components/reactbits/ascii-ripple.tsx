"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

export interface AsciiRippleRef {
  triggerRipple: (normX?: number, normY?: number, strength?: number) => void;
}

interface AsciiRippleProps {
  className?: string;
  cellSize?: number; // size in pixels for each ASCII cell (e.g., 14-18)
  charset?: string; // string of characters ordered from least to most dense
  color?: string; // default font color e.g. "rgba(58, 208, 255, 0.25)"
  activeColor?: string; // peak ripple color e.g. "#58ffa6"
  interactive?: boolean; // pointermove / click ripples
  ambient?: boolean; // gentle random background ripples
  ambientInterval?: number; // ms between ambient ripples
  speed?: number; // wave propagation speed in px/sec
  maxRipples?: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  strength: number;
  wavelength: number;
  decay: number;
}

const DEFAULT_CHARSET = " ·-~+=*#%@";

export const AsciiRipple = forwardRef<AsciiRippleRef, AsciiRippleProps>(
  function AsciiRipple(
    {
      className = "",
      cellSize = 16,
      charset = DEFAULT_CHARSET,
      color = "rgba(58, 208, 255, 0.22)",
      activeColor = "#58ffa6",
      interactive = true,
      ambient = true,
      ambientInterval = 3500,
      speed = 220,
      maxRipples = 12,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ripplesRef = useRef<Ripple[]>([]);
    const lastAmbientRef = useRef<number>(0);

    const addRipple = useCallback(
      (px: number, py: number, strength = 1.0) => {
        const ripples = ripplesRef.current;
        if (ripples.length >= maxRipples) {
          ripples.shift();
        }
        ripples.push({
          x: px,
          y: py,
          radius: 0,
          maxRadius: 400 + Math.random() * 200,
          speed: speed * (0.85 + Math.random() * 0.3),
          strength,
          wavelength: 45,
          decay: 0.985,
        });
      },
      [speed, maxRipples]
    );

    useImperativeHandle(
      ref,
      () => ({
        triggerRipple: (normX?: number, normY?: number, strength = 1.2) => {
          const cv = canvasRef.current;
          if (!cv) return;
          const rect = cv.getBoundingClientRect();
          const px = (normX !== undefined ? normX : Math.random()) * rect.width;
          const py = (normY !== undefined ? normY : Math.random()) * rect.height;
          addRipple(px, py, strength);
        },
      }),
      [addRipple]
    );

    useEffect(() => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d", { alpha: true });
      if (!ctx) return;

      let raf = 0;
      let lastTime = performance.now();
      let width = (cv.width = cv.clientWidth);
      let height = (cv.height = cv.clientHeight);

      const handleResize = () => {
        if (!cv) return;
        width = cv.width = cv.clientWidth;
        height = cv.height = cv.clientHeight;
      };

      const ro = new ResizeObserver(handleResize);
      ro.observe(cv);

      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        // Ambient ripples
        if (ambient && now - lastAmbientRef.current > ambientInterval) {
          lastAmbientRef.current = now;
          addRipple(
            width * (0.2 + Math.random() * 0.6),
            height * (0.2 + Math.random() * 0.6),
            0.55
          );
        }

        // Update ripples
        const ripples = ripplesRef.current;
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i];
          r.radius += r.speed * dt;
          r.strength *= r.decay;
          if (r.radius > r.maxRadius || r.strength < 0.02) {
            ripples.splice(i, 1);
          }
        }

        ctx.clearRect(0, 0, width, height);
        ctx.font = `600 ${cellSize - 2}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);
        const numChars = charset.length;

        for (let r = 0; r < rows; r++) {
          const cy = r * cellSize + cellSize / 2;
          for (let c = 0; c < cols; c++) {
            const cx = c * cellSize + cellSize / 2;

            let intensity = 0;
            for (let k = 0; k < ripples.length; k++) {
              const rip = ripples[k];
              const dx = cx - rip.x;
              const dy = cy - rip.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const diff = Math.abs(dist - rip.radius);

              if (diff < rip.wavelength) {
                const wave = Math.cos((diff / rip.wavelength) * Math.PI * 0.5);
                intensity += wave * rip.strength;
              }
            }

            const clamped = Math.min(1, Math.max(0, intensity));
            if (clamped > 0.05) {
              const charIdx = Math.min(
                numChars - 1,
                Math.floor(clamped * numChars)
              );
              const char = charset[charIdx];

              ctx.fillStyle = clamped > 0.5 ? activeColor : color;
              ctx.fillText(char, cx, cy);
            } else if (Math.random() < 0.015) {
              // occasional faint background matrix dust
              ctx.fillStyle = color;
              ctx.fillText(charset[0] || "·", cx, cy);
            }
          }
        }

        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }, [cellSize, charset, color, activeColor, ambient, ambientInterval, addRipple]);

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!interactive) return;
      const cv = canvasRef.current;
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      // throttle pointer move ripple
      if (Math.random() < 0.3) {
        addRipple(px, py, 0.4);
      }
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!interactive) return;
      const cv = canvasRef.current;
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      addRipple(e.clientX - rect.left, e.clientY - rect.top, 1.2);
    };

    return (
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        className={cn(
          "pointer-events-none select-none absolute inset-0 h-full w-full",
          interactive && "pointer-events-auto",
          className
        )}
      />
    );
  }
);

export default AsciiRipple;
