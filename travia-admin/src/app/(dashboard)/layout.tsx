"use client";

import { AdminAuthProvider } from "@/components/admin-auth-provider";
import AdminShell from "@/components/admin/admin-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}