import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { PassengerStackParamList } from "../navigation/PassengerNavigator";
import {
  createBookingApi,
  getMyBookingForRideApi,
  Booking,
} from "../../bookings/api/bookingApi";
import { getRideRouteApi, RoutePoint } from "../../map/api/routeApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type RideDetailsRouteProp = RouteProp<PassengerStackParamList, "RideDetails">;

export function RideDetailsScreen() {
  const { theme } = useTheme();
  const route = useRoute<RideDetailsRouteProp>();
  const navigation =
    useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const { ride } = route.params;

  const rideId = (ride as any).id;
  const availableSeats = Number(
    (ride as any).seatsTotal ?? (ride as any).seatsAvailable ?? 0,
  );
  const maxSeats = useMemo(() => Math.max(0, availableSeats), [availableSeats]);

  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [checking, setChecking] = useState(true);
  const [seatsRequested, setSeatsRequested] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [routeCoords, setRouteCoords] = useState<RoutePoint[]>([]);
  const [routeLoading, setRouteLoading] = useState(true);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const clampSeats = (n: number) => {
    if (maxSeats <= 0) return 0;
    if (n < 1) return 1;
    if (n > maxSeats) return maxSeats;
    return n;
  };

  const checkExistingBooking = async () => {
    const res = await getMyBookingForRideApi(rideId);
    setExistingBooking(res.booking);
    return res.booking;
  };

  useEffect(() => {
    setSeatsRequested((prev) => clampSeats(prev));
  }, [maxSeats]);

  useEffect(() => {
    const run = async () => {
      try {
        await checkExistingBooking();
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    };
    run();
  }, [rideId]);

  useEffect(() => {
    const loadRoute = async () => {
      try {
        const res = await getRideRouteApi(rideId);
        setRouteCoords(res.coordinates);
        setDistanceMeters(res.distanceMeters);
        setDurationSeconds(res.durationSeconds);
      } catch {
        setRouteCoords([
          { lat: ride.pickup.lat, lng: ride.pickup.lng },
          { lat: ride.dropoff.lat, lng: ride.dropoff.lng },
        ]);
      } finally {
        setRouteLoading(false);
      }
    };

    loadRoute();
  }, [
    rideId,
    ride.pickup.lat,
    ride.pickup.lng,
    ride.dropoff.lat,
    ride.dropoff.lng,
  ]);

  const onBook = async () => {
    setMessage("");

    if (checking) return;

    if (existingBooking) {
      setMessage(`✅ You already have a ${existingBooking.status} booking.`);
      return;
    }

    const seats = clampSeats(seatsRequested);
    if (seats <= 0) {
      setMessage("No seats available.");
      return;
    }

    setLoading(true);
    try {
      await createBookingApi({ rideId, seatsRequested: seats });
      await checkExistingBooking();
      setMessage("✅ Booking request sent (pending)");
    } catch (e: any) {
      setMessage(e.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const onTrackLive = () => {
    const polyline =
      (ride as any).encodedPolyline ||
      (routeCoords.length > 0 ? JSON.stringify(routeCoords) : null);

    navigation.navigate("LiveRide", {
      rideId,
      pickupLat: ride.pickup.lat,
      pickupLng: ride.pickup.lng,
      dropoffLat: ride.dropoff.lat,
      dropoffLng: ride.dropoff.lng,
      encodedPolyline: polyline,
    });
  };

  const isDisabled = loading || checking || !!existingBooking || maxSeats <= 0;
  const isAccepted = existingBooking?.status === "accepted";

  const latitudeDelta = Math.max(
    Math.abs(ride.pickup.lat - ride.dropoff.lat) * 2,
    0.05,
  );
  const longitudeDelta = Math.max(
    Math.abs(ride.pickup.lng - ride.dropoff.lng) * 2,
    0.05,
  );

  const initialRegion = {
    latitude: (ride.pickup.lat + ride.dropoff.lat) / 2,
    longitude: (ride.pickup.lng + ride.dropoff.lng) / 2,
    latitudeDelta,
    longitudeDelta,
  };

  const distanceKm = (distanceMeters / 1000).toFixed(1);
  const durationMin = Math.ceil(durationSeconds / 60);

  const polylineCoords = routeCoords
    .filter(
      (point) =>
        point &&
        typeof point.lat === "number" &&
        typeof point.lng === "number",
    )
    .map((point) => ({
      latitude: point.lat,
      longitude: point.lng,
    }));

  const s = makeStyles(theme);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.routeHeader}>
        <View style={s.routePoint}>
          <View style={[s.routeDot, { backgroundColor: theme.primary }]} />
          <Text style={s.routeAddress} numberOfLines={1}>
            {ride.pickup.address}
          </Text>
        </View>
        <View style={s.routeLine} />
        <View style={s.routePoint}>
          <View style={[s.routeDot, { backgroundColor: theme.danger }]} />
          <Text style={s.routeAddress} numberOfLines={1}>
            {ride.dropoff.address}
          </Text>
        </View>
      </View>

      <View style={s.mapContainer}>
        <MapView style={s.map} initialRegion={initialRegion}>
          <Marker
            coordinate={{
              latitude: ride.pickup.lat,
              longitude: ride.pickup.lng,
            }}
            title="Pickup"
            pinColor="green"
          />
          <Marker
            coordinate={{
              latitude: ride.dropoff.lat,
              longitude: ride.dropoff.lng,
            }}
            title="Dropoff"
            pinColor="red"
          />
          {polylineCoords.length > 0 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={theme.primary}
              strokeWidth={4}
            />
          )}
        </MapView>
      </View>

      {routeLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: 8 }} />
      ) : (
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="navigate" size={18} color={theme.primary} />
            <Text style={s.statValue}>{distanceKm} km</Text>
            <Text style={s.statLabel}>Distance</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="time-outline" size={18} color={theme.primary} />
            <Text style={s.statValue}>{durationMin} min</Text>
            <Text style={s.statLabel}>Est. Duration</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="cash-outline" size={18} color={theme.primary} />
            <Text style={s.statValue}>Rs {ride.price}</Text>
            <Text style={s.statLabel}>Fare</Text>
          </View>
        </View>
      )}

      <View style={s.card}>
        <View style={s.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
          <Text style={s.detailText}>
            {new Date(ride.departureTime).toLocaleString()}
          </Text>
        </View>
        <View style={s.detailRow}>
          <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
          <Text style={s.detailText}>{ride.driver.name}</Text>
        </View>
        <View style={s.detailRow}>
          <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
          <Text style={s.detailText}>{ride.driver.email}</Text>
        </View>
        <View style={s.detailRow}>
          <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
          <Text style={s.detailText}>{maxSeats} seats available</Text>
        </View>
      </View>

      {isAccepted && (
        <Pressable style={s.trackButton} onPress={onTrackLive}>
          <Ionicons name="location" size={20} color="#fff" />
          <Text style={s.trackButtonText}>Track Live</Text>
          <View style={s.liveBadge}>
            <Text style={s.liveBadgeText}>LIVE</Text>
          </View>
        </Pressable>
      )}

      {!existingBooking && (
        <View style={s.seatSection}>
          <Text style={s.seatLabel}>Seats to book</Text>
          <View style={s.seatRow}>
            <Pressable
              disabled={isDisabled || seatsRequested <= 1}
              onPress={() => setSeatsRequested((v) => clampSeats(v - 1))}
              style={[
                s.seatBtn,
                (isDisabled || seatsRequested <= 1) && s.seatBtnDisabled,
              ]}
            >
              <Text style={s.seatBtnText}>−</Text>
            </Pressable>
            <View style={s.seatCountBox}>
              <Text style={s.seatCount}>
                {maxSeats <= 0 ? 0 : seatsRequested}
              </Text>
            </View>
            <Pressable
              disabled={isDisabled || seatsRequested >= maxSeats}
              onPress={() => setSeatsRequested((v) => clampSeats(v + 1))}
              style={[
                s.seatBtn,
                (isDisabled || seatsRequested >= maxSeats) &&
                  s.seatBtnDisabled,
              ]}
            >
              <Text style={s.seatBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {checking ? (
        <ActivityIndicator color={theme.primary} />
      ) : existingBooking ? (
        <View
          style={[
            s.statusBadge,
            existingBooking.status === "accepted"
              ? s.statusAccepted
              : s.statusPending,
          ]}
        >
          <Text style={s.statusText}>
            {existingBooking.status === "accepted"
              ? "✅ Booking Accepted"
              : `📌 Booking ${existingBooking.status}`}
          </Text>
        </View>
      ) : null}

      {message ? (
        <Text
          style={[
            s.message,
            { color: message.startsWith("✅") ? theme.primary : theme.danger },
          ]}
        >
          {message}
        </Text>
      ) : null}

      {!existingBooking && (
        <Pressable
          onPress={onBook}
          disabled={isDisabled}
          style={[s.bookButton, isDisabled && s.bookButtonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={s.bookButtonText}>
              {maxSeats <= 0
                ? "No Seats Available"
                : `Book ${seatsRequested} Seat${seatsRequested === 1 ? "" : "s"}`}
            </Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
    routeHeader: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    routePoint: { flexDirection: "row", alignItems: "center", gap: 10 },
    routeDot: { width: 12, height: 12, borderRadius: 6 },
    routeLine: { width: 2, height: 12, backgroundColor: theme.border, marginLeft: 5 },
    routeAddress: {
      flex: 1,
      ...typography.bodyMedium,
      color: theme.textPrimary,
    },
    mapContainer: {
      height: 240,
      borderRadius: radius.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    map: { flex: 1 },
    statsRow: { flexDirection: "row", gap: spacing.sm },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: "center",
      gap: 4,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    statValue: { ...typography.bodyMedium, color: theme.textPrimary },
    statLabel: { ...typography.captionMedium, color: theme.textSecondary },
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    detailText: { ...typography.bodyMedium, color: theme.textPrimary, flex: 1 },
    trackButton: {
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    trackButtonText: { color: "#fff", ...typography.h4 },
    liveBadge: {
      backgroundColor: theme.danger,
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    liveBadgeText: { color: "#fff", ...typography.label },
    seatSection: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    seatLabel: { ...typography.bodyMedium, color: theme.textPrimary },
    seatRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    seatBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    seatBtnDisabled: { borderColor: theme.border, opacity: 0.5 },
    seatBtnText: { ...typography.h2, color: theme.primary },
    seatCountBox: {
      flex: 1,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    seatCount: { ...typography.h3, color: theme.textPrimary },
    statusBadge: { borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
    statusAccepted: { backgroundColor: theme.successBg },
    statusPending: { backgroundColor: theme.amberBg },
    statusText: { ...typography.bodyMedium, color: theme.textPrimary },
    message: { textAlign: "center", ...typography.bodyMedium },
    bookButton: {
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    bookButtonDisabled: { opacity: 0.6 },
    bookButtonText: { color: "#fff", ...typography.h4 },
  });
}