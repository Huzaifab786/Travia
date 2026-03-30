import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthNavigator";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

export function RoleSelectScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [role, setRole] = useState<"passenger" | "driver">("passenger");

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>
            Welcome to <Text style={s.brand}>TRAVIA</Text>
          </Text>
          <Text style={s.subtitle}>Choose how you want to continue</Text>
        </View>

        <View style={s.cardsContainer}>
          <Pressable
            onPress={() => setRole("passenger")}
            style={[s.card, role === "passenger" && s.cardActive]}
          >
            <View style={[s.iconContainer, role === "passenger" ? s.iconActive : s.iconInactive]}>
              <Ionicons name="person" size={28} color={role === "passenger" ? "#fff" : theme.primary} />
            </View>
            <View style={s.cardText}>
              <Text style={[s.cardTitle, role === "passenger" && s.textWhite]}>Passenger</Text>
              <Text style={[s.cardDesc, role === "passenger" ? s.textLightBlue : s.textGray]}>Book safe & shared rides</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setRole("driver")}
            style={[s.card, role === "driver" && s.cardActive]}
          >
            <View style={[s.iconContainer, role === "driver" ? s.iconActive : s.iconInactive]}>
              <Ionicons name="car" size={32} color={role === "driver" ? "#fff" : theme.primary} />
            </View>
            <View style={s.cardText}>
              <Text style={[s.cardTitle, role === "driver" && s.textWhite]}>Driver</Text>
              <Text style={[s.cardDesc, role === "driver" ? s.textLightBlue : s.textGray]}>Offer rides</Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate("Login", { role })}
          style={s.continueButton}
        >
          <Text style={s.continueText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: spacing.xl, justifyContent: "center" },
    header: { marginBottom: 40 },
    title: { ...typography.h1, fontSize: 36, color: theme.textPrimary },
    brand: { color: theme.primary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 8 },
    cardsContainer: { gap: 16 },
    card: {
      flexDirection: "row", alignItems: "center", padding: 20,
      borderRadius: radius.xl, borderWidth: 2, borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    cardActive: { 
      backgroundColor: theme.primary, borderColor: theme.primary,
      shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
    },
    iconContainer: { width: 56, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginRight: 16 },
    iconInactive: { backgroundColor: theme.surfaceElevated },
    iconActive: { backgroundColor: theme.primaryDark || theme.primary },
    cardText: { flex: 1 },
    cardTitle: { ...typography.h3, color: theme.textPrimary },
    cardDesc: { ...typography.caption, marginTop: 4 },
    textWhite: { color: "#fff" },
    textLightBlue: { color: theme.primarySubtle },
    textGray: { color: theme.textSecondary },
    continueButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      marginTop: 40, backgroundColor: theme.primary, padding: 18, borderRadius: radius.lg,
      shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    continueText: { color: "#fff", fontWeight: "700", fontSize: 18 }
  });
}
