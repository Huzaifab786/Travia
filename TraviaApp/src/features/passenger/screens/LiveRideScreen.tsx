import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Pressable,
  Linking,
  Platform,
  PanResponder,
  Dimensions,
  TextInput,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline, Circle } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getDriverLocationApi } from "../../tracking/api/trackingApi";
import { getSocket } from "../../../services/socket";
import type { PassengerStackParamList } from "../navigation/PassengerNavigator";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { TripTimeline } from "../../../components/common/TripTimeline";
import { LiveRideStatusPanel } from "../../../components/common/LiveRideStatusPanel";
import {
  createReviewApi,
  getMyReviewForRideApi,
} from "../../reviews/api/reviewApi";
import { createRideIncidentApi } from "../../safety/api/incidentApi";

type LiveRideRouteProp = RouteProp<PassengerStackParamList, "LiveRide">;

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
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [rideStatus, setRideStatus] = useState<string | null>(null);
  const [distanceToPickupKm, setDistanceToPickupKm] = useState<number | null>(
    null,
  );
  const [socketConnected, setSocketConnected] = useState(false);
  const [completionPromptVisible, setCompletionPromptVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewAlreadySubmitted, setReviewAlreadySubmitted] = useState(false);
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosMessage, setSosMessage] = useState("");
  const completionPromptShownRef = useRef(false);

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

  const returnToPassengerHome = useCallback(() => {
    (navigation as any).reset({
      index: 0,
      routes: [{ name: "PassengerTabs", params: { screen: "PassengerHome" } }],
    });
  }, [navigation]);

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

  const syncDriverPoint = useCallback((
    lat: number,
    lng: number,
    nextLastUpdate?: string | null,
    nextStatus?: string | null,
  ) => {
    setDriverLat(lat);
    setDriverLng(lng);
    if (nextLastUpdate) {
      setLastUpdate(nextLastUpdate);
    }
    if (nextStatus) {
      setRideStatus(nextStatus);
    }

    if (meetupPoint) {
      setDistanceToPickupKm(
        haversineKm(lat, lng, meetupPoint.lat, meetupPoint.lng),
      );
    } else {
      setDistanceToPickupKm(null);
    }

    const remaining = haversineKm(lat, lng, dropoffLat, dropoffLng);
    setRemainingKm(remaining);
    setEtaMinutes(estimateEtaMinutes(remaining));

    if (!hasInitialDriverFix.current) {
      animatedLat.setValue(lat);
      animatedLng.setValue(lng);
      setAnimatedDriver({ lat, lng });
      hasInitialDriverFix.current = true;
    } else {
      Animated.parallel([
        Animated.timing(animatedLat, {
          toValue: lat,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(animatedLng, {
          toValue: lng,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
    }

    cameraMoveCounter.current += 1;

    if (mapRef.current && cameraMoveCounter.current % 2 === 0) {
      if (meetupPoint) {
        mapRef.current.fitToCoordinates(
          [
            { latitude: lat, longitude: lng },
            { latitude: meetupPoint.lat, longitude: meetupPoint.lng },
          ],
          {
            edgePadding: { top: 160, right: 80, bottom: 280, left: 80 },
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
            zoom: 15,
          },
          { duration: 900 },
        );
      }
    }
  }, [dropoffLat, dropoffLng, meetupPoint, animatedLat, animatedLng]);

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
          setRideStatus(data.status ?? null);
          syncDriverPoint(data.lat, data.lng, data.lastUpdate, data.status);
        }
      } catch {
        // silent poll failure
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

  useEffect(() => {
    if (rideStatus !== "completed") {
      return;
    }

    if (completionPromptShownRef.current) {
      return;
    }

    let active = true;
    const checkReview = async () => {
      try {
        const res = await getMyReviewForRideApi(rideId);
        if (!active) return;

        const alreadyReviewed = Boolean(res.review);
        setReviewAlreadySubmitted(alreadyReviewed);

        if (!alreadyReviewed) {
          completionPromptShownRef.current = true;
          setCompletionPromptVisible(true);
        }
      } catch {
        if (!active) return;
        completionPromptShownRef.current = true;
        setCompletionPromptVisible(true);
      }
    };

    checkReview();

    return () => {
      active = false;
    };
  }, [rideStatus, rideId]);

  const submitReview = async () => {
    try {
      setReviewSubmitting(true);
      await createReviewApi({
        rideId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewAlreadySubmitted(true);
      setCompletionPromptVisible(false);
      returnToPassengerHome();
    } catch {
      // keep modal open so the passenger can retry
    } finally {
      setReviewSubmitting(false);
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

  const openSOSModal = () => {
    if (isCompleted) {
      return;
    }

    setSosModalVisible(true);
  };

  const submitSOS = async () => {
    if (sosSubmitting) {
      return;
    }

    const trimmedMessage = sosMessage.trim();

    if (!trimmedMessage) {
      Alert.alert(
        "Add a message",
        "Please tell the admin what happened before sending SOS.",
      );
      return;
    }

    setSosSubmitting(true);

    try {
      await createRideIncidentApi({
        rideId,
        kind: "sos",
        severity: "critical",
        category: "ride_safety",
        message: trimmedMessage,
        locationLabel: meetupPoint?.label || "Live ride",
        latitude: driverLat,
        longitude: driverLng,
      });

      setSosModalVisible(false);
      setSosMessage("");
      Alert.alert(
        "SOS sent",
        "Your emergency alert has been sent to the admin team.",
      );
    } catch {
      Alert.alert(
        "SOS failed",
        "We could not send the SOS alert. Please try again.",
      );
    } finally {
      setSosSubmitting(false);
    }
  };

  const mapRegion = {
    latitude: pickupLat,
    longitude: pickupLng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const isArrived =
    distanceToPickupKm != null && distanceToPickupKm <= 0.25;
  const isStarted = rideStatus === "in_progress";
  const isCompleted = rideStatus === "completed";
  const tripSteps = useMemo(
    () => [
      {
        key: "accepted",
        label: "Accepted",
        description: "Your booking is confirmed.",
        state: "complete" as const,
      },
      {
        key: "driver_on_way",
        label: "Driver on way",
        description: "Tracking the driver live on the map.",
        state: isCompleted || isStarted || isArrived ? ("complete" as const) : ("active" as const),
      },
      {
        key: "arrived",
        label: "Arrived",
        description: isArrived
          ? "Driver reached the pickup area."
          : "Driver is approaching the pickup point.",
        state: isCompleted || isStarted || isArrived ? ("complete" as const) : ("upcoming" as const),
      },
      {
        key: "started",
        label: "Started",
        description: isStarted
          ? "Trip is in progress."
          : "Trip starts after pickup.",
        state: isCompleted || isStarted ? ("complete" as const) : ("upcoming" as const),
      },
      {
        key: "completed",
        label: "Completed",
        description: "Trip will appear in your history.",
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

        {driverLat != null && driverLng != null && meetupPoint && (
          <Polyline
            coordinates={[
              { latitude: animatedDriver.lat, longitude: animatedDriver.lng },
              { latitude: meetupPoint.lat, longitude: meetupPoint.lng }
            ]}
            strokeColor={theme.primary}
            strokeWidth={3}
            lineDashPattern={[8, 8]}
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

        {meetupPoint && (
          <Marker
            coordinate={{ latitude: meetupPoint.lat, longitude: meetupPoint.lng }}
            title="Your Pickup Point"
            description={meetupPoint.address || "Driver is heading here"}
            pinColor={theme.primary}
          />
        )}

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
                    <Text style={s.meetupTitle}>
                      {meetupPoint.source === "passengerPickup"
                        ? "Passenger pickup point"
                        : "Meetup point"}
                    </Text>
                  </View>
                  <Text style={s.meetupName}>{meetupPoint.label}</Text>
                  <Text style={s.meetupAddress}>
                    {meetupPoint.address ||
                      (meetupPoint.source === "passengerPickup"
                        ? "Passenger pickup point"
                        : "Shared pickup point")}
                  </Text>
                </View>
              )}

              <TripTimeline steps={tripSteps} theme={theme} />

              <LiveRideStatusPanel
                theme={theme}
                iconName="car-sport"
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
                    ? "This ride has ended."
                    : isArrived
                      ? "Driver is at the pickup point."
                      : "Tracking live GPS position"
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
              />

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
                  <Text style={s.secondaryActionBtnText}>Call</Text>
                </Pressable>

                <Pressable
                  onPress={() => (navigation as any).navigate("Chat", { rideId })}
                  style={s.secondaryActionBtn}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={theme.primary} />
                  <Text style={s.secondaryActionBtnText}>Chat</Text>
                </Pressable>
              </View>

              {!isCompleted && (
                <Pressable onPress={openSOSModal} style={s.sosActionBtn}>
                  <Ionicons name="warning-outline" size={18} color="#fff" />
                  <Text style={s.sosActionBtnText}>Send SOS Alert</Text>
                </Pressable>
              )}

            </>
          )}
        </ScrollView>
      </Animated.View>

      <Modal
        visible={completionPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletionPromptVisible(false)}
      >
        <View style={s.reviewModalOverlay}>
          <View style={s.reviewModalCard}>
            <View style={s.reviewIconWrap}>
              <Ionicons name="checkmark-done-circle" size={34} color={theme.success} />
            </View>
            <Text style={s.reviewModalTitle}>Ride completed</Text>
            <Text style={s.reviewModalSubtitle}>
              Your ride has ended. Please leave a review for the driver.
            </Text>

            <View style={s.reviewStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setReviewRating(star)}
                  style={s.reviewStarButton}
                >
                  <Ionicons
                    name={star <= reviewRating ? "star" : "star-outline"}
                    size={28}
                    color={theme.amber}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Write a quick review (optional)"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={s.reviewCommentInput}
            />

            <View style={s.reviewModalActions}>
              <Pressable
                onPress={returnToPassengerHome}
                style={s.reviewSecondaryBtn}
              >
                <Text style={s.reviewSecondaryBtnText}>Maybe later</Text>
              </Pressable>

              <Pressable
                onPress={submitReview}
                disabled={reviewSubmitting}
                style={s.reviewPrimaryBtn}
              >
                {reviewSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.reviewPrimaryBtnText}>Leave review</Text>
                )}
              </Pressable>
            </View>

            {reviewAlreadySubmitted ? (
              <Text style={s.reviewAlreadyText}>You already submitted a review for this ride.</Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={sosModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSosModalVisible(false)}
      >
        <View style={s.reviewModalOverlay}>
          <View style={s.reviewModalCard}>
            <View style={s.reviewIconWrap}>
              <Ionicons name="warning" size={34} color={theme.danger} />
            </View>
            <Text style={s.reviewModalTitle}>Send SOS alert?</Text>
            <Text style={s.reviewModalSubtitle}>
              Describe the problem so the admin team can act quickly with your
              live ride details and current location.
            </Text>

            <TextInput
              value={sosMessage}
              onChangeText={setSosMessage}
              placeholder="Example: Driver is not following the route and I feel unsafe."
              placeholderTextColor={theme.textSecondary}
              multiline
              style={s.reviewCommentInput}
            />

            <View style={s.reviewModalActions}>
              <Pressable
                onPress={() => setSosModalVisible(false)}
                style={s.reviewSecondaryBtn}
                disabled={sosSubmitting}
              >
                <Text style={s.reviewSecondaryBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={submitSOS}
                style={[s.reviewPrimaryBtn, { backgroundColor: theme.danger }]}
                disabled={sosSubmitting}
              >
                <Text style={s.reviewPrimaryBtnText}>
                  {sosSubmitting ? "Sending..." : "Send SOS"}
                </Text>
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
    sosActionBtn: {
      minHeight: 48,
      borderRadius: radius.lg,
      backgroundColor: theme.danger,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: spacing.sm,
    },
    sosActionBtnText: {
      ...typography.bodySemiBold,
      color: "#fff",
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
    reviewModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.55)",
      justifyContent: "center",
      padding: spacing.xl,
    },
    reviewModalCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
    },
    reviewIconWrap: {
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    reviewModalTitle: {
      ...typography.h3,
      color: theme.textPrimary,
      textAlign: "center",
    },
    reviewModalSubtitle: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    reviewStarsRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    reviewStarButton: {
      marginHorizontal: 4,
    },
    reviewCommentInput: {
      minHeight: 96,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      backgroundColor: theme.surfaceElevated,
      color: theme.textPrimary,
      padding: spacing.md,
      textAlignVertical: "top",
    },
    sosHint: {
      ...typography.caption,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: -spacing.sm,
      marginBottom: spacing.sm,
    },
    reviewModalActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    reviewSecondaryBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewSecondaryBtnText: {
      ...typography.bodySemiBold,
      color: theme.textSecondary,
    },
    reviewPrimaryBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.lg,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewPrimaryBtnText: {
      ...typography.bodySemiBold,
      color: "#fff",
    },
    reviewAlreadyText: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
    },
  });
}
