import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/app/providers/AuthProvider";
import { NotificationProvider } from "./src/app/providers/NotificationProvider";
import { ThemeProvider } from "./src/app/providers/ThemeProvider";
import { RootNavigator } from "./src/app/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <RootNavigator />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
