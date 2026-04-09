import { apiClient } from "../../../lib/api/client";

export type Vehicle = {
  id: string;
  userId: string;
  carModel: string;
  carType: string | null;
  vehicleNumber: string | null;
  engineCC: number | null;
  avgKmPerLitre: number;
  carImageUrl: string | null;
  carImagePath: string | null;
};

export const getMyVehicleApi = () => {
  return apiClient<{ vehicle: Vehicle | null }>("/api/vehicle");
};

export const updateVehicleApi = (payload: {
  carModel: string;
  carType?: string;
  vehicleNumber: string;
  engineCC?: number;
  avgKmPerLitre: number;
  carImageUrl?: string | null;
  carImagePath?: string | null;
}) => {
  return apiClient<{ vehicle: Vehicle }>("/api/vehicle", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};
