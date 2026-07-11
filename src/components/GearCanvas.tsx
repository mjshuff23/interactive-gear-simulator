import { useCallback, useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import {
  pitchRadius,
  type ConnectionValidationResult,
} from "../simulation/gear-geometry";
import type {
  GearConnection,
  GearNode,
  GearSystem,
  SolvedGearSystem,
} from "../simulation/gear-system";

interface GearCanvasProps {
  activeTool: "select" | "gear" | "connect" | "pan";
  gearSystem: GearSystem;
  onFinishMoveGear: (gearId: string) => void;
  onMoveGear: (gearId: string, position: GearNode["position"]) => void;
  onSelectGear: (gearId: string) => void;
  selectedGearId: string;
  solvedSystem: SolvedGearSystem;
  validation: ConnectionValidationResult;
}

interface GearDisplay {
  body: Graphics;
  container: Container;
  label: Text;
  selectionRing: Graphics;
}

interface SceneLayers {
  connections: Graphics;
  gears: Container;
  grid: Graphics;
}

const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 620;
const GRID_CENTER = { x: 300, y: 300 };

export function GearCanvas({
  activeTool,
  gearSystem,
  onFinishMoveGear,
  onMoveGear,
  onSelectGear,
  selectedGearId,
  solvedSystem,
  validation,
}: GearCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const callbacksRef = useRef({
    onFinishMoveGear,
    onMoveGear,
    onSelectGear,
  });
  const dragRef = useRef<string | null>(null);
  const gearDisplaysRef = useRef<Map<string, GearDisplay>>(new Map());
  const layersRef = useRef<SceneLayers | null>(null);
  const activeToolRef = useRef(activeTool);
  const [isPixiReady, setIsPixiReady] = useState(false);

  const createGearDisplay = useCallback((gearId: string): GearDisplay => {
    const container = new Container();
    const body = new Graphics();
    const label = new Text({
      text: "",
      style: {
        fill: "#f7f2e8",
        fontFamily: "Inter, ui-sans-serif, system-ui",
        fontSize: 13,
        fontWeight: "700",
      },
    });
    const selectionRing = new Graphics();

    label.anchor.set(0.5);
    container.cursor = "pointer";
    container.eventMode = "static";
    container.addChild(body);
    container.addChild(label);
    container.addChild(selectionRing);
    container.on("pointertap", () => {
      callbacksRef.current.onSelectGear(gearId);
    });
    container.on("pointerdown", () => {
      if (activeToolRef.current === "select") {
        dragRef.current = gearId;
      }
    });
    const finishDrag = () => {
      if (dragRef.current !== gearId) {
        return;
      }

      dragRef.current = null;
      callbacksRef.current.onFinishMoveGear(gearId);
    };

    container.on("pointerup", finishDrag);
    container.on("pointerupoutside", finishDrag);
    container.on("pointercancel", () => {
      if (dragRef.current === gearId) {
        dragRef.current = null;
      }
    });
    container.on("globalpointermove", (event) => {
      if (dragRef.current !== gearId || activeToolRef.current !== "select") {
        return;
      }

      callbacksRef.current.onMoveGear(gearId, {
        x: Math.round(event.global.x),
        y: Math.round(event.global.y),
      });
    });

    return { body, container, label, selectionRing };
  }, []);

  useEffect(() => {
    callbacksRef.current = {
      onFinishMoveGear,
      onMoveGear,
      onSelectGear,
    };
  }, [onFinishMoveGear, onMoveGear, onSelectGear]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    let destroyed = false;
    let initialized = false;
    const app = new Application();
    const gearDisplays = gearDisplaysRef.current;
    appRef.current = app;

    async function initPixi() {
      await app.init({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        background: "#101317",
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      initialized = true;

      if (destroyed || !hostRef.current) {
        app.destroy();
        return;
      }

      const grid = new Graphics();
      const connections = new Graphics();
      const gears = new Container();

      drawBase60Grid(grid);
      app.stage.addChild(grid);
      app.stage.addChild(connections);
      app.stage.addChild(gears);
      layersRef.current = { connections, gears, grid };
      hostRef.current.appendChild(app.canvas);
      setIsPixiReady(true);
    }

    void initPixi();

    return () => {
      destroyed = true;
      gearDisplays.clear();
      layersRef.current = null;

      // Destroying before the async init() resolves throws inside Pixi and
      // blanks the app; a pre-init unmount is instead handled by the
      // `destroyed` check in initPixi once init completes.
      if (initialized) {
        app.destroy(true);
      }

      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isPixiReady) {
      return;
    }

    const layers = layersRef.current;

    if (!layers) {
      return;
    }

    drawConnections(layers.connections, gearSystem, validation);
    syncGearDisplays({
      activeTool,
      createGearDisplay,
      gearSystem,
      gearDisplays: gearDisplaysRef.current,
      gearsLayer: layers.gears,
      selectedGearId,
      solvedSystem,
    });
  }, [
    activeTool,
    createGearDisplay,
    gearSystem,
    isPixiReady,
    selectedGearId,
    solvedSystem,
    validation,
  ]);

  return <div className="gearCanvas" ref={hostRef} />;
}

function syncGearDisplays({
  activeTool,
  createGearDisplay,
  gearDisplays,
  gearSystem,
  gearsLayer,
  selectedGearId,
  solvedSystem,
}: {
  activeTool: GearCanvasProps["activeTool"];
  createGearDisplay: (gearId: string) => GearDisplay;
  gearDisplays: Map<string, GearDisplay>;
  gearSystem: GearSystem;
  gearsLayer: Container;
  selectedGearId: string;
  solvedSystem: SolvedGearSystem;
}) {
  const currentGearIds = new Set(gearSystem.gears.map((gear) => gear.id));

  for (const [gearId, display] of gearDisplays) {
    if (!currentGearIds.has(gearId)) {
      gearsLayer.removeChild(display.container);
      display.container.destroy({ children: true });
      gearDisplays.delete(gearId);
    }
  }

  for (const gear of gearSystem.gears) {
    const frame = solvedSystem.framesByGear[gear.id];
    let display = gearDisplays.get(gear.id);

    if (!display) {
      display = createGearDisplay(gear.id);
      gearDisplays.set(gear.id, display);
      gearsLayer.addChild(display.container);
    }

    updateGearDisplay({
      activeTool,
      angleDegrees: frame?.toothAngleDegrees ?? gear.angle,
      display,
      gear,
      isSelected: gear.id === selectedGearId,
    });
  }
}

function drawBase60Grid(grid: Graphics) {
  grid.clear();
  grid.circle(GRID_CENTER.x, GRID_CENTER.y, 250).stroke({
    color: 0x303844,
    width: 1,
  });
  grid.circle(GRID_CENTER.x, GRID_CENTER.y, 170).stroke({
    color: 0x222a34,
    width: 1,
  });

  for (let node = 0; node < 60; node += 1) {
    const angle = (node / 60) * Math.PI * 2 - Math.PI / 2;
    const major = node % 5 === 0;
    const innerRadius = major ? 220 : 236;
    const outerRadius = 250;
    const x1 = GRID_CENTER.x + Math.cos(angle) * innerRadius;
    const y1 = GRID_CENTER.y + Math.sin(angle) * innerRadius;
    const x2 = GRID_CENTER.x + Math.cos(angle) * outerRadius;
    const y2 = GRID_CENTER.y + Math.sin(angle) * outerRadius;

    grid
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({
        color: major ? 0x5c6878 : 0x303844,
        width: major ? 2 : 1,
      });
  }
}

function drawConnections(
  connections: Graphics,
  gearSystem: GearSystem,
  validation: ConnectionValidationResult,
) {
  const gearsById = new Map(gearSystem.gears.map((gear) => [gear.id, gear]));
  const jammedConnectionIds = new Set(
    validation.jammedComponents.flatMap((component) => component.connectionIds),
  );

  connections.clear();

  for (const connection of gearSystem.connections) {
    const source = gearsById.get(connection.sourceGearId);
    const target = gearsById.get(connection.targetGearId);

    if (!source || !target) {
      continue;
    }

    drawConnection(
      connections,
      connection,
      source,
      target,
      resolveConnectionDisplayStatus(
        connection.id,
        validation,
        jammedConnectionIds,
      ),
    );
  }
}

type ConnectionDisplayStatus = "invalid" | "jammed" | "valid";

function resolveConnectionDisplayStatus(
  connectionId: string,
  validation: ConnectionValidationResult,
  jammedConnectionIds: ReadonlySet<string>,
): ConnectionDisplayStatus {
  if (!validation.byConnectionId[connectionId]?.isGeometricallyValid) {
    return "invalid";
  }

  return jammedConnectionIds.has(connectionId) ? "jammed" : "valid";
}

function drawConnection(
  connections: Graphics,
  connection: GearConnection,
  source: GearNode,
  target: GearNode,
  status: ConnectionDisplayStatus,
) {
  if (status === "invalid") {
    if (
      source.position.x === target.position.x &&
      source.position.y === target.position.y
    ) {
      drawDashedCircle(connections, source.position, 7, 0xd95d5d, 3);
    } else {
      drawDashedLine(
        connections,
        source.position,
        target.position,
        0xd95d5d,
        3,
      );
    }
    return;
  }

  if (status === "jammed") {
    if (connection.kind === "compound") {
      drawDashedCircle(connections, source.position, 7, 0xd6a647, 3);
    } else {
      drawDashedLine(
        connections,
        source.position,
        target.position,
        0xd6a647,
        3,
      );
    }
    return;
  }

  if (connection.kind === "compound") {
    connections.circle(source.position.x, source.position.y, 7).stroke({
      color: 0xe18f5a,
      width: 3,
      alpha: 0.75,
    });
  } else {
    connections
      .moveTo(source.position.x, source.position.y)
      .lineTo(target.position.x, target.position.y)
      .stroke({ color: 0x6aa7c8, width: 2, alpha: 0.55 });
  }
}

function drawDashedLine(
  graphics: Graphics,
  start: GearNode["position"],
  end: GearNode["position"],
  color: number,
  width: number,
) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);

  if (length === 0) {
    return;
  }

  const dashLength = 9;
  const gapLength = 6;
  const unitX = (end.x - start.x) / length;
  const unitY = (end.y - start.y) / length;

  for (let offset = 0; offset < length; offset += dashLength + gapLength) {
    const dashEnd = Math.min(offset + dashLength, length);

    graphics
      .moveTo(start.x + unitX * offset, start.y + unitY * offset)
      .lineTo(start.x + unitX * dashEnd, start.y + unitY * dashEnd)
      .stroke({ color, width, alpha: 0.9 });
  }
}

