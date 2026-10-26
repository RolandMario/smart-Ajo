import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button } from "../../components/Button";
import { PotMark } from "../../components/PotMark";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

/**
 * First branded surface of the app: a full-bleed forest-green welcome
 * screen shown after the splash. Follows the approved dark-palette design —
 * serif headline, "ajo pot" mark with a gold coin, gold primary CTA and an
 * outlined secondary CTA. This screen introduces the `forest*`/`gold*`
 * theme tokens that later screens will share.
 */
export function WelcomeScreen({ navigation }: Props) {
  // Lazy-initialised so the Animated.Value is created exactly once without a
  // ref read during render (react-hooks/refs clean).
  const [entry] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 900,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry]);

  const animatedStyle = {
    opacity: entry,
    transform: [
      {
        translateY: entry.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
      {
        scale: entry.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Animated.View style={[styles.hero, animatedStyle]}>
          <PotMark size={60} />

          <Text style={styles.headline}>{"Save with\npeople you\ntrust."}</Text>

          <Text style={styles.body}>
            {"Contribute with your circle each round. One member collects the full pot — then it's the next person's turn."}
          </Text>
        </Animated.View>

        <View style={styles.actions}>
          <Button
            title="Create account"
            variant="gold"
            onPress={() => navigation.navigate("Register")}
          />
          <Button
            title="Sign in"
            variant="outline"
            onPress={() => navigation.navigate("PhoneEntry")}
          />
          <Text style={styles.finePrint}>
            Licensed money service · Deposits protected
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.forest,
  },
  safe: {
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  headline: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.display,
    lineHeight: 44,
    fontWeight: typography.weights.semibold,
    color: colors.onForest,
    textAlign: "center",
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  body: {
    maxWidth: 320,
    alignSelf: "center",
    fontSize: typography.sizes.base,
    lineHeight: 25,
    color: colors.onForestMuted,
    textAlign: "center",
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  finePrint: {
    marginTop: spacing.md,
    textAlign: "center",
    fontSize: typography.sizes.xs,
    color: colors.onForestFaint,
    letterSpacing: 0.2,
  },
});