import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
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
import type { UserGender } from "../types/auth";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

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
  const [gender, setGender] = useState<UserGender | "">("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onRegister = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (!name || !email || !password || !phone || !gender) {
      setError("All fields are required");
      setLoading(false);
      return;
    }

    try {
      const { data, error: sbError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone,
            gender,
          },
        },
      });

      if (sbError) throw sbError;

      if (data.user) {
        await syncUserApi({
          supabaseId: data.user.id,
          email: data.user.email!,
          name,
          phone,
          role,
          gender,
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
          <View>
            <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </Pressable>

            <View style={s.header}>
              <Text style={s.title}>Create Account</Text>
              <Text style={s.subtitle}>Join as a <Text style={s.roleText}>{role}</Text></Text>
            </View>

            <View style={s.form}>
              <Input
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                leftIcon={<Ionicons name="person-outline" size={20} color={theme.textMuted} />}
                containerStyle={{ marginBottom: 4 }}
              />

              <Input
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon={<Ionicons name="mail-outline" size={20} color={theme.textMuted} />}
                containerStyle={{ marginBottom: 4 }}
              />

              <Input
                placeholder="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                leftIcon={<Ionicons name="call-outline" size={20} color={theme.textMuted} />}
                containerStyle={{ marginBottom: 4 }}
              />

              <View style={s.genderGroup}>
                <Text style={s.genderLabel}>Gender</Text>
                <View style={s.genderRow}>
                  {[
                    { key: "male", label: "Male" },
                    { key: "female", label: "Female" },
                    { key: "other", label: "Other" },
                  ].map((item) => {
                    const active = gender === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setGender(item.key as UserGender)}
                        style={[
                          s.genderChip,
                          active && s.genderChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            s.genderChipText,
                            active && s.genderChipTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} />}
                containerStyle={{ marginBottom: 4 }}
              />

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

              <Button
                title="Sign Up"
                onPress={onRegister}
                loading={loading}
                variant="solid"
                size="lg"
                fullWidth
                style={s.registerButton}
              />
            </View>
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
    scrollContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: 30, justifyContent: "space-between" },
    backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start", marginTop: 10 },
    header: { marginTop: 20, marginBottom: spacing["3xl"] },
    title: { ...typography.hero, fontSize: 32, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 8 },
    roleText: { color: theme.primary, fontWeight: "700", textTransform: "capitalize" },
    form: { gap: 12 },
    genderGroup: { gap: 10, marginTop: 4, marginBottom: 8 },
    genderLabel: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginLeft: spacing.xs,
    },
    genderRow: { flexDirection: "row", gap: 10 },
    genderChip: {
      flex: 1,
      minHeight: 56,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    genderChipActive: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primary,
      borderWidth: 2,
    },
    genderChipText: {
      color: theme.textSecondary,
      fontWeight: "600",
    },
    genderChipTextActive: {
      color: theme.primaryLight,
    },
    errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.dangerBg, padding: 12, borderRadius: 12, gap: 8, marginBottom: 12 },
    errorText: { color: theme.danger, fontSize: 14, flex: 1 },
    messageBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.primarySubtle, padding: 12, borderRadius: 12, gap: 8, marginBottom: 12 },
    messageText: { color: theme.primary, fontSize: 14, flex: 1, fontWeight: "600" },
    registerButton: { marginTop: 8 },
    footer: { alignItems: "center", gap: 16, marginTop: spacing["4xl"], marginBottom: 20 },
    footerLink: { padding: 4 },
    footerText: { fontSize: 15, color: theme.textSecondary },
    footerTextBold: { color: theme.primary, fontWeight: "700" },
    footerTextMuted: { fontSize: 14, color: theme.textMuted }
  });
}
