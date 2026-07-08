import type { GearSupabaseClient } from "../lib/supabase";
import { gearSystemSchema } from "../schema/gear-system-schema";
import type { GearSystem } from "../simulation/gear-system";

export async function saveGearSystem(
  client: GearSupabaseClient,
  gearSystem: GearSystem,
) {
  const definition = gearSystemSchema.parse(gearSystem);
  const { data, error } = await client
    .from("gear_systems")
    .upsert({
      id: gearSystem.id,
      name: gearSystem.name,
      definition,
      updated_at: new Date().toISOString(),
    })
    .select("id,name,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function loadGearSystems(client: GearSupabaseClient) {
  const { data, error } = await client
    .from("gear_systems")
    .select("id,name,definition,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((row) => gearSystemSchema.parse(row.definition));
}
