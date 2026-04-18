import React, {
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  PassengerStackParamList,
  PassengerTabParamList,
} from "../navigation/PassengerNavigator";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { getRidesApi, Ride } from "../api/rideApi";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { Skeleton } from "../../../components/common/Skeleton";
import * as Location from "expo-location";
import { reverseGeocodeApi, PlaceSuggestion } from "../../driver/api/placeApi";
import {
  getEligibleDrivers,
  getPassengerPasses,
  EligiblePassOffer,
} from "../../shared/api/passApi";
import { PassEligibilityBanner } from "../../shared/components/PassEligibilityBanner";
import { useNotifications } from "../../../app/providers/NotificationProvider";

const RIDES_POLL_INTERVAL_MS = 30000;

type RideWithDistance = Ride & {
  localDistanceKm?: number | null;
};

type TripMode = "intra" | "inter";

function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
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

export function PassengerHomeScreen() {
  const { theme } = useTheme();
  const { user } = useContext(AuthContext);
  const route = useRoute<RouteProp<PassengerTabParamList, "PassengerHome">>();
  const navigation =
    useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const { unreadCount } = useNotifications();

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState<TripMode | "all">("all");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [pickup, setPickup] = useState<PlaceSuggestion | null>(null);
  const [dropoff, setDropoff] = useState<PlaceSuggestion | null>(null);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [eligibleDrivers, setEligibleDrivers] = useState<EligiblePassOffer[]>([]);

  const firstName = (user?.user_metadata?.full_name ?? "Traveller").split(
    " ",
  )[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  // Navigation Params Effect
  useEffect(() => {
    const selectedPlace = route.params?.selectedPlace;
    const selectedField = route.params?.selectedField;

    if (!selectedPlace || !selectedField) return;

    if (selectedField === "pickup") {
      setPickup(selectedPlace);
    } else {
      setDropoff(selectedPlace);
    }

    navigation.setParams({
      selectedPlace: undefined,
      selectedField: undefined,
    });
  }, [navigation, route.params?.selectedField, route.params?.selectedPlace]);

  // Fetch Logic
  const fetchRides = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) setLoading(true);
        setError("");

        const selectedPickupLat =
          pickup?.lat ?? (userLocation ? userLocation.lat : null);
        const selectedPickupLng =
          pickup?.lng ?? (userLocation ? userLocation.lng : null);
        const selectedDropoffLat = dropoff?.lat ?? null;
        const selectedDropoffLng = dropoff?.lng ?? null;
        const mode = selectedMode === "all" ? null : selectedMode;

        const res = await getRidesApi(
          "",
          selectedPickupLat,
          selectedPickupLng,
          selectedDropoffLat,
          selectedDropoffLng,
          mode,
        );
        setRides(res.rides ?? []);

        try {
          const [passRes, eligibleRes] = await Promise.all([
            getPassengerPasses(),
            getEligibleDrivers(),
          ]);
          const filteredDrivers = eligibleRes.filter((d) => {
            const existing = passRes.find(
              (p) =>
                p.driverId === d.driver.id &&
                p.routeSignature === d.routeSignature &&
                (p.status === "pending" ||
                  p.status === "active"),
            );
            return !existing;
          });
          setEligibleDrivers(filteredDrivers);
        } catch {
          setEligibleDrivers([]);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load rides");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pickup, dropoff, selectedMode, userLocation],
  );

  useFocusEffect(
    useCallback(() => {
      fetchRides(true);
      const interval = setInterval(
        () => fetchRides(false),
        RIDES_POLL_INTERVAL_MS,
      );
      return () => clearInterval(interval);
    }, [fetchRides]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRides(false);
  };

  const onUseCurrentLocation = async () => {
    try {
      setPickupLoading(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Location permission required.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      const currentLocation = {
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      };
      setUserLocation(currentLocation);

      const res = await reverseGeocodeApi(
        currentLocation.lat,
        currentLocation.lng,
      );
      setPickup(
        res.place
          ? res.place
          : {
              id: `${currentLocation.lat}-${currentLocation.lng}`,
              label: "Current location",
              lat: currentLocation.lat,
              lng: currentLocation.lng,
            },
      );
      setError("");
    } catch {
      setError("Could not get your current location.");
    } finally {
      setPickupLoading(false);
    }
  };

  const openLocationSearch = (field: "pickup" | "dropoff") => {
    const selected = field === "pickup" ? pickup : dropoff;
    navigation.navigate("PassengerLocationSearch", {
      field,
      title: field === "pickup" ? "Search pickup" : "Search dropoff",
      focusLat: selected?.lat ?? userLocation?.lat ?? undefined,
      focusLng: selected?.lng ?? userLocation?.lng ?? undefined,
      initialQuery: selected?.label ?? "",
    });
  };

  const processedRides = useMemo<RideWithDistance[]>(() => {
    const origin = userLocation || pickup;
    let next = rides.map((ride) => ({
      ...ride,
      localDistanceKm: origin
        ? haversineDistanceKm(
            origin.lat,
            origin.lng,
            ride.pickup.lat,
            ride.pickup.lng,
          )
        : null,
    }));
    next.sort((a, b) => (b.smartScore ?? 0) - (a.smartScore ?? 0));
    return next;
  }, [rides, userLocation, pickup]);

  const s = makeStyles(theme);

  // --- RENDERERS ---

  const renderRideCard = useCallback(
    ({ item }: { item: RideWithDistance }) => {
      const seatsTotal = item.seatsTotal ?? 0;
      const avgRating =
        typeof item.driver.avgRating === "number"
          ? item.driver.avgRating.toFixed(1)
          : "New";

      return (
        <Pressable
          onPress={() => navigation.navigate("RideDetails", { ride: item })}
          style={({ pressed }) => [
            s.card,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          {/* Top Row: Driver & Price */}
          <View style={s.cardHeader}>
            <View style={s.driverRow}>
              <View style={s.avatarCircle}>
                <Text style={s.avatarText}>
                  {item.driver.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={s.driverName}>{item.driver.name}</Text>
                <View style={s.ratingRow}>
                  <Ionicons name="star" size={12} color={theme.amber} />
                  <Text style={s.ratingText}>{avgRating}</Text>
                </View>
              </View>
            </View>
            <View style={s.pricePill}>
              <Text style={s.priceText}>Rs {item.price}</Text>
            </View>
          </View>

          {/* Middle Row: Route */}
          <View style={s.routeContainer}>
            <View style={s.routeTimeline}>
              <View style={s.dotGreen} />
              <View style={s.routeLine} />
              <View style={s.dotRed} />
            </View>
            <View style={s.routeAddresses}>
              <Text style={s.routeText} numberOfLines={1}>
                {item.pickup.address}
              </Text>
              <Text style={s.routeText} numberOfLines={1}>
                {item.dropoff.address}
              </Text>
            </View>
          </View>

          {/* Bottom Row: Badges */}
          <View style={s.chipRow}>
            <View style={s.chip}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text style={s.chipText}>
                {new Date(item.departureTime).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
                {" · "}
                {new Date(item.departureTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            <View style={s.chip}>
              <Ionicons
                name="people-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text style={s.chipText}>{seatsTotal} seats</Text>
            </View>

            {item.femaleOnly && (
              <View style={[s.chip, s.femaleOnlyChip]}>
                <Ionicons name="female" size={14} color={theme.success} />
                <Text style={s.femaleOnlyText}>Female</Text>
              </View>
            )}

            {item.localDistanceKm != null && (
              <View style={s.chip}>
                <Ionicons
                  name="navigate-outline"
                  size={14}
                  color={theme.primary}
                />
                <Text style={[s.chipText, { color: theme.primary }]}>
                  {item.localDistanceKm.toFixed(1)} km
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [navigation, s, theme],
  );

  const renderHeader = useMemo(
    () => (
      <View style={s.headerContainer}>
        {/* Greeting Row */}
        <View style={s.greetingRow}>
          <View>
            <Text style={s.greeting}>{greeting},</Text>
            <Text style={s.headerTitle}>{firstName}</Text>
          </View>
          <Pressable
            style={s.iconBg}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={theme.primary}
            />
            {unreadCount > 0 ? <View style={s.badge} /> : null}
          </Pressable>
        </View>

        {/* Mode Selector */}
        <View style={s.modeSelector}>
          {(["all", "intra", "inter"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setSelectedMode(mode)}
              style={[s.modeBtn, selectedMode === mode && s.modeBtnActive]}
            >
              <Text
                style={[
                  s.modeBtnText,
                  selectedMode === mode && s.modeBtnTextActive,
                ]}
              >
                {mode === "all"
                  ? "All Rides"
                  : mode === "intra"
                    ? "Intra-city"
                    : "Intercity"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Unified Search Card */}
        <View style={s.searchCard}>
          <View style={s.searchStack}>
            {/* Vertical Timeline */}
            <View style={s.searchTimeline}>
              <View style={s.dotGreen} />
              <View style={s.searchLine} />
              <View style={s.dotRed} />
            </View>

            {/* Inputs */}
            <View style={s.searchInputWrapper}>
              <Pressable
                onPress={() => openLocationSearch("pickup")}
                style={s.searchInput}
              >
                <Text
                  style={pickup ? s.searchTextActive : s.searchTextMuted}
                  numberOfLines={1}
                >
                  {pickup?.label || "Where from?"}
                </Text>
              </Pressable>
              <View style={s.searchDivider} />
              <Pressable
                onPress={() => openLocationSearch("dropoff")}
                style={s.searchInput}
              >
                <Text
                  style={dropoff ? s.searchTextActive : s.searchTextMuted}
                  numberOfLines={1}
                >
                  {dropoff?.label || "Where to?"}
                </Text>
              </Pressable>
            </View>

            {/* Quick Actions (GPS & Clear) */}
            <View style={s.searchActions}>
              <Pressable onPress={onUseCurrentLocation} style={s.actionBtn}>
                {pickupLoading ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons
                    name="locate"
                    size={18}
                    color={theme.textSecondary}
                  />
                )}
              </Pressable>
              {(pickup || dropoff) && (
                <Pressable
                  onPress={() => {
                    setPickup(null);
                    setDropoff(null);
                  }}
                  style={[s.actionBtn, { marginTop: 8 }]}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {eligibleDrivers.length > 0 ? (
          <PassEligibilityBanner
            eligibleDrivers={eligibleDrivers}
            onPress={() =>
              navigation.navigate("PassengerTabs", {
                screen: "CommuterPasses",
              })
            }
          />
        ) : null}

        {/* Results Header */}
        {!loading && processedRides.length > 0 && (
          <View style={s.resultsHeader}>
            <Text style={s.resultsTitle}>Available Rides</Text>
            <Text style={s.resultsSubtitle}>{processedRides.length} found</Text>
          </View>
        )}
      </View>
    ),
    [
      greeting,
      firstName,
      theme,
      selectedMode,
      pickup,
      dropoff,
      pickupLoading,
      loading,
      processedRides.length,
      s,
    ],
  );

  return (
    <SafeAreaView style={s.safeArea} edges={["top"]}>
      <FlatList
        data={loading ? ([1, 2, 3] as any[]) : processedRides}
        keyExtractor={(item, index) =>
          loading ? `skel-${index}` : String((item as Ride).id)
        }
        renderItem={({ item }) =>
          loading ? (
            <View style={[s.card, { height: 140, justifyContent: "center" }]}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            renderRideCard({ item })
          )
        }
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyState}>
              <Ionicons
                name={error ? "cloud-offline-outline" : "car-sport-outline"}
                size={56}
                color={theme.border}
              />
              <Text style={s.emptyTitle}>
                {error ? "Network Error" : "No rides found"}
              </Text>
              <Text style={s.emptySubtitle}>
                {error ? error : "Adjust your search locations or trip mode."}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },

    // Header & Typography
    headerContainer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    greetingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    greeting: { ...typography.bodyMedium, color: theme.textSecondary },
    headerTitle: { ...typography.h1, color: theme.textPrimary },
    iconBg: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surfaceElevated,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      position: "relative",
    },
    badge: {
      position: "absolute",
      top: 7,
      right: 7,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.danger,
      borderWidth: 1.5,
      borderColor: theme.surfaceElevated,
    },

    // Sleek Mode Selector
    modeSelector: {
      flexDirection: "row",
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      padding: 4,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: radius.md,
    },
    modeBtnActive: { backgroundColor: theme.primary },
    modeBtnText: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    modeBtnTextActive: { color: "#fff", fontWeight: "700" },

    // Consolidated Search Card
    searchCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    searchStack: { flexDirection: "row", alignItems: "stretch" },
    searchTimeline: { width: 30, alignItems: "center", paddingVertical: 12 },
    searchLine: {
      flex: 1,
      width: 2,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    searchInputWrapper: { flex: 1, justifyContent: "space-between" },
    searchInput: { height: 44, justifyContent: "center" },
    searchDivider: { height: 1, backgroundColor: theme.border },
    searchTextActive: { ...typography.bodySemiBold, color: theme.textPrimary },
    searchTextMuted: { ...typography.bodyMedium, color: theme.textMuted },
    searchActions: {
      width: 40,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceElevated,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },

    // Results Header
    resultsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    resultsTitle: { ...typography.h3, color: theme.textPrimary },
    resultsSubtitle: { ...typography.captionMedium, color: theme.primary },

    // Lists
    listContent: { paddingBottom: 100 },

    // Ride Cards
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.md,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    driverRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    avatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.primarySubtle,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { ...typography.h4, color: theme.primary },
    driverName: { ...typography.bodySemiBold, color: theme.textPrimary },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    ratingText: { ...typography.captionMedium, color: theme.textSecondary },
    pricePill: {
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
    },
    priceText: { ...typography.bodySemiBold, color: "#fff" },

    // Route
    routeContainer: {
      flexDirection: "row",
      marginBottom: spacing.md,
      paddingLeft: 4,
    },
    routeTimeline: { alignItems: "center", width: 20, marginRight: spacing.md },
    dotGreen: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.success,
    },
    dotRed: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.danger,
    },
    routeLine: {
      width: 2,
      height: 20,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    routeAddresses: { flex: 1, justifyContent: "space-between" },
    routeText: { ...typography.bodyMedium, color: theme.textPrimary },

    // Badges
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipText: { ...typography.captionMedium, color: theme.textSecondary },
    femaleOnlyChip: { backgroundColor: "#ecfdf5", borderColor: "#bbf7d0" },
    femaleOnlyText: {
      ...typography.captionMedium,
      color: "#15803d",
      fontWeight: "600",
    },

    // Empty State
    emptyState: {
      alignItems: "center",
      marginTop: spacing["4xl"],
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      ...typography.h3,
      color: theme.textSecondary,
      marginTop: spacing.md,
    },
    emptySubtitle: {
      ...typography.body,
      color: theme.textMuted,
      marginTop: spacing.sm,
      textAlign: "center",
    },
  });
}
