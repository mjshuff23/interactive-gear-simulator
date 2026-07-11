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

    motions.set(driver.id, {
      rpm: driver.rpm,
      direction: driver.direction,
      toothPhaseReference: driver.angle + driver.phase,
    });
    queue.push(driver.id);
  }

  while (queue.length > 0) {
    const sourceId = queue.shift();

    if (!sourceId) {
      continue;
    }

    const sourceGear = gearsById.get(sourceId);
    const sourceMotion = motions.get(sourceId);

    if (!sourceGear || !sourceMotion) {
      continue;
    }

    for (const edge of adjacency.get(sourceId) ?? []) {
      const targetGear = gearsById.get(edge.targetGearId);

      if (!targetGear || motions.has(targetGear.id)) {
        continue;
      }

      const targetMotion =
        edge.connection.kind === "compound"
          ? solveCompoundMotion(sourceMotion, edge)
          : solveMeshMotion(sourceGear, targetGear, sourceMotion, edge);

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
