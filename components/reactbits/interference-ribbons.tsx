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

export interface InterferenceRibbonsProps {
  /** Two hex/rgb colors the strands cycle through, blended in OKLab. */
  colors?: [string, string];
  /** Color behind the ribbon. Defaults to #060606. */
  backgroundColor?: string;
  /** "glow" adds additive light for dark backgrounds; "ink" draws colored strands for light ones; "auto" detects luminance. */
  mode?: "auto" | "glow" | "ink";
  /** Number of strands across the ribbon, from 4 to 160. Default 64. */
  wires?: number;
  /** Width of the strands facing the viewer, in pixels. Default 1.6. */
  lineWidth?: number;
  /** Width of the ribbon as a fraction of height. Default 0.24. */
  ribbonWidth?: number;
  /** How far ribbon swings from the center line. Default 0.6. */
  amplitude?: number;
  /** Length of the ribbon's swings. Default 1. */
  waveLength?: number;
  /** Direction the ribbon runs across the frame in degrees. Default 42. */
  angle?: number;
  /** How many times the ribbon turns over along its length. Default 1.6. */
  twist?: number;
  /** Curves the ribbon cross-section so strands bunch and fan. Default 0.25. */
  curl?: number;
  /** How much strands on the far side fade and thin (0 flat to 1 max). Default 0.65. */
  depth?: number;
  /** How many times colors cycle across ribbon strands. Default 2.2. */
  stripes?: number;
  /** Speed at which color stripes drift along ribbon. Default 0.04. */
  colorFlow?: number;
  /** Bloom intensity. Default 0.45. */
  glow?: number;
  /** Overall light exposure / brightness. Default 1. */
  intensity?: number;
  /** Speed of ribbon spine undulation. Default 0.7. */
  speed?: number;
  /** Speed of ribbon rotation / twist drift. Default 0.35. */
  spin?: number;
  /** Enable mouse move and click interactivity. Default true. */
  interactive?: boolean;
  /** Hovering over the ribbon emits travelling light pulses. Default true. */
  hoverPulses?: boolean;
  /** Clicking emits a shockwave pulse along the ribbon. Default true. */
  clickPulse?: boolean;
  /** Speed of shockwave / hover pulse propagation. Default 1.1. */
  pulseSpeed?: number;
  /** Brightness multiplier for pulses. Default 1. */
  pulseStrength?: number;
  /** Motion and pulse acceleration on hover. Default 1. */
  hoverBoost?: number;
  /** Pause all ribbon animations. Default false. */
  paused?: boolean;
  /** Render resolution scale (0.25 to 1). Default 1. */
  quality?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface InterferenceRibbonsHandle {
  /** Trigger a pulse at a normalized position (0 to 1) along the ribbon width. */
  pulse: (position?: number) => void;
}

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

let scratchCanvasCtx: CanvasRenderingContext2D | null = null;

function parseCssColor(color: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof document === "undefined") return fallback;
  if (!scratchCanvasCtx) {
    scratchCanvasCtx = document.createElement("canvas").getContext("2d");
  }
  if (!scratchCanvasCtx) return fallback;

  scratchCanvasCtx.fillStyle = "#010203";
  scratchCanvasCtx.fillStyle = color;
  const computed = String(scratchCanvasCtx.fillStyle);
  if (computed === "#010203" && color.trim().toLowerCase() !== "#010203") {
    return fallback;
  }
  if (computed.startsWith("#")) {
    const hex = computed.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  const parts = computed.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255];
}

const sRGBToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function linearToOKLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lr = sRGBToLinear(r);
  const lg = sRGBToLinear(g);
  const lb = sRGBToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/* --------------------------------- Shaders --------------------------------- */

