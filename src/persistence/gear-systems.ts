import type { GearSupabaseClient } from "../lib/supabase";
import { gearSystemSchema } from "../schema/gear-system-schema";
import type { GearSystem } from "../simulation/gear-system";

export async function saveGearSystem(
  client: GearSupabaseClient,
  gearSystem: GearSystem,
) {
  const definition = gearSystemSchema.parse(gearSystem);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Cannot save a gear system without an authenticated user.");
  }

  const { data, error } = await client
    .from("gear_systems")
    .upsert({
      id: gearSystem.id,
      owner_id: user.id,
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

  return data.reduce<GearSystem[]>((systems, row) => {
    const parsed = gearSystemSchema.safeParse(row.definition);

    if (parsed.success) {
      systems.push(parsed.data);
    }

    return systems;
  }, []);
}
