import React, { useContext, useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthNavigator } from "../../features/auth/navigation/AuthNavigator";
import { AuthContext } from "../providers/AuthProvider";
import { PassengerNavigator } from "../../features/passenger/navigation/PassengerNavigator";
import { DriverNavigator } from "../../features/driver/navigation/DriverNavigator";
import { OnboardingScreen } from "../../features/onboarding/screens/OnboardingScreen";
import { Ionicons } from "@expo/vector-icons";

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Passenger: undefined;
  Driver: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function BrandedLoader() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f766e" }}>
      <Ionicons name="car-sport" size={64} color="white" style={{ marginBottom: 20 }} />
      <Text style={{ color: "white", fontSize: 24, fontWeight: "800", marginBottom: 20, letterSpacing: 2 }}>TRAVIA</Text>
      <ActivityIndicator size="large" color="white" />
    </View>
  );
}

export function RootNavigator() {
  const { token, role, loading: authLoading } = useContext(AuthContext);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem("@has_seen_onboarding");
        setShowOnboarding(value !== "true");
      } catch {
        setShowOnboarding(false);
      }
    };
    checkOnboarding();
  }, []);

  if (authLoading || showOnboarding === null) {
    return <BrandedLoader />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {showOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : null}
        
        {!token ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : role === "driver" ? (
          <Stack.Screen name="Driver" component={DriverNavigator} />
        ) : (
          <Stack.Screen name="Passenger" component={PassengerNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
