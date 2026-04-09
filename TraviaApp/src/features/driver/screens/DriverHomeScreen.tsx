import React, {
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { DriverStackParamList } from "../navigation/DriverNavigator";
import { AuthContext } from "../../../app/providers/AuthProvider";
import {
  getDriverRequestsApi,
  DriverBookingRequest,
  updateBookingStatusApi,
} from "../api/driverBookingApi";
import {
  getDriverRidesApi,
  completeRideApi,
  deleteRideApi,
} from "../api/driverRideApi";
import { getDriverStatusApi, DriverStatus } from "../api/driverApi";
import { Ride } from "../../passenger/api/rideApi";
import { Ionicons } from "@expo/vector-icons";
import { getMyVehicleApi, Vehicle } from "../api/vehicleApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { Skeleton } from "../../../components/common/Skeleton";

type RoutePoint = { lat: number; lng: number };

export function DriverHomeScreen() {
  const { theme } = useTheme();
  const { user } = useContext(AuthContext);
  const navigation =
    useNavigation<NativeStackNavigationProp<DriverStackParamList>>();

  const [requests, setRequests] = useState<DriverBookingRequest[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("unverified");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = (user?.user_metadata?.full_name ?? "Driver").split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const fetchData = async () => {
    try {
      setError("");
      const [requestsRes, ridesRes, vehicleRes, statusRes] = await Promise.all([
        getDriverRequestsApi(),
        getDriverRidesApi(),
        getMyVehicleApi(),
        getDriverStatusApi(),
      ]);
      setRequests(requestsRes.bookings);
      setMyRides(ridesRes.rides);
      setVehicle(vehicleRes.vehicle);
      setDriverStatus(statusRes.status);
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  const onBookingAction = async (
    bookingId: string,
    action: "accept" | "reject",
  ) => {
    setActionLoadingId(bookingId);
    try {
      await updateBookingStatusApi(bookingId, action);
      setRequests((prev) => prev.filter((b) => b.id !== bookingId));
      const ridesRes = await getDriverRidesApi();
      setMyRides(ridesRes.rides);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Action failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const onCompleteRide = (rideId: string) => {
    Alert.alert("Complete Ride", "Mark this ride as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Complete",
        onPress: async () => {
          try {
            await completeRideApi(rideId);
            await fetchData();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to complete ride");
          }
        },
      },
    ]);
  };

  const onDeleteRide = (rideId: string) => {
    Alert.alert("Delete Ride", "Remove this ride from history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRideApi(rideId);
            setMyRides((prev) => prev.filter((r) => r.id !== rideId));
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to delete ride");
          }
        },
      },
    ]);
  };

  const s = makeStyles(theme);
  const activeRides = myRides.filter((r) =>
    ["active", "ready", "in_progress"].includes((r as any).status),
  ).length;
  const completedRides = myRides.filter(
    (r) => (r as any).status === "completed",
  ).length;

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <View>
            <Skeleton
              width={120}
              height={14}
              variant="rounded"
              style={{ marginBottom: 4 }}
            />
            <Skeleton width={180} height={28} variant="rounded" />
          </View>
        </View>

        <View style={s.statsRow}>
          <Skeleton width="30%" height={100} variant="rounded" />
          <Skeleton width="30%" height={100} variant="rounded" />
          <Skeleton width="30%" height={100} variant="rounded" />
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: 16 }}>
          <Skeleton width="100%" height={80} variant="rounded" />
          <Skeleton width="100%" height={60} variant="rounded" />
          <Skeleton width="100%" height={120} variant="rounded" />
          <Skeleton width="100%" height={120} variant="rounded" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={theme.primary}
          />
        }
      >
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>
              {greeting}, {firstName} 👋
            </Text>
            <Text style={s.headerTitle}>Driver Dashboard</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <StatCard
            icon="car-outline"
            label="Active"
            value={activeRides}
            color={theme.success}
            theme={theme}
          />
          <StatCard
            icon="checkmark-circle-outline"
            label="Completed"
            value={completedRides}
            color={theme.primary}
            theme={theme}
          />
          <StatCard
            icon="people-outline"
            label="Requests"
            value={requests.length}
            color={theme.amber}
            theme={theme}
          />
        </View>

        {driverStatus !== "verified" && (
          <Pressable
            onPress={() => navigation.navigate("DriverVerification")}
            style={[
              s.actionCard,
              {
                borderColor:
                  driverStatus === "rejected" || driverStatus === "suspended"
                    ? theme.danger
                    : theme.amber,
                borderWidth: 1.5,
              },
            ]}
          >
            <View
              style={[
                s.actionIcon,
                {
                  backgroundColor:
                    driverStatus === "rejected" ||
                    driverStatus === "suspended"
                      ? theme.dangerBg
                      : theme.amberBg,
                },
              ]}
            >
              <Ionicons
                name={
                  driverStatus === "pending"
                    ? "hourglass-outline"
                    : driverStatus === "rejected" ||
                        driverStatus === "suspended"
                      ? "close-circle-outline"
                      : "shield-outline"
                }
                size={22}
                color={
                  driverStatus === "rejected" || driverStatus === "suspended"
                    ? theme.danger
                    : theme.amber
                }
              />
            </View>
            <View style={s.actionTextGroup}>
              <Text style={s.actionTitle}>
                {driverStatus === "unverified"
                  ? "Identity Verification"
                  : driverStatus === "pending"
                    ? "Review in Progress"
                    : driverStatus === "suspended"
                      ? "Account Suspended"
                      : "Verification Rejected"}
              </Text>
              <Text style={s.actionSubtitle}>
                {driverStatus === "unverified"
                  ? "Verify your account to start picking up passengers"
                  : driverStatus === "pending"
                    ? "We're checking your documents. Please wait."
                    : driverStatus === "suspended"
                      ? "Your account has been suspended by admin. Contact support."
                      : "Tap to re-upload clear documents"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.textMuted}
            />
          </Pressable>
        )}

        <Pressable
          onPress={() => {
            if (!vehicle) {
              Alert.alert(
                "Vehicle Required",
                "Please setup your vehicle profile first.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Setup Now",
                    onPress: () => navigation.navigate("VehicleDetails"),
                  },
                ],
              );
              return;
            }
            navigation.navigate("CreateRide");
          }}
          style={[s.createRideBtn, !vehicle && { opacity: 0.6 }]}
        >
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={s.createRideText}>Create New Ride</Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color="#fff"
            style={{ marginLeft: "auto" }}
          />
        </Pressable>

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

        {requests.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Pending Requests</Text>
              <View style={s.countBadge}>
                <Text style={s.countBadgeText}>{requests.length}</Text>
              </View>
            </View>

            {requests.map((item) => (
              <View key={item.id} style={s.card}>
                <View style={s.routeRow}>
                  <Ionicons
                    name="navigate-outline"
                    size={16}
                    color={theme.primary}
                  />
                  <Text style={s.routeText} numberOfLines={1}>
                    {item.ride.pickup.address} → {item.ride.dropoff.address}
                  </Text>
                </View>

                <View style={s.routeTypeRow}>
                  <View style={s.routeTypeBadge}>
                    <Ionicons name="map-outline" size={12} color={theme.primary} />
                    <Text style={s.routeTypeText}>Shared route ride</Text>
                  </View>
                </View>

                {(item.passengerPickup || item.passengerDropoff) && (
                  <View style={s.tripBox}>
                  <Text style={s.tripLabel}>Passenger trip</Text>
                  <Text style={s.tripText} numberOfLines={2}>
                      {item.passengerPickup?.label || "Pickup"}
                      {" \u2192 "}
                      {item.passengerDropoff?.label || "Dropoff"}
                    </Text>
                    {item.pricingQuote && (
                      <View style={s.tripPriceRow}>
                        <View style={s.tripPricePill}>
                          <Ionicons name="cash-outline" size={12} color={theme.primary} />
                          <Text style={s.tripPriceText}>
                            Rs {Math.round(item.pricingQuote.totalPrice)} total
                          </Text>
                        </View>
                        <Text style={s.tripPriceSub}>
                          {Math.round(item.pricingQuote.perSeatPrice)} per seat
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={s.requestMeta}>
                  <View style={s.chip}>
                    <Ionicons
                      name="person-outline"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <Text style={s.chipText}>{item.passenger.name}</Text>
                  </View>
                    <View style={s.chip}>
                      <Ionicons
                        name="people-outline"
                        size={12}
                        color={theme.textSecondary}
                      />
                      <Text style={s.chipText}>
                        {item.seatsRequested} seat
                        {item.seatsRequested > 1 ? "s" : ""}
                      </Text>
                    </View>

                    {item.meetupPoint && (
                      <View style={s.chip}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={theme.textSecondary}
                        />
                        <Text style={s.chipText}>{item.meetupPoint.label}</Text>
                      </View>
                    )}
                  </View>

                <View style={s.actionRow}>
                  <Pressable
                    onPress={() => onBookingAction(item.id, "reject")}
                    disabled={actionLoadingId === item.id}
                    style={s.rejectBtn}
                  >
                    {actionLoadingId === item.id ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.textSecondary}
                      />
                    ) : (
                      <Text style={s.rejectBtnText}>Decline</Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => onBookingAction(item.id, "accept")}
                    disabled={actionLoadingId === item.id}
                    style={s.acceptBtn}
                  >
                    {actionLoadingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.acceptBtnText}>Accept</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>My Rides</Text>

          {myRides.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="car-outline" size={48} color={theme.textMuted} />
              <Text style={s.emptyText}>
                No rides yet. Create your first ride!
              </Text>
            </View>
          ) : (
            myRides.map((ride) => {
              const acceptedSeats = (ride as any).analytics?.acceptedSeats ?? 0;
              const pendingCount = (ride as any).analytics?.pendingCount ?? 0;

              const statusColor =
                ride.status === "completed"
                  ? theme.primary
                  : ride.status === "cancelled"
                    ? theme.danger
                    : ride.status === "in_progress"
                      ? theme.amber
                      : ride.status === "ready"
                        ? theme.primary
                        : theme.success;

              const statusBg =
                ride.status === "completed"
                  ? theme.primarySubtle
                  : ride.status === "cancelled"
                    ? theme.dangerBg
                    : ride.status === "in_progress"
                      ? theme.amberBg
                      : ride.status === "ready"
                        ? theme.primarySubtle
                        : theme.successBg;

              const statusLabel =
                ride.status === "in_progress"
                  ? "LIVE"
                  : ride.status === "ready"
                    ? "READY"
                    : ride.status.toUpperCase();

              const isWaitingForPassengers = ride.status === "active";
              const isReadyToStart = ride.status === "ready";
              const isLiveRide = ride.status === "in_progress";

              return (
                <View key={ride.id} style={s.card}>
                  <View style={s.cardTopRow}>
                    <View
                      style={[s.statusBadge, { backgroundColor: statusBg }]}
                    >
                      <Text style={[s.statusText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>

                    {!["active", "ready", "in_progress"].includes(
                      (ride as any).status,
                    ) && (
                      <Pressable
                        onPress={() => onDeleteRide(ride.id)}
                        style={s.deleteBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={theme.danger}
                        />
                      </Pressable>
                    )}
                  </View>

                  <View style={s.routeRow}>
                    <Ionicons
                      name="navigate-outline"
                      size={16}
                      color={theme.primary}
                    />
                    <Text style={s.routeText} numberOfLines={1}>
                      {ride.pickup.address} → {ride.dropoff.address}
                    </Text>
                  </View>

                  <View style={s.requestMeta}>
                    <View style={s.chip}>
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={theme.textSecondary}
                      />
                      <Text style={s.chipText}>
                        {new Date(ride.departureTime).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {new Date(ride.departureTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>

                    <View style={s.chip}>
                      <Ionicons
                        name="cash-outline"
                        size={12}
                        color={theme.textSecondary}
                      />
                      <Text style={s.chipText}>Rs {ride.price}</Text>
                    </View>

                    <View style={s.chip}>
                      <Ionicons
                        name="people-outline"
                        size={12}
                        color={theme.textSecondary}
                      />
                      <Text style={s.chipText}>{acceptedSeats} accepted</Text>
                    </View>

                    <View style={s.chip}>
                      <Ionicons
                        name="hourglass-outline"
                        size={12}
                        color={theme.textSecondary}
                      />
                      <Text style={s.chipText}>{pendingCount} pending</Text>
                    </View>
                  </View>

                  {isWaitingForPassengers && (
                    <View style={s.waitingBox}>
                      <View style={s.waitingHeader}>
                        <Ionicons
                          name="hourglass-outline"
                          size={16}
                          color={theme.amber}
                        />
                        <Text style={s.waitingTitle}>
                          Waiting for passengers
                        </Text>
                      </View>
                      <Text style={s.waitingSubtitle}>
                        This ride is published and visible to passengers. Once
                        at least one booking is accepted, the ride will become
                        ready to start.
                      </Text>
                    </View>
                  )}

                  {isReadyToStart && (
                    <View style={s.actionRow}>
                      <Pressable
                        onPress={() => {
                          const acceptedBooking = (ride as any).acceptedBookings?.[0];
                          navigation.navigate("DriverLiveRide", {
                            rideId: ride.id,
                            pickupLat: ride.pickup.lat,
                            pickupLng: ride.pickup.lng,
                            dropoffLat: ride.dropoff.lat,
                            dropoffLng: ride.dropoff.lng,
                            encodedPolyline: (ride as any).encodedPolyline,
                            passengerName: acceptedBooking?.passenger?.name || null,
                            passengerPhone: acceptedBooking?.passenger?.phone || null,
                            meetupPoint: acceptedBooking?.meetupPoint || null,
                          });
                        }}
                        style={s.broadcastBtn}
                      >
                        <Ionicons
                          name="radio-outline"
                          size={16}
                          color={theme.primary}
                        />
                        <Text style={s.broadcastBtnText}>Open Live Ride</Text>
                      </Pressable>
                    </View>
                  )}

                  {isLiveRide && (
                    <View style={s.actionRow}>
                      <Pressable
                        onPress={() => {
                          const acceptedBooking = (ride as any).acceptedBookings?.[0];
                          navigation.navigate("DriverLiveRide", {
                            rideId: ride.id,
                            pickupLat: ride.pickup.lat,
                            pickupLng: ride.pickup.lng,
                            dropoffLat: ride.dropoff.lat,
                            dropoffLng: ride.dropoff.lng,
                            encodedPolyline: (ride as any).encodedPolyline,
                            passengerName: acceptedBooking?.passenger?.name || null,
                            passengerPhone: acceptedBooking?.passenger?.phone || null,
                            meetupPoint: acceptedBooking?.meetupPoint || null,
                          });
                        }}
                        style={s.broadcastBtn}
                      >
                        <Ionicons
                          name="radio-outline"
                          size={16}
                          color={theme.primary}
                        />
                        <Text style={s.broadcastBtnText}>Resume Live</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => onCompleteRide(ride.id)}
                        style={s.completeBtn}
                      >
                        <Ionicons
                          name="checkmark-done-outline"
                          size={16}
                          color="#fff"
                        />
                        <Text style={s.completeBtnText}>Complete</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, color, theme }: any) {
  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      marginHorizontal: 4,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: color + "22",
      marginBottom: 6,
    },
    value: { ...typography.h2, color: theme.textPrimary },
    label: { ...typography.caption, color: theme.textSecondary, marginTop: 2 },
  });

  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    loadingText: { ...typography.body, color: theme.textSecondary },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    greeting: {
      ...typography.caption,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    headerTitle: { ...typography.h2, color: theme.textPrimary },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },

    actionCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      gap: spacing.md,
    },
    actionIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    actionTextGroup: { flex: 1 },
    actionTitle: { ...typography.h4, color: theme.textPrimary },
    actionSubtitle: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },

    createRideBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.primary,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
    },
    createRideText: { ...typography.h4, color: "#fff" },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.dangerBg,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    errorText: { ...typography.caption, color: theme.danger },

    section: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: spacing.md,
    },
    sectionTitle: { ...typography.h3, color: theme.textPrimary },
    countBadge: {
      backgroundColor: theme.amberBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    countBadgeText: { ...typography.label, color: theme.amber },

    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      gap: spacing.md,
    },
    cardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    statusText: { ...typography.label },
    deleteBtn: { padding: 4 },

    routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    routeText: { ...typography.bodyMedium, color: theme.textPrimary, flex: 1 },
    routeTypeRow: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginTop: 8,
      marginBottom: 8,
    },
    routeTypeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.primarySubtle,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
    },
    routeTypeText: { ...typography.captionMedium, color: theme.primary, fontWeight: "700" },

    tripBox: {
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: 6,
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
    tripPriceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 2,
    },
    tripPricePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: theme.primarySubtle,
    },
    tripPriceText: {
      ...typography.captionMedium,
      color: theme.primary,
      fontWeight: "700",
    },
    tripPriceSub: {
      ...typography.captionMedium,
      color: theme.textSecondary,
    },

    requestMeta: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipText: { ...typography.captionMedium, color: theme.textSecondary },

    actionRow: { flexDirection: "row", gap: spacing.md },
    rejectBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    rejectBtnText: { ...typography.bodySemiBold, color: theme.textSecondary },
    acceptBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: theme.primary,
      alignItems: "center",
    },
    acceptBtnText: { ...typography.bodySemiBold, color: "#fff" },

    broadcastBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.md,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.primary + "44",
    },
    broadcastBtnText: { ...typography.bodySemiBold, color: theme.primary },

    completeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.success,
      borderRadius: radius.md,
      paddingVertical: 10,
    },
    completeBtnText: { ...typography.bodySemiBold, color: "#fff" },

    emptyBox: {
      alignItems: "center",
      padding: spacing["3xl"],
      gap: spacing.md,
    },
    emptyText: {
      ...typography.body,
      color: theme.textMuted,
      textAlign: "center",
    },

    waitingBox: {
      backgroundColor: theme.amberBg,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.amber + "33",
      gap: spacing.sm,
    },
    waitingHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    waitingTitle: {
      ...typography.bodySemiBold,
      color: theme.amber,
    },
    waitingSubtitle: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      lineHeight: 18,
    },
  });
}
