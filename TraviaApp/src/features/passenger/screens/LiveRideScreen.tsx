import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import MapView, { Marker, Polyline, Circle } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getDriverLocationApi } from "../../tracking/api/trackingApi";
import type { PassengerStackParamList } from "../navigation/PassengerNavigator";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type LiveRideRouteProp = RouteProp<PassengerStackParamList, "LiveRide">;

const POLL_INTERVAL_MS = 6000;
const { width, height } = Dimensions.get("window");

export function LiveRideScreen() {
  const { theme } = useTheme();
  const route = useRoute<LiveRideRouteProp>();
  const mapRef = useRef<MapView>(null);
  const {
    rideId,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    encodedPolyline,
  } = route.params;

  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [isDeviated, setIsDeviated] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const animatedLat = useRef(new Animated.Value(pickupLat)).current;
  const animatedLng = useRef(new Animated.Value(pickupLng)).current;
  const hasInitialDriverFix = useRef(false);

  const [animatedDriver, setAnimatedDriver] = useState({
    lat: pickupLat,
    lng: pickupLng,
  });

  const routeCoords = useMemo(() => {
    if (!encodedPolyline) return [];
    try {
      const raw =
        typeof encodedPolyline === "string"
          ? JSON.parse(encodedPolyline)
          : encodedPolyline;

      if (!Array.isArray(raw)) return [];

      return raw
        .filter(
          (c) =>
            c != null && typeof c.lat === "number" && typeof c.lng === "number",
        )
        .map((c) => ({
          latitude: c.lat as number,
          longitude: c.lng as number,
        }));
    } catch (e) {
      console.error("Failed to parse route polyline:", e);
      return [];
    }
  }, [encodedPolyline]);

  useEffect(() => {
    if (routeCoords.length > 0 && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 100, right: 50, bottom: 150, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [routeCoords]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    const latId = animatedLat.addListener(({ value }) => {
      setAnimatedDriver((prev) => ({ ...prev, lat: value }));
    });

    const lngId = animatedLng.addListener(({ value }) => {
      setAnimatedDriver((prev) => ({ ...prev, lng: value }));
    });

    return () => {
      animatedLat.removeListener(latId);
      animatedLng.removeListener(lngId);
    };
  }, [animatedLat, animatedLng]);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const data = await getDriverLocationApi(rideId);

        if (data.lat != null && data.lng != null) {
          setDriverLat(data.lat);
          setDriverLng(data.lng);
          setLastUpdate(data.lastUpdate);
          setIsDeviated(data.isDeviated ?? false);

          if (!hasInitialDriverFix.current) {
            animatedLat.setValue(data.lat);
            animatedLng.setValue(data.lng);
            setAnimatedDriver({ lat: data.lat, lng: data.lng });
            hasInitialDriverFix.current = true;
          } else {
            Animated.parallel([
              Animated.timing(animatedLat, {
                toValue: data.lat,
                duration: 1200,
                easing: Easing.linear,
                useNativeDriver: false,
              }),
              Animated.timing(animatedLng, {
                toValue: data.lng,
                duration: 1200,
                easing: Easing.linear,
                useNativeDriver: false,
              }),
            ]).start();
          }

          if (mapRef.current) {
            mapRef.current.animateCamera(
              {
                center: {
                  latitude: data.lat,
                  longitude: data.lng,
                },
              },
              { duration: 1000 },
            );
          }
        }
      } catch (e) {
        // silent fail on poll
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
    const timer = setInterval(fetchLocation, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [rideId, animatedLat, animatedLng]);

  const mapRegion = {
    latitude: pickupLat,
    longitude: pickupLng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      {isDeviated && (
        <View style={s.alertBanner}>
          <Ionicons name="warning" size={20} color="#fff" />
          <Text style={s.alertText}>Safety Alert: Driver off-route!</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={mapRegion}
        showsUserLocation
      >
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={theme.success}
            strokeWidth={5}
            lineDashPattern={[0]}
          />
        )}

        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          title={isDeviated ? "Pickup (Driver Left Route)" : "Pickup Point"}
        >
          <View style={s.markerContainer}>
            <View style={[s.dot, { backgroundColor: theme.primary }]} />
            <View style={s.markerLabel}>
              <Text style={s.markerLabelText}>Start</Text>
            </View>
          </View>
        </Marker>

        <Marker
          coordinate={{ latitude: dropoffLat, longitude: dropoffLng }}
          title="Destination"
        >
          <View style={s.markerContainer}>
            <View style={[s.dot, { backgroundColor: theme.danger }]} />
            <View style={s.markerLabel}>
              <Text style={s.markerLabelText}>End</Text>
            </View>
          </View>
        </Marker>

        {driverLat != null && driverLng != null && (
          <>
            <Marker
              coordinate={{
                latitude: animatedDriver.lat,
                longitude: animatedDriver.lng,
              }}
              title="Driver's Location"
              anchor={{ x: 0.5, y: 0.5 }}
              flat
            >
              <View style={s.driverMarkerWrapper}>
                <Animated.View
                  style={[
                    s.driverMarkerPulse,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={s.driverMarkerDot}>
                  <Ionicons name="car" size={14} color="#fff" />
                </View>
              </View>
            </Marker>

            <Circle
              center={{
                latitude: animatedDriver.lat,
                longitude: animatedDriver.lng,
              }}
              radius={300}
              fillColor={theme.success + "11"}
              strokeColor={theme.success + "33"}
              strokeWidth={1}
            />
          </>
        )}
      </MapView>

      <View style={s.floatingCard}>
        <View style={s.cardHeader}>
          <View style={s.liveIndicator}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE TRACKING</Text>
          </View>
          <Text style={s.updateTime}>
            {lastUpdate
              ? `Updated ${new Date(lastUpdate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}`
              : "Connecting..."}
          </Text>
        </View>

        {loading && !driverLat ? (
          <View style={s.loadingState}>
            <ActivityIndicator color={theme.primary} />
            <Text style={s.loadingText}>Fetching driver location...</Text>
          </View>
        ) : driverLat == null ? (
          <View style={s.emptyState}>
            <Ionicons name="cloud-offline-outline" size={24} color={theme.textMuted} />
            <Text style={s.waitingText}>
              Waiting for driver to broadcast...
            </Text>
          </View>
        ) : (
          <View style={s.driverInfo}>
            <View style={s.driverIcon}>
              <Ionicons name="person" size={20} color={theme.primary} />
            </View>
            <View>
              <Text style={s.statusLabel}>Driver is on the way</Text>
              <Text style={s.statusSub}>Tracking live GPS position</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    map: { flex: 1 },
    alertBanner: {
      backgroundColor: theme.danger,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      position: "absolute",
      top: 50,
      left: 20,
      right: 20,
      borderRadius: radius.md,
      zIndex: 10,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    alertText: { color: "#fff", ...typography.bodyMedium },
    floatingCard: {
      position: "absolute",
      bottom: 34,
      left: 16,
      right: 16,
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    liveIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.successBg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.success,
    },
    liveText: { ...typography.label, color: theme.success },
    updateTime: { ...typography.caption, color: theme.textSecondary },
    loadingState: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 4,
    },
    loadingText: { color: theme.textSecondary, ...typography.bodyMedium },
    emptyState: { alignItems: "center", paddingVertical: 10, gap: 8 },
    waitingText: { ...typography.bodyMedium, color: theme.textMuted },
    driverInfo: { flexDirection: "row", alignItems: "center", gap: 14 },
    driverIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primarySubtle,
      alignItems: "center",
      justifyContent: "center",
    },
    statusLabel: { ...typography.bodyMedium, color: theme.textPrimary },
    statusSub: { ...typography.captionMedium, color: theme.textSecondary, marginTop: 2 },
    markerContainer: { alignItems: "center" },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: "#fff",
    },
    markerLabel: {
      backgroundColor: "#fff",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    markerLabelText: { fontSize: 10, fontWeight: "700", color: "#374151" },
    driverMarkerWrapper: { alignItems: "center", justifyContent: "center" },
    driverMarkerPulse: {
      position: "absolute",
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.success + "33",
    },
    driverMarkerDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#fff",
    },
  });
}
