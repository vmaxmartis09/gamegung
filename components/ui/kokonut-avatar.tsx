// biome-ignore-all lint/suspicious/noBitwiseOperators: the seed hash and PRNG are bitwise by design.
"use client";

/**
 * Ported from KokonutUI Avatar Picker
 * @author: @dorianbaffier
 * @version: 2.0.0
 * @license: MIT — Copyright (c) KokonutUI (https://kokonutui.com)
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Adapted for Office Arena: framer-motion imports, dark GenZ theme,
 * Vietnamese copy, and a lightweight static <KokonutFace> for lists.
 */

import { ArrowRight, Dices } from "lucide-react";
import {
  type AnimationPlaybackControls,
  animate,
  LayoutGroup,
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "framer-motion";
import { useReducedMotion, AppMotionConfig } from "@/lib/motion";
import {
  memo,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Face generation
 * ------------------------------------------------------------------------- */

type RGB = readonly [number, number, number];

const BACKGROUNDS: readonly { name: string; rgb: RGB }[] = [
  { name: "gray", rgb: [228, 228, 231] },
  { name: "sand", rgb: [233, 226, 214] },
  { name: "sage", rgb: [217, 225, 213] },
  { name: "slate", rgb: [218, 225, 233] },
  { name: "clay", rgb: [235, 221, 214] },
  { name: "mist", rgb: [226, 223, 233] },
];
const SKINS: readonly RGB[] = [
  [246, 233, 222],
  [236, 210, 187],
  [214, 176, 142],
  [176, 128, 96],
  [128, 88, 66],
];
const HAIRS: readonly RGB[] = [
  [39, 39, 42],
  [63, 45, 36],
  [113, 84, 62],
  [161, 161, 170],
  [82, 82, 91],
];
const SHIRTS: readonly RGB[] = [
  [39, 39, 42],
  [82, 82, 91],
  [113, 113, 122],
  [244, 244, 245],
];
const INK = "#18181b";

const SHAPE_KEYS = [
  "headW",
  "headH",
  "headSquare",
  "chin",
  "hairVolume",
  "hairFringe",
  "hairPart",
  "hairLength",
  "eyeGap",
  "eyeY",
  "eyeRx",
  "eyeRy",
  "browTilt",
  "browLift",
  "browWeight",
  "mouthW",
  "mouthCurve",
  "mouthOpen",
  "nose",
  "glasses",
  "cheeks",
  "shoulders",
] as const;

type ShapeKey = (typeof SHAPE_KEYS)[number];

export interface Face {
  shape: Record<ShapeKey, number>;
  bg: RGB;
  skin: RGB;
  hair: RGB;
  shirt: RGB;
  description: string;
}

function hashString(input: string) {
  let h = 2_166_136_261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function pick<T>(list: readonly T[], r: number): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))] as T;
}

function describe(shape: Face["shape"]) {
  let hair = "tóc ngắn";
  if (shape.hairLength > 0.62) hair = "tóc dài";
  else if (shape.hairVolume < 0.22) hair = "tóc cắt sát";
  let mouth = "cười mỉm";
  if (shape.mouthOpen > 0.5) mouth = "cười tươi";
  else if (shape.mouthCurve > 3.2) mouth = "cười rộng";
  else if (shape.mouthCurve < 1) mouth = "điềm tĩnh";
  const face = shape.headSquare > 0.55 ? "Mặt vuông" : "Mặt tròn";
  const glasses = shape.glasses > 0.5 ? ", đeo kính" : "";
  return `${face}, ${hair}${glasses}, ${mouth}`;
}

const faceCache = new Map<string, Face>();

