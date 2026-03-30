import { apiClient } from "../../../lib/api/client";

export type PassengerBooking = {
  id: string;
  seatsRequested: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  ride: {
    id: string;
    pickup: { address: string };
    dropoff: { address: string };
    departureTime: string;
    price: number;
    driver: {
      name: string;
      email: string;
    };
  };
};

export const getMyBookingsApi = () => {
  return apiClient<{ bookings: PassengerBooking[] }>("/api/bookings/me");
};

export const cancelMyBookingApi = (bookingId: string) => {
  return apiClient<{ booking: PassengerBooking }>(`/api/bookings/${bookingId}/cancel`, {
    method: "PATCH",
  });
};

export const deleteBookingApi = (bookingId: string) => {
  return apiClient<{ deleted: boolean; bookingId: string }>(`/api/bookings/${bookingId}`, {
    method: "DELETE",
  });
};