import {
  meshRatio,
  validateConnections,
  type ConnectionValidationResult,
} from "./gear-geometry";

export type RotationDirection = "clockwise" | "counterclockwise";

export type ConnectionKind = "mesh" | "compound";

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface GearNode {
  id: string;
  label: string;
  teeth: number;
  module: number;
  position: Point;
  angle: number;
  phase: number;
  rpm: number;
  direction: RotationDirection;
  lockedAxle: boolean;
  isDriver: boolean;
  color: string;
}

export interface GearConnection {
  id: string;
  sourceGearId: string;
  targetGearId: string;
  kind: ConnectionKind;
  phaseOffset: number;
}

export interface GearSystem {
  id: string;
  name: string;
  base: 60;
  units: "degrees";
  gears: GearNode[];
  connections: GearConnection[];
  drivers: string[];
  viewport: Viewport;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationFrame {
  gearId: string;
  rpm: number;
  direction: RotationDirection;
  angleDegrees: number;
  toothAngleDegrees: number;
}

export interface SolvedGearSystem {
  elapsedSeconds: number;
  framesByGear: Record<string, SimulationFrame>;
}

interface PropagatedMotion {
  rpm: number;
  direction: RotationDirection;
  toothPhaseReference: number;
}

interface MotionEdge {
  connection: GearConnection;
  targetGearId: string;
  traversesForward: boolean;
}

const DEGREES_PER_ROTATION = 360;
const SECONDS_PER_MINUTE = 60;
const MOTION_RPM_RELATIVE_TOLERANCE = 1e-9;
const MOTION_PHASE_TOLERANCE_DEGREES = 1e-6;
const ARC_SECONDS_PER_ROTATION =
  DEGREES_PER_ROTATION * SECONDS_PER_MINUTE * SECONDS_PER_MINUTE;

export function solveGearSystem(
  system: GearSystem,
  elapsedSeconds: number,
  validation: ConnectionValidationResult = validateConnections(system),
): SolvedGearSystem {
  const gearsById = new Map(system.gears.map((gear) => [gear.id, gear]));
  const motions = new Map<string, PropagatedMotion>();
  const jammedGearIds = new Set(
    validation.jammedComponents.flatMap((component) => component.gearIds),
  );
  const adjacency = new Map<string, MotionEdge[]>();
  const queue: string[] = [];

  for (const gear of system.gears) {
    adjacency.set(gear.id, []);
  }

  for (const connection of system.connections) {
    if (!validation.byConnectionId[connection.id]?.isGeometricallyValid) {
      continue;
    }

    if (
      jammedGearIds.has(connection.sourceGearId) ||
      jammedGearIds.has(connection.targetGearId)
    ) {
      continue;
    }

    adjacency.get(connection.sourceGearId)?.push({
      connection,
      targetGearId: connection.targetGearId,
      traversesForward: true,
    });
    adjacency.get(connection.targetGearId)?.push({
      connection,
      targetGearId: connection.sourceGearId,
      traversesForward: false,
    });
  }

  for (const driverId of system.drivers) {
    const driver = gearsById.get(driverId);

    if (!driver) {
      throw new Error(`Driver gear "${driverId}" does not exist.`);
    }

    if (jammedGearIds.has(driver.id)) {
      continue;
    }

    const seededMotion: PropagatedMotion = {
      rpm: driver.rpm,
      direction: driver.direction,
      toothPhaseReference: driver.angle + driver.phase,
    };
    const existingMotion = motions.get(driver.id);

    if (existingMotion) {
      if (!motionsAgree(existingMotion, seededMotion, driver)) {
        jamReachableComponent(driver.id, adjacency, motions, jammedGearIds);
      }
      continue;
    }

    motions.set(driver.id, seededMotion);
    queue.push(driver.id);
  }

  while (queue.length > 0) {
    const sourceId = queue.shift();

    if (!sourceId || jammedGearIds.has(sourceId)) {
      continue;
    }

    const sourceGear = gearsById.get(sourceId);
    const sourceMotion = motions.get(sourceId);

    if (!sourceGear || !sourceMotion) {
      continue;
    }

    for (const edge of adjacency.get(sourceId) ?? []) {
      const targetGear = gearsById.get(edge.targetGearId);

      if (!targetGear || jammedGearIds.has(targetGear.id)) {
        continue;
      }

      const targetMotion =
        edge.connection.kind === "compound"
          ? solveCompoundMotion(sourceMotion, edge)
          : solveMeshMotion(sourceGear, targetGear, sourceMotion, edge);
      const existingMotion = motions.get(targetGear.id);

      if (existingMotion) {
        if (!motionsAgree(existingMotion, targetMotion, targetGear)) {
          jamReachableComponent(
            targetGear.id,
            adjacency,
            motions,
            jammedGearIds,
          );
          break;
        }
        continue;
      }

      motions.set(targetGear.id, targetMotion);
      queue.push(targetGear.id);
    }
  }

  return {
    elapsedSeconds,
    framesByGear: Object.fromEntries(
      system.gears.map((gear) => {
        const motion = motions.get(gear.id) ?? {
          rpm: 0,
          direction: gear.direction,
          toothPhaseReference: gear.angle + gear.phase,
        };
        const frame: SimulationFrame = {
          gearId: gear.id,
          rpm: motion.rpm,
          direction: motion.direction,
          angleDegrees: normalizeDegrees(
            gear.angle +
              gear.phase +
              signedDegreesPerSecond(motion.rpm, motion.direction) *
                elapsedSeconds,
          ),
          toothAngleDegrees: normalizeDegrees(
            motion.toothPhaseReference +
              signedDegreesPerSecond(motion.rpm, motion.direction) *
                elapsedSeconds,
          ),
        };

        return [gear.id, frame];
      }),
    ),
  };
}

export function formatSexagesimalAngle(angleDegrees: number): string {
  const normalized = normalizeDegrees(angleDegrees);
  const totalSeconds =
    Math.round(normalized * SECONDS_PER_MINUTE * SECONDS_PER_MINUTE) %
    ARC_SECONDS_PER_ROTATION;
  const degrees = Math.floor(totalSeconds / (60 * 60));
  const remainingAfterDegrees = totalSeconds - degrees * 60 * 60;
  const minutes = Math.floor(remainingAfterDegrees / 60);
  const seconds = remainingAfterDegrees - minutes * 60;

  return `${degrees} deg ${String(minutes).padStart(2, "0")}' ${String(
    seconds,
  ).padStart(2, "0")}"`;
}

export function normalizeDegrees(angleDegrees: number): number {
  return (
    ((angleDegrees % DEGREES_PER_ROTATION) + DEGREES_PER_ROTATION) %
    DEGREES_PER_ROTATION
  );
}

// Two drivers (or two propagation paths) agree when they demand the same
// speed, the same direction while moving, and tooth phases that differ by a
// whole number of tooth pitches — offsets of full teeth mesh identically.
function motionsAgree(
  a: PropagatedMotion,
  b: PropagatedMotion,
  gear: GearNode,
): boolean {
  const rpmScale = Math.max(Math.abs(a.rpm), Math.abs(b.rpm), 1);

  if (Math.abs(a.rpm - b.rpm) > MOTION_RPM_RELATIVE_TOLERANCE * rpmScale) {
    return false;
  }

  if ((a.rpm !== 0 || b.rpm !== 0) && a.direction !== b.direction) {
    return false;
  }

  const toothPitch = DEGREES_PER_ROTATION / gear.teeth;
  const phaseDifference =
    Math.abs(a.toothPhaseReference - b.toothPhaseReference) % toothPitch;
  const phaseMismatch = Math.min(phaseDifference, toothPitch - phaseDifference);

  return phaseMismatch <= MOTION_PHASE_TOLERANCE_DEGREES;
}

function jamReachableComponent(
  gearId: string,
  adjacency: ReadonlyMap<string, MotionEdge[]>,
  motions: Map<string, PropagatedMotion>,
  jammedGearIds: Set<string>,
): void {
  const queue = [gearId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId || jammedGearIds.has(currentId)) {
      continue;
    }

    jammedGearIds.add(currentId);
    motions.delete(currentId);

    for (const edge of adjacency.get(currentId) ?? []) {
      queue.push(edge.targetGearId);
    }
  }
}