/** Deterministic face for a seed. Same seed, same face, server and client. */
export function createFace(seed: string): Face {
  const cached = faceCache.get(seed);
  if (cached) return cached;
  const r = mulberry32(hashString(seed));
  const bg = pick(BACKGROUNDS, r());
  const shape: Face["shape"] = {
    headW: 18 + r() * 5,
    headH: 22 + r() * 4,
    headSquare: r(),
    chin: 0.75 + r() * 0.25,
    hairVolume: r(),
    hairFringe: r(),
    hairPart: r() * 2 - 1,
    hairLength: r() ** 1.6,
    eyeGap: 7.5 + r() * 3,
    eyeY: -2 + r() * 4,
    eyeRx: 1.7 + r() * 0.9,
    eyeRy: 1.9 + r() * 1.4,
    browTilt: -2 + r() * 4,
    browLift: 4.2 + r() * 2,
    browWeight: r() < 0.65 ? 1.3 + r() * 0.8 : 0,
    mouthW: 3.5 + r() * 3,
    mouthCurve: r() * 4.5,
    mouthOpen: r() < 0.3 ? 0.6 + r() * 0.4 : 0,
    nose: r(),
    glasses: r() < 0.25 ? 1 : 0,
    cheeks: r(),
    shoulders: r(),
  };
  for (const key of SHAPE_KEYS) shape[key] = round2(shape[key]);
  const face: Face = {
    shape,
    bg: bg.rgb,
    skin: pick(SKINS, r()),
    hair: pick(HAIRS, r()),
    shirt: pick(SHIRTS, r()),
    description: describe(shape),
  };
  if (faceCache.size > 400) faceCache.clear();
  faceCache.set(seed, face);
  return face;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const c = (i: 0 | 1 | 2) => Math.max(0, Math.min(255, Math.round(lerp(a[i], b[i], t))));
  return [c(0), c(1), c(2)];
}

function lerpFace(a: Face, b: Face, t: number): Face {
  const shape = { ...b.shape };
  for (const key of SHAPE_KEYS) shape[key] = lerp(a.shape[key], b.shape[key], t);
  const ct = Math.min(1, t);
  return {
    shape,
    bg: lerpRgb(a.bg, b.bg, ct),
    skin: lerpRgb(a.skin, b.skin, ct),
    hair: lerpRgb(a.hair, b.hair, ct),
    shirt: lerpRgb(a.shirt, b.shirt, ct),
    description: b.description,
  };
}

const rgb = (c: RGB, k = 1) =>
  `rgb(${Math.round(c[0] * k)} ${Math.round(c[1] * k)} ${Math.round(c[2] * k)})`;

const n = round2;

function blobPath(cx: number, cy: number, w: number, top: number, bottom: number, square: number, chin = 1) {
  const k = 0.552 + square * 0.28;
  const kb = k * chin;
  return [
    `M${n(cx)} ${n(cy - top)}`,
    `C${n(cx + k * w)} ${n(cy - top)} ${n(cx + w)} ${n(cy - k * top)} ${n(cx + w)} ${n(cy)}`,
    `C${n(cx + w)} ${n(cy + kb * bottom)} ${n(cx + kb * w)} ${n(cy + bottom)} ${n(cx)} ${n(cy + bottom)}`,
    `C${n(cx - kb * w)} ${n(cy + bottom)} ${n(cx - w)} ${n(cy + kb * bottom)} ${n(cx - w)} ${n(cy)}`,
    `C${n(cx - w)} ${n(cy - k * top)} ${n(cx - k * w)} ${n(cy - top)} ${n(cx)} ${n(cy - top)}Z`,
  ].join("");
}

function hairFrontPath(s: Face["shape"], cx: number, cy: number) {
  const w = s.headW;
  const h = s.headH;
  const v = s.hairVolume;
  const temple = cy - h * 0.12;
  const crown = cy - h - 1.5 - v * 4;
  const side = w + 1.5 + v * 2.5;
  const k = 0.552 + s.headSquare * 0.28;
  const fringeY = cy - h * (0.66 - s.hairFringe * 0.36);
  const partX = cx + s.hairPart * w * 0.55;
  return [
    `M${n(cx - side)} ${n(temple)}`,
    `C${n(cx - side)} ${n(cy - h * k - v * 3)} ${n(cx - k * side)} ${n(crown)} ${n(cx)} ${n(crown)}`,
    `C${n(cx + k * side)} ${n(crown)} ${n(cx + side)} ${n(cy - h * k - v * 3)} ${n(cx + side)} ${n(temple)}`,
    `L${n(cx + w - 1)} ${n(temple)}`,
    `Q${n(cx + w * 0.75)} ${n(fringeY + 1 - s.hairPart * 5)} ${n(partX)} ${n(fringeY - 2.5)}`,
    `Q${n(cx - w * 0.75)} ${n(fringeY + 1 + s.hairPart * 5)} ${n(cx - w + 1)} ${n(temple)}Z`,
  ].join("");
}

