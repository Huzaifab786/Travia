"use client";

import type { ReactNode } from "react";
import AdminSidebar from "./admin-sidebar";
import AdminTopbar from "./admin-topbar";

type Props = {
  children: ReactNode;
};

export default function AdminShell({ children }: Props) {
  return (
    <div className="h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 z-30 h-screen w-72 border-r border-slate-200 bg-white">
        <div className="h-full overflow-y-auto">
          <AdminSidebar />
        </div>
      </aside>

      <div className="ml-72 flex h-screen min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}