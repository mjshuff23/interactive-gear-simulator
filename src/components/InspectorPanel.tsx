import { useState } from "react";
import { pitchRadius } from "../simulation/gear-geometry";

import type {
  GearNode,
  RotationDirection,
  SimulationFrame,
} from "../simulation/gear-system";

interface InspectorPanelProps {
  readonly gear: GearNode | undefined;
  readonly gears: GearNode[];
  readonly onChange: (updates: Partial<GearNode>) => void;
  readonly onDirectionChange: (direction: RotationDirection) => void;
  readonly onSelectGear: (gearId: string) => void;
  readonly solvedFrame: SimulationFrame | undefined;
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

      <NumericField
        key={`${gear.id}-teeth`}
        label="Teeth"
        max={120}
        min={6}
        value={gear.teeth}
        onCommit={(teeth) => onChange({ teeth })}
      />

      <div className="field derivedField">
        <span>Pitch radius</span>
        <output>{pitchRadius(gear).toFixed(2)} px</output>
      </div>

      <NumericField
        key={`${gear.id}-rpm`}
        disabled={!gear.isDriver}
        label="RPM"
        max={60}
        min={0}
        step={0.25}
        value={gear.rpm}
        onCommit={(rpm) => onChange({ rpm })}
      />

      <NumericField
        key={`${gear.id}-phase`}
        label="Phase"
        max={360}
        min={0}
        value={gear.phase}
        onCommit={(phase) => onChange({ phase })}
      />

      <DirectionControl
        gear={gear}
        solvedFrame={solvedFrame}
        onDirectionChange={onDirectionChange}
      />

      {gear.isDriver ? null : (
        <p className="muted">
          Followers inherit speed and direction from the driving gear.
        </p>
      )}

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
          <strong>{solvedFrame?.rpm.toFixed(2) ?? "—"}</strong>
        </div>
        <div>
          <span>Direction</span>
          <strong>
            {solvedFrame === undefined
              ? "—"
              : solvedFrame.direction === "clockwise"
                ? "CW"
                : "CCW"}
          </strong>
        </div>
      </div>
    </section>
  );
}

interface DirectionControlProps {
  readonly gear: GearNode;
  readonly onDirectionChange: (direction: RotationDirection) => void;
  readonly solvedFrame: SimulationFrame | undefined;
}

// Only driver gears own their direction; followers run whichever way the
// mesh dictates, so their control is read-only and mirrors the solver's
// resolved direction instead of the stored (editable) field.
function DirectionControl({
  gear,
  onDirectionChange,
  solvedFrame,
}: DirectionControlProps) {
  const displayedDirection = gear.isDriver
    ? gear.direction
    : (solvedFrame?.direction ?? gear.direction);

  return (
    <div className="segmentedControl" aria-label="Direction">
      {(["clockwise", "counterclockwise"] as const).map((direction) => (
        <button
          key={direction}
          className={displayedDirection === direction ? "selected" : ""}
          disabled={!gear.isDriver}
          title={
            gear.isDriver ? undefined : "Direction is set by the driving gear"
          }
          type="button"
          onClick={() => onDirectionChange(direction)}
        >
          {direction === "clockwise" ? "CW" : "CCW"}
        </button>
      ))}
    </div>
  );
}

interface NumericFieldProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly step?: number;
  readonly value: number;
  readonly onCommit: (value: number) => void;
}

function NumericField({
  disabled,
  label,
  max,
  min,
  step,
  value,
  onCommit,
}: NumericFieldProps) {
  // In-range values commit on every keystroke so the canvas responds live
  // (and the native stepper arrows work). The draft only shields in-progress
  // text that is out of range (e.g. "1" while typing "15") from being clamped
  // and written back mid-edit; blur clamps and reconciles the final value.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <label className="field">
      <span>{label}</span>
      <input
        disabled={disabled}
        max={max}
        min={min}
        step={step}
        type="number"
        value={draft ?? value}
        onBlur={() => {
          if (draft === null) {
            return;
          }

          const parsed = parseFiniteNumber(draft);

          if (parsed !== null) {
            const clamped = clampNumber(parsed, min, max);

            if (clamped !== value) {
              onCommit(clamped);
            }
          }

          setDraft(null);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);

          const parsed = parseFiniteNumber(next);

          if (parsed !== null && parsed >= min && parsed <= max) {
            onCommit(parsed);
          }
        }}
      />
    </label>
  );
}

function parseFiniteNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
