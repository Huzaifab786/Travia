import { apiClient } from "../../../lib/api/client";

export type DriverStatus = "unverified" | "pending" | "verified" | "rejected";

export const getDriverStatusApi = async (): Promise<{
  status: DriverStatus;
  rejectionReason?: string | null;
}> => {
  return apiClient<{
    status: DriverStatus;
    rejectionReason?: string | null;
  }>("/api/drivers/status");
};

export const uploadDriverDocumentsApi = async (
  documents: { type: string; url: string; path: string }[]
) => {
  return apiClient<{ message: string }>("/api/drivers/upload-documents", {
    method: "POST",
    body: JSON.stringify({ documents }),
  });
};
