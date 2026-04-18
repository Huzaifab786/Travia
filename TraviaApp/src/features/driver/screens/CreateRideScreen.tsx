import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Animated,
  PanResponder,
  ScrollView,
  KeyboardAvoidingView,
  StatusBar,
} from "react-native";
import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { createRideApi } from "../api/driverRideApi";
import { reverseGeocodeApi } from "../api/placeApi";
import { previewRouteApi, RoutePoint } from "../../map/api/routeApi";
import { getDriverStatusApi, DriverStatus } from "../api/driverApi";
import { DriverStackParamList } from "../navigation/DriverNavigator";
import { getMyVehicleApi, Vehicle } from "../api/vehicleApi";
import {
  getPricingSettingsApi,
  PricingSettings,
} from "../../pricing/api/pricingApi";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { hp, screen } from "../../../lib/utils/responsive";

type Coords = { lat: number; lng: number };
type ManualMeetupPoint = {
  id: string;
  label: string;
  address?: string;
  lat: number;
  lng: number;
  order: number;
};
type CreateRideNavProp = NativeStackNavigationProp<
  DriverStackParamList,
  "CreateRide"
>;
type CreateRideRouteProp = RouteProp<DriverStackParamList, "CreateRide">;

const DRAWER_PEEK = hp(260);
const DRAWER_OPEN = hp(560);

