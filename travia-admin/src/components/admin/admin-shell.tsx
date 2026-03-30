import type { ReactNode } from "react";
import AdminSidebar from "./admin-sidebar";
import AdminTopbar from "./admin-topbar";

type Props = {
  children: ReactNode;
};

export default function AdminShell({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}