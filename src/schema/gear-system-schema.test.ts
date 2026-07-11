import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDED_EXAMPLE } from "../data/guided-examples";
import { gearSystemSchema } from "./gear-system-schema";

describe("gearSystemSchema", () => {
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
});
