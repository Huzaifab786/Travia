"use client";

import { useEffect, useState } from "react";
import {
  fetchPricingSettings,
  updatePricingSettings,
} from "@/lib/admin-pricing";
import type { AdminPricingSettings } from "@/types/pricing";

type Status = "loading" | "ready" | "error";

export default function PricingPage() {
  const [pricing, setPricing] = useState<AdminPricingSettings | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fuelPrice, setFuelPrice] = useState("");
  const [routeRadius, setRouteRadius] = useState("5");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPricing() {
      setStatus("loading");
      setError(null);

      try {
        const data = await fetchPricingSettings();
        setPricing(data.pricingSettings);
        setFuelPrice(data.pricingSettings.fuelPricePerLitre.toString());
        setRouteRadius(data.pricingSettings.routeRadiusKm.toString());
        setStatus("ready");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load pricing settings",
        );
        setStatus("error");
      }
    }

    loadPricing();
  }, []);

  async function handleSave() {
    const parsedFuelPrice = Number(fuelPrice);

    if (!Number.isFinite(parsedFuelPrice) || parsedFuelPrice <= 0) {
      setMessage("Please enter a valid fuel price per litre.");
      return;
    }

    const parsedRouteRadius = Number(routeRadius);
    if (
      !Number.isFinite(parsedRouteRadius) ||
      parsedRouteRadius < 2 ||
      parsedRouteRadius > 5
    ) {
      setMessage("Route radius must be between 2 and 5 km.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const data = await updatePricingSettings(
        parsedFuelPrice,
        parsedRouteRadius,
      );
      setPricing(data.pricingSettings);
      setFuelPrice(data.pricingSettings.fuelPricePerLitre.toString());
      setRouteRadius(data.pricingSettings.routeRadiusKm.toString());
      setMessage("Pricing settings updated successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to save pricing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              Pricing settings
            </span>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Manage the shared-fare fuel price from one place.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                This fuel rate is used by the backend for all new ride quotes,
                so passengers always see the same transparent per-seat fare.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Current fuel price
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-900">
              PKR {pricing?.fuelPricePerLitre ?? "N/A"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-4xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">
              Fuel price per litre
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Enter the current fuel price in PKR per litre. Drivers no longer
              control this value, so the fare calculation stays centralized and
              consistent across the platform.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Fuel price per litre
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              placeholder="e.g. 270"
            />
          </div>

          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Route radius (km)
            </label>
            <input
              type="number"
              min="2"
              max="5"
              step="0.5"
              value={routeRadius}
              onChange={(e) => setRouteRadius(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              placeholder="e.g. 5"
            />
          </div>

          {message && (
            <div
              className={`mt-5 rounded-3xl px-4 py-4 text-sm ${
                message.includes("successfully")
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {message}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save fuel price"}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-4xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fare formula
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>
                Shared fare per seat = route fuel cost ÷ total riders
              </p>
              <p>
                Route fuel cost = distance km ÷ vehicle km per litre × fuel
                price per litre
              </p>
              <p>No service fee is added.</p>
              <p>Route radius is configurable between 2 and 5 km.</p>
            </div>
          </div>

          <div className="rounded-4xl border border-slate-200/80 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Updated at
            </p>
            <p className="mt-3 text-lg font-semibold">
              {pricing ? new Date(pricing.updatedAt).toLocaleString() : "N/A"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Any new ride created after this update will use the latest fuel
              price automatically.
            </p>
          </div>
        </aside>
      </section>

      {status === "loading" && (
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 text-sm text-slate-500">
          Loading pricing settings...
        </div>
      )}

      {status === "error" && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
