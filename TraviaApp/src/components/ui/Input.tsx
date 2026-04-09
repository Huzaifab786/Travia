import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  Animated,
} from "react-native";
import { useTheme } from "../../app/providers/ThemeProvider";
import { spacing, radius, typography } from "../../config/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
}

export function Input({
  label,
  error,
  success,
  leftIcon,
  rightIcon,
  containerStyle,
  labelStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return theme.danger;
    if (success) return theme.success;
    if (isFocused) return theme.primary;
    return theme.border;
  };

  const getBackgroundColor = () => {
    if (isFocused) {
      return isDark ? theme.surfaceElevated : theme.surface;
    }
    return theme.surface;
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: spacing.md,
      width: "100%",
    },
    label: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      fontSize: 12,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: isFocused ? 2 : 1,
      borderColor: getBorderColor(),
      borderRadius: radius.lg,
      backgroundColor: getBackgroundColor(),
      paddingHorizontal: spacing.md,
      minHeight: 56, // Premium taller input
      shadowColor: isFocused ? theme.primary : "transparent",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isFocused ? 0.15 : 0,
      shadowRadius: 12,
      elevation: isFocused ? 4 : 0,
    },
    input: {
      flex: 1,
      ...typography.bodyMedium,
      color: theme.textPrimary,
      paddingVertical: spacing.sm,
      marginLeft: leftIcon ? spacing.sm : 0,
      marginRight: rightIcon ? spacing.sm : 0,
      fontSize: 16,
    },
    errorText: {
      ...typography.caption,
      color: theme.danger,
      marginTop: spacing.xs,
      marginLeft: spacing.xs,
    },
    successText: {
      ...typography.caption,
      color: theme.success,
      marginTop: spacing.xs,
      marginLeft: spacing.xs,
    },
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      <View style={styles.inputWrapper}>
        {leftIcon}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={theme.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightIcon}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {success && !error && <Text style={styles.successText}>✓ Valid</Text>}
    </View>
  );
}