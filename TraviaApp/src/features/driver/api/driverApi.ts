import { apiClient } from "../../../lib/api/client";

export type DriverStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

export type DriverDocumentCategory = "cnic" | "license" | "registration";
export type DriverDocumentSide = "front" | "back";
export type DriverVerificationDecision = "pending" | "approved" | "rejected";
export type DriverAdminDecision = "pending" | "approved" | "suspended";

export type DriverVerificationDocument = {
  id: string;
  category: DriverDocumentCategory | null;
  side: DriverDocumentSide | null;
  type: string;
  url: string;
  path: string | null;
  ocrResult: unknown;
  ocrStatus: DriverVerificationDecision;
  ocrReason: string | null;
  createdAt: string;
};

export type DriverVerification = {
  id: string;
  userId: string;
  autoDecision: DriverVerificationDecision;
  autoReason: string | null;
  autoResult: unknown;
  adminDecision: DriverAdminDecision;
  adminReason: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: DriverVerificationDocument[];
};

export const getDriverStatusApi = async (): Promise<{
  status: DriverStatus;
  rejectionReason?: string | null;
  verification?: DriverVerification | null;
}> => {
  return apiClient<{
    status: DriverStatus;
    rejectionReason?: string | null;
    verification?: DriverVerification | null;
  }>("/api/drivers/status");
};

export const uploadDriverDocumentsApi = async (
  documents: {
    category: DriverDocumentCategory;
    side: DriverDocumentSide;
    type: string;
    url: string;
    path: string;
  }[],
) => {
  return apiClient<{
    message: string;
    verification: DriverVerification | null;
  }>("/api/drivers/upload-documents", {
    method: "POST",
    body: JSON.stringify({ documents }),
  });
};
