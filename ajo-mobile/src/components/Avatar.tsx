import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, typography } from "../theme";
import { initials } from "../utils/names";

/** Soft chip tones used across the redesigned screens. */
export type AvatarTone = "gold" | "green" | "forest";

interface AvatarProps {
  name?: string | null;
  tone?: AvatarTone;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const TONES: Record<
  AvatarTone,
  { background: string; foreground: string; serif: boolean }
> = {
  gold: { background: colors.goldSoft, foreground: colors.gold, serif: false },
  green: {
    background: colors.forestLightPill,
    foreground: colors.forestAction,
    serif: false,
  },
  forest: { background: colors.forest, foreground: colors.white, serif: true },
};

/**
 * Initials chip used for member avatars on the light forest surface. `gold`
 * and `green` are soft tinted chips (gold/green initials on translucent gold
 * or pale-green fills); `forest` is the solid dark-green chip with serif
 * initials used by the wallet home greeting.
 */
export function Avatar({
  name,
  tone = "green",
  size = 40,
  style,
}: AvatarProps) {
  const tint = TONES[tone];
  const fontSize = Math.max(12, Math.round(size * 0.4));

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size / 2),
          backgroundColor: tint.background,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initial,
          { fontSize, color: tint.foreground },
          tint.serif && styles.initialSerif,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontWeight: typography.weights.semibold,
  },
  initialSerif: {
    fontFamily: typography.fontFamilies.serif,
  },
});