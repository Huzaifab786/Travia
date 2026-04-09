import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  Pressable,
  Linking,
  Platform,
  PanResponder,
  Dimensions,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker, Polyline, Circle } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getDriverLocationApi } from "../../tracking/api/trackingApi";
import type { PassengerStackParamList } from "../navigation/PassengerNavigator";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { ENV } from "../../../config/env";
import { radius, spacing, typography } from "../../../config/theme";

type LiveRideRouteProp = RouteProp<PassengerStackParamList, "LiveRide">;

const POLL_INTERVAL_MS = 2000;
const ALERT_SNOOZE_MS = 10 * 60 * 1000;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEtaMinutes(distanceKm: number) {
  const averageSpeedKmH = 35;
  return Math.max(1, Math.ceil((distanceKm / averageSpeedKmH) * 60));
}

export function LiveRideScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<LiveRideRouteProp>();
  const mapRef = useRef<MapView>(null);

  const {
    rideId,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    encodedPolyline,
    driverPhone,
    meetupPoint,
  } = route.params;

  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [isDeviated, setIsDeviated] = useState(false);
  const [distanceFromRoute, setDistanceFromRoute] = useState<number | null>(
    null,
  );
  const [routeStatus, setRouteStatus] = useState<"on_route" | "deviated">(
    "on_route",
  );
  const [alertHiddenUntil, setAlertHiddenUntil] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const animatedLat = useRef(new Animated.Value(pickupLat)).current;
  const animatedLng = useRef(new Animated.Value(pickupLng)).current;
  const hasInitialDriverFix = useRef(false);
  const cameraMoveCounter = useRef(0);
  const EXPANDED_Y = 0;
  const COLLAPSED_Y = 210;
  const drawerTranslateY = useRef(new Animated.Value(EXPANDED_Y)).current;
  const drawerLastOffset = useRef(EXPANDED_Y);
  const [drawerExpanded, setDrawerExpanded] = useState(true);

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
    } catch {
      return [];
    }
  }, [encodedPolyline]);

  useEffect(() => {
    if (routeCoords.length > 0 && mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 140, right: 50, bottom: 180, left: 50 },
          animated: true,
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [routeCoords]);

  useEffect(() => {
    const animation = Animated.loop(
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
    );

    animation.start();
    return () => animation.stop();
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
          setDistanceFromRoute(data.distanceFromRoute ?? null);
          setRouteStatus(data.routeStatus ?? (data.isDeviated ? "deviated" : "on_route"));

          const remaining = haversineKm(
            data.lat,
            data.lng,
            dropoffLat,
            dropoffLng,
          );
          setRemainingKm(remaining);
          setEtaMinutes(estimateEtaMinutes(remaining));

          if (!hasInitialDriverFix.current) {
            animatedLat.setValue(data.lat);
            animatedLng.setValue(data.lng);
            setAnimatedDriver({ lat: data.lat, lng: data.lng });
            hasInitialDriverFix.current = true;
          } else {
            Animated.parallel([
              Animated.timing(animatedLat, {
                toValue: data.lat,
                duration: 1100,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
              }),
              Animated.timing(animatedLng, {
                toValue: data.lng,
                duration: 1100,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
              }),
            ]).start();
          }

          cameraMoveCounter.current += 1;

          if (mapRef.current && cameraMoveCounter.current % 2 === 0) {
            mapRef.current.animateCamera(
              {
                center: {
                  latitude: data.lat,
                  longitude: data.lng,
                },
                zoom: 15,
              },
              { duration: 900 },
            );
          }
        }
      } catch {
        // silent poll failure
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
    const timer = setInterval(fetchLocation, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [rideId, animatedLat, animatedLng]);

  useEffect(() => {
    let cancelled = false;

    const loadDismissState = async () => {
      try {
        const raw = await AsyncStorage.getItem(
          `@travia.routeAlertDismissed.${rideId}`,
        );
        const parsed = raw ? Number(raw) : null;

        if (!cancelled && parsed && parsed > Date.now()) {
          setAlertHiddenUntil(parsed);
          return;
        }

        if (!cancelled) {
          setAlertHiddenUntil(null);
        }
      } catch {
        if (!cancelled) {
          setAlertHiddenUntil(null);
        }
      }
    };

    loadDismissState();

    return () => {
      cancelled = true;
    };
  }, [rideId]);

  useEffect(() => {
    if (!alertHiddenUntil) {
      return;
    }

    const delay = Math.max(alertHiddenUntil - Date.now(), 0);
    const timer = setTimeout(() => {
      setAlertHiddenUntil(null);
    }, delay);

    return () => clearTimeout(timer);
  }, [alertHiddenUntil]);

  const shouldShowDeviationAlert =
    isDeviated && (!alertHiddenUntil || alertHiddenUntil <= Date.now());

  const snoozeDeviationAlert = async () => {
    const expiry = Date.now() + ALERT_SNOOZE_MS;
    setAlertHiddenUntil(expiry);

    try {
      await AsyncStorage.setItem(
        `@travia.routeAlertDismissed.${rideId}`,
        String(expiry),
      );
    } catch {
      // silent
    }
  };

  const contactAdmin = async () => {
    if (!ENV.ADMIN_SUPPORT_PHONE) {
      Alert.alert(
        "Admin Contact",
        "Admin support number is not configured yet.",
      );
      return;
    }

    try {
      await Linking.openURL(`tel:${ENV.ADMIN_SUPPORT_PHONE}`);
    } catch {
      Alert.alert("Admin Contact", "Unable to open phone dialer.");
    }
  };

  const animateDrawerTo = (toValue: number) => {
    Animated.spring(drawerTranslateY, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    drawerLastOffset.current = toValue;
    setDrawerExpanded(toValue === EXPANDED_Y);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 6;
      },
      onPanResponderGrant: () => {
        drawerTranslateY.stopAnimation((value) => {
          drawerLastOffset.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const nextValue = drawerLastOffset.current + gestureState.dy;
        const clamped = Math.max(EXPANDED_Y, Math.min(COLLAPSED_Y, nextValue));
        drawerTranslateY.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const endValue = drawerLastOffset.current + gestureState.dy;
        const shouldExpand =
          gestureState.vy < -0.3 || endValue < COLLAPSED_Y / 2;

        animateDrawerTo(shouldExpand ? EXPANDED_Y : COLLAPSED_Y);
      },
      onPanResponderTerminate: () => {
        animateDrawerTo(drawerExpanded ? EXPANDED_Y : COLLAPSED_Y);
      },
    }),
  ).current;

  const openInMaps = async () => {
    const originLat = driverLat ?? pickupLat;
    const originLng = driverLng ?? pickupLng;

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${dropoffLat},${dropoffLng}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${dropoffLat},${dropoffLng}&travelmode=driving`;

    try {
      await Linking.openURL(url);
    } catch {
      // no-op
    }
  };

  const callDriver = async () => {
    if (!driverPhone) return;

    try {
      await Linking.openURL(`tel:${driverPhone}`);
    } catch {
      // no-op
    }
  };

  const mapRegion = {
    latitude: pickupLat,
    longitude: pickupLng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </Pressable>

        <View style={s.topBarCenter}>
          <Text style={s.topBarTitle}>Live Ride Tracking</Text>
          <Text style={s.topBarSubtitle}>
            {driverLat != null
              ? "Driver location is updating live"
              : "Waiting for driver"}
          </Text>
        </View>

        <Pressable onPress={openInMaps} style={s.mapBtn}>
          <Ionicons name="map-outline" size={18} color={theme.primary} />
        </Pressable>
      </View>

      {shouldShowDeviationAlert && (
        <View style={s.alertBanner}>
        <View
          style={[
            s.alertIconWrap,
          ]}
        >
          <Ionicons name="warning" size={18} color="#fff" />
        </View>

        <View style={s.alertBody}>
          <View style={s.alertHeaderRow}>
            <Text style={s.alertTitle}>Route deviation detected</Text>
            <View style={s.statusChip}>
              <Text style={s.statusChipText}>Action needed</Text>
            </View>
          </View>

          <Text style={s.alertSubText}>
            Driver is away from the planned path. You can contact admin now or
            hide this alert for 10 minutes.
          </Text>

          <Text style={s.alertMeta}>
            {distanceFromRoute != null
              ? `${Math.round(distanceFromRoute)}m from route`
              : routeStatus === "on_route"
                ? "Within the 200m safety threshold"
                : "Tracking live route status"}
          </Text>

          <View style={s.alertActions}>
            <Pressable onPress={contactAdmin} style={s.alertPrimaryBtn}>
              <Ionicons name="call-outline" size={16} color="#fff" />
              <Text style={s.alertPrimaryBtnText}>Call Admin</Text>
            </Pressable>
            <Pressable onPress={snoozeDeviationAlert} style={s.alertGhostBtn}>
              <Text style={s.alertGhostBtnText}>Hide 10 min</Text>
            </Pressable>
          </View>
        </View>
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
          />
        )}

        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          title="Pickup Point"
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
              radius={200}
              fillColor={theme.success + "11"}
              strokeColor={theme.success + "33"}
              strokeWidth={1}
            />
          </>
        )}
      </MapView>

      <Animated.View
        style={[
          s.drawerCard,
          {
            transform: [{ translateY: drawerTranslateY }],
          },
        ]}
      >
        <View style={s.dragHandleWrap} {...panResponder.panHandlers}>
          <View style={s.dragHandle} />
        </View>

        <ScrollView
          style={s.drawerScroll}
          contentContainerStyle={s.drawerContent}
          showsVerticalScrollIndicator
          bounces={false}
        >
          <View style={s.cardHeader}>
            <View style={s.liveIndicator}>
              <View style={s.liveDotSmall} />
              <Text style={s.liveIndicatorText}>LIVE TRACKING</Text>
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
              <Ionicons
                name="cloud-offline-outline"
                size={24}
                color={theme.textMuted}
              />
              <Text style={s.waitingText}>
                Waiting for driver to broadcast...
              </Text>
            </View>
          ) : (
            <>
              {meetupPoint && (
                <View style={s.meetupCard}>
                  <View style={s.meetupRow}>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={theme.primary}
                    />
                    <Text style={s.meetupTitle}>Meetup point</Text>
                  </View>
                  <Text style={s.meetupName}>{meetupPoint.label}</Text>
                  <Text style={s.meetupAddress}>
                    {meetupPoint.address || "Shared pickup point"}
                  </Text>
                </View>
              )}

              <View style={s.driverInfo}>
                <View style={s.driverIcon}>
                  <Ionicons name="car-sport" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.statusLabel}>Driver is on the way</Text>
                  <Text style={s.statusSub}>Tracking live GPS position</Text>
                </View>
              </View>

              <View style={s.actionRow}>
                <Pressable onPress={openInMaps} style={s.primaryActionBtn}>
                  <Ionicons name="navigate-outline" size={16} color="#fff" />
                  <Text style={s.primaryActionBtnText}>Open in Maps</Text>
                </Pressable>

                <Pressable
                  onPress={callDriver}
                  disabled={!driverPhone}
                  style={[
                    s.secondaryActionBtn,
                    !driverPhone && { opacity: 0.5 },
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color={theme.primary}
                  />
                  <Text style={s.secondaryActionBtnText}>Call Driver</Text>
                </Pressable>
              </View>

              <View style={s.tripStatsRow}>
                <View style={s.tripStatCard}>
                  <Ionicons
                    name="navigate-outline"
                    size={16}
                    color={theme.primary}
                  />
                  <Text style={s.tripStatValue}>
                    {remainingKm != null ? `${remainingKm.toFixed(1)} km` : "--"}
                  </Text>
                  <Text style={s.tripStatLabel}>Remaining</Text>
                </View>

                <View style={s.tripStatCard}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={theme.primary}
                  />
                  <Text style={s.tripStatValue}>
                    {etaMinutes != null ? `${etaMinutes} min` : "--"}
                  </Text>
                  <Text style={s.tripStatLabel}>Approx ETA</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    map: { flex: 1 },

    topBar: {
      position: "absolute",
      top: 50,
      left: 16,
      right: 16,
      zIndex: 20,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceElevated,
    },
    topBarCenter: {
      flex: 1,
      paddingHorizontal: spacing.md,
    },
    topBarTitle: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    topBarSubtitle: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    mapBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySubtle,
    },

    alertBanner: {
      backgroundColor: theme.danger,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      position: "absolute",
      top: 115,
      left: 20,
      right: 20,
      borderRadius: radius.xl,
      zIndex: 10,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    alertIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    safeIconWrap: {
      backgroundColor: theme.successBg,
    },
    alertBody: {
      flex: 1,
      gap: 4,
    },
    alertHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    alertTitle: {
      color: "#fff",
      ...typography.bodySemiBold,
      flex: 1,
    },
    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    statusChipSafe: {
      backgroundColor: theme.successSubtle,
    },
    statusChipText: {
      color: "#fff",
      ...typography.captionMedium,
      fontWeight: "700",
    },
    alertText: { color: "#fff", ...typography.bodyMedium },
    alertSubText: {
      color: "rgba(255,255,255,0.9)",
      ...typography.caption,
    },
    alertMeta: {
      color: "rgba(255,255,255,0.85)",
      ...typography.caption,
      fontWeight: "600",
    },
    safeBanner: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.success + "33",
      shadowOpacity: 0.08,
    },
    alertActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    alertPrimaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.16)",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    alertPrimaryBtnText: {
      color: "#fff",
      ...typography.captionMedium,
      fontWeight: "700",
    },
    alertGhostBtn: {
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.10)",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    alertGhostBtnText: {
      color: "#fff",
      ...typography.captionMedium,
      fontWeight: "700",
    },

    drawerCard: {
      position: "absolute",
      bottom: 14,
      left: 16,
      right: 16,
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
      minHeight: 260,
      maxHeight: SCREEN_HEIGHT * 0.42,
    },
    drawerScroll: { flex: 1 },
    drawerContent: {
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    dragHandleWrap: {
      alignItems: "center",
      paddingTop: 4,
      paddingBottom: 8,
    },
    dragHandle: {
      width: 54,
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.border,
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
    liveDotSmall: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.success,
    },
    liveIndicatorText: { ...typography.label, color: theme.success },
    updateTime: { ...typography.caption, color: theme.textSecondary },

    loadingState: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 4,
    },
    loadingText: { color: theme.textSecondary, ...typography.bodyMedium },

    meetupCard: {
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: spacing.md,
      gap: 4,
    },
    meetupRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    meetupTitle: {
      ...typography.captionMedium,
      color: theme.primary,
      fontWeight: "700",
    },
    meetupName: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: "700",
    },
    meetupAddress: { ...typography.caption, color: theme.textSecondary },

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
    statusSub: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      marginTop: 2,
    },

    actionRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    primaryActionBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.lg,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryActionBtnText: {
      ...typography.bodySemiBold,
      color: "#fff",
    },
    secondaryActionBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.lg,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    secondaryActionBtnText: {
      ...typography.bodySemiBold,
      color: theme.primary,
    },

    openMapsBtn: {
      marginTop: spacing.lg,
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    openMapsBtnText: {
      ...typography.bodySemiBold,
      color: "#fff",
    },

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
    tripStatsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    tripStatCard: {
      flex: 1,
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      gap: 4,
    },
    tripStatValue: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    tripStatLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
  });
}
