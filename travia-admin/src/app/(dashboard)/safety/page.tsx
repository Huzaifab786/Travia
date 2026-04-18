"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";
import {
  fetchAdminIncidents,
  updateAdminIncident,
} from "@/lib/admin-incidents";
import type {
  AdminIncident,
  AdminIncidentKind,
  AdminIncidentStatus,
} from "@/types/incident";

type PageStatus = "loading" | "ready" | "error";
type SocketState = "connecting" | "connected" | "disconnected";

const tabs: Array<{
  kind: AdminIncidentKind;
  label: string;
  description: string;
}> = [
  {
    kind: "sos",
    label: "SOS Alerts",
    description: "Urgent safety alerts raised during rides.",
  },
  {
    kind: "report",
    label: "Reports",
    description: "User reports about drivers, passengers, or safety.",
  },
];

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString();
}

function badgeClasses(kind: string) {
  switch (kind) {
    case "sos":
      return "border-rose-200 bg-rose-100 text-rose-700";
    case "report":
      return "border-sky-200 bg-sky-100 text-sky-700";
    case "critical":
      return "border-red-200 bg-red-100 text-red-700";
    case "high":
      return "border-orange-200 bg-orange-100 text-orange-700";
    case "medium":
      return "border-amber-200 bg-amber-100 text-amber-700";
    case "low":
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
    case "open":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "acknowledged":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "resolved":
    case "closed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getActionLabel(status: AdminIncidentStatus) {
  if (status === "open") return "Acknowledge";
  if (status === "acknowledged") return "Resolve";
  if (status === "resolved") return "Close";
  return "Reopen";
}

export default function SafetyPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<AdminIncident[]>([]);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<AdminIncidentKind>("sos");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [socketState, setSocketState] = useState<SocketState>("connecting");

  useEffect(() => {
    let cancelled = false;

    async function loadIncidents() {
      setStatus("loading");
      setError(null);

      try {
        const data = await fetchAdminIncidents();
        if (cancelled) return;

        setIncidents(data.incidents || []);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : "Unable to load safety incidents");
        setStatus("error");
      }
    }

    loadIncidents();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const token = readAdminToken();

    if (!token) {
      setSocketState("disconnected");
      return;
    }

    const socket: Socket = io(apiBaseUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("admin_incident_created", (incident: AdminIncident) => {
      setIncidents((prev) => {
        const withoutIncident = prev.filter((item) => item.id !== incident.id);
        return [incident, ...withoutIncident];
      });
      setStatus("ready");
    });
    socket.on("admin_incident_updated", (incident: AdminIncident) => {
      setIncidents((prev) =>
        prev.map((item) => (item.id === incident.id ? incident : item)),
      );
      setStatus("ready");
    });
    socket.on("connect_error", () => setSocketState("disconnected"));

    return () => {
      socket.disconnect();
    };
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents
      .filter((incident) => incident.kind === activeKind)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [activeKind, incidents]);

  const summary = useMemo(() => {
    const openSafetyAlerts = incidents.filter(
      (incident) => incident.kind === "sos" && incident.status !== "resolved" && incident.status !== "closed",
    ).length;
    const openReports = incidents.filter(
      (incident) => incident.kind === "report" && incident.status !== "resolved" && incident.status !== "closed",
    ).length;
    const criticalOpen = incidents.filter(
      (incident) => incident.kind === "sos" && incident.severity === "critical" && incident.status !== "resolved" && incident.status !== "closed",
    ).length;

    return {
      openSafetyAlerts,
      openReports,
      criticalOpen,
      totalOpen: openSafetyAlerts + openReports,
    };
  }, [incidents]);

  const selectedIncident = useMemo(() => {
    if (!filteredIncidents.length) {
      return null;
    }

    return (
      filteredIncidents.find((incident) => incident.id === selectedIncidentId) ||
      filteredIncidents[0]
    );
  }, [filteredIncidents, selectedIncidentId]);

  useEffect(() => {
    if (!selectedIncident) {
      setSelectedIncidentId(null);
      setNotes("");
      return;
    }

    setSelectedIncidentId(selectedIncident.id);
    setNotes(selectedIncident.adminNotes || "");
  }, [selectedIncident]);

  async function handleRefresh() {
    setRefreshKey((value) => value + 1);
  }

  async function handleUpdateIncident(
    incident: AdminIncident,
    nextStatus?: AdminIncidentStatus,
  ) {
    setActionLoadingId(incident.id);

    try {
      const response = await updateAdminIncident(incident.id, {
        status: nextStatus,
        adminNotes: notes.trim() || undefined,
      });

      setIncidents((prev) =>
        prev.map((item) =>
          item.id === incident.id ? response.incident : item,
        ),
      );
      setNotes(response.incident.adminNotes || "");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating incident");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleAcknowledgeAndMonitor(incident: AdminIncident) {
    setActionLoadingId(incident.id);

    try {
      if (incident.status === "open") {
        const response = await updateAdminIncident(incident.id, {
          status: "acknowledged",
          adminNotes: notes.trim() || undefined,
        });

        setIncidents((prev) =>
          prev.map((item) =>
          item.id === incident.id ? response.incident : item,
        ),
      );
      }

      if (!incident.rideId) {
        return;
      }

      router.push(`/live-tracking?rideId=${encodeURIComponent(incident.rideId)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to open live monitoring");
    } finally {
      setActionLoadingId(null);
    }
  }

  const statusPills = [
    {
      label: "Open safety alerts",
      value: summary.openSafetyAlerts,
      tone: "rose",
    },
    {
      label: "Open reports",
      value: summary.openReports,
      tone: "sky",
    },
    {
      label: "Critical alerts",
      value: summary.criticalOpen,
      tone: "orange",
    },
    {
      label: "Total open",
      value: summary.totalOpen,
      tone: "slate",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
              Safety center
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Monitor SOS alerts and user reports in one place.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Review ride-linked safety incidents, see the exact location and
                ride context, and acknowledge or resolve them from the admin panel.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Realtime feed
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {socketState === "connected" ? "Live" : "Polling"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {socketState === "connected"
                ? "Admin socket connected"
                : "Auto-refresh fallback active"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusPills.map((pill) => (
          <article
            key={pill.label}
            className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{pill.label}</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              {pill.value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Incident feed</h2>
            <p className="text-sm text-slate-500">
              Incident logs update in real time when the backend emits a new alert.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = activeKind === tab.kind;

              return (
                <button
                  key={tab.kind}
                  type="button"
                  onClick={() => setActiveKind(tab.kind)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      {status === "loading" && (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
          </div>
          <div className="h-96 animate-pulse rounded-3xl bg-slate-100" />
        </section>
      )}

      {status === "error" && (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
          <h2 className="text-lg font-semibold">Unable to load incidents</h2>
          <p className="mt-2 text-sm leading-6">{error}</p>
        </section>
      )}

      {status === "ready" && (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            {filteredIncidents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <p className="text-lg font-medium text-slate-700">
                  No {activeKind === "sos" ? "SOS alerts" : "reports"} yet
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  When passengers trigger an SOS or submit a report, it will appear here.
                </p>
              </div>
            ) : (
              filteredIncidents.map((incident) => {
                const active = incident.id === selectedIncident?.id;

                return (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => setSelectedIncidentId(incident.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white shadow-md"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClasses(
                          incident.kind,
                        )}`}
                      >
                        {incident.kind === "sos" ? "SOS" : "Report"}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClasses(
                          incident.status,
                        )}`}
                      >
                        {incident.status}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClasses(
                          incident.severity,
                        )}`}
                      >
                        {incident.severity}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className={`text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>
                        {incident.message}
                      </p>
                      <p className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                        Ride: {incident.ride ? `${incident.ride.pickupAddress} to ${incident.ride.dropoffAddress}` : "No ride linked"}
                      </p>
                      <p className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                        Reporter: {incident.reporter.name || incident.reporter.email} ·{" "}
                        {formatDateTime(incident.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <aside className="rounded-4xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
            {!selectedIncident ? (
              <div className="flex h-full min-h-96 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
                <div>
                  <p className="text-lg font-semibold text-slate-800">
                    Select an incident
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    The ride details, location, reporter and action controls will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${badgeClasses(
                        selectedIncident.kind,
                      )}`}
                    >
                      {selectedIncident.kind === "sos" ? "SOS alert" : "User report"}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${badgeClasses(
                        selectedIncident.status,
                      )}`}
                    >
                      {selectedIncident.status}
                    </span>
                  </div>

                  <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {selectedIncident.message}
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    {selectedIncident.category ? `Category: ${selectedIncident.category}` : "No category provided"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ride
                    </p>
                    {selectedIncident.ride ? (
                      <>
                        <p className="mt-2 text-sm font-medium text-slate-900">
                          {selectedIncident.ride.pickupAddress}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          to {selectedIncident.ride.dropoffAddress}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        General profile feedback
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {selectedIncident.locationLabel || "Live location not provided"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedIncident.latitude != null && selectedIncident.longitude != null
                        ? `${selectedIncident.latitude.toFixed(6)}, ${selectedIncident.longitude.toFixed(6)}`
                        : "Latitude and longitude unavailable"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reporter
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {selectedIncident.reporter.name || "Unnamed user"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedIncident.reporter.email}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reported user
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {selectedIncident.reportedUser?.name || "N/A"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedIncident.reportedUser?.email || "No target user"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ride driver
                  </p>
                  {selectedIncident.ride ? (
                    <>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {selectedIncident.ride.driver.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedIncident.ride.driver.email}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      No ride context
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Created
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatDateTime(selectedIncident.createdAt)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Last updated
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatDateTime(selectedIncident.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Admin notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Leave internal notes about the action taken..."
                    className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleUpdateIncident(selectedIncident)}
                    disabled={actionLoadingId === selectedIncident.id}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save notes
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAcknowledgeAndMonitor(selectedIncident)}
                    disabled={actionLoadingId === selectedIncident.id}
                    className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selectedIncident.rideId ? "Acknowledge & Monitor" : "Acknowledge"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateIncident(selectedIncident, "resolved")
                    }
                    disabled={actionLoadingId === selectedIncident.id}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Resolve
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateIncident(selectedIncident, "closed")
                    }
                    disabled={actionLoadingId === selectedIncident.id}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}
