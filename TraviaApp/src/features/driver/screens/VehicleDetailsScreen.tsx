import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getMyVehicleApi, updateVehicleApi } from "../api/vehicleApi";
import {
  getPricingSettingsApi,
  PricingSettings,
} from "../../pricing/api/pricingApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { supabase } from "../../../config/supabaseClient";

export function VehicleDetailsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [carModel, setCarModel] = useState("");
  const [carType, setCarType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [engineCC, setEngineCC] = useState("");
  const [avgKmPerLitre, setAvgKmPerLitre] = useState("12");
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [carImageUri, setCarImageUri] = useState<string | null>(null);
  const [carImageUrl, setCarImageUrl] = useState<string | null>(null);
  const [carImagePath, setCarImagePath] = useState<string | null>(null);

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const res = await getMyVehicleApi();
        if (res.vehicle) {
          setCarModel(res.vehicle.carModel);
          setCarType(res.vehicle.carType || "");
          setVehicleNumber(res.vehicle.vehicleNumber || "");
          setEngineCC(res.vehicle.engineCC?.toString() || "");
          setAvgKmPerLitre(res.vehicle.avgKmPerLitre.toString());
          setCarImageUrl(res.vehicle.carImageUrl || null);
          setCarImagePath(res.vehicle.carImagePath || null);
        }

        try {
          const pricingRes = await getPricingSettingsApi();
          setPricing(pricingRes.pricingSettings);
        } catch {
          setPricing(null);
        }
      } catch (e: any) {
        Alert.alert("Error", "Failed to load vehicle details");
      } finally {
        setLoading(false);
      }
    };

    fetchVehicle();
  }, []);

  const pickCarImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "We need gallery access to upload a car photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setCarImageUri(result.assets[0].uri);
    }
  };

  const uploadCarImage = async (uri: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const fileName = `${Date.now()}-vehicle.jpg`;
    const filePath = `vehicles/${fileName}`;

    const { error } = await supabase.storage.from("documents").upload(
      filePath,
      arrayBuffer,
      {
        contentType: "image/jpeg",
        upsert: false,
      },
    );

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(filePath);

    return {
      url: publicUrl,
      path: filePath,
    };
  };

  const onSave = async () => {
    if (!carModel || !vehicleNumber || !avgKmPerLitre) {
      Alert.alert(
        "Required",
        "Please fill in Model, Vehicle Number, and Fuel Average.",
      );
      return;
    }

    setSaving(true);
    try {
      let uploadedImageUrl = carImageUrl;
      let uploadedImagePath = carImagePath;

      if (carImageUri) {
        const upload = await uploadCarImage(carImageUri);
        uploadedImageUrl = upload.url;
        uploadedImagePath = upload.path;
      }

      await updateVehicleApi({
        carModel,
        carType,
        vehicleNumber,
        engineCC: engineCC ? Number(engineCC) : undefined,
        avgKmPerLitre: Number(avgKmPerLitre),
        carImageUrl: uploadedImageUrl,
        carImagePath: uploadedImagePath,
      });
      Alert.alert("Success", "Vehicle details saved successfully!");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Save Failed", e.message || "An error occurred");
    } finally {
      setSaving(false);
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

  const imagePreview = carImageUri || carImageUrl;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Vehicle Details</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.infoCard}>
          <Ionicons name="information-circle" size={20} color={theme.primary} />
          <Text style={s.infoText}>
            Add your Pakistan vehicle number plate and a clear car photo so passengers and admin can identify your car easily.
          </Text>
        </View>

        <Pressable onPress={pickCarImage} style={s.imageCard}>
          {imagePreview ? (
            <Image source={{ uri: imagePreview }} style={s.imagePreview} />
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="camera-outline" size={28} color={theme.textMuted} />
              <Text style={s.imagePlaceholderText}>Tap to upload car photo</Text>
            </View>
          )}
          <View style={s.imageOverlay}>
            <Text style={s.imageOverlayText}>
              {imagePreview ? "Change car photo" : "Upload car photo"}
            </Text>
          </View>
        </Pressable>

        <View style={s.section}>
          <Text style={s.label}>Car Model</Text>
          <TextInput
            value={carModel}
            onChangeText={setCarModel}
            placeholder="e.g. Honda Civic 2022"
            placeholderTextColor={theme.textMuted}
            style={s.input}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Vehicle Number / Plate</Text>
          <TextInput
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            placeholder="e.g. LEA-1234 or BKC-123"
            placeholderTextColor={theme.textMuted}
            style={s.input}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Car Type (Optional)</Text>
          <TextInput
            value={carType}
            onChangeText={setCarType}
            placeholder="e.g. Sedan, SUV"
            placeholderTextColor={theme.textMuted}
            style={s.input}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Engine CC (Optional)</Text>
          <TextInput
            value={engineCC}
            onChangeText={setEngineCC}
            placeholder="e.g. 1300"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            style={s.input}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Avg KM/Litre</Text>
          <TextInput
            value={avgKmPerLitre}
            onChangeText={setAvgKmPerLitre}
            placeholder="e.g. 12"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            style={s.input}
          />
        </View>

        <View style={s.formulaCard}>
          <Text style={s.formulaTitle}>Cost Formula</Text>
          <Text style={s.formulaText}>
            Shared per-seat fare = (Distance km / Avg km/litre) x Admin fuel price / total riders
          </Text>
          <Text style={s.formulaNote}>
            Fuel price is managed by the admin and applies to every new ride.
            No service fee is added right now, so passengers only pay the shared ride cost.
          </Text>
          <Text style={s.formulaNote}>
            Current admin fuel price: {pricing ? `Rs ${pricing.fuelPricePerLitre}/L` : "Loading..."}
          </Text>
        </View>

        <Pressable
          onPress={onSave}
          disabled={saving}
          style={[s.saveBtn, saving && s.disabledBtn]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>Save Details</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: { padding: 4, marginRight: spacing.sm },
    headerTitle: { ...typography.h3, color: theme.textPrimary },
    content: { padding: spacing.xl },
    infoCard: {
      flexDirection: "row",
      backgroundColor: theme.successBg,
      padding: spacing.md,
      borderRadius: radius.md,
      gap: 10,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: theme.successBg,
    },
    infoText: { flex: 1, ...typography.captionMedium, color: theme.success, lineHeight: 18 },
    imageCard: {
      height: 190,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: spacing.xl,
      justifyContent: "center",
      alignItems: "center",
    },
    imagePreview: { width: "100%", height: "100%" },
    imagePlaceholder: {
      alignItems: "center",
      gap: 8,
    },
    imagePlaceholderText: { ...typography.bodyMedium, color: theme.textMuted },
    imageOverlay: {
      position: "absolute",
      bottom: 12,
      right: 12,
      backgroundColor: "rgba(15,23,42,0.75)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
    },
    imageOverlayText: { ...typography.captionMedium, color: "#fff" },
    section: { marginBottom: spacing.lg },
    label: { ...typography.bodyMedium, color: theme.textPrimary, marginBottom: spacing.sm },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      ...typography.body,
      color: theme.textPrimary,
    },
    formulaCard: {
      backgroundColor: theme.background,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: 30,
      borderStyle: "dashed",
      borderWidth: 1,
      borderColor: theme.border,
    },
    formulaTitle: { ...typography.label, color: theme.textSecondary, marginBottom: 4 },
    formulaText: { ...typography.bodyMedium, color: theme.textPrimary, lineHeight: 22 },
    formulaNote: {
      ...typography.caption,
      color: theme.textMuted,
      marginTop: 6,
      lineHeight: 18,
    },
    saveBtn: {
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    saveBtnText: { color: "#fff", ...typography.h4 },
    disabledBtn: { opacity: 0.7 },
  });
}
