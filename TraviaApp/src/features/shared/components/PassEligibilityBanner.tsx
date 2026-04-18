import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EligiblePassOffer } from "../api/passApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type Props = {
  eligibleDrivers: EligiblePassOffer[];
  onPress: () => void;
};

export function PassEligibilityBanner({ eligibleDrivers, onPress }: Props) {
  const { theme } = useTheme();

  const topDriver = useMemo(
    () => eligibleDrivers.slice().sort((a, b) => b.completedTrips - a.completedTrips)[0],
    [eligibleDrivers],
  );

  if (!topDriver) {
    return null;
  }

  const extraDrivers = Math.max(eligibleDrivers.length - 1, 0);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.primarySubtle,
          borderColor: theme.primary + "33",
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="card-outline" size={20} color={theme.primary} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.primary }]}>
          Commuter pass unlocked
        </Text>
        <Text style={[styles.body, { color: theme.textPrimary }]}>
          You’ve completed {topDriver.completedTrips} trips with {topDriver.driver.name} on the same route.
          {extraDrivers > 0 ? ` ${extraDrivers} other route option${extraDrivers === 1 ? "" : "s"} are also eligible.` : ""}
        </Text>
        <Text style={[styles.link, { color: theme.primary }]}>
          View pass options
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.captionMedium,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  body: {
    ...typography.bodyMedium,
  },
  link: {
    ...typography.captionMedium,
    fontWeight: "700",
    marginTop: 2,
  },
});
