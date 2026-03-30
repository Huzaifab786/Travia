import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { supabase } from "../../../config/supabaseClient";
import { getDriverStatusApi, uploadDriverDocumentsApi, DriverStatus } from "../api/driverApi";
import { useNavigation } from "@react-navigation/native";

export function DriverVerificationScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [status, setStatus] = useState<DriverStatus>("unverified");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Document states
  const [cnic, setCnic] = useState<string | null>(null);
  const [license, setLicense] = useState<string | null>(null);
  const [registration, setRegistration] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await getDriverStatusApi();
      setStatus(res.status);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (type: "cnic" | "license" | "registration") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "We need access to your gallery to upload documents.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (type === "cnic") setCnic(uri);
      else if (type === "license") setLicense(uri);
      else if (type === "registration") setRegistration(registration === uri ? null : uri);
      // Fixed logic:
      if (type === "cnic") setCnic(uri);
      if (type === "license") setLicense(uri);
      if (type === "registration") setRegistration(uri);
    }
  };

  const uploadToSupabase = async (uri: string, path: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const fileName = `${Date.now()}-${path.split("/").pop()}`;
    const filePath = `verification/${fileName}`;

    const { data, error } = await supabase.storage
      .from("documents")
      .upload(filePath, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const onSubmit = async () => {
    if (!cnic || !license || !registration) {
      Alert.alert("Missing Documents", "Please upload all three documents to proceed.");
      return;
    }

    try {
      setUploading(true);
      const cnicUrl = await uploadToSupabase(cnic, "cnic");
      const licenseUrl = await uploadToSupabase(license, "license");
      const registrationUrl = await uploadToSupabase(registration, "registration");

      await uploadDriverDocumentsApi([
        { type: "cnic", url: cnicUrl },
        { type: "license", url: licenseUrl },
        { type: "registration", url: registrationUrl },
      ]);

      Alert.alert("Success", "Documents submitted for verification.");
      fetchStatus();
    } catch (e: any) {
      Alert.alert("Upload Failed", e.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  const s = makeStyles(theme);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (status === "pending") {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}>
          <Ionicons name="time-outline" size={80} color={theme.amber} />
          <Text style={s.statusTitle}>Verification Pending</Text>
          <Text style={s.statusDesc}>
            Our team is reviewing your documents. This usually takes 24-48 hours.
          </Text>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "verified") {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}>
          <Ionicons name="checkmark-circle-outline" size={80} color={theme.success} />
          <Text style={s.statusTitle}>Verified Driver</Text>
          <Text style={s.statusDesc}>
            Account verified. You can now create rides and pick up passengers!
          </Text>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.title}>Driver Verification</Text>
        </View>

        <Text style={s.subtitle}>
          To ensure safety, we require all drivers to verify their identity and vehicle.
        </Text>

        {status === "rejected" && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={20} color={theme.danger} />
            <Text style={s.errorText}>Previous submission was rejected. Please re-upload clear documents.</Text>
          </View>
        )}

        <DocPicker
          label="CNIC (Front & Back)"
          onPress={() => pickImage("cnic")}
          uri={cnic}
          theme={theme}
        />
        <DocPicker
          label="Driving License"
          onPress={() => pickImage("license")}
          uri={license}
          theme={theme}
        />
        <DocPicker
          label="Car Registration (Smart Card/V5C)"
          onPress={() => pickImage("registration")}
          uri={registration}
          theme={theme}
        />

        <View style={{ marginTop: spacing.xl }}>
          <Pressable
            style={[s.submitBtn, uploading && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitText}>Submit for Review</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocPicker({ label, onPress, uri, theme }: any) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...typography.bodySemiBold, color: theme.textPrimary, marginBottom: 8 }}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={{
          height: 160,
          borderRadius: radius.md,
          backgroundColor: theme.surfaceElevated,
          borderWidth: 2,
          borderColor: theme.border,
          borderStyle: "dashed",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={{ alignItems: "center" }}>
            <Ionicons name="cloud-upload-outline" size={32} color={theme.textMuted} />
            <Text style={{ ...typography.caption, color: theme.textMuted, marginTop: 4 }}>Tap to upload</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { padding: spacing.xl },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
    iconBtn: { width: 40, height: 40, justifyContent: "center" },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: { ...typography.body, color: theme.textMuted, marginBottom: spacing.xl },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing["2xl"] },
    statusTitle: { ...typography.h2, color: theme.textPrimary, marginTop: spacing.xl },
    statusDesc: { ...typography.body, color: theme.textSecondary, textAlign: "center", marginTop: spacing.md },
    backBtn: { marginTop: spacing["2xl"], paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: theme.primary, borderRadius: radius.md },
    backBtnText: { ...typography.bodySemiBold, color: "#fff" },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.dangerBg, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
    errorText: { ...typography.caption, color: theme.danger, flex: 1 },
    submitBtn: { backgroundColor: theme.primary, paddingVertical: 16, borderRadius: radius.lg, alignItems: "center" },
    submitText: { ...typography.bodySemiBold, color: "#fff" },
  });
}
