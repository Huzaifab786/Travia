import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";
import type { AdminPricingSettings } from "@/types/pricing";

type PricingResponse = {
  pricingSettings: AdminPricingSettings;
};

function requireToken() {
  const token = readAdminToken();

  if (!token) {
    throw new Error("Admin token not found");
  }

  return token;
}

async function parseResponse<T extends object>(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json()) as T | { message?: string };

  if (!response.ok) {
    throw new Error(
      ("message" in payload && payload.message) || fallbackMessage,
    );
  }

  return payload as T;
}

export async function fetchPricingSettings() {
  const token = requireToken();
  const response = await fetch(`${apiBaseUrl}/api/admin/pricing`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return parseResponse<PricingResponse>(
    response,
    `Failed to fetch pricing settings with status ${response.status}`,
  );
}

export async function updatePricingSettings(
  fuelPricePerLitre: number,
  routeRadiusKm: number,
) {
  const token = requireToken();
  const response = await fetch(`${apiBaseUrl}/api/admin/pricing`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fuelPricePerLitre, routeRadiusKm }),
  });

  return parseResponse<PricingResponse>(
    response,
    `Failed to update pricing settings with status ${response.status}`,
  );
}
