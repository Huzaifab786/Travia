import React from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useTheme } from "../../app/providers/ThemeProvider";
import { spacing, typography } from "../../config/theme";

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
  size?: "small" | "large";
}

export function LoadingSpinner({
  fullScreen = false,
  message,
  size = "large",
}: LoadingSpinnerProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: fullScreen ? 1 : undefined,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    message: {
      ...typography.body,
      color: theme.textSecondary,
      marginTop: spacing.md,
    },
  });

  return (
    <View style={[styles.container, fullScreen && { flex: 1 }]}>
      <ActivityIndicator size={size} color={theme.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}