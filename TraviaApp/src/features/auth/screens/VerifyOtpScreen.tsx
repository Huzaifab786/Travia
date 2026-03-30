import React, { useState } from "react";
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
import { syncUserApi } from "../api/authApi";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../config/supabaseClient";
import { useContext } from "react";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type VerifyOtpRouteProp = RouteProp<AuthStackParamList, "VerifyOtp">;

export function VerifyOtpScreen() {
  const { theme } = useTheme();
  const { setToken } = useContext(AuthContext);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<VerifyOtpRouteProp>();
  const { email, type, role, name, phone } = route.params;

  const [token, setOtpToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onVerify = async () => {
    if (token.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data, error: sbError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: type === "signup" ? "signup" : "recovery",
      });

      if (sbError) throw sbError;

      if (data.session) {
        if (type === "signup") {
          try {
            // Sync with backend after verification
            const syncRes = await syncUserApi({
              supabaseId: data.user!.id,
              email,
              name,
              phone,
              role: role!,
            });
            await setToken(syncRes.token);
          } catch (syncError: any) {
            // Sign out of Supabase to prevent a dangling session without a backend token
            await supabase.auth.signOut();
            throw syncError;
          }
        } else {
          // Recovery successful, redirect to reset password
          navigation.navigate("ResetPassword", { email });
        }
      }
    } catch (e: any) {
      setError(e.message || "Verification failed");
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
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>

          <View style={s.header}>
            <Text style={s.title}>Verify Account</Text>
            <Text style={s.subtitle}>Enter the 6-digit code sent to {email}</Text>
          </View>

          <View style={s.form}>
            <View style={s.inputContainer}>
              <Ionicons name="key-outline" size={20} color={theme.textMuted} style={s.inputIcon} />
              <TextInput
                placeholder="6-digit OTP"
                value={token}
                onChangeText={setOtpToken}
                keyboardType="number-pad"
                maxLength={6}
                style={s.input}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={theme.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={onVerify}
              disabled={loading}
              style={[s.primaryButton, loading && s.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.primaryButtonText}>Verify Code</Text>
              )}
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
    scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: 20 },
    backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start", marginTop: 10 },
    header: { marginTop: 20, marginBottom: 40 },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 8 },
    form: { gap: 16 },
    inputContainer: {
      flexDirection: "row", alignItems: "center", backgroundColor: theme.surface,
      borderWidth: 1, borderColor: theme.border, borderRadius: radius.lg, paddingHorizontal: 16, height: 56
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: theme.textPrimary, letterSpacing: 4 },
    errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.dangerBg, padding: 12, borderRadius: 12, gap: 8 },
    errorText: { color: theme.danger, fontSize: 14, flex: 1 },
    primaryButton: {
      backgroundColor: theme.primary, height: 56, borderRadius: radius.lg,
      justifyContent: "center", alignItems: "center", marginTop: 8,
    },
    buttonDisabled: { opacity: 0.7 },
    primaryButtonText: { color: "white", fontSize: 18, fontWeight: "700" },
  });
}
