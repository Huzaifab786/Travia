import { apiClient } from "../../../lib/api/client";

export type DriverStatus = "unverified" | "pending" | "verified" | "rejected";

export const getDriverStatusApi = async (): Promise<{ status: DriverStatus }> => {
  return apiClient<{ status: DriverStatus }>("/api/drivers/status");
};

export const uploadDriverDocumentsApi = async (documents: { type: string; url: string }[]) => {
  return apiClient<{ message: string }>("/api/drivers/upload-documents", {
    method: "POST",
    body: JSON.stringify({ documents }),
  });
};
