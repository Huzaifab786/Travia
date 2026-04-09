export type DriverDocumentCategory = "cnic" | "license" | "registration";
export type DriverDocumentSide = "front" | "back";
export type DriverVerificationDecision = "pending" | "approved" | "rejected";
export type DriverAdminDecision = "pending" | "approved" | "suspended";

export type AdminDriverDocument = {
  id: string;
  category: DriverDocumentCategory | null;
  side: DriverDocumentSide | null;
  type: string;
  url: string;
  path: string | null;
  ocrResult: unknown;
  ocrStatus: DriverVerificationDecision;
  ocrReason: string | null;
  createdAt: string;
};

export type AdminDriverVerification = {
  id: string;
  userId: string;
  autoDecision: DriverVerificationDecision;
  autoReason: string | null;
  autoResult: unknown;
  adminDecision: DriverAdminDecision;
  adminReason: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: AdminDriverDocument[];
};

export type AdminDriver = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  driverStatus: string;
  driverRejectionReason: string | null;
  createdAt: string;
  driverVerification: AdminDriverVerification | null;
  _count?: {
    rides: number;
    driverDocuments: number;
  };
};