export function CreateRideScreen() {
  const { theme } = useTheme();
  const { user } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CreateRideNavProp>();
  const route = useRoute<CreateRideRouteProp>();
  const mapRef = useRef<MapView | null>(null);

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCoords, setDropoffCoords] = useState<Coords | null>(null);

  const [date, setDate] = useState(new Date(Date.now() + 15 * 60 * 1000)); // Default to 15 mins from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [seatsTotal, setSeatsTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [checkpointCount, setCheckpointCount] = useState<2 | 3>(3);
  const [femaleOnly, setFemaleOnly] = useState(false);

  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("unverified");

  const [mapRegion, setMapRegion] = useState({
    latitude: 24.8607,
    longitude: 67.0011,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  });
  const [routeCoords, setRouteCoords] = useState<RoutePoint[]>([]);
  const [routeOptions, setRouteOptions] = useState<
    Array<{
      id: string;
      label: string;
      coordinates: RoutePoint[];
      distanceMeters: number;
      durationSeconds: number;
    }>
  >([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [pricePerSeat, setPricePerSeat] = useState(0);
  const [manualMeetupPoints] = useState<ManualMeetupPoint[]>([]);

  const driverGender = user?.user_metadata?.gender ?? null;
  const canCreateFemaleOnly = driverGender === "female";

  const drawerY = useRef(
    new Animated.Value(screen.height - DRAWER_PEEK),
  ).current;
  const drawerOpen = useRef(false);

  const snapDrawer = (open: boolean) => {
    drawerOpen.current = open;
    Animated.spring(drawerY, {
      toValue: open ? screen.height - DRAWER_OPEN : screen.height - DRAWER_PEEK,
      useNativeDriver: false,
      damping: 18,
      stiffness: 200,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        drawerY.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const current = drawerOpen.current
          ? screen.height - DRAWER_OPEN
          : screen.height - DRAWER_PEEK;
        const next = current + g.dy;
        const min = screen.height - DRAWER_OPEN - 20;
        const max = screen.height - DRAWER_PEEK;
        drawerY.setValue(Math.max(min, Math.min(max, next)));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -60) snapDrawer(true);
        else if (g.dy > 60) snapDrawer(false);
        else snapDrawer(drawerOpen.current);
      },
    }),
  ).current;

  const centerMap = (lat: number, lng: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      500,
    );
  };

  const fitToPoints = () => {
    if (!pickupCoords && !dropoffCoords) return;

    const points = [pickupCoords, dropoffCoords]
      .filter(Boolean)
      .map((p) => ({
        latitude: (p as Coords).lat,
        longitude: (p as Coords).lng,
      }));

    if (points.length === 1) {
      centerMap(points[0].latitude, points[0].longitude);
      return;
    }

    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 140, right: 60, bottom: DRAWER_PEEK + 60, left: 60 },
      animated: true,
    });
  };

  useEffect(() => {
    const boot = async () => {
      setBootLoading(true);

      try {
        const permPromise = Location.requestForegroundPermissionsAsync();
        const vehiclePromise = getMyVehicleApi();
        const statusPromise = getDriverStatusApi();

        const perm = await permPromise;

        if (perm.status === "granted") {
          try {
            const loc = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = loc.coords;
            setMapRegion({
              latitude,
              longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            });
            mapRef.current?.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              },
              500,
            );
          } catch {}
        }

        const [vehicleRes, statusRes] = await Promise.all([
          vehiclePromise,
          statusPromise,
        ]);

        setVehicle(vehicleRes.vehicle);
        setDriverStatus(statusRes.status);

        try {
          const pricingRes = await getPricingSettingsApi();
          setPricing(pricingRes.pricingSettings);
        } catch {
          setPricing(null);
        }

        if (statusRes.status !== "verified") {
          setMessage("⚠️ Identity verification required to publish rides.");
        } else if (!vehicleRes.vehicle) {
          setMessage("⚠️ Please setup your vehicle profile to calculate costs.");
        }
      } catch {
        setMessage("Could not access location. Search places manually.");
      } finally {
        setBootLoading(false);
      }
    };

    boot();
  }, []);

  useEffect(() => {
    fitToPoints();
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    const selectedPlace = route.params?.selectedPlace;
    const selectedField = route.params?.selectedField;

    if (!selectedPlace || !selectedField) return;

    if (selectedField === "pickup") {
      setPickupAddress(selectedPlace.label);
      setPickupCoords({
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
      });
    }

    if (selectedField === "dropoff") {
      setDropoffAddress(selectedPlace.label);
      setDropoffCoords({
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
      });
    }

    centerMap(selectedPlace.lat, selectedPlace.lng);

    navigation.setParams({
      selectedPlace: undefined,
      selectedField: undefined,
    });
  }, [route.params?.selectedPlace, route.params?.selectedField, navigation]);

  useEffect(() => {
    const load = async () => {
      if (!pickupCoords || !dropoffCoords) {
        setRouteCoords([]);
        setRouteOptions([]);
        setSelectedRouteIndex(0);
        setDistanceMeters(0);
        setDurationSeconds(0);
        setPricePerSeat(0);
        return;
      }

      try {
        setRouteLoading(true);
        const res = await previewRouteApi(
          pickupCoords.lat,
          pickupCoords.lng,
          dropoffCoords.lat,
          dropoffCoords.lng,
        );
        const options = (res.routes?.length ? res.routes : [res.route]).filter(Boolean);
        setRouteOptions(options);
        setSelectedRouteIndex((prev) => Math.min(prev, Math.max(options.length - 1, 0)));
        const selected = options[0];
        setRouteCoords(selected?.coordinates || []);
        setDistanceMeters(selected?.distanceMeters || 0);
        setDurationSeconds(selected?.durationSeconds || 0);
      } catch {
        setRouteCoords([]);
        setRouteOptions([]);
        setSelectedRouteIndex(0);
        setDistanceMeters(0);
        setDurationSeconds(0);
      } finally {
        setRouteLoading(false);
      }
    };

    load();
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    const selected = routeOptions[selectedRouteIndex];
    if (!selected) return;
    setRouteCoords(selected.coordinates || []);
    setDistanceMeters(selected.distanceMeters || 0);
    setDurationSeconds(selected.durationSeconds || 0);
  }, [routeOptions, selectedRouteIndex]);

  useEffect(() => {
    if (distanceMeters > 0 && vehicle && seatsTotal && pricing) {
      const km = distanceMeters / 1000;
      const fuel = (km / vehicle.avgKmPerLitre) * pricing.fuelPricePerLitre;
      setPricePerSeat(
        Math.max(20, Math.round(fuel / (Number(seatsTotal) + 1))),
      );
    } else {
      setPricePerSeat(0);
    }
  }, [distanceMeters, vehicle, seatsTotal, pricing]);

  const navigateToSearch = (field: "pickup" | "dropoff") => {
    navigation.navigate("LocationSearch", {
      field,
      title: `Search ${field === "pickup" ? "Pickup" : "Dropoff"}`,
      focusLat: field === "dropoff" ? pickupCoords?.lat : undefined,
      focusLng: field === "dropoff" ? pickupCoords?.lng : undefined,
    });
  };

  const useMyLocation = async () => {
    setMessage("");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setMessage("Location permission required.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      const res = await reverseGeocodeApi(latitude, longitude);
      const label = res.place?.label;

      if (!label) {
        setMessage("Could not determine your address.");
        return;
      }

      setPickupCoords({ lat: latitude, lng: longitude });
      setPickupAddress(label);
      centerMap(latitude, longitude);
    } catch {
      setMessage("Could not fetch your location.");
    }
  };

  const onDateChange = (_: DateTimePickerEvent, d?: Date) => {
    setShowDatePicker(false);
    if (d) {
      const n = new Date(date);
      n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      setDate(n);
    }
  };

  const onTimeChange = (_: DateTimePickerEvent, d?: Date) => {
    setShowTimePicker(false);
    if (d) {
      const n = new Date(date);
      n.setHours(d.getHours(), d.getMinutes());
      setDate(n);
    }
  };

  const onSubmit = async () => {
    setMessage("");

    if (
      !pickupAddress ||
      !pickupCoords ||
      !dropoffAddress ||
      !dropoffCoords ||
      !seatsTotal
    ) {
      setMessage("Please fill all required fields.");
      return;
    }

    const seats = Number(seatsTotal);
    if (isNaN(seats) || seats < 1) {
      setMessage("Enter a valid seat count (min 1).");
      return;
    }

    if (!vehicle) {
      setMessage("Complete your vehicle profile first.");
      return;
    }

    if (driverStatus !== "verified") {
      setMessage("⚠️ You must be verified to publish rides.");
      return;
    }

    if (femaleOnly && !canCreateFemaleOnly) {
      setMessage("Only female drivers can create female-only rides.");
      return;
    }

    setLoading(true);
    try {
      await createRideApi({
        pickup: {
          address: pickupAddress,
          lat: pickupCoords.lat,
          lng: pickupCoords.lng,
        },
        dropoff: {
          address: dropoffAddress,
          lat: dropoffCoords.lat,
          lng: dropoffCoords.lng,
        },
        departureTime: date.toISOString(),
        seatsTotal: seats,
        notes: notes.trim(),
        femaleOnly,
        checkpointCount,
        selectedRouteIndex,
        manualMeetupPoints,
      });

      setMessage("✅ Ride created successfully!");
      setTimeout(() => navigation.goBack(), 1200);
    } catch (e: any) {
      setMessage(e.message || "Failed to create ride.");
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(theme);

  const hasRoute = distanceMeters > 0;
  const selectedRoute = routeOptions[selectedRouteIndex];


  return (
    <View style={s.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
        showsUserLocation
        userInterfaceStyle={theme.dark ? "dark" : "light"}
      >
        {pickupCoords && (
          <Marker
            coordinate={{
              latitude: pickupCoords.lat,
              longitude: pickupCoords.lng,
            }}
            title="Pickup"
            pinColor={theme.primary}
          />
        )}

        {dropoffCoords && (
          <Marker
            coordinate={{
              latitude: dropoffCoords.lat,
              longitude: dropoffCoords.lng,
            }}
            title="Dropoff"
            pinColor={theme.danger}
          />
        )}

        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords.map((p) => ({
              latitude: p.lat,
              longitude: p.lng,
            }))}
            strokeColor={theme.primary}
            strokeWidth={4}
          />
        )}

      </MapView>

      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.topBarTitle}>Create New Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[s.locationCard, { top: insets.top + 62 }]}>
        <Pressable
          style={s.locationRow}
          onPress={() => navigateToSearch("pickup")}
        >
          <View style={[s.locationDot, { backgroundColor: theme.primary }]} />
          <Text
            style={[s.locationText, !pickupAddress && s.locationPlaceholder]}
            numberOfLines={1}
          >
            {pickupAddress || "Pickup location"}
          </Text>
          {!pickupAddress && (
            <Pressable onPress={useMyLocation} style={s.myLocBtn}>
              <Ionicons name="locate-outline" size={16} color={theme.primary} />
            </Pressable>
          )}
        </Pressable>

        <View style={s.locationDivider} />

        <Pressable
          style={s.locationRow}
          onPress={() => navigateToSearch("dropoff")}
        >
          <View style={[s.locationDot, { backgroundColor: theme.danger }]} />
          <Text
            style={[s.locationText, !dropoffAddress && s.locationPlaceholder]}
            numberOfLines={1}
          >
            {dropoffAddress || "Destination"}
          </Text>
        </Pressable>
      </View>

      <Animated.View style={[s.drawer, { top: drawerY }]}>
        <View {...panResponder.panHandlers} style={s.drawerHandle}>
          <View style={s.handleBar} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.drawerContent}
          >
            {bootLoading && (
              <View style={s.routePill}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={s.routePillText}>Loading ride setup...</Text>
              </View>
            )}

            {routeLoading ? (
              <View style={s.routePill}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={s.routePillText}>Calculating route...</Text>
              </View>
            ) : hasRoute ? (
              <View style={s.routePill}>
                <Ionicons name="navigate" size={14} color={theme.primary} />
                <Text style={s.routePillText}>
                  {(distanceMeters / 1000).toFixed(1)} km
                  {"  ·  "}
                  {Math.ceil(durationSeconds / 60)} min
                </Text>
                {selectedRoute && (
                  <Text style={s.routeSubText}>
                    {selectedRouteIndex === 0
                      ? "Preferred route selected"
                      : "Alternative route selected"}
                  </Text>
                )}
                {pricePerSeat > 0 && (
                  <View style={s.priceTag}>
                    <Text style={s.priceTagText}>Rs {pricePerSeat}/seat</Text>
                  </View>
                )}
                {pricing && (
                  <Text style={s.routeSubText}>
                    Admin fuel price: Rs {pricing.fuelPricePerLitre}/L
                  </Text>
                )}
              </View>
            ) : null}

            {routeOptions.length > 1 && (
              <View style={s.routeChoices}>
                <Text style={s.sectionLabel}>Choose Route</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.routeChoiceRow}
                >
                  {routeOptions.map((option, index) => {
                    const active = selectedRouteIndex === index;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => setSelectedRouteIndex(index)}
                        style={[
                          s.routeChoiceCard,
                          active && s.routeChoiceCardActive,
                        ]}
                      >
                        <Text
                          style={[
                            s.routeChoiceTitle,
                            active && s.routeChoiceTitleActive,
                          ]}
                        >
                          {index === 0 ? "Preferred route" : "Alternative route"}
                        </Text>
                        <Text style={s.routeChoiceMeta}>
                          {Number(option.distanceMeters / 1000).toFixed(1)} km ·{" "}
                          {Math.ceil(option.durationSeconds / 60)} min
                        </Text>
                        <Text style={s.routeChoiceHint}>
                          Tap to use this route for the ride
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <Text style={s.sectionLabel}>Departure Schedule</Text>
            <View style={s.dateTimeRow}>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={s.dateBtn}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={theme.primary}
                />
                <Text style={s.dateBtnText}>
                  {date.toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={s.dateBtn}
              >
                <Ionicons name="time-outline" size={16} color={theme.primary} />
                <Text style={s.dateBtnText}>
                  {date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={date}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}

            <Text style={s.sectionLabel}>Seats to Offer</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 3"
              placeholderTextColor={theme.textMuted}
              value={seatsTotal}
              onChangeText={setSeatsTotal}
              keyboardType="number-pad"
            />

            <Text style={s.sectionLabel}>Notes (Optional)</Text>
            <TextInput
              style={[s.input, s.notesInput]}
              placeholder="No smoking, max 1 bag..."
              placeholderTextColor={theme.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <View style={s.femaleOnlyCard}>
              <View style={s.femaleOnlyRow}>
                <View style={s.femaleOnlyIcon}>
                  <Ionicons name="people-outline" size={16} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.femaleOnlyTitle}>Female-only ride</Text>
                  <Text style={s.femaleOnlySubtitle}>
                    Only female passengers can see and book this ride.
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    if (!canCreateFemaleOnly && !femaleOnly) {
                      setMessage("Only female drivers can create female-only rides.");
                      return;
                    }
                    setFemaleOnly((prev) => !prev);
                  }}
                  style={[
                    s.toggleTrack,
                    femaleOnly && s.toggleTrackActive,
                    !canCreateFemaleOnly && s.toggleTrackDisabled,
                  ]}
                >
                  <View
                    style={[
                      s.toggleThumb,
                      femaleOnly && s.toggleThumbActive,
                    ]}
                  />
                </Pressable>
              </View>
              {!canCreateFemaleOnly && (
                <Text style={s.femaleOnlyHint}>
                  This option is available only for female drivers.
                </Text>
              )}
            </View>


            {message ? (
              <View
                style={[
                  s.msgBox,
                  {
                    backgroundColor: message.startsWith("✅")
                      ? theme.successBg
                      : theme.dangerBg,
                  },
                ]}
              >
                <Ionicons
                  name={
                    message.startsWith("✅")
                      ? "checkmark-circle"
                      : "alert-circle"
                  }
                  size={16}
                  color={
                    message.startsWith("✅") ? theme.success : theme.danger
                  }
                />
                <Text
                  style={[
                    s.msgText,
                    {
                      color: message.startsWith("✅")
                        ? theme.success
                        : theme.danger,
                    },
                  ]}
                >
                  {message}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={loading || !vehicle || driverStatus !== "verified"}
              style={[
                s.submitBtn,
                (loading || !vehicle || driverStatus !== "verified") && {
                  opacity: 0.55,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitBtnText}>Publish Trip</Text>
              )}
            </Pressable>

            {driverStatus !== "verified" ? (
              <Pressable
                onPress={() => navigation.navigate("DriverVerification")}
                style={s.ctaLink}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color={theme.amber}
                />
                <Text style={s.ctaLinkText}>
                  Verify identity to enable publishing
                </Text>
              </Pressable>
            ) : !vehicle ? (
              <Pressable
                onPress={() => navigation.navigate("VehicleDetails")}
                style={s.ctaLink}
              >
                <Ionicons name="car-outline" size={14} color={theme.amber} />
                <Text style={s.ctaLinkText}>Setup vehicle profile first</Text>
              </Pressable>
            ) : null}

            {!drawerOpen.current && !routeLoading && !hasRoute && (
              <Pressable style={s.expandHint} onPress={() => snapDrawer(true)}>
                <Ionicons name="chevron-up" size={14} color={theme.textMuted} />
                <Text style={s.expandHintText}>Swipe up to fill details</Text>
              </Pressable>
            )}

            <View style={{ height: insets.bottom + 16 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    topBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: theme.surface + "E6",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: theme.surfaceElevated,
      justifyContent: "center",
      alignItems: "center",
    },
    topBarTitle: { ...typography.h4, color: theme.textPrimary },
    locationCard: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      backgroundColor: theme.surface + "F2",
      borderRadius: radius.xl,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    locationDot: { width: 10, height: 10, borderRadius: 5 },
    locationText: {
      flex: 1,
      ...typography.bodyMedium,
      color: theme.textPrimary,
    },
    locationPlaceholder: { color: theme.textMuted },
    locationDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginLeft: 22,
    },
    myLocBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.primarySubtle,
      justifyContent: "center",
      alignItems: "center",
    },
    drawer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: DRAWER_OPEN + 60,
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius["2xl"],
      borderTopRightRadius: radius["2xl"],
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 20,
    },
    drawerHandle: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    drawerContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    routePill: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      backgroundColor: theme.primarySubtle,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      alignSelf: "flex-start",
      marginBottom: spacing.sm,
    },
    routePillText: { ...typography.captionMedium, color: theme.primary },
    routeSubText: {
      ...typography.caption,
      color: theme.textMuted,
      width: "100%",
      marginTop: 4,
    },
    routeChoices: {
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    routeChoiceRow: {
      gap: spacing.sm,
      paddingRight: spacing.xs,
    },
    routeChoiceCard: {
      width: 180,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      padding: spacing.md,
      gap: 6,
    },
    routeChoiceCardActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primarySubtle,
    },
    routeChoiceTitle: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: "700",
    },
    routeChoiceTitleActive: {
      color: theme.primary,
    },
    routeChoiceMeta: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    routeChoiceHint: {
      ...typography.caption,
      color: theme.textMuted,
    },
    priceTag: {
      backgroundColor: theme.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    priceTagText: { ...typography.label, color: "#fff" },
    sectionLabel: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
      marginTop: spacing.sm,
    },
    dateTimeRow: { flexDirection: "row", gap: spacing.sm },
    dateBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    dateBtnText: {
      ...typography.captionMedium,
      color: theme.textPrimary,
      flex: 1,
    },
    input: {
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: spacing.md,
      ...typography.body,
      color: theme.textPrimary,
    },
    notesInput: { minHeight: 72, textAlignVertical: "top" },
    femaleOnlyCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: spacing.md,
      gap: 10,
    },
    femaleOnlyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    femaleOnlyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySubtle,
    },
    femaleOnlyTitle: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: "700",
    },
    femaleOnlySubtitle: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    femaleOnlyHint: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    toggleTrack: {
      width: 54,
      height: 30,
      borderRadius: 999,
      backgroundColor: theme.border,
      padding: 3,
      justifyContent: "center",
    },
    toggleTrackActive: {
      backgroundColor: theme.primary,
    },
    toggleTrackDisabled: {
      opacity: 0.55,
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#fff",
    },
    toggleThumbActive: {
      alignSelf: "flex-end",
    },
    checkpointRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    checkpointBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
    },
    checkpointBtnActive: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primary,
    },
    checkpointBtnText: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
      fontWeight: "700",
    },
    checkpointBtnTextActive: {
      color: theme.primary,
    },
    checkpointHint: {
      ...typography.caption,
      color: theme.textMuted,
      lineHeight: 18,
      marginTop: spacing.xs,
    },
    landmarkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      alignSelf: "flex-start",
      marginTop: spacing.xs,
    },
    landmarkBtnActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    landmarkBtnText: {
      ...typography.bodyMedium,
      color: theme.primary,
      fontWeight: "700",
    },
    landmarkBtnTextActive: {
      color: "#fff",
    },
    landmarkHint: {
      ...typography.caption,
      color: theme.textMuted,
      lineHeight: 18,
      marginTop: 8,
    },
    manualPointList: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    manualPointCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      backgroundColor: theme.surfaceElevated,
      padding: spacing.md,
    },
    manualPointTitle: {
      ...typography.captionMedium,
      color: theme.textMuted,
    },
    manualPointText: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
    },
    manualRemoveBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.dangerBg,
    },
    msgBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      padding: spacing.md,
      borderRadius: radius.md,
      marginTop: spacing.sm,
    },
    msgText: { ...typography.captionMedium, flex: 1 },
    submitBtn: {
      height: 52,
      borderRadius: radius.lg,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      marginTop: spacing.lg,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    submitBtnText: { ...typography.h4, color: "#fff" },
    ctaLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      justifyContent: "center",
      marginTop: spacing.md,
    },
    ctaLinkText: { ...typography.captionMedium, color: theme.amber },
    expandHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      justifyContent: "center",
      marginTop: spacing.xs,
    },
    expandHintText: { ...typography.caption, color: theme.textMuted },
  });
}
