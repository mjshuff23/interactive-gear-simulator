import { describe, expect, it } from "vitest";
import { gearSystemSchema } from "../schema/gear-system-schema";
import {
  calculateMeshPhaseOffset,
  pitchRadius,
  validateConnections,
} from "../simulation/gear-geometry";
import { solveGearSystem } from "../simulation/gear-system";
import {
  GUIDED_EXAMPLES,
  GUIDED_EXAMPLE_IDS,
  getGuidedExample,
} from "./guided-examples";

const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 620;

const MAX_SIZES = {
  "clock-train": { gears: 8, connections: 7 },
  "harmonic-divisions": { gears: 4, connections: 3 },
  "compound-axle": { gears: 4, connections: 3 },
  "fraction-angle": { gears: 2, connections: 1 },
} as const;

describe("guided example registry", () => {
  it("contains exactly the four required ids in stable order", () => {
    expect(GUIDED_EXAMPLE_IDS).toEqual([
      "clock-train",
      "harmonic-divisions",
      "compound-axle",
      "fraction-angle",
    ]);
    expect(GUIDED_EXAMPLES.map((example) => example.id)).toEqual([
      ...GUIDED_EXAMPLE_IDS,
    ]);
  });

  it("has unique ids", () => {
    const ids = GUIDED_EXAMPLES.map((example) => example.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(GUIDED_EXAMPLES)("$id", (example) => {
    it("produces a schema-valid system", () => {
      expect(() =>
        gearSystemSchema.parse(example.createSystem()),
      ).not.toThrow();
    });

    it("returns fresh, deeply equal instances on each call", () => {
      const first = example.createSystem();
      const second = example.createSystem();

      expect(second).toEqual(first);
      expect(second).not.toBe(first);
      expect(second.gears).not.toBe(first.gears);
      expect(second.gears[0]).not.toBe(first.gears[0]);
      expect(second.connections).not.toBe(first.connections);
    });

    it("keeps base-60 degree units", () => {
      const system = example.createSystem();

      expect(system.base).toBe(60);
      expect(system.units).toBe("degrees");
    });

    it("selects an existing gear by default", () => {
      const system = example.createSystem();

      expect(
        system.gears.some((gear) => gear.id === example.defaultSelectedGearId),
      ).toBe(true);
    });

    it("configures exactly one driver", () => {
      const system = example.createSystem();

      expect(system.drivers).toHaveLength(1);
      expect(system.gears.filter((gear) => gear.isDriver)).toHaveLength(1);
      expect(system.gears.find((gear) => gear.isDriver)?.id).toBe(
        system.drivers[0],
      );
    });

    it("does not persist derived radius or ratio fields", () => {
      const system = example.createSystem();

      expect(system.gears.every((gear) => !("radius" in gear))).toBe(true);
      expect(
        system.connections.every((connection) => !("ratio" in connection)),
      ).toBe(true);
    });

    it("stores compound gears at shared axle positions", () => {
      const system = example.createSystem();
      const gearsById = new Map(system.gears.map((gear) => [gear.id, gear]));

      for (const connection of system.connections) {
        if (connection.kind !== "compound") {
          continue;
        }

        const source = gearsById.get(connection.sourceGearId);
        const target = gearsById.get(connection.targetGearId);

        expect(target?.position).toEqual(source?.position);
      }
    });

    it("meshes gears with matching modules at tangent pitch circles", () => {
      const system = example.createSystem();
      const gearsById = new Map(system.gears.map((gear) => [gear.id, gear]));

      for (const connection of system.connections) {
        if (connection.kind !== "mesh") {
          continue;
        }

        const source = gearsById.get(connection.sourceGearId);
        const target = gearsById.get(connection.targetGearId);

        if (!source || !target) {
          throw new Error(`Dangling connection ${connection.id}`);
        }

        expect(source.module).toBe(target.module);

        const centerDistance = Math.hypot(
          source.position.x - target.position.x,
          source.position.y - target.position.y,
        );

        expect(centerDistance).toBeCloseTo(
          pitchRadius(source) + pitchRadius(target),
          6,
        );
      }
    });

    it("stores mesh phase offsets calculated from initial geometry", () => {
      const system = example.createSystem();
      const gearsById = new Map(system.gears.map((gear) => [gear.id, gear]));

      for (const connection of system.connections) {
        if (connection.kind !== "mesh") {
          continue;
        }

        const source = gearsById.get(connection.sourceGearId);
        const target = gearsById.get(connection.targetGearId);

        if (!source || !target) {
          throw new Error(`Dangling connection ${connection.id}`);
        }

        expect(connection.phaseOffset).toBe(
          calculateMeshPhaseOffset(source, target),
        );
      }
    });

    it("uses idealized pitch radii and stays inside the canvas", () => {
      const system = example.createSystem();

      for (const gear of system.gears) {
        const radius = pitchRadius(gear);

        expect(gear.position.x - radius).toBeGreaterThanOrEqual(0);
        expect(gear.position.x + radius).toBeLessThanOrEqual(CANVAS_WIDTH);
        expect(gear.position.y - radius).toBeGreaterThanOrEqual(0);
        expect(gear.position.y + radius).toBeLessThanOrEqual(CANVAS_HEIGHT);
      }
    });

    it("loads with every connection pitch-geometry valid and unjammed", () => {
      const validation = validateConnections(example.createSystem());

      expect(
        Object.values(validation.byConnectionId).every(
          (connection) => connection.isGeometricallyValid,
        ),
      ).toBe(true);
      expect(validation.jammedComponents).toEqual([]);
    });

    it("respects the maximum gear and connection counts", () => {
      const system = example.createSystem();
      const limits = MAX_SIZES[example.id];

      expect(system.gears.length).toBeLessThanOrEqual(limits.gears);
      expect(system.connections.length).toBeLessThanOrEqual(limits.connections);
    });
  });
});

describe("clock-train math", () => {
  it("solves the hour, minute, and second shafts to clock-hand speeds", () => {
    const system = getGuidedExample("clock-train").createSystem();
    const solved = solveGearSystem(system, 0);

    expect(solved.framesByGear["hour-wheel"]?.rpm).toBeCloseTo(1 / 720, 10);
    expect(solved.framesByGear["minute-pinion"]?.rpm).toBeCloseTo(1 / 60, 10);
    expect(solved.framesByGear["second-pinion"]?.rpm).toBeCloseTo(1, 10);
  });

  it("demonstrates 12x, 60x, and 720x relative speeds", () => {
    const system = getGuidedExample("clock-train").createSystem();
    const solved = solveGearSystem(system, 0);
    const hour = solved.framesByGear["hour-wheel"]?.rpm ?? Number.NaN;
    const minute = solved.framesByGear["minute-pinion"]?.rpm ?? Number.NaN;
    const second = solved.framesByGear["second-pinion"]?.rpm ?? Number.NaN;

    expect(minute / hour).toBeCloseTo(12, 10);
    expect(second / minute).toBeCloseTo(60, 10);
    expect(second / hour).toBeCloseTo(720, 10);
  });
});

describe("harmonic-divisions math", () => {
  it("solves followers to 2x, 3x, and 4x the driver rpm", () => {
    const system = getGuidedExample("harmonic-divisions").createSystem();
    const solved = solveGearSystem(system, 0);
    const driver = solved.framesByGear["reference-60"]?.rpm ?? Number.NaN;

    expect(solved.framesByGear["half-30"]?.rpm).toBeCloseTo(driver * 2, 10);
    expect(solved.framesByGear["third-20"]?.rpm).toBeCloseTo(driver * 3, 10);
    expect(solved.framesByGear["quarter-15"]?.rpm).toBeCloseTo(driver * 4, 10);
  });
});

describe("compound-axle math", () => {
  it("solves the output to 6x the driver rpm through a 3x2 compound train", () => {
    const system = getGuidedExample("compound-axle").createSystem();
    const solved = solveGearSystem(system, 0);
    const driver = solved.framesByGear["input-60"]?.rpm ?? Number.NaN;
    const axlePinion = solved.framesByGear["idler-pinion-20"];
    const axleWheel = solved.framesByGear["axle-wheel-30"];

    expect(axlePinion?.rpm).toBeCloseTo(driver * 3, 10);
    expect(axleWheel?.rpm).toBeCloseTo(axlePinion?.rpm ?? Number.NaN, 10);
    expect(axleWheel?.direction).toBe(axlePinion?.direction);
    expect(solved.framesByGear["output-15"]?.rpm).toBeCloseTo(driver * 6, 10);
  });
});

describe("fraction-angle math", () => {
  it("initially exposes the 72 degree selected reference", () => {
    const example = getGuidedExample("fraction-angle");
    const system = example.createSystem();
    const solved = solveGearSystem(system, 0);

    expect(example.defaultSelectedGearId).toBe("fifth-12");
    expect(solved.framesByGear["fifth-12"]?.angleDegrees).toBeCloseTo(72, 10);
  });

  it("produces a 5:1 speed relationship", () => {
    const system = getGuidedExample("fraction-angle").createSystem();
    const solved = solveGearSystem(system, 0);
    const driver = solved.framesByGear["tick-60"]?.rpm ?? Number.NaN;

    expect(solved.framesByGear["fifth-12"]?.rpm).toBeCloseTo(driver * 5, 10);
  });

  it("keeps logical lesson angles separate from phase-aligned tooth marks", () => {
    const system = getGuidedExample("fraction-angle").createSystem();
    const atStart = solveGearSystem(system, 0);
    const later = solveGearSystem(system, 1.5);

    expect(atStart.framesByGear["fifth-12"]?.angleDegrees).toBeCloseTo(72, 10);
    expect(atStart.framesByGear["tick-60"]?.toothAngleDegrees).toBeCloseTo(
      0,
      10,
    );
    expect(atStart.framesByGear["fifth-12"]?.toothAngleDegrees).toBeCloseTo(
      165,
      10,
    );
    expect(later.framesByGear["tick-60"]?.toothAngleDegrees).toBeCloseTo(9, 10);
    expect(later.framesByGear["fifth-12"]?.toothAngleDegrees).toBeCloseTo(
      120,
      10,
    );
    expect(later.framesByGear["fifth-12"]?.angleDegrees).toBeCloseTo(27, 10);
  });
});
