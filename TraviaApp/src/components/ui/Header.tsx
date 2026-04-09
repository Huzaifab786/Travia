import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../app/providers/ThemeProvider";
import { spacing, typography } from "../../config/theme";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightIcon?: React.ReactNode;
  onRightPress?: () => void;
  transparent?: boolean;
}

export function Header({
  title,
  showBack = false,
  rightIcon,
  onRightPress,
  transparent = false,
}: HeaderProps) {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();

  const styles = StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: Platform.OS === "ios" ? spacing.xl : StatusBar.currentHeight! + spacing.sm,
      paddingBottom: spacing.md,
      backgroundColor: transparent ? "transparent" : theme.background,
      borderBottomWidth: transparent ? 0 : 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: spacing.sm,
      marginLeft: -spacing.sm,
    },
    title: {
      ...typography.h3,
      color: theme.textPrimary,
      textAlign: "center",
      flex: 1,
    },
    rightButton: {
      padding: spacing.sm,
      marginRight: -spacing.sm,
    },
    placeholder: {
      width: 40,
    },
  });

  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {rightIcon ? (
        <Pressable onPress={onRightPress} style={styles.rightButton}>
          {rightIcon}
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}