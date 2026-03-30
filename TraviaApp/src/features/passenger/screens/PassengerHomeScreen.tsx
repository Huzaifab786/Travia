import React, { useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { PassengerStackParamList } from "../navigation/PassengerNavigator";
import { AuthContext } from "../../../app/providers/AuthProvider";
import { getRidesApi, Ride } from "../api/rideApi";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { Skeleton } from "../../../components/common/Skeleton";

export function PassengerHomeScreen() {
  const { theme } = useTheme();
  const { user } = useContext(AuthContext);
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();

  const [rides, setRides] = useState<Ride[]>([]);
  const [filtered, setFiltered] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const firstName = (user?.user_metadata?.full_name ?? "Traveller").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const fetchRides = async () => {
    try {
      setError("");
      const res = await getRidesApi();
      setRides(res.rides);
      setFiltered(res.rides);
    } catch (e: any) {
      setError(e.message || "Failed to load rides");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchRides(); }, []));

  const onSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) { setFiltered(rides); return; }
    const q = text.toLowerCase();
    setFiltered(rides.filter(
      r => r.pickup.address.toLowerCase().includes(q) || r.dropoff.address.toLowerCase().includes(q)
    ));
  };

  const s = makeStyles(theme);

  const renderRideCard = ({ item }: { item: Ride }) => {
    const seatsTotal = (item as any).seatsTotal ?? 0;
    const distKm = (item as any).distanceMeters ? ((item as any).distanceMeters / 1000).toFixed(0) : null;

    return (
      <Pressable
        onPress={() => navigation.navigate("RideDetails", { ride: item })}
        style={({ pressed }) => [s.card, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
      >
        {/* Driver Row */}
        <View style={s.cardHeader}>
          <View style={s.driverRow}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{item.driver.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={s.driverName}>{item.driver.name}</Text>
              <View style={s.ratingRow}>
                <Ionicons name="star" size={11} color={theme.amber} />
                <Text style={s.ratingText}>4.8</Text>
              </View>
            </View>
          </View>
          <View style={s.pricePill}>
            <Text style={s.priceText}>Rs {item.price}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={s.routeContainer}>
          <View style={s.routeTimeline}>
            <View style={s.dotGreen} />
            <View style={s.routeLine} />
            <View style={s.dotRed} />
          </View>
          <View style={s.routeAddresses}>
            <Text style={s.routeFrom} numberOfLines={1}>{item.pickup.address}</Text>
            <Text style={s.routeTo} numberOfLines={1}>{item.dropoff.address}</Text>
          </View>
        </View>

        {/* Footer chips */}
        <View style={s.chipRow}>
          <View style={s.chip}>
            <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} />
            <Text style={s.chipText}>
              {new Date(item.departureTime).toLocaleDateString([], { month: "short", day: "numeric" })}
              {" · "}
              {new Date(item.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <View style={s.chip}>
            <Ionicons name="people-outline" size={12} color={theme.textSecondary} />
            <Text style={s.chipText}>{seatsTotal} seats</Text>
          </View>
          {distKm && (
            <View style={s.chip}>
              <Ionicons name="navigate-outline" size={12} color={theme.textSecondary} />
              <Text style={s.chipText}>{distKm} km</Text>
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
            <Skeleton width={40} height={12} variant="rounded" />
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

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{greeting}, {firstName} 👋</Text>
          <Text style={s.headerTitle}>Find your ride</Text>
        </View>
        <View style={s.headerIconBg}>
          <Ionicons name="notifications-outline" size={22} color={theme.primary} />
        </View>
      </View>

      {/* Search bar */}
      <View style={s.searchWrapper}>
        <Ionicons name="search-outline" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search city, address..."
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={onSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => onSearch("")}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Stats strip */}
      <View style={s.statsStrip}>
        <View style={s.statItem}>
          <Text style={s.statNum}>{filtered.length}</Text>
          <Text style={s.statLabel}>Available</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statNum}>{rides.filter(r => (r as any).seatsTotal > 0).length}</Text>
          <Text style={s.statLabel}>With Seats</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statNum}>{rides.length > 0 ? Math.min(...rides.map(r => r.price)) : 0}</Text>
          <Text style={s.statLabel}>Min Price</Text>
        </View>
      </View>

      {/* Rides List */}
      {loading ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
          <View style={[s.statsStrip, { borderColor: "transparent", backgroundColor: "transparent" }]}>
            <Skeleton width="30%" height={60} variant="rounded" />
            <Skeleton width="30%" height={60} variant="rounded" />
            <Skeleton width="30%" height={60} variant="rounded" />
          </View>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              {renderSkeleton()}
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={fetchRides} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String((item as any).id)}
          renderItem={renderRideCard}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchRides(); }}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="car-sport-outline" size={56} color={theme.textMuted} />
              <Text style={s.emptyTitle}>No rides found</Text>
              <Text style={s.emptySubtitle}>
                {search ? "Try a different search term" : "Pull to refresh or check back later"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing["2xl"] },

    // Header
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    greeting: { ...typography.caption, color: theme.textSecondary, marginBottom: 2 },
    headerTitle: { ...typography.h2, color: theme.textPrimary },
    headerIconBg: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      backgroundColor: theme.primarySubtle,
      justifyContent: "center",
      alignItems: "center",
    },

    // Search
    searchWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: { flex: 1, color: theme.textPrimary, fontSize: 15 },

    // Stats strip
    statsStrip: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      marginHorizontal: spacing.xl,
      borderRadius: radius.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    statItem: { flex: 1, alignItems: "center", paddingVertical: spacing.md },
    statNum: { ...typography.h3, color: theme.primary },
    statLabel: { ...typography.caption, color: theme.textSecondary, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: theme.border, marginVertical: spacing.sm },

    // List
    list: { paddingHorizontal: spacing.xl, paddingBottom: 90 },

    // Card
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    driverRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
    ratingText: { ...typography.caption, color: theme.amber },
    pricePill: {
      backgroundColor: theme.primarySubtle,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
    },
    priceText: { ...typography.bodySemiBold, color: theme.primary },

    // Route
    routeContainer: {
      flexDirection: "row",
      marginBottom: spacing.md,
      paddingLeft: spacing.xs,
    },
    routeTimeline: { alignItems: "center", width: 20, marginRight: spacing.md },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.success },
    routeLine: { width: 2, flex: 1, backgroundColor: theme.border, marginVertical: 4 },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.danger },
    routeAddresses: { flex: 1, justifyContent: "space-between", gap: 14 },
    routeFrom: { ...typography.bodyMedium, color: theme.textPrimary },
    routeTo: { ...typography.bodyMedium, color: theme.textPrimary },

    // Chips
    chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
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

    // States
    loadingText: { ...typography.body, color: theme.textSecondary, marginTop: spacing.md },
    errorText: { ...typography.bodyMedium, color: theme.danger, marginTop: spacing.md, textAlign: "center" },
    retryBtn: {
      marginTop: spacing.lg,
      backgroundColor: theme.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
    },
    retryText: { ...typography.bodySemiBold, color: "#fff" },
    emptyTitle: { ...typography.h3, color: theme.textSecondary, marginTop: spacing.lg },
    emptySubtitle: { ...typography.body, color: theme.textMuted, marginTop: spacing.sm, textAlign: "center" },
  });
}