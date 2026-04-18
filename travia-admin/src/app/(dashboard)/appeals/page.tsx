"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAccountAppeals, updateAccountAppeal } from "@/lib/admin-appeals";
import type { AccountAppeal, AccountAppealStatus } from "@/types/appeal";

type Status = "loading" | "ready" | "error";

function statusBadge(status: string) {
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString();
}

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<AccountAppeal[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setStatus("loading");
      setError(null);

      try {
        const data = await fetchAccountAppeals();
        if (!active) return;
        setAppeals(data.appeals || []);
        setStatus("ready");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load appeals");
        setStatus("error");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const pendingCount = useMemo(
    () => appeals.filter((appeal) => appeal.status === "pending").length,
    [appeals],
  );

  const selectedAppeal = useMemo(() => {
    if (!appeals.length) return null;
    return appeals.find((appeal) => appeal.id === selectedId) || appeals[0];
  }, [appeals, selectedId]);

  useEffect(() => {
    if (!selectedAppeal) {
      setSelectedId(null);
      setNotes("");
      return;
    }

    setSelectedId(selectedAppeal.id);
    setNotes(selectedAppeal.adminNotes || "");
  }, [selectedAppeal]);

  async function handleUpdateAppeal(
    appeal: AccountAppeal,
    nextStatus: AccountAppealStatus,
  ) {
    setActionLoadingId(appeal.id);

    try {
      const response = await updateAccountAppeal(appeal.id, {
        status: nextStatus,
        adminNotes: notes.trim() || undefined,
      });

      setAppeals((prev) =>
        prev.map((item) => (item.id === appeal.id ? response.appeal : item)),
      );
      setNotes(response.appeal.adminNotes || "");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to update appeal");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">
              Account appeals
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Review suspended-account unblock requests.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Users who are suspended can request a review here. Approving an appeal restores the account automatically.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pending requests
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{pendingCount}</p>
          </div>
        </div>
      </section>

      {status === "loading" && (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      )}

      {status === "error" && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {status === "ready" && (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            {appeals.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <p className="text-lg font-medium text-slate-700">
                  No account appeals yet
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  When a suspended user requests review, it will appear here.
                </p>
              </div>
            ) : (
              appeals.map((appeal) => {
                const active = appeal.id === selectedAppeal?.id;

                return (
                  <button
                    key={appeal.id}
                    type="button"
                    onClick={() => setSelectedId(appeal.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white shadow-md"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(
                          appeal.status,
                        )}`}
                      >
                        {appeal.status}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                        {appeal.role || "unknown role"}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className={`text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>
                        {appeal.name || appeal.email}
                      </p>
                      <p className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                        {appeal.message}
                      </p>
                      <p className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                        Submitted: {formatDateTime(appeal.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <aside className="rounded-4xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
            {!selectedAppeal ? (
              <div className="flex h-full min-h-96 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
                <div>
                  <p className="text-lg font-semibold text-slate-800">
                    Select an appeal
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    The user details, message, and action controls will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusBadge(
                        selectedAppeal.status,
                      )}`}
                    >
                      {selectedAppeal.status}
                    </span>
                  </div>

                  <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {selectedAppeal.name || selectedAppeal.email}
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    {selectedAppeal.message}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      User
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {selectedAppeal.user?.name || selectedAppeal.name || "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedAppeal.user?.email || selectedAppeal.email}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Account status
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {selectedAppeal.user?.accountStatus || "unknown"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedAppeal.user?.accountSuspensionReason || "No suspension note"}
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
                    placeholder="Leave a decision note or reason for the action taken..."
                    className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleUpdateAppeal(selectedAppeal, "approved")}
                    disabled={actionLoadingId === selectedAppeal.id}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve & Restore
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateAppeal(selectedAppeal, "rejected")}
                    disabled={actionLoadingId === selectedAppeal.id}
                    className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
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
