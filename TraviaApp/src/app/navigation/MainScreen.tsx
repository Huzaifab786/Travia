import React, { useContext } from "react";
import { View, Text, Pressable } from "react-native";
import { AuthContext } from "../providers/AuthProvider";

export function MainScreen() {
  const { setToken } = useContext(AuthContext);

  const onLogout = async () => {
    await setToken(null);
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>You are logged in ✅</Text>

      <Pressable
        onPress={onLogout}
        style={{
          backgroundColor: "black",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>Logout</Text>
      </Pressable>
    </View>
  );
}