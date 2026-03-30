import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import {
  getMyRidesApi,
  DriverRide,
  cancelRideApi,
} from "../api/driverRideListApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { spacing, radius, typography } from "../../../config/theme";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const s = makeStyles(theme);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>My Rides</Text>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: spacing["2xl"] }}
        ListEmptyComponent={
          <Text style={s.emptyText}>You haven’t created any rides yet.</Text>
        }
        renderItem={({ item }) => {
          const acceptedSeats = item.analytics?.acceptedSeats ?? 0;
          const seatsLeft = item.seatsTotal - acceptedSeats;
          const isFull = seatsLeft <= 0;

          const occupancyPercent =
            item.seatsTotal > 0
              ? Math.round((acceptedSeats / item.seatsTotal) * 100)
              : 0;

          const getRideBadge = (status: DriverRide["status"]) => {
            if (status === "active")
              return { label: "ACTIVE", bg: theme.successBg, text: theme.success };
            if (status === "cancelled")
              return { label: "CANCELLED", bg: theme.surfaceElevated, text: theme.textSecondary };
            if (status === "completed")
              return { label: "COMPLETED", bg: theme.primarySubtle, text: theme.primary };
            return { label: "UNKNOWN", bg: theme.surfaceElevated, text: theme.textSecondary };
          };

          const rideBadge = getRideBadge(item.status);

          return (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                {item.pickup.address} → {item.dropoff.address}
              </Text>

              <Text style={s.detailsText}>
                Departure: {new Date(item.departureTime).toLocaleString()}
              </Text>

              <Text style={s.detailsText}>Price: Rs {item.price}</Text>

              <View style={s.statsContainer}>
                <Text style={s.statsMain}>
                  Seats Filled: {acceptedSeats} / {item.seatsTotal}
                </Text>

                <Text style={s.detailsText}>
                  Seats Left: {seatsLeft < 0 ? 0 : seatsLeft}
                </Text>

                <Text style={s.detailsText}>Occupancy: {occupancyPercent}%</Text>

                {/* Progress bar */}
                <View style={s.progressBarTrack}>
                  <View
                    style={[
                      s.progressBarFill,
                      { width: `${Math.min(Math.max(occupancyPercent, 0), 100)}%` },
                    ]}
                  />
                </View>

                {isFull ? (
                  <Text style={s.fullText}>✅ Ride is FULL</Text>
                ) : null}
              </View>

              {/* Badge + compact stats */}
              <View style={s.badgeRow}>
                <View style={[s.badge, { backgroundColor: rideBadge.bg }]}>
                  <Text style={[s.badgeText, { color: rideBadge.text }]}>
                    {rideBadge.label}
                  </Text>
                </View>

                <Text style={s.analyticsText}>
                  Total Bookings: {item.analytics?.totalBookings ?? 0} • Pending:{" "}
                  {item.analytics?.pendingCount ?? 0}
                </Text>
              </View>

              {/* Cancel button (active rides only) */}
              {item.status === "active" ? (
                <Pressable
                  onPress={() => onCancelRide(item.id)}
                  disabled={actionLoadingId === item.id}
                  style={[
                    s.cancelBtn,
                    actionLoadingId === item.id && s.cancelBtnDisabled,
                  ]}
                >
                  <Text style={s.cancelBtnText}>
                    {actionLoadingId === item.id ? "Cancelling..." : "Cancel Ride"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, padding: spacing.lg },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background },
    title: { ...typography.h3, color: theme.textPrimary, marginBottom: spacing.md },
    errorText: { color: theme.danger, ...typography.bodyMedium, marginBottom: spacing.md },
    emptyText: { marginTop: spacing.xl, color: theme.textMuted, ...typography.bodyMedium, textAlign: "center" },
    card: {
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      marginBottom: spacing.md,
      backgroundColor: theme.surface,
    },
    cardTitle: { ...typography.h4, color: theme.textPrimary, marginBottom: spacing.xs },
    detailsText: { ...typography.bodyMedium, color: theme.textSecondary, marginTop: 4 },
    statsContainer: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: theme.border },
    statsMain: { ...typography.bodyMedium, color: theme.textPrimary, fontWeight: "600" },
    progressBarTrack: {
      height: 8,
      backgroundColor: theme.surfaceElevated,
      borderRadius: 999,
      overflow: "hidden",
      marginTop: spacing.sm,
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: theme.primary,
    },
    fullText: { marginTop: spacing.sm, color: theme.success, ...typography.captionMedium },
    badgeRow: {
      marginTop: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    badge: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
    },
    badgeText: { ...typography.label },
    analyticsText: { color: theme.textMuted, ...typography.captionMedium },
    cancelBtn: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.surface,
    },
    cancelBtnDisabled: { opacity: 0.6 },
    cancelBtnText: { color: theme.danger, ...typography.bodyMedium, fontWeight: "700" },
  });
}