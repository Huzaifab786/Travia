import React, { useEffect, useRef, useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { createRideApi } from "../api/driverRideApi";
import { reverseGeocodeApi, PlaceSuggestion } from "../api/placeApi";
import { previewRouteApi, RoutePoint } from "../../map/api/routeApi";
import { getDriverStatusApi, DriverStatus } from "../api/driverApi";
import { DriverStackParamList } from "../navigation/DriverNavigator";
import { getMyVehicleApi, Vehicle } from "../api/vehicleApi";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { hp, screen, wp } from "../../../lib/utils/responsive";

type Coords = { lat: number; lng: number };
type CreateRideNavProp = NativeStackNavigationProp<DriverStackParamList, "CreateRide">;

// Drawer snap points
const DRAWER_PEEK   = hp(260);   // collapsed: just handle + summary visible
const DRAWER_OPEN   = hp(560);   // expanded: full form visible

export function CreateRideScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CreateRideNavProp>();
  const mapRef = useRef<MapView | null>(null);

  // — Location state
  const [pickupAddress, setPickupAddress]   = useState("");
  const [pickupCoords, setPickupCoords]     = useState<Coords | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCoords, setDropoffCoords]   = useState<Coords | null>(null);

  // — Form state
  const [date, setDate]                   = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [seatsTotal, setSeatsTotal]         = useState("");
  const [notes, setNotes]                   = useState("");

  // — Loading / status
  const [loading, setLoading]         = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [message, setMessage]         = useState("");
  const [vehicle, setVehicle]         = useState<Vehicle | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("unverified");

  // — Map / route
  const [mapRegion, setMapRegion] = useState({
    latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.12, longitudeDelta: 0.12,
  });
  const [routeCoords, setRouteCoords]     = useState<RoutePoint[]>([]);
  const [routeLoading, setRouteLoading]   = useState(false);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [pricePerSeat, setPricePerSeat]   = useState(0);

  // — Drawer animation
  const drawerY = useRef(new Animated.Value(screen.height - DRAWER_PEEK)).current;
  const drawerOpen = useRef(false);

  const snapDrawer = (open: boolean) => {
    drawerOpen.current = open;
    Animated.spring(drawerY, {
      toValue: open
        ? screen.height - DRAWER_OPEN
        : screen.height - DRAWER_PEEK,
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
        // Snap: if dragged up more than 60px → open, else → close
        if (g.dy < -60) snapDrawer(true);
        else if (g.dy > 60) snapDrawer(false);
        else snapDrawer(drawerOpen.current);
      },
    })
  ).current;

  // — Map helpers
  const centerMap = (lat: number, lng: number) => {
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 500
    );
  };

  const fitToPoints = () => {
    if (!pickupCoords && !dropoffCoords) return;
    const points = [pickupCoords, dropoffCoords]
      .filter(Boolean)
      .map((p) => ({ latitude: (p as Coords).lat, longitude: (p as Coords).lng }));
    if (points.length === 1) { centerMap(points[0].latitude, points[0].longitude); return; }
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 140, right: 60, bottom: DRAWER_PEEK + 60, left: 60 },
      animated: true,
    });
  };

  // — Boot: get location + vehicle + driver status
  useEffect(() => {
    const boot = async () => {
      try {
        const [perm, vehicleRes, statusRes] = await Promise.all([
          Location.requestForegroundPermissionsAsync(),
          getMyVehicleApi(),
          getDriverStatusApi(),
        ]);
        setDriverStatus(statusRes.status);
        setVehicle(vehicleRes.vehicle);
        if (statusRes.status !== "verified") {
          setMessage("⚠️ Identity verification required to publish rides.");
        } else if (!vehicleRes.vehicle) {
          setMessage("⚠️ Please setup your vehicle profile to calculate costs.");
        }
        if (perm.status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          const { latitude, longitude } = loc.coords;
          setMapRegion({ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
          mapRef.current?.animateToRegion(
            { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 500
          );
        }
      } catch {
        setMessage("Could not access location. Search places manually.");
      } finally {
        setBootLoading(false);
      }
    };
    boot();
  }, []);

  useEffect(() => { fitToPoints(); }, [pickupCoords, dropoffCoords]);

  // — Route preview
  useEffect(() => {
    const load = async () => {
      if (!pickupCoords || !dropoffCoords) {
        setRouteCoords([]); setDistanceMeters(0); setDurationSeconds(0); setPricePerSeat(0);
        return;
      }
      try {
        setRouteLoading(true);
        const res = await previewRouteApi(pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng);
        setRouteCoords(res.coordinates);
        setDistanceMeters(res.distanceMeters);
        setDurationSeconds(res.durationSeconds);
      } catch { setRouteCoords([]); setDistanceMeters(0); setDurationSeconds(0); }
      finally { setRouteLoading(false); }
    };
    load();
  }, [pickupCoords, dropoffCoords]);

  // — Auto-calculate price
  useEffect(() => {
    if (distanceMeters > 0 && vehicle && seatsTotal) {
      const km = distanceMeters / 1000;
      const fuel = (km / vehicle.avgKmPerLitre) * vehicle.fuelPricePerLitre;
      setPricePerSeat(Math.max(20, Math.round(fuel / (Number(seatsTotal) + 1))));
    } else {
      setPricePerSeat(0);
    }
  }, [distanceMeters, vehicle, seatsTotal]);

  const onSelectPlace = (field: "pickup" | "dropoff", place: PlaceSuggestion) => {
    if (field === "pickup") { setPickupAddress(place.label); setPickupCoords({ lat: place.lat, lng: place.lng }); }
    else { setDropoffAddress(place.label); setDropoffCoords({ lat: place.lat, lng: place.lng }); }
    centerMap(place.lat, place.lng);
  };

  const navigateToSearch = (field: "pickup" | "dropoff") => {
    navigation.navigate("LocationSearch", {
      title: `Search ${field === "pickup" ? "Pickup" : "Dropoff"}`,
      onSelect: (place) => onSelectPlace(field, place),
      focusLat: field === "dropoff" ? pickupCoords?.lat : undefined,
      focusLng: field === "dropoff" ? pickupCoords?.lng : undefined,
    });
  };

  const useMyLocation = async () => {
    setMessage("");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") { setMessage("Location permission required."); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      const res = await reverseGeocodeApi(latitude, longitude);
      const label = res.place?.label;
      if (!label) { setMessage("Could not determine your address."); return; }
      setPickupCoords({ lat: latitude, lng: longitude });
      setPickupAddress(label);
      centerMap(latitude, longitude);
    } catch { setMessage("Could not fetch your location."); }
  };

  const onDateChange = (_: DateTimePickerEvent, d?: Date) => {
    setShowDatePicker(false);
    if (d) { const n = new Date(date); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setDate(n); }
  };
  const onTimeChange = (_: DateTimePickerEvent, d?: Date) => {
    setShowTimePicker(false);
    if (d) { const n = new Date(date); n.setHours(d.getHours(), d.getMinutes()); setDate(n); }
  };

  const onSubmit = async () => {
    setMessage("");
    if (!pickupAddress || !pickupCoords || !dropoffAddress || !dropoffCoords || !seatsTotal) {
      setMessage("Please fill all required fields."); return;
    }
    const seats = Number(seatsTotal);
    if (isNaN(seats) || seats < 1) { setMessage("Enter a valid seat count (min 1)."); return; }
    if (!vehicle) { setMessage("Complete your vehicle profile first."); return; }
    // ✅ Verification gate — re-enabled
    if (driverStatus !== "verified") {
      setMessage("⚠️ You must be verified to publish rides."); return;
    }
    setLoading(true);
    try {
      await createRideApi({
        pickup: { address: pickupAddress, lat: pickupCoords.lat, lng: pickupCoords.lng },
        dropoff: { address: dropoffAddress, lat: dropoffCoords.lat, lng: dropoffCoords.lng },
        departureTime: date.toISOString(),
        seatsTotal: seats,
        notes: notes.trim(),
      });
      setMessage("✅ Ride created successfully!");
      setTimeout(() => navigation.goBack(), 1200);
    } catch (e: any) { setMessage(e.message || "Failed to create ride."); }
    finally { setLoading(false); }
  };

  const s = makeStyles(theme, insets);

  if (bootLoading) {
    return (
      <View style={s.loaderWrap}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={s.loaderText}>Preparing your ride...</Text>
      </View>
    );
  }

  const hasRoute = distanceMeters > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ─── Full-screen map ─────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
        showsUserLocation
        userInterfaceStyle={theme.dark ? "dark" : "light"}
      >
        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            title="Pickup"
            pinColor={theme.primary}
          />
        )}
        {dropoffCoords && (
          <Marker
            coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }}
            title="Dropoff"
            pinColor={theme.danger}
          />
        )}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={theme.primary}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* ─── Floating top bar ───────────────────────────── */}
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.topBarTitle}>Create New Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Floating location card ─────────────────────── */}
      <View style={[s.locationCard, { top: insets.top + 62 }]}>
        {/* Pickup row */}
        <Pressable style={s.locationRow} onPress={() => navigateToSearch("pickup")}>
          <View style={[s.locationDot, { backgroundColor: theme.primary }]} />
          <Text style={[s.locationText, !pickupAddress && s.locationPlaceholder]} numberOfLines={1}>
            {pickupAddress || "Pickup location"}
          </Text>
          {!pickupAddress && (
            <Pressable onPress={useMyLocation} style={s.myLocBtn}>
              <Ionicons name="locate-outline" size={16} color={theme.primary} />
            </Pressable>
          )}
        </Pressable>

        <View style={s.locationDivider} />

        {/* Dropoff row */}
        <Pressable style={s.locationRow} onPress={() => navigateToSearch("dropoff")}>
          <View style={[s.locationDot, { backgroundColor: theme.danger }]} />
          <Text style={[s.locationText, !dropoffAddress && s.locationPlaceholder]} numberOfLines={1}>
            {dropoffAddress || "Destination"}
          </Text>
        </Pressable>
      </View>

      {/* ─── Bottom drawer ──────────────────────────────── */}
      <Animated.View style={[s.drawer, { top: drawerY }]}>
        {/* Drag handle */}
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

            {/* Route summary pill */}
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
                {pricePerSeat > 0 && (
                  <View style={s.priceTag}>
                    <Text style={s.priceTagText}>Rs {pricePerSeat}/seat</Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Date + Time row */}
            <Text style={s.sectionLabel}>Departure Schedule</Text>
            <View style={s.dateTimeRow}>
              <Pressable onPress={() => setShowDatePicker(true)} style={s.dateBtn}>
                <Ionicons name="calendar-outline" size={16} color={theme.primary} />
                <Text style={s.dateBtnText}>
                  {date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowTimePicker(true)} style={s.dateBtn}>
                <Ionicons name="time-outline" size={16} color={theme.primary} />
                <Text style={s.dateBtnText}>
                  {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={date} mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={onDateChange} minimumDate={new Date()}
              />
            )}
            {showTimePicker && (
              <DateTimePicker value={date} mode="time" display="default" onChange={onTimeChange} />
            )}

            {/* Seats */}
            <Text style={s.sectionLabel}>Seats to Offer</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 3"
              placeholderTextColor={theme.textMuted}
              value={seatsTotal}
              onChangeText={setSeatsTotal}
              keyboardType="number-pad"
            />

            {/* Notes */}
            <Text style={s.sectionLabel}>Notes (Optional)</Text>
            <TextInput
              style={[s.input, s.notesInput]}
              placeholder="No smoking, max 1 bag..."
              placeholderTextColor={theme.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {/* Message banner */}
            {message ? (
              <View style={[s.msgBox, {
                backgroundColor: message.startsWith("✅") ? theme.successBg : theme.dangerBg
              }]}>
                <Ionicons
                  name={message.startsWith("✅") ? "checkmark-circle" : "alert-circle"}
                  size={16}
                  color={message.startsWith("✅") ? theme.success : theme.danger}
                />
                <Text style={[s.msgText, {
                  color: message.startsWith("✅") ? theme.success : theme.danger
                }]}>{message}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <Pressable
              onPress={onSubmit}
              disabled={loading || !vehicle || driverStatus !== "verified"}
              style={[s.submitBtn, (loading || !vehicle || driverStatus !== "verified") && { opacity: 0.55 }]}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitBtnText}>Publish Trip</Text>
              }
            </Pressable>

            {/* CTA if not verified / no vehicle */}
            {driverStatus !== "verified" ? (
              <Pressable onPress={() => navigation.navigate("DriverVerification")} style={s.ctaLink}>
                <Ionicons name="shield-checkmark-outline" size={14} color={theme.amber} />
                <Text style={s.ctaLinkText}>Verify identity to enable publishing</Text>
              </Pressable>
            ) : !vehicle ? (
              <Pressable onPress={() => navigation.navigate("VehicleDetails")} style={s.ctaLink}>
                <Ionicons name="car-outline" size={14} color={theme.amber} />
                <Text style={s.ctaLinkText}>Setup vehicle profile first</Text>
              </Pressable>
            ) : null}

            {/* Tap-to-expand hint */}
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

function makeStyles(theme: any, insets: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background, gap: 12 },
    loaderText: { ...typography.body, color: theme.textMuted },

    // ── Floating top bar
    topBar: {
      position: "absolute", top: 0, left: 0, right: 0,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: theme.surface + "E6", // 90% opacity
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: radius.md,
      backgroundColor: theme.surfaceElevated,
      justifyContent: "center", alignItems: "center",
    },
    topBarTitle: { ...typography.h4, color: theme.textPrimary },

    // ── Floating location card
    locationCard: {
      position: "absolute", left: spacing.lg, right: spacing.lg,
      backgroundColor: theme.surface + "F2", // 95% opacity
      borderRadius: radius.xl,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      borderWidth: 1, borderColor: theme.border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    },
    locationRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: spacing.md, gap: spacing.md,
    },
    locationDot: { width: 10, height: 10, borderRadius: 5 },
    locationText: { flex: 1, ...typography.bodyMedium, color: theme.textPrimary },
    locationPlaceholder: { color: theme.textMuted },
    locationDivider: { height: 1, backgroundColor: theme.border, marginLeft: 22 },
    myLocBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: theme.primarySubtle,
      justifyContent: "center", alignItems: "center",
    },

    // ── Bottom drawer
    drawer: {
      position: "absolute", left: 0, right: 0, bottom: 0,
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
      alignItems: "center", paddingVertical: spacing.md,
    },
    handleBar: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.border,
    },
    drawerContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },

    // Route pill
    routePill: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: theme.primarySubtle,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, alignSelf: "flex-start",
      marginBottom: spacing.sm,
    },
    routePillText: { ...typography.captionMedium, color: theme.primary },
    priceTag: {
      backgroundColor: theme.primary,
      paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: radius.full,
    },
    priceTagText: { ...typography.label, color: "#fff" },

    // Form
    sectionLabel: { ...typography.bodySemiBold, color: theme.textPrimary, marginTop: spacing.sm },
    dateTimeRow: { flexDirection: "row", gap: spacing.sm },
    dateBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1, borderColor: theme.border,
      borderRadius: radius.md, padding: spacing.md,
    },
    dateBtnText: { ...typography.captionMedium, color: theme.textPrimary, flex: 1 },
    input: {
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1, borderColor: theme.border,
      borderRadius: radius.md, padding: spacing.md,
      ...typography.body, color: theme.textPrimary,
    },
    notesInput: { minHeight: 72, textAlignVertical: "top" },

    // Message
    msgBox: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      padding: spacing.md, borderRadius: radius.md,
      marginTop: spacing.sm,
    },
    msgText: { ...typography.captionMedium, flex: 1 },

    // Submit
    submitBtn: {
      height: 52, borderRadius: radius.lg,
      backgroundColor: theme.primary,
      justifyContent: "center", alignItems: "center",
      marginTop: spacing.lg,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    },
    submitBtnText: { ...typography.h4, color: "#fff" },

    // CTA link
    ctaLink: {
      flexDirection: "row", alignItems: "center", gap: 6,
      justifyContent: "center", marginTop: spacing.md,
    },
    ctaLinkText: { ...typography.captionMedium, color: theme.amber },

    // Expand hint
    expandHint: {
      flexDirection: "row", alignItems: "center", gap: 4,
      justifyContent: "center", marginTop: spacing.xs,
    },
    expandHintText: { ...typography.caption, color: theme.textMuted },
  });
}