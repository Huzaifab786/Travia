import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { RoleSelectScreen } from "../screens/RoleSelectScreen";
import { VerifyOtpScreen } from "../screens/VerifyOtpScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { ResetPasswordScreen } from "../screens/ResetPasswordScreen";

export type AuthStackParamList = {
  RoleSelect: undefined;
  Login: { role: "passenger" | "driver" };
  Register: { role: "passenger" | "driver" };
  VerifyOtp: { 
    email: string; 
    type: "signup" | "recovery"; 
    role?: "passenger" | "driver"; 
    name?: string; 
    phone?: string 
  };
  ForgotPassword: { role: "passenger" | "driver" };
  ResetPassword: { email: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}