import { apiClient } from "../../../lib/api/client";
import type { AuthResponse, UserRole } from "../types/auth";

export const registerApi = (payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) => {
  return apiClient<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const loginApi = (payload: {
  email: string;
  password: string;
  role: UserRole;
}) => {
  return apiClient<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const syncUserApi = (payload: {
  supabaseId: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
}) => {
  return apiClient<AuthResponse>("/api/auth/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};