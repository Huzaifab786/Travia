import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  Animated,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { spacing, typography } from "../../../config/theme";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    title: "Smart Route Matching",
    description: "Connect with drivers on your exact path for efficient and shared travel.",
    image: require("../../../../assets/onboarding_matching.png"),
  },
  {
    id: "2",
    title: "Dynamic Fair Pricing",
    description: "Automated mileage-based pricing ensures fair split for every journey.",
    image: require("../../../../assets/onboarding_pricing.png"),
  },
  {
    id: "3",
    title: "Safety & Reliability",
    description: "Verified drivers and real-time route monitoring for your peace of mind.",
    image: require("../../../../assets/onboarding_safety.png"),
  },
];

export function OnboardingScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const s = makeStyles(theme, width, height);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollToNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      await finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem("@has_seen_onboarding", "true");
      // RootNavigator will react to this change if we use a state or just navigate
      // For now, let's navigate to Auth or RoleSelect
      navigation.replace("Auth");
    } catch (err) {
      console.log("Error saving onboarding status", err);
    }
  };

  const renderItem = ({ item }: { item: typeof SLIDES[0] }) => {
    return (
      <View style={s.slide}>
        <View style={s.imageContainer}>
          <Image source={item.image} style={s.image} resizeMode="contain" />
        </View>
        <View style={s.textContainer}>
          <Text style={s.title}>{item.title}</Text>
          <Text style={s.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Pressable onPress={finishOnboarding}>
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
      />

      <View style={s.footer}>
        <View style={s.pagination}>
          {SLIDES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [10, 24, 10],
              extrapolate: "clamp",
            });

            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={i}
                style={[
                  s.dot,
                  { width: dotWidth, opacity, backgroundColor: theme.primary },
                ]}
              />
            );
          })}
        </View>

        <Pressable style={s.nextButton} onPress={scrollToNext}>
          <Text style={s.nextButtonText}>
            {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: any, screenWidth: number, screenHeight: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      alignItems: "flex-end",
    },
    skipText: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    slide: {
      width: screenWidth,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
    },
    imageContainer: {
      height: screenHeight * 0.45,
      justifyContent: "center",
      alignItems: "center",
    },
    image: {
      width: screenWidth * 0.8,
      height: "100%",
    },
    textContainer: {
      alignItems: "center",
      marginTop: spacing.xl,
    },
    title: {
      ...typography.h2,
      color: theme.primary,
      textAlign: "center",
    },
    description: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 24,
    },
    footer: {
      height: screenHeight * 0.2,
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
    },
    pagination: {
      flexDirection: "row",
      height: 64,
      justifyContent: "center",
      alignItems: "center",
    },
    dot: {
      height: 10,
      borderRadius: 5,
      marginHorizontal: 5,
    },
    nextButton: {
      backgroundColor: theme.primary,
      paddingVertical: spacing.lg,
      borderRadius: 16,
      alignItems: "center",
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    nextButtonText: {
      color: theme.textInverse,
      ...typography.h4,
    },
  });
}
