import React, { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, typography } from "../../config/theme";

type LiveRideStat = {
  value: string;
  label: string;
};

type Props = {
  theme: any;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  stats: [LiveRideStat, LiveRideStat];
  children?: ReactNode;
};

export function LiveRideStatusPanel({
  theme,
  iconName,
  iconColor,
  title,
  subtitle,
  stats,
  children,
}: Props) {
  const styles = makeStyles(theme);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {children ? <View style={styles.childrenWrap}>{children}</View> : null}

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    subtitle: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
    childrenWrap: {
      gap: spacing.md,
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      gap: 4,
    },
    statValue: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    statLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
  });
}
