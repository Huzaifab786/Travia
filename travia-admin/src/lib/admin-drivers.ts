import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";
import type {
  AdminDriver,
  AdminDriverVerification,
} from "@/types/driver";

type DriversResponse = {
  drivers: AdminDriver[];
};

type DriverDetailResponse = {
  driver: AdminDriver;
};

type ReviewResponse = {
  message: string;
  driver: {
    id: string;
    name: string;
    driverStatus: string;
    driverVerification: AdminDriverVerification | null;
  };
};

function authHeaders(token: string, json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}

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

export async function fetchPendingDrivers() {
  const token = requireToken();
  const response = await fetch(`${apiBaseUrl}/api/admin/drivers/pending`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  return parseResponse<DriversResponse>(
    response,
    `Failed to fetch pending drivers with status ${response.status}`,
  );
}

export async function fetchAllDrivers() {
  const token = requireToken();
  const response = await fetch(`${apiBaseUrl}/api/admin/drivers`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  return parseResponse<DriversResponse>(
    response,
    `Failed to fetch drivers with status ${response.status}`,
  );
}

export async function fetchDriverDetail(driverId: string) {
  const token = requireToken();
  const response = await fetch(`${apiBaseUrl}/api/admin/drivers/${driverId}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  return parseResponse<DriverDetailResponse>(
    response,
    `Failed to fetch driver details with status ${response.status}`,
  );
}

export async function approveDriver(driverId: string) {
  const token = requireToken();
  const response = await fetch(
    `${apiBaseUrl}/api/admin/drivers/${driverId}/approve`,
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );

  return parseResponse<ReviewResponse>(
    response,
    `Failed to approve driver with status ${response.status}`,
  );
}

export async function suspendDriver(driverId: string, reason?: string) {
  const token = requireToken();
  const response = await fetch(
    `${apiBaseUrl}/api/admin/drivers/${driverId}/suspend`,
    {
      method: "POST",
      headers: authHeaders(token, true),
      body: JSON.stringify({ reason }),
    },
  );

  return parseResponse<ReviewResponse>(
    response,
    `Failed to suspend driver with status ${response.status}`,
  );
}
