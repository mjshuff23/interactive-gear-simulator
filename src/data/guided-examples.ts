import { gearSystemSchema } from "../schema/gear-system-schema";
import { calculateMeshPhaseOffset } from "../simulation/gear-geometry";
import type {
  GearConnection,
  GearNode,
  GearSystem,
  Point,
  RotationDirection,
} from "../simulation/gear-system";

export const GUIDED_EXAMPLE_IDS = [
  "clock-train",
  "harmonic-divisions",
  "compound-axle",
  "fraction-angle",
] as const;

export type GuidedExampleId = (typeof GUIDED_EXAMPLE_IDS)[number];

export interface GuidedExampleDefinition {
  id: GuidedExampleId;
  title: string;
  shortDescription: string;
  relationshipLabels: readonly string[];
  defaultSelectedGearId: string;
  createSystem: () => GearSystem;
}

const FIXTURE_TIMESTAMP = "2026-07-11T00:00:00.000Z";

interface GearSpec {
  id: string;
  label: string;
  teeth: number;
  module: number;
  position: Point;
  color: string;
  angle?: number;
  phase?: number;
  rpm?: number;
  direction?: RotationDirection;
  lockedAxle?: boolean;
  isDriver?: boolean;
}

function gear({
  id,
  label,
  teeth,
  module,
  position,
  color,
  angle = 0,
  phase = 0,
  rpm = 0,
  direction = "clockwise",
  lockedAxle = false,
  isDriver = false,
}: GearSpec): GearNode {
  return {
    id,
    label,
    teeth,
    module,
    position,
    angle,
    phase,
    rpm,
    direction,
    lockedAxle,
    isDriver,
    color,
  };
}

function mesh(source: GearNode, target: GearNode): GearConnection {
  return {
    id: `${source.id}--${target.id}`,
    sourceGearId: source.id,
    targetGearId: target.id,
    kind: "mesh",
    phaseOffset: calculateMeshPhaseOffset(source, target),
  };
}

function compound(source: GearNode, target: GearNode): GearConnection {
  return {
    id: `${source.id}--${target.id}`,
    sourceGearId: source.id,
    targetGearId: target.id,
    kind: "compound",
    phaseOffset: 0,
  };
}

function buildSystem(
  id: string,
  name: string,
  gears: GearNode[],
  connections: GearConnection[],
): GearSystem {
  const drivers = gears
    .filter((entry) => entry.isDriver)
    .map((entry) => entry.id);

  return gearSystemSchema.parse({
    id,
    name,
    base: 60,
    units: "degrees",
    gears,
    connections,
    drivers,
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  });
}