function drawDashedCircle(
  graphics: Graphics,
  center: GearNode["position"],
  radius: number,
  color: number,
  width: number,
) {
  const segments = 12;

  for (let segment = 0; segment < segments; segment += 2) {
    const startAngle = (segment / segments) * Math.PI * 2;
    const endAngle = ((segment + 1) / segments) * Math.PI * 2;

    graphics
      .moveTo(
        center.x + Math.cos(startAngle) * radius,
        center.y + Math.sin(startAngle) * radius,
      )
      .arc(center.x, center.y, radius, startAngle, endAngle)
      .stroke({ color, width, alpha: 0.95 });
  }
}

function updateGearDisplay({
  activeTool,
  angleDegrees,
  display,
  gear,
  isSelected,
}: {
  activeTool: GearCanvasProps["activeTool"];
  angleDegrees: number;
  display: GearDisplay;
  gear: GearNode;
  isSelected: boolean;
}) {
  const radius = pitchRadius(gear);

  display.container.eventMode = activeTool === "pan" ? "none" : "static";
  display.container.position.set(gear.position.x, gear.position.y);
  display.label.text = `${gear.teeth}T`;
  drawGearBody(display.body, gear, angleDegrees);
  drawSelectionRing(display.selectionRing, isSelected ? radius + 13 : 0);
}

