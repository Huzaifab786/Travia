import { apiClient } from "../../../lib/api/client";

export type DriverBookingRequest = {
  id: string;
  seatsRequested: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  passenger: {
    name: string;
    email: string;
  };
  ride: {
    id: string;
    pickup: { address: string };
    dropoff: { address: string };
    departureTime: string;
    price: number;
  };
};

export const getDriverRequestsApi = () => {
  return apiClient<{ bookings: DriverBookingRequest[] }>(
    "/api/bookings/driver/requests"
  );
};

export const updateBookingStatusApi = (bookingId: string, action: "accept" | "reject") => {
  return apiClient<{ booking: DriverBookingRequest }>(`/api/bookings/${bookingId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
};