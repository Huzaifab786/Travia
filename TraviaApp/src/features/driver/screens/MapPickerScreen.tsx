import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Region } from "react-native-maps";
import {
  useNavigation,
  useRoute,
  RouteProp,
  StackActions,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { reverseGeocodeApi } from "../api/placeApi";
import { DriverStackParamList } from "../navigation/DriverNavigator";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

type MapPickerNavProp = NativeStackNavigationProp<
  DriverStackParamList,
  "MapPicker"
>;
type MapPickerRouteProp = RouteProp<DriverStackParamList, "MapPicker">;

export function MapPickerScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<MapPickerNavProp>();
  const route = useRoute<MapPickerRouteProp>();

  const { initialLocation, field } = route.params;

  const [region, setRegion] = useState<Region>({
    latitude: initialLocation?.lat || 24.8607,
    longitude: initialLocation?.lng || 67.0011,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [address, setAddress] = useState("Loading address...");
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{
    label: string;
    lat: number;
    lng: number;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      const res = await reverseGeocodeApi(lat, lng);

      if (res.place) {
        setAddress(res.place.label);
        setSelectedPlace({
          label: res.place.label,
          lat,
          lng,
        });
      } else {
        setAddress("Unknown location");
      }
    } catch {
      setAddress("Error fetching address");
    } finally {
      setLoading(false);
    }
  };

  const onRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      fetchAddress(newRegion.latitude, newRegion.longitude);
    }, 400);
  };

  const handleConfirm = () => {
    if (!selectedPlace) return;

    navigation.dispatch(
      StackActions.popTo("CreateRide", {
        selectedField: field,
        selectedPlace: {
          id: `${selectedPlace.lat}-${selectedPlace.lng}`,
          label: selectedPlace.label,
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
        },
      }),
    );
  };

  useEffect(() => {
    fetchAddress(region.latitude, region.longitude);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Choose on Map</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.mapContainer}>
        <MapView
          style={s.map}
          initialRegion={region}
          onRegionChangeComplete={onRegionChangeComplete}
          userInterfaceStyle={theme.dark ? "dark" : "light"}
        />
        <View style={s.markerFixed} pointerEvents="none">
          <Ionicons name="location" size={40} color={theme.primary} />
        </View>
      </View>

      <View style={s.footer}>
        <View style={s.addressBox}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons
              name="location-outline"
              size={20}
              color={theme.textSecondary}
            />
          )}

          <Text style={s.addressText} numberOfLines={2}>
            {address}
          </Text>
        </View>

        <Pressable
          onPress={handleConfirm}
          disabled={loading || !selectedPlace}
          style={[
            s.confirmButton,
            (loading || !selectedPlace) && s.confirmButtonDisabled,
          ]}
        >
          <Text style={s.confirmButtonText}>Confirm Location</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
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
    mapContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    markerFixed: {
      position: "absolute",
      top: "50%",
      marginTop: -40,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    footer: {
      padding: spacing.lg,
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 20,
    },
    addressBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
      backgroundColor: theme.background,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addressText: {
      flex: 1,
      ...typography.bodyMedium,
      color: theme.textPrimary,
    },
    confirmButton: {
      backgroundColor: theme.primary,
      padding: spacing.lg,
      borderRadius: radius.md,
      alignItems: "center",
    },
    confirmButtonDisabled: {
      opacity: 0.5,
      backgroundColor: theme.border,
    },
    confirmButtonText: {
      color: "#fff",
      ...typography.h4,
    },
  });
}