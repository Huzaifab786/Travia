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
import { ThemeContext } from "../../../app/providers/ThemeProvider";

export type DriverStackParamList = {
  DriverTabs: undefined;
  DriverHome: undefined;
  MyRides: undefined;
  CreateRide: undefined;
  VehicleDetails: undefined;
  DriverVerification: undefined;
  Profile: undefined;
  LocationSearch: {
    onSelect: (place: PlaceSuggestion) => void;
    title?: string;
    focusLat?: number;
    focusLng?: number;
  };
  MapPicker: {
    onSelect: (place: PlaceSuggestion) => void;
    initialLocation?: { lat: number; lng: number };
  };
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
    </Stack.Navigator>
  );
}
