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
import { useNavigation, useFocusEffect, useRoute, RouteProp } from "@react-navigation/native";
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

const RIDES_POLL_INTERVAL_MS = 8000;

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
  const route =
    useRoute<RouteProp<PassengerTabParamList, "PassengerHome">>();
  const navigation =
    useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();

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

  const firstName = (user?.user_metadata?.full_name ?? "Traveller").split(
    " ",
  )[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    const selectedPlace = route.params?.selectedPlace;
    const selectedField = route.params?.selectedField;

    if (!selectedPlace || !selectedField) {
      return;
    }

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

  const fetchRides = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError("");

        const selectedPickupLat = pickup?.lat ?? (userLocation ? userLocation.lat : null);
        const selectedPickupLng = pickup?.lng ?? (userLocation ? userLocation.lng : null);
        const selectedDropoffLat = dropoff?.lat ?? null;
        const selectedDropoffLng = dropoff?.lng ?? null;

        const mode =
          selectedMode === "all"
            ? null
            : selectedMode === "intra"
              ? "intra"
              : "inter";

        const res = await getRidesApi(
          "",
          selectedPickupLat,
          selectedPickupLng,
          selectedDropoffLat,
          selectedDropoffLng,
          mode,
        );
        const nextRides = res.rides ?? [];
        setRides(nextRides);
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

      const interval = setInterval(() => {
        fetchRides(false);
      }, RIDES_POLL_INTERVAL_MS);

      return () => clearInterval(interval);
    }, [fetchRides]),
  );

  useEffect(() => {
    fetchRides(true);
  }, [fetchRides]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRides(false);
  };

  const onUseCurrentLocation = async () => {
    try {
      setPickupLoading(true);

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setError("Location permission is required to use current location.");
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

      if (res.place) {
        setPickup(res.place);
      } else {
        setPickup({
          id: `${currentLocation.lat}-${currentLocation.lng}`,
          label: "Current location",
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        });
      }

      setError("");
    } catch {
      setError("Could not get your current location.");
    } finally {
      setPickupLoading(false);
    }
  };

  const openLocationSearch = (field: "pickup" | "dropoff") => {
    const selected = field === "pickup" ? pickup : dropoff;
    const focusLat = selected?.lat ?? userLocation?.lat ?? null;
    const focusLng = selected?.lng ?? userLocation?.lng ?? null;

    navigation.navigate("PassengerLocationSearch", {
      field,
      title: field === "pickup" ? "Search pickup" : "Search dropoff",
      focusLat: focusLat ?? undefined,
      focusLng: focusLng ?? undefined,
      initialQuery: selected?.label ?? "",
    });
  };

  const openMapPicker = (field: "pickup" | "dropoff") => {
    const selected = field === "pickup" ? pickup : dropoff;
    const initialLocation = selected
      ? { lat: selected.lat, lng: selected.lng }
      : userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng }
        : undefined;

    navigation.navigate("PassengerMapPicker", {
      field,
      initialLocation,
    });
  };

  const processedRides = useMemo<RideWithDistance[]>(() => {
    const origin = userLocation || pickup;

    let next = rides.map((ride) => {
      let localDistanceKm: number | null = null;

      if (origin) {
        localDistanceKm = haversineDistanceKm(
          origin.lat,
          origin.lng,
          ride.pickup.lat,
          ride.pickup.lng,
        );
      }

      return {
        ...ride,
        localDistanceKm,
      };
    });

    next.sort((a, b) => (b.smartScore ?? 0) - (a.smartScore ?? 0));

    return next;
  }, [rides, userLocation, pickup, dropoff, selectedMode]);

  const s = makeStyles(theme);

  const renderRideCard = ({ item }: { item: RideWithDistance }) => {
    const seatsTotal = item.seatsTotal ?? 0;
    const avgRating =
      typeof item.driver.avgRating === "number"
        ? item.driver.avgRating.toFixed(1)
        : null;
    const totalReviews = item.driver.totalReviews ?? 0;
    const matchLabel = item.matchLabel ?? "Fair Match";
    const smartScore = item.smartScore ?? 0;

    return (
      <Pressable
        onPress={() => navigation.navigate("RideDetails", { ride: item })}
        style={({ pressed }) => [
          s.card,
          pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
        ]}
      >
        <View style={s.cardHeader}>
          <View style={s.driverRow}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>
                {item.driver.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={s.driverMeta}>
              <Text style={s.driverName}>{item.driver.name}</Text>

              <View style={s.ratingRow}>
                <Ionicons name="star" size={12} color={theme.amber} />
                <Text style={s.ratingText}>
                  {avgRating ? avgRating : "New"}
                </Text>
                <Text style={s.reviewCountText}>
                  {totalReviews > 0
                    ? `(${totalReviews} review${totalReviews === 1 ? "" : "s"})`
                    : "(No reviews yet)"}
                </Text>
              </View>
            </View>
          </View>

          <View style={s.pricePill}>
            <Text style={s.priceText}>Rs {item.price}/seat</Text>
          </View>
        </View>

        <View style={s.routeTypeRow}>
          <View style={s.routeTypeBadge}>
            <Ionicons name="map-outline" size={12} color={theme.primary} />
            <Text style={s.routeTypeText}>Shared route ride</Text>
          </View>
          {item.femaleOnly && (
            <View style={s.femaleOnlyBadge}>
              <Ionicons name="female" size={12} color={theme.success} />
              <Text style={s.femaleOnlyText}>Female only</Text>
            </View>
          )}
          {item.routeProximityKm != null && (
            <Text style={s.routeTypeHint}>
              {item.routeProximityKm.toFixed(1)} km to route
            </Text>
          )}
        </View>

        <View style={s.matchRow}>
          <View
            style={[
              s.matchBadge,
              matchLabel === "Best Match"
                ? s.bestMatchBadge
                : matchLabel === "Good Match"
                  ? s.goodMatchBadge
                  : s.fairMatchBadge,
            ]}
          >
            <Ionicons
              name="sparkles-outline"
              size={12}
              color={
                matchLabel === "Best Match"
                  ? "#166534"
                  : matchLabel === "Good Match"
                    ? "#1d4ed8"
                    : theme.textSecondary
              }
            />
            <Text
              style={[
                s.matchBadgeText,
                matchLabel === "Best Match"
                  ? s.bestMatchText
                  : matchLabel === "Good Match"
                    ? s.goodMatchText
                    : s.fairMatchText,
              ]}
            >
              {matchLabel}
            </Text>
          </View>

          <Text style={s.matchScoreText}>Score {smartScore}</Text>
        </View>

        <View style={s.routeContainer}>
          <View style={s.routeTimeline}>
            <View style={s.dotGreen} />
            <View style={s.routeLine} />
            <View style={s.dotRed} />
          </View>

          <View style={s.routeAddresses}>
            <Text style={s.routeFrom} numberOfLines={1}>
              {item.pickup.address}
            </Text>
            <Text style={s.routeTo} numberOfLines={1}>
              {item.dropoff.address}
            </Text>
          </View>
        </View>

        <View style={s.chipRow}>
          <View style={s.chip}>
            <Ionicons
              name="calendar-outline"
              size={12}
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
              size={12}
              color={theme.textSecondary}
            />
            <Text style={s.chipText}>{seatsTotal} seats</Text>
          </View>

          {item.localDistanceKm != null && (
            <View style={s.chip}>
              <Ionicons
                name="pin-outline"
                size={12}
                color={theme.textSecondary}
              />
              <Text style={s.chipText}>
                {item.localDistanceKm.toFixed(1)} km away
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderSkeleton = () => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.driverRow}>
          <Skeleton variant="circle" width={40} height={40} />
          <View style={{ gap: 4 }}>
            <Skeleton width={100} height={16} variant="rounded" />
            <Skeleton width={90} height={12} variant="rounded" />
          </View>
        </View>
        <Skeleton width={60} height={24} variant="rounded" />
      </View>
      <View style={{ gap: 12, marginBottom: 16 }}>
        <Skeleton width="90%" height={16} variant="rounded" />
        <Skeleton width="70%" height={16} variant="rounded" />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Skeleton width={80} height={20} variant="rounded" />
        <Skeleton width={60} height={20} variant="rounded" />
      </View>
    </View>
  );

  const modeButton = (
    value: TripMode | "all",
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
  ) => (
    <Pressable
      key={value}
      onPress={() => setSelectedMode(value)}
      style={[
        s.modeChip,
        selectedMode === value && s.modeChipActive,
      ]}
    >
      <Ionicons
        name={icon}
        size={14}
        color={selectedMode === value ? "#fff" : theme.textSecondary}
      />
      <Text
        style={[
          s.modeChipText,
          selectedMode === value && s.modeChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const topSection = (
    <>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>
            {greeting}, {firstName} ðŸ‘‹
          </Text>
          <Text style={s.headerTitle}>Find your ride</Text>
        </View>

        <View style={s.headerIconBg}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={theme.primary}
          />
        </View>
      </View>

      <View style={s.tripPlannerCard}>
        <View style={s.tripPlannerHeader}>
          <View>
            <Text style={s.tripPlannerTitle}>Plan your trip</Text>
            <Text style={s.tripPlannerSubtitle}>
              Pick source and destination to find the best route overlap.
            </Text>
          </View>
          <Ionicons name="map-outline" size={18} color={theme.primary} />
        </View>

        <View style={s.modeRow}>
          {modeButton("all", "All Rides", "layers-outline")}
          {modeButton("intra", "Intra City", "location-outline")}
          {modeButton("inter", "Intercity", "airplane-outline")}
        </View>

        <View style={s.placeFieldGroup}>
          <Text style={s.placeFieldLabel}>Pickup</Text>
          <View style={s.placeField}>
            <Pressable
              onPress={() => openLocationSearch("pickup")}
              style={s.placeFieldMain}
            >
              <Ionicons
                name="navigate-circle-outline"
                size={18}
                color={theme.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.placeFieldValue} numberOfLines={1}>
                  {pickup?.label || "Search pickup location"}
                </Text>
                <Text style={s.placeFieldHint}>
                  {pickup ? "Change pickup" : "Where should the trip start?"}
                </Text>
              </View>
            </Pressable>
            <View style={s.placeFieldActions}>
              <Pressable onPress={onUseCurrentLocation} style={s.placeQuickBtn}>
                {pickupLoading ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons
                    name="locate-outline"
                    size={16}
                    color={theme.primary}
                  />
                )}
              </Pressable>
              <Pressable
                onPress={() => openMapPicker("pickup")}
                style={s.placeQuickBtn}
              >
                <Ionicons name="map-outline" size={16} color={theme.primary} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={s.placeFieldGroup}>
          <Text style={s.placeFieldLabel}>Dropoff</Text>
          <View style={s.placeField}>
            <Pressable
              onPress={() => openLocationSearch("dropoff")}
              style={s.placeFieldMain}
            >
              <Ionicons name="flag-outline" size={18} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.placeFieldValue} numberOfLines={1}>
                  {dropoff?.label || "Search dropoff location"}
                </Text>
                <Text style={s.placeFieldHint}>
                  {dropoff ? "Change dropoff" : "Where should the trip end?"}
                </Text>
              </View>
            </Pressable>
            <View style={s.placeFieldActions}>
              <Pressable
                onPress={() => openMapPicker("dropoff")}
                style={s.placeQuickBtn}
              >
                <Ionicons name="map-outline" size={16} color={theme.primary} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={s.tripSummaryRow}>
          <View style={s.tripSummaryChip}>
            <Ionicons
              name="swap-horizontal-outline"
              size={14}
              color={theme.primary}
            />
            <Text style={s.tripSummaryText}>
              {pickup && dropoff
                ? `${haversineDistanceKm(
                    pickup.lat,
                    pickup.lng,
                    dropoff.lat,
                    dropoff.lng,
                  ).toFixed(1)} km trip`
                : "Select both locations"}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setPickup(null);
              setDropoff(null);
            }}
            style={s.clearTripBtn}
          >
            <Text style={s.clearTripText}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.statsStrip}>
        <View style={s.statItem}>
          <Text style={s.statNum}>{processedRides.length}</Text>
          <Text style={s.statLabel}>Available</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statNum}>
            {processedRides.filter((r) => r.seatsTotal > 0).length}
          </Text>
          <Text style={s.statLabel}>With Seats</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statNum}>
            {processedRides.length > 0
              ? Math.min(...processedRides.map((r) => r.price))
              : 0}
          </Text>
          <Text style={s.statLabel}>Min Price</Text>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={s.safeArea}>
      {loading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(_, index) => `skeleton-${index}`}
          renderItem={() => renderSkeleton()}
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          ListHeaderComponent={topSection}
        />
      ) : (
        <FlatList
          data={processedRides}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRideCard}
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          ListHeaderComponent={topSection}
          ListEmptyComponent={
            error ? (
              <View style={s.center}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={48}
                  color={theme.textMuted}
                />
                <Text style={s.errorText}>{error}</Text>
                <Pressable onPress={() => fetchRides(true)} style={s.retryBtn}>
                  <Text style={s.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.center}>
                <Ionicons
                  name="car-sport-outline"
                  size={56}
                  color={theme.textMuted}
                />
                <Text style={s.emptyTitle}>No rides found</Text>
                <Text style={s.emptySubtitle}>
                  {pickup || dropoff || selectedMode !== "all"
                    ? "Try adjusting your locations or trip mode"
                    : "Pull to refresh or check back later"}
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing["2xl"],
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    greeting: {
      ...typography.caption,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    headerTitle: { ...typography.h2, color: theme.textPrimary },
    headerIconBg: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      backgroundColor: theme.primarySubtle,
      justifyContent: "center",
      alignItems: "center",
    },

    tripPlannerCard: {
      backgroundColor: theme.surfaceElevated,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      borderRadius: radius.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.primary + "22",
      gap: spacing.sm,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    tripPlannerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    tripPlannerTitle: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    tripPlannerSubtitle: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    modeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    modeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    modeChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    modeChipText: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      fontWeight: "700",
    },
    modeChipTextActive: {
      color: "#fff",
    },
    placeFieldGroup: {
      gap: 6,
    },
    placeFieldLabel: {
      ...typography.captionMedium,
      color: theme.textMuted,
      textTransform: "uppercase",
    },
    placeField: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      gap: 8,
    },
    placeFieldMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 36,
    },
    placeFieldActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    placeFieldValue: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: "700",
    },
    placeFieldHint: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    placeQuickBtn: {
      width: 30,
      height: 30,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySubtle,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tripSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    tripSummaryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.primarySubtle,
      borderWidth: 1,
      borderColor: theme.primary + "22",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: radius.full,
      flex: 1,
    },
    tripSummaryText: {
      ...typography.captionMedium,
      color: theme.primary,
      fontWeight: "700",
      flex: 1,
    },
    clearTripBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.full,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    clearTripText: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      fontWeight: "700",
    },

    statsStrip: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      marginHorizontal: spacing.xl,
      borderRadius: radius.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    statItem: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    statNum: {
      ...typography.bodySemiBold,
      color: theme.primary,
    },
    statLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 1,
    },
    statDivider: {
      width: 1,
      backgroundColor: theme.border,
      marginVertical: spacing.xs,
    },

    list: {
      paddingHorizontal: spacing.xl,
      paddingBottom: 90,
      flexGrow: 1,
      paddingTop: spacing.xs,
    },

    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    driverRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    driverMeta: { flex: 1, marginRight: spacing.sm },
    avatarCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      marginTop: 3,
      flexWrap: "wrap",
    },
    ratingText: {
      ...typography.caption,
      color: theme.amber,
      fontWeight: "700",
    },
    reviewCountText: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    pricePill: {
      backgroundColor: theme.primarySubtle,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
    },
    priceText: { ...typography.bodySemiBold, color: theme.primary },
    routeTypeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    routeTypeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
    },
    routeTypeText: { ...typography.captionMedium, color: theme.primary, fontWeight: "700" },
    femaleOnlyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#ecfdf5",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: "#bbf7d0",
    },
    femaleOnlyText: {
      ...typography.captionMedium,
      color: "#15803d",
      fontWeight: "700",
    },
    routeTypeHint: { ...typography.caption, color: theme.textMuted },

    matchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    matchBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
    },
    bestMatchBadge: {
      backgroundColor: "#dcfce7",
    },
    goodMatchBadge: {
      backgroundColor: "#dbeafe",
    },
    fairMatchBadge: {
      backgroundColor: theme.surfaceElevated,
    },
    matchBadgeText: {
      ...typography.captionMedium,
      fontWeight: "700",
    },
    bestMatchText: {
      color: "#166534",
    },
    goodMatchText: {
      color: "#1d4ed8",
    },
    fairMatchText: {
      color: theme.textSecondary,
    },
    matchScoreText: {
      ...typography.caption,
      color: theme.textMuted,
    },

    routeContainer: {
      flexDirection: "row",
      marginBottom: spacing.sm,
      paddingLeft: spacing.xs,
    },
    routeTimeline: { alignItems: "center", width: 20, marginRight: spacing.md },
    dotGreen: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.success,
    },
    routeLine: {
      width: 2,
      flex: 1,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    dotRed: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.danger,
    },
    routeAddresses: { flex: 1, justifyContent: "space-between", gap: 14 },
    routeFrom: { ...typography.bodyMedium, color: theme.textPrimary },
    routeTo: { ...typography.bodyMedium, color: theme.textPrimary },

    chipRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipText: { ...typography.captionMedium, color: theme.textSecondary },

    errorText: {
      ...typography.bodyMedium,
      color: theme.danger,
      marginTop: spacing.md,
      textAlign: "center",
    },
    retryBtn: {
      marginTop: spacing.lg,
      backgroundColor: theme.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
    },
    retryText: { ...typography.bodySemiBold, color: "#fff" },
    emptyTitle: {
      ...typography.h3,
      color: theme.textSecondary,
      marginTop: spacing.lg,
    },
    emptySubtitle: {
      ...typography.body,
      color: theme.textMuted,
      marginTop: spacing.sm,
      textAlign: "center",
    },
  });
}

