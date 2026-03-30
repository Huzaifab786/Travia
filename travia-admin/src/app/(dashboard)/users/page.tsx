"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, readAdminToken } from "@/lib/admin-auth";

type User = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  driverStatus: string | null;
  createdAt: string;
};

type Status = "loading" | "ready" | "error";

function getRoleBadge(role: string) {
  if (role === "admin") {
    return "bg-violet-100 text-violet-700 border border-violet-200";
  }

  if (role === "driver") {
    return "bg-sky-100 text-sky-700 border border-sky-200";
  }

  return "bg-slate-100 text-slate-700 border border-slate-200";
}

function getStatusBadge(status: string | null) {
  if (status === "verified") {
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }

  if (status === "pending") {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }

  if (status === "rejected") {
    return "bg-rose-100 text-rose-700 border border-rose-200";
  }

  return "bg-slate-100 text-slate-500 border border-slate-200";
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadUsers() {
      setStatus("loading");
      setError(null);

      const token = readAdminToken();

      try {
        const res = await fetch(`${apiBaseUrl}/api/admin/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch users");
        }

        setUsers(data.users);
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
        setStatus("error");
      }
    }

    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    });
  }, [search, users]);

  const totalAdmins = users.filter((user) => user.role === "admin").length;
  const totalDrivers = users.filter((user) => user.role === "driver").length;
  const totalPassengers = users.filter((user) => user.role === "passenger").length;

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              Users management
            </span>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Manage platform users beautifully.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                View all registered users, quickly scan roles, and keep track of
                driver verification status from one clean admin table.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-90">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Admins
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{totalAdmins}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Drivers
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{totalDrivers}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Passengers
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{totalPassengers}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search + table card */}
      <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">All Users</h2>
            <p className="text-sm text-slate-500">
              {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"} shown
            </p>
          </div>

          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 sm:max-w-sm"
          />
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {status === "ready" && filteredUsers.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-lg font-medium text-slate-700">No users found</p>
            <p className="mt-2 text-sm text-slate-500">
              Try changing your search keywords.
            </p>
          </div>
        )}

        {status === "ready" && filteredUsers.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-225 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Name</th>
                    <th className="px-5 py-4 font-semibold">Email</th>
                    <th className="px-5 py-4 font-semibold">Phone</th>
                    <th className="px-5 py-4 font-semibold">Role</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Created</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {user.name || "Unnamed User"}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-700">{user.email}</td>

                      <td className="px-5 py-4 text-slate-600">
                        {user.phone || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getRoleBadge(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusBadge(
                            user.driverStatus
                          )}`}
                        >
                          {user.driverStatus || "N/A"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}