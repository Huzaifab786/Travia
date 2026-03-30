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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMyVehicleApi, updateVehicleApi, Vehicle } from "../api/vehicleApi";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";

export function VehicleDetailsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [carModel, setCarModel] = useState("");
  const [carType, setCarType] = useState("");
  const [engineCC, setEngineCC] = useState("");
  const [avgKmPerLitre, setAvgKmPerLitre] = useState("12");
  const [fuelPricePerLitre, setFuelPricePerLitre] = useState("270");

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const res = await getMyVehicleApi();
        if (res.vehicle) {
          setCarModel(res.vehicle.carModel);
          setCarType(res.vehicle.carType || "");
          setEngineCC(res.vehicle.engineCC?.toString() || "");
          setAvgKmPerLitre(res.vehicle.avgKmPerLitre.toString());
          setFuelPricePerLitre(res.vehicle.fuelPricePerLitre.toString());
        }
      } catch (e: any) {
        Alert.alert("Error", "Failed to load vehicle details");
      } finally {
        setLoading(false);
      }
    };
    fetchVehicle();
  }, []);

  const onSave = async () => {
    if (!carModel || !avgKmPerLitre || !fuelPricePerLitre) {
      Alert.alert("Required", "Please fill in Model, Fuel Average, and Fuel Price.");
      return;
    }

    setSaving(true);
    try {
      await updateVehicleApi({
        carModel,
        carType,
        engineCC: engineCC ? Number(engineCC) : undefined,
        avgKmPerLitre: Number(avgKmPerLitre),
        fuelPricePerLitre: Number(fuelPricePerLitre),
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
            These details are used to calculate accurate per-seat costs based on fuel consumption.
          </Text>
        </View>

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

        <View style={s.row}>
          <View style={[s.section, { flex: 1 }]}>
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
          <View style={[s.section, { flex: 1 }]}>
            <Text style={s.label}>Fuel Price (Rs/L)</Text>
            <TextInput
              value={fuelPricePerLitre}
              onChangeText={setFuelPricePerLitre}
              placeholder="e.g. 270"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              style={s.input}
            />
          </View>
        </View>

        <View style={s.formulaCard}>
          <Text style={s.formulaTitle}>Cost Formula:</Text>
          <Text style={s.formulaText}>
            (Distance / Average) × Fuel Price ÷ (Seats + 1)
          </Text>
        </View>

        <Pressable
          onPress={onSave}
          disabled={saving}
          style={[s.saveBtn, saving && s.disabledBtn]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Details</Text>}
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
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: theme.successBg,
    },
    infoText: { flex: 1, ...typography.captionMedium, color: theme.success, lineHeight: 18 },
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
    row: { flexDirection: "row", gap: spacing.md },
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
    formulaText: { ...typography.bodyMedium, color: theme.textPrimary, fontStyle: "italic" },
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
