import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDED_EXAMPLE } from "../data/guided-examples";
import { gearSystemSchema } from "./gear-system-schema";

describe("gearSystemSchema", () => {
  it("rejects legacy persisted radius and ratio fields", () => {
    const system = DEFAULT_GUIDED_EXAMPLE.createSystem();
    const result = gearSystemSchema.safeParse({
      ...system,
      gears: system.gears.map((gear, index) =>
        index === 0 ? { ...gear, radius: 999 } : gear,
      ),
      connections: system.connections.map((connection, index) =>
        index === 0 ? { ...connection, ratio: 999 } : connection,
      ),
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate gear ids", () => {
    const system = DEFAULT_GUIDED_EXAMPLE.createSystem();
    const duplicateId = system.gears[0].id;

    const result = gearSystemSchema.safeParse({
      ...system,
      gears: [
        system.gears[0],
        {
          ...system.gears[1],
          id: duplicateId,
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) =>
        issue.message.includes(`Duplicate gear id "${duplicateId}"`),
      ),
    ).toBe(true);
  });

  it("rejects duplicate connection ids", () => {
    const system = DEFAULT_GUIDED_EXAMPLE.createSystem();
    const duplicateId = system.connections[0].id;

    const result = gearSystemSchema.safeParse({
      ...system,
      connections: [
        system.connections[0],
        { ...system.connections[1], id: duplicateId },
        ...system.connections.slice(2),
      ],
    });

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) =>
        issue.message.includes(`Duplicate connection id "${duplicateId}"`),
      ),
    ).toBe(true);
  });
});
