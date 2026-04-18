import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";
import type {
  AccountAppeal,
  AccountAppealStatus,
  GetAccountAppealsResponse,
  UpdateAccountAppealResponse,
} from "@/types/appeal";

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

export async function fetchAccountAppeals(status?: AccountAppealStatus) {
  const token = requireToken();
  const query = status ? `?status=${status}` : "";

  const response = await fetch(`${apiBaseUrl}/api/admin/appeals${query}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  return parseResponse<GetAccountAppealsResponse>(
    response,
    `Failed to fetch appeals with status ${response.status}`,
  );
}

export async function updateAccountAppeal(
  appealId: string,
  payload: {
    status: AccountAppealStatus;
    adminNotes?: string;
  },
) {
  const token = requireToken();
  const response = await fetch(`${apiBaseUrl}/api/admin/appeals/${appealId}`, {
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });

  return parseResponse<UpdateAccountAppealResponse>(
    response,
    `Failed to update appeal with status ${response.status}`,
  );
}

export type { AccountAppeal };
