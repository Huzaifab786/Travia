import React, { useContext } from "react";
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import {
  createBottomTabNavigator,
  BottomTabScreenProps,
} from "@react-navigation/bottom-tabs";
import { NavigatorScreenParams, CompositeScreenProps } from "@react-navigation/native";
import { PassengerHomeScreen } from "../screens/PassengerHomeScreen";
import { RideDetailsScreen } from "../screens/RideDetailsScreen";
import { LiveRideScreen } from "../screens/LiveRideScreen";
import { MyBookingsScreen } from "../../bookings/screens/MyBookingsScreen";
import { PassengerLocationSearchScreen } from "../screens/PassengerLocationSearchScreen";
import { PassengerMapPickerScreen } from "../screens/PassengerMapPickerScreen";
import type { Ride } from "../api/rideApi";
import type { PlaceSuggestion } from "../../driver/api/placeApi";
import { Ionicons } from "@expo/vector-icons";
import { ProfileScreen } from "../../auth/screens/ProfileScreen";
import { ThemeContext } from "../../../app/providers/ThemeProvider";

export type PassengerTabParamList = {
  PassengerHome: {
    selectedPlace?: PlaceSuggestion;
    selectedField?: "pickup" | "dropoff";
  } | undefined;
  MyBookings: undefined;
  Profile: undefined;
};

export type PassengerStackParamList = {
  PassengerTabs: NavigatorScreenParams<PassengerTabParamList>;
  RideDetails: { ride: Ride };
  LiveRide: {
    rideId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    encodedPolyline: string | null;
    driverPhone?: string | null;
    meetupPoint?: {
      id: string;
      label: string;
      lat: number;
      lng: number;
      address?: string | null;
      order?: number;
      source?: string;
    } | null;
  };
  PassengerLocationSearch: {
    field: "pickup" | "dropoff";
    title?: string;
    focusLat?: number;
    focusLng?: number;
    initialQuery?: string;
  };
  PassengerMapPicker: {
    field: "pickup" | "dropoff";
    initialLocation?: { lat: number; lng: number };
  };
};

const Stack = createNativeStackNavigator<PassengerStackParamList>();
const Tab = createBottomTabNavigator<PassengerTabParamList>();

function PassengerTabNavigator() {
  const { theme } = useContext(ThemeContext);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBarBg,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
          elevation: 20,
          shadowColor: theme.shadowColor,
          shadowOpacity: 0.15,
          shadowRadius: 16,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="PassengerHome"
        component={PassengerHomeScreen}
        options={{
          title: "Find Rides",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{
          title: "My Trips",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function PassengerNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PassengerTabs"
        component={PassengerTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RideDetails"
        component={RideDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PassengerLocationSearch"
        component={PassengerLocationSearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PassengerMapPicker"
        component={PassengerMapPickerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LiveRide"
        component={LiveRideScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
