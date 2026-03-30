import React, { useContext } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { PassengerHomeScreen } from "../screens/PassengerHomeScreen";
import { RideDetailsScreen } from "../screens/RideDetailsScreen";
import { LiveRideScreen } from "../screens/LiveRideScreen";
import { MyBookingsScreen } from "../../bookings/screens/MyBookingsScreen";
import type { Ride } from "../api/rideApi";
import { Ionicons } from "@expo/vector-icons";
import { ProfileScreen } from "../../auth/screens/ProfileScreen";
import { ThemeContext } from "../../../app/providers/ThemeProvider";

export type PassengerStackParamList = {
  PassengerTabs: undefined;
  PassengerHome: undefined;
  MyBookings: undefined;
  Profile: undefined;
  RideDetails: { ride: Ride };
  LiveRide: {
    rideId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    encodedPolyline: string | null;
  };
};

const Stack = createNativeStackNavigator<PassengerStackParamList>();
const Tab = createBottomTabNavigator();

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
        name="LiveRide"
        component={LiveRideScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
