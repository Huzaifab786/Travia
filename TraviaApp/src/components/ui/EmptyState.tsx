import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../app/providers/ThemeProvider";
import { spacing, typography } from "../../config/theme";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  buttonTitle?: string;
  onButtonPress?: () => void;
}

export function EmptyState({
  title,
  description,
  icon,
  buttonTitle,
  onButtonPress,
}: EmptyStateProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
      gap: spacing.md,
    },
    title: {
      ...typography.h3,
      color: theme.textPrimary,
      textAlign: "center",
    },
    description: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {buttonTitle && onButtonPress && (
        <Button title={buttonTitle} onPress={onButtonPress} variant="solid" size="md" />
      )}
    </View>
  );
}