import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
  StackActions,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { searchPlacesApi, PlaceSuggestion } from "../../driver/api/placeApi";
import { PassengerStackParamList } from "../navigation/PassengerNavigator";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type PassengerLocationSearchNavProp = NativeStackNavigationProp<
  PassengerStackParamList,
  "PassengerLocationSearch"
>;
type PassengerLocationSearchRouteProp = RouteProp<
  PassengerStackParamList,
  "PassengerLocationSearch"
>;

export function PassengerLocationSearchScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<PassengerLocationSearchNavProp>();
  const route = useRoute<PassengerLocationSearchRouteProp>();

  const { title, field, focusLat, focusLng, initialQuery, returnTo, ride } =
    route.params;

  const [query, setQuery] = useState(initialQuery || "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const trimmedQuery = query.trim();

      if (trimmedQuery.length < 3) {
        setSuggestions([]);
        return;
      }

      try {
        setLoading(true);
        const res = await searchPlacesApi(trimmedQuery, focusLat, focusLng);
        setSuggestions(res.places);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, focusLat, focusLng]);

  const handleSelect = (place: PlaceSuggestion) => {
    if (returnTo === "RideDetails") {
      if (!ride) {
        navigation.navigate("PassengerTabs", {
          screen: "PassengerHome",
          params: {
            selectedField: field,
            selectedPlace: place,
          },
        });
        return;
      }

      navigation.dispatch(
        StackActions.popTo("RideDetails", {
          ride,
          selectedField: field,
          selectedPlace: place,
        }),
      );
      return;
    }

    navigation.navigate("PassengerTabs", {
      screen: "PassengerHome",
      params: {
        selectedField: field,
        selectedPlace: place,
      },
    });
  };

  const navigateToMap = () => {
    let initialLocation = undefined;

    if (suggestions.length > 0) {
      initialLocation = {
        lat: suggestions[0].lat,
        lng: suggestions[0].lng,
      };
    } else if (focusLat != null && focusLng != null) {
      initialLocation = {
        lat: focusLat,
        lng: focusLng,
      };
    }

    navigation.navigate("PassengerMapPicker", {
      field,
      initialLocation,
      ride,
      returnTo,
    });
  };

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>{title || "Search Location"}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.searchBox}>
          <TextInput
            ref={inputRef}
            placeholder="Type a city or address..."
            value={query}
            onChangeText={setQuery}
            style={s.input}
            placeholderTextColor={theme.textMuted}
          />
          {loading && (
            <ActivityIndicator style={s.loader} color={theme.primary} />
          )}
        </View>

        <Pressable onPress={navigateToMap} style={s.mapOption}>
          <Ionicons name="map-outline" size={24} color={theme.textPrimary} />
          <Text style={s.mapOptionText}>Choose on Map</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textMuted}
          />
        </Pressable>

        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ListEmptyComponent={
            query.length >= 3 && !loading ? (
              <Text style={s.emptyText}>No locations found.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => handleSelect(item)} style={s.item}>
              <View style={s.itemContent}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={s.itemLabel}>{item.label}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...typography.h3,
      color: theme.textPrimary,
    },
    searchBox: {
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      borderRadius: radius.md,
      ...typography.body,
      color: theme.textPrimary,
      backgroundColor: theme.surface,
    },
    loader: {
      position: "absolute",
      right: spacing.xl + spacing.xs,
    },
    mapOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      backgroundColor: theme.surface,
      marginHorizontal: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapOptionText: {
      flex: 1,
      ...typography.bodyMedium,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    item: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    itemContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    itemLabel: {
      flex: 1,
      ...typography.bodyMedium,
      color: theme.textPrimary,
    },
    emptyText: {
      textAlign: "center",
      marginTop: spacing.xl,
      ...typography.bodyMedium,
      color: theme.textMuted,
    },
  });
}
