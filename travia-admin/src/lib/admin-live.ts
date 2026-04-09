import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";

export type AdminRideLiveLocation = {
  lat: number | null;
  lng: number | null;
  lastUpdate: string | null;
  status: string;
  isDeviated?: boolean;
  distanceFromRoute?: number | null;
  routeStatus?: "on_route" | "deviated";
};

export async function fetchAdminRideLiveLocation(rideId: string) {
  const token = readAdminToken();

  if (!token) {
    throw new Error("Admin token not found");
  }

  const response = await fetch(
    `${apiBaseUrl}/api/rides/${rideId}/location`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as
    | AdminRideLiveLocation
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      ("message" in payload && payload.message) ||
        `Failed to fetch live ride location with status ${response.status}`,
    );
  }

  return payload as AdminRideLiveLocation;
}
