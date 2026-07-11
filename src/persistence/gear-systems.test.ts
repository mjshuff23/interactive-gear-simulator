import { describe, expect, it } from "vitest";
import type { GearSupabaseClient } from "../lib/supabase";
import { createStarterSystem } from "../data/starter-system";
import { loadGearSystems, saveGearSystem } from "./gear-systems";

describe("gear system persistence", () => {
  it("saves without client-managed updated_at", async () => {
    const upsertPayloads: unknown[] = [];
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: () => ({
        upsert: (payload: unknown) => {
          upsertPayloads.push(payload);

          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "starter-clock-train",
                  name: "Clock Train Harmonics",
                  updated_at: "2026-07-10T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          };
        },
      }),
    } as unknown as GearSupabaseClient;

    await saveGearSystem(client, createStarterSystem());

    expect(upsertPayloads[0]).toMatchObject({
      id: "starter-clock-train",
      owner_id: "user-1",
      name: "Clock Train Harmonics",
    });
    expect(upsertPayloads[0]).not.toHaveProperty("updated_at");
  });

  it("loads valid systems with row-level updated_at and skips malformed definitions", async () => {
    const validSystem = createStarterSystem();
    const rowUpdatedAt = "2026-07-10T01:00:00.000Z";
    const client = {
      from: () => ({
        select: () => ({
          order: async () => ({
            data: [
              {
                id: validSystem.id,
                name: validSystem.name,
                definition: {
                  ...validSystem,
                  updatedAt: "2026-07-07T00:00:00.000Z",
                },
                updated_at: rowUpdatedAt,
              },
              {
                id: "broken",
                name: "Broken",
                definition: { id: "" },
                updated_at: rowUpdatedAt,
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as GearSupabaseClient;

    const systems = await loadGearSystems(client);

    expect(systems).toHaveLength(1);
    expect(systems[0].id).toBe(validSystem.id);
    expect(systems[0].updatedAt).toBe(rowUpdatedAt);
  });
});
