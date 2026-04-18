import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { useNotifications } from "../../../app/providers/NotificationProvider";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { radius, spacing, typography } from "../../../config/theme";

export function NotificationsScreen() {
  const { theme } = useTheme();
  const { role } = useContext(AuthContext);
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();
  const s = makeStyles(theme);

  const getCardMeta = (item: { type: string; data?: Record<string, any> }) => {
    const type = String(item.type || "");

    if (type.includes("pass_request")) {
      return {
        icon: "card-outline" as const,
        accent: theme.primary,
        chip: "Pass",
      };
    }

    if (type.includes("pass_approved")) {
      return {
        icon: "checkmark-done-outline" as const,
        accent: theme.success,
        chip: "Pass",
      };
    }

    if (type.includes("booking_request")) {
      return {
        icon: "person-add-outline" as const,
        accent: theme.amber,
        chip: "Request",
      };
    }

    if (type.includes("booking_status")) {
      return {
        icon: "clipboard-outline" as const,
        accent: theme.primary,
        chip: "Booking",
      };
    }

    if (type.includes("ride_completed")) {
      return {
        icon: "checkmark-circle-outline" as const,
        accent: theme.success,
        chip: "Ride",
      };
    }

    if (type.includes("ride_started")) {
      return {
        icon: "play-outline" as const,
        accent: theme.primary,
        chip: "Ride",
      };
    }

    return {
      icon: "notifications-outline" as const,
      accent: theme.primary,
      chip: "Update",
    };
  };

  const getOpenTarget = (item: { type: string }) => {
    const type = String(item.type || "");
    const isDriver = role === "driver";

    if (type.includes("pass_request") && isDriver) {
      return { route: "DriverTabs", params: { screen: "CommuterPasses" } };
    }

    if (type.includes("pass_approved") && !isDriver) {
      return { route: "PassengerTabs", params: { screen: "CommuterPasses" } };
    }

    if (type.includes("booking_request") && isDriver) {
      return { route: "DriverTabs", params: { screen: "DriverHome" } };
    }

    if (type.includes("booking_status") && !isDriver) {
      return { route: "PassengerTabs", params: { screen: "MyBookings" } };
    }

    if (type.includes("ride_started") || type.includes("ride_completed")) {
      return {
        route: isDriver ? "DriverTabs" : "PassengerTabs",
        params: {
          screen: isDriver ? "MyRides" : "MyBookings",
        },
      };
    }

    return null;
  };

  const openNotification = (item: any) => {
    const target = getOpenTarget(item);
    markAsRead(item.id);

    if (target) {
      navigation.navigate(target.route as any, target.params as any);
    }
  };

  return (
    <View style={s.safeArea}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Notifications</Text>
          <Text style={s.subtitle}>
            {unreadCount} unread {role ? `${role} updates` : "updates"}
          </Text>
        </View>
        <View style={s.actionsRow}>
          <Pressable onPress={markAllAsRead} style={s.iconBtn}>
            <Ionicons name="checkmark-done" size={18} color={theme.primary} />
          </Pressable>
          <Pressable onPress={clearNotifications} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={theme.danger} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          notifications.length === 0 ? s.emptyContainer : s.listContent
        }
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={theme.textSecondary} />
            <Text style={s.emptyText}>No notifications yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isUnread = !item.read;
          const meta = getCardMeta(item);
          return (
            <Pressable
              onPress={() => openNotification(item)}
              style={[s.card, isUnread && s.cardUnread]}
            >
              <View style={[s.cardIcon, { backgroundColor: meta.accent + "18" }]}>
                <Ionicons name={meta.icon} size={18} color={meta.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.cardTopRow}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[s.chip, { borderColor: meta.accent + "44" }]}>
                    <Text style={[s.chipText, { color: meta.accent }]}>
                      {meta.chip}
                    </Text>
                  </View>
                </View>
                <Text style={s.cardBody}>{item.body}</Text>
                <View style={s.cardFooter}>
                  <Text style={s.cardMeta}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                  <Text style={[s.viewText, { color: meta.accent }]}>View</Text>
                </View>
              </View>
              {isUnread ? <View style={s.dot} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing["2xl"],
      paddingBottom: spacing.lg,
      backgroundColor: theme.surfaceColor,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderColor,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
    },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 2 },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    listContent: {
      padding: spacing.xl,
      gap: spacing.md,
      paddingBottom: 100,
    },
    emptyContainer: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    emptyState: {
      alignItems: "center",
      gap: 10,
      marginTop: 40,
    },
    emptyText: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
    },
    card: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: theme.surfaceColor,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.borderColor,
      alignItems: "flex-start",
    },
    cardUnread: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + "10",
    },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      justifyContent: "space-between",
    },
    cardTitle: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: "700",
      flex: 1,
      paddingRight: 4,
    },
    cardBody: {
      ...typography.body,
      color: theme.textSecondary,
      marginTop: 4,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 8,
    },
    cardMeta: {
      ...typography.caption,
      color: theme.textMuted,
      flexShrink: 1,
    },
    chip: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: theme.background,
    },
    chipText: {
      ...typography.caption,
      fontWeight: "700",
    },
    viewText: {
      ...typography.caption,
      fontWeight: "700",
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primary,
      marginTop: 8,
    },
  });
}