function mouthPath(s: Face["shape"], cx: number, y: number) {
  const curve = s.mouthCurve * 2;
  const open = s.mouthOpen * 5;
  return [
    `M${n(cx - s.mouthW)} ${n(y)}`,
    `Q${n(cx)} ${n(y + curve)} ${n(cx + s.mouthW)} ${n(y)}`,
    `Q${n(cx)} ${n(y + curve + open)} ${n(cx - s.mouthW)} ${n(y)}Z`,
  ].join("");
}

interface FaceArtProps {
  face: Face;
  look?: { x: MotionValue<number>; y: MotionValue<number> };
  blinkRef?: RefObject<SVGGElement | null>;
  className?: string;
}

function FaceLayers({ face, eyes }: { face: Face; eyes: React.ReactNode }) {
  const s = face.shape;
  const cx = 50;
  const cy = 50;
  const eyeY = cy + s.eyeY;
  const mouthY = cy + s.headH * 0.5;
  const glassR = Math.max(s.eyeRx, s.eyeRy) + 3.2;
  const neckTop = cy + s.headH - 6;
  const shoulderTop = cy + s.headH + 3;
  const sw = 30 + s.shoulders * 8;
  return (
    <>
      <rect fill={rgb(face.bg)} height="100" width="100" />
      <path
        d={blobPath(
          cx,
          cy - s.headH * 0.15,
          s.headW + 1 + s.hairVolume * 2.5,
          s.headH * 0.85 + s.hairVolume * 4,
          s.headH * 0.15 + s.hairLength * (s.headH + 14),
          s.headSquare * 0.6
        )}
        fill={rgb(face.hair, 0.9)}
      />
      <path
        d={`M${n(cx - sw)} 100C${n(cx - sw)} ${n(shoulderTop + 6)} ${n(cx - sw * 0.55)} ${n(shoulderTop)} ${cx} ${n(shoulderTop)}C${n(cx + sw * 0.55)} ${n(shoulderTop)} ${n(cx + sw)} ${n(shoulderTop + 6)} ${n(cx + sw)} 100Z`}
        fill={rgb(face.shirt)}
      />
      <rect fill={rgb(face.skin, 0.9)} height={n(shoulderTop - neckTop + 3)} rx="3" width="12" x={cx - 6} y={n(neckTop)} />
      <ellipse cx={n(cx - s.headW)} cy={n(cy + 2)} fill={rgb(face.skin, 0.95)} rx="3" ry="4.5" />
      <ellipse cx={n(cx + s.headW)} cy={n(cy + 2)} fill={rgb(face.skin, 0.95)} rx="3" ry="4.5" />
      <path d={blobPath(cx, cy, s.headW, s.headH, s.headH, s.headSquare, s.chin)} fill={rgb(face.skin)} />
      <path d={hairFrontPath(s, cx, cy)} fill={rgb(face.hair)} />
      <g fill={INK} opacity={n(0.045 * s.cheeks)}>
        <circle cx={n(cx - s.eyeGap - 3)} cy={n(eyeY + 7)} r="3.4" />
        <circle cx={n(cx + s.eyeGap + 3)} cy={n(eyeY + 7)} r="3.4" />
      </g>
      <g stroke={INK} strokeLinecap="round" strokeOpacity="0.85" strokeWidth={n(Math.max(0, s.browWeight))}>
        <path d={`M${n(cx - s.eyeGap - 3.2)} ${n(eyeY - s.browLift + s.browTilt)}L${n(cx - s.eyeGap + 3.2)} ${n(eyeY - s.browLift - s.browTilt)}`} />
        <path d={`M${n(cx + s.eyeGap - 3.2)} ${n(eyeY - s.browLift - s.browTilt)}L${n(cx + s.eyeGap + 3.2)} ${n(eyeY - s.browLift + s.browTilt)}`} />
      </g>
      {eyes}
      <path
        d={`M${n(cx - 1.5 - s.nose)} ${n(eyeY + 8 + s.nose * 1.5)}Q${cx} ${n(eyeY + 9.5 + s.nose * 1.5)} ${n(cx + 1.5 + s.nose)} ${n(eyeY + 8 + s.nose * 1.5)}`}
        fill="none"
        stroke={INK}
        strokeLinecap="round"
        strokeOpacity="0.35"
        strokeWidth="1.2"
      />
      <path d={mouthPath(s, cx, mouthY)} fill={INK} stroke={INK} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <g fill="none" opacity={n(Math.max(0, Math.min(1, s.glasses)))} stroke={INK} strokeWidth="1.2">
        <circle cx={n(cx - s.eyeGap)} cy={n(eyeY)} r={n(glassR)} />
        <circle cx={n(cx + s.eyeGap)} cy={n(eyeY)} r={n(glassR)} />
        <path d={`M${n(cx - s.eyeGap + glassR)} ${n(eyeY)}Q${cx} ${n(eyeY - 2)} ${n(cx + s.eyeGap - glassR)} ${n(eyeY)}`} />
      </g>
    </>
  );
}

