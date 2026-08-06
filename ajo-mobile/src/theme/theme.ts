/**
 * Design tokens — Ajo Mobile
 * ----------------------------
 * This is the member-facing app — people checking their savings group,
 * funding their wallet, and watching a payout land. Warmer and more
 * inviting than the admin console (ajo-admin-web's ink-navy/gold ops
 * tool aesthetic): a warm cream canvas, a deep terracotta/clay primary
 * (evoking the "ajo pot" — physical thrift collection — without being
 * literal), and a confident, optimistic accent for money-positive
 * moments (funded, paid, collected).
 */

export const colors = {
  canvas: "#FBF6EF", // warm cream background
  surface: "#FFFFFF", // cards
  surfaceSunken: "#F3ECE0", // input backgrounds, subtle wells

  ink: "#221A14", // primary text
  inkSoft: "#71655A", // secondary text
  inkFaint: "#A89C8E", // placeholder/disabled text

  line: "#E8DDCC", // hairline borders

  primary: "#B4502C", // clay/terracotta — primary actions
  primarySoft: "#F3DFD2", // primary-tinted backgrounds

  accent: "#C9961E", // gold — same family as admin-web, money/payout highlight
  accentSoft: "#F6E9C7",

  success: "#3E7D52",
  successSoft: "#DEEFE2",
  danger: "#B33B3B",
  dangerSoft: "#F6DEDE",
  warning: "#B5791E",
  warningSoft: "#F6E7CD",

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
  sizes: {
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
