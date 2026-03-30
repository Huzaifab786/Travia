export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

export type AdminLoginResponse = {
  user: AdminUser;
  token: string;
};

const ADMIN_TOKEN_KEY = "traviaAdminToken";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export function readAdminToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function saveAdminSession(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function loginAsAdmin(email: string, password: string) {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      role: "admin",
    }),
  });

  const payload = (await response.json()) as
    | AdminLoginResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      ("message" in payload && payload.message) ||
        `Login failed with status ${response.status}`
    );
  }

  return payload as AdminLoginResponse;
}

export async function fetchAdminMe(token: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/admin/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  const payload = (await response.json()) as
    | { user: AdminUser }
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      ("message" in payload && payload.message) ||
        `Session validation failed with status ${response.status}`
    );
  }

  return (payload as { user: AdminUser }).user;
}
