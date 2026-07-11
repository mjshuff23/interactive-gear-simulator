import { describe, expect, it } from "vitest";
import {
  formatSexagesimalAngle,
  solveGearSystem,
  type GearSystem,
} from "./gear-system";

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
          radius: 120,
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
          radius: 60,
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
          ratio: 2,
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
          radius: 40,
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
          radius: 120,
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
          ratio: 1,
          phaseOffset: 15,
        },
      ],
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
    };

    const solved = solveGearSystem(system, 5);

    expect(solved.framesByGear.coaxial.rpm).toBe(6);
    expect(solved.framesByGear.coaxial.direction).toBe("counterclockwise");
    expect(solved.framesByGear.coaxial.angleDegrees).toBe(195);
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
