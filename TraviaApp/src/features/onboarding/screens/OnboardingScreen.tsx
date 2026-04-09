import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { spacing, typography, radius } from "../../../config/theme";
import { GlassCard } from "../../../components/ui/GlassCard";
import { Button } from "../../../components/ui/Button";
import { LinearGradient } from "expo-linear-gradient";
import RouteSvg from "../../../../assets/slide1.svg";
import AuthSvg from "../../../../assets/slide2.svg";
import PaymentsSvg from "../../../../assets/slide3.svg";

const SLIDES = [
  {
    id: "1",
    title: "Route Matching",
    description:
      "See the route first, then join the ride that fits your trip best.",
    badge: "RIDES",
    Icon: RouteSvg,
  },
  {
    id: "2",
    title: "Secure Access",
    description:
      "A clean sign-in flow that keeps the app simple, fast, and trusted.",
    badge: "LOGIN",
    Icon: AuthSvg,
  },
  {
    id: "3",
    title: "Easy Payments",
    description:
      "Clear fares and smooth payment visuals that make the app feel reliable.",
    badge: "PAYMENTS",
    Icon: PaymentsSvg,
  },
] as const;

type OnboardingScreenProps = {
  onDone: () => void;
};

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const { theme, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const { width } = Dimensions.get("window");

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const finishOnboarding = () => {
    onDone();
  };

  const scrollToNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
      return;
    }
    finishOnboarding();
  };

  const s = makeStyles(theme, isDark);

  const gradientColors = isDark
    ? (["#243c32", "#0c1e16", "#040c08"] as const)
    : (["#d1fae5", "#ecfdf5", "#f8fafc"] as const);

  const renderItem = ({ item, index }: { item: (typeof SLIDES)[number]; index: number }) => {
    const Svg = item.Icon;

    return (
      <View style={s.slide}>
        <View style={s.heroArea}>
          <Animated.View
            style={[
              s.glow,
              {
                backgroundColor: theme.primary,
                opacity: scrollX.interpolate({
                  inputRange: [
                    (index - 0.5) * width,
                    index * width,
                    (index + 0.5) * width,
                  ],
                  outputRange: [isDark ? 0.05 : 0.02, isDark ? 0.18 : 0.08, isDark ? 0.05 : 0.02],
                  extrapolate: "clamp",
                }),
              },
            ]}
          />
          <View style={s.illustrationCard}>
            <View style={[s.badge, { backgroundColor: theme.primary }]}>
              <Text style={s.badgeText}>{item.badge}</Text>
            </View>
            <View style={s.svgWrap}>
              <Svg width={width * 0.82} height={Dimensions.get("window").height * 0.28} />
            </View>
          </View>
        </View>

        <GlassCard intensity={isDark ? 30 : 90} tint={isDark ? "dark" : "light"} style={s.bottomCard}>
          <View style={s.pagination}>
            {SLIDES.map((_, i) => {
              const dotWidth = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [8, 24, 8],
                extrapolate: "clamp",
              });
              const opacity = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [0.35, 1, 0.35],
                extrapolate: "clamp",
              });

              return (
                <Animated.View
                  key={i}
                  style={[
                    s.dot,
                    {
                      width: dotWidth,
                      opacity,
                      backgroundColor: theme.primary,
                    },
                  ]}
                />
              );
            })}
          </View>

          <Text style={[s.title, { color: theme.textPrimary }]}>
            {item.title}
          </Text>
          <Text style={[s.description, { color: theme.textSecondary }]}>
            {item.description}
          </Text>

          <Button
            title={index === SLIDES.length - 1 ? "Get Started" : "Next"}
            onPress={scrollToNext}
            variant="solid"
            size="lg"
            fullWidth
            style={s.nextButton}
            rightIcon={
              <Ionicons
                name="arrow-forward"
                size={18}
                color={theme.textInverse}
              />
            }
          />
        </GlassCard>
      </View>
    );
  };

  return (
    <LinearGradient colors={gradientColors} style={s.gradientBackground}>
      <SafeAreaView style={s.safeArea}>
        
        {/* Watermark to unite the design language */}
        <View style={s.watermarkContainer}>
          <Text style={s.watermarkText}>TRAVIA</Text>
        </View>

        {/* Skip button logic */}
        <Pressable
          style={s.skipButton}
          onPress={finishOnboarding}
          hitSlop={20}
        >
          <Text style={s.skipText}>Skip</Text>
        </Pressable>

        <FlatList
          data={SLIDES}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          ref={slidesRef}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(theme: any, isDark: boolean) {
  const { width, height } = Dimensions.get("window");

  return StyleSheet.create({
    gradientBackground: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    watermarkContainer: {
      position: "absolute",
      top: 450,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: -1,
    },
    watermarkText: {
      fontSize: 90,
      fontWeight: "900",
      color: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(4, 120, 87, 0.04)",
      letterSpacing: 4,
    },
    slide: {
      width,
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      justifyContent: "space-between",
    },
    skipButton: {
      position: "absolute",
      top: spacing['4xl'],
      right: spacing.xl,
      zIndex: 20,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.6)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.9)",
    },
    skipText: {
      ...typography.bodyMedium,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    heroArea: {
      flex: 0.72,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    glow: {
      position: "absolute",
      width: width * 0.7,
      height: width * 0.7,
      borderRadius: width,
      top: height * 0.15,
    },
    illustrationCard: {
      width: "100%",
      borderRadius: radius["2xl"],
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.md,
      marginTop: spacing["5xl"],
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255,255,255,0.85)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255,255,255,0.9)",
      shadowColor: isDark ? "#A7F3D0" : "#0F172A",
      shadowOpacity: isDark ? 0.05 : 0.1,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
      alignItems: "center",
    },
    badge: {
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radius.full,
      marginBottom: spacing.md,
    },
    badgeText: {
      ...typography.label,
      color: "#FFFFFF",
      fontSize: 11,
      letterSpacing: 0.8,
    },
    svgWrap: {
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    bottomCard: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    nextButton: {
       marginTop: spacing.sm,
       backgroundColor: isDark ? "#FFFFFF" : theme.primary,
       shadowColor: isDark ? "#000" : theme.primary,
       shadowOffset: { width: 0, height: 8 },
       shadowOpacity: 0.2,
       shadowRadius: 16,
       elevation: 8,
    },
    pagination: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },
    title: {
      ...typography.h1,
      fontSize: 28,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    description: {
      ...typography.body,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: spacing.md,
    },
  });
}