const RIBBON_VERTEX_SHADER = /* glsl */ `
in vec2 aWire;
in vec2 aSample;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uTime;
uniform float uPulseTime;
uniform float uAngle;
uniform float uExtent;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uHalf;
uniform float uCurl;
uniform float uTwist;
uniform float uSpin;
uniform float uLineWidth;
uniform float uBack;
uniform float uStripes;
uniform float uFlow;
uniform float uEnergy;
uniform float uPulseSpeed;
uniform float uPulseStrength;
uniform float uInk;
uniform vec3 uLabDeep;
uniform vec3 uLabA;
uniform vec3 uLabB;
uniform vec4 uPulses[16];
out float vDist;
out float vHalfPx;
out vec3 vColor;
out float vGain;

vec3 labToLinear(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return max(vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ), 0.0);
}

vec3 palette(float s) {
  s = fract(s) * 3.0;
  vec3 lab = s < 1.0 ? mix(uLabDeep, uLabA, smoothstep(0.0, 1.0, s))
    : s < 2.0 ? mix(uLabA, uLabB, smoothstep(0.0, 1.0, s - 1.0))
    : mix(uLabB, uLabDeep, smoothstep(0.0, 1.0, s - 2.0));
  return labToLinear(lab);
}

float spine(float x) {
  float t = uTime;
  return uAmplitude * (0.62 * sin(x * uFrequency + t * 0.33 + 0.4)
    + 0.26 * sin(x * uFrequency * 1.93 - t * 0.21 + 2.1)
    + 0.12 * sin(x * uFrequency * 3.07 + t * 0.47 + 4.2));
}

vec3 wire(float x, float u, float seed, out float facing) {
  float t = uTime;
  float halfWidth = uHalf * (1.0 + 0.22 * sin(x * 0.61 - t * 0.19 + 1.3));
  float theta = uTwist * x + uSpin;
  float wobble = 0.4 * (sin(x * 2.3 + seed * 6.2831853 + t * 0.7) * 0.6 + sin(x * 3.9 - seed * 11.3 - t * 0.5) * 0.4);
  float xi = u + wobble * 0.05;
  float zeta = uCurl * (u * u - 1.0 / 3.0) + wobble * 0.07;
  float c = cos(theta);
  float s = sin(theta);
  float y = spine(x) + halfWidth * (xi * c - zeta * s);
  float z = xi * s + zeta * c;
  facing = clamp(0.5 + 0.5 * z, 0.0, 1.0);
  return vec3(x, y, z);
}

vec2 toScreen(vec2 p) {
  float unit = 0.5 * uResolution.y;
  float ca = cos(uAngle);
  float sa = sin(uAngle);
  return vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y) * unit + 0.5 * uResolution;
}

void main() {
  float u = aWire.x;
  float seed = aWire.y;
  float x = mix(-uExtent, uExtent, aSample.x);
  float delta = 2.0 * uExtent / 360.0;
  float f0;
  float f1;
  float f2;
  vec3 p0 = wire(x - delta, u, seed, f0);
  vec3 p1 = wire(x, u, seed, f1);
  vec3 p2 = wire(x + delta, u, seed, f2);
  vec2 s0 = toScreen(p0.xy);
  vec2 s1 = toScreen(p1.xy);
  vec2 s2 = toScreen(p2.xy);
  vec2 tangent = normalize(s2 - s0 + vec2(1e-6, 0.0));
  vec2 normal = vec2(-tangent.y, tangent.x);
  float halfPx = uLineWidth * uPixelRatio * mix(0.3, 1.0, f1 * f1 * f1) * 0.5;
  float reach = halfPx * 2.2 + 1.5;
  vec2 position2 = s1 + normal * aSample.y * reach;
  vDist = aSample.y * reach;
  vHalfPx = halfPx;
  float light = 0.0;
  for (int k = 0; k < 16; k++) {
    vec4 pulse = uPulses[k];
    if (pulse.w <= 0.0) continue;
    float age = uPulseTime - pulse.y;
    if (age < 0.0 || age > 4.0) continue;
    float travel = age * uPulseSpeed;
    float front = abs(x - pulse.x) - travel + 0.05 * sin(u * 7.0 + pulse.y * 3.7) + (seed - 0.5) * 0.025;
    bool wave = pulse.w > 1.5;
    float along = front > 0.0 ? exp(-front * front / 0.0025) : exp(front / (wave ? 0.32 : 0.13));
    along += wave ? 0.0 : 0.45 * exp(-front * front / 0.0012);
    along *= smoothstep(0.0, 0.12, travel);
    float gap = (u - pulse.z) * 13.0;
    float across = wave ? 1.0 : 1.25 * exp(-gap * gap);
    light += along * across * exp(-age * 1.1);
  }
  light = min(light * uPulseStrength, 1.4);
  float tone = u * uStripes * 0.5 + x * 0.09 - uFlow;
  vec3 base = palette(tone);
  float lit = clamp(light, 0.0, 1.0);
  vec3 glowTint = mix(base, vec3(1.0, 0.95, 1.0), lit * 0.45);
  vec3 inkTint = mix(base, labToLinear(uLabDeep), lit * 0.7);
  vColor = mix(glowTint, inkTint, uInk);
  vGain = mix(uBack, 1.0, pow(f1, 1.5)) * (1.0 + light * mix(0.9, 2.2, uInk)) * (1.0 + uEnergy * 0.18);
  gl_Position = vec4(position2 / uResolution * 2.0 - 1.0, 0.0, 1.0);
}
`;

