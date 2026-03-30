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
import { registerApi, syncUserApi } from "../api/authApi";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../config/supabaseClient";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type RegisterRouteProp = RouteProp<AuthStackParamList, "Register">;

export function RegisterScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RegisterRouteProp>();
  const { role } = route.params;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onRegister = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (!name || !email || !password || !phone) {
      setError("All fields are required");
      setLoading(false);
      return;
    }

    try {
      // 1. Sign up with Supabase
      const { data, error: sbError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone,
          },
        },
      });

      if (sbError) throw sbError;

      if (data.user) {
        // 2. Sync with our backend
        await syncUserApi({
          supabaseId: data.user.id,
          email: data.user.email!,
          name,
          phone,
          role,
        });

        if (data.session) {
          // Immediately logged in
        } else {
          navigation.navigate("VerifyOtp", { 
            email, 
            type: "signup", 
            role, 
            name, 
            phone 
          });
        }
      }
    } catch (e: any) {
      setError(e.message || "Register failed");
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
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>

          <View style={s.header}>
            <Text style={s.title}>Create Account</Text>
            <Text style={s.subtitle}>Join as a <Text style={s.roleText}>{role}</Text></Text>
          </View>

          <View style={s.form}>
            <View style={s.inputContainer}>
              <Ionicons name="person-outline" size={20} color={theme.textMuted} style={s.inputIcon} />
              <TextInput
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                style={s.input}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={s.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={theme.textMuted} style={s.inputIcon} />
              <TextInput
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={s.input}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={s.inputContainer}>
              <Ionicons name="call-outline" size={20} color={theme.textMuted} style={s.inputIcon} />
              <TextInput
                placeholder="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
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

            {message ? (
              <View style={s.messageBox}>
                <Ionicons name="mail-unread-outline" size={16} color={theme.primary} />
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
              onPress={onRegister}
              disabled={loading}
              style={[s.primaryButton, loading && s.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.primaryButtonText}>Sign Up</Text>
              )}
            </Pressable>
          </View>

          <View style={s.footer}>
            <Pressable onPress={() => navigation.navigate("Login", { role })} style={s.footerLink}>
              <Text style={s.footerText}>Already have an account? <Text style={s.footerTextBold}>Log in</Text></Text>
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
    scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: 20 },
    backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start", marginTop: 10 },
    header: { marginTop: 20, marginBottom: 40 },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 8 },
    roleText: { color: theme.primary, fontWeight: "700", textTransform: "capitalize" },
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
      shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    buttonDisabled: { opacity: 0.7 },
    primaryButtonText: { color: "white", fontSize: 18, fontWeight: "700" },
    footer: { alignItems: "center", gap: 16, marginVertical: 20 },
    footerLink: { padding: 4 },
    footerText: { fontSize: 15, color: theme.textSecondary },
    footerTextBold: { color: theme.primary, fontWeight: "700" },
    footerTextMuted: { fontSize: 14, color: theme.textMuted }
  });
}