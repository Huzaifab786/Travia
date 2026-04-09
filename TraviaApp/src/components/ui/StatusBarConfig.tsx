import React, { useEffect } from "react";
import { StatusBar, StatusBarStyle, Platform } from "react-native";
import { useTheme } from "../../app/providers/ThemeProvider";
import { useIsFocused } from "@react-navigation/native";

interface StatusBarConfigProps {
  barStyle?: StatusBarStyle;
  backgroundColor?: string;
  translucent?: boolean;
}

export function StatusBarConfig({
  barStyle,
  backgroundColor,
  translucent = true,
}: StatusBarConfigProps) {
  const { theme, isDark } = useTheme();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;

    const finalBarStyle =
      barStyle || (isDark ? "light-content" : "dark-content");
    const finalBgColor = backgroundColor || theme.background;

    StatusBar.setBarStyle(finalBarStyle, true);
    if (Platform.OS === "android") {
      StatusBar.setBackgroundColor(finalBgColor, false);
      StatusBar.setTranslucent(translucent);
    }
  }, [isFocused, barStyle, backgroundColor, isDark, theme.background, translucent]);

  return null;
}