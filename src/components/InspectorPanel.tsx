import { useState } from "react";

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

      <NumericField
        key={`${gear.id}-teeth`}
        label="Teeth"
        max={120}
        min={6}
        value={gear.teeth}
        onCommit={(teeth) =>
          onChange({
            teeth,
            radius: clampNumber(teeth * 1.9, 28, 160),
          })
        }
      />

      <NumericField
        key={`${gear.id}-radius`}
        label="Radius"
        max={160}
        min={24}
        value={Math.round(gear.radius)}
        onCommit={(radius) => onChange({ radius })}
      />

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

interface NumericFieldProps {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  step?: number;
  value: number;
  onCommit: (value: number) => void;
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
  // Draft holds in-progress text so partial entries (e.g. "1" while typing
  // "15") are not clamped and written back mid-edit; clamping happens on blur.
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
            onCommit(clampNumber(parsed, min, max));
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
