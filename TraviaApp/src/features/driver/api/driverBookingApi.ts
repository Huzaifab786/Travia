import { apiClient } from "../../../lib/api/client";
import type { BookingQuote } from "../../bookings/api/bookingApi";
import type { PlaceSuggestion } from "./placeApi";

export type DriverBookingRequest = {
  id: string;
  seatsRequested: number;
  meetupPoint?: {
    id: string;
    label: string;
    lat: number;
    lng: number;
    address?: string;
    order?: number;
  } | null;
  passengerPickup?: PlaceSuggestion | null;
  passengerDropoff?: PlaceSuggestion | null;
  pricingQuote?: BookingQuote | null;
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
    meetupPoints?: Array<{
      id: string;
      label: string;
      lat: number;
      lng: number;
      order: number;
    }> | null;
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
