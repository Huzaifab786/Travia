import { apiClient } from "../../../lib/api/client";

export type DriverRide = {
  id: string;
  pickup: { address: string };
  dropoff: { address: string };
  departureTime: string;
  price: number;
  seatsTotal: number;
  seatsAvailable: number;
  status: "active" | "ready" | "in_progress" | "cancelled" | "completed";
  createdAt: string;

  analytics: {
    pendingCount: number;
    acceptedCount: number;
    rejectedCount: number;
    cancelledCount: number;
    acceptedSeats: number;
    totalBookings: number;
  };
};

export const cancelRideApi = (rideId: string) => {
  return apiClient<{ ride: DriverRide }>(`/api/rides/${rideId}/cancel`, {
    method: "PATCH",
  });
};

export const getMyRidesApi = () => {
  return apiClient<{ rides: DriverRide[] }>("/api/rides/me");
};