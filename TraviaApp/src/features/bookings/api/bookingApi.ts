import { apiClient } from "../../../lib/api/client";

export type Booking = {
  id: string;
  ride: any; // Simplified for typing, will be reshaped in service
  passenger: string;
  seatsRequested: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
};

export const createBookingApi = (payload: {
  rideId: string;
  seatsRequested: number;
}) => {
  return apiClient<{ booking: Booking }>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getMyBookingForRideApi = (rideId: string) => {
  return apiClient<{ booking: Booking | null }>(`/api/bookings/ride/${rideId}`);
};

export const getMyBookingsApi = () => {
  return apiClient<{ bookings: Booking[] }>("/api/bookings/me");
};

export const deleteBookingApi = (bookingId: string) => {
  return apiClient<{ deleted: boolean; bookingId: string }>(`/api/bookings/${bookingId}`, {
    method: "DELETE",
  });
};