function EyePair({ face }: { face: Face }) {
  const s = face.shape;
  const eyeY = 50 + s.eyeY;
  return (
    <>
      <ellipse cx={n(50 - s.eyeGap)} cy={n(eyeY)} fill={INK} rx={n(s.eyeRx)} ry={n(s.eyeRy)} />
      <ellipse cx={n(50 + s.eyeGap)} cy={n(eyeY)} fill={INK} rx={n(s.eyeRx)} ry={n(s.eyeRy)} />
    </>
  );
}

/** Animated face (eyes follow pointer, blink). Used in the picker only. */
function FaceArt({ face, look, blinkRef, className }: FaceArtProps) {
  return (
    <svg aria-hidden="true" className={cn("block h-full w-full", className)} viewBox="12 14 76 76">
      <FaceLayers
        face={face}
        eyes={
          <motion.g style={look ? { x: look.x, y: look.y } : undefined}>
            <g
              className="transition-transform duration-75 ease-out"
              ref={blinkRef}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <EyePair face={face} />
            </g>
          </motion.g>
        }
      />
    </svg>
  );
}

/** Static, memoised face for lists, chat bubbles, boards. Zero motion cost. */
export const KokonutFace = memo(function KokonutFace({
  seed,
  className,
  title,
}: {
  seed: string;
  className?: string;
  title?: string;
}) {
  const face = createFace(seed);
  return (
    <svg
      role="img"
      aria-label={title ?? face.description}
      className={cn("block h-full w-full", className)}
      viewBox="12 14 76 76"
    >
      <FaceLayers face={face} eyes={<EyePair face={face} />} />
    </svg>
  );
});

const MORPH = { type: "spring", bounce: 0.22, visualDuration: 0.42 } as const;

function MorphingFace({
  seed,
  morph = true,
  ...rest
}: Omit<FaceArtProps, "face"> & { seed: string; morph?: boolean }) {
  const [face, setFace] = useState(() => createFace(seed));
  const shownRef = useRef(face);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const target = createFace(seed);
    if (!morph || reduceMotion) {
      shownRef.current = target;
      setFace(target);
      return;
    }
    const from = shownRef.current;
    const controls = animate(0, 1, {
      ...MORPH,
      onUpdate: (t) => {
        const next = lerpFace(from, target, t);
        shownRef.current = next;
        setFace(next);
      },
    });
    return () => controls.stop();
  }, [seed, morph, reduceMotion]);

  return <FaceArt face={face} {...rest} />;
}

/* ----------------------------------------------------------------------------
 * Picker
 * ------------------------------------------------------------------------- */

