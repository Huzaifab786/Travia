"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchAdminRides, fetchAdminRideDetail } from "@/lib/admin-rides";
import { fetchAdminRideLiveLocation } from "@/lib/admin-live";
import type {
  AdminRide,
  AdminRideDetail,
  AdminRideStatus,
} from "@/types/ride";

type PageStatus = "loading" | "ready" | "error";

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString();
}

function getStatusClasses(status: string) {
  switch (status) {
    case "in_progress":
      return "border-rose-200 bg-rose-100 text-rose-700";
    case "ready":
      return "border-amber-200 bg-amber-100 text-amber-700";
    case "active":
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
    case "completed":
      return "border-sky-200 bg-sky-100 text-sky-700";
    case "cancelled":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function buildMapUrl(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) {
    return null;
  }

  return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

export default function LiveTrackingPage() {
  const searchParams = useSearchParams();
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<AdminRideDetail | null>(
    null,
  );
  const [liveLocation, setLiveLocation] = useState<{
    lat: number | null;
    lng: number | null;
    lastUpdate: string | null;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveRides() {
      try {
        const data = await fetchAdminRides("in_progress");

        if (cancelled) {
          return;
        }

        setRides(data.rides || []);
        setStatus("ready");

        if (!selectedRideId && data.rides?.[0]) {
          setSelectedRideId(data.rides[0].id);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unable to load rides");
        setStatus("error");
      }
    }

    loadLiveRides();
    const timer = setInterval(loadLiveRides, 30000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedRideId]);

  useEffect(() => {
    const rideId = searchParams.get("rideId");

    if (!rideId) {
      return;
    }

    setSelectedRideId(rideId);
  }, [searchParams]);

  useEffect(() => {
    const rideId = selectedRideId as string | null;

    if (!rideId) {
      setSelectedRide(null);
      setLiveLocation(null);
      return;
    }

    const activeRideId = rideId;

    let cancelled = false;

    async function loadRideDetails() {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const [rideDetail, location] = await Promise.all([
          fetchAdminRideDetail(activeRideId),
          fetchAdminRideLiveLocation(activeRideId),
        ]);

        if (cancelled) {
          return;
        }

        setSelectedRide(rideDetail.ride);
        setLiveLocation(location);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setDetailError(
          err instanceof Error ? err.message : "Unable to load ride details",
        );
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadRideDetails();
    const timer = setInterval(loadRideDetails, 20000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedRideId]);

  const selectedRideSummary = useMemo(() => {
    const acceptedBooking = selectedRide?.bookings?.find(
      (booking) => booking.status === "accepted",
    );

    return {
      acceptedBooking,
      passenger: acceptedBooking?.passenger ?? null,
    };
  }, [selectedRide]);

  const mapUrl = buildMapUrl(
    liveLocation?.lat ?? selectedRide?.currentLat ?? selectedRide?.pickupLat ?? null,
    liveLocation?.lng ?? selectedRide?.currentLng ?? selectedRide?.pickupLng ?? null,
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
              Live monitoring
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Track any active ride in real time.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Watch the driver move live and reach the driver or passenger
                instantly if intervention is needed.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              In-progress rides
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {rides.length}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Updated every 30 seconds
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Active rides
              </h2>
              <p className="text-sm text-slate-500">
                Select a ride to inspect live movement.
              </p>
            </div>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              In progress
            </span>
          </div>

          {status === "loading" && (
            <div className="space-y-3">
              <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
            </div>
          )}

          {status === "error" && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {status === "ready" && rides.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-base font-medium text-slate-700">
                No rides are in progress right now
              </p>
              <p className="mt-2 text-sm text-slate-500">
                When a driver starts live broadcasting, the ride will appear
                here automatically.
              </p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {rides.map((ride) => {
              const active = ride.id === selectedRideId;

              return (
                <button
                  key={ride.id}
                  onClick={() => setSelectedRideId(ride.id)}
                  className={`w-full rounded-3xl border p-4 text-left transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-md"
                      : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className={`text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>
                        {ride.pickupAddress}
                      </p>
                      <p className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                        to {ride.dropoffAddress}
                      </p>
                      <p className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                        Driver: {ride.driver?.name || "Unknown"}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${getStatusClasses(
                        ride.status,
                      )}`}
                    >
                      {ride.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className={`${active ? "bg-white/10" : "bg-white"} rounded-2xl p-3`}>
                      <p className={active ? "text-slate-300" : "text-slate-500"}>
                        Last update
                      </p>
                      <p className={active ? "text-white" : "text-slate-900"}>
                        {formatDateTime(ride.lastUpdate)}
                      </p>
                    </div>
                    <div className={`${active ? "bg-white/10" : "bg-white"} rounded-2xl p-3`}>
                      <p className={active ? "text-slate-300" : "text-slate-500"}>
                        Seats
                      </p>
                      <p className={active ? "text-white" : "text-slate-900"}>
                        {ride.seatsTotal}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
          {detailLoading && (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              Loading live ride details...
            </div>
          )}

          {detailError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {detailError}
            </div>
          )}

          {selectedRide ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                        selectedRide.status,
                      )}`}
                    >
                      {selectedRide.status.replace("_", " ")}
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {selectedRide.pickupAddress} → {selectedRide.dropoffAddress}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Driver: {selectedRide.driver.name} •{" "}
                    {selectedRide.driver.phone || "No phone"}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Live status
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    Live position only
                  </p>
                  <p className="text-sm text-slate-500">Tracking live position</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Live coordinates
                  </p>
                  <p className="mt-2 text-sm text-slate-900">
                    {liveLocation?.lat != null && liveLocation?.lng != null
                      ? `${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)}`
                      : "Not available yet"}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Last update
                  </p>
                  <p className="mt-2 text-sm text-slate-900">
                    {formatDateTime(liveLocation?.lastUpdate)}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Passenger
                  </p>
                  <p className="mt-2 text-sm text-slate-900">
                    {selectedRideSummary.passenger?.name || "No accepted booking"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedRideSummary.passenger?.phone || "No passenger phone"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
                  {mapUrl ? (
                    <iframe
                      title="Live ride map"
                      src={mapUrl}
                      className="h-[420px] w-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">
                      Live map will appear when driver location is available.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Admin actions
                    </p>
                    <div className="mt-3 space-y-2">
                      {selectedRide.driver.phone ? (
                        <a
                          href={`tel:${selectedRide.driver.phone}`}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Call Driver
                        </a>
                      ) : (
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                          No driver phone available
                        </div>
                      )}

                      {selectedRideSummary.passenger?.phone ? (
                        <a
                          href={`tel:${selectedRideSummary.passenger.phone}`}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                        >
                          Call Passenger
                        </a>
                      ) : (
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                          No passenger phone available
                        </div>
                      )}

                      {mapUrl ? (
                        <a
                          href={mapUrl.replace("/embed", "")}
                          target="_blank"
                          rel="noreferrer"
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Open in Maps
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Monitoring note
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Use the contact buttons to coordinate with the driver or
                      passenger while the ride is live.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <p className="text-lg font-medium text-slate-700">
                Select a live ride to inspect it
              </p>
              <p className="mt-2 text-sm text-slate-500">
                The panel will show the route, latest coordinates, and contact
                actions.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
