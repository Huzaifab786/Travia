import React, { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { requestAccountAppealApi } from "../api/accountAppealApi";

export function SuspendedAccountScreen() {
  const { theme } = useTheme();
  const { user, suspendedAccount, setSuspendedAccount } = useContext(AuthContext);
  const [email, setEmail] = useState(
    suspendedAccount?.email || user?.email || "",
  );
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reason = suspendedAccount?.reason || "Your account is currently suspended.";
  const role = suspendedAccount?.role || null;

  const canSubmit = useMemo(
    () => email.trim().length > 0 && message.trim().length > 0 && !submitting,
    [email, message, submitting],
  );

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert("Missing details", "Please add your email and a short request message.");
      return;
    }

    setSubmitting(true);
    try {
      await requestAccountAppealApi({
        email: email.trim(),
        name: name.trim() || undefined,
        role: role || undefined,
        message: message.trim(),
      });

      setSubmitted(true);
      Alert.alert(
        "Request sent",
        "Your account review request has been submitted. Admin will review it from the Users section.",
      );
    } catch (error: any) {
      Alert.alert("Unable to submit", error?.message || "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  const goBackToLogin = () => {
    setSuspendedAccount(null);
  };

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <View style={s.iconWrap}>
            <Ionicons name="ban-outline" size={42} color={theme.danger} />
          </View>
          <Text style={s.title}>Account suspended</Text>
          <Text style={s.subtitle}>{reason}</Text>

          <View style={s.notice}>
            <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
            <Text style={s.noticeText}>
              You can request a review from admin below. If approved, your account will be restored.
            </Text>
          </View>

          <View style={s.form}>
            <Field label="Email" value={email} onChangeText={setEmail} theme={theme} />
            <Field label="Name" value={name} onChangeText={setName} theme={theme} />

            <View>
              <Text style={s.label}>Request message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Explain why you think the account should be reviewed..."
                placeholderTextColor={theme.textMuted}
                multiline
                style={s.textArea}
              />
            </View>
          </View>

          <View style={s.actions}>
            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={[s.primaryBtn, (!canSubmit || submitting) && { opacity: 0.7 }]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>
                  {submitted ? "Request submitted" : "Request review"}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={goBackToLogin} style={s.secondaryBtn}>
              <Text style={s.secondaryBtnText}>Back to login</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  theme: any;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={theme.textMuted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: "#64748b",
    marginBottom: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
});

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: {
      flexGrow: 1,
      justifyContent: "center",
      padding: spacing.xl,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    iconWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.dangerBg,
      alignSelf: "center",
    },
    title: {
      ...typography.h2,
      color: theme.textPrimary,
      textAlign: "center",
    },
    subtitle: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: theme.primarySubtle,
      padding: spacing.md,
      borderRadius: radius.lg,
    },
    noticeText: {
      ...typography.caption,
      color: theme.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    form: {
      gap: spacing.md,
    },
    label: {
      ...typography.caption,
      color: theme.textMuted,
      marginBottom: 8,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    textArea: {
      minHeight: 120,
      borderWidth: 1,
      borderRadius: radius.lg,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.textPrimary,
      backgroundColor: theme.surfaceElevated,
      textAlignVertical: "top",
    },
    actions: {
      gap: 12,
    },
    primaryBtn: {
      minHeight: 48,
      borderRadius: radius.lg,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      ...typography.bodySemiBold,
      color: "#fff",
    },
    secondaryBtn: {
      minHeight: 48,
      borderRadius: radius.lg,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryBtnText: {
      ...typography.bodySemiBold,
      color: theme.textSecondary,
    },
  });
}
