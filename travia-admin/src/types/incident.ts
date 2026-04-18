export type AdminIncidentKind = "sos" | "report";
export type AdminIncidentStatus = "open" | "acknowledged" | "resolved" | "closed";
export type AdminIncidentSeverity = "low" | "medium" | "high" | "critical";

export type AdminIncidentUser = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
};

export type AdminIncidentRide = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  departureTime: string;
  status: string;
  currentLat: number | null;
  currentLng: number | null;
  lastUpdate: string | null;
  driver: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
};

export type AdminIncident = {
  id: string;
  kind: AdminIncidentKind;
  category: string | null;
  severity: AdminIncidentSeverity;
  status: AdminIncidentStatus;
  message: string;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rideId: string;
  reporterId: string;
  reportedUserId: string | null;
  resolvedByAdminId: string | null;
  ride: AdminIncidentRide | null;
  reporter: AdminIncidentUser;
  reportedUser: AdminIncidentUser | null;
  resolvedByAdmin: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

export type GetAdminIncidentsResponse = {
  incidents: AdminIncident[];
};

export type UpdateAdminIncidentResponse = {
  incident: AdminIncident;
};
