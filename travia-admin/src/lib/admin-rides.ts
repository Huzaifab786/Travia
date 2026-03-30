import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";
import type {
  AdminRideStatus,
  GetAdminRideDetailResponse,
  GetAdminRidesResponse,
} from "@/types/ride";

export async function fetchAdminRides(status?: AdminRideStatus) {
  const token = readAdminToken();

  if (!token) {
    throw new Error("Admin token not found");
  }

  const query = status ? `?status=${status}` : "";
  const response = await fetch(`${apiBaseUrl}/api/admin/rides${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | GetAdminRidesResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      ("message" in payload && payload.message) ||
        `Failed to fetch rides with status ${response.status}`
    );
  }

  return payload as GetAdminRidesResponse;
}

export async function fetchAdminRideDetail(rideId: string) {
  const token = readAdminToken();

  if (!token) {
    throw new Error("Admin token not found");
  }

  const response = await fetch(`${apiBaseUrl}/api/admin/rides/${rideId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | GetAdminRideDetailResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      ("message" in payload && payload.message) ||
        `Failed to fetch ride details with status ${response.status}`,
    );
  }

  return payload as GetAdminRideDetailResponse;
}