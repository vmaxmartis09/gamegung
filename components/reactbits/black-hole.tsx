"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { createAdaptiveQuality, getReducedMotion, subscribeReducedMotion } from "@/lib/motion";

export interface BlackHoleProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  speed?: number;
  zoom?: number;
  particleCount?: number;
  orbSize?: number;
  glow?: number;
  contrast?: number;
  mirrorSplits?: number;
  warpEnabled?: boolean;
  distanceFade?: number;
  colorShiftR?: number;
  colorShiftG?: number;
  colorShiftB?: number;
  colorSpeed?: number;
  colors?: [string, string];
  backgroundColor?: string;
  opacity?: number;
  bloom?: number;
  ringIntensity?: number;
  cursorInteraction?: boolean;
  cursorIntensity?: number;
  intro?: boolean;
  paused?: boolean;
  dpr?: number;
}

export interface BlackHoleRef {
  gulp: (strength?: number) => void;
  replay: () => void;
}

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
const num = (v: number | undefined, def: number) => (Number.isFinite(v) ? (v as number) : def);

const tempColor = new THREE.Color();
function parseColor(str?: string): [number, number, number, number] | null {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (!s || s === "transparent" || s === "none" || s === "auto") return null;
  const match = /^rgba?\(([^)]+)\)$/.exec(s);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean).map((n) => Number.parseFloat(n));
    const a = parts.length > 3 && Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1;
    return [(parts[0] ?? 0) / 255, (parts[1] ?? 0) / 255, (parts[2] ?? 0) / 255, a];
  }
  try {
    tempColor.setStyle(s, THREE.SRGBColorSpace);
    return [tempColor.r, tempColor.g, tempColor.b, 1];
  } catch {
    return null;
  }
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const VERTEX_SHADER = `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FIELD_FRAGMENT_SHADER = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uZoom;
uniform float uCount;
uniform float uOrbSize;
uniform float uGlow;
uniform float uContrast;
uniform float uSplits;
uniform float uWarp;
uniform float uDistFade;
uniform vec3 uColorShift;
uniform float uColorRate;
uniform float uFade;
in vec2 vUv;
out vec4 fragColor;

const float TAU = 6.2831853;
const float PI = 3.14159265;

vec2 mirror(vec2 p, float seg) {
  float a = atan(p.y, p.x);
  a = ((a / PI) + 1.0) * 0.5;
  a = mod(a, 1.0 / seg) * seg;
  a = -abs(2.0 * a - 1.0) + 1.0;
  float r = length(p);
  a *= r;
  return vec2(a, r);
}

void main() {
  vec2 st = 2.0 * vUv - 1.0;
  st.x *= uRes.x / uRes.y;
  st *= uZoom;

  float dist = length(st);

  vec2 warpSt = uWarp > 0.5 ? st * mirror(st, uSplits) : st;
  float soft = max(length(fwidth(warpSt)) * 1.25, 0.0004);
  float swing = fwidth(PI / max(dist, 0.0001)) / uCount;

  vec3 acc = vec3(0.0);

  for (float i = 0.0; i < 30.0; i++) {
    if (i >= uCount) break;
    float t = uTime - i * PI / uCount * cos(uTime / max(i, 0.0001));
    float lens = sin(i / uCount * PI / dist + uTime);
    vec2 orb = vec2(cos(t), sin(t)) / (abs(lens) < 0.0001 ? 0.0001 : lens);
    vec3 hue = cos(uColorShift * TAU / PI + PI * (uTime / (i + 1.0) * uColorRate)) * uGlow + uGlow;
    vec2 gap = warpSt - orb * uOrbSize;
    float calm = 1.0 - smoothstep(0.9, 2.2, swing * i);
    acc += dist * uDistFade * inversesqrt(dot(gap, gap) + soft * soft) * hue * calm;
  }

  acc = pow(max(acc * uFade, 0.0), vec3(uContrast));
  fragColor = vec4(min(acc, vec3(1024.0)), 1.0);
}
`;

