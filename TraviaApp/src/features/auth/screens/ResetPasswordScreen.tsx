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
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../config/supabaseClient";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type ResetPasswordRouteProp = RouteProp<AuthStackParamList, "ResetPassword">;

export function ResetPasswordScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<ResetPasswordRouteProp>();
  const { email } = route.params;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const onUpdatePassword = async () => {
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { error: sbError } = await supabase.auth.updateUser({
        password: password
      });
      if (sbError) throw sbError;

      setMessage("Password updated successfully! Redirecting to login...");
      setTimeout(() => {
        navigation.navigate("RoleSelect"); // Redirect to start
      }, 2000);
    } catch (e: any) {
      setError(e.message || "Failed to update password");
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
          <View style={s.header}>
            <Text style={s.title}>New Password</Text>
            <Text style={s.subtitle}>Set a secure new password for your account</Text>
          </View>

          <View style={s.form}>
            <View style={s.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} style={s.inputIcon} />
              <TextInput
                placeholder="New Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={s.input}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={s.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} style={s.inputIcon} />
              <TextInput
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={s.input}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {message ? (
              <View style={s.messageBox}>
                <Ionicons name="checkmark-circle-outline" size={16} color={theme.primary} />
                <Text style={s.messageText}>{message}</Text>
              </View>
            ) : null}

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={theme.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={onUpdatePassword}
              disabled={loading}
              style={[s.primaryButton, loading && s.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.primaryButtonText}>Update Password</Text>
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
    header: { marginTop: 60, marginBottom: 40 },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 8 },
    form: { gap: 16 },
    inputContainer: {
      flexDirection: "row", alignItems: "center", backgroundColor: theme.surface,
      borderWidth: 1, borderColor: theme.border, borderRadius: radius.lg, paddingHorizontal: 16, height: 56
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: theme.textPrimary },
    errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.dangerBg, padding: 12, borderRadius: 12, gap: 8 },
    errorText: { color: theme.danger, fontSize: 14, flex: 1 },
    messageBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.primarySubtle, padding: 12, borderRadius: 12, gap: 8 },
    messageText: { color: theme.primary, fontSize: 14, flex: 1, fontWeight: "600" },
    primaryButton: {
      backgroundColor: theme.primary, height: 56, borderRadius: radius.lg,
      justifyContent: "center", alignItems: "center", marginTop: 8,
    },
    buttonDisabled: { opacity: 0.7 },
    primaryButtonText: { color: "white", fontSize: 18, fontWeight: "700" },
  });
}
