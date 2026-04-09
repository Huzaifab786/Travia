import React, { useContext, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator, Text } from "react-native";

import { AuthNavigator } from "../../features/auth/navigation/AuthNavigator";
import { AuthContext } from "../providers/AuthProvider";
import { PassengerNavigator } from "../../features/passenger/navigation/PassengerNavigator";
import { DriverNavigator } from "../../features/driver/navigation/DriverNavigator";
import { OnboardingScreen } from "../../features/onboarding/screens/OnboardingScreen";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../providers/ThemeProvider";

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Passenger: undefined;
  Driver: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function BrandedLoader() {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.primaryDark,
      }}
    >
      <Ionicons name="car-sport" size={64} color={theme.textInverse} style={{ marginBottom: 20 }} />
      <Text
        style={{
          color: theme.textInverse,
          fontSize: 24,
          fontWeight: "800",
          marginBottom: 20,
          letterSpacing: 2,
        }}
      >
        TRAVIA
      </Text>
      <ActivityIndicator size="large" color={theme.textInverse} />
    </View>
  );
}

export function RootNavigator() {
  const { token, role, loading: authLoading } = useContext(AuthContext);
  const [showOnboarding, setShowOnboarding] = useState(true);

  const OnboardingScreenWrapper = () => (
    <OnboardingScreen onDone={() => setShowOnboarding(false)} />
  );

  if (authLoading) {
    return <BrandedLoader />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {showOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreenWrapper} />
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