const RIBBON_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform float uCore;
in float vDist;
in float vHalfPx;
in vec3 vColor;
in float vGain;
out vec4 fragColor;

void main() {
  float sigma = max(vHalfPx, 0.55);
  float d = vDist / sigma;
  float energy = exp(-d * d) * min(vHalfPx / 0.55, 1.0) * vGain * uCore;
  fragColor = vec4(vColor * energy, energy);
}
`;

const QUAD_VERTEX_SHADER = /* glsl */ `
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const DOWNSAMPLE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 a = texture(uSource, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 b = texture(uSource, vUv + uTexel * vec2(1.0, -1.0));
  vec4 c = texture(uSource, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 d = texture(uSource, vUv + uTexel * vec2(1.0, 1.0));
  fragColor = (a + b + c + d) * 0.125 + texture(uSource, vUv) * 0.5;
}
`;

const UPSAMPLE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uBase;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 sum = texture(uSource, vUv) * 4.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 0.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 0.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(0.0, -1.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(0.0, 1.0)) * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, -1.0));
  sum += texture(uSource, vUv + uTexel * vec2(1.0, -1.0));
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 1.0));
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 1.0));
  fragColor = texture(uBase, vUv) + sum / 16.0;
}
`;

const COMPOSITE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform sampler2D uLines;
uniform sampler2D uBloom;
uniform vec3 uBackground;
uniform vec2 uResolution;
uniform float uGlow;
uniform float uExposure;
uniform float uMode;
uniform float uGrain;
in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec4 lines = texture(uLines, vUv);
  vec4 bloom = texture(uBloom, vUv);
  vec3 color;
  if (uMode < 0.5) {
    vec3 light = (lines.rgb + bloom.rgb * uGlow) * uExposure;
    vec3 exposed = 1.0 - exp(-light);
    float peak = max(exposed.r, max(exposed.g, exposed.b));
    exposed = mix(exposed, vec3(peak), smoothstep(0.75, 1.0, peak) * 0.35);
    vec2 q = vUv - 0.5;
    q.x *= uResolution.x / uResolution.y;
    exposed *= 1.0 - 0.18 * smoothstep(0.35, 1.1, length(q));
    color = uBackground + (1.0 - uBackground) * exposed;
  } else {
    float energy = lines.a + bloom.a * uGlow * 0.2;
    vec3 hue = (lines.rgb + bloom.rgb * uGlow * 0.2) / max(energy, 1e-4);
    float cover = clamp(1.0 - exp(-energy * uExposure * 1.4), 0.0, 0.94);
    color = mix(uBackground, clamp(hue * 0.8, 0.0, 1.0), cover);
  }
  float grain = hash(gl_FragCoord.xy + uGrain * 311.0) - 0.5;
  fragColor = vec4(encode(color) + grain * (1.2 / 255.0), 1.0);
}
`;

/* -------------------------------- Presets -------------------------------- */

const BASE_PRESET: Required<Omit<InterferenceRibbonsProps, "className" | "style" | "children">> = {
  colors: ["#6B3CFF", "#D46BFF"],
  backgroundColor: "#060606",
  mode: "auto",
  wires: 64,
  lineWidth: 1.6,
  ribbonWidth: 0.24,
  amplitude: 0.6,
  waveLength: 1,
  angle: 42,
  twist: 1.6,
  curl: 0.25,
  depth: 0.65,
  stripes: 2.2,
  colorFlow: 0.04,
  glow: 0.45,
  intensity: 1,
  speed: 0.7,
  spin: 0.35,
  interactive: true,
  hoverPulses: true,
  clickPulse: true,
  pulseSpeed: 1.1,
  pulseStrength: 1,
  hoverBoost: 1,
  paused: false,
  quality: 1,
};

export const INTERFERENCE_RIBBON_PRESETS = {
  aurora: BASE_PRESET,
  nebula: {
    ...BASE_PRESET,
    colors: ["#3F5BFF", "#E26BFF"] as [string, string],
    stripes: 3,
  },
  electric: {
    ...BASE_PRESET,
    colors: ["#2F6BFF", "#8A4BFF"] as [string, string],
    glow: 0.6,
  },
  mono: {
    ...BASE_PRESET,
    colors: ["#FFFFFF", "#D9D6E8"] as [string, string],
    stripes: 1.4,
    glow: 0.35,
  },
  ember: {
    ...BASE_PRESET,
    colors: ["#FF6A3D", "#FFC46B"] as [string, string],
  },
  silk: {
    ...BASE_PRESET,
    wires: 40,
    lineWidth: 2.2,
    ribbonWidth: 0.3,
    amplitude: 0.5,
    twist: 0.9,
    curl: 0.15,
    stripes: 1,
    glow: 0.6,
    speed: 0.5,
    spin: 0.2,
  },
  dense: {
    ...BASE_PRESET,
    wires: 128,
    lineWidth: 1.1,
    ribbonWidth: 0.26,
    stripes: 3.2,
    glow: 0.55,
  },
};

/* ------------------------------- Component -------------------------------- */

export const InterferenceRibbons = forwardRef<InterferenceRibbonsHandle, InterferenceRibbonsProps>(
  function InterferenceRibbons(
    {
      colors = ["#6B3CFF", "#D46BFF"],
      backgroundColor = "#060606",
      mode = "auto",
      wires = 64,
      lineWidth = 1.6,
      ribbonWidth = 0.24,
      amplitude = 0.6,
      waveLength = 1,
      angle = 42,
      twist = 1.6,
      curl = 0.25,
      depth = 0.65,
      stripes = 2.2,
      colorFlow = 0.04,
      glow = 0.45,
      intensity = 1,
      speed = 0.7,
      spin = 0.35,
      interactive = true,
      hoverPulses = true,
      clickPulse = true,
      pulseSpeed = 1.1,
      pulseStrength = 1,
      hoverBoost = 1,
      paused = false,
      quality = 1,
      className,
      style,
      children,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const controllerRef = useRef<{ sync: () => void; destroy: () => void; pulse: (pos: number) => void } | null>(null);
    const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

    const propsRef = useRef({
      colors,
      backgroundColor,
      mode,
      wires,
      lineWidth,
      ribbonWidth,
      amplitude,
      waveLength,
      angle,
      twist,
      curl,
      depth,
      stripes,
      colorFlow,
      glow,
      intensity,
      speed,
      spin,
      interactive,
      hoverPulses,
      clickPulse,
      pulseSpeed,
      pulseStrength,
      hoverBoost,
      paused,
      quality,
      reduced: reducedMotion,
    });

    useEffect(() => {
      propsRef.current = {
        colors,
        backgroundColor,
        mode,
        wires,
        lineWidth,
        ribbonWidth,
        amplitude,
        waveLength,
        angle,
        twist,
        curl,
        depth,
        stripes,
        colorFlow,
        glow,
        intensity,
        speed,
        spin,
        interactive,
        hoverPulses,
        clickPulse,
        pulseSpeed,
        pulseStrength,
        hoverBoost,
        paused,
        quality,
        reduced: reducedMotion,
      };
      controllerRef.current?.sync();
    });

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      canvas.style.pointerEvents = "none";
      container.prepend(canvas);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: false,
          antialias: false,
          powerPreference: "high-performance",
        });
      } catch {
        canvas.remove();
        return;
      }

      if (!renderer.capabilities.isWebGL2) {
        renderer.dispose();
        canvas.remove();
        return;
      }

      renderer.autoClear = false;

      const floatType =
        renderer.extensions.has("EXT_color_buffer_float") ||
        renderer.extensions.has("EXT_color_buffer_half_float")
          ? THREE.HalfFloatType
          : THREE.UnsignedByteType;

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quadGeometry = new THREE.PlaneGeometry(2, 2);
      const pulses = Array.from({ length: 16 }, () => new THREE.Vector4(0, -100, 0, 0));

      const ribbonMaterial = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: {
          uResolution: { value: new THREE.Vector2(1, 1) },
          uPixelRatio: { value: 1 },
          uTime: { value: 0 },
          uPulseTime: { value: 0 },
          uAngle: { value: 0 },
          uExtent: { value: 2 },
          uAmplitude: { value: 0.6 },
          uFrequency: { value: 1.55 },
          uHalf: { value: 0.24 },
          uCurl: { value: 0.25 },
          uTwist: { value: 1.6 },
          uSpin: { value: 0 },
          uLineWidth: { value: 1.6 },
          uBack: { value: 0.35 },
          uStripes: { value: 2.2 },
          uFlow: { value: 0 },
          uEnergy: { value: 0 },
          uPulseSpeed: { value: 1.1 },
          uPulseStrength: { value: 1 },
          uInk: { value: 0 },
          uLabDeep: { value: new THREE.Vector3() },
          uLabA: { value: new THREE.Vector3() },
          uLabB: { value: new THREE.Vector3() },
          uPulses: { value: pulses },
          uCore: { value: 0.85 },
        },
        vertexShader: RIBBON_VERTEX_SHADER,
        fragmentShader: RIBBON_FRAGMENT_SHADER,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
      });

      const makeQuadMaterial = (fragmentShader: string, uniforms: Record<string, { value: any }>) =>
        new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          uniforms,
          vertexShader: QUAD_VERTEX_SHADER,
          fragmentShader,
          depthTest: false,
          depthWrite: false,
          blending: THREE.NoBlending,
        });

      const downsampleMaterial = makeQuadMaterial(DOWNSAMPLE_FRAGMENT_SHADER, {
        uSource: { value: null },
        uTexel: { value: new THREE.Vector2() },
      });

      const upsampleMaterial = makeQuadMaterial(UPSAMPLE_FRAGMENT_SHADER, {
        uSource: { value: null },
        uBase: { value: null },
        uTexel: { value: new THREE.Vector2() },
      });

      const compositeMaterial = makeQuadMaterial(COMPOSITE_FRAGMENT_SHADER, {
        uLines: { value: null },
        uBloom: { value: null },
        uBackground: { value: new THREE.Vector3() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uGlow: { value: 0.45 },
        uExposure: { value: 1.6 },
        uMode: { value: 0 },
        uGrain: { value: 0 },
      });

      let currentWireCount = 0;
      const ribbonMesh = new THREE.Mesh(new THREE.BufferGeometry(), ribbonMaterial);
      ribbonMesh.frustumCulled = false;
      const ribbonsScene = new THREE.Scene();
      ribbonsScene.add(ribbonMesh);

      const quadMesh = new THREE.Mesh(quadGeometry, compositeMaterial);
      quadMesh.frustumCulled = false;
      const quadScene = new THREE.Scene();
      quadScene.add(quadMesh);

      const makeRenderTarget = (w: number, h: number) =>
        new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
          type: floatType,
          format: THREE.RGBAFormat,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          depthBuffer: false,
          stencilBuffer: false,
          generateMipmaps: false,
        });

      let renderTargetMain: THREE.WebGLRenderTarget | null = null;
      let bloomDownTargets: THREE.WebGLRenderTarget[] = [];
      let bloomUpTargets: THREE.WebGLRenderTarget[] = [];

      let isDestroyed = false;
      let rafId = 0;
      let lastTime = 0;
      const adaptive = createAdaptiveQuality();
      let isVisible = true;
      let timeAccum = 6;
      let pulseTime = 0;
      let spinAccum = 0;
      let colorFlowAccum = 0;
      let energy = 0;
      let isHovered = false;
      let pulseIndex = 0;
      let width = 1;
      let height = 1;
      let pixelRatio = 1;
      let grainOffset = 0;
      let lastPointer = { x: -1e9, y: -1e9 };

      const disposeRenderTargets = () => {
        renderTargetMain?.dispose();
        bloomDownTargets.forEach((t) => t.dispose());
        bloomUpTargets.forEach((t) => t.dispose());
        renderTargetMain = null;
        bloomDownTargets = [];
        bloomUpTargets = [];
      };

      const renderQuad = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
        quadMesh.material = mat;
        renderer.setRenderTarget(target);
        renderer.render(quadScene, camera);
      };

      const computeAngleExtent = () => {
        const p = propsRef.current;
        const rad = (clamp(p.angle, -180, 180) * Math.PI) / 180;
        const extent =
          ((width / Math.max(height, 1)) * Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad))) * 1.08;
        return {
          angle: rad,
          extent,
          frequency: 1.55 / clamp(p.waveLength, 0.2, 5),
        };
      };

      const buildRibbonGeometry = (wireCount: number) => {
        const vCount = 361 * wireCount * 8;
        const iCount = 360 * wireCount * 6;
        const vData = new Float32Array(vCount);
        const iData = new Uint32Array(iCount);
        let vIdx = 0;
        let iIdx = 0;
        let randSeed = 1;
        const pseudoRand = () => {
          randSeed = (16807 * randSeed) % 2147483647;
          return randSeed / 2147483647;
        };

        for (let wire = 0; wire < wireCount; wire++) {
          const u = ((wire + 0.5) / wireCount) * 2 - 1;
          const wireRand = pseudoRand();
          const baseV = vIdx / 4;

          for (let s = 0; s <= 360; s++) {
            const sampleFrac = s / 360;
            vData.set([u, wireRand, sampleFrac, -1, u, wireRand, sampleFrac, 1], vIdx);
            vIdx += 8;
          }

          for (let seg = 0; seg < 360; seg++) {
            const v0 = baseV + 2 * seg;
            iData.set([v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2], iIdx);
            iIdx += 6;
          }
        }

        const geo = new THREE.BufferGeometry();
        const buf = new THREE.InterleavedBuffer(vData, 4);
        geo.setAttribute("aWire", new THREE.InterleavedBufferAttribute(buf, 2, 0));
        geo.setAttribute("aSample", new THREE.InterleavedBufferAttribute(buf, 2, 2));
        geo.setAttribute("position", new THREE.InterleavedBufferAttribute(buf, 3, 0));
        geo.setIndex(new THREE.BufferAttribute(iData, 1));
        return geo;
      };

      const render = () => {
        if (!renderTargetMain || !bloomDownTargets.length) return;

        const p = propsRef.current;
        const targetWireCount = Math.round(clamp(p.wires, 4, 160));
        if (targetWireCount !== currentWireCount) {
          currentWireCount = targetWireCount;
          ribbonMesh.geometry.dispose();
          ribbonMesh.geometry = buildRibbonGeometry(targetWireCount);
        }

        // Update uniforms
        const resW = width * pixelRatio;
        const resH = height * pixelRatio;
        const { angle: rad, extent, frequency } = computeAngleExtent();
        const labA = linearToOKLab(parseCssColor(p.colors[0], [0.42, 0.24, 1]));
        const labB = linearToOKLab(parseCssColor(p.colors[1], [0.83, 0.42, 1]));

        const ru = ribbonMaterial.uniforms;
        ru.uResolution.value.set(resW, resH);
        ru.uPixelRatio.value = pixelRatio;
        ru.uTime.value = timeAccum;
        ru.uPulseTime.value = pulseTime;
        ru.uAngle.value = rad;
        ru.uExtent.value = extent;
        ru.uAmplitude.value = clamp(p.amplitude, 0, 1.5);
        ru.uFrequency.value = frequency;
        ru.uHalf.value = clamp(p.ribbonWidth, 0.02, 0.8);
        ru.uCurl.value = clamp(p.curl, 0, 1.2);
        ru.uTwist.value = clamp(p.twist, 0, 8);
        ru.uSpin.value = spinAccum;
        ru.uLineWidth.value = clamp(p.lineWidth, 0.4, 6);
        ru.uBack.value = 1 - clamp(p.depth, 0, 1);
        ru.uStripes.value = clamp(p.stripes, 0, 12);
        ru.uFlow.value = colorFlowAccum;
        ru.uEnergy.value = energy;
        ru.uPulseSpeed.value = clamp(p.pulseSpeed, 0.1, 5);
        ru.uPulseStrength.value = clamp(p.pulseStrength, 0, 3);

        const bgRgb = parseCssColor(p.backgroundColor, [0.024, 0.024, 0.024]);
        const bgLum = 0.2126 * bgRgb[0] + 0.7152 * bgRgb[1] + 0.0722 * bgRgb[2];
        const isInk = p.mode === "ink" || (p.mode === "auto" && bgLum > 0.5);
        const labScale = isInk ? 1.15 : 0.85;

        ru.uInk.value = isInk ? 1 : 0;
        ru.uLabDeep.value.set(labA[0] * (isInk ? 0.6 : 0.42), labA[1] * labScale, labA[2] * labScale);
        ru.uLabA.value.set(labA[0], labA[1], labA[2]);
        ru.uLabB.value.set(labB[0], labB[1], labB[2]);

        const cu = compositeMaterial.uniforms;
        cu.uBackground.value.set(sRGBToLinear(bgRgb[0]), sRGBToLinear(bgRgb[1]), sRGBToLinear(bgRgb[2]));
        cu.uResolution.value.set(resW, resH);
        cu.uGlow.value = clamp(p.glow, 0, 3);
        cu.uExposure.value = 1.6 * clamp(p.intensity, 0, 4);
        cu.uMode.value = isInk ? 1 : 0;
        cu.uGrain.value = grainOffset;

        // Render main ribbons pass
        renderer.setRenderTarget(renderTargetMain);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(ribbonsScene, camera);

        // Bloom downsample passes
        let srcTex = renderTargetMain.texture;
        for (const downTarget of bloomDownTargets) {
          downsampleMaterial.uniforms.uSource.value = srcTex;
          downsampleMaterial.uniforms.uTexel.value.set(1 / downTarget.width, 1 / downTarget.height);
          renderQuad(downsampleMaterial, downTarget);
          srcTex = downTarget.texture;
        }

        // Bloom upsample passes
        let topBloom = bloomDownTargets[bloomDownTargets.length - 1];
        for (let i = bloomDownTargets.length - 2; i >= 0; i--) {
          upsampleMaterial.uniforms.uSource.value = topBloom.texture;
          upsampleMaterial.uniforms.uBase.value = bloomDownTargets[i].texture;
          upsampleMaterial.uniforms.uTexel.value.set(1 / topBloom.width, 1 / topBloom.height);
          renderQuad(upsampleMaterial, bloomUpTargets[i]);
          topBloom = bloomUpTargets[i];
        }

        // Final composite pass to canvas
        compositeMaterial.uniforms.uLines.value = renderTargetMain.texture;
        compositeMaterial.uniforms.uBloom.value = topBloom.texture;
        renderQuad(compositeMaterial, null);
      };

      const onFrame = (now: number) => {
        rafId = 0;
        if (isDestroyed) return;

        const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
        const rawMs = now - lastTime;
        lastTime = now;
        if (adaptive.tick(rawMs)) onResize();

        const p = propsRef.current;
        const targetEnergy = isHovered && p.interactive && !p.reduced ? clamp(p.hoverBoost, 0, 2) : 0;
        energy += (targetEnergy - energy) * (1 - Math.exp(-delta / 0.4));
        pulseTime += delta;

        if (!p.paused && !p.reduced) {
          const effSpeed = clamp(p.speed, -4, 4) * (1 + 0.35 * energy);
          timeAccum += delta * effSpeed;
          spinAccum += delta * effSpeed * clamp(p.spin, -4, 4);
          colorFlowAccum += delta * effSpeed * clamp(p.colorFlow, -2, 2);
          grainOffset = (grainOffset + 0.618034) % 1;
        }

        render();

        const activeMotion = !p.paused && !p.reduced;
        const targetHover = isHovered && p.interactive && !p.reduced ? p.hoverBoost : 0;
        const activeResidual =
          Math.abs(energy - targetHover) > 0.002 || pulses.some((item) => item.w > 0 && pulseTime - item.y < 4);

        // onResize() above may already have re-armed the loop via startLoop().
        if (isVisible && !document.hidden && !rafId && (activeMotion || activeResidual)) {
          rafId = requestAnimationFrame(onFrame);
        }
      };

      const startLoop = () => {
        if (!isDestroyed && !rafId && isVisible) {
          lastTime = performance.now();
          rafId = requestAnimationFrame(onFrame);
        }
      };

      const onResize = () => {
        const rect = container.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        pixelRatio =
          Math.min(window.devicePixelRatio || 1, 2) * clamp(propsRef.current.quality, 0.25, 1) * adaptive.scale;

        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);

        const targetW = Math.round(width * pixelRatio);
        const targetH = Math.round(height * pixelRatio);

        disposeRenderTargets();
        renderTargetMain = makeRenderTarget(targetW, targetH);

        const mipLevels = clamp(Math.floor(Math.log2(Math.min(targetW, targetH) / 8)), 3, 7);
        for (let i = 1; i <= mipLevels; i++) {
          bloomDownTargets.push(makeRenderTarget(Math.max(1, targetW >> i), Math.max(1, targetH >> i)));
          bloomUpTargets.push(makeRenderTarget(Math.max(1, targetW >> i), Math.max(1, targetH >> i)));
        }

        render();
        startLoop();
      };

      const enqueuePulse = (x: number, yFrac: number, strength: number) => {
        pulses[pulseIndex].set(x, pulseTime, yFrac, strength);
        pulseIndex = (pulseIndex + 1) % 16;
        startLoop();
      };

      const getRibbonCoord = (clientX: number, clientY: number) => {
        const rect = container.getBoundingClientRect();
        const { angle: rad } = computeAngleExtent();
        const halfH = 0.5 * rect.height;
        const nx = (clientX - rect.left - rect.width / 2) / halfH;
        const ny = -(clientY - rect.top - rect.height / 2) / halfH;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        return {
          x: cosA * nx + sinA * ny,
          y: -sinA * nx + cosA * ny,
        };
      };

      const onPointerMove = (e: PointerEvent) => {
        const p = propsRef.current;
        if (e.pointerType === "touch" || !p.interactive) return;

        if (!isHovered) {
          isHovered = true;
          startLoop();
        }

        if (
          !p.hoverPulses ||
          p.reduced ||
          Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y) < 50
        ) {
          return;
        }

        const { frequency } = computeAngleExtent();
        const pos = getRibbonCoord(e.clientX, e.clientY);
        const halfWidth =
          clamp(p.ribbonWidth, 0.02, 0.8) *
          (1 + 0.22 * Math.sin(0.61 * pos.x - 0.19 * timeAccum + 1.3));
        const theta = clamp(p.twist, 0, 8) * pos.x + spinAccum;
        const spineY =
          clamp(p.amplitude, 0, 1.5) *
          (0.62 * Math.sin(pos.x * frequency + 0.33 * timeAccum + 0.4) +
            0.26 * Math.sin(pos.x * frequency * 1.93 - 0.21 * timeAccum + 2.1) +
            0.12 * Math.sin(pos.x * frequency * 3.07 + 0.47 * timeAccum + 4.2));

        const dist = pos.y - spineY;
        if (Math.abs(dist) > halfWidth * Math.max(Math.abs(Math.cos(theta)), 0.12) + 0.03) {
          return;
        }

        lastPointer.x = e.clientX;
        lastPointer.y = e.clientY;
        const cross = clamp(dist / (halfWidth * Math.cos(theta) || 0.001), -1, 1);
        enqueuePulse(pos.x, cross, 1);
      };

      const onPointerLeave = () => {
        isHovered = false;
        lastPointer.x = -1e9;
        lastPointer.y = -1e9;
        startLoop();
      };

      const onPointerDown = (e: PointerEvent) => {
        const p = propsRef.current;
        if (e.button === 0 && p.interactive && p.clickPulse && !p.reduced) {
          enqueuePulse(getRibbonCoord(e.clientX, e.clientY).x, 0, 2);
        }
      };

      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerleave", onPointerLeave);
      container.addEventListener("pointercancel", onPointerLeave);
      container.addEventListener("pointerdown", onPointerDown);

      const resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);

      const intersectionObserver = new IntersectionObserver(
        (entries) => {
          isVisible = entries.some((entry) => entry.isIntersecting);
          if (isVisible) startLoop();
        },
        { rootMargin: "80px" }
      );
      intersectionObserver.observe(container);

      const onVisibilityChange = () => {
        if (!document.hidden) startLoop();
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      const onContextLost = (e: Event) => e.preventDefault();
      canvas.addEventListener("webglcontextlost", onContextLost);

      onResize();

      const controller = {
        sync: () => {
          const currentScale =
            Math.min(window.devicePixelRatio || 1, 2) * clamp(propsRef.current.quality, 0.25, 1) * adaptive.scale;
          if (Math.abs(currentScale - pixelRatio) > 0.001) {
            onResize();
          } else {
            render();
          }
          startLoop();
        },
        destroy: () => {
          isDestroyed = true;
          cancelAnimationFrame(rafId);
          container.removeEventListener("pointermove", onPointerMove);
          container.removeEventListener("pointerleave", onPointerLeave);
          container.removeEventListener("pointercancel", onPointerLeave);
          container.removeEventListener("pointerdown", onPointerDown);
          document.removeEventListener("visibilitychange", onVisibilityChange);
          canvas.removeEventListener("webglcontextlost", onContextLost);
          resizeObserver.disconnect();
          intersectionObserver.disconnect();

          disposeRenderTargets();
          ribbonMesh.geometry.dispose();
          quadGeometry.dispose();
          [ribbonMaterial, downsampleMaterial, upsampleMaterial, compositeMaterial].forEach((m) =>
            m.dispose()
          );
          renderer.dispose();
          renderer.forceContextLoss();
          canvas.remove();
        },
        pulse: (pos = 0.5) => {
          if (propsRef.current.reduced) return;
          const rect = container.getBoundingClientRect();
          enqueuePulse(getRibbonCoord(rect.left + clamp(pos, 0, 1) * rect.width, rect.top + rect.height / 2).x, 0, 2);
        },
      };

      controllerRef.current = controller;
      return () => {
        controller.destroy();
        controllerRef.current = null;
      };
    }, []);

    useImperativeHandle(ref, () => ({
      pulse: (pos = 0.5) => controllerRef.current?.pulse(pos),
    }));

    return (
      <div
        ref={containerRef}
        className={cn("relative isolate h-full min-h-[240px] w-full overflow-hidden", className)}
        style={{ backgroundColor, ...style }}
      >
        {children && <div className="relative z-10 h-full w-full">{children}</div>}
      </div>
    );
  }
);

InterferenceRibbons.displayName = "InterferenceRibbons";
