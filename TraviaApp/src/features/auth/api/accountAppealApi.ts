import { apiClient } from "../../../lib/api/client";
import type { UserRole } from "../types/auth";

export const requestAccountAppealApi = (payload: {
  email: string;
  name?: string;
  role?: UserRole;
  message: string;
}) => {
  return apiClient<{ appeal: { id: string; status: string } }>("/api/support/account-appeals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};
