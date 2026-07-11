import type { GearSupabaseClient } from "../lib/supabase";
import { gearSystemSchema } from "../schema/gear-system-schema";
import type { GearSystem } from "../simulation/gear-system";
import {
  extractGearSystemDefinition,
  CURRENT_GEAR_SYSTEM_DEFINITION_VERSION,
} from "./gear-system-definition";
import type { Json } from "../lib/database.types";

export interface SavedGearSystemSummary {
  id: string;
  name: string;
  definitionVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type PersistenceError =
  | { type: "AUTH_REQUIRED"; cause?: unknown }
  | { type: "NOT_FOUND_OR_FORBIDDEN"; cause?: unknown }
  | { type: "STALE_WRITE"; cause?: unknown }
  | { type: "INVALID_DEFINITION"; cause?: unknown }
  | { type: "UNSUPPORTED_DEFINITION_VERSION"; cause?: unknown }
  | { type: "PAYLOAD_TOO_LARGE"; cause?: unknown }
  | { type: "NETWORK_ERROR"; cause?: unknown }
  | { type: "UNKNOWN"; cause?: unknown };

export class PersistenceException extends Error {
  constructor(
    public readonly type: PersistenceError["type"],
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PersistenceException";
  }
}

export async function listSavedGearSystems(
  client: GearSupabaseClient,
): Promise<SavedGearSystemSummary[]> {
  const { data, error } = await client
    .from("gear_systems")
    .select("id,name,definition_version,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true });

  if (error) {
    throw new PersistenceException("UNKNOWN", error.message, error);
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    definitionVersion: row.definition_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function loadSavedGearSystem(
  client: GearSupabaseClient,
  id: string,
): Promise<GearSystem> {
  const { data, error } = await client
    .from("gear_systems")
    .select("id,name,definition_version,definition,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error) {
    throw new PersistenceException(
      "NOT_FOUND_OR_FORBIDDEN",
      "System not found or access denied.",
      error,
    );
  }

  if (data.definition_version !== CURRENT_GEAR_SYSTEM_DEFINITION_VERSION) {
    throw new PersistenceException(
      "UNSUPPORTED_DEFINITION_VERSION",
      `Unsupported definition version: ${data.definition_version}`,
    );
  }

  const parsed = gearSystemSchema.safeParse({
    ...(data.definition as object),
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });

  if (!parsed.success) {
    throw new PersistenceException(
      "INVALID_DEFINITION",
      "Failed to parse gear system definition.",
      parsed.error,
    );
  }

  return parsed.data;
}

function checkPayloadSize(definition: unknown) {
  const payload = JSON.stringify(definition);
  // Encode to UTF-8
  const size = new Blob([payload]).size;
  if (size > 1048576) {
    throw new PersistenceException(
      "PAYLOAD_TOO_LARGE",
      "System definition exceeds 1 MiB limit.",
    );
  }
}

export async function createSavedGearSystem(
  client: GearSupabaseClient,
  system: GearSystem,
): Promise<GearSystem> {
  // Validate complete system before extracting
  gearSystemSchema.parse(system);

  const definition = extractGearSystemDefinition(system);
  checkPayloadSize(definition);

  const { data, error } = await client
    .from("gear_systems")
    .insert({
      name: system.name,
      definition: definition as unknown as Json,
      definition_version: CURRENT_GEAR_SYSTEM_DEFINITION_VERSION,
    })
    .select()
    .single();

  if (error) {
    throw new PersistenceException("UNKNOWN", error.message, error);
  }

  return {
    ...system,
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateSavedGearSystem(
  client: GearSupabaseClient,
  system: GearSystem,
  expectedUpdatedAt: string,
): Promise<GearSystem> {
  // Validate complete system before extracting
  gearSystemSchema.parse(system);

  const definition = extractGearSystemDefinition(system);
  checkPayloadSize(definition);

  const { data, error } = await client
    .from("gear_systems")
    .update({
      name: system.name,
      definition: definition as unknown as Json,
      definition_version: CURRENT_GEAR_SYSTEM_DEFINITION_VERSION,
    })
    .eq("id", system.id)
    .eq("updated_at", expectedUpdatedAt)
    .select()
    .maybeSingle();

  if (error) {
    throw new PersistenceException("UNKNOWN", error.message, error);
  }

  if (!data) {
    throw new PersistenceException(
      "STALE_WRITE",
      "The system was updated or deleted by another session.",
    );
  }

  return {
    ...system,
    name: data.name,
    updatedAt: data.updated_at,
  };
}

export async function renameSavedGearSystem(
  client: GearSupabaseClient,
  id: string,
  name: string,
  expectedUpdatedAt: string,
): Promise<SavedGearSystemSummary> {
  if (name.trim().length === 0 || name.trim().length > 120) {
    throw new PersistenceException(
      "INVALID_DEFINITION",
      "Name must be between 1 and 120 characters.",
    );
  }

  const { data, error } = await client
    .from("gear_systems")
    .update({ name: name.trim() })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id,name,definition_version,created_at,updated_at")
    .maybeSingle();

  if (error) {
    throw new PersistenceException("UNKNOWN", error.message, error);
  }

  if (!data) {
    throw new PersistenceException(
      "STALE_WRITE",
      "The system was updated or deleted by another session.",
    );
  }

  return {
    id: data.id,
    name: data.name,
    definitionVersion: data.definition_version,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteSavedGearSystem(
  client: GearSupabaseClient,
  id: string,
  expectedUpdatedAt: string,
): Promise<void> {
  const { data, error } = await client
    .from("gear_systems")
    .delete()
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new PersistenceException("UNKNOWN", error.message, error);
  }

  if (!data) {
    throw new PersistenceException(
      "STALE_WRITE",
      "The system was already updated or deleted by another session.",
    );
  }
}