function drawGearBody(body: Graphics, gear: GearNode, angleDegrees: number) {
  const color = Number.parseInt(gear.color.replace("#", ""), 16);
  const radius = pitchRadius(gear);
  const toothDepth = Math.max(6, Math.min(12, radius * 0.09));
  const angleRadians = (angleDegrees * Math.PI) / 180;

  body.clear();
  body.circle(0, 0, radius).fill({ color, alpha: 0.36 });
  body.circle(0, 0, radius).stroke({ color, width: 2 });
  body.circle(0, 0, Math.max(9, radius * 0.14)).fill({
    color: 0x101317,
    alpha: 0.95,
  });

  for (let tooth = 0; tooth < gear.teeth; tooth += 1) {
    const toothAngle = (tooth / gear.teeth) * Math.PI * 2 + angleRadians;
    const x1 = Math.cos(toothAngle) * (radius - 2);
    const y1 = Math.sin(toothAngle) * (radius - 2);
    const x2 = Math.cos(toothAngle) * (radius + toothDepth);
    const y2 = Math.sin(toothAngle) * (radius + toothDepth);

    body
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({
        color,
        width: gear.teeth > 40 ? 1 : 2,
        alpha: 0.9,
      });
  }
}

function drawSelectionRing(selectionRing: Graphics, radius: number) {
  selectionRing.clear();

  if (radius <= 0) {
    return;
  }

  selectionRing.circle(0, 0, radius).stroke({
    color: 0x72d2c6,
    width: 2,
    alpha: 0.95,
  });
}
