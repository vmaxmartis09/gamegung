import type { Config } from "tailwindcss";

/**
 * Design tokens — "private members' lounge".
 * Warm charcoal surfaces, one champagne accent, ivory text, muted status hues.
 *
 * Legacy names (`pop.*`, `lime`, `shadow-brutal`, bold/extrabold/black weights, large radii)
 * are kept as aliases and remapped to the calmer values below so existing screens keep
 * working while they are migrated phase by phase. Do not use them in new code.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        caption: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
        "display-md": ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "-0.01em" }],
        "display-lg": ["2.5rem", { lineHeight: "2.75rem", letterSpacing: "-0.015em" }],
        "display-xl": ["3.5rem", { lineHeight: "3.75rem", letterSpacing: "-0.02em" }],
        "display-2xl": ["4.5rem", { lineHeight: "4.5rem", letterSpacing: "-0.025em" }],
      },
      // Calmer weights: "bold" and "extrabold" both resolve to semibold, "black" to bold.
      fontWeight: {
        bold: "600",
        extrabold: "600",
        black: "700",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Pure luxury monochrome scale (950 darkest → 100 lightest)
        ink: {
          950: "#050505",
          900: "#0c0c0c",
          850: "#141414",
          800: "#1a1a1a",
          700: "#262626",
          600: "#3d3d3d",
          500: "#737373",
          400: "#a3a3a3",
          300: "#d4d4d4",
          200: "#ebebeb",
          100: "#ffffff",
        },
        // Crisp white / silver accent
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          soft: "var(--accent-soft)",
          300: "#ffffff",
          400: "#f5f5f5",
          500: "#e5e5e5",
          600: "#a3a3a3",
          700: "#737373",
        },
        // Semantic status hues: clear but not neon
        success: { DEFAULT: "#34d399", soft: "rgba(52, 211, 153, 0.14)" },
        warning: { DEFAULT: "#f5b544", soft: "rgba(245, 181, 68, 0.14)" },
        danger: { DEFAULT: "#ef5350", soft: "rgba(239, 83, 80, 0.15)" },
        info: { DEFAULT: "#6aa4ff", soft: "rgba(106, 164, 255, 0.14)" },
        border: "hsl(var(--border))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          50: "#171717",
          100: "#121212",
          200: "#0e0e0e",
          300: "#0a0a0a",
          400: "#060606",
          500: "#000000",
        },
        pop: {
          violet: "#ffffff",
          pink: "#d4d4d4",
          cyan: "#a3a3a3",
          orange: "#e5e5e5",
          yellow: "#f5f5f5",
          red: "#ffffff",
          green: "#ffffff",
        },
        lime: {
          DEFAULT: "#ffffff",
          300: "#ffffff",
          400: "#f5f5f5",
          500: "#d4d4d4",
        },
      },
      // Tighter radius scale: md 6px · xl 10px · 2xl 14px · 3xl 18px · 4xl 24px.
      borderRadius: {
        xl: "0.625rem",
        "2xl": "0.875rem",
        "3xl": "1.125rem",
        "4xl": "1.5rem",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "0 24px 60px -24px rgba(0,0,0,0.85)",
        elevated: "0 1px 0 rgba(255,255,255,0.05) inset, 0 32px 80px -32px rgba(0,0,0,0.9)",
        hairline: "0 0 0 1px var(--hairline)",
        "focus-accent": "0 0 0 3px var(--accent-soft)",
        /** @deprecated use soft / lift. */
        brutal: "0 10px 24px -12px rgba(0,0,0,0.8)",
        "brutal-sm": "0 6px 14px -8px rgba(0,0,0,0.8)",
      },
      transitionTimingFunction: {
        // Quick start, long settle — the house easing for entrances and hovers.
        lounge: "cubic-bezier(0.22, 1, 0.36, 1)",
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
        "fade-up": "fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.2s cubic-bezier(0.2, 0, 0, 1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        "aurora-a": "aurora-a 28s ease-in-out infinite alternate",
        "aurora-b": "aurora-b 34s ease-in-out infinite alternate",
        "piece-slide": "piece-slide 170ms cubic-bezier(0.22, 1, 0.36, 1)",
        skeleton: "skeleton 1.8s ease-in-out infinite",
      },
      keyframes: {
        "aurora-a": {
          from: { transform: "translate3d(-8%, -4%, 0) scale(1)" },
          to: { transform: "translate3d(10%, 6%, 0) scale(1.15)" },
        },
        "aurora-b": {
          from: { transform: "translate3d(8%, 2%, 0) scale(1.1)" },
          to: { transform: "translate3d(-10%, -6%, 0) scale(0.95)" },
        },
        shimmer: {
          from: { backgroundPosition: "0 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "border-beam": {
          "100%": {
            "offset-distance": "100%",
          },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.98)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "piece-slide": {
          from: { transform: "translate(var(--dx), var(--dy))" },
          to: { transform: "translate(0, 0)" },
        },
        skeleton: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