export interface AvatarValue {
  displayName: string;
  variant: number;
}

export interface AvatarPickerProps {
  value?: AvatarValue;
  defaultValue?: Partial<AvatarValue>;
  onChange?: (value: AvatarValue & { seed: string; description: string }) => void;
  onComplete?: (value: AvatarValue & { seed: string }) => void;
  name?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  /** Hide the built-in name field and submit button (when embedded in a larger form). */
  embedded?: boolean;
  className?: string;
}

const SLOT_COUNT = 5;
const COIN = 128;
const BEZEL = 176;
const TICKS = 60;
const DEG_PER_PX = 180 / COIN;
const MAX_FLICK_STEPS = 10;
const TAP_SLOP = 4;
const DRAG_SPRING = { type: "spring", stiffness: 140, damping: 22 } as const;
const SHUFFLE_SPRING = { type: "spring", stiffness: 50, damping: 11 } as const;
const FLY = { type: "spring", bounce: 0.18, visualDuration: 0.45 } as const;
const MIN_NAME = 2;

/** The seed string for a name and variant; feed it to `createFace`. */
export function avatarSeed(displayName: string, variant: number) {
  return `${displayName.trim().toLowerCase()}:${variant}`;
}

const pad3 = (v: number) => String(((v % 1000) + 1000) % 1000).padStart(3, "0");

const TICK_LINES = Array.from({ length: TICKS }, (_, i) => {
  const a = (i / TICKS) * Math.PI * 2;
  const long = i % 5 === 0;
  const r1 = BEZEL / 2 - 3;
  const r0 = r1 - (long ? 7 : 4);
  const c = BEZEL / 2;
  return {
    key: i,
    long,
    x1: round2(c + Math.sin(a) * r0),
    y1: round2(c - Math.cos(a) * r0),
    x2: round2(c + Math.sin(a) * r1),
    y2: round2(c - Math.cos(a) * r1),
  };
});

function useInView(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = false;
    const update = () => setActive(onScreen && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      update();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return active;
}

function useLivingEyes(coinRef: RefObject<HTMLDivElement | null>, active: boolean) {
  const reduceMotion = useReducedMotion();
  const x = useSpring(0, { stiffness: 180, damping: 18 });
  const y = useSpring(0, { stiffness: 180, damping: 18 });
  const blinkRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!active || reduceMotion) return;
    const onMove = (e: globalThis.PointerEvent) => {
      const el = coinRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 220);
      x.set((dx / dist) * reach * 1.8);
      y.set((dy / dist) * reach * 1.3);
    };
    let timer = 0;
    let open = 0;
    const blink = () => {
      const g = blinkRef.current;
      if (g) {
        g.style.transform = "scaleY(0.1)";
        open = window.setTimeout(() => {
          g.style.transform = "";
        }, 120);
      }
      timer = window.setTimeout(blink, 2600 + Math.random() * 3400);
    };
    timer = window.setTimeout(blink, 1800);
    window.addEventListener("pointermove", onMove, { passive: true });
    const blinkEl = blinkRef.current;
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(open);
      if (blinkEl) blinkEl.style.transform = "";
      window.removeEventListener("pointermove", onMove);
    };
  }, [active, reduceMotion, coinRef, x, y]);

  return { look: { x, y }, blinkRef };
}

interface CoinProps {
  layoutId: string;
  seed: string;
  angle: MotionValue<number>;
  spinning: boolean;
  label: string;
  look: { x: MotionValue<number>; y: MotionValue<number> };
  blinkRef: RefObject<SVGGElement | null>;
  coinRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void;
}

