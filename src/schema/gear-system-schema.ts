import { z } from "zod";

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const gearNodeSchema = z.object({
  id: z.string(),
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
  id: z.string(),
  sourceGearId: z.string(),
  targetGearId: z.string(),
  kind: z.enum(["mesh", "compound"]),
  ratio: z.number().positive(),
  phaseOffset: z.number(),
});

export const gearSystemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  base: z.literal(60),
  units: z.literal("degrees"),
  gears: z.array(gearNodeSchema),
  connections: z.array(gearConnectionSchema),
  drivers: z.array(z.string()),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().positive(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
