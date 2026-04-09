import React, { useEffect, useMemo, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { radius, spacing, typography } from "../../../config/theme";
import { supabase } from "../../../config/supabaseClient";
import {
  getDriverStatusApi,
  uploadDriverDocumentsApi,
  type DriverDocumentCategory,
  type DriverDocumentSide,
  type DriverStatus,
  type DriverVerification,
} from "../api/driverApi";

type DocKey =
  | "cnicFront"
  | "cnicBack"
  | "licenseFront"
  | "licenseBack"
  | "registrationFront"
  | "registrationBack";

type DocConfig = {
  key: DocKey;
  label: string;
  category: DriverDocumentCategory;
  side: DriverDocumentSide;
  helper: string;
};

const DOCUMENTS: DocConfig[] = [
  {
    key: "cnicFront",
    label: "CNIC Front",
    category: "cnic",
    side: "front",
    helper: "Front side with photo and number.",
  },
  {
    key: "cnicBack",
    label: "CNIC Back",
    category: "cnic",
    side: "back",
    helper: "Back side with address details.",
  },
  {
    key: "licenseFront",
    label: "Driving License Front",
    category: "license",
    side: "front",
    helper: "Front side with license details.",
  },
  {
    key: "licenseBack",
    label: "Driving License Back",
    category: "license",
    side: "back",
    helper: "Back side with restrictions or validity.",
  },
  {
    key: "registrationFront",
    label: "Registration Card Front",
    category: "registration",
    side: "front",
    helper: "Front side of the vehicle registration card.",
  },
  {
    key: "registrationBack",
    label: "Registration Card Back",
    category: "registration",
    side: "back",
    helper: "Back side of the vehicle registration card.",
  },
];

const INITIAL_DOC_STATE: Record<DocKey, string | null> = {
  cnicFront: null,
  cnicBack: null,
  licenseFront: null,
  licenseBack: null,
  registrationFront: null,
  registrationBack: null,
};

export function DriverVerificationScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [status, setStatus] = useState<DriverStatus>("unverified");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [verification, setVerification] = useState<DriverVerification | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [documents, setDocuments] = useState<Record<DocKey, string | null>>(
    INITIAL_DOC_STATE,
  );

  useEffect(() => {
    fetchStatus();
  }, []);

  const documentCompleteCount = useMemo(
    () => DOCUMENTS.filter((item) => documents[item.key]).length,
    [documents],
  );

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await getDriverStatusApi();
      setStatus(res.status);
      setRejectionReason(res.rejectionReason || null);
      setVerification(res.verification || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (key: DocKey) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "We need access to your gallery to upload documents.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.75,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setDocuments((prev) => ({ ...prev, [key]: uri }));
    }
  };

  const uploadToSupabase = async (uri: string, fileNameSeed: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const fileName = `${Date.now()}-${fileNameSeed}.jpg`;
    const filePath = `verification/${fileName}`;

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

  const onSubmit = async () => {
    const missing = DOCUMENTS.filter((item) => !documents[item.key]);

    if (missing.length > 0) {
      Alert.alert(
        "Missing Documents",
        "Please upload all six document images before submitting.",
      );
      return;
    }

    try {
      setUploading(true);

      const uploads = await Promise.all(
        DOCUMENTS.map(async (doc) => {
          const upload = await uploadToSupabase(
            documents[doc.key] as string,
            doc.key,
          );

          return {
            category: doc.category,
            side: doc.side,
            type: `${doc.category}_${doc.side}`,
            url: upload.url,
            path: upload.path,
          };
        }),
      );

      const response = await uploadDriverDocumentsApi(uploads);
      setVerification(response.verification || null);
      setRejectionReason(null);

      Alert.alert("Success", response.message || "Documents submitted.");
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
            {verification?.autoDecision === "approved"
              ? "AI review is done. An admin will review the result before final approval."
              : "Our system is reviewing your documents. This usually takes a few moments."}
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
          <Ionicons
            name="checkmark-circle-outline"
            size={80}
            color={theme.success}
          />
          <Text style={s.statusTitle}>Verified Driver</Text>
          <Text style={s.statusDesc}>
            Your account is verified. You can now create rides and pick up
            passengers.
          </Text>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "suspended") {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}>
          <Ionicons name="ban-outline" size={80} color={theme.danger} />
          <Text style={s.statusTitle}>Account Suspended</Text>
          <Text style={s.statusDesc}>
            {rejectionReason ||
              "An admin has suspended your driver account. Please contact support."}
          </Text>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const showReviewCard =
    verification?.autoDecision || verification?.adminDecision;

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.title}>Driver Verification</Text>
        </View>

        <Pressable onPress={() => setShowTips((value) => !value)} style={s.tipsToggle}>
          <View>
            <Text style={s.tipsTitle}>Verification Tips</Text>
            <Text style={s.tipsSubtitle}>
              Upload clear front and back images for each document
            </Text>
          </View>
          <Ionicons
            name={showTips ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.textSecondary}
          />
        </Pressable>

        {showTips && (
          <View style={s.tipsCard}>
            <TipItem
              theme={theme}
              text="CNIC: upload both sides. Make sure the name, CNIC number, and address are readable."
            />
            <TipItem
              theme={theme}
              text="Driving license: upload both sides. The license number, name, and expiry date should be clear."
            />
            <TipItem
              theme={theme}
              text="Registration card: upload both sides of the smart card or registration card. Vehicle number, owner name, make, and model should be visible."
            />
            <TipItem
              theme={theme}
              text="Use a flat surface, avoid glare and blur, and keep all corners inside the frame."
            />
          </View>
        )}

        <Text style={s.subtitle}>
          Upload the front and back of your CNIC, driving license, and vehicle
          registration card. The AI will give you a clear reason if anything is
          missing or unclear.
        </Text>

        {status === "rejected" && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={20} color={theme.danger} />
            <View style={{ flex: 1 }}>
              <Text style={s.errorText}>
                {rejectionReason ||
                  "Your previous submission was rejected. Please upload clearer documents."}
              </Text>
            </View>
          </View>
        )}

        {showReviewCard ? (
          <View style={s.reviewCard}>
            <View style={s.reviewRow}>
              <View style={s.reviewBadge}>
                <Text style={s.reviewBadgeText}>
                  AI: {verification?.autoDecision || "pending"}
                </Text>
              </View>
              <View style={s.reviewBadge}>
                <Text style={s.reviewBadgeText}>
                  Admin: {verification?.adminDecision || "pending"}
                </Text>
              </View>
            </View>

            {verification?.autoReason ? (
              <Text style={s.reviewText}>
                AI note: {verification.autoReason}
              </Text>
            ) : null}

            {verification?.adminReason ? (
              <Text style={s.reviewText}>
                Admin note: {verification.adminReason}
              </Text>
            ) : null}
          </View>
        ) : null}

        {verification?.documents?.length ? (
          <View style={s.docReviewCard}>
            <Text style={s.docReviewTitle}>Document Review</Text>
            <Text style={s.docReviewSubtitle}>
              This section shows which document is fine and which one needs a
              better upload.
            </Text>

            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {verification.documents.map((doc) => (
                <View key={doc.id} style={s.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docName}>
                      {(doc.category || "document").toUpperCase()}{" "}
                      {doc.side ? `(${doc.side})` : ""}
                    </Text>
                    <Text style={s.docReason}>
                      {doc.ocrReason || "Looks good"}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.docBadge,
                      doc.ocrStatus === "approved"
                        ? { backgroundColor: theme.successBg, borderColor: theme.success + "33" }
                        : { backgroundColor: theme.dangerBg, borderColor: theme.danger + "33" },
                    ]}
                  >
                    <Text
                      style={[
                        s.docBadgeText,
                        { color: doc.ocrStatus === "approved" ? theme.success : theme.danger },
                      ]}
                    >
                      {doc.ocrStatus}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={s.progressCard}>
          <Text style={s.progressLabel}>Document progress</Text>
          <Text style={s.progressValue}>
            {documentCompleteCount}/{DOCUMENTS.length} uploaded
          </Text>
        </View>

        {DOCUMENTS.map((doc) => (
          <DocPicker
            key={doc.key}
            label={doc.label}
            helper={doc.helper}
            onPress={() => pickImage(doc.key)}
            uri={documents[doc.key]}
            theme={theme}
          />
        ))}

        <View style={{ marginTop: spacing.xl }}>
          <Pressable
            style={[s.submitBtn, uploading && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitText}>Submit for AI Review</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocPicker({
  label,
  helper,
  onPress,
  uri,
  theme,
}: {
  label: string;
  helper: string;
  onPress: () => void;
  uri: string | null;
  theme: any;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        style={{
          ...typography.bodySemiBold,
          color: theme.textPrimary,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...typography.caption,
          color: theme.textMuted,
          marginBottom: 8,
        }}
      >
        {helper}
      </Text>
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
          <View style={{ alignItems: "center", paddingHorizontal: spacing.lg }}>
            <Ionicons
              name="cloud-upload-outline"
              size={32}
              color={theme.textMuted}
            />
            <Text
              style={{
                ...typography.caption,
                color: theme.textMuted,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Tap to upload
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function TipItem({ theme, text }: { theme: any; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
      <Text style={{ ...typography.caption, color: theme.textSecondary, flex: 1, lineHeight: 18 }}>
        {text}
      </Text>
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { padding: spacing.xl },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    iconBtn: { width: 40, height: 40, justifyContent: "center" },
    title: { ...typography.h1, color: theme.textPrimary },
    subtitle: {
      ...typography.body,
      color: theme.textMuted,
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing["2xl"],
    },
    statusTitle: {
      ...typography.h2,
      color: theme.textPrimary,
      marginTop: spacing.xl,
      textAlign: "center",
    },
    statusDesc: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 22,
    },
    backBtn: {
      marginTop: spacing["2xl"],
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      backgroundColor: theme.primary,
      borderRadius: radius.md,
    },
    backBtnText: { ...typography.bodySemiBold, color: "#fff" },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: theme.dangerBg,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.lg,
    },
    errorText: {
      ...typography.caption,
      color: theme.danger,
      flex: 1,
      lineHeight: 18,
    },
    reviewCard: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    reviewRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    reviewBadge: {
      backgroundColor: theme.surface,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    reviewBadgeText: {
      ...typography.captionMedium,
      color: theme.textSecondary,
      textTransform: "capitalize",
    },
    reviewText: {
      ...typography.caption,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    tipsToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: spacing.md,
    },
    tipsTitle: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    tipsSubtitle: {
      ...typography.caption,
      color: theme.textMuted,
      marginTop: 2,
    },
    tipsCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    docReviewCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    docReviewTitle: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    docReviewSubtitle: {
      ...typography.caption,
      color: theme.textMuted,
      marginTop: 2,
    },
    docRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    docName: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    docReason: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    docBadge: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    docBadgeText: {
      ...typography.captionMedium,
      textTransform: "capitalize",
    },
    progressCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressLabel: {
      ...typography.caption,
      color: theme.textMuted,
    },
    progressValue: {
      ...typography.bodySemiBold,
      color: theme.textPrimary,
    },
    submitBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: radius.lg,
      alignItems: "center",
    },
    submitText: { ...typography.bodySemiBold, color: "#fff" },
  });
}
