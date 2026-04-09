"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/drivers", label: "Drivers" },
  { href: "/rides", label: "Rides" },
  { href: "/live-tracking", label: "Live Tracking" },
  { href: "/bookings", label: "Bookings" },
  { href: "/pricing", label: "Pricing" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-2xl font-bold text-slate-900">Travia Admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          Platform management panel
        </p>
      </div>

      <nav className="p-4">
        <ul className="space-y-2">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
