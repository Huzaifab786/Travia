import { apiClient } from "../../../lib/api/client";

export type PassDetails = {
  id: string;
  passengerId: string;
  driverId: string;
  status: "pending" | "active" | "exhausted" | "cancelled";
  planType?: "weekly" | "monthly" | "custom" | string | null;
  durationDays?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  routeSignature?: string | null;
  routePickup?: PassPlace | null;
  routeDropoff?: PassPlace | null;
  routeLabel?: string | null;
  durationLabel?: string | null;
  totalRides?: number | null;
  ridesUsed?: number | null;
  price: number;
  createdAt: string;
  driver?: {
    id: string;
    name: string;
    avatarUrl?: string;
    phone?: string;
  };
  passenger?: {
    id: string;
    name: string;
    avatarUrl?: string;
    phone?: string;
  };
};

export type PassPlace = {
  id?: string | null;
  label?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
};

export type EligiblePassOffer = {
  driver: {
    id: string;
    name: string;
    avatarUrl?: string;
    phone?: string;
  };
  routeSignature: string;
  routePickup: PassPlace;
  routeDropoff: PassPlace;
  routeLabel: string;
  completedTrips: number;
  estimatedFarePerRide: number;
  lastTripAt?: string;
};

export const getEligibleDrivers = async (): Promise<EligiblePassOffer[]> => {
  const res = await apiClient<{ data: EligiblePassOffer[] }>("/api/passes/eligible");
  return res.data;
};

export const getPassengerPasses = async (): Promise<PassDetails[]> => {
  const res = await apiClient<{ data: PassDetails[] }>("/api/passes/passenger");
  return res.data;
};

export const requestPass = async (
  driverId: string,
  routeSignature: string,
  planType: "weekly" | "monthly" | "custom",
  durationDays: number,
): Promise<PassDetails> => {
  const res = await apiClient<{ data: PassDetails }>("/api/passes/request", {
    method: "POST",
    body: JSON.stringify({ driverId, routeSignature, planType, durationDays }),
  });
  return res.data;
};

export const getDriverPasses = async (): Promise<PassDetails[]> => {
  const res = await apiClient<{ data: PassDetails[] }>("/api/passes/driver");
  return res.data;
};

export const approvePass = async (passId: string): Promise<PassDetails> => {
  const res = await apiClient<{ data: PassDetails }>(`/api/passes/driver/${passId}/approve`, {
    method: "POST",
  });
  return res.data;
};
