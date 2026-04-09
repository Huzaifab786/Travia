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
  femaleOnly?: boolean;
  seatsAvailable?: number;
  status: "active" | "ready" | "in_progress" | "cancelled" | "completed";
  encodedPolyline?: string;
  meetupPoints?: Array<{
    id: string;
    label: string;
    address?: string | null;
    lat: number;
    lng: number;
    order: number;
    routeRatio?: number;
    distanceFromStartKm?: number;
    maxDistanceFromStartKm?: number;
    placeName?: string | null;
  }> | null;
  sharedRouteRide?: boolean;
  routeProximityKm?: number | null;

  smartScore?: number;
  matchLabel?: "Best Match" | "Good Match" | "Fair Match";
  pickupDistanceKm?: number | null;
  dropoffDistanceKm?: number | null;

  driver: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avgRating?: number | null;
    totalReviews?: number;
  };
  acceptedBookings?: Array<{
    id: string;
    passengerId?: string;
    seatsRequested: number;
    meetupPoint?: {
      id: string;
      label: string;
      lat: number;
      lng: number;
      address?: string | null;
      order?: number;
      source?: string;
    } | null;
    passenger?: {
      id: string;
      name: string;
      phone?: string | null;
      email?: string | null;
    };
  }>;
  fareBreakdown?: {
    distanceKm: number;
    avgKmPerLitre: number;
    fuelPricePerLitre: number;
    totalFuelCost: number;
    totalTravelers: number;
    sharedPricePerSeat: number;
    minimumFare: number;
    finalPrice: number;
  } | null;
};

export const getRidesApi = async (
  search?: string,
  passengerLat?: number | null,
  passengerLng?: number | null,
  dropoffLat?: number | null,
  dropoffLng?: number | null,
  tripType?: "intra" | "inter" | null,
) => {
  const params = new URLSearchParams();

  if (search?.trim()) {
    params.append("search", search.trim().toLowerCase());
  }

  if (passengerLat != null && passengerLng != null) {
    params.append("pickupLat", String(passengerLat));
    params.append("pickupLng", String(passengerLng));
  }

  if (dropoffLat != null && dropoffLng != null) {
    params.append("dropoffLat", String(dropoffLat));
    params.append("dropoffLng", String(dropoffLng));
  }

  if (tripType) {
    params.append("tripType", tripType);
  }

  const query = params.toString();
  const url = query ? `/api/rides?${query}` : "/api/rides";

  return apiClient<{ rides: Ride[] }>(url);
};

export const getRideByIdApi = async (rideId: string) => {
  return apiClient<{ ride: Ride }>(`/api/rides/${rideId}`);
};

export const deleteRideApi = (rideId: string) => {
  return apiClient<{ deleted: boolean; rideId: string }>(
    `/api/rides/${rideId}`,
    {
      method: "DELETE",
    },
  );
};

export const completeRideApi = (rideId: string) => {
  return apiClient<{ ride: Ride }>(`/api/rides/${rideId}/complete`, {
    method: "PATCH",
  });
};
