import type {
  GearNode,
  RotationDirection,
  SimulationFrame,
} from "../simulation/gear-system";

interface InspectorPanelProps {
  gear: GearNode | undefined;
  gears: GearNode[];
  onChange: (updates: Partial<GearNode>) => void;
  onDirectionChange: (direction: RotationDirection) => void;
  onSelectGear: (gearId: string) => void;
  solvedFrame: SimulationFrame | undefined;
}

export function InspectorPanel({
  gear,
  gears,
  onChange,
  onDirectionChange,
  onSelectGear,
  solvedFrame,
}: InspectorPanelProps) {
  if (!gear) {
    return (
      <section className="panelSection">
        <h2>Inspector</h2>
        <p className="muted">Add or select a gear.</p>
      </section>
    );
  }

  return (
    <section className="panelSection">
      <div className="sectionHeader">
        <h2>Inspector</h2>
        <span>{gear.isDriver ? "Driver" : "Follower"}</span>
      </div>

      <label className="field">
        <span>Selected Gear</span>
        <select
          value={gear.id}
          onChange={(event) => onSelectGear(event.target.value)}
        >
          {gears.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Teeth</span>
        <input
          min={6}
          max={120}
          type="number"
          value={gear.teeth}
          onChange={(event) => {
            const teeth = parseFiniteNumber(event.target.value);

            if (teeth === null) {
              return;
            }

            onChange({
              teeth,
              radius: Math.max(28, teeth * 1.9),
            });
          }}
        />
      </label>

      <label className="field">
        <span>Radius</span>
        <input
          min={24}
          max={160}
          type="number"
          value={Math.round(gear.radius)}
          onChange={(event) => {
            const radius = parseFiniteNumber(event.target.value);

            if (radius === null) {
              return;
            }

            onChange({ radius });
          }}
        />
      </label>

      <label className="field">
        <span>RPM</span>
        <input
          disabled={!gear.isDriver}
          max={60}
          min={0}
          step={0.25}
          type="number"
          value={gear.rpm}
          onChange={(event) => {
            const rpm = parseFiniteNumber(event.target.value);

            if (rpm === null) {
              return;
            }

            onChange({ rpm });
          }}
        />
      </label>

      <label className="field">
        <span>Phase</span>
        <input
          max={360}
          min={0}
          type="number"
          value={gear.phase}
          onChange={(event) => {
            const phase = parseFiniteNumber(event.target.value);

            if (phase === null) {
              return;
            }

            onChange({ phase });
          }}
        />
      </label>

      <div className="segmentedControl" aria-label="Direction">
        <button
          className={gear.direction === "clockwise" ? "selected" : ""}
          type="button"
          onClick={() => onDirectionChange("clockwise")}
        >
          CW
        </button>
        <button
          className={gear.direction === "counterclockwise" ? "selected" : ""}
          type="button"
          onClick={() => onDirectionChange("counterclockwise")}
        >
          CCW
        </button>
      </div>

      <label className="field inlineField">
        <span>Locked axle</span>
        <input
          checked={gear.lockedAxle}
          type="checkbox"
          onChange={(event) => onChange({ lockedAxle: event.target.checked })}
        />
      </label>

      <label className="field">
        <span>Color</span>
        <input
          type="color"
          value={gear.color}
          onChange={(event) => onChange({ color: event.target.value })}
        />
      </label>

      <div className="readoutGrid">
        <div>
          <span>Resolved RPM</span>
          <strong>{solvedFrame?.rpm.toFixed(2) ?? "0.00"}</strong>
        </div>
        <div>
          <span>Direction</span>
          <strong>
            {solvedFrame?.direction === "clockwise" ? "CW" : "CCW"}
          </strong>
        </div>
      </div>
    </section>
  );
}

function parseFiniteNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
