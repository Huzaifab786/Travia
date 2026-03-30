"use client";

import { useEffect, useMemo, useState } from "react";
import {
  apiBaseUrl,
  clearAdminSession,
  fetchAdminMe,
  readAdminToken,
  type AdminUser,
} from "@/lib/admin-auth";

type StatsResponse = {
  totalUsers: number;
  totalDrivers: number;
  totalRides: number;
  pendingVerifications: number;
  totalBookings: number;
};

type Status = "loading" | "ready" | "error";

const statCards = [
  {
    key: "totalUsers",
    label: "Total users",
    description: "All registered accounts in the platform.",
  },
  {
    key: "totalDrivers",
    label: "Drivers",
    description: "Driver accounts currently in the system.",
  },
  {
    key: "totalRides",
    label: "Rides",
    description: "Published rides available through the backend.",
  },
  {
    key: "pendingVerifications",
    label: "Pending verifications",
    description: "Drivers waiting for admin approval.",
  },
  {
    key: "totalBookings",
    label: "Bookings",
    description: "All booking records stored in the backend.",
  },
] as const;

function formatCount(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export default function Home() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [me, setMe] = useState<AdminUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      setStatus("loading");
      setError(null);

      const token = readAdminToken();

      if (!token) {
        clearAdminSession();
        setStats(null);
        setStatus("error");
        setError("Admin session not found. Please sign in again.");
        return;
      }

      try {
        const profile = await fetchAdminMe(token, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        setMe(profile);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        clearAdminSession();
        setStats(null);
        setStatus("error");
        setError("Admin session is invalid. Please sign in again.");
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/admin/stats`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const payload = (await response.json()) as
          | StatsResponse
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            ("message" in payload && payload.message) ||
              `Request failed with status ${response.status}`
          );
        }

        setStats(payload as StatsResponse);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          err instanceof Error ? err.message : "Unable to load dashboard stats.";

        setStats(null);
        setError(message);
        setStatus("error");
      }
    }

    loadStats();

    return () => controller.abort();
  }, [refreshKey]);

  const summary = useMemo(() => {
    if (!stats) {
      return [];
    }

    return statCards.map((card) => ({
      ...card,
      value: stats[card.key],
    }));
  }, [stats]);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              Admin dashboard
            </span>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Live platform stats from the backend.
              </h1>

              <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                This view reads from <code>/api/admin/stats</code> and surfaces
                the current platform totals without mock data.
              </p>

              {me && (
                <p className="text-sm font-medium text-slate-500">
                  Signed in as {me.email}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Refresh stats
            </button>
          </div>
        </div>
      </section>

      {status === "loading" && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map((card) => (
            <div
              key={card.key}
              className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-sm"
            >
              <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 h-10 w-20 animate-pulse rounded-2xl bg-slate-200" />
              <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-100" />
              <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </section>
      )}

      {status === "error" && (
        <section className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-rose-900">
          <h2 className="text-lg font-semibold">Unable to load stats</h2>
          <p className="mt-2 text-sm leading-6">{error}</p>
        </section>
      )}

      {status === "ready" && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {summary.map((card) => (
            <article
              key={card.key}
              className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                {formatCount(card.value)}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}