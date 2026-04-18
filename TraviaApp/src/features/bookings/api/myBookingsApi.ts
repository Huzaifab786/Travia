import { apiClient } from "../../../lib/api/client";
import type { BookingQuote } from "./bookingApi";
import type { PlaceSuggestion } from "../../driver/api/placeApi";

export type PassengerBooking = {
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
  hasReviewed?: boolean;
  review?: {
    rideId: string;
    revieweeId: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
  } | null;
  ride: {
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
    status: "active" | "ready" | "in_progress" | "cancelled" | "completed";
    encodedPolyline?: string | null;
    meetupPoints?: Array<{
      id: string;
      label: string;
      lat: number;
      lng: number;
      order: number;
    }> | null;
    driver: {
      name: string;
      email: string;
      phone?: string | null;
    };
  };
};

export const getMyBookingsApi = () => {
  return apiClient<{ bookings: PassengerBooking[] }>("/api/bookings/me");
};

export const cancelMyBookingApi = (bookingId: string) => {
  return apiClient<{ booking: PassengerBooking }>(
    `/api/bookings/${bookingId}/cancel`,
    {
      method: "PATCH",
    },
  );
};

export const deleteBookingApi = (bookingId: string) => {
  return apiClient<{ deleted: boolean; bookingId: string }>(
    `/api/bookings/${bookingId}`,
    {
      method: "DELETE",
    },
  );
};
