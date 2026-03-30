import { apiClient } from "../../../lib/api/client";

export type Ride = {
  id: string;

  pickup: {
    address: string;
    lat: number;
    lng: number;
  };

  dropoff: {
    address: string;
    lat: number;
    lng: number;
  };

  departureTime: string;
  price: number;
  seatsTotal: number;
  status: "active" | "cancelled" | "completed";
  encodedPolyline?: string;

  driver: {
    id: string;
    name: string;
    email: string;
  };
};

export const getRidesApi = async () => {
  return apiClient<{ rides: Ride[] }>("/api/rides");
};

export const deleteRideApi = (rideId: string) => {
  return apiClient<{ deleted: boolean; rideId: string }>(`/api/rides/${rideId}`, {
    method: "DELETE",
  });
};

export const completeRideApi = (rideId: string) => {
  return apiClient<{ ride: Ride }>(`/api/rides/${rideId}/complete`, {
    method: "PATCH",
  });
};