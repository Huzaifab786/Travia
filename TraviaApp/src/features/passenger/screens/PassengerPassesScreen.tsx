import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  TextInput,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemeContext } from "../../../app/providers/ThemeProvider";
import { typography, spacing, radius } from "../../../config/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  getEligibleDrivers,
  getPassengerPasses,
  requestPass,
  EligiblePassOffer,
  PassDetails,
} from "../../shared/api/passApi";
import type { PassengerStackParamList } from "../navigation/PassengerNavigator";

type PassPlan = "weekly" | "monthly" | "custom";

type SelectionState = Record<
  string,
  {
    planType: PassPlan;
    customDays: string;
  }
>;

const PLAN_PRESETS: Array<{ key: PassPlan; label: string; days: number }> = [
  { key: "weekly", label: "Weekly", days: 7 },
  { key: "monthly", label: "Monthly", days: 30 },
  { key: "custom", label: "Custom", days: 1 },
];

export function PassengerPassesScreen() {
  const { theme } = useContext(ThemeContext);
  const navigation =
    useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const s = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePasses, setActivePasses] = useState<PassDetails[]>([]);
  const [eligibleOffers, setEligibleOffers] = useState<EligiblePassOffer[]>([]);
  const [requestingKey, setRequestingKey] = useState<string | null>(null);
  const [selections, setSelections] = useState<SelectionState>({});

  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);

      const [passesRes, offersRes] = await Promise.all([
        getPassengerPasses(),
        getEligibleDrivers(),
      ]);

      setActivePasses(passesRes);

      const filteredOffers = offersRes.filter((offer) => {
        const existing = passesRes.find(
          (pass) =>
            pass.driverId === offer.driver.id &&
            pass.routeSignature === offer.routeSignature &&
            (pass.status === "pending" || pass.status === "active"),
        );
        return !existing;
      });

      setEligibleOffers(filteredOffers);
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", "Failed to load commuter passes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const getSelection = (offer: EligiblePassOffer) =>
    selections[offer.routeSignature] ?? {
      planType: "weekly" as PassPlan,
      customDays: "14",
    };

  const getDurationDays = (planType: PassPlan, customDays: string) => {
    if (planType === "weekly") return 7;
    if (planType === "monthly") return 30;
    const parsed = Math.max(1, Math.floor(Number(customDays || 0)));
    return Number.isFinite(parsed) ? parsed : 1;
  };

  const getRideLabel = (rideCount: number) => {
    return `${rideCount} ride${rideCount === 1 ? "" : "s"}`;
  };

  const getPassPrice = (offer: EligiblePassOffer, planType: PassPlan, customDays: string) => {
    const durationDays = getDurationDays(planType, customDays);
    return Math.max(20, Math.round(offer.estimatedFarePerRide * durationDays * 0.9));
  };

  const handleRequestPass = async (offer: EligiblePassOffer) => {
    const selection = getSelection(offer);
    const durationDays = getDurationDays(selection.planType, selection.customDays);
    const price = getPassPrice(offer, selection.planType, selection.customDays);
    const planLabel =
      selection.planType === "custom"
        ? getRideLabel(durationDays)
        : PLAN_PRESETS.find((p) => p.key === selection.planType)?.label ?? "Custom";

    Alert.alert(
      "Request Commuter Pass",
      `Route: ${offer.routeLabel}\nPlan: ${planLabel}\nRide quota: ${getRideLabel(durationDays)}\nPrice: Rs ${price}\n\nYou will need to pay the driver cash for approval.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "default",
          onPress: async () => {
            try {
              setRequestingKey(offer.routeSignature);
              await requestPass(
                offer.driver.id,
                offer.routeSignature,
                selection.planType,
                durationDays,
              );
              await fetchData(false);
              Alert.alert(
                "Success",
                "Pass requested! Hand cash to your driver so they can approve it.",
              );
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to request pass.");
            } finally {
              setRequestingKey(null);
            }
          },
        },
      ],
    );
  };

  const setPlanType = (offer: EligiblePassOffer, planType: PassPlan) => {
    setSelections((prev) => ({
      ...prev,
      [offer.routeSignature]: {
        planType,
        customDays: prev[offer.routeSignature]?.customDays || "14",
      },
    }));
  };

  const setCustomDays = (offer: EligiblePassOffer, customDays: string) => {
    setSelections((prev) => ({
      ...prev,
      [offer.routeSignature]: {
        planType: prev[offer.routeSignature]?.planType || "custom",
        customDays,
      },
    }));
  };

  const renderActivePass = (item: PassDetails) => {
    const isPending = item.status === "pending";
    const isActive = item.status === "active";
    const isExhausted = item.status === "exhausted";
    const statusLabel =
      item.status === "active" ? "Active" : item.status === "pending" ? "Pending" : "Expired";

    return (
      <View style={[s.card, isActive && s.activeCard]}>
        <View style={s.cardHeader}>
          <View style={s.avatarBox}>
            <Ionicons name="card" size={24} color={theme.background} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.drName}>Pass with {item.driver?.name}</Text>
            <Text style={[s.statusBadge, isActive && { color: theme.primary }]}>
              {statusLabel.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={s.offerBox}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.offerTitle}>{item.routeLabel || "Saved route"}</Text>
            <Text style={s.offerMeta}>
              {item.durationLabel || `${item.totalRides || item.durationDays || 0} rides`} · Rs {item.price}
            </Text>
            <Text style={s.offerMeta}>
              {Number(item.ridesUsed || 0)} of {Number(item.totalRides || 0)} rides used
            </Text>
          </View>
        </View>

        {isPending && (
          <View style={s.pendingBox}>
            <Ionicons name="time-outline" size={16} color={theme.amber} />
            <Text style={s.pendingText}>
              Awaiting driver approval. Hand Rs {item.price} cash to{" "}
              {item.driver?.name} on your next ride.
            </Text>
          </View>
        )}

        {isActive && (
          <View style={s.activeBox}>
            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            <Text style={s.activeText}>This route is covered until total rides are used.</Text>
          </View>
        )}

        {isExhausted && (
          <View style={s.expiredBox}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.textSecondary} />
            <Text style={s.expiredText}>This pass has expired.</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEligibleOffer = (item: EligiblePassOffer) => {
    const selection = getSelection(item);
    const durationDays = getDurationDays(selection.planType, selection.customDays);
    const price = getPassPrice(item, selection.planType, selection.customDays);

    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.avatarBox}>
            <Ionicons name="person" size={24} color={theme.background} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.drName}>{item.driver.name}</Text>
            <Text style={s.drSub}>
              {item.completedTrips} trips on this exact route
            </Text>
          </View>
        </View>

        <View style={s.routeBox}>
          <Ionicons name="repeat-outline" size={16} color={theme.primary} />
          <Text style={s.routeText}>{item.routeLabel}</Text>
        </View>

        <View style={s.pillsRow}>
          {PLAN_PRESETS.map((plan) => (
            <Pressable
              key={plan.key}
              onPress={() => setPlanType(item, plan.key)}
              style={[
                s.planPill,
                selection.planType === plan.key && s.planPillActive,
              ]}
            >
              <Text
                style={[
                  s.planPillText,
                  selection.planType === plan.key && s.planPillTextActive,
                ]}
              >
                {plan.label}
              </Text>
              <Text
                style={[
                  s.planPillSubtext,
                  selection.planType === plan.key && s.planPillSubtextActive,
                ]}
              >
                {plan.key === "custom" ? "Any rides" : `${plan.days} rides`}
              </Text>
            </Pressable>
          ))}
        </View>

        {selection.planType === "custom" ? (
          <View style={s.customRow}>
            <Text style={s.customLabel}>Rides</Text>
            <TextInput
              value={selection.customDays}
              onChangeText={(value) => setCustomDays(item, value)}
              keyboardType="number-pad"
              placeholder="14"
              placeholderTextColor={theme.textMuted}
              style={s.customInput}
            />
          </View>
        ) : null}

        <View style={s.offerBox}>
          <View style={{ flex: 1 }}>
              <Text style={s.offerTitle}>
                {selection.planType === "custom"
                ? `${getRideLabel(durationDays)} pass`
                : `${selection.planType === "weekly" ? "Weekly" : "Monthly"} pass`}
            </Text>
            <Text style={s.offerPrice}>Rs {price}</Text>
            <Text style={s.offerMeta}>
              Based on your usual fare of Rs {item.estimatedFarePerRide} per ride
            </Text>
          </View>

          <Pressable
            onPress={() => handleRequestPass(item)}
            style={s.btn}
            disabled={requestingKey === item.routeSignature}
          >
            {requestingKey === item.routeSignature ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Request</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.safeArea}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={s.header}>
        <Text style={s.title}>Commuter Passes</Text>
        <Text style={s.subtitle}>
          Same driver and same route only. Choose weekly, monthly, or custom ride counts.
        </Text>
      </View>

      {activePasses.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Passes</Text>
          {activePasses.map(renderActivePass)}
        </View>
      ) : null}

      {eligibleOffers.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Eligible Routes</Text>
          {eligibleOffers.map(renderEligibleOffer)}
        </View>
      ) : activePasses.length > 0 ? (
        <View style={s.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={48} color={theme.success} />
          <Text style={s.emptyText}>
            You already have a pass or there are no new eligible routes right now.
          </Text>
        </View>
      ) : (
        <View style={s.emptyContainer}>
          <Ionicons name="card-outline" size={48} color={theme.textSecondary} />
          <Text style={s.emptyText}>
            Complete at least 3 trips on the same route with the same driver to unlock commuter pass options.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    content: { paddingBottom: 100 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      padding: spacing.xl,
      paddingTop: spacing["2xl"],
      backgroundColor: theme.surfaceColor,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textSecondary, marginTop: 4 },
    section: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    sectionTitle: { ...typography.h2, color: theme.textPrimary, marginBottom: spacing.md },
    emptyContainer: {
      marginTop: 40,
      alignItems: "center",
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: 12,
    },
    card: {
      backgroundColor: theme.surfaceColor,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    activeCard: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + "11",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatarBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.textPrimary,
      justifyContent: "center",
      alignItems: "center",
    },
    drName: { ...typography.h2, color: theme.textPrimary },
    drSub: { ...typography.caption, color: theme.textSecondary },
    routeBox: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.background,
      padding: 12,
      borderRadius: radius.sm,
    },
    routeText: { ...typography.bodyMedium, color: theme.textPrimary, flex: 1 },
    pillsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    planPill: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: "center",
      backgroundColor: theme.background,
    },
    planPillActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primarySubtle,
    },
    planPillText: { ...typography.bodyMedium, color: theme.textPrimary, fontWeight: "700" },
    planPillTextActive: { color: theme.primary },
    planPillSubtext: { ...typography.caption, color: theme.textSecondary, marginTop: 2 },
    planPillSubtextActive: { color: theme.primary },
    customRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 12,
    },
    customLabel: { ...typography.bodyMedium, color: theme.textSecondary, width: 48 },
    customInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.borderColor,
      backgroundColor: theme.background,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      height: 48,
      color: theme.textPrimary,
    },
    offerBox: {
      marginTop: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.background,
      padding: 12,
      borderRadius: radius.sm,
      gap: 12,
    },
    offerTitle: { ...typography.body, color: theme.textSecondary },
    offerPrice: { ...typography.h1, color: theme.primary },
    offerMeta: { ...typography.caption, color: theme.textSecondary, marginTop: 2 },
    btn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: radius.sm,
      minWidth: 96,
      alignItems: "center",
    },
    btnText: { ...typography.label, color: "#fff" },
    statusBadge: {
      ...typography.caption,
      fontWeight: "700",
      marginTop: 4,
    },
    pendingBox: {
      marginTop: 16,
      flexDirection: "row",
      backgroundColor: theme.amber + "22",
      padding: 12,
      borderRadius: radius.sm,
      alignItems: "center",
      gap: 8,
    },
    pendingText: {
      ...typography.caption,
      color: theme.amber,
      flex: 1,
    },
    activeBox: {
      marginTop: 16,
      flexDirection: "row",
      backgroundColor: theme.successBg,
      padding: 12,
      borderRadius: radius.sm,
      alignItems: "center",
      gap: 8,
    },
    activeText: {
      ...typography.caption,
      color: theme.success,
      flex: 1,
      fontWeight: "700",
    },
    expiredBox: {
      marginTop: 16,
      flexDirection: "row",
      backgroundColor: theme.surfaceElevated,
      padding: 12,
      borderRadius: radius.sm,
      alignItems: "center",
      gap: 8,
    },
    expiredText: {
      ...typography.caption,
      color: theme.textSecondary,
      flex: 1,
      fontWeight: "700",
    },
  });
}
