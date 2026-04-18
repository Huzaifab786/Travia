import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
} from "react-native";
import {
  RouteProp,
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSocket } from "../../../services/socket";
import type { PassengerStackParamList } from "../navigation/PassengerNavigator";
import {
  createBookingApi,
  getMyBookingForRideApi,
  quoteBookingApi,
  Booking,
  BookingQuote,
} from "../../bookings/api/bookingApi";
import { getRideRouteApi, RoutePoint } from "../../map/api/routeApi";
import { getRideByIdApi } from "../api/rideApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import {
  PlaceSuggestion,
  searchPlacesApi,
} from "../../driver/api/placeApi";
import { TripTimeline } from "../../../components/common/TripTimeline";

type RideDetailsRouteProp = RouteProp<PassengerStackParamList, "RideDetails">;

export function RideDetailsScreen() {
  const { theme } = useTheme();
  const route = useRoute<RideDetailsRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const insets = useSafeAreaInsets();
  const { ride } = route.params;

  const [currentRide, setCurrentRide] = useState(ride);
  const rideId = (ride as any).id;
  const availableSeats = Number((currentRide as any).seatsAvailable ?? (currentRide as any).seatsTotal ?? 0);
  const maxSeats = useMemo(() => Math.max(0, availableSeats), [availableSeats]);

  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [checking, setChecking] = useState(true);
  const [seatsRequested, setSeatsRequested] = useState(1);
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPickup, setSelectedPickup] = useState<PlaceSuggestion | null>(null);
  const [selectedDropoff, setSelectedDropoff] = useState<PlaceSuggestion | null>(null);
  const [tripQuote, setTripQuote] = useState<BookingQuote | null>(null);
  const [pricingMode, setPricingMode] = useState<"pass" | "cash">("pass");
  const [pickupSearchLoading, setPickupSearchLoading] = useState(false);
  const [dropoffSearchLoading, setDropoffSearchLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
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

  const pickupFocus = useMemo(
    () => ({
      lat: selectedPickup?.lat ?? currentRide.pickup.lat,
      lng: selectedPickup?.lng ?? currentRide.pickup.lng,
    }),
    [selectedPickup?.lat, selectedPickup?.lng, currentRide.pickup.lat, currentRide.pickup.lng],
  );
  const dropoffFocus = useMemo(
    () => ({
      lat: selectedDropoff?.lat ?? currentRide.dropoff.lat,
      lng: selectedDropoff?.lng ?? currentRide.dropoff.lng,
    }),
    [selectedDropoff?.lat, selectedDropoff?.lng, currentRide.dropoff.lat, currentRide.dropoff.lng],
  );

  const resetTripQuote = useCallback(() => {
    setTripQuote(null);
    setQuoteError("");
  }, []);

  const loadQuote = useCallback(async (pickup: PlaceSuggestion, dropoff: PlaceSuggestion, seats: number, usePass: boolean) => {
      setQuoteLoading(true);
      setQuoteError("");
      try {
        const res = await quoteBookingApi({
          rideId,
          seatsRequested: seats,
          usePass,
          passengerPickup: pickup,
          passengerDropoff: dropoff,
        });
        setTripQuote(res.quote);
      } catch (e: any) {
        setTripQuote(null);
        setQuoteError(e.message || "Unable to calculate your trip price");
      } finally {
        setQuoteLoading(false);
      }
    }, [rideId]);

  const refreshBookingStatus = useCallback(async () => {
    const res = await getMyBookingForRideApi(rideId);
    setExistingBooking(res.booking);
    return res.booking;
  }, [rideId]);

  const refreshRide = useCallback(async () => {
    const res = await getRideByIdApi(rideId);
    setCurrentRide(res.ride);
    return res.ride;
  }, [rideId]);

  useEffect(() => { setSeatsRequested((prev) => clampSeats(prev)); }, [maxSeats]);

  useEffect(() => {
    const selectedPlace = route.params?.selectedPlace;
    const selectedField = route.params?.selectedField;

    if (!selectedPlace || !selectedField) {
      return;
    }

    if (selectedField === "pickup") {
      setSelectedPickup(selectedPlace);
      setPickupQuery(selectedPlace.label);
      setPickupSuggestions([]);
    } else {
      setSelectedDropoff(selectedPlace);
      setDropoffQuery(selectedPlace.label);
      setDropoffSuggestions([]);
    }

    setMessage("");
    resetTripQuote();
    navigation.setParams({
      selectedPlace: undefined,
      selectedField: undefined,
    });
  }, [navigation, resetTripQuote, route.params?.selectedField, route.params?.selectedPlace]);

  useEffect(() => {
    const run = async () => {
      try {
        await refreshBookingStatus();
      } catch {
      } finally {
        setChecking(false);
      }
    };
    run();
  }, [refreshBookingStatus]);

  useFocusEffect(
    useCallback(() => {
      refreshBookingStatus().catch(() => undefined);
      refreshRide().catch(() => undefined);
    }, [refreshBookingStatus, refreshRide])
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const refreshAll = () => {
      refreshBookingStatus().catch(() => undefined);
      refreshRide().catch(() => undefined);
    };

    const onRideEvent = (payload: any) => {
      if (payload?.rideId !== rideId) return;
      refreshAll();
    };

    socket.emit("join_ride", rideId);
    socket.on("booking_update", onRideEvent);
    socket.on("ride_status_updated", onRideEvent);
    socket.on("ride_location_updated", onRideEvent);
    socket.on("ride_started", onRideEvent);
    socket.on("ride_completed", onRideEvent);

    return () => {
      socket.emit("leave_ride", rideId);
      socket.off("booking_update", onRideEvent);
      socket.off("ride_status_updated", onRideEvent);
      socket.off("ride_location_updated", onRideEvent);
      socket.off("ride_started", onRideEvent);
      socket.off("ride_completed", onRideEvent);
    };
  }, [rideId, refreshBookingStatus, refreshRide]);

  useEffect(() => {
    const query = pickupQuery.trim();
    if (query.length < 3) {
      setPickupSuggestions([]); setPickupSearchLoading(false); return;
    }
    const timer = setTimeout(async () => {
      setPickupSearchLoading(true);
      try {
        const res = await searchPlacesApi(query, pickupFocus.lat, pickupFocus.lng);
        setPickupSuggestions(res.places);
      } catch { setPickupSuggestions([]); } finally { setPickupSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [pickupQuery, pickupFocus.lat, pickupFocus.lng]);

  useEffect(() => {
    const query = dropoffQuery.trim();
    if (query.length < 3) {
      setDropoffSuggestions([]); setDropoffSearchLoading(false); return;
    }
    const timer = setTimeout(async () => {
      setDropoffSearchLoading(true);
      try {
        const res = await searchPlacesApi(query, dropoffFocus.lat, dropoffFocus.lng);
        setDropoffSuggestions(res.places);
      } catch { setDropoffSuggestions([]); } finally { setDropoffSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [dropoffQuery, dropoffFocus.lat, dropoffFocus.lng]);

  useEffect(() => {
    if (!selectedPickup || !selectedDropoff || existingBooking) {
      resetTripQuote(); return;
    }
    const seats = clampSeats(seatsRequested);
    const timer = setTimeout(() => { loadQuote(selectedPickup, selectedDropoff, seats, pricingMode === "pass"); }, 250);
    return () => clearTimeout(timer);
  }, [seatsRequested, selectedPickup, selectedDropoff, existingBooking, loadQuote, resetTripQuote, pricingMode]);

  useEffect(() => {
    const loadRoute = async () => {
      try {
        const res = await getRideRouteApi(rideId);
        setRouteCoords(res.coordinates);
        setDistanceMeters(res.distanceMeters);
        setDurationSeconds(res.durationSeconds);
      } catch {
        setRouteCoords([{ lat: ride.pickup.lat, lng: ride.pickup.lng }, { lat: ride.dropoff.lat, lng: ride.dropoff.lng }]);
      } finally {
        setRouteLoading(false);
      }
    };
    loadRoute();
  }, [rideId, ride.pickup.lat, ride.pickup.lng, ride.dropoff.lat, ride.dropoff.lng]);

  const onBook = async () => {
    setMessage("");
    if (checking) return;
    if (existingBooking) { setMessage(`You already have a ${existingBooking.status} booking.`); return; }
    const seats = clampSeats(seatsRequested);
    if (seats <= 0) { setMessage("No seats available."); return; }
    if (!selectedPickup || !selectedDropoff) { setMessage("Please select your pickup and dropoff locations."); return; }
    if (quoteError) { setMessage(quoteError); return; }
    if (!tripQuote) { setMessage("Please wait while we calculate your trip price."); return; }

    setLoading(true);
    try {
      await createBookingApi({
        rideId,
        seatsRequested: seats,
        usePass: pricingMode === "pass",
        passengerPickup: selectedPickup,
        passengerDropoff: selectedDropoff,
      });
      await refreshBookingStatus();
      await refreshRide();
      setMessage("Booking request sent (pending)");
    } catch (e: any) {
      setMessage(e.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const onTrackLive = () => {
    const polyline = (currentRide as any).encodedPolyline || (routeCoords.length > 0 ? JSON.stringify(routeCoords) : null);
    const pickupPoint =
      existingBooking?.passengerPickup ||
      selectedPickup ||
      existingBooking?.meetupPoint ||
      null;

    navigation.navigate("LiveRide", {
      rideId,
      pickupLat: currentRide.pickup.lat,
      pickupLng: currentRide.pickup.lng,
      dropoffLat: currentRide.dropoff.lat,
      dropoffLng: currentRide.dropoff.lng,
      encodedPolyline: polyline,
      driverPhone: currentRide.driver.phone || null,
      meetupPoint: pickupPoint
        ? {
            ...pickupPoint,
            source: "passengerPickup",
          }
        : null,
    });
  };

  const isDisabled = loading || checking || !!existingBooking || maxSeats <= 0 || quoteLoading || !selectedPickup || !selectedDropoff || !!quoteError;
  const isAccepted = existingBooking?.status === "accepted";

  const latitudeDelta = Math.max(Math.abs(currentRide.pickup.lat - currentRide.dropoff.lat) * 2, 0.05);
  const longitudeDelta = Math.max(Math.abs(currentRide.pickup.lng - currentRide.dropoff.lng) * 2, 0.05);
  const initialRegion = {
    latitude: (currentRide.pickup.lat + currentRide.dropoff.lat) / 2,
    longitude: (currentRide.pickup.lng + currentRide.dropoff.lng) / 2,
    latitudeDelta, longitudeDelta,
  };

  const distanceKm = (distanceMeters / 1000).toFixed(1);
  const avgRating = typeof currentRide.driver.avgRating === "number" ? currentRide.driver.avgRating.toFixed(1) : null;
  const totalReviews = currentRide.driver.totalReviews ?? 0;
  const tripTimelineSteps = useMemo(
    () => [
      {
        key: "accepted",
        label: "Accepted",
        description: existingBooking?.status === "accepted"
          ? "Your booking is confirmed."
          : "Waiting for booking confirmation.",
        state: existingBooking?.status === "accepted" ? ("complete" as const) : ("active" as const),
      },
      {
        key: "driver_on_way",
        label: "Driver on way",
        description: "The driver is moving toward the pickup point.",
        state: ["ready", "in_progress", "completed"].includes(currentRide.status)
          ? ("complete" as const)
          : ("upcoming" as const),
      },
      {
        key: "arrived",
        label: "Arrived",
        description: "Driver has reached the pickup area.",
        state: currentRide.status === "in_progress" || currentRide.status === "completed"
          ? ("complete" as const)
          : ("upcoming" as const),
      },
      {
        key: "started",
        label: "Started",
        description: "Trip is underway.",
        state: currentRide.status === "in_progress" || currentRide.status === "completed"
          ? ("complete" as const)
          : ("upcoming" as const),
      },
      {
        key: "completed",
        label: "Completed",
        description: "Trip will move to your history.",
        state: currentRide.status === "completed"
          ? ("active" as const)
          : ("upcoming" as const),
      },
    ],
    [existingBooking?.status, currentRide.status],
  );

  const fareBreakdown = currentRide.fareBreakdown || null;

  const formatKm = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} km` : "N/A";
  const formatKmPerLitre = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} km/L` : "N/A";
  const formatCurrency = (value: unknown) => Number.isFinite(Number(value)) ? `Rs ${Math.round(Number(value))}` : "N/A";

  const quoteTotalPrice = tripQuote && Number.isFinite(Number(tripQuote.totalPrice)) ? Math.round(tripQuote.totalPrice) : null;
  const quotePerSeatPrice = tripQuote && Number.isFinite(Number(tripQuote.perSeatPrice)) ? Math.round(tripQuote.perSeatPrice) : null;
  const quoteCoveredByPass = Boolean(tripQuote?.isCoveredByPass);

  const onSelectPickup = (place: PlaceSuggestion) => {
    setSelectedPickup(place); setPickupQuery(place.label); setPickupSuggestions([]); setMessage(""); setQuoteError("");
  };

  const onSelectDropoff = (place: PlaceSuggestion) => {
    setSelectedDropoff(place); setDropoffQuery(place.label); setDropoffSuggestions([]); setMessage(""); setQuoteError("");
  };

  const polylineCoords = routeCoords
    .filter((point) => point && typeof point.lat === "number" && typeof point.lng === "number")
    .map((point) => ({ latitude: point.lat, longitude: point.lng }));

  const s = makeStyles(theme, insets);

  return (
    <View style={s.container}>
      <View style={s.fixedHeader}>
        <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Trip Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <View style={s.mapBlock}>
          <MapView style={s.map} initialRegion={initialRegion}>
            <Marker coordinate={{ latitude: currentRide.pickup.lat, longitude: currentRide.pickup.lng }} pinColor="green" />
            <Marker coordinate={{ latitude: currentRide.dropoff.lat, longitude: currentRide.dropoff.lng }} pinColor="red" />
            {selectedPickup ? (
              <Marker
                coordinate={{ latitude: selectedPickup.lat, longitude: selectedPickup.lng }}
                title="Your pickup"
                description={selectedPickup.label}
                pinColor={theme.primary}
              />
            ) : null}
            {selectedDropoff ? (
              <Marker
                coordinate={{ latitude: selectedDropoff.lat, longitude: selectedDropoff.lng }}
                title="Your dropoff"
                description={selectedDropoff.label}
                pinColor={theme.success}
              />
            ) : null}
            {polylineCoords.length > 0 ? (
              <Polyline coordinates={polylineCoords} strokeColor={theme.primary} strokeWidth={4} />
            ) : null}
          </MapView>
        </View>

        <View style={s.infoContainer}>
          <View style={s.driverRow}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{currentRide.driver.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.driverName}>{currentRide.driver.name}</Text>
              <View style={s.ratingRow}>
                <Ionicons name="star" size={14} color={theme.amber} />
                <Text style={s.ratingText}>
                  {avgRating ? `${avgRating} (${totalReviews})` : "New Driver"}
                </Text>
              </View>
            </View>
            <View style={s.priceBlock}>
              <Text style={s.priceValue}>Rs {currentRide.price}</Text>
              <Text style={s.priceLabel}>base / seat</Text>
            </View>
          </View>

          <View style={s.timelineWrap}>
            <TripTimeline steps={tripTimelineSteps} theme={theme} />
          </View>

          <View style={s.divider} />

          <View style={s.routeRow}>
             <View style={s.routeTimeline}>
                <View style={s.dotGreen} />
                <View style={s.routeLine} />
                <View style={s.dotRed} />
             </View>
             <View style={s.routeAddresses}>
                <Text style={s.routeText} numberOfLines={2}>{currentRide.pickup.address}</Text>
                <Text style={s.routeText} numberOfLines={2}>{currentRide.dropoff.address}</Text>
             </View>
          </View>

          <View style={s.chipRow}>
            <MetaChip icon="calendar" text={new Date(currentRide.departureTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })} theme={theme} />
            <MetaChip icon="people" text={`${maxSeats} seats left`} theme={theme} />
            {currentRide.femaleOnly ? (
              <View style={[s.chip, { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8' }]}>
                <Ionicons name="female" size={14} color="#db2777" />
                <Text style={[s.chipText, { color: '#db2777' }]}>Female Only</Text>
              </View>
            ) : null}
          </View>
        </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Your Trip</Text>
            <Text style={s.sectionSubtitle}>Enter your locations to calculate your shared fare.</Text>

          <View style={s.inputStack}>
            <View style={s.inputTimeline}>
              <View style={s.dotGreen} />
              <View style={s.inputLine} />
              <View style={s.dotRed} />
            </View>
            <View style={s.inputWrapper}>

              <View style={s.inputBox}>
                <TextInput
                  value={pickupQuery}
                  onChangeText={(text) => {
                    setPickupQuery(text);
                    setSelectedPickup(null);
                    resetTripQuote();
                  }}
                  placeholder="Where are you?"
                  placeholderTextColor={theme.textMuted}
                  style={s.inputText}
                />
                <View style={s.inputActions}>
                  {pickupSearchLoading ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Pressable
                      onPress={() =>
                        navigation.navigate("PassengerLocationSearch", {
                          field: "pickup",
                          title: "Search pickup",
                          focusLat: pickupFocus.lat,
                          focusLng: pickupFocus.lng,
                          initialQuery: pickupQuery || selectedPickup?.label || "",
                          ride: currentRide,
                          returnTo: "RideDetails",
                        })
                      }
                      style={s.inputActionBtn}
                    >
                      <Ionicons name="search-outline" size={16} color={theme.primary} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() =>
                      navigation.navigate("PassengerMapPicker", {
                        field: "pickup",
                        initialLocation: selectedPickup
                          ? { lat: selectedPickup.lat, lng: selectedPickup.lng }
                          : { lat: pickupFocus.lat, lng: pickupFocus.lng },
                        ride: currentRide,
                        returnTo: "RideDetails",
                      })
                    }
                    style={s.inputActionBtn}
                  >
                    <Ionicons name="map-outline" size={16} color={theme.primary} />
                  </Pressable>
                  {selectedPickup ? (
                    <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                  ) : null}
                </View>
              </View>

              {pickupSuggestions.length > 0 && !selectedPickup ? (
                <View style={s.suggestionList}>
                  {pickupSuggestions.slice(0, 3).map((place) => (
                    <Pressable key={place.id} onPress={() => onSelectPickup(place)} style={s.suggestionItem}>
                      <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                      <Text style={s.suggestionLabel}>{place.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={s.divider} />

              <View style={s.inputBox}>
                <TextInput
                  value={dropoffQuery}
                  onChangeText={(text) => {
                    setDropoffQuery(text);
                    setSelectedDropoff(null);
                    resetTripQuote();
                  }}
                  placeholder="Where to?"
                  placeholderTextColor={theme.textMuted}
                  style={s.inputText}
                />
                <View style={s.inputActions}>
                  {dropoffSearchLoading ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Pressable
                      onPress={() =>
                        navigation.navigate("PassengerLocationSearch", {
                          field: "dropoff",
                          title: "Search dropoff",
                          focusLat: dropoffFocus.lat,
                          focusLng: dropoffFocus.lng,
                          initialQuery: dropoffQuery || selectedDropoff?.label || "",
                          ride: currentRide,
                          returnTo: "RideDetails",
                        })
                      }
                      style={s.inputActionBtn}
                    >
                      <Ionicons name="search-outline" size={16} color={theme.primary} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() =>
                      navigation.navigate("PassengerMapPicker", {
                        field: "dropoff",
                        initialLocation: selectedDropoff
                          ? { lat: selectedDropoff.lat, lng: selectedDropoff.lng }
                          : { lat: dropoffFocus.lat, lng: dropoffFocus.lng },
                        ride: currentRide,
                        returnTo: "RideDetails",
                      })
                    }
                    style={s.inputActionBtn}
                  >
                    <Ionicons name="map-outline" size={16} color={theme.primary} />
                  </Pressable>
                  {selectedDropoff ? (
                    <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                  ) : null}
                </View>
              </View>

              {dropoffSuggestions.length > 0 && !selectedDropoff ? (
                <View style={s.suggestionList}>
                  {dropoffSuggestions.slice(0, 3).map((place) => (
                    <Pressable key={place.id} onPress={() => onSelectDropoff(place)} style={s.suggestionItem}>
                      <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                      <Text style={s.suggestionLabel}>{place.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

            </View>
          </View>

          {quoteLoading ? (
            <View style={s.quoteFeedback}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={s.quoteFeedbackText}>Calculating price...</Text>
            </View>
          ) : null}

          {quoteError ? (
            <View style={[s.quoteFeedback, { backgroundColor: theme.dangerBg }]}>
              <Ionicons name="alert-circle" size={16} color={theme.danger} />
              <Text style={[s.quoteFeedbackText, { color: theme.danger }]}>{quoteError}</Text>
            </View>
          ) : null}

          {tripQuote ? (
            <View style={s.quoteSuccessBox}>
               <View style={s.pricingModeRow}>
                 <Pressable
                   onPress={() => setPricingMode("pass")}
                   style={[s.modePill, pricingMode === "pass" && s.modePillActive]}
                 >
                   <Text style={[s.modePillText, pricingMode === "pass" && s.modePillTextActive]}>Use Pass</Text>
                 </Pressable>
                 <Pressable
                   onPress={() => setPricingMode("cash")}
                   style={[s.modePill, pricingMode === "cash" && s.modePillActive]}
                 >
                   <Text style={[s.modePillText, pricingMode === "cash" && s.modePillTextActive]}>Pay Cash</Text>
                 </Pressable>
               </View>
               <Text style={s.quoteLabel}>
                 {quoteCoveredByPass ? "Covered by Commuter Pass" : pricingMode === "pass" ? "Pass selected" : "Estimated Trip Price"}
               </Text>
               <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                 {quoteCoveredByPass ? (
                   <>
                     <Text style={[s.quoteValue, { textDecorationLine: "line-through", color: theme.textSecondary, fontSize: 16 }]}>Rs {quoteTotalPrice ?? "--"}</Text>
                     <Text style={[s.quoteValue, { color: theme.primary }]}>Rs 0</Text>
                   </>
                 ) : (
                   <Text style={s.quoteValue}>Rs {quoteTotalPrice ?? "--"}</Text>
                 )}
                 {!quoteCoveredByPass && <Text style={s.quoteSub}>({quotePerSeatPrice} / seat)</Text>}
               </View>
               {pricingMode === "pass" && !quoteCoveredByPass ? (
                 <Text style={[s.quoteSub, { marginTop: 6 }]}>
                   No active pass matched this exact ride. You can switch to cash or adjust your pickup/dropoff.
                 </Text>
               ) : null}
            </View>
          ) : null}
        </View>

        <View style={s.section}>
          <View style={s.pickupNoteBox}>
            <Ionicons name="location" size={20} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.pickupNoteTitle}>Exact pickup confirmed</Text>
              <Text style={s.pickupNoteText}>
                Driver pickup will use the location you select here. If you change your mind, you can edit pickup or dropoff before booking.
              </Text>
            </View>
          </View>
        </View>

        {fareBreakdown ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Fare Breakdown</Text>

            <View style={s.statsGrid}>
              <StatCard icon="navigate" value={formatKm(fareBreakdown.distanceKm)} label="Route Dist." theme={theme} />
              <StatCard icon="git-merge" value={`${fareBreakdown.totalTravelers}`} label="Travelers" theme={theme} />
              <StatCard icon="water" value={formatKmPerLitre(fareBreakdown.fuelAverage)} label="Avg Fuel" theme={theme} />
            </View>

            <View style={s.breakdownBox}>
              <BreakdownRow label="Route fuel cost" value={formatCurrency(fareBreakdown.totalFuelCost)} />
              <BreakdownRow label="Calculated price / seat" value={formatCurrency(fareBreakdown.finalPrice)} emphasis />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.bottomActionBar}>
        {isAccepted ? (
           <Pressable style={s.trackButton} onPress={onTrackLive}>
             <Ionicons name="location" size={20} color="#fff" />
             <Text style={s.actionButtonText}>Track Live Ride</Text>
             <View style={s.liveBadge}><Text style={s.liveBadgeText}>LIVE</Text></View>
           </Pressable>
        ) : !existingBooking ? (
          <View style={{ gap: 12 }}>
            <View style={s.seatSelectorRow}>
               <Text style={s.seatSelectorLabel}>Seats to book</Text>
               <View style={s.seatControls}>
                 <Pressable disabled={isDisabled || seatsRequested <= 1} onPress={() => setSeatsRequested((v) => clampSeats(v - 1))} style={[s.seatBtn, (isDisabled || seatsRequested <= 1) && s.seatBtnDisabled]}>
                   <Ionicons name="remove" size={20} color={theme.textPrimary} />
                 </Pressable>
                 <Text style={s.seatCountText}>{maxSeats <= 0 ? 0 : seatsRequested}</Text>
                 <Pressable disabled={isDisabled || seatsRequested >= maxSeats} onPress={() => setSeatsRequested((v) => clampSeats(v + 1))} style={[s.seatBtn, (isDisabled || seatsRequested >= maxSeats) && s.seatBtnDisabled]}>
                   <Ionicons name="add" size={20} color={theme.textPrimary} />
                 </Pressable>
               </View>
            </View>

            {message ? (
              <View style={[s.messageBox, { backgroundColor: message.startsWith("Booking") ? theme.primarySubtle : theme.dangerBg }]}>
                <Ionicons name={message.startsWith("Booking") ? "checkmark-circle" : "alert-circle"} size={16} color={message.startsWith("Booking") ? theme.primary : theme.danger} />
                <Text style={[s.messageText, { color: message.startsWith("Booking") ? theme.primary : theme.danger }]}>{message}</Text>
              </View>
            ) : null}

            <Pressable onPress={onBook} disabled={isDisabled} style={[s.bookButton, isDisabled && s.bookButtonDisabled]}>
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.actionButtonText}>
                  {maxSeats <= 0
                    ? "No Seats Available"
                    : pricingMode === "pass"
                      ? `Request with Pass`
                      : `Request ${seatsRequested} Seat${seatsRequested === 1 ? "" : "s"}`}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={[s.statusBadge, existingBooking.status === "accepted" ? s.statusAccepted : s.statusPending]}>
            <Text style={s.statusText}>
              {existingBooking.status === "accepted" ? "Booking Accepted" : `Booking ${existingBooking.status}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Helper Components
function MetaChip({ icon, text, theme }: { icon: any; text: string; theme: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.surfaceElevated, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 }}>
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <Text style={{ ...typography.captionMedium, color: theme.textSecondary }}>{text}</Text>
    </View>
  );
}

function StatCard({ icon, value, label, theme }: { icon: any; value: string; label: string; theme: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.surfaceElevated, borderRadius: radius.lg, padding: spacing.md, alignItems: "flex-start", gap: 4 }}>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <Text style={{ ...typography.bodySemiBold, color: theme.textPrimary, marginTop: 4 }}>{value}</Text>
      <Text style={{ ...typography.caption, color: theme.textMuted }}>{label}</Text>
    </View>
  );
}

function BreakdownRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: emphasis ? 0 : 1, borderBottomColor: "#E2E8F0" }}>
      <Text style={{ ...typography.bodyMedium, color: emphasis ? "#0F172A" : "#64748B" }}>{label}</Text>
      <Text style={{ ...typography.bodyMedium, color: emphasis ? "#0F172A" : "#1E293B", fontWeight: emphasis ? "700" : "500" }}>{value}</Text>
    </View>
  );
}

function makeStyles(theme: any, insets: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    fixedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.md, zIndex: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
    backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { ...typography.h3, color: theme.textPrimary },

    scrollView: { flex: 1 },
    content: { paddingBottom: 180 },

    mapBlock: { height: 220, width: '100%' },
    map: { flex: 1 },

    infoContainer: { backgroundColor: '#fff', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.border, marginBottom: spacing.xl },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primarySubtle, justifyContent: 'center', alignItems: 'center' },
    avatarText: { ...typography.h3, color: theme.primary },
    driverName: { ...typography.bodySemiBold, color: theme.textPrimary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    ratingText: { ...typography.caption, color: theme.textSecondary },
    priceBlock: { alignItems: 'flex-end' },
    priceValue: { ...typography.h3, color: theme.primary },
    priceLabel: { ...typography.caption, color: theme.textMuted },

    divider: { height: 1, backgroundColor: theme.border, marginVertical: spacing.md },
    timelineWrap: { marginTop: spacing.md },

    routeRow: { flexDirection: 'row', marginBottom: spacing.md },
    routeTimeline: { alignItems: 'center', width: 24, marginRight: 8 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.success },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.danger },
    routeLine: { width: 2, flex: 1, backgroundColor: theme.border, marginVertical: 4 },
    routeAddresses: { flex: 1, justifyContent: 'space-between', gap: 16 },
    routeText: { ...typography.bodyMedium, color: theme.textPrimary },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
    chipText: { ...typography.captionMedium },

    section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
    sectionTitle: { ...typography.h3, color: theme.textPrimary, marginBottom: 2 },
    sectionSubtitle: { ...typography.body, color: theme.textSecondary, marginBottom: spacing.md },

    inputStack: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border },
    inputTimeline: { width: 40, alignItems: 'center', paddingVertical: 20 },
    inputLine: { width: 1, flex: 1, backgroundColor: theme.border, marginVertical: 4 },
    inputWrapper: { flex: 1 },
    inputBox: { height: 56, flexDirection: 'row', alignItems: 'center' },
    inputText: { flex: 1, ...typography.bodyMedium, color: theme.textPrimary, height: '100%' },
    inputActions: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 10 },
    inputActionBtn: {
      width: 30,
      height: 30,
      borderRadius: radius.full,
      backgroundColor: theme.primarySubtle,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },

    suggestionList: { borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.surfaceElevated },
    suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: theme.border },
    suggestionLabel: { ...typography.bodyMedium, color: theme.textPrimary },

    quoteFeedback: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: theme.surfaceElevated },
    quoteFeedbackText: { ...typography.captionMedium, color: theme.textSecondary },
    quoteSuccessBox: { marginTop: spacing.md, backgroundColor: theme.primarySubtle, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.primary + '33' },
    pricingModeRow: { flexDirection: "row", gap: 8, marginBottom: spacing.sm },
    modePill: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.full,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.surfaceElevated,
    },
    modePillActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + "15",
    },
    modePillText: { ...typography.captionMedium, color: theme.textSecondary, fontWeight: "700" },
    modePillTextActive: { color: theme.primary },
    quoteLabel: { ...typography.caption, color: theme.primary, textTransform: 'uppercase', marginBottom: 4 },
    quoteValue: { ...typography.h2, color: theme.primary },
    quoteSub: { ...typography.captionMedium, color: theme.primary, marginBottom: 4 },

    pickupNoteBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: spacing.md,
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.primary + "33",
    },
    pickupNoteTitle: {
      ...typography.bodySemiBold,
      color: theme.primary,
      marginBottom: 2,
    },
    pickupNoteText: {
      ...typography.caption,
      color: theme.textSecondary,
      lineHeight: 18,
    },

    statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    breakdownBox: { backgroundColor: theme.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: theme.border },

    bottomActionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.border, padding: spacing.lg, paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 15 },
    seatSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    seatSelectorLabel: { ...typography.bodySemiBold, color: theme.textPrimary },
    seatControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    seatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surfaceElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
    seatBtnDisabled: { opacity: 0.4 },
    seatCountText: { ...typography.h3, color: theme.textPrimary, minWidth: 20, textAlign: 'center' },

    bookButton: { backgroundColor: theme.primary, borderRadius: radius.xl, height: 56, justifyContent: 'center', alignItems: 'center' },
    bookButtonDisabled: { opacity: 0.6 },
    actionButtonText: { ...typography.h3, color: '#fff' },

    trackButton: { backgroundColor: theme.primary, borderRadius: radius.xl, height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    liveBadge: { backgroundColor: theme.danger, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
    liveBadgeText: { color: '#fff', ...typography.label },

    statusBadge: { borderRadius: radius.lg, padding: spacing.md, alignItems: "center" },
    statusAccepted: { backgroundColor: theme.successBg },
    statusPending: { backgroundColor: theme.amberBg },
    statusText: { ...typography.bodyMedium, color: theme.textPrimary },

    messageBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: spacing.sm, borderRadius: radius.md },
    messageText: { ...typography.captionMedium, flex: 1 },
  });
}