function createClockTrainSystem(): GearSystem {
  // Module 2 pitch radii: 60T=60, 20T=20, 15T=15, 10T=10, 6T=6.
  // Center offsets use 3-4-5 triples so meshed pitch circles are exactly
  // tangent: 80=(64,48), 75=(60,-45), 70=(56,42), 66=(66,0).
  const hourAxle = { x: 150, y: 300 };
  const firstAxle = { x: 214, y: 348 };
  const minuteAxle = { x: 274, y: 303 };
  const thirdAxle = { x: 330, y: 345 };
  const secondAxle = { x: 396, y: 345 };

  const hourWheel = gear({
    id: "hour-wheel",
    label: "60T hour wheel",
    teeth: 60,
    module: 2,
    position: hourAxle,
    rpm: 1 / 720,
    direction: "clockwise",
    lockedAxle: true,
    isDriver: true,
    color: "#c99743",
  });
  const stageOnePinion = gear({
    id: "stage-one-pinion",
    label: "20T pinion",
    teeth: 20,
    module: 2,
    position: firstAxle,
    direction: "counterclockwise",
    lockedAxle: true,
    color: "#51b8d8",
  });
  const stageOneWheel = gear({
    id: "stage-one-wheel",
    label: "60T wheel",
    teeth: 60,
    module: 2,
    position: firstAxle,
    direction: "counterclockwise",
    lockedAxle: true,
    color: "#5c86c5",
  });
  const minutePinion = gear({
    id: "minute-pinion",
    label: "15T minute pinion",
    teeth: 15,
    module: 2,
    position: minuteAxle,
    direction: "clockwise",
    lockedAxle: true,
    color: "#78c98c",
  });
  const minuteWheel = gear({
    id: "minute-wheel",
    label: "60T minute wheel",
    teeth: 60,
    module: 2,
    position: minuteAxle,
    direction: "clockwise",
    lockedAxle: true,
    color: "#69b58a",
  });
  const stageThreePinion = gear({
    id: "stage-three-pinion",
    label: "10T pinion",
    teeth: 10,
    module: 2,
    position: thirdAxle,
    direction: "counterclockwise",
    lockedAxle: true,
    color: "#e18f5a",
  });
  const stageThreeWheel = gear({
    id: "stage-three-wheel",
    label: "60T wheel",
    teeth: 60,
    module: 2,
    position: thirdAxle,
    direction: "counterclockwise",
    lockedAxle: true,
    color: "#d07a6b",
  });
  const secondPinion = gear({
    id: "second-pinion",
    label: "6T second pinion",
    teeth: 6,
    module: 2,
    position: secondAxle,
    direction: "clockwise",
    lockedAxle: true,
    color: "#72d2c6",
  });

  return buildSystem(
    "guided-clock-train",
    "Idealized Clock-Hand Ratio Train",
    [
      hourWheel,
      stageOnePinion,
      stageOneWheel,
      minutePinion,
      minuteWheel,
      stageThreePinion,
      stageThreeWheel,
      secondPinion,
    ],
    [
      mesh(hourWheel, stageOnePinion),
      compound(stageOnePinion, stageOneWheel),
      mesh(stageOneWheel, minutePinion),
      compound(minutePinion, minuteWheel),
      mesh(minuteWheel, stageThreePinion),
      compound(stageThreePinion, stageThreeWheel),
      mesh(stageThreeWheel, secondPinion),
    ],
  );
}

function createHarmonicDivisionsSystem(): GearSystem {
  // Module 3 pitch radii: 60T=90, 30T=45, 20T=30, 15T=22.5. Followers sit
  // axis-aligned at exactly the sum of pitch radii from the reference.
  const reference = gear({
    id: "reference-60",
    label: "60T reference",
    teeth: 60,
    module: 3,
    position: { x: 300, y: 300 },
    rpm: 1,
    direction: "clockwise",
    lockedAxle: true,
    isDriver: true,
    color: "#c99743",
  });
  const half = gear({
    id: "half-30",
    label: "30T half",
    teeth: 30,
    module: 3,
    position: { x: 435, y: 300 },
    direction: "counterclockwise",
    color: "#51b8d8",
  });
  const third = gear({
    id: "third-20",
    label: "20T third",
    teeth: 20,
    module: 3,
    position: { x: 300, y: 180 },
    direction: "counterclockwise",
    color: "#78c98c",
  });
  const quarter = gear({
    id: "quarter-15",
    label: "15T quarter",
    teeth: 15,
    module: 3,
    position: { x: 300, y: 412.5 },
    direction: "counterclockwise",
    color: "#e18f5a",
  });

  return buildSystem(
    "guided-harmonic-divisions",
    "Harmonic Divisions of 60",
    [reference, half, third, quarter],
    [mesh(reference, half), mesh(reference, third), mesh(reference, quarter)],
  );
}

function createCompoundAxleSystem(): GearSystem {
  // Module 3 pitch radii: 60T=90, 20T=30, 30T=45, 15T=22.5.
  const inputAxle = { x: 240, y: 300 };
  const sharedAxle = { x: 360, y: 300 };
  const outputAxle = { x: 427.5, y: 300 };

  const input = gear({
    id: "input-60",
    label: "60T input",
    teeth: 60,
    module: 3,
    position: inputAxle,
    rpm: 1,
    direction: "clockwise",
    lockedAxle: true,
    isDriver: true,
    color: "#c99743",
  });
  const idlerPinion = gear({
    id: "idler-pinion-20",
    label: "20T pinion",
    teeth: 20,
    module: 3,
    position: sharedAxle,
    direction: "counterclockwise",
    lockedAxle: true,
    color: "#51b8d8",
  });
  const axleWheel = gear({
    id: "axle-wheel-30",
    label: "30T axle wheel",
    teeth: 30,
    module: 3,
    position: sharedAxle,
    direction: "counterclockwise",
    lockedAxle: true,
    color: "#5c86c5",
  });
  const output = gear({
    id: "output-15",
    label: "15T output",
    teeth: 15,
    module: 3,
    position: outputAxle,
    direction: "clockwise",
    color: "#78c98c",
  });

  return buildSystem(
    "guided-compound-axle",
    "Compound Axle Multiplication",
    [input, idlerPinion, axleWheel, output],
    [
      mesh(input, idlerPinion),
      compound(idlerPinion, axleWheel),
      mesh(axleWheel, output),
    ],
  );
}

