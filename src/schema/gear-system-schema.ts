import { z } from "zod";

const idSchema = z.string().min(1);

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const gearNodeSchema = z.object({
  id: idSchema,
  label: z.string(),
  teeth: z.number().int().min(6).max(240),
  module: z.number().positive(),
  radius: z.number().positive(),
  position: pointSchema,
  angle: z.number(),
  phase: z.number(),
  rpm: z.number().min(0),
  direction: z.enum(["clockwise", "counterclockwise"]),
  lockedAxle: z.boolean(),
  isDriver: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const gearConnectionSchema = z.object({
  id: idSchema,
  sourceGearId: idSchema,
  targetGearId: idSchema,
  kind: z.enum(["mesh", "compound"]),
  ratio: z.number().positive(),
  phaseOffset: z.number(),
});

export const gearSystemSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    base: z.literal(60),
    units: z.literal("degrees"),
    gears: z.array(gearNodeSchema),
    connections: z.array(gearConnectionSchema),
    drivers: z.array(idSchema),
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number().positive(),
    }),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((system, context) => {
    const gearIds = new Set<string>();
    const driverIds = new Set(system.drivers);

    system.gears.forEach((gear, index) => {
      if (gearIds.has(gear.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate gear id "${gear.id}".`,
          path: ["gears", index, "id"],
        });
      }

      gearIds.add(gear.id);
    });

    system.drivers.forEach((driverId, index) => {
      if (!gearIds.has(driverId)) {
        context.addIssue({
          code: "custom",
          message: `Driver "${driverId}" does not reference an existing gear.`,
          path: ["drivers", index],
        });
      }
    });

    system.gears.forEach((gear, index) => {
      if (gear.isDriver && !driverIds.has(gear.id)) {
        context.addIssue({
          code: "custom",
          message: `Driver gear "${gear.id}" is missing from drivers[].`,
          path: ["gears", index, "isDriver"],
        });
      }

      if (!gear.isDriver && driverIds.has(gear.id)) {
        context.addIssue({
          code: "custom",
          message: `Gear "${gear.id}" is listed in drivers[] but isDriver is false.`,
          path: ["gears", index, "isDriver"],
        });
      }
    });

    system.connections.forEach((connection, index) => {
      if (!gearIds.has(connection.sourceGearId)) {
        context.addIssue({
          code: "custom",
          message: `Connection source "${connection.sourceGearId}" does not reference an existing gear.`,
          path: ["connections", index, "sourceGearId"],
        });
      }

      if (!gearIds.has(connection.targetGearId)) {
        context.addIssue({
          code: "custom",
          message: `Connection target "${connection.targetGearId}" does not reference an existing gear.`,
          path: ["connections", index, "targetGearId"],
        });
      }
    });
  });
