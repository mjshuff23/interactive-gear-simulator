import { describe, expect, it } from "vitest";
import type { GearSupabaseClient } from "../lib/supabase";
import { DEFAULT_GUIDED_EXAMPLE } from "../data/guided-examples";
import { loadSavedGearSystem, createSavedGearSystem } from "./gear-systems";

describe("gear system persistence", () => {
  it("creates without client-managed updated_at", async () => {
    const insertPayloads: unknown[] = [];
    const client = {
      from: () => ({
        insert: (payload: unknown) => {
          insertPayloads.push(payload);
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "123",
                  name: "Idealized Clock-Hand Ratio Train",
                  created_at: "2026-07-10T00:00:00.000Z",
                  updated_at: "2026-07-10T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          };
        },
      }),
    } as unknown as GearSupabaseClient;

    await createSavedGearSystem(client, DEFAULT_GUIDED_EXAMPLE.createSystem());

    expect(insertPayloads[0]).toMatchObject({
      name: "Idealized Clock-Hand Ratio Train",
    });
    expect(insertPayloads[0]).not.toHaveProperty("updated_at");
    expect(insertPayloads[0]).not.toHaveProperty("owner_id");
  });

  it("loads valid systems with row-level updated_at", async () => {
    const validSystem = DEFAULT_GUIDED_EXAMPLE.createSystem();
    const rowUpdatedAt = "2026-07-10T01:00:00.000Z";
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: validSystem.id,
                name: validSystem.name,
                definition_version: 1,
                definition: {
                  ...validSystem,
                  updatedAt: "2026-07-07T00:00:00.000Z", // should be overwritten
                },
                created_at: "2026-07-10T00:00:00.000Z",
                updated_at: rowUpdatedAt,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as GearSupabaseClient;

    const system = await loadSavedGearSystem(client, validSystem.id);
    expect(system.id).toBe(validSystem.id);
    expect(system.updatedAt).toBe(rowUpdatedAt);
  });

  it("rejects unsupported definition version", async () => {
    const validSystem = DEFAULT_GUIDED_EXAMPLE.createSystem();
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: validSystem.id,
                name: validSystem.name,
                definition_version: 2,
                definition: validSystem,
                created_at: "2026-07-10T00:00:00.000Z",
                updated_at: "2026-07-10T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as GearSupabaseClient;

    await expect(loadSavedGearSystem(client, validSystem.id)).rejects.toThrow(
      "Unsupported definition version",
    );
  });

  it("rejects legacy definitions with persisted derived geometry", async () => {
    const validSystem = DEFAULT_GUIDED_EXAMPLE.createSystem();
    const legacySystem = {
      ...validSystem,
      gears: validSystem.gears.map((gear, index) =>
        index === 0 ? { ...gear, radius: 60 } : gear,
      ),
      connections: validSystem.connections.map((connection, index) =>
        index === 0 ? { ...connection, ratio: 3 } : connection,
      ),
    };

    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: legacySystem.id,
                name: legacySystem.name,
                definition_version: 1,
                definition: legacySystem,
                created_at: "2026-07-10T00:00:00.000Z",
                updated_at: "2026-07-10T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as GearSupabaseClient;

    await expect(
      loadSavedGearSystem(client, legacySystem.id),
    ).rejects.toThrow();
  });
});
