import { describe, expect, it } from "vitest";
import type { GearConnection, GearNode, GearSystem } from "./gear-system";
import {
  COMPOUND_VALIDITY_TOLERANCE_PX,
  MESH_VALIDITY_TOLERANCE_PX,
  NUMERIC_RELATIVE_TOLERANCE,
  SNAP_CAPTURE_DISTANCE_PX,
  calculateMeshPhaseOffset,
  centerDistance,
  getCompoundComponent,
  meshRatio,
  moveCompoundComponent,
  pitchRadius,
  snapCompoundComponentToMesh,
  validateConnections,
} from "./gear-geometry";

describe("canonical gear geometry", () => {
  it.each([
    [{ module: 2, teeth: 60 }, 60],
    [{ module: 3, teeth: 15 }, 22.5],
    [{ module: 4, teeth: 6 }, 12],
  ])("derives pitch radius from module and teeth", (gear, expected) => {
    expect(pitchRadius(gear)).toBe(expected);
  });

  it("derives directional mesh ratios from endpoint teeth", () => {
    const large = { teeth: 60 };
    const small = { teeth: 20 };

    expect(meshRatio(large, small)).toBe(3);
    expect(meshRatio(small, large)).toBe(1 / 3);
  });

  it("measures Euclidean center distance", () => {
    expect(centerDistance({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(5);
  });

  it("exports tolerances with their distinct specified values", () => {
    expect(MESH_VALIDITY_TOLERANCE_PX).toBe(1);
    expect(COMPOUND_VALIDITY_TOLERANCE_PX).toBe(1);
    expect(SNAP_CAPTURE_DISTANCE_PX).toBe(15);
    expect(NUMERIC_RELATIVE_TOLERANCE).toBe(1e-9);
  });

  it("calculates the stored source-to-target mesh mounting phase", () => {
    const source = {
      teeth: 60,
      module: 2,
      position: { x: 0, y: 0 },
    };
    const target = {
      teeth: 20,
      module: 2,
      position: { x: 80, y: 0 },
    };

    expect(calculateMeshPhaseOffset(source, target)).toBe(171);
  });
});

describe("validateConnections", () => {
  it.each([
    [19, true],
    [20, true],
    [21, true],
    [18.999, false],
    [21.001, false],
  ])(
    "uses inclusive mesh distance tolerance at center distance %s",
    (distance, expectedValid) => {
      const system = makeSystem(
        [makeGear("a", 0, 0), makeGear("b", distance, 0)],
        [mesh("mesh", "a", "b")],
      );

      expect(
        validateConnections(system).byConnectionId.mesh.isGeometricallyValid,
      ).toBe(expectedValid);
    },
  );

  it("collects module and distance issues with absolute diagnostics", () => {
    const system = makeSystem(
      [makeGear("a", 0, 0), { ...makeGear("b", 25, 0), module: 2 }],
      [mesh("mesh", "a", "b")],
    );

    expect(validateConnections(system).byConnectionId.mesh).toEqual({
      connectionId: "mesh",
      isGeometricallyValid: false,
      issueCodes: ["module-mismatch", "mesh-distance"],
      actualCenterDistance: 25,
      expectedCenterDistance: 30,
      distanceError: 5,
    });
  });

  it("matches modules with the specified relative tolerance", () => {
    const source = makeGear("a", 0, 0);
    const approximatelyMatching = {
      ...makeGear("b", 20, 0),
      module: 1 + NUMERIC_RELATIVE_TOLERANCE / 2,
    };
    const mismatching = {
      ...makeGear("c", 20, 0),
      module: 1 + NUMERIC_RELATIVE_TOLERANCE * 2,
    };

    expect(
      validateConnections(
        makeSystem([source, approximatelyMatching], [mesh("near", "a", "b")]),
      ).byConnectionId.near.issueCodes,
    ).not.toContain("module-mismatch");
    expect(
      validateConnections(
        makeSystem([source, mismatching], [mesh("far", "a", "c")]),
      ).byConnectionId.far.issueCodes,
    ).toContain("module-mismatch");
  });

  it("includes the numeric relative tolerance boundary", () => {
    const source = makeGear("a", 0, 0);
    const target = {
      ...makeGear("b", 20, 0),
      module: 1 + NUMERIC_RELATIVE_TOLERANCE,
    };

    expect(
      validateConnections(
        makeSystem([source, target], [mesh("boundary", "a", "b")]),
      ).byConnectionId.boundary.issueCodes,
    ).not.toContain("module-mismatch");
  });

  it.each([
    [0, true],
    [1, true],
    [1.001, false],
  ])(
    "uses inclusive compound center tolerance at distance %s",
    (distance, expectedValid) => {
      const system = makeSystem(
        [makeGear("a", 0, 0), makeGear("b", distance, 0)],
        [compound("compound", "a", "b")],
      );

      expect(validateConnections(system).byConnectionId.compound).toMatchObject(
        {
          isGeometricallyValid: expectedValid,
          issueCodes: expectedValid ? [] : ["compound-center"],
          expectedCenterDistance: 0,
          distanceError: distance,
        },
      );
    },
  );

  it("returns structured missing-endpoint results instead of throwing", () => {
    const result = validateConnections(
      makeSystem([makeGear("a", 0, 0)], [mesh("missing", "a", "gone")]),
    );

    expect(result.byConnectionId.missing).toEqual({
      connectionId: "missing",
      isGeometricallyValid: false,
      issueCodes: ["missing-endpoint"],
      actualCenterDistance: null,
      expectedCenterDistance: null,
      distanceError: null,
    });
  });

  it("rejects self-connections", () => {
    const result = validateConnections(
      makeSystem([makeGear("a", 0, 0)], [compound("self", "a", "a")]),
    );

    expect(result.byConnectionId.self.isGeometricallyValid).toBe(false);
    expect(result.byConnectionId.self.issueCodes).toContain("self-connection");
  });

  it("preserves connection order in the keyed result", () => {
    const result = validateConnections(
      makeSystem(
        [makeGear("a", 0, 0), makeGear("b", 20, 0)],
        [mesh("z-last", "a", "b"), mesh("a-first", "b", "a")],
      ),
    );

    expect(Object.keys(result.byConnectionId)).toEqual(["z-last", "a-first"]);
  });
});

describe("constraint graph jam detection", () => {
  it("jams three mutually meshed external gears with a direction conflict", () => {
    const height = Math.sqrt(300);
    const system = makeSystem(
      [makeGear("c", 10, height), makeGear("a", 0, 0), makeGear("b", 20, 0)],
      [mesh("bc", "b", "c"), mesh("ca", "c", "a"), mesh("ab", "a", "b")],
    );

    expect(validateConnections(system).jammedComponents).toEqual([
      {
        gearIds: ["a", "b", "c"],
        connectionIds: ["ab", "bc", "ca"],
        reason: "direction-conflict",
      },
    ]);
  });

  it("does not jam a geometrically valid four-mesh cycle", () => {
    const system = makeSystem(
      [
        makeGear("a", 0, 0),
        makeGear("b", 20, 0),
        makeGear("c", 20, 20),
        makeGear("d", 0, 20),
      ],
      [
        mesh("ab", "a", "b"),
        mesh("bc", "b", "c"),
        mesh("cd", "c", "d"),
        mesh("da", "d", "a"),
      ],
    );

    expect(validateConnections(system).jammedComponents).toEqual([]);
  });

  it("reports an inconsistent mesh and compound loop as a ratio conflict", () => {
    const system = makeSystem(
      [
        makeGear("a", 0, 0, 20, 2),
        makeGear("b", 60, 0, 40, 2),
        makeGear("c", 60, 0, 30, 2),
        makeGear("d", 0, 0, 30, 2),
      ],
      [
        mesh("ab", "a", "b"),
        compound("bc", "b", "c"),
        mesh("cd", "c", "d"),
        compound("da", "d", "a"),
      ],
    );

    expect(validateConnections(system).jammedComponents).toEqual([
      {
        gearIds: ["a", "b", "c", "d"],
        connectionIds: ["ab", "bc", "cd", "da"],
        reason: "ratio-conflict",
      },
    ]);
  });

  it("clears an odd-cycle jam when geometry invalidates one edge", () => {
    const system = makeSystem(
      [
        makeGear("a", 0, 0),
        makeGear("b", 20, 0),
        makeGear(
          "c",
          20 + 20 * Math.cos((100 * Math.PI) / 180),
          20 * Math.sin((100 * Math.PI) / 180),
        ),
      ],
      [mesh("ab", "a", "b"), mesh("bc", "b", "c"), mesh("ca", "c", "a")],
    );
    const validation = validateConnections(system);

    expect(validation.byConnectionId.ab.isGeometricallyValid).toBe(true);
    expect(validation.byConnectionId.bc.isGeometricallyValid).toBe(true);
    expect(validation.byConnectionId.ca.isGeometricallyValid).toBe(false);
    expect(validation.jammedComponents).toEqual([]);
  });
});

describe("compound drag and existing-link snapping", () => {
  it("discovers transitive compound partners in sorted order", () => {
    const system = makeSystem(
      [makeGear("c", 0, 0), makeGear("a", 0, 0), makeGear("b", 0, 0)],
      [compound("ab", "a", "b"), compound("bc", "b", "c")],
    );

    expect(getCompoundComponent(system, "b")).toEqual(["a", "b", "c"]);
  });

  it("translates an entire compound group by the dragged gear delta", () => {
    const system = makeSystem(
      [makeGear("a", 1, 2), makeGear("b", 1, 2), makeGear("fixed", 40, 2)],
      [compound("ab", "a", "b")],
    );

    const moved = moveCompoundComponent(system, "b", { x: 11, y: 22 });

    expect(moved.gears.map((gear) => [gear.id, gear.position])).toEqual([
      ["a", { x: 11, y: 22 }],
      ["b", { x: 11, y: 22 }],
      ["fixed", { x: 40, y: 2 }],
    ]);
    expect(moved.updatedAt).toBe(system.updatedAt);
  });

  it("returns the existing system for a no-op rounded move", () => {
    const system = makeSystem([makeGear("a", 10, 20)], []);

    expect(moveCompoundComponent(system, "a", { x: 10, y: 20 })).toBe(system);
  });

  it.each([
    [35, true],
    [35.001, false],
  ])("uses inclusive snap capture at fixed center %s", (fixedX, shouldSnap) => {
    const system = makeSystem(
      [makeGear("moving", 0, 0), makeGear("fixed", fixedX, 0)],
      [mesh("existing", "moving", "fixed")],
    );

    const finalized = snapCompoundComponentToMesh(system, "moving");

    expect(finalized === system).toBe(!shouldSnap);
    if (shouldSnap) {
      expect(finalized.gears[0].position.x).toBe(15);
      expect(
        centerDistance(
          finalized.gears[0].position,
          finalized.gears[1].position,
        ),
      ).toBe(20);
    }
  });

  it("rejects module-mismatched snap candidates", () => {
    const system = makeSystem(
      [makeGear("moving", 0, 0), { ...makeGear("fixed", 30, 0), module: 2 }],
      [mesh("existing", "moving", "fixed")],
    );

    expect(snapCompoundComponentToMesh(system, "moving")).toBe(system);
  });

  it("snaps the compound group to exact floating-point tangency", () => {
    const system = makeSystem(
      [
        makeGear("moving", 0, 0),
        makeGear("axle", 0, 0, 30),
        makeGear("fixed", 18, 24),
      ],
      [compound("axle", "moving", "axle"), mesh("existing", "moving", "fixed")],
    );

    const finalized = snapCompoundComponentToMesh(system, "axle");
    const moving = finalized.gears.find((gear) => gear.id === "moving")!;
    const axle = finalized.gears.find((gear) => gear.id === "axle")!;
    const fixed = finalized.gears.find((gear) => gear.id === "fixed")!;

    expect(moving.position.x).toBeCloseTo(6, 12);
    expect(moving.position.y).toBeCloseTo(8, 12);
    expect(axle.position).toEqual(moving.position);
    expect(centerDistance(moving.position, fixed.position)).toBeCloseTo(20, 12);
    expect(finalized.connections).toHaveLength(system.connections.length);
    expect(finalized.connections[1].phaseOffset).toBe(
      calculateMeshPhaseOffset(moving, fixed),
    );
  });

  it("breaks equal-error snap ties by connection id", () => {
    const system = makeSystem(
      [
        makeGear("moving", 0, 0),
        makeGear("right", 30, 0),
        makeGear("left", -30, 0),
      ],
      [mesh("z-right", "moving", "right"), mesh("a-left", "moving", "left")],
    );

    const finalized = snapCompoundComponentToMesh(system, "moving");

    expect(finalized.gears[0].position.x).toBe(-10);
  });

  it("skips a coincident snap candidate instead of inventing a direction", () => {
    const system = makeSystem(
      [makeGear("moving", 0, 0, 10), makeGear("fixed", 0, 0, 10)],
      [mesh("existing", "moving", "fixed")],
    );

    expect(snapCompoundComponentToMesh(system, "moving")).toBe(system);
  });

  it("returns the existing system when an exact tangent already has its phase", () => {
    const moving = makeGear("moving", 0, 0);
    const fixed = makeGear("fixed", 20, 0);
    const connection = {
      ...mesh("existing", "moving", "fixed"),
      phaseOffset: calculateMeshPhaseOffset(moving, fixed),
    };
    const system = makeSystem([moving, fixed], [connection]);

    expect(snapCompoundComponentToMesh(system, "moving")).toBe(system);
  });

  it("returns a new system for a phase-only drop finalization", () => {
    const moving = makeGear("moving", 0, 0);
    const fixed = makeGear("fixed", 20, 0);
    const system = makeSystem(
      [moving, fixed],
      [mesh("existing", "moving", "fixed")],
    );

    const finalized = snapCompoundComponentToMesh(system, "moving");

    expect(finalized).not.toBe(system);
    expect(finalized.gears).toBe(system.gears);
    expect(finalized.connections[0].phaseOffset).toBe(
      calculateMeshPhaseOffset(moving, fixed),
    );
  });

  it("refreshes every now-valid mesh phase incident to the moving group", () => {
    const system = makeSystem(
      [
        makeGear("moving", 0, 0),
        makeGear("right", 35, 0),
        makeGear("left", -5, 0),
      ],
      [mesh("a-right", "moving", "right"), mesh("z-left", "moving", "left")],
    );

    const finalized = snapCompoundComponentToMesh(system, "moving");
    const gearsById = new Map(finalized.gears.map((gear) => [gear.id, gear]));

    for (const connection of finalized.connections) {
      const source = gearsById.get(connection.sourceGearId)!;
      const target = gearsById.get(connection.targetGearId)!;

      expect(connection.phaseOffset).toBe(
        calculateMeshPhaseOffset(source, target),
      );
    }
  });
});

function makeGear(
  id: string,
  x: number,
  y: number,
  teeth = 20,
  module = 1,
): GearNode {
  return {
    id,
    label: id.toUpperCase(),
    teeth,
    module,
    position: { x, y },
    angle: 0,
    phase: 0,
    rpm: 0,
    direction: "clockwise",
    lockedAxle: false,
    isDriver: false,
    color: "#72d2c6",
  };
}

function mesh(
  id: string,
  sourceGearId: string,
  targetGearId: string,
): GearConnection {
  return {
    id,
    sourceGearId,
    targetGearId,
    kind: "mesh",
    phaseOffset: 0,
  };
}

function compound(
  id: string,
  sourceGearId: string,
  targetGearId: string,
): GearConnection {
  return {
    id,
    sourceGearId,
    targetGearId,
    kind: "compound",
    phaseOffset: 0,
  };
}

function makeSystem(
  gears: GearNode[],
  connections: GearConnection[],
): GearSystem {
  return {
    id: "test-system",
    name: "Test system",
    base: 60,
    units: "degrees",
    gears,
    connections,
    drivers: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
}
