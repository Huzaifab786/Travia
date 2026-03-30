import React, { useState, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  getMyBookingsApi,
  PassengerBooking,
  cancelMyBookingApi,
  deleteBookingApi,
} from "../api/myBookingsApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

export function MyBookingsScreen() {
  const { theme } = useTheme();
  const [bookings, setBookings] = useState<PassengerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadBookings = async () => {
    try {
      const res = await getMyBookingsApi();
      setBookings(res.bookings);
    } catch (e: any) {
      setError(e.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const onCancelBooking = (bookingId: string) => {
    Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setActionLoadingId(bookingId);
          try {
            await cancelMyBookingApi(bookingId);
            await loadBookings();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to cancel booking");
          } finally {
            setActionLoadingId(null);
          }
        },
      },
    ]);
  };

  const onDeleteBooking = (bookingId: string) => {
    Alert.alert("Delete History", "Remove this booking from your history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBookingApi(bookingId);
            setBookings((prev) => prev.filter((b) => b.id !== bookingId));
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to delete from history");
          }
        },
      },
    ]);
  };

  const getStatusInfo = (status: PassengerBooking["status"]) => {
    switch (status) {
      case "accepted":
        return { label: "Accepted", color: theme.success, bg: theme.successBg };
      case "pending":
        return { label: "Pending", color: theme.amber, bg: theme.amberBg };
      case "rejected":
        return { label: "Rejected", color: theme.danger, bg: theme.dangerBg };
      case "cancelled":
        return { label: "Cancelled", color: theme.textSecondary, bg: theme.surfaceElevated };
      default:
        return { label: status, color: theme.textSecondary, bg: theme.surfaceElevated };
    }
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
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>My Bookings</Text>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={theme.border} />
            <Text style={s.emptyText}>You haven't booked any rides yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = getStatusInfo(item.status);
          const canDelete = item.status !== "pending" && item.status !== "accepted";

          return (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.badge, { backgroundColor: status.bg }]}>
                  <Text style={[s.badgeText, { color: status.color }]}>
                    {status.label.toUpperCase()}
                  </Text>
                </View>
                {canDelete && (
                  <Pressable onPress={() => onDeleteBooking(item.id)} style={s.deleteIcon}>
                    <Ionicons name="trash-outline" size={20} color={theme.danger} />
                  </Pressable>
                )}
              </View>

              <View style={s.routeRow}>
                <Ionicons name="location" size={20} color={theme.primary} />
                <Text style={s.routeText} numberOfLines={1}>
                  {item.ride.pickup.address} → {item.ride.dropoff.address}
                </Text>
              </View>

              <View style={s.detailsRow}>
                <View style={s.detailItem}>
                  <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
                  <Text style={s.detailText}>{item.ride.driver.name}</Text>
                </View>
                <View style={s.detailItem}>
                  <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                  <Text style={s.detailText}>
                    {new Date(item.ride.departureTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>

              <View style={s.footerRow}>
                <Text style={s.priceText}>Rs {item.ride.price}</Text>
                <Text style={s.seatsText}>{item.seatsRequested} seats</Text>
              </View>

              {item.status === "pending" && (
                <Pressable
                  onPress={() => onCancelBooking(item.id)}
                  disabled={actionLoadingId === item.id}
                  style={s.cancelBtn}
                >
                  {actionLoadingId === item.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.cancelBtnText}>Cancel Booking</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    title: { ...typography.h1, color: theme.textPrimary },
    listContent: { padding: spacing.lg, paddingBottom: 40 },
    emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 100 },
    emptyText: { marginTop: spacing.md, ...typography.bodyMedium, color: theme.textMuted },
    card: { backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, shadowColor: theme.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
    badgeText: { ...typography.captionMedium, fontWeight: "800" },
    deleteIcon: { padding: spacing.xs },
    routeRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
    routeText: { marginLeft: 8, ...typography.bodyMedium, fontWeight: "700", color: theme.textPrimary, flex: 1 },
    detailsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: theme.border },
    detailItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    detailText: { ...typography.captionMedium, color: theme.textSecondary },
    footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    priceText: { ...typography.h3, color: theme.primary },
    seatsText: { ...typography.bodyMedium, color: theme.textMuted },
    cancelBtn: { marginTop: spacing.lg, backgroundColor: theme.danger, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
    cancelBtnText: { color: "#fff", ...typography.bodyMedium, fontWeight: "700" },
  });
}