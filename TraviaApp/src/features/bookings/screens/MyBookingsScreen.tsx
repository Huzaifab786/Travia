import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  getMyBookingsApi,
  PassengerBooking,
  cancelMyBookingApi,
  deleteBookingApi,
} from "../api/myBookingsApi";
import { createReviewApi } from "../../reviews/api/reviewApi";
import type { PassengerStackParamList } from "../../passenger/navigation/PassengerNavigator";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

export function MyBookingsScreen() {
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();

  const [bookings, setBookings] = useState<PassengerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(
    null,
  );
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<PassengerBooking | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const loadBookings = async () => {
    try {
      setError("");
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
    }, []),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      loadBookings();
    }, 5000); //every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const onCancelBooking = (bookingId: string) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
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
      ],
    );
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

  const onTrackLive = (booking: PassengerBooking) => {
    navigation.navigate("LiveRide", {
      rideId: booking.ride.id,
      pickupLat: booking.ride.pickup.lat,
      pickupLng: booking.ride.pickup.lng,
      dropoffLat: booking.ride.dropoff.lat,
      dropoffLng: booking.ride.dropoff.lng,
      encodedPolyline: booking.ride.encodedPolyline || null,
      driverPhone: booking.ride.driver.phone || null,
      meetupPoint: booking.meetupPoint || booking.ride.meetupPoints?.[0] || null,
    });
  };

  const onLeaveReview = (booking: PassengerBooking) => {
    setSelectedBooking(booking);
    setSelectedRating(5);
    setReviewComment("");
    setReviewModalVisible(true);
  };

  const onSubmitReview = async () => {
    if (!selectedBooking) return;

    try {
      setReviewingBookingId(selectedBooking.id);

      await createReviewApi({
        rideId: selectedBooking.ride.id,
        rating: selectedRating,
        comment: reviewComment.trim() || undefined,
      });

      setReviewModalVisible(false);
      setSelectedBooking(null);
      setReviewComment("");
      setSelectedRating(5);

      Alert.alert("Success", "Your review has been submitted.");
      await loadBookings();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit review");
    } finally {
      setReviewingBookingId(null);
    }
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
        return {
          label: "Cancelled",
          color: theme.textSecondary,
          bg: theme.surfaceElevated,
        };
      default:
        return {
          label: status,
          color: theme.textSecondary,
          bg: theme.surfaceElevated,
        };
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={theme.border} />
            <Text style={s.emptyText}>You haven't booked any rides yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = getStatusInfo(item.status);
          const canDelete =
            item.status !== "pending" && item.status !== "accepted";
          const canTrackLive =
            item.status === "accepted" &&
            (item.ride.status === "ready" ||
              item.ride.status === "in_progress");
          const canReview =
            item.status === "accepted" &&
            item.ride.status === "completed" &&
            !item.hasReviewed;
          const hasReviewed =
            item.status === "accepted" &&
            item.ride.status === "completed" &&
            item.hasReviewed;
          return (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.badge, { backgroundColor: status.bg }]}>
                  <Text style={[s.badgeText, { color: status.color }]}>
                    {status.label.toUpperCase()}
                  </Text>
                </View>

                {canDelete && (
                  <Pressable
                    onPress={() => onDeleteBooking(item.id)}
                    style={s.deleteIcon}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={theme.danger}
                    />
                  </Pressable>
                )}
              </View>

              <View style={s.routeRow}>
                <Text style={s.rideStatusText}>
                  Shared route ride:{" "}
                  {item.ride.status.replace("_", " ").toUpperCase()}
                </Text>
                <Ionicons name="location" size={20} color={theme.primary} />
                <Text style={s.routeText} numberOfLines={1}>
                  {item.ride.pickup.address} → {item.ride.dropoff.address}
                </Text>
              </View>

              {(item.passengerPickup || item.passengerDropoff) && (
                <View style={s.tripBox}>
                  <Text style={s.tripLabel}>Your trip</Text>
                  <Text style={s.tripText} numberOfLines={2}>
                    {item.passengerPickup?.label || "Pickup"}
                    {" \u2192 "}
                    {item.passengerDropoff?.label || "Dropoff"}
                  </Text>
                  {item.pricingQuote && (
                    <Text style={s.tripPriceText}>
                      Rs {Math.round(item.pricingQuote.totalPrice)} total · Rs {Math.round(item.pricingQuote.perSeatPrice)} / seat
                    </Text>
                  )}
                </View>
              )}

              {item.meetupPoint && (
                <View style={s.meetupBox}>
                  <Text style={s.meetupLabel}>Meetup point</Text>
                  <Text style={s.meetupText}>
                    {item.meetupPoint.label} · {item.meetupPoint.address || "Shared route zone"}
                  </Text>
                </View>
              )}

              <View style={s.detailsRow}>
                <View style={s.detailItem}>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={theme.textSecondary}
                  />
                  <Text style={s.detailText}>{item.ride.driver.name}</Text>
                </View>

                <View style={s.detailItem}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={theme.textSecondary}
                  />
                  <Text style={s.detailText}>
                    {new Date(item.ride.departureTime).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>

              <View style={s.footerRow}>
                <Text style={s.priceText}>Rs {item.ride.price}/seat</Text>
                <Text style={s.seatsText}>{item.seatsRequested} seats</Text>
              </View>

              {canTrackLive && (
                <Pressable onPress={() => onTrackLive(item)} style={s.trackBtn}>
                  <Ionicons name="radio-outline" size={18} color="#fff" />
                  <Text style={s.trackBtnText}>
                    {item.ride.status === "in_progress"
                      ? "Track Live"
                      : item.ride.status === "ready"
                        ? "View Ride"
                        : "Open"}
                  </Text>
                </Pressable>
              )}

              {canReview && (
                <Pressable
                  onPress={() => onLeaveReview(item)}
                  disabled={reviewingBookingId === item.id}
                  style={s.reviewBtn}
                >
                  {reviewingBookingId === item.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="star-outline" size={18} color="#fff" />
                      <Text style={s.reviewBtnText}>Leave Review</Text>
                    </>
                  )}
                </Pressable>
              )}
              {hasReviewed && (
                <View style={s.reviewedBox}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={theme.success}
                  />
                  <Text style={s.reviewedText}>Review submitted</Text>
                </View>
              )}

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
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Rate Your Ride</Text>
            <Text style={s.modalSubtitle}>
              Share your experience with the driver
            </Text>

            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  style={s.starBtn}
                >
                  <Ionicons
                    name={star <= selectedRating ? "star" : "star-outline"}
                    size={30}
                    color={theme.amber}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Write a comment (optional)"
              placeholderTextColor={theme.textMuted}
              multiline
              style={s.commentInput}
            />

            <View style={s.modalActions}>
              <Pressable
                onPress={() => setReviewModalVisible(false)}
                style={s.modalCancelBtn}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onSubmitReview}
                disabled={!!reviewingBookingId}
                style={s.modalSubmitBtn}
              >
                {reviewingBookingId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.modalSubmitText}>Submit Review</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { ...typography.h1, color: theme.textPrimary },
    listContent: { padding: spacing.lg, paddingBottom: 40 },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 100,
    },
    emptyText: {
      marginTop: spacing.md,
      ...typography.bodyMedium,
      color: theme.textMuted,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    badgeText: {
      ...typography.captionMedium,
      fontWeight: "800",
    },
    deleteIcon: { padding: spacing.xs },
    routeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    routeText: {
      marginLeft: 8,
      ...typography.bodyMedium,
      fontWeight: "700",
      color: theme.textPrimary,
      flex: 1,
    },
    tripBox: {
      marginBottom: spacing.md,
      backgroundColor: theme.primarySubtle,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: 4,
    },
    tripLabel: {
      ...typography.caption,
      color: theme.textMuted,
      textTransform: "uppercase",
    },
    tripText: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: "700",
    },
    tripPriceText: {
      ...typography.captionMedium,
      color: theme.primary,
      fontWeight: "700",
    },
    meetupBox: {
      marginBottom: spacing.md,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    meetupLabel: {
      ...typography.caption,
      color: theme.textMuted,
      textTransform: "uppercase",
    },
    meetupText: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      marginTop: 2,
    },
    detailsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    detailItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    detailText: { ...typography.captionMedium, color: theme.textSecondary },
    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    priceText: { ...typography.h3, color: theme.primary },
    seatsText: { ...typography.bodyMedium, color: theme.textMuted },
    trackBtn: {
      marginTop: spacing.lg,
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    trackBtnText: {
      color: "#fff",
      ...typography.bodyMedium,
      fontWeight: "700",
    },
    cancelBtn: {
      marginTop: spacing.lg,
      backgroundColor: theme.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    cancelBtnText: {
      color: "#fff",
      ...typography.bodyMedium,
      fontWeight: "700",
    },
    rideStatusText: {
      marginTop: 4,
      ...typography.captionMedium,
      color: theme.textSecondary,
    },
    reviewBtn: {
      marginTop: spacing.lg,
      backgroundColor: theme.amber,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    reviewBtnText: {
      color: "#fff",
      ...typography.bodyMedium,
      fontWeight: "700",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      padding: spacing.xl,
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
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
    starsRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    starBtn: {
      marginHorizontal: 4,
    },
    commentInput: {
      minHeight: 100,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: spacing.md,
      color: theme.textPrimary,
      backgroundColor: theme.surfaceElevated,
      textAlignVertical: "top",
    },
    modalActions: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    modalCancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      backgroundColor: theme.surfaceElevated,
    },
    modalCancelText: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
      fontWeight: "700",
    },
    modalSubmitBtn: {
      flex: 1,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      backgroundColor: theme.primary,
    },
    modalSubmitText: {
      ...typography.bodyMedium,
      color: "#fff",
      fontWeight: "700",
    },
    reviewedBox: {
  marginTop: spacing.lg,
  backgroundColor: theme.successBg,
  borderRadius: radius.md,
  paddingVertical: spacing.md,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  gap: 8,
},
reviewedText: {
  color: theme.success,
  ...typography.bodyMedium,
  fontWeight: "700",
},
  });
}
