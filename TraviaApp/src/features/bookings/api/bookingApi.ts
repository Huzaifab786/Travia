import { apiClient } from "../../../lib/api/client";
import type { PlaceSuggestion } from "../../driver/api/placeApi";

export type BookingQuote = {
  pickup: PlaceSuggestion;
  dropoff: PlaceSuggestion;
  routeLengthKm: number;
  segmentDistanceKm: number;
  routeDeviationKm: number;
  totalTravelers: number;
  fuelAverage: number;
  fuelPricePerLitre: number;
  totalFuelCost: number;
  sharedPricePerSeat: number;
  minimumFare: number;
  finalPrice: number;
  pickupDistanceKm: number;
  dropoffDistanceKm: number;
  pickupRouteRatio: number | null;
  dropoffRouteRatio: number | null;
  totalPrice: number;
  perSeatPrice: number;
};

export type Booking = {
  id: string;
  ride: any; // Simplified for typing, will be reshaped in service
  passenger: string;
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
};

export const createBookingApi = (payload: {
  rideId: string;
  seatsRequested: number;
  meetupPoint?: {
    id: string;
    label: string;
    lat: number;
    lng: number;
    address?: string;
    order?: number;
  } | null;
  passengerPickup: PlaceSuggestion;
  passengerDropoff: PlaceSuggestion;
}) => {
  return apiClient<{ booking: Booking }>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const quoteBookingApi = (payload: {
  rideId: string;
  seatsRequested: number;
  passengerPickup: PlaceSuggestion;
  passengerDropoff: PlaceSuggestion;
}) => {
  return apiClient<{ quote: BookingQuote }>("/api/bookings/quote", {
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
