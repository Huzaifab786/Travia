import React, { createContext, useEffect, useState, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { authStorage } from "../../lib/storage/authStorage";
import { supabase } from "../../config/supabaseClient";
import { getCurrentUserApi, syncUserApi } from "../../features/auth/api/authApi";
import { UserRole } from "../../features/auth/types/auth";
import { initSocket, disconnectSocket } from "../../services/socket";

type DecodedToken = {
  userId: string;
  role: UserRole;
  exp: number;
};

type AuthContextType = {
  token: string | null;
  userId: string | null;
  role: UserRole | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: any) => void;
  setSuspendedAccount: (account: SuspendedAccount | null) => void;
  user: any;
  suspendedAccount: SuspendedAccount | null;
};

type SuspendedAccount = {
  email?: string | null;
  role?: UserRole | null;
  reason?: string | null;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  userId: null,
  role: null,
  loading: true,
  setToken: () => {},
  setUser: () => {},
  setSuspendedAccount: () => {},
  user: null,
  suspendedAccount: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [suspendedAccount, setSuspendedAccount] = useState<SuspendedAccount | null>(null);

  const setToken = async (value: string | null) => {
    if (value) {
      await authStorage.setToken(value);
      setSuspendedAccount(null);
      try {
        const decoded = jwtDecode<DecodedToken>(value);
        setRole(decoded.role);
        setUserId(decoded.userId);
      } catch (e) {
        console.error("Failed to decode token", e);
      }
      // Connect socket when token is set (user logged in)
      initSocket().catch(() => {});
    } else {
      await authStorage.removeToken();
      setRole(null);
      setUserId(null);
      // Disconnect socket on logout
      disconnectSocket();
    }
    setTokenState(value);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Check for stored custom backend token
      const storedToken = await authStorage.getToken();
      if (storedToken) {
        try {
          const decoded = jwtDecode<DecodedToken>(storedToken);
          setTokenState(storedToken);
          setRole(decoded.role);
          setUserId(decoded.userId);
          // Connect socket with existing token on app resume
          initSocket().catch(() => {});

          try {
            const currentUser = await getCurrentUserApi();
            if (currentUser?.user?.accountStatus === "suspended") {
              setSuspendedAccount({
                email: currentUser.user.email,
                role: currentUser.user.role,
                reason: currentUser.user.accountSuspensionReason || "Your account has been suspended.",
              });
              await setToken(null);
            }
          } catch (sessionError: any) {
            const message = sessionError?.message || "";
            if (message.toLowerCase().includes("suspended")) {
              setSuspendedAccount({
                role: decoded.role,
                reason: message,
              });
              await setToken(null);
            } else {
              await authStorage.removeToken();
              setTokenState(null);
              setRole(null);
              setUserId(null);
            }
          }
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
    <AuthContext.Provider value={{ token, userId, role, loading, setToken, setUser, setSuspendedAccount, user, suspendedAccount }}>
        {children}
      </AuthContext.Provider>
  );
}
