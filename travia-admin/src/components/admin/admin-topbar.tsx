"use client";

import { useAdminAuth } from "@/components/admin-auth-provider";

export default function AdminTopbar() {
  const { user, logout } = useAdminAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Admin Panel</h2>
        <p className="text-sm text-slate-500">
          Welcome back{user?.name ? `, ${user.name}` : ""}
        </p>
      </div>

      <button
        onClick={logout}
        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Logout
      </button>
    </header>
  );
}