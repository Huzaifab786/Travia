import { apiClient } from "../../../lib/api/client";

export type RoutePoint = {
  lat: number;
  lng: number;
};

export type RideRouteResponse = {
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
};

export type RouteAlternative = RideRouteResponse & {
  id: string;
  label: string;
};

export const getRideRouteApi = async (rideId: string) => {
  return apiClient<RideRouteResponse>(`/api/routes/ride/${rideId}`);
};

export const previewRouteApi = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
) => {
  return apiClient<{
    route: RouteAlternative;
    routes: RouteAlternative[];
  }>(
    `/api/routes/preview?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`,
  );
};
