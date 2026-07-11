# System Map

This app is a TypeScript-first, client-heavy simulator. The simulation engine is
deterministic and framework-agnostic; React owns user state and controls; PixiJS
renders the gear field; Supabase stores authenticated gear systems.

## App Architecture

```mermaid
flowchart LR
  User[User] --> Shell[React App Shell]
  Shell --> Store[Editor State]
  Store --> Geometry[Pure Pitch Geometry + Validation]
  Geometry --> Engine[TypeScript Constraint Solver]
  Geometry --> Canvas[PixiJS Gear Canvas]
  Engine --> Frames[Simulation Frames]
  Frames --> Canvas[PixiJS Gear Canvas]
  Frames --> Viz[Ratio + Waveform Panels]
  Store --> Inspector[Gear Inspector]
  Inspector --> Store
  Shell --> Persistence[TypeScript Persistence Adapter]
  Persistence --> Supabase[(Supabase Auth + Postgres)]
```

## Domain Model

```mermaid
classDiagram
  class GearSystem {
    string id
    string name
    number base
    string units
    GearNode[] gears
    GearConnection[] connections
    string[] drivers
    Viewport viewport
    string createdAt
    string updatedAt
  }

  class GearNode {
    string id
    string label
    number teeth
    number module
    Point position
    number angle
    number phase
    number rpm
    RotationDirection direction
    boolean lockedAxle
    boolean isDriver
    string color
  }

  class GearConnection {
    string id
    string sourceGearId
    string targetGearId
    ConnectionKind kind
    number phaseOffset
  }

  class SimulationFrame {
    string gearId
    number rpm
    RotationDirection direction
    number angleDegrees
    number toothAngleDegrees
  }

  GearSystem "1" --> "*" GearNode
  GearSystem "1" --> "*" GearConnection
  GearNode "1" --> "1" SimulationFrame
```

`GearSystem.base` is fixed at `60` in v1 (the schema declares it as a literal);
it drives the base-60 degree-minute-second angle readouts.

`teeth` and `module` are the canonical pitch-size fields. Pitch radius is
derived as `module * teeth / 2`, and mesh speed ratio is derived from endpoint
tooth counts. Neither value is serialized redundantly. `phaseOffset` remains a
stored mounting relationship because it depends on connection geometry.

## Simulation Loop

```mermaid
sequenceDiagram
  participant U as User
  participant R as React State
  participant G as Geometry Validator
  participant E as Gear Solver
  participant C as Pixi Canvas
  participant V as Visualizations

  U->>R: edit gear, add gear, drag gear, play/pause
  R->>G: validateConnections(system)
  G-->>R: per-link validity + jammed components
  R->>E: solveGearSystem(system, elapsedSeconds, validation)
  E-->>R: framesByGear
  R->>C: render frames + the same validation result
  R->>V: update ratio, angle, waveform
```

React memoizes validation by `GearSystem`. Invalid links and jammed components
cannot transmit motion, while disconnected unreachable gears resolve to zero
RPM at their base angle. `angleDegrees` remains the logical lesson/readout
angle; `toothAngleDegrees` is the phase-aligned Pixi tooth-mark orientation.

Dragging translates the full transitive compound component. Drop finalization
may snap that group to one existing, module-compatible mesh and then refreshes
phase offsets for every valid incident mesh. Validation itself is derived data:
it is not persisted and does not change timestamps or editor dirty state.

## Persistence Flow

```mermaid
sequenceDiagram
  participant R as React UI
  participant Z as Zod Schema
  participant P as Persistence Adapter
  participant S as Supabase

  R->>Z: validate GearSystem JSON
  Z-->>R: typed definition
  R->>P: saveGearSystem(client, definition)
  P->>S: upsert gear_systems
  S-->>P: saved row
  P-->>R: id, name, updated_at
```

The nested gear and connection schemas are strict. Persisted definitions with
legacy derived `radius` or `ratio` keys are rejected; no compatibility layer is
needed before saved production systems exist.

## Design Rules

- Keep simulator math deterministic and testable outside React.
- Treat this model as external spur-gear pitch geometry in canvas units, not a
  manufacturability, collision, torque, or force simulation.
- Keep browser code TypeScript-only.
- Do not add a Python backend for v1.
- Use Supabase publishable keys in the browser; never expose service role keys.
- Keep real math/physics labels separate from metaphor or speculative framing.
