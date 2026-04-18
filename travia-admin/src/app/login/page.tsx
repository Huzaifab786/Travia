"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearAdminSession,
  fetchAdminMe,
  loginAsAdmin,
  readAdminToken,
  saveAdminSession,
} from "@/lib/admin-auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function validateExistingSession() {
      const token = readAdminToken();

      if (!token) {
        if (active) {
          setCheckingSession(false);
        }
        return;
      }

      try {
        await fetchAdminMe(token);
        router.replace("/");
      } catch {
        clearAdminSession();
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    validateExistingSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await loginAsAdmin(email, password);
      saveAdminSession(result.token);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#f3f7ff_0%,#eef2ff_36%,#f8fafc_78%)] px-4">
        <div className="rounded-2xl border border-white/70 bg-white/85 px-5 py-4 text-sm text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          Checking admin session...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eef2ff_28%,#f8fafc_72%)] px-4 py-10 text-slate-950">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 p-8 text-white shadow-[0_30px_100px_rgba(15,23,42,0.26)]">
          <div className="max-w-xl space-y-6">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
              Travia Admin
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Sign in to manage the live platform.
              </h1>
              <p className="max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
                Use an admin account to access dashboard stats, users, rides,
                and bookings from the backend. No mock data, no manual token
                pasting.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Real backend auth
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Protected sessions
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Logout support
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Admin login
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Sign in with an account that has the admin role.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="admin@travia.app"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
