import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from "react-native";
import { useTheme } from "../../app/providers/ThemeProvider";
import { spacing, radius, typography } from "../../config/theme";

type ButtonVariant = "solid" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = "solid",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const { theme } = useTheme();

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case "solid":
        return {
          backgroundColor: disabled ? theme.surfaceElevated : theme.primary,
          borderWidth: 0,
          ...(disabled ? {} : {
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }),
        };
      case "outline":
        return {
          backgroundColor: "transparent",
          borderWidth: 2,
          borderColor: disabled ? theme.border : theme.primary,
        };
      case "ghost":
        return {
          backgroundColor: "transparent",
          borderWidth: 0,
        };
      default:
        return {};
    }
  };

  const getTextVariantStyles = (): TextStyle => {
    switch (variant) {
      case "solid":
        // Using a highly legible color based on standard Emerald background
        return { color: disabled ? theme.textMuted : "#FFFFFF" };
      case "outline":
      case "ghost":
        return { color: disabled ? theme.textMuted : theme.primary };
      default:
        return {};
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case "sm":
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          minHeight: 44,
        };
      case "md":
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          minHeight: 52,
        };
      case "lg":
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          minHeight: 56,
        };
      default:
        return {};
    }
  };

  const getTextSize = (): TextStyle => {
    switch (size) {
      case "sm":
        return { ...typography.bodyMedium, fontSize: 14 };
      case "md":
        return { ...typography.bodySemiBold, fontSize: 16 };
      case "lg":
        return { ...typography.bodySemiBold, fontSize: 18 };
      default:
        return typography.bodyMedium;
    }
  };

  const styles = StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.lg,
      gap: spacing.sm,
      opacity: disabled && !loading ? 0.7 : 1,
    },
    fullWidth: {
      width: "100%",
    },
    text: {
      textAlign: "center",
      letterSpacing: 0.3,
    },
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        pressed && !disabled && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "solid"
              ? "#FFFFFF"
              : theme.primary
          }
        />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.text,
              getTextVariantStyles(),
              getTextSize(),
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}