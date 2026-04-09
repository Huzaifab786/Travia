"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approveDriver,
  fetchPendingDrivers,
  fetchDriverDetail,
  suspendDriver,
} from "@/lib/admin-drivers";
import type {
  AdminDriver,
  AdminDriverDocument,
  AdminDriverVerification,
} from "@/types/driver";

type PageStatus = "loading" | "ready" | "error";

function formatDate(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString();
}

function badgeClasses(value: string) {
  switch (value) {
    case "approved":
    case "verified":
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
    case "rejected":
      return "border-rose-200 bg-rose-100 text-rose-700";
    case "suspended":
      return "border-slate-200 bg-slate-200 text-slate-700";
    default:
      return "border-amber-200 bg-amber-100 text-amber-700";
  }
}

function extractIssues(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const maybeIssues = (value as { issues?: unknown }).issues;

  if (!Array.isArray(maybeIssues)) {
    return [];
  }

  return maybeIssues
    .map((issue) => {
      if (!issue || typeof issue !== "object") {
        return null;
      }

      const reason = (issue as { reason?: unknown }).reason;
      return typeof reason === "string" ? reason : null;
    })
    .filter((reason): reason is string => Boolean(reason));
}

function DocumentCard({ document }: { document: AdminDriverDocument }) {
  return (
    <a
      href={document.url}
      target="_blank"
      rel="noreferrer"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-slate-300 hover:bg-slate-100"
    >
      <div className="grid gap-0 md:grid-cols-[180px_1fr]">
        <div className="relative min-h-44 bg-slate-200">
          <img
            src={document.url}
            alt={`${document.category || "document"} ${document.side || ""}`}
            className="h-full w-full object-cover"
          />
          <div className="absolute left-3 top-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize backdrop-blur ${badgeClasses(
                document.ocrStatus,
              )}`}
            >
              {document.ocrStatus}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold capitalize text-slate-900">
                {document.category || "document"} {document.side || ""}
              </p>
              <p className="text-xs text-slate-500">{document.type}</p>
            </div>
          </div>

          {document.ocrReason ? (
            <p className="text-xs leading-5 text-slate-600">
              {document.ocrReason}
            </p>
          ) : null}

          <p className="text-xs font-medium text-slate-500">
            Click image to open full size
          </p>
        </div>
      </div>
    </a>
  );
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<AdminDriver | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [rejectingDriverId, setRejectingDriverId] = useState<string | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    async function loadPendingDrivers() {
      setStatus("loading");
      setError(null);

      try {
        const res = await fetchPendingDrivers();
        setDrivers(res.drivers || []);
        setStatus("ready");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load pending drivers",
        );
        setStatus("error");
      }
    }

    loadPendingDrivers();
  }, [refreshKey]);

  const filteredDrivers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return drivers;

    return drivers.filter((driver) => {
      return (
        driver.name?.toLowerCase().includes(query) ||
        driver.email.toLowerCase().includes(query) ||
        driver.phone?.toLowerCase().includes(query)
      );
    });
  }, [drivers, search]);

  function closeDriverDetail() {
    setSelectedDriver(null);
    setDetailError(null);
  }

  async function handleOpenDriverDetail(driverId: string) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const data = await fetchDriverDetail(driverId);
      setSelectedDriver(data.driver);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Unable to load driver details",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleApprove(driverId: string) {
    setActionLoadingId(driverId);

    try {
      await approveDriver(driverId);
      setDrivers((prev) => prev.filter((driver) => driver.id !== driverId));
      setSelectedDriver(null);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSuspend(driverId: string, reason: string) {
    setActionLoadingId(driverId);

    try {
      await suspendDriver(driverId, reason);
      setDrivers((prev) => prev.filter((driver) => driver.id !== driverId));
      setSelectedDriver(null);
      setRejectingDriverId(null);
      setRejectReason("");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoadingId(null);
    }
  }

  const pendingCount = filteredDrivers.length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              Driver verification
            </span>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Review AI-checked driver documents.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Inspect the Gemini OCR output, open the uploaded document pages,
                and decide whether the driver should be approved or suspended.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Pending reviews
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              {pendingCount}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Pending Drivers
            </h2>
            <p className="text-sm text-slate-500">
              {filteredDrivers.length} driver
              {filteredDrivers.length === 1 ? "" : "s"} awaiting admin action
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:max-w-sm">
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
            />

            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh queue
            </button>
          </div>
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {status === "ready" && filteredDrivers.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-lg font-medium text-slate-700">
              No pending drivers found
            </p>
            <p className="mt-2 text-sm text-slate-500">
              All current driver submissions have been reviewed.
            </p>
          </div>
        )}

        {detailLoading && (
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            Loading driver details...
          </div>
        )}

        {detailError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {detailError}
          </div>
        )}

        {status === "ready" && filteredDrivers.length > 0 && (
          <div className="grid gap-4">
            {filteredDrivers.map((driver) => (
              <div
                key={driver.id}
                onClick={() => handleOpenDriverDetail(driver.id)}
                role="button"
                tabIndex={0}
                className="cursor-pointer rounded-3xl border border-slate-200 bg-slate-50/70 p-5 text-left transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {driver.name || "Unnamed Driver"}
                      </h3>
                      <p className="text-sm text-slate-600">{driver.email}</p>
                      <p className="text-sm text-slate-500">
                        {driver.phone || "No phone provided"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${badgeClasses(
                          driver.driverStatus,
                        )}`}
                      >
                        {driver.driverStatus}
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${badgeClasses(
                          driver.driverVerification?.autoDecision || "pending",
                        )}`}
                      >
                        AI {driver.driverVerification?.autoDecision || "pending"}
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${badgeClasses(
                          driver.driverVerification?.adminDecision || "pending",
                        )}`}
                      >
                        Admin {driver.driverVerification?.adminDecision || "pending"}
                      </span>

                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {driver.driverVerification?.documents?.length || 0} pages
                      </span>

                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        Joined {new Date(driver.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-72 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        AI summary
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {driver.driverVerification?.autoReason ||
                          "No AI summary available yet"}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(driver.id);
                        }}
                        disabled={actionLoadingId === driver.id}
                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {actionLoadingId === driver.id
                          ? "Processing..."
                          : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectingDriverId(driver.id);
                          setRejectReason("");
                        }}
                        disabled={actionLoadingId === driver.id}
                        className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        Suspend
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedDriver && (
        <DriverDetailModal
          driver={selectedDriver}
          onClose={closeDriverDetail}
          onApprove={() => handleApprove(selectedDriver.id)}
          onSuspend={() => {
            setRejectingDriverId(selectedDriver.id);
            setRejectReason("");
          }}
          actionLoading={actionLoadingId === selectedDriver.id}
        />
      )}

      {rejectingDriverId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-lg rounded-4xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Suspend Driver
              </p>
              <h3 className="text-2xl font-semibold text-slate-950">
                Add a suspension reason
              </h3>
              <p className="text-sm leading-6 text-slate-600">
                Explain clearly why the driver was suspended so the reason is
                recorded in the audit trail.
              </p>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Example: The uploaded license does not match the CNIC details."
              className="mt-5 min-h-35 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  setRejectingDriverId(null);
                  setRejectReason("");
                }}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  handleSuspend(rejectingDriverId, rejectReason.trim())
                }
                disabled={
                  !rejectReason.trim() || actionLoadingId === rejectingDriverId
                }
                className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {actionLoadingId === rejectingDriverId
                  ? "Suspending..."
                  : "Confirm Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverDetailModal({
  driver,
  onClose,
  onApprove,
  onSuspend,
  actionLoading,
}: {
  driver: AdminDriver;
  onClose: () => void;
  onApprove: () => void;
  onSuspend: () => void;
  actionLoading: boolean;
}) {
  const verification = driver.driverVerification;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-4xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Driver Detail
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {driver.name || "Unnamed Driver"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{driver.email}</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Driver Status" value={driver.driverStatus} />
            <InfoCard
              label="AI Decision"
              value={verification?.autoDecision || "pending"}
            />
            <InfoCard
              label="Admin Decision"
              value={verification?.adminDecision || "pending"}
            />
            <InfoCard
              label="Submitted"
              value={formatDate(verification?.createdAt)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                AI Result
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Decision
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 capitalize">
                    {verification?.autoDecision || "pending"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reason
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {verification?.autoReason || "No AI summary available"}
                  </p>
                </div>

                {extractIssues(verification?.autoResult).length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Findings
                    </p>
                    <ul className="mt-3 space-y-2">
                      {extractIssues(verification?.autoResult).map((issue) => (
                        <li key={issue} className="flex gap-2 text-sm leading-6 text-slate-700">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Admin Review
              </p>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-700">
                  {verification?.adminReason || "No admin note yet"}
                </p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p>
                    Reviewed at:{" "}
                    <span className="font-medium">
                      {formatDate(verification?.reviewedAt)}
                    </span>
                  </p>
                  <p className="mt-1">
                    Reviewed by:{" "}
                    <span className="font-medium">
                      {verification?.reviewedByAdminId || "N/A"}
                    </span>
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Uploaded Documents
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {verification?.documents?.length ? (
                verification.documents.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 md:col-span-2">
                  No document records found
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <InfoCard label="Phone" value={driver.phone || "N/A"} />
            <InfoCard
              label="Rejection Reason"
              value={driver.driverRejectionReason || "N/A"}
            />
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            onClick={onSuspend}
            disabled={actionLoading}
            className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            Suspend Driver
          </button>

          <button
            onClick={onApprove}
            disabled={actionLoading}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {actionLoading ? "Processing..." : "Approve Driver"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
