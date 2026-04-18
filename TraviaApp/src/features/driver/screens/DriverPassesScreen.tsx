import React, { useCallback, useContext, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
} from "react-native";
import { ThemeContext } from "../../../app/providers/ThemeProvider";
import { typography, spacing, radius } from "../../../config/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  getDriverPasses,
  approvePass,
  PassDetails,
} from "../../shared/api/passApi";

export function DriverPassesScreen() {
  const { theme } = useContext(ThemeContext);
  const s = makeStyles(theme);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passes, setPasses] = useState<PassDetails[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = useCallback(async (showFullScreenLoader = false) => {
    try {
      if (showFullScreenLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const res = await getDriverPasses();
      setPasses(res);
    } catch (error: any) {
      Alert.alert("Error", "Failed to load passenger passes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const hasLoadedOnceRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      fetchData(!hasLoadedOnceRef.current);
      hasLoadedOnceRef.current = true;
    }, [fetchData]),
  );

  const handleApprove = async (passId: string) => {
    Alert.alert(
      "Confirm Cash Received",
      "Are you sure you want to approve this pass? Only proceed if the passenger has physically handed you the agreed cash amount.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          style: "default",
          onPress: async () => {
            try {
              setApprovingId(passId);
              await approvePass(passId);
              fetchData();
              Alert.alert("Success", "Passenger's commuter pass is now active!");
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.error || "Failed to approve pass.");
            } finally {
              setApprovingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={s.safeArea}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Pass Requests</Text>
            <Text style={s.subtitle}>
              Manage your regular commuter cash subscriptions.
            </Text>
          </View>
          <Pressable
            onPress={() => fetchData(false)}
            style={s.refreshButton}
            accessibilityRole="button"
            accessibilityLabel="Refresh pass requests"
          >
            <Ionicons name="refresh" size={18} color={theme.primary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={passes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(false)}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
            <Text style={s.emptyText}>
              You have no pending or active passenger passes.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = item.status === "active";
          const isPending = item.status === "pending";
          const isExhausted = item.status === "exhausted";

          return (
            <View style={[s.card, isActive && s.activeCard]}>
              <View style={s.cardHeader}>
                <View style={s.avatarBox}>
                  <Ionicons name="person" size={24} color={theme.background} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.drName}>{item.passenger?.name}</Text>
                  <Text style={[s.statusBadge, isActive && { color: theme.primary }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={s.detailsStack}>
                <View style={s.detailBlock}>
                  <Text style={s.label}>Route</Text>
                  <Text style={s.valueRoute} numberOfLines={3}>
                    {item.routeLabel || "Saved route"}
                  </Text>
                </View>
                <View style={s.detailBlock}>
                  <Text style={s.label}>Cash Owed</Text>
                  <Text style={s.valuePrice}>Rs {item.price}</Text>
                </View>
              </View>

              <View style={s.infoRow}>
                <View>
                  <Text style={s.label}>Ride quota</Text>
                  <Text style={s.value}>
                    {item.durationLabel || `${item.totalRides || item.durationDays || 0} rides`}
                  </Text>
                </View>
                <View>
                  <Text style={s.label}>Rides Used</Text>
                  <Text style={s.value}>
                    {Number(item.ridesUsed || 0)} / {Number(item.totalRides || 0)}
                  </Text>
                </View>
              </View>

              {isPending && (
                <Pressable
                  style={s.btn}
                  onPress={() => handleApprove(item.id)}
                  disabled={approvingId === item.id}
                >
                  {approvingId === item.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.btnText}>Approve (Cash Received)</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      padding: spacing.xl,
      paddingTop: spacing['2xl'],
      backgroundColor: theme.surfaceColor,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 4 },
    refreshButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderColor,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    emptyContainer: {
      marginTop: 40,
      alignItems: "center",
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: 12,
    },
    card: {
      backgroundColor: theme.surfaceColor,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    activeCard: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + "11",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    avatarBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.textPrimary,
      justifyContent: "center",
      alignItems: "center",
    },
    drName: { ...typography.h2, color: theme.textPrimary },
    statusBadge: {
      ...typography.caption,
      fontWeight: "700",
      marginTop: 4,
    },
    detailsStack: {
      backgroundColor: theme.background,
      padding: 12,
      borderRadius: radius.sm,
      marginBottom: 12,
      gap: 12,
    },
    detailBlock: {
      gap: 4,
    },
    label: { ...typography.caption, color: theme.textSecondary },
    value: { ...typography.h2, color: theme.textPrimary, marginTop: 2 },
    valueRoute: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      marginTop: 2,
      fontWeight: "700",
      flexShrink: 1,
    },
    valuePrice: {
      ...typography.h2,
      color: theme.primary,
      marginTop: 2,
    },
    btn: {
      backgroundColor: theme.primary,
      padding: 14,
      borderRadius: radius.md,
      alignItems: "center",
      marginTop: 12,
    },
    btnText: { ...typography.label, color: "#fff" },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: theme.background,
      padding: 12,
      borderRadius: radius.sm,
      marginBottom: 12,
    },
  });
}
