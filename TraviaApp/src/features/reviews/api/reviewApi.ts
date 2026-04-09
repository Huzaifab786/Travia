import { apiClient } from "../../../lib/api/client";

export type RideReview = {
  id: string;
  rideId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  reviewee?: {
    id: string;
    name: string;
    email: string;
  };
};

export const createReviewApi = (payload: {
  rideId: string;
  rating: number;
  comment?: string;
}) => {
  return apiClient<{ review: RideReview }>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getMyReviewForRideApi = (rideId: string) => {
  return apiClient<{ review: RideReview | null }>(`/api/reviews/ride/${rideId}`);
};