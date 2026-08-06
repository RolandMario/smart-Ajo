import React from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, spacing, typography } from "../theme";
import type { AuthStackParamList } from "../navigation/types";

type SplashScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, "Splash">;

interface SplashScreenProps {
  navigation: SplashScreenNavigationProp;
}

export function SplashScreen({ navigation }: SplashScreenProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.85)).current;

  React.useEffect(() => {
    // Fade in and zoom in animation over 3 seconds
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to PhoneEntry screen after 10 seconds
    const timer = setTimeout(() => {
      navigation.replace("PhoneEntry");
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo Container */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>A</Text>
          </View>
        </View>

        {/* App Name */}
        <Text style={styles.appName}>Sm@rtAjo</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Save Together, Grow Together</Text>

        {/* Decorative Elements */}
        <View style={styles.decorativeLine} />
      </Animated.View>

      {/* Version or Loading Indicator */}
      <View style={styles.footer}>
        <Text style={styles.versionText}>Digital Thrift Collection</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 64,
    fontWeight: typography.weights.bold,
    color: colors.white,
    lineHeight: 72,
  },
  appName: {
    fontSize: typography.sizes.xxxl + 8,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
    textAlign: "center",
    paddingHorizontal: spacing.xxl,
  },
  decorativeLine: {
    width: 60,
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginTop: spacing.md,
  },
  footer: {
    position: "absolute",
    bottom: spacing.xxxl,
    alignItems: "center",
  },
  versionText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
    color: colors.inkFaint,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});