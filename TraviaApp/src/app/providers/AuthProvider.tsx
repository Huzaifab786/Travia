import React, { createContext, useEffect, useState, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { authStorage } from "../../lib/storage/authStorage";
import { supabase } from "../../config/supabaseClient";
import { syncUserApi } from "../../features/auth/api/authApi";
import { UserRole } from "../../features/auth/types/auth";

type DecodedToken = {
  userId: string;
  role: UserRole;
  exp: number;
};

type AuthContextType = {
  token: string | null;
  role: UserRole | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  user: any;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  role: null,
  loading: true,
  setToken: () => {},
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const setToken = async (value: string | null) => {
    if (value) {
      await authStorage.setToken(value);
      try {
        const decoded = jwtDecode<DecodedToken>(value);
        setRole(decoded.role);
      } catch (e) {
        console.error("Failed to decode token", e);
      }
    } else {
      await authStorage.removeToken();
      setRole(null);
    }
    setTokenState(value);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Check for stored custom backend token (legacy or sync result)
      const storedToken = await authStorage.getToken();
      if (storedToken) {
        try {
          const decoded = jwtDecode<DecodedToken>(storedToken);
          setTokenState(storedToken);
          setRole(decoded.role);
        } catch (e) {
          await authStorage.removeToken();
        }
      }

      // 2. Get Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      // 3. Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          await setToken(null);
        }
      });

      setLoading(false);
      return () => subscription.unsubscribe();
    };

    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ token, role, loading, setToken, user }}>
      {children}
    </AuthContext.Provider>
  );
}