import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import type {
  GearNode,
  GearSystem,
  SolvedGearSystem,
} from "../simulation/gear-system";

interface GearCanvasProps {
  activeTool: "select" | "gear" | "connect" | "pan";
  gearSystem: GearSystem;
  onMoveGear: (gearId: string, position: GearNode["position"]) => void;
  onSelectGear: (gearId: string) => void;
  selectedGearId: string;
  solvedSystem: SolvedGearSystem;
}

const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 620;
const GRID_CENTER = { x: 300, y: 300 };

export function GearCanvas({
  activeTool,
  gearSystem,
  onMoveGear,
  onSelectGear,
  selectedGearId,
  solvedSystem,
}: GearCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const dragRef = useRef<string | null>(null);

  useEffect(() => {
    let destroyed = false;
    const app = new Application();
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

      if (destroyed || !hostRef.current) {
        app.destroy();
        return;
      }

      hostRef.current.appendChild(app.canvas);
    }

    void initPixi();

    return () => {
      destroyed = true;
      app.destroy(true);
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;

    if (!app?.stage) {
      return;
    }

    app.stage.removeChildren();
    drawBase60Grid(app.stage);
    drawConnections(app.stage, gearSystem);

    for (const gear of gearSystem.gears) {
      const frame = solvedSystem.framesByGear[gear.id];
      const gearContainer = drawGear(gear, frame?.angleDegrees ?? gear.angle);

      gearContainer.eventMode = activeTool === "pan" ? "none" : "static";
      gearContainer.cursor = "pointer";
      gearContainer.on("pointertap", () => onSelectGear(gear.id));
      gearContainer.on("pointerdown", () => {
        if (activeTool === "select") {
          dragRef.current = gear.id;
        }
      });
      gearContainer.on("pointerup", () => {
        dragRef.current = null;
      });
      gearContainer.on("pointerupoutside", () => {
        dragRef.current = null;
      });
      gearContainer.on("globalpointermove", (event) => {
        if (dragRef.current !== gear.id || activeTool !== "select") {
          return;
        }

        onMoveGear(gear.id, {
          x: Math.round(event.global.x),
          y: Math.round(event.global.y),
        });
      });

      if (gear.id === selectedGearId) {
        drawSelectionRing(gearContainer, gear.radius + 13);
      }

      app.stage.addChild(gearContainer);
    }
  }, [
    activeTool,
    gearSystem,
    onMoveGear,
    onSelectGear,
    selectedGearId,
    solvedSystem,
  ]);

  return <div className="gearCanvas" ref={hostRef} />;
}

function drawBase60Grid(stage: Container) {
  const grid = new Graphics();

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

  stage.addChild(grid);
}

function drawConnections(stage: Container, gearSystem: GearSystem) {
  const gearsById = new Map(gearSystem.gears.map((gear) => [gear.id, gear]));
  const connections = new Graphics();

  for (const connection of gearSystem.connections) {
    const source = gearsById.get(connection.sourceGearId);
    const target = gearsById.get(connection.targetGearId);

    if (!source || !target) {
      continue;
    }

    connections
      .moveTo(source.position.x, source.position.y)
      .lineTo(target.position.x, target.position.y)
      .stroke({
        color: connection.kind === "compound" ? 0xe18f5a : 0x6aa7c8,
        width: connection.kind === "compound" ? 3 : 2,
        alpha: 0.55,
      });
  }

  stage.addChild(connections);
}

function drawGear(gear: GearNode, angleDegrees: number): Container {
  const container = new Container();
  const color = Number.parseInt(gear.color.replace("#", ""), 16);
  const toothDepth = Math.max(6, Math.min(12, gear.radius * 0.09));
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const body = new Graphics();
  const label = new Text({
    text: `${gear.teeth}T`,
    style: {
      fill: "#f7f2e8",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      fontSize: 13,
      fontWeight: "700",
    },
  });

  body.circle(0, 0, gear.radius).fill({ color, alpha: 0.36 });
  body.circle(0, 0, gear.radius).stroke({ color, width: 2 });
  body.circle(0, 0, Math.max(9, gear.radius * 0.14)).fill({
    color: 0x101317,
    alpha: 0.95,
  });

  for (let tooth = 0; tooth < gear.teeth; tooth += 1) {
    const toothAngle = (tooth / gear.teeth) * Math.PI * 2 + angleRadians;
    const x1 = Math.cos(toothAngle) * (gear.radius - 2);
    const y1 = Math.sin(toothAngle) * (gear.radius - 2);
    const x2 = Math.cos(toothAngle) * (gear.radius + toothDepth);
    const y2 = Math.sin(toothAngle) * (gear.radius + toothDepth);

    body
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({
        color,
        width: gear.teeth > 40 ? 1 : 2,
        alpha: 0.9,
      });
  }

  label.anchor.set(0.5);
  container.position.set(gear.position.x, gear.position.y);
  container.addChild(body);
  container.addChild(label);

  return container;
}

function drawSelectionRing(container: Container, radius: number) {
  const ring = new Graphics();

  ring.circle(0, 0, radius).stroke({
    color: 0x72d2c6,
    width: 2,
    alpha: 0.95,
  });
  container.addChild(ring);
}
