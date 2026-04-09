export type UserRole = "passenger" | "driver";
export type UserGender = "male" | "female" | "other";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  gender?: UserGender | null;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
};
