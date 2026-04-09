import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthNavigator";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { LinearGradient } from "expo-linear-gradient";

export function RoleSelectScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [role, setRole] = useState<"passenger" | "driver">("passenger");

  const s = makeStyles(theme, isDark);

  const gradientColors = isDark
    ? (["#243c32", "#0c1e16", "#040c08"] as const)
    : (["#d1fae5", "#ecfdf5", "#f8fafc"] as const);

  return (
    <LinearGradient colors={gradientColors} style={s.gradientBackground}>
      <SafeAreaView style={s.safeArea}>
        {/* Top Header */}
        <View style={s.topHeader}>
          <Text style={s.topHeaderText}>TRAVIA</Text>
        </View>

        <View style={s.container}>
          {/* Watermark */}
          <View style={s.watermarkContainer}>
            <Text style={s.watermarkText}>TRV</Text>
          </View>

          <View style={s.header}>
            <Text style={s.welcomeText}>Welcome to</Text>
            <Text style={s.title}>TRAVIA</Text>
            <Text style={s.subtitle}>
              Luxury defined by movement. Choose your path through the emerald gallery of modern mobility.
            </Text>
          </View>

          <View style={s.cardsContainer}>
            <Pressable
              onPress={() => setRole("passenger")}
              style={[s.card, role === "passenger" ? s.cardActive : s.cardInactive]}
            >
              <View style={[s.iconContainer, role === "passenger" ? s.iconActive : s.iconInactive]}>
                <Ionicons 
                  name="person" 
                  size={20} 
                  color={role === "passenger" ? (isDark ? theme.textInverse : theme.surface) : theme.primary} 
                />
              </View>
              <View style={s.cardText}>
                <Text style={[s.cardTitle, role === "passenger" ? s.textActive : s.textInactive]}>
                  Passenger
                </Text>
                <Text style={[s.cardDesc, role === "passenger" ? s.textActiveMuted : s.textInactiveMuted]}>
                  Experience the art of being driven.
                </Text>
              </View>
              <Ionicons 
                name={role === "passenger" ? "radio-button-on" : "ellipse-outline"} 
                size={28} 
                color={role === "passenger" ? (isDark ? theme.textInverse : theme.surface) : theme.primary} 
              />
            </Pressable>

            <Pressable
              onPress={() => setRole("driver")}
              style={[s.card, role === "driver" ? s.cardActive : s.cardInactive]}
            >
              <View style={[s.iconContainer, role === "driver" ? s.iconActive : s.iconInactive]}>
                <Ionicons 
                  name="car" 
                  size={24} 
                  color={role === "driver" ? (isDark ? theme.textInverse : theme.surface) : theme.primary} 
                />
              </View>
              <View style={s.cardText}>
                <Text style={[s.cardTitle, role === "driver" ? s.textActive : s.textInactive]}>
                  Driver
                </Text>
                <Text style={[s.cardDesc, role === "driver" ? s.textActiveMuted : s.textInactiveMuted]}>
                  Take command of the verdant road.
                </Text>
              </View>
              <Ionicons 
                name={role === "driver" ? "radio-button-on" : "ellipse-outline"} 
                size={28} 
                color={role === "driver" ? (isDark ? theme.textInverse : theme.surface) : theme.primary} 
              />
            </Pressable>
          </View>

          <Pressable
            onPress={() => navigation.navigate("Login", { role })}
            style={s.continueButton}
          >
            <Text style={s.continueText}>CONTINUE</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Pressable 
          style={s.footerContainer}
          onPress={() => navigation.navigate("Register", { role })}
        >
          <Text style={s.footerText}>
            NEW TO THE GALLERY? <Text style={s.footerTextBold}>JOIN NOW</Text>
          </Text>
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(theme: any, isDark: boolean) {
  return StyleSheet.create({
    gradientBackground: {
      flex: 1,
    },
    safeArea: { flex: 1 },
    topHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      marginBottom: spacing.md,
    },
    topHeaderText: {
      color: theme.textPrimary,
      opacity: isDark ? 0.8 : 0.6,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    container: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "center" },
    watermarkContainer: {
      position: "absolute",
      top: -20,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: -1,
    },
    watermarkText: {
      fontSize: 140,
      fontWeight: "900",
      color: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(4, 120, 87, 0.04)",
      letterSpacing: 4,
    },
    header: { marginBottom: spacing["3xl"], marginTop: 20 },
    welcomeText: { ...typography.h1, color: theme.textPrimary },
    title: { ...typography.hero, fontSize: 44, color: theme.textPrimary, marginBottom: spacing.md },
    subtitle: { 
      ...typography.bodyMedium, 
      color: theme.textSecondary, 
      opacity: isDark ? 0.9 : 1,
      lineHeight: 22,
    },
    cardsContainer: { gap: spacing.md },
    card: {
      flexDirection: "row", alignItems: "center", padding: spacing.md, paddingVertical: spacing.md,
      borderRadius: radius.full, 
    },
    cardInactive: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.6)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.9)",
    },
    cardActive: { 
      backgroundColor: isDark ? "#FFFFFF" : theme.primary,
      borderWidth: 1,
      borderColor: isDark ? "#FFFFFF" : theme.primary,
      shadowColor: isDark ? "#FFFFFF" : theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    iconContainer: { 
      width: 48, height: 48, borderRadius: radius.full, 
      alignItems: "center", justifyContent: "center", marginRight: spacing.md 
    },
    iconInactive: { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(4, 120, 87, 0.1)" },
    iconActive: { backgroundColor: isDark ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.2)" },
    cardText: { flex: 1 },
    cardTitle: { ...typography.h3, marginBottom: 2 },
    cardDesc: { ...typography.captionMedium },
    textInactive: { color: isDark ? "#FFFFFF" : theme.textPrimary },
    textInactiveMuted: { color: isDark ? "rgba(255,255,255,0.7)" : theme.textMuted },
    textActive: { color: isDark ? "#0F172A" : "#FFFFFF" },
    textActiveMuted: { color: isDark ? "#334155" : "rgba(255,255,255,0.8)" },
    continueButton: {
      marginTop: spacing["3xl"],
      backgroundColor: isDark ? "#FFFFFF" : theme.primary,
      borderRadius: radius.full,
      minHeight: 56,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: isDark ? "#000" : theme.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    continueText: {
      color: isDark ? theme.background : "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 2,
    },
    footerContainer: {
      paddingVertical: spacing.xl,
      alignItems: "center",
    },
    footerText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    footerTextBold: {
      color: isDark ? theme.primaryLight : theme.primary,
      fontWeight: "800",
      letterSpacing: 0.5,
    }
  });
}
