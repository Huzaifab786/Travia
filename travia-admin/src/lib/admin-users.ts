import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";

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

export async function suspendAdminUser(userId: string, reason?: string) {
  const token = requireToken();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/suspend`, {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify({ reason }),
  });

  return parseResponse<{ message: string }>(
    response,
    `Failed to suspend user with status ${response.status}`,
  );
}

export async function restoreAdminUser(userId: string) {
  const token = requireToken();
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/restore`, {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify({}),
  });

  return parseResponse<{ message: string }>(
    response,
    `Failed to restore user with status ${response.status}`,
  );
}
