import { useEffect, useMemo, useState } from "react";
import {
  CirclePlus,
  Hand,
  Link2,
  MousePointer2,
  Pause,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import { GearCanvas } from "./components/GearCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { VisualizationPanel } from "./components/VisualizationPanel";
import { createStarterSystem } from "./data/starter-system";
import {
  formatSexagesimalAngle,
  solveGearSystem,
  type GearNode,
  type GearSystem,
  type RotationDirection,
} from "./simulation/gear-system";

const SIMULATION_STEP_SECONDS = 1 / 30;

export function App() {
  const [gearSystem, setGearSystem] = useState<GearSystem>(() =>
    createStarterSystem(),
  );
  const [selectedGearId, setSelectedGearId] = useState("minute");
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTool, setActiveTool] = useState<
    "select" | "gear" | "connect" | "pan"
  >("select");

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((current) => current + SIMULATION_STEP_SECONDS);
    }, SIMULATION_STEP_SECONDS * 1000);

    return () => window.clearInterval(timerId);
  }, [isPlaying]);

  const solvedSystem = useMemo(
    () => solveGearSystem(gearSystem, elapsedSeconds),
    [elapsedSeconds, gearSystem],
  );

  const selectedGear =
    gearSystem.gears.find((gear) => gear.id === selectedGearId) ??
    gearSystem.gears[0];

  const selectedFrame = selectedGear
    ? solvedSystem.framesByGear[selectedGear.id]
    : undefined;

  function updateSelectedGear(updates: Partial<GearNode>) {
    if (!selectedGear) {
      return;
    }

    setGearSystem((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      gears: current.gears.map((gear) =>
        gear.id === selectedGear.id ? { ...gear, ...updates } : gear,
      ),
    }));
  }

  function addGear() {
    const nextIndex = gearSystem.gears.length + 1;
    const id = `gear-${nextIndex}`;
    const teeth = 15;
    const radius = 42;
    const gear: GearNode = {
      id,
      label: `${teeth}T gear`,
      teeth,
      module: 4,
      radius,
      position: { x: 520, y: 180 + nextIndex * 18 },
      angle: 0,
      phase: 0,
      rpm: 0,
      direction: "clockwise",
      lockedAxle: false,
      isDriver: false,
      color: "#72d2c6",
    };

    setGearSystem((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      gears: [...current.gears, gear],
    }));
    setSelectedGearId(id);
    setActiveTool("select");
  }

  function removeSelectedGear() {
    if (!selectedGear || selectedGear.isDriver) {
      return;
    }

    const remaining = gearSystem.gears.filter(
      (gear) => gear.id !== selectedGear.id,
    );

    setGearSystem((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      gears: remaining,
      connections: current.connections.filter(
        (connection) =>
          connection.sourceGearId !== selectedGear.id &&
          connection.targetGearId !== selectedGear.id,
      ),
    }));
    setSelectedGearId(remaining[0]?.id ?? "");
  }

  function moveGear(gearId: string, position: GearNode["position"]) {
    setGearSystem((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      gears: current.gears.map((gear) =>
        gear.id === gearId ? { ...gear, position } : gear,
      ),
    }));
  }

  function setDirection(direction: RotationDirection) {
    updateSelectedGear({ direction });
  }

  return (
    <main className="appShell">
      <aside className="leftRail" aria-label="Simulator tools">
        <div className="brandMark" aria-hidden="true">
          60
        </div>
        <ToolButton
          active={activeTool === "select"}
          label="Select"
          onClick={() => setActiveTool("select")}
        >
          <MousePointer2 size={18} />
        </ToolButton>
        <ToolButton active={false} label="Create gear" onClick={addGear}>
          <CirclePlus size={18} />
        </ToolButton>
        <ToolButton
          active={activeTool === "connect"}
          label="Connect"
          onClick={() => setActiveTool("connect")}
        >
          <Link2 size={18} />
        </ToolButton>
        <ToolButton
          active={activeTool === "pan"}
          label="Pan"
          onClick={() => setActiveTool("pan")}
        >
          <Hand size={18} />
        </ToolButton>
        <ToolButton
          active={false}
          label="Delete selected gear"
          onClick={removeSelectedGear}
          disabled={!selectedGear || selectedGear.isDriver}
        >
          <Trash2 size={18} />
        </ToolButton>
      </aside>

      <section className="workspace">
        <header className="topBar">
          <div>
            <h1>Base-60 Gear Visualizer</h1>
            <p>
              {gearSystem.name} · {gearSystem.gears.length} gears ·{" "}
              {gearSystem.connections.length} links
            </p>
          </div>
          <div className="topBarActions">
            <button className="ghostButton" type="button">
              <Save size={16} />
              Save System
            </button>
            <button
              className="primaryButton"
              type="button"
              onClick={() => setIsPlaying((current) => !current)}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        </header>

        <div className="canvasPanel">
          <GearCanvas
            activeTool={activeTool}
            gearSystem={gearSystem}
            onMoveGear={moveGear}
            onSelectGear={setSelectedGearId}
            selectedGearId={selectedGear?.id ?? ""}
            solvedSystem={solvedSystem}
          />
          <div className="canvasStatus">
            <span>
              {formatSexagesimalAngle(selectedFrame?.angleDegrees ?? 0)}
            </span>
            <span>{elapsedSeconds.toFixed(2)}s</span>
          </div>
        </div>
      </section>

      <aside className="rightPanel" aria-label="Gear settings and telemetry">
        <InspectorPanel
          gear={selectedGear}
          gears={gearSystem.gears}
          onChange={updateSelectedGear}
          onDirectionChange={setDirection}
          onSelectGear={setSelectedGearId}
          solvedFrame={selectedFrame}
        />
        <VisualizationPanel
          gear={selectedGear}
          gearSystem={gearSystem}
          solvedSystem={solvedSystem}
        />
      </aside>
    </main>
  );
}

interface ToolButtonProps {
  active: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

function ToolButton({
  active,
  children,
  disabled = false,
  label,
  onClick,
}: ToolButtonProps) {
  return (
    <button
      aria-label={label}
      className={active ? "toolButton active" : "toolButton"}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
