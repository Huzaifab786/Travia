import { apiClient } from "../../../lib/api/client";
import { Ride } from "../../passenger/api/rideApi";

export const getDriverRidesApi = () => {
  return apiClient<{ rides: Ride[] }>("/api/rides/me");
};

export const completeRideApi = (rideId: string) => {
  return apiClient<{ ride: Ride }>(`/api/rides/${rideId}/complete`, {
    method: "PATCH",
  });
};

export const startRideApi = (rideId: string) => {
  return apiClient<{ ride: Ride }>(`/api/rides/${rideId}/start`, {
    method: "PATCH",
  });
};

export const deleteRideApi = (rideId: string) => {
  return apiClient<{ deleted: boolean; rideId: string }>(`/api/rides/${rideId}`, {
    method: "DELETE",
  });
};

export const createRideApi = (payload: {
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  departureTime: string;
  seatsTotal: number;
  notes: string;
  femaleOnly?: boolean;
  checkpointCount?: number;
  selectedRouteIndex?: number;
  manualMeetupPoints?: Array<{
    label: string;
    address?: string;
    lat: number;
    lng: number;
    order?: number;
  }>;
}) => {
  return apiClient<{ ride: Ride }>("/api/rides", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};
