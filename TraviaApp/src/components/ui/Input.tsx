import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
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

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: theme.textSecondary }, labelStyle]}>{label}</Text>}
      <View 
        style={[
          styles.inputWrapper, 
          { 
            borderColor: getBorderColor(),
            backgroundColor: getBackgroundColor(),
            shadowColor: isFocused ? theme.primary : 'transparent',
            shadowOpacity: isFocused ? 0.15 : 0,
            elevation: isFocused ? 4 : 0,
          }
        ]}
      >
        {leftIcon}
        <TextInput
          style={[styles.input, { color: theme.textPrimary, marginLeft: leftIcon ? spacing.sm : 0, marginRight: rightIcon ? spacing.sm : 0 }, style]}
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
      {error && <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>}
      {success && !error && <Text style={[styles.successText, { color: theme.success }]}>✓ Valid</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    width: "100%",
  },
  label: {
    ...typography.captionMedium,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  input: {
    flex: 1,
    ...typography.bodyMedium,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  errorText: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  successText: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});