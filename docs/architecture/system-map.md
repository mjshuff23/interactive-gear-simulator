# System Map

This app is a TypeScript-first, client-heavy simulator. The simulation engine is
deterministic and framework-agnostic; React owns user state and controls; PixiJS
renders the gear field; Supabase stores authenticated gear systems.

## App Architecture

```mermaid
flowchart LR
  User[User] --> Shell[React App Shell]
  Shell --> Store[Editor State]
  Store --> Engine[TypeScript Gear Solver]
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
    60 base
    GearNode[] gears
    GearConnection[] connections
    string[] drivers
    Viewport viewport
  }

  class GearNode {
    string id
    string label
    number teeth
    number module
    number radius
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
    number ratio
    number phaseOffset
  }

  class SimulationFrame {
    string gearId
    number rpm
    RotationDirection direction
    number angleDegrees
  }

  GearSystem "1" --> "*" GearNode
  GearSystem "1" --> "*" GearConnection
  GearNode "1" --> "*" SimulationFrame
```

## Simulation Loop

```mermaid
sequenceDiagram
  participant U as User
  participant R as React State
  participant E as Gear Solver
  participant C as Pixi Canvas
  participant V as Visualizations

  U->>R: edit gear, add gear, drag gear, play/pause
  R->>E: solveGearSystem(system, elapsedSeconds)
  E-->>R: framesByGear
  R->>C: render gears, teeth, radial grid
  R->>V: update ratio, angle, waveform
```

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

## Design Rules

- Keep simulator math deterministic and testable outside React.
- Keep browser code TypeScript-only.
- Do not add a Python backend for v1.
- Use Supabase publishable keys in the browser; never expose service role keys.
- Keep real math/physics labels separate from metaphor or speculative framing.
