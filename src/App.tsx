import { useEffect, useMemo, useRef, useState } from "react";
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
import { GuidedExampleExplanation } from "./components/GuidedExampleExplanation";
import { GuidedExampleSelector } from "./components/GuidedExampleSelector";
import { InspectorPanel } from "./components/InspectorPanel";
import { VisualizationPanel } from "./components/VisualizationPanel";
import {
  DEFAULT_GUIDED_EXAMPLE,
  getGuidedExample,
  type GuidedExampleId,
} from "./data/guided-examples";
import {
  formatSexagesimalAngle,
  solveGearSystem,
  type GearNode,
  type GearSystem,
  type RotationDirection,
} from "./simulation/gear-system";

const SIMULATION_STEP_SECONDS = 1 / 30;

export function App() {
  const [activeExampleId, setActiveExampleId] = useState<GuidedExampleId>(
    DEFAULT_GUIDED_EXAMPLE.id,
  );
  const [gearSystem, setGearSystem] = useState<GearSystem>(() =>
    DEFAULT_GUIDED_EXAMPLE.createSystem(),
  );
  const [selectedGearId, setSelectedGearId] = useState(
    DEFAULT_GUIDED_EXAMPLE.defaultSelectedGearId,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTool, setActiveTool] = useState<
    "select" | "gear" | "connect" | "pan"
  >("select");
  const [isDirty, setIsDirty] = useState(false);
  const elapsedSecondsRef = useRef(elapsedSeconds);
  const nextGeneratedGearIndexRef = useRef(
    getNextGeneratedGearIndex(gearSystem.gears),
  );
  const activeExample = getGuidedExample(activeExampleId);

  function loadGuidedExample(exampleId: GuidedExampleId): boolean {
    if (exampleId === activeExampleId) {
      return true;
    }

    if (
      isDirty &&
      !window.confirm(
        "Loading another guided example will replace your unsaved changes to the current canvas. Continue?",
      )
    ) {
      return false;
    }

    const example = getGuidedExample(exampleId);
    const system = example.createSystem();

    setActiveExampleId(example.id);
    setGearSystem(system);
    setSelectedGearId(example.defaultSelectedGearId);
    setIsPlaying(false);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setActiveTool("select");
    nextGeneratedGearIndexRef.current = getNextGeneratedGearIndex(system.gears);
    setIsDirty(false);

    return true;
  }

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const startTime = performance.now();
    const startElapsedSeconds = elapsedSecondsRef.current;

    const timerId = window.setInterval(() => {
      const elapsedSinceStart = (performance.now() - startTime) / 1000;

      setElapsedSeconds(startElapsedSeconds + elapsedSinceStart);
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

    const hasChanges = Object.entries(updates).some(
      ([key, value]) => !Object.is(selectedGear[key as keyof GearNode], value),
    );

    if (!hasChanges) {
      return;
    }

    setGearSystem((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      gears: current.gears.map((gear) =>
        gear.id === selectedGear.id ? { ...gear, ...updates } : gear,
      ),
    }));
    setIsDirty(true);
  }

  function addGear() {
    const nextIndex = nextGeneratedGearIndexRef.current;
    nextGeneratedGearIndexRef.current += 1;

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
    setIsDirty(true);
  }

  function removeSelectedGear() {
    if (!selectedGear || selectedGear.isDriver) {
      return;
    }

    const gearIdToRemove = selectedGear.id;

    setGearSystem((current) => {
      const remaining = current.gears.filter(
        (gear) => gear.id !== gearIdToRemove,
      );

      return {
        ...current,
        updatedAt: new Date().toISOString(),
        gears: remaining,
        connections: current.connections.filter(
          (connection) =>
            connection.sourceGearId !== gearIdToRemove &&
            connection.targetGearId !== gearIdToRemove,
        ),
      };
    });
    setSelectedGearId((currentSelectedGearId) =>
      currentSelectedGearId === gearIdToRemove ? "" : currentSelectedGearId,
    );
    setIsDirty(true);
  }

  function moveGear(gearId: string, position: GearNode["position"]) {
    setGearSystem((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      gears: current.gears.map((gear) =>
        gear.id === gearId ? { ...gear, position } : gear,
      ),
    }));
    setIsDirty(true);
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
          active={false}
          disabled
          label="Connect (coming soon)"
          onClick={() => undefined}
        >
          <Link2 size={18} />
        </ToolButton>
        <ToolButton
          active={false}
          disabled
          label="Pan (coming soon)"
          onClick={() => undefined}
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
            <GuidedExampleSelector
              activeExampleId={activeExampleId}
              onSelectExample={loadGuidedExample}
            />
            <button
              className="ghostButton"
              disabled
              title="Saving is unavailable until Supabase auth is connected."
              type="button"
            >
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

        <GuidedExampleExplanation example={activeExample} />

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

function getNextGeneratedGearIndex(gears: GearNode[]): number {
  return (
    gears.reduce((highestIndex, gear) => {
      const match = /^gear-(\d+)$/.exec(gear.id);

      return match ? Math.max(highestIndex, Number(match[1])) : highestIndex;
    }, 0) + 1
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
