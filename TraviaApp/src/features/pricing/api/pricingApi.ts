import { apiClient } from "../../../lib/api/client";

export type PricingSettings = {
  id: string;
  fuelPricePerLitre: number;
  routeRadiusKm: number;
  createdAt: string;
  updatedAt: string;
};

export const getPricingSettingsApi = () => {
  return apiClient<{ pricingSettings: PricingSettings }>("/api/pricing");
};