const DOWNSAMPLE_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uFirst;
in vec2 vUv;
out vec4 fragColor;
vec3 tap(vec2 d) {
  vec3 c = texture(uSource, vUv + d * uTexel).rgb;
  if (uFirst > 0.5) c = clamp(c - 1.0, 0.0, 8.0);
  return c;
}
void main() {
  vec3 a = tap(vec2(-2.0, 2.0));
  vec3 b = tap(vec2(0.0, 2.0));
  vec3 c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0));
  vec3 e = tap(vec2(0.0, 0.0));
  vec3 f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0));
  vec3 h = tap(vec2(0.0, -2.0));
  vec3 i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0));
  vec3 k = tap(vec2(1.0, 1.0));
  vec3 l = tap(vec2(-1.0, -1.0));
  vec3 m = tap(vec2(1.0, -1.0));
  vec3 color = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  fragColor = vec4(color, 1.0);
}
`;

const UPSAMPLE_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;
vec3 tap(vec2 d) { return texture(uSource, vUv + d * uTexel).rgb; }
void main() {
  vec3 color = tap(vec2(0.0)) * 4.0
    + (tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0)) + tap(vec2(0.0, 1.0))) * 2.0
    + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
  fragColor = vec4(color / 16.0, 1.0);
}
`;

const COMPOSITE_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uField;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform float uBloomStrength;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uLine;
uniform float uRing;
uniform float uTint;
uniform vec3 uLabA;
uniform vec3 uLabB;
uniform vec3 uCool;
uniform float uInk;
uniform vec3 uInkLab;
uniform vec3 uBg;
uniform float uSolid;
uniform float uAlpha;
uniform float uFrame;
in vec2 vUv;
out vec4 fragColor;

vec3 decode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 toLab(vec3 c) {
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c;
  lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.793617785, -2.428592205, 0.7827717662, -0.0040720468, 0.4505937099, -0.808675766) * lms;
}

vec3 fromLab(vec3 lab) {
  vec3 lms = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.291485548) * lab;
  lms = lms * lms * lms;
  return max(mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.707614701) * lms, 0.0);
}

vec3 knee(vec3 x) {
  vec3 u = max(x - 0.68, 0.0) / 0.32;
  return mix(x, 0.68 + 0.32 * (1.0 - pow(1.0 + u * 0.25, vec3(-4.0))), step(0.68, x));
}

