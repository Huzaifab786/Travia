import { apiClient } from "../../../lib/api/client";

export type CreateRideIncidentPayload = {
  rideId?: string;
  kind: "sos" | "report";
  category?: string;
  severity?: "low" | "medium" | "high" | "critical";
  message: string;
  locationLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reportedUserId?: string | null;
};

export const createRideIncidentApi = (
  payload: CreateRideIncidentPayload,
) => {
  return apiClient<{ incident: { id: string } }>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};
