"use client";

import { createElement, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/**
 * One motion policy for the whole app.
 *
 * Windows ships with "Show animations in Windows" off in several common setups (power saver,
 * Remote Desktop, VMs, "Performance options"), and Chrome/Edge then report
 * `prefers-reduced-motion: reduce`. Every animation that obeyed the OS flag silently froze there
 * while the same build ran fine on macOS. The app-level preference below is the source of truth:
 * motion is on by default on every platform, and a user can still opt into "system" or "reduced".
 */
export type MotionPref = "full" | "system" | "reduced";

const STORAGE_KEY = "gg-motion";
const QUERY = "(prefers-reduced-motion: reduce)";
const listeners = new Set<() => void>();

let pref: MotionPref = "full";
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "full" || saved === "system" || saved === "reduced") pref = saved;
  } catch {
    /* storage blocked: keep the default */
  }
}

function resolve(): boolean {
  load();
  if (pref === "reduced") return true;
  if (pref === "system") return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
  return false;
}

/** Mirrors the resolved preference onto <html> so plain CSS can react to it. */
function applyAttribute() {
  if (typeof document === "undefined") return;
  document.documentElement.toggleAttribute("data-reduced-motion", resolve());
}

export function getMotionPref(): MotionPref {
  load();
  return pref;
}

export function setMotionPref(next: MotionPref) {
  load();
  pref = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  applyAttribute();
  listeners.forEach((fn) => fn());
}

/** Call once on the client so the CSS attribute matches the stored preference. */
export function initMotion() {
  applyAttribute();
}

export function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia(QUERY);
  const onSystemChange = () => {
    applyAttribute();
    callback();
  };
  media.addEventListener("change", onSystemChange);
  listeners.add(callback);
  return () => {
    media.removeEventListener("change", onSystemChange);
    listeners.delete(callback);
  };
}

export const getReducedMotion = () => resolve();

/** Drop-in for framer-motion's `useReducedMotion`, driven by the app preference. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}

/** Drop-in for `<MotionConfig reducedMotion="user">`. */
export function AppMotionConfig({ children }: { children?: ReactNode }) {
  const reduced = useReducedMotion();
  return createElement(MotionConfig, { reducedMotion: reduced ? "always" : "never" }, children);
}

/* ------------------------------ GPU capability ----------------------------- */

export interface GpuInfo {
  /** A hardware-accelerated WebGL2 context can be created. */
  hardware: boolean;
  renderer: string;
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|warp/i;
let gpuInfo: GpuInfo | null = null;

/**
 * Probes WebGL2 once. `failIfMajorPerformanceCaveat` makes the browser refuse software
 * rasterisers (SwiftShader / Microsoft Basic Render Driver), which is what a Windows machine with
 * hardware acceleration off or a blocklisted GPU driver falls back to, at a few fps.
 */
export function getGpuInfo(): GpuInfo {
  if (gpuInfo) return gpuInfo;
  if (typeof document === "undefined") return { hardware: false, renderer: "" };

  let hardware = false;
  let renderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) as WebGL2RenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      hardware = !SOFTWARE_RENDERER.test(renderer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    hardware = false;
  }
  gpuInfo = { hardware, renderer };
  return gpuInfo;
}

/* ----------------------------- Adaptive quality ---------------------------- */

export interface AdaptiveQuality {
  readonly scale: number;
  /** Feed the real frame interval (ms). Returns true when the render scale just dropped. */
  tick: (frameMs: number) => boolean;
}

/**
 * Lowers the render resolution when frames keep missing the budget, so a slow GPU degrades
 * resolution instead of motion. Only ever steps down, which keeps it from oscillating.
 */
export function createAdaptiveQuality(minScale = 0.5, budgetMs = 24): AdaptiveQuality {
  let scale = 1;
  let avg = 16.7;
  let slowFrames = 0;
  let warmup = 30;

  return {
    get scale() {
      return scale;
    },
    tick(frameMs) {
      // Ignore tab-switch gaps and the first frames (shader compile, target allocation).
      if (frameMs <= 0 || frameMs > 250) return false;
      if (warmup > 0) {
        warmup--;
        return false;
      }
      avg += (frameMs - avg) * 0.1;
      slowFrames = avg > budgetMs ? slowFrames + 1 : 0;
      if (slowFrames < 40 || scale <= minScale) return false;

      scale = Math.max(minScale, +(scale * 0.8).toFixed(3));
      slowFrames = 0;
      warmup = 30;
      avg = 16.7;
      return true;
    },
  };
}
