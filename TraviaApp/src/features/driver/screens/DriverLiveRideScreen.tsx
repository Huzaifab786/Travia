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
import { radius, spacing, typography } from "../../../config/theme";
import type { DriverStackParamList } from "../navigation/DriverNavigator";
import { getSocket } from "../../../services/socket";
import { TripTimeline } from "../../../components/common/TripTimeline";
import { LiveRideStatusPanel } from "../../../components/common/LiveRideStatusPanel";

type DriverLiveRideRouteProp = RouteProp<
  DriverStackParamList,
  "DriverLiveRide"
>;

const POLL_INTERVAL_MS = 20000;
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
    passengerDropoff,
  } = route.params;

  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [rideStatus, setRideStatus] = useState<string | null>(null);
  const [distanceToPickupKm, setDistanceToPickupKm] = useState<number | null>(
    null,
  );
  const [socketConnected, setSocketConnected] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const animatedLat = useRef(new Animated.Value(pickupLat)).current;
  const animatedLng = useRef(new Animated.Value(pickupLng)).current;
  const hasInitialDriverFix = useRef(false);
  const cameraMoveCounter = useRef(0);

  const [animatedDriver, setAnimatedDriver] = useState({
    lat: pickupLat,
    lng: pickupLng,
  });
  const animatedDriverRef = useRef({
    lat: pickupLat,
    lng: pickupLng,
  });
  const [carHeading, setCarHeading] = useState(0);
  const carHeadingRef = useRef(0);

  const EXPANDED_Y = 0;
  const COLLAPSED_Y = 250;
  const drawerTranslateY = useRef(new Animated.Value(EXPANDED_Y)).current;
  const drawerLastOffset = useRef(EXPANDED_Y);
  const [drawerExpanded, setDrawerExpanded] = useState(true);
  const [passengerPickedUp, setPassengerPickedUp] = useState(false);

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

  const syncDriverPoint = useCallback((
    lat: number,
    lng: number,
    nextLastUpdate?: string | null,
    nextStatus?: string | null,
  ) => {
    setDriverLat(lat);
    setDriverLng(lng);
    animatedDriverRef.current = { lat, lng };
    if (nextLastUpdate) {
      setLastUpdate(nextLastUpdate);
    }
    if (nextStatus) {
      setRideStatus(nextStatus);
    }

    if (meetupPoint && !passengerPickedUp) {
      setDistanceToPickupKm(
        haversineKm(lat, lng, meetupPoint.lat, meetupPoint.lng),
      );
    } else {
      setDistanceToPickupKm(null);
    }

    const remainingTarget = passengerPickedUp && passengerDropoff
      ? passengerDropoff
      : { lat: dropoffLat, lng: dropoffLng };
    const remaining = haversineKm(
      lat,
      lng,
      remainingTarget.lat,
      remainingTarget.lng,
    );
    setRemainingKm(remaining);
    setEtaMinutes(estimateEtaMinutes(remaining));

    if (!hasInitialDriverFix.current) {
      animatedLat.setValue(lat);
      animatedLng.setValue(lng);
      setAnimatedDriver({ lat, lng });
      hasInitialDriverFix.current = true;
    } else {
      const previousPoint = animatedDriverRef.current;
      const nextPoint = { lat, lng };

      if (
        previousPoint.lat !== nextPoint.lat ||
        previousPoint.lng !== nextPoint.lng
      ) {
        const heading = bearingBetweenPoints(previousPoint, nextPoint);
        carHeadingRef.current = heading;
        setCarHeading(heading);
      }

      Animated.parallel([
        Animated.timing(animatedLat, {
          toValue: lat,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(animatedLng, {
          toValue: lng,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]).start();
    }

    animatedDriverRef.current = { lat, lng };

    cameraMoveCounter.current += 1;

    if (mapRef.current && cameraMoveCounter.current % 2 === 0) {
      if (meetupPoint && !passengerPickedUp) {
        mapRef.current.fitToCoordinates(
          [
            { latitude: lat, longitude: lng },
            { latitude: meetupPoint.lat, longitude: meetupPoint.lng },
          ],
          {
            edgePadding: { top: 160, right: 80, bottom: 320, left: 80 },
            animated: true,
          },
        );
      } else if (passengerPickedUp) {
        const destLat = passengerDropoff ? passengerDropoff.lat : dropoffLat;
        const destLng = passengerDropoff ? passengerDropoff.lng : dropoffLng;
        mapRef.current.fitToCoordinates(
          [
            { latitude: lat, longitude: lng },
            { latitude: destLat, longitude: destLng },
          ],
          {
            edgePadding: { top: 160, right: 80, bottom: 320, left: 80 },
            animated: true,
          },
        );
      } else {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: lat,
              longitude: lng,
            },
            zoom: 17,
            heading: carHeadingRef.current,
            pitch: 0,
          },
          { duration: 700 },
        );
      }
    }
  }, [
    dropoffLat,
    dropoffLng,
    meetupPoint,
    passengerDropoff,
    passengerPickedUp,
    animatedLat,
    animatedLng,
  ]);

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
    if (mapRef.current) {
      const timer = setTimeout(() => {
        const coordsToFit = meetupPoint
          ? [
              { latitude: pickupLat, longitude: pickupLng },
              { latitude: meetupPoint.lat, longitude: meetupPoint.lng },
            ]
          : routeCoords.length > 0
          ? routeCoords
          : [{ latitude: pickupLat, longitude: pickupLng }, { latitude: dropoffLat, longitude: dropoffLng }];

        mapRef.current?.fitToCoordinates(coordsToFit, {
          edgePadding: { top: 160, right: 80, bottom: 320, left: 80 },
          animated: true,
        });
      }, 600);

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
          setRideStatus(data.status ?? null);
          syncDriverPoint(data.lat, data.lng, data.lastUpdate, data.status);
        }
      } catch {
        // ignore polling failure
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
    if (socketConnected) {
      return;
    }

    const timer = setInterval(fetchLocation, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [rideId, syncDriverPoint, socketConnected]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setSocketConnected(false);
      return;
    }

    const syncConnection = () => setSocketConnected(Boolean(socket.connected));
    const handleLocationUpdated = (payload: any) => {
      if (payload?.rideId !== rideId || payload.lat == null || payload.lng == null) {
        return;
      }

      syncDriverPoint(
        Number(payload.lat),
        Number(payload.lng),
        payload.lastUpdate ?? null,
        payload.status ?? null,
      );
      setLoading(false);
    };

    const handleStatusUpdated = (payload: any) => {
      if (payload?.rideId !== rideId || !payload.status) {
        return;
      }

      setRideStatus(payload.status);
    };

    syncConnection();
    socket.emit("join_ride", rideId);
    socket.on("connect", syncConnection);
    socket.on("disconnect", syncConnection);
    socket.on("ride_location_updated", handleLocationUpdated);
    socket.on("ride_status_updated", handleStatusUpdated);
    socket.on("ride_started", handleStatusUpdated);
    socket.on("ride_completed", handleStatusUpdated);

    return () => {
      socket.emit("leave_ride", rideId);
      socket.off("connect", syncConnection);
      socket.off("disconnect", syncConnection);
      socket.off("ride_location_updated", handleLocationUpdated);
      socket.off("ride_status_updated", handleStatusUpdated);
      socket.off("ride_started", handleStatusUpdated);
      socket.off("ride_completed", handleStatusUpdated);
    };
  }, [rideId, syncDriverPoint]);

  const openInMaps = async () => {
    const originLat = driverLat ?? pickupLat;
    const originLng = driverLng ?? pickupLng;
    const destLat = passengerDropoff ? passengerDropoff.lat : dropoffLat;
    const destLng = passengerDropoff ? passengerDropoff.lng : dropoffLng;

    const url =
      Platform.OS === "ios"
        ? `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`
        : `http://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${destLat},${destLng}&dirflg=d`;
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

  const isArrived =
    passengerPickedUp ||
    (distanceToPickupKm != null && distanceToPickupKm <= 0.25);
  const isStarted = passengerPickedUp || rideStatus === "in_progress";
  const isCompleted = rideStatus === "completed";
  const tripSteps = useMemo(
    () => [
      {
        key: "accepted",
        label: "Accepted",
        description: "Passenger booking confirmed.",
        state: "complete" as const,
      },
      {
        key: "driver_on_way",
        label: "Driver on way",
        description: "Live route tracking is active.",
        state: isCompleted || isStarted || isArrived ? ("complete" as const) : ("active" as const),
      },
      {
        key: "arrived",
        label: "Arrived",
        description: isArrived
          ? "Driver reached the pickup point."
          : "Driver is approaching the pickup point.",
        state: isCompleted || isStarted || isArrived ? ("complete" as const) : ("upcoming" as const),
      },
      {
        key: "started",
        label: "Started",
        description: isStarted
          ? "Ride has started."
          : "Starts once the passenger is picked up.",
        state: isCompleted || isStarted ? ("complete" as const) : ("upcoming" as const),
      },
      {
        key: "completed",
        label: "Completed",
        description: "Trip ends here.",
        state: isCompleted ? ("active" as const) : ("upcoming" as const),
      },
    ],
    [isArrived, isStarted, isCompleted],
  );

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
          coordinate={{ 
            latitude: passengerDropoff ? passengerDropoff.lat : dropoffLat, 
            longitude: passengerDropoff ? passengerDropoff.lng : dropoffLng 
          }}
          title={passengerDropoff ? "Passenger Dropoff" : "Destination"}
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

        <TripTimeline steps={tripSteps} theme={theme} />

        {loading && !driverLat ? (
          <View style={s.loadingState}>
            <ActivityIndicator color={theme.primary} />
            <Text style={s.loadingText}>Fetching your live position...</Text>
          </View>
        ) : (
          <>
            <LiveRideStatusPanel
              theme={theme}
              iconName="navigate"
              iconColor={theme.primary}
              title={
                isCompleted
                  ? "Trip completed"
                  : isStarted
                    ? "Trip in progress"
                    : isArrived
                      ? "Driver arrived"
                      : "Driver is on the way"
              }
              subtitle={
                isCompleted
                  ? "This ride is finished."
                  : isArrived
                    ? "Driver is at the pickup point."
                    : "Keep following your route safely"
              }
              stats={[
                {
                  value: remainingKm != null ? `${remainingKm.toFixed(1)} km` : "--",
                  label: "Remaining",
                },
                {
                  value: etaMinutes != null ? `${etaMinutes} min` : "--",
                  label: "Approx ETA",
                },
              ]}
            >
              {meetupPoint && (
                <View style={s.phaseCard}>
                  <View style={s.phaseIndicator}>
                    <View style={[s.phaseDot, !passengerPickedUp && s.phaseDotActive]} />
                    <View style={[s.phaseLine, passengerPickedUp && s.phaseLineActive]} />
                    <View style={[s.phaseDot, passengerPickedUp && s.phaseDotActive]} />
                  </View>
                  <View style={s.phaseLabels}>
                    <Text style={[s.phaseLabel, !passengerPickedUp && s.phaseLabelActive]}>
                      Head to Passenger
                    </Text>
                    <Text style={[s.phaseLabel, passengerPickedUp && s.phaseLabelActive]}>
                      Head to Destination
                    </Text>
                  </View>
                  {!passengerPickedUp && (
                    <Pressable
                      onPress={() => setPassengerPickedUp(true)}
                      style={s.pickedUpBtn}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={s.pickedUpBtnText}>Passenger Picked Up</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </LiveRideStatusPanel>

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
                <Text style={s.liveSecondaryBtnText}>Call</Text>
              </Pressable>

              <Pressable
                onPress={() => (navigation as any).navigate("Chat", { rideId })}
                style={s.liveSecondaryBtn}
              >
                <Ionicons name="chatbubble-outline" size={16} color={theme.primary} />
                <Text style={s.liveSecondaryBtnText}>Chat</Text>
              </Pressable>
            </View>

            <View style={s.actionRow}>
              <Pressable onPress={startRealBroadcast} style={s.secondaryBtn}>
                <Ionicons
                  name="radio-outline"
                  size={18}
                  color={theme.primary}
                />
                <Text style={s.secondaryBtnText}>Start Live</Text>
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

    phaseCard: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      gap: spacing.sm,
    },
    phaseIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 0,
    },
    phaseDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.border,
    },
    phaseDotActive: {
      backgroundColor: "#F59E0B",
    },
    phaseLine: {
      flex: 1,
      height: 3,
      backgroundColor: theme.border,
    },
    phaseLineActive: {
      backgroundColor: "#F59E0B",
    },
    phaseLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    phaseLabel: {
      ...typography.caption,
      color: theme.textMuted,
      flex: 1,
    },
    phaseLabelActive: {
      color: "#F59E0B",
      fontWeight: "700",
    },
    pickedUpBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      backgroundColor: "#16A34A",
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      marginTop: spacing.xs,
    },
    pickedUpBtnText: {
      ...typography.bodySemiBold,
      color: "#fff",
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
