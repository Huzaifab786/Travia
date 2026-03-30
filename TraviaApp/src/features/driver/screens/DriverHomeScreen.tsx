import React, { useContext, useEffect, useState, useRef, useCallback } from "react";
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
import * as Location from "expo-location";
import { updateLocationApi } from "../../tracking/api/trackingApi";
import { getMyVehicleApi, Vehicle } from "../api/vehicleApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { Skeleton } from "../../../components/common/Skeleton";

type RoutePoint = { lat: number; lng: number };

export function DriverHomeScreen() {
  const { theme } = useTheme();
  const { user } = useContext(AuthContext);
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();

  const [requests, setRequests] = useState<DriverBookingRequest[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("unverified");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastRideId, setBroadcastRideId] = useState<string | null>(null);
  const broadcastInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const demoRouteIndexRef = useRef(0);

  const firstName = (user?.user_metadata?.full_name ?? "Driver").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

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

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const stopBroadcasting = () => {
    if (broadcastInterval.current) {
      clearInterval(broadcastInterval.current);
      broadcastInterval.current = null;
    }
    demoRouteIndexRef.current = 0;
    setIsBroadcasting(false);
    setBroadcastRideId(null);
  };

  useEffect(() => () => stopBroadcasting(), []);

  const parseRidePolyline = (ride: Ride): RoutePoint[] => {
    const raw = (ride as any).encodedPolyline;
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed)
        ? parsed.filter((p) => p && typeof p.lat === "number" && typeof p.lng === "number")
        : [];
    } catch { return []; }
  };

  const startRealBroadcasting = async (rideId: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Location permission is required to broadcast.");
      return;
    }
    setBroadcastRideId(rideId);
    setIsBroadcasting(true);
    const sendLocation = async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await updateLocationApi(rideId, loc.coords.latitude, loc.coords.longitude);
      } catch { }
    };
    await sendLocation();
    broadcastInterval.current = setInterval(sendLocation, 15000);
  };

  const startDemoBroadcasting = async (ride: Ride) => {
    const polyline = parseRidePolyline(ride);
    if (polyline.length < 2) {
      Alert.alert("Demo Error", "This ride has no route points saved.");
      return;
    }
    setBroadcastRideId(ride.id);
    setIsBroadcasting(true);
    demoRouteIndexRef.current = 0;
    const sendDemo = async () => {
      try {
        const idx = demoRouteIndexRef.current;
        const pt = polyline[idx];
        await updateLocationApi(ride.id, pt.lat, pt.lng);
        demoRouteIndexRef.current = idx >= polyline.length - 1 ? 0 : idx + 1;
      } catch { }
    };
    await sendDemo();
    broadcastInterval.current = setInterval(sendDemo, 4000);
  };

  const startBroadcasting = async (ride: Ride) => {
    if (isBroadcasting) {
      Alert.alert("Already Broadcasting", "Stop the current session first.");
      return;
    }
    demoMode ? await startDemoBroadcasting(ride) : await startRealBroadcasting(ride.id);
  };

  const onBookingAction = async (bookingId: string, action: "accept" | "reject") => {
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
            if (broadcastRideId === rideId) stopBroadcasting();
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
  const activeRides = myRides.filter((r) => r.status === "active").length;
  const completedRides = myRides.filter((r) => r.status === "completed").length;

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
            <View>
              <Skeleton width={120} height={14} variant="rounded" style={{ marginBottom: 4 }} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={s.headerTitle}>Driver Dashboard</Text>
          </View>
          {isBroadcasting && (
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <StatCard icon="car-outline" label="Active" value={activeRides} color={theme.success} theme={theme} />
          <StatCard icon="checkmark-circle-outline" label="Completed" value={completedRides} color={theme.primary} theme={theme} />
          <StatCard icon="people-outline" label="Requests" value={requests.length} color={theme.amber} theme={theme} />
        </View>

        {/* KYC Status Card */}
        {driverStatus !== "verified" && (
          <Pressable
            onPress={() => navigation.navigate("DriverVerification")}
            style={[
              s.actionCard,
              {
                borderColor: driverStatus === "rejected" ? theme.danger : theme.amber,
                borderWidth: 1.5,
              },
            ]}
          >
            <View
              style={[
                s.actionIcon,
                {
                  backgroundColor:
                    driverStatus === "rejected" ? theme.dangerBg : theme.amberBg,
                },
              ]}
            >
              <Ionicons
                name={
                  driverStatus === "pending"
                    ? "hourglass-outline"
                    : driverStatus === "rejected"
                    ? "close-circle-outline"
                    : "shield-outline"
                }
                size={22}
                color={driverStatus === "rejected" ? theme.danger : theme.amber}
              />
            </View>
            <View style={s.actionTextGroup}>
              <Text style={s.actionTitle}>
                {driverStatus === "unverified"
                  ? "Identity Verification"
                  : driverStatus === "pending"
                  ? "Review in Progress"
                  : "Verification Rejected"}
              </Text>
              <Text style={s.actionSubtitle}>
                {driverStatus === "unverified"
                  ? "Verify your account to start picking up passengers"
                  : driverStatus === "pending"
                  ? "We're checking your documents. Please wait."
                  : "Tap to re-upload clear documents"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>
        )}

        {/* Create Ride */}
        <Pressable
          onPress={() => {
            // NOTE: Temporarily removed the verification check for testing
            /*
            if (driverStatus !== "verified") {
              Alert.alert(
                "Verification Required",
                "You must be verified before you can create rides.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Verify Now",
                    onPress: () => navigation.navigate("DriverVerification"),
                  },
                ]
              );
              return;
            }
            */
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
                ]
              );
              return;
            }
            navigation.navigate("CreateRide");
          }}
          style={[
            s.createRideBtn,
            // (driverStatus !== "verified" || !vehicle) && { opacity: 0.6 },
            (!vehicle) && { opacity: 0.6 },
          ]}
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

        {/* Demo Mode Toggle */}
        <Pressable
          onPress={() => setDemoMode((p) => !p)}
          style={[s.demoCard, demoMode && { borderColor: theme.primary }]}
        >
          <View style={[s.actionIcon, { backgroundColor: demoMode ? theme.primarySubtle : theme.surfaceElevated }]}>
            <Ionicons name={demoMode ? "flask" : "flask-outline"} size={20} color={demoMode ? theme.primary : theme.textSecondary} />
          </View>
          <View style={s.actionTextGroup}>
            <Text style={s.actionTitle}>Demo Movement Mode</Text>
            <Text style={s.actionSubtitle}>{demoMode ? "Simulating route GPS" : "Using real device GPS"}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: demoMode ? theme.primarySubtle : theme.surfaceElevated }]}>
            <Text style={[s.badgeText, { color: demoMode ? theme.primary : theme.textMuted }]}>
              {demoMode ? "ON" : "OFF"}
            </Text>
          </View>
        </Pressable>

        {/* Broadcasting banner */}
        {isBroadcasting && (
          <View style={s.broadcastBanner}>
            <View style={s.broadcastLeft}>
              <View style={s.broadcastDot} />
              <Text style={s.broadcastText}>{demoMode ? "Demo mode broadcasting" : "Live location broadcasting"}</Text>
            </View>
            <Pressable onPress={stopBroadcasting} style={s.stopBtn}>
              <Text style={s.stopBtnText}>Stop</Text>
            </Pressable>
          </View>
        )}

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Pending Requests */}
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
                  <Ionicons name="navigate-outline" size={16} color={theme.primary} />
                  <Text style={s.routeText} numberOfLines={1}>
                    {item.ride.pickup.address} → {item.ride.dropoff.address}
                  </Text>
                </View>
                <View style={s.requestMeta}>
                  <View style={s.chip}>
                    <Ionicons name="person-outline" size={12} color={theme.textSecondary} />
                    <Text style={s.chipText}>{item.passenger.name}</Text>
                  </View>
                  <View style={s.chip}>
                    <Ionicons name="people-outline" size={12} color={theme.textSecondary} />
                    <Text style={s.chipText}>{item.seatsRequested} seat{item.seatsRequested > 1 ? "s" : ""}</Text>
                  </View>
                </View>
                <View style={s.actionRow}>
                  <Pressable
                    onPress={() => onBookingAction(item.id, "reject")}
                    disabled={actionLoadingId === item.id}
                    style={s.rejectBtn}
                  >
                    {actionLoadingId === item.id ? <ActivityIndicator size="small" color={theme.textSecondary} /> : <Text style={s.rejectBtnText}>Decline</Text>}
                  </Pressable>
                  <Pressable
                    onPress={() => onBookingAction(item.id, "accept")}
                    disabled={actionLoadingId === item.id}
                    style={s.acceptBtn}
                  >
                    {actionLoadingId === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.acceptBtnText}>Accept</Text>}
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* My Rides */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>My Rides</Text>
          {myRides.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="car-outline" size={48} color={theme.textMuted} />
              <Text style={s.emptyText}>No rides yet. Create your first ride!</Text>
            </View>
          ) : (
            myRides.map((ride) => {
              const statusColor = ride.status === "completed" ? theme.primary : ride.status === "cancelled" ? theme.danger : theme.success;
              const statusBg = ride.status === "completed" ? theme.primarySubtle : ride.status === "cancelled" ? theme.dangerBg : theme.successBg;
              return (
                <View key={ride.id} style={s.card}>
                  <View style={s.cardTopRow}>
                    <View style={[s.statusBadge, { backgroundColor: statusBg }]}>
                      <Text style={[s.statusText, { color: statusColor }]}>{ride.status.toUpperCase()}</Text>
                    </View>
                    {ride.status !== "active" && (
                      <Pressable onPress={() => onDeleteRide(ride.id)} style={s.deleteBtn}>
                        <Ionicons name="trash-outline" size={18} color={theme.danger} />
                      </Pressable>
                    )}
                  </View>
                  <View style={s.routeRow}>
                    <Ionicons name="navigate-outline" size={16} color={theme.primary} />
                    <Text style={s.routeText} numberOfLines={1}>{ride.pickup.address} → {ride.dropoff.address}</Text>
                  </View>
                  <View style={s.requestMeta}>
                    <View style={s.chip}>
                      <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                      <Text style={s.chipText}>
                        {new Date(ride.departureTime).toLocaleDateString([], { month: "short", day: "numeric" })}{" · "}
                        {new Date(ride.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                    <View style={s.chip}>
                      <Ionicons name="cash-outline" size={12} color={theme.textSecondary} />
                      <Text style={s.chipText}>Rs {ride.price}</Text>
                    </View>
                  </View>
                  {ride.status === "active" && (
                    <View style={s.actionRow}>
                      {!isBroadcasting ? (
                        <Pressable onPress={() => startBroadcasting(ride)} style={s.broadcastBtn}>
                          <Ionicons name={demoMode ? "flask-outline" : "radio-outline"} size={16} color={theme.primary} />
                          <Text style={s.broadcastBtnText}>{demoMode ? "Run Demo" : "Go Live"}</Text>
                        </Pressable>
                      ) : broadcastRideId === ride.id ? (
                        <View style={s.liveActiveRow}>
                          <View style={s.liveDot} />
                          <Text style={s.liveActiveText}>{demoMode ? "Demo Live" : "Broadcasting"}</Text>
                        </View>
                      ) : null}
                      <Pressable onPress={() => onCompleteRide(ride.id)} style={s.completeBtn}>
                        <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
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
      width: 40, height: 40, borderRadius: radius.md,
      justifyContent: "center", alignItems: "center",
      backgroundColor: color + "22", marginBottom: 6,
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
    center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    loadingText: { ...typography.body, color: theme.textSecondary },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    greeting: { ...typography.caption, color: theme.textSecondary, marginBottom: 2 },
    headerTitle: { ...typography.h2, color: theme.textPrimary },
    livePill: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: theme.dangerBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.danger },
    liveText: { ...typography.label, color: theme.danger },

    statsRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },

    actionCard: {
      flexDirection: "row", alignItems: "center",
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
      width: 44, height: 44, borderRadius: radius.md,
      justifyContent: "center", alignItems: "center",
    },
    actionTextGroup: { flex: 1 },
    actionTitle: { ...typography.h4, color: theme.textPrimary },
    actionSubtitle: { ...typography.caption, color: theme.textSecondary, marginTop: 2 },

    createRideBtn: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: theme.primary,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
    },
    createRideText: { ...typography.h4, color: "#fff" },

    demoCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: theme.surface,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      gap: spacing.md,
    },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
    badgeText: { ...typography.label },

    broadcastBanner: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: theme.dangerBg,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.danger + "44",
    },
    broadcastLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    broadcastDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.danger },
    broadcastText: { ...typography.captionMedium, color: theme.danger },
    stopBtn: { backgroundColor: theme.danger, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.md },
    stopBtnText: { ...typography.captionMedium, color: "#fff" },

    errorBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: theme.dangerBg,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    errorText: { ...typography.caption, color: theme.danger },

    section: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md },
    sectionTitle: { ...typography.h3, color: theme.textPrimary },
    countBadge: { backgroundColor: theme.amberBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
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
    cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
    statusText: { ...typography.label },
    deleteBtn: { padding: 4 },

    routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    routeText: { ...typography.bodyMedium, color: theme.textPrimary, flex: 1 },

    requestMeta: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    chip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: radius.sm, borderWidth: 1, borderColor: theme.border,
    },
    chipText: { ...typography.captionMedium, color: theme.textSecondary },

    actionRow: { flexDirection: "row", gap: spacing.md },
    rejectBtn: {
      flex: 1, paddingVertical: 10, borderRadius: radius.md,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center", borderWidth: 1, borderColor: theme.border,
    },
    rejectBtnText: { ...typography.bodySemiBold, color: theme.textSecondary },
    acceptBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: theme.primary, alignItems: "center" },
    acceptBtnText: { ...typography.bodySemiBold, color: "#fff" },

    broadcastBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.md, paddingVertical: 10,
      borderWidth: 1, borderColor: theme.primary + "44",
    },
    broadcastBtnText: { ...typography.bodySemiBold, color: theme.primary },
    liveActiveRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
    liveActiveText: { ...typography.bodySemiBold, color: theme.success },

    completeBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: theme.success, borderRadius: radius.md, paddingVertical: 10,
    },
    completeBtnText: { ...typography.bodySemiBold, color: "#fff" },

    emptyBox: { alignItems: "center", padding: spacing["3xl"], gap: spacing.md },
    emptyText: { ...typography.body, color: theme.textMuted, textAlign: "center" },
  });
}