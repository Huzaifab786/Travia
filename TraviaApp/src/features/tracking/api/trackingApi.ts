import { apiClient } from "../../../lib/api/client";

/** Driver pushes their live GPS position every ~15 seconds */
export const updateLocationApi = async (
  rideId: string,
  lat: number,
  lng: number
): Promise<{
  lat: number;
  lng: number;
}> => {
  return apiClient(`/api/rides/${rideId}/location`, {
    method: "PATCH",
    body: JSON.stringify({ lat, lng }),
  });
};

/** Passenger polls driver's current position */
export const getDriverLocationApi = async (
  rideId: string
): Promise<{
  lat: number | null;
  lng: number | null;
  lastUpdate: string | null;
  status: string;
}> => {
  return apiClient(`/api/rides/${rideId}/location`);
};
