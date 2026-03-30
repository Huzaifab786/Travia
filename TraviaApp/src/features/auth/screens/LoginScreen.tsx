import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthNavigator";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { syncUserApi } from "../api/authApi";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../config/supabaseClient";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type LoginRouteProp = RouteProp<AuthStackParamList, "Login">;

export function LoginScreen() {
  const { theme } = useTheme();
  const { setToken } = useContext(AuthContext);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<LoginRouteProp>();
  const { role } = route.params;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const isEmail = identifier.includes("@");
      
      // 1. Login with Supabase
      const { data, error: sbError } = await supabase.auth.signInWithPassword(
        isEmail 
          ? { email: identifier, password } 
          : { phone: identifier, password }
      );

      if (sbError) throw sbError;

      if (data.user) {
        try {
          // 2. Sync with our backend to get the app role and custom token
          const syncRes = await syncUserApi({
            supabaseId: data.user.id,
            email: data.user.email ?? "",
            role,
          });

          // 3. Set the app token
          await setToken(syncRes.token);
        } catch (syncError: any) {
          // If syncing fails (e.g. role mismatch), we must sign out of Supabase
          // to prevent a dangling session without our backend token
          await supabase.auth.signOut();
          throw syncError; // pass the error down to the catch block below
        }
      }
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.container}
      >
        <ScrollView 
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>

          <View style={s.header}>
            <Text style={s.title}>Welcome Back</Text>
            <Text style={s.subtitle}>Log in as <Text style={s.roleText}>{role}</Text> to continue</Text>
          </View>

          <View style={s.form}>
            <View style={s.inputContainer}>
              <Ionicons name="person-outline" size={20} color={theme.textMuted} style={s.inputIcon} />
              <TextInput
                placeholder="Email or Phone Number"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
                style={s.input}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={s.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} style={s.inputIcon} />
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={s.input}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <Pressable 
              onPress={() => navigation.navigate("ForgotPassword", { role })} 
              style={s.forgotPasswordLink}
            >
              <Text style={s.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={theme.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={onLogin}
              disabled={loading}
              style={[s.primaryButton, loading && s.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.primaryButtonText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          <View style={s.footer}>
            <Pressable onPress={() => navigation.navigate("Register", { role })} style={s.footerLink}>
              <Text style={s.footerText}>Don't have an account? <Text style={s.footerTextBold}>Register</Text></Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("RoleSelect")} style={s.footerLink}>
              <Text style={s.footerTextMuted}>Change role</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: 30, justifyContent: "space-between" },
    backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start", marginTop: 10 },
    header: { marginTop: 20, marginBottom: 40 },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 8 },
    roleText: { color: theme.primary, fontWeight: "700", textTransform: "capitalize" },
    form: { flex: 1, gap: 16 },
    inputContainer: {
      flexDirection: "row", alignItems: "center", backgroundColor: theme.surface,
      borderWidth: 1, borderColor: theme.border, borderRadius: radius.lg, paddingHorizontal: 16, height: 56
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: theme.textPrimary },
    forgotPasswordLink: { alignSelf: "flex-end", paddingVertical: 4 },
    forgotPasswordText: { color: theme.primary, fontSize: 14, fontWeight: "600" },
    errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.dangerBg, padding: 12, borderRadius: 12, gap: 8 },
    errorText: { color: theme.danger, fontSize: 14, flex: 1 },
    primaryButton: {
      backgroundColor: theme.primary, height: 56, borderRadius: radius.lg,
      justifyContent: "center", alignItems: "center", marginTop: 8,
      shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    buttonDisabled: { opacity: 0.7 },
    primaryButtonText: { color: "white", fontSize: 18, fontWeight: "700" },
    footer: { alignItems: "center", gap: 16, marginBottom: 20 },
    footerLink: { padding: 4 },
    footerText: { fontSize: 15, color: theme.textSecondary },
    footerTextBold: { color: theme.primary, fontWeight: "700" },
    footerTextMuted: { fontSize: 14, color: theme.textMuted }
  });
}