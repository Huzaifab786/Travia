import { authStorage } from "../storage/authStorage";
import { ENV } from "../../config/env";

export const apiClient = async <T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> => {
  const token = await authStorage.getToken();

  const response = await fetch(`${ENV.API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  const text = await response.text(); // ✅ read raw response first

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ✅ This catches HTML responses, etc.
    throw new Error(
      `Non-JSON response (status ${response.status}) from ${endpoint}. First chars: ${text.slice(
        0,
        120,
      )}`,
    );
  }

  if (!response.ok) {
    throw new Error(data?.message || `API Error (status ${response.status})`);
  }

  return data as T;
};