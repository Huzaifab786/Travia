import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../app/providers/ThemeProvider";

interface GradientBackgroundProps {
  children: React.ReactNode;
  colors?: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle;
}

export function GradientBackground({
  children,
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
}: GradientBackgroundProps) {
  const { theme, isDark } = useTheme();

  const defaultColors = colors ?? [
    isDark ? theme.primarySubtle : theme.primaryLight,
    isDark ? theme.background : theme.background,
  ] as const;

  return (
    <LinearGradient colors={defaultColors} start={start} end={end} style={[styles.container, style]}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
