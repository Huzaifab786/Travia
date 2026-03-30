"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearAdminSession,
  fetchAdminMe,
  readAdminToken,
  type AdminUser,
} from "@/lib/admin-auth";

type AdminAuthStatus = "checking" | "authenticated" | "unauthenticated";

type AdminAuthContextValue = {
  status: AdminAuthStatus;
  user: AdminUser | null;
  logout: () => void;
  refreshSession: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<AdminAuthStatus>("checking");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      const token = readAdminToken();

      console.log("AdminAuthProvider: token found?", !!token);

      if (!token) {
        clearAdminSession();
        setUser(null);
        setStatus("unauthenticated");
        router.replace("/login");
        return;
      }

      setStatus("checking");
      setDebugMessage(null);

      try {
        const currentUser = await fetchAdminMe(token);

        if (cancelled) {
          return;
        }

        console.log("AdminAuthProvider: session valid", currentUser);

        setUser(currentUser);
        setStatus("authenticated");
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Session validation failed";

        console.error("AdminAuthProvider: session validation error", error);

        setDebugMessage(message);
        clearAdminSession();
        setUser(null);
        setStatus("unauthenticated");
        router.replace("/login");
      }
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const logout = useCallback(() => {
    clearAdminSession();
    setUser(null);
    setStatus("unauthenticated");
    router.replace("/login");
  }, [router]);

  const refreshSession = useCallback(async () => {
    const token = readAdminToken();

    if (!token) {
      clearAdminSession();
      setUser(null);
      setStatus("unauthenticated");
      router.replace("/login");
      return;
    }

    setStatus("checking");
    setDebugMessage(null);

    try {
      const currentUser = await fetchAdminMe(token);
      setUser(currentUser);
      setStatus("authenticated");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Session validation failed";

      console.error("AdminAuthProvider: refreshSession error", error);

      setDebugMessage(message);
      clearAdminSession();
      setUser(null);
      setStatus("unauthenticated");
      router.replace("/login");
    }
  }, [router]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      status,
      user,
      logout,
      refreshSession,
    }),
    [logout, refreshSession, status, user]
  );

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#f3f7ff_0%,#eef2ff_40%,#f8fafc_78%)] px-6 text-slate-600">
        <div className="rounded-2xl border border-white/70 bg-white/85 px-5 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <p>
            {status === "checking"
              ? "Checking admin session..."
              : "Redirecting to login..."}
          </p>

          {debugMessage && (
            <p className="mt-3 max-w-md text-sm text-rose-600">
              {debugMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }

  return context;
}