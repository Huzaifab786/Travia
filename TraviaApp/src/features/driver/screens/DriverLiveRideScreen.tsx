import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  PanResponder,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker, Polyline, Circle } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  getDriverLocationApi,
  updateLocationApi,
} from "../../tracking/api/trackingApi";
import { completeRideApi } from "../api/driverRideApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { ENV } from "../../../config/env";
import { radius, spacing, typography } from "../../../config/theme";
import type { DriverStackParamList } from "../navigation/DriverNavigator";

type DriverLiveRideRouteProp = RouteProp<
  DriverStackParamList,
  "DriverLiveRide"
>;

const POLL_INTERVAL_MS = 1500;
const DEMO_TICK_MS = 1000;
const DEMO_SPEED_METERS_PER_TICK = 35;
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
  const averageSpeedKmH = 40;
  return Math.max(1, Math.ceil((distanceKm / averageSpeedKmH) * 60));
}

type RoutePoint = { lat: number; lng: number };

function haversineMeters(a: RoutePoint, b: RoutePoint) {
  return haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
}

function interpolatePoint(a: RoutePoint, b: RoutePoint, t: number): RoutePoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

function bearingBetweenPoints(a: RoutePoint, b: RoutePoint) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

export function DriverLiveRideScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<DriverLiveRideRouteProp>();
  const mapRef = useRef<MapView>(null);

  const {
    rideId,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    encodedPolyline,
    passengerName,
    passengerPhone,
    meetupPoint,
  } = route.params;

  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [isDeviated, setIsDeviated] = useState(false);
  const [distanceFromRoute, setDistanceFromRoute] = useState<number | null>(
    null,
  );
  const [alertHiddenUntil, setAlertHiddenUntil] = useState<number | null>(null);

  const [demoMode, setDemoMode] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoRouteIndexRef = useRef(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const animatedLat = useRef(new Animated.Value(pickupLat)).current;
  const animatedLng = useRef(new Animated.Value(pickupLng)).current;
  const hasInitialDriverFix = useRef(false);
  const cameraMoveCounter = useRef(0);

  const [animatedDriver, setAnimatedDriver] = useState({
    lat: pickupLat,
    lng: pickupLng,
  });
  const [carHeading, setCarHeading] = useState(0);

  const EXPANDED_Y = 0;
  const COLLAPSED_Y = 250;
  const drawerTranslateY = useRef(new Animated.Value(EXPANDED_Y)).current;
  const drawerLastOffset = useRef(EXPANDED_Y);
  const [drawerExpanded, setDrawerExpanded] = useState(true);

  const rawRoutePoints = useMemo(() => {
    if (!encodedPolyline) return [] as RoutePoint[];

    try {
      const raw =
        typeof encodedPolyline === "string"
          ? JSON.parse(encodedPolyline)
          : encodedPolyline;

      if (!Array.isArray(raw)) return [] as RoutePoint[];

      return raw.filter(
        (c) =>
          c != null && typeof c.lat === "number" && typeof c.lng === "number",
      ) as RoutePoint[];
    } catch {
      return [] as RoutePoint[];
    }
  }, [encodedPolyline]);

  const routeCoords = useMemo(() => {
    return rawRoutePoints.map((c) => ({
      latitude: c.lat,
      longitude: c.lng,
    }));
  }, [rawRoutePoints]);

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

  useEffect(() => {
    if (routeCoords.length > 0 && mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 140, right: 50, bottom: 260, left: 50 },
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

  const stopDemoMode = () => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    demoRouteIndexRef.current = 0;
    setIsDemoRunning(false);
  };

  const startDemoMode = async () => {
    if (rawRoutePoints.length < 2) {
      Alert.alert("Demo Error", "This ride has no route points saved.");
      return;
    }

    stopDemoMode();
    setIsDemoRunning(true);

    let segmentIndex = 0;
    let segmentProgress = 0;

    const sendDemo = async () => {
      try {
        if (segmentIndex >= rawRoutePoints.length - 1) {
          stopDemoMode();
          return;
        }

        const start = rawRoutePoints[segmentIndex];
        const end = rawRoutePoints[segmentIndex + 1];

        const segmentDistance = haversineMeters(start, end);

        if (segmentDistance < 1) {
          segmentIndex += 1;
          segmentProgress = 0;
          return;
        }

        const progressStep = DEMO_SPEED_METERS_PER_TICK / segmentDistance;
        segmentProgress += progressStep;

        if (segmentProgress >= 1) {
          segmentIndex += 1;
          segmentProgress = 0;

          if (segmentIndex >= rawRoutePoints.length - 1) {
            const lastPoint = rawRoutePoints[rawRoutePoints.length - 1];
            await updateLocationApi(rideId, lastPoint.lat, lastPoint.lng);
            stopDemoMode();
            return;
          }
        }

        const currentStart = rawRoutePoints[segmentIndex];
        const currentEnd = rawRoutePoints[segmentIndex + 1];
        const nextPoint = interpolatePoint(
          currentStart,
          currentEnd,
          segmentProgress,
        );

        await updateLocationApi(rideId, nextPoint.lat, nextPoint.lng);
      } catch {
        // ignore demo tick failures
      }
    };

    const first = rawRoutePoints[0];
    await updateLocationApi(rideId, first.lat, first.lng);

    demoIntervalRef.current = setInterval(sendDemo, DEMO_TICK_MS);
  };

  const startRealBroadcast = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Location permission is required for live broadcasting.",
      );
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await updateLocationApi(
        rideId,
        loc.coords.latitude,
        loc.coords.longitude,
      );
      Alert.alert("Live Started", "Your live ride broadcasting has started.");
    } catch {
      Alert.alert("Error", "Failed to start live broadcasting.");
    }
  };

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
            const previousPoint = {
              lat: animatedDriver.lat,
              lng: animatedDriver.lng,
            };
            const nextPoint = {
              lat: data.lat,
              lng: data.lng,
            };

            if (
              previousPoint.lat !== nextPoint.lat ||
              previousPoint.lng !== nextPoint.lng
            ) {
              setCarHeading(bearingBetweenPoints(previousPoint, nextPoint));
            }

            Animated.parallel([
              Animated.timing(animatedLat, {
                toValue: data.lat,
                duration: 900,
                easing: Easing.linear,
                useNativeDriver: false,
              }),
              Animated.timing(animatedLng, {
                toValue: data.lng,
                duration: 900,
                easing: Easing.linear,
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
                zoom: 17,
                heading: carHeading,
                pitch: 0,
              },
              { duration: 700 },
            );
          }
        }
      } catch {
        // ignore polling failure
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
    const timer = setInterval(fetchLocation, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [rideId, dropoffLat, dropoffLng, animatedLat, animatedLng]);

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

  useEffect(() => {
    return () => {
      stopDemoMode();
    };
  }, []);

  const openInMaps = async () => {
    const originLat = driverLat ?? pickupLat;
    const originLng = driverLng ?? pickupLng;

    const url =
      Platform.OS === "ios"
        ? `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${dropoffLat},${dropoffLng}&travelmode=driving`
        : `http://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${dropoffLat},${dropoffLng}&dirflg=d`;
    try {
      await Linking.openURL(url);
    } catch {}
  };

  const callPassenger = async () => {
    if (!passengerPhone) return;

    try {
      await Linking.openURL(`tel:${passengerPhone}`);
    } catch {}
  };

  const onCompleteRide = () => {
    Alert.alert("Complete Ride", "Mark this ride as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          try {
            setCompleting(true);
            stopDemoMode();
            await completeRideApi(rideId);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to complete ride");
          } finally {
            setCompleting(false);
          }
        },
      },
    ]);
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
          <Text style={s.topBarTitle}>Driver Live Ride</Text>
          <Text style={s.topBarSubtitle}>Your trip is being tracked live</Text>
        </View>

        <Pressable onPress={openInMaps} style={s.mapBtn}>
          <Ionicons name="map-outline" size={18} color={theme.primary} />
        </Pressable>
      </View>

      {(!isDeviated || shouldShowDeviationAlert) && (
        <View style={[s.routeBanner, !isDeviated ? s.routeBannerSafe : null]}>
          <View
            style={[s.routeIconWrap, !isDeviated ? s.routeIconWrapSafe : null]}
          >
            <Ionicons
              name={isDeviated ? "warning" : "checkmark-circle"}
              size={18}
              color={isDeviated ? "#fff" : theme.success}
            />
          </View>

          <View style={s.routeBannerBody}>
            <View style={s.routeBannerHeader}>
              <Text
                style={[
                  s.routeBannerTitle,
                  !isDeviated ? { color: theme.success } : null,
                ]}
              >
                {isDeviated ? "Route deviation" : "Route on track"}
              </Text>
              <View style={[s.routeChip, !isDeviated ? s.routeChipSafe : null]}>
                <Text
                  style={[
                    s.routeChipText,
                    !isDeviated ? { color: theme.success } : null,
                  ]}
                >
                  {isDeviated ? "Check now" : "All clear"}
                </Text>
              </View>
            </View>

            <Text
              style={[
                s.routeBannerSub,
                !isDeviated ? { color: theme.textSecondary } : null,
              ]}
            >
              {isDeviated
                ? "Driver is away from the selected path and should get back on route."
                : "Driver is following the selected route normally."}
            </Text>

            <Text
              style={[
                s.routeBannerMeta,
                !isDeviated ? { color: theme.textSecondary } : null,
              ]}
            >
              {distanceFromRoute != null
                ? `${Math.round(distanceFromRoute)}m from route`
                : "Tracking live route status"}
            </Text>

            {isDeviated && (
              <View style={s.routeActions}>
                <Pressable onPress={contactAdmin} style={s.routePrimaryBtn}>
                  <Ionicons name="call-outline" size={16} color="#fff" />
                  <Text style={s.routePrimaryBtnText}>Call Admin</Text>
                </Pressable>
                <Pressable onPress={snoozeDeviationAlert} style={s.routeGhostBtn}>
                  <Text style={s.routeGhostBtnText}>Hide 10 min</Text>
                </Pressable>
              </View>
            )}
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
            strokeColor={theme.primary}
            strokeWidth={5}
          />
        )}

        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          title="Pickup Point"
        >
          <View style={s.markerContainer}>
            <View style={[s.dot, { backgroundColor: theme.success }]} />
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

        {meetupPoint && (
          <Marker
            coordinate={{
              latitude: meetupPoint.lat,
              longitude: meetupPoint.lng,
            }}
            title={meetupPoint.label}
            description={meetupPoint.address || "Passenger meetup point"}
            pinColor={theme.amber}
          />
        )}

        {driverLat != null && driverLng != null && (
          <>
            <Marker
              coordinate={{
                latitude: animatedDriver.lat,
                longitude: animatedDriver.lng,
              }}
              title="Your Location"
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
                <View
                  style={[
                    s.driverMarkerDot,
                    {
                      transform: [{ rotate: `${carHeading}deg` }],
                    },
                  ]}
                >
                  <Ionicons name="car-sport" size={18} color="#fff" />
                </View>
              </View>
            </Marker>

            <Circle
              center={{
                latitude: animatedDriver.lat,
                longitude: animatedDriver.lng,
              }}
              radius={200}
              fillColor={theme.primary + "11"}
              strokeColor={theme.primary + "33"}
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
            <Text style={s.liveIndicatorText}>LIVE NOW</Text>
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

        {meetupPoint && (
          <View style={s.meetupCard}>
            <View style={s.meetupRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={theme.primary}
              />
              <Text style={s.meetupTitle}>Passenger meetup point</Text>
            </View>
            <Text style={s.meetupName}>{meetupPoint.label}</Text>
            <Text style={s.meetupAddress}>
              {meetupPoint.address || "Shared route pickup point"}
            </Text>
            {passengerName && (
              <Text style={s.meetupAddress}>Passenger: {passengerName}</Text>
            )}
          </View>
        )}

        {loading && !driverLat ? (
          <View style={s.loadingState}>
            <ActivityIndicator color={theme.primary} />
            <Text style={s.loadingText}>Fetching your live position...</Text>
          </View>
        ) : (
          <>
            <View style={s.driverInfo}>
              <View style={s.driverIcon}>
                <Ionicons name="navigate" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statusLabel}>Trip in progress</Text>
                <Text style={s.statusSub}>
                  Keep following your route safely
                </Text>
              </View>
            </View>

            <View style={s.liveActionRow}>
              <Pressable onPress={openInMaps} style={s.livePrimaryBtn}>
                <Ionicons name="navigate-outline" size={16} color="#fff" />
                <Text style={s.livePrimaryBtnText}>Open in Maps</Text>
              </Pressable>

              <Pressable
                onPress={callPassenger}
                disabled={!passengerPhone}
                style={[
                  s.liveSecondaryBtn,
                  !passengerPhone && { opacity: 0.5 },
                ]}
              >
                <Ionicons name="call-outline" size={16} color={theme.primary} />
                <Text style={s.liveSecondaryBtnText}>Call Passenger</Text>
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
                <Ionicons name="time-outline" size={16} color={theme.primary} />
                <Text style={s.tripStatValue}>
                  {etaMinutes != null ? `${etaMinutes} min` : "--"}
                </Text>
                <Text style={s.tripStatLabel}>Approx ETA</Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                const next = !demoMode;
                setDemoMode(next);
                if (!next) {
                  stopDemoMode();
                }
              }}
              style={s.demoCard}
            >
              <View style={s.demoLeft}>
                <View style={s.demoIconWrap}>
                  <Ionicons
                    name="flask-outline"
                    size={20}
                    color={theme.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.demoTitle}>Demo Movement Mode</Text>
                  <Text style={s.demoSubtitle}>
                    {demoMode
                      ? "Simulating route GPS"
                      : "Use demo movement for evaluation"}
                  </Text>
                </View>
              </View>

              <View style={[s.demoBadge, demoMode && s.demoBadgeActive]}>
                <Text
                  style={[
                    s.demoBadgeText,
                    { color: demoMode ? theme.primary : theme.textMuted },
                  ]}
                >
                  {demoMode ? "ON" : "OFF"}
                </Text>
              </View>
            </Pressable>

            <View style={s.actionRow}>
              <Pressable
                onPress={
                  demoMode
                    ? isDemoRunning
                      ? stopDemoMode
                      : startDemoMode
                    : startRealBroadcast
                }
                style={s.secondaryBtn}
              >
                <Ionicons
                  name={
                    demoMode
                      ? isDemoRunning
                        ? "pause-outline"
                        : "play-outline"
                      : "radio-outline"
                  }
                  size={18}
                  color={theme.primary}
                />
                <Text style={s.secondaryBtnText}>
                  {demoMode
                    ? isDemoRunning
                      ? "Stop Demo"
                      : "Start Demo"
                    : "Start Live"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={onCompleteRide}
              style={s.primaryBtn}
              disabled={completing}
            >
              {completing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-done-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={s.primaryBtnText}>Complete Ride</Text>
                </>
              )}
            </Pressable>
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
    routeBanner: {
      position: "absolute",
      top: 116,
      left: 16,
      right: 16,
      zIndex: 15,
      backgroundColor: theme.danger,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 4,
    },
    routeBannerSafe: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.success + "33",
    },
    routeIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    routeIconWrapSafe: {
      backgroundColor: theme.successBg,
    },
    routeBannerBody: {
      flex: 1,
      gap: 4,
    },
    routeBannerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    routeBannerTitle: {
      color: "#fff",
      ...typography.bodySemiBold,
      flex: 1,
    },
    routeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    routeChipSafe: {
      backgroundColor: theme.successBg,
    },
    routeChipText: {
      color: "#fff",
      ...typography.captionMedium,
      fontWeight: "700",
    },
    routeBannerSub: { color: "rgba(255,255,255,0.9)", ...typography.caption },
    routeBannerMeta: {
      color: "rgba(255,255,255,0.85)",
      ...typography.caption,
      fontWeight: "600",
    },
    routeActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    routePrimaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.16)",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    routePrimaryBtnText: {
      color: "#fff",
      ...typography.captionMedium,
      fontWeight: "700",
    },
    routeGhostBtn: {
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.10)",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    routeGhostBtnText: {
      color: "#fff",
      ...typography.captionMedium,
      fontWeight: "700",
    },

    drawerCard: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 24,
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
      minHeight: 160,
      maxHeight: SCREEN_HEIGHT * 0.5,
    },
    drawerScroll: {
      flex: 1,
    },
    drawerContent: {
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    dragHandleWrap: {
      alignItems: "center",
      paddingTop: 10,
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
      marginBottom: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: theme.primarySubtle,
      borderWidth: 1,
      borderColor: theme.border,
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
    meetupAddress: {
      ...typography.caption,
      color: theme.textSecondary,
    },

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

    liveActionRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    livePrimaryBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.lg,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    livePrimaryBtnText: {
      ...typography.bodySemiBold,
      color: "#fff",
    },
    liveSecondaryBtn: {
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
    liveSecondaryBtnText: {
      ...typography.bodySemiBold,
      color: theme.primary,
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

    demoCard: {
      marginTop: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    demoLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    demoIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.primarySubtle,
      alignItems: "center",
      justifyContent: "center",
    },
    demoTitle: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    demoSubtitle: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      marginTop: 2,
    },
    demoBadge: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.full,
      backgroundColor: theme.surface,
    },
    demoBadgeActive: {
      backgroundColor: theme.successBg,
    },
    demoBadgeText: {
      ...typography.bodySemiBold,
    },

    actionRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    secondaryBtn: {
      flex: 1,
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryBtnText: {
      ...typography.bodySemiBold,
      color: theme.primary,
    },
    primaryBtn: {
      marginTop: spacing.md,
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryBtnText: {
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
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: theme.primary + "22",
    },
    driverMarkerDot: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2.5,
      borderColor: "#fff",
    },
  });
}
