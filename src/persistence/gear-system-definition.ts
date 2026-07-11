import { gearSystemDefinitionSchema } from "../schema/gear-system-schema";
import type { GearSystem } from "../simulation/gear-system";
import { z } from "zod";

export const CURRENT_GEAR_SYSTEM_DEFINITION_VERSION = 1;

export type GearSystemDefinition = z.infer<typeof gearSystemDefinitionSchema>;

export function extractGearSystemDefinition(
  system: GearSystem,
): GearSystemDefinition {
  const definition = {
    base: 60,
    units: "degrees",
    gears: system.gears,
    connections: system.connections,
    drivers: system.drivers,
    viewport: system.viewport,
  };

  return gearSystemDefinitionSchema.parse(definition);
}
