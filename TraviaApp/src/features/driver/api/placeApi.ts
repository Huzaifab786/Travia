import { apiClient } from "../../../lib/api/client";

export type PlaceSuggestion = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

export const searchPlacesApi = async (query: string, focusLat?: number, focusLng?: number) => {
  let url = `/api/places/search?q=${encodeURIComponent(query)}`;
  if (focusLat != null && focusLng != null) {
    url += `&focusLat=${focusLat}&focusLng=${focusLng}`;
  }
  return apiClient<{ places: PlaceSuggestion[] }>(url);
};

export const reverseGeocodeApi = async (lat: number, lng: number) => {
  return apiClient<{ place: PlaceSuggestion | null }>(
    `/api/places/reverse?lat=${lat}&lng=${lng}`
  );
};