import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, typography } from "../../config/theme";

export type TripTimelineStep = {
  key: string;
  label: string;
  description?: string;
  state: "complete" | "active" | "upcoming";
};

export function TripTimeline({
  steps,
  theme,
}: {
  steps: TripTimelineStep[];
  theme: any;
}) {
  const styles = makeStyles(theme);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="git-branch-outline" size={18} color={theme.primary} />
        <Text style={styles.title}>Trip timeline</Text>
      </View>

      <View style={styles.list}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isComplete = step.state === "complete";
          const isActive = step.state === "active";

          return (
            <View key={step.key} style={styles.row}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.dot,
                    isComplete
                      ? { backgroundColor: theme.success }
                      : isActive
                        ? { backgroundColor: theme.primary }
                        : { backgroundColor: theme.border },
                  ]}
                >
                  {isComplete ? (
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  ) : null}
                </View>
                {!isLast ? (
                  <View
                    style={[
                      styles.line,
                      isComplete || isActive
                        ? { backgroundColor: theme.primary }
                        : { backgroundColor: theme.border },
                    ]}
                  />
                ) : null}
              </View>

              <View style={styles.content}>
                <Text
                  style={[
                    styles.label,
                    isActive || isComplete
                      ? { color: theme.textPrimary }
                      : { color: theme.textSecondary },
                  ]}
                >
                  {step.label}
                </Text>
                {step.description ? (
                  <Text style={styles.description}>{step.description}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
    },
    track: {
      width: 20,
      alignItems: "center",
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.8)",
    },
    line: {
      width: 2,
      flex: 1,
      minHeight: 20,
      marginTop: 4,
      borderRadius: 999,
    },
    content: {
      flex: 1,
      paddingBottom: 4,
    },
    label: {
      ...typography.bodySemiBold,
    },
    description: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
  });
}
