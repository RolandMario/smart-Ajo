import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../theme";

interface PotMarkProps {
  size?: number;
}

/**
 * The "ajo pot" brand mark: an open pot with a swinging handle and a gold
 * coin waiting at the bottom, drawn to match the welcome-screen design.
 * Pure vector (react-native-svg) so it stays crisp at any size and can be
 * reused by future forest-surface screens. Decorative — always pair it
 * with meaningful copy.
 */
export function PotMark({ size = 56 }: PotMarkProps) {
  const height = Math.round(size * (25 / 24));

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={height} viewBox="0 0 24 25">
        {/* Gold coin sitting in the pot */}
        <Circle cx={12} cy={15.2} r={1.7} fill={colors.gold} />

        {/* Pot body — slight bulge below the rim, tapering to a round base */}
        <Path
          d="M 4.8 8.2 C 4.6 12.5, 5.8 18.5, 7.0 21.4 Q 7.6 22.4 8.6 22.4 L 15.4 22.4 Q 16.4 22.4 17.0 21.4 C 18.2 18.5, 19.4 12.5, 19.2 8.2"
          fill="none"
          stroke={colors.onForest}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Rim — wider than the mouth, like a metal pot rim */}
        <Path
          d="M 3.9 7 L 20.1 7"
          fill="none"
          stroke={colors.onForest}
          strokeWidth={2.2}
          strokeLinecap="round"
        />

        {/* Swinging handle */}
        <Path
          d="M 7.2 6.6 A 4.8 4.8 0 0 1 16.8 6.6"
          fill="none"
          stroke={colors.onForest}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}