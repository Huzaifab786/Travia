export default function BookingsPage() {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
          Bookings
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Bookings management
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          This page will show booking activity, booking status, and admin actions.
        </p>
      </div>
    </div>
  );
}