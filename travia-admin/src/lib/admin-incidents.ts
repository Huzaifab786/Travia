import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";
import type {
  AdminIncident,
  AdminIncidentKind,
  AdminIncidentStatus,
  GetAdminIncidentsResponse,
  UpdateAdminIncidentResponse,
} from "@/types/incident";

function requireToken() {
  const token = readAdminToken();
  if (!token) {
    throw new Error("Admin token not found");
  }

  return token;
}

function authHeaders(token: string, json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
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

export async function fetchAdminIncidents(kind?: AdminIncidentKind) {
  const token = requireToken();
  const query = kind ? `?kind=${kind}` : "";

  const response = await fetch(`${apiBaseUrl}/api/admin/incidents${query}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  return parseResponse<GetAdminIncidentsResponse>(
    response,
    `Failed to fetch incidents with status ${response.status}`,
  );
}

export async function updateAdminIncident(
  incidentId: string,
  payload: {
    status?: AdminIncidentStatus;
    severity?: string;
    adminNotes?: string;
  },
) {
  const token = requireToken();
  const response = await fetch(
    `${apiBaseUrl}/api/admin/incidents/${incidentId}`,
    {
      method: "PATCH",
      headers: authHeaders(token, true),
      body: JSON.stringify(payload),
    },
  );

  return parseResponse<UpdateAdminIncidentResponse>(
    response,
    `Failed to update incident with status ${response.status}`,
  );
}

export type { AdminIncident };
