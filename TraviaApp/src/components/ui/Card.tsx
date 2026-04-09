import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../app/providers/ThemeProvider";
import { spacing, radius } from "../../config/theme";

interface CardProps {
  children: React.ReactNode;
  elevated?: boolean;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, elevated = false, style, onPress }: CardProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    card: {
      backgroundColor: elevated ? theme.surfaceElevated : theme.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      ...(elevated && {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      }),
    },
  });

  if (onPress) {
    // Use TouchableOpacity if pressable
    const { TouchableOpacity } = require("react-native");
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[styles.card, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}