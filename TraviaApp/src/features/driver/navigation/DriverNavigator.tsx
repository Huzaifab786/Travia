import React, { useContext } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DriverHomeScreen } from "../screens/DriverHomeScreen";
import { CreateRideScreen } from "../screens/CreateRideScreen";
import { MyRidesScreen } from "../screens/MyRidesScreen";
import { LocationSearchScreen } from "../screens/LocationSearchScreen";
import { MapPickerScreen } from "../screens/MapPickerScreen";
import { PlaceSuggestion } from "../api/placeApi";
import { Ionicons } from "@expo/vector-icons";
import { VehicleDetailsScreen } from "../screens/VehicleDetailsScreen";
import { DriverVerificationScreen } from "../screens/DriverVerificationScreen";
import { ProfileScreen } from "../../auth/screens/ProfileScreen";
import { DriverLiveRideScreen } from "../screens/DriverLiveRideScreen";
import { DriverPassesScreen } from "../screens/DriverPassesScreen";
import { ThemeContext } from "../../../app/providers/ThemeProvider";
import { ChatScreen } from "../../shared/screens/ChatScreen";
import { NotificationsScreen } from "../../shared/screens/NotificationsScreen";

export type DriverStackParamList = {
  DriverTabs: undefined;
  DriverHome: undefined;
  MyRides: undefined;
  CommuterPasses: undefined;
  CreateRide:
    | {
        selectedPlace?: PlaceSuggestion;
        selectedField?: "pickup" | "dropoff";
      }
    | undefined;
  VehicleDetails: undefined;
  DriverVerification: undefined;
  Profile: undefined;
  LocationSearch: {
    field: "pickup" | "dropoff";
    title?: string;
    focusLat?: number;
    focusLng?: number;
  };
  MapPicker: {
    field: "pickup" | "dropoff";
    initialLocation?: { lat: number; lng: number };
  };
  DriverLiveRide: {
    rideId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    encodedPolyline?: any;
    passengerName?: string | null;
    passengerPhone?: string | null;
    meetupPoint?: {
      id: string;
      label: string;
      lat: number;
      lng: number;
      address?: string | null;
      order?: number;
      source?: string;
    } | null;
    passengerDropoff?: {
      lat: number;
      lng: number;
      label?: string | null;
    } | null;
  };
  Chat: { rideId: string };
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();
const Tab = createBottomTabNavigator();

function DriverTabNavigator() {
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
        name="DriverHome"
        component={DriverHomeScreen}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyRides"
        component={MyRidesScreen}
        options={{
          title: "My Rides",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CommuterPasses"
        component={DriverPassesScreen}
        options={{
          title: "Subscribers",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
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

export function DriverNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DriverTabs"
        component={DriverTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateRide"
        component={CreateRideScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LocationSearch"
        component={LocationSearchScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="MapPicker"
        component={MapPickerScreen}
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="VehicleDetails"
        component={VehicleDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverVerification"
        component={DriverVerificationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverLiveRide"
        component={DriverLiveRideScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
