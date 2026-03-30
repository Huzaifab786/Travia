import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../app/providers/ThemeProvider";
import { radius } from "../../config/theme";

interface SkeletonProps {
  width?: any;
  height?: any;
  variant?: "rect" | "circle" | "rounded";
  style?: ViewStyle;
}

export function Skeleton({ width, height, variant = "rect", style }: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const borderRadius =
    variant === "circle"
      ? typeof height === "number"
        ? height / 2
        : 999
      : variant === "rounded"
      ? radius.md
      : 0;

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.surfaceElevated || theme.border,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}
