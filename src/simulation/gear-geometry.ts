import type {
  GearConnection,
  GearNode,
  GearSystem,
  Point,
} from "./gear-system";

export const MESH_VALIDITY_TOLERANCE_PX = 1;
export const COMPOUND_VALIDITY_TOLERANCE_PX = 1;
export const SNAP_CAPTURE_DISTANCE_PX = 15;
export const NUMERIC_RELATIVE_TOLERANCE = 1e-9;

export type ConnectionIssueCode =
  | "missing-endpoint"
  | "self-connection"
  | "module-mismatch"
  | "mesh-distance"
  | "compound-center";

export interface ConnectionValidation {
  connectionId: string;
  isGeometricallyValid: boolean;
  issueCodes: readonly ConnectionIssueCode[];
  actualCenterDistance: number | null;
  expectedCenterDistance: number | null;
  distanceError: number | null;
}

export interface JammedComponent {
  gearIds: readonly string[];
  connectionIds: readonly string[];
  reason: "direction-conflict" | "ratio-conflict";
}

export interface ConnectionValidationResult {
  byConnectionId: Readonly<Record<string, ConnectionValidation>>;
  jammedComponents: readonly JammedComponent[];
}

export function pitchRadius(gear: Pick<GearNode, "module" | "teeth">): number {
  return (gear.module * gear.teeth) / 2;
}

export function meshRatio(
  source: Pick<GearNode, "teeth">,
  target: Pick<GearNode, "teeth">,
): number {
  return source.teeth / target.teeth;
}

export function centerDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function calculateMeshPhaseOffset(
  source: Pick<GearNode, "position" | "teeth">,
  target: Pick<GearNode, "position" | "teeth">,
): number {
  const axisAngle = radiansToDegrees(
    Math.atan2(
      target.position.y - source.position.y,
      target.position.x - source.position.x,
    ),
  );
  const ratio = meshRatio(source, target);
  const targetToothPitch = 360 / target.teeth;

  return normalizeDegrees((1 + ratio) * axisAngle + 180 - targetToothPitch / 2);
}

export function getCompoundComponent(
  system: GearSystem,
  gearId: string,
): readonly string[] {
  const gearIds = new Set(system.gears.map((gear) => gear.id));

  if (!gearIds.has(gearId)) {
    return [];
  }

  const adjacency = new Map<string, string[]>();

  for (const id of gearIds) {
    adjacency.set(id, []);
  }

  for (const connection of system.connections) {
    if (
      connection.kind !== "compound" ||
      !gearIds.has(connection.sourceGearId) ||
      !gearIds.has(connection.targetGearId)
    ) {
      continue;
    }

    adjacency.get(connection.sourceGearId)?.push(connection.targetGearId);
    adjacency.get(connection.targetGearId)?.push(connection.sourceGearId);
  }

  const component = new Set<string>();
  const queue = [gearId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId || component.has(currentId)) {
      continue;
    }

    component.add(currentId);
    queue.push(...(adjacency.get(currentId) ?? []));
  }

  return [...component].sort(compareStrings);
}

export function moveCompoundComponent(
  system: GearSystem,
  gearId: string,
  pointerPosition: Point,
): GearSystem {
  const draggedGear = system.gears.find((gear) => gear.id === gearId);

  if (!draggedGear) {
    return system;
  }

  const delta = {
    x: pointerPosition.x - draggedGear.position.x,
    y: pointerPosition.y - draggedGear.position.y,
  };

  if (delta.x === 0 && delta.y === 0) {
    return system;
  }

  return translateGearIds(
    system,
    new Set(getCompoundComponent(system, gearId)),
    delta,
  );
}

export function snapCompoundComponentToMesh(
  system: GearSystem,
  gearId: string,
): GearSystem {
  const movingGearIds = new Set(getCompoundComponent(system, gearId));

  if (movingGearIds.size === 0) {
    return system;
  }

  const candidate = findBestSnapCandidate(system, movingGearIds);

  if (!candidate) {
    return system;
  }

  const translated = translateGearIds(
    system,
    movingGearIds,
    snapTranslationDelta(candidate),
  );
  const { connections, phaseChanged } = withRecalculatedMeshPhases(
    translated,
    movingGearIds,
  );

  if (translated === system && !phaseChanged) {
    return system;
  }

  return phaseChanged ? { ...translated, connections } : translated;
}

