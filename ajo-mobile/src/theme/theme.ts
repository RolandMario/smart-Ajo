import { Platform } from "react-native";

/**
 * Design tokens — Ajo Mobile
 * ----------------------------
 * This is the member-facing app — people checking their savings group,
 * funding their wallet, and watching a payout land. The whole app runs on
 * one brand surface — the forest "green & white" theme: a pale green
 * canvas (`forestLightCanvas`) carrying white cards, deep-green
 * `forestAction` CTAs and gold `gold` accents for money-positive moments
 * (funded, paid, collected). Hero surfaces (welcome, cycle banners) go
 * full-bleed `forest` with `onForest*` text. The original warm-cream /
 * clay-terracotta palette was removed along with the last screen
 * migration, so the legacy `canvas/ink/primary/accent` tokens are gone.
 */

export const colors = {
  success: "#3E7D52",
  successSoft: "#DEEFE2",
  danger: "#B33B3B",
  dangerSoft: "#F6DEDE",
  warning: "#B5791E",
  warningSoft: "#F6E7CD",

  // --- Deep-green brand surface -------------------------------------
  // Full-bleed forest green used by hero surfaces (welcome screen, cycle
  // banners) on top of the app-wide light forest ground.
  forest: "#0E3A2B",
  forestDeep: "#0A2E22", // pressed states / gradient floor
  onForest: "#FBF6EF", // headline + primary text (warm cream)
  onForestMuted: "rgba(251,246,239,0.72)", // body copy
  onForestFaint: "rgba(251,246,239,0.45)", // microcopy / legal line
  forestLine: "rgba(251,246,239,0.30)", // hairlines and outline buttons
  onForestTranslucent: "rgba(251,246,239,0.12)", // soft fills for buttons sitting on the forest surface

  // --- Forest brand on a light ground --------------------------------
  // The app-wide canvas: the same forest brand on a pale, faintly green
  // ground instead of the full-bleed dark green of the hero surfaces.
  // `forestAction` is the green that reads correctly on a light
  // background; the dark `forest` fill stays reserved for hero surfaces.
  forestLightCanvas: "#F7F8F3", // page background
  forestLightField: "#EDF3EE", // input fill — a whisper of green
  forestLightLine: "#D8E3DB", // input + outline-button hairline
  forestLightInk: "#12211A", // headline, field values
  forestLightInkSoft: "#4D574F", // field labels, body copy
  forestLightInkFaint: "#8B928B", // subtitles, placeholders, fine print
  forestAction: "#157A4A", // filled CTA + inline links on light surfaces

  // --- Forest-tinted surfaces on the light ground --------------------
  // A few faintly-green surfaces layered on top of `forestLightCanvas`:
  // stat cards, status pills, progress tracks, tinted option selections.
  // Distinct from `forestLightField` (which is an *input* fill) because
  // these read as tinted cards rather than wells, and collapse to one
  // another visually if reused.
  forestLightCard: "#F2F8F3", // stat-card fill
  forestLightPill: "#DDEDE3", // verification pill fill
  forestTrack: "#D9E6DE", // progress-bar track (unfilled portion)

  // --- Gold action on the forest surface ----------------------------
  gold: "#C08A2E",
  goldPressed: "#AC7A26",
  goldSoft: "rgba(192,138,46,0.18)",
  onGold: "#221A14", // label sitting on `gold`

  white: "#FFFFFF",
  black: "#000000",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  // React Native doesn't ship custom fonts without a font-loading step
  // (expo-font + asset bundling). Using system fonts keeps Sub-phase A
  // dependency-light; swapping in a custom display face later is a
  // contained change to this file plus an expo-font load call in
  // App.tsx — see README.
  fontFamily: undefined, // system default
  /**
   * Display faces. The brand headline is a transitional serif; until a
   * bundled face is licensed + loaded through expo-font, each platform's
   * system serif stands in — swap the two string values here to adopt a
   * custom face everywhere it's used.
   */
  fontFamilies: {
    sans: undefined as string | undefined, // system default
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" }),
  },
  sizes: {
    display: 36, // welcome-screen headline
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 34,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  typography,
} as const;

export type Theme = typeof theme;
