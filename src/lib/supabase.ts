import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type GearSupabaseClient = SupabaseClient<Database>;

export type SupabaseConfiguration =
  | { status: "unconfigured" }
  | { status: "invalid"; message: string }
  | { status: "ready"; client: GearSupabaseClient };

let singletonClient: SupabaseConfiguration | null = null;

export function getSupabaseConfiguration(): SupabaseConfiguration {
  if (singletonClient) {
    return singletonClient;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url && !publishableKey) {
    singletonClient = { status: "unconfigured" };
    return singletonClient;
  }

  if (!url || !publishableKey) {
    singletonClient = {
      status: "invalid",
      message:
        "Both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be provided.",
    };
    return singletonClient;
  }

  try {
    new URL(url);
  } catch {
    singletonClient = {
      status: "invalid",
      message: "VITE_SUPABASE_URL is not a valid URL.",
    };
    return singletonClient;
  }

  const client = createClient<Database>(url, publishableKey);
  singletonClient = { status: "ready", client };

  return singletonClient;
}
