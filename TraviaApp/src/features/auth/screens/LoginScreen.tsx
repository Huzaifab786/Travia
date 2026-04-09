import React, { useState, useContext } from "react";
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
import { AuthContext } from "../../../app/providers/AuthProvider";
import { syncUserApi } from "../api/authApi";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../config/supabaseClient";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

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
      
      const { data, error: sbError } = await supabase.auth.signInWithPassword(
        isEmail 
          ? { email: identifier, password } 
          : { phone: identifier, password }
      );

      if (sbError) throw sbError;

      if (data.user) {
        try {
          const syncRes = await syncUserApi({
            supabaseId: data.user.id,
            email: data.user.email ?? "",
            role,
            gender: data.user.user_metadata?.gender,
          });

          await setToken(syncRes.token);
        } catch (syncError: any) {
          await supabase.auth.signOut();
          throw syncError; 
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
          <View>
            <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </Pressable>

            <View style={s.header}>
              <Text style={s.title}>Welcome Back</Text>
              <Text style={s.subtitle}>Log in as <Text style={s.roleText}>{role}</Text> to continue</Text>
            </View>

            <View style={s.form}>
              <Input
                placeholder="Email or Phone Number"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon={<Ionicons name="person-outline" size={20} color={theme.textMuted} />}
                containerStyle={{ marginBottom: 4 }}
              />

              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} />}
                containerStyle={{ marginBottom: 4 }}
              />

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

              <Button
                title="Sign In"
                onPress={onLogin}
                loading={loading}
                variant="solid"
                size="lg"
                fullWidth
                style={s.loginButton}
              />
            </View>
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
    header: { marginTop: 20, marginBottom: spacing["3xl"] },
    title: { ...typography.hero, fontSize: 32, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 8 },
    roleText: { color: theme.primary, fontWeight: "700", textTransform: "capitalize" },
    form: { gap: 12 },
    forgotPasswordLink: { alignSelf: "flex-end", paddingVertical: 4, marginBottom: 8 },
    forgotPasswordText: { color: theme.primary, fontSize: 14, fontWeight: "600" },
    errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.dangerBg, padding: 12, borderRadius: 12, gap: 8, marginBottom: 12 },
    errorText: { color: theme.danger, fontSize: 14, flex: 1 },
    loginButton: { marginTop: 8 },
    footer: { alignItems: "center", gap: 16, marginTop: spacing["4xl"], marginBottom: 20 },
    footerLink: { padding: 4 },
    footerText: { fontSize: 15, color: theme.textSecondary },
    footerTextBold: { color: theme.primary, fontWeight: "700" },
    footerTextMuted: { fontSize: 14, color: theme.textMuted }
  });
}
