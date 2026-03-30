"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";

type DriverDocument = {
  id: string;
  type: string;
  url: string;
  createdAt: string;
};

type Driver = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  driverStatus: string;
  createdAt: string;
  driverDocuments: DriverDocument[];
};

type DriverDetail = Driver;

type Status = "loading" | "ready" | "error";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [rejectingDriverId, setRejectingDriverId] = useState<string | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  function closeDriverDetail() {
    setSelectedDriver(null);
    setDetailError(null);
  }

  useEffect(() => {
    async function loadPendingDrivers() {
      setStatus("loading");
      setError(null);

      const token = readAdminToken();

      try {
        const res = await fetch(`${apiBaseUrl}/api/admin/drivers/pending`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch pending drivers");
        }

        setDrivers(data.drivers || []);
        setStatus("ready");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load pending drivers",
        );
        setStatus("error");
      }
    }

    loadPendingDrivers();
  }, []);

  async function handleApprove(driverId: string) {
    const token = readAdminToken();
    setActionLoadingId(driverId);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/admin/drivers/${driverId}/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to approve driver");
      }

      // remove from UI instantly
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
      setSelectedDriver(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReject(driverId: string, reason: string) {
    const token = readAdminToken();
    setActionLoadingId(driverId);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/admin/drivers/${driverId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reject driver");
      }

      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
      setSelectedDriver(null);
      setRejectingDriverId(null);
      setRejectReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleOpenDriverDetail(driverId: string) {
    const token = readAdminToken();
    setDetailLoading(true);
    setDetailError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/drivers/${driverId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch driver details");
      }

      setSelectedDriver(data.driver);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Unable to load driver details",
      );
    } finally {
      setDetailLoading(false);
    }
  }

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

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              Driver verification
            </span>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Review pending driver approvals.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                See drivers waiting for approval and review their submitted
                documents before allowing them onto the platform.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Pending approvals
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              {drivers.length}
            </p>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Pending Drivers
            </h2>
            <p className="text-sm text-slate-500">
              {filteredDrivers.length} pending driver
              {filteredDrivers.length === 1 ? "" : "s"} shown
            </p>
          </div>

          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 sm:max-w-sm"
          />
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
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
              All driver verification requests have been processed.
            </p>
          </div>
        )}
        {detailLoading && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            Loading driver details...
          </div>
        )}

        {detailError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {detailError}
          </div>
        )}
        {status === "ready" && filteredDrivers.length > 0 && (
          <div className="grid gap-4">
            {filteredDrivers.map((driver) => (
              <div
                key={driver.id}
                onClick={() => handleOpenDriverDetail(driver.id)}
                className="cursor-pointer rounded-3xl border border-slate-200 bg-slate-50/70 p-5 transition hover:border-slate-300 hover:bg-slate-50"
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
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {driver.driverStatus}
                      </span>

                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {driver.driverDocuments.length} document
                        {driver.driverDocuments.length === 1 ? "" : "s"}
                      </span>

                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        Joined {new Date(driver.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-65 space-y-3">
                    {/* Documents */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Submitted documents
                      </p>

                      <div className="mt-3 space-y-2">
                        {driver.driverDocuments.length > 0 ? (
                          driver.driverDocuments.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              {doc.type}
                            </a>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">
                            No documents uploaded
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectingDriverId(driver.id);
                          setRejectReason("");
                        }}
                        disabled={actionLoadingId === driver.id}
                        className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        Reject
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-4xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Driver Detail
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {selectedDriver.name || "Unnamed Driver"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedDriver.email}
                </p>
              </div>

              <button
                onClick={closeDriverDetail}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Full Name
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {selectedDriver.name || "N/A"}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {selectedDriver.phone || "N/A"}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </p>
                  <p className="mt-2">
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      {selectedDriver.driverStatus}
                    </span>
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Joined
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {new Date(selectedDriver.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Submitted Documents
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedDriver.driverDocuments.length > 0 ? (
                    selectedDriver.driverDocuments.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <div className="flex items-center justify-between">
                          <span className="capitalize">{doc.type}</span>
                          <span className="text-xs text-slate-500">Open</span>
                        </div>
                      </a>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 sm:col-span-2">
                      No documents uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  if (!selectedDriver) return;
                  setRejectingDriverId(selectedDriver.id);
                  setRejectReason("");
                }}
                disabled={actionLoadingId === selectedDriver?.id}
                className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                Reject Driver
              </button>

              <button
                onClick={() => {
                  if (!selectedDriver) return;
                  handleApprove(selectedDriver.id);
                }}
                disabled={actionLoadingId === selectedDriver?.id}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {actionLoadingId === selectedDriver?.id
                  ? "Processing..."
                  : "Approve Driver"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectingDriverId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-lg rounded-4xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Reject Driver
              </p>
              <h3 className="text-2xl font-semibold text-slate-950">
                Add rejection reason
              </h3>
              <p className="text-sm leading-6 text-slate-600">
                Explain clearly why the driver was rejected so they can fix the
                issue and re-submit.
              </p>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Example: Your driving license image is blurry. Please upload a clear front image."
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
                  handleReject(rejectingDriverId, rejectReason.trim())
                }
                disabled={
                  !rejectReason.trim() || actionLoadingId === rejectingDriverId
                }
                className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {actionLoadingId === rejectingDriverId
                  ? "Rejecting..."
                  : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