interface SnapCandidate {
  connection: GearConnection;
  distanceError: number;
  fixedGear: GearNode;
  movingGear: GearNode;
}

function findBestSnapCandidate(
  system: GearSystem,
  movingGearIds: ReadonlySet<string>,
): SnapCandidate | undefined {
  const gearsById = new Map(system.gears.map((gear) => [gear.id, gear]));
  const candidates: SnapCandidate[] = [];

  for (const connection of system.connections) {
    if (connection.kind !== "mesh") {
      continue;
    }

    const source = gearsById.get(connection.sourceGearId);
    const target = gearsById.get(connection.targetGearId);

    if (!source || !target || source.id === target.id) {
      continue;
    }

    const sourceMoves = movingGearIds.has(source.id);
    const targetMoves = movingGearIds.has(target.id);

    if (
      sourceMoves === targetMoves ||
      !approximatelyEqual(source.module, target.module)
    ) {
      continue;
    }

    const actualDistance = centerDistance(source.position, target.position);

    if (actualDistance <= NUMERIC_RELATIVE_TOLERANCE) {
      continue;
    }

    const expectedDistance = pitchRadius(source) + pitchRadius(target);
    const distanceError = Math.abs(actualDistance - expectedDistance);

    if (distanceError <= SNAP_CAPTURE_DISTANCE_PX) {
      candidates.push({
        connection,
        distanceError,
        fixedGear: sourceMoves ? target : source,
        movingGear: sourceMoves ? source : target,
      });
    }
  }

  return candidates.sort(compareSnapCandidates)[0];
}

function compareSnapCandidates(a: SnapCandidate, b: SnapCandidate): number {
  const errorDifference = a.distanceError - b.distanceError;

  if (errorDifference !== 0) {
    return errorDifference;
  }

  return compareStrings(a.connection.id, b.connection.id);
}

function snapTranslationDelta(candidate: SnapCandidate): Point {
  const actualDistance = centerDistance(
    candidate.fixedGear.position,
    candidate.movingGear.position,
  );
  const expectedDistance =
    pitchRadius(candidate.fixedGear) + pitchRadius(candidate.movingGear);
  const unit = {
    x:
      (candidate.movingGear.position.x - candidate.fixedGear.position.x) /
      actualDistance,
    y:
      (candidate.movingGear.position.y - candidate.fixedGear.position.y) /
      actualDistance,
  };
  const snappedMovingPosition = {
    x: candidate.fixedGear.position.x + unit.x * expectedDistance,
    y: candidate.fixedGear.position.y + unit.y * expectedDistance,
  };

  return {
    x: snappedMovingPosition.x - candidate.movingGear.position.x,
    y: snappedMovingPosition.y - candidate.movingGear.position.y,
  };
}

function withRecalculatedMeshPhases(
  translated: GearSystem,
  movingGearIds: ReadonlySet<string>,
): { connections: GearConnection[]; phaseChanged: boolean } {
  const translatedGearsById = new Map(
    translated.gears.map((gear) => [gear.id, gear]),
  );
  const geometryByConnectionId = validateConnectionGeometry(translated);
  let phaseChanged = false;
  const connections = translated.connections.map((connection) => {
    if (
      connection.kind !== "mesh" ||
      (!movingGearIds.has(connection.sourceGearId) &&
        !movingGearIds.has(connection.targetGearId)) ||
      !geometryByConnectionId[connection.id]?.isGeometricallyValid
    ) {
      return connection;
    }

    const source = translatedGearsById.get(connection.sourceGearId);
    const target = translatedGearsById.get(connection.targetGearId);

    if (!source || !target) {
      return connection;
    }

    const phaseOffset = calculateMeshPhaseOffset(source, target);

    if (Object.is(phaseOffset, connection.phaseOffset)) {
      return connection;
    }

    phaseChanged = true;
    return { ...connection, phaseOffset };
  });

  return { connections, phaseChanged };
}

