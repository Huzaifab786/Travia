import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

// Ensure keys are present
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  console.warn("Missing Supabase URL or Anon Key. Authentication will fail.");
}

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