function createFractionAngleSystem(): GearSystem {
  // Module 3 pitch radii: 60T=90, 12T=18; centers 108 apart.
  const tickWheel = gear({
    id: "tick-60",
    label: "60T tick wheel",
    teeth: 60,
    module: 3,
    position: { x: 330, y: 300 },
    rpm: 1,
    direction: "clockwise",
    lockedAxle: true,
    isDriver: true,
    color: "#c99743",
  });
  const fifth = gear({
    id: "fifth-12",
    label: "12T fifth",
    teeth: 12,
    module: 3,
    position: { x: 438, y: 300 },
    angle: 72,
    direction: "counterclockwise",
    color: "#72d2c6",
  });

  return buildSystem(
    "guided-fraction-angle",
    "Base-60 Fraction and Angle",
    [tickWheel, fifth],
    [mesh(tickWheel, fifth)],
  );
}

export const GUIDED_EXAMPLES: readonly GuidedExampleDefinition[] = [
  {
    id: "clock-train",
    title: "Idealized Clock-Hand Ratio Train",
    shortDescription:
      "Four compound stages turn one revolution per 12 hours into the relative angular speeds of clock hands.",
    relationshipLabels: [
      "Hour → minute: 12× angular speed",
      "Minute → second: 60× angular speed",
      "Hour → second: 720× angular speed",
      "Idealized ratio train; not a complete clock escapement",
      "Runs at real clock speed: the 6T second pinion turns once per minute; the hour wheel once per 12 hours",
    ],
    defaultSelectedGearId: "second-pinion",
    createSystem: createClockTrainSystem,
  },
  {
    id: "harmonic-divisions",
    title: "Harmonic Divisions of 60",
    shortDescription:
      "One 60-tooth reference meshes 30T, 20T, and 15T followers to show why 60 divides so cleanly.",
    relationshipLabels: [
      "30 / 60 = 1/2 of the reference circumference; follower rotates 2×",
      "20 / 60 = 1/3; follower rotates 3×",
      "15 / 60 = 1/4; follower rotates 4×",
      "All three divisions are exact because 30, 20, and 15 divide 60 evenly",
    ],
    defaultSelectedGearId: "quarter-15",
    createSystem: createHarmonicDivisionsSystem,
  },
  {
    id: "compound-axle",
    title: "Compound Axle Multiplication",
    shortDescription:
      "A meshed stage and a shared axle combine so two small ratios multiply into one larger one.",
    relationshipLabels: [
      "Meshed gears reverse direction",
      "Compound gears share one axle, RPM, and direction",
      "Overall ratio: 3 × 2 = 6",
    ],
    defaultSelectedGearId: "output-15",
    createSystem: createCompoundAxleSystem,
  },
  {
    id: "fraction-angle",
    title: "Base-60 Fraction and Angle",
    shortDescription:
      "A 60T → 12T mesh links a divisor of 60 to a fraction of a full turn.",
    relationshipLabels: [
      "12 of 60 ticks = 1/5 of the cycle",
      "1/5 of 360° = 72°",
      "A 60T → 12T mesh produces a 5:1 speed relationship",
    ],
    defaultSelectedGearId: "fifth-12",
    createSystem: createFractionAngleSystem,
  },
];

export function getGuidedExample(id: GuidedExampleId): GuidedExampleDefinition {
  const example = GUIDED_EXAMPLES.find((entry) => entry.id === id);

  if (!example) {
    throw new Error(`Unknown guided example "${id}".`);
  }

  return example;
}

export const DEFAULT_GUIDED_EXAMPLE = GUIDED_EXAMPLES[0];