function solveCompoundMotion(
  sourceMotion: PropagatedMotion,
  edge: MotionEdge,
): PropagatedMotion {
  return {
    rpm: sourceMotion.rpm,
    direction: sourceMotion.direction,
    toothPhaseReference:
      sourceMotion.toothPhaseReference +
      (edge.traversesForward
        ? edge.connection.phaseOffset
        : -edge.connection.phaseOffset),
  };
}

// Mesh phase invariant, in terms of the connection's stored endpoints:
// toothPhaseReference(target) +
//   meshRatio(source, target) * toothPhaseReference(source)
// ~= edge.connection.phaseOffset.
// Forward traversal solves for the target by multiplying the source phase by
// meshRatio(sourceGear, targetGear); reverse traversal solves for the stored
// source by dividing the residual by meshRatio(targetGear, sourceGear), which
// is the same ratio once the traversal swap of source/target is undone.
function solveMeshMotion(
  sourceGear: GearNode,
  targetGear: GearNode,
  sourceMotion: PropagatedMotion,
  edge: MotionEdge,
): PropagatedMotion {
  const toothRatio = meshRatio(sourceGear, targetGear);
  const toothPhaseReference = edge.traversesForward
    ? edge.connection.phaseOffset -
      toothRatio * sourceMotion.toothPhaseReference
    : (edge.connection.phaseOffset - sourceMotion.toothPhaseReference) /
      meshRatio(targetGear, sourceGear);

  return {
    rpm: sourceMotion.rpm * toothRatio,
    direction: oppositeDirection(sourceMotion.direction),
    toothPhaseReference,
  };
}

function signedDegreesPerSecond(
  rpm: number,
  direction: RotationDirection,
): number {
  const degreesPerSecond = (rpm * DEGREES_PER_ROTATION) / SECONDS_PER_MINUTE;

  return direction === "clockwise" ? degreesPerSecond : -degreesPerSecond;
}

function oppositeDirection(direction: RotationDirection): RotationDirection {
  return direction === "clockwise" ? "counterclockwise" : "clockwise";
}