function translateGearIds(
  system: GearSystem,
  gearIds: ReadonlySet<string>,
  delta: Point,
): GearSystem {
  if (delta.x === 0 && delta.y === 0) {
    return system;
  }

  return {
    ...system,
    gears: system.gears.map((gear) =>
      gearIds.has(gear.id)
        ? {
            ...gear,
            position: {
              x: gear.position.x + delta.x,
              y: gear.position.y + delta.y,
            },
          }
        : gear,
    ),
  };
}

export function validateConnections(
  system: GearSystem,
): ConnectionValidationResult {
  const gearsById = new Map(system.gears.map((gear) => [gear.id, gear]));
  const byConnectionId = validateConnectionGeometry(system);

  return {
    byConnectionId,
    jammedComponents: findJammedComponents(system, byConnectionId, gearsById),
  };
}

export function validateConnectionGeometry(
  system: GearSystem,
): Readonly<Record<string, ConnectionValidation>> {
  const gearsById = new Map(system.gears.map((gear) => [gear.id, gear]));
  const byConnectionId: Record<string, ConnectionValidation> = {};

  for (const connection of system.connections) {
    const source = gearsById.get(connection.sourceGearId);
    const target = gearsById.get(connection.targetGearId);

    if (!source || !target) {
      byConnectionId[connection.id] = {
        connectionId: connection.id,
        isGeometricallyValid: false,
        issueCodes: ["missing-endpoint"],
        actualCenterDistance: null,
        expectedCenterDistance: null,
        distanceError: null,
      };
      continue;
    }

    const actual = centerDistance(source.position, target.position);
    const expected =
      connection.kind === "mesh"
        ? pitchRadius(source) + pitchRadius(target)
        : 0;
    const distanceError = Math.abs(actual - expected);
    const issueCodes = collectConnectionIssueCodes(
      connection,
      source,
      target,
      actual,
      distanceError,
    );

    byConnectionId[connection.id] = {
      connectionId: connection.id,
      isGeometricallyValid: issueCodes.length === 0,
      issueCodes,
      actualCenterDistance: actual,
      expectedCenterDistance: expected,
      distanceError,
    };
  }

  return byConnectionId;
}

function collectConnectionIssueCodes(
  connection: GearConnection,
  source: GearNode,
  target: GearNode,
  actualCenterDistance: number,
  distanceError: number,
): ConnectionIssueCode[] {
  const issueCodes: ConnectionIssueCode[] = [];

  if (source.id === target.id) {
    issueCodes.push("self-connection");
  }

  if (connection.kind === "mesh") {
    if (!approximatelyEqual(source.module, target.module)) {
      issueCodes.push("module-mismatch");
    }

    if (distanceError > MESH_VALIDITY_TOLERANCE_PX) {
      issueCodes.push("mesh-distance");
    }
  } else if (actualCenterDistance > COMPOUND_VALIDITY_TOLERANCE_PX) {
    issueCodes.push("compound-center");
  }

  return issueCodes;
}

interface ConstraintEdge {
  connection: GearConnection;
  multiplier: number;
  neighborId: string;
}

function findJammedComponents(
  system: GearSystem,
  byConnectionId: Readonly<Record<string, ConnectionValidation>>,
  gearsById: ReadonlyMap<string, GearNode>,
): JammedComponent[] {
  const adjacency = buildConstraintAdjacency(system, byConnectionId, gearsById);
  const visited = new Set<string>();
  const jammedComponents: JammedComponent[] = [];

  for (const root of system.gears) {
    if (visited.has(root.id)) {
      continue;
    }

    const component = analyzeConstraintComponent(root.id, adjacency, visited);

    if (component.reason) {
      jammedComponents.push({
        gearIds: [...component.gearIds].sort(compareStrings),
        connectionIds: [...component.connectionIds].sort(compareStrings),
        reason: component.reason,
      });
    }
  }

  return jammedComponents;
}

