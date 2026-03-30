"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAdminRideDetail, fetchAdminRides } from "@/lib/admin-rides";
import type { AdminRide, AdminRideDetail, AdminRideStatus } from "@/types/ride";

type PageStatus = "loading" | "ready" | "error";
type RideFilter = "all" | AdminRideStatus;

const FILTERS: { label: string; value: RideFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function getStatusClasses(status: AdminRideStatus) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
    case "completed":
      return "border-sky-200 bg-sky-100 text-sky-700";
    case "cancelled":
      return "border-rose-200 bg-rose-100 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default function RidesPage() {
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RideFilter>("all");
  const [selectedRide, setSelectedRide] = useState<AdminRideDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRides() {
      setStatus("loading");
      setError(null);

      try {
        const data = await fetchAdminRides(
          filter === "all" ? undefined : filter,
        );
        setRides(data.rides || []);
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load rides");
        setStatus("error");
      }
    }

    loadRides();
  }, [filter]);

  const totalRides = rides.length;

  const activeCount = useMemo(
    () => rides.filter((ride) => ride.status === "active").length,
    [rides],
  );
  function closeRideDetail() {
    setSelectedRide(null);
    setDetailError(null);
  }
  async function handleOpenRideDetail(rideId: string) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const data = await fetchAdminRideDetail(rideId);
      setSelectedRide(data.ride);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Unable to load ride details",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              Ride management
            </span>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Monitor rides across the platform.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                View ride activity, filter by status, and track which drivers
                are currently publishing trips on Travia.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Visible rides
            </p>
            <p className="mt-2 text-3xl font-bold text-sky-900">{totalRides}</p>
            <p className="mt-1 text-xs text-sky-700">
              {activeCount} active in current view
            </p>
          </div>
        </div>
      </section>

      {/* Filter + list */}
      <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Platform Rides
            </h2>
            <p className="text-sm text-slate-500">
              {totalRides} ride{totalRides === 1 ? "" : "s"} shown
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const isActive = filter === item.value;

              return (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {status === "loading" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-52 animate-pulse rounded-3xl bg-slate-100" />
            <div className="h-52 animate-pulse rounded-3xl bg-slate-100" />
            <div className="h-52 animate-pulse rounded-3xl bg-slate-100" />
            <div className="h-52 animate-pulse rounded-3xl bg-slate-100" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {status === "ready" && rides.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-lg font-medium text-slate-700">No rides found</p>
            <p className="mt-2 text-sm text-slate-500">
              There are no rides available for the selected filter.
            </p>
          </div>
        )}
        {status === "ready" && rides.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {rides.map((ride) => (
              <div
                key={ride.id}
                onClick={() => handleOpenRideDetail(ride.id)}
                className="cursor-pointer rounded-3xl border border-slate-200 bg-slate-50/70 p-5 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {detailLoading && (
                  <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                    Loading ride details...
                  </div>
                )}

                {detailError && (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {detailError}
                  </div>
                )}
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {ride.pickupAddress} → {ride.dropoffAddress}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Driver: {ride.driver?.name || "Unknown Driver"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {ride.driver?.email || "No driver email"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                            ride.status,
                          )}`}
                        >
                          {ride.status}
                        </span>

                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          PKR {ride.price}
                        </span>

                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {ride.seatsTotal} seats
                        </span>

                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {ride._count.bookings} bookings
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 lg:min-w-52">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Created
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {formatDate(ride.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Departure Time
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {formatDateTime(ride.departureTime)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ride ID
                      </p>
                      <p className="mt-2 truncate text-sm font-medium text-slate-900">
                        {ride.id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-4xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Ride Detail
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {selectedRide.pickupAddress} → {selectedRide.dropoffAddress}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Driver: {selectedRide.driver.name} •{" "}
                  {selectedRide.driver.email}
                </p>
              </div>

              <button
                onClick={closeRideDetail}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </p>
                  <p className="mt-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                        selectedRide.status,
                      )}`}
                    >
                      {selectedRide.status}
                    </span>
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Price
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    PKR {selectedRide.price}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Seats
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {selectedRide.seatsTotal} total •{" "}
                    {selectedRide._count.bookings} bookings
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reviews
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {selectedRide._count.reviews}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Route Information
                  </p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Pickup
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {selectedRide.pickupAddress}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Dropoff
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {selectedRide.dropoffAddress}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Departure
                        </p>
                        <p className="mt-1 text-sm text-slate-900">
                          {formatDateTime(selectedRide.departureTime)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Created
                        </p>
                        <p className="mt-1 text-sm text-slate-900">
                          {formatDateTime(selectedRide.createdAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Distance
                        </p>
                        <p className="mt-1 text-sm text-slate-900">
                          {selectedRide.distanceMeters
                            ? `${(selectedRide.distanceMeters / 1000).toFixed(1)} km`
                            : "N/A"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Duration
                        </p>
                        <p className="mt-1 text-sm text-slate-900">
                          {selectedRide.durationSeconds
                            ? `${Math.round(selectedRide.durationSeconds / 60)} min`
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Notes
                      </p>
                      <p className="mt-1 text-sm text-slate-900">
                        {selectedRide.notes || "No notes added"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Driver Information
                  </p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedRide.driver.name}
                      </p>
                      <p className="text-sm text-slate-600">
                        {selectedRide.driver.email}
                      </p>
                      <p className="text-sm text-slate-500">
                        {selectedRide.driver.phone || "No phone provided"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        Driver status: {selectedRide.driver.driverStatus}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Vehicle
                      </p>

                      {selectedRide.driver.vehicle ? (
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <p>
                            <span className="font-medium text-slate-900">
                              Model:
                            </span>{" "}
                            {selectedRide.driver.vehicle.carModel}
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">
                              Type:
                            </span>{" "}
                            {selectedRide.driver.vehicle.carType || "N/A"}
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">
                              Engine:
                            </span>{" "}
                            {selectedRide.driver.vehicle.engineCC
                              ? `${selectedRide.driver.vehicle.engineCC} cc`
                              : "N/A"}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          No vehicle information available
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Bookings
                </p>

                <div className="mt-4 space-y-3">
                  {selectedRide.bookings.length > 0 ? (
                    selectedRide.bookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {booking.passenger.name}
                            </p>
                            <p className="text-sm text-slate-600">
                              {booking.passenger.email}
                            </p>
                            <p className="text-sm text-slate-500">
                              {booking.passenger.phone || "No phone provided"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {booking.seatsRequested} seat
                              {booking.seatsRequested === 1 ? "" : "s"}
                            </span>
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                              {booking.status}
                            </span>
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {formatDateTime(booking.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No bookings found for this ride
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Internal Identifiers
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Ride ID
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-900">
                      {selectedRide.id}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Driver ID
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-900">
                      {selectedRide.driver.id}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
