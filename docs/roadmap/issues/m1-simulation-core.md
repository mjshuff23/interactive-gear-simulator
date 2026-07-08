## Goal

Build the deterministic TypeScript simulation core that all rendering and visualization depends on.

## Deliverables

- `GearSystem`, `GearNode`, `GearConnection`, and `SimulationFrame` types.
- Solver for driver gears, meshed gear ratios, opposite rotation, compound axles, phase offsets, and elapsed time.
- Base-60 degree-minute-second angle formatter.
- Focused Vitest coverage for the core math.

## Acceptance Criteria

- Meshed 60T -> 30T gears resolve to a 2:1 speed ratio and opposite direction.
- Compound axle gears share speed and direction with phase offset.
- Sexagesimal formatting handles rounding carry correctly.
- Simulation logic stays framework-agnostic and importable outside React.
