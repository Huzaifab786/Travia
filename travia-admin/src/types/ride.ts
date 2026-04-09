export type AdminRideStatus =
  | "active"
  | "ready"
  | "in_progress"
  | "completed"
  | "cancelled";

export type AdminRide = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  departureTime: string;
  price: number;
  status: AdminRideStatus;
  seatsTotal: number;
  femaleOnly?: boolean;
  createdAt: string;
  driver: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    bookings: number;
  };
  currentLat?: number | null;
  currentLng?: number | null;
  lastUpdate?: string | null;
};

export type GetAdminRidesResponse = {
  rides: AdminRide[];
};

export type AdminRideBooking = {
  id: string;
  seatsRequested: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  passenger: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
};

export type AdminRideVehicle = {
  id: string;
  carModel: string;
  carType: string | null;
  engineCC: number | null;
  avgKmPerLitre: number;
  vehicleNumber: string | null;
  carImageUrl: string | null;
};

export type AdminRideDetail = {
  id: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  departureTime: string;
  price: number;
  seatsTotal: number;
  status: AdminRideStatus;
  femaleOnly?: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  currentLat: number | null;
  currentLng: number | null;
  lastUpdate: string | null;
  encodedPolyline?: string | null;
  driver: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    driverStatus: string;
    vehicle: AdminRideVehicle | null;
  };
  bookings: AdminRideBooking[];
  _count: {
    bookings: number;
    reviews: number;
  };
};

export type GetAdminRideDetailResponse = {
  ride: AdminRideDetail;
};