float pearl(float e) {
  float sheen = clamp((log(max(e, 0.000001)) - 0.18232) / 4.19970, 0.0, 1.0);
  return 1.0 - 0.11 * (1.0 - pow(sheen, 0.7)) * smoothstep(0.8, 1.6, e);
}

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec3 field = texture(uField, vUv).rgb;
  vec3 glow = texture(uBloom, vUv).rgb;
  vec2 offset = gl_FragCoord.xy - uCenter;
  float r = length(offset);
  float edge = r - uRadius;
  vec2 probe = (uCenter + offset / max(r, 0.0001) * uRadius * 1.22) / uRes;
  float near = dot(texture(uBloom, probe).rgb, vec3(0.3333)) * 0.25;
  float line = exp(-edge * edge / (uLine * uLine)) + 0.25 * exp(-abs(edge) / (uLine * 6.0));
  float halo = 1.0 - exp(-line * uRing * (0.14 + 0.9 * clamp(near, 0.0, 1.5)));
  vec3 base = knee(field) * pearl(dot(field, vec3(0.3333)));
  vec3 lift = 1.0 - exp(-glow * uBloomStrength);
  vec3 tone = 1.0 - (1.0 - base) * (1.0 - lift);
  float y = dot(tone, vec3(0.3333));
  float dither = (ign(gl_FragCoord.xy + uFrame * 5.588238) - 0.5) / 255.0;

  if (uInk > 0.5) {
    vec3 lab = toLab(decode(tone / max(max(tone.r, max(tone.g, tone.b)), 0.0001)));
    float chroma = length(lab.yz);
    vec2 hue = uTint < 0.5 && chroma > 0.03 ? lab.yz / chroma * clamp(chroma * 1.2, 0.07, 0.16) : uInkLab.yz;
    float cover = max(clamp(pow(y, 1.1) * 1.03 * clamp(y * 6.0, 0.0, 1.0), 0.0, 1.0), halo);
    vec3 ink = encode(fromLab(vec3(uInkLab.x + 0.4 * pow(1.0 - clamp(max(y, halo), 0.0, 1.0), 0.6), hue)));
    if (uSolid > 0.5) {
      fragColor = vec4(mix(uBg, ink, cover) + dither, uAlpha);
    } else {
      fragColor = vec4(ink, clamp(cover * uAlpha + dither, 0.0, 1.0));
    }
    return;
  }

  float shade = clamp(y / 0.12, 0.0, 1.0) * (1.0 - clamp((y - 0.3) / 0.45, 0.0, 1.0));
  vec3 color;
  if (uTint > 0.5) {
    color = encode(fromLab(mix(uLabB, uLabA, smoothstep(0.45, 0.99, y)))) * y;
  } else {
    color = tone * mix(vec3(1.0), uCool, shade);
  }

  float cover = max(clamp(y * 6.0, 0.0, 1.0), halo);
  color = 1.0 - (1.0 - color) * (1.0 - halo);
  if (uSolid > 0.5) {
    fragColor = vec4(mix(uBg, color, cover) + dither, uAlpha);
  } else {
    fragColor = vec4(color, clamp(cover * uAlpha + dither, 0.0, 1.0));
  }
}
`;

export const BlackHole = forwardRef<BlackHoleRef, BlackHoleProps>(function BlackHole(
  {
    width = "100%",
    height = "100%",
    className,
    style,
    children,
    speed = 1,
    zoom = 1.8,
    particleCount = 13,
    orbSize = 0.75,
    glow = 0.08,
    contrast = 3,
    mirrorSplits = 2,
    warpEnabled = true,
    distanceFade = 0.35,
    colorShiftR = -6,
    colorShiftG = -6,
    colorShiftB = -6,
    colorSpeed = 0.2,
    colors,
    backgroundColor = "#000000",
    opacity = 1,
    bloom = 1,
    ringIntensity = 1,
    cursorInteraction = true,
    cursorIntensity = 1,
    intro = true,
    paused = false,
    dpr = 2,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<{
    sync: () => void;
    gulp: (strength?: number) => void;
    replay: () => void;
    destroy: () => void;
  } | null>(null);

  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

  const currentProps = {
    speed,
    zoom,
    particleCount,
    orbSize,
    glow,
    contrast,
    mirrorSplits,
    warpEnabled,
    distanceFade,
    colorShiftR,
    colorShiftG,
    colorShiftB,
    colorSpeed,
    colors: colors ?? null,
    backgroundColor,
    opacity,
    bloom,
    ringIntensity,
    cursorInteraction,
    cursorIntensity,
    intro,
    paused,
    dpr,
    reduced: reducedMotion,
  };

  const propsRef = useRef(currentProps);

  useEffect(() => {
    propsRef.current = currentProps;
    controllerRef.current?.sync();
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvasContainer = canvasContainerRef.current;
    if (!container || !canvasContainer) return;

    const doc = container.ownerDocument;
    const win = doc.defaultView ?? window;

    const canvas = doc.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    canvasContainer.appendChild(canvas);
    renderer.autoClear = false;
    renderer.setClearColor(0, 0);

    const hasFloat =
      renderer.extensions.has("EXT_color_buffer_float") ||
      renderer.extensions.has("EXT_color_buffer_half_float");
    const targetType = hasFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );

    const scene = new THREE.Scene();
    const quad = new THREE.Mesh(geometry);
    quad.frustumCulled = false;
    scene.add(quad);

    const createMaterial = (
      fragmentShader: string,
      uniforms: Record<string, THREE.IUniform>,
      transparent = false
    ) =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX_SHADER,
        fragmentShader,
        uniforms,
        blending: transparent ? THREE.AdditiveBlending : THREE.NormalBlending,
        transparent,
        depthTest: false,
        depthWrite: false,
      });

    const fieldUniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uZoom: { value: 1.8 },
      uCount: { value: 13 },
      uOrbSize: { value: 0.75 },
      uGlow: { value: 0.08 },
      uContrast: { value: 3 },
      uSplits: { value: 2 },
      uWarp: { value: 1 },
      uDistFade: { value: 0.35 },
      uColorShift: { value: new THREE.Vector3(-6, -6, -6) },
      uColorRate: { value: 0.2 },
      uFade: { value: 1 },
    };

    const fieldMaterial = createMaterial(FIELD_FRAGMENT_SHADER, fieldUniforms);

    const createRenderTarget = () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: targetType,
        format: THREE.RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
      });

    const fieldTarget = createRenderTarget();
    const bloomTargets = Array.from({ length: 6 }, createRenderTarget);

    const downsampleMaterial = createMaterial(DOWNSAMPLE_FRAGMENT_SHADER, {
      uSource: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uFirst: { value: 0 },
    });

    const upsampleMaterial = createMaterial(
      UPSAMPLE_FRAGMENT_SHADER,
      {
        uSource: { value: null },
        uTexel: { value: new THREE.Vector2() },
      },
      true
    );

    const compositeUniforms = {
      uField: { value: fieldTarget.texture },
      uBloom: { value: bloomTargets[1].texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uBloomStrength: { value: 0.1 },
      uCenter: { value: new THREE.Vector2() },
      uRadius: { value: 100 },
      uLine: { value: 1 },
      uRing: { value: 1 },
      uTint: { value: 0 },
      uLabA: { value: new THREE.Vector3(1, 0, 0) },
      uLabB: { value: new THREE.Vector3(0.5, 0, 0) },
      uCool: { value: new THREE.Vector3(0.86, 0.89, 1) },
      uInk: { value: 0 },
      uInkLab: { value: new THREE.Vector3(0.24, 0.035, -0.13) },
      uBg: { value: new THREE.Vector3(0, 0, 0) },
      uSolid: { value: 1 },
      uAlpha: { value: 1 },
      uFrame: { value: 0 },
    };

    const compositeMaterial = createMaterial(COMPOSITE_FRAGMENT_SHADER, compositeUniforms);

    let clientWidth = 0;
    let clientHeight = 0;
    let pixelRatio = 1;
    let hasSize = false;
    let lastColorKey = "";
    let lastColorCheck = -10;
    let animTime = 0;
    let frameCount = 0;
    let hoverState = 0;
    let isHovered = false;
    let springPos = 0;
    let springVel = 0;
    let introStartTime = -1;
    let introFade = 1;
    let rafId = 0;
    let lastFrameTime = 0;
    const quality = createAdaptiveQuality();
    let isVisible = false;
    let isDestroyed = false;
    let isContextLost = false;
    let activePointer: { id: number; x: number; y: number; time: number } | null = null;

    const updateColors = () => {
      const p = propsRef.current;
      const parsedBg = parseColor(p.backgroundColor);
      const isSolidBg = Boolean(parsedBg && parsedBg[3] > 0.05);
      const bgRgb: [number, number, number] =
        isSolidBg && parsedBg
          ? [parsedBg[0], parsedBg[1], parsedBg[2]]
          : (() => {
              let el: HTMLElement | null = container.parentElement;
              while (el) {
                const match = win.getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
                if (match) {
                  const parts = match[1]
                    .split(/[\s,/]+/)
                    .filter(Boolean)
                    .map((n) => Number.parseFloat(n));
                  if (parts.length < 4 || parts[3] > 0.05) {
                    return [parts[0] / 255, parts[1] / 255, parts[2] / 255] as [number, number, number];
                  }
                }
                el = el.parentElement;
              }
              return win.matchMedia("(prefers-color-scheme: dark)").matches
                ? ([0, 0, 0] as [number, number, number])
                : ([1, 1, 1] as [number, number, number]);
            })();

      const colorKey = [bgRgb.join(","), isSolidBg, p.colors?.join(",") ?? ""].join("|");
      if (colorKey === lastColorKey) return;
      lastColorKey = colorKey;

      compositeUniforms.uSolid.value = isSolidBg ? 1 : 0;
      compositeUniforms.uBg.value.set(bgRgb[0], bgRgb[1], bgRgb[2]);
      compositeUniforms.uInk.value =
        0.2126 * bgRgb[0] + 0.7152 * bgRgb[1] + 0.0722 * bgRgb[2] > 0.55 ? 1 : 0;

      const colorA = p.colors ? parseColor(p.colors[0]) : null;
      const colorB = p.colors ? parseColor(p.colors[1]) : null;
      compositeUniforms.uInkLab.value.set(0.24, 0.035, -0.13);

      if (colorA && colorB) {
        const labA = rgbToOklab(colorA[0], colorA[1], colorA[2]);
        const labB = rgbToOklab(colorB[0], colorB[1], colorB[2]);
        compositeUniforms.uLabA.value.set(labA[0], labA[1], labA[2]);
        compositeUniforms.uLabB.value.set(labB[0], labB[1], labB[2]);
        compositeUniforms.uTint.value = 1;

        const maxLab =
          Math.hypot(labA[1], labA[2]) > Math.hypot(labB[1], labB[2]) ? labA : labB;
        const chroma = Math.hypot(maxLab[1], maxLab[2]);
        if (chroma > 0.02) {
          const scaled = clamp(1.1 * chroma, 0.07, 0.16) / chroma;
          compositeUniforms.uInkLab.value.set(0.28, maxLab[1] * scaled, maxLab[2] * scaled);
        }
      } else {
        compositeUniforms.uTint.value = 0;
      }
    };

    const updateSize = () => {
      const p = propsRef.current;
      const w = Math.round(container.clientWidth);
      const h = Math.round(container.clientHeight);
      if (w < 2 || h < 2) {
        hasSize = false;
        return false;
      }

      const dprVal = Math.min(win.devicePixelRatio || 1, clamp(num(p.dpr, 2), 0.5, 3)) * quality.scale;
      if (hasSize && w === clientWidth && h === clientHeight && dprVal === pixelRatio) {
        return false;
      }

      hasSize = true;
      clientWidth = w;
      clientHeight = h;
      pixelRatio = dprVal;

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(clientWidth, clientHeight, false);

      const targetW = Math.max(1, Math.round(clientWidth * pixelRatio));
      const targetH = Math.max(1, Math.round(clientHeight * pixelRatio));

      fieldTarget.setSize(targetW, targetH);
      fieldUniforms.uRes.value.set(targetW, targetH);
      compositeUniforms.uRes.value.set(targetW, targetH);

      let curW = targetW;
      let curH = targetH;
      for (const target of bloomTargets) {
        curW = Math.max(1, Math.round(curW / 2));
        curH = Math.max(1, Math.round(curH / 2));
        target.setSize(curW, curH);
      }
      return true;
    };

    const render = () => {
      if (!hasSize) return;
      const p = propsRef.current;

      if (performance.now() - lastColorCheck > 1000) {
        lastColorCheck = performance.now();
        updateColors();
      }

      const introProgress = 1 - Math.pow(1 - introFade, 3);
      const introInv = (1 - introProgress) * (1 - introProgress);

      const currentZoom = clamp(num(p.zoom, 1.8), 0.2, 10);
      const currentOrbSize =
        clamp(num(p.orbSize, 0.75), 0.01, 5) *
        (1 + 0.8 * introInv) *
        (1 - 0.5 * clamp(springPos, -0.6, 1.4));

      fieldUniforms.uTime.value = 0.5 * animTime - 2.2 * introInv;
      fieldUniforms.uZoom.value = currentZoom;
      fieldUniforms.uCount.value = clamp(Math.round(num(p.particleCount, 13)), 1, 30);
      fieldUniforms.uOrbSize.value = currentOrbSize;
      fieldUniforms.uGlow.value = Math.max(num(p.glow, 0.08), 0);
      fieldUniforms.uContrast.value = clamp(num(p.contrast, 3), 0.1, 12);
      fieldUniforms.uSplits.value = clamp(num(p.mirrorSplits, 2), 1, 16);
      fieldUniforms.uWarp.value = p.warpEnabled ? 1 : 0;
      fieldUniforms.uDistFade.value = Math.max(num(p.distanceFade, 0.35), 0);
      fieldUniforms.uColorShift.value.set(
        num(p.colorShiftR, -6),
        num(p.colorShiftG, -6),
        num(p.colorShiftB, -6)
      );
      fieldUniforms.uColorRate.value = num(p.colorSpeed, 0.2);
      fieldUniforms.uFade.value = introProgress;

      const targetH = fieldTarget.height;
      const radiusVal = p.warpEnabled
        ? 0.96 * Math.pow(currentOrbSize, 0.64)
        : 0.9 * currentOrbSize;

      compositeUniforms.uCenter.value.set(fieldTarget.width / 2, targetH / 2);
      compositeUniforms.uRadius.value = (radiusVal * targetH) / (2 * currentZoom);
      compositeUniforms.uLine.value = 1.25 * pixelRatio;
      compositeUniforms.uRing.value = clamp(num(p.ringIntensity, 1), 0, 4) * introProgress;
      compositeUniforms.uAlpha.value = clamp(num(p.opacity, 1), 0, 1);
      compositeUniforms.uFrame.value = frameCount % 64;

      const bloomMultiplier = clamp(num(p.bloom, 1), 0, 4) * (compositeUniforms.uInk.value > 0.5 ? 0.6 : 1);
      compositeUniforms.uBloomStrength.value = 0.06 * bloomMultiplier;

      const bloomStart = pixelRatio >= 1.5 ? 2 : 1;
      const bloomCount = bloomStart + 4;
      compositeUniforms.uBloom.value = bloomTargets[bloomStart].texture;

      // 1. Render field pass
      quad.material = fieldMaterial;
      renderer.setRenderTarget(fieldTarget);
      renderer.render(scene, camera);

      // 2. Downsample bloom passes
      let currentSource = fieldTarget;
      quad.material = downsampleMaterial;
      for (let i = 0; i < bloomCount; i++) {
        const dest = bloomTargets[i];
        downsampleMaterial.uniforms.uFirst.value = currentSource === fieldTarget ? 1 : 0;
        downsampleMaterial.uniforms.uSource.value = currentSource.texture;
        downsampleMaterial.uniforms.uTexel.value.set(1 / currentSource.width, 1 / currentSource.height);
        renderer.setRenderTarget(dest);
        renderer.render(scene, camera);
        currentSource = dest;
      }

      // 3. Upsample bloom passes
      quad.material = upsampleMaterial;
      for (let i = bloomCount - 1; i > bloomStart; i--) {
        upsampleMaterial.uniforms.uSource.value = bloomTargets[i].texture;
        upsampleMaterial.uniforms.uTexel.value.set(1 / bloomTargets[i].width, 1 / bloomTargets[i].height);
        renderer.setRenderTarget(bloomTargets[i - 1]);
        renderer.render(scene, camera);
      }

      // 4. Final composite pass to screen
      quad.material = compositeMaterial;
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);

      frameCount++;
    };

    const requestFrame = () => {
      if (isDestroyed || isContextLost || !isVisible || rafId) return;
      rafId = requestAnimationFrame(onFrame);
    };

    const onFrame = (timestamp: number) => {
      rafId = 0;
      if (isDestroyed || isContextLost) return;

      const p = propsRef.current;
      const dt =
        lastFrameTime && timestamp - lastFrameTime < 100
          ? Math.min(Math.max((timestamp - lastFrameTime) / 1000, 0), 0.05)
          : 1 / 60;
      if (lastFrameTime && quality.tick(timestamp - lastFrameTime) && updateSize()) render();
      lastFrameTime = timestamp;

      const targetHover = p.cursorInteraction && !p.reduced && isHovered ? 1 : 0;
      hoverState += (targetHover - hoverState) * (1 - Math.exp(-dt / 0.6));
      if (Math.abs(targetHover - hoverState) < 0.0005) hoverState = targetHover;

      const isRunning = !p.reduced && !p.paused;
      if (isRunning) {
        const speedBoost = 1 + 0.5 * clamp(num(p.cursorIntensity, 1), 0, 3) * hoverState;
        animTime += dt * clamp(num(p.speed, 1), 0, 10) * speedBoost;
      }

      if (p.intro && !p.reduced) {
        if (introStartTime < 0) introStartTime = timestamp;
        introFade = clamp((timestamp - introStartTime) / 1000 / 2.6, 0, 1);
      } else {
        introFade = 1;
      }

      // Spring physics for "gulp"
      let springDt = dt;
      while (springDt > 0) {
        const step = Math.min(springDt, 1 / 120);
        springVel += (-56 * springPos - 6.3 * springVel) * step;
        springPos += springVel * step;
        springDt -= step;
      }
      if (Math.abs(springPos) + Math.abs(springVel) < 0.0004) {
        springPos = 0;
        springVel = 0;
      }

      render();

      const hasOngoingMotion = hoverState !== targetHover || springPos !== 0 || introFade < 1;
      if ((isRunning || hasOngoingMotion) && !doc.hidden) {
        rafId = requestAnimationFrame(onFrame);
      } else {
        lastFrameTime = 0;
      }
    };

    const triggerGulp = (strength: number) => {
      springVel = Math.min(springVel + 6.5 * strength, 14);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("a,button,input,textarea,select,label,summary,[role=button],[contenteditable=true]")) {
        return;
      }
      if (e.pointerType === "mouse" && e.button !== 0) return;
      activePointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      };
    };

    const onPointerUp = (e: PointerEvent) => {
      const p = activePointer;
      activePointer = null;
      if (
        !p ||
        p.id !== e.pointerId ||
        Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 ||
        performance.now() - p.time > 600
      ) {
        return;
      }
      const props = propsRef.current;
      if (!props.cursorInteraction || props.reduced || props.paused) return;
      triggerGulp(clamp(num(props.cursorIntensity, 1), 0, 3));
      requestFrame();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || isHovered) return;
      isHovered = true;
      requestFrame();
    };

    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      isHovered = false;
      requestFrame();
    };

    const onPointerCancel = () => {
      activePointer = null;
    };

    const onVisibilityChange = () => {
      lastFrameTime = 0;
      requestFrame();
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const onContextRestored = () => {
      isContextLost = false;
      lastColorKey = "";
      requestFrame();
    };

    const resizeObserver = new ResizeObserver(() => {
      if (updateSize()) {
        render();
        requestFrame();
      }
    });

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        lastFrameTime = 0;
        requestFrame();
      },
      { rootMargin: "120px" }
    );

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);
    container.addEventListener("pointercancel", onPointerCancel);
    doc.addEventListener("visibilitychange", onVisibilityChange);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    resizeObserver.observe(container);
    intersectionObserver.observe(container);

    if (propsRef.current.intro && !propsRef.current.reduced) {
      introFade = 0;
    }
    animTime = propsRef.current.reduced ? 3 : 0;

    updateSize();
    updateColors();

    const controller = {
      sync: () => {
        lastColorCheck = -10;
        updateSize();
        lastFrameTime = 0;
        if (!rafId && isVisible) {
          render();
          requestFrame();
        }
      },
      gulp: (strength?: number) => {
        if (propsRef.current.reduced) return;
        triggerGulp(clamp(num(strength ?? propsRef.current.cursorIntensity, 1), 0, 3));
        requestFrame();
      },
      replay: () => {
        if (propsRef.current.reduced) return;
        introStartTime = -1;
        introFade = 0;
        lastFrameTime = 0;
        requestFrame();
      },
      destroy: () => {
        isDestroyed = true;
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();

        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerleave", onPointerLeave);
        container.removeEventListener("pointercancel", onPointerCancel);
        doc.removeEventListener("visibilitychange", onVisibilityChange);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.removeEventListener("webglcontextrestored", onContextRestored);

        geometry.dispose();
        fieldMaterial.dispose();
        downsampleMaterial.dispose();
        upsampleMaterial.dispose();
        compositeMaterial.dispose();
        fieldTarget.dispose();
        for (const target of bloomTargets) target.dispose();
        renderer.dispose();
        canvas.remove();
      },
    };

    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      gulp: (strength?: number) => controllerRef.current?.gulp(strength),
      replay: () => controllerRef.current?.replay(),
    }),
    []
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ width, height, ...style }}
    >
      <div ref={canvasContainerRef} aria-hidden="true" className="absolute inset-0" />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
});

BlackHole.displayName = "BlackHole";
export default BlackHole;
