import { apiClient } from "../../../lib/api/client";

export type Vehicle = {
  id: string;
  userId: string;
  carModel: string;
  carType: string | null;
  engineCC: number | null;
  avgKmPerLitre: number;
  fuelPricePerLitre: number;
};

export const getMyVehicleApi = () => {
  return apiClient<{ vehicle: Vehicle | null }>("/api/vehicle");
};

export const updateVehicleApi = (payload: {
  carModel: string;
  carType?: string;
  engineCC?: number;
  avgKmPerLitre: number;
  fuelPricePerLitre: number;
}) => {
  return apiClient<{ vehicle: Vehicle }>("/api/vehicle", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};
