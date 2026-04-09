import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Linking,
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

type RideDetailsRouteProp = RouteProp<PassengerStackParamList, "RideDetails">;

export function RideDetailsScreen() {
  const { theme } = useTheme();
  const route = useRoute<RideDetailsRouteProp>();
  const navigation =
    useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const { ride } = route.params;

  const [currentRide, setCurrentRide] = useState(ride);
  const rideId = (ride as any).id;
  const availableSeats = Number(
    (currentRide as any).seatsAvailable ?? (currentRide as any).seatsTotal ?? 0,
  );
  const maxSeats = useMemo(() => Math.max(0, availableSeats), [availableSeats]);

  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [checking, setChecking] = useState(true);
  const [seatsRequested, setSeatsRequested] = useState(1);
  const [selectedMeetupPoint, setSelectedMeetupPoint] = useState<any>(null);
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>(
    [],
  );
  const [dropoffSuggestions, setDropoffSuggestions] = useState<
    PlaceSuggestion[]
  >([]);
  const [selectedPickup, setSelectedPickup] =
    useState<PlaceSuggestion | null>(null);
  const [selectedDropoff, setSelectedDropoff] =
    useState<PlaceSuggestion | null>(null);
  const [tripQuote, setTripQuote] = useState<BookingQuote | null>(null);
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
      lat: currentRide.pickup.lat,
      lng: currentRide.pickup.lng,
    }),
    [currentRide.pickup.lat, currentRide.pickup.lng],
  );

  const dropoffFocus = useMemo(
    () => ({
      lat: currentRide.dropoff.lat,
      lng: currentRide.dropoff.lng,
    }),
    [currentRide.dropoff.lat, currentRide.dropoff.lng],
  );

  const resetTripQuote = useCallback(() => {
    setTripQuote(null);
    setQuoteError("");
  }, []);

  const loadQuote = useCallback(
    async (pickup: PlaceSuggestion, dropoff: PlaceSuggestion, seats: number) => {
      setQuoteLoading(true);
      setQuoteError("");
      try {
        const res = await quoteBookingApi({
          rideId,
          seatsRequested: seats,
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
    },
    [rideId],
  );

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

  useEffect(() => {
    setSeatsRequested((prev) => clampSeats(prev));
  }, [maxSeats]);

  useEffect(() => {
    const meetupPoints = Array.isArray(currentRide.meetupPoints)
      ? currentRide.meetupPoints
      : [];

    if (meetupPoints.length > 0) {
      setSelectedMeetupPoint((prev: any) => {
        if (prev && meetupPoints.some((point) => point.id === prev.id)) {
          return prev;
        }
        return meetupPoints[0];
      });
    } else {
      setSelectedMeetupPoint(null);
    }
  }, [currentRide]);

  useEffect(() => {
    const run = async () => {
      try {
        await refreshBookingStatus();
      } catch {
        // ignore
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
    }, [refreshBookingStatus, refreshRide]),
  );

  useEffect(() => {
    if (existingBooking?.status !== "pending") {
      return;
    }

    const timer = setInterval(() => {
      refreshBookingStatus().catch(() => undefined);
    }, 5000);

    return () => clearInterval(timer);
  }, [existingBooking?.status, refreshBookingStatus]);

  useEffect(() => {
    refreshRide().catch(() => undefined);
  }, [refreshRide]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshRide().catch(() => undefined);
    }, 5000);

    return () => clearInterval(timer);
  }, [refreshRide]);

  useEffect(() => {
    const query = pickupQuery.trim();
    if (query.length < 3) {
      setPickupSuggestions([]);
      setPickupSearchLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setPickupSearchLoading(true);
      try {
        const res = await searchPlacesApi(query, pickupFocus.lat, pickupFocus.lng);
        setPickupSuggestions(res.places);
      } catch {
        setPickupSuggestions([]);
      } finally {
        setPickupSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [pickupQuery, pickupFocus.lat, pickupFocus.lng]);

  useEffect(() => {
    const query = dropoffQuery.trim();
    if (query.length < 3) {
      setDropoffSuggestions([]);
      setDropoffSearchLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setDropoffSearchLoading(true);
      try {
        const res = await searchPlacesApi(query, dropoffFocus.lat, dropoffFocus.lng);
        setDropoffSuggestions(res.places);
      } catch {
        setDropoffSuggestions([]);
      } finally {
        setDropoffSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dropoffQuery, dropoffFocus.lat, dropoffFocus.lng]);

  useEffect(() => {
    if (!selectedPickup || !selectedDropoff || existingBooking) {
      resetTripQuote();
      return;
    }

    const seats = clampSeats(seatsRequested);
    const timer = setTimeout(() => {
      loadQuote(selectedPickup, selectedDropoff, seats);
    }, 250);

    return () => clearTimeout(timer);
  }, [
    seatsRequested,
    selectedPickup,
    selectedDropoff,
    existingBooking,
    loadQuote,
    resetTripQuote,
  ]);

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
      setMessage(`You already have a ${existingBooking.status} booking.`);
      return;
    }

    const seats = clampSeats(seatsRequested);
    if (seats <= 0) {
      setMessage("No seats available.");
      return;
    }

    if (!selectedPickup || !selectedDropoff) {
      setMessage("Please select your pickup and dropoff locations.");
      return;
    }

    if (quoteError) {
      setMessage(quoteError);
      return;
    }

    if (!tripQuote) {
      setMessage("Please wait while we calculate your trip price.");
      return;
    }

    if (Array.isArray(currentRide.meetupPoints) && currentRide.meetupPoints.length > 0 && !selectedMeetupPoint) {
      setMessage("Please select a meetup point.");
      return;
    }

    setLoading(true);
    try {
      await createBookingApi({
        rideId,
        seatsRequested: seats,
        meetupPoint: selectedMeetupPoint,
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
    const polyline =
      (currentRide as any).encodedPolyline ||
      (routeCoords.length > 0 ? JSON.stringify(routeCoords) : null);

    navigation.navigate("LiveRide", {
      rideId,
      pickupLat: currentRide.pickup.lat,
      pickupLng: currentRide.pickup.lng,
      dropoffLat: currentRide.dropoff.lat,
      dropoffLng: currentRide.dropoff.lng,
      encodedPolyline: polyline,
      driverPhone: currentRide.driver.phone || null,
      meetupPoint: selectedMeetupPreview || null,
    });
  };

  const isDisabled =
    loading ||
    checking ||
    !!existingBooking ||
    maxSeats <= 0 ||
    quoteLoading ||
    !selectedPickup ||
    !selectedDropoff ||
    !!quoteError;
  const isAccepted = existingBooking?.status === "accepted";

  const latitudeDelta = Math.max(
    Math.abs(currentRide.pickup.lat - currentRide.dropoff.lat) * 2,
    0.05,
  );
  const longitudeDelta = Math.max(
    Math.abs(currentRide.pickup.lng - currentRide.dropoff.lng) * 2,
    0.05,
  );

  const initialRegion = {
    latitude: (currentRide.pickup.lat + currentRide.dropoff.lat) / 2,
    longitude: (currentRide.pickup.lng + currentRide.dropoff.lng) / 2,
    latitudeDelta,
    longitudeDelta,
  };

  const distanceKm = (distanceMeters / 1000).toFixed(1);
  const durationMin = Math.ceil(durationSeconds / 60);
  const avgRating =
    typeof currentRide.driver.avgRating === "number"
      ? currentRide.driver.avgRating.toFixed(1)
      : null;
  const totalReviews = currentRide.driver.totalReviews ?? 0;

  const fareBreakdown = currentRide.fareBreakdown || null;
  const meetupPoints = Array.isArray(currentRide.meetupPoints)
    ? currentRide.meetupPoints
    : [];
  const selectedMeetupPreview =
    selectedMeetupPoint ||
    (meetupPoints.length > 0 ? meetupPoints[0] : null);
  const formatKm = (value: unknown) =>
    Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} km` : "N/A";
  const formatKmPerLitre = (value: unknown) =>
    Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} km/L` : "N/A";
  const formatCurrency = (value: unknown) =>
    Number.isFinite(Number(value)) ? `Rs ${Math.round(Number(value))}` : "N/A";
  const bookedSeats = existingBooking?.seatsRequested ?? seatsRequested;
  const quoteTotalPrice =
    tripQuote && Number.isFinite(Number(tripQuote.totalPrice))
      ? Math.round(tripQuote.totalPrice)
      : null;
  const quotePerSeatPrice =
    tripQuote && Number.isFinite(Number(tripQuote.perSeatPrice))
      ? Math.round(tripQuote.perSeatPrice)
      : null;

  const openMeetupPoint = async (point: any) => {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const label = encodeURIComponent(point?.label || "Meetup point");
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });

    try {
      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
      }
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      );
    } catch {
      // ignore
    }
  };

  const onSelectPickup = (place: PlaceSuggestion) => {
    setSelectedPickup(place);
    setPickupQuery(place.label);
    setPickupSuggestions([]);
    setMessage("");
    setQuoteError("");
  };

  const onSelectDropoff = (place: PlaceSuggestion) => {
    setSelectedDropoff(place);
    setDropoffQuery(place.label);
    setDropoffSuggestions([]);
    setMessage("");
    setQuoteError("");
  };

  const polylineCoords = routeCoords
    .filter(
      (point) =>
        point && typeof point.lat === "number" && typeof point.lng === "number",
    )
    .map((point) => ({
      latitude: point.lat,
      longitude: point.lng,
    }));

  const s = makeStyles(theme);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.heroCard}>
        <Text style={s.heroTitle}>
          {currentRide.pickup.address}
          {" \u2192 "}
          {currentRide.dropoff.address}
        </Text>

        <View style={s.heroMetaRow}>
          <MetaChip
            icon="calendar-outline"
            text={new Date(currentRide.departureTime).toLocaleString()}
            theme={theme}
          />
          <MetaChip
            icon="people-outline"
            text={`${maxSeats} seats available`}
            theme={theme}
          />
        </View>

        {currentRide.femaleOnly && (
          <View style={s.restrictionBanner}>
            <Ionicons name="female" size={14} color={theme.success} />
            <Text style={s.restrictionText}>
              Female-only ride. Only female passengers can book this trip.
            </Text>
          </View>
        )}

        <View style={s.heroPriceRow}>
          <View />
          <View style={s.pricePill}>
            <Text style={s.pricePillLabel}>Per seat</Text>
            <Text style={s.pricePillValue}>Rs {currentRide.price}</Text>
          </View>
        </View>
      </View>

      <View style={s.card}>
        <View style={s.sectionHeader}>
          <View>
            <Text style={s.sectionTitle}>Your Trip</Text>
            <Text style={s.sectionSubtitle}>
              Enter your pickup and dropoff. We’ll calculate the shared segment
              price from this ride only.
            </Text>
          </View>
          <Ionicons
            name="swap-horizontal-outline"
            size={18}
            color={theme.primary}
          />
        </View>

        <View style={s.tripFieldGroup}>
          <Text style={s.tripFieldLabel}>Pickup location</Text>
          <View style={s.tripFieldWrap}>
            <Ionicons
              name="navigate-circle-outline"
              size={18}
              color={theme.primary}
            />
            <TextInput
              value={pickupQuery}
              onChangeText={(text) => {
                setPickupQuery(text);
                setSelectedPickup(null);
                resetTripQuote();
              }}
              placeholder="Search your pickup"
              placeholderTextColor={theme.textMuted}
              style={s.tripFieldInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {pickupSearchLoading && (
              <ActivityIndicator size="small" color={theme.primary} />
            )}
          </View>

          {pickupSuggestions.length > 0 && !selectedPickup && (
            <View style={s.suggestionList}>
              {pickupSuggestions.slice(0, 5).map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => onSelectPickup(place)}
                  style={s.suggestionItem}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.suggestionLabel}>{place.label}</Text>
                    <Text style={s.suggestionSub}>Pickup search result</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {selectedPickup && (
            <View style={s.selectedPlacePill}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={theme.primary}
              />
              <Text style={s.selectedPlaceText}>{selectedPickup.label}</Text>
              <Pressable
                onPress={() => {
                  setSelectedPickup(null);
                  resetTripQuote();
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.textMuted}
                />
              </Pressable>
            </View>
          )}
        </View>

        <View style={s.tripFieldGroup}>
          <Text style={s.tripFieldLabel}>Dropoff location</Text>
          <View style={s.tripFieldWrap}>
            <Ionicons name="flag-outline" size={18} color={theme.primary} />
            <TextInput
              value={dropoffQuery}
              onChangeText={(text) => {
                setDropoffQuery(text);
                setSelectedDropoff(null);
                resetTripQuote();
              }}
              placeholder="Search your dropoff"
              placeholderTextColor={theme.textMuted}
              style={s.tripFieldInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {dropoffSearchLoading && (
              <ActivityIndicator size="small" color={theme.primary} />
            )}
          </View>

          {dropoffSuggestions.length > 0 && !selectedDropoff && (
            <View style={s.suggestionList}>
              {dropoffSuggestions.slice(0, 5).map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => onSelectDropoff(place)}
                  style={s.suggestionItem}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.suggestionLabel}>{place.label}</Text>
                    <Text style={s.suggestionSub}>Dropoff search result</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {selectedDropoff && (
            <View style={s.selectedPlacePill}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={theme.primary}
              />
              <Text style={s.selectedPlaceText}>{selectedDropoff.label}</Text>
              <Pressable
                onPress={() => {
                  setSelectedDropoff(null);
                  resetTripQuote();
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.textMuted}
                />
              </Pressable>
            </View>
          )}
        </View>

        {quoteLoading && (
          <View style={s.quoteLoadingRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={s.quoteLoadingText}>
              Calculating your trip price...
            </Text>
          </View>
        )}

        {quoteError ? (
          <View style={s.quoteErrorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={theme.danger}
            />
            <Text style={s.quoteErrorText}>{quoteError}</Text>
          </View>
        ) : null}

        {tripQuote && (
          <View style={s.quoteCard}>
            <View style={s.quoteHeader}>
              <View>
                <Text style={s.quoteLabel}>Estimated for your route</Text>
                <Text style={s.quoteValue}>Rs {quoteTotalPrice ?? "--"}</Text>
              </View>
              <View style={s.quotePill}>
                <Text style={s.quotePillText}>
                  {quotePerSeatPrice != null
                    ? `Rs ${quotePerSeatPrice} / seat`
                    : "Per seat"}
                </Text>
              </View>
            </View>

            <View style={s.quoteMetaRow}>
              <MetaChip
                icon="map-outline"
                text={`${tripQuote.segmentDistanceKm.toFixed(1)} km used`}
                theme={theme}
              />
              <MetaChip
                icon="git-merge-outline"
                text={`${tripQuote.totalTravelers} sharing`}
                theme={theme}
              />
              <MetaChip
                icon="alert-circle-outline"
                text={`${tripQuote.routeDeviationKm.toFixed(1)} km from route`}
                theme={theme}
              />
            </View>
          </View>
        )}
      </View>

      <View style={s.mapContainer}>
        <MapView style={s.map} initialRegion={initialRegion}>
          <Marker
            coordinate={{
              latitude: currentRide.pickup.lat,
              longitude: currentRide.pickup.lng,
            }}
            title="Pickup"
            pinColor="green"
          />
          <Marker
            coordinate={{
              latitude: currentRide.dropoff.lat,
              longitude: currentRide.dropoff.lng,
            }}
            title="Dropoff"
            pinColor="red"
          />
          {meetupPoints.map((point: any) => (
            <Marker
              key={point.id}
              coordinate={{
                latitude: point.lat,
                longitude: point.lng,
              }}
              title={point.label}
              description={point.placeName || point.address || `Pickup zone ${point.order}`}
              pinColor={selectedMeetupPreview?.id === point.id ? theme.primary : theme.amber}
            />
          ))}
          {polylineCoords.length > 0 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={theme.primary}
              strokeWidth={4}
            />
          )}
        </MapView>
      </View>

      <View style={s.statsGrid}>
        <StatCard
          icon="navigate"
          value={distanceKm}
          label="Distance"
          theme={theme}
        />
        <StatCard
          icon="time-outline"
          value={`${durationMin} min`}
          label="Est. Duration"
          theme={theme}
        />
        <StatCard
          icon="cash-outline"
          value={
            quotePerSeatPrice != null
              ? `Rs ${quotePerSeatPrice}`
              : `Rs ${currentRide.price}`
          }
          label={quotePerSeatPrice != null ? "Trip seat price" : "Per seat"}
          theme={theme}
        />
      </View>

      <View style={s.card}>
        <View style={s.sectionHeader}>
          <View>
            <Text style={s.sectionTitle}>Meetup Point</Text>
            <Text style={s.sectionSubtitle}>
              Meet the driver at the shared pickup point before the ride starts.
            </Text>
          </View>
          <Ionicons name="location-outline" size={18} color={theme.primary} />
        </View>

        <View style={s.meetupBox}>
          <Text style={s.meetupLabel}>Suggested pickup zones</Text>
          {meetupPoints.length > 0 ? (
            <>
              <Text style={s.meetupValue}>
                {selectedMeetupPreview?.label || "Pickup zone 1"}
              </Text>
              <Text style={s.meetupNote}>
                {selectedMeetupPreview?.address ||
                  "Choose one of the suggested pickup zones near the driver's starting point."}
              </Text>

              <View style={s.meetupPreviewRow}>
                {meetupPoints.map((point: any) => {
                  const active = selectedMeetupPreview?.id === point.id;
                  return (
                    <View
                      key={point.id}
                      style={[s.meetupPreviewChip, active && s.meetupPreviewChipActive]}
                    >
                      <Text
                        style={[
                          s.meetupPreviewChipLabel,
                          active && s.meetupPreviewChipLabelActive,
                        ]}
                      >
                        {point.label}
                      </Text>
                      <Text style={s.meetupPreviewChipSub}>
                        {point.placeName || point.address || `Pickup zone ${point.order}`}
                      </Text>
                      {Number.isFinite(Number(point.distanceFromStartKm)) && (
                        <Text style={s.meetupPreviewChipSub}>
                          {Number(point.distanceFromStartKm).toFixed(1)} km from driver start
                        </Text>
                      )}
                      <Pressable
                        onPress={() => openMeetupPoint(point)}
                        style={s.meetupOpenBtn}
                      >
                        <Ionicons name="map-outline" size={12} color={theme.primary} />
                        <Text style={s.meetupOpenBtnText}>Open in Maps</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={s.meetupValue}>{currentRide.pickup.address}</Text>
              <Text style={s.meetupNote}>
                The driver has not set checkpoint zones, so the pickup point
                is the shared meetup point.
              </Text>
            </>
          )}
        </View>
      </View>

      {fareBreakdown && (
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>Fare Breakdown</Text>
              <Text style={s.sectionSubtitle}>
                Transparent shared-cost pricing for this trip
              </Text>
            </View>
            <View style={s.sectionPill}>
              <Text style={s.sectionPillText}>FR12</Text>
            </View>
          </View>

          <View style={s.breakdownGrid}>
            <BreakdownRow
              label="Distance"
              value={formatKm(fareBreakdown.distanceKm)}
            />
            <BreakdownRow
              label="Fuel avg"
              value={formatKmPerLitre(fareBreakdown.avgKmPerLitre)}
            />
            <BreakdownRow
              label="Fuel price"
              value={
                fareBreakdown.fuelPricePerLitre
                  ? `Rs ${fareBreakdown.fuelPricePerLitre}/L`
                  : "N/A"
              }
            />
            <BreakdownRow
              label="Total riders"
              value={
                Number.isFinite(Number(fareBreakdown.totalTravelers))
                  ? `${fareBreakdown.totalTravelers}`
                  : "N/A"
              }
            />
            <BreakdownRow
              label="Route fuel cost"
              value={formatCurrency(fareBreakdown.totalFuelCost)}
            />
            <BreakdownRow
              label="Final price / seat"
              value={formatCurrency(fareBreakdown.finalPrice)}
              emphasis
            />
          </View>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.sectionTitle}>Ride Details</Text>

        <DetailRow
          icon="person-outline"
          label="Driver"
          value={currentRide.driver.name}
          theme={theme}
        />
        <DetailRow
          icon="mail-outline"
          label="Contact"
          value={currentRide.driver.email}
          theme={theme}
        />
        <DetailRow
          icon="star-outline"
          label="Rating"
          value={
            avgRating
              ? `${avgRating} (${totalReviews} review${totalReviews === 1 ? "" : "s"})`
              : "No reviews yet"
          }
          theme={theme}
        />
      </View>

      {isAccepted && (
        <Pressable style={s.trackButton} onPress={onTrackLive}>
          <Ionicons name="location" size={20} color="#fff" />
          <Text style={s.trackButtonText}>Track Live Ride</Text>
          <View style={s.liveBadge}>
            <Text style={s.liveBadgeText}>LIVE</Text>
          </View>
        </Pressable>
      )}

      {!existingBooking && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Seats to Book</Text>
          <Text style={s.sectionSubtitle}>
            Select how many seats you want to reserve for this shared trip.
          </Text>
          <Text style={s.totalPriceText}>
            {tripQuote
              ? `Total for ${bookedSeats} seat${bookedSeats === 1 ? "" : "s"}: Rs ${quoteTotalPrice}`
              : "Choose pickup and dropoff to see your trip price."}
          </Text>

          {meetupPoints.length > 0 && (
            <View style={s.meetupPicker}>
              <Text style={s.meetupPickerTitle}>Choose meetup point</Text>
              <View style={s.meetupOptions}>
                {meetupPoints.map((point: any) => {
                  const active = selectedMeetupPoint?.id === point.id;
                  return (
                    <Pressable
                      key={point.id}
                      onPress={() => setSelectedMeetupPoint(point)}
                      style={[
                        s.meetupOption,
                        active && s.meetupOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          s.meetupOptionLabel,
                          active && s.meetupOptionLabelActive,
                        ]}
                      >
                        {point.label}
                      </Text>
                      <Text
                        style={[
                          s.meetupOptionHint,
                          active && s.meetupOptionHintActive,
                        ]}
                      >
                        {point.address || `Checkpoint ${point.order}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={s.seatRow}>
            <Pressable
              disabled={isDisabled || seatsRequested <= 1}
              onPress={() => setSeatsRequested((v) => clampSeats(v - 1))}
              style={[
                s.seatBtn,
                (isDisabled || seatsRequested <= 1) && s.seatBtnDisabled,
              ]}
            >
              <Text style={s.seatBtnText}>-</Text>
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
                (isDisabled || seatsRequested >= maxSeats) && s.seatBtnDisabled,
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
              ? "Booking accepted"
              : `Booking ${existingBooking.status}`}
          </Text>
        </View>
      ) : null}

      {message ? (
        <View
          style={[
            s.messageBox,
            { backgroundColor: message.startsWith("Booking") ? theme.primarySubtle : theme.dangerBg },
          ]}
        >
          <Ionicons
            name={message.startsWith("Booking") ? "checkmark-circle" : "alert-circle"}
            size={16}
            color={message.startsWith("Booking") ? theme.primary : theme.danger}
          />
          <Text
            style={[
              s.messageText,
              { color: message.startsWith("Booking") ? theme.primary : theme.danger },
            ]}
          >
            {message}
          </Text>
        </View>
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

function MetaChip({
  icon,
  text,
  theme,
}: {
  icon: any;
  text: string;
  theme: any;
}) {
  return (
    <View style={[stylesMetaChip(theme)]}>
      <Ionicons name={icon} size={14} color={theme.primary} />
      <Text style={stylesMetaChipText(theme)} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
  theme,
}: {
  icon: any;
  value: string;
  label: string;
  theme: any;
}) {
  return (
    <View style={stylesStatCard(theme)}>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <Text style={stylesStatValue(theme)}>{value}</Text>
      <Text style={stylesStatLabel(theme)}>{label}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={stylesDetailRow()}>
      <View style={[stylesDetailIcon(theme)]}>
        <Ionicons name={icon} size={16} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={stylesDetailLabel(theme)}>{label}</Text>
        <Text style={stylesDetailValue(theme)}>{value}</Text>
      </View>
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={breakdownRowStyle(emphasis)}>
      <Text style={breakdownLabelStyle(emphasis)}>{label}</Text>
      <Text style={breakdownValueStyle(emphasis)}>{value}</Text>
    </View>
  );
}

function stylesMetaChip(theme: any) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  };
}

function stylesMetaChipText(theme: any) {
  return {
    ...typography.captionMedium,
    color: theme.textSecondary,
    flexShrink: 1,
  };
}

function stylesStatCard(theme: any) {
  return {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: "center" as const,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
  };
}

function stylesStatValue(theme: any) {
  return {
    ...typography.bodyMedium,
    color: theme.textPrimary,
    textAlign: "center" as const,
  };
}

function stylesStatLabel(theme: any) {
  return {
    ...typography.captionMedium,
    color: theme.textSecondary,
    textAlign: "center" as const,
  };
}

function stylesDetailRow() {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingVertical: 8,
  };
}

function stylesDetailIcon(theme: any) {
  return {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: theme.primarySubtle,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

function stylesDetailLabel(theme: any) {
  return {
    ...typography.caption,
    color: theme.textMuted,
  };
}

function stylesDetailValue(theme: any) {
  return {
    ...typography.bodyMedium,
    color: theme.textPrimary,
  };
}

function breakdownRowStyle(emphasis?: boolean) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 10,
    borderBottomWidth: emphasis ? 0 : 1,
    borderBottomColor: "#E2E8F0",
  };
}

function breakdownLabelStyle(emphasis?: boolean) {
  return {
    ...typography.bodyMedium,
    color: emphasis ? "#0F172A" : "#475569",
  };
}

function breakdownValueStyle(emphasis?: boolean) {
  return {
    ...typography.bodyMedium,
    color: emphasis ? "#0F172A" : "#334155",
    fontWeight: "700" as const,
  };
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
    heroCard: {
      backgroundColor: theme.surface,
      borderRadius: radius["2xl"],
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 3,
      gap: 14,
    },
    pricePill: {
      backgroundColor: theme.primary,
      borderRadius: radius.xl,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: "flex-end",
      alignSelf: "flex-end",
    },
    pricePillLabel: { ...typography.caption, color: "rgba(255,255,255,0.8)" },
    pricePillValue: { ...typography.h4, color: "#fff" },
    heroTitle: {
      ...typography.h2,
      color: theme.textPrimary,
      lineHeight: 30,
      flexWrap: "wrap",
    },
    heroMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    restrictionBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: radius.lg,
      backgroundColor: "#ecfdf5",
      borderWidth: 1,
      borderColor: "#bbf7d0",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    restrictionText: {
      ...typography.captionMedium,
      color: "#15803d",
      fontWeight: "700",
      flex: 1,
    },
    heroPriceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 4,
    },
    tripFieldGroup: {
      gap: 8,
      marginTop: spacing.sm,
    },
    tripFieldLabel: {
      ...typography.captionMedium,
      color: theme.textMuted,
      textTransform: "uppercase",
    },
    tripFieldWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      minHeight: 50,
    },
    tripFieldInput: {
      flex: 1,
      ...typography.bodyMedium,
      color: theme.textPrimary,
      paddingVertical: 0,
    },
    suggestionList: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    suggestionItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    suggestionLabel: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
    },
    suggestionSub: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 1,
    },
    selectedPlacePill: {
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.full,
      backgroundColor: theme.primarySubtle,
      borderWidth: 1,
      borderColor: theme.primary + "33",
    },
    selectedPlaceText: {
      ...typography.captionMedium,
      color: theme.primary,
      flex: 1,
    },
    quoteLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    quoteLoadingText: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    quoteErrorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginTop: 2,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: theme.dangerBg,
    },
    quoteErrorText: {
      ...typography.captionMedium,
      color: theme.danger,
      flex: 1,
    },
    quoteCard: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    quoteHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    quoteLabel: {
      ...typography.caption,
      color: theme.textMuted,
      textTransform: "uppercase",
    },
    quoteValue: {
      ...typography.h3,
      color: theme.textPrimary,
      marginTop: 2,
    },
    quotePill: {
      alignSelf: "flex-start",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.primary + "33",
    },
    quotePillText: {
      ...typography.captionMedium,
      color: theme.primary,
      fontWeight: "700",
    },
    quoteMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    mapContainer: {
      height: 240,
      borderRadius: radius["2xl"],
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    map: { flex: 1 },
    statsGrid: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius["2xl"],
      padding: spacing.lg,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 4,
    },
    sectionTitle: { ...typography.h4, color: theme.textPrimary },
    sectionSubtitle: { ...typography.caption, color: theme.textSecondary, marginTop: 4 },
    sectionPill: {
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    sectionPillText: { ...typography.captionMedium, color: theme.primary },
    breakdownGrid: {
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: "#E2E8F0",
    },
    meetupBox: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: 6,
    },
    meetupPreviewRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    meetupPreviewChip: {
      flexGrow: 1,
      minWidth: "30%",
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: spacing.sm,
      gap: 3,
    },
    meetupPreviewChipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primarySubtle,
    },
    meetupPreviewChipLabel: {
      ...typography.captionMedium,
      color: theme.textPrimary,
      fontWeight: "700",
    },
    meetupPreviewChipLabelActive: {
      color: theme.primary,
    },
    meetupPreviewChipSub: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    meetupOpenBtn: {
      marginTop: 6,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    meetupOpenBtnText: {
      ...typography.captionMedium,
      color: theme.primary,
    },
    meetupPicker: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    meetupPickerTitle: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: "700",
    },
    meetupOptions: {
      gap: spacing.sm,
    },
    meetupOption: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: theme.surfaceElevated,
    },
    meetupOptionActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primarySubtle,
    },
    meetupOptionLabel: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: "700",
    },
    meetupOptionLabelActive: {
      color: theme.primary,
    },
    meetupOptionHint: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    meetupOptionHintActive: {
      color: theme.primary,
    },
    meetupLabel: {
      ...typography.caption,
      color: theme.textMuted,
      textTransform: "uppercase",
    },
    meetupValue: { ...typography.bodyMedium, color: theme.textPrimary },
    meetupNote: { ...typography.caption, color: theme.textSecondary, lineHeight: 18 },
    trackButton: {
      backgroundColor: theme.primary,
      borderRadius: radius["2xl"],
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
    seatRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
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
    totalPriceText: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      borderRadius: radius.lg,
      padding: spacing.md,
      alignItems: "center",
    },
    statusAccepted: { backgroundColor: theme.successBg },
    statusPending: { backgroundColor: theme.amberBg },
    statusText: { ...typography.bodyMedium, color: theme.textPrimary },
    messageBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      padding: spacing.md,
      borderRadius: radius.lg,
    },
    messageText: { ...typography.bodyMedium, flex: 1 },
    bookButton: {
      backgroundColor: theme.primary,
      borderRadius: radius["2xl"],
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
