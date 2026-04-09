import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMyRidesApi,
  DriverRide,
  cancelRideApi,
} from "../api/driverRideListApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { spacing, radius, typography } from "../../../config/theme";
import { Ionicons } from "@expo/vector-icons";

export function MyRidesScreen() {
  const { theme } = useTheme();
  const [rides, setRides] = useState<DriverRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const load = async () => {
    const res = await getMyRidesApi();
    setRides(res.rides);
  };

  useEffect(() => {
    const init = async () => {
      setError("");
      try {
        await load();
      } catch (e: any) {
        setError(e.message || "Failed to load rides");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to refresh rides");
    } finally {
      setRefreshing(false);
    }
  };

  const onCancelRide = (rideId: string) => {
    Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setError("");
          setActionLoadingId(rideId);
          try {
            await cancelRideApi(rideId);
            await load();
          } catch (e: any) {
            setError(e.message || "Failed to cancel ride");
          } finally {
            setActionLoadingId(null);
          }
        },
      },
    ]);
  };

  const stats = useMemo(() => {
    const active = rides.filter((r) =>
      ["active", "ready", "in_progress"].includes(r.status),
    ).length;
    const completed = rides.filter((r) => r.status === "completed").length;
    const cancelled = rides.filter((r) => r.status === "cancelled").length;

    return { active, completed, cancelled, total: rides.length };
  }, [rides]);

  const s = makeStyles(theme);

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={s.loadingText}>Loading your rides...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getRideBadge = (status: DriverRide["status"]) => {
    if (status === "active") {
      return {
        label: "ACTIVE",
        bg: theme.successBg,
        text: theme.success,
        icon: "checkmark-circle-outline" as const,
      };
    }

    if (status === "ready") {
      return {
        label: "READY",
        bg: theme.primarySubtle,
        text: theme.primary,
        icon: "radio-outline" as const,
      };
    }

    if (status === "in_progress") {
      return {
        label: "LIVE",
        bg: theme.amberBg,
        text: theme.amber,
        icon: "pulse-outline" as const,
      };
    }

    if (status === "cancelled") {
      return {
        label: "CANCELLED",
        bg: theme.dangerBg,
        text: theme.danger,
        icon: "close-circle-outline" as const,
      };
    }

    if (status === "completed") {
      return {
        label: "COMPLETED",
        bg: theme.primarySubtle,
        text: theme.primary,
        icon: "flag-outline" as const,
      };
    }

    return {
      label: "UNKNOWN",
      bg: theme.surfaceElevated,
      text: theme.textSecondary,
      icon: "help-circle-outline" as const,
    };
  };

  const renderRideCard = ({ item }: { item: DriverRide }) => {
    const acceptedSeats = item.analytics?.acceptedSeats ?? 0;
    const pendingCount = item.analytics?.pendingCount ?? 0;
    const totalBookings = item.analytics?.totalBookings ?? 0;
    const seatsLeft = Math.max(item.seatsTotal - acceptedSeats, 0);
    const isFull = seatsLeft <= 0;

    const occupancyPercent =
      item.seatsTotal > 0
        ? Math.round((acceptedSeats / item.seatsTotal) * 100)
        : 0;

    const isWaitingForPassengers = item.status === "active";
    const isReadyToStart = item.status === "ready";
    const isLiveRide = item.status === "in_progress";
    const isHistoryRide =
      item.status === "completed" || item.status === "cancelled";

    const rideBadge = getRideBadge(item.status);

    return (
      <View style={s.card}>
        <View style={s.cardTopRow}>
          <View style={[s.badge, { backgroundColor: rideBadge.bg }]}>
            <Ionicons
              name={rideBadge.icon}
              size={12}
              color={rideBadge.text}
              style={{ marginRight: 6 }}
            />
            <Text style={[s.badgeText, { color: rideBadge.text }]}>
              {rideBadge.label}
            </Text>
          </View>

          <Text style={s.priceText}>Rs {item.price}/seat</Text>
        </View>

        <View style={s.routeBlock}>
          <View style={s.routeTimeline}>
            <View style={[s.timelineDot, { backgroundColor: theme.success }]} />
            <View style={s.timelineLine} />
            <View style={[s.timelineDot, { backgroundColor: theme.danger }]} />
          </View>

          <View style={s.routeContent}>
            <Text style={s.routeFrom} numberOfLines={1}>
              {item.pickup.address}
            </Text>
            <Text style={s.routeTo} numberOfLines={1}>
              {item.dropoff.address}
            </Text>
          </View>
        </View>

        <View style={s.metaRow}>
          <View style={s.metaChip}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={theme.textSecondary}
            />
            <Text style={s.metaChipText}>
              {new Date(item.departureTime).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}{" "}
              ·{" "}
              {new Date(item.departureTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <View style={s.metaChip}>
            <Ionicons
              name="people-outline"
              size={13}
              color={theme.textSecondary}
            />
            <Text style={s.metaChipText}>
              {acceptedSeats}/{item.seatsTotal} filled
            </Text>
          </View>
        </View>

        <View style={s.analyticsPanel}>
          <View style={s.analyticsHeader}>
            <Text style={s.analyticsTitle}>Ride occupancy</Text>
            <Text style={s.analyticsPercent}>{occupancyPercent}%</Text>
          </View>

          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                { width: `${Math.min(Math.max(occupancyPercent, 0), 100)}%` },
              ]}
            />
          </View>

          <View style={s.analyticsRow}>
            <View style={s.analyticsItem}>
              <Text style={s.analyticsValue}>{acceptedSeats}</Text>
              <Text style={s.analyticsLabel}>Accepted</Text>
            </View>
            <View style={s.analyticsItem}>
              <Text style={s.analyticsValue}>{pendingCount}</Text>
              <Text style={s.analyticsLabel}>Pending</Text>
            </View>
            <View style={s.analyticsItem}>
              <Text style={s.analyticsValue}>{seatsLeft}</Text>
              <Text style={s.analyticsLabel}>Left</Text>
            </View>
            <View style={s.analyticsItem}>
              <Text style={s.analyticsValue}>{totalBookings}</Text>
              <Text style={s.analyticsLabel}>Bookings</Text>
            </View>
          </View>
        </View>

        {isFull ? (
          <View style={s.infoBannerSuccess}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={theme.success}
            />
            <Text style={s.infoBannerSuccessText}>
              Ride is full and ready to go.
            </Text>
          </View>
        ) : isWaitingForPassengers ? (
          <View style={s.infoBannerWaiting}>
            <Ionicons
              name="hourglass-outline"
              size={16}
              color={theme.amber}
            />
            <Text style={s.infoBannerWaitingText}>
              Waiting for passengers. This ride is published and visible to
              passengers.
            </Text>
          </View>
        ) : null}

        {isWaitingForPassengers ? (
          <View style={s.actionStack}>
            <Pressable
              onPress={() => onCancelRide(item.id)}
              disabled={actionLoadingId === item.id}
              style={[
                s.cancelBtn,
                actionLoadingId === item.id && s.cancelBtnDisabled,
              ]}
            >
              {actionLoadingId === item.id ? (
                <ActivityIndicator size="small" color={theme.danger} />
              ) : (
                <>
                  <Ionicons
                    name="close-circle-outline"
                    size={16}
                    color={theme.danger}
                  />
                  <Text style={s.cancelBtnText}>Cancel Ride</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {isReadyToStart ? (
          <View style={s.stateBoxReady}>
            <View style={s.stateRow}>
              <Ionicons name="radio-outline" size={16} color={theme.primary} />
              <Text style={s.stateTitleReady}>Ready to start</Text>
            </View>
            <Text style={s.stateSubtitle}>
              At least one passenger is accepted. Start this ride from the
              Driver Dashboard.
            </Text>
          </View>
        ) : null}

        {isLiveRide ? (
          <View style={s.stateBoxLive}>
            <View style={s.stateRow}>
              <Ionicons name="pulse-outline" size={16} color={theme.amber} />
              <Text style={s.stateTitleLive}>Ride in progress</Text>
            </View>
            <Text style={s.stateSubtitle}>
              Live tracking is active. Complete this ride from the Driver
              Dashboard when finished.
            </Text>
          </View>
        ) : null}

        {isHistoryRide ? (
          <View style={s.stateBoxHistory}>
            <View style={s.stateRow}>
              <Ionicons
                name="archive-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={s.stateTitleHistory}>Ride history</Text>
            </View>
            <Text style={s.stateSubtitle}>
              This ride is no longer active and remains in your history.
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={renderRideCard}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            <View style={s.header}>
              <View>
                <Text style={s.eyebrow}>Driver Rides</Text>
                <Text style={s.title}>Manage your published trips</Text>
                <Text style={s.subtitle}>
                  Track ride occupancy, monitor passenger interest, and manage
                  rides across waiting, ready, live, and history states.
                </Text>
              </View>
            </View>

            <View style={s.statsRow}>
              <View style={s.statCard}>
                <View
                  style={[
                    s.statIconWrap,
                    { backgroundColor: theme.primarySubtle },
                  ]}
                >
                  <Ionicons name="car-outline" size={18} color={theme.primary} />
                </View>
                <Text style={s.statValue}>{stats.total}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>

              <View style={s.statCard}>
                <View
                  style={[s.statIconWrap, { backgroundColor: theme.successBg }]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={theme.success}
                  />
                </View>
                <Text style={s.statValue}>{stats.active}</Text>
                <Text style={s.statLabel}>Active</Text>
              </View>

              <View style={s.statCard}>
                <View
                  style={[s.statIconWrap, { backgroundColor: theme.dangerBg }]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color={theme.danger}
                  />
                </View>
                <Text style={s.statValue}>{stats.cancelled}</Text>
                <Text style={s.statLabel}>Cancelled</Text>
              </View>
            </View>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={theme.danger}
                />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons
              name="car-sport-outline"
              size={56}
              color={theme.textMuted}
            />
            <Text style={s.emptyTitle}>No rides yet</Text>
            <Text style={s.emptyText}>
              You haven’t created any rides yet. Once you publish a ride, it
              will appear here.
            </Text>
          </View>
        }
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
      gap: 12,
    },
    loadingText: {
      ...typography.body,
      color: theme.textSecondary,
    },

    listContent: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: 120,
      flexGrow: 1,
    },

    header: {
      marginBottom: spacing.lg,
    },
    eyebrow: {
      ...typography.captionMedium,
      color: theme.primary,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    title: {
      ...typography.h2,
      color: theme.textPrimary,
      marginBottom: 6,
    },
    subtitle: {
      ...typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },

    statsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    statIconWrap: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    statValue: {
      ...typography.h3,
      color: theme.textPrimary,
    },
    statLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },

    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.dangerBg,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    errorText: {
      ...typography.caption,
      color: theme.danger,
      flex: 1,
    },

    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
      gap: spacing.md,
    },

    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    badge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.full,
    },
    badgeText: {
      ...typography.label,
    },

    priceText: {
      ...typography.h4,
      color: theme.primary,
    },

    routeBlock: {
      flexDirection: "row",
      alignItems: "stretch",
    },
    routeTimeline: {
      width: 18,
      alignItems: "center",
      marginRight: spacing.md,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    timelineLine: {
      flex: 1,
      width: 2,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    routeContent: {
      flex: 1,
      justifyContent: "space-between",
      gap: 14,
    },
    routeFrom: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
    },
    routeTo: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
    },

    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
    },
    metaChipText: {
      ...typography.captionMedium,
      color: theme.textSecondary,
    },

    analyticsPanel: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    analyticsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    analyticsTitle: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    analyticsPercent: {
      ...typography.bodySemiBold,
      color: theme.primary,
    },
    progressTrack: {
      height: 8,
      backgroundColor: theme.border,
      borderRadius: 999,
      overflow: "hidden",
      marginBottom: spacing.md,
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.primary,
      borderRadius: 999,
    },
    analyticsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    analyticsItem: {
      flex: 1,
      alignItems: "center",
    },
    analyticsValue: {
      ...typography.h4,
      color: theme.textPrimary,
    },
    analyticsLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
      textAlign: "center",
    },

    infoBannerSuccess: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.successBg,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    infoBannerSuccessText: {
      ...typography.captionMedium,
      color: theme.success,
      flex: 1,
    },

    infoBannerWaiting: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.amberBg,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    infoBannerWaitingText: {
      ...typography.captionMedium,
      color: theme.amber,
      flex: 1,
    },

    actionStack: {
      gap: spacing.sm,
    },

    cancelBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: radius.lg,
      borderWidth: 1.2,
      borderColor: theme.danger,
      backgroundColor: theme.surface,
    },
    cancelBtnDisabled: {
      opacity: 0.6,
    },
    cancelBtnText: {
      color: theme.danger,
      ...typography.bodySemiBold,
    },

    stateBoxReady: {
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.primary + "33",
      gap: spacing.sm,
    },
    stateBoxLive: {
      backgroundColor: theme.amberBg,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.amber + "33",
      gap: spacing.sm,
    },
    stateBoxHistory: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      gap: spacing.sm,
    },
    stateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stateTitleReady: {
      ...typography.bodySemiBold,
      color: theme.primary,
    },
    stateTitleLive: {
      ...typography.bodySemiBold,
      color: theme.amber,
    },
    stateTitleHistory: {
      ...typography.bodySemiBold,
      color: theme.textSecondary,
    },
    stateSubtitle: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      lineHeight: 18,
    },

    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: spacing["3xl"],
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      ...typography.h3,
      color: theme.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    emptyText: {
      ...typography.body,
      color: theme.textMuted,
      textAlign: "center",
      lineHeight: 22,
    },
  });
}
