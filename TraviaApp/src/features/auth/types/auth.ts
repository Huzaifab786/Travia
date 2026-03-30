export type UserRole = "passenger" | "driver";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
};