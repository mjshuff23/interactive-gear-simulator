import { describe, expect, it } from "vitest";
import {
  formatSexagesimalAngle,
  solveGearSystem,
  type GearSystem,
} from "./gear-system";
import { validateConnections } from "./gear-geometry";

describe("solveGearSystem", () => {
  it("propagates inverse speed and direction across meshed gears", () => {
    const system: GearSystem = {
      id: "clock-demo",
      name: "Clock demo",
      base: 60,
      units: "degrees",
      viewport: { x: 0, y: 0, zoom: 1 },
      drivers: ["driver"],
      gears: [
        {
          id: "driver",
          label: "60T driver",
          teeth: 60,
          module: 4,
          position: { x: 0, y: 0 },
          angle: 0,
          phase: 0,
          rpm: 12,
          direction: "clockwise",
          lockedAxle: true,
          isDriver: true,
          color: "#c99743",
        },
        {
          id: "follower",
          label: "30T follower",
          teeth: 30,
          module: 4,
          position: { x: 180, y: 0 },
          angle: 0,
          phase: 0,
          rpm: 0,
          direction: "clockwise",
          lockedAxle: false,
          isDriver: false,
          color: "#5bb4ff",
        },
      ],
      connections: [
        {
          id: "driver-follower",
          sourceGearId: "driver",
          targetGearId: "follower",
          kind: "mesh",
          phaseOffset: 0,
        },
      ],
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
    };

    const solved = solveGearSystem(system, 2);

    expect(solved.framesByGear.driver.rpm).toBe(12);
    expect(solved.framesByGear.driver.direction).toBe("clockwise");
    expect(solved.framesByGear.driver.angleDegrees).toBe(144);
    expect(solved.framesByGear.follower.rpm).toBe(24);
    expect(solved.framesByGear.follower.direction).toBe("counterclockwise");
    expect(solved.framesByGear.follower.angleDegrees).toBe(72);
    expect(solved.framesByGear.driver.toothAngleDegrees).toBe(144);
    expect(solved.framesByGear.follower.toothAngleDegrees).toBe(72);
  });

  it("keeps compound axle gears on the same speed and direction", () => {
    const system: GearSystem = {
      id: "compound-demo",
      name: "Compound demo",
      base: 60,
      units: "degrees",
      viewport: { x: 0, y: 0, zoom: 1 },
      drivers: ["driver"],
      gears: [
        {
          id: "driver",
          label: "Driver",
          teeth: 20,
          module: 4,
          position: { x: 0, y: 0 },
          angle: 0,
          phase: 0,
          rpm: 6,
          direction: "counterclockwise",
          lockedAxle: true,
          isDriver: true,
          color: "#c99743",
        },
        {
          id: "coaxial",
          label: "Coaxial",
          teeth: 60,
          module: 4,
          position: { x: 0, y: 0 },
          angle: 10,
          phase: 15,
          rpm: 0,
          direction: "clockwise",
          lockedAxle: true,
          isDriver: false,
          color: "#89d185",
        },
      ],
      connections: [
        {
          id: "compound",
          sourceGearId: "driver",
          targetGearId: "coaxial",
          kind: "compound",
          phaseOffset: 15,
        },
      ],
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
    };

    const solved = solveGearSystem(system, 5);

    expect(solved.framesByGear.coaxial.rpm).toBe(6);
    expect(solved.framesByGear.coaxial.direction).toBe("counterclockwise");
    expect(solved.framesByGear.coaxial.angleDegrees).toBe(205);
    expect(solved.framesByGear.coaxial.toothAngleDegrees).toBe(195);
  });

  it("traverses a valid stored connection from target to source", () => {
    const driver = testGear("driver", 0, 0, 40, {
      isDriver: true,
      rpm: 6,
    });
    const follower = testGear("follower", 30, 0, 20);
    const system = testSystem(
      [driver, follower],
      [testConnection("reverse", "follower", "driver")],
      [driver.id],
    );

    const solved = solveGearSystem(system, 0);

    expect(solved.framesByGear.follower.rpm).toBe(12);
    expect(solved.framesByGear.follower.direction).toBe("counterclockwise");
  });

  it("stops propagation at invalid geometry and ignores stale follower rpm", () => {
    const driver = testGear("driver", 0, 0, 20, {
      isDriver: true,
      rpm: 10,
    });
    const middle = testGear("middle", 20, 0);
    const stopped = testGear("stopped", 50, 0, 20, {
      angle: 35,
      phase: 5,
      rpm: 99,
    });
    const system = testSystem(
      [driver, middle, stopped],
      [
        testConnection("driver-middle", "driver", "middle"),
        testConnection("middle-stopped", "middle", "stopped"),
      ],
      [driver.id],
    );

    const solved = solveGearSystem(system, 1);

    expect(solved.framesByGear.middle.rpm).toBe(10);
    expect(solved.framesByGear.stopped).toMatchObject({
      rpm: 0,
      direction: "clockwise",
      angleDegrees: 40,
    });
  });

  it("uses a caller-supplied validation result without recomputing it", () => {
    const driver = testGear("driver", 0, 0, 20, {
      isDriver: true,
      rpm: 10,
    });
    const follower = testGear("follower", 20, 0);
    const system = testSystem(
      [driver, follower],
      [testConnection("mesh", "driver", "follower")],
      [driver.id],
    );
    const computed = validateConnections(system);
    const supplied = {
      ...computed,
      byConnectionId: {
        ...computed.byConnectionId,
        mesh: {
          ...computed.byConnectionId.mesh,
          isGeometricallyValid: false,
          issueCodes: ["mesh-distance" as const],
        },
      },
    };

    expect(solveGearSystem(system, 0, supplied).framesByGear.follower.rpm).toBe(
      0,
    );
  });

  it("zeros every gear in a jammed component including its driver", () => {
    const height = Math.sqrt(300);
    const driver = testGear("a", 0, 0, 20, {
      isDriver: true,
      rpm: 10,
    });
    const system = testSystem(
      [driver, testGear("b", 20, 0), testGear("c", 10, height)],
      [
        testConnection("ab", "a", "b"),
        testConnection("bc", "b", "c"),
        testConnection("ca", "c", "a"),
      ],
      [driver.id],
    );

    const solved = solveGearSystem(system, 3);

    expect(
      Object.values(solved.framesByGear).map((frame) => frame.rpm),
    ).toEqual([0, 0, 0]);
    expect(solved.framesByGear.a.angleDegrees).toBe(0);
  });

  it("continues solving a healthy disconnected component beside a jam", () => {
    const height = Math.sqrt(300);
    const jammedDriver = testGear("a", 0, 0, 20, {
      isDriver: true,
      rpm: 10,
    });
    const healthyDriver = testGear("healthy-driver", 100, 0, 20, {
      isDriver: true,
      rpm: 4,
    });
    const system = testSystem(
      [
        jammedDriver,
        testGear("b", 20, 0),
        testGear("c", 10, height),
        healthyDriver,
        testGear("healthy-follower", 120, 0),
      ],
      [
        testConnection("ab", "a", "b"),
        testConnection("bc", "b", "c"),
        testConnection("ca", "c", "a"),
        testConnection("healthy", "healthy-driver", "healthy-follower"),
      ],
      [jammedDriver.id, healthyDriver.id],
    );

    const solved = solveGearSystem(system, 0);

    expect(solved.framesByGear.a.rpm).toBe(0);
    expect(solved.framesByGear["healthy-driver"].rpm).toBe(4);
    expect(solved.framesByGear["healthy-follower"]).toMatchObject({
      rpm: 4,
      direction: "counterclockwise",
    });
  });

  it("algebraically inverts stored mesh tooth phase during reverse traversal", () => {
    const source = testGear("source", 0, 0, 60);
    const target = testGear("target", 40, 0, 20, {
      angle: 171,
      direction: "counterclockwise",
      isDriver: true,
      rpm: 3,
    });
    const system = testSystem(
      [source, target],
      [
        {
          ...testConnection("mesh", "source", "target"),
          phaseOffset: 171,
        },
      ],
      [target.id],
    );

    const solved = solveGearSystem(system, 2);

    expect(solved.framesByGear.source).toMatchObject({
      rpm: 1,
      direction: "clockwise",
      toothAngleDegrees: 12,
    });
    expect(solved.framesByGear.target.toothAngleDegrees).toBe(135);
    expect(
      normalizeForTest(
        solved.framesByGear.target.toothAngleDegrees +
          3 * solved.framesByGear.source.toothAngleDegrees,
      ),
    ).toBe(171);
  });
});

