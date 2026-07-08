import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Database {
  public: {
    Tables: {
      gear_systems: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          definition: unknown;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          definition: unknown;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          definition?: unknown;
          thumbnail_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type GearSupabaseClient = SupabaseClient<Database>;

export function createGearSupabaseClient(): GearSupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return createClient<Database>(url, publishableKey);
}
