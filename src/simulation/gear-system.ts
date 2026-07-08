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
  radius: number;
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
  ratio: number;
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
}

export interface SolvedGearSystem {
  elapsedSeconds: number;
  framesByGear: Record<string, SimulationFrame>;
}

interface PropagatedMotion {
  rpm: number;
  direction: RotationDirection;
  phaseReference: number;
}

const DEGREES_PER_ROTATION = 360;
const SECONDS_PER_MINUTE = 60;

export function solveGearSystem(
  system: GearSystem,
  elapsedSeconds: number,
): SolvedGearSystem {
  const gearsById = new Map(system.gears.map((gear) => [gear.id, gear]));
  const motions = new Map<string, PropagatedMotion>();
  const queue: string[] = [];

  for (const driverId of system.drivers) {
    const driver = gearsById.get(driverId);

    if (!driver) {
      throw new Error(`Driver gear "${driverId}" does not exist.`);
    }

    motions.set(driver.id, {
      rpm: driver.rpm,
      direction: driver.direction,
      phaseReference: driver.angle + driver.phase,
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

    const outbound = system.connections.filter(
      (connection) => connection.sourceGearId === sourceId,
    );

    for (const connection of outbound) {
      const targetGear = gearsById.get(connection.targetGearId);

      if (!targetGear || motions.has(targetGear.id)) {
        continue;
      }

      const targetMotion =
        connection.kind === "compound"
          ? solveCompoundMotion(sourceMotion, connection)
          : solveMeshMotion(sourceGear, targetGear, sourceMotion, connection);

      motions.set(targetGear.id, targetMotion);
      queue.push(targetGear.id);
    }
  }

  return {
    elapsedSeconds,
    framesByGear: Object.fromEntries(
      system.gears.map((gear) => {
        const motion = motions.get(gear.id) ?? {
          rpm: gear.rpm,
          direction: gear.direction,
          phaseReference: gear.angle + gear.phase,
        };
        const frame: SimulationFrame = {
          gearId: gear.id,
          rpm: motion.rpm,
          direction: motion.direction,
          angleDegrees: normalizeDegrees(
            motion.phaseReference +
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
  const totalSeconds = Math.round(normalized * 60 * 60);
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
  connection: GearConnection,
): PropagatedMotion {
  return {
    rpm: sourceMotion.rpm,
    direction: sourceMotion.direction,
    phaseReference: sourceMotion.phaseReference + connection.phaseOffset,
  };
}

function solveMeshMotion(
  sourceGear: GearNode,
  targetGear: GearNode,
  sourceMotion: PropagatedMotion,
  connection: GearConnection,
): PropagatedMotion {
  const toothRatio =
    connection.ratio > 0
      ? connection.ratio
      : sourceGear.teeth / targetGear.teeth;

  return {
    rpm: sourceMotion.rpm * toothRatio,
    direction: oppositeDirection(sourceMotion.direction),
    phaseReference:
      targetGear.angle + targetGear.phase + connection.phaseOffset,
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
