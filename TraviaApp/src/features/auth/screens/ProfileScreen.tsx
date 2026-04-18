import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { supabase } from "../../../config/supabaseClient";
import { syncUserApi } from "../api/authApi";
import type { UserGender } from "../types/auth";
import { createRideIncidentApi } from "../../safety/api/incidentApi";

export function ProfileScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, role, setToken, setUser } = useContext(AuthContext);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.user_metadata?.full_name ?? "User");
  const [gender, setGender] = useState<UserGender | "">(user?.user_metadata?.gender ?? "");
  const [saving, setSaving] = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState<
    "app_feedback" | "ride_issue" | "suggestion" | "other"
  >("app_feedback");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    setName(user?.user_metadata?.full_name ?? "User");
    setGender(user?.user_metadata?.gender ?? "");
  }, [user]);

  const displayInitial = name?.charAt(0)?.toUpperCase() ?? "U";

  const onLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => setToken(null),
      },
    ]);
  };

  const onSaveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    if (!gender) {
      Alert.alert("Error", "Please select your gender");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          gender,
        },
      });

      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        await syncUserApi({
          supabaseId: data.user.id,
          email: data.user.email!,
          name: trimmedName,
          role: role ?? "passenger",
          gender,
        });
      }

      setEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const openFeedback = () => setFeedbackModalVisible(true);
  const closeFeedback = () => {
    setFeedbackModalVisible(false);
    setFeedbackMessage("");
    setFeedbackCategory("app_feedback");
  };

  const submitFeedback = async () => {
    const trimmedMessage = feedbackMessage.trim();

    if (!trimmedMessage) {
      Alert.alert(
        "Add a message",
        "Please write what went wrong or what you want to improve.",
      );
      return;
    }

    setFeedbackSubmitting(true);

    try {
      await createRideIncidentApi({
        kind: "report",
        severity: "low",
        category: feedbackCategory,
        message: trimmedMessage,
        locationLabel: `${role ?? "user"} profile`,
      });

      closeFeedback();
      Alert.alert(
        "Feedback sent",
        "Thanks for sharing. The admin team can review it from the Safety Center.",
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to send feedback");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.headerCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{displayInitial}</Text>
          </View>

          {editing ? (
            <View style={s.editGroup}>
              <View style={s.nameEditRow}>
                <TextInput
                  style={s.nameInput}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  placeholder="Your name"
                  placeholderTextColor={theme.textMuted}
                />
                <Pressable onPress={onSaveProfile} style={s.saveBtn} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color={theme.textInverse} />
                  ) : (
                    <Text style={s.saveBtnText}>Save</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setEditing(false)} style={s.cancelBtn}>
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={s.genderEditor}>
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
                        style={[s.genderChip, active && s.genderChipActive]}
                      >
                        <Text style={[s.genderChipText, active && s.genderChipTextActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={s.nameRow}>
              <Text style={s.userName}>{name}</Text>
              <Ionicons name="pencil-outline" size={16} color={theme.primary} />
            </Pressable>
          )}

          <View style={s.roleBadge}>
            <Ionicons
              name={role === "driver" ? "car" : "person"}
              size={12}
              color={theme.primary}
            />
            <Text style={s.roleText}>{role?.toUpperCase()}</Text>
          </View>

          <Text style={s.emailText}>{user?.email ?? "-"}</Text>
        </View>

        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.card}>
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={user?.email ?? "-"}
            locked
            theme={theme}
          />
          <Divider theme={theme} />
          <InfoRow
            icon="call-outline"
            label="Phone"
            value={user?.user_metadata?.phone ?? "Not set"}
            locked
            theme={theme}
          />
          <Divider theme={theme} />
          <InfoRow
            icon="shield-checkmark-outline"
            label="Account Role"
            value={role ? role.charAt(0).toUpperCase() + role.slice(1) : "-"}
            locked
            theme={theme}
          />
          <Divider theme={theme} />
          <InfoRow
            icon="male-female-outline"
            label="Gender"
            value={gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "Not set"}
            locked={!editing}
            theme={theme}
          />
        </View>

        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.card}>
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <View style={[s.settingIcon, { backgroundColor: theme.primarySubtle }]}>
                <Ionicons name={isDark ? "moon" : "sunny"} size={18} color={theme.primary} />
              </View>
              <Text style={s.settingLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primaryDark }}
              thumbColor={isDark ? theme.primary : theme.textSecondary}
            />
          </View>
        </View>

        <Text style={s.sectionLabel}>ACCOUNT ACTIONS</Text>
        <View style={s.card}>
          <Pressable style={s.dangerRow} onPress={onLogout}>
            <View style={[s.settingIcon, { backgroundColor: theme.dangerBg }]}>
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
            </View>
            <Text style={s.dangerText}>Logout</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.danger}
              style={{ marginLeft: "auto" }}
            />
          </Pressable>
        </View>

        <Text style={s.sectionLabel}>FEEDBACK</Text>
        <View style={s.card}>
          <Pressable style={s.feedbackRow} onPress={openFeedback}>
            <View style={[s.settingIcon, { backgroundColor: theme.primarySubtle }]}>
              <Ionicons name="megaphone-outline" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.settingLabel}>Report issue / send feedback</Text>
              <Text style={s.feedbackCaption}>
                Tell us what to improve in the app or a ride experience.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>
        </View>

        <Text style={s.footer}>Travia v1.0.0 - FYP Project</Text>
      </ScrollView>

      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeFeedback}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <Ionicons name="megaphone" size={34} color={theme.primary} />
            </View>
            <Text style={s.modalTitle}>Report issue / send feedback</Text>
            <Text style={s.modalSubtitle}>
              Share app problems, ride concerns, or suggestions so we can improve Travia.
            </Text>

            <View style={s.categoryRow}>
              {[
                { key: "app_feedback", label: "App issue" },
                { key: "ride_issue", label: "Ride issue" },
                { key: "suggestion", label: "Suggestion" },
                { key: "other", label: "Other" },
              ].map((item) => {
                const active = feedbackCategory === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setFeedbackCategory(item.key as typeof feedbackCategory)}
                    style={[s.categoryChip, active && s.categoryChipActive]}
                  >
                    <Text style={[s.categoryChipText, active && s.categoryChipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={feedbackMessage}
              onChangeText={setFeedbackMessage}
              placeholder="Write your feedback here..."
              placeholderTextColor={theme.textSecondary}
              multiline
              style={s.feedbackInput}
            />

            <View style={s.modalActions}>
              <Pressable
                onPress={closeFeedback}
                style={s.secondaryModalBtn}
                disabled={feedbackSubmitting}
              >
                <Text style={s.secondaryModalBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={submitFeedback}
                style={s.primaryModalBtn}
                disabled={feedbackSubmitting}
              >
                {feedbackSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryModalBtnText}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  locked,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  locked?: boolean;
  theme: any;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14 }}>
      <View
        style={[
          {
            width: 36,
            height: 36,
            borderRadius: 10,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          },
          { backgroundColor: theme.primarySubtle },
        ]}
      >
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: "500", marginBottom: 2 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 15, color: theme.textPrimary, fontWeight: "600" }}>{value}</Text>
      </View>
      {locked && <Ionicons name="lock-closed-outline" size={14} color={theme.textMuted} />}
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={{ height: 1, backgroundColor: theme.border, marginLeft: 48 }} />;
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { padding: spacing.xl, paddingBottom: 40 },

    headerCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing["2xl"],
      alignItems: "center",
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    avatarText: { ...typography.h1, color: "#fff" },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    userName: { ...typography.h2, color: theme.textPrimary },
    editGroup: {
      width: "100%",
    },
    nameEditRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
      flexWrap: "wrap",
    },
    nameInput: {
      flex: 1,
      minWidth: 180,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: theme.textPrimary,
      fontSize: 16,
    },
    saveBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      minWidth: 52,
      alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    cancelBtn: { padding: 4 },
    genderEditor: {
      marginTop: spacing.sm,
    },
    genderLabel: {
      ...typography.caption,
      color: theme.textMuted,
      marginBottom: spacing.sm,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    genderRow: { flexDirection: "row", gap: 8 },
    genderChip: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    genderChipActive: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primary,
    },
    genderChipText: {
      color: theme.textSecondary,
      fontWeight: "600",
      fontSize: 13,
    },
    genderChipTextActive: {
      color: theme.primary,
    },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.primarySubtle,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
      marginBottom: spacing.sm,
    },
    roleText: { ...typography.label, color: theme.primary },
    emailText: { ...typography.caption, color: theme.textSecondary },

    sectionLabel: {
      ...typography.label,
      color: theme.textMuted,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    feedbackRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 12,
    },
    feedbackCaption: {
      ...typography.caption,
      color: theme.textMuted,
      marginTop: 2,
    },
    settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    settingLabel: { ...typography.bodyMedium, color: theme.textPrimary },
    dangerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 12,
    },
    dangerText: { ...typography.bodyMedium, color: theme.danger },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.55)",
      justifyContent: "center",
      padding: spacing.xl,
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalIconWrap: {
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    modalTitle: {
      ...typography.h3,
      color: theme.textPrimary,
      textAlign: "center",
    },
    modalSubtitle: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    categoryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: spacing.md,
    },
    categoryChip: {
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.surfaceElevated,
    },
    categoryChipActive: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primary,
    },
    categoryChipText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    categoryChipTextActive: {
      color: theme.primary,
    },
    feedbackInput: {
      minHeight: 110,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      backgroundColor: theme.surfaceElevated,
      color: theme.textPrimary,
      padding: spacing.md,
      textAlignVertical: "top",
    },
    modalActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    secondaryModalBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryModalBtnText: {
      ...typography.bodySemiBold,
      color: theme.textSecondary,
    },
    primaryModalBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.lg,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryModalBtnText: {
      ...typography.bodySemiBold,
      color: "#fff",
    },
    footer: {
      textAlign: "center",
      ...typography.caption,
      color: theme.textMuted,
      marginTop: spacing.xl,
    },
  });
}