describe("formatSexagesimalAngle", () => {
  it("formats degrees as a base-60 degree-minute-second readout", () => {
    expect(formatSexagesimalAngle(43.2)).toBe("43 deg 12' 00\"");
  });

  it("wraps rounded sexagesimal angles at a full rotation boundary", () => {
    expect(formatSexagesimalAngle(359.9999)).toBe("0 deg 00' 00\"");
  });
});

function testGear(
  id: string,
  x: number,
  y: number,
  teeth = 20,
  overrides: Partial<GearSystem["gears"][number]> = {},
): GearSystem["gears"][number] {
  return {
    id,
    label: id,
    teeth,
    module: 1,
    position: { x, y },
    angle: 0,
    phase: 0,
    rpm: 0,
    direction: "clockwise",
    lockedAxle: false,
    isDriver: false,
    color: "#72d2c6",
    ...overrides,
  };
}

function testConnection(
  id: string,
  sourceGearId: string,
  targetGearId: string,
): GearSystem["connections"][number] {
  return {
    id,
    sourceGearId,
    targetGearId,
    kind: "mesh",
    phaseOffset: 0,
  };
}

function testSystem(
  gears: GearSystem["gears"],
  connections: GearSystem["connections"],
  drivers: string[],
): GearSystem {
  return {
    id: "solver-test",
    name: "Solver test",
    base: 60,
    units: "degrees",
    gears,
    connections,
    drivers,
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
}

function normalizeForTest(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
