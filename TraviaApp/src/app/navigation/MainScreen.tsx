import React, { useContext } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { AuthContext } from "../providers/AuthProvider";
import { useTheme } from "../providers/ThemeProvider";
import { spacing, radius, typography } from "../../config/theme";

export function MainScreen() {
  const { setToken } = useContext(AuthContext);
  const { theme } = useTheme();

  const onLogout = async () => {
    await setToken(null);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.lg,
      justifyContent: "center",
      gap: spacing.md,
      backgroundColor: theme.background,
    },
    title: {
      ...typography.h1,
      color: theme.textPrimary,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: spacing.xl,
    },
    logoutButton: {
      backgroundColor: theme.danger,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      alignItems: "center",
      marginTop: spacing.xl,
    },
    logoutText: {
      ...typography.bodySemiBold,
      color: theme.textInverse,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back! ✅</Text>
      <Text style={styles.subtitle}>You are successfully logged in to Travia.</Text>

      <Pressable onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}