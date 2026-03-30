import React, { useContext, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

export function ProfileScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, role, setToken } = useContext(AuthContext);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.user_metadata?.full_name ?? "User");
  const [saving, setSaving] = useState(false);

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

  const onSaveName = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    setSaving(true);
    // TODO: call API to update name
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setEditingName(false);
    Alert.alert("Success", "Name updated successfully");
  };

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.headerCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{displayInitial}</Text>
          </View>

          {editingName ? (
            <View style={s.nameEditRow}>
              <TextInput
                style={s.nameInput}
                value={name}
                onChangeText={setName}
                autoFocus
                placeholder="Your name"
                placeholderTextColor={theme.textMuted}
              />
              <Pressable onPress={onSaveName} style={s.saveBtn} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={theme.textInverse} />
                ) : (
                  <Text style={s.saveBtnText}>Save</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setEditingName(false)} style={s.cancelBtn}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)} style={s.nameRow}>
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

          <Text style={s.emailText}>{user?.email ?? "—"}</Text>
        </View>

        {/* Account Info */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.card}>
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={user?.email ?? "—"}
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
            value={role ? role.charAt(0).toUpperCase() + role.slice(1) : "—"}
            locked
            theme={theme}
          />
        </View>

        {/* Preferences */}
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

        {/* Danger Zone */}
        <Text style={s.sectionLabel}>ACCOUNT ACTIONS</Text>
        <View style={s.card}>
          <Pressable style={s.dangerRow} onPress={onLogout}>
            <View style={[s.settingIcon, { backgroundColor: theme.dangerBg }]}>
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
            </View>
            <Text style={s.dangerText}>Logout</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.danger} style={{ marginLeft: "auto" }} />
          </Pressable>
        </View>

        <Text style={s.footer}>Travia v1.0.0 · FYP Project</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon, label, value, locked, theme,
}: {
  icon: any; label: string; value: string; locked?: boolean; theme: any;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14 }}>
      <View style={[{ width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 12 }, { backgroundColor: theme.primarySubtle }]}>
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: "500", marginBottom: 2 }}>{label}</Text>
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
    nameEditRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    nameInput: {
      flex: 1,
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
    settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    settingIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    settingLabel: { ...typography.bodyMedium, color: theme.textPrimary },
    dangerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 12,
    },
    dangerText: { ...typography.bodyMedium, color: theme.danger },
    footer: { textAlign: "center", ...typography.caption, color: theme.textMuted, marginTop: spacing.xl },
  });
}