function Coin({ layoutId, seed, angle, spinning, label, look, blinkRef, coinRef, ...handlers }: CoinProps) {
  const tilt = useTransform(angle, (a) => a - 180 * Math.round(a / 180));
  const transform = useTransform(tilt, (t) => `rotateY(${round2(t)}deg)`);
  const shade = useTransform(tilt, (t) => round2((Math.abs(t) / 90) * 0.35));

  return (
    <motion.div
      className="relative z-10 cursor-grab touch-pan-y select-none rounded-full active:cursor-grabbing"
      layoutId={layoutId}
      ref={coinRef}
      style={{ width: COIN, height: COIN, perspective: 600 }}
      transition={FLY}
      {...handlers}
    >
      <motion.div
        aria-label={label}
        className="relative h-full w-full"
        role="img"
        style={{ transform, transformStyle: "preserve-3d" }}
      >
        {[6, 5, 4, 3, 2, 1].map((z) => (
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-zinc-500"
            key={z}
            style={{ transform: `translateZ(-${z}px)` }}
          />
        ))}
        <div className="absolute inset-0 overflow-hidden rounded-full ring-2 ring-black/20 ring-inset">
          <MorphingFace blinkRef={blinkRef} look={look} morph={!spinning} seed={seed} />
          <motion.div aria-hidden="true" className="absolute inset-0 bg-black" style={{ opacity: shade }} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function useSpinner(onLand: (steps: number) => void) {
  const angle = useMotionValue(0);
  const [step, setStep] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const stepRef = useRef(0);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;

  useMotionValueEvent(angle, "change", (a) => {
    const s = Math.round(a / 180);
    if (s !== stepRef.current) {
      stepRef.current = s;
      setStep(s);
    }
  });

  const land = useCallback(() => {
    controls.current = null;
    const s = Math.round(angle.get() / 180);
    angle.jump(0);
    stepRef.current = 0;
    setStep(0);
    setSpinning(false);
    if (s !== 0) onLandRef.current(s);
  }, [angle]);

  const stop = useCallback(() => {
    controls.current?.stop();
    controls.current = null;
  }, []);

  const spinTo = useCallback(
    (steps: number, transition: { stiffness: number; damping: number; velocity: number }) => {
      stop();
      setSpinning(true);
      controls.current = animate(angle, steps * 180, {
        type: "spring",
        ...transition,
        restDelta: 0.5,
        restSpeed: 4,
        onComplete: land,
      });
    },
    [angle, land, stop]
  );

  const jumpBy = useCallback(
    (steps: number) => {
      stop();
      angle.jump(steps * 180);
      land();
    },
    [angle, land, stop]
  );

  return { angle, step, spinning, setSpinning, spinTo, jumpBy, stop, land };
}

type Spinner = ReturnType<typeof useSpinner>;

interface DragState {
  id: number;
  x: number;
  start: number;
  moved: boolean;
  samples: { x: number; t: number }[];
}

function releaseTarget(d: DragState, current: number, x: number, t: number) {
  const first = d.samples[0] ?? { x, t };
  const dt = Math.max(16, t - first.t) / 1000;
  const velocity = ((x - first.x) / dt) * DEG_PER_PX;
  const start = Math.round(d.start / 180);
  const projected = Math.round((current + velocity * 0.28) / 180);
  const target = Math.max(start - MAX_FLICK_STEPS, Math.min(start + MAX_FLICK_STEPS, projected));
  return { target, velocity };
}

function useDragSpin(spinner: Spinner, reduceMotion: boolean | null) {
  const drag = useRef<DragState | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    spinner.stop();
    spinner.setSpinning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, start: spinner.angle.get(), moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > TAP_SLOP) d.moved = true;
    spinner.angle.set(d.start + dx * DEG_PER_PX);
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const current = spinner.angle.get();
    const { target, velocity } = d.moved
      ? releaseTarget(d, current, e.clientX, e.timeStamp)
      : { target: Math.round(current / 180) + 1, velocity: 900 };
    if (reduceMotion) spinner.jumpBy(target);
    else spinner.spinTo(target, { ...DRAG_SPRING, velocity });
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}

/**
 * Avatar picker: faces are generated from the display name, morph live as it
 * is typed, and can be spun like a coin (drag, flick, tap or shuffle).
 */
export default function AvatarPicker({
  value,
  defaultValue,
  onChange,
  onComplete,
  name,
  title = "Chọn avatar của bạn",
  description = "Sinh từ tên bạn. Xoay đồng xu hoặc chọn một khuôn mặt.",
  submitLabel = "Tiếp tục",
  embedded = false,
  className,
}: AvatarPickerProps) {
  const uid = useId();
  const reduceMotion = useReducedMotion();
  const startVariant = defaultValue?.variant ?? 0;
  const [internalName, setInternalName] = useState(defaultValue?.displayName ?? "Kỳ Thủ");
  const [slots, setSlots] = useState(() => Array.from({ length: SLOT_COUNT }, (_, i) => startVariant + i * 7));
  const [selected, setSelected] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const displayName = value?.displayName ?? internalName;
  const variant = value?.variant ?? slots[selected] ?? 0;
  const latest = useRef({ displayName, variant, selected });
  latest.current = { displayName, variant, selected };

  const controlledVariant = value?.variant;
  useEffect(() => {
    if (controlledVariant === undefined) return;
    setSlots((prev) =>
      prev[selected] === controlledVariant ? prev : prev.map((v, i) => (i === selected ? controlledVariant : v))
    );
  }, [controlledVariant, selected]);

  const emit = (next: AvatarValue, announce: boolean) => {
    const seed = avatarSeed(next.displayName, next.variant);
    const face = createFace(seed);
    onChange?.({ ...next, seed, description: face.description });
    if (announce) setAnnouncement(`Avatar: ${face.description}`);
  };

  const spinner = useSpinner((steps) => {
    const { displayName: current, variant: from, selected: slot } = latest.current;
    const next = from + steps;
    setSlots((prev) => prev.map((v, i) => (i === slot ? next : v)));
    emit({ displayName: current, variant: next }, true);
  });
  const dragHandlers = useDragSpin(spinner, reduceMotion);
  const active = useInView(rootRef);
  const { look, blinkRef } = useLivingEyes(coinRef, active);

  const shownVariant = variant + spinner.step;
  const seed = avatarSeed(displayName || "Kỳ Thủ", shownVariant);

  const shuffle = () => {
    const current = Math.round(spinner.angle.get() / 180);
    const steps = 5 + Math.floor(Math.random() * 4);
    if (reduceMotion) {
      spinner.jumpBy(current + steps);
      return;
    }
    spinner.spinTo(current + steps, { ...SHUFFLE_SPRING, velocity: steps * 180 * 1.6 });
  };

  const choose = (index: number) => {
    if (index === selected) return;
    if (spinner.spinning) {
      spinner.stop();
      spinner.land();
    }
    setSelected(index);
    setFocusIndex(index);
    emit({ displayName: latest.current.displayName, variant: slots[index] ?? 0 }, true);
  };

  const onSlotKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: focusIndex + 1,
      ArrowDown: focusIndex + 1,
      ArrowLeft: focusIndex - 1,
      ArrowUp: focusIndex - 1,
      Home: 0,
      End: SLOT_COUNT - 1,
    };
    const target = moves[e.key];
    if (target === undefined) return;
    e.preventDefault();
    const next = (target + SLOT_COUNT) % SLOT_COUNT;
    setFocusIndex(next);
    slotRefs.current[next]?.focus();
  };

  const setName = (next: string) => {
    if (value === undefined) setInternalName(next);
    emit({ displayName: next, variant }, false);
  };

  const nameOk = displayName.trim().length >= MIN_NAME;
  const bezelRotate = useTransform(spinner.angle, (a) => `rotate(${round2(a / 15)}deg)`);
  const diceRotate = useTransform(spinner.angle, (a) => `rotate(${round2(a / 4)}deg)`);

  return (
    <AppMotionConfig>
      <div className={cn("mx-auto w-full max-w-[360px] text-white", className)} ref={rootRef}>
        {!embedded && (
          <div className="space-y-1">
            <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
            <p className="text-sm text-ink-300">{description}</p>
          </div>
        )}

        <LayoutGroup id={uid}>
          <div className={cn("flex flex-col items-center", !embedded && "mt-5")}>
            <div className="relative grid place-items-center" style={{ width: BEZEL, height: BEZEL }}>
              <motion.svg
                aria-hidden="true"
                className="absolute inset-0 text-ink-500"
                style={{ transform: bezelRotate }}
                viewBox={`0 0 ${BEZEL} ${BEZEL}`}
              >
                {TICK_LINES.map((t) => (
                  <line
                    key={t.key}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeOpacity={t.long ? 1 : 0.6}
                    strokeWidth={t.long ? 1.5 : 1}
                    x1={t.x1}
                    x2={t.x2}
                    y1={t.y1}
                    y2={t.y2}
                  />
                ))}
              </motion.svg>
              <div aria-hidden="true" className="absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-lime-400" />
              <Coin
                angle={spinner.angle}
                blinkRef={blinkRef}
                coinRef={coinRef}
                key={selected}
                label={`Avatar đã chọn: ${createFace(seed).description}`}
                layoutId={`face-${selected}`}
                look={look}
                seed={seed}
                spinning={spinner.spinning}
                {...dragHandlers}
              />
            </div>

            <div className="mt-2 flex items-baseline gap-2 text-xs">
              <span className="max-w-[180px] truncate font-semibold">{displayName.trim() || "Ẩn danh"}</span>
              <span className="font-mono tabular-nums text-ink-400">No. {pad3(shownVariant)}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div aria-label="Lựa chọn avatar" className="flex gap-2" role="toolbar">
              {slots.map((slotVariant, i) => {
                const isSelected = i === selected;
                const slotSeed = avatarSeed(displayName || "Kỳ Thủ", slotVariant);
                return (
                  <button
                    aria-label={`Lựa chọn ${i + 1}: ${createFace(slotSeed).description}`}
                    aria-pressed={isSelected}
                    className="group/slot relative size-10 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                    key={i}
                    onClick={() => choose(i)}
                    onFocus={() => setFocusIndex(i)}
                    onKeyDown={onSlotKeyDown}
                    ref={(el) => {
                      slotRefs.current[i] = el;
                    }}
                    tabIndex={i === focusIndex ? 0 : -1}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-0 rounded-full border transition-colors duration-150 ease-out",
                        isSelected ? "border-dashed border-lime-400/60 bg-ink-800" : "border-transparent"
                      )}
                    />
                    {isSelected ? (
                      <span aria-hidden="true" className="absolute inset-0 m-auto size-1.5 rounded-full bg-lime-400" />
                    ) : (
                      <motion.span
                        className="absolute inset-0 overflow-hidden rounded-full ring-1 ring-inset ring-black/10 transition-shadow duration-150 ease-out group-hover/slot:shadow-[0_0_0_2px_#d4ff3a]"
                        layoutId={`face-${i}`}
                        transition={FLY}
                      >
                        <MorphingFace seed={slotSeed} />
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              aria-label="Xáo trộn avatar"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ink-200 outline-none transition-colors duration-150 ease-out hover:bg-lime-400 hover:text-black focus-visible:ring-2 focus-visible:ring-lime-400"
              onClick={shuffle}
              title="Xáo trộn"
              type="button"
            >
              <motion.span className="grid place-items-center" style={{ transform: diceRotate }}>
                <Dices aria-hidden="true" className="size-4" />
              </motion.span>
            </button>
          </div>
        </LayoutGroup>

        {!embedded && (
          <>
            <div className="mt-5 space-y-2">
              <label className="label" htmlFor={`${uid}-display-name`}>
                Tên hiển thị
              </label>
              <input
                autoComplete="nickname"
                className="field"
                id={`${uid}-display-name`}
                maxLength={32}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên của bạn"
                spellCheck={false}
                type="text"
                value={displayName}
              />
            </div>
            <button
              className="btn-lime mt-4 w-full"
              disabled={!nameOk}
              onClick={() => onComplete?.({ displayName: displayName.trim(), variant, seed: avatarSeed(displayName, variant) })}
              type="button"
            >
              {submitLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </>
        )}

        {name ? <input name={name} type="hidden" value={avatarSeed(displayName, variant)} /> : null}

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    </AppMotionConfig>
  );
}
