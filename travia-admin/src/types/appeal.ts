export type AccountAppealStatus = "pending" | "approved" | "rejected";

export type AccountAppealUser = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  accountStatus: string;
  accountSuspensionReason: string | null;
  accountSuspendedAt: string | null;
};

export type AccountAppealAdmin = {
  id: string;
  name: string | null;
  email: string;
};

export type AccountAppeal = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: string | null;
  message: string;
  status: AccountAppealStatus;
  adminNotes: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: AccountAppealUser | null;
  reviewedByAdmin: AccountAppealAdmin | null;
};

export type GetAccountAppealsResponse = {
  appeals: AccountAppeal[];
};

export type UpdateAccountAppealResponse = {
  appeal: AccountAppeal;
};
