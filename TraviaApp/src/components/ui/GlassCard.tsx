import React from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../../app/providers/ThemeProvider";
import { spacing, radius } from "../../config/theme";

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  style?: ViewStyle;
}

export function GlassCard({
  children,
  intensity = 70,
  tint = "light",
  style,
}: GlassCardProps) {
  const { theme, isDark } = useTheme();
  const effectiveTint = tint === "default" ? (isDark ? "dark" : "light") : tint;

  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={intensity}
        tint={effectiveTint}
        style={[
          {
            borderRadius: radius.lg,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
          },
          style,
        ]}
      >
        <View style={{ padding: spacing.lg }}>{children}</View>
      </BlurView>
    );
  }

  // Android fallback – semi-transparent background with elevation
  const styles = StyleSheet.create({
    glass: {
      backgroundColor: isDark
        ? "rgba(30, 41, 59, 0.8)"
        : "rgba(255, 255, 255, 0.8)",
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
  });

  return <View style={[styles.glass, style]}>{children}</View>;
}