function buildConstraintAdjacency(
  system: GearSystem,
  byConnectionId: Readonly<Record<string, ConnectionValidation>>,
  gearsById: ReadonlyMap<string, GearNode>,
): Map<string, ConstraintEdge[]> {
  const adjacency = new Map<string, ConstraintEdge[]>();

  for (const gear of system.gears) {
    adjacency.set(gear.id, []);
  }

  for (const connection of system.connections) {
    if (!byConnectionId[connection.id]?.isGeometricallyValid) {
      continue;
    }

    const source = gearsById.get(connection.sourceGearId);
    const target = gearsById.get(connection.targetGearId);

    if (!source || !target) {
      continue;
    }

    const forwardMultiplier =
      connection.kind === "mesh" ? -meshRatio(source, target) : 1;

    adjacency.get(source.id)?.push({
      connection,
      multiplier: forwardMultiplier,
      neighborId: target.id,
    });
    adjacency.get(target.id)?.push({
      connection,
      multiplier: 1 / forwardMultiplier,
      neighborId: source.id,
    });
  }

  return adjacency;
}

interface ConstraintComponentState {
  multipliers: Map<string, number>;
  queue: string[];
  gearIds: Set<string>;
  connectionIds: Set<string>;
  hasDirectionConflict: boolean;
  hasRatioConflict: boolean;
}

function analyzeConstraintComponent(
  rootId: string,
  adjacency: ReadonlyMap<string, ConstraintEdge[]>,
  visited: Set<string>,
): {
  gearIds: ReadonlySet<string>;
  connectionIds: ReadonlySet<string>;
  reason: JammedComponent["reason"] | null;
} {
  const state: ConstraintComponentState = {
    multipliers: new Map([[rootId, 1]]),
    queue: [rootId],
    gearIds: new Set(),
    connectionIds: new Set(),
    hasDirectionConflict: false,
    hasRatioConflict: false,
  };

  while (state.queue.length > 0) {
    const gearId = state.queue.shift();

    if (!gearId || visited.has(gearId)) {
      continue;
    }

    visited.add(gearId);
    state.gearIds.add(gearId);
    const currentMultiplier = state.multipliers.get(gearId) ?? 1;

    for (const edge of adjacency.get(gearId) ?? []) {
      applyConstraintEdge(edge, currentMultiplier, state);
    }
  }

  let reason: JammedComponent["reason"] | null = null;

  if (state.hasDirectionConflict) {
    reason = "direction-conflict";
  } else if (state.hasRatioConflict) {
    reason = "ratio-conflict";
  }

  return {
    gearIds: state.gearIds,
    connectionIds: state.connectionIds,
    reason,
  };
}

function applyConstraintEdge(
  edge: ConstraintEdge,
  currentMultiplier: number,
  state: ConstraintComponentState,
): void {
  state.connectionIds.add(edge.connection.id);
  state.gearIds.add(edge.neighborId);
  const candidateMultiplier = currentMultiplier * edge.multiplier;
  const existingMultiplier = state.multipliers.get(edge.neighborId);

  if (existingMultiplier === undefined) {
    state.multipliers.set(edge.neighborId, candidateMultiplier);
    state.queue.push(edge.neighborId);
    return;
  }

  if (Math.sign(candidateMultiplier) !== Math.sign(existingMultiplier)) {
    state.hasDirectionConflict = true;
  } else if (!approximatelyEqual(candidateMultiplier, existingMultiplier)) {
    state.hasRatioConflict = true;
  }
}

// Explicit codepoint comparator: Array.prototype.sort without a comparator is
// flagged as unreliable, and localeCompare would make ordering depend on the
// runtime locale, breaking the deterministic-output guarantee.
function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}

function approximatelyEqual(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  const roundingAllowance = Number.EPSILON * Math.max(1, scale);

  return (
    Math.abs(a - b) <= NUMERIC_RELATIVE_TOLERANCE * scale + roundingAllowance
  );
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function normalizeDegrees(angleDegrees: number): number {
  return ((angleDegrees % 360) + 360) % 360;
